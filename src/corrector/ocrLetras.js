// ✍️ Reconocimiento de letras MAYÚSCULAS y números escritos a mano, una por casilla.
// Red neuronal pequeña (≈100 mil pesos) entrenada con EMNIST (letras) y MNIST (dígitos),
// más Ñ y 7 con raya sintéticos. Se ejecuta aquí en JavaScript puro: no hace falta
// TensorFlow en la web y no se envía ninguna imagen a ningún sitio.
//
// La normalización de normalizarTrazo() es EXACTAMENTE la que se usó al entrenar
// (el script de entrenamiento importa este archivo): no cambiarla sin reentrenar.

// Clases de la red (37) + signos que se reconocen por su forma y tamaño en la casilla (sin red):
// '-' (signo menos) y ',' (coma o punto decimal: 3,5 = 3.5).
export const CLASES_RED = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÑ';
export const SIMBOLOS = '-,';
export const CLASES = CLASES_RED + SIMBOLOS;
export const DIGITOS = new Set('0123456789');
// Si se reentrena el modelo, subir la versión (evita que el navegador use el viejo de su caché)
export const URL_MODELO = '/modelos/letras-pikt.bin?v=1';

/**
 * Trazo (tinta 0-1, fila a fila, ancho w × alto h) → Float32Array(784) 28×28 como MNIST:
 * el trazo cabe en 20×20 sin deformarse y su centro de masas queda en el centro. null = vacío.
 */
export function normalizarTrazo(tinta, w, h, umbral = 0.25) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1, masa = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = tinta[y * w + x];
    if (v > umbral) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; masa += v; }
  }
  if (x1 < 0 || masa < 1.5) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const esc = 20 / Math.max(bw, bh);
  const ow = Math.max(1, Math.round(bw * esc)), oh = Math.max(1, Math.round(bh * esc));
  // Remuestreo con 4×4 muestras bilineales por píxel (vale para ampliar y para reducir)
  const muestra = (x, y) => {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
    const xi = Math.min(w - 2, Math.floor(x)), yi = Math.min(h - 2, Math.floor(y));
    const fx = x - xi, fy = y - yi, i = yi * w + xi;
    if (w === 1 || h === 1) return tinta[Math.round(y) * w + Math.round(x)] || 0;
    return (tinta[i] * (1 - fx) + tinta[i + 1] * fx) * (1 - fy) + (tinta[i + w] * (1 - fx) + tinta[i + w + 1] * fx) * fy;
  };
  const caja = new Float32Array(ow * oh);
  let sx = 0, sy = 0, sm = 0;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    let s = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s += muestra(x0 - 0.5 + (x + (b + 0.5) / 4) / esc, y0 - 0.5 + (y + (a + 0.5) / 4) / esc);
    const v = Math.min(1, s / 16);
    caja[y * ow + x] = v;
    sx += v * x; sy += v * y; sm += v;
  }
  if (sm <= 0) return null;
  // Centro de masas al centro (14,14)
  const dx = Math.round(14 - (sx / sm + 0.5)), dy = Math.round(14 - (sy / sm + 0.5));
  const out = new Float32Array(784);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const X = x + dx, Y = y + dy;
    if (X >= 0 && X < 28 && Y >= 0 && Y < 28) out[Y * 28 + X] = caja[y * ow + x];
  }
  return out;
}

// ───────────────────────── Red (inferencia a mano) ─────────────────────────
// Arquitectura (la misma que el entrenamiento):
//   conv 3×3 16 relu → maxpool 2 → conv 3×3 32 relu → maxpool 2 → conv 3×3 64 relu
//   → flatten → dense 128 relu → dense 37 softmax
// Pesos en formato tfjs: conv [kh, kw, cin, cout], dense [in, out].

function conv(x, h, w, c, k, b, cout) {
  const oh = h - 2, ow = w - 2, out = new Float32Array(oh * ow * cout);
  for (let y = 0; y < oh; y++) for (let xx = 0; xx < ow; xx++) {
    const o = (y * ow + xx) * cout;
    for (let f = 0; f < cout; f++) out[o + f] = b[f];
    for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) {
      const xi = ((y + ky) * w + (xx + kx)) * c, ki = (ky * 3 + kx) * c * cout;
      for (let ci = 0; ci < c; ci++) {
        const v = x[xi + ci];
        if (v === 0) continue;
        const kk = ki + ci * cout;
        for (let f = 0; f < cout; f++) out[o + f] += v * k[kk + f];
      }
    }
    for (let f = 0; f < cout; f++) if (out[o + f] < 0) out[o + f] = 0;
  }
  return { x: out, h: oh, w: ow, c: cout };
}

