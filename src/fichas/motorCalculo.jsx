import React from 'react';
import { generarProblema } from '../CalculoMental';
import { generarProblemasNumeros, textoRespuestaNum } from '../generadorProblemasNumeros';

// ─────────────────────────────────────────────────────────────────────────────
//  Motor de CÁLCULO MENTAL para las fichas imprimibles (ver FichasImprimibles.jsx)
//  Operaciones (naturales, enteros, decimales, combinadas) + problemas de números.
//  Firestore: fichas_calculo · enlace público: /calculo?ficha=ID
// ─────────────────────────────────────────────────────────────────────────────

const ROJO = '#E91E63';

const TIPOS = {
    suma:          { label: '➕ Sumas', color: '#3498db' },
    resta:         { label: '➖ Restas', color: '#e74c3c' },
    mult:          { label: '✖️ Multiplicaciones', color: '#f39c12' },
    div:           { label: '➗ Divisiones exactas', color: '#9b59b6' },
    enteros:       { label: '± Enteros', color: '#c0392b' },
    decimales:     { label: '🔢 Decimales', color: '#16a085' },
    combinadas:    { label: '🧮 Combinadas', color: '#00897b' },
    combEnteros:   { label: '🧮 Combinadas con enteros', color: '#6d4c41' },
    probNaturales: { label: '📖 Problemas · naturales', color: '#2980b9' },
    probEnteros:   { label: '📖 Problemas · enteros', color: '#c0392b' },
    probDecimales: { label: '📖 Problemas · precios', color: '#27ae60' },
};

const TITULOS = {
    suma: 'Calcula las siguientes sumas.',
    resta: 'Calcula las siguientes restas.',
    mult: 'Calcula los siguientes productos.',
    div: 'Calcula las siguientes divisiones.',
    enteros: 'Calcula estas operaciones con números enteros.',
    decimales: 'Calcula estas operaciones con números decimales.',
    combinadas: 'Realiza las siguientes operaciones combinadas.',
    combEnteros: 'Realiza las siguientes operaciones combinadas con números enteros.',
    probNaturales: 'Resuelve los siguientes problemas.',
    probEnteros: 'Resuelve los siguientes problemas con números enteros.',
    probDecimales: 'Resuelve los siguientes problemas.',
};

const CAT_PROB = { probNaturales: 'naturales', probEnteros: 'enteros', probDecimales: 'decimales' };
const esProblema = (tipo) => !!CAT_PROB[tipo];
const esComb = (ap) => ap.tipo === 'combinadas' || ap.tipo === 'combEnteros';

// Configuración de generarProblema (CalculoMental) para cada tipo y nivel
const OPS_NO = { suma: false, resta: false, multiplicacion: false, division: false, combinadas: false };
const TODAS = { suma: true, resta: true, multiplicacion: true, division: true, combinadas: false };
const POS = { positivos: true, negativos: false, decimales: false, fracciones: false };
const cfgDe = (tipo, nivel) => {
    const max = [20, 100, 1000][nivel - 1] || 20;
    const comb = { combMax: [3, 4, 6][nivel - 1], combParentesis: nivel > 1, combDivision: true };
    switch (tipo) {
        case 'suma': return { minNum: 1, maxNum: max, tipos: POS, operaciones: { ...OPS_NO, suma: true } };
        case 'resta': return { minNum: 1, maxNum: max, tipos: POS, operaciones: { ...OPS_NO, resta: true } };
        case 'mult': return { minNum: 2, maxNum: [10, 12, 20][nivel - 1], tipos: POS, operaciones: { ...OPS_NO, multiplicacion: true } };
        case 'div': return { minNum: 1, maxNum: [50, 100, 500][nivel - 1], tipos: POS, operaciones: { ...OPS_NO, division: true } };
        case 'enteros': return { minNum: 1, maxNum: [10, 30, 100][nivel - 1], tipos: { ...POS, positivos: false, negativos: true }, operaciones: TODAS };
        case 'decimales': return { minNum: 1, maxNum: [30, 100, 500][nivel - 1], tipos: { ...POS, positivos: false, decimales: true }, operaciones: TODAS };
        case 'combEnteros': return { minNum: 1, maxNum: 20, tipos: { ...POS, negativos: true }, operaciones: { ...OPS_NO, combinadas: true }, ...comb };
        default: return { minNum: 1, maxNum: 20, tipos: POS, operaciones: { ...OPS_NO, combinadas: true }, ...comb };
    }
};

// Formato español: coma decimal y signo «−» (× y ÷ como en el resto de Cálculo Mental)
const fmt = (t) => String(t).replace(/(\d)\.(\d)/g, '$1,$2').replace(/-(\d)/g, '−$1');

const generarApartados = (ej, n, existentes = []) => {
    if (esProblema(ej.tipo)) {
        return generarProblemasNumeros([CAT_PROB[ej.tipo]], n, ej.nivel, existentes.map(a => a.problema))
            .map(p => ({ tipo: ej.tipo, problema: p }));
    }
    const cfg = cfgDe(ej.tipo, ej.nivel);
    const vistos = new Set(existentes.map(a => a.text));
    const out = [];
    for (let i = 0; out.length < n && i < n * 40; i++) {
        const p = generarProblema(cfg);
        if (vistos.has(p.text)) continue;
        vistos.add(p.text);
        out.push({ tipo: ej.tipo, text: p.text, answer: p.answer, displayAnswer: p.displayAnswer, ...(p.pasos ? { pasos: p.pasos } : {}) });
    }
    return out;
};

