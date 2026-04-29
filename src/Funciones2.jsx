import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, TrendingUp, BarChart2, Monitor, Users, Play, Loader, Send, Share2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { db } from './firebase';
import { doc, setDoc, updateDoc, onSnapshot, increment, collection, addDoc, getDoc } from 'firebase/firestore';
import piHappy from './assets/Pi-contento.png';
import piAngry from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';

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

const genVector = () => {
    let ax, ay, bx, by;
    do {
        ax = rInt(-4, 3); ay = rInt(-4, 4);
        bx = rInt(-4, 4); by = rInt(-4, 4);
    } while (ax === bx && ay === by);
    const vx = bx - ax, vy = by - ay;
    const modulo = Math.sqrt(vx*vx + vy*vy);
    const angulo = Math.round(Math.atan2(vy, vx) * 180 / Math.PI * 10) / 10;
    return { tipo: 'VECTOR', ax, ay, bx, by, vx, vy, modulo, angulo };
};

// Convierte y=mx+n a forma general Ax+By+C=0 con enteros
const toGeneralForm = (m, n) => {
    const fracMap = { '-0.5':[-1,2], '0.5':[1,2], '-1.5':[-3,2], '1.5':[3,2], '-2.5':[-5,2], '2.5':[5,2] };
    const entry = fracMap[String(m)];
    if (entry) {
        const [p, q] = entry;
        return { A: p, B: -q, C: q * n };
    }
    return { A: m, B: -1, C: n };
};

const fmtGeneral = ({ A, B, C }) => {
    const t = (coef, varr, first) => {
        if (coef === 0) return '';
        const abs = Math.abs(coef);
        const sign = coef < 0 ? (first ? '-' : '- ') : (first ? '' : '+ ');
        const term = abs === 1 ? varr : `${abs}${varr}`;
        return `${sign}${term}`;
    };
    const parts = [t(A,'x',true), t(B,'y',false), C !== 0 ? (C < 0 ? `- ${Math.abs(C)}` : `+ ${Math.abs(C)}`) : ''].filter(Boolean);
    return (parts.length ? parts.join(' ') : '0') + ' = 0';
};

const genGeneral = () => {
    const subtipo = ['PARALELAS','PERPENDICULARES','INTERSECCION'][Math.floor(Math.random()*3)];
    const m1 = niceSlope();
    const n1 = rInt(-3, 3);
    let m2, n2;
    if (subtipo === 'PARALELAS') {
        m2 = m1;
        do { n2 = rInt(-3, 3); } while (n2 === n1);
    } else if (subtipo === 'PERPENDICULARES') {
        m2 = -1/m1;
        n2 = rInt(-3, 3);
    } else {
        do { m2 = niceSlope(); } while (m2 === m1);
        n2 = rInt(-3, 3);
    }
    let ix = null, iy = null;
    if (subtipo === 'INTERSECCION') {
        ix = Math.round((n2 - n1) / (m1 - m2) * 100) / 100;
        iy = Math.round((m1 * ix + n1) * 100) / 100;
    }
    const g1 = toGeneralForm(m1, n1);
    const g2 = toGeneralForm(m2, n2);
    return { tipo: 'GENERAL', m1, n1, m2, n2, g1, g2, subtipo,
        paralelas: subtipo==='PARALELAS', perpendiculares: subtipo==='PERPENDICULARES', ix, iy };
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
            {!disabled && studentPoints.length < 2 && eq?.tipo !== 'GRAFICA' && (
                <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(44,62,80,0.75)', color:'white', padding:'4px 12px', borderRadius:20, fontSize:'0.75rem', pointerEvents:'none', whiteSpace:'nowrap' }}>
                    {studentPoints.length === 0 ? 'Haz clic para marcar el 1.er punto' : 'Haz clic para marcar el 2.º punto'}
                </div>
            )}
        </div>
    );
}

// ─── EJERCICIO GENÉRICO ───────────────────────────────────────────────────────
// ─── MODAL ENVIAR AL PROFESOR ────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    // datos: { tipo, jugadores:[{nombre,puntos,correcto}] } | { tipo, correcto, tipoEjercicio }
    const [nombre,   setNombre]   = useState('');
    const [curso,    setCurso]    = useState('');
    const [codigo,   setCodigo]   = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const esLive = !!datos.jugadores;

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!esLive && !nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }

            const tienePct = datos.porcentaje !== undefined;
            const jugadoresInforme = esLive
                ? datos.jugadores
                : [{ nombre: nombre.trim(), curso: curso.trim(),
                     correcto: tienePct ? datos.porcentaje === 100 : datos.correcto,
                     porcentaje: tienePct ? datos.porcentaje : (datos.correcto ? 100 : 0),
                     tipoEjercicio: datos.tipoEjercicio,
                     puntos: tienePct ? datos.porcentaje : (datos.correcto ? 1 : 0) }];

            await addDoc(collection(db, 'informes_juegos'), {
                tipo:           'FUNCIONES',
                modalidad:      esLive ? 'Online' : datos.tipoEjercicio || 'Individual',
                fecha:          new Date(),
                codigoProfesor: code,
                config:         datos.tipoEjercicio ? { tipoEjercicio: datos.tipoEjercicio } : undefined,
                jugadores:      jugadoresInforme,
            });
            setEnviado(true);
        } catch(e) {
            console.error(e);
            setError('Error al enviar: ' + e.message);
        }
        setEnviando(false);
    };

    const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };

    return (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(8,12,24,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'0 30px 80px rgba(0,0,0,0.5)', padding:'26px 28px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.1rem' }}>📤 Enviar resultados al profesor</h3>
                    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#95a5a6', fontSize:'1.2rem' }}>✕</button>
                </div>

                {enviado ? (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                        <CheckCircle size={48} color="#27ae60" style={{ marginBottom:10 }}/>
                        <div style={{ color:'#27ae60', fontWeight:700, fontSize:'1.05rem' }}>¡Informe enviado!</div>
                        {!esLive && datos.porcentaje !== undefined && (
                            <div style={{ marginTop:8, fontSize:'1.6rem', fontWeight:900, color: datos.porcentaje===100?'#27ae60':datos.porcentaje>=50?'#e67e22':'#e74c3c' }}>
                                {datos.porcentaje}%
                            </div>
                        )}
                        <button onClick={onClose} style={{ marginTop:12, padding:'9px 22px', borderRadius:10, border:'none', background:'#f0f0f0', cursor:'pointer', fontFamily:'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {!esLive && (
                            <>
                                <div>
                                    <label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Nombre y apellido</label>
                                    <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp}
                                        onFocus={e=>e.target.style.borderColor='#3498db'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/>
                                </div>
                                <div>
                                    <label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Curso</label>
                                    <input value={curso} onChange={e=>setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp}
                                        onFocus={e=>e.target.style.borderColor='#3498db'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/>
                                </div>
                            </>
                        )}
                        {esLive && (
                            <div style={{ background:'#f8f9fa', borderRadius:10, padding:'10px 12px', fontSize:'0.83rem', color:'#555', marginBottom:2 }}>
                                Se enviarán los resultados de <strong>{datos.jugadores.length}</strong> jugadores.
                            </div>
                        )}
                        <div>
                            <label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Código del profesor</label>
                            <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{...inp,letterSpacing:2,fontWeight:700}}
                                onFocus={e=>e.target.style.borderColor='#3498db'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/>
                        </div>
                        {error && <div style={{ color:'#e74c3c', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:5 }}>⚠ {error}</div>}
                        <div style={{ display:'flex', gap:9, marginTop:4 }}>
                            <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #ddd', background:'white', cursor:'pointer', fontFamily:'inherit', color:'#555' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:enviando?'#95a5a6':'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:enviando?'default':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:enviando?.7:1 }}>
                                <Send size={15}/>{enviando?'Enviando…':'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Ejercicio({ eq, onNuevo, onVolver, onLiveEnviar = null, silentCheckTrigger = null, liveMode = false }) {
    const [ansM, setAnsM] = useState('');
    const [ansN, setAnsN] = useState('');
    const [studentPts, setStudentPts] = useState([]);
    const [resultado, setResultado] = useState(null);  // null|'TODO_OK'|'M_FAIL'|'N_FAIL'|'LINEA_FAIL'|'LINEA_OK'
    const [mostrarSol, setMostrarSol] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [pctEnvio, setPctEnvio] = useState(0);

    const resetEstado = () => {
        setAnsM(''); setAnsN(''); setStudentPts([]);
        setResultado(null); setMostrarSol(false); setFeedback(null); setPctEnvio(0);
    };

    const handleNuevo = () => { resetEstado(); onNuevo(); };
    // Cálculo silencioso cuando el host lo pide (1s antes del fin)
    useEffect(() => {
        if (!silentCheckTrigger || !onLiveEnviar || resultado) return;
        const correctM = eq.mp ?? eq.m;
        const correctN = eq.np ?? eq.n;
        const mOk = eq.tipo === 'GRAFICA' ? approxEq(parseAnswer(ansM), eq.m) : approxEq(parseAnswer(ansM), correctM);
        const nOk = eq.tipo === 'GRAFICA' ? approxEq(parseAnswer(ansN), eq.n) : approxEq(parseAnswer(ansN), correctN);
        const ratio = (mOk ? 0.5 : 0) + (nOk ? 0.5 : 0);
        onLiveEnviar(ratio, true); // silent=true
    }, [silentCheckTrigger]);


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

        // Para GRAFICA, la recta ya está mostrada — no se exige dibujar
        let lineaOk = eq.tipo === 'GRAFICA';
        if (!lineaOk && studentPts.length === 2) {
            const [p1, p2] = studentPts;
            const dx = p2.mx - p1.mx;
            if (dx !== 0) {
                const mS = (p2.my - p1.my) / dx;
                const nS = p1.my - mS * p1.mx;
                lineaOk = approxEq(mS, correctM, 0.1) && approxEq(nS, correctN, 0.3);
            }
        }

        const msgs = [];
        if (!mOk) msgs.push('La pendiente m no es correcta.');
        if (!nOk) msgs.push('La ordenada en el origen n no es correcta.');
        if (eq.tipo !== 'GRAFICA') {
            if (studentPts.length < 2) msgs.push('Dibuja la recta en el canvas (2 puntos).');
            else if (!lineaOk) msgs.push('El dibujo de la recta no coincide.');
        }

        const ratio = eq.tipo === 'GRAFICA'
            ? ((mOk ? 1 : 0) + (nOk ? 1 : 0)) / 2
            : ((mOk ? 1 : 0) + (nOk ? 1 : 0) + (lineaOk ? 1 : 0)) / 3;
        setPctEnvio(Math.round(ratio * 100));
        if (mOk && nOk && lineaOk) {
            setResultado('TODO_OK');
            setFeedback(null);
        } else {
            setResultado(lineaOk ? 'LINEA_OK' : 'LINEA_FAIL');
            setFeedback(msgs);
        }
        if (onLiveEnviar) onLiveEnviar(ratio);
    };

    const correctM = eq.mp ?? eq.m;
    const correctN = eq.np ?? eq.n;

    return (
        <>
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
                                <CheckCircle size={22} /> ¡Correcto! — 100%
                        </div>
                        ) : (
                                    <>
                                        <div style={st.feedbackFail}>
                                            <XCircle size={18} style={{ flexShrink: 0 }} />
                                            <div>
                                                {feedback?.map((f, i) => <div key={i}>{f}</div>)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#e67e22', marginTop: 6 }}>Nota: {pctEnvio}%</div>
                                    </>
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

                    {!liveMode && <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
                        <button onClick={handleNuevo} style={st.btnNuevo}><RefreshCw size={15} /> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={15} /> Volver</button>
                        {resultado && <button onClick={()=>setMostrarEnvio(true)} style={{ ...st.btnNuevo, background:'#2980b9', color:'white', border:'none' }}><Send size={13}/> Profe</button>}
                    </div>}
                    {liveMode && resultado && <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.82rem', textAlign:'center', marginTop:8 }}>Esperando al resto...</div>}
                </div>
            </div>
        </div>
        {mostrarEnvio && <ModalEnviarProfe datos={{ porcentaje: pctEnvio, tipoEjercicio: eq.tipo }} onClose={()=>setMostrarEnvio(false)}/>}
        </>
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

// ─── CANVAS VECTOR ───────────────────────────────────────────────────────────
function VectorCanvas({ eq, arrowPts, onPointClick, disabled, resultado }) {
    const canvasRef = useRef(null);
    const draw = useCallback(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,CS,CS);
        ctx.fillStyle='#f8f9ff'; ctx.fillRect(0,0,CS,CS);
        // cuadrícula
        ctx.strokeStyle='#dde1f5'; ctx.lineWidth=0.8;
        for (let i=-RANGE;i<=RANGE;i++) {
            const {x}=toCanvas(i,0); const {y}=toCanvas(0,i);
            ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CS); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CS,y); ctx.stroke();
        }
        // ejes
        ctx.strokeStyle='#2c3e50'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,OY); ctx.lineTo(CS,OY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OX,0); ctx.lineTo(OX,CS); ctx.stroke();
        ctx.fillStyle='#2c3e50';
        ctx.beginPath(); ctx.moveTo(CS,OY); ctx.lineTo(CS-8,OY-5); ctx.lineTo(CS-8,OY+5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(OX,0); ctx.lineTo(OX-5,8); ctx.lineTo(OX+5,8); ctx.fill();
        // etiquetas
        ctx.fillStyle='#7f8c8d'; ctx.font='11px Georgia,serif'; ctx.textAlign='center';
        for (let i=-RANGE+1;i<=RANGE-1;i++) { if(i===0)continue; const{x}=toCanvas(i,0); ctx.fillText(i,x,OY+15); }
        ctx.textAlign='right';
        for (let i=-RANGE+1;i<=RANGE-1;i++) { if(i===0)continue; const{y}=toCanvas(0,i); ctx.fillText(i,OX-5,y+4); }
        ctx.textAlign='center'; ctx.fillText('x',CS-5,OY-10); ctx.fillText('y',OX+12,10); ctx.fillText('0',OX-10,OY+14);
        // puntos del enunciado A y B
        if (eq) {
            [[eq.ax,eq.ay,'A'],[eq.bx,eq.by,'B']].forEach(([mx,my,lbl])=>{
                const {x,y}=toCanvas(mx,my);
                ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2);
                ctx.fillStyle='#2c3e50'; ctx.fill();
                ctx.font='bold 13px Georgia,serif'; ctx.fillStyle='#2c3e50'; ctx.textAlign='left';
                ctx.fillText(`${lbl}(${mx},${my})`,x+9,y-8);
            });
        }
        // flecha del alumno
        if (arrowPts && arrowPts.length===2) {
            const p1=arrowPts[0], p2=arrowPts[1];
            const {x:x1,y:y1}=toCanvas(p1.mx,p1.my);
            const {x:x2,y:y2}=toCanvas(p2.mx,p2.my);
            const ok = resultado==='OK', fail = resultado==='FAIL';
            const col = ok ? '#27ae60' : fail ? '#e74c3c' : '#e67e22';
            ctx.save();
            ctx.strokeStyle=col; ctx.lineWidth=2.5;
            ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            // punta de flecha
            const ang=Math.atan2(y2-y1,x2-x1);
            const hs=10;
            ctx.fillStyle=col;
            ctx.beginPath();
            ctx.moveTo(x2,y2);
            ctx.lineTo(x2-hs*Math.cos(ang-0.4),y2-hs*Math.sin(ang-0.4));
            ctx.lineTo(x2-hs*Math.cos(ang+0.4),y2-hs*Math.sin(ang+0.4));
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        // puntos del alumno (marcados)
        if (arrowPts) arrowPts.forEach((p,i)=>{
            const {x,y}=toCanvas(p.mx,p.my);
            ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2);
            ctx.fillStyle=i===0?'#3498db':'#e67e22'; ctx.fill();
            ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke();
        });
    },[eq,arrowPts,resultado]);
    useEffect(()=>{draw();},[draw]);
    const handleClick = (e) => {
        if (disabled) return;
        const rect=canvasRef.current.getBoundingClientRect();
        const cx=(e.clientX-rect.left)*(CS/rect.width);
        const cy=(e.clientY-rect.top)*(CS/rect.height);
        const {x:mx,y:my}=toMath(cx,cy);
        const snX=Math.round(mx),snY=Math.round(my);
        if (Math.abs(snX)<=RANGE&&Math.abs(snY)<=RANGE) onPointClick({mx:snX,my:snY});
    };
    return (
        <div style={{position:'relative',display:'inline-block'}}>
            <canvas ref={canvasRef} width={CS} height={CS} onClick={handleClick}
                style={{width:CS,height:CS,cursor:disabled?'default':'crosshair',borderRadius:10,
                    boxShadow:'0 4px 20px rgba(0,0,0,0.12)',display:'block',
                    border:resultado==='OK'?'3px solid #27ae60':resultado==='FAIL'?'3px solid #e74c3c':'3px solid #e0e4f0'}}/>
            {!disabled && arrowPts && arrowPts.length<2 && (
                <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',
                    background:'rgba(44,62,80,0.75)',color:'white',padding:'4px 12px',borderRadius:20,
                    fontSize:'0.75rem',pointerEvents:'none',whiteSpace:'nowrap'}}>
                    {arrowPts.length===0?'Haz clic en el punto de inicio del vector':'Haz clic en el punto final del vector'}
                </div>
            )}
        </div>
    );
}

