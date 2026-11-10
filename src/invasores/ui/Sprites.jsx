// Sprites pixel-art originales (SVG nítido). 'X' = color principal, 'O' = blanco (ojos/luces).
import React, { memo } from 'react';

export const ALIENS = [
  // 0 · Ojón: un solo ojo enorme
  [
    ['...XXXXX...', '..XXXXXXX..', '.XXX...XXX.', '.XX..O..XX.', '.XXX...XXX.', '..XXXXXXX..', '.X.X.X.X.X.', 'X.X.....X.X'],
    ['...XXXXX...', '..XXXXXXX..', '.XXX...XXX.', '.XX.O...XX.', '.XXX...XXX.', '..XXXXXXX..', '.X.X.X.X.X.', '.X.X...X.X.'],
  ],
  // 1 · Medusa
  [
    ['....XXX....', '..XXXXXXX..', '.XXOXXXOXX.', '.XXXXXXXXX.', '..X.X.X.X..', '..X.X.X.X..', '.X..X.X..X.', 'X...X.X...X'],
    ['....XXX....', '..XXXXXXX..', '.XXOXXXOXX.', '.XXXXXXXXX.', '..X.X.X.X..', '.X..X.X..X.', '.X..X.X..X.', '..X.X.X.X..'],
  ],
  // 2 · Platillo con cúpula
  [
    ['....XXX....', '...XOOOX...', '.XXXXXXXXX.', 'XXOXXOXXOXX', '.XXXXXXXXX.', '..X..X..X..', '.X...X...X.', '...........'],
    ['....XXX....', '...XOOOX...', '.XXXXXXXXX.', 'XOXXOXXOXXX', '.XXXXXXXXX.', '..X..X..X..', '..X..X..X..', '...........'],
  ],
];

export const NAVE = ['......X......', '.....XXX.....', '.....XOX.....', '..X.XXXXX.X..', '.XXXXXXXXXXX.', 'XXXXXOXOXXXXX', 'XXX.XXXXX.XXX', 'X....X.X....X'];

/** Convierte la rejilla en rectángulos (fusiona píxeles seguidos de cada fila). */
function rects(grid) {
  const out = [];
  grid.forEach((fila, y) => {
    let x = 0;
    while (x < fila.length) {
      const c = fila[x];
      if (c === '.') { x++; continue; }
      let fin = x;
      while (fin + 1 < fila.length && fila[fin + 1] === c) fin++;
      out.push({ x, y, w: fin - x + 1, c });
      x = fin + 1;
    }
  });
  return out;
}
const CACHE = new Map();
const rectsCache = (grid) => {
  const k = grid.join('|');
  if (!CACHE.has(k)) CACHE.set(k, rects(grid));
  return CACHE.get(k);
};

export const PixelSprite = memo(function PixelSprite({ grid, color, blanco = '#f8fafc', className = '', style }) {
  const r = rectsCache(grid);
  return (
    <svg viewBox={`0 0 ${grid[0].length} ${grid.length}`} preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges"
      className={className} style={style} aria-hidden="true">
      {r.map((p, i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={1} fill={p.c === 'O' ? blanco : color} />)}
    </svg>
  );
});

// Índice siempre válido: con t negativo (cuenta atrás) o NaN, `x % n` daba -1/NaN → sprite undefined.
const idx = (v, n) => { const k = Math.trunc(Number(v)) || 0; return ((k % n) + n) % n; };

export const AlienSVG = ({ sprite = 0, frame = 0, color, className, style }) => (
  <PixelSprite grid={ALIENS[idx(sprite, ALIENS.length)][idx(frame, 2)]} color={color} className={className} style={style} />
);

export const NaveSVG = ({ color, className, style }) => (
  <PixelSprite grid={NAVE} color={color} blanco="#0f172a" className={className} style={style} />
);

export const Corazon = ({ lleno = true }) => (
  <PixelSprite grid={['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']}
    color={lleno ? '#f43f5e' : '#334155'} className="h-3 w-3.5 sm:h-3.5 sm:w-4" />
);
