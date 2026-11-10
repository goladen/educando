// Terminologia.jsx — Álgebra · Math World, módulo 1 (partes de polinomios + traducción al lenguaje algebraico)
import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const CARD = { background: '#161b22', borderRadius: 14, padding: 20, border: '1px solid #30363d' };
const BTN = (bg, col = 'white') => ({ padding: '10px 22px', borderRadius: 9, border: 'none', background: bg, color: col, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' });
const MATH = { fontFamily: 'Georgia,serif', fontWeight: 700 };
const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
const ri = (lo, hi, ne) => { let v; do { v = Math.floor(Math.random() * (hi - lo + 1)) + lo; } while (ne !== undefined && v === ne); return v; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const barajar = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ═══════════════════════════════════════════════════════════════════════════════
// Partes de un polinomio
// ═══════════════════════════════════════════════════════════════════════════════
const termTxt = (c, d) => { const a = Math.abs(c); const l = d === 0 ? '' : d === 1 ? 'x' : `x${SUP[d]}`; return d === 0 ? `${a}` : (a === 1 ? l : `${a}${l}`); };
export const NOMBRES = ['Monomio', 'Binomio', 'Trinomio', 'Polinomio'];

export function genPolTerm() {
    const deg = ri(2, 5);
    const c = Array(deg + 1).fill(0);
    c[deg] = ri(-9, 9, 0);
    const completo = Math.random() < 0.35;
    for (let d = 0; d < deg; d++) c[d] = completo || Math.random() < 0.5 ? ri(-9, 9, 0) : 0;
    let orden = [];
    for (let d = deg; d >= 0; d--) if (c[d]) orden.push(d);
    const ordenado = Math.random() < 0.5 || orden.length < 2;
    if (!ordenado) { let o; do { o = barajar(orden); } while (o.every((d, i) => d === orden[i])); orden = o; }
    const txt = orden.map((d, i) => (i === 0 ? (c[d] < 0 ? '−' : '') : (c[d] < 0 ? ' − ' : ' + ')) + termTxt(c[d], d)).join('');
    const n = orden.length;
    return {
        txt, ordenado, c,
        sol: { grado: deg, nTerm: n, principal: c[deg], indep: c[0], nombre: NOMBRES[Math.min(n, 4) - 1], completo: c.every(v => v !== 0) ? 'Sí' : 'No' },
    };
}
const CAMPOS = [
    { k: 'grado', lbl: 'Grado', tipo: 'num', ayuda: 'El mayor exponente de x.' },
    { k: 'nTerm', lbl: 'Nº de términos', tipo: 'num', ayuda: 'Cuántos monomios tiene.' },
    { k: 'principal', lbl: 'Coef. principal', tipo: 'num', ayuda: 'El coeficiente del término de mayor grado.' },
    { k: 'indep', lbl: 'Término independiente', tipo: 'num', ayuda: 'El número sin x (0 si no aparece).' },
    { k: 'nombre', lbl: 'Se llama', tipo: 'sel', ops: NOMBRES, ayuda: '1, 2, 3 o 4 o más términos.' },
    { k: 'completo', lbl: '¿Completo?', tipo: 'sel', ops: ['Sí', 'No'], ayuda: 'Tiene todos los grados, desde el mayor hasta el 0.' },
];
const leer = s => parseInt(String(s).replace(/[−–]/g, '-'), 10);

export function TermPolinomios({ onScore }) {
    const N = 2;
    const [pols, setPols] = useState(() => Array.from({ length: N }, genPolTerm));
    const [resp, setResp] = useState(() => Array.from({ length: N }, () => ({})));
    const [chk, setChk] = useState(null);
    const [score, setScore] = useState({ ok: 0, total: 0 });

    const comprobar = () => {
        const r = pols.map((p, i) => Object.fromEntries(CAMPOS.map(c => [c.k, c.tipo === 'num' ? leer(resp[i][c.k] ?? '') === p.sol[c.k] : resp[i][c.k] === p.sol[c.k]])));
        const ok = r.reduce((s, x) => s + Object.values(x).filter(Boolean).length, 0);
        setChk(r); setScore(s => ({ ok: s.ok + ok, total: s.total + N * CAMPOS.length }));
        onScore(ok, N * CAMPOS.length);
    };
    const nuevo = () => { setPols(Array.from({ length: N }, genPolTerm)); setResp(Array.from({ length: N }, () => ({}))); setChk(null); };
    const inS = ok => ({ padding: '6px 8px', borderRadius: 6, border: `1.5px solid ${ok === undefined ? '#30363d' : ok ? '#27ae60' : '#e74c3c'}`, background: '#0d1117', color: '#e6edf3', width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: '0.95rem' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem' }}>Analiza cada polinomio. Ojo: algunos no están ordenados, y el grado y el coeficiente principal dependen del término de <b>mayor grado</b>, no del primero.</p>
            {pols.map((p, i) => (
                <div key={i} style={CARD}>
                    <div style={{ ...MATH, fontSize: '1.35rem', color: '#f39c12', textAlign: 'center', marginBottom: 14 }}>P(x) = {p.txt}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                        {CAMPOS.map(c => {
                            const ok = chk?.[i]?.[c.k];
                            return (
                                <label key={c.k} title={c.ayuda} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: '#8b949e' }}>
                                    {c.lbl}
                                    {c.tipo === 'num'
                                        ? <input inputMode="numeric" value={resp[i][c.k] ?? ''} disabled={!!chk} onChange={e => setResp(r => { const n = [...r]; n[i] = { ...n[i], [c.k]: e.target.value }; return n; })} style={inS(ok)} />
                                        : <select value={resp[i][c.k] ?? ''} disabled={!!chk} onChange={e => setResp(r => { const n = [...r]; n[i] = { ...n[i], [c.k]: e.target.value }; return n; })} style={{ ...inS(ok), cursor: 'pointer' }}>
                                            <option value="">—</option>{c.ops.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>}
                                    {chk && !ok && <span style={{ color: '#2ecc71', fontWeight: 700 }}>→ {String(p.sol[c.k]).replace('-', '−')}</span>}
                                </label>
                            );
                        })}
                    </div>
                    {chk && !p.ordenado && <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#8b949e' }}>Ordenado de mayor a menor grado se ve mejor el término principal.</div>}
                </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {!chk
                    ? <button style={BTN('#f39c12', '#111')} onClick={comprobar}>Comprobar</button>
                    : <button style={BTN('#3498db')} onClick={nuevo}><RefreshCw size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Nuevo ejercicio</button>}
                <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>✅ {score.ok} / {score.total}</span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Traducción del lenguaje cotidiano al algebraico (unir con líneas)
// ═══════════════════════════════════════════════════════════════════════════════
// Cada grupo reúne enunciados que se confunden entre sí (con el mismo número k).
const GRUPOS = [
    (k) => [['El doble de un número más ' + k, `2x + ${k}`], ['El doble de la suma de un número y ' + k, `2·(x + ${k})`], ['Un número más el doble de ' + k, `x + ${2 * k}`]],
    (k) => [['La mitad de un número más ' + k, `x/2 + ${k}`], ['La mitad de la suma de un número y ' + k, `(x + ${k})/2`], ['La mitad de un número menos ' + k, `x/2 − ${k}`]],
    (k) => [['El cuadrado de un número más ' + k, `x² + ${k}`], ['El cuadrado de la suma de un número y ' + k, `(x + ${k})²`], ['El doble del cuadrado de un número', '2x²'], ['El cuadrado del doble de un número', '(2x)²']],
    (k) => [['El triple de un número menos ' + k, `3x − ${k}`], ['El triple de la diferencia entre un número y ' + k, `3·(x − ${k})`], [k + ' menos el triple de un número', `${k} − 3x`]],
    () => [['La suma de un número y su siguiente', 'x + (x + 1)'], ['El producto de un número y su siguiente', 'x·(x + 1)'], ['El número anterior a x', 'x − 1'], ['La suma de tres números consecutivos', 'x + (x + 1) + (x + 2)']],
    (k) => [[`La edad de Lucía dentro de ${k} años (hoy tiene x)`, `x + ${k}`], [`La edad de Lucía hace ${k} años`, `x − ${k}`], [`El doble de la edad que tendrá Lucía dentro de ${k} años`, `2·(x + ${k})`], ['La edad de su abuelo, que tiene el cuádruple que Lucía', '4x']],
    () => [['La tercera parte de un número', 'x/3'], ['Un número menos su tercera parte', 'x − x/3'], ['El 20 % de un número', '0,2x'], ['Un número aumentado en su 10 %', 'x + 0,1x']],
    (k) => [['El perímetro de un cuadrado de lado x', '4x'], ['El área de un cuadrado de lado x', 'x²'], [`El perímetro de un rectángulo de base x y altura ${k}`, `2x + ${2 * k}`], [`El área de un rectángulo de base x y altura ${k}`, `${k}x`]],
    () => [['Un número par cualquiera', '2x'], ['Un número impar cualquiera', '2x + 1'], ['El cubo de un número', 'x³'], ['Un número más su cuadrado', 'x + x²']],
    (k, m) => [[`Lo que cuestan x cuadernos a ${k} € cada uno`, `${k}x`], [`Lo que cuestan x bolígrafos a ${k} € y una mochila de ${m * 5} €`, `${k}x + ${m * 5}`], ['La vuelta al pagar x chicles de 1 € con un billete de 20 €', '20 − x']],
    (k) => [['La diferencia entre un número y ' + k, `x − ${k}`], [`La diferencia entre ${k} y un número`, `${k} − x`], ['El opuesto de un número', '−x'], ['El inverso de un número', '1/x']],
];

export function genTraduccion(n = 5) {
    const items = []; const vistos = new Set();
    for (const g of barajar(GRUPOS)) {
        const k = ri(2, 9); const m = ri(2, 6);
        for (const [e, x] of barajar(g(k, m)).slice(0, 3)) {
            if (items.length >= n || vistos.has(x)) continue;
            vistos.add(x); items.push({ e, x });
        }
        if (items.length >= n) break;
    }
    const der = barajar(items.map((_, i) => i));
    return { items, der, key: Math.random() };
}

export function TraduccionAlgebraica({ onScore }) {
    const [ej, setEj] = useState(() => genTraduccion());
    const [sel, setSel] = useState(null);            // índice izquierdo seleccionado
    const [pares, setPares] = useState({});          // izq → índice del item elegido a la derecha
    const [chk, setChk] = useState(null);
    const [score, setScore] = useState({ ok: 0, total: 0 });
    const [lineas, setLineas] = useState([]);
    const cont = useRef(null); const izq = useRef([]); const der = useRef([]);
    const [tick, setTick] = useState(0);

    useEffect(() => { const f = () => setTick(t => t + 1); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
    useLayoutEffect(() => {
        const c = cont.current?.getBoundingClientRect(); if (!c) return;
        const ls = Object.entries(pares).map(([i, j]) => {
            const a = izq.current[i]?.getBoundingClientRect(); const pos = ej.der.indexOf(j); const b = der.current[pos]?.getBoundingClientRect();
            if (!a || !b) return null;
            return { i: +i, j, x1: a.right - c.left, y1: a.top + a.height / 2 - c.top, x2: b.left - c.left, y2: b.top + b.height / 2 - c.top };
        }).filter(Boolean);
        setLineas(ls);
    }, [pares, ej, tick, chk]);

    const clickIzq = i => { if (chk) return; if (pares[i] !== undefined) { setPares(p => { const n = { ...p }; delete n[i]; return n; }); setSel(i); return; } setSel(s => s === i ? null : i); };
    const clickDer = j => {
        if (chk || sel === null) return;
        setPares(p => { const n = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== j)); n[sel] = j; return n; });
        const libre = ej.items.findIndex((_, i) => i !== sel && pares[i] === undefined);
        setSel(libre >= 0 ? libre : null);
    };
    const comprobar = () => {
        const r = ej.items.map((_, i) => pares[i] === i);
        const ok = r.filter(Boolean).length;
        setChk(r); setSel(null); setScore(s => ({ ok: s.ok + ok, total: s.total + r.length }));
        onScore(ok, r.length);
    };
    const nuevo = () => { setEj(genTraduccion()); setPares({}); setSel(null); setChk(null); };
    const completos = Object.keys(pares).length === ej.items.length;
    const colorLinea = l => chk ? (chk[l.i] ? '#2ecc71' : '#e74c3c') : '#f39c12';
    const caja = (activo, borde) => ({ padding: '10px 12px', borderRadius: 10, border: `2px solid ${borde || (activo ? '#f39c12' : '#30363d')}`, background: activo ? '#2d1e00' : '#161b22', cursor: chk ? 'default' : 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', boxSizing: 'border-box' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem' }}>Une cada enunciado con su expresión algebraica: toca un enunciado y después su expresión. Toca un enunciado ya unido para deshacer. <b>x</b> representa el número desconocido.</p>
            <div ref={cont} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'clamp(28px, 9vw, 80px)', rowGap: 10 }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                    {lineas.map(l => <g key={l.i}><line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={colorLinea(l)} strokeWidth={3} strokeLinecap="round" /><circle cx={l.x1} cy={l.y1} r={5} fill={colorLinea(l)} /><circle cx={l.x2} cy={l.y2} r={5} fill={colorLinea(l)} /></g>)}
                </svg>
                {ej.items.map((it, r) => {
                    const j = ej.der[r]; const usado = Object.values(pares).includes(j);
                    return (
                        <React.Fragment key={ej.key + '-' + r}>
                            <div ref={el => (izq.current[r] = el)} onClick={() => clickIzq(r)}
                                style={{ ...caja(sel === r, chk ? (chk[r] ? '#2ecc71' : '#e74c3c') : (pares[r] !== undefined ? '#f39c1288' : null)), fontSize: '0.88rem', color: '#e6edf3' }}>
                                {it.e}
                            </div>
                            <div ref={el => (der.current[r] = el)} onClick={() => clickDer(j)}
                                style={{ ...caja(false, usado ? '#f39c1288' : (sel !== null && !chk ? '#3498db88' : null)), ...MATH, fontSize: '1.05rem', color: '#f39c12', justifyContent: 'center' }}>
                                {ej.items[j].x}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
            {chk && chk.some(v => !v) && (
                <div style={{ ...CARD, padding: 14, background: '#0d1117', fontSize: '0.88rem', color: '#c9d1d9', lineHeight: 1.8 }}>
                    <b style={{ color: '#8b949e' }}>Soluciones de los que fallaste:</b>
                    {ej.items.map((it, i) => !chk[i] && <div key={i}>{it.e} → <span style={{ ...MATH, color: '#2ecc71' }}>{it.x}</span></div>)}
                    <div style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 4 }}>Fíjate en el orden: «el doble de un número más 3» es 2x + 3, pero «el doble de la suma de un número y 3» es 2·(x + 3).</div>
                </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {!chk
                    ? <button style={{ ...BTN('#f39c12', '#111'), opacity: completos ? 1 : 0.5 }} disabled={!completos} onClick={comprobar}>Comprobar</button>
                    : <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: chk.every(Boolean) ? '#2ecc71' : '#e67e22' }}>
                            {chk.every(Boolean) ? <CheckCircle size={18} /> : <XCircle size={18} />}{chk.filter(Boolean).length}/{chk.length} bien unidas
                        </span>
                        <button style={BTN('#3498db')} onClick={nuevo}><RefreshCw size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Nuevo ejercicio</button>
                    </>}
                <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>✅ {score.ok} / {score.total}</span>
            </div>
        </div>
    );
}
