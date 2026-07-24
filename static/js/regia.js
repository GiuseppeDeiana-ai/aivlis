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

const lobbyCard = document.getElementById('lobbyCard');
const phaseBadge = document.getElementById('phaseBadge');
const roundBadge = document.getElementById('roundBadge');
const onlineBadge = document.getElementById('onlineBadge');
const answersBadge = document.getElementById('answersBadge');
const winnerLine = document.getElementById('winnerLine');
const leaderboard = document.getElementById('leaderboard');

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

const DUEL_TIMEOUT_SECONDS_JS = 20; // deve corrispondere a DUEL_TIMEOUT_SECONDS in main.py

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

const logPanel = document.getElementById('logPanel');
const MAX_LOG_ENTRIES = 60;

let ws = null;
let gameOverShown = false;

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
    };

    ws.onclose = () => {
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
}

function handleMessage(msg) {
    if (msg.type === 'log') {
        addLogEntry(msg.payload.ts, msg.payload.text);
    } else if (msg.type === 'return_home') {
        hideDuelScreen();
        penanceScreen.style.display = 'none';
    } else if (msg.type === 'state') {
        const s = msg.payload;
        const pct = Math.max(0, Math.min(100, (s.hp / s.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${s.hp}/${s.max_hp}`;
        phaseBadge.textContent = `fase: ${s.phase}`;
        lobbyCard.style.display = s.phase === 'lobby' ? 'block' : 'none';
        roundBadge.textContent = `round ${s.round}/${s.total_rounds}`;
        onlineBadge.textContent = `${s.guests_online} online`;
        answersBadge.textContent = `${s.answers_count} risposte`;
        winnerLine.textContent = s.winner ? `Ultimo vincitore: ${s.winner}` : '';
        penanceBadge.textContent = `penitenze: ${s.penance_used}/${s.penance_limit} (rimaste: ${s.penance_remaining})`;
        if (document.activeElement !== penanceLimitInput) {
            penanceLimitInput.value = s.penance_limit;
        }
        leaderboard.innerHTML = '';
        s.leaderboard.forEach((row, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i + 1}.</td><td>${row.name}</td><td>${row.score}</td>`;
            leaderboard.appendChild(tr);
        });
        if (s.phase === 'game_over' && !gameOverShown) {
            gameOverShown = true;
            fxEpicEnd('win', '🏆 VITTORIA! 🏆', 'La Laureata e stata sconfitta! Complimenti a tutti gli invitati!');
        }
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
        penanceRevealHeal.textContent = `Se l'ha fatta davvero: +${msg.payload.heal} HP. Rimaste: ${msg.payload.remaining}`;
        penanceConfirmRow.style.display = 'flex';
    } else if (msg.type === 'penance_confirmed') {
        penanceConfirmRow.style.display = 'none';
        penanceRevealHeal.textContent = `✅ Confermata: +${msg.payload.heal} HP alla festeggiata!`;
        pulseHeal(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'heal');
    } else if (msg.type === 'penance_declined') {
        penanceConfirmRow.style.display = 'none';
        penanceRevealHeal.textContent = '❌ Non confermata: nessun HP guadagnato.';
    } else if (msg.type === 'winner') {
        fxFire();
        fxConfetti(40);
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
    } else if (msg.type === 'duel_challenge') {
        wheelCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengeCard.style.display = 'block';
        duelCategoryTitle.textContent = `Indovina la ${categoryLabel(msg.payload.category).toLowerCase()}`;
        fxThemeParticles(msg.payload.category);
        startCountdownBar(duelTimerBar, DUEL_TIMEOUT_SECONDS_JS);
        duelMedia.innerHTML = '';
        if (msg.payload.category === 'musica' && msg.payload.media) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.autoplay = true;
            audio.src = `/static/media/musica/${msg.payload.media}`;
            audio.play().catch(() => {});
            duelMedia.appendChild(audio);
        } else if (msg.payload.media) {
            const img = document.createElement('img');
            img.src = `/static/media/${msg.payload.category}/${msg.payload.media}`;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '10px';
            duelMedia.appendChild(img);
        } else if (msg.payload.prompt) {
            const div = document.createElement('div');
            div.className = 'status';
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
            fxFire();
            fxConfetti(50);
            fxPhotoFlash('win', `${msg.payload.winner_name} vince lo scontro!`);
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
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
    } else if (msg.type === 'reset') {
        hideDuelScreen();
        penanceScreen.style.display = 'none';
        stopCountdownBar(duelTimerBar);
        gameOverShown = false;
    }
}

document.getElementById('startBtn').onclick = () => ws.send(JSON.stringify({ type: 'start_round' }));
document.getElementById('startDuelBtn').onclick = () => ws.send(JSON.stringify({ type: 'start_duel' }));
document.getElementById('cancelDuelBtn').onclick = () => ws.send(JSON.stringify({ type: 'cancel_duel' }));
document.getElementById('dmg10').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 10 }));
document.getElementById('dmg25').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 25 }));
document.getElementById('dmg100').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 100 }));
confirmPenanceBtn.onclick = () => ws.send(JSON.stringify({ type: 'confirm_penance' }));
declinePenanceBtn.onclick = () => ws.send(JSON.stringify({ type: 'decline_penance' }));

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

enterBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) return;
    connect(key);
};

const savedKey = localStorage.getItem('regia_key');
if (savedKey) {
    keyInput.value = savedKey;
}
