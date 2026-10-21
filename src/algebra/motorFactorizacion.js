// motorFactorizacion.js — Motor de factorización de polinomios con pasos (Álgebra · Math World)
// Polinomios en coeficientes enteros, orden ascendente: [a0, a1, a2, ...]
// Orden del método: factor común → identidad notable (2 o 3 términos) → Ruffini con
// los divisores (p/q) → ecuación de 2.º grado → factorización y raíces.

// ─── Enteros y fracciones ────────────────────────────────────────────────────
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const fr = (n, d = 1) => {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
};
export const fAdd = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
export const fMul = (a, b) => fr(a.n * b.n, a.d * b.d);
export const fDiv = (a, b) => fr(a.n * b.d, a.d * b.n);
export const fEq = (a, b) => a.n === b.n && a.d === b.d;
export const fVal = a => a.n / a.d;
export const fStr = a => (a.n < 0 ? '−' : '') + (a.d === 1 ? `${Math.abs(a.n)}` : `${Math.abs(a.n)}/${a.d}`);

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = n => (n === 1 ? '' : String(n).split('').map(c => SUP[c]).join(''));

// ─── Polinomios ──────────────────────────────────────────────────────────────
export const norm = c => { const a = [...c]; while (a.length > 1 && a[a.length - 1] === 0) a.pop(); return a; };
export const grado = c => norm(c).length - 1;
export const nTerminos = c => c.filter(v => v !== 0).length;
export const mul = (a, b) => { const r = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };

export function polyStr(c) {
    const p = norm(c);
    const t = [];
    for (let d = p.length - 1; d >= 0; d--) {
        const v = p[d]; if (!v) continue;
        const av = Math.abs(v);
        const lit = d === 0 ? '' : d === 1 ? 'x' : `x${sup(d)}`;
        t.push({ neg: v < 0, s: d === 0 ? `${av}` : (av === 1 ? lit : `${av}${lit}`) });
    }
    if (!t.length) return '0';
    return t.map((x, i) => i === 0 ? (x.neg ? '−' : '') + x.s : (x.neg ? ' − ' : ' + ') + x.s).join('');
}

// Valor numérico exacto en r = p/q (BigInt para no desbordar)
export function evalFrac(c, r) {
    const n = c.length - 1;
    const p = BigInt(r.n), q = BigInt(r.d);
    let num = 0n;
    for (let i = 0; i <= n; i++) num += BigInt(c[i]) * p ** BigInt(i) * q ** BigInt(n - i);
    let den = q ** BigInt(n);
    const g = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
    const gg = num === 0n ? den : g(num, den);
    return { n: Number(num / gg), d: Number(den / gg) };
}
export const evalNum = (c, x) => c.reduce((s, v, i) => s + v * Math.pow(x, i), 0);

// Ruffini: devuelve la fila inferior (cociente + resto) como fracciones
export function ruffini(cAsc, r) {
    const desc = norm(cAsc).slice().reverse().map(v => fr(v));
    const fila = [desc[0]];
    const productos = [null];
    for (let i = 1; i < desc.length; i++) {
        const pr = fMul(r, fila[i - 1]);
        productos.push(pr);
        fila.push(fAdd(desc[i], pr));
    }
    return { desc, productos, fila };
}

const divisores = n => {
    n = Math.abs(n); const r = [];
    for (let i = 1; i * i <= n; i++) if (n % i === 0) { r.push(i); if (i * i !== n) r.push(n / i); }
    return r.sort((a, b) => a - b);
};

// Posibles raíces racionales ±p/q (p | término independiente, q | coeficiente principal)
export function candidatos(c) {
    const p = norm(c);
    const a0 = p[0], an = p[p.length - 1];
    if (a0 === 0) return [fr(0)];
    const vistos = new Set(); const res = [];
    for (const dp of divisores(a0)) for (const dq of divisores(an)) for (const s of [1, -1]) {
        const f = fr(s * dp, dq); const k = `${f.n}/${f.d}`;
        if (!vistos.has(k)) { vistos.add(k); res.push(f); }
    }
    // Primero enteros, de menor a mayor valor absoluto (positivo antes), luego fracciones
    return res.sort((a, b) => (a.d !== 1) - (b.d !== 1) || Math.abs(fVal(a)) - Math.abs(fVal(b)) || fVal(b) - fVal(a));
}

