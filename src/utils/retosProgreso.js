// Progreso de la Sala de Retos (Conecta los Puntos, Sudoku y El Juego de las Luces).
// Guarda qué niveles ha superado el alumno para que NO se pierdan al recargar:
//   - Siempre en el dispositivo (localStorage).
//   - Además en Firebase si el usuario está registrado (sincroniza entre dispositivos).
//
// Forma de los datos: { CONECTA: [1,2], SUDOKU: ['FÁCIL'], SWITCHON: [1,3] }

import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const KEY = 'retosProgreso';

function leer() {
    try {
        const raw = localStorage.getItem(KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === 'object' ? obj : {};
    } catch {
        return {};
    }
}

function escribir(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* silencioso */ }
}

/** Progreso completo guardado en el dispositivo. */
export function getProgreso() {
    return leer();
}

/**
 * Marca un nivel como superado para un juego (idempotente).
 * @returns {{ progreso: object, esNuevo: boolean }}
 */
export function marcarNivelCompletado(juego, nivel) {
    const todo = leer();
    const lista = Array.isArray(todo[juego]) ? todo[juego] : [];
    const esNuevo = !lista.includes(nivel);
    if (esNuevo) {
        lista.push(nivel);
        todo[juego] = lista;
        escribir(todo);
    }
    return { progreso: todo, esNuevo };
}

/** Une dos mapas de progreso quedándose con la unión de niveles de cada juego. */
function fusionar(a = {}, b = {}) {
    const out = {};
    const juegos = new Set([...Object.keys(a), ...Object.keys(b)]);
    juegos.forEach((j) => {
        const la = Array.isArray(a[j]) ? a[j] : [];
        const lb = Array.isArray(b[j]) ? b[j] : [];
        out[j] = [...new Set([...la, ...lb])];
    });
    return out;
}

/**
 * Carga el progreso de Firebase (si hay uid), lo fusiona con el local y lo
 * deja guardado en el dispositivo. Devuelve el progreso fusionado.
 */
export async function cargarProgresoFirebase(uid) {
    if (!uid) return leer();
    try {
        const snap = await getDoc(doc(db, 'retos_progreso', uid));
        const remoto = snap.exists() ? (snap.data().juegos || {}) : {};
        const fusion = fusionar(leer(), remoto);
        escribir(fusion);
        return fusion;
    } catch {
        return leer();
    }
}

/** Sube el progreso local a Firebase (si hay uid). */
export async function guardarProgresoFirebase(uid) {
    if (!uid) return;
    try {
        await setDoc(
            doc(db, 'retos_progreso', uid),
            { juegos: leer(), actualizado: new Date() },
            { merge: true }
        );
    } catch { /* silencioso */ }
}
