import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, RefreshCw, CheckCircle, BrainCircuit, Lock, Grid3X3, Eraser, Edit3, Clock, Lightbulb } from 'lucide-react';
import Confetti from 'react-confetti';
import SwitchOn from './SwitchOn';
import { getProgreso, marcarNivelCompletado, cargarProgresoFirebase, guardarProgresoFirebase } from './utils/retosProgreso';
import { guardarRegistroLocal } from './utils/registrosLocales';

// ─── NIVELES DEL JUEGO (Tableros) ─────────────────────────────────────────────
const LEVELS = [
    {
        id: 1,
        type: 'grid',
        size: 5,
        dots: [
            { r: 0, c: 0, color: '#e74c3c', id: 'red' },
            { r: 4, c: 0, color: '#e74c3c', id: 'red' },
            { r: 0, c: 4, color: '#3498db', id: 'blue' },
            { r: 4, c: 3, color: '#3498db', id: 'blue' },
            { r: 0, c: 3, color: '#2ecc71', id: 'green' },
            { r: 3, c: 1, color: '#2ecc71', id: 'green' },
            { r: 2, c: 3, color: '#f1c40f', id: 'yellow' },
            { r: 4, c: 4, color: '#f1c40f', id: 'yellow' }
        ]
    },
    {
        // Círculo libre — x,y en unidades SVG (viewBox 0-100, círculo centro 50,50 radio 44)
        id: 2,
        type: 'free',
        dots: [
            { id: 'purple', color: '#9b59b6', x: 28, y: 12 },   // borde superior-izq
            { id: 'purple', color: '#9b59b6', x: 18, y: 75 },   // borde inferior-izq
            { id: 'red',    color: '#e74c3c', x: 36, y: 32 },   // interior superior
            { id: 'red',    color: '#e74c3c', x: 91, y: 55 },   // borde derecho
            { id: 'green',  color: '#2ecc71', x: 6,  y: 50 },   // borde izquierdo
            { id: 'green',  color: '#2ecc71', x: 54, y: 66 },   // interior inferior
            { id: 'yellow', color: '#f1c40f', x: 54, y: 42 },   // interior centro
            { id: 'yellow', color: '#f1c40f', x: 46, y: 93 },   // borde inferior
        ]
    },
    {
        // Flow Free Level 18 — cuadrícula 10×10, 10 pares de colores
        id: 3,
        type: 'grid',
        size: 10,
        dots: [
            { r: 3, c: 0, color: '#e74c3c', id: 'red' },
            { r: 6, c: 5, color: '#e74c3c', id: 'red' },
            { r: 1, c: 1, color: '#00bcd4', id: 'cyan' },
            { r: 3, c: 4, color: '#00bcd4', id: 'cyan' },
            { r: 3, c: 2, color: '#e91e8c', id: 'pink' },
            { r: 8, c: 2, color: '#e91e8c', id: 'pink' },
            { r: 5, c: 0, color: '#5c6bc0', id: 'blue' },
            { r: 9, c: 0, color: '#5c6bc0', id: 'blue' },
            { r: 5, c: 2, color: '#ff9800', id: 'orange' },
            { r: 7, c: 1, color: '#ff9800', id: 'orange' },
            { r: 4, c: 4, color: '#f1c40f', id: 'yellow' },
            { r: 3, c: 8, color: '#f1c40f', id: 'yellow' },
            { r: 0, c: 8, color: '#4caf50', id: 'green' },
            { r: 5, c: 6, color: '#4caf50', id: 'green' },
            { r: 0, c: 9, color: '#9c27b0', id: 'purple' },
            { r: 1, c: 7, color: '#9c27b0', id: 'purple' },
            { r: 7, c: 6, color: '#03a9f4', id: 'skyblue' },
            { r: 8, c: 8, color: '#03a9f4', id: 'skyblue' },
            { r: 8, c: 4, color: '#795548', id: 'brown' },
            { r: 9, c: 9, color: '#795548', id: 'brown' },
        ]
    }
];

// ─── Audio via Web Audio API ──────────────────────────────────────────────────
function useAudio() {
    const ctx = useRef(null);
    const getCtx = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
        return ctx.current;
    };
    const tone = (freqs, type = 'sine', vol = 0.3) => {
        try {
            const ac = getCtx();
            freqs.forEach(({ f, t, d }) => {
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.connect(gain); gain.connect(ac.destination);
                osc.type = type;
                osc.frequency.setValueAtTime(f, ac.currentTime + t);
                gain.gain.setValueAtTime(vol, ac.currentTime + t);
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + d);
                osc.start(ac.currentTime + t);
                osc.stop(ac.currentTime + t + d);
            });
        } catch (_) {}
    };
    return {
        ok:    () => tone([{ f: 523, t: 0, d: 0.1 }, { f: 784, t: 0.1, d: 0.2 }], 'sine', 0.25),
        error: () => tone([{ f: 300, t: 0, d: 0.08 }, { f: 180, t: 0.07, d: 0.2 }], 'sawtooth', 0.18),
        win:   () => [523, 659, 784, 1047].forEach((f, i) => tone([{ f, t: i * 0.1, d: 0.25 }], 'sine', 0.22)),
    };
}

