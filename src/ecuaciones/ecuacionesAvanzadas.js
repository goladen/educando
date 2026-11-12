// ─────────────────────────────────────────────────────────────────────────────
//  Ecuaciones avanzadas + problemas para Ecuaciones.jsx (motor puro, sin React)
//
//  Cada generador devuelve una «pregunta» con el mismo formato que usa
//  Ecuaciones.jsx, pero con tipo 'MULTI':
//    { ast, tipo:'MULTI', sub, correctAnswers:[números ordenados],
//      descartadas:[…], pasos:[texto con marcado], grados?, etiqueta?, unidad?,
//      instruccion? }
//
//  Marcado de texto (lo pinta MathText en UIEcuaciones.jsx):
//    ^{…} exponente · _{…} subíndice · √{…} raíz con barra
//  Elementos del ast nuevos: {t:'m', v} (texto con marcado) y {t:'mfrac', n, d}.
// ─────────────────────────────────────────────────────────────────────────────

const rInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rNZ = (a, b) => { let v = 0; while (v === 0) v = rInt(a, b); return v; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const gcdN = (...xs) => xs.reduce((g, x) => gcd(g, x), 0) || 1;
const esEntero = (v) => Math.abs(v - Math.round(v)) < 1e-9;

export const MENOS = '−';
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const supNum = (n) => String(n).replace(/\d/g, (d) => SUPS[d]);

// ─── Formato de números y expresiones ────────────────────────────────────────
export const fracStr = (v) => {
    if (!isFinite(v)) return '?';
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-9) return (r < 0 ? MENOS : '') + Math.abs(r);
    for (let d = 2; d <= 400; d++) {
        const n = Math.round(v * d);
        if (Math.abs(n / d - v) < 1e-9) return (n < 0 ? MENOS : '') + `${Math.abs(n)}/${d}`;
    }
    return String(+v.toFixed(3)).replace('-', MENOS);
};
const num = fracStr;

// Separador entre coeficiente y literal: 6·2^{x}, 2 sen x, 3x
const conPunto = (lit) => (/^[0-9(√]/.test(lit) ? '·' : (/^[a-z]/i.test(lit) && lit.length > 2 ? ' ' : ''));
const term = (c, lit, primero) => {
    if (!c) return '';
    const a = Math.abs(c);
    const cuerpo = lit ? (a === 1 ? lit : `${num(a)}${conPunto(lit)}${lit}`) : num(a);
    if (primero) return (c < 0 ? MENOS : '') + cuerpo;
    return (c < 0 ? ` ${MENOS} ` : ' + ') + cuerpo;
};
const suma = (pares) => {
    let s = '';
    for (const [c, l] of pares) { if (!c) continue; s += term(c, l, s === ''); }
    return s || '0';
};
const potL = (g, v) => (g === 0 ? '' : g === 1 ? v : v + supNum(g));
const poli = (coefs, v = 'x') => suma(coefs.map((c, i) => [c, potL(coefs.length - 1 - i, v)]));
const lin = (a, b, v = 'x') => suma([[a, v], [b, '']]);
const par = (a, b, v = 'x') => (b === 0 && a === 1 ? v : `(${lin(a, b, v)})`);
const mul = (k, s) => (k === 1 ? s : k === -1 ? MENOS + s : `${num(k)}${/^[0-9]/.test(s) ? '·' : ''}${s}`);
const mulPoly = (A, B) => {
    const r = Array(A.length + B.length - 1).fill(0);
    A.forEach((a, i) => B.forEach((b, j) => { r[i + j] += a * b; }));
    return r;
};

const uniqSort = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const out = [];
    for (const v of s) if (!out.length || Math.abs(out[out.length - 1] - v) > 1e-9) out.push(v);
    return out;
};

// Raíces racionales de A·x² + B·x + C = 0 (enteros). null si son irracionales.
const raicesCuad = (A, B, C) => {
    const D = B * B - 4 * A * C;
    if (D < 0) return [];
    const sD = Math.round(Math.sqrt(D));
    if (sD * sD !== D) return null;
    return uniqSort([(-B - sD) / (2 * A), (-B + sD) / (2 * A)]);
};
const simplificar = (coefs) => {
    const g = gcdN(...coefs.map((c) => Math.round(c)));
    const s = coefs.find((c) => c !== 0) < 0 ? -1 : 1;
    return coefs.map((c) => (c / g) * s);
};

// ─── Constructores ───────────────────────────────────────────────────────────
const M = (v) => ({ t: 'm', v });
const FR = (n, d) => ({ t: 'mfrac', n: String(n), d: String(d) });
const EN = (v) => ({ t: 'enunciado', v });
const solsTxt = (xs, v = 'x') => uniqSort(xs).map((x) => `${v} = ${num(x)}`).join(' ; ');
const R = (sub, ast, sols, extra = {}) => ({
    ast, tipo: 'MULTI', sub,
    correctAnswers: uniqSort(sols),
    multipleChoice: null,
    descartadas: [], pasos: [],
    ...extra,
    ...(extra.descartadas ? { descartadas: uniqSort(extra.descartadas) } : {}),
});
// Término fracción con su signo delante: [' − ', a/(x−2)]
const fracTerm = (c, d, primero) => (c < 0
    ? [M(primero ? MENOS : ` ${MENOS} `), FR(num(Math.abs(c)), d)]
    : [...(primero ? [] : [M(' + ')]), FR(num(c), d)]);
const denX = (p) => lin(1, -p);
// (x − p)(x − q) con la x suelta delante: x(x − 3)
const prodFact = (p, q) => (q === 0 ? `x${par(1, -p)}` : `${par(1, -p)}${par(1, -q)}`);
const expBase = (m, a) => (m === 1 ? lin(1, a) : mul(m, par(1, a)));

// ═════════════════════════════════════════════════════════════════════════════
//  BICUADRADAS (x⁴ y x⁶)
// ═════════════════════════════════════════════════════════════════════════════
function genBicuadrada() {
    if (Math.random() < 0.6) {
        const pool = [-9, -4, -1, 0, 1, 4, 9, 16, 25, 36];
        let t1, t2;
        do { t1 = pick(pool); t2 = pick(pool); } while (t1 >= t2 || t2 < 0 || Math.abs(t1 * t2) > 225);
        const a = pick([1, 1, 1, 1, 2, -1]);
        const B = -a * (t1 + t2), C = a * t1 * t2;
        const sols = [];
        const pasos = [
            `Cambio de variable: t = x²  →  ${poli([a, B, C], 't')} = 0`,
            `Resolvemos en t:  t = ${num(t1)} ; t = ${num(t2)}`,
        ];
        for (const t of [t1, t2]) {
            if (t > 0) { const r = Math.sqrt(t); sols.push(r, -r); pasos.push(`x² = ${t}  →  x = ±${r}`); }
            else if (t === 0) { sols.push(0); pasos.push('x² = 0  →  x = 0'); }
            else pasos.push(`x² = ${num(t)}  →  sin solución real`);
        }
        return R('BICUAD', [M(`${poli([a, 0, B, 0, C])} = 0`)], sols, { pasos });
    }
    // Trinomio de grado 6: cambio t = x³
    const pool = [-27, -8, -1, 0, 1, 8, 27, 64];
    let t1, t2;
    do { t1 = pick(pool); t2 = pick(pool); } while (t1 >= t2 || Math.abs(t1 * t2) > 216 || Math.abs(t1 + t2) > 72);
    const a = Math.abs(t1 * t2) <= 64 ? pick([1, 1, 1, 2]) : 1;
    const B = -a * (t1 + t2), C = a * t1 * t2;
    const sols = [];
    const pasos = [
        `Cambio de variable: t = x³  →  ${poli([a, B, C], 't')} = 0`,
        `Resolvemos en t:  t = ${num(t1)} ; t = ${num(t2)}`,
    ];
    for (const t of [t1, t2]) {
        const r = Math.round(Math.cbrt(t));
        sols.push(r);
        pasos.push(`x³ = ${num(t)}  →  x = ∛${t < 0 ? `(${num(t)})` : t} = ${num(r)}`);
    }
    return R('BICUAD', [M(`${poli([a, 0, 0, B, 0, 0, C])} = 0`)], sols, { pasos });
}

// ═════════════════════════════════════════════════════════════════════════════
//  RACIONALES (x en el denominador)
// ═════════════════════════════════════════════════════════════════════════════
function genRacional() {
    const k = pick([1, 2, 3, 3, 4, 4]);
    if (k === 1) {
        // x + a/x = b
        let r1, r2;
        do { r1 = rNZ(-6, 6); r2 = rNZ(-6, 6); } while (r1 === r2);
        const a = r1 * r2, b = r1 + r2;
        const ast = [M('x'), ...fracTerm(a, 'x', false), M(` = ${num(b)}`)];
        const pasos = [
            `Multiplicamos todo por x (x ≠ 0):  x²${term(a, '', false)} = ${b === 0 ? '0' : mul(b, 'x')}`,
            `${poli([1, -b, a])} = 0  →  ${solsTxt([r1, r2])}`,
            'Ninguna anula el denominador ✔',
        ];
        return R('RACIONAL', ast, [r1, r2], { pasos });
    }
    if (k === 2) {
        // a/(x−p) = b/(x−q)
        let X, p, q;
        do { X = rInt(-6, 8); p = rInt(-5, 5); q = rInt(-5, 5); } while (p === q || X === p || X === q);
        const kk = pick([1, 2, 3, -1, -2]);
        let a = kk * (X - p), b = kk * (X - q);
        const g = gcd(a, b); a /= g; b /= g;
        const ast = [FR(num(a), denX(p)), M(' = '), FR(num(b), denX(q))];
        const pasos = [
            `Multiplicamos en cruz:  ${mul(a, par(1, -q))} = ${mul(b, par(1, -p))}`,
            `${lin(a, -a * q)} = ${lin(b, -b * p)}`,
            `${lin(a - b, 0)} = ${num(a * q - b * p)}  →  x = ${num(X)}`,
            `x = ${num(X)} no anula ningún denominador ✔`,
        ];
        return R('RACIONAL', ast, [X], { pasos });
    }
    if (k === 3) {
        // a/(x−p) + b/(x−q) = 1
        for (let it = 0; it < 3000; it++) {
            const p = rInt(-4, 4), q = rInt(-4, 4);
            if (p >= q) continue;
            const r1 = rInt(-6, 9), r2 = rInt(-6, 9);
            if (r1 >= r2 || [p, q].includes(r1) || [p, q].includes(r2)) continue;
            const an = (r1 - p) * (r2 - p), bn = (r1 - q) * (r2 - q);
            if (an % (q - p) || bn % (p - q)) continue;
            const a = an / (q - p), b = bn / (p - q);
            if (!a || !b || Math.abs(a) > 15 || Math.abs(b) > 15) continue;
            const S = p + q + a + b, P = p * q + a * q + b * p;
            const mcm = prodFact(p, q);
            const ast = [...fracTerm(a, denX(p), true), ...fracTerm(b, denX(q), false), M(' = 1')];
            const pasos = [
                `m.c.m. de los denominadores = ${mcm}`,
                `Multiplicamos por el m.c.m.:  ${mul(a, par(1, -q))} ${b < 0 ? MENOS : '+'} ${mul(Math.abs(b), par(1, -p))} = ${mcm}`,
                `${poli([1, -S, P])} = 0  →  ${solsTxt([r1, r2])}`,
                'Ninguna anula los denominadores ✔',
            ];
            return R('RACIONAL', ast, [r1, r2], { pasos });
        }
    }
    // a/(x−p) + b/(x−q) = c/((x−p)(x−q)) + 1   — a veces con solución falsa
    for (let it = 0; it < 3000; it++) {
        const p = rInt(-4, 4), q = rInt(-4, 4);
        if (p >= q) continue;
        const extra = Math.random() < 0.6;
        const r1 = extra ? pick([p, q]) : rInt(-6, 8);
        const r2 = rInt(-6, 8);
        if (r1 === r2 || [p, q].includes(r2) || (!extra && [p, q].includes(r1))) continue;
        const a = rNZ(-4, 5);
        const b = r1 + r2 - p - q - a;
        if (!b || Math.abs(b) > 8) continue;
        const c = r1 * r2 - p * q - a * q - b * p;
        if (!c || Math.abs(c) > 40) continue;
        const den = poli([1, -(p + q), p * q]);
        const mcm = prodFact(p, q);
        const ast = [...fracTerm(a, denX(p), true), ...fracTerm(b, denX(q), false), M(' = '), ...fracTerm(c, den, true), M(' + 1')];
        const raices = uniqSort([r1, r2]);
        const validas = raices.filter((r) => r !== p && r !== q);
        const descartadas = raices.filter((r) => r === p || r === q);
        const pasos = [
            `Factorizamos:  ${den} = ${mcm}  (es el m.c.m.)`,
            `Multiplicamos por el m.c.m.:  ${mul(a, par(1, -q))} ${b < 0 ? MENOS : '+'} ${mul(Math.abs(b), par(1, -p))} = ${num(c)} + ${mcm}`,
            `${poli([1, -(r1 + r2), r1 * r2])} = 0  →  ${solsTxt(raices)}`,
            ...descartadas.map((r) => `x = ${num(r)} anula un denominador  →  se descarta ✘`),
            ...(descartadas.length ? [] : ['Ninguna anula los denominadores ✔']),
        ];
        return R('RACIONAL', ast, validas, { pasos, descartadas });
    }
    return genRacional();
}

// ═════════════════════════════════════════════════════════════════════════════
//  IRRACIONALES (una o dos raíces cuadradas)
// ═════════════════════════════════════════════════════════════════════════════
function genRadical1() {
    for (let it = 0; it < 3000; it++) {
        const m = pick([1, 1, -1]);
        const c = rInt(-4, 6);
        const r1 = rInt(-4, 10), r2 = rInt(-4, 10);
        if (r1 >= r2) continue;
        const S = r1 + r2, P = r1 * r2;
        const a = S + 2 * m * c, b = c * c - P;
        if (!a || Math.abs(a) > 20 || Math.abs(b) > 60) continue;
        const vale = (r) => m * r + c >= 0;
        const validas = [r1, r2].filter(vale);
        if (!validas.length) continue;
        const descartadas = [r1, r2].filter((r) => !vale(r));
        const rad = `√{${lin(a, b)}}`;
        const der = m === 1 ? lin(1, c) : suma([[c, ''], [-1, 'x']]);
        let ecu;
        if (m === 1) ecu = Math.random() < 0.6 ? `${rad} = ${der}` : `${rad} ${MENOS} x = ${num(c)}`;
        else ecu = `x + ${rad} = ${num(c)}`;
        const pasos = [
            `Aislamos la raíz:  ${rad} = ${der}`,
            `Elevamos al cuadrado:  ${lin(a, b)} = (${der})²`,
            `${poli([1, 2 * m * c - a, c * c - b])} = 0  →  ${solsTxt([r1, r2])}`,
            ...[r1, r2].map((r) => {
                const L = Math.sqrt(a * r + b), Rv = m * r + c;
                return vale(r)
                    ? `Comprobamos x = ${num(r)}:  √${a * r + b} = ${num(L)} y el otro lado da ${num(Rv)} ✔`
                    : `Comprobamos x = ${num(r)}:  √${a * r + b} = ${num(L)} ≠ ${num(Rv)}  →  se descarta ✘`;
            }),
        ];
        return R('RADICAL', [M(ecu)], validas, { pasos, descartadas });
    }
    return genRadical1();
}

function genRadical2() {
    for (let it = 0; it < 5000; it++) {
        const X = rInt(-3, 12), p = pick([1, 1, 2, 3]);
        const u = rInt(0, 6), v = rInt(0, 6), s = pick([1, -1]);
        if (u === 0 && v === 0) continue;
        const a = u * u - p * X, b = v * v - X;
        if (Math.abs(a) > 30 || Math.abs(b) > 30) continue;
        if (p === 1 && a === b) continue;
        const c = s === 1 ? u + v : u - v;
        if (c <= 0) continue;
        // √A = c − s√B  →  2cs√B = c² + B − A = αx + β  →  4c²B = (αx+β)²
        const al = 1 - p, be = c * c + b - a, c4 = 4 * c * c;
        let cand, ecFinal;
        if (al === 0) {
            const x0 = (be * be - c4 * b) / c4;
            cand = [x0];
            ecFinal = `${lin(c4, c4 * b - be * be)} = 0`;
        } else {
            const co = [al * al, 2 * al * be - c4, be * be - c4 * b];
            cand = raicesCuad(...co);
            if (!cand || !cand.length) continue;
            ecFinal = `${poli(simplificar(co))} = 0`;
        }
        const cumple = (x) => {
            const A1 = p * x + a, B1 = x + b;
            if (A1 < -1e-9 || B1 < -1e-9) return false;
            return Math.abs(Math.sqrt(Math.max(0, A1)) + s * Math.sqrt(Math.max(0, B1)) - c) < 1e-7;
        };
        const validas = cand.filter(cumple), descartadas = cand.filter((x) => !cumple(x));
        if (!validas.some((x) => Math.abs(x - X) < 1e-9)) continue;
        if (!validas.every(esEntero)) continue;
        const rA = `√{${lin(p, a)}}`, rB = `√{${lin(1, b)}}`;
        const sg = s > 0 ? '+' : MENOS, sgOp = s > 0 ? MENOS : '+';
        const pasos = [
            `Aislamos una raíz:  ${rA} = ${c} ${sgOp} ${rB}`,
            `Elevamos al cuadrado:  ${lin(p, a)} = ${c * c} ${sgOp} ${2 * c}${rB}${term(1, 'x', false)}${term(b, '', false)}`,
            `Dejamos sola la raíz:  ${s > 0 ? '' : MENOS}${2 * c}${rB} = ${lin(al, be)}`,
            `Elevamos otra vez:  ${c4}${par(1, b)} = (${lin(al, be)})²`,
            `${ecFinal}  →  ${cand.length === 1 ? `x = ${num(cand[0])}` : solsTxt(cand)}`,
            ...cand.map((x) => (cumple(x)
                ? `Comprobamos x = ${num(x)}:  √${num(p * x + a)} ${sg} √${num(x + b)} = ${num(Math.sqrt(p * x + a))} ${sg} ${num(Math.sqrt(x + b))} = ${c} ✔`
                : `Comprobamos x = ${num(x)}:  no cumple la ecuación inicial  →  se descarta ✘`)),
        ];
        return R('RADICAL', [M(`${rA} ${sg} ${rB} = ${c}`)], validas, { pasos, descartadas });
    }
    return genRadical1();
}
const genRadical = () => (Math.random() < 0.55 ? genRadical1() : genRadical2());

// ═════════════════════════════════════════════════════════════════════════════
//  PRODUCTO = 0 (factorizadas) y FACTORIZABLES
// ═════════════════════════════════════════════════════════════════════════════
const genFactor = (t) => {
    switch (t) {
        case 'x': return { k: 'x', s: 'x', sols: [0], paso: 'x = 0' };
        case 'lin': { const r = rNZ(-7, 7); return { k: 'l' + r, s: `(${lin(1, -r)})`, sols: [r], paso: `${lin(1, -r)} = 0  →  x = ${num(r)}` }; }
        case 'lin2': {
            const a = rInt(2, 5), b = rNZ(-9, 9);
            if (gcd(a, b) !== 1) return null;
            return { k: 'l' + b / a, s: `(${lin(a, -b)})`, sols: [b / a], paso: `${lin(a, -b)} = 0  →  x = ${num(b / a)}` };
        }
        case 'dif': { const k = rInt(1, 6); return { k: 'd' + k, s: `(x² ${MENOS} ${k * k})`, sols: [k, -k], paso: `x² = ${k * k}  →  x = ±${k}` }; }
        case 'irr': { const k = rInt(1, 9); return { k: 'i', s: `(x² + ${k})`, sols: [], paso: `x² = ${MENOS}${k}  →  sin solución real` }; }
        case 'sq': { const r = rNZ(-5, 5); return { k: 'l' + r, s: `(${lin(1, -r)})²`, sols: [r], paso: `${lin(1, -r)} = 0  →  x = ${num(r)} (doble)` }; }
        default: return null;
    }
};

function genProducto() {
    for (let it = 0; it < 500; it++) {
        const n = pick([2, 2, 3, 3]);
        const facs = [];
        for (let j = 0; j < 30 && facs.length < n; j++) {
            const f = genFactor(pick(['x', 'lin', 'lin', 'lin2', 'dif', 'irr', 'sq']));
            if (!f || facs.some((g) => g.k === f.k)) continue;
            facs.push(f);
        }
        if (facs.length < n) continue;
        facs.sort((A, B) => (A.k === 'x' ? -1 : B.k === 'x' ? 1 : 0));
        const sols = uniqSort(facs.flatMap((f) => f.sols));
        if (sols.length < 2) continue;
        const k = pick([1, 1, 1, 2, 3, -1]);
        const pre = k === 1 ? '' : k === -1 ? MENOS : String(k);
        const ecu = `${pre}${facs.map((f) => f.s).join('')} = 0`;
        const pasos = ['Un producto vale 0 cuando alguno de sus factores vale 0:', ...facs.map((f) => f.paso)];
        return R('FACTOR', [M(ecu)], sols, { pasos });
    }
    return genProducto();
}

function genFactorizable() {
    for (let it = 0; it < 1000; it++) {
        const modo = pick(['fc', 'fc', 'ruf3', 'ruf3', 'ruf4', 'dif', 'irr']);
        let raices = [], extra = null;
        if (modo === 'fc') {
            const k = pick([1, 1, 2]);
            const r1 = rNZ(-6, 6), r2 = rNZ(-6, 6);
            if (r1 === r2) continue;
            raices = [...Array(k).fill(0), r1, r2];
        } else if (modo === 'ruf3') {
            raices = [rNZ(-4, 4), rNZ(-4, 4), rNZ(-4, 4)];
            if (new Set(raices).size < 2) continue;
        } else if (modo === 'ruf4') {
            raices = [rNZ(-3, 3), rNZ(-3, 3), rNZ(-3, 3), rNZ(-3, 3)];
            if (new Set(raices).size < 3) continue;
        } else if (modo === 'dif') {
            const k = rInt(1, 6);
            raices = Math.random() < 0.5 ? [0, k, -k] : [0, 0, k, -k];
        } else {
            raices = [rNZ(-5, 5)];
            extra = rInt(1, 9);
        }
        const lead = pick([1, 1, 1, 2, -1]);
        let poly = [lead];
        for (const r of raices) poly = mulPoly(poly, [1, -r]);
        if (extra) poly = mulPoly(poly, [1, 0, extra]);
        if (poly.some((c) => Math.abs(c) > 80)) continue;
        // Forma factorizada agrupando raíces repetidas
        const cuenta = new Map();
        for (const r of raices) cuenta.set(r, (cuenta.get(r) || 0) + 1);
        const claves = [...cuenta.keys()].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : a - b));
        const factores = claves.map((r) => {
            const m = cuenta.get(r);
            const base = r === 0 ? 'x' : `(${lin(1, -r)})`;
            return m === 1 ? base : base + supNum(m);
        });
        if (extra) factores.push(`(x² + ${extra})`);
        const pre = lead === 1 ? '' : lead === -1 ? MENOS : String(lead);
        const metodo = modo === 'fc' ? 'factor común' : modo === 'dif' ? 'factor común e identidad notable' : 'Ruffini';
        const pasos = [
            `Factorizamos (${metodo}):  ${pre}${factores.join('')} = 0`,
            ...claves.map((r) => `x = ${num(r)}${cuenta.get(r) > 1 ? ` (${cuenta.get(r) === 2 ? 'doble' : 'triple'})` : ''}`),
            ...(extra ? [`x² + ${extra} = 0  →  sin solución real`] : []),
        ];
        return R('FACTOR', [M(`${poli(poly)} = 0`)], claves, { pasos });
    }
    return genProducto();
}
const genFactorizada = () => (Math.random() < 0.5 ? genProducto() : genFactorizable());

// ═════════════════════════════════════════════════════════════════════════════
//  EXPONENCIALES
// ═════════════════════════════════════════════════════════════════════════════
const MAXN = { 2: 9, 3: 6, 5: 4, 10: 3 };
const rhsPot = (b, n) => (n >= 0 ? [M(` = ${b ** n}`)] : [M(' = '), FR(1, b ** -n)]);
const potTxt = (b, n) => (n >= 0 ? String(b ** n) : `1/${b ** -n}`);

function genExpo() {
    const k = pick([1, 1, 2, 3, 3, 4, 5, 5]);
    if (k === 1) {
        // b^{mx+q} = b^n
        const b = pick([2, 2, 3, 5]), m = pick([1, 1, 2, 3, -1]);
        for (let it = 0; it < 2000; it++) {
            const X = rInt(-3, 5), n = rInt(b === 5 ? -2 : -3, MAXN[b]), q = n - m * X;
            if (Math.abs(q) > 9 || (n === 0 && Math.random() < 0.7)) continue;
            const kk = n >= 1 && b ** n <= 200 && Math.random() < 0.3 ? pick([3, 5, 7]) : 1;
            const exp = lin(m, q);
            const lhs = `${kk > 1 ? kk + '·' : ''}${b}^{${exp}}`;
            const ast = [M(lhs), ...(kk > 1 ? [M(` = ${kk * b ** n}`)] : rhsPot(b, n))];
            const pasos = [
                ...(kk > 1 ? [`Dividimos entre ${kk}:  ${b}^{${exp}} = ${b ** n}`] : []),
                `Escribimos ${potTxt(b, n)} como potencia de ${b}:  ${b}^{${exp}} = ${b}^{${n}}`,
                `Igualamos los exponentes:  ${exp} = ${n}  →  x = ${num(X)}`,
            ];
            return R('EXPO', ast, [X], { pasos });
        }
    }
    if (k === 2) {
        // b^{x² − Sx + e0} = b^k  (exponente de 2.º grado)
        const b = pick([2, 3]);
        for (let it = 0; it < 2000; it++) {
            const r1 = rInt(-3, 4), r2 = rInt(-3, 4);
            if (r1 >= r2) continue;
            const S = r1 + r2, P = r1 * r2, e0 = rInt(-3, 4), kk = e0 - P;
            if (b ** Math.abs(kk) > 128) continue;
            const exp = poli([1, -S, e0]);
            const pasos = [
                `${potTxt(b, kk)} = ${b}^{${kk}}`,
                `Igualamos los exponentes:  ${exp} = ${kk}`,
                `${poli([1, -S, P])} = 0  →  ${solsTxt([r1, r2])}`,
            ];
            return R('EXPO', [M(`${b}^{${exp}}`), ...rhsPot(b, kk)], [r1, r2], { pasos });
        }
    }
    if (k === 3) {
        // 4^{x+a} = 8^{x+b}: misma base
        const c = pick([2, 2, 3, 5]), ms = c === 2 ? [1, 2, 3, 4] : [1, 2, 3];
        for (let it = 0; it < 3000; it++) {
            const m1 = pick(ms), m2 = pick(ms);
            if (m1 === m2) continue;
            const X = rInt(-4, 6), a = rInt(-3, 3), t = m1 * (X + a);
            if (t % m2) continue;
            const bb = t / m2 - X;
            if (Math.abs(bb) > 6 || bb === a) continue;
            const pasos = [
                `Escribimos todo en base ${c}:  ${c}^{${expBase(m1, a)}} = ${c}^{${expBase(m2, bb)}}`,
                `Igualamos los exponentes:  ${lin(m1, m1 * a)} = ${lin(m2, m2 * bb)}  →  x = ${num(X)}`,
            ];
            return R('EXPO', [M(`${c ** m1}^{${lin(1, a)}} = ${c ** m2}^{${lin(1, bb)}}`)], [X], { pasos });
        }
    }
    if (k === 4) {
        // Sumas de potencias: factor común
        const b = pick([2, 2, 3, 5]), f = rInt(1, 4);
        for (let it = 0; it < 500; it++) {
            let lhs, fac, X, e, baseExp;
            if (f === 1) { X = rInt(0, 6); lhs = `${b}^{x + 1} + ${b}^{x}`; fac = b + 1; e = X; baseExp = 'x'; }
            else if (f === 2) { X = rInt(0, 5); lhs = `${b}^{x + 2} ${MENOS} ${b}^{x}`; fac = b * b - 1; e = X; baseExp = 'x'; }
            else if (f === 3) { X = rInt(0, 4); lhs = `${b}^{x} + ${b}^{x + 1} + ${b}^{x + 2}`; fac = 1 + b + b * b; e = X; baseExp = 'x'; }
            else { X = rInt(1, 6); lhs = `${b}^{x + 1} + ${b}^{x ${MENOS} 1}`; fac = b * b + 1; e = X - 1; baseExp = `x ${MENOS} 1`; }
            const V = fac * b ** e;
            if (V > 3000) continue;
            const pasos = [
                `Sacamos factor común ${b}^{${baseExp}}:  ${b}^{${baseExp}}·${fac} = ${V}`,
                `${b}^{${baseExp}} = ${V / fac} = ${b}^{${e}}`,
                baseExp === "x" ? `x = ${num(X)}` : `${baseExp} = ${e}  →  x = ${num(X)}`,
            ];
            return R('EXPO', [M(`${lhs} = ${V}`)], [X], { pasos });
        }
    }
    // Cambio de variable t = b^x
    const b = pick([2, 2, 3]);
    const pos = b === 2 ? [1, 2, 4, 8] : [1, 3, 9];
    for (let it = 0; it < 2000; it++) {
        const t1 = pick(pos), t2 = Math.random() < 0.3 ? pick([-1, -2, -3, -4]) : pick(pos);
        if (t1 === t2) continue;
        const B = -(t1 + t2), C = t1 * t2;
        if (Math.abs(B) > 20 || Math.abs(C) > 40) continue;
        const lt = `${b}^{x}`;
        const first = Math.random() < 0.5 ? `${b * b}^{x}` : `${b}^{2x}`;
        const ecu = `${first}${term(B, lt, false)}${term(C, '', false)} = 0`;
        const ts = uniqSort([t1, t2]);
        const sols = ts.filter((t) => t > 0).map((t) => Math.round(Math.log(t) / Math.log(b)));
        const pasos = [
            `Cambio t = ${b}^{x}  (así ${first} = t²):  ${poli([1, B, C], 't')} = 0`,
            `t = ${num(ts[0])} ; t = ${num(ts[1])}`,
            ...ts.map((t) => (t > 0
                ? `${b}^{x} = ${t}  →  x = ${Math.round(Math.log(t) / Math.log(b))}`
                : `${b}^{x} = ${num(t)}  →  imposible (una potencia de base positiva nunca es negativa)`)),
        ];
        return R('EXPO', [M(ecu)], sols, { pasos });
    }
    return genExpo();
}

// ═════════════════════════════════════════════════════════════════════════════
//  LOGARÍTMICAS
// ═════════════════════════════════════════════════════════════════════════════
const logL = (b) => (b === 10 ? 'log' : `log_{${b}}`);
const logDe = (b, arg) => (/^[a-z]$/.test(arg) ? `${logL(b)} ${arg}` : `${logL(b)}(${arg})`);
const divisores = (N) => { const d = []; for (let i = 1; i <= N; i++) if (N % i === 0) d.push(i); return d; };

function genLog() {
    const k = pick([1, 1, 2, 2, 3, 4, 5]);
    if (k === 1) {
        // log_b(ax + c) = n
        const b = pick([2, 2, 3, 5, 10]), maxn = { 2: 6, 3: 4, 5: 3, 10: 3 }[b];
        for (let it = 0; it < 2000; it++) {
            const n = rInt(0, maxn), a = pick([1, 1, 2, 3]), X = rInt(-5, 20), c = b ** n - a * X;
            if (Math.abs(c) > 40) continue;
            const kk = n > 0 ? pick([1, 1, 1, 2, 3]) : 1;
            const arg = lin(a, c);
            const pasos = [
                ...(kk > 1 ? [`Dividimos entre ${kk}:  ${logDe(b, arg)} = ${n}`] : []),
                `Por definición de logaritmo:  ${arg} = ${b}^{${n}} = ${b ** n}`,
                `x = ${num(X)}`,
                `Comprobamos: el argumento vale ${b ** n} > 0 ✔`,
            ];
            return R('LOGA', [M(`${kk > 1 ? kk + '·' : ''}${logDe(b, arg)} = ${kk * n}`)], [X], { pasos });
        }
    }
    if (k === 2) {
        // log(x + a) + log(x + c) = n
        const b = pick([2, 3, 10, 10]);
        const n = b === 10 ? pick([1, 2]) : b === 2 ? pick([2, 3, 4, 5]) : pick([1, 2, 3]);
        const N = b ** n, divs = divisores(N);
        for (let it = 0; it < 3000; it++) {
            const u = pick(divs), w = N / u, X = rInt(1, 15), a = u - X, c = w - X;
            if (a === c || Math.abs(a) > 15 || Math.abs(c) > 15) continue;
            const S2 = a + c, P2 = a * c - N;
            const cand = raicesCuad(1, S2, P2);
            if (!cand || !cand.length) continue;
            const dom = (x) => x + a > 0 && x + c > 0;
            const validas = cand.filter(dom), descartadas = cand.filter((x) => !dom(x));
            if (!validas.length) continue;
            const pasos = [
                `Propiedad log A + log B = log(A·B):  ${logL(b)}[${par(1, a)}·${par(1, c)}] = ${n}`,
                `Por definición de logaritmo:  ${par(1, a)}·${par(1, c)} = ${N}`,
                `${poli([1, S2, P2])} = 0  →  ${solsTxt(cand)}`,
                ...cand.map((x) => (dom(x)
                    ? `x = ${num(x)}: los argumentos son positivos ✔`
                    : `x = ${num(x)}: daría el logaritmo de un número negativo o cero  →  se descarta ✘`)),
            ];
            return R('LOGA', [M(`${logDe(b, lin(1, a))} + ${logDe(b, lin(1, c))} = ${n}`)], validas, { pasos, descartadas });
        }
    }
    if (k === 3) {
        // log(x + a) − log(x + c) = log k
        const base10 = Math.random() < 0.5;
        let b, kk, rhs;
        if (base10) { b = 10; kk = rInt(2, 6); rhs = `log ${kk}`; }
        else { b = pick([2, 3]); const n = b === 2 ? pick([1, 2, 3]) : pick([1, 2]); kk = b ** n; rhs = `${n}`; }
        for (let it = 0; it < 2000; it++) {
            const X = rInt(-3, 12), c = rInt(1 - X, 6 - X), a = kk * (X + c) - X;
            if (Math.abs(a) > 40 || a === c) continue;
            const pasos = [
                `Propiedad log A − log B = log(A/B):  ${par(1, a)}/${par(1, c)} = ${kk}`,
                `${lin(1, a)} = ${mul(kk, par(1, c))}  →  x = ${num(X)}`,
                `Comprobamos: los argumentos valen ${X + a} y ${X + c}, positivos ✔`,
            ];
            return R('LOGA', [M(`${logDe(b, lin(1, a))} ${MENOS} ${logDe(b, lin(1, c))} = ${rhs}`)], [X], { pasos });
        }
    }
    if (k === 4) {
        // 2·log x = log(px + q)
        const b = pick([10, 10, 2, 3]);
        for (let it = 0; it < 2000; it++) {
            const r1 = rInt(2, 9), r2 = Math.random() < 0.75 ? rInt(-6, -1) : rInt(1, 9);
            if (r1 === r2) continue;
            const p = r1 + r2, q = -r1 * r2;
            if (Math.abs(q) > 60) continue;
            const dom = (x) => x > 0 && p * x + q > 0;
            const cand = uniqSort([r1, r2]);
            const validas = cand.filter(dom), descartadas = cand.filter((x) => !dom(x));
            const pasos = [
                `2·${logDe(b, 'x')} = ${logDe(b, 'x²')}  →  x² = ${lin(p, q)}`,
                `${poli([1, -p, -q])} = 0  →  ${solsTxt(cand)}`,
                ...cand.map((x) => (dom(x)
                    ? `x = ${num(x)}: los argumentos son positivos ✔`
                    : `x = ${num(x)}: no existe ${logDe(b, num(x))}  →  se descarta ✘`)),
            ];
            return R('LOGA', [M(`2·${logDe(b, 'x')} = ${logDe(b, lin(p, q))}`)], validas, { pasos, descartadas });
        }
    }
    // (log x)² + B·log x + C = 0
    const b = pick([2, 3, 10]);
    const [tmin, tmax] = b === 10 ? [-1, 2] : b === 3 ? [-1, 3] : [-1, 4];
    let t1, t2;
    do { t1 = rInt(tmin, tmax); t2 = rInt(tmin, tmax); } while (t1 >= t2);
    const B = -(t1 + t2), C = t1 * t2;
    const lt = `${logL(b)} x`;
    const pasos = [
        `Cambio t = ${lt}:  ${poli([1, B, C], 't')} = 0`,
        `t = ${num(t1)} ; t = ${num(t2)}`,
        ...[t1, t2].map((t) => `${lt} = ${num(t)}  →  x = ${b}^{${num(t)}} = ${num(b ** t)}`),
    ];
    return R('LOGA', [M(`(${lt})²${term(B, lt, false)}${term(C, '', false)} = 0`)], [b ** t1, b ** t2], { pasos });
}

// ═════════════════════════════════════════════════════════════════════════════
//  TRIGONOMÉTRICAS (soluciones en grados, 0° ≤ x < 360°)
// ═════════════════════════════════════════════════════════════════════════════
const rad = (d) => (d * Math.PI) / 180;
const FN = { sen: (d) => Math.sin(rad(d)), cos: (d) => Math.cos(rad(d)), tg: (d) => Math.tan(rad(d)) };
const angulos = (f, v) => {
    const out = [];
    for (let d = 0; d < 360; d++) { const y = FN[f](d); if (Math.abs(y) < 1e6 && Math.abs(y - v) < 1e-9) out.push(d); }
    return out;
};
const angTxt = (arr) => (arr.length ? arr.map((d) => `${d}°`).join(' ; ') : 'ninguna');
const S2 = Math.SQRT2 / 2, S3 = Math.sqrt(3) / 2, T3 = Math.sqrt(3), T33 = Math.sqrt(3) / 3;
const INSTR_TRIGO = 'Escribe los ángulos en grados (0° ≤ x < 360°) separados por ;';

// Valores con su forma «k·f x = R»
const VALS_SC = [
    { v: 0, s: '0', k: '', R: '0' },
    { v: 0.5, s: '1/2', k: '2', R: '1' }, { v: -0.5, s: `${MENOS}1/2`, k: '2', R: `${MENOS}1` },
    { v: S2, s: '√2/2', k: '2', R: '√2' }, { v: -S2, s: `${MENOS}√2/2`, k: '2', R: `${MENOS}√2` },
    { v: S2, s: '√2/2', k: '√2', R: '1' },
    { v: S3, s: '√3/2', k: '2', R: '√3' }, { v: -S3, s: `${MENOS}√3/2`, k: '2', R: `${MENOS}√3` },
    { v: 1, s: '1', k: '', R: '1' }, { v: -1, s: `${MENOS}1`, k: '', R: `${MENOS}1` },
];
const VALS_T = [
    { v: 0, s: '0', k: '', R: '0' }, { v: 1, s: '1', k: '', R: '1' }, { v: -1, s: `${MENOS}1`, k: '', R: `${MENOS}1` },
    { v: T3, s: '√3', k: '', R: '√3' }, { v: -T3, s: `${MENOS}√3`, k: '', R: `${MENOS}√3` },
    { v: T33, s: '√3/3', k: '3', R: '√3' }, { v: -T33, s: `${MENOS}√3/3`, k: '3', R: `${MENOS}√3` },
    { v: T33, s: '√3/3', k: '√3', R: '1' },
];
// Valores k/2 para sen 2x = k·cos x, etc.
const KS = [
    { n: 1, a: '1', c: '', h: '1/2' }, { n: -1, a: '1', c: MENOS, h: `${MENOS}1/2` },
    { n: Math.SQRT2, a: '√2', c: '√2 ', h: '√2/2' }, { n: -Math.SQRT2, a: '√2', c: `${MENOS}√2 `, h: `${MENOS}√2/2` },
    { n: T3, a: '√3', c: '√3 ', h: '√3/2' }, { n: -T3, a: '√3', c: `${MENOS}√3 `, h: `${MENOS}√3/2` },
];
const valTxt = (v) => {
    const m = [[S2, '√2/2'], [S3, '√3/2'], [T3, '√3'], [T33, '√3/3']].find(([x]) => Math.abs(Math.abs(v) - x) < 1e-9);
    return m ? (v < 0 ? MENOS : '') + m[1] : num(v);
};
// Ecuación de 2.º grado en t = sen x o cos x con raíces múltiplos de 1/2
const cuadTrig = (permiteFuera = true) => {
    for (;;) {
        const n1 = rInt(-2, permiteFuera ? 4 : 2), n2 = rInt(-2, permiteFuera ? 4 : 2);
        if (n1 >= n2) continue;
        const t1 = n1 / 2, t2 = n2 / 2;
        if (Math.abs(t1) > 1 && Math.abs(t2) > 1) continue;
        const co = simplificar([4, -2 * (n1 + n2), n1 * n2]);
        return { t: [t1, t2], co };
    }
};
const pasosRaicesTrig = (f, ts) => ts.map((t) => (Math.abs(t) <= 1
    ? `${f} x = ${valTxt(t)}  →  x = ${angTxt(angulos(f, t))}`
    : `${f} x = ${valTxt(t)}  →  imposible (${MENOS}1 ≤ ${f} x ≤ 1)`));
const solsRaicesTrig = (f, ts) => ts.filter((t) => Math.abs(t) <= 1).flatMap((t) => angulos(f, t));

function genTrig() {
    const k = pick([1, 1, 2, 2, 3, 4, 5, 5]);
    const T = (ecu, sols, pasos) => R('TRIGO', [M(ecu)], sols, { pasos, grados: true, instruccion: INSTR_TRIGO });
    if (k === 1) {
        // k·f x = R
        const f = pick(['sen', 'cos', 'cos', 'tg']);
        const V = pick(f === 'tg' ? VALS_T : VALS_SC);
        const lhs = `${V.k}${V.k ? ' ' : ''}${f} x`;
        let ecu;
        if (V.R === '0' || Math.random() < 0.5) ecu = `${lhs} = ${V.R}`;
        else ecu = V.R.startsWith(MENOS) ? `${lhs} + ${V.R.slice(1)} = 0` : `${lhs} ${MENOS} ${V.R} = 0`;
        const sols = angulos(f, V.v);
        const pasos = [...(V.k ? [`${f} x = ${V.s}`] : []), `x = ${angTxt(sols)}`];
        return T(ecu, sols, pasos);
    }
    if (k === 2) {
        // A·f²x + B·f x + C = 0
        const f = pick(['sen', 'cos']);
        const { t, co } = cuadTrig();
        const ecu = `${suma([[co[0], `${f}²x`], [co[1], `${f} x`], [co[2], '']])} = 0`;
        const pasos = [`Cambio t = ${f} x:  ${poli(co, 't')} = 0`, `t = ${num(t[0])} ; t = ${num(t[1])}`, ...pasosRaicesTrig(f, t)];
        return T(ecu, solsRaicesTrig(f, t), pasos);
    }
    if (k === 3) {
        // Incompletas: k·f²x = R
        const op = pick([
            { f: 'sen', k: 4, R: 1, v: 0.5 }, { f: 'cos', k: 4, R: 1, v: 0.5 },
            { f: 'sen', k: 4, R: 3, v: S3 }, { f: 'cos', k: 4, R: 3, v: S3 },
            { f: 'sen', k: 2, R: 1, v: S2 }, { f: 'cos', k: 2, R: 1, v: S2 },
            { f: 'tg', k: 1, R: 3, v: T3 }, { f: 'tg', k: 1, R: 1, v: 1 }, { f: 'tg', k: 3, R: 1, v: T33 },
        ]);
        const lhs = `${op.k > 1 ? op.k + ' ' : ''}${op.f}²x`;
        const ecu = Math.random() < 0.5 ? `${lhs} = ${op.R}` : `${lhs} ${MENOS} ${op.R} = 0`;
        const sols = uniqSort([...angulos(op.f, op.v), ...angulos(op.f, -op.v)]);
        const pasos = [
            `${op.f}²x = ${op.k > 1 ? `${op.R}/${op.k}` : op.R}  →  ${op.f} x = ±${valTxt(op.v)}`,
            `${op.f} x = ${valTxt(op.v)}  →  x = ${angTxt(angulos(op.f, op.v))}`,
            `${op.f} x = ${valTxt(-op.v)}  →  x = ${angTxt(angulos(op.f, -op.v))}`,
        ];
        return T(ecu, sols, pasos);
    }
    if (k === 4) {
        // Con la identidad fundamental: sen²x + cos²x = 1
        for (;;) {
            const base = pick(['sen', 'cos']), otro = base === 'sen' ? 'cos' : 'sen';
            const { t, co } = cuadTrig(false);
            const [A, B, C] = co;
            if (!B) continue;
            // A·base² + B·base + C = 0 con base² = 1 − otro²  →  −A·otro² + B·base + (A + C) = 0
            let a2 = -A, b2 = B, c2 = A + C;
            if (a2 < 0) { a2 = -a2; b2 = -b2; c2 = -c2; }
            const ecu = `${suma([[a2, `${otro}²x`], [b2, `${base} x`], [c2, '']])} = 0`;
            const pasos = [
                `Usamos ${otro}²x = 1 ${MENOS} ${base}²x y ordenamos:  ${suma([[A, `${base}²x`], [B, `${base} x`], [C, '']])} = 0`,
                `Cambio t = ${base} x:  ${poli(co, 't')} = 0  →  t = ${num(t[0])} ; t = ${num(t[1])}`,
                ...pasosRaicesTrig(base, t),
            ];
            return T(ecu, solsRaicesTrig(base, t), pasos);
        }
    }
    // Ángulo doble / cociente
    const tipo = pick(['s2c', 's2s', 'c2', 'c2s', 'tg']);
    if (tipo === 's2c' || tipo === 's2s') {
        const K = pick(KS);
        const f = tipo === 's2c' ? 'cos' : 'sen', g = tipo === 's2c' ? 'sen' : 'cos';
        const ecu = `sen 2x = ${K.c}${f} x`;
        const cero = angulos(f, 0), resto = angulos(g, K.n / 2);
        const pasos = [
            'sen 2x = 2 sen x cos x',
            `${f} x · (2 ${g} x ${K.n > 0 ? MENOS : '+'} ${K.a}) = 0`,
            `${f} x = 0  →  x = ${angTxt(cero)}`,
            `${g} x = ${K.h}  →  x = ${angTxt(resto)}`,
        ];
        return T(ecu, uniqSort([...cero, ...resto]), pasos);
    }
    if (tipo === 'c2' || tipo === 'c2s') {
        const H = [-1, -0.5, 0, 0.5, 1];
        for (;;) {
            const t1 = pick(H), t2 = pick(H);
            if (t1 >= t2) continue;
            if (tipo === 'c2') {
                // cos 2x = m·cos x + n  →  2cos²x − m·cos x − (1 + n) = 0
                const m = 2 * (t1 + t2), n = -2 * t1 * t2 - 1;
                if (!Number.isInteger(m) || !Number.isInteger(n)) continue;
                const ecu = `cos 2x = ${suma([[m, 'cos x'], [n, '']])}`;
                const pasos = [
                    `cos 2x = 2 cos²x ${MENOS} 1  →  ${suma([[2, 'cos²x'], [-m, 'cos x'], [-(1 + n), '']])} = 0`,
                    `cos x = ${num(t1)} ; cos x = ${num(t2)}`,
                    ...pasosRaicesTrig('cos', [t1, t2]),
                ];
                return T(ecu, solsRaicesTrig('cos', [t1, t2]), pasos);
            }
            // cos 2x = m·sen x + n  →  2sen²x + m·sen x + (n − 1) = 0
            const m = -2 * (t1 + t2), n = 2 * t1 * t2 + 1;
            if (!Number.isInteger(m) || !Number.isInteger(n)) continue;
            const ecu = `cos 2x = ${suma([[m, 'sen x'], [n, '']])}`;
            const pasos = [
                `cos 2x = 1 ${MENOS} 2 sen²x  →  ${suma([[2, 'sen²x'], [m, 'sen x'], [n - 1, '']])} = 0`,
                `sen x = ${num(t1)} ; sen x = ${num(t2)}`,
                ...pasosRaicesTrig('sen', [t1, t2]),
            ];
            return T(ecu, solsRaicesTrig('sen', [t1, t2]), pasos);
        }
    }
    // sen x = k·cos x  →  tg x = k
    const K = pick([{ v: 1, c: '' }, { v: -1, c: MENOS }, { v: T3, c: '√3 ' }, { v: -T3, c: `${MENOS}√3 ` }]);
    const sols = angulos('tg', K.v);
    return T(`sen x = ${K.c}cos x`, sols, [`Dividimos entre cos x:  tg x = ${valTxt(K.v)}`, `x = ${angTxt(sols)}`]);
}

// ═════════════════════════════════════════════════════════════════════════════
//  PROBLEMAS
// ═════════════════════════════════════════════════════════════════════════════
// Los cortes de la ecuación del problema que no son la solución y salen ≤ 0 se marcan como descartados
const P = (sub, texto, sols, extra = {}) => {
    const eq = R(sub, [EN(texto)], sols, { etiqueta: 'Solución', ...extra });
    if (eq.ecuacion) {
        const otras = cortesEcuacion(datosGrafica(eq)).filter((x) => x <= 1e-9 && !cerca(x, eq.correctAnswers));
        eq.descartadas = uniqTol([...eq.descartadas, ...otras]);
    }
    return eq;
};
const VECES = { 2: 'el doble', 3: 'el triple', 4: 'el cuádruple', 5: 'cinco veces' };

// ── 1.er grado ───────────────────────────────────────────────────────────────
function genProblema1() {
    const k = rInt(1, 10);
    for (let it = 0; it < 2000; it++) {
        if (k === 1) {
            const m = rInt(3, 5), n = rInt(2, 3);
            if (n >= m) continue;
            const x = rInt(4, 15), kk = (x * (m - n)) / (n - 1);
            if (!Number.isInteger(kk) || kk > 30 || kk < 2) continue;
            return P('PROB1', `Un padre tiene ahora ${VECES[m]} de la edad de su hijo. Dentro de ${kk} años tendrá ${VECES[n]} de la edad de su hijo. ¿Cuántos años tiene ahora el hijo?`, [x], { ecuacion: `${m}x + ${kk} = ${n}(x + ${kk})`,
                unidad: 'años',
                pasos: [`Hijo: x · Padre: ${m}x`, `Dentro de ${kk} años:  ${m}x + ${kk} = ${n}(x + ${kk})`, `${lin(m - n, 0)} = ${n * kk - kk}  →  x = ${x}`],
            });
        }
        if (k === 2) {
            const cuantos = pick([3, 4]), clase = pick(['', 'pares', 'impares']), paso = clase ? 2 : 1;
            let x = rInt(5, 60);
            if (clase === 'pares' && x % 2) x++;
            if (clase === 'impares' && !(x % 2)) x++;
            const S = cuantos * x + paso * (cuantos * (cuantos - 1)) / 2;
            const mayor = Math.random() < 0.5;
            // x = el número que se pregunta (el menor o el mayor)
            const sumaDesp = paso * (cuantos * (cuantos - 1)) / 2, sol = mayor ? x + paso * (cuantos - 1) : x;
            const ec = mayor
                ? Array.from({ length: cuantos }, (_, i) => { const k = (cuantos - 1 - i) * paso; return k ? `(x ${MENOS} ${k})` : 'x'; }).join(' + ')
                : Array.from({ length: cuantos }, (_, i) => (i ? `(x + ${i * paso})` : 'x')).join(' + ');
            return P('PROB1', `La suma de ${cuantos === 3 ? 'tres' : 'cuatro'} números ${clase ? clase + ' ' : ''}consecutivos es ${S}. ¿Cuál es el ${mayor ? 'mayor' : 'menor'}?`, [sol], { ecuacion: `${ec} = ${S}`,
                pasos: [`Llamamos x al ${mayor ? 'mayor' : 'menor'}:  ${ec} = ${S}`, `${cuantos}x ${mayor ? MENOS : '+'} ${sumaDesp} = ${S}  →  x = ${sol}`, `Los números son ${Array.from({ length: cuantos }, (_, i) => x + i * paso).join(', ')}`],
            });
        }
        if (k === 3) {
            const x = rInt(5, 40) * 5, d = rInt(2, 10) * 5, T = 4 * x + d;
            return P('PROB1', `Se reparten ${T} € entre tres hermanos: el segundo recibe ${d} € más que el primero y el tercero el doble que el primero. ¿Cuánto recibe el primero?`, [x], { ecuacion: `x + (x + ${d}) + 2x = ${T}`,
                unidad: '€',
                pasos: [`Primero: x · Segundo: x + ${d} · Tercero: 2x`, `x + (x + ${d}) + 2x = ${T}`, `4x = ${T - d}  →  x = ${x}`],
            });
        }
        if (k === 4) {
            const N = rInt(8, 30) * 10, A = rInt(7, 12), B = rInt(3, A - 2), x = rInt(N / 5, N - N / 5);
            const Rr = A * x + B * (N - x);
            return P('PROB1', `Un cine vendió ${N} entradas, unas de adulto a ${A} € y otras infantiles a ${B} €, y recaudó ${Rr} €. ¿Cuántas entradas de adulto vendió?`, [x], { ecuacion: `${A}x + ${B}(${N} − x) = ${Rr}`,
                unidad: 'entradas',
                pasos: [`Adulto: x · Infantil: ${N} − x`, `${A}x + ${B}(${N} − x) = ${Rr}`, `${A - B}x = ${Rr - B * N}  →  x = ${x}`],
            });
        }
        if (k === 5) {
            const v1 = rInt(6, 12) * 10, v2 = rInt(5, 11) * 10, t = rInt(1, 4), D = (v1 + v2) * t;
            return P('PROB1', `Dos ciudades están a ${D} km. A la misma hora sale un coche de cada una, en sentido contrario, a ${v1} km/h y a ${v2} km/h. ¿Cuántas horas tardan en cruzarse?`, [t], { ecuacion: `${v1}x + ${v2}x = ${D}`,
                unidad: 'h',
                pasos: [`En x horas recorren ${v1}x y ${v2}x km`, `${v1}x + ${v2}x = ${D}`, `${v1 + v2}x = ${D}  →  x = ${t}`],
            });
        }
        if (k === 6) {
            const p = pick([10, 15, 20, 25, 30, 40, 50]), x = rInt(2, 20) * 20, Pf = (x * (100 - p)) / 100;
            if (!Number.isInteger(Pf)) continue;
            return P('PROB1', `Tras una rebaja del ${p} %, un abrigo cuesta ${Pf} €. ¿Cuánto costaba antes de la rebaja?`, [x], { ecuacion: `${(100 - p) / 100}x = ${Pf}`,
                unidad: '€',
                pasos: [`Pagamos el ${100 - p} % del precio:  ${(100 - p) / 100}·x = ${Pf}`.replace('.', ','), `x = ${Pf} : ${((100 - p) / 100).toString().replace('.', ',')} = ${x}`],
            });
        }
        if (k === 7) {
            const [a, b, d1, d2] = pick([[3, 4, 'un tercio', 'un cuarto'], [2, 5, 'la mitad', 'un quinto'], [4, 6, 'un cuarto', 'un sexto'], [3, 6, 'un tercio', 'un sexto']]);
            const mcm = (a * b) / gcd(a, b);
            const x = mcm * rInt(2, 12) * 5, resto = x - x / a - x / b;
            return P('PROB1', `Gasto ${d1} de mi dinero en libros y ${d2} en ropa, y me quedan ${resto} €. ¿Cuánto dinero tenía?`, [x], { ecuacion: `x − x/${a} − x/${b} = ${resto}`,
                unidad: '€',
                pasos: [`x ${MENOS} x/${a} ${MENOS} x/${b} = ${resto}`, `Multiplicamos por ${mcm}:  ${mcm}x ${MENOS} ${mcm / a}x ${MENOS} ${mcm / b}x = ${resto * mcm}`, `${mcm - mcm / a - mcm / b}x = ${resto * mcm}  →  x = ${x}`],
            });
        }
        if (k === 8) {
            const x = rInt(3, 25), d = rInt(2, 15), Pm = 4 * x + 2 * d;
            return P('PROB1', `El largo de un rectángulo mide ${d} cm más que el ancho y su perímetro es de ${Pm} cm. ¿Cuánto mide el ancho?`, [x], { ecuacion: `2x + 2(x + ${d}) = ${Pm}`,
                unidad: 'cm',
                pasos: [`Ancho: x · Largo: x + ${d}`, `2x + 2(x + ${d}) = ${Pm}`, `4x = ${Pm - 2 * d}  →  x = ${x}`],
            });
        }
        if (k === 9) {
            const N = pick([20, 25, 30, 40, 50]), a = pick([2, 3, 4, 5]), b = pick([1, 2]), x = rInt(Math.ceil(N / 2), N - 1);
            const S = a * x - b * (N - x);
            return P('PROB1', `Un examen tiene ${N} preguntas. Cada acierto suma ${a} puntos y cada fallo resta ${b}. Lucía contestó todas y obtuvo ${S} puntos. ¿Cuántas acertó?`, [x], { ecuacion: `${a}x − ${b}(${N} − x) = ${S}`,
                unidad: 'aciertos',
                pasos: [`Aciertos: x · Fallos: ${N} − x`, `${a}x ${MENOS} ${b}(${N} − x) = ${S}`, `${a + b}x = ${S + b * N}  →  x = ${x}`],
            });
        }
        // Mezcla
        const A = rInt(4, 9), B = rInt(A + 3, 18), C = rInt(A + 1, B - 1), m = rInt(2, 12) * 5;
        const x = (m * (B - C)) / (C - A);
        if (!Number.isInteger(x) || x < 5 || x > 200) continue;
        return P('PROB1', `¿Cuántos kg de café de ${A} €/kg hay que mezclar con ${m} kg de otro de ${B} €/kg para obtener una mezcla que salga a ${C} €/kg?`, [x], { ecuacion: `${A}x + ${B * m} = ${C}(x + ${m})`,
            unidad: 'kg',
            pasos: [`${A}x + ${B}·${m} = ${C}(x + ${m})`, `${A}x + ${B * m} = ${C}x + ${C * m}`, `${C - A}x = ${B * m - C * m}  →  x = ${x}`],
        });
    }
    return genProblema1();
}

// ── Áreas con ecuaciones de 2.º grado ───────────────────────────────────────
const TERNAS = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [6, 8, 10], [9, 12, 15], [12, 16, 20], [9, 40, 41]];
function genProblemaArea() {
    const k = rInt(1, 7);
    for (let it = 0; it < 2000; it++) {
        if (k === 1) {
            const x = rInt(3, 20), d = rInt(2, 10), A = x * (x + d);
            return P('PROB2', `El largo de un rectángulo mide ${d} m más que el ancho y su área es de ${A} m². ¿Cuánto mide el ancho?`, [x], { ecuacion: `x(x + ${d}) = ${A}`,
                unidad: 'm', descartadas: [-(x + d)],
                pasos: [`Ancho: x · Largo: x + ${d}`, `x(x + ${d}) = ${A}  →  ${poli([1, d, -A])} = 0`, `x = ${x} ; x = ${MENOS}${x + d} (negativa: se descarta)`],
            });
        }
        if (k === 2) {
            const a = rInt(2, 15), b = rInt(a + 1, 25), Pm = 2 * (a + b), A = a * b, mayor = Math.random() < 0.5;
            return P('PROB2', `Un rectángulo tiene ${Pm} cm de perímetro y ${A} cm² de área. ¿Cuánto mide su lado ${mayor ? 'mayor' : 'menor'}?`, [mayor ? b : a], { ecuacion: `x(${a + b} − x) = ${A}`,
                unidad: 'cm',
                pasos: [`Un lado: x · El otro: ${a + b} − x  (la mitad del perímetro es ${a + b})`, `x(${a + b} − x) = ${A}  →  ${poli([1, -(a + b), A])} = 0`, `x = ${a} ; x = ${b}  →  los lados miden ${a} y ${b} cm`],
            });
        }
        if (k === 3) {
            const x = rInt(3, 15), kk = rInt(1, 6), aumenta = Math.random() < 0.6;
            if (!aumenta && kk >= x) continue;
            const L = aumenta ? x + kk : x - kk;
            return P('PROB2', `Si ${aumenta ? 'aumentamos' : 'disminuimos'} en ${kk} cm el lado de un cuadrado, su área pasa a ser de ${L * L} cm². ¿Cuánto mide el lado del cuadrado?`, [x], { ecuacion: `(x ${aumenta ? '+' : '−'} ${kk})² = ${L * L}`,
                unidad: 'cm',
                pasos: [`(x ${aumenta ? '+' : MENOS} ${kk})² = ${L * L}`, `x ${aumenta ? '+' : MENOS} ${kk} = ±${L}`, `x = ${x}  (la otra solución, x = ${aumenta ? -L - kk : kk - L}, ${aumenta ? 'es negativa' : 'no sirve'})`],
            });
        }
        if (k === 4) {
            const x = rInt(1, 3), L = rInt(6, 20), W = rInt(4, L), marco = Math.random() < 0.4;
            const T = (L + 2 * x) * (W + 2 * x);
            if (marco) {
                const Mm = T - L * W;
                return P('PROB2', `Una foto de ${L} cm × ${W} cm lleva un marco de anchura constante. La superficie del marco es de ${Mm} cm². ¿Qué anchura tiene el marco?`, [x], { ecuacion: `(${L} + 2x)(${W} + 2x) − ${L * W} = ${Mm}`,
                    unidad: 'cm',
                    pasos: [`(${L} + 2x)(${W} + 2x) ${MENOS} ${L * W} = ${Mm}`, `${poli([4, 2 * (L + W), -Mm])} = 0`, `x = ${x}  (la otra solución es negativa)`],
                });
            }
            return P('PROB2', `Un jardín rectangular de ${L} m × ${W} m está rodeado por un camino de anchura constante. Entre el jardín y el camino ocupan ${T} m². ¿Qué anchura tiene el camino?`, [x], { ecuacion: `(${L} + 2x)(${W} + 2x) = ${T}`,
                unidad: 'm',
                pasos: [`(${L} + 2x)(${W} + 2x) = ${T}`, `${poli([4, 2 * (L + W), L * W - T])} = 0`, `x = ${x}  (la otra solución es negativa)`],
            });
        }
        if (k === 5) {
            const [a, b, c] = pick(TERNAS), d = b - a;
            return P('PROB2', `Los catetos de un triángulo rectángulo se diferencian en ${d} cm y la hipotenusa mide ${c} cm. ¿Cuánto mide el cateto menor?`, [a], { ecuacion: `x² + (x + ${d})² = ${c * c}`,
                unidad: 'cm',
                pasos: [`Catetos: x y x + ${d}`, `Pitágoras:  x² + (x + ${d})² = ${c}²`, `${poli(simplificar([2, 2 * d, d * d - c * c]))} = 0  →  x = ${a}  (la otra es negativa)`],
            });
        }
        if (k === 6) {
            const x = rInt(2, 20), d = rInt(1, 10);
            if ((x * (x + d)) % 2) continue;
            const A = (x * (x + d)) / 2;
            return P('PROB2', `La base de un triángulo mide ${d} cm más que su altura y su área es de ${A} cm². ¿Cuánto mide la altura?`, [x], { ecuacion: `x(x + ${d})/2 = ${A}`,
                unidad: 'cm',
                pasos: [`Altura: x · Base: x + ${d}`, `x(x + ${d})/2 = ${A}  →  ${poli([1, d, -2 * A])} = 0`, `x = ${x}  (la otra solución es negativa)`],
            });
        }
        const kk = rInt(1, 5), s = rInt(3, 12), V = kk * s * s;
        return P('PROB2', `De una lámina cuadrada de cartón se recortan, en cada esquina, cuadrados de ${kk} cm de lado y se doblan los bordes para hacer una caja sin tapa de ${V} cm³. ¿Cuánto medía el lado de la lámina?`, [s + 2 * kk], { ecuacion: `${kk}(x − ${2 * kk})² = ${V}`,
            unidad: 'cm',
            pasos: [`Lado de la lámina: x  →  base de la caja: x ${MENOS} ${2 * kk}, altura: ${kk}`, `${kk}(x ${MENOS} ${2 * kk})² = ${V}  →  (x ${MENOS} ${2 * kk})² = ${s * s}`, `x ${MENOS} ${2 * kk} = ${s}  →  x = ${s + 2 * kk}  (x ${MENOS} ${2 * kk} = ${MENOS}${s} no tiene sentido)`],
        });
    }
    return genProblemaArea();
}

