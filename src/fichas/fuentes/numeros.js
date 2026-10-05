// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de NÚMEROS para las fichas de Math World:
//  potencias y raíces · divisibilidad · números (Primaria)
// ─────────────────────────────────────────────────────────────────────────────
import { R, pick, N, P, mcd, mcm, sup } from '../fuenteTexto';

const noCero = (a, b) => { let v; do { v = R(a, b); } while (v === 0); return v; };

// ═════════════════════════════════════════════════════════════════════════════
//  POTENCIAS Y RAÍCES
// ═════════════════════════════════════════════════════════════════════════════
const potTxt = (b, e) => `${b < 0 ? `(${N(b)})` : b}${sup(e)}`;
export const POTENCIAS = {
    id: 'potencias', nombre: 'Potencias y raíces', emoji: '🔺', color: '#d35400', etapas: ['primaria', 'eso'],
    desc: 'Calcular potencias, propiedades, notación científica, raíces y radicales',
    tipos: {
        calcular: {
            label: 'Calcular potencias', titulo: 'Calcula las siguientes potencias.', cols: 3, alto: 40,
            gen: (nv) => {
                const b = nv === 1 ? R(2, 10) : noCero(-6, 10), e = nv === 1 ? R(2, 3) : R(0, 4);
                const v = Math.pow(b, e);
                return { e: `${potTxt(b, e)} =`, s: N(v), r: [{ tipo: 'num', v }],
                    pasos: [e === 0 ? 'Todo número (≠ 0) elevado a 0 es 1' : `${Array(e).fill(P(b)).join(' · ')} = ${N(v)}`] };
            },
        },
        propiedades: {
            label: 'Propiedades', titulo: 'Expresa como una sola potencia.', cols: 3, alto: 45,
            gen: () => {
                const b = R(2, 9), m = R(2, 8), n = R(2, 6), t = R(0, 2);
                if (t === 0) return { e: `${b}${sup(m)} · ${b}${sup(n)} =`, s: `${b}${sup(m + n)}`, r: [{ tipo: 'texto', v: `${b}^${m + n}`, placeholder: `${b}^…` }], pasos: ['Misma base: se suman los exponentes'] };
                if (t === 1) { const mm = m + n; return { e: `${b}${sup(mm)} : ${b}${sup(n)} =`, s: `${b}${sup(m)}`, r: [{ tipo: 'texto', v: `${b}^${m}`, placeholder: `${b}^…` }], pasos: ['Misma base: se restan los exponentes'] }; }
                return { e: `(${b}${sup(m)})${sup(n)} =`, s: `${b}${sup(m * n)}`, r: [{ tipo: 'texto', v: `${b}^${m * n}`, placeholder: `${b}^…` }], pasos: ['Potencia de una potencia: se multiplican los exponentes'] };
            },
        },
        cientifica: {
            label: 'Notación científica', titulo: 'Escribe en notación científica.', cols: 2, alto: 45, niveles: false,
            gen: () => {
                const cifras = R(11, 99) / 10, grande = Math.random() < 0.6, e = grande ? R(3, 9) : -R(2, 6);
                const num = cifras * Math.pow(10, e);
                const escrito = grande ? Math.round(num).toLocaleString('es-ES') : num.toFixed(-e + 1).replace('.', ',');
                return { e: `${escrito} =`, s: `${N(cifras)} · 10${sup(e)}`,
                    r: [{ tipo: 'texto', v: [`${N(cifras)}·10^${e}`, `${String(cifras)}·10^${e}`], placeholder: '4,5·10^7' }],
                    pasos: [`Coloca la coma detrás de la primera cifra: ${N(cifras)}`, `${grande ? 'Se ha movido' : 'Se ha movido'} la coma ${Math.abs(e)} lugares → 10${sup(e)}`] };
            },
        },
        raices: {
            label: 'Raíces exactas', titulo: 'Calcula las siguientes raíces.', cols: 3, alto: 40,
            gen: (nv) => {
                if (nv === 3 && Math.random() < 0.5) { const r = R(2, 6); return { e: `∛${r ** 3} =`, s: N(r), r: [{ tipo: 'num', v: r }], pasos: [`${r}³ = ${r ** 3}`] }; }
                const r = nv === 1 ? R(2, 10) : R(4, 20);
                return { e: `√${r * r} =`, s: N(r), r: [{ tipo: 'num', v: r }], pasos: [`${r}² = ${r * r}`] };
            },
        },
        extraer: {
            label: 'Extraer factores', titulo: 'Extrae factores del radical.', cols: 3, alto: 45, niveles: false,
            gen: () => {
                const a = R(2, 6), b = pick([2, 3, 5, 6, 7, 10]);
                return { e: `√${a * a * b} =`, s: `${a}√${b}`, r: [{ tipo: 'texto', v: [`${a}√${b}`], placeholder: `…√…` }], pasos: [`${a * a * b} = ${a}² · ${b}`, `√(${a}² · ${b}) = ${a}√${b}`] };
            },
        },
        sumaRadicales: {
            label: 'Sumar radicales', titulo: 'Opera los radicales semejantes.', cols: 2, alto: 45, niveles: false,
            gen: () => {
                const b = pick([2, 3, 5, 7]), a = R(1, 9), c = R(1, 9), d = R(1, 9), k = a + c - d;
                if (k === 0) return null;
                return { e: `${a}√${b} + ${c}√${b} − ${d}√${b} =`, s: `${N(k)}√${b}`, r: [{ tipo: 'texto', v: [`${k}√${b}`], placeholder: '…√…' }], pasos: [`Son semejantes: ${a} + ${c} − ${d} = ${N(k)}`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  DIVISIBILIDAD
// ═════════════════════════════════════════════════════════════════════════════
const factoriza = (n) => { const f = {}; let d = 2; while (n > 1) { while (n % d === 0) { f[d] = (f[d] || 0) + 1; n /= d; } d++; } return f; };
const factTxt = (n) => Object.entries(factoriza(n)).map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : p)).join(' · ');
const esPrimo = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const divisores = (n) => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };

export const DIVISIBILIDAD = {
    id: 'divisibilidad', nombre: 'Divisibilidad', emoji: '🧩', color: '#27ae60', etapas: ['primaria', 'eso'],
    desc: 'Múltiplos, divisores, primos, descomposición, m.c.d. y m.c.m.',
    tipos: {
        multiplos: {
            label: 'Múltiplos', titulo: 'Escribe los cinco primeros múltiplos (sin contar el 0).', cols: 2, alto: 45,
            gen: (nv) => { const n = nv === 1 ? R(2, 10) : R(6, 25); return { e: `Múltiplos de ${n}:`, s: [1, 2, 3, 4, 5].map(k => k * n).join(', '), pasos: [`${n} · 1, ${n} · 2, ${n} · 3…`] }; },
        },
        divisores: {
            label: 'Divisores', titulo: 'Escribe todos los divisores de cada número.', cols: 2, alto: 50,
            gen: (nv) => { const n = pick(nv === 1 ? [6, 8, 10, 12, 15, 16, 18, 20] : [24, 28, 30, 36, 40, 42, 45, 48, 60, 72]); const d = divisores(n); return { e: `Divisores de ${n}:`, s: d.join(', '), r: [{ etiqueta: '¿Cuántos divisores tiene?', tipo: 'num', v: d.length }], pasos: [`Busca parejas que multiplicadas den ${n}`] }; },
        },
        primos: {
            label: '¿Primo o compuesto?', titulo: 'Indica si cada número es primo o compuesto.', cols: 3, alto: 35,
            gen: (nv) => {
                const n = R(nv === 1 ? 2 : 20, nv === 1 ? 40 : 120), p = esPrimo(n);
                const div = p ? null : divisores(n).find(d => d > 1);
                return { e: `${n}`, s: p ? 'Primo' : 'Compuesto', r: [{ tipo: 'opcion', v: p ? 'Primo' : 'Compuesto', opciones: ['Primo', 'Compuesto'] }],
                    pasos: [p ? `Solo es divisible entre 1 y ${n}` : `Es divisible entre ${div}: ${n} = ${div} · ${n / div}`] };
            },
        },
        factorizar: {
            label: 'Descomposición factorial', titulo: 'Descompón en factores primos.', cols: 3, alto: 90,
            gen: (nv) => {
                let n; do { n = nv === 1 ? R(12, 100) : R(60, 600); } while (esPrimo(n));
                return { e: `${n} =`, s: factTxt(n), r: [{ tipo: 'texto', v: [factTxt(n), factTxt(n).replace(/ · /g, '·')], placeholder: '2^3 · 3' }], pasos: ['Divide entre 2, 3, 5, 7… hasta llegar a 1'] };
            },
        },
        mcdMcm: {
            label: 'm.c.d. y m.c.m.', titulo: 'Calcula el m.c.d. y el m.c.m.', cols: 2, alto: 100,
            gen: (nv) => {
                const g = R(2, nv === 1 ? 6 : 12), a = g * R(2, 9), b = g * R(2, 9);
                if (a === b) return null;
                const d = mcd(a, b), m = mcm(a, b);
                return { e: `${a} y ${b}`, s: `m.c.d. = ${d},  m.c.m. = ${m}`,
                    r: [{ etiqueta: 'm.c.d. =', tipo: 'num', v: d }, { etiqueta: 'm.c.m. =', tipo: 'num', v: m }],
                    pasos: [`${a} = ${factTxt(a)}`, `${b} = ${factTxt(b)}`, 'm.c.d.: factores comunes con el menor exponente · m.c.m.: comunes y no comunes con el mayor'] };
            },
        },
        problemas: {
            label: '📖 Problemas', titulo: 'Resuelve los siguientes problemas.', cols: 1, alto: 150, max: 8, niveles: false,
            gen: () => {
                const t = R(0, 2);
                if (t === 0) {
                    const a = pick([10, 12, 15, 20]), b = pick([8, 18, 24, 30].filter(x => x !== a)), m = mcm(a, b);
                    return { largo: true, e: `Un autobús pasa por una parada cada ${a} minutos y otro cada ${b} minutos. Si acaban de coincidir, ¿dentro de cuántos minutos volverán a coincidir?`, s: `Dentro de ${m} minutos (m.c.m.)`, r: [{ tipo: 'num', v: m, unidad: 'min' }], pasos: [`m.c.m.(${a}, ${b}) = ${m}`] };
                }
                if (t === 1) {
                    const g = pick([4, 5, 6, 8, 10, 12]), a = g * R(3, 8), b = g * R(3, 8);
                    if (a === b) return null;
                    const d = mcd(a, b);
                    return { largo: true, e: `Tenemos dos cuerdas de ${a} m y ${b} m. Queremos cortarlas en trozos iguales lo más largos posible, sin que sobre nada. ¿Cuánto medirá cada trozo? ¿Cuántos trozos saldrán?`, s: `${d} m cada trozo, ${a / d + b / d} trozos (m.c.d.)`, r: [{ etiqueta: 'Longitud de cada trozo:', tipo: 'num', v: d, unidad: 'm' }, { etiqueta: 'Número de trozos:', tipo: 'num', v: a / d + b / d }], pasos: [`m.c.d.(${a}, ${b}) = ${d}`, `${a} : ${d} + ${b} : ${d} = ${a / d + b / d}`] };
                }
                const a = pick([2, 3, 4]), b = pick([5, 6]), c = pick([8, 10, 12]), m = mcm(mcm(a, b), c);
                return { largo: true, e: `Tres faros se encienden cada ${a}, ${b} y ${c} segundos. Si se encienden a la vez, ¿cuántos segundos pasarán hasta que vuelvan a coincidir?`, s: `${m} segundos (m.c.m.)`, r: [{ tipo: 'num', v: m, unidad: 's' }], pasos: [`m.c.m.(${a}, ${b}, ${c}) = ${m}`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  NÚMEROS (Primaria)
// ═════════════════════════════════════════════════════════════════════════════
const ROMANOS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const aRomano = (n) => { let s = ''; for (const [v, l] of ROMANOS) while (n >= v) { s += l; n -= v; } return s; };
const miles = (n) => n.toLocaleString('es-ES');
const NOMBRES_ORDEN = ['unidades', 'decenas', 'centenas', 'unidades de millar', 'decenas de millar', 'centenas de millar', 'unidades de millón'];

export const NUMEROS = {
    id: 'numeros', nombre: 'Números', emoji: '🔢', color: '#2c3e50', etapas: ['primaria'],
    desc: 'Valor posicional, descomposición, redondeo, comparar y números romanos',
    tipos: {
        valorPosicional: {
            label: 'Valor posicional', titulo: '¿Cuánto vale la cifra destacada?', cols: 2, alto: 40,
            gen: (nv) => {
                const n = R(nv === 1 ? 100 : 10000, nv === 1 ? 9999 : nv === 2 ? 99999 : 9999999);
                const s = String(n), i = R(0, s.length - 2), cifra = Number(s[i]);
                if (!cifra) return null;
                const orden = s.length - 1 - i, valor = cifra * Math.pow(10, orden);
                return { e: `En ${miles(n)}, la cifra ${cifra} (posición de las ${NOMBRES_ORDEN[orden]})`, s: `Vale ${miles(valor)}`, r: [{ tipo: 'num', v: valor }], pasos: [`${cifra} ${NOMBRES_ORDEN[orden]} = ${miles(valor)}`] };
            },
        },
        descomponer: {
            label: 'Descomponer', titulo: 'Descompón los siguientes números.', cols: 2, alto: 50,
            gen: (nv) => {
                const n = R(nv === 1 ? 100 : 1000, nv === 1 ? 999 : nv === 2 ? 9999 : 99999);
                const partes = String(n).split('').map((c, i, a) => Number(c) * Math.pow(10, a.length - 1 - i)).filter(Boolean);
                return { e: `${miles(n)} =`, s: partes.map(miles).join(' + '), pasos: [`Cada cifra por el valor de su posición`] };
            },
        },
        redondear: {
            label: 'Redondear', titulo: 'Redondea cada número.', cols: 2, alto: 40,
            gen: (nv) => {
                const [nombre, pot] = pick(nv === 1 ? [['decena', 10], ['centena', 100]] : [['decena', 10], ['centena', 100], ['millar', 1000]]);
                const n = R(pot + 1, pot * 100 - 1), r = Math.round(n / pot) * pot;
                return { e: `${miles(n)} a la ${nombre}`, s: miles(r), r: [{ tipo: 'num', v: r }], pasos: [`Mira la cifra de la derecha de las ${nombre}s: si es 5 o más, se sube`] };
            },
        },
        comparar: {
            label: 'Comparar', titulo: 'Escribe >, < o =.', cols: 3, alto: 35,
            gen: (nv) => {
                const decimal = nv > 1 && Math.random() < 0.5;
                const a = decimal ? R(100, 999) / 100 : R(100, nv === 1 ? 999 : 99999);
                const b = Math.random() < 0.15 ? a : decimal ? R(100, 999) / 100 : a + R(-50, 50);
                const sig = a > b ? '>' : a < b ? '<' : '=';
                const f = (x) => (decimal ? N(x) : miles(x));
                return { e: `${f(a)}  ___  ${f(b)}`, s: `${f(a)} ${sig} ${f(b)}`, r: [{ tipo: 'opcion', v: sig, opciones: ['<', '=', '>'] }], pasos: ['Compara cifra a cifra empezando por la izquierda'] };
            },
        },
        romanos: {
            label: 'Números romanos', titulo: 'Escribe en números romanos o en cifras.', cols: 3, alto: 35,
            gen: (nv) => {
                const n = R(1, nv === 1 ? 50 : nv === 2 ? 500 : 3999), r = aRomano(n);
                return Math.random() < 0.5
                    ? { e: `${n} =`, s: r, r: [{ tipo: 'texto', v: r, placeholder: 'XIV' }], pasos: ['I=1, V=5, X=10, L=50, C=100, D=500, M=1000'] }
                    : { e: `${r} =`, s: String(n), r: [{ tipo: 'num', v: n }], pasos: ['I=1, V=5, X=10, L=50, C=100, D=500, M=1000'] };
            },
        },
    },
};
