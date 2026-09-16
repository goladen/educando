import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoPasar, sonidoFinal, sonidoActivo, setSonidoActivo, despertarAudio } from './utils/sonidosFeedback';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { RotateCcw, CheckCircle, Trophy, Clock, Delete, Settings, SkipForward, Share2, PieChart, Volume2, VolumeX } from 'lucide-react';
import Confetti from 'react-confetti';
import { CompeticionCuerda } from './components/TironCuerdaEscena';

// ─────────────────────────────────────────────────────────────────────────────
//  FRACCIONES — Laboratorio visual + base de ejercicios + tirón de cuerda
//  Misma UX que Cálculo Mental (src/CalculoMental.jsx): botonera grande,
//  Comprobar / Pasar, marcador, envío al profesor y registro local.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers de fracciones ───────────────────────────────────────────────────
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(Math.abs(b), Math.abs(a) % Math.abs(b)));
const lcm = (a, b) => Math.abs(a * b) / (gcd(a, b) || 1);
const simplificar = (n, d) => {
    if (d === 0) return [n, 1];
    let sn = n, sd = d;
    if (sd < 0) { sn = -sn; sd = -sd; }
    const g = gcd(sn, sd) || 1;
    return [sn / g, sd / g];
};
const esIrreducible = (n, d) => (gcd(n, d) || 1) === 1;
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mezclar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};
const valor = ([n, d]) => (d === 0 ? 0 : n / d);

const opera = (a, b, op, extra = 2) => {
    const [an, ad] = a, [bn, bd] = b;
    switch (op) {
        case 'suma':  return simplificar(an * bd + bn * ad, ad * bd);
        case 'resta': return simplificar(an * bd - bn * ad, ad * bd);
        case 'mult':  return simplificar(an * bn, ad * bd);
        case 'div':   return bn === 0 ? [0, 1] : simplificar(an * bd, ad * bn);
        case 'pot':   return simplificar(Math.round(Math.pow(an, extra)), Math.round(Math.pow(ad, extra)));
        case 'raiz':  return simplificar(Math.round(Math.sqrt(an)), Math.round(Math.sqrt(ad)));
        default:      return simplificar(an, ad);
    }
};

const SIGNO_OP = { suma: '+', resta: '−', mult: '×', div: '÷' };
const COLORES = { A: '#7b1fa2', B: '#00897b', RES: '#E91E63' };

// ─── Presentación de una fracción (n sobre d) ────────────────────────────────
export const FracTexto = ({ n, d, size = '1.6rem', color = '#2c3e50' }) => {
    if (d === 1) return <span style={{ fontSize: size, fontWeight: 800, color }}>{n}</span>;
    const neg = n < 0;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
            {neg && <span style={{ fontSize: size, fontWeight: 800, color }}>−</span>}
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05, fontWeight: 800, color, fontSize: `calc(${size} * 0.8)` }}>
                <span>{Math.abs(n)}</span>
                <span style={{ width: '100%', minWidth: 20, height: 2.5, background: color, borderRadius: 2, margin: '3px 0' }} />
                <span>{d}</span>
            </span>
        </span>
    );
};

// ─── Líneas de división superpuestas ─────────────────────────────────────────
// Se pintan ENCIMA del color con halo blanco para que se vean siempre, tanto
// sobre la parte coloreada como sobre la parte vacía.
const LineasDivision = ({ partes, orient = 'v', dashed = false, grosor = 2, opacidad = 1 }) => {
    const n = Math.max(1, partes);
    if (n < 2 || n > 80) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
            {Array.from({ length: n - 1 }).map((_, i) => {
                const p = ((i + 1) / n) * 100;
                const comun = {
                    position: 'absolute',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
                    opacity: opacidad,
                };
                if (orient === 'v') {
                    return <div key={i} style={{
                        ...comun, left: `${p}%`, top: 0, bottom: 0, width: dashed ? 0 : grosor, marginLeft: -grosor / 2,
                        background: dashed ? 'transparent' : '#2c3e50',
                        borderLeft: dashed ? `${grosor}px dashed #2c3e50` : 'none',
                    }} />;
                }
                return <div key={i} style={{
                    ...comun, top: `${p}%`, left: 0, right: 0, height: dashed ? 0 : grosor, marginTop: -grosor / 2,
                    background: dashed ? 'transparent' : '#2c3e50',
                    borderTop: dashed ? `${grosor}px dashed #2c3e50` : 'none',
                }} />;
            })}
        </div>
    );
};

