import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Play, Trophy, AlertTriangle, Layers, Map, Heart, Maximize, Save } from 'lucide-react';
// ... otros imports ...
import pikatronImg from './assets/pikatron-sprite.png';
import coinImgFile from './assets/moneda.png'; // <--- AÑADE ESTO
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
// --- IMPORTACIÓN DE FONDOS ---
import bg1 from './assets/pantalla5.jpeg';
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

// --- MAPA DE VELOCIDADES ---
const SPEED_MAP = {
    'LENTO': 4,
    'MODERADO': 7,
    'RAPIDO': 11
};

// =================================================================================
//  GENERADOR DE OPERACIONES (LOGICA MATHLIVE ADAPTADA A PIKATRON)
// =================================================================================
const generarPreguntasMatematicas = (config) => {
    const questions = [];
    const count = parseInt(config.mathCount || 0);
    if (count <= 0) return [];

    const types = config.mathTypes || ['POSITIVOS'];
    const ops = config.mathOps || ['SUMA'];
    const min = parseInt(config.mathMin || 1);
    const max = parseInt(config.mathMax || 10);

    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(1);
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const simplify = (n, d) => { const common = gcd(Math.abs(n), Math.abs(d)); return { n: n / common, d: d / common }; };

    for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const op = ops[i % ops.length];
        let pObj = { pregunta: '', respuesta: '', incorrectas: [] };

        // Variables para cálculo
        let a, b, res, labelA, labelB, operatorSymbol;
        let isFraction = type === 'FRACCIONES';
        let isDecimal = type === 'DECIMALES';
        let isNegative = type === 'NEGATIVOS';

        if (isFraction) {
            const n1 = getRandomInt(min, max); const d1 = getRandomInt(min, max);
            const n2 = getRandomInt(min, max); const d2 = getRandomInt(min, max);

            let resN, resD;
            if (op === 'SUMA') { operatorSymbol = '+'; resN = n1 * d2 + n2 * d1; resD = d1 * d2; }
            else if (op === 'RESTA') { operatorSymbol = '-'; resN = n1 * d2 - n2 * d1; resD = d1 * d2; }
            else if (op === 'MULT') { operatorSymbol = '·'; resN = n1 * n2; resD = d1 * d2; }
            else if (op === 'DIV') { operatorSymbol = ':'; resN = n1 * d2; resD = d1 * n2; }

            const simple = simplify(resN, resD);
            if (simple.d < 0) { simple.n = -simple.n; simple.d = -simple.d; }

            // Formatear pregunta y respuesta
            pObj.pregunta = `${n1}/${d1} ${operatorSymbol} ${n2}/${d2}`;
            pObj.respuesta = `${simple.n}/${simple.d}`;

            // Generar incorrectas (Fracciones aleatorias cercanas o invertidas)
            pObj.incorrectas = [
                `${simple.n + 1}/${simple.d}`,
                `${simple.n}/${simple.d + 1}`,
                `${simple.d}/${simple.n}` // Inversa como trampa
            ].filter(inc => inc !== pObj.respuesta); // Evitar duplicados con la correcta

        } else {
            // Enteros o Decimales
            const getVal = () => {
                let v = isDecimal ? parseFloat(getRandomFloat(min, max)) : getRandomInt(min, max);
                if (isNegative && Math.random() > 0.5) v = -v;
                return v;
            };
            a = getVal(); b = getVal();

            if (op === 'DIV') {
                if (b === 0) b = 1;
                // Ajustar 'a' para que la división sea exacta si no es decimal
                if (!isDecimal) {
                    const resTemp = isNegative ? (Math.random() > 0.5 ? -getRandomInt(min, max) : getRandomInt(min, max)) : getRandomInt(min, max);
                    a = b * resTemp;
                }
            }

            if (op === 'SUMA') { operatorSymbol = '+'; res = a + b; }
            else if (op === 'RESTA') { operatorSymbol = '-'; res = a - b; }
            else if (op === 'MULT') { operatorSymbol = '·'; res = a * b; }
            else if (op === 'DIV') { operatorSymbol = ':'; res = a / b; }

            // Formatear
            if (isDecimal || !Number.isInteger(res)) {
                res = parseFloat(res.toFixed(1));
                pObj.respuesta = String(res).replace('.', ',');
                labelA = String(a).replace('.', ',');
                labelB = String(b).replace('.', ',');
            } else {
                pObj.respuesta = String(res);
                labelA = String(a);
                labelB = String(b);
            }

            if (b < 0) labelB = `(${labelB})`;

            pObj.pregunta = `${labelA} ${operatorSymbol} ${labelB}`;

            // Generar Incorrectas
            const step = isDecimal ? 0.1 : 1;
            pObj.incorrectas = [
                String(isDecimal ? (res + 1).toFixed(1).replace('.', ',') : res + 1),
                String(isDecimal ? (res - 1).toFixed(1).replace('.', ',') : res - 1),
                String(isDecimal ? (res + 10).toFixed(1).replace('.', ',') : res + 10)
            ];
        }
        questions.push(pObj);
    }
    return questions;
};

