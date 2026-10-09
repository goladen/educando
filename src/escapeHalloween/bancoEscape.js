// ═══════════════════════════════════════════════════════════════════
//  ESCAPE ROOM DE HALLOWEEN — banco de retos por materia
//  Reutiliza los datos de las apps de cada materia:
//   · Geografía  → PAISES_BANDERAS (GeografiaApp)
//   · Biología   → anatomia_avanzada_dataset.json (BiologiaApp)
//   · Historia   → personajesHistoricos.js (¿Quién es quién? histórico)
//   · Lengua     → generadores de lengua/ejercicios.js (Ortografía y Léxico)
//   · Inglés     → BibliotecaIrregularVerbs.js
//   · Mates      → generador propio de cálculo por etapa
//
//  generarPregunta(materia, etapa, tema) → { texto, detalle?, img?, frase?, opciones:[str], correcta:idx }
//  generarCandado(materia, etapa, tema)  → { titulo, instruccion, pistas:[{texto, img?}], soluciones:[str], tipo, longitud }
//  Las preguntas se generan en cada móvil; los candados los genera el anfitrión y van en la sala.
// ═══════════════════════════════════════════════════════════════════
import { PAISES_BANDERAS } from '../components/GeografiaApp';
import ANATOMIA from '../anatomia_avanzada_dataset.json';
import { PERSONAJES_HISTORICOS } from '../personajesHistoricos';
import { TEMAS } from '../lengua/ejercicios';
import { bibliotecaIrregularVerbs } from '../BibliotecaIrregularVerbs';
import { preguntaDeRecurso, candadoRecurso } from './recursosEscape';

export const rInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const tomar = (arr, n, excluir = []) => barajar(arr.filter(x => !excluir.includes(x))).slice(0, n);
export const normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const FLAG_URL = (iso2) => `https://flagcdn.com/w320/${iso2}.png`;

/** Monta una pregunta de opción múltiple con la correcta en posición aleatoria. */
function opcionMultiple(base, correcta, incorrectas) {
    const opciones = barajar([correcta, ...incorrectas.slice(0, 3)].map(String));
    return { ...base, opciones, correcta: opciones.indexOf(String(correcta)) };
}

// ─── Salas (una por materia) ─────────────────────────────────────────
export const SALAS = {
    MATES: {
        id: 'MATES', materia: 'Matemáticas', nombre: 'El laboratorio del Dr. Calavera', emoji: '🧪', color: '#7CFC00',
        historia: 'Las pociones del doctor burbujean en sus frascos. Solo los cálculos exactos las mantienen estables… y la puerta tiene un candado numérico.',
        amuleto: { emoji: '⚗️', nombre: 'Poción de luz' },
    },
    GEOGRAFIA: {
        id: 'GEOGRAFIA', materia: 'Geografía', nombre: 'La biblioteca de los mapas malditos', emoji: '🗺️', color: '#38bdf8',
        historia: 'Cientos de mapas viejos flotan entre las estanterías. El fantasma bibliotecario solo os dejará pasar si demostráis que conocéis el mundo.',
        amuleto: { emoji: '🧭', nombre: 'Brújula espectral' },
    },
    BIOLOGIA: {
        id: 'BIOLOGIA', materia: 'Biología', nombre: 'La sala de los huesos', emoji: '🦴', color: '#f8fafc',
        historia: 'Un esqueleto gigante custodia la sala. Le faltan piezas y solo quien sepa de anatomía podrá devolvérselas.',
        amuleto: { emoji: '💀', nombre: 'Cráneo de cristal' },
    },
    HISTORIA: {
        id: 'HISTORIA', materia: 'Historia', nombre: 'La galería de retratos embrujados', emoji: '🖼️', color: '#fbbf24',
        historia: 'Los ojos de los retratos os siguen al pasar. Cada personaje histórico guarda un secreto… y uno de ellos tiene la llave.',
        amuleto: { emoji: '🗝️', nombre: 'Llave del tiempo' },
    },
    LENGUA: {
        id: 'LENGUA', materia: 'Lengua', nombre: 'La cripta de los pergaminos', emoji: '📜', color: '#f472b6',
        historia: 'Los pergaminos están llenos de faltas de ortografía y las palabras se han desordenado. Arreglad el texto para romper el hechizo.',
        amuleto: { emoji: '🪶', nombre: 'Pluma encantada' },
    },
    INGLES: {
        id: 'INGLES', materia: 'Inglés', nombre: 'El desván de la bruja inglesa', emoji: '🕸️', color: '#a78bfa',
        historia: 'Una bruja llegada de Londres ha encantado el desván. Sus conjuros solo funcionan en inglés… ¡y los verbos irregulares son su punto débil!',
        amuleto: { emoji: '🧹', nombre: 'Escoba voladora' },
    },
};
export const ORDEN_SALAS = ['MATES', 'GEOGRAFIA', 'BIOLOGIA', 'HISTORIA', 'LENGUA', 'INGLES'];

