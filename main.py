import asyncio
import io
import os
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path

import qrcode
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from game import BOSS_ID, GameState

BASE_DIR = Path(__file__).parent
ADMIN_KEY = os.environ.get("ADMIN_KEY", "regia123")
BOSS_KEY = os.environ.get("BOSS_KEY", "boss123")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")

WHEEL_SPIN_SECONDS = 3.0  # must match the CSS transition duration in static/js/wheel.js
DUEL_TIMEOUT_SECONDS = 20.0
RETURN_HOME_SECONDS = 5.0  # quanto restare sulla schermata di risultato prima di tornare alla home
DUEL_COUNTDOWN_SECONDS = 3.0  # conto alla rovescia dopo che la regia invia la sfida a tutti
ROUND_COUNTDOWN_SECONDS = 3.0  # conto alla rovescia dopo la risposta del boss, prima che gli invitati vedano la domanda
ROUND_REVEAL_SECONDS = 20.0  # finestra di risposta per gli invitati prima di rivelare chi ha indovinato per primo
PING_INTERVAL_SECONDS = 20.0  # sotto i tipici timeout di inattivita' dei proxy cloud (es. Render, ~55-60s)


async def run_ping_loop():
    """Mantiene vive le connessioni websocket dietro un proxy cloud: senza traffico periodico,
    un invitato che resta inattivo per circa un minuto rischia di essere disconnesso in silenzio."""
    while True:
        await asyncio.sleep(PING_INTERVAL_SECONDS)
        await hub.to_all({"type": "ping", "payload": {}})


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(run_ping_loop())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/resources", StaticFiles(directory=str(BASE_DIR / "resources")), name="resources")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Cambia ad ogni riavvio del processo (quindi ad ogni deploy): forza i browser a scaricare
# JS/CSS aggiornati invece di servire versioni vecchie dalla cache.
ASSET_VERSION = str(int(time.time()))
templates.env.globals["asset_version"] = ASSET_VERSION

game = GameState(BASE_DIR / "questions.json", BASE_DIR / "duels.json", BASE_DIR / "penitenze.json")
duel_timeout_task: asyncio.Task | None = None
duel_countdown_task: asyncio.Task | None = None
round_reveal_task: asyncio.Task | None = None


SEND_TIMEOUT_SECONDS = 4.0  # oltre questo tempo una connessione si considera bloccata/morta


class Hub:
    """Con molti invitati collegati, i messaggi vanno inviati in PARALLELO: inviarli uno alla
    volta (in sequenza) farebbe arrivare la domanda prima a chi e' stato connesso per primo,
    creando un vantaggio ingiusto, e una connessione bloccata rallenterebbe tutti gli altri."""

    def __init__(self):
        self.regia: set[WebSocket] = set()
        self.boss: set[WebSocket] = set()
        self.guests: dict[str, WebSocket] = {}
        self.spectators: set[WebSocket] = set()

    @staticmethod
    async def _send(ws: WebSocket, data: dict) -> bool:
        try:
            await asyncio.wait_for(ws.send_json(data), timeout=SEND_TIMEOUT_SECONDS)
            return True
        except Exception:
            return False

    async def to_regia(self, data: dict):
        conns = list(self.regia)
        if not conns:
            return
        results = await asyncio.gather(*(self._send(ws, data) for ws in conns))
        for ws, ok in zip(conns, results):
            if not ok:
                self.regia.discard(ws)

    async def to_boss(self, data: dict):
        conns = list(self.boss)
        if not conns:
            return
        results = await asyncio.gather(*(self._send(ws, data) for ws in conns))
        for ws, ok in zip(conns, results):
            if not ok:
                self.boss.discard(ws)

    async def to_guests(self, data: dict):
        items = list(self.guests.items())
        if not items:
            return
        results = await asyncio.gather(*(self._send(ws, data) for _, ws in items))
        for (guest_id, _), ok in zip(items, results):
            if not ok:
                self.guests.pop(guest_id, None)

    async def to_spectators(self, data: dict):
        conns = list(self.spectators)
        if not conns:
            return
        results = await asyncio.gather(*(self._send(ws, data) for ws in conns))
        for ws, ok in zip(conns, results):
            if not ok:
                self.spectators.discard(ws)

    async def to_all(self, data: dict):
        await asyncio.gather(self.to_regia(data), self.to_boss(data), self.to_guests(data), self.to_spectators(data))


