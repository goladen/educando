import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
    ArrowLeft, Edit3, Settings, Clock, Play, Square, RotateCcw,
    PenTool, Type, Circle, Square as SquareIcon, Triangle, Hexagon,
    Box, Calculator as CalcIcon, X, Camera, Activity, ChevronDown, ChevronUp
} from 'lucide-react';
import Confetti from 'react-confetti';

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

function GraficadoraFlotante({ onClose, onInsertar }) {
    const [expr, setExpr] = useState('sin(x)');
    const [scale, setScale] = useState(40);

    return (
        <div style={{ position: 'absolute', top: 20, right: 300, width: 280, background: '#2c3e50', padding: 15, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 100, color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}><Activity size={16} style={{ verticalAlign: 'middle', marginRight: 5 }}/> Graficador f(x)</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><X size={16}/></button>
            </div>
            <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '0.8rem', color: '#bdc3c7' }}>Función f(x) = </label>
                <input type="text" value={expr} onChange={e => setExpr(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 5, border: 'none', marginTop: 5, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} placeholder="Ej: x^2 + 2*x" />
            </div>
            <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '0.8rem', color: '#bdc3c7' }}>Escala (Zoom): </label>
                <input type="range" min="10" max="100" value={scale} onChange={e => setScale(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <button onClick={() => onInsertar({ funcStr: expr, scale })} style={{ width: '100%', padding: 10, border: 'none', borderRadius: 5, background: '#f1c40f', color: '#2c3e50', fontWeight: 'bold', cursor: 'pointer' }}>
                Insertar en Pizarra
            </button>
        </div>
    );
}