// ─── EJERCICIO VECTOR ─────────────────────────────────────────────────────────
function EjercicioVector({ eq, onNuevo, onVolver, onLiveEnviar = null, silentCheckTrigger = null, liveMode = false }) {
    const [arrowPts, setArrowPts] = useState([]);
    const [ansVx, setAnsVx] = useState('');
    const [ansVy, setAnsVy] = useState('');
    const [ansMod, setAnsMod] = useState('');
    const [ansAng, setAnsAng] = useState('');
    const [resultado, setResultado] = useState(null);
    const [errores, setErrores] = useState([]);
    const [mostrarSol, setMostrarSol] = useState(false);

    const [pctEnvio, setPctEnvio] = useState(0);
    const reset = () => { setArrowPts([]); setAnsVx(''); setAnsVy(''); setAnsMod(''); setAnsAng(''); setResultado(null); setErrores([]); setMostrarSol(false); setPctEnvio(0); };
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    useEffect(() => {
        if (!silentCheckTrigger || !onLiveEnviar || resultado) return;
        const tol = 0.11;
        const vxOk = Math.abs(parseAnswer(ansVx) - eq.vx) <= tol;
        const vyOk = Math.abs(parseAnswer(ansVy) - eq.vy) <= tol;
        const modOk = Math.abs(parseAnswer(ansMod) - eq.modulo) <= 0.15;
        const angEst = parseAnswer(ansAng);
        const angOk = Math.abs(angEst-eq.angulo)<=1||Math.abs(angEst-eq.angulo-360)<=1||Math.abs(angEst-eq.angulo+360)<=1;
        const items = [arrowPts.length===2, vxOk, vyOk, modOk, angOk];
        onLiveEnviar(items.filter(Boolean).length / items.length, true);
    }, [silentCheckTrigger]);


    const handlePoint = (pt) => {
        if (resultado) return;
        setArrowPts(prev => prev.length >= 2 ? [pt] : [...prev, pt]);
    };

    const comprobar = () => {
        const tol = 0.2;
        const errs = [];
        // Comprobar flecha
        if (arrowPts.length < 2) errs.push('Dibuja el vector haciendo clic en el punto inicial y final.');
        else {
            const drawn = { vx: arrowPts[1].mx - arrowPts[0].mx, vy: arrowPts[1].my - arrowPts[0].my };
            if (Math.abs(drawn.vx - eq.vx) > 0.5 || Math.abs(drawn.vy - eq.vy) > 0.5)
                errs.push('El vector dibujado no coincide con el vector AB. Haz clic primero en A, luego en B.');
        }
        if (Math.abs(parseAnswer(ansVx) - eq.vx) > tol) errs.push(`La componente x del vector no es correcta.`);
        if (Math.abs(parseAnswer(ansVy) - eq.vy) > tol) errs.push(`La componente y del vector no es correcta.`);
        if (Math.abs(parseAnswer(ansMod) - eq.modulo) > 0.15) errs.push(`El módulo del vector no es correcto (redondea a 2 decimales).`);
        // ángulo: acepta el ángulo normalizado y también el equivalente positivo
        const angEst = parseAnswer(ansAng);
        const angOk = Math.abs(angEst - eq.angulo) <= 1 || Math.abs(angEst - eq.angulo - 360) <= 1 || Math.abs(angEst - eq.angulo + 360) <= 1;
        if (!angOk) errs.push(`El ángulo respecto al eje X no es correcto (en grados, con signo).`);

        const items2 = [
            errs.filter(e=>e.includes('vector dibujado')).length===0 && arrowPts.length===2,
            errs.filter(e=>e.includes('componente x')).length===0,
            errs.filter(e=>e.includes('componente y')).length===0,
            errs.filter(e=>e.includes('módulo')).length===0,
            errs.filter(e=>e.includes('ángulo')).length===0,
        ];
        const ratio2 = errs.length === 0 ? 1 : items2.filter(Boolean).length / items2.length;
        setPctEnvio(Math.round(ratio2 * 100));
        if (errs.length === 0) setResultado('OK');
        else { setResultado('FAIL'); setErrores(errs); }
        if (onLiveEnviar) onLiveEnviar(ratio2);
    };

    return (
        <>
        <div style={st.ejercicioWrap}>
            {resultado === 'OK' && <Confetti recycle={false} numberOfPieces={200} />}
            <div style={st.enunciado}>
                Dados los puntos <strong>A({eq.ax}, {eq.ay})</strong> y <strong>B({eq.bx}, {eq.by})</strong>,
                calcula el vector <strong>AB⃗</strong>, su módulo y el ángulo con el eje X.
                <div style={{fontSize:'0.82rem',color:'#5a6a9a',marginTop:6}}>
                    Haz clic primero en A y luego en B para dibujar el vector.
                </div>
            </div>
            <div style={{display:'flex',gap:24,flexWrap:'wrap',justifyContent:'center'}}>
                <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'center'}}>
                    <VectorCanvas eq={eq} arrowPts={arrowPts} onPointClick={handlePoint} disabled={!!resultado} resultado={resultado}/>
                    {arrowPts.length>0 && !resultado && (
                        <button onClick={()=>setArrowPts([])} style={st.btnClear}>↺ Borrar vector</button>
                    )}
                </div>
                <div style={st.panelRespuestas}>
                    <div style={st.inputLabel}>Vector <strong>AB⃗</strong> = (x, y)</div>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                        <span style={{fontSize:'0.82rem',color:'#5a6a9a'}}>x =</span>
                        <input style={{...st.mathInput,width:70}} value={ansVx} onChange={e=>setAnsVx(e.target.value)} disabled={!!resultado} placeholder="ej: 3"/>
                        <span style={{fontSize:'0.82rem',color:'#5a6a9a'}}>y =</span>
                        <input style={{...st.mathInput,width:70}} value={ansVy} onChange={e=>setAnsVy(e.target.value)} disabled={!!resultado} placeholder="ej: -2"/>
                    </div>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>Módulo |AB⃗| =</label>
                        <input style={st.mathInput} value={ansMod} onChange={e=>setAnsMod(e.target.value)} disabled={!!resultado} placeholder="ej: 3.61"/>
                    </div>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>Ángulo con eje X (grados) =</label>
                        <input style={st.mathInput} value={ansAng} onChange={e=>setAnsAng(e.target.value)} disabled={!!resultado} placeholder="ej: -33.69"/>
                    </div>
                    {!resultado ? (
                        <button onClick={comprobar} style={st.btnComprobar}><CheckCircle size={17}/> Comprobar</button>
                    ) : resultado==='OK' ? (
                        <div style={st.feedbackOk}><CheckCircle size={22}/> ¡Correcto!</div>
                    ) : (
                        <div style={st.feedbackFail}><XCircle size={18} style={{flexShrink:0}}/><div>{errores.map((e,i)=><div key={i}>{e}</div>)}</div></div>
                    )}
                    {resultado==='FAIL' && (
                        <button onClick={()=>setMostrarSol(b=>!b)} style={st.btnVerSol}>{mostrarSol?'Ocultar solución':'Ver solución'}</button>
                    )}
                    {mostrarSol && (
                        <div style={st.solucionBox}>
                            <strong>Solución:</strong><br/>
                            AB⃗ = ({eq.vx}, {eq.vy})<br/>
                            |AB⃗| = {Math.round(eq.modulo*100)/100}<br/>
                            Ángulo = {eq.angulo}°
                        </div>
                    )}
                    {!liveMode && <div style={{display:'flex',gap:8,marginTop:'auto'}}>
                        <button onClick={()=>{reset();onNuevo();}} style={st.btnNuevo}><RefreshCw size={15}/> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={15}/> Volver</button>
                        {resultado && <button onClick={()=>setMostrarEnvio(true)} style={{...st.btnVolver,background:'#2980b9',color:'white',border:'none'}}>📤 Profe</button>}
                    </div>}
                    {liveMode && resultado && <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.82rem', textAlign:'center', marginTop:8 }}>Esperando al resto...</div>}
                </div>
            </div>
        </div>
        {mostrarEnvio && <ModalEnviarProfe datos={{ porcentaje: pctEnvio, tipoEjercicio:'VECTOR' }} onClose={()=>setMostrarEnvio(false)}/>}
        </>
    );
}

// ─── CANVAS GENERAL (dos rectas) ──────────────────────────────────────────────
function GeneralCanvas({ eq, linePts, onPointClick, disabled, resultado, mostrarSolucion }) {
    const canvasRef = useRef(null);
    const draw = useCallback(() => {
        const canvas=canvasRef.current; if(!canvas)return;
        const ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,CS,CS);
        ctx.fillStyle='#f8f9ff'; ctx.fillRect(0,0,CS,CS);
        ctx.strokeStyle='#dde1f5'; ctx.lineWidth=0.8;
        for(let i=-RANGE;i<=RANGE;i++){
            const{x}=toCanvas(i,0);const{y}=toCanvas(0,i);
            ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CS);ctx.stroke();
            ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CS,y);ctx.stroke();
        }
        ctx.strokeStyle='#2c3e50';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,OY);ctx.lineTo(CS,OY);ctx.stroke();
        ctx.beginPath();ctx.moveTo(OX,0);ctx.lineTo(OX,CS);ctx.stroke();
        ctx.fillStyle='#2c3e50';
        ctx.beginPath();ctx.moveTo(CS,OY);ctx.lineTo(CS-8,OY-5);ctx.lineTo(CS-8,OY+5);ctx.fill();
        ctx.beginPath();ctx.moveTo(OX,0);ctx.lineTo(OX-5,8);ctx.lineTo(OX+5,8);ctx.fill();
        ctx.fillStyle='#7f8c8d';ctx.font='11px Georgia,serif';ctx.textAlign='center';
        for(let i=-RANGE+1;i<=RANGE-1;i++){if(i===0)continue;const{x}=toCanvas(i,0);ctx.fillText(i,x,OY+15);}
        ctx.textAlign='right';
        for(let i=-RANGE+1;i<=RANGE-1;i++){if(i===0)continue;const{y}=toCanvas(0,i);ctx.fillText(i,OX-5,y+4);}
        ctx.textAlign='center';ctx.fillText('x',CS-5,OY-10);ctx.fillText('y',OX+12,10);ctx.fillText('0',OX-10,OY+14);
        // helper para dibujar una recta dados dos puntos del alumno
        const drawStudentLine = (p1,p2,col,idx)=>{
            const dx=p2.mx-p1.mx;
            if(dx===0) return;
            const mS=(p2.my-p1.my)/dx, nS=p1.my-mS*p1.mx;
            const pts2=[];
            let yv=mS*(-RANGE)+nS; if(yv>=-RANGE&&yv<=RANGE)pts2.push(toCanvas(-RANGE,yv));
            yv=mS*RANGE+nS; if(yv>=-RANGE&&yv<=RANGE)pts2.push(toCanvas(RANGE,yv));
            if(mS!==0){const xv=(-RANGE-nS)/mS;if(xv>=-RANGE&&xv<=RANGE)pts2.push(toCanvas(xv,-RANGE));const xv2=(RANGE-nS)/mS;if(xv2>=-RANGE&&xv2<=RANGE)pts2.push(toCanvas(xv2,RANGE));}
            if(pts2.length<2)return;
            ctx.save();ctx.strokeStyle=col;ctx.lineWidth=2.2;
            ctx.beginPath();ctx.moveTo(pts2[0].x,pts2[0].y);ctx.lineTo(pts2[1].x,pts2[1].y);ctx.stroke();
            ctx.font='bold 11px Georgia,serif';ctx.fillStyle=col;ctx.textAlign='center';
            ctx.fillText(`r${idx+1}`,pts2[1].x-10,pts2[1].y-8);
            ctx.restore();
        };
        // Dibujar rectas del alumno
        if(linePts[0]&&linePts[1]) drawStudentLine(linePts[0],linePts[1],'#e67e22',0);
        if(linePts[2]&&linePts[3]) drawStudentLine(linePts[2],linePts[3],'#9b59b6',1);
        // Mostrar solución
        if(mostrarSolucion&&eq){
            const drawRef=(m,n,col)=>{
                const pts2=[];
                let yv=m*(-RANGE)+n;if(yv>=-RANGE&&yv<=RANGE)pts2.push(toCanvas(-RANGE,yv));
                yv=m*RANGE+n;if(yv>=-RANGE&&yv<=RANGE)pts2.push(toCanvas(RANGE,yv));
                if(m!==0){const xv=(-RANGE-n)/m;if(xv>=-RANGE&&xv<=RANGE)pts2.push(toCanvas(xv,-RANGE));const xv2=(RANGE-n)/m;if(xv2>=-RANGE&&xv2<=RANGE)pts2.push(toCanvas(xv2,RANGE));}
                if(pts2.length<2)return;
                ctx.save();ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.setLineDash([6,3]);
                ctx.beginPath();ctx.moveTo(pts2[0].x,pts2[0].y);ctx.lineTo(pts2[1].x,pts2[1].y);ctx.stroke();
                ctx.setLineDash([]);ctx.restore();
            };
            drawRef(eq.m1,eq.n1,'#27ae60');drawRef(eq.m2,eq.n2,'#27ae60');
        }
        // puntos del alumno
        linePts.forEach((p,i)=>{
            if(!p)return;
            const{x,y}=toCanvas(p.mx,p.my);
            ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);
            ctx.fillStyle=i<2?'#e67e22':'#9b59b6';ctx.fill();
            ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();
        });
    },[eq,linePts,resultado,mostrarSolucion]);
    useEffect(()=>{draw();},[draw]);
    const handleClick=(e)=>{
        if(disabled)return;
        const rect=canvasRef.current.getBoundingClientRect();
        const cx=(e.clientX-rect.left)*(CS/rect.width);
        const cy=(e.clientY-rect.top)*(CS/rect.height);
        const{x:mx,y:my}=toMath(cx,cy);
        const snX=Math.round(mx),snY=Math.round(my);
        if(Math.abs(snX)<=RANGE&&Math.abs(snY)<=RANGE) onPointClick({mx:snX,my:snY});
    };
    const n = linePts.filter(Boolean).length;
    const hints = ['Marca 1.er punto de r₁','Marca 2.º punto de r₁','Marca 1.er punto de r₂','Marca 2.º punto de r₂'];
    return (
        <div style={{position:'relative',display:'inline-block'}}>
            <canvas ref={canvasRef} width={CS} height={CS} onClick={handleClick}
                style={{width:CS,height:CS,cursor:disabled?'default':'crosshair',borderRadius:10,
                    boxShadow:'0 4px 20px rgba(0,0,0,0.12)',display:'block',
                    border:resultado==='OK'?'3px solid #27ae60':resultado==='FAIL'?'3px solid #e74c3c':'3px solid #e0e4f0'}}/>
            {!disabled && n<4 && (
                <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',
                    background:'rgba(44,62,80,0.75)',color:'white',padding:'4px 12px',borderRadius:20,
                    fontSize:'0.75rem',pointerEvents:'none',whiteSpace:'nowrap'}}>{hints[n]}</div>
            )}
        </div>
    );
}

// ─── EJERCICIO GENERAL ────────────────────────────────────────────────────────
function EjercicioGeneral({ eq, onNuevo, onVolver, onLiveEnviar = null, silentCheckTrigger = null, liveMode = false }) {
    const [linePts, setLinePts] = useState([null,null,null,null]);
    const [ansPar, setAnsPar] = useState(null);   // true/false
    const [ansPerp, setAnsPerp] = useState(null);
    const [ansIx, setAnsIx] = useState('');
    const [ansIy, setAnsIy] = useState('');
    const [noInter, setNoInter] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [errores, setErrores] = useState([]);
    const [mostrarSol, setMostrarSol] = useState(false);

    const [pctEnvio, setPctEnvio] = useState(0);
    const reset = () => { setLinePts([null,null,null,null]); setAnsPar(null); setAnsPerp(null); setAnsIx(''); setAnsIy(''); setNoInter(false); setResultado(null); setErrores([]); setMostrarSol(false); setPctEnvio(0); };
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    useEffect(() => {
        if (!silentCheckTrigger || !onLiveEnviar || resultado) return;
        const tol = 0.11;
        const parOk  = ansPar === eq.paralelas;
        const perpOk = ansPerp === eq.perpendiculares;
        const ixOk   = eq.paralelas ? noInter : Math.abs(parseAnswer(ansIx) - eq.ix) <= tol;
        const iyOk   = eq.paralelas ? noInter : Math.abs(parseAnswer(ansIy) - eq.iy) <= tol;
        const items  = [parOk, perpOk, ixOk, iyOk];
        onLiveEnviar(items.filter(Boolean).length / items.length, true);
    }, [silentCheckTrigger]);


    const handlePoint = (pt) => {
        if (resultado) return;
        setLinePts(prev => {
            const next = [...prev];
            const idx = next.findIndex(p => p===null);
            if (idx === -1) return next;
            next[idx] = pt;
            return next;
        });
    };

    // Valida que una recta dibujada (p1,p2) coincide con y=mx+n (tolerancia)
    const lineMatchesMN = (p1, p2, m, n, tol=0.25) => {
        if (!p1||!p2) return false;
        const dx=p2.mx-p1.mx; if(dx===0) return false;
        const mS=(p2.my-p1.my)/dx, nS=p1.my-mS*p1.mx;
        return Math.abs(mS-m)<=tol && Math.abs(nS-n)<=tol*2;
    };

    const comprobar = () => {
        const tol=0.12;
        const errs=[];
        // 1. Rectas dibujadas
        const l1drawn = linePts[0] && linePts[1];
        const l2drawn = linePts[2] && linePts[3];
        let drawOk = false;
        if (!l1drawn || !l2drawn) { errs.push('Dibuja las dos rectas (2 puntos por recta).'); }
        else {
            const m1r1 = lineMatchesMN(linePts[0], linePts[1], eq.m1, eq.n1);
            const m1r2 = lineMatchesMN(linePts[0], linePts[1], eq.m2, eq.n2);
            const m2r1 = lineMatchesMN(linePts[2], linePts[3], eq.m1, eq.n1);
            const m2r2 = lineMatchesMN(linePts[2], linePts[3], eq.m2, eq.n2);
            drawOk = (m1r1 && m2r2) || (m1r2 && m2r1);
            if (!drawOk) errs.push('Una o las dos rectas dibujadas no coinciden con las ecuaciones dadas.');
        }
        // 2. Paralelas
        let parOk = false;
        if (ansPar === null) errs.push('Indica si las rectas son paralelas.');
        else if (ansPar !== eq.paralelas) errs.push(`Las rectas ${eq.paralelas ? 'sí son' : 'no son'} paralelas.`);
        else parOk = true;
        // 3. Perpendiculares
        let perpOk = false;
        if (ansPerp === null) errs.push('Indica si las rectas son perpendiculares.');
        else if (ansPerp !== eq.perpendiculares) errs.push(`Las rectas ${eq.perpendiculares ? 'sí son' : 'no son'} perpendiculares.`);
        else perpOk = true;
        // 4+. Intersección
        let interItems;
        if (eq.paralelas) {
            const noInterOk = noInter;
            if (!noInter) errs.push('Las rectas paralelas no se cortan. Marca "No hay intersección".');
            interItems = [noInterOk];
        } else {
            if (noInter) {
                errs.push('Estas rectas sí tienen punto de intersección.');
                interItems = [false, false];
            } else {
                const ixOk = Math.abs(parseAnswer(ansIx) - eq.ix) <= tol;
                const iyOk = Math.abs(parseAnswer(ansIy) - eq.iy) <= tol;
                if (!ixOk) errs.push('La coordenada x del punto de intersección no es correcta.');
                if (!iyOk) errs.push('La coordenada y del punto de intersección no es correcta.');
                interItems = [ixOk, iyOk];
            }
        }
        const allItems = [drawOk, parOk, perpOk, ...interItems];
        const ratioG = errs.length === 0 ? 1 : allItems.filter(Boolean).length / allItems.length;

        setPctEnvio(Math.round(ratioG * 100));
        if (errs.length===0) setResultado('OK');
        else { setResultado('FAIL'); setErrores(errs); }
        if (onLiveEnviar) onLiveEnviar(ratioG);
    };

    const btnYN = (val, current, set, disabled) => (
        <div style={{display:'flex',gap:8}}>
            {[[true,'Sí'],[false,'No']].map(([v,lbl])=>(
                <button key={String(v)} onClick={()=>!disabled&&set(v)}
                    style={{flex:1,padding:'7px',borderRadius:8,border:`2px solid ${current===v?'#3498db':'#dde2f0'}`,
                        background:current===v?'#ebf5fb':'white',cursor:'pointer',fontWeight:current===v?'bold':'normal',
                        fontSize:'0.82rem',color:current===v?'#1a5276':'#555',fontFamily:'inherit'}}>{lbl}</button>
            ))}
        </div>
    );

    return (
        <>
        <div style={st.ejercicioWrap}>
            {resultado==='OK'&&<Confetti recycle={false} numberOfPieces={200}/>}
            <div style={st.enunciado}>
                Dadas las ecuaciones:<br/>
                <strong style={{fontSize:'1.05em'}}>r₁: {fmtGeneral(eq.g1)}</strong> &nbsp;&nbsp;
                <strong style={{fontSize:'1.05em'}}>r₂: {fmtGeneral(eq.g2)}</strong><br/>
                <span style={{fontSize:'0.82rem',color:'#5a6a9a'}}>Dibuja las dos rectas y responde las preguntas.</span>
            </div>
            <div style={{display:'flex',gap:24,flexWrap:'wrap',justifyContent:'center'}}>
                <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'center'}}>
                    <GeneralCanvas eq={eq} linePts={linePts} onPointClick={handlePoint}
                        disabled={!!resultado} resultado={resultado} mostrarSolucion={mostrarSol}/>
                    {linePts.some(Boolean)&&!resultado&&(
                        <button onClick={()=>setLinePts([null,null,null,null])} style={st.btnClear}>↺ Borrar dibujo</button>
                    )}
                </div>
                <div style={st.panelRespuestas}>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>¿Son paralelas?</label>
                        {btnYN(null,ansPar,setAnsPar,!!resultado)}
                    </div>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>¿Son perpendiculares?</label>
                        {btnYN(null,ansPerp,setAnsPerp,!!resultado)}
                    </div>
                    <div style={st.inputGroup}>
                        <label style={st.inputLabel}>Punto de intersección</label>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:'0.82rem',marginTop:4}}>
                            <input type="checkbox" checked={noInter} onChange={e=>!resultado&&setNoInter(e.target.checked)} style={{width:14,height:14}}/>
                            No hay intersección (paralelas)
                        </label>
                        {!noInter&&(
                            <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                                <span style={{fontSize:'0.82rem',color:'#5a6a9a'}}>x =</span>
                                <input style={{...st.mathInput,width:70}} value={ansIx} onChange={e=>setAnsIx(e.target.value)} disabled={!!resultado} placeholder="ej: 2"/>
                                <span style={{fontSize:'0.82rem',color:'#5a6a9a'}}>y =</span>
                                <input style={{...st.mathInput,width:70}} value={ansIy} onChange={e=>setAnsIy(e.target.value)} disabled={!!resultado} placeholder="ej: 1"/>
                            </div>
                        )}
                    </div>
                    {!resultado?(
                        <button onClick={comprobar} style={st.btnComprobar}><CheckCircle size={17}/> Comprobar</button>
                        ) : resultado === 'OK' ? (
                            <div style={st.feedbackOk}><CheckCircle size={22} /> ¡Correcto! — 100%</div>
                        ) : (
                                    <>
                                        <div style={st.feedbackFail}><XCircle size={18} style={{ flexShrink: 0 }} /><div>{errores.map((e, i) => <div key={i}>{e}</div>)}</div></div>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#e67e22', marginTop: 6 }}>Nota: {pctEnvio}%</div>
                                    </>
                                )}
                    {resultado==='FAIL'&&(
                        <button onClick={()=>setMostrarSol(b=>!b)} style={st.btnVerSol}>{mostrarSol?'Ocultar solución':'Ver solución'}</button>
                    )}
                    {mostrarSol&&(
                        <div style={st.solucionBox}>
                            <strong>Solución:</strong><br/>
                            {eq.paralelas?'Paralelas: no se cortan':`Intersección: (${eq.ix}, ${eq.iy})`}<br/>
                            Paralelas: {eq.paralelas?'Sí':'No'} · Perpendiculares: {eq.perpendiculares?'Sí':'No'}
                        </div>
                    )}
                    <div style={{display:'flex',gap:8,marginTop:'auto',flexWrap:'wrap'}}>
                        <button onClick={()=>{reset();onNuevo();}} style={st.btnNuevo}><RefreshCw size={15}/> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={15}/> Volver</button>
                        {resultado && !liveMode && <button onClick={()=>setMostrarEnvio(true)} style={{...st.btnVolver,background:'#2980b9',color:'white',border:'none'}}>📤 Profe</button>}
                    </div>
                    {liveMode && resultado && <div style={{color:'rgba(255,255,255,0.5)',fontSize:'0.82rem',textAlign:'center',marginTop:8}}>Esperando al resto...</div>}
                </div>
            </div>
        </div>
        {mostrarEnvio && <ModalEnviarProfe datos={{ porcentaje: pctEnvio, tipoEjercicio:'GENERAL' }} onClose={()=>setMostrarEnvio(false)}/>}
        </>
    );
}

