// ─── Ficha PDF ↔ partida ─────────────────────────────────────────────────────
// Una ficha impresa queda VINCULADA al juego: su QR abre /invasores?ficha=<código>
// y la partida usa exactamente las mismas preguntas, en el mismo orden (y con las
// opciones A-D igual de colocadas).
//
// El código no guarda las preguntas, sino cómo volver a generarlas:
//   { v: variante, f: contenido, s: semilla, n: nº de preguntas, m: mandos, mr: respuesta con mandos, t: título }
//   f = { tipo:'RAPIDAS', operaciones, nivel } | { tipo:'BANCO', clave }
//     | { tipo:'RECURSO', id, hojas } | { tipo:'MATES', ts:'calculo:0124;fracciones:03', o:{nivel,numerico,maxNum} }
//   (Math World: los tipos elegidos de cada tema como índices en base 36 de Object.keys(tipos), en el
//    mismo orden de la selección; así el QR sale poco denso. No se recalcula con tiposJugables, que usa azar.)
// Así cabe en el QR y funciona sin login en cualquier ordenador. (Si el profe edita
// el recurso después de imprimir, la partida usará la versión nueva del recurso.)
import { codificarReto, decodificarReto } from '../utils/retoLink';

const LS_FICHAS = 'pikt_invasores_fichas';
const MAX_RECIENTES = 8;

/** Contenido de la partida en forma serializable (null si no se puede vincular). */
export async function fuenteSerializable(fuente, apiMates) {
  if (fuente.tipo === 'RAPIDAS') return { tipo: 'RAPIDAS', operaciones: fuente.operaciones || ['suma'], nivel: fuente.nivel || 1 };
  if (fuente.tipo === 'BANCO') return { tipo: 'BANCO', clave: fuente.clave };
  if (fuente.tipo === 'RECURSO') return fuente.recurso?.id ? { tipo: 'RECURSO', id: fuente.recurso.id, hojas: fuente.hojas || null } : null;
  if (fuente.tipo === 'MATES') {
    const e = apiMates?.estado;
    if (!e?.seleccion?.length) return null;
    const { TEMAS_MATES } = await import('../mandos/preguntasMates.js');
    const grupos = [];
    for (const { tema, tipo } of e.seleccion) {
      const k = Object.keys(TEMAS_MATES.find((t) => t.id === tema)?.tipos || {}).indexOf(tipo);
      if (k < 0 || k > 35) return null;
      if (grupos.at(-1)?.tema !== tema) grupos.push({ tema, ind: '' });
      grupos.at(-1).ind += k.toString(36);
    }
    return { tipo: 'MATES', ts: grupos.map((g) => `${g.tema}:${g.ind}`).join(';'), o: e.opts };
  }
  return null;
}

export const codificarFicha = (ficha) => codificarReto(ficha);

export function decodificarFicha(codigo) {
  const f = decodificarReto(codigo);
  return f && f.f && f.f.tipo && Number.isFinite(Number(f.s)) && f.n > 0 ? f : null;
}

export const enlaceFicha = (codigo) => `${window.location.origin}/invasores?ficha=${codigo}`;

/** ?ficha=… de la URL actual (o null). */
export function fichaDeUrl() {
  try { return new URLSearchParams(window.location.search).get('ficha') || null; } catch { return null; }
}

/**
 * Prepara lo necesario para regenerar las preguntas: la fuente «viva» que entiende
 * construirMazo (con el recurso descargado o el generador de Math World).
 */
export async function resolverFicha(ficha) {
  const f = ficha.f;
  if (f.tipo === 'RAPIDAS' || f.tipo === 'BANCO') return { fuente: { ...f }, apiMates: null };
  if (f.tipo === 'MATES') {
    const { generarPreguntasMates, TEMAS_MATES } = await import('../mandos/preguntasMates.js');
    const sel = String(f.ts || '').split(';').flatMap((g) => {
      const [tema, ind = ''] = g.split(':');
      const tipos = Object.keys(TEMAS_MATES.find((t) => t.id === tema)?.tipos || {});
      return [...ind].map((c) => tipos[parseInt(c, 36)]).filter(Boolean).map((tipo) => ({ tema, tipo }));
    });
    if (!sel.length) throw new Error('Los ejercicios de esta ficha ya no están disponibles.');
    const apiMates = (k) => generarPreguntasMates(sel, k, f.o);
    const temas = [...new Set(sel.map((x) => x.tema))];
    return { fuente: { tipo: 'MATES', temas, nivel: f.o?.nivel }, apiMates };
  }
  if (f.tipo === 'RECURSO') {
    const [{ doc, getDoc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firebase')]);
    const snap = await getDoc(doc(db, 'resources', f.id));
    if (!snap.exists()) throw new Error('El recurso de esta ficha ya no existe (puede que lo hayan borrado).');
    return { fuente: { tipo: 'RECURSO', recurso: { id: snap.id, ...snap.data() }, hojas: f.hojas || null }, apiMates: null };
  }
  throw new Error('Esta ficha no se puede abrir en el juego.');
}

// ── Fichas impresas en este equipo (para volver a jugarlas otro día sin escanear el QR) ──
export function fichasRecientes() {
  try {
    const l = JSON.parse(localStorage.getItem(LS_FICHAS) || '[]');
    return Array.isArray(l) ? l.filter((x) => x?.codigo) : [];
  } catch { return []; }
}

export function guardarFichaReciente({ codigo, titulo, n, codigoCorto = null }) {
  try {
    const l = [{ codigo, titulo, n, codigoCorto, fecha: Date.now() }, ...fichasRecientes().filter((x) => x.codigo !== codigo)].slice(0, MAX_RECIENTES);
    localStorage.setItem(LS_FICHAS, JSON.stringify(l));
  } catch { /* sin almacenamiento */ }
}

export function olvidarFichaReciente(codigo) {
  try { localStorage.setItem(LS_FICHAS, JSON.stringify(fichasRecientes().filter((x) => x.codigo !== codigo))); } catch { /* nada */ }
}
