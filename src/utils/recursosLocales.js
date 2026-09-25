// Recursos guardados SOLO en este dispositivo (localStorage), para quien crea
// material sin iniciar sesión. No se sincronizan: si el usuario cambia de
// dispositivo o borra los datos del navegador, se pierden. Por eso siempre hay
// que avisarle al guardar.
//
// Guarda además un BORRADOR del editor, para no perder el trabajo si se cierra
// la pestaña, falla el login o se recarga sin querer.

const KEY_RECURSOS = 'piktRecursosLocales';
const KEY_BORRADOR = 'piktBorradorEditor';
const MAX_RECURSOS = 40;

const leer = (key, porDefecto) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : porDefecto;
    } catch { return porDefecto; }
};

const escribir = (key, valor) => {
    try { localStorage.setItem(key, JSON.stringify(valor)); return true; }
    catch { return false; }   // cuota llena o navegación privada
};

// ─────────────────────────── Recursos ───────────────────────────

/** Todos los recursos locales, el más reciente primero. */
export function listarRecursosLocales(tipoJuego = null) {
    const lista = leer(KEY_RECURSOS, []);
    if (!Array.isArray(lista)) return [];
    const orden = [...lista].reverse();
    return tipoJuego ? orden.filter(r => r.tipoJuego === tipoJuego) : orden;
}

export function getRecursoLocal(id) {
    return listarRecursosLocales().find(r => r.id === id) || null;
}

/**
 * Guarda (o actualiza, si el id ya existe) un recurso en el dispositivo.
 * Devuelve el recurso guardado, o null si el navegador no deja escribir.
 */
export function guardarRecursoLocal(recurso) {
    const lista = leer(KEY_RECURSOS, []);
    const base = Array.isArray(lista) ? lista : [];
    const id = recurso.id && String(recurso.id).startsWith('local_')
        ? recurso.id
        : 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const guardado = {
        ...recurso,
        id,
        esLocal: true,
        profesorNombre: recurso.profesorNombre || 'Este dispositivo',
        fechaCreacion: recurso.fechaCreacion || new Date().toISOString(),
        fechaGuardado: new Date().toISOString(),
    };

    const i = base.findIndex(r => r.id === id);
    if (i >= 0) base[i] = guardado; else base.push(guardado);

    return escribir(KEY_RECURSOS, base.slice(-MAX_RECURSOS)) ? guardado : null;
}

/** Borra un recurso local. Devuelve cuántos quedan. */
export function borrarRecursoLocal(id) {
    const lista = leer(KEY_RECURSOS, []);
    const base = (Array.isArray(lista) ? lista : []).filter(r => r.id !== id);
    escribir(KEY_RECURSOS, base);
    return base.length;
}

// ─────────────────────────── Borrador ───────────────────────────

/** Guarda el estado del editor en curso (se sobrescribe siempre). */
export function guardarBorrador(clave, datos) {
    return escribir(KEY_BORRADOR, { clave, datos, fecha: new Date().toISOString() });
}

/** Devuelve el borrador de esa clave si existe, o null. */
export function leerBorrador(clave) {
    const b = leer(KEY_BORRADOR, null);
    return b && b.clave === clave ? b : null;
}

export function borrarBorrador() {
    try { localStorage.removeItem(KEY_BORRADOR); } catch { /* sin localStorage */ }
}
