import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, Send, Eye } from 'lucide-react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';

// ─── CANVAS CONSTANTS ────────────────────────────────────────────────────────
const CS = 360;
const RANGE = 7;
const SCALE = CS / (RANGE * 2);
const OX = CS / 2;
const OY = CS / 2;

const toC = (mx, my) => ({ x: OX + mx * SCALE, y: OY - my * SCALE });
const toM = (cx, cy) => ({ x: (cx - OX) / SCALE, y: (OY - cy) / SCALE });

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const approxEq = (a, b, tol = 0.15) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= tol;
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);

const parseAns = (s) => {
    if (!s && s !== 0) return NaN;
    const t = String(s).trim().replace(',', '.');
    if (t.includes('/')) {
        const [n, d] = t.split('/').map(Number);
        return isNaN(n) || isNaN(d) || d === 0 ? NaN : n / d;
    }
    return parseFloat(t);
};

const fmt = (v) => {
    if (!isFinite(v)) return '∞';
    if (Number.isInteger(v)) return String(v);
    const r = Math.round(v * 100) / 100;
    if (Number.isInteger(r)) return String(r);
    const halves = [2, 4].find(d => Number.isInteger(Math.round(v * d)));
    if (halves) {
        const num = Math.round(v * halves);
        const g = gcd(Math.abs(num), halves);
        return `${num / g}/${halves / g}`;
    }
    return r.toFixed(2);
};

