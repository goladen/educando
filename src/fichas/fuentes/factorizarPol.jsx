// ─────────────────────────────────────────────────────────────────────────────
//  Fichas · Polinomios → FACTORIZAR (con o sin gráfica)
//  Reutiliza el motor de Álgebra (src/algebra/motorFactorizacion.js): mismos
//  generadores por método y misma resolución paso a paso.
//  Método elegible por ejercicio (categorias → ej.catProb):
//    var · fc · id · fcId · ruf · fcRuf
//  Nivel de la ficha: 1 y 2 → 3.º ESO (raíces enteras; el 1 con números pequeños)
//                     3     → 4.º ESO (raíces fraccionarias ±p/q)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
    generarEjercicio, factorizarAuto, resultadoFinal, polyStr, monoStr, mul, norm, grado, gcd,
    IDENTIDADES, fStr, evalNum,
} from '../../algebra/motorFactorizacion';

const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const METODOS_FACTORIZAR = [
    ['var', '🎲 Variado'],
    ['fc', '🧲 Factor común'],
    ['id', '🔍 Identidades notables'],
    ['fcId', '🧲 Factor común + identidad'],
    ['ruf', '➗ Ruffini'],
    ['fcRuf', '🧲 Factor común + Ruffini'],
];

// ── Polinomio para «solo factor común»: k·xᵐ·Q con Q sin factor común ────────
function polFactorComun(nv) {
    for (let i = 0; i < 50; i++) {
        const k = pick(nv === 1 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, -2, -3, 7]);
        const m = nv === 1 ? R(0, 1) : R(0, 3);
        const nT = nv === 1 ? 2 : pick([2, 3, 3]);
        const gQ = R(nT - 1, nv === 1 ? 2 : 3);
        // Q ascendente: Q[0] ≠ 0, coeficiente principal positivo, mcd = 1
        const Q = Array(gQ + 1).fill(0);
        Q[0] = pick([-1, 1]) * R(1, nv === 1 ? 5 : 9);
        Q[gQ] = R(1, nv === 1 ? 4 : 6);
        for (let t = 2; t < nT; t++) Q[R(1, gQ - 1)] = pick([-1, 1]) * R(1, 8);
        if (Q.reduce((a, v) => gcd(a, v), 0) !== 1) continue;
        const mono = [...Array(m).fill(0), k];
        if (Math.abs(k) === 1 && m === 0) continue;
        return { P: norm(mul(mono, Q)), k, m, Q };
    }
    return { P: [0, 4, 6], k: 2, m: 1, Q: [2, 3] };
}

// ── Pasos legibles a partir del registro del motor ───────────────────────────
const n3 = (v) => Math.round(v * 1000) / 1000;
function pasosDe(st) {
    const out = [];
    st.log.forEach(p => {
        if (p.tipo === 'fc' && !p.ninguno) out.push(`Factor común ${monoStr(p.g, p.m)}: ${monoStr(p.g, p.m)}(${polyStr(p.Q)})`);
        else if (p.tipo === 'id') out.push(`${IDENTIDADES[p.ident]?.nombre || 'Identidad notable'}: ${polyStr(p.Q)} = ${p.bases.map(b => `(${polyStr(b.poly)})${b.exp > 1 ? '²' : ''}`).join('')}`);
        else if (p.tipo === 'ruf') out.push(`Ruffini con x = ${fStr(p.raiz)}: cociente ${polyStr(p.cociente.map(n3))}`);
        else if (p.tipo === 'cuad') out.push(p.clase === 'ninguna'
            ? `${polyStr(p.Q)} = 0 no tiene solución real → no se descompone`
            : p.clase === 'doble'
            ? `${polyStr(p.Q)} = 0 → x = ${fStr(p.raices[0])} (doble)`
            : `${polyStr(p.Q)} = 0 → x = ${p.raices.map(r => (r.irr ? r.txt : fStr(r))).join(' y x = ')}`);
        else if (p.tipo === 'irred') out.push(`${polyStr(p.Q)} no tiene raíces racionales → no se descompone más`);
    });
    return out;
}

function generar(nv, metodo, conGrafica) {
    const m = metodo && metodo !== 'todos' ? metodo : 'var';
    if (m === 'fc') {
        const { P, k, m: e, Q } = polFactorComun(nv);
        const forma = `${monoStr(k, e)}(${polyStr(Q)})`;
        const st = factorizarAuto(P);
        const raices = resultadoFinal(st).raices.map(r => ({ txt: r.txt, val: r.val }));
        return {
            e: `P(x) = ${polyStr(P)}`, s: forma,
            pasos: [`Saca el m.c.d. de los coeficientes (${Math.abs(k)}) y la menor potencia de x${e ? ` (${monoStr(1, e)})` : ''}`],
            r: [{ etiqueta: 'P(x) =', tipo: 'texto', v: [forma, `(${polyStr(Q)})${monoStr(k, e)}`], placeholder: 'p. ej. 3x(x + 2)' }],
            ...(conGrafica ? { v: { P, raices, enSolucion: true } } : {}),
        };
    }
    const nivelMotor = nv === 3 ? 4 : 3;
    for (let i = 0; i < 40; i++) {
        const { P } = generarEjercicio(nivelMotor, m === 'var' ? undefined : m);
        // Nivel 1: grado ≤ 3 y coeficientes pequeños
        if (nv === 1 && (grado(P) > 3 || P.some(v => Math.abs(v) > 40))) continue;
        const st = factorizarAuto(P);
        const res = resultadoFinal(st);
        const racionales = [...new Set(res.raices.filter(r => !/√/.test(r.txt)).map(r => n3(r.val)))];
        if (!racionales.length) continue;
        return {
            e: `P(x) = ${polyStr(P)}`,
            s: res.formaEntera ? `${res.forma} = ${res.formaEntera}` : res.forma,
            pasos: [...pasosDe(st), `Raíces: ${res.raices.map(r => r.txt + (r.mult > 1 ? ` (${r.mult === 2 ? 'doble' : r.mult === 3 ? 'triple' : 'mult. ' + r.mult})` : '')).join(', ')}`],
            r: [{ etiqueta: 'Raíces de P(x):', tipo: 'lista', v: racionales, placeholder: 'sepáralas con ; (ej. −2; 1; 3)' }],
            ...(conGrafica ? { v: { P, raices: res.raices.map(r => ({ txt: r.txt, val: r.val })), enSolucion: true } } : {}),
        };
    }
    return null;
}

