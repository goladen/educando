// ─── Shared constants & audio utilities for MusicApp ────────────────────────

export const PASOS = 16;

export const NOTAS = [
    { nombre: 'Do',  freq: 261.63, color: '#ef4444' },
    { nombre: 'Re',  freq: 293.66, color: '#f97316' },
    { nombre: 'Mi',  freq: 329.63, color: '#eab308' },
    { nombre: 'Fa',  freq: 349.23, color: '#22c55e' },
    { nombre: 'Sol', freq: 392.00, color: '#3b82f6' },
    { nombre: 'La',  freq: 440.00, color: '#8b5cf6' },
    { nombre: 'Si',  freq: 493.88, color: '#ec4899' },
];

// Staff SVG: 5 lines at y = 20,32,44,56,68  (spacing = 12px)
export const NOTAS_STAFF = [
    { nombre: 'Do',  y: 80, ledger: true  },
    { nombre: 'Re',  y: 74, ledger: false },
    { nombre: 'Mi',  y: 68, ledger: false },
    { nombre: 'Fa',  y: 62, ledger: false },
    { nombre: 'Sol', y: 56, ledger: false },
    { nombre: 'La',  y: 50, ledger: false },
    { nombre: 'Si',  y: 44, ledger: false },
];

// ─── Live AudioContext ───────────────────────────────────────────────────────

let _ctx = null;
function getCtx() {
    if (!_ctx || _ctx.state === 'closed') _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}

export function playTone(freq, dur = 0.35, type = 'triangle', vol = 0.3) {
    try {
        const ctx = getCtx();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = type;
        o.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + dur + 0.05);
    } catch (_) {}
}

export function playNoise(dur = 0.12, vol = 0.3) {
    try {
        const ctx = getCtx();
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g   = ctx.createGain();
        src.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        src.start(ctx.currentTime);
    } catch (_) {}
}

// ─── Instruments (live + offline via shared scheduler) ───────────────────────

export const INSTRUMENTOS_SEQ = [
    { nombre: 'Bombo',  emoji: '🥁', color: '#ef4444', play: () => playTone(55,  0.45, 'sine',     0.65) },
    { nombre: 'Caja',   emoji: '🪘', color: '#f97316', play: () => playNoise(0.16, 0.38) },
    { nombre: 'Hi-hat', emoji: '🎵', color: '#eab308', play: () => playTone(1000, 0.045, 'square', 0.14) },
    { nombre: 'Pluck',  emoji: '🎸', color: '#3b82f6', play: () => playTone(440,  0.28, 'triangle', 0.26) },
];

// Works with both live AudioContext and OfflineAudioContext
export function scheduleInstrumento(ctx, instrIdx, t) {
    switch (instrIdx) {
        case 0: { // Bombo
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(80, t);
            o.frequency.exponentialRampToValueAtTime(28, t + 0.35);
            g.gain.setValueAtTime(0.9, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
            o.start(t); o.stop(t + 0.46);
            break;
        }
        case 1: { // Caja
            const size = Math.ceil(ctx.sampleRate * 0.16);
            const n    = ctx.createBuffer(1, size, ctx.sampleRate);
            const d    = n.getChannelData(0);
            for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * 0.8;
            const s = ctx.createBufferSource(); s.buffer = n;
            const g = ctx.createGain();
            s.connect(g); g.connect(ctx.destination);
            g.gain.setValueAtTime(0.5, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            s.start(t);
            break;
        }
        case 2: { // Hi-hat
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(1200, t);
            g.gain.setValueAtTime(0.18, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            o.start(t); o.stop(t + 0.06);
            break;
        }
        case 3: { // Pluck
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'triangle';
            o.frequency.setValueAtTime(440, t);
            g.gain.setValueAtTime(0.4, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            o.start(t); o.stop(t + 0.32);
            break;
        }
        default: break;
    }
}

// ─── WAV export ──────────────────────────────────────────────────────────────

export async function exportarWav(grid, bpm, repeticiones = 4) {
    const msPerPaso     = 60000 / bpm / 4;
    const totalPasos    = PASOS * repeticiones;
    const totalSegundos = (totalPasos * msPerPaso) / 1000;
    const sampleRate    = 44100;

    const offCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * totalSegundos), sampleRate);

    for (let rep = 0; rep < repeticiones; rep++) {
        for (let paso = 0; paso < PASOS; paso++) {
            const t = ((rep * PASOS + paso) * msPerPaso) / 1000;
            grid.forEach((fila, i) => { if (fila[paso]) scheduleInstrumento(offCtx, i, t); });
        }
    }

    const audioBuffer = await offCtx.startRendering();
    return audioBufferToWav(audioBuffer);
}

function audioBufferToWav(buf) {
    const ch  = buf.getChannelData(0);
    const n   = ch.length;
    const view = new DataView(new ArrayBuffer(44 + n * 2));
    const str  = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

    str(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true);
    str(8, 'WAVE'); str(12, 'fmt ');
    view.setUint32(16, 16, true);  view.setUint16(20, 1, true);  view.setUint16(22, 1, true);
    view.setUint32(24, 44100, true); view.setUint32(28, 88200, true);
    view.setUint16(32, 2, true);   view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, n * 2, true);

    for (let i = 0; i < n; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
    }
    return new Blob([view], { type: 'audio/wav' });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const genCodigo = () => Math.random().toString(36).slice(2, 7).toUpperCase();

export const gridVacio = () => INSTRUMENTOS_SEQ.map(() => Array(PASOS).fill(false));