/** Temas de cada materia (permite montar un escape room entero de una sola materia). */
export const TEMAS_MATERIA = {
    MATES: [
        { v: 'MIX', l: '🎲 Variado' }, { v: 'OPERACIONES', l: '➕ Sumas y restas' }, { v: 'TABLAS', l: '✖️ Multiplicar y dividir' },
        { v: 'ENTEROS', l: '➖ Números enteros' }, { v: 'FRACCIONES', l: '🍕 Fracciones' }, { v: 'POTENCIAS', l: '²√ Potencias y raíces' },
        { v: 'ECUACIONES', l: '🟰 Ecuaciones' }, { v: 'PORCENTAJES', l: '💯 Porcentajes' },
    ],
    GEOGRAFIA: [{ v: 'MIX', l: '🎲 Variado' }, { v: 'BANDERAS', l: '🏳️ Banderas' }, { v: 'CAPITALES', l: '🏛️ Capitales' }],
    BIOLOGIA: [{ v: 'MIX', l: '🎲 Variado' }, { v: 'HUESOS', l: '🦴 Huesos' }, { v: 'MUSCULOS', l: '💪 Músculos' }, { v: 'ORGANOS', l: '🫀 Órganos' }],
    HISTORIA: [{ v: 'MIX', l: '🎲 Variado' }, { v: 'mandatario', l: '👑 Mandatarios' }, { v: 'artista', l: '🎨 Artistas' }, { v: 'cientifico', l: '🔬 Científicos' }],
    LENGUA: [{ v: 'MIX', l: '🎲 Variado' }, { v: 'ORTOGRAFIA', l: '✍️ Ortografía' }, { v: 'LEXICO', l: '📚 Léxico' }],
    INGLES: [{ v: 'MIX', l: '🎲 Variado' }, { v: 'PAST', l: '⏪ Past simple' }, { v: 'PARTICIPLE', l: '✅ Past participle' }, { v: 'VOCAB', l: '🔤 Significado' }],
};

/** Nombres alternativos para cuando se repite una materia. */
const NOMBRES_EXTRA = {
    MATES: ['La cocina de la bruja calculadora', 'El reloj de la torre maldita', 'La bodega de los números perdidos'],
    GEOGRAFIA: ['El salón del globo terráqueo', 'El mirador de los mares oscuros', 'La sala de los exploradores fantasma'],
    BIOLOGIA: ['El laboratorio de Frankenstein', 'El invernadero carnívoro', 'La enfermería abandonada'],
    HISTORIA: ['El salón del baile de los siglos', 'La armería del caballero sin cabeza', 'La biblioteca de las crónicas'],
    LENGUA: ['La sala de los espejos de palabras', 'El confesionario de las letras', 'El estudio del poeta fantasma'],
    INGLES: ['The haunted kitchen', 'The spooky bathroom', 'The vampire’s bedroom'],
};
const AMULETOS_EXTRA = [
    { emoji: '🔮', nombre: 'Bola de cristal' }, { emoji: '🕯️', nombre: 'Vela eterna' }, { emoji: '🪄', nombre: 'Varita mágica' },
    { emoji: '📿', nombre: 'Collar protector' }, { emoji: '🧄', nombre: 'Ristra de ajos' }, { emoji: '🗡️', nombre: 'Daga de plata' },
    { emoji: '🍬', nombre: 'Caramelo mágico' }, { emoji: '🧿', nombre: 'Ojo protector' },
];

/** Datos de presentación de una prueba (sala) del escape room. */
export function infoPrueba(prueba, idx = 0, pruebas = []) {
    if (!prueba) return SALAS.MATES;
    if (prueba.tipo === 'MANUAL') {
        return {
            id: prueba.id, materia: 'Prueba propia', emoji: prueba.emoji || '🗝️', color: '#fb923c',
            nombre: prueba.nombre || 'La habitación secreta',
            historia: prueba.texto || '',
            amuleto: AMULETOS_EXTRA[idx % AMULETOS_EXTRA.length],
            decor: 'MANUAL',
        };
    }
    if (prueba.tipo === 'RECURSO') {
        return {
            id: prueba.id, materia: `Recurso${prueba.autor ? ` de ${prueba.autor}` : ''}`, emoji: prueba.emoji || '📚', color: '#22d3ee',
            nombre: prueba.nombre || prueba.recursoTitulo || 'La biblioteca prohibida',
            historia: `Un libro polvoriento se abre solo: son las preguntas de «${prueba.recursoTitulo || 'un recurso'}»${prueba.autor ? `, escritas por ${prueba.autor}` : ''}. Solo quien las responda podrá seguir.`,
            amuleto: AMULETOS_EXTRA[idx % AMULETOS_EXTRA.length],
            decor: 'LENGUA',
        };
    }
    const base = SALAS[prueba.materia] || SALAS.MATES;
    const repeticion = pruebas.slice(0, idx).filter(p => p.tipo !== 'MANUAL' && p.materia === prueba.materia).length;
    const nombre = prueba.nombre || (repeticion === 0 ? base.nombre : (NOMBRES_EXTRA[base.id] || [])[(repeticion - 1) % 3] || base.nombre);
    const tema = (TEMAS_MATERIA[base.id] || []).find(t => t.v === prueba.tema && t.v !== 'MIX');
    return {
        ...base, id: prueba.id, nombre, decor: base.id,
        materia: tema ? `${base.materia} · ${tema.l.replace(/^\S+\s/, '')}` : base.materia,
        amuleto: repeticion === 0 ? base.amuleto : AMULETOS_EXTRA[idx % AMULETOS_EXTRA.length],
    };
}

