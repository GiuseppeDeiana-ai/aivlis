// Ruote condivise (scontro diretto a 4 categorie + ruota delle penitenze a N segmenti).
// La durata della rotazione (3s) deve corrispondere a WHEEL_SPIN_SECONDS in main.py
// cosi' tutti i dispositivi mostrano la ruota fermarsi nello stesso istante.

const WHEEL_CATEGORIES = [
    { key: "musica", label: "MUSICA", color: "#ff4e50" },
    { key: "film", label: "FILM", color: "#f9d423" },
    { key: "videogioco", label: "VIDEOGIOCO", color: "#6a3df0" },
    { key: "data", label: "DATA", color: "#00c9a7" },
];

const WHEEL_PALETTE = ["#ff4e50", "#f9d423", "#6a3df0", "#00c9a7", "#00b4d8", "#f77f00", "#e63946", "#43aa8b"];

const WHEEL_SPIN_SECONDS_JS = 3;
const WHEEL_EXTRA_SPINS = 5;

function buildWheelGeneric(container, count, colorFn, labelFn) {
    const segment = 360 / count;
    const gradientParts = [];
    const labels = [];
    for (let i = 0; i < count; i++) {
        gradientParts.push(`${colorFn(i)} ${i * segment}deg ${(i + 1) * segment}deg`);
        const mid = i * segment + segment / 2;
        labels.push(`<div class="wheel-label" style="transform: rotate(${mid}deg) translate(0,-98px) rotate(90deg)">${labelFn(i)}</div>`);
    }
    container.innerHTML = `
        <div class="wheel-pointer"></div>
        <div class="wheel-disc" id="wheelDiscInner" style="background: conic-gradient(${gradientParts.join(",")});">
            ${labels.join("")}
        </div>
    `;
    const disc = container.querySelector("#wheelDiscInner");
    disc.style.transition = "none";
    disc.style.transform = "rotate(0deg)";
}

function angleForIndexGeneric(count, index) {
    const segment = 360 / count;
    const center = index * segment + segment / 2;
    return WHEEL_EXTRA_SPINS * 360 + (360 - center);
}

function spinWheelToIndexGeneric(container, count, index) {
    const disc = container.querySelector("#wheelDiscInner");
    if (!disc) return;
    const deg = angleForIndexGeneric(count, index);
    disc.style.transition = `transform ${WHEEL_SPIN_SECONDS_JS}s cubic-bezier(0.22, 0.61, 0.36, 1)`;
    disc.style.transform = `rotate(${deg}deg)`;
}

// ---- ruota dello scontro diretto (4 categorie fisse) ----

function buildWheel(container) {
    buildWheelGeneric(
        container,
        WHEEL_CATEGORIES.length,
        (i) => WHEEL_CATEGORIES[i].color,
        (i) => WHEEL_CATEGORIES[i].label
    );
}

function angleForCategory(categoryKey) {
    const idx = WHEEL_CATEGORIES.findIndex((c) => c.key === categoryKey);
    return angleForIndexGeneric(WHEEL_CATEGORIES.length, idx);
}

function spinWheelTo(container, categoryKey) {
    const idx = WHEEL_CATEGORIES.findIndex((c) => c.key === categoryKey);
    spinWheelToIndexGeneric(container, WHEEL_CATEGORIES.length, idx);
}

function categoryLabel(categoryKey) {
    const c = WHEEL_CATEGORIES.find((c) => c.key === categoryKey);
    return c ? c.label : categoryKey;
}

// ---- ruota delle penitenze (N segmenti numerati, il testo si rivela dopo lo spin) ----

function buildPenanceWheel(container, count) {
    buildWheelGeneric(
        container,
        count,
        (i) => WHEEL_PALETTE[i % WHEEL_PALETTE.length],
        (i) => `${i + 1}`
    );
}

function spinPenanceWheelTo(container, count, index) {
    spinWheelToIndexGeneric(container, count, index);
}
