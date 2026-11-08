// 🗺️ Misiones del mBot2 dirigidas desde el ordenador (y su simulador).
// Es la MISMA lógica que los programas autónomos de programasMapa.js (rejilla, medir, Dijkstra…),
// escrita como generadores: cada misión pide acciones al robot ({ t: 'girar' | 'avanzar' | 'medir' |
// 'yaw' | 'resetYaw' | 'tiempo' | 'sembrar' }) y recibe el resultado. Quien ejecuta las acciones puede
// ser el robot simulado (este archivo) o el real (cyberpiMbot.js: Bluetooth, cable o 2 CyberPi).
//
// Misiones: explorar (mapear como una Roomba), irA (ir a un punto con replanificación) y sembrar
// (tractor de siembra: recorre todo un campo en surcos de ida y vuelta, rodeando los obstáculos).

export const CELDA = 30; // cm
export const N = 41;
export const O = 20; // la base está en el centro de la rejilla
export const MAXR = 150;
export const SENSOR = 6; // el sensor va 6 cm por delante del centro del robot
export const DX = [0, 1, 0, -1];
export const DY = [1, 0, -1, 0];
export const idx = (a, b) => b * N + a;
export const dentro = (a, b) => a > 0 && a < N - 1 && b > 0 && b < N - 1;

/** Estado de una misión: mapa (g), celdas escaneadas o pisadas (vis), sembradas (cub) y la pose creída. */
export function nuevoEstado({ zona = null, obstaculos = null } = {}) {
  const m = {
    g: new Uint8Array(N * N), vis: new Uint8Array(N * N), cub: new Uint8Array(N * N),
    zona, x: O, y: O, r: 0, signo: 0, yaw0: 0, plan: [], ultimaD: null, destino: null,
    pasos: 0, giros: 0, bloqueos: 0, texto: '', registro: [],
  };
  if (zona) for (let i = 0; i < N * N; i++) if (zona[i]) m.g[i] = 4; // el campo programado se da por libre
  if (obstaculos) for (let i = 0; i < N * N; i++) if (obstaculos[i]) m.g[i] = 9;
  m.g[idx(O, O)] = Math.min(m.g[idx(O, O)] || 4, 4);
  return m;
}

export const libre = (m, i) => m.g[i] > 0 && m.g[i] < 6;
const permitida = (m, i) => !m.zona || m.zona[i] || i === idx(O, O);
const apuntar = (m, txt) => { m.texto = txt; m.registro = [txt, ...m.registro].slice(0, 40); };

function marcar(m, a, b, occ) {
  if (!dentro(a, b)) return;
  const i = idx(a, b), v = m.g[i];
  m.g[i] = occ ? (v === 0 ? 7 : Math.min(9, v + 3)) : (v === 0 ? 4 : Math.max(1, v - 1));
}

function cerca(m, i) {
  for (const dd of [1, -1, N, -N, N + 1, N - 1, 1 - N, -1 - N]) if (m.g[i + dd] >= 6) return true;
  return false;
}

/** Dijkstra por cubos (como en el robot): direcciones hasta la primera celda que cumple meta, o null. */
export function buscar(m, meta, desc) {
  const ini = idx(m.x, m.y);
  const de = new Uint8Array(N * N);
  const dist = new Int32Array(N * N).fill(1e9);
  dist[ini] = 0;
  const cubos = [[ini]];
  for (let cd = 0; cd < cubos.length; cd++) {
    for (const i0 of cubos[cd] || []) {
      let i = i0;
      if (dist[i] !== cd) continue;
      if (i !== ini && meta(i)) {
        const ruta = [];
        while (i !== ini) { const k = de[i] - 1; ruta.push(k); i -= DX[k] + DY[k] * N; }
        return ruta.reverse();
      }
      const a = i % N, b = Math.floor(i / N);
      for (const k of [m.r, (m.r + 1) % 4, (m.r + 3) % 4, (m.r + 2) % 4]) {
        const na = a + DX[k], nb = b + DY[k];
        if (!dentro(na, nb)) continue;
        const ni = idx(na, nb), v = m.g[ni];
        if (!permitida(m, ni)) continue;
        if (v >= 6 || (v === 0 && !desc && !meta(ni))) continue;
        const nd = cd + (cerca(m, ni) ? 3 : 1);
        if (nd < dist[ni]) {
          dist[ni] = nd; de[ni] = k + 1;
          while (cubos.length <= nd) cubos.push([]);
          cubos[nd].push(ni);
        }
      }
    }
  }
  return null;
}

