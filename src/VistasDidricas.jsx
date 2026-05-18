import React, { useState } from 'react';
import confetti from 'canvas-confetti';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const G = 4; // grid size 4×4
const empty = () => Array(G).fill(null).map(() => Array(G).fill(0));

// ─── ISO SVG HELPERS ─────────────────────────────────────────────────────────
// U=24 so the 4×4 floor grid (max iso(4,4,0)) fits inside the SVG
const U = 24, CX = 155, CY = 108;
function iso(x, y, z) {
  return { x: CX + (x - y) * U * 0.866, y: CY + (x + y) * U * 0.5 - z * U };
}
function face(coords, fill) {
  const d = coords.map(([x,y,z], i) => {
    const p = iso(x, y, z);
    return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ') + 'Z';
  return <path d={d} fill={fill} stroke="#0f172a" strokeWidth="0.8" />;
}
function Cube({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]], '#7dd3fc')}
      {face([[x,y+1,z],[x,y+1,z+1],[x+1,y+1,z+1],[x+1,y+1,z]], '#2563eb')}
      {face([[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]], '#1d4ed8')}
    </g>
  );
}
// Arrow helper: line + arrowhead from (x1,y1) → (x2,y2)
function Arrow({ x1, y1, x2, y2, color, dashed }) {
  const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy);
  if (len < 1) return null;
  const ux = dx/len, uy = dy/len;
  const hw = 4;
  const hx1 = x2 - ux*9 + uy*hw, hy1 = y2 - uy*9 - ux*hw;
  const hx2 = x2 - ux*9 - uy*hw, hy2 = y2 - uy*9 + ux*hw;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5"
        strokeDasharray={dashed ? '4,3' : undefined} />
      <polygon points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={color} />
    </g>
  );
}

