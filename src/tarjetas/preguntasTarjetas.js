// Preguntas de un recurso que se pueden contestar con A-D (o A-E): las usan PiLive con
// tarjetas y el Corrector de exámenes.
import { normalizarPregunta } from '../utils/normalizarPreguntas';

/** Pregunta cruda de un recurso → { texto, opciones (2-4), correcta (índice), imagen } o null. */
export function aTarjeta(p, maxOpciones = 4) {
  if (!p) return null;
  const tipo = String(p.tipo || '').toUpperCase();
  if (['DIBUJO', 'PRESENTATION', 'MUSICAL', 'ORDENAR', 'RELLENAR'].includes(tipo)) return null;
  const imagen = p.imagenUrl || p.imagen || '';
  const correctaTxt = String(p.respuesta ?? p.correcta ?? '').trim();
  // Opciones fijas (p. ej. Verdadero / Falso): se respeta el orden
  const fijas = Array.isArray(p.opcionesFijas) ? p.opcionesFijas.map((o) => String(o ?? '').trim()).filter(Boolean) : [];
  if (fijas.length >= 2 && fijas.length <= maxOpciones && correctaTxt) {
    const i = fijas.findIndex((o) => o.toLowerCase() === correctaTxt.toLowerCase());
    if (i >= 0) return { texto: String(p.pregunta || p.q || p.enunciado || '').trim(), opciones: fijas, correcta: i, imagen, fijas: true };
  }
  const n = normalizarPregunta(p);
  if (!n || n.tipo !== 'MULTIPLE') return null;
  return { texto: n.enunciado, opciones: n.opciones, correcta: n.opciones.indexOf(n.correcta), imagen };
}

/** Hojas del recurso con las preguntas que se pueden contestar con A-D. */
export function hojasTarjetas(recurso, maxOpciones = 4) {
  if (!recurso) return [];
  const hojas = Array.isArray(recurso.hojas) && recurso.hojas.length
    ? recurso.hojas
    : [{ nombreHoja: recurso.titulo || 'Preguntas', preguntas: recurso.preguntas || [] }];
  return hojas
    .map((h, i) => ({ nombre: String(h.nombreHoja || h.nombre || `Hoja ${i + 1}`), preguntas: (h.preguntas || []).map((p) => aTarjeta(p, maxOpciones)).filter(Boolean) }))
    .filter((h) => h.preguntas.length > 0);
}

