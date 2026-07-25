const joinScreen = document.getElementById('joinScreen');
const gameScreen = document.getElementById('gameScreen');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const statusLine = document.getElementById('statusLine');
const lobbyCard = document.getElementById('lobbyCard');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsBox = document.getElementById('optionsBox');
const winnerBanner = document.getElementById('winnerBanner');
const hpBar = document.getElementById('hpBar');
const hpBarWrap = document.getElementById('hpBarWrap');
const hpLabel = document.getElementById('hpLabel');
const leaderboard = document.getElementById('leaderboard');
const bossPortrait = document.getElementById('bossPortrait');
const bossPortraitImg = document.getElementById('bossPortraitImg');

startPortraitRotation(bossPortraitImg);

const duelScreen = document.getElementById('duelScreen');
const duelChallengerLine = document.getElementById('duelChallengerLine');
const wheelCard = document.getElementById('wheelCard');
const wheelWrap = document.getElementById('wheelWrap');
const duelChallengeCard = document.getElementById('duelChallengeCard');
const duelCategoryTitle = document.getElementById('duelCategoryTitle');
const duelMedia = document.getElementById('duelMedia');
const duelOptionsBox = document.getElementById('duelOptionsBox');
const duelSpectatorNote = document.getElementById('duelSpectatorNote');
const duelResultCard = document.getElementById('duelResultCard');
const duelResultBanner = document.getElementById('duelResultBanner');
const duelTimerBar = document.getElementById('duelTimerBar');
const wheelStatusText = document.getElementById('wheelStatusText');

const DUEL_TIMEOUT_SECONDS_JS = 20; // deve corrispondere a DUEL_TIMEOUT_SECONDS in main.py

const penanceScreen = document.getElementById('penanceScreen');
const penanceWheelWrap = document.getElementById('penanceWheelWrap');
const penanceRevealBox = document.getElementById('penanceRevealBox');
const penanceRevealText = document.getElementById('penanceRevealText');
const penanceRevealHeal = document.getElementById('penanceRevealHeal');

const PING_INTERVAL_MS = 20000; // deve corrispondere a PING_INTERVAL_SECONDS in main.py

let ws = null;
let pingInterval = null;
let posterReveal = null;
let hasAnsweredThisRound = false;
let hasAnsweredDuel = false;
let gameOverShown = false;

function getGuestId() {
    let id = localStorage.getItem('guest_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('guest_id', id);
    }
    return id;
}

