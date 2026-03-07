import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, CheckCircle, XCircle, Trophy, Clock, Target, Delete, Calculator } from 'lucide-react';
import Confetti from 'react-confetti';

// --- MODOS DE JUEGO ---
const MODOS = [
    { id: 'BASIC', name: 'Básico', desc: 'x+a=b, x-a=b, ax=b, x/a=b', color: '#2ecc71', icon: '👶' },
    { id: 'SIMPLE', name: 'Sencillo', desc: 'ax+b = cx+d (Sin paréntesis)', color: '#3498db', icon: '📝' },
    { id: 'MEDIUM', name: 'Medio', desc: 'Con paréntesis o un denominador', color: '#f39c12', icon: '🤓' },
    { id: 'EXPERT', name: 'Experto', desc: 'Paréntesis y denominadores', color: '#e74c3c', icon: '🔥' },
    { id: 'QUADRATIC', name: '2º Grado', desc: 'Completas e incompletas', color: '#9b59b6', icon: '📈' },
    { id: 'TEXT', name: 'Enunciados', desc: 'Asocia texto a su ecuación', color: '#34495e', icon: '🗣️' }
];

// --- GENERADOR MATEMÁTICO (Algoritmo) ---
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rNonZero = (min, max) => { let v = 0; while (v === 0) v = rInt(min, max); return v; };

// Formateadores visuales algebraicos limpios (evitan "1x" o "+ -5")
const fmt1 = (coeff, variable = '') => {
    if (coeff === 0) return '';
    if (!variable) return `${coeff}`;
    if (coeff === 1) return variable;
    if (coeff === -1) return `-${variable}`;
    return `${coeff}${variable}`;
};
const fmt2 = (coeff, variable = '') => {
    if (coeff === 0) return '';
    const s = fmt1(Math.abs(coeff), variable);
    return coeff > 0 ? `+ ${s}` : `- ${s}`;
};
const buildSide = (cx, cn) => {
    if (cx === 0 && cn === 0) return "0";
    let s = "";
    if (cx !== 0) s += fmt1(cx, 'x');
    if (cn !== 0) { if (s !== "") s += ` ${fmt2(cn)}`; else s += `${cn}`; }
    return s;
};