// ─── MATH RENDERING COMPONENTS ───────────────────────────────────────────────
const fracStyle = { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 2px', lineHeight: 1.1 };
const fracNum   = { borderBottom: '1.5px solid currentColor', padding: '0 4px', fontSize: '0.82em', textAlign: 'center' };
const fracDen   = { padding: '0 4px', fontSize: '0.82em', textAlign: 'center' };

function Frac({ num, den }) {
    return (
        <span style={fracStyle}>
            <span style={fracNum}>{num}</span>
            <span style={fracDen}>{den}</span>
        </span>
    );
}
function Sup({ children }) {
    return <sup style={{ fontSize: '0.65em', position: 'relative', top: '-0.5em', lineHeight: 0 }}>{children}</sup>;
}
function Sub({ children }) {
    return <sub style={{ fontSize: '0.65em', position: 'relative', bottom: '-0.15em', lineHeight: 0 }}>{children}</sub>;
}

// Returns a JSX node for a coefficient value (absolute value as fraction if needed)
function CoefNode({ v }) {
    const abs = Math.abs(v);
    if (Number.isInteger(abs)) return <>{abs}</>;
    const r2 = Math.round(abs * 2);
    if (Math.abs(r2 / 2 - abs) < 0.001) {
        const g = gcd(r2, 2);
        return <Frac num={r2 / g} den={2 / g} />;
    }
    const r4 = Math.round(abs * 4);
    if (Math.abs(r4 / 4 - abs) < 0.001) {
        const g = gcd(r4, 4);
        return <Frac num={r4 / g} den={4 / g} />;
    }
    return <>{abs.toFixed(2)}</>;
}

// Sign + coef node for a term; isFirst=true suppresses leading +
function Term({ v, isFirst, varNode, hidePlusIfFirst }) {
    if (v === 0) return null;
    const sign = v < 0 ? '−' : (isFirst ? '' : '+');
    const absVal = Math.abs(v);
    const coefNode = (absVal === 1 && varNode) ? null : <CoefNode v={v} />;
    return (
        <span style={{ margin: '0 2px' }}>
            {sign && <span style={{ margin: '0 2px' }}>{sign}</span>}
            {coefNode}
            {varNode}
        </span>
    );
}

// ─── FORMULA COMPONENTS PER TYPE ─────────────────────────────────────────────
function FormulaLineal({ m, n }) {
    const absM = Math.abs(m);
    const signM = m < 0 ? '−' : '';
    const mNode = Number.isInteger(absM) ? (absM === 1 ? '' : `${absM}`) : <CoefNode v={absM} />;
    const nStr = n === 0 ? null : n > 0 ? <><span style={{ margin: '0 3px' }}>+</span>{n}</> : <><span style={{ margin: '0 3px' }}>−</span>{Math.abs(n)}</>;
    return (
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.15rem' }}>
            y = {signM}{mNode}<em>x</em>{n !== 0 && <span style={{ margin: '0 3px' }}>{nStr}</span>}
        </span>
    );
}

function FormulaCuadratica({ a, b, c }) {
    const signA = a < 0 ? '−' : '';
    const absA = Math.abs(a);
    return (
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem' }}>
            y = {signA}{absA !== 1 ? absA : ''}<em>x</em><Sup>2</Sup>
            {b !== 0 && <>{b > 0 ? <span style={{ margin: '0 3px' }}>+</span> : <span style={{ margin: '0 3px' }}>−</span>}{Math.abs(b) !== 1 ? Math.abs(b) : ''}<em>x</em></>}
            {c !== 0 && <>{c > 0 ? <span style={{ margin: '0 3px' }}>+</span> : <span style={{ margin: '0 3px' }}>−</span>}{Math.abs(c)}</>}
        </span>
    );
}

function FormulaInversa({ a, b, c }) {
    const denomNode = (
        <span>
            <em>x</em>
            {b !== 0 && <>{b > 0 ? <span style={{ margin: '0 2px' }}>−</span> : <span style={{ margin: '0 2px' }}>+</span>}{Math.abs(b)}</>}
        </span>
    );
    return (
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem' }}>
            y = <Frac num={a} den={denomNode} />
            {c !== 0 && <>{c > 0 ? <span style={{ margin: '0 3px' }}>+</span> : <span style={{ margin: '0 3px' }}>−</span>}{Math.abs(c)}</>}
        </span>
    );
}

function FormulaExponencial({ k, base, c }) {
    const baseStr = Number.isInteger(base) ? base : <Frac num={1} den={Math.round(1 / base)} />;
    const signK = k < 0 ? '−' : '';
    const absK = Math.abs(k);
    return (
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem' }}>
            y = {signK}{absK !== 1 && absK}{absK !== 1 && '·'}{baseStr}<Sup><em>x</em></Sup>
            {c !== 0 && <>{c > 0 ? <span style={{ margin: '0 3px' }}>+</span> : <span style={{ margin: '0 3px' }}>−</span>}{Math.abs(c)}</>}
        </span>
    );
}

function FormulaLogaritmica({ k, base, c }) {
    const signK = k < 0 ? '−' : '';
    const absK = Math.abs(k);
    return (
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem' }}>
            y = {signK}{absK !== 1 && <>{absK}·</>}log<Sub>{base}</Sub>(<em>x</em>)
            {c !== 0 && <>{c > 0 ? <span style={{ margin: '0 3px' }}>+</span> : <span style={{ margin: '0 3px' }}>−</span>}{Math.abs(c)}</>}
        </span>
    );
}

// ─── GENERATORS ──────────────────────────────────────────────────────────────
const niceSlopeList = [-3, -2, -1, 1, 2, 3, -0.5, 0.5];
const niceSlope = () => niceSlopeList[Math.floor(Math.random() * niceSlopeList.length)];

const genLineal = () => ({ tipo: 'LINEAL', m: niceSlope(), n: rInt(-5, 5) });

const genCuadratica = () => {
    let a, b, c, vx, vy;
    do {
        a = [-2, -1, 1, 2][rInt(0, 3)];
        b = rInt(-4, 4);
        c = rInt(-3, 3);
        vx = -b / (2 * a);
        vy = c - (b * b) / (4 * a);
    } while (Math.abs(vx) > 5 || Math.abs(vy) > 6);
    const disc = b * b - 4 * a * c;
    let x1 = null, x2 = null;
    if (disc >= 0) {
        x1 = (-b - Math.sqrt(disc)) / (2 * a);
        x2 = (-b + Math.sqrt(disc)) / (2 * a);
        if (Math.abs(x1 - x2) < 0.01) x2 = null;
    }
    return { tipo: 'CUADRATICA', a, b, c, vx, vy, disc, x1, x2, yn: c };
};

const genInversa = () => ({
    tipo: 'INVERSA',
    a: [-3, -2, -1, 1, 2, 3][rInt(0, 5)],
    b: rInt(-3, 3),
    c: rInt(-3, 3),
});

const genExponencial = () => ({
    tipo: 'EXPONENCIAL',
    k: [-2, -1, 1, 2][rInt(0, 3)],
    base: [2, 3, 0.5][rInt(0, 2)],
    c: rInt(-2, 2),
});

const genLogaritmica = () => ({
    tipo: 'LOGARITMICA',
    k: [-1, 1][rInt(0, 1)],
    base: [2, 3, 10][rInt(0, 2)],
    c: rInt(-2, 2),
});

const GENERATORS = [genLineal, genCuadratica, genInversa, genExponencial, genLogaritmica];
const genRandom = () => GENERATORS[rInt(0, 4)]();

// ─── ELEMENTAL CANVAS ─────────────────────────────────────────────────────────
// showCurve: draw the function curve
// showAsymV: x-value of vertical asymptote to draw (or null)
// showAsymH: y-value of horizontal asymptote to draw (or null)
// confirmedPoints: orange dots from table values
// studentLinePoints: clicked points for LINEAL
// lineConfirmed: true = draw student line in green
function ElementalCanvas({
    fnData,
    confirmedPoints = [],
    studentLinePoints = [],
    showCurve = false,
    showAsymV = null,
    showAsymH = null,
    lineConfirmed = false,
}) {
    const canvasRef = useRef(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CS, CS);

        // background
        ctx.fillStyle = '#f8f9ff';
        ctx.fillRect(0, 0, CS, CS);

        // grid
        ctx.strokeStyle = '#dde1f5';
        ctx.lineWidth = 0.8;
        for (let i = -RANGE; i <= RANGE; i++) {
            const { x } = toC(i, 0);
            const { y } = toC(0, i);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CS); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CS, y); ctx.stroke();
        }

        // axes
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, OY); ctx.lineTo(CS, OY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OX, 0); ctx.lineTo(OX, CS); ctx.stroke();

        // arrows
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.moveTo(CS, OY); ctx.lineTo(CS - 8, OY - 5); ctx.lineTo(CS - 8, OY + 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(OX, 0); ctx.lineTo(OX - 5, 8); ctx.lineTo(OX + 5, 8); ctx.fill();

        // labels
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '10px Georgia, serif';
        ctx.textAlign = 'center';
        for (let i = -RANGE + 1; i <= RANGE - 1; i++) {
            if (i === 0) continue;
            const { x } = toC(i, 0);
            ctx.fillText(i, x, OY + 13);
        }
        ctx.textAlign = 'right';
        for (let i = -RANGE + 1; i <= RANGE - 1; i++) {
            if (i === 0) continue;
            const { y } = toC(0, i);
            ctx.fillText(i, OX - 4, y + 3);
        }
        ctx.textAlign = 'center';
        ctx.fillText('x', CS - 5, OY - 8);
        ctx.fillText('y', OX + 10, 8);
        ctx.fillText('0', OX - 9, OY + 12);

        if (!fnData) return;

        // ── Asymptotes (only when confirmed) ──
        const drawAsym = (x1, y1, x2, y2, color) => {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.setLineDash([]);
            // label
            ctx.restore();
        };

        if (showAsymV !== null) {
            const { x } = toC(showAsymV, 0);
            drawAsym(x, 0, x, CS, '#e74c3c');
            ctx.save();
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`x=${fmt(showAsymV)}`, x + 3, 14);
            ctx.restore();
        }
        if (showAsymH !== null) {
            const { y } = toC(0, showAsymH);
            drawAsym(0, y, CS, y, '#8e44ad');
            ctx.save();
            ctx.fillStyle = '#8e44ad';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`y=${fmt(showAsymH)}`, CS - 3, y - 4);
            ctx.restore();
        }

        // ── Function curve (only when showCurve) ──
        if (showCurve) {
            const getFnVal = (x) => {
                const { tipo, m, n, a, b, c, k, base } = fnData;
                if (tipo === 'LINEAL') return m * x + n;
                if (tipo === 'CUADRATICA') return a * x * x + b * x + c;
                if (tipo === 'INVERSA') {
                    const denom = x - b;
                    if (Math.abs(denom) < 0.02) return null;
                    return a / denom + c;
                }
                if (tipo === 'EXPONENCIAL') return k * Math.pow(base, x) + c;
                if (tipo === 'LOGARITMICA') {
                    if (x <= 0) return null;
                    return k * (Math.log(x) / Math.log(base)) + c;
                }
                return null;
            };

            ctx.save();
            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            let penDown = false;
            for (let i = 0; i <= 800; i++) {
                const mx = -RANGE + (i / 800) * (RANGE * 2);
                const my = getFnVal(mx);
                if (my === null || !isFinite(my) || my < -RANGE - 1 || my > RANGE + 1) {
                    penDown = false; continue;
                }
                const { x, y } = toC(mx, my);
                if (!penDown) { ctx.moveTo(x, y); penDown = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        }

        // ── Student line (LINEAL) ──
        if (fnData.tipo === 'LINEAL' && studentLinePoints.length === 2) {
            const [p1, p2] = studentLinePoints;
            const dx = p2.mx - p1.mx;
            if (dx !== 0) {
                const mS = (p2.my - p1.my) / dx;
                const nS = p1.my - mS * p1.mx;
                const ptsL = [];
                let yv = mS * (-RANGE) + nS;
                if (yv >= -RANGE && yv <= RANGE) ptsL.push(toC(-RANGE, yv));
                yv = mS * RANGE + nS;
                if (yv >= -RANGE && yv <= RANGE) ptsL.push(toC(RANGE, yv));
                if (mS !== 0) {
                    const xv = (-RANGE - nS) / mS;
                    if (xv >= -RANGE && xv <= RANGE) ptsL.push(toC(xv, -RANGE));
                    const xv2 = (RANGE - nS) / mS;
                    if (xv2 >= -RANGE && xv2 <= RANGE) ptsL.push(toC(xv2, RANGE));
                }
                if (ptsL.length >= 2) {
                    ctx.save();
                    ctx.strokeStyle = lineConfirmed ? '#27ae60' : '#e67e22';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(ptsL[0].x, ptsL[0].y);
                    ctx.lineTo(ptsL[1].x, ptsL[1].y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            studentLinePoints.forEach(({ mx, my }) => {
                const { x, y } = toC(mx, my);
                ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = lineConfirmed ? '#27ae60' : '#e67e22';
                ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
            });
        }

        // ── Confirmed table points ──
        confirmedPoints.forEach(({ mx, my }) => {
            if (!isFinite(mx) || !isFinite(my)) return;
            const { x, y } = toC(mx, my);
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#e67e22'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#c0392b';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`(${fmt(mx)}, ${fmt(my)})`, x + 7, y - 4);
        });

    }, [fnData, confirmedPoints, studentLinePoints, showCurve, showAsymV, showAsymH, lineConfirmed]);

    useEffect(() => { draw(); }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            width={CS}
            height={CS}
            style={{ borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'block', maxWidth: '100%' }}
        />
    );
}

// ─── CANVAS WRAPPER: hidden until reveal ──────────────────────────────────────
function CanvasReveal({ revealed, children, onClick }) {
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {children}
            {!revealed && (
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 10,
                    background: 'rgba(44,62,80,0.85)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: 'white', gap: 10, cursor: 'default',
                }}>
                    <Eye size={32} style={{ opacity: 0.6 }} />
                    <div style={{ fontSize: '0.82rem', textAlign: 'center', padding: '0 16px', opacity: 0.85 }}>
                        Completa todas las secciones<br />para ver la gráfica
                    </div>
                </div>
            )}
            {revealed && onClick && (
                <div onClick={onClick} style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} />
            )}
        </div>
    );
}

