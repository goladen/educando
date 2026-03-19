import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, CheckCircle, Trophy, Clock, Brain, Delete, Settings, SkipForward } from 'lucide-react';
import Confetti from 'react-confetti';
import OcaMatematica from './OcaMatematica';

// ─── Configuración por defecto ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    minNum: 1,
    maxNum: 50,
    tiempo: 120,
    tipos: { positivos: true, negativos: false, decimales: false, fracciones: false },
    operaciones: { suma: true, resta: true, multiplicacion: false, division: false },
};

// Configuraciones de los modos predefinidos
const MODOS_PRESET = [
    {
        id: 'EASY', icon: '👶', label: 'Sencillo', desc: 'Sumas y restas · números positivos', color: '#2ecc71',
        cfg: { minNum: 1, maxNum: 50, tiempo: 120,
               tipos: { positivos: true, negativos: false, decimales: false, fracciones: false },
               operaciones: { suma: true, resta: true, multiplicacion: false, division: false } }
    },
    {
        id: 'MEDIUM', icon: '🤓', label: 'Medio', desc: 'Todas las operaciones · negativos', color: '#f39c12',
        cfg: { minNum: 1, maxNum: 100, tiempo: 120,
               tipos: { positivos: true, negativos: true, decimales: false, fracciones: false },
               operaciones: { suma: true, resta: true, multiplicacion: true, division: true } }
    },
    {
        id: 'HARD', icon: '🔥', label: 'Difícil', desc: 'Decimales y fracciones incluidos', color: '#e74c3c',
        cfg: { minNum: 1, maxNum: 100, tiempo: 120,
               tipos: { positivos: true, negativos: true, decimales: true, fracciones: true },
               operaciones: { suma: true, resta: true, multiplicacion: true, division: true } }
    },
    {
        id: 'CUSTOM', icon: '⚙️', label: 'Personalizado', desc: 'Elige tú los números y operaciones', color: '#9b59b6',
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
            const a = allowNeg ? rInt(-maxNum, maxNum) : rInt(minNum, maxNum);
            const b = allowNeg ? rInt(-maxNum, maxNum) : rInt(1, maxNum);
            answer = a - b;
            text = b >= 0 ? `${a} − ${b}` : `${a} − (${b})`;
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

// ─── Componente Modal de Configuración ───────────────────────────────────────
const ConfigModal = ({ config, onChange, onStart, onClose }) => {
    const [local, setLocal] = useState(config);

    const setField = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));
    const setTipo = (k) => setLocal(prev => ({ ...prev, tipos: { ...prev.tipos, [k]: !prev.tipos[k] } }));
    const setOp = (k) => setLocal(prev => ({ ...prev, operaciones: { ...prev.operaciones, [k]: !prev.operaciones[k] } }));

    const TIPOS = [
        { key: 'positivos', label: 'Positivos', emoji: '➕' },
        { key: 'negativos', label: 'Negativos', emoji: '➖' },
        { key: 'decimales', label: 'Decimales', emoji: '🔢' },
        { key: 'fracciones', label: 'Fracciones', emoji: '½' },
    ];
    const OPS = [
        { key: 'suma', label: 'Suma (+)', color: '#3498db' },
        { key: 'resta', label: 'Resta (−)', color: '#e74c3c' },
        { key: 'multiplicacion', label: 'Multiplicación (×)', color: '#f39c12' },
        { key: 'division', label: 'División (÷)', color: '#9b59b6' },
    ];
    const TIEMPOS = [60, 90, 120, 180, 300];

    return (
        <div style={mStyles.overlay}>
            <div style={mStyles.modal}>
                <h2 style={mStyles.modalTitle}>⚙️ Configurar Partida</h2>

                {/* Rango de números */}
                <div style={mStyles.section}>
                    <div style={mStyles.sectionTitle}>Rango de números</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <label style={mStyles.label}>Mínimo
                            <input type="number" value={local.minNum} min={0} max={local.maxNum - 1}
                                onChange={e => setField('minNum', Math.max(0, parseInt(e.target.value) || 0))}
                                style={mStyles.numInput} />
                        </label>
                        <span style={{ fontSize: '1.5rem', color: '#aaa' }}>—</span>
                        <label style={mStyles.label}>Máximo
                            <input type="number" value={local.maxNum} min={local.minNum + 1} max={9999}
                                onChange={e => setField('maxNum', Math.max(local.minNum + 1, parseInt(e.target.value) || 10))}
                                style={mStyles.numInput} />
                        </label>
                    </div>
                </div>

                {/* Tiempo */}
                <div style={mStyles.section}>
                    <div style={mStyles.sectionTitle}>Tiempo de juego</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {TIEMPOS.map(t => (
                            <button key={t} onClick={() => setField('tiempo', t)}
                                style={{ ...mStyles.chip, background: local.tiempo === t ? '#E91E63' : '#f0f0f0', color: local.tiempo === t ? 'white' : '#555' }}>
                                {t < 60 ? `${t}s` : `${t / 60} min`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tipos de números */}
                <div style={mStyles.section}>
                    <div style={mStyles.sectionTitle}>Tipos de números</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {TIPOS.map(({ key, label, emoji }) => (
                            <button key={key} onClick={() => setTipo(key)}
                                style={{ ...mStyles.chip, background: local.tipos[key] ? '#E91E63' : '#f0f0f0', color: local.tipos[key] ? 'white' : '#555' }}>
                                {emoji} {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Operaciones */}
                <div style={mStyles.section}>
                    <div style={mStyles.sectionTitle}>Operaciones</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {OPS.map(({ key, label, color }) => (
                            <button key={key} onClick={() => setOp(key)}
                                style={{ ...mStyles.chip, background: local.operaciones[key] ? color : '#f0f0f0', color: local.operaciones[key] ? 'white' : '#555' }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
                    <button onClick={onClose} style={mStyles.btnSecondary}>Cancelar</button>
                    <button onClick={() => { onChange(local); onStart(local); }} style={mStyles.btnPrimary}>
                        ▶ Empezar
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CalculoMentalGame({ usuario, onExit }) {
    const [gameState, setGameState] = useState('START');
    const [showOca, setShowOca] = useState(false);
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [showConfig, setShowConfig] = useState(false);
    const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.tiempo);
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [skips, setSkips] = useState(0);

    const [currentProblem, setCurrentProblem] = useState(null);
    const [currentAnswer, setCurrentAnswer] = useState(0);
    const [feedback, setFeedback] = useState(null); // 'CORRECT' | 'INCORRECT' | 'SKIP'
    const [showSolution, setShowSolution] = useState(false);

    const timerRef = useRef(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

    // Temporizador
    useEffect(() => {
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (timeLeft <= 0 && gameState === 'PLAYING') {
            clearInterval(timerRef.current);
            setGameState('END');
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft]);

    const startGame = (cfg = config) => {
        setConfig(cfg);
        setScore(0);
        setAciertos(0);
        setSkips(0);
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

    const checkAnswer = () => {
        if (!currentProblem || showSolution) return;
        const isCorrect = Math.abs(currentAnswer - currentProblem.answer) < 0.001;
        if (isCorrect) {
            setScore(s => s + 10);
            setAciertos(a => a + 1);
            setFeedback('CORRECT');
            setTimeout(() => {
                setFeedback(null);
                setCurrentAnswer(0);
                setCurrentProblem(generarProblema(config));
                setShowSolution(false);
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
            setCurrentAnswer(0);
            setCurrentProblem(generarProblema(config));
            setShowSolution(false);
        }, 2000);
    };

    if (showOca) return <OcaMatematica onExit={() => setShowOca(false)} />;

    const handleExit = () => {
        clearInterval(timerRef.current);
        if (gameState !== 'START') setGameState('START');
        else if (typeof onExit === 'function') onExit();
        else window.location.href = '/';
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
                {gameState === 'PLAYING' && (
                    <div style={st.scoreFlex}>
                        <div style={{ ...st.scoreBoard, color: timeLeft <= 10 ? '#e74c3c' : '#333' }}>
                            <Clock size={16} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
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
                    <Brain size={55} color="#E91E63" style={{ marginBottom: 12 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.4rem', margin: '8px 0' }}>Cálculo Mental</h1>
                    <p style={{ color: '#666', marginBottom: 24, fontSize: '1rem', lineHeight: 1.5 }}>
                        Resuelve tantas operaciones como puedas antes de que se acabe el tiempo.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {MODOS_PRESET.map(m => (
                            <button key={m.id}
                                onClick={() => m.cfg ? startGame(m.cfg) : setShowConfig(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                                    background: 'white', border: `2px solid ${m.color}`, borderRadius: 14,
                                    cursor: 'pointer', textAlign: 'left', transition: 'transform 0.15s',
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.07)' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <span style={{ fontSize: '2rem', minWidth: 36 }}>{m.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: m.color, fontSize: '1.05rem' }}>{m.label}</div>
                                    <div style={{ color: '#888', fontSize: '0.85rem' }}>{m.desc}</div>
                                </div>
                            </button>
                        ))}

                        {/* Separador */}
                        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0' }}>
                            <div style={{ flex:1, height:1, background:'#eee' }} />
                            <span style={{ color:'#bbb', fontSize:'0.78rem' }}>juego de mesa</span>
                            <div style={{ flex:1, height:1, background:'#eee' }} />
                        </div>

                        {/* Oca Matemática */}
                        <button onClick={() => setShowOca(true)}
                            style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
                                background:'white', border:'2px solid #e67e22', borderRadius:14,
                                cursor:'pointer', textAlign:'left', transition:'transform 0.15s',
                                boxShadow:'0 3px 10px rgba(0,0,0,0.07)' }}
                            onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'}
                            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                        >
                            <span style={{ fontSize:'2rem', minWidth:36 }}>🦆</span>
                            <div>
                                <div style={{ fontWeight:'bold', color:'#e67e22', fontSize:'1.05rem' }}>La Oca Matemática</div>
                                <div style={{ color:'#888', fontSize:'0.85rem' }}>Hasta 4 jugadores · tablero · fracciones, decimales…</div>
                            </div>
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
                    <Clock size={70} color="#f1c40f" style={{ marginBottom: 16 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.2rem' }}>¡Tiempo Agotado!</h1>
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
                    </div>
                </div>
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