// ─── Factor común ────────────────────────────────────────────────────────────
export function factorComun(c) {
    const p = norm(c);
    const lead = p[p.length - 1];
    const g = p.reduce((a, v) => gcd(a, v), 0) * Math.sign(lead || 1);
    let m = 0; while (m < p.length - 1 && p[m] === 0) m++;
    const Q = p.slice(m).map(v => v / g);
    return { g, m, Q, ninguno: g === 1 && m === 0 };
}
export const monoStr = (g, m) => {
    const lit = m === 0 ? '' : m === 1 ? 'x' : `x${sup(m)}`;
    if (!lit) return `${g < 0 ? '−' : ''}${Math.abs(g)}`;
    return (g === -1 ? '−' : g === 1 ? '' : `${g < 0 ? '−' : ''}${Math.abs(g)}`) + lit;
};

// ─── Identidades notables ────────────────────────────────────────────────────
const raizExacta = n => { if (n < 0) return null; const r = Math.round(Math.sqrt(n)); return r * r === n ? r : null; };
const monoPoly = (a, n, b) => { const r = Array(n + 1).fill(0); r[n] = a; r[0] += b; return r; };
const termTxt = (a, n) => `${a === 1 ? '' : a}${n === 1 ? 'x' : `x${sup(n)}`}`;

export const IDENTIDADES = {
    cuadSuma: { nombre: 'Cuadrado de una suma', formula: 'a² + 2ab + b² = (a + b)²' },
    cuadDif: { nombre: 'Cuadrado de una diferencia', formula: 'a² − 2ab + b² = (a − b)²' },
    sumaDif: { nombre: 'Suma por diferencia', formula: 'a² − b² = (a + b)(a − b)' },
};

// Devuelve null o { tipo, aTxt, bTxt, bases:[{poly,exp}] } para polinomios de 2 o 3 términos
export function detectarIdentidad(c) {
    const p = norm(c);
    const nz = p.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const deg = p.length - 1;
    if (nz[0] !== 0 || deg < 2 || deg % 2) return null;
    const n = deg / 2;
    const A = p[deg], C = p[0];
    if (nz.length === 2) {
        const a = raizExacta(A), b = raizExacta(-C);
        if (A > 0 && C < 0 && a && b) return {
            tipo: 'sumaDif', aTxt: termTxt(a, n), bTxt: `${b}`,
            bases: [{ poly: monoPoly(a, n, b), exp: 1 }, { poly: monoPoly(a, n, -b), exp: 1 }],
        };
    }
    if (nz.length === 3 && nz[1] === n) {
        const a = raizExacta(A), b = raizExacta(C), B = p[n];
        if (A > 0 && C > 0 && a && b && Math.abs(B) === 2 * a * b) return {
            tipo: B > 0 ? 'cuadSuma' : 'cuadDif', aTxt: termTxt(a, n), bTxt: `${b}`,
            bases: [{ poly: monoPoly(a, n, B > 0 ? b : -b), exp: 2 }],
        };
    }
    return null;
}

// ─── Ecuación de segundo grado ───────────────────────────────────────────────
export function resolverCuadratica(c) {
    const [cc, b, a] = norm(c);
    const delta = b * b - 4 * a * cc;
    if (delta < 0) return { a, b, c: cc, delta, tipo: 'ninguna', raices: [] };
    const s = raizExacta(delta);
    if (s !== null) {
        const r1 = fr(-b + s, 2 * a), r2 = fr(-b - s, 2 * a);
        return { a, b, c: cc, delta, tipo: s === 0 ? 'doble' : 'racional', raices: [r1, r2] };
    }
    // √Δ = k√t
    let k = 1, t = delta;
    for (let i = 2; i * i <= t; i++) while (t % (i * i) === 0) { t /= i * i; k *= i; }
    let den = 2 * a, B = -b, K = k;
    const g = gcd(gcd(B, K), den); B /= g; K /= g; den /= g;
    if (den < 0) { den = -den; B = -B; K = -K; }
    const kt = `${Math.abs(K) === 1 ? '' : Math.abs(K)}√${t}`;
    const txt = sg => {
        const num = B === 0 ? `${sg * Math.sign(K) < 0 ? '−' : ''}${kt}` : `${B < 0 ? '−' : ''}${Math.abs(B)} ${sg * Math.sign(K) > 0 ? '+' : '−'} ${kt}`;
        return den === 1 ? num : `(${num})/${den}`;
    };
    const raices = [1, -1].map(sg => ({ irr: true, txt: txt(sg), val: (-b + sg * Math.sqrt(delta)) / (2 * a) }));
    return { a, b, c: cc, delta, tipo: 'irracional', raices, raizDelta: kt };
}

