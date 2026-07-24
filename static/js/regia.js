const keyScreen = document.getElementById('keyScreen');
const panel = document.getElementById('panel');
const keyInput = document.getElementById('keyInput');
const enterBtn = document.getElementById('enterBtn');
const hpBar = document.getElementById('hpBar');
const hpLabel = document.getElementById('hpLabel');
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

let ws = null;

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
    if (msg.type === 'state') {
        const s = msg.payload;
        const pct = Math.max(0, Math.min(100, (s.hp / s.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${s.hp}/${s.max_hp}`;
        phaseBadge.textContent = `fase: ${s.phase}`;
        roundBadge.textContent = `round ${s.round}/${s.total_rounds}`;
        onlineBadge.textContent = `${s.guests_online} online`;
        answersBadge.textContent = `${s.answers_count} risposte`;
        winnerLine.textContent = s.winner ? `Ultimo vincitore: ${s.winner}` : '';
        leaderboard.innerHTML = '';
        s.leaderboard.forEach((row, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i + 1}.</td><td>${row.name}</td><td>${row.score}</td>`;
            leaderboard.appendChild(tr);
        });
    } else if (msg.type === 'duel_start') {
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
        duelSpectatorNote.textContent = `${msg.payload.challenger_name} sta rispondendo...`;
    } else if (msg.type === 'duel_result') {
        duelResultCard.style.display = 'block';
        Array.from(duelOptionsBox.children).forEach((b, idx) => {
            if (idx === msg.payload.correct_option) b.style.outline = '3px solid #00e676';
        });
        if (msg.payload.correct) {
            duelResultBanner.className = 'winner-banner';
            duelResultBanner.style.background = '';
            duelResultBanner.textContent = `COLPO CENTRATO! -${msg.payload.damage} HP alla festeggiata!`;
        } else if (msg.payload.timeout) {
            duelResultBanner.className = 'winner-banner';
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Tempo scaduto, nessun danno.';
        } else {
            duelResultBanner.className = 'winner-banner';
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Risposta sbagliata, nessun danno.';
        }
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
    } else if (msg.type === 'reset') {
        hideDuelScreen();
    }
}

document.getElementById('startBtn').onclick = () => ws.send(JSON.stringify({ type: 'start_round' }));
document.getElementById('startDuelBtn').onclick = () => ws.send(JSON.stringify({ type: 'start_duel' }));
document.getElementById('cancelDuelBtn').onclick = () => ws.send(JSON.stringify({ type: 'cancel_duel' }));
document.getElementById('dmg10').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 10 }));
document.getElementById('dmg25').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 25 }));
document.getElementById('dmg100').onclick = () => ws.send(JSON.stringify({ type: 'damage_boss', amount: 100 }));
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
