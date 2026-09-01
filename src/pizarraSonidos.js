/*
 * Sonidos para las animaciones de la Pizarra.
 * Dos fuentes:
 *  - MP3 del proyecto (src/assets), reutilizados como pequeña librería.
 *  - Sintéticos generados con Web Audio (sin ficheros).
 */

// URLs de los mp3 (Vite las resuelve). Solo los que uso en el selector.
const mp3s = import.meta.glob(
  ['./assets/jump.mp3', './assets/correct.mp3', './assets/wrong.mp3', './assets/girala.mp3',
   './assets/gol-cutmp3.mp3', './assets/disparocanon.mp3', './assets/applause-small-audience-97257.mp3',
   './assets/passlevel.mp3', './assets/inicio-juego.mp3', './assets/sonidomonedamal.mp3'],
  { eager: true, query: '?url', import: 'default' });

const url = (nombre) => mp3s[`./assets/${nombre}`];

// Librería expuesta al selector: [{id, label, tipo, ...}]
export const SONIDOS = [
  { id: 'none', label: '— Sin sonido', tipo: 'none' },
  // MP3 del proyecto
  { id: 'salto', label: '🦘 Salto', tipo: 'mp3', src: url('jump.mp3') },
  { id: 'correcto', label: '✅ Correcto', tipo: 'mp3', src: url('correct.mp3') },
  { id: 'error', label: '❌ Error', tipo: 'mp3', src: url('wrong.mp3') },
  { id: 'giro', label: '🌀 Gírala', tipo: 'mp3', src: url('girala.mp3') },
  { id: 'gol', label: '⚽ Gol', tipo: 'mp3', src: url('gol-cutmp3.mp3') },
  { id: 'canon', label: '💥 Cañón', tipo: 'mp3', src: url('disparocanon.mp3') },
  { id: 'aplausos', label: '👏 Aplausos', tipo: 'mp3', src: url('applause-small-audience-97257.mp3') },
  { id: 'nivel', label: '🎉 Nivel', tipo: 'mp3', src: url('passlevel.mp3') },
  { id: 'moneda', label: '🪙 Moneda', tipo: 'mp3', src: url('sonidomonedamal.mp3') },
  // Sintéticos (Web Audio)
  { id: 'beep', label: '🔔 Beep', tipo: 'synth', synth: 'beep' },
  { id: 'whoosh', label: '💨 Whoosh', tipo: 'synth', synth: 'whoosh' },
  { id: 'pop', label: '🫧 Pop', tipo: 'synth', synth: 'pop' },
].filter((s) => s.tipo !== 'mp3' || s.src);

export const SONIDO_POR_ID = Object.fromEntries(SONIDOS.map((s) => [s.id, s]));

let _ac = null;
const getAC = () => {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
};

function tocarSynth(kind) {
  const ac = getAC();
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g); g.connect(ac.destination);
  if (kind === 'beep') {
    o.type = 'sine'; o.frequency.setValueAtTime(880, now);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18); o.start(now); o.stop(now + 0.2);
  } else if (kind === 'whoosh') {
    o.type = 'sawtooth'; o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3); o.start(now); o.stop(now + 0.32);
  } else if (kind === 'pop') {
    o.type = 'triangle'; o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.35, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12); o.start(now); o.stop(now + 0.14);
  }
}

const _audioCache = {};

// Reproduce el sonido indicado por id (no bloquea; ignora errores de autoplay).
export function reproducirSonido(id) {
  const s = SONIDO_POR_ID[id];
  if (!s || s.tipo === 'none') return;
  try {
    if (s.tipo === 'synth') { tocarSynth(s.synth); return; }
    let a = _audioCache[id];
    if (!a) { a = new Audio(s.src); a.volume = 0.6; _audioCache[id] = a; }
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* noop */ }
}
