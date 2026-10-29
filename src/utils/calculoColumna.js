// ─────────────────────────────────────────────────────────────────────────────
//  OPERACIONES EN COLUMNA (método clásico): suma, resta, multiplicación y
//  división (galera española, sin escribir las restas).
//  - generarColumna(op, nivel, opts) → datos mínimos { op, nums } (se guardan
//    en las fichas tal cual; los números van como texto con «.» decimal).
//  - construirColumna(datos) → rejilla de casillas para dibujarla
//    (components/OperacionColumna.jsx), corregirla y revelarla por pasos.
//  Lo usan las fichas de cálculo (fichas/motorCalculo.jsx) y el modo
//  interactivo de Cálculo Mental (CalculoColumna.jsx).
// ─────────────────────────────────────────────────────────────────────────────

const rInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const conDigitos = (d) => rInt(10 ** (d - 1), 10 ** d - 1);
const sinCeros = (d) => { let s = ''; for (let i = 0; i < d; i++) s += rInt(1, 9); return Number(s); };

export const OPS_COLUMNA = {
    suma: { label: '➕ Sumas', signo: '+', color: '#3498db' },
    resta: { label: '➖ Restas', signo: '−', color: '#e74c3c' },
    mult: { label: '✖️ Multiplicaciones', signo: '×', color: '#f39c12' },
    div: { label: '➗ Divisiones', signo: '÷', color: '#9b59b6' },
};

export const NIVELES_COLUMNA = {
    1: { label: '👶 Fácil', desc: '1.º – 3.º Primaria' },
    2: { label: '🤓 Medio', desc: '4.º – 6.º Primaria' },
    3: { label: '🔥 Avanzado', desc: 'ESO · números grandes' },
};

// Número decimal aleatorio como texto: parte entera de `di` cifras y 1–2 decimales
const decAleatorio = (di) => {
    const d = rInt(1, 2);
    const ent = di === 1 ? rInt(0, 9) : conDigitos(di);
    let dec = String(rInt(1, 10 ** d - 1)).padStart(d, '0');
    if (dec.endsWith('0')) dec = dec.slice(0, -1) + rInt(1, 9);
    return `${ent}.${dec}`;
};
const escalar = (s, dec) => { const [i, d = ''] = s.split('.'); return Number(i + d.padEnd(dec, '0')); };
const decimalesDe = (s) => (s.split('.')[1] || '').length;

// ¿Hay alguna llevada? (para que sumas y restas no salgan triviales)
const hayLlevada = (op, nums) => {
    const dec = Math.max(...nums.map(decimalesDe));
    const v = nums.map(n => escalar(n, dec));
    if (op === 'suma') {
        for (let p = 1; p <= 1e8; p *= 10) if (v.reduce((s, x) => s + (Math.floor(x / p) % 10), 0) >= 10) return true;
        return false;
    }
    for (let p = 1; p <= v[0]; p *= 10) if (Math.floor(v[0] / p) % 10 < Math.floor(v[1] / p) % 10) return true;
    return false;
};

export function generarColumna(op, nivel = 1, { decimales = false, exacta = false } = {}) {
    const n = Math.min(3, Math.max(1, nivel));
    for (let intento = 0; intento < 60; intento++) {
        let nums;
        if (op === 'suma') {
            const k = n === 3 ? rInt(2, 3) : 2;
            const dig = [[2, 2], [3, 4], [4, 5]][n - 1];
            nums = Array.from({ length: k }, () => (decimales ? decAleatorio(rInt(1, dig[0])) : String(conDigitos(rInt(dig[0], dig[1])))));
        } else if (op === 'resta') {
            const dig = [[2, 2], [3, 4], [4, 6]][n - 1];
            if (decimales) {
                const a = decAleatorio(rInt(2, dig[0])), b = decAleatorio(rInt(1, dig[0]));
                if (Number(a) <= Number(b)) continue;
                nums = [a, b];
            } else {
                const da = rInt(dig[0], dig[1]);
                const a = conDigitos(da), b = conDigitos(rInt(Math.max(1, da - 1), da));
                if (a <= b) continue;
                nums = [String(a), String(b)];
            }
        } else if (op === 'mult') {
            const a = conDigitos([rInt(2, 3), 3, rInt(3, 4)][n - 1]);
            const b = n === 1 ? rInt(2, 9) : sinCeros(n);
            nums = [String(a), String(b)];
        } else {
            const b = [rInt(2, 9), Math.random() < 0.5 ? rInt(2, 9) : rInt(11, 49), Math.random() < 0.5 ? rInt(12, 99) : rInt(101, 499)][n - 1];
            const da = [rInt(2, 3), rInt(3, 4), rInt(4, 5)][n - 1];
            let a;
            if (exacta) {
                const qMin = Math.max(2, Math.ceil(10 ** (da - 1) / b)), qMax = Math.floor((10 ** da - 1) / b);
                if (qMax < qMin) continue;
                a = b * rInt(qMin, qMax);
            } else {
                a = conDigitos(da);
                if (a % b === 0) continue;
            }
            if (a < b * 2) continue;
            nums = [String(a), String(b)];
        }
        if ((op === 'suma' || op === 'resta') && !hayLlevada(op, nums) && intento < 40) continue;
        return { op, nums };
    }
    return op === 'div' ? { op, nums: ['84', '4'] } : { op, nums: ['47', '25'] };
}

