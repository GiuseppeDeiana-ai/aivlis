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
