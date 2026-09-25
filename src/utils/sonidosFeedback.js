// Sonidos de feedback (acierto / fallo / pasar / fin) con Web Audio API.
// Sin ficheros de audio: se sintetizan al vuelo, así no pesan en el bundle.
// El silencio se guarda en localStorage y es común a todos los juegos.
//
// Hay VARIOS sonidos a elegir para el acierto y para el fallo (catálogos
// SONIDOS_ACIERTO y SONIDOS_FALLO). Quien no elija nada sigue oyendo el
// "Clásico" de siempre: sonidoCorrecto() / sonidoIncorrecto() sin argumentos
// funcionan igual que antes.

const KEY = 'pikt_sonido';
const KEY_OK = 'pikt_sonido_ok';
const KEY_MAL = 'pikt_sonido_mal';

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

/** Ráfaga de ruido blanco filtrado: sirve para aplausos, cristales y percusión. */
const ruido = ({ dur = 0.2, vol = 0.25, corte = 1500, tipoFiltro = 'lowpass', delay = 0 } = {}) => {
    try {
        const a = ctx();
        if (!a) return;
        const t = a.currentTime + delay;
        const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = a.createBufferSource(); s.buffer = buf;
        const f = a.createBiquadFilter(); f.type = tipoFiltro; f.frequency.value = corte;
        const g = a.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(a.destination);
        s.start(t); s.stop(t + dur + 0.02);
    } catch { /* audio no disponible */ }
};

// ─────────────────────── CATÁLOGO DE ACIERTOS ───────────────────────

const ACIERTOS = {
    /** Dos notas ascendentes alegres (el de toda la vida). */
    CLASICO: () => {
        tono(660, { tipo: 'sine', dur: 0.12, vol: 0.13 });
        tono(880, { tipo: 'sine', dur: 0.18, vol: 0.13, delay: 0.09 });
    },
    /** Arpegio de consola de 8 bits. */
    ARCADE: () => {
        [523, 784, 1046, 1318].forEach((f, i) =>
            tono(f, { tipo: 'square', dur: 0.09, vol: 0.09, delay: i * 0.055 }));
    },
    /** Fanfarria corta de concurso. */
    FANFARRIA: () => {
        [523, 523, 659, 784].forEach((f, i) =>
            tono(f, { tipo: 'triangle', dur: i === 3 ? 0.4 : 0.13, vol: 0.12, delay: i * 0.11 }));
        tono(1046, { tipo: 'triangle', dur: 0.45, vol: 0.07, delay: 0.33 });
    },
    /** Destello mágico: subida rápida con brillo. */
    MAGIA: () => {
        tono(520, { tipo: 'sine', dur: 0.32, vol: 0.1, freqFin: 1600 });
        [1568, 2093, 2637].forEach((f, i) =>
            tono(f, { tipo: 'sine', dur: 0.16, vol: 0.05, delay: 0.12 + i * 0.07 }));
    },
    /** Moneda de videojuego. */
    MONEDAS: () => {
        tono(988, { tipo: 'square', dur: 0.08, vol: 0.11 });
        tono(1319, { tipo: 'square', dur: 0.34, vol: 0.11, delay: 0.075 });
    },
    /** Aplauso sintetizado: ráfagas de ruido. */
    APLAUSO: () => {
        for (let i = 0; i < 14; i++) {
            ruido({ dur: 0.05, vol: 0.05 + Math.random() * 0.05, corte: 2600 + Math.random() * 2600, tipoFiltro: 'bandpass', delay: i * 0.035 + Math.random() * 0.02 });
        }
        ruido({ dur: 0.45, vol: 0.05, corte: 2200, tipoFiltro: 'bandpass', delay: 0.1 });
    },
};

// ──────────────────────── CATÁLOGO DE FALLOS ────────────────────────

