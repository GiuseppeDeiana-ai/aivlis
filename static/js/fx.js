// Effetti speciali a schermo intero: fuoco di drago (corretto/vittoria),
// vortice buco nero stile Interstellar (sbagliato/sconfitta), teschio pirata (inizio scontro),
// coriandoli e schermata epica di fine partita. Usa solo CSS + le foto di Silvia in resources/,
// nessun asset esterno da internet.

const FX_WIN_PHOTOS = ["/resources/silvia_drago4.png", "/resources/silvia_pirata2.png", "/resources/silvia_interstellar3.png"];
const FX_LOSE_PHOTOS = ["/resources/silvia_drago1.png", "/resources/silvia_interstellar2.png"];
const FX_CONFETTI_COLORS = ["#f9d423", "#ff4e50", "#6a3df0", "#00c9a7", "#00b4d8", "#43aa8b"];
const FX_CATEGORY_EMOJI = {
    musica: ["🎵", "🎶"],
    film: ["🎬", "🍿"],
    videogioco: ["🎮", "👾"],
    data: ["⏳", "📜"],
    cultura_generale: ["🧠", "📚"],
};

function fxRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function fxOverlay() {
    let el = document.getElementById("fxOverlay");
    if (!el) {
        el = document.createElement("div");
        el.id = "fxOverlay";
        el.className = "fx-overlay";
        document.body.appendChild(el);
    }
    return el;
}

function fxSpawnParticle(overlay, text, originXPct, originYPct, dist, inward, durationS) {
    const span = document.createElement("span");
    span.className = "fx-particle" + (inward ? " fx-particle-in" : "");
    span.textContent = text;
    const angle = Math.random() * Math.PI * 2;
    span.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    span.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    span.style.left = `${originXPct}%`;
    span.style.top = `${originYPct}%`;
    span.style.animationDuration = `${durationS}s`;
    overlay.appendChild(span);
    setTimeout(() => span.remove(), durationS * 1000 + 200);
}

function fxFire(count = 18) {
    const overlay = fxOverlay();
    const pool = ["🔥", "✨", "🐉", "☄️"];
    for (let i = 0; i < count; i++) {
        fxSpawnParticle(
            overlay,
            fxRandom(pool),
            45 + Math.random() * 10,
            45 + Math.random() * 10,
            110 + Math.random() * 170,
            false,
            0.7 + Math.random() * 0.5
        );
    }
}

function fxVoid() {
    const overlay = fxOverlay();
    const div = document.createElement("div");
    div.className = "fx-void";
    overlay.appendChild(div);
    setTimeout(() => div.remove(), 1200);

    const pool = ["🌀", "⭐", "🪐", "💫"];
    for (let i = 0; i < 10; i++) {
        fxSpawnParticle(overlay, fxRandom(pool), 50, 50, 140 + Math.random() * 120, true, 0.8 + Math.random() * 0.4);
    }
}

function fxSkull() {
    const overlay = fxOverlay();
    const div = document.createElement("div");
    div.className = "fx-skull";
    div.textContent = "☠️";
    overlay.appendChild(div);
    setTimeout(() => div.remove(), 1200);
}

function fxThemeParticles(category, count = 10) {
    const overlay = fxOverlay();
    const pool = FX_CATEGORY_EMOJI[category] || ["✨"];
    for (let i = 0; i < count; i++) {
        fxSpawnParticle(
            overlay,
            fxRandom(pool),
            45 + Math.random() * 10,
            35 + Math.random() * 10,
            90 + Math.random() * 140,
            false,
            0.9 + Math.random() * 0.5
        );
    }
}

function fxConfetti(count = 60, durationMs = 3200) {
    const overlay = fxOverlay();
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("div");
        piece.className = "fx-confetti-piece";
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = fxRandom(FX_CONFETTI_COLORS);
        piece.style.animationDuration = `${2 + Math.random() * 1.8}s`;
        piece.style.animationDelay = `${Math.random() * 0.6}s`;
        overlay.appendChild(piece);
        setTimeout(() => piece.remove(), durationMs);
    }
}