// ─── COMPONENTE DEL JUEGO "CONECTA PUNTOS" ────────────────────────────────────
function ConectaPuntos({ levelData, onWin, onVolver, isLastLevel, onComplete }) {
    const [paths, setPathsState] = useState({});
    const [isWon, setIsWon] = useState(false);

    const pathsRef = useRef({});       // estado síncrono para handleMove imperativo
    const activeColorRef = useRef(null);
    const gridRef = useRef(null);
    const audio = useAudio();

    // Actualiza estado Y ref al mismo tiempo
    const setPaths = (next) => { pathsRef.current = next; setPathsState(next); };

    const setActiveColor = (c) => { activeColorRef.current = c; };

    useEffect(() => {
        setPaths({});
        setIsWon(false);
        activeColorRef.current = null;
    }, [levelData]);

    const getDotAt = (r, c) => levelData.dots.find(d => d.r === r && d.c === c);
    const isAdjacent = (p1, p2) => Math.abs(p1.r - p2.r) + Math.abs(p1.c - p2.c) === 1;

    const checkWinCondition = (currentPaths) => {
        const colors = [...new Set(levelData.dots.map(d => d.id))];
        const allConnected = colors.every(id => {
            const path = currentPaths[id];
            if (!path || path.length < 2) return false;
            const [dotA, dotB] = levelData.dots.filter(d => d.id === id);
            const first = path[0];
            const last  = path[path.length - 1];
            // válido en cualquier dirección: A→B ó B→A
            return (first.r === dotA.r && first.c === dotA.c && last.r === dotB.r && last.c === dotB.c)
                || (first.r === dotB.r && first.c === dotB.c && last.r === dotA.r && last.c === dotA.c);
        });
        if (allConnected) {
            audio.win();
            setIsWon(true);
            if (onComplete) onComplete();
        }
    };

    const handleStart = (r, c) => {
        if (isWon) return;
        const dot = getDotAt(r, c);
        let colorId = null;
        const prev = pathsRef.current;
        const next = { ...prev };

        if (dot) {
            colorId = dot.id;
            next[colorId] = [{ r, c }];
        } else {
            Object.keys(prev).forEach(color => {
                const idx = prev[color].findIndex(p => p.r === r && p.c === c);
                if (idx !== -1) { colorId = color; next[color] = prev[color].slice(0, idx + 1); }
            });
        }
        setPaths(next);
        setActiveColor(colorId);
    };

    // Imperativo: lee pathsRef directamente, detecta cortes/conexiones y emite sonidos
    const handleMove = (clientX, clientY) => {
        const color = activeColorRef.current;
        if (!color || isWon) return;
        const grid = gridRef.current;
        if (!grid) return;

        const rect = grid.getBoundingClientRect();
        const cellSize = rect.width / levelData.size;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return;

        const c = Math.floor(x / cellSize);
        const r = Math.floor(y / cellSize);

        const prev = pathsRef.current;
        const path = prev[color] || [];
        if (path.length === 0) return;

        const lastPos = path[path.length - 1];
        if (lastPos.r === r && lastPos.c === c) return;
        if (!isAdjacent(lastPos, { r, c })) return;

        const dot = getDotAt(r, c);
        if (dot && dot.id !== color) return;

        // Retroceder sobre el propio camino
        const selfIdx = path.findIndex(p => p.r === r && p.c === c);
        if (selfIdx !== -1) { setPaths({ ...prev, [color]: path.slice(0, selfIdx + 1) }); return; }

        // Cortar otro color — sonido de error
        const next = { ...prev };
        let cut = false;
        Object.keys(next).forEach(other => {
            if (other !== color) {
                const cutIdx = next[other].findIndex(p => p.r === r && p.c === c);
                if (cutIdx !== -1) { next[other] = next[other].slice(0, cutIdx); cut = true; }
            }
        });
        if (cut) audio.error();

        next[color] = [...path, { r, c }];

        // Llegamos al punto destino — sonido ok
        if (dot && dot.id === color) {
            audio.ok();
            setActiveColor(null);
            setPaths(next);
            setTimeout(() => checkWinCondition(next), 50);
            return;
        }

        setPaths(next);
    };

    const handleEnd = () => {
        setActiveColor(null);
        checkWinCondition(pathsRef.current);
    };

    // ─── Control de eventos ───
    const onTouchMove = (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onMouseMove = (e) => { handleMove(e.clientX, e.clientY); };

    // ─── Renderizado del Grid y SVG ───
    const cellSizePct = 100 / levelData.size;
    const tubeW   = cellSizePct * 0.58; // grosor del tubo de color
    const shadowW = cellSizePct * 0.72; // sombra exterior
    const shineW  = cellSizePct * 0.18; // reflejo superior
    const dotR    = cellSizePct * 0.36; // radio de la bola

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {isWon && <Confetti recycle={false} numberOfPieces={280} colors={['#f1c40f','#2ecc71','#3498db','#e74c3c','#fff']} />}

            {/* Barra superior */}
            <div style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth:460, marginBottom:16, alignItems:'center' }}>
                <button onClick={onVolver} style={st.btnSecundario}><ArrowLeft size={16}/> Volver</button>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color:'white', background:'rgba(255,255,255,0.12)', padding:'6px 18px', borderRadius:20 }}>
                    Nivel {levelData.id}
                </div>
                <button onClick={() => { setPaths({}); setIsWon(false); }} style={st.btnRefresh}><RefreshCw size={18}/></button>
            </div>

            {/* Tablero */}
            <div
                ref={gridRef}
                onMouseLeave={handleEnd}
                onMouseUp={handleEnd}
                onMouseMove={onMouseMove}
                onTouchMove={onTouchMove}
                onTouchEnd={handleEnd}
                style={{
                    position:'relative', width:'100%', maxWidth:460, aspectRatio:'1/1',
                    background:'#f4f0e8',
                    borderRadius:18,
                    border:'5px solid #2c3e50',
                    boxShadow:'0 12px 40px rgba(0,0,0,0.45), inset 0 2px 6px rgba(255,255,255,0.9)',
                    overflow:'hidden',
                    touchAction:'none',
                    userSelect:'none',
                }}
            >
                {/* 1. Cuadrícula de fondo */}
                <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:`repeat(${levelData.size},1fr)`, gridTemplateRows:`repeat(${levelData.size},1fr)` }}>
                    {Array.from({ length: levelData.size * levelData.size }).map((_, i) => (
                        <div key={i} style={{ border:'1px solid rgba(0,0,0,0.07)' }} />
                    ))}
                </div>

                {/* 2. SVG: sombras, tubos de color, reflejos y bolas */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                    <defs>
                        {/* Gradiente radial para cada bola */}
                        {[...new Set(levelData.dots.map(d => d.id))].map(id => {
                            const col = levelData.dots.find(d => d.id === id).color;
                            return (
                                <radialGradient key={id} id={`dg-${id}`} cx="38%" cy="30%" r="68%">
                                    <stop offset="0%"   stopColor="white"  stopOpacity="0.65" />
                                    <stop offset="55%"  stopColor={col}    stopOpacity="1" />
                                    <stop offset="100%" stopColor={col}    stopOpacity="0.75" />
                                </radialGradient>
                            );
                        })}
                    </defs>

                    {/* Sombras de líneas */}
                    {Object.keys(paths).map(colorId => {
                        const path = paths[colorId];
                        if (path.length < 2) return null;
                        const pts = path.map(p => `${(p.c+0.5)*cellSizePct} ${(p.r+0.5)*cellSizePct}`).join(' ');
                        return <polyline key={`sh-${colorId}`} points={pts} fill="none"
                            stroke="rgba(0,0,0,0.22)" strokeWidth={shadowW} strokeLinecap="round" strokeLinejoin="round" />;
                    })}

                    {/* Tubos de color */}
                    {Object.keys(paths).map(colorId => {
                        const path = paths[colorId];
                        if (path.length < 2) return null;
                        const col = levelData.dots.find(d => d.id === colorId).color;
                        const pts = path.map(p => `${(p.c+0.5)*cellSizePct} ${(p.r+0.5)*cellSizePct}`).join(' ');
                        return <polyline key={`tb-${colorId}`} points={pts} fill="none"
                            stroke={col} strokeWidth={tubeW} strokeLinecap="round" strokeLinejoin="round" />;
                    })}

                    {/* Reflejo superior (shine) */}
                    {Object.keys(paths).map(colorId => {
                        const path = paths[colorId];
                        if (path.length < 2) return null;
                        const pts = path.map(p => `${(p.c+0.5)*cellSizePct} ${(p.r+0.5)*cellSizePct}`).join(' ');
                        return <polyline key={`sh2-${colorId}`} points={pts} fill="none"
                            stroke="rgba(255,255,255,0.42)" strokeWidth={shineW} strokeLinecap="round" strokeLinejoin="round" />;
                    })}

                    {/* Bolas con gradiente 3D */}
                    {levelData.dots.map((dot, i) => (
                        <g key={i}>
                            {/* sombra bola */}
                            <circle cx={(dot.c+0.5)*cellSizePct} cy={(dot.r+0.5)*cellSizePct+1.2}
                                r={dotR} fill="rgba(0,0,0,0.25)" />
                            {/* bola */}
                            <circle cx={(dot.c+0.5)*cellSizePct} cy={(dot.r+0.5)*cellSizePct}
                                r={dotR} fill={`url(#dg-${dot.id})`}
                                stroke="rgba(0,0,0,0.2)" strokeWidth={cellSizePct*0.04} />
                        </g>
                    ))}
                </svg>

                {/* 3. Capa interactiva (invisible, solo captura eventos) */}
                <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:`repeat(${levelData.size},1fr)`, gridTemplateRows:`repeat(${levelData.size},1fr)` }}>
                    {Array.from({ length: levelData.size }).map((_, r) =>
                        Array.from({ length: levelData.size }).map((_, c) => (
                            <div key={`${r}-${c}`}
                                onMouseDown={(e) => { e.preventDefault(); handleStart(r, c); }}
                                onTouchStart={() => handleStart(r, c)}
                                style={{ width:'100%', height:'100%', cursor:'crosshair' }}
                            />
                        ))
                    )}
                </div>

                {/* 4. Overlay de victoria */}
                {isWon && (
                    <div style={{ position:'absolute', inset:0, background:'rgba(20,30,20,0.88)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:13, zIndex:20, animation:'fadeIn 0.35s' }}>
                        <div style={{ fontSize:'3.8rem', marginBottom:6, animation:'pop 0.5s' }}>🎉</div>
                        <div style={{ color:'#f1c40f', fontSize:'1.7rem', fontWeight:900, textAlign:'center', textShadow:'0 0 24px #f1c40faa', marginBottom:6, animation:'pop 0.5s' }}>
                            ¡Lo conseguiste!
                        </div>
                        <div style={{ color:'rgba(255,255,255,0.85)', fontSize:'0.95rem', marginBottom:22, textAlign:'center' }}>
                            {isLastLevel ? '¡Todos los retos completados! 🏆' : 'Has desbloqueado el siguiente nivel 🔓'}
                        </div>
                        {!isLastLevel && (
                            <button onClick={onWin} style={{ background:'#f1c40f', color:'#1a1a1a', border:'none', borderRadius:30, padding:'13px 32px', fontSize:'1.05rem', fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(241,196,15,0.5)', display:'flex', alignItems:'center', gap:8, animation:'pop 0.6s' }}>
                                Siguiente nivel <span style={{ fontSize:'1.2rem' }}>→</span>
                            </button>
                        )}
                        {isLastLevel && (
                            <button onClick={onVolver} style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'2px solid rgba(255,255,255,0.3)', borderRadius:30, padding:'12px 28px', fontSize:'1rem', fontWeight:700, cursor:'pointer', marginTop:4 }}>
                                Volver al menú
                            </button>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes pop     { 0%   { transform:scale(0.7); opacity:0 } 100% { transform:scale(1);   opacity:1 } }
                @keyframes fadeIn  { from { opacity:0 }                        to   { opacity:1 } }
            `}</style>
        </div>
    );
}

// ─── COMPONENTE NIVEL LIBRE (dibujo sobre círculo) ───────────────────────────
const CX = 50, CY = 50, CR = 44, SNAP = 5, MIN_DIST = 1.2;

function ConectaLibre({ levelData, onWin, onVolver, isLastLevel, onComplete }) {
    const [pathsState, setPathsState] = useState({});
    const pathsRef   = useRef({});
    const activeRef  = useRef(null);
    const svgRef     = useRef(null);
    const [isWon, setIsWon] = useState(false);
    const audio = useAudio();

    const setPaths = (next) => { pathsRef.current = next; setPathsState(next); };

    useEffect(() => { setPaths({}); setIsWon(false); activeRef.current = null; }, [levelData]);

    const toSVG = (clientX, clientY) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = clientX; pt.y = clientY;
        const m = svg.getScreenCTM();
        if (!m) return null;
        const s = pt.matrixTransform(m.inverse());
        return { x: s.x, y: s.y };
    };

    const clamp = ({ x, y }) => {
        const dx = x - CX, dy = y - CY;
        const d = Math.sqrt(dx * dx + dy * dy);
        return d <= CR ? { x, y } : { x: CX + (dx / d) * CR, y: CY + (dy / d) * CR };
    };

    const dotAt = (x, y) => levelData.dots.find(d => Math.hypot(d.x - x, d.y - y) < SNAP);

    const destDot = (color, startX, startY) => {
        const pair = levelData.dots.filter(d => d.id === color);
        return pair.find(d => !(Math.abs(d.x - startX) < 0.5 && Math.abs(d.y - startY) < 0.5));
    };

    const segCross = (a, b, c, d) => {
        const dx1 = b.x - a.x, dy1 = b.y - a.y;
        const dx2 = d.x - c.x, dy2 = d.y - c.y;
        const det = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(det) < 1e-9) return false;
        const t = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / det;
        const u = ((c.x - a.x) * dy1 - (c.y - a.y) * dx1) / det;
        return t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95;
    };

    const checkWin = (ps) => {
        const ids = [...new Set(levelData.dots.map(d => d.id))];
        const won = ids.every(id => {
            const path = ps[id];
            if (!path || path.length < 2) return false;
            const [dotA, dotB] = levelData.dots.filter(d => d.id === id);
            const first = path[0], last = path[path.length - 1];
            const startA = Math.hypot(first.x - dotA.x, first.y - dotA.y) < 0.5;
            const end    = startA ? dotB : dotA;
            return Math.hypot(last.x - end.x, last.y - end.y) < 0.5;
        });
        if (won) { audio.win(); setIsWon(true); if (onComplete) onComplete(); }
    };

    const startDraw = (clientX, clientY) => {
        if (isWon) return;
        const pt = toSVG(clientX, clientY);
        if (!pt) return;
        const dot = dotAt(pt.x, pt.y);
        if (!dot) return;
        const next = { ...pathsRef.current, [dot.id]: [{ x: dot.x, y: dot.y }] };
        setPaths(next);
        activeRef.current = dot.id;
    };

    const moveDraw = (clientX, clientY) => {
        const color = activeRef.current;
        if (!color || isWon) return;
        const raw = toSVG(clientX, clientY);
        if (!raw) return;
        const pt = clamp(raw);

        const prev = pathsRef.current;
        const path = prev[color] || [];
        if (path.length === 0) return;
        const last = path[path.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < MIN_DIST) return;

        // Cortar caminos que se crucen
        const next = { ...prev };
        let cut = false;
        Object.keys(next).forEach(other => {
            if (other === color || !next[other] || next[other].length < 2) return;
            const op = next[other];
            for (let i = 0; i < op.length - 1; i++) {
                if (segCross(last, pt, op[i], op[i + 1])) {
                    next[other] = op.slice(0, i + 1);
                    cut = true;
                    break;
                }
            }
        });
        if (cut) audio.error();

        next[color] = [...path, pt];

        // Snap al punto destino
        const dest = destDot(color, path[0].x, path[0].y);
        if (dest && Math.hypot(pt.x - dest.x, pt.y - dest.y) < SNAP) {
            next[color] = [...path, { x: dest.x, y: dest.y }];
            activeRef.current = null;
            setPaths(next);
            audio.ok();
            setTimeout(() => checkWin(next), 50);
            return;
        }

        setPaths(next);
    };

    const endDraw = () => { activeRef.current = null; };

    const ids = [...new Set(levelData.dots.map(d => d.id))];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {isWon && <Confetti recycle={false} numberOfPieces={280} colors={['#f1c40f', '#2ecc71', '#3498db', '#e74c3c', '#9b59b6', '#fff']} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 460, marginBottom: 16, alignItems: 'center' }}>
                <button onClick={onVolver} style={st.btnSecundario}><ArrowLeft size={16} /> Volver</button>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', background: 'rgba(255,255,255,0.12)', padding: '6px 18px', borderRadius: 20 }}>
                    Nivel {levelData.id}
                </div>
                <button onClick={() => { setPaths({}); setIsWon(false); }} style={st.btnRefresh}><RefreshCw size={18} /></button>
            </div>

            <div style={{ width: '100%', maxWidth: 460, aspectRatio: '1/1', position: 'relative' }}>
                <svg
                    ref={svgRef}
                    viewBox="0 0 100 100"
                    style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'crosshair' }}
                    onMouseDown={e => { e.preventDefault(); startDraw(e.clientX, e.clientY); }}
                    onMouseMove={e => moveDraw(e.clientX, e.clientY)}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; startDraw(t.clientX, t.clientY); }}
                    onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; moveDraw(t.clientX, t.clientY); }}
                    onTouchEnd={endDraw}
                >
                    <defs>
                        <clipPath id="circFree">
                            <circle cx={CX} cy={CY} r={CR} />
                        </clipPath>
                        <radialGradient id="bgFree" cx="40%" cy="35%" r="65%">
                            <stop offset="0%" stopColor="#f0eef8" />
                            <stop offset="100%" stopColor="#ddd8f0" />
                        </radialGradient>
                        {ids.map(id => {
                            const col = levelData.dots.find(d => d.id === id).color;
                            return (
                                <radialGradient key={id} id={`dgf-${id}`} cx="35%" cy="28%" r="65%">
                                    <stop offset="0%" stopColor="white" stopOpacity="0.7" />
                                    <stop offset="50%" stopColor={col} stopOpacity="1" />
                                    <stop offset="100%" stopColor={col} stopOpacity="0.8" />
                                </radialGradient>
                            );
                        })}
                    </defs>

                    {/* Fondo y borde del círculo */}
                    <circle cx={CX} cy={CY} r={CR} fill="url(#bgFree)" />
                    <circle cx={CX} cy={CY} r={CR} fill="none" stroke="#c0b8d8" strokeWidth="3.5" />
                    <circle cx={CX} cy={CY} r={CR - 1.2} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" />

                    {/* Líneas dibujadas */}
                    <g clipPath="url(#circFree)">
                        {ids.map(id => {
                            const path = pathsState[id];
                            if (!path || path.length < 2) return null;
                            const col = levelData.dots.find(d => d.id === id).color;
                            const pts = path.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
                            return (
                                <g key={id}>
                                    <polyline points={pts} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={pts} fill="none" stroke={col} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                                </g>
                            );
                        })}
                    </g>

                    {/* Bolas */}
                    {levelData.dots.map((dot, i) => (
                        <g key={i}>
                            <circle cx={dot.x} cy={dot.y + 0.8} r={4} fill="rgba(0,0,0,0.22)" />
                            <circle cx={dot.x} cy={dot.y} r={4} fill={`url(#dgf-${dot.id})`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.3" />
                        </g>
                    ))}

                    {/* Overlay oscuro al ganar */}
                    {isWon && <circle cx={CX} cy={CY} r={CR} fill="rgba(20,30,20,0.88)" />}
                </svg>

                {/* UI de victoria (fuera del SVG para poder usar botones) */}
                {isWon && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
                        <div style={{ fontSize: '3rem' }}>🎉</div>
                        <div style={{ color: '#f1c40f', fontSize: '1.5rem', fontWeight: 900, textAlign: 'center', textShadow: '0 0 20px #f1c40faa' }}>¡Lo conseguiste!</div>
                        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', textAlign: 'center', marginBottom: 6 }}>
                            {isLastLevel ? '¡Todos los retos completados! 🏆' : 'Has desbloqueado el siguiente nivel 🔓'}
                        </div>
                        {!isLastLevel && (
                            <button onClick={onWin} style={{ background: '#f1c40f', color: '#1a1a1a', border: 'none', borderRadius: 30, padding: '12px 28px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(241,196,15,0.5)', pointerEvents: 'auto' }}>
                                Siguiente nivel →
                            </button>
                        )}
                        {isLastLevel && (
                            <button onClick={onVolver} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 30, padding: '12px 28px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', pointerEvents: 'auto' }}>
                                Volver al menú
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MOTOR DE SUDOKU ──────────────────────────────────────────────────────────
const isValidSudokuPlacement = (board, r, c, num) => {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === num && i !== c) return false;
        if (board[i][c] === num && i !== r) return false;
    }
    const sr = Math.floor(r / 3) * 3, sc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if (board[sr + i][sc + j] === num && (sr + i !== r || sc + j !== c)) return false;
    return true;
};

const solveSudoku = (board) => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
                for (let n of nums) {
                    if (isValidSudokuPlacement(board, r, c, n)) {
                        board[r][c] = n;
                        if (solveSudoku(board)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
};

const generateSudoku = (difficulty) => {
    const board = Array(9).fill(0).map(() => Array(9).fill(0));
    solveSudoku(board);
    const initial = board.map(row => [...row]);
    let remove = difficulty === 'FÁCIL' ? 35 : difficulty === 'MEDIO' ? 45 : 55;
    while (remove > 0) {
        const r = Math.floor(Math.random() * 9), c = Math.floor(Math.random() * 9);
        if (initial[r][c] !== 0) { initial[r][c] = 0; remove--; }
    }
    return { initial, full: board };
};

const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

// ─── COMPONENTE SUDOKU ────────────────────────────────────────────────────────
function JuegoSudoku({ onVolver, onComplete }) {
    const [difficulty, setDifficulty] = useState(null);
    const [board, setBoard] = useState([]);
    const [initialBoard, setInitialBoard] = useState([]);
    const [notes, setNotes] = useState([]);
    const [selected, setSelected] = useState({ r: null, c: null });
    const [notesMode, setNotesMode] = useState(false);
    const [isWon, setIsWon] = useState(false);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (!difficulty || isWon) return;
        const id = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [difficulty, isWon]);

    const initGame = (diff) => {
        const { initial } = generateSudoku(diff);
        setInitialBoard(initial.map(r => [...r]));
        setBoard(initial.map(r => [...r]));
        setNotes(Array(9).fill(null).map(() => Array(9).fill([])));
        setDifficulty(diff); setIsWon(false);
        setSelected({ r: 0, c: 0 }); setSeconds(0); setNotesMode(false);
    };

    const checkWin = (b) => {
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (b[r][c] === 0 || !isValidSudokuPlacement(b, r, c, b[r][c])) return false;
        return true;
    };

    const autoCleanNotes = (cur, r, c, num) => {
        const n = cur.map(row => row.map(cell => [...cell]));
        for (let i = 0; i < 9; i++) {
            n[r][i] = n[r][i].filter(x => x !== num);
            n[i][c] = n[i][c].filter(x => x !== num);
        }
        const sr = Math.floor(r/3)*3, sc = Math.floor(c/3)*3;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
            n[sr+i][sc+j] = n[sr+i][sc+j].filter(x => x !== num);
        return n;
    };

    const handleNum = useCallback((num) => {
        if (isWon || selected.r === null || initialBoard[selected.r]?.[selected.c] !== 0) return;
        const { r, c } = selected;
        if (num === 0) {
            const b = board.map(row => [...row]); b[r][c] = 0; setBoard(b); return;
        }
        if (notesMode) {
            const n = notes.map(row => row.map(cell => [...cell]));
            n[r][c] = n[r][c].includes(num) ? n[r][c].filter(x => x !== num) : [...n[r][c], num].sort();
            setNotes(n);
            if (board[r][c] !== 0) { const b = board.map(row => [...row]); b[r][c] = 0; setBoard(b); }
        } else {
            const b = board.map(row => [...row]); b[r][c] = num; setBoard(b);
            setNotes(autoCleanNotes(notes, r, c, num));
            if (checkWin(b)) { setIsWon(true); if (onComplete) onComplete(difficulty); }
        }
    }, [isWon, selected, initialBoard, notesMode, notes, board]);

    useEffect(() => {
        const onKey = (e) => {
            if (!difficulty || isWon) return;
            const { r, c } = selected;
            if (e.key === 'ArrowUp')    setSelected({ r: Math.max(0, r-1), c });
            if (e.key === 'ArrowDown')  setSelected({ r: Math.min(8, r+1), c });
            if (e.key === 'ArrowLeft')  setSelected({ r, c: Math.max(0, c-1) });
            if (e.key === 'ArrowRight') setSelected({ r, c: Math.min(8, c+1) });
            if (e.key >= '1' && e.key <= '9') handleNum(parseInt(e.key));
            if (e.key === 'Backspace' || e.key === 'Delete') handleNum(0);
            if (e.key.toLowerCase() === 'n') setNotesMode(p => !p);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [difficulty, isWon, selected, handleNum]);

    if (!difficulty) return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'flex-start', width:'100%', marginBottom:30 }}>
                <button onClick={onVolver} style={st.btnSecundario}><ArrowLeft size={16}/> Volver</button>
            </div>
            <Grid3X3 size={60} color="#3498db" style={{ marginBottom:20 }} />
            <h2 style={{ color:'white', marginBottom:30 }}>Selecciona la Dificultad</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:15, width:'100%' }}>
                <button onClick={() => initGame('FÁCIL')}  style={{ ...st.btnLevel, background:'#2ecc71' }}>Sencillo</button>
                <button onClick={() => initGame('MEDIO')}  style={{ ...st.btnLevel, background:'#f39c12' }}>Medio</button>
                <button onClick={() => initGame('DIFÍCIL')} style={{ ...st.btnLevel, background:'#e74c3c' }}>Difícil</button>
            </div>
        </div>
    );

    return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%' }}>
            {isWon && <Confetti recycle={false} numberOfPieces={300} />}

            <div style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth:450, marginBottom:15, alignItems:'center' }}>
                <button onClick={() => setDifficulty(null)} style={st.btnSecundario}><ArrowLeft size={16}/> Atrás</button>
                <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'1rem', fontWeight:'bold', color:'white', letterSpacing:1 }}>{difficulty}</div>
                    <div style={{ fontSize:'0.85rem', color:'#bdc3c7', display:'flex', alignItems:'center', gap:5 }}>
                        <Clock size={12}/> {fmtTime(seconds)}
                    </div>
                </div>
                <button onClick={() => initGame(difficulty)} style={st.btnRefresh}><RefreshCw size={18}/></button>
            </div>

            {/* Tablero */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', width:'100%', maxWidth:450, aspectRatio:'1/1', background:'#2c3e50', border:'3px solid #1a252f', borderRadius:8, overflow:'hidden', boxShadow:'0 10px 30px rgba(0,0,0,0.4)', userSelect:'none' }}>
                {board.map((row, r) => row.map((val, c) => {
                    const isInit = initialBoard[r][c] !== 0;
                    const isSel  = selected.r === r && selected.c === c;
                    const inZone = selected.r !== null && (selected.r === r || selected.c === c || (Math.floor(r/3)===Math.floor(selected.r/3) && Math.floor(c/3)===Math.floor(selected.c/3)));
                    const selVal = selected.r !== null ? board[selected.r][selected.c] : 0;
                    const sameNum = val !== 0 && selVal === val;
                    const conflict = !isInit && val !== 0 && !isValidSudokuPlacement(board, r, c, val);
                    let bg = 'white';
                    if (isSel) bg = '#bbdefb';
                    else if (sameNum) bg = '#aed6f1';
                    else if (inZone) bg = '#ebf5fb';
                    else if (isInit) bg = '#f8f9fa';
                    let tx = isInit ? '#2c3e50' : '#2980b9';
                    if (conflict) { bg = '#fadbd8'; tx = '#c0392b'; }
                    return (
                        <div key={`${r}-${c}`} onClick={() => !isWon && setSelected({ r, c })}
                            style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative',
                                background:bg, color:tx,
                                borderBottom: (r===2||r===5) ? '3px solid #1a252f' : '1px solid #bdc3c7',
                                borderRight:  (c===2||c===5) ? '3px solid #1a252f' : '1px solid #bdc3c7',
                                fontSize:'clamp(1.1rem,5vw,1.6rem)', fontWeight: isInit ? 900 : 600,
                                cursor: isWon ? 'default' : 'pointer', transition:'background 0.1s' }}
                        >
                            {val !== 0 ? val : ''}
                            {val === 0 && notes[r][c].length > 0 && (
                                <div style={{ position:'absolute', inset:2, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridTemplateRows:'repeat(3,1fr)', pointerEvents:'none' }}>
                                    {[1,2,3,4,5,6,7,8,9].map(n => (
                                        <div key={n} style={{ display:'flex', alignItems:'center', justifyContent:'center', fontSize:'clamp(0.4rem,2vw,0.6rem)', color:'#7f8c8d', fontWeight:'bold' }}>
                                            {notes[r][c].includes(n) ? n : ''}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }))}
            </div>

            {/* Controles */}
            <div style={{ width:'100%', maxWidth:450, marginTop:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => handleNum(0)} style={{ ...st.btnAction, flex:1 }}><Eraser size={18}/> Borrar</button>
                    <button onClick={() => setNotesMode(p => !p)} style={{ ...st.btnAction, flex:2, background: notesMode ? '#3498db' : '#34495e', color:'white' }}>
                        <Edit3 size={18}/> {notesMode ? 'Notas: ON' : 'Notas: OFF'}
                    </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:5 }}>
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                        <button key={n} onClick={() => handleNum(n)} style={st.btnNumpad}>{n}</button>
                    ))}
                </div>
            </div>

            {isWon && (
                <div style={st.winBadge}><CheckCircle size={22}/> ¡Completado en {fmtTime(seconds)}!</div>
            )}
        </div>
    );
}