function connect(name) {
    const id = getGuestId();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/guest?name=${encodeURIComponent(name)}&id=${id}`);

    ws.onopen = () => {
        joinScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onclose = () => {
        clearInterval(pingInterval);
        statusLine.textContent = 'Connessione persa, ricarica la pagina...';
    };
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
    } else if (msg.type === 'welcome') {
        localStorage.setItem('guest_name', msg.payload.name);
    } else if (msg.type === 'wait_boss') {
        hasAnsweredThisRound = false;
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        statusLine.textContent = 'La laureata sta rispondendo... preparati!';
    } else if (msg.type === 'round_countdown') {
        statusLine.textContent = 'Ha risposto! La domanda sta per aprirsi...';
        fxCountdown(msg.payload.seconds);
    } else if (msg.type === 'round_open') {
        hasAnsweredThisRound = false;
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        statusLine.textContent = 'Rispondi come pensi abbia risposto lei!';
        questionText.textContent = msg.payload.text;
        optionsBox.innerHTML = '';
        msg.payload.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option';
            btn.textContent = opt;
            btn.onclick = () => submitAnswer(idx, btn);
            optionsBox.appendChild(btn);
        });
        questionCard.style.display = 'block';
    } else if (msg.type === 'answer_ack') {
        if (msg.payload.status === 'correct') {
            statusLine.textContent = 'Hai indovinato! Vai allo scontro diretto!';
        } else if (msg.payload.status === 'wrong') {
            statusLine.textContent = 'Risposta diversa dalla sua, aspetta la prossima domanda.';
            fxVoid();
        }
        disableOptions();
    } else if (msg.type === 'winner') {
        winnerBanner.style.display = 'block';
        winnerBanner.textContent = `${msg.payload.name} ha indovinato per primo! Scontro diretto!`;
        disableOptions();
        fxFire();
        fxConfetti(40);
    } else if (msg.type === 'duel_start') {
        fxSkull();
        startDuelView(msg.payload.challenger_name);
    } else if (msg.type === 'wheel_result') {
        showWheelSpin(msg.payload.category);
        setTimeout(() => {
            wheelStatusText.textContent = 'Ruota fermata! In attesa che la regia invii la sfida a tutti...';
        }, WHEEL_SPIN_SECONDS_JS * 1000);
    } else if (msg.type === 'duel_countdown') {
        wheelStatusText.textContent = 'La sfida si apre a momenti!';
        fxCountdown(msg.payload.seconds);
    } else if (msg.type === 'duel_challenge') {
        showDuelChallenge(msg.payload);
    } else if (msg.type === 'duel_answer_registered') {
        if (!hasAnsweredDuel) {
            duelSpectatorNote.textContent = msg.payload.by === 'boss'
                ? 'La festeggiata ha risposto! Sbrigati!'
                : 'Lo sfidante ha risposto! Aspettiamo l\'esito...';
        }
    } else if (msg.type === 'duel_result') {
        stopCountdownBar(duelTimerBar);
        if (posterReveal) posterReveal.finish();
        showDuelResult(msg.payload);
        if (msg.payload.outcome === 'challenger') {
            pulseShake(bossPortrait);
            pulseHpFlash(hpBar, hpBarWrap, 'damage');
            fxScreenShake();
            fxFire();
            fxConfetti(50);
            fxPhotoFlash('win', `${msg.payload.winner_name} vince lo scontro!`);
        } else if (msg.payload.outcome === 'boss') {
            fxVoid();
            fxPhotoFlash('lose', 'La Laureata resiste allo scontro!');
        } else {
            fxVoid();
        }
    } else if (msg.type === 'boss_hit') {
        pulseShake(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'damage');
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
        statusLine.textContent = 'Scontro diretto annullato dalla regia.';
    } else if (msg.type === 'return_home') {
        hideDuelScreen();
        winnerBanner.style.display = 'none';
        statusLine.textContent = 'In attesa della prossima domanda...';
    } else if (msg.type === 'penance_spin') {
        penanceScreen.style.display = 'block';
        penanceRevealBox.style.display = 'none';
        penanceWheelWrap.style.display = 'block';
        buildPenanceWheel(penanceWheelWrap, msg.payload.count);
        spinPenanceWheelTo(penanceWheelWrap, msg.payload.count, msg.payload.index);
    } else if (msg.type === 'penance_result') {
        penanceWheelWrap.style.display = 'none';
        penanceRevealBox.style.display = 'block';
        penanceRevealText.textContent = msg.payload.text;
        penanceRevealHeal.textContent = 'In attesa che la regia confermi se l\'ha fatta davvero...';
    } else if (msg.type === 'penance_confirmed') {
        penanceRevealHeal.textContent = `✅ Confermata! +${msg.payload.heal} HP alla festeggiata!`;
        pulseHeal(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'heal');
    } else if (msg.type === 'penance_declined') {
        penanceRevealHeal.textContent = '❌ Non confermata dalla regia: nessun HP guadagnato.';
    } else if (msg.type === 'state') {
        updateState(msg.payload);
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        penanceScreen.style.display = 'none';
        stopCountdownBar(duelTimerBar);
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
        gameOverShown = false;
        statusLine.textContent = 'Il gioco e stato resettato. In attesa della prossima domanda...';
    }
}

function disableOptions() {
    hasAnsweredThisRound = true;
    Array.from(optionsBox.children).forEach(b => b.disabled = true);
}

function submitAnswer(idx, btn) {
    if (hasAnsweredThisRound) return;
    hasAnsweredThisRound = true;
    Array.from(optionsBox.children).forEach(b => b.disabled = true);
    btn.style.opacity = '1';
    ws.send(JSON.stringify({ type: 'answer', choice: idx }));
}

function startDuelView(challengerName) {
    questionCard.style.display = 'none';
    winnerBanner.style.display = 'none';
    duelScreen.style.display = 'block';
    duelChallengeCard.style.display = 'none';
    duelResultCard.style.display = 'none';
    duelChallengerLine.textContent = `Scontro Diretto: ${challengerName} vs La Laureata!`;
    wheelCard.style.display = 'block';
    wheelStatusText.textContent = 'La festeggiata sta girando la ruota...';
    buildWheel(wheelWrap);
    hasAnsweredDuel = false;
}

function showWheelSpin(category) {
    if (wheelCard.style.display === 'none') {
        wheelCard.style.display = 'block';
        buildWheel(wheelWrap);
    }
    spinWheelTo(wheelWrap, category);
}

function showDuelChallenge(payload) {
    wheelCard.style.display = 'none';
    duelResultCard.style.display = 'none';
    duelChallengeCard.style.display = 'block';
    hasAnsweredDuel = false;

    duelCategoryTitle.textContent = `Indovina la ${categoryLabel(payload.category).toLowerCase()}`;
    fxThemeParticles(payload.category);
    startCountdownBar(duelTimerBar, DUEL_TIMEOUT_SECONDS_JS);
    if (posterReveal) {
        posterReveal.cancel();
        posterReveal = null;
    }
    duelMedia.innerHTML = '';
    if (payload.category === 'musica') {
        duelMedia.innerHTML = '<div class="status">🎵 Ascolta dalle casse della regia...</div>';
    } else if (payload.category === 'film' && payload.media) {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 450;
        canvas.className = 'poster-reveal';
        duelMedia.appendChild(canvas);
        const imgUrl = `/static/media/film/${encodeURIComponent(payload.media)}`;
        posterReveal = startPosterReveal(canvas, imgUrl);
    } else if (payload.media) {
        const img = document.createElement('img');
        img.src = `/static/media/${payload.category}/${encodeURIComponent(payload.media)}`;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';
        duelMedia.appendChild(img);
    } else if (payload.prompt) {
        const div = document.createElement('div');
        div.className = 'status';
        div.style.fontSize = '2rem';
        div.style.fontWeight = 'bold';
        div.textContent = payload.prompt;
        duelMedia.appendChild(div);
    }

    const isChallenger = payload.challenger_id === getGuestId();
    duelOptionsBox.innerHTML = '';
    payload.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.textContent = opt;
        if (isChallenger) {
            btn.onclick = () => submitDuelAnswer(idx);
        } else {
            btn.disabled = true;
        }
        duelOptionsBox.appendChild(btn);
    });

    duelSpectatorNote.textContent = isChallenger
        ? `Rispondi tu contro la festeggiata! Chi risponde correttamente prima vince!`
        : `${payload.challenger_name} vs La Laureata: chi risponde prima correttamente vince!`;
}

function submitDuelAnswer(idx) {
    if (hasAnsweredDuel) return;
    hasAnsweredDuel = true;
    Array.from(duelOptionsBox.children).forEach(b => b.disabled = true);
    ws.send(JSON.stringify({ type: 'duel_answer', choice: idx }));
}

function showDuelResult(payload) {
    duelResultCard.style.display = 'block';
    Array.from(duelOptionsBox.children).forEach((b, idx) => {
        b.disabled = true;
        if (idx === payload.correct_option) b.style.outline = '3px solid #00e676';
    });
    duelResultBanner.className = 'winner-banner';
    if (payload.outcome === 'challenger') {
        duelResultBanner.style.background = '';
        duelResultBanner.textContent = `${payload.winner_name} e' stato piu' veloce! -${payload.damage} HP alla festeggiata!`;
    } else if (payload.outcome === 'boss') {
        duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
        duelResultBanner.textContent = 'La Laureata ha risposto prima! Nessun danno.';
    } else if (payload.outcome === 'timeout') {
        duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
        duelResultBanner.textContent = 'Tempo scaduto per entrambi! Nessun danno.';
    } else {
        duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
        duelResultBanner.textContent = 'Nessuno ha risposto correttamente! Nessun danno.';
    }
}

function updateState(state) {
    const pct = Math.max(0, Math.min(100, (state.hp / state.max_hp) * 100));
    hpBar.style.width = pct + '%';
    hpLabel.textContent = `HP ${state.hp}/${state.max_hp}`;
    lobbyCard.style.display = state.phase === 'lobby' ? 'block' : 'none';
    if (state.phase === 'game_over') {
        statusLine.textContent = 'La laureata e stata sconfitta! Complimenti a tutti!';
        if (!gameOverShown) {
            gameOverShown = true;
            fxEpicEnd('win', '🏆 VITTORIA! 🏆', 'La Laureata e stata sconfitta! Complimenti a tutti gli invitati!');
        }
    }
    renderLeaderboard(leaderboard, state.leaderboard);
}

joinBtn.onclick = () => {
    const name = nameInput.value.trim() || localStorage.getItem('guest_name') || '';
    if (!name) { nameInput.focus(); return; }
    connect(name);
};

const savedName = localStorage.getItem('guest_name');
if (savedName) {
    nameInput.value = savedName;
}
