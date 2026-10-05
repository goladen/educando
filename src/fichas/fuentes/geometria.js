// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de GEOMETRÍA y MEDIDA para las fichas de Math World:
//  geometría (perímetros, áreas, Pitágoras, volúmenes, poliedros) ·
//  geometría analítica · medidas (Primaria)
// ─────────────────────────────────────────────────────────────────────────────
import { R, pick, N, P, frac } from '../fuenteTexto';

const PI = 3.14;
const r2 = (x) => Math.round(x * 100) / 100;
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [20, 21, 29]];

// ═════════════════════════════════════════════════════════════════════════════
//  GEOMETRÍA
// ═════════════════════════════════════════════════════════════════════════════
export const GEOMETRIA = {
    id: 'geometria', nombre: 'Geometría', emoji: '📐', color: '#3498db', etapas: ['primaria', 'eso'],
    desc: 'Perímetros, áreas, teorema de Pitágoras, volúmenes y poliedros (Euler)',
    tipos: {
        perimetro: {
            label: 'Perímetros', titulo: 'Calcula el perímetro de cada figura.', cols: 2, alto: 80,
            gen: (nv) => {
                const t = R(0, nv === 1 ? 2 : 3);
                if (t === 0) { const a = R(2, 20), b = R(2, 20); return { largo: true, e: `Rectángulo de ${a} cm de largo y ${b} cm de ancho.`, s: `P = ${2 * (a + b)} cm`, r: [{ tipo: 'num', v: 2 * (a + b), unidad: 'cm' }], pasos: [`P = 2 · ${a} + 2 · ${b}`] }; }
                if (t === 1) { const a = R(2, 25); return { largo: true, e: `Cuadrado de ${a} cm de lado.`, s: `P = ${4 * a} cm`, r: [{ tipo: 'num', v: 4 * a, unidad: 'cm' }], pasos: [`P = 4 · ${a}`] }; }
                if (t === 2) { const a = R(3, 15), b = R(3, 15), c = R(Math.abs(a - b) + 1, a + b - 1); return { largo: true, e: `Triángulo de lados ${a} cm, ${b} cm y ${c} cm.`, s: `P = ${a + b + c} cm`, r: [{ tipo: 'num', v: a + b + c, unidad: 'cm' }], pasos: [`P = ${a} + ${b} + ${c}`] }; }
                const r = R(1, 15), L = r2(2 * PI * r);
                return { largo: true, e: `Circunferencia de ${r} cm de radio (usa π = 3,14).`, s: `L = ${N(L)} cm`, r: [{ tipo: 'num', v: L, unidad: 'cm' }], pasos: [`L = 2 · π · r = 2 · 3,14 · ${r}`] };
            },
        },
        area: {
            label: 'Áreas', titulo: 'Calcula el área de cada figura.', cols: 2, alto: 90,
            gen: (nv) => {
                const t = R(0, nv === 1 ? 2 : 5);
                if (t === 0) { const a = R(2, 20), b = R(2, 20); return { largo: true, e: `Rectángulo de ${a} cm × ${b} cm.`, s: `A = ${a * b} cm²`, r: [{ tipo: 'num', v: a * b, unidad: 'cm²' }], pasos: [`A = b · h = ${a} · ${b}`] }; }
                if (t === 1) { const a = R(2, 20); return { largo: true, e: `Cuadrado de ${a} cm de lado.`, s: `A = ${a * a} cm²`, r: [{ tipo: 'num', v: a * a, unidad: 'cm²' }], pasos: [`A = l² = ${a}²`] }; }
                if (t === 2) { const b = R(2, 20), h = 2 * R(1, 10); return { largo: true, e: `Triángulo de base ${b} cm y altura ${h} cm.`, s: `A = ${b * h / 2} cm²`, r: [{ tipo: 'num', v: b * h / 2, unidad: 'cm²' }], pasos: [`A = b · h / 2 = ${b} · ${h} / 2`] }; }
                if (t === 3) { const B = R(6, 20), b = R(2, B - 1), h = 2 * R(1, 8); return { largo: true, e: `Trapecio de bases ${B} cm y ${b} cm y altura ${h} cm.`, s: `A = ${(B + b) * h / 2} cm²`, r: [{ tipo: 'num', v: (B + b) * h / 2, unidad: 'cm²' }], pasos: [`A = (B + b) · h / 2 = (${B} + ${b}) · ${h} / 2`] }; }
                if (t === 4) { const D = 2 * R(2, 10), d = R(2, 12); return { largo: true, e: `Rombo de diagonales ${D} cm y ${d} cm.`, s: `A = ${D * d / 2} cm²`, r: [{ tipo: 'num', v: D * d / 2, unidad: 'cm²' }], pasos: [`A = D · d / 2 = ${D} · ${d} / 2`] }; }
                const r = R(1, 12), A = r2(PI * r * r);
                return { largo: true, e: `Círculo de ${r} cm de radio (usa π = 3,14).`, s: `A = ${N(A)} cm²`, r: [{ tipo: 'num', v: A, unidad: 'cm²' }], pasos: [`A = π · r² = 3,14 · ${r}²`] };
            },
        },
        pitagoras: {
            label: 'Teorema de Pitágoras', titulo: 'Aplica el teorema de Pitágoras.', cols: 2, alto: 100, niveles: false,
            gen: () => {
                const [a, b, c] = pick(TRIPLES);
                if (Math.random() < 0.5) return { largo: true, e: `Los catetos de un triángulo rectángulo miden ${a} cm y ${b} cm. ¿Cuánto mide la hipotenusa?`, s: `h = ${c} cm`, r: [{ tipo: 'num', v: c, unidad: 'cm' }], pasos: [`h² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}`, `h = √${c * c} = ${c}`] };
                return { largo: true, e: `La hipotenusa de un triángulo rectángulo mide ${c} cm y un cateto ${a} cm. ¿Cuánto mide el otro cateto?`, s: `c = ${b} cm`, r: [{ tipo: 'num', v: b, unidad: 'cm' }], pasos: [`c² = ${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b}`, `c = √${b * b} = ${b}`] };
            },
        },
        volumen: {
            label: 'Volúmenes', titulo: 'Calcula el volumen de cada cuerpo.', cols: 2, alto: 90,
            gen: (nv) => {
                const t = R(0, nv === 1 ? 1 : 3);
                if (t === 0) { const a = R(2, 12); return { largo: true, e: `Cubo de ${a} cm de arista.`, s: `V = ${a ** 3} cm³`, r: [{ tipo: 'num', v: a ** 3, unidad: 'cm³' }], pasos: [`V = a³ = ${a}³`] }; }
                if (t === 1) { const a = R(2, 12), b = R(2, 12), c = R(2, 12); return { largo: true, e: `Ortoedro de ${a} cm × ${b} cm × ${c} cm.`, s: `V = ${a * b * c} cm³`, r: [{ tipo: 'num', v: a * b * c, unidad: 'cm³' }], pasos: [`V = ${a} · ${b} · ${c}`] }; }
                if (t === 2) { const r = R(1, 8), h = R(2, 15), V = r2(PI * r * r * h); return { largo: true, e: `Cilindro de radio ${r} cm y altura ${h} cm (π = 3,14).`, s: `V = ${N(V)} cm³`, r: [{ tipo: 'num', v: V, unidad: 'cm³', tol: 0.05 }], pasos: [`V = π · r² · h = 3,14 · ${r}² · ${h}`] }; }
                const l = R(2, 10), h = 3 * R(1, 6);
                return { largo: true, e: `Pirámide de base cuadrada de ${l} cm de lado y ${h} cm de altura.`, s: `V = ${l * l * h / 3} cm³`, r: [{ tipo: 'num', v: l * l * h / 3, unidad: 'cm³' }], pasos: [`V = Ab · h / 3 = ${l}² · ${h} / 3`] };
            },
        },
        poliedros: {
            label: 'Poliedros (Euler)', titulo: 'Completa usando la fórmula de Euler: C + V = A + 2.', cols: 2, alto: 80, niveles: false,
            gen: () => {
                const n = R(3, 10), prisma = Math.random() < 0.5;
                const C = prisma ? n + 2 : n + 1, V = prisma ? 2 * n : n + 1, A = prisma ? 3 * n : 2 * n;
                const nombre = `${prisma ? 'Prisma' : 'Pirámide'} de base ${['', '', '', 'triangular', 'cuadrada', 'pentagonal', 'hexagonal', 'heptagonal', 'octogonal', 'eneagonal', 'decagonal'][n]}`;
                const falta = pick(['C', 'V', 'A']);
                const dato = { C, V, A };
                const txt = ['C', 'V', 'A'].map(k => (k === falta ? `${k} = ?` : `${k} = ${dato[k]}`)).join(',  ');
                return { largo: true, e: `${nombre}: ${txt}`, s: `${falta} = ${dato[falta]}`, r: [{ tipo: 'num', v: dato[falta] }], pasos: [`C + V = A + 2 → ${C} + ${V} = ${A} + 2`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  GEOMETRÍA ANALÍTICA
// ═════════════════════════════════════════════════════════════════════════════
export const GEO_ANALITICA = {
    id: 'geoAnalitica', nombre: 'Geometría analítica', emoji: '🧭', color: '#1abc9c', etapas: ['eso', 'bach'],
    desc: 'Distancia, punto medio, vectores y ecuación de la recta',
    tipos: {
        distancia: {
            label: 'Distancia entre puntos', titulo: 'Calcula la distancia entre los puntos.', cols: 2, alto: 90, niveles: false,
            gen: () => {
                const [a, b, c] = pick(TRIPLES.slice(0, 5)), x1 = R(-5, 5), y1 = R(-5, 5);
                const x2 = x1 + a * pick([1, -1]), y2 = y1 + b * pick([1, -1]);
                return { e: `A(${N(x1)}, ${N(y1)})   B(${N(x2)}, ${N(y2)})`, s: `d(A, B) = ${c}`, r: [{ tipo: 'num', v: c }],
                    pasos: [`d = √[(${N(x2)} − ${P(x1)})² + (${N(y2)} − ${P(y1)})²] = √(${a * a} + ${b * b}) = √${c * c}`] };
            },
        },
        puntoMedio: {
            label: 'Punto medio', titulo: 'Calcula el punto medio del segmento AB.', cols: 2, alto: 70, niveles: false,
            gen: () => {
                const x1 = R(-8, 8), y1 = R(-8, 8), x2 = x1 + 2 * R(-5, 5), y2 = y1 + 2 * R(-5, 5);
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                return { e: `A(${N(x1)}, ${N(y1)})   B(${N(x2)}, ${N(y2)})`, s: `M(${N(mx)}, ${N(my)})`,
                    r: [{ etiqueta: 'x =', tipo: 'num', v: mx }, { etiqueta: 'y =', tipo: 'num', v: my }], pasos: [`M = ((${N(x1)} + ${P(x2)})/2, (${N(y1)} + ${P(y2)})/2)`] };
            },
        },
        vector: {
            label: 'Vector y módulo', titulo: 'Calcula el vector AB y su módulo.', cols: 2, alto: 90, niveles: false,
            gen: () => {
                const [a, b, c] = pick(TRIPLES.slice(0, 5)), x1 = R(-5, 5), y1 = R(-5, 5), sx = pick([1, -1]), sy = pick([1, -1]);
                const vx = a * sx, vy = b * sy;
                return { e: `A(${N(x1)}, ${N(y1)})   B(${N(x1 + vx)}, ${N(y1 + vy)})`, s: `AB = (${N(vx)}, ${N(vy)}),  |AB| = ${c}`,
                    r: [{ etiqueta: 'Primera componente:', tipo: 'num', v: vx }, { etiqueta: 'Segunda componente:', tipo: 'num', v: vy }, { etiqueta: 'Módulo:', tipo: 'num', v: c }],
                    pasos: [`AB = B − A = (${N(vx)}, ${N(vy)})`, `|AB| = √(${P(vx)}² + ${P(vy)}²) = ${c}`] };
            },
        },
        recta: {
            label: 'Recta por dos puntos', titulo: 'Halla la pendiente y la ecuación explícita de la recta que pasa por A y B.', cols: 1, alto: 100, niveles: false,
            gen: () => {
                const m = pick([-3, -2, -1, 1, 2, 3, 0.5, -0.5]), x1 = 2 * R(-3, 2), x2 = x1 + 2 * R(1, 3), n = R(-6, 6);
                const y1 = m * x1 + n, y2 = m * x2 + n;
                return { e: `A(${N(x1)}, ${N(y1)})   B(${N(x2)}, ${N(y2)})`, s: `m = ${frac(y2 - y1, x2 - x1)}  →  y = ${N(m)}x ${n < 0 ? '−' : '+'} ${Math.abs(n)}`,
                    r: [{ etiqueta: 'Pendiente m =', tipo: 'frac', v: m }, { etiqueta: 'Ordenada en el origen n =', tipo: 'num', v: n }],
                    pasos: [`m = (${N(y2)} − ${P(y1)}) / (${N(x2)} − ${P(x1)}) = ${frac(y2 - y1, x2 - x1)}`, `n = ${N(y1)} − ${P(m)} · ${P(x1)} = ${N(n)}`] };
            },
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════════
//  MEDIDAS (Primaria / 1.º ESO)
// ═════════════════════════════════════════════════════════════════════════════
const ESCALAS = {
    longitud: ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm'],
    masa: ['kg', 'hg', 'dag', 'g', 'dg', 'cg', 'mg'],
    capacidad: ['kl', 'hl', 'dal', 'l', 'dl', 'cl', 'ml'],
};
const convertir = (magnitud) => (nv) => {
    const u = ESCALAS[magnitud], salto = nv === 1 ? R(1, 2) : R(1, 4);
    const i = R(0, u.length - 1 - salto), deMayor = Math.random() < 0.6;
    const [de, a] = deMayor ? [u[i], u[i + salto]] : [u[i + salto], u[i]];
    const factor = Math.pow(10, salto);
    const valor = deMayor ? R(1, 99) / (nv === 3 ? 10 : 1) : R(1, 99) * (nv === 1 ? factor : factor / 10);
    const res = deMayor ? valor * factor : valor / factor;
    return { e: `${N(valor)} ${de} = ___ ${a}`, s: `${N(valor)} ${de} = ${N(res)} ${a}`, r: [{ tipo: 'num', v: res, unidad: a, tol: 1e-6 }],
        pasos: [`De ${de} a ${a} hay ${salto} ${salto === 1 ? 'salto' : 'saltos'}: ${deMayor ? 'multiplica' : 'divide'} por ${factor.toLocaleString('es-ES')}`] };
};
export const MEDIDAS = {
    id: 'medidas', nombre: 'Medidas', emoji: '📏', color: '#9b59b6', etapas: ['primaria', 'eso'],
    desc: 'Longitud, masa, capacidad y tiempo',
    tipos: {
        longitud: { label: 'Longitud', titulo: 'Completa con la unidad de longitud indicada.', cols: 2, alto: 40, gen: convertir('longitud') },
        masa: { label: 'Masa', titulo: 'Completa con la unidad de masa indicada.', cols: 2, alto: 40, gen: convertir('masa') },
        capacidad: { label: 'Capacidad', titulo: 'Completa con la unidad de capacidad indicada.', cols: 2, alto: 40, gen: convertir('capacidad') },
        tiempo: {
            label: 'Tiempo', titulo: 'Completa.', cols: 2, alto: 50,
            gen: (nv) => {
                const t = R(0, nv === 1 ? 1 : 3);
                if (t === 0) { const h = R(1, 5), m = R(0, 59); return { e: `${h} h ${m} min = ___ min`, s: `${h * 60 + m} min`, r: [{ tipo: 'num', v: h * 60 + m, unidad: 'min' }], pasos: [`${h} · 60 + ${m}`] }; }
                if (t === 1) { const m = R(61, 300); return { e: `${m} min = ___ h ___ min`, s: `${Math.floor(m / 60)} h ${m % 60} min`, r: [{ etiqueta: 'Horas:', tipo: 'num', v: Math.floor(m / 60) }, { etiqueta: 'Minutos:', tipo: 'num', v: m % 60 }], pasos: [`${m} : 60 = ${Math.floor(m / 60)} y sobran ${m % 60}`] }; }
                if (t === 2) { const h = R(1, 3), m = R(0, 59), s = R(0, 59); return { e: `${h} h ${m} min ${s} s = ___ s`, s: `${h * 3600 + m * 60 + s} s`, r: [{ tipo: 'num', v: h * 3600 + m * 60 + s, unidad: 's' }], pasos: [`${h} · 3600 + ${m} · 60 + ${s}`] }; }
                const h1 = R(7, 14), m1 = R(0, 59), d = R(20, 200), fin = h1 * 60 + m1 + d;
                const hh = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
                return { largo: true, e: `Una película empieza a las ${hh(h1 * 60 + m1)} y dura ${d} minutos. ¿A qué hora termina?`, s: `A las ${hh(fin)}`, r: [{ tipo: 'texto', v: [hh(fin), hh(fin).replace(':', '.'), hh(fin).replace(':', 'h')], placeholder: '16:45' }], pasos: [`${d} min = ${Math.floor(d / 60)} h ${d % 60} min`, `${hh(h1 * 60 + m1)} + ${Math.floor(d / 60)} h ${d % 60} min = ${hh(fin)}`] };
            },
        },
    },
};
