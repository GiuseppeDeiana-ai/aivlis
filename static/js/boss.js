const keyScreen = document.getElementById('keyScreen');
const gameScreen = document.getElementById('gameScreen');
const keyInput = document.getElementById('keyInput');
const enterBtn = document.getElementById('enterBtn');
const statusLine = document.getElementById('statusLine');
const lobbyCard = document.getElementById('lobbyCard');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsBox = document.getElementById('optionsBox');
const hpBar = document.getElementById('hpBar');
const hpBarWrap = document.getElementById('hpBarWrap');
const hpLabel = document.getElementById('hpLabel');
const bossPortrait = document.getElementById('bossPortrait');
const bossPortraitImg = document.getElementById('bossPortraitImg');

startPortraitRotation(bossPortraitImg);

initWelcomeScreen({
    welcomeEl: document.getElementById('welcomeScreen'),
    enterBtnEl: document.getElementById('welcomeEnterBtn'),
    ambientEl: document.getElementById('welcomeAmbient'),
    portraitImgEl: document.getElementById('welcomePortraitImg'),
});

const duelScreen = document.getElementById('duelScreen');
const duelChallengerLine = document.getElementById('duelChallengerLine');
const wheelCard = document.getElementById('wheelCard');
const wheelWrap = document.getElementById('wheelWrap');
const spinBtn = document.getElementById('spinBtn');
const duelChallengeCard = document.getElementById('duelChallengeCard');
const duelCategoryTitle = document.getElementById('duelCategoryTitle');
const duelMedia = document.getElementById('duelMedia');
const duelOptionsBox = document.getElementById('duelOptionsBox');
const duelSpectatorNote = document.getElementById('duelSpectatorNote');
const duelResultCard = document.getElementById('duelResultCard');
const duelResultBanner = document.getElementById('duelResultBanner');
const duelTimerBar = document.getElementById('duelTimerBar');
const wheelStatusText = document.getElementById('wheelStatusText');
const roundTimerBar = document.getElementById('roundTimerBar');

const DUEL_TIMEOUT_SECONDS_JS = 20; // deve corrispondere a DUEL_TIMEOUT_SECONDS in main.py
const ROUND_REVEAL_SECONDS_JS = 20; // deve corrispondere a ROUND_REVEAL_SECONDS in main.py

const penanceCard = document.getElementById('penanceCard');
const penanceWheelWrap = document.getElementById('penanceWheelWrap');
const penanceRevealCard = document.getElementById('penanceRevealCard');
const penanceRevealText = document.getElementById('penanceRevealText');
const penanceRevealHeal = document.getElementById('penanceRevealHeal');
const penanceSpinBtn = document.getElementById('penanceSpinBtn');
const penanceStatusLine = document.getElementById('penanceStatusLine');

const PING_INTERVAL_MS = 20000; // deve corrispondere a PING_INTERVAL_SECONDS in main.py

let ws = null;
let pingInterval = null;
let posterReveal = null;
let hasAnswered = false;
let hasAnsweredDuel = false;
let penanceSpinning = false;
let lastPenanceCount = 0;
let gameOverShown = false;

