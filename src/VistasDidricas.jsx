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
// ── Half-cube wedges ─────────────────────────────────────────────────────────
// The cut plane goes through (x,y,*) and (x+1,y+1,*) — in isometric this
// projects to a vertical screen-line, so the cut face is always a clean edge.

// 'fr' — front-right prism (keeps x+1 / y=y corner): top-right triangle visible
function WedgeFR({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1]], '#7dd3fc')}
      {face([[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]], '#1d4ed8')}
    </g>
  );
}
// 'bl' — back-left prism (keeps x=x / y+1 corner): top-left triangle visible
function WedgeBL({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z+1],[x,y+1,z+1],[x+1,y+1,z+1]], '#7dd3fc')}
      {face([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]], '#2563eb')}
    </g>
  );
}
// 'rx' — ramp: low at x, high at x+1 (slope rises rightward →)
function WedgeRX({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z]], '#93c5fd')}
      {face([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1]], '#2563eb')}
      {face([[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]], '#1d4ed8')}
    </g>
  );
}
// 'rxb' — ramp: high at x, low at x+1 (slope falls rightward →)
function WedgeRXback({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z+1],[x+1,y,z],[x+1,y+1,z],[x,y+1,z+1]], '#93c5fd')}
      {face([[x,y+1,z+1],[x,y+1,z],[x+1,y+1,z]], '#2563eb')}
    </g>
  );
}
// 'ry' — ramp: low at y, high at y+1 (slope rises backward ↑)
function WedgeRY({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z],[x,y+1,z]], '#93c5fd')}
      {face([[x+1,y,z],[x+1,y+1,z],[x+1,y,z+1]], '#1d4ed8')}
    </g>
  );
}
// 'ryb' — ramp: high at y, low at y+1 (slope falls backward)
function WedgeRYback({ x, y, z }) {
  return (
    <g>
      {face([[x,y,z+1],[x+1,y,z+1],[x+1,y,z],[x,y,z+1]], '#93c5fd')}
      {face([[x+1,y,z],[x+1,y+1,z],[x+1,y,z+1]], '#1d4ed8')}
      {face([[x,y+1,z],[x+1,y+1,z],[x+1,y,z],[x,y,z]], '#2563eb')}
    </g>
  );
}
const WEDGE_MAP = { fr: WedgeFR, bl: WedgeBL, rx: WedgeRX, rxb: WedgeRXback, ry: WedgeRY, ryb: WedgeRYback };

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

