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

const duelScreen = document.getElementById('duelScreen');
const duelChallengerLine = document.getElementById('duelChallengerLine');
const wheelCard = document.getElementById('wheelCard');
const wheelWrap = document.getElementById('wheelWrap');
const spinBtn = document.getElementById('spinBtn');
const duelChallengeCard = document.getElementById('duelChallengeCard');
const duelCategoryTitle = document.getElementById('duelCategoryTitle');
const duelMedia = document.getElementById('duelMedia');
const duelSpectatorNote = document.getElementById('duelSpectatorNote');
const duelResultCard = document.getElementById('duelResultCard');
const duelResultBanner = document.getElementById('duelResultBanner');

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

function hideDuelScreen() {
    duelScreen.style.display = 'none';
    wheelCard.style.display = 'none';
    duelChallengeCard.style.display = 'none';
    duelResultCard.style.display = 'none';
}

function handleMessage(msg) {
    if (msg.type === 'round_started') {
        hasAnswered = false;
        hideDuelScreen();
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
        questionCard.style.display = 'none';
        duelScreen.style.display = 'block';
        duelChallengeCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengerLine.textContent = `Scontro Diretto contro ${msg.payload.challenger_name}!`;
        wheelCard.style.display = 'block';
        buildWheel(wheelWrap);
        spinBtn.disabled = false;
        statusLine.textContent = 'Gira la ruota per scegliere la categoria!';
    } else if (msg.type === 'wheel_result') {
        spinBtn.disabled = true;
        spinWheelTo(wheelWrap, msg.payload.category);
    } else if (msg.type === 'duel_challenge') {
        wheelCard.style.display = 'none';
        duelResultCard.style.display = 'none';
        duelChallengeCard.style.display = 'block';
        duelCategoryTitle.textContent = `Indovina la ${categoryLabel(msg.payload.category).toLowerCase()}`;
        duelMedia.innerHTML = '';
        if (msg.payload.category === 'musica') {
            duelMedia.innerHTML = '<div class="status">🎵 Ascolta dalle casse della regia...</div>';
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
        duelSpectatorNote.textContent = `${msg.payload.challenger_name} sta rispondendo...`;
    } else if (msg.type === 'duel_result') {
        duelResultCard.style.display = 'block';
        if (msg.payload.correct) {
            duelResultBanner.className = 'winner-banner';
            duelResultBanner.style.background = '';
            duelResultBanner.textContent = `Hai subito ${msg.payload.damage} danni!`;
        } else if (msg.payload.timeout) {
            duelResultBanner.className = 'winner-banner';
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Tempo scaduto per lo sfidante, sei salva!';
        } else {
            duelResultBanner.className = 'winner-banner';
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Risposta sbagliata, sei salva!';
        }
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
        statusLine.textContent = 'Scontro diretto annullato dalla regia.';
    } else if (msg.type === 'state') {
        const pct = Math.max(0, Math.min(100, (msg.payload.hp / msg.payload.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${msg.payload.hp}/${msg.payload.max_hp}`;
        if (msg.payload.phase === 'game_over') {
            statusLine.textContent = 'Sei stata sconfitta! Complimenti alla laurea!';
            questionCard.style.display = 'none';
            hideDuelScreen();
        }
    } else if (msg.type === 'boss_hit') {
        statusLine.textContent = `Hai subito ${msg.payload.amount} danni!`;
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        hideDuelScreen();
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

spinBtn.onclick = () => {
    spinBtn.disabled = true;
    ws.send(JSON.stringify({ type: 'spin_wheel' }));
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
