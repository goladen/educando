// Hojas interactivas de Física y Química: una ficha generada (simulador o banco de problemas)
// se guarda en hojas_interactivas y se comparte con /?hojafq=ID. El alumno la responde en el
// navegador (test + problemas con corrección numérica) y envía el resultado a informes_juegos
// (tipo HOJA_FQ, tarjeta en InformesJuegos2).
import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { textoSoluciones, parseListaSoluciones } from './ecuacionesAvanzadas';
import { usuarioRegistrado } from './misProblemas';

const COL = 'hojas_interactivas';
const corto = (s, n) => String(s ?? '').slice(0, n);

// ─── Números de una solución o respuesta ─────────────────────────────────────
// «t = 3 s ; v = 2,5 m/s» → [3, 2.5] · «3,2·10⁻³ mol» → [0.0032] · sin números → []
// (primero «10⁻⁶» / «10^-6» sin número delante, luego 3 · 2,5 · 3,2·10⁻³ · 6e-5)
const NUM = /^[-−]?(?:10\s*(?:\^\s*\(?[-−]?\d+\)?|[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)|\d+(?:[.,]\d+)?(?:\s*[·x×*]\s*10\s*(?:\^\s*\(?[-−]?\d+\)?|[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)|[eE][-−]?\d+)?)/;
export function numerosDeTexto(txt) {
    const partes = String(txt ?? '').split(/[;\n]|\s+y\s+/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const p of partes) {
        const seg = (p.includes('=') ? p.split('=').pop() : p).trim().replace(/^[^\d−-]+/, '');
        const m = seg.match(NUM);
        if (!m) return [];
        const v = parseListaSoluciones(m[0].replace(/\s+/g, ''))[0];
        if (!isFinite(v)) return [];
        out.push(v);
    }
    return out;
}

/** ¿La respuesta del alumno coincide con la solución? (tolerancia relativa para redondeos) */
export function respuestaCorrecta(comprobar, txt) {
    if (!comprobar?.valores?.length) return null;
    let vals = numerosDeTexto(txt);
    if (vals.length !== comprobar.valores.length) return false;
    if (comprobar.grados) vals = vals.map(v => ((v % 360) + 360) % 360);
    const a = [...vals].sort((x, y) => x - y), c = [...comprobar.valores].sort((x, y) => x - y);
    const tol = (x) => Math.max(1e-9, comprobar.tol || 0, (comprobar.tolRel || 0.01) * Math.abs(x));
    return a.every((v, i) => Math.abs(v - c[i]) <= tol(c[i]));
}

/** Problema de la ficha (generado o propio) → datos de la hoja interactiva. */
function problemaHoja(eq) {
    if (eq.propio) {
        const valores = numerosDeTexto(eq.solucionPropia);
        return {
            enunciado: corto(eq.enunciadoEd, 4000), solucion: corto(eq.solucionPropia, 1000),
            pasos: (eq.pasos || []).map(p => corto(p, 800)).slice(0, 25),
            comprobar: valores.length ? { valores, tolRel: 0.02 } : null, instruccion: '',
        };
    }
    let solucion = '';
    try { solucion = textoSoluciones(eq); } catch { solucion = ''; }
    const valores = (eq.correctAnswers || []).filter(v => isFinite(v));
    return {
        enunciado: corto(eq.enunciadoEd ?? eq.ast?.[0]?.v, 4000), solucion: corto(solucion, 1000),
        pasos: (eq.pasos || []).map(p => corto(typeof p === 'string' ? p : JSON.stringify(p), 800)).slice(0, 25),
        // Si el profe cambió el enunciado, la solución puede no valer: se corrige igual con la original
        comprobar: valores.length ? { valores, tol: eq.tol || 0, tolRel: Math.max(eq.tolRel || 0, 0.01), grados: !!eq.grados } : null,
        instruccion: corto(eq.instruccion || (eq.unidad ? `Resultado en ${eq.unidad}` : ''), 200),
    };
}

/** Guarda la hoja y devuelve su id. contenido: { titulo, area, test, ejercicios, problemas } */
export async function guardarHojaInteractiva({ titulo, area = 'Física', test = [], ejercicios = [], problemas = [], origen = '' }) {
    const u = usuarioRegistrado();
    if (!u) throw new Error('Inicia sesión para guardar y compartir la hoja.');
    let codigoProfesor = '';
    try { codigoProfesor = (await getDoc(doc(db, 'users', u.uid))).data()?.codigoProfesor || ''; } catch { /* sin código */ }
    const datos = {
        uid: u.uid, autorNombre: corto(u.displayName, 80), codigoProfesor,
        titulo: corto(titulo || 'Hoja de problemas', 150), area, origen: corto(origen, 80),
        test: test.slice(0, 60).map(q => ({ texto: corto(q.texto, 1000), opciones: (q.opciones || []).map(o => corto(o, 300)).slice(0, 6), correcta: Number(q.correcta) || 0, explicacion: corto(q.explicacion, 500) })),
        // Ejercicios de química (partículas, Lewis, ajuste): respuesta abierta con su solución
        ejercicios: ejercicios.slice(0, 40).map(e => ({ enunciado: corto(e.enunciado, 1000), solucion: corto(e.solucion, 600) })),
        problemas: problemas.slice(0, 40).map(problemaHoja).filter(p => p.enunciado.trim()),
        creadoEn: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, COL), datos);
    return { id: ref.id, codigoProfesor };
}

export async function cargarHoja(id) {
    const snap = await getDoc(doc(db, COL, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function misHojas() {
    const u = usuarioRegistrado();
    if (!u) return [];
    const snap = await getDocs(query(collection(db, COL), where('uid', '==', u.uid)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
}

export const borrarHoja = (id) => deleteDoc(doc(db, COL, id));
export const urlHoja = (id) => `${window.location.origin}/?hojafq=${id}`;