export const claveColumna = (d) => `${d.op}:${d.nums.join('|')}`;
export const textoColumna = (d) => d.nums.map(x => x.replace('.', ',')).join(` ${OPS_COLUMNA[d.op].signo} `);

// Resultado: número (suma, resta, mult) o { cociente, resto } (div)
export function resultadoColumna({ op, nums }) {
    if (op === 'div') { const a = Number(nums[0]), b = Number(nums[1]); return { cociente: Math.floor(a / b), resto: a % b }; }
    const dec = Math.max(...nums.map(decimalesDe));
    const v = nums.map(x => escalar(x, dec));
    const r = op === 'suma' ? v.reduce((s, x) => s + x, 0) : op === 'resta' ? v[0] - v[1] : v[0] * v[1];
    return Number((r / 10 ** dec).toFixed(dec));
}
export const textoResultadoColumna = (d) => {
    const r = resultadoColumna(d);
    if (d.op === 'div') return `cociente ${r.cociente} · resto ${r.resto}`;
    return String(r).replace('.', ',');
};

// ─── Rejilla ────────────────────────────────────────────────────────────────
//  { anchos[], altos[], celdas: [{ r, c, v, tipo, paso?, orden?, opc0?, mas? }], lineas: [{ h|v… }], pasos }
//  tipo: 'fijo' (se ve siempre) · 'input' (lo escribe el alumno; se corrige)
//        'llevada' (casilla pequeña: en la solución se muestra, al resolver es libre)
//  opc0: un 0 a la izquierda que se puede dejar en blanco.
export const claveCelda = (cel) => `${cel.r}-${cel.c}`;

function sumaResta({ op, nums }) {
    const dec = Math.max(...nums.map(decimalesDe));
    const partes = nums.map(s => { const [i, d = ''] = s.split('.'); return { i, d }; });
    const v = nums.map(s => escalar(s, dec));
    const res = op === 'suma' ? v.reduce((s, x) => s + x, 0) : v[0] - v[1];
    const resStr = String(res).padStart(dec + 1, '0');
    const res_ = { i: resStr.slice(0, resStr.length - dec), d: resStr.slice(resStr.length - dec) };
    const L = Math.max(res_.i.length, ...partes.map(p => p.i.length));
    // pos = exponente de la cifra (0 = unidades, −1 = décimas…)
    const col = (pos) => (pos >= 0 ? L - pos : L + 1 - pos);
    const anchos = [1, ...Array(L).fill(1), ...(dec ? [0.45, ...Array(dec).fill(1)] : [])];
    const celdas = [], lineas = [];
    const ponerNumero = (p, r, tipo, extra = () => ({})) => {
        [...p.i].forEach((ch, k) => { const pos = p.i.length - 1 - k; celdas.push({ r, c: col(pos), v: ch, tipo, ...extra(pos) }); });
        [...p.d].forEach((ch, k) => { const pos = -(k + 1); celdas.push({ r, c: col(pos), v: ch, tipo, ...extra(pos) }); });
        if (p.d.length) celdas.push({ r, c: L + 1, v: ',', tipo: 'fijo' });
    };
    // filas: suma → llevadas, sumandos…, resultado · resta → minuendo, llevadas (+1 al sustraendo), sustraendo, resultado
    const filasNum = op === 'suma' ? partes.map((_, k) => k + 1) : [0, 2];
    const filaLlev = op === 'suma' ? 0 : 1;
    const filaRes = filasNum[filasNum.length - 1] + 1;
    partes.forEach((p, k) => ponerNumero(p, filasNum[k], 'fijo'));
    celdas.push({ r: filasNum[filasNum.length - 1], c: 0, v: op === 'suma' ? '+' : '−', tipo: 'fijo' });
    // resultado: paso = columna empezando por la derecha
    const pasoDe = (pos) => pos + dec + 1;
    ponerNumero(res_, filaRes, 'input', (pos) => ({ paso: pasoDe(pos), orden: pasoDe(pos) }));
    // llevadas
    const maxLen = Math.max(...v.map(x => String(x).length));
    let llev = 0;
    for (let j = 0; j < maxLen; j++) {
        const p = 10 ** j;
        const dig = v.map(x => Math.floor(x / p) % 10);
        if (op === 'suma') llev = Math.floor((dig.reduce((s, x) => s + x, 0) + llev) / 10);
        else llev = dig[0] < dig[1] + llev ? 1 : 0;
        if (llev && j + 1 < maxLen && (op === 'suma' || j + 1 < String(v[0]).length)) {
            celdas.push({ r: filaLlev, c: col(j + 1 - dec), v: String(llev), tipo: 'llevada', paso: j + 1, mas: op === 'resta' });
        }
    }
    const nFilas = filaRes + 1;
    const altos = Array.from({ length: nFilas }, (_, r) => (r === filaLlev ? 0.62 : 1));
    lineas.push({ h: true, r: filaRes - 1, c0: 0, c1: anchos.length - 1 });
    return { anchos, altos, celdas, lineas, pasos: res_.i.length + dec };
}

function multiplicacion({ nums }) {
    const a = Number(nums[0]), B = nums[1], m = B.length;
    const parciales = [...B].reverse().map((d, i) => ({ v: String(a * Number(d)), i, d: Number(d) }));
    const res = String(a * Number(B));
    const W = Math.max(res.length, nums[0].length, m, ...parciales.map(p => p.v.length + p.i));
    const col = (pos) => W - pos;
    const anchos = Array(W + 1).fill(1);
    const celdas = [], lineas = [];
    const ponerFijo = (s, r) => [...s].forEach((ch, k) => celdas.push({ r, c: col(s.length - 1 - k), v: ch, tipo: 'fijo' }));
    ponerFijo(nums[0], 1);
    ponerFijo(B, 2);
    celdas.push({ r: 2, c: 0, v: '×', tipo: 'fijo' });
    lineas.push({ h: true, r: 2, c0: 0, c1: W });
    let r = 3, orden = 1;
    if (m > 1) {
        parciales.forEach((p) => {
            [...p.v].reverse().forEach((ch, k) => celdas.push({ r, c: col(k + p.i), v: ch, tipo: 'input', paso: p.i + 1, orden: orden++ }));
            r++;
        });
        lineas.push({ h: true, r: r - 1, c0: 0, c1: W });
        celdas.push({ r: r - 1, c: 0, v: '+', tipo: 'fijo', tenue: true });
    } else {
        // llevadas de multiplicar por una cifra
        let llev = 0;
        [...nums[0]].reverse().forEach((ch, j) => {
            llev = Math.floor((Number(ch) * Number(B) + llev) / 10);
            if (llev && j + 1 < nums[0].length) celdas.push({ r: 0, c: col(j + 1), v: String(llev), tipo: 'llevada', paso: 1 });
        });
    }
    [...res].reverse().forEach((ch, k) => celdas.push({ r, c: col(k), v: ch, tipo: 'input', paso: m > 1 ? m + 1 : 1, orden: orden++ }));
    const altos = Array.from({ length: r + 1 }, (_, k) => (k === 0 ? 0.62 : 1));
    return { anchos, altos, celdas, lineas, pasos: m > 1 ? m + 1 : 1 };
}