function fxScreenShake() {
    document.body.classList.add("screen-shake");
    setTimeout(() => document.body.classList.remove("screen-shake"), 450);
}

function fxPhotoFlash(kind, caption) {
    const overlay = fxOverlay();
    const src = fxRandom(kind === "win" ? FX_WIN_PHOTOS : FX_LOSE_PHOTOS);
    const card = document.createElement("div");
    card.className = "fx-photo-card" + (kind === "win" ? "" : " lose");
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    const cap = document.createElement("div");
    cap.className = "fx-photo-caption";
    cap.textContent = caption;
    card.appendChild(img);
    card.appendChild(cap);
    overlay.appendChild(card);
    setTimeout(() => card.remove(), 2400);
}

function fxEpicEnd(kind, title, caption) {
    const existing = document.getElementById("fxEpicOverlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "fxEpicOverlay";
    overlay.className = "fx-epic-overlay" + (kind === "win" ? "" : " lose");
    const src = fxRandom(kind === "win" ? FX_WIN_PHOTOS : FX_LOSE_PHOTOS);
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    const p = document.createElement("div");
    p.textContent = caption;
    const hint = document.createElement("div");
    hint.className = "fx-epic-hint";
    hint.textContent = "(tocca per chiudere)";
    overlay.appendChild(h2);
    overlay.appendChild(img);
    overlay.appendChild(p);
    overlay.appendChild(hint);
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
    fxConfetti(90, 4000);
    setTimeout(() => overlay.remove(), 9000);
}

function fxCountdown(seconds, label = "") {
    const existing = document.getElementById("fxCountdownEl");
    if (existing) existing.remove();
    const overlay = fxOverlay();
    const div = document.createElement("div");
    div.id = "fxCountdownEl";
    div.className = "fx-countdown";
    overlay.appendChild(div);

    if (label) {
        const lbl = document.createElement("div");
        lbl.className = "fx-countdown-label";
        lbl.textContent = label;
        overlay.appendChild(lbl);
        setTimeout(() => lbl.remove(), seconds * 1000 + 200);
    }

    let n = Math.round(seconds);
    const tick = () => {
        if (n <= 0) {
            div.remove();
            return;
        }
        div.textContent = n;
        div.classList.remove("fx-countdown-pop");
        void div.offsetWidth;
        div.classList.add("fx-countdown-pop");
        n -= 1;
        setTimeout(tick, 1000);
    };
    tick();
}

function startCountdownBar(el, seconds) {
    if (!el) return;
    el.style.animation = "none";
    el.getBoundingClientRect();
    el.style.animation = `duelCountdown ${seconds}s linear forwards`;
}

function stopCountdownBar(el) {
    if (!el) return;
    el.style.animation = "none";
}

function buildEqualizer(count = 7) {
    const wrap = document.createElement("div");
    wrap.className = "equalizer";
    for (let i = 0; i < count; i++) {
        const bar = document.createElement("div");
        bar.className = "eq-bar";
        bar.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;
        bar.style.animationDelay = `${Math.random() * 0.5}s`;
        wrap.appendChild(bar);
    }
    return wrap;
}

function fxVibrate(pattern) {
    if (navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // dispositivo senza supporto reale nonostante l'API esista: si ignora
        }
    }
}

// ---- Numeri fluttuanti (danno/cura) sopra il ritratto del boss ----