function pool({ x, h, w, c }) {
  const oh = Math.floor(h / 2), ow = Math.floor(w / 2), out = new Float32Array(oh * ow * c);
  for (let y = 0; y < oh; y++) for (let xx = 0; xx < ow; xx++) for (let f = 0; f < c; f++) {
    const a = ((2 * y) * w + 2 * xx) * c + f, b = ((2 * y + 1) * w + 2 * xx) * c + f;
    out[(y * ow + xx) * c + f] = Math.max(x[a], x[a + c], x[b], x[b + c]);
  }
  return { x: out, h: oh, w: ow, c };
}

function dense(x, W, b, nout, relu) {
  const nin = x.length, out = Float32Array.from(b);
  for (let i = 0; i < nin; i++) { const v = x[i]; if (v === 0) continue; const o = i * nout; for (let j = 0; j < nout; j++) out[j] += v * W[o + j]; }
  if (relu) for (let j = 0; j < nout; j++) if (out[j] < 0) out[j] = 0;
  return out;
}

export const FORMAS = [
  ['c1k', [3, 3, 1, 16]], ['c1b', [16]],
  ['c2k', [3, 3, 16, 32]], ['c2b', [32]],
  ['c3k', [3, 3, 32, 64]], ['c3b', [64]],
  ['d1k', [576, 128]], ['d1b', [128]],
  ['d2k', [128, 37]], ['d2b', [37]],
];

/** Pesos (Map nombre → Float32Array) → función x784 → logits (37). */
export function crearRed(P) {
  return (x) => {
    let t = conv(x, 28, 28, 1, P.get('c1k'), P.get('c1b'), 16);
    t = pool(t);
    t = conv(t.x, t.h, t.w, 16, P.get('c2k'), P.get('c2b'), 32);
    t = pool(t);
    t = conv(t.x, t.h, t.w, 32, P.get('c3k'), P.get('c3b'), 64);
    const h1 = dense(t.x, P.get('d1k'), P.get('d1b'), 128, true);
    return dense(h1, P.get('d2k'), P.get('d2b'), 37, false);
  };
}

/** Formato del .bin: por cada tensor de FORMAS, float32 escala + int8 × tamaño (cuantizado). */
export function leerPesos(buffer) {
  const dv = new DataView(buffer);
  let o = 0;
  const P = new Map();
  for (const [nombre, forma] of FORMAS) {
    const n = forma.reduce((a, b) => a * b, 1);
    const esc = dv.getFloat32(o, true); o += 4;
    const q = new Int8Array(buffer, o, n); o += n;
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = q[i] * esc;
    P.set(nombre, f);
  }
  return P;
}

let redCargada = null;
/** Carga el modelo una vez (≈100 KB). */
export async function cargarModelo(url = URL_MODELO) {
  if (!redCargada) {
    redCargada = fetch(url).then((r) => { if (!r.ok) throw new Error('No se pudo cargar el modelo de letras'); return r.arrayBuffer(); })
      .then((b) => crearRed(leerPesos(b)))
      .catch((e) => { redCargada = null; throw e; });
  }
  return redCargada;
}

/** logits → probabilidades solo entre las clases permitidas (p. ej. solo dígitos). */
export function probabilidades(logits, permitidas = null) {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (!permitidas || permitidas.has(CLASES[i])) max = Math.max(max, logits[i]);
  const p = new Float32Array(logits.length);
  let s = 0;
  for (let i = 0; i < logits.length; i++) if (!permitidas || permitidas.has(CLASES[i])) { p[i] = Math.exp(logits[i] - max); s += p[i]; }
  for (let i = 0; i < p.length; i++) p[i] /= s;
  return p;
}

