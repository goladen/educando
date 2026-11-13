// ─────────────────────────────────────────────────────────────────────────────
//  Fichas · Ecuaciones → tipos avanzados y problemas
//  Reutiliza los MISMOS generadores que la app Ecuaciones (src/ecuaciones/
//  ecuacionesAvanzadas.js): bicuadradas, racionales, con raíces, producto = 0,
//  exponenciales, logarítmicas, trigonométricas y problemas.
//  Por ejercicio (categorias → ej.catProb) se elige la solución gráfica:
//    sol  → gráfica con los puntos de corte en la hoja de soluciones
//    enun → «resuelve gráficamente»: las curvas en el enunciado y los cortes en la solución
//    no   → sin gráfica
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
    TIPOS_AVANZADOS, generarAvanzada, datosGrafica, textoSoluciones, formatoSolucion,
    astAMathRender, aMathRender, tieneMarcado, ecuacionTexto,
} from '../../ecuaciones/ecuacionesAvanzadas';
import GraficaEcuacion from '../../ecuaciones/GraficaEcuacion';

export const OPCIONES_GRAFICA = [
    ['sol', '📈 Gráfica en la solución'],
    ['enun', '📈 Resolver gráficamente'],
    ['no', 'Sin gráfica'],
];

const TITULOS = {
    BICUAD: 'Resuelve las siguientes ecuaciones bicuadradas.',
    RACIONAL: 'Resuelve las siguientes ecuaciones. Comprueba que ninguna solución anula un denominador.',
    RADICAL: 'Resuelve las siguientes ecuaciones irracionales y comprueba las soluciones.',
    FACTOR: 'Resuelve las siguientes ecuaciones (factoriza si hace falta).',
    EXPO: 'Resuelve las siguientes ecuaciones exponenciales.',
    LOGA: 'Resuelve las siguientes ecuaciones logarítmicas y comprueba las soluciones.',
    TRIGO: 'Resuelve las siguientes ecuaciones trigonométricas en el intervalo [0°, 360°).',
    PROB1: 'Plantea una ecuación de primer grado y resuelve los siguientes problemas.',
    PROB2: 'Plantea una ecuación de segundo grado y resuelve los siguientes problemas.',
    PROBINV: 'Plantea una ecuación (con la incógnita en el denominador) y resuelve los siguientes problemas.',
    PROBCIEN: 'Plantea una ecuación y resuelve los siguientes problemas de física y otras materias.',
};
const TITULO_GRAFICO = 'Resuelve gráficamente: las soluciones son las x de los puntos de corte de las dos gráficas.';

const pasoFicha = (p) => (tieneMarcado(p) ? { m: aMathRender(p) } : p);

export const apartadoDesdeEcuacion = (eq, grafica = 'sol') => {
    const prob = String(eq.sub).startsWith('PROB');
    const desc = eq.descartadas || [];
    const ap = prob
        ? { largo: true, e: eq.ast.find((el) => el.t === 'enunciado')?.v || '' }
        : { e: ecuacionTexto(eq), m: astAMathRender(eq.ast) };
    ap.s = textoSoluciones(eq) + (desc.length && !prob ? `   (se descarta${desc.length > 1 ? 'n' : ''}: ${desc.map((v) => formatoSolucion(eq, v)).join(' ; ')})` : '');
    ap.pasos = (eq.pasos || []).map(pasoFicha);
    // Una sola solución → número (así también sirve en Invasión Pi / Mates con mandos); varias → lista
    const una = eq.correctAnswers.length === 1;
    ap.r = [{
        etiqueta: prob ? (una ? 'Solución:' : 'Soluciones:') : eq.grados ? 'x (en grados) =' : 'x =',
        tipo: una ? 'frac' : 'lista', v: una ? eq.correctAnswers[0] : eq.correctAnswers, unidad: eq.unidad || undefined,
        tol: eq.tolRel ? Math.min(...eq.correctAnswers.map((v) => Math.abs(v))) * eq.tolRel : Math.max(eq.tol || 0, 1e-4),
        placeholder: una ? undefined : eq.grados ? 'p. ej. 30; 150' : 'sepáralas con ; (p. ej. −2; 3)',
    }];
    if (grafica !== 'no' && !eq.sinGrafica) ap.v = { g: datosGrafica(eq), enSolucion: true, soloSolucion: grafica !== 'enun' };
    return ap;
};

export const TIPOS_ECU_AVANZADAS = Object.fromEntries(TIPOS_AVANZADOS.map((t) => {
    const prob = t.grupo === 'prob';
    return [t.key, {
        label: `${t.icon} ${t.label}`,
        titulo: TITULOS[t.tipo],
        cols: prob ? 1 : 2, alto: prob ? 200 : 130, max: prob ? 8 : 12,
        niveles: false,
        categorias: OPCIONES_GRAFICA,
        gen: (_nv, grafica) => apartadoDesdeEcuacion(generarAvanzada(t.tipo), grafica || 'sol'),
    }];
}));
export { TITULO_GRAFICO };

// Visual del tema Ecuaciones: curvas en el enunciado («resolver gráficamente»),
// curvas con los cortes marcados en la solución
export const VisualEcuacion = ({ ap, solucion }) => (ap.v?.g
    ? <div style={{ width: '100%', maxWidth: 340 }}><GraficaEcuacion datos={ap.v.g} marcar={!!solucion} /></div>
    : null);
