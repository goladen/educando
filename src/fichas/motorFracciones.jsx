import React from 'react';
import {
    FracTexto, BarraFraccion, EnunciadoMat, ExprMat, PasosCombinada, BarraCantidad,
    generarEjercicio, pasosExpr, textoRespuesta, TIPOS_EJERCICIO, COLORES,
} from '../Fracciones';
import { PROBLEMAS_FRACCIONES } from '../fraccionesProblemas';
import { barajar } from './FichasImprimibles';
import { leerNumeroEs } from '../generadorProblemasNumeros';

// ─────────────────────────────────────────────────────────────────────────────
//  Motor de FRACCIONES para las fichas imprimibles (ver FichasImprimibles.jsx)
//  Firestore: fichas_fracciones · enlace público: /fracciones?ficha=ID
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS = {
    ...TIPOS_EJERCICIO,
    problemas: { label: '📖 Problemas', color: '#00897b' },
};

const TITULOS = {
    identificar: 'Escribe la fracción que representa la parte coloreada.',
    equivalente: 'Completa las fracciones equivalentes.',
    simplificar: 'Simplifica hasta obtener la fracción irreducible.',
    suma: 'Calcula las siguientes sumas y simplifica el resultado.',
    resta: 'Calcula las siguientes restas y simplifica el resultado.',
    mult: 'Calcula los siguientes productos y simplifica el resultado.',
    div: 'Calcula los siguientes cocientes y simplifica el resultado.',
    pot: 'Calcula las siguientes potencias.',
    raiz: 'Calcula las siguientes raíces.',
    combinadas: 'Realiza las siguientes operaciones combinadas y simplifica el resultado.',
    problemas: 'Resuelve los siguientes problemas.',
};

// Distribución en la hoja impresa: columnas y alto del espacio para operar (px)
const LAYOUT = {
    identificar: { cols: 3, alto: 30 },
    equivalente: { cols: 3, alto: 30 },
    simplificar: { cols: 3, alto: 45 },
    pot: { cols: 3, alto: 45 },
    raiz: { cols: 3, alto: 45 },
    suma: { cols: 2, alto: 80 },
    resta: { cols: 2, alto: 80 },
    mult: { cols: 2, alto: 70 },
    div: { cols: 2, alto: 70 },
    combinadas: { cols: 1, alto: 150 },
    problemas: { cols: 1, alto: 210 },
};

const probPorId = (id) => PROBLEMAS_FRACCIONES.find(p => p.id === id);
const problemasDe = (cat) => PROBLEMAS_FRACCIONES.filter(p => !cat || cat === 'todos' || p.cat === cat);

// Genera n apartados distintos de un tipo (los ya existentes se evitan)
const generarApartados = (ej, n, existentes = []) => {
    if (ej.tipo === 'problemas') {
        const usados = new Set(existentes.map(a => a.probId));
        const libres = barajar(problemasDe(ej.catProb).filter(p => !usados.has(p.id)));
        return libres.slice(0, n).map(p => ({ tipo: 'problemas', probId: p.id }));
    }
    // Clave: enunciado + dibujo («¿Qué fracción está pintada?» se repite con barras distintas)
    const clave = (a) => `${a.enunciado}|${JSON.stringify(a.visual || {})}`;
    const vistos = new Set(existentes.map(clave));
    const out = [];
    for (let i = 0; out.length < n && i < n * 40; i++) {
        const { distractores, ...e } = generarEjercicio([ej.tipo], ej.nivel); // eslint-disable-line no-unused-vars
        if (vistos.has(clave(e))) continue;
        vistos.add(clave(e));
        out.push(e);
    }
    return out;
};