/** Texto esperado → forma de comparar: mayúsculas sin tildes (la Ñ se mantiene) ni espacios. */
const RE_NUMERO = /^-?[0-9]+(,[0-9]+)?$/;
export const esNumeroEscrito = (t) => RE_NUMERO.test(t);
export function normalizarRespuesta(t) {
  // Número: sin espacios, menos tipográfico → '-', sin '+' delante, punto decimal → coma
  const n = String(t || '').trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/^\+/, '').replace('.', ',');
  if (RE_NUMERO.test(n)) return n;
  return String(t || '').toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ').replace(/[^0-9A-ZÑ]/g, '');
}

// ───────────────────────── Comprobar una respuesta escrita ─────────────────────────
export const LETRAS_SET = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZÑ');

/**
 * Signo por su forma y su TAMAÑO dentro de la casilla (la red no lo ve: normaliza el tamaño).
 * '-' = raya baja y ancha · ',' = marca pequeña (coma o punto) · null = cifra o letra.
 */
export function signoDeCaja(tinta, gw, gh) {
  let x0 = gw, x1 = -1, y0 = gh, y1 = -1;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (tinta[y * gw + x] > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (h <= 0.2 * gh && w >= 1.8 * h && w >= 0.25 * gw) return '-';
  if (h <= 0.4 * gh && w <= 0.35 * gw) return ',';
  return null;
}

const ampliar = (p) => { const q = new Float32Array(CLASES.length); q.set(p); return q; };

/** Tinta de una casilla (rejilla gw×gh) → { letras, digitos } (probabilidades por clase) o null si vacía. */
export function clasificarCaja(red, tinta, gw, gh) {
  if (!tinta) return null;
  const x = normalizarTrazo(tinta, gw, gh);
  if (!x) return null;
  const lg = red(x);
  const letras = ampliar(probabilidades(lg, LETRAS_SET));
  const signo = signoDeCaja(tinta, gw, gh);
  if (signo) {
    // En las respuestas numéricas cuenta como signo; en las de letras se ignora (motas, guiones)
    const digitos = new Float32Array(CLASES.length).fill(0.002);
    digitos[CLASES.indexOf(signo)] = 0.95;
    return { letras, digitos, signo };
  }
  return { letras, digitos: ampliar(probabilidades(lg, DIGITOS)) };
}

// Pares que el modelo confunde de verdad (≥0,3 % en los datos de prueba): si la única diferencia con la
// respuesta es uno de estos, la respuesta queda «por revisar» en vez de «mal» (no se suspende una buena).
const CONFUSIONES = new Set('IL GQ UV IJ DO AQ VY CE HN RY FT XY KX RV AG CL 18 BH GS AD DP HK HW MN NR RT 27 FP HL NW AO UW 49 BR CR DJ EF FG JS MW NU OU PR 17 35 59 06 38 NÑ'.split(' '));
const confundibles = (a, b) => CONFUSIONES.has([a, b].sort().join(''));

const mejor = (p) => { let am = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[am]) am = i; return am; };
const esSigno = (c) => SIMBOLOS.includes(CLASES[mejor(c.digitos)]);

/** Forma canónica de un número escrito: sin ceros de más en los decimales (3,50 → 3,5 · 4,0 → 4 · -0 → 0). */
export function canonNumero(n) {
  let t = n.includes(',') ? n.replace(/0+$/, '').replace(/,$/, '') : n;
  if (/^-0(,0*)?$/.test(t)) t = '0';
  return t;
}
/** Forma del número esperado con la misma longitud que lo escrito (4 → 4,0 · 3,5 → 3,50), si existe. */
function numeroConLargo(n, largo) {
  const c = canonNumero(n);
  if (c.length === largo) return c;
  let t = c.includes(',') ? c : c + ',';
  while (t.length < largo) t += '0';
  return t.length === largo && !t.endsWith(',') ? t : c;
}

/**
 * cajas: [{letras, digitos} | null] (en orden) · esperadas: «PARIS / PARÍS» o ['PARIS', …]
 * → { estado: 'bien'|'mal'|'dudosa'|'blanco', leida, confianza (0-1) }
 * Se COMPRUEBA contra la respuesta esperada (no se lee a ciegas): si cada casilla es
 * razonablemente compatible con la letra que toca, está bien; si alguna es claramente
 * otra letra, mal; y si no está claro, «dudosa» para que lo decida el profe.
 */
