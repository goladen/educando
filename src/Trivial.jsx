import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dices, Trophy, ArrowLeft, Timer, Users, Play, Maximize2, Minimize2 } from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import PREGUNTAS_JSON from './preguntas_trivial.json';
import PREGUNTAS_PRIMARIA from './preguntas_trivial_primaria.json';
import PREGUNTAS_SUPER from './preguntas_trivial_super.json';
import correctSound from './assets/correct-choice-43861.mp3';
import wrongSound from './assets/negative_beeps-6008.mp3';
import Confetti from 'react-confetti';

// ─── SONIDOS ──────────────────────────────────────────────────────────────────
// Preload so the browser doesn't block on first interaction
const _correctAudio = new Audio(correctSound);
const _wrongAudio   = new Audio(wrongSound);

const playCorrectSound = () => {
    try { _correctAudio.currentTime = 0; _correctAudio.play().catch(() => {}); } catch(e) {}
};
const playWrongSound = () => {
    try { _wrongAudio.currentTime = 0; _wrongAudio.play().catch(() => {}); } catch(e) {}
};

// Dice roll: procedural noise bursts via Web Audio (no asset needed)
const playDiceSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        for (let i = 0; i < 7; i++) {
            const delay = i * 0.09;
            const bufSize = Math.floor(ctx.sampleRate * 0.045);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
                data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufSize * 0.35));
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.28 - i * 0.02, ctx.currentTime + delay);
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start(ctx.currentTime + delay);
        }
    } catch(e) {}
};

const playJumpSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
};

// ─── DADO SVG ─────────────────────────────────────────────────────────────────
const DICE_DOTS = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
    6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

function DiceFace({ value, rolling, size = 62 }) {
    const positions = DICE_DOTS[value] || [];
    return (
        <svg
            width={size} height={size} viewBox="0 0 100 100"
            style={{
                filter: rolling
                    ? 'drop-shadow(0 0 10px #38bdf8) drop-shadow(0 0 4px #7dd3fc)'
                    : value
                        ? 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))'
                        : 'none',
                animation: rolling ? 'diceSpin 0.12s linear infinite' : 'none',
                display: 'block',
            }}
        >
            <defs>
                <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
            </defs>
            <rect x="5" y="5" width="90" height="90" rx="18" ry="18"
                fill={rolling ? '#0f172a' : 'url(#dg)'}
                stroke={rolling ? '#38bdf8' : '#94a3b8'}
                strokeWidth="2.5"
            />
            {positions.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="9"
                    fill={rolling ? '#38bdf8' : '#1e293b'}
                />
            ))}
        </svg>
    );
}

// Inject keyframe once
if (typeof document !== 'undefined' && !document.getElementById('trivial-dice-css')) {
    const s = document.createElement('style');
    s.id = 'trivial-dice-css';
    s.textContent = `
        @keyframes diceSpin {
            0%   { transform: rotate(-12deg) scale(1.08); }
            50%  { transform: rotate(12deg)  scale(0.94); }
            100% { transform: rotate(-12deg) scale(1.08); }
        }
        @keyframes diceLand {
            0%   { transform: scale(1.35) rotate(-6deg); }
            60%  { transform: scale(0.9)  rotate(3deg);  }
            100% { transform: scale(1)    rotate(0deg);  }
        }
        @keyframes heartRise {
            0%   { transform: translateY(0)      rotate(0deg)   scale(1);    opacity: 1; }
            80%  { opacity: 0.7; }
            100% { transform: translateY(-105vh) rotate(25deg)  scale(0.6);  opacity: 0; }
        }
        @keyframes heartSway {
            0%,100% { margin-left: 0; }
            33%     { margin-left: 18px; }
            66%     { margin-left: -14px; }
        }
        @keyframes trophyDrop {
            0%   { transform: translateY(-80px) scale(0.5); opacity: 0; }
            60%  { transform: translateY(12px)  scale(1.15); opacity: 1; }
            80%  { transform: translateY(-6px)  scale(0.97); }
            100% { transform: translateY(0)     scale(1); opacity: 1; }
        }
        @keyframes winnerSlide {
            0%   { transform: translateY(40px); opacity: 0; }
            100% { transform: translateY(0);    opacity: 1; }
        }
        @keyframes starSpin {
            from { transform: rotate(0deg) scale(1); }
            to   { transform: rotate(360deg) scale(1.2); }
        }
        @keyframes cardIn {
            0%   { transform: translateX(-30px); opacity: 0; }
            100% { transform: translateX(0);     opacity: 1; }
        }
    `;
    document.head.appendChild(s);
}

// ─── CORAZONES ────────────────────────────────────────────────────────────────
const HEART_EMOJIS = ['❤️','💖','💕','💗','💓','🧡','💛','💚','💙','💜','🤍','💝'];
const HEARTS_DATA = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    emoji: HEART_EMOJIS[i % HEART_EMOJIS.length],
    left: 2 + (i * 97 / 35),           // spread evenly across width
    size: 18 + Math.sin(i * 1.7) * 14, // 18–32px varied sizes
    delay: (i * 0.18) % 5,             // stagger delays
    duration: 4 + Math.cos(i * 0.9) * 1.5, // 2.5–5.5s
}));

