import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Play, Trophy, AlertTriangle, Layers, Map, Heart } from 'lucide-react';
// IMPORTA AQUÍ TU IMAGEN SIN FONDO
import pikatronImg from './assets/pikatron-sprite.png';

// --- IMPORTACIÓN DE FONDOS ---
import bg1 from './assets/pantalla1.jpeg';
import bg2 from './assets/pantalla2.jpeg';
import bg3 from './assets/pantalla3.jpeg';
import bg4 from './assets/pantalla4.jpeg';

// --- CONFIGURACIÓN VISUAL POR NIVEL ---
const LEVEL_THEMES = [
    { img: bg1, ground: '#45a02c' }, // Nivel 1: Prado -> Suelo Verde
    { img: bg2, ground: '#34495e' }, // Nivel 2: Hielo -> Suelo Azul Oscuro
    { img: bg3, ground: '#742818' }, // Nivel 3: Marte -> Suelo Rojizo
    { img: bg4, ground: '#3e2723' }, // Nivel 4: Bosque -> Suelo Marrón
];

// --- ZONA DE SONIDOS ---
import jumpSoundFile from './assets/jump.mp3';
import correctSoundFile from './assets/correct.mp3';
import looseLifeSoundFile from './assets/wrong.mp3';
import gameOverSoundFile from './assets/gameover.mp3';

// Pre-carga de audios
const audioJump = new Audio(jumpSoundFile);
const audioCorrect = new Audio(correctSoundFile);
const audioLoseLife = new Audio(looseLifeSoundFile);
const audioGameOver = new Audio(gameOverSoundFile);

const playSound = (type) => {
    try {
        if (type === 'JUMP') { audioJump.currentTime = 0; audioJump.play().catch(() => { }); }
        if (type === 'CORRECT') { audioCorrect.currentTime = 0; audioCorrect.play().catch(() => { }); }
        if (type === 'LOSE_LIFE') { audioLoseLife.currentTime = 0; audioLoseLife.play().catch(() => { }); }
        if (type === 'GAMEOVER') { audioGameOver.currentTime = 0; audioGameOver.play().catch(() => { }); }
    } catch (e) { console.log("Audio bloqueado"); }
};

