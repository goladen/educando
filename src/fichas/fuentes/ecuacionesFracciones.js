// ─────────────────────────────────────────────────────────────────────────────
//  Fichas · Ecuaciones de 1.er grado con denominadores (y paréntesis).
//  Las fracciones se escriben en vertical (notación de utils/MathRender:
//  FRAC(num,den)) y la resolución va paso a paso: m.c.m., multiplicar,
//  quitar paréntesis, agrupar y despejar. La solución siempre es entera.
//
//  Una ecuación es una lista de términos con su miembro (lado 'L' o 'R'):
//    frac: s · k(p·x + q) / d      lin: c·x + b
// ─────────────────────────────────────────────────────────────────────────────
import { R, pick, N, mcd, mcm } from '../fuenteTexto';

const MENOS = '−';
// «p·x + q» bien escrito
const lin = (p, q) => {
    let s = p === 0 ? '' : p === 1 ? 'x' : p === -1 ? `${MENOS}x` : `${N(p)}x`;
    if (q) s += s ? ` ${q < 0 ? MENOS : '+'} ${Math.abs(q)}` : N(q);
    return s || '0';
};
const coef = (k) => (k === 1 ? '' : k === -1 ? MENOS : String(k));

// Numerador de una fracción: k(px + q) o px + q
const numerador = (t, m) => (t.k === 1 ? lin(t.p, t.q) : `${t.k}(${lin(t.p, t.q)})`);
// Un término con su signo (primero = sin «+»)
const termTexto = (t, primero, mat) => {
    if (t.tipo === 'frac') {
        const sg = t.s < 0 ? (primero ? MENOS : ` ${MENOS} `) : (primero ? '' : ' + ');
        return sg + (mat ? `FRAC(${numerador(t)},${t.d})` : `${t.k === 1 && (t.p !== 1 || t.q) ? `(${numerador(t)})` : numerador(t)}/${t.d}`);
    }
    // lineal c·x + b
    let s = '';
    const pon = (v, lit) => {
        if (!v) return;
        const a = Math.abs(v), cuerpo = lit ? (a === 1 ? lit : `${a}${lit}`) : String(a);
        if (!s && primero) s += (v < 0 ? MENOS : '') + cuerpo;
        else s += (v < 0 ? ` ${MENOS} ` : ' + ') + cuerpo;
    };
    pon(t.c, 'x'); pon(t.b, '');
    return s;
};
const ladoTexto = (terms, mat) => {
    let s = '';
    for (const t of terms) { const x = termTexto(t, s === '', mat); s += x; }
    return s || '0';
};

// Valor de un término en x (los numeradores se eligen para que sea entero)
const valor = (t, X) => (t.tipo === 'frac' ? (t.s * t.k * (t.p * X + t.q)) / t.d : t.c * X + t.b);

/**
 * opts: { fracsL, fracsR, parentesis (k > 1), xEnPar (p > 1), linL, linR }
 */
function construir(opts) {
    for (let intento = 0; intento < 3000; intento++) {
        const X = R(-6, 8);
        const terms = [];
        const nuevaFrac = (lado, primeraDelLado) => {
            const d = pick([2, 3, 4, 5, 6]);
            const k = opts.parentesis && Math.random() < 0.65 ? pick([2, 3, 4, 5]) : 1;
            const p = opts.xEnPar && Math.random() < 0.5 ? pick([2, 3]) : 1;
            const s = primeraDelLado ? (Math.random() < 0.85 ? 1 : -1) : pick([1, -1]);
            // valor entero v: k(pX + q) = d·v  →  q = d·v/k − pX
            const g = k / mcd(k, d);
            const v = g * R(-4, 4);
            const q = (d * v) / k - p * X;
            if (!Number.isInteger(q) || Math.abs(q) > 12) return null;
            if (k > 1 && gcdNum(k, d) === d) return null; // evitar que se simplifique de golpe (p. ej. 3(x+1)/3)
            return { tipo: 'frac', lado, s, k, p, q, d };
        };
        let ok = true;
        for (let i = 0; i < opts.fracsL; i++) { const t = nuevaFrac('L', i === 0); if (!t) { ok = false; break; } terms.push(t); }
        for (let i = 0; ok && i < (opts.fracsR || 0); i++) { const t = nuevaFrac('R', i === 0); if (!t) { ok = false; break; } terms.push(t); }
        if (!ok) continue;
        if (opts.linL) terms.push({ tipo: 'lin', lado: 'L', c: opts.linL === 'x' ? pick([1, -1, 2, -2]) : 0, b: R(-6, 6) || 1 });
        // segundo miembro: constante (y quizá x) para que X sea la solución
        const cR = opts.linR === 'x' ? pick([1, -1, 2, 3]) : 0;
        const suma = (lado) => terms.filter((t) => t.lado === lado).reduce((a, t) => a + valor(t, X), 0);
        const bR = suma('L') - suma('R') - cR * X;
        if (!Number.isInteger(bR) || Math.abs(bR) > 30) continue;
        terms.push({ tipo: 'lin', lado: 'R', c: cR, b: bR });
        // denominadores distintos (al menos dos) y m.c.m. razonable
        const dens = [...new Set(terms.filter((t) => t.tipo === 'frac').map((t) => t.d))];
        if (dens.length < Math.min(2, terms.filter((t) => t.tipo === 'frac').length)) continue;
        const L = dens.reduce((a, d) => mcm(a, d), 1);
        if (L > 60) continue;
        // coeficiente final de x distinto de 0
        const A = terms.reduce((a, t) => a + (t.lado === 'L' ? 1 : -1) * (t.tipo === 'frac' ? t.s * t.k * t.p * L / t.d : t.c * L), 0);
        if (A === 0) continue;
        return { X, terms, L, dens };
    }
    return null;
}
const gcdNum = (a, b) => mcd(Math.abs(a), Math.abs(b));

// Pasos de la resolución
function pasosDe({ X, terms, L, dens }) {
    const lados = { L: terms.filter((t) => t.lado === 'L'), R: terms.filter((t) => t.lado === 'R') };
    // tras multiplicar por L: frac → M(px + q) con M = s·(L/d)·k ; lin → L·c x + L·b
    const multiplicado = (lado) => {
        let s = '';
        for (const t of lados[lado]) {
            if (t.tipo === 'frac') {
                const M = t.s * (L / t.d) * t.k;
                const cuerpo = `${Math.abs(M) === 1 ? '' : Math.abs(M)}(${lin(t.p, t.q)})`;
                s += s ? (M < 0 ? ` ${MENOS} ` : ' + ') + cuerpo : (M < 0 ? MENOS : '') + cuerpo;
            } else {
                s += termTexto({ ...t, c: t.c * L, b: t.b * L }, s === '', false);
            }
        }
        return s || '0';
    };
    const expandido = (lado) => {
        let s = '';
        const pon = (v, lit) => {
            if (!v) return;
            const a = Math.abs(v), cuerpo = lit ? (a === 1 ? lit : `${a}${lit}`) : String(a);
            s += s ? (v < 0 ? ` ${MENOS} ` : ' + ') + cuerpo : (v < 0 ? MENOS : '') + cuerpo;
        };
        for (const t of lados[lado]) {
            if (t.tipo === 'frac') { const M = t.s * (L / t.d) * t.k; pon(M * t.p, 'x'); pon(M * t.q, ''); }
            else { pon(t.c * L, 'x'); pon(t.b * L, ''); }
        }
        return s || '0';
    };
    const totales = (lado) => lados[lado].reduce(([a, b], t) => (t.tipo === 'frac'
        ? [a + t.s * (L / t.d) * t.k * t.p, b + t.s * (L / t.d) * t.k * t.q]
        : [a + t.c * L, b + t.b * L]), [0, 0]);
    const [aL, bL] = totales('L'), [aR, bR] = totales('R');
    const A = aL - aR, B = bR - bL;
    return [
        `m.c.m.(${dens.join(', ')}) = ${L}`,
        `Multiplicamos los dos miembros por ${L}:  ${multiplicado('L')} = ${multiplicado('R')}`,
        `Quitamos paréntesis:  ${expandido('L')} = ${expandido('R')}`,
        `Agrupamos (x a un lado, números al otro):  ${A === 1 ? "" : A === -1 ? MENOS : N(A)}x = ${N(B)}`,
        A === 1 ? `x = ${N(X)}` : `x = ${N(B)} : ${A < 0 ? `(${N(A)})` : N(A)} = ${N(X)}`,
    ];
}

const solX = (x) => [{ etiqueta: 'x =', tipo: 'frac', v: x, placeholder: 'x' }];
const apartado = (ec) => ({
    e: `${ladoTexto(ec.terms.filter((t) => t.lado === 'L'), false)} = ${ladoTexto(ec.terms.filter((t) => t.lado === 'R'), false)}`,
    m: `${ladoTexto(ec.terms.filter((t) => t.lado === 'L'), true)} = ${ladoTexto(ec.terms.filter((t) => t.lado === 'R'), true)}`,
    s: `x = ${N(ec.X)}`, r: solX(ec.X), pasos: pasosDe(ec),
});

// Niveles de «Paréntesis y denominadores» (de menos a más largas)
const NIVELES_PD = {
    1: { fracsL: 2, parentesis: true },
    2: { fracsL: 2, parentesis: true, xEnPar: true, linL: 'x', linR: 'x' },
    3: { fracsL: 2, fracsR: 1, parentesis: true, xEnPar: true, linL: 'x', linR: 'x' },
};
export function genParentesisDenominadores(nv) {
    const ec = construir(NIVELES_PD[nv] || NIVELES_PD[2]);
    return ec ? apartado(ec) : null;
}
// «Con denominadores», nivel 3: varias fracciones sin números delante del paréntesis
export function genDenominadoresLargas() {
    const ec = construir({ fracsL: 2, fracsR: Math.random() < 0.5 ? 1 : 0, xEnPar: true, linR: 'x' });
    return ec ? apartado(ec) : null;
}
