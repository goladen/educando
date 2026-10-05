import { motorFracciones } from './motorFracciones';
import { motorCalculo } from './motorCalculo';
import { motorDinero } from './motorDinero';
import { crearFuente } from './fuenteTexto';
import { crearMotorMultitema, conTema, ETAPAS, CURSOS } from './motorMultitema';
import { ECUACIONES, SISTEMAS, POLINOMIOS, FUNCIONES } from './fuentes/algebra';
import { POTENCIAS, DIVISIBILIDAD, NUMEROS } from './fuentes/numeros';
import { GEOMETRIA, GEO_ANALITICA, MEDIDAS } from './fuentes/geometria';
import { ESTADISTICA, PROBABILIDAD } from './fuentes/datos';
import { CATALOGO_MATES } from './catalogo';

// ─────────────────────────────────────────────────────────────────────────────
//  Motor de FICHAS DE MATH WORLD (motor multitema): una ficha puede mezclar
//  ejercicios de cualquier tema de matemáticas.
//  Firestore: fichas_mates · enlace público: /fichas?ficha=ID
//  Las fichas antiguas de fracciones/cálculo/dinero se leen de sus colecciones
//  (legacy) y se trasladan a fichas_mates al abrir «Mis fichas».
// ─────────────────────────────────────────────────────────────────────────────

// Las herramientas que ya tenían fichas se adaptan como fuentes
const adaptar = (id, motor, meta) => ({ ...motor, id, ...meta });

export const FUENTES = {
    calculo: adaptar('calculo', motorCalculo, { nombre: 'Cálculo', emoji: '🧠', color: '#E91E63', etapas: ['primaria', 'eso'], desc: 'Operaciones, enteros, decimales, combinadas y problemas' }),
    numeros: crearFuente(NUMEROS),
    fracciones: adaptar('fracciones', motorFracciones, { nombre: 'Fracciones', emoji: '🍰', color: '#7b1fa2', etapas: ['primaria', 'eso'], desc: 'Equivalentes, operaciones, combinadas y problemas' }),
    dinero: adaptar('dinero', motorDinero, { nombre: 'Dinero y porcentajes', emoji: '💶', color: '#16a085', etapas: ['primaria', 'eso'], desc: 'Vueltas, precios, IVA, rebajas y porcentajes sucesivos' }),
    divisibilidad: crearFuente(DIVISIBILIDAD),
    potencias: crearFuente(POTENCIAS),
    medidas: crearFuente(MEDIDAS),
    geometria: crearFuente(GEOMETRIA),
    estadistica: crearFuente(ESTADISTICA),
    probabilidad: crearFuente(PROBABILIDAD),
    ecuaciones: crearFuente(ECUACIONES),
    sistemas: crearFuente(SISTEMAS),
    polinomios: crearFuente(POLINOMIOS),
    funciones: crearFuente(FUNCIONES),
    geoAnalitica: crearFuente(GEO_ANALITICA),
};

export { ETAPAS, CURSOS };

export const motorMathWorld = crearMotorMultitema(FUENTES, {
    coleccion: 'fichas_mates',
    ruta: '/fichas',
    nombre: 'Fichas de Math World',
    tituloFicha: 'Ficha de matemáticas',
    emoji: '📐',
    volver: 'Math World',
    catalogo: CATALOGO_MATES,
    legacy: [
        { coleccion: 'fichas_fracciones', fuente: 'fracciones' },
        { coleccion: 'fichas_calculo', fuente: 'calculo' },
        { coleccion: 'fichas_dinero', fuente: 'dinero' },
    ],
    ejercicioInicial: { fuente: 'calculo', tipo: 'combinadas', nivel: 2, n: 4 },
    ejercicioNuevo: { fuente: 'fracciones', tipo: 'suma', nivel: 1, n: 4 },
});

// Motor con un tema preseleccionado (al abrir las fichas desde una herramienta)
export const motorConTema = (tema) => conTema(motorMathWorld, tema);
