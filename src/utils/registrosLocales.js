// Historial local de partidas en el dispositivo.
// Cada vez que un alumno envía resultados al profesor o guarda en el ranking,
// se almacena además una copia local aquí (localStorage), para que pueda
// consultar "Mis registros" desde LandingGames3 sin depender de Firestore.

const KEY = 'misRegistrosJuegos';
const MAX_POR_JUEGO = 100; // tope defensivo para no llenar localStorage

// Metadatos de presentación por tipo de juego (icono + nombre + color).
export const JUEGOS_REGISTRO_META = {
    PASAPALABRA:  { nombre: 'Pasapalabra',     emoji: '🔤', color: '#273c75' },
    CAZABURBUJAS: { nombre: 'Burbujas',        emoji: '🫧', color: '#0097e6' },
    PIKATRON:     { nombre: 'Pikatron',        emoji: '🏃', color: '#e1b12c' },
    APAREJADOS:   { nombre: 'AparejaDOS',      emoji: '🃏', color: '#8e44ad' },
    RULETA:       { nombre: 'Ruleta',          emoji: '🎡', color: '#e84118' },
    WORDLE:       { nombre: 'WordLe',          emoji: '🔡', color: '#44bd32' },
    MATHLE:       { nombre: 'MathLe',          emoji: '🔢', color: '#0097e6' },
    SOPA:         { nombre: 'Sopa de letras',  emoji: '🔎', color: '#487eb0' },
    // --- Resto de juegos y herramientas ---
    CALCULO:             { nombre: 'Cálculo Mental',      emoji: '🧮', color: '#e67e22' },
    DIVISIBILIDAD:       { nombre: 'Divisibilidad',       emoji: '➗', color: '#16a085' },
    ALGEBRA:             { nombre: 'Álgebra',             emoji: '🅰️', color: '#9b59b6' },
    OCA:                 { nombre: 'Oca Matemática',      emoji: '🎲', color: '#27ae60' },
    OAOA:                { nombre: 'Mates OAOA',          emoji: '🔢', color: '#2980b9' },
    ECUACIONES:          { nombre: 'Ecuaciones',          emoji: '🟰', color: '#c0392b' },
    FUNCIONES:           { nombre: 'Funciones',           emoji: '📈', color: '#2c3e50' },
    FUNCIONES_ANALISIS:  { nombre: 'Análisis Funciones',  emoji: '📉', color: '#34495e' },
    GEOMETRIX_COMPUESTO: { nombre: 'Geometrix',           emoji: '📐', color: '#d35400' },
    PERIMETRO_AREA:      { nombre: 'Perímetro y Área',    emoji: '📏', color: '#16a085' },
    ETIQUETAS:           { nombre: 'EtiquetaMe',          emoji: '🏷️', color: '#e74c3c' },
    MEMORIA:             { nombre: 'Memoria',             emoji: '🧩', color: '#8e44ad' },
    RETOS:               { nombre: 'Sala de Retos',       emoji: '🧩', color: '#f39c12' },
    FUTBOLQUIZZ:         { nombre: 'Fútbol Quizz',        emoji: '⚽', color: '#16a085' },
    LINEA_TIEMPO:        { nombre: 'Línea del Tiempo',    emoji: '🕰️', color: '#2980b9' },
    IMPERIOS:            { nombre: 'Imperios',            emoji: '🏛️', color: '#b45309' },
    STORYCUBES:          { nombre: 'Story Cubes',         emoji: '🎲', color: '#e67e22' },
    PUZZLE_IMAGENES:     { nombre: 'Puzzle de Imágenes',  emoji: '🧩', color: '#6c5ce7' },
    PLATAFORMAS:         { nombre: 'Plataformas',         emoji: '🕹️', color: '#6c5ce7' },
    LISTENING:           { nombre: 'Listening',           emoji: '🎧', color: '#8e44ad' },
    OMNINTERACTIVE:      { nombre: 'Omninteractive',      emoji: '📚', color: '#6D28D9' },
    IRREGULAR_VERBS:     { nombre: 'Irregular Verbs',     emoji: '📝', color: '#0369a1' },
    FUNCIONES_EJECUTIVAS:{ nombre: 'Funciones Ejecutivas',emoji: '🧠', color: '#FF5722' },
    PARTES_PLANTA:       { nombre: 'Partes de la Planta', emoji: '🌱', color: '#27ae60' },
    ATOMOS_TEST:         { nombre: 'Átomos',              emoji: '⚛️', color: '#2c3e50' },
    MUSIC_GAMES:         { nombre: 'Música',              emoji: '🎵', color: '#8b5cf6' },
    MUSIC_COMPASS:       { nombre: 'Compás Musical',      emoji: '🎼', color: '#9b59b6' },
    MANSION_PITAGORICA:  { nombre: 'Mansión Pitagórica',  emoji: '🏛️', color: '#7f8c8d' },
    KARTINGED:           { nombre: 'Karting',             emoji: '🏎️', color: '#e84118' },
    KARTINGED_TRACK:     { nombre: 'Karting',             emoji: '🏁', color: '#2d3436' },
    KARTINGED_MULTI:     { nombre: 'Karting Multi',       emoji: '🏎️', color: '#0984e3' },
};

