import json
import random
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

DUEL_CATEGORIES = ["musica", "film", "videogioco", "data"]
DUEL_DAMAGE = 25
DUEL_WIN_BONUS_SCORE = 3


class Phase(str, Enum):
    LOBBY = "lobby"
    BOSS_ANSWERING = "boss_answering"
    GUESTS_ANSWERING = "guests_answering"
    ROUND_RESULT = "round_result"
    DUEL_WHEEL = "duel_wheel"
    DUEL_CHALLENGE = "duel_challenge"
    DUEL_RESULT = "duel_result"
    GAME_OVER = "game_over"


@dataclass
class Guest:
    id: str
    name: str
    score: int = 0
    connected: bool = True


class GameState:
    def __init__(self, questions_path: Path, duels_path: Path, max_hp: int = 100):
        self.questions = json.loads(Path(questions_path).read_text(encoding="utf-8"))
        self.duels: dict[str, list[dict]] = json.loads(Path(duels_path).read_text(encoding="utf-8"))
        self.round_index = -1
        self.phase = Phase.LOBBY
        self.boss_answer: Optional[int] = None
        self.guest_answers: dict[str, dict] = {}
        self.winner_id: Optional[str] = None
        self.guests: dict[str, Guest] = {}
        self.max_hp = max_hp
        self.hp = max_hp

        self.used_challenge_ids: set[str] = set()
        self.challenger_id: Optional[str] = None
        self.duel_category: Optional[str] = None
        self.duel_challenge: Optional[dict] = None

    @property
    def current_question(self):
        if 0 <= self.round_index < len(self.questions):
            return self.questions[self.round_index]
        return None

    def start_round(self) -> bool:
        if self.round_index + 1 >= len(self.questions):
            self.phase = Phase.GAME_OVER
            return False
        self.round_index += 1
        self.phase = Phase.BOSS_ANSWERING
        self.boss_answer = None
        self.guest_answers = {}
        self.winner_id = None
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None
        return True

    def submit_boss_answer(self, choice: int) -> bool:
        if self.phase != Phase.BOSS_ANSWERING:
            return False
        self.boss_answer = choice
        self.phase = Phase.GUESTS_ANSWERING
        return True

    def submit_guest_answer(self, guest_id: str, choice: int) -> Optional[bool]:
        if self.phase != Phase.GUESTS_ANSWERING:
            return None
        if guest_id in self.guest_answers:
            return None
        self.guest_answers[guest_id] = {"choice": choice, "at": time.time()}
        is_correct = choice == self.boss_answer
        if is_correct and self.winner_id is None:
            self.winner_id = guest_id
            self.phase = Phase.ROUND_RESULT
            if guest_id in self.guests:
                self.guests[guest_id].score += 1
        return is_correct

    def add_guest(self, guest_id: str, name: str):
        if guest_id not in self.guests:
            self.guests[guest_id] = Guest(id=guest_id, name=name)
        else:
            self.guests[guest_id].name = name
            self.guests[guest_id].connected = True

    def damage_boss(self, amount: int):
        self.hp = max(0, self.hp - amount)
        if self.hp == 0:
            self.phase = Phase.GAME_OVER

    def reset(self):
        self.round_index = -1
        self.phase = Phase.LOBBY
        self.boss_answer = None
        self.guest_answers = {}
        self.winner_id = None
        self.hp = self.max_hp
        self.used_challenge_ids = set()
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None

    # ---- duel (scontro diretto) ----

    def start_duel(self) -> bool:
        if self.phase != Phase.ROUND_RESULT or not self.winner_id:
            return False
        self.challenger_id = self.winner_id
        self.phase = Phase.DUEL_WHEEL
        return True

    def cancel_duel(self) -> bool:
        if self.phase not in (Phase.DUEL_WHEEL, Phase.DUEL_CHALLENGE):
            return False
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None
        self.phase = Phase.ROUND_RESULT
        return True

    def _pick_challenge(self, category: str) -> dict:
        pool = [c for c in self.duels.get(category, []) if c["id"] not in self.used_challenge_ids]
        if not pool:
            pool = self.duels.get(category, [])
            self.used_challenge_ids -= {c["id"] for c in pool}
        challenge = random.choice(pool)
        self.used_challenge_ids.add(challenge["id"])
        return challenge

    def spin_wheel(self) -> Optional[str]:
        if self.phase != Phase.DUEL_WHEEL:
            return None
        category = random.choice(DUEL_CATEGORIES)
        self.duel_category = category
        self.duel_challenge = self._pick_challenge(category)
        return category

    def open_duel_challenge(self):
        self.phase = Phase.DUEL_CHALLENGE

    def submit_duel_answer(self, guest_id: str, choice: int) -> Optional[bool]:
        if self.phase != Phase.DUEL_CHALLENGE or guest_id != self.challenger_id:
            return None
        correct = choice == self.duel_challenge["answer"]
        if correct:
            self.damage_boss(DUEL_DAMAGE)
            if guest_id in self.guests:
                self.guests[guest_id].score += DUEL_WIN_BONUS_SCORE
        self.phase = Phase.DUEL_RESULT
        return correct

    def resolve_duel_timeout(self) -> bool:
        if self.phase != Phase.DUEL_CHALLENGE:
            return False
        self.phase = Phase.DUEL_RESULT
        return True

    def public_duel_challenge(self) -> Optional[dict]:
        c = self.duel_challenge
        if not c:
            return None
        return {
            "category": self.duel_category,
            "kind": c.get("kind", "image"),
            "media": c.get("media"),
            "prompt": c.get("prompt"),
            "options": c["options"],
            "challenger_id": self.challenger_id,
            "challenger_name": self.guests[self.challenger_id].name if self.challenger_id in self.guests else "?",
        }

    def public_state(self) -> dict:
        q = self.current_question
        winner_name = None
        if self.winner_id and self.winner_id in self.guests:
            winner_name = self.guests[self.winner_id].name
        challenger_name = None
        if self.challenger_id and self.challenger_id in self.guests:
            challenger_name = self.guests[self.challenger_id].name
        return {
            "phase": self.phase.value,
            "round": self.round_index + 1,
            "total_rounds": len(self.questions),
            "question": {"text": q["text"], "options": q["options"]} if q else None,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "winner": winner_name,
            "answers_count": len(self.guest_answers),
            "guests_online": sum(1 for g in self.guests.values() if g.connected),
            "leaderboard": sorted(
                ({"name": g.name, "score": g.score} for g in self.guests.values()),
                key=lambda x: -x["score"],
            )[:10],
            "challenger_name": challenger_name,
            "duel_category": self.duel_category,
        }
