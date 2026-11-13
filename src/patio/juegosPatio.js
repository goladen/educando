// ═══════════════════════════════════════════════════════════════════
//  PATIO DE JUEGOS — catálogo de juegos de Primaria (1º a 6º)
//  Cada juego: { id, materia, nombre, emoji, color, desc, cursos, gen(curso) }
//  gen(curso) → { instruccion, enunciado, opciones:[{v,label,color}], correcta, explicacion }
//  enunciado: { tipo:'texto'|'palabra'|'hueco'|'frase', … } (mismo formato que Lengua)
//  Los de Lengua reutilizan los generadores de src/lengua/ejercicios.js.
// ═══════════════════════════════════════════════════════════════════
import { TEMAS, rnd, barajar } from '../lengua/ejercicios';
import { ACENTUACION } from '../lengua/bancoOrtografia';
import { JUEGOS_CIENCIAS } from './juegosCiencias';

export const CURSOS = [1, 2, 3, 4, 5, 6];
export const COLOR_CURSO = { 1: '#ff5d73', 2: '#ff9f1c', 3: '#ffcf33', 4: '#2ec4b6', 5: '#3a86ff', 6: '#8e5cff' };

const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('es-ES') : n.toLocaleString('es-ES', { maximumFractionDigits: 2 }));
const COLORES_OP = ['#ff5d73', '#3a86ff', '#2ec4b6', '#ff9f1c'];

// 4 opciones numéricas: la correcta + distractores cercanos (sin repetir, sin negativos)
function opcionesNum(correcta, cerca = []) {
    const dec = !Number.isInteger(correcta);
    const paso = dec ? 0.1 : 1;
    const set = new Set([correcta]);
    const cand = [...cerca, correcta + paso, correcta - paso, correcta + 10 * paso, correcta - 10 * paso, correcta + 2 * paso, correcta - 2 * paso]
        .map(x => Math.round(x * 100) / 100)
        .filter(x => x >= 0);
    for (const c of barajar(cand)) { if (set.size >= 4) break; set.add(c); }
    let k = 3;
    while (set.size < 4) { set.add(Math.round((correcta + k * paso) * 100) / 100); k++; }
    return barajar([...set]).map((v, i) => ({ v, label: fmt(v), color: COLORES_OP[i] }));
}
const preguntaNum = (instruccion, texto, correcta, cerca, explicacion) => ({
    instruccion, enunciado: { tipo: 'texto', texto, grande: true },
    opciones: opcionesNum(correcta, cerca), correcta, explicacion,
});

// ── MATEMÁTICAS ─────────────────────────────────────────────────────
const RANGO_SUMA = { 1: 20, 2: 100, 3: 1000, 4: 10000, 5: 100000, 6: 100000 };

function sumaResta(curso) {
    if (curso === 6 && Math.random() < 0.5) {
        const a = ent(100, 9999) / 100, b = ent(100, 4999) / 100;
        const suma = Math.random() < 0.5;
        const [x, y] = suma ? [a, b] : [Math.max(a, b), Math.min(a, b)];
        const r = Math.round((suma ? x + y : x - y) * 100) / 100;
        return preguntaNum('¿Cuánto es?', `${fmt(x)} ${suma ? '+' : '−'} ${fmt(y)}`, r, [r + 1, r - 1], `${fmt(x)} ${suma ? '+' : '−'} ${fmt(y)} = ${fmt(r)}`);
    }
    const max = RANGO_SUMA[curso];
    const suma = Math.random() < 0.5;
    if (suma) {
        const a = ent(1, Math.floor(max * 0.6)), b = ent(1, max - a);
        return preguntaNum('¿Cuánto es?', `${fmt(a)} + ${fmt(b)}`, a + b, [a + b + 10, a + b - 10], `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`);
    }
    const a = ent(Math.ceil(max * 0.2), max), b = ent(1, a);
    return preguntaNum('¿Cuánto es?', `${fmt(a)} − ${fmt(b)}`, a - b, [a - b + 10, a - b - 10], `${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}`);
}

