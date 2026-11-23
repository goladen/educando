// 📝 Corrector de exámenes: lectura óptica de una hoja de respuestas (sin IA).
//
// La hoja (A4 vertical) lleva un marcador ArUco en cada esquina (los mismos del
// detector de tarjetas: 61 arriba-izq., 62 arriba-der., 63 abajo-der., 64 abajo-izq.).
// Con sus esquinas se calcula la homografía milímetros → píxeles, así que la hoja
// puede estar torcida, en perspectiva o boca abajo. Cada círculo está siempre en el
// mismo sitio: se mide lo oscuro que está por dentro comparado con el papel de alrededor.
//
// Esta plantilla la usan a la vez el PDF (hojaPdf.js) y el lector: si se cambia una
// medida, cambian los dos.

export const HOJA = { W: 210, H: 297 };
export const MAX_PREGUNTAS = 50;
export const LETRAS = ['A', 'B', 'C', 'D', 'E'];

/** Marcadores de las esquinas: número de tarjeta (id + 1) y centro en mm. */
export const MARCAS = [
  { tarjeta: 61, x: 14, y: 14 },
  { tarjeta: 62, x: 196, y: 14 },
  { tarjeta: 63, x: 196, y: 283 },
  { tarjeta: 64, x: 14, y: 283 },
];
export const LADO_MARCA = 14; // mm (incluye el borde negro del marcador)
export const R = 2.8; // radio de los círculos (mm)

// Nº de lista: dos columnas (decenas, unidades) con los dígitos 0-9
export const ID = { xDecenas: 166, xUnidades: 178, y0: 40, paso: 7 };
// Respuestas: 3 columnas de 17 filas
export const RESP = { cols: [22, 85, 148], y0: 122, pasoY: 8, filas: 17, dx: 14, pasoX: 8 };

export const posId = (columna, digito) => ({ x: columna === 0 ? ID.xDecenas : ID.xUnidades, y: ID.y0 + digito * ID.paso });
export function posBurbuja(q, o) {
  const col = Math.floor(q / RESP.filas);
  const fila = q % RESP.filas;
  return { x: RESP.cols[col] + RESP.dx + o * RESP.pasoX, y: RESP.y0 + fila * RESP.pasoY };
}
export const posNumero = (q) => {
  const p = posBurbuja(q, 0);
  return { x: p.x - 5.5, y: p.y };
};

// ───────────────────────── Homografía ─────────────────────────

/** Resuelve A·x = b (Gauss con pivote parcial). */
function resolver(A, b) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let f = c + 1; f < n; f++) if (Math.abs(M[f][c]) > Math.abs(M[p][c])) p = f;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let f = 0; f < n; f++) {
      if (f === c) continue;
      const k = M[f][c] / M[c][c];
      for (let j = c; j <= n; j++) M[f][j] -= k * M[c][j];
    }
  }
  return M.map((fila, i) => fila[n] / fila[i]);
}

/**
 * Homografía por mínimos cuadrados con N ≥ 4 parejas { mm:{x,y}, px:{x,y} }.
 * Devuelve una función (x, y) en mm → { x, y } en píxeles, o null.
 */