function connect(key) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/boss?key=${encodeURIComponent(key)}`);

    ws.onopen = () => {
        localStorage.setItem('boss_key', key);
        keyScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, PING_INTERVAL_MS);
    };

    ws.onclose = () => {
        clearInterval(pingInterval);
        keyScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        statusLine.textContent = 'Codice errato o connessione chiusa.';
    };

    ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
}

function hideDuelScreen() {
    duelScreen.style.display = 'none';
    wheelCard.style.display = 'none';
    duelChallengeCard.style.display = 'none';
    duelResultCard.style.display = 'none';
}

function handleMessage(msg) {
    if (msg.type === 'ping') {
        // keepalive, nessuna azione necessaria
    } else if (msg.type === 'round_countdown') {
        statusLine.textContent = 'Il conto alla rovescia e iniziato per gli invitati...';
        fxCountdown(msg.payload.seconds);
        setTimeout(() => {
            statusLine.textContent = 'Gli invitati hanno 20 secondi per rispondere...';
            startCountdownBar(roundTimerBar, ROUND_REVEAL_SECONDS_JS);
        }, msg.payload.seconds * 1000);
    } else if (msg.type === 'winner') {
        stopCountdownBar(roundTimerBar);
        if (msg.payload.name) {
            statusLine.textContent = `${msg.payload.name} ha indovinato per primo! Preparati allo scontro diretto!`;
            fxFire();
            fxConfetti(40);
        } else {
            statusLine.textContent = 'Nessuno ha indovinato questa volta! Prepara la prossima domanda.';
        }
    } else if (msg.type === 'round_started') {
        hasAnswered = false;
        hideDuelScreen();
        stopCountdownBar(roundTimerBar);
        penanceCard.style.display = 'block';
        statusLine.textContent = `Domanda ${msg.payload.round}/${msg.payload.total} - rispondi tu per prima!`;
        questionText.textContent = msg.payload.text;
        optionsBox.innerHTML = '';
        msg.payload.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option';
            btn.textContent = opt;
            btn.onclick = () => submitAnswer(idx);
            optionsBox.appendChild(btn);
        });
        questionCard.style.display = 'block';
    } else if (msg.type === 'duel_start') {
        fxSkull();
        questionCard.style.display = 'none';
        penanceCard.style.display = 'none';
        duelScreen.style.display = 'block';
        duelChallengeCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengerLine.textContent = `Scontro Diretto contro ${msg.payload.challenger_name}!`;
        wheelCard.style.display = 'block';
        wheelStatusText.textContent = '';
        buildWheel(wheelWrap);
        spinBtn.disabled = false;
        statusLine.textContent = 'Gira la ruota per scegliere la categoria!';
    } else if (msg.type === 'wheel_result') {
        spinBtn.disabled = true;
        spinWheelTo(wheelWrap, msg.payload.category);
        setTimeout(() => {
            wheelStatusText.textContent = 'Ruota fermata! In attesa che la regia invii la sfida a tutti...';
        }, WHEEL_SPIN_SECONDS_JS * 1000);
    } else if (msg.type === 'duel_countdown') {
        wheelStatusText.textContent = 'La sfida si apre a momenti!';
        fxCountdown(msg.payload.seconds);
    } else if (msg.type === 'duel_challenge') {
        wheelCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengeCard.style.display = 'block';
        hasAnsweredDuel = false;
        duelCategoryTitle.textContent = `Indovina la ${categoryLabel(msg.payload.category).toLowerCase()}`;
        fxThemeParticles(msg.payload.category);
        startCountdownBar(duelTimerBar, DUEL_TIMEOUT_SECONDS_JS);
        if (posterReveal) {
            posterReveal.cancel();
            posterReveal = null;
        }
        duelMedia.innerHTML = '';
        if (msg.payload.category === 'musica') {
            duelMedia.appendChild(buildEqualizer());
            const note = document.createElement('div');
            note.className = 'status';
            note.textContent = '🎵 Ascolta dalle casse della regia...';
            duelMedia.appendChild(note);
        } else if ((msg.payload.category === 'film' || msg.payload.category === 'videogioco') && msg.payload.media) {
            const canvas = document.createElement('canvas');
            canvas.width = msg.payload.category === 'film' ? 300 : 400;
            canvas.height = msg.payload.category === 'film' ? 450 : 300;
            canvas.className = 'poster-reveal';
            duelMedia.appendChild(canvas);
            const imgUrl = `/static/media/${msg.payload.category}/${encodeURIComponent(msg.payload.media)}`;
            posterReveal = startPosterReveal(canvas, imgUrl);
        } else if (msg.payload.media) {
            const img = document.createElement('img');
            img.src = `/static/media/${msg.payload.category}/${encodeURIComponent(msg.payload.media)}`;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '10px';
            duelMedia.appendChild(img);
        } else if (msg.payload.prompt) {
            const div = document.createElement('div');
            div.className = msg.payload.category === 'data' ? 'status data-parchment' : 'status';
            div.style.fontSize = '2rem';
            div.style.fontWeight = 'bold';
            div.textContent = msg.payload.prompt;
            duelMedia.appendChild(div);
        }
        duelOptionsBox.innerHTML = '';
        msg.payload.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option';
            btn.textContent = opt;
            btn.onclick = () => submitDuelAnswer(idx);
            duelOptionsBox.appendChild(btn);
        });
        duelSpectatorNote.textContent = `Rispondi tu contro ${msg.payload.challenger_name}! Chi risponde correttamente prima vince!`;
    } else if (msg.type === 'duel_answer_registered') {
        if (msg.payload.by === 'challenger') {
            duelSpectatorNote.textContent = 'Lo sfidante ha risposto! Sbrigati!';
        }
    } else if (msg.type === 'duel_result') {
        stopCountdownBar(duelTimerBar);
        if (posterReveal) posterReveal.finish();
        duelResultCard.style.display = 'block';
        Array.from(duelOptionsBox.children).forEach((b, idx) => {
            b.disabled = true;
            if (idx === msg.payload.correct_option) b.style.outline = '3px solid #00e676';
        });
        duelResultBanner.className = 'winner-banner';
        if (msg.payload.outcome === 'boss') {
            duelResultBanner.style.background = '';
            duelResultBanner.textContent = 'Hai risposto prima tu! Nessun danno!';
            fxFire();
            fxConfetti(50);
            fxPhotoFlash('win', 'Hai vinto lo scontro!');
            fxVibrate([100, 50, 100]);
        } else if (msg.payload.outcome === 'challenger') {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = `${msg.payload.winner_name} e' stato piu' veloce! Hai subito ${msg.payload.damage} danni!`;
            pulseShake(bossPortrait);
            pulseHpFlash(hpBar, hpBarWrap, 'damage');
            fxScreenShake();
            fxVoid();
            fxPhotoFlash('lose', 'Hai perso lo scontro!');
            fxVibrate(200);
        } else if (msg.payload.outcome === 'timeout') {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Tempo scaduto per entrambi, sei salva!';
            fxVoid();
            fxVibrate(200);
        } else {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Nessuno ha risposto correttamente, sei salva!';
            fxVoid();
            fxVibrate(200);
        }
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
        penanceCard.style.display = 'block';
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
        statusLine.textContent = 'Scontro diretto annullato dalla regia.';
    } else if (msg.type === 'return_home') {
        hideDuelScreen();
        penanceCard.style.display = 'block';
        statusLine.textContent = 'Scontro terminato! Gira la ruota delle penitenze o aspetta la prossima domanda dalla regia.';
    } else if (msg.type === 'penance_spin') {
        penanceSpinning = true;
        penanceSpinBtn.disabled = true;
        penanceRevealCard.style.display = 'none';
        penanceWheelWrap.style.display = 'block';
        lastPenanceCount = msg.payload.count;
        buildPenanceWheel(penanceWheelWrap, msg.payload.count);
        spinPenanceWheelTo(penanceWheelWrap, msg.payload.count, msg.payload.index);
        penanceStatusLine.textContent = 'La ruota gira...';
    } else if (msg.type === 'penance_result') {
        penanceSpinning = false;
        penanceWheelWrap.style.display = 'none';
        penanceRevealCard.style.display = 'block';
        penanceRevealText.textContent = msg.payload.text;
        penanceRevealHeal.textContent = `Falla davvero! In attesa di conferma dalla regia (+${msg.payload.heal} HP)...`;
    } else if (msg.type === 'penance_confirmed') {
        penanceRevealHeal.textContent = `✅ Confermata! +${msg.payload.heal} HP!`;
        pulseHeal(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'heal');
    } else if (msg.type === 'penance_declined') {
        penanceRevealHeal.textContent = '❌ La regia non ha confermato: nessun HP guadagnato.';
    } else if (msg.type === 'penance_denied') {
        penanceStatusLine.textContent = msg.payload.remaining <= 0
            ? 'Hai finito le penitenze disponibili.'
            : 'Non puoi girare la ruota delle penitenze in questo momento.';
    } else if (msg.type === 'state') {
        const pct = Math.max(0, Math.min(100, (msg.payload.hp / msg.payload.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${msg.payload.hp}/${msg.payload.max_hp}`;
        lobbyCard.style.display = msg.payload.phase === 'lobby' ? 'block' : 'none';
        document.body.classList.toggle('enrage-mode', msg.payload.hp > 0 && pct < 25);
        lastPenanceCount = msg.payload.penance_count;
        const canSpinPenance = !penanceSpinning
            && !msg.payload.penance_pending
            && msg.payload.penance_remaining > 0
            && !['duel_wheel', 'duel_challenge', 'game_over'].includes(msg.payload.phase);
        penanceSpinBtn.disabled = !canSpinPenance;
        penanceSpinBtn.textContent = msg.payload.penance_pending
            ? 'In attesa di conferma dalla regia...'
            : `Gira la ruota delle penitenze (rimaste: ${msg.payload.penance_remaining})`;
        if (msg.payload.phase === 'game_over') {
            statusLine.textContent = 'Sei stata sconfitta! Complimenti alla laurea!';
            questionCard.style.display = 'none';
            hideDuelScreen();
            if (!gameOverShown) {
                gameOverShown = true;
                fxGrandFinale({});
            }
        }
    } else if (msg.type === 'boss_hit') {
        statusLine.textContent = `Hai subito ${msg.payload.amount} danni!`;
        pulseShake(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'damage');
    } else if (msg.type === 'reveal_leaderboard') {
        fxRevealLeaderboard(msg.payload.leaderboard, msg.payload.awards);
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        hideDuelScreen();
        penanceCard.style.display = 'block';
        penanceRevealCard.style.display = 'none';
        penanceWheelWrap.style.display = 'none';
        stopCountdownBar(duelTimerBar);
        stopCountdownBar(roundTimerBar);
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
        gameOverShown = false;
        document.body.classList.remove('enrage-mode');
        const finaleEl = document.getElementById('fxFinaleOverlay');
        if (finaleEl) finaleEl.remove();
        const leaderboardEl = document.getElementById('fxLeaderboardOverlay');
        if (leaderboardEl) leaderboardEl.remove();
        statusLine.textContent = 'Il gioco e stato resettato.';
    }
}

function submitAnswer(idx) {
    if (hasAnswered) return;
    hasAnswered = true;
    Array.from(optionsBox.children).forEach(b => b.disabled = true);
    ws.send(JSON.stringify({ type: 'answer', choice: idx }));
    statusLine.textContent = 'Risposta inviata! Ora gli invitati possono rispondere.';
}

function submitDuelAnswer(idx) {
    if (hasAnsweredDuel) return;
    hasAnsweredDuel = true;
    Array.from(duelOptionsBox.children).forEach(b => b.disabled = true);
    ws.send(JSON.stringify({ type: 'duel_answer', choice: idx }));
    duelSpectatorNote.textContent = 'Risposta inviata! Aspettiamo l\'esito...';
}

spinBtn.onclick = () => {
    spinBtn.disabled = true;
    ws.send(JSON.stringify({ type: 'spin_wheel' }));
};

penanceSpinBtn.onclick = () => {
    penanceSpinBtn.disabled = true;
    ws.send(JSON.stringify({ type: 'spin_penance' }));
};

enterBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) return;
    connect(key);
};

const savedKey = localStorage.getItem('boss_key');
if (savedKey) {
    keyInput.value = savedKey;
}
