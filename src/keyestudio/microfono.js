// Micrófono del ordenador (cualquiera: el integrado, uno USB o el de unos auriculares) como fuente
// de nivel de sonido para el sonómetro. Web Audio: cada 250 ms calcula la amplitud eficaz (RMS) de
// la onda y la pasa a % con una ganancia ajustable (los micrófonos captan con volúmenes muy distintos).
// El nivel es proporcional a la amplitud, así que dB = 20·log10(nivel/silencio) sigue valiendo.

export const soportaMicrofono = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Abre el micrófono y llama a onNivel(nivel %, t en s) 4 veces por segundo. Devuelve { cerrar, setGanancia }. */
export async function abrirMicrofono(onNivel, ganancia = 10) {
  if (!soportaMicrofono()) throw new Error('Este navegador no puede usar el micrófono.');
  let stream;
  try {
    // Sin cancelación de eco ni control de volumen automático: falsearían el nivel del aula
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    throw new Error(e?.name === 'NotAllowedError' ? 'No se ha dado permiso para usar el micrófono (pulsa el candado de la barra de direcciones para permitirlo).' : 'No se encuentra ningún micrófono: ' + (e?.message || e));
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analizador);
  const buf = new Float32Array(analizador.fftSize);
  let g = ganancia;
  const id = setInterval(() => {
    analizador.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    onNivel(Math.min(100, rms * 100 * g), performance.now() / 1000);
  }, 250);
  return {
    setGanancia: (x) => { g = x; },
    cerrar: () => { clearInterval(id); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); },
  };
}