/** Materia de las preguntas de una prueba (null si es una prueba propia sin preguntas). */
export const materiaDePrueba = (p) => (p?.tipo === 'MANUAL' ? (p.materiaRetos || null) : p?.materia || null);
export const temaDePrueba = (p) => (p?.tipo === 'MANUAL' ? (p.temaRetos || 'MIX') : p?.tema || 'MIX');

/** ¿La prueba tiene preguntas antes del candado? (materia, prueba propia con preguntas o recurso) */
export const tienePreguntas = (p) => (p?.tipo === 'RECURSO' ? (p.preguntas?.length || 0) > 0 : !!materiaDePrueba(p));

// ═══════════════════════════════════════════════════════════════════
//  MATEMÁTICAS
// ═══════════════════════════════════════════════════════════════════
function distractoresNum(v) {
    const set = new Set();
    const deltas = [...barajar([1, -1, 2, -2, 10, -10, 3, -3, 5]), 4, 6, 7, 8, 9, 11];
    for (const d of deltas) { if (set.size >= 3) break; if (d !== 0 && !(v >= 0 && v + d < 0)) set.add(v + d); }
    return [...set];
}

const FR = (n, d) => `${n}/${d}`;
const mcd = (a, b) => (b ? mcd(b, a % b) : Math.abs(a));

function operacionTema(tema, etapa) {
    const prim = etapa === 'PRIMARIA';
    switch (tema) {
        case 'OPERACIONES': {
            if (Math.random() < 0.5) { const a = prim ? rInt(12, 99) : rInt(120, 999), b = prim ? rInt(8, 89) : rInt(50, 799); return { texto: `${a} + ${b}`, v: a + b }; }
            const a = prim ? rInt(30, 150) : rInt(300, 999), b = rInt(5, a - 5); return { texto: `${a} − ${b}`, v: a - b };
        }
        case 'TABLAS': {
            const a = rInt(2, prim ? 10 : 12), b = rInt(2, prim ? 10 : 12);
            return Math.random() < 0.6 ? { texto: `${a} × ${b}`, v: a * b } : { texto: `${a * b} ÷ ${a}`, v: b };
        }
        case 'ENTEROS': {
            const a = rInt(-15, 15), b = rInt(-15, 15), t = pick(['+', '−', '×']);
            if (t === '+') return { texto: `(${a}) + (${b})`, v: a + b };
            if (t === '−') return { texto: `(${a}) − (${b})`, v: a - b };
            const c = rInt(-9, 9), d = rInt(-9, 9); return { texto: `(${c}) × (${d})`, v: c * d };
        }
        case 'POTENCIAS': {
            if (Math.random() < 0.4) { const r = rInt(2, prim ? 10 : 15); return { texto: `√${r * r}`, v: r }; }
            const b = rInt(2, prim ? 5 : 9), e = b <= 3 ? rInt(2, 4) : b <= 5 ? rInt(2, 3) : 2;
            return { texto: `${b}${['', '', '²', '³', '⁴'][e]}`, v: b ** e };
        }
        case 'ECUACIONES': {
            const x = prim ? rInt(1, 12) : rInt(-6, 12), a = prim ? 1 : rInt(2, 6), b = prim ? rInt(1, 20) : rInt(-10, 10);
            return { texto: `${a === 1 ? '' : a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}   →   x = ?`, v: x };
        }
        case 'PORCENTAJES': {
            const p = pick(prim ? [10, 50, 25] : [5, 10, 15, 20, 25, 30, 50, 75]), n = pick([20, 40, 60, 80, 100, 120, 200, 400]);
            return { texto: `${p} % de ${n}`, v: (p * n) / 100 };
        }
        default: return null;
    }
}