/** Celdas por las que pasa una ruta (para dibujarla). */
function trazar(m, ruta) {
  const p = []; let a = m.x, b = m.y;
  for (const k of ruta) { a += DX[k]; b += DY[k]; p.push(idx(a, b)); }
  return p;
}

/* ── Acciones básicas (generadores) ── */

// Distancia desde el centro del robot. 0 = SIN LECTURA (sensor sin conectar, eco perdido o pegado a la
// pared): eso NO es «libre», es peligro. Se repite una vez; si sigue sin lectura, se cuenta y, si pasa
// muchas veces seguidas, la misión se para (mejor que ir a ciegas).
function* medir(m) {
  let d = 0;
  for (let intento = 0; intento < 2 && d <= 2; intento++) d = Math.round(Number(yield { t: 'medir' }) || 0);
  if (d > 2) {
    m.sinLectura = 0;
    if (d < 300) d += SENSOR;
  } else {
    d = 0;
    m.sinLectura = (m.sinLectura || 0) + 1;
    if (m.sinLectura >= 6) throw new Error('El sensor de ultrasonidos no da lecturas: comprueba que está conectado al CyberPi (puerto mBuild) y que nada lo tapa.');
  }
  m.ultimaD = d;
  return d;
}

// Celda en la que el robot ha visto algo de muy cerca: ocupada del todo (no se vuelve a intentar enseguida)
function bloquear(m, a, b) {
  if (dentro(a, b)) m.g[idx(a, b)] = 9;
}

function* observar(m) {
  const d = yield* medir(m);
  if (!d) return 0; // sin lectura: no se apunta nada
  const lejos = d >= 300 || d > MAXR;
  const alcance = lejos ? MAXR : d;
  for (let k = 1; k * CELDA + CELDA / 2 <= alcance && k * CELDA <= MAXR; k++) marcar(m, m.x + DX[m.r] * k, m.y + DY[m.r] * k, false);
  if (!lejos) { const k = Math.max(1, Math.floor((d + CELDA / 2) / CELDA)); marcar(m, m.x + DX[m.r] * k, m.y + DY[m.r] * k, true); }
  return d;
}

function* yaw() { return Number(yield { t: 'yaw' }) || 0; }

function* corregir(m) {
  if (!m.signo) return;
  let e = (((m.signo * ((yield* yaw()) - m.yaw0) - m.r * 90) % 360) + 360) % 360;
  if (e > 180) e -= 360;
  if (Math.abs(e) > 1 && Math.abs(e) < 45) yield { t: 'girar', grados: -Math.round(e) };
}

function* girarA(m, nr) {
  const dd = (((nr - m.r) % 4) + 4) % 4;
  if (!dd) return;
  yield { t: 'girar', grados: dd === 1 ? 90 : dd === 2 ? 180 : -90 };
  m.r = nr; m.giros++;
  yield* corregir(m);
}

/** Sentido del giroscopio: gira 90° a la derecha y vuelve. */
export function* calibrar(m) {
  yield { t: 'resetYaw' };
  const a = yield* yaw();
  yield { t: 'girar', grados: 90 };
  const b = yield* yaw();
  yield { t: 'girar', grados: -90 };
  const dif = (((b - a) % 360) + 360) % 360;
  m.signo = dif > 60 && dif < 120 ? 1 : dif > 240 && dif < 300 ? -1 : 0;
  m.yaw0 = yield* yaw();
  apuntar(m, m.signo ? '🧭 Giroscopio comprobado' : '⚠️ Sin giroscopio: los giros no se corrigen');
}