// ─── PANTALLA RECTAS ─────────────────────────────────────────────────────────
const TIPOS = [
    { id:'DOS_PUNTOS',    label:'Recta por dos puntos',       desc:'Dados A y B, encuentra y = mx + n', emoji:'📍', gen: genDosPuntos },
    { id:'PARALELA',      label:'Recta paralela a una dada',  desc:'Dada una recta y un punto P',        emoji:'⫸', gen: genParalela },
    { id:'PERPENDICULAR', label:'Recta perpendicular',        desc:'Encuentra la recta ⊥ por P',         emoji:'⊥', gen: genPerpendicular },
    { id:'GRAFICA',       label:'Recta por su gráfica',       desc:'Lee m y n de la representación',     emoji:'📈', gen: genGrafica },
    { id:'VECTOR',        label:'Vector entre dos puntos',    desc:'Componentes, módulo y ángulo de AB⃗', emoji:'➡️', gen: genVector },
    { id:'GENERAL',       label:'Forma general · relaciones', desc:'Paralelas, perpendiculares e intersección', emoji:'✕', gen: genGeneral },
];

function PantallaRectas({ onVolver }) {
    const [tipoActivo, setTipoActivo] = useState(null);
    const [eq, setEq] = useState(null);

    const iniciar = (tipo) => {
        setTipoActivo(tipo);
        setEq(tipo.gen());
    };

    if (tipoActivo && eq) {
        if (tipoActivo.id === 'VECTOR')
            return <EjercicioVector eq={eq} onNuevo={() => setEq(tipoActivo.gen())} onVolver={() => { setTipoActivo(null); setEq(null); }} />;
        if (tipoActivo.id === 'GENERAL')
            return <EjercicioGeneral eq={eq} onNuevo={() => setEq(tipoActivo.gen())} onVolver={() => { setTipoActivo(null); setEq(null); }} />;
        return (
            <Ejercicio
                eq={eq}
                onNuevo={() => setEq(tipoActivo.gen())}
                onVolver={() => { setTipoActivo(null); setEq(null); }}
            />
        );
    }

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

            {/* Vídeo explicativo */}
            <div style={{ width: '100%', maxWidth: 560, aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', marginTop: 20, marginLeft: 40, boxShadow: '20px 4px 20px rgba(0,0,0,0.2)' }}>
                <iframe
                    width="100%" height="100%"
                    src="https://www.youtube.com/embed/LBRPwvvobfA"
                    title="Ecuación de la recta"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
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
function ParabolaCanvas({ a, b, c, studentPoints = [], resultado = null, mostrarSolucion = false, onPointClick = null, clickable = false }) {
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

    const handleParClick = (e) => {
        if (!clickable || !onPointClick) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (CSP / rect.width);
        const cy = (e.clientY - rect.top)  * (CSP / rect.height);
        const mx = Math.round((cx - OXP) / SCP);
        const my = Math.round((OYP - cy) / SCP);
        if (Math.abs(mx) <= RANGE_P && Math.abs(my) <= RANGE_P) onPointClick({ x: mx, y: my });
    };

    return (
        <div style={{position:'relative',display:'inline-block'}}>
            <canvas ref={canvasRef} width={CSP} height={CSP} onClick={handleParClick}
                style={{
                    width: CSP, height: CSP, borderRadius: 10, display: 'block',
                    cursor: clickable ? 'crosshair' : 'default',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    border: resultado === 'OK' ? '3px solid #27ae60'
                          : resultado === 'FAIL' ? '3px solid #e74c3c'
                          : '3px solid #e0e4f0',
                }}
            />
            {clickable && studentPoints.length < 3 && (
                <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',
                    background:'rgba(44,62,80,0.75)',color:'white',padding:'3px 10px',borderRadius:20,
                    fontSize:'0.72rem',pointerEvents:'none',whiteSpace:'nowrap'}}>
                    {studentPoints.length} punto(s) marcado(s) · necesitas al menos 3
                </div>
            )}
        </div>
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
            { x: 0,        y: c },
            { x: otrasX[0], y: a*otrasX[0]**2 + b*otrasX[0] + c },
            { x: otrasX[1], y: a*otrasX[1]**2 + b*otrasX[1] + c },
        ];
    } while (pts.some(p => Math.abs(p.y) > 9));
    return { tipo: 'TRES_PUNTOS', a, b, c, pts };
};

