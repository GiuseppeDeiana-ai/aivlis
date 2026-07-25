const lockScreen = document.getElementById('lockScreen');
const joinScreen = document.getElementById('joinScreen');
const gameScreen = document.getElementById('gameScreen');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const avatarScreen = document.getElementById('avatarScreen');
const avatarCameraBox = document.getElementById('avatarCameraBox');
const avatarVideo = document.getElementById('avatarVideo');
const avatarPreviewImg = document.getElementById('avatarPreviewImg');
const avatarCanvas = document.getElementById('avatarCanvas');
const avatarCaptureRow = document.getElementById('avatarCaptureRow');
const avatarConfirmRow = document.getElementById('avatarConfirmRow');
const avatarCaptureBtn = document.getElementById('avatarCaptureBtn');
const avatarRetakeBtn = document.getElementById('avatarRetakeBtn');
const avatarConfirmBtn = document.getElementById('avatarConfirmBtn');
const avatarSkipBtn = document.getElementById('avatarSkipBtn');
const avatarStatusLine = document.getElementById('avatarStatusLine');
const duelVsBanner = document.getElementById('duelVsBanner');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
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
const answersCountLine = document.getElementById('answersCountLine');

const DUEL_TIMEOUT_SECONDS_JS = 20; // deve corrispondere a DUEL_TIMEOUT_SECONDS in main.py
const ROUND_REVEAL_SECONDS_JS = 20; // deve corrispondere a ROUND_REVEAL_SECONDS in main.py

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
let halfHpAnnounced = false;
let lobbyPollTimer = null;
let avatarStream = null;
let capturedAvatar = null;
let pendingName = '';

async function startAvatarCapture(name) {
    pendingName = name;
    joinScreen.style.display = 'none';
    avatarScreen.style.display = 'block';
    avatarPreviewImg.style.display = 'none';
    avatarVideo.style.display = 'block';
    avatarCaptureRow.style.display = 'flex';
    avatarConfirmRow.style.display = 'none';
    avatarStatusLine.textContent = '';
    capturedAvatar = null;

    try {
        avatarStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        avatarVideo.srcObject = avatarStream;
    } catch (e) {
        avatarStatusLine.textContent = 'Fotocamera non disponibile: puoi entrare senza foto.';
        avatarCaptureRow.style.display = 'none';
    }
}

function stopAvatarStream() {
    if (avatarStream) {
        avatarStream.getTracks().forEach((t) => t.stop());
        avatarStream = null;
    }
}

avatarCaptureBtn.onclick = () => {
    const size = 240;
    avatarCanvas.width = size;
    avatarCanvas.height = size;
    const ctx = avatarCanvas.getContext('2d');
    const vw = avatarVideo.videoWidth || size;
    const vh = avatarVideo.videoHeight || size;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(avatarVideo, sx, sy, side, side, 0, 0, size, size);
    ctx.restore();
    capturedAvatar = avatarCanvas.toDataURL('image/jpeg', 0.7);
    avatarPreviewImg.src = capturedAvatar;
    avatarPreviewImg.style.display = 'block';
    avatarVideo.style.display = 'none';
    avatarCaptureRow.style.display = 'none';
    avatarConfirmRow.style.display = 'flex';
};

avatarRetakeBtn.onclick = () => {
    capturedAvatar = null;
    avatarPreviewImg.style.display = 'none';
    avatarVideo.style.display = 'block';
    avatarCaptureRow.style.display = 'flex';
    avatarConfirmRow.style.display = 'none';
};

avatarConfirmBtn.onclick = () => {
    stopAvatarStream();
    if (capturedAvatar) localStorage.setItem('guest_avatar', capturedAvatar);
    avatarScreen.style.display = 'none';
    connect(pendingName, capturedAvatar);
};

avatarSkipBtn.onclick = () => {
    stopAvatarStream();
    avatarScreen.style.display = 'none';
    connect(pendingName, null);
};