// 4×4 floor grid at z=0
function FloorGrid() {
  const lines = [];
  const N = 4;
  for (let i = 0; i <= N; i++) {
    const a = iso(0, i, 0), b = iso(N, i, 0);
    const c = iso(i, 0, 0), d = iso(i, N, 0);
    lines.push(
      <line key={`py${i}`} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)}
        stroke="rgba(99,160,255,0.28)" strokeWidth="0.9" />,
      <line key={`px${i}`} x1={c.x.toFixed(1)} y1={c.y.toFixed(1)} x2={d.x.toFixed(1)} y2={d.y.toFixed(1)}
        stroke="rgba(99,160,255,0.28)" strokeWidth="0.9" />,
    );
  }
  // Subtle fill per cell
  const cells = [];
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const pts = [iso(x,y,0), iso(x+1,y,0), iso(x+1,y+1,0), iso(x,y+1,0)];
      const d = pts.map((p,i) => `${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
      cells.push(<path key={`c${x}-${y}`} d={d} fill="rgba(60,100,180,0.10)" />);
    }
  }
  return <g>{cells}{lines}</g>;
}

function IsoView({ cubes }) {
  // Sort by diagonal depth (x+y) first, then height (z) — better painter's algorithm
  const sorted = [...cubes].sort((a, b) => (a[0]+a[1]) - (b[0]+b[1]) || a[2] - b[2]);

  // Axis legend origin (bottom-left, clear of the grid)
  const ox = 42, oy = 228, aL = 20;
  const xTip = { x: ox + aL*0.866, y: oy - aL*0.5 };
  const yTip = { x: ox - aL*0.866, y: oy - aL*0.5 };
  const zTip = { x: ox,            y: oy - aL      };

  // FRONTAL indicator: horizontal arrow from right → front (y=0) face
  const frontEdge = iso(1.5, 0, 0.5);
  const fAx = 305, fAy = frontEdge.y;

  return (
    <svg width={310} height={248} style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 12, display: 'block' }}>

      {/* ── 4×4 floor grid ── */}
      <FloorGrid />

      {/* ── Cubes ── */}
      {sorted.map(([x,y,z], i) => <Cube key={i} x={x} y={y} z={z} />)}

      {/* ── FRONTAL arrow: horizontal from right → front (y=0) face ── */}
      <Arrow x1={fAx} y1={fAy} x2={frontEdge.x + 4} y2={fAy} color="#fb923c" dashed />
      <text x={fAx - 2} y={fAy - 8} fill="#fb923c" fontSize="9" fontWeight="800" textAnchor="end">FRONTAL</text>
      <text x={fAx - 2} y={fAy + 10} fill="#fb923c" fontSize="8" opacity="0.8" textAnchor="end">→ ALZADO</text>

      {/* ── Axis legend (bottom-left) ── */}
      <g opacity="0.9">
        <circle cx={ox} cy={oy} r="2" fill="#94a3b8" />

        {/* X axis – red */}
        <Arrow x1={ox} y1={oy} x2={xTip.x} y2={xTip.y} color="#f87171" />
        <text x={xTip.x + 3} y={xTip.y + 4} fill="#f87171" fontSize="9" fontWeight="700">X</text>

        {/* Y axis – green (depth / profundidad) */}
        <Arrow x1={ox} y1={oy} x2={yTip.x} y2={yTip.y} color="#4ade80" />
        <text x={yTip.x - 2} y={yTip.y + 4} fill="#4ade80" fontSize="9" fontWeight="700" textAnchor="end">Y</text>

        {/* Z axis – cyan (height / altura) */}
        <Arrow x1={ox} y1={oy} x2={zTip.x} y2={zTip.y} color="#7dd3fc" />
        <text x={zTip.x + 3} y={zTip.y - 2} fill="#7dd3fc" fontSize="9" fontWeight="700">Z</text>
      </g>

      {/* ── Legend label ── */}
      <text x={ox} y={oy + 12} fill="#475569" fontSize="7" textAnchor="middle">ejes</text>
    </svg>
  );
}

// ─── CLICK GRID ──────────────────────────────────────────────────────────────
// Cell states: 0=empty, 1=full, 2=diagonal "/" (lower-right ▟), 3=diagonal "\" (lower-left ▙)
const CS = 34, GAP = 2;
function GridView({ label, grid, onChange, color, hasError }) {
  const toggle = (r, c) => {
    const n = grid.map(row => [...row]);
    n[r][c] = (n[r][c] + 1) % 4;
    onChange(n);
  };
  const dim = G * (CS + GAP);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{
        display: 'inline-block', padding: 4,
        background: hasError ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
        borderRadius: 8, border: `2px solid ${hasError ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
        transition: 'border-color 0.3s',
      }}>
        <svg width={dim} height={dim} style={{ display: 'block' }}>
          {grid.map((row, r) => row.map((v, c) => {
            const x = c * (CS + GAP), y = r * (CS + GAP);
            return (
              <g key={`${r}-${c}`} onClick={() => toggle(r, c)} style={{ cursor: 'pointer' }}>
                <rect x={x} y={y} width={CS} height={CS} rx="3"
                  fill="rgba(255,255,255,0.04)"
                  stroke={v ? color : 'rgba(255,255,255,0.10)'} strokeWidth="1" />
                {/* Subtle guide diagonals on empty cells */}
                {v === 0 && <>
                  <line x1={x} y1={y+CS} x2={x+CS} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeDasharray="3,3" />
                  <line x1={x} y1={y} x2={x+CS} y2={y+CS} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeDasharray="3,3" />
                </>}
                {/* Full fill */}
                {v === 1 && <rect x={x} y={y} width={CS} height={CS} rx="3" fill={color} stroke={color} strokeWidth="1" />}
                {/* "/" diagonal: lower-right triangle */}
                {v === 2 && <>
                  <polygon points={`${x+CS},${y} ${x+CS},${y+CS} ${x},${y+CS}`} fill={color} stroke={color} strokeWidth="0.5" />
                  <rect x={x} y={y} width={CS} height={CS} rx="3" fill="none" stroke={color} strokeWidth="1" />
                </>}
                {/* "\" diagonal: lower-left triangle */}
                {v === 3 && <>
                  <polygon points={`${x},${y} ${x},${y+CS} ${x+CS},${y+CS}`} fill={color} stroke={color} strokeWidth="0.5" />
                  <rect x={x} y={y} width={CS} height={CS} rx="3" fill="none" stroke={color} strokeWidth="1" />
                </>}
              </g>
            );
          }))}
        </svg>
      </div>
      <div style={{ color: '#475569', fontSize: '0.62rem', marginTop: 3 }}>clic: ▪ → ◼ → ▟ → ▙</div>
      <button onClick={() => onChange(empty())} style={{
        display: 'block', margin: '3px auto 0', background: 'none', border: 'none',
        color: '#475569', fontSize: '0.7rem', cursor: 'pointer',
      }}>🗑 borrar</button>
    </div>
  );
}

