// Ruota condivisa delle 4 categorie dello scontro diretto.
// La durata della rotazione (3s) deve corrispondere a WHEEL_SPIN_SECONDS in main.py
// cosi' tutti i dispositivi mostrano la ruota fermarsi nello stesso istante.

const WHEEL_CATEGORIES = [
    { key: "musica", label: "MUSICA", color: "#ff4e50" },
    { key: "film", label: "FILM", color: "#f9d423" },
    { key: "videogioco", label: "VIDEOGIOCO", color: "#6a3df0" },
    { key: "data", label: "DATA", color: "#00c9a7" },
];

const WHEEL_SPIN_SECONDS_JS = 3;
const WHEEL_EXTRA_SPINS = 5;

function buildWheel(container) {
    const n = WHEEL_CATEGORIES.length;
    const segment = 360 / n;
    const gradientParts = WHEEL_CATEGORIES.map((c, i) => `${c.color} ${i * segment}deg ${(i + 1) * segment}deg`);

    container.innerHTML = `
        <div class="wheel-pointer"></div>
        <div class="wheel-disc" id="wheelDiscInner" style="background: conic-gradient(${gradientParts.join(",")});">
            ${WHEEL_CATEGORIES.map((c, i) => {
                const mid = i * segment + segment / 2;
                return `<div class="wheel-label" style="transform: rotate(${mid}deg) translate(0,-98px) rotate(90deg)">${c.label}</div>`;
            }).join("")}
        </div>
    `;
    const disc = container.querySelector("#wheelDiscInner");
    disc.style.transition = "none";
    disc.style.transform = "rotate(0deg)";
}

function angleForCategory(categoryKey) {
    const n = WHEEL_CATEGORIES.length;
    const segment = 360 / n;
    const idx = WHEEL_CATEGORIES.findIndex((c) => c.key === categoryKey);
    const center = idx * segment + segment / 2;
    return WHEEL_EXTRA_SPINS * 360 + (360 - center);
}

function spinWheelTo(container, categoryKey) {
    const disc = container.querySelector("#wheelDiscInner");
    if (!disc) return;
    const deg = angleForCategory(categoryKey);
    disc.style.transition = `transform ${WHEEL_SPIN_SECONDS_JS}s cubic-bezier(0.22, 0.61, 0.36, 1)`;
    disc.style.transform = `rotate(${deg}deg)`;
}

function categoryLabel(categoryKey) {
    const c = WHEEL_CATEGORIES.find((c) => c.key === categoryKey);
    return c ? c.label : categoryKey;
}