// ─── Estado de la factorización (compartido por el modo automático y el guiado) ──
// factores: { tipo:'lin', r } = (x − r) · { tipo:'irr', txt, val } · { tipo:'poly', poly }
export function estadoInicial(P) {
    return { P: norm(P), k: fr(1), factores: [], cola: [], actual: null, fase: 'fc', log: [] };
}
const addFactor = (st, f, exp) => { st.factores.push({ ...f, exp }); };
const potF = (f, e) => { let r = fr(1); for (let i = 0; i < e; i++) r = fMul(r, f); return r; };

export function addLineal(st, poly, exp) {
    const [b, a] = norm(poly);
    st.k = fMul(st.k, potF(fr(a), exp));
    addFactor(st, { tipo: 'lin', r: fr(-b, a) }, exp);
}

// Aplica el factor común (paso 1) y deja el resto en la cola
export function aplicarFactorComun(st) {
    const fc = factorComun(st.P);
    st.k = fr(fc.g);
    if (fc.m > 0) addFactor(st, { tipo: 'lin', r: fr(0) }, fc.m);
    st.log.push({ tipo: 'fc', P: st.P, ...fc });
    st.cola = [{ poly: fc.Q, exp: 1 }];
    return avanzar(st);
}

// Saca el siguiente polinomio pendiente y decide qué fase toca
export function avanzar(st) {
    while (st.cola.length) {
        const item = st.cola.shift();
        const d = grado(item.poly);
        if (d === 0) { st.k = fMul(st.k, potF(fr(item.poly[0]), item.exp)); continue; }
        if (d === 1) { addLineal(st, item.poly, item.exp); st.log.push({ tipo: 'lin', Q: item.poly, r: fr(-item.poly[0], item.poly[1]) }); continue; }
        st.actual = { ...item, probados: [] };
        const nt = nTerminos(item.poly);
        st.fase = (nt === 2 || nt === 3) ? 'id' : d === 2 ? 'cuad' : 'ruf';
        return st;
    }
    st.actual = null; st.fase = 'fin';
    return st;
}

// Resuelve la fase de identidad (si es o no identidad)
export function aplicarIdentidad(st) {
    const { poly, exp } = st.actual;
    const id = detectarIdentidad(poly);
    if (id) {
        st.log.push({ ...id, tipo: 'id', ident: id.tipo, Q: poly });
        st.cola.unshift(...id.bases.map(b => ({ poly: b.poly, exp: b.exp * exp })));
        return avanzar(st);
    }
    st.log.push({ tipo: 'noId', Q: poly });
    st.fase = grado(poly) === 2 ? 'cuad' : 'ruf';
    return st;
}

// Prueba un valor en la fase de Ruffini. Devuelve { esRaiz, valor }
export function probarValor(st, r) {
    const { poly, exp } = st.actual;
    const valor = evalFrac(poly, r);
    st.actual.probados = [...st.actual.probados, { r, valor }];
    if (valor.n !== 0) return { esRaiz: false, valor };
    const rf = ruffini(poly, r);
    const cociente = rf.fila.slice(0, -1).map(f => f.n / f.d).reverse();
    st.log.push({ tipo: 'ruf', Q: poly, probados: st.actual.probados, raiz: r, ...rf, cociente });
    addFactor(st, { tipo: 'lin', r }, exp);
    const d = grado(cociente);
    if (d <= 1) { st.cola.unshift({ poly: cociente, exp }); return { esRaiz: true, valor, st: avanzar(st) }; }
    st.actual = { poly: cociente, exp, probados: [] };
    st.fase = d === 2 ? 'cuad' : 'ruf';
    return { esRaiz: true, valor, st };
}

export const raizRacionalPendiente = poly => candidatos(poly).find(r => evalFrac(poly, r).n === 0) || null;

// Sin raíces racionales: el factor queda irreducible
export function marcarIrreducible(st) {
    const { poly, exp } = st.actual;
    addFactor(st, { tipo: 'poly', poly }, exp);
    st.log.push({ tipo: 'irred', Q: poly, probados: st.actual.probados, candidatos: candidatos(poly) });
    return avanzar(st);
}

export function aplicarCuadratica(st) {
    const { poly, exp } = st.actual;
    const sol = resolverCuadratica(poly);
    st.log.push({ ...sol, tipo: 'cuad', clase: sol.tipo, Q: poly });
    if (sol.tipo === 'ninguna') addFactor(st, { tipo: 'poly', poly }, exp);
    else {
        st.k = fMul(st.k, potF(fr(sol.a), exp));
        sol.raices.forEach(r => addFactor(st, r.irr ? { tipo: 'irr', txt: r.txt, val: r.val } : { tipo: 'lin', r }, exp));
    }
    return avanzar(st);
}

