// Calculadora Casio fx-82MS virtual (solo visual): pinta el teclado, resalta
// las teclas de una secuencia paso a paso y muestra la expresión en pantalla.
// No calcula: el resultado final lo aporta el reto (campo `pantalla`).
import React, { useEffect, useMemo, useRef, useState } from 'react';

// id → { main, shift (amarillo), alpha (rojo), disp (texto en pantalla), tipo }
export const TECLAS = {
    SHIFT: { main: 'SHIFT', tipo: 'mod' },
    ALPHA: { main: 'ALPHA', tipo: 'alpha' },
    MODE: { main: 'MODE', shift: 'CLR', tipo: 'mod' },
    ON: { main: 'ON', tipo: 'mod' },
    '↑': { main: '▲', tipo: 'pad' }, '↓': { main: '▼', tipo: 'pad' },
    '←': { main: '◀', tipo: 'pad' }, '→': { main: '▶', tipo: 'pad' },
    inv: { main: 'x⁻¹', shift: 'x!', disp: '⁻¹' },
    nCr: { main: 'nCr', shift: 'nPr', disp: 'C' },
    pol: { main: 'Pol(', shift: 'Rec(', disp: 'Pol(' },
    x3: { main: 'x³', shift: '∛', disp: '³', sdisp: '∛' },
    abc: { main: 'a b/c', shift: 'd/c', disp: '⌟' },
    sqrt: { main: '√', disp: '√' },
    x2: { main: 'x²', disp: '²' },
    pow: { main: '^', shift: 'ˣ√', disp: '^', sdisp: 'ˣ√' },
    log: { main: 'log', shift: '10ˣ', disp: 'log ', sdisp: '10^' },
    ln: { main: 'ln', shift: 'eˣ', disp: 'ln ', sdisp: 'e^' },
    neg: { main: '(−)', alpha: 'A', disp: '-' },
    dms: { main: '°′″', shift: '←', alpha: 'B', disp: '°' },
    hyp: { main: 'hyp', alpha: 'C', disp: 'hyp' },
    sin: { main: 'sin', shift: 'sin⁻¹', alpha: 'D', disp: 'sin ', sdisp: 'sin⁻¹ ' },
    cos: { main: 'cos', shift: 'cos⁻¹', alpha: 'E', disp: 'cos ', sdisp: 'cos⁻¹ ' },
    tan: { main: 'tan', shift: 'tan⁻¹', alpha: 'F', disp: 'tan ', sdisp: 'tan⁻¹ ' },
    rcl: { main: 'RCL', shift: 'STO' },
    eng: { main: 'ENG', shift: '←' },
    '(': { main: '(', disp: '(' },
    ')': { main: ')', alpha: 'X', disp: ')', adisp: 'X' },
    ',': { main: ',', shift: ';', alpha: 'Y', disp: ',', adisp: 'Y' },
    'M+': { main: 'M+', shift: 'M−', alpha: 'M', adisp: 'M' },
    DEL: { main: 'DEL', shift: 'INS', tipo: 'rojo' },
    AC: { main: 'AC', shift: 'OFF', tipo: 'rojo' },
    '×': { main: '×', disp: '×', tipo: 'num' }, '÷': { main: '÷', disp: '÷', tipo: 'num' },
    '+': { main: '+', disp: '+', tipo: 'num' }, '-': { main: '−', disp: '-', tipo: 'num' },
    '.': { main: '•', shift: 'Ran#', disp: '.', tipo: 'num' },
    exp: { main: 'EXP', shift: 'π', disp: 'E', sdisp: 'π', tipo: 'num' },
    Ans: { main: 'Ans', shift: 'DRG▸', disp: 'Ans', tipo: 'num' },
    '=': { main: '=', shift: '%', tipo: 'num' },
    ...Object.fromEntries('0123456789'.split('').map(d => [d, { main: d, disp: d, tipo: 'num', ...(d === '0' ? { shift: 'Rnd' } : {}) }])),
};

