// ─── Reto de la semana: datos y envío de puntuaciones ───────────────────────
//
// Firestore (reglas en firebase-reglas/firestore.rules, bloque «retos_semana»):
//   retos_semana/{rid}                 { titulo, descripcion, premio, inicio, fin, publicado,
//                                        herramientaId, herramientaTitulo, herramientaRuta,
//                                        herramientaResumen, herramientaConfig, creadoEn }
//                                        lectura pública · escritura solo admin
//   retos_semana/{rid}/claves/{aid}    { alias, clave }      la crea el jugador en su 1er envío;
//                                        SOLO la lee el admin (para comprobar al ganador)
//   retos_semana/{rid}/envios/{eid}    { aliasId, alias, puntos, clave, detalle, juego, uid, fecha }
//                                        cada partida enviada; SOLO la lee el admin
//   retos_semana/{rid}/ranking/{aid}   { alias, mejor, intentos, ultimoEnvio, fecha, fechaMejor
//                                        [, descalificado] }  lectura pública
//
// El envío es UN batch: (claves si es nuevo) + envio + ranking. Las reglas usan
// getAfter() para comprobar que el ranking solo cambia con un envío nuevo de ese
// mismo alias y con la contraseña correcta, sin que la contraseña sea pública.

import { db } from '../firebase';
import { doc, collection, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { COMP_RETO_SEMANA } from '../utils/retoLink';

export const ADMIN_RETO_SEMANA = 'goladen@gmail.com';
export const RUTA_RETO_SEMANA = '/retosemana';
export const COL_RETOS = 'retos_semana';

/** Id estable del alias (minúsculas, sin tildes ni símbolos): «Ana López» → «ana-lopez». */
export const idAlias = (alias) => String(alias || '')
    .trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

export const ms = (t) => (t?.toMillis ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : 0)));

/** 'activo' | 'proximo' | 'terminado' | 'borrador' */
export const estadoReto = (r, ahora = Date.now()) => {
    if (!r?.publicado) return 'borrador';
    if (ahora < ms(r.inicio)) return 'proximo';
    if (ahora > ms(r.fin)) return 'terminado';
    return 'activo';
};

/** Ordena el ranking: más puntos primero; a igualdad, quien lo consiguió antes. */
export const ordenarRanking = (filas) => filas
    .filter(f => !f.descalificado)
    .sort((a, b) => (b.mejor - a.mejor) || (ms(a.fechaMejor) - ms(b.fechaMejor)));

/** Enlace del juego del reto, con el contexto &comp=semana&cat=<rid>. */
export const rutaJuegoReto = (r) => r?.herramientaRuta || '';

// Alias y contraseña recordados en este dispositivo (para no reescribirlos cada semana)
const K_ALIAS = 'pikt_semana_alias', K_CLAVE = 'pikt_semana_clave';
export const aliasGuardado = () => { try { return localStorage.getItem(K_ALIAS) || ''; } catch (_) { return ''; } };
export const claveGuardada = () => { try { return localStorage.getItem(K_CLAVE) || ''; } catch (_) { return ''; } };
export const recordarJugador = (alias, clave) => {
    try { localStorage.setItem(K_ALIAS, alias); if (clave) localStorage.setItem(K_CLAVE, clave); else localStorage.removeItem(K_CLAVE); } catch (_) {}
};

/** Fechas por defecto: de lunes 00:00 a domingo 23:59 (esta semana si hoy es lunes; si no, la siguiente). */
export const semanaPorDefecto = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const dia = d.getDay(); // 0 domingo … 1 lunes
    const hastaLunes = dia === 1 ? 0 : ((8 - dia) % 7);
    const inicio = new Date(d); inicio.setDate(d.getDate() + hastaLunes);
    const fin = new Date(inicio); fin.setDate(inicio.getDate() + 6); fin.setHours(23, 59, 0, 0);
    return { inicio, fin };
};

export const fechaCorta = (t) => {
    const v = ms(t); if (!v) return '';
    return new Date(v).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * Envía una puntuación al reto. Devuelve { mejor, intentos, mejorado, nuevo }.
 * Lanza Error con `code`: 'alias' (alias vacío/no válido), 'descalificado',
 * 'clave' (contraseña incorrecta o alias de otra persona), 'cerrado'.
 */
export async function enviarPuntuacionReto(retoId, { alias, clave, puntos, detalle = null, juego = null, uid = null }) {
    const aid = idAlias(alias);
    if (aid.length < 2) throw Object.assign(new Error('alias'), { code: 'alias' });
    const p = Math.max(0, Math.round(Number(puntos) || 0));

    const base = doc(db, COL_RETOS, retoId);
    const rankRef = doc(base, 'ranking', aid);
    const envioRef = doc(collection(base, 'envios'));

    const [retoSnap, rankSnap] = await Promise.all([getDoc(base), getDoc(rankRef)]);
    if (!retoSnap.exists() || estadoReto(retoSnap.data()) !== 'activo') throw Object.assign(new Error('cerrado'), { code: 'cerrado' });
    const prev = rankSnap.exists() ? rankSnap.data() : null;
    if (prev?.descalificado) throw Object.assign(new Error('descalificado'), { code: 'descalificado' });

    const nombre = prev?.alias || String(alias).trim().slice(0, 24);
    const b = writeBatch(db);
    if (!prev) b.set(doc(base, 'claves', aid), { alias: nombre, clave });
    b.set(envioRef, {
        aliasId: aid, alias: nombre, puntos: p, clave,
        detalle: detalle && typeof detalle === 'object' ? detalle : null,
        juego: juego || null, uid: uid || null, fecha: serverTimestamp(),
    });
    const mejorado = !prev || p > (prev.mejor || 0);
    if (!prev) {
        b.set(rankRef, { alias: nombre, mejor: p, intentos: 1, ultimoEnvio: envioRef.id, fecha: serverTimestamp(), fechaMejor: serverTimestamp() });
    } else {
        b.update(rankRef, {
            mejor: mejorado ? p : prev.mejor,
            intentos: (prev.intentos || 0) + 1,
            ultimoEnvio: envioRef.id,
            fecha: serverTimestamp(),
            ...(mejorado ? { fechaMejor: serverTimestamp() } : {}),
        });
    }
    try {
        await b.commit();
    } catch (e) {
        if (String(e.code || e.message).includes('permission')) throw Object.assign(new Error('clave'), { code: 'clave' });
        throw e;
    }
    return { mejor: mejorado ? p : prev.mejor, intentos: (prev?.intentos || 0) + 1, mejorado, nuevo: !prev };
}

export { COMP_RETO_SEMANA };
