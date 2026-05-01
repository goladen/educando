import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { RotateCcw, CheckCircle, Trophy, Clock, Brain, Delete, Settings, SkipForward, Share2 } from 'lucide-react';
import Confetti from 'react-confetti';
import OcaMatematica from './OcaMatematica';
import DominoMatematico from './dominofracciones';

// ─── Configuración por defecto ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    minNum: 1,
    maxNum: 50,
    tiempo: 120,
    numEjercicios: null, // null = modo tiempo libre; número = modo ejercicios fijos
    tipos: { positivos: true, negativos: false, decimales: false, fracciones: false },
    operaciones: { suma: true, resta: true, multiplicacion: false, division: false },
};

// Configuraciones de los modos predefinidos
const MODOS_PRESET = [
    {
        id: 'EASY', icon: '👶', label: 'Sencillo', desc: 'Resultado siempre positivo', color: '#2ecc71',
        ops: ['+', '−'],
        cfg: { minNum: 1, maxNum: 50, tiempo: 120, numEjercicios: null,
               tipos: { positivos: true, negativos: false, decimales: false, fracciones: false },
               operaciones: { suma: true, resta: true, multiplicacion: false, division: false } }
    },
    {
        id: 'MEDIUM', icon: '🤓', label: 'Medio', desc: 'Con negativos · números hasta 100', color: '#f39c12',
        ops: ['+', '−', '×', '÷'],
        cfg: { minNum: 1, maxNum: 100, tiempo: 120, numEjercicios: null,
               tipos: { positivos: true, negativos: true, decimales: false, fracciones: false },
               operaciones: { suma: true, resta: true, multiplicacion: true, division: true } }
    },
    {
        id: 'HARD', icon: '🔥', label: 'Difícil', desc: 'Decimales y fracciones incluidos', color: '#e74c3c',
        ops: ['+', '−', '×', '÷', '0.5', '½'],
        cfg: { minNum: 1, maxNum: 100, tiempo: 120, numEjercicios: null,
               tipos: { positivos: true, negativos: true, decimales: true, fracciones: true },
               operaciones: { suma: true, resta: true, multiplicacion: true, division: true } }
    },
    {
        id: 'CUSTOM', icon: '⚙️', label: 'Configurado', desc: 'Elige operaciones, rango y tiempo', color: '#9b59b6',
        ops: null,
        cfg: null // abre el modal
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rFloat1 = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(1));
const rFloat2 = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);

