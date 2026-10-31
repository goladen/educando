// Convierte los ejercicios de las fichas de Math World (fichas/motorMathWorld) en preguntas para
// los mandos: con número, si el resultado es un entero; con letras A-D, cualquier resultado
// (los distractores se crean a partir de la respuesta). Cada pregunta se valida con el mismo
// `comprobar` que usa la pizarra de las fichas.
import { FUENTES } from '../fichas/motorMathWorld.jsx';
import { N, mcd } from '../fichas/fuenteTexto.jsx';

export const TEMAS_MATES = Object.values(FUENTES);

const barajar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
const aceptada = (q, txt) => {
  try { return !!q.comprobar(txt)?.ok; } catch { return false; }
};

// Con varias respuestas (sistemas, problemas…) se pregunta una sola: en los problemas la última,
// que suele ser la que resuelve; en el resto, una al azar. Sin etiqueta no se sabría cuál es.
function elegirRespuesta(fuente, ap) {
  const rs = (fuente.respuestas(ap) || []).filter((q) => q.comprobar && q.v !== undefined && q.v !== null);
  if (rs.length <= 1) return rs[0] || null;
  const conEtiqueta = rs.filter((q) => q.etiqueta);
  if (!conEtiqueta.length) return null;
  return ap.problema || ap.probId ? conEtiqueta[conEtiqueta.length - 1] : azar(conEtiqueta);
}

const esTexto = (q) => q.clase === 'texto' || typeof q.v === 'string';

// [n, d] o decimal con denominador pequeño → [n, d]
function aFraccion(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'number') return null;
  for (let d = 1; d <= 1000; d++) {
    if (Math.abs(v * d - Math.round(v * d)) < 1e-9) return [Math.round(v * d), d];
  }
  return null;
}
const fracTxt = ([n, d], simplificar = true) => {
  if (d < 0) { n = -n; d = -d; }
  const g = simplificar ? mcd(n, d) || 1 : 1;
  const a = n / g, b = d / g;
  return b === 1 ? N(a) : `${a < 0 ? '−' : ''}${Math.abs(a)}/${b}`;
};
const esFraccion = (q) => Array.isArray(q.v) || (q.tipo === 'frac' && !Number.isInteger(q.v) && !!aFraccion(q.v));
const valorDe = (q) => {
  if (typeof q.v === 'number') return q.v;
  if (Array.isArray(q.v)) return q.v[1] ? q.v[0] / q.v[1] : NaN;
  return NaN;
};

// ── Distractores ─────────────────────────────────────────────────────────────
function distractoresNum(v) {
  const dec = Number.isInteger(v) ? 0 : Math.min(3, (String(v).split('.')[1] || '').length);
  const paso = 10 ** -dec;
  const r = (x) => Math.round(x * 10 ** dec) / 10 ** dec;
  const cands = [v + paso, v - paso, v + 2 * paso, v - 2 * paso, v + 10 * paso, v - 10 * paso, -v, v * 2, v / 2, v + 5 * paso, v - 5 * paso, v + 3 * paso];
  return barajar(cands.map(r).filter((x) => x !== v && (v < 0 || x >= 0))).map(N);
}
function distractoresFrac([n, d]) {
  const c = [[n + 1, d], [n - 1, d], [n, d + 1], [d, n], [-n, d], [n + d, d], [n + 2, d], [n, d + 2], [2 * n, d]];
  return barajar(c.filter(([a, b]) => b !== 0 && Math.abs(a / b - n / d) > 1e-9)).map((f) => fracTxt(f));
}
// Cambia un número o un signo del texto: «2x + 3» → «2x + 4», «2x − 3»…
function distractoresTexto(txt) {
  const out = new Set();
  for (const m of txt.matchAll(/\d+/g)) {
    [1, -1, 2].forEach((s) => {
      const nuevo = Math.max(0, Number(m[0]) + s);
      out.add(txt.slice(0, m.index) + nuevo + txt.slice(m.index + m[0].length));
    });
  }
  if (txt.includes('+')) out.add(txt.replace('+', '−'));
  if (txt.includes('−')) out.add(txt.replace('−', '+'));
  out.delete(txt);
  return barajar([...out]);
}