hub = Hub()


async def log(text: str):
    """Log visibile solo alla regia, per capire cosa succede in tempo reale."""
    await hub.to_regia({"type": "log", "payload": {"ts": time.time(), "text": text}})


async def broadcast_state():
    payload = game.public_state()
    payload["spectators_online"] = len(hub.spectators)
    await hub.to_all({"type": "state", "payload": payload})


async def check_game_over():
    if game.hp <= 0:
        await log("💀 La festeggiata e' stata sconfitta! Game over.")


def cancel_duel_timeout():
    global duel_timeout_task
    if duel_timeout_task is not None:
        duel_timeout_task.cancel()
        duel_timeout_task = None


def cancel_duel_countdown():
    global duel_countdown_task
    if duel_countdown_task is not None:
        duel_countdown_task.cancel()
        duel_countdown_task = None


def cancel_round_reveal():
    global round_reveal_task
    if round_reveal_task is not None:
        round_reveal_task.cancel()
        round_reveal_task = None


async def broadcast_duel_result(payload: dict):
    await hub.to_all({"type": "duel_result", "payload": payload})
    await broadcast_state()
    outcome = payload["outcome"]
    if outcome == "challenger":
        await log(f"⚔️ Scontro vinto da {payload['winner_name']}! -{payload['damage']} HP alla festeggiata.")
    elif outcome == "boss":
        await log("⚔️ La festeggiata ha risposto prima! Nessun danno.")
    elif outcome == "timeout":
        await log("⚔️ Tempo scaduto nello scontro diretto, nessun danno.")
    else:
        await log("⚔️ Nessuno ha risposto correttamente allo scontro, nessun danno.")
    await check_game_over()
    if game.hp > 0:
        asyncio.create_task(run_return_home())


async def run_return_home():
    await asyncio.sleep(RETURN_HOME_SECONDS)
    await hub.to_all({"type": "return_home", "payload": {}})
    await log("🏠 Tutti sono tornati alla home. Puoi far girare la ruota delle penitenze o avviare la prossima domanda.")


async def run_duel_timeout():
    try:
        await asyncio.sleep(DUEL_TIMEOUT_SECONDS)
    except asyncio.CancelledError:
        return
    if game.resolve_duel_timeout():
        await broadcast_duel_result(game.public_duel_result(timeout=True))


async def run_penance_sequence():
    result = game.spin_penance_wheel()
    if result is None:
        return
    await log("🎡 La festeggiata gira la ruota delle penitenze...")
    await hub.to_all({"type": "penance_spin", "payload": {"index": result["index"], "count": len(game.penances)}})
    await asyncio.sleep(WHEEL_SPIN_SECONDS)
    await hub.to_all({"type": "penance_result", "payload": result})
    await broadcast_state()
    await log(f"❤️ Penitenza estratta: \"{result['text']}\" — in attesa di conferma dalla regia (+{result['heal']} HP)")


async def run_wheel_sequence():
    category = game.spin_wheel()
    if category is None:
        return
    await log(f"🎡 Ruota dello scontro girata: categoria \"{category}\"")
    await hub.to_all({"type": "wheel_result", "payload": {"category": category}})
    await asyncio.sleep(WHEEL_SPIN_SECONDS)
    await hub.to_regia({"type": "duel_ready_confirm", "payload": {"category": category}})
    await log("🎯 Sfida pronta: in attesa che la regia la invii a tutti...")