// ─── Motor generador ──────────────────────────────────────────────────────────
const generarProblema = (cfg) => {
    const { minNum, maxNum, tipos, operaciones } = cfg;
    const opsActivas = Object.entries(operaciones).filter(([, v]) => v).map(([k]) => k);
    const tiposActivos = Object.entries(tipos).filter(([, v]) => v).map(([k]) => k);

    if (opsActivas.length === 0 || tiposActivos.length === 0)
        return { text: '¡Selecciona al menos una operación y un tipo!', answer: 0, hasDecimals: false, displayAnswer: '0' };

    const op = rItem(opsActivas);
    const tipo = rItem(tiposActivos);

    let text = '', answer = 0, hasDecimals = false;

    const numA = () => {
        if (tipo === 'negativos') return rInt(-maxNum, -1);
        if (tipo === 'positivos') return rInt(minNum, maxNum);
        return rInt(-maxNum, maxNum);
    };

    if (tipo === 'decimales') {
        const a = rFloat1(minNum * 0.1, maxNum * 0.1);
        const b = rFloat1(0.1, Math.min(maxNum * 0.1, 9.9));
        hasDecimals = true;

        if (op === 'suma') {
            answer = parseFloat((a + b).toFixed(2));
            text = `${a.toFixed(1)} + ${b.toFixed(1)}`;
        } else if (op === 'resta') {
            const [big, small] = a >= b ? [a, b] : [b, a];
            answer = parseFloat((big - small).toFixed(2));
            text = `${big.toFixed(1)} − ${small.toFixed(1)}`;
        } else if (op === 'multiplicacion') {
            const x = rFloat1(1, Math.min(maxNum * 0.1, 9.9));
            const y = rInt(1, Math.min(maxNum, 10));
            answer = parseFloat((x * y).toFixed(2));
            text = `${x.toFixed(1)} × ${y}`;
        } else {
            const divisor = rInt(1, 5);
            const result = rFloat1(0.1, Math.min(maxNum * 0.1, 9.9));
            const dividendo = parseFloat((divisor * result).toFixed(1));
            answer = result;
            text = `${dividendo.toFixed(1)} ÷ ${divisor}`;
        }

    } else if (tipo === 'fracciones') {
        const DENOMS = [2, 3, 4, 5, 8, 10];
        const den = rItem(DENOMS);
        hasDecimals = true;

        if (op === 'suma' || op === 'resta') {
            const n1 = rInt(1, den - 1);
            const n2 = rInt(1, den - 1);
            const num = op === 'suma' ? n1 + n2 : Math.abs(n1 - n2);
            const g = gcd(num, den);
            answer = parseFloat((num / den).toFixed(4));
            const displayNum = num / g, displayDen = den / g;
            text = op === 'suma'
                ? `${n1}/${den} + ${n2}/${den}`
                : `${Math.max(n1, n2)}/${den} − ${Math.min(n1, n2)}/${den}`;
        } else if (op === 'multiplicacion') {
            const n = rInt(1, den - 1);
            const entero = rInt(1, Math.min(maxNum, 12));
            answer = parseFloat(((n / den) * entero).toFixed(4));
            text = `${n}/${den} × ${entero}`;
        } else {
            const n = rInt(1, den - 1);
            const entero = rInt(1, Math.min(maxNum, 12));
            // n/den ÷ entero = n/(den*entero)
            answer = parseFloat((n / (den * entero)).toFixed(4));
            text = `${n}/${den} ÷ ${entero}`;
        }

    } else {
        // Positivos o negativos — números enteros
        const allowNeg = tipo === 'negativos' || tipo === 'ambos';

        if (op === 'suma') {
            const a = allowNeg ? rInt(-maxNum, maxNum) : rInt(minNum, maxNum);
            const b = allowNeg ? rInt(-maxNum, maxNum) : rInt(minNum, maxNum);
            answer = a + b;
            text = b >= 0 ? `${a} + ${b}` : `${a} + (${b})`;
        } else if (op === 'resta') {
            if (allowNeg) {
                const a = rInt(-maxNum, maxNum);
                const b = rInt(-maxNum, maxNum);
                answer = a - b;
                text = b >= 0 ? `${a} − ${b}` : `${a} − (${b})`;
            } else {
                // Resultado siempre positivo o cero en modo positivos
                const a = rInt(minNum, maxNum);
                const b = rInt(minNum, a);
                answer = a - b;
                text = `${a} − ${b}`;
            }
        } else if (op === 'multiplicacion') {
            const lim = Math.min(maxNum, 20);
            const a = allowNeg ? rInt(-lim, lim) : rInt(minNum, lim);
            const b = allowNeg ? rInt(-lim, lim) : rInt(minNum, lim);
            answer = a * b;
            text = `${a} × ${b}`;
        } else {
            // División exacta
            const divisor = rInt(2, Math.min(maxNum, 12));
            const result = rInt(allowNeg ? -Math.floor(maxNum / divisor) : 1, Math.floor(maxNum / divisor));
            const dividendo = divisor * result;
            answer = result;
            text = `${dividendo} ÷ ${divisor}`;
        }
    }

    const displayAnswer = hasDecimals
        ? (Number.isInteger(answer) ? `${answer}` : `${parseFloat(answer.toFixed(4))}`)
        : `${answer}`;

    return { text, answer, hasDecimals, displayAnswer };
};

