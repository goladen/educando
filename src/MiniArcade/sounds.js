// Síntesis de sonidos retro 8-bit con Web Audio API
let ctx = null;

function ac() {
    if (!ctx || ctx.state === 'closed')
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function osc(type, freq, dur, vol = 0.3, when = 0, freqEnd = null) {
    const a = ac();
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, when = 0) {
    const a = ac();
    const t = a.currentTime + when;
    const n = Math.ceil(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain();
    src.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.02);
}

// ─── PONG ────────────────────────────────────────────────────────────────────
// Rebote en pala: beep agudo corto (~480 Hz, 50 ms)
export function pongPaddle() { osc('square', 480, 0.05, 0.28); }

// Rebote en pared: boop más grave (~240 Hz, 50 ms)
export function pongWall()   { osc('square', 240, 0.05, 0.28); }

// Punto anotado: beep grave sostenido (~100 Hz, 320 ms)
export function pongPoint()  { osc('square', 100, 0.32, 0.3); }

// ─── TETRIS ──────────────────────────────────────────────────────────────────
// Rotar: tick mecánico seco
export function tetrisRotate() { osc('square', 440, 0.04, 0.18); }

// Fijar pieza: thud sordo
export function tetrisLock() {
    const a = ac(); const t = a.currentTime;
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.start(t); o.stop(t + 0.16);
}

// Limpiar línea: zing cristalino ascendente
export function tetrisClear() { osc('sine', 660, 0.2, 0.3, 0, 1320); }

// Tetris (4 líneas): fanfarria triunfal de 4 notas
export function tetrisTetris() {
    [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.39]].forEach(([f, w]) =>
        osc('square', f, 0.2, 0.3, w)
    );
}

// ─── MÚSICA TETRIS: Korobeiniki (Tema A, Game Boy) ───────────────────────────
const BPM  = 158;
const Q    = 60 / BPM;       // negra
const E    = Q / 2;          // corchea
const H    = Q * 2;          // blanca
const F    = {               // frecuencias
    A4:440, B4:494, C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, REST:0,
};
const MELODY = [
    // Frase 1
    [F.E5,Q],[F.B4,E],[F.C5,E],[F.D5,Q],[F.C5,E],[F.B4,E],
    [F.A4,Q],[F.A4,E],[F.C5,E],[F.E5,Q],[F.D5,E],[F.C5,E],
    [F.B4,Q+E],[F.C5,E],[F.D5,Q],[F.E5,Q],
    [F.C5,Q],[F.A4,Q],[F.A4,H],
    [F.REST,E],
    // Frase 2
    [F.D5,Q],[F.F5,E],[F.A5,Q],[F.G5,E],[F.F5,E],
    [F.E5,Q+E],[F.C5,E],[F.E5,Q],[F.D5,E],[F.C5,E],
    [F.B4,Q],[F.B4,E],[F.C5,E],[F.D5,Q],[F.E5,Q],
    [F.C5,Q],[F.A4,Q],[F.A4,Q],[F.REST,E],
];
const LOOP_DUR = MELODY.reduce((s,[,d])=>s+d,0);

let musicNodes = [];
let musicPlaying = false;
let musicTimer = null;

function scheduleLoop() {
    if (!musicPlaying) return;
    const a = ac();
    let t = a.currentTime;
    musicNodes = [];
    MELODY.forEach(([freq, dur]) => {
        if (freq > 0) {
            const o = a.createOscillator();
            const g = a.createGain();
            o.connect(g); g.connect(a.destination);
            o.type = 'square';
            o.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.1, t);
            g.gain.setValueAtTime(0.1, t + dur * 0.85);
            g.gain.linearRampToValueAtTime(0, t + dur);
            o.start(t); o.stop(t + dur + 0.01);
            musicNodes.push(o);
        }
        t += dur;
    });
    musicTimer = setTimeout(scheduleLoop, (LOOP_DUR - 0.15) * 1000);
}

export function tetrisMusicStart() {
    if (musicPlaying) return;
    musicPlaying = true;
    scheduleLoop();
}
export function tetrisMusicStop() {
    musicPlaying = false;
    clearTimeout(musicTimer);
    musicNodes.forEach(n => { try { n.stop(); } catch(_){} });
    musicNodes = [];
}

// ─── ARKANOID ────────────────────────────────────────────────────────────────
// Inicio de fase: ráfaga electrónica ascendente
export function arkanoidStart() {
    osc('square', 200, 0.35, 0.2, 0, 800);
    osc('square', 400, 0.25, 0.15, 0.12, 1200);
}

// Rebote en nave (Vaus): ping metálico con eco espacial
export function arkanoidPaddle() {
    osc('square', 600, 0.07, 0.25);
    osc('sine',   900, 0.06, 0.1, 0.05);
}

// Romper ladrillo normal: pop electrónico
export function arkanoidBrick() {
    noise(0.04, 0.28);
    osc('square', 320, 0.06, 0.2);
}

// Perder la bola: bloop-bloop-bloop descendente
export function arkanoidBallLost() {
    [[400,0],[260,0.2],[160,0.4]].forEach(([f,w]) =>
        osc('square', f, 0.16, 0.25, w)
    );
}

// ─── BUSCAMINAS ──────────────────────────────────────────────────────────────
// Clic al revelar celda
export function mineClick() {
    noise(0.022, 0.12);
    osc('square', 900, 0.018, 0.08);
}

// Plantar / quitar bandera
export function mineFlag() {
    osc('square', 700, 0.04, 0.15);
    osc('square', 1050, 0.03, 0.1, 0.025);
}

// Victoria: fanfarria tipo Windows "Tada"
export function mineVictory() {
    osc('square', 523,  0.12, 0.25, 0);
    osc('square', 659,  0.12, 0.25, 0.11);
    osc('square', 784,  0.12, 0.25, 0.22);
    osc('square', 523,  0.35, 0.28, 0.38);
    osc('square', 659,  0.35, 0.28, 0.38);
    osc('square', 1047, 0.35, 0.28, 0.38);
}

// Explosión (pisas una mina)
export function mineExplosion() {
    noise(0.55, 0.5);
    osc('square', 90,  0.5, 0.4, 0,    28);
    osc('square', 220, 0.2, 0.3, 0.06, 45);
}
