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
// filas: filas por columna (17 en la hoja clásica; menos si hay respuestas escritas debajo)
export function posBurbuja(q, o, filas = RESP.filas) {
  const col = Math.floor(q / filas);
  const fila = q % filas;
  return { x: RESP.cols[col] + RESP.dx + o * RESP.pasoX, y: RESP.y0 + fila * RESP.pasoY };
}
export const posNumero = (q, filas = RESP.filas) => {
  const p = posBurbuja(q, 0, filas);
  return { x: p.x - 5.5, y: p.y };
};

// ── Respuestas escritas: una letra o cifra MAYÚSCULA por casilla ──
// Sin respuestas escritas la hoja es la clásica (17 filas por columna, igual que siempre).
// Con ellas, los círculos ocupan solo las filas necesarias y debajo van las casillas.
export const CAJA = { w: 8, h: 10, paso: 9, filaY: 13, margen: 0.5 };
export const MAX_LETRAS = 16;
export const filasTest = ({ nPreguntas = 0, nEscritas = 0 }) => (nEscritas > 0 ? Math.max(1, Math.ceil(nPreguntas / 3)) : RESP.filas);

/** Dónde van las respuestas escritas: { titulo (y del rótulo), items: [{ k, num, x, y, cajas:[{cx, cy}] }], capacidad }. */
export function plantillaEscritas({ nPreguntas = 0, nEscritas = 0, letras = 8 }) {
  const n = Math.max(1, Math.min(MAX_LETRAS, letras));
  const titulo = nPreguntas > 0 ? RESP.y0 + filasTest({ nPreguntas, nEscritas: 1 }) * RESP.pasoY + 4 : RESP.y0 - 9;
  const y0 = titulo + 10;
  const cols = n <= 8 ? [22, 108] : [22];
  const ultima = 271 - CAJA.h / 2; // centro más bajo posible (encima de los marcadores de abajo)
  const filas = y0 > ultima ? 0 : Math.floor((ultima - y0) / CAJA.filaY) + 1;
  const capacidad = filas * cols.length;
  const items = [];
  for (let k = 0; k < Math.min(nEscritas, capacidad); k++) {
    const col = Math.floor(k / filas), fila = k % filas;
    const x = cols[col], y = y0 + fila * CAJA.filaY;
    items.push({ k, num: nPreguntas + k + 1, x, y, cajas: Array.from({ length: n }, (_, j) => ({ cx: x + 9 + j * CAJA.paso + CAJA.w / 2, cy: y })) });
  }
  return { titulo, items, capacidad, letras: n };
}

/**
 * Recorta cada casilla (por la homografía) y devuelve su «tinta» 0-1 en una rejilla
 * fija de GW×GH, o null si está vacía. Se descartan motas y restos del borde impreso.
 */
export const GW = 41, GH = 55;
export function leerCajas(gris, H, items) {
  const iw = CAJA.w - 2 * CAJA.margen, ih = CAJA.h - 2 * CAJA.margen;
  return items.map((it) => it.cajas.map(({ cx, cy }) => {
    const v = new Float32Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const p = H(cx - iw / 2 + (gx + 0.5) * iw / GW, cy - ih / 2 + (gy + 0.5) * ih / GH);
      const m = muestra(gris, p.x, p.y);
      if (m === null) return null;
      v[gy * GW + gx] = m;
    }
    const orden = Float32Array.from(v).sort();
    const papel = Math.max(40, orden[Math.floor(orden.length * 0.85)]);
    // Tinta normalizada entre el papel y el trazo más oscuro de la casilla: conserva los bordes
    // suaves del trazo (como en los datos de entrenamiento) en vez de saturarlo todo a negro.
    const oscuro = orden[Math.floor(orden.length * 0.005)]; // ~11 px: un punto o una coma también cuentan
    if (papel - oscuro < Math.max(25, papel * 0.15)) return null; // sin contraste: casilla vacía
    const tinta = new Float32Array(GW * GH);
    for (let i = 0; i < tinta.length; i++) tinta[i] = Math.max(0, Math.min(1, ((papel - v[i]) / (papel - oscuro) - 0.12) / 0.8));
    limpiarTinta(tinta);
    let masa = 0;
    for (const t of tinta) masa += t;
    return masa < 12 ? null : tinta; // poca tinta = vacía (una coma o un punto ya cuentan)
  }));
}