function IsoView({ cubes, wedges = [] }) {
  // Merge cubes ['c',x,y,z] and wedges [type,x,y,z], sort by painter's algorithm
  const allParts = [
    ...cubes.map(([x,y,z]) => ['c',x,y,z]),
    ...wedges.map(([x,y,z,t]) => [t,x,y,z]),
  ].sort((a,b) => (a[1]+a[2]) - (b[1]+b[2]) || a[3] - b[3]);
  const sorted = allParts; // renamed for clarity below

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

      {/* ── Cubes + Wedges ── */}
      {sorted.map(([t,x,y,z], i) => {
        if (t === 'c') return <Cube key={i} x={x} y={y} z={z} />;
        const W = WEDGE_MAP[t];
        return W ? <W key={i} x={x} y={y} z={z} /> : null;
      })}

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
// alzado: cols=X, rows=Z desc (row0=z_max, row3=z=0)
// planta: cols=X, rows=Y asc (row0=y=0 front)
// perfil: cols=Y, rows=Z desc
const FIGURAS = [
  // ── FIGURAS DE PRÁCTICA (diseño propio) ──────────────────────────────────
  {
    id: 1, nombre: 'El Escalón', emoji: '🪜', dif: 1,
    desc: 'Escalera de 3 peldaños vista desde el frente',
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
    cubes: [
      [0,0,0],[0,1,0],[0,0,1],[0,1,1],[0,0,2],[0,1,2],
      [2,0,0],[2,1,0],[2,0,1],[2,1,1],[2,0,2],[2,1,2],
      [1,0,0],[1,1,0],
    ],
    alzado: [[1,0,1,0],[1,0,1,0],[1,1,1,0],[0,0,0,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,0,0],[0,0,0,0]],
  },
  {
    id: 6, nombre: 'La L Grande', emoji: '📐', dif: 2,
    desc: 'Escalera que gira: baja en X y se prolonga en Y con altura',
    cubes: [
      [0,0,0],[0,0,1],[0,0,2],[1,0,0],[1,0,1],[2,0,0],
      [0,1,0],[0,1,1],[0,1,2],[0,2,0],
    ],
    alzado: [[1,0,0,0],[1,1,0,0],[1,1,1,0],[0,0,0,0]],
    planta:  [[1,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,1,0],[0,0,0,0]],
  },
  // ── FIGURAS DE LA FICHA PDF (figs 1-8) ───────────────────────────────────
  {
    // PDF fig 1 — symmetric U arch, open at top
    id: 7, nombre: 'PDF·1 Arco U', emoji: '🏟️', dif: 2,
    desc: 'Dos pilares sobre una base — abierto por arriba',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[2,0,1],[0,1,1],[2,1,1],
      [0,0,2],[2,0,2],[0,1,2],[2,1,2],
    ],
    alzado: [[0,0,0,0],[1,0,1,0],[1,0,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // PDF fig 2 — closed rectangular frame
    id: 8, nombre: 'PDF·2 El Marco', emoji: '🖼️', dif: 2,
    desc: 'Marco rectangular: base, dos pilares y dintel superior',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[2,0,1],[0,1,1],[2,1,1],
      [0,0,2],[2,0,2],[0,1,2],[2,1,2],
      [0,0,3],[1,0,3],[2,0,3],[0,1,3],[1,1,3],[2,1,3],
    ],
    alzado: [[1,1,1,0],[1,0,1,0],[1,0,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // PDF fig 3 — C shape
    id: 9, nombre: 'PDF·3 La C', emoji: '🌙', dif: 2,
    desc: 'Forma de C: barra inferior, pilar izquierdo y barra superior',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[0,1,1],
      [0,0,2],[1,0,2],[2,0,2],[0,1,2],[1,1,2],[2,1,2],
    ],
    alzado: [[0,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // PDF fig 4 — asymmetric U
    id: 10, nombre: 'PDF·4 U Asimétrica', emoji: '🫙', dif: 2,
    desc: 'Pilar izquierdo más alto que el derecho sobre base común',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[2,0,1],[0,1,1],[2,1,1],
      [0,0,2],[0,1,2],
    ],
    alzado: [[0,0,0,0],[1,0,0,0],[1,0,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // PDF fig 5 — stepped pyramid
    id: 11, nombre: 'PDF·5 Pirámide', emoji: '🗻', dif: 2,
    desc: 'Pirámide escalonada 3×2 → 2×2 → 1×2',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[1,0,1],[0,1,1],[1,1,1],
      [0,0,2],[0,1,2],
    ],
    alzado: [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // PDF fig 6 — L-staircase with diagonal ramp wedges
    id: 12, nombre: 'PDF·6 Escalera L-X', emoji: '↗️', dif: 3,
    desc: 'Escalera en L: sube hacia X y se extiende en Y',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],[2,1,0],[2,2,0],
      [0,0,1],[1,0,1],[2,0,1],[2,1,1],
      [0,0,2],[1,0,2],
    ],
    alzado: [[0,0,0,0],[1,1,0,0],[1,1,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[0,0,1,0],[0,0,1,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,1,0]],
  },
  {
    // PDF fig 7 — L-staircase in Y+X (rotated)
    id: 13, nombre: 'PDF·7 Escalera L-Y', emoji: '↙️', dif: 3,
    desc: 'Escalera en L: sube hacia Y y se extiende en X',
    cubes: [
      [0,0,0],[0,1,0],[0,2,0],[1,2,0],[2,2,0],
      [0,0,1],[0,1,1],[1,2,1],[2,2,1],
      [0,0,2],
    ],
    alzado: [[0,0,0,0],[1,0,0,0],[1,1,1,0],[1,1,1,0]],
    planta:  [[1,0,0,0],[1,0,0,0],[1,1,1,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,0,0,0],[1,1,1,0],[1,1,1,0]],
  },
  {
    // PDF fig 8 — corner stepped solid
    id: 14, nombre: 'PDF·8 El Rincón', emoji: '📦', dif: 3,
    desc: 'Sólido escalonado que envuelve la esquina delantera',
    cubes: [
      [0,0,0],[1,0,0],[0,1,0],[0,2,0],[1,2,0],
      [0,0,1],[1,0,1],[0,1,1],
      [0,0,2],
    ],
    alzado: [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,0,0]],
    planta:  [[1,1,0,0],[1,0,0,0],[1,1,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,1,0]],
  },
  // ── NUEVAS FIGURAS (15-20) ────────────────────────────────────────────────
  {
    // fig 15 — base 3×3 con mástil central
    id: 15, nombre: 'La Antena', emoji: '📡', dif: 3,
    desc: 'Base cuadrada 3×3 con mástil central de 3 niveles de altura',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],
      [0,1,0],[1,1,0],[2,1,0],
      [0,2,0],[1,2,0],[2,2,0],
      [1,1,1],[1,1,2],[1,1,3],
    ],
    alzado: [[0,1,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[1,1,1,0],[0,0,0,0]],
    perfil:  [[0,1,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
  },
  {
    // fig 16 — cruz plana con pilar central elevado
    id: 16, nombre: 'La Cruz Elevada', emoji: '✝️', dif: 3,
    desc: 'Cruz plana en + con pilar central que sube 2 niveles más',
    cubes: [
      [1,0,0],
      [0,1,0],[1,1,0],[2,1,0],
      [1,2,0],
      [1,1,1],[1,1,2],
    ],
    alzado: [[0,0,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
    planta:  [[0,1,0,0],[1,1,1,0],[0,1,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
  },
  {
    // fig 17 — canal en U ancho (4 unidades), paredes de 2 niveles
    id: 17, nombre: 'El Canal', emoji: '🌊', dif: 2,
    desc: 'Canal en U: dos paredes altas separadas por base de 2 unidades',
    cubes: [
      [0,0,0],[0,0,1],[0,1,0],[0,1,1],
      [1,0,0],[2,0,0],[1,1,0],[2,1,0],
      [3,0,0],[3,0,1],[3,1,0],[3,1,1],
    ],
    alzado: [[0,0,0,0],[0,0,0,0],[1,0,0,1],[1,1,1,1]],
    planta:  [[1,1,1,1],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[0,0,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // fig 18 — base en L con torre escalonada en esquina: perfil en escalera diagonal
    id: 18, nombre: 'El Rincón II', emoji: '🔩', dif: 3,
    desc: 'Base en L con torre que sube 3 niveles en la esquina delantera',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],
      [0,1,0],[0,2,0],
      [0,0,1],[0,1,1],
      [0,0,2],
    ],
    alzado: [[0,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
    perfil:  [[0,0,0,0],[1,0,0,0],[1,1,0,0],[1,1,1,0]],
  },
  {
    // fig 19 — base 3×2 con torre alta (4 niveles) en la esquina derecha
    id: 19, nombre: 'El Pedestal', emoji: '🏺', dif: 3,
    desc: 'Base de 3×2 con torre de 4 niveles en la esquina derecha',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],
      [0,1,0],[1,1,0],[2,1,0],
      [2,0,1],[2,1,1],[2,0,2],[2,1,2],[2,0,3],[2,1,3],
    ],
    alzado: [[0,0,1,0],[0,0,1,0],[0,0,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
  {
    // fig 20 — dos torres altas en extremos con base central: como una puerta
    id: 20, nombre: 'La Muralla', emoji: '🏰', dif: 4,
    desc: 'Dos torres de 4 niveles unidas por base — alzado en forma de portal',
    cubes: [
      [0,0,0],[1,0,0],[2,0,0],
      [0,1,0],[1,1,0],[2,1,0],
      [0,0,1],[2,0,1],[0,1,1],[2,1,1],
      [0,0,2],[2,0,2],[0,1,2],[2,1,2],
      [0,0,3],[2,0,3],[0,1,3],[2,1,3],
    ],
    alzado: [[1,0,1,0],[1,0,1,0],[1,0,1,0],[1,1,1,0]],
    planta:  [[1,1,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    perfil:  [[1,1,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
  },
];

const MSGS_OK  = ['¡Visión espacial perfecta!','¡Dominas el sistema diédrico!','¡Excelente trabajo!','¡Maestro del dibujo técnico!'];
const MSGS_ERR = ['Hay algo que no cuadra. ¡Revisa las proyecciones!','Casi… comprueba cada vista con calma.','¡Sigue intentándolo!'];

// ─── DIBUJO LIBRE ─────────────────────────────────────────────────────────────
// Malla de 64 vértices (4×4×4) — vértices de los 27 cubos del bloque 3×3×3
// Clic en punto A → seleccionado (amarillo) → clic en punto B → línea A-B
// Volver a clicar mismos puntos → borra la línea
function DibujoLibre({ onClose }) {
  const DU = 30, DCX = 210, DCY = 152;
  const isoD = (x, y, z) => ({
    x: DCX + (x - y) * DU * 0.866,
    y: DCY + (x + y) * DU * 0.5 - z * DU,
  });

  // 64 vértices: x,y,z ∈ {0,1,2,3}
  const VERTS = [];
  for (let z = 0; z <= 3; z++)
    for (let y = 0; y <= 3; y++)
      for (let x = 0; x <= 3; x++)
        VERTS.push([x, y, z]);

  const vkey = v => v.join(',');
  const lkey = (a, b) => {
    const ka = vkey(a), kb = vkey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  const [sel,   setSel]   = useState(null);
  const [lines, setLines] = useState([]); // array para poder deshacer

  const handleV = v => {
    if (!sel) { setSel(v); return; }
    if (vkey(sel) === vkey(v)) { setSel(null); return; }
    const k = lkey(sel, v);
    setLines(prev => prev.includes(k) ? prev.filter(l => l !== k) : [...prev, k]);
    setSel(null);
  };

  // Painter's algorithm: vértices del fondo (x+y alto) primero → quedan detrás
  const sorted = [...VERTS].sort((a, b) => (b[0]+b[1]) - (a[0]+a[1]) || a[2] - b[2]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e293b)', fontFamily: 'system-ui,sans-serif', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '7px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>← Volver</button>
        <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '1rem' }}>📐 Malla 4×4×4 — Dibujo Libre</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => { if (sel) setSel(null); else setLines(p => p.slice(0,-1)); }}
            style={{ background: 'rgba(245,158,11,0.18)', border: 'none', borderRadius: 8, color: '#fbbf24', padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>↩ Deshacer</button>
          <button onClick={() => { setLines([]); setSel(null); }}
            style={{ background: 'rgba(239,68,68,0.18)', border: 'none', borderRadius: 8, color: '#f87171', padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>🗑 Borrar</button>
        </div>
      </div>
      <div style={{ color: '#475569', fontSize: '0.73rem', marginBottom: 14 }}>
        1.º clic → punto amarillo (seleccionado) · 2.º clic → traza línea · mismo punto → cancela · clic en línea existente → la borra
        <span style={{ color: '#64748b' }}> · {lines.length} línea{lines.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={420} height={306}
          style={{ background: 'linear-gradient(135deg,#080d16,#0f172a)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', display: 'block' }}>
          {/* Líneas dibujadas */}
          {lines.map(k => {
            const [k1, k2] = k.split('|');
            const [x1,y1,z1] = k1.split(',').map(Number);
            const [x2,y2,z2] = k2.split(',').map(Number);
            const p1 = isoD(x1,y1,z1), p2 = isoD(x2,y2,z2);
            return (
              <line key={k}
                x1={p1.x.toFixed(1)} y1={p1.y.toFixed(1)}
                x2={p2.x.toFixed(1)} y2={p2.y.toFixed(1)}
                stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
            );
          })}
          {/* Vértices — fondo a frente */}
          {sorted.map(v => {
            const p  = isoD(v[0], v[1], v[2]);
            const is = sel && vkey(sel) === vkey(v);
            return (
              <circle key={vkey(v)}
                cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                r={is ? 7 : 4}
                fill={is ? '#fbbf24' : 'rgba(96,165,250,0.55)'}
                stroke={is ? '#f59e0b' : 'rgba(96,165,250,0.25)'}
                strokeWidth={is ? 2 : 1}
                onClick={() => handleV(v)}
                style={{ cursor: 'pointer' }} />
            );
          })}
        </svg>
      </div>
      <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.68rem', marginTop: 10 }}>
        64 vértices · malla 4×4×4 · vértices de los 27 cubos del bloque 3×3×3
      </p>
    </div>
  );
}

// ─── 2D LINE GRID ─────────────────────────────────────────────────────────────
// 4×4 vértices (16 puntos) en cuadrícula plana para proyecciones diédricas
function LineGrid2D({ label, color, lines, onChange, hasError }) {
  const CS = 24, N = 4, W = (N - 1) * CS;
  const vk = (c, r) => `${c},${r}`;
  const lk = (a, b) => { const ka = vk(...a), kb = vk(...b); return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
  const [sel, setSel] = useState(null);

  const tap = (c, r) => {
    if (!sel) { setSel([c, r]); return; }
    if (sel[0] === c && sel[1] === r) { setSel(null); return; }
    const k = lk(sel, [c, r]);
    onChange(lines.includes(k) ? lines.filter(l => l !== k) : [...lines, k]);
    setSel(null);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color, fontSize: '0.68rem', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{
        display: 'inline-block', padding: 8,
        background: hasError ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)',
        borderRadius: 10, border: `1.5px solid ${hasError ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
        transition: 'border-color 0.3s',
      }}>
        <svg width={W + 2} height={W + 2} style={{ display: 'block' }}>
          {Array.from({ length: N }, (_, i) => (
            <React.Fragment key={i}>
              <line x1={i*CS+1} y1={1} x2={i*CS+1} y2={W+1} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
              <line x1={1} y1={i*CS+1} x2={W+1} y2={i*CS+1} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
            </React.Fragment>
          ))}
          {lines.map(k => {
            const [k1, k2] = k.split('|');
            const [c1, r1] = k1.split(',').map(Number);
            const [c2, r2] = k2.split(',').map(Number);
            return <line key={k} x1={c1*CS+1} y1={r1*CS+1} x2={c2*CS+1} y2={r2*CS+1}
              stroke={color} strokeWidth="2.2" strokeLinecap="round" />;
          })}
          {Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => {
            const is = sel && sel[0] === c && sel[1] === r;
            return (
              <circle key={`${c},${r}`} cx={c*CS+1} cy={r*CS+1} r={is ? 6 : 3.5}
                fill={is ? '#fbbf24' : color} opacity={is ? 1 : 0.55}
                stroke={is ? '#f59e0b' : 'none'}
                onClick={() => tap(c, r)} style={{ cursor: 'pointer' }} />
            );
          }))}
        </svg>
      </div>
      <button onClick={() => { onChange([]); setSel(null); }} style={{
        display: 'block', margin: '3px auto 0', background: 'none', border: 'none',
        color: '#475569', fontSize: '0.65rem', cursor: 'pointer',
      }}>🗑 borrar</button>
    </div>
  );
}

// ─── ISO STATIC LINES ─────────────────────────────────────────────────────────
// Vista 3D estática que muestra líneas guardadas (para figuras tipo 'lines')
function IsoStaticLines({ lines = [] }) {
  return (
    <svg width={310} height={248} style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 12, display: 'block' }}>
      <FloorGrid />
      {lines.map(k => {
        const [k1, k2] = k.split('|');
        const [x1, y1, z1] = k1.split(',').map(Number);
        const [x2, y2, z2] = k2.split(',').map(Number);
        const p1 = iso(x1, y1, z1), p2 = iso(x2, y2, z2);
        return <line key={k} x1={p1.x.toFixed(1)} y1={p1.y.toFixed(1)}
          x2={p2.x.toFixed(1)} y2={p2.y.toFixed(1)}
          stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" />;
      })}
    </svg>
  );
}

// ─── FIGURA EDITOR ─────────────────────────────────────────────────────────────
// Editor para crear figuras nuevas: dibujo libre 3D + 3 cuadrículas de solución 2D
function FiguraEditor({ onClose, onSave }) {
  const [nombre, setNombre] = useState('');
  const [emoji,  setEmoji]  = useState('🔷');
  const [dif,    setDif]    = useState(3);
  const [desc,   setDesc]   = useState('');

  // 3D isometric free draw (reusa la misma lógica que DibujoLibre)
  const DU_E = 26, DCX_E = 175, DCY_E = 138;
  const isoE = (x, y, z) => ({ x: DCX_E + (x - y) * DU_E * 0.866, y: DCY_E + (x + y) * DU_E * 0.5 - z * DU_E });
  const VERTS_E = [];
  for (let z = 0; z <= 3; z++) for (let y = 0; y <= 3; y++) for (let x = 0; x <= 3; x++) VERTS_E.push([x, y, z]);
  const vk3 = v => v.join(',');
  const lk3 = (a, b) => { const ka = vk3(a), kb = vk3(b); return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
  const [isoSel,  setIsoSel]  = useState(null);
  const [isoLns,  setIsoLns]  = useState([]);
  const sortedE = [...VERTS_E].sort((a, b) => (b[0]+b[1])-(a[0]+a[1]) || a[2]-b[2]);
  const tapIso = v => {
    if (!isoSel) { setIsoSel(v); return; }
    if (vk3(isoSel) === vk3(v)) { setIsoSel(null); return; }
    const k = lk3(isoSel, v);
    setIsoLns(prev => prev.includes(k) ? prev.filter(l => l !== k) : [...prev, k]);
    setIsoSel(null);
  };

  // Cuadrículas de solución 2D
  const [alzLines, setAlzLines] = useState([]);
  const [pltLines, setPltLines] = useState([]);
  const [prfLines, setPrfLines] = useState([]);

  const handleSave = () => {
    if (!nombre.trim()) { alert('Escribe un nombre para la figura'); return; }
    onSave({
      id: Date.now(),
      nombre: nombre.trim(),
      emoji,
      dif: Number(dif),
      desc: desc.trim() || nombre.trim(),
      type: 'lines',
      isoLines:    isoLns,
      alzadoLines: alzLines,
      plantaLines: pltLines,
      perfilLines: prfLines,
    });
    onClose();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e293b)', fontFamily: 'system-ui,sans-serif', padding: '14px 16px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '7px 14px', cursor: 'pointer', fontSize: '0.88rem' }}>← Volver</button>
        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1rem' }}>✏️ Editor de Figuras</span>
        <button onClick={handleSave} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', borderRadius: 10, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>
          💾 Guardar figura
        </button>
      </div>

      {/* Campos del formulario */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '2 1 150px' }}>
          <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: 3 }}>Nombre</div>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej. La Cuña"
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '7px 10px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: '0 0 68px' }}>
          <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: 3 }}>Emoji</div>
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '7px 8px', fontSize: '1.2rem', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: '0 0 100px' }}>
          <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: 3 }}>Dificultad</div>
          <select value={dif} onChange={e => setDif(e.target.value)}
            style={{ width: '100%', background: 'rgba(30,41,59,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fbbf24', padding: '7px 6px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}>
            {[1,2,3,4].map(d => <option key={d} value={d}>{'⭐'.repeat(d)}</option>)}
          </select>
        </div>
        <div style={{ flex: '3 1 180px' }}>
          <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: 3 }}>Descripción</div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción breve..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '7px 10px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Área principal: 3D + cuadrículas 2D */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Vista 3D libre */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Vista 3D — Dibujo libre (referencia)
          </div>
          <svg width={350} height={276}
            style={{ background: 'linear-gradient(135deg,#080d16,#0f172a)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', display: 'block' }}>
            {isoLns.map(k => {
              const [k1, k2] = k.split('|');
              const [x1,y1,z1] = k1.split(',').map(Number), [x2,y2,z2] = k2.split(',').map(Number);
              const p1 = isoE(x1,y1,z1), p2 = isoE(x2,y2,z2);
              return <line key={k} x1={p1.x.toFixed(1)} y1={p1.y.toFixed(1)} x2={p2.x.toFixed(1)} y2={p2.y.toFixed(1)}
                stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />;
            })}
            {sortedE.map(v => {
              const p = isoE(v[0],v[1],v[2]);
              const is = isoSel && vk3(isoSel) === vk3(v);
              return <circle key={vk3(v)} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={is ? 7 : 4}
                fill={is ? '#fbbf24' : 'rgba(96,165,250,0.5)'}
                stroke={is ? '#f59e0b' : 'rgba(96,165,250,0.2)'} strokeWidth={is ? 2 : 1}
                onClick={() => tapIso(v)} style={{ cursor: 'pointer' }} />;
            })}
          </svg>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => { if (isoSel) setIsoSel(null); else setIsoLns(p => p.slice(0,-1)); }}
              style={{ flex: 1, background: 'rgba(245,158,11,0.15)', border: 'none', borderRadius: 7, color: '#fbbf24', padding: '5px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>↩ Deshacer</button>
            <button onClick={() => { setIsoLns([]); setIsoSel(null); }}
              style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 7, color: '#f87171', padding: '5px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>🗑 Borrar 3D</button>
          </div>
          <div style={{ color: '#334155', fontSize: '0.65rem', marginTop: 4, textAlign: 'center' }}>{isoLns.length} líneas 3D</div>
        </div>

        {/* Cuadrículas 2D de solución */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ color: '#a78bfa', fontSize: '0.68rem', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            Solución — Proyecciones 2D
          </div>
          <div style={{ color: '#475569', fontSize: '0.7rem', marginBottom: 12 }}>
            Dibuja las líneas que el alumno deberá reproducir
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <LineGrid2D label="Alzado (frontal)" color="#60a5fa" lines={alzLines} onChange={setAlzLines} />
            <LineGrid2D label="Perfil (lateral)"  color="#a78bfa" lines={prfLines} onChange={setPrfLines} />
            <LineGrid2D label="Planta (superior)" color="#34d399" lines={pltLines} onChange={setPltLines} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', alignItems: 'center', padding: 8 }}>
              <div style={{ color: '#334155', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.8 }}>
                {alzLines.length} líneas alzado<br/>
                {pltLines.length} líneas planta<br/>
                {prfLines.length} líneas perfil
              </div>
              <button onClick={() => { setAlzLines([]); setPltLines([]); setPrfLines([]); }}
                style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 8, color: '#f87171', padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>🗑 Borrar vistas</button>
            </div>
          </div>
        </div>
      </div>

      {/* Ayuda */}
      <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(167,139,250,0.07)', borderRadius: 10, border: '1px solid rgba(167,139,250,0.18)' }}>
        <div style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>💡 Cómo usar el editor</div>
        <div style={{ color: '#475569', fontSize: '0.7rem', lineHeight: 1.8 }}>
          1. Dibuja la figura en la Vista 3D (opcional — sirve de referencia visual en el quiz)<br/>
          2. En las 3 cuadrículas dibuja las proyecciones correctas — esas son las líneas que el alumno deberá reproducir<br/>
          3. Escribe un nombre y pulsa <strong style={{ color: '#a78bfa' }}>💾 Guardar figura</strong> — aparecerá en el menú principal
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function VistasDidricas({ onBack }) {
  const [screen,    setScreen]    = useState('menu');
  const [fig,       setFig]       = useState(null);
  const [grids,     setGrids]     = useState({ alzado: empty(), planta: empty(), perfil: empty() });
  const [lineGrids, setLineGrids] = useState({ alzado: [], planta: [], perfil: [] });
  const [lives,     setLives]     = useState(3);
  const [pts,       setPts]       = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [done,      setDone]      = useState(new Set());
  const [status,    setStatus]    = useState(null);
  const [errors,    setErrors]    = useState({ alzado: false, planta: false, perfil: false });
  const [hinted,    setHinted]    = useState(false);
  const [okMsg,     setOkMsg]     = useState('');

  // Figuras creadas por el usuario (persistidas en localStorage)
  const [userFigs, setUserFigs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vistas_user_figs') || '[]'); } catch { return []; }
  });
  const allFigs = [...FIGURAS, ...userFigs];

  const saveUserFig = (f) => {
    const next = [...userFigs, f];
    setUserFigs(next);
    localStorage.setItem('vistas_user_figs', JSON.stringify(next));
  };

  const deleteUserFig = (id) => {
    const next = userFigs.filter(f => f.id !== id);
    setUserFigs(next);
    localStorage.setItem('vistas_user_figs', JSON.stringify(next));
  };

  const startFig = (f) => {
    setFig(f);
    setGrids({ alzado: empty(), planta: empty(), perfil: empty() });
    setLineGrids({ alzado: [], planta: [], perfil: [] });
    setLives(3);
    setStatus(null);
    setErrors({ alzado: false, planta: false, perfil: false });
    setHinted(false);
    setScreen('game');
  };

  const setGrid     = (key, g) => setGrids(prev => ({ ...prev, [key]: g }));
  const setLineGrid = (key, v) => setLineGrids(prev => ({ ...prev, [key]: v }));

  const validate = () => {
    if (fig.type === 'lines') {
      const ok = key => {
        const correct = new Set(fig[key + 'Lines'] || []);
        const drawn   = new Set(lineGrids[key] || []);
        if (correct.size !== drawn.size) return false;
        for (const l of correct) if (!drawn.has(l)) return false;
        return true;
      };
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
      return;
    }
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
    if (fig.type === 'lines') {
      for (const key of ['alzado', 'planta', 'perfil']) {
        const correct = fig[key + 'Lines'] || [];
        const drawn   = new Set(lineGrids[key] || []);
        const missing = correct.filter(l => !drawn.has(l));
        if (missing.length) {
          const chosen = missing[Math.floor(Math.random() * missing.length)];
          setLineGrids(prev => ({ ...prev, [key]: [...(prev[key] || []), chosen] }));
          setHinted(true);
          return;
        }
      }
      return;
    }
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

  // ── EDITOR ──────────────────────────────────────────────────────────────────
  if (screen === 'editor') return <FiguraEditor onClose={() => setScreen('menu')} onSave={saveUserFig} />;

  // ── LIBRE ───────────────────────────────────────────────────────────────────
  if (screen === 'libre') return <DibujoLibre onClose={() => setScreen('menu')} />;

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
          <span style={{ color: '#34d399' }}>✅ {done.size}/{allFigs.length}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, maxWidth: 800, margin: '0 auto' }}>
        {allFigs.map(f => (
          <div key={f.id} style={{ position: 'relative' }}>
            <div onClick={() => startFig(f)} style={{
              background: done.has(f.id) ? 'rgba(52,211,153,0.08)' : f.type === 'lines' ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.04)',
              border: `2px solid ${done.has(f.id) ? '#34d399' : f.type === 'lines' ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14, padding: '18px 14px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {done.has(f.id) && <span style={{ position: 'absolute', top: 8, right: 10, color: '#34d399', fontSize: '1rem' }}>✓</span>}
              <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{f.emoji}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 2 }}>{f.type === 'lines' ? '✏️ custom' : `Figura ${f.id}`}</div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{f.nombre}</div>
              <div style={{ color: '#fbbf24', fontSize: '0.8rem' }}>{'⭐'.repeat(f.dif)}</div>
            </div>
            {f.type === 'lines' && (
              <button onClick={e => { e.stopPropagation(); if (confirm(`¿Borrar "${f.nombre}"?`)) deleteUserFig(f.id); }}
                style={{ position: 'absolute', top: 6, left: 8, background: 'rgba(239,68,68,0.25)', border: 'none', borderRadius: 6, color: '#f87171', width: 22, height: 22, cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Herramientas ── */}
      <div style={{ maxWidth: 800, margin: '24px auto 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div onClick={() => setScreen('editor')} style={{
          flex: '1 1 240px', background: 'rgba(167,139,250,0.07)', border: '2px solid rgba(167,139,250,0.25)',
          borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.14)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.07)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)'; }}>
          <div style={{ fontSize: '1.8rem' }}>✏️</div>
          <div>
            <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.95rem' }}>Editor de Figuras</div>
            <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: 2 }}>Crea figuras con dibujo libre · guarda en la librería</div>
          </div>
          <div style={{ marginLeft: 'auto', color: '#a78bfa', fontSize: '1.3rem' }}>→</div>
        </div>
        <div onClick={() => setScreen('libre')} style={{
          flex: '1 1 240px', background: 'rgba(96,165,250,0.07)', border: '2px solid rgba(96,165,250,0.25)',
          borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.14)'; e.currentTarget.style.borderColor = 'rgba(96,165,250,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.07)'; e.currentTarget.style.borderColor = 'rgba(96,165,250,0.25)'; }}>
          <div style={{ fontSize: '1.8rem' }}>📐</div>
          <div>
            <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.95rem' }}>Dibujo Libre — Malla 4×4×4</div>
            <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: 2 }}>64 vértices · une puntos con líneas libremente</div>
          </div>
          <div style={{ marginLeft: 'auto', color: '#60a5fa', fontSize: '1.3rem' }}>→</div>
        </div>
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
          {fig.type === 'lines'
            ? <IsoStaticLines lines={fig.isoLines || []} />
            : <IsoView cubes={fig.cubes} wedges={fig.wedges || []} />
          }
          <div style={{ color: '#475569', fontSize: '0.7rem', textAlign: 'center', marginTop: 5, lineHeight: 1.5 }}>
            {fig.type === 'lines'
              ? <span style={{ color: '#a78bfa' }}>Reproduce las 3 proyecciones dibujando líneas</span>
              : <><span>La flecha naranja indica la cara </span><span style={{ color: '#fb923c', fontWeight: 700 }}>FRONTAL</span><br/>
                 Ejes: <span style={{ color: '#f87171' }}>X →</span> ancho · <span style={{ color: '#4ade80' }}>Y →</span> profundidad · <span style={{ color: '#7dd3fc' }}>Z →</span> altura</>
            }
          </div>
        </div>

        {/* GRIDS + CONTROLS */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ color: '#a78bfa', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Proyecciones Diédricas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {fig.type === 'lines' ? <>
              <LineGrid2D label="Alzado (frontal)" color="#60a5fa" lines={lineGrids.alzado} onChange={v => setLineGrid('alzado', v)} hasError={errors.alzado} />
              <LineGrid2D label="Perfil (lateral)"  color="#a78bfa" lines={lineGrids.perfil} onChange={v => setLineGrid('perfil', v)} hasError={errors.perfil} />
              <LineGrid2D label="Planta (superior)" color="#34d399" lines={lineGrids.planta} onChange={v => setLineGrid('planta', v)} hasError={errors.planta} />
            </> : <>
              <GridView label="Alzado (frontal)" grid={grids.alzado} onChange={g => setGrid('alzado', g)} color="#60a5fa" hasError={errors.alzado} />
              <GridView label="Perfil (lateral)"  grid={grids.perfil} onChange={g => setGrid('perfil', g)} color="#a78bfa" hasError={errors.perfil} />
              <GridView label="Planta (superior)" grid={grids.planta} onChange={g => setGrid('planta', g)} color="#34d399" hasError={errors.planta} />
            </>}
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
            {fig.type === 'lines'
              ? 'Clic en punto A → clic en punto B → línea · mismos puntos → borra línea'
              : 'Alzado ↖ · Perfil ↗ · Planta ↙  |  Haz clic en las celdas para rellenarlas'
            }
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
