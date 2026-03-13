import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, TrendingUp, BarChart2 } from 'lucide-react';
import Confetti from 'react-confetti';

// ─── CONSTANTES DEL CANVAS ────────────────────────────────────────────────────
const CS = 420;            // tamaño canvas px
const RANGE = 7;           // ejes de -7 a 7
const SCALE = CS / (RANGE * 2);   // px por unidad  (30px)
const OX = CS / 2;         // origen x (210)
const OY = CS / 2;         // origen y (210)

const toCanvas = (mx, my) => ({ x: OX + mx * SCALE, y: OY - my * SCALE });
const toMath   = (cx, cy) => ({ x: (cx - OX) / SCALE, y: (OY - cy) / SCALE });

// ─── HELPERS MATEMÁTICOS ──────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// genera pendiente "bonita": entero ∈ {-3..3}\{0} o ±½
const niceSlopeList = [-3,-2,-1,1,2,3,-0.5,0.5,-1.5,1.5,-2.5,2.5];
const niceSlope = () => niceSlopeList[Math.floor(Math.random() * niceSlopeList.length)];

// fracción simplificada como string
const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
const fmtFrac = (num, den = 1) => {
    if (den === 0) return '∞';
    const sign = (num * den < 0) ? '-' : '';
    const n = Math.abs(num), d = Math.abs(den);
    const g = gcd(n, d);
    const sn = n / g, sd = d / g;
    if (sd === 1) return `${sign}${sn}`;
    return (
        <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', verticalAlign:'middle', lineHeight:1, margin:'0 3px' }}>
            <span style={{ borderBottom:'1.5px solid currentColor', padding:'0 3px', fontSize:'0.85em' }}>{sign}{sn}</span>
            <span style={{ padding:'0 3px', fontSize:'0.85em' }}>{sd}</span>
        </span>
    );
};

// convierte número decimal a string de fracción si es necesario
const numStr = (v) => {
    if (Number.isInteger(v)) return `${v}`;
    // mitades o cuartos
    const den = [2,4,8].find(d => Number.isInteger(v * d));
    if (den) { const num = v * den; const g = gcd(Math.abs(num), den); return `${num/g}/${den/g}`; }
    return v.toFixed(2);
};

// parsea respuesta del alumno: acepta "1/2", "-3", "0.5"
const parseAnswer = (s) => {
    if (!s) return NaN;
    const t = String(s).trim().replace(',', '.');
    if (t.includes('/')) {
        const [n, d] = t.split('/').map(Number);
        return isNaN(n) || isNaN(d) || d === 0 ? NaN : n / d;
    }
    return parseFloat(t);
};

const approxEq = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

// ─── GENERADORES DE EJERCICIOS ────────────────────────────────────────────────
const genDosPuntos = () => {
    let ax, ay, bx, by, m;
    do {
        ax = rInt(-5, 4); ay = rInt(-5, 5);
        bx = rInt(ax + 1, 5); by = rInt(-5, 5);
        m = (by - ay) / (bx - ax);
    } while (ax === bx || !niceSlopeList.includes(m));
    const n = ay - m * ax;
    return { tipo: 'DOS_PUNTOS', ax, ay, bx, by, m, n };
};

const genParalela = () => {
    const m = niceSlope();
    const n = rInt(-4, 4);
    const px = rInt(-5, 5), py = rInt(-5, 5);
    const np = py - m * px;
    return { tipo: 'PARALELA', m, n, px, py, mp: m, np };
};

const genPerpendicular = () => {
    const m = niceSlope();
    const n = rInt(-4, 4);
    const px = rInt(-5, 5), py = rInt(-5, 5);
    const mp = -1 / m;
    const np = py - mp * px;
    return { tipo: 'PERPENDICULAR', m, n, px, py, mp, np };
};

const genGrafica = () => {
    const m = niceSlope();
    const n = rInt(-5, 5);
    return { tipo: 'GRAFICA', m, n };
};

