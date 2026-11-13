// «Mis problemas»: problemas de las fichas de los simuladores de Física y Química que un profe
// decide guardar (colección problemas_guardados, un documento por problema, solo los ve su dueño).
// Se guardan como texto (enunciado, solución y pasos) para poder reutilizarlos en otras fichas.
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { textoSoluciones } from './ecuacionesAvanzadas';

const COL = 'problemas_guardados';

/** Usuario con cuenta (no anónimo) o null. */
export function usuarioRegistrado() {
    const u = auth.currentUser;
    return u && !u.isAnonymous ? u : null;
}

const corto = (s, n) => String(s ?? '').slice(0, n);

/** Problema de la ficha (generado o propio) → datos planos para guardar. */
export function aGuardable(eq) {
    if (eq.propio) return { enunciado: corto(eq.enunciadoEd, 4000), solucion: corto(eq.solucionPropia, 4000), pasos: (eq.pasos || []).map(p => corto(p, 1000)).slice(0, 30), tipoEcu: corto(eq.tipoEcu, 100), propio: true };
    let solucion = '';
    try { solucion = textoSoluciones(eq); } catch { solucion = ''; }
    return {
        enunciado: corto(eq.enunciadoEd ?? eq.ast?.[0]?.v, 4000),
        solucion: corto(solucion, 4000),
        pasos: (eq.pasos || []).map(p => corto(typeof p === 'string' ? p : JSON.stringify(p), 1000)).slice(0, 30),
        tema: corto(eq.tema, 200), materia: corto(eq.materia, 100), tipoEcu: corto(eq.tipoEcu, 100),
        editado: eq.enunciadoEd != null, propio: false,
    };
}

export async function cargarMisProblemas() {
    const u = usuarioRegistrado();
    if (!u) return [];
    const snap = await getDocs(query(collection(db, COL), where('uid', '==', u.uid)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
}

/** Guarda los problemas (sin repetir enunciados ya guardados). Devuelve cuántos guardó. */
export async function guardarProblemas(problemas, { simKey, simNombre, area } = {}, yaGuardados = []) {
    const u = usuarioRegistrado();
    if (!u) throw new Error('Inicia sesión para guardar tus problemas.');
    const vistos = new Set(yaGuardados.map(p => p.enunciado));
    let n = 0;
    for (const eq of problemas) {
        const g = aGuardable(eq);
        if (!g.enunciado.trim() || vistos.has(g.enunciado)) continue;
        vistos.add(g.enunciado);
        await addDoc(collection(db, COL), { ...g, uid: u.uid, simKey: simKey || '', simNombre: corto(simNombre, 120), area: area || '', creadoEn: serverTimestamp() });
        n++;
    }
    return n;
}

export const borrarProblemaGuardado = (id) => deleteDoc(doc(db, COL, id));

/** Problema guardado → problema de la ficha (se trata como propio: su solución es texto). */
export const aProblemaFicha = (g) => ({ propio: true, guardadoId: g.id, enunciadoEd: g.enunciado, solucionPropia: g.solucion, pasos: g.pasos || [], tipoEcu: g.tipoEcu || undefined });

// ─── Banco de problemas (tarjeta «Banco de problemas» de Física y Química) ──
export const MATERIA_FQ = { 'Física': '⚛️ Física', 'Química': '🧪 Química' };

/**
 * Guarda problemas escritos o importados de una ficha: [{ tema, materia: 'Física'|'Química', enunciado, solucion, pasos[] }].
 * Sin repetir enunciados ya guardados. Devuelve cuántos guardó.
 */
export async function guardarEnBanco(items, yaGuardados = [], origen = 'banco') {
    const u = usuarioRegistrado();
    if (!u) throw new Error('Inicia sesión para guardar tus problemas.');
    const vistos = new Set(yaGuardados.map(p => p.enunciado));
    let n = 0;
    for (const x of items) {
        const enunciado = corto(x.enunciado, 4000).trim();
        if (!enunciado || vistos.has(enunciado)) continue;
        vistos.add(enunciado);
        await addDoc(collection(db, COL), {
            uid: u.uid, enunciado, solucion: corto(x.solucion, 4000), pasos: (x.pasos || []).map(p => corto(p, 1000)).slice(0, 30),
            tema: corto(x.tema, 200) || 'Sin tema', materia: MATERIA_FQ[x.materia] || x.materia || MATERIA_FQ['Física'],
            propio: true, origen, simKey: '', simNombre: '', area: x.materia === 'Química' || String(x.materia).includes('Química') ? 'Química' : 'Física',
            creadoEn: serverTimestamp(),
        });
        n++;
    }
    return n;
}
