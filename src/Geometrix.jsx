import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, CheckCircle, XCircle, Trophy, ArrowRight, Calculator, Ruler } from 'lucide-react';
import Confetti from 'react-confetti';

const UNIDADES = ['mm', 'cm', 'dm', 'm', 'dam', 'hm', 'km'];
const FIGURAS_TODAS = ['CUADRADO', 'RECTANGULO', 'TRIANGULO', 'CIRCULO', 'ROMBO', 'TRAPECIO', 'CUBO', 'PRISMA', 'CILINDRO', 'CONO'];

// 1cm en CSS px estándar (96dpi: 1 pulgada = 96px → 1cm = 37.8px)
const SCALE = 37.8;

// ─── Genera la operación legible con los valores reales ───────────────────────
const generarFormula = (shape, type, params, unit) => {
    const u = unit, u2 = `${unit}²`, u3 = `${unit}³`;
    switch (shape) {
        case 'CUADRADO':
            return type === 'ÁREA'
                ? `A = l² = ${params.l} × ${params.l} = ${params.l * params.l} ${u2}`
                : `P = 4 × l = 4 × ${params.l} = ${4 * params.l} ${u}`;
        case 'RECTANGULO':
            return type === 'ÁREA'
                ? `A = b × h = ${params.b} × ${params.h} = ${params.b * params.h} ${u2}`
                : `P = 2×(b+h) = 2×(${params.b}+${params.h}) = ${2 * (params.b + params.h)} ${u}`;
        case 'TRIANGULO':
            return `A = (b × h) / 2 = (${params.b} × ${params.h}) / 2 = ${(params.b * params.h) / 2} ${u2}`;
        case 'CIRCULO':
            return type === 'ÁREA'
                ? `A = π × r² = 3.14 × ${params.r}² = ${parseFloat((Math.PI * params.r ** 2).toFixed(2))} ${u2}`
                : `P = 2 × π × r = 2 × 3.14 × ${params.r} = ${parseFloat((2 * Math.PI * params.r).toFixed(2))} ${u}`;
        case 'ROMBO':
            return type === 'ÁREA'
                ? `A = (D × d) / 2 = (${params.D} × ${params.d}) / 2 = ${(params.D * params.d) / 2} ${u2}`
                : `P = 4 × l = 4 × ${params.l} = ${4 * params.l} ${u}`;
        case 'TRAPECIO':
            return type === 'ÁREA'
                ? `A = ((B+b) / 2) × h = ((${params.B}+${params.b}) / 2) × ${params.h} = ${parseFloat((((params.B + params.b) / 2) * params.h).toFixed(2))} ${u2}`
                : `P = B+b+2×l = ${params.B}+${params.b}+2×${params.l_obl} = ${params.B + params.b + 2 * params.l_obl} ${u}`;
        case 'CUBO':
            return `V = a³ = ${params.a} × ${params.a} × ${params.a} = ${params.a ** 3} ${u3}`;
        case 'PRISMA':
            return `V = lb² × h = ${params.lb}² × ${params.h} = ${params.lb ** 2 * params.h} ${u3}`;
        case 'CILINDRO':
            return `V = π × r² × h = 3.14 × ${params.r}² × ${params.h} = ${parseFloat((Math.PI * params.r ** 2 * params.h).toFixed(2))} ${u3}`;
        case 'CONO':
            return `V = (π × r² × h) / 3 = (3.14 × ${params.r}² × ${params.h}) / 3 = ${parseFloat(((Math.PI * params.r ** 2 * params.h) / 3).toFixed(2))} ${u3}`;
        default: return '';
    }
};

export default function GeometriaGame({ usuario, onExit }) {
    const [gameState, setGameState] = useState('START');
    const [modoRegla, setModoRegla] = useState(false);
    const [score, setScore] = useState(0);
    const [questionNum, setQuestionNum] = useState(1);
    const [maxQuestions] = useState(10);

    const [currentProblem, setCurrentProblem] = useState(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [userUnit, setUserUnit] = useState('');
    const [userExp, setUserExp] = useState('');
    const [feedback, setFeedback] = useState(null);

    const [canvasDim, setCanvasDim] = useState({ w: 600, h: 350 });
    const [isMobile, setIsMobile] = useState(false);
    const bagRef = useRef([]);
    const canvasRef = useRef(null);
    const cardRef = useRef(null);

    useEffect(() => {
        const update = () => {
            const mobile = window.innerWidth <= 600;
            setIsMobile(mobile);
            requestAnimationFrame(() => {
                const cardW = cardRef.current
                    ? cardRef.current.clientWidth - (mobile ? 40 : 60)
                    : Math.min(640, window.innerWidth - (mobile ? 40 : 80));
                setCanvasDim({ w: Math.max(200, cardW), h: mobile ? 240 : 350 });
            });
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [gameState]);

    const getNextShape = () => {
        if (bagRef.current.length === 0)
            bagRef.current = [...FIGURAS_TODAS].sort(() => Math.random() - 0.5);
        return bagRef.current.pop();
    };

    const generarProblema = (isReglaMode = modoRegla) => {
        const shape = getNextShape();
        const unit = isReglaMode ? 'cm' : UNIDADES[Math.floor(Math.random() * UNIDADES.length)];

        let text = '', correctAnswer = 0, type = '', correctExp = '', params = {};

        const maxCmX = Math.max(3, Math.floor(canvasDim.w / SCALE) - 2);
        const maxCmY = Math.max(3, Math.floor(canvasDim.h / SCALE) - 2);
        const safeMinMax = Math.min(maxCmX, maxCmY);

        const rInt = (min, max, limitForScreen) => {
            const realMax = (isReglaMode && limitForScreen) ? Math.min(max, limitForScreen) : max;
            const realMin = Math.min(min, realMax);
            return Math.floor(Math.random() * (realMax - realMin + 1)) + realMin;
        };

        switch (shape) {
            case 'CUADRADO':
                params.l = rInt(3, 15, safeMinMax);
                type = Math.random() > 0.5 ? 'ÁREA' : 'PERÍMETRO';
                correctAnswer = type === 'ÁREA' ? params.l ** 2 : 4 * params.l;
                correctExp = type === 'ÁREA' ? '2' : '';
                text = `Calcula el ${type} de este cuadrado.`;
                break;
            case 'RECTANGULO':
                params.b = rInt(5, 20, maxCmX);
                params.h = rInt(3, params.b - 1, maxCmY);
                type = Math.random() > 0.5 ? 'ÁREA' : 'PERÍMETRO';
                correctAnswer = type === 'ÁREA' ? params.b * params.h : 2 * params.b + 2 * params.h;
                correctExp = type === 'ÁREA' ? '2' : '';
                text = `Calcula el ${type} de este rectángulo.`;
                break;
            case 'TRIANGULO':
                params.b = rInt(4, 15, maxCmX);
                params.h = rInt(4, 15, maxCmY);
                type = 'ÁREA';
                correctAnswer = (params.b * params.h) / 2;
                correctExp = '2';
                text = `Calcula el ÁREA de este triángulo.`;
                break;
            case 'CIRCULO':
                params.r = rInt(3, 10, Math.floor(safeMinMax / 2));
                type = Math.random() > 0.5 ? 'ÁREA' : 'PERÍMETRO';
                correctAnswer = type === 'ÁREA' ? Math.PI * params.r ** 2 : 2 * Math.PI * params.r;
                correctExp = type === 'ÁREA' ? '2' : '';
                text = `Calcula el ${type} de este círculo (Usa π ≈ 3.14).`;
                break;
            case 'ROMBO':
                type = Math.random() > 0.5 ? 'ÁREA' : 'PERÍMETRO';
                if (type === 'ÁREA') {
                    params.D = rInt(8, 20, maxCmX);
                    params.d = rInt(4, params.D - 2, maxCmY);
                    correctAnswer = (params.D * params.d) / 2;
                    correctExp = '2';
                } else {
                    params.l = rInt(5, 12, Math.floor(safeMinMax * 0.7));
                    correctAnswer = 4 * params.l;
                    correctExp = '';
                }
                text = `Calcula el ${type} de este rombo.`;
                break;
            case 'TRAPECIO':
                type = Math.random() > 0.5 ? 'ÁREA' : 'PERÍMETRO';
                params.B = rInt(10, 25, maxCmX);
                params.b = rInt(4, params.B - 2, maxCmX);
                if (type === 'ÁREA') {
                    params.h = rInt(4, 12, maxCmY);
                    correctAnswer = ((params.B + params.b) / 2) * params.h;
                    correctExp = '2';
                } else {
                    params.l_obl = rInt(5, 12, Math.floor(safeMinMax * 0.8));
                    correctAnswer = params.B + params.b + 2 * params.l_obl;
                    correctExp = '';
                }
                text = `Calcula el ${type} de este trapecio isósceles.`;
                break;
            case 'CUBO':
                params.a = rInt(3, 10, Math.floor(safeMinMax * 0.55));
                type = 'VOLUMEN';
                correctAnswer = params.a ** 3;
                correctExp = '3';
                text = isReglaMode ? `Mide la cara frontal del cubo y calcula su VOLUMEN.` : `Calcula el VOLUMEN de este cubo.`;
                break;
            case 'PRISMA':
                params.lb = rInt(3, 8, Math.floor(maxCmX * 0.45));
                params.h = rInt(6, 15, Math.floor(maxCmY * 0.75));
                type = 'VOLUMEN';
                correctAnswer = params.lb ** 2 * params.h;
                correctExp = '3';
                text = isReglaMode ? `Mide el ancho y el alto del prisma y calcula su VOLUMEN.` : `Calcula el VOLUMEN de este prisma de base cuadrada.`;
                break;
            case 'CILINDRO':
                params.r = rInt(3, 8, Math.floor(maxCmX * 0.38));
                params.h = rInt(6, 15, Math.floor(maxCmY * 0.75));
                type = 'VOLUMEN';
                correctAnswer = Math.PI * params.r ** 2 * params.h;
                correctExp = '3';
                text = isReglaMode ? `Mide el radio y la altura y calcula el VOLUMEN (π ≈ 3.14).` : `Calcula el VOLUMEN de este cilindro (Usa π ≈ 3.14).`;
                break;
            case 'CONO':
                params.r = rInt(3, 8, Math.floor(maxCmX * 0.38));
                params.h = rInt(6, 15, Math.floor(maxCmY * 0.75));
                type = 'VOLUMEN';
                correctAnswer = (Math.PI * params.r ** 2 * params.h) / 3;
                correctExp = '3';
                text = isReglaMode ? `Mide la base y la altura del cono y calcula su VOLUMEN (π ≈ 3.14).` : `Calcula el VOLUMEN de este cono (Usa π ≈ 3.14).`;
                break;
        }

        const formula = generarFormula(shape, type, params, unit);
        setCurrentProblem({ shape, text, type, unit, params, correctAnswer: parseFloat(correctAnswer.toFixed(2)), correctExp, formula });
        setUserAnswer(''); setUserUnit(isReglaMode ? 'cm' : ''); setUserExp(''); setFeedback(null);
    };

    const startGame = (isReglaMode) => {
        setModoRegla(isReglaMode); setScore(0); setQuestionNum(1); bagRef.current = [];
        generarProblema(isReglaMode); setGameState('PLAYING');
    };

    const checkAnswer = () => {
        if (!userAnswer || !userUnit) return;
        const userVal = parseFloat(userAnswer.replace(',', '.'));
        const correctVal = currentProblem.correctAnswer;
        const margen = Math.max(0.2, correctVal * (modoRegla ? 0.05 : 0.02));
        const isNumCorrect = Math.abs(userVal - correctVal) <= margen;
        const isUnitCorrect = userUnit === currentProblem.unit;
        const isExpCorrect = userExp === currentProblem.correctExp;
        const strUnit = `${currentProblem.unit}${currentProblem.correctExp === '2' ? '²' : currentProblem.correctExp === '3' ? '³' : ''}`;

        let message = '', totalCorrect = false;
        if (isNumCorrect && isUnitCorrect && isExpCorrect) {
            setScore(s => s + 10); message = `¡Perfecto! Resultado correcto: ${correctVal} ${strUnit}`; totalCorrect = true;
        } else if (isNumCorrect) {
            message = `¡El número está bien! Pero las unidades son incorrectas. Era ${strUnit}`;
        } else {
            message = `Incorrecto. El resultado era ${correctVal} ${strUnit}`;
        }
        setFeedback({ isCorrect: totalCorrect, message, formula: currentProblem.formula });
        setGameState('FEEDBACK');
    };

    const nextQuestion = () => {
        if (questionNum >= maxQuestions) { setGameState('END'); }
        else { setQuestionNum(q => q + 1); generarProblema(modoRegla); setGameState('PLAYING'); }
    };

    const handleExit = () => {
        if (gameState !== 'START') { setGameState('START'); }
        else { if (onExit) onExit(); else window.location.href = '/'; }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button onClick={handleExit} style={styles.btnVolver}><RotateCcw size={16} /> Salir</button>
                {gameState !== 'START' && (
                    <div style={styles.scoreBoard}>
                        <span>{questionNum}/{maxQuestions}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f1c40f' }}>
                            <Trophy size={16} /> {score} pts
                        </div>
                        <span style={{ background: modoRegla ? '#f39c12' : '#3498db', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem' }}>
                            {modoRegla ? '📏 Regla' : '🔢 Fórmulas'}
                        </span>
                    </div>
                )}
            </div>

            {/* ── START ── */}
            {gameState === 'START' && (
                <div ref={cardRef} style={styles.centerCard}>
                    <Calculator size={55} color="#009688" style={{ marginBottom: 8 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.4rem', margin: '8px 0' }}>Geometrix</h1>
                    <p style={{ color: '#666', marginBottom: 28, fontSize: '1rem' }}>Elige cómo quieres practicar:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                        <button onClick={() => startGame(false)} style={{ ...styles.btnPrimary, background: '#3498db' }}>
                            <Calculator size={20} /> Modo Numérico (Fórmulas)
                        </button>
                        <button onClick={() => startGame(true)} style={{ ...styles.btnPrimary, background: '#f39c12' }}>
                            <Ruler size={20} /> Modo Regla (Medir en pantalla)
                        </button>
                    </div>
                </div>
            )}

            {/* ── PLAYING ── */}
            {gameState === 'PLAYING' && currentProblem && (
                <div ref={cardRef} style={styles.centerCard}>
                    {modoRegla ? (
                        // MODO REGLA: escala física real (1cm = 37.8px), scroll horizontal si es necesario
                        <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', borderRadius: 14, border: '1px solid #ddd', background: '#f8f9fa', marginBottom: 18 }}>
                            <div ref={canvasRef} style={{ position: 'relative', width: `${canvasDim.w}px`, height: `${canvasDim.h}px`, flexShrink: 0 }}>
                                <ShapeRenderer shape={currentProblem.shape} params={currentProblem.params} unit={currentProblem.unit} hideText={true} canvasDim={canvasDim} rulerMode={true} />
                                <VirtualRuler canvasRef={canvasRef} canvasDim={canvasDim} />
                            </div>
                        </div>
                    ) : (
                        // MODO FÓRMULAS: responsive, escala visual adaptada, etiquetas visibles
                        <div ref={canvasRef} style={{ position: 'relative', width: '100%', height: `${canvasDim.h}px`, margin: '0 auto 18px auto', background: '#f8f9fa', borderRadius: 14, border: '1px solid #ddd', overflow: 'hidden' }}>
                            <ShapeRenderer shape={currentProblem.shape} params={currentProblem.params} unit={currentProblem.unit} hideText={false} canvasDim={canvasDim} rulerMode={false} />
                        </div>
                    )}

                    <p style={{ fontSize: isMobile ? '1rem' : '1.15rem', color: '#333', fontWeight: 'bold', margin: '0 auto 18px', lineHeight: 1.5 }}>
                        {currentProblem.text}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#f8f9fa', padding: 14, borderRadius: 14 }}>
                        <input type="number" step="0.01" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkAnswer()} placeholder="Número..." style={{ ...styles.inputNum, width: isMobile ? 95 : 115 }} autoFocus={!isMobile} />
                        <select value={userUnit} onChange={e => setUserUnit(e.target.value)} style={styles.inputSelect} disabled={modoRegla}>
                            <option value="">Unidad...</option>
                            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <select value={userExp} onChange={e => setUserExp(e.target.value)} style={styles.inputSelect}>
                            <option value="">(Lineal)</option>
                            <option value="2">² Cuadrado</option>
                            <option value="3">³ Cúbico</option>
                        </select>
                        <button onClick={checkAnswer} style={{ ...styles.btnSuccess, background: modoRegla ? '#f39c12' : '#27ae60', width: isMobile ? '100%' : 'auto' }} disabled={!userAnswer || !userUnit}>
                            Comprobar
                        </button>
                    </div>
                </div>
            )}

            {/* ── FEEDBACK ── */}
            {gameState === 'FEEDBACK' && feedback && (
                <div style={{ ...styles.centerCard, border: `3px solid ${feedback.isCorrect ? '#2ecc71' : '#e74c3c'}` }}>
                    {feedback.isCorrect ? <CheckCircle size={55} color="#2ecc71" /> : <XCircle size={55} color="#e74c3c" />}
                    <h2 style={{ color: feedback.isCorrect ? '#27ae60' : '#c0392b', fontSize: isMobile ? '1rem' : '1.2rem', margin: '12px 0' }}>
                        {feedback.message}
                    </h2>

                    {/* Operación desglosada */}
                    <div style={styles.formulaBox}>
                        <div style={styles.formulaLabel}>📐 Operación a realizar:</div>
                        <div style={styles.formulaText}>{feedback.formula}</div>
                    </div>

                    <button onClick={nextQuestion} style={{ ...styles.btnPrimary, background: modoRegla ? '#f39c12' : '#3498db', marginTop: 20 }}>
                        {questionNum >= maxQuestions ? 'Ver Resultados' : 'Siguiente'} <ArrowRight size={18} />
                    </button>
                </div>
            )}

            {/* ── END ── */}
            {gameState === 'END' && (
                <div style={styles.centerCard}>
                    {score >= 50 && <Confetti recycle={false} />}
                    <Trophy size={75} color="#f1c40f" style={{ marginBottom: 16 }} />
                    <h1 style={{ color: '#2c3e50' }}>¡Desafío Completado!</h1>
                    <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#f1c40f' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: 28 }}>Puntos sobre 100</p>
                    <button onClick={handleExit} style={{ ...styles.btnPrimary, background: '#009688' }}>Salir al Menú</button>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// REGLA VIRTUAL
// ═══════════════════════════════════════════════════
const VirtualRuler = ({ canvasRef, canvasDim }) => {
    const [pos, setPos] = useState({ x: 10, y: canvasDim.h - 55 });
    const [angle, setAngle] = useState(0);
    const rulerRef = useRef(null);
    const draggingCenter = useRef(false);
    const draggingRotate = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const rulerCmLength = Math.max(5, Math.floor(canvasDim.w / SCALE) - 1);

    useEffect(() => {
        const getXY = (e) => e.touches && e.touches[0]
            ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
            : { clientX: e.clientX, clientY: e.clientY };

        const handleMove = (e) => {
            if (!draggingCenter.current && !draggingRotate.current) return;
            e.preventDefault();
            const { clientX, clientY } = getXY(e);
            if (draggingCenter.current && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                // Permitimos que la regla salga parcialmente por los bordes (útil para medir extremos)
                // Solo limitamos que el punto de anclaje (origen de la regla) no salga del canvas
                const rulerW = rulerCmLength * SCALE;
                setPos({
                    x: Math.max(-rulerW + 20, Math.min(canvasDim.w - 20, clientX - rect.left - offset.current.x)),
                    y: Math.max(-10, Math.min(canvasDim.h - 25, clientY - rect.top - offset.current.y)),
                });
            } else if (draggingRotate.current && rulerRef.current) {
                const rect = rulerRef.current.getBoundingClientRect();
                setAngle(Math.atan2(clientY - (rect.top + rect.height / 2), clientX - rect.left) * (180 / Math.PI));
            }
        };
        const handleUp = () => { draggingCenter.current = false; draggingRotate.current = false; };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [canvasRef, canvasDim, rulerCmLength]);

    const startDrag = (e, type) => {
        e.preventDefault(); e.stopPropagation();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        if (type === 'move' && canvasRef.current) {
            draggingCenter.current = true;
            const rect = canvasRef.current.getBoundingClientRect();
            offset.current = { x: clientX - rect.left - pos.x, y: clientY - rect.top - pos.y };
        } else if (type === 'rotate') {
            draggingRotate.current = true;
        }
    };

    const marks = [];
    for (let i = 0; i <= rulerCmLength; i++) {
        marks.push(
            <div key={i} style={{ position: 'absolute', left: `${i * SCALE}px`, top: 0, height: i % 5 === 0 ? '100%' : '50%', width: 1, background: '#333' }}>
                {i % 5 === 0 && <span style={{ position: 'absolute', bottom: -16, left: -4, fontSize: 11, fontWeight: 'bold', color: '#333', transform: `rotate(${-angle}deg)`, userSelect: 'none' }}>{i}</span>}
            </div>
        );
    }

    // Ángulo más pequeño positivo que forma la regla respecto a la horizontal [0, 90]
    const angleFromHorizontal = (() => {
        const norm = ((angle % 180) + 180) % 180; // normaliza a [0, 180)
        return norm <= 90 ? norm : 180 - norm;     // distancia a 0° o a 180°
    })();

    // Si está a menos de 45° de la horizontal → snap a vertical (90°, el 0 queda arriba)
    // Si está a 45° o más de la horizontal  → snap a horizontal (0°, el 0 queda a la izq)
    const handleSnap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setAngle(angleFromHorizontal < 45 ? 90 : 0);
    };

    return (
        <div
            ref={rulerRef}
            style={{ position: 'absolute', left: pos.x, top: pos.y, width: `${rulerCmLength * SCALE}px`, height: 35, background: 'rgba(241,196,15,0.72)', border: '1px solid rgba(0,0,0,0.28)', borderRadius: 3, transform: `rotate(${angle}deg)`, transformOrigin: '0 50%', cursor: 'grab', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.18)', touchAction: 'none', userSelect: 'none' }}
            onMouseDown={e => startDrag(e, 'move')}
            onTouchStart={e => startDrag(e, 'move')}
        >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>{marks}</div>

            {/* Botón snap: izquierda de la regla */}
            <div
                title={angleFromHorizontal < 45 ? 'Poner vertical' : 'Poner horizontal'}
                style={{ position: 'absolute', left: -15, top: '50%', transform: `translateY(-50%) rotate(${-angle}deg)`, width: 32, height: 32, background: '#27ae60', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', touchAction: 'none', fontSize: 15, fontWeight: 'bold' }}
                onMouseDown={handleSnap}
                onTouchStart={handleSnap}
            >{angleFromHorizontal < 45 ? '↕' : '↔'}</div>

            {/* Botón rotar: derecha de la regla */}
            <div
                style={{ position: 'absolute', right: -15, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, background: '#3498db', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'crosshair', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', touchAction: 'none', fontSize: 18 }}
                onMouseDown={e => { e.stopPropagation(); startDrag(e, 'rotate'); }}
                onTouchStart={e => { e.stopPropagation(); startDrag(e, 'rotate'); }}
            >↻</div>
        </div>
    );
};

// ═══════════════════════════════════════════════════
// DIBUJANTE DE FIGURAS
// rulerMode=true  → SVG con px exactos, escala física real (SCALE)
// rulerMode=false → SVG 100% responsive, escala visual adaptada, con etiquetas
// ═══════════════════════════════════════════════════
const ShapeRenderer = ({ shape, params, unit, hideText, canvasDim, rulerMode }) => {
    const cx = canvasDim.w / 2;
    const cy = canvasDim.h / 2;

    let activeScale = SCALE;
    if (!rulerMode) {
        // Bounding box real por figura para que siempre se ajuste al canvas
        const paddingW = 80, paddingH = 70;
        const maxW = canvasDim.w - paddingW;
        const maxH = canvasDim.h - paddingH;
        let shapeW = 1, shapeH = 1;
        switch (shape) {
            case 'CUADRADO':   shapeW = params.l;        shapeH = params.l;        break;
            case 'RECTANGULO': shapeW = params.b;        shapeH = params.h;        break;
            case 'TRIANGULO':  shapeW = params.b;        shapeH = params.h;        break;
            case 'CIRCULO':    shapeW = params.r * 2;    shapeH = params.r * 2;    break;
            case 'ROMBO':
                shapeW = params.D || params.l * 2;
                shapeH = params.d || params.l * 2;
                break;
            case 'TRAPECIO':
                shapeW = params.B;
                shapeH = params.h || params.l_obl * 0.8;
                break;
            case 'CUBO':     shapeW = params.a * 1.5;  shapeH = params.a * 1.5;  break;
            case 'PRISMA':   shapeW = params.lb * 1.5; shapeH = params.h * 1.2;  break;
            case 'CILINDRO': shapeW = params.r * 2;    shapeH = params.h * 1.2;  break;
            case 'CONO':     shapeW = params.r * 2;    shapeH = params.h * 1.1;  break;
            default:         shapeW = shapeH = 10;
        }
        const scaleX = maxW / shapeW;
        const scaleY = maxH / shapeH;
        // El mínimo asegura que cabe; el tope de 120 evita figuras gigantes
        activeScale = Math.min(scaleX, scaleY, 120);
    }

    const svgProps = rulerMode
        ? { width: canvasDim.w, height: canvasDim.h, viewBox: `0 0 ${canvasDim.w} ${canvasDim.h}`, fill: 'none', style: { display: 'block' } }
        : { width: '100%', height: '100%', viewBox: `0 0 ${canvasDim.w} ${canvasDim.h}`, fill: 'none', style: { display: 'block' } };

    const tProps = { fill: '#e74c3c', fontSize: '16', fontWeight: 'bold', fontFamily: 'Arial', textAnchor: 'middle' };
    const s2D = { fill: '#e3f2fd', stroke: '#2c3e50', strokeWidth: '3' };
    const s3D = { fill: 'rgba(155,89,182,0.2)', stroke: '#9b59b6', strokeWidth: '3' };

    const T = (cfg, lbl) => !hideText && (
        <text x={cfg.x} y={cfg.y} {...tProps} transform={cfg.rot ? `rotate(${cfg.rot} ${cfg.x},${cfg.y})` : ''}>{lbl} {unit}</text>
    );

    switch (shape) {
        case 'CUADRADO': {
            const w = params.l * activeScale;
            return <svg {...svgProps}>
                <rect x={cx - w / 2} y={cy - w / 2} width={w} height={w} {...s2D} />
                {T({ x: cx, y: cy + w / 2 + 20 }, params.l)}
                {T({ x: cx - w / 2 - 15, y: cy, rot: -90 }, params.l)}
            </svg>;
        }
        case 'RECTANGULO': {
            const w = params.b * activeScale, h = params.h * activeScale;
            return <svg {...svgProps}>
                <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} {...s2D} fill="#e8f8f5" />
                {T({ x: cx, y: cy + h / 2 + 20 }, params.b)}
                {T({ x: cx - w / 2 - 15, y: cy, rot: -90 }, params.h)}
            </svg>;
        }
        case 'TRIANGULO': {
            const w = params.b * activeScale, h = params.h * activeScale;
            const pts = `${cx - w / 2},${cy + h / 2} ${cx + w / 2},${cy + h / 2} ${cx},${cy - h / 2}`;
            return <svg {...svgProps}>
                <polygon points={pts} {...s2D} fill="#fcf3cf" />
                {T({ x: cx, y: cy + h / 2 + 20 }, params.b)}
                <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy + h / 2} stroke="#f1c40f" strokeDasharray="6,6" strokeWidth="2" />
                {T({ x: cx + 20, y: cy }, params.h)}
            </svg>;
        }
        case 'CIRCULO': {
            const r = params.r * activeScale;
            return <svg {...svgProps}>
                <circle cx={cx} cy={cy} r={r} {...s2D} fill="#fadbd8" />
                <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#e74c3c" strokeDasharray="6,6" strokeWidth="2" />
                {T({ x: cx + r / 2, y: cy - 10 }, params.r)}
            </svg>;
        }
        case 'ROMBO': {
            if (params.D) {
                const W = params.D * activeScale, H = params.d * activeScale;
                const pts = `${cx},${cy - H / 2} ${cx + W / 2},${cy} ${cx},${cy + H / 2} ${cx - W / 2},${cy}`;
                return <svg {...svgProps}>
                    <polygon points={pts} {...s2D} fill="#fce4ec" />
                    <line x1={cx - W / 2} y1={cy} x2={cx + W / 2} y2={cy} stroke="#e84393" strokeDasharray="6,6" strokeWidth="2" />
                    <line x1={cx} y1={cy - H / 2} x2={cx} y2={cy + H / 2} stroke="#e84393" strokeDasharray="6,6" strokeWidth="2" />
                    {T({ x: cx + W / 4, y: cy - 10 }, params.D)}
                    {T({ x: cx + 10, y: cy + H / 4 }, params.d)}
                </svg>;
            } else {
                const L = params.l * activeScale;
                const pts = `${cx},${cy - L} ${cx + L},${cy} ${cx},${cy + L} ${cx - L},${cy}`;
                return <svg {...svgProps}>
                    <polygon points={pts} {...s2D} fill="#fce4ec" />
                    {T({ x: cx + L / 2 + 15, y: cy - L / 2 - 15 }, params.l)}
                </svg>;
            }
        }
        case 'TRAPECIO': {
            const B = params.B * activeScale, b = params.b * activeScale;
            const h = params.h
                ? params.h * activeScale
                : (Math.sqrt(Math.pow(params.l_obl, 2) - Math.pow((params.B - params.b) / 2, 2)) || 5) * activeScale;
            const pts = `${cx - b / 2},${cy - h / 2} ${cx + b / 2},${cy - h / 2} ${cx + B / 2},${cy + h / 2} ${cx - B / 2},${cy + h / 2}`;
            return <svg {...svgProps}>
                <polygon points={pts} {...s2D} fill="#e0f2f1" />
                {T({ x: cx, y: cy - h / 2 - 10 }, params.b)}
                {T({ x: cx, y: cy + h / 2 + 20 }, params.B)}
                {params.h
                    ? <><line x1={cx - b / 2} y1={cy - h / 2} x2={cx - b / 2} y2={cy + h / 2} stroke="#00cec9" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx - b / 2 + 20, y: cy }, params.h)}</>
                    : T({ x: cx - B / 2 + 15, y: cy, rot: -60 }, params.l_obl)
                }
            </svg>;
        }
        case 'CUBO': {
            const a = params.a * activeScale, off = a * 0.4;
            return <svg {...svgProps}>
                <rect x={cx - a / 2 + off} y={cy - a / 2 - off} width={a} height={a} fill="none" stroke="#9b59b6" strokeWidth="3" />
                <line x1={cx - a / 2} y1={cy - a / 2} x2={cx - a / 2 + off} y2={cy - a / 2 - off} stroke="#9b59b6" strokeWidth="3" />
                <line x1={cx + a / 2} y1={cy - a / 2} x2={cx + a / 2 + off} y2={cy - a / 2 - off} stroke="#9b59b6" strokeWidth="3" />
                <line x1={cx - a / 2} y1={cy + a / 2} x2={cx - a / 2 + off} y2={cy + a / 2 - off} stroke="#9b59b6" strokeWidth="3" />
                <line x1={cx + a / 2} y1={cy + a / 2} x2={cx + a / 2 + off} y2={cy + a / 2 - off} stroke="#9b59b6" strokeWidth="3" />
                <rect x={cx - a / 2} y={cy - a / 2} width={a} height={a} {...s3D} />
                {T({ x: cx, y: cy + a / 2 + 20 }, params.a)}
            </svg>;
        }
        case 'PRISMA': {
            const w = params.lb * activeScale, h = params.h * activeScale, off = w * 0.4;
            return <svg {...svgProps}>
                <rect x={cx - w / 2 + off} y={cy - h / 2 - off} width={w} height={h} fill="none" stroke="#6c5ce7" strokeWidth="3" />
                <line x1={cx - w / 2} y1={cy - h / 2} x2={cx - w / 2 + off} y2={cy - h / 2 - off} stroke="#6c5ce7" strokeWidth="3" />
                <line x1={cx + w / 2} y1={cy - h / 2} x2={cx + w / 2 + off} y2={cy - h / 2 - off} stroke="#6c5ce7" strokeWidth="3" />
                <line x1={cx - w / 2} y1={cy + h / 2} x2={cx - w / 2 + off} y2={cy + h / 2 - off} stroke="#6c5ce7" strokeWidth="3" />
                <line x1={cx + w / 2} y1={cy + h / 2} x2={cx + w / 2 + off} y2={cy + h / 2 - off} stroke="#6c5ce7" strokeWidth="3" />
                <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="rgba(108,92,231,0.2)" stroke="#6c5ce7" strokeWidth="3" />
                {T({ x: cx, y: cy + h / 2 + 20 }, params.lb)}
                {T({ x: cx - w / 2 - 15, y: cy, rot: -90 }, params.h)}
            </svg>;
        }
        case 'CILINDRO': {
            const r = params.r * activeScale, h = params.h * activeScale, ry = r * 0.3;
            return <svg {...svgProps}>
                <ellipse cx={cx} cy={cy - h / 2} rx={r} ry={ry} fill="#fbeee6" stroke="#e67e22" strokeWidth="3" />
                <line x1={cx - r} y1={cy - h / 2} x2={cx - r} y2={cy + h / 2} stroke="#e67e22" strokeWidth="3" />
                <line x1={cx + r} y1={cy - h / 2} x2={cx + r} y2={cy + h / 2} stroke="#e67e22" strokeWidth="3" />
                <path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 0 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#e67e22" strokeWidth="3" />
                <path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 1 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#e67e22" strokeWidth="3" strokeDasharray="6,6" />
                <line x1={cx - r} y1={cy - h / 2} x2={cx + r} y2={cy - h / 2} stroke="#e67e22" strokeDasharray="6,6" strokeWidth="2" />
                {T({ x: cx + 15, y: cy - h / 2 - ry - 5 }, params.r)}
                {T({ x: cx - r - 20, y: cy, rot: -90 }, params.h)}
            </svg>;
        }
        case 'CONO': {
            const r = params.r * activeScale, h = params.h * activeScale, ry = r * 0.3;
            return <svg {...svgProps}>
                <line x1={cx - r} y1={cy + h / 2} x2={cx} y2={cy - h / 2} stroke="#d63031" strokeWidth="3" />
                <line x1={cx + r} y1={cy + h / 2} x2={cx} y2={cy - h / 2} stroke="#d63031" strokeWidth="3" />
                <path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 0 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#d63031" strokeWidth="3" />
                <path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 1 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#d63031" strokeWidth="3" strokeDasharray="6,6" />
                <line x1={cx - r} y1={cy + h / 2} x2={cx + r} y2={cy + h / 2} stroke="#d63031" strokeDasharray="6,6" strokeWidth="2" />
                <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy + h / 2} stroke="#d63031" strokeDasharray="6,6" strokeWidth="2" />
                {T({ x: cx + r / 2, y: cy + h / 2 + 20 }, params.r)}
                {T({ x: cx + 15, y: cy }, params.h)}
            </svg>;
        }
        default: return null;
    }
};

const styles = {
    container: { minHeight: '100vh', background: '#e0f7fa', padding: 15, fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    scoreBoard: { display: 'flex', gap: 12, background: 'white', padding: '8px 16px', borderRadius: 30, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: 700, margin: '10px auto', padding: 20, borderRadius: 20, textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box', width: '100%' },
    btnPrimary: { color: 'white', border: 'none', padding: '13px 24px', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.18)', width: '100%', justifyContent: 'center', maxWidth: 320, boxSizing: 'border-box' },
    inputNum: { padding: 11, fontSize: '1.1rem', borderRadius: 8, border: '2px solid #bdc3c7', textAlign: 'center', outline: 'none' },
    inputSelect: { padding: 11, fontSize: '0.95rem', borderRadius: 8, border: '2px solid #bdc3c7', outline: 'none', background: 'white', cursor: 'pointer' },
    btnSuccess: { color: 'white', border: 'none', padding: '11px 20px', borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.25)' },
    formulaBox: { background: '#f0f4ff', border: '2px dashed #3498db', borderRadius: 12, padding: '14px 18px', margin: '14px 0', textAlign: 'left' },
    formulaLabel: { fontSize: '0.82rem', color: '#3498db', fontWeight: 'bold', marginBottom: 6 },
    formulaText: { fontSize: '1rem', color: '#2c3e50', fontFamily: "'Courier New', monospace", fontWeight: 'bold', wordBreak: 'break-word' },
};