function* avanzar(m) {
  const nx = m.x + DX[m.r], ny = m.y + DY[m.r];
  const d = yield* observar(m);
  if (!d) { apuntar(m, '⚠️ Sin lectura del sensor: no avanzo'); return false; } // ni libre ni ocupada: se reintenta
  if (!dentro(nx, ny) || d < CELDA + 18) {
    bloquear(m, nx, ny);
    m.bloqueos++;
    apuntar(m, `🧱 Obstáculo a ${d} cm`);
    return false;
  }
  if (!libre(m, idx(nx, ny))) return false;
  // En dos mitades, midiendo en medio: si aparece algo que no se veía (una pata, una pared en ángulo),
  // vuelve al centro de la celda en vez de chocar
  const mitad = Math.floor(CELDA / 2);
  yield { t: 'avanzar', cm: mitad };
  const d2 = yield* medir(m);
  if (d2 < mitad + 18) {
    yield { t: 'avanzar', cm: -mitad };
    if (d2) { bloquear(m, nx, ny); m.bloqueos++; }
    apuntar(m, d2 ? `🧱 Algo a ${d2} cm a medio camino: vuelvo` : '⚠️ Sin lectura a medio camino: vuelvo');
    return false;
  }
  yield { t: 'avanzar', cm: CELDA - mitad };
  m.x = nx; m.y = ny; m.pasos++;
  marcar(m, m.x, m.y, false);
  const i = idx(m.x, m.y);
  if (!m.vis[i]) m.vis[i] = 2;
  return true;
}

export function* irA(m, meta, { maxFallos = 80, texto = '🧭 En camino' } = {}) {
  let fallos = 0;
  while (!meta(idx(m.x, m.y))) {
    const ruta = buscar(m, meta, false) || buscar(m, meta, true);
    if (!ruta) { m.plan = []; return false; }
    m.plan = trazar(m, ruta);
    m.texto = texto;
    yield* girarA(m, ruta[0]);
    if (!(yield* avanzar(m)) && ++fallos > maxFallos) return false;
  }
  m.plan = [];
  return true;
}

function* volverABase(m) {
  apuntar(m, '🏠 Volviendo a la base');
  const casa = idx(O, O);
  const ok = yield* irA(m, (i) => i === casa, { texto: '🏠 Volviendo a la base' });
  if (ok) { yield* girarA(m, 0); apuntar(m, '✅ En la base'); } else apuntar(m, '❌ No encuentro el camino a la base');
  return ok;
}

/* ── Misiones ── */

const frontera = (m, i) => {
  if (!libre(m, i) || !permitida(m, i)) return false;
  const a = i % N, b = Math.floor(i / N);
  for (let k = 0; k < 4; k++) if (dentro(a + DX[k], b + DY[k]) && m.g[i + DX[k] + DY[k] * N] === 0) return true;
  return false;
};
const falta = (m, k) => {
  for (const p of [1, 2]) { const a = m.x + DX[k] * p, b = m.y + DY[k] * p; if (dentro(a, b) && m.g[idx(a, b)] === 0) return true; }
  return false;
};

/** 🗺️ Explorar como una Roomba durante `segundos` y volver a la base. */
export function* explorar(m, { segundos = 300 } = {}) {
  apuntar(m, '🧭 Calibrando el giro');
  yield* calibrar(m);
  const t0 = Number(yield { t: 'tiempo' });
  marcar(m, m.x, m.y, false);
  apuntar(m, '🗺️ Explorando');
  while (Number(yield { t: 'tiempo' }) - t0 < segundos * 1000) {
    const i = idx(m.x, m.y);
    if (m.vis[i] !== 1) {
      m.vis[i] = 1;
      marcar(m, m.x, m.y, false);
      const r0 = m.r;
      for (let t = 0; t < 4; t++) { const k = (r0 + t) % 4; if (falta(m, k)) { yield* girarA(m, k); yield* observar(m); } }
    }
    const ruta = buscar(m, (j) => frontera(m, j), false);
    if (!ruta) { apuntar(m, '✅ Ya no queda nada por explorar'); break; }
    m.plan = trazar(m, ruta);
    m.texto = '🗺️ Explorando';
    yield* girarA(m, ruta[0]);
    yield* avanzar(m);
  }
  m.plan = [];
  return yield* volverABase(m);
}

/** 🧭 Ir a la celda `destino` y volver a la base. */
export function* irYVolver(m, destino) {
  apuntar(m, '🧭 Calibrando el giro');
  yield* calibrar(m);
  m.destino = destino;
  apuntar(m, '🧭 Yendo al destino');
  const ok = yield* irA(m, (i) => i === destino);
  apuntar(m, ok ? '📍 ¡He llegado!' : '❌ No encuentro camino al destino');
  if (ok) yield { t: 'sembrar' }; // pitido de llegada
  m.destino = null;
  return yield* volverABase(m);
}

