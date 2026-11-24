// ✍️ Respuestas escritas en casillas (letras MAYÚSCULAS y números) del Corrector.
// Por cada hoja se guardan las probabilidades resumidas de cada casilla (codificarCajas),
// no solo «bien/mal»: así, si el profe cambia la clave, se vuelve a comprobar sin reescanear.
import { plantillaEscritas, leerCajas, GW, GH, CAJA } from './omr.js';
import { cargarModelo, clasificarCaja, codificarCajas, decodificarCajas, verificarEscrita } from './ocrLetras.js';

export const hayEscritas = (cfg) => (cfg?.nEscritas || 0) > 0;

/** Una fila de casillas recortada (para que el profe revise las dudosas). Solo en el navegador. */
function recorte(r, it) {
  if (typeof document === 'undefined') return null;
  const x0 = it.cajas[0].cx - CAJA.w / 2 - 1, x1 = it.cajas[it.cajas.length - 1].cx + CAJA.w / 2 + 1;
  const y0 = it.y - CAJA.h / 2 - 1, y1 = it.y + CAJA.h / 2 + 1;
  const k = 4; // px por mm
  const w = Math.round((x1 - x0) * k), h = Math.round((y1 - y0) * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(w, h);
  const { width: gw, height: gh, data } = r.gris;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = r.H(x0 + (x + 0.5) / k, y0 + (y + 0.5) / k);
    const xi = Math.round(p.x), yi = Math.round(p.y);
    const v = xi >= 0 && yi >= 0 && xi < gw && yi < gh ? data[yi * gw + xi] : 255;
    const o = (y * w + x) * 4;
    im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return c.toDataURL('image/jpeg', 0.6);
}

/**
 * Lee las casillas de una hoja ya localizada (resultado de leerHoja, con .gris y .H).
 * → [{ c: 'P93,R4|…/…' (probabilidades codificadas), img: recorte | null }]
 * conRecorte(k, cajas) decide si se guarda la imagen (p. ej. solo si no está claramente bien).
 */
export async function leerEscritas(r, cfg, conRecorte = () => true) {
  if (!hayEscritas(cfg) || !r?.ok) return [];
  const red = await cargarModelo();
  const P = plantillaEscritas(cfg);
  const tintas = leerCajas(r.gris, r.H, P.items);
  return P.items.map((it, k) => {
    const cajas = (tintas[k] || []).map((t) => (t ? clasificarCaja(red, t, GW, GH) : null));
    return { c: codificarCajas(cajas), img: conRecorte(k, cajas) ? recorte(r, it) : null };
  });
}

/** Estado de cada respuesta escrita de una hoja guardada (con las correcciones a mano del profe). */
export function estadosEscritas(hoja, cfg) {
  const n = cfg?.nEscritas || 0;
  return Array.from({ length: n }, (_, k) => {
    const e = hoja?.escritas?.[k];
    const manual = hoja?.revision?.[k];
    if (!String(cfg.claveEscritas?.[k] || '').trim()) return { estado: 'anulada', leida: '', manual: false }; // sin clave: no cuenta
    if (!e) return { estado: 'blanco', leida: '', manual: false };
    const v = verificarEscrita(decodificarCajas(e.c), cfg.claveEscritas?.[k] || '');
    if (manual) return { ...v, estado: manual, manual: true };
    return { ...v, manual: false };
  });
}

/** Lectura sin clave (para escanear la hoja del profe como clave). */
export function textosLeidos(escritas) {
  return escritas.map((e) => verificarEscrita(decodificarCajas(e.c), []).leida);
}