// Resolución automática completa
export function factorizarAuto(P) {
    let st = aplicarFactorComun(estadoInicial(P));
    let guard = 0;
    while (st.fase !== 'fin' && guard++ < 60) {
        if (st.fase === 'id') st = aplicarIdentidad(st);
        else if (st.fase === 'cuad') st = aplicarCuadratica(st);
        else if (st.fase === 'ruf') {
            const cands = candidatos(st.actual.poly);
            const raiz = cands.find(r => evalFrac(st.actual.poly, r).n === 0);
            if (!raiz) { cands.forEach(r => { st.actual.probados.push({ r, valor: evalFrac(st.actual.poly, r) }); }); st = marcarIrreducible(st); continue; }
            for (const r of cands) { const res = probarValor(st, r); if (res.esRaiz) { st = res.st; break; } }
        }
    }
    return st;
}

// ─── Resultado final: factorización y raíces ─────────────────────────────────
function agrupar(factores) {
    const m = new Map();
    for (const f of factores) {
        const key = f.tipo === 'lin' ? `l${f.r.n}/${f.r.d}` : f.tipo === 'irr' ? `i${f.txt}` : `p${f.poly.join(',')}`;
        if (m.has(key)) m.get(key).exp += f.exp; else m.set(key, { ...f });
    }
    const orden = f => f.tipo === 'lin' ? (f.r.n === 0 ? -1e9 : fVal(f.r)) : f.tipo === 'irr' ? 1e6 + f.val : 2e6;
    return [...m.values()].sort((a, b) => orden(a) - orden(b));
}
const expTxt = e => (e > 1 ? sup(e) : '');
function factorTxt(f, entera) {
    if (f.tipo === 'lin') {
        if (f.r.n === 0) return 'x' + expTxt(f.exp);
        if (entera && f.r.d !== 1) return `(${f.r.d}x ${f.r.n > 0 ? '−' : '+'} ${Math.abs(f.r.n)})${expTxt(f.exp)}`;
        return `(x ${f.r.n > 0 ? '−' : '+'} ${fStr(fr(Math.abs(f.r.n), f.r.d))})${expTxt(f.exp)}`;
    }
    if (f.tipo === 'irr') return `(x − (${f.txt}))${expTxt(f.exp)}`;
    return `(${polyStr(f.poly)})${expTxt(f.exp)}`;
}
const constTxt = (k, hay) => {
    if (!hay) return fStr(k);
    if (k.n === 1 && k.d === 1) return '';
    if (k.n === -1 && k.d === 1) return '−';
    return k.d === 1 ? fStr(k) : `(${fStr(k)})`;
};

export function resultadoFinal(st) {
    const fs = agrupar(st.factores);
    const hay = fs.length > 0;
    const forma = constTxt(st.k, hay) + fs.map(f => factorTxt(f, false)).join('');
    // Forma entera: (x − p/q) → (qx − p), dividiendo la constante entre q
    let kE = st.k;
    fs.forEach(f => { if (f.tipo === 'lin' && f.r.d !== 1) kE = fDiv(kE, potF(fr(f.r.d), f.exp)); });
    const hayFrac = fs.some(f => f.tipo === 'lin' && f.r.d !== 1);
    const formaEntera = hayFrac && kE.d === 1 ? constTxt(kE, hay) + fs.map(f => factorTxt(f, true)).join('') : null;
    const raices = fs.filter(f => f.tipo !== 'poly').map(f => ({
        txt: f.tipo === 'lin' ? fStr(f.r) : f.txt,
        val: f.tipo === 'lin' ? fVal(f.r) : f.val,
        mult: f.exp,
    }));
    const irreducibles = fs.filter(f => f.tipo === 'poly').map(f => polyStr(f.poly));
    return { forma, formaEntera, raices, irreducibles };
}
export const multTxt = m => m === 1 ? '' : m === 2 ? ' (doble)' : m === 3 ? ' (triple)' : ` (multiplicidad ${m})`;

// ─── Lectura de números y polinomios escritos ────────────────────────────────
// Acepta "3", "-2", "3/2", "−1.5"
export function parseNumero(txt) {
    const s = String(txt).trim().replace(/[−–]/g, '-').replace(',', '.');
    if (!s) return null;
    const m = s.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
    if (m) return +m[2] === 0 ? null : { frac: fr(+m[1], +m[2]), val: +m[1] / +m[2] };
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
    const v = parseFloat(s);
    return { frac: Number.isInteger(v) ? fr(v) : null, val: v };
}