// ─── CANVAS DE COORDENADAS ────────────────────────────────────────────────────
function CoordCanvas({ eq, studentPoints, onPointClick, disabled, resultado, mostrarSolucion }) {
    const canvasRef = useRef(null);

    const drawAll = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CS, CS);

        // fondo cuadrícula
        ctx.fillStyle = '#f8f9ff';
        ctx.fillRect(0, 0, CS, CS);

        // cuadrícula menor
        ctx.strokeStyle = '#dde1f5';
        ctx.lineWidth = 0.8;
        for (let i = -RANGE; i <= RANGE; i++) {
            const { x } = toCanvas(i, 0);
            const { y } = toCanvas(0, i);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CS); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CS, y); ctx.stroke();
        }

        // ejes
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        // eje X
        ctx.beginPath(); ctx.moveTo(0, OY); ctx.lineTo(CS, OY); ctx.stroke();
        // eje Y
        ctx.beginPath(); ctx.moveTo(OX, 0); ctx.lineTo(OX, CS); ctx.stroke();

        // flechas ejes
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.moveTo(CS, OY); ctx.lineTo(CS-8, OY-5); ctx.lineTo(CS-8, OY+5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(OX, 0); ctx.lineTo(OX-5, 8); ctx.lineTo(OX+5, 8); ctx.fill();

        // etiquetas numéricas
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '11px Georgia, serif';
        ctx.textAlign = 'center';
        for (let i = -RANGE+1; i <= RANGE-1; i++) {
            if (i === 0) continue;
            const { x } = toCanvas(i, 0);
            ctx.fillText(i, x, OY + 15);
        }
        ctx.textAlign = 'right';
        for (let i = -RANGE+1; i <= RANGE-1; i++) {
            if (i === 0) continue;
            const { y } = toCanvas(0, i);
            ctx.fillText(i, OX - 5, y + 4);
        }
        ctx.textAlign = 'center';
        ctx.fillText('x', CS - 5, OY - 10);
        ctx.fillText('y', OX + 12, 10);
        ctx.fillText('0', OX - 10, OY + 14);

        // dibujar la recta del ejercicio (si tipo GRAFICA o mostrarSolucion)
        const drawLine = (m, n, color, width, dash=[]) => {
            // intersecciones con los bordes del canvas
            const pts = [];
            // x = -RANGE
            let yv = m * (-RANGE) + n;
            if (yv >= -RANGE && yv <= RANGE) pts.push(toCanvas(-RANGE, yv));
            // x = RANGE
            yv = m * (RANGE) + n;
            if (yv >= -RANGE && yv <= RANGE) pts.push(toCanvas(RANGE, yv));
            // y = -RANGE
            if (m !== 0) {
                const xv = (-RANGE - n) / m;
                if (xv >= -RANGE && xv <= RANGE) pts.push(toCanvas(xv, -RANGE));
                // y = RANGE
                const xv2 = (RANGE - n) / m;
                if (xv2 >= -RANGE && xv2 <= RANGE) pts.push(toCanvas(xv2, RANGE));
            }
            if (pts.length < 2) return;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        };

        if (eq) {
            // para tipo GRAFICA siempre mostrar la recta
            if (eq.tipo === 'GRAFICA') {
                drawLine(eq.m, eq.n, '#3498db', 2.5);
            }
            // para otros, mostrar recta de referencia si la hay (paralela/perpendicular)
            if ((eq.tipo === 'PARALELA' || eq.tipo === 'PERPENDICULAR') && !mostrarSolucion) {
                drawLine(eq.m, eq.n, '#8e44ad', 2, [6,4]);
            }
            // mostrar solución correcta
            if (mostrarSolucion) {
                const ms = eq.mp ?? eq.m;
                const ns = eq.np ?? eq.n;
                drawLine(ms, ns, '#27ae60', 2.5);
                if (eq.tipo === 'PARALELA' || eq.tipo === 'PERPENDICULAR') {
                    drawLine(eq.m, eq.n, '#8e44ad', 2, [6,4]);
                }
            }
        }

        // dibujar la línea del alumno
        if (studentPoints.length === 2) {
            const [p1, p2] = studentPoints;
            const dx = p2.mx - p1.mx, dy = p2.my - p1.my;
            const mS = dx !== 0 ? dy / dx : Infinity;
            const nS = dx !== 0 ? p1.my - mS * p1.mx : 0;
            const lineColor = resultado === null ? '#e67e22'
                : resultado === 'LINEA_OK' || resultado === 'TODO_OK' ? '#27ae60' : '#e74c3c';
            drawLine(mS, nS, lineColor, 2.5);
        }

        // puntos del alumno
        studentPoints.forEach(p => {
            const { x, y } = toCanvas(p.mx, p.my);
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#e67e22';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // puntos del enunciado (DOS_PUNTOS)
        if (eq && eq.tipo === 'DOS_PUNTOS') {
            [[eq.ax, eq.ay, 'A'], [eq.bx, eq.by, 'B']].forEach(([mx, my, lbl]) => {
                const { x, y } = toCanvas(mx, my);
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#2c3e50';
                ctx.fill();
                ctx.fillStyle = '#2c3e50';
                ctx.font = 'bold 13px Georgia, serif';
                ctx.fillText(`${lbl}(${mx},${my})`, x + 10, y - 8);
            });
        }

        // punto P (PARALELA / PERPENDICULAR)
        if (eq && (eq.tipo === 'PARALELA' || eq.tipo === 'PERPENDICULAR')) {
            const { x, y } = toCanvas(eq.px, eq.py);
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#e74c3c';
            ctx.fill();
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px Georgia, serif';
            ctx.fillText(`P(${eq.px},${eq.py})`, x + 10, y - 8);
        }

    }, [eq, studentPoints, resultado, mostrarSolucion]);

    useEffect(() => { drawAll(); }, [drawAll]);

    const handleClick = (e) => {
        if (disabled) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (CS / rect.width);
        const cy = (e.clientY - rect.top)  * (CS / rect.height);
        const { x: mx, y: my } = toMath(cx, cy);
        // snap al entero más cercano
        const snX = Math.round(mx), snY = Math.round(my);
        if (Math.abs(snX) <= RANGE && Math.abs(snY) <= RANGE) {
            onPointClick({ mx: snX, my: snY });
        }
    };

    return (
        <div style={{ position:'relative', display:'inline-block' }}>
            <canvas
                ref={canvasRef}
                width={CS} height={CS}
                onClick={handleClick}
                style={{
                    width: CS, height: CS,
                    cursor: disabled ? 'default' : 'crosshair',
                    borderRadius: 10,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    display:'block',
                    border: resultado === 'TODO_OK' ? '3px solid #27ae60'
                          : resultado === 'LINEA_FAIL' || resultado === 'FAIL' ? '3px solid #e74c3c'
                          : '3px solid #e0e4f0',
                }}
            />
            {!disabled && studentPoints.length < 2 && (
                <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(44,62,80,0.75)', color:'white', padding:'4px 12px', borderRadius:20, fontSize:'0.75rem', pointerEvents:'none', whiteSpace:'nowrap' }}>
                    {studentPoints.length === 0 ? 'Haz clic para marcar el 1.er punto' : 'Haz clic para marcar el 2.º punto'}
                </div>
            )}
        </div>
    );
}