// ─── PANTALLA COMPLETA ────────────────────────────────────────────────────────
function FullscreenBtn({ bottom = 20, right = 16 }) {
    const [isFull, setIsFull] = useState(false);

    useEffect(() => {
        const onChange = () => setIsFull(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggle = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    return (
        <button
            onClick={toggle}
            title={isFull ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
                position: 'fixed',
                bottom,
                right,
                zIndex: 9998,
                background: 'rgba(15,23,42,0.82)',
                border: '1px solid #475569',
                color: '#94a3b8',
                width: 36, height: 36,
                borderRadius: 9,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#475569'; }}
        >
            {isFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
    );
}

function HeartsEffect() {
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
            {HEARTS_DATA.map(h => (
                <div
                    key={h.id}
                    style={{
                        position: 'absolute',
                        bottom: '-40px',
                        left: `${h.left}%`,
                        fontSize: `${h.size}px`,
                        lineHeight: 1,
                        animation: `heartRise ${h.duration}s ease-in ${h.delay}s infinite,
                                    heartSway ${h.duration * 0.7}s ease-in-out ${h.delay}s infinite`,
                        willChange: 'transform, opacity',
                    }}
                >
                    {h.emoji}
                </div>
            ))}
        </div>
    );
}

// ─── 1. BASE DE DATOS Y CONFIGURACIÓN ──────────────────────────────────────────
const COLORS = [
    { id: 'geo', hex: '#3498db', name: 'Geografía',    emoji: '🌍' },
    { id: 'esp', hex: '#e84393', name: 'Espectáculos', emoji: '🎬' },
    { id: 'his', hex: '#f1c40f', name: 'Historia',     emoji: '📜' },
    { id: 'art', hex: '#9b59b6', name: 'Arte y Lit.',  emoji: '🎨' },
    { id: 'cie', hex: '#2ecc71', name: 'Ciencias',     emoji: '🔬' },
    { id: 'dep', hex: '#e67e22', name: 'Deportes',     emoji: '⚽' },
];

const PREGUNTAS = {
    'geo': [
        { q: '¿Cuál es el río más largo del mundo?', a: 'Amazonas', w: ['Nilo', 'Yangtsé', 'Misisipi'] },
        { q: '¿Cuál es la capital de Australia?', a: 'Canberra', w: ['Sídney', 'Melbourne', 'Perth'] }
    ],
    'esp': [
        { q: '¿Qué superhéroe es conocido como el Hombre Murciélago?', a: 'Batman', w: ['Spiderman', 'Iron Man', 'Superman'] },
        { q: '¿En qué película aparece el personaje de Darth Vader?', a: 'Star Wars', w: ['Star Trek', 'Dune', 'Matrix'] }
    ],
    'his': [
        { q: '¿En qué año llegó Colón a América?', a: '1492', w: ['1402', '1512', '1482'] },
        { q: '¿Quién fue el primer emperador romano?', a: 'Augusto', w: ['Julio César', 'Nerón', 'Calígula'] }
    ],
    'art': [
        { q: '¿Quién escribió Don Quijote de la Mancha?', a: 'Miguel de Cervantes', w: ['Lope de Vega', 'Góngora', 'Quevedo'] },
        { q: '¿Quién pintó La Gioconda?', a: 'Da Vinci', w: ['Picasso', 'Van Gogh', 'Dalí'] }
    ],
    'cie': [
        { q: '¿Cuál es el planeta rojo?', a: 'Marte', w: ['Júpiter', 'Venus', 'Saturno'] },
        { q: '¿Cuál es la fórmula química del agua?', a: 'H2O', w: ['CO2', 'O2', 'NaCl'] }
    ],
    'dep': [
        { q: '¿Cuántos jugadores hay en un equipo de baloncesto en cancha?', a: '5', w: ['6', '7', '4'] },
        { q: '¿Cada cuántos años se celebran los Juegos Olímpicos?', a: '4', w: ['2', '3', '5'] }
    ]
};

// Paleta ampliada para 6 jugadores
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

// Helper para rectángulos redondeados en canvas
function drawRoundRect(ctx, x, y, w, h, r) {
    const R = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + R, y);
    ctx.arcTo(x + w, y,     x + w, y + h, R);
    ctx.arcTo(x + w, y + h, x,     y + h, R);
    ctx.arcTo(x,     y + h, x,     y,     R);
    ctx.arcTo(x,     y,     x + w, y,     R);
    ctx.closePath();
}

// ─── 2. LÓGICA DEL MOTOR (GRAFO Y TABLERO) ───────────────────────────────────
class Node {
    constructor(id, x, y, type, colorObj) {
        this.id = id; this.x = x; this.y = y; this.type = type;
        this.color = colorObj; this.links = new Set();
    }
    addLink(node) { this.links.add(node); node.links.add(this); }
}

class TrivialBoard {
    constructor(cx, cy, radius) {
        this.nodes = new Map();
        this.cx = cx; this.cy = cy; this.radius = radius;
        this.buildGraph();
    }
    buildGraph() {
        const center = new Node('center', this.cx, this.cy, 'center', { hex: '#ffffff', name: 'Centro' });
        this.nodes.set('center', center);
        const NUM_SPOKES = 6, NODES_PER_SPOKE = 5, NODES_PER_OUTER = 5;
        const wedges = [];

        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = (i * Math.PI * 2) / NUM_SPOKES - (Math.PI / 2);
            let prevNode = center;
            for (let j = 1; j <= NODES_PER_SPOKE; j++) {
                const r = (this.radius / (NODES_PER_SPOKE + 1)) * j;
                const x = this.cx + r * Math.cos(angle);
                const y = this.cy + r * Math.sin(angle);
                const node = new Node(`s_${i}_${j}`, x, y, 'normal', COLORS[(i + j) % COLORS.length]);
                this.nodes.set(node.id, node); prevNode.addLink(node); prevNode = node;
            }
            const wx = this.cx + this.radius * Math.cos(angle);
            const wy = this.cy + this.radius * Math.sin(angle);
            const wedgeNode = new Node(`w_${i}`, wx, wy, 'wedge', COLORS[i]);
            this.nodes.set(wedgeNode.id, wedgeNode); prevNode.addLink(wedgeNode); wedges.push(wedgeNode);
        }

        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle1 = (i * Math.PI * 2) / NUM_SPOKES - (Math.PI / 2);
            const angle2 = ((i + 1) * Math.PI * 2) / NUM_SPOKES - (Math.PI / 2);
            let prevNode = wedges[i];
            for (let j = 1; j <= NODES_PER_OUTER; j++) {
                const a = angle1 + (angle2 - angle1) * (j / (NODES_PER_OUTER + 1));
                const x = this.cx + this.radius * Math.cos(a);
                const y = this.cy + this.radius * Math.sin(a);
                const node = new Node(`o_${i}_${j}`, x, y, 'normal', COLORS[(i + j + 2) % COLORS.length]);
                this.nodes.set(node.id, node); prevNode.addLink(node); prevNode = node;
            }
            prevNode.addLink(wedges[(i + 1) % NUM_SPOKES]);
        }
    }
    getValidDestinations(startNode, steps) {
        let paths = [[startNode]];
        for (let step = 0; step < steps; step++) {
            let nextPaths = [];
            for (let p of paths) {
                let current = p[p.length - 1];
                for (let neighbor of current.links) {
                    if (p.length > 1 && p[p.length - 2] === neighbor) continue;
                    nextPaths.push([...p, neighbor]);
                }
            }
            paths = nextPaths;
        }
        const destinations = new Map();
        for (let p of paths) destinations.set(p[p.length - 1].id, p);
        return destinations;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 1) * 15 - 5;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)].hex;
        this.size = Math.random() * 8 + 4;
        this.life = 100;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.4; this.life -= 2; }
    draw(ctx) {
        ctx.fillStyle = this.color; ctx.globalAlpha = Math.max(0, this.life / 100);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ─── POSICIONES DE LOS JUGADORES EN PANTALLA ──────────────────────────────────
// Ajustado a lo que pediste: Esquinas (1-4) y Lados (5-6)
const GET_PLAYER_POS_STYLE = (index) => {
    switch(index) {
        case 0: return { top: 20, left: 20 }; // P1: Arriba-Izquierda
        case 1: return { top: 20, right: 20 }; // P2: Arriba-Derecha
        case 2: return { bottom: 20, left: 20 }; // P3: Abajo-Izquierda
        case 3: return { bottom: 20, right: 20 }; // P4: Abajo-Derecha
        case 4: return { top: '50%', left: 20, transform: 'translateY(-50%)' }; // P5: Medio-Izquierda
        case 5: return { top: '50%', right: 20, transform: 'translateY(-50%)' }; // P6: Medio-Derecha
        default: return { top: 20, left: 20 };
    }
};

// ─── 3. COMPONENTE REACT (UI + INTEGRACIÓN CANVAS) ───────────────────────────
export default function TrivialGame({ onExit, onBuscar }) {
    // ─── RESPONSIVE ───
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth <= 640);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);

    // ─── ESTADOS DE CONFIGURACIÓN ───
    const [pantalla, setPantalla] = useState('INTRO'); // INTRO, SETUP, RULES, PLAYING
    const [numPlayers, setNumPlayers] = useState(4);
    const [nombres, setNombres] = useState(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4', 'Jugador 5', 'Jugador 6']);
    
    // ─── ESTADOS BUSCADOR ───
    const [busquedaTexto,   setBusquedaTexto]   = useState('');
    const [resultadosBusq,  setResultadosBusq]  = useState([]);
    const [cargandoBusq,    setCargandoBusq]    = useState(false);
    const [busqError,       setBusqError]       = useState('');
    const [busqIniciada,    setBusqIniciada]    = useState(false);
    const [recursoIdFB,       setRecursoIdFB]       = useState(null);
    const [categoriasRecurso, setCategoriasRecurso] = useState(null); // categorias del recurso cargado
    const [errorPreguntas,    setErrorPreguntas]    = useState('');

    // ─── ESTADOS DEL JUEGO ───
    const [players, setPlayers] = useState([]);
    const [activePlayerIdx, setActivePlayerIdx] = useState(0);
    const [gameState, setGameState] = useState('WAITING_ROLL'); 
    const [diceVal, setDiceVal] = useState(null);
    const [diceDisplay, setDiceDisplay] = useState(null); // face shown during animation
    const [diceLanding, setDiceLanding] = useState(false);
    const diceAnimRef = useRef(null);
    const [modalData, setModalData] = useState(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [inputCorta, setInputCorta] = useState('');
    const [ordenSlots, setOrdenSlots] = useState([]); // for ORDENAR type

    const [fuentePreguntas, setFuentePreguntas] = useState('JSON');
    const [codigoFirebase, setCodigoFirebase] = useState('');
    const [cargando, setCargando] = useState(false);
    const preguntasRef = useRef(PREGUNTAS);

    const activePlayerIdxRef = useRef(0);
    useEffect(() => { activePlayerIdxRef.current = activePlayerIdx; }, [activePlayerIdx]);

    // ─── ESTADOS PAUSA / GUARDAR / CARGAR ───
    const [pausaActiva, setPausaActiva] = useState(false);
    const [codigoProfesorGuardar, setCodigoProfesorGuardar] = useState('');
    const [estadoGuardar, setEstadoGuardar] = useState(null); // null|'GUARDANDO'|'EXITO'|'ERROR'
    const [codigoPartidaGenerado, setCodigoPartidaGenerado] = useState('');
    const [errorGuardar, setErrorGuardar] = useState('');
    const [codigoCargar, setCodigoCargar] = useState('');
    const [estadoCarga, setEstadoCarga] = useState(null); // null|'CARGANDO'|'ERROR'
    const [errorCarga, setErrorCarga] = useState('');
    const pendingLoadRef = useRef(null);

    const canvasRef = useRef(null);
    const engineRef = useRef({
        board: null, playersPos: [], state: 'IDLE', destinations: new Map(),
        movingPath: [], moveProgress: 0, targetNode: null, particles: []
    });
    const animFrameRef = useRef(null);
    const handleArrivalRef = useRef(null);
    const categoriasRecursoRef = useRef(null);
    const imgCacheRef = useRef({});
    
    // ─── BUSCADOR DE RECURSOS ───
    const buscarRecursosTrivial = async (texto) => {
        setCargandoBusq(true);
        setBusqError('');
        setBusqIniciada(true);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'trivial_recursos'),
                    where('publica', '==', true),
                    where('tipoJuego', '==', 'TRIVIAL'),
                    orderBy('fechaModificacion', 'desc'),
                    limit(60)
                )
            );
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (texto.trim()) {
                const t = texto.trim().toLowerCase();
                docs = docs.filter(d =>
                    (d.titulo || '').toLowerCase().includes(t) ||
                    (d.creadorNombre || '').toLowerCase().includes(t) ||
                    (d.descripcion || '').toLowerCase().includes(t)
                );
            }
            setResultadosBusq(docs);
        } catch (e) {
            console.error(e);
            setBusqError('Error al buscar. Inténtalo de nuevo.');
        }
        setCargandoBusq(false);
    };

    const seleccionarRecurso = (recurso) => {
        setCodigoFirebase(recurso.codigoJuego || '');
        setRecursoIdFB(recurso.id);
        setFuentePreguntas('FIREBASE');
        setPantalla('SETUP');
    };

    // ─── INICIAR JUEGO ───
    const iniciarJuego = async () => {
        setCargando(true);
        let pregsFinales = PREGUNTAS;

        if (fuentePreguntas === 'JSON') {
            pregsFinales = PREGUNTAS_JSON;
        } else if (fuentePreguntas === 'JSON_PRIMARIA') {
            pregsFinales = PREGUNTAS_PRIMARIA;
        } else if (fuentePreguntas === 'JSON_SUPER') {
            pregsFinales = PREGUNTAS_SUPER;
        } else if (fuentePreguntas === 'FIREBASE') {
            try {
                // Usar ID directo si viene del buscador; si no, buscar por codigoJuego
                let recursoId = recursoIdFB;
                if (!recursoId && codigoFirebase.trim()) {
                    const recursoSnap = await getDocs(query(
                        collection(db, 'trivial_recursos'),
                        where('codigoJuego', '==', codigoFirebase.trim().toUpperCase()),
                        where('publica', '==', true)
                    ));
                    if (!recursoSnap.empty) recursoId = recursoSnap.docs[0].id;
                }
                if (recursoId) {
                    const [pregSnap, recursoDoc] = await Promise.all([
                        getDocs(collection(db, 'trivial_recursos', recursoId, 'preguntas')),
                        getDoc(doc(db, 'trivial_recursos', recursoId)),
                    ]);
                    const fbPregs = {};
                    pregSnap.forEach(d => {
                        const data = d.data();
                        const tipo = data.tipo || 'SELECCION';
                        const valida =
                            data.categoria && (
                                (tipo === 'SELECCION' && data.q && data.a) ||
                                (tipo === 'CORTA'     && data.q && data.a) ||
                                (tipo === 'RELLENAR'  && data.bloques?.length >= 2) ||
                                (tipo === 'ORDENAR'   && data.bloques?.length >= 2)
                            );
                        if (valida) {
                            if (!fbPregs[data.categoria]) fbPregs[data.categoria] = [];
                            fbPregs[data.categoria].push({ ...data, id: d.id });
                        }
                    });
                    // Validate minimum 5 questions per category
                    const CAT_IDS_TV = ['geo', 'esp', 'his', 'art', 'cie', 'dep'];
                    const cortas = CAT_IDS_TV.filter(c => (fbPregs[c]?.length || 0) < 5);
                    if (cortas.length > 0) {
                        const CAT_NAMES = { geo: 'Geografía', esp: 'Espectáculos', his: 'Historia', art: 'Arte y Lit.', cie: 'Ciencias', dep: 'Deportes' };
                        setErrorPreguntas(`El recurso no tiene suficientes preguntas. Se necesitan al menos 5 por categoría.`);
                        setCargando(false);
                        return;
                    }
                    if (recursoDoc.exists()) {
                        setCategoriasRecurso(recursoDoc.data().categorias || null);
                    }
                    if (Object.keys(fbPregs).length > 0) pregsFinales = fbPregs;
                    else console.warn('El recurso existe pero no tiene preguntas, usando internas.');
                } else {
                    console.warn('No se encontró ningún recurso con ese código de juego.');
                }
            } catch (e) {
                console.warn('Error cargando desde Firebase, usando preguntas internas.', e);
            }
        }

        preguntasRef.current = pregsFinales;

        const nuevosJugadores = [];
        for(let i=0; i<numPlayers; i++){
            nuevosJugadores.push({
                id: i,
                name: nombres[i] || `Jugador ${i+1}`,
                color: PLAYER_COLORS[i],
                wedges: []
            });
        }
        setPlayers(nuevosJugadores);
        setPantalla('RULES');
        setCargando(false);
    };

    // ─── GUARDAR PARTIDA ───
    const CODIGOS_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const generarCodigo = (len = 6) => Array.from({ length: len }, () => CODIGOS_CHARS[Math.floor(Math.random() * CODIGOS_CHARS.length)]).join('');

    const guardarPartida = async () => {
        if (!codigoProfesorGuardar.trim()) return;
        setEstadoGuardar('GUARDANDO');
        setErrorGuardar('');
        try {
            const profSnap = await getDoc(doc(db, 'codigos_profesor', codigoProfesorGuardar.trim().toUpperCase()));
            if (!profSnap.exists()) { setEstadoGuardar('ERROR'); setErrorGuardar('Código de profesor no válido.'); return; }
            const profesorUid = profSnap.data().uid;

            const posiciones = engineRef.current.playersPos.map(p => p.node.id);
            const codigo = generarCodigo();

            await setDoc(doc(db, 'trivial_partidas', codigo), {
                codigoPartida: codigo,
                codigoProfesor: codigoProfesorGuardar.trim().toUpperCase(),
                profesorUid,
                fechaCreacion: serverTimestamp(),
                fechaUltimaActividad: serverTimestamp(),
                jugadores: players.map(p => ({ nombre: p.name, color: p.color, quesitos: p.wedges })),
                posiciones,
                turnoActivo: activePlayerIdxRef.current,
                fuentePreguntas,
                recursoIdFB: recursoIdFB || null,
            });

            setCodigoPartidaGenerado(codigo);
            setEstadoGuardar('EXITO');
        } catch (e) {
            console.error(e);
            setEstadoGuardar('ERROR');
            setErrorGuardar('Error al guardar. Inténtalo de nuevo.');
        }
    };

    // ─── CARGAR PARTIDA ───
    const cargarPartida = async () => {
        const cod = codigoCargar.trim().toUpperCase();
        if (!cod) return;
        setEstadoCarga('CARGANDO');
        setErrorCarga('');
        try {
            const snap = await getDoc(doc(db, 'trivial_partidas', cod));
            if (!snap.exists()) { setEstadoCarga('ERROR'); setErrorCarga('Partida no encontrada.'); return; }

            const data = snap.data();
            const ultimaActividad = data.fechaUltimaActividad?.toDate?.() || new Date(0);
            if (Date.now() - ultimaActividad.getTime() > 7 * 24 * 60 * 60 * 1000) {
                await deleteDoc(doc(db, 'trivial_partidas', cod));
                setEstadoCarga('ERROR');
                setErrorCarga('Esta partida ha expirado (más de 7 días sin actividad).');
                return;
            }

            const jugadoresRestaurados = data.jugadores.map((j, i) => ({
                id: i, name: j.nombre, color: j.color, wedges: j.quesitos || []
            }));

            pendingLoadRef.current = { posiciones: data.posiciones };

            await updateDoc(doc(db, 'trivial_partidas', cod), { fechaUltimaActividad: serverTimestamp() });

            // Restaurar fuente de preguntas
            const fuente = data.fuentePreguntas || 'JSON';
            setFuentePreguntas(fuente);

            if (fuente === 'JSON_PRIMARIA') {
                preguntasRef.current = PREGUNTAS_PRIMARIA;
            } else if (fuente === 'JSON_SUPER') {
                preguntasRef.current = PREGUNTAS_SUPER;
            } else if (fuente === 'FIREBASE' && data.recursoIdFB) {
                try {
                    const [pregSnap, recursoDoc] = await Promise.all([
                        getDocs(collection(db, 'trivial_recursos', data.recursoIdFB, 'preguntas')),
                        getDoc(doc(db, 'trivial_recursos', data.recursoIdFB)),
                    ]);
                    const fbPregs = {};
                    pregSnap.forEach(d => {
                        const q = d.data();
                        const tipo = q.tipo || 'SELECCION';
                        const valida = q.categoria && (
                            (tipo === 'SELECCION' && q.q && q.a) ||
                            (tipo === 'CORTA'     && q.q && q.a) ||
                            (tipo === 'RELLENAR'  && q.bloques?.length >= 2) ||
                            (tipo === 'ORDENAR'   && q.bloques?.length >= 2)
                        );
                        if (valida) {
                            if (!fbPregs[q.categoria]) fbPregs[q.categoria] = [];
                            fbPregs[q.categoria].push({ ...q, id: d.id });
                        }
                    });
                    preguntasRef.current = Object.keys(fbPregs).length > 0 ? fbPregs : PREGUNTAS_JSON;
                    setRecursoIdFB(data.recursoIdFB);
                    if (recursoDoc.exists()) setCategoriasRecurso(recursoDoc.data().categorias || null);
                } catch (e) {
                    console.warn('No se pudieron recargar las preguntas del recurso, usando clásico.', e);
                    preguntasRef.current = PREGUNTAS_JSON;
                }
            } else {
                preguntasRef.current = PREGUNTAS_JSON;
            }

            setPlayers(jugadoresRestaurados);
            setActivePlayerIdx(data.turnoActivo || 0);
            setPantalla('PLAYING');
            setEstadoCarga(null);
        } catch (e) {
            console.error(e);
            setEstadoCarga('ERROR');
            setErrorCarga('Error al cargar la partida.');
        }
    };

    // ─── LÓGICA DEL TEMPORIZADOR ───
    useEffect(() => {
        let timer;
        if (gameState === 'QUESTION' && timeLeft > 0 && !mostrandoRespuesta) {
            timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
        } else if (gameState === 'QUESTION' && timeLeft === 0 && !mostrandoRespuesta) {
            responderPregunta(false);
        }
        return () => clearTimeout(timer);
    }, [gameState, timeLeft]); // eslint-disable-line

    // ─── INICIALIZACIÓN DEL MOTOR ───
    useEffect(() => {
        if (pantalla !== 'PLAYING') return;

        const board = new TrivialBoard(500, 500, 420);
        engineRef.current.board = board;
        engineRef.current.playersPos = players.map(() => ({
            node: board.nodes.get('center'),
            x: board.nodes.get('center').x,
            y: board.nodes.get('center').y
        }));

        // Restaurar posiciones de partida guardada
        if (pendingLoadRef.current) {
            pendingLoadRef.current.posiciones.forEach((nodeId, i) => {
                const node = board.nodes.get(nodeId);
                if (node && engineRef.current.playersPos[i]) {
                    engineRef.current.playersPos[i] = { node, x: node.x, y: node.y };
                }
            });
            pendingLoadRef.current = null;
        }

        const drawLoop = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const eng = engineRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // ── FONDO FIELTRO VERDE ──────────────────────────────────────────
            const bgGrad = ctx.createRadialGradient(500, 500, 0, 500, 500, 660);
            bgGrad.addColorStop(0, '#1e6040'); bgGrad.addColorStop(1, '#092b1a');
            ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, 1000, 1000);

            // ── BORDE DORADO ─────────────────────────────────────────────────
            const borders = [[10, 14, 1], [22, 2.5, 0.9], [27, 1, 0.35]];
            for (const [off, lw, alpha] of borders) {
                ctx.strokeStyle = `rgba(201,168,76,${alpha})`; ctx.lineWidth = lw;
                ctx.strokeRect(off, off, 1000 - off * 2, 1000 - off * 2);
            }

            // ── ARISTAS (líneas de ruta doradas tenues) ──────────────────────
            ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(201,168,76,0.18)';
            const drawn = new Set();
            for (let node of eng.board.nodes.values()) {
                for (let n of node.links) {
                    const linkId = [node.id, n.id].sort().join('-');
                    if (!drawn.has(linkId)) {
                        ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(n.x, n.y); ctx.stroke();
                        drawn.add(linkId);
                    }
                }
            }

            // ── NODOS ────────────────────────────────────────────────────────
            const BCX = eng.board.cx, BCY = eng.board.cy;
            for (let node of eng.board.nodes.values()) {
                const dx = node.x - BCX, dy = node.y - BCY;
                const angleFromCenter = Math.atan2(dy, dx);
                const isDest = eng.destinations.has(node.id);

                ctx.save();
                ctx.translate(node.x, node.y);

                if (node.type === 'center') {
                    // Halo exterior
                    ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(201,168,76,0.12)'; ctx.fill();
                    // Disco dorado
                    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2);
                    const hGrad = ctx.createRadialGradient(-15, -15, 0, 0, 0, 60);
                    hGrad.addColorStop(0, '#f5de70'); hGrad.addColorStop(0.6, '#c9a84c'); hGrad.addColorStop(1, '#7a5208');
                    ctx.fillStyle = hGrad; ctx.fill();
                    ctx.strokeStyle = '#e8c84a'; ctx.lineWidth = 2; ctx.stroke();
                    // Radios de rueda (12 rayos)
                    for (let i = 0; i < 12; i++) {
                        ctx.save(); ctx.rotate((i / 12) * Math.PI * 2);
                        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -52); ctx.stroke();
                        ctx.restore();
                    }
                    // Aro interior
                    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
                    // Centro brillante
                    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2);
                    const iGrad = ctx.createRadialGradient(-6, -6, 0, 0, 0, 28);
                    iGrad.addColorStop(0, '#ffe878'); iGrad.addColorStop(1, '#a07010');
                    ctx.fillStyle = iGrad; ctx.fill();
                    ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 1.5; ctx.stroke();

                } else if (node.type === 'wedge') {
                    ctx.rotate(angleFromCenter);
                    if (isDest) { ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 32; }
                    // Fondo oscuro
                    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2);
                    ctx.fillStyle = '#092b1a'; ctx.fill();
                    // Aro de color
                    ctx.strokeStyle = node.color.hex; ctx.lineWidth = 7; ctx.stroke();
                    // Círculo de color
                    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2);
                    const wGrad = ctx.createRadialGradient(-6, -6, 0, 0, 0, 30);
                    wGrad.addColorStop(0, node.color.hex + 'ff');
                    wGrad.addColorStop(1, node.color.hex + '99');
                    ctx.fillStyle = wGrad; ctx.fill();
                    // Triángulo (símbolo quesito)
                    ctx.beginPath();
                    ctx.moveTo(0, -14); ctx.lineTo(-12, 10); ctx.lineTo(12, 10); ctx.closePath();
                    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.shadowBlur = 0;

                } else {
                    // Casilla normal — rectángulo orientado tangencialmente
                    ctx.rotate(angleFromCenter + Math.PI / 2);
                    const tw = 56, th = 40;

                    if (isDest) { ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 20; }

                    // Sombra offset
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    drawRoundRect(ctx, -tw / 2 + 2, -th / 2 + 2, tw, th, 5); ctx.fill();

                    // Relleno de color
                    ctx.fillStyle = node.color.hex;
                    drawRoundRect(ctx, -tw / 2, -th / 2, tw, th, 5); ctx.fill();

                    // Borde oscuro
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();

                    // Brillo superior
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    drawRoundRect(ctx, -tw / 2 + 3, -th / 2 + 3, tw - 6, th * 0.38, 3); ctx.fill();

                    ctx.shadowBlur = 0;

                    // Emoji / imagen en la 3ª casilla de cada radio (s_*_2)
                    if (node.id.match(/^s_\d+_2$/)) {
                        const catId = node.color.id;
                        const cachedImg = imgCacheRef.current[catId];
                        const custom = categoriasRecursoRef.current?.[catId];
                        const emoji = custom?.emoji || node.color.emoji;
                        // Cancelar la rotación acumulada: la casilla tiene rotate(angleFromCenter + π/2)
                        const cancelRot = -(angleFromCenter + Math.PI / 2);
                        ctx.save();
                        ctx.rotate(cancelRot);
                        ctx.globalAlpha = 1;
                        // Disco blanco de fondo para contraste
                        const R = 16;
                        ctx.beginPath();
                        ctx.arc(0, 0, R, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255,255,255,0.92)';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        if (cachedImg) {
                            // Imagen recortada en círculo
                            ctx.beginPath();
                            ctx.arc(0, 0, R, 0, Math.PI * 2);
                            ctx.clip();
                            ctx.drawImage(cachedImg, -R, -R, R * 2, R * 2);
                        } else if (emoji) {
                            ctx.font = '22px "Apple Color Emoji","Segoe UI Emoji",serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(emoji, 0, 1);
                        }
                        ctx.restore();
                    }
                }
                ctx.restore();
            }

            // 3. Lógica de Movimiento Visual (SALTOS PARABÓLICOS)
            if (eng.state === 'MOVING') {
                const oldIdx = Math.floor(eng.moveProgress);
                eng.moveProgress += 0.04;
                const cIdx = Math.floor(eng.moveProgress);
                const nIdx = Math.min(cIdx + 1, eng.movingPath.length - 1);
                const frac = eng.moveProgress - cIdx;
                
                const activeP = eng.playersPos[activePlayerIdxRef.current];

                if (cIdx > oldIdx && cIdx < eng.movingPath.length - 1) playJumpSound();

                if (cIdx >= eng.movingPath.length - 1) {
                    activeP.node = eng.targetNode;
                    activeP.x = eng.targetNode.x; activeP.y = eng.targetNode.y;
                    eng.state = 'IDLE';
                    playJumpSound();
                    if(handleArrivalRef.current) handleArrivalRef.current(eng.targetNode);
                } else {
                    const n1 = eng.movingPath[cIdx]; const n2 = eng.movingPath[nIdx];
                    const baseX = n1.x + (n2.x - n1.x) * frac;
                    const baseY = n1.y + (n2.y - n1.y) * frac;
                    const jumpY = Math.sin(frac * Math.PI) * 60; 
                    
                    activeP.x = baseX;
                    activeP.y = baseY - jumpY; 
                }
            }

            // 4. Dibujar Fichas (Con Anti-Solapamiento dinámico infinito)
            window.currentPlayersState.forEach((pState, idx) => {
                const pos = eng.playersPos[idx];
                
                let playersOnSameNode = 0;
                let myRank = 0;
                window.currentPlayersState.forEach((otherP, otherIdx) => {
                    if (eng.playersPos[otherIdx].node.id === pos.node.id) {
                        playersOnSameNode++;
                        if (otherIdx < idx) myRank++; 
                    }
                });

                const isMovingMe = (eng.state === 'MOVING' && idx === activePlayerIdxRef.current);
                
                let offsetAngle = 0;
                let dist = 0;
                if (!isMovingMe && playersOnSameNode > 1) {
                    offsetAngle = (myRank * Math.PI * 2) / playersOnSameNode;
                    dist = 30; 
                }

                const x = pos.x + Math.cos(offsetAngle) * dist;
                const y = pos.y + Math.sin(offsetAngle) * dist;

                ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2);
                ctx.fillStyle = '#1e293b'; ctx.fill();
                ctx.lineWidth = 5; ctx.strokeStyle = pState.color; ctx.stroke();

                const wAngle = (Math.PI * 2) / 6;
                let wIndex = 0;
                for (let cat of COLORS) {
                    if (pState.wedges.includes(cat.id)) {
                        ctx.beginPath(); ctx.moveTo(x, y);
                        ctx.arc(x, y, 22, wIndex * wAngle, (wIndex + 1) * wAngle);
                        ctx.fillStyle = cat.hex; ctx.fill(); ctx.stroke();
                    }
                    wIndex++;
                }

                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`P${idx + 1}`, x, y);
            });

            // 5. Partículas
            for (let i = eng.particles.length - 1; i >= 0; i--) {
                eng.particles[i].update(); eng.particles[i].draw(ctx);
                if (eng.particles[i].life <= 0) eng.particles.splice(i, 1);
            }

            animFrameRef.current = requestAnimationFrame(drawLoop);
        };

        animFrameRef.current = requestAnimationFrame(drawLoop);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [pantalla]); // eslint-disable-line

    useEffect(() => { window.currentPlayersState = players; }, [players]);
    useEffect(() => {
        categoriasRecursoRef.current = categoriasRecurso;
        if (!categoriasRecurso) { imgCacheRef.current = {}; return; }
        COLORS.forEach(c => {
            const url = categoriasRecurso[c.id]?.imagen;
            if (url && !imgCacheRef.current[c.id]) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => { imgCacheRef.current[c.id] = img; };
                img.src = url;
            } else if (!url) {
                delete imgCacheRef.current[c.id];
            }
        });
    }, [categoriasRecurso]);

    // ─── TTS ───
    const [isSpeaking, setIsSpeaking] = useState(false);
    useEffect(() => {
        const texto = modalData?.qData?.lectura;
        if (!texto || !window.speechSynthesis) return;
        const utt = new SpeechSynthesisUtterance(texto);
        utt.lang = modalData.qData.lecturaIdioma || 'es-ES';
        utt.onstart = () => setIsSpeaking(true);
        utt.onend   = () => setIsSpeaking(false);
        utt.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
        return () => { window.speechSynthesis.cancel(); setIsSpeaking(false); };
    }, [modalData]);

    // ─── MANEJADOR DE LLEGADA (PREGUNTAS) ───
    handleArrivalRef.current = useCallback((node) => {
        const catId = node.color.id;
        const isCenter = node.type === 'center';
        const p = players[activePlayerIdx];
        const isFinal = isCenter && p.wedges.length === 6;
        
        let qCat = isCenter ? COLORS[Math.floor(Math.random() * COLORS.length)].id : catId;
        const qList = preguntasRef.current[qCat] || preguntasRef.current['geo'] || PREGUNTAS['geo'];
        const qData = qList[Math.floor(Math.random() * qList.length)];
        const tipo = qData.tipo || 'SELECCION';

        // Prepare type-specific state
        setInputCorta('');
        if (tipo === 'ORDENAR' && qData.bloques) {
            // Shuffle for the player to sort
            const mezclado = [...qData.bloques].sort(() => Math.random() - 0.5);
            setOrdenSlots(mezclado.map(b => ({ texto: b, enSlot: false })));
        } else {
            setOrdenSlots([]);
        }

        setMostrandoRespuesta(false);
        setTimeLeft(15);
        setGameState('QUESTION');
        setModalData({
            node, isFinal,
            color: isCenter ? { hex: '#3498db', name: 'Centro Final' } : node.color,
            qData,
            // legacy fields for SELECCION compatibility
            question: tipo === 'RELLENAR' ? (qData.bloques?.[0] || '') : (qData.q || ''),
            correct: tipo === 'RELLENAR' ? qData.bloques?.[1] : qData.a,
            answers: (tipo === 'SELECCION' && qData.a && qData.w)
                ? [qData.a, ...qData.w].sort(() => Math.random() - 0.5)
                : [],
        });
    }, [activePlayerIdx, players]);


    // ─── INTERACCIONES DE UI ───
    const tirarDado = () => {
        if (pausaActiva || gameState !== 'WAITING_ROLL') return;
        setGameState('ROLLING');
        setDiceLanding(false);
        playDiceSound();

        // Rapid visual cycling
        diceAnimRef.current = setInterval(() => {
            setDiceDisplay(Math.floor(Math.random() * 6) + 1);
        }, 75);

        setTimeout(() => {
            clearInterval(diceAnimRef.current);
            const roll = Math.floor(Math.random() * 6) + 1;
            setDiceDisplay(roll);
            setDiceVal(roll);
            setDiceLanding(true);
            setTimeout(() => setDiceLanding(false), 400);
            setGameState('SELECTING');

            const eng = engineRef.current;
            const currentPos = eng.playersPos[activePlayerIdxRef.current].node;
            eng.destinations = eng.board.getValidDestinations(currentPos, roll);
        }, 800);
    };

    const handleCanvasClick = (e) => {
        if (pausaActiva || gameState !== 'SELECTING') return;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const eng = engineRef.current;
        for (let [id, path] of eng.destinations.entries()) {
            const node = eng.board.nodes.get(id);
            if (Math.hypot(node.x - x, node.y - y) < 38) {
                eng.targetNode = node;
                eng.movingPath = path;
                eng.moveProgress = 0;
                eng.destinations.clear();
                eng.state = 'MOVING';
                setGameState('MOVING');
                break;
            }
        }
    };

    const [mostrandoRespuesta, setMostrandoRespuesta] = useState(false);

    const cerrarModal = () => {
        setMostrandoRespuesta(false);
        setActivePlayerIdx(prev => (prev + 1) % players.length);
        setGameState('WAITING_ROLL');
        setModalData(null);
        setDiceVal(null);
    };

    const responderPregunta = (isCorrect) => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isCorrect ? playCorrectSound() : playWrongSound();
        const eng = engineRef.current;
        if (isCorrect) {
            if (modalData.isFinal) {
                setGameState('WON');
                return;
            }
            if (modalData.node.type === 'wedge') {
                const catId = modalData.node.color.id;
                setPlayers(prev => {
                    const np = [...prev];
                    if (!np[activePlayerIdx].wedges.includes(catId)) {
                        np[activePlayerIdx].wedges.push(catId);
                        for(let i=0; i<40; i++) eng.particles.push(new Particle(modalData.node.x, modalData.node.y));
                    }
                    return np;
                });
            }
            setGameState('WAITING_ROLL');
            setModalData(null);
            setDiceVal(null);
        } else {
            setMostrandoRespuesta(true);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER: PANTALLA SETUP
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // RENDER: PANTALLA INTRO
    // ════════════════════════════════════════════════════════════════════════
    if (pantalla === 'INTRO') {
        const totalPreguntas = Object.values(PREGUNTAS_JSON).flat().length;
        const totalPrimaria  = Object.values(PREGUNTAS_PRIMARIA).flat().length;
        const totalSuper     = Object.values(PREGUNTAS_SUPER).flat().length;
        return (
            <div style={{ ...st.appContainer, height: 'auto', minHeight: '100dvh', overflow: 'auto', flexDirection: 'column', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '24px 16px 32px' : '20px', gap: 0 }}>
                <FullscreenBtn />

                {/* Cabecera de colores de categoría */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, marginTop: isMobile ? 8 : 0 }}>
                    {COLORS.map(c => (
                        <div key={c.id} style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, boxShadow: `0 0 16px ${c.hex}cc` }} />
                    ))}
                </div>

                <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 8vw, 5rem)', margin: 0, fontWeight: 900, letterSpacing: 6, textShadow: '0 0 50px rgba(255,255,255,0.15)' }}>TRIVIAL</h1>
                <p style={{ color: '#64748b', marginBottom: isMobile ? 24 : 50, fontSize: '1.1rem', letterSpacing: 2 }}>JUEGO DE PREGUNTAS</p>

                {/* Dos opciones */}
                <div style={{ display: 'flex', gap: isMobile ? 14 : 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 820, padding: isMobile ? '0 4px' : 0 }}>

                    {/* Opción 1: Preguntas integradas */}
                    <div
                        onClick={() => { setFuentePreguntas('JSON'); setPantalla('SETUP'); }}
                        style={{ flex: 1, minWidth: isMobile ? '100%' : 280, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 20, padding: isMobile ? '24px 20px' : 36, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        {/* Barra de colores decorativa */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, display: 'flex' }}>
                            {COLORS.map(c => <div key={c.id} style={{ flex: 1, background: c.hex }} />)}
                        </div>
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>🎮</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Trivial Clásico</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            {totalPreguntas} preguntas en las 6 categorías clásicas. Empieza a jugar directamente.
                        </p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                            {COLORS.map(c => (
                                <span key={c.id} style={{ background: c.hex, color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{c.name}</span>
                            ))}
                        </div>
                        <button style={{ background: 'linear-gradient(135deg, #38bdf8, #2563eb)', color: 'white', border: 'none', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 8px 25px rgba(37,99,235,0.4)' }}>
                            Jugar al clásico →
                        </button>
                    </div>

                    {/* Opción 2: Trivial Primaria */}
                    <div
                        onClick={() => { setFuentePreguntas('JSON_PRIMARIA'); setPantalla('SETUP'); }}
                        style={{ flex: 1, minWidth: isMobile ? '100%' : 280, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 20, padding: isMobile ? '24px 20px' : 36, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#34d399'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #34d399, #059669)' }} />
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>🌟</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Trivial Primaria</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            {totalPrimaria} preguntas adaptadas para alumnos de primaria. Categorías más sencillas y amenas.
                        </p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                            {COLORS.map(c => (
                                <span key={c.id} style={{ background: c.hex, color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{c.name}</span>
                            ))}
                        </div>
                        <button style={{ background: 'linear-gradient(135deg, #34d399, #059669)', color: 'white', border: 'none', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 8px 25px rgba(5,150,105,0.4)' }}>
                            Jugar a primaria →
                        </button>
                    </div>

                    {/* Opción 3: Super Trivial */}
                    <div
                        onClick={() => { setFuentePreguntas('JSON_SUPER'); setPantalla('SETUP'); }}
                        style={{ flex: 1, minWidth: isMobile ? '100%' : 280, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 20, padding: isMobile ? '24px 20px' : 36, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} />
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>⚡</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Super Trivial</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            {totalSuper} preguntas con todos los tipos: selección, respuesta corta, rellenar el hueco y ordenar.
                        </p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                            {['🔘 Selección', '✏️ Corta', '🔲 Rellenar', '🔀 Ordenar'].map(t => (
                                <span key={t} style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid #f59e0b50', padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 'bold' }}>{t}</span>
                            ))}
                        </div>
                        <button style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 8px 25px rgba(245,158,11,0.4)' }}>
                            Jugar al Super Trivial →
                        </button>
                    </div>

                    {/* Opción 4: Buscar Trivial */}
                    <div
                        onClick={() => { setBusquedaTexto(''); setResultadosBusq([]); setBusqIniciada(false); setPantalla('BUSCADOR'); buscarRecursosTrivial(''); }}
                        style={{ flex: 1, minWidth: isMobile ? '100%' : 280, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 20, padding: isMobile ? '24px 20px' : 36, cursor: 'pointer', textAlign: 'center', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }} />
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>🔍</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Buscar Trivial</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            Explora todos los triviales públicos. Filtra por título, autor o ve todos los disponibles.
                        </p>
                        <button style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white', border: 'none', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 8px 25px rgba(168,85,247,0.4)' }}>
                            Explorar triviales →
                        </button>
                    </div>

                    {/* Opción 3: Continuar partida */}
                    <div style={{ flex: 1, minWidth: isMobile ? '100%' : 280, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 20, padding: isMobile ? '24px 20px' : 36, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} />
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>🔄</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Continuar partida</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            Introduce el código de 6 letras que recibiste al guardar la partida.
                        </p>
                        <input
                            type="text"
                            placeholder="CÓDIGO DE PARTIDA"
                            value={codigoCargar}
                            onChange={e => setCodigoCargar(e.target.value.toUpperCase())}
                            onKeyDown={e => { if (e.key === 'Enter' && codigoCargar.trim().length >= 4) cargarPartida(); }}
                            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, background: '#0f172a', color: 'white', border: '2px solid #475569', outline: 'none', fontSize: '1.1rem', boxSizing: 'border-box', marginBottom: 14, letterSpacing: 6, textAlign: 'center', fontWeight: 'bold' }}
                        />
                        {errorCarga && <p style={{ color: '#e74c3c', margin: '0 0 10px', fontSize: '0.85rem' }}>{errorCarga}</p>}
                        <button
                            onClick={cargarPartida}
                            disabled={codigoCargar.trim().length < 4 || estadoCarga === 'CARGANDO'}
                            style={{ background: codigoCargar.trim().length >= 4 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#1e293b', color: codigoCargar.trim().length >= 4 ? 'white' : '#475569', border: '2px solid', borderColor: codigoCargar.trim().length >= 4 ? 'transparent' : '#334155', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: codigoCargar.trim().length >= 4 ? 'pointer' : 'not-allowed', width: '100%', transition: '0.2s', boxShadow: codigoCargar.trim().length >= 4 ? '0 8px 25px rgba(245,158,11,0.4)' : 'none' }}
                        >
                            {estadoCarga === 'CARGANDO' ? 'Cargando…' : 'Continuar partida →'}
                        </button>
                    </div>
                </div>

                {onExit && (
                    <button onClick={onExit} style={{ marginTop: 40, background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ArrowLeft size={16} /> Volver al menú
                    </button>
                )}
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // RENDER: BUSCADOR DE TRIVIALES
    // ════════════════════════════════════════════════════════════════════════
    if (pantalla === 'BUSCADOR') {
        const CAT_COLORS = { geo: '#3498db', esp: '#e84393', his: '#f1c40f', art: '#9b59b6', cie: '#2ecc71', dep: '#e67e22' };
        return (
            <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', sans-serif" }}>
                {/* Header */}
                <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <button onClick={() => setPantalla('INTRO')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.3rem', padding: '2px 6px', borderRadius: 6 }}>←</button>
                    <span style={{ fontSize: '1.3rem' }}>🔍</span>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Explorar Triviales</h2>
                </div>

                {/* Search bar */}
                <div style={{ padding: '20px 20px 0', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <input
                            value={busquedaTexto}
                            onChange={e => setBusquedaTexto(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && buscarRecursosTrivial(busquedaTexto)}
                            placeholder="Buscar por título, autor o descripción…"
                            autoFocus
                            style={{ flex: 1, background: '#1e293b', border: '2px solid #334155', borderRadius: 12, color: 'white', padding: '12px 16px', fontSize: '1rem', fontFamily: 'inherit', outline: 'none' }}
                        />
                        <button
                            onClick={() => buscarRecursosTrivial(busquedaTexto)}
                            disabled={cargandoBusq}
                            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', color: 'white', padding: '12px 22px', borderRadius: 12, cursor: cargandoBusq ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.95rem', opacity: cargandoBusq ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                            {cargandoBusq ? '…' : 'Buscar'}
                        </button>
                    </div>
                    {busqError && <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: 8 }}>{busqError}</p>}
                </div>

                {/* Results */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
                    {cargandoBusq && (
                        <p style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Buscando…</p>
                    )}
                    {!cargandoBusq && busqIniciada && resultadosBusq.length === 0 && (
                        <p style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No se encontraron triviales públicos{busquedaTexto ? ` con "${busquedaTexto}"` : ''}.</p>
                    )}
                    {!cargandoBusq && resultadosBusq.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>{resultadosBusq.length} resultado{resultadosBusq.length !== 1 ? 's' : ''}</p>
                            {resultadosBusq.map(r => {
                                const cats = r.categorias || {};
                                const catIds = ['geo', 'esp', 'his', 'art', 'cie', 'dep'];
                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => seleccionarRecurso(r)}
                                        style={{ background: '#1e293b', border: '2px solid #334155', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: 'white', fontWeight: 800, fontSize: '1.05rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎯 {r.titulo}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>por {r.creadorNombre || 'Anónimo'}</div>
                                                {r.descripcion && <div style={{ color: '#94a3b8', fontSize: '0.83rem', marginTop: 5, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.descripcion}</div>}
                                            </div>
                                            <button style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                                                Jugar →
                                            </button>
                                        </div>
                                        {/* Category pills */}
                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                            {catIds.map(id => {
                                                const c = cats[id];
                                                const hex = CAT_COLORS[id];
                                                return (
                                                    <span key={id} style={{ background: hex + '22', border: `1px solid ${hex}50`, color: hex, borderRadius: 8, padding: '2px 9px', fontSize: '0.74rem', fontWeight: 600 }}>
                                                        {c?.emoji || ''} {c?.nombre || id}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // RENDER: PANTALLA DE REGLAS
    // ════════════════════════════════════════════════════════════════════════
    if (pantalla === 'RULES') {
        const CAT_DEFAULTS_RULES = {
            geo: { hex: '#3498db', emoji: '🌍', name: 'Geografía',    desc: 'Capitales, ríos, montañas y países del mundo.' },
            esp: { hex: '#e84393', emoji: '🎬', name: 'Espectáculos', desc: 'Cine, música, televisión y cultura popular.' },
            his: { hex: '#f1c40f', emoji: '📜', name: 'Historia',     desc: 'Personajes, batallas, fechas y civilizaciones.' },
            art: { hex: '#9b59b6', emoji: '🎨', name: 'Arte y Lit.',  desc: 'Pintores, escritores, obras y movimientos.' },
            cie: { hex: '#2ecc71', emoji: '🔬', name: 'Ciencias',     desc: 'Física, biología, química y matemáticas.' },
            dep: { hex: '#e67e22', emoji: '⚽', name: 'Deportes',     desc: 'Fútbol, olimpiadas, récords y deportistas.' },
        };
        const cats = ['geo', 'esp', 'his', 'art', 'cie', 'dep'].map(id => {
            const def = CAT_DEFAULTS_RULES[id];
            const custom = categoriasRecurso?.[id];
            return {
                id,
                hex: def.hex,
                emoji: custom?.emoji || def.emoji,
                name: custom?.nombre || def.name,
                desc: custom?.desc  || def.desc,
                imagen: custom?.imagen || '',
            };
        });
        const pasos = [
            { n: '1', titulo: 'Lanza el dado', texto: 'En tu turno pulsa el botón para tirar. El número indica cuántas casillas puedes avanzar.' },
            { n: '2', titulo: 'Elige tu casilla', texto: 'Haz clic en cualquiera de los destinos resaltados para mover tu ficha.' },
            { n: '3', titulo: 'Responde la pregunta', texto: 'Al caer en una casilla de color se muestra una pregunta de esa categoría. Tienes 15 segundos.' },
            { n: '4', titulo: 'Consigue quesitos', texto: 'Si aciertas en una casilla especial (nodo grande) obtienes el quesito de ese color.' },
            { n: '5', titulo: '¡Gana el primero!', texto: 'Llega al centro con todos los quesitos y responde la pregunta final para ganar.' },
        ];

        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e2d4a 50%, #0f172a 100%)',
                fontFamily: "'Segoe UI', sans-serif",
                overflowY: 'auto',
                padding: '0 0 40px',
            }}>
                <FullscreenBtn />
                {/* Header */}
                <div style={{
                    background: 'rgba(15,23,42,0.9)',
                    borderBottom: '1px solid #1e3a5f',
                    padding: '20px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    position: 'sticky', top: 0, zIndex: 10,
                    backdropFilter: 'blur(8px)',
                }}>
                    <button
                        onClick={() => setPantalla('SETUP')}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', fontWeight: 600 }}
                    >
                        <ArrowLeft size={16} /> Configuración
                    </button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <span style={{ color: '#f1f5f9', fontWeight: 900, fontSize: '1.2rem', letterSpacing: 2 }}>🎯 TRIVIAL</span>
                    </div>
                    {/* Jugadores en cabecera */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        {players.map(p => (
                            <div key={p.id} style={{ width: 32, height: 32, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 900, boxShadow: `0 0 8px ${p.color}80` }}>
                                {p.name[0].toUpperCase()}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px 0' }}>

                    {/* Hero */}
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <div style={{ fontSize: '4rem', marginBottom: 12, filter: 'drop-shadow(0 4px 12px rgba(56,189,248,0.4))' }}>🎯</div>
                        <h1 style={{ color: '#f1f5f9', fontSize: '2.4rem', fontWeight: 900, margin: '0 0 10px', letterSpacing: 1 }}>
                            ¿Cómo se juega?
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '1.05rem', margin: 0, maxWidth: 520, marginInline: 'auto' }}>
                            El clásico juego de conocimiento para {players.length} jugador{players.length !== 1 ? 'es' : ''}.<br />
                            Reúne los 6 quesitos y demuestra que lo sabes todo.
                        </p>
                    </div>

                    {/* Pasos */}
                    <div style={{ marginBottom: 52 }}>
                        <h2 style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>
                            Cómo jugar
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                            {pasos.map(p => (
                                <div key={p.n} style={{
                                    background: 'rgba(30,41,59,0.7)',
                                    border: '1px solid #1e3a5f',
                                    borderRadius: 16,
                                    padding: '18px 22px',
                                    display: 'flex',
                                    gap: 16,
                                    alignItems: 'flex-start',
                                }}>
                                    <div style={{
                                        width: 38, height: 38, borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                                        color: 'white', fontWeight: 900, fontSize: '1rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, boxShadow: '0 4px 12px rgba(29,78,216,0.4)',
                                    }}>{p.n}</div>
                                    <div>
                                        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.97rem', marginBottom: 4 }}>{p.titulo}</div>
                                        <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.55 }}>{p.texto}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Categorías */}
                    <div style={{ marginBottom: 52 }}>
                        <h2 style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>
                            Las 6 categorías
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                            {cats.map(c => (
                                <div key={c.id} style={{
                                    background: `linear-gradient(135deg, ${c.hex}18, ${c.hex}08)`,
                                    border: `1.5px solid ${c.hex}45`,
                                    borderRadius: 14,
                                    padding: isMobile ? '12px 14px' : '18px 20px',
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    gap: isMobile ? 8 : 14,
                                    alignItems: isMobile ? 'flex-start' : 'center',
                                    transition: 'transform 0.15s',
                                }}>
                                    {/* Quesito / imagen */}
                                    <div style={{
                                        width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, borderRadius: '50%',
                                        background: c.imagen ? 'transparent' : `radial-gradient(circle at 35% 35%, ${c.hex}ff, ${c.hex}99)`,
                                        boxShadow: `0 4px 14px ${c.hex}55`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: isMobile ? '1.1rem' : '1.5rem', flexShrink: 0,
                                        overflow: 'hidden',
                                    }}>
                                        {c.imagen
                                            ? <img src={c.imagen} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                            : c.emoji}
                                    </div>
                                    <div>
                                        <div style={{ color: c.hex, fontWeight: 800, fontSize: isMobile ? '0.88rem' : '1rem', marginBottom: 2 }}>{c.name}</div>
                                        {!isMobile && <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>{c.desc}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Consejos rápidos */}
                    <div style={{
                        background: 'rgba(30,41,59,0.5)',
                        border: '1px solid #1e3a5f',
                        borderRadius: 16,
                        padding: '20px 28px',
                        marginBottom: 48,
                        display: 'flex',
                        gap: 32,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                    }}>
                        {[
                            { icon: '⏱', texto: '15 segundos por pregunta' },
                            { icon: '🎲', texto: 'Turno pasa si fallas' },
                            { icon: '🏆', texto: 'Necesitas los 6 quesitos para ir al centro' },
                            { icon: '🎯', texto: 'Responde bien en el centro para ganar' },
                        ].map((t, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: '0.9rem' }}>
                                <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                                {t.texto}
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div style={{ textAlign: 'center' }}>
                        <button
                            onClick={() => setPantalla('PLAYING')}
                            style={{
                                background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                                border: 'none',
                                color: 'white',
                                padding: '20px 72px',
                                borderRadius: 50,
                                fontSize: '1.25rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                letterSpacing: 1,
                                boxShadow: '0 8px 32px rgba(29,78,216,0.5)',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(29,78,216,0.65)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(29,78,216,0.5)'; }}
                        >
                            ¡A jugar!
                        </button>
                        <p style={{ color: '#334155', fontSize: '0.82rem', marginTop: 14 }}>
                            Jugadores: {players.map(p => p.name).join(', ')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (pantalla === 'SETUP') {
        return (
            <div style={{ ...st.appContainer, height: 'auto', minHeight: '100dvh', justifyContent: 'center', alignItems: isMobile ? 'flex-start' : 'center', overflow: 'auto', padding: isMobile ? '16px' : 0 }}>
                <FullscreenBtn />
                <div style={{ background: 'rgba(30, 41, 59, 0.95)', padding: isMobile ? '20px 16px' : 40, borderRadius: 20, width: '100%', maxWidth: 500, margin: isMobile ? '16px' : 0, boxSizing: 'border-box', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '2px solid #334155' }}>
                    <button onClick={() => setPantalla('INTRO')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontWeight: 'bold', fontSize: '0.9rem' }}>
                        <ArrowLeft size={16} /> Volver
                    </button>
                    <div style={{ textAlign: 'center', marginBottom: 30 }}>
                        <Users size={60} color="#38bdf8" style={{ marginBottom: 15 }} />
                        <h1 style={{ color: 'white', margin: 0, fontSize: '2.5rem' }}>Configurar Partida</h1>
                        <p style={{ color: '#94a3b8' }}>Hasta 6 jugadores en la misma pantalla.</p>
                    </div>

                    <div style={{ marginBottom: 20, textAlign: 'center' }}>
                        <label style={{ color: 'white', fontWeight: 'bold', marginRight: 15 }}>Número de Jugadores:</label>
                        <select
                            value={numPlayers}
                            onChange={e => setNumPlayers(Number(e.target.value))}
                            style={{ padding: '10px 20px', borderRadius: 10, fontSize: '1.2rem', background: '#0f172a', color: 'white', border: '2px solid #38bdf8', outline: 'none' }}
                        >
                            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Jugadores</option>)}
                        </select>
                    </div>

                    {/* Info sobre la fuente de preguntas (read-only) */}
                    <div style={{ marginBottom: 20, background: '#0f172a', borderRadius: 12, padding: '12px 16px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
                        {fuentePreguntas === 'JSON' ? (<>
                            <span style={{ fontSize: '1.2rem' }}>📄</span>
                            <div>
                                <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.88rem' }}>Trivial Clásico</div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{Object.values(PREGUNTAS_JSON).flat().length} preguntas en {Object.keys(PREGUNTAS_JSON).length} categorías</div>
                            </div>
                        </>) : (<>
                            <span style={{ fontSize: '1.2rem' }}>🎯</span>
                            <div>
                                <div style={{ color: '#a855f7', fontWeight: 700, fontSize: '0.88rem' }}>Trivial personalizado</div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem', fontFamily: 'monospace', letterSpacing: 1 }}>{codigoFirebase}</div>
                            </div>
                        </>)}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
                        {Array.from({length: numPlayers}).map((_, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0f172a', padding: 10, borderRadius: 10 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: PLAYER_COLORS[i] }} />
                                <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>P{i+1}:</span>
                                <input 
                                    type="text" 
                                    value={nombres[i]} 
                                    onChange={e => { const nn = [...nombres]; nn[i] = e.target.value; setNombres(nn); }}
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '1.1rem', outline: 'none' }}
                                />
                            </div>
                        ))}
                    </div>

                    {errorPreguntas && (
                        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 12, padding: '12px 16px', color: '#fca5a5', fontSize: '0.87rem', lineHeight: 1.5, marginBottom: 4 }}>
                            ⚠️ {errorPreguntas}
                        </div>
                    )}
                    <button onClick={() => { setErrorPreguntas(''); iniciarJuego(); }} disabled={cargando} style={{ ...st.btnRoll, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: cargando ? 0.7 : 1, cursor: cargando ? 'wait' : 'pointer' }}>
                        <Play size={20}/> {cargando ? 'Cargando preguntas...' : 'Empezar Juego'}
                    </button>
                    <button onClick={() => { setPantalla('INTRO'); setCategoriasRecurso(null); setErrorPreguntas(''); }} style={{ width: '100%', background: 'transparent', border: 'none', color: '#64748b', padding: 12, marginTop: 5, cursor: 'pointer', fontWeight: 'bold' }}>← Volver al inicio</button>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENDER: PANTALLA DE JUEGO (LAYOUT ABSOLUTO)
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div style={st.appContainer}>
            {gameState === 'WON' && <Confetti recycle={false} numberOfPieces={500} />}
            <FullscreenBtn bottom={isMobile ? 100 : 20} />

            {/* ── TIRA DE JUGADORES (móvil: arriba fijo / escritorio: esquinas) ── */}
            {isMobile ? (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                    background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid #334155',
                    display: 'flex', gap: 6, padding: '7px 10px', overflowX: 'auto',
                    backdropFilter: 'blur(6px)', alignItems: 'center',
                }}>
                    {onExit && (
                        <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}>
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    {players.map((p, i) => {
                        const isAct = i === activePlayerIdx;
                        return (
                            <div key={p.id} style={{
                                flexShrink: 0,
                                background: isAct ? `${p.color}22` : 'rgba(30,41,59,0.8)',
                                border: `1.5px solid ${isAct ? p.color : '#334155'}`,
                                borderRadius: 10, padding: '5px 9px',
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: isAct ? `0 0 10px ${p.color}55` : 'none',
                                transition: 'all 0.2s',
                            }}>
                                <div style={{ width: 11, height: 11, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                                <span style={{ color: 'white', fontSize: '0.78rem', fontWeight: isAct ? 700 : 400, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                <div style={{ display: 'flex', gap: 2 }}>
                                    {COLORS.map(c => (
                                        <div key={c.id} style={{ width: 7, height: 7, borderRadius: '50%', background: p.wedges.includes(c.id) ? c.hex : '#334155' }} />
                                    ))}
                                </div>
                                {isAct && <span style={{ fontSize: '0.6rem', background: p.color, color: '#0f172a', padding: '1px 4px', borderRadius: 5, fontWeight: 900 }}>▶</span>}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <>
                    {onExit && (
                        <button onClick={onExit} style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(15, 23, 42, 0.8)', color: 'white', border: '1px solid #334155', padding: '10px 20px', borderRadius: 30, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(5px)' }}>
                            <ArrowLeft size={16}/> Salir
                        </button>
                    )}
                    {players.map((p, i) => {
                        const isAct = i === activePlayerIdx;
                        return (
                            <div key={p.id} style={{ ...st.playerCardFloating, ...GET_PLAYER_POS_STYLE(i), border: isAct ? `2px solid ${p.color}` : '2px solid #334155', transform: `${GET_PLAYER_POS_STYLE(i).transform || ''} ${isAct ? 'scale(1.1)' : 'scale(1)'}`, boxShadow: isAct ? `0 0 30px ${p.color}88` : '0 10px 20px rgba(0,0,0,0.5)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 'bold', color: 'white', fontSize: '1.2rem' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.color, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#1e293b' }}>P{i+1}</div>
                                    {p.name}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 10 }}>
                                    {COLORS.map(c => (
                                        <div key={c.id} style={{ height: 8, borderRadius: 4, background: p.wedges.includes(c.id) ? c.hex : '#475569', boxShadow: p.wedges.includes(c.id) ? `0 0 5px ${c.hex}` : 'none' }} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {/* ZONA CENTRAL DE JUEGO (CANVAS) */}
            <div style={{
                position: 'absolute',
                top: isMobile ? 50 : 0,
                bottom: isMobile ? 86 : 0,
                left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1,
            }}>
                <div style={{ width: '100%', maxWidth: isMobile ? '100vmin' : 800, aspectRatio: '1/1', position: 'relative' }}>
                    <canvas
                        ref={canvasRef}
                        width={1000}
                        height={1000}
                        onClick={handleCanvasClick}
                        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.8))', cursor: gameState === 'SELECTING' ? 'pointer' : 'default' }}
                    />
                </div>
            </div>

            {/* PANEL DE CONTROLES */}
            <div style={isMobile ? {
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                background: 'rgba(15,23,42,0.97)', borderTop: '1px solid #334155',
                padding: '8px 12px', display: 'flex', alignItems: 'center',
                gap: 8, backdropFilter: 'blur(8px)',
            } : st.controlsFloating}>
                {/* Nombre + estado */}
                <div style={{ flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : 200, textAlign: 'left', overflow: 'hidden' }}>
                    <div style={{ fontSize: isMobile ? '0.7rem' : '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Turno</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.4rem', color: players[activePlayerIdx]?.color || 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {players[activePlayerIdx]?.name}
                    </div>
                    {!isMobile && (
                        <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: 5 }}>
                            {gameState === 'WAITING_ROLL' ? '¡Lanza el dado!' :
                             gameState === 'SELECTING' ? 'Elige una casilla destino' :
                             gameState === 'MOVING' ? 'Saltando...' : 'Respondiendo...'}
                        </div>
                    )}
                </div>

                {/* Dado */}
                <div style={{ width: isMobile ? 46 : 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(gameState === 'ROLLING' && diceDisplay) ? (
                        <DiceFace value={diceDisplay} rolling size={isMobile ? 40 : 62} />
                    ) : diceDisplay ? (
                        <div style={{ animation: diceLanding ? 'diceLand 0.4s ease-out' : 'none' }}>
                            <DiceFace value={diceDisplay} rolling={false} size={isMobile ? 40 : 62} />
                        </div>
                    ) : (
                        <Dices size={isMobile ? 34 : 52} color="#334155" />
                    )}
                </div>

                {/* Botón lanzar */}
                <button
                    onClick={tirarDado}
                    disabled={gameState !== 'WAITING_ROLL'}
                    style={{
                        ...st.btnRoll,
                        width: 'auto',
                        padding: isMobile ? '10px 18px' : '15px 30px',
                        fontSize: isMobile ? '0.95rem' : '1.3rem',
                        opacity: gameState !== 'WAITING_ROLL' ? 0.5 : 1,
                        cursor: gameState !== 'WAITING_ROLL' ? 'not-allowed' : 'pointer',
                        margin: 0, flexShrink: 0,
                    }}
                >
                    {isMobile ? '🎲 Lanzar' : 'Lanzar Dado'}
                </button>

                {/* Pausa */}
                <button onClick={() => setPausaActiva(true)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #475569', color: '#94a3b8', width: isMobile ? 38 : 46, height: isMobile ? 38 : 46, borderRadius: 10, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⏸</button>
            </div>

            {/* MODAL DE PREGUNTAS */}
            {gameState === 'QUESTION' && modalData && (
                <div style={st.modalOverlay}>
                    <div style={{
                        ...st.modalCard,
                        borderTop: `8px solid ${modalData.color.hex}`,
                        padding: isMobile ? '20px 16px' : 45,
                        margin: isMobile ? '0 8px' : 0,
                        maxWidth: isMobile ? '100%' : 550,
                        boxSizing: 'border-box',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', textTransform: 'uppercase', letterSpacing: 2, color: modalData.color.hex, fontWeight: 'bold' }}>
                                    {modalData.color.name}
                                </div>
                                {modalData.qData?.lectura && (
                                    <button
                                        onClick={() => {
                                            if (!window.speechSynthesis) return;
                                            const utt = new SpeechSynthesisUtterance(modalData.qData.lectura);
                                            utt.lang = modalData.qData.lecturaIdioma || 'es-ES';
                                            utt.onstart = () => setIsSpeaking(true);
                                            utt.onend   = () => setIsSpeaking(false);
                                            utt.onerror = () => setIsSpeaking(false);
                                            window.speechSynthesis.cancel();
                                            window.speechSynthesis.speak(utt);
                                        }}
                                        title="Volver a escuchar"
                                        style={{ background: isSpeaking ? '#1d4ed820' : 'transparent', border: `1px solid ${isSpeaking ? '#38bdf8' : '#334155'}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: isSpeaking ? '#38bdf8' : '#64748b', fontSize: '0.78rem', fontWeight: 600, transition: '0.15s' }}
                                    >
                                        {isSpeaking ? '🔊 Escuchando…' : '🔊 Escuchar'}
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: timeLeft > 5 ? '#94a3b8' : '#e74c3c', fontWeight: 'bold', fontSize: isMobile ? '1rem' : '1.2rem' }}>
                                <Timer size={isMobile ? 18 : 24}/> {timeLeft}s
                            </div>
                        </div>

                        <div style={{ height: 6, background: '#334155', borderRadius: 4, margin: '12px 0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(timeLeft / 15) * 100}%`, background: timeLeft > 5 ? '#2ecc71' : '#e74c3c', transition: 'width 1s linear, background 0.3s' }} />
                        </div>

                        {/* Pregunta */}
                        {(() => {
                            const qData = modalData.qData || {};
                            const tipo  = qData.tipo || 'SELECCION';

                            // Normalize helper (ignore accents + case + trailing spaces)
                            const clean = s => s ? String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() : '';

                            // SELECCION — opción múltiple (por defecto)
                            if (tipo === 'SELECCION' || !tipo) return (<>
                                <h2 style={{ color: 'white', fontSize: isMobile ? '1.2rem' : '1.7rem', margin: isMobile ? '14px 0 18px' : '20px 0 30px', lineHeight: 1.4 }}>{qData.q}</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
                                    {modalData.answers.map((ans, i) => (
                                        <button key={i} onClick={() => responderPregunta(ans === modalData.correct)} style={{ ...st.btnAnswer, padding: isMobile ? '13px 14px' : 20, fontSize: isMobile ? '0.95rem' : '1.2rem' }}>{ans}</button>
                                    ))}
                                </div>
                            </>);

                            // CORTA — respuesta libre
                            if (tipo === 'CORTA') return (<>
                                <h2 style={{ color: 'white', fontSize: isMobile ? '1.2rem' : '1.7rem', margin: isMobile ? '14px 0 18px' : '20px 0 24px', lineHeight: 1.4 }}>{qData.q}</h2>
                                <input
                                    value={inputCorta}
                                    onChange={e => setInputCorta(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && inputCorta.trim()) responderPregunta(clean(inputCorta) === clean(qData.a)); }}
                                    placeholder="Escribe tu respuesta…"
                                    autoFocus
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '2px solid #475569', borderRadius: 10, color: 'white', padding: '14px 16px', fontSize: isMobile ? '1rem' : '1.15rem', fontFamily: 'inherit', outline: 'none', marginBottom: 12 }}
                                />
                                <button
                                    onClick={() => { if (inputCorta.trim()) responderPregunta(clean(inputCorta) === clean(qData.a)); }}
                                    disabled={!inputCorta.trim()}
                                    style={{ ...st.btnAnswer, background: '#1d4ed8', border: 'none', fontWeight: 800, opacity: inputCorta.trim() ? 1 : 0.4 }}
                                >Responder</button>
                            </>);

                            // RELLENAR — texto con hueco
                            if (tipo === 'RELLENAR') return (<>
                                <div style={{ color: 'white', fontSize: isMobile ? '1.15rem' : '1.5rem', margin: isMobile ? '14px 0 18px' : '20px 0 24px', lineHeight: 1.6 }}>
                                    <span>{qData.bloques?.[0]} </span>
                                    <span style={{ borderBottom: '3px solid #38bdf8', padding: '0 12px', color: '#38bdf8', fontWeight: 700 }}>___</span>
                                </div>
                                <input
                                    value={inputCorta}
                                    onChange={e => setInputCorta(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && inputCorta.trim()) responderPregunta(clean(inputCorta) === clean(qData.bloques?.[1])); }}
                                    placeholder="Completa el hueco…"
                                    autoFocus
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '2px solid #38bdf8', borderRadius: 10, color: '#38bdf8', padding: '14px 16px', fontSize: isMobile ? '1rem' : '1.15rem', fontFamily: 'inherit', outline: 'none', marginBottom: 12 }}
                                />
                                <button
                                    onClick={() => { if (inputCorta.trim()) responderPregunta(clean(inputCorta) === clean(qData.bloques?.[1])); }}
                                    disabled={!inputCorta.trim()}
                                    style={{ ...st.btnAnswer, background: '#0e7490', border: 'none', fontWeight: 800, opacity: inputCorta.trim() ? 1 : 0.4 }}
                                >Responder</button>
                            </>);

                            // ORDENAR — poner en orden
                            if (tipo === 'ORDENAR') {
                                const elegidos = ordenSlots.filter(s => s.enSlot);
                                const disponibles = ordenSlots.filter(s => !s.enSlot);
                                const completo = elegidos.length === qData.bloques?.length;
                                const confirmarOrden = () => {
                                    if (!completo) return;
                                    const correcto = JSON.stringify(elegidos.map(s => s.texto)) === JSON.stringify(qData.bloques);
                                    responderPregunta(correcto);
                                };
                                return (<>
                                    {qData.q && <h2 style={{ color: 'white', fontSize: isMobile ? '1rem' : '1.3rem', margin: isMobile ? '10px 0 14px' : '14px 0 20px', lineHeight: 1.4 }}>{qData.q}</h2>}
                                    {/* Slots elegidos */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 44, background: '#0f172a', borderRadius: 10, padding: '8px 10px', marginBottom: 10, border: '2px dashed #334155' }}>
                                        {elegidos.length === 0 && <span style={{ color: '#475569', fontSize: '0.85rem', alignSelf: 'center' }}>Toca los elementos en el orden correcto</span>}
                                        {elegidos.map((s, i) => (
                                            <button key={i} onClick={() => setOrdenSlots(prev => prev.map(x => x.texto === s.texto ? { ...x, enSlot: false } : x))}
                                                style={{ background: '#1d4ed8', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 600 }}>
                                                {i + 1}. {s.texto}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Disponibles */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                        {disponibles.map((s, i) => (
                                            <button key={i} onClick={() => setOrdenSlots(prev => prev.map(x => x.texto === s.texto ? { ...x, enSlot: true } : x))}
                                                style={{ background: '#334155', border: '1px solid #475569', color: '#e2e8f0', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: isMobile ? '0.9rem' : '1rem' }}>
                                                {s.texto}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={confirmarOrden} disabled={!completo}
                                        style={{ ...st.btnAnswer, background: '#166534', border: 'none', fontWeight: 800, opacity: completo ? 1 : 0.4 }}>
                                        Confirmar orden
                                    </button>
                                </>);
                            }

                            return null;
                        })()}

                        {/* Panel de respuesta correcta al fallar */}
                        {mostrandoRespuesta && (() => {
                            const qData = modalData.qData || {};
                            const tipo  = qData.tipo || 'SELECCION';
                            let respuesta = '';
                            if (tipo === 'SELECCION' || tipo === 'CORTA') respuesta = qData.a;
                            else if (tipo === 'RELLENAR') respuesta = qData.bloques?.[1];
                            else if (tipo === 'ORDENAR') respuesta = qData.bloques?.join(' → ');
                            return (
                                <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.12)', border: '2px solid #ef4444', borderRadius: 14, padding: isMobile ? '14px 16px' : '20px 24px' }}>
                                    <div style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                                        ✗ Respuesta incorrecta
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 6 }}>La respuesta correcta era:</div>
                                    <div style={{ color: '#4ade80', fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 800, lineHeight: 1.4, marginBottom: 16 }}>
                                        {respuesta}
                                    </div>
                                    <button
                                        onClick={cerrarModal}
                                        style={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', padding: '11px 28px', borderRadius: 10, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, width: '100%' }}
                                    >
                                        Entendido → siguiente jugador
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* PANTALLA VICTORIA */}
            {gameState === 'WON' && (() => {
                const winner = players[activePlayerIdx];
                const sorted = [...players].sort((a, b) => b.wedges.length - a.wedges.length);
                return (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 45%, #0f172a 100%)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        overflowY: 'auto', overflowX: 'hidden',
                        padding: isMobile ? '16px 12px' : '32px 20px',
                        fontFamily: "'Segoe UI', sans-serif",
                    }}>
                        <HeartsEffect />

                        {/* Trofeo */}
                        <div style={{ animation: 'trophyDrop 0.9s cubic-bezier(0.34,1.56,0.64,1) forwards', fontSize: isMobile ? '4.5rem' : '6rem', lineHeight: 1, marginBottom: 8, position: 'relative', zIndex: 2 }}>
                            🏆
                        </div>

                        {/* Nombre del ganador */}
                        <div style={{ animation: 'winnerSlide 0.6s ease-out 0.5s both', textAlign: 'center', zIndex: 2, marginBottom: isMobile ? 6 : 10 }}>
                            <div style={{ color: '#fbbf24', fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                                ¡Ganador!
                            </div>
                            <h1 style={{
                                margin: 0,
                                fontSize: isMobile ? '2.2rem' : '3.2rem',
                                fontWeight: 900,
                                color: winner.color,
                                textShadow: `0 0 30px ${winner.color}99, 0 0 60px ${winner.color}55`,
                                lineHeight: 1.1,
                            }}>
                                {winner.name}
                            </h1>
                            <p style={{ color: '#94a3b8', fontSize: isMobile ? '0.9rem' : '1.05rem', margin: '10px 0 0', lineHeight: 1.5 }}>
                                Ha reunido los 6 quesitos y ha superado la prueba final.<br />
                                <span style={{ color: '#cbd5e1' }}>¡Enhorabuena a todos los participantes!</span>
                            </p>
                        </div>

                        {/* Quesitos del ganador */}
                        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 20 : 28, zIndex: 2, animation: 'winnerSlide 0.6s ease-out 0.7s both' }}>
                            {COLORS.map((c, ci) => (
                                <div key={c.id} style={{
                                    width: isMobile ? 28 : 38, height: isMobile ? 28 : 38,
                                    borderRadius: '50%',
                                    background: `radial-gradient(circle at 35% 35%, ${c.hex}, ${c.hex}99)`,
                                    boxShadow: `0 0 14px ${c.hex}aa`,
                                    animation: `starSpin 2s linear ${ci * 0.15}s infinite`,
                                    border: '2px solid rgba(255,255,255,0.2)',
                                }}/>
                            ))}
                        </div>

                        {/* Clasificación de jugadores */}
                        {players.length > 1 && (
                            <div style={{
                                zIndex: 2,
                                width: '100%', maxWidth: 480,
                                background: 'rgba(30,41,59,0.7)',
                                borderRadius: 20,
                                border: '1px solid rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(10px)',
                                padding: isMobile ? '14px 16px' : '20px 28px',
                                marginBottom: isMobile ? 20 : 28,
                                animation: 'winnerSlide 0.6s ease-out 0.9s both',
                            }}>
                                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                                    Clasificación final
                                </div>
                                {sorted.map((p, rank) => {
                                    const isWinner = p.id === winner.id;
                                    return (
                                        <div
                                            key={p.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: isMobile ? '8px 10px' : '10px 14px',
                                                borderRadius: 12,
                                                background: isWinner ? `${p.color}18` : 'transparent',
                                                border: isWinner ? `1px solid ${p.color}55` : '1px solid transparent',
                                                marginBottom: rank < sorted.length - 1 ? 6 : 0,
                                                animation: `cardIn 0.4s ease-out ${1.0 + rank * 0.1}s both`,
                                            }}
                                        >
                                            {/* Posición */}
                                            <div style={{
                                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                background: rank === 0 ? 'linear-gradient(135deg,#fbbf24,#d97706)' : rank === 1 ? 'linear-gradient(135deg,#e2e8f0,#94a3b8)' : rank === 2 ? 'linear-gradient(135deg,#f97316,#c2410c)' : '#334155',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', fontWeight: 900, color: rank < 3 ? '#0f172a' : '#94a3b8',
                                            }}>
                                                {rank === 0 ? '👑' : rank + 1}
                                            </div>

                                            {/* Punto de color */}
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, flexShrink: 0, boxShadow: `0 0 8px ${p.color}` }} />

                                            {/* Nombre */}
                                            <span style={{ flex: 1, color: isWinner ? p.color : '#e2e8f0', fontWeight: isWinner ? 800 : 500, fontSize: isMobile ? '0.9rem' : '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.name}
                                            </span>

                                            {/* Quesitos */}
                                            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                                {COLORS.map(c => (
                                                    <div key={c.id} style={{
                                                        width: isMobile ? 9 : 11, height: isMobile ? 9 : 11,
                                                        borderRadius: '50%',
                                                        background: p.wedges.includes(c.id) ? c.hex : '#1e293b',
                                                        border: `1px solid ${p.wedges.includes(c.id) ? c.hex : '#334155'}`,
                                                        boxShadow: p.wedges.includes(c.id) ? `0 0 5px ${c.hex}` : 'none',
                                                    }}/>
                                                ))}
                                            </div>

                                            {/* Cuenta */}
                                            <span style={{ color: '#64748b', fontSize: '0.8rem', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
                                                {p.wedges.length}/6
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Botones */}
                        <div style={{ display: 'flex', gap: 12, zIndex: 2, animation: 'winnerSlide 0.5s ease-out 1.2s both', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                                    border: 'none', color: 'white',
                                    padding: isMobile ? '14px 32px' : '16px 48px',
                                    borderRadius: 50, cursor: 'pointer',
                                    fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 900,
                                    boxShadow: '0 8px 28px rgba(29,78,216,0.5)',
                                    letterSpacing: '0.03em',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                🎮 ¡Otra partida!
                            </button>
                            {onExit && (
                                <button
                                    onClick={onExit}
                                    style={{
                                        background: 'rgba(255,255,255,0.07)', border: '1px solid #334155',
                                        color: '#94a3b8', padding: isMobile ? '14px 24px' : '16px 32px',
                                        borderRadius: 50, cursor: 'pointer',
                                        fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 600,
                                    }}
                                >
                                    Salir al menú
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── MENÚ DE PAUSA ─────────────────────────────────────────────── */}
            {pausaActiva && (
                <div style={st.modalOverlay}>
                    <div style={{ ...st.modalCard, maxWidth: 440, textAlign: 'center' }}>

                        {estadoGuardar === 'EXITO' ? (
                            <>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                                <h2 style={{ color: 'white', margin: '0 0 8px' }}>¡Partida guardada!</h2>
                                <p style={{ color: '#94a3b8', marginBottom: 20 }}>Comparte este código con los jugadores para continuar en otro momento:</p>
                                <div style={{ background: '#0f172a', border: '2px solid #38bdf8', borderRadius: 14, padding: '18px 24px', marginBottom: 24 }}>
                                    <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#38bdf8', letterSpacing: 8 }}>{codigoPartidaGenerado}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 6 }}>Válido 7 días desde la última actividad</div>
                                </div>
                                <button onClick={() => { setEstadoGuardar(null); setCodigoProfesorGuardar(''); setPausaActiva(false); }} style={{ ...st.btnRoll, padding: '14px 0', width: '100%' }}>▶ Continuar jugando</button>
                            </>
                        ) : (
                            <>
                                <h2 style={{ color: 'white', margin: '0 0 24px', fontSize: '1.8rem' }}>⏸ Pausa</h2>

                                {estadoGuardar === null && (
                                    <>
                                        <p style={{ color: '#64748b', margin: '0 0 20px', fontSize: '0.9rem' }}>Introduce el código de tu profesor para guardar la partida:</p>
                                        <input
                                            type="text"
                                            value={codigoProfesorGuardar}
                                            onChange={e => setCodigoProfesorGuardar(e.target.value.toUpperCase())}
                                            placeholder="CÓDIGO DEL PROFESOR"
                                            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, background: '#0f172a', color: 'white', border: '2px solid #475569', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', marginBottom: 12, letterSpacing: 3, textAlign: 'center' }}
                                        />
                                        <button
                                            onClick={guardarPartida}
                                            disabled={!codigoProfesorGuardar.trim()}
                                            style={{ ...st.btnRoll, background: codigoProfesorGuardar.trim() ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : '#1e293b', width: '100%', padding: '14px 0', marginBottom: 10, opacity: codigoProfesorGuardar.trim() ? 1 : 0.5, cursor: codigoProfesorGuardar.trim() ? 'pointer' : 'not-allowed' }}
                                        >
                                            💾 Guardar partida
                                        </button>
                                        {errorGuardar && <p style={{ color: '#e74c3c', margin: '0 0 12px', fontSize: '0.9rem' }}>{errorGuardar}</p>}
                                    </>
                                )}

                                {estadoGuardar === 'GUARDANDO' && (
                                    <p style={{ color: '#94a3b8', margin: '10px 0 20px' }}>Guardando partida…</p>
                                )}

                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                    <button onClick={() => { setPausaActiva(false); setEstadoGuardar(null); setErrorGuardar(''); setCodigoProfesorGuardar(''); }} style={{ flex: 1, background: 'rgba(56,189,248,0.1)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>▶ Continuar</button>
                                    {onExit && <button onClick={onExit} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>🚪 Salir</button>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .animate-spin { animation: spin 0.5s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes popIn { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}

// ─── 4. ESTILOS ───────────────────────────────────────────────────────────────
const st = {
    appContainer: { position: 'relative', display: 'flex', height: '100vh', width: '100vw', background: 'radial-gradient(circle at center, #1e293b, #020617)', fontFamily: "'Segoe UI', Tahoma, sans-serif", overflow: 'hidden' },
    
    playerCardFloating: { position: 'absolute', width: 220, background: 'rgba(15, 23, 42, 0.85)', padding: 15, borderRadius: 15, transition: 'transform 0.3s, box-shadow 0.3s', zIndex: 10, backdropFilter: 'blur(5px)' },
    
    controlsFloating: { position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30, 41, 59, 0.95)', padding: '20px 30px', borderRadius: 25, zIndex: 20, display: 'flex', alignItems: 'center', gap: 30, boxShadow: '0 15px 40px rgba(0,0,0,0.6)', border: '2px solid #475569', backdropFilter: 'blur(10px)' },
    
    btnRoll: { background: 'linear-gradient(135deg, #38bdf8, #2563eb)', color: 'white', border: 'none', padding: 20, fontSize: '1.3rem', fontWeight: 'bold', borderRadius: 30, boxShadow: '0 10px 30px rgba(37,99,235,0.5)', transition: '0.2s' },
    
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalCard: { background: '#1e293b', padding: 45, borderRadius: 25, width: '100%', maxWidth: 550, boxShadow: '0 30px 60px rgba(0,0,0,0.7)', animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    btnAnswer: { width: '100%', background: '#334155', border: '2px solid #475569', color: 'white', padding: 20, borderRadius: 15, fontSize: '1.2rem', cursor: 'pointer', transition: '0.2s', textAlign: 'left', fontWeight: 'bold', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }
};