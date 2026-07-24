const keyScreen = document.getElementById('keyScreen');
const gameScreen = document.getElementById('gameScreen');
const keyInput = document.getElementById('keyInput');
const enterBtn = document.getElementById('enterBtn');
const statusLine = document.getElementById('statusLine');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsBox = document.getElementById('optionsBox');
const hpBar = document.getElementById('hpBar');
const hpLabel = document.getElementById('hpLabel');

let ws = null;
let hasAnswered = false;

function connect(key) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/boss?key=${encodeURIComponent(key)}`);

    ws.onopen = () => {
        localStorage.setItem('boss_key', key);
        keyScreen.style.display = 'none';
        gameScreen.style.display = 'block';
    };

    ws.onclose = () => {
        keyScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        statusLine.textContent = 'Codice errato o connessione chiusa.';
    };

    ws.onmessage = (event) => handleMessage(JSON.parse(event.data));
}

function handleMessage(msg) {
    if (msg.type === 'round_started') {
        hasAnswered = false;
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
    } else if (msg.type === 'state') {
        const pct = Math.max(0, Math.min(100, (msg.payload.hp / msg.payload.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${msg.payload.hp}/${msg.payload.max_hp}`;
        if (msg.payload.phase === 'game_over') {
            statusLine.textContent = 'Sei stata sconfitta! Complimenti alla laurea!';
            questionCard.style.display = 'none';
        }
    } else if (msg.type === 'boss_hit') {
        statusLine.textContent = `Hai subito ${msg.payload.amount} danni!`;
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
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

enterBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) return;
    connect(key);
};

const savedKey = localStorage.getItem('boss_key');
if (savedKey) {
    keyInput.value = savedKey;
}