function division({ nums }) {
    const A = nums[0], b = Number(nums[1]), n = A.length;
    let s = 1;
    while (s < n && Number(A.slice(0, s)) < b) s++;
    const pasos = [];
    let cur = Number(A.slice(0, s));
    for (let idx = s - 1; idx < n; idx++) {
        const q = Math.floor(cur / b), r = cur - q * b;
        pasos.push({ q, r, idx });
        if (idx < n - 1) cur = r * 10 + Number(A[idx + 1]);
    }
    const coc = pasos.map(p => p.q).join('');
    const R = Math.max(nums[1].length, coc.length);
    const anchos = [...Array(n).fill(1), ...Array(R).fill(1)];
    const celdas = [], lineas = [];
    [...A].forEach((ch, c) => celdas.push({ r: 0, c, v: ch, tipo: 'fijo' }));
    [...nums[1]].forEach((ch, k) => celdas.push({ r: 0, c: n + k, v: ch, tipo: 'fijo' }));
    let orden = 1;
    pasos.forEach((p, i) => {
        const paso = i + 1;
        celdas.push({ r: 1, c: n + i, v: String(p.q), tipo: 'input', paso, orden: orden++ });
        const ultimo = i === pasos.length - 1;
        const texto = ultimo ? String(p.r) : (p.r === 0 ? '0' : String(p.r)) + A[p.idx + 1];
        const fin = ultimo ? n - 1 : p.idx + 1;
        [...texto].forEach((ch, k) => celdas.push({
            r: i + 1, c: fin - (texto.length - 1 - k), v: ch, tipo: 'input', paso, orden: orden++,
            ...(!ultimo && k === 0 && p.r === 0 ? { opc0: true } : {}),
        }));
    });
    // marca del primer dividendo parcial (las cifras que se cogen al empezar)
    if (s < n) lineas.push({ h: true, r: 0, c0: 0, c1: s - 1, tenue: true });
    lineas.push({ v: true, c: n, r0: 0, r1: 0 });
    lineas.push({ h: true, r: 0, c0: n, c1: n + R - 1 });
    const altos = Array(pasos.length + 1).fill(1);
    return { anchos, altos, celdas, lineas, pasos: pasos.length, primerParcial: s };
}

const cache = new Map();
export function construirColumna(datos) {
    const k = claveColumna(datos);
    if (!cache.has(k)) {
        const lay = datos.op === 'div' ? division(datos) : datos.op === 'mult' ? multiplicacion(datos) : sumaResta(datos);
        if (cache.size > 300) cache.clear();
        cache.set(k, lay);
    }
    return cache.get(k);
}

// Corrección casilla a casilla → { clave: 'ok' | 'mal' | 'vacio' } y si está todo bien
export function corregirColumna(lay, valores) {
    const estados = {};
    let todoBien = true;
    lay.celdas.filter(c => c.tipo === 'input').forEach(c => {
        const k = claveCelda(c), val = (valores[k] || '').trim();
        if (val === '' && c.opc0) { estados[k] = 'ok'; return; }
        if (val === '') { estados[k] = 'vacio'; todoBien = false; return; }
        const ok = val === c.v;
        estados[k] = ok ? 'ok' : 'mal';
        if (!ok) todoBien = false;
    });
    return { estados, todoBien };
}

// Explicación breve del método para cada operación
export const COMO_SE_HACE = {
    suma: ['Coloca los números alineados por la derecha: unidades bajo unidades, decenas bajo decenas… (con decimales, coma bajo coma).',
        'Empieza por la columna de la derecha y suma sus cifras.',
        'Si da 10 o más, escribe las unidades y llévate las decenas a la columna siguiente (casilla pequeña de arriba).'],
    resta: ['Coloca el minuendo arriba y el sustraendo debajo, alineados por la derecha (con decimales, coma bajo coma).',
        'Empieza por la derecha: resta la cifra de abajo a la de arriba.',
        'Si la de arriba es menor, súmale 10 y llévate 1, que se suma a la cifra de abajo de la columna siguiente (+1).'],
    mult: ['Multiplica el número de arriba por cada cifra del de abajo, empezando por las unidades y de derecha a izquierda, llevando cuando haga falta.',
        'Cada producto parcial se escribe un lugar más a la izquierda que el anterior.',
        'Al final suma los productos parciales.'],
    div: ['Coge las primeras cifras del dividendo hasta formar un número igual o mayor que el divisor.',
        'Busca cuántas veces cabe el divisor (cifra del cociente), multiplica y réstalo mentalmente: escribe el resto debajo.',
        'Baja la cifra siguiente al lado del resto y repite. Lo que queda al final es el resto. Comprueba: D = d × c + r.'],
};
