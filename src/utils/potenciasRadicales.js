// ─────────────────────────────────────────────────────────────────────────────
//  Generadores compartidos de potencias, radicales y notación científica.
//  Devuelven DATOS (sin formato): la app (PotenciasRaices.jsx) los pinta con su
//  render matemático y las fichas (fichas/fuentes/numeros.js) como texto.
//  Fuentes: ej. 8 y 10 de potencias (4.º ESO, alfonsogonzalez.es) y ej. 5-17 de
//  potencias y radicales (uv.es/lonjedo).
// ─────────────────────────────────────────────────────────────────────────────

export const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = (arr) => arr[rInt(0, arr.length - 1)];
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
export const lcm = (a, b) => (a / gcd(a, b)) * b;
export const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
export const SQFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

// Factorización en primos pequeños ({2: e2, 3: e3, …}); null si queda otro factor
export const factoriza = (n) => {
  const f = {}; let x = Math.abs(n);
  for (const p of [2, 3, 5, 7, 11, 13]) while (x % p === 0) { f[p] = (f[p] || 0) + 1; x /= p; }
  return x === 1 ? f : null;
};
export const sumaExp = (acc, f, k) => { Object.keys(f).forEach((p) => { acc[p] = (acc[p] || 0) + f[p] * k; }); };
// Radicando ya simplificado para ese índice: ningún factor sale fuera y no se puede reducir el índice
export const radSimplificado = (idx, valor) => {
  const f = factoriza(valor); if (!f) return false;
  const e = Object.values(f).filter((x) => x > 0);
  return e.length > 0 && e.every((x) => x < idx) && e.reduce(gcd, idx) === 1;
};
// a es potencia d-ésima exacta para algún divisor d > 1 del índice (√4, ⁴√9…): radical simplificable
export const esPotenciaExacta = (a, n) => { for (let d = 2; d <= n; d++) if (n % d === 0 && Math.round(a ** (1 / d)) ** d === a) return true; return false; };

