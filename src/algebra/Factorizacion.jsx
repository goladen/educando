// Factorizacion.jsx — Factor común + Factorización guiada (Álgebra · Math World)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
    polyStr, monoStr, fStr, fVal, fr, gcd, norm, grado, nTerminos, evalNum, mul,
    candidatos, detectarIdentidad, resolverCuadratica, IDENTIDADES, factorComun,
    estadoInicial, aplicarFactorComun, aplicarIdentidad, probarValor, marcarIrreducible,
    aplicarCuadratica, raizRacionalPendiente, factorizarAuto, resultadoFinal, multTxt,
    parseNumero, parsePolinomio, generarEjercicio, sup,
} from './motorFactorizacion';

const CARD = { background: '#161b22', borderRadius: 14, padding: 20, border: '1px solid #30363d' };
const BTN = (bg, col = 'white') => ({ padding: '10px 22px', borderRadius: 9, border: 'none', background: bg, color: col, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' });
const BTN_SEC = { padding: '7px 14px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#c9d1d9', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 };
const INPUT = { padding: '8px 12px', borderRadius: 7, border: '1.5px solid #30363d', background: '#0d1117', color: '#e6edf3', textAlign: 'center', fontSize: '1rem' };
const MATH = { fontFamily: 'Georgia,serif', fontWeight: 700 };
const clonar = st => structuredClone(st);

// ═══════════════════════════════════════════════════════════════════════════════
// Gráfica de la función polinómica
// ═══════════════════════════════════════════════════════════════════════════════
const pasoBonito = raw => { const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
const numCorto = v => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) ? v.toExponential(0) : String(+v.toFixed(2));

export function GraficaPolinomio({ P, raices = [], marcar = true }) {
    const [zoom, setZoom] = useState(1);
    const W = 600, H = 340, M = 34;
    const g = useMemo(() => {
        const rv = raices.map(r => r.val);
        const lo = Math.min(-1, ...rv), hi = Math.max(1, ...rv);
        const c = (lo + hi) / 2, half = Math.max((hi - lo) / 2 + 1.5, 3) * zoom;
        const x0 = c - half, x1 = c + half;
        const pts = Array.from({ length: 401 }, (_, i) => { const x = x0 + (x1 - x0) * i / 400; return [x, evalNum(P, x)]; });
        // Rango vertical: zona de las raíces (sin las ramas que se disparan)
        const zona = pts.filter(([x]) => x >= lo - 1 && x <= hi + 1);
        let y0 = Math.min(0, ...zona.map(p => p[1])), y1 = Math.max(0, ...zona.map(p => p[1]));
        if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
        const pad = (y1 - y0) * 0.18; y0 -= pad; y1 += pad;
        const sx = x => M + (x - x0) / (x1 - x0) * (W - 2 * M);
        const sy = y => H - M - (y - y0) / (y1 - y0) * (H - 2 * M);
        let d = '';
        pts.forEach(([x, y], i) => { const yy = Math.max(-1e4, Math.min(1e4, sy(y))); d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${yy.toFixed(1)}`; });
        const sxS = pasoBonito((x1 - x0) / 10), syS = pasoBonito((y1 - y0) / 8);
        const tx = []; for (let v = Math.ceil(x0 / sxS) * sxS; v <= x1; v += sxS) tx.push(+v.toFixed(6));
        const ty = []; for (let v = Math.ceil(y0 / syS) * syS; v <= y1; v += syS) ty.push(+v.toFixed(6));
        return { sx, sy, d, tx, ty, x0, x1, y0, y1 };
    }, [P, raices, zoom]);
    const ejeX = g.sy(0), ejeY = g.sx(0);
    const enX = ejeY >= M && ejeY <= W - M;

    return (
        <div style={{ ...CARD, padding: 12, background: '#0d1117' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ ...MATH, color: '#f39c12', fontSize: '0.95rem' }}>f(x) = {polyStr(P)}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                    <button style={BTN_SEC} onClick={() => setZoom(z => z / 1.5)}>＋</button>
                    <button style={BTN_SEC} onClick={() => setZoom(z => z * 1.5)}>－</button>
                    <button style={BTN_SEC} onClick={() => setZoom(1)}>⟲</button>
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs><clipPath id="clipGrafPol"><rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} /></clipPath></defs>
                {g.tx.map(v => <line key={'gx' + v} x1={g.sx(v)} x2={g.sx(v)} y1={M} y2={H - M} stroke="#21262d" />)}
                {g.ty.map(v => <line key={'gy' + v} y1={g.sy(v)} y2={g.sy(v)} x1={M} x2={W - M} stroke="#21262d" />)}
                <line x1={M} x2={W - M} y1={ejeX} y2={ejeX} stroke="#8b949e" strokeWidth="1.5" />
                {enX && <line y1={M} y2={H - M} x1={ejeY} x2={ejeY} stroke="#8b949e" strokeWidth="1.5" />}
                {g.tx.filter(v => v !== 0).map(v => <text key={'tx' + v} x={g.sx(v)} y={Math.min(H - M + 14, Math.max(M + 10, ejeX + 14))} fill="#8b949e" fontSize="11" textAnchor="middle">{numCorto(v)}</text>)}
                {g.ty.filter(v => v !== 0).map(v => <text key={'ty' + v} x={enX ? ejeY - 5 : M - 4} y={g.sy(v) + 4} fill="#8b949e" fontSize="11" textAnchor="end">{numCorto(v)}</text>)}
                <path d={g.d} fill="none" stroke="#f39c12" strokeWidth="2.6" clipPath="url(#clipGrafPol)" />
                {marcar && raices.filter(r => r.val >= g.x0 && r.val <= g.x1).map((r, i) => (
                    <g key={i}>
                        <circle cx={g.sx(r.val)} cy={ejeX} r="6" fill="#2ecc71" stroke="#0d1117" strokeWidth="2" />
                        <text x={g.sx(r.val)} y={ejeX - 11 - (i % 2) * 13} fill="#2ecc71" fontSize="12" fontWeight="700" textAnchor="middle">{r.txt}</text>
                    </g>
                ))}
                {enX && (P[0] || 0) >= g.y0 && (P[0] || 0) <= g.y1 && <circle cx={ejeY} cy={g.sy(P[0] || 0)} r="4.5" fill="#3498db" />}
            </svg>
            <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: 4 }}>
                {marcar ? '🟢 Las raíces son los puntos donde la gráfica corta al eje X. ' : 'Las raíces están donde la gráfica corta al eje X (se marcarán al terminar). '}
                🔵 Corte con el eje Y: (0, {P[0] || 0}).
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Explicación del método
// ═══════════════════════════════════════════════════════════════════════════════
export function ExplicacionMetodo({ nivel }) {
    const pasos = [
        ['🧲 Extraer factor común', 'Busca el MCD de los coeficientes y la menor potencia de x que aparece en todos los términos. Ej.: 2x³ − 8x = 2x(x² − 4).'],
        ['🔍 ¿Identidad notable?', 'Si lo que queda tiene 2 o 3 términos, mira si viene de una identidad: a² + 2ab + b² = (a + b)²,  a² − 2ab + b² = (a − b)²,  a² − b² = (a + b)(a − b).'],
        ['🎯 Posibles raíces', nivel === 4
            ? 'Si el coeficiente principal no es 1, las posibles raíces racionales son las fracciones ±p/q, con p divisor del término independiente y q divisor del coeficiente principal.'
            : 'Las posibles raíces enteras son los divisores (positivos y negativos) del término independiente. Calcula el valor numérico P(a): si da 0, a es raíz.'],
        ['➗ Ruffini', 'Cuando encuentres una raíz a, divide por (x − a) con Ruffini (resto 0). Sigue trabajando con el cociente; una raíz puede repetirse, ¡pruébala otra vez!'],
        ['2️⃣ Ecuación de 2.º grado', 'Cuando el cociente sea de grado 2, resuelve ax² + bx + c = 0 con x = (−b ± √(b² − 4ac)) / 2a. Si Δ < 0 no tiene raíces reales y se queda como factor.'],
        ['✅ Factorización y raíces', 'Escribe P(x) = (factor común)·(x − r₁)(x − r₂)… y la lista de raíces (indicando si alguna es doble).'],
    ];
    return (
        <div style={{ ...CARD, background: '#101a2b', border: '1px solid #3498db44', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, color: '#5dade2' }}>📖 Cómo se factoriza un polinomio</div>
            {pasos.map(([t, d], i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: '#3498db', color: 'white', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <div><b style={{ color: '#e6edf3', fontSize: '0.9rem' }}>{t}</b><div style={{ color: '#8b949e', fontSize: '0.83rem', lineHeight: 1.5 }}>{d}</div></div>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pasos (texto de cada paso registrado en el log)
// ═══════════════════════════════════════════════════════════════════════════════
function TablaRuffini({ paso }) {
    const c = { padding: '4px 10px', textAlign: 'center' };
    const n = paso.desc.length;
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem', margin: '6px 0' }}>
                <tbody>
                    <tr><td style={{ ...c, borderRight: '2px solid #e67e22' }}></td>
                        {paso.desc.map((v, i) => <td key={i} style={{ ...c, color: '#e6edf3', fontWeight: 700 }}>{fStr(v)}</td>)}</tr>
                    <tr style={{ borderBottom: '2px solid #566573' }}>
                        <td style={{ ...c, borderRight: '2px solid #e67e22', color: '#e67e22', fontWeight: 700 }}>{fStr(paso.raiz)}</td>
                        {paso.productos.map((v, i) => <td key={i} style={{ ...c, color: '#3498db' }}>{v ? fStr(v) : ''}</td>)}</tr>
                    <tr><td style={{ ...c, borderRight: '2px solid #e67e22' }}></td>
                        {paso.fila.map((v, i) => <td key={i} style={{ ...c, fontWeight: 700, color: i === n - 1 ? '#e74c3c' : '#2ecc71', borderLeft: i === n - 1 ? '1px dashed #566573' : 'none' }}>{fStr(v)}</td>)}</tr>
                </tbody>
            </table>
        </div>
    );
}

const factorX = r => r.n === 0 ? 'x' : `(x ${r.n > 0 ? '−' : '+'} ${fStr(fr(Math.abs(r.n), r.d))})`;
const ChipsProbados = ({ probados }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
        {probados.map((p, i) => (
            <span key={i} style={{ padding: '3px 9px', borderRadius: 7, fontSize: '0.8rem', fontFamily: 'Georgia,serif', background: p.valor.n === 0 ? '#0d3321' : '#2c0d0d', color: p.valor.n === 0 ? '#2ecc71' : '#e88', border: `1px solid ${p.valor.n === 0 ? '#27ae60' : '#5c2626'}` }}>
                P({fStr(p.r)}) = {fStr(p.valor)}{p.valor.n === 0 ? ' ✓' : ''}
            </span>
        ))}
    </div>
);
const textoCandidatos = poly => { const c = candidatos(poly); return c.slice(0, 30).map(fStr).join(', ') + (c.length > 30 ? '…' : ''); };

export function PasoView({ paso }) {
    const box = (color, titulo, children) => (
        <div style={{ ...CARD, padding: 14, background: '#0d1117', borderLeft: `4px solid ${color}` }}>
            <div style={{ fontWeight: 700, color, fontSize: '0.88rem', marginBottom: 6 }}>{titulo}</div>
            <div style={{ fontSize: '0.88rem', color: '#c9d1d9', lineHeight: 1.6 }}>{children}</div>
        </div>
    );
    const P = (p) => <span style={{ ...MATH, color: '#f39c12' }}>{polyStr(p)}</span>;
    switch (paso.tipo) {
        case 'fc': return box('#9b59b6', '🧲 Factor común', paso.ninguno
            ? <>{P(paso.P)} no tiene factor común: el MCD de los coeficientes es 1 y tiene término independiente.</>
            : <>
                MCD de los coeficientes = <b>{Math.abs(paso.g)}</b>{paso.g < 0 ? ' (con el signo del coeficiente principal, −)' : ''}
                {paso.m > 0 && <>; menor potencia de x = <b>x{sup(paso.m)}</b></>}.<br />
                <span style={MATH}>P(x) = <span style={{ color: '#c39bd3' }}>{monoStr(paso.g, paso.m)}</span> · ({polyStr(paso.Q)})</span>
            </>);
        case 'id': {
            const I = IDENTIDADES[paso.ident];
            const res = paso.bases.length === 2 ? `(${polyStr(paso.bases[0].poly)})(${polyStr(paso.bases[1].poly)})` : `(${polyStr(paso.bases[0].poly)})²`;
            return box('#1abc9c', `🔍 Identidad notable: ${I.nombre}`, <>
                {P(paso.Q)} tiene {nTerminos(paso.Q)} términos y encaja en <b>{I.formula}</b> con a = <b>{paso.aTxt}</b>, b = <b>{paso.bTxt}</b>.<br />
                <span style={MATH}>{polyStr(paso.Q)} = <span style={{ color: '#1abc9c' }}>{res}</span></span>
            </>);
        }
        case 'noId': return box('#5d6d7e', '🔍 ¿Identidad notable?', <>{P(paso.Q)} tiene {nTerminos(paso.Q)} términos, pero no es ninguna identidad notable. Seguimos con {grado(paso.Q) === 2 ? 'la ecuación de 2.º grado' : 'Ruffini'}.</>);
        case 'ruf': return box('#e67e22', `➗ Ruffini: x = ${fStr(paso.raiz)} es raíz`, <>
            Posibles raíces de {P(paso.Q)}: <span style={{ color: '#8b949e' }}>{textoCandidatos(paso.Q)}</span>
            <ChipsProbados probados={paso.probados} />
            <TablaRuffini paso={paso} />
            <span style={MATH}>{polyStr(paso.Q)} = <span style={{ color: '#e67e22' }}>{factorX(paso.raiz)}</span> · ({polyStr(paso.cociente)})</span>
        </>);
        case 'irred': return box('#7f8c8d', '🚫 Sin más raíces racionales', <>
            Ningún candidato anula {P(paso.Q)}:<ChipsProbados probados={paso.probados} />Se queda como factor (no se puede descomponer más con raíces racionales).
        </>);
        case 'cuad': {
            const { a, b, c, delta, clase, raices } = paso;
            return box('#3498db', '2️⃣ Ecuación de segundo grado', <>
                <span style={MATH}>{polyStr(paso.Q)} = 0</span> → a = {a}, b = {b}, c = {c}<br />
                Δ = b² − 4ac = {b < 0 ? `(${b})` : b}² − 4·{a}·{c < 0 ? `(${c})` : c} = <b>{delta}</b><br />
                {clase === 'ninguna' && <>Δ &lt; 0 → no tiene raíces reales: <b>{polyStr(paso.Q)}</b> queda como factor irreducible.</>}
                {clase === 'doble' && <>Δ = 0 → raíz doble x = −b/2a = <b>{fStr(raices[0])}</b></>}
                {clase === 'racional' && <>x = ({-b} ± √{delta}) / {2 * a} → x₁ = <b>{fStr(raices[0])}</b>, x₂ = <b>{fStr(raices[1])}</b></>}
                {clase === 'irracional' && <>x = ({-b} ± √{delta}) / {2 * a} → x₁ = <b>{raices[0].txt}</b> ≈ {raices[0].val.toFixed(3)}, x₂ = <b>{raices[1].txt}</b> ≈ {raices[1].val.toFixed(3)}</>}
                {clase !== 'ninguna' && <><br /><span style={MATH}>{polyStr(paso.Q)} = {a !== 1 ? a : ''}{clase === 'irracional' ? raices.map(r => `(x − (${r.txt}))`).join('') : raices.map(factorX).join('')}</span></>}
            </>);
        }
        case 'lin': return box('#27ae60', '1️⃣ Factor de grado 1', <>{P(paso.Q)} = 0 → x = <b>{fStr(paso.r)}</b></>);
        default: return null;
    }
}

function ResultadoCard({ st }) {
    const r = resultadoFinal(st);
    return (
        <div style={{ ...CARD, background: '#0d3321', border: '1px solid #27ae60', textAlign: 'center' }}>
            <div style={{ color: '#2ecc71', fontWeight: 700, marginBottom: 10 }}>✅ Factorización</div>
            <div style={{ ...MATH, fontSize: '1.15rem', color: '#e6edf3' }}>{polyStr(st.P)}</div>
            <div style={{ ...MATH, fontSize: '1.3rem', color: '#f39c12', marginTop: 4 }}>= {r.forma}</div>
            {r.formaEntera && <div style={{ ...MATH, fontSize: '1.05rem', color: '#f5b041', marginTop: 4 }}>= {r.formaEntera} <span style={{ fontSize: '0.75rem', color: '#8b949e', fontWeight: 400 }}>(sin fracciones)</span></div>}
            <div style={{ fontSize: '0.9rem', color: '#c9d1d9', marginTop: 10 }}>
                Raíces: {r.raices.length ? r.raices.map((x, i) => <b key={i} style={{ color: '#2ecc71' }}>{i ? ', ' : ''}x = {x.txt}{multTxt(x.mult)}</b>) : <b>no tiene raíces reales</b>}
            </div>
            {r.irreducibles.length > 0 && <div style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 4 }}>Factor{r.irreducibles.length > 1 ? 'es' : ''} sin raíces racionales: {r.irreducibles.join(', ')}</div>}
        </div>
    );
}
const raicesGrafica = st => resultadoFinal(st).raices.map(r => ({ txt: r.txt, val: r.val }));

// ═══════════════════════════════════════════════════════════════════════════════
// Resolución automática con todos los pasos
// ═══════════════════════════════════════════════════════════════════════════════
export function ResolucionAuto({ P }) {
    const st = useMemo(() => factorizarAuto(P), [P]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {st.log.map((p, i) => <PasoView key={i} paso={p} />)}
            <ResultadoCard st={st} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Modo guiado: el alumno hace cada paso y se le corrige
// ═══════════════════════════════════════════════════════════════════════════════
export function GuiaFactorizacion({ P, onTerminar }) {
    const [st, setSt] = useState(() => estadoInicial(P));
    const [errores, setErrores] = useState(0);
    const [aviso, setAviso] = useState(null);
    const [fcK, setFcK] = useState(''); const [fcM, setFcM] = useState('0');
    const [idResp, setIdResp] = useState(null);
    const [prueba, setPrueba] = useState('');
    const [verCand, setVerCand] = useState(false);
    const [x1, setX1] = useState(''); const [x2, setX2] = useState(''); const [sinSol, setSinSol] = useState(false);
    const [verFormula, setVerFormula] = useState(false);
    const terminadoRef = useRef(false);
    const finRef = useRef(null);

    useEffect(() => {
        if (st.fase === 'fin' && !terminadoRef.current) { terminadoRef.current = true; onTerminar?.(errores === 0, st); }
        finRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }, [st.fase, st.log.length]); // eslint-disable-line

    const fallo = msg => { setErrores(e => e + 1); setAviso({ ok: false, msg }); };
    const pasar = (fn, msg) => { const n = fn(clonar(st)); setSt(n); setAviso(msg ? { ok: true, msg } : null); resetInputs(); };
    const resetInputs = () => { setIdResp(null); setPrueba(''); setVerCand(false); setX1(''); setX2(''); setSinSol(false); setVerFormula(false); };

    // ── Paso 1: factor común
    const fc = useMemo(() => factorComun(P), [P]);
    const comprobarFC = (k, m) => {
        const kk = parseInt(k, 10), mm = parseInt(m, 10);
        if (Math.abs(kk) === Math.abs(fc.g) && mm === fc.m) return pasar(aplicarFactorComun, fc.ninguno ? '¡Bien! No tiene factor común.' : '¡Correcto!');
        if (fc.ninguno) return fallo('Fíjate: el MCD de los coeficientes es 1 y hay término independiente, así que no hay factor común.');
        if (Math.abs(kk) !== Math.abs(fc.g)) return fallo(`El número no es correcto: calcula el MCD de los coeficientes (${norm(P).filter(Boolean).map(Math.abs).join(', ')}).`);
        return fallo('La potencia de x no es correcta: busca la menor potencia de x que aparece en todos los términos.');
    };

    // ── Paso 2: identidad notable
    const comprobarId = resp => {
        const id = detectarIdentidad(st.actual.poly);
        const ok = (id?.tipo || 'no') === resp;
        if (ok) return pasar(aplicarIdentidad, id ? `¡Sí! Es ${IDENTIDADES[id.tipo].nombre.toLowerCase()}.` : '¡Bien! No es una identidad notable.');
        setIdResp(resp);
        fallo(id ? 'No es esa. Comprueba si los extremos son cuadrados perfectos y el término central es el doble producto.' : 'No es una identidad notable: ¿son cuadrados perfectos los extremos? ¿Coincide el doble producto?');
    };

    // ── Paso 3: Ruffini
    const probar = (valTxt) => {
        const v = parseNumero(valTxt ?? prueba);
        if (!v?.frac) { setAviso({ ok: false, msg: 'Escribe un número entero o una fracción (p. ej. 3/2).' }); return; }
        const n = clonar(st);
        const res = probarValor(n, v.frac);
        setPrueba('');
        if (res.esRaiz) { setSt(res.st); setAviso({ ok: true, msg: `✅ P(${fStr(v.frac)}) = 0 → x = ${fStr(v.frac)} es raíz. Hacemos Ruffini y seguimos con el cociente.` }); setVerCand(false); }
        else { setSt(n); setAviso({ ok: false, msg: `P(${fStr(v.frac)}) = ${fStr(res.valor)} ≠ 0 → no es raíz. Prueba otro candidato.`, suave: true }); }
    };
    const sinMasRaices = () => {
        const r = raizRacionalPendiente(st.actual.poly);
        if (r) return fallo('Todavía hay alguna raíz entre los candidatos. ¡Sigue probando!');
        pasar(marcarIrreducible, 'Correcto: no tiene más raíces racionales.');
    };

    // ── Paso 4: ecuación de 2.º grado
    const comprobarCuad = () => {
        const sol = resolverCuadratica(st.actual.poly);
        if (sinSol) return sol.tipo === 'ninguna' ? pasar(aplicarCuadratica, '¡Correcto! Δ < 0, no tiene raíces reales.') : fallo('Sí tiene raíces reales: calcula el discriminante Δ = b² − 4ac.');
        if (sol.tipo === 'ninguna') return fallo('Revisa el discriminante: Δ = b² − 4ac.');
        const a = parseNumero(x1), b = parseNumero(x2) || (sol.tipo === 'doble' ? a : null);
        if (!a || !b) return setAviso({ ok: false, msg: 'Escribe las dos soluciones (puedes usar fracciones o decimales).' });
        const esp = sol.raices.map(r => r.irr ? r.val : fVal(r)).sort((p, q) => p - q);
        const dad = [a.val, b.val].sort((p, q) => p - q);
        const tol = sol.tipo === 'irracional' ? 0.01 : 1e-9;
        if (esp.every((v, i) => Math.abs(v - dad[i]) <= tol)) return pasar(aplicarCuadratica, '¡Correcto!');
        fallo('Las soluciones no son correctas. Usa x = (−b ± √Δ) / 2a.');
    };

    const verSolucion = () => {
        setErrores(e => e + 1);
        if (st.fase === 'fc') pasar(aplicarFactorComun);
        else if (st.fase === 'id') pasar(aplicarIdentidad);
        else if (st.fase === 'cuad') pasar(aplicarCuadratica);
        else if (st.fase === 'ruf') {
            const r = raizRacionalPendiente(st.actual.poly);
            if (!r) return pasar(marcarIrreducible);
            const n = clonar(st); const res = probarValor(n, r); setSt(res.st); setAviso(null); resetInputs();
        }
    };

    const panel = (titulo, children, conSolucion = true) => (
        <div style={{ ...CARD, border: '1px solid #f39c1288', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, color: '#f39c12' }}>{titulo}</div>
            {children}
            {aviso && !aviso.ok && <div style={{ padding: '8px 12px', borderRadius: 9, fontSize: '0.86rem', background: aviso.ok ? '#0d3321' : aviso.suave ? '#2b2210' : '#2c0d0d', color: aviso.ok ? '#2ecc71' : aviso.suave ? '#f5b041' : '#e88', border: `1px solid ${aviso.ok ? '#27ae60' : aviso.suave ? '#7d5a12' : '#5c2626'}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                {aviso.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}{aviso.msg}</div>}
            {conSolucion && <button style={{ ...BTN_SEC, alignSelf: 'flex-start', color: '#8b949e' }} onClick={verSolucion}>👀 Ver solución de este paso</button>}
        </div>
    );
    const poly = st.actual?.poly;
    const lead = poly ? poly[poly.length - 1] : 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {st.log.map((p, i) => <PasoView key={i} paso={p} />)}
            {aviso?.ok && st.fase !== 'fin' && <div style={{ color: '#2ecc71', fontSize: '0.85rem', fontWeight: 700 }}>✓ {aviso.msg}</div>}

            {st.fase === 'fc' && panel('Paso 1 · ¿Qué factor común tiene P(x)?', <>
                <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>Escribe el MCD de los coeficientes y la menor potencia de x que tienen todos los términos.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...MATH }}>
                    <input type="number" value={fcK} onChange={e => setFcK(e.target.value)} placeholder="nº" style={{ ...INPUT, width: 70 }} />
                    <span>· x^</span>
                    <select value={fcM} onChange={e => setFcM(e.target.value)} style={{ ...INPUT, width: 60 }}>
                        {Array.from({ length: Math.max(1, grado(P)) }, (_, i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <button style={BTN('#f39c12', '#111')} onClick={() => comprobarFC(fcK, fcM)}>Comprobar</button>
                    <button style={BTN_SEC} onClick={() => comprobarFC('1', '0')}>No tiene factor común</button>
                </div>
            </>)}

            {st.fase === 'id' && panel(<>Paso · ¿<span style={MATH}>{polyStr(poly)}</span> proviene de una identidad notable?</>, <>
                <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>Tiene {nTerminos(poly)} términos. Recuerda: a² + 2ab + b² = (a + b)² · a² − 2ab + b² = (a − b)² · a² − b² = (a + b)(a − b)</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[...Object.entries(IDENTIDADES).map(([k, v]) => [k, v.nombre]), ['no', 'No es identidad notable']].map(([k, lbl]) => (
                        <button key={k} onClick={() => comprobarId(k)} style={{ ...BTN_SEC, borderColor: idResp === k ? '#e74c3c' : '#30363d', padding: '9px 14px' }}>{lbl}</button>
                    ))}
                </div>
            </>)}

            {st.fase === 'ruf' && panel(<>Paso · Busca una raíz de <span style={MATH}>{polyStr(poly)}</span></>, <>
                <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
                    {lead === 1
                        ? <>Las posibles raíces enteras son los divisores del término independiente (<b style={{ color: '#f39c12' }}>{poly[0]}</b>).</>
                        : <>Coeficiente principal {lead} ≠ 1: las posibles raíces son las fracciones ±p/q con p divisor de <b style={{ color: '#f39c12' }}>{poly[0]}</b> y q divisor de <b style={{ color: '#f39c12' }}>{lead}</b>.</>}
                    {' '}Calcula P(a): si da 0, a es raíz.
                </div>
                <button style={{ ...BTN_SEC, alignSelf: 'flex-start' }} onClick={() => setVerCand(v => !v)}>{verCand ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ver posibles raíces</button>
                {verCand && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {candidatos(poly).map((c, i) => {
                        const ya = st.actual.probados.some(p => p.r.n === c.n && p.r.d === c.d);
                        return <button key={i} onClick={() => probar(`${c.n}/${c.d}`)} disabled={ya} style={{ ...BTN_SEC, padding: '4px 10px', fontFamily: 'Georgia,serif', opacity: ya ? 0.35 : 1 }}>{fStr(c)}</button>;
                    })}
                </div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#8b949e' }}>Prueba x =</span>
                    <input value={prueba} onChange={e => setPrueba(e.target.value)} onKeyDown={e => e.key === 'Enter' && probar()} placeholder="2 ó −1/2" style={{ ...INPUT, width: 90 }} />
                    <button style={BTN('#e67e22')} onClick={() => probar()}>Calcular P(x)</button>
                    <button style={BTN_SEC} onClick={sinMasRaices}>No hay más raíces racionales</button>
                </div>
                {st.actual.probados.length > 0 && <ChipsProbados probados={st.actual.probados} />}
            </>)}

            {st.fase === 'cuad' && panel(<>Paso · Resuelve <span style={MATH}>{polyStr(poly)} = 0</span></>, <>
                <button style={{ ...BTN_SEC, alignSelf: 'flex-start' }} onClick={() => setVerFormula(v => !v)}>{verFormula ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Recordar la fórmula</button>
                {verFormula && (() => { const [c, b, a] = poly; return <div style={{ ...MATH, fontSize: '0.9rem', color: '#c9d1d9', fontWeight: 400 }}>x = (−b ± √(b² − 4ac)) / 2a con a = {a}, b = {b}, c = {c}</div>; })()}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...MATH }}>
                    <span>x₁ =</span><input value={x1} disabled={sinSol} onChange={e => setX1(e.target.value)} style={{ ...INPUT, width: 90 }} />
                    <span>x₂ =</span><input value={x2} disabled={sinSol} onChange={e => setX2(e.target.value)} style={{ ...INPUT, width: 90 }} />
                </div>
                <label style={{ fontSize: '0.85rem', color: '#8b949e', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={sinSol} onChange={e => setSinSol(e.target.checked)} /> No tiene solución real (Δ &lt; 0)
                </label>
                <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>Fracciones (3/2) o decimales con 2 cifras si son irracionales. Si es doble, escribe la misma en las dos.</div>
                <button style={{ ...BTN('#3498db'), alignSelf: 'flex-start' }} onClick={comprobarCuad}>Comprobar</button>
            </>)}

            {st.fase === 'fin' && <ResultadoCard st={st} />}
            <div ref={finRef} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Modal: escribe tu polinomio → resolver o guiar
// ═══════════════════════════════════════════════════════════════════════════════
export function ModalMiPolinomio({ onClose }) {
    const [txt, setTxt] = useState('');
    const [P, setP] = useState(null);
    const [modo, setModo] = useState(null);
    const [grafica, setGrafica] = useState(false);
    const [guiaKey, setGuiaKey] = useState(0);
    const [stFin, setStFin] = useState(null);
    const parsed = useMemo(() => { if (!txt.trim()) return null; try { return { P: parsePolinomio(txt) }; } catch (e) { return { error: e.message }; } }, [txt]);
    const empezar = m => { if (!parsed?.P) return; setP(parsed.P); setModo(m); setGuiaKey(k => k + 1); setStFin(null); };
    const auto = useMemo(() => P ? factorizarAuto(P) : null, [P]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, overflowY: 'auto', padding: 16 }}>
            <div style={{ background: '#0d1117', borderRadius: 14, padding: 20, maxWidth: 760, margin: '0 auto', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f39c12' }}>✍️ Factoriza tu polinomio</div>
                    <button onClick={onClose} style={{ ...BTN_SEC, padding: 6 }}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && empezar('auto')}
                        placeholder="Ej.: 2x^4 − 2x^3 − 14x^2 + 2x + 12" style={{ ...INPUT, flex: 1, minWidth: 220, textAlign: 'left' }} autoFocus />
                </div>
                <div style={{ fontSize: '0.8rem', minHeight: 18, color: parsed?.error ? '#e88' : '#8b949e' }}>
                    {parsed?.error || (parsed?.P ? <>P(x) = <span style={{ ...MATH, color: '#f39c12' }}>{polyStr(parsed.P)}</span></> : 'Usa x y potencias con ^ (x^3) o con superíndices (x³). Coeficientes enteros, grado máximo 8.')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button disabled={!parsed?.P} style={{ ...BTN('#27ae60'), opacity: parsed?.P ? 1 : 0.4 }} onClick={() => empezar('auto')}>🤖 Factorízalo paso a paso</button>
                    <button disabled={!parsed?.P} style={{ ...BTN('#3498db'), opacity: parsed?.P ? 1 : 0.4 }} onClick={() => empezar('guia')}>🧑‍🏫 Guíame para hacerlo yo</button>
                    {P && <button style={BTN_SEC} onClick={() => setGrafica(g => !g)}>📈 {grafica ? 'Ocultar' : 'Representar'} la función</button>}
                </div>
                {P && grafica && <GraficaPolinomio P={P} raices={raicesGrafica(auto)} marcar={modo === 'auto' || !!stFin} />}
                {P && modo === 'auto' && <ResolucionAuto P={P} />}
                {P && modo === 'guia' && <GuiaFactorizacion key={guiaKey} P={P} onTerminar={(_, st) => setStFin(st)} />}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO — Factorización (práctica guiada, niveles 3.º / 4.º ESO)
// ═══════════════════════════════════════════════════════════════════════════════
const TIPOS_EJ = [
    { id: null, lbl: '🎲 Variado' },
    { id: 'fcRuf', lbl: '🧲 Factor común + Ruffini' },
    { id: 'id', lbl: '🔍 Identidades' },
    { id: 'fcId', lbl: '🧲 Factor común + identidad' },
    { id: 'ruf', lbl: '➗ Ruffini' },
];

export function M_Factorizacion({ onScore }) {
    const [nivel, setNivel] = useState(3);
    const [tipo, setTipo] = useState(null);
    const [ej, setEj] = useState(() => ({ ...generarEjercicio(3), n: 0 }));
    const [verExp, setVerExp] = useState(false);
    const [verGraf, setVerGraf] = useState(false);
    const [modal, setModal] = useState(false);
    const [fin, setFin] = useState(null);
    const [score, setScore] = useState({ ok: 0, total: 0 });
    const auto = useMemo(() => factorizarAuto(ej.P), [ej]);

    const nuevo = (nv = nivel, tp = tipo) => { setEj(e => ({ ...generarEjercicio(nv, tp || undefined), n: e.n + 1 })); setFin(null); };
    const terminar = (ok) => {
        setFin({ ok });
        setScore(s => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
        onScore(ok ? 1 : 0, 1);
    };
    const chip = (act, color) => ({ padding: '6px 14px', borderRadius: 8, border: `2px solid ${act ? color : '#30363d'}`, background: act ? color + '22' : 'transparent', color: 'white', cursor: 'pointer', fontWeight: act ? 700 : 400, fontSize: '0.85rem' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {[[3, '3.º ESO · mónicos'], [4, '4.º ESO · raíces p/q']].map(([n, l]) => (
                    <button key={n} style={chip(nivel === n, '#e67e22')} onClick={() => { setNivel(n); nuevo(n); }}>{l}</button>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TIPOS_EJ.map(t => <button key={t.lbl} style={{ ...chip(tipo === t.id, '#3498db'), fontSize: '0.78rem', padding: '5px 10px' }} onClick={() => { setTipo(t.id); nuevo(nivel, t.id); }}>{t.lbl}</button>)}
            </div>

            <div style={{ ...CARD, textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: 6 }}>Factoriza y halla las raíces de</div>
                <div style={{ ...MATH, fontSize: '1.45rem', color: '#f39c12' }}>P(x) = {polyStr(ej.P)}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={BTN_SEC} onClick={() => setVerExp(v => !v)}>📖 {verExp ? 'Ocultar' : 'Cómo se hace'}</button>
                <button style={BTN_SEC} onClick={() => setVerGraf(v => !v)}>📈 {verGraf ? 'Ocultar gráfica' : 'Representar la función'}</button>
                <button style={BTN_SEC} onClick={() => setModal(true)}>✍️ Escribir mi polinomio</button>
                <button style={BTN_SEC} onClick={() => nuevo()}><RefreshCw size={14} /> Otro polinomio</button>
            </div>
            {verExp && <ExplicacionMetodo nivel={nivel} />}
            {verGraf && <GraficaPolinomio P={ej.P} raices={raicesGrafica(auto)} marcar={!!fin} />}

            <GuiaFactorizacion key={ej.n} P={ej.P} onTerminar={terminar} />

            {fin && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: fin.ok ? '#2ecc71' : '#f5b041', fontWeight: 700 }}>{fin.ok ? '🎉 ¡Perfecto, sin errores!' : 'Terminado, pero con algún fallo o ayuda. ¡Prueba otro!'}</div>
                    <button style={BTN('#3498db')} onClick={() => nuevo()}><RefreshCw size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Nuevo polinomio</button>
                </div>
            )}
            <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>✅ {score.ok} / {score.total}</span>
            {modal && <ModalMiPolinomio onClose={() => setModal(false)} />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO — Extraer factor común
// ═══════════════════════════════════════════════════════════════════════════════
const rI = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
function genFactorComun() {
    for (;;) {
        const g = [2, 2, 3, 3, 4, 5, 6, 1, -2, -3][rI(0, 9)];
        const m = rI(0, 3);
        if (g === 1 && m === 0) continue;
        const deg = rI(1, 3);
        const Q = Array.from({ length: deg + 1 }, (_, i) => i === deg ? rI(1, 5) : (Math.random() < 0.3 && i > 0 ? 0 : rI(-7, 7)));
        if (!Q[0] || nTerminos(Q) < 2 || Q.reduce((a, v) => gcd(a, v), 0) !== 1) continue;
        const P = norm(mul(Q, [...Array(m).fill(0), g]));
        if (P.some(v => Math.abs(v) > 80)) continue;
        return { P, g, m, Q };
    }
}

export function M_FactorComun({ onScore }) {
    const [ej, setEj] = useState(genFactorComun);
    const [k, setK] = useState(''); const [m, setM] = useState('0'); const [inner, setInner] = useState('');
    const [result, setResult] = useState(null);
    const [verExp, setVerExp] = useState(false);
    const [score, setScore] = useState({ ok: 0, total: 0 });

    const innerParsed = useMemo(() => { if (!inner.trim()) return null; try { return parsePolinomio(inner); } catch { return 'err'; } }, [inner]);

    const comprobar = () => {
        const kk = parseInt(k, 10), mm = parseInt(m, 10);
        if (!kk) { setResult({ ok: false, msg: 'Escribe el número del factor común.' }); return; }
        const Qr = Array.isArray(innerParsed) ? innerParsed : null;
        const prod = Qr ? norm(mul(Qr, [...Array(mm).fill(0), kk])) : null;
        const igual = prod && prod.length === ej.P.length && prod.every((v, i) => v === ej.P[i]);
        const maximo = Math.abs(kk) === Math.abs(ej.g) && mm === ej.m;
        const ok = igual && maximo;
        let msg = '¡Correcto!';
        if (!ok) msg = !maximo
            ? (Math.abs(kk) !== Math.abs(ej.g) ? `El número debe ser el MCD de los coeficientes: ${Math.abs(ej.g)}.` : `La potencia de x debe ser la menor que aparece: x${ej.m ? sup(ej.m) : '⁰'}.`)
            : 'El polinomio del paréntesis no es correcto: divide cada término entre el factor común.';
        const fcTxt = monoStr(ej.g, ej.m);
        setResult({ ok, msg, explicacion: `${polyStr(ej.P)} = ${fcTxt} · (${polyStr(ej.Q)})` });
        setScore(s => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
        onScore(ok ? 1 : 0, 1);
    };
    const nuevo = () => { setEj(genFactorComun()); setK(''); setM('0'); setInner(''); setResult(null); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...CARD, textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: 6 }}>Extrae el factor común de</div>
                <div style={{ ...MATH, fontSize: '1.45rem', color: '#f39c12' }}>{polyStr(ej.P)}</div>
            </div>
            <button style={{ ...BTN_SEC, alignSelf: 'flex-start' }} onClick={() => setVerExp(v => !v)}>📖 {verExp ? 'Ocultar' : 'Cómo se extrae el factor común'}</button>
            {verExp && (
                <div style={{ ...CARD, background: '#1a1030', border: '1px solid #9b59b644', fontSize: '0.86rem', color: '#c9d1d9', lineHeight: 1.7 }}>
                    <b style={{ color: '#c39bd3' }}>1.</b> Calcula el <b>MCD de los coeficientes</b> (si el primero es negativo, puedes sacar también el signo −).<br />
                    <b style={{ color: '#c39bd3' }}>2.</b> Toma la <b>menor potencia de x</b> que aparece en todos los términos.<br />
                    <b style={{ color: '#c39bd3' }}>3.</b> Divide cada término entre el factor común y escribe el resultado entre paréntesis.<br />
                    <span style={MATH}>Ej.: 6x³ − 9x² + 3x = 3x · (2x² − 3x + 1)</span><br />
                    <span style={{ color: '#8b949e' }}>Compruébalo multiplicando: debe salir el polinomio inicial.</span>
                </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...MATH }}>
                <input type="number" value={k} onChange={e => setK(e.target.value)} disabled={!!result} placeholder="nº" style={{ ...INPUT, width: 70 }} />
                <span>· x^</span>
                <select value={m} onChange={e => setM(e.target.value)} disabled={!!result} style={{ ...INPUT, width: 60 }}>
                    {[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <span>· (</span>
                <input value={inner} onChange={e => setInner(e.target.value)} disabled={!!result} placeholder="2x^2 − 3x + 1" style={{ ...INPUT, width: 200, textAlign: 'left' }} />
                <span>)</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: innerParsed === 'err' ? '#e88' : '#8b949e' }}>
                {innerParsed === 'err' ? 'No entiendo el polinomio del paréntesis (usa x^2 o x²).' : Array.isArray(innerParsed) ? <>Paréntesis: <span style={{ ...MATH, color: '#f39c12' }}>{polyStr(innerParsed)}</span></> : 'Escribe lo que queda dentro del paréntesis.'}
            </div>
            {!result
                ? <button style={{ ...BTN('#f39c12', '#111'), alignSelf: 'flex-start' }} onClick={comprobar}>Comprobar</button>
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                        <div style={{ padding: '10px 20px', borderRadius: 10, background: result.ok ? '#0d3321' : '#2c0d0d', border: `1px solid ${result.ok ? '#2ecc71' : '#e74c3c'}`, color: result.ok ? '#2ecc71' : '#e74c3c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {result.ok ? <CheckCircle size={18} /> : <XCircle size={18} />}{result.msg}
                        </div>
                        <div style={{ ...MATH, color: '#c9d1d9' }}>{result.explicacion}</div>
                        <button style={BTN('#f39c12', '#111')} onClick={nuevo}>Siguiente →</button>
                    </div>
                )}
            <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>✅ {score.ok} / {score.total}</span>
        </div>
    );
}
