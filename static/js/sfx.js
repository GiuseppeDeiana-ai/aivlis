// Effetti sonori sintetizzati via Web Audio API: nessun file audio esterno, quindi nessun
// problema di copyright. Pensati per essere usati SOLO dal dispositivo della regia (che e'
// collegato alle casse della festa) cosi' non si sovrappongono decine di telefoni.

let sfxCtx = null;

function sfxUnlock() {
    if (!sfxCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        sfxCtx = new Ctx();
    }
    if (sfxCtx.state === "suspended") sfxCtx.resume();
}

function sfxThump(time, freq, duration, volume = 0.9) {
    if (!sfxCtx) return;
    const osc = sfxCtx.createOscillator();
    const gain = sfxCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(sfxCtx.destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
}

function sfxDrumroll() {
    if (!sfxCtx) return;
    const now = sfxCtx.currentTime;
    const hits = 10;
    for (let i = 0; i < hits; i++) {
        sfxThump(now + i * 0.09, 95, 0.1, 0.5);
    }
}

function sfxExplosion() {
    if (!sfxCtx) return;
    const now = sfxCtx.currentTime;
    const bufferSize = Math.floor(sfxCtx.sampleRate * 0.6);
    const buffer = sfxCtx.createBuffer(1, bufferSize, sfxCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = sfxCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = sfxCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    const gain = sfxCtx.createGain();
    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxCtx.destination);
    noise.start(now);
    sfxThump(now, 55, 0.4, 0.8);
}

function sfxVictorySting() {
    if (!sfxCtx) return;
    const now = sfxCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // Do-Mi-Sol-Do
    notes.forEach((freq, i) => {
        const t = now + i * 0.12;
        const osc = sfxCtx.createOscillator();
        const gain = sfxCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.connect(gain);
        gain.connect(sfxCtx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
    });
}

function sfxPlay(kind) {
    if (!sfxCtx) return;
    if (kind === "drumroll") sfxDrumroll();
    else if (kind === "explosion") sfxExplosion();
    else if (kind === "sting") sfxVictorySting();
}

let sfxHeartbeatInterval = null;

function sfxStartHeartbeat() {
    if (sfxHeartbeatInterval || !sfxCtx) return;
    sfxHeartbeatInterval = setInterval(() => {
        const now = sfxCtx.currentTime;
        sfxThump(now, 62, 0.16, 0.6);
        sfxThump(now + 0.2, 48, 0.18, 0.6);
    }, 1100);
}

function sfxStopHeartbeat() {
    if (sfxHeartbeatInterval) {
        clearInterval(sfxHeartbeatInterval);
        sfxHeartbeatInterval = null;
    }
}