// ─── Ejercicio ANÁLISIS ───────────────────────────────────────────────────────
function EjercicioAnalisis({ eq, onNuevo, onVolver, onLiveEnviar = null, silentCheckTrigger = null, liveMode = false }) {
    const { a, b, c, disc } = eq;
    const xv = -b / (2 * a);
    const yv = a * xv * xv + b * xv + c;

    const [forma, setForma]     = useState('');
    const [ansXv, setAnsXv]     = useState('');
    const [ansYv, setAnsYv]     = useState('');
    const [noCortes, setNoCortes] = useState(false);
    const [ansX1, setAnsX1]     = useState('');
    const [ansX2, setAnsX2]     = useState('');
    const [ansYeje, setAnsYeje] = useState('');
    const [resultado, setResultado] = useState(null);
    const [errores, setErrores]     = useState([]);
    const [mostrarSol, setMostrarSol] = useState(false);
    const [studentParPts, setStudentParPts] = useState([]);  // puntos marcados por el alumno

    const [pctEnvio, setPctEnvio] = useState(0);
    const reset = () => { setForma(''); setAnsXv(''); setAnsYv(''); setNoCortes(false); setAnsX1(''); setAnsX2(''); setAnsYeje(''); setResultado(null); setErrores([]); setMostrarSol(false); setStudentParPts([]); setPctEnvio(0); };
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    useEffect(() => {
        if (!silentCheckTrigger || !onLiveEnviar || resultado) return;
        const tol = 0.11;
        const formaOk = (a > 0 && forma === 'U') || (a < 0 && forma === 'N');
        const xvOk = Math.abs(parseAnswer(ansXv) - xv) <= tol;
        const yvOk = Math.abs(parseAnswer(ansYv) - yv) <= tol;
        const yejeOk = Math.abs(parseAnswer(ansYeje) - c) <= tol;
        const items = [formaOk, xvOk, yvOk, yejeOk];
        onLiveEnviar(items.filter(Boolean).length / items.length, true);
    }, [silentCheckTrigger]);


    const tol = 0.11;
    const numStr2 = (v) => Number.isInteger(v) ? `${v}` : (Math.round(v*100)/100).toString();


    // Puntos enteros visibles en la zona gráfica (x e y dentro de [-7,7])
    const ptsEnZona = Array.from({ length: 15 }, (_, i) => i - 7)
        .filter(x => { const y = a * x * x + b * x + c; return Math.abs(y) <= 7; });
    const minPuntos = Math.max(1, Math.min(3, ptsEnZona.length));




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

        let cortesOk = false;
        if (disc < 0) {
            cortesOk = noCortes;
            if (!noCortes) errs.push('Marca "No hay cortes con el eje X" (discriminante < 0).');
        } else if (disc === 0) {
            cortesOk = !noCortes && Math.abs(parseAnswer(ansX1) - x1sol) <= tol;
            if (!cortesOk) errs.push('El corte doble con el eje X no es correcto.');
        } else {
            if (noCortes) {
                errs.push('Sí hay cortes con el eje X (discriminante > 0).');
            } else {
                const vals = [parseAnswer(ansX1), parseAnswer(ansX2)].sort((x, y) => x - y);
                const sols = [x1sol, x2sol].sort((x, y) => x - y);
                cortesOk = Math.abs(vals[0] - sols[0]) <= tol && Math.abs(vals[1] - sols[1]) <= tol;
                if (!cortesOk) errs.push('Los cortes con el eje X no son correctos.');
            }
        }

        const yejeOk = Math.abs(parseAnswer(ansYeje) - c) <= tol;
        if (!yejeOk) errs.push('El corte con el eje Y no es correcto (es el valor de c).');

        // Validar puntos dibujados (mínimo 3 en la parábola)
        const ptsTol = 0.4;
        const ptsOk = studentParPts.filter(p => Math.abs(a*p.x*p.x + b*p.x + c - p.y) <= ptsTol);


        if (studentParPts.length < minPuntos) errs.push(`Marca al menos ${minPuntos} punto${minPuntos > 1 ? 's' : ''} por los que pasa la parábola.`);
        else if (ptsOk.length < minPuntos) errs.push(`Al menos ${minPuntos} de tus puntos deben estar sobre la parábola.`);

        const itemsA = [formaOk, xvOk, yvOk, cortesOk, yejeOk, ptsOk.length >= minPuntos];

        const ratioA = errs.length === 0 ? 1 : itemsA.filter(Boolean).length / itemsA.length;
        setPctEnvio(Math.round(ratioA * 100));
        if (errs.length === 0) setResultado('OK');
        else { setResultado('FAIL'); setErrores(errs); }
        if (onLiveEnviar) onLiveEnviar(ratioA);
    };

    const fmtPar = () => {
        const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        const bStr = b === 0 ? '' : b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`;
        const cStr = c === 0 ? '' : c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;
        return `y = ${aStr}x² ${bStr} ${cStr}`.replace(/\s+/g,' ').trim();
    };

    return (
        <>
        <div style={st.ejercicioWrap}>
            {resultado === 'OK' && <Confetti recycle={false} numberOfPieces={200} />}
            <div style={st.enunciado}>
                Analiza la parábola: <strong style={{ fontSize:'1.1em' }}>{fmtPar()}</strong>
            </div>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap', justifyContent:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                    <ParabolaCanvas a={resultado ? a : null} b={resultado ? b : null} c={resultado ? c : null}
                        resultado={resultado} mostrarSolucion={mostrarSol}
                        studentPoints={studentParPts}
                        onPointClick={(pt) => { if (!resultado) setStudentParPts(prev => [...prev, pt]); }}
                        clickable={!resultado}
                    />
                    {studentParPts.length>0 && !resultado && (
                        <button onClick={()=>setStudentParPts([])} style={st.btnClear}>↺ Borrar puntos</button>
                    )}
                        {!resultado && <div style={{ fontSize: '0.75rem', color: '#5a6a9a', textAlign: 'center', maxWidth: 180 }}>Haz clic para marcar puntos de la parábola (mín. {minPuntos})</div>}
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
                            <div style={st.feedbackOk}><CheckCircle size={22} /> ¡Correcto! — 100%</div>
                        ) : (
                                    <>
                                        <div style={st.feedbackFail}><XCircle size={18} style={{ flexShrink: 0 }} /><div>{errores.map((e, i) => <div key={i}>{e}</div>)}</div></div>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#e67e22', marginTop: 6 }}>Nota: {pctEnvio}%</div>
                                    </>
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
                    {!liveMode && <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => { reset(); onNuevo(); }} style={st.btnNuevo}><RefreshCw size={14} /> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={14} /> Volver</button>
                    </div>}
                    {liveMode && resultado && <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.82rem', textAlign:'center', marginTop:8 }}>Esperando al resto...</div>}
                    {!liveMode && resultado && <div style={{marginTop:6}}><button onClick={()=>setMostrarEnvio(true)} style={{...st.btnVolver,background:'#2980b9',color:'white',border:'none'}}>📤 Profe</button></div>}
                </div>
            </div>
        </div>
        {mostrarEnvio && <ModalEnviarProfe datos={{ porcentaje: pctEnvio, tipoEjercicio:'ANALISIS' }} onClose={()=>setMostrarEnvio(false)}/>}
        </>
    );
}

// ─── Ejercicio TRES PUNTOS ────────────────────────────────────────────────────
function EjercicioTresPuntos({ eq, onNuevo, onVolver, onLiveEnviar = null, silentCheckTrigger = null, liveMode = false }) {
    const { a, b, c, pts } = eq;

    const [ansA, setAnsA] = useState('');
    const [ansB, setAnsB] = useState('');
    const [ansC, setAnsC] = useState('');
    const [resultado, setResultado] = useState(null);
    const [errores, setErrores]     = useState([]);
    const [mostrarSol, setMostrarSol] = useState(false);

    const [parciales, setParciales] = useState({ aOk:false, bOk:false, cOk:false });
    const reset = () => { setAnsA(''); setAnsB(''); setAnsC(''); setResultado(null); setErrores([]); setMostrarSol(false); setParciales({aOk:false,bOk:false,cOk:false}); };
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    useEffect(() => {
        if (!silentCheckTrigger || !onLiveEnviar || resultado) return;
        const tol2 = 0.11;
        const aOk = ansA.trim()!=='' && Math.abs(parseAnswer(ansA)-a)<=tol2;
        const bOk = ansB.trim()!=='' && Math.abs(parseAnswer(ansB)-b)<=tol2;
        const cOk = ansC.trim()!=='' && Math.abs(parseAnswer(ansC)-c)<=tol2;
        onLiveEnviar([aOk,bOk,cOk].filter(Boolean).length / 3, true);
    }, [silentCheckTrigger]);


    const tol = 0.11;

    const comprobar = () => {
        if (!liveMode && (ansA.trim()==='' || ansB.trim()==='' || ansC.trim()==='')) {
            const aOkP = ansA.trim()!=='' && Math.abs(parseAnswer(ansA)-a)<=tol;
            const bOkP = ansB.trim()!=='' && Math.abs(parseAnswer(ansB)-b)<=tol;
            const cOkP = ansC.trim()!=='' && Math.abs(parseAnswer(ansC)-c)<=tol;
            setParciales({aOk:aOkP,bOk:bOkP,cOk:cOkP});
            const ac=[aOkP,bOkP,cOkP].filter(Boolean).length;
            setPctEnvio(Math.round(ac/3*1000)/10);
            setErrores(['⚠ Rellena todos los campos (a, b y c) antes de comprobar.']);
            setResultado('FAIL');
            return;
        }
        const errs = [];
        const aOk = Math.abs(parseAnswer(ansA) - a) <= tol;
        const bOk = Math.abs(parseAnswer(ansB) - b) <= tol;
        const cOk = Math.abs(parseAnswer(ansC) - c) <= tol;
        if (!aOk) errs.push(`El coeficiente a no es correcto.`);
        if (!bOk) errs.push(`El coeficiente b no es correcto.`);
        if (!cOk) errs.push(`El coeficiente c no es correcto.`);
        setParciales({ aOk, bOk, cOk });
        if (errs.length === 0) setResultado('OK');
        else { setResultado('FAIL'); setErrores(errs); }
    };

    const studentPoints = pts.map(p => ({ x: p.x, y: p.y }));

    const fmtPar = (aa, bb, cc) => {
        const aStr = aa === 1 ? '' : aa === -1 ? '-' : `${aa}`;
        const bStr = bb === 0 ? '' : bb > 0 ? ` + ${bb}x` : ` - ${Math.abs(bb)}x`;
        const cStr = cc === 0 ? '' : cc > 0 ? ` + ${cc}` : ` - ${Math.abs(cc)}`;
        return `y = ${aStr}x²${bStr}${cStr}`.replace(/\s+/g,' ').trim();
    };

    return (
        <>
        <div style={st.ejercicioWrap}>
            {resultado === 'OK' && <Confetti recycle={false} numberOfPieces={200} />}
            <div style={st.enunciado}>
                Encuentra la función <em>y = ax² + bx + c</em> cuya parábola pasa por los puntos:
                {' '}{pts.map((p, i) => <strong key={i}>{i > 0 ? ', ' : ''}({p.x}, {p.y})</strong>)}
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
                            <div style={st.feedbackOk}><CheckCircle size={22} /> ¡Correcto! — 100%</div>
                        ) : (
                                    <>
                                        <div style={st.feedbackFail}><XCircle size={18} style={{ flexShrink: 0 }} /><div>{errores.map((e, i) => <div key={i}>{e}</div>)}</div></div>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#e67e22', marginTop: 6 }}>Nota: {pctEnvio}%</div>
                                    </>
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
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button onClick={() => { reset(); onNuevo(); }} style={st.btnNuevo}><RefreshCw size={14} /> Nuevo</button>
                        <button onClick={onVolver} style={st.btnVolver}><ArrowLeft size={14} /> Volver</button>
                        {resultado && <button onClick={()=>setMostrarEnvio(true)} style={{...st.btnVolver,background:'#2980b9',color:'white',border:'none'}}>📤 Profe</button>}
                    </div>
                </div>
            </div>
        </div>
        {mostrarEnvio && (()=>{
            const aciertos=[parciales.aOk,parciales.bOk,parciales.cOk].filter(Boolean).length;
            const pct=Math.round(aciertos/3*1000)/10;
            return <ModalEnviarProfe datos={{ porcentaje:pct, tipoEjercicio:'TRES_PUNTOS' }} onClose={()=>setMostrarEnvio(false)}/>;
        })()}
        </>
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


// ══════════════════════════════════════════════════════════════════════════════
// JUEGO EN VIVO — FUNCIONES
// ══════════════════════════════════════════════════════════════════════════════

const GEN_CODE = () =>
    Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// Tipos con su generador, label y sección
const TIPOS_LIVE = [
    { id: 'DOS_PUNTOS',    label: 'Recta por 2 puntos',    emoji: '📍', seccion: 'RECTAS',    gen: genDosPuntos    },
    { id: 'PARALELA',      label: 'Recta paralela',         emoji: '⫸',  seccion: 'RECTAS',    gen: genParalela     },
    { id: 'PERPENDICULAR', label: 'Recta perpendicular',    emoji: '⊥',  seccion: 'RECTAS',    gen: genPerpendicular },
    { id: 'GRAFICA',       label: 'Recta por su gráfica',   emoji: '📈', seccion: 'RECTAS',    gen: genGrafica      },
    { id: 'VECTOR',        label: 'Vector entre 2 puntos',  emoji: '➡️', seccion: 'RECTAS',    gen: genVector       },
    { id: 'GENERAL',       label: 'Forma general',          emoji: '✕',  seccion: 'RECTAS',    gen: genGeneral      },
    { id: 'ANALISIS',      label: 'Analizar parábola',      emoji: '🔍', seccion: 'PARABOLAS', gen: genAnalisis     },
    { id: 'TRES_PUNTOS',   label: 'Parábola por 3 puntos',  emoji: '📍', seccion: 'PARABOLAS', gen: genTresPuntos   },
];

// ─── Modal de configuración ───────────────────────────────────────────────────
function ModalLiveConfig({ onCrear, onCancelar }) {
    const [cantidades, setCantidades] = useState(
        Object.fromEntries(TIPOS_LIVE.map(t => [t.id, 0]))
    );
    const [tiempo, setTiempo]       = useState(45);
    const [aleatorio, setAleatorio] = useState(false);
    const [puntosMax, setPuntosMax] = useState(100);
    const [puntosMin, setPuntosMin] = useState(50);
    const [creando, setCreando]     = useState(false);

    const total = Object.values(cantidades).reduce((s, v) => s + v, 0);

    const set = (id, v) => {
        const n = Math.max(0, Math.min(10, parseInt(v) || 0));
        setCantidades(prev => ({ ...prev, [id]: n }));
    };

    const crear = async () => {
        if (total === 0) return alert('Añade al menos 1 pregunta.');
        setCreando(true);
        // Generar todas las preguntas
        let preguntas = [];
        TIPOS_LIVE.forEach(t => {
            for (let i = 0; i < cantidades[t.id]; i++) {
                preguntas.push({ ...t.gen(), tipo: t.id, tiempo, puntosMax, puntosMin });
            }
        });
        if (aleatorio) preguntas = preguntas.sort(() => Math.random() - 0.5);

        const codigo = GEN_CODE();
        await setDoc(doc(db, 'live_games', codigo), {
            tipoJuego: 'FUNCIONES', estado: 'LOBBY',
            fasePregunta: 'RESPONDING',
            jugadores: {}, preguntas,
            indicePregunta: 0, respuestasRonda: {},
            questionStartTime: null, creadoEn: Date.now(),
        });
        setCreando(false);
        onCrear(codigo);
    };

    const Chip = ({ active, onClick, children }) => (
        <button onClick={onClick} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '0.82rem', fontFamily: 'inherit',
            background: active ? '#1a2d5a' : '#f0f3fb',
            color: active ? 'white' : '#5a6a9a',
        }}>{children}</button>
    );

    return (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', fontFamily:"'Georgia',serif" }}>
                <div style={{ background:'linear-gradient(135deg,#0f1b35,#1a2d5a)', padding:'18px 22px', borderRadius:'20px 20px 0 0', color:'white' }}>
                    <div style={{ fontSize:'1.15rem', fontWeight:'bold' }}>🔴 Crear Partida en Vivo</div>
                    <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.6)', marginTop:3 }}>Funciones — Rectas y Parábolas</div>
                </div>
                <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:18 }}>

                    {/* Preguntas por tipo */}
                    <div>
                        <div style={{ fontWeight:'bold', color:'#1a2d5a', fontSize:'0.88rem', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            📐 Rectas
                        </div>
                        {TIPOS_LIVE.filter(t => t.seccion === 'RECTAS').map(t => (
                            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                                <span style={{ flex:1, fontSize:'0.88rem', color:'#2c3e50' }}>{t.emoji} {t.label}</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <button onClick={() => set(t.id, cantidades[t.id]-1)} style={btnQStyle}>−</button>
                                    <span style={{ minWidth:24, textAlign:'center', fontWeight:'bold', color:'#1a2d5a' }}>{cantidades[t.id]}</span>
                                    <button onClick={() => set(t.id, cantidades[t.id]+1)} style={btnQStyle}>+</button>
                                </div>
                            </div>
                        ))}

                        <div style={{ fontWeight:'bold', color:'#1a2d5a', fontSize:'0.88rem', margin:'14px 0 10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                            ⌒ Parábolas
                        </div>
                        {TIPOS_LIVE.filter(t => t.seccion === 'PARABOLAS').map(t => (
                            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                                <span style={{ flex:1, fontSize:'0.88rem', color:'#2c3e50' }}>{t.emoji} {t.label}</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <button onClick={() => set(t.id, cantidades[t.id]-1)} style={btnQStyle}>−</button>
                                    <span style={{ minWidth:24, textAlign:'center', fontWeight:'bold', color:'#1a2d5a' }}>{cantidades[t.id]}</span>
                                    <button onClick={() => set(t.id, cantidades[t.id]+1)} style={btnQStyle}>+</button>
                                </div>
                            </div>
                        ))}

                        <div style={{ background:'#f0f3fb', borderRadius:8, padding:'6px 12px', fontSize:'0.82rem', color:'#5a6a9a', marginTop:4 }}>
                            Total: <strong style={{ color:'#1a2d5a' }}>{total}</strong> pregunta{total !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Tiempo */}
                    <div>
                        <div style={{ fontWeight:'bold', color:'#1a2d5a', fontSize:'0.88rem', marginBottom:8 }}>⏱ Tiempo por pregunta</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                            {[30, 45, 60, 90].map(t => (
                                <Chip key={t} active={tiempo === t} onClick={() => setTiempo(t)}>{t}s</Chip>
                            ))}
                            <input type="number" min="10" max="300" value={![30,45,60,90].includes(tiempo) ? tiempo : ''}
                                placeholder="otro"
                                onChange={e => { const v = parseInt(e.target.value); if (v > 0) setTiempo(v); }}
                                style={{ width:60, padding:'5px 8px', borderRadius:20, border:'2px solid #c0c8e8', textAlign:'center', fontSize:'0.85rem', outline:'none' }}
                            />
                        </div>
                    </div>

                    {/* Orden */}
                    <div>
                        <div style={{ fontWeight:'bold', color:'#1a2d5a', fontSize:'0.88rem', marginBottom:8 }}>🔀 Orden de preguntas</div>
                        <div style={{ display:'flex', gap:8 }}>
                            <Chip active={!aleatorio} onClick={() => setAleatorio(false)}>📋 En orden</Chip>
                            <Chip active={aleatorio}  onClick={() => setAleatorio(true)}>🎲 Aleatorio</Chip>
                        </div>
                    </div>

                    {/* Puntuación */}
                    <div>
                        <div style={{ fontWeight:'bold', color:'#1a2d5a', fontSize:'0.88rem', marginBottom:8 }}>🏆 Puntuación</div>
                        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                            <label style={{ fontSize:'0.85rem', color:'#555' }}>Máx:
                                <input type="number" value={puntosMax} onChange={e => setPuntosMax(+e.target.value || 100)}
                                    style={{ width:60, marginLeft:6, padding:'4px 8px', borderRadius:6, border:'1px solid #ccc' }} />
                            </label>
                            <label style={{ fontSize:'0.85rem', color:'#555' }}>Mín:
                                <input type="number" value={puntosMin} onChange={e => setPuntosMin(+e.target.value || 50)}
                                    style={{ width:60, marginLeft:6, padding:'4px 8px', borderRadius:6, border:'1px solid #ccc' }} />
                            </label>
                        </div>
                    </div>

                    {/* Botones */}
                    <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid #eee' }}>
                        <button onClick={onCancelar} style={{ padding:'9px 18px', borderRadius:10, border:'1.5px solid #c0c8e8', background:'white', cursor:'pointer', fontSize:'0.9rem', fontFamily:'inherit', color:'#5a6a9a' }}>Cancelar</button>
                        <button onClick={crear} disabled={creando || total === 0} style={{ padding:'9px 22px', borderRadius:10, border:'none', background: total === 0 ? '#ccc' : '#1a2d5a', color:'white', cursor: total === 0 ? 'not-allowed' : 'pointer', fontWeight:'bold', fontSize:'0.9rem', fontFamily:'inherit' }}>
                            {creando ? '⏳ Creando...' : '🚀 Lanzar Partida'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
const btnQStyle = { width:28, height:28, borderRadius:'50%', border:'2px solid #c0c8e8', background:'white', cursor:'pointer', fontWeight:'bold', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', color:'#1a2d5a' };

// ─── HOST ─────────────────────────────────────────────────────────────────────
function FuncionesLiveHost({ codigoSala, onExit }) {
    const [gameData, setGameData]   = useState(null);
    const [jugadores, setJugadores] = useState([]);
    const [fase, setFase]           = useState('LOBBY');
    const [subFase, setSubFase]     = useState('RESPONDING');
    const [timer, setTimer]         = useState(0);
    const [stats, setStats]         = useState({ aciertos:0, total:0, pct:0 });
    const [cargando, setCargando]   = useState(false);
    const timerRef = useRef(null);
    const gdRef    = useRef(null);
    useEffect(() => { gdRef.current = gameData; }, [gameData]);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setGameData(data);
            setFase(data.estado || 'LOBBY');
            setSubFase(data.fasePregunta || 'RESPONDING');
            setJugadores(data.jugadores ? Object.values(data.jugadores) : []);

            if (data.estado === 'JUEGO' && data.fasePregunta === 'RESPONDING') {
                const resps = data.respuestasRonda || {};
                const updates = {}; let hayCambios = false;
                Object.entries(resps).forEach(([uid, resp]) => {
                    if (!resp.processed) {
                        hayCambios = true;
                        let puntos = 0;
                        const ratio = resp.ratio ?? (resp.correct ? 1 : 0); // compatibilidad con versiones antiguas
                        if (ratio > 0) {
                            const p = data.preguntas[data.indicePregunta];
                            const max = p.puntosMax || 100, min = p.puntosMin || 0, tt = p.tiempo || 45;
                            const tr = (Date.now() - (data.questionStartTime || Date.now())) / 1000;
                            // Puntos base según velocidad, escalados por fracción de aciertos
                            const ptsVelocidad = Math.round(min + (max - min) * Math.max(0, Math.min(1, (tt - tr) / tt)));
                            puntos = Math.round(ptsVelocidad * ratio);
                        }
                        updates[`respuestasRonda.${uid}.puntosGanados`] = puntos;
                        updates[`respuestasRonda.${uid}.processed`]     = true;
                        if (puntos > 0 && data.jugadores?.[uid])
                            updates[`jugadores.${uid}.puntos`] = increment(puntos);
                    }
                });
                if (hayCambios) await updateDoc(doc(db, 'live_games', codigoSala), updates);
                const n = Object.keys(resps).length;
                const tot = Object.values(data.jugadores || {}).length;
                if (tot > 0 && n >= tot) revelar(data);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    useEffect(() => { setCargando(false); }, [gameData?.indicePregunta, gameData?.fasePregunta, gameData?.estado]);

    useEffect(() => {
        clearInterval(timerRef.current);
        if (fase === 'JUEGO' && subFase === 'RESPONDING' && gameData) {
            const p   = gameData.preguntas[gameData.indicePregunta];
            const tt  = p.tiempo || 45;
            const ini = gameData.questionStartTime || Date.now();
            const forceSentRef = { current: false };
            timerRef.current = setInterval(() => {
                const r = Math.max(0, Math.ceil(tt - (Date.now() - ini) / 1000));
                setTimer(r);
                // Con 1 segundo de margen, forzar envío de todos los clientes
                if (r <= 1 && !forceSentRef.current) {
                    forceSentRef.current = true;
                    updateDoc(doc(db, 'live_games', codigoSala), { forceCheck: Date.now() }).catch(()=>{});
                }
                if (r <= 0) { clearInterval(timerRef.current); if (gdRef.current) revelar(gdRef.current); }
            }, 500);
        }
        return () => clearInterval(timerRef.current);
    }, [fase, subFase, gameData?.indicePregunta, gameData?.questionStartTime]);

    const revelar = async (d) => {
        if (d.fasePregunta !== 'RESPONDING') return;
        const jugsKeys = Object.keys(d.jugadores || {});
        const resps = d.respuestasRonda || {};
        // Calcular stats usando lo que hay + contar ausentes como 0 (solo para display)
        const allResps = jugsKeys.map(uid => resps[uid] || { correct:false, ratio:0 });
        const aciertos = allResps.filter(r => r.correct).length;
        const pct = allResps.length > 0 ? Math.round(aciertos / allResps.length * 100) : 0;
        setStats({ aciertos, total: allResps.length, pct });
        // NO escribimos auto-submits a Firestore — los clientes envían su lastRatio
        // en los próximos ~500ms cuando su propio timer llega a 0
        await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'REVEAL' });
        setTimeout(() => updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'LEADERBOARD' }), 5000);
    };

    const siguientePregunta = async () => {
        if (cargando) return; setCargando(true);
        const d = gdRef.current || gameData;
        const next = (d.indicePregunta || 0) + 1;
        if (next < d.preguntas.length) {
            await updateDoc(doc(db, 'live_games', codigoSala), { indicePregunta: next, respuestasRonda: {}, fasePregunta: 'RESPONDING', questionStartTime: Date.now() });
        } else {
            await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'FIN' });
        }
    };

    const empezar = async () => {
        const d = gdRef.current || gameData;
        const resetPts = {};
        Object.keys(d?.jugadores || {}).forEach(uid => { resetPts[`jugadores.${uid}.puntos`] = 0; });
        await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'COUNTDOWN', ...resetPts });
        setTimeout(async () => {
            await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'JUEGO', indicePregunta: 0, respuestasRonda: {}, fasePregunta: 'RESPONDING', questionStartTime: Date.now() });
        }, 3000);
    };

    if (!gameData) return <div style={sHost.wrap}><Loader size={40} color="white" /></div>;

    const p      = gameData.preguntas?.[gameData.indicePregunta];
    const isLast = (gameData.indicePregunta || 0) >= (gameData.preguntas?.length || 1) - 1;
    const nResp  = Object.keys(gameData.respuestasRonda || {}).length;
    const sorted = jugadores.slice().sort((a,b) => (b.puntos||0) - (a.puntos||0));

    return (
        <div style={sHost.wrap}>
            {/* HUD */}
            <div style={sHost.hud}>
                <button onClick={onExit} style={sHost.btnExit}>✕ Salir</button>
                <div style={sHost.code}>SALA: <strong>{codigoSala}</strong></div>
                <div style={sHost.hudRight}>
                    {fase === 'JUEGO' && <span style={sHost.qCounter}>P. {(gameData.indicePregunta||0)+1}/{gameData.preguntas?.length}</span>}
                    <span style={sHost.players}><Users size={16} /> {jugadores.length}</span>
                </div>
            </div>

            {/* Avatar */}
            {fase === 'JUEGO' && (
                <div style={sHost.avatarWrap}>
                    <img src={stats.pct >= 60 ? piHappy : stats.pct < 30 && stats.total > 0 ? piAngry : piNeutral}
                        style={sHost.avatar} alt="Pi" />
                    {stats.total > 0 && <div style={sHost.statsBadge}>{stats.pct}% aciertos</div>}
                </div>
            )}

            <div style={sHost.area}>
                {/* LOBBY */}
                {fase === 'LOBBY' && (
                    <div style={sHost.lobby}>
                        <div style={{ fontSize:'3rem' }}>∫</div>
                        <h1 style={{ color:'white', margin:'8px 0' }}>Funciones en Vivo</h1>
                        <div style={sHost.bigCode}>{codigoSala}</div>
                        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.9rem' }}>
                            {gameData.preguntas?.length} preguntas · {gameData.preguntas?.[0]?.tiempo}s c/u
                        </p>
                        <div style={sHost.playerGrid}>
                            {jugadores.map((j,i) => <div key={i} style={sHost.playerChip}>{j.nombre}</div>)}
                        </div>
                        <button onClick={empezar} disabled={jugadores.length === 0}
                            style={{ ...sHost.btnStart, opacity: jugadores.length === 0 ? 0.5 : 1 }}>
                            <Play size={28} fill="white" /> EMPEZAR
                        </button>
                    </div>
                )}

                {/* COUNTDOWN */}
                {fase === 'COUNTDOWN' && (
                    <div style={sHost.lobby}>
                        <div style={{ fontSize:'8rem', color:'#f1c40f', fontWeight:'bold', animation:'pulse 1s infinite' }}>¡YA!</div>
                    </div>
                )}

                {/* JUEGO */}
                {fase === 'JUEGO' && p && (
                    <div style={sHost.questionArea}>
                        {subFase === 'RESPONDING' && (
                            <div style={sHost.questionCard}>
                                <HostEnunciado p={p} />
                                <div style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'center', marginTop:16, flexWrap:'wrap' }}>
                                    <div style={sHost.timerBig}>{timer}s</div>
                                    <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.9rem' }}>{nResp}/{jugadores.length} resp.</div>
                                    <button onClick={() => revelar(gdRef.current || gameData)} style={sHost.btnForce}>⏹ Forzar fin</button>
                                </div>
                            </div>
                        )}
                        {subFase === 'REVEAL' && (
                            <div style={sHost.revealCard}>
                                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'1rem', marginBottom:8 }}>Solución correcta:</div>
                                <HostSolucion p={p} />
                                <div style={{ marginTop:12, fontSize:'1.1rem', color:'#f1c40f' }}>
                                    {stats.aciertos}/{stats.total} correctas ({stats.pct}%)
                                </div>
                            </div>
                        )}
                        {subFase === 'LEADERBOARD' && (
                            <div style={sHost.leaderboard}>
                                <h2 style={{ color:'white', margin:'0 0 14px' }}>🏆 Clasificación</h2>
                                {sorted.slice(0,10).map((j,i) => (
                                    <div key={j.uid} style={{ ...sHost.rankRow, background: i===0?'rgba(241,196,15,0.25)':i===1?'rgba(189,195,199,0.2)':i===2?'rgba(205,127,50,0.2)':'rgba(255,255,255,0.07)' }}>
                                        <span style={{ fontWeight:'bold', color:'#f1c40f', minWidth:24 }}>{i+1}.</span>
                                        <span style={{ flex:1, color:'white' }}>{j.nombre}</span>
                                        <span style={{ fontWeight:'bold', color:'#2ecc71' }}>{j.puntos||0} pts</span>
                                    </div>
                                ))}
                                <button onClick={siguientePregunta} disabled={cargando} style={sHost.btnNext}>
                                    {cargando ? '...' : isLast ? '🏆 Podio Final' : 'Siguiente →'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* FIN */}
                {fase === 'FIN' && (
                    <FinLiveHost sorted={sorted} onExit={onExit} />
                )}
            </div>
        </div>
    );
}

// ─── Pantalla FIN live (host) con envío al profe ─────────────────────────────
function FinLiveHost({ sorted, onExit }) {
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const datos = {
        jugadores: sorted.map(j => ({
            nombre: j.nombre, curso: '', puntos: j.puntos||0,
            porcentaje: j.puntos||0, correcto: (j.puntos||0)>0,
        })),
    };
    const bg = (i) => i===0?'rgba(241,196,15,0.3)':i===1?'rgba(189,195,199,0.2)':i===2?'rgba(205,127,50,0.2)':'rgba(255,255,255,0.07)';
    return (
        <div style={{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column', gap:8, alignItems:'stretch' }}>
            <h1 style={{ color:'#f1c40f', margin:'0 0 20px', textAlign:'center' }}>🏆 PODIO FINAL 🏆</h1>
            {sorted.map((j,i) => (
                <div key={j.uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderRadius:10, fontFamily:"'Georgia',serif", fontSize: i<3?'1.1rem':'0.95rem', background: bg(i) }}>
                    <span style={{ minWidth:32, color:'#f1c40f', fontWeight:'bold' }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
                    <span style={{ flex:1, color:'white' }}>{j.nombre}</span>
                    <span style={{ color:'#2ecc71', fontWeight:'bold' }}>{j.puntos||0} pts</span>
                </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
                <button onClick={()=>setMostrarEnvio(true)} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                    <Send size={15}/> Enviar a profesor
                </button>
                <button onClick={onExit} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'#e74c3c', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cerrar Sala</button>
            </div>
            {mostrarEnvio && <ModalEnviarProfe datos={datos} onClose={()=>setMostrarEnvio(false)}/>}
        </div>
    );
}

// Enunciado visible en la pantalla del profesor
function HostEnunciado({ p }) {
    const s = { color:'white', fontSize:'1.1rem', lineHeight:1.7, textAlign:'center' };
    if (p.tipo === 'DOS_PUNTOS') return <div style={s}>Ecuación de la recta que pasa por <strong>A({p.ax},{p.ay})</strong> y <strong>B({p.bx},{p.by})</strong></div>;
    if (p.tipo === 'PARALELA')   return <div style={s}>Recta <strong>paralela</strong> a y={p.m}x{p.n>=0?'+':''}{p.n} por <strong>P({p.px},{p.py})</strong></div>;
    if (p.tipo === 'PERPENDICULAR') return <div style={s}>Recta <strong>perpendicular</strong> a y={p.m}x{p.n>=0?'+':''}{p.n} por <strong>P({p.px},{p.py})</strong></div>;
    if (p.tipo === 'GRAFICA')    return <div style={s}>Encuentra <em>m</em> y <em>n</em> de la recta representada en el gráfico</div>;
    if (p.tipo === 'ANALISIS') {
        const aStr = p.a===1?'':p.a===-1?'-':`${p.a}`;
        const bStr = p.b===0?'':p.b>0?` + ${p.b}x`:` - ${Math.abs(p.b)}x`;
        const cStr = p.c===0?'':p.c>0?` + ${p.c}`:` - ${Math.abs(p.c)}`;
        return <div style={s}>Analiza: <strong>y = {aStr}x²{bStr}{cStr}</strong></div>;
    }
    if (p.tipo === 'TRES_PUNTOS') return <div style={s}>Parábola por <strong>{p.pts.map(pt=>`(${pt.x},${pt.y})`).join(' · ')}</strong></div>;
    if (p.tipo === 'VECTOR') return <div style={s}>Calcula el vector <strong>AB⃗</strong>, módulo y ángulo · <strong>A({p.ax},{p.ay})</strong> y <strong>B({p.bx},{p.by})</strong></div>;
    if (p.tipo === 'GENERAL') return (
        <div style={s}>
            Dadas las ecuaciones:<br/>
            <strong>r₁: {fmtGeneral(p.g1)}</strong> &nbsp;&nbsp; <strong>r₂: {fmtGeneral(p.g2)}</strong>
        </div>
    );
    return null;
}

// Solución visible en pantalla del profesor tras revelar
function HostSolucion({ p }) {
    const s = { color:'#f1c40f', fontSize:'1.3rem', fontWeight:'bold', textAlign:'center' };
    if (['DOS_PUNTOS','PARALELA','PERPENDICULAR','GRAFICA'].includes(p.tipo)) {
        const m = p.mp ?? p.m, n = p.np ?? p.n;
        return <div style={s}>m = {numStr(m)} · n = {numStr(n)}<br /><span style={{fontSize:'1rem'}}>y = {numStr(m)}x {n>=0?`+ ${numStr(n)}`:`− ${numStr(Math.abs(n))}`}</span></div>;
    }
    if (p.tipo === 'ANALISIS') return (
        <div style={s}>
            {p.a>0?'∪ Cóncava':'∩ Convexa'} · V({numStr(-p.b/(2*p.a))}, {numStr(p.a*(-p.b/(2*p.a))**2+p.b*(-p.b/(2*p.a))+p.c)})<br />
            <span style={{fontSize:'0.9rem'}}>Corte Y: (0,{p.c})</span>
        </div>
    );
    if (p.tipo === 'TRES_PUNTOS') return <div style={s}>a={p.a} · b={p.b} · c={p.c}</div>;
    if (p.tipo === 'VECTOR') return <div style={s}>AB⃗=({p.vx},{p.vy}) · |AB⃗|={Math.round(p.modulo*100)/100} · θ={p.angulo}°</div>;
    if (p.tipo === 'GENERAL') return (
        <div style={s}>
            {p.paralelas?'Paralelas':'Perpendiculares: '+p.perpendiculares}
            {p.ix!==null?<><br/><span style={{fontSize:'0.9rem'}}>Intersección: ({p.ix},{p.iy})</span></>:''}
        </div>
    );
    return null;
}

// ─── CLIENTE ──────────────────────────────────────────────────────────────────
function FuncionesLiveClient({ codigoSala, usuario, onExit }) {
    const [gameData, setGameData] = useState(null);
    const [fase, setFase]         = useState('LOBBY');
    const [subFase, setSubFase]   = useState('RESPONDING');
    const [puntos, setPuntos]         = useState(0);
    const [myResult, setMyResult]     = useState(null);
    const [myRank, setMyRank]         = useState(null);
    const [forceCheck, setForceCheck] = useState(null); // timestamp del último forceCheck silencioso
    const joiningRef = useRef(false);
    const myName = usuario?.displayName || 'Alumno';
    const myUid  = useRef(usuario?.uid || 'guest_' + Math.random().toString(36).substr(2,8)).current;

    const prevEstadoRef = useRef(null);
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
            if (!snap.exists()) { alert('La sala se ha cerrado.'); onExit(); return; }
            const data = snap.data();
            setGameData(data);
            const estado = data.estado || 'LOBBY';
            setFase(estado); setSubFase(data.fasePregunta || 'RESPONDING');
            const jugs = data.jugadores || {};
            // Resetear puntos locales si volvemos a LOBBY (nueva partida)
            if (prevEstadoRef.current === 'FIN' && estado === 'LOBBY') setPuntos(0);
            prevEstadoRef.current = estado;
            if (jugs[myUid]) {
                setPuntos(jugs[myUid].puntos || 0);
            } else if (!joiningRef.current && (estado === 'LOBBY' || estado === 'JUEGO')) {
                joiningRef.current = true;
                try {
                    await updateDoc(doc(db,'live_games',codigoSala), {[`jugadores.${myUid}`]:{uid:myUid,nombre:myName,puntos:0}});
                } catch(e) { console.warn('join error:', e); }
                joiningRef.current = false;
            }
            setMyResult(data.respuestasRonda?.[myUid] || null);
            if (data.forceCheck) setForceCheck(data.forceCheck);
            if (estado === 'FIN') {
                const sorted = Object.values(jugs).sort((a,b)=>(b.puntos||0)-(a.puntos||0));
                setMyRank(sorted.findIndex(j=>j.uid===myUid)+1);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    if (!gameData) return <div style={sCli.wrap}><Loader size={40} color="white" /></div>;
    const p = gameData.preguntas?.[gameData.indicePregunta];

    return (
        <div style={sCli.wrap}>
            <div style={sCli.header}>
                <button onClick={onExit} style={sCli.btnExit}>✕</button>
                <div style={sCli.scoreBadge}>{puntos} pts</div>
            </div>

            {fase === 'LOBBY' && (
                <div style={sCli.lobbyWait}>
                    <div style={{ fontSize:'3rem' }}>∫</div>
                    <h2 style={{ color:'white' }}>¡Hola {myName}!</h2>
                    <p style={{ color:'rgba(255,255,255,0.7)' }}>Espera a que el profesor empiece...</p>
                </div>
            )}
            {fase === 'COUNTDOWN' && (
                <div style={sCli.lobbyWait}><div style={{ fontSize:'7rem', color:'#f1c40f', fontWeight:'bold' }}>¡YA!</div></div>
            )}
            {fase === 'JUEGO' && p && (
                <div style={sCli.questionArea}>
                    <ClientPreguntaFunciones
                        key={gameData.indicePregunta}
                        pregunta={p}
                        startTime={gameData.questionStartTime}
                        subFase={subFase}
                        forceCheck={forceCheck}
                        myResult={myResult}
                        puntos={puntos}
                        onResponder={async (esCorrecta, ratio=0) => {
                            await updateDoc(doc(db,'live_games',codigoSala), {
                                [`respuestasRonda.${myUid}`]:{uid:myUid,correct:esCorrecta,ratio:ratio,puntosGanados:0,processed:false}
                            });
                        }}
                    />
                </div>
            )}
            {fase === 'FIN' && (
                <div style={sCli.lobbyWait}>
                    {myRank <= 3 && <Confetti recycle={false} numberOfPieces={200} />}
                    <h1 style={{ color:'#f1c40f' }}>¡FIN!</h1>
                    <p style={{ color:'white', fontSize:'1.2rem' }}>{myName}</p>
                    <p style={{ color:'#f1c40f', fontSize:'2rem', fontWeight:'bold' }}>{myRank}ª posición</p>
                    <p style={{ color:'#2ecc71', fontSize:'1.4rem' }}>{puntos} pts</p>
                    <FinLiveClientButtons myName={myName} puntos={puntos} myRank={myRank} onExit={onExit} gameData={gameData}/>
                </div>
            )}
        </div>
    );
}

// ─── Botones FIN cliente con envío al profe ──────────────────────────────────
function FinLiveClientButtons({ myName, puntos, myRank, onExit, gameData }) {
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const maxPuntos = gameData?.jugadores ? Math.max(...Object.values(gameData.jugadores).map(j=>j.puntos||0), 1) : puntos||1;
    const jugadores = gameData?.jugadores
        ? Object.values(gameData.jugadores).sort((a,b)=>(b.puntos||0)-(a.puntos||0)).map(j=>({ nombre:j.nombre, curso:'', puntos:j.puntos||0, porcentaje:Math.round((j.puntos||0)/maxPuntos*100), correcto:(j.puntos||0)>0 }))
        : [{ nombre: myName, curso:'', puntos, porcentaje: myRank===1?100:Math.round(puntos/(puntos||1)*100), correcto: myRank===1 }];
    return (
        <>
            <div style={{ display:'flex', gap:9, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
                <button onClick={()=>setMostrarEnvio(true)} style={{ padding:'9px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                    <Send size={14}/> Enviar a profesor
                </button>
                <button onClick={onExit} style={{ padding:'9px 18px', borderRadius:10, border:'none', background:'#e74c3c', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Salir al Menú</button>
            </div>
            {mostrarEnvio && <ModalEnviarProfe datos={{ jugadores }} onClose={()=>setMostrarEnvio(false)}/>}
        </>
    );
}

// Pregunta para el cliente — usa los componentes de ejercicio reales
function ClientPreguntaFunciones({ pregunta, startTime, subFase, forceCheck, myResult, puntos, onResponder }) {
    const [enviado, setEnviado] = useState(false);
    const [timeLeft, setTimeLeft] = useState(100);
    const [isLate, setIsLate]   = useState(false);
    const tRef        = useRef(null);
    const envRef      = useRef(false);   // evita doble envío
    const lastRatio   = useRef(0);       // último ratio parcial computado silenciosamente

    // forceCheck: el host avisa 1s antes — dispara cálculo silencioso en el ejercicio hijo
    const [silentCheckTrigger, setSilentCheckTrigger] = useState(null);
    useEffect(() => {
        if (!forceCheck || enviado) return;
        setSilentCheckTrigger(forceCheck); // el hijo calcula y llama onLiveEnviar(ratio, true)
    }, [forceCheck]);

    // Timer del cliente — usa questionStartTime del servidor como referencia absoluta
    // así el desfase de reloj entre host y cliente no afecta (ambos miden desde el mismo origen)
    useEffect(() => {
        if (subFase !== 'RESPONDING' || enviado) return;
        const tt = pregunta.tiempo || 45;
        tRef.current = setInterval(() => {
            const tr = (Date.now() - startTime) / 1000;
            const pct = Math.max(0, 100 - (tr / tt * 100));
            setTimeLeft(pct);
            if (pct < 20) setIsLate(true);
            if (pct <= 0) {
                clearInterval(tRef.current);
                if (!envRef.current) {
                    envRef.current = true;
                    setEnviado(true);
                    onResponder(lastRatio.current > 0, lastRatio.current);
                }
            }
        }, 150);
        return () => clearInterval(tRef.current);
    }, [startTime, subFase, enviado]);

    // Llamado por el ejercicio hijo: silent=true → solo actualiza lastRatio sin enviar ni mostrar
    const handleLiveEnviar = (ratio, silent = false) => {
        lastRatio.current = ratio; // guardar siempre
        if (silent) return;        // cálculo silencioso: no enviar, no marcar como enviado
        if (envRef.current) return;
        envRef.current = true;
        clearInterval(tRef.current);
        setEnviado(true);
        onResponder(ratio > 0, ratio);
    };

    if (subFase === 'REVEAL') {
        const ok = myResult?.correct; const pts = myResult?.puntosGanados || 0;
        return (
            <div style={sCli.feedback}>
                <div style={{ ...sCli.neonCard, borderColor: ok ? '#2ecc71' : '#e74c3c' }}>
                    {ok ? <CheckCircle size={44} color="#2ecc71" /> : <XCircle size={44} color="#e74c3c" />}
                    <div style={{ fontSize:'1.4rem', fontWeight:'bold', color:'white', marginTop:8 }}>{ok?'¡CORRECTO!':!myResult?'¡TIEMPO!':'INCORRECTO'}</div>
                    {ok && <div style={{ color:'#f1c40f', fontSize:'1.6rem', fontWeight:'bold' }}>+{pts} pts</div>}
                </div>
            </div>
        );
    }
    if (subFase === 'LEADERBOARD') {
        return (
            <div style={sCli.feedback}>
                <div style={{ ...sCli.neonCard, borderColor:'#7f8c8d' }}>
                    <div style={{ color:'white', fontSize:'1rem' }}>Puntuación</div>
                    <div style={{ color:'#2ecc71', fontSize:'2rem', fontWeight:'bold' }}>{puntos} pts</div>
                </div>
            </div>
        );
    }

    const p = pregunta;
    const noop = () => {};

    return (
        <div style={{ width:'100%', overflowY:'auto', paddingBottom:20, boxSizing:'border-box' }}>
            {/* Barra de tiempo */}
            <div style={{ width:'100%', height:8, background:'rgba(255,255,255,0.15)', borderRadius:4, overflow:'hidden', marginBottom:4, flexShrink:0 }}>
                <div style={{ height:'100%', width:`${timeLeft}%`, background: isLate ? '#e74c3c' : '#2ecc71', transition:'width 0.15s linear', borderRadius:4 }} />
            </div>

            {/* Banner de espera tras enviar */}
            {enviado && (
                <div style={{ textAlign:'center', padding:'12px', background:'rgba(255,255,255,0.08)', borderRadius:10, marginBottom:8, color:'rgba(255,255,255,0.7)', fontSize:'0.88rem' }}>
                    <Loader size={18} style={{ verticalAlign:'middle', marginRight:6 }} />
                    Respuesta enviada · esperando al resto...
                </div>
            )}

            {/* Ejercicio completo reutilizado */}
            {p.tipo === 'VECTOR' && (
                <EjercicioVector eq={p} onNuevo={noop} onVolver={noop}
                    onLiveEnviar={handleLiveEnviar} silentCheckTrigger={silentCheckTrigger} liveMode={true} />
            )}
            {p.tipo === 'GENERAL' && (
                <EjercicioGeneral eq={p} onNuevo={noop} onVolver={noop}
                    onLiveEnviar={handleLiveEnviar} silentCheckTrigger={silentCheckTrigger} liveMode={true} />
            )}
            {p.tipo === 'ANALISIS' && (
                <EjercicioAnalisis eq={p} onNuevo={noop} onVolver={noop}
                    onLiveEnviar={handleLiveEnviar} silentCheckTrigger={silentCheckTrigger} liveMode={true} />
            )}
            {p.tipo === 'TRES_PUNTOS' && (
                <EjercicioTresPuntos eq={p} onNuevo={noop} onVolver={noop}
                    onLiveEnviar={handleLiveEnviar} silentCheckTrigger={silentCheckTrigger} liveMode={true} />
            )}
            {['DOS_PUNTOS','PARALELA','PERPENDICULAR','GRAFICA'].includes(p.tipo) && (
                <Ejercicio eq={p} onNuevo={noop} onVolver={noop}
                    onLiveEnviar={handleLiveEnviar} silentCheckTrigger={silentCheckTrigger} liveMode={true} />
            )}
        </div>
    );
}

// ─── Estilos live ─────────────────────────────────────────────────────────────
const sHost = {
    wrap:       { minHeight:'100vh', background:'linear-gradient(135deg,#0f1b35,#1a2d5a)', display:'flex', flexDirection:'column', fontFamily:"'Georgia',serif" },
    hud:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(0,0,0,0.3)' },
    btnExit:    { background:'rgba(231,76,60,0.3)', border:'1px solid #e74c3c', color:'white', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit' },
    code:       { color:'rgba(255,255,255,0.7)', fontSize:'0.9rem' },
    hudRight:   { display:'flex', alignItems:'center', gap:12 },
    qCounter:   { background:'rgba(255,255,255,0.15)', color:'white', padding:'4px 10px', borderRadius:20, fontSize:'0.85rem', fontWeight:'bold' },
    players:    { display:'flex', alignItems:'center', gap:5, color:'rgba(255,255,255,0.7)', fontSize:'0.85rem' },
    avatarWrap: { position:'absolute', top:60, right:16, display:'flex', flexDirection:'column', alignItems:'center', gap:4 },
    avatar:     { width:60, height:60, objectFit:'contain' },
    statsBadge: { background:'rgba(255,255,255,0.15)', color:'white', padding:'3px 8px', borderRadius:20, fontSize:'0.72rem' },
    area:       { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 },
    lobby:      { display:'flex', flexDirection:'column', alignItems:'center', gap:12, textAlign:'center' },
    bigCode:    { fontSize:'3.5rem', fontWeight:'bold', color:'#f1c40f', letterSpacing:8, background:'rgba(255,255,255,0.08)', padding:'10px 24px', borderRadius:14 },
    playerGrid: { display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', maxWidth:500 },
    playerChip: { background:'rgba(255,255,255,0.15)', color:'white', padding:'5px 12px', borderRadius:20, fontSize:'0.85rem' },
    btnStart:   { display:'flex', alignItems:'center', gap:10, padding:'14px 32px', background:'#27ae60', color:'white', border:'none', borderRadius:14, fontSize:'1.3rem', fontWeight:'bold', cursor:'pointer', marginTop:10, fontFamily:'inherit' },
    questionArea:{ width:'100%', maxWidth:700 },
    questionCard:{ background:'rgba(255,255,255,0.08)', borderRadius:16, padding:'24px', textAlign:'center' },
    timerBig:   { fontSize:'3.5rem', fontWeight:'bold', color:'#f1c40f' },
    btnForce:   { padding:'6px 14px', background:'rgba(231,76,60,0.4)', border:'1px solid #e74c3c', color:'white', borderRadius:8, cursor:'pointer', fontSize:'0.8rem', fontFamily:'inherit' },
    revealCard: { background:'rgba(255,255,255,0.08)', borderRadius:16, padding:'24px', textAlign:'center' },
    leaderboard:{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column', gap:8, alignItems:'stretch' },
    rankRow:    { display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderRadius:10, fontFamily:"'Georgia',serif" },
    btnNext:    { padding:'12px', background:'#3498db', color:'white', border:'none', borderRadius:10, fontSize:'1rem', fontWeight:'bold', cursor:'pointer', marginTop:10, fontFamily:'inherit' },
};
const sCli = {
    wrap:        { minHeight:'100vh', background:'linear-gradient(135deg,#0f1b35,#1a2d5a)', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:"'Georgia',serif" },
    header:      { width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(0,0,0,0.3)' },
    btnExit:     { background:'rgba(231,76,60,0.3)', border:'1px solid #e74c3c', color:'white', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit' },
    scoreBadge:  { background:'rgba(46,204,113,0.25)', color:'#2ecc71', padding:'5px 14px', borderRadius:20, fontWeight:'bold', fontSize:'0.95rem' },
    lobbyWait:   { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, textAlign:'center', padding:20 },
    feedback:    { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 },
    neonCard:    { background:'rgba(255,255,255,0.08)', border:'3px solid', borderRadius:16, padding:'24px 32px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:220 },
    waiting:     { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 },
    questionArea:{ flex:1, width:'100%', maxWidth:900, display:'flex', flexDirection:'column', alignItems:'stretch', padding:'0 8px 20px', overflowY:'auto' },
    card:        { background:'rgba(255,255,255,0.08)', borderRadius:16, padding:'18px', width:'100%', boxSizing:'border-box' },
    row:         { display:'flex', alignItems:'center', gap:8 },
    lbl:         { color:'rgba(255,255,255,0.7)', fontSize:'0.9rem', minWidth:28 },
    inp:         { flex:1, padding:'8px 12px', borderRadius:8, border:'2px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:'1rem', outline:'none', fontFamily:"'Georgia',serif", textAlign:'center' },
    btnEnviar:   { width:'100%', marginTop:14, padding:'12px', background:'#27ae60', color:'white', border:'none', borderRadius:10, fontSize:'1rem', fontWeight:'bold', cursor:'pointer', fontFamily:'inherit' },
    btnSalir:    { marginTop:16, padding:'10px 24px', background:'#3498db', color:'white', border:'none', borderRadius:10, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' },
};

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function Funciones({ isHost = false, codigoSala: codigoExterno = null, onHostStart = null, onClientJoin = null, usuario = null, onExit = null }) {
    const [seccion, setSeccion]         = useState(null);
    const [showLiveConfig, setShowLiveConfig] = useState(false);
    const [joinCode, setJoinCode]       = useState('');
    const [joinName, setJoinName]       = useState('');
    const [internalHost, setInternalHost]   = useState(null);
    const [internalClient, setInternalClient] = useState(null);
    const [internalClientUser, setInternalClientUser] = useState(null);

    // Props desde LandingGames (modo externo)
    if (isHost && codigoExterno)   return <FuncionesLiveHost   codigoSala={codigoExterno} onExit={onExit || (() => {})} />;
    if (!isHost && codigoExterno)  return <FuncionesLiveClient codigoSala={codigoExterno} usuario={usuario} onExit={onExit || (() => {})} />;

    // Modo interno (desde la propia pantalla de Funciones)
    if (internalHost)   return <FuncionesLiveHost   codigoSala={internalHost}   onExit={() => setInternalHost(null)} />;
    if (internalClient) return <FuncionesLiveClient codigoSala={internalClient} usuario={internalClientUser||usuario} onExit={() => { setInternalClient(null); setInternalClientUser(null); }} />;

    if (seccion === 'RECTAS')    return <PantallaRectas    onVolver={() => setSeccion(null)} />;
    if (seccion === 'PARABOLAS') return <PantallaParabolas onVolver={() => setSeccion(null)} />;

    const handleCrear = (codigo) => {
        setShowLiveConfig(false);
        if (onHostStart) onHostStart(codigo);
        else setInternalHost(codigo);
    };

    const handleUnirse = () => {
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 6) return alert('El código debe tener 6 caracteres.');
        if (!joinName.trim()) return alert('Introduce tu nombre antes de unirte.');
        const userObj = { displayName: joinName.trim(), uid: 'guest_' + Math.random().toString(36).substr(2,8) };
        if (onClientJoin) onClientJoin(code);
        else { setInternalClientUser(userObj); setInternalClient(code); }
    };

    const compartir = () => {
        const url = 'pikt.es/funciones2';
        if (navigator.share) {
            navigator.share({ 
                title: 'Funciones', 
                text: 'Juega aquí', 
                url: window.location.href 
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url).then(() => alert('✅ Enlace copiado'));
        }
    };

    return (
        <div style={st.pagina}>
            {showLiveConfig && (
                <ModalLiveConfig
                    onCrear={handleCrear}
                    onCancelar={() => setShowLiveConfig(false)}
                />
            )}

            {/* Header */}
            <div style={st.header}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    {onExit && (
                        <button onClick={onExit} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'8px 14px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.9rem', marginBottom:8, alignSelf:'flex-start' }}>
                            <ArrowLeft size={16}/> Volver
                        </button>
                    )}
                    <button onClick={compartir} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'8px 14px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.9rem', marginBottom:8, alignSelf:'flex-start' }} title="Compartir">
                        <Share2 size={16}/>
                    </button>
                </div>
                <div style={st.headerIcon}>∫</div>
                <div>
                    <div style={st.headerTitulo}>Funciones</div>
                    <div style={st.headerSub}>Geometría Analítica · Rectas y Parábolas</div>
                </div>
            </div>

            {/* Cards práctica individual */}
            <div style={st.mainGrid}>
                <button onClick={() => setSeccion('RECTAS')} style={{ ...st.mainCard, '--accent':'#3498db' }}>
                    <TrendingUp size={40} color="#3498db" />
                    <div style={st.mainCardTitle}>Rectas en 2D</div>
                    <div style={st.mainCardDesc}>
                        Ecuación explícita, rectas paralelas y perpendiculares, vector...
                    </div>
                    <div style={st.mainCardPill}>6 tipos de ejercicio</div>
                </button>

                <button onClick={() => setSeccion('PARABOLAS')} style={{ ...st.mainCard, '--accent':'#9b59b6' }}>
                    <BarChart2 size={40} color="#9b59b6" />
                    <div style={st.mainCardTitle}>Parábolas</div>
                    <div style={st.mainCardDesc}>
                        Función cuadrática, vértice, eje de simetría y representación gráfica
                    </div>
                    <div style={{ ...st.mainCardPill, background:'#9b59b622', color:'#9b59b6' }}>2 tipos de ejercicio</div>
                </button>
            </div>

            {/* Separador */}
            <div style={{ width:'100%', maxWidth:620, height:1, background:'rgba(255,255,255,0.12)', margin:'28px 0 20px' }} />

            {/* Juego en vivo */}
            <div style={{ width:'100%', maxWidth:620, display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                <button onClick={() => setShowLiveConfig(true)} style={{ ...st.mainCard, '--accent':'#e74c3c', width:'100%', flexDirection:'row', gap:14, padding:'18px 24px', justifyContent:'center' }}>
                    <Monitor size={28} color="#e74c3c" />
                    <div style={{ textAlign:'left' }}>
                        <div style={{ fontSize:'1.05rem', fontWeight:'bold' }}>🔴 Crear Partida en Vivo</div>
                        <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.55)', marginTop:2 }}>Elige tipos, cantidad y tiempo · para toda la clase</div>
                    </div>
                </button>

                <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
                    <input
                        type="text" placeholder="Tu nombre"
                        value={joinName} onChange={e => setJoinName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUnirse()}
                        style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:'1rem', outline:'none', fontFamily:"'Georgia',serif" }}
                    />
                    <div style={{ display:'flex', gap:8 }}>
                        <input
                            type="text" placeholder="Código de 6 letras"
                            value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && handleUnirse()}
                            maxLength={6}
                            style={{ flex:1, padding:'11px 14px', borderRadius:10, border:'2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:'1rem', outline:'none', letterSpacing:3, textAlign:'center', fontFamily:"'Georgia',serif" }}
                        />
                        <button onClick={handleUnirse} style={{ padding:'11px 18px', borderRadius:10, background:'#27ae60', border:'none', color:'white', fontWeight:'bold', cursor:'pointer', fontSize:'0.9rem', fontFamily:"'Georgia',serif" }}>
                            Unirse →
                        </button>
                    </div>
                </div>
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
