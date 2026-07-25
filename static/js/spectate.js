// Ruolo spettatore: sola visione, nessun nome, nessuna risposta. Ricalca guest.js ma senza
// schermata di ingresso e sempre "non sfidante" nei duelli (opzioni visibili ma disabilitate).

const gameScreen = document.getElementById('gameScreen');
const statusLine = document.getElementById('statusLine');
const lobbyCard = document.getElementById('lobbyCard');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsBox = document.getElementById('optionsBox');
const winnerBanner = document.getElementById('winnerBanner');
const hpBar = document.getElementById('hpBar');
const hpBarWrap = document.getElementById('hpBarWrap');
const hpLabel = document.getElementById('hpLabel');
const roundLine = document.getElementById('roundLine');
const answerTicker = document.getElementById('answerTicker');
const leaderboard = document.getElementById('leaderboard');
const chatMessages = document.getElementById('chatMessages');
const bossPortrait = document.getElementById('bossPortrait');
const bossPortraitImg = document.getElementById('bossPortraitImg');

startPortraitRotation(bossPortraitImg);

initWelcomeScreen({
    welcomeEl: document.getElementById('welcomeScreen'),
    enterBtnEl: document.getElementById('welcomeEnterBtn'),
    ambientEl: document.getElementById('welcomeAmbient'),
    portraitImgEl: document.getElementById('welcomePortraitImg'),
    onEnter: () => connect(),
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
const duelVsBanner = document.getElementById('duelVsBanner');

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
let gameOverShown = false;
let halfHpAnnounced = false;

function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/spectate`);

    ws.onopen = () => {
        gameScreen.style.display = 'block';
        statusLine.textContent = 'In attesa...';
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
    } else if (msg.type === 'chat_history') {
        renderChatHistory(chatMessages, msg.payload.messages);
    } else if (msg.type === 'chat_message') {
        renderChatMessage(chatMessages, msg.payload);
    } else if (msg.type === 'chat_spotlight') {
        fxChatSpotlight(msg.payload.name, msg.payload.avatar, msg.payload.text);
    } else if (msg.type === 'milestone') {
        fxMilestoneToast(msg.payload.emoji, msg.payload.text);
    } else if (msg.type === 'reaction') {
        fxFloatingReaction(msg.payload.emoji);
    } else if (msg.type === 'wait_boss') {
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        if (answerTicker) answerTicker.innerHTML = '';
        statusLine.textContent = 'La laureata sta rispondendo... preparati!';
    } else if (msg.type === 'round_countdown') {
        statusLine.textContent = 'Ha risposto! La domanda sta per aprirsi...';
        fxCountdown(msg.payload.seconds);
    } else if (msg.type === 'round_open') {
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        if (answerTicker) answerTicker.innerHTML = '';
        statusLine.textContent = 'Gli invitati rispondono come pensano abbia risposto lei! (20s)';
        questionText.textContent = msg.payload.text;
        optionsBox.innerHTML = '';
        msg.payload.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.className = 'option';
            btn.textContent = opt;
            btn.disabled = true;
            optionsBox.appendChild(btn);
        });
        questionCard.style.display = 'block';
        startCountdownBar(roundTimerBar, msg.payload.seconds || ROUND_REVEAL_SECONDS_JS);
    } else if (msg.type === 'answer_progress') {
        if (answerTicker) {
            const chip = document.createElement('span');
            const hasAvatar = Boolean(msg.payload.avatar);
            chip.className = 'answer-ticker-chip' + (hasAvatar ? '' : ' no-avatar');
            if (hasAvatar) {
                const img = document.createElement('img');
                img.className = 'answer-ticker-avatar';
                img.src = msg.payload.avatar;
                img.alt = '';
                chip.appendChild(img);
            }
            const label = document.createElement('span');
            label.textContent = msg.payload.name + (msg.payload.streak >= 3 ? ' ' : '');
            chip.appendChild(label);
            if (msg.payload.streak >= 3) {
                const streakEl = document.createElement('span');
                streakEl.className = 'answer-ticker-streak';
                streakEl.textContent = `🔥x${msg.payload.streak}`;
                chip.appendChild(streakEl);
            }
            answerTicker.appendChild(chip);
        }
    } else if (msg.type === 'winner') {
        stopCountdownBar(roundTimerBar);
        winnerBanner.style.display = 'block';
        if (msg.payload.name) {
            winnerBanner.textContent = `${msg.payload.name} ha indovinato per primo! Scontro diretto!`;
            fxFire();
            fxConfetti(40);
        } else {
            winnerBanner.textContent = 'Nessuno ha indovinato questa volta!';
        }
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
        duelSpectatorNote.textContent = msg.payload.by === 'boss'
            ? 'La festeggiata ha risposto! Sbrigati... a guardare!'
            : 'Lo sfidante ha risposto! Aspettiamo l\'esito...';
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
        } else if (msg.payload.outcome === 'boss') {
            fxVoid();
            fxPhotoFlash('lose', 'La Laureata resiste allo scontro!');
        } else {
            fxVoid();
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
        if (answerTicker) answerTicker.innerHTML = '';
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

    duelOptionsBox.innerHTML = '';
    payload.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.textContent = opt;
        btn.disabled = true;
        duelOptionsBox.appendChild(btn);
    });

    duelSpectatorNote.textContent = `${payload.challenger_name} vs La Laureata: chi risponde prima correttamente vince!`;
}

function showDuelResult(payload) {
    duelResultCard.style.display = 'block';
    Array.from(duelOptionsBox.children).forEach((b, idx) => {
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
    roundLine.textContent = state.total_rounds > 0 ? `Domanda ${state.round}/${state.total_rounds}` : '';
    lobbyCard.style.display = state.phase === 'lobby' ? 'block' : 'none';
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
    renderLeaderboard(leaderboard, state.leaderboard);
}

// L'anteprima locale non serve: il broadcast del server (hub.to_all) raggiunge anche
// chi ha appena toccato il pulsante, quindi basta inviare e aspettare l'eco per tutti insieme.
let lastReactionSentAt = 0;
document.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.onclick = () => {
        const now = Date.now();
        if (now - lastReactionSentAt < 600) return;
        lastReactionSentAt = now;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'reaction', emoji: btn.dataset.emoji }));
        }
    };
});
