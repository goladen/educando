import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
    ArrowLeft, Edit3, Settings, Clock, Play, Square, RotateCcw,
    PenTool, Type, Circle, Square as SquareIcon, Triangle, Hexagon,
    Box, Calculator as CalcIcon, X, Camera, Activity, ChevronDown, ChevronUp,
    Move, Maximize2, Minimize2, Image as ImageIcon, ZoomIn, ZoomOut, Share2,
    Users, LayoutGrid
} from 'lucide-react';
import Confetti from 'react-confetti';
import GeografiaPanel from './components/GeografiaPanel';
import MusicStaffPanel from './components/MusicStaffPanel';
import MiniAppCreator from './components/MiniAppCreator';
import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// ─── UTILIDADES MATEMÁTICAS ───────────────────────────────────────────────────
// Formatea una expresión amigable a código evaluable por JS
const prepareMathExpr = (expr) => {
    let s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**');
    // Inversas trigonométricas
    s = s.replace(/asin\(/g, 'Math.asin(').replace(/acos\(/g, 'Math.acos(').replace(/atan\(/g, 'Math.atan(');
    // Trigonométricas normales
    s = s.replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(');
    // Logaritmos y raíces
    s = s.replace(/sqrt\(/g, 'Math.sqrt(').replace(/ln\(/g, 'Math.log(').replace(/log\(/g, 'Math.log10(').replace(/exp\(/g, 'Math.exp(');
    // Constantes
    s = s.replace(/π/g, 'Math.PI').replace(/e/g, 'Math.E').replace(/pi/gi, 'Math.PI');
    return s;
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. RULETA DE ALUMNOS
// ══════════════════════════════════════════════════════════════════════════════
const COLORES_RULETA = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];

function RuletaApp() {
    const [alumnosTxt, setAlumnosTxt] = useState("Ana, Luis, Carlos, Marta, Sofía, Diego, Elena, Pablo");
    const [alumnos, setAlumnos] = useState([]);
    const [rotacion, setRotacion] = useState(0);
    const [girando, setGirando] = useState(false);
    const [ganador, setGanador] = useState(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const lista = alumnosTxt.split(/[\n,]+/).map(a => a.trim()).filter(a => a.length > 0);
        setAlumnos(lista.length > 0 ? lista : ["Añade alumnos"]);
    }, [alumnosTxt]);

    useEffect(() => { dibujarRuleta(); }, [alumnos]);

    const dibujarRuleta = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centro = canvas.width / 2;
        const radio = centro - 10;
        const numSecciones = alumnos.length;
        const anguloSeccion = (2 * Math.PI) / numSecciones;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < numSecciones; i++) {
            const anguloInicio = i * anguloSeccion;
            const anguloFin = anguloInicio + anguloSeccion;
            ctx.beginPath();
            ctx.moveTo(centro, centro);
            ctx.arc(centro, centro, radio, anguloInicio, anguloFin);
            ctx.fillStyle = COLORES_RULETA[i % COLORES_RULETA.length];
            ctx.fill();
            ctx.stroke();

            ctx.save();
            ctx.translate(centro, centro);
            ctx.rotate(anguloInicio + anguloSeccion / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = "#fff";
            ctx.font = "bold 18px Arial";
            ctx.fillText(alumnos[i], radio - 20, 6);
            ctx.restore();
        }
    };

    const girar = () => {
        if (girando || alumnos.length < 2) return;
        setGirando(true); setGanador(null);
        const vueltas = Math.floor(Math.random() * 5) + 5; 
        const anguloExtra = Math.random() * 360;
        const rotacionTotal = rotacion + (vueltas * 360) + anguloExtra;
        setRotacion(rotacionTotal);

        setTimeout(() => {
            setGirando(false);
            const gradosFinales = rotacionTotal % 360;
            const gradosNormalizados = (360 - gradosFinales) % 360;
            const anguloPorSeccion = 360 / alumnos.length;
            const indiceGanador = Math.floor(gradosNormalizados / anguloPorSeccion);
            setGanador(alumnos[indiceGanador]);
        }, 4000); 
    };

    return (
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ganador && <Confetti recycle={false} numberOfPieces={400} />}
            <div style={{ flex: 1, minWidth: 300, maxWidth: 400 }}>
                <h3 style={{ color: '#2c3e50', marginTop: 0 }}>Lista de Alumnos</h3>
                <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginBottom: 10 }}>Pega una columna de Excel/Drive o separa por comas.</p>
                <textarea value={alumnosTxt} onChange={e => setAlumnosTxt(e.target.value)} style={{ width: '100%', height: 350, padding: 15, borderRadius: 10, border: '2px solid #bdc3c7', fontSize: '1rem', outline: 'none', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1, minWidth: 350 }}>
                <div style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '20px solid transparent', borderBottom: '20px solid transparent', borderRight: '40px solid #2c3e50', zIndex: 10 }} />
                <div style={{ position: 'relative', width: 400, height: 400, borderRadius: '50%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', overflow: 'hidden', border: '5px solid #2c3e50' }}>
                    <canvas ref={canvasRef} width={400} height={400} style={{ transform: `rotate(${rotacion}deg)`, transition: 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />
                </div>
                <button onClick={girar} disabled={girando} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 80, height: 80, borderRadius: '50%', background: '#fff', border: '5px solid #2c3e50', fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50', cursor: girando ? 'default' : 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 5 }}>GIRAR</button>
                {ganador && (
                    <div style={{ marginTop: 20, background: '#f1c40f', padding: '15px 30px', borderRadius: 15, color: '#2c3e50', fontSize: '2rem', fontWeight: 'bold', animation: 'pop 0.5s', textAlign: 'center', border: '3px solid #e67e22' }}>¡{ganador}!</div>
                )}
            </div>
            <style>{`@keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CRONÓMETRO Y TEMPORIZADOR
// ══════════════════════════════════════════════════════════════════════════════
function RelojApp() {
    const [modo, setModo] = useState('CRONO'); 
    const [tiempo, setTiempo] = useState(0); 
    const [activo, setActivo] = useState(false);
    const [inpMin, setInpMin] = useState(5);
    const [inpSec, setInpSec] = useState(0);
    const [alarmaSonando, setAlarmaSonando] = useState(false);

    useEffect(() => {
        let intervalo = null;
        if (activo) {
            intervalo = setInterval(() => {
                setTiempo(t => {
                    if (modo === 'TEMPO' && t <= 1) {
                        setActivo(false); reproducirAlarma(); return 0;
                    }
                    return modo === 'CRONO' ? t + 1 : t - 1;
                });
            }, 1000);
        }
        return () => clearInterval(intervalo);
    }, [activo, modo]);

    const reproducirAlarma = () => {
        setAlarmaSonando(true);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 800;
        o.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 1.5);
        setTimeout(() => setAlarmaSonando(false), 3000);
    };

    const toggle = () => {
        if (!activo && tiempo === 0 && modo === 'TEMPO') setTiempo(inpMin * 60 + inpSec);
        setActivo(!activo);
    };

    const reset = () => {
        setActivo(false); setTiempo(modo === 'TEMPO' ? inpMin * 60 + inpSec : 0); setAlarmaSonando(false);
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 30 }}>
                <button onClick={() => { setModo('CRONO'); setActivo(false); setTiempo(0); }} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', border: 'none', background: modo === 'CRONO' ? '#3498db' : '#ecf0f1', color: modo === 'CRONO' ? 'white' : '#7f8c8d', cursor: 'pointer' }}>Cronómetro</button>
                <button onClick={() => { setModo('TEMPO'); setActivo(false); setTiempo(inpMin * 60 + inpSec); }} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', border: 'none', background: modo === 'TEMPO' ? '#3498db' : '#ecf0f1', color: modo === 'TEMPO' ? 'white' : '#7f8c8d', cursor: 'pointer' }}>Temporizador</button>
            </div>
            {modo === 'TEMPO' && !activo && tiempo === (inpMin * 60 + inpSec) && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                    <input type="number" min={0} value={inpMin} onChange={e => { setInpMin(Number(e.target.value)); setTiempo(Number(e.target.value) * 60 + inpSec); }} style={{ width: 60, padding: 10, fontSize: '1.2rem', textAlign: 'center', borderRadius: 8, border: '2px solid #bdc3c7' }} /> min
                    <input type="number" min={0} max={59} value={inpSec} onChange={e => { setInpSec(Number(e.target.value)); setTiempo(inpMin * 60 + Number(e.target.value)); }} style={{ width: 60, padding: 10, fontSize: '1.2rem', textAlign: 'center', borderRadius: 8, border: '2px solid #bdc3c7' }} /> seg
                </div>
            )}
            <div style={{ fontSize: '8rem', fontWeight: 'bold', color: alarmaSonando ? '#e74c3c' : '#2c3e50', fontFamily: 'monospace', lineHeight: 1, animation: alarmaSonando ? 'shake 0.5s infinite' : 'none' }}>
                {formatTime(tiempo)}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 40 }}>
                <button onClick={toggle} style={{ width: 80, height: 80, borderRadius: '50%', background: activo ? '#e74c3c' : '#2ecc71', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                    {activo ? <Square size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{ marginLeft: 5 }} />}
                </button>
                <button onClick={reset} style={{ width: 80, height: 80, borderRadius: '50%', background: '#95a5a6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}><RotateCcw size={30} /></button>
            </div>
            <style>{`@keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-10px); } 50% { transform: translateX(10px); } 75% { transform: translateX(-10px); } 100% { transform: translateX(0); } }`}</style>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. PIZARRA INTERACTIVA CON CALCULADORA CIENTÍFICA Y GRAFICADOR
// ══════════════════════════════════════════════════════════════════════════════

// Hook de arrastre para ventanas flotantes
function useDrag(initX, initY) {
    const [pos, setPos] = useState({ x: initX, y: initY });
    const posRef = useRef({ x: initX, y: initY });
    const startDrag = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const ox = e.clientX - posRef.current.x;
        const oy = e.clientY - posRef.current.y;
        const move = (me) => {
            const np = { x: me.clientX - ox, y: Math.max(0, me.clientY - oy) };
            posRef.current = np;
            setPos(np);
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };
    return [pos, startDrag];
}

function GraficadoraFlotante({ onClose, onInsertar }) {
    const [expr, setExpr]     = useState('sin(x)');
    const [scale, setScale]   = useState(40);
    const previewRef          = useRef(null);
    const [pos, startDrag]    = useDrag(Math.max(10, window.innerWidth - 320), 90);

    // Draw preview whenever expr or scale changes
    useEffect(() => {
        const canvas = previewRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const cx = W / 2, cy = H / 2;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#1a2535';
        ctx.fillRect(0, 0, W, H);
        // Grid
        ctx.strokeStyle = '#2d3f55'; ctx.lineWidth = 0.5;
        for (let i = -10; i <= 10; i++) {
            ctx.beginPath(); ctx.moveTo(cx + i * scale, 0); ctx.lineTo(cx + i * scale, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, cy + i * scale); ctx.lineTo(W, cy + i * scale); ctx.stroke();
        }
        // Axes
        ctx.strokeStyle = '#4a6fa5'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
        // Tick labels
        ctx.fillStyle = '#7f9ab5'; ctx.font = '9px Arial'; ctx.textAlign = 'center';
        for (let i = -8; i <= 8; i++) {
            if (i === 0) continue;
            ctx.fillText(i, cx + i * scale, cy + 10);
        }
        // Curve
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
        ctx.beginPath();
        let first = true;
        for (let px = 0; px < W; px++) {
            const x = (px - cx) / scale;
            try {
                // eslint-disable-next-line no-eval
                const y = eval(prepareMathExpr(expr).replace(/x/g, `(${x})`));
                if (!Number.isFinite(y)) { first = true; continue; }
                const py = cy - y * scale;
                if (py < -H || py > 2 * H) { first = true; continue; }
                if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
            } catch { first = true; }
        }
        ctx.stroke();
        // Label
        ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`f(x) = ${expr}`, 6, 14);
    }, [expr, scale]);

    return (
        <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 290, background: '#2c3e50', padding: 14, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 500, color: 'white', userSelect: 'none' }}>
            <div onMouseDown={startDrag} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center', cursor: 'move' }}>
                <span style={{ fontWeight: 'bold' }}><Activity size={15} style={{ verticalAlign: 'middle', marginRight: 5 }}/> Graficador f(x)</span>
                <button onClick={onClose} onMouseDown={e => e.stopPropagation()} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><X size={15}/></button>
            </div>

            {/* Preview canvas */}
            <canvas ref={previewRef} width={262} height={130}
                style={{ display: 'block', width: '100%', borderRadius: 8, marginBottom: 10, border: '1px solid #34495e' }} />

            <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: '0.78rem', color: '#bdc3c7' }}>f(x) = </label>
                <input type="text" value={expr} onChange={e => setExpr(e.target.value)}
                    style={{ width: '100%', padding: 7, borderRadius: 5, border: 'none', marginTop: 4, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', background: '#1a2535', color: '#f1c40f' }}
                    placeholder="Ej: sin(x), x^2, cos(x)/x" />
            </div>

            {/* Zoom controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <button onClick={() => setScale(s => Math.max(10, s - 5))} style={{ background: '#34495e', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><ZoomOut size={14}/></button>
                <input type="range" min="8" max="120" value={scale} onChange={e => setScale(Number(e.target.value))} style={{ flex: 1 }} />
                <button onClick={() => setScale(s => Math.min(120, s + 5))} style={{ background: '#34495e', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><ZoomIn size={14}/></button>
                <span style={{ fontSize: '0.75rem', color: '#bdc3c7', minWidth: 30 }}>×{scale}</span>
            </div>

            <button onClick={() => onInsertar({ funcStr: expr, scale })}
                style={{ width: '100%', padding: 9, border: 'none', borderRadius: 5, background: '#f1c40f', color: '#2c3e50', fontWeight: 'bold', cursor: 'pointer' }}>
                Insertar en Pizarra (vista actual)
            </button>
        </div>
    );
}

function CalculadoraFlotante({ onClose, onCopiar }) {
    const [expr, setExpr] = useState('');
    const [res, setRes] = useState('');
    const [isScientific, setIsScientific] = useState(false);
    const [pos, startDrag] = useDrag(Math.max(10, window.innerWidth - 270), 60);

    const calcular = () => {
        try { 
            const toEval = prepareMathExpr(expr);
            // eslint-disable-next-line no-eval
            const r = eval(toEval);
            setRes(Number.isFinite(r) ? parseFloat(r.toFixed(6)) : 'Error');
        } catch(e) { setRes('Error'); }
    };

    const BasicPad = [
        ['(', ')', 'C', '÷'],
        ['7', '8', '9', '×'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '.', '=', '']
    ];

    const ScientificPad = [
        ['sin(', 'cos(', 'tan(', 'pi'],
        ['asin(', 'acos(', 'atan(', 'e'],
        ['ln(', 'log(', 'sqrt(', '^'],
    ];

    const handleBtn = (btn) => {
        if (btn === 'C') { setExpr(''); setRes(''); }
        else if (btn === '=') calcular();
        else if (btn !== '') setExpr(e => e + btn);
    };

    return (
        <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: isScientific ? 320 : 250, background: '#2c3e50', padding: 15, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 500, transition: 'width 0.2s', userSelect: 'none' }}>
            <div onMouseDown={startDrag} style={{ display: 'flex', justifyContent: 'space-between', color: 'white', marginBottom: 10, alignItems: 'center', cursor: 'move' }}>
                <span style={{ fontWeight: 'bold' }}><CalcIcon size={16} style={{ verticalAlign: 'middle', marginRight: 5 }}/> Calculadora</span>
                <button onClick={onClose} onMouseDown={e => e.stopPropagation()} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><X size={16}/></button>
            </div>
            
            <div style={{ background: '#ecf0f1', padding: 10, borderRadius: 8, marginBottom: 10, minHeight: 40, textAlign: 'right', fontSize: '1.2rem', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>{expr || '0'}</div>
                <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{res}</div>
            </div>

            <button onClick={() => setIsScientific(!isScientific)} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px solid #7f8c8d', color: '#bdc3c7', borderRadius: 5, marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
                {isScientific ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {isScientific ? 'Ocultar Científica' : 'Modo Científico'}
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
                {isScientific && (
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                        {ScientificPad.flat().map((btn, i) => (
                            <button key={`sci-${i}`} onClick={() => handleBtn(btn)} style={{ padding: 8, border: 'none', borderRadius: 5, background: '#34495e', color: '#3498db', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>{btn}</button>
                        ))}
                    </div>
                )}
                
                <div style={{ flex: isScientific ? 1.5 : 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                    {BasicPad.flat().map((btn, i) => (
                        <button key={`bsc-${i}`} onClick={() => handleBtn(btn)} 
                            style={{ 
                                padding: 8, border: 'none', borderRadius: 5, cursor: btn === '' ? 'default' : 'pointer', fontWeight: 'bold',
                                background: btn === '=' ? '#2ecc71' : btn === 'C' ? '#e74c3c' : ['÷','×','-','+'].includes(btn) ? '#f39c12' : '#ecf0f1',
                                color: ['=','C','÷','×','-','+'].includes(btn) ? 'white' : '#2c3e50',
                                visibility: btn === '' ? 'hidden' : 'visible'
                            }}>
                            {btn}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={() => { if(res !== 'Error' && res !== '') onCopiar(res.toString()); }} style={{ width: '100%', marginTop: 10, padding: 10, border: 'none', borderRadius: 5, background: '#f1c40f', color: '#2c3e50', fontWeight: 'bold', cursor: 'pointer' }}>
                Pegar resultado en pizarra
            </button>
        </div>
    );
}

// ─── VISOR 3D INTERACTIVO ─────────────────────────────────────────────────────
const SHAPES_3D = ['prisma', 'pyramid', 'cylinder', 'cone', 'sphere'];

const GEO_MAP = {
    prisma:   () => new THREE.BoxGeometry(3, 3, 3),
    pyramid:  () => new THREE.ConeGeometry(2, 3, 4),
    cylinder: () => new THREE.CylinderGeometry(1.5, 1.5, 4, 32),
    cone:     () => new THREE.ConeGeometry(2, 4, 32),
    sphere:   () => new THREE.SphereGeometry(2, 32, 16),
};

const LABEL_MAP = {
    prisma: 'Cubo / Prisma', pyramid: 'Pirámide', cylinder: 'Cilindro', cone: 'Cono', sphere: 'Esfera',
};

function Visor3D({ shape, onClose, onPegarEnPizarra }) {
    const containerRef  = useRef(null);
    const materialRef   = useRef(null);
    const rendererRef   = useRef(null);
    const sceneRef      = useRef(null);
    const cameraRef     = useRef(null);
    const [colorFig, setColorFig] = useState('#3498db');
    const [pos, startDrag] = useDrag(Math.max(10, window.innerWidth - 300), 60);

    // Actualizar color sin recrear la escena
    useEffect(() => {
        if (materialRef.current) materialRef.current.color.set(colorFig);
    }, [colorFig]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const W = el.clientWidth || 280;
        const H = 200;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f4ff);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
        cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        el.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dl = new THREE.DirectionalLight(0xffffff, 0.9);
        dl.position.set(10, 20, 10);
        scene.add(dl);
        const dl2 = new THREE.DirectionalLight(0x88aaff, 0.3);
        dl2.position.set(-10, 5, -10);
        scene.add(dl2);

        rendererRef.current = renderer;
        const geo = GEO_MAP[shape]();
        const mat = new THREE.MeshStandardMaterial({ color: colorFig, roughness: 0.4, metalness: 0.05 });
        materialRef.current = mat;
        const wireMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.25 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), wireMat));
        scene.add(mesh);

        const box3 = new THREE.Box3().setFromObject(mesh);
        const center = box3.getCenter(new THREE.Vector3());
        const maxDim = Math.max(...box3.getSize(new THREE.Vector3()).toArray());

        const grid = new THREE.GridHelper(maxDim * 4, 10, 0xbbbbbb, 0xdddddd);
        grid.position.y = box3.min.y - 0.01;
        scene.add(grid);

        const dist = maxDim * 2.5;
        camera.position.set(center.x + dist * 0.7, center.y + dist * 0.6, center.z + dist * 0.7);
        controls.target.copy(center);
        controls.update();

        let animId;
        const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
        animate();

        const onResize = () => {
            const nW = el.clientWidth;
            renderer.setSize(nW, H);
            camera.aspect = nW / H;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            controls.dispose();
            renderer.dispose();
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
    }, [shape]); // eslint-disable-line react-hooks/exhaustive-deps

    const pegarEnPizarra = () => {
        const rend = rendererRef.current;
        const scene = sceneRef.current;
        const cam = cameraRef.current;
        if (!rend || !scene || !cam || !onPegarEnPizarra) return;
        rend.render(scene, cam);
        onPegarEnPizarra(rend.domElement.toDataURL('image/png'));
    };

    return (
        <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 280, background: '#1e293b', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 500, overflow: 'hidden', userSelect: 'none' }}>
            {/* Header — drag handle */}
            <div onMouseDown={startDrag} style={{ padding: '7px 10px', background: '#0f172a', color: 'white', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'move' }}>
                <Box size={14} />
                <span style={{ flex: 1 }}>{LABEL_MAP[shape]} <span style={{ fontWeight: 400, color: '#94a3b8' }}>· arrastra para rotar</span></span>
                <button onClick={onClose} onMouseDown={e => e.stopPropagation()} title="Cerrar" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
                    <X size={16} />
                </button>
            </div>
            {/* Color picker */}
            <div style={{ background: '#1e293b', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Color</span>
                <input type="color" value={colorFig} onChange={e => setColorFig(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: 28, height: 28, cursor: 'pointer', padding: 0 }} />
                {['#3498db','#e74c3c','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#ffffff'].map(c => (
                    <button key={c} onClick={() => setColorFig(c)}
                        style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: colorFig === c ? '2px solid white' : '2px solid #475569', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
            </div>
            <div ref={containerRef} style={{ width: '100%', height: 200, cursor: 'grab' }} />
            {/* Paste to pizarra */}
            {onPegarEnPizarra && (
                <button onClick={pegarEnPizarra}
                    style={{ width: '100%', padding: '7px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Camera size={14}/> Pegar en Pizarra
                </button>
            )}
        </div>
    );
}

// ─── NOTACIÓN MUSICAL ─────────────────────────────────────────────────────────
const STAFF_LS = 12;

const MUSIC_NOTE_IDS  = ['redonda','blanca','negra','corchea','semicorchea','fusa'];
const MUSIC_REST_IDS  = ['s_redonda','s_blanca','s_negra','s_corchea'];
const MUSIC_ACC_IDS   = ['sharp','flat','natural'];
const ALL_MUSIC_TOOLS = [...MUSIC_NOTE_IDS, ...MUSIC_REST_IDS, ...MUSIC_ACC_IDS, 'staff','staff_fa'];

const _TREBLE_MIDI_GA = [84,83,81,79,77,76,74,72,71,69,67,65,64,62,60,59,57,55,53,52,50,48,47];
const _BASS_MIDI_GA   = [62,60,59,57,55,53,52,50,48,47,45,43,41,40,38];
const NOTE_BEATS_GA   = { redonda:4, blanca:2, negra:1, corchea:0.5, semicorchea:0.25, fusa:0.125, s_redonda:4, s_blanca:2, s_negra:1, s_corchea:0.5 };
const _yToMidiGA = (noteY, staffItem) => {
    if (!staffItem) return 60;
    const half = (staffItem.ls || STAFF_LS) / 2;
    const step = Math.round((noteY - staffItem.y) / half);
    if (staffItem.clef === 'fa') return _BASS_MIDI_GA[Math.max(0, Math.min(step + 3, _BASS_MIDI_GA.length - 1))];
    return _TREBLE_MIDI_GA[Math.max(0, Math.min(step + 4, _TREBLE_MIDI_GA.length - 1))];
};
const _midiToNameGA = (midi) => {
    const n = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    return `${n[midi % 12]}${Math.floor(midi / 12) - 1}`;
};

const drawStaff = (ctx, item) => {
    const ls = item.ls || STAFF_LS;
    ctx.save();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(item.x, item.y + i * ls); ctx.lineTo(item.x + item.w, item.y + i * ls); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(item.x, item.y); ctx.lineTo(item.x, item.y + 4 * ls); ctx.stroke();
    const clefChar = item.clef === 'fa' ? '𝄢' : '𝄞';
    const clefSize = item.clef === 'fa' ? ls * 3.2 : ls * 4.8;
    const clefY    = item.clef === 'fa' ? item.y + ls * 1.8 : item.y + ls * 3.6;
    ctx.fillStyle = '#111';
    ctx.font = `${clefSize}px serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(clefChar, item.x + 5, clefY);
    ctx.restore();
};

const drawNote = (ctx, item) => {
    const ls  = item.ls || STAFF_LS;
    const rx  = ls * 0.65, ry = ls * 0.44;
    const { x, y, figura, color: nc = '#111', stemUp = true } = item;
    const sxOff = stemUp ? rx - 1 : -rx + 1;
    const stemEndY = y + (stemUp ? -ls * 3.5 : ls * 3.5);
    ctx.save();
    ctx.strokeStyle = nc; ctx.fillStyle = nc; ctx.lineWidth = 1.5;

    const head = (filled) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, -0.25, 0, Math.PI * 2);
        if (filled) { ctx.fill(); }
        else { ctx.fillStyle = 'white'; ctx.fill(); ctx.strokeStyle = nc; ctx.stroke(); ctx.fillStyle = nc; }
    };
    const stem = () => { ctx.beginPath(); ctx.moveTo(x + sxOff, y); ctx.lineTo(x + sxOff, stemEndY); ctx.strokeStyle = nc; ctx.stroke(); };
    const flag = (n) => {
        for (let f = 0; f < n; f++) {
            const fy = stemEndY + f * ls * 0.8 * (stemUp ? 1 : -1);
            ctx.beginPath(); ctx.moveTo(x + sxOff, fy);
            if (stemUp)
                ctx.bezierCurveTo(x + sxOff + ls*1.8, fy + ls*0.8, x + sxOff + ls*1.4, fy + ls*1.7, x + sxOff + ls*0.2, fy + ls*2.2);
            else
                ctx.bezierCurveTo(x + sxOff + ls*1.8, fy - ls*0.8, x + sxOff + ls*1.4, fy - ls*1.7, x + sxOff + ls*0.2, fy - ls*2.2);
            ctx.strokeStyle = nc; ctx.stroke();
        }
    };
    if (figura === 'redonda')     { head(false); }
    if (figura === 'blanca')      { head(false); stem(); }
    if (figura === 'negra')       { head(true);  stem(); }
    if (figura === 'corchea')     { head(true);  stem(); flag(1); }
    if (figura === 'semicorchea') { head(true);  stem(); flag(2); }
    if (figura === 'fusa')        { head(true);  stem(); flag(3); }
    ctx.restore();
};