function preguntaFracciones(etapa) {
    const t = pick(etapa === 'PRIMARIA' ? ['cantidad', 'equivalente', 'misma'] : ['cantidad', 'equivalente', 'misma', 'simplificar', 'producto']);
    if (t === 'cantidad') {
        const d = pick([2, 3, 4, 5, 10]), n = rInt(1, d - 1), k = rInt(2, 10);
        return opcionMultiple({ texto: '¿Cuánto es?', detalle: `${FR(n, d)} de ${d * k}`, grande: true }, n * k, distractoresNum(n * k).filter(x => x > 0));
    }
    if (t === 'equivalente') {
        const d = rInt(2, 6), n = rInt(1, d - 1), k = rInt(2, 5);
        return opcionMultiple({ texto: 'Completa la fracción equivalente', detalle: `${FR(n, d)} = ?/${d * k}`, grande: true }, n * k, distractoresNum(n * k).filter(x => x > 0));
    }
    if (t === 'misma') {
        const d = rInt(3, 12), a = rInt(1, d - 2), b = rInt(1, d - a - 1);
        const ok = FR(a + b, d);
        return opcionMultiple({ texto: '¿Cuánto vale?', detalle: `${FR(a, d)} + ${FR(b, d)}`, grande: true }, ok, [FR(a + b, d + d), FR(a + b + 1, d), FR(Math.max(1, a + b - 1) === a + b ? a + b + 2 : Math.max(1, a + b - 1), d)].filter(x => x !== ok));
    }
    if (t === 'simplificar') {
        const g = rInt(2, 6), d0 = rInt(2, 9), n0 = rInt(1, d0 - 1), m = mcd(n0, d0), n = n0 / m, d = d0 / m;
        const ok = FR(n, d);
        return opcionMultiple({ texto: 'Simplifica al máximo', detalle: FR(n * g, d * g), grande: true }, ok, [FR(n + 1, d), FR(n, d + 1), FR(n * 2, d * 3)].filter(x => x !== ok));
    }
    const a = rInt(1, 5), b = rInt(2, 6), c = rInt(1, 5), d = rInt(2, 6);
    const ok = FR(a * c, b * d);
    return opcionMultiple({ texto: '¿Cuánto vale? (sin simplificar)', detalle: `${FR(a, b)} · ${FR(c, d)}`, grande: true }, ok, [...new Set([FR(a + c, b + d), FR(a * d, b * c), FR(a * c, b + d), FR(a + c, b * d)])].filter(x => x !== ok));
}

function operacionMates(etapa) {
    if (etapa === 'PRIMARIA') {
        const t = pick(['suma', 'resta', 'mult', 'div']);
        if (t === 'suma') { const a = rInt(12, 89), b = rInt(8, 79); return { texto: `${a} + ${b}`, v: a + b }; }
        if (t === 'resta') { const a = rInt(30, 120), b = rInt(5, a - 5); return { texto: `${a} − ${b}`, v: a - b }; }
        if (t === 'mult') { const a = rInt(2, 10), b = rInt(2, 10); return { texto: `${a} × ${b}`, v: a * b }; }
        const b = rInt(2, 10), v = rInt(2, 10); return { texto: `${b * v} ÷ ${b}`, v };
    }
    // ESO
    const t = pick(['enteros', 'combinada', 'potencia', 'ecuacion', 'porcentaje']);
    if (t === 'enteros') { const a = rInt(-15, 15), b = rInt(-15, 15); return { texto: `(${a}) − (${b})`, v: a - b }; }
    if (t === 'combinada') { const a = rInt(2, 9), b = rInt(2, 9), c = rInt(1, 20); return { texto: `${c} + ${a} · ${b}`, v: c + a * b }; }
    if (t === 'potencia') { const b = rInt(2, 6), e = b <= 3 ? rInt(2, 4) : 2; return { texto: `${b}${['', '', '²', '³', '⁴'][e]}`, v: b ** e }; }
    if (t === 'ecuacion') { const x = rInt(-6, 9), a = rInt(2, 6), b = rInt(-10, 10); return { texto: `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}   →   x = ?`, v: x }; }
    const p = pick([10, 20, 25, 50, 75]), n = pick([20, 40, 60, 80, 120, 200]); return { texto: `${p} % de ${n}`, v: (p * n) / 100 };
}

function preguntaMates(etapa, tema = 'MIX') {
    if (tema === 'FRACCIONES') return preguntaFracciones(etapa);
    const { texto, v } = operacionTema(tema, etapa) || operacionMates(etapa);
    return opcionMultiple({ texto: '¿Cuánto vale?', detalle: texto, grande: true }, v, distractoresNum(v));
}

/** Expresión cuyo resultado es la cifra d (0-9). */
function expresionCifra(d, etapa) {
    const formas = etapa === 'PRIMARIA'
        ? [
            () => { const b = rInt(1, 9); return `${d + b} − ${b}`; },
            () => { const k = rInt(2, 6); return `${d * k} ÷ ${k}`; },
            () => { const a = rInt(0, d); return `${a} + ${d - a}`; },
        ]
        : [
            () => { const k = rInt(2, 7), r = rInt(1, 9); return `(${d * k + r} − ${r}) ÷ ${k}`; },
            () => { const a = rInt(2, 5), b = rInt(1, 15); return `${a}·${d} + ${b} − ${a * d + b - d}`; },
            () => (d === 0 ? `5 − 5` : d === 1 ? `7⁰` : `√${d * d}`),
            () => { const n = rInt(-8, 8); return `(${n}) + (${d - n})`; },
        ];
    return pick(formas)();
}

function candadoMates(etapa) {
    const cifras = Array.from({ length: 4 }, () => rInt(0, 9));
    const ordinal = ['primera', 'segunda', 'tercera', 'cuarta'];
    return {
        titulo: 'Candado de 4 cifras',
        instruccion: 'Cada cifra del código es el resultado de una operación. Las operaciones están repartidas entre vuestros móviles: ¡juntadlas!',
        tipo: 'numero', longitud: 4,
        pistas: cifras.map((d, i) => ({ texto: `La ${ordinal[i]} cifra es: ${expresionCifra(d, etapa)}` })),
        soluciones: [cifras.join('')],
        solucionVisible: cifras.join(''),
    };
}

// ═══════════════════════════════════════════════════════════════════
//  GEOGRAFÍA
// ═══════════════════════════════════════════════════════════════════
const poolPaises = (etapa) => (etapa === 'PRIMARIA' ? PAISES_BANDERAS.filter(p => ['Europa', 'América'].includes(p.continente)) : PAISES_BANDERAS);

function preguntaGeografia(etapa, tema = 'MIX') {
    const pool = poolPaises(etapa);
    const p = pick(pool);
    const t = tema === 'BANDERAS' ? 'bandera' : tema === 'CAPITALES' ? pick(['capital', 'pais']) : pick(['bandera', 'capital', 'pais']);
    if (t === 'bandera') {
        return opcionMultiple({ texto: '¿De qué país es esta bandera?', img: FLAG_URL(p.iso2) }, p.nombre, tomar(pool.map(x => x.nombre), 3, [p.nombre]));
    }
    if (t === 'capital') {
        return opcionMultiple({ texto: `¿Cuál es la capital de ${p.nombre}?` }, p.capital, tomar(pool.map(x => x.capital), 3, [p.capital]));
    }
    return opcionMultiple({ texto: `¿De qué país es capital ${p.capital}?` }, p.nombre, tomar(pool.map(x => x.nombre), 3, [p.nombre]));
}

