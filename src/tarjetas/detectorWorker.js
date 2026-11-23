// Worker: detecta las tarjetas fuera del hilo principal para que la pizarra no se trabe.
// Recibe { id, width, height, buffer (RGBA), maxTarjeta } y devuelve { id, detecciones, ms }.
import { crearDetector } from './detectorTarjetas.js';

let det = null;
let maxActual = 0;

self.onmessage = (e) => {
  const { id, width, height, buffer, maxTarjeta } = e.data;
  if (!det || maxTarjeta !== maxActual) {
    det = crearDetector({ maxTarjeta });
    maxActual = maxTarjeta;
  }
  const t0 = performance.now();
  let detecciones = [];
  try {
    detecciones = det.detectar({ width, height, data: new Uint8ClampedArray(buffer) });
  } catch {
    detecciones = [];
  }
  self.postMessage({ id, detecciones, ms: performance.now() - t0, buffer }, [buffer]);
};
