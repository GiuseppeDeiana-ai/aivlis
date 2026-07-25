const keyScreen = document.getElementById('keyScreen');
const panel = document.getElementById('panel');
const keyInput = document.getElementById('keyInput');
const enterBtn = document.getElementById('enterBtn');
const hpBar = document.getElementById('hpBar');
const hpBarWrap = document.getElementById('hpBarWrap');
const hpLabel = document.getElementById('hpLabel');
const bossPortrait = document.getElementById('bossPortrait');
const bossPortraitImg = document.getElementById('bossPortraitImg');

startPortraitRotation(bossPortraitImg);

const phaseBadge = document.getElementById('phaseBadge');
const roundBadge = document.getElementById('roundBadge');
const onlineBadge = document.getElementById('onlineBadge');
const answersBadge = document.getElementById('answersBadge');
const spectatorsBadge = document.getElementById('spectatorsBadge');
const lobbyGateBadge = document.getElementById('lobbyGateBadge');
const startGameBtn = document.getElementById('startGameBtn');
const winnerLine = document.getElementById('winnerLine');
const leaderboard = document.getElementById('leaderboard');
const answerTicker = document.getElementById('answerTicker');
const chatMessages = document.getElementById('chatMessages');
const clearChatBtn = document.getElementById('clearChatBtn');

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
const duelVsBanner = document.getElementById('duelVsBanner');

const DUEL_TIMEOUT_SECONDS_JS = 20; // deve corrispondere a DUEL_TIMEOUT_SECONDS in main.py
const ROUND_REVEAL_SECONDS_JS = 20; // deve corrispondere a ROUND_REVEAL_SECONDS in main.py

const penanceBadge = document.getElementById('penanceBadge');
const penanceLimitInput = document.getElementById('penanceLimitInput');
const setPenanceLimitBtn = document.getElementById('setPenanceLimitBtn');
const penanceScreen = document.getElementById('penanceScreen');
const penanceWheelWrap = document.getElementById('penanceWheelWrap');
const penanceRevealBox = document.getElementById('penanceRevealBox');
const penanceRevealText = document.getElementById('penanceRevealText');
const penanceRevealHeal = document.getElementById('penanceRevealHeal');
const penanceConfirmRow = document.getElementById('penanceConfirmRow');
const confirmPenanceBtn = document.getElementById('confirmPenanceBtn');
const declinePenanceBtn = document.getElementById('declinePenanceBtn');

const duelSendPopup = document.getElementById('duelSendPopup');
const duelSendCategory = document.getElementById('duelSendCategory');
const confirmSendBtn = document.getElementById('confirmSendBtn');

const logPanel = document.getElementById('logPanel');
const MAX_LOG_ENTRIES = 60;
const PING_INTERVAL_MS = 20000; // deve corrispondere a PING_INTERVAL_SECONDS in main.py

let ws = null;
let pingInterval = null;
let gameOverShown = false;
let halfHpAnnounced = false;
let currentMusicAudio = null;
let posterReveal = null;

function addLogEntry(ts, text) {
    const time = new Date(ts * 1000).toLocaleTimeString('it-IT');
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${time}</span>${text}`;
    logPanel.insertBefore(div, logPanel.firstChild);
    while (logPanel.children.length > MAX_LOG_ENTRIES) {
        logPanel.removeChild(logPanel.lastChild);
    }
}

function connect(key) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/regia?key=${encodeURIComponent(key)}`);

    ws.onopen = () => {
        localStorage.setItem('regia_key', key);
        keyScreen.style.display = 'none';
        panel.style.display = 'block';
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, PING_INTERVAL_MS);
    };

    ws.onclose = () => {
        clearInterval(pingInterval);
        keyScreen.style.display = 'block';
        panel.style.display = 'none';
    };

    ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
}

function hideDuelScreen() {
    duelScreen.style.display = 'none';
    wheelCard.style.display = 'none';
    duelChallengeCard.style.display = 'none';
    duelResultCard.style.display = 'none';
    // La canzone di un duello musica non deve MAI restare a suonare in sottofondo
    // una volta che lo schermo del duello si nasconde (es. al "torna alla home"):
    // a quel punto il pulsante per fermarla e' sparito insieme al resto, quindi va
    // fermata qui, altrimenti resta in esecuzione senza che nessuno possa piu' stopparla.
    if (currentMusicAudio) {
        currentMusicAudio.pause();
        currentMusicAudio = null;
    }
}