export default function PikatronRun({ recurso, onExit, usuario }) {
    const canvasRef = useRef(null);

    // ESTADOS
    const [gameState, setGameState] = useState('SETUP');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [levelInfo, setLevelInfo] = useState({ current: 1, total: 1, name: '' });
    // --- NUEVOS ESTADOS PARA RANKING Y GUARDADO ---
    const [verRanking, setVerRanking] = useState(false);
    const [nombreInvitado, setNombreInvitado] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [yaGuardado, setYaGuardado] = useState(false);




    // Referencias mutables
    const gameRef = useRef({
        pikatron: { x: 50, y: 0, vy: 0, width: 100, height: 100, frameX: 0, frameY: 0, speed: 0, jumping: false, groundY: 0 },
        obstacles: [],
        coins: [],     // <--- AÑADIR
        frame: 0,
        speed: 6,
        qIndex: 0,
        spawnTimer: 0,
        coinSpawnTimer: 0, // <--- AÑADIR
        currentAnswers: [],
        nextAnswerIndex: 0,
        levelsQueue: [],
        currentLevelIdx: 0,
        allQuestions: [],
        specialPool: null, // <--- AÑADIR
        puntosAcierto: 10,
        puntosFallo: 2,
        bgX: 0
    });

    // --- LÓGICA DE INICIO ---
    const iniciarPartida = (modo, nombreHoja = null) => {
        const config = recurso.config || {};

        // 1. CONFIGURAR VELOCIDAD Y PUNTOS
        const velocidadStr = config.velocidad || 'MODERADO';
        gameRef.current.speed = SPEED_MAP[velocidadStr] || 7;
        gameRef.current.puntosAcierto = parseInt(config.puntosAcierto) || 10;
        gameRef.current.puntosFallo = parseInt(config.puntosFallo) || 2;

        const manualLimit = parseInt(config.numPreguntas) || 10;
        const isAleatorio = config.aleatorio !== false;

        // DETECTAR SI ES RECURSO PRO/MATHLIVE PARA GENERAR PREGUNTAS
        const esProBurbujas = recurso.tipo === 'PRO-BURBUJAS' || config.mathCount > 0;

        let levels = [];
        let hojasAProcesar = [];

        // Definir qué hojas vamos a jugar
        if (modo === 'RETO') {
            if (recurso.hojas && recurso.hojas.length > 0) {
                hojasAProcesar = recurso.hojas;
            } else if (recurso.preguntas) {
                hojasAProcesar = [{ nombreHoja: "General", preguntas: recurso.preguntas }];
            }
        } else {
            // Modo Simple (Nivel Específico)
            if (nombreHoja === 'General' || !recurso.hojas) {
                hojasAProcesar = [{ nombreHoja: "General", preguntas: recurso.preguntas || [] }];

                if (recurso.hojas) {
                    // Si hay hojas, las juntamos todas
                    let allQ = [];
                    recurso.hojas.forEach(h => allQ.push(...(h.preguntas || [])));

                    // --- NUEVO: FUSIONAR PREGUNTAS ESPECIALES PARA MODO GENERAL ---
                    let mergedCorrectas = [];
                    let mergedIncorrectas = [];
                    let primerEnunciado = "";
                    let hayEspecial = false;

                    recurso.hojas.forEach(h => {
                        if (h.preguntaEspecial && h.preguntaEspecial.activo) {
                            hayEspecial = true;
                            if (!primerEnunciado) primerEnunciado = h.preguntaEspecial.enunciado;
                            if (h.preguntaEspecial.correctas) mergedCorrectas.push(...h.preguntaEspecial.correctas);
                            if (h.preguntaEspecial.incorrectas) mergedIncorrectas.push(...h.preguntaEspecial.incorrectas);
                        }
                    });

                    const especialMix = hayEspecial ? {
                        activo: true,
                        enunciado: primerEnunciado || "Pregunta Especial",
                        correctas: mergedCorrectas,
                        incorrectas: mergedIncorrectas
                    } : null;
                    // -------------------------------------------------------------

                    hojasAProcesar = [{
                        nombreHoja: "Mezcla General",
                        preguntas: allQ,
                        preguntaEspecial: especialMix // Pasamos la mezcla
                    }];
                }
            } else {
                const hObj = recurso.hojas.find(h => h.nombreHoja === nombreHoja);
                if (hObj) hojasAProcesar = [hObj];
            }
        }

        // PROCESAR CADA HOJA PARA CREAR UN NIVEL
        hojasAProcesar.forEach(hoja => {
            let questionsPool = [];

            // A) Preguntas Manuales (Limitadas por numPreguntas)
            let manuales = [...(hoja.preguntas || [])];
            if (isAleatorio) manuales.sort(() => Math.random() - 0.5);

            // Si hay límite y es menor que las manuales disponibles, cortamos
            if (manuales.length > manualLimit) {
                manuales = manuales.slice(0, manualLimit);
            }
            questionsPool = [...manuales];

            // B) Preguntas Generadas (Solo si es PRO)
            if (esProBurbujas) {
                // CAMBIO IMPORTANTE: 
                // Usamos la config de la hoja si existe, si no, usamos la global como respaldo.
                const configGenerador = hoja.mathConfig || config;

                // Generar usando la config específica
                const generated = generarPreguntasMatematicas(configGenerador);

                // Las añadimos al pool
                questionsPool = [...questionsPool, ...generated];
            }

            // Mezclar todo el pool final (Manuales + Generadas)
            if (isAleatorio) questionsPool.sort(() => Math.random() - 0.5);

            // Crear nivel si hay preguntas
            if (questionsPool.length > 0) {
                levels.push({ name: hoja.nombreHoja || "Nivel", questions: questionsPool, preguntaEspecial: hoja.preguntaEspecial });
            }
        });

        if (levels.length === 0) {
            alert("No hay preguntas disponibles con esta configuración.");
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
        gameRef.current.bgX = 0;
        gameRef.current.coins = []; // Limpiar monedas viejas
        if (levelData.preguntaEspecial && levelData.preguntaEspecial.activo) {
            gameRef.current.specialPool = {
                enunciado: levelData.preguntaEspecial.enunciado,
                // Barajamos (.sort) las respuestas aquí, ANTES de jugar
                correctas: [...(levelData.preguntaEspecial.correctas || [])].sort(() => Math.random() - 0.5),
                incorrectas: [...(levelData.preguntaEspecial.incorrectas || [])].sort(() => Math.random() - 0.5)
            };
        } else {
            gameRef.current.specialPool = null;
        }



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
        // Adaptar campos (puede venir como 'respuesta' o 'correcta' o 'a')
        const correcta = p.respuesta || p.correcta || p.a;
        const incorrectas = p.incorrectas || [];

        // Crear respuestas mezcladas
        const mixedAnswers = [
            { text: String(correcta), isCorrect: true },
            ...incorrectas.map(txt => ({ text: String(txt), isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        gameRef.current.currentAnswers = mixedAnswers;
        gameRef.current.nextAnswerIndex = 0;
        gameRef.current.qIndex = index;
        setPreguntaActual(p.pregunta || p.q);
        gameRef.current.obstacles = [];
    };

    // --- BUCLE PRINCIPAL ---
    // --- BUCLE PRINCIPAL ---
    // --- BUCLE PRINCIPAL ---
    useEffect(() => {
        if (gameState !== 'PLAYING') return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        const sprite = new Image();
        sprite.src = pikatronImg;
        const coinSprite = new Image();
        coinSprite.src = coinImgFile;

        if (!canvas) return;

        canvas.width = 800;
        canvas.height = 400;
        const groundLevel = canvas.height - 50;

        // --- PREPARAR IMAGEN DE FONDO ---
        const themeIndex = gameRef.current.currentLevelIdx % LEVEL_THEMES.length;
        const currentTheme = LEVEL_THEMES[themeIndex];
        const bgImg = new Image();
        bgImg.src = currentTheme.img;

        if (gameRef.current.pikatron.groundY === 0) {
            gameRef.current.pikatron.groundY = groundLevel - gameRef.current.pikatron.height;
            gameRef.current.pikatron.y = gameRef.current.pikatron.groundY;
        }

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. DIBUJAR FONDO
            gameRef.current.bgX -= gameRef.current.speed * 0.5;
            const anchoCanvas = 800;
            gameRef.current.bgX = gameRef.current.bgX % anchoCanvas;

            if (bgImg.complete && bgImg.naturalWidth > 0) {
                ctx.drawImage(bgImg, gameRef.current.bgX, 0, anchoCanvas, canvas.height);
                ctx.drawImage(bgImg, gameRef.current.bgX + anchoCanvas, 0, anchoCanvas, canvas.height);
            } else {
                ctx.fillStyle = "#87CEEB";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // SUELO TEMÁTICO
            ctx.fillStyle = currentTheme.ground;
            ctx.fillRect(0, groundLevel, canvas.width, 50);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, groundLevel, canvas.width, 5);

            // 2. DIBUJAR ENUNCIADO DE PREGUNTA ESPECIAL (FIJO Y ESTILO VIDEOJUEGO)
            const special = gameRef.current.specialPool;
            if (special && special.enunciado) {
                ctx.save();
                ctx.font = "900 28px monospace"; // Fuente tipo videojuego (negrita monoespaciada)
                ctx.textAlign = "center";
                ctx.textBaseline = "top";

                // Borde Negro (Efecto Retro)
                ctx.strokeStyle = "black";
                ctx.lineWidth = 6;
                ctx.strokeText(special.enunciado, canvas.width / 2, 20); // Posición fija arriba

                // Relleno Amarillo
                ctx.fillStyle = "#f1c40f";
                ctx.fillText(special.enunciado, canvas.width / 2, 20);
                ctx.restore();
            }

            // 3. PIKATRON
            const pika = gameRef.current.pikatron;
            const gravity = gameRef.current.speed < 6 ? 0.25 : 0.4;

            if (pika.y < pika.groundY || pika.vy < 0) {
                pika.y += pika.vy;
                pika.vy += gravity;
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

            // 4. OBSTÁCULOS (CAJAS SUELO)
            const spawnRate = Math.floor(1100 / gameRef.current.speed);
            gameRef.current.spawnTimer++;
            if (gameRef.current.spawnTimer > spawnRate) {
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
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(obs.x + 4, obs.y + 4, obs.width, obs.height);
                ctx.fillStyle = obs.color || '#3498db';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
                let txt = obs.data.text;
                if (txt.length > 10) txt = txt.substring(0, 9) + '..';
                ctx.fillText(txt, obs.x + (obs.width / 2), obs.y + 26);
                ctx.textAlign = 'start';

                const paddingX = 25; const paddingY = 20;
                if (
                    pika.x + pika.width - paddingX > obs.x &&
                    pika.x + paddingX < obs.x + obs.width &&
                    pika.y + pika.height - paddingY > obs.y &&
                    pika.y + paddingY < obs.y + obs.height
                ) {
                    if (obs.data.isCorrect) {
                        playSound('CORRECT');
                        setScore(s => s + gameRef.current.puntosAcierto);
                        prepararSiguientePregunta(gameRef.current.qIndex + 1);
                    } else {
                        gameRef.current.obstacles = [];
                        setLives(prevLives => {
                            const newLives = prevLives - 1;
                            if (newLives > 0) {
                                playSound('LOSE_LIFE');
                                setScore(s => Math.max(0, s - gameRef.current.puntosFallo));
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

            // 5. LÓGICA DE MONEDAS (MODIFICADA: TEXTO GIGANTE Y ALTURA MAYOR)
            gameRef.current.coinSpawnTimer++;

            if (gameRef.current.coinSpawnTimer > 120 + Math.random() * 100) {
                let coinData = { isCorrect: true, text: '' };

                if (special && (special.correctas.length > 0 || special.incorrectas.length > 0)) {
                    let sacarCorrecta = Math.random() < 0.5;
                    if (!sacarCorrecta && special.incorrectas.length === 0) sacarCorrecta = true;
                    if (sacarCorrecta && special.correctas.length === 0) sacarCorrecta = false;

                    if (sacarCorrecta) {
                        coinData.isCorrect = true;
                        coinData.text = special.correctas[Math.floor(Math.random() * special.correctas.length)];
                    } else {
                        coinData.isCorrect = false;
                        coinData.text = special.incorrectas[Math.floor(Math.random() * special.incorrectas.length)];
                    }
                } else {
                    coinData.isCorrect = true;
                    coinData.text = "";
                }

                gameRef.current.coins.push({
                    x: canvas.width,
                    // CAMBIO AQUÍ: groundLevel - 230 hace que salgan mucho más arriba (salto alto)
                    y: groundLevel - 230 - (Math.random() * 60),
                    width: 70,
                    height: 70,
                    data: coinData,
                    active: true
                });
                gameRef.current.coinSpawnTimer = 0;
            }

            gameRef.current.coins.forEach(coin => {
                if (!coin.active) return;

                coin.x -= gameRef.current.speed * 0.5;

                // Dibujar Moneda
                if (coinSprite.complete) {
                    ctx.drawImage(coinSprite, coin.x, coin.y, coin.width, coin.height);
                } else {
                    ctx.beginPath();
                    ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#f1c40f';
                    ctx.fill();
                }

                // DIBUJAR TEXTO DENTRO DE LA MONEDA (GIGANTE)
                if (coin.data.text) {
                    ctx.save();
                    ctx.fillStyle = 'black';
                    // CAMBIO AQUÍ: Fuente mucho más grande
                    ctx.font = 'bold 26px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let txt = coin.data.text;
                    // Recortamos a 3-4 caracteres para que quepa en tamaño gigante
                    if (txt.length > 5) txt = txt.substring(0, 4) + '.';

                    ctx.fillText(txt, coin.x + (coin.width / 2), coin.y + (coin.height / 2) + 2);
                    ctx.restore();
                }

                // Colisiones Moneda
                if (
                    pika.x < coin.x + coin.width &&
                    pika.x + pika.width > coin.x &&
                    pika.y < coin.y + coin.height &&
                    pika.y + pika.height > coin.y
                ) {
                    coin.active = false;

                    if (coin.data.isCorrect) {
                        setScore(s => s + 1);
                        playSound('CORRECT');
                    } else {
                        setScore(s => Math.max(0, s - 1));
                        playSound('LOSE_LIFE');
                    }
                }
            });

            gameRef.current.coins = gameRef.current.coins.filter(c => c.x > -100 && c.active);

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
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault(); // <--- ESTO EVITA QUE EL BOTÓN SE VUELVA A PULSAR O LA PANTALLA SE MUEVA
                handleInput();
            }
        });

        window.addEventListener('touchstart', handleInput);
        return () => {
            window.removeEventListener('keydown', handleInput);
            window.removeEventListener('touchstart', handleInput);
        };
    }, [gameState]);

    const reiniciarJuegoCompleto = () => { setLives(3); setScore(0); iniciarPartida('RETO'); };
    // SI ESTAMOS EN SETUP, MOSTRAMOS EL MENÚ Y EL RANKING SI TOCA
    if (gameState === 'SETUP') return (
        <>
            {/* Si se pulsó el botón, mostramos el ranking encima */}
            {verRanking && <PantallaRanking recurso={recurso} onBack={() => setVerRanking(false)} />}

            {/* Pantalla de menú principal con la función onRanking conectada */}
            <PantallaSetup
                recurso={recurso}
                onStart={iniciarPartida}
                onExit={onExit}
                onRanking={() => setVerRanking(true)}
            />
        </>
    );
    // Calculamos fondo dinámico
    const bgImage = LEVEL_THEMES[(levelInfo.current - 1) % LEVEL_THEMES.length].img;

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error al intentar pantalla completa: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // --- FUNCIÓN PARA GUARDAR PUNTUACIÓN ---
    const guardarPuntuacion = async () => {
        if (guardando || yaGuardado) return;

        // Si no hay usuario y no ha puesto nombre, avisar
        const esInvitado = !usuario || !usuario.email;
        const nombreFinal = esInvitado ? nombreInvitado.trim() : (usuario.displayName || "Jugador");

        if (esInvitado && !nombreFinal) {
            alert("Por favor, introduce un nombre para aparecer en el ranking.");
            return;
        }

        setGuardando(true);
        try {
            await addDoc(collection(db, 'ranking'), {
                recursoId: recurso.id,
                recursoTitulo: recurso.titulo,
                tipoJuego: 'PIKATRON',
                jugador: nombreFinal,
                email: esInvitado ? 'invitado' : usuario.email,
                aciertos: score, // Usamos score como puntuación
                fecha: new Date(),
                categoria: levelInfo.name || 'General' // Guardamos el nivel o categoría
            });
            setYaGuardado(true);
            alert("¡Puntuación guardada correctamente!");
        } catch (error) {
            console.error("Error guardando:", error);
            alert("Hubo un error al guardar.");
        }
        setGuardando(false);
    };

    return (
        <div style={{
            width: '100%',
            height: '100vh',
            background: '#222',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '20px' // Un poco de margen general
        }}>

            {gameState !== 'LEVEL_INTRO' && (
                <>
                    {/* 1. VIDAS Y NIVEL (ESQUINA IZQUIERDA SUPERIOR) */}
                    <div style={{
                        position: 'absolute',
                        top: 80,
                        left: 20,
                        zIndex: 2000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        alignItems: 'flex-start'
                    }}>
                        {/* Corazones */}
                        <div style={{ display: 'flex', gap: '3px' }}>
                            {[...Array(3)].map((_, i) => (
                                <Heart key={i} size={32} fill={i < lives ? "#e74c3c" : "#333"} color={i < lives ? "#c0392b" : "#555"}
                                    style={{
                                        filter: i < lives ? 'drop-shadow(0 0 2px #e74c3c)' : 'none',
                                        transform: i < lives ? 'scale(1)' : 'scale(0.9)',
                                        transition: 'all 0.3s'
                                    }} />
                            ))}
                        </div>

                        {/* Nivel */}
                        {gameRef.current.levelsQueue.length > 1 && (
                            <div style={{ fontSize: '1rem', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: '8px', color: '#fff', fontWeight: 'bold', border: '1px solid #555' }}>
                                Nivel {levelInfo.current} / {levelInfo.total}
                            </div>
                        )}
                    </div>

                    {/* 2. BOTÓN PANTALLA COMPLETA (ESQUINA DERECHA SUPERIOR) */}
                    <button
                        onClick={toggleFullScreen}
                        style={{
                            position: 'absolute',
                            top: 20,
                            right: 20,
                            zIndex: 2000,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: 'white',
                            padding: '10px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.3s'
                        }}
                        title="Pantalla Completa"
                    >
                        <Maximize size={24} />
                    </button>
                </>
            )}

            {/* 3. CANVAS (PANTALLA DE JUEGO) */}
            <canvas ref={canvasRef} style={{
                backgroundColor: '#87CEEB', // Un color base cielo por si tarda en cargar la imagen
                borderRadius: 15,
                maxWidth: '100%',
                maxHeight: '70vh',
                border: '4px solid #34495e',
                boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                zIndex: 10
            }} />

            {/* 4. BARRA DE PREGUNTA (AHORA DEBAJO DE LA PANTALLA) */}
            {gameState !== 'LEVEL_INTRO' && (
                <div style={{
                    marginTop: '20px', // Separación del canvas
                    width: '100%',
                    maxWidth: '800px', // Mismo ancho que el canvas aprox
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        display: 'flex', gap: 15, alignItems: 'center', justifyContent: 'space-between',
                        background: 'white', padding: '10px 20px', borderRadius: '15px',
                        color: '#2c3e50', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', fontWeight: 'bold',
                        width: '100%', borderBottom: '4px solid #bdc3c7'
                    }}>
                        {/* PUNTOS */}
                        <div style={{
                            background: '#f1c40f', color: '#2c3e50', padding: '5px 15px',
                            borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '1.2rem',
                            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.1)'
                        }}>
                            ⭐ {score}
                        </div>

                        {/* PREGUNTA TEXTO */}
                        {preguntaActual && (
                            <div style={{
                                flex: 1, minWidth: 0, textAlign: 'center', lineHeight: '1.2',
                                fontSize: 'clamp(14px, 2.5vw, 20px)', // Texto responsivo
                                whiteSpace: 'normal',
                                color: '#333',
                                padding: '0 10px'
                            }}>
                                {preguntaActual}
                            </div>
                        )}

                        {/* SALIR */}
                        <button onClick={onExit} style={{
                            background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px',
                            cursor: 'pointer', display: 'flex', padding: '8px', color: '#c62828'
                        }} title="Salir del Juego">
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}

            {/* PANTALLAS SUPERPUESTAS (INTRO, GAMEOVER, WIN) */}
            {/* PANTALLA RANKING (ENCIMA DE TODO) */}
            {verRanking && <PantallaRanking recurso={recurso} onBack={() => setVerRanking(false)} />}

            {/* PANTALLAS ESTADO */}
            {gameState === 'SETUP' && (
                <PantallaSetup
                    recurso={recurso}
                    onStart={iniciarPartida}
                    onExit={onExit}
                    onRanking={() => setVerRanking(true)} // Pasamos la función
                />
            )}

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

            {(gameState === 'GAMEOVER' || gameState === 'WIN') && (
                <div style={overlayStyle}>
                    {gameState === 'WIN' && <Trophy size={80} color="#f1c40f" style={{ marginBottom: 20 }} />}
                    {gameState === 'GAMEOVER' && <AlertTriangle size={80} color="#e74c3c" style={{ marginBottom: 20 }} />}

                    <h1 style={{ color: gameState === 'WIN' ? '#f1c40f' : '#e74c3c', fontSize: '3.5rem', fontFamily: 'monospace', textShadow: '3px 3px 0px #fff', margin: 0 }}>
                        {gameState === 'WIN' ? '¡COMPLETADO!' : 'GAME OVER'}
                    </h1>

                    <div style={{ background: '#333', padding: '10px 30px', borderRadius: 10, margin: '20px 0', fontSize: '1.5rem', border: '2px solid #555' }}>
                        Puntuación: <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>{score}</span>
                    </div>

                    {/* --- ZONA DE GUARDADO --- */}
                    {!yaGuardado ? (
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '350px', marginBottom: '20px' }}>
                            {(!usuario || !usuario.email) ? (
                                <>
                                    <p style={{ margin: '0 0 10px 0', color: '#ccc', fontSize: '0.9rem' }}>Introduce tu nombre para el ranking:</p>
                                    <input
                                        value={nombreInvitado}
                                        onChange={e => setNombreInvitado(e.target.value)}
                                        placeholder="Tu Nombre"
                                        maxLength={15}
                                        style={{ padding: '10px', borderRadius: '5px', border: 'none', width: '100%', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: '#f1c40f', margin: '5px 0 15px 0' }}>✨ Únete a PiKT y descubre más juegos ✨</p>
                                </>
                            ) : (
                                    <p style={{ color: '#2ecc71', fontWeight: 'bold', marginBottom: '15px' }}>Usuario: {usuario.displayName}</p>
                                )}

                            <button onClick={guardarPuntuacion} style={{ ...btnStyle, marginTop: 0, background: '#3498db', fontSize: '1rem', padding: '10px' }} disabled={guardando}>
                                {guardando ? 'Guardando...' : <><Save size={18} /> Guardar Puntuación</>}
                            </button>
                        </div>
                    ) : (
                            <div style={{ color: '#2ecc71', fontWeight: 'bold', marginBottom: '20px', fontSize: '1.2rem' }}>✅ ¡Puntuación Guardada!</div>
                        )}
                    {/* ------------------------- */}

                    <button onClick={reiniciarJuegoCompleto} style={{ ...btnStyle, background: '#e74c3c' }}><RefreshCw size={24} /> REINICIAR</button>
                    <button onClick={onExit} style={{ marginTop: 20, background: 'none', border: 'none', color: '#777', cursor: 'pointer' }}>Salir</button>
                </div>
            )}

            {/* ... (Los bloques GAMEOVER y WIN se quedan igual que antes, usan overlayStyle así que taparán todo correctamente) ... */}
           

            {gameState === 'PLAYING' && <div style={{ color: '#777', marginTop: 10, fontFamily: 'monospace', fontSize: '12px' }}>[ ESPACIO ] o [ CLICK ] para saltar</div>}
        </div>
    );
}

// --- COMPONENTE RANKING ---
// --- COMPONENTE RANKING MEJORADO ---
function PantallaRanking({ recurso, onBack }) {
    const [hoja, setHoja] = useState('General'); // Por defecto 'General'
    const [top10, setTop10] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Obtenemos las hojas para el desplegable
    const hojasDisponibles = recurso.hojas || [];

    useEffect(() => {
        const cargarRanking = async () => {
            setCargando(true);
            try {
                const ref = collection(db, 'ranking');
                // AHORA FILTRAMOS TAMBIÉN POR 'categoria' (El nivel jugado)
                const q = query(
                    ref,
                    where('recursoId', '==', recurso.id),
                    where('tipoJuego', '==', 'PIKATRON'),
                    where('categoria', '==', hoja), // <--- ESTO ES LO NUEVO
                    orderBy('aciertos', 'desc'),
                    limit(10)
                );
                const snap = await getDocs(q);
                setTop10(snap.docs.map(d => d.data()));
            } catch (e) {
                console.error("Error cargando ranking:", e);
            }
            setCargando(false);
        };
        cargarRanking();
    }, [recurso, hoja]); // Se recarga cuando cambias de hoja

    return (
        <div style={{ ...overlayStyle, zIndex: 3000 }}>
            <div className="setup-card" style={{ maxWidth: '500px', width: '95%' }}>
                <h2 style={{ color: '#f1c40f', marginBottom: '15px' }}>🏆 Ranking Top 10</h2>

                {/* --- SELECTOR DE NIVEL (Igual que en CazaBurbujas) --- */}
                {hojasDisponibles.length > 0 && (
                    <div style={{ width: '100%', marginBottom: '15px' }}>
                        <select
                            value={hoja}
                            onChange={e => setHoja(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold' }}
                        >
                            <option value="General">Mezcla General</option>
                            {hojasDisponibles.map(h => (
                                <option key={h.nombreHoja} value={h.nombreHoja}>{h.nombreHoja}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '300px', overflowY: 'auto', marginBottom: '20px', width: '100%', padding: '10px' }}>
                    {cargando ? <p style={{ color: 'white' }}>Cargando...</p> : top10.length === 0 ? <p style={{ color: '#aaa' }}>Sin puntuaciones en este nivel.</p> : (
                        top10.map((fila, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                                <span style={{ fontWeight: 'bold', color: i < 3 ? '#f1c40f' : '#ccc', width: '30px' }}>#{i + 1}</span>
                                <span style={{ flex: 1, textAlign: 'left', marginLeft: '10px' }}>{fila.jugador}</span>
                                <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>{fila.aciertos} pts</span>
                            </div>
                        ))
                    )}
                </div>

                <button onClick={onBack} style={{ ...btnStyle, background: '#7f8c8d', marginTop: 0 }}>Cerrar Ranking</button>
            </div>
        </div>
    );
}


// COMPONENTE SETUP
function PantallaSetup({ recurso, onStart, onExit, onRanking }) {
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
                {/* --- BOTÓN RANKING --- */}
                <button onClick={onRanking} style={{ ...btnStyle, marginTop: 0, background: '#8e44ad', boxShadow: '0 5px 0 #6c3483' }}>
                    <Trophy size={20} /> VER RANKING
                </button>



            </div>




            <button onClick={onExit} style={{ marginTop: '30px', background: 'none', border: '1px solid #555', padding: '10px 20px', color: '#777', borderRadius: '20px', cursor: 'pointer' }}>Volver</button>
            <style>{`.setup-card { background: rgba(44, 62, 80, 0.95); padding: 40px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; alignItems: center; border: 1px solid rgba(255,255,255,0.1); }`}</style>
        </div>
    );
}

const overlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 2000 };
const btnStyle = { padding: '15px 30px', fontSize: '1.2rem', background: '#2ecc71', color: 'white', border: 'none', borderRadius: 50, cursor: 'pointer', display: 'flex', gap: 10, marginTop: 30, fontWeight: 'bold', boxShadow: '0 5px 0 #27ae60', transition: 'transform 0.1s', alignItems: 'center', justifyContent: 'center', width: '100%' };