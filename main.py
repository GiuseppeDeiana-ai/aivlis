import asyncio
import io
import os
import secrets
from pathlib import Path

import qrcode
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from game import BOSS_ID, GameState

BASE_DIR = Path(__file__).parent
ADMIN_KEY = os.environ.get("ADMIN_KEY", "regia123")
BOSS_KEY = os.environ.get("BOSS_KEY", "boss123")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")

WHEEL_SPIN_SECONDS = 3.0  # must match the CSS transition duration in static/js/wheel.js
DUEL_TIMEOUT_SECONDS = 20.0

app = FastAPI()
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

game = GameState(BASE_DIR / "questions.json", BASE_DIR / "duels.json", BASE_DIR / "penitenze.json")
duel_timeout_task: asyncio.Task | None = None


class Hub:
    def __init__(self):
        self.regia: set[WebSocket] = set()
        self.boss: set[WebSocket] = set()
        self.guests: dict[str, WebSocket] = {}

    @staticmethod
    async def _send(ws: WebSocket, data: dict):
        try:
            await ws.send_json(data)
        except Exception:
            pass

    async def to_regia(self, data: dict):
        for ws in list(self.regia):
            await self._send(ws, data)

    async def to_boss(self, data: dict):
        for ws in list(self.boss):
            await self._send(ws, data)

    async def to_guests(self, data: dict):
        for ws in list(self.guests.values()):
            await self._send(ws, data)

    async def to_all(self, data: dict):
        await self.to_regia(data)
        await self.to_boss(data)
        await self.to_guests(data)


hub = Hub()


async def broadcast_state():
    await hub.to_all({"type": "state", "payload": game.public_state()})


def cancel_duel_timeout():
    global duel_timeout_task
    if duel_timeout_task is not None:
        duel_timeout_task.cancel()
        duel_timeout_task = None


async def run_duel_timeout():
    try:
        await asyncio.sleep(DUEL_TIMEOUT_SECONDS)
    except asyncio.CancelledError:
        return
    if game.resolve_duel_timeout():
        await hub.to_all({"type": "duel_result", "payload": game.public_duel_result(timeout=True)})
        await broadcast_state()


async def run_penance_sequence():
    result = game.spin_penance_wheel()
    if result is None:
        return
    await hub.to_all({"type": "penance_spin", "payload": {"index": result["index"], "count": len(game.penances)}})
    await asyncio.sleep(WHEEL_SPIN_SECONDS)
    await hub.to_all({"type": "penance_result", "payload": result})
    await broadcast_state()


async def run_wheel_sequence():
    global duel_timeout_task
    category = game.spin_wheel()
    if category is None:
        return
    await hub.to_all({"type": "wheel_result", "payload": {"category": category}})
    await asyncio.sleep(WHEEL_SPIN_SECONDS)
    game.open_duel_challenge()
    await hub.to_all({"type": "duel_challenge", "payload": game.public_duel_challenge()})
    await broadcast_state()
    duel_timeout_task = asyncio.create_task(run_duel_timeout())


@app.get("/", response_class=HTMLResponse)
def guest_page(request: Request):
    return templates.TemplateResponse("guest.html", {"request": request})


@app.get("/boss", response_class=HTMLResponse)
def boss_page(request: Request):
    return templates.TemplateResponse("boss.html", {"request": request})


@app.get("/regia", response_class=HTMLResponse)
def regia_page(request: Request):
    return templates.TemplateResponse("regia.html", {"request": request})


@app.get("/qr.png")
def qr_png(request: Request):
    url = PUBLIC_URL or str(request.base_url)
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@app.websocket("/ws/guest")
async def ws_guest(websocket: WebSocket, name: str = "", id: str = ""):
    await websocket.accept()
    guest_id = id or secrets.token_hex(8)
    guest_name = name.strip()[:24] or f"Ospite-{guest_id[:4]}"
    game.add_guest(guest_id, guest_name)
    hub.guests[guest_id] = websocket
    await hub._send(websocket, {"type": "welcome", "payload": {"guest_id": guest_id, "name": guest_name}})
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
                    if result:
                        await hub.to_all({"type": "winner", "payload": {"name": guest_name, "guest_id": guest_id}})
                    await broadcast_state()
            elif t == "duel_answer":
                choice = int(data["choice"])
                result = game.submit_duel_answer(guest_id, choice)
                if result is not None:
                    if game.duel_resolved():
                        cancel_duel_timeout()
                        await hub.to_all({"type": "duel_result", "payload": game.public_duel_result()})
                        await broadcast_state()
                    else:
                        await hub.to_all({"type": "duel_answer_registered", "payload": {"by": "challenger"}})
    except WebSocketDisconnect:
        if guest_id in game.guests:
            game.guests[guest_id].connected = False
        hub.guests.pop(guest_id, None)
        await broadcast_state()


@app.websocket("/ws/boss")
async def ws_boss(websocket: WebSocket, key: str = ""):
    if key != BOSS_KEY:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    hub.boss.add(websocket)
    await broadcast_state()
    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "answer":
                ok = game.submit_boss_answer(int(data["choice"]))
                if ok:
                    q = game.current_question
                    await hub.to_guests({"type": "round_open", "payload": {"text": q["text"], "options": q["options"]}})
                    await broadcast_state()
            elif t == "spin_wheel":
                asyncio.create_task(run_wheel_sequence())
            elif t == "spin_penance":
                if game.can_spin_penance():
                    asyncio.create_task(run_penance_sequence())
                else:
                    await hub._send(websocket, {"type": "penance_denied", "payload": {"remaining": game.penance_remaining()}})
            elif t == "duel_answer":
                choice = int(data["choice"])
                result = game.submit_duel_answer(BOSS_ID, choice)
                if result is not None:
                    if game.duel_resolved():
                        cancel_duel_timeout()
                        await hub.to_all({"type": "duel_result", "payload": game.public_duel_result()})
                        await broadcast_state()
                    else:
                        await hub.to_all({"type": "duel_answer_registered", "payload": {"by": "boss"}})
    except WebSocketDisconnect:
        hub.boss.discard(websocket)


@app.websocket("/ws/regia")
async def ws_regia(websocket: WebSocket, key: str = ""):
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
            if t == "start_round":
                if game.start_round():
                    q = game.current_question
                    await hub.to_boss({
                        "type": "round_started",
                        "payload": {"text": q["text"], "options": q["options"], "round": game.round_index + 1, "total": len(game.questions)},
                    })
                    await hub.to_guests({"type": "wait_boss", "payload": {}})
                await broadcast_state()
            elif t == "start_duel":
                if game.start_duel():
                    await hub.to_all({"type": "duel_start", "payload": {"challenger_name": game.guests[game.challenger_id].name}})
                await broadcast_state()
            elif t == "cancel_duel":
                cancel_duel_timeout()
                if game.cancel_duel():
                    await hub.to_all({"type": "duel_cancelled", "payload": {}})
                await broadcast_state()
            elif t == "set_penance_limit":
                game.set_penance_limit(int(data.get("limit", 3)))
                await broadcast_state()
            elif t == "damage_boss":
                game.damage_boss(int(data.get("amount", 10)))
                await hub.to_all({"type": "boss_hit", "payload": {"amount": int(data.get("amount", 10))}})
                await broadcast_state()
            elif t == "reset":
                cancel_duel_timeout()
                game.reset()
                await hub.to_all({"type": "reset", "payload": {}})
                await broadcast_state()
    except WebSocketDisconnect:
        hub.regia.discard(websocket)
