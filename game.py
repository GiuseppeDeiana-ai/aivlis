import json
import random
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

DUEL_CATEGORIES = ["musica", "film", "videogioco", "data"]
DUEL_DAMAGE = 25
DUEL_WIN_BONUS_SCORE = 1
BOSS_ID = "boss"
PENANCE_HEAL = 10
DEFAULT_PENANCE_LIMIT = 3


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
    correct_answers: int = 0
    duels_won: int = 0
    duels_lost: int = 0
    fastest_correct_seconds: Optional[float] = None


class GameState:
    def __init__(self, questions_path: Path, duels_path: Path, penances_path: Path, max_hp: int = 100):
        self.questions = json.loads(Path(questions_path).read_text(encoding="utf-8"))
        self.duels: dict[str, list[dict]] = json.loads(Path(duels_path).read_text(encoding="utf-8"))
        self.penances: list[str] = json.loads(Path(penances_path).read_text(encoding="utf-8"))
        self.game_started = False
        self.round_index = -1
        self.phase = Phase.LOBBY
        self.boss_answer: Optional[int] = None
        self.round_open_at: Optional[float] = None
        self.guest_answers: dict[str, dict] = {}
        self.winner_id: Optional[str] = None
        self.guests: dict[str, Guest] = {}
        self.max_hp = max_hp
        self.hp = max_hp

        self.used_challenge_ids: set[str] = set()
        self.challenger_id: Optional[str] = None
        self.duel_category: Optional[str] = None
        self.duel_challenge: Optional[dict] = None
        self.duel_answers: dict[str, dict] = {}
        self.duel_winner: Optional[str] = None
        self.duel_awaiting_confirm: bool = False

        self.penance_limit: int = DEFAULT_PENANCE_LIMIT
        self.penance_used: int = 0
        self.used_penance_indices: set[int] = set()
        self.pending_penance_heal: Optional[int] = None

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
        self.round_open_at = None
        self.guest_answers = {}
        self.winner_id = None
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None
        self.duel_answers = {}
        self.duel_winner = None
        self.duel_awaiting_confirm = False
        return True

    def submit_boss_answer(self, choice: int) -> bool:
        if self.phase != Phase.BOSS_ANSWERING:
            return False
        self.boss_answer = choice
        self.phase = Phase.GUESTS_ANSWERING
        return True

    def is_awaiting_guest_answers(self) -> bool:
        return self.phase == Phase.GUESTS_ANSWERING

    def mark_round_open(self):
        """Chiamato quando la domanda diventa visibile agli invitati: e' il momento
        zero da cui si misura chi ha risposto piu' velocemente per il premio finale."""
        self.round_open_at = time.time()

    def submit_guest_answer(self, guest_id: str, choice: int) -> Optional[bool]:
        if self.phase != Phase.GUESTS_ANSWERING:
            return None
        if guest_id in self.guest_answers:
            return None
        at = time.time()
        self.guest_answers[guest_id] = {"choice": choice, "at": at}
        is_correct = choice == self.boss_answer
        if is_correct and guest_id in self.guests:
            guest = self.guests[guest_id]
            guest.correct_answers += 1
            if self.round_open_at is not None:
                elapsed = at - self.round_open_at
                if guest.fastest_correct_seconds is None or elapsed < guest.fastest_correct_seconds:
                    guest.fastest_correct_seconds = elapsed
        return is_correct

    def finalize_round_winner(self) -> Optional[str]:
        """Dopo la finestra di risposta (20s), determina chi ha risposto correttamente
        per primo confrontando i timestamp raccolti - il resto della suspance e' voluta."""
        if self.phase != Phase.GUESTS_ANSWERING:
            return None
        correct = [
            (gid, a["at"]) for gid, a in self.guest_answers.items()
            if a["choice"] == self.boss_answer
        ]
        self.phase = Phase.ROUND_RESULT
        if not correct:
            self.winner_id = None
            return None
        correct.sort(key=lambda item: item[1])
        winner_id = correct[0][0]
        self.winner_id = winner_id
        if winner_id in self.guests:
            self.guests[winner_id].score += 1
        return winner_id

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

    def start_game(self) -> bool:
        if self.game_started:
            return False
        self.game_started = True
        return True

    def reset(self):
        self.game_started = False
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
        self.duel_answers = {}
        self.duel_winner = None
        self.duel_awaiting_confirm = False
        self.penance_used = 0
        self.used_penance_indices = set()
        self.pending_penance_heal = None

    # ---- duel (scontro diretto) ----

    def start_duel(self) -> bool:
        if self.phase != Phase.ROUND_RESULT or not self.winner_id:
            return False
        self.challenger_id = self.winner_id
        self.duel_answers = {}
        self.duel_winner = None
        self.phase = Phase.DUEL_WHEEL
        return True

    def cancel_duel(self) -> bool:
        if self.phase not in (Phase.DUEL_WHEEL, Phase.DUEL_CHALLENGE):
            return False
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None
        self.duel_answers = {}
        self.duel_winner = None
        self.duel_awaiting_confirm = False
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
        self.duel_answers = {}
        self.duel_winner = None
        self.duel_awaiting_confirm = True
        return category

    def confirm_duel_send(self) -> bool:
        """La regia conferma l'invio della sfida a tutti dopo lo spin della ruota."""
        if not self.duel_awaiting_confirm:
            return False
        self.duel_awaiting_confirm = False
        return True

    def open_duel_challenge(self):
        self.phase = Phase.DUEL_CHALLENGE

    def _record_duel_stats(self, challenger_won: bool):
        """Aggiorna vittorie/sconfitte del solo sfidante (per i premi personalizzati finali):
        la festeggiata non ha una classifica, e' sempre lei contro tutti."""
        if self.challenger_id and self.challenger_id in self.guests:
            guest = self.guests[self.challenger_id]
            if challenger_won:
                guest.duels_won += 1
            else:
                guest.duels_lost += 1

    def submit_duel_answer(self, responder_id: str, choice: int) -> Optional[bool]:
        """Sia l'ospite sfidante che la festeggiata rispondono alla stessa sfida:
        chi risponde correttamente per primo vince (se sbagliano entrambi, nessun danno)."""
        if self.phase != Phase.DUEL_CHALLENGE:
            return None
        if responder_id not in (self.challenger_id, BOSS_ID):
            return None
        if responder_id in self.duel_answers:
            return None
        self.duel_answers[responder_id] = {"choice": choice, "at": time.time()}
        correct = choice == self.duel_challenge["answer"]
        if correct and self.duel_winner is None:
            self.duel_winner = responder_id
            self.phase = Phase.DUEL_RESULT
            if responder_id == self.challenger_id:
                self.damage_boss(DUEL_DAMAGE)
                if responder_id in self.guests:
                    self.guests[responder_id].score += DUEL_WIN_BONUS_SCORE
                self._record_duel_stats(True)
            else:
                self._record_duel_stats(False)
        elif len(self.duel_answers) >= 2:
            self.phase = Phase.DUEL_RESULT
            self._record_duel_stats(False)
        return correct

    def duel_resolved(self) -> bool:
        # damage_boss() puo' sovrascrivere la fase con GAME_OVER se il colpo e' quello
        # decisivo: il duello resta comunque risolto, va solo trasmesso il risultato.
        return self.phase in (Phase.DUEL_RESULT, Phase.GAME_OVER)

    def resolve_duel_timeout(self) -> bool:
        if self.phase != Phase.DUEL_CHALLENGE:
            return False
        self.phase = Phase.DUEL_RESULT
        self._record_duel_stats(False)
        return True

    def public_duel_result(self, timeout: bool = False) -> dict:
        c = self.duel_challenge
        if timeout:
            outcome = "timeout"
        elif self.duel_winner is None:
            outcome = "draw"
        elif self.duel_winner == self.challenger_id:
            outcome = "challenger"
        else:
            outcome = "boss"
        winner_name = None
        if outcome == "challenger" and self.challenger_id in self.guests:
            winner_name = self.guests[self.challenger_id].name
        elif outcome == "boss":
            winner_name = "La Laureata"
        return {
            "outcome": outcome,
            "winner_name": winner_name,
            "correct_option": c["answer"],
            "damage": DUEL_DAMAGE if outcome == "challenger" else 0,
            "boss_choice": self.duel_answers.get(BOSS_ID, {}).get("choice"),
            "challenger_choice": self.duel_answers.get(self.challenger_id, {}).get("choice") if self.challenger_id else None,
        }

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

    # ---- ruota delle penitenze (il boss guadagna HP) ----

    def set_penance_limit(self, limit: int) -> bool:
        if limit < 0:
            return False
        self.penance_limit = limit
        return True

    def penance_remaining(self) -> int:
        return max(0, self.penance_limit - self.penance_used)

    def can_spin_penance(self) -> bool:
        if self.phase in (Phase.DUEL_WHEEL, Phase.DUEL_CHALLENGE, Phase.GAME_OVER):
            return False
        if self.pending_penance_heal is not None:
            return False
        return self.penance_remaining() > 0 and len(self.penances) > 0

    def heal_boss(self, amount: int):
        self.hp = min(self.max_hp, self.hp + amount)

    def spin_penance_wheel(self) -> Optional[dict]:
        if not self.can_spin_penance():
            return None
        pool = [i for i in range(len(self.penances)) if i not in self.used_penance_indices]
        if not pool:
            pool = list(range(len(self.penances)))
            self.used_penance_indices = set()
        index = random.choice(pool)
        self.used_penance_indices.add(index)
        self.penance_used += 1
        self.pending_penance_heal = PENANCE_HEAL
        return {
            "index": index,
            "text": self.penances[index],
            "heal": PENANCE_HEAL,
            "remaining": self.penance_remaining(),
        }

    def confirm_penance(self) -> Optional[int]:
        """La regia confirma che la festeggiata ha davvero fatto la penitenza: applica l'HP."""
        if self.pending_penance_heal is None:
            return None
        amount = self.pending_penance_heal
        self.pending_penance_heal = None
        self.heal_boss(amount)
        return amount

    def decline_penance(self) -> bool:
        """La regia segnala che la penitenza non e' stata fatta: nessun HP."""
        if self.pending_penance_heal is None:
            return False
        self.pending_penance_heal = None
        return True

    # ---- premi personalizzati del gran finale ----

    def compute_awards(self) -> list[dict]:
        guests = list(self.guests.values())
        awards = []

        speedy = [g for g in guests if g.fastest_correct_seconds is not None]
        if speedy:
            best = min(speedy, key=lambda g: g.fastest_correct_seconds)
            awards.append({
                "emoji": "⚡",
                "title": "Il più veloce della festa",
                "name": best.name,
                "detail": f"{best.fastest_correct_seconds:.1f}s per rispondere",
            })

        precise = [g for g in guests if g.correct_answers > 0]
        if precise:
            best = max(precise, key=lambda g: g.correct_answers)
            awards.append({
                "emoji": "🎯",
                "title": "Il più preciso",
                "name": best.name,
                "detail": f"{best.correct_answers} risposte indovinate",
            })

        champions = [g for g in guests if g.duels_won > 0]
        if champions:
            best = max(champions, key=lambda g: g.duels_won)
            awards.append({
                "emoji": "⚔️",
                "title": "Il campione dei duelli",
                "name": best.name,
                "detail": f"{best.duels_won} duelli vinti",
            })

        unlucky = [g for g in guests if g.duels_lost > 0]
        if unlucky:
            worst = max(unlucky, key=lambda g: g.duels_lost)
            awards.append({
                "emoji": "😅",
                "title": "Il più sfortunato negli scontri",
                "name": worst.name,
                "detail": f"{worst.duels_lost} duelli persi",
            })

        combative = [g for g in guests if (g.duels_won + g.duels_lost) > 0]
        if combative:
            best = max(combative, key=lambda g: g.duels_won + g.duels_lost)
            awards.append({
                "emoji": "🔥",
                "title": "Il più combattivo",
                "name": best.name,
                "detail": f"{best.duels_won + best.duels_lost} duelli affrontati",
            })

        return awards

    def public_state(self) -> dict:
        q = self.current_question
        winner_name = None
        if self.winner_id and self.winner_id in self.guests:
            winner_name = self.guests[self.winner_id].name
        challenger_name = None
        if self.challenger_id and self.challenger_id in self.guests:
            challenger_name = self.guests[self.challenger_id].name
        return {
            "started": self.game_started,
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
            "penance_limit": self.penance_limit,
            "penance_used": self.penance_used,
            "penance_remaining": self.penance_remaining(),
            "penance_count": len(self.penances),
            "penance_pending": self.pending_penance_heal is not None,
        }