async def run_duel_countdown():
    global duel_timeout_task
    await hub.to_all({"type": "duel_countdown", "payload": {"seconds": DUEL_COUNTDOWN_SECONDS}})
    try:
        await asyncio.sleep(DUEL_COUNTDOWN_SECONDS)
    except asyncio.CancelledError:
        return
    game.open_duel_challenge()
    await hub.to_all({"type": "duel_challenge", "payload": game.public_duel_challenge()})
    await broadcast_state()
    await log("🎯 Sfida rivelata, in attesa delle risposte...")
    duel_timeout_task = asyncio.create_task(run_duel_timeout())


async def run_round_open_sequence():
    global round_reveal_task
    await hub.to_all({"type": "round_countdown", "payload": {"seconds": ROUND_COUNTDOWN_SECONDS}})
    await asyncio.sleep(ROUND_COUNTDOWN_SECONDS)
    q = game.current_question
    game.mark_round_open()
    payload = {"text": q["text"], "options": q["options"], "seconds": ROUND_REVEAL_SECONDS}
    await hub.to_guests({"type": "round_open", "payload": payload})
    await hub.to_spectators({"type": "round_open", "payload": payload})
    await log(f"👑 La festeggiata ha risposto alla domanda {game.round_index + 1}. Ora rispondono gli invitati (20s).")
    await broadcast_state()
    round_reveal_task = asyncio.create_task(run_round_reveal_timeout())


async def run_round_reveal_timeout():
    try:
        await asyncio.sleep(ROUND_REVEAL_SECONDS)
    except asyncio.CancelledError:
        return
    if not game.is_awaiting_guest_answers():
        return
    winner_id = game.finalize_round_winner()
    if winner_id and winner_id in game.guests:
        name = game.guests[winner_id].name
        await hub.to_all({"type": "winner", "payload": {"name": name, "guest_id": winner_id}})
        await log(f"🏆 {name} ha indovinato per primo! Pronto per lo scontro diretto.")
    else:
        await hub.to_all({"type": "winner", "payload": {"name": None, "guest_id": None}})
        await log("😶 Nessuno ha indovinato questa volta.")
    await broadcast_state()


@app.get("/", response_class=HTMLResponse)
def guest_page(request: Request):
    return templates.TemplateResponse("guest.html", {"request": request})


@app.get("/boss", response_class=HTMLResponse)
def boss_page(request: Request):
    return templates.TemplateResponse("boss.html", {"request": request})


@app.get("/regia", response_class=HTMLResponse)
def regia_page(request: Request):
    return templates.TemplateResponse("regia.html", {"request": request})


@app.get("/spectate", response_class=HTMLResponse)
def spectate_page(request: Request):
    return templates.TemplateResponse("spectate.html", {"request": request})


@app.get("/api/status")
def api_status():
    return JSONResponse({"started": game.game_started})


