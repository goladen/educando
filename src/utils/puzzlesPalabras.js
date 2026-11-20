// Crucigramas y sopas de letras para Omni (tipos 'crossword' y 'wordsearch').
// JS puro (sin React): lo usan OmninteractiveApp, EditorOmni, pdfOmni y los scripts de Node.
//
//   generarCrucigrama([{ ans, clue }], { semilla, intentos }) → { filas, cols, items, sinColocar }
//      items: [{ ...entrada, ans: 'SHOWER', row, col, dir: 'across' | 'down' }]
//   numerarCrucigrama(items) → { numeros: Map('r,c' → n), conNum: [{ ...item, num }] }
//   celdasPalabra(item) → [[r, c], ...]
//
//   generarSopa([{ ans, clue }], { nivel: 'facil' | 'medio' | 'dificil', semilla, lado })
//      → { grid: 'ABCD|EFGH|…', items: [{ ...entrada, ans, row, col, dr, dc }], sinColocar }
//
// Firestore no admite arrays anidados: la sopa se guarda como texto con filas separadas por «|».

// Solo letras A-Z (y Ñ): «pencil case» → PENCILCASE, «T-shirt» → TSHIRT
export const normPalabra = (s) => String(s ?? '').toUpperCase()
  .normalize('NFD').replace(/(?!̃)[̀-ͯ]/g, '').normalize('NFC')
  .replace(/[^A-ZÑ]/g, '');

// RNG con semilla (mismo puzle cada vez que se regenera con la misma semilla)
export function rngSemilla(semilla = Date.now()) {
  let s = [...String(semilla)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const barajar = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// ─── CRUCIGRAMA ───────────────────────────────────────────────────────────────
export const celdasPalabra = (it) => {
  const w = normPalabra(it.ans);
  return Array.from({ length: w.length }, (_, k) => it.dir === 'down' ? [it.row + k, it.col] : [it.row, it.col + k]);
};

function intentoCrucigrama(entradas, rnd) {
  const mapa = new Map();                 // 'r,c' → letra
  const k = (r, c) => `${r},${c}`;
  const colocadas = [], pendientes = [];
  // Más largas primero, con algo de azar entre longitudes parecidas
  const orden = barajar(entradas, rnd).sort((a, b) => b.w.length - a.w.length + (rnd() - 0.5) * 2);

  const cabe = (w, row, col, dir) => {
    const dr = dir === 'down' ? 1 : 0, dc = dir === 'down' ? 0 : 1;
    if (mapa.has(k(row - dr, col - dc)) || mapa.has(k(row + dr * w.length, col + dc * w.length))) return -1;
    let cruces = 0;
    for (let i = 0; i < w.length; i++) {
      const r = row + dr * i, c = col + dc * i, l = mapa.get(k(r, c));
      if (l) { if (l !== w[i]) return -1; cruces++; continue; }
      // Casilla nueva: no puede tocar letras por los lados (evita palabras pegadas)
      if (mapa.has(k(r + dc, c + dr)) || mapa.has(k(r - dc, c - dr))) return -1;
    }
    return cruces === w.length ? -1 : cruces;
  };
  const poner = (e, row, col, dir) => {
    for (let i = 0; i < e.w.length; i++) mapa.set(k(dir === 'down' ? row + i : row, dir === 'down' ? col : col + i), e.w[i]);
    colocadas.push({ ...e, row, col, dir });
  };

  const colocar = (e) => {
    if (!colocadas.length) { poner(e, 0, 0, rnd() < 0.5 ? 'across' : 'down'); return true; }
    let mejor = null, mejorPunt = -1;
    for (const [clave, letra] of mapa) {
      const [r, c] = clave.split(',').map(Number);
      for (let i = 0; i < e.w.length; i++) {
        if (e.w[i] !== letra) continue;
        for (const dir of ['across', 'down']) {
          const row = dir === 'down' ? r - i : r, col = dir === 'down' ? c : c - i;
          const cr = cabe(e.w, row, col, dir);
          if (cr <= 0) continue;
          const punt = cr * 10 + rnd() * 5;
          if (punt > mejorPunt) { mejorPunt = punt; mejor = [row, col, dir]; }
        }
      }
    }
    if (!mejor) return false;
    poner(e, ...mejor);
    return true;
  };

  orden.forEach(e => { if (!colocar(e)) pendientes.push(e); });
  // Segunda pasada: alguna pendiente puede encajar ahora
  const sinColocar = pendientes.filter(e => !colocar(e));

  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const clave of mapa.keys()) {
    const [r, c] = clave.split(',').map(Number);
    minR = Math.min(minR, r); minC = Math.min(minC, c); maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
  }
  if (!colocadas.length) return { filas: 0, cols: 0, items: [], sinColocar };
  return {
    filas: maxR - minR + 1, cols: maxC - minC + 1, sinColocar,
    items: colocadas.map(({ w, ...e }) => ({ ...e, row: e.row - minR, col: e.col - minC })),
  };
}

export function generarCrucigrama(entradas, { semilla = Date.now(), intentos = 60 } = {}) {
  const rnd = rngSemilla(semilla);
  const lista = (entradas || []).map(e => ({ ...e, ans: normPalabra(e.ans), w: normPalabra(e.ans) })).filter(e => e.w.length >= 2);
  let mejor = null;
  for (let t = 0; t < intentos; t++) {
    const r = intentoCrucigrama(lista, rnd);
    // Gana: más palabras colocadas, luego cuadrícula más cuadrada y pequeña
    const punt = r.items.length * 1000 - r.filas * r.cols - Math.abs(r.filas - r.cols) * 4;
    if (!mejor || punt > mejor.punt) mejor = { ...r, punt };
  }
  const { punt, ...res } = mejor || { filas: 0, cols: 0, items: [], sinColocar: [] };
  res.sinColocar = (res.sinColocar || []).map(({ w, ...e }) => e);
  // Orden de lectura (las pistas salen ya numeradas)
  res.items.sort((a, b) => a.row - b.row || a.col - b.col || (a.dir === 'across' ? -1 : 1));
  return res;
}

export function numerarCrucigrama(items) {
  const numeros = new Map();
  [...(items || [])].sort((a, b) => a.row - b.row || a.col - b.col).forEach(it => {
    const clave = `${it.row},${it.col}`;
    if (!numeros.has(clave)) numeros.set(clave, numeros.size + 1);
  });
  return { numeros, conNum: (items || []).map(it => ({ ...it, num: numeros.get(`${it.row},${it.col}`) })) };
}

// Tamaño de la cuadrícula a partir de las palabras (por si el recurso no lo trae)
export function medidasCrucigrama(items) {
  let filas = 0, cols = 0;
  (items || []).forEach(it => celdasPalabra(it).forEach(([r, c]) => { filas = Math.max(filas, r + 1); cols = Math.max(cols, c + 1); }));
  return { filas, cols };
}

// Letra que va en cada casilla: Map('r,c' → letra)
export function solucionCrucigrama(items) {
  const m = new Map();
  (items || []).forEach(it => { const w = normPalabra(it.ans); celdasPalabra(it).forEach(([r, c], i) => m.set(`${r},${c}`, w[i])); });
  return m;
}

// ─── SOPA DE LETRAS ───────────────────────────────────────────────────────────
const DIRS = {
  facil: [[0, 1], [1, 0]],
  medio: [[0, 1], [1, 0], [1, 1], [-1, 1]],
  dificil: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
};
const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';

export function generarSopa(entradas, { nivel = 'medio', semilla = Date.now(), lado = 0 } = {}) {
  const rnd = rngSemilla(semilla);
  const lista = (entradas || []).map(e => ({ ...e, ans: normPalabra(e.ans) })).filter(e => e.ans.length >= 2);
  const larga = Math.max(0, ...lista.map(e => e.ans.length));
  const letras = lista.reduce((s, e) => s + e.ans.length, 0);
  const n = Math.max(8, Math.min(16, lado || Math.max(larga + 1, Math.ceil(Math.sqrt(letras * 2.4)))));
  const dirs = DIRS[nivel] || DIRS.medio;

  let mejor = null;
  for (let t = 0; t < 30; t++) {
    const g = Array.from({ length: n }, () => Array(n).fill(''));
    const items = [], sinColocar = [];
    [...lista].sort((a, b) => b.ans.length - a.ans.length).forEach(e => {
      const w = e.ans;
      for (let p = 0; p < 300; p++) {
        const [dr, dc] = dirs[Math.floor(rnd() * dirs.length)];
        const row = Math.floor(rnd() * n), col = Math.floor(rnd() * n);
        const er = row + dr * (w.length - 1), ec = col + dc * (w.length - 1);
        if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
        let ok = true;
        for (let i = 0; i < w.length && ok; i++) { const l = g[row + dr * i][col + dc * i]; if (l && l !== w[i]) ok = false; }
        if (!ok) continue;
        for (let i = 0; i < w.length; i++) g[row + dr * i][col + dc * i] = w[i];
        items.push({ ...e, row, col, dr, dc });
        return;
      }
      sinColocar.push(e);
    });
    if (!mejor || sinColocar.length < mejor.sinColocar.length) mejor = { g, items, sinColocar };
    if (!sinColocar.length) break;
  }
  const grid = mejor.g.map(f => f.map(l => l || ABC[Math.floor(rnd() * ABC.length)]).join('')).join('|');
  // Mismo orden que la lista original (las pistas salen como las escribió el profe)
  const pos = (w) => lista.findIndex(e => e.ans === w);
  mejor.items.sort((a, b) => pos(a.ans) - pos(b.ans));
  return { grid, items: mejor.items, sinColocar: mejor.sinColocar };
}

export const filasSopa = (grid) => String(grid || '').split('|').filter(Boolean);

// Casillas de una línea recta (horizontal, vertical o diagonal) entre dos casillas; null si no es recta
export function lineaEntre([r1, c1], [r2, c2]) {
  const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
  const lr = Math.abs(r2 - r1), lc = Math.abs(c2 - c1);
  if (lr && lc && lr !== lc) return null;
  const n = Math.max(lr, lc) + 1;
  return Array.from({ length: n }, (_, i) => [r1 + dr * i, c1 + dc * i]);
}

export const celdasSopa = (it) => Array.from({ length: normPalabra(it.ans).length }, (_, i) => [it.row + it.dr * i, it.col + it.dc * i]);

// ¿La línea marcada por el alumno coincide con alguna palabra (en cualquier sentido)?
export function palabraEnLinea(items, linea) {
  if (!linea || linea.length < 2) return null;
  const clave = (cs) => cs.map(([r, c]) => `${r},${c}`).join(';');
  const ida = clave(linea), vuelta = clave([...linea].reverse());
  return (items || []).find(it => { const k = clave(celdasSopa(it)); return k === ida || k === vuelta; }) || null;
}
