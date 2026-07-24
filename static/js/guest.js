const joinScreen = document.getElementById('joinScreen');
const gameScreen = document.getElementById('gameScreen');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const statusLine = document.getElementById('statusLine');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsBox = document.getElementById('optionsBox');
const winnerBanner = document.getElementById('winnerBanner');
const hpBar = document.getElementById('hpBar');
const hpLabel = document.getElementById('hpLabel');
const leaderboard = document.getElementById('leaderboard');

let ws = null;
let hasAnsweredThisRound = false;

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
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onclose = () => {
        statusLine.textContent = 'Connessione persa, ricarica la pagina...';
    };
}

function handleMessage(msg) {
    if (msg.type === 'welcome') {
        localStorage.setItem('guest_name', msg.payload.name);
    } else if (msg.type === 'wait_boss') {
        hasAnsweredThisRound = false;
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        statusLine.textContent = 'La laureata sta rispondendo... preparati!';
    } else if (msg.type === 'round_open') {
        hasAnsweredThisRound = false;
        winnerBanner.style.display = 'none';
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
        }
        disableOptions();
    } else if (msg.type === 'winner') {
        winnerBanner.style.display = 'block';
        winnerBanner.textContent = `${msg.payload.name} ha indovinato per primo! Scontro diretto!`;
        disableOptions();
    } else if (msg.type === 'state') {
        updateState(msg.payload);
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
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

function updateState(state) {
    const pct = Math.max(0, Math.min(100, (state.hp / state.max_hp) * 100));
    hpBar.style.width = pct + '%';
    hpLabel.textContent = `HP ${state.hp}/${state.max_hp}`;
    if (state.phase === 'game_over') {
        statusLine.textContent = 'La laureata e stata sconfitta! Complimenti a tutti!';
    }
    leaderboard.innerHTML = '';
    state.leaderboard.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}.</td><td>${row.name}</td><td>${row.score}</td>`;
        leaderboard.appendChild(tr);
    });
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
