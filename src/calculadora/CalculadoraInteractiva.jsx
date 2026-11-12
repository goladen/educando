// ─────────────────────────────────────────────────────────────────────────────
//  Casio fx-82MS INTERACTIVA: mismo dibujo que «Uso de la calculadora»
//  (Fx82MS.jsx) pero calculando de verdad con motorCalculadora.js.
//  · default export CalculadoraInteractiva({ ancho, onResultado })
//  · CalculadoraFlotante({ onClose, onCopiar?, textoCopiar?, onRetos? }): ventana
//    flotante y arrastrable para usarla como ayuda dentro de cualquier app.
//  Teclado físico: cifras, + − * / ^ ( ) . , Intro/=, Retroceso, Supr/Esc.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Fx82MS from './Fx82MS';
import { evaluar, formatearDecimal, formatearFraccion, formatearSexagesimal, marcasSexagesimales } from './motorCalculadora';

// Tecla → token (sin modificador, con SHIFT y con ALPHA)
const NORMAL = {
    '+': '+', '-': '-', '×': '×', '÷': '÷', '(': '(', ')': ')', ',': ',', '.': '.', exp: 'E', Ans: 'Ans',
    sqrt: '√', x2: '²', x3: '³', inv: '⁻¹', pow: '^', log: 'log', ln: 'ln', neg: 'neg', dms: '°',
    sin: 'sin', cos: 'cos', tan: 'tan', abc: '⌟', nCr: 'nCr', pol: 'Pol(',
    ...Object.fromEntries('0123456789'.split('').map((d) => [d, d])),
};
const SHIFTED = {
    x3: '∛', inv: '!', pow: 'ˣ√', log: '10^', ln: 'e^', sin: 'asin', cos: 'acos', tan: 'atan',
    nCr: 'nPr', pol: 'Rec(', exp: 'π', '.': 'Ran#', '=': '%', ',': ',',
};
const ALPHA = { neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F', ')': 'X', ',': 'Y', 'M+': 'M' };
const DISP = {
    neg: '−', '-': '−', nCr: 'C', nPr: 'P', sin: 'sin ', cos: 'cos ', tan: 'tan ', asin: 'sin⁻¹ ', acos: 'cos⁻¹ ', atan: 'tan⁻¹ ',
    sinh: 'sinh ', cosh: 'cosh ', tanh: 'tanh ', asinh: 'sinh⁻¹ ', acosh: 'cosh⁻¹ ', atanh: 'tanh⁻¹ ', log: 'log ', ln: 'ln ',
};
const OPERADORES = new Set(['+', '-', '×', '÷', '^', '²', '³', '⁻¹', '!', '%', 'nCr', 'nPr', 'ˣ√']);
const MODOS = ['D', 'R', 'G'];
const textoTokens = (tk) => marcasSexagesimales(tk.map((t) => DISP[t] ?? t).join(''));

function formatear(valor, formato) {
    if (formato === 'frac' || formato === 'imp') { const f = formatearFraccion(valor, formato === 'imp'); if (f) return f; }
    if (formato === 'sexa') return formatearSexagesimal(valor);
    return formatearDecimal(valor);
}

// ─── Máquina de teclas (pura): estado + tecla → estado nuevo ─────────────────
// La usan esta calculadora y la animación de los retos de «Uso de la calculadora».
export const estadoInicial = () => ({
    tokens: [], resultado: '0', valor: null, hecho: false, error: false,
    shift: false, alpha: false, hyp: false, sto: false, rcl: false,
    modo: 'D', ans: 0, vars: {}, historial: [], hIdx: -1, formato: 'dec',
});