function handleMessage(msg) {
    if (msg.type === 'ping') {
        // keepalive, nessuna azione necessaria
    } else if (msg.type === 'log') {
        addLogEntry(msg.payload.ts, msg.payload.text);
    } else if (msg.type === 'milestone') {
        fxMilestoneToast(msg.payload.emoji, msg.payload.text);
    } else if (msg.type === 'chat_spotlight') {
        fxChatSpotlight(msg.payload.name, msg.payload.avatar, msg.payload.text);
    } else if (msg.type === 'chat_history') {
        renderChatHistory(chatMessages, msg.payload.messages, null, sendChatSpotlight);
    } else if (msg.type === 'chat_message') {
        renderChatMessage(chatMessages, msg.payload, null, sendChatSpotlight);
    } else if (msg.type === 'chat_cleared') {
        clearChatDisplay(chatMessages);
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
            label.textContent = msg.payload.name;
            chip.appendChild(label);
            if (msg.payload.streak >= 3) {
                const streakEl = document.createElement('span');
                streakEl.className = 'answer-ticker-streak';
                streakEl.textContent = `🔥x${msg.payload.streak}`;
                chip.appendChild(streakEl);
            }
            answerTicker.appendChild(chip);
        }
    } else if (msg.type === 'return_home') {
        hideDuelScreen();
        penanceScreen.style.display = 'none';
    } else if (msg.type === 'state') {
        const s = msg.payload;
        const pct = Math.max(0, Math.min(100, (s.hp / s.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${s.hp}/${s.max_hp}`;
        phaseBadge.textContent = `fase: ${s.phase}`;
        const isEnraged = s.hp > 0 && pct < 25;
        document.body.classList.toggle('enrage-mode', isEnraged);
        if (isEnraged) {
            sfxStartHeartbeat();
        } else {
            sfxStopHeartbeat();
        }
        if (!halfHpAnnounced && s.hp > 0 && pct <= 50) {
            halfHpAnnounced = true;
            fxHalfHpBanner();
        }
        roundBadge.textContent = `round ${s.round}/${s.total_rounds}`;
        onlineBadge.textContent = `${s.guests_online} online`;
        answersBadge.textContent = `${s.answers_count} risposte`;
        spectatorsBadge.textContent = `👀 ${s.spectators_online} spettatori`;
        lobbyGateBadge.textContent = s.started ? '🔓 ingresso invitati: aperto' : '🔒 ingresso invitati: chiuso';
        startGameBtn.disabled = s.started;
        startGameBtn.textContent = s.started ? '✅ Partita avviata' : '🚀 Avvia partita (abilita ingresso invitati)';
        winnerLine.textContent = s.winner ? `Ultimo vincitore: ${s.winner}` : '';
        penanceBadge.textContent = `penitenze: ${s.penance_used}/${s.penance_limit} (rimaste: ${s.penance_remaining})`;
        if (document.activeElement !== penanceLimitInput) {
            penanceLimitInput.value = s.penance_limit;
        }
        renderLeaderboard(leaderboard, s.leaderboard);
        if (s.phase === 'game_over' && !gameOverShown) {
            gameOverShown = true;
            sfxStopHeartbeat();
            sfxPlay('explosion');
            fxGrandFinale({
                onReveal: () => ws.send(JSON.stringify({ type: 'reveal_leaderboard' })),
            });
        }
    } else if (msg.type === 'penance_spin') {
        penanceScreen.style.display = 'block';
        penanceRevealBox.style.display = 'none';
        penanceWheelWrap.style.display = 'block';
        buildPenanceWheel(penanceWheelWrap, msg.payload.count);
        spinPenanceWheelTo(penanceWheelWrap, msg.payload.count, msg.payload.index);
        sfxWheelSpin(WHEEL_SPIN_SECONDS_JS);
    } else if (msg.type === 'penance_result') {
        penanceWheelWrap.style.display = 'none';
        penanceRevealBox.style.display = 'block';
        penanceRevealText.textContent = msg.payload.text;
        penanceRevealHeal.textContent = `Se l'ha fatta davvero: +${msg.payload.heal} HP. Rimaste: ${msg.payload.remaining}`;
        penanceConfirmRow.style.display = 'flex';
    } else if (msg.type === 'penance_confirmed') {
        penanceConfirmRow.style.display = 'none';
        penanceRevealHeal.textContent = `✅ Confermata: +${msg.payload.heal} HP alla festeggiata!`;
        pulseHeal(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'heal');
        fxFloatNumber(msg.payload.heal, 'heal');
    } else if (msg.type === 'penance_declined') {
        penanceConfirmRow.style.display = 'none';
        penanceRevealHeal.textContent = '❌ Non confermata: nessun HP guadagnato.';
    } else if (msg.type === 'winner') {
        stopTickCountdown();
        if (msg.payload.name) {
            fxFire();
            fxConfetti(40);
        }
    } else if (msg.type === 'duel_start') {
        fxSkull();
        penanceScreen.style.display = 'none';
        duelScreen.style.display = 'block';
        duelChallengeCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengerLine.textContent = `Scontro Diretto: ${msg.payload.challenger_name} vs La Laureata!`;
        wheelCard.style.display = 'block';
        buildWheel(wheelWrap);
    } else if (msg.type === 'wheel_result') {
        spinWheelTo(wheelWrap, msg.payload.category);
        sfxWheelSpin(WHEEL_SPIN_SECONDS_JS);
    } else if (msg.type === 'duel_ready_confirm') {
        duelSendCategory.textContent = categoryLabel(msg.payload.category);
        duelSendPopup.style.display = 'flex';
    } else if (msg.type === 'duel_countdown') {
        duelSendPopup.style.display = 'none';
        fxCountdown(msg.payload.seconds, 'La sfida sta per aprirsi!');
        fxVignette(msg.payload.seconds);
    } else if (msg.type === 'round_countdown') {
        fxCountdown(msg.payload.seconds, 'La domanda sta per aprirsi!');
        setTimeout(() => startTickCountdown(ROUND_REVEAL_SECONDS_JS), msg.payload.seconds * 1000);
    } else if (msg.type === 'duel_challenge') {
        wheelCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengeCard.style.display = 'block';
        duelCategoryTitle.textContent = `Indovina la ${categoryLabel(msg.payload.category).toLowerCase()}`;
        fxRenderVsBanner(duelVsBanner, msg.payload.challenger_avatar, bossPortraitImg.src);
        fxThemeParticles(msg.payload.category);
        startCountdownBar(duelTimerBar, DUEL_TIMEOUT_SECONDS_JS);
        startTickCountdown(DUEL_TIMEOUT_SECONDS_JS);
        if (currentMusicAudio) {
            currentMusicAudio.pause();
            currentMusicAudio = null;
        }
        if (posterReveal) {
            posterReveal.cancel();
            posterReveal = null;
        }
        duelMedia.innerHTML = '';
        if (msg.payload.category === 'musica' && msg.payload.media) {
            duelMedia.appendChild(buildEqualizer());
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.autoplay = true;
            audio.src = `/static/media/musica/${encodeURIComponent(msg.payload.media)}`;
            audio.play().catch(() => {});
            duelMedia.appendChild(audio);
            currentMusicAudio = audio;

            const stopMusicBtn = document.createElement('button');
            stopMusicBtn.className = 'primary danger';
            stopMusicBtn.textContent = '⏹️ Interrompi la canzone';
            stopMusicBtn.style.display = 'block';
            stopMusicBtn.style.margin = '10px auto 0';
            stopMusicBtn.onclick = () => {
                audio.pause();
                stopMusicBtn.disabled = true;
                stopMusicBtn.textContent = '⏹️ Canzone interrotta';
            };
            duelMedia.appendChild(stopMusicBtn);
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
            div.className = (msg.payload.category === 'data' || msg.payload.category === 'cultura_generale') ? 'status data-parchment' : 'status';
            div.style.fontSize = '2rem';
            div.style.fontWeight = 'bold';
            div.textContent = msg.payload.prompt;
            duelMedia.appendChild(div);
        }
        duelOptionsBox.innerHTML = '';
        msg.payload.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.className = 'option';
            btn.textContent = opt;
            btn.disabled = true;
            duelOptionsBox.appendChild(btn);
        });
        duelSpectatorNote.textContent = `${msg.payload.challenger_name} vs La Laureata: chi risponde prima correttamente vince!`;
    } else if (msg.type === 'duel_answer_registered') {
        duelSpectatorNote.textContent = msg.payload.by === 'boss'
            ? 'La festeggiata ha risposto!'
            : 'Lo sfidante ha risposto!';
    } else if (msg.type === 'duel_result') {
        stopCountdownBar(duelTimerBar);
        stopTickCountdown();
        if (posterReveal) posterReveal.finish();
        duelResultCard.style.display = 'block';
        Array.from(duelOptionsBox.children).forEach((b, idx) => {
            if (idx === msg.payload.correct_option) b.style.outline = '3px solid #00e676';
        });
        duelResultBanner.className = 'winner-banner';
        if (msg.payload.outcome === 'challenger') {
            duelResultBanner.style.background = '';
            duelResultBanner.textContent = `${msg.payload.winner_name} e' stato piu' veloce! -${msg.payload.damage} HP alla festeggiata!`;
            pulseShake(bossPortrait);
            pulseHpFlash(hpBar, hpBarWrap, 'damage');
            fxScreenShake();
            sfxPlay('explosion');
            fxFire();
            fxConfetti(50);
            fxPhotoFlash('win', `${msg.payload.winner_name} vince lo scontro!`);
            fxFloatNumber(msg.payload.damage, 'damage');
        } else if (msg.payload.outcome === 'boss') {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'La Laureata ha risposto prima! Nessun danno.';
            fxVoid();
            fxPhotoFlash('lose', 'La Laureata resiste allo scontro!');
        } else if (msg.payload.outcome === 'timeout') {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Tempo scaduto per entrambi, nessun danno.';
            fxVoid();
        } else {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Nessuno ha risposto correttamente, nessun danno.';
            fxVoid();
        }
    } else if (msg.type === 'boss_hit') {
        pulseShake(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'damage');
        sfxPlay('explosion');
        fxFloatNumber(msg.payload.amount, 'damage');
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
        duelSendPopup.style.display = 'none';
        stopTickCountdown();
        if (currentMusicAudio) { currentMusicAudio.pause(); currentMusicAudio = null; }
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
    } else if (msg.type === 'reveal_leaderboard') {
        fxRevealLeaderboard(msg.payload.leaderboard, msg.payload.awards, { playSfx: sfxPlay });
    } else if (msg.type === 'reset') {
        hideDuelScreen();
        penanceScreen.style.display = 'none';
        duelSendPopup.style.display = 'none';
        stopCountdownBar(duelTimerBar);
        stopTickCountdown();
        gameOverShown = false;
        halfHpAnnounced = false;
        sfxStopHeartbeat();
        document.body.classList.remove('enrage-mode');
        if (answerTicker) answerTicker.innerHTML = '';
        clearChatDisplay(chatMessages);
        if (currentMusicAudio) { currentMusicAudio.pause(); currentMusicAudio = null; }
        if (posterReveal) { posterReveal.cancel(); posterReveal = null; }
        const finaleEl = document.getElementById('fxFinaleOverlay');
        if (finaleEl) finaleEl.remove();
        const leaderboardEl = document.getElementById('fxLeaderboardOverlay');
        if (leaderboardEl) leaderboardEl.remove();
    }
}

