import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, RefreshCw, CheckCircle, BrainCircuit, Lock } from 'lucide-react';
import Confetti from 'react-confetti';

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
function ConectaPuntos({ levelData, onWin, onVolver, isLastLevel }) {
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

function ConectaLibre({ levelData, onWin, onVolver, isLastLevel }) {
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
        if (won) { audio.win(); setIsWon(true); }
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

// ─── MENÚ PRINCIPAL DE RETOS ──────────────────────────────────────────────────
export default function Retos({ onExit }) {
    const [activeGame, setActiveGame] = useState(null); // 'CONECTA'
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [nivelesDesbloqueados, setNivelesDesbloqueados] = useState(1);

    const handleWin = () => {
        // Llamado desde el botón "Siguiente nivel" del overlay
        if (currentLevelIdx < LEVELS.length - 1) {
            setNivelesDesbloqueados(prev => Math.max(prev, currentLevelIdx + 2));
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
                />
            </div>
        );
    }

    return (
        <div style={st.container}>
            <div style={st.header}>
                <button onClick={onExit} style={st.btnVolver}><ArrowLeft size={16}/> Salir al menú</button>
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
                    <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.5rem' }}>Conecta los Puntos</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
                        Une los puntos del mismo color trazando tuberías sin que se crucen entre ellas. ¡Debes rellenar todo el tablero!
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
                                {idx + 1 > nivelesDesbloqueados ? <Lock size={16} /> : `Nivel ${lvl.id}`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* TARJETA PROXIMAMENTE */}
                <div style={{ ...st.card, border: '2px dashed rgba(255,255,255,0.2)', background: 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', opacity: 0.5 }}>
                        <Lock size={40} color="white" style={{ marginBottom: 15 }} />
                        <h2 style={{ color: 'white', margin: 0 }}>Próximamente</h2>
                        <p style={{ color: 'white', textAlign: 'center', fontSize: '0.9rem' }}>Nuevos retos de lógica y matemáticas en camino.</p>
                    </div>
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
    }
};