// ─── Componente Modal de Configuración (estilo Geometrix) ────────────────────
const ConfigModal = ({ config, onChange, onStart, onClose }) => {
    const [local, setLocal] = useState({ ...DEFAULT_CONFIG, ...config });
    const [modoConteo, setModoConteo] = useState(config.numEjercicios ? 'ejercicios' : 'tiempo');

    const setField = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));
    const toggleTipo = (k) => {
        const next = { ...local.tipos, [k]: !local.tipos[k] };
        if (!Object.values(next).some(Boolean)) return; // al menos 1
        setLocal(prev => ({ ...prev, tipos: next }));
    };
    const toggleOp = (k) => {
        const next = { ...local.operaciones, [k]: !local.operaciones[k] };
        if (!Object.values(next).some(Boolean)) return; // al menos 1
        setLocal(prev => ({ ...prev, operaciones: next }));
    };

    const Chip = ({ active, onClick, children, color = '#E91E63' }) => (
        <button onClick={onClick} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.15s',
            background: active ? color : '#f0f0f0',
            color: active ? 'white' : '#555',
            boxShadow: active ? `0 3px 8px ${color}55` : 'none',
        }}>{children}</button>
    );

    const Section = ({ label, children }) => (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
        </div>
    );

    const handleStart = () => {
        const finalCfg = {
            ...local,
            numEjercicios: modoConteo === 'ejercicios' ? (local.numEjercicios || 10) : null,
        };
        onChange(finalCfg);
        onStart(finalCfg);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 22, padding: '28px 24px', maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 70px rgba(0,0,0,0.3)' }}>
                <h2 style={{ textAlign: 'center', color: '#2c3e50', fontSize: '1.3rem', marginTop: 0, marginBottom: 22 }}>⚙️ Modo Configurado</h2>

                {/* Operaciones */}
                <Section label="🔢 Operaciones">
                    <Chip active={local.operaciones.suma} onClick={() => toggleOp('suma')} color="#3498db">➕ Suma</Chip>
                    <Chip active={local.operaciones.resta} onClick={() => toggleOp('resta')} color="#e74c3c">➖ Resta</Chip>
                    <Chip active={local.operaciones.multiplicacion} onClick={() => toggleOp('multiplicacion')} color="#f39c12">✖️ Multiplicación</Chip>
                    <Chip active={local.operaciones.division} onClick={() => toggleOp('division')} color="#9b59b6">➗ División</Chip>
                </Section>

                {/* Tipos de números */}
                <Section label="🔵 Tipos de números">
                    <Chip active={local.tipos.positivos} onClick={() => toggleTipo('positivos')} color="#2ecc71">➕ Positivos</Chip>
                    <Chip active={local.tipos.negativos} onClick={() => toggleTipo('negativos')} color="#e74c3c">➖ Negativos</Chip>
                    <Chip active={local.tipos.decimales} onClick={() => toggleTipo('decimales')} color="#f39c12">🔢 Decimales</Chip>
                    <Chip active={local.tipos.fracciones} onClick={() => toggleTipo('fracciones')} color="#9b59b6">½ Fracciones</Chip>
                </Section>

                {/* Rango */}
                <Section label="📏 Rango de números">
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontWeight: 'bold', color: '#555', fontSize: '0.85rem' }}>
                        Mínimo
                        <input type="number" value={local.minNum} min={0} max={local.maxNum - 1}
                            onChange={e => setField('minNum', Math.max(0, parseInt(e.target.value) || 0))}
                            style={{ width: 70, padding: '7px', fontSize: '1rem', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', outline: 'none' }} />
                    </label>
                    <span style={{ fontSize: '1.3rem', color: '#aaa', alignSelf: 'flex-end', marginBottom: 6 }}>—</span>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontWeight: 'bold', color: '#555', fontSize: '0.85rem' }}>
                        Máximo
                        <input type="number" value={local.maxNum} min={local.minNum + 1} max={9999}
                            onChange={e => setField('maxNum', Math.max(local.minNum + 1, parseInt(e.target.value) || 10))}
                            style={{ width: 70, padding: '7px', fontSize: '1rem', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', outline: 'none' }} />
                    </label>
                </Section>

                {/* Modo: tiempo vs ejercicios */}
                <Section label="⏱ Modo de juego">
                    <Chip active={modoConteo === 'tiempo'} onClick={() => setModoConteo('tiempo')} color="#E91E63">⏱ Por tiempo</Chip>
                    <Chip active={modoConteo === 'ejercicios'} onClick={() => setModoConteo('ejercicios')} color="#009688">🔢 Por ejercicios</Chip>
                </Section>

                {modoConteo === 'tiempo' ? (
                    <Section label="⏱ Tiempo de juego">
                        {[60, 90, 120, 180, 300].map(t => (
                            <Chip key={t} active={local.tiempo === t} onClick={() => setField('tiempo', t)} color="#E91E63">
                                {t < 60 ? `${t}s` : `${t / 60} min`}
                            </Chip>
                        ))}
                    </Section>
                ) : (
                    <Section label="🔢 Número de ejercicios">
                        {[5, 10, 15, 20, 30].map(n => (
                            <Chip key={n} active={(local.numEjercicios || 10) === n} onClick={() => setField('numEjercicios', n)} color="#009688">{n}</Chip>
                        ))}
                        <input type="number" min="1" max="100" placeholder="···"
                            value={![5,10,15,20,30].includes(local.numEjercicios || 10) ? (local.numEjercicios || '') : ''}
                            onChange={e => { const v = parseInt(e.target.value); if (v > 0) setField('numEjercicios', v); }}
                            style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![5,10,15,20,30].includes(local.numEjercicios || 10) ? '#009688' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold', color: '#333' }} />
                    </Section>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={onClose} style={{ padding: '12px 24px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleStart} style={{ padding: '12px 28px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px #9b59b655' }}>
                        ▶ Empezar
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo]   = useState('');
    const [nombre, setNombre]   = useState('');
    const [curso,  setCurso]    = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'CALCULO', modalidad: 'Individual', fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, puntos: datos.puntos }],
            });
            setEnviado(true);
        } catch(e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>{datos.aciertos} aciertos · {datos.puntos} pts</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso',  'Curso',             curso,  setCurso,  'Ej: 3º ESO A',       false],
                          ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key==='codigo'?10:undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }}/>
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

