// Matemáticas del GPS de clase: distancia a partir del tiempo (sonido) o de la intensidad (radio)
// y posición por trilateración (intersección de circunferencias). Coordenadas en metros sobre el
// suelo de la sala: x a lo ancho, y a lo largo, origen en una esquina.

export const VEL_SONIDO = 343; // m/s a ~20 °C

/** Velocidad del sonido en el aire según la temperatura (°C). */
export const velocidadSonido = (temp = 20) => 331.3 + 0.606 * temp;

/** Retraso del sonido (µs) → distancia (m), descontando el retraso fijo de las placas. */
export const distanciaDeSonido = (us, offsetUs = 0, v = VEL_SONIDO) => Math.max(0, ((us - offsetUs) * v) / 1e6);

/** Intensidad de radio (RSSI, dBm) → distancia (m) con el modelo de pérdida en el espacio libre. */
export const distanciaDeRssi = (rssi, rssi1m = -50, n = 2.5) => 10 ** ((rssi1m - rssi) / (10 * n));

export const mediana = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Puntos de corte de dos circunferencias (0, 1 o 2). Si no se cortan, el punto más probable entre ellas. */
export function cortarCircunferencias(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  if (d < 1e-9) return { puntos: [], seCortan: false };
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const ux = (c2.x - c1.x) / d, uy = (c2.y - c1.y) / d;
  const px = c1.x + a * ux, py = c1.y + a * uy;
  if (h2 < 0) {
    // No se cortan (medidas con error): punto de la recta entre centros que reparte el error
    const t = (r1 + (d - r1 - r2) / 2) / d;
    return { puntos: [{ x: c1.x + (c2.x - c1.x) * t, y: c1.y + (c2.y - c1.y) * t }], seCortan: false };
  }
  const h = Math.sqrt(h2);
  return { puntos: [{ x: px - h * uy, y: py + h * ux }, { x: px + h * uy, y: py - h * ux }], seCortan: true };
}

/**
 * Sistema lineal de la trilateración con 3 satélites: se restan las ecuaciones de las circunferencias
 * (x − xi)² + (y − yi)² = di² de dos en dos y desaparecen x² e y²:
 *   2(x2 − x1)x + 2(y2 − y1)y = d1² − d2² − x1² + x2² − y1² + y2²
 *   2(x3 − x1)x + 2(y3 − y1)y = d1² − d3² − x1² + x3² − y1² + y3²
 * Devuelve los coeficientes y la solución por Cramer (null si los satélites están alineados).
 */
export function sistemaLineal(s, d) {
  const [p1, p2, p3] = s;
  const a = 2 * (p2.x - p1.x), b = 2 * (p2.y - p1.y);
  const c = d[0] ** 2 - d[1] ** 2 - p1.x ** 2 + p2.x ** 2 - p1.y ** 2 + p2.y ** 2;
  const e = 2 * (p3.x - p1.x), f = 2 * (p3.y - p1.y);
  const g = d[0] ** 2 - d[2] ** 2 - p1.x ** 2 + p3.x ** 2 - p1.y ** 2 + p3.y ** 2;
  const det = a * f - b * e;
  if (Math.abs(det) < 1e-6) return { a, b, c, e, f, g, det, punto: null };
  return { a, b, c, e, f, g, det, punto: { x: (c * f - b * g) / det, y: (a * g - c * e) / det } };
}

// Mínimos cuadrados (Gauss-Newton): el punto que mejor cumple todas las distancias a la vez
function ajustar(s, d, inicio) {
  let { x, y } = inicio;
  for (let it = 0; it < 40; it++) {
    let h11 = 0, h12 = 0, h22 = 0, g1 = 0, g2 = 0;
    s.forEach((p, i) => {
      const r = Math.hypot(x - p.x, y - p.y) || 1e-6;
      const jx = (x - p.x) / r, jy = (y - p.y) / r, res = r - d[i];
      h11 += jx * jx; h12 += jx * jy; h22 += jy * jy; g1 += jx * res; g2 += jy * res;
    });
    const det = h11 * h22 - h12 * h12;
    if (Math.abs(det) < 1e-12) break;
    const dx = (h22 * g1 - h12 * g2) / det, dy = (h11 * g2 - h12 * g1) / det;
    x -= dx; y -= dy;
    if (Math.hypot(dx, dy) < 1e-6) break;
  }
  return { x, y };
}

/**
 * Posición a partir de los satélites [{x, y}] y las distancias medidas (null = sin medida).
 * dentro(p) opcional: con 2 satélites elige el punto de corte que cae dentro de la sala.
 * Devuelve { punto, error (m, error medio de las distancias), usados, sistema?, cortes? } o null.
 */
export function trilaterar(satelites, distancias, dentro = () => true) {
  const idx = distancias.map((d, i) => (d != null && Number.isFinite(d) ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return null;
  const s = idx.map((i) => satelites[i]), d = idx.map((i) => distancias[i]);
  let punto, sistema = null, cortes = null;
  if (s.length === 2) {
    cortes = cortarCircunferencias(s[0], d[0], s[1], d[1]);
    punto = cortes.puntos.find(dentro) || cortes.puntos[0];
  } else {
    sistema = sistemaLineal(s, d);
    const centro = { x: s.reduce((a, p) => a + p.x, 0) / s.length, y: s.reduce((a, p) => a + p.y, 0) / s.length };
    punto = ajustar(s, d, sistema.punto || centro);
  }
  if (!punto) return null;
  const error = s.reduce((a, p, i) => a + Math.abs(dist(punto, p) - d[i]), 0) / s.length;
  return { punto, error, usados: idx, sistema, cortes };
}

/** Ruido gaussiano (para simular medidas reales). */
export const ruido = (sigma) => {
  const u = 1 - Math.random(), v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Formato con coma decimal. */
export const fmt = (x, dec = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(dec).replace('.', ',').replace(/^-/, '−'));