const FALLOS = {
    /** Zumbido grave corto (el de toda la vida). */
    CLASICO: () => tono(200, { tipo: 'sawtooth', dur: 0.22, vol: 0.1, freqFin: 120 }),
    /** Caída de 8 bits. */
    ARCADE: () => {
        [392, 294, 196].forEach((f, i) =>
            tono(f, { tipo: 'square', dur: 0.1, vol: 0.09, delay: i * 0.075 }));
    },
    /** Bocina de concurso: dos graves a la vez. */
    BOCINA: () => {
        tono(160, { tipo: 'sawtooth', dur: 0.55, vol: 0.11 });
        tono(124, { tipo: 'sawtooth', dur: 0.55, vol: 0.09 });
    },
    /** Trombón triste "wah wah wah". */
    TROMBON: () => {
        [311, 277, 247, 208].forEach((f, i) =>
            tono(f, { tipo: 'sawtooth', dur: i === 3 ? 0.5 : 0.17, vol: 0.09, delay: i * 0.17, freqFin: i === 3 ? 150 : null }));
    },
    /** Rebote elástico. */
    BOING: () => {
        tono(600, { tipo: 'sine', dur: 0.28, vol: 0.12, freqFin: 120 });
        tono(300, { tipo: 'sine', dur: 0.2, vol: 0.06, delay: 0.22, freqFin: 90 });
    },
    /** Cristal roto. */
    CRISTAL: () => {
        ruido({ dur: 0.1, vol: 0.22, corte: 5200, tipoFiltro: 'highpass' });
        ruido({ dur: 0.3, vol: 0.12, corte: 3400, tipoFiltro: 'highpass', delay: 0.07 });
        tono(180, { tipo: 'sawtooth', dur: 0.18, vol: 0.07 });
    },
};

// ───────────────────────── Selección guardada ─────────────────────────

/** Listas para pintar los selectores de configuración. */
export const SONIDOS_ACIERTO = [
    { id: 'CLASICO', nombre: 'Clásico', emoji: '🔔' },
    { id: 'ARCADE', nombre: 'Arcade', emoji: '🕹️' },
    { id: 'FANFARRIA', nombre: 'Fanfarria', emoji: '🎺' },
    { id: 'MAGIA', nombre: 'Magia', emoji: '✨' },
    { id: 'MONEDAS', nombre: 'Monedas', emoji: '🪙' },
    { id: 'APLAUSO', nombre: 'Aplausos', emoji: '👏' },
];

export const SONIDOS_FALLO = [
    { id: 'CLASICO', nombre: 'Clásico', emoji: '🔉' },
    { id: 'ARCADE', nombre: 'Arcade', emoji: '🕹️' },
    { id: 'BOCINA', nombre: 'Bocina de concurso', emoji: '📢' },
    { id: 'TROMBON', nombre: 'Trombón triste', emoji: '🎺' },
    { id: 'BOING', nombre: 'Boing', emoji: '🤾' },
    { id: 'CRISTAL', nombre: 'Cristal roto', emoji: '💥' },
];

const leer = (key, porDefecto) => {
    try { return localStorage.getItem(key) || porDefecto; } catch { return porDefecto; }
};

export const getSonidoAcierto = () => (ACIERTOS[leer(KEY_OK, 'CLASICO')] ? leer(KEY_OK, 'CLASICO') : 'CLASICO');
export const getSonidoFallo = () => (FALLOS[leer(KEY_MAL, 'CLASICO')] ? leer(KEY_MAL, 'CLASICO') : 'CLASICO');

export const setSonidoAcierto = (id) => {
    try { if (ACIERTOS[id]) localStorage.setItem(KEY_OK, id); } catch { /* sin localStorage */ }
    return id;
};

export const setSonidoFallo = (id) => {
    try { if (FALLOS[id]) localStorage.setItem(KEY_MAL, id); } catch { /* sin localStorage */ }
    return id;
};

/**
 * Acierto. Sin argumentos usa el sonido elegido por el usuario (o el Clásico).
 * @param {string}  [id]     Sonido concreto del catálogo SONIDOS_ACIERTO.
 * @param {boolean} [forzar] Suena aunque el juego esté silenciado (para las pruebas del selector).
 */
export const sonidoCorrecto = (id, forzar = false) => {
    if (!forzar && !sonidoActivo()) return;
    (ACIERTOS[id] || ACIERTOS[getSonidoAcierto()] || ACIERTOS.CLASICO)();
};

/** Fallo. Mismos argumentos que sonidoCorrecto, con el catálogo SONIDOS_FALLO. */
export const sonidoIncorrecto = (id, forzar = false) => {
    if (!forzar && !sonidoActivo()) return;
    (FALLOS[id] || FALLOS[getSonidoFallo()] || FALLOS.CLASICO)();
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