export const metaDe = (tipo) => JUEGOS_REGISTRO_META[tipo] || { nombre: tipo, emoji: '🎮', color: '#718093' };

function leerTodo() {
    try {
        const raw = localStorage.getItem(KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === 'object' ? obj : {};
    } catch {
        return {};
    }
}

function guardarTodo(obj) {
    try {
        localStorage.setItem(KEY, JSON.stringify(obj));
    } catch {
        // Silencioso: nunca debe romper el flujo de juego.
    }
}

/**
 * Añade un registro local para un juego.
 * @param {string} tipo  - identificador del juego (PASAPALABRA, CAZABURBUJAS, ...)
 * @param {object} datos - { titulo, aciertos, intentos, porcentaje, nombre, curso, via }
 */
export function guardarRegistroLocal(tipo, datos = {}) {
    if (!tipo) return;
    try {
        const todo = leerTodo();
        const lista = Array.isArray(todo[tipo]) ? todo[tipo] : [];
        const aciertos = Number(datos.aciertos) || 0;
        const intentos = Number(datos.intentos) || 0;
        const porcentaje = datos.porcentaje != null
            ? Number(datos.porcentaje)
            : (intentos > 0 ? Math.round((aciertos / intentos) * 100) : 0);

        lista.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            fecha: new Date().toISOString(),
            titulo: datos.titulo || '',
            aciertos,
            intentos,
            porcentaje,
            nombre: datos.nombre || '',
            curso: datos.curso || '',
            via: datos.via || '',
        });

        // Mantener solo los últimos MAX_POR_JUEGO
        todo[tipo] = lista.slice(-MAX_POR_JUEGO);
        guardarTodo(todo);
    } catch {
        // Silencioso.
    }
}

/** Resumen para la rejilla: solo juegos con registros. */
export function getResumenRegistros() {
    const todo = leerTodo();
    return Object.keys(todo)
        .filter((tipo) => Array.isArray(todo[tipo]) && todo[tipo].length > 0)
        .map((tipo) => ({ tipo, count: todo[tipo].length, ...metaDe(tipo) }));
}

/** Registros de un juego, más reciente primero. */
export function getRegistrosPorTipo(tipo) {
    const todo = leerTodo();
    return Array.isArray(todo[tipo]) ? todo[tipo].slice().reverse() : [];
}

/** Borra un registro concreto. Devuelve cuántos quedan en ese juego. */
export function borrarRegistro(tipo, id) {
    const todo = leerTodo();
    if (!Array.isArray(todo[tipo])) return 0;
    todo[tipo] = todo[tipo].filter((r) => r.id !== id);
    if (todo[tipo].length === 0) delete todo[tipo];
    guardarTodo(todo);
    return todo[tipo] ? todo[tipo].length : 0;
}

/** Borra todos los registros de un juego. */
export function borrarTipo(tipo) {
    const todo = leerTodo();
    if (todo[tipo]) {
        delete todo[tipo];
        guardarTodo(todo);
    }
}

/** Borra TODOS los registros de TODOS los juegos. */
export function borrarTodo() {
    try { localStorage.removeItem(KEY); } catch { /* silencioso */ }
}