const FILAS_FUNC = [
    ['inv', 'nCr', null, null, 'pol', 'x3'],
    ['abc', 'sqrt', 'x2', 'pow', 'log', 'ln'],
    ['neg', 'dms', 'hyp', 'sin', 'cos', 'tan'],
    ['rcl', 'eng', '(', ')', ',', 'M+'],
];
const FILAS_NUM = [
    ['7', '8', '9', 'DEL', 'AC'],
    ['4', '5', '6', '×', '÷'],
    ['1', '2', '3', '+', '-'],
    ['0', '.', 'exp', 'Ans', '='],
];

const esNumero = (t) => /^-?\d*\.?\d+$/.test(t);

// Texto de una secuencia → pasos [[{ key, mod }...]] (un paso por «|»).
// mod = 'SHIFT' | 'ALPHA' | null. Los números se dejan como un token.
export function tokenizar(teclas = '') {
    return String(teclas).split('|').map(paso => {
        const out = [];
        let mod = null;
        for (const t of paso.trim().split(/\s+/).filter(Boolean)) {
            if (t === 'SHIFT' || t === 'ALPHA') { mod = t; continue; }
            out.push({ key: t, mod });
            mod = null;
        }
        return out;
    }).filter(p => p.length);
}

// Etiqueta de un token tal y como se ve en el chip
export function etiquetaTecla({ key, mod }) {
    if (esNumero(key)) return key;
    const k = TECLAS[key];
    if (!k) return key;
    if (mod === 'SHIFT') return k.shift || k.main;
    if (mod === 'ALPHA') return k.alpha || k.main;
    return k.main;
}

const COL = {
    shift: '#e8b923', alpha: '#e0457b',
};

