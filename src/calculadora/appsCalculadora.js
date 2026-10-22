// Relación entre las apps de Math World y los bloques de «Uso de la calculadora».
// La usan el botón 🧮 de cada app (qué bloques abrir) y cada bloque
// (en qué apps se trabaja ese contenido). Archivo ligero: sin el contenido.

export const APPS_CALCULADORA = {
    POTENCIAS_RAICES: { nombre: 'Potencias y Raíces', emoji: '⚡', ruta: '/potencias', bloques: ['potencias', 'cientifica'] },
    FRACCIONES: { nombre: 'Fracciones', emoji: '🍰', ruta: '/fracciones', bloques: ['fracciones'] },
    CALCULO: { nombre: 'Cálculo Mental', emoji: '🧠', ruta: '/calculo', bloques: ['combinadas', 'memoria'] },
    GEOMETRIX: { nombre: 'Geometrix', emoji: '📐', ruta: '/geometrix', bloques: ['trigonometria', 'constantes', 'sexagesimal'] },
    POLINOMIOS: { nombre: 'Álgebra', emoji: '✖️', ruta: '/polinomios', bloques: ['polinomios'] },
    FUNCIONES: { nombre: 'Funciones', emoji: '📈', ruta: '/funciones', bloques: ['logaritmos', 'constantes'] },
    'GEOMETRÍA_ANALÍTICA': { nombre: 'Geometría analítica', emoji: '♐', ruta: '/geometria_analitica', bloques: ['trigonometria'] },
    DINERO: { nombre: 'Dinero', emoji: '💶', ruta: '/dinero', bloques: ['memoria', 'combinadas'] },
    ESTADISTICA: { nombre: 'Estadística', emoji: '📊', ruta: '/estadistica', bloques: ['memoria'] },
    ECUACIONES: { nombre: 'Ecuaciones', emoji: '⚖️', ruta: '/ecuaciones', bloques: ['combinadas', 'polinomios'] },
};

// bloque → [{ id, nombre, emoji, ruta }]
export const appsDeBloque = (bloqueId) => Object.entries(APPS_CALCULADORA)
    .filter(([, a]) => a.bloques.includes(bloqueId))
    .map(([id, a]) => ({ id, ...a }));

export const urlCalculadora = (bloqueId, itemId) =>
    `${window.location.origin}/calculadora${bloqueId ? `/${bloqueId}` : ''}${itemId ? `?item=${encodeURIComponent(itemId)}` : ''}`;
