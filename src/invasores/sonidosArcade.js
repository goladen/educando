// Efectos de sonido 8 bits sintetizados con Web Audio (sin archivos). Respetan el interruptor
// global de sonido de pikt.es (utils/sonidosFeedback → localStorage pikt_sonido).
import { sonidoActivo } from '../utils/sonidosFeedback';

let ctx = null;
const audio = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

function tono({ tipo = 'square', f0, f1 = f0, dur = 0.12, vol = 0.08, retraso = 0 }) {
  if (!sonidoActivo()) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + retraso;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(dur = 0.35, vol = 0.12) {
  if (!sonidoActivo()) return;
  const a = audio();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource();
  const g = a.createGain();
  const filtro = a.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 1400;
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(filtro).connect(g).connect(a.destination);
  src.start();
}

export const despertarAudioArcade = () => { try { audio(); } catch { /* nada */ } };

export const sfx = {
  disparo: () => tono({ f0: 880, f1: 220, dur: 0.09, vol: 0.05 }),
  laser: () => { tono({ tipo: 'sawtooth', f0: 1400, f1: 300, dur: 0.16, vol: 0.06 }); },
  explosion: () => { ruido(0.3, 0.14); tono({ tipo: 'triangle', f0: 160, f1: 40, dur: 0.3, vol: 0.1 }); },
  error: () => { tono({ f0: 180, dur: 0.12, vol: 0.07 }); tono({ f0: 140, dur: 0.16, vol: 0.07, retraso: 0.12 }); },
  vida: () => { ruido(0.5, 0.16); tono({ tipo: 'triangle', f0: 300, f1: 60, dur: 0.55, vol: 0.12 }); },
  salvado: () => [523, 659, 784].forEach((f, i) => tono({ f0: f, dur: 0.1, vol: 0.06, retraso: i * 0.08 })),
  tecla: () => tono({ f0: 660, dur: 0.03, vol: 0.025 }),
  cuenta: (ultimo) => tono({ f0: ultimo ? 988 : 494, dur: ultimo ? 0.3 : 0.12, vol: 0.07 }),
  nivel: () => [392, 523, 659, 1046].forEach((f, i) => tono({ f0: f, dur: 0.09, vol: 0.06, retraso: i * 0.07 })),
  fin: () => [392, 330, 262, 196].forEach((f, i) => tono({ tipo: 'triangle', f0: f, dur: 0.22, vol: 0.08, retraso: i * 0.2 })),
};
