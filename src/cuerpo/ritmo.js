// Ritmo de baile sintetizado con Web Audio (sin archivos): bombo, palmas, charles y bajo.
// Hace de RELOJ de la coreografía: `beat()` devuelve el tiempo musical actual (decimal),
// sacado del reloj de audio para que pasos y música no se desincronicen.
// Los 4 primeros tiempos son la cuenta de entrada (solo un «tic»).

export function crearRitmo(bpm = 100) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const spb = 60 / bpm;
  const master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(ctx.destination);

  // Ruido blanco para charles y palmas
  const ruido = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const datos = ruido.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;

  const env = (t, pico, dur) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(pico, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(master);
    return g;
  };

  function bombo(t) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    o.connect(env(t, 0.9, 0.18));
    o.start(t);
    o.stop(t + 0.2);
  }
  function ruidoFiltrado(t, tipo, freq, pico, dur) {
    const s = ctx.createBufferSource();
    s.buffer = ruido;
    const f = ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    s.connect(f).connect(env(t, pico, dur));
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  function tono(t, freq, tipo, pico, dur) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = freq;
    o.connect(env(t, pico, dur));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const BAJO = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42]; // La, Do, Re, Mi
  let t0 = 0;
  let siguiente = 0;
  let paso = 0;
  let timer = 0;

  function programar() {
    while (siguiente < ctx.currentTime + 0.25) {
      const t = siguiente;
      if (paso < 4) {
        tono(t, paso === 3 ? 1320 : 880, 'square', 0.18, 0.08); // cuenta de entrada
      } else {
        const b = paso - 4;
        bombo(t);
        ruidoFiltrado(t + spb / 2, 'highpass', 7000, 0.22, 0.05);
        if (b % 2 === 1) ruidoFiltrado(t, 'bandpass', 1500, 0.5, 0.12);
        tono(t, BAJO[b % 8], 'triangle', 0.35, spb * 0.45);
        if (b % 8 === 7) tono(t + spb / 2, BAJO[0] * 4, 'sine', 0.12, 0.15);
      }
      paso++;
      siguiente += spb;
    }
  }

  return {
    bpm,
    segundosPorTiempo: spb,
    empezar() {
      ctx.resume?.();
      t0 = ctx.currentTime + 0.15;
      siguiente = t0;
      paso = 0;
      programar();
      timer = setInterval(programar, 50);
    },
    /** Tiempo musical actual (0 = primer tic de la cuenta; la música empieza en 4). */
    beat() {
      return (ctx.currentTime - t0) / spb;
    },
    parar() {
      clearInterval(timer);
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      } catch {
        /* ya cerrado */
      }
      setTimeout(() => ctx.close().catch(() => {}), 400);
    },
  };
}