// Quita componentes pequeñas (motas) y rayas pegadas al borde (restos del recuadro impreso)
function limpiarTinta(t) {
  const vis = new Uint8Array(t.length), pila = [];
  for (let i0 = 0; i0 < t.length; i0++) {
    if (vis[i0] || t[i0] <= 0.3) continue;
    const comp = [];
    let x0 = GW, x1 = 0, y0 = GH, y1 = 0;
    vis[i0] = 1; pila.push(i0);
    while (pila.length) {
      const i = pila.pop(); comp.push(i);
      const x = i % GW, y = (i / GW) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const j of [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, y > 0 ? i - GW : -1, y < GH - 1 ? i + GW : -1]) {
        if (j >= 0 && !vis[j] && t[j] > 0.3) { vis[j] = 1; pila.push(j); }
      }
    }
    const pegada = x0 <= 1 || y0 <= 1 || x1 >= GW - 2 || y1 >= GH - 2;
    const delgada = x1 - x0 <= 3 || y1 - y0 <= 3;
    if (comp.length < 8 || (pegada && delgada)) for (const i of comp) t[i] = 0;
  }
  for (let i = 0; i < t.length; i++) if (t[i] <= 0.3 && !vis[i]) t[i] = t[i] < 0.15 ? 0 : t[i];
}

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
export function leerHoja(imagen, detecciones, { nPreguntas, nOpciones, nEscritas = 0 }, gris = null) {
  const filas = filasTest({ nPreguntas, nEscritas });
  const { parejas, vistas } = parejasDeMarcas(detecciones);
  if (vistas.length < 3) return { ok: false, motivo: 'marcas', vistas };
  const H = homografia(parejas);
  if (!H) return { ok: false, motivo: 'marcas', vistas };
  const g = gris || aGris(imagen);

  // La hoja debe verse lo bastante grande: un círculo de al menos ~9 px de diámetro
  const a = H(105, 150), b = H(105 + 2 * R, 150);
  if (Math.hypot(b.x - a.x, b.y - a.y) < 9) return { ok: false, motivo: 'lejos', vistas };

  const nivelesId = [0, 1].map((c) => Array.from({ length: 10 }, (_, d) => { const p = posId(c, d); return oscuridad(g, H, p.x, p.y); }));
  const niveles = Array.from({ length: nPreguntas }, (_, q) => Array.from({ length: nOpciones }, (_, o) => { const p = posBurbuja(q, o, filas); return oscuridad(g, H, p.x, p.y); }));
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
  return { ok: true, lista: lista || null, respuestas, dudosas, H, umbral, vistas, filas, gris: g };
}

/**
 * Nota de una hoja: aciertos, fallos, blancos, dobles y nota sobre 10 (con penalización por fallo).
 * escritas: estados de las respuestas escritas ([{ estado }]): cuentan como preguntas; sus fallos
 * no restan (no se pueden acertar al azar) y las «dudosas» no suman hasta que el profe las revise.
 */
export function puntuar(respuestas, clave, { penalizacion = 0, escritas = [] } = {}) {
  let aciertos = 0, fallos = 0, blancos = 0, dobles = 0, falloTest = 0, pendientes = 0;
  const detalle = clave.map((c, q) => {
    const r = respuestas[q] || '';
    if (!c) return 'anulada'; // pregunta sin clave: no cuenta
    if (r === '') { blancos++; return 'blanco'; }
    if (r === '*') { dobles++; fallos++; falloTest++; return 'doble'; }
    if (r === c) { aciertos++; return 'bien'; }
    fallos++; falloTest++;
    return 'mal';
  });
  for (const e of escritas) {
    if (e.estado === 'anulada') continue;
    if (e.estado === 'bien') aciertos++;
    else if (e.estado === 'mal') fallos++;
    else if (e.estado === 'blanco') blancos++;
    else pendientes++;
  }
  const validas = clave.filter(Boolean).length + escritas.filter((e) => e.estado !== 'anulada').length;
  const puntos = Math.max(0, aciertos - falloTest * penalizacion);
  const nota = validas ? Math.round((puntos / validas) * 100) / 10 : 0;
  return { aciertos, fallos, blancos, dobles, pendientes, validas, nota, detalle };
}
