// Reconocimiento de SIGNOS POR PALABRA (gestos con movimiento) con manos + cuerpo de MediaPipe.
//
// A diferencia de las letras (una postura fija, ./signos.js), aquí se guarda el MOVIMIENTO:
// una secuencia de fotogramas que empieza al subir las manos y acaba al bajarlas. Se compara
// con los ejemplos grabados con DTW, que tolera que el signo se haga más rápido o más lento.
//
// Cada fotograma son 36 números (18 por brazo): muñeca respecto a los hombros (x, y), si se ve
// la mano (0/1) y las 5 puntas de los dedos respecto a la muñeca (x, y, z).
//
// Ejemplos:
//   · oficiales → public/signos/palabras.json (archivo descargado y copiado ahí).
//   · propios   → localStorage (los graba cada uno en su navegador).
import { P } from '../cuerpo/poseVision.js';

export const PALABRAS_INICIALES = ['HOLA', 'ADIÓS', 'GRACIAS', 'POR FAVOR', 'SÍ', 'NO', 'BIEN', 'MAL', 'PROFESOR', 'ALUMNO'];

export const FORMATO_PALABRAS = 'pikt-signos-palabras';
const LS_PALABRAS = 'pikt_signos_palabras';
export const URL_PALABRAS = '/signos/palabras.json';

export const TAM_FOTOGRAMA = 36;
export const FOTOGRAMAS = 24; // cada ejemplo se guarda con esta longitud
const BANDA_DTW = 6; // cuánto se puede adelantar o atrasar un fotograma
const REPOSO_Y = 1.2; // muñeca más abajo (en anchos de hombros bajo los hombros) = mano bajada
const REPOSO_X = 0.8;
const PESO_DEDOS = 0.5;
const PESO_Z = 0.6;
const PUNTAS = [4, 8, 12, 16, 20];
const VISIBLE = 0.5;

// Umbrales de comparación (media por fotograma, en anchos de hombros). Provisionales: hay que
// ajustarlos con grabaciones reales; la pantalla enseña la distancia de cada intento.
export const UMBRAL_FUERA = 0.6; // más allá: no se parece a ninguna palabra
export const MARGEN_EMPATE = 0.85; // mejor / segunda por encima de esto: duda entre dos

// ── Fotograma ───────────────────────────────────────────────────────────────

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Reparte las manos detectadas entre las muñecas del cuerpo: { D, I }. */
function asignarManos(manos, munD, munI) {
  const d2 = (m, w) => (w ? (m.puntos3d[0].x - w.x) ** 2 + (m.puntos3d[0].y - w.y) ** 2 : Infinity);
  if (!manos.length) return { D: null, I: null };
  if (manos.length === 1) return d2(manos[0], munD) <= d2(manos[0], munI) ? { D: manos[0], I: null } : { D: null, I: manos[0] };
  const [a, b] = manos;
  return d2(a, munD) + d2(b, munI) <= d2(a, munI) + d2(b, munD) ? { D: a, I: b } : { D: b, I: a };
}

function brazo(mano, munPose, centro, ancho, signoX) {
  const w = mano ? mano.puntos3d[0] : munPose;
  const x = w ? (w.x - centro.x) / ancho : 0;
  const y = w ? (w.y - centro.y) / ancho : Infinity;
  if (!w || y > REPOSO_Y) {
    // Mano bajada o sin ver: siempre el mismo valor, para que el otro brazo no meta ruido.
    return { activa: false, v: [signoX * REPOSO_X, REPOSO_Y, 0, ...new Array(15).fill(0)] };
  }
  const v = [x, y, mano ? 1 : 0];
  if (mano) {
    const p = mano.puntos3d;
    const escala = (dist3(p[0], p[5]) + dist3(p[0], p[9]) + dist3(p[0], p[17]) + dist3(p[5], p[17])) / 4 || 1e-6;
    PUNTAS.forEach((i) => {
      v.push(((p[i].x - p[0].x) / escala) * PESO_DEDOS, ((p[i].y - p[0].y) / escala) * PESO_DEDOS, ((p[i].z - p[0].z) / escala) * PESO_DEDOS * PESO_Z);
    });
  } else v.push(...new Array(15).fill(0));
  return { activa: !!mano, v };
}