export default function CalculoMentalGame({ usuario, onExit }) {
    const [gameState, setGameState] = useState('START');
    const [showOca, setShowOca] = useState(false);
    const [showDomino, setShowDomino] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [showConfig, setShowConfig] = useState(false);
    const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.tiempo);
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [skips, setSkips] = useState(0);
    const [ejercicioActual, setEjercicioActual] = useState(0); // para modo ejercicios fijos

    const [currentProblem, setCurrentProblem] = useState(null);
    const [currentAnswer, setCurrentAnswer] = useState(0);
    const [feedback, setFeedback] = useState(null); // 'CORRECT' | 'INCORRECT' | 'SKIP'
    const [showSolution, setShowSolution] = useState(false);

    const timerRef = useRef(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

    const modoEjercicios = !!config.numEjercicios;

    // Temporizador (solo en modo tiempo)
    useEffect(() => {
        if (!modoEjercicios) {
            if (gameState === 'PLAYING' && timeLeft > 0) {
                timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
            } else if (timeLeft <= 0 && gameState === 'PLAYING') {
                clearInterval(timerRef.current);
                setGameState('END');
            }
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft, modoEjercicios]);

    const startGame = (cfg = config) => {
        setConfig(cfg);
        setScore(0);
        setAciertos(0);
        setSkips(0);
        setEjercicioActual(1);
        setTimeLeft(cfg.tiempo);
        setCurrentProblem(generarProblema(cfg));
        setCurrentAnswer(0);
        setShowSolution(false);
        setFeedback(null);
        setGameState('PLAYING');
    };

    const handleAdd = (val) => {
        setCurrentAnswer(prev => parseFloat((prev + val).toFixed(4)));
    };

    const resetAnswer = () => setCurrentAnswer(0);

    const avanzarEjercicio = (cfg) => {
        const nextNum = ejercicioActual + 1;
        if (cfg.numEjercicios && nextNum > cfg.numEjercicios) {
            setGameState('END');
        } else {
            setEjercicioActual(nextNum);
            setCurrentAnswer(0);
            setCurrentProblem(generarProblema(cfg));
            setShowSolution(false);
        }
    };

    const checkAnswer = () => {
        if (!currentProblem || showSolution) return;
        const isCorrect = Math.abs(currentAnswer - currentProblem.answer) < 0.001;
        if (isCorrect) {
            setScore(s => s + 10);
            setAciertos(a => a + 1);
            setFeedback('CORRECT');
            setTimeout(() => {
                setFeedback(null);
                if (modoEjercicios) avanzarEjercicio(config);
                else { setCurrentAnswer(0); setCurrentProblem(generarProblema(config)); setShowSolution(false); }
            }, 600);
        } else {
            setScore(s => Math.max(0, s - 3));
            setFeedback('INCORRECT');
            setTimeout(() => setFeedback(null), 600);
        }
    };

    const handleSkip = () => {
        if (!currentProblem || showSolution) return;
        setSkips(s => s + 1);
        setScore(s => Math.max(0, s - 2));
        setShowSolution(true);
        setFeedback('SKIP');
        setTimeout(() => {
            setFeedback(null);
            if (modoEjercicios) avanzarEjercicio(config);
            else { setCurrentAnswer(0); setCurrentProblem(generarProblema(config)); setShowSolution(false); }
        }, 2000);
    };

    if (showOca) return <OcaMatematica onExit={() => setShowOca(false)} />;
    if (showDomino) return <DominoMatematico onExit={() => setShowDomino(false)} />;

    const handleExit = () => {
        clearInterval(timerRef.current);
        if (gameState !== 'START') setGameState('START');
        else if (typeof onExit === 'function') onExit();
        else window.location.href = '/';
    };

    const compartir = () => {
        const url = 'pikt.es/calculo';
        if (navigator.share) {
            navigator.share({ 
                title: 'Cálculo Mental', 
                text: 'Juega aquí', 
                url: window.location.href 
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url).then(() => alert('✅ Enlace copiado'));
        }
    };

    // Botones de ajuste dinámicos según tipo de problema
    const getBotones = () => {
        const has = currentProblem?.hasDecimals;
        return has
            ? [
                { vals: [10, 1, 0.1, 0.01], color: '#3498db' },
                { vals: [-10, -1, -0.1, -0.01], color: '#e74c3c' },
            ]
            : [
                { vals: [100, 10, 1], color: '#3498db' },
                { vals: [-100, -10, -1], color: '#e74c3c' },
            ];
    };

    const borderColor = feedback === 'CORRECT' ? '#2ecc71'
        : feedback === 'INCORRECT' ? '#e74c3c'
        : feedback === 'SKIP' ? '#f39c12'
        : 'transparent';

    return (
        <div style={st.container}>
            {showConfig && (
                <ConfigModal
                    config={config}
                    onChange={setConfig}
                    onStart={startGame}
                    onClose={() => setShowConfig(false)}
                />
            )}

            {/* HEADER */}
            <div style={st.header}>
                <button onClick={handleExit} style={st.btnVolver}><RotateCcw size={16} /> Salir</button>
                <button onClick={compartir} style={st.btnVolver} title="Compartir">
                    <Share2 size={16} />
                </button>
                {gameState === 'PLAYING' && (
                    <div style={st.scoreFlex}>
                        {modoEjercicios ? (
                            <div style={{ ...st.scoreBoard, color: '#009688' }}>
                                🔢 {ejercicioActual}/{config.numEjercicios}
                            </div>
                        ) : (
                            <div style={{ ...st.scoreBoard, color: timeLeft <= 10 ? '#e74c3c' : '#333' }}>
                                <Clock size={16} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        )}
                        <div style={{ ...st.scoreBoard, color: '#E91E63' }}>
                            <Trophy size={16} /> {score}
                        </div>
                        <div style={{ ...st.scoreBoard, color: '#27ae60', fontSize: '0.9rem' }}>
                            ✅ {aciertos}
                        </div>
                    </div>
                )}
            </div>

            {/* INICIO */}
            {gameState === 'START' && (
                <div style={{ ...st.centerCard, maxWidth: 560 }}>
                    <Brain size={52} color="#E91E63" style={{ marginBottom: 10 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.3rem', margin: '6px 0 4px' }}>Cálculo Mental</h1>
                    <p style={{ color: '#999', marginBottom: 22, fontSize: '0.9rem' }}>
                        Resuelve operaciones a contrarreloj o por ejercicios
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {MODOS_PRESET.map(m => (
                            <button key={m.id}
                                onClick={() => m.cfg ? startGame(m.cfg) : setShowConfig(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                                    background: 'white', border: `2px solid ${m.color}`, borderRadius: 16,
                                    cursor: 'pointer', textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s',
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.07)', width: '100%' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${m.color}33`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}
                            >
                                {/* Icono con fondo de color */}
                                <div style={{ background: m.color, borderRadius: 12, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                                    {m.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1rem', marginBottom: 3 }}>{m.label}</div>
                                    <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: m.ops ? 6 : 0 }}>{m.desc}</div>
                                    {m.ops && (
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {m.ops.map(op => (
                                                <span key={op} style={{ background: m.color + '22', color: m.color, border: `1px solid ${m.color}55`, borderRadius: 6, padding: '1px 7px', fontSize: '0.78rem', fontWeight: 700 }}>{op}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span style={{ color: m.color, fontSize: '1.3rem', flexShrink: 0 }}>›</span>
                            </button>
                        ))}

                        {/* Separador */}
                        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'2px 0' }}>
                            <div style={{ flex:1, height:1, background:'#eee' }} />
                            <span style={{ color:'#bbb', fontSize:'0.75rem' }}>juego de mesa</span>
                            <div style={{ flex:1, height:1, background:'#eee' }} />
                        </div>

                        {/* Oca Matemática */}
                        <button onClick={() => setShowOca(true)}
                            style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                                background:'white', border:'2px solid #e67e22', borderRadius:16,
                                cursor:'pointer', textAlign:'left', transition:'transform 0.15s, box-shadow 0.15s',
                                boxShadow:'0 3px 10px rgba(0,0,0,0.07)', width:'100%' }}
                            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 20px #e67e2233'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,0.07)'; }}
                        >
                            <div style={{ background:'#e67e22', borderRadius:12, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', flexShrink:0 }}>🦆</div>
                            <div style={{ flex:1 }}>
                                <div style={{ fontWeight:'bold', color:'#2c3e50', fontSize:'1rem', marginBottom:3 }}>La Oca Matemática</div>
                                <div style={{ color:'#888', fontSize:'0.82rem' }}>Hasta 4 jugadores · tablero · fracciones, decimales…</div>
                            </div>
                            <span style={{ color:'#e67e22', fontSize:'1.3rem' }}>›</span>
                        </button>

                        {/* Dominó Matemático */}
                        <button onClick={() => setShowDomino(true)}
                            style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                                background:'white', border:'2px solid #8e44ad', borderRadius:16,
                                cursor:'pointer', textAlign:'left', transition:'transform 0.15s, box-shadow 0.15s',
                                boxShadow:'0 3px 10px rgba(0,0,0,0.07)', width:'100%' }}
                            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 20px #8e44ad33'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,0.07)'; }}
                        >
                            <div style={{ background:'#8e44ad', borderRadius:12, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', flexShrink:0 }}>🁣</div>
                            <div style={{ flex:1 }}>
                                <div style={{ fontWeight:'bold', color:'#2c3e50', fontSize:'1rem', marginBottom:3 }}>Dominó Matemático</div>
                                <div style={{ color:'#888', fontSize:'0.82rem' }}>Hasta 4 jugadores · naturales, fracciones, ecuaciones…</div>
                            </div>
                            <span style={{ color:'#8e44ad', fontSize:'1.3rem' }}>›</span>
                        </button>
                    </div>
                </div>
            )}

            {/* JUEGO */}
            {gameState === 'PLAYING' && currentProblem && (
                <div style={{ ...st.centerCard, border: `4px solid ${borderColor}`, transition: 'border-color 0.2s, transform 0.2s', transform: feedback === 'CORRECT' ? 'scale(1.03)' : 'none' }}>

                    {/* Operación */}
                    <div style={{ fontSize: isMobile ? '2rem' : '3rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: 16, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {currentProblem.text} = ?
                    </div>

                    {/* Respuesta / Solución */}
                    <div style={{ background: '#f8f9fa', borderRadius: 14, padding: '12px 16px', marginBottom: 16, border: '2px solid #e0e0e0', position: 'relative' }}>
                        <span style={{ fontSize: '0.85rem', color: '#7f8c8d', display: 'block', marginBottom: 4 }}>
                            {showSolution ? '✅ Solución:' : 'Tu respuesta:'}
                        </span>
                        <div style={{ fontSize: isMobile ? '2.5rem' : '3rem', fontWeight: 'bold', color: showSolution ? '#27ae60' : '#E91E63', textAlign: 'center' }}>
                            {showSolution ? currentProblem.displayAnswer : currentAnswer}
                        </div>
                        {!showSolution && (
                            <button onClick={resetAnswer} style={{ position: 'absolute', top: 10, right: 12, background: 'transparent', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: 4 }}>
                                <Delete size={22} />
                            </button>
                        )}
                    </div>

                    {/* Botonera numérica */}
                    {!showSolution && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                            {getBotones().map((fila, fi) => (
                                <div key={fi} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                    {fila.vals.map(v => (
                                        <CalcBtn key={v} val={v} color={fila.color} onClick={() => handleAdd(v)} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Botones de acción */}
                    {!showSolution && (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleSkip} style={st.btnSkip} title="Pasar (−2 pts, ver solución)">
                                <SkipForward size={18} /> Pasar
                            </button>
                            <button onClick={checkAnswer} style={{ ...st.btnSuccess, flex: 2 }}>
                                <CheckCircle size={20} /> Comprobar
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* FINAL */}
            {gameState === 'END' && (
                <div style={st.centerCard}>
                    {score >= 80 && <Confetti recycle={false} />}
                    {modoEjercicios
                        ? <Trophy size={70} color="#f1c40f" style={{ marginBottom: 16 }} />
                        : <Clock size={70} color="#f1c40f" style={{ marginBottom: 16 }} />
                    }
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.2rem' }}>
                        {modoEjercicios ? '¡Ejercicios completados!' : '¡Tiempo Agotado!'}
                    </h1>
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#E91E63', margin: '8px 0' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: 6 }}>Puntos Totales</p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ {aciertos} aciertos</span>
                        <span style={{ color: '#f39c12', fontWeight: 'bold' }}>⏭ {skips} pasadas</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => startGame(config)} style={{ ...st.btnPrimary, background: '#E91E63' }}>
                            <RotateCcw size={16} /> Repetir
                        </button>
                        <button onClick={() => { setShowConfig(true); setGameState('START'); }} style={{ ...st.btnPrimary, background: '#7f8c8d' }}>
                            <Settings size={16} /> Configurar
                        </button>
                        <button onClick={() => setGameState('START')} style={st.btnVolver}>Menú</button>
                        <button onClick={() => setMostrarEnvio(true)} style={{ ...st.btnPrimary, background: 'linear-gradient(135deg,#27ae60,#2ecc71)' }}>
                            📤 Enviar al profesor
                        </button>
                    </div>
                </div>
            )}
            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ aciertos, puntos: score }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}

// ─── Botón calculadora ────────────────────────────────────────────────────────
const CalcBtn = ({ val, color, onClick }) => {
    const label = val > 0 ? `+${val}` : `${val}`;
    return (
        <button
            onClick={onClick}
            style={{ flex: 1, padding: '13px 4px', fontSize: '1.1rem', fontWeight: 'bold', color: 'white', background: color, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: `0 4px 0 rgba(0,0,0,0.2)`, transition: 'transform 0.1s, box-shadow 0.1s', minWidth: 44 }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = 'none'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 0 rgba(0,0,0,0.2)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 0 rgba(0,0,0,0.2)`; }}
            onTouchStart={e => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = 'none'; }}
            onTouchEnd={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 0 rgba(0,0,0,0.2)`; }}
        >
            {label}
        </button>
    );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const st = {
    container: { minHeight: '100vh', background: '#fce4ec', padding: '15px', fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    btnSettings: { padding: '8px 14px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', color: '#555' },
    scoreFlex: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    scoreBoard: { display: 'flex', gap: 6, background: 'white', padding: '7px 14px', borderRadius: 30, fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: 520, margin: '10px auto', padding: '22px 20px', borderRadius: 20, textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
    btnPrimary: { color: 'white', border: 'none', padding: '13px 20px', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 10px rgba(0,0,0,0.2)', width: '100%', maxWidth: 300 },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #1e8449' },
    btnSkip: { background: '#f39c12', color: 'white', border: 'none', borderRadius: 14, padding: '14px 16px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 5px 0 #d68910', flex: 1 },
};

const mStyles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
    modalTitle: { textAlign: 'center', color: '#2c3e50', fontSize: '1.4rem', marginTop: 0, marginBottom: 20 },
    section: { marginBottom: 20 },
    sectionTitle: { fontWeight: 'bold', color: '#555', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 },
    chip: { padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.15s' },
    label: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#555', fontSize: '0.85rem' },
    numInput: { width: 80, padding: '8px', fontSize: '1.1rem', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', outline: 'none' },
    btnPrimary: { padding: '12px 28px', background: '#E91E63', color: 'white', border: 'none', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' },
    btnSecondary: { padding: '12px 24px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};
