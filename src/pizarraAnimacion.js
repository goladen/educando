/*
 * Helpers de animación para la Pizarra (y el Animador de Lienzo).
 * Matemática pura de caminos: suavizado, muestreo por longitud de arco y
 * ángulo de avance estable. Sin dependencias de React ni del canvas.
 */

// Diferencia angular normalizada a (-π, π] para interpolar sin saltos.
export function difAngulo(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Muestrea un camino en u∈[0,1] devolviendo posición y ángulo de la tangente.
export function muestrearCamino(path, u) {
  if (!path || path.length < 2) return { x: path?.[0]?.x || 0, y: path?.[0]?.y || 0, ang: 0 };
  const segLen = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segLen.push(d); total += d;
  }
  if (total === 0) return { x: path[0].x, y: path[0].y, ang: 0 };
  const objetivo = Math.max(0, Math.min(1, u)) * total;
  let acum = 0;
  for (let i = 0; i < segLen.length; i++) {
    if (acum + segLen[i] >= objetivo || i === segLen.length - 1) {
      const t = segLen[i] === 0 ? 0 : (objetivo - acum) / segLen[i];
      const a = path[i], b = path[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    acum += segLen[i];
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y, ang: 0 };
}

// Suaviza el trazo a mano y lo remuestrea equiespaciado para que la dirección no vibre.
export function suavizarCamino(raw) {
  if (!raw || raw.length < 3) return raw ? raw.slice() : [];
  let pts = raw.slice();
  for (let pasada = 0; pasada < 2; pasada++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      out.push({
        x: (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4,
        y: (pts[i - 1].y + 2 * pts[i].y + pts[i + 1].y) / 4,
      });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (total === 0) return pts;
  const n = Math.max(2, Math.round(total / 4));
  const out = [];
  for (let k = 0; k <= n; k++) { const p = muestrearCamino(pts, k / n); out.push({ x: p.x, y: p.y }); }
  return out;
}

// Ángulo de avance en u con ventana de mirada-adelante (más estable que el segmento inmediato).
export function anguloEnCamino(path, u, du = 0.06) {
  let a, b;
  if (u + du <= 1) { a = muestrearCamino(path, u); b = muestrearCamino(path, u + du); }
  else { a = muestrearCamino(path, Math.max(0, u - du)); b = muestrearCamino(path, u); }
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Longitud total de un camino (para saber si merece la pena animar).
export function longitudCamino(path) {
  if (!path || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return total;
}
