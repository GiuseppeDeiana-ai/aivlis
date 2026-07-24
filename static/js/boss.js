const keyScreen = document.getElementById('keyScreen');
const gameScreen = document.getElementById('gameScreen');
const keyInput = document.getElementById('keyInput');
const enterBtn = document.getElementById('enterBtn');
const statusLine = document.getElementById('statusLine');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsBox = document.getElementById('optionsBox');
const hpBar = document.getElementById('hpBar');
const hpBarWrap = document.getElementById('hpBarWrap');
const hpLabel = document.getElementById('hpLabel');
const bossPortrait = document.getElementById('bossPortrait');
const bossPortraitImg = document.getElementById('bossPortraitImg');

startPortraitRotation(bossPortraitImg);

const duelScreen = document.getElementById('duelScreen');
const duelChallengerLine = document.getElementById('duelChallengerLine');
const wheelCard = document.getElementById('wheelCard');
const wheelWrap = document.getElementById('wheelWrap');
const spinBtn = document.getElementById('spinBtn');
const duelChallengeCard = document.getElementById('duelChallengeCard');
const duelCategoryTitle = document.getElementById('duelCategoryTitle');
const duelMedia = document.getElementById('duelMedia');
const duelOptionsBox = document.getElementById('duelOptionsBox');
const duelSpectatorNote = document.getElementById('duelSpectatorNote');
const duelResultCard = document.getElementById('duelResultCard');
const duelResultBanner = document.getElementById('duelResultBanner');

const penanceCard = document.getElementById('penanceCard');
const penanceWheelWrap = document.getElementById('penanceWheelWrap');
const penanceRevealCard = document.getElementById('penanceRevealCard');
const penanceRevealText = document.getElementById('penanceRevealText');
const penanceRevealHeal = document.getElementById('penanceRevealHeal');
const penanceSpinBtn = document.getElementById('penanceSpinBtn');
const penanceStatusLine = document.getElementById('penanceStatusLine');

let ws = null;
let hasAnswered = false;
let hasAnsweredDuel = false;
let penanceSpinning = false;
let lastPenanceCount = 0;

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
        penanceCard.style.display = 'block';
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
        fxSkull();
        questionCard.style.display = 'none';
        penanceCard.style.display = 'none';
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
        hasAnsweredDuel = false;
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
        duelOptionsBox.innerHTML = '';
        msg.payload.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option';
            btn.textContent = opt;
            btn.onclick = () => submitDuelAnswer(idx);
            duelOptionsBox.appendChild(btn);
        });
        duelSpectatorNote.textContent = `Rispondi tu contro ${msg.payload.challenger_name}! Chi risponde correttamente prima vince!`;
    } else if (msg.type === 'duel_answer_registered') {
        if (msg.payload.by === 'challenger') {
            duelSpectatorNote.textContent = 'Lo sfidante ha risposto! Sbrigati!';
        }
    } else if (msg.type === 'duel_result') {
        duelResultCard.style.display = 'block';
        Array.from(duelOptionsBox.children).forEach((b, idx) => {
            b.disabled = true;
            if (idx === msg.payload.correct_option) b.style.outline = '3px solid #00e676';
        });
        duelResultBanner.className = 'winner-banner';
        if (msg.payload.outcome === 'boss') {
            duelResultBanner.style.background = '';
            duelResultBanner.textContent = 'Hai risposto prima tu! Nessun danno!';
            fxFire();
            fxPhotoFlash('win', 'Hai vinto lo scontro!');
        } else if (msg.payload.outcome === 'challenger') {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = `${msg.payload.winner_name} e' stato piu' veloce! Hai subito ${msg.payload.damage} danni!`;
            pulseShake(bossPortrait);
            pulseHpFlash(hpBar, hpBarWrap, 'damage');
            fxVoid();
            fxPhotoFlash('lose', 'Hai perso lo scontro!');
        } else if (msg.payload.outcome === 'timeout') {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Tempo scaduto per entrambi, sei salva!';
            fxVoid();
        } else {
            duelResultBanner.style.background = 'linear-gradient(135deg, #666, #333)';
            duelResultBanner.textContent = 'Nessuno ha risposto correttamente, sei salva!';
            fxVoid();
        }
    } else if (msg.type === 'duel_cancelled') {
        hideDuelScreen();
        penanceCard.style.display = 'block';
        statusLine.textContent = 'Scontro diretto annullato dalla regia.';
    } else if (msg.type === 'return_home') {
        hideDuelScreen();
        penanceCard.style.display = 'block';
        statusLine.textContent = 'Scontro terminato! Gira la ruota delle penitenze o aspetta la prossima domanda dalla regia.';
    } else if (msg.type === 'penance_spin') {
        penanceSpinning = true;
        penanceSpinBtn.disabled = true;
        penanceRevealCard.style.display = 'none';
        penanceWheelWrap.style.display = 'block';
        lastPenanceCount = msg.payload.count;
        buildPenanceWheel(penanceWheelWrap, msg.payload.count);
        spinPenanceWheelTo(penanceWheelWrap, msg.payload.count, msg.payload.index);
        penanceStatusLine.textContent = 'La ruota gira...';
    } else if (msg.type === 'penance_result') {
        penanceSpinning = false;
        penanceWheelWrap.style.display = 'none';
        penanceRevealCard.style.display = 'block';
        penanceRevealText.textContent = msg.payload.text;
        penanceRevealHeal.textContent = `+${msg.payload.heal} HP! Penitenze rimaste: ${msg.payload.remaining}`;
        pulseHeal(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'heal');
    } else if (msg.type === 'penance_denied') {
        penanceStatusLine.textContent = msg.payload.remaining <= 0
            ? 'Hai finito le penitenze disponibili.'
            : 'Non puoi girare la ruota delle penitenze in questo momento.';
    } else if (msg.type === 'state') {
        const pct = Math.max(0, Math.min(100, (msg.payload.hp / msg.payload.max_hp) * 100));
        hpBar.style.width = pct + '%';
        hpLabel.textContent = `HP ${msg.payload.hp}/${msg.payload.max_hp}`;
        lastPenanceCount = msg.payload.penance_count;
        const canSpinPenance = !penanceSpinning
            && msg.payload.penance_remaining > 0
            && !['duel_wheel', 'duel_challenge', 'game_over'].includes(msg.payload.phase);
        penanceSpinBtn.disabled = !canSpinPenance;
        penanceSpinBtn.textContent = `Gira la ruota delle penitenze (rimaste: ${msg.payload.penance_remaining})`;
        if (msg.payload.phase === 'game_over') {
            statusLine.textContent = 'Sei stata sconfitta! Complimenti alla laurea!';
            questionCard.style.display = 'none';
            hideDuelScreen();
        }
    } else if (msg.type === 'boss_hit') {
        statusLine.textContent = `Hai subito ${msg.payload.amount} danni!`;
        pulseShake(bossPortrait);
        pulseHpFlash(hpBar, hpBarWrap, 'damage');
    } else if (msg.type === 'reset') {
        questionCard.style.display = 'none';
        hideDuelScreen();
        penanceCard.style.display = 'block';
        penanceRevealCard.style.display = 'none';
        penanceWheelWrap.style.display = 'none';
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

function submitDuelAnswer(idx) {
    if (hasAnsweredDuel) return;
    hasAnsweredDuel = true;
    Array.from(duelOptionsBox.children).forEach(b => b.disabled = true);
    ws.send(JSON.stringify({ type: 'duel_answer', choice: idx }));
    duelSpectatorNote.textContent = 'Risposta inviata! Aspettiamo l\'esito...';
}

spinBtn.onclick = () => {
    spinBtn.disabled = true;
    ws.send(JSON.stringify({ type: 'spin_wheel' }));
};

penanceSpinBtn.onclick = () => {
    penanceSpinBtn.disabled = true;
    ws.send(JSON.stringify({ type: 'spin_penance' }));
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