const drawRest = (ctx, item) => {
    const ls = item.ls || STAFF_LS;
    const { x, y, figura, color: c = '#111' } = item;
    ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.5;
    if (figura === 's_redonda') { ctx.fillRect(x - ls, y, ls * 2, ls * 0.55); }
    else if (figura === 's_blanca') { ctx.fillRect(x - ls, y - ls * 0.55, ls * 2, ls * 0.55); }
    else if (figura === 's_negra') {
        ctx.beginPath();
        ctx.moveTo(x + ls*0.4, y - ls*1.2); ctx.lineTo(x - ls*0.5, y - ls*0.2);
        ctx.lineTo(x + ls*0.4, y + ls*0.2); ctx.lineTo(x - ls*0.4, y + ls*1.2);
        ctx.stroke();
    } else if (figura === 's_corchea') {
        ctx.beginPath(); ctx.moveTo(x + ls*0.5, y - ls*0.8); ctx.lineTo(x - ls*0.4, y + ls*0.8); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + ls*0.5, y - ls*0.5, ls*0.35, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
};

const drawAccidental = (ctx, item) => {
    const ls = item.ls || STAFF_LS;
    const sym = item.figura === 'sharp' ? '♯' : item.figura === 'flat' ? '♭' : '♮';
    ctx.save();
    ctx.font = `bold ${ls * 1.7}px serif`; ctx.fillStyle = item.color || '#111';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(sym, item.x, item.y);
    ctx.restore();
};

// ─────────────────────────────────────────────────────────────────────────────
const COLORES_PARTICIPANTES = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#c0392b'];
const genCodigo = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const serializarElems = (elems) => elems
    .filter(e => e.t !== 'image')
    .map(e => JSON.parse(JSON.stringify(e)));

// Firestore no soporta arrays anidados: cada página se serializa como JSON string
const serializarPaginas = (pgs) => pgs.map(p => JSON.stringify(serializarElems(p)));
const deserializarPaginas = (arr) => (arr || []).map(s => { try { return JSON.parse(s); } catch { return []; } });

// ── España: datos geográficos ────────────────────────────────────────────────
const ESP_GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-provinces.geojson';
const ESP_LON_MIN = -9.5, ESP_LON_MAX = 4.6, ESP_LAT_MIN = 35.7, ESP_LAT_MAX = 43.9;

const ESP_RIOS = [
    { nombre:'Ebro',          pts:[[-3.85,42.90],[-1.80,41.70],[0.87,40.73]] },
    { nombre:'Duero',         pts:[[-2.50,41.77],[-5.20,41.60],[-8.67,41.13]] },
    { nombre:'Tajo',          pts:[[-1.80,40.45],[-4.50,39.90],[-7.20,39.60],[-8.85,38.70]] },
    { nombre:'Guadiana',      pts:[[-2.90,38.90],[-5.80,38.70],[-7.00,38.85],[-7.40,37.20]] },
    { nombre:'Guadalquivir',  pts:[[-2.77,37.80],[-4.60,37.60],[-6.35,37.00]] },
    { nombre:'Miño',          pts:[[-7.50,42.97],[-8.00,41.90],[-8.67,41.88]] },
    { nombre:'Segura',        pts:[[-2.60,38.10],[-1.50,37.90],[-0.70,38.07]] },
    { nombre:'Júcar',         pts:[[-1.80,39.90],[-0.50,39.30],[-0.23,39.18]] },
];
const ESP_MONTANAS = [
    { nombre:'Pirineos',          lon: 0.30, lat:42.60 },
    { nombre:'Cord. Cantábrica',  lon:-5.20, lat:43.30 },
    { nombre:'Sistema Central',   lon:-5.00, lat:40.50 },
    { nombre:'Sistema Ibérico',   lon:-2.00, lat:41.50 },
    { nombre:'Sierra Nevada',     lon:-3.30, lat:37.05 },
    { nombre:'Sierra Morena',     lon:-4.50, lat:38.20 },
    { nombre:'Montes de Toledo',  lon:-4.50, lat:39.60 },
    { nombre:'Macizo Galaico',    lon:-7.80, lat:42.55 },
];
const ESP_CIUDADES = [
    { nombre:'Madrid',     lon:-3.70, lat:40.42, capital:true },
    { nombre:'Barcelona',  lon: 2.17, lat:41.38 },
    { nombre:'Valencia',   lon:-0.38, lat:39.47 },
    { nombre:'Sevilla',    lon:-5.97, lat:37.39 },
    { nombre:'Zaragoza',   lon:-0.87, lat:41.65 },
    { nombre:'Bilbao',     lon:-2.93, lat:43.26 },
    { nombre:'Málaga',     lon:-4.42, lat:36.72 },
    { nombre:'A Coruña',   lon:-8.39, lat:43.37 },
    { nombre:'Murcia',     lon:-1.13, lat:37.99 },
    { nombre:'Valladolid', lon:-4.73, lat:41.65 },
];
const ESP_MARES = [
    { nombre:'Mar Mediterráneo', lon: 2.50, lat:38.20 },
    { nombre:'Océano Atlántico', lon:-9.80, lat:40.50 },
    { nombre:'Mar Cantábrico',   lon:-4.00, lat:44.20 },
];

// Projection: equirectangular corregida para España
const _proyEsp = (lon, lat, W, H, pad = 40) => {
    const cosLat = Math.cos(39.7 * Math.PI / 180);
    const lonSpan = (ESP_LON_MAX - ESP_LON_MIN) * cosLat;
    const latSpan = ESP_LAT_MAX - ESP_LAT_MIN;
    const useW = W - 2 * pad, useH = H - 2 * pad;
    const scale = Math.min(useW / lonSpan, useH / latSpan);
    const ox = pad + (useW - lonSpan * scale) / 2;
    const oy = pad + (useH - latSpan * scale) / 2;
    return { x: ox + (lon - ESP_LON_MIN) * cosLat * scale, y: oy + (ESP_LAT_MAX - lat) * scale };
};
// Draw one GeoJSON feature (Polygon/MultiPolygon) onto ctx using proj function
const _drawGeoFeature = (ctx, feature, proj) => {
    const geom = feature.geometry;
    if (!geom) return;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    polys.forEach(poly => {
        ctx.beginPath();
        poly[0].forEach(([lon, lat], i) => {
            const { x, y } = proj(lon, lat);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    });
};
// Centroid of the largest polygon ring
const _centroidGeo = (feature) => {
    const geom = feature.geometry;
    if (!geom) return null;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    const main = polys.reduce((a, b) => a[0].length >= b[0].length ? a : b);
    const ring = main[0];
    let sLon = 0, sLat = 0;
    ring.forEach(([lon, lat]) => { sLon += lon; sLat += lat; });
    return { lon: sLon / ring.length, lat: sLat / ring.length };
};

const CORDILLERAS = [
    { nombre: 'Andes', region: 'América del Sur' },
    { nombre: 'Himalaya', region: 'Asia' },
    { nombre: 'Alpes', region: 'Europa' },
    { nombre: 'Pirineos', region: 'Europa' },
    { nombre: 'Montañas Rocosas', region: 'América del Norte' },
    { nombre: 'Urales', region: 'Europa/Asia' },
    { nombre: 'Atlas', region: 'África' },
    { nombre: 'Cárpatos', region: 'Europa' },
    { nombre: 'Sierra Nevada', region: 'España' },
    { nombre: 'Cordillera Cantábrica', region: 'España' },
    { nombre: 'Sistema Central', region: 'España' },
    { nombre: 'Apeninos', region: 'Europa' },
    { nombre: 'Cáucaso', region: 'Europa/Asia' },
    { nombre: 'Karakórum', region: 'Asia' },
    { nombre: 'Tian Shan', region: 'Asia' },
    { nombre: 'Grandes Apalaches', region: 'América del Norte' },
];

const RIOS = [
    { nombre: 'Amazonas', region: 'América del Sur' },
    { nombre: 'Nilo', region: 'África' },
    { nombre: 'Yangtsé', region: 'Asia' },
    { nombre: 'Misisipi', region: 'América del Norte' },
    { nombre: 'Danubio', region: 'Europa' },
    { nombre: 'Rin', region: 'Europa' },
    { nombre: 'Volga', region: 'Europa' },
    { nombre: 'Orinoco', region: 'América del Sur' },
    { nombre: 'Ganges', region: 'Asia' },
    { nombre: 'Éufrates', region: 'Asia' },
    { nombre: 'Tigris', region: 'Asia' },
    { nombre: 'Mekong', region: 'Asia' },
    { nombre: 'Níger', region: 'África' },
    { nombre: 'Zambeze', region: 'África' },
    { nombre: 'Congo', region: 'África' },
    { nombre: 'Ebro', region: 'España' },
    { nombre: 'Tajo', region: 'España/Portugal' },
    { nombre: 'Guadalquivir', region: 'España' },
    { nombre: 'Duero', region: 'España/Portugal' },
    { nombre: 'Támesis', region: 'Europa' },
    { nombre: 'Sena', region: 'Europa' },
    { nombre: 'Po', region: 'Europa' },
    { nombre: 'Tíber', region: 'Europa' },
    { nombre: 'Misuri', region: 'América del Norte' },
    { nombre: 'Colorado', region: 'América del Norte' },
];

// ─────────────────────────────────────────────────────────────────────────────
function PizarraApp() {
    const canvasRef      = useRef(null);
    const contenedorRef  = useRef(null);
    const fileInputRef   = useRef(null);
    const imageCacheRef  = useRef({});
    const panRef         = useRef({ x: 0, y: 0 });
    const panStartRef    = useRef(null);
    const selMoveRef     = useRef(null);

    const [herramienta,    setHerramienta]    = useState('draw');
    const [color,          setColor]          = useState('#2c3e50');
    const [grosor,         setGrosor]         = useState(3);
    const [dibujando,      setDibujando]      = useState(false);
    const [inicioXY,       setInicioXY]       = useState({ x: 0, y: 0 });
    const [previewElement, setPreviewElement] = useState(null);
    const [calcVisible,    setCalcVisible]    = useState(false);
    const [grafVisible,    setGrafVisible]    = useState(false);
    const [geoVisible,     setGeoVisible]     = useState(false);
    const [geoTool,        setGeoTool]        = useState(null);
    const [geoBusqueda,    setGeoBusqueda]    = useState('');
    const [geoCargando,    setGeoCargando]    = useState(false);
    const [geoPaisData,    setGeoPaisData]    = useState(null);
    const [pendingInsert,  setPendingInsert]  = useState(null);
    const [ladosPoligono,  setLadosPoligono]  = useState(5);
    const [imgMenuOpen,    setImgMenuOpen]    = useState(false);
    const [imgBuscador,    setImgBuscador]    = useState(false);
    const [imgQuery,       setImgQuery]       = useState('');
    const [imgResults,     setImgResults]     = useState([]);
    const [imgSearching,   setImgSearching]   = useState(false);
    const [textoPegar,     setTextoPegar]     = useState('');
    const [graficaConfig,  setGraficaConfig]  = useState(null);
    const [fullscreen,     setFullscreen]     = useState(false);
    const [redrawTick,     setRedrawTick]     = useState(0);
    const [modoPizarra,    setModoPizarra]    = useState('general');

    // Multi-page
    const [paginas,   setPaginas]   = useState([[]]);
    const [paginaIdx, setPaginaIdx] = useState(0);
    const elementos    = paginas[paginaIdx] ?? [];
    const setElementos = (fn) => setPaginas(ps => ps.map((p, i) =>
        i !== paginaIdx ? p : typeof fn === 'function' ? fn(p) : fn));

    // Lasso / selection
    const [selIdxs,        setSelIdxs]        = useState([]);
    const [lassoRect,      setLassoRect]      = useState(null);
    const [clipboardRegion, setClipboardRegion] = useState(null); // { src, w, h }
    const selHandleRef = useRef(null);

    // Text tool
    const [textoInput,       setTextoInput]       = useState('');
    const [textoFontSize,    setTextoFontSize]    = useState(24);
    const [emojiPanelOpen,   setEmojiPanelOpen]   = useState(false);
    const [escuchando,       setEscuchando]       = useState(false);
    const recognitionRef = useRef(null);

    // ── Music staff with sound ────────────────────────────────────────────────
    const [showMusicStaff,  setShowMusicStaff]  = useState(false);
    const [musicPlayingId,  setMusicPlayingId]  = useState(null);
    const musicPlayHitRef = useRef([]);
    const sfAcRef         = useRef(null);
    const sfPianoRef      = useRef(null);
    const sfStopRef       = useRef(false);

    // ── Pizarra compartida ───────────────────────────────────────────────────
    const [compartirModal,       setCompartirModal]       = useState(false);
    const [modoCompartir,        setModoCompartir]        = useState(null);   // 'ver' | 'editar' | null
    const [codigoCompartir,      setCodigoCompartir]      = useState('');
    const [esCreador,            setEsCreador]            = useState(false);
    const [miId,                 setMiId]                 = useState('');
    const [miColorParticipante,  setMiColorParticipante]  = useState('');
    const [participantes,        setParticipantes]        = useState([]);
    const [nombreUnirse,         setNombreUnirse]         = useState('');
    const [codigoUnirseInput,    setCodigoUnirseInput]    = useState('');
    const [errorCompartir,       setErrorCompartir]       = useState('');
    const [juntandose,           setJuntandose]           = useState(false);
    const [copiadoLink,          setCopiadoLink]          = useState(false);
    const syncIntervalRef        = useRef(null);
    const miIdRef                = useRef('');
    const miColorRef             = useRef('');
    const codigoRef              = useRef('');
    const modoRef                = useRef(null);
    const paginasRef             = useRef(paginas);

    const triggerRedraw = () => setRedrawTick(t => t + 1);

    // Keep paginasRef in sync for access inside intervals
    useEffect(() => { paginasRef.current = paginas; }, [paginas]);

    // Detectar ?pizarra=CODIGO en la URL al montar → pre-rellenar el campo de unirse
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const cod = params.get('pizarra');
        if (cod) {
            setCodigoUnirseInput(cod.toUpperCase());
            setCompartirModal(true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Captura del anotador: insertar imagen al montar
    useEffect(() => {
        const dataURL = sessionStorage.getItem('pizarraCaptura');
        if (!dataURL) return;
        sessionStorage.removeItem('pizarraCaptura');
        const img = new Image();
        img.onload = () => {
            const maxW = 700, maxH = 500;
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
            const id = Date.now();
            imageCacheRef.current[id] = img;
            setElementos(prev => [...prev, { t: 'image', id, src: dataURL, x: 40, y: 60, w, h }]);
        };
        img.src = dataURL;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Lógica de compartir ──────────────────────────────────────────────────
    const detenerSync = () => {
        if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
    };

    const iniciarSync = (codigo, modo, id, soyCreador) => {
        detenerSync();
        syncIntervalRef.current = setInterval(async () => {
            try {
                if (modo === 'ver' && soyCreador) {
                    // Creador del modo ver → escribe sus páginas
                    await updateDoc(doc(db, 'pizarras_compartidas', codigo), {
                        paginas_sync: serializarPaginas(paginasRef.current),
                        updatedAt: new Date(),
                    });
                } else if (modo === 'ver') {
                    // Espectador → lee y reemplaza todo
                    const snap = await getDoc(doc(db, 'pizarras_compartidas', codigo));
                    if (!snap.exists()) return;
                    const datos = snap.data();
                    if (datos.paginas_sync) {
                        setPaginas(deserializarPaginas(datos.paginas_sync));
                    }
                } else if (modo === 'editar') {
                    // Participante colaborativo
                    const myId = miIdRef.current;
                    const pg = paginasRef.current[0] || [];
                    const mios = serializarElems(pg.filter(e => e.autorId === myId));
                    await updateDoc(doc(db, 'pizarras_compartidas', codigo), {
                        [`elems.${myId}`]: mios,
                        updatedAt: new Date(),
                    });
                    const snap = await getDoc(doc(db, 'pizarras_compartidas', codigo));
                    if (!snap.exists()) return;
                    const datos = snap.data();
                    setParticipantes(datos.participantes || []);
                    const elemsRemotos = Object.entries(datos.elems || {})
                        .filter(([pid]) => pid !== myId)
                        .flatMap(([, arr]) => arr || []);
                    setPaginas(prev => {
                        const pg0 = prev[0] || [];
                        const miosActuales = pg0.filter(e => e.autorId === myId || !e.autorId);
                        const merged = [...miosActuales, ...elemsRemotos];
                        return [merged, ...prev.slice(1)];
                    });
                }
            } catch (_) { /* silencioso */ }
        }, 2000);
    };

    const crearSesion = async (modo) => {
        setErrorCompartir('');
        const codigo = genCodigo();
        const id = 'host_' + Date.now();
        const color = COLORES_PARTICIPANTES[0];
        miIdRef.current = id;
        miColorRef.current = color;
        codigoRef.current = codigo;
        modoRef.current = modo;
        const data = {
            codigo,
            modo,
            createdAt: new Date(),
            updatedAt: new Date(),
            participantes: [{ id, nombre: 'Profesor', color }],
            ...(modo === 'ver'
                ? { paginas_sync: serializarPaginas(paginas) }
                : { elems: { [id]: serializarElems(elementos) } }
            ),
        };
        await setDoc(doc(db, 'pizarras_compartidas', codigo), data);
        setCodigoCompartir(codigo);
        setModoCompartir(modo);
        setEsCreador(true);
        setMiId(id);
        setMiColorParticipante(color);
        setParticipantes([{ id, nombre: 'Profesor', color }]);
        iniciarSync(codigo, modo, id, true);
    };

    const unirseASesion = async () => {
        const codigo = codigoUnirseInput.trim().toUpperCase();
        const nombre = nombreUnirse.trim();
        if (!codigo || !nombre) { setErrorCompartir('Introduce código y nombre'); return; }
        setJuntandose(true); setErrorCompartir('');
        try {
            const snap = await getDoc(doc(db, 'pizarras_compartidas', codigo));
            if (!snap.exists()) { setErrorCompartir('Código no encontrado'); setJuntandose(false); return; }
            const datos = snap.data();
            const modo = datos.modo;
            const usedColors = (datos.participantes || []).map(p => p.color);
            const color = COLORES_PARTICIPANTES.find(c => !usedColors.includes(c)) || COLORES_PARTICIPANTES[0];
            const id = 'user_' + Date.now();
            miIdRef.current = id;
            miColorRef.current = color;
            codigoRef.current = codigo;
            modoRef.current = modo;
            const nuevoParticipante = { id, nombre, color };
            if (modo === 'editar') {
                await updateDoc(doc(db, 'pizarras_compartidas', codigo), {
                    participantes: [...(datos.participantes || []), nuevoParticipante],
                    [`elems.${id}`]: [],
                });
            }
            setCodigoCompartir(codigo);
            setModoCompartir(modo);
            setEsCreador(false);
            setMiId(id);
            setMiColorParticipante(color);
            setParticipantes([...(datos.participantes || []), nuevoParticipante]);
            setCompartirModal(false);
            iniciarSync(codigo, modo, id, false);
        } catch (e) { setErrorCompartir('Error: ' + e.message); }
        setJuntandose(false);
    };

    const pararCompartir = () => {
        detenerSync();
        setModoCompartir(null);
        setCodigoCompartir('');
        setEsCreador(false);
        setMiId('');
        setMiColorParticipante('');
        setParticipantes([]);
        miIdRef.current = '';
        miColorRef.current = '';
        codigoRef.current = '';
        modoRef.current = null;
    };

    // Limpiar interval al desmontar
    useEffect(() => () => detenerSync(), []);

    // ── Fin lógica compartir ─────────────────────────────────────────────────

    // Tag elem with author in collaborative mode
    const tagElem = (elem) => {
        if (modoRef.current !== 'editar' || !miIdRef.current) return elem;
        return { ...elem, autorId: miIdRef.current, autorColor: miColorRef.current };
    };

    // ── Music staff with sound ────────────────────────────────────────────────
    const _loadSfPiano = async () => {
        if (sfPianoRef.current) return sfPianoRef.current;
        if (!sfAcRef.current) sfAcRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const Soundfont = (await import('soundfont-player')).default;
        sfPianoRef.current = await Soundfont.instrument(sfAcRef.current, 'acoustic_grand_piano', { soundfont: 'MusyngKite' });
        return sfPianoRef.current;
    };

    const stopSfMusic = () => { sfStopRef.current = true; setMusicPlayingId(null); };

    const playSfMusic = async (id, items, bpm) => {
        stopSfMusic();
        await new Promise(r => setTimeout(r, 60));
        sfStopRef.current = false;
        setMusicPlayingId(id);
        try {
            const piano = await _loadSfPiano();
            const staffItem = items.find(i => i.t === 'staff');
            const notes = items.filter(i => i.t === 'note' || i.t === 'rest').sort((a, b) => a.x - b.x);
            if (!notes.length) { setMusicPlayingId(null); return; }
            const secPerBeat = 60 / (bpm || 90);
            for (const note of notes) {
                if (sfStopRef.current) break;
                const beats = NOTE_BEATS_GA[note.figura] || 1;
                const dur = beats * secPerBeat;
                if (note.t === 'note' && staffItem) {
                    const midi = _yToMidiGA(note.y, staffItem);
                    piano.play(_midiToNameGA(midi), sfAcRef.current.currentTime, { duration: dur * 0.9 });
                }
                await new Promise(r => setTimeout(r, dur * 1000));
            }
        } finally {
            if (!sfStopRef.current) setMusicPlayingId(null);
        }
    };

    const handleInsertMusicStaff = ({ imageData, items, bpm }) => {
        const id = Date.now();
        const img = new Image();
        img.src = imageData;
        imageCacheRef.current[id] = img;
        setElementos(prev => [...prev, tagElem({ t: 'music_staff', id, src: imageData, items, bpm, x: 40, y: 60, w: 600, h: 160 })]);
        setShowMusicStaff(false);
    };

    // ── Voice input ─────────────────────────────────────────────────────────
    const toggleVoz = () => {
        const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SRClass) { alert('Tu navegador no soporta reconocimiento de voz. Prueba con Chrome.'); return; }
        if (escuchando) { recognitionRef.current?.stop(); setEscuchando(false); return; }
        const r = new SRClass();
        r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
        r.onresult = (ev) => {
            const txt = ev.results[0][0].transcript;
            setTextoInput(prev => prev ? prev + ' ' + txt : txt);
        };
        r.onend = () => setEscuchando(false);
        r.onerror = () => setEscuchando(false);
        recognitionRef.current = r;
        r.start();
        setEscuchando(true);
    };

    // Fullscreen
    const toggleFullscreen = () => {
        const el = contenedorRef.current;
        if (!document.fullscreenElement) el.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
        else document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    };
    useEffect(() => {
        const h = () => setFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    useEffect(() => { dibujarCanvas(); }, [elementos, previewElement, redrawTick, paginaIdx, selIdxs, lassoRect]);

    // ── Image cache ─────────────────────────────────────────────────────────
    const getOrLoadImg = (item) => {
        if (imageCacheRef.current[item.id]) return imageCacheRef.current[item.id];
        const img = new Image();
        img.src = item.src;
        img.onload = () => { imageCacheRef.current[item.id] = img; triggerRedraw(); };
        return null;
    };

    // ── Save / export ───────────────────────────────────────────────────────
    const renderPaginaTo = (offCanvas, elemLista) => {
        const ctx = offCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        elemLista.forEach(item => dibujarItem(ctx, item, false));
    };

    const descargarPagina = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        Object.assign(document.createElement('a'), { download: `Pizarra_H${paginaIdx + 1}.png`, href: canvas.toDataURL('image/png') }).click();
    };

    const descargarTodasPNG = () => {
        paginas.forEach((pg, i) => {
            const off = Object.assign(document.createElement('canvas'), { width: 1000, height: 500 });
            renderPaginaTo(off, pg);
            setTimeout(() => Object.assign(document.createElement('a'), { download: `Pizarra_H${i + 1}.png`, href: off.toDataURL('image/png') }).click(), i * 250);
        });
    };

    const descargarPDF = () => {
        const imgs = paginas.map(pg => {
            const off = Object.assign(document.createElement('canvas'), { width: 1000, height: 500 });
            renderPaginaTo(off, pg);
            return off.toDataURL('image/png');
        });
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Pizarra PDF</title><style>
            body{margin:0}img{width:100%;page-break-after:always;display:block}
            @media print{img{page-break-after:always}}
        </style></head><body>
            ${imgs.map(src => `<img src="${src}"/>`).join('')}
            <script>window.onload=()=>window.print()<\/script></body></html>`);
        w.document.close();
    };

    // ── Insert image from device ─────────────────────────────────────────────
    const onFileSelected = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const maxW = 400, maxH = 300;
                let w = img.width, h = img.height;
                if (w > maxW) { h = h * maxW / w; w = maxW; }
                if (h > maxH) { w = w * maxH / h; h = maxH; }
                setPendingInsert({ type: 'image', src: ev.target.result, w, h });
                setHerramienta('geo_place');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // ── Insert image from URL (Wikimedia search or direct URL) ───────────────
    const insertarImagenDesdeURL = (url) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const maxW = 500, maxH = 380;
            let w = img.naturalWidth || 400, h = img.naturalHeight || 300;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const src = canvas.toDataURL('image/png');
            setPendingInsert({ type: 'image', src, w, h });
            setHerramienta('geo_place');
        };
        img.onerror = () => {
            setPendingInsert({ type: 'image', src: url, w: 300, h: 200 });
            setHerramienta('geo_place');
        };
        img.src = url;
        setImgBuscador(false);
        setImgMenuOpen(false);
        setImgQuery('');
        setImgResults([]);
    };

    const buscarImagenesWikimedia = async () => {
        if (!imgQuery.trim()) return;
        setImgSearching(true);
        try {
            const res = await fetch(
                `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(imgQuery)}&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
            );
            const data = await res.json();
            const pages = data.query?.pages || {};
            const urls = Object.values(pages)
                .map(p => { const info = p.imageinfo?.[0]; return info?.thumburl || info?.url; })
                .filter(u => u && /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(u));
            setImgResults(urls);
        } catch {
            setImgResults([]);
        }
        setImgSearching(false);
    };

    // ── Geo mode helpers ─────────────────────────────────────────────────────
    const buscarPaisGeo = async () => {
        if (!geoBusqueda.trim()) return;
        setGeoCargando(true); setGeoPaisData(null);
        try {
            const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(geoBusqueda.trim())}?fields=name,flags,capital,region,population,area,languages,currencies,latlng`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setGeoPaisData(data[0]);
        } catch { setGeoPaisData(null); }
        setGeoCargando(false);
    };

    const prepararMapaGeo_GeoMode = () => { setGeoVisible(true); };

    const prepararBanderaGeo = () => {
        if (!geoPaisData?.flags?.png) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const maxW = 420;
            const w = Math.min(img.naturalWidth, maxW);
            const h = Math.round(img.naturalHeight * w / img.naturalWidth);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            setPendingInsert({ type: 'image', src: canvas.toDataURL('image/png'), w, h });
            setHerramienta('geo_place');
        };
        img.src = geoPaisData.flags.png;
    };

    const prepararInfoGeo = () => {
        if (!geoPaisData) return;
        const canvas = document.createElement('canvas');
        canvas.width = 520; canvas.height = 320;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#e8f4fd'); grad.addColorStop(1, '#dbeafe');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        ctx.fillStyle = '#1e3a5f'; ctx.font = 'bold 26px Arial';
        ctx.fillText(geoPaisData.name?.common || '', 20, 46);
        ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(20, 58); ctx.lineTo(500, 58); ctx.stroke();
        const rows = [
            ['🏙️ Capital',   (geoPaisData.capital||[]).join(', ')||'—'],
            ['🌎 Región',     geoPaisData.region||'—'],
            ['👥 Población',  (geoPaisData.population||0).toLocaleString('es-ES')],
            ['📐 Superficie', `${(geoPaisData.area||0).toLocaleString('es-ES')} km²`],
            ['🗣️ Idiomas',    Object.values(geoPaisData.languages||{}).join(', ')||'—'],
            ['💰 Moneda',     Object.values(geoPaisData.currencies||{}).map(c=>c.name).join(', ')||'—'],
        ];
        rows.forEach(([k, v], i) => {
            ctx.fillStyle = '#64748b'; ctx.font = 'bold 14px Arial';
            ctx.fillText(k, 20, 90 + i * 38);
            ctx.fillStyle = '#1e293b'; ctx.font = '16px Arial';
            ctx.fillText(String(v).slice(0, 55), 155, 90 + i * 38);
        });
        setPendingInsert({ type: 'image', src: canvas.toDataURL('image/png'), w: 520, h: 320 });
        setHerramienta('geo_place');
    };

    // ── Mapas de España ──────────────────────────────────────────────────────
    const generarMapaProvinciasEspana = async () => {
        const W = 820, H = 620;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const PROV_COLORS = [
            '#b3d9ff','#c8e6c9','#fff9c4','#ffccbc','#e1bee7',
            '#b2dfdb','#f8bbd9','#d7ccc8','#cfd8dc','#ffe0b2',
            '#dcedc8','#fce4ec','#e8eaf6','#e0f7fa','#f3e5f5',
            '#e8f5e9','#fff8e1','#fbe9e7','#ede7f6','#e1f5fe',
            '#ffccbc','#b3d9ff','#c8e6c9','#fff9c4','#e1bee7',
        ];

        // ── Proyección peninsular (deja 155 px abajo para recuadros) ──────────
        const PEN_LON_MIN = -9.5, PEN_LON_MAX = 4.6;
        const PEN_LAT_MAX = 43.9, PEN_LAT_MIN = 35.0;
        const projPen = (lon, lat) => {
            const cosLat = Math.cos(39.7 * Math.PI / 180);
            const lonSpan = (PEN_LON_MAX - PEN_LON_MIN) * cosLat;
            const latSpan = PEN_LAT_MAX - PEN_LAT_MIN;
            const pad = 42, titleH = 26;
            const useW = W - 2 * pad;
            const useH = H - titleH - pad - 158;
            const scale = Math.min(useW / lonSpan, useH / latSpan);
            const ox = pad + (useW - lonSpan * scale) / 2;
            const oy = titleH + (useH - latSpan * scale) / 2;
            return { x: ox + (lon - PEN_LON_MIN) * cosLat * scale, y: oy + (PEN_LAT_MAX - lat) * scale };
        };

        // ── Recuadro Canarias (esquina inferior-izquierda) ────────────────────
        const INS_X = 14, INS_Y = H - 152, INS_W = 226, INS_H = 134;
        const CAN_LON_MIN = -18.3, CAN_LON_MAX = -13.2;
        const CAN_LAT_MIN = 27.4, CAN_LAT_MAX = 29.6;
        const projCan = (lon, lat) => {
            const cosLat = Math.cos(28.5 * Math.PI / 180);
            const lonSpan = (CAN_LON_MAX - CAN_LON_MIN) * cosLat;
            const latSpan = CAN_LAT_MAX - CAN_LAT_MIN;
            const pad = 10;
            const useW = INS_W - 2 * pad, useH = INS_H - 22 - pad;
            const scale = Math.min(useW / lonSpan, useH / latSpan);
            const ox = INS_X + pad + (useW - lonSpan * scale) / 2;
            const oy = INS_Y + 22 + (useH - latSpan * scale) / 2;
            return { x: ox + (lon - CAN_LON_MIN) * cosLat * scale, y: oy + (CAN_LAT_MAX - lat) * scale };
        };

        // ── Fondo mar ─────────────────────────────────────────────────────────
        const seaGrad = ctx.createLinearGradient(0, 0, W, H);
        seaGrad.addColorStop(0, '#c8dff4'); seaGrad.addColorStop(1, '#a8c8e8');
        ctx.fillStyle = seaGrad; ctx.fillRect(0, 0, W, H);

        // Recuadro Canarias
        ctx.fillStyle = '#c0d8ef'; ctx.fillRect(INS_X, INS_Y, INS_W, INS_H);
        ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5; ctx.strokeRect(INS_X, INS_Y, INS_W, INS_H);
        ctx.fillStyle = '#1e3a5f'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Islas Canarias', INS_X + INS_W / 2, INS_Y + 13);

        // Título
        ctx.fillStyle = '#1e3a5f'; ctx.font = 'bold 17px Arial';
        ctx.textAlign = 'center'; ctx.fillText('España — Provincias', W / 2, 20);

        try {
            const geojson = await fetch(ESP_GEOJSON_URL).then(r => r.json());

            // Asignar colores y clasificar cada feature
            let ceutaData = null, melillaData = null;
            const classified = geojson.features.map((feat, idx) => {
                const name = feat.properties?.name || feat.properties?.NOMBRE || feat.properties?.nombre || '';
                const nameLower = name.toLowerCase();
                const color = PROV_COLORS[idx % PROV_COLORS.length];
                const c = _centroidGeo(feat);
                const isCanary = c && c.lon < -12;
                const isCeuta = nameLower.includes('ceuta');
                const isMelilla = nameLower.includes('melilla');
                if (isCeuta)   { ceutaData   = { color }; return null; }
                if (isMelilla) { melillaData = { color }; return null; }
                return { feat, color, isCanary };
            }).filter(Boolean);

            // Dibujar polígonos
            classified.forEach(({ feat, color, isCanary }) => {
                ctx.fillStyle = color;
                ctx.strokeStyle = '#2c3e50';
                ctx.lineWidth = isCanary ? 0.5 : 0.7;
                _drawGeoFeature(ctx, feat, isCanary ? projCan : projPen);
            });

            // Etiquetas de provincias
            ctx.textAlign = 'center';
            classified.forEach(({ feat, isCanary }) => {
                const name = feat.properties?.name || feat.properties?.NOMBRE || feat.properties?.nombre || '';
                const c = _centroidGeo(feat); if (!c) return;
                const { x, y } = (isCanary ? projCan : projPen)(c.lon, c.lat);
                ctx.fillStyle = '#1a1a2e';
                ctx.font = isCanary ? '6.5px Arial' : '7.5px Arial';
                if (x > 10 && x < W - 10 && y > 24 && y < H - 5) ctx.fillText(name, x, y);
            });

            // ── Ceuta y Melilla: recuadros a la derecha de Canarias ───────────
            const CM_X = INS_X + INS_W + 10, CM_W = 62, CM_H = 30, CM_GAP = 8;
            const CM_Y_CEUTA   = INS_Y + (INS_H - 2 * CM_H - CM_GAP) / 2;
            const CM_Y_MELILLA = CM_Y_CEUTA + CM_H + CM_GAP;

            [[ceutaData?.color   || '#b3d9ff', 'Ceuta',   CM_Y_CEUTA],
             [melillaData?.color || '#c8e6c9', 'Melilla', CM_Y_MELILLA]
            ].forEach(([color, label, cy]) => {
                ctx.fillStyle = color;
                ctx.fillRect(CM_X, cy, CM_W, CM_H);
                ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1;
                ctx.strokeRect(CM_X, cy, CM_W, CM_H);
                ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
                ctx.fillText(label, CM_X + CM_W / 2, cy + CM_H / 2 + 4);
            });

        } catch (_) {
            ctx.fillStyle = '#e74c3c'; ctx.font = '13px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Error al cargar provincias. Comprueba la conexión.', W / 2, H / 2);
        }

        ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
        setPendingInsert({ type: 'image', src: canvas.toDataURL('image/png'), w: W, h: H });
        setHerramienta('geo_place');
    };

    const generarMapaGeoEspana = async () => {
        const W = 820, H = 620;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        const proj = (lon, lat) => _proyEsp(lon, lat, W, H - 28, 42);

        const seaGrad = ctx.createLinearGradient(0, 0, W, H);
        seaGrad.addColorStop(0, '#c8dff4'); seaGrad.addColorStop(1, '#a8c8e8');
        ctx.fillStyle = seaGrad; ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#1e3a5f'; ctx.font = 'bold 17px Arial';
        ctx.textAlign = 'center'; ctx.fillText('España — Elementos Geográficos', W / 2, 22);

        // Fondo terrestre (provincias sin etiquetas)
        try {
            const geojson = await fetch(ESP_GEOJSON_URL).then(r => r.json());
            geojson.features.forEach(feat => {
                ctx.fillStyle = '#d4e6b5'; ctx.strokeStyle = '#a0b880'; ctx.lineWidth = 0.5;
                _drawGeoFeature(ctx, feat, proj);
            });
        } catch (_) { /* continuar sin silueta */ }

        // Ríos
        ESP_RIOS.forEach(rio => {
            ctx.beginPath(); ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
            rio.pts.forEach(([lon, lat], i) => { const { x, y } = proj(lon, lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
            ctx.stroke();
            const mid = rio.pts[Math.floor(rio.pts.length / 2)];
            const { x: lx, y: ly } = proj(mid[0], mid[1]);
            ctx.fillStyle = '#0d47a1'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left';
            ctx.fillText(rio.nombre, lx + 4, ly - 3);
        });

        // Montañas
        ESP_MONTANAS.forEach(m => {
            const { x, y } = proj(m.lon, m.lat);
            ctx.fillStyle = '#5d4037'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
            ctx.fillText('△ ' + m.nombre, x, y);
        });

        // Ciudades
        ESP_CIUDADES.forEach(c => {
            const { x, y } = proj(c.lon, c.lat);
            ctx.beginPath(); ctx.arc(x, y, c.capital ? 5 : 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = c.capital ? '#e74c3c' : '#2c3e50'; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = c.capital ? '#c0392b' : '#1a1a2e';
            ctx.font = c.capital ? 'bold 10px Arial' : '9px Arial'; ctx.textAlign = 'center';
            ctx.fillText(c.nombre, x, y - 8);
        });

        // Mares
        ESP_MARES.forEach(m => {
            const { x, y } = proj(m.lon, m.lat);
            if (x > 0 && x < W && y > 0 && y < H) {
                ctx.fillStyle = '#1565c0'; ctx.font = 'italic 10px Arial'; ctx.textAlign = 'center';
                ctx.fillText(m.nombre, x, y);
            }
        });

        // Leyenda
        const lx = 14, ly = H - 92;
        ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(lx, ly, 160, 84);
        ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, 160, 84);
        ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Leyenda', lx + 6, ly + 14);
        ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx + 6, ly + 27); ctx.lineTo(lx + 32, ly + 27); ctx.stroke();
        ctx.fillStyle = '#2c3e50'; ctx.font = '8px Arial'; ctx.fillText('Ríos', lx + 36, ly + 30);
        ctx.fillStyle = '#5d4037'; ctx.font = '9px Arial'; ctx.fillText('△ Cordilleras/Sierras', lx + 6, ly + 47);
        ctx.beginPath(); ctx.arc(lx + 12, ly + 62, 3.5, 0, 2 * Math.PI); ctx.fillStyle = '#2c3e50'; ctx.fill();
        ctx.fillStyle = '#2c3e50'; ctx.font = '8px Arial'; ctx.fillText('Ciudad', lx + 20, ly + 65);
        ctx.beginPath(); ctx.arc(lx + 12, ly + 77, 5, 0, 2 * Math.PI); ctx.fillStyle = '#e74c3c'; ctx.fill();
        ctx.fillText('Capital', lx + 20, ly + 80);

        ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
        setPendingInsert({ type: 'image', src: canvas.toDataURL('image/png'), w: W, h: H });
        setHerramienta('geo_place');
    };

    // ── Geometry helpers ─────────────────────────────────────────────────────
    const rotatePoint = (px, py, cx, cy, a) => ({
        x: cx + (px-cx)*Math.cos(a) - (py-cy)*Math.sin(a),
        y: cy + (px-cx)*Math.sin(a) + (py-cy)*Math.cos(a),
    });

    const applyRotationToElem = (elem, cx, cy, angle) => {
        if (elem.t === 'draw') return { ...elem, pts: elem.pts.map(p => rotatePoint(p.x, p.y, cx, cy, angle)) };
        if (elem.t === 'graph' || elem.t === 'axes') {
            const np = rotatePoint(elem.cx, elem.cy, cx, cy, angle);
            return { ...elem, cx: np.x, cy: np.y };
        }
        if (elem.t === 'image' || elem.t === 'music_staff') {
            const np = rotatePoint(elem.x + elem.w/2, elem.y + elem.h/2, cx, cy, angle);
            return { ...elem, x: np.x - elem.w/2, y: np.y - elem.h/2, rotation: (elem.rotation||0) + angle };
        }
        if (elem.t === 'text') {
            const np = rotatePoint(elem.x, elem.y, cx, cy, angle);
            return { ...elem, x: np.x, y: np.y, rotation: (elem.rotation||0) + angle };
        }
        if (elem.t === 'staff' || elem.t === 'note' || elem.t === 'rest' || elem.t === 'acc') {
            const np = rotatePoint(elem.x, elem.y, cx, cy, angle);
            return { ...elem, x: np.x, y: np.y };
        }
        if (elem.x1 !== undefined) {
            const ecx = (elem.x1+elem.x2)/2, ecy = (elem.y1+elem.y2)/2;
            const np = rotatePoint(ecx, ecy, cx, cy, angle);
            const hw = Math.abs(elem.x2-elem.x1)/2, hh = Math.abs(elem.y2-elem.y1)/2;
            return { ...elem, x1: np.x-hw, y1: np.y-hh, x2: np.x+hw, y2: np.y+hh, rotation: (elem.rotation||0)+angle };
        }
        return elem;
    };

    const applyScaleToElem = (elem, ox1, oy1, scaleX, scaleY, nx1, ny1) => {
        const mX = (px) => nx1 + (px - ox1) * scaleX;
        const mY = (py) => ny1 + (py - oy1) * scaleY;
        if (elem.t === 'draw') return { ...elem, pts: elem.pts.map(p => ({ x: mX(p.x), y: mY(p.y) })) };
        if (elem.t === 'graph' || elem.t === 'axes') return { ...elem, cx: mX(elem.cx), cy: mY(elem.cy) };
        if (elem.t === 'image' || elem.t === 'music_staff') return { ...elem, x: mX(elem.x), y: mY(elem.y), w: elem.w * scaleX, h: elem.h * scaleY };
        if (elem.t === 'text') return { ...elem, x: mX(elem.x), y: mY(elem.y) };
        if (elem.t === 'staff') return { ...elem, x: mX(elem.x), y: mY(elem.y), w: elem.w * scaleX };
        if (elem.t === 'note' || elem.t === 'rest' || elem.t === 'acc') return { ...elem, x: mX(elem.x), y: mY(elem.y) };
        if (elem.x1 !== undefined) return { ...elem, x1: mX(elem.x1), y1: mY(elem.y1), x2: mX(elem.x2), y2: mY(elem.y2) };
        return elem;
    };

    // ── Element bounding box / move ──────────────────────────────────────────
    const getBbox = (item) => {
        if (item.t === 'draw') {
            const xs = item.pts.map(p => p.x), ys = item.pts.map(p => p.y);
            return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
        }
        if (item.t === 'text') { const fs = item.fontSize||24; return { x1: item.x, y1: item.y - fs, x2: item.x + Math.max((item.txt||'').length * fs * 0.6, 60), y2: item.y + 4 }; }
        if (item.t === 'graph' || item.t === 'axes') return { x1: item.cx - 265, y1: item.cy - 265, x2: item.cx + 265, y2: item.cy + 265 };
        if (item.t === 'image' || item.t === 'music_staff') return { x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y + item.h };
        if (item.t === 'staff') { const ls = item.ls||STAFF_LS; return { x1: item.x, y1: item.y - ls, x2: item.x + item.w, y2: item.y + ls*5 }; }
        if (item.t === 'note' || item.t === 'rest') { const ls = item.ls||STAFF_LS; return { x1: item.x - ls*2, y1: item.y - ls*5, x2: item.x + ls*3, y2: item.y + ls*5 }; }
        if (item.t === 'acc')   { const ls = item.ls||STAFF_LS; return { x1: item.x - ls, y1: item.y - ls, x2: item.x + ls, y2: item.y + ls }; }
        if (item.x1 !== undefined) return { x1: Math.min(item.x1, item.x2), y1: Math.min(item.y1, item.y2), x2: Math.max(item.x1, item.x2), y2: Math.max(item.y1, item.y2) };
        return { x1: 0, y1: 0, x2: 0, y2: 0 };
    };

    const rectsOverlap = (a, b) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;

    const moverSeleccion = (idxs, dx, dy) => {
        setElementos(prev => prev.map((item, i) => {
            if (!idxs.includes(i)) return item;
            if (item.t === 'draw') return { ...item, pts: item.pts.map(p => ({ x: p.x + dx, y: p.y + dy })) };
            if (item.t === 'text') return { ...item, x: item.x + dx, y: item.y + dy };
            if (item.t === 'graph' || item.t === 'axes') return { ...item, cx: item.cx + dx, cy: item.cy + dy };
            if (item.t === 'image' || item.t === 'music_staff') return { ...item, x: item.x + dx, y: item.y + dy };
            if (item.t === 'staff' || item.t === 'note' || item.t === 'rest' || item.t === 'acc')
                return { ...item, x: item.x + dx, y: item.y + dy };
            return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy };
        }));
    };

    // ── Draw pipeline ────────────────────────────────────────────────────────
    const dibujarItem = (ctx, item, selected) => {
        ctx.strokeStyle = item.color;
        ctx.fillStyle   = item.color;
        ctx.lineWidth   = item.grosor;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        if (item.t === 'draw') {
            ctx.beginPath();
            ctx.moveTo(item.pts[0].x, item.pts[0].y);
            item.pts.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        } else if (item.t === 'text') {
            const fs = item.fontSize || 24;
            ctx.font = `bold ${fs}px Arial`;
            if (item.rotation) {
                ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rotation);
                ctx.fillText(item.txt, 0, 0); ctx.restore();
            } else { ctx.fillText(item.txt, item.x, item.y); }
        } else if (item.t === 'graph') {
            dibujarCurvaMatematica(ctx, item);
        } else if (item.t === 'axes') {
            dibujarEjesCoord(ctx, item);
        } else if (item.t === 'image') {
            const img = getOrLoadImg(item);
            if (img) {
                if (item.rotation) {
                    const cx = item.x + item.w/2, cy = item.y + item.h/2;
                    ctx.save(); ctx.translate(cx, cy); ctx.rotate(item.rotation);
                    ctx.drawImage(img, -item.w/2, -item.h/2, item.w, item.h); ctx.restore();
                } else { ctx.drawImage(img, item.x, item.y, item.w, item.h); }
            } else { ctx.save(); ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.strokeRect(item.x, item.y, item.w, item.h); ctx.restore(); }
        } else if (item.t === 'music_staff') {
            const img = getOrLoadImg(item);
            if (img) {
                ctx.drawImage(img, item.x, item.y, item.w, item.h);
            } else {
                ctx.save(); ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.strokeRect(item.x, item.y, item.w, item.h); ctx.restore();
            }
            // ▶ / ⏹ play badge
            const isPlaying = musicPlayingId === item.id;
            const bx = item.x + item.w - 34, by = item.y + item.h - 34, br = 14;
            ctx.save();
            ctx.fillStyle = isPlaying ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.65)';
            ctx.beginPath(); ctx.arc(bx + br, by + br, br, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(isPlaying ? '⏹' : '▶', bx + br, by + br + 1);
            ctx.restore();
            musicPlayHitRef.current.push({ id: item.id, items: item.items, bpm: item.bpm, x: bx, y: by, w: br * 2, h: br * 2 });
        } else if (item.t === 'staff') {
            drawStaff(ctx, item);
        } else if (item.t === 'note') {
            drawNote(ctx, item);
        } else if (item.t === 'rest') {
            drawRest(ctx, item);
        } else if (item.t === 'acc') {
            drawAccidental(ctx, item);
        } else if (item.t === 'eraser_rect') {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(item.x1, item.y1, item.x2 - item.x1, item.y2 - item.y1);
            ctx.restore();
            return;
        } else {
            if (item.rotation) {
                const ecx = (item.x1+item.x2)/2, ecy = (item.y1+item.y2)/2;
                ctx.save(); ctx.translate(ecx, ecy); ctx.rotate(item.rotation); ctx.translate(-ecx, -ecy);
                dibujarForma(ctx, item); ctx.restore();
            } else { dibujarForma(ctx, item); }
        }

        if (selected) {
            const bb = getBbox(item);
            ctx.save();
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(bb.x1 - 4, bb.y1 - 4, bb.x2 - bb.x1 + 8, bb.y2 - bb.y1 + 8);
            ctx.setLineDash([]);
            ctx.restore();
        }
    };

    const dibujarCanvas = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        musicPlayHitRef.current = [];
        ctx.save();
        ctx.translate(panRef.current.x, panRef.current.y);
        elementos.forEach((item, idx) => dibujarItem(ctx, item, selIdxs.includes(idx)));
        if (previewElement) dibujarItem(ctx, previewElement, false);

        if (lassoRect) {
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
            ctx.strokeRect(lassoRect.x1, lassoRect.y1, lassoRect.x2 - lassoRect.x1, lassoRect.y2 - lassoRect.y1);
            ctx.fillStyle = 'rgba(52,152,219,0.07)';
            ctx.fillRect(lassoRect.x1, lassoRect.y1, lassoRect.x2 - lassoRect.x1, lassoRect.y2 - lassoRect.y1);
            ctx.setLineDash([]);
        }

        // ── Handles de redimensión y rotación ────────────────────────────────
        if (selIdxs.length > 0 && herramienta === 'lasso' && !dibujando) {
            const bbs = selIdxs.map(i => getBbox(elementos[i]));
            const bx1 = Math.min(...bbs.map(b => b.x1)) - 6;
            const by1 = Math.min(...bbs.map(b => b.y1)) - 6;
            const bx2 = Math.max(...bbs.map(b => b.x2)) + 6;
            const by2 = Math.max(...bbs.map(b => b.y2)) + 6;
            const mx = (bx1+bx2)/2, my = (by1+by2)/2;
            ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 1.5; ctx.setLineDash([4,2]);
            ctx.strokeRect(bx1, by1, bx2-bx1, by2-by1); ctx.setLineDash([]);
            [[bx1,by1],[mx,by1],[bx2,by1],[bx1,my],[bx2,my],[bx1,by2],[mx,by2],[bx2,by2]].forEach(([hx,hy]) => {
                ctx.fillStyle='white'; ctx.strokeStyle='#2980b9'; ctx.lineWidth=1.5;
                ctx.fillRect(hx-5,hy-5,10,10); ctx.strokeRect(hx-5,hy-5,10,10);
            });
            const rotX = mx, rotY = by1 - 22;
            ctx.beginPath(); ctx.strokeStyle='#bdc3c7'; ctx.lineWidth=1;
            ctx.moveTo(mx, by1); ctx.lineTo(rotX, rotY+7); ctx.stroke();
            ctx.beginPath(); ctx.arc(rotX, rotY, 8, 0, 2*Math.PI);
            ctx.fillStyle='#e67e22'; ctx.fill();
            ctx.strokeStyle='#d35400'; ctx.lineWidth=1.5; ctx.stroke();
            ctx.fillStyle='white'; ctx.font='bold 11px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('↻', rotX, rotY+1);
        }

        ctx.restore();
    };

    const dibujarCurvaMatematica = (ctx, item) => {
        const { funcStr, cx, cy, scale, color, grosor } = item;
        const anchoEje = 250;
        
        ctx.beginPath();
        ctx.strokeStyle = '#bdc3c7'; // Color de ejes
        ctx.lineWidth = 1;
        ctx.moveTo(cx - anchoEje, cy); ctx.lineTo(cx + anchoEje, cy); // X
        ctx.moveTo(cx, cy - anchoEje); ctx.lineTo(cx, cy + anchoEje); // Y
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = grosor;
        let first = true;

        for(let px = -anchoEje; px <= anchoEje; px++) {
            let x = px / scale;
            try {
                let toEval = prepareMathExpr(funcStr).replace(/x/g, `(${x})`);
                // eslint-disable-next-line no-eval
                let y = eval(toEval);
                if(Number.isFinite(y)) {
                    let py = cy - (y * scale);
                    if(py < cy - anchoEje || py > cy + anchoEje) { first = true; continue; } // Clipping simple
                    if(first) { ctx.moveTo(cx + px, py); first = false; }
                    else { ctx.lineTo(cx + px, py); }
                } else { first = true; }
            } catch(e) { first = true; }
        }
        ctx.stroke();
    };

    const dibujarEjesCoord = (ctx, item) => {
        const { cx, cy, color } = item;
        const step = 30; // px por unidad
        const range = 8;
        ctx.save();

        // Cuadrícula
        ctx.strokeStyle = '#c8d0e0';
        ctx.lineWidth = 0.7;
        for (let i = -range; i <= range; i++) {
            ctx.beginPath(); ctx.moveTo(cx + i * step, cy - range * step); ctx.lineTo(cx + i * step, cy + range * step); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx - range * step, cy + i * step); ctx.lineTo(cx + range * step, cy + i * step); ctx.stroke();
        }

        // Ejes principales
        ctx.strokeStyle = color || '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - range * step - 8, cy); ctx.lineTo(cx + range * step + 18, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy + range * step + 8); ctx.lineTo(cx, cy - range * step - 18); ctx.stroke();

        // Flechas
        ctx.fillStyle = color || '#2c3e50';
        ctx.beginPath(); ctx.moveTo(cx + range * step + 18, cy); ctx.lineTo(cx + range * step + 8, cy - 5); ctx.lineTo(cx + range * step + 8, cy + 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, cy - range * step - 18); ctx.lineTo(cx - 5, cy - range * step - 8); ctx.lineTo(cx + 5, cy - range * step - 8); ctx.closePath(); ctx.fill();

        // Marcas y números
        ctx.font = '11px Arial';
        ctx.lineWidth = 1.2;
        for (let i = -range; i <= range; i++) {
            if (i === 0) continue;
            // Eje X
            ctx.beginPath(); ctx.moveTo(cx + i * step, cy - 4); ctx.lineTo(cx + i * step, cy + 4); ctx.stroke();
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(i, cx + i * step, cy + 6);
            // Eje Y
            ctx.beginPath(); ctx.moveTo(cx - 4, cy - i * step); ctx.lineTo(cx + 4, cy - i * step); ctx.stroke();
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(i, cx - 7, cy - i * step);
        }

        // Etiquetas x, y y origen
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('x', cx + range * step + 26, cy);
        ctx.fillText('y', cx, cy - range * step - 28);
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('0', cx - 5, cy + 5);

        ctx.restore();
    };

    const dibujarForma = (ctx, item) => {
        const { x1, y1, x2, y2, t } = item;
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        const w = x2 - x1, h = y2 - y1;
        const r = Math.min(Math.abs(w), Math.abs(h)) / 2;

        ctx.beginPath();
        if (t === 'line') { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); } 
        else if (t === 'rect') { ctx.strokeRect(x1, y1, w, h); } 
        else if (t === 'circle') { const radio = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2)); ctx.arc(x1, y1, radio, 0, 2 * Math.PI); } 
        else if (['triangle', 'pentagon', 'hexagon', 'poligono'].includes(t)) {
            const lados = t === 'triangle' ? 3 : t === 'pentagon' ? 5 : t === 'hexagon' ? 6 : (item.lados || 5);
            for (let i = 0; i < lados; i++) {
                const angulo = i * (2 * Math.PI / lados) - (Math.PI / 2);
                const px = cx + r * Math.cos(angulo);
                const py = cy + r * Math.sin(angulo);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
        } 
        else if (t === 'prisma') {
            const off = r * 0.4;
            ctx.strokeRect(x1, y1, w, h); 
            ctx.strokeRect(x1 + off, y1 - off, w, h); 
            ctx.moveTo(x1, y1); ctx.lineTo(x1 + off, y1 - off);
            ctx.moveTo(x2, y1); ctx.lineTo(x2 + off, y1 - off);
            ctx.moveTo(x1, y2); ctx.lineTo(x1 + off, y2 - off);
            ctx.moveTo(x2, y2); ctx.lineTo(x2 + off, y2 - off);
        } else if (t === 'pyramid') {
            const apexX = cx, apexY = y1 - r;
            const basH = h * 0.3;
            ctx.moveTo(x1, y2); ctx.lineTo(cx, y2 + basH); ctx.lineTo(x2, y2); ctx.lineTo(cx, y2 - basH); ctx.closePath();
            ctx.moveTo(x1, y2); ctx.lineTo(apexX, apexY);
            ctx.moveTo(x2, y2); ctx.lineTo(apexX, apexY);
            ctx.moveTo(cx, y2 + basH); ctx.lineTo(apexX, apexY);
        } else if (t === 'cylinder') {
            const ry = Math.abs(h * 0.15);
            ctx.ellipse(cx, y1, Math.abs(w/2), ry, 0, 0, 2 * Math.PI);
            ctx.moveTo(x1, y1); ctx.lineTo(x1, y2);
            ctx.moveTo(x2, y1); ctx.lineTo(x2, y2);
            ctx.moveTo(x2, y2);
            ctx.ellipse(cx, y2, Math.abs(w/2), ry, 0, 0, Math.PI);
        } else if (t === 'cone') {
            const ry = Math.abs(h * 0.15);
            ctx.ellipse(cx, y2, Math.abs(w/2), ry, 0, 0, 2 * Math.PI);
            ctx.moveTo(x1, y2); ctx.lineTo(cx, y1); ctx.lineTo(x2, y2);
        } else if (t === 'sphere') {
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.moveTo(cx + r, cy);
            ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI);
        }
        ctx.stroke();
    };

    // ── Coordinate helper ────────────────────────────────────────────────────
    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX - panRef.current.x,
            y: (clientY - rect.top)  * scaleY - panRef.current.y,
            rawX: clientX, rawY: clientY,
        };
    };

    // ── Draw events ──────────────────────────────────────────────────────────
    const iniciarDibujo = (e) => {
        // Espectadores en modo ver no pueden dibujar
        if (modoCompartir === 'ver' && !esCreador) return;

        const pos = getPos(e);
        const { x, y, rawX, rawY } = pos;
        // En modo colaborativo, el color de trazo es el color del participante
        const drawColor = modoCompartir === 'editar' ? miColorRef.current || color : color;

        // ── Music staff play button ───────────────────────────────────────────
        for (const h of musicPlayHitRef.current) {
            if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
                if (musicPlayingId === h.id) { stopSfMusic(); } else { playSfMusic(h.id, h.items, h.bpm); }
                return;
            }
        }

        if (herramienta === 'text') {
            if (textoInput.trim()) {
                setElementos(prev => [...prev, tagElem({ t: 'text', txt: textoInput.trim(), x, y, color: drawColor, grosor, fontSize: textoFontSize })]);
            }
            return;
        }
        if (herramienta === 'paste' && textoPegar) {
            setElementos(prev => [...prev, tagElem({ t: 'text', txt: textoPegar, x, y, color: drawColor, grosor })]);
            setHerramienta('draw'); setTextoPegar(''); return;
        }
        if (herramienta === 'graph' && graficaConfig) {
            setElementos(prev => [...prev, tagElem({ t: 'graph', funcStr: graficaConfig.funcStr, scale: graficaConfig.scale, cx: x, cy: y, color: drawColor, grosor })]);
            setHerramienta('draw'); setGraficaConfig(null); return;
        }
        if (herramienta === 'geo_place' && pendingInsert) {
            if (pendingInsert.type === 'image') {
                const id = Date.now();
                const img = new Image();
                img.src = pendingInsert.src;
                imageCacheRef.current[id] = img;
                setElementos(prev => [...prev, tagElem({ t: 'image', id, src: pendingInsert.src, x, y, w: pendingInsert.w, h: pendingInsert.h })]);
            } else if (pendingInsert.type === 'label') {
                setElementos(prev => [...prev, tagElem({ t: 'text', txt: pendingInsert.icon + ' ' + pendingInsert.txt, x, y, color: pendingInsert.color || '#1e293b', grosor: 2, fontSize: 20 })]);
            }
            setPendingInsert(null);
            setHerramienta('draw');
            return;
        }
        if (herramienta === 'axes') {
            setElementos(prev => [...prev, tagElem({ t: 'axes', cx: x, cy: y, color: drawColor, grosor })]);
            setHerramienta('draw'); return;
        }
        if (herramienta === 'pan') {
            panStartRef.current = { rawX, rawY, px: panRef.current.x, py: panRef.current.y };
            return;
        }

        // ── Music tools ─────────────────────────────────────────────────
        if (herramienta === 'staff' || herramienta === 'staff_fa') {
            setElementos(prev => [...prev, tagElem({ t: 'staff', x, y, w: 680, ls: STAFF_LS, clef: herramienta === 'staff_fa' ? 'fa' : 'sol' })]);
            return;
        }
        if (MUSIC_NOTE_IDS.includes(herramienta)) {
            // Snap to nearest staff
            let snapY = y, stemUp = true, ls = STAFF_LS;
            const staff = elementos.find(s => s.t === 'staff' && x >= s.x - 20 && x <= s.x + s.w + 20 && y >= s.y - ls * 3 && y <= s.y + ls * 7);
            if (staff) {
                ls = staff.ls || STAFF_LS;
                const half = ls / 2;
                const step = Math.round((y - staff.y) / half);
                snapY  = staff.y + step * half;
                stemUp = step >= 4; // middle line = step 4
            }
            setElementos(prev => [...prev, tagElem({ t: 'note', figura: herramienta, x, y: snapY, color: drawColor, ls, stemUp })]);
            return;
        }
        if (MUSIC_REST_IDS.includes(herramienta)) {
            const staff = elementos.find(s => s.t === 'staff' && x >= s.x - 20 && x <= s.x + s.w + 20 && Math.abs(y - (s.y + s.ls * 2)) < s.ls * 4);
            const ls = staff?.ls || STAFF_LS;
            const restY = staff
                ? (herramienta === 's_redonda' ? staff.y + ls     : staff.y + ls * 2)
                : y;
            setElementos(prev => [...prev, tagElem({ t: 'rest', figura: herramienta, x, y: restY, color: drawColor, ls })]);
            return;
        }
        if (MUSIC_ACC_IDS.includes(herramienta)) {
            setElementos(prev => [...prev, tagElem({ t: 'acc', figura: herramienta, x, y, color: drawColor, ls: STAFF_LS })]);
            return;
        }
        if (herramienta === 'lasso') {
            if (selIdxs.length > 0 && !dibujando) {
                const bbs = selIdxs.map(i => getBbox(elementos[i]));
                const bx1 = Math.min(...bbs.map(b => b.x1)) - 6;
                const by1 = Math.min(...bbs.map(b => b.y1)) - 6;
                const bx2 = Math.max(...bbs.map(b => b.x2)) + 6;
                const by2 = Math.max(...bbs.map(b => b.y2)) + 6;
                const mx = (bx1+bx2)/2, my = (by1+by2)/2;
                // ¿Handle de rotación?
                if (Math.abs(x - mx) < 11 && Math.abs(y - (by1-22)) < 11) {
                    selHandleRef.current = {
                        type: 'rotate', cx: mx, cy: (by1+by2)/2,
                        startAngle: Math.atan2(y - (by1+by2)/2, x - mx),
                        origElemsData: selIdxs.map(i => JSON.parse(JSON.stringify(elementos[i]))),
                    };
                    return;
                }
                // ¿Handle de resize?
                const rHandles = [
                    {id:'tl',x:bx1,y:by1},{id:'tc',x:mx,y:by1},{id:'tr',x:bx2,y:by1},
                    {id:'ml',x:bx1,y:my},{id:'mr',x:bx2,y:my},
                    {id:'bl',x:bx1,y:by2},{id:'bc',x:mx,y:by2},{id:'br',x:bx2,y:by2},
                ];
                for (const h of rHandles) {
                    if (Math.abs(x - h.x) < 9 && Math.abs(y - h.y) < 9) {
                        selHandleRef.current = {
                            type: 'resize', handle: h.id,
                            origBbox: { x1: bx1, y1: by1, x2: bx2, y2: by2 },
                            origElemsData: selIdxs.map(i => JSON.parse(JSON.stringify(elementos[i]))),
                            startX: x, startY: y,
                        };
                        return;
                    }
                }
                // ¿Click dentro → mover?
                if (x >= bx1 && x <= bx2 && y >= by1 && y <= by2) {
                    selMoveRef.current = { x, y }; return;
                }
            }
            // Fuera de la selección → nueva selección
            setSelIdxs([]); setLassoRect(null);
            setDibujando(true);
            setInicioXY({ x, y });
            setLassoRect({ x1: x, y1: y, x2: x, y2: y });
            return;
        }

        setDibujando(true);
        setInicioXY({ x, y });
        if (herramienta === 'draw')   setPreviewElement(tagElem({ t: 'draw', pts: [{x, y}], color: drawColor, grosor }));
        if (herramienta === 'eraser') setPreviewElement(tagElem({ t: 'draw', pts: [{x, y}], color: '#ffffff', grosor: grosor * 5 }));
    };

    const moverDibujo = (e) => {
        const pos = getPos(e);
        const { x, y, rawX, rawY } = pos;

        // Pan
        if (herramienta === 'pan' && panStartRef.current) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            panRef.current = {
                x: panStartRef.current.px + (rawX - panStartRef.current.rawX) * (canvas.width / rect.width),
                y: panStartRef.current.py + (rawY - panStartRef.current.rawY) * (canvas.height / rect.height),
            };
            triggerRedraw(); return;
        }
        // Handle drag (resize / rotate)
        if (herramienta === 'lasso' && selHandleRef.current) {
            const h = selHandleRef.current;
            if (h.type === 'rotate') {
                const angle = Math.atan2(y - h.cy, x - h.cx) - h.startAngle;
                setElementos(prev => prev.map((item, i) => {
                    const si = selIdxs.indexOf(i); if (si < 0) return item;
                    return applyRotationToElem(h.origElemsData[si], h.cx, h.cy, angle);
                }));
            } else if (h.type === 'resize') {
                const ob = h.origBbox;
                const origW = ob.x2 - ob.x1, origH = ob.y2 - ob.y1;
                const dx = x - h.startX, dy = y - h.startY;
                let nx1 = ob.x1, ny1 = ob.y1, nx2 = ob.x2, ny2 = ob.y2;
                if (h.handle.includes('l')) nx1 = ob.x1 + dx;
                if (h.handle.includes('r')) nx2 = ob.x2 + dx;
                if (h.handle.includes('t')) ny1 = ob.y1 + dy;
                if (h.handle.includes('b')) ny2 = ob.y2 + dy;
                const newW = nx2 - nx1, newH = ny2 - ny1;
                if (Math.abs(newW) < 5 || Math.abs(newH) < 5) return;
                const scaleX = newW / origW, scaleY = newH / origH;
                setElementos(prev => prev.map((item, i) => {
                    const si = selIdxs.indexOf(i); if (si < 0) return item;
                    return applyScaleToElem(h.origElemsData[si], ob.x1, ob.y1, scaleX, scaleY, nx1, ny1);
                }));
            }
            return;
        }
        // Selection move
        if (herramienta === 'lasso' && selMoveRef.current) {
            moverSeleccion(selIdxs, x - selMoveRef.current.x, y - selMoveRef.current.y);
            selMoveRef.current = { x, y }; return;
        }
        // Lasso draw
        if (herramienta === 'lasso' && dibujando) {
            setLassoRect({ x1: Math.min(inicioXY.x, x), y1: Math.min(inicioXY.y, y), x2: Math.max(inicioXY.x, x), y2: Math.max(inicioXY.y, y) });
            return;
        }
        if (!dibujando) return;
        if (herramienta === 'draw' || herramienta === 'eraser')
            setPreviewElement(prev => ({ ...prev, pts: [...prev.pts, {x, y}] }));
        else
            setPreviewElement({ t: herramienta, x1: inicioXY.x, y1: inicioXY.y, x2: x, y2: y, color, grosor, ...(herramienta === 'poligono' ? { lados: ladosPoligono } : {}) });
    };

    const terminarDibujo = () => {
        panStartRef.current  = null;
        selMoveRef.current   = null;
        selHandleRef.current = null;

        if (herramienta === 'lasso' && dibujando && lassoRect) {
            const w = lassoRect.x2 - lassoRect.x1, h = lassoRect.y2 - lassoRect.y1;
            if (w < 4 || h < 4) { setLassoRect(null); setDibujando(false); return; }
            // Keep lassoRect visible; compute selIdxs for element-move
            const sel = elementos.map((item, idx) => rectsOverlap(lassoRect, getBbox(item)) ? idx : -1).filter(i => i >= 0);
            setSelIdxs(sel); setDibujando(false); return;
        }
        if (!dibujando) return;
        setDibujando(false);
        if (previewElement) {
            // Shapes (line, rect, circle, …) created via preview need tagging too
            const tagged = modoRef.current === 'editar' && miIdRef.current
                ? { ...previewElement, autorId: miIdRef.current, autorColor: miColorRef.current }
                : previewElement;
            setElementos(prev => [...prev, tagged]);
            setPreviewElement(null);
        }
    };

    // ── Pages ────────────────────────────────────────────────────────────────
    const agregarPagina = () => {
        setPaginas(ps => [...ps, []]);
        setPaginaIdx(paginas.length);
        setSelIdxs([]);
    };
    const eliminarPagina = (idx) => {
        if (paginas.length === 1) return;
        setPaginas(ps => ps.filter((_, i) => i !== idx));
        setPaginaIdx(prev => Math.min(prev, paginas.length - 2));
        setSelIdxs([]);
    };
    const cambiarPagina = (idx) => {
        setPaginaIdx(idx); setSelIdxs([]); setPreviewElement(null); setDibujando(false);
    };
    const eliminarSeleccion = () => {
        if (!selIdxs.length) return;
        setElementos(prev => prev.filter((item, i) => {
            if (!selIdxs.includes(i)) return true;
            if (modoRef.current === 'editar' && item.autorId && item.autorId !== miIdRef.current) return true;
            return false;
        }));
        setSelIdxs([]);
    };

    const _extractRegionDataURL = () => {
        if (!lassoRect) return null;
        const src = canvasRef.current;
        // Render a clean offscreen canvas (elements only, no lasso border, no selection highlights)
        const clean = document.createElement('canvas');
        clean.width = src.width; clean.height = src.height;
        const ctx2 = clean.getContext('2d');
        ctx2.fillStyle = '#ffffff'; ctx2.fillRect(0, 0, clean.width, clean.height);
        ctx2.save();
        ctx2.translate(panRef.current.x, panRef.current.y);
        elementos.forEach(item => dibujarItem(ctx2, item, false));
        ctx2.restore();
        // Crop to lasso region
        const pw = Math.max(1, Math.round(lassoRect.x2 - lassoRect.x1));
        const ph = Math.max(1, Math.round(lassoRect.y2 - lassoRect.y1));
        const px1 = Math.round(lassoRect.x1 + panRef.current.x);
        const py1 = Math.round(lassoRect.y1 + panRef.current.y);
        const off = document.createElement('canvas');
        off.width = pw; off.height = ph;
        off.getContext('2d').drawImage(clean, px1, py1, pw, ph, 0, 0, pw, ph);
        return { src: off.toDataURL('image/png'), w: pw, h: ph };
    };

    const copiarRegion = () => {
        const region = _extractRegionDataURL();
        if (!region) return;
        setClipboardRegion(region);
        setLassoRect(null); setSelIdxs([]);
    };

    const cortarRegion = () => {
        const region = _extractRegionDataURL();
        if (!region) return;
        setClipboardRegion(region);
        setElementos(prev => [...prev, tagElem({
            t: 'eraser_rect', x1: lassoRect.x1, y1: lassoRect.y1, x2: lassoRect.x2, y2: lassoRect.y2,
        })]);
        setLassoRect(null); setSelIdxs([]);
    };

    const pegarRegion = () => {
        if (!clipboardRegion) return;
        setPendingInsert({ type: 'image', src: clipboardRegion.src, w: clipboardRegion.w, h: clipboardRegion.h });
        setHerramienta('geo_place');
    };

    const ERASER_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='22'%3E%3Crect x='1' y='1' width='34' height='20' rx='3' fill='%23fde8e8' stroke='%23e74c3c' stroke-width='1.5'/%3E%3Crect x='23' y='1' width='12' height='20' rx='0 3 3 0' fill='%23e74c3c' opacity='0.7'/%3E%3Cline x1='23' y1='1' x2='23' y2='21' stroke='%23e74c3c' stroke-width='1.5'/%3E%3C/svg%3E") 1 20, cell`;
    const CURSOR_MAP = { pan: 'grab', lasso: 'crosshair', paste: 'crosshair', text: 'text', graph: 'crosshair', axes: 'crosshair', geo_place: 'crosshair', eraser: ERASER_SVG };

    const ToolBtn = ({ id, icon, label }) => (
        <button onClick={() => { setHerramienta(id); setSelIdxs([]); setLassoRect(null); }} title={label}
            style={{ padding: 7, background: herramienta === id ? '#3498db' : 'transparent', color: herramienta === id ? 'white' : '#2c3e50', border: 'none', borderRadius: 8, cursor: 'pointer', display:'flex', alignItems:'center' }}>
            {icon}
        </button>
    );

    return (
        <div ref={contenedorRef} style={{ position: 'relative', width: '100%', maxWidth: fullscreen ? '100vw' : 1100, height: fullscreen ? '100%' : 'auto', margin: '0 auto', border: '2px solid #bdc3c7', borderRadius: 15, background: '#f8f9fa', overflow: fullscreen ? 'auto' : 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div style={{ background: '#ecf0f1', padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '2px solid #bdc3c7', flexWrap: 'wrap' }}>

                {/* Mode selector */}
                <select value={modoPizarra} onChange={e => { setModoPizarra(e.target.value); setHerramienta('draw'); setSelIdxs([]); setGeoTool(null); setGeoPaisData(null); setGeoBusqueda(''); setPendingInsert(null); }}
                    style={{ padding:'4px 8px', borderRadius:8, border:'2px solid #3498db', fontWeight:'bold', cursor:'pointer', background:'white', color:'#2c3e50', fontSize:'0.85rem' }}>
                    <option value="general">🖌 General</option>
                    <option value="musica">🎵 Música</option>
                    <option value="geo">🌍 Geografía</option>
                </select>

                {/* Common tools: draw, text, eraser, lasso, pan */}
                <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8 }}>
                    <ToolBtn id="draw"   icon={<PenTool size={18}/>} label="Lápiz" />
                    <ToolBtn id="text"   icon={<Type size={18}/>}    label="Texto" />
                    <ToolBtn id="eraser" icon={<span style={{fontSize:'1rem',lineHeight:1}}>⌫</span>} label="Goma" />
                    <ToolBtn id="lasso"  icon={<span style={{fontSize:'1rem',fontWeight:'bold'}}>⬚</span>} label="Seleccionar / Mover / Redimensionar / Girar" />
                    <ToolBtn id="pan"    icon={<Move size={18}/>}    label="Mover lienzo" />
                </div>

                {/* ── GENERAL MODE ── */}
                {modoPizarra === 'general' && <>
                    <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8 }}>
                        <ToolBtn id="line"     icon={<div style={{width:18,height:2,background:'currentColor',transform:'rotate(-45deg)',marginTop:8}}/>} label="Línea" />
                        <ToolBtn id="rect"     icon={<SquareIcon size={18}/>} label="Rectángulo" />
                        <ToolBtn id="circle"   icon={<Circle size={18}/>}     label="Círculo" />
                        <ToolBtn id="triangle" icon={<Triangle size={18}/>}   label="Triángulo" />
                        <ToolBtn id="poligono" icon={<Hexagon size={18}/>}    label="Polígono regular (elige lados)" />
                    </div>
                    <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8 }}>
                        <ToolBtn id="prisma"   icon={<Box size={18}/>}                            label="Cubo/Prisma" />
                        <ToolBtn id="pyramid"  icon={<span style={{fontWeight:'bold'}}>▲³</span>} label="Pirámide" />
                        <ToolBtn id="cylinder" icon={<span>🛢</span>}                             label="Cilindro" />
                        <ToolBtn id="cone"     icon={<span>◮</span>}                              label="Cono" />
                        <ToolBtn id="sphere"   icon={<span>⚽</span>}                             label="Esfera" />
                    </div>
                </>}

                {/* ── MUSIC MODE ── */}
                {modoPizarra === 'musica' && <>
                    {/* Staff */}
                    <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8 }}>
                        <ToolBtn id="staff"    icon={<span style={{fontSize:'0.75rem',fontWeight:'bold',letterSpacing:-1}}>𝄞═══</span>} label="Pentagrama (clave Sol)" />
                        <ToolBtn id="staff_fa" icon={<span style={{fontSize:'0.75rem',fontWeight:'bold',letterSpacing:-1}}>𝄢═══</span>} label="Pentagrama (clave Fa)" />
                    </div>
                    {/* Notes */}
                    <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8, alignItems:'center' }}>
                        <span style={{fontSize:'0.7rem',color:'#7f8c8d',fontWeight:'bold'}}>Notas</span>
                        {[
                            { id:'redonda',     sym:'𝅝',   title:'Redonda' },
                            { id:'blanca',      sym:'𝅗𝅥',  title:'Blanca' },
                            { id:'negra',       sym:'♩',   title:'Negra' },
                            { id:'corchea',     sym:'♪',   title:'Corchea' },
                            { id:'semicorchea', sym:'♬',   title:'Semicorchea' },
                            { id:'fusa',        sym:'♫♫',  title:'Fusa' },
                        ].map(n => (
                            <ToolBtn key={n.id} id={n.id} label={n.title}
                                icon={<span style={{fontSize:'1.1rem',lineHeight:1}}>{n.sym}</span>} />
                        ))}
                    </div>
                    {/* Rests */}
                    <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8, alignItems:'center' }}>
                        <span style={{fontSize:'0.7rem',color:'#7f8c8d',fontWeight:'bold'}}>Silencios</span>
                        {[
                            { id:'s_redonda', sym:'▬',  title:'Silencio redonda' },
                            { id:'s_blanca',  sym:'▭',  title:'Silencio blanca' },
                            { id:'s_negra',   sym:'𝄽',  title:'Silencio negra' },
                            { id:'s_corchea', sym:'𝄾',  title:'Silencio corchea' },
                        ].map(r => (
                            <ToolBtn key={r.id} id={r.id} label={r.title}
                                icon={<span style={{fontSize:'1.1rem',lineHeight:1}}>{r.sym}</span>} />
                        ))}
                    </div>
                    {/* Accidentals */}
                    <div style={{ display:'flex', gap:3, borderRight:'2px solid #bdc3c7', paddingRight:8, alignItems:'center' }}>
                        <span style={{fontSize:'0.7rem',color:'#7f8c8d',fontWeight:'bold'}}>Acc.</span>
                        {[
                            { id:'sharp',   sym:'♯', title:'Sostenido' },
                            { id:'flat',    sym:'♭', title:'Bemol' },
                            { id:'natural', sym:'♮', title:'Natural' },
                        ].map(a => (
                            <ToolBtn key={a.id} id={a.id} label={a.title}
                                icon={<span style={{fontSize:'1.2rem',lineHeight:1}}>{a.sym}</span>} />
                        ))}
                    </div>
                    {/* Con sonido */}
                    <div style={{ display:'flex', gap:3, alignItems:'center', paddingLeft:4 }}>
                        <button
                            onClick={() => setShowMusicStaff(true)}
                            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'linear-gradient(135deg,#6c63ff,#3b82f6)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:'0.8rem', whiteSpace:'nowrap', boxShadow:'0 2px 6px rgba(108,99,255,0.4)' }}
                            title="Crear pentagrama con sonido">
                            🎵 Con sonido
                        </button>
                    </div>
                </>}

                {/* ── GEO MODE ── */}
                {modoPizarra === 'geo' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5, width:'100%' }}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                            {[
                                { id:'pais_mapa',  icon:'🗺️', label:'Mapa País' },
                                { id:'continente', icon:'🌍', label:'Continente' },
                                { id:'bandera',    icon:'🚩', label:'Bandera' },
                                { id:'info',       icon:'ℹ️',  label:'Información' },
                            ].map(({ id, icon, label }) => (
                                <button key={id}
                                    onClick={() => { setGeoTool(geoTool === id ? null : id); setGeoPaisData(null); setGeoBusqueda(''); setPendingInsert(null); }}
                                    style={{ padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
                                        background: geoTool === id ? '#1e3a5f' : '#dbeafe',
                                        color: geoTool === id ? '#fff' : '#1e40af' }}>
                                    {icon} {label}
                                </button>
                            ))}
                            <div style={{ width:1, height:22, background:'#bdc3c7', margin:'0 4px' }} />
                            {[
                                { id:'cordilleras', icon:'⛰️', label:'Cordilleras' },
                                { id:'rios',        icon:'🌊', label:'Ríos' },
                                { id:'ciudades',    icon:'🏙️', label:'Ciudades' },
                            ].map(({ id, icon, label }) => (
                                <button key={id}
                                    onClick={() => { setGeoTool(geoTool === id ? null : id); setGeoPaisData(null); setGeoBusqueda(''); setPendingInsert(null); }}
                                    style={{ padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
                                        background: geoTool === id ? '#14532d' : '#dcfce7',
                                        color: geoTool === id ? '#fff' : '#166534' }}>
                                    {icon} {label}
                                </button>
                            ))}
                            <div style={{ width:1, height:22, background:'#bdc3c7', margin:'0 4px' }} />
                            <button onClick={generarMapaProvinciasEspana}
                                title="Genera el mapa de provincias de España y lo coloca en la pizarra"
                                style={{ padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem', background:'#fef3c7', color:'#92400e' }}>
                                🗾 España Provincias
                            </button>
                            <button onClick={generarMapaGeoEspana}
                                title="Genera el mapa de elementos geográficos de España (ríos, montañas, ciudades)"
                                style={{ padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem', background:'#fef3c7', color:'#92400e' }}>
                                🌍 España Geo
                            </button>
                        </div>
                        {(geoTool === 'pais_mapa' || geoTool === 'bandera' || geoTool === 'info') && (
                            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', padding:'6px 8px', background:'#f8faff', borderRadius:8, border:'1px solid #bfdbfe' }}>
                                <input value={geoBusqueda} onChange={e => setGeoBusqueda(e.target.value)}
                                    onKeyDown={e => e.key==='Enter' && buscarPaisGeo()}
                                    placeholder="Nombre del país en inglés (Spain, France...)"
                                    style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #93c5fd', fontSize:'0.82rem', outline:'none', flex:1, minWidth:160 }} />
                                <button onClick={buscarPaisGeo}
                                    style={{ padding:'5px 12px', background:'#2563eb', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                                    {geoCargando ? '...' : '🔍'}
                                </button>
                                {geoPaisData && geoTool === 'pais_mapa' && (
                                    <button onClick={prepararMapaGeo_GeoMode}
                                        style={{ padding:'5px 12px', background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                                        🗺️ Abrir visor de mapa
                                    </button>
                                )}
                                {geoPaisData && geoTool === 'bandera' && (
                                    <button onClick={prepararBanderaGeo}
                                        style={{ padding:'5px 12px', background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                                        📌 Colocar
                                    </button>
                                )}
                                {geoPaisData && geoTool === 'info' && (
                                    <button onClick={prepararInfoGeo}
                                        style={{ padding:'5px 12px', background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                                        📌 Colocar
                                    </button>
                                )}
                                {geoPaisData && (
                                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                        {geoPaisData.flags?.svg && <img src={geoPaisData.flags.svg} alt="" style={{ height:20, borderRadius:2 }} />}
                                        <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#1e3a5f' }}>{geoPaisData.name?.common}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {geoTool === 'continente' && (
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:'6px 8px', background:'#f8faff', borderRadius:8, border:'1px solid #bfdbfe', alignItems:'center' }}>
                                {['África','Asia','Europa','América del Norte','América del Sur','Oceanía','Antártida'].map(label => (
                                    <button key={label} onClick={() => setGeoVisible(true)}
                                        style={{ padding:'4px 10px', borderRadius:16, border:'1px solid #93c5fd', background:'#eff6ff', color:'#1e40af', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
                                        {label}
                                    </button>
                                ))}
                                <span style={{ fontSize:'0.75rem', color:'#64748b' }}>→ usa el visor de mapa</span>
                            </div>
                        )}
                        {geoTool === 'cordilleras' && (
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:'6px 8px', background:'#fefce8', borderRadius:8, border:'1px solid #fde68a', maxHeight:110, overflowY:'auto' }}>
                                {CORDILLERAS.map(c => (
                                    <button key={c.nombre}
                                        onClick={() => { setPendingInsert({ type:'label', txt:c.nombre, icon:'⛰️', color:'#78350f' }); setHerramienta('geo_place'); }}
                                        title={c.region}
                                        style={{ padding:'3px 9px', borderRadius:16, border:'1px solid #fbbf24', background:'#fffbeb', color:'#92400e', cursor:'pointer', fontSize:'0.78rem', fontWeight:600, whiteSpace:'nowrap' }}>
                                        ⛰️ {c.nombre}
                                    </button>
                                ))}
                            </div>
                        )}
                        {geoTool === 'rios' && (
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:'6px 8px', background:'#eff6ff', borderRadius:8, border:'1px solid #93c5fd', maxHeight:110, overflowY:'auto' }}>
                                {RIOS.map(r => (
                                    <button key={r.nombre}
                                        onClick={() => { setPendingInsert({ type:'label', txt:r.nombre, icon:'🌊', color:'#1d4ed8' }); setHerramienta('geo_place'); }}
                                        title={r.region}
                                        style={{ padding:'3px 9px', borderRadius:16, border:'1px solid #93c5fd', background:'#dbeafe', color:'#1e40af', cursor:'pointer', fontSize:'0.78rem', fontWeight:600, whiteSpace:'nowrap' }}>
                                        🌊 {r.nombre}
                                    </button>
                                ))}
                            </div>
                        )}
                        {geoTool === 'ciudades' && (
                            <div style={{ display:'flex', gap:6, alignItems:'center', padding:'6px 8px', background:'#f0fdf4', borderRadius:8, border:'1px solid #86efac', flexWrap:'wrap' }}>
                                <input value={geoBusqueda} onChange={e => setGeoBusqueda(e.target.value)}
                                    onKeyDown={e => { if (e.key==='Enter' && geoBusqueda.trim()) { setPendingInsert({ type:'label', txt:geoBusqueda.trim(), icon:'🏙️', color:'#14532d' }); setHerramienta('geo_place'); setGeoBusqueda(''); } }}
                                    placeholder="Nombre de ciudad... (Enter para colocar)"
                                    style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #86efac', fontSize:'0.82rem', outline:'none', flex:1, minWidth:180 }} />
                                <button onClick={() => { if (geoBusqueda.trim()) { setPendingInsert({ type:'label', txt:geoBusqueda.trim(), icon:'🏙️', color:'#14532d' }); setHerramienta('geo_place'); setGeoBusqueda(''); } }}
                                    style={{ padding:'5px 12px', background:'#16a34a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                                    📌 Colocar
                                </button>
                            </div>
                        )}
                        {pendingInsert && herramienta === 'geo_place' && (
                            <div style={{ padding:'5px 10px', background:'#fef3c7', borderRadius:6, border:'1px solid #fbbf24', fontSize:'0.8rem', color:'#92400e', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                                🖱️ Haz clic en el lienzo para colocar
                                <button onClick={() => { setPendingInsert(null); setHerramienta('draw'); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontWeight:700, padding:0 }}>✕ Cancelar</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Color + thickness — hidden for collaborative spectators (color fixed) */}
                {modoCompartir !== 'editar' && (
                    <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)}
                            style={{ border:'none', width:26, height:26, cursor:'pointer', background:'transparent', padding:0 }} />
                        {['#2c3e50','#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#ffffff'].map(c => (
                            <button key={c} onClick={() => setColor(c)}
                                style={{ width:18, height:18, borderRadius:'50%', background:c, border: color===c ? '2px solid #3498db' : '2px solid #95a5a6', cursor:'pointer', padding:0, flexShrink:0 }} />
                        ))}
                        {modoPizarra === 'general' && (
                            <input type="range" min="1" max="10" value={grosor} onChange={e => setGrosor(Number(e.target.value))} style={{ width:55 }} />
                        )}
                    </div>
                )}
                {/* En modo colaborativo mostrar el color asignado */}
                {modoCompartir === 'editar' && miColorParticipante && (
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background:miColorParticipante, border:'2px solid #7f8c8d' }} title="Tu color asignado" />
                        <span style={{ fontSize:'0.75rem', color:'#555', fontWeight:'bold' }}>Tu color</span>
                        {modoPizarra === 'general' && (
                            <input type="range" min="1" max="10" value={grosor} onChange={e => setGrosor(Number(e.target.value))} style={{ width:55 }} />
                        )}
                    </div>
                )}

                {/* Action buttons (common) */}
                <div style={{ marginLeft:'auto', display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                    {selIdxs.length > 0 && (
                        <button onClick={eliminarSeleccion}
                            style={{ padding:'5px 8px', background:'#e74c3c', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:'bold', fontSize:'0.78rem' }}>
                            🗑 {selIdxs.length}
                        </button>
                    )}
                    {modoPizarra === 'general' && modoCompartir !== 'ver' && <>
                        <button onClick={() => setHerramienta('axes')}
                            style={{ padding:'5px 7px', background: herramienta==='axes' ? '#16a085' : '#27ae60', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:'bold', fontSize:'0.78rem' }}>
                            XY
                        </button>
                        <button onClick={() => setGrafVisible(v => !v)} style={{ padding:'5px', background:'#e67e22', color:'white', border:'none', borderRadius:7, cursor:'pointer' }} title="Graficar f(x)">
                            <Activity size={15}/>
                        </button>
                        <button onClick={() => setCalcVisible(v => !v)} style={{ padding:'5px', background:'#9b59b6', color:'white', border:'none', borderRadius:7, cursor:'pointer' }} title="Calculadora">
                            <CalcIcon size={15}/>
                        </button>
                        <button onClick={() => setGeoVisible(v => !v)} style={{ padding:'5px 7px', background: geoVisible ? '#1e3a5f' : '#1565C0', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem' }} title="Geografía: mapas, banderas e información de países">
                            🌍
                        </button>
                    </>}
                    {modoCompartir !== 'ver' && <>
                        {/* Imagen: menú con dos opciones */}
                        <div style={{ position:'relative' }}>
                            <button
                                onClick={() => { setImgMenuOpen(v => !v); setImgBuscador(false); }}
                                title="Insertar imagen"
                                style={{ padding:'5px', background: imgMenuOpen ? '#0e6b56' : '#16a085', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}>
                                <ImageIcon size={15}/>
                            </button>
                            {imgMenuOpen && (
                                <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'white', border:'1px solid #ccc', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.18)', zIndex:600, minWidth:170, overflow:'hidden' }}>
                                    <button
                                        onClick={() => { fileInputRef.current?.click(); setImgMenuOpen(false); }}
                                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', fontSize:'0.85rem', color:'#1e293b', borderBottom:'1px solid #f1f5f9' }}
                                        onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background='none'}
                                    >
                                        📁 Desde el dispositivo
                                    </button>
                                    <button
                                        onClick={() => { setImgBuscador(true); setImgMenuOpen(false); }}
                                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', fontSize:'0.85rem', color:'#1e293b' }}
                                        onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background='none'}
                                    >
                                        🔍 Buscar imagen online
                                    </button>
                                </div>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onFileSelected} />
                    </>}
                    <button onClick={descargarPagina} title="PNG hoja actual"
                        style={{ padding:'5px', background:'#2ecc71', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}>
                        <Camera size={15}/>
                    </button>
                    {modoCompartir !== 'ver' && <>
                        <button onClick={descargarTodasPNG}
                            style={{ padding:'5px 7px', background:'#27ae60', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold' }}>
                            PNG×{paginas.length}
                        </button>
                        <button onClick={descargarPDF}
                            style={{ padding:'5px 7px', background:'#c0392b', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:'0.75rem', fontWeight:'bold' }}>
                            PDF
                        </button>
                        <button onClick={() => { if (window.confirm('¿Borrar todo el contenido de esta hoja?')) { setElementos([]); setSelIdxs([]); } }}
                            style={{ padding:'5px 7px', background:'#e74c3c', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem' }}>
                            ✕
                        </button>
                    </>}
                    {/* Botón compartir */}
                    {!modoCompartir ? (
                        <button onClick={() => { setCompartirModal(true); setErrorCompartir(''); }}
                            style={{ padding:'5px 9px', background:'#8e44ad', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:'bold', fontSize:'0.78rem', display:'flex', alignItems:'center', gap:4 }}>
                            📡 Compartir
                        </button>
                    ) : (
                        <button onClick={() => setCompartirModal(v => !v)}
                            style={{ padding:'5px 9px', background: modoCompartir === 'ver' ? '#8e44ad' : '#27ae60', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:'bold', fontSize:'0.78rem', display:'flex', alignItems:'center', gap:4 }}>
                            {modoCompartir === 'ver' ? '👁' : '✏️'} {codigoCompartir}
                        </button>
                    )}
                    <button onClick={toggleFullscreen} title={fullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
                        style={{ padding:'5px', background:'#34495e', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}>
                        {fullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
                    </button>
                </div>
            </div>

            {/* Status hints */}
            {herramienta === 'poligono' && (
                <div style={{ background:'#f1c40f', color:'#78350f', padding:'4px 10px', display:'flex', alignItems:'center', gap:10, fontWeight:'bold', fontSize:'0.82rem', flexWrap:'wrap' }}>
                    <span>Polígono regular</span>
                    <label style={{ display:'flex', alignItems:'center', gap:5 }}>
                        Lados:
                        <input type="number" min={3} max={20} value={ladosPoligono}
                            onChange={e => setLadosPoligono(Math.max(3, Math.min(20, parseInt(e.target.value) || 3)))}
                            style={{ width:52, padding:'1px 6px', borderRadius:5, border:'1px solid #d97706', textAlign:'center', fontWeight:'bold', fontSize:'0.85rem' }} />
                    </label>
                    <span style={{ fontWeight:400 }}>— Arrastra en el lienzo para dibujar</span>
                </div>
            )}
            {herramienta === 'paste'  && <div style={{ background:'#f1c40f', color:'#2c3e50', padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Haz clic para pegar: {textoPegar}</div>}
            {herramienta === 'graph'  && <div style={{ background:'#e67e22', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Haz clic para situar el origen de la gráfica f(x).</div>}
            {herramienta === 'axes'   && <div style={{ background:'#16a085', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Haz clic para colocar el origen (0,0) de los ejes (−8 a 8).</div>}
            {herramienta === 'pan'    && <div style={{ background:'#34495e', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Arrastra para mover el lienzo · Doble clic para resetear.</div>}
            {herramienta === 'lasso' && (
                <div style={{ background:'#3498db', color:'white', padding:'4px 8px', display:'flex', gap:8, justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'0.82rem', flexWrap:'wrap' }}>
                    {lassoRect && !dibujando ? (
                        <>
                            <span>Región seleccionada.</span>
                            <button onClick={cortarRegion}  style={{ padding:'2px 12px', background:'#e74c3c', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:'bold', fontSize:'0.82rem' }}>✂️ Cortar</button>
                            <button onClick={copiarRegion}  style={{ padding:'2px 12px', background:'rgba(255,255,255,0.22)', color:'white', border:'1px solid rgba(255,255,255,0.45)', borderRadius:6, cursor:'pointer', fontWeight:'bold', fontSize:'0.82rem' }}>📋 Copiar</button>
                            {clipboardRegion && <button onClick={pegarRegion} style={{ padding:'2px 12px', background:'#f39c12', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:'bold', fontSize:'0.82rem' }}>📌 Pegar</button>}
                            <button onClick={() => { setLassoRect(null); setSelIdxs([]); }} style={{ padding:'2px 8px', background:'rgba(255,255,255,0.12)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:6, cursor:'pointer', fontSize:'0.82rem' }}>✕</button>
                        </>
                    ) : (
                        <>
                            <span>Arrastra para seleccionar una región del lienzo.</span>
                            {clipboardRegion && <button onClick={pegarRegion} style={{ padding:'2px 12px', background:'#f39c12', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:'bold', fontSize:'0.82rem' }}>📌 Pegar</button>}
                        </>
                    )}
                </div>
            )}

            {/* ── Panel de texto ───────────────────────────────────────── */}
            {herramienta === 'text' && (
                <div style={{ background:'#fef9e7', borderBottom:'2px solid #f1c40f', padding:'6px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        {/* Tamaño */}
                        <select value={textoFontSize} onChange={e => setTextoFontSize(Number(e.target.value))}
                            style={{ padding:'4px 6px', borderRadius:6, border:'1.5px solid #f1c40f', fontSize:'0.82rem', fontWeight:'bold', background:'white' }}>
                            {[12,16,20,24,32,40,56].map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                        {/* Input */}
                        <input value={textoInput} onChange={e => setTextoInput(e.target.value)}
                            placeholder="Escribe el texto o usa el micrófono…"
                            style={{ flex:1, minWidth:160, padding:'5px 10px', borderRadius:7, border:'1.5px solid #f1c40f', fontSize:'0.88rem', fontFamily:'inherit', outline:'none' }}/>
                        {/* Micrófono */}
                        <button onClick={toggleVoz} title={escuchando ? 'Detener voz' : 'Dictar texto'}
                            style={{ padding:'5px 8px', borderRadius:7, border:'none', background: escuchando ? '#e74c3c' : '#3498db', color:'white', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem', minWidth:34, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {escuchando ? '⏹' : '🎤'}
                        </button>
                        {/* Emojis */}
                        <button onClick={() => setEmojiPanelOpen(v => !v)} title="Emojis"
                            style={{ padding:'5px 8px', borderRadius:7, border:'none', background: emojiPanelOpen ? '#f39c12' : '#ecf0f1', color:'#2c3e50', cursor:'pointer', fontSize:'1rem' }}>
                            😊
                        </button>
                        {textoInput && (
                            <button onClick={() => setTextoInput('')}
                                style={{ padding:'5px 7px', borderRadius:7, border:'none', background:'#ecf0f1', color:'#7f8c8d', cursor:'pointer', fontSize:'0.8rem' }}>
                                ✕
                            </button>
                        )}
                        <span style={{ fontSize:'0.75rem', color:'#7f8c8d' }}>Haz clic en el lienzo para colocar el texto</span>
                    </div>
                    {/* Panel de emojis */}
                    {emojiPanelOpen && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'6px 8px', background:'white', borderRadius:8, border:'1.5px solid #f1c40f', maxHeight:110, overflowY:'auto' }}>
                            {['😀','😂','🥰','😎','😢','😡','🤔','🤩','🥳','😴',
                              '👍','👎','👋','👏','✌️','❤️','🔥','⭐','🌟','✅',
                              '❌','💡','📚','✏️','🎯','🎨','🎵','🏆','🎲','🔑',
                              '🌈','🌊','🌸','🍀','☀️','🌙','🐶','🐱','🦁','🦊',
                              '🐦','🍎','🍕','⚽','🚀','✈️','🚗','💻','🏠','📝'].map(em => (
                                <button key={em} onClick={() => setTextoInput(prev => prev + em)}
                                    style={{ padding:'3px 5px', borderRadius:5, border:'none', background:'transparent', fontSize:'1.3rem', cursor:'pointer', lineHeight:1 }}>
                                    {em}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Floating panels */}
            {calcVisible && <CalculadoraFlotante onClose={() => setCalcVisible(false)} onCopiar={res => { setTextoPegar(res); setHerramienta('paste'); setCalcVisible(false); }} />}
            {grafVisible  && <GraficadoraFlotante onClose={() => setGrafVisible(false)} onInsertar={cfg => { setGraficaConfig(cfg); setHerramienta('graph'); setGrafVisible(false); }} />}
            {showMusicStaff && <MusicStaffPanel onInsert={handleInsertMusicStaff} onClose={() => setShowMusicStaff(false)} />}
            {/* ── Buscador de imágenes Wikimedia ──────────────────────────── */}
            {imgBuscador && (
                <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.45)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }}
                    onClick={e => { if (e.target===e.currentTarget) { setImgBuscador(false); setImgResults([]); } }}>
                    <div style={{ background:'white', borderRadius:14, width:'min(96vw, 580px)', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.28)', overflow:'hidden' }}>
                        {/* Header */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #e2e8f0', background:'#1e293b' }}>
                            <span style={{ color:'white', fontWeight:700, fontSize:'0.95rem' }}>🔍 Buscar imagen — Wikimedia Commons</span>
                            <button onClick={() => { setImgBuscador(false); setImgResults([]); }} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:18 }}>✕</button>
                        </div>
                        {/* Search bar */}
                        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9' }}>
                            <p style={{ margin:'0 0 8px', fontSize:'0.75rem', color:'#64748b' }}>Imágenes libres de derechos — también puedes pegar una URL directamente</p>
                            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                                <input
                                    value={imgQuery}
                                    onChange={e => setImgQuery(e.target.value)}
                                    onKeyDown={e => e.key==='Enter' && buscarImagenesWikimedia()}
                                    placeholder="Ej: sistema solar, célula, mapa Europa..."
                                    style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:'0.85rem', outline:'none' }}
                                    autoFocus
                                />
                                <button onClick={buscarImagenesWikimedia}
                                    style={{ padding:'8px 16px', background:'#2563eb', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }}>
                                    {imgSearching ? '...' : 'Buscar'}
                                </button>
                            </div>
                            <input
                                placeholder="O pega una URL de imagen directamente y pulsa Enter..."
                                style={{ width:'100%', boxSizing:'border-box', padding:'7px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:'0.8rem', outline:'none', color:'#475569' }}
                                onKeyDown={e => { if (e.key==='Enter' && e.target.value.startsWith('http')) { insertarImagenDesdeURL(e.target.value); e.target.value=''; } }}
                            />
                        </div>
                        {/* Results grid */}
                        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
                            {imgResults.length > 0 ? (
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:8 }}>
                                    {imgResults.map((url, i) => (
                                        <img key={i} src={url} alt=""
                                            onClick={() => insertarImagenDesdeURL(url)}
                                            onError={e => { e.target.style.display='none'; }}
                                            style={{ width:'100%', height:80, objectFit:'cover', borderRadius:8, cursor:'pointer', border:'2px solid transparent', transition:'border 0.15s' }}
                                            onMouseEnter={e => e.target.style.border='2px solid #2563eb'}
                                            onMouseLeave={e => e.target.style.border='2px solid transparent'}
                                        />
                                    ))}
                                </div>
                            ) : imgSearching ? (
                                <p style={{ textAlign:'center', color:'#94a3b8', padding:'30px 0' }}>Buscando...</p>
                            ) : imgQuery ? (
                                <p style={{ textAlign:'center', color:'#94a3b8', padding:'30px 0' }}>Sin resultados. Prueba otro término o pega una URL.</p>
                            ) : (
                                <p style={{ textAlign:'center', color:'#cbd5e1', padding:'30px 0', fontSize:'0.85rem' }}>Escribe un término y pulsa Buscar</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {geoVisible && (
                <GeografiaPanel
                    onClose={() => setGeoVisible(false)}
                    onPegarEnPizarra={(dataURL, w = 500, h = 340) => {
                        setPendingInsert({ type: 'image', src: dataURL, w, h });
                        setHerramienta('geo_place');
                        setGeoVisible(false);
                    }}
                />
            )}
            {SHAPES_3D.includes(herramienta) && <Visor3D shape={herramienta} onClose={() => setHerramienta('draw')}
                onPegarEnPizarra={(dataURL) => {
                    const img = new Image();
                    img.onload = () => {
                        const maxW = 380, maxH = 260;
                        let w = img.width, h = img.height;
                        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
                        setPendingInsert({ type: 'image', src: dataURL, w, h });
                        setHerramienta('geo_place');
                    };
                    img.src = dataURL;
                }}
            />}

            {/* ── Modal compartir ──────────────────────────────────────── */}
            {compartirModal && (
                <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.55)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setCompartirModal(false); }}>
                    <div style={{ background:'white', borderRadius:16, padding:28, maxWidth:440, width:'90%', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', position:'relative' }}>
                        <button onClick={() => setCompartirModal(false)}
                            style={{ position:'absolute', top:10, right:12, background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#888' }}>×</button>

                        {/* ─ Ya hay sesión activa ─ */}
                        {modoCompartir && (() => {
                            const shareUrl = `${window.location.origin}${window.location.pathname}?pizarra=${codigoCompartir}`;
                            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}&bgcolor=ffffff&color=1a1a2e&margin=6`;
                            const copiarLink = () => {
                                navigator.clipboard.writeText(shareUrl).then(() => {
                                    setCopiadoLink(true);
                                    setTimeout(() => setCopiadoLink(false), 2000);
                                });
                            };
                            return (
                                <div>
                                    {/* Tipo de sesión */}
                                    <div style={{ textAlign:'center', marginBottom:12 }}>
                                        <div style={{ fontSize:'0.85rem', color:'#7f8c8d', marginBottom:6 }}>
                                            {modoCompartir === 'ver' ? '👁 Solo lectura' : '✏️ Colaborativa'}
                                            {esCreador ? ' · Creador' : ' · Participante'}
                                        </div>
                                        {/* Código grande */}
                                        <div style={{ fontSize:'2rem', fontWeight:900, letterSpacing:6, color:'#2c3e50', background:'#ecf0f1', borderRadius:10, padding:'8px 18px', display:'inline-block' }}>
                                            {codigoCompartir}
                                        </div>
                                    </div>

                                    {/* Enlace + QR lado a lado */}
                                    <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:14 }}>
                                        {/* QR */}
                                        <div style={{ textAlign:'center', flexShrink:0 }}>
                                            <img src={qrSrc} alt="QR" width={100} height={100}
                                                style={{ borderRadius:8, border:'2px solid #ecf0f1', display:'block' }} />
                                            <div style={{ fontSize:'0.65rem', color:'#95a5a6', marginTop:3 }}>Escanear para unirse</div>
                                        </div>
                                        {/* Link + botones */}
                                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                                            <div style={{ fontSize:'0.7rem', color:'#7f8c8d', fontWeight:'bold', marginBottom:2 }}>Enlace directo</div>
                                            <div style={{ background:'#f4f6f8', borderRadius:7, padding:'6px 8px', fontSize:'0.65rem', color:'#555', wordBreak:'break-all', border:'1px solid #dde', lineHeight:1.4 }}>
                                                {shareUrl}
                                            </div>
                                            <button onClick={copiarLink}
                                                style={{ padding:'7px', background: copiadoLink ? '#27ae60' : '#8e44ad', color:'white', border:'none', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize:'0.78rem', transition:'background 0.2s' }}>
                                                {copiadoLink ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Participantes */}
                                    {participantes.length > 0 && (
                                        <div style={{ marginBottom:14 }}>
                                            <div style={{ fontWeight:'bold', fontSize:'0.82rem', color:'#555', marginBottom:5 }}>Participantes ({participantes.length})</div>
                                            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                                {participantes.map(p => (
                                                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:5, background:'#f4f6f8', borderRadius:20, padding:'4px 10px', border:`2px solid ${p.color}` }}>
                                                        <div style={{ width:10, height:10, borderRadius:'50%', background:p.color }} />
                                                        <span style={{ fontSize:'0.8rem', fontWeight:600, color:'#2c3e50' }}>{p.nombre}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={() => { pararCompartir(); setCompartirModal(false); }}
                                        style={{ width:'100%', padding:'10px', background:'#e74c3c', color:'white', border:'none', borderRadius:10, fontWeight:'bold', cursor:'pointer', fontSize:'0.9rem' }}>
                                        ⏹ Detener sesión compartida
                                    </button>
                                </div>
                            );
                        })()}

                        {/* ─ Sin sesión activa: crear o unirse ─ */}
                        {!modoCompartir && (
                            <div>
                                <h3 style={{ margin:'0 0 16px', textAlign:'center', color:'#2c3e50' }}>📡 Compartir Pizarra</h3>

                                {/* Crear sesión */}
                                <div style={{ marginBottom:18 }}>
                                    <div style={{ fontWeight:'bold', fontSize:'0.88rem', color:'#555', marginBottom:8 }}>Crear sesión</div>
                                    <div style={{ display:'flex', gap:8 }}>
                                        <button onClick={() => crearSesion('ver')}
                                            style={{ flex:1, padding:'11px 8px', background:'#8e44ad', color:'white', border:'none', borderRadius:10, fontWeight:'bold', cursor:'pointer', fontSize:'0.82rem' }}>
                                            👁 Solo lectura
                                            <div style={{ fontWeight:'normal', fontSize:'0.72rem', opacity:0.85, marginTop:2 }}>Los demás ven, no editan</div>
                                        </button>
                                        <button onClick={() => crearSesion('editar')}
                                            style={{ flex:1, padding:'11px 8px', background:'#27ae60', color:'white', border:'none', borderRadius:10, fontWeight:'bold', cursor:'pointer', fontSize:'0.82rem' }}>
                                            ✏️ Colaborativa
                                            <div style={{ fontWeight:'normal', fontSize:'0.72rem', opacity:0.85, marginTop:2 }}>Todos pueden dibujar</div>
                                        </button>
                                    </div>
                                </div>

                                <div style={{ borderTop:'1px solid #ecf0f1', margin:'16px 0' }} />

                                {/* Unirse a sesión */}
                                <div>
                                    <div style={{ fontWeight:'bold', fontSize:'0.88rem', color:'#555', marginBottom:8 }}>Unirse a sesión</div>
                                    <input placeholder="Código (ej. AB12CD)" value={codigoUnirseInput} onChange={e => setCodigoUnirseInput(e.target.value.toUpperCase())}
                                        style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'2px solid #bdc3c7', fontSize:'1rem', marginBottom:8, boxSizing:'border-box', letterSpacing:4, fontWeight:'bold', textAlign:'center' }} />
                                    <input placeholder="Tu nombre" value={nombreUnirse} onChange={e => setNombreUnirse(e.target.value)}
                                        style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'2px solid #bdc3c7', fontSize:'0.9rem', marginBottom:10, boxSizing:'border-box' }} />
                                    {errorCompartir && <div style={{ color:'#e74c3c', fontSize:'0.8rem', marginBottom:8 }}>{errorCompartir}</div>}
                                    <button onClick={unirseASesion} disabled={juntandose}
                                        style={{ width:'100%', padding:'10px', background:'#3498db', color:'white', border:'none', borderRadius:10, fontWeight:'bold', cursor:'pointer', fontSize:'0.9rem', opacity: juntandose ? 0.7 : 1 }}>
                                        {juntandose ? 'Uniéndose…' : '🔗 Unirse'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Panel participantes (barra inferior cuando hay sesión colaborativa) */}
            {modoCompartir === 'editar' && participantes.length > 0 && (
                <div style={{ background:'#2c3e50', padding:'4px 10px', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
                    <span style={{ color:'#95a5a6', fontSize:'0.72rem', fontWeight:'bold' }}>✏️ SESIÓN:</span>
                    {participantes.map(p => (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:4, background: p.id === miId ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius:12, padding:'2px 8px', border:`1.5px solid ${p.color}` }}>
                            <div style={{ width:9, height:9, borderRadius:'50%', background:p.color }} />
                            <span style={{ color:'white', fontSize:'0.75rem', fontWeight: p.id === miId ? 700 : 400 }}>{p.nombre}{p.id === miId ? ' (tú)' : ''}</span>
                        </div>
                    ))}
                    <span style={{ color:'#7f8c8d', fontSize:'0.7rem', marginLeft:'auto' }}>Código: <b style={{color:'white'}}>{codigoCompartir}</b></span>
                </div>
            )}
            {modoCompartir === 'ver' && (
                <div style={{ background: esCreador ? '#8e44ad' : '#6c3483', padding:'3px 10px', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ color:'white', fontSize:'0.75rem', fontWeight:'bold' }}>
                        {esCreador ? '📡 Emitiendo en vivo · Código:' : '👁 Viendo en vivo · Código:'}
                    </span>
                    <span style={{ color:'#f8c8ff', fontWeight:900, letterSpacing:3 }}>{codigoCompartir}</span>
                    {esCreador && <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.7rem' }}>· Los espectadores ven con ~2s de retardo</span>}
                </div>
            )}

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={1000}
                height={500}
                onMouseDown={iniciarDibujo}
                onMouseMove={moverDibujo}
                onMouseUp={terminarDibujo}
                onMouseLeave={terminarDibujo}
                onDoubleClick={() => { if (herramienta === 'pan') { panRef.current = { x:0, y:0 }; triggerRedraw(); } }}
                onTouchStart={e => { e.preventDefault(); iniciarDibujo(e); }}
                onTouchMove={e => { e.preventDefault(); moverDibujo(e); }}
                onTouchEnd={terminarDibujo}
                style={{ display:'block', width:'100%', height:'auto', cursor: CURSOR_MAP[herramienta] || 'crosshair', touchAction:'none' }}
            />

            {/* ── Page tabs ─────────────────────────────────────────────── */}
            <div style={{ background:'#dde3ea', borderTop:'2px solid #bdc3c7', padding:'5px 10px', display:'flex', gap:5, alignItems:'center', overflowX:'auto', flexShrink:0, position:'sticky', bottom:0, zIndex:5 }}>
                {paginas.map((_, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
                        <button onClick={() => cambiarPagina(i)}
                            style={{ padding:'3px 12px', borderRadius:7, border:'none', fontWeight:'bold', cursor:'pointer', fontSize:'0.83rem',
                                background: i===paginaIdx ? '#3498db' : '#f0f0f0', color: i===paginaIdx ? 'white' : '#555' }}>
                            Hoja {i+1}
                        </button>
                        {paginas.length > 1 && (
                            <button onClick={() => eliminarPagina(i)}
                                style={{ padding:'1px 5px', borderRadius:5, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontSize:'0.7rem' }}>
                                ×
                            </button>
                        )}
                    </div>
                ))}
                <button onClick={agregarPagina} title="Añadir hoja"
                    style={{ padding:'3px 10px', borderRadius:7, border:'2px dashed #3498db', background:'transparent', color:'#3498db', cursor:'pointer', fontWeight:'bold', fontSize:'1rem', flexShrink:0 }}>
                    +
                </button>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARE MODAL (mismo patrón que LandingGames3)
// ══════════════════════════════════════════════════════════════════════════════
function ShareModalHerramienta({ url, titulo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = () => {
        navigator.clipboard.writeText(url).catch(() => {});
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };
    const texto = encodeURIComponent(`🏫 ${titulo}\n${url}`);
    const opciones = [
        { label: 'Copiar enlace',    icon: copiado ? '✅' : '🔗', color: '#2c3e50', bg: copiado ? '#e8f5e9' : '#f4f6f8', action: copiar },
        { label: 'WhatsApp',         icon: '💬', color: '#25D366', bg: '#e8f8ee', action: () => window.open(`https://wa.me/?text=${texto}`, '_blank') },
        { label: 'Telegram',         icon: '✈️', color: '#0088cc', bg: '#e8f4fb', action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titulo)}`, '_blank') },
        { label: 'Correo',           icon: '📧', color: '#e74c3c', bg: '#fdecea', action: () => window.open(`mailto:?subject=${encodeURIComponent(titulo)}&body=${texto}`, '_blank') },
        { label: 'Google Classroom', icon: '🎓', color: '#1565C0', bg: '#e3f2fd', action: () => window.open(`https://classroom.google.com/share?url=${encodeURIComponent(url)}`, '_blank') },
    ];
    return (
        <div style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:360, padding:24, boxShadow:'0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.05rem' }}>Compartir</h3>
                    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#95a5a6', fontSize:'1.2rem', padding:4 }}>✕</button>
                </div>
                <div style={{ background:'#f4f6f8', borderRadius:10, padding:'8px 12px', fontSize:'0.75rem', color:'#7f8c8d', wordBreak:'break-all', marginBottom:16 }}>{url}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {opciones.map(op => (
                        <button key={op.label} onClick={op.action}
                            style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:12, border:`1.5px solid ${op.color}22`, background:op.bg, cursor:'pointer', textAlign:'left', fontSize:'0.93rem', fontWeight:600, color:op.color }}>
                            <span style={{ fontSize:'1.2rem', width:24, textAlign:'center' }}>{op.icon}</span>
                            {op.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// GRUPOS LIBRE — subgrupos aleatorios sin registro
// ══════════════════════════════════════════════════════════════════════════════
const COLORES_GRUPOS_LIB = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#c0392b','#16a085','#8e44ad'];

function GruposLibre() {
    const [alumnosTxt, setAlumnosTxt] = useState("Ana, Luis, Carlos, Marta, Sofía, Diego, Elena, Pablo");
    const [numGrupos, setNumGrupos] = useState(3);
    // grupos: Array<{ nombre: string, alumnos: string[] }>
    const [grupos, setGrupos] = useState([]);

    const alumnos = alumnosTxt.split(/[\n,]+/).map(a => a.trim()).filter(Boolean);

    const generar = () => {
        const n = Math.min(Math.max(1, numGrupos), alumnos.length);
        if (n === 0) return;
        const shuffled = [...alumnos].sort(() => Math.random() - 0.5);
        const result = Array.from({ length: n }, (_, i) => ({
            nombre: grupos[i]?.nombre || `Grupo ${i + 1}`,
            alumnos: [],
        }));
        shuffled.forEach((a, i) => result[i % n].alumnos.push(a));
        setGrupos(result);
    };

    const setNombre = (i, nombre) =>
        setGrupos(prev => prev.map((g, j) => j === i ? { ...g, nombre } : g));

    const imprimir = () => {
        const cols = COLORES_GRUPOS_LIB;
        const cards = grupos.map((g, i) => {
            const col = cols[i % cols.length];
            const items = g.alumnos.map(a =>
                `<div style="padding:5px 10px;border-radius:6px;background:white;font-size:0.85rem;font-weight:600;color:#2c3e50;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:4px">${a}</div>`
            ).join('');
            return `<div style="background:${col}18;border:2px solid ${col}55;border-radius:12px;padding:14px;break-inside:avoid;page-break-inside:avoid">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <span style="font-weight:800;color:${col};font-size:1rem">${g.nombre}</span>
    <span style="background:${col};color:white;border-radius:12px;padding:2px 9px;font-size:0.72rem;font-weight:700">${g.alumnos.length}</span>
  </div>
  ${items}
</div>`;
        }).join('');

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Grupos de Clase</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:20px;}
h1{font-size:1.2rem;color:#2c3e50;margin-bottom:14px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;}
.btn{display:block;margin:0 auto 16px;padding:8px 24px;background:#9b59b6;color:white;border:none;border-radius:6px;font-size:0.9rem;font-weight:700;cursor:pointer;}
@media print{.btn{display:none;}}</style></head>
<body><button class="btn" onclick="window.print()">🖨 Imprimir</button>
<h1>Grupos de Clase</h1>
<div class="grid">${cards}</div></body></html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
    };

    return (
        <div style={{ boxSizing:'border-box' }}>
            {/* Cabecera de configuración */}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:20, alignItems:'stretch' }}>
                {/* Textarea alumnos */}
                <div style={{ flex:'1 1 220px', minWidth:0, boxSizing:'border-box' }}>
                    <label style={{ display:'block', fontWeight:700, color:'#2c3e50', fontSize:'0.85rem', marginBottom:6 }}>
                        Alumnos <span style={{ fontWeight:400, color:'#95a5a6' }}>(separados por coma)</span>
                    </label>
                    <textarea value={alumnosTxt} onChange={e => setAlumnosTxt(e.target.value)} rows={5}
                        style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #e0e4f0', fontSize:'0.88rem', fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box', display:'block' }}/>
                    <div style={{ fontSize:'0.75rem', color:'#95a5a6', marginTop:4 }}>{alumnos.length} alumno{alumnos.length !== 1 ? 's' : ''}</div>
                </div>

                {/* Panel de control */}
                <div style={{ flex:'1 1 180px', minWidth:180, boxSizing:'border-box', background:'#f8f9fc', border:'1.5px solid #e0e4f0', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                    <div>
                        <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.85rem', marginBottom:10 }}>Número de grupos</div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center' }}>
                            <button onClick={() => setNumGrupos(n => Math.max(1, n-1))}
                                style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'1.2rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
                            <span style={{ fontSize:'1.6rem', fontWeight:800, color:'#9b59b6', minWidth:32, textAlign:'center' }}>{numGrupos}</span>
                            <button onClick={() => setNumGrupos(n => Math.min(alumnos.length || 1, n+1))}
                                style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'1.2rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
                        </div>
                    </div>
                    <button onClick={generar} disabled={alumnos.length === 0}
                        style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:alumnos.length===0?'#ddd':'#9b59b6', color:'white', fontWeight:700, fontSize:'0.92rem', cursor:alumnos.length===0?'default':'pointer', boxSizing:'border-box' }}>
                        ✨ Generar grupos
                    </button>
                    {grupos.length > 0 && (<>
                        <button onClick={generar}
                            style={{ width:'100%', padding:'9px', borderRadius:10, border:'1.5px solid #9b59b6', background:'white', color:'#9b59b6', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', boxSizing:'border-box' }}>
                            🔀 Reorganizar
                        </button>
                        <button onClick={imprimir}
                            style={{ width:'100%', padding:'9px', borderRadius:10, border:'1.5px solid #7f8c8d', background:'white', color:'#555', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', boxSizing:'border-box' }}>
                            🖨 Imprimir
                        </button>
                    </>)}
                </div>
            </div>

            {/* Resultado */}
            {grupos.length > 0 ? (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(180px, 100%), 1fr))', gap:12 }}>
                    {grupos.map((grupo, i) => {
                        const col = COLORES_GRUPOS_LIB[i % COLORES_GRUPOS_LIB.length];
                        return (
                            <div key={i} style={{ background:col+'18', border:`2px solid ${col}44`, borderRadius:14, padding:14, boxSizing:'border-box' }}>
                                {/* Nombre editable */}
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:6 }}>
                                    <input
                                        value={grupo.nombre}
                                        onChange={e => setNombre(i, e.target.value)}
                                        style={{ flex:1, minWidth:0, fontWeight:800, color:col, fontSize:'0.92rem', border:'none', background:'transparent', outline:'none', fontFamily:'inherit', padding:0, cursor:'text' }}/>
                                    <span style={{ background:col, color:'white', borderRadius:12, padding:'2px 8px', fontSize:'0.72rem', fontWeight:700, flexShrink:0 }}>{grupo.alumnos.length}</span>
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                    {grupo.alumnos.map((alumno, j) => (
                                        <div key={j} style={{ padding:'6px 10px', borderRadius:8, background:'white', fontSize:'0.84rem', fontWeight:600, color:'#2c3e50', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', wordBreak:'break-word' }}>
                                            {alumno}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ textAlign:'center', padding:'40px 20px', color:'#95a5a6', background:'#f8f9fc', borderRadius:14, border:'1.5px dashed #e0e4f0' }}>
                    <div style={{ fontSize:'3rem', marginBottom:10 }}>👥</div>
                    <div style={{ fontWeight:600, marginBottom:4 }}>Añade alumnos y pulsa "Generar grupos"</div>
                    <div style={{ fontSize:'0.8rem' }}>Puedes pegar una lista separada por comas</div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANO AULA LIBRE — plano de clase sin registro
// ══════════════════════════════════════════════════════════════════════════════
const PLANO_rndId = () => Math.random().toString(36).slice(2, 10);
const PLANO_W = 760, PLANO_H = 520, PLANO_SW = 74, PLANO_SG = 3, PLANO_PAD = 8;
const plano_deskW = n => n * PLANO_SW + (n - 1) * PLANO_SG + PLANO_PAD;

function defaultLayoutLibre() {
    const m = [];
    m.push({ id:PLANO_rndId(), tipo:'profesor', x:Math.round((PLANO_W-180)/2), y:10, asientos:[{ id:PLANO_rndId(), alumno:null }] });
    const xs = [30, 300, 570], ys = [110, 210, 310, 410];
    ys.forEach(y => xs.forEach(x =>
        m.push({ id:PLANO_rndId(), tipo:'alumno', x, y, asientos:[{ id:PLANO_rndId(), alumno:null },{ id:PLANO_rndId(), alumno:null }] })
    ));
    return m;
}

function htmlPlanoLibre(nombre, mesas) {
    const sc = 0.88, W = Math.round(PLANO_W*sc), H = Math.round(PLANO_H*sc);
    const asig = mesas.flatMap(m => m.asientos).filter(s => s.alumno).length;
    const desks = mesas.map(m => {
        const isP = m.tipo === 'profesor';
        const w = Math.round((isP ? 180 : plano_deskW(m.asientos.length)) * sc);
        const seats = m.asientos.map(s =>
            `<div style="flex:1;border:1px solid ${isP?'#e67e22':'#1565C0'};border-radius:4px;padding:3px;font-size:0.67rem;font-weight:600;min-height:34px;display:flex;align-items:center;justify-content:center;text-align:center;background:${s.alumno?'#e8f5e9':'#f8f9fa'};color:${s.alumno?'#2c3e50':'#bbb'}">${s.alumno||'vacío'}</div>`
        ).join('');
        return `<div style="position:absolute;left:${Math.round(m.x*sc)}px;top:${Math.round(m.y*sc)}px;width:${w}px;border:2px solid ${isP?'#e67e22':'#1565C0'};border-radius:8px;overflow:hidden"><div style="background:${isP?'#e67e22':'#1565C0'};color:white;font-size:0.58rem;font-weight:700;padding:2px 6px">${isP?'👨‍🏫 PROFESOR':''}</div><div style="display:flex;gap:3px;padding:3px">${seats}</div></div>`;
    }).join('');
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${nombre}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:20px;}
h1{font-size:1.3rem;color:#1565C0;margin-bottom:3px;}p{font-size:0.78rem;color:#7f8c8d;margin-bottom:14px;}
.btn{display:block;margin:0 auto 14px;padding:8px 24px;background:#1565C0;color:white;border:none;border-radius:6px;font-size:0.9rem;font-weight:700;cursor:pointer;}
@media print{.btn{display:none;}}</style></head><body>
<button class="btn" onclick="window.print()">🖨 Imprimir</button>
<h1>${nombre}</h1><p>${asig} alumnos asignados</p>
<div style="position:relative;width:${W}px;height:${H}px;border:2px solid #e0e4f0;border-radius:10px;background:#f8faff;overflow:hidden">
<div style="text-align:center;position:absolute;top:3px;left:0;right:0;font-size:0.6rem;color:#bdc3c7;font-weight:700">▲ PIZARRA / FRENTE</div>
${desks}</div></body></html>`;
}

function DeskCardLibre({ mesa, selSeat, selUnassign, onStartDrag, onClickSeat, onDelete, onAddSeat, onRemoveSeat }) {
    const isP = mesa.tipo === 'profesor';
    const col = isP ? '#e67e22' : '#1565C0';
    const n = mesa.asientos.length;
    const w = isP ? 180 : plano_deskW(n);
    return (
        <div style={{ position:'absolute', left:mesa.x, top:mesa.y, width:w, borderRadius:10, border:`2px solid ${col}`, background:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.10)', overflow:'hidden', userSelect:'none', zIndex:1 }}>
            <div onMouseDown={e => { e.preventDefault(); onStartDrag(e, mesa.id); }}
                style={{ background:col, height:22, cursor:'grab', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 5px', gap:3 }}>
                <span style={{ color:'white', fontSize:'0.6rem', fontWeight:700, flexShrink:0 }}>{isP ? '👨‍🏫' : '⠿'}</span>
                {!isP && (
                    <div style={{ display:'flex', alignItems:'center', gap:3 }} onClick={e => e.stopPropagation()}>
                        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemoveSeat(mesa.id); }} disabled={n<=1}
                            style={{ background:'rgba(0,0,0,0.25)', border:'none', color:'white', borderRadius:3, width:16, height:16, cursor:n>1?'pointer':'default', fontSize:'0.75rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', opacity:n<=1?0.4:1, padding:0 }}>−</button>
                        <span style={{ color:'white', fontSize:'0.6rem', fontWeight:700, minWidth:10, textAlign:'center' }}>{n}</span>
                        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onAddSeat(mesa.id); }}
                            style={{ background:'rgba(0,0,0,0.25)', border:'none', color:'white', borderRadius:3, width:16, height:16, cursor:'pointer', fontSize:'0.75rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>+</button>
                    </div>
                )}
                <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(mesa.id); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.8)', padding:'1px 2px', display:'flex', alignItems:'center', flexShrink:0 }}>
                    <X size={isP ? 0 : 10}/>
                </button>
            </div>
            <div style={{ display:'flex', gap:PLANO_SG, padding:`4px ${PLANO_PAD/2}px` }}>
                {mesa.asientos.map((s, idx) => {
                    const isSel = selSeat?.deskId === mesa.id && selSeat?.seatIdx === idx;
                    const isTarget = !isSel && selUnassign !== null && !s.alumno;
                    const bg = isSel ? '#fdecea' : isTarget ? '#e8f0fe' : s.alumno ? '#e8f5e9' : '#f8faff';
                    const border = isSel ? '2px solid #e74c3c' : isTarget ? '2px dashed #1565C0' : s.alumno ? '1.5px solid #a5d6a7' : '1.5px solid #e0e4f0';
                    return (
                        <div key={s.id} onClick={() => onClickSeat(mesa.id, idx)}
                            style={{ width:PLANO_SW, minHeight:42, borderRadius:6, border, background:bg, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:'2px 3px', textAlign:'center', fontSize:'0.65rem', fontWeight:600, color:'#2c3e50', wordBreak:'break-word', lineHeight:1.2, transition:'all 0.1s' }}>
                            {s.alumno || <span style={{ color:'#ccc', fontWeight:400 }}>vacío</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PlanoAulaLibre() {
    const [alumnosTxt, setAlumnosTxt] = useState("Ana, Luis, Carlos, Marta, Sofía, Diego, Elena, Pablo");
    const [editandoAlumnos, setEditandoAlumnos] = useState(true);
    const [mesas, setMesas] = useState(defaultLayoutLibre);
    const [selSeat, setSelSeat] = useState(null);
    const [selUnassign, setSelUnassign] = useState(null);
    const [dragging, setDragging] = useState(null);

    const alumnos = alumnosTxt.split(/[\n,]+/).map(a => a.trim()).filter(Boolean);
    const asignados = new Set(mesas.flatMap(m => m.asientos.map(s => s.alumno)).filter(Boolean));
    const noAsignados = alumnos.filter(n => !asignados.has(n));
    const totalAsientos = mesas.filter(m => m.tipo === 'alumno').reduce((s, m) => s + m.asientos.length, 0);
    const selAlumno = selSeat ? mesas.find(m => m.id === selSeat.deskId)?.asientos[selSeat.seatIdx]?.alumno : null;

    useEffect(() => {
        if (!dragging) return;
        const onMove = e => {
            const dx = e.clientX - dragging.startMX, dy = e.clientY - dragging.startMY;
            setMesas(prev => prev.map(m => {
                if (m.id !== dragging.id) return m;
                const w = m.tipo === 'profesor' ? 180 : plano_deskW(m.asientos.length);
                return { ...m, x:Math.max(0, Math.min(PLANO_W-w, dragging.startDX+dx)), y:Math.max(0, Math.min(PLANO_H-74, dragging.startDY+dy)) };
            }));
        };
        const onUp = () => setDragging(null);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [dragging]);

    const startDrag = (e, deskId) => {
        const d = mesas.find(m => m.id === deskId);
        setDragging({ id:deskId, startMX:e.clientX, startMY:e.clientY, startDX:d.x, startDY:d.y });
    };

    const addSeat = id => setMesas(prev => prev.map(m => m.id!==id ? m : { ...m, asientos:[...m.asientos, { id:PLANO_rndId(), alumno:null }] }));
    const removeSeat = id => setMesas(prev => prev.map(m => {
        if (m.id!==id || m.asientos.length<=1) return m;
        if (selSeat?.deskId===id && selSeat?.seatIdx===m.asientos.length-1) setSelSeat(null);
        return { ...m, asientos:m.asientos.slice(0,-1) };
    }));

    const onClickSeat = (deskId, seatIdx) => {
        if (dragging) return;
        if (selUnassign !== null) {
            setMesas(prev => prev.map(m => m.id!==deskId ? m : { ...m, asientos:m.asientos.map((s,i) => i===seatIdx ? {...s,alumno:selUnassign} : s) }));
            setSelUnassign(null);
        } else if (selSeat) {
            if (selSeat.deskId===deskId && selSeat.seatIdx===seatIdx) { setSelSeat(null); }
            else {
                setMesas(prev => {
                    const next = prev.map(m => ({ ...m, asientos:m.asientos.map(s=>({...s})) }));
                    const d1 = next.find(m => m.id===selSeat.deskId), d2 = next.find(m => m.id===deskId);
                    if (!d1||!d2) return next;
                    const a1 = d1.asientos[selSeat.seatIdx].alumno;
                    d1.asientos[selSeat.seatIdx].alumno = d2.asientos[seatIdx].alumno;
                    d2.asientos[seatIdx].alumno = a1;
                    return next;
                });
                setSelSeat(null);
            }
        } else { setSelSeat({ deskId, seatIdx }); }
    };

    const onClickUnassigned = n => { setSelSeat(null); setSelUnassign(prev => prev===n ? null : n); };

    const rellenar = () => {
        const todos = [...alumnos].sort(() => Math.random() - 0.5);
        const alumnoMesas = [...mesas].filter(m => m.tipo==='alumno').sort((a,b) => a.y!==b.y ? a.y-b.y : a.x-b.x);
        const newMesas = mesas.map(m => ({ ...m, asientos:m.asientos.map(s=>({...s,alumno:null})) }));
        let idx = 0;
        alumnoMesas.forEach(sm => {
            const mesa = newMesas.find(m => m.id===sm.id);
            if (mesa) mesa.asientos.forEach(s => { if (idx<todos.length) s.alumno=todos[idx++]; });
        });
        setMesas(newMesas); setSelSeat(null); setSelUnassign(null);
    };

    const añadirMesa = () => setMesas(prev => [...prev, { id:PLANO_rndId(), tipo:'alumno', x:40, y:50, asientos:[{ id:PLANO_rndId(), alumno:null },{ id:PLANO_rndId(), alumno:null }] }]);
    const eliminarMesa = id => { setMesas(prev => prev.filter(m => m.id!==id)); setSelSeat(null); };
    const vaciarAsiento = () => {
        if (!selSeat) return;
        setMesas(prev => prev.map(m => m.id!==selSeat.deskId ? m : { ...m, asientos:m.asientos.map((s,i) => i===selSeat.seatIdx ? {...s,alumno:null} : s) }));
        setSelSeat(null);
    };

    const imprimir = () => {
        const w = window.open('', '_blank');
        w.document.write(htmlPlanoLibre('Plano de Clase', mesas));
        w.document.close();
    };

    if (editandoAlumnos) {
        return (
            <div style={{ maxWidth:480, margin:'0 auto', textAlign:'center', padding:'0 4px', boxSizing:'border-box' }}>
                <div style={{ fontSize:'3rem', marginBottom:8 }}>🪑</div>
                <h2 style={{ color:'#2c3e50', marginBottom:16 }}>Plano de Clase</h2>
                <label style={{ display:'block', fontWeight:700, color:'#2c3e50', fontSize:'0.85rem', marginBottom:8, textAlign:'left' }}>
                    Alumnos <span style={{ fontWeight:400, color:'#95a5a6' }}>(separados por coma o salto de línea)</span>
                </label>
                <textarea value={alumnosTxt} onChange={e => setAlumnosTxt(e.target.value)} rows={6}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #e0e4f0', fontSize:'0.88rem', fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box', marginBottom:8, display:'block' }}/>
                <div style={{ fontSize:'0.75rem', color:'#95a5a6', marginBottom:16, textAlign:'left' }}>{alumnos.length} alumno{alumnos.length!==1?'s':''}</div>
                <button onClick={() => setEditandoAlumnos(false)}
                    style={{ padding:'11px 28px', borderRadius:12, border:'none', background:'#1565C0', color:'white', fontWeight:700, fontSize:'0.95rem', cursor:'pointer' }}>
                    ✏️ Abrir plano
                </button>
            </div>
        );
    }

    return (
        <div style={{ boxSizing:'border-box' }}>
            {/* Toolbar — dos grupos: izquierda (acciones) + derecha (imprimir + contador) */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                    <button onClick={() => setEditandoAlumnos(true)}
                        style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'0.82rem', color:'#555', whiteSpace:'nowrap' }}>
                        ← Alumnos
                    </button>
                    <button onClick={rellenar} disabled={alumnos.length===0}
                        style={{ padding:'7px 14px', borderRadius:8, border:'none', fontWeight:700, fontSize:'0.83rem', cursor:alumnos.length===0?'default':'pointer', background:alumnos.length===0?'#e0e4f0':'#27ae60', color:alumnos.length===0?'#aaa':'white', whiteSpace:'nowrap' }}>
                        ✨ Rellenar
                    </button>
                    <button onClick={añadirMesa}
                        style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'0.82rem', color:'#555', whiteSpace:'nowrap' }}>
                        + Mesa
                    </button>
                    {selSeat && selAlumno && (
                        <button onClick={vaciarAsiento}
                            style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 11px', borderRadius:8, border:'1px solid #e74c3c', background:'#fdecea', color:'#e74c3c', cursor:'pointer', fontSize:'0.82rem', whiteSpace:'nowrap' }}>
                            <X size={12}/> Vaciar
                        </button>
                    )}
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
                    <button onClick={imprimir}
                        style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'0.82rem', color:'#555', whiteSpace:'nowrap' }}>
                        🖨 Imprimir
                    </button>
                    <span style={{ fontSize:'0.74rem', color:'#7f8c8d', fontWeight:600, whiteSpace:'nowrap' }}>
                        {asignados.size}/{totalAsientos} · {noAsignados.length} sin asignar
                    </span>
                </div>
            </div>

            {/* Canvas + Sidebar — side-by-side en escritorio, apilado en móvil */}
            <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                {/* Canvas — scroll horizontal en pantallas estrechas */}
                <div style={{ flex:'1 1 500px', minWidth:0, overflowX:'auto' }}>
                    <div style={{ position:'relative', width:PLANO_W, height:PLANO_H, background:'linear-gradient(180deg,#f0f4ff 0%,#f8faff 100%)', border:'2px solid #e0e4f0', borderRadius:14, cursor:dragging?'grabbing':'default' }}>
                        <div style={{ position:'absolute', top:3, left:0, right:0, textAlign:'center', fontSize:'0.62rem', color:'#bdc3c7', fontWeight:700, pointerEvents:'none' }}>▲ PIZARRA / FRENTE DE CLASE</div>
                        {mesas.map(m => (
                            <DeskCardLibre key={m.id} mesa={m} selSeat={selSeat} selUnassign={selUnassign}
                                onStartDrag={startDrag} onClickSeat={onClickSeat}
                                onDelete={eliminarMesa} onAddSeat={addSeat} onRemoveSeat={removeSeat}/>
                        ))}
                    </div>
                </div>

                {/* Sidebar alumnos sin asignar */}
                <div style={{ flex:'1 1 160px', minWidth:160, maxWidth:260 }}>
                    <div style={{ background:'#f8f9fc', border:'1.5px solid #e0e4f0', borderRadius:12, padding:14 }}>
                        <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.85rem', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                            Sin asignar
                            <span style={{ background:'#e8f0fe', color:'#1565C0', borderRadius:20, padding:'2px 8px', fontSize:'0.72rem', fontWeight:700 }}>{noAsignados.length}</span>
                        </div>
                        {noAsignados.length===0 ? (
                            <p style={{ color:'#95a5a6', fontSize:'0.8rem', margin:0 }}>
                                {alumnos.length===0 ? 'Sin alumnos' : '✓ Todos asignados'}
                            </p>
                        ) : (
                            <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:280, overflowY:'auto' }}>
                                {noAsignados.map(n => (
                                    <div key={n} onClick={() => onClickUnassigned(n)} style={{ padding:'6px 10px', borderRadius:8, cursor:'pointer', background:selUnassign===n?'#1565C0':'#e8f0fe', color:selUnassign===n?'white':'#1565C0', fontSize:'0.8rem', fontWeight:600, transition:'all 0.1s', border:'1.5px solid '+(selUnassign===n?'#1565C0':'transparent'), wordBreak:'break-word' }}>
                                        {n}
                                    </div>
                                ))}
                            </div>
                        )}
                        {(selSeat || selUnassign) && (
                            <div style={{ marginTop:12, padding:'8px 10px', background:'#fff8e1', borderRadius:8, fontSize:'0.74rem', color:'#856404', lineHeight:1.4 }}>
                                {selUnassign
                                    ? `Toca un asiento para colocar a "${selUnassign}"`
                                    : `"${selAlumno||'vacío'}" — toca otro asiento para intercambiar`}
                            </div>
                        )}
                        <div style={{ marginTop:12, fontSize:'0.7rem', color:'#bdc3c7', lineHeight:1.4 }}>
                            Arrastra la barra de cada mesa para moverla · usa − / + para cambiar asientos
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: MENÚ
// ══════════════════════════════════════════════════════════════════════════════
export default function HerramientasClase({ onExit, initialTool }) {
    const [activa, setActiva] = useState(() => {
        if (initialTool) return initialTool;
        const params = new URLSearchParams(window.location.search);
        if (params.get('pizarra')) return 'pizarra';
        const g = params.get('gestion');
        if (g === 'ruleta' || g === 'pizarra' || g === 'reloj' || g === 'grupos' || g === 'plano') return g;
        return null;
    });
    const [shareModal, setShareModal] = useState(null); // { url, titulo }

    const shareBase = `${window.location.origin}${window.location.pathname}`;

    const HERRAMIENTAS = [
        { id: 'ruleta',   icon: <RotateCcw size={40}/>,   titulo: 'Ruleta de Aula',     desc: 'Selecciona alumnos al azar desde una lista.',              color: '#e67e22' },
        { id: 'pizarra',  icon: <PenTool size={40}/>,     titulo: 'Pizarra Temática',   desc: 'Ciencias, Música, Geografía...',                          color: '#3498db' },
        { id: 'reloj',    icon: <Clock size={40}/>,        titulo: 'Gestor de Tiempo',   desc: 'Cronómetro y Temporizador de cuenta atrás.',               color: '#2ecc71' },
        { id: 'grupos',   icon: <Users size={40}/>,        titulo: 'Grupos de Clase',    desc: 'Crea subgrupos aleatorios a partir de una lista de alumnos.', color: '#9b59b6' },
        { id: 'plano',    icon: <LayoutGrid size={40}/>,   titulo: 'Plano de Clase',     desc: 'Organiza los asientos de tu aula con un plano visual.',    color: '#1565C0' },
        { id: 'miniapp',  icon: <span style={{fontSize:36}}>⚡</span>, titulo: 'App con IA', desc: 'Genera una mini-aplicación interactiva con Claude o Gemini y previsualízala al instante.', color: '#7c3aed' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#fce4ec', padding: 'clamp(10px, 3vw, 20px)', boxSizing: 'border-box', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, maxWidth: 1200, margin: '0 auto', marginBottom: 'clamp(14px, 3vw, 30px)' }}>
                <button onClick={() => {
                    if (activa === 'pizarra') {
                        if (!window.confirm('¿Volver al menú? Se perderá todo el contenido de la pizarra.')) return;
                    }
                    activa ? setActiva(null) : onExit();
                }} style={{ padding: '7px 14px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: 'clamp(0.8rem, 2.5vw, 1rem)', flexShrink: 0 }}>
                    <ArrowLeft size={15} /> {activa ? 'Volver' : 'Salir'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: 'clamp(0.95rem, 3vw, 1.2rem)' }}>
                        {activa ? HERRAMIENTAS.find(h => h.id === activa).titulo : 'Herramientas de Clase'}
                    </div>
                    {/* Botón compartir — menú principal o herramienta activa */}
                    <button
                        onClick={() => {
                            const url = activa
                                ? `${shareBase}?gestion=${activa}`
                                : `${shareBase}?gestion=menu`;
                            const titulo = activa
                                ? HERRAMIENTAS.find(h => h.id === activa).titulo
                                : 'Herramientas de Clase';
                            setShareModal({ url, titulo });
                        }}
                        title="Compartir"
                        style={{ background: 'white', border: '1px solid #ccc', borderRadius: 20, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#e67e22', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        <Share2 size={14}/> Compartir
                    </button>
                </div>
            </div>

            {!activa ? (
                <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
                    <Settings size={44} color="#9b59b6" style={{ marginBottom: 8 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: 'clamp(1.4rem, 5vw, 2.5rem)', margin: '0 0 clamp(16px, 4vw, 30px)' }}>Herramientas de Clase</h1>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 'clamp(12px, 3vw, 20px)' }}>
                        {HERRAMIENTAS.map(h => (
                            <div key={h.id} style={{ position: 'relative' }}>
                                {/* Botón compartir individual por herramienta */}
                                <button
                                    onClick={e => { e.stopPropagation(); setShareModal({ url: `${shareBase}?gestion=${h.id}`, titulo: h.titulo }); }}
                                    title={`Compartir ${h.titulo}`}
                                    style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: h.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                    <Share2 size={14}/>
                                </button>
                                <button onClick={() => setActiva(h.id)}
                                    style={{ background: 'white', border: `2px solid ${h.color}`, borderRadius: 16, padding: 'clamp(16px, 4vw, 30px)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', width: '100%', boxSizing: 'border-box' }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                    <div style={{ background: `${h.color}22`, padding: 'clamp(12px, 3vw, 20px)', borderRadius: '50%', color: h.color, marginBottom: 12 }}>{h.icon}</div>
                                    <h2 style={{ color: '#2c3e50', margin: '0 0 8px', fontSize: 'clamp(1rem, 3.5vw, 1.5rem)' }}>{h.titulo}</h2>
                                    <p style={{ color: '#7f8c8d', fontSize: 'clamp(0.82rem, 2.5vw, 0.95rem)', margin: 0, lineHeight: 1.5 }}>{h.desc}</p>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ background: 'white', maxWidth: 1200, margin: '0 auto', padding: 'clamp(10px, 3vw, 30px)', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', boxSizing: 'border-box' }}>
                    {activa === 'ruleta'   && <RuletaApp />}
                    {activa === 'reloj'    && <RelojApp />}
                    {activa === 'pizarra'  && <PizarraApp />}
                    {activa === 'grupos'   && <GruposLibre />}
                    {activa === 'plano'    && <PlanoAulaLibre />}
                    {activa === 'miniapp'  && <MiniAppCreator onAbrirViewer={(id) => window.open(`/?miniapp=${id}`, '_blank')} />}
                </div>
            )}

            {shareModal && (
                <ShareModalHerramienta url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />
            )}
        </div>
    );
}