@app.get("/qr.png")
def qr_png(request: Request):
    url = PUBLIC_URL or str(request.base_url)
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@app.get("/qr_spectate.png")
def qr_spectate_png(request: Request):
    base = PUBLIC_URL or str(request.base_url)
    url = base.rstrip("/") + "/spectate"
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@app.websocket("/ws/guest")
async def ws_guest(websocket: WebSocket, name: str = "", id: str = ""):
    await websocket.accept()
    if not game.game_started:
        await hub._send(websocket, {"type": "lobby_locked", "payload": {}})
        await websocket.close(code=4403)
        return
    guest_id = id or secrets.token_hex(8)
    guest_name = name.strip()[:24] or f"Ospite-{guest_id[:4]}"
    game.add_guest(guest_id, guest_name)
    hub.guests[guest_id] = websocket
    await hub._send(websocket, {"type": "welcome", "payload": {"guest_id": guest_id, "name": guest_name}})
    await log(f"👤 {guest_name} si e' connesso ({len(hub.guests)} online)")
    await broadcast_state()
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "answer":
                choice = int(data["choice"])
                result = game.submit_guest_answer(guest_id, choice)
                if result is None:
                    await hub._send(websocket, {"type": "answer_ack", "payload": {"status": "not_open_or_duplicate"}})
                else:
                    await hub._send(websocket, {"type": "answer_ack", "payload": {"status": "correct" if result else "wrong"}})
                    await hub.to_regia({"type": "answer_progress", "payload": {"name": guest_name}})
                    await hub.to_spectators({"type": "answer_progress", "payload": {"name": guest_name}})
                    if result:
                        await log(f"✅ {guest_name} ha risposto correttamente, in attesa della rivelazione...")
                    else:
                        await log(f"❌ {guest_name} ha risposto, ma diverso dalla festeggiata.")
                    await broadcast_state()
            elif t == "duel_answer":
                choice = int(data["choice"])
                result = game.submit_duel_answer(guest_id, choice)
                if result is not None:
                    if game.duel_resolved():
                        cancel_duel_timeout()
                        await broadcast_duel_result(game.public_duel_result())
                    else:
                        await hub.to_all({"type": "duel_answer_registered", "payload": {"by": "challenger"}})
                        await log(f"✍️ {guest_name} (sfidante) ha risposto, in attesa della festeggiata...")
    except WebSocketDisconnect:
        if guest_id in game.guests:
            game.guests[guest_id].connected = False
        hub.guests.pop(guest_id, None)
        await log(f"👤 {guest_name} si e' disconnesso")
        await broadcast_state()


@app.websocket("/ws/spectate")
async def ws_spectate(websocket: WebSocket):
    """Ruolo di sola visione: nessun nome, nessuna chiave, nessuna interazione di gioco."""
    await websocket.accept()
    hub.spectators.add(websocket)
    await log(f"👀 Uno spettatore si e' collegato ({len(hub.spectators)} online)")
    await broadcast_state()
    try:
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        hub.spectators.discard(websocket)
        await log(f"👀 Uno spettatore si e' disconnesso ({len(hub.spectators)} online)")
        await broadcast_state()


@app.websocket("/ws/boss")
async def ws_boss(websocket: WebSocket, key: str = ""):
    if key != BOSS_KEY:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    hub.boss.add(websocket)
    await log("👑 La festeggiata si e' connessa")
    await broadcast_state()
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "answer":
                ok = game.submit_boss_answer(int(data["choice"]))
                if ok:
                    asyncio.create_task(run_round_open_sequence())
            elif t == "spin_wheel":
                asyncio.create_task(run_wheel_sequence())
            elif t == "spin_penance":
                if game.can_spin_penance():
                    asyncio.create_task(run_penance_sequence())
                else:
                    await hub._send(websocket, {"type": "penance_denied", "payload": {"remaining": game.penance_remaining()}})
                    await log(f"🚫 Tentativo di girare la ruota penitenze negato (rimaste: {game.penance_remaining()})")
            elif t == "duel_answer":
                choice = int(data["choice"])
                result = game.submit_duel_answer(BOSS_ID, choice)
                if result is not None:
                    if game.duel_resolved():
                        cancel_duel_timeout()
                        await broadcast_duel_result(game.public_duel_result())
                    else:
                        await hub.to_all({"type": "duel_answer_registered", "payload": {"by": "boss"}})
                        await log("✍️ La festeggiata ha risposto, in attesa dello sfidante...")
    except WebSocketDisconnect:
        hub.boss.discard(websocket)
        await log("👑 La festeggiata si e' disconnessa")