// ─── FIGURE DATA ─────────────────────────────────────────────────────────────
// Grids: row 0 = top (max z) or front (min y)
// alzado: cols=X, rows=Z desc  |  planta: cols=X, rows=Y asc  |  perfil: cols=Y, rows=Z desc
const FIGURAS = [
  {
    id: 1, nombre: 'El Escalón', emoji: '🪜', dif: 1,
    desc: 'Escalera de 3 peldaños, vista desde el frente',
    cubes: [[0,0,0],[0,0,1],[0,0,2],[1,0,0],[1,0,1],[2,0,0]],
    alzado: [[1,0,0,0],[1,1,0,0],[1,1,1,0],[0,0,0,0]],
    planta:  [[1,1,1,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
  },
  {
    id: 2, nombre: 'Torre en Esquina', emoji: '🏗️', dif: 1,
    desc: 'Base cuadrada 2×2 con torre en una esquina',
    cubes: [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[0,0,2]],
    alzado: [[1,0,0,0],[1,0,0,0],[1,1,0,0],[0,0,0,0]],
    planta:  [[1,1,0,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,0,0,0],[1,0,0,0],[1,1,0,0],[0,0,0,0]],
  },
  {
    id: 3, nombre: 'La Cruz', emoji: '✚', dif: 1,
    desc: 'Cinco cubos en forma de cruz plana',
    cubes: [[1,0,0],[0,1,0],[1,1,0],[2,1,0],[1,2,0]],
    alzado: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,1,1,0]],
    planta:  [[0,1,0,0],[1,1,1,0],[0,1,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,1,1,0]],
  },
  {
    id: 4, nombre: 'El Puente', emoji: '🌉', dif: 2,
    desc: 'Dos pilares y una viga horizontal',
    cubes: [[0,0,0],[2,0,0],[0,0,1],[1,0,1],[2,0,1]],
    alzado: [[0,0,0,0],[0,0,0,0],[1,1,1,0],[1,0,1,0]],
    planta:  [[1,1,1,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,0,0,0],[1,0,0,0],[1,0,0,0]],
  },
  {
    id: 5, nombre: 'El Nicho', emoji: '🏛️', dif: 2,
    desc: 'Dos paredes laterales (2 de fondo) con base, abierto al frente',
    // Two full walls (x=0 and x=2), each 2 deep × 3 tall, plus floor strip
    cubes: [
      [0,0,0],[0,1,0],[0,0,1],[0,1,1],[0,0,2],[0,1,2],  // left wall
      [2,0,0],[2,1,0],[2,0,1],[2,1,1],[2,0,2],[2,1,2],  // right wall
      [1,0,0],[1,1,0],                                   // floor between walls
    ],
    alzado: [[1,0,1,0],[1,0,1,0],[1,1,1,0],[0,0,0,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,0,0],[0,0,0,0]],
  },
  {
    id: 6, nombre: 'La L Grande', emoji: '📐', dif: 2,
    desc: 'Escalera que gira: baja en X y se prolonga en Y con altura',
    cubes: [
      [0,0,0],[0,0,1],[0,0,2],
      [1,0,0],[1,0,1],
      [2,0,0],
      [0,1,0],[0,1,1],[0,1,2],
      [0,2,0],
    ],
    alzado: [[1,0,0,0],[1,1,0,0],[1,1,1,0],[0,0,0,0]],
    planta:  [[1,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,1,0],[0,0,0,0]],
  },
  {
    id: 7, nombre: 'La T', emoji: '🔱', dif: 1,
    desc: 'Barra superior y tallo central en forma de T plana',
    cubes: [[0,0,0],[1,0,0],[2,0,0],[1,1,0],[1,2,0]],
    alzado: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,1,1,0]],
  },
  {
    id: 8, nombre: 'La Pirámide', emoji: '🗻', dif: 2,
    desc: 'Pirámide escalonada: base 3×2, nivel medio 2×1, cúspide',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[1,0,1],
      [0,0,2],
    ],
    alzado: [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,0,0]],
  },
  {
    id: 9, nombre: 'El Arco', emoji: '🚪', dif: 3,
    desc: 'Dos pilares de altura 4 unidos por un dintel superior',
    cubes: [
      [0,0,0],[0,0,1],[0,0,2],[0,0,3],
      [2,0,0],[2,0,1],[2,0,2],[2,0,3],
      [1,0,3],
    ],
    alzado: [[1,1,1,0],[1,0,1,0],[1,0,1,0],[1,0,1,0]],
    planta:  [[1,1,1,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0]],
  },
  {
    id: 10, nombre: 'El Zigzag', emoji: '⚡', dif: 3,
    desc: 'Escalera en diagonal: cada peldaño avanza en X e Y a la vez',
    cubes: [[2,0,0],[1,1,0],[1,1,1],[0,2,0],[0,2,1],[0,2,2]],
    alzado: [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,1,0]],
    planta:  [[0,0,1,0],[0,1,0,0],[1,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,0,1,0],[0,1,1,0],[1,1,1,0]],
  },
  {
    id: 11, nombre: 'La U Abierta', emoji: '🧲', dif: 2,
    desc: 'Dos brazos de h=2 con base de h=1, abierta por arriba',
    cubes: [
      [0,0,0],[0,0,1],[0,1,0],[0,1,1],
      [2,0,0],[2,0,1],[2,1,0],[2,1,1],
      [0,2,0],[1,2,0],[2,2,0],
    ],
    alzado: [[0,0,0,0],[0,0,0,0],[1,0,1,0],[1,1,1,0]],
    planta:  [[1,0,1,0],[1,0,1,0],[1,1,1,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,0,0,0],[1,1,0,0],[1,1,1,0]],
  },
  {
    id: 12, nombre: 'El Escalón Doble', emoji: '🎚️', dif: 3,
    desc: 'Dos torres de distinta altura (h=3 y h=2) separadas por un hueco',
    cubes: [[0,0,0],[0,0,1],[0,0,2],[1,0,0],[2,0,0],[2,0,1]],
    alzado: [[0,0,0,0],[1,0,0,0],[1,0,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0]],
  },
];

