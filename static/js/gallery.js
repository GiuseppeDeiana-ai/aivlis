// Galleria delle foto epiche della festeggiata, usate come ritratto del "boss".
// La prima immagine (il draghetto) e' il ritratto principale del boss finale.

const BOSS_GALLERY = [
    "/resources/silvia_drago3.png",
    "/resources/silvia_drago1.png",
    "/resources/silvia_pirata1.png",
    "/resources/silvia_interstellar1.png",
    "/resources/silvia_drago2.png",
    "/resources/silvia_interstellar2.png",
    "/resources/silvia_pirata2.png",
    "/resources/silvia_drago4.png",
    "/resources/silvia_interstellar3.png",
];

function startPortraitRotation(imgEl, intervalMs = 6000) {
    if (!imgEl) return;
    let idx = 0;
    const showNext = () => {
        imgEl.classList.remove("loaded");
        setTimeout(() => {
            idx = (idx + 1) % BOSS_GALLERY.length;
            imgEl.src = BOSS_GALLERY[idx];
        }, 350);
    };
    imgEl.onload = () => imgEl.classList.add("loaded");
    imgEl.src = BOSS_GALLERY[0];
    setInterval(showNext, intervalMs);
}

function pulseShake(el, durationMs = 600) {
    if (!el) return;
    el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), durationMs);
}

function pulseHeal(el, durationMs = 900) {
    if (!el) return;
    el.classList.add("heal-glow");
    setTimeout(() => el.classList.remove("heal-glow"), durationMs);
}

function pulseHpFlash(hpBarEl, hpWrapEl, kind, durationMs = 600) {
    if (hpBarEl) {
        hpBarEl.classList.add(kind === "heal" ? "heal-flash" : "flash");
        setTimeout(() => hpBarEl.classList.remove(kind === "heal" ? "heal-flash" : "flash"), durationMs);
    }
    if (hpWrapEl) {
        hpWrapEl.classList.add(kind === "heal" ? "heal-wrap-glow" : "hit-wrap-glow");
        setTimeout(() => hpWrapEl.classList.remove(kind === "heal" ? "heal-wrap-glow" : "hit-wrap-glow"), durationMs);
    }
}