// ─── VERTICAL TABLE ───────────────────────────────────────────────────────────
function TablaVertical({ xVals, correctVals, onConfirm, xLabels }) {
    const [inputs, setInputs] = useState(() => xVals.map(() => ''));
    const [states, setStates] = useState(() => xVals.map(() => null));

    const check = (i) => {
        const val = parseAns(inputs[i]);
        const correct = correctVals[i];
        const ok = approxEq(val, correct);
        setStates(prev => { const n = [...prev]; n[i] = ok ? 'ok' : 'err'; return n; });
        if (ok) onConfirm(i, correct);
    };

    return (
        <table style={{ borderCollapse: 'collapse', margin: '0 auto', fontSize: '0.9rem' }}>
            <thead>
                <tr>
                    <th style={thSt}>x</th>
                    <th style={thSt}>y</th>
                </tr>
            </thead>
            <tbody>
                {xVals.map((xv, i) => (
                    <tr key={i}>
                        <td style={tdSt}>{xLabels ? xLabels[i] : fmt(xv)}</td>
                        <td style={{ ...tdSt, padding: '3px 6px' }}>
                            {states[i] === 'ok' ? (
                                <span style={{ color: '#27ae60', fontWeight: 700 }}>✓ {fmt(correctVals[i])}</span>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input
                                        value={inputs[i]}
                                        onChange={e => { const v = [...inputs]; v[i] = e.target.value; setInputs(v); }}
                                        onBlur={() => inputs[i] !== '' && check(i)}
                                        onKeyDown={e => e.key === 'Enter' && check(i)}
                                        style={{
                                            width: 65, padding: '4px 6px', borderRadius: 6, textAlign: 'center',
                                            border: `1.5px solid ${states[i] === 'err' ? '#e74c3c' : '#c0c8e8'}`,
                                            background: states[i] === 'err' ? '#fef0f0' : 'white',
                                            fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none',
                                        }}
                                        placeholder="?"
                                    />
                                    {states[i] === 'err' && <span style={{ color: '#e74c3c', fontSize: '0.78rem' }}>({fmt(correctVals[i])})</span>}
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const thSt = { padding: '5px 14px', background: '#2c3e50', color: 'white', textAlign: 'center', fontWeight: 700 };
const tdSt = { padding: '4px 14px', borderBottom: '1px solid #e0e4f0', textAlign: 'center' };

// ─── BARRA DE PUNTUACIÓN ──────────────────────────────────────────────────────
function PuntajeBar({ earned, max }) {
    const pct = max === 0 ? 0 : Math.round((earned / max) * 100);
    const color = pct >= 80 ? '#27ae60' : pct >= 50 ? '#e67e22' : '#e74c3c';
    return (
        <div style={{ margin: '8px 0' }}>
            <div style={{ background: '#e0e4f0', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.4s', borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: '0.78rem', color, fontWeight: 700, marginTop: 2, textAlign: 'right' }}>{earned}/{max} pts — {pct}%</div>
        </div>
    );
}

// ─── MODAL ENVIAR AL PROFESOR ─────────────────────────────────────────────────
function ModalEnviarProfe({ porcentaje, tipoFuncion, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'FUNCIONES', modalidad: tipoFuncion || 'Elementales', fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), correcto: porcentaje >= 70, porcentaje, tipoEjercicio: tipoFuncion, puntos: porcentaje }],
            });
            guardarRegistroLocal('FUNCIONES', {
                titulo: 'Funciones', aciertos: porcentaje, intentos: 100, porcentaje,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e0e4f0', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(8,12,24,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 360, padding: '24px 26px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.05rem' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <CheckCircle size={44} color="#27ae60" style={{ marginBottom: 8 }} />
                        <div style={{ color: '#27ae60', fontWeight: 700 }}>¡Enviado!</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: porcentaje >= 70 ? '#27ae60' : '#e67e22', marginTop: 6 }}>{porcentaje}%</div>
                        <button onClick={onClose} style={{ marginTop: 10, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#f0f0f0', cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={{ fontSize: '0.78rem', color: '#7f8c8d', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre</label>
                            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#7f8c8d', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
                            <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#7f8c8d', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
                            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#95a5a6' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Send size={14} />{enviando ? 'Enviando…' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── SHARED LAYOUT ───────────────────────────────────────────────────────────
function EjercicioLayout({ titulo, formulaNode, canvas, panel, ptsBar }) {
    return (
        <div style={{ background: 'white', borderRadius: 18, padding: '20px 18px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 820, margin: '0 auto' }}>
            <div style={{ background: '#2c3e50', color: 'white', borderRadius: 12, padding: '14px 18px', marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6, opacity: 0.8 }}>{titulo}</div>
                <div style={{ fontSize: '1.2rem', lineHeight: 1.6 }}>{formulaNode}</div>
            </div>
            {ptsBar}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
                {canvas}
                <div style={{ flex: '1 1 260px', minWidth: 220 }}>{panel}</div>
            </div>
        </div>
    );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────
function SeccionCard({ titulo, children, pts, maxPts, done }) {
    return (
        <div style={{ background: done ? '#f0faf4' : '#f8f9ff', border: `1.5px solid ${done ? '#27ae60' : '#e0e4f0'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#2c3e50' }}>{done ? '✅ ' : ''}{titulo}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: done ? '#27ae60' : '#7f8c8d' }}>{pts}/{maxPts} pts</div>
            </div>
            {children}
        </div>
    );
}

function SelectorBtn({ options, value, onChange, disabled }) {
    return (
        <div style={{ display: 'flex', gap: 7 }}>
            {options.map(opt => (
                <button key={opt.value} onClick={() => !disabled && onChange(opt.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: `2px solid ${value === opt.value ? opt.color : '#e0e4f0'}`, background: value === opt.value ? opt.color : 'white', color: value === opt.value ? 'white' : '#555', cursor: disabled ? 'default' : 'pointer', fontWeight: value === opt.value ? 700 : 400, fontSize: '0.85rem', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function InputAsintota({ label, value, onChange, correct, checked, onCheck }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 100, fontFamily: 'Georgia, serif' }}>{label} =</label>
            {checked ? (
                <span style={{ color: '#27ae60', fontWeight: 700 }}>✓ {fmt(correct)}</span>
            ) : (
                <>
                    <input value={value} onChange={e => onChange(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onCheck()}
                        style={{ width: 65, padding: '5px 8px', borderRadius: 7, border: '1.5px solid #c0c8e8', fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', textAlign: 'center' }}
                        placeholder="?" />
                    <button onClick={onCheck} style={smallBtnSt}>✓</button>
                </>
            )}
        </div>
    );
}

function ActionRow({ allDone, onComprobar, onNuevo, onVolver, onEnviar, pct }) {
    return (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {!allDone && onComprobar && (
                <button onClick={onComprobar} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#27ae60', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CheckCircle size={15} /> Comprobar
                </button>
            )}
            {allDone && (
                <button onClick={onEnviar} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#2980b9', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Send size={14} /> Enviar al profe ({pct}%)
                </button>
            )}
            <button onClick={onNuevo} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}><RefreshCw size={14} /></button>
            <button onClick={onVolver} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}><ArrowLeft size={14} /></button>
        </div>
    );
}

const smallBtnSt = { padding: '4px 10px', borderRadius: 7, border: '1px solid #c0c8e8', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' };

// ─── EJERCICIO LINEAL ─────────────────────────────────────────────────────────
// Canvas always visible (student draws). Curve reveals when all correct.
function EjercicioLinealWrapper({ fnData, onNuevo, onVolver }) {
    const [ansM, setAnsM] = useState('');
    const [ansN, setAnsN] = useState('');
    const [mOk, setMOk] = useState(false);
    const [nOk, setNOk] = useState(false);
    const [studentPts, setStudentPts] = useState([]);
    const [lineaOk, setLineaOk] = useState(false);
    const [checked, setChecked] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const pts = (mOk ? 1 : 0) + (nOk ? 1 : 0) + (lineaOk ? 1 : 0);
    const maxPts = 3;
    const allDone = mOk && nOk && lineaOk;
    const pct = Math.round((pts / maxPts) * 100);

    const comprobar = () => {
        const newMOk = approxEq(parseAns(ansM), fnData.m, 0.1);
        const newNOk = approxEq(parseAns(ansN), fnData.n, 0.1);
        setMOk(newMOk);
        setNOk(newNOk);
        let newLineaOk = false;
        if (studentPts.length === 2) {
            const [p1, p2] = studentPts;
            const dx = p2.mx - p1.mx;
            if (dx !== 0) {
                const mS = (p2.my - p1.my) / dx;
                const nS = p1.my - mS * p1.mx;
                newLineaOk = approxEq(mS, fnData.m, 0.15) && approxEq(nS, fnData.n, 0.4);
            }
        }
        setLineaOk(newLineaOk);
        setChecked(true);
    };

    const handleCanvasClick = (e) => {
        if (lineaOk) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (CS / rect.width);
        const cy = (e.clientY - rect.top) * (CS / rect.height);
        const { x: mx, y: my } = toM(cx, cy);
        const snX = Math.round(mx), snY = Math.round(my);
        if (Math.abs(snX) <= RANGE && Math.abs(snY) <= RANGE)
            setStudentPts(prev => prev.length >= 2 ? [{ mx: snX, my: snY }] : [...prev, { mx: snX, my: snY }]);
    };

    return (
        <>
            <EjercicioLayout
                titulo="Función Lineal"
                formulaNode={<FormulaLineal m={fnData.m} n={fnData.n} />}
                ptsBar={<PuntajeBar earned={pts} max={maxPts} />}
                canvas={
                    <div style={{ position: 'relative' }}>
                        <ElementalCanvas
                            fnData={fnData}
                            studentLinePoints={studentPts}
                            showCurve={false}
                            lineConfirmed={lineaOk}
                        />
                        {/* click overlay only on the canvas itself */}
                        <div onClick={handleCanvasClick}
                            style={{ position: 'absolute', inset: 0, cursor: lineaOk ? 'default' : 'crosshair' }} />
                        {!lineaOk && (
                            <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(44,62,80,0.7)', color: 'white', padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                                {studentPts.length === 0 ? 'Clic: 1.er punto' : studentPts.length === 1 ? 'Clic: 2.º punto' : 'Clic para reiniciar'}
                            </div>
                        )}
                    </div>
                }
                panel={
                    <div>
                        <SeccionCard titulo="1. Pendiente e intercepto" pts={(mOk ? 1 : 0) + (nOk ? 1 : 0)} maxPts={2} done={mOk && nOk}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 100, fontFamily: 'Georgia, serif' }}>Pendiente <em>m</em> =</label>
                                {mOk ? <span style={{ color: '#27ae60', fontWeight: 700 }}>✓ <CoefNode v={fnData.m} />{fnData.m < 0 ? ' (negativa)' : ''}</span> :
                                    <input value={ansM} onChange={e => setAnsM(e.target.value)}
                                        style={{ width: 70, padding: '5px 8px', borderRadius: 7, border: `1.5px solid ${checked && !mOk ? '#e74c3c' : '#c0c8e8'}`, fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', textAlign: 'center' }} placeholder="ej: 2" />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 100, fontFamily: 'Georgia, serif' }}>Ordenada <em>n</em> =</label>
                                {nOk ? <span style={{ color: '#27ae60', fontWeight: 700 }}>✓ {fmt(fnData.n)}</span> :
                                    <input value={ansN} onChange={e => setAnsN(e.target.value)}
                                        style={{ width: 70, padding: '5px 8px', borderRadius: 7, border: `1.5px solid ${checked && !nOk ? '#e74c3c' : '#c0c8e8'}`, fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', textAlign: 'center' }} placeholder="ej: -3" />}
                            </div>
                        </SeccionCard>

                        <SeccionCard titulo="2. Dibuja la recta (2 puntos)" pts={lineaOk ? 1 : 0} maxPts={1} done={lineaOk}>
                            {lineaOk
                                ? <span style={{ color: '#27ae60', fontWeight: 700, fontSize: '0.85rem' }}>✓ Recta correcta</span>
                                : <span style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>Marca 2 puntos en el gráfico</span>}
                            {studentPts.length > 0 && !lineaOk && (
                                <button onClick={() => setStudentPts([])} style={{ marginLeft: 8, ...smallBtnSt }}>↺ Borrar</button>
                            )}
                        </SeccionCard>

                        <ActionRow allDone={allDone} onComprobar={comprobar} onNuevo={onNuevo} onVolver={onVolver} onEnviar={() => setMostrarEnvio(true)} pct={pct} />

                        {checked && !allDone && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 9, background: '#fef0f0', border: '1px solid #e74c3c', fontSize: '0.82rem', color: '#555' }}>
                                {!mOk && <div>✗ Pendiente incorrecta (correcta: {fmt(fnData.m)})</div>}
                                {!nOk && <div>✗ Ordenada incorrecta (correcta: {fmt(fnData.n)})</div>}
                                {!lineaOk && studentPts.length < 2 && <div>✗ Necesitas 2 puntos en el gráfico</div>}
                                {!lineaOk && studentPts.length === 2 && <div>✗ La recta dibujada no coincide</div>}
                            </div>
                        )}
                    </div>
                }
            />
            {mostrarEnvio && <ModalEnviarProfe porcentaje={pct} tipoFuncion="Lineal" onClose={() => setMostrarEnvio(false)} />}
        </>
    );
}

// ─── EJERCICIO CUADRÁTICA ─────────────────────────────────────────────────────
function EjercicioCuadratica({ fnData, onNuevo, onVolver }) {
    const { a, b, c, vx, vy, disc, x1, x2, yn } = fnData;
    const correctForma = a > 0 ? 'cóncava' : 'convexa';
    const noRealRoots = disc < 0;
    const oneRoot = !noRealRoots && x2 === null;

    const [formaOk, setFormaOk] = useState(false);
    const [vxOk, setVxOk] = useState(false);
    const [vyOk, setVyOk] = useState(false);
    const [x1Ok, setX1Ok] = useState(false);
    const [x2Ok, setX2Ok] = useState(false);
    const [ynOk, setYnOk] = useState(false);
    const [ansVx, setAnsVx] = useState('');
    const [ansVy, setAnsVy] = useState('');
    const [ansX1, setAnsX1] = useState('');
    const [ansX2, setAnsX2] = useState('');
    const [ansYn, setAnsYn] = useState('');
    const [checked, setChecked] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const rootCount = noRealRoots ? 0 : (oneRoot ? 1 : 2);
    const maxPts = 3 + rootCount + 1; // forma+vx+vy + roots + yn
    const pts = (formaOk ? 1 : 0) + (vxOk ? 1 : 0) + (vyOk ? 1 : 0) +
        (!noRealRoots ? (x1Ok ? 1 : 0) + (x2Ok ? 1 : 0) : 0) + (ynOk ? 1 : 0);
    const allDone = pts === maxPts;
    const pct = Math.round((pts / maxPts) * 100);

    const comprobar = () => {
        setVxOk(approxEq(parseAns(ansVx), vx, 0.15));
        setVyOk(approxEq(parseAns(ansVy), vy, 0.15));
        if (!noRealRoots) {
            const v1 = parseAns(ansX1), v2 = parseAns(ansX2);
            const roots = [x1, x2 !== null ? x2 : x1].sort((a, b) => a - b);
            setX1Ok(approxEq(v1, roots[0], 0.2));
            setX2Ok(oneRoot ? approxEq(v2, roots[0], 0.2) : approxEq(v2, roots[1], 0.2));
        }
        setYnOk(approxEq(parseAns(ansYn), yn, 0.1));
        setChecked(true);
    };

    const confirmedPoints = [];
    if (vxOk && vyOk) confirmedPoints.push({ mx: vx, my: vy });
    if (x1Ok && x1 !== null) confirmedPoints.push({ mx: x1, my: 0 });
    if (x2Ok && x2 !== null) confirmedPoints.push({ mx: x2, my: 0 });
    if (ynOk) confirmedPoints.push({ mx: 0, my: yn });

    const inp = (val, setVal, ok, correct) => ok
        ? <span style={{ color: '#27ae60', fontWeight: 700 }}>✓ {fmt(correct)}</span>
        : <input value={val} onChange={e => setVal(e.target.value)}
            style={{ width: 70, padding: '5px 8px', borderRadius: 7, border: `1.5px solid ${checked && !ok ? '#e74c3c' : '#c0c8e8'}`, fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', textAlign: 'center' }}
            placeholder="?" />;

    return (
        <>
            <EjercicioLayout
                titulo="Función Cuadrática"
                formulaNode={<FormulaCuadratica a={a} b={b} c={c} />}
                ptsBar={<PuntajeBar earned={pts} max={maxPts} />}
                canvas={
                    <CanvasReveal revealed={allDone}>
                        <ElementalCanvas fnData={fnData} confirmedPoints={confirmedPoints} showCurve={allDone} />
                    </CanvasReveal>
                }
                panel={
                    <div>
                        <SeccionCard titulo="1. Forma de la parábola" pts={formaOk ? 1 : 0} maxPts={1} done={formaOk}>
                            <SelectorBtn
                                options={[{ value: 'cóncava', label: '⋂ Cóncava', color: '#3498db' }, { value: 'convexa', label: '⋃ Convexa', color: '#e67e22' }]}
                                value={formaOk ? correctForma : ''}
                                onChange={v => { if (v === correctForma) setFormaOk(true); }}
                                disabled={formaOk}
                            />
                        </SeccionCard>

                        <SeccionCard titulo="2. Vértice" pts={(vxOk ? 1 : 0) + (vyOk ? 1 : 0)} maxPts={2} done={vxOk && vyOk}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 60, fontFamily: 'Georgia, serif' }}><em>x</em><Sub>v</Sub> =</label>
                                {inp(ansVx, setAnsVx, vxOk, vx)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 60, fontFamily: 'Georgia, serif' }}><em>y</em><Sub>v</Sub> =</label>
                                {inp(ansVy, setAnsVy, vyOk, vy)}
                            </div>
                        </SeccionCard>

                        {!noRealRoots && (
                            <SeccionCard titulo={`3. Cortes eje X${oneRoot ? ' (raíz doble)' : ''}`} pts={(x1Ok ? 1 : 0) + (x2Ok ? 1 : 0)} maxPts={oneRoot ? 1 : 2} done={x1Ok && (oneRoot || x2Ok)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 60, fontFamily: 'Georgia, serif' }}><em>x</em><Sub>1</Sub> =</label>
                                    {inp(ansX1, setAnsX1, x1Ok, Math.min(x1 ?? 0, x2 ?? x1 ?? 0))}
                                </div>
                                {!oneRoot && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 60, fontFamily: 'Georgia, serif' }}><em>x</em><Sub>2</Sub> =</label>
                                        {inp(ansX2, setAnsX2, x2Ok, Math.max(x1 ?? 0, x2 ?? 0))}
                                    </div>
                                )}
                            </SeccionCard>
                        )}

                        <SeccionCard titulo={`${noRealRoots ? '3' : oneRoot ? '4' : '4'}. Corte eje Y`} pts={ynOk ? 1 : 0} maxPts={1} done={ynOk}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: '0.85rem', color: '#555', minWidth: 60, fontFamily: 'Georgia, serif' }}><em>y</em>(0) =</label>
                                {inp(ansYn, setAnsYn, ynOk, yn)}
                            </div>
                        </SeccionCard>

                        <ActionRow allDone={allDone} onComprobar={comprobar} onNuevo={onNuevo} onVolver={onVolver} onEnviar={() => setMostrarEnvio(true)} pct={pct} />
                    </div>
                }
            />
            {mostrarEnvio && <ModalEnviarProfe porcentaje={pct} tipoFuncion="Cuadrática" onClose={() => setMostrarEnvio(false)} />}
        </>
    );
}

// ─── EJERCICIO PROPORCIONALIDAD INVERSA ───────────────────────────────────────
function EjercicioInversa({ fnData, onNuevo, onVolver }) {
    const { a, b, c } = fnData;
    const correctCuadrante = a > 0 ? '1-3' : '2-4';

    const [cuadranteOk, setCuadranteOk] = useState(false);
    const [asVOk, setAsVOk] = useState(false);
    const [asHOk, setAsHOk] = useState(false);
    const [confirmedPts, setConfirmedPts] = useState([]);
    const [ansAsV, setAnsAsV] = useState('');
    const [ansAsH, setAnsAsH] = useState('');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const xVals = [b - 2, b - 1, b + 1, b + 2];
    const yVals = xVals.map(x => a / (x - b) + c);
    const tablePts = confirmedPts.length;

    const pts = (cuadranteOk ? 1 : 0) + (asVOk ? 1 : 0) + (asHOk ? 1 : 0) + tablePts;
    const maxPts = 7;
    const allDone = pts === maxPts;
    const pct = Math.round((pts / maxPts) * 100);

    const handleConfirm = (i, yv) => {
        setConfirmedPts(prev => prev.some(p => approxEq(p.mx, xVals[i])) ? prev : [...prev, { mx: xVals[i], my: yv }]);
    };

    const xLabels = xVals.map(x => {
        if (x === b - 2) return `${b}−2`;
        if (x === b - 1) return `${b}−1`;
        if (x === b + 1) return `${b}+1`;
        if (x === b + 2) return `${b}+2`;
        return fmt(x);
    });

    return (
        <>
            <EjercicioLayout
                titulo="Proporcionalidad Inversa"
                formulaNode={<FormulaInversa a={a} b={b} c={c} />}
                ptsBar={<PuntajeBar earned={pts} max={maxPts} />}
                canvas={
                    <CanvasReveal revealed={allDone}>
                        <ElementalCanvas
                            fnData={fnData}
                            confirmedPoints={confirmedPts}
                            showCurve={allDone}
                            showAsymV={asVOk ? b : null}
                            showAsymH={asHOk ? c : null}
                        />
                    </CanvasReveal>
                }
                panel={
                    <div>
                        <SeccionCard titulo="1. Cuadrantes" pts={cuadranteOk ? 1 : 0} maxPts={1} done={cuadranteOk}>
                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: 6 }}>¿En qué cuadrantes se sitúa la hipérbola?</div>
                            <SelectorBtn
                                options={[{ value: '1-3', label: '1.º y 3.º', color: '#27ae60' }, { value: '2-4', label: '2.º y 4.º', color: '#e74c3c' }]}
                                value={cuadranteOk ? correctCuadrante : ''}
                                onChange={v => { if (v === correctCuadrante) setCuadranteOk(true); }}
                                disabled={cuadranteOk}
                            />
                        </SeccionCard>

                        <SeccionCard titulo="2. Asíntotas" pts={(asVOk ? 1 : 0) + (asHOk ? 1 : 0)} maxPts={2} done={asVOk && asHOk}>
                            <InputAsintota label="Asíntota vertical x" value={ansAsV} onChange={setAnsAsV} correct={b} checked={asVOk}
                                onCheck={() => { if (approxEq(parseAns(ansAsV), b, 0.1)) setAsVOk(true); }} />
                            <InputAsintota label="Asíntota horizontal y" value={ansAsH} onChange={setAnsAsH} correct={c} checked={asHOk}
                                onCheck={() => { if (approxEq(parseAns(ansAsH), c, 0.1)) setAsHOk(true); }} />
                        </SeccionCard>

                        <SeccionCard titulo="3. Tabla de valores" pts={tablePts} maxPts={4} done={tablePts === 4}>
                            <TablaVertical xVals={xVals} correctVals={yVals} onConfirm={handleConfirm} xLabels={xLabels} />
                        </SeccionCard>

                        <ActionRow allDone={allDone} onNuevo={onNuevo} onVolver={onVolver} onEnviar={() => setMostrarEnvio(true)} pct={pct} />
                    </div>
                }
            />
            {mostrarEnvio && <ModalEnviarProfe porcentaje={pct} tipoFuncion="Proporcionalidad Inversa" onClose={() => setMostrarEnvio(false)} />}
        </>
    );
}

// ─── EJERCICIO EXPONENCIAL ────────────────────────────────────────────────────
function EjercicioExponencial({ fnData, onNuevo, onVolver }) {
    const { k, base, c } = fnData;
    const correctCrec = (k * Math.log(base)) > 0 ? 'creciente' : 'decreciente';

    const [crecOk, setCrecOk] = useState(false);
    const [asHOk, setAsHOk] = useState(false);
    const [confirmedPts, setConfirmedPts] = useState([]);
    const [ansAsH, setAnsAsH] = useState('');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const xVals = [-2, -1, 0, 1, 2];
    const yVals = xVals.map(x => k * Math.pow(base, x) + c);
    const tablePts = confirmedPts.length;

    const pts = (crecOk ? 1 : 0) + (asHOk ? 1 : 0) + tablePts;
    const maxPts = 7;
    const allDone = pts === maxPts;
    const pct = Math.round((pts / maxPts) * 100);

    const handleConfirm = (i, yv) => {
        setConfirmedPts(prev => prev.some(p => approxEq(p.mx, xVals[i])) ? prev : [...prev, { mx: xVals[i], my: yv }]);
    };

    return (
        <>
            <EjercicioLayout
                titulo="Función Exponencial"
                formulaNode={<FormulaExponencial k={k} base={base} c={c} />}
                ptsBar={<PuntajeBar earned={pts} max={maxPts} />}
                canvas={
                    <CanvasReveal revealed={allDone}>
                        <ElementalCanvas
                            fnData={fnData}
                            confirmedPoints={confirmedPts}
                            showCurve={allDone}
                            showAsymH={asHOk ? c : null}
                        />
                    </CanvasReveal>
                }
                panel={
                    <div>
                        <SeccionCard titulo="1. Tipo de función" pts={crecOk ? 1 : 0} maxPts={1} done={crecOk}>
                            <SelectorBtn
                                options={[{ value: 'creciente', label: '↗ Creciente', color: '#27ae60' }, { value: 'decreciente', label: '↘ Decreciente', color: '#e74c3c' }]}
                                value={crecOk ? correctCrec : ''}
                                onChange={v => { if (v === correctCrec) setCrecOk(true); }}
                                disabled={crecOk}
                            />
                        </SeccionCard>

                        <SeccionCard titulo="2. Asíntota horizontal" pts={asHOk ? 1 : 0} maxPts={1} done={asHOk}>
                            <InputAsintota label="y" value={ansAsH} onChange={setAnsAsH} correct={c} checked={asHOk}
                                onCheck={() => { if (approxEq(parseAns(ansAsH), c, 0.1)) setAsHOk(true); }} />
                        </SeccionCard>

                        <SeccionCard titulo="3. Tabla (x: −2, −1, 0, 1, 2)" pts={tablePts} maxPts={5} done={tablePts === 5}>
                            <TablaVertical xVals={xVals} correctVals={yVals} onConfirm={handleConfirm} />
                        </SeccionCard>

                        <ActionRow allDone={allDone} onNuevo={onNuevo} onVolver={onVolver} onEnviar={() => setMostrarEnvio(true)} pct={pct} />
                    </div>
                }
            />
            {mostrarEnvio && <ModalEnviarProfe porcentaje={pct} tipoFuncion="Exponencial" onClose={() => setMostrarEnvio(false)} />}
        </>
    );
}

// ─── EJERCICIO LOGARÍTMICA ────────────────────────────────────────────────────
function EjercicioLogaritmica({ fnData, onNuevo, onVolver }) {
    const { k, base, c } = fnData;
    const correctCrec = k > 0 ? 'creciente' : 'decreciente';

    const [crecOk, setCrecOk] = useState(false);
    const [asVOk, setAsVOk] = useState(false);
    const [confirmedPts, setConfirmedPts] = useState([]);
    const [ansAsV, setAnsAsV] = useState('');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const xVals = [1, base, base * base, 1 / base];
    const yVals = xVals.map(x => k * (Math.log(x) / Math.log(base)) + c);
    const tablePts = confirmedPts.length;

    const pts = (crecOk ? 1 : 0) + (asVOk ? 1 : 0) + tablePts;
    const maxPts = 6;
    const allDone = pts === maxPts;
    const pct = Math.round((pts / maxPts) * 100);

    const handleConfirm = (i, yv) => {
        setConfirmedPts(prev => prev.some(p => approxEq(p.mx, xVals[i])) ? prev : [...prev, { mx: xVals[i], my: yv }]);
    };

    const baseStr = String(base);
    const xLabels = ['1', baseStr, `${baseStr}²`, `1/${baseStr}`];

    return (
        <>
            <EjercicioLayout
                titulo="Función Logarítmica"
                formulaNode={<FormulaLogaritmica k={k} base={base} c={c} />}
                ptsBar={<PuntajeBar earned={pts} max={maxPts} />}
                canvas={
                    <CanvasReveal revealed={allDone}>
                        <ElementalCanvas
                            fnData={fnData}
                            confirmedPoints={confirmedPts}
                            showCurve={allDone}
                            showAsymV={asVOk ? 0 : null}
                        />
                    </CanvasReveal>
                }
                panel={
                    <div>
                        <SeccionCard titulo="1. Tipo de función" pts={crecOk ? 1 : 0} maxPts={1} done={crecOk}>
                            <SelectorBtn
                                options={[{ value: 'creciente', label: '↗ Creciente', color: '#27ae60' }, { value: 'decreciente', label: '↘ Decreciente', color: '#e74c3c' }]}
                                value={crecOk ? correctCrec : ''}
                                onChange={v => { if (v === correctCrec) setCrecOk(true); }}
                                disabled={crecOk}
                            />
                        </SeccionCard>

                        <SeccionCard titulo="2. Asíntota vertical" pts={asVOk ? 1 : 0} maxPts={1} done={asVOk}>
                            <InputAsintota label="x" value={ansAsV} onChange={setAnsAsV} correct={0} checked={asVOk}
                                onCheck={() => { if (approxEq(parseAns(ansAsV), 0, 0.1)) setAsVOk(true); }} />
                        </SeccionCard>

                        <SeccionCard titulo={`3. Tabla (x: 1, ${baseStr}, ${baseStr}², 1/${baseStr})`} pts={tablePts} maxPts={4} done={tablePts === 4}>
                            <TablaVertical xVals={xVals} correctVals={yVals} onConfirm={handleConfirm} xLabels={xLabels} />
                        </SeccionCard>

                        <ActionRow allDone={allDone} onNuevo={onNuevo} onVolver={onVolver} onEnviar={() => setMostrarEnvio(true)} pct={pct} />
                    </div>
                }
            />
            {mostrarEnvio && <ModalEnviarProfe porcentaje={pct} tipoFuncion="Logarítmica" onClose={() => setMostrarEnvio(false)} />}
        </>
    );
}

// ─── SELECTOR DE TIPO ─────────────────────────────────────────────────────────
const TIPOS = [
    { id: 'LINEAL',      label: 'Lineal',            icon: '📏', desc: 'y = mx + n',          color: '#3498db' },
    { id: 'CUADRATICA',  label: 'Cuadrática',         icon: '🔶', desc: 'y = ax² + bx + c',    color: '#e67e22' },
    { id: 'INVERSA',     label: 'Prop. Inversa',      icon: '🔀', desc: 'y = a/(x−b) + c',     color: '#9b59b6' },
    { id: 'EXPONENCIAL', label: 'Exponencial',        icon: '📈', desc: 'y = k·aˣ + c',        color: '#27ae60' },
    { id: 'LOGARITMICA', label: 'Logarítmica',        icon: '📉', desc: 'y = k·logₐ(x) + c',  color: '#e74c3c' },
    { id: 'ALEATORIA',   label: 'Aleatoria',          icon: '🎲', desc: 'Tipo aleatorio',       color: '#2c3e50' },
];

function SelectorTipoElemental({ onSelect, onBack }) {
    return (
        <div style={{ maxWidth: 480, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px' }}>← Volver</button>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Tipo de función</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TIPOS.map(t => (
                    <button key={t.id} onClick={() => onSelect(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.07)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.18s' }}
                        onMouseOver={e => e.currentTarget.style.background = `${t.color}33`}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
                        <span style={{ fontSize: '1.6rem' }}>{t.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t.label}</div>
                            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'Georgia, serif' }}>{t.desc}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem' }}>›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function RepresentacionElementales({ onExit }) {
    const [seccion, setSeccion] = useState(null);
    const [fnData, setFnData] = useState(null);

    const genForTipo = (tipo) => {
        if (tipo === 'LINEAL') return genLineal();
        if (tipo === 'CUADRATICA') return genCuadratica();
        if (tipo === 'INVERSA') return genInversa();
        if (tipo === 'EXPONENCIAL') return genExponencial();
        if (tipo === 'LOGARITMICA') return genLogaritmica();
        return genRandom();
    };

    const handleSelect = (tipo) => {
        setFnData(genForTipo(tipo));
        setSeccion(tipo);
    };

    const handleNuevo = () => setFnData(genForTipo(seccion));
    const handleVolver = () => { setSeccion(null); setFnData(null); };

    if (!seccion) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, fontFamily: "'Segoe UI', sans-serif" }}>
                <SelectorTipoElemental onSelect={handleSelect} onBack={onExit} />
            </div>
        );
    }

    const efectivoTipo = seccion === 'ALEATORIA' ? fnData?.tipo : seccion;

    return (
        <div style={{ minHeight: '100vh', background: '#f0f3fb', padding: '16px 10px', fontFamily: "'Segoe UI', sans-serif" }}>
            {efectivoTipo === 'LINEAL'      && fnData && <EjercicioLinealWrapper fnData={fnData} onNuevo={handleNuevo} onVolver={handleVolver} />}
            {efectivoTipo === 'CUADRATICA'  && fnData && <EjercicioCuadratica   fnData={fnData} onNuevo={handleNuevo} onVolver={handleVolver} />}
            {efectivoTipo === 'INVERSA'     && fnData && <EjercicioInversa      fnData={fnData} onNuevo={handleNuevo} onVolver={handleVolver} />}
            {efectivoTipo === 'EXPONENCIAL' && fnData && <EjercicioExponencial  fnData={fnData} onNuevo={handleNuevo} onVolver={handleVolver} />}
            {efectivoTipo === 'LOGARITMICA' && fnData && <EjercicioLogaritmica  fnData={fnData} onNuevo={handleNuevo} onVolver={handleVolver} />}
        </div>
    );
}