/**
 * Surcos del tractor: el campo por filas (de abajo arriba) y cada fila en sentido contrario a la
 * anterior (ida y vuelta, en zigzag). Devuelve el orden de las celdas.
 */
export function surcos(zona) {
  const filas = new Map();
  for (let i = 0; i < N * N; i++) if (zona[i]) { const b = Math.floor(i / N); if (!filas.has(b)) filas.set(b, []); filas.get(b).push(i % N); }
  const orden = [];
  [...filas.keys()].sort((a, b) => a - b).forEach((b, n) => {
    const xs = filas.get(b).sort((p, q) => p - q);
    (n % 2 ? xs.reverse() : xs).forEach((a) => orden.push(idx(a, b)));
  });
  return orden;
}

/** 🚜 Tractor de siembra: recorre todo el campo (m.zona) en surcos, rodeando los obstáculos. */
export function* sembrar(m) {
  apuntar(m, '🧭 Calibrando el giro');
  yield* calibrar(m);
  const orden = surcos(m.zona);
  const sembrarAqui = function* () {
    const i = idx(m.x, m.y);
    if (m.zona[i] && !m.cub[i]) { m.cub[i] = 1; yield { t: 'sembrar' }; }
  };
  yield* sembrarAqui();
  apuntar(m, '🚜 Sembrando');
  for (const t of orden) {
    if (m.cub[t] || m.g[t] >= 6) continue;
    let fallos = 0;
    while (idx(m.x, m.y) !== t && m.g[t] < 6) {
      const ruta = buscar(m, (i) => i === t, true);
      if (!ruta) break;
      m.plan = trazar(m, ruta);
      m.texto = '🚜 Sembrando';
      yield* girarA(m, ruta[0]);
      if (yield* avanzar(m)) yield* sembrarAqui();
      else if (++fallos > 20) break;
    }
  }
  m.plan = [];
  const hechas = orden.filter((i) => m.cub[i]).length, conObstaculo = orden.filter((i) => !m.cub[i] && m.g[i] >= 6).length;
  const posibles = orden.length - conObstaculo;
  apuntar(m, `🌱 Sembradas ${hechas} de ${posibles} celdas posibles (${Math.round((hechas / Math.max(1, posibles)) * 100)} %)${conObstaculo ? ` · ${conObstaculo} con obstáculo` : ''}`);
  return yield* volverABase(m);
}

/** Campo rectangular de ancho × largo metros con la base en la esquina de abajo a la izquierda. */
export function zonaRectangulo(anchoM, largoM) {
  const z = new Uint8Array(N * N);
  const w = Math.max(1, Math.round((anchoM * 100) / CELDA)), h = Math.max(1, Math.round((largoM * 100) / CELDA));
  for (let b = O; b < Math.min(N - 1, O + h); b++) for (let a = O; a < Math.min(N - 1, O + w); a++) z[idx(a, b)] = 1;
  return z;
}

/**
 * Ejecuta una misión con un ejecutor async (acción → resultado). `cancelado()` la para; `alPaso`
 * se llama tras cada acción. Devuelve { ok, error }.
 */