/**
 * Persona (poseVision) + manos (manosVision) → { v: 36 números, activa } o null si no se ve
 * a la persona. `aspecto` = ancho/alto de la imagen; `zurdo` refleja el signo.
 */
export function fotogramaSigno(persona, manos, aspecto, zurdo = false) {
  const pp = persona?.puntos;
  if (!pp || pp[P.HOMBRO_I].v < VISIBLE || pp[P.HOMBRO_D].v < VISIBLE) return null;
  const punto = (i) => (pp[i].v >= VISIBLE ? { x: pp[i].x * aspecto, y: pp[i].y } : null);
  const hd = { x: pp[P.HOMBRO_D].x * aspecto, y: pp[P.HOMBRO_D].y };
  const hi = { x: pp[P.HOMBRO_I].x * aspecto, y: pp[P.HOMBRO_I].y };
  const ancho = Math.hypot(hd.x - hi.x, hd.y - hi.y);
  if (ancho < 0.02) return null;
  const centro = { x: (hd.x + hi.x) / 2, y: (hd.y + hi.y) / 2 };
  const munD = punto(P.MUNECA_D);
  const munI = punto(P.MUNECA_I);
  const { D, I } = asignarManos(manos || [], munD, munI);
  const bD = brazo(D, munD, centro, ancho, 1);
  const bI = brazo(I, munI, centro, ancho, -1);
  const reflejar = (v) => v.map((n, i) => (i === 0 || (i >= 3 && (i - 3) % 3 === 0) ? -n : n));
  const v = zurdo ? [...reflejar(bI.v), ...reflejar(bD.v)] : [...bD.v, ...bI.v];
  return { v, activa: bD.activa || bI.activa };
}

/** Longitud fija por interpolación entre fotogramas. */
export function remuestrear(frames, n = FOTOGRAMAS) {
  if (!frames.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i * (frames.length - 1)) / (n - 1);
    const a = Math.floor(t);
    const b = Math.min(frames.length - 1, a + 1);
    const f = t - a;
    out.push(frames[a].map((x, k) => x + (frames[b][k] - x) * f));
  }
  return out;
}

// ── Separar los signos: empieza al subir las manos, acaba al bajarlas ───────

/**
 * paso(fotograma | null, ahoraMs) → 'reposo' | 'signando' | 'baja' (lleva demasiado arriba).
 * Al acabar un signo llama a alTerminar(secuencia remuestreada).
 */
export function crearSegmentador(alTerminar, { minMs = 350, maxMs = 6000, finMs = 400 } = {}) {
  let estado = 'reposo';
  let frames = [];
  let inicio = 0;
  let ultimaActiva = 0;
  let nUtiles = 0;
  return {
    paso(fot, ahora) {
      const activa = !!fot?.activa;
      if (estado === 'baja') {
        if (activa) ultimaActiva = ahora;
        else if (ahora - ultimaActiva > finMs) estado = 'reposo';
        return estado;
      }
      if (estado === 'reposo') {
        if (!activa) return estado;
        estado = 'signando';
        frames = [];
        inicio = ahora;
        nUtiles = 0;
      }
      if (fot) frames.push(fot.v);
      if (activa) {
        ultimaActiva = ahora;
        nUtiles = frames.length; // lo de después de la última mano vista se descarta
      }
      if (ahora - inicio > maxMs) {
        frames = [];
        estado = 'baja';
        return estado;
      }
      if (ahora - ultimaActiva > finMs) {
        const dur = ultimaActiva - inicio;
        const utiles = frames.slice(0, nUtiles);
        frames = [];
        estado = 'reposo';
        if (dur >= minMs && utiles.length >= 5) alTerminar(remuestrear(utiles));
      }
      return estado;
    },
  };
}

// ── Comparar ────────────────────────────────────────────────────────────────

function costeFotograma(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Distancia DTW entre dos secuencias (media por fotograma). */
export function distanciaDTW(a, b, banda = BANDA_DTW) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return Infinity;
  const w = Math.max(banda, Math.abs(n - m));
  let prev = new Float64Array(m + 1).fill(Infinity);
  let cur = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      cur[j] = costeFotograma(a[i - 1], b[j - 1]) + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m] / (n + m);
}

/**
 * muestras = { HOLA: [secuencia, …], … } → clasificar(secuencia) → null o
 * { clase, segunda, dudosa, distancia, cercana (si clase = null: nada se parece) }.
 */