function CalculadoraFlotante({ onClose, onCopiar }) {
    const [expr, setExpr] = useState('');
    const [res, setRes] = useState('');
    const [isScientific, setIsScientific] = useState(false);

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
        <div style={{ position: 'absolute', top: 20, right: 20, width: isScientific ? 320 : 250, background: '#2c3e50', padding: 15, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 100, transition: 'width 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'white', marginBottom: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}><CalcIcon size={16} style={{ verticalAlign: 'middle', marginRight: 5 }}/> Calculadora</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><X size={16}/></button>
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

function Visor3D({ shape, onClose }) {
    const containerRef = useRef(null);
    const materialRef = useRef(null);
    const [colorFig, setColorFig] = useState('#3498db');

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

        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
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

    return (
        <div style={{ position: 'absolute', top: 60, right: 10, width: 280, background: '#1e293b', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 100, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '7px 10px', background: '#0f172a', color: 'white', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Box size={14} />
                <span style={{ flex: 1 }}>{LABEL_MAP[shape]} <span style={{ fontWeight: 400, color: '#94a3b8' }}>· arrastra para rotar</span></span>
                <button onClick={onClose} title="Cerrar" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
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
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function PizarraApp() {
    const canvasRef = useRef(null);
    const [herramienta, setHerramienta] = useState('draw');
    const [color, setColor] = useState('#2c3e50');
    const [grosor, setGrosor] = useState(3);
    const [dibujando, setDibujando] = useState(false);
    const [inicioX, setInicioX] = useState(0);
    const [inicioY, setInicioY] = useState(0);
    const [elementos, setElementos] = useState([]); 
    const [calcVisible, setCalcVisible] = useState(false);
    const [grafVisible, setGrafVisible] = useState(false);
    const [textoPegar, setTextoPegar] = useState('');
    const [graficaConfig, setGraficaConfig] = useState(null);
    const [previewElement, setPreviewElement] = useState(null);

    useEffect(() => { dibujarCanvas(); }, [elementos, previewElement]);

    const descargarPizarra = () => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const url = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = 'Pizarra_Clase.png';
        link.href = url;
        link.click();
    };

    const dibujarCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const dibujarItem = (item) => {
            ctx.strokeStyle = item.color;
            ctx.fillStyle = item.color;
            ctx.lineWidth = item.grosor;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (item.t === 'draw') {
                ctx.beginPath();
                ctx.moveTo(item.pts[0].x, item.pts[0].y);
                item.pts.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            } else if (item.t === 'text') {
                ctx.font = "bold 24px Arial";
                ctx.fillText(item.txt, item.x, item.y);
            } else if (item.t === 'graph') {
                dibujarCurvaMatematica(ctx, item);
            } else if (item.t === 'axes') {
                dibujarEjesCoord(ctx, item);
            } else {
                dibujarForma(ctx, item);
            }
        };

        elementos.forEach(dibujarItem);
        if (previewElement) dibujarItem(previewElement);
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

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const iniciarDibujo = (e) => {
        const { x, y } = getPos(e);
        if (herramienta === 'paste' && textoPegar) {
            setElementos([...elementos, { t: 'text', txt: textoPegar, x, y, color, grosor }]);
            setHerramienta('draw'); setTextoPegar(''); return;
        }
        if (herramienta === 'graph' && graficaConfig) {
            setElementos([...elementos, { t: 'graph', funcStr: graficaConfig.funcStr, scale: graficaConfig.scale, cx: x, cy: y, color, grosor }]);
            setHerramienta('draw'); setGraficaConfig(null); return;
        }
        if (herramienta === 'axes') {
            setElementos([...elementos, { t: 'axes', cx: x, cy: y, color, grosor }]);
            setHerramienta('draw'); return;
        }

        setDibujando(true);
        setInicioX(x); setInicioY(y);
        if (herramienta === 'draw') setPreviewElement({ t: 'draw', pts: [{x, y}], color, grosor });
        if (herramienta === 'eraser') setPreviewElement({ t: 'draw', pts: [{x, y}], color: '#ffffff', grosor: grosor * 5 });
    };

    const moverDibujo = (e) => {
        if (!dibujando) return;
        const { x, y } = getPos(e);
        if (herramienta === 'draw' || herramienta === 'eraser') setPreviewElement(prev => ({ ...prev, pts: [...prev.pts, {x, y}] }));
        else setPreviewElement({ t: herramienta, x1: inicioX, y1: inicioY, x2: x, y2: y, color, grosor });
    };

    const terminarDibujo = () => {
        if (!dibujando) return;
        setDibujando(false);
        if (previewElement) { setElementos([...elementos, previewElement]); setPreviewElement(null); }
    };

    const ToolBtn = ({ id, icon, label }) => (
        <button onClick={() => setHerramienta(id)} title={label} style={{ padding: 8, background: herramienta === id ? '#3498db' : 'transparent', color: herramienta === id ? 'white' : '#2c3e50', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{icon}</button>
    );

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: 1000, margin: '0 auto', border: '2px solid #bdc3c7', borderRadius: 15, background: '#f8f9fa', overflow: 'hidden' }}>
            {/* Barra de Herramientas */}
            <div style={{ background: '#ecf0f1', padding: '10px 15px', display: 'flex', gap: 15, alignItems: 'center', borderBottom: '2px solid #bdc3c7', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 5, borderRight: '2px solid #bdc3c7', paddingRight: 15 }}>
                    <ToolBtn id="draw" icon={<PenTool size={20}/>} label="Lápiz" />
                    <ToolBtn id="line" icon={<div style={{width:20, height:2, background:'currentColor', transform:'rotate(-45deg)'}}/>} label="Línea Recta" />
                    <ToolBtn id="eraser" icon={<span style={{fontSize:'1.1rem', lineHeight:1}}>⌫</span>} label="Goma de borrar" />
                </div>
                
                <div style={{ display: 'flex', gap: 5, borderRight: '2px solid #bdc3c7', paddingRight: 15 }}>
                    <ToolBtn id="rect" icon={<SquareIcon size={20}/>} label="Rectángulo" />
                    <ToolBtn id="circle" icon={<Circle size={20}/>} label="Círculo" />
                    <ToolBtn id="triangle" icon={<Triangle size={20}/>} label="Triángulo" />
                    <ToolBtn id="pentagon" icon={<Hexagon size={20}/>} label="Polígono" />
                </div>

                <div style={{ display: 'flex', gap: 5, borderRight: '2px solid #bdc3c7', paddingRight: 15 }}>
                    <ToolBtn id="prisma" icon={<Box size={20}/>} label="Cubo/Prisma" />
                    <ToolBtn id="pyramid" icon={<span style={{fontWeight:'bold'}}>▲³</span>} label="Pirámide" />
                    <ToolBtn id="cylinder" icon={<span style={{fontWeight:'bold'}}>🛢</span>} label="Cilindro" />
                    <ToolBtn id="cone" icon={<span style={{fontWeight:'bold'}}>◮</span>} label="Cono" />
                    <ToolBtn id="sphere" icon={<span style={{fontWeight:'bold'}}>⚽</span>} label="Esfera" />
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ border: 'none', width: 28, height: 28, cursor: 'pointer', background: 'transparent', padding: 0 }} />
                    {['#2c3e50','#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#ffffff'].map(c => (
                        <button key={c} onClick={() => setColor(c)}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: color === c ? '2px solid #3498db' : '2px solid #95a5a6', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                    ))}
                    <input type="range" min="1" max="10" value={grosor} onChange={e => setGrosor(Number(e.target.value))} style={{ width: 60 }} />
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                    <button onClick={() => setHerramienta('axes')} title="Ejes de coordenadas (−8 a 8)" style={{ padding: '8px', background: herramienta === 'axes' ? '#16a085' : '#27ae60', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        XY
                    </button>
                    <button onClick={() => setGrafVisible(!grafVisible)} style={{ padding: '8px', background: '#e67e22', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }} title="Graficar Función">
                        <Activity size={18}/>
                    </button>
                    <button onClick={() => setCalcVisible(!calcVisible)} style={{ padding: '8px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }} title="Calculadora Científica">
                        <CalcIcon size={18}/>
                    </button>
                    <button onClick={descargarPizarra} style={{ padding: '8px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }} title="Guardar Pizarra">
                        <Camera size={18}/>
                    </button>
                    <button onClick={() => setElementos([])} style={{ padding: '8px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>Borrar Todo</button>
                </div>
            </div>

            {herramienta === 'paste' && <div style={{ background: '#f1c40f', color: '#2c3e50', padding: 5, textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>Haz clic en la pizarra para pegar el resultado: {textoPegar}</div>}
            {herramienta === 'graph' && <div style={{ background: '#e67e22', color: 'white', padding: 5, textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>Haz clic en la pizarra para situar el centro (0,0) de la gráfica f(x).</div>}
            {herramienta === 'axes' && <div style={{ background: '#16a085', color: 'white', padding: 5, textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>Haz clic en la pizarra para colocar el origen (0,0) de los ejes (−8 a 8).</div>}

            {calcVisible && <CalculadoraFlotante onClose={() => setCalcVisible(false)} onCopiar={(res) => { setTextoPegar(res); setHerramienta('paste'); setCalcVisible(false); }} />}
            {grafVisible && <GraficadoraFlotante onClose={() => setGrafVisible(false)} onInsertar={(cfg) => { setGraficaConfig(cfg); setHerramienta('graph'); setGrafVisible(false); }} />}
            {SHAPES_3D.includes(herramienta) && <Visor3D shape={herramienta} onClose={() => setHerramienta('draw')} />}

            <canvas
                ref={canvasRef}
                width={1000}
                height={500}
                onMouseDown={iniciarDibujo}
                onMouseMove={moverDibujo}
                onMouseUp={terminarDibujo}
                onMouseLeave={terminarDibujo}
                onTouchStart={e => { e.preventDefault(); iniciarDibujo(e); }}
                onTouchMove={e => { e.preventDefault(); moverDibujo(e); }}
                onTouchEnd={terminarDibujo}
                style={{ display: 'block', width: '100%', height: 'auto', cursor: (herramienta === 'paste' || herramienta === 'graph') ? 'crosshair' : 'default' }}
            />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: MENÚ
// ══════════════════════════════════════════════════════════════════════════════
export default function HerramientasClase({ onExit }) {
    const [activa, setActiva] = useState(null);

    const HERRAMIENTAS = [
        { id: 'ruleta', icon: <RotateCcw size={40}/>, titulo: 'Ruleta de Aula', desc: 'Selecciona alumnos al azar desde una lista.', color: '#e67e22' },
        { id: 'pizarra', icon: <PenTool size={40}/>, titulo: 'Pizarra Científica', desc: 'Funciones, Formas 3D y Captura de pantalla.', color: '#3498db' },
        { id: 'reloj', icon: <Clock size={40}/>, titulo: 'Gestor de Tiempo', desc: 'Cronómetro y Temporizador de cuenta atrás.', color: '#2ecc71' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#fce4ec', padding: '20px', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, maxWidth: 1200, margin: '0 auto 30px' }}>
                <button onClick={activa ? () => setActiva(null) : onExit} style={{ padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333' }}>
                    <ArrowLeft size={16} /> {activa ? 'Volver a Herramientas' : 'Salir'}
                </button>
                <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1.2rem' }}>
                    {activa ? HERRAMIENTAS.find(h => h.id === activa).titulo : 'Herramientas de Clase'}
                </div>
            </div>

            {!activa ? (
                <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
                    <Settings size={50} color="#9b59b6" style={{ marginBottom: 10 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: '2.5rem', margin: '0 0 30px' }}>Herramientas de Clase</h1>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                        {HERRAMIENTAS.map(h => (
                            <button key={h.id} onClick={() => setActiva(h.id)} style={{ background: 'white', border: `2px solid ${h.color}`, borderRadius: 20, padding: 30, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                <div style={{ background: `${h.color}22`, padding: 20, borderRadius: '50%', color: h.color, marginBottom: 15 }}>{h.icon}</div>
                                <h2 style={{ color: '#2c3e50', margin: '0 0 10px' }}>{h.titulo}</h2>
                                <p style={{ color: '#7f8c8d', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>{h.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ background: 'white', maxWidth: 1200, margin: '0 auto', padding: 30, borderRadius: 20, boxShadow: '0 15px 40px rgba(0,0,0,0.1)' }}>
                    {activa === 'ruleta' && <RuletaApp />}
                    {activa === 'reloj' && <RelojApp />}
                    {activa === 'pizarra' && <PizarraApp />}
                </div>
            )}
        </div>
    );
}