function textoCorrecto(q) {
  let cands;
  if (q.tipo === 'opcion') cands = (q.opciones || []).filter((o) => o === q.v);
  else if (esTexto(q)) cands = [].concat(q.v).map(String);
  else if (Array.isArray(q.v)) cands = [fracTxt(q.v), fracTxt(q.v, false)];
  else if (esFraccion(q)) cands = [fracTxt(aFraccion(q.v)), N(q.v), String(q.v)];
  else cands = [N(q.v), String(q.v)];
  return cands.find((c) => aceptada(q, c)) ?? null;
}

function opcionesFalsas(q, correcta, pool) {
  let otras;
  if (q.tipo === 'opcion') otras = barajar((q.opciones || []).filter((o) => o !== correcta));
  else if (esTexto(q)) otras = [...barajar(pool), ...distractoresTexto(correcta)];
  else if (esFraccion(q)) otras = distractoresFrac(aFraccion(q.v));
  else otras = distractoresNum(q.v);
  const unicas = [];
  for (const o of otras) {
    if (unicas.length >= 3) break;
    if (o !== correcta && !unicas.includes(o) && !aceptada(q, o)) unicas.push(o);
  }
  return unicas;
}

/** Ejercicio de una ficha → pregunta del quiz, o null si no se puede jugar en ese modo. */
function aPregunta(fuente, ap, { numerico, maxNum, pool = [] }) {
  const q = elegirRespuesta(fuente, ap);
  if (!q) return null;
  const base = {
    texto: '', ap, Enunciado: fuente.Enunciado, tema: fuente.nombre, emoji: fuente.emoji,
    instruccion: fuente.titulos?.[ap.tipo] || '', etiqueta: q.etiqueta || '',
  };
  if (numerico) {
    if (q.tipo === 'opcion' || esTexto(q)) return null;
    const v = valorDe(q);
    if (!Number.isInteger(v) || Math.abs(v) > maxNum || v < -999 || v > 9999 || !aceptada(q, String(v))) return null;
    return { ...base, valor: v, unidad: q.unidad || '' };
  }
  const correcta = textoCorrecto(q);
  if (correcta === null) return null;
  const otras = opcionesFalsas(q, correcta, pool);
  if (!otras.length) return null;
  const opciones = barajar([correcta, ...otras]);
  return {
    ...base,
    opciones: opciones.map((o) => (q.unidad ? `${o} ${q.unidad}` : o)),
    correcta: opciones.indexOf(correcta),
  };
}

// Soluciones de otros ejercicios del mismo tipo: los mejores distractores si la respuesta es un texto.
function poolDe(fuente, aps) {
  const out = new Set();
  aps.forEach((ap) => {
    const q = elegirRespuesta(fuente, ap);
    if (q && esTexto(q)) out.add(String([].concat(q.v)[0]));
  });
  return [...out];
}

function generarSeguro(fuente, ej, n) {
  try { return fuente.generarApartados(ej, n) || []; } catch (e) { console.warn('[mates mandos]', ej, e); return []; }
}
function convertirSeguro(fuente, ap, opts) {
  try { return aPregunta(fuente, ap, opts); } catch (e) { console.warn('[mates mandos]', ap, e); return null; }
}

/** Claves de los tipos de un tema que se pueden jugar con este modo y nivel. */
export function tiposJugables(temaId, { nivel, numerico, maxNum }) {
  const fuente = FUENTES[temaId];
  return Object.keys(fuente.tipos).filter((tipo) => {
    const aps = generarSeguro(fuente, { tipo, nivel, n: 12 }, 12);
    return aps.some((ap) => convertirSeguro(fuente, ap, { numerico, maxNum }));
  });
}

/** seleccion: [{ tema, tipo }] → hasta n preguntas repartidas entre los tipos elegidos, barajadas. */
export function generarPreguntasMates(seleccion, n, { nivel, numerico, maxNum }) {
  if (!seleccion.length) return [];
  const porTipo = Math.ceil(n / seleccion.length);
  const todas = seleccion.flatMap(({ tema, tipo }) => {
    const fuente = FUENTES[tema];
    const aps = generarSeguro(fuente, { tipo, nivel, n: porTipo * 4 }, porTipo * 4);
    const pool = numerico ? [] : poolDe(fuente, aps);
    const out = [];
    for (const ap of aps) {
      if (out.length >= porTipo) break;
      const p = convertirSeguro(fuente, ap, { numerico, maxNum, pool });
      if (p) out.push(p);
    }
    return out;
  });
  return barajar(todas).slice(0, n);
}