const SUP_INV = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
// "2x^3 − 4x² + x − 3" → [−3, 1, −4, 2]. Lanza Error con mensaje legible.
export function parsePolinomio(txt) {
    let s = String(txt).replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/[·*]/g, '').replace(/X/g, 'x');
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^' + m.split('').map(c => SUP_INV[c]).join(''));
    if (!s) throw new Error('Escribe un polinomio.');
    if (!/^[+-]/.test(s)) s = '+' + s;
    const terms = s.match(/[+-][^+-]+/g) || [];
    if (terms.join('') !== s) throw new Error('No entiendo la expresión.');
    const c = [];
    for (const t of terms) {
        const m = t.match(/^([+-])(\d+)?(x(?:\^(\d+))?)?$/);
        if (!m || (!m[2] && !m[3])) throw new Error(`No entiendo el término «${t}». Usa solo números enteros y x (ej. 2x^3 − 5x + 6).`);
        const coef = (m[2] ? parseInt(m[2], 10) : 1) * (m[1] === '-' ? -1 : 1);
        const d = m[3] ? (m[4] ? parseInt(m[4], 10) : 1) : 0;
        if (d > 8) throw new Error('El grado máximo es 8.');
        while (c.length <= d) c.push(0);
        c[d] += coef;
    }
    const p = norm(c);
    if (p.some(v => Math.abs(v) > 100000)) throw new Error('Coeficientes demasiado grandes.');
    if (p.length < 2) throw new Error('El polinomio debe tener grado 1 o más.');
    return p;
}

// ─── Generador de ejercicios (3.º: mónicos con raíces enteras · 4.º: raíces p/q) ──
const rI = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = a => a[Math.floor(Math.random() * a.length)];
const lin = (q, p) => [-p, q]; // qx − p

export function generarEjercicio(nivel = 3, tipo) {
    const t = tipo || pick(['ruf', 'ruf', 'fcRuf', 'fcRuf', 'id', 'fcId']);
    const k = pick([1, 1, 2, 3, -1, -2, 5]);
    const raicesEnteras = n => Array.from({ length: n }, () => pick([-4, -3, -2, -1, 1, 2, 3, 4, -1, 1, 2, -2]));
    const fracLin = () => { const q = pick([2, 3]); let p = pick([-3, -2, -1, 1, 2, 3]); if (gcd(p, q) !== 1) p = p > 0 ? 1 : -1; return lin(q, p); };

    // Parte "Ruffini": producto de factores lineales (+ a veces un cuadrático irracional)
    const parteRuffini = grad => {
        let P = [1];
        const extraCuad = Math.random() < 0.2;
        const nLin = extraCuad ? grad - 2 : grad;
        raicesEnteras(nLin).forEach((r, i) => { P = mul(P, nivel === 4 && i === 0 ? fracLin() : lin(1, r)); });
        if (extraCuad) P = mul(P, pick([[-2, 0, 1], [-3, 0, 1], [-1, -2, 1], [1, 0, 1], [-5, 0, 1]]));
        return P;
    };
    // Parte "identidad"
    const parteIdent = () => {
        const a = nivel === 4 ? pick([1, 2, 3]) : 1;
        const b = pick([1, 2, 3, 4, 5]);
        const forma = pick(['cs', 'cd', 'sd', 'sd']);
        if (forma === 'cs') return mul(lin(a, -b), lin(a, -b));
        if (forma === 'cd') return mul(lin(a, b), lin(a, b));
        if (Math.random() < 0.2 && nivel === 3) return [-(pick([1, 2]) ** 4), 0, 0, 0, 1]; // x⁴ − b⁴
        return mul(lin(a, b), lin(a, -b));
    };

    let P;
    if (t === 'ruf') P = parteRuffini(pick([3, 3, 4]));
    else if (t === 'fcRuf') { P = parteRuffini(pick([2, 3, 3])); P = mul(P, monoPoly(k === 1 ? 2 : k, pick([0, 1, 1, 2]), 0)); }
    else if (t === 'id') P = mul(parteIdent(), [k === 1 ? 1 : pick([1, 1, k])]);
    else { P = parteIdent(); P = mul(P, monoPoly(k, pick([1, 1, 2]), 0)); }
    P = norm(P);
    // Evitar coeficientes desproporcionados
    if (P.some(v => Math.abs(v) > 400) || grado(P) > 6) return generarEjercicio(nivel, tipo);
    return { P, tipo: t };
}