export function crearClasificadorPalabras(muestras) {
  const clases = Object.entries(muestras || {}).filter(([, l]) => l?.length);
  return {
    clases: clases.map(([c]) => c),
    clasificar(sec) {
      if (!clases.length || !sec?.length) return null;
      // Media de los 3 mejores ejemplos: un ejemplo suelto mal grabado no decide.
      const orden = clases
        .map(([clase, lista]) => {
          const ds = lista.map((e) => distanciaDTW(sec, e)).sort((a, b) => a - b).slice(0, 3);
          return { clase, d: ds.reduce((s, x) => s + x, 0) / ds.length };
        })
        .sort((a, b) => a.d - b.d);
      const [mejor, rival] = orden;
      if (mejor.d > UMBRAL_FUERA) return { clase: null, segunda: null, dudosa: false, distancia: mejor.d, cercana: mejor.clase };
      return {
        clase: mejor.clase,
        segunda: rival?.clase || null,
        dudosa: rival ? mejor.d / rival.d > MARGEN_EMPATE : false,
        distancia: mejor.d,
      };
    },
  };
}

// ── Guardar / cargar ────────────────────────────────────────────────────────

const redondearSec = (s) => s.map((f) => f.map((v) => Math.round(v * 100) / 100));
const secValida = (s) =>
  Array.isArray(s) && s.length >= 2 && s.every((f) => Array.isArray(f) && f.length === TAM_FOTOGRAMA && f.every((v) => typeof v === 'number' && Number.isFinite(v)));

function validarPalabras(json) {
  if (!json || typeof json !== 'object' || !json.muestras || typeof json.muestras !== 'object') return null;
  const muestras = {};
  Object.entries(json.muestras).forEach(([clase, lista]) => {
    if (typeof clase !== 'string' || !clase.trim() || clase.length > 40 || !Array.isArray(lista)) return;
    const buenas = lista.filter(secValida);
    if (buenas.length) muestras[clase] = buenas;
  });
  return { autor: typeof json.autor === 'string' ? json.autor.slice(0, 60) : '', muestras };
}

export function leerPalabrasLocales() {
  try {
    return validarPalabras(JSON.parse(localStorage.getItem(LS_PALABRAS) || 'null')) || { autor: '', muestras: {} };
  } catch {
    return { autor: '', muestras: {} };
  }
}

const empaquetar = (datos) => ({
  formato: FORMATO_PALABRAS,
  version: 1,
  autor: datos.autor || '',
  muestras: Object.fromEntries(Object.entries(datos.muestras || {}).filter(([, l]) => l?.length).map(([c, l]) => [c, l.map(redondearSec)])),
});

/** Devuelve false si el navegador no ha dejado guardar. */
export function guardarPalabrasLocales(datos) {
  try {
    localStorage.setItem(LS_PALABRAS, JSON.stringify(empaquetar(datos)));
    return true;
  } catch {
    return false;
  }
}

let oficialesPromesa = null;
export function cargarPalabrasOficiales() {
  if (!oficialesPromesa) {
    oficialesPromesa = fetch(URL_PALABRAS, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => validarPalabras(j) || { autor: '', muestras: {} })
      .catch(() => ({ autor: '', muestras: {} })); // sin archivo (o la web devuelve el index.html)
  }
  return oficialesPromesa;
}

export function unirPalabras(...juegos) {
  const muestras = {};
  juegos.forEach((j) =>
    Object.entries(j?.muestras || {}).forEach(([c, l]) => {
      muestras[c] = [...(muestras[c] || []), ...l];
    })
  );
  return muestras;
}

export function descargarPalabras(datos) {
  const blob = new Blob([JSON.stringify({ ...empaquetar(datos), fecha: new Date().toISOString() })], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nombre = (datos.autor || 'ejemplos').normalize('NFD').replace(/[^\w-]+/g, '-').toLowerCase();
  a.href = url;
  a.download = `signos-palabras-${nombre}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function leerArchivoPalabras(file) {
  let json;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un archivo de palabras válido.');
  }
  const v = validarPalabras(json);
  if (!v || !Object.keys(v.muestras).length) throw new Error('El archivo no contiene ejemplos de palabras.');
  return v;
}
