// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de ÁLGEBRA para las fichas de Math World:
//  ecuaciones · sistemas · polinomios · funciones
//  Cada gen(nivel) devuelve { e, s, pasos, r, largo? } (ver fuenteTexto.jsx)
// ─────────────────────────────────────────────────────────────────────────────
import { R, pick, N, P, frac, termino, polinomio, mcm } from '../fuenteTexto';

const noCero = (a, b) => { let v; do { v = R(a, b); } while (v === 0); return v; };
// «ax + b» (b puede ser 0 o negativo)
const lin = (a, b, x = 'x') => `${termino(a, x, true)}${b ? (b < 0 ? ' − ' : ' + ') + Math.abs(b) : ''}` || '0';
const solX = (x) => [{ etiqueta: 'x =', tipo: 'frac', v: x, placeholder: 'x' }];

// ═════════════════════════════════════════════════════════════════════════════
//  ECUACIONES
// ═════════════════════════════════════════════════════════════════════════════
export const ECUACIONES = {
    id: 'ecuaciones', nombre: 'Ecuaciones', emoji: '⚖️', color: '#2980b9', etapas: ['eso'],
    desc: 'Primer grado, con paréntesis, con denominadores, segundo grado y problemas',
    tipos: {
        primerGrado: {
            label: '1.er grado', titulo: 'Resuelve las siguientes ecuaciones.', cols: 2, alto: 100,
            gen: (nv) => {
                const x = R(-6, 9);
                if (nv === 1) {
                    const a = R(2, 9), b = noCero(-15, 15);
                    const c = a * x + b;
                    return { e: `${lin(a, b)} = ${N(c)}`, s: `x = ${N(x)}`, r: solX(x),
                        pasos: [`${termino(a, 'x', true)} = ${N(c)} ${b < 0 ? '+' : '−'} ${Math.abs(b)}`, `${termino(a, 'x', true)} = ${N(c - b)}`, `x = ${N(c - b)} : ${a}`] };
                }
                let a, c; do { a = noCero(-7, 9); c = noCero(-7, 9); } while (a === c);
                const b = R(-20, 20), d = a * x + b - c * x;
                return { e: `${lin(a, b)} = ${lin(c, d)}`, s: `x = ${N(x)}`, r: solX(x),
                    pasos: [`${termino(a, 'x', true)}${termino(-c, 'x')} = ${N(d)}${b ? (b > 0 ? ' − ' : ' + ') + Math.abs(b) : ''}`, `${termino(a - c, 'x', true)} = ${N(d - b)}`, `x = ${N(d - b)} : ${P(a - c)}`] };
            },
        },
        parentesis: {
            label: 'Con paréntesis', titulo: 'Resuelve las siguientes ecuaciones con paréntesis.', cols: 2, alto: 120,
            gen: (nv) => {
                const x = R(-5, 8), a = noCero(-5, 6), b = noCero(-8, 8);
                if (nv === 1) {
                    const c = a * (x + b);
                    return { e: `${a === 1 ? '' : a === -1 ? '−' : a}(x ${b < 0 ? '−' : '+'} ${Math.abs(b)}) = ${N(c)}`, s: `x = ${N(x)}`, r: solX(x),
                        pasos: [`${lin(a, a * b)} = ${N(c)}`, `${termino(a, 'x', true)} = ${N(c - a * b)}`, `x = ${N(c - a * b)} : ${P(a)}`] };
                }
                let c, d; do { c = noCero(-4, 5); d = noCero(-6, 6); } while (a === c);
                const k = R(-10, 10);
                // a(x + b) + k = c(x + d) + m  →  m sale de la solución
                const m = a * (x + b) + k - c * (x + d);
                const izq = `${a === 1 ? '' : a === -1 ? '−' : a}(x ${b < 0 ? '−' : '+'} ${Math.abs(b)})${k ? (k < 0 ? ' − ' : ' + ') + Math.abs(k) : ''}`;
                const der = `${c === 1 ? '' : c === -1 ? '−' : c}(x ${d < 0 ? '−' : '+'} ${Math.abs(d)})${m ? (m < 0 ? ' − ' : ' + ') + Math.abs(m) : ''}`;
                return { e: `${izq} = ${der}`, s: `x = ${N(x)}`, r: solX(x),
                    pasos: [`${lin(a, a * b + k)} = ${lin(c, c * d + m)}`, `${termino(a - c, 'x', true)} = ${N(c * d + m - a * b - k)}`, `x = ${N(c * d + m - a * b - k)} : ${P(a - c)}`] };
            },
        },
        denominadores: {
            label: 'Con denominadores', titulo: 'Resuelve las siguientes ecuaciones con denominadores.', cols: 2, alto: 130,
            gen: (nv) => {
                if (nv === 1) {
                    const a = pick([2, 3, 4, 5]), x = a * R(-4, 6), b = R(-6, 9), c = x / a + b;
                    return { e: `x/${a} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${N(c)}`, s: `x = ${N(x)}`, r: solX(x),
                        pasos: [`x/${a} = ${N(c - b)}`, `x = ${N(c - b)} · ${a}`] };
                }
                const a = pick([2, 3, 4, 6]), b = pick([2, 3, 4, 5, 6].filter(v => v !== a));
                const m = mcm(a, b), x = m * R(-3, 4) || m;
                const c = x / a + x / b;
                return { e: `x/${a} + x/${b} = ${N(c)}`, s: `x = ${N(x)}`, r: solX(x),
                    pasos: [`m.c.m.(${a}, ${b}) = ${m}`, `${m / a}x + ${m / b}x = ${N(c * m)}`, `${(m / a) + (m / b)}x = ${N(c * m)}`, `x = ${N(c * m)} : ${(m / a) + (m / b)}`] };
            },
        },
        segundoGrado: {
            label: '2.º grado', titulo: 'Resuelve las siguientes ecuaciones de segundo grado.', cols: 2, alto: 130,
            gen: (nv) => {
                if (nv === 1) {
                    if (Math.random() < 0.5) {
                        const a = R(1, 4), r = R(1, 8), c = a * r * r;
                        return { e: `${termino(a, 'x²', true)} = ${c}`, s: `x = ${r}  y  x = −${r}`,
                            r: [{ etiqueta: 'Solución positiva: x =', tipo: 'num', v: r }],
                            pasos: [`x² = ${c} : ${a} = ${r * r}`, `x = ±√${r * r} = ±${r}`] };
                    }
                    const a = R(1, 4), r = noCero(-7, 7);
                    return { e: `${termino(a, 'x²', true)}${termino(-a * r, 'x')} = 0`, s: `x = 0  y  x = ${N(r)}`,
                        r: [{ etiqueta: 'La solución distinta de 0: x =', tipo: 'num', v: r }],
                        pasos: [`x(${lin(a, -a * r)}) = 0`, `x = 0  o  ${lin(a, -a * r)} = 0 → x = ${N(r)}`] };
                }
                let r1, r2; do { r1 = R(-6, 7); r2 = R(-6, 7); } while (r1 === r2);
                const a = nv === 3 ? pick([1, 2, 3]) : 1;
                const b = -a * (r1 + r2), c = a * r1 * r2, disc = b * b - 4 * a * c;
                return { e: `${polinomio([a, b, c])} = 0`, s: `x₁ = ${N(Math.max(r1, r2))},  x₂ = ${N(Math.min(r1, r2))}`,
                    r: [{ etiqueta: 'Solución mayor: x₁ =', tipo: 'num', v: Math.max(r1, r2) }, { etiqueta: 'Solución menor: x₂ =', tipo: 'num', v: Math.min(r1, r2) }],
                    pasos: [`a = ${a}, b = ${N(b)}, c = ${N(c)}`, `Δ = b² − 4ac = ${N(b * b)} − ${P(4 * a * c)} = ${disc}`, `x = (${N(-b)} ± √${disc}) / ${2 * a} = (${N(-b)} ± ${Math.sqrt(disc)}) / ${2 * a}`] };
            },
        },
        problemas: {
            label: '📖 Problemas', titulo: 'Plantea una ecuación y resuelve los siguientes problemas.', cols: 1, alto: 170, max: 8,
            gen: () => {
                const t = R(0, 4);
                if (t === 0) {
                    const k = pick([2, 3, 4, 5]), b = R(2, 15), x = R(3, 20), c = k * x + b;
                    return { largo: true, e: `Si al ${['', '', 'doble', 'triple', 'cuádruple', 'quíntuple'][k]} de un número le sumamos ${b}, obtenemos ${c}. ¿Qué número es?`,
                        s: `El número es ${x}`, r: [{ tipo: 'num', v: x }], pasos: [`${k}x + ${b} = ${c}`, `${k}x = ${c - b}`, `x = ${x}`] };
                }
                if (t === 1) {
                    const n = R(5, 40), s = 3 * n + 3;
                    return { largo: true, e: `La suma de tres números consecutivos es ${s}. ¿Cuáles son?`, s: `${n}, ${n + 1} y ${n + 2}`,
                        r: [{ etiqueta: 'El menor:', tipo: 'num', v: n }], pasos: [`x + (x + 1) + (x + 2) = ${s}`, `3x + 3 = ${s}`, `x = ${n}`] };
                }
                if (t === 2) {
                    const h = R(6, 14), k = pick([3, 4]), p = h * k;
                    return { largo: true, e: `Un padre tiene ${p} años y su hijo ${h}. ¿Dentro de cuántos años la edad del padre será el doble de la del hijo?`,
                        s: `Dentro de ${p - 2 * h} años`, r: [{ tipo: 'num', v: p - 2 * h, unidad: 'años' }],
                        pasos: [`${p} + x = 2(${h} + x)`, `${p} + x = ${2 * h} + 2x`, `x = ${p - 2 * h}`] };
                }
                if (t === 3) {
                    const a = R(3, 15), l = a + R(2, 10), per = 2 * (a + l);
                    return { largo: true, e: `El largo de un rectángulo mide ${l - a} cm más que el ancho y su perímetro es ${per} cm. ¿Cuánto mide el ancho?`,
                        s: `Ancho = ${a} cm, largo = ${l} cm`, r: [{ etiqueta: 'Ancho:', tipo: 'num', v: a, unidad: 'cm' }],
                        pasos: [`2x + 2(x + ${l - a}) = ${per}`, `4x + ${2 * (l - a)} = ${per}`, `x = ${a}`] };
                }
                const x = R(4, 30), y = R(2, 10), tot = x + (x + y) * 2;
                return { largo: true, e: `Ana tiene x cromos, Luis tiene ${y} más que Ana y Marta el doble que Luis. Entre los tres tienen ${tot + x + y}. ¿Cuántos cromos tiene Ana?`,
                    s: `Ana tiene ${x} cromos`, r: [{ tipo: 'num', v: x }],
                    pasos: [`x + (x + ${y}) + 2(x + ${y}) = ${tot + x + y}`, `4x + ${3 * y} = ${tot + x + y}`, `x = ${x}`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  SISTEMAS DE ECUACIONES
// ═════════════════════════════════════════════════════════════════════════════
const ecu = (a, b, c) => `${termino(a, 'x', true)}${termino(b, 'y')} = ${N(c)}`;
export const SISTEMAS = {
    id: 'sistemas', nombre: 'Sistemas de ecuaciones', emoji: '🔗', color: '#16a085', etapas: ['eso'],
    desc: 'Sistemas 2×2 por cualquier método y problemas de sistemas',
    tipos: {
        sistema2x2: {
            label: 'Sistemas 2×2', titulo: 'Resuelve los siguientes sistemas por el método que prefieras.', cols: 2, alto: 170,
            gen: (nv) => {
                const x = R(-5, 8), y = R(-5, 8);
                let a, b, c, d;
                do {
                    a = nv === 1 ? pick([1, 1, 2, 3]) : noCero(-6, 6); b = nv === 1 ? pick([1, -1, 2]) : noCero(-6, 6);
                    c = nv === 1 ? pick([1, 2, -1]) : noCero(-6, 6); d = nv === 1 ? pick([1, -1, -2, 3]) : noCero(-6, 6);
                } while (a * d - b * c === 0);
                const e = a * x + b * y, f = c * x + d * y, det = a * d - b * c;
                return { e: `${ecu(a, b, e)}\n${ecu(c, d, f)}`, s: `x = ${N(x)},  y = ${N(y)}`,
                    r: [{ etiqueta: 'x =', tipo: 'num', v: x }, { etiqueta: 'y =', tipo: 'num', v: y }],
                    pasos: [`Reducción: multiplica la 1.ª por ${P(d)} y la 2.ª por ${P(b)} y resta`, `(${N(a * d)} − ${P(b * c)})x = ${N(e * d)} − ${P(b * f)} → ${det}x = ${N(e * d - b * f)} → x = ${N(x)}`, `Sustituye x = ${N(x)} en la 1.ª: ${N(a * x)}${termino(b, 'y')} = ${N(e)} → y = ${N(y)}`] };
            },
        },
        problemas: {
            label: '📖 Problemas', titulo: 'Plantea un sistema y resuelve los siguientes problemas.', cols: 1, alto: 180, max: 8,
            gen: () => {
                const t = R(0, 3);
                if (t === 0) {
                    const g = R(5, 30), c = R(4, 25);
                    return { largo: true, e: `En una granja hay gallinas y conejos. En total hay ${g + c} cabezas y ${2 * g + 4 * c} patas. ¿Cuántas gallinas y cuántos conejos hay?`,
                        s: `${g} gallinas y ${c} conejos`, r: [{ etiqueta: 'Gallinas:', tipo: 'num', v: g }, { etiqueta: 'Conejos:', tipo: 'num', v: c }],
                        pasos: [`x + y = ${g + c}`, `2x + 4y = ${2 * g + 4 * c}`, `x = ${g}, y = ${c}`] };
                }
                if (t === 1) {
                    const pc = R(12, 25) / 10, pb = R(30, 60) / 10, a = R(2, 4), b = R(1, 3), c = R(1, 3), d = R(2, 4);
                    if (a * d === b * c) return null;
                    return { largo: true, e: `${a} cafés y ${b} bocadillos cuestan ${N(a * pc + b * pb)} €; ${c} cafés y ${d} bocadillos cuestan ${N(c * pc + d * pb)} €. ¿Cuánto cuesta un café? ¿Y un bocadillo?`,
                        s: `Café: ${N(pc)} €, bocadillo: ${N(pb)} €`, r: [{ etiqueta: 'Café:', tipo: 'num', v: pc, unidad: '€' }, { etiqueta: 'Bocadillo:', tipo: 'num', v: pb, unidad: '€' }],
                        pasos: [`${a}x + ${b}y = ${N(a * pc + b * pb)}`, `${c}x + ${d}y = ${N(c * pc + d * pb)}`, `x = ${N(pc)}, y = ${N(pb)}`] };
                }
                if (t === 2) {
                    const x = R(20, 80), y = R(5, x - 1);
                    return { largo: true, e: `La suma de dos números es ${x + y} y su diferencia es ${x - y}. ¿Qué números son?`, s: `${x} y ${y}`,
                        r: [{ etiqueta: 'El mayor:', tipo: 'num', v: x }, { etiqueta: 'El menor:', tipo: 'num', v: y }], pasos: [`x + y = ${x + y}`, `x − y = ${x - y}`, `2x = ${2 * x} → x = ${x}, y = ${y}`] };
                }
                const h = R(5, 15), k = pick([2, 3, 4]), p = h * k;
                return { largo: true, e: `La edad de una madre es ${k === 2 ? 'el doble' : k === 3 ? 'el triple' : 'el cuádruple'} que la de su hijo y entre los dos suman ${p + h} años. ¿Qué edad tiene cada uno?`,
                    s: `Madre: ${p} años, hijo: ${h} años`, r: [{ etiqueta: 'Hijo:', tipo: 'num', v: h, unidad: 'años' }, { etiqueta: 'Madre:', tipo: 'num', v: p, unidad: 'años' }],
                    pasos: [`x = ${k}y`, `x + y = ${p + h}`, `${k + 1}y = ${p + h} → y = ${h}, x = ${p}`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  POLINOMIOS
// ═════════════════════════════════════════════════════════════════════════════
const coefs = (grado, lim = 6) => { const c = [noCero(-lim, lim)]; for (let i = 0; i < grado; i++) c.push(R(-lim, lim)); return c; };
const evalP = (c, x) => c.reduce((s, a) => s * x + a, 0);
const sumaC = (p, q) => { const n = Math.max(p.length, q.length); const P2 = Array(n - p.length).fill(0).concat(p), Q2 = Array(n - q.length).fill(0).concat(q); const r = P2.map((v, i) => v + Q2[i]); while (r.length > 1 && r[0] === 0) r.shift(); return r; };
const mulC = (p, q) => { const r = Array(p.length + q.length - 1).fill(0); p.forEach((a, i) => q.forEach((b, j) => { r[i + j] += a * b; })); return r; };
const pol = (c) => `${polinomio(c)}`;
const resPol = (c) => [{ tipo: 'texto', v: [polinomio(c)], placeholder: 'p. ej. 3x^2 − 2x + 1' }];

export const POLINOMIOS = {
    id: 'polinomios', nombre: 'Polinomios', emoji: '🔣', color: '#8e44ad', etapas: ['eso'],
    desc: 'Valor numérico, operaciones, identidades notables y factor común',
    tipos: {
        valorNumerico: {
            label: 'Valor numérico', titulo: 'Calcula el valor numérico de cada polinomio.', cols: 2, alto: 80,
            gen: (nv) => {
                const c = coefs(nv === 1 ? 1 : nv === 2 ? 2 : 3, 5), x = noCero(-3, 3), v = evalP(c, x);
                return { e: `P(x) = ${pol(c)}\nP(${N(x)}) =`, s: `P(${N(x)}) = ${N(v)}`, r: [{ tipo: 'num', v }],
                    pasos: [`Sustituye x por ${P(x)}: ${pol(c).replace(/x/g, P(x))}`] };
            },
        },
        sumaResta: {
            label: 'Suma y resta', titulo: 'Calcula y simplifica.', cols: 1, alto: 80,
            gen: (nv) => {
                const p = coefs(nv + 1), q = coefs(R(1, nv + 1)), resta = Math.random() < 0.5;
                const r = sumaC(p, resta ? q.map(v => -v) : q);
                return { e: `(${pol(p)}) ${resta ? '−' : '+'} (${pol(q)}) =`, s: pol(r), r: resPol(r),
                    pasos: [resta ? `Cambia el signo de los términos de la 2.ª: ${pol(q.map(v => -v))}` : 'Agrupa los términos semejantes', `Suma término a término`] };
            },
        },
        producto: {
            label: 'Multiplicación', titulo: 'Multiplica y simplifica.', cols: 1, alto: 90,
            gen: (nv) => {
                if (nv === 1) {
                    const k = noCero(-5, 5), g = R(1, 2), mono = [k, ...Array(g).fill(0)], p = coefs(R(1, 2), 5);
                    const r = mulC(mono, p);
                    return { e: `${pol(mono)} · (${pol(p)}) =`, s: pol(r), r: resPol(r), pasos: ['Multiplica el monomio por cada término (propiedad distributiva)'] };
                }
                const p = coefs(1, 5), q = coefs(nv === 2 ? 1 : 2, 5), r = mulC(p, q);
                return { e: `(${pol(p)}) · (${pol(q)}) =`, s: pol(r), r: resPol(r), pasos: ['Multiplica cada término del primero por cada término del segundo', 'Agrupa los términos semejantes'] };
            },
        },
        identidades: {
            label: 'Identidades notables', titulo: 'Desarrolla las siguientes identidades notables.', cols: 2, alto: 70,
            gen: (nv) => {
                const a = nv === 1 ? 1 : R(1, 3), b = R(1, 9), t = R(0, 2);
                const ax = `${a === 1 ? '' : a}x`;
                if (t === 0) return { e: `(${ax} + ${b})² =`, s: pol([a * a, 2 * a * b, b * b]), r: resPol([a * a, 2 * a * b, b * b]), pasos: ['(a + b)² = a² + 2ab + b²'] };
                if (t === 1) return { e: `(${ax} − ${b})² =`, s: pol([a * a, -2 * a * b, b * b]), r: resPol([a * a, -2 * a * b, b * b]), pasos: ['(a − b)² = a² − 2ab + b²'] };
                return { e: `(${ax} + ${b})(${ax} − ${b}) =`, s: pol([a * a, 0, -b * b]), r: resPol([a * a, 0, -b * b]), pasos: ['(a + b)(a − b) = a² − b²'] };
            },
        },
        factorComun: {
            label: 'Factor común', titulo: 'Saca factor común.', cols: 2, alto: 70,
            gen: () => {
                const k = R(2, 6), g = R(1, 2), q = [R(1, 5), noCero(-7, 7)];
                if (mcdArr(q) !== 1) return null;
                const mono = [k, ...Array(g).fill(0)], r = mulC(mono, q);
                const factor = `${k}${g === 1 ? 'x' : 'x²'}`;
                return { e: `${pol(r)} =`, s: `${factor}(${pol(q)})`, r: [{ tipo: 'texto', v: [`${factor}(${pol(q)})`] }], pasos: [`El factor común es ${factor}`] };
            },
        },
    },
};
const mcdArr = (arr) => arr.reduce((g, v) => { let a = Math.abs(g), b = Math.abs(v); while (b) [a, b] = [b, a % b]; return a; });

// ═════════════════════════════════════════════════════════════════════════════
//  FUNCIONES
// ═════════════════════════════════════════════════════════════════════════════
export const FUNCIONES = {
    id: 'funciones', nombre: 'Funciones', emoji: '📈', color: '#e67e22', etapas: ['eso'],
    desc: 'Evaluar funciones, pendiente y ordenada, cortes con los ejes y vértice',
    tipos: {
        evaluar: {
            label: 'Evaluar', titulo: 'Calcula las imágenes que se piden.', cols: 2, alto: 70,
            gen: (nv) => {
                const c = nv === 1 ? [noCero(-5, 6), R(-9, 9)] : [noCero(-3, 3), R(-6, 6), R(-9, 9)];
                const x = R(-4, 4), v = evalP(c, x);
                return { e: `f(x) = ${pol(c)}\nf(${N(x)}) =`, s: `f(${N(x)}) = ${N(v)}`, r: [{ tipo: 'num', v }], pasos: [`Sustituye x por ${P(x)}`] };
            },
        },
        pendiente: {
            label: 'Recta por 2 puntos', titulo: 'Calcula la pendiente y la ordenada en el origen de la recta que pasa por los puntos.', cols: 1, alto: 110,
            gen: () => {
                const m = noCero(-4, 4), n = R(-8, 8), x1 = R(-4, 2), x2 = x1 + R(1, 4);
                const y1 = m * x1 + n, y2 = m * x2 + n;
                return { e: `A(${N(x1)}, ${N(y1)})  y  B(${N(x2)}, ${N(y2)})`, s: `m = ${N(m)},  n = ${N(n)}  →  y = ${polinomio([m, n])}`,
                    r: [{ etiqueta: 'Pendiente m =', tipo: 'frac', v: m }, { etiqueta: 'Ordenada n =', tipo: 'frac', v: n }],
                    pasos: [`m = (y₂ − y₁)/(x₂ − x₁) = (${N(y2)} − ${P(y1)})/(${N(x2)} − ${P(x1)}) = ${frac(y2 - y1, x2 - x1)}`, `n = y₁ − m·x₁ = ${N(y1)} − ${P(m)}·${P(x1)} = ${N(n)}`] };
            },
        },
        cortes: {
            label: 'Cortes con los ejes', titulo: 'Calcula los puntos de corte con los ejes.', cols: 2, alto: 100,
            gen: () => {
                const m = noCero(-5, 5), x0 = R(-6, 6), n = -m * x0;
                return { e: `y = ${polinomio([m, n])}`, s: `Eje X: (${N(x0)}, 0) · Eje Y: (0, ${N(n)})`,
                    r: [{ etiqueta: 'Corte con el eje X: x =', tipo: 'num', v: x0 }, { etiqueta: 'Corte con el eje Y: y =', tipo: 'num', v: n }],
                    pasos: [`Eje Y: x = 0 → y = ${N(n)}`, `Eje X: y = 0 → ${polinomio([m, n])} = 0 → x = ${N(x0)}`] };
            },
        },
        vertice: {
            label: 'Vértice de la parábola', titulo: 'Calcula el vértice de cada parábola.', cols: 2, alto: 100,
            gen: () => {
                const a = noCero(-3, 3), xv = R(-4, 4), b = -2 * a * xv, c = R(-8, 8), yv = a * xv * xv + b * xv + c;
                return { e: `y = ${polinomio([a, b, c])}`, s: `V(${N(xv)}, ${N(yv)})`,
                    r: [{ etiqueta: 'x del vértice =', tipo: 'num', v: xv }, { etiqueta: 'y del vértice =', tipo: 'num', v: yv }],
                    pasos: [`x_v = −b/(2a) = ${N(-b)}/${N(2 * a)} = ${N(xv)}`, `y_v = f(${N(xv)}) = ${N(yv)}`] };
            },
        },
    },
};