const BLOCK_COLORS = ['#e74c3c', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c'];

export default function PikatronRun({ recurso, onExit }) {
    const canvasRef = useRef(null);

    // ESTADOS
    const [gameState, setGameState] = useState('SETUP');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [levelInfo, setLevelInfo] = useState({ current: 1, total: 1, name: '' });

    // Referencias mutables
    const gameRef = useRef({
        pikatron: { x: 50, y: 0, vy: 0, width: 100, height: 100, frameX: 0, frameY: 0, speed: 0, jumping: false, groundY: 0 },
        obstacles: [],
        frame: 0,
        speed: 6,
        qIndex: 0,
        spawnTimer: 0,
        currentAnswers: [],
        nextAnswerIndex: 0,
        levelsQueue: [],
        currentLevelIdx: 0,
        allQuestions: []
    });

    // --- LÓGICA DE INICIO ---
    const iniciarPartida = (modo, nombreHoja = null) => {
        const config = recurso.config || {};
        const limitPerSheet = parseInt(config.numPreguntas) || 10;
        const isAleatorio = config.aleatorio !== false;

        let levels = [];
        if (modo === 'RETO') {
            if (recurso.hojas && recurso.hojas.length > 0) {
                recurso.hojas.forEach(hoja => {
                    let questions = [...(hoja.preguntas || [])];
                    if (questions.length > 0) {
                        if (isAleatorio) questions.sort(() => Math.random() - 0.5);
                        questions = questions.slice(0, limitPerSheet);
                        levels.push({ name: hoja.nombreHoja || "Nivel", questions: questions });
                    }
                });
            } else if (recurso.preguntas) {
                levels.push({ name: "General", questions: recurso.preguntas });
            }
        } else {
            let targetQuestions = [];
            let sheetName = "General";
            if (nombreHoja === 'General' || !recurso.hojas) {
                if (recurso.preguntas) targetQuestions = [...recurso.preguntas];
                if (recurso.hojas) recurso.hojas.forEach(h => targetQuestions.push(...(h.preguntas || [])));
            } else {
                const hObj = recurso.hojas.find(h => h.nombreHoja === nombreHoja);
                if (hObj) {
                    targetQuestions = [...(hObj.preguntas || [])];
                    sheetName = hObj.nombreHoja;
                }
            }
            if (isAleatorio) targetQuestions.sort(() => Math.random() - 0.5);
            if (targetQuestions.length > limitPerSheet) targetQuestions = targetQuestions.slice(0, limitPerSheet);
            levels.push({ name: sheetName, questions: targetQuestions });
        }

        if (levels.length === 0 || levels[0].questions.length === 0) {
            alert("No hay preguntas disponibles.");
            return;
        }

        gameRef.current.levelsQueue = levels;
        gameRef.current.currentLevelIdx = 0;
        setLives(3);
        setScore(0);
        cargarNivel(0);
    };

    const cargarNivel = (levelIndex) => {
        const levelData = gameRef.current.levelsQueue[levelIndex];
        gameRef.current.allQuestions = levelData.questions;
        gameRef.current.qIndex = 0;
        gameRef.current.obstacles = [];
        gameRef.current.pikatron.y = 0;

        setLevelInfo({
            current: levelIndex + 1,
            total: gameRef.current.levelsQueue.length,
            name: levelData.name
        });
        setGameState('LEVEL_INTRO');
    };

    const startLevelPlaying = () => {
        prepararSiguientePregunta(0);
        setGameState('PLAYING');
    };

    const prepararSiguientePregunta = (index) => {
        const questions = gameRef.current.allQuestions;
        if (!questions[index]) {
            const nextLevelIdx = gameRef.current.currentLevelIdx + 1;
            if (nextLevelIdx < gameRef.current.levelsQueue.length) {
                gameRef.current.currentLevelIdx = nextLevelIdx;
                cargarNivel(nextLevelIdx);
            } else {
                setGameState('WIN');
            }
            return;
        }

        const p = questions[index];
        const correcta = p.respuesta || p.correcta || p.a;
        const incorrectas = p.incorrectas || [];
        const mixedAnswers = [
            { text: correcta, isCorrect: true },
            ...incorrectas.map(txt => ({ text: txt, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        gameRef.current.currentAnswers = mixedAnswers;
        gameRef.current.nextAnswerIndex = 0;
        gameRef.current.qIndex = index;
        setPreguntaActual(p.pregunta || p.q);
        gameRef.current.obstacles = [];
    };

    // --- BUCLE PRINCIPAL ---
    useEffect(() => {
        if (gameState !== 'PLAYING') return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        const sprite = new Image();
        sprite.src = pikatronImg;

        if (!canvas) return;

        canvas.width = 800;
        canvas.height = 400;
        const groundLevel = canvas.height - 50;

        if (gameRef.current.pikatron.groundY === 0) {
            gameRef.current.pikatron.groundY = groundLevel - gameRef.current.pikatron.height;
            gameRef.current.pikatron.y = gameRef.current.pikatron.groundY;
        }

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. FONDO Y SUELO
            const themeIndex = gameRef.current.currentLevelIdx % LEVEL_THEMES.length;
            const currentTheme = LEVEL_THEMES[themeIndex];

            // Suelo temático
            ctx.fillStyle = currentTheme.ground;
            ctx.fillRect(0, groundLevel, canvas.width, 50);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, groundLevel, canvas.width, 5);

            // 2. PIKATRON
            const pika = gameRef.current.pikatron;
            if (pika.y < pika.groundY || pika.vy < 0) {
                pika.y += pika.vy;
                pika.vy += 0.4;
            } else {
                pika.y = pika.groundY;
                pika.vy = 0;
                pika.jumping = false;
            }

            if (gameRef.current.frame % 10 === 0) {
                if (pika.jumping) {
                    pika.frameX = 1; pika.frameY = 0;
                } else {
                    const runFrames = [[0, 0], [0, 1], [1, 1]];
                    const step = (gameRef.current.frame / 10) % 3;
                    pika.frameX = runFrames[step][0];
                    pika.frameY = runFrames[step][1];
                }
            }

            const sW = sprite.width / 2;
            const sH = sprite.height / 2;
            ctx.drawImage(sprite, pika.frameX * sW, pika.frameY * sH, sW, sH, pika.x, pika.y, pika.width, pika.height);

            // 3. OBSTÁCULOS
            gameRef.current.spawnTimer++;
            if (gameRef.current.spawnTimer > 160) {
                const list = gameRef.current.currentAnswers;
                if (list.length > 0) {
                    const nextData = list[gameRef.current.nextAnswerIndex];
                    const color = BLOCK_COLORS[gameRef.current.nextAnswerIndex % BLOCK_COLORS.length];
                    gameRef.current.obstacles.push({
                        x: canvas.width, y: groundLevel - 40, width: 100, height: 40, data: nextData, color: color
                    });
                    gameRef.current.nextAnswerIndex = (gameRef.current.nextAnswerIndex + 1) % list.length;
                }
                gameRef.current.spawnTimer = 0;
            }

            gameRef.current.obstacles.forEach((obs) => {
                obs.x -= gameRef.current.speed;
                // Dibujo bloque
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(obs.x + 4, obs.y + 4, obs.width, obs.height);
                ctx.fillStyle = obs.color || '#3498db';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
                ctx.fillText(obs.data.text, obs.x + (obs.width / 2), obs.y + 26);
                ctx.textAlign = 'start';

                // Colisiones
                const paddingX = 25; const paddingY = 20;
                if (
                    pika.x + pika.width - paddingX > obs.x &&
                    pika.x + paddingX < obs.x + obs.width &&
                    pika.y + pika.height - paddingY > obs.y &&
                    pika.y + paddingY < obs.y + obs.height
                ) {
                    if (obs.data.isCorrect) {
                        playSound('CORRECT');
                        setScore(s => s + 10);
                        prepararSiguientePregunta(gameRef.current.qIndex + 1);
                    } else {
                        gameRef.current.obstacles = [];
                        setLives(prevLives => {
                            const newLives = prevLives - 1;
                            if (newLives > 0) {
                                playSound('LOSE_LIFE');
                                return newLives;
                            } else {
                                playSound('GAMEOVER');
                                setGameState('GAMEOVER');
                                return 0;
                            }
                        });
                    }
                }
            });
            gameRef.current.obstacles = gameRef.current.obstacles.filter(obs => obs.x > -200);
            gameRef.current.frame++;
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState]);

    // CONTROLES
    useEffect(() => {
        const handleInput = () => {
            if (gameState === 'PLAYING' && !gameRef.current.pikatron.jumping) {
                playSound('JUMP');
                gameRef.current.pikatron.vy = -10;
                gameRef.current.pikatron.jumping = true;
            }
        };
        window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') handleInput(); });
        window.addEventListener('touchstart', handleInput);
        return () => {
            window.removeEventListener('keydown', handleInput);
            window.removeEventListener('touchstart', handleInput);
        };
    }, [gameState]);

    const reiniciarJuegoCompleto = () => { setLives(3); setScore(0); iniciarPartida('RETO'); };

    if (gameState === 'SETUP') return <PantallaSetup recurso={recurso} onStart={iniciarPartida} onExit={onExit} />;

    // Calculamos fondo dinámico
    const bgImage = LEVEL_THEMES[(levelInfo.current - 1) % LEVEL_THEMES.length].img;

    return (
        <div style={{ width: '100%', height: '100vh', background: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

            {gameState !== 'LEVEL_INTRO' && (
                <>
                    {/* BARRA SUPERIOR (HUD) COMPACTA Y ARRIBA */}
                    <div style={{
                        position: 'absolute', top: 5, width: '100%', display: 'flex', justifyContent: 'center', zIndex: 2000
                    }}>
                        <div style={{
                            display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between',
                            background: 'rgba(44, 62, 80, 0.95)', padding: '5px 15px', borderRadius: '30px',
                            color: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', fontWeight: 'bold',
                            maxWidth: '98%', border: '2px solid #f1c40f', minWidth: '300px'
                        }}>
                            {/* PUNTOS */}
                            <div style={{ color: '#f1c40f', whiteSpace: 'nowrap', fontSize: '1rem' }}>⭐ {score}</div>

                            {/* PREGUNTA FLEXIBLE */}
                            {preguntaActual && (
                                <div style={{
                                    borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '10px',
                                    flex: 1, minWidth: 0, textAlign: 'center', lineHeight: '1.1',
                                    // TEXTO QUE SE ADAPTA
                                    fontSize: 'clamp(10px, 3vw, 18px)',
                                    whiteSpace: 'normal'
                                }}>
                                    {preguntaActual}
                                </div>
                            )}

                            {/* SALIR */}
                            <button onClick={onExit} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X color="#e74c3c" size={20} /></button>
                        </div>
                    </div>

                    {/* VIDAS Y NIVEL (A LA IZQUIERDA Y ABAJO) */}
                    <div style={{
                        position: 'absolute', top: 70, left: 20, zIndex: 2000,
                        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start'
                    }}>
                        {/* Corazones */}
                        <div style={{ display: 'flex', gap: '3px' }}>
                            {[...Array(3)].map((_, i) => (
                                <Heart key={i} size={28} fill={i < lives ? "#e74c3c" : "#333"} color={i < lives ? "#c0392b" : "#555"}
                                    style={{ filter: i < lives ? 'drop-shadow(0 0 2px #e74c3c)' : 'none', transform: i < lives ? 'scale(1)' : 'scale(0.9)', transition: 'all 0.3s' }} />
                            ))}
                        </div>

                        {/* Nivel */}
                        {gameRef.current.levelsQueue.length > 1 && (
                            <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '8px', color: '#ccc', fontWeight: 'bold' }}>
                                Nivel {levelInfo.current} / {levelInfo.total}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* CANVAS (Fondo Dinámico) */}
            <canvas ref={canvasRef} style={{
                background: `url(${bgImage})`, // IMAGEN DE FONDO
                backgroundSize: 'cover', backgroundPosition: 'center',
                borderRadius: 10, maxWidth: '100%', borderBottom: '5px solid #bdc3c7', boxShadow: '0 0 50px rgba(0,0,0,0.5)'
            }} />

            {/* PANTALLAS ESTADO */}
            {gameState === 'LEVEL_INTRO' && (
                <div style={overlayStyle}>
                    <h2 style={{ color: '#2ecc71', fontSize: '2rem', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 0 }}>PANTALLA {levelInfo.current}</h2>
                    <h1 style={{ fontSize: '4rem', fontFamily: 'monospace', color: '#f1c40f', textShadow: '4px 4px #c0392b', margin: '20px 0', textAlign: 'center' }}>{levelInfo.name}</h1>
                    <div style={{ width: '60%', height: '5px', background: '#555', margin: '20px 0', borderRadius: '5px' }}>
                        <div style={{ width: `${(levelInfo.current / levelInfo.total) * 100}%`, height: '100%', background: '#f1c40f', borderRadius: '5px', transition: 'width 0.5s' }}></div>
                    </div>
                    <button onClick={startLevelPlaying} style={btnStyle}><Play size={24} /> ¡VAMOS!</button>
                </div>
            )}
            {gameState === 'GAMEOVER' && (
                <div style={overlayStyle}>
                    <AlertTriangle size={80} color="#e74c3c" style={{ marginBottom: 20 }} />
                    <h1 style={{ color: '#e74c3c', fontSize: '4rem', fontFamily: 'monospace', textShadow: '3px 3px 0px #fff', margin: 0 }}>GAME OVER</h1>
                    <p style={{ color: '#ccc', marginTop: 10 }}>Te has quedado sin vidas.</p>
                    <div style={{ background: '#333', padding: '10px 20px', borderRadius: 10, marginTop: 20 }}>Puntuación: <span style={{ color: '#f1c40f' }}>{score}</span></div>
                    <button onClick={reiniciarJuegoCompleto} style={{ ...btnStyle, background: '#e74c3c' }}><RefreshCw size={24} /> REINICIAR</button>
                    <button onClick={onExit} style={{ marginTop: 20, background: 'none', border: 'none', color: '#777', cursor: 'pointer' }}>Salir</button>
                </div>
            )}
            {gameState === 'WIN' && (
                <div style={overlayStyle}>
                    <h1 style={{ color: '#f1c40f', fontSize: '3rem' }}>¡JUEGO COMPLETADO!</h1>
                    <Trophy size={80} color="#f1c40f" style={{ margin: 20 }} />
                    <p style={{ fontSize: '1.5rem' }}>Puntuación Final: {score}</p>
                    <button onClick={onExit} style={btnStyle}>VOLVER AL MENÚ</button>
                </div>
            )}
            {gameState === 'PLAYING' && <div style={{ color: '#777', marginTop: 10, fontFamily: 'monospace' }}>ESPACIO o TOQUE para saltar</div>}
        </div>
    );
}

// COMPONENTE SETUP
function PantallaSetup({ recurso, onStart, onExit }) {
    const [hoja, setHoja] = useState('General');
    const hojas = recurso.hojas || [];
    return (
        <div className="setup-card">
            <h1 style={{ color: '#f1c40f', fontFamily: 'monospace', fontSize: '2.5rem', textShadow: '2px 2px #c0392b', margin: 0 }}>PIKATRON RUN</h1>
            <h2 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '30px', fontWeight: 'normal' }}>{recurso.titulo}</h2>
            {hojas.length > 0 && (
                <div style={{ marginBottom: '20px', textAlign: 'left', width: '100%' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#ccc', fontWeight: 'bold' }}>Elige Pantalla:</label>
                    <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '1rem', background: 'white', color: '#333' }}>
                        <option value="General">Mezcla General</option>
                        {hojas.map(h => <option key={h.nombreHoja} value={h.nombreHoja}>{h.nombreHoja}</option>)}
                    </select>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                <button onClick={() => onStart('SIMPLE', hoja)} style={{ ...btnStyle, marginTop: 0, background: '#3498db', boxShadow: '0 5px 0 #2980b9' }}><Play size={20} /> JUGAR NIVEL</button>
                <button onClick={() => onStart('RETO')} style={{ ...btnStyle, marginTop: 0, background: '#e74c3c', boxShadow: '0 5px 0 #c0392b', border: '2px solid white' }}><Map size={20} /> MODO RETO (Todas)</button>
            </div>
            <button onClick={onExit} style={{ marginTop: '30px', background: 'none', border: '1px solid #555', padding: '10px 20px', color: '#777', borderRadius: '20px', cursor: 'pointer' }}>Volver</button>
            <style>{`.setup-card { background: rgba(44, 62, 80, 0.95); padding: 40px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; alignItems: center; border: 1px solid rgba(255,255,255,0.1); }`}</style>
        </div>
    );
}

const overlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 2000 };
const btnStyle = { padding: '15px 30px', fontSize: '1.2rem', background: '#2ecc71', color: 'white', border: 'none', borderRadius: 50, cursor: 'pointer', display: 'flex', gap: 10, marginTop: 30, fontWeight: 'bold', boxShadow: '0 5px 0 #27ae60', transition: 'transform 0.1s', alignItems: 'center', justifyContent: 'center', width: '100%' };