// ── Proporcionalidad inversa / x en el denominador ──────────────────────────
const horasTxt = (T) => {
    const h = Math.floor(T + 1e-9), mi = Math.round((T - h) * 60);
    if (!mi) return `${h} hora${h === 1 ? '' : 's'}`;
    return h ? `${h} h y ${mi} min` : `${mi} minutos`;
};
function genProblemaInversa() {
    const k = rInt(1, 7);
    for (let it = 0; it < 3000; it++) {
        if (k === 1 || k === 2) {
            // Reparto: T/x − T/(x+kk) = d
            const n = rInt(3, 12), kk = rInt(1, 4), m = rInt(1, 10);
            const mas = k === 1;
            const N = mas ? n : n + kk; // solución
            const T = mas ? m * n * (n + kk) : m * N * (N - kk), d = m * kk;
            if (T < 60 || T > 2400) continue;
            const ctx = pick([
                ['Un grupo de amigos alquila una casa rural por', 'amigos'],
                ['Los alumnos de una clase compran un regalo de', 'alumnos'],
                ['Un grupo de excursionistas alquila un autobús por', 'excursionistas'],
            ]);
            const texto = mas
                ? `${ctx[0]} ${T} €. Si fueran ${kk} más, cada uno pagaría ${d} € menos. ¿Cuántos ${ctx[1]} son?`
                : `${ctx[0]} ${T} €. Si ${kk === 1 ? 'faltara uno' : `faltaran ${kk}`}, cada uno pagaría ${d} € más. ¿Cuántos ${ctx[1]} son?`;
            const ec = mas ? `${T}/x ${MENOS} ${T}/(x + ${kk}) = ${d}` : `${T}/(x ${MENOS} ${kk}) ${MENOS} ${T}/x = ${d}`;
            const cuad = mas ? poli([1, kk, -(T * kk) / d]) : poli([1, -kk, -(T * kk) / d]);
            const otra = mas ? -(n + kk) : kk - N;
            return P('PROBINV', texto, [N], { ecuacion: ec,
                unidad: ctx[1], descartadas: [otra],
                pasos: [`Cada uno paga ${T}/x €`, ec, `Multiplicamos por el m.c.m. y simplificamos:  ${cuad} = 0`, `x = ${N} ; x = ${num(otra)} (negativa: se descarta)`],
            });
        }
        if (k === 3) {
            // Velocidad: D/v − D/(v+kk) = t
            const v = rInt(4, 24) * 5, kk = pick([10, 20, 30]), t = pick([1, 1, 2]);
            const D = (t * v * (v + kk)) / kk;
            if (!Number.isInteger(D) || D > 1500 || D < 60) continue;
            return P('PROBINV', `Un coche recorre ${D} km. Si fuera ${kk} km/h más rápido, tardaría ${t} hora${t > 1 ? 's' : ''} menos. ¿A qué velocidad va?`, [v], { ecuacion: `${D}/x − ${D}/(x + ${kk}) = ${t}`,
                unidad: 'km/h', descartadas: [-(v + kk)],
                pasos: [`Tiempo = distancia / velocidad:  ${D}/x ${MENOS} ${D}/(x + ${kk}) = ${t}`, `${poli([1, kk, -(D * kk) / t])} = 0`, `x = ${v} ; x = ${MENOS}${v + kk} (negativa: se descarta)`],
            });
        }
        if (k === 4) {
            // Grifos / pintores: 1/x + 1/(x+kk) = 1/T
            const x = rInt(2, 20), kk = rInt(1, 20), T = (x * (x + kk)) / (2 * x + kk);
            if (!esEntero(T * 60) || T < 1) continue;
            const [suj, que] = pick([['Dos grifos abiertos a la vez llenan un depósito', 'el primer grifo, solo, en llenarlo'], ['Dos pintores, trabajando juntos, pintan una casa', 'el primer pintor, solo, en pintarla']]);
            const otro = suj.startsWith('Dos grifos') ? 'El segundo grifo' : 'El segundo pintor';
            const Tf = fracStr(T);
            const co = [1, kk - 2 * T, -T * kk];
            return P('PROBINV', `${suj} en ${horasTxt(T)}. ${otro}, solo, tardaría ${kk} hora${kk > 1 ? 's' : ''} más que el primero. ¿Cuántas horas tarda ${que}?`, [x], { ecuacion: `1/x + 1/(x + ${kk}) = 1/(${T})`,
                unidad: 'h',
                pasos: [`En 1 hora hacen 1/x y 1/(x + ${kk}) del trabajo; juntos, 1/${Tf.includes('/') ? `(${Tf})` : Tf}`, `1/x + 1/(x + ${kk}) = 1/${Tf.includes('/') ? `(${Tf})` : Tf}`, `${poli(co)} = 0`, `x = ${x}  (la otra solución es negativa)`],
            });
        }
        if (k === 5) {
            // Número + inverso
            const r = rInt(2, 7);
            return P('PROBINV', `La suma de un número y su inverso es ${r * r + 1}/${r}. ¿De qué número se trata? (Hay dos soluciones)`, [r, 1 / r], { ecuacion: `x + 1/x = ${r * r + 1}/${r}`,
                etiqueta: 'Números',
                pasos: [`x + 1/x = ${r * r + 1}/${r}`, `Multiplicamos por ${r}x:  ${poli([r, -(r * r + 1), r])} = 0`, `x = ${r} ; x = 1/${r}`],
            });
        }
        if (k === 6) {
            // Fracción
            const X = rInt(1, 12), d = rInt(1, 8), kk = rInt(1, 8);
            const nn = X + kk, dd = X + d + kk, g = gcd(nn, dd);
            if (g < 2) continue;
            const p = nn / g, q = dd / g;
            return P('PROBINV', `El denominador de una fracción supera en ${d} al numerador. Si sumamos ${kk} al numerador y al denominador, la fracción equivale a ${p}/${q}. ¿Cuál es el numerador?`, [X], { ecuacion: `(x + ${kk})/(x + ${d + kk}) = ${p}/${q}`,
                pasos: [`Fracción: x/(x + ${d})`, `(x + ${kk})/(x + ${d + kk}) = ${p}/${q}`, `${q}(x + ${kk}) = ${p}(x + ${d + kk})  →  ${q - p}x = ${p * (d + kk) - q * kk}  →  x = ${X}`],
            });
        }
        // Proporcionalidad inversa simple
        const a = rInt(3, 12), D = rInt(4, 20), h = rInt(2, 30);
        const x = (a * D) / h;
        if (!Number.isInteger(x) || x === a || x > 60) continue;
        const [suj, und] = pick([['obreros tardan', 'obreros'], ['grifos iguales llenan una piscina en', 'grifos'], ['máquinas iguales hacen un pedido en', 'máquinas']]);
        const tarea = suj.startsWith('obreros') ? `${a} ${suj} ${D} días en hacer una obra` : `${a} ${suj} ${D} horas`;
        const unidT = suj.startsWith('obreros') ? 'días' : 'horas';
        return P('PROBINV', `${tarea.charAt(0).toUpperCase() + tarea.slice(1)}. ¿Cuántos ${und} harían falta para hacerlo en ${h} ${unidT}?`, [x], { ecuacion: `${a * D}/x = ${h}`,
            unidad: und,
            pasos: [`Proporcionalidad inversa:  ${a}·${D} = x·${h}  ⇔  ${a * D}/x = ${h}`, `x = ${a * D}/${h} = ${x}`],
        });
    }
    return genProblemaInversa();
}