@app.websocket("/ws/regia")
async def ws_regia(websocket: WebSocket, key: str = ""):
    global duel_countdown_task
    if key != ADMIN_KEY:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    hub.regia.add(websocket)
    await broadcast_state()
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "start_game":
                if game.start_game():
                    await log("🎉 Partita avviata dalla regia! Gli invitati possono entrare.")
                    await broadcast_state()
                else:
                    await log("ℹ️ La partita e' già stata avviata.")
            elif t == "start_round":
                cancel_round_reveal()
                if game.start_round():
                    q = game.current_question
                    await hub.to_boss({
                        "type": "round_started",
                        "payload": {"text": q["text"], "options": q["options"], "round": game.round_index + 1, "total": len(game.questions)},
                    })
                    await hub.to_guests({"type": "wait_boss", "payload": {}})
                    await hub.to_spectators({"type": "wait_boss", "payload": {}})
                    await log(f"▶️ Domanda {game.round_index + 1}/{len(game.questions)} avviata.")
                else:
                    await log("ℹ️ Non ci sono altre domande da avviare.")
                await broadcast_state()
            elif t == "start_duel":
                if game.start_duel():
                    challenger_name = game.guests[game.challenger_id].name
                    await hub.to_all({"type": "duel_start", "payload": {"challenger_name": challenger_name}})
                    await log(f"⚔️ Scontro diretto avviato: {challenger_name} vs la festeggiata.")
                else:
                    await log("🚫 Impossibile avviare lo scontro: nessun vincitore in attesa.")
                await broadcast_state()
            elif t == "confirm_duel_send":
                if game.confirm_duel_send():
                    duel_countdown_task = asyncio.create_task(run_duel_countdown())
                else:
                    await log("ℹ️ Nessuna sfida in attesa di essere inviata.")
            elif t == "cancel_duel":
                cancel_duel_timeout()
                cancel_duel_countdown()
                if game.cancel_duel():
                    await hub.to_all({"type": "duel_cancelled", "payload": {}})
                    await log("🚫 Scontro diretto annullato dalla regia.")
                await broadcast_state()
            elif t == "confirm_penance":
                amount = game.confirm_penance()
                if amount is not None:
                    await hub.to_all({"type": "penance_confirmed", "payload": {"heal": amount}})
                    await log(f"✅ Penitenza confermata dalla regia: +{amount} HP alla festeggiata.")
                    await broadcast_state()
                else:
                    await log("ℹ️ Nessuna penitenza in attesa da confermare.")
            elif t == "decline_penance":
                if game.decline_penance():
                    await hub.to_all({"type": "penance_declined", "payload": {}})
                    await log("❌ Penitenza NON confermata dalla regia: nessun HP guadagnato.")
                    await broadcast_state()
                else:
                    await log("ℹ️ Nessuna penitenza in attesa da rifiutare.")
            elif t == "set_penance_limit":
                limit = int(data.get("limit", 3))
                game.set_penance_limit(limit)
                await log(f"⚙️ Limite penitenze impostato a {limit}.")
                await broadcast_state()
            elif t == "damage_boss":
                amount = int(data.get("amount", 10))
                game.damage_boss(amount)
                await hub.to_all({"type": "boss_hit", "payload": {"amount": amount}})
                await log(f"💥 Danno manuale dalla regia: -{amount} HP.")
                await check_game_over()
                await broadcast_state()
            elif t == "reveal_leaderboard":
                if game.hp <= 0:
                    payload = {
                        "leaderboard": game.public_state()["leaderboard"],
                        "awards": game.compute_awards(),
                    }
                    await hub.to_all({"type": "reveal_leaderboard", "payload": payload})
                    await log("🏆 Classifica finale rivelata a tutti dalla regia.")
                else:
                    await log("ℹ️ La partita non e' ancora finita, non si può rivelare la classifica.")
            elif t == "reset":
                cancel_duel_timeout()
                cancel_duel_countdown()
                cancel_round_reveal()
                game.reset()
                await hub.to_all({"type": "reset", "payload": {}})
                await log("🔄 Partita resettata dalla regia.")
                await broadcast_state()
    except WebSocketDisconnect:
        hub.regia.discard(websocket)
