import io
import os
import secrets
from pathlib import Path

import qrcode
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from game import GameState

BASE_DIR = Path(__file__).parent
ADMIN_KEY = os.environ.get("ADMIN_KEY", "regia123")
BOSS_KEY = os.environ.get("BOSS_KEY", "boss123")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")

app = FastAPI()
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

game = GameState(BASE_DIR / "questions.json")


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
            if data.get("type") == "answer":
                choice = int(data["choice"])
                result = game.submit_guest_answer(guest_id, choice)
                if result is None:
                    await hub._send(websocket, {"type": "answer_ack", "payload": {"status": "not_open_or_duplicate"}})
                else:
                    await hub._send(websocket, {"type": "answer_ack", "payload": {"status": "correct" if result else "wrong"}})
                    if result:
                        await hub.to_all({"type": "winner", "payload": {"name": guest_name, "guest_id": guest_id}})
                    await broadcast_state()
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
            if data.get("type") == "answer":
                ok = game.submit_boss_answer(int(data["choice"]))
                if ok:
                    q = game.current_question
                    await hub.to_guests({"type": "round_open", "payload": {"text": q["text"], "options": q["options"]}})
                    await broadcast_state()
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
            elif t == "damage_boss":
                game.damage_boss(int(data.get("amount", 10)))
                await hub.to_all({"type": "boss_hit", "payload": {"amount": int(data.get("amount", 10))}})
                await broadcast_state()
            elif t == "reset":
                game.reset()
                await hub.to_all({"type": "reset", "payload": {}})
                await broadcast_state()
    except WebSocketDisconnect:
        hub.regia.discard(websocket)
