// ─── Retos por enlace ─────────────────────────────────────────────────────────
// Un "reto" es un enlace que abre una herramienta (Cálculo Mental, Fracciones…)
// con una configuración FIJA, igual para todos los participantes: mismo tiempo,
// mismo rango de números, mismos tipos de operaciones…
//
// La configuración viaja dentro de la propia URL (?reto=<json en base64url>),
// así que el enlace funciona sin login, sin Firestore y sin reglas: cualquiera
// que lo abra juega exactamente con los mismos ajustes.
//
//   crearEnlaceReto('/calculo', config, { titulo: 'Reto de 2ºB' })
//     → https://pikt.es/calculo?reto=eyJ0aWVtcG8iOjEyMH0&t=Reto%20de%202%C2%BAB
//   leerRetoUrl() en el juego → { config, titulo } o null

const b64urlEncode = (texto) => {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlDecode = (texto) => {
    const base = texto.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(base + '='.repeat((4 - base.length % 4) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

export const codificarReto = (config) => b64urlEncode(JSON.stringify(config || {}));

export const decodificarReto = (texto) => {
    try {
        const obj = JSON.parse(b64urlDecode(String(texto || '')));
        return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : null;
    } catch (_) { return null; }
};

/**
 * Ruta relativa del reto (ej: '/calculo?reto=…&t=…').
 * Es lo que conviene GUARDAR en Firestore: así el enlace sirve en cualquier
 * dominio (pikt.es, localhost, preview…).
 */
export const crearRutaReto = (ruta, config, { titulo, compId, catId } = {}) => {
    const p = new URLSearchParams();
    p.set('reto', codificarReto(config));
    if (titulo && titulo.trim()) p.set('t', titulo.trim());
    // Contexto de competición: el resultado irá a esa prueba, no a informes
    if (compId) p.set('comp', compId);
    if (catId)  p.set('cat', catId);
    // Hay herramientas que se abren con query (ej: '/?juego=biologia')
    return `${ruta}${ruta.includes('?') ? '&' : '?'}${p.toString()}`;
};

/** Convierte una ruta relativa de reto en enlace absoluto para compartir. */
export const enlaceAbsoluto = (rutaReto) => {
    const origen = typeof window !== 'undefined' ? window.location.origin : 'https://pikt.es';
    return `${origen}${rutaReto.startsWith('/') ? '' : '/'}${rutaReto}`;
};

/** Construye el enlace absoluto del reto para una ruta pública (ej: '/calculo'). */
export const crearEnlaceReto = (ruta, config, opciones = {}) => enlaceAbsoluto(crearRutaReto(ruta, config, opciones));

/** Lee el reto de la URL actual (o de la cadena que se le pase). */
export const leerRetoUrl = (busqueda) => {
    if (typeof window === 'undefined' && busqueda === undefined) return null;
    const p = new URLSearchParams(busqueda !== undefined ? busqueda : window.location.search);
    const bruto = p.get('reto');
    if (!bruto) return null;
    const config = decodificarReto(bruto);
    if (!config) return null;
    return {
        config,
        titulo: (p.get('t') || '').trim(),
        compId: p.get('comp') || null,   // competición a la que enviar el resultado
        catId:  p.get('cat') || null,    // prueba/categoría concreta
    };
};

/** Quita ?reto=… de la barra de direcciones (al pasar a modo libre). */
export const limpiarRetoUrl = () => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    p.delete('reto'); p.delete('t'); p.delete('comp'); p.delete('cat');
    const q = p.toString();
    window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : ''));
};
