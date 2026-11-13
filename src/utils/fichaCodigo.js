// ─── Código corto de una ficha PDF de juego ──────────────────────────────────
// Cada ficha impresa (Invasión Pi, fichas de recursos…) lleva un código tipo «FK7P3QX».
// Se escribe en el buscador de códigos de pikt.es o se escanea su QR (/?fc=CÓDIGO) y abre
// el juego con ESAS preguntas en ESE orden, en cualquier dispositivo y sin iniciar sesión.
//
// fichas_juego/{CÓDIGO} = {
//   juego, titulo, creadoEn, uid?,
//   enlace?  → ruta relativa que ya sabe reconstruir la partida (Invasión Pi: /invasores?ficha=…)
//   recurso? → copia CONGELADA del recurso con las hojas y preguntas en el orden del PDF
//              (así da igual que el profe edite o borre el recurso después)
//   modo?    → m= del GamePlayer (BURBUJAS, TEST, CALAMAR, MONEYBOARD…)
// }
// Las reglas solo permiten crear (no modificar): si el código ya existe, setDoc falla y se prueba otro.
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const COL = 'fichas_juego';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para que no se confundan al teclear

const limpio = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
/** ¿Parece un código de ficha? (F + 6 caracteres) */
export const esCodigoFicha = (c) => /^F[A-HJ-NP-Z2-9]{6}$/.test(limpio(c));
export const urlCodigoFicha = (c) => `${window.location.origin}/?fc=${limpio(c)}`;

const nuevoCodigo = () => {
    const n = new Uint32Array(6);
    try { crypto.getRandomValues(n); } catch { for (let i = 0; i < 6; i++) n[i] = Math.floor(Math.random() * 1e9); }
    return 'F' + [...n].map(x => ALFABETO[x % ALFABETO.length]).join('');
};

// Firestore no admite undefined ni arrays dentro de arrays: copia «segura» del recurso
const sinIndefinidos = (v) => JSON.parse(JSON.stringify(v ?? null));

/**
 * Crea el código de una ficha. datos: { juego, titulo, enlace? (texto o (código) => texto), recurso?, modo? }
 * Devuelve el código, o null si no se pudo guardar (sin conexión, reglas sin publicar…):
 * la ficha se genera igualmente, solo que sin código.
 */
export async function crearCodigoFicha({ juego, titulo = '', enlace = null, recurso = null, modo = null }) {
    const datos = {
        juego: String(juego || '').slice(0, 40),
        titulo: String(titulo || '').slice(0, 150),
        creadoEn: serverTimestamp(),
    };
    if (auth.currentUser?.uid) datos.uid = auth.currentUser.uid;
    if (modo) datos.modo = String(modo).slice(0, 40);
    if (recurso) datos.recurso = sinIndefinidos(recurso);
    for (let intento = 0; intento < 4; intento++) {
        const codigo = nuevoCodigo();
        // enlace puede depender del código (función): así el juego lo recuerda para reimprimir
        const ruta = typeof enlace === 'function' ? enlace(codigo) : enlace;
        try {
            await setDoc(doc(db, COL, codigo), ruta ? { ...datos, enlace: String(ruta).slice(0, 2500) } : datos);
            return codigo;
        } catch (e) {
            // permission-denied puede ser que el código ya exista (no se permite sobrescribir): otro intento
            if (e?.code !== 'permission-denied') { console.warn('[Código de ficha]', e); return null; }
        }
    }
    return null;
}

/** Lee la ficha de un código (o null si no existe). */
export async function leerCodigoFicha(codigo) {
    const c = limpio(codigo);
    if (!esCodigoFicha(c)) return null;
    const snap = await getDoc(doc(db, COL, c));
    return snap.exists() ? { codigo: c, ...snap.data() } : null;
}

/** Recurso listo para el GamePlayer: la copia congelada, en orden fijo (sin barajar). */
export function recursoDeFicha(ficha) {
    const r = ficha?.recurso;
    if (!r) return null;
    return { ...r, config: { ...(r.config || {}), aleatorio: false }, ordenFicha: ficha.codigo };
}

/** Abre la ficha: o el enlace del juego, o el recurso congelado. Devuelve { recurso, modo } o redirige. */
export async function abrirCodigoFicha(codigo) {
    const f = await leerCodigoFicha(codigo);
    if (!f) throw new Error('No existe ninguna ficha con ese código.');
    if (f.recurso) return { recurso: recursoDeFicha(f), modo: f.modo || null };
    if (f.enlace) { window.location.href = `${window.location.origin}${f.enlace.startsWith('/') ? '' : '/'}${f.enlace}`; return null; }
    throw new Error('Esta ficha no se puede abrir.');
}
