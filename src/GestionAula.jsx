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
    const [selIdxs,   setSelIdxs]   = useState([]);
    const [lassoRect, setLassoRect] = useState(null);
    const selHandleRef = useRef(null); // { type:'resize'|'rotate', ... }

    // Text tool
    const [textoInput,       setTextoInput]       = useState('');
    const [textoFontSize,    setTextoFontSize]    = useState(24);
    const [emojiPanelOpen,   setEmojiPanelOpen]   = useState(false);
    const [escuchando,       setEscuchando]       = useState(false);
    const recognitionRef = useRef(null);

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
                const id = Date.now();
                const maxW = 400, maxH = 300;
                let w = img.width, h = img.height;
                if (w > maxW) { h = h * maxW / w; w = maxW; }
                if (h > maxH) { w = w * maxH / h; h = maxH; }
                imageCacheRef.current[id] = img;
                setElementos(prev => [...prev, { t: 'image', id, src: ev.target.result, x: 80 - panRef.current.x, y: 60 - panRef.current.y, w, h }]);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
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
        if (elem.t === 'image') {
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
        if (elem.t === 'image') return { ...elem, x: mX(elem.x), y: mY(elem.y), w: elem.w * scaleX, h: elem.h * scaleY };
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
        if (item.t === 'image') return { x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y + item.h };
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
            if (item.t === 'image') return { ...item, x: item.x + dx, y: item.y + dy };
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
        } else if (item.t === 'staff') {
            drawStaff(ctx, item);
        } else if (item.t === 'note') {
            drawNote(ctx, item);
        } else if (item.t === 'rest') {
            drawRest(ctx, item);
        } else if (item.t === 'acc') {
            drawAccidental(ctx, item);
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

        // ── Handles de redimensión y rotación sobre la selección ─────────────
        if (selIdxs.length > 0 && herramienta === 'lasso' && !lassoRect) {
            const bbs = selIdxs.map(i => getBbox(elementos[i]));
            const bx1 = Math.min(...bbs.map(b => b.x1)) - 6;
            const by1 = Math.min(...bbs.map(b => b.y1)) - 6;
            const bx2 = Math.max(...bbs.map(b => b.x2)) + 6;
            const by2 = Math.max(...bbs.map(b => b.y2)) + 6;
            const mx = (bx1+bx2)/2, my = (by1+by2)/2;
            // Rect exterior
            ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 1.5; ctx.setLineDash([4,2]);
            ctx.strokeRect(bx1, by1, bx2-bx1, by2-by1); ctx.setLineDash([]);
            // 8 handles de resize
            [[bx1,by1],[mx,by1],[bx2,by1],[bx1,my],[bx2,my],[bx1,by2],[mx,by2],[bx2,by2]].forEach(([hx,hy]) => {
                ctx.fillStyle='white'; ctx.strokeStyle='#2980b9'; ctx.lineWidth=1.5;
                ctx.fillRect(hx-5,hy-5,10,10); ctx.strokeRect(hx-5,hy-5,10,10);
            });
            // Handle de rotación
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
        else if (['triangle', 'pentagon', 'hexagon'].includes(t)) {
            const lados = t === 'triangle' ? 3 : t === 'pentagon' ? 5 : 6;
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
            if (selIdxs.length > 0) {
                const bbs = selIdxs.map(i => getBbox(elementos[i]));
                const bx1 = Math.min(...bbs.map(b => b.x1)) - 6;
                const by1 = Math.min(...bbs.map(b => b.y1)) - 6;
                const bx2 = Math.max(...bbs.map(b => b.x2)) + 6;
                const by2 = Math.max(...bbs.map(b => b.y2)) + 6;
                const mx = (bx1+bx2)/2, my = (by1+by2)/2;
                const cbx = mx, cby = (by1+by2)/2;

                // Rotate handle?
                if (Math.abs(x - mx) < 11 && Math.abs(y - (by1-22)) < 11) {
                    selHandleRef.current = {
                        type: 'rotate', cx: cbx, cy: cby,
                        startAngle: Math.atan2(y - cby, x - cbx),
                        origElemsData: selIdxs.map(i => JSON.parse(JSON.stringify(elementos[i]))),
                    };
                    return;
                }
                // Resize handles?
                const resizeHandles = [
                    {id:'tl',x:bx1,y:by1},{id:'tc',x:mx,y:by1},{id:'tr',x:bx2,y:by1},
                    {id:'ml',x:bx1,y:my},{id:'mr',x:bx2,y:my},
                    {id:'bl',x:bx1,y:by2},{id:'bc',x:mx,y:by2},{id:'br',x:bx2,y:by2},
                ];
                for (const h of resizeHandles) {
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
                // Click inside → move
                const inside = selIdxs.some(i => {
                    const bb = getBbox(elementos[i]);
                    return x >= bb.x1 - 6 && x <= bb.x2 + 6 && y >= bb.y1 - 6 && y <= bb.y2 + 6;
                });
                if (inside) { selMoveRef.current = { x, y }; return; }
            }
            setSelIdxs([]);
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
                    const si = selIdxs.indexOf(i);
                    if (si < 0) return item;
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
                    const si = selIdxs.indexOf(i);
                    if (si < 0) return item;
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
            setPreviewElement({ t: herramienta, x1: inicioXY.x, y1: inicioXY.y, x2: x, y2: y, color, grosor });
    };

    const terminarDibujo = () => {
        panStartRef.current  = null;
        selMoveRef.current   = null;
        selHandleRef.current = null;

        if (herramienta === 'lasso' && dibujando && lassoRect) {
            const sel = elementos.map((item, idx) => rectsOverlap(lassoRect, getBbox(item)) ? idx : -1).filter(i => i >= 0);
            setSelIdxs(sel); setLassoRect(null); setDibujando(false); return;
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
            // En modo colaborativo solo puedo borrar mis propios elementos
            if (modoRef.current === 'editar' && item.autorId && item.autorId !== miIdRef.current) return true;
            return false;
        }));
        setSelIdxs([]);
    };

    const ERASER_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='22'%3E%3Crect x='1' y='1' width='34' height='20' rx='3' fill='%23fde8e8' stroke='%23e74c3c' stroke-width='1.5'/%3E%3Crect x='23' y='1' width='12' height='20' rx='0 3 3 0' fill='%23e74c3c' opacity='0.7'/%3E%3Cline x1='23' y1='1' x2='23' y2='21' stroke='%23e74c3c' stroke-width='1.5'/%3E%3C/svg%3E") 1 20, cell`;
    const CURSOR_MAP = { pan: 'grab', lasso: 'crosshair', paste: 'crosshair', text: 'text', graph: 'crosshair', axes: 'crosshair', eraser: ERASER_SVG };

    const ToolBtn = ({ id, icon, label }) => (
        <button onClick={() => { setHerramienta(id); setSelIdxs([]); }} title={label}
            style={{ padding: 7, background: herramienta === id ? '#3498db' : 'transparent', color: herramienta === id ? 'white' : '#2c3e50', border: 'none', borderRadius: 8, cursor: 'pointer', display:'flex', alignItems:'center' }}>
            {icon}
        </button>
    );

    return (
        <div ref={contenedorRef} style={{ position: 'relative', width: '100%', maxWidth: fullscreen ? '100vw' : 1100, margin: '0 auto', border: '2px solid #bdc3c7', borderRadius: 15, background: '#f8f9fa', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div style={{ background: '#ecf0f1', padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '2px solid #bdc3c7', flexWrap: 'wrap' }}>

                {/* Mode selector */}
                <select value={modoPizarra} onChange={e => { setModoPizarra(e.target.value); setHerramienta('draw'); setSelIdxs([]); }}
                    style={{ padding:'4px 8px', borderRadius:8, border:'2px solid #3498db', fontWeight:'bold', cursor:'pointer', background:'white', color:'#2c3e50', fontSize:'0.85rem' }}>
                    <option value="general">🖌 General</option>
                    <option value="musica">🎵 Música</option>
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
                        <ToolBtn id="pentagon" icon={<Hexagon size={18}/>}    label="Polígono" />
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
                </>}

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
                    </>}
                    {modoCompartir !== 'ver' && <>
                        <button onClick={() => fileInputRef.current?.click()} title="Insertar imagen"
                            style={{ padding:'5px', background:'#16a085', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}>
                            <ImageIcon size={15}/>
                        </button>
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
            {herramienta === 'paste'  && <div style={{ background:'#f1c40f', color:'#2c3e50', padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Haz clic para pegar: {textoPegar}</div>}
            {herramienta === 'graph'  && <div style={{ background:'#e67e22', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Haz clic para situar el origen de la gráfica f(x).</div>}
            {herramienta === 'axes'   && <div style={{ background:'#16a085', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Haz clic para colocar el origen (0,0) de los ejes (−8 a 8).</div>}
            {herramienta === 'pan'    && <div style={{ background:'#34495e', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>Arrastra para mover el lienzo · Doble clic para resetear.</div>}
            {herramienta === 'lasso'  && <div style={{ background:'#3498db', color:'white',   padding:4, textAlign:'center', fontWeight:'bold', fontSize:'0.82rem' }}>
                {selIdxs.length > 0 ? `${selIdxs.length} elemento(s). Arrastra para mover · handles para redimensionar y ↻ para girar · 🗑 para borrar.` : 'Dibuja un rectángulo para seleccionar.'}
            </div>}

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
            {SHAPES_3D.includes(herramienta) && <Visor3D shape={herramienta} onClose={() => setHerramienta('draw')}
                onPegarEnPizarra={(dataURL) => {
                    const img = new Image();
                    img.onload = () => {
                        const id = Date.now();
                        const maxW = 380, maxH = 260;
                        let w = img.width, h = img.height;
                        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
                        imageCacheRef.current[id] = img;
                        setElementos(prev => [...prev, { t: 'image', id, src: dataURL, x: 60 - panRef.current.x, y: 80 - panRef.current.y, w, h }]);
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
            <div style={{ background:'#dde3ea', borderTop:'2px solid #bdc3c7', padding:'5px 10px', display:'flex', gap:5, alignItems:'center', overflowX:'auto', flexShrink:0 }}>
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
export default function HerramientasClase({ onExit }) {
    const [activa, setActiva] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('pizarra')) return 'pizarra';
        const g = params.get('gestion');
        if (g === 'ruleta' || g === 'pizarra' || g === 'reloj' || g === 'grupos' || g === 'plano') return g;
        return null;
    });
    const [shareModal, setShareModal] = useState(null); // { url, titulo }

    const shareBase = `${window.location.origin}${window.location.pathname}`;

    const HERRAMIENTAS = [
        { id: 'ruleta',  icon: <RotateCcw size={40}/>,   titulo: 'Ruleta de Aula',     desc: 'Selecciona alumnos al azar desde una lista.',              color: '#e67e22' },
        { id: 'pizarra', icon: <PenTool size={40}/>,     titulo: 'Pizarra Científica',  desc: 'Funciones, Formas 3D y Captura de pantalla.',              color: '#3498db' },
        { id: 'reloj',   icon: <Clock size={40}/>,        titulo: 'Gestor de Tiempo',   desc: 'Cronómetro y Temporizador de cuenta atrás.',               color: '#2ecc71' },
        { id: 'grupos',  icon: <Users size={40}/>,        titulo: 'Grupos de Clase',    desc: 'Crea subgrupos aleatorios a partir de una lista de alumnos.', color: '#9b59b6' },
        { id: 'plano',   icon: <LayoutGrid size={40}/>,   titulo: 'Plano de Clase',     desc: 'Organiza los asientos de tu aula con un plano visual.',    color: '#1565C0' },
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
                    {activa === 'ruleta' && <RuletaApp />}
                    {activa === 'reloj' && <RelojApp />}
                    {activa === 'pizarra' && <PizarraApp />}
                    {activa === 'grupos' && <GruposLibre />}
                    {activa === 'plano' && <PlanoAulaLibre />}
                </div>
            )}

            {shareModal && (
                <ShareModalHerramienta url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />
            )}
        </div>
    );
}