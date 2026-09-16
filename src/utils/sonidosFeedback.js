// Sonidos de feedback (acierto / fallo / pasar / fin) con Web Audio API.
// Sin ficheros de audio: se sintetizan al vuelo, así no pesan en el bundle.
// El silencio se guarda en localStorage y es común a todos los juegos.

const KEY = 'pikt_sonido';

export const sonidoActivo = () => {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
};

export const setSonidoActivo = (activo) => {
    try { localStorage.setItem(KEY, activo ? 'on' : 'off'); } catch { /* sin localStorage */ }
    return activo;
};

// Un único AudioContext compartido por toda la app (igual que en Ahorcado).
const ctx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
    if (window.gameAudioCtx.state === 'suspended') window.gameAudioCtx.resume();
    return window.gameAudioCtx;
};

// Los navegadores exigen un gesto del usuario antes de sonar: llamar a esto en
// el primer click/tecla despierta el contexto.
export const despertarAudio = () => { try { ctx(); } catch { /* ignorar */ } };

const tono = (freq, { tipo = 'sine', dur = 0.14, vol = 0.12, delay = 0, freqFin = null } = {}) => {
    try {
        const a = ctx();
        if (!a) return;
        const t = a.currentTime + delay;
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = tipo;
        o.frequency.setValueAtTime(freq, t);
        if (freqFin) o.frequency.exponentialRampToValueAtTime(freqFin, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(a.destination);
        o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio no disponible */ }
};

/** Acierto: dos notas ascendentes alegres. */
export const sonidoCorrecto = () => {
    if (!sonidoActivo()) return;
    tono(660, { tipo: 'sine', dur: 0.12, vol: 0.13 });
    tono(880, { tipo: 'sine', dur: 0.18, vol: 0.13, delay: 0.09 });
};

/** Fallo: zumbido grave corto. */
export const sonidoIncorrecto = () => {
    if (!sonidoActivo()) return;
    tono(200, { tipo: 'sawtooth', dur: 0.22, vol: 0.1, freqFin: 120 });
};

/** Pasar / ver la solución: nota neutra. */
export const sonidoPasar = () => {
    if (!sonidoActivo()) return;
    tono(420, { tipo: 'triangle', dur: 0.16, vol: 0.09 });
};

/** Fin de partida: arpegio de victoria. */
export const sonidoFinal = () => {
    if (!sonidoActivo()) return;
    [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.39]].forEach(([f, d]) =>
        tono(f, { tipo: 'triangle', dur: d === 0.39 ? 0.45 : 0.16, vol: 0.11, delay: d }));
};