// ─── EJERCICIO GENÉRICO ───────────────────────────────────────────────────────
function Ejercicio({ eq, onNuevo, onVolver }) {
    const [ansM, setAnsM] = useState('');
    const [ansN, setAnsN] = useState('');
    const [studentPts, setStudentPts] = useState([]);
    const [resultado, setResultado] = useState(null);  // null|'TODO_OK'|'M_FAIL'|'N_FAIL'|'LINEA_FAIL'|'LINEA_OK'
    const [mostrarSol, setMostrarSol] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const resetEstado = () => {
        setAnsM(''); setAnsN(''); setStudentPts([]);
        setResultado(null); setMostrarSol(false); setFeedback(null);
    };

    const handleNuevo = () => { resetEstado(); onNuevo(); };

    const handlePoint = (pt) => {
        if (resultado) return;
        setStudentPts(prev => {
            if (prev.length >= 2) return [pt];
            return [...prev, pt];
        });
    };

    const comprobar = () => {
        const correctM = eq.mp ?? eq.m;
        const correctN = eq.np ?? eq.n;

        const mOk = eq.tipo === 'GRAFICA' ? approxEq(parseAnswer(ansM), eq.m) : approxEq(parseAnswer(ansM), correctM);
        const nOk = eq.tipo === 'GRAFICA' ? approxEq(parseAnswer(ansN), eq.n) : approxEq(parseAnswer(ansN), correctN);

        let lineaOk = false;
        if (studentPts.length === 2) {
            const [p1, p2] = studentPts;
            const dx = p2.mx - p1.mx;
            if (dx !== 0) {
                const mS = (p2.my - p1.my) / dx;
                const nS = p1.my - mS * p1.mx;
                const refM = eq.tipo === 'GRAFICA' ? eq.m : correctM;
                const refN = eq.tipo === 'GRAFICA' ? eq.n : correctN;
                lineaOk = approxEq(mS, refM, 0.1) && approxEq(nS, refN, 0.3);
            }
        }

        const msgs = [];
        if (!mOk) msgs.push('La pendiente m no es correcta.');
        if (!nOk) msgs.push('La ordenada en el origen n no es correcta.');
        if (studentPts.length < 2) msgs.push('Dibuja la recta en el canvas (2 puntos).');
        else if (!lineaOk) msgs.push('El dibujo de la recta no coincide.');

        if (mOk && nOk && lineaOk) {
            setResultado('TODO_OK');
            setFeedback(null);
        } else {
            setResultado(lineaOk ? 'LINEA_OK' : 'LINEA_FAIL');
            setFeedback(msgs);
        }
    };

    const correctM = eq.mp ?? eq.m;
    const correctN = eq.np ?? eq.n;

    return (
        <div style={st.ejercicioWrap}>
            {resultado === 'TODO_OK' && <Confetti recycle={false} numberOfPieces={200} />}

            {/* Enunciado */}
            <div style={st.enunciado}>
                <EnunciadoTexto eq={eq} />
            </div>

            <div style={{ display:'flex', gap:24, flexWrap:'wrap', justifyContent:'center' }}>

                {/* Canvas */}
                <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
                    <CoordCanvas
                        eq={eq}
                        studentPoints={studentPts}
                        onPointClick={handlePoint}
                        disabled={!!resultado}
                        resultado={resultado}
                        mostrarSolucion={mostrarSol}
                    />
                    {studentPts.length > 0 && !resultado && (
                        <button onClick={() => setStudentPts([])} style={st.btnClear}>
                            ↺ Borrar dibujo
                        </button>
                    )}
                </div>

                {/* Panel respuestas */}
                <div style={st.panelRespuestas}>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>Pendiente <em>(m)</em> =</label>
                        <input
                            style={{ ...st.mathInput, borderColor: resultado && !approxEq(parseAnswer(ansM), correctM) ? '#e74c3c' : resultado === 'TODO_OK' ? '#27ae60' : '#c0c8e8' }}
                            value={ansM}
                            onChange={e => setAnsM(e.target.value)}
                            placeholder="ej: 2 ó 1/2"
                            disabled={!!resultado}
                            onKeyDown={e => e.key === 'Enter' && !resultado && comprobar()}
                        />
                    </div>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>Ordenada origen <em>(n)</em> =</label>
                        <input
                            style={{ ...st.mathInput, borderColor: resultado && !approxEq(parseAnswer(ansN), correctN) ? '#e74c3c' : resultado === 'TODO_OK' ? '#27ae60' : '#c0c8e8' }}
                            value={ansN}
                            onChange={e => setAnsN(e.target.value)}
                            placeholder="ej: -3 ó 1/2"
                            disabled={!!resultado}
                            onKeyDown={e => e.key === 'Enter' && !resultado && comprobar()}
                        />
                    </div>

                    {!resultado ? (
                        <button onClick={comprobar} style={st.btnComprobar}>
                            <CheckCircle size={17} /> Comprobar
                        </button>
                    ) : resultado === 'TODO_OK' ? (
                        <div style={st.feedbackOk}>
                            <CheckCircle size={22} /> ¡Correcto!
                        </div>
                    ) : (
                        <div style={st.feedbackFail}>
                            <XCircle size={18} style={{ flexShrink:0 }} />
                            <div>
                                {feedback?.map((f, i) => <div key={i}>{f}</div>)}
                            </div>
                        </div>
                    )}

                    {resultado && resultado !== 'TODO_OK' && (
                        <button onClick={() => setMostrarSol(b => !b)} style={st.btnVerSol}>
                            {mostrarSol ? 'Ocultar solución' : 'Ver solución'}
                        </button>
                    )}

                    {mostrarSol && (
                        <div style={st.solucionBox}>
                            <strong>Solución:</strong><br />
                            m = {numStr(correctM)}<br />
                            n = {numStr(correctN)}<br />
                            y = {numStr(correctM)}x {correctN >= 0 ? `+ ${numStr(correctN)}` : `− ${numStr(Math.abs(correctN))}`}
                        </div>
                    )}

                    <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
                        <button onClick={handleNuevo} style={st.btnNuevo}>
                            <RefreshCw size={15} /> Nuevo
                        </button>
                        <button onClick={onVolver} style={st.btnVolver}>
                            <ArrowLeft size={15} /> Volver
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── TEXTO DEL ENUNCIADO ──────────────────────────────────────────────────────
function EnunciadoTexto({ eq }) {
    const renderLinea = (m, n) => (
        <span style={{ fontStyle:'italic' }}>
            y = {fmtFrac(m)}x {n > 0 ? <>+ {fmtFrac(n)}</> : n < 0 ? <>− {fmtFrac(Math.abs(n))}</> : ''}
        </span>
    );

    if (eq.tipo === 'DOS_PUNTOS') return (
        <span>
            Encuentra la ecuación explícita de la recta que pasa por{' '}
            <strong>A({eq.ax}, {eq.ay})</strong> y <strong>B({eq.bx}, {eq.by})</strong>.
        </span>
    );
    if (eq.tipo === 'PARALELA') return (
        <span>
            Encuentra la ecuación de la recta <strong>paralela</strong> a{' '}
            {renderLinea(eq.m, eq.n)}{' '}que pasa por el punto <strong>P({eq.px}, {eq.py})</strong>.
        </span>
    );
    if (eq.tipo === 'PERPENDICULAR') return (
        <span>
            Encuentra la ecuación de la recta <strong>perpendicular</strong> a{' '}
            {renderLinea(eq.m, eq.n)}{' '}que pasa por el punto <strong>P({eq.px}, {eq.py})</strong>.
        </span>
    );
    if (eq.tipo === 'GRAFICA') return (
        <span>
            Observa la recta dibujada en el gráfico y encuentra su ecuación explícita <em>y = mx + n</em>.
        </span>
    );
    return null;
}

// ─── PANTALLA RECTAS ─────────────────────────────────────────────────────────
const TIPOS = [
    { id:'DOS_PUNTOS',    label:'Recta por dos puntos',       desc:'Dados A y B, encuentra y = mx + n', emoji:'📍', gen: genDosPuntos },
    { id:'PARALELA',      label:'Recta paralela a una dada',  desc:'Dada una recta y un punto P',        emoji:'⫸', gen: genParalela },
    { id:'PERPENDICULAR', label:'Recta perpendicular',        desc:'Encuentra la recta ⊥ por P',         emoji:'⊥', gen: genPerpendicular },
    { id:'GRAFICA',       label:'Recta por su gráfica',       desc:'Lee m y n de la representación',     emoji:'📈', gen: genGrafica },
];

function PantallaRectas({ onVolver }) {
    const [tipoActivo, setTipoActivo] = useState(null);
    const [eq, setEq] = useState(null);

    const iniciar = (tipo) => {
        setTipoActivo(tipo);
        setEq(tipo.gen());
    };

    if (tipoActivo && eq) return (
        <Ejercicio
            eq={eq}
            onNuevo={() => setEq(tipoActivo.gen())}
            onVolver={() => { setTipoActivo(null); setEq(null); }}
        />
    );

    return (
        <div style={st.seccionWrap}>
            <div style={st.seccionHeader}>
                <button onClick={onVolver} style={st.btnVolverSec}>
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <div style={st.seccionTitulo}>📐 Rectas</div>
                    <div style={st.seccionSubtitulo}>Ecuación explícita · y = mx + n</div>
                </div>
            </div>
            <div style={st.tiposGrid}>
                {TIPOS.map(t => (
                    <button key={t.id} onClick={() => iniciar(t)} style={st.tipoBtn}>
                        <div style={st.tipoEmoji}>{t.emoji}</div>
                        <div style={st.tipoLabel}>{t.label}</div>
                        <div style={st.tipoDesc}>{t.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── PARÁBOLAS (placeholder) ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// PARÁBOLAS
// ══════════════════════════════════════════════════════════════════════════════


// ─── Lienzo de trabajo por ejercicio ─────────────────────────────────────────
function MiniPaint() {
    const canvasRef = useRef(null);
    const drawing   = useRef(false);
    const lastPos   = useRef(null);
    const [open, setOpen]   = useState(false);
    const [color, setColor] = useState('#000000');
    const [tool, setTool]   = useState('PINCEL');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || canvas.width > 0) return;
        canvas.width  = canvas.offsetWidth || 360;
        canvas.height = 180;
    }, [open]);

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width  / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const onDown = (e) => {
        e.preventDefault();
        drawing.current = true;
        lastPos.current = getPos(e);
    };
    const onMove = (e) => {
        if (!drawing.current) return;
        e.preventDefault();
        const pos = getPos(e);
        const ctx = canvasRef.current.getContext('2d');
        if (tool === 'GOMA') {
            ctx.clearRect(pos.x - 10, pos.y - 10, 20, 20);
        } else {
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = color;
            ctx.lineWidth   = 2.5;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.stroke();
        }
        lastPos.current = pos;
    };
    const onUp = () => { drawing.current = false; };

    const limpiar = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    const COLORS = [['#000000','Negro'],['#e74c3c','Rojo'],['#27ae60','Verde']];

    return (
        <div style={{ width: '100%', marginTop: 8 }}>
            <button onClick={() => setOpen(b => !b)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                background: open ? '#2c3e50' : '#f0f3fb',
                color: open ? 'white' : '#5a6a9a',
                border:'1.5px solid #c0c8e8', borderRadius:20,
                cursor:'pointer', fontSize:'0.78rem', fontWeight:'bold', fontFamily:'inherit',
            }}>
                ✏️ {open ? 'Cerrar lienzo' : 'Lienzo de trabajo'}
            </button>
            {open && (
                <div style={{ marginTop:8, background:'white', borderRadius:10, border:'1.5px solid #dde2f0', overflow:'hidden' }}>
                    {/* Barra */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'#f8f9ff', borderBottom:'1px solid #eee', flexWrap:'wrap' }}>
                        {COLORS.map(([c, lbl]) => (
                            <div key={c} onClick={() => { setColor(c); setTool('PINCEL'); }}
                                title={lbl}
                                style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer',
                                    border: color===c && tool==='PINCEL' ? '3px solid #3498db' : '2px solid #ccc' }} />
                        ))}
                        <div style={{ width:1, height:18, background:'#ddd' }} />
                        <button onClick={() => setTool('GOMA')}
                            style={{ padding:'3px 8px', borderRadius:12, border:'none', cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold', fontFamily:'inherit', background: tool==='GOMA' ? '#e74c3c' : '#f0f0f0', color: tool==='GOMA' ? 'white' : '#555' }}>
                            🧹 Goma
                        </button>
                        <button onClick={limpiar}
                            style={{ padding:'3px 8px', borderRadius:12, border:'none', cursor:'pointer', fontSize:'0.75rem', fontFamily:'inherit', background:'#fdecea', color:'#c62828', fontWeight:'bold' }}>
                            🗑️ Limpiar
                        </button>
                    </div>
                    {/* Canvas */}
                    <canvas ref={canvasRef} width={360} height={180}
                        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                        style={{ display:'block', width:'100%', height:180, cursor: tool==='GOMA' ? 'cell' : 'crosshair', background:'#fafbff', touchAction:'none' }}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Canvas de parábola ───────────────────────────────────────────────────────
function ParabolaCanvas({ a, b, c, studentPoints = [], resultado = null, mostrarSolucion = false }) {
    const canvasRef = useRef(null);
    const RANGE_P = 7;
    const CSP = 360;
    const OXP = CSP / 2, OYP = CSP / 2;
    const SCP = CSP / (RANGE_P * 2);
    const toC = (mx, my) => ({ x: OXP + mx * SCP, y: OYP - my * SCP });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CSP, CSP);

        // fondo
        ctx.fillStyle = '#f8f9ff'; ctx.fillRect(0, 0, CSP, CSP);

        // cuadrícula
        ctx.strokeStyle = '#dde1f5'; ctx.lineWidth = 0.8;
        for (let i = -RANGE_P; i <= RANGE_P; i++) {
            const { x } = toC(i, 0); const { y } = toC(0, i);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CSP); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CSP, y); ctx.stroke();
        }

        // ejes
        ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, OYP); ctx.lineTo(CSP, OYP); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OXP, 0); ctx.lineTo(OXP, CSP); ctx.stroke();

        // flechas
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.moveTo(CSP, OYP); ctx.lineTo(CSP-7, OYP-4); ctx.lineTo(CSP-7, OYP+4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(OXP, 0); ctx.lineTo(OXP-4, 7); ctx.lineTo(OXP+4, 7); ctx.fill();

        // etiquetas
        ctx.fillStyle = '#7f8c8d'; ctx.font = '10px Georgia, serif'; ctx.textAlign = 'center';
        for (let i = -RANGE_P+1; i <= RANGE_P-1; i++) {
            if (i === 0) continue;
            const { x } = toC(i, 0); ctx.fillText(i, x, OYP + 13);
        }
        ctx.textAlign = 'right';
        for (let i = -RANGE_P+1; i <= RANGE_P-1; i++) {
            if (i === 0) continue;
            const { y } = toC(0, i); ctx.fillText(i, OXP - 4, y + 4);
        }

        // dibujar parábola si tenemos a, b, c
        if (a !== undefined && a !== null) {
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
            ctx.beginPath();
            let started = false;
            for (let px = 0; px <= CSP; px++) {
                const mx = (px - OXP) / SCP;
                const my = a * mx * mx + b * mx + c;
                const { y: cy } = toC(0, my);
                if (my >= -RANGE_P - 1 && my <= RANGE_P + 1) {
                    if (!started) { ctx.moveTo(px, cy); started = true; }
                    else ctx.lineTo(px, cy);
                } else {
                    if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
                }
            }
            if (started) ctx.stroke();

            // vértice
            if (mostrarSolucion) {
                const xv = -b / (2 * a);
                const yv = a * xv * xv + b * xv + c;
                const { x: vx, y: vy } = toC(xv, yv);
                ctx.beginPath(); ctx.arc(vx, vy, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#e74c3c'; ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
            }
        }

        // puntos del alumno (tipo 2)
        studentPoints.forEach(p => {
            const { x, y } = toC(p.x, p.y);
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#e67e22'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 10px Georgia'; ctx.textAlign = 'left';
            ctx.fillText(`(${p.x},${p.y})`, x + 7, y - 5);
        });

    }, [a, b, c, studentPoints, resultado, mostrarSolucion]);

    return (
        <canvas ref={canvasRef} width={CSP} height={CSP}
            style={{
                width: CSP, height: CSP, borderRadius: 10, display: 'block',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                border: resultado === 'OK' ? '3px solid #27ae60'
                      : resultado === 'FAIL' ? '3px solid #e74c3c'
                      : '3px solid #e0e4f0',
            }}
        />
    );
}

// ─── Helpers parábola ─────────────────────────────────────────────────────────
const rIntP = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rNZ   = (min, max) => { let v = 0; while (v === 0) v = rIntP(min, max); return v; };

// Genera y = ax² + bx + c con coeficientes manejables
const genAnalisis = () => {
    let a, b, c, disc;
    do {
        a = rNZ(-3, 3);
        b = rIntP(-6, 6);
        c = rIntP(-6, 6);
        disc = b * b - 4 * a * c;
    } while (Math.abs(a) > 3 || (disc > 0 && !Number.isInteger(Math.sqrt(disc))) && disc !== 0);
    return { tipo: 'ANALISIS', a, b, c, disc };
};

// Genera 3 puntos y calcula a,b,c via Gauss
const resolverSistema = (pts) => {
    // Sistema: a*x1² + b*x1 + c = y1 ...
    const [[x1,y1],[x2,y2],[x3,y3]] = pts;
    // Cramer / eliminación
    const A = [[x1*x1, x1, 1, y1], [x2*x2, x2, 1, y2], [x3*x3, x3, 1, y3]];
    for (let col = 0; col < 3; col++) {
        let maxRow = col;
        for (let row = col+1; row < 3; row++) if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
        [A[col], A[maxRow]] = [A[maxRow], A[col]];
        for (let row = col+1; row < 3; row++) {
            if (A[col][col] === 0) continue;
            const factor = A[row][col] / A[col][col];
            for (let k = col; k <= 3; k++) A[row][k] -= factor * A[col][k];
        }
    }
    const c_ = A[2][3] / A[2][2];
    const b_ = (A[1][3] - A[1][2] * c_) / A[1][1];
    const a_ = (A[0][3] - A[0][2] * c_ - A[0][1] * b_) / A[0][0];
    return { a: Math.round(a_*100)/100, b: Math.round(b_*100)/100, c: Math.round(c_*100)/100 };
};

const genTresPuntos = () => {
    // Uno de los tres puntos es siempre (0, c) -> el alumno obtiene c directamente
    // y solo necesita resolver un sistema 2x2 para a y b
    let a, b, c, pts;
    do {
        a = rNZ(-3, 3);
        b = rIntP(-4, 4);
        c = rIntP(-6, 6);
        // Los otros dos puntos con x != 0, distintos entre sí
        const otrasX = [-3, -2, -1, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
        pts = [
            [0, c],                                        // punto fijo (0, c)
            [otrasX[0], a*otrasX[0]**2 + b*otrasX[0] + c],
            [otrasX[1], a*otrasX[1]**2 + b*otrasX[1] + c],
        ];
    } while (pts.some(([,y]) => Math.abs(y) > 9));
    return { tipo: 'TRES_PUNTOS', a, b, c, pts };
};

// ─── Ejercicio ANÁLISIS ───────────────────────────────────────────────────────
function EjercicioAnalisis({ eq, onNuevo, onVolver }) {
    const { a, b, c, disc } = eq;
    const xv = -b / (2 * a);
    const yv = a * xv * xv + b * xv + c;

    const [forma, setForma]     = useState('');           // 'U' | 'N'
    const [ansXv, setAnsXv]     = useState('');
    const [ansYv, setAnsYv]     = useState('');
    const [noCortes, setNoCortes] = useState(false);
    const [ansX1, setAnsX1]     = useState('');
    const [ansX2, setAnsX2]     = useState('');
    const [ansYeje, setAnsYeje] = useState('');
    const [resultado, setResultado] = useState(null);
    const [errores, setErrores]     = useState([]);
    const [mostrarSol, setMostrarSol] = useState(false);

    const reset = () => { setForma(''); setAnsXv(''); setAnsYv(''); setNoCortes(false); setAnsX1(''); setAnsX2(''); setAnsYeje(''); setResultado(null); setErrores([]); setMostrarSol(false); };

    const tol = 0.11;
    const numStr2 = (v) => Number.isInteger(v) ? `${v}` : (Math.round(v*100)/100).toString();

    // Raíces
    let x1sol = null, x2sol = null;
    if (disc > 0) {
        x1sol = (-b + Math.sqrt(disc)) / (2 * a);
        x2sol = (-b - Math.sqrt(disc)) / (2 * a);
    } else if (disc === 0) {
        x1sol = x2sol = -b / (2 * a);
    }

    const comprobar = () => {
        const errs = [];
        const formaOk = (a > 0 && forma === 'U') || (a < 0 && forma === 'N');
        if (!formaOk) errs.push('La forma (∪ o ∩) no es correcta.');

        const xvOk = Math.abs(parseAnswer(ansXv) - xv) <= tol;
        if (!xvOk) errs.push('La coordenada x del vértice no es correcta.');

        const yvOk = Math.abs(parseAnswer(ansYv) - yv) <= tol;
        if (!yvOk) errs.push('La coordenada y del vértice no es correcta.');

        if (disc < 0) {
            if (!noCortes) errs.push('Marca "No hay cortes con el eje X" (discriminante < 0).');
        } else if (disc === 0) {
            const cortesOk = !noCortes && Math.abs(parseAnswer(ansX1) - x1sol) <= tol;
            if (!cortesOk) errs.push('El corte doble con el eje X no es correcto.');
        } else {
            if (noCortes) errs.push('Sí hay cortes con el eje X (discriminante > 0).');
            else {
                const vals = [parseAnswer(ansX1), parseAnswer(ansX2)].sort((x,y)=>x-y);
                const sols = [x1sol, x2sol].sort((x,y)=>x-y);
                if (!(Math.abs(vals[0]-sols[0]) <= tol && Math.abs(vals[1]-sols[1]) <= tol))
                    errs.push('Los cortes con el eje X no son correctos.');
            }
        }

        const yejeOk = Math.abs(parseAnswer(ansYeje) - c) <= tol;
        if (!yejeOk) errs.push('El corte con el eje Y no es correcto (es el valor de c).');

        if (errs.length === 0) setResultado('OK');
        else { setResultado('FAIL'); setErrores(errs); }
    };

    const fmtPar = () => {
        const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        const bStr = b === 0 ? '' : b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`;
        const cStr = c === 0 ? '' : c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;
        return `y = ${aStr}x² ${bStr} ${cStr}`.replace(/\s+/g,' ').trim();
    };

    return (
        <div style={st.ejercicioWrap}>
            {resultado === 'OK' && <Confetti recycle={false} numberOfPieces={200} />}
            <div style={st.enunciado}>
                Analiza la parábola: <strong style={{ fontSize:'1.1em' }}>{fmtPar()}</strong>
            </div>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap', justifyContent:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <ParabolaCanvas a={resultado ? a : null} b={resultado ? b : null} c={resultado ? c : null} resultado={resultado} mostrarSolucion={mostrarSol} />
                    <MiniPaint />
                </div>
                <div style={{ ...st.panelRespuestas, width:300, minHeight:'auto' }}>

                    {/* Forma */}
                    <div>
                        <div style={st.inputLabel}>Forma de la parábola</div>
                        <div style={{ display:'flex', gap:10, marginTop:6 }}>
                            {[['U','⌣ Cóncava (∪)'],['N','⌢ Convexa (∩)']].map(([v, lbl]) => (
                                <button key={v} onClick={() => !resultado && setForma(v)}
                                    style={{ flex:1, padding:'8px 6px', borderRadius:8, border:`2px solid ${forma===v ? '#3498db' : '#dde2f0'}`, background: forma===v ? '#ebf5fb' : 'white', cursor:'pointer', fontWeight: forma===v ? 'bold' : 'normal', fontSize:'0.82rem', color: forma===v ? '#1a5276' : '#555', fontFamily:'inherit' }}>
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Vértice */}
                    <div>
                        <div style={st.inputLabel}>Vértice V(x<sub>v</sub>, y<sub>v</sub>)</div>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
                            <span style={{ fontSize:'0.82rem', color:'#5a6a9a' }}>x<sub>v</sub> =</span>
                            <input style={{ ...st.mathInput, width:70 }} value={ansXv} onChange={e=>setAnsXv(e.target.value)} disabled={!!resultado} placeholder="ej: 2" />
                            <span style={{ fontSize:'0.82rem', color:'#5a6a9a' }}>y<sub>v</sub> =</span>
                            <input style={{ ...st.mathInput, width:70 }} value={ansYv} onChange={e=>setAnsYv(e.target.value)} disabled={!!resultado} placeholder="ej: -3" />
                        </div>
                    </div>

                    {/* Cortes eje X */}
                    <div>
                        <div style={st.inputLabel}>Cortes con el eje X</div>
                        <label style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, cursor:'pointer', fontSize:'0.85rem' }}>
                            <input type="checkbox" checked={noCortes} onChange={e => !resultado && setNoCortes(e.target.checked)} style={{ width:16, height:16 }} />
                            No hay cortes con el eje X
                        </label>
                        {!noCortes && (
                            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                    <span style={{ fontSize:'0.8rem', color:'#5a6a9a' }}>x<sub>1</sub> =</span>
                                    <input style={{ ...st.mathInput, width:64 }} value={ansX1} onChange={e=>setAnsX1(e.target.value)} disabled={!!resultado} placeholder="ej: 3" />
                                </div>
                                {disc !== 0 && (
                                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                        <span style={{ fontSize:'0.8rem', color:'#5a6a9a' }}>x<sub>2</sub> =</span>
                                        <input style={{ ...st.mathInput, width:64 }} value={ansX2} onChange={e=>setAnsX2(e.target.value)} disabled={!!resultado} placeholder="ej: -1" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Corte eje Y */}
                    <div>
                        <div style={st.inputLabel}>Corte con el eje Y — punto (0, ?)</div>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                            <span style={{ fontSize:'0.82rem', color:'#5a6a9a' }}>(0,</span>
                            <input style={{ ...st.mathInput, width:70 }} value={ansYeje} onChange={e=>setAnsYeje(e.target.value)} disabled={!!resultado} placeholder="ej: 4" />
                            <span style={{ fontSize:'0.82rem', color:'#5a6a9a' }}>)</span>
                        </div>
                    </div>

                    {/* Botones */}
                    {!resultado ? (
                        <button onClick={comprobar} style={st.btnComprobar}><CheckCircle size={16} /> Comprobar</button>
                    ) : resultado === 'OK' ? (
                        <div style={st.feedbackOk}><CheckCircle size={20} /> ¡Correcto!</div>
                    ) : (
                        <div style={st.feedbackFail}>
                            <XCircle size={16} style={{ flexShrink:0 }} />
                            <div>{errores.map((e,i) => <div key={i}>{e}</div>)}</div>
                        </div>
                    )}

                    {resultado === 'FAIL' && (
                        <button onClick={() => setMostrarSol(b => !b)} style={st.btnVerSol}>
                            {mostrarSol ? 'Ocultar solución' : 'Ver solución'}
                        </button>
                    )}
                    {mostrarSol && (
                        <div style={st.solucionBox}>
                            <strong>Solución:</strong><br />
                            Forma: {a > 0 ? '∪ cóncava' : '∩ convexa'}<br />
                            Vértice: ({numStr2(xv)}, {numStr2(yv)})<br />
                            {disc < 0 ? 'No hay cortes con eje X' : disc === 0 ? `Corte doble: x = ${numStr2(x1sol)}` : `x₁ = ${numStr2(x1sol)}, x₂ = ${numStr2(x2sol)}`}<br />
                            Corte eje Y: (0, {c})
                        </div>
                    )}
                    <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => { reset(); onNuevo(); }} style={st.btnNuevo}><RefreshCw size={14} /> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={14} /> Volver</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Ejercicio TRES PUNTOS ────────────────────────────────────────────────────
function EjercicioTresPuntos({ eq, onNuevo, onVolver }) {
    const { a, b, c, pts } = eq;

    const [ansA, setAnsA] = useState('');
    const [ansB, setAnsB] = useState('');
    const [ansC, setAnsC] = useState('');
    const [resultado, setResultado] = useState(null);
    const [errores, setErrores]     = useState([]);
    const [mostrarSol, setMostrarSol] = useState(false);

    const reset = () => { setAnsA(''); setAnsB(''); setAnsC(''); setResultado(null); setErrores([]); setMostrarSol(false); };

    const tol = 0.11;

    const comprobar = () => {
        const errs = [];
        const aOk = Math.abs(parseAnswer(ansA) - a) <= tol;
        const bOk = Math.abs(parseAnswer(ansB) - b) <= tol;
        const cOk = Math.abs(parseAnswer(ansC) - c) <= tol;
        if (!aOk) errs.push(`El coeficiente a no es correcto.`);
        if (!bOk) errs.push(`El coeficiente b no es correcto.`);
        if (!cOk) errs.push(`El coeficiente c no es correcto.`);
        if (errs.length === 0) setResultado('OK');
        else { setResultado('FAIL'); setErrores(errs); }
    };

    const studentPoints = pts.map(([x, y]) => ({ x, y }));

    const fmtPar = (aa, bb, cc) => {
        const aStr = aa === 1 ? '' : aa === -1 ? '-' : `${aa}`;
        const bStr = bb === 0 ? '' : bb > 0 ? ` + ${bb}x` : ` - ${Math.abs(bb)}x`;
        const cStr = cc === 0 ? '' : cc > 0 ? ` + ${cc}` : ` - ${Math.abs(cc)}`;
        return `y = ${aStr}x²${bStr}${cStr}`.replace(/\s+/g,' ').trim();
    };

    return (
        <div style={st.ejercicioWrap}>
            {resultado === 'OK' && <Confetti recycle={false} numberOfPieces={200} />}
            <div style={st.enunciado}>
                Encuentra la función <em>y = ax² + bx + c</em> cuya parábola pasa por los puntos:
                {' '}{pts.map(([x,y], i) => <strong key={i}>{i > 0 ? ', ' : ''}({x}, {y})</strong>)}
            </div>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap', justifyContent:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <ParabolaCanvas
                        a={mostrarSol ? a : null} b={mostrarSol ? b : null} c={mostrarSol ? c : null}
                        studentPoints={studentPoints}
                        resultado={resultado}
                        mostrarSolucion={mostrarSol}
                    />
                    <MiniPaint />
                </div>
                <div style={{ ...st.panelRespuestas, width:270, minHeight:'auto' }}>
                    <div style={{ background:'#f0f3fb', borderRadius:10, padding:'10px 12px', fontSize:'0.82rem', color:'#5a6a9a', lineHeight:1.7 }}>
                        Plantea el sistema con los tres puntos y resuelve para encontrar <em>a</em>, <em>b</em> y <em>c</em>.
                    </div>
                    {[['a', ansA, setAnsA], ['b', ansB, setAnsB], ['c', ansC, setAnsC]].map(([lbl, val, set]) => (
                        <div key={lbl} style={st.inputGroup}>
                            <label style={st.inputLabel}><em>{lbl}</em> =</label>
                            <input style={st.mathInput} value={val} onChange={e => set(e.target.value)}
                                placeholder="ej: 2 ó -1" disabled={!!resultado}
                                onKeyDown={e => e.key === 'Enter' && !resultado && comprobar()} />
                        </div>
                    ))}

                    {!resultado ? (
                        <button onClick={comprobar} style={st.btnComprobar}><CheckCircle size={16} /> Comprobar</button>
                    ) : resultado === 'OK' ? (
                        <div style={st.feedbackOk}><CheckCircle size={20} /> ¡Correcto!</div>
                    ) : (
                        <div style={st.feedbackFail}>
                            <XCircle size={16} style={{ flexShrink:0 }} />
                            <div>{errores.map((e,i) => <div key={i}>{e}</div>)}</div>
                        </div>
                    )}

                    {resultado === 'FAIL' && (
                        <button onClick={() => setMostrarSol(b => !b)} style={st.btnVerSol}>
                            {mostrarSol ? 'Ocultar solución' : 'Ver solución'}
                        </button>
                    )}
                    {mostrarSol && (
                        <div style={st.solucionBox}>
                            <strong>Solución:</strong><br />
                            a = {a}, b = {b}, c = {c}<br />
                            {fmtPar(a, b, c)}
                        </div>
                    )}
                    <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => { reset(); onNuevo(); }} style={st.btnNuevo}><RefreshCw size={14} /> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={14} /> Volver</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Pantalla Parábolas ───────────────────────────────────────────────────────
const TIPOS_PAR = [
    { id:'ANALISIS',    label:'Analizar una parábola',  desc:'Vértice, forma, cortes con ejes', emoji:'🔍', gen: genAnalisis },
    { id:'TRES_PUNTOS', label:'Parábola por 3 puntos',  desc:'Encuentra a, b, c dado A, B, C',  emoji:'📍', gen: genTresPuntos },
];

function PantallaParabolas({ onVolver }) {
    const [tipoActivo, setTipoActivo] = useState(null);
    const [eq, setEq] = useState(null);

    const iniciar = (tipo) => { setTipoActivo(tipo); setEq(tipo.gen()); };

    if (tipoActivo && eq) {
        if (tipoActivo.id === 'ANALISIS')
            return <EjercicioAnalisis eq={eq} onNuevo={() => setEq(tipoActivo.gen())} onVolver={() => { setTipoActivo(null); setEq(null); }} />;
        return <EjercicioTresPuntos eq={eq} onNuevo={() => setEq(tipoActivo.gen())} onVolver={() => { setTipoActivo(null); setEq(null); }} />;
    }

    return (
        <div style={st.seccionWrap}>
            <div style={st.seccionHeader}>
                <button onClick={onVolver} style={st.btnVolverSec}><ArrowLeft size={16} /></button>
                <div>
                    <div style={st.seccionTitulo}>⌒ Parábolas</div>
                    <div style={st.seccionSubtitulo}>Función cuadrática · y = ax² + bx + c</div>
                </div>
            </div>
            <div style={st.tiposGrid}>
                {TIPOS_PAR.map(t => (
                    <button key={t.id} onClick={() => iniciar(t)} style={st.tipoBtn}>
                        <div style={st.tipoEmoji}>{t.emoji}</div>
                        <div style={st.tipoLabel}>{t.label}</div>
                        <div style={st.tipoDesc}>{t.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function Funciones() {
    const [seccion, setSeccion] = useState(null);

    if (seccion === 'RECTAS')    return <PantallaRectas    onVolver={() => setSeccion(null)} />;
    if (seccion === 'PARABOLAS') return <PantallaParabolas onVolver={() => setSeccion(null)} />;

    return (
        <div style={st.pagina}>
            {/* Header */}
            <div style={st.header}>
                <div style={st.headerIcon}>∫</div>
                <div>
                    <div style={st.headerTitulo}>Funciones</div>
                    <div style={st.headerSub}>Geometría Analítica · Ecuaciones de la recta</div>
                </div>
            </div>

            {/* Cards */}
            <div style={st.mainGrid}>
                <button onClick={() => setSeccion('RECTAS')} style={{ ...st.mainCard, '--accent':'#3498db' }}>
                    <TrendingUp size={40} color="#3498db" />
                    <div style={st.mainCardTitle}>Rectas</div>
                    <div style={st.mainCardDesc}>
                        Ecuación explícita, rectas paralelas y perpendiculares, lectura de gráficas
                    </div>
                    <div style={st.mainCardPill}>4 tipos de ejercicio</div>
                </button>

                <button onClick={() => setSeccion('PARABOLAS')} style={{ ...st.mainCard, '--accent':'#9b59b6' }}>
                    <BarChart2 size={40} color="#9b59b6" />
                    <div style={st.mainCardTitle}>Parábolas</div>
                    <div style={st.mainCardDesc}>
                        Función cuadrática, vértice, eje de simetría y representación gráfica
                    </div>
                    <div style={{ ...st.mainCardPill, background:'#9b59b622', color:'#9b59b6' }}>Próximamente</div>
                </button>
            </div>
        </div>
    );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const st = {
    pagina: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f1b35 0%, #1a2d5a 60%, #2c3e70 100%)',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '30px 16px',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: 18,
        marginBottom: 40, color: 'white',
    },
    headerIcon: {
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2.2rem', color: '#7eb8f7', fontFamily: 'serif',
    },
    headerTitulo: { fontSize: '2rem', fontWeight: 'bold', letterSpacing: '-0.5px' },
    headerSub:    { fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 3 },

    mainGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 20, width: '100%', maxWidth: 620,
    },
    mainCard: {
        background: 'rgba(255,255,255,0.07)',
        border: '1.5px solid rgba(255,255,255,0.13)',
        borderRadius: 20,
        padding: '30px 24px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        textAlign: 'center', color: 'white',
        transition: 'background 0.2s, transform 0.15s',
    },
    mainCardTitle: { fontSize: '1.4rem', fontWeight: 'bold' },
    mainCardDesc:  { fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 },
    mainCardPill:  {
        background: 'rgba(52,152,219,0.2)', color: '#7eb8f7',
        padding: '3px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 'bold',
    },

    seccionWrap: {
        minHeight: '100vh',
        background: '#f0f3fb',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: '0 0 40px',
    },
    seccionHeader: {
        background: 'linear-gradient(135deg, #0f1b35, #1a2d5a)',
        color: 'white', padding: '18px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    },
    btnVolverSec: {
        background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
        width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    seccionTitulo:   { fontSize: '1.25rem', fontWeight: 'bold' },
    seccionSubtitulo:{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 },

    tiposGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, padding: '24px 24px 0',
    },
    tipoBtn: {
        background: 'white', border: '2px solid #dde2f0',
        borderRadius: 16, padding: '22px 18px',
        cursor: 'pointer', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    },
    tipoEmoji: { fontSize: '2rem', lineHeight: 1 },
    tipoLabel: { fontWeight: 'bold', color: '#1a2d5a', fontSize: '0.95rem' },
    tipoDesc:  { fontSize: '0.78rem', color: '#7f8fa6', lineHeight: 1.4 },

    ejercicioWrap: {
        minHeight: '100vh',
        background: '#f0f3fb',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: '20px 16px 40px',
        display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center',
    },
    enunciado: {
        background: 'white',
        border: '2px solid #d0d8f0',
        borderLeft: '5px solid #3498db',
        borderRadius: 12, padding: '16px 20px',
        fontSize: '1rem', color: '#1a2d5a', lineHeight: 1.7,
        maxWidth: 900, width: '100%', boxSizing: 'border-box',
    },

    panelRespuestas: {
        background: 'white', borderRadius: 16,
        border: '2px solid #dde2f0',
        padding: '22px', display: 'flex', flexDirection: 'column', gap: 14,
        width: 270, boxSizing: 'border-box', flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        minHeight: CS,
    },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
    inputLabel: { fontSize: '0.82rem', fontWeight: 'bold', color: '#5a6a9a' },
    mathInput: {
        width: '100%', padding: '10px 12px', borderRadius: 8,
        border: '2px solid #c0c8e8', outline: 'none',
        fontSize: '1.1rem', fontFamily: "'Georgia', serif",
        color: '#1a2d5a', boxSizing: 'border-box',
        textAlign: 'center',
    },
    btnComprobar: {
        background: '#1a2d5a', color: 'white', border: 'none',
        padding: '11px', borderRadius: 10, cursor: 'pointer',
        fontWeight: 'bold', fontSize: '0.95rem', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    feedbackOk: {
        background: '#e8f8f0', border: '2px solid #27ae60',
        borderRadius: 10, padding: '10px 14px',
        color: '#1a7a4a', fontWeight: 'bold', fontSize: '1rem',
        display: 'flex', alignItems: 'center', gap: 8,
    },
    feedbackFail: {
        background: '#fef0ef', border: '2px solid #e74c3c',
        borderRadius: 10, padding: '10px 14px',
        color: '#c0392b', fontSize: '0.82rem', lineHeight: 1.6,
        display: 'flex', gap: 8, alignItems: 'flex-start',
    },
    btnVerSol: {
        background: '#f0f3fb', border: '1.5px solid #c0c8e8',
        borderRadius: 8, padding: '7px 12px',
        cursor: 'pointer', fontSize: '0.82rem', color: '#5a6a9a',
        fontFamily: 'inherit',
    },
    solucionBox: {
        background: '#fffbec', border: '1.5px solid #f39c12',
        borderRadius: 8, padding: '10px 12px',
        fontSize: '0.88rem', color: '#7d5c00', lineHeight: 1.8,
    },
    btnNuevo: {
        flex: 1, background: '#3498db', color: 'white', border: 'none',
        borderRadius: 8, padding: '9px', cursor: 'pointer',
        fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    },
    btnVolver: {
        flex: 1, background: '#f0f3fb', border: '1.5px solid #c0c8e8',
        borderRadius: 8, padding: '9px', cursor: 'pointer',
        fontSize: '0.85rem', color: '#5a6a9a', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    },
    btnClear: {
        background: 'transparent', border: '1px solid #e74c3c',
        color: '#e74c3c', borderRadius: 20, padding: '4px 12px',
        cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
    },
};