// Chips con la secuencia de teclas (un renglón por paso)
export function ChipsTeclas({ teclas, activo = -1, compacto = false }) {
    const pasos = useMemo(() => tokenizar(teclas), [teclas]);
    let idx = -1;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compacto ? 4 : 6 }}>
            {pasos.map((paso, pi) => (
                <div key={pi} style={{ display: 'flex', flexWrap: 'wrap', gap: compacto ? 3 : 5, alignItems: 'center' }}>
                    {pasos.length > 1 && <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', minWidth: 18 }}>{pi + 1}.</span>}
                    {paso.map((tk, i) => {
                        idx++;
                        const on = idx === activo;
                        const num = esNumero(tk.key);
                        return (
                            <span key={i} style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                                {tk.mod && (
                                    <span style={{ ...chip(compacto), background: tk.mod === 'SHIFT' ? COL.shift : COL.alpha, color: tk.mod === 'SHIFT' ? '#1f2937' : '#fff', outline: on ? '3px solid #22c55e' : 'none' }}>
                                        {tk.mod}
                                    </span>
                                )}
                                <span style={{
                                    ...chip(compacto),
                                    background: num ? '#f1f5f9' : '#334155',
                                    color: num ? '#0f172a' : (tk.mod === 'SHIFT' ? COL.shift : tk.mod === 'ALPHA' ? '#fda4af' : '#fff'),
                                    border: num ? '1px solid #cbd5e1' : '1px solid #1e293b',
                                    outline: on ? '3px solid #22c55e' : 'none',
                                }}>
                                    {etiquetaTecla(tk)}
                                </span>
                            </span>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

const chip = (c) => ({
    display: 'inline-block', padding: c ? '2px 6px' : '4px 9px', borderRadius: 6,
    fontWeight: 800, fontSize: c ? 12 : 14, fontFamily: 'system-ui, sans-serif', lineHeight: 1.3,
});

// Expande la secuencia en pulsaciones individuales para la animación.
// Cada pulsación: { teclas: [ids resaltados], disp: texto que añade, reset, tokenIdx }
function pulsaciones(teclas) {
    const out = [];
    let tokenIdx = -1;
    tokenizar(teclas).forEach((paso, pi) => {
        if (pi > 0) out.push({ teclas: [], reset: true, tokenIdx });
        let trasMemoria = false; // tras STO/RCL la tecla siguiente solo elige la variable
        let trasIgual = false;   // tras = las conversiones (a b/c, °′″…) no escriben
        paso.forEach(tk => {
            tokenIdx++;
            if (esNumero(tk.key)) {
                for (const ch of tk.key) out.push({ teclas: [ch === '-' ? 'neg' : ch], disp: ch, tokenIdx });
                return;
            }
            const k = TECLAS[tk.key] || {};
            let disp = k.disp || '';
            if (tk.mod === 'SHIFT') disp = k.sdisp || '';
            if (tk.mod === 'ALPHA') disp = k.adisp || k.alpha || '';
            const eraMemoria = trasMemoria; // 'RCL' | 'STO' | false
            if (eraMemoria || trasIgual) disp = '';
            if (eraMemoria === 'RCL') disp = k.alpha || ''; // RCL M → muestra «M»
            trasMemoria = tk.key === 'rcl' ? (tk.mod === 'SHIFT' ? 'STO' : 'RCL') : false;
            if (tk.key === '=' || eraMemoria === 'STO' || (tk.key === 'M+' && !eraMemoria)) trasIgual = true;
            if (tk.mod) out.push({ teclas: [tk.mod], disp: '', tokenIdx });
            out.push({ teclas: [tk.key], disp, tokenIdx, igual: tk.key === '=' });
        });
    });
    return out;
}

export function useAnimacionTeclas(teclas) {
    const lista = useMemo(() => pulsaciones(teclas), [teclas]);
    const [i, setI] = useState(-1);
    const [play, setPlay] = useState(false);
    const t = useRef(null);
    useEffect(() => { setI(-1); setPlay(false); }, [teclas]);
    useEffect(() => {
        if (!play) return undefined;
        if (i >= lista.length - 1) { setPlay(false); return undefined; }
        t.current = setTimeout(() => setI(x => x + 1), i < 0 ? 200 : 650);
        return () => clearTimeout(t.current);
    }, [play, i, lista.length]);
    const actual = i >= 0 ? lista[i] : null;
    // texto acumulado del paso actual
    let linea = '';
    let shiftOn = false;
    for (let j = 0; j <= i; j++) {
        const p = lista[j];
        if (p.reset) { linea = ''; continue; }
        linea += p.disp || '';
    }
    if (actual && (actual.teclas[0] === 'SHIFT' || actual.teclas[0] === 'ALPHA')) shiftOn = actual.teclas[0];
    return {
        reproducir: () => { setI(-1); setPlay(true); },
        parar: () => setPlay(false),
        siguiente: () => setI(x => Math.min(lista.length - 1, x + 1)),
        reiniciar: () => { setPlay(false); setI(-1); },
        resaltadas: actual ? actual.teclas : [],
        tokenActivo: actual ? actual.tokenIdx : -1,
        linea, shiftOn, terminado: i === lista.length - 1, reproduciendo: play,
        progreso: lista.length ? (i + 1) / lista.length : 0,
    };
}

function Tecla({ id, on, ancho }) {
    const k = TECLAS[id];
    if (!k) return <div />;
    const base = k.tipo === 'num' ? '#a9adb5' : k.tipo === 'rojo' ? '#e4483f' : k.tipo === 'mod' || k.tipo === 'alpha' ? '#3a3f4b' : '#23262e';
    const color = k.tipo === 'num' ? '#111' : '#fff';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
            <div style={{ height: 12, fontSize: 8.5, fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                {k.shift && <span style={{ color: COL.shift }}>{k.shift}</span>}
                {k.alpha && <span style={{ color: COL.alpha }}>{k.alpha}</span>}
            </div>
            <div style={{
                width: '100%', maxWidth: ancho, height: k.tipo === 'num' || k.tipo === 'rojo' ? 30 : 22,
                borderRadius: k.tipo === 'mod' || k.tipo === 'alpha' ? 11 : 6,
                background: on ? '#22c55e' : (id === 'SHIFT' ? '#3a3f4b' : base),
                color: on ? '#fff' : (id === 'SHIFT' ? COL.shift : id === 'ALPHA' ? COL.alpha : color),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: k.tipo === 'num' ? 14 : 10.5, fontWeight: 800,
                boxShadow: on ? '0 0 0 3px #bbf7d0, 0 0 14px #22c55e' : '0 2px 0 #0008',
                transform: on ? 'translateY(1px) scale(1.06)' : 'none',
                transition: 'all .12s',
            }}>{k.main}</div>
        </div>
    );
}

// Calculadora completa. `anim` = resultado de useAnimacionTeclas; `resultado` = texto final.
export default function Fx82MS({ anim, resultado, ancho = 260 }) {
    const on = new Set(anim?.resaltadas || []);
    const mostrarRes = anim?.terminado && resultado;
    return (
        <div style={{
            width: ancho, maxWidth: '100%', background: 'linear-gradient(180deg,#3b3f4a,#2a2d35)', borderRadius: 22,
            padding: '12px 12px 16px', boxShadow: '0 10px 30px #0005', boxSizing: 'border-box', userSelect: 'none',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: '#ddd', padding: '0 4px 4px' }}>
                <b style={{ letterSpacing: 1, fontSize: 14 }}>CASIO</b>
                <i style={{ fontSize: 10 }}>fx-82MS</i>
            </div>
            <div style={{ textAlign: 'center', color: '#e0457b', fontSize: 9, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>S-V.P.A.M.</div>
            {/* Pantalla */}
            <div style={{
                background: '#b9c7b0', borderRadius: 6, padding: '4px 8px', fontFamily: '"Courier New", monospace',
                color: '#1f2a1f', minHeight: 50, marginBottom: 10, border: '3px solid #555b66', boxSizing: 'border-box',
            }}>
                <div style={{ fontSize: 9, height: 11, display: 'flex', gap: 6, fontWeight: 700 }}>
                    {anim?.shiftOn === 'SHIFT' && <span>S</span>}
                    {anim?.shiftOn === 'ALPHA' && <span>A</span>}
                    <span style={{ marginLeft: 'auto' }}>D</span>
                </div>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', direction: 'rtl', textAlign: 'left', height: 17 }}>
                    <bdi>{anim?.linea || ' '}</bdi>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'right', height: 21, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {mostrarRes ? resultado : (anim?.linea ? '' : '0.')}
                </div>
            </div>
            {/* Fila SHIFT ALPHA · pad · MODE ON */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2.2fr 1fr 1fr', gap: 5, alignItems: 'center', marginBottom: 2 }}>
                <Tecla id="SHIFT" on={on.has('SHIFT')} />
                <Tecla id="ALPHA" on={on.has('ALPHA')} />
                <div style={{ gridRow: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 14px)', background: '#c9ccd1', borderRadius: '50%', width: 62, height: 46, margin: '0 auto', padding: 2, fontSize: 9, color: '#333' }}>
                    <span /> <span style={{ textAlign: 'center', color: on.has('↑') ? '#16a34a' : '#333' }}>▲</span> <span />
                    <span style={{ textAlign: 'center', color: on.has('←') ? '#16a34a' : '#333' }}>◀</span>
                    <span style={{ textAlign: 'center', fontSize: 7 }}>REPLAY</span>
                    <span style={{ textAlign: 'center', color: on.has('→') ? '#16a34a' : '#333' }}>▶</span>
                    <span /> <span style={{ textAlign: 'center', color: on.has('↓') ? '#16a34a' : '#333' }}>▼</span> <span />
                </div>
                <Tecla id="MODE" on={on.has('MODE')} />
                <Tecla id="ON" on={on.has('ON')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2px 5px' }}>
                {FILAS_FUNC.flat().map((id, i) => id ? <Tecla key={i} id={id} on={on.has(id)} /> : <div key={i} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px 7px', marginTop: 8 }}>
                {FILAS_NUM.flat().map((id, i) => <Tecla key={i} id={id} on={on.has(id)} />)}
            </div>
        </div>
    );
}
