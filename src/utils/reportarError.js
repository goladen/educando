// Registro de fallos de la web en Firestore (colección errores_web).
//
//   reportarError(servicio, error, contexto?) → para usar en los catch de
//   servicios concretos: reportarError('cloudinary', e, { carpeta })
//
//   instalarCapturaErrores() → se llama una vez en main.jsx y registra solo:
//     · errores JS sin capturar y promesas rechazadas sin catch
//     · respuestas 5xx / fallos de red de fetch a /api/* y a Cloudinary
//
// Un documento por fallo (las reglas solo permiten crear); el panel del admin
// (ErroresWebPanel) los agrupa por `firma`. Para no inundar Firestore, en cada
// pestaña la misma firma se envía como mucho una vez cada 10 min y hay un
// tope de envíos por sesión.

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const MAX_POR_SESION = 25;
const REPETIR_TRAS_MS = 10 * 60 * 1000;
const enviados = new Map();   // firma → ms del último envío
let total = 0;

const recortar = (s, n) => (s == null ? '' : String(s)).slice(0, n);

// Mensaje sin números, ids ni urls concretas → agrupa el "mismo" error
const normalizar = (m) => String(m || '')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '#')
    .replace(/\d+/g, '#')
    .slice(0, 200);

function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

// Ruido conocido que no se puede arreglar desde la web
const IGNORAR = [
    /ResizeObserver loop/i,
    /^Script error\.?$/i,                 // script de otro origen sin detalles
    /chrome-extension:|moz-extension:|safari-extension:/i,
    /Non-Error promise rejection captured/i,
    /AbortError|The user aborted a request|signal is aborted/i,
];

export function reportarError(servicio, error, contexto = {}) {
    try {
        const mensaje = recortar(error?.message ?? error, 1000) || 'Error sin mensaje';
        const stack = recortar(error?.stack, 3000);
        if (IGNORAR.some(re => re.test(mensaje) || re.test(stack))) return;

        const firma = hash(`${servicio}|${normalizar(mensaje)}`);
        const ahora = Date.now();
        if (total >= MAX_POR_SESION) return;
        if (ahora - (enviados.get(firma) || 0) < REPETIR_TRAS_MS) return;
        enviados.set(firma, ahora);
        total++;

        const u = auth.currentUser;
        const ctx = {};
        for (const [k, v] of Object.entries(contexto || {}).slice(0, 10)) {
            ctx[recortar(k, 40)] = typeof v === 'number' || typeof v === 'boolean' ? v : recortar(typeof v === 'object' ? JSON.stringify(v) : v, 300);
        }

        addDoc(collection(db, 'errores_web'), {
            servicio: recortar(servicio, 60),
            mensaje,
            stack,
            firma,
            contexto: ctx,
            ruta: recortar(location.pathname + location.search, 300),
            navegador: recortar(navigator.userAgent, 300),
            uid: u?.uid || null,
            anonimo: u ? !!u.isAnonymous : null,
            fecha: serverTimestamp(),
        }).catch(() => { /* sin conexión o reglas: no hay nada más que hacer */ });
    } catch { /* el registro nunca debe romper la web */ }
}

// ── captura automática ─────────────────────────────────────────────────────
// Servicio a partir de la url: /api/listening-tts → "api/listening-tts"
function servicioDeUrl(url) {
    try {
        const u = new URL(url, location.href);
        if (u.origin === location.origin && u.pathname.startsWith('/api/')) return 'api/' + u.pathname.slice(5).split('/')[0];
        if (u.hostname === 'api.cloudinary.com') return 'cloudinary';
    } catch { /* url rara */ }
    return null;
}

let instalado = false;

export function instalarCapturaErrores() {
    if (instalado || typeof window === 'undefined') return;
    instalado = true;

    window.addEventListener('error', (e) => {
        // Fallo al cargar un recurso (img/script) → e.error es null; solo nos
        // interesan los errores de código
        if (!e.error && !e.message) return;
        reportarError('js', e.error || e.message, { origen: `${e.filename || ''}:${e.lineno || ''}` });
    });
    window.addEventListener('unhandledrejection', (e) => {
        reportarError('promesa', e.reason || 'Promesa rechazada');
    });

    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        const servicio = url && servicioDeUrl(url);
        if (!servicio) return fetchOriginal(input, init);
        const metodo = (init?.method || input?.method || 'GET').toUpperCase();
        let res;
        try {
            res = await fetchOriginal(input, init);
        } catch (e) {
            if (e?.name !== 'AbortError') reportarError(servicio, `Sin conexión: ${e?.message || e}`, { metodo, red: true });
            throw e;
        }
        if (res.status >= 500) {
            // Leer el motivo de una copia sin bloquear a quien hizo la llamada
            res.clone().text().then((txt) => {
                let detalle = txt;
                try { const j = JSON.parse(txt); detalle = j?.error?.message || j?.error || j?.message || txt; } catch { /* no es JSON */ }
                reportarError(servicio, `HTTP ${res.status}: ${recortar(detalle, 600)}`, { metodo, estado: res.status });
            }).catch(() => reportarError(servicio, `HTTP ${res.status}`, { metodo, estado: res.status }));
        }
        return res;
    };
}