async function checkLobbyStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.started) {
            if (lobbyPollTimer) {
                clearInterval(lobbyPollTimer);
                lobbyPollTimer = null;
            }
            lockScreen.style.display = 'none';
            joinScreen.style.display = 'block';
        } else {
            joinScreen.style.display = 'none';
            lockScreen.style.display = 'block';
            if (!lobbyPollTimer) {
                lobbyPollTimer = setInterval(checkLobbyStatus, 3000);
            }
        }
    } catch (e) {
        // problema di rete: si riprova al prossimo giro senza cambiare schermata
    }
}

function getGuestId() {
    let id = localStorage.getItem('guest_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('guest_id', id);
    }
    return id;
}

function connect(name, avatarDataUrl) {
    const id = getGuestId();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/guest?name=${encodeURIComponent(name)}&id=${id}`);

    ws.onopen = () => {
        joinScreen.style.display = 'none';
        avatarScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        if (avatarDataUrl) {
            ws.send(JSON.stringify({ type: 'set_avatar', avatar: avatarDataUrl }));
        }
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
    } else if (msg.type === 'lobby_locked') {
        gameScreen.style.display = 'none';
        checkLobbyStatus();
    } else if (msg.type === 'welcome') {
        localStorage.setItem('guest_name', msg.payload.name);
    } else if (msg.type === 'chat_history') {
        renderChatHistory(chatMessages, msg.payload.messages, getGuestId());
    } else if (msg.type === 'chat_message') {
        renderChatMessage(chatMessages, msg.payload, getGuestId());
    } else if (msg.type === 'wait_boss') {
        hasAnsweredThisRound = false;
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        statusLine.textContent = 'La laureata sta rispondendo... preparati!';
    } else if (msg.type === 'milestone') {
        fxMilestoneToast(msg.payload.emoji, msg.payload.text);
    } else if (msg.type === 'round_countdown') {
        statusLine.textContent = 'Ha risposto! La domanda sta per aprirsi...';
        fxCountdown(msg.payload.seconds);
    } else if (msg.type === 'round_open') {
        hasAnsweredThisRound = false;
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        statusLine.textContent = 'Rispondi come pensi abbia risposto lei! Hai 20 secondi...';
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
        startCountdownBar(roundTimerBar, msg.payload.seconds || ROUND_REVEAL_SECONDS_JS);
        if (answersCountLine) answersCountLine.textContent = '';
    } else if (msg.type === 'answer_ack') {
        if (msg.payload.status === 'correct') {
            statusLine.textContent = 'Hai indovinato! Aspettiamo chi è stato il più veloce...';
            fxVibrate(60);
        } else if (msg.payload.status === 'wrong') {
            statusLine.textContent = 'Risposta diversa dalla sua, aspetta la prossima domanda.';
            fxVoid();
            fxVibrate([40, 60, 40]);
        }
        disableOptions();
    } else if (msg.type === 'winner') {
        stopCountdownBar(roundTimerBar);
        if (msg.payload.name) {
            winnerBanner.style.display = 'block';
            const isMe = msg.payload.guest_id === getGuestId();
            winnerBanner.textContent = isMe
                ? 'Sei stato il più veloce! Preparati allo scontro diretto!'
                : `${msg.payload.name} ha indovinato per primo! Scontro diretto!`;
            fxFire();
            fxConfetti(40);
        } else {
            winnerBanner.style.display = 'block';
            winnerBanner.textContent = 'Nessuno ha indovinato questa volta!';
        }
        disableOptions();
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
        fxVignette(msg.payload.seconds);
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
            fxFloatNumber(msg.payload.damage, 'damage');
            fxVibrate([100, 50, 100]);
        } else if (msg.payload.outcome === 'boss') {
            fxVoid();
            fxPhotoFlash('lose', 'La Laureata resiste allo scontro!');
            fxVibrate(200);
        } else {
            fxVoid();
            fxVibrate(200);
        }
    } else if (msg.type === 'boss_hit') {
        pulseShake(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'damage');
        fxFloatNumber(msg.payload.amount, 'damage');
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
        fxFloatNumber(msg.payload.heal, 'heal');
    } else if (msg.type === 'penance_declined') {
        penanceRevealHeal.textContent = '❌ Non confermata dalla regia: nessun HP guadagnato.';
    } else if (msg.type === 'state') {
        updateState(msg.payload);
    } else if (msg.type === 'reveal_leaderboard') {
        fxRevealLeaderboard(msg.payload.leaderboard, msg.payload.awards);
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        penanceScreen.style.display = 'none';
        stopCountdownBar(duelTimerBar);
        stopCountdownBar(roundTimerBar);
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
        gameOverShown = false;
        halfHpAnnounced = false;
        document.body.classList.remove('enrage-mode');
        clearChatDisplay(chatMessages);
        const finaleEl = document.getElementById('fxFinaleOverlay');
        if (finaleEl) finaleEl.remove();
        const leaderboardEl = document.getElementById('fxLeaderboardOverlay');
        if (leaderboardEl) leaderboardEl.remove();
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
    fxRenderVsBanner(duelVsBanner, payload.challenger_avatar, bossPortraitImg.src);
    fxThemeParticles(payload.category);
    startCountdownBar(duelTimerBar, DUEL_TIMEOUT_SECONDS_JS);
    if (posterReveal) {
        posterReveal.cancel();
        posterReveal = null;
    }
    duelMedia.innerHTML = '';
    if (payload.category === 'musica') {
        duelMedia.appendChild(buildEqualizer());
        const note = document.createElement('div');
        note.className = 'status';
        note.textContent = '🎵 Ascolta dalle casse della regia...';
        duelMedia.appendChild(note);
    } else if ((payload.category === 'film' || payload.category === 'videogioco') && payload.media) {
        const canvas = document.createElement('canvas');
        canvas.width = payload.category === 'film' ? 300 : 400;
        canvas.height = payload.category === 'film' ? 450 : 300;
        canvas.className = 'poster-reveal';
        duelMedia.appendChild(canvas);
        const imgUrl = `/static/media/${payload.category}/${encodeURIComponent(payload.media)}`;
        posterReveal = startPosterReveal(canvas, imgUrl);
    } else if (payload.media) {
        const img = document.createElement('img');
        img.src = `/static/media/${payload.category}/${encodeURIComponent(payload.media)}`;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';
        duelMedia.appendChild(img);
    } else if (payload.prompt) {
        const div = document.createElement('div');
        div.className = (payload.category === 'data' || payload.category === 'cultura_generale') ? 'status data-parchment' : 'status';
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
    lobbyCard.style.display = fxShouldShowRules('guest', state.phase) ? 'block' : 'none';
    if (answersCountLine) {
        answersCountLine.textContent = state.phase === 'guests_answering'
            ? `📊 ${state.answers_count} ${state.answers_count === 1 ? 'persona ha' : 'persone hanno'} già risposto...`
            : '';
    }
    document.body.classList.toggle('enrage-mode', state.hp > 0 && pct < 25);
    if (!halfHpAnnounced && state.hp > 0 && pct <= 50) {
        halfHpAnnounced = true;
        fxHalfHpBanner();
    }
    if (state.phase === 'game_over') {
        statusLine.textContent = 'La laureata e stata sconfitta! Complimenti a tutti!';
        if (!gameOverShown) {
            gameOverShown = true;
            fxGrandFinale({});
        }
    }
    renderLeaderboard(leaderboard, state.leaderboard, getGuestId());
}

joinBtn.onclick = () => {
    const name = nameInput.value.trim() || localStorage.getItem('guest_name') || '';
    if (!name) { nameInput.focus(); return; }
    const savedAvatar = localStorage.getItem('guest_avatar');
    if (savedAvatar) {
        joinScreen.style.display = 'none';
        connect(name, savedAvatar);
    } else {
        startAvatarCapture(name);
    }
};

const savedName = localStorage.getItem('guest_name');
if (savedName) {
    nameInput.value = savedName;
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat_message', text }));
    chatInput.value = '';
    chatSendBtn.disabled = true;
    setTimeout(() => { chatSendBtn.disabled = false; }, 2000);
}

chatSendBtn.onclick = sendChatMessage;
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

checkLobbyStatus();
