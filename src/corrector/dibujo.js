// Dibuja sobre la imagen lo que se ha leído de una hoja: verde bien, rojo mal (y la buena
// en verde), naranja en blanco, morado doble marca, azul el nº de lista. Sin clave (móvil,
// lectura de la clave) las marcas salen en azul.
import { LETRAS, R, posBurbuja, posId } from './omr.js';

export const COLOR = { bien: '#16a34a', mal: '#dc2626', blanco: '#f59e0b', doble: '#7c3aed', anulada: '#94a3b8', neutro: '#38bdf8', lista: '#2563eb' };

/**
 * ctx: contexto 2D en las mismas coordenadas que la imagen analizada.
 * r: resultado de leerHoja. clave: ['A',…] o null. ex: corrige el espejo (x → x).
 */
export function pintarLectura(ctx, r, { nPreguntas, nOpciones, clave = null, ex = (x) => x }) {
  if (!r?.ok) return;
  const radio = (x, y) => { const a = r.H(x, y), b = r.H(x + R, y); return Math.hypot(b.x - a.x, b.y - a.y); };
  const circulo = (x, y, color, grueso, relleno) => {
    const p = r.H(x, y);
    ctx.beginPath();
    ctx.arc(ex(p.x), p.y, radio(x, y) * 1.25, 0, Math.PI * 2);
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    ctx.lineWidth = grueso;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  const g = Math.max(2, radio(105, 150) * 0.35);
  for (let q = 0; q < nPreguntas; q++) {
    const dada = r.respuestas[q];
    const buena = clave ? clave[q] : '';
    if (dada && dada !== '*') {
      const p = posBurbuja(q, LETRAS.indexOf(dada));
      const color = !buena ? COLOR.neutro : dada === buena ? COLOR.bien : COLOR.mal;
      circulo(p.x, p.y, color, g, color + '55');
    }
    if (dada === '*') for (let o = 0; o < nOpciones; o++) { const p = posBurbuja(q, o); circulo(p.x, p.y, COLOR.doble, g / 2); }
    if (buena && dada !== buena) { const p = posBurbuja(q, LETRAS.indexOf(buena)); circulo(p.x, p.y, dada ? COLOR.bien : COLOR.blanco, g / 1.5); }
  }
  if (r.lista) [Math.floor(r.lista / 10), r.lista % 10].forEach((d, c) => { const p = posId(c, d); circulo(p.x, p.y, COLOR.lista, g, COLOR.lista + '55'); });
}

/** Estabilizador: la misma lectura en `n` análisis seguidos. Devuelve la firma si se acaba de confirmar. */
export function crearConfirmador(n = 3) {
  let firma = '', veces = 0;
  return {
    actualizar(r, prefijo = '') {
      if (!r?.ok) { firma = ''; veces = 0; return null; }
      const f = `${prefijo}${r.lista}|${r.respuestas.join(',')}`;
      if (f === firma) veces++; else { firma = f; veces = 1; }
      return veces >= n ? f : null;
    },
    reiniciar() { firma = ''; veces = 0; },
  };
}