function fxFloatNumber(amount, kind = "damage") {
    const portrait = document.getElementById("bossPortrait");
    if (!portrait) return;
    const rect = portrait.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "fx-float-number " + (kind === "heal" ? "fx-float-heal" : "fx-float-damage");
    el.textContent = (kind === "heal" ? "+" : "-") + amount;
    el.style.left = `${rect.left + rect.width * (0.35 + Math.random() * 0.3)}px`;
    el.style.top = `${rect.top + rect.height * 0.4}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ---- Banner "VS" nei duelli: foto sfidante contro foto della festeggiata ----

function fxRenderVsBanner(container, challengerAvatar, bossPhotoSrc) {
    if (!container) return;
    container.innerHTML = '';
    const challengerEl = document.createElement('div');
    challengerEl.className = 'duel-vs-avatar challenger';
    if (challengerAvatar) {
        const img = document.createElement('img');
        img.src = challengerAvatar;
        img.alt = '';
        challengerEl.appendChild(img);
    } else {
        challengerEl.textContent = '🙂';
    }

    const vsText = document.createElement('div');
    vsText.className = 'duel-vs-text';
    vsText.textContent = 'VS';

    const bossEl = document.createElement('div');
    bossEl.className = 'duel-vs-avatar boss';
    if (bossPhotoSrc) {
        const bossImg = document.createElement('img');
        bossImg.src = bossPhotoSrc;
        bossImg.alt = '';
        bossEl.appendChild(bossImg);
    } else {
        bossEl.textContent = '🐉';
    }

    container.appendChild(challengerEl);
    container.appendChild(vsText);
    container.appendChild(bossEl);
}

// ---- Annuncio a meta' vita ----

function fxHalfHpBanner() {
    const existing = document.getElementById("fxHalfHpBanner");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.id = "fxHalfHpBanner";
    div.className = "fx-halfhp-banner";
    div.textContent = "⚠️ LA LAUREATA VACILLA! ⚠️";
    document.body.appendChild(div);
    fxScreenShake();
    setTimeout(() => div.remove(), 2600);
}

// ---- Fase 2: quando la prima barra vita si esaurisce, la festeggiata si trasforma ----

function fxBossPhase2() {
    const existing = document.getElementById("fxPhase2Banner");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.id = "fxPhase2Banner";
    div.className = "fx-phase2-banner";
    div.innerHTML = "😈 FASE 2! 😈<br><span>La festeggiata si è trasformata: nuova barra vita!</span>";
    document.body.appendChild(div);
    fxScreenShake();
    fxConfetti(20);
    setTimeout(() => div.remove(), 3400);
}

// ---- Gran finale: la Laureata sconfitta + rivelazione classifica con suspance ----

const FX_DEFEAT_PHOTO = "/resources/silvia_drago1.png";

function fxExplosions(waves = 5) {
    const overlay = fxOverlay();
    const pool = ["💥", "🔥", "☄️", "💣", "✨"];
    for (let w = 0; w < waves; w++) {
        setTimeout(() => {
            fxScreenShake();
            for (let i = 0; i < 10; i++) {
                fxSpawnParticle(
                    overlay,
                    fxRandom(pool),
                    10 + Math.random() * 80,
                    10 + Math.random() * 70,
                    60 + Math.random() * 130,
                    false,
                    0.7 + Math.random() * 0.5
                );
            }
        }, w * 450);
    }
}

function fxGrandFinale({ onReveal } = {}) {
    const existing = document.getElementById("fxFinaleOverlay");
    if (existing) existing.remove();

    fxExplosions(5);

    setTimeout(() => {
        const overlay = document.createElement("div");
        overlay.id = "fxFinaleOverlay";
        overlay.className = "fx-finale-overlay";

        const title = document.createElement("h2");
        title.className = "fx-finale-title";
        title.textContent = "💥 LA LAUREATA È STATA SCONFITTA! 💥";
        overlay.appendChild(title);

        const img = document.createElement("img");
        img.className = "fx-finale-photo";
        img.src = FX_DEFEAT_PHOTO;
        img.alt = "";
        overlay.appendChild(img);

        if (onReveal) {
            const btn = document.createElement("button");
            btn.className = "primary fx-finale-reveal-btn";
            btn.textContent = "🏆 Rivela la classifica finale";
            btn.onclick = () => {
                btn.disabled = true;
                onReveal();
            };
            overlay.appendChild(btn);
        } else {
            const waiting = document.createElement("div");
            waiting.className = "fx-finale-waiting";
            waiting.textContent = "La regia sta per rivelare la classifica finale... 🥁";
            overlay.appendChild(waiting);
        }

        document.body.appendChild(overlay);
        fxConfetti(70, 3200);
    }, 1400);
}

function fxRevealLeaderboard(leaderboard, awards = [], opts = {}) {
    const playSfx = opts.playSfx;
    const finale = document.getElementById("fxFinaleOverlay");
    if (finale) finale.remove();
    const existingBoard = document.getElementById("fxLeaderboardOverlay");
    if (existingBoard) existingBoard.remove();

    const overlay = document.createElement("div");
    overlay.id = "fxLeaderboardOverlay";
    overlay.className = "fx-leaderboard-overlay";

    const title = document.createElement("h2");
    title.className = "fx-leaderboard-title";
    title.textContent = "🏆 Classifica Finale 🏆";
    overlay.appendChild(title);

    const suspense = document.createElement("div");
    suspense.className = "fx-leaderboard-suspense";
    overlay.appendChild(suspense);

    const awardsList = document.createElement("div");
    awardsList.className = "fx-award-list";
    overlay.appendChild(awardsList);

    const list = document.createElement("div");
    list.className = "fx-leaderboard-list";
    overlay.appendChild(list);

    document.body.appendChild(overlay);

    function pulseSuspense(text) {
        suspense.textContent = text;
        suspense.classList.remove("fx-suspense-pulse");
        void suspense.offsetWidth;
        suspense.classList.add("fx-suspense-pulse");
        if (playSfx) playSfx("drumroll");
    }

    let awardIndex = 0;
    function revealNextAward() {
        if (!awards || awardIndex >= awards.length) {
            startRankingReveal();
            return;
        }
        const award = awards[awardIndex];
        pulseSuspense(`🥁 Premio: ${award.title}...`);
        setTimeout(() => {
            const card = document.createElement("div");
            card.className = "fx-award-card";
            const emoji = document.createElement("div");
            emoji.className = "fx-award-emoji";
            emoji.textContent = award.emoji;
            const titleEl = document.createElement("div");
            titleEl.className = "fx-award-title";
            titleEl.textContent = award.title;
            const nameEl = document.createElement("div");
            nameEl.className = "fx-award-name";
            nameEl.textContent = award.name;
            const detailEl = document.createElement("div");
            detailEl.className = "fx-award-detail";
            detailEl.textContent = award.detail;
            card.appendChild(emoji);
            card.appendChild(titleEl);
            card.appendChild(nameEl);
            card.appendChild(detailEl);
            awardsList.appendChild(card);
            fxConfetti(20, 1800);
            awardIndex += 1;
            setTimeout(revealNextAward, 2200);
        }, 1500);
    }

    function startRankingReveal() {
        if (!leaderboard || leaderboard.length === 0) {
            suspense.textContent = "Nessun punteggio registrato...";
            return;
        }

        const sorted = leaderboard; // gia' ordinata dal server, dal 1 posto in giu'
        const winner = sorted[0];
        const others = sorted.slice(1).reverse(); // dal peggiore (ultimo) al 2 posto

        let index = 0;

        function revealNext() {
            if (index >= others.length) {
                revealWinner();
                return;
            }
            const entry = others[index];
            const rank = sorted.length - index;
            pulseSuspense(`🥁 In posizione ${rank}°...`);
            setTimeout(() => {
                const row = document.createElement("div");
                row.className = "fx-leaderboard-row";
                const rankEl = document.createElement("span");
                rankEl.className = "fx-leaderboard-rank";
                rankEl.textContent = `${rank}°`;
                const nameEl = document.createElement("span");
                nameEl.className = "fx-leaderboard-name";
                nameEl.textContent = entry.name;
                const scoreEl = document.createElement("span");
                scoreEl.className = "fx-leaderboard-score";
                scoreEl.textContent = `${entry.score} pt`;
                row.appendChild(rankEl);
                row.appendChild(nameEl);
                row.appendChild(scoreEl);
                list.appendChild(row);
                fxConfetti(12, 1400);
                index += 1;
                setTimeout(revealNext, 1500);
            }, 1300);
        }

        function revealWinner() {
            pulseSuspense("🥁 E il vincitore della festa è......");
            setTimeout(() => {
                suspense.textContent = "";
                const banner = document.createElement("div");
                banner.className = "fx-winner-banner-epic";
                const crown = document.createElement("div");
                crown.className = "fx-winner-crown";
                crown.textContent = "👑";
                const name = document.createElement("div");
                name.className = "fx-winner-name";
                name.textContent = winner.name;
                const caption = document.createElement("div");
                caption.className = "fx-winner-caption";
                caption.textContent = `Vincitore assoluto con ${winner.score} punti!`;
                banner.appendChild(crown);
                banner.appendChild(name);
                banner.appendChild(caption);
                overlay.appendChild(banner);
                fxConfetti(160, 5000);
                fxFire(30);
                fxScreenShake();
                if (playSfx) playSfx("sting");
            }, 2200);
        }

        revealNext();
    }

    revealNextAward();
}

// ---- Regole "Come si gioca": visibili solo alla primissima connessione di un dispositivo,
// non devono ripresentarsi ad ogni ritorno in lobby (es. dopo un reset a partita in corso) ----

function fxShouldShowRules(roleKey, phase) {
    const key = `rules_seen_${roleKey}`;
    if (phase !== 'lobby') {
        localStorage.setItem(key, '1');
        return false;
    }
    return !localStorage.getItem(key);
}

// ---- Vignetta di tensione durante il conto alla rovescia del duello ----

let fxVignetteTimeout = null;

function fxVignette(seconds) {
    let el = document.getElementById("fxVignetteEl");
    if (!el) {
        el = document.createElement("div");
        el.id = "fxVignetteEl";
        el.className = "fx-vignette";
        document.body.appendChild(el);
    }
    if (fxVignetteTimeout) clearTimeout(fxVignetteTimeout);
    requestAnimationFrame(() => el.classList.add("active"));
    fxVignetteTimeout = setTimeout(() => el.classList.remove("active"), seconds * 1000);
}

// ---- Notifiche istantanee di traguardo (non solo nel gran finale) ----

function fxMilestoneToast(emoji, text) {
    let wrap = document.getElementById("milestoneToastWrap");
    if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "milestoneToastWrap";
        wrap.className = "milestone-toast-wrap";
        document.body.appendChild(wrap);
    }
    const toast = document.createElement("div");
    toast.className = "milestone-toast";
    const emojiEl = document.createElement("span");
    emojiEl.textContent = emoji;
    const textEl = document.createElement("span");
    textEl.textContent = text;
    toast.appendChild(emojiEl);
    toast.appendChild(textEl);
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

// ---- Reazioni live degli spettatori, fluttuanti su tutti gli schermi ----

function fxFloatingReaction(emoji) {
    const el = document.createElement("div");
    el.className = "fx-reaction-float";
    el.textContent = emoji;
    el.style.left = `${10 + Math.random() * 80}%`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
}

// ---- Spotlight su un messaggio della chat (attivato solo dalla regia) ----

function fxChatSpotlight(name, avatar, text) {
    const existing = document.getElementById("fxChatSpotlightEl");
    if (existing) existing.remove();
    const card = document.createElement("div");
    card.id = "fxChatSpotlightEl";
    card.className = "fx-chat-spotlight";

    const avatarEl = document.createElement("div");
    avatarEl.className = "fx-chat-spotlight-avatar";
    if (avatar) {
        const img = document.createElement("img");
        img.src = avatar;
        img.alt = "";
        avatarEl.appendChild(img);
    } else {
        avatarEl.textContent = "🙂";
    }

    const nameEl = document.createElement("div");
    nameEl.className = "fx-chat-spotlight-name";
    nameEl.textContent = name;

    const textEl = document.createElement("div");
    textEl.className = "fx-chat-spotlight-text";
    textEl.textContent = text;

    card.appendChild(avatarEl);
    card.appendChild(nameEl);
    card.appendChild(textEl);
    document.body.appendChild(card);
    fxConfetti(30, 2000);
    setTimeout(() => card.remove(), 5000);
}