export async function ejecutarMision(gen, ejecutor, { cancelado = () => false, alPaso } = {}) {
  let res;
  try {
    for (;;) {
      if (cancelado()) return { ok: false, cancelada: true };
      const { value, done } = gen.next(res);
      if (done) return { ok: !!value };
      res = await ejecutor(value);
      alPaso?.(value, res);
    }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/* ═════════════════ Robot simulado ═════════════════ */

const R_ROBOT = 11;

/** Mundos del simulador (cm, y hacia arriba). base = donde empieza el robot, mirando hacia +y. */
export function crearMundo(tipo = 'aula', semilla = 1) {
  let s = semilla;
  const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  if (tipo === 'campo') {
    // Campo de 6 × 4,5 m con valla, dos árboles, una roca y una charca
    const W = 660, H = 510;
    const paredes = [[0, 0, W, 6], [0, H - 6, W, H], [0, 0, 6, H], [W - 6, 0, W, H]];
    const obst = [
      { r: [250 + azar() * 60, 220, 300 + azar() * 60, 270], tipo: 'arbol' },
      { r: [440, 330 + azar() * 40, 480, 370 + azar() * 40], tipo: 'arbol' },
      { r: [150, 380, 185, 410], tipo: 'roca' },
      { r: [480, 120, 570, 175], tipo: 'charca' },
    ];
    return { tipo, W, H, base: { x: 75, y: 75 }, rects: [...paredes, ...obst.map((o) => o.r)], obst, paredes };
  }
  const W = 700, H = 500;
  const paredes = [[0, 0, W, 5], [0, H - 5, W, H], [0, 0, 5, H], [W - 5, 0, W, H]];
  const obst = [
    { r: [200, 150, 320, 210], tipo: 'mesa' }, { r: [420, 150, 540, 210], tipo: 'mesa' },
    { r: [200, 320, 320, 380], tipo: 'mesa' }, { r: [420, 320, 540, 380], tipo: 'mesa' },
    { r: [600, 40, 640, 80], tipo: 'caja' }, { r: [90 + azar() * 20, 300, 130 + azar() * 20, 340], tipo: 'columna' },
  ];
  return { tipo, W, H, base: { x: 80, y: 80 }, rects: [...paredes, ...obst.map((o) => o.r)], obst, paredes };
}

export function crearRobotSim(mundo, { ruido = true } = {}) {
  return { x: mundo.base.x, y: mundo.base.y, h: 0, t: 0, choques: 0, error: ruido ? 1.025 : 1, ruido, rayo: null, sembradas: [] };
}

const choca = (mundo, px, py) => mundo.rects.some(([x0, y0, x1, y1]) => {
  const cx = Math.min(Math.max(px, x0), x1), cy = Math.min(Math.max(py, y0), y1);
  return (px - cx) ** 2 + (py - cy) ** 2 < R_ROBOT * R_ROBOT;
});

function rayo(mundo, rb) {
  if (rb.ruido && Math.random() < 0.1) return 0; // como el real: a veces el eco se pierde
  const h = (rb.h * Math.PI) / 180;
  const sx = rb.x + 6 * Math.sin(h), sy = rb.y + 6 * Math.cos(h);
  for (let d = 0; d < 300; d++) {
    for (const a of [-15, -8, 0, 8, 15]) {
      const hh = ((rb.h + a) * Math.PI) / 180, px = sx + d * Math.sin(hh), py = sy + d * Math.cos(hh);
      if (mundo.rects.some(([x0, y0, x1, y1]) => px >= x0 && px <= x1 && py >= y0 && py <= y1)) {
        return d < 4 ? 0 : Math.max(3, d + (rb.ruido ? (Math.random() - 0.5) * 3 : 0)); // pegado a la pared: sin lectura
      }
    }
  }
  return 300;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ejecutor del robot simulado, con animación: vel = rapidez (1 = tiempo real aproximado). */
export function ejecutorSim(mundo, rb, getVel) {
  return async (a) => {
    const vel = Math.max(0.25, getVel());
    switch (a.t) {
      case 'girar': {
        const total = a.grados * rb.error, pasos = Math.max(2, Math.round((Math.abs(a.grados) / 90) * (14 / vel)));
        for (let k = 0; k < pasos; k++) { rb.h = (rb.h + total / pasos + 360) % 360; await espera(16); }
        rb.t += (Math.abs(a.grados) / 90) * 900;
        return null;
      }
      case 'avanzar': {
        const h = (rb.h * Math.PI) / 180, pasos = Math.max(2, Math.round(20 / vel)), paso = a.cm / pasos;
        for (let k = 0; k < pasos; k++) {
          const nx = rb.x + paso * Math.sin(h), ny = rb.y + paso * Math.cos(h);
          if (choca(mundo, nx, ny)) { rb.choques++; break; }
          rb.x = nx; rb.y = ny;
          await espera(16);
        }
        rb.t += (1200 * Math.abs(a.cm)) / 30;
        return null;
      }
      case 'medir': {
        const d = rayo(mundo, rb);
        rb.rayo = { d, t: Date.now() };
        rb.t += 60;
        if (vel < 8) await espera(30 / vel);
        return d;
      }
      case 'yaw': return ((((-rb.h + 180) % 360) + 360) % 360) - 180; // giroscopio en sentido contrario, como algunos CyberPi
      case 'resetYaw': return null;
      case 'tiempo': return rb.t;
      case 'sembrar': rb.sembradas.push([rb.x, rb.y]); return null;
      default: return null;
    }
  };
}
