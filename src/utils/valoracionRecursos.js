// ⭐ Valoración de los recursos: partidas jugadas (playCount), «me gusta» (likes) y búsqueda
// por páginas (20 y «Ver más»).
//
// Reglas (firebase-reglas/firestore.rules, match /resources): sin sesión solo se puede sumar 1 a
// playCount o sumar/restar 1 a likes; con sesión, como siempre.
import { db } from '../firebase';
import { collection, doc, getDocs, increment, limit, orderBy, query, startAfter, updateDoc } from 'firebase/firestore';

const LS_LIKES = 'pikt_likes_v1';
const SS_JUGADO = 'pikt_jugado_';
const leerLikes = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_LIKES) || '[]')); } catch { return new Set(); } };
const guardarLikes = (s) => { try { localStorage.setItem(LS_LIKES, JSON.stringify([...s])); } catch { /* sin almacenamiento */ } };

// Recursos que no están en Firestore (preguntas de PiKT, Mathle de ejemplo…)
const esReal = (r) => !!r?.id && !r.esPikt && !String(r.id).startsWith('fake') && !String(r.id).startsWith('pikt')
  // opciones internas de algunos juegos (Racing 3D: educación vial; Aviones: solo pilotar; Mansión: sin recurso)
  && !r.esVial && !r.soloAros && !r.libre;

/**
 * Suma una partida al recurso (una vez por recurso y sesión del navegador, para que recargar o
 * volver a abrirlo no infle el contador). No espera a Firestore ni falla si no hay red.
 */
// Estos juegos ya suman su partida desde dentro (CazaBurbujasGame, AparejadosGame): no se cuenta dos veces
const CUENTAN_SOLOS = new Set(['CAZABURBUJAS', 'PIKATRON', 'APAREJADOS']);

export function contarJugada(r) {
  if (!esReal(r) || CUENTAN_SOLOS.has(r.tipoJuego)) return; // en PiLive (copia THINKHOOT) sí cuenta
  const k = SS_JUGADO + r.id;
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch { /* sin almacenamiento */ }
  updateDoc(doc(db, 'resources', r.id), { playCount: increment(1) }).catch(() => {});
}

/** ¿Le he dado «me gusta» en este navegador? */
export const meGusta = (id) => leerLikes().has(id);

/** Da o quita el «me gusta» (uno por navegador). Devuelve el nuevo estado (true = gusta). */
export async function alternarMeGusta(r) {
  if (!esReal(r)) return false;
  const s = leerLikes();
  const quitar = s.has(r.id);
  if (quitar) s.delete(r.id); else s.add(r.id);
  guardarLikes(s);
  try {
    await updateDoc(doc(db, 'resources', r.id), { likes: increment(quitar ? -1 : 1) });
  } catch (e) {
    // Si falla (sin red, reglas sin publicar), se deshace en el navegador
    if (quitar) s.add(r.id); else s.delete(r.id);
    guardarLikes(s);
    throw e;
  }
  return !quitar;
}

export const ORDENES = {
  recientes: { texto: '🆕 Más recientes', campos: ['fechaCreacion'] },
  jugados: { texto: '🔥 Más jugados', campos: ['playCount', 'fechaCreacion'] },
  gustan: { texto: '❤️ Más gustan', campos: ['likes', 'fechaCreacion'] },
};

/**
 * Búsqueda por páginas con filtro en el navegador: va leyendo la colección por tandas (LOTE)
 * en el orden pedido hasta reunir `porPagina` recursos que pasen el filtro.
 * Para «más jugados/gustan» encadena el orden por fecha al final (los que aún no tienen
 * partidas o likes también salen, detrás), sin repetir recursos.
 *   const b = crearBuscador({ orden: 'gustan', filtro: (r) => … });
 *   const { items, fin } = await b.siguiente();
 */
export function crearBuscador({ orden = 'recientes', filtro = () => true, porPagina = 20, lote = 60 }) {
  const campos = (ORDENES[orden] || ORDENES.recientes).campos;
  let paso = 0; // índice del campo en uso
  let cursor = null;
  let agotado = false;
  const vistos = new Set();
  const pendientes = []; // ya filtrados pero aún no entregados

  async function tanda() {
    while (paso < campos.length) {
      const q = cursor
        ? query(collection(db, 'resources'), orderBy(campos[paso], 'desc'), startAfter(cursor), limit(lote))
        : query(collection(db, 'resources'), orderBy(campos[paso], 'desc'), limit(lote));
      const snap = await getDocs(q);
      if (snap.empty) { paso++; cursor = null; continue; }
      cursor = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < lote) { paso++; cursor = null; }
      let nuevos = 0;
      for (const d of snap.docs) {
        if (vistos.has(d.id)) continue;
        vistos.add(d.id);
        const r = { ...d.data(), id: d.id };
        if (filtro(r)) { pendientes.push(r); nuevos++; }
      }
      return nuevos;
    }
    agotado = true;
    return 0;
  }

  return {
    async siguiente() {
      while (pendientes.length < porPagina && !agotado) await tanda();
      const items = pendientes.splice(0, porPagina);
      return { items, fin: agotado && pendientes.length === 0 };
    },
  };
}
