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
let hasAnsweredThisRound = false;
let hasAnsweredDuel = false;

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

function hideDuelScreen() {
    duelScreen.style.display = 'none';
    wheelCard.style.display = 'none';
    duelChallengeCard.style.display = 'none';
    duelResultCard.style.display = 'none';
}

function handleMessage(msg) {
    if (msg.type === 'welcome') {
        localStorage.setItem('guest_name', msg.payload.name);
    } else if (msg.type === 'wait_boss') {
        hasAnsweredThisRound = false;
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
        statusLine.textContent = 'La laureata sta rispondendo... preparati!';
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
        }
        disableOptions();
    } else if (msg.type === 'winner') {
        winnerBanner.style.display = 'block';
        winnerBanner.textContent = `${msg.payload.name} ha indovinato per primo! Scontro diretto!`;
        disableOptions();
    } else if (msg.type === 'duel_start') {
        startDuelView(msg.payload.challenger_name);
    } else if (msg.type === 'wheel_result') {
        showWheelSpin(msg.payload.category);
    } else if (msg.type === 'duel_challenge') {
        showDuelChallenge(msg.payload);
    } else if (msg.type === 'duel_result') {
        showDuelResult(msg.payload);
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
        statusLine.textContent = 'Scontro diretto annullato dalla regia.';
    } else if (msg.type === 'state') {
        updateState(msg.payload);
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        winnerBanner.style.display = 'none';
        hideDuelScreen();
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
    duelMedia.innerHTML = '';
    if (payload.category === 'musica') {
        duelMedia.innerHTML = '<div class="status">🎵 Ascolta dalle casse della regia...</div>';
    } else if (payload.media) {
        const img = document.createElement('img');
        img.src = `/static/media/${payload.category}/${payload.media}`;
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
        ? 'Rispondi tu! Hai poco tempo!'
        : `In attesa che ${payload.challenger_name} risponda...`;
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
    if (payload.correct) {
        duelResultBanner.className = 'winner-banner';
        duelResultBanner.textContent = `COLPO CENTRATO! -${payload.damage} HP alla festeggiata!`;
    } else if (payload.timeout) {
        duelResultBanner.className = 'winner-banner';
        duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
        duelResultBanner.textContent = 'Tempo scaduto! Nessun danno.';
    } else {
        duelResultBanner.className = 'winner-banner';
        duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
        duelResultBanner.textContent = 'Risposta sbagliata! Nessun danno.';
    }
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