// ─── Enunciado de un apartado (sin solución) ─────────────────────────────────
const Enunciado = ({ ap, size = '1.4rem', marca = null }) => {
    if (ap.tipo === 'problemas') {
        const p = probPorId(ap.probId);
        return <p style={{ margin: 0, fontSize: `calc(${size} * 0.62)`, lineHeight: 1.5, color: '#2c3e50', fontWeight: 600 }}>{p ? p.texto : '¿Problema eliminado?'}</p>;
    }
    const v = ap.visual || {};
    if (ap.tipo === 'identificar') return (
        <div style={{ width: '100%', minWidth: 120 }}><BarraFraccion n={v.n} d={v.d} color={v.color || COLORES.A} alto={34} /></div>
    );
    if (ap.tipo === 'simplificar') return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FracTexto n={v.n} d={v.d} size={size} color={COLORES.A} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>=</span>
        </span>
    );
    if (v.modo === 'comb') return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ExprMat nodo={v.arbol} size={size} marca={marca} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>=</span>
        </span>
    );
    return <EnunciadoMat ej={ap} size={size} />;
};

// Solución completa (para el solucionario)
const Solucion = ({ ap, size = '1.3rem' }) => {
    if (ap.tipo === 'problemas') {
        const p = probPorId(ap.probId);
        if (!p) return null;
        return (
            <div style={{ color: '#c0392b', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.5 }}>
                {p.preguntas.map((q, i) => <div key={i}>• {q.p} → <b>{textoRespuesta(q)}</b></div>)}
                <div style={{ color: '#7f8c8d', fontWeight: 600, marginTop: 4 }}>{p.explicacion.join(' · ')}</div>
            </div>
        );
    }
    if (ap.visual?.modo === 'comb') return <PasosCombinada arbol={ap.visual.arbol} size={`calc(${size} * 0.8)`} />;
    return <FracTexto n={ap.respuesta[0]} d={ap.respuesta[1]} size={size} color="#c0392b" />;
};

// ─── Pizarra ─────────────────────────────────────────────────────────────────
const esComb = (ap) => ap.visual?.modo === 'comb';

const pasosMax = (ap) => {
    if (ap.tipo === 'problemas') { const p = probPorId(ap.probId); return p ? p.preguntas.length + 1 : 0; }
    if (esComb(ap)) return pasosExpr(ap.visual.arbol).length; // 1º resaltar, luego una línea por clic
    return 1;
};

const marcaEnunciado = (ap, vis) => (esComb(ap) && vis === 1 ? pasosExpr(ap.visual.arbol)[0].marca : null);

const RespuestaInline = ({ ap, vis, size }) => (
    !esComb(ap) && ap.tipo !== 'problemas' && vis >= 1
        ? <FracTexto n={ap.respuesta[0]} d={ap.respuesta[1]} size={size} color={COLORES.RES} />
        : null
);

const Revelado = ({ ap, vis, size, zoom }) => {
    if (esComb(ap)) {
        if (vis < 2) return null;
        const pasos = pasosExpr(ap.visual.arbol);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingLeft: 10 }}>
                {pasos.slice(1, vis).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', overflowX: 'auto' }}>
                        <span style={{ fontSize: size, fontWeight: 900, color: '#95a5a6' }}>=</span>
                        <ExprMat nodo={p.expr} marca={i + 2 === vis ? p.marca : null} size={size} />
                        {p.marca && i + 2 === vis && <span style={{ fontSize: `${0.85 * zoom}rem`, color: '#b9770f', fontWeight: 800 }}>← {p.motivo}</span>}
                    </div>
                ))}
            </div>
        );
    }
    if (ap.tipo !== 'problemas' || vis < 1) return null;
    const prob = probPorId(ap.probId);
    if (!prob) return null;
    return (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: `${1.05 * zoom}rem` }}>
            {prob.preguntas.slice(0, vis).map((q, i) => (
                <div key={i} style={{ fontWeight: 700, color: '#2c3e50' }}>
                    {i + 1}) {q.p} → <span style={{ color: COLORES.RES, fontWeight: 900 }}>{textoRespuesta(q)}</span>
                </div>
            ))}
            {vis > prob.preguntas.length && (
                <div style={{ marginTop: 8, background: '#e8f5e9', borderRadius: 12, padding: '10px 12px' }}>
                    {prob.barra && <div style={{ marginBottom: 10 }}><BarraCantidad barra={prob.barra} /></div>}
                    <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6, fontWeight: 600 }}>
                        {prob.explicacion.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                </div>
            )}
        </div>
    );
};

