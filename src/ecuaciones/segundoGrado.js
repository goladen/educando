// ─────────────────────────────────────────────────────────────────────────────
//  Ecuaciones de 2.º grado para Ecuaciones.jsx (tipo 'CUADRATICA', 2 casillas):
//   · cuadCompleta   ax² + bx + c = 0 (b ≠ 0, c ≠ 0)
//   · cuadIncompleta alterna una de cada: sin b (ax² + c = 0) y sin c (ax² + bx = 0)
//   · cuadCompleja   hay que trasponer términos, quitar paréntesis o denominadores
//  Soluciones siempre enteras; cada una trae `pasos` (resolución).
// ─────────────────────────────────────────────────────────────────────────────
import { poli, lin, MENOS } from './ecuacionesAvanzadas';

const rInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rNZ = (a, b) => { let v = 0; while (v === 0) v = rInt(a, b); return v; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const num = (v) => (v < 0 ? MENOS + Math.abs(v) : String(v));
const mcm = (a, b) => (a * b) / gcd(a, b);

// Raíces enteras de A·x² + B·x + C = 0 (o null)
const raicesEnteras = (A, B, C) => {
    if (!A) return null;
    const D = B * B - 4 * A * C;
    if (D < 0) return null;
    const s = Math.round(Math.sqrt(D));
    if (s * s !== D) return null;
    const r1 = (-B - s) / (2 * A), r2 = (-B + s) / (2 * A);
    return Number.isInteger(r1) && Number.isInteger(r2) ? [r1, r2].sort((a, b) => a - b) : null;
};
// Divide por el m.c.d. y deja positivo el coeficiente de x²
const simplificar = ([A, B, C]) => {
    const g = gcd(gcd(A, B), C) || 1, s = A < 0 ? -1 : 1;
    return [A / g * s, B / g * s, C / g * s];
};
const sumaP = (p, q, k = 1) => p.map((v, i) => v + k * q[i]);
const desdeRaices = (A, r1, r2) => [A, -A * (r1 + r2), A * r1 * r2];
const T = (v) => ({ t: 'text', v });
const F = (n, d) => ({ t: 'frac', n, d });
// Mismo formato que las ecuaciones de grado mayor (tipo 'MULTI'): una casilla con
// las soluciones separadas por «;», corrección de cada una, pasos y solución gráfica.
const CUAD = (ast, sols, pasos) => ({
    ast, correctAnswers: [...sols].sort((a, b) => a - b), multipleChoice: null,
    tipo: 'MULTI', sub: 'CUAD', descartadas: [], pasos,
    instruccion: 'Escribe las soluciones separadas por ;  (p. ej. 3 ; −2). Si no tiene solución real, pulsa ∅',
    sinSolucionPosible: true, // EntradaSoluciones muestra el botón «∅ Sin solución»
});
// x² − 2hx + (h² + k), k > 0  →  Δ = −4k < 0: sin solución real
const sinRaices = () => { const h = rNZ(-4, 4), k = rInt(1, 9); return [1, -2 * h, h * h + k]; };
const PROB_SIN_SOL = 1 / 4; // 1 de cada 4 sin solución real (petición del usuario)

// Resolución paso a paso de A·x² + B·x + C = 0.
// Incompletas: despeje (b = 0) o factor común (c = 0). Completas: fórmula con
// sustitución formal de a, b y c, discriminante y su raíz.
// (FRAC(n,d) y √{…} los pinta MathText / MathRender)
const par = (v) => (v < 0 ? `(${num(v)})` : num(v));
export function resolver(Q) {
    // Completas: se simplifica antes de aplicar la fórmula. Incompletas: no (así se ve
    // el despeje x² = −c/a o el factor común con su coeficiente); solo se cambia el signo si a < 0.
    const incompleta = Q[1] === 0 || Q[2] === 0;
    const g = incompleta ? 1 : gcd(gcd(Q[0], Q[1]), Q[2]) || 1, sg = Q[0] < 0 ? -1 : 1;
    const pasos = [];
    if (g > 1 || sg < 0) {
        const k = g * sg;
        pasos.push(k === -1 ? `Multiplicamos por −1:  ${poli(Q.map((v) => -v))} = 0` : `Simplificamos dividiendo entre ${num(k)}:  ${poli(Q.map((v) => v / k))} = 0`);
    }
    const [A, B, C] = Q.map((v) => v / (g * sg));
    if (C === 0) {
        const r = -B / A;
        return [...pasos,
            'Es incompleta (c = 0): sacamos factor común x',
            `x·(${lin(A, B)}) = 0`,
            `Un producto vale 0 si alguno de los factores es 0:  x = 0  o  ${lin(A, B)} = 0`,
            A === 1 ? `${lin(A, B)} = 0  →  x = ${num(r)}` : `${lin(A, B)} = 0  →  ${A}x = ${num(-B)}  →  x = FRAC(${num(-B)},${A}) = ${num(r)}`,
            `Soluciones:  x₁ = ${num(Math.min(0, r))} ; x₂ = ${num(Math.max(0, r))}`];
    }
    if (B === 0) {
        const q = -C / A, r = Math.sqrt(q);
        if (q < 0) {
            return [...pasos,
                'Es incompleta (b = 0): despejamos x²',
                A === 1 ? `x² = ${num(-C)}` : `${A}x² = ${num(-C)}  →  x² = FRAC(${num(-C)},${A}) = ${num(q)}`,
                `x² = ${num(q)} es negativo: ningún número real elevado al cuadrado da un resultado negativo`,
                'La ecuación no tiene solución real (∅)'];
        }
        return [...pasos,
            'Es incompleta (b = 0): despejamos x²',
            A === 1 ? `x² = ${num(-C)}` : `${A}x² = ${num(-C)}  →  x² = FRAC(${num(-C)},${A}) = ${num(q)}`,
            `x = ±√{${num(q)}} = ±${num(r)}`,
            `Soluciones:  x₁ = ${num(-r)} ; x₂ = ${num(r)}`];
    }
    const D = B * B - 4 * A * C, s = Math.round(Math.sqrt(Math.max(0, D))), ac4 = 4 * A * C;
    const x1 = (-B + s) / (2 * A), x2 = (-B - s) / (2 * A);
    const inicio = [...pasos,
        `Identificamos los coeficientes:  a = ${num(A)} ;  b = ${num(B)} ;  c = ${num(C)}`,
        `Fórmula:  x = FRAC(${MENOS}b ± √{b² ${MENOS} 4ac},2a)`,
        `Sustituimos:  x = FRAC(${MENOS}${par(B)} ± √{${par(B)}² ${MENOS} 4·${par(A)}·${par(C)}},2·${par(A)})`,
        `Discriminante:  Δ = b² ${MENOS} 4ac = ${B * B} ${ac4 < 0 ? '+' : MENOS} ${Math.abs(ac4)} = ${num(D)}`,
    ];
    if (D < 0) {
        return [...inicio,
            `Δ = ${num(D)} < 0: √{${num(D)}} no es un número real (ningún número al cuadrado da negativo)`,
            'La ecuación no tiene solución real (∅). Su parábola no corta al eje X.'];
    }
    return [...inicio,
        `Raíz del discriminante:  √{${D}} = ${s}${D > 0 ? '  (Δ > 0: hay dos soluciones)' : '  (Δ = 0: solución doble)'}`,
        `x = FRAC(${num(-B)} ± ${s},${2 * A})`,
        `x₁ = FRAC(${num(-B)} + ${s},${2 * A}) = ${num(x1)} ;  x₂ = FRAC(${num(-B)} ${MENOS} ${s},${2 * A}) = ${num(x2)}`,
    ];
}

// Raíces distintas no nulas en [−L, L]
const dosRaices = (L, { sinCero = true, sumaNoNula = false } = {}) => {
    for (;;) {
        const r1 = rInt(-L, L), r2 = rInt(-L, L);
        if (r1 === r2 || (sinCero && (r1 === 0 || r2 === 0)) || (sumaNoNula && r1 + r2 === 0)) continue;
        return [r1, r2].sort((a, b) => a - b);
    }
};

// ─── Completas ───────────────────────────────────────────────────────────────
// opt.sinSol (por defecto true): de vez en cuando, una sin solución real
export function cuadCompleta(lim = 10, opt = {}) {
    const L = Math.max(2, Math.min(7, lim));
    const A = pick([1, 1, 1, 2, 3, -1]);
    if (opt.sinSol !== false && Math.random() < PROB_SIN_SOL) {
        const Q = sinRaices().map((v) => v * A);
        return CUAD([T(`${poli(Q)} = 0`)], [], resolver(Q));
    }
    const [r1, r2] = dosRaices(L, { sumaNoNula: true });
    const Q = desdeRaices(A, r1, r2);
    return CUAD([T(`${poli(Q)} = 0`)], [r1, r2], resolver(Q));
}

// ─── Incompletas: alternan sin b y sin c ────────────────────────────────────
let turnoIncompleta = 0;
export function cuadIncompleta(lim = 10, opt = {}) {
    const L = Math.max(2, Math.min(7, lim));
    turnoIncompleta++;
    const a = pick([1, 1, 2, 3, 4, 5]);
    // la mitad de las b = 0 → 1 de cada 4 incompletas sin solución real
    if (turnoIncompleta % 2 && opt.sinSol !== false && Math.random() < 0.5) {
        // b = 0 sin solución real: ax² + c = 0 con c > 0 (a veces escrita ax² = −c)
        const c = a * rInt(1, 9);
        const ecu = Math.random() < 0.35 ? `${poli([a, 0, 0])} = ${num(-c)}` : `${poli([a, 0, c])} = 0`;
        return CUAD([T(ecu)], [], resolver([a, 0, c]));
    }
    if (turnoIncompleta % 2) {
        // b = 0: ax² − a·r² = 0  (a veces escrita como ax² = a·r²)
        const r = rInt(1, L), c = a * r * r;
        const ecu = Math.random() < 0.35 ? `${poli([a, 0, 0])} = ${c}` : `${poli([a, 0, -c])} = 0`;
        return CUAD([T(ecu)], [-r, r], resolver([a, 0, -c]));
    }
    // c = 0: ax² + bx = 0 con −b/a entero
    const r = rNZ(-L, L), b = -a * r;
    return CUAD([T(`${poli([a, b, 0])} = 0`)], [0, r], resolver([a, b, 0]));
}

// ─── Complejas: trasponer, paréntesis, denominadores ────────────────────────
export function cuadCompleja(lim = 10, opt = {}) {
    const L = Math.max(3, Math.min(7, lim));
    // a veces, sin solución real (solo en las familias que parten del polinomio final)
    const sinReal = opt.sinSol !== false && Math.random() < PROB_SIN_SOL;
    const fam = pick(sinReal ? ['trasponer', 'cuadrado', 'producto', 'xPorParentesis'] : ['trasponer', 'cuadrado', 'producto', 'xPorParentesis', 'denominadores', 'denominadorCuadrado']);
    for (let it = 0; it < 4000; it++) {
        let [r1, r2] = dosRaices(L, { sinCero: false });
        const base = sinReal ? sinRaices() : null;
        const Q1 = base || desdeRaices(1, r1, r2); // x² − Sx + P
        const desdeRaicesO = (A) => (base ? base.map((v) => v * A) : desdeRaices(A, r1, r2));
        if (sinReal) { r1 = null; r2 = null; }
        const CUADs = (ast, sols, pasos) => CUAD(ast, sinReal ? [] : sols, pasos);
        if (fam === 'trasponer') {
            const A = pick([1, 1, 2]);
            const Q = desdeRaicesO(A);
            const Rd = [pick([0, 0, 1, 2, -1]), rInt(-6, 6), rInt(-12, 12)];
            if (Rd.every((v) => v === 0)) continue;
            const Lz = sumaP(Q, Rd);
            if (Lz[0] === 0) continue;
            return CUADs([T(`${poli(Lz)} = ${poli(Rd)}`)], [r1, r2],
                [`Pasamos todos los términos al primer miembro y agrupamos:  ${poli(Q)} = 0`, ...resolver(Q)]);
        }
        if (fam === 'cuadrado') {
            // (x + p)² = R(x)  con  R = (x + p)² − Q
            const p = rNZ(-5, 5), K = [1, 2 * p, p * p], Rd = sumaP(K, Q1, -1);
            if (Rd.every((v) => v === 0)) continue;
            return CUADs([T(`(${lin(1, p)})² = ${poli(Rd)}`)], [r1, r2],
                [`Desarrollamos el cuadrado:  ${poli(K)} = ${poli(Rd)}`, `Trasponemos:  ${poli(Q1)} = 0`, ...resolver(Q1)]);
        }
        if (fam === 'producto') {
            // k(x + p)(x − q) = R(x)
            const k = pick([1, 2, 3]), p = rNZ(-5, 5), q = rNZ(-5, 5), A = pick([1, 2]);
            const K = [k, k * (p - q), -k * p * q], Q = desdeRaicesO(A), Rd = sumaP(K, Q, -1);
            if (Rd.every((v) => v === 0) || p === -q) continue;
            return CUADs([T(`${k === 1 ? '' : k}(${lin(1, p)})(${lin(1, -q)}) = ${poli(Rd)}`)], [r1, r2],
                [`Quitamos paréntesis:  ${poli(K)} = ${poli(Rd)}`, `Trasponemos:  ${poli(Q)} = 0`, ...resolver(Q)]);
        }
        if (fam === 'xPorParentesis') {
            // x(x + p) − k(x − q) = s  ⇔  x² + (p − k)x + kq − s = 0
            const k = pick([2, 3, 4, 5]), p = Q1[1] + k, q = rNZ(-5, 5), s = k * q - Q1[2];
            if (p === 0) continue;
            return CUADs([T(`x(${lin(1, p)}) ${MENOS} ${k}(${lin(1, -q)}) = ${num(s)}`)], [r1, r2],
                [`Quitamos paréntesis:  ${poli([1, p, 0])} ${MENOS} ${k}x ${k * q < 0 ? MENOS : '+'} ${Math.abs(k * q)} = ${num(s)}`, `Agrupamos:  ${poli(Q1)} = 0`, ...resolver(Q1)]);
        }
        if (fam === 'denominadores') {
            // (x² + αx)/d1 = (βx + γ)/d2
            const d1 = pick([2, 3, 4, 5, 6]), d2 = pick([2, 3, 4, 5, 6]);
            if (d1 === d2) continue;
            const al = rInt(-6, 6), be = rNZ(-6, 6), ga = rInt(-12, 12), m = mcm(d1, d2);
            const Q = [m / d1, (m / d1) * al - (m / d2) * be, -(m / d2) * ga];
            const r = raicesEnteras(...Q);
            if (!r || r[0] === r[1] || Math.abs(r[0]) > 9 || Math.abs(r[1]) > 9) continue;
            return CUADs([F(poli([1, al, 0]), d1), T(' = '), F(lin(be, ga), d2)], r,
                [`m.c.m.(${d1}, ${d2}) = ${m}`, `Multiplicamos por ${m}:  ${m / d1 === 1 ? '' : m / d1}(${poli([1, al, 0])}) = ${m / d2 === 1 ? '' : m / d2}(${lin(be, ga)})`, `Trasponemos:  ${poli(Q)} = 0`, ...resolver(Q)]);
        }
        // (x − p)²/d1 − x/d2 = c
        const d1 = pick([2, 3, 4]), d2 = pick([2, 3, 4, 6]), p = rNZ(-4, 4), c = rInt(-6, 6), m = mcm(d1, d2);
        const Q = sumaP(sumaP([m / d1, -2 * p * (m / d1), p * p * (m / d1)], [0, m / d2, 0], -1), [0, 0, m * c], -1);
        const r = raicesEnteras(...Q);
        if (!r || r[0] === r[1] || Math.abs(r[0]) > 12 || Math.abs(r[1]) > 12) continue;
        return CUADs([F(`(${lin(1, -p)})²`, d1), T(` ${MENOS} `), F('x', d2), T(` = ${num(c)}`)], r,
            [`m.c.m.(${d1}, ${d2}) = ${m}`, `Multiplicamos por ${m}:  ${m / d1 === 1 ? '' : m / d1}(${lin(1, -p)})² ${MENOS} ${m / d2 === 1 ? '' : m / d2}x = ${m * c}`, `Desarrollamos y trasponemos:  ${poli(Q)} = 0`, ...resolver(Q)]);
    }
    return cuadCompleta(lim, opt);
}
