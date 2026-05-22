import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dices, Trophy, ArrowLeft, Timer, Users, Play } from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import PREGUNTAS_JSON from './preguntas_trivial.json';
import correctSound from './assets/correct-choice-43861.mp3';
import wrongSound from './assets/negative_beeps-6008.mp3';
import Confetti from 'react-confetti';

// ─── SONIDOS ──────────────────────────────────────────────────────────────────
const playCorrectSound = () => { try { new Audio(correctSound).play(); } catch(e) {} };
const playWrongSound   = () => { try { new Audio(wrongSound).play();   } catch(e) {} };

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
    } catch(e) { console.log("Audio no soportado"); }
};

// ─── 1. BASE DE DATOS Y CONFIGURACIÓN ──────────────────────────────────────────
const COLORS = [
    { id: 'geo', hex: '#3498db', name: 'Geografía' },
    { id: 'esp', hex: '#e84393', name: 'Espectáculos' },
    { id: 'his', hex: '#f1c40f', name: 'Historia' },
    { id: 'art', hex: '#9b59b6', name: 'Arte y Lit.' },
    { id: 'cie', hex: '#2ecc71', name: 'Ciencias' },
    { id: 'dep', hex: '#e67e22', name: 'Deportes' }
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
    // ─── ESTADOS DE CONFIGURACIÓN ───
    const [pantalla, setPantalla] = useState('INTRO'); // INTRO, SETUP, PLAYING
    const [numPlayers, setNumPlayers] = useState(4);
    const [nombres, setNombres] = useState(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4', 'Jugador 5', 'Jugador 6']);
    
    // ─── ESTADOS DEL JUEGO ───
    const [players, setPlayers] = useState([]);
    const [activePlayerIdx, setActivePlayerIdx] = useState(0);
    const [gameState, setGameState] = useState('WAITING_ROLL'); 
    const [diceVal, setDiceVal] = useState(null);
    const [modalData, setModalData] = useState(null); 
    const [timeLeft, setTimeLeft] = useState(15); 

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
    
    // ─── INICIAR JUEGO ───
    const iniciarJuego = async () => {
        setCargando(true);
        let pregsFinales = PREGUNTAS;

        if (fuentePreguntas === 'JSON') {
            pregsFinales = PREGUNTAS_JSON;
        } else if (fuentePreguntas === 'FIREBASE' && codigoFirebase.trim()) {
            try {
                // Buscar el recurso por codigoJuego en trivial_recursos
                const recursoSnap = await getDocs(query(
                    collection(db, 'trivial_recursos'),
                    where('codigoJuego', '==', codigoFirebase.trim().toUpperCase())
                ));
                if (!recursoSnap.empty) {
                    const recursoId = recursoSnap.docs[0].id;
                    const pregSnap = await getDocs(
                        collection(db, 'trivial_recursos', recursoId, 'preguntas')
                    );
                    const fbPregs = {};
                    pregSnap.forEach(d => {
                        const data = d.data();
                        if (data.categoria && data.q && data.a) {
                            if (!fbPregs[data.categoria]) fbPregs[data.categoria] = [];
                            fbPregs[data.categoria].push({ q: data.q, a: data.a, w: data.w || [] });
                        }
                    });
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
        setPantalla('PLAYING');
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

            preguntasRef.current = PREGUNTAS_JSON;
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
        if (gameState === 'QUESTION' && timeLeft > 0) {
            timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
        } else if (gameState === 'QUESTION' && timeLeft === 0) {
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

    // ─── MANEJADOR DE LLEGADA (PREGUNTAS) ───
    handleArrivalRef.current = useCallback((node) => {
        const catId = node.color.id;
        const isCenter = node.type === 'center';
        const p = players[activePlayerIdx];
        const isFinal = isCenter && p.wedges.length === 6;
        
        let qCat = isCenter ? COLORS[Math.floor(Math.random() * COLORS.length)].id : catId;
        const qList = preguntasRef.current[qCat] || preguntasRef.current['geo'] || PREGUNTAS['geo'];
        const qData = qList[Math.floor(Math.random() * qList.length)];

        setTimeLeft(15);
        setGameState('QUESTION');
        setModalData({
            node, isFinal,
            color: isCenter ? { hex: '#3498db', name: 'Centro Final' } : node.color,
            question: qData.q,
            correct: qData.a,
            answers: [qData.a, ...qData.w].sort(() => Math.random() - 0.5)
        });
    }, [activePlayerIdx, players]);


    // ─── INTERACCIONES DE UI ───
    const tirarDado = () => {
        if (pausaActiva || gameState !== 'WAITING_ROLL') return;
        setGameState('ROLLING');
        
        setTimeout(() => {
            const roll = Math.floor(Math.random() * 6) + 1;
            setDiceVal(roll);
            setGameState('SELECTING');
            
            const eng = engineRef.current;
            const currentPos = eng.playersPos[activePlayerIdx].node;
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

    const responderPregunta = (isCorrect) => {
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
        } else {
            setActivePlayerIdx(prev => (prev + 1) % players.length); 
            setGameState('WAITING_ROLL');
        }
        setModalData(null);
        setDiceVal(null);
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER: PANTALLA SETUP
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // RENDER: PANTALLA INTRO
    // ════════════════════════════════════════════════════════════════════════
    if (pantalla === 'INTRO') {
        const totalPreguntas = Object.values(PREGUNTAS_JSON).flat().length;
        return (
            <div style={{ ...st.appContainer, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: 0 }}>

                {/* Cabecera de colores de categoría */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                    {COLORS.map(c => (
                        <div key={c.id} style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, boxShadow: `0 0 16px ${c.hex}cc` }} />
                    ))}
                </div>

                <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 8vw, 5rem)', margin: 0, fontWeight: 900, letterSpacing: 6, textShadow: '0 0 50px rgba(255,255,255,0.15)' }}>TRIVIAL</h1>
                <p style={{ color: '#64748b', marginBottom: 50, fontSize: '1.1rem', letterSpacing: 2 }}>JUEGO DE PREGUNTAS</p>

                {/* Dos opciones */}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 820 }}>

                    {/* Opción 1: Preguntas integradas */}
                    <div
                        onClick={() => { setFuentePreguntas('JSON'); setPantalla('SETUP'); }}
                        style={{ flex: 1, minWidth: 300, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 24, padding: 36, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s, transform 0.2s', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        {/* Barra de colores decorativa */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, display: 'flex' }}>
                            {COLORS.map(c => <div key={c.id} style={{ flex: 1, background: c.hex }} />)}
                        </div>
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>🎮</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Jugar ahora</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            {totalPreguntas} preguntas integradas repartidas en las 6 categorías clásicas. Listo para jugar sin ningún código.
                        </p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                            {COLORS.map(c => (
                                <span key={c.id} style={{ background: c.hex, color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{c.name}</span>
                            ))}
                        </div>
                        <button style={{ background: 'linear-gradient(135deg, #38bdf8, #2563eb)', color: 'white', border: 'none', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 8px 25px rgba(37,99,235,0.4)' }}>
                            Jugar con preguntas integradas →
                        </button>
                    </div>

                    {/* Opción 2: Buscar Trivial */}
                    <div
                        style={{ flex: 1, minWidth: 300, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 24, padding: 36, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }} />
                        <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>🔍</div>
                        <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.6rem' }}>Buscar Trivial</h2>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                            Introduce el código que te ha dado tu profesor para cargar sus preguntas personalizadas.
                        </p>
                        <input
                            type="text"
                            placeholder="Código del juego (ej: AB3K7F)…"
                            value={codigoFirebase}
                            onChange={e => setCodigoFirebase(e.target.value.toUpperCase())}
                            onKeyDown={e => { if (e.key === 'Enter' && codigoFirebase.trim()) { setFuentePreguntas('FIREBASE'); setPantalla('SETUP'); } }}
                            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, background: '#0f172a', color: 'white', border: '2px solid #475569', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'monospace' }}
                        />
                        <button
                            onClick={() => { if (codigoFirebase.trim()) { setFuentePreguntas('FIREBASE'); setPantalla('SETUP'); } }}
                            disabled={!codigoFirebase.trim()}
                            style={{ background: codigoFirebase.trim() ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : '#1e293b', color: codigoFirebase.trim() ? 'white' : '#475569', border: '2px solid', borderColor: codigoFirebase.trim() ? 'transparent' : '#334155', padding: '14px 0', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: codigoFirebase.trim() ? 'pointer' : 'not-allowed', width: '100%', transition: '0.2s', boxShadow: codigoFirebase.trim() ? '0 8px 25px rgba(168,85,247,0.4)' : 'none' }}
                        >
                            Cargar preguntas y jugar →
                        </button>
                        {onBuscar && (
                            <button
                                onClick={onBuscar}
                                style={{ marginTop: 12, background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                            >
                                Buscar en el catálogo de juegos
                            </button>
                        )}
                    </div>

                    {/* Opción 3: Continuar partida */}
                    <div style={{ flex: 1, minWidth: 300, background: 'rgba(30,41,59,0.9)', border: '2px solid #334155', borderRadius: 24, padding: 36, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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

    if (pantalla === 'SETUP') {
        return (
            <div style={{ ...st.appContainer, justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.95)', padding: 40, borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '2px solid #334155' }}>
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

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ color: 'white', fontWeight: 'bold', display: 'block', marginBottom: 10 }}>Fuente de Preguntas:</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[
                                { id: 'INTERNO', label: '🎮 Internas' },
                                { id: 'JSON',    label: '📄 Archivo JSON' },
                                { id: 'FIREBASE', label: '🔥 Firebase' }
                            ].map(f => (
                                <button key={f.id} onClick={() => setFuentePreguntas(f.id)} style={{
                                    flex: 1, padding: '10px 5px', borderRadius: 10, border: '2px solid',
                                    borderColor: fuentePreguntas === f.id ? '#38bdf8' : '#334155',
                                    background: fuentePreguntas === f.id ? 'rgba(56,189,248,0.15)' : 'transparent',
                                    color: fuentePreguntas === f.id ? '#38bdf8' : '#94a3b8',
                                    cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'
                                }}>{f.label}</button>
                            ))}
                        </div>
                        {fuentePreguntas === 'JSON' && (
                            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 8, lineHeight: 1.5 }}>
                                Usando <code style={{ color: '#38bdf8' }}>preguntas_trivial.json</code> — {Object.values(PREGUNTAS_JSON).flat().length} preguntas en {Object.keys(PREGUNTAS_JSON).length} categorías.
                            </p>
                        )}
                        {fuentePreguntas === 'FIREBASE' && (
                            <input
                                type="text"
                                value={codigoFirebase}
                                onChange={e => setCodigoFirebase(e.target.value.toUpperCase())}
                                placeholder="Código del juego (ej: AB3K7F)"
                                style={{ width: '100%', marginTop: 10, padding: '10px 15px', borderRadius: 10, background: '#0f172a', color: 'white', border: '2px solid #38bdf8', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'monospace' }}
                            />
                        )}
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

                    <button onClick={iniciarJuego} disabled={cargando} style={{ ...st.btnRoll, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: cargando ? 0.7 : 1, cursor: cargando ? 'wait' : 'pointer' }}>
                        <Play size={20}/> {cargando ? 'Cargando preguntas...' : 'Empezar Juego'}
                    </button>
                    <button onClick={() => setPantalla('INTRO')} style={{ width: '100%', background: 'transparent', border: 'none', color: '#64748b', padding: 12, marginTop: 5, cursor: 'pointer', fontWeight: 'bold' }}>← Volver al inicio</button>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENDER: PANTALLA DE JUEGO (LAYOUT ABSOLUTO)
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div style={st.appContainer}>
            {gameState === 'WON' && <Confetti recycle={false} numberOfPieces={800} />}

            {/* BOTÓN SALIR FLOTANTE ARRIBA AL CENTRO */}
            {onExit && (
                <button onClick={onExit} style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(15, 23, 42, 0.8)', color: 'white', border: '1px solid #334155', padding: '10px 20px', borderRadius: 30, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(5px)' }}>
                    <ArrowLeft size={16}/> Salir
                </button>
            )}

            {/* TARJETAS DE JUGADORES FLOTANTES (Esquinas y Lados) */}
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

            {/* ZONA CENTRAL DE JUEGO (CANVAS) */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <div style={{ width: '100%', maxWidth: 800, aspectRatio: '1/1', position: 'relative' }}>
                    <canvas 
                        ref={canvasRef} 
                        width={1000} 
                        height={1000} 
                        onClick={handleCanvasClick}
                        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.8))', cursor: gameState === 'SELECTING' ? 'pointer' : 'default' }}
                    />
                </div>
            </div>

            {/* PANEL DE CONTROLES FLOTANTE (Abajo al Centro) */}
            <div style={st.controlsFloating}>
                <div style={{ textAlign: 'left', minWidth: 200 }}>
                    <div style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Turno Actual</div>
                    <div style={{ fontSize: '1.4rem', color: players[activePlayerIdx]?.color || 'white', fontWeight: 'bold' }}>
                        {players[activePlayerIdx]?.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: 5 }}>
                        {gameState === 'WAITING_ROLL' ? '¡Lanza el dado!' :
                         gameState === 'SELECTING' ? 'Elige una casilla destino' :
                         gameState === 'MOVING' ? 'Saltando...' : 'Respondiendo...'}
                    </div>
                </div>

                <div style={{ fontSize: '3rem', width: 60, textAlign: 'center', textShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                    {gameState === 'ROLLING' ? <Dices className="animate-spin" size={50} color="#38bdf8"/> : diceVal ? <span style={{color: '#f1c40f'}}>{diceVal}</span> : <Dices size={50} color="#94a3b8"/>}
                </div>

                <button
                    onClick={tirarDado}
                    disabled={gameState !== 'WAITING_ROLL'}
                    style={{ ...st.btnRoll, width: 'auto', padding: '15px 30px', opacity: gameState !== 'WAITING_ROLL' ? 0.5 : 1, cursor: gameState !== 'WAITING_ROLL' ? 'not-allowed' : 'pointer', margin: 0 }}
                >
                    Lanzar Dado
                </button>

                <button onClick={() => setPausaActiva(true)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #475569', color: '#94a3b8', width: 46, height: 46, borderRadius: 12, fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏸</button>
            </div>

            {/* MODAL DE PREGUNTAS */}
            {gameState === 'QUESTION' && modalData && (
                <div style={st.modalOverlay}>
                    <div style={{ ...st.modalCard, borderTop: `10px solid ${modalData.color.hex}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: 2, color: modalData.color.hex, fontWeight: 'bold' }}>
                                {modalData.color.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: timeLeft > 5 ? '#94a3b8' : '#e74c3c', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                <Timer size={24}/> {timeLeft}s
                            </div>
                        </div>
                        
                        <div style={{ height: 8, background: '#334155', borderRadius: 4, margin: '15px 0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(timeLeft / 15) * 100}%`, background: timeLeft > 5 ? '#2ecc71' : '#e74c3c', transition: 'width 1s linear, background 0.3s' }} />
                        </div>

                        <h2 style={{ color: 'white', fontSize: '1.7rem', margin: '20px 0 30px', lineHeight: 1.4 }}>{modalData.question}</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {modalData.answers.map((ans, i) => (
                                <button key={i} onClick={() => responderPregunta(ans === modalData.correct)} style={st.btnAnswer}>{ans}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* PANTALLA VICTORIA */}
            {gameState === 'WON' && (
                <div style={st.modalOverlay}>
                    <div style={{ ...st.modalCard, textAlign: 'center', background: '#1e293b' }}>
                        <Trophy size={90} color="#f1c40f" style={{ margin: '0 auto 20px', filter: 'drop-shadow(0 0 20px rgba(241,196,15,0.5))' }}/>
                        <h1 style={{ color: 'white', fontSize: '2.8rem', margin: 0 }}>¡{players[activePlayerIdx].name} GANA!</h1>
                        <p style={{ color: '#94a3b8', fontSize: '1.3rem' }}>Ha reunido los 6 quesitos y superado la prueba final.</p>
                        <button onClick={() => window.location.reload()} style={{ ...st.btnRoll, marginTop: 40 }}>Jugar de nuevo</button>
                    </div>
                </div>
            )}

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