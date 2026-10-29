// Simulador 2D (vista cenital) del mBot2: tracción diferencial con las mismas
// potencias de rueda (-100…100) que se envían al robot real, retos sobre el
// suelo, colisiones y dibujo. Unidades del mundo: centímetros.

export const ANCHO_MUNDO = 300;
export const ALTO_MUNDO = 200;
const VMAX = 55; // cm/s con potencia 100
const VIA = 12; // distancia entre ruedas (cm)
const RADIO = 9.5; // radio de colisión del robot
const LARGO = 17;
const ANCHO = 13;
const RADIO_CONO = 4;

// ── Geometría ───────────────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function cruzan(p1, p2, p3, p4) {
  const d = (a, b, c) => (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function distSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distPolilinea(p, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) m = Math.min(m, distSegmento(p, pts[i], pts[(i + 1) % pts.length]));
  return m;
}

/** Esquinas del robot (para aparcar). */
export function esquinasRobot(r) {
  const c = Math.cos(r.th);
  const s = Math.sin(r.th);
  return [
    [LARGO / 2, ANCHO / 2],
    [LARGO / 2, -ANCHO / 2],
    [-LARGO / 2, ANCHO / 2],
    [-LARGO / 2, -ANCHO / 2],
  ].map(([a, b]) => ({ x: r.x + a * c - b * s, y: r.y + a * s + b * c }));
}

const dentro = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;

// Pseudoaleatorio con semilla (las estrellas cambian en cada intento pero de forma repetible).
function rng(semilla) {
  let s = semilla >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── Retos ───────────────────────────────────────────────────────────────────
const pared = (x, y, w, h) => ({ x, y, w, h });

function pistaLinea() {
  const pts = [];
  const N = 160;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    pts.push({
      x: 150 + 108 * Math.cos(t) + 14 * Math.cos(3 * t),
      y: 100 + 62 * Math.sin(t) + 16 * Math.sin(2 * t),
    });
  }
  return pts;
}

export const RETOS = [
  {
    id: 'libre',
    emoji: '🛝',
    nombre: 'Paseo libre',
    desc: 'Practica a conducir: avanza, retrocede y gira sin chocar con las cajas.',
  },
  {
    id: 'estrellas',
    emoji: '⭐',
    nombre: 'Recoge las estrellas',
    desc: 'Pasa por encima de las 8 estrellas lo más rápido que puedas.',
  },
  {
    id: 'puertas',
    emoji: '🚧',
    nombre: 'Puertas de conos',
    desc: 'Cruza las puertas en orden (1, 2, 3, 4). Tocar un cono suma 3 segundos.',
  },
  {
    id: 'linea',
    emoji: '〰️',
    nombre: 'Sigue la línea',
    desc: 'Da una vuelta completa al circuito sin salirte de la línea negra.',
  },
  {
    id: 'aparcar',
    emoji: '🅿️',
    nombre: 'Aparca en el garaje',
    desc: 'Esquiva los conos y deja el robot entero dentro del garaje, parado.',
  },
  {
    id: 'laberinto',
    emoji: '🧩',
    nombre: 'Laberinto',
    desc: 'Encuentra el camino hasta la bandera sin perderte.',
  },
];

/** Crea el mundo de un reto (estado mutable de la partida). */
export function crearMundo(id, semilla = Date.now()) {
  const m = {
    id,
    paredes: [],
    conos: [],
    estrellas: [],
    puertas: [],
    linea: null,
    meta: null,
    bandera: null,
    inicio: { x: 40, y: 100, th: 0 },
    siguiente: 0, // puerta / punto de control siguiente
    penalizacion: 0,
    fueraMs: 0,
    totalMs: 0,
    paradoMs: 0,
    completado: false,
  };
  if (id === 'libre') {
    m.paredes.push(pared(120, 40, 30, 30), pared(200, 120, 40, 25), pared(90, 140, 25, 25));
    m.conos.push({ x: 180, y: 60 }, { x: 240, y: 60 }, { x: 160, y: 110 });
  } else if (id === 'estrellas') {
    const r = rng(semilla);
    while (m.estrellas.length < 8) {
      const p = { x: 25 + r() * (ANCHO_MUNDO - 50), y: 25 + r() * (ALTO_MUNDO - 50), cogida: false };
      if (Math.hypot(p.x - m.inicio.x, p.y - m.inicio.y) < 40) continue;
      if (m.estrellas.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 40)) continue;
      m.estrellas.push(p);
    }
  } else if (id === 'puertas') {
    m.inicio = { x: 30, y: 170, th: -Math.PI / 2 };
    const defs = [
      { cx: 60, cy: 55, ang: 0 }, // línea de la puerta horizontal → se cruza en vertical
      { cx: 170, cy: 45, ang: Math.PI / 2 },
      { cx: 255, cy: 120, ang: 0 },
      { cx: 140, cy: 150, ang: Math.PI / 2 },
    ];
    const A = 17;
    defs.forEach((d) => {
      const a = { x: d.cx - A * Math.cos(d.ang), y: d.cy - A * Math.sin(d.ang) };
      const b = { x: d.cx + A * Math.cos(d.ang), y: d.cy + A * Math.sin(d.ang) };
      m.puertas.push({ a, b, cx: d.cx, cy: d.cy });
      m.conos.push(a, b);
    });
    m.conos.push({ x: 115, y: 100 }, { x: 205, y: 100 }, { x: 210, y: 170 });
  } else if (id === 'linea') {
    m.linea = pistaLinea();
    const p0 = m.linea[0];
    const p1 = m.linea[1];
    m.inicio = { x: p0.x, y: p0.y, th: Math.atan2(p1.y - p0.y, p1.x - p0.x) };
    // 8 puntos de control repartidos; el 0 (salida) es el último.
    m.controles = Array.from({ length: 8 }, (_, i) => Math.round((i * m.linea.length) / 8));
    m.siguiente = 1;
  } else if (id === 'aparcar') {
    m.paredes.push(pared(232, 76, 60, 4), pared(232, 120, 60, 4), pared(288, 76, 4, 48));
    m.meta = { x: 244, y: 80, w: 44, h: 40 };
    m.conos.push({ x: 120, y: 70 }, { x: 120, y: 130 }, { x: 175, y: 100 }, { x: 175, y: 40 }, { x: 175, y: 160 });
  } else if (id === 'laberinto') {
    m.inicio = { x: 30, y: 30, th: Math.PI / 2 };
    m.paredes.push(pared(60, 0, 4, 140), pared(120, 60, 4, 140), pared(180, 0, 4, 140), pared(240, 60, 4, 140));
    m.meta = { x: 252, y: 150, w: 40, h: 42 };
    m.bandera = { x: 272, y: 171 };
  }
  return m;
}

export function crearRobot(m) {
  return { ...m.inicio, vl: 0, vr: 0, dl: 0, dr: 0, rastro: [{ x: m.inicio.x, y: m.inicio.y }], choque: 0 };
}

// ── Física ──────────────────────────────────────────────────────────────────
function resolverColisiones(r, m) {
  let choco = false;
  // Bordes del suelo
  const bx = clamp(r.x, RADIO, ANCHO_MUNDO - RADIO);
  const by = clamp(r.y, RADIO, ALTO_MUNDO - RADIO);
  if (bx !== r.x || by !== r.y) choco = true;
  r.x = bx;
  r.y = by;
  for (const w of m.paredes) {
    const cx = clamp(r.x, w.x, w.x + w.w);
    const cy = clamp(r.y, w.y, w.y + w.h);
    const dx = r.x - cx;
    const dy = r.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < RADIO) {
      choco = true;
      if (d > 1e-6) {
        r.x = cx + (dx / d) * RADIO;
        r.y = cy + (dy / d) * RADIO;
      } else {
        r.x -= Math.cos(r.th) * 1;
        r.y -= Math.sin(r.th) * 1;
      }
    }
  }
  const conosTocados = [];
  m.conos.forEach((c, i) => {
    const dx = r.x - c.x;
    const dy = r.y - c.y;
    const d = Math.hypot(dx, dy);
    const min = RADIO + RADIO_CONO;
    if (d < min && d > 1e-6) {
      r.x = c.x + (dx / d) * min;
      r.y = c.y + (dy / d) * min;
      conosTocados.push(i);
      choco = true;
    }
  });
  return { choco, conosTocados };
}

/**
 * Avanza la simulación. `izq`/`der` = potencias -100…100. Devuelve eventos
 * { choque, cono, estrella, puerta, control, completado } para sonidos y avisos.
 */
export function paso(r, m, izq, der, dt) {
  const ev = {};
  const k = Math.min(1, dt / 0.12); // inercia de los motores
  r.vl += ((izq / 100) * VMAX - r.vl) * k;
  r.vr += ((der / 100) * VMAX - r.vr) * k;
  const v = (r.vl + r.vr) / 2;
  const w = (r.vl - r.vr) / VIA; // y hacia abajo → positivo = giro horario (a la derecha)
  const antes = { x: r.x, y: r.y };
  r.th += w * dt;
  r.x += v * Math.cos(r.th) * dt;
  r.y += v * Math.sin(r.th) * dt;
  r.dl += r.vl * dt;
  r.dr += r.vr * dt;
  const { choco, conosTocados } = resolverColisiones(r, m);
  if (choco && Math.abs(v) > 5 && performance.now() - r.choque > 600) {
    r.choque = performance.now();
    ev.choque = true;
  }
  const ultimo = r.rastro[r.rastro.length - 1];
  if (Math.hypot(r.x - ultimo.x, r.y - ultimo.y) > 2) {
    r.rastro.push({ x: r.x, y: r.y });
    if (r.rastro.length > 1500) r.rastro.shift();
  }
  if (m.completado) return ev;

  const enMarcha = m.totalMs > 0 || Math.abs(v) > 1 || Math.abs(w) > 0.05;
  if (enMarcha) m.totalMs += dt * 1000;

  // Conos (en el reto de puertas cuentan como penalización)
  if (m.id === 'puertas' && conosTocados.length) {
    const ahora = performance.now();
    m.ultimoCono = m.ultimoCono || {};
    conosTocados.forEach((i) => {
      if (!m.ultimoCono[i] || ahora - m.ultimoCono[i] > 1500) {
        m.ultimoCono[i] = ahora;
        m.penalizacion += 3000;
        ev.cono = true;
      }
    });
  }

  if (m.id === 'estrellas') {
    m.estrellas.forEach((e) => {
      if (!e.cogida && Math.hypot(e.x - r.x, e.y - r.y) < RADIO + 5) {
        e.cogida = true;
        ev.estrella = true;
      }
    });
    if (m.estrellas.every((e) => e.cogida)) m.completado = true;
  } else if (m.id === 'puertas') {
    const p = m.puertas[m.siguiente];
    if (p && cruzan(antes, r, p.a, p.b)) {
      m.siguiente++;
      ev.puerta = true;
      if (m.siguiente >= m.puertas.length) m.completado = true;
    }
  } else if (m.id === 'linea') {
    if (enMarcha && distPolilinea(r, m.linea) > 7) m.fueraMs += dt * 1000;
    const objetivo = m.linea[m.controles[m.siguiente % m.controles.length]];
    if (Math.hypot(objetivo.x - r.x, objetivo.y - r.y) < 16) {
      ev.control = true;
      if (m.siguiente === m.controles.length) m.completado = true;
      else m.siguiente++;
    }
  } else if (m.id === 'aparcar' || m.id === 'laberinto') {
    const lento = Math.abs(v) < 2 && Math.abs(w) < 0.2;
    const zonaOk = m.id === 'aparcar' ? esquinasRobot(r).every((p) => dentro(p, m.meta)) : dentro(r, m.meta);
    if (zonaOk && (m.id === 'laberinto' || lento)) m.paradoMs += dt * 1000;
    else m.paradoMs = 0;
    if (m.paradoMs > (m.id === 'aparcar' ? 1200 : 0)) m.completado = true;
  }
  if (m.completado) ev.completado = true;
  return ev;
}

