// Schermata di benvenuto spettacolare mostrata prima di tutto il resto (invitati e festeggiata):
// scintille/fuochi ambientali continui via CSS, titolo animato, e un botto di effetti (fx.js)
// quando si tocca il pulsante per entrare. Overlay a schermo intero, non tocca la logica sottostante.

const WELCOME_AMBIENT_EMOJI = ["✨", "🎉", "🔥", "🎓", "⭐", "🎊", "🍾"];

function startWelcomeAmbient(containerEl, count = 22) {
    if (!containerEl) return;
    containerEl.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const span = document.createElement("span");
        span.textContent = WELCOME_AMBIENT_EMOJI[Math.floor(Math.random() * WELCOME_AMBIENT_EMOJI.length)];
        span.style.left = `${Math.random() * 100}%`;
        span.style.setProperty("--drift", `${(Math.random() - 0.5) * 160}px`);
        span.style.animationDuration = `${4 + Math.random() * 4}s`;
        span.style.animationDelay = `${Math.random() * 5}s`;
        span.style.fontSize = `${1.1 + Math.random() * 1.4}rem`;
        containerEl.appendChild(span);
    }
}

function initWelcomeScreen({ welcomeEl, enterBtnEl, ambientEl, portraitImgEl, onEnter }) {
    if (!welcomeEl || !enterBtnEl) return;

    startWelcomeAmbient(ambientEl);
    if (portraitImgEl) startPortraitRotation(portraitImgEl, 3200);

    document.body.style.overflow = "hidden";

    enterBtnEl.onclick = () => {
        if (enterBtnEl.disabled) return;
        enterBtnEl.disabled = true;
        fxConfetti(90, 3600);
        fxFire(24);
        fxScreenShake();
        setTimeout(() => {
            welcomeEl.classList.add("dismissing");
            setTimeout(() => {
                welcomeEl.style.display = "none";
                document.body.style.overflow = "";
                if (onEnter) onEnter();
            }, 650);
        }, 500);
    };
}
