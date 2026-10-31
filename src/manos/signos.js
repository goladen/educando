// Reconocimiento del alfabeto dactilológico (lengua de signos española) con los
// 21 puntos de la mano de MediaPipe.
//
// No hay un modelo entrenado de fábrica: alguien que sepa signar graba EJEMPLOS de
// cada letra en el modo «Enseñar» y se reconoce por vecinos más cercanos (k-NN)
// sobre la forma de la mano normalizada (posición, tamaño y lado de la mano).
//
// Ejemplos:
//   · oficiales → public/signos/dactilologico.json (archivo descargado del modo
//     «Enseñar» y copiado ahí: lo usan todos los usuarios).
//   · propios   → localStorage (los graba cada uno en su navegador).
// Las letras con movimiento (J, Ñ, Z…) se graban con la postura más característica.

export const LETRAS_SIGNOS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
export const NUMEROS_SIGNOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export const FORMATO = 'pikt-signos';
const LS_EJEMPLOS = 'pikt_signos_ejemplos';
export const URL_OFICIALES = '/signos/dactilologico.json';

// ── Normalización ───────────────────────────────────────────────────────────

const PESO_Z = 0.6; // la profundidad de MediaPipe es más ruidosa que x/y
const PUNTAS = [4, 8, 12, 16, 20];

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Mano (puntos3d de manosVision) → 63 números: muñeca en el origen, tamaño de la
 * palma = 1 y, si `zurdo`, reflejada para que coincida con una mano derecha.
 * La orientación se conserva: hay letras que solo se distinguen por ella.
 */
export function normalizarMano(puntos3d, zurdo = false) {
  const p = puntos3d;
  const o = p[0];
  const escala = (dist3(p[0], p[5]) + dist3(p[0], p[9]) + dist3(p[0], p[17]) + dist3(p[5], p[17])) / 4 || 1e-6;
  const sx = zurdo ? -1 : 1;
  const out = new Array(63);
  for (let i = 0; i < 21; i++) {
    out[i * 3] = (sx * (p[i].x - o.x)) / escala;
    out[i * 3 + 1] = (p[i].y - o.y) / escala;
    out[i * 3 + 2] = ((p[i].z - o.z) / escala) * PESO_Z;
  }
  return out;
}

/** Rasgos para comparar: coordenadas + distancias entre puntas (forma de los dedos). */
function rasgos(n) {
  const r = n.slice();
  const pt = (i) => ({ x: n[i * 3], y: n[i * 3 + 1], z: n[i * 3 + 2] });
  for (let a = 0; a < PUNTAS.length; a++) {
    for (let b = a + 1; b < PUNTAS.length; b++) r.push(dist3(pt(PUNTAS[a]), pt(PUNTAS[b])) * 1.5);
    r.push(dist3(pt(PUNTAS[a]), pt(0)) * 1.5);
  }
  return r;
}

function d2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

// ── Clasificador k-NN ───────────────────────────────────────────────────────

/**
 * muestras = { A: [[63 números], …], … } → clasificador.
 * clasificar(normalizada, clasesPermitidas?) → null o { clase, confianza (0-1), segunda,
 * dudosa (empate con `segunda`), lejana (se parece poco), cercana (si clase = null: nada se parece) }.
 */
export function crearClasificador(muestras, k = 5) {
  const datos = [];
  Object.entries(muestras || {}).forEach(([clase, lista]) =>
    (lista || []).forEach((m) => {
      if (Array.isArray(m) && m.length === 63) datos.push({ clase, r: rasgos(m) });
    })
  );

  // Umbrales FIJOS (error medio por rasgo, en tamaños de palma). No se pueden calcular de
  // los ejemplos: al grabarse seguidos son casi idénticos entre sí y salían tan estrictos
  // que rechazaban la misma letra con la mano un poco girada.
  const raiz = Math.sqrt(datos[0]?.r.length || 78);
  const umbralLejana = 0.35 * raiz; // más allá: se parece, pero poco (`lejana`)
  const umbralFuera = 0.7 * raiz; // más allá: no se parece a ninguna

  const clases = [...new Set(datos.map((d) => d.clase))];

  return {
    total: datos.length,
    clases,
    clasificar(normalizada, permitidas) {
      if (!datos.length || !normalizada) return null;
      const r = rasgos(normalizada);
      const vecinos = [];
      const mejorPorClase = {}; // los k vecinos suelen ser de una sola letra: el empate se mira aquí
      for (const d of datos) {
        if (permitidas && !permitidas.has(d.clase)) continue;
        const dd = d2(r, d.r);
        if (!(dd >= mejorPorClase[d.clase])) mejorPorClase[d.clase] = dd;
        if (vecinos.length < k) {
          vecinos.push({ clase: d.clase, dd });
          vecinos.sort((a, b) => a.dd - b.dd);
        } else if (dd < vecinos[k - 1].dd) {
          vecinos[k - 1] = { clase: d.clase, dd };
          vecinos.sort((a, b) => a.dd - b.dd);
        }
      }
      if (!vecinos.length) return null;
      const dist = Math.sqrt(vecinos[0].dd);
      if (dist > umbralFuera) return { clase: null, confianza: 0, segunda: null, dudosa: false, lejana: true, cercana: vecinos[0].clase };
      const votos = {};
      let suma = 0;
      vecinos.forEach((v) => {
        const w = 1 / (Math.sqrt(v.dd) + 0.05);
        votos[v.clase] = (votos[v.clase] || 0) + w;
        suma += w;
      });
      const orden = Object.entries(votos).sort((a, b) => b[1] - a[1]);
      const confianza = orden[0][1] / suma;
      // Segunda letra más cercana (con su mejor ejemplo); empate si está casi a la misma distancia.
      const clase = orden[0][0];
      const rival = Object.entries(mejorPorClase)
        .filter(([c]) => c !== clase)
        .sort((a, b) => a[1] - b[1])[0];
      const empate = rival ? dist / Math.sqrt(rival[1]) > 0.88 : false;
      return { clase, confianza, segunda: rival?.[0] || null, dudosa: empate || confianza < 0.6, lejana: dist > umbralLejana };
    },
  };
}

/**
 * A partir de UNA mano normalizada (p. ej. sacada de una foto) genera `n` variantes
 * con pequeños giros y temblor, para tener ejemplos de partida sin grabar.
 */
export function aumentarMuestra(norm, n = 20) {
  const pts = [];
  for (let i = 0; i < 21; i++) pts.push([norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2] / PESO_Z]);
  const azar = (a) => (Math.random() * 2 - 1) * a;
  const out = [];
  for (let k = 0; k < n; k++) {
    const [ax, ay, az] = [azar(0.18), azar(0.25), azar(0.14)]; // radianes (~10°, 14°, 8°)
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
    const m = new Array(63);
    pts.forEach(([x0, y0, z0], i) => {
      // giro en Z (plano de la imagen), luego Y y luego X
      let x = x0 * cz - y0 * sz;
      let y = x0 * sz + y0 * cz;
      let z = z0;
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      const t = i === 0 ? 0 : 0.03;
      m[i * 3] = x + azar(t);
      m[i * 3 + 1] = y + azar(t);
      m[i * 3 + 2] = (z + azar(t)) * PESO_Z;
    });
    out.push(m);
  }
  return out;
}

// ── Guardar / cargar ejemplos ───────────────────────────────────────────────

const redondear = (m) => m.map((v) => Math.round(v * 1000) / 1000);

function validar(json) {
  if (!json || typeof json !== 'object' || !json.muestras || typeof json.muestras !== 'object') return null;
  const muestras = {};
  Object.entries(json.muestras).forEach(([clase, lista]) => {
    if (typeof clase !== 'string' || clase.length > 3 || !Array.isArray(lista)) return;
    const buenas = lista.filter((m) => Array.isArray(m) && m.length === 63 && m.every((v) => typeof v === 'number' && Number.isFinite(v)));
    if (buenas.length) muestras[clase] = buenas;
  });
  return { autor: typeof json.autor === 'string' ? json.autor.slice(0, 60) : '', muestras };
}

export function leerEjemplosLocales() {
  try {
    return validar(JSON.parse(localStorage.getItem(LS_EJEMPLOS) || 'null')) || { autor: '', muestras: {} };
  } catch {
    return { autor: '', muestras: {} };
  }
}

/** Devuelve false si el navegador no ha dejado guardar (espacio lleno, modo privado…). */
export function guardarEjemplosLocales(datos) {
  try {
    const muestras = {};
    Object.entries(datos.muestras || {}).forEach(([c, l]) => {
      if (l?.length) muestras[c] = l.map(redondear);
    });
    localStorage.setItem(LS_EJEMPLOS, JSON.stringify({ formato: FORMATO, version: 1, autor: datos.autor || '', muestras }));
    return true;
  } catch {
    return false;
  }
}

let oficialesPromesa = null;
/** Ejemplos oficiales publicados en la web ({ autor, muestras }); vacío si aún no hay. */
export function cargarEjemplosOficiales() {
  if (!oficialesPromesa) {
    oficialesPromesa = fetch(URL_OFICIALES, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => validar(j) || { autor: '', muestras: {} })
      .catch(() => ({ autor: '', muestras: {} })); // sin archivo (o la web devuelve el index.html)
  }
  return oficialesPromesa;
}

/** Une varios juegos de ejemplos (p. ej. oficiales + propios, o archivos de varias personas). */
export function unirEjemplos(...juegos) {
  const muestras = {};
  juegos.forEach((j) =>
    Object.entries(j?.muestras || {}).forEach(([c, l]) => {
      muestras[c] = [...(muestras[c] || []), ...l];
    })
  );
  return muestras;
}

/** Descarga los ejemplos como archivo .json (para enviarlos y publicarlos). */
export function descargarEjemplos(datos) {
  const json = {
    formato: FORMATO,
    version: 1,
    autor: datos.autor || '',
    fecha: new Date().toISOString(),
    muestras: Object.fromEntries(Object.entries(datos.muestras || {}).map(([c, l]) => [c, l.map(redondear)])),
  };
  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nombre = (datos.autor || 'ejemplos').normalize('NFD').replace(/[^\w-]+/g, '-').toLowerCase();
  a.href = url;
  a.download = `signos-${nombre}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lee un archivo .json de ejemplos → { autor, muestras } (lanza error si no vale). */
export async function leerArchivoEjemplos(file) {
  const texto = await file.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un archivo de ejemplos válido.');
  }
  const v = validar(json);
  if (!v || !Object.keys(v.muestras).length) throw new Error('El archivo no contiene ejemplos de letras.');
  return v;
}
