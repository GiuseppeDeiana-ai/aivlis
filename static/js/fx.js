// Effetti speciali a schermo intero: fuoco di drago (corretto/vittoria),
// vortice buco nero stile Interstellar (sbagliato/sconfitta), teschio pirata (inizio scontro).
// Usa solo CSS + le foto di Silvia in resources/, nessun asset esterno da internet.

const FX_WIN_PHOTOS = ["/resources/silvia_drago4.png", "/resources/silvia_pirata2.png", "/resources/silvia_interstellar3.png"];
const FX_LOSE_PHOTOS = ["/resources/silvia_drago1.png", "/resources/silvia_interstellar2.png"];

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

function fxFire(count = 18) {
    const overlay = fxOverlay();
    for (let i = 0; i < count; i++) {
        const span = document.createElement("span");
        span.className = "fx-particle";
        span.textContent = Math.random() > 0.5 ? "🔥" : "✨";
        const angle = Math.random() * Math.PI * 2;
        const dist = 110 + Math.random() * 170;
        span.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
        span.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
        span.style.left = `${45 + Math.random() * 10}%`;
        span.style.top = `${45 + Math.random() * 10}%`;
        span.style.animationDuration = `${0.7 + Math.random() * 0.5}s`;
        overlay.appendChild(span);
        setTimeout(() => span.remove(), 1300);
    }
}

function fxVoid() {
    const overlay = fxOverlay();
    const div = document.createElement("div");
    div.className = "fx-void";
    overlay.appendChild(div);
    setTimeout(() => div.remove(), 1200);
}

function fxSkull() {
    const overlay = fxOverlay();
    const div = document.createElement("div");
    div.className = "fx-skull";
    div.textContent = "☠️";
    overlay.appendChild(div);
    setTimeout(() => div.remove(), 1200);
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
