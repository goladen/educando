import React from 'react';
import { generarProblema, TIPOS_DINERO } from '../CalculoDinero';
import { generarProblemasNumeros, textoRespuestaNum, leerNumeroEs } from '../generadorProblemasNumeros';

// ─────────────────────────────────────────────────────────────────────────────
//  Motor de CÁLCULO CON DINERO para las fichas imprimibles (ver FichasImprimibles.jsx)
//  Usa el generador de CalculoDinero (incluidos los porcentajes sucesivos) y los
//  problemas de precios de generadorProblemasNumeros.
//  Firestore: fichas_dinero · enlace público: /dinero?ficha=ID
// ─────────────────────────────────────────────────────────────────────────────

const VERDE = '#16a085';

// La «lista de la compra» necesita el tablero de productos: no va en fichas
const TIPOS = {
    ...Object.fromEntries(TIPOS_DINERO.filter(([k]) => k !== 'compra').map(([k, label, color]) => [k, { label, color }])),
    problemas: { label: '📖 Problemas de precios', color: '#27ae60' },
};

const TITULOS = {
    pagar: 'Indica con qué billetes y monedas pagarías cada cantidad (con el menor número de piezas).',
    devolver: 'Calcula cuánto te tienen que devolver.',
    multiplicar: 'Calcula el precio total.',
    unidad: 'Calcula el precio de una unidad.',
    pctCantidad: 'Calcula los siguientes porcentajes.',
    iva: 'Calcula el precio con IVA.',
    rebaja: 'Calcula el precio rebajado.',
    aumento: 'Calcula el precio después del aumento.',
    sucesivos: 'Resuelve estos problemas de porcentajes sucesivos.',
    equivalente: 'Calcula el porcentaje único equivalente.',
    porcentajeAplicado: 'Calcula el porcentaje que se ha aplicado.',
    original: 'Calcula el precio original.',
    problemas: 'Resuelve los siguientes problemas.',
};

// Desglose con el menor número de billetes y monedas (céntimos)
const PIEZAS = [[10000, '100 €'], [5000, '50 €'], [2000, '20 €'], [1000, '10 €'], [500, '5 €'], [200, '2 €'], [100, '1 €'],
    [50, '50 cént.'], [20, '20 cént.'], [10, '10 cént.'], [5, '5 cént.'], [2, '2 cént.'], [1, '1 cént.']];
const desglose = (cents) => {
    const out = [];
    let r = cents;
    for (const [v, l] of PIEZAS) { const n = Math.floor(r / v); if (n) { out.push(`${n} × ${l}`); r -= n * v; } }
    return out.join(' + ');
};

const cfgDe = (tipo, nivel) => ({
    tipos: { [tipo]: true },
    maxPrecio: [20, 50, 100][nivel - 1] || 50,
    conCentimos: nivel > 1,
    escribir: true,
});

const generarApartados = (ej, n, existentes = []) => {
    if (ej.tipo === 'problemas') {
        return generarProblemasNumeros(['decimales'], n, ej.nivel, existentes.map(a => a.problema))
            .map(p => ({ tipo: 'problemas', problema: p }));
    }
    const vistos = new Set(existentes.map(a => a.enunciado));
    const out = [];
    for (let i = 0; out.length < n && i < n * 40; i++) {
        const p = generarProblema(cfgDe(ej.tipo, ej.nivel));
        const enunciado = ej.tipo === 'pagar' ? `${p.emoji} ${p.displayAnswer}` : p.enunciado;
        if (vistos.has(enunciado)) continue;
        vistos.add(enunciado);
        out.push({
            tipo: ej.tipo, emoji: p.emoji, enunciado,
            answerCents: p.answerCents ?? null, answerNum: p.answerNum ?? null, unidad: p.unidad || '€',
            displayAnswer: ej.tipo === 'pagar' ? desglose(p.answerCents) : p.displayAnswer,
            pasos: p.pasos || (p.pista && ej.tipo !== 'pagar' ? [p.pista] : []),
        });
    }
    return out;
};

const esProblema = (ap) => ap.tipo === 'problemas';

// ─── Enunciado / solución ────────────────────────────────────────────────────
const Enunciado = ({ ap, size = '1.4rem' }) => {
    if (esProblema(ap)) return <p style={{ margin: 0, fontSize: `calc(${size} * 0.62)`, lineHeight: 1.5, color: '#2c3e50', fontWeight: 600 }}>{ap.problema?.texto}</p>;
    if (ap.tipo === 'pagar') return <span style={{ fontSize: `calc(${size} * 0.85)`, fontWeight: 800, color: '#2c3e50' }}>{ap.enunciado}</span>;
    return <p style={{ margin: 0, fontSize: `calc(${size} * 0.62)`, lineHeight: 1.5, color: '#2c3e50', fontWeight: 600 }}>{ap.emoji} {ap.enunciado}</p>;
};