export function verificarEscrita(cajas, esperadas) {
  let lista = (Array.isArray(esperadas) ? esperadas : String(esperadas || '').split('/')).map(normalizarRespuesta).filter(Boolean);
  const todas = cajas.filter(Boolean);
  if (!todas.length) return { estado: 'blanco', leida: '', confianza: 1 };
  const tipoNum = lista.length ? lista.every(esNumeroEscrito) : todas.every((c) => esSigno(c) || Math.max(...c.digitos) > Math.max(...c.letras));
  // En palabras, una marca pequeña o una raya suelta no es una letra: se ignora
  const llenas = tipoNum ? todas : todas.filter((c) => !esSigno(c));
  if (!llenas.length) return { estado: 'blanco', leida: '', confianza: 1 };
  const probs = llenas.map((c) => (tipoNum ? c.digitos : c.letras));
  const leida = probs.map((p) => CLASES[mejor(p)]).join('');
  if (!lista.length) return { estado: 'dudosa', leida, confianza: 0 };

  let mejorRes = null;
  for (const espOrig of lista) {
    let res;
    let esp = espOrig;
    if (tipoNum) {
      // Mismo valor aunque se escriba distinto (3,5 = 3,50): bien si cada casilla se lee con seguridad
      if (canonNumero(leida) === canonNumero(espOrig)) {
        const seg = Math.min(...probs.map((p) => p[mejor(p)]));
        res = { estado: seg >= 0.6 ? 'bien' : 'dudosa', confianza: seg };
        const rango = { bien: 3, dudosa: 2, mal: 1 };
        if (!mejorRes || rango[res.estado] > rango[mejorRes.estado]) mejorRes = res;
        continue;
      }
      esp = numeroConLargo(espOrig, probs.length);
    }
    if (esp.length !== probs.length) {
      res = { estado: Math.abs(esp.length - probs.length) >= 2 ? 'mal' : 'dudosa', confianza: 0.5 };
    } else if (leida === esp) {
      const conf = Math.min(...probs.map((p, i) => p[CLASES.indexOf(esp[i])]));
      res = { estado: 'bien', confianza: conf };
    } else {
      const pEsp = probs.map((p, i) => p[CLASES.indexOf(esp[i])]);
      const minp = Math.min(...pEsp);
      const media = Math.exp(pEsp.reduce((s, v) => s + Math.log(Math.max(v, 1e-6)), 0) / pEsp.length);
      // ¿Alguna casilla es claramente OTRA letra?
      // ¿Alguna casilla es claramente OTRA letra que no se parece a la esperada?
      const clara = probs.some((p, i) => CLASES[mejor(p)] !== esp[i] && p[mejor(p)] >= 0.85 && pEsp[i] < 0.03 && !confundibles(CLASES[mejor(p)], esp[i]));
      if (minp >= 0.3 && media >= 0.5) res = { estado: 'bien', confianza: media };
      else if (clara) res = { estado: 'mal', confianza: 1 - minp };
      else res = { estado: 'dudosa', confianza: media };
    }
    const rango = { bien: 3, dudosa: 2, mal: 1 };
    if (!mejorRes || rango[res.estado] > rango[mejorRes.estado]) mejorRes = res;
  }
  return { ...mejorRes, leida };
}

// ── Para el móvil: las probabilidades viajan resumidas (3 mejores letras y 3 mejores cifras) ──
const top3 = (p) => [...p].map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, v]) => v >= 0.005);
export function codificarCajas(cajas) {
  // «2:» = formato con ';' entre entradas (la coma es una clase). Sin prefijo: formato antiguo con ','.
  return '2:' + cajas.map((c) => (c ? `${top3(c.letras).map(([i, v]) => CLASES[i] + Math.round(v * 100)).join(';')}|${top3(c.digitos).map(([i, v]) => CLASES[i] + Math.round(v * 100)).join(';')}` : '')).join('/');
}
export function decodificarCajas(txt) {
  let t = String(txt || '');
  const nuevo = t.startsWith('2:');
  if (nuevo) t = t.slice(2);
  return t.split('/').map((s) => {
    if (!s) return null;
    const [l, d] = s.split('|');
    const lee = (parte) => {
      const p = new Float32Array(CLASES.length).fill(0.001);
      String(parte || '').split(nuevo ? ';' : ',').filter(Boolean).forEach((e) => { const i = CLASES.indexOf(e[0]); if (i >= 0) p[i] = Number(e.slice(1)) / 100; });
      return p;
    };
    return { letras: lee(l), digitos: lee(d) };
  });
}