// ═════════════════════════════════════════════════════════════════════════════
//  Ej. 8 y 10: productos y cocientes de potencias de bases DISTINTAS
//  Término: { tipo: 'pow'|'negbase'|'neg'|'powpow'|'frac', b, e, m, k, p, q }
// ═════════════════════════════════════════════════════════════════════════════
const BASES_COMP = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 25, 27];
function terminoSimplificar() {
  const t = pick(['pow', 'pow', 'pow', 'neg', 'frac', 'powpow']);
  const b = pick(BASES_COMP);
  if (t === 'pow') {
    if (Math.random() < 0.15) { const e = rInt(2, 4); return { tipo: 'negbase', b, e, f: factoriza(b), k: e, neg: e % 2 === 1 }; }
    const e = rInt(1, 4); return { tipo: 'pow', b, e, f: factoriza(b), k: e };
  }
  if (t === 'neg') { const e = -rInt(1, 3); return { tipo: 'pow', b, e, f: factoriza(b), k: e }; }
  if (t === 'powpow') { const m = rInt(2, 3), k = pick([-1, 2, 3]); return { tipo: 'powpow', b, m, e: k, f: factoriza(b), k: m * k }; }
  let p = pick([2, 3, 4, 5, 9]), q = pick([2, 3, 5, 8, 25]);
  while (gcd(p, q) !== 1) { p = pick([2, 3, 4, 5, 9]); q = pick([2, 3, 5, 8, 25]); }
  const e = pick([-3, -2, -1, 2, 3]);
  const f = {}; sumaExp(f, factoriza(p), 1); sumaExp(f, factoriza(q), -1);
  return { tipo: 'frac', p, q, e, f, k: e };
}
// → { num: [término], den: [término], neg, N, D, exps } con resultado ±N/D (N/D irreducible)
export function datosSimplificar(maxValor = 3000) {
  for (;;) {
    const nNum = rInt(2, 3), nDen = Math.random() < 0.15 ? 0 : rInt(1, 2);
    const exps = {}; const num = [], den = []; let neg = false;
    for (let i = 0; i < nNum + nDen; i++) {
      const t = terminoSimplificar();
      (i < nNum ? num : den).push(t);
      sumaExp(exps, t.f, i < nNum ? t.k : -t.k);
      if (t.neg) neg = !neg;
    }
    let N = 1, D = 1;
    Object.entries(exps).forEach(([p, e]) => { if (e > 0) N *= Number(p) ** e; else if (e < 0) D *= Number(p) ** -e; });
    if (N <= maxValor && D <= maxValor) return { num, den, neg, N, D, exps };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  Problemas de notación científica: el universo y el mundo atómico.
//  Los datos van como «m·10^{e}»; cada formato los convierte a su notación.
//  Cada plantilla → { emoji, enun, op, v } (op: la operación a realizar)
// ═════════════════════════════════════════════════════════════════════════════
const fmtSci = (m, e) => `${String(m).replace('.', ',')}·10^{${e}}`;
const fmtDec = (x) => String(x).replace('.', ',');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const AL = fmtSci(9.46, 12); // año luz en km
const C_LUZ = fmtSci(3, 5);  // km/s
export const PROBLEMAS_SCI = [
  () => ({ emoji: '🌍', enun: `La masa de la Tierra es ${fmtSci(5.97, 24)} kg y la de la Luna ${fmtSci(7.35, 22)} kg. ¿Cuántas veces es mayor la masa de la Tierra que la de la Luna?`, op: `${fmtSci(5.97, 24)} : ${fmtSci(7.35, 22)}`, v: 5.97e24 / 7.35e22 }),
  () => ({ emoji: '☀️', enun: `La masa del Sol es ${fmtSci(1.99, 30)} kg y la de la Tierra ${fmtSci(5.97, 24)} kg. ¿Cuántas Tierras harían falta para igualar la masa del Sol?`, op: `${fmtSci(1.99, 30)} : ${fmtSci(5.97, 24)}`, v: 1.99e30 / 5.97e24 }),
  () => {
    const [pl, t, txt] = pick([['la Tierra', 500, '8 minutos y 20 segundos'], ['Marte', 760, '12 minutos y 40 segundos'], ['Júpiter', 2600, '43 minutos y 20 segundos'], ['Saturno', 4750, '1 hora, 19 minutos y 10 segundos']]);
    return { emoji: '💡', enun: `La luz del Sol tarda ${txt} en llegar a ${pl}. Si la luz viaja a ${C_LUZ} km/s, ¿a qué distancia (en km) está ${pl} del Sol?`, op: `${txt} = ${t} s → ${C_LUZ} · ${t}`, v: 3e5 * t };
  },
  () => {
    const [st, d] = pick([['Próxima Centauri', 4.24], ['Sirio', 8.6], ['Vega', 25], ['la estrella Polar', 433], ['Betelgeuse', 548]]);
    return { emoji: '⭐', enun: `${cap(st)} está a ${fmtDec(d)} años luz de nosotros. Sabiendo que un año luz son ${AL} km, ¿a cuántos km está?`, op: `${fmtDec(d)} · ${AL}`, v: d * 9.46e12 };
  },
  () => ({ emoji: '🌌', enun: `La galaxia de Andrómeda está a ${fmtSci(2.5, 6)} años luz. Si un año luz son ${AL} km, ¿a cuántos km está Andrómeda?`, op: `${fmtSci(2.5, 6)} · ${AL}`, v: 2.5e6 * 9.46e12 }),
  () => { const k = rInt(1, 4); return { emoji: '🌌', enun: `La Vía Láctea tiene unas ${fmtSci(k, 11)} estrellas. Si la masa media de una estrella es ${fmtSci(2, 30)} kg, ¿cuál es la masa total de esas estrellas (en kg)?`, op: `${fmtSci(k, 11)} · ${fmtSci(2, 30)}`, v: k * 1e11 * 2e30 }; },
  () => ({ emoji: '⏳', enun: `El universo tiene unos ${fmtSci(1.38, 10)} años. Si un año tiene ${fmtSci(3.15, 7)} segundos, ¿cuántos segundos tiene el universo?`, op: `${fmtSci(1.38, 10)} · ${fmtSci(3.15, 7)}`, v: 1.38e10 * 3.15e7 }),
  () => ({ emoji: '🪐', enun: `En el universo observable hay unos 10^{80} átomos. Si todos fueran de hidrógeno, con una masa de ${fmtSci(1.67, -27)} kg cada uno, ¿cuál sería la masa total (en kg)?`, op: `10^{80} · ${fmtSci(1.67, -27)}`, v: 1e80 * 1.67e-27 }),
  () => ({ emoji: '🌍', enun: `El radio de la Tierra mide ${fmtSci(6.37, 6)} m. Calcula su volumen en m³ (V = 4/3·π·r³).`, op: `4/3 · π · (${fmtSci(6.37, 6)})³`, v: (4 / 3) * Math.PI * 6.37e6 ** 3 }),
  () => ({ emoji: '🌙', enun: `La Luna está a ${fmtSci(3.84, 5)} km de la Tierra. Si la luz viaja a ${C_LUZ} km/s, ¿cuántos segundos tarda la luz de la Luna en llegarnos?`, op: `${fmtSci(3.84, 5)} : ${C_LUZ}`, v: 3.84e5 / 3e5 }),
  () => {
    const [txt, L, Ls] = pick([['1 mm', 1e-3, '10^{-3}'], ['1 cm', 1e-2, '10^{-2}'], ['1 m', 1, '1']]);
    return { emoji: '⚛️', enun: `Un átomo de hidrógeno tiene un diámetro de ${fmtSci(1.06, -10)} m. ¿Cuántos átomos de hidrógeno habría que poner en fila para formar una línea de ${txt}?`, op: `${Ls} : ${fmtSci(1.06, -10)}`, v: L / 1.06e-10 };
  },
  () => ({ emoji: '⚛️', enun: `El radio de un átomo de oro es ${fmtSci(1.44, -10)} m y el de su núcleo ${fmtSci(7.3, -15)} m. ¿Cuántas veces es mayor el átomo que su núcleo?`, op: `${fmtSci(1.44, -10)} : ${fmtSci(7.3, -15)}`, v: 1.44e-10 / 7.3e-15 }),
  () => ({ emoji: '🔬', enun: `La masa de un protón es ${fmtSci(1.67, -27)} kg y la de un electrón ${fmtSci(9.11, -31)} kg. ¿Cuántas veces es mayor la masa del protón?`, op: `${fmtSci(1.67, -27)} : ${fmtSci(9.11, -31)}`, v: 1.67e-27 / 9.11e-31 }),
  () => { const g = pick([1, 5, 12, 100]); return { emoji: '✏️', enun: `Un átomo de carbono tiene una masa de ${fmtSci(1.99, -23)} g. ¿Cuántos átomos de carbono hay en ${g} g de grafito?`, op: `${g} : ${fmtSci(1.99, -23)}`, v: g / 1.99e-23 }; },
  () => {
    const [txt, kg] = pick([['un vaso de agua (250 g)', 0.25], ['una botella de 1 litro (1 kg)', 1], ['una garrafa de 5 litros (5 kg)', 5]]);
    return { emoji: '💧', enun: `Una molécula de agua tiene una masa de ${fmtSci(2.99, -26)} kg. ¿Cuántas moléculas hay en ${txt}?`, op: `${fmtDec(kg)} : ${fmtSci(2.99, -26)}`, v: kg / 2.99e-26 };
  },
  () => ({ emoji: '🩸', enun: `Un glóbulo rojo mide unos ${fmtSci(7, -6)} m de diámetro. ¿Cuántos glóbulos rojos en fila caben en 1 m?`, op: `1 : ${fmtSci(7, -6)}`, v: 1 / 7e-6 }),
  () => ({ emoji: '🦠', enun: `Una bacteria mide ${fmtSci(2, -6)} m y un virus ${fmtSci(1, -7)} m. ¿Cuántas veces es mayor la bacteria que el virus?`, op: `${fmtSci(2, -6)} : ${fmtSci(1, -7)}`, v: 2e-6 / 1e-7 }),
];
// Valor → notación científica con la mantisa redondeada a 2 decimales
export const aSci = (v) => {
  let E = Math.floor(Math.log10(Math.abs(v)));
  let m = Math.round((v / 10 ** E) * 100) / 100;
  if (m >= 10) { m = Math.round(m) / 10; E++; }
  return { mant: m, exp: E };
};
// n problemas distintos (se repiten solo si se piden más que plantillas hay)
export const problemasCientifica = (n) => {
  const orden = shuffle(PROBLEMAS_SCI.map((_, i) => i));
  return Array.from({ length: n }, (_, i) => { const p = PROBLEMAS_SCI[orden[i % orden.length]](); return { ...p, ...aSci(p.v) }; });
};

// ═════════════════════════════════════════════════════════════════════════════
//  Radicales
// ═════════════════════════════════════════════════════════════════════════════
// Ej. 6: ⁿ√aᵐ (o 1/ⁿ√aᵐ si inv) → a^(±m/n)
export function datosRadPotencia() {
  const a = pick([2, 3, 5, 7, 10]), idx = pick([2, 3, 4, 5]); let m = rInt(1, 7); if (m === idx) m++;
  const inv = Math.random() < 0.3;
  return { a, idx, m, inv, exp: (inv ? -m : m) / idx };
}
// Ej. 7: a^(m/n) → ⁿ√aᵐ
export function datosPotRadical() {
  const a = pick([2, 3, 5, 7]), idx = pick([2, 3, 4, 5]);
  let m = rInt(1, idx + 2); while (gcd(m, idx) !== 1) m = rInt(1, idx + 2);
  return { a, idx, m, rad: a ** m };
}
// Ej. 8: ⁿ√(fⁿ·r) = f·ⁿ√r
const EXTRAER_CFG = { 2: { f: [2, 6], r: SQFREE }, 3: { f: [2, 4], r: [2, 3, 4, 5, 6, 7, 9, 10] }, 4: { f: [2, 3], r: [2, 3, 5, 6, 7, 8] } };
export function datosExtraer(indices = [2, 2, 2, 3, 3, 4]) {
  const idx = pick(indices), cfg = EXTRAER_CFG[idx];
  const f = rInt(cfg.f[0], cfg.f[1]), r = pick(cfg.r);
  return { idx, f, r, radicando: f ** idx * r };
}
// Ej. 9: c·ⁿ√r = ⁿ√(cⁿ·r)
export function datosIntroducir() {
  const idx = pick([2, 2, 3, 3, 4]); let c, r;
  do { c = rInt(2, 5); r = pick([2, 3, 5, 7, 10]); } while (c ** idx * r > 2500);
  return { idx, c, r, rad: c ** idx * r };
}
// Ej. 10: ⁿᵏ√a^(mk) = ⁿ√aᵐ
export function datosSimpRaiz() {
  const a = pick([2, 3, 5, 7]), idx = pick([2, 3, 4, 5]), k = pick([2, 3]);
  let m = rInt(1, idx - 1); while (gcd(m, idx) !== 1) m = rInt(1, idx - 1);
  return { a, idx, m, k, rad: a ** m };
}
// Ej. 15: c1·ⁿ√(f1ⁿ·r) ± c2·ⁿ√(f2ⁿ·r) = total·ⁿ√r
export function datosSumar() {
  const idx = Math.random() < 0.35 ? 3 : 2;
  const r = idx === 2 ? pick(SQFREE) : pick([2, 3, 5]);
  const fMax = idx === 2 ? 4 : 3;
  const f1 = rInt(1, fMax), f2 = rInt(1, fMax), c1 = rInt(1, 3), c2 = rInt(1, 3);
  const t1 = c1 * f1, t2 = c2 * f2;
  const minus = Math.random() < 0.4 && t1 > t2;
  return { idx, r, f1, f2, c1, c2, minus, total: minus ? t1 - t2 : t1 + t2 };
}
// Ej. 11 y 14: índice común → un único radical. terminos: [{ n, b, p, den? }]
export function radicalUnico(terminos) {
  const L = terminos.reduce((acc, t) => lcm(acc, t.n), 1);
  const exps = {};
  terminos.forEach((t) => sumaExp(exps, factoriza(t.b), (t.den ? -1 : 1) * t.p * (L / t.n)));
  const vals = Object.values(exps);
  if (vals.some((e) => e < 0 || e >= L) || !vals.some((e) => e > 0)) return null;
  if (vals.filter((e) => e > 0).reduce(gcd, L) !== 1) return null;
  const valor = Object.entries(exps).reduce((acc, [p, e]) => acc * Number(p) ** e, 1);
  return valor > 2e6 ? null : { idx: L, rad: valor };
}
// → { tipo: 'prod', n1, a, n2, b, ans } | { tipo: 'coc', a, n1, p1, n2, p2, ans }
export function datosIndiceComun() {
  for (;;) {
    if (Math.random() < 0.6) {
      const n1 = pick([2, 3, 4]); let n2 = pick([2, 3, 4]); while (n2 === n1) n2 = pick([2, 3, 4]);
      const a = pick([2, 3, 5, 7]), b = pick([2, 3, 5, 7]);
      const ans = radicalUnico([{ n: n1, b: a, p: 1 }, { n: n2, b, p: 1 }]);
      if (ans) return { tipo: 'prod', n1, a, n2, b, ans };
    } else {
      const a = pick([2, 3, 5]), n1 = pick([2, 3, 4, 6]); let n2 = pick([2, 3, 4]); while (n2 === n1) n2 = pick([2, 3, 4]);
      let p1 = rInt(1, n1 + 1); while (gcd(p1, n1) !== 1) p1 = rInt(1, n1 + 1);
      let p2 = rInt(1, Math.max(1, n2 - 1)); while (gcd(p2, n2) !== 1) p2 = rInt(1, Math.max(1, n2 - 1));
      const ans = radicalUnico([{ n: n1, b: a, p: p1 }, { n: n2, b: a, p: p2, den: true }]);
      if (ans) return { tipo: 'coc', a, n1, p1, n2, p2, ans };
    }
  }
}
// Ej. 12: ⁿ¹√a frente a ⁿ²√b (valores parecidos) → mayor 'A' | 'B'
export function datosComparar() {
  for (;;) {
    const n1 = pick([2, 3, 4]); let n2 = pick([2, 3, 4, 6]); while (n2 === n1) n2 = pick([2, 3, 4, 6]);
    const a = rInt(2, 30), b = rInt(2, 30);
    if (esPotenciaExacta(a, n1) || esPotenciaExacta(b, n2)) continue;
    const L = lcm(n1, n2), A = a ** (L / n1), B = b ** (L / n2);
    if (A === B || Math.abs(Math.log(A / B)) / L > 0.12) continue;
    return { n1, a, n2, b, L, A, B, mayor: A > B ? 'A' : 'B' };
  }
}
// Ej. 16: raíz de raíz → { tipo: 'simple', k1, k2, a } | { tipo: 'coef', k1, k2, c, b } | { tipo: 'triple', a }, con ans
export function datosRaizRaiz() {
  for (;;) {
    const tipo = pick(['simple', 'coef', 'coef', 'triple']);
    if (tipo === 'simple') { const k1 = pick([2, 3]), k2 = pick([2, 3]), a = pick([2, 3, 5, 7]); return { tipo, k1, k2, a, ans: { idx: k1 * k2, rad: a } }; }
    if (tipo === 'coef') {
      const k1 = pick([2, 3]), k2 = pick([2, 3]), c = pick([2, 3, 5]), b = pick([2, 3, 5, 7]);
      const valor = c ** k2 * b;
      if (radSimplificado(k1 * k2, valor)) return { tipo, k1, k2, c, b, ans: { idx: k1 * k2, rad: valor } };
      continue;
    }
    const a = pick([2, 3]); return { tipo, a, ans: { idx: 8, rad: a ** 7 } };
  }
}
// Ej. 17: racionalizar
//  mono: c / ⁿ√aᵐ = k·ⁿ√a^(n−m) / d       conj: c / (√a ± √b) = k·(√a ∓ √b) / d
export function datosRacionalizar() {
  if (Math.random() < 0.6) {
    const c = rInt(1, 9), idx = pick([2, 2, 3, 4, 5]), m = rInt(1, idx - 1), a = pick([2, 3, 5, 7]);
    const g = gcd(c, a);
    return { tipo: 'mono', c, idx, m, a, radNum: a ** (idx - m), k: c / g, d: a / g, valor: c / a ** (m / idx) };
  }
  let a = pick(SQFREE), b = pick(SQFREE); while (a === b) b = pick(SQFREE);
  if (a < b) [a, b] = [b, a];
  const c = rInt(1, 6), mas = Math.random() < 0.5, g = gcd(c, a - b);
  return { tipo: 'conj', c, a, b, mas, k: c / g, d: (a - b) / g, valor: c / (Math.sqrt(a) + (mas ? 1 : -1) * Math.sqrt(b)) };
}
