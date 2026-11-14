// ─────────────────────────────────────────────────────────────────────────────
//  Fuente de fichas «CAMBIO DE UNIDADES» (Math World, Física y Geometrix)
//  Los generadores viven en src/unidades/ (también los usan la herramienta,
//  Invasión Pi, los mandos y el tirón de cuerda).
//  En cada ejercicio se elige el método (categoría):
//    libre  → ejercicio típico (el dibujo sale solo en las soluciones)
//    saltos → con la escalera dibujada para contar los saltos
//    factor → con los factores de conversión en blanco para rellenar
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MAGNITUDES, MAGNITUDES_CONTEXTO } from '../../unidades/magnitudes.js';
import { generarConversion, generarCompleja, generarComparar, MAGNITUDES_COMPLEJAS, pick } from '../../unidades/generadores.js';
import { generarProblemaUnidades, MAG_PROBLEMAS } from '../../unidades/problemasUnidades.js';
import { VisualConversion } from '../../unidades/Visuales.jsx';

const CAT_METODO = [['libre', 'Ejercicio típico'], ['saltos', 'Con escalera (contar saltos)'], ['factor', 'Con factores de conversión']];
const CAT_FACTOR = [['libre', 'Ejercicio típico'], ['factor', 'Con factores de conversión']];

// En la ficha: v.verEnunciado → el dibujo también en el enunciado (escalera vacía, factores en blanco)
const adaptar = (ap) => {
    if (!ap) return null;
    const v = ap.v ? { ...ap.v, enSolucion: true, soloSolucion: !ap.v.verEnunciado } : undefined;
    return { ...ap, v };
};

const conv = (mag, cats = CAT_METODO, extra = {}) => ({
    label: `${MAGNITUDES[mag].emoji} ${MAGNITUDES[mag].nombre}`,
    titulo: extra.titulo || 'Expresa cada medida en la unidad indicada.',
    cols: 2, alto: 45, max: 16, categorias: cats,
    gen: (nv, cat) => adaptar(generarConversion(mag, { nivel: nv, metodo: cat || 'libre' })),
});

const MEZCLAS = [['geometria', 'Geometría: longitud, superficie y volumen'], ['primaria', 'Primaria: longitud, masa, capacidad y tiempo'], ['fisica', 'Física: velocidad, densidad, temperatura…'], ['todas', 'Todas las magnitudes']];

export const UNIDADES = {
    id: 'unidades', nombre: 'Cambio de unidades', emoji: '🔁', color: '#0891b2', etapas: ['primaria', 'eso', 'bach'],
    desc: 'Longitud, masa, capacidad, superficie, volumen, tiempo, ángulos, temperatura, velocidad, densidad… por saltos o con factores de conversión',
    tipos: {
        longitud: conv('longitud'),
        masa: conv('masa'),
        capacidad: conv('capacidad'),
        superficie: conv('superficie'),
        volumen: conv('volumen'),
        volcap: conv('volcap', CAT_METODO, { titulo: 'Volumen y capacidad: recuerda que 1 dm³ = 1 l.' }),
        tiempo: conv('tiempo'),
        angulo: conv('angulo', CAT_METODO, { titulo: 'Expresa cada ángulo en la unidad indicada (180° = π rad).' }),
        temperatura: { ...conv('temperatura', [['libre', 'Ejercicio típico']]), titulo: 'Convierte las temperaturas (K = °C + 273 · °F = °C · 1,8 + 32).' },
        velocidad: conv('velocidad', CAT_FACTOR),
        densidad: conv('densidad', CAT_FACTOR),
        presion: conv('presion', CAT_FACTOR),
        energia: conv('energia', CAT_FACTOR),
        potencia: conv('potencia', CAT_FACTOR),
        mezcla: {
            label: '🎲 Mezcla de magnitudes', titulo: 'Expresa cada medida en la unidad indicada.', cols: 2, alto: 45, max: 16, categorias: MEZCLAS,
            gen: (nv, cat) => {
                const mags = (MAGNITUDES_CONTEXTO[cat] || Object.keys(MAGNITUDES)).filter((m) => nv >= 3 || !['presion', 'energia', 'potencia'].includes(m));
                return adaptar(generarConversion(pick(mags), { nivel: nv, metodo: 'libre' }));
            },
        },
        complejas: {
            label: '🧩 Formas complejas e incomplejas', titulo: 'Completa (forma compleja ↔ incompleja).', cols: 2, alto: 45, max: 12,
            categorias: [['mix', 'Mezcla'], ...MAGNITUDES_COMPLEJAS.map((m) => [m, MAGNITUDES[m].nombre])],
            gen: (nv, cat) => {
                const ap = generarCompleja(!cat || cat === 'mix' ? pick(MAGNITUDES_COMPLEJAS) : cat, { nivel: nv });
                return { ...ap, v: { ...ap.v, enSolucion: true } };
            },
        },
        comparar: {
            label: '⚖️ ¿Qué es mayor?', titulo: 'Rodea la medida mayor (pasa antes las dos a la misma unidad).', cols: 2, alto: 50, max: 12,
            categorias: [['mix', 'Mezcla'], ...['longitud', 'masa', 'capacidad', 'superficie', 'volumen', 'tiempo', 'velocidad'].map((m) => [m, MAGNITUDES[m].nombre])],
            gen: (nv, cat) => generarComparar(!cat || cat === 'mix' ? pick(['longitud', 'masa', 'capacidad', 'tiempo', ...(nv > 1 ? ['superficie', 'volumen', 'velocidad'] : [])]) : cat, { nivel: nv }),
        },
        problemas: {
            label: '📝 Problemas (misma unidad para operar)', titulo: 'Resuelve. Antes de operar, expresa todas las cantidades en la misma unidad.', cols: 1, alto: 120, max: 8,
            categorias: [['mix', 'Todas las magnitudes'], ...MAG_PROBLEMAS.map((m) => [m, MAGNITUDES[m].nombre])],
            gen: (nv, cat) => generarProblemaUnidades({ mags: !cat || cat === 'mix' ? null : [cat], nivel: nv }),
        },
    },
    // Dibujo de cada ejercicio (escalera, factores, termómetros, círculo, tablas)
    Visual: ({ ap, size, solucion }) => {
        const n = parseFloat(size) || 1.3;
        return <div style={{ maxWidth: '100%', overflow: 'hidden' }}><VisualConversion v={ap.v} solucion={!!solucion} size={Math.max(0.7, n / 1.4)} /></div>;
    },
};