// ─── Barra visual de una fracción (rectángulos divididos) ────────────────────
// orient: 'v' → cortes verticales (columnas) · 'h' → cortes horizontales (filas)
export const BarraFraccion = ({ n, d, color = COLORES.A, alto = 46, subdiv = 1, etiqueta = null, maxUnidades = 4, orient = 'v', guias = null }) => {
    const den = Math.max(1, d);
    const num = Math.max(0, n);
    const unidades = Math.min(maxUnidades, Math.max(1, Math.ceil(num / den) || 1));
    let restantes = num;
    return (
        <div style={{ width: '100%' }}>
            {etiqueta && <div style={{ fontSize: '0.72rem', color: '#8e8e8e', fontWeight: 700, marginBottom: 4 }}>{etiqueta}</div>}
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                {Array.from({ length: unidades }).map((_, u) => {
                    const llenas = Math.min(den, Math.max(0, restantes));
                    restantes -= llenas;
                    const pct = `${(llenas / den) * 100}%`;
                    return (
                        <div key={u} style={{ position: 'relative', flex: 1, height: alto, border: `2.5px solid ${color}`, borderRadius: 8, overflow: 'hidden', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.07)' }}>
                            <div style={{
                                position: 'absolute', left: 0, top: 0,
                                width: orient === 'v' ? pct : '100%',
                                height: orient === 'v' ? '100%' : pct,
                                background: color, transition: 'width 0.25s, height 0.25s', zIndex: 1,
                            }} />
                            {subdiv > 1 && <LineasDivision partes={den * subdiv} orient={orient} dashed grosor={2} opacidad={0.75} />}
                            {guias && <LineasDivision partes={guias.partes} orient={guias.orient || (orient === 'v' ? 'h' : 'v')} dashed grosor={2} opacidad={0.5} />}
                            <LineasDivision partes={den} orient={orient} grosor={2} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Rejilla de producto (a/b × c/d) ─────────────────────────────────────────
const RejillaProducto = ({ a, b, alto = 130 }) => {
    const [an, ad] = a, [bn, bd] = b;
    const filas = Math.max(1, ad), cols = Math.max(1, bd);
    return (
        <div style={{ position: 'relative', height: alto, width: '100%', border: '2.5px solid #2c3e50', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${filas}, 1fr)`, zIndex: 1 }}>
                {Array.from({ length: filas * cols }).map((_, idx) => {
                    const f = Math.floor(idx / cols), c = idx % cols;
                    const enA = f < an, enB = c < bn;
                    const bg = enA && enB ? COLORES.RES : enA ? `${COLORES.A}55` : enB ? `${COLORES.B}55` : 'white';
                    return <div key={idx} style={{ background: bg, transition: 'background 0.25s' }} />;
                })}
            </div>
            <LineasDivision partes={filas} orient="h" />
            <LineasDivision partes={cols} orient="v" />
        </div>
    );
};

// ─── Cuadrado para la raíz cuadrada ──────────────────────────────────────────
const CuadradoRaiz = ({ n, d, lado = 140 }) => {
    const rn = Math.sqrt(n), rd = Math.sqrt(d);
    if (!Number.isInteger(rn) || !Number.isInteger(rd) || rd === 0) return null;
    return (
        <div style={{ position: 'relative', width: lado, height: lado, border: '2.5px solid #2c3e50', borderRadius: 10, overflow: 'hidden', background: 'white', margin: '0 auto' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${rd}, 1fr)`, gridTemplateRows: `repeat(${rd}, 1fr)`, zIndex: 1 }}>
                {Array.from({ length: rd * rd }).map((_, idx) => {
                    const f = Math.floor(idx / rd), c = idx % rd;
                    return <div key={idx} style={{ background: (f < rn && c < rn) ? COLORES.RES : 'white' }} />;
                })}
            </div>
            <LineasDivision partes={rd} orient="h" />
            <LineasDivision partes={rd} orient="v" />
        </div>
    );
};

// ─── Modelo de área para sumas y restas ──────────────────────────────────────
// Un mismo rectángulo cortado en horizontal (fracción A) y en vertical (fracción
// B): así se ve que los dos comparten el mismo trocito, 1/(dA·dB).
const RejillaComun = ({ a, b, op = 'suma', alto = 170, mostrarResultado = true, isMobile = false }) => {
    const [an, ad] = a, [bn, bd] = b;
    const filas = Math.max(1, ad), cols = Math.max(1, bd);
    const total = filas * cols;
    if (total > 300) return null;

    const celdasA = an * bd;                     // A ocupa filas enteras
    const celdasB = bn * ad;                     // B ocupa columnas enteras
    const pintadasSuma = Math.min(total, celdasA + celdasB);
    const quitadas = op === 'resta' ? Math.min(celdasA, celdasB) : 0;

    // Rectángulo 1: A en filas + guías verticales de B (comparten el trocito)
    const Panel = ({ titulo, render }) => (
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: '#8e8e8e', fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>{titulo}</div>
            <div style={{ position: 'relative', height: alto, border: '2.5px solid #2c3e50', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
                {render}
                <LineasDivision partes={filas} orient="h" />
                <LineasDivision partes={cols} orient="v" />
            </div>
        </div>
    );

    const celdas = (colorDe) => (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${filas}, 1fr)`, zIndex: 1 }}>
            {Array.from({ length: total }).map((_, idx) => <div key={idx} style={{ background: colorDe(idx), transition: 'background 0.25s' }} />)}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
                <Panel titulo={`A = ${an}/${ad} → ${celdasA}/${total}`}
                    render={celdas(idx => (Math.floor(idx / cols) < an ? COLORES.A : 'white'))} />
                <Panel titulo={`B = ${bn}/${bd} → ${celdasB}/${total}`}
                    render={celdas(idx => ((idx % cols) < bn ? COLORES.B : 'white'))} />
            </div>

            {mostrarResultado && (
                <Panel titulo={op === 'suma'
                    ? `Juntamos: ${celdasA} + ${celdasB} = ${celdasA + celdasB} trocitos de ${total}`
                    : `Quitamos ${celdasB} trocitos a los ${celdasA} de A → ${celdasA - celdasB} de ${total}`}
                    render={celdas(idx => {
                        if (op === 'suma') {
                            if (idx < celdasA) return COLORES.A;
                            if (idx < pintadasSuma) return COLORES.B;
                            return 'white';
                        }
                        if (idx >= celdasA) return 'white';
                        if (idx >= celdasA - quitadas) return `${COLORES.B}44`; // trozos restados
                        return COLORES.A;
                    })} />
            )}

            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#7f8c8d', fontWeight: 700 }}>
                Cada trocito vale <b style={{ color: '#2c3e50' }}>1/{total}</b> — el mismo para las dos fracciones
            </div>
        </div>
    );
};

// ─── Barra de división: ¿cuántas veces cabe B en A? ──────────────────────────
const BarraDivision = ({ a, b, alto = 46 }) => {
    const [an, ad] = a, [bn, bd] = b;
    const comun = lcm(ad, bd);
    const partesA = an * (comun / ad);
    const partesB = Math.max(1, bn * (comun / bd));
    const total = Math.max(comun, partesA);
    const veces = partesA / partesB;
    if (total > 60) return null;
    return (
        <div style={{ width: '100%' }}>
            <div style={{ position: 'relative', height: alto, border: `2.5px solid ${COLORES.A}`, borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 1 }}>
                    {Array.from({ length: total }).map((_, i) => (
                        <div key={i} style={{ flex: 1, background: i < partesA ? (Math.floor(i / partesB) % 2 === 0 ? COLORES.A : COLORES.B) : 'transparent' }} />
                    ))}
                </div>
                <LineasDivision partes={total} orient="v" grosor={2} opacidad={0.55} />
                {/* separadores de bloque (cada vez que cabe B) más gruesos */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
                    {Array.from({ length: Math.floor(total / partesB) }).map((_, k) => {
                        const p = ((k + 1) * partesB / total) * 100;
                        if (p >= 100) return null;
                        return <div key={k} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 4, marginLeft: -2, background: '#2c3e50', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }} />;
                    })}
                </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#7f8c8d', marginTop: 6, fontWeight: 700 }}>
                La parte verde cabe <b style={{ color: COLORES.RES }}>{Number.isInteger(veces) ? veces : veces.toFixed(2)}</b> {veces === 1 ? 'vez' : 'veces'} en la morada
            </div>
        </div>
    );
};

// ─── Stepper numerador / denominador ─────────────────────────────────────────
const Stepper = ({ label, valor: v, onChange, color, min = 0, max = 24, disabled = false, isMobile = false, saltos = null }) => {
    const set = (nuevo) => !disabled && onChange(Math.max(min, Math.min(max, nuevo)));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.68rem', color: '#95a5a6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => set(v - 1)} disabled={disabled}
                    style={{ width: isMobile ? 40 : 46, height: isMobile ? 40 : 46, borderRadius: 12, border: 'none', background: disabled ? '#eee' : '#e74c3c', color: disabled ? '#bbb' : 'white', fontSize: '1.4rem', fontWeight: 900, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : '0 4px 0 rgba(0,0,0,0.18)', touchAction: 'manipulation' }}>−</button>
                <div style={{ minWidth: 48, textAlign: 'center', fontSize: isMobile ? '1.6rem' : '1.9rem', fontWeight: 900, color }}>{v}</div>
                <button onClick={() => set(v + 1)} disabled={disabled}
                    style={{ width: isMobile ? 40 : 46, height: isMobile ? 40 : 46, borderRadius: 12, border: 'none', background: disabled ? '#eee' : '#27ae60', color: disabled ? '#bbb' : 'white', fontSize: '1.4rem', fontWeight: 900, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : '0 4px 0 rgba(0,0,0,0.18)', touchAction: 'manipulation' }}>+</button>
            </div>
            {saltos && (
                <div style={{ display: 'flex', gap: 4 }}>
                    {saltos.map(s => (
                        <button key={s} onClick={() => set(v + s)} disabled={disabled}
                            style={{ padding: isMobile ? '5px 8px' : '6px 11px', borderRadius: 9, border: 'none', background: disabled ? '#eee' : (s > 0 ? '#27ae6022' : '#e74c3c22'), color: disabled ? '#bbb' : (s > 0 ? '#1e8449' : '#c0392b'), fontWeight: 800, fontSize: '0.78rem', cursor: disabled ? 'default' : 'pointer', touchAction: 'manipulation' }}>
                            {s > 0 ? `+${s}` : s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
//  1) LABORATORIO / TEORÍA
// ═════════════════════════════════════════════════════════════════════════════
const OPERACIONES_LAB = [
    { id: 'equiv', label: '≡ Equivalentes', color: '#3498db' },
    { id: 'suma',  label: '➕ Suma',        color: '#2ecc71' },
    { id: 'resta', label: '➖ Resta',        color: '#e74c3c' },
    { id: 'mult',  label: '✖️ Multiplicar',  color: '#f39c12' },
    { id: 'div',   label: '➗ Dividir',      color: '#9b59b6' },
    { id: 'pot',   label: 'xⁿ Potencia',     color: '#16a085' },
    { id: 'raiz',  label: '√ Raíz',          color: '#e67e22' },
];

function Laboratorio({ onSalir, isMobile }) {
    const [a, setA] = useState([1, 2]);
    const [b, setB] = useState([1, 3]);
    const [op, setOp] = useState('suma');
    const [exp, setExp] = useState(2);
    const [factor, setFactor] = useState(2);
    const [vista, setVista] = useState('combi'); // 'v' | 'h' | 'combi' (solo suma/resta)

    const usaB = ['suma', 'resta', 'mult', 'div'].includes(op);
    const [an, ad] = a, [bn, bd] = b;

    // Para la raíz exacta usamos cuadrados perfectos del numerador/denominador
    const raizExacta = Number.isInteger(Math.sqrt(an)) && Number.isInteger(Math.sqrt(ad));
    const resultado = op === 'equiv'
        ? [an * factor, ad * factor]
        : op === 'pot' ? opera(a, b, 'pot', exp)
        : op === 'raiz' ? (raizExacta ? opera(a, b, 'raiz') : null)
        : opera(a, b, op);

    const comun = usaB ? lcm(ad, bd) : ad;
    const opColor = OPERACIONES_LAB.find(o => o.id === op)?.color || COLORES.RES;

    const Tarjeta = ({ titulo, frac, setFrac, color }) => (
        <div style={{ flex: 1, minWidth: 0, background: 'white', border: `3px solid ${color}`, borderRadius: 18, padding: '14px 12px', boxShadow: '0 6px 16px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color }}>{titulo}</span>
                <FracTexto n={frac[0]} d={frac[1]} size={isMobile ? '1.9rem' : '2.2rem'} color={color} />
                <span style={{ fontSize: '0.85rem', color: '#95a5a6', fontWeight: 700 }}>= {(frac[0] / frac[1]).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>
            </div>
            <BarraFraccion n={frac[0]} d={frac[1]} color={color} alto={isMobile ? 40 : 50} />
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                <Stepper label="Numerador"   valor={frac[0]} color={color} isMobile={isMobile} min={0} max={24} onChange={v => setFrac([v, frac[1]])} />
                <Stepper label="Denominador" valor={frac[1]} color={color} isMobile={isMobile} min={1} max={16} onChange={v => setFrac([frac[0], v])} />
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth: 980, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row', marginBottom: 14 }}>
                <Tarjeta titulo="Fracción A" frac={a} setFrac={setA} color={COLORES.A} />
                {usaB && <Tarjeta titulo="Fracción B" frac={b} setFrac={setB} color={COLORES.B} />}
            </div>

            {/* Selector de operación */}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
                {OPERACIONES_LAB.map(o => (
                    <button key={o.id} onClick={() => setOp(o.id)}
                        style={{ padding: isMobile ? '9px 12px' : '10px 16px', borderRadius: 22, border: `2px solid ${o.color}`, background: op === o.id ? o.color : 'white', color: op === o.id ? 'white' : o.color, fontWeight: 800, fontSize: isMobile ? '0.82rem' : '0.92rem', cursor: 'pointer', boxShadow: op === o.id ? `0 4px 12px ${o.color}55` : 'none', touchAction: 'manipulation' }}>
                        {o.label}
                    </button>
                ))}
            </div>

            {/* Ajustes propios de la operación */}
            {op === 'pot' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#7f8c8d', fontSize: '0.85rem' }}>Exponente:</span>
                    {[2, 3, 4].map(e => (
                        <button key={e} onClick={() => setExp(e)} style={{ padding: '7px 16px', borderRadius: 20, border: '2px solid #16a085', background: exp === e ? '#16a085' : 'white', color: exp === e ? 'white' : '#16a085', fontWeight: 900, cursor: 'pointer' }}>{e}</button>
                    ))}
                </div>
            )}
            {op === 'equiv' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#7f8c8d', fontSize: '0.85rem' }}>Multiplicar arriba y abajo por:</span>
                    {[2, 3, 4, 5, 6].map(k => (
                        <button key={k} onClick={() => setFactor(k)} style={{ padding: '7px 16px', borderRadius: 20, border: '2px solid #3498db', background: factor === k ? '#3498db' : 'white', color: factor === k ? 'white' : '#3498db', fontWeight: 900, cursor: 'pointer' }}>×{k}</button>
                    ))}
                </div>
            )}
            {op === 'raiz' && !raizExacta && (
                <div style={{ textAlign: 'center', background: '#fff8e1', border: '2px solid #f39c12', borderRadius: 14, padding: '10px 14px', color: '#b9770f', fontWeight: 700, fontSize: '0.86rem', marginBottom: 14 }}>
                    ⚠️ La raíz solo es exacta si el numerador y el denominador son cuadrados perfectos (1, 4, 9, 16, 25…). Prueba por ejemplo con <b>4/9</b> o <b>9/16</b>.
                </div>
            )}

            {/* Resultado + explicación visual */}
            <div style={{ background: 'white', borderRadius: 20, padding: isMobile ? '16px 12px' : '22px 20px', boxShadow: '0 10px 28px rgba(0,0,0,0.09)', border: `3px solid ${opColor}33` }}>
                {/* Expresión */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                    {op === 'raiz' && <span style={{ fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 900, color: '#2c3e50' }}>√</span>}
                    <FracTexto n={an} d={ad} size={isMobile ? '1.9rem' : '2.3rem'} color={COLORES.A} />
                    {op === 'pot' && <span style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 900, color: '#16a085', alignSelf: 'flex-start' }}>{exp}</span>}
                    {op === 'equiv' && <span style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 900, color: '#3498db' }}>× {factor}/{factor}</span>}
                    {usaB && <><span style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 900, color: '#2c3e50' }}>{SIGNO_OP[op]}</span><FracTexto n={bn} d={bd} size={isMobile ? '1.9rem' : '2.3rem'} color={COLORES.B} /></>}
                    <span style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 900, color: '#2c3e50' }}>=</span>
                    {resultado
                        ? <FracTexto n={resultado[0]} d={resultado[1]} size={isMobile ? '2.1rem' : '2.6rem'} color={COLORES.RES} />
                        : <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#95a5a6' }}>no exacta</span>}
                    {resultado && <span style={{ fontSize: '0.9rem', color: '#95a5a6', fontWeight: 700 }}>= {(resultado[0] / resultado[1]).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>}
                </div>

                {/* Explicación visual por operación */}
                {op === 'equiv' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <BarraFraccion n={an} d={ad} color={COLORES.A} alto={isMobile ? 42 : 52} etiqueta={`Original: ${an}/${ad}`} />
                        <BarraFraccion n={an} d={ad} color={COLORES.A} subdiv={factor} alto={isMobile ? 42 : 52} etiqueta={`Partimos cada trozo en ${factor} → mismas partes pintadas`} />
                        <BarraFraccion n={an * factor} d={ad * factor} color={COLORES.RES} alto={isMobile ? 42 : 52} etiqueta={`Equivalente: ${an * factor}/${ad * factor} — ¡la parte pintada es la misma!`} />
                    </div>
                )}

                {(op === 'suma' || op === 'resta') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Selector de orientación de las divisiones */}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {[
                                { id: 'v', label: '⬍ Cortes verticales' },
                                { id: 'h', label: '⬌ Cortes horizontales' },
                                { id: 'combi', label: '✚ Combinadas (mismo trozo)' },
                            ].map(o => (
                                <button key={o.id} onClick={() => setVista(o.id)}
                                    style={{ padding: '7px 13px', borderRadius: 20, border: '2px solid #2c3e50', background: vista === o.id ? '#2c3e50' : 'white', color: vista === o.id ? 'white' : '#2c3e50', fontWeight: 800, fontSize: isMobile ? '0.75rem' : '0.82rem', cursor: 'pointer', touchAction: 'manipulation' }}>
                                    {o.label}
                                </button>
                            ))}
                        </div>

                        {vista === 'combi' ? (
                            <RejillaComun a={a} b={b} op={op} alto={isMobile ? 130 : 165} isMobile={isMobile} />
                        ) : (
                            <>
                                <BarraFraccion n={an} d={ad} color={COLORES.A} orient={vista} alto={vista === 'h' ? (isMobile ? 110 : 130) : (isMobile ? 40 : 48)} etiqueta={`A = ${an}/${ad}`} />
                                <BarraFraccion n={bn} d={bd} color={COLORES.B} orient={vista} alto={vista === 'h' ? (isMobile ? 110 : 130) : (isMobile ? 40 : 48)} etiqueta={`B = ${bn}/${bd}`} />
                                <div style={{ background: '#f8f9fa', borderRadius: 12, padding: '10px 12px', border: '2px dashed #cfd8dc' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#7f8c8d', fontWeight: 800, marginBottom: 8 }}>
                                        Mismo denominador ({comun}): {an * (comun / ad)}/{comun} {SIGNO_OP[op]} {bn * (comun / bd)}/{comun}
                                    </div>
                                    <BarraFraccion n={an * (comun / ad)} d={comun} color={COLORES.A} orient={vista} alto={vista === 'h' ? (isMobile ? 100 : 120) : (isMobile ? 34 : 40)} />
                                    <div style={{ height: 8 }} />
                                    <BarraFraccion n={bn * (comun / bd)} d={comun} color={COLORES.B} orient={vista} alto={vista === 'h' ? (isMobile ? 100 : 120) : (isMobile ? 34 : 40)} />
                                </div>
                                {resultado[0] >= 0 && (
                                    <BarraFraccion n={resultado[0]} d={resultado[1]} color={COLORES.RES} orient={vista} alto={vista === 'h' ? (isMobile ? 110 : 130) : (isMobile ? 42 : 52)} etiqueta={`Resultado: ${resultado[0]}/${resultado[1]}`} />
                                )}
                            </>
                        )}
                    </div>
                )}

                {op === 'mult' && (
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>
                            Rejilla: {ad} filas × {bd} columnas. Lo pintado de los dos colores es el producto.
                        </div>
                        <RejillaProducto a={a} b={b} alto={isMobile ? 120 : 160} />
                        <div style={{ textAlign: 'center', marginTop: 10, fontWeight: 800, color: COLORES.RES }}>
                            {an}×{bn} = {an * bn} partes de {ad}×{bd} = {ad * bd}
                        </div>
                    </div>
                )}

                {op === 'div' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', fontWeight: 800, textAlign: 'center' }}>
                            Dividir es multiplicar por la inversa: {an}/{ad} × {bd}/{bn}
                        </div>
                        <BarraDivision a={a} b={b} alto={isMobile ? 40 : 48} />
                        <BarraFraccion n={resultado[0]} d={resultado[1]} color={COLORES.RES} alto={isMobile ? 42 : 52} etiqueta={`Resultado: ${resultado[0]}/${resultado[1]}`} />
                    </div>
                )}

                {op === 'pot' && (
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', fontWeight: 800, marginBottom: 10, textAlign: 'center' }}>
                            Elevar una fracción = multiplicarla por sí misma {exp} veces: numerador y denominador se elevan por separado.
                        </div>
                        {exp === 2 && ad <= 10 ? (
                            <RejillaProducto a={a} b={a} alto={isMobile ? 130 : 170} />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {Array.from({ length: Math.min(exp, 4) }).map((_, i) => (
                                    <BarraFraccion key={i} n={an} d={ad} color={COLORES.A} alto={isMobile ? 26 : 32} />
                                ))}
                            </div>
                        )}
                        <div style={{ textAlign: 'center', marginTop: 10, fontWeight: 800, color: COLORES.RES }}>
                            {an}<sup>{exp}</sup>/{ad}<sup>{exp}</sup> = {Math.pow(an, exp)}/{Math.pow(ad, exp)}
                        </div>
                    </div>
                )}

                {op === 'raiz' && raizExacta && (
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', fontWeight: 800, marginBottom: 10, textAlign: 'center' }}>
                            El cuadrado tiene {ad} casillas ({Math.sqrt(ad)}×{Math.sqrt(ad)}) y hay {an} pintadas ({Math.sqrt(an)}×{Math.sqrt(an)}). El <b>lado</b> pintado es la raíz.
                        </div>
                        <CuadradoRaiz n={an} d={ad} lado={isMobile ? 130 : 170} />
                        <div style={{ textAlign: 'center', marginTop: 10, fontWeight: 800, color: COLORES.RES }}>
                            √({an}/{ad}) = {Math.sqrt(an)}/{Math.sqrt(ad)}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={onSalir} style={{ padding: '11px 24px', borderRadius: 30, border: '2px solid #bdc3c7', background: 'white', color: '#7f8c8d', fontWeight: 800, cursor: 'pointer' }}>← Menú</button>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
//  2) GENERADOR DE EJERCICIOS
// ═════════════════════════════════════════════════════════════════════════════
export const TIPOS_EJERCICIO = {
    identificar: { label: '👁 Identificar', color: '#3498db' },
    equivalente: { label: '≡ Equivalentes', color: '#2980b9' },
    simplificar: { label: '✂️ Simplificar', color: '#16a085' },
    suma:        { label: '➕ Suma',        color: '#2ecc71' },
    resta:       { label: '➖ Resta',        color: '#e74c3c' },
    mult:        { label: '✖️ Multiplicar',  color: '#f39c12' },
    div:         { label: '➗ Dividir',      color: '#9b59b6' },
    pot:         { label: 'xⁿ Potencia',     color: '#1abc9c' },
    raiz:        { label: '√ Raíz',          color: '#e67e22' },
};

const DENOMS_FACIL = [2, 3, 4, 5, 6, 8, 10];
const CUADRADOS = [1, 4, 9, 16, 25, 36, 49, 64];

// Genera un ejercicio según el tipo y el nivel (1 fácil · 2 medio · 3 difícil)
export const generarEjercicio = (tiposActivos, nivel = 1) => {
    const tipos = tiposActivos.length ? tiposActivos : ['identificar'];
    const tipo = rItem(tipos);
    const maxDen = nivel === 1 ? 8 : nivel === 2 ? 12 : 16;
    const denoms = nivel === 1 ? DENOMS_FACIL : [...DENOMS_FACIL, 7, 9, 12, 15, 16];

    const fr = () => { const d = rItem(denoms.filter(x => x <= maxDen)); return [rInt(1, d - 1), d]; };

    if (tipo === 'identificar') {
        const [n, d] = fr();
        return { tipo, enunciado: '¿Qué fracción está pintada?', visual: { modo: 'barra', n, d, color: COLORES.A },
                 respuesta: [n, d], aceptaEquivalente: true, solucion: `${n}/${d}` };
    }

    if (tipo === 'equivalente') {
        const d0 = rItem([2, 3, 4, 5, 6, 8].filter(x => x <= (nivel === 1 ? 5 : 8)));
        const [n, d] = [rInt(1, d0 - 1), d0];
        const k = rInt(2, nivel === 1 ? 3 : 4);
        return { tipo, enunciado: `Completa la fracción equivalente a ${n}/${d} con denominador ${d * k}`,
                 visual: { modo: 'equiv', n, d, k }, respuesta: [n * k, d * k], lockDen: d * k,
                 solucion: `${n * k}/${d * k}` };
    }

    if (tipo === 'simplificar') {
        const [n, d] = fr();
        const k = rInt(2, nivel === 1 ? 3 : 5);
        return { tipo, enunciado: `Simplifica ${n * k}/${d * k} hasta la fracción irreducible`,
                 visual: { modo: 'barra', n: n * k, d: d * k, color: COLORES.A },
                 respuesta: simplificar(n * k, d * k), exigirIrreducible: true, solucion: `${simplificar(n * k, d * k).join('/')}` };
    }

    if (tipo === 'pot') {
        const d = rItem([2, 3, 4, 5]);
        const n = rInt(1, d - 1);
        const e = nivel === 3 ? rItem([2, 3]) : 2;
        const res = simplificar(Math.pow(n, e), Math.pow(d, e));
        return { tipo, enunciado: `Calcula (${n}/${d})^${e}`, visual: { modo: 'pot', n, d, e },
                 respuesta: res, exigirIrreducible: true, solucion: res.join('/') };
    }

    if (tipo === 'raiz') {
        const d2 = rItem(CUADRADOS.filter(x => x > 1));
        const posibles = CUADRADOS.filter(x => x < d2);
        const n2 = posibles.length ? rItem(posibles) : 1;
        const res = simplificar(Math.sqrt(n2), Math.sqrt(d2));
        return { tipo, enunciado: `Calcula √(${n2}/${d2})`, visual: { modo: 'raiz', n: n2, d: d2 },
                 respuesta: res, exigirIrreducible: true, solucion: res.join('/') };
    }

    // Operaciones con dos fracciones
    let a = fr(), b = fr();
    if (tipo === 'suma' || tipo === 'resta') {
        // Denominadores «amables» (común pequeño), para que el resultado no tenga
        // un numerador enorme imposible de teclear.
        const ad = a[1];
        const topeComun = nivel === 1 ? 12 : nivel === 2 ? 24 : 36;
        const amigos = [2, 3, 4, 5, 6, 8, 9, 10, 12].filter(x => lcm(ad, x) <= topeComun);
        const bd = rItem(amigos.length ? amigos : [ad]);
        b = [rInt(1, bd - 1), bd];
    }
    if (tipo === 'mult' || tipo === 'div') {
        // Multiplicar/dividir hace crecer mucho el denominador: fracciones pequeñas.
        const tope = nivel === 1 ? 5 : nivel === 2 ? 6 : 8;
        const da = rInt(2, tope), dbv = rInt(2, tope);
        a = [rInt(1, da - 1), da];
        b = [rInt(1, dbv - 1), dbv];
    }
    if (tipo === 'resta' && valor(a) < valor(b)) { const t = a; a = b; b = t; }
    if (tipo === 'div' && b[0] === 0) b = [1, b[1]];
    const res = opera(a, b, tipo);
    return {
        tipo,
        enunciado: `Calcula ${a[0]}/${a[1]} ${SIGNO_OP[tipo]} ${b[0]}/${b[1]}`,
        visual: { modo: 'dos', a, b, op: tipo },
        respuesta: res, exigirIrreducible: true, solucion: res.join('/'),
    };
};

// Distractores plausibles para el modo competición (opción múltiple)
const opcionesDe = (ej) => {
    const [rn, rd] = ej.respuesta;
    const cand = [];
    const push = (n, d) => {
        if (d <= 0 || n < 0) return;
        const s = simplificar(n, d);
        if (s[0] === rn && s[1] === rd) return;
        if (cand.some(c => c[0] === s[0] && c[1] === s[1])) return;
        cand.push(s);
    };
    if (ej.visual?.modo === 'dos') {
        const [[an, ad], [bn, bd]] = [ej.visual.a, ej.visual.b];
        push(an + bn, ad + bd);          // error clásico: sumar en cruz
        push(an * bn, ad * bd);
        push(Math.abs(an - bn), Math.max(1, Math.abs(ad - bd)) || 1);
    }
    push(rn + 1, rd); push(rn, rd + 1); push(rd, rn || 1); push(rn * 2, rd);
    return mezclar([[rn, rd], ...mezclar(cand).slice(0, 3)]);
};

// ─── Visual del enunciado de un ejercicio ────────────────────────────────────
const VisualEjercicio = ({ ej, isMobile, compacto = false }) => {
    const v = ej.visual || {};
    const alto = compacto ? 30 : isMobile ? 40 : 50;
    if (v.modo === 'barra') return <BarraFraccion n={v.n} d={v.d} color={v.color || COLORES.A} alto={alto} />;
    if (v.modo === 'equiv') return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BarraFraccion n={v.n} d={v.d} color={COLORES.A} alto={alto} />
            <BarraFraccion n={v.n} d={v.d} subdiv={v.k} color={COLORES.B} alto={alto} />
        </div>
    );
    if (v.modo === 'dos') {
        // En suma y resta cada fracción se corta en un sentido y lleva de guía
        // (a rayas) los cortes de la otra: se ve que comparten el mismo trocito.
        const sumaResta = v.op === 'suma' || v.op === 'resta';
        const altoSR = compacto ? 46 : isMobile ? 62 : 76;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <BarraFraccion n={v.a[0]} d={v.a[1]} color={COLORES.A} alto={sumaResta ? altoSR : alto}
                    orient="v" guias={sumaResta ? { partes: v.b[1], orient: 'h' } : null} />
                <div style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 900, color: '#2c3e50' }}>{SIGNO_OP[v.op]}</div>
                <BarraFraccion n={v.b[0]} d={v.b[1]} color={COLORES.B} alto={sumaResta ? altoSR : alto}
                    orient={sumaResta ? 'h' : 'v'} guias={sumaResta ? { partes: v.a[1], orient: 'v' } : null} />
            </div>
        );
    }
    if (v.modo === 'pot') return v.e === 2
        ? <RejillaProducto a={[v.n, v.d]} b={[v.n, v.d]} alto={compacto ? 90 : isMobile ? 120 : 150} />
        : <BarraFraccion n={v.n} d={v.d} color={COLORES.A} alto={alto} />;
    if (v.modo === 'raiz') return <CuadradoRaiz n={v.n} d={v.d} lado={compacto ? 100 : isMobile ? 120 : 150} />;
    return null;
};

// ─── Enunciado en formato matemático ─────────────────────────────────────────
const EnunciadoMat = ({ ej, size = '2rem' }) => {
    const v = ej.visual || {};
    if (v.modo === 'dos') return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <FracTexto n={v.a[0]} d={v.a[1]} size={size} color={COLORES.A} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>{SIGNO_OP[v.op]}</span>
            <FracTexto n={v.b[0]} d={v.b[1]} size={size} color={COLORES.B} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>=</span>
        </span>
    );
    if (v.modo === 'pot') return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>(</span>
            <FracTexto n={v.n} d={v.d} size={size} color={COLORES.A} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>)</span>
            <span style={{ fontSize: `calc(${size} * 0.6)`, fontWeight: 900, color: '#16a085', alignSelf: 'flex-start' }}>{v.e}</span>
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>=</span>
        </span>
    );
    if (v.modo === 'raiz') return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>√</span>
            <FracTexto n={v.n} d={v.d} size={size} color={COLORES.A} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>=</span>
        </span>
    );
    if (v.modo === 'equiv') return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <FracTexto n={v.n} d={v.d} size={size} color={COLORES.A} />
            <span style={{ fontSize: size, fontWeight: 900, color: '#2c3e50' }}>=</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05, fontWeight: 800, color: COLORES.RES, fontSize: `calc(${size} * 0.8)` }}>
                <span>?</span>
                <span style={{ width: '100%', minWidth: 20, height: 2.5, background: COLORES.RES, borderRadius: 2, margin: '3px 0' }} />
                <span>{v.d * v.k}</span>
            </span>
        </span>
    );
    return <span style={{ fontSize: `calc(${size} * 0.62)`, fontWeight: 800, color: '#2c3e50' }}>{ej.enunciado}</span>;
};

// ─── Comprobación de la respuesta del alumno ─────────────────────────────────
const esCorrecta = (ej, n, d) => {
    if (!ej || d === 0) return false;
    const [rn, rd] = ej.respuesta;
    const mismoValor = Math.abs(n / d - rn / rd) < 1e-9;
    if (!mismoValor) return false;
    if (ej.exigirIrreducible) return esIrreducible(n, d);
    if (ej.lockDen) return d === ej.lockDen;
    if (ej.aceptaEquivalente) return true;
    return n === rn && d === rd;
};

// ═════════════════════════════════════════════════════════════════════════════
//  PANEL DE RESPUESTA (reutilizado en práctica y en el tirón de cuerda)
// ═════════════════════════════════════════════════════════════════════════════
const PanelRespuesta = ({ ej, num, den, setNum, setDen, bloqueado, isMobile, color = COLORES.RES }) => (
    <>
        <div style={{ background: '#f8f9fa', borderRadius: 14, padding: '12px 10px', border: '2px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap', position: 'relative' }}>
            <FracTexto n={num} d={den} size={isMobile ? '2rem' : '2.4rem'} color={color} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Stepper label="Numerador" valor={num} color={color} isMobile={isMobile} min={0} max={400} disabled={bloqueado} onChange={setNum} saltos={[-10, -5, 5, 10]} />
                <Stepper label="Denominador" valor={den} color={color} isMobile={isMobile} min={1} max={400} disabled={bloqueado || !!ej?.lockDen} onChange={setDen} saltos={ej?.lockDen ? null : [-10, -5, 5, 10]} />
            </div>
            {!bloqueado && (
                <button onClick={() => { setNum(0); if (!ej?.lockDen) setDen(1); }} title="Borrar"
                    style={{ position: 'absolute', top: 6, right: 8, background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', padding: 3 }}>
                    <Delete size={20} />
                </button>
            )}
        </div>
        {ej?.exigirIrreducible && (
            <div style={{ fontSize: '0.74rem', color: '#f39c12', fontWeight: 800, textAlign: 'center', marginTop: 6 }}>
                ✂️ Escribe el resultado <b>simplificado</b> (irreducible)
            </div>
        )}
    </>
);

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL «Enviar al profesor»
// ═════════════════════════════════════════════════════════════════════════════
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const intentos = datos.aciertos + datos.fallos;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'FRACCIONES', modalidad: 'Individual', fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(),
                    aciertos: datos.aciertos, fallos: datos.fallos, intentos,
                    puntos: datos.puntos, skips: datos.skips,
                    porcentaje: Math.round((datos.aciertos / Math.max(1, intentos)) * 100),
                    config: { tipos: datos.config.tipos, nivel: datos.config.nivel, tiempo: datos.config.tiempo, numEjercicios: datos.config.numEjercicios },
                    detalle: datos.detalle || [],
                }],
            });
            guardarRegistroLocal('FRACCIONES', {
                titulo: 'Fracciones', aciertos: datos.aciertos, intentos,
                porcentaje: Math.round((datos.aciertos / Math.max(1, intentos)) * 100),
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>✅ {datos.aciertos} aciertos · ❌ {datos.fallos} fallos · {datos.puntos} pts</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso', 'Curso', curso, setCurso, 'Ej: 1º ESO A', false],
                          ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }} />
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL DE CONFIGURACIÓN
// ═════════════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    tipos: ['identificar', 'simplificar', 'equivalente', 'suma', 'resta'],
    nivel: 1,
    tiempo: 120,
    numEjercicios: null,
};

const MODOS_PRESET = [
    { id: 'EASY', icon: '👶', label: 'Sencillo', desc: 'Identificar, simplificar y equivalentes', color: '#2ecc71',
      chips: ['👁', '✂️', '≡'],
      cfg: { tipos: ['identificar', 'simplificar', 'equivalente'], nivel: 1, tiempo: 120, numEjercicios: null } },
    { id: 'MEDIUM', icon: '🤓', label: 'Medio', desc: 'Suma, resta, multiplicación y división', color: '#f39c12',
      chips: ['➕', '➖', '✖️', '➗'],
      cfg: { tipos: ['suma', 'resta', 'mult', 'div', 'simplificar'], nivel: 2, tiempo: 120, numEjercicios: null } },
    { id: 'HARD', icon: '🔥', label: 'Difícil', desc: 'Todo, con potencias y raíces', color: '#e74c3c',
      chips: ['✖️', '➗', 'xⁿ', '√'],
      cfg: { tipos: Object.keys(TIPOS_EJERCICIO), nivel: 3, tiempo: 120, numEjercicios: null } },
    { id: 'CUSTOM', icon: '⚙️', label: 'Configurado', desc: 'Elige tipos, nivel y tiempo', color: '#9b59b6', chips: null, cfg: null },
];

const ConfigModal = ({ config, onStart, onClose }) => {
    const [local, setLocal] = useState({ ...DEFAULT_CONFIG, ...config });
    const [modoConteo, setModoConteo] = useState(config.numEjercicios ? 'ejercicios' : 'tiempo');

    const toggleTipo = (k) => {
        const next = local.tipos.includes(k) ? local.tipos.filter(t => t !== k) : [...local.tipos, k];
        if (!next.length) return;
        setLocal(p => ({ ...p, tipos: next }));
    };

    const Chip = ({ active, onClick, children, color = '#7b1fa2' }) => (
        <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', background: active ? color : '#f0f0f0', color: active ? 'white' : '#555', boxShadow: active ? `0 3px 8px ${color}55` : 'none', touchAction: 'manipulation' }}>{children}</button>
    );
    const Section = ({ label, children }) => (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 22, padding: '28px 24px', maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 70px rgba(0,0,0,0.3)' }}>
                <h2 style={{ textAlign: 'center', color: '#2c3e50', fontSize: '1.3rem', marginTop: 0, marginBottom: 22 }}>⚙️ Modo Configurado</h2>

                <Section label="🍰 Tipos de ejercicio">
                    {Object.entries(TIPOS_EJERCICIO).map(([k, v]) => (
                        <Chip key={k} active={local.tipos.includes(k)} onClick={() => toggleTipo(k)} color={v.color}>{v.label}</Chip>
                    ))}
                </Section>

                <Section label="📏 Nivel (tamaño de los denominadores)">
                    {[[1, '👶 Fácil'], [2, '🤓 Medio'], [3, '🔥 Difícil']].map(([n, lab]) => (
                        <Chip key={n} active={local.nivel === n} onClick={() => setLocal(p => ({ ...p, nivel: n }))} color="#7b1fa2">{lab}</Chip>
                    ))}
                </Section>

                <Section label="⏱ Modo de juego">
                    <Chip active={modoConteo === 'tiempo'} onClick={() => setModoConteo('tiempo')} color="#E91E63">⏱ Por tiempo</Chip>
                    <Chip active={modoConteo === 'ejercicios'} onClick={() => setModoConteo('ejercicios')} color="#009688">🔢 Por ejercicios</Chip>
                </Section>

                {modoConteo === 'tiempo' ? (
                    <Section label="⏱ Tiempo de juego">
                        {[60, 90, 120, 180, 300].map(t => (
                            <Chip key={t} active={local.tiempo === t} onClick={() => setLocal(p => ({ ...p, tiempo: t }))} color="#E91E63">{t < 60 ? `${t}s` : `${t / 60} min`}</Chip>
                        ))}
                    </Section>
                ) : (
                    <Section label="🔢 Número de ejercicios">
                        {[5, 10, 15, 20, 30].map(n => (
                            <Chip key={n} active={(local.numEjercicios || 10) === n} onClick={() => setLocal(p => ({ ...p, numEjercicios: n }))} color="#009688">{n}</Chip>
                        ))}
                    </Section>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={onClose} style={{ padding: '12px 24px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => onStart({ ...local, numEjercicios: modoConteo === 'ejercicios' ? (local.numEjercicios || 10) : null })}
                        style={{ padding: '12px 28px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px #9b59b655' }}>▶ Empezar</button>
                </div>
            </div>
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
//  3) MODO COMPETICIÓN — panel nativo para el tirón de cuerda
// ═════════════════════════════════════════════════════════════════════════════
const PanelCuerdaFracciones = ({ equipo, aplicar, bloqueado, tipos, nivel, isMobile }) => {
    const [ej, setEj] = useState(() => generarEjercicio(tipos, nivel));
    const [opciones, setOpciones] = useState(() => []);
    const [estado, setEstado] = useState(null); // null | 'ok' | 'err'
    const acento = equipo === 1 ? '#42A5F5' : '#EF5350';

    useEffect(() => { setOpciones(opcionesDe(ej)); }, [ej]);
    useEffect(() => { setEj(generarEjercicio(tipos, nivel)); setEstado(null); }, [tipos.join(','), nivel]); // eslint-disable-line react-hooks/exhaustive-deps

    const responder = (op) => {
        if (estado || bloqueado) return;
        const ok = Math.abs(valor(op) - valor(ej.respuesta)) < 1e-9;
        (ok ? sonidoCorrecto : sonidoIncorrecto)();
        setEstado(ok ? 'ok' : 'err');
        aplicar(ok);
        setTimeout(() => { setEj(generarEjercicio(tipos, nivel)); setEstado(null); }, 850);
    };

    const meta = TIPOS_EJERCICIO[ej.tipo] || { color: acento, label: '' };
    return (
        <div style={{ border: `3px solid ${estado === 'ok' ? '#27ae60' : estado === 'err' ? '#e74c3c' : `${acento}66`}`, background: estado === 'ok' ? '#f0fff4' : estado === 'err' ? '#fff5f5' : 'white', borderRadius: 16, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s' }}>
            <div style={{ textAlign: 'center', fontWeight: 900, color: acento, fontSize: '0.85rem' }}>
                {equipo === 1 ? '🔵 Equipo 1' : '🔴 Equipo 2'} · <span style={{ color: meta.color }}>{meta.label}</span>
            </div>
            <div style={{ textAlign: 'center', minHeight: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <EnunciadoMat ej={ej} size={isMobile ? '1.5rem' : '1.8rem'} />
            </div>
            <div style={{ padding: '0 6px' }}><VisualEjercicio ej={ej} isMobile={isMobile} compacto /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {opciones.map((op, i) => (
                    <button key={i} onClick={() => responder(op)} disabled={!!estado || bloqueado}
                        style={{ padding: isMobile ? '10px 4px' : '13px 6px', borderRadius: 12, border: `2px solid ${acento}55`, background: 'white', cursor: (estado || bloqueado) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (estado || bloqueado) ? 0.55 : 1, boxShadow: '0 3px 0 rgba(0,0,0,0.12)', touchAction: 'manipulation' }}>
                        <FracTexto n={op[0]} d={op[1]} size={isMobile ? '1.3rem' : '1.5rem'} color="#2c3e50" />
                    </button>
                ))}
            </div>
            {estado === 'ok' && <div style={{ textAlign: 'center', color: '#27ae60', fontWeight: 800 }}>✅ ¡Tirad fuerte!</div>}
            {estado === 'err' && <div style={{ textAlign: 'center', color: '#e74c3c', fontWeight: 800, fontSize: '0.85rem' }}>❌ Era {ej.solucion}</div>}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function Fracciones({ usuario, onExit }) {
    const [gameState, setGameState] = useState('START'); // START | LAB | PLAYING | COMPETICION | END
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [showConfig, setShowConfig] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [sonido, setSonido] = useState(() => sonidoActivo());

    const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.tiempo);
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [fallos, setFallos] = useState(0);
    const [skips, setSkips] = useState(0);
    const [ejercicioActual, setEjercicioActual] = useState(1);
    const [detalle, setDetalle] = useState([]);

    const [ej, setEj] = useState(null);
    const [num, setNum] = useState(0);
    const [den, setDen] = useState(1);
    const [feedback, setFeedback] = useState(null); // CORRECT | INCORRECT | SKIP
    const [showSolution, setShowSolution] = useState(false);

    // Config del modo competición
    const [tiposComp, setTiposComp] = useState(['suma', 'resta', 'simplificar', 'equivalente']);
    const [nivelComp, setNivelComp] = useState(1);

    const timerRef = useRef(null);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 700);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 700);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const modoEjercicios = !!config.numEjercicios;

    // Sonido de fin de partida
    useEffect(() => { if (gameState === 'END') sonidoFinal(); }, [gameState]);

    useEffect(() => {
        if (modoEjercicios) return;
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (gameState === 'PLAYING' && timeLeft <= 0) {
            clearInterval(timerRef.current);
            setGameState('END');
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft, modoEjercicios]);

    const nuevoEjercicio = (cfg = config) => {
        const e = generarEjercicio(cfg.tipos, cfg.nivel);
        setEj(e);
        setNum(0);
        setDen(e.lockDen || 1);
        setShowSolution(false);
    };

    const startGame = (cfg = config) => {
        despertarAudio();
        clearInterval(timerRef.current);
        setConfig(cfg);
        setScore(0); setAciertos(0); setFallos(0); setSkips(0);
        setEjercicioActual(1); setDetalle([]); setGuardado(false);
        setTimeLeft(cfg.tiempo);
        setFeedback(null);
        nuevoEjercicio(cfg);
        setGameState('PLAYING');
    };

    const registrar = (ok, saltado = false) => {
        setDetalle(d => [...d.slice(-49), { tipo: ej.tipo, enunciado: ej.enunciado, solucion: ej.solucion, respuesta: `${num}/${den}`, ok, saltado }]);
    };

    const avanzar = () => {
        if (config.numEjercicios && ejercicioActual >= config.numEjercicios) { setGameState('END'); return; }
        setEjercicioActual(n => n + 1);
        nuevoEjercicio();
    };

    const comprobar = () => {
        if (!ej || showSolution || feedback) return;
        if (esCorrecta(ej, num, den)) {
            sonidoCorrecto();
            setScore(s => s + 10); setAciertos(a => a + 1); setFeedback('CORRECT'); registrar(true);
            setTimeout(() => { setFeedback(null); avanzar(); }, 700);
        } else {
            sonidoIncorrecto();
            setScore(s => Math.max(0, s - 3)); setFallos(f => f + 1); setFeedback('INCORRECT'); registrar(false);
            setTimeout(() => setFeedback(null), 700);
        }
    };

    const pasar = () => {
        if (!ej || showSolution) return;
        sonidoPasar();
        setSkips(s => s + 1); setFallos(f => f + 1); setScore(s => Math.max(0, s - 2));
        setShowSolution(true); setFeedback('SKIP'); registrar(false, true);
        setTimeout(() => { setFeedback(null); avanzar(); }, 2200);
    };

    const guardarLocal = () => {
        const intentos = aciertos + fallos;
        guardarRegistroLocal('FRACCIONES', {
            titulo: 'Fracciones', aciertos, intentos,
            porcentaje: Math.round((aciertos / Math.max(1, intentos)) * 100),
            nombre: usuario?.nombre || usuario?.displayName || '', curso: '', via: 'local',
        });
        setGuardado(true);
    };

    const salir = () => {
        clearInterval(timerRef.current);
        if (gameState !== 'START') { setGameState('START'); return; }
        if (typeof onExit === 'function') onExit();
        else window.location.href = '/';
    };

    const compartir = () => {
        const url = `${window.location.origin}/fracciones`;
        if (navigator.share) navigator.share({ title: 'Fracciones', text: 'Juega con fracciones en Pikt', url }).catch(() => {});
        else navigator.clipboard.writeText(url).then(() => alert('✅ Enlace copiado')).catch(() => {});
    };

    const borderColor = feedback === 'CORRECT' ? '#2ecc71' : feedback === 'INCORRECT' ? '#e74c3c' : feedback === 'SKIP' ? '#f39c12' : 'transparent';

    return (
        <div style={st.container}>
            {showConfig && (
                <ConfigModal config={config} onClose={() => setShowConfig(false)}
                    onStart={(cfg) => { setShowConfig(false); startGame(cfg); }} />
            )}

            {/* HEADER */}
            <div style={st.header}>
                <button onClick={salir} style={st.btnVolver}><RotateCcw size={16} /> Salir</button>
                <button onClick={compartir} style={st.btnVolver} title="Compartir"><Share2 size={16} /></button>
                <button onClick={() => { const nuevo = !sonido; setSonido(setSonidoActivo(nuevo)); if (nuevo) { despertarAudio(); sonidoCorrecto(); } }}
                    style={st.btnVolver} title={sonido ? 'Silenciar' : 'Activar sonido'}>
                    {sonido ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                {gameState === 'PLAYING' && (
                    <div style={st.scoreFlex}>
                        {modoEjercicios
                            ? <div style={{ ...st.scoreBoard, color: '#009688' }}>🔢 {ejercicioActual}/{config.numEjercicios}</div>
                            : <div style={{ ...st.scoreBoard, color: timeLeft <= 10 ? '#e74c3c' : '#333' }}><Clock size={16} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>}
                        <div style={{ ...st.scoreBoard, color: '#7b1fa2' }}><Trophy size={16} /> {score}</div>
                        <div style={{ ...st.scoreBoard, color: '#27ae60', fontSize: '0.9rem' }}>✅ {aciertos}</div>
                        <div style={{ ...st.scoreBoard, color: '#e74c3c', fontSize: '0.9rem' }}>❌ {fallos}</div>
                    </div>
                )}
            </div>

            {/* ── INICIO ── */}
            {gameState === 'START' && (
                <div style={{ ...st.centerCard, maxWidth: 560 }}>
                    <PieChart size={52} color="#7b1fa2" style={{ marginBottom: 10 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.3rem', margin: '6px 0 4px' }}>Fracciones</h1>
                    <p style={{ color: '#999', marginBottom: 20, fontSize: '0.9rem' }}>
                        Laboratorio visual, ejercicios y tirón de cuerda por equipos
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Laboratorio */}
                        <button onClick={() => setGameState('LAB')} style={{ ...st.modoBtn, border: '2px solid #3498db' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px #3498db33'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}>
                            <div style={{ ...st.modoIcon, background: '#3498db' }}>🔬</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={st.modoLabel}>Laboratorio de fracciones</div>
                                <div style={st.modoDesc}>Manipula numerador y denominador y observa la representación en tiempo real</div>
                            </div>
                            <span style={{ color: '#3498db', fontSize: '1.3rem' }}>›</span>
                        </button>

                        <div style={st.separador}><div style={st.sepLinea} /><span style={st.sepTxt}>práctica</span><div style={st.sepLinea} /></div>

                        {MODOS_PRESET.map(m => (
                            <button key={m.id} onClick={() => (m.cfg ? startGame({ ...DEFAULT_CONFIG, ...m.cfg }) : setShowConfig(true))}
                                style={{ ...st.modoBtn, border: `2px solid ${m.color}` }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${m.color}33`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}>
                                <div style={{ ...st.modoIcon, background: m.color }}>{m.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={st.modoLabel}>{m.label}</div>
                                    <div style={{ ...st.modoDesc, marginBottom: m.chips ? 6 : 0 }}>{m.desc}</div>
                                    {m.chips && (
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {m.chips.map(c => <span key={c} style={{ background: m.color + '22', color: m.color, border: `1px solid ${m.color}55`, borderRadius: 6, padding: '1px 7px', fontSize: '0.78rem', fontWeight: 700 }}>{c}</span>)}
                                        </div>
                                    )}
                                </div>
                                <span style={{ color: m.color, fontSize: '1.3rem' }}>›</span>
                            </button>
                        ))}

                        <div style={st.separador}><div style={st.sepLinea} /><span style={st.sepTxt}>por equipos</span><div style={st.sepLinea} /></div>

                        {/* Tirón de cuerda */}
                        <button onClick={() => setGameState('COMPETICION')} style={{ ...st.modoBtn, border: '2px solid #e67e22' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px #e67e2233'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}>
                            <div style={{ ...st.modoIcon, background: '#e67e22' }}>🪢</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={st.modoLabel}>Tirón de cuerda</div>
                                <div style={st.modoDesc}>2 equipos · acierta y tira de la cuerda, falla y tira el rival</div>
                            </div>
                            <span style={{ color: '#e67e22', fontSize: '1.3rem' }}>›</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ── LABORATORIO ── */}
            {gameState === 'LAB' && (
                <div style={{ padding: isMobile ? '0 2px' : 0 }}>
                    <h2 style={{ textAlign: 'center', color: '#7b1fa2', margin: '0 0 14px', fontSize: isMobile ? '1.3rem' : '1.6rem' }}>🔬 Laboratorio de fracciones</h2>
                    <Laboratorio onSalir={() => setGameState('START')} isMobile={isMobile} />
                </div>
            )}

            {/* ── PRÁCTICA ── */}
            {gameState === 'PLAYING' && ej && (
                <div style={{ ...st.centerCard, maxWidth: 560, border: `4px solid ${borderColor}`, transition: 'border-color 0.2s, transform 0.2s', transform: feedback === 'CORRECT' ? 'scale(1.02)' : 'none' }}>
                    <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: (TIPOS_EJERCICIO[ej.tipo]?.color || '#7b1fa2') + '22', color: TIPOS_EJERCICIO[ej.tipo]?.color || '#7b1fa2', fontWeight: 800, fontSize: '0.78rem', marginBottom: 10 }}>
                        {TIPOS_EJERCICIO[ej.tipo]?.label}
                    </div>

                    <div style={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                        <EnunciadoMat ej={ej} size={isMobile ? '1.7rem' : '2.1rem'} />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <VisualEjercicio ej={ej} isMobile={isMobile} />
                    </div>

                    {showSolution ? (
                        <div style={{ background: '#e8f5e9', border: '2px solid #27ae60', borderRadius: 14, padding: '14px 12px', marginBottom: 14 }}>
                            <div style={{ fontSize: '0.85rem', color: '#27ae60', fontWeight: 800, marginBottom: 6 }}>✅ Solución</div>
                            <FracTexto n={ej.respuesta[0]} d={ej.respuesta[1]} size={isMobile ? '2.2rem' : '2.6rem'} color="#27ae60" />
                        </div>
                    ) : (
                        <PanelRespuesta ej={ej} num={num} den={den} setNum={setNum} setDen={setDen} bloqueado={!!feedback} isMobile={isMobile} />
                    )}

                    {!showSolution && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button onClick={pasar} style={st.btnSkip} title="Pasar (−2 pts, ver solución)"><SkipForward size={18} /> Pasar</button>
                            <button onClick={comprobar} style={{ ...st.btnSuccess, flex: 2 }}><CheckCircle size={20} /> Comprobar</button>
                        </div>
                    )}

                    {feedback === 'INCORRECT' && <div style={{ marginTop: 10, color: '#e74c3c', fontWeight: 800 }}>❌ Revisa el resultado</div>}
                    {feedback === 'CORRECT' && <div style={{ marginTop: 10, color: '#27ae60', fontWeight: 800 }}>✅ ¡Correcto!</div>}
                </div>
            )}

            {/* ── COMPETICIÓN (tirón de cuerda) ── */}
            {gameState === 'COMPETICION' && (
                <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
                    <h2 style={{ textAlign: 'center', color: '#e67e22', margin: '0 0 12px', fontSize: isMobile ? '1.3rem' : '1.6rem' }}>🪢 Tirón de cuerda · Fracciones</h2>
                    <CompeticionCuerda
                        metaInicial={5}
                        isMobile={isMobile}
                        onSalir={() => setGameState('START')}
                        configExtra={(
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span>Ejercicios:</span>
                                    {Object.entries(TIPOS_EJERCICIO).map(([k, v]) => {
                                        const activo = tiposComp.includes(k);
                                        return (
                                            <button key={k} onClick={() => setTiposComp(p => (p.includes(k) ? (p.length > 1 ? p.filter(x => x !== k) : p) : [...p, k]))}
                                                style={{ padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.74rem', border: `2px solid ${v.color}`, background: activo ? v.color : 'white', color: activo ? 'white' : v.color }}>
                                                {v.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span>Nivel:</span>
                                    {[[1, '👶 Fácil'], [2, '🤓 Medio'], [3, '🔥 Difícil']].map(([n, lab]) => (
                                        <button key={n} onClick={() => setNivelComp(n)}
                                            style={{ padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.74rem', border: '2px solid #7b1fa2', background: nivelComp === n ? '#7b1fa2' : 'white', color: nivelComp === n ? 'white' : '#7b1fa2' }}>{lab}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        renderPanel={(equipo, { key, aplicar, bloqueado }) => (
                            <PanelCuerdaFracciones key={`${key}-${tiposComp.join('')}-${nivelComp}`} equipo={equipo} aplicar={aplicar} bloqueado={bloqueado}
                                tipos={tiposComp} nivel={nivelComp} isMobile={isMobile} />
                        )}
                    />
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <button onClick={() => setGameState('START')} style={{ padding: '11px 24px', borderRadius: 30, border: '2px solid #bdc3c7', background: 'white', color: '#7f8c8d', fontWeight: 800, cursor: 'pointer' }}>← Menú</button>
                    </div>
                </div>
            )}

            {/* ── FINAL ── */}
            {gameState === 'END' && (
                <div style={st.centerCard}>
                    {score >= 80 && <Confetti recycle={false} />}
                    {modoEjercicios ? <Trophy size={70} color="#f1c40f" style={{ marginBottom: 16 }} /> : <Clock size={70} color="#f1c40f" style={{ marginBottom: 16 }} />}
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.2rem' }}>
                        {modoEjercicios ? '¡Ejercicios completados!' : '¡Tiempo agotado!'}
                    </h1>
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#7b1fa2', margin: '8px 0' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: 6 }}>Puntos totales</p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ {aciertos} aciertos</span>
                        <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>❌ {fallos} fallos</span>
                        <span style={{ color: '#f39c12', fontWeight: 'bold' }}>⏭ {skips} pasadas</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => startGame(config)} style={{ ...st.btnPrimary, background: '#7b1fa2' }}><RotateCcw size={16} /> Repetir</button>
                        <button onClick={() => { setShowConfig(true); setGameState('START'); }} style={{ ...st.btnPrimary, background: '#7f8c8d' }}><Settings size={16} /> Configurar</button>
                        <button onClick={() => setGameState('START')} style={st.btnVolver}>Menú</button>
                        <button onClick={guardarLocal} disabled={guardado} style={{ ...st.btnPrimary, background: guardado ? '#bdc3c7' : 'linear-gradient(135deg,#2980b9,#3498db)' }}>
                            {guardado ? '✔ Guardado' : '💾 Guardar en mis registros'}
                        </button>
                        <button onClick={() => setMostrarEnvio(true)} style={{ ...st.btnPrimary, background: 'linear-gradient(135deg,#27ae60,#2ecc71)' }}>📤 Enviar al profesor</button>
                    </div>
                </div>
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe datos={{ aciertos, fallos, puntos: score, skips, config, detalle }} onClose={() => setMostrarEnvio(false)} />
            )}
        </div>
    );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const st = {
    container: { minHeight: '100vh', background: '#f3e5f5', padding: '15px', fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    scoreFlex: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    scoreBoard: { display: 'flex', gap: 6, background: 'white', padding: '7px 14px', borderRadius: 30, fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: 520, margin: '10px auto', padding: '22px 20px', borderRadius: 20, textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
    btnPrimary: { color: 'white', border: 'none', padding: '13px 20px', borderRadius: 30, fontSize: '1.02rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 10px rgba(0,0,0,0.2)', width: '100%', maxWidth: 300 },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #1e8449', touchAction: 'manipulation' },
    btnSkip: { background: '#f39c12', color: 'white', border: 'none', borderRadius: 14, padding: '14px 16px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 5px 0 #d68910', flex: 1, touchAction: 'manipulation' },
    modoBtn: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'white', borderRadius: 16, cursor: 'pointer', textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 3px 10px rgba(0,0,0,0.07)', width: '100%' },
    modoIcon: { borderRadius: 12, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 },
    modoLabel: { fontWeight: 'bold', color: '#2c3e50', fontSize: '1rem', marginBottom: 3 },
    modoDesc: { color: '#888', fontSize: '0.82rem' },
    separador: { display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' },
    sepLinea: { flex: 1, height: 1, background: '#eee' },
    sepTxt: { color: '#bbb', fontSize: '0.75rem' },
};