export const TIPOS_FACTORIZAR = {
    factorizar: {
        label: '🧩 Factorizar', titulo: 'Factoriza los siguientes polinomios.', cols: 2, alto: 110,
        categorias: METODOS_FACTORIZAR,
        gen: (nv, metodo) => generar(nv, metodo, false),
    },
    factorizarGrafica: {
        label: '📈 Factorizar + gráfica', titulo: 'Factoriza cada polinomio y comprueba sus raíces en la gráfica: son los puntos de corte con el eje X.', cols: 2, alto: 90,
        categorias: METODOS_FACTORIZAR,
        gen: (nv, metodo) => generar(nv, metodo, true),
    },
};

// ── Gráfica imprimible (fondo blanco) ────────────────────────────────────────
const pasoBonito = (r) => { const p = Math.pow(10, Math.floor(Math.log10(r || 1))); const f = r / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
const corto = (v) => String(Math.round(v * 100) / 100).replace('.', ',').replace('-', '−');

export function GraficaPolinomioFicha({ P, raices = [], marcar = false }) {
    const W = 320, H = 200, M = 20;
    const rv = raices.map(r => r.val).filter(Number.isFinite);
    const lo = Math.min(-1, ...rv), hi = Math.max(1, ...rv);
    const c = (lo + hi) / 2, half = Math.max((hi - lo) / 2 + 1.2, 2.5);
    const x0 = c - half, x1 = c + half;
    const pts = Array.from({ length: 241 }, (_, i) => { const x = x0 + (x1 - x0) * i / 240; return [x, evalNum(P, x)]; });
    const zona = pts.filter(([x]) => x >= lo - 0.8 && x <= hi + 0.8);
    let y0 = Math.min(0, ...zona.map(p => p[1])), y1 = Math.max(0, ...zona.map(p => p[1]));
    if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.15; y0 -= pad; y1 += pad;
    const sx = x => M + (x - x0) / (x1 - x0) * (W - 2 * M);
    const sy = y => H - M - (y - y0) / (y1 - y0) * (H - 2 * M);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${Math.max(-1e4, Math.min(1e4, sy(y))).toFixed(1)}`).join('');
    const pX = pasoBonito((x1 - x0) / 10), pY = pasoBonito((y1 - y0) / 7);
    const tx = []; for (let v = Math.ceil(x0 / pX) * pX; v <= x1; v += pX) tx.push(+v.toFixed(6));
    const ty = []; for (let v = Math.ceil(y0 / pY) * pY; v <= y1; v += pY) ty.push(+v.toFixed(6));
    const ejeX = sy(0), ejeY = sx(0), hayY = ejeY >= M && ejeY <= W - M;
    const id = 'clipPF' + Math.abs(P.reduce((a, v, i) => a * 31 + v * (i + 7), 7) % 1e6);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', display: 'block', background: 'white', border: '1px solid #e3e3e3', borderRadius: 6 }}>
            <defs><clipPath id={id}><rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} /></clipPath></defs>
            {tx.map(v => <line key={'gx' + v} x1={sx(v)} x2={sx(v)} y1={M} y2={H - M} stroke="#eef0f3" />)}
            {ty.map(v => <line key={'gy' + v} y1={sy(v)} y2={sy(v)} x1={M} x2={W - M} stroke="#eef0f3" />)}
            <line x1={M} x2={W - M} y1={ejeX} y2={ejeX} stroke="#555" strokeWidth="1.2" />
            {hayY && <line y1={M} y2={H - M} x1={ejeY} x2={ejeY} stroke="#555" strokeWidth="1.2" />}
            {tx.filter(v => v !== 0).map(v => <text key={'tx' + v} x={sx(v)} y={Math.min(H - 6, Math.max(M + 9, ejeX + 11))} fill="#777" fontSize="9" textAnchor="middle">{corto(v)}</text>)}
            {ty.filter(v => v !== 0).map(v => <text key={'ty' + v} x={hayY ? ejeY - 3 : M - 2} y={sy(v) + 3} fill="#777" fontSize="9" textAnchor="end">{corto(v)}</text>)}
            <path d={d} fill="none" stroke="#8e44ad" strokeWidth="2.2" clipPath={`url(#${id})`} />
            {marcar && raices.filter(r => r.val >= x0 && r.val <= x1).map((r, i) => (
                <g key={i}>
                    <circle cx={sx(r.val)} cy={ejeX} r="4" fill="#27ae60" stroke="white" strokeWidth="1.5" />
                    <text x={sx(r.val)} y={ejeX - 7 - (i % 2) * 10} fill="#1e8449" fontSize="10" fontWeight="700" textAnchor="middle">{r.txt}</text>
                </g>
            ))}
        </svg>
    );
}

// Visual del tema Polinomios: en el enunciado, solo la curva; en la solución, con las raíces marcadas
export const VisualPolinomio = ({ ap, solucion }) => (ap.v?.P
    ? <GraficaPolinomioFicha P={ap.v.P} raices={ap.v.raices || []} marcar={!!solucion} />
    : null);
