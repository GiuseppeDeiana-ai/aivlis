// Classifica condivisa: medaglie per il podio, barre colorate proporzionali al punteggio,
// e un flash quando il punteggio di qualcuno sale.

const _lbPrevScores = {};

function renderLeaderboard(container, rows) {
    const maxScore = Math.max(1, ...rows.map((r) => r.score));
    container.innerHTML = '';
    rows.forEach((row, i) => {
        const rank = i + 1;
        const rankClass = rank <= 3 ? `lb-rank-${rank}` : 'lb-rank-other';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
        const pct = Math.max(6, Math.round((row.score / maxScore) * 100));

        const div = document.createElement('div');
        div.className = `lb-row ${rankClass}`;
        div.innerHTML = `
            <span class="lb-medal">${medal}</span>
            <span class="lb-name">${row.name}</span>
            <div class="lb-bar-wrap"><div class="lb-bar" style="width:${pct}%"></div></div>
            <span class="lb-score">${row.score}</span>
        `;

        const prev = _lbPrevScores[row.name];
        if (prev !== undefined && row.score > prev) {
            div.classList.add('lb-flash');
            setTimeout(() => div.classList.remove('lb-flash'), 900);
        }
        _lbPrevScores[row.name] = row.score;

        container.appendChild(div);
    });
}