const Solucion = ({ ap }) => {
    if (esProblema(ap)) {
        const p = ap.problema;
        return (
            <div style={{ color: '#c0392b', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.5 }}>
                {p.preguntas.map((q, i) => <div key={i}>• {q.p} → <b>{textoRespuestaNum(q)}</b></div>)}
                <div style={{ color: '#7f8c8d', fontWeight: 600, marginTop: 4 }}>{p.explicacion.join(' · ')}</div>
            </div>
        );
    }
    return (
        <div style={{ color: '#c0392b', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.5 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>{ap.displayAnswer}</div>
            {ap.pasos?.length > 0 && <div style={{ color: '#7f8c8d', fontWeight: 600 }}>{ap.pasos.join(' · ')}</div>}
        </div>
    );
};

// ─── Pizarra: 1.º la respuesta, 2.º los pasos ────────────────────────────────
const pasosMax = (ap) => {
    if (esProblema(ap)) return (ap.problema?.preguntas.length || 0) + 1;
    return ap.pasos?.length ? 2 : 1;
};

const RespuestaInline = ({ ap, vis, size }) => (
    !esProblema(ap) && vis >= 1
        ? <span style={{ fontSize: `calc(${size} * 0.8)`, fontWeight: 900, color: VERDE }}>= {ap.displayAnswer}</span>
        : null
);

const Revelado = ({ ap, vis, zoom }) => {
    if (esProblema(ap)) {
        if (vis < 1) return null;
        const prob = ap.problema;
        return (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: `${1.05 * zoom}rem` }}>
                {prob.preguntas.slice(0, vis).map((q, i) => (
                    <div key={i} style={{ fontWeight: 700, color: '#2c3e50' }}>
                        {i + 1}) {q.p} → <span style={{ color: VERDE, fontWeight: 900 }}>{textoRespuestaNum(q)}</span>
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
    }
    if (vis < 2 || !ap.pasos?.length) return null;
    return (
        <div style={{ marginTop: 10, background: '#e8f5e9', borderRadius: 12, padding: '10px 12px', fontSize: `${1.05 * zoom}rem` }}>
            <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6, fontWeight: 600, color: '#2c3e50' }}>
                {ap.pasos.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
        </div>
    );
};

// ─── Comprobación en la pizarra («✏️ Responder») ─────────────────────────────
const comprobarNumero = (r) => (txt) => {
    const v = leerNumeroEs(String(txt || '').replace('%', ''));
    return Number.isNaN(v) ? null : { ok: Math.abs(v - r) < 0.005 };
};
const respuestas = (ap) => {
    if (esProblema(ap)) {
        return (ap.problema?.preguntas || []).map(q => ({
            etiqueta: q.p, tipo: q.tipo, unidad: q.unidad, opciones: q.opciones,
            comprobar: q.tipo === 'opcion' ? (o) => ({ ok: o === q.r }) : comprobarNumero(q.r),
        }));
    }
    if (ap.tipo === 'pagar') return []; // el desglose en piezas no se escribe como un número
    if (ap.unidad === '%') return [{ tipo: 'num', unidad: '%', comprobar: comprobarNumero(ap.answerNum) }];
    return [{ tipo: 'num', unidad: '€', comprobar: comprobarNumero(ap.answerCents / 100) }];
};

const ES_TEXTO = (ap) => ap.tipo !== 'pagar';

export const motorDinero = {
    coleccion: 'fichas_dinero',
    ruta: '/dinero',
    nombre: 'Fichas de cálculo con dinero',
    tituloFicha: 'Ficha de cálculo con dinero',
    emoji: '💶',
    volver: 'Cálculo con Dinero',
    tipos: TIPOS,
    titulos: TITULOS,
    ejercicioInicial: { tipo: 'sucesivos', nivel: 2, n: 3 },
    ejercicioNuevo: { tipo: 'rebaja', nivel: 2, n: 4 },
    layout: (ej) => {
        if (ej.tipo === 'problemas') return { cols: 1, alto: 190 };
        if (ej.tipo === 'pagar') return { cols: 3, alto: 55 };
        if (['sucesivos', 'equivalente', 'original', 'porcentajeAplicado'].includes(ej.tipo)) return { cols: 1, alto: 120 };
        return { cols: 2, alto: 90 };
    },
    generarApartados,
    maxApartados: (ej) => (ej.tipo === 'problemas' ? 8 : 12),
    usaNivel: () => true,
    esTexto: ES_TEXTO,
    sizeHoja: () => '1.3rem',
    Enunciado, Solucion, pasosMax, RespuestaInline, Revelado, respuestas,
};

