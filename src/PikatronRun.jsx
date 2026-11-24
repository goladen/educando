import React, { useState, useEffect, useRef } from 'react';
import { validarNombre } from './utils/filtroNombres';
import { X, RefreshCw, Play, Trophy, AlertTriangle, Layers, Map, Heart, Maximize, Save } from 'lucide-react';
// ... otros imports ...
import pikatronImg from './assets/pikatron-sprite.png';
import coinImgFile from './assets/moneda.png'; // <--- AÑADE ESTO
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { dibujarAjustado, letraAjustada } from './utils/encajeTexto';
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
// --- IMPORTACIÓN DE FONDOS ---
import bg1 from './assets/pantalla5.jpeg';
import bg2 from './assets/pantalla2.jpeg';
import bg3 from './assets/pantalla3.jpeg';
import bg4 from './assets/pantalla4.jpeg';
import { BotonPantallaDual, esMitadDual, ladoMitadDual } from './components/JuegoDual';

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
import respCorrecta from './assets/sonidorespcorrecta.mp3';
import monedaIncorrecta from './assets/sonidomonedamal.mp3';
import { leerCompeticionUrl, soloPrimitivos } from './utils/retoLink';
import ModalEnviarCompeticion from './components/ModalEnviarCompeticion';
import MandosEnJuego from './mandos/RelevosMandos.jsx';
const _mkAudio = src => { let a; return { get currentTime(){ return a?.currentTime??0; }, set currentTime(v){ (a??=new Audio(src)).currentTime=v; }, play(){ return (a??=new Audio(src)).play(); } }; };
const audioJump             = _mkAudio(jumpSoundFile);
const audioCorrect          = _mkAudio(correctSoundFile);
const audioLoseLife         = _mkAudio(looseLifeSoundFile);
const audioGameOver         = _mkAudio(gameOverSoundFile);
const audioRespCorrecta     = _mkAudio(respCorrecta);
const audioMonedaIncorrecta = _mkAudio(monedaIncorrecta);


