// Avisos sonoros y música sintetizada para las dinámicas de aula (Web Audio, sin ficheros).
// Respeta el silencio global de PiKT (pikt_sonido, utils/sonidosFeedback.js).
import { sonidoActivo } from '../utils/sonidosFeedback';

const ctx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
    if (window.gameAudioCtx.state === 'suspended') window.gameAudioCtx.resume();
    return window.gameAudioCtx;
};

export const despertar = () => { try { ctx(); } catch { /* sin audio */ } };

function tono(freq, { dur = 0.15, tipo = 'sine', vol = 0.15, delay = 0, freqFin = null } = {}) {
    if (!sonidoActivo()) return;
    try {
        const a = ctx(); if (!a) return;
        const t = a.currentTime + delay;
        const o = a.createOscillator(); const g = a.createGain();
        o.type = tipo; o.frequency.setValueAtTime(freq, t);
        if (freqFin) o.frequency.exponentialRampToValueAtTime(freqFin, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(a.destination);
        o.start(t); o.stop(t + dur + 0.05);
    } catch { /* ignorar */ }
}

let bufferRuido = null;
function ruido({ dur = 0.3, vol = 0.2, delay = 0, filtro = 1200, tipoFiltro = 'lowpass' } = {}) {
    if (!sonidoActivo()) return;
    try {
        const a = ctx(); if (!a) return;
        if (!bufferRuido) {
            bufferRuido = a.createBuffer(1, a.sampleRate, a.sampleRate);
            const d = bufferRuido.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const t = a.currentTime + delay;
        const s = a.createBufferSource(); s.buffer = bufferRuido;
        const f = a.createBiquadFilter(); f.type = tipoFiltro; f.frequency.value = filtro;
        const g = a.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(a.destination);
        s.start(t); s.stop(t + dur + 0.05);
    } catch { /* ignorar */ }
}

export const tic = () => tono(1000, { dur: 0.06, tipo: 'square', vol: 0.06 });
export const pitido = () => tono(880, { dur: 0.18, tipo: 'square', vol: 0.09 });
export const inicio = () => { tono(523, { dur: 0.12, vol: 0.14 }); tono(784, { dur: 0.2, vol: 0.14, delay: 0.12 }); };
export const finTiempo = () => [0, 0.2, 0.4].forEach((d, i) => tono(660 + i * 220, { dur: 0.18, tipo: 'square', vol: 0.1, delay: d }));
export const alarma = () => { for (let i = 0; i < 6; i++) tono(i % 2 ? 520 : 780, { dur: 0.14, tipo: 'sawtooth', vol: 0.08, delay: i * 0.15 }); };
export const acierto = () => [523, 659, 784, 1047].forEach((f, i) => tono(f, { dur: 0.14, tipo: 'triangle', vol: 0.13, delay: i * 0.08 }));
export const fallo = () => { tono(330, { dur: 0.25, tipo: 'sawtooth', vol: 0.08 }); tono(220, { dur: 0.35, tipo: 'sawtooth', vol: 0.08, delay: 0.22 }); };
export const explosion = () => { ruido({ dur: 0.9, vol: 0.45, filtro: 700 }); tono(120, { dur: 0.6, tipo: 'sine', vol: 0.3, freqFin: 30 }); };
export const magia = () => [784, 988, 1175, 1568, 1976].forEach((f, i) => tono(f, { dur: 0.18, tipo: 'sine', vol: 0.09, delay: i * 0.06 }));
export const fanfarria = () => [[523, 0], [523, 0.15], [523, 0.3], [698, 0.45], [880, 0.75], [1047, 1.0]].forEach(([f, d]) => tono(f, { dur: 0.22, tipo: 'square', vol: 0.08, delay: d }));
export const tirarDado = () => { for (let i = 0; i < 8; i++) ruido({ dur: 0.05, vol: 0.15, delay: i * 0.07, filtro: 3000, tipoFiltro: 'bandpass' }); };

// ─────────────────────────── Música para «Baila, para y habla» ───────────────────────────
// Bucle alegre a 124 ppm: bombo, charles, bajo y arpegio pentatónico al azar.
export function crearMusica() {
    let intervalo = null; let master = null; let paso = 0; let proximo = 0;
    const tempo = 124; const semicorchea = 60 / tempo / 4;
    const acordes = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G (MIDI)
    const penta = [69, 72, 74, 76, 79, 81];
    const hz = (m) => 440 * 2 ** ((m - 69) / 12);

    const nota = (a, t, freq, dur, tipo, vol) => {
        const o = a.createOscillator(); const g = a.createGain();
        o.type = tipo; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    };
    const bombo = (a, t) => {
        const o = a.createOscillator(); const g = a.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    };
    const charles = (a, t, vol) => {
        if (!bufferRuido) {
            bufferRuido = a.createBuffer(1, a.sampleRate, a.sampleRate);
            const d = bufferRuido.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const s = a.createBufferSource(); s.buffer = bufferRuido;
        const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06);
    };

    const programar = () => {
        const a = ctx(); if (!a) return;
        while (proximo < a.currentTime + 0.12) {
            const t = proximo; const p = paso % 16; const compas = Math.floor(paso / 16) % 4;
            const [raiz, tercera, quinta] = acordes[compas];
            if (p % 4 === 0) bombo(a, t);
            if (p % 2 === 1) charles(a, t, p % 4 === 3 ? 0.12 : 0.06);
            if ([0, 3, 6, 8, 11, 14].includes(p)) nota(a, t, hz(raiz - 12), semicorchea * 1.8, 'triangle', 0.32);
            if (p % 4 === 2) [raiz, tercera, quinta].forEach(m => nota(a, t, hz(m), semicorchea * 1.2, 'square', 0.025));
            if (p % 2 === 0 && Math.random() < 0.45) nota(a, t, hz(penta[Math.floor(Math.random() * penta.length)]), semicorchea * 1.5, 'sine', 0.1);
            proximo += semicorchea; paso++;
        }
    };

    return {
        start() {
            if (!sonidoActivo()) return;
            const a = ctx(); if (!a || intervalo) return;
            master = a.createGain(); master.gain.value = 0.5; master.connect(a.destination);
            paso = 0; proximo = a.currentTime + 0.05;
            programar();
            intervalo = setInterval(programar, 25);
        },
        stop() {
            if (intervalo) { clearInterval(intervalo); intervalo = null; }
            const a = window.gameAudioCtx;
            if (master && a) {
                const m = master; master = null;
                try { m.gain.setTargetAtTime(0.0001, a.currentTime, 0.03); setTimeout(() => { try { m.disconnect(); } catch { /* */ } }, 400); } catch { /* */ }
            }
        },
    };
}
