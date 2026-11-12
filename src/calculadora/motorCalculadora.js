// ─────────────────────────────────────────────────────────────────────────────
//  Motor de la Casio fx-82MS interactiva (CalculadoraInteractiva.jsx).
//  La entrada es una lista de «tokens» (lo que se ve en pantalla) que se evalúa
//  con un analizador descendente propio (sin eval):
//    + − × ÷ con prioridad, multiplicación implícita (2π, 3(4), 2√3),
//    ^ y ˣ√, x² x³ x⁻¹ x! %, √ ∛ log ln 10^ e^ sin cos tan (y sus inversas, hyp),
//    (−), paréntesis sin cerrar, a⌟b⌟c (fracciones), 37°48°10° (sexagesimal),
//    EXP, π, Ans, memorias A–F, X, Y, M, Ran#, nCr, nPr, Pol( y Rec(.
//  Modos de ángulo: 'D' (grados), 'R' (radianes), 'G' (gradianes).
// ─────────────────────────────────────────────────────────────────────────────

export class ErrorCalc extends Error {
    constructor(tipo) { super(tipo); this.tipo = tipo; } // 'Syntax' | 'Math'
}
const sintaxis = () => { throw new ErrorCalc('Syntax'); };
const mates = () => { throw new ErrorCalc('Math'); };

const PREFIJOS = new Set(['√', '∛', 'log', 'ln', '10^', 'e^', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh']);
const POSTFIJOS = new Set(['²', '³', '⁻¹', '!', '%']);
const CONSTANTES = new Set(['π', 'Ans', 'Ran#', 'A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M']);
const esDigito = (t) => /^[0-9.]$/.test(t);

const factorial = (n) => {
    if (n < 0 || !Number.isInteger(n) || n > 69) mates();
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
};
const combinaciones = (n, r) => {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) mates();
    return Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
};
const variaciones = (n, r) => {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) mates();
    return Math.round(factorial(n) / factorial(n - r));
};

/**
 * Evalúa la lista de tokens.
 * ctx = { modo: 'D'|'R'|'G', ans, vars: {A..M} }
 * Devuelve { valor, conFraccion, conGrados }.
 */
export function evaluar(tokens, ctx = {}) {
    const modo = ctx.modo || 'D';
    const aRad = (v) => (modo === 'D' ? (v * Math.PI) / 180 : modo === 'G' ? (v * Math.PI) / 200 : v);
    const deRad = (v) => (modo === 'D' ? (v * 180) / Math.PI : modo === 'G' ? (v * 200) / Math.PI : v);
    const vars = ctx.vars || {};
    let i = 0;
    let conFraccion = false, conGrados = false;
    const ver = () => tokens[i];
    const tomar = () => tokens[i++];
    const fin = () => i >= tokens.length;

    // Literal numérico: 12.5 · 3⌟4 · 1⌟2⌟3 · 2E−5 · 37°48°10°
    const numero = () => {
        const leerDigitos = () => {
            let s = '';
            while (!fin() && esDigito(ver())) s += tomar();
            return s;
        };
        let s = leerDigitos();
        if (!s) sintaxis();
        if ((s.match(/\./g) || []).length > 1) sintaxis();
        let v = parseFloat(s);
        if (isNaN(v)) sintaxis();
        // Fracción a⌟b o a⌟b⌟c
        if (ver() === '⌟') {
            conFraccion = true;
            tomar();
            const b = parseFloat(leerDigitos());
            if (isNaN(b)) sintaxis();
            if (ver() === '⌟') {
                tomar();
                const c = parseFloat(leerDigitos());
                if (isNaN(c)) sintaxis();
                if (c === 0) mates();
                v = v + b / c;
            } else {
                if (b === 0) mates();
                v = v / b;
            }
        }
        // Notación científica
        if (ver() === 'E') {
            tomar();
            let sg = 1;
            if (ver() === 'neg' || ver() === '-') { tomar(); sg = -1; }
            const e = leerDigitos();
            if (!e) sintaxis();
            v *= 10 ** (sg * parseFloat(e));
        }
        // Sexagesimal: 37°48°10°
        if (ver() === '°') {
            conGrados = true;
            tomar();
            let div = 60;
            while (!fin() && esDigito(ver())) {
                const guarda = i;
                const p = leerDigitos();
                if (ver() !== '°') { i = guarda; break; }
                tomar();
                v += parseFloat(p) / div;
                div *= 60;
            }
        }
        return v;
    };

    const constante = (t) => {
        if (t === 'π') return Math.PI;
        if (t === 'Ans') { if (ctx.ansFrac) conFraccion = true; return ctx.ans ?? 0; }
        if (t === 'Ran#') return Math.floor(Math.random() * 1000) / 1000;
        return vars[t] ?? 0;
    };

    const empiezaPrimario = (t) => t !== undefined && (esDigito(t) || t === '(' || CONSTANTES.has(t) || PREFIJOS.has(t) || t === 'Pol(' || t === 'Rec(');

    const primario = () => {
        const t = ver();
        if (t === undefined) sintaxis();
        if (esDigito(t)) return numero();
        if (t === '(') {
            tomar();
            const v = expresion();
            if (ver() === ')') tomar();
            else if (!fin()) sintaxis(); // paréntesis sin cerrar al final: se admite
            return v;
        }
        if (CONSTANTES.has(t)) { tomar(); return constante(t); }
        if (t === 'Pol(' || t === 'Rec(') {
            tomar();
            const a = expresion();
            if (ver() !== ',') sintaxis();
            tomar();
            const b = expresion();
            if (ver() === ')') tomar();
            if (t === 'Pol(') return Math.hypot(a, b);
            return a * Math.cos(aRad(b));
        }
        if (PREFIJOS.has(t)) {
            tomar();
            const x = unario();
            switch (t) {
                case '√': if (x < 0) mates(); return Math.sqrt(x);
                case '∛': return Math.cbrt(x);
                case 'log': if (x <= 0) mates(); return Math.log10(x);
                case 'ln': if (x <= 0) mates(); return Math.log(x);
                case '10^': return 10 ** x;
                case 'e^': return Math.exp(x);
                case 'sin': return limpiar(Math.sin(aRad(x)));
                case 'cos': return limpiar(Math.cos(aRad(x)));
                case 'tan': {
                    const c = limpiar(Math.cos(aRad(x)));
                    if (c === 0) mates();
                    return limpiar(Math.tan(aRad(x)));
                }
                case 'asin': if (x < -1 || x > 1) mates(); return deRad(Math.asin(x));
                case 'acos': if (x < -1 || x > 1) mates(); return deRad(Math.acos(x));
                case 'atan': return deRad(Math.atan(x));
                case 'sinh': return Math.sinh(x);
                case 'cosh': return Math.cosh(x);
                case 'tanh': return Math.tanh(x);
                case 'asinh': return Math.asinh(x);
                case 'acosh': if (x < 1) mates(); return Math.acosh(x);
                case 'atanh': if (x <= -1 || x >= 1) mates(); return Math.atanh(x);
                default: sintaxis();
            }
        }
        return sintaxis();
    };

    const conPostfijos = () => {
        let v = primario();
        while (!fin() && POSTFIJOS.has(ver())) {
            const t = tomar();
            if (t === '²') v = v * v;
            else if (t === '³') v = v * v * v;
            else if (t === '⁻¹') { if (v === 0) mates(); v = 1 / v; }
            else if (t === '!') v = factorial(v);
            else if (t === '%') v = v / 100;
        }
        return v;
    };

    const potencia = () => {
        const base = conPostfijos();
        if (ver() === '^') {
            tomar();
            const e = unario();
            const r = base ** e;
            if (!Number.isFinite(r)) mates();
            return r;
        }
        if (ver() === 'ˣ√') {
            tomar();
            const radicando = unario();
            if (base === 0) mates();
            if (radicando < 0) {
                if (Number.isInteger(base) && Math.abs(base) % 2 === 1) return -((-radicando) ** (1 / base));
                mates();
            }
            return radicando ** (1 / base);
        }
        return base;
    };

    function unario() {
        if (ver() === 'neg') { tomar(); return -unario(); }
        return potencia();
    }

    // Multiplicación implícita: 2π, 3(4 + 1), 2√3, 4sin 30
    const implicito = () => {
        let v = unario();
        while (!fin() && empiezaPrimario(ver())) v *= unario();
        return v;
    };

    const termino = () => {
        let v = implicito();
        while (!fin() && ['×', '÷', 'nCr', 'nPr'].includes(ver())) {
            const op = tomar();
            const w = implicito();
            if (op === '×') v *= w;
            else if (op === '÷') { if (w === 0) mates(); v /= w; }
            else if (op === 'nCr') v = combinaciones(v, w);
            else v = variaciones(v, w);
        }
        return v;
    };

    function expresion() {
        let v = termino();
        while (!fin() && (ver() === '+' || ver() === '-')) {
            const op = tomar();
            const w = termino();
            v = op === '+' ? v + w : v - w;
        }
        return v;
    }

    if (!tokens.length) return { valor: ctx.ans ?? 0, conFraccion: false, conGrados: false };
    const valor = expresion();
    if (!fin()) sintaxis();
    if (!Number.isFinite(valor) || Math.abs(valor) >= 1e100) mates();
    return { valor, conFraccion, conGrados };
}

// Evita −0 y residuos como sin 180 = 1.2e−16
const limpiar = (v) => (Math.abs(v) < 1e-13 ? 0 : Math.abs(v - Math.round(v)) < 1e-13 ? Math.round(v) : v);

// ─── Formato de pantalla ─────────────────────────────────────────────────────
const SUPS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const exponente = (n) => String(n).split('').map((c) => SUPS[c] || c).join('');

// Como la Norm 1 de la fx-82MS: 10 cifras; notación científica si |x| ≥ 10¹⁰ o |x| < 0,01
export function formatearDecimal(v) {
    if (v === 0) return '0.';
    const a = Math.abs(v);
    if (a >= 1e10 || a < 0.01) {
        const [m, e] = v.toExponential(9).split('e');
        const mant = String(parseFloat(m));
        return `${mant}×10${exponente(parseInt(e, 10))}`;
    }
    const enteras = Math.floor(Math.log10(a)) + 1;
    const dec = Math.max(0, 10 - Math.max(1, enteras));
    const txt = String(parseFloat(v.toFixed(dec)));
    return txt.includes('.') ? txt : txt + '.'; // como la Casio: «90.»
}

// Fracción con denominador pequeño (como a b/c): { n, d } o null
export function aFraccion(v, maxDen = 9999) {
    if (!Number.isFinite(v)) return null;
    for (let d = 1; d <= maxDen; d++) {
        const n = Math.round(v * d);
        if (Math.abs(n / d - v) < 1e-10 * Math.max(1, Math.abs(v))) {
            if (String(Math.abs(n)).length + String(d).length > 10) return null;
            return { n, d };
        }
    }
    return null;
}
// mixta: 1⌟1⌟2 · impropia (d/c): 3⌟2
export function formatearFraccion(v, impropia = false) {
    const f = aFraccion(v);
    if (!f || f.d === 1) return null;
    const s = f.n < 0 ? '-' : '';
    const n = Math.abs(f.n);
    if (impropia || n < f.d) return `${s}${n}⌟${f.d}`;
    return `${s}${Math.floor(n / f.d)}⌟${n % f.d}⌟${f.d}`;
}
// En pantalla: 37°48°10° → 37°48′10″ (la tecla °′″ es la misma para las tres partes,
// pero así se distinguen grados, minutos y segundos)
export const marcasSexagesimales = (txt) => String(txt).replace(/(?:\d*\.?\d+°){2,3}/g, (m) => {
    let k = 0;
    return m.replace(/°/g, () => ['°', '′', '″'][k++]);
});
// 37°48′10″ (con decimales en los segundos si hace falta)
export function formatearSexagesimal(v) {
    const s = v < 0 ? '-' : '';
    let a = Math.abs(v);
    let g = Math.floor(a);
    let m = Math.floor((a - g) * 60 + 1e-9);
    let seg = Math.round(((a - g) * 60 - m) * 60 * 100) / 100;
    if (seg >= 60) { seg -= 60; m += 1; }
    if (m >= 60) { m -= 60; g += 1; }
    return `${s}${g}°${m}′${String(seg).replace(/\.0+$/, '')}″`;
}