export function homografia(parejas) {
  if (parejas.length < 4) return null;
  // Normalizar escalas para que el sistema esté bien condicionado
  const sm = 1 / 300;
  const sp = 1 / Math.max(...parejas.map((p) => Math.max(Math.abs(p.px.x), Math.abs(p.px.y))), 1);
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const Atb = new Array(8).fill(0);
  const sumar = (fila, v) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += fila[i] * v;
      for (let j = 0; j < 8; j++) AtA[i][j] += fila[i] * fila[j];
    }
  };
  for (const { mm, px } of parejas) {
    const x = mm.x * sm, y = mm.y * sm, u = px.x * sp, v = px.y * sp;
    sumar([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    sumar([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = resolver(AtA, Atb);
  if (!h || h.some((n) => !Number.isFinite(n))) return null;
  return (X, Y) => {
    const x = X * sm, y = Y * sm;
    const w = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / w / sp, y: (h[3] * x + h[4] * y + h[5]) / w / sp };
  };
}

/**
 * Parejas mm↔px a partir de los marcadores detectados (detectorTarjetas.crearDetector).
 * Las esquinas de cada marcador vienen ya en su orden propio (0 = arriba-izq. del marcador).
 */
export function parejasDeMarcas(detecciones) {
  const h = LADO_MARCA / 2;
  const esq = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const parejas = [];
  const vistas = [];
  for (const m of MARCAS) {
    const d = detecciones.find((x) => x.tarjeta === m.tarjeta);
    if (!d) continue;
    vistas.push(m.tarjeta);
    d.esquinas.forEach((p, i) => parejas.push({ mm: { x: m.x + esq[i][0], y: m.y + esq[i][1] }, px: p }));
  }
  return { parejas, vistas };
}

// ───────────────────────── Lectura ─────────────────────────

/** Imagen RGBA → gris (Uint8Array) */
export function aGris({ width, height, data }) {
  const g = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  return { width, height, data: g };
}

function muestra(gris, x, y) {
  const { width: w, height: h, data } = gris;
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return null;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + w] * (1 - fx) + data[i + w + 1] * fx) * fy;
}

// Puntos de muestreo en mm alrededor del centro: dentro del círculo y en el papel de alrededor
// Rejilla densa (cada 0,4 mm) dentro del 70 % del radio: así cuenta también una cruz o una raya
const DENTRO = [];
for (let dx = -0.7 * R; dx <= 0.7 * R + 1e-9; dx += 0.4) for (let dy = -0.7 * R; dy <= 0.7 * R + 1e-9; dy += 0.4) if (Math.hypot(dx, dy) <= 0.7 * R) DENTRO.push([dx, dy]);
const FUERA = [];
for (let k = 0; k < 12; k++) FUERA.push([1.43 * R * Math.cos((2 * Math.PI * k) / 12 + 0.26), 1.43 * R * Math.sin((2 * Math.PI * k) / 12 + 0.26)]);

/** Oscuridad de un círculo: 0 = como el papel, 1 = negro. null si cae fuera de la imagen. */
function oscuridad(gris, H, cx, cy) {
  let s = 0;
  for (const [dx, dy] of DENTRO) {
    const p = H(cx + dx, cy + dy);
    const v = muestra(gris, p.x, p.y);
    if (v === null) return null;
    s += v;
  }
  const dentro = s / DENTRO.length;
  const papel = [];
  for (const [dx, dy] of FUERA) {
    const p = H(cx + dx, cy + dy);
    const v = muestra(gris, p.x, p.y);
    if (v !== null) papel.push(v);
  }
  if (papel.length < 6) return null;
  papel.sort((a, b) => a - b);
  const blanco = Math.max(40, papel[Math.floor(papel.length * 0.75)]);
  return Math.max(0, Math.min(1, (blanco - dentro) / blanco));
}

/** Decide la marca de una fila de círculos: índice, -1 = en blanco, -2 = doble marca. */
// vacio: nivel de un círculo sin marcar. Una marca floja (una cruz, lápiz muy suave) no llega
// al umbral, pero destaca sobre las demás de su fila: cuenta, avisando de que es dudosa.
function decidir(niveles, umbral, vacio) {
  const orden = niveles.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const [a, b] = [orden[0], orden[1] || [0, -1]];
  if (a[0] < umbral) {
    if (a[0] >= vacio + 0.08 && a[0] - b[0] >= 0.07) return { marca: a[1], dudosa: true };
    return { marca: -1, dudosa: a[0] > umbral * 0.75 };
  }
  if (b[0] >= umbral && a[0] - b[0] < 0.2) return { marca: -2, dudosa: false };
  // Otra algo marcada (¿borrada?): vale la más oscura, pero se avisa
  return { marca: a[1], dudosa: b[0] >= umbral * 0.85 };
}

/**
 * Lee una hoja.
 *   imagen: RGBA ({width, height, data}) · detecciones: marcadores del detector
 *   cfg: { nPreguntas, nOpciones }
 * → { ok:false, motivo } o
 *   { ok:true, lista (n.º de lista o null), respuestas: ['A'|''|'*'…], dudosas: [q…], H }
 */
export function leerHoja(imagen, detecciones, { nPreguntas, nOpciones }, gris = null) {
  const { parejas, vistas } = parejasDeMarcas(detecciones);
  if (vistas.length < 3) return { ok: false, motivo: 'marcas', vistas };
  const H = homografia(parejas);
  if (!H) return { ok: false, motivo: 'marcas', vistas };
  const g = gris || aGris(imagen);

  // La hoja debe verse lo bastante grande: un círculo de al menos ~9 px de diámetro
  const a = H(105, 150), b = H(105 + 2 * R, 150);
  if (Math.hypot(b.x - a.x, b.y - a.y) < 9) return { ok: false, motivo: 'lejos', vistas };

  const nivelesId = [0, 1].map((c) => Array.from({ length: 10 }, (_, d) => { const p = posId(c, d); return oscuridad(g, H, p.x, p.y); }));
  const niveles = Array.from({ length: nPreguntas }, (_, q) => Array.from({ length: nOpciones }, (_, o) => { const p = posBurbuja(q, o); return oscuridad(g, H, p.x, p.y); }));
  if ([...nivelesId.flat(), ...niveles.flat()].some((v) => v === null)) return { ok: false, motivo: 'fuera', vistas };

  // Nivel de un círculo vacío = mediana de todos (la mayoría están vacíos)
  const todos = [...nivelesId.flat(), ...niveles.flat()].sort((x, y) => x - y);
  const vacio = todos[Math.floor(todos.length / 2)];
  const umbral = Math.max(0.22, vacio + 0.2);

  const dudosas = [];
  const respuestas = niveles.map((fila, q) => {
    const { marca, dudosa } = decidir(fila, umbral, vacio);
    if (dudosa) dudosas.push(q);
    return marca === -1 ? '' : marca === -2 ? '*' : LETRAS[marca];
  });
  const [dec, uni] = nivelesId.map((col) => decidir(col, umbral, vacio).marca);
  // Sin decenas = 0 (alumnos del 1 al 9 que solo rellenan las unidades)
  const lista = uni >= 0 && dec !== -2 ? (dec > 0 ? dec : 0) * 10 + uni : null;
  return { ok: true, lista: lista || null, respuestas, dudosas, H, umbral, vistas };
}

/** Nota de una hoja: aciertos, fallos, blancos, dobles y nota sobre 10 (con penalización por fallo). */
export function puntuar(respuestas, clave, { penalizacion = 0 } = {}) {
  let aciertos = 0, fallos = 0, blancos = 0, dobles = 0;
  const detalle = clave.map((c, q) => {
    const r = respuestas[q] || '';
    if (!c) return 'anulada'; // pregunta sin clave: no cuenta
    if (r === '') { blancos++; return 'blanco'; }
    if (r === '*') { dobles++; fallos++; return 'doble'; }
    if (r === c) { aciertos++; return 'bien'; }
    fallos++;
    return 'mal';
  });
  const validas = clave.filter(Boolean).length;
  const puntos = Math.max(0, aciertos - fallos * penalizacion);
  const nota = validas ? Math.round((puntos / validas) * 100) / 10 : 0;
  return { aciertos, fallos, blancos, dobles, validas, nota, detalle };
}
