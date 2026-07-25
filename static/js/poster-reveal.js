// Rivelazione progressiva della locandina: parte pixellata/sporca e si "pulisce"
// molto lentamente fino a diventare nitida, per dare tempo a tutti di provare a indovinare.

const POSTER_REVEAL_MS = 17000; // deve restare ben sotto DUEL_TIMEOUT_SECONDS (20s) lato server
const POSTER_MIN_PIXELS = 6; // dimensione del mosaico all'inizio (molto blocchi grandi)

// t in [0,1] -> quanto e' avanzata la rivelazione. Cresce lentamente all'inizio
// e accelera verso la fine, cosi' la locandina resta poco chiara per la maggior
// parte del tempo e si svela solo negli ultimi secondi.
function _posterRevealEase(t) {
    return Math.pow(t, 2.2);
}

function startPosterReveal(canvasEl, imageUrl, durationMs = POSTER_REVEAL_MS) {
    let cancelled = false;
    let finished = false;
    const img = new Image();
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;

    function drawFull() {
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
    }

    img.onload = () => {
        if (cancelled) return;
        if (finished) {
            drawFull();
            return;
        }
        const maxPixels = w;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const startTime = performance.now();

        function frame() {
            if (cancelled) return;
            if (finished) {
                drawFull();
                return;
            }
            const elapsed = performance.now() - startTime;
            const t = Math.min(1, elapsed / durationMs);
            const eased = _posterRevealEase(t);
            const pixelW = Math.max(POSTER_MIN_PIXELS, Math.round(POSTER_MIN_PIXELS + eased * (maxPixels - POSTER_MIN_PIXELS)));
            const pixelH = Math.max(1, Math.round(pixelW * (h / w)));

            tempCanvas.width = pixelW;
            tempCanvas.height = pixelH;
            tempCtx.drawImage(img, 0, 0, pixelW, pixelH);

            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(tempCanvas, 0, 0, pixelW, pixelH, 0, 0, w, h);

            if (t < 1) {
                requestAnimationFrame(frame);
            }
        }
        requestAnimationFrame(frame);
    };
    img.src = imageUrl;

    return {
        cancel: () => { cancelled = true; },
        finish: () => {
            finished = true;
            if (img.complete && img.naturalWidth > 0) drawFull();
        },
    };
}