const playSound = (type) => {
    try {
        if (type === 'JUMP') { audioJump.currentTime = 0; audioJump.play().catch(() => { }); }
        if (type === 'CORRECT') { audioCorrect.currentTime = 0; audioCorrect.play().catch(() => { }); }
        if (type === 'LOSE_LIFE') { audioLoseLife.currentTime = 0; audioLoseLife.play().catch(() => { }); }
        if (type === 'GAMEOVER') { audioGameOver.currentTime = 0; audioGameOver.play().catch(() => { }); }
        if (type === 'RES_COR') { audioRespCorrecta.currentTime = 0; audioRespCorrecta.play().catch(() => { }); }
        if (type === 'MON_INC') { audioMonedaIncorrecta.currentTime = 0; audioMonedaIncorrecta.play().catch(() => { }); }
        


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

export default function PikatronRun({ recurso, onExit, usuario, modoOlimpico = false, tiempoOlimpico = null, hojaOlimpica = 'General', onOlimpicoFinish = null, autoStart = false, hojaInicial = null }) {
    const canvasRef = useRef(null);

    // ESTADOS
    const [gameState, setGameState] = useState('SETUP');
    const [score, setScore] = useState(0);
    const mandosApi = useRef(null);

    // --- NUEVO: CRONÓMETRO Y LÓGICA OLÍMPICA ---
    const [tiempoRestante, setTiempoRestante] = useState(tiempoOlimpico || 60);

    // 1. Reloj Global
    useEffect(() => {
        if (!modoOlimpico) return;
        const t = setInterval(() => {
            setTiempoRestante(prev => {
                if (prev <= 1) {
                    clearInterval(t);
                    setGameState('TIMEOUT'); // Detiene el juego por tiempo
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [modoOlimpico, tiempoOlimpico]);

    // 2. Auto-Start Olímpico
    useEffect(() => {
        if (modoOlimpico && recurso && gameState === 'SETUP') {
            iniciarPartida('SIMPLE', hojaOlimpica);
        }
    }, [modoOlimpico, recurso, gameState, hojaOlimpica]);

    // 2b. Auto-Start Deep Link
    useEffect(() => {
        if (autoStart && !modoOlimpico && recurso && gameState === 'SETUP') {
            iniciarPartida('SIMPLE', hojaInicial || 'General');
        }
    }, [autoStart, recurso, gameState]);

    // 3. Interceptor (Cazador de Puntos)
    const hasFinishedRef = useRef(false);
    useEffect(() => {
        if ((gameState === 'WIN' || gameState === 'GAMEOVER' || gameState === 'TIMEOUT') && modoOlimpico && !hasFinishedRef.current) {
            hasFinishedRef.current = true;
            if (onOlimpicoFinish) onOlimpicoFinish(score);
        }
    }, [gameState, modoOlimpico, score, onOlimpicoFinish]);
    // ------------------------------------------
    const [lives, setLives] = useState(3);
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [levelInfo, setLevelInfo] = useState({ current: 1, total: 1, name: '' });
    // --- NUEVOS ESTADOS PARA RANKING Y GUARDADO ---
    const [verRanking, setVerRanking] = useState(false);
    const [nombreInvitado, setNombreInvitado] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [yaGuardado, setYaGuardado] = useState(false);
    const [hojaJugada, setHojaJugada] = useState('General');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const lastModeRef = useRef({ modo: 'SIMPLE', hoja: null }); // Recuerda el último modo jugado
    const [progreso, setProgreso] = useState({ n: 0, total: 0 });
    // Tamaño del canvas en pantalla: cabe entero en el hueco libre (móvil, tablet, PDI, media pantalla dual)
    const zonaRef = useRef(null);
    const [tamCanvas, setTamCanvas] = useState({ w: 800, h: 400 });
    const ladoDual = ladoMitadDual();




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
        lastModeRef.current = { modo, hoja: nombreHoja }; // Guardar para reiniciar
        setHojaJugada(nombreHoja || 'General');
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
        gameRef.current.vidas = 3;
        setLives(3);
        setScore(0);
        cargarNivel(0);
    };

    const cargarNivel = (levelIndex) => {
        const levelData = gameRef.current.levelsQueue[levelIndex];
        gameRef.current.allQuestions = levelData.questions;
        gameRef.current.qIndex = 0;
        gameRef.current.activo = false; // el bucle deja de jugar hasta el «¡VAMOS!»
        gameRef.current.obstacles = [];
        gameRef.current.pikatron.y = 0;   // entra cayendo desde arriba
        gameRef.current.pikatron.vy = 0;
        gameRef.current.pikatron.jumping = true;
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
                gameRef.current.activo = false;
                setGameState('WIN');
            }
            return;
        }
        setProgreso({ n: index + 1, total: questions.length });

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
    // La lógica avanza a 60 pasos por segundo fijos (en pantallas de 120/144 Hz el juego no va
    // más rápido) y se dibuja una vez por fotograma.
    useEffect(() => {
        if (gameState !== 'PLAYING') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = 800, H = 400;
        canvas.width = W;
        canvas.height = H;
        const groundLevel = H - 50;
        const G = gameRef.current;
        G.activo = true;

        const sprite = new Image(); sprite.src = pikatronImg;
        const coinSprite = new Image(); coinSprite.src = coinImgFile;
        const currentTheme = LEVEL_THEMES[G.currentLevelIdx % LEVEL_THEMES.length];
        const bgImg = new Image(); bgImg.src = currentTheme.img;

        const pika = G.pikatron;
        pika.groundY = groundLevel - pika.height;
        if (pika.y > pika.groundY) pika.y = pika.groundY;

        // Efectos: chispas, textos flotantes, temblor y destello
        const fx = { parts: [], textos: [], shake: 0, flash: null, groundX: 0 };
        const chispas = (x, y, n, colores, fuerza = 5) => {
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, v = (0.35 + Math.random()) * fuerza;
                const vida = 30 + Math.random() * 30;
                fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, vida, max: vida, color: colores[i % colores.length], r: 2 + Math.random() * 3 });
            }
        };
        const textoFlotante = (x, y, txt, color) => fx.textos.push({ x, y, txt, color, vida: 55 });

        const update = () => {
            if (!G.activo) return;
            G.frame++;
            G.bgX = (G.bgX - G.speed * 0.5) % W;
            fx.groundX = (fx.groundX - G.speed) % 40;

            // 1. PIKATRON (salto y gravedad)
            const gravity = G.speed < 6 ? 0.25 : 0.4;
            if (pika.y < pika.groundY || pika.vy < 0) {
                pika.y += pika.vy;
                pika.vy += gravity;
                if (pika.y >= pika.groundY) {
                    pika.y = pika.groundY; pika.vy = 0; pika.jumping = false;
                    pika.squash = 8;
                    chispas(pika.x + pika.width / 2, groundLevel - 2, 7, ['rgba(255,255,255,0.8)', 'rgba(220,220,220,0.6)'], 2.2);
                }
            } else {
                pika.y = pika.groundY; pika.vy = 0; pika.jumping = false;
            }
            if (pika.squash > 0) pika.squash--;
            // polvo al correr
            if (!pika.jumping && G.frame % 7 === 0) {
                fx.parts.push({ x: pika.x + 22, y: groundLevel - 4, vx: -1.5 - Math.random(), vy: -0.6 - Math.random() * 0.6, vida: 22, max: 22, color: 'rgba(255,255,255,0.55)', r: 2 + Math.random() * 2.5 });
            }
            if (G.frame % 10 === 0) {
                if (pika.jumping) {
                    pika.frameX = 1; pika.frameY = 0;
                } else {
                    const runFrames = [[0, 0], [0, 1], [1, 1]];
                    const step = (G.frame / 10) % 3;
                    pika.frameX = runFrames[step][0];
                    pika.frameY = runFrames[step][1];
                }
            }

            // 2. CAJAS DE RESPUESTA
            const spawnRate = Math.floor(1100 / G.speed);
            G.spawnTimer++;
            if (G.spawnTimer > spawnRate) {
                const list = G.currentAnswers;
                if (list.length > 0) {
                    const nextData = list[G.nextAnswerIndex];
                    const color = BLOCK_COLORS[G.nextAnswerIndex % BLOCK_COLORS.length];
                    G.obstacles.push({
                        // Respuestas largas: caja algo más ancha (hasta 150 px)
                        x: W, y: groundLevel - 40, width: Math.min(150, 100 + Math.max(0, String(nextData?.text ?? '').length - 10) * 4), height: 40, data: nextData, color
                    });
                    G.nextAnswerIndex = (G.nextAnswerIndex + 1) % list.length;
                }
                G.spawnTimer = 0;
            }

            const paddingX = 25, paddingY = 20;
            for (const obs of G.obstacles) {
                obs.x -= G.speed;
                if (
                    pika.x + pika.width - paddingX > obs.x &&
                    pika.x + paddingX < obs.x + obs.width &&
                    pika.y + pika.height - paddingY > obs.y &&
                    pika.y + paddingY < obs.y + obs.height
                ) {
                    const cx = obs.x + obs.width / 2;
                    if (obs.data.isCorrect) {
                        playSound('RES_COR');
                        setScore(s => s + G.puntosAcierto);
                        chispas(cx, obs.y, 30, ['#f1c40f', '#2ecc71', '#ffffff'], 6.5);
                        textoFlotante(cx, obs.y - 14, `+${G.puntosAcierto}`, '#2ecc71');
                        fx.flash = { color: '46,204,113', vida: 14, max: 14 };
                        prepararSiguientePregunta(G.qIndex + 1);
                    } else {
                        G.obstacles = [];
                        G.vidas = (G.vidas ?? 3) - 1;
                        setLives(Math.max(0, G.vidas));
                        chispas(cx, obs.y + 10, 26, ['#e74c3c', '#c0392b', '#ffffff'], 6);
                        fx.shake = 16;
                        fx.flash = { color: '231,76,60', vida: 20, max: 20 };
                        if (G.vidas > 0) {
                            playSound('LOSE_LIFE');
                            setScore(s => Math.max(0, s - G.puntosFallo));
                            if (G.puntosFallo > 0) textoFlotante(cx, obs.y - 14, `-${G.puntosFallo}`, '#e74c3c');
                        } else {
                            playSound('GAMEOVER');
                            G.activo = false;
                            setGameState('GAMEOVER');
                        }
                    }
                    break; // la lista de cajas ha cambiado
                }
            }
            G.obstacles = G.obstacles.filter(obs => obs.x > -200);
            if (!G.activo) return;

            // 3. MONEDAS (pregunta especial: correctas +1, incorrectas −1)
            const special = G.specialPool;
            G.coinSpawnTimer++;
            if (G.coinSpawnTimer > 120 + Math.random() * 100) {
                let coinData = { isCorrect: true, text: '' };
                if (special && (special.correctas.length > 0 || special.incorrectas.length > 0)) {
                    let sacarCorrecta = Math.random() < 0.5;
                    if (!sacarCorrecta && special.incorrectas.length === 0) sacarCorrecta = true;
                    if (sacarCorrecta && special.correctas.length === 0) sacarCorrecta = false;
                    coinData = sacarCorrecta
                        ? { isCorrect: true, text: special.correctas[Math.floor(Math.random() * special.correctas.length)] }
                        : { isCorrect: false, text: special.incorrectas[Math.floor(Math.random() * special.incorrectas.length)] };
                }
                G.coins.push({
                    x: W,
                    y: groundLevel - 230 - (Math.random() * 60),
                    width: 70, height: 70,
                    data: coinData, active: true,
                });
                G.coinSpawnTimer = 0;
            }
            for (const coin of G.coins) {
                if (!coin.active) continue;
                coin.x -= G.speed * 0.5;
                if (
                    pika.x < coin.x + coin.width &&
                    pika.x + pika.width > coin.x &&
                    pika.y < coin.y + coin.height &&
                    pika.y + pika.height > coin.y
                ) {
                    coin.active = false;
                    const cx = coin.x + coin.width / 2, cy = coin.y + coin.height / 2;
                    if (coin.data.isCorrect) {
                        setScore(s => s + 1);
                        playSound('CORRECT');
                        chispas(cx, cy, 16, ['#f1c40f', '#ffe066', '#ffffff'], 4.5);
                        textoFlotante(cx, cy - 20, '+1', '#f1c40f');
                    } else {
                        setScore(s => Math.max(0, s - 1));
                        playSound('MON_INC');
                        chispas(cx, cy, 14, ['#e74c3c', '#7f8c8d'], 4);
                        textoFlotante(cx, cy - 20, '-1', '#e74c3c');
                        fx.shake = Math.max(fx.shake, 7);
                    }
                }
            }
            G.coins = G.coins.filter(c => c.x > -100 && c.active);

            // 4. EFECTOS
            for (const pt of fx.parts) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.22; pt.vida--; }
            fx.parts = fx.parts.filter(pt => pt.vida > 0);
            for (const t of fx.textos) { t.y -= 0.9; t.vida--; }
            fx.textos = fx.textos.filter(t => t.vida > 0);
            if (fx.shake > 0) fx.shake = fx.shake < 0.5 ? 0 : fx.shake * 0.86;
            if (fx.flash && --fx.flash.vida <= 0) fx.flash = null;
        };

        const draw = () => {
            ctx.save();
            ctx.clearRect(0, 0, W, H);
            if (fx.shake > 0.5) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

            // FONDO (dos copias que se desplazan)
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(-20, -20, W + 40, H + 40);
            if (bgImg.complete && bgImg.naturalWidth > 0) {
                ctx.drawImage(bgImg, G.bgX - 2, -10, W + 4, H + 20);
                ctx.drawImage(bgImg, G.bgX + W - 2, -10, W + 4, H + 20);
            }

            // SUELO con baldosas que corren
            ctx.fillStyle = currentTheme.ground;
            ctx.fillRect(-20, groundLevel, W + 40, 80);
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            for (let x = fx.groundX - 40; x < W + 40; x += 40) {
                ctx.fillRect(x, groundLevel + 10, 20, 16);
                ctx.fillRect(x + 20, groundLevel + 28, 20, 16);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.fillRect(-20, groundLevel, W + 40, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(-20, groundLevel + 4, W + 40, 3);

            // ENUNCIADO DE LA PREGUNTA ESPECIAL (fijo arriba, estilo videojuego)
            const special = G.specialPool;
            if (special && special.enunciado) {
                ctx.save();
                ctx.font = '900 26px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 6;
                ctx.strokeText(special.enunciado, W / 2, 16);
                ctx.fillStyle = '#f1c40f';
                ctx.fillText(special.enunciado, W / 2, 16);
                ctx.restore();
            }

            // MONEDAS
            for (const coin of G.coins) {
                if (!coin.active) continue;
                const cx = coin.x + coin.width / 2, cy = coin.y + coin.height / 2;
                const flota = Math.sin((G.frame + coin.x) * 0.08) * 4;
                // halo
                const halo = ctx.createRadialGradient(cx, cy + flota, 10, cx, cy + flota, coin.width * 0.75);
                halo.addColorStop(0, coin.data.text && !coin.data.isCorrect ? 'rgba(255,255,255,0.25)' : 'rgba(255,230,80,0.35)');
                halo.addColorStop(1, 'rgba(255,230,80,0)');
                ctx.fillStyle = halo;
                ctx.fillRect(cx - coin.width, cy - coin.height + flota, coin.width * 2, coin.height * 2);
                // sin texto la moneda gira; con texto queda de frente para poder leerlo
                const giro = coin.data.text ? 1 : Math.max(0.25, Math.abs(Math.cos((G.frame + coin.x) * 0.06)));
                const cw = coin.width * giro;
                if (coinSprite.complete && coinSprite.naturalWidth > 0) {
                    ctx.drawImage(coinSprite, cx - cw / 2, coin.y + flota, cw, coin.height);
                } else {
                    ctx.beginPath();
                    ctx.ellipse(cx, cy + flota, cw / 2, coin.height / 2, 0, 0, Math.PI * 2);
                    ctx.fillStyle = '#f1c40f';
                    ctx.fill();
                }
                if (coin.data.text) {
                    ctx.save();
                    ctx.fillStyle = 'black';
                    // El texto se encoge para caber dentro de la moneda (hasta 2 líneas)
                    dibujarAjustado(ctx, String(coin.data.text), cx, cy + flota + 2, coin.width - 14, coin.height - 20, { maxPx: 26, minPx: 10, maxLineas: 2 });
                    ctx.restore();
                }
            }

            // CAJAS DE RESPUESTA
            for (const obs of G.obstacles) {
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                rrPk(ctx, obs.x + 4, obs.y + 5, obs.width, obs.height, 8); ctx.fill();
                ctx.fillStyle = obs.color || '#3498db';
                rrPk(ctx, obs.x, obs.y, obs.width, obs.height, 8); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                rrPk(ctx, obs.x + 3, obs.y + 3, obs.width - 6, obs.height * 0.42, 6); ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 2.5;
                rrPk(ctx, obs.x, obs.y, obs.width, obs.height, 8); ctx.stroke();
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                dibujarAjustado(ctx, String(obs.data.text ?? ''), obs.x + obs.width / 2 + 1, obs.y + obs.height / 2 + 2, obs.width - 10, obs.height - 4, { maxPx: 18, minPx: 9, maxLineas: 2 });
                ctx.fillStyle = 'white';
                dibujarAjustado(ctx, String(obs.data.text ?? ''), obs.x + obs.width / 2, obs.y + obs.height / 2 + 1, obs.width - 10, obs.height - 4, { maxPx: 18, minPx: 9, maxLineas: 2 });
            }

            // SOMBRA + PIKATRON (se aplasta un poco al aterrizar)
            const alt = Math.max(0, pika.groundY - pika.y);
            const k = Math.max(0.35, 1 - alt / 260);
            ctx.fillStyle = `rgba(0,0,0,${0.32 * k})`;
            ctx.beginPath();
            ctx.ellipse(pika.x + pika.width / 2, groundLevel + 2, 34 * k, 7 * k, 0, 0, Math.PI * 2);
            ctx.fill();
            if (sprite.complete && sprite.naturalWidth > 0) {
                const sW = sprite.width / 2, sH = sprite.height / 2;
                const s = (pika.squash || 0) / 8;
                const dw = pika.width * (1 + 0.14 * s), dh = pika.height * (1 - 0.14 * s);
                ctx.drawImage(sprite, pika.frameX * sW, pika.frameY * sH, sW, sH, pika.x - (dw - pika.width) / 2, pika.y + (pika.height - dh), dw, dh);
            }

            // CHISPAS Y TEXTOS
            for (const pt of fx.parts) {
                ctx.globalAlpha = Math.max(0, pt.vida / pt.max);
                ctx.fillStyle = pt.color;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            for (const t of fx.textos) {
                ctx.globalAlpha = Math.min(1, t.vida / 20);
                ctx.font = '900 32px Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.strokeText(t.txt, t.x, t.y);
                ctx.fillStyle = t.color;
                ctx.fillText(t.txt, t.x, t.y);
            }
            ctx.globalAlpha = 1;
            ctx.restore();

            // DESTELLO (verde acierto, rojo fallo)
            if (fx.flash) {
                ctx.fillStyle = `rgba(${fx.flash.color},${0.35 * fx.flash.vida / fx.flash.max})`;
                ctx.fillRect(0, 0, W, H);
            }
        };

        let raf, last = performance.now(), acc = 0;
        const STEP = 1000 / 60;
        const frame = (t) => {
            acc += Math.min(200, t - last);
            last = t;
            let n = 0;
            while (acc >= STEP && n < 6) { update(); acc -= STEP; n++; }
            if (n === 6) acc = 0;
            draw();
            raf = requestAnimationFrame(frame);
        };
        draw();
        raf = requestAnimationFrame(frame);
        return () => { cancelAnimationFrame(raf); G.activo = false; };
    }, [gameState]);

    // Mandos micro:bit: puntos de la partida al mando que jugaba (con relevos, la siguiente la juega otro)
    useEffect(() => {
        if (gameState === 'WIN' || gameState === 'GAMEOVER' || gameState === 'TIMEOUT') mandosApi.current?.finPartida([score], { ganador: gameState === 'WIN' ? 0 : null });
    }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

    // Canvas a la medida del hueco libre (proporción 2:1)
    const hayCanvas = gameState !== 'SETUP';
    useEffect(() => {
        const el = zonaRef.current;
        if (!el) return undefined;
        const medir = () => {
            const r = el.getBoundingClientRect();
            const w = Math.max(240, Math.min(r.width, r.height * 2));
            setTamCanvas(t => (Math.abs(t.w - w) < 1 ? t : { w: Math.floor(w), h: Math.floor(w / 2) }));
        };
        medir();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
        ro?.observe(el);
        window.addEventListener('resize', medir);
        return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
    }, [hayCanvas]);

    // En pantalla dual: con el juego en marcha, W/A/S/D van a la mitad izquierda y las flechas a la derecha
    useEffect(() => {
        window.__piktModoAccion = gameState === 'PLAYING' || gameState === 'LEVEL_INTRO';
        return () => { window.__piktModoAccion = false; };
    }, [gameState]);

    // CONTROLES: saltar con Espacio / ↑ / W, clic de ratón, toque o lápiz
    const saltar = () => {
        const p = gameRef.current.pikatron;
        if (gameState === 'PLAYING' && gameRef.current.activo && !p.jumping) {
            playSound('JUMP');
            p.vy = -10;
            p.jumping = true;
        }
    };
    useEffect(() => {
        if (gameState !== 'PLAYING' && gameState !== 'LEVEL_INTRO') return undefined;
        const esSalto = (e) => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.key === ' ' || e.key === 'ArrowUp';
        const handleKeyDown = (e) => {
            if (e.target?.closest?.('input, textarea, select')) return;
            const enter = e.code === 'Enter' || e.code === 'NumpadEnter';
            if (!esSalto(e) && !(enter && gameState === 'LEVEL_INTRO')) return;
            e.preventDefault();
            // Que Espacio no «pulse» el último botón con foco (pantalla completa, salir…)
            if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur();
            if (gameState === 'LEVEL_INTRO') { if (!e.repeat) startLevelPlaying(); return; }
            saltar();
        };
        const handleKeyUp = (e) => { if (esSalto(e) && !e.target?.closest?.('input, textarea, select')) e.preventDefault(); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clic / toque en cualquier parte del juego (menos en botones y casillas)
    const alPulsar = (e) => {
        if (e.button > 0) return;
        if (e.target?.closest?.('button, input, select, textarea, a, label')) return;
        if (gameState === 'PLAYING') { if (e.pointerType !== 'mouse') e.preventDefault(); saltar(); }
        else if (gameState === 'LEVEL_INTRO') startLevelPlaying();
    };

    const reiniciarJuegoCompleto = () => {
        setLives(3);
        setScore(0);
        setYaGuardado(false);      // Permite volver a guardar en la siguiente partida
        setNombreInvitado('');     // Limpia el nombre del formulario
        const { modo, hoja } = lastModeRef.current;
        iniciarPartida(modo, hoja); // Repite el mismo modo y hoja que se estaba jugando
    };
    // Mandos micro:bit: también en el menú, para conectarlos y elegir quién juega antes de empezar
    const mandosUI = !modoOlimpico && (
        <MandosEnJuego clave="PIKATRON" juego="Pikatron" tipo="PIKATRON_MANDOS" apiRef={mandosApi}
            teclas={[{ A: ' ', B: ' ', F: 'ArrowUp', S: ' ' }]}
            pausado={gameState === 'SETUP'}
            onEvento={(i, ev) => { if (gameState === 'LEVEL_INTRO' && ev.accion === 'S') startLevelPlaying(); }}
            controles={<><b>A</b>, <b>B</b>, agitar o inclinar hacia delante = saltar. En la pantalla de nivel, <b>agita</b> para empezar.</>} />
    );
    // SI ESTAMOS EN SETUP, MOSTRAMOS EL MENÚ Y EL RANKING SI TOCA
    if (gameState === 'SETUP') return (
        <>
            {mandosUI}
            <PantallaSetup
                recurso={recurso}
                onStart={iniciarPartida}
                onExit={onExit}
                onRanking={() => setVerRanking(true)}
                ladoDual={ladoDual}
            />
            {/* Si se pulsó el botón, mostramos el ranking encima */}
            {verRanking && <PantallaRanking recurso={recurso} onBack={() => setVerRanking(false)} />}
        </>
    );

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(err => {
                console.log(`Error al intentar pantalla completa: ${err.message}`);
            });
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
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
            guardarRegistroLocal('PIKATRON', {
                titulo: recurso.titulo, aciertos: score,
                nombre: nombreFinal, via: 'ranking',
            });
            setYaGuardado(true);
            alert("¡Puntuación guardada correctamente!");
        } catch (error) {
            console.error("Error guardando:", error);
            alert("Hubo un error al guardar.");
        }
        setGuardando(false);
    };

    const pista = ladoDual === 0 ? 'Tecla W, clic o toque = saltar'
        : ladoDual === 1 ? 'Flecha ↑, clic o toque = saltar'
            : 'Espacio / ↑, clic o toque = saltar';
    const chip = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)' };

    return (
        <>
            {mandosUI}
            <div className="pk-root" onPointerDown={alPulsar} style={{
                position: 'relative',
                width: '100%',
                background: 'radial-gradient(ellipse at 50% 20%, #34495e 0%, #1b2631 55%, #0e1318 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 10px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                touchAction: gameState === 'PLAYING' ? 'none' : 'manipulation',
                userSelect: 'none', WebkitUserSelect: 'none',
                fontFamily: "'Segoe UI', system-ui, sans-serif",
            }}>
                <EstilosPk />

                {/* 1. MARCADOR: vidas, nivel, progreso, puntos, reloj y botones */}
                {gameState !== 'LEVEL_INTRO' && (
                    <div style={{
                        width: '100%', maxWidth: tamCanvas.w, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        // a la izquierda queda el botón 🏠 de la página (fuera de la pantalla dual)
                        paddingLeft: ladoDual === null ? 52 : 0, boxSizing: 'border-box', marginBottom: 6, flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                            {[...Array(3)].map((_, i) => (
                                <Heart key={i} size={28} fill={i < lives ? '#e74c3c' : '#2c3e50'} color={i < lives ? '#c0392b' : '#4a5a6a'}
                                    style={{ filter: i < lives ? 'drop-shadow(0 0 3px #e74c3c)' : 'none', transition: 'all 0.3s', transform: i < lives ? 'scale(1)' : 'scale(0.85)' }} />
                            ))}
                        </div>
                        {gameRef.current.levelsQueue.length > 1 && (
                            <span style={{ ...chip, background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid #556', fontSize: '0.85rem' }}>
                                🗺 {levelInfo.current}/{levelInfo.total}
                            </span>
                        )}
                        {progreso.total > 0 && (
                            <div title="Preguntas" style={{ flex: '1 1 90px', minWidth: 70, maxWidth: 220, height: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <div style={{ width: `${((progreso.n - 1) / progreso.total) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#2ecc71,#f1c40f)', transition: 'width 0.4s' }} />
                            </div>
                        )}
                        {progreso.total > 0 && <span style={{ color: '#bdc3c7', fontWeight: 700, fontSize: '0.85rem' }}>{progreso.n}/{progreso.total}</span>}
                        <span style={{ flex: 1 }} />
                        {modoOlimpico && <span style={{ ...chip, background: '#e74c3c', color: 'white' }}>⏱ {tiempoRestante}s</span>}
                        <span key={score} style={{ ...chip, background: '#f1c40f', color: '#2c3e50', animation: 'pkLatido 0.35s ease-out' }}>⭐ {score}</span>
                        {!esMitadDual() && (
                            <button onClick={toggleFullScreen} title="Pantalla completa" className="pk-icono">
                                <Maximize size={20} />
                            </button>
                        )}
                        {!modoOlimpico && (
                            <button onClick={onExit} title="Salir del juego" className="pk-icono" style={{ background: 'rgba(231,76,60,0.2)', borderColor: 'rgba(231,76,60,0.6)' }}>
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}

                {/* 2. PREGUNTA */}
                {gameState !== 'LEVEL_INTRO' && preguntaActual && (
                    <div key={preguntaActual} className="pk-pregunta" style={{
                        width: '100%', maxWidth: tamCanvas.w, boxSizing: 'border-box', flexShrink: 0,
                        background: 'linear-gradient(180deg,#ffffff,#eef2f5)', color: '#2c3e50', borderRadius: 14,
                        padding: '8px 16px', marginBottom: 8, textAlign: 'center', fontWeight: 800, lineHeight: 1.2,
                        borderBottom: '4px solid #bdc3c7', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                        fontSize: letraAjustada('clamp(16px, 3vw, 26px)', preguntaActual, 110, 0.7),
                    }}>
                        {preguntaActual}
                    </div>
                )}

                {/* 3. CANVAS: ocupa todo el hueco libre manteniendo la proporción */}
                <div ref={zonaRef} style={{ flex: 1, minHeight: 120, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <canvas ref={canvasRef} width={800} height={400} style={{
                        width: tamCanvas.w, height: tamCanvas.h, display: 'block',
                        backgroundColor: '#87CEEB',
                        borderRadius: 14,
                        border: '3px solid #34495e',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
                        touchAction: 'none',
                        cursor: gameState === 'PLAYING' ? 'pointer' : 'default',
                    }} />
                </div>

                {gameState === 'PLAYING' && (
                    <div style={{ color: '#8b98a5', marginTop: 6, fontSize: 13, flexShrink: 0, textAlign: 'center' }}>
                        🏃 Choca con la respuesta correcta y salta las demás · <b style={{ color: '#c9d4de' }}>{pista}</b>
                    </div>
                )}

                {/* PANTALLA RANKING (ENCIMA DE TODO) */}
                {verRanking && <PantallaRanking recurso={recurso} onBack={() => setVerRanking(false)} />}

                {gameState === 'LEVEL_INTRO' && (
                    <div style={overlayStyle}>
                        <div style={centroOverlay}>
                            <h2 style={{ color: '#2ecc71', fontSize: 'clamp(1.2rem, 3.5vw, 2rem)', letterSpacing: '5px', textTransform: 'uppercase', margin: 0 }}>PANTALLA {levelInfo.current}</h2>
                            <h1 style={{ fontSize: 'clamp(2rem, 7vw, 4rem)', fontFamily: 'monospace', color: '#f1c40f', textShadow: '4px 4px #c0392b', margin: '16px 0', textAlign: 'center', wordBreak: 'break-word' }}>{levelInfo.name}</h1>
                            <div style={{ width: '60%', height: '6px', background: '#555', margin: '14px 0', borderRadius: '5px' }}>
                                <div style={{ width: `${(levelInfo.current / levelInfo.total) * 100}%`, height: '100%', background: '#f1c40f', borderRadius: '5px', transition: 'width 0.5s' }}></div>
                            </div>
                            <div className="pk-sprite" style={{ margin: '6px 0 0' }} />
                            <button onClick={startLevelPlaying} className="pk-btn" style={{ ...btnStyle, maxWidth: 320, marginTop: 18 }}><Play size={24} /> ¡VAMOS!</button>
                            <div style={{ color: '#95a5a6', marginTop: 12, fontSize: 13, textAlign: 'center' }}>
                                o pulsa {ladoDual === 0 ? 'W' : ladoDual === 1 ? '↑' : 'Espacio'} / toca la pantalla
                            </div>
                        </div>
                    </div>
                )}

                {(gameState === 'GAMEOVER' || gameState === 'WIN' || gameState === 'TIMEOUT') && (
                    <div style={overlayStyle}>
                        <div style={centroOverlay}>
                            {gameState === 'WIN' && <Trophy size={72} color="#f1c40f" style={{ marginBottom: 14, filter: 'drop-shadow(0 0 12px #f1c40f)' }} />}
                            {gameState === 'GAMEOVER' && <AlertTriangle size={72} color="#e74c3c" style={{ marginBottom: 14 }} />}

                            <h1 style={{ color: gameState === 'WIN' ? '#f1c40f' : '#e74c3c', fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontFamily: 'monospace', textShadow: '3px 3px 0px #fff', margin: 0, textAlign: 'center' }}>
                                {gameState === 'WIN' ? '¡COMPLETADO!' : gameState === 'TIMEOUT' ? '¡TIEMPO AGOTADO!' : 'GAME OVER'}
                            </h1>

                            <div style={{ background: '#333', padding: '10px 30px', borderRadius: 10, margin: '18px 0', fontSize: '1.5rem', border: '2px solid #555' }}>
                                Puntuación: <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>{score}</span>
                            </div>

                            {/* --- ZONA DE GUARDADO (SOLO MODO NORMAL) --- */}
                            {!modoOlimpico ? (
                                <>
                                    {!yaGuardado ? (
                                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '18px', borderRadius: '15px', width: '100%', maxWidth: '350px', marginBottom: '14px', boxSizing: 'border-box' }}>
                                            {(!usuario || !usuario.email) ? (
                                                <>
                                                    <p style={{ margin: '0 0 10px 0', color: '#ccc', fontSize: '0.9rem' }}>Introduce tu nombre para el ranking:</p>
                                                    <input value={nombreInvitado} onChange={e => setNombreInvitado(e.target.value)} placeholder="Tu Nombre" maxLength={15} style={{ padding: '10px', borderRadius: '5px', border: 'none', width: '100%', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }} />
                                                </>
                                            ) : (
                                                <p style={{ color: '#2ecc71', fontWeight: 'bold', marginBottom: '15px' }}>Usuario: {usuario.displayName}</p>
                                            )}
                                            <button onClick={guardarPuntuacion} style={{ ...btnStyle, marginTop: 0, background: '#3498db', boxShadow: '0 5px 0 #2471a3', fontSize: '1rem', padding: '10px' }} disabled={guardando}>
                                                {guardando ? 'Guardando...' : <><Save size={18} /> Guardar Puntuación</>}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ color: '#2ecc71', fontWeight: 'bold', marginBottom: '16px', fontSize: '1.2rem' }}>✅ ¡Puntuación Guardada!</div>
                                    )}

                                    <div style={{ width: '100%', maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <button onClick={() => setMostrarEnvio(true)} className="pk-btn" style={{ ...btnStyle, marginTop: 0, background: 'linear-gradient(135deg,#27ae60,#2ecc71)' }}>
                                            📤 Enviar al profesor
                                        </button>
                                        <button onClick={reiniciarJuegoCompleto} className="pk-btn" style={{ ...btnStyle, marginTop: 0, background: '#e74c3c', boxShadow: '0 5px 0 #a93226' }}><RefreshCw size={24} /> REINICIAR</button>
                                    </div>
                                    <button onClick={onExit} style={{ marginTop: 16, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1rem' }}>Salir</button>
                                    {mostrarEnvio && (
                                        <ModalEnviarProfe
                                            datos={{ recursoId: recurso.id, recursoTitulo: recurso.titulo, hoja: hojaJugada, aciertos: score }}
                                            onClose={() => setMostrarEnvio(false)}
                                        />
                                    )}
                                </>
                            ) : (
                                <div style={{ color: '#2ecc71', fontWeight: 'bold', marginTop: '20px', fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>
                                    Enviando puntos al profesor... 🚀
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// Estilos comunes de las pantallas de Pikatron
function EstilosPk() {
    return <style>{`
        .pk-root { height: 100vh; height: 100dvh; }
        .setup-card { background: rgba(30, 44, 58, 0.94); padding: clamp(20px, 4vw, 36px); border-radius: 22px; width: 100%; max-width: 420px; box-sizing: border-box; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.55); display: flex; flex-direction: column; align-items: center; border: 1px solid rgba(255,255,255,0.12); margin: auto; backdrop-filter: blur(4px); }
        .pk-pregunta { animation: pkPop 0.28s ease-out; }
        .pk-btn { transition: transform 0.08s, filter 0.15s; }
        .pk-btn:hover { filter: brightness(1.08); }
        .pk-btn:active { transform: translateY(3px); }
        .pk-icono { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
        .pk-icono:hover { background: rgba(255,255,255,0.22); }
        .pk-sprite { width: 96px; height: 96px; background-image: url(${pikatronImg}); background-size: 200% 200%; background-position: 0 0; background-repeat: no-repeat; animation: pkBob 1.2s ease-in-out infinite; filter: drop-shadow(0 8px 6px rgba(0,0,0,0.4)); }
        @keyframes pkPop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pkBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pkLatido { 0% { transform: scale(1); } 35% { transform: scale(1.25); } 100% { transform: scale(1); } }
    `}</style>;
}

function rrPk(ctx, x, y, w, h, r = 6) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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
        <div style={{ ...overlayStyle, position: 'fixed', zIndex: 3000 }}>
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
// Enlace de competición (&comp=…&cat=…): la puntuación va a esa prueba, no al profesor
function ModalEnviarProfe(p) {
    const comp = leerCompeticionUrl();
    if (comp) return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.datos?.aciertos) || 0}
        detalle={soloPrimitivos(p.datos)} nombreJuego="Pikatron" tituloReto={comp.titulo} onClose={p.onClose} />;
    return <ModalEnviarProfeBase {...p} />;
}

function ModalEnviarProfeBase({ datos, onClose }) {
    const [codigo, setCodigo]   = useState('');
    const [nombre, setNombre]   = useState('');
    const [curso,  setCurso]    = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!validarNombre(nombre).ok) { setError(validarNombre(nombre).mensaje); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'PIKATRON', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
                hoja: datos.hoja, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, fallos: 0, hoja: datos.hoja }],
            });
            guardarRegistroLocal('PIKATRON', {
                titulo: datos.recursoTitulo, aciertos: datos.aciertos,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
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
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>{datos.aciertos} puntos</div>
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

function PantallaSetup({ recurso, onStart, onExit, onRanking, ladoDual = null }) {
    const [hoja, setHoja] = useState('General');
    const hojas = recurso.hojas || [];
    const teclas = ladoDual === 0 ? 'W' : ladoDual === 1 ? '↑' : 'Espacio o ↑';
    return (
        <div className="pk-root" style={{
            width: '100%', display: 'flex', overflowY: 'auto', boxSizing: 'border-box', padding: 16,
            background: `linear-gradient(rgba(10,16,28,0.55), rgba(10,16,28,0.88)), url(${bg1}) center / cover no-repeat, #1b2631`,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
            <EstilosPk />
            <div className="setup-card">
                <div className="pk-sprite" />
                <h1 style={{ color: '#f1c40f', fontFamily: 'monospace', fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', textShadow: '3px 3px #c0392b', margin: '8px 0 0' }}>PIKATRON RUN</h1>
                <h2 style={{ color: 'white', fontSize: '1.1rem', margin: '6px 0 16px', fontWeight: 'normal', wordBreak: 'break-word' }}>{recurso.titulo}</h2>

                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', color: '#d5dde5', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: 18, width: '100%', boxSizing: 'border-box' }}>
                    🏃 <b>Choca</b> con la caja de la respuesta correcta y <b>salta</b> las incorrectas.<br />
                    Saltar: <b>{teclas}</b>, clic o toque en la pantalla.
                </div>

                {hojas.length > 0 && (
                    <div style={{ marginBottom: '18px', textAlign: 'left', width: '100%' }}>
                        <label style={{ display: 'block', marginBottom: '5px', color: '#ccc', fontWeight: 'bold' }}>Elige pantalla:</label>
                        <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '1rem', background: 'white', color: '#333', cursor: 'pointer' }}>
                            <option value="General">Mezcla General</option>
                            {hojas.map(h => <option key={h.nombreHoja} value={h.nombreHoja}>{h.nombreHoja}</option>)}
                        </select>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                    <button onClick={() => onStart('SIMPLE', hoja)} className="pk-btn" style={{ ...btnStyle, marginTop: 0, background: '#3498db', boxShadow: '0 5px 0 #2471a3' }}><Play size={20} /> JUGAR NIVEL</button>
                    {hojas.length > 1 && (
                        <button onClick={() => onStart('RETO')} className="pk-btn" style={{ ...btnStyle, marginTop: 0, background: '#e74c3c', boxShadow: '0 5px 0 #a93226' }}><Map size={20} /> MODO RETO (todas las pantallas)</button>
                    )}
                    <button onClick={onRanking} className="pk-btn" style={{ ...btnStyle, marginTop: 0, background: '#8e44ad', boxShadow: '0 5px 0 #6c3483' }}>
                        <Trophy size={20} /> VER RANKING
                    </button>
                    <BotonPantallaDual recurso={recurso} modo="PIKATRON" style={{ marginBottom: 0, borderRadius: 50 }} />
                </div>

                {ladoDual === null && (
                    <button onClick={onExit} style={{ marginTop: '24px', background: 'none', border: '1px solid #667', padding: '10px 22px', color: '#aab', borderRadius: '20px', cursor: 'pointer' }}>Volver</button>
                )}
            </div>
        </div>
    );
}

const overlayStyle = { position: 'absolute', inset: 0, background: 'rgba(8,12,18,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white', zIndex: 2000, overflowY: 'auto', padding: 20, boxSizing: 'border-box' };
// Centrado que no corta la parte de arriba cuando el contenido no cabe (se desplaza)
const centroOverlay = { margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 520 };
const btnStyle = { padding: '14px 26px', fontSize: '1.15rem', background: '#2ecc71', color: 'white', border: 'none', borderRadius: 50, cursor: 'pointer', display: 'flex', gap: 10, marginTop: 30, fontWeight: 'bold', boxShadow: '0 5px 0 #27ae60', alignItems: 'center', justifyContent: 'center', width: '100%' };