export default function EcuacionesGame({ onExit }) {
    const [gameState, setGameState] = useState('START');
    const [modoActivo, setModoActivo] = useState(null);
    const [timeLeft, setTimeLeft] = useState(180); // 3 minutos
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);

    const [currentEq, setCurrentEq] = useState(null);

    // Inputs del usuario (Soporta 1 o 2 soluciones)
    const [ans1, setAns1] = useState('');
    const [ans2, setAns2] = useState('');
    const [feedback, setFeedback] = useState(null);

    const timerRef = useRef(null);

    const generarProblema = (modo) => {
        let ast = []; // Abstract Syntax Tree para renderizar fracciones
        let correctAnswers = [];
        let multipleChoice = null; // Para el modo texto

        const X = rInt(-10, 10); // Garantizamos que X SIEMPRE ES ENTERO

        if (modo === 'BASIC') {
            const type = rInt(1, 4);
            const a = rInt(2, 20);
            if (type === 1) { // x + a = b
                ast.push({ t: 'text', v: `x + ${a} = ${X + a}` });
            } else if (type === 2) { // x - a = b
                ast.push({ t: 'text', v: `x - ${a} = ${X - a}` });
            } else if (type === 3) { // ax = b
                ast.push({ t: 'text', v: `${a}x = ${a * X}` });
            } else { // x / a = b
                ast.push({ t: 'frac', n: 'x', d: a });
                ast.push({ t: 'text', v: ` = ${X}` });
                // Aquí la X es múltiplo de a, la forzamos:
                const realX = a * rInt(-5, 5);
                ast = [{ t: 'frac', n: 'x', d: a }, { t: 'text', v: ` = ${realX / a}` }];
                correctAnswers = [realX];
                return setCurrentEq({ ast, correctAnswers });
            }
            correctAnswers = [X];

        } else if (modo === 'SIMPLE') {
            // ax + b = cx + d
            const a = rNonZero(-6, 6);
            let c = rNonZero(-6, 6);
            while (c === a) c = rNonZero(-6, 6); // Evitar 0x
            const b = rInt(-15, 15);
            const d = a * X + b - c * X;

            ast.push({ t: 'text', v: `${buildSide(a, b)} = ${buildSide(c, d)}` });
            correctAnswers = [X];

        } else if (modo === 'MEDIUM') {
            if (Math.random() > 0.5) {
                // Paréntesis: a(x + b) = cx + d
                const a = rNonZero(-4, 5);
                let c = rNonZero(-5, 5);
                while (c === a) c = rNonZero(-5, 5);
                let b = rNonZero(-10, 10);
                const d = a * (X + b) - c * X;

                const factorStr = a === 1 ? '' : a === -1 ? '-' : a;
                ast.push({ t: 'text', v: `${factorStr}(x ${fmt2(b)}) = ${buildSide(c, d)}` });
            } else {
                // Denominador: (ax + b)/c = dx + e
                const c = rInt(2, 5);
                const a = rNonZero(-4, 4);
                // Forzamos que aX+b sea múltiplo de c
                const k = rInt(-4, 4);
                const b = c * k - a * X;

                const d = rInt(-3, 3);
                const e = k - d * X;

                ast.push({ t: 'frac', n: buildSide(a, b), d: c });
                ast.push({ t: 'text', v: ` = ${buildSide(d, e)}` });
            }
            correctAnswers = [X];

        } else if (modo === 'EXPERT') {
            // Paréntesis + Denominador: a(x+b)/c + dx = e
            const c = rInt(2, 5);
            // X+b debe ser múltiplo de c
            const m = rInt(-3, 3);
            const b = c * m - X;
            const a = rNonZero(-4, 4);
            const d = rNonZero(-3, 3);
            const e = a * m + d * X;

            const factorStr = a === 1 ? '' : a === -1 ? '-' : a;
            ast.push({ t: 'frac', n: `${factorStr}(x ${fmt2(b)})`, d: c });
            ast.push({ t: 'text', v: ` ${fmt2(d, 'x')} = ${e}` });
            correctAnswers = [X];

        } else if (modo === 'QUADRATIC') {
            const X1 = rInt(-7, 7);
            const X2 = rInt(-7, 7);
            const b = -(X1 + X2);
            const c = X1 * X2;

            let v = `x²`;
            if (b !== 0) v += ` ${fmt2(b, 'x')}`;
            if (c !== 0) v += ` ${fmt2(c, '')}`;
            if (b === 0 && c === 0) v = "x²"; // x^2 = 0
            v += " = 0";

            ast.push({ t: 'text', v });
            correctAnswers = [X1, X2]; // Dos soluciones

        } else if (modo === 'TEXT') {
            const enunciados = [
                { t: "El doble de un número más tres es quince", eq: "2x + 3 = 15", w: ["2(x + 3) = 15", "x/2 + 3 = 15", "3x + 2 = 15"] },
                { t: "La mitad de un número menos cuatro es seis", eq: "x/2 - 4 = 6", w: ["x - 4/2 = 6", "2x - 4 = 6", "x/2 = 6 - 4"] },
                { t: "La suma de un número y su consecutivo es trece", eq: "x + (x + 1) = 13", w: ["x + x + 2 = 13", "2x = 13", "x(x+1) = 13"] },
                { t: "El triple de la diferencia entre un número y dos es doce", eq: "3(x - 2) = 12", w: ["3x - 2 = 12", "x/3 - 2 = 12", "3 - 2x = 12"] },
                { t: "El cuadrado de un número es cuarenta y nueve", eq: "x² = 49", w: ["2x = 49", "x/2 = 49", "x = 49²"] },
                { t: "Un número más su mitad es quince", eq: "x + x/2 = 15", w: ["x/2 = 15", "2x + x = 15", "x + 2 = 15"] },
                { t: "El cuádruple de un número es igual a ese número más doce", eq: "4x = x + 12", w: ["x/4 = x + 12", "4(x + 1) = 12", "4x + 12 = x"] }
            ];
            const sel = enunciados[Math.floor(Math.random() * enunciados.length)];

            ast.push({ t: 'enunciado', v: sel.t });
            multipleChoice = [sel.eq, ...sel.w].sort(() => Math.random() - 0.5);
            correctAnswers = [sel.eq];
        }

        setCurrentEq({ ast, correctAnswers, multipleChoice });
        setAns1('');
        setAns2('');
    };

    // --- TEMPORIZADOR ---
    useEffect(() => {
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (timeLeft <= 0 && gameState === 'PLAYING') {
            setGameState('END');
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft]);

    const startGame = (modo) => {
        setModoActivo(modo);
        setScore(0);
        setAciertos(0);
        setTimeLeft(180); // 3 mins para ecuaciones
        generarProblema(modo.id);
        setGameState('PLAYING');
    };

    const comprobarSolucion = (respuestaElegidaTexto = null) => {
        let isCorrect = false;

        if (modoActivo.id === 'TEXT') {
            isCorrect = respuestaElegidaTexto === currentEq.correctAnswers[0];
        } else {
            const v1 = parseInt(ans1);
            const v2 = parseInt(ans2);

            if (currentEq.correctAnswers.length === 1) {
                isCorrect = v1 === currentEq.correctAnswers[0];
            } else {
                // Segundo grado: Hay que acertar las dos raíces (sin importar el orden)
                const [r1, r2] = currentEq.correctAnswers;
                isCorrect = (v1 === r1 && v2 === r2) || (v1 === r2 && v2 === r1);
                // Si es raíz doble, basta con que rellene una bien o las dos iguales
                if (r1 === r2 && (v1 === r1 || v2 === r1)) isCorrect = true;
            }
        }

        if (isCorrect) {
            setScore(s => s + 20);
            setAciertos(a => a + 1);
            setFeedback('CORRECT');
            setTimeout(() => { setFeedback(null); generarProblema(modoActivo.id); }, 600);
        } else {
            setScore(s => Math.max(0, s - 5));
            setFeedback('INCORRECT');
            setTimeout(() => setFeedback(null), 600);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && modoActivo.id !== 'TEXT') comprobarSolucion();
    };

    const handleExit = () => {
        if (gameState !== 'START') setGameState('START');
        else if (typeof onExit === 'function') onExit();
        else window.location.href = '/';
    };

    // --- COMPONENTES VISUALES ---
    // Renderizador de Fracciones Matemáticas CSS
    const Fraction = ({ num, den }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 8px', fontSize: '1.3rem', color: '#2c3e50', fontWeight: 'bold' }}>
            <span style={{ borderBottom: '3px solid #2c3e50', padding: '0 5px', width: '100%', textAlign: 'center' }}>{num}</span>
            <span style={{ padding: '0 5px' }}>{den}</span>
        </span>
    );

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button onClick={handleExit} style={styles.btnVolver}><RotateCcw size={16} /> Salir</button>
                {gameState === 'PLAYING' && (
                    <>
                        <div style={{ ...styles.scoreBoard, color: timeLeft <= 10 ? '#e74c3c' : '#333' }}>
                            <Clock size={18} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                        <div style={{ ...styles.scoreBoard, color: '#f1c40f' }}>
                            <Trophy size={18} /> {score} pts
                        </div>
                    </>
                )}
            </div>

            {/* MENÚ INICIAL */}
            {gameState === 'START' && (
                <div style={styles.centerCard}>
                    <Calculator size={60} color="#3498db" style={{ marginBottom: 15 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: '2.5rem', margin: '10px 0' }}>Maestro de Ecuaciones</h1>
                    <p style={{ color: '#666', marginBottom: '30px', fontSize: '1.1rem' }}>Despeja la X antes de que se acabe el tiempo. ¡Todas las soluciones son números enteros!</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                        {MODOS.map(m => (
                            <button key={m.id} onClick={() => startGame(m)} style={{ ...styles.btnMode, border: `2px solid ${m.color}` }}>
                                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{m.icon}</div>
                                <h3 style={{ margin: '0 0 5px 0', color: m.color }}>{m.name}</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{m.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ZONA DE JUEGO */}
            {gameState === 'PLAYING' && currentEq && (
                <div style={{ ...styles.centerCard, transition: '0.2s', transform: feedback === 'CORRECT' ? 'scale(1.05)' : feedback === 'INCORRECT' ? 'translateX(10px)' : 'none', border: feedback === 'CORRECT' ? '4px solid #2ecc71' : feedback === 'INCORRECT' ? '4px solid #e74c3c' : '4px solid transparent' }}>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                        <span style={{ background: modoActivo.color, color: 'white', padding: '5px 15px', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.9rem' }}>{modoActivo.name}</span>
                    </div>

                    {/* RENDERIZADOR DE LA ECUACIÓN */}
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '40px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {currentEq.ast.map((el, i) => {
                            if (el.t === 'text') return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{el.v}</span>;
                            if (el.t === 'frac') return <Fraction key={i} num={el.n} den={el.d} />;
                            if (el.t === 'enunciado') return <div key={i} style={{ fontSize: '1.5rem', lineHeight: '1.4', padding: '20px', background: '#f8f9fa', borderRadius: '15px', borderLeft: '5px solid #34495e' }}>{el.v}</div>;
                            return null;
                        })}
                    </div>

                    {/* INPUTS SEGÚN MODO */}
                    {modoActivo.id === 'TEXT' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {currentEq.multipleChoice.map((opt, i) => (
                                <button key={i} onClick={() => comprobarSolucion(opt)} style={styles.btnOptionText}>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498db' }}>
                                            {modoActivo.id === 'QUADRATIC' ? 'X₁ =' : 'X ='}
                                        </span>
                                        <input type="number" value={ans1} onChange={e => setAns1(e.target.value)} onKeyDown={handleKeyPress} style={styles.inputMath} autoFocus />
                                    </div>

                                    {modoActivo.id === 'QUADRATIC' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#9b59b6' }}>X₂ =</span>
                                            <input type="number" value={ans2} onChange={e => setAns2(e.target.value)} onKeyDown={handleKeyPress} style={styles.inputMath} />
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => comprobarSolucion()} style={styles.btnSuccess}>
                                    COMPROBAR <CheckCircle style={{ marginLeft: 10 }} />
                                </button>
                            </div>
                        )}
                </div>
            )}

            {/* PANTALLA FINAL */}
            {gameState === 'END' && (
                <div style={styles.centerCard}>
                    {score >= 100 && <Confetti recycle={false} />}
                    <Clock size={80} color="#f1c40f" style={{ marginBottom: '20px' }} />
                    <h1 style={{ color: '#2c3e50' }}>¡Tiempo Agotado!</h1>
                    <div style={{ fontSize: '4rem', fontWeight: 'bold', color: modoActivo.color }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: '10px', fontSize: '1.2rem' }}>Puntos Totales en {modoActivo.name}</p>
                    <p style={{ color: '#27ae60', marginBottom: '30px', fontSize: '1.2rem', fontWeight: 'bold' }}>✅ {aciertos} ecuaciones resueltas</p>

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button onClick={() => startGame(modoActivo)} style={{ ...styles.btnPrimary, background: modoActivo.color }}><RotateCcw size={18} /> Repetir Nivel</button>
                        <button onClick={() => setGameState('START')} style={styles.btnVolver}>Cambiar Nivel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', background: '#E8EAF6', padding: '20px', fontFamily: "'Segoe UI', Tahoma, sans-serif" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    btnVolver: { padding: '10px 20px', background: 'white', border: '1px solid #ccc', borderRadius: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#333' },
    scoreBoard: { display: 'flex', gap: '8px', background: 'white', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: '700px', margin: '0 auto', padding: '40px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' },
    btnMode: { background: 'white', padding: '20px', borderRadius: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' },
    btnPrimary: { color: 'white', border: 'none', padding: '15px 25px', borderRadius: '30px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: '15px', padding: '15px 30px', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s', width: '100%', maxWidth: '300px' },
    inputMath: { width: '80px', height: '60px', fontSize: '2rem', textAlign: 'center', borderRadius: '10px', border: '3px solid #bdc3c7', outline: 'none', background: '#f8f9fa', color: '#2c3e50', fontWeight: 'bold' },
    btnOptionText: { padding: '15px 20px', fontSize: '1.2rem', fontWeight: 'bold', background: '#f8f9fa', color: '#34495e', border: '2px solid #bdc3c7', borderRadius: '15px', cursor: 'pointer', transition: 'all 0.2s' }
};