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
    }
}

document.getElementById('startBtn').onclick = () => ws.send(JSON.stringify({ type: 'start_round' }));
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