function tablas(curso) {
    const tablasCurso = curso === 2 ? [2, 3, 4, 5, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = rnd(tablasCurso), b = ent(1, 10);
    const r = a * b;
    return preguntaNum('¿Cuánto es?', `${a} × ${b}`, r, [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b].filter(x => x > 0), `${a} × ${b} = ${r}`);
}

function divisiones(curso) {
    if (curso >= 5 && Math.random() < 0.5) {
        const d = ent(11, 25), c = ent(2, 30);
        return preguntaNum('¿Cuánto es?', `${fmt(d * c)} : ${d}`, c, [c + 1, c - 1, c + 10], `${fmt(d * c)} : ${d} = ${c}, porque ${d} × ${c} = ${fmt(d * c)}`);
    }
    const d = ent(2, 9), c = curso >= 4 ? ent(2, 60) : ent(2, 10);
    return preguntaNum('¿Cuánto es?', `${d * c} : ${d}`, c, [c + 1, c - 1, c + 2], `${d * c} : ${d} = ${c}, porque ${d} × ${c} = ${d * c}`);
}

function escondido(curso) {
    const tipos = curso <= 2 ? ['+', '-'] : ['+', '-', '×', ...(curso >= 4 ? [':'] : [])];
    const t = rnd(tipos);
    const max = curso === 1 ? 20 : curso === 2 ? 100 : 1000;
    let a, b, c, texto, r;
    const hueco = '?';
    if (t === '+') {
        a = ent(1, Math.floor(max / 2)); b = ent(1, Math.floor(max / 2)); c = a + b;
        if (Math.random() < 0.5) { texto = `${hueco} + ${b} = ${c}`; r = a; } else { texto = `${a} + ${hueco} = ${c}`; r = b; }
    } else if (t === '-') {
        a = ent(Math.ceil(max / 4), max); b = ent(1, a - 1); c = a - b;
        if (Math.random() < 0.5) { texto = `${a} − ${hueco} = ${c}`; r = b; } else { texto = `${hueco} − ${b} = ${c}`; r = a; }
    } else if (t === '×') {
        a = ent(2, 10); b = ent(2, 10); c = a * b;
        texto = Math.random() < 0.5 ? `${a} × ${hueco} = ${c}` : `${hueco} × ${b} = ${c}`; r = texto.startsWith('?') ? a : b;
    } else {
        b = ent(2, 9); r = ent(2, 10); a = b * r;
        texto = `${a} : ${b} = ${hueco}`;
    }
    return preguntaNum('¿Qué número falta?', texto, r, [r + 1, r - 1, r + 10], `El número escondido es ${r}: ${texto.replace('?', r)}`);
}

function series(curso) {
    const pasos = curso === 1 ? [1, 2, 5, 10] : curso === 2 ? [2, 3, 5, 10] : curso <= 4 ? [3, 4, 6, 7, 25, 50, 100] : [6, 7, 8, 9, 12, 15, 25, 0.5, 0.25];
    const p = rnd(pasos);
    const baja = curso >= 3 && Math.random() < 0.35;
    const inicio = baja ? ent(6, 12) * p + (Number.isInteger(p) ? ent(0, 20) : 0) : (Number.isInteger(p) ? ent(0, curso <= 2 ? 20 : 100) : ent(0, 10));
    const s = [0, 1, 2, 3, 4].map(i => Math.round((inicio + (baja ? -1 : 1) * i * p) * 100) / 100);
    const r = s[4];
    // Separador «·» (no coma): con decimales «2,5» la coma sería ambigua
    return preguntaNum('¿Qué número sigue?', `${s.slice(0, 4).map(fmt).join('  ·  ')}  ·  ?`, r, [r + p, r - p, r + 1], `La serie va ${baja ? 'restando' : 'sumando'} ${fmt(p)}: ${s.map(fmt).join('  ·  ')}`);
}

function compara(curso) {
    let a, b;
    if (curso >= 5) {
        a = ent(100, 999) / (Math.random() < 0.5 ? 10 : 100);
        b = Math.random() < 0.3 ? a : ent(100, 999) / (Math.random() < 0.5 ? 10 : 100);
    } else {
        const max = RANGO_SUMA[curso];
        a = ent(0, max);
        const r = Math.random();
        b = r < 0.2 ? a : r < 0.6 ? Number(String(a).split('').reverse().join('')) : ent(0, max);
        if (b === a && r >= 0.2) b = a + ent(1, 9);
    }
    const correcta = a > b ? '>' : a < b ? '<' : '=';
    return {
        instruccion: '¿Mayor, menor o igual?',
        enunciado: { tipo: 'texto', texto: `${fmt(a)}   ?   ${fmt(b)}`, grande: true },
        opciones: [{ v: '>', label: '>', color: '#ff5d73' }, { v: '<', label: '<', color: '#3a86ff' }, { v: '=', label: '=', color: '#2ec4b6' }],
        correcta, ordenFijo: true,
        explicacion: `${fmt(a)} ${correcta} ${fmt(b)}`,
    };
}

// ── LENGUA ──────────────────────────────────────────────────────────
const ejLengua = (temaId, ejId) => TEMAS.find(t => t.id === temaId).ejercicios.find(e => e.id === ejId);
const conColores = (q) => ({ ...q, opciones: q.opciones.map((o, i) => ({ ...o, color: o.color || COLORES_OP[i % 4] })) });

const LETRAS_CURSO = { 1: ['rrr', 'mn'], 2: ['rrr', 'mn', 'bv'], 3: ['bv', 'gj', 'h', 'rrr', 'mn'], 4: ['bv', 'gj', 'h', 'lly', 'cz', 'rrr', 'mn'], 5: ['bv', 'gj', 'h', 'lly', 'cz', 'ccc', 'rrr', 'mn'], 6: ['bv', 'gj', 'h', 'lly', 'cz', 'ccc', 'rrr', 'mn'] };
const clasesAcento = (curso) => (curso >= 6 ? [1, 2, 3, 4] : [1, 2, 3]);

function contarSilabas(curso) {
    const max = curso === 1 ? 3 : curso === 2 ? 4 : 5;
    const w = rnd(ACENTUACION.filter(x => !x.hiato && x.sil.length <= max && x.palabra.length <= (curso === 1 ? 8 : 12)));
    const n = w.sil.length;
    const opciones = [1, 2, 3, 4, 5].filter(k => Math.abs(k - n) <= 2).slice(0, 4);
    return {
        instruccion: '¿Cuántas sílabas tiene?',
        enunciado: { tipo: 'texto', texto: w.palabra, grande: true },
        opciones: opciones.map((v, i) => ({ v, label: String(v), color: COLORES_OP[i] })), ordenFijo: true,
        correcta: n,
        explicacion: `${w.sil.join(' - ')} → ${n} sílaba${n > 1 ? 's' : ''}.`,
    };
}

function lexico(curso) {
    const ej = ejLengua('LEXICO', Math.random() < 0.5 ? 'sinonimos' : 'antonimos');
    return conColores(ej.generar({ nivel: curso >= 6 && Math.random() < 0.3 ? 'todo' : 'p' }));
}

// ── CATÁLOGO ────────────────────────────────────────────────────────
export const JUEGOS = [
    // Matemáticas
    { id: 'sumas', materia: 'mates', nombre: 'Sumas y restas', emoji: '➕', color: '#ff5d73', desc: 'Suma, resta y gana estrellas.', cursos: [1, 2, 3, 4, 5, 6], gen: sumaResta },
    { id: 'tablas', materia: 'mates', nombre: 'Tablas de multiplicar', emoji: '✖️', color: '#3a86ff', desc: 'Las tablas del 1 al 10.', cursos: [2, 3, 4, 5, 6], gen: tablas },
    { id: 'escondido', materia: 'mates', nombre: 'El número escondido', emoji: '🔍', color: '#8e5cff', desc: '71 − ? = 57: descubre qué número falta.', cursos: [1, 2, 3, 4, 5, 6], gen: escondido },
    { id: 'divisiones', materia: 'mates', nombre: 'Divisiones', emoji: '➗', color: '#2ec4b6', desc: 'Repartos exactos usando las tablas.', cursos: [3, 4, 5, 6], gen: divisiones },
    { id: 'series', materia: 'mates', nombre: 'Series numéricas', emoji: '🪜', color: '#ff9f1c', desc: '¿Qué número sigue en la escalera?', cursos: [1, 2, 3, 4, 5, 6], gen: series },
    { id: 'compara', materia: 'mates', nombre: 'Mayor, menor o igual', emoji: '🐊', color: '#16a34a', desc: 'El cocodrilo se come al número más grande.', cursos: [1, 2, 3, 4, 5, 6], gen: compara },
    // Lengua
    { id: 'silabas', materia: 'lengua', nombre: 'Cuenta las sílabas', emoji: '👏', color: '#ff5d73', desc: 'Da palmadas: ¿cuántas sílabas tiene la palabra?', cursos: [1, 2, 3], gen: contarSilabas },
    { id: 'letras', materia: 'lengua', nombre: 'Letras dudosas', emoji: '🔤', color: '#3a86ff', desc: 'b/v, r/rr, m/n, g/j, h… completa la palabra.', cursos: [1, 2, 3, 4, 5, 6], gen: (c) => conColores(ejLengua('ORTOGRAFIA', 'letras').generar({ grupos: LETRAS_CURSO[c] })) },
    { id: 'tonica', materia: 'lengua', nombre: 'La sílaba fuerte', emoji: '🔊', color: '#ff9f1c', desc: 'Toca la sílaba que suena más fuerte.', cursos: [2, 3, 4, 5, 6], gen: () => conColores(ejLengua('ORTOGRAFIA', 'tonica').generar({})) },
    { id: 'acento', materia: 'lengua', nombre: 'Agudas, llanas y esdrújulas', emoji: '🎯', color: '#8e5cff', desc: 'Clasifica cada palabra según su sílaba tónica.', cursos: [3, 4, 5, 6], gen: (c) => ejLengua('ORTOGRAFIA', 'acento').generar({ silabas: c <= 4, clases: clasesAcento(c) }) },
    { id: 'tilde', materia: 'lengua', nombre: '¿Lleva tilde?', emoji: '✍️', color: '#e11d48', desc: 'Elige la palabra bien escrita.', cursos: [4, 5, 6], gen: (c) => conColores(ejLengua('ORTOGRAFIA', 'tilde').generar({ clases: clasesAcento(c) })) },
    { id: 'clase', materia: 'lengua', nombre: 'Clases de palabras', emoji: '🧱', color: '#2ec4b6', desc: 'Sustantivo, verbo, adjetivo o determinante.', cursos: [3, 4, 5, 6], gen: () => ejLengua('MORFOLOGIA', 'clase').generar({ nivel: 'primaria' }) },
    { id: 'lexico', materia: 'lengua', nombre: 'Sinónimos y antónimos', emoji: '🤝', color: '#16a34a', desc: 'Palabras que significan lo mismo… o lo contrario.', cursos: [2, 3, 4, 5, 6], gen: lexico },
    // Ciencias Naturales y Geografía e Historia
    ...JUEGOS_CIENCIAS,
];

export const MATERIAS = [
    { id: 'mates', label: 'Matemáticas', emoji: '🔢', color: '#3a86ff', informe: 'Matemáticas' },
    { id: 'lengua', label: 'Lengua', emoji: '📖', color: '#e11d48', informe: 'Lengua' },
    { id: 'naturales', label: 'Ciencias Naturales', emoji: '🌿', color: '#16a34a', informe: 'Ciencias Naturales' },
    { id: 'sociales', label: 'Geografía e Historia', emoji: '🌍', color: '#ff9f1c', informe: 'Geografía e Historia' },
];
export const materiaPorId = (id) => MATERIAS.find(m => m.id === id) || MATERIAS[0];

export const juegoPorId = (id) => JUEGOS.find(j => j.id === id);
export const juegosDe = (materia, curso) => JUEGOS.filter(j => j.materia === materia && j.cursos.includes(curso));

// Genera una pregunta evitando repetir el mismo enunciado que las últimas
export function crearGenerador(juego, curso) {
    const recientes = [];
    return () => {
        let q, clave, n = 0;
        do {
            q = juego.gen(curso);
            clave = JSON.stringify(q.enunciado) + (q.correcta ?? '');
            n++;
        } while (recientes.includes(clave) && n < 12);
        recientes.push(clave);
        if (recientes.length > 8) recientes.shift();
        return q;
    };
}