// ─── BOTÓN COMPARTIR ─────────────────────────────────────────────────────────
function BtnCompartir({ path, title = 'pikt.es · Sala de Retos' }) {
    const [copiado, setCopiado] = useState(false);
    const compartir = async (e) => {
        e.stopPropagation();
        const url = `https://pikt.es/${path}`;
        if (navigator.share) {
            try { await navigator.share({ title, url }); } catch (_) {}
        } else {
            navigator.clipboard.writeText(url).catch(() => {});
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2200);
        }
    };
    return (
        <button onClick={compartir} style={{
            background: copiado ? 'rgba(46,204,113,0.18)' : 'rgba(255,255,255,0.07)',
            border: `1px solid ${copiado ? '#2ecc71' : 'rgba(255,255,255,0.18)'}`,
            color: copiado ? '#2ecc71' : 'rgba(255,255,255,0.65)',
            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.2s'
        }}>
            {copiado ? '✓ Copiado' : '🔗 Compartir'}
        </button>
    );
}

// ─── MENÚ PRINCIPAL DE RETOS ──────────────────────────────────────────────────
export default function Retos({ onExit, initialGame = null, usuario = null }) {
    const [activeGame, setActiveGame] = useState(initialGame); // 'CONECTA' | 'SUDOKU' | 'SWITCHON' | null
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [progreso, setProgreso] = useState(() => getProgreso());

    // Al entrar: si el alumno está registrado, traer su progreso de Firebase y fusionarlo.
    useEffect(() => {
        if (!usuario?.uid) return;
        let activo = true;
        cargarProgresoFirebase(usuario.uid).then((fusion) => {
            if (activo && fusion) setProgreso({ ...fusion });
        });
        return () => { activo = false; };
    }, [usuario?.uid]);

    // Registra que un nivel se ha superado: dispositivo + (si registrado) Firebase + "Mis registros".
    const completarNivel = useCallback((juego, nivel, titulo) => {
        const { progreso: nuevo, esNuevo } = marcarNivelCompletado(juego, nivel);
        setProgreso({ ...nuevo });
        if (esNuevo) {
            guardarRegistroLocal('RETOS', { titulo, aciertos: 1, intentos: 1, porcentaje: 100, via: 'Reto superado' });
            if (usuario?.uid) guardarProgresoFirebase(usuario.uid);
        }
    }, [usuario?.uid]);

    // Niveles de "Conecta" desbloqueados: el 1 siempre, y el siguiente al máximo superado.
    const conectaSuperados = progreso.CONECTA || [];
    const nivelesDesbloqueados = conectaSuperados.length
        ? Math.min(LEVELS.length, Math.max(...conectaSuperados) + 1)
        : 1;

    const handleWin = () => {
        // Llamado desde el botón "Siguiente nivel" del overlay
        if (currentLevelIdx < LEVELS.length - 1) {
            setCurrentLevelIdx(prev => prev + 1);
        }
    };

    if (activeGame === 'CONECTA') {
        const level = LEVELS[currentLevelIdx];
        const GameComp = level.type === 'free' ? ConectaLibre : ConectaPuntos;
        return (
            <div style={st.containerGame}>
                <GameComp
                    levelData={level}
                    onWin={handleWin}
                    onVolver={() => setActiveGame(null)}
                    isLastLevel={currentLevelIdx === LEVELS.length - 1}
                    onComplete={() => completarNivel('CONECTA', level.id, `Conecta los Puntos · Nivel ${level.id}`)}
                />
            </div>
        );
    }

    if (activeGame === 'SUDOKU') return (
        <div style={st.containerGame}>
            <JuegoSudoku
                onVolver={() => setActiveGame(null)}
                onComplete={(diff) => completarNivel('SUDOKU', diff, `Sudoku · ${diff}`)}
            />
        </div>
    );

    if (activeGame === 'SWITCHON') return (
        <SwitchOn
            onVolver={() => setActiveGame(null)}
            completados={progreso.SWITCHON || []}
            onLevelComplete={(lvl) => completarNivel('SWITCHON', lvl, `El Juego de las Luces · Nivel ${lvl}`)}
        />
    );

    return (
        <div style={st.container}>
            <div style={{ ...st.header, justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onExit} style={st.btnVolver}><ArrowLeft size={16}/> Salir al menú</button>
                <BtnCompartir path="retos" />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{ background: '#f39c12', width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', boxShadow: '0 10px 20px rgba(243, 156, 18, 0.3)' }}>
                    <BrainCircuit size={45} color="white" />
                </div>
                <h1 style={{ color: 'white', fontSize: '2.5rem', margin: '0 0 10px' }}>Sala de Retos</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', margin: 0 }}>Entrena tu lógica, visión espacial y resolución de problemas.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, width: '100%', maxWidth: 800 }}>
                
                {/* TARJETA JUEGO 1 */}
                <div style={st.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                        <div style={{ background: '#e74c3c', padding: 12, borderRadius: 14 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}>
                            Topología
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Conecta los Puntos</h2>
                        <BtnCompartir path="conectapuntos" />
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
                        Une los puntos del mismo color trazando tuberías sin que se crucen entre ellas.
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {LEVELS.map((lvl, idx) => (
                            <button 
                                key={lvl.id} 
                                disabled={idx + 1 > nivelesDesbloqueados}
                                onClick={() => { setCurrentLevelIdx(idx); setActiveGame('CONECTA'); }}
                                style={{ 
                                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', fontWeight: 'bold', cursor: idx + 1 > nivelesDesbloqueados ? 'not-allowed' : 'pointer',
                                    background: idx + 1 <= nivelesDesbloqueados ? '#3498db' : 'rgba(255,255,255,0.1)',
                                    color: idx + 1 <= nivelesDesbloqueados ? 'white' : 'rgba(255,255,255,0.3)'
                                }}
                            >
                                {idx + 1 > nivelesDesbloqueados
                                    ? <Lock size={16} />
                                    : <>Nivel {lvl.id}{conectaSuperados.includes(lvl.id) ? ' ✓' : ''}</>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* TARJETA SUDOKU */}
                <div style={st.card}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:15 }}>
                        <div style={{ background:'#3498db', padding:12, borderRadius:14 }}>
                            <Grid3X3 size={24} color="white" />
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.1)', padding:'4px 10px', borderRadius:20, fontSize:'0.8rem', color:'white', fontWeight:'bold' }}>
                            Lógica Numérica
                        </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <h2 style={{ color:'white', margin:0, fontSize:'1.5rem' }}>Sudoku Infinito</h2>
                        <BtnCompartir path="sudoku" />
                    </div>
                    <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', lineHeight:1.5, marginBottom:20 }}>
                        El reto clásico: rellena la cuadrícula sin repetir números. Con modo notas, teclado y tres niveles de dificultad.
                    </p>
                    <button onClick={() => setActiveGame('SUDOKU')} style={{ width:'100%', padding:'12px', background:'#3498db', color:'white', border:'none', borderRadius:10, fontWeight:'bold', fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        <Play size={18}/> Jugar Sudoku
                    </button>
                </div>

                {/* TARJETA SWITCH ON (El Juego de las Luces) */}
                <div style={st.card}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:15 }}>
                        <div style={{ background:'#7c3aed', padding:12, borderRadius:14 }}>
                            <Lightbulb size={24} color="white" />
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.1)', padding:'4px 10px', borderRadius:20, fontSize:'0.8rem', color:'white', fontWeight:'bold' }}>
                            Lógica
                        </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <h2 style={{ color:'white', margin:0, fontSize:'1.5rem' }}>El Juego de las Luces</h2>
                        <BtnCompartir path="switchon" />
                    </div>
                    <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', lineHeight:1.5, marginBottom:20 }}>
                        Cambia el color de los nodos conectados hasta que tu tablero coincida con el objetivo. 6 niveles de dificultad creciente.
                    </p>
                    <button onClick={() => setActiveGame('SWITCHON')} style={{ width:'100%', padding:'12px', background:'#7c3aed', color:'white', border:'none', borderRadius:10, fontWeight:'bold', fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        <Play size={18}/> Jugar
                        {(progreso.SWITCHON || []).length > 0 && (
                            <span style={{ fontSize:'0.85rem', fontWeight:700, background:'rgba(255,255,255,0.25)', padding:'2px 8px', borderRadius:12 }}>
                                {(progreso.SWITCHON || []).length}/6 ✓
                            </span>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

// ─── ESTILOS COMPARTIDOS ──────────────────────────────────────────────────────
const st = {
    container: { 
        minHeight: '100vh', background: 'linear-gradient(135deg, #1e272e 0%, #2c3e50 100%)', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px',
        fontFamily: "'Segoe UI', Tahoma, sans-serif"
    },
    containerGame: {
        minHeight: '100vh', background: '#0f141d', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20,
        fontFamily: "'Segoe UI', Tahoma, sans-serif"
    },
    header: {
        width: '100%', maxWidth: 800, display: 'flex', justifyContent: 'flex-start', marginBottom: 20
    },
    btnVolver: {
        background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 15px', 
        borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold',
        transition: 'background 0.2s'
    },
    btnSecundario: {
        background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 12px', 
        borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold'
    },
    btnRefresh: {
        background: 'rgba(231, 76, 60, 0.2)', border: 'none', color: '#e74c3c', padding: '8px', 
        borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    card: {
        background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 30, border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 15px 35px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column'
    },
    winBadge: {
        marginTop: 25, background: '#27ae60', color: 'white', padding: '15px 30px', borderRadius: 30,
        fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10
    },
    btnLevel: {
        padding: '15px', border: 'none', borderRadius: 12, color: 'white', fontWeight: 'bold',
        fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
    },
    btnNumpad: {
        background: '#ecf0f1', border: 'none', borderRadius: 8, color: '#2c3e50',
        fontSize: 'clamp(1.1rem,4vw,1.4rem)', fontWeight: 'bold', padding: '10px 0',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    btnAction: {
        border: 'none', borderRadius: 10, padding: '12px 15px', fontSize: '0.9rem', fontWeight: 'bold',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: '#ecf0f1', color: '#34495e', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }
};