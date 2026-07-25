// Rivelazione progressiva della locandina: parte pixellata/sporca e si "pulisce" a scatti,
// restando ferma su ogni livello di sgranatura per qualche secondo prima di passare al
// successivo (non un'animazione continua) - identica per boss, invitati e regia.

const POSTER_LEVELS = [
    { pixels: 6, hold: 2800 },
    { pixels: 10, hold: 2500 },
    { pixels: 16, hold: 2300 },
    { pixels: 26, hold: 2100 },
    { pixels: 42, hold: 2000 },
    { pixels: 68, hold: 1900 },
    { pixels: 110, hold: 1800 },
    { pixels: 180, hold: 1800 },
    // dopo l'ultimo livello resta a piena risoluzione fino alla fine dello scontro
];

function startPosterReveal(canvasEl, imageUrl) {
    let cancelled = false;
    let finished = false;
    const img = new Image();
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    let timeoutId = null;

    function drawFull() {
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
    }

    function drawAtPixelSize(pixelW) {
        const pixelH = Math.max(1, Math.round(pixelW * (h / w)));
        tempCanvas.width = pixelW;
        tempCanvas.height = pixelH;
        tempCtx.drawImage(img, 0, 0, pixelW, pixelH);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tempCanvas, 0, 0, pixelW, pixelH, 0, 0, w, h);
    }

    img.onload = () => {
        if (cancelled) return;
        if (finished) {
            drawFull();
            return;
        }
        let levelIndex = 0;

        function showNextLevel() {
            if (cancelled) return;
            if (finished) {
                drawFull();
                return;
            }
            if (levelIndex >= POSTER_LEVELS.length) {
                drawFull();
                return;
            }
            const level = POSTER_LEVELS[levelIndex];
            drawAtPixelSize(level.pixels);
            levelIndex += 1;
            timeoutId = setTimeout(showNextLevel, level.hold);
        }
        showNextLevel();
    };
    img.src = imageUrl;

    return {
        cancel: () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        },
        finish: () => {
            finished = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (img.complete && img.naturalWidth > 0) drawFull();
        },
    };
}
