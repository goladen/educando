import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, CheckCircle, XCircle, Trophy, Clock, Brain, Delete } from 'lucide-react';
import Confetti from 'react-confetti';

export default function CalculoMentalGame({ usuario, onExit }) {
    const [gameState, setGameState] = useState('START'); // START, PLAYING, END
    const [difficulty, setDifficulty] = useState('EASY'); // EASY, MEDIUM, HARD
    const [timeLeft, setTimeLeft] = useState(120); // 2 minutos por defecto
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);

    const [currentProblem, setCurrentProblem] = useState(null);
    const [currentAnswer, setCurrentAnswer] = useState(0); // El número que forma el alumno
    const [feedback, setFeedback] = useState(null); // Para animaciones de acierto/fallo

    const timerRef = useRef(null);

    // --- MOTOR GENERADOR DE PROBLEMAS ---
    const generarProblema = (diff) => {
        const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const rItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

        let text = '';
        let answer = 0;
        let hasDecimals = false;

        if (diff === 'EASY') {
            // Sencillo: Sumas y restas de números 1 al 50. Positivos.
            const op = rItem(['+', '-']);
            let a = rInt(1, 50);
            let b = rInt(1, 50);

            if (op === '-') {
                if (b > a) [a, b] = [b, a]; // Evitar negativos en fácil
                answer = a - b;
            } else {
                answer = a + b;
            }
            text = `${a} ${op} ${b}`;

        } else if (diff === 'MEDIUM') {
            // Medio: Sumas/Restas (-50 a 100), Multiplicaciones (1-12), Divisiones exactas.
            const op = rItem(['+', '-', '*', '/']);
            if (op === '+') {
                const a = rInt(-20, 100); const b = rInt(1, 50);
                answer = a + b; text = `${a} + ${b}`;
            } else if (op === '-') {
                const a = rInt(1, 100); const b = rInt(1, 100);
                answer = a - b; text = `${a} - ${b}`;
            } else if (op === '*') {
                const a = rInt(2, 12); const b = rInt(2, 12);
                answer = a * b; text = `${a} × ${b}`;
            } else if (op === '/') {
                const b = rInt(2, 10); answer = rInt(2, 15); // Calculamos resultado primero
                const a = b * answer; // a es múltiplo exacto
                text = `${a} ÷ ${b}`;
            }

        } else if (diff === 'HARD') {
            // Difícil: Decimales, Fracciones simples, Multiplicaciones mayores o negativas.
            const tipo = rInt(1, 4);
            if (tipo === 1) { // Suma/Resta con Decimales
                const a = rInt(10, 99) / 10; // ej: 4.5
                const b = rInt(1, 50) / 10;  // ej: 2.1
                const op = rItem(['+', '-']);
                answer = op === '+' ? a + b : a - b;
                answer = parseFloat(answer.toFixed(2));
                text = `${a.toFixed(1)} ${op} ${b.toFixed(1)}`;
                hasDecimals = true;
            } else if (tipo === 2) { // Fracciones
                const denoms = [2, 3, 4, 5, 10];
                const b = rItem(denoms); // Denominador
                const a = rInt(1, b - 1); // Numerador
                answer = rInt(2, 12); // Resultado exacto
                const total = answer * b; // El número al que le aplicamos la fracción
                // El resultado final real es: a * (total / b)
                answer = a * (total / b);
                text = `${a}/${b} de ${total}`;
            } else if (tipo === 3) { // Multiplicación difícil o negativa
                const a = rInt(-15, 15); const b = rInt(5, 20);
                answer = a * b;
                text = `${a} × ${b}`;
            } else { // Suma con centésimas
                const a = rInt(100, 500) / 100; // 1.25
                const b = rInt(10, 99) / 100;   // 0.45
                answer = parseFloat((a + b).toFixed(2));
                text = `${a.toFixed(2)} + ${b.toFixed(2)}`;
                hasDecimals = true;
            }
        }

        setCurrentProblem({ text, answer, hasDecimals });
        setCurrentAnswer(0);
    };

    // --- CONTROL DEL TIEMPO ---
    useEffect(() => {
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft <= 0 && gameState === 'PLAYING') {
            setGameState('END');
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft]);

    const startGame = (diff) => {
        setDifficulty(diff);
        setScore(0);
        setAciertos(0);
        setTimeLeft(120); // 2 Minutos
        generarProblema(diff);
        setGameState('PLAYING');
    };

    // --- MANEJO DE BOTONES DE CÁLCULO ---
    const handleAdd = (val) => {
        setCurrentAnswer(prev => parseFloat((prev + val).toFixed(2))); // toFixed evita fallos de coma flotante en JS
    };

    const resetAnswer = () => setCurrentAnswer(0);

    const checkAnswer = () => {
        if (!currentProblem) return;

        if (currentAnswer === currentProblem.answer) {
            // ACIERTO
            const puntos = difficulty === 'EASY' ? 10 : difficulty === 'MEDIUM' ? 15 : 25;
            setScore(s => s + puntos);
            setAciertos(a => a + 1);
            setFeedback('CORRECT');
            setTimeout(() => {
                setFeedback(null);
                generarProblema(difficulty);
            }, 500);
        } else {
            // FALLO
            setScore(s => Math.max(0, s - 5)); // Penalización ligera
            setFeedback('INCORRECT');
            setTimeout(() => setFeedback(null), 500);
        }
    };

    const handleExit = () => {
        if (gameState !== 'START') setGameState('START');
        else if (typeof onExit === 'function') onExit();
        else window.location.href = '/';
    };

    // --- RENDERIZADO ---
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

            {/* PANTALLA DE INICIO */}
            {gameState === 'START' && (
                <div style={styles.centerCard}>
                    <Brain size={60} color="#E91E63" style={{ marginBottom: 15 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: '2.5rem', margin: '10px 0' }}>Cálculo Mental</h1>
                    <p style={{ color: '#666', marginBottom: '30px', fontSize: '1.1rem' }}>
                        Resuelve tantas operaciones como puedas en 2 minutos. ¡Usa los botones para formar tu respuesta!
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                        <button onClick={() => startGame('EASY')} style={{ ...styles.btnPrimary, background: '#2ecc71' }}>
                            👶 Nivel Sencillo (Sumas y Restas)
                        </button>
                        <button onClick={() => startGame('MEDIUM')} style={{ ...styles.btnPrimary, background: '#f39c12' }}>
                            🤓 Nivel Medio (Incluye × y ÷)
                        </button>
                        <button onClick={() => startGame('HARD')} style={{ ...styles.btnPrimary, background: '#e74c3c' }}>
                            🔥 Nivel Difícil (Decimales y Fracciones)
                        </button>
                    </div>
                </div>
            )}

            {/* PANTALLA DE JUEGO */}
            {gameState === 'PLAYING' && currentProblem && (
                <div style={{ ...styles.centerCard, transition: '0.2s', transform: feedback === 'CORRECT' ? 'scale(1.05)' : feedback === 'INCORRECT' ? 'translateX(10px)' : 'none', border: feedback === 'CORRECT' ? '4px solid #2ecc71' : feedback === 'INCORRECT' ? '4px solid #e74c3c' : '4px solid transparent' }}>

                    {/* LA OPERACIÓN */}
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '20px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {currentProblem.text}
                    </div>

                    {/* LA RESPUESTA DEL ALUMNO */}
                    <div style={{ background: '#f8f9fa', borderRadius: '15px', padding: '15px', marginBottom: '20px', border: '2px solid #bdc3c7', position: 'relative' }}>
                        <span style={{ fontSize: '1.2rem', color: '#7f8c8d', position: 'absolute', top: '10px', left: '15px' }}>Tu respuesta:</span>
                        <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#E91E63', textAlign: 'center', marginTop: '15px' }}>
                            {currentAnswer}
                        </div>
                        <button onClick={resetAnswer} style={{ position: 'absolute', top: '10px', right: '15px', background: 'transparent', border: 'none', color: '#95a5a6', cursor: 'pointer' }}>
                            <Delete size={24} />
                        </button>
                    </div>

                    {/* BOTONERA DE CÁLCULO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>

                        {/* FILA SUMAS (Azul) */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <CalcBtn val={10} color="#3498db" onClick={() => handleAdd(10)} />
                            <CalcBtn val={1} color="#3498db" onClick={() => handleAdd(1)} />
                            {currentProblem.hasDecimals && (
                                <>
                                    <CalcBtn val={0.1} color="#2980b9" onClick={() => handleAdd(0.1)} />
                                    <CalcBtn val={0.01} color="#2980b9" onClick={() => handleAdd(0.01)} />
                                </>
                            )}
                        </div>

                        {/* FILA RESTAS (Rojo) */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <CalcBtn val={-10} color="#e74c3c" onClick={() => handleAdd(-10)} />
                            <CalcBtn val={-1} color="#e74c3c" onClick={() => handleAdd(-1)} />
                            {currentProblem.hasDecimals && (
                                <>
                                    <CalcBtn val={-0.1} color="#c0392b" onClick={() => handleAdd(-0.1)} />
                                    <CalcBtn val={-0.01} color="#c0392b" onClick={() => handleAdd(-0.01)} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* BOTÓN COMPROBAR */}
                    <button onClick={checkAnswer} style={{ ...styles.btnSuccess, width: '100%', padding: '20px', fontSize: '1.5rem' }}>
                        COMPROBAR <CheckCircle style={{ marginLeft: 10 }} />
                    </button>
                </div>
            )}

            {/* PANTALLA FINAL */}
            {gameState === 'END' && (
                <div style={styles.centerCard}>
                    {score >= 100 && <Confetti recycle={false} />}
                    <Clock size={80} color="#f1c40f" style={{ marginBottom: '20px' }} />
                    <h1 style={{ color: '#2c3e50' }}>¡Tiempo Agotado!</h1>
                    <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#E91E63' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: '10px', fontSize: '1.2rem' }}>Puntos Totales</p>
                    <p style={{ color: '#27ae60', marginBottom: '30px', fontSize: '1.2rem', fontWeight: 'bold' }}>✅ {aciertos} aciertos</p>

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button onClick={() => startGame(difficulty)} style={styles.btnPrimary}><RotateCcw size={18} /> Repetir Nivel</button>
                        <button onClick={() => setGameState('START')} style={styles.btnVolver}>Cambiar Nivel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Componente auxiliar para los botones matemáticos
const CalcBtn = ({ val, color, onClick }) => {
    const isPositive = val > 0;
    const label = isPositive ? `+${val}` : `${val}`;
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1, padding: '15px 5px', fontSize: '1.2rem', fontWeight: 'bold',
                color: 'white', background: color, border: 'none', borderRadius: '10px',
                cursor: 'pointer', boxShadow: `0 4px 0 color-mix(in srgb, ${color}, black 20%)`,
                transition: 'transform 0.1s, box-shadow 0.1s'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = 'none'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 0 color-mix(in srgb, ${color}, black 20%)`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 0 color-mix(in srgb, ${color}, black 20%)`; }}
            // Soporte táctil móvil
            onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = 'none'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 0 color-mix(in srgb, ${color}, black 20%)`; }}
        >
            {label}
        </button>
    );
}

const styles = {
    container: { minHeight: '100vh', background: '#fce4ec', padding: '20px', fontFamily: "'Segoe UI', Tahoma, sans-serif" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    btnVolver: { padding: '10px 20px', background: 'white', border: '1px solid #ccc', borderRadius: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#333' },
    scoreBoard: { display: 'flex', gap: '8px', background: 'white', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: '500px', margin: '0 auto', padding: '30px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' },
    btnPrimary: { color: 'white', border: 'none', padding: '15px 20px', borderRadius: '30px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', width: '100%' },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 0 #219653', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s' }
};