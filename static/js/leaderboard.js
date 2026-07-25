// Classifica condivisa: medaglie per il podio, avatar circolari, barre colorate proporzionali
// al punteggio, un flash quando il punteggio di qualcuno sale, e la propria riga evidenziata
// (solo per gli invitati, che passano il proprio guest_id come highlightId).

const _lbPrevScores = {};

function renderLeaderboard(container, rows, highlightId) {
    const maxScore = Math.max(1, ...rows.map((r) => r.score));
    container.innerHTML = '';
    rows.forEach((row, i) => {
        const rank = i + 1;
        const rankClass = rank <= 3 ? `lb-rank-${rank}` : 'lb-rank-other';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
        const pct = Math.max(6, Math.round((row.score / maxScore) * 100));

        const div = document.createElement('div');
        div.className = `lb-row ${rankClass}`;
        if (highlightId && row.id === highlightId) div.classList.add('lb-row-you');

        const medalEl = document.createElement('span');
        medalEl.className = 'lb-medal';
        medalEl.textContent = medal;

        const avatarEl = document.createElement('span');
        avatarEl.className = 'lb-avatar';
        if (row.avatar) {
            const img = document.createElement('img');
            img.src = row.avatar;
            img.alt = '';
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = '🙂';
        }

        const nameEl = document.createElement('span');
        nameEl.className = 'lb-name';
        nameEl.textContent = row.name;

        const barWrap = document.createElement('div');
        barWrap.className = 'lb-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'lb-bar';
        bar.style.width = `${pct}%`;
        barWrap.appendChild(bar);

        const scoreEl = document.createElement('span');
        scoreEl.className = 'lb-score';
        scoreEl.textContent = row.score;

        div.appendChild(medalEl);
        div.appendChild(avatarEl);
        div.appendChild(nameEl);
        div.appendChild(barWrap);
        div.appendChild(scoreEl);

        const key = row.id || row.name;
        const prev = _lbPrevScores[key];
        if (prev !== undefined && row.score > prev) {
            div.classList.add('lb-flash');
            setTimeout(() => div.classList.remove('lb-flash'), 900);
        }
        _lbPrevScores[key] = row.score;

        container.appendChild(div);
    });
}