startGameBtn.onclick = () => ws.send(JSON.stringify({ type: 'start_game' }));
document.getElementById('startBtn').onclick = () => {
    if (answerTicker) answerTicker.innerHTML = '';
    ws.send(JSON.stringify({ type: 'start_round' }));
};
document.getElementById('startDuelBtn').onclick = () => ws.send(JSON.stringify({ type: 'start_duel' }));
document.getElementById('cancelDuelBtn').onclick = () => ws.send(JSON.stringify({ type: 'cancel_duel' }));
document.getElementById('dmg10').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 10 }));
document.getElementById('dmg25').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 25 }));
document.getElementById('dmg100').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 100 }));
confirmPenanceBtn.onclick = () => ws.send(JSON.stringify({ type: 'confirm_penance' }));
declinePenanceBtn.onclick = () => ws.send(JSON.stringify({ type: 'decline_penance' }));
confirmSendBtn.onclick = () => {
    ws.send(JSON.stringify({ type: 'confirm_duel_send' }));
    duelSendPopup.style.display = 'none';
};

setPenanceLimitBtn.onclick = () => {
    const limit = parseInt(penanceLimitInput.value, 10);
    if (Number.isNaN(limit) || limit < 0) return;
    ws.send(JSON.stringify({ type: 'set_penance_limit', limit }));
};

document.getElementById('resetBtn').onclick = () => {
    if (confirm('Sicuro di voler resettare la partita?')) {
        ws.send(JSON.stringify({ type: 'reset' }));
    }
};

document.getElementById('hardRestartBtn').onclick = () => {
    if (confirm('Questo disconnette TUTTI (invitati, festeggiata, spettatori) e azzera nomi e punteggi. Sicura?')) {
        ws.send(JSON.stringify({ type: 'hard_restart' }));
    }
};

clearChatBtn.onclick = () => {
    if (confirm('Svuotare la chat per tutti?')) {
        ws.send(JSON.stringify({ type: 'clear_chat' }));
    }
};

function sendChatSpotlight(msg) {
    ws.send(JSON.stringify({ type: 'spotlight_chat', name: msg.name, avatar: msg.avatar, text: msg.text }));
}

enterBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) return;
    sfxUnlock();
    connect(key);
};

const savedKey = localStorage.getItem('regia_key');
if (savedKey) {
    keyInput.value = savedKey;
}