const MSGS_OK  = ['¡Visión espacial perfecta!','¡Dominas el sistema diédrico!','¡Excelente trabajo!','¡Maestro del dibujo técnico!'];
const MSGS_ERR = ['Hay algo que no cuadra. ¡Revisa las proyecciones!','Casi… comprueba cada vista con calma.','¡Sigue intentándolo!'];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function VistasDidricas({ onBack }) {
  const [screen,    setScreen]    = useState('menu');
  const [fig,       setFig]       = useState(null);
  const [grids,     setGrids]     = useState({ alzado: empty(), planta: empty(), perfil: empty() });
  const [lives,     setLives]     = useState(3);
  const [pts,       setPts]       = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [done,      setDone]      = useState(new Set());
  const [status,    setStatus]    = useState(null); // null | 'success' | 'error' | 'gameover'
  const [errors,    setErrors]    = useState({ alzado: false, planta: false, perfil: false });
  const [hinted,    setHinted]    = useState(false);
  const [okMsg,     setOkMsg]     = useState('');

  const startFig = (f) => {
    setFig(f);
    setGrids({ alzado: empty(), planta: empty(), perfil: empty() });
    setLives(3);
    setStatus(null);
    setErrors({ alzado: false, planta: false, perfil: false });
    setHinted(false);
    setScreen('game');
  };

  const setGrid = (key, g) => setGrids(prev => ({ ...prev, [key]: g }));

  const validate = () => {
    const ok = (key) => fig[key].every((row, r) => row.every((v, c) => v === grids[key][r][c]));
    const a = ok('alzado'), p = ok('planta'), pr = ok('perfil');
    setErrors({ alzado: !a, planta: !p, perfil: !pr });
    if (a && p && pr) {
      const gained = 100 + (lives - 1) * 25 + (hinted ? 0 : 20);
      setPts(prev => prev + gained);
      setStreak(prev => prev + 1);
      setDone(prev => new Set(prev).add(fig.id));
      setOkMsg(MSGS_OK[Math.floor(Math.random() * MSGS_OK.length)]);
      setStatus('success');
      confetti({ particleCount: 130, spread: 80, origin: { y: 0.55 } });
    } else {
      const nl = lives - 1;
      setLives(nl);
      setStreak(0);
      setStatus(nl <= 0 ? 'gameover' : 'error');
      if (nl > 0) setTimeout(() => setStatus(null), 2500);
    }
  };

  const hint = () => {
    for (const key of ['alzado', 'planta', 'perfil']) {
      const free = [];
      fig[key].forEach((row, r) => row.forEach((v, c) => { if (v && grids[key][r][c] !== v) free.push([r, c, key, v]); }));
      if (free.length) {
        const [r, c, k, val] = free[Math.floor(Math.random() * free.length)];
        setGrids(prev => {
          const n = { ...prev, [k]: prev[k].map(row => [...row]) };
          n[k][r][c] = val;
          return n;
        });
        setHinted(true);
        return;
      }
    }
  };

  // ── MENU ────────────────────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e293b)', padding: '20px 16px', fontFamily: 'system-ui,sans-serif' }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '7px 16px', cursor: 'pointer', marginBottom: 24, fontSize: '0.9rem' }}>
          ← Volver
        </button>
      )}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: '2.8rem', marginBottom: 4 }}>📐</div>
        <h1 style={{ color: '#f1f5f9', margin: '0 0 4px', fontWeight: 800, fontSize: '1.8rem' }}>Master 3D</h1>
        <p style={{ color: '#60a5fa', margin: '0 0 16px', fontWeight: 600 }}>El Desafío Diédrico</p>
        <div style={{ display: 'inline-flex', gap: 20, background: 'rgba(255,255,255,0.05)', padding: '10px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: '#fbbf24' }}>🔥 {streak} racha</span>
          <span style={{ color: '#60a5fa' }}>⭐ {pts} pts</span>
          <span style={{ color: '#34d399' }}>✅ {done.size}/{FIGURAS.length}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, maxWidth: 800, margin: '0 auto' }}>
        {FIGURAS.map(f => (
          <div key={f.id} onClick={() => startFig(f)} style={{
            background: done.has(f.id) ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)',
            border: `2px solid ${done.has(f.id) ? '#34d399' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14, padding: '18px 14px', cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.2s', position: 'relative',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {done.has(f.id) && <span style={{ position: 'absolute', top: 8, right: 10, color: '#34d399', fontSize: '1rem' }}>✓</span>}
            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{f.emoji}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 2 }}>Figura {f.id}</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{f.nombre}</div>
            <div style={{ color: '#fbbf24', fontSize: '0.8rem' }}>{'⭐'.repeat(f.dif)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── GAME ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e293b)', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setScreen('menu')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem' }}>← Menú</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>Figura {fig.id}: {fig.nombre}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{fig.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#fbbf24', fontSize: '0.9rem' }}>⭐ {pts}</span>
          <span style={{ fontSize: '1rem' }}>{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', gap: 18, padding: '18px 16px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>

        {/* ISO VIEW */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Vista 3D</div>
          <IsoView cubes={fig.cubes} />
          <div style={{ color: '#475569', fontSize: '0.7rem', textAlign: 'center', marginTop: 5, lineHeight: 1.5 }}>
            La flecha naranja indica la cara <span style={{ color: '#fb923c', fontWeight: 700 }}>FRONTAL</span><br/>
            Ejes: <span style={{ color: '#f87171' }}>X →</span> ancho · <span style={{ color: '#4ade80' }}>Y →</span> profundidad · <span style={{ color: '#7dd3fc' }}>Z →</span> altura
          </div>
        </div>

        {/* GRIDS + CONTROLS */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ color: '#a78bfa', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Proyecciones Diédricas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <GridView label="Alzado (frontal)" grid={grids.alzado} onChange={g => setGrid('alzado', g)} color="#60a5fa" hasError={errors.alzado} />
            <GridView label="Perfil (lateral)"  grid={grids.perfil} onChange={g => setGrid('perfil', g)} color="#a78bfa" hasError={errors.perfil} />
            <GridView label="Planta (superior)" grid={grids.planta} onChange={g => setGrid('planta', g)} color="#34d399" hasError={errors.planta} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', padding: '4px 0' }}>
              <button onClick={validate} style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, color: '#fff', padding: '11px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}>
                ✓ Comprobar
              </button>
              <button onClick={hint} disabled={hinted} style={{ background: hinted ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: 10, color: hinted ? '#475569' : '#fff', padding: '9px 14px', cursor: hinted ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                💡 {hinted ? 'Pista usada' : 'Pista'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 10, color: '#334155', fontSize: '0.68rem', textAlign: 'center' }}>
            Alzado ↖ · Perfil ↗ · Planta ↙  |  Haz clic en las celdas para rellenarlas
          </div>
        </div>
      </div>

      {/* MODAL: SUCCESS */}
      {status === 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '2px solid #34d399', borderRadius: 20, padding: '32px 28px', textAlign: 'center', maxWidth: 360, width: '90%' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>🎉</div>
            <h2 style={{ color: '#34d399', margin: '0 0 8px', fontSize: '1.4rem' }}>¡Correcto!</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 18px' }}>{okMsg}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { setStatus(null); setScreen('menu'); }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, color: '#94a3b8', padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>← Menú</button>
              <button onClick={() => { const nxt = FIGURAS.find(f => f.id === fig.id + 1); nxt ? startFig(nxt) : setScreen('menu'); }} style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>Siguiente →</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST: ERROR */}
      {status === 'error' && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.92)', borderRadius: 12, padding: '11px 22px', color: '#fff', fontWeight: 700, zIndex: 200, whiteSpace: 'nowrap', fontSize: '0.9rem', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}>
          ❌ {MSGS_ERR[Math.floor(Math.random() * MSGS_ERR.length)]} · {'❤️'.repeat(lives)} restantes
        </div>
      )}

      {/* MODAL: GAME OVER */}
      {status === 'gameover' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '2px solid #ef4444', borderRadius: 20, padding: '32px 28px', textAlign: 'center', maxWidth: 340, width: '90%' }}>
            <div style={{ fontSize: '2.8rem' }}>💔</div>
            <h2 style={{ color: '#ef4444', margin: '8px 0' }}>Sin vidas</h2>
            <p style={{ color: '#94a3b8', marginBottom: 20 }}>¡No te rindas, inténtalo de nuevo!</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setScreen('menu')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, color: '#94a3b8', padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>← Menú</button>
              <button onClick={() => startFig(fig)} style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>Reintentar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