// ═════════════════════════════════════════════════════════════════════════════
//  API
// ═════════════════════════════════════════════════════════════════════════════
export const TIPOS_AVANZADOS = [
    { key: 'bicuadradas', tipo: 'BICUAD', label: 'Bicuadradas (x⁴, x⁶)', icon: '⁴', color: '#16a085', grupo: 'ecu', gen: genBicuadrada },
    { key: 'racionales', tipo: 'RACIONAL', label: 'x en el denominador', icon: '½', color: '#d35400', grupo: 'ecu', gen: genRacional },
    { key: 'radicales', tipo: 'RADICAL', label: 'Con raíces', icon: '√', color: '#8e44ad', grupo: 'ecu', gen: genRadical },
    { key: 'factorizadas', tipo: 'FACTOR', label: 'Producto = 0', icon: '×', color: '#2c3e50', grupo: 'ecu', gen: genFactorizada },
    { key: 'exponenciales', tipo: 'EXPO', label: 'Exponenciales', icon: 'aˣ', color: '#c0392b', grupo: 'ecu', gen: genExpo },
    { key: 'logaritmicas', tipo: 'LOGA', label: 'Logarítmicas', icon: 'log', color: '#27ae60', grupo: 'ecu', gen: genLog },
    { key: 'trigonometricas', tipo: 'TRIGO', label: 'Trigonométricas', icon: '∠', color: '#2980b9', grupo: 'ecu', gen: genTrig },
    { key: 'probPrimer', tipo: 'PROB1', label: 'Problemas de 1.er grado', icon: '📝', color: '#f39c12', grupo: 'prob', gen: genProblema1 },
    { key: 'probAreas', tipo: 'PROB2', label: 'Problemas de áreas (2.º grado)', icon: '📐', color: '#e67e22', grupo: 'prob', gen: genProblemaArea },
    { key: 'probInversa', tipo: 'PROBINV', label: 'Prop. inversa (x en el denominador)', icon: '⚖️', color: '#9b59b6', grupo: 'prob', gen: genProblemaInversa },
];
export const CLAVES_AVANZADAS = TIPOS_AVANZADOS.map((t) => t.key);
const POR_TIPO = Object.fromEntries(TIPOS_AVANZADOS.map((t) => [t.tipo, t]));
export const esTipoAvanzado = (tipo) => !!POR_TIPO[tipo];
export const generarAvanzada = (tipo) => POR_TIPO[tipo].gen();

// ─── Solución gráfica: la ecuación como dos funciones y = 1.er miembro, y = 2.º miembro ──
const cerca = (x, lista) => lista.some((c) => Math.abs(c - x) < 1e-6 * Math.max(1, Math.abs(c)));
const uniqTol = (arr) => {
    const out = [];
    for (const v of [...arr].sort((a, b) => a - b)) if (!cerca(v, out)) out.push(v);
    return out;
};
// Texto con marcado → expresión JavaScript
export const exprJS = (s) => {
    let e = String(s).replace(/[−–]/g, '-').replace(/·/g, '*');
    e = e.replace(/log_\{(\d+)\}\s*\(/g, 'LG($1,').replace(/log_\{(\d+)\}\s+x/g, 'LG($1,x)');
    e = e.replace(/log\s*\(/g, 'LG(10,').replace(/log\s+(x|\d+)/g, 'LG(10,$1)');
    for (const [f, F] of [['sen', 'SEN'], ['cos', 'COS'], ['tg', 'TG']]) {
        e = e.replace(new RegExp(f + '²x', 'g'), `(${F}(x))**2`).replace(new RegExp(f + ' 2x', 'g'), `${F}(2*x)`).replace(new RegExp(f + ' x', 'g'), `${F}(x)`);
    }
    e = e.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => '**' + SUPS.indexOf(c));
    e = e.replace(/\^\{/g, '**{').replace(/√\{/g, 'Math.sqrt{').replace(/√(\d+)/g, 'Math.sqrt($1)');
    e = e.replace(/\{/g, '(').replace(/\}/g, ')');
    e = e.replace(/(\d|\)|x)\s*(?=\(|x|Math|SEN|COS|TG|LG)/g, '$1*');
    e = e.replace(/(^|\()\s*-/g, '$1-1*');
    return e;
};
const ENTORNO = [
    (d) => Math.sin(rad(d)), (d) => Math.cos(rad(d)), (d) => Math.tan(rad(d)),
    (b, v) => Math.log(v) / Math.log(b),
];
// Texto «L = R» de la pregunta (ecuación del problema o la propia ecuación del ast)
export const ecuacionTexto = (eq) => eq.ecuacion || (eq.ast || [])
    .map((el) => (el.t === 'm' || el.t === 'text' ? el.v : el.t === 'mfrac' ? `((${el.n})/(${el.d}))` : ''))
    .join('');
// Datos mínimos (serializables) para dibujar la solución gráfica
export const datosGrafica = (eq) => ({
    ecuacion: ecuacionTexto(eq),
    sols: eq.correctAnswers || [],
    desc: eq.descartadas || [],
    grados: !!eq.grados,
    prob: String(eq.sub || '').startsWith('PROB'),
});
const cacheFn = new Map();
export const funcionesEcuacion = (g) => {
    if (!g?.ecuacion) return null;
    if (cacheFn.has(g.ecuacion)) return cacheFn.get(g.ecuacion);
    const partes = g.ecuacion.split(' = ');
    let res = null;
    if (partes.length === 2) {
        try {
            const mk = (t) => {
                // eslint-disable-next-line no-new-func
                const f = new Function('x', 'SEN', 'COS', 'TG', 'LG', `return (${exprJS(t)});`);
                return (x) => { try { const y = f(x, ...ENTORNO); return typeof y === 'number' && isFinite(y) ? y : NaN; } catch { return NaN; } };
            };
            res = { L: mk(partes[0]), R: mk(partes[1]) };
        } catch { res = null; }
    }
    if (cacheFn.size > 300) cacheFn.clear();
    cacheFn.set(g.ecuacion, res);
    return res;
};
// Intervalo de x que conviene dibujar
export const ventanaX = (g) => {
    if (g.grados) return [0, 360];
    const pts = [...g.sols, ...g.desc].filter(isFinite);
    let lo = Math.min(...pts, g.prob ? 0 : Infinity), hi = Math.max(...pts, g.prob ? 0 : -Infinity);
    if (!isFinite(lo)) { lo = -5; hi = 5; }
    const span = Math.max(hi - lo, 4);
    const m = span * 0.3 + (span > 40 ? 0 : 1);
    return [lo - m, hi + m];
};
// Abscisas de los puntos de corte (cambio de signo de L − R + bisección; descarta asíntotas)
export const cortesEcuacion = (g, x0, x1) => {
    const fn = funcionesEcuacion(g);
    if (!fn) return [];
    if (x0 === undefined) [x0, x1] = ventanaX(g);
    const f = (x) => fn.L(x) - fn.R(x);
    const n = 1200, out = [];
    let xa = x0, fa = f(xa);
    for (let i = 1; i <= n; i++) {
        const xb = x0 + ((x1 - x0) * i) / n, fb = f(xb);
        if (fa === 0) out.push(xa);
        else if (isFinite(fa) && isFinite(fb) && fa * fb < 0) {
            let a = xa, b = xb, A = fa;
            for (let k = 0; k < 60; k++) { const c = (a + b) / 2, C = f(c); if (!isFinite(C)) break; if (A * C <= 0) b = c; else { a = c; A = C; } }
            const r = (a + b) / 2, y = f(r);
            if (isFinite(y) && Math.abs(y) < 1e-6 * (1 + Math.abs(fn.L(r)))) out.push(Math.abs(r - Math.round(r)) < 1e-7 ? Math.round(r) : r);
        }
        xa = xb; fa = fb;
    }
    if (fa === 0) out.push(xa);
    return uniqTol(out);
};

// ─── Notación de las fichas (utils/MathRender: FRAC, SQRT, a^{…}) ─────────────
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export const aMathRender = (s) => {
    let out = '', i = 0;
    while (i < s.length) {
        const ch = s[i];
        if ((ch === '^' || ch === '_' || ch === '√') && s[i + 1] === '{') {
            let depth = 0, j = i + 1;
            for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (depth === 0) break; } }
            const inner = s.slice(i + 2, j);
            out += ch === '^' ? `^{${aMathRender(inner)}}` : ch === '_' ? inner.replace(/\d/g, (d) => SUBS[d]) : `SQRT(${aMathRender(inner)})`;
            i = j + 1;
        } else { out += ch; i++; }
    }
    return out;
};
export const tieneMarcado = (s) => /[\^_√]\{/.test(String(s));
export const astAMathRender = (ast) => (ast || [])
    .map((el) => (el.t === 'mfrac' ? `FRAC(${aMathRender(el.n)},${aMathRender(el.d)})` : el.t === 'm' || el.t === 'text' ? aMathRender(el.v) : ''))
    .join('');

// ─── Comprobación de respuestas ──────────────────────────────────────────────
const parseNum = (p) => {
    const s = p.replace(/\s+/g, '').replace(',', '.');
    const m = s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
    if (m) return parseFloat(m[1]) / parseFloat(m[2]);
    if (/^-?\d*\.?\d+$/.test(s)) return parseFloat(s);
    return NaN;
};
export const parseListaSoluciones = (txt) => {
    const s = String(txt || '')
        .replace(/[−–—]/g, '-')
        .replace(/[°º]/g, '')
        .replace(/x\s*[₁₂₃₄0-9]*\s*=/gi, '')
        .trim();
    if (!s) return [];
    let partes = s.split(/[;|]/);
    if (partes.length === 1 && /,\s/.test(s)) partes = s.split(/,\s+/);
    if (partes.length === 1 && /\sy\s/i.test(s)) partes = s.split(/\s+y\s+/i);
    return partes.map((p) => p.trim()).filter(Boolean).map(parseNum);
};
export const comprobarMulti = (eq, txt) => {
    let vals = parseListaSoluciones(txt);
    if (!vals.length || vals.some((v) => !isFinite(v))) return false;
    if (eq.grados) vals = vals.map((v) => ((v % 360) + 360) % 360);
    const u = uniqSort(vals), c = eq.correctAnswers || [];
    return u.length === c.length && u.every((v, i) => Math.abs(v - c[i]) < 1e-6);
};
export const formatoSolucion = (eq, v) => (eq.grados ? `${num(v)}°` : num(v));
export const textoSoluciones = (eq) => {
    const c = eq?.correctAnswers || [];
    if (!c.length) return 'Sin solución';
    const pre = String(eq.sub || '').startsWith('PROB') ? '' : 'x = ';
    return c.map((v) => pre + formatoSolucion(eq, v)).join(' ; ') + (eq.unidad ? ` ${eq.unidad}` : '');
};