// ─── Enunciado / solución ────────────────────────────────────────────────────
const Enunciado = ({ ap, size = '1.4rem' }) => {
    if (esProblema(ap.tipo)) {
        return <p style={{ margin: 0, fontSize: `calc(${size} * 0.62)`, lineHeight: 1.5, color: '#2c3e50', fontWeight: 600 }}>{ap.problema?.texto}</p>;
    }
    return <span style={{ fontSize: `calc(${size} * 0.85)`, fontWeight: 800, color: '#2c3e50', whiteSpace: esComb(ap) ? 'normal' : 'nowrap' }}>{fmt(ap.text)} =</span>;
};

const Solucion = ({ ap }) => {
    if (esProblema(ap.tipo)) {
        const p = ap.problema;
        return (
            <div style={{ color: '#c0392b', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.5 }}>
                {p.preguntas.map((q, i) => <div key={i}>• {q.p} → <b>{textoRespuestaNum(q)}</b></div>)}
                <div style={{ color: '#7f8c8d', fontWeight: 600, marginTop: 4 }}>{p.explicacion.join(' · ')}</div>
            </div>
        );
    }
    if (esComb(ap) && ap.pasos) return (
        <div style={{ color: '#c0392b', fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.6 }}>
            {ap.pasos.slice(1).map((p, i) => <div key={i}>= {fmt(p)}</div>)}
        </div>
    );
    return <span style={{ color: '#c0392b', fontSize: '1.1rem', fontWeight: 900 }}>{fmt(ap.displayAnswer)}</span>;
};

// ─── Pizarra ─────────────────────────────────────────────────────────────────
const pasosMax = (ap) => {
    if (esProblema(ap.tipo)) return (ap.problema?.preguntas.length || 0) + 1;
    if (esComb(ap) && ap.pasos) return ap.pasos.length - 1; // una línea por clic
    return 1;
};

const RespuestaInline = ({ ap, vis, size }) => (
    !esProblema(ap.tipo) && !(esComb(ap) && ap.pasos) && vis >= 1
        ? <span style={{ fontSize: `calc(${size} * 0.85)`, fontWeight: 900, color: ROJO }}>{fmt(ap.displayAnswer)}</span>
        : null
);

const Revelado = ({ ap, vis, size, zoom }) => {
    if (vis < 1) return null;
    if (esComb(ap) && ap.pasos) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingLeft: 10 }}>
            {ap.pasos.slice(1, vis + 1).map((p, i) => (
                <div key={i} style={{ fontSize: `calc(${size} * 0.85)`, fontWeight: 800, color: i === ap.pasos.length - 2 ? ROJO : '#2c3e50' }}>
                    <span style={{ color: '#95a5a6' }}>= </span>{fmt(p)}
                </div>
            ))}
        </div>
    );
    if (!esProblema(ap.tipo)) return null;
    const prob = ap.problema;
    return (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: `${1.05 * zoom}rem` }}>
            {prob.preguntas.slice(0, vis).map((q, i) => (
                <div key={i} style={{ fontWeight: 700, color: '#2c3e50' }}>
                    {i + 1}) {q.p} → <span style={{ color: ROJO, fontWeight: 900 }}>{textoRespuestaNum(q)}</span>
                </div>
            ))}
            {vis > prob.preguntas.length && (
                <div style={{ marginTop: 8, background: '#e8f5e9', borderRadius: 12, padding: '10px 12px' }}>
                    <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6, fontWeight: 600 }}>
                        {prob.explicacion.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                </div>
            )}
        </div>
    );
};

export const motorCalculo = {
    coleccion: 'fichas_calculo',
    ruta: '/calculo',
    nombre: 'Fichas de cálculo',
    tituloFicha: 'Ficha de cálculo',
    emoji: '🧠',
    volver: 'Cálculo Mental',
    tipos: TIPOS,
    titulos: TITULOS,
    ejercicioInicial: { tipo: 'combinadas', nivel: 2, n: 4 },
    ejercicioNuevo: { tipo: 'probDecimales', nivel: 2, n: 2 },
    layout: (ej) => {
        if (esProblema(ej.tipo)) return { cols: 1, alto: 190 };
        if (ej.tipo === 'combinadas' || ej.tipo === 'combEnteros') return ej.nivel === 3 ? { cols: 1, alto: 150 } : { cols: 2, alto: 130 };
        return { cols: 3, alto: 40 };
    },
    generarApartados,
    maxApartados: (ej) => (esProblema(ej.tipo) ? 8 : 15),
    usaNivel: () => true,
    esTexto: (ap) => esProblema(ap.tipo),
    sizeHoja: () => '1.3rem',
    Enunciado, Solucion, pasosMax, RespuestaInline, Revelado,
};