function candadoGeografia(etapa) {
    const p = pick(poolPaises(etapa).filter(x => x.capital.length >= 4 && x.capital.length <= 12));
    return {
        titulo: 'La capital secreta',
        instruccion: 'El fantasma bibliotecario esconde una ciudad. Uno de vosotros tiene la bandera del país… ¡averiguad su CAPITAL!',
        tipo: 'texto', longitud: p.capital.length,
        pistas: [
            { texto: 'Esta es la bandera del país:', img: FLAG_URL(p.iso2) },
            { texto: `El país está en ${p.continente}.` },
            { texto: `La capital empieza por «${p.capital[0]}».` },
            { texto: `El nombre de la capital tiene ${p.capital.replace(/\s/g, '').length} letras.` },
        ],
        soluciones: [p.capital],
        solucionVisible: `${p.capital} (${p.nombre})`,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  BIOLOGÍA
// ═══════════════════════════════════════════════════════════════════
const poolAnatomia = (etapa) => (etapa === 'PRIMARIA' ? ANATOMIA.filter(a => a.dificultad === 'Fácil' || a.categoria === 'Órgano') : ANATOMIA);
const censurar = (texto, nombre) => {
    const raiz = nombre.split(' ')[0].slice(0, Math.max(4, nombre.split(' ')[0].length - 2));
    return texto.replace(new RegExp(raiz, 'gi'), '▒▒▒');
};

const CAT_BIO = { HUESOS: 'Hueso', MUSCULOS: 'Músculo', ORGANOS: 'Órgano' };
const poolBio = (etapa, tema) => {
    const filtro = (a) => !CAT_BIO[tema] || a.categoria === CAT_BIO[tema];
    const p = poolAnatomia(etapa).filter(filtro);
    return p.length >= 6 ? p : ANATOMIA.filter(filtro);
};

function preguntaBiologia(etapa, tema = 'MIX') {
    const pool = poolBio(etapa, tema);
    const item = pick(pool);
    const t = pick(['descripcion', 'descripcion', 'sistema', 'foto']);
    if (t === 'sistema') {
        const sistemas = [...new Set(ANATOMIA.map(a => a.sistema))];
        return opcionMultiple({ texto: `¿A qué sistema o aparato pertenece: ${item.nombre}?` }, item.sistema, tomar(sistemas, 3, [item.sistema]));
    }
    const mismos = pool.filter(a => a.categoria === item.categoria).map(a => a.nombre);
    if (t === 'foto' && item.imagenUrl) {
        return opcionMultiple({ texto: `¿Qué ${item.categoria.toLowerCase()} es este?`, img: item.imagenUrl }, item.nombre, tomar(mismos, 3, [item.nombre]));
    }
    return opcionMultiple({ texto: `¿Qué ${item.categoria.toLowerCase()} es?`, detalle: censurar(item.descripcion, item.nombre) }, item.nombre, tomar(mismos, 3, [item.nombre]));
}

function candadoBiologia(etapa, tema = 'MIX') {
    const pool = poolBio(etapa, tema);
    const cortos = pool.filter(a => a.nombre.length <= 14);
    const item = pick(cortos.length ? cortos : pool);
    return {
        titulo: 'La pieza perdida del esqueleto',
        instruccion: `Al guardián le falta una pieza: es un ${item.categoria.toLowerCase()}. Juntad las pistas y escribid su nombre.`,
        tipo: 'texto', longitud: item.nombre.length,
        pistas: [
            { texto: `Pertenece al ${item.sistema}.` },
            { texto: `Lo que sé: «${censurar(item.descripcion, item.nombre)}»` },
            { texto: `Empieza por «${item.nombre[0]}» y tiene ${item.nombre.replace(/\s/g, '').length} letras.` },
            { texto: `Es un ${item.categoria.toLowerCase()}. Termina en «${item.nombre.slice(-2)}».` },
        ],
        soluciones: [item.nombre],
        solucionVisible: item.nombre,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  HISTORIA
// ═══════════════════════════════════════════════════════════════════
const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'van', 'von', 'da', 'di', 'y', 'i', 'ii', 'iii', 'iv', 'vii', 'viii']);
const fechaTxt = (y) => (y < 0 ? `${-y} a. C.` : `${y}`);
const enEpoca = (e) => (/^siglo/i.test(e) ? `en el siglo ${e.replace(/^siglo\s*/i, '')}` : `en la ${e}`);

const poolHistoria = (tema) => { const p = PERSONAJES_HISTORICOS.filter(x => tema === 'MIX' || !tema || x.categoria === tema); return p.length >= 4 ? p : PERSONAJES_HISTORICOS; };

function preguntaHistoria(etapa, tema = 'MIX') {
    const POOL = poolHistoria(tema);
    const p = pick(POOL);
    const t = pick(['dato', 'dato', 'epoca', 'campo']);
    const nombres = POOL.map(x => x.nombre);
    if (t === 'epoca') {
        return opcionMultiple({ texto: `¿En qué época vivió ${p.nombre}?` }, p.epoca, tomar([...new Set(PERSONAJES_HISTORICOS.map(x => x.epoca))], 3, [p.epoca]));
    }
    if (t === 'campo') {
        const mismos = PERSONAJES_HISTORICOS.filter(x => x.categoria === p.categoria).map(x => x.nombre);
        return opcionMultiple({ texto: `¿Quién fue ${p.campo.toLowerCase()} (${p.pais}, ${fechaTxt(p.nac)}–${fechaTxt(p.fall)})?` }, p.nombre, tomar(mismos, 3, [p.nombre]));
    }
    return opcionMultiple({ texto: '¿De quién hablamos?', detalle: pick(p.datos) }, p.nombre, tomar(nombres, 3, [p.nombre]));
}

function candadoHistoria(etapa, tema = 'MIX') {
    const p = pick(poolHistoria(tema));
    const tokens = p.nombre.split(/\s+/).filter(t => t.length >= 4 && !PALABRAS_VACIAS.has(normalizar(t)));
    return {
        titulo: 'El retrato que habla',
        instruccion: 'Un retrato ha perdido su placa con el nombre. Cada uno tiene un recuerdo del personaje: ¡poned en común quién es!',
        tipo: 'texto', longitud: null,
        pistas: [
            ...p.datos.map(d => ({ texto: `Recuerdo: «${d}»` })),
            { texto: `Vivió ${enEpoca(p.epoca)} (${p.pais}).` },
            { texto: `Fue ${p.campo.toLowerCase()}. Su nombre empieza por «${p.nombre[0]}».` },
        ],
        soluciones: [p.nombre, ...tokens],
        solucionVisible: p.nombre,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  LENGUA (generadores de lengua/ejercicios.js)
// ═══════════════════════════════════════════════════════════════════
const ejerciciosLengua = () => {
    const orto = TEMAS.find(t => t.id === 'ORTOGRAFIA')?.ejercicios || [];
    const lex = TEMAS.find(t => t.id === 'LEXICO')?.ejercicios || [];
    return [...orto, ...lex].filter(e => typeof e.generar === 'function' && ['acento', 'tilde', 'letras', 'sinonimos', 'antonimos', 'campos', 'refranes'].includes(e.id));
};

const IDS_LENGUA = { ORTOGRAFIA: ['acento', 'tilde', 'letras'], LEXICO: ['sinonimos', 'antonimos', 'campos', 'refranes'] };

function preguntaLengua(etapa, tema = 'MIX') {
    const todos = ejerciciosLengua();
    const lista = IDS_LENGUA[tema] ? todos.filter(e => IDS_LENGUA[tema].includes(e.id)) : todos;
    for (let intento = 0; intento < 8; intento++) {
        const ej = pick(lista);
        const cfg = Object.fromEntries((ej.config || []).map(c => [c.key, c.def]));
        if ('nivel' in cfg) cfg.nivel = etapa === 'PRIMARIA' ? 'p' : 'todo';
        if (ej.id === 'acento') cfg.silabas = etapa === 'PRIMARIA';
        let q;
        try { q = ej.generar(cfg); } catch { continue; }
        if (!q || q.tipo !== 'opciones') continue;
        const opciones = q.opciones.map(o => String(o.label));
        const correcta = q.opciones.findIndex(o => o.v === q.correcta);
        if (correcta < 0) continue;
        const e = q.enunciado;
        const base = { texto: q.instruccion, opciones, correcta };
        if (!e) return base;
        if (e.tipo === 'hueco') return { ...base, detalle: `${e.antes}__${e.despues}`, grande: true };
        if (e.tipo === 'palabra') return { ...base, detalle: e.silabas ? e.silabas.join(' - ') : e.texto, grande: true };
        if (e.tipo === 'frase') return { ...base, frase: { tokens: e.tokens.map(t => t.t), resaltar: e.resaltar } };
        return { ...base, detalle: e.texto, grande: !!e.grande };
    }
    return preguntaMates(etapa);
}

const PALABRAS_HALLOWEEN = [
    { p: 'CALABAZA', def: 'Fruto naranja que se vacía y se ilumina con una vela.' },
    { p: 'FANTASMA', def: 'Espíritu que atraviesa las paredes y hace «buuu».' },
    { p: 'CALAVERA', def: 'Conjunto de huesos de la cabeza.' },
    { p: 'ESQUELETO', def: 'Armazón de huesos que sostiene el cuerpo.' },
    { p: 'VAMPIRO', def: 'Criatura de la noche que no se refleja en los espejos.' },
    { p: 'MURCIELAGO', def: 'Mamífero volador que duerme boca abajo.' },
    { p: 'CEMENTERIO', def: 'Lugar donde están las tumbas.' },
    { p: 'CALDERO', def: 'Recipiente grande donde la bruja prepara sus pociones.' },
    { p: 'HECHIZO', def: 'Conjuro mágico que transforma o encanta algo.' },
    { p: 'TELARAÑA', def: 'Red que teje un animal de ocho patas.' },
    { p: 'DISFRAZ', def: 'Ropa que te pones para parecer otra persona o ser.' },
    { p: 'CARAMELO', def: 'Dulce que piden los niños de puerta en puerta.' },
];

function trocearLetras(palabra, n) {
    const letras = barajar(palabra.split(''));
    const grupos = Array.from({ length: n }, () => []);
    letras.forEach((l, i) => grupos[i % n].push(l));
    return grupos;
}

function candadoLengua() {
    const w = pick(PALABRAS_HALLOWEEN);
    const grupos = trocearLetras(w.p, 3);
    return {
        titulo: 'El pergamino desordenado',
        instruccion: 'Las letras de una palabra mágica se han desperdigado por la cripta. Reunid todas las letras y ordenadlas.',
        tipo: 'texto', longitud: w.p.length,
        pistas: [
            ...grupos.map(g => ({ texto: `Tus letras: ${g.join(' · ')}` })),
            { texto: `Definición: ${w.def} (${w.p.length} letras)` },
        ],
        soluciones: [w.p],
        solucionVisible: w.p,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  INGLÉS (verbos irregulares)
// ═══════════════════════════════════════════════════════════════════
const poolVerbos = (etapa) => (etapa === 'PRIMARIA' ? bibliotecaIrregularVerbs.filter(v => v.level !== 'dificil') : bibliotecaIrregularVerbs);

function preguntaIngles(etapa, tema = 'MIX') {
    const pool = poolVerbos(etapa);
    const v = pick(pool);
    const t = { PAST: 'past', PARTICIPLE: 'participle', VOCAB: 'traduccion' }[tema] || pick(['past', 'participle', 'traduccion']);
    if (t === 'traduccion') {
        return opcionMultiple({ texto: `What does «${v.baseForm}» mean?` }, v.translation, tomar([...new Set(pool.map(x => x.translation))], 3, [v.translation]));
    }
    const campo = t === 'past' ? 'pastSimple' : 'pastParticiple';
    const otros = pool.filter(x => x !== v).map(x => x[campo]);
    const falsos = [`${v.baseForm}ed`.replace(/eed$/, 'ed'), ...tomar(otros, 3)];
    return opcionMultiple(
        { texto: t === 'past' ? 'Past simple of…' : 'Past participle of…', detalle: v.baseForm, grande: true },
        v[campo], [...new Set(falsos.filter(f => f !== v[campo]))]
    );
}

const PALABRAS_EN = [
    { p: 'GHOST', es: 'fantasma', def: 'Atraviesa paredes y dice «boo».' },
    { p: 'WITCH', es: 'bruja', def: 'Vuela en escoba y tiene un caldero.' },
    { p: 'PUMPKIN', es: 'calabaza', def: 'Es naranja y se le talla una cara.' },
    { p: 'SPIDER', es: 'araña', def: 'Tiene ocho patas y teje redes.' },
    { p: 'SKELETON', es: 'esqueleto', def: 'Está hecho solo de huesos.' },
    { p: 'MONSTER', es: 'monstruo', def: 'Criatura que vive debajo de la cama.' },
    { p: 'CANDY', es: 'caramelo', def: 'Lo que se pide en «trick or treat».' },
    { p: 'ZOMBIE', es: 'zombi', def: 'Camina despacio, con los brazos estirados… ¡y viene a por vosotros!' },
];

function candadoIngles() {
    const w = pick(PALABRAS_EN);
    return {
        titulo: 'The witch’s password',
        instruccion: 'La bruja solo abre la puerta con una contraseña EN INGLÉS. Juntad las pistas para adivinarla.',
        tipo: 'texto', longitud: w.p.length,
        pistas: [
            { texto: `Adivinanza: ${w.def}` },
            { texto: `In English it has ${w.p.length} letters.` },
            { texto: `It starts with «${w.p[0]}» and ends with «${w.p.slice(-1)}».` },
            { texto: `Letras desordenadas: ${barajar(w.p.split('')).join(' ')}` },
        ],
        soluciones: [w.p],
        solucionVisible: `${w.p} (${w.es})`,
    };
}

// ═══════════════════════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════════════════════
const GEN_PREGUNTA = {
    MATES: preguntaMates, GEOGRAFIA: preguntaGeografia, BIOLOGIA: preguntaBiologia,
    HISTORIA: preguntaHistoria, LENGUA: preguntaLengua, INGLES: preguntaIngles,
};
const GEN_CANDADO = {
    MATES: candadoMates, GEOGRAFIA: candadoGeografia, BIOLOGIA: candadoBiologia,
    HISTORIA: candadoHistoria, LENGUA: candadoLengua, INGLES: candadoIngles,
};

export function generarPregunta(materia, etapa = 'ESO', tema = 'MIX') {
    const gen = GEN_PREGUNTA[materia] || preguntaMates;
    for (let i = 0; i < 5; i++) {
        try {
            const q = gen(etapa, tema);
            if (q && q.opciones?.length >= 2 && q.correcta >= 0) return { ...q, materia };
        } catch (e) { /* reintenta */ }
    }
    return { ...preguntaMates(etapa), materia: 'MATES' };
}

export function generarCandado(materia, etapa = 'ESO', tema = 'MIX') {
    return (GEN_CANDADO[materia] || candadoMates)(etapa, tema);
}

/** Huella del código de una prueba propia (para no dejar el código en claro en la sala). */
export const huellaCodigo = (codigo) => {
    const t = normalizar(codigo);
    let h1 = 0x811c9dc5, h2 = 7;
    for (const c of t) { h1 = Math.imul(h1 ^ c.charCodeAt(0), 16777619) >>> 0; h2 = (h2 * 31 + c.charCodeAt(0)) >>> 0; }
    return t ? `${h1.toString(36)}${h2.toString(36)}` : '';
};

/** Prepara una prueba para guardarla en la sala en vivo (el código va como huella). */
export function pruebaParaSala(p) {
    if (p.tipo === 'RECURSO') {
        return { id: p.id, tipo: 'RECURSO', nombre: p.nombre || '', emoji: p.emoji || '📚', recursoTitulo: p.recursoTitulo || '', autor: p.autor || '', preguntas: (p.preguntas || []).slice(0, 80) };
    }
    if (p.tipo !== 'MANUAL') return { id: p.id, tipo: 'MATERIA', materia: p.materia, tema: p.tema || 'MIX', nombre: p.nombre || '' };
    const codigos = String(p.codigo || '').split('|').map(c => c.trim()).filter(Boolean);
    return {
        id: p.id, tipo: 'MANUAL', nombre: p.nombre || '', emoji: p.emoji || '🗝️', texto: p.texto || '', pista: p.pista || '',
        imagen: p.imagen || '', materiaRetos: p.materiaRetos || null, temaRetos: p.temaRetos || 'MIX',
        huellas: codigos.map(huellaCodigo), longitud: codigos[0] ? normalizar(codigos[0]).length : null,
        tipoCodigo: codigos[0] && /^d+$/.test(codigos[0].replace(/s/g, '')) ? 'numero' : 'texto',
    };
}

/** Candado de una prueba propia: el texto del profe + el código que los alumnos buscan en el aula. */
export function candadoManual(p) {
    return {
        titulo: p.nombre || 'La habitación secreta',
        instruccion: p.texto || 'Buscad el código escondido en el aula.',
        tipo: p.tipoCodigo || 'texto', longitud: p.longitud || null, manual: true,
        imagen: p.imagen || '',
        pistas: p.pista ? [{ texto: p.pista }] : [],
        compartidas: true,           // todos los móviles ven el mismo texto
        huellas: p.huellas || [],
        soluciones: [],
        solucionVisible: '',
    };
}

/** ¿La respuesta escrita abre el candado? */
export function compruebaCandado(candado, respuesta) {
    const r = normalizar(respuesta);
    if (!r) return false;
    if (candado?.huellas?.length) return candado.huellas.includes(huellaCodigo(respuesta));
    return (candado?.soluciones || []).some(s => normalizar(s) === r);
}

/** Reparte las pistas entre los jugadores (índice del jugador en la lista ordenada). */
export function pistasDeJugador(pistas, idxJugador, numJugadores) {
    if (!pistas?.length || idxJugador < 0) return [];
    const n = Math.max(1, numJugadores);
    if (n >= pistas.length) return [pistas[idxJugador % pistas.length]];
    return pistas.filter((_, j) => j % n === idxJugador);
}

/** Una pregunta para la prueba, sea del tipo que sea. */
export function preguntaDePrueba(p, etapa = 'ESO') {
    if (p?.tipo === 'RECURSO') return preguntaDeRecurso(p) || generarPregunta('MATES', etapa);
    return generarPregunta(materiaDePrueba(p) || 'MATES', etapa, temaDePrueba(p));
}

/** Candado de una prueba en el modo online (la prueba propia debe venir de pruebaParaSala, con huellas). */
export function candadoDePrueba(p, etapa = 'ESO') {
    if (p?.tipo === 'MANUAL') return candadoManual(p);
    if (p?.tipo === 'RECURSO') return candadoRecurso(p);
    return generarCandado(p?.materia, etapa, p?.tema);
}