// ─── Comprobación de respuestas en la pizarra («✏️ Responder») ───────────────
const mcd = (a, b) => (b ? mcd(b, a % b) : Math.abs(a));
// «3/4», «-3/4», «2» o «3:4» → [n, d]
const leerFraccion = (txt) => {
    const t = String(txt || '').trim().replace(/\s/g, '').replace(/[−–]/g, '-').replace(':', '/');
    const m = t.match(/^(-?\d+)(?:\/(-?\d+))?$/);
    if (!m) return null;
    const n = Number(m[1]), d = m[2] === undefined ? 1 : Number(m[2]);
    return d === 0 ? null : [n, d];
};
const comprobarFraccion = (r, { irreducible = false, lockDen = null } = {}) => (txt) => {
    const f = leerFraccion(txt);
    if (!f) return null;
    if (Math.abs(f[0] / f[1] - r[0] / r[1]) > 1e-9) return { ok: false };
    if (lockDen && f[1] !== lockDen) return { ok: false, nota: `Es equivalente, pero el denominador debe ser ${lockDen}` };
    if (irreducible && mcd(f[0], f[1]) !== 1) return { ok: false, nota: 'Es equivalente, pero hay que simplificar' };
    return { ok: true };
};
const comprobarNumero = (r) => (txt) => {
    const v = leerNumeroEs(txt);
    return Number.isNaN(v) ? null : { ok: Math.abs(v - r) < 0.01 };
};

const respuestas = (ap) => {
    if (ap.tipo === 'problemas') {
        const p = probPorId(ap.probId);
        return (p?.preguntas || []).map(q => ({
            etiqueta: q.p, tipo: q.tipo, unidad: q.unidad, opciones: q.opciones,
            comprobar: q.tipo === 'frac' ? comprobarFraccion(q.r) : q.tipo === 'num' ? comprobarNumero(q.r) : (o) => ({ ok: o === q.r }),
        }));
    }
    return [{ tipo: 'frac', comprobar: comprobarFraccion(ap.respuesta, { irreducible: !!ap.exigirIrreducible, lockDen: ap.lockDen || null }) }];
};

export const motorFracciones = {
    coleccion: 'fichas_fracciones',
    ruta: '/fracciones',
    nombre: 'Fichas de fracciones',
    tituloFicha: 'Ficha de fracciones',
    emoji: '🍰',
    volver: 'Fracciones',
    tipos: TIPOS,
    titulos: TITULOS,
    ejercicioInicial: { tipo: 'combinadas', nivel: 1, n: 3 },
    ejercicioNuevo: { tipo: 'suma', nivel: 1, n: 4 },
    layout: (ej) => (ej.tipo === 'combinadas' && ej.nivel === 1 ? { cols: 2, alto: 140 } : LAYOUT[ej.tipo] || { cols: 2, alto: 70 }),
    generarApartados,
    maxApartados: (ej) => (ej.tipo === 'problemas' ? problemasDe(ej.catProb).length : 12),
    usaNivel: (tipo) => tipo !== 'problemas',
    categorias: (tipo) => (tipo === 'problemas' ? [['todos', 'Todos'], ['total', 'Se conoce el total'], ['averiguar', 'Averiguar el total']] : null),
    esTexto: (ap) => ap.tipo === 'problemas',
    sizeHoja: (ap) => (ap.tipo === 'combinadas' ? '1.2rem' : '1.3rem'),
    Enunciado, Solucion, pasosMax, marcaEnunciado, RespuestaInline, Revelado, respuestas,
};