export function aplicarTecla(s0, id) {
            let s = { ...s0 };
            const shift = s.shift, alpha = s.alpha;
            s.shift = false; s.alpha = false;
            const mostrar = (valor, formato = 'dec') => { s.valor = valor; s.formato = formato; s.resultado = formatear(valor, formato); };
            const calcular = (tokens) => {
                try {
                    const r = evaluar(tokens, { modo: s.modo, ans: s.ans, vars: s.vars, ansFrac: s.ansFrac });
                    // En sexagesimal solo si se suman o restan cantidades en °′″ (150 ÷ 1°40′ = 90. sale en decimal)
                    const soloSumas = tokens.every((t) => /^[0-9.°+()-]$/.test(t) || t === 'neg' || t === 'Ans');
                    const formato = r.conGrados && soloSumas ? 'sexa' : r.conFraccion && formatearFraccion(r.valor) ? 'frac' : 'dec';
                    s.ans = r.valor; s.ansFrac = formato === 'frac'; s.hecho = true; s.error = false;
                    mostrar(r.valor, formato);
                    if (tokens.length) s.historial = [...s.historial.slice(-19), tokens];
                    s.hIdx = -1;
                    return r.valor;
                } catch (e) {
                    s.error = true; s.hecho = false;
                    s.resultado = e.tipo === 'Math' ? 'Math ERROR' : 'Syntax ERROR';
                    return null;
                }
            };
            const insertar = (tok) => {
                if (s.error) { s.error = false; s.resultado = ''; }
                if (s.hecho) {
                    s.tokens = OPERADORES.has(tok) ? ['Ans', tok] : [tok];
                    s.hecho = false; s.resultado = '';
                } else s.tokens = [...s.tokens, tok];
            };

            // Modificadores y teclas de control
            if (id === 'SHIFT') { s.shift = !shift; return s; }
            if (id === 'ALPHA') { s.alpha = !alpha; return s; }
            if (id === 'ON' || (id === 'AC')) {
                return { ...s, tokens: [], resultado: '0', hecho: false, error: false, hyp: false, sto: false, rcl: false, formato: 'dec', valor: null };
            }
            if (id === 'MODE') {
                if (shift) return { ...s, vars: {}, ans: 0, tokens: [], resultado: '0', hecho: false, error: false }; // CLR
                return { ...s, modo: MODOS[(MODOS.indexOf(s.modo) + 1) % MODOS.length] };
            }
            if (id === 'DEL') {
                if (s.error) { s.error = false; s.resultado = ''; return s; }
                s.tokens = s.tokens.slice(0, -1); s.hecho = false; s.resultado = '';
                return s;
            }
            if (id === '↑' || id === '↓') {
                const h = s.historial;
                if (!h.length) return s;
                let k = s.hIdx === -1 ? h.length : s.hIdx;
                k = id === '↑' ? Math.max(0, k - 1) : Math.min(h.length - 1, k + 1);
                return { ...s, hIdx: k, tokens: h[k], hecho: false, error: false, resultado: '' };
            }
            if (id === '←' || id === '→' || id === 'eng') return s;
            if (id === 'hyp') { s.hyp = true; return s; }
            if (id === 'rcl') { if (shift) s.sto = true; else s.rcl = true; return s; }

            // STO / RCL esperan la letra (sin pulsar ALPHA)
            if ((s.sto || s.rcl) && ALPHA[id]) {
                const v = ALPHA[id];
                if (s.sto) {
                    const valor = s.hecho && s.valor !== null ? s.valor : calcular(s.tokens);
                    if (valor !== null) { s.vars = { ...s.vars, [v]: valor }; mostrar(valor, s.formato); s.hecho = true; }
                } else {
                    const valor = s.vars[v] ?? 0;
                    s.tokens = [v]; s.hecho = true; s.error = false; s.ans = valor; mostrar(valor);
                }
                s.sto = false; s.rcl = false;
                return s;
            }
            s.sto = false; s.rcl = false;

            if (alpha && ALPHA[id]) { insertar(ALPHA[id]); return s; }

            if (id === 'M+') {
                const valor = s.hecho && s.valor !== null ? s.valor : calcular(s.tokens);
                if (valor !== null) {
                    s.vars = { ...s.vars, M: (s.vars.M || 0) + (shift ? -valor : valor) };
                    s.hecho = true; mostrar(valor, s.formato);
                }
                return s;
            }
            if (id === '=' && !shift) {
                calcular(s.tokens.length ? s.tokens : s.hecho ? (s.historial[s.historial.length - 1] || []) : []);
                return s;
            }
            // Cambios de formato del resultado (a b/c, d/c, °′″)
            if (s.hecho && s.valor !== null && (id === 'abc' || id === 'dms')) {
                if (id === 'abc') {
                    const objetivo = shift ? 'imp' : (s.formato === 'frac' || s.formato === 'imp' ? 'dec' : 'frac');
                    if (objetivo === 'dec' || formatearFraccion(s.valor, objetivo === 'imp')) mostrar(s.valor, objetivo);
                } else mostrar(s.valor, shift || s.formato === 'sexa' ? 'dec' : 'sexa');
                return s;
            }
            let tok = shift && SHIFTED[id] ? SHIFTED[id] : NORMAL[id];
            if (!tok) return s;
            if (s.hyp && ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'].includes(tok)) tok = tok.startsWith('a') ? `a${tok.slice(1)}h` : `${tok}h`;
            s.hyp = false;
            insertar(tok);
            return s;
}

// Lo que se ve en la pantalla de la Fx82MS para un estado
export const pantallaDe = (st) => {
    const linea = textoTokens(st.tokens);
    return {
        linea, resultado: st.error ? st.resultado : (st.hecho ? st.resultado : (linea ? '' : '0.')),
        shift: st.shift, alpha: st.alpha, modo: st.modo, sto: st.sto, rcl: st.rcl, hyp: st.hyp, m: !!st.vars.M,
    };
};

export default function CalculadoraInteractiva({ ancho = 270, onResultado, activa = true }) {
    const [st, setSt] = useState(estadoInicial);
    const pulsar = useCallback((id) => setSt((s0) => aplicarTecla(s0, id)), []);

    // Avisar del resultado (p. ej. para copiarlo)
    useEffect(() => { if (st.hecho && st.valor !== null) onResultado?.(st.valor, st.resultado); }, [st.hecho, st.valor, st.resultado, onResultado]);

    useTecladoFisico(pulsar, activa);
    return <Fx82MS ancho={ancho} onTecla={pulsar} pantalla={pantallaDe(st)} />;
}

// Teclado físico → teclas de la calculadora (no actúa si se escribe en un campo de texto)
export function useTecladoFisico(pulsar, activa = true) {
    useEffect(() => {
        if (!activa) return undefined;
        const MAPA = { '+': '+', '-': '-', '*': '×', x: '×', '/': '÷', ':': '÷', '^': 'pow', '(': '(', ')': ')', '.': '.', ',': '.', Enter: '=', '=': '=', Backspace: 'DEL', Delete: 'AC', Escape: 'AC', ArrowUp: '↑', ArrowDown: '↓' };
        const h = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const id = /^[0-9]$/.test(e.key) ? e.key : MAPA[e.key];
            if (!id) return;
            e.preventDefault();
            pulsar(id);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [activa, pulsar]);
}

// ─── Ventana flotante arrastrable ────────────────────────────────────────────
export function CalculadoraFlotante({ onClose, onCopiar, textoCopiar = '📋 Copiar', onRetos, inicial }) {
    const ancho = 270;
    const [pos, setPos] = useState(() => inicial || {
        x: Math.max(8, (typeof window !== 'undefined' ? window.innerWidth : 800) - ancho - 40),
        y: 70,
    });
    const [ultimo, setUltimo] = useState(null);
    const [aviso, setAviso] = useState('');
    const drag = useRef(null);
    const onDown = (e) => {
        if (e.target.closest('button')) return;
        drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
        if (!drag.current) return;
        const W = window.innerWidth, H = window.innerHeight;
        setPos({ x: Math.min(W - 80, Math.max(-ancho + 80, e.clientX - drag.current.dx)), y: Math.min(H - 40, Math.max(0, e.clientY - drag.current.dy)) });
    };
    const onUp = () => { drag.current = null; };
    const onResultado = useCallback((valor, texto) => setUltimo({ valor, texto }), []);
    const copiar = async () => {
        if (!ultimo) return;
        const txt = String(ultimo.texto).replace(/⌟/g, '/').replace(/\.$/, '');
        if (onCopiar) { onCopiar(txt, ultimo.valor); return; }
        try { await navigator.clipboard.writeText(txt.replace('.', ',')); setAviso('¡Copiado!'); } catch { setAviso('No se pudo copiar'); }
        setTimeout(() => setAviso(''), 1200);
    };
    const btn = { background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };
    return (
        <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 100002, width: ancho, touchAction: 'none' }}>
            <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1f2229', color: 'white', borderRadius: '14px 14px 0 0', padding: '6px 8px', cursor: 'move', userSelect: 'none', fontSize: '0.78rem', boxShadow: '0 -2px 10px #0003' }}>
                <span style={{ fontWeight: 800, flex: 1 }}>⠿ Calculadora</span>
                {aviso && <span style={{ color: '#22c55e' }}>{aviso}</span>}
                {ultimo && <button onClick={copiar} style={btn} title="Copiar el último resultado">{textoCopiar}</button>}
                {onRetos && <button onClick={onRetos} style={btn} title="Aprende a usar la calculadora con retos">📘 Retos</button>}
                <button onClick={onClose} style={{ ...btn, background: '#e4483f' }} title="Cerrar">✕</button>
            </div>
            <CalculadoraInteractiva ancho={ancho} onResultado={onResultado} />
        </div>
    );
}
