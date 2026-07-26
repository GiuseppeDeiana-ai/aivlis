import json
import random
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

DUEL_CATEGORIES = ["musica", "film", "videogioco", "data", "cultura_generale"]
DUEL_DAMAGE = 25
DUEL_WIN_BONUS_SCORE = 1
JOLLY_BONUS_SCORE = 1  # punto extra (oltre al normale +1) se si vince il duello col jolly attivo
BOSS_ID = "boss"
PENANCE_HEAL = 10
DEFAULT_PENANCE_LIMIT = 3
MAX_AVATAR_LENGTH = 400_000  # ~300KB decoded: sufficiente per una foto 200x200 compressa
MAX_CHAT_LENGTH = 140
CHAT_COOLDOWN_SECONDS = 2.0
MAX_CHAT_HISTORY = 30
PHASE_1_MAX_HP = 150
PHASE_2_MAX_HP = 150  # seconda barra vita tutta nuova quando la prima si esaurisce (stile boss a fasi)


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
    avatar: Optional[str] = None
    last_answered_round: int = -1
    answer_streak: int = 0
    max_answer_streak: int = 0
    total_answers: int = 0
    last_chat_at: Optional[float] = None
    chat_message_count: int = 0
    jolly_used: bool = False


class GameState:
    def __init__(self, questions_path: Path, duels_path: Path, penances_path: Path, max_hp: int = PHASE_1_MAX_HP):
        self.questions = json.loads(Path(questions_path).read_text(encoding="utf-8"))
        self.duels: dict[str, list[dict]] = json.loads(Path(duels_path).read_text(encoding="utf-8"))
        self.penances: list[str] = json.loads(Path(penances_path).read_text(encoding="utf-8"))
        self.game_started = False
        self.round_index = -1
        self.used_question_indices: set[int] = set()
        self.current_question_index: Optional[int] = None
        self.first_duel_win_announced: bool = False
        self.phase = Phase.LOBBY
        self.boss_answer: Optional[int] = None
        self.round_open_at: Optional[float] = None
        self.guest_answers: dict[str, dict] = {}
        self.winner_id: Optional[str] = None
        self.guests: dict[str, Guest] = {}
        self._phase1_max_hp = max_hp
        self.max_hp = max_hp
        self.hp = max_hp
        self.boss_phase: int = 1
        self.phase2_just_started: bool = False
        self.chat_messages: list[dict] = []

        self.used_challenge_ids: set[str] = set()
        self.used_duel_categories: set[str] = set()
        self.active_duel_categories: list[str] = list(DUEL_CATEGORIES)
        self.jolly_active: bool = False
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
        if self.current_question_index is not None:
            return self.questions[self.current_question_index]
        return None


    def start_round(self) -> bool:
        """Le domande classiche sono pescate a caso senza ripetizioni finche' non sono
        state usate tutte; a quel punto il mazzo si rimescola e si continua all'infinito -
        cosi' la partita non finisce mai per "esaurimento domande", solo per HP a zero.
        Consentito solo tra un round e il successivo: un doppio click accidentale della
        regia durante un round o un duello in corso non deve poterlo interrompere/corrompere."""
        if not self.questions:
            return False
        if self.phase not in (Phase.LOBBY, Phase.ROUND_RESULT, Phase.DUEL_RESULT):
            return False
        if len(self.used_question_indices) >= len(self.questions):
            self.used_question_indices = set()
        pool = [i for i in range(len(self.questions)) if i not in self.used_question_indices]
        self.current_question_index = random.choice(pool)
        self.used_question_indices.add(self.current_question_index)
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
        if guest_id in self.guests:
            guest = self.guests[guest_id]
            guest.total_answers += 1
            if guest.last_answered_round == self.round_index - 1:
                guest.answer_streak += 1
            else:
                guest.answer_streak = 1
            guest.last_answered_round = self.round_index
            if guest.answer_streak > guest.max_answer_streak:
                guest.max_answer_streak = guest.answer_streak
            if is_correct:
                guest.correct_answers += 1
                if self.round_open_at is not None:
                    elapsed = at - self.round_open_at
                    if guest.fastest_correct_seconds is None or elapsed < guest.fastest_correct_seconds:
                        guest.fastest_correct_seconds = elapsed
        return is_correct

    def add_chat_message(self, guest_id: str, text: str) -> Optional[dict]:
        if guest_id not in self.guests:
            return None
        text = text.strip()[:MAX_CHAT_LENGTH]
        if not text:
            return None
        guest = self.guests[guest_id]
        now = time.time()
        if guest.last_chat_at is not None and now - guest.last_chat_at < CHAT_COOLDOWN_SECONDS:
            return None
        guest.last_chat_at = now
        guest.chat_message_count += 1
        message = {
            "id": guest_id,
            "name": guest.name,
            "avatar": guest.avatar,
            "text": text,
            "ts": now,
        }
        self.chat_messages.append(message)
        if len(self.chat_messages) > MAX_CHAT_HISTORY:
            self.chat_messages = self.chat_messages[-MAX_CHAT_HISTORY:]
        return message

    def clear_chat(self):
        self.chat_messages = []

    def set_avatar(self, guest_id: str, avatar_data_url: str) -> bool:
        if guest_id not in self.guests:
            return False
        if not avatar_data_url or not avatar_data_url.startswith("data:image/"):
            return False
        if len(avatar_data_url) > MAX_AVATAR_LENGTH:
            return False
        self.guests[guest_id].avatar = avatar_data_url
        return True

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
        """Se la fase 1 si esaurisce, la festeggiata non e' sconfitta: entra in una seconda
        fase con una barra vita tutta nuova (come i boss a piu' fasi dei giochi action) - la
        vera sconfitta arriva solo esaurendo anche la fase 2."""
        self.hp = max(0, self.hp - amount)
        if self.hp > 0:
            return
        if self.boss_phase == 1:
            self.boss_phase = 2
            self.max_hp = PHASE_2_MAX_HP
            self.hp = PHASE_2_MAX_HP
            self.phase2_just_started = True
        else:
            self.phase = Phase.GAME_OVER

    def start_game(self) -> bool:
        if self.game_started:
            return False
        self.game_started = True
        return True

    def reset(self):
        self.game_started = False
        self.round_index = -1
        self.used_question_indices = set()
        self.current_question_index = None
        self.first_duel_win_announced = False
        self.phase = Phase.LOBBY
        self.boss_answer = None
        self.guest_answers = {}
        self.winner_id = None
        self.boss_phase = 1
        self.max_hp = self._phase1_max_hp
        self.hp = self.max_hp
        self.phase2_just_started = False
        self.used_challenge_ids = set()
        self.used_duel_categories = set()
        self.active_duel_categories = list(DUEL_CATEGORIES)
        self.jolly_active = False
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None
        self.duel_answers = {}
        self.duel_winner = None
        self.duel_awaiting_confirm = False
        self.penance_used = 0
        self.used_penance_indices = set()
        self.pending_penance_heal = None
        self.chat_messages = []

    def hard_reset(self):
        """Restart totale: come reset(), ma azzera anche tutti gli invitati registrati
        (nomi, punteggi, avatar, streak) - usato per buttare fuori chi si e' collegato
        per una falsa partenza prima dell'inizio vero della festa."""
        self.reset()
        self.guests = {}

    # ---- duel (scontro diretto) ----

    def start_duel(self) -> bool:
        if self.phase != Phase.ROUND_RESULT or not self.winner_id:
            return False
        if not self.active_duel_categories:
            return False
        self.challenger_id = self.winner_id
        self.duel_answers = {}
        self.duel_winner = None
        self.jolly_active = False
        self.phase = Phase.DUEL_WHEEL
        return True

    def activate_jolly(self, guest_id: str) -> bool:
        """Lo sfidante puo' giocare il suo UNICO jolly a partita prima che la ruota riveli
        la categoria: se poi vince il duello, il danno raddoppia. Si consuma comunque, anche
        se poi perde - e' un azzardo, non un'assicurazione."""
        if self.phase != Phase.DUEL_WHEEL or guest_id != self.challenger_id:
            return False
        guest = self.guests.get(guest_id)
        if guest is None or guest.jolly_used:
            return False
        guest.jolly_used = True
        self.jolly_active = True
        return True

    def cancel_duel(self) -> bool:
        if self.phase not in (Phase.DUEL_WHEEL, Phase.DUEL_CHALLENGE):
            return False
        if self.jolly_active and self.challenger_id in self.guests:
            # il duello non e' avvenuto per una scelta della regia, non per colpa dello
            # sfidante: il suo unico jolly gli torna disponibile.
            self.guests[self.challenger_id].jolly_used = False
        self.jolly_active = False
        self.challenger_id = None
        self.duel_category = None
        self.duel_challenge = None
        self.duel_answers = {}
        self.duel_winner = None
        self.duel_awaiting_confirm = False
        self.phase = Phase.ROUND_RESULT
        return True

    def _category_exhausted(self, category: str) -> bool:
        ids = {c["id"] for c in self.duels.get(category, [])}
        return bool(ids) and ids <= self.used_challenge_ids

    def _pick_challenge(self, category: str) -> dict:
        """Non ricicla piu' le sfide gia' usate: una volta che una categoria e' esaurita
        viene ritirata dalla ruota (vedi spin_wheel), quindi qui c'e' sempre almeno una
        sfida ancora inedita da pescare."""
        pool = [c for c in self.duels.get(category, []) if c["id"] not in self.used_challenge_ids]
        challenge = random.choice(pool)
        self.used_challenge_ids.add(challenge["id"])
        return challenge

    def spin_wheel(self) -> Optional[str]:
        """Le categorie escono a caso ma senza ripetizioni finche' non sono uscite tutte
        quelle ancora attive (se esce "videogioco" non puo' riuscire di nuovo finche' non
        sono uscite anche tutte le altre, poi il giro si rimescola). Una categoria che
        esaurisce l'intero set di sfide viene ritirata definitivamente dalla ruota, per non
        rischiare di ripetere la stessa sfida due volte in una serata."""
        if self.phase != Phase.DUEL_WHEEL or not self.active_duel_categories:
            return None
        if len(self.used_duel_categories) >= len(self.active_duel_categories):
            self.used_duel_categories = set()
        pool = [c for c in self.active_duel_categories if c not in self.used_duel_categories]
        category = random.choice(pool)
        self.used_duel_categories.add(category)
        self.duel_category = category
        self.duel_challenge = self._pick_challenge(category)
        if self._category_exhausted(category):
            self.active_duel_categories.remove(category)
            self.used_duel_categories.discard(category)
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
                    bonus = DUEL_WIN_BONUS_SCORE + (JOLLY_BONUS_SCORE if self.jolly_active else 0)
                    self.guests[responder_id].score += bonus
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
            "jolly_active": self.jolly_active,
            "jolly_bonus_score": JOLLY_BONUS_SCORE if (outcome == "challenger" and self.jolly_active) else 0,
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
            "challenger_avatar": self.guests[self.challenger_id].avatar if self.challenger_id in self.guests else None,
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

        participative = [g for g in guests if g.total_answers > 0]
        if participative:
            best = max(participative, key=lambda g: g.total_answers)
            awards.append({
                "emoji": "🎲",
                "title": "Il più partecipativo",
                "name": best.name,
                "detail": f"ha risposto a {best.total_answers} domande",
            })

        streakers = [g for g in guests if g.max_answer_streak > 0]
        if streakers:
            best = max(streakers, key=lambda g: g.max_answer_streak)
            awards.append({
                "emoji": "📈",
                "title": "Record di serie",
                "name": best.name,
                "detail": f"{best.max_answer_streak} domande di fila senza saltarne una",
            })

        calm = [g for g in guests if g.fastest_correct_seconds is not None]
        if calm:
            worst = max(calm, key=lambda g: g.fastest_correct_seconds)
            awards.append({
                "emoji": "🐢",
                "title": "Il più tranquillo",
                "name": worst.name,
                "detail": f"si e' preso {worst.fastest_correct_seconds:.1f}s, ma e' arrivato",
            })

        participants_with_score = [g for g in guests if g.total_answers > 0]
        if participants_with_score:
            worst = min(participants_with_score, key=lambda g: g.score)
            awards.append({
                "emoji": "🥄",
                "title": "Il cucchiaio di legno",
                "name": worst.name,
                "detail": f"solo {worst.score} punti, ma tanto cuore",
            })

        chatty = [g for g in guests if g.chat_message_count > 0]
        if chatty:
            best = max(chatty, key=lambda g: g.chat_message_count)
            awards.append({
                "emoji": "💬",
                "title": "Il più chiacchierone",
                "name": best.name,
                "detail": f"{best.chat_message_count} messaggi scritti in chat",
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
            "boss_phase": self.boss_phase,
            "winner": winner_name,
            "answers_count": len(self.guest_answers),
            "guests_online": sum(1 for g in self.guests.values() if g.connected),
            "leaderboard": sorted(
                ({"id": g.id, "name": g.name, "score": g.score, "avatar": g.avatar} for g in self.guests.values()),
                key=lambda x: -x["score"],
            )[:10],
            "challenger_name": challenger_name,
            "duel_category": self.duel_category,
            "active_duel_categories": self.active_duel_categories,
            "penance_limit": self.penance_limit,
            "penance_used": self.penance_used,
            "penance_remaining": self.penance_remaining(),
            "penance_count": len(self.penances),
            "penance_pending": self.pending_penance_heal is not None,
        }