/** Tiempo final en ms (con penalizaciones; en la línea, 1 s por cada segundo fuera). */
export const tiempoFinal = (m) => m.totalMs + m.penalizacion + (m.id === 'linea' ? m.fueraMs : 0);

/** Distancia que mediría el sensor de ultrasonidos (cm, máx. 200). */
export function ultrasonidos(r, m) {
  const c = Math.cos(r.th);
  const s = Math.sin(r.th);
  for (let d = LARGO / 2; d < 200; d += 1) {
    const p = { x: r.x + c * d, y: r.y + s * d };
    if (p.x < 0 || p.y < 0 || p.x > ANCHO_MUNDO || p.y > ALTO_MUNDO) return Math.round(d - LARGO / 2);
    if (m.paredes.some((w) => dentro(p, w))) return Math.round(d - LARGO / 2);
    if (m.conos.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < RADIO_CONO)) return Math.round(d - LARGO / 2);
  }
  return 200;
}

// ── Dibujo ──────────────────────────────────────────────────────────────────
function estrella(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.closePath();
}

function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dibujarRobot(ctx, r, colorLed) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.th);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rectRedondo(ctx, -LARGO / 2 + 1, -ANCHO / 2 + 1.5, LARGO, ANCHO, 3);
  ctx.fill();
  // ruedas con dibujo de la cubierta que avanza
  const rueda = (yy, dist) => {
    ctx.save();
    ctx.translate(-2, yy);
    ctx.fillStyle = '#111827';
    rectRedondo(ctx, -3.5, -1.6, 7, 3.2, 1);
    ctx.fill();
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 0.5;
    const off = ((dist % 1.6) + 1.6) % 1.6;
    for (let x = -3.5 + off; x < 3.5; x += 1.6) {
      ctx.beginPath();
      ctx.moveTo(x, -1.6);
      ctx.lineTo(x, 1.6);
      ctx.stroke();
    }
    ctx.restore();
  };
  rueda(-ANCHO / 2 - 0.6, r.dl);
  rueda(ANCHO / 2 + 0.6, r.dr);
  // chasis azul
  const g = ctx.createLinearGradient(0, -ANCHO / 2, 0, ANCHO / 2);
  g.addColorStop(0, '#38bdf8');
  g.addColorStop(1, '#0369a1');
  ctx.fillStyle = g;
  rectRedondo(ctx, -LARGO / 2, -ANCHO / 2 + 1, LARGO, ANCHO - 2, 3);
  ctx.fill();
  ctx.strokeStyle = '#075985';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // sensor de ultrasonidos (los "ojos") delante
  ctx.fillStyle = '#1f2937';
  rectRedondo(ctx, LARGO / 2 - 3, -4.5, 3.5, 9, 1);
  ctx.fill();
  [-2.3, 2.3].forEach((yy) => {
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(LARGO / 2 - 1.2, yy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(LARGO / 2 - 1.2, yy, 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
  // CyberPi encima: placa con pantalla y anillo de LED
  ctx.fillStyle = '#f8fafc';
  rectRedondo(ctx, -6.5, -4, 8.5, 8, 1.5);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  rectRedondo(ctx, -5, -2.6, 5, 5.2, 0.8);
  ctx.fill();
  ctx.fillStyle = colorLed;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(1, -3 + i * 1.5, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Pinta el mundo en el canvas. `escala` = píxeles por cm.
 * `extras`: { colorLed, verRastro, verSensor, distancia }
 */
export function dibujar(ctx, m, r, escala, extras = {}) {
  const { colorLed = '#22c55e', verRastro = true, verSensor = false, distancia = 0 } = extras;
  ctx.save();
  ctx.scale(escala, escala);
  // suelo
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, ANCHO_MUNDO, ALTO_MUNDO);
  ctx.lineWidth = 0.25;
  for (let x = 0; x <= ANCHO_MUNDO; x += 10) {
    ctx.strokeStyle = x % 50 === 0 ? '#cbd5e1' : '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ALTO_MUNDO);
    ctx.stroke();
  }
  for (let y = 0; y <= ALTO_MUNDO; y += 10) {
    ctx.strokeStyle = y % 50 === 0 ? '#cbd5e1' : '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ANCHO_MUNDO, y);
    ctx.stroke();
  }

  // línea del circuito
  if (m.linea) {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    m.linea.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    m.controles.forEach((idx, i) => {
      const p = m.linea[idx];
      const pasado = i === 0 ? m.completado : i < m.siguiente;
      const toca = (m.siguiente % m.controles.length) === i && !m.completado;
      ctx.fillStyle = pasado ? '#22c55e' : toca ? '#f59e0b' : 'rgba(148,163,184,0.8)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, toca ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    const s = m.linea[0];
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 7px system-ui';
    ctx.fillText('SALIDA', s.x - 13, s.y - 8);
  }

  // zona de meta / garaje
  if (m.meta) {
    ctx.fillStyle = m.completado ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.15)';
    ctx.fillRect(m.meta.x, m.meta.y, m.meta.w, m.meta.h);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(m.meta.x, m.meta.y, m.meta.w, m.meta.h);
    ctx.setLineDash([]);
    if (m.id === 'aparcar') {
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText('P', m.meta.x + m.meta.w / 2 - 4.5, m.meta.y + m.meta.h / 2 + 5);
    }
  }
  if (m.bandera) {
    const b = m.bandera;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + 9);
    ctx.lineTo(b.x, b.y - 9);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 9);
    ctx.lineTo(b.x + 10, b.y - 5.5);
    ctx.lineTo(b.x, b.y - 2);
    ctx.fill();
  }

  // puertas
  m.puertas.forEach((p, i) => {
    const hecha = i < m.siguiente;
    const toca = i === m.siguiente;
    ctx.strokeStyle = hecha ? '#22c55e' : toca ? '#f59e0b' : 'rgba(100,116,139,0.5)';
    ctx.lineWidth = toca ? 1.4 : 0.8;
    ctx.setLineDash([2, 1.5]);
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.b.x, p.b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = hecha ? '#22c55e' : toca ? '#f59e0b' : '#64748b';
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), p.cx, p.cy + 2.2);
    ctx.textAlign = 'start';
  });

  // rastro
  if (verRastro && r.rastro.length > 1) {
    ctx.strokeStyle = 'rgba(14,165,233,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    r.rastro.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }

  // paredes
  m.paredes.forEach((w) => {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(w.x + 1, w.y + 1.5, w.w, w.h);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  });

  // conos (vistos desde arriba)
  m.conos.forEach((c) => {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(c.x + 0.8, c.y + 1.2, RADIO_CONO, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(c.x, c.y, RADIO_CONO, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(c.x, c.y, RADIO_CONO * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // estrellas
  const t = performance.now() / 300;
  m.estrellas.forEach((e, i) => {
    if (e.cogida) return;
    estrella(ctx, e.x, e.y, 5.5 + Math.sin(t + i) * 0.6);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  });

  // haz del ultrasonidos
  if (verSensor) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.th);
    const g = ctx.createLinearGradient(LARGO / 2, 0, LARGO / 2 + distancia, 0);
    g.addColorStop(0, 'rgba(250,204,21,0.45)');
    g.addColorStop(1, 'rgba(250,204,21,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(LARGO / 2, -2);
    ctx.lineTo(LARGO / 2 + distancia, -2 - distancia * 0.12);
    ctx.lineTo(LARGO / 2 + distancia, 2 + distancia * 0.12);
    ctx.lineTo(LARGO / 2, 2);
    ctx.fill();
    ctx.restore();
  }

  dibujarRobot(ctx, r, colorLed);
  ctx.restore();
}
