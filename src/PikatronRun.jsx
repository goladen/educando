import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Play, Trophy } from 'lucide-react';
// IMPORTA AQUÍ TU IMAGEN SIN FONDO
import pikatronImg from './assets/pikatron-sprite.png';

export default function PikatronRun({ recurso, onExit }) {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState('START'); // START, PLAYING, GAMEOVER, WIN
    const [score, setScore] = useState(0);
    const [preguntaActual, setPreguntaActual] = useState(null);

    // Referencias mutables para el bucle del juego (evitan re-renders lentos)
    const gameRef = useRef({
        pikatron: {
            x: 50,
            y: 0,
            vy: 0,
            width: 100,
            height: 100,
            frameX: 0,
            frameY: 0,
            speed: 0,
            jumping: false,
            groundY: 0
        },
        obstacles: [],
        frame: 0,
        speed: 6,
        qIndex: 0,
        spawnTimer: 0,
        answerPool: [], // <--- CORRECCIÓN 1: Inicializado vacío para evitar crash
        allQuestions: [] // <--- CORRECCIÓN 2: Almacén de preguntas unificadas
    });

    // 1. CARGAR Y NORMALIZAR PREGUNTAS
    useEffect(() => {
        if (!recurso) return;

        // Lógica para extraer preguntas de cualquier estructura (Plana o por Hojas)
        let questions = [];
        if (recurso.preguntas && recurso.preguntas.length > 0) {
            questions = [...recurso.preguntas];
        } else if (recurso.hojas) {
            recurso.hojas.forEach(h => {
                if (h.preguntas) questions.push(...h.preguntas);
            });
        }

        // Guardamos en la referencia y preparamos la primera
        gameRef.current.allQuestions = questions;

        if (questions.length > 0) {
            prepararSiguientePregunta(0);
        } else {
            console.warn("Este recurso no tiene preguntas válidas para Pikatron.");
        }
    }, [recurso]);

    const prepararSiguientePregunta = (index) => {
        const questions = gameRef.current.allQuestions; // Usamos la lista normalizada

        // Si no hay más preguntas, ganamos
        if (!questions[index]) {
            setGameState('WIN');
            return;
        }

        const p = questions[index];
        // Preparamos respuestas mezcladas
        const correcta = p.respuesta || p.correcta || p.a;
        const incorrectas = p.incorrectas || [];

        // Creamos un pool de respuestas próximas a salir
        gameRef.current.answerPool = [
            { text: correcta, isCorrect: true },
            ...incorrectas.map(txt => ({ text: txt, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        gameRef.current.qIndex = index;
        setPreguntaActual(p.pregunta || p.q);
    };

    // 2. BUCLE PRINCIPAL DEL JUEGO
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Cargar Sprite
        const sprite = new Image();
        sprite.src = pikatronImg;

        // Configuración inicial
        canvas.width = 800;
        canvas.height = 400;
        const groundLevel = canvas.height - 50;
        gameRef.current.pikatron.groundY = groundLevel - gameRef.current.pikatron.height;
        gameRef.current.pikatron.y = gameRef.current.pikatron.groundY;

        const loop = () => {
            if (gameState !== 'PLAYING') return;

            // Limpiar Canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- 1. DIBUJAR FONDO Y SUELO ---
            ctx.fillStyle = '#f7f1e3'; // Cielo
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#2c3e50'; // Suelo
            ctx.fillRect(0, groundLevel, canvas.width, 50);

            // --- 2. LÓGICA PIKATRON (FÍSICAS) ---
            const pika = gameRef.current.pikatron;

            // Gravedad
            if (pika.y < pika.groundY || pika.vy < 0) {
                pika.y += pika.vy;
                pika.vy += 0.4; // Gravedad
            } else {
                pika.y = pika.groundY;
                pika.vy = 0;
                pika.jumping = false;
            }

            // Animación Sprite (2x2 Grid)
            if (gameRef.current.frame % 10 === 0) {
                if (pika.jumping) {
                    pika.frameX = 1; // Salto
                    pika.frameY = 0;
                } else {
                    // Correr
                    const runFrames = [[0, 0], [0, 1], [1, 1]];
                    const step = (gameRef.current.frame / 10) % 3;
                    pika.frameX = runFrames[step][0];
                    pika.frameY = runFrames[step][1];
                }
            }

            // Dibujar Sprite
            const sW = sprite.width / 2;
            const sH = sprite.height / 2;

            ctx.drawImage(
                sprite,
                pika.frameX * sW, pika.frameY * sH,
                sW, sH,
                pika.x, pika.y,
                pika.width, pika.height
            );

            // --- 3. OBSTÁCULOS (RESPUESTAS) ---
            gameRef.current.spawnTimer++;

            // Generar obstáculo: Verificamos que answerPool exista y tenga elementos
            const pool = gameRef.current.answerPool;
            if (gameRef.current.spawnTimer > 150 && pool && pool.length > 0) {
                const nextAns = pool.pop();
                gameRef.current.obstacles.push({
                    x: canvas.width,
                    y: groundLevel - 40,
                    width: 40, // Ancho lógico para colisiones
                    height: 40,
                    data: nextAns
                });
                gameRef.current.spawnTimer = 0;
            }

            // Mover y Dibujar Obstáculos
            gameRef.current.obstacles.forEach((obs, i) => {
                obs.x -= gameRef.current.speed;

                // Dibujar caja respuesta
                ctx.fillStyle = '#3498db';
                // Dibujamos un rectángulo más ancho para el texto
                ctx.fillRect(obs.x, obs.y, 120, 40);

                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.fillText(obs.data.text, obs.x + 10, obs.y + 25);

                // COLISIONES (Ajustado al tamaño visual del obstáculo)
                if (
                    pika.x < obs.x + 100 &&
                    pika.x + pika.width > obs.x &&
                    pika.y < obs.y + 40 &&
                    pika.y + pika.height > obs.y
                ) {
                    if (obs.data.isCorrect) {
                        // COGIÓ LA BUENA -> SIGUIENTE PREGUNTA
                        gameRef.current.obstacles = [];
                        gameRef.current.spawnTimer = 0;
                        setScore(s => s + 10);
                        prepararSiguientePregunta(gameRef.current.qIndex + 1);
                    } else {
                        // TROPEZÓ CON LA MALA -> MUERTE
                        setGameState('GAMEOVER');
                    }
                }
            });

            // Eliminar obstáculos que salieron
            gameRef.current.obstacles = gameRef.current.obstacles.filter(obs => obs.x > -150);

            gameRef.current.frame++;
            animationFrameId = requestAnimationFrame(loop);
        };

        if (gameState === 'PLAYING') {
            loop();
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState, recurso]);

    // CONTROLES
    useEffect(() => {
        const handleInput = () => {
            if (gameState === 'PLAYING' && !gameRef.current.pikatron.jumping) {
                gameRef.current.pikatron.vy = -10;
                gameRef.current.pikatron.jumping = true;
            }
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') handleInput();
        });
        window.addEventListener('touchstart', handleInput);

        return () => {
            window.removeEventListener('keydown', handleInput);
            window.removeEventListener('touchstart', handleInput);
        };
    }, [gameState]);

    const reiniciar = () => {
        gameRef.current.pikatron.y = 0;
        gameRef.current.obstacles = [];
        gameRef.current.qIndex = 0;
        prepararSiguientePregunta(0);
        setScore(0);
        setGameState('PLAYING');
    };

    return (
        <div style={{ width: '100%', height: '100vh', background: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            {/* HUD SUPERIOR */}
            <div style={{ position: 'absolute', top: 20, color: 'white', display: 'flex', gap: 20, fontSize: '1.5rem', fontWeight: 'bold', zIndex: 10 }}>
                <div>Puntos: {score}</div>
                {preguntaActual && <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 15px', borderRadius: 10 }}>{preguntaActual}</div>}
                <button onClick={onExit}><X color="white" /></button>
            </div>

            {/* CANVAS DEL JUEGO */}
            <canvas ref={canvasRef} style={{ background: 'white', borderRadius: 10, maxWidth: '100%', borderBottom: '5px solid #bdc3c7' }} />

            {/* PANTALLAS DE ESTADO */}
            {gameState === 'START' && (
                <div style={overlayStyle}>
                    <h1>Pikatron Run</h1>
                    <p>Salta las respuestas incorrectas. ¡Choca contra las correctas!</p>
                    <button onClick={() => setGameState('PLAYING')} style={btnStyle}><Play size={24} /> JUGAR</button>
                </div>
            )}

            {gameState === 'GAMEOVER' && (
                <div style={overlayStyle}>
                    <h1 style={{ color: '#e74c3c' }}>¡Te tropezaste!</h1>
                    <p>Has chocado con una respuesta incorrecta.</p>
                    <button onClick={reiniciar} style={btnStyle}><RefreshCw size={24} /> REINTENTAR</button>
                </div>
            )}

            {gameState === 'WIN' && (
                <div style={overlayStyle}>
                    <h1 style={{ color: '#f1c40f' }}>¡META ALCANZADA!</h1>
                    <Trophy size={64} color="#f1c40f" />
                    <p>Puntuación Final: {score}</p>
                    <button onClick={onExit} style={btnStyle}>SALIR</button>
                </div>
            )}

            <div style={{ color: '#777', marginTop: 10 }}>Espacio o Toque para saltar</div>
        </div>
    );
}

const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 20
};

const btnStyle = {
    padding: '15px 30px', fontSize: '1.2rem', background: '#2ecc71', color: 'white',
    border: 'none', borderRadius: 30, cursor: 'pointer', display: 'flex', gap: 10,
    marginTop: 20, fontWeight: 'bold'
};