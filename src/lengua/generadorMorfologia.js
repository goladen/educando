// ═══════════════════════════════════════════════════════════════════
//  GENERADOR DE FRASES ETIQUETADAS — Morfología (Lengua · Pikt)
//  Crea frases aleatorias con concordancia (género/número, persona del
//  verbo) y devuelve cada palabra con su clase y subclase:
//      [{ t:'El', cat:'DET', sub:'artículo' }, { t:'perro', cat:'SUST' }, …]
//  nivel 'primaria' → sin pronombres, adverbios ni conjunciones.
// ═══════════════════════════════════════════════════════════════════

export const CLASES = {
    SUST: { id: 'SUST', label: 'Sustantivo', plural: 'sustantivos', emoji: '📦', color: '#2980b9' },
    VERB: { id: 'VERB', label: 'Verbo', plural: 'verbos', emoji: '🏃', color: '#e74c3c' },
    ADJ: { id: 'ADJ', label: 'Adjetivo', plural: 'adjetivos', emoji: '🎨', color: '#27ae60' },
    DET: { id: 'DET', label: 'Determinante', plural: 'determinantes', emoji: '👉', color: '#f39c12' },
    PRON: { id: 'PRON', label: 'Pronombre', plural: 'pronombres', emoji: '🙋', color: '#8e44ad' },
    PREP: { id: 'PREP', label: 'Preposición', plural: 'preposiciones', emoji: '🔗', color: '#16a085' },
    CONJ: { id: 'CONJ', label: 'Conjunción', plural: 'conjunciones', emoji: '➕', color: '#d35400' },
    ADV: { id: 'ADV', label: 'Adverbio', plural: 'adverbios', emoji: '⏱️', color: '#7f8c8d' },
};
export const CLASES_PRIMARIA = ['SUST', 'VERB', 'ADJ', 'DET'];
export const CLASES_ESO = ['SUST', 'VERB', 'ADJ', 'DET', 'PRON', 'PREP', 'CONJ', 'ADV'];

// Subclases que se preguntan en el ejercicio «Tipos» (ESO)
export const SUBCLASES = {
    DET: ['artículo', 'demostrativo', 'posesivo', 'numeral', 'indefinido'],
    ADV: ['de tiempo', 'de lugar', 'de modo', 'de cantidad', 'de negación', 'de afirmación'],
    CONJ: ['copulativa', 'disyuntiva', 'adversativa', 'causal'],
    PRON: ['personal'],
};

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;

// ── Sustantivos ─────────────────────────────────────────────────────
const plural = (w) => w.pl || (/[aeiouáéó]$/.test(w.s) ? w.s + 's' : /z$/.test(w.s) ? w.s.slice(0, -1) + 'ces' : w.s + 'es');
const N = (s, g, extra = {}) => ({ s, g, ...extra });

const SERES = [N('niño', 'm'), N('niña', 'f'), N('perro', 'm'), N('gata', 'f'), N('profesora', 'f'), N('médico', 'm'),
    N('abuelo', 'm'), N('vecina', 'f'), N('pájaro', 'm'), N('caballo', 'm'), N('alumno', 'm'), N('amiga', 'f'),
    N('cocinero', 'm'), N('pintora', 'f'), N('hermano', 'm'), N('tía', 'f'), N('conejo', 'm'), N('jugadora', 'f')];

const OBJ = {
    libro: N('libro', 'm'), revista: N('revista', 'f'), carta: N('carta', 'f'), cuento: N('cuento', 'm'), periodico: N('periódico', 'm'),
    manzana: N('manzana', 'f'), pastel: N('pastel', 'm'), bocadillo: N('bocadillo', 'm'), galleta: N('galleta', 'f'), sopa: N('sopa', 'f'),
    poema: N('poema', 'm'), mensaje: N('mensaje', 'm'), casa: N('casa', 'f'), arbol: N('árbol', 'm', { pl: 'árboles' }), flor: N('flor', 'f'),
    mapa: N('mapa', 'm'), paisaje: N('paisaje', 'm'), pan: N('pan', 'm', { pl: 'panes' }), regalo: N('regalo', 'm'), camiseta: N('camiseta', 'f'),
    pelota: N('pelota', 'f'), llave: N('llave', 'f'), juguete: N('juguete', 'm'), mochila: N('mochila', 'f'), cuadro: N('cuadro', 'm'),
    puerta: N('puerta', 'f'), ventana: N('ventana', 'f'), caja: N('caja', 'f'), foto: N('foto', 'f'), pelicula: N('película', 'f'),
    cancion: N('canción', 'f', { pl: 'canciones' }), bicicleta: N('bicicleta', 'f'), coche: N('coche', 'm'), lapiz: N('lápiz', 'm', { pl: 'lápices' }),
};
const LUGARES = {
    parque: N('parque', 'm'), playa: N('playa', 'f'), jardin: N('jardín', 'm', { pl: 'jardines' }), piscina: N('piscina', 'f'),
    plaza: N('plaza', 'f'), montana: N('montaña', 'f'), calle: N('calle', 'f'), bosque: N('bosque', 'm'),
    escuela: N('escuela', 'f'), rio: N('río', 'm'), salon: N('salón', 'm', { pl: 'salones' }), patio: N('patio', 'm'),
    casa: N('casa', 'f'), fiesta: N('fiesta', 'f'), mar: N('mar', 'm', { pl: 'mares' }), sofa: N('sofá', 'm', { pl: 'sofás' }),
    pueblo: N('pueblo', 'm'), ciudad: N('ciudad', 'f'), camino: N('camino', 'm'), escenario: N('escenario', 'm'),
};
// Combinaciones con sentido «preposición + lugar» por verbo
const PASEO = ['por calle', 'por parque', 'por bosque', 'por playa', 'por plaza', 'hacia escuela', 'hacia montana', 'hacia rio', 'en jardin', 'por camino', 'desde casa'];
const DONDE = {
    caminar: PASEO, pasear: PASEO, correr: [...PASEO, 'en patio'],
    saltar: ['en patio', 'en jardin', 'sobre sofa', 'en parque', 'desde escenario'],
    nadar: ['en piscina', 'en rio', 'en mar', 'hacia playa', 'desde playa'],
    bailar: ['en fiesta', 'en salon', 'sobre escenario', 'en plaza'],
    cantar: ['en fiesta', 'sobre escenario', 'en salon', 'en patio'],
    descansar: ['en sofa', 'en jardin', 'bajo arbol', 'en casa', 'en parque'],
    vivir: ['en pueblo', 'en ciudad', 'en casa', 'cerca_de playa', 'cerca_de montana', 'cerca_de escuela'],
};
LUGARES.arbol = N('árbol', 'm', { pl: 'árboles' });

// ── Adjetivos (m sing · f sing; inv = misma forma) ───────────────────
const A = (m, f = m) => ({ m, f });
const ADJ_SERES = [A('alto', 'alta'), A('simpático', 'simpática'), A('feliz'), A('alegre'), A('pequeño', 'pequeña'),
    A('travieso', 'traviesa'), A('valiente'), A('cansado', 'cansada'), A('curioso', 'curiosa'), A('tranquilo', 'tranquila'),
    A('listo', 'lista'), A('amable'), A('divertido', 'divertida'), A('nervioso', 'nerviosa')];
const ADJ_OBJ = [A('rojo', 'roja'), A('nuevo', 'nueva'), A('grande'), A('viejo', 'vieja'), A('bonito', 'bonita'),
    A('interesante'), A('pesado', 'pesada'), A('azul'), A('redondo', 'redonda'), A('precioso', 'preciosa'),
    A('largo', 'larga'), A('enorme'), A('antiguo', 'antigua'), A('verde')];
const ADJ_LUGAR = [A('grande'), A('tranquilo', 'tranquila'), A('bonito', 'bonita'), A('nuevo', 'nueva'), A('limpio', 'limpia'), A('cercano', 'cercana')];
const formaAdj = (a, g, num) => {
    const base = a[g];
    return num === 'p' ? (/[aeiou]$/.test(base) ? base + 's' : /z$/.test(base) ? base.slice(0, -1) + 'ces' : base + 'es') : base;
};

// ── Determinantes ───────────────────────────────────────────────────
const DETS = [
    { sub: 'artículo', f: { ms: 'el', fs: 'la', mp: 'los', fp: 'las' }, peso: 5 },
    { sub: 'artículo', f: { ms: 'un', fs: 'una', mp: 'unos', fp: 'unas' }, peso: 2 },
    { sub: 'demostrativo', f: { ms: 'este', fs: 'esta', mp: 'estos', fp: 'estas' }, peso: 1 },
    { sub: 'demostrativo', f: { ms: 'ese', fs: 'esa', mp: 'esos', fp: 'esas' }, peso: 1 },
    { sub: 'demostrativo', f: { ms: 'aquel', fs: 'aquella', mp: 'aquellos', fp: 'aquellas' }, peso: 1 },
    { sub: 'posesivo', f: { ms: 'mi', fs: 'mi', mp: 'mis', fp: 'mis' }, peso: 1 },
    { sub: 'posesivo', f: { ms: 'tu', fs: 'tu', mp: 'tus', fp: 'tus' }, peso: 1 },
    { sub: 'posesivo', f: { ms: 'su', fs: 'su', mp: 'sus', fp: 'sus' }, peso: 1 },
    { sub: 'posesivo', f: { ms: 'nuestro', fs: 'nuestra', mp: 'nuestros', fp: 'nuestras' }, peso: 1 },
    { sub: 'numeral', f: { mp: 'dos', fp: 'dos' }, peso: 1 },
    { sub: 'numeral', f: { mp: 'tres', fp: 'tres' }, peso: 1 },
    { sub: 'indefinido', f: { mp: 'algunos', fp: 'algunas' }, peso: 1 },
    { sub: 'indefinido', f: { mp: 'muchos', fp: 'muchas' }, peso: 1 },
    { sub: 'indefinido', f: { mp: 'varios', fp: 'varias' }, peso: 1 },
];
function elegirDet(g, num, soloArticulo = false) {
    const key = g + num;
    const pool = DETS.filter(d => d.f[key] && (!soloArticulo || d.sub === 'artículo'));
    const bolsa = pool.flatMap(d => Array(d.peso).fill(d));
    const d = rnd(bolsa);
    return { t: d.f[key], cat: 'DET', sub: d.sub };
}

// ── Verbos regulares ────────────────────────────────────────────────
// trans: lista de claves de OBJ · intrans: true si admite lugar
const VERBOS = [
    { inf: 'leer', obj: ['libro', 'revista', 'carta', 'cuento', 'periodico', 'poema'] },
    { inf: 'comer', obj: ['manzana', 'pastel', 'bocadillo', 'galleta', 'sopa', 'pan'] },
    { inf: 'escribir', obj: ['carta', 'poema', 'mensaje', 'cuento', 'cancion'] },
    { inf: 'dibujar', obj: ['casa', 'arbol', 'flor', 'mapa', 'paisaje', 'coche'] },
    { inf: 'comprar', obj: ['pan', 'regalo', 'camiseta', 'libro', 'bicicleta', 'lapiz', 'mochila'] },
    { inf: 'buscar', obj: ['pelota', 'llave', 'juguete', 'mochila', 'lapiz', 'foto'] },
    { inf: 'pintar', obj: ['cuadro', 'casa', 'puerta', 'flor', 'caja'] },
    { inf: 'abrir', obj: ['puerta', 'ventana', 'caja', 'regalo', 'mochila', 'libro'] },
    { inf: 'mirar', obj: ['foto', 'pelicula', 'mapa', 'cuadro', 'paisaje'] },
    { inf: 'cantar', obj: ['cancion'], lugar: true },
    { inf: 'caminar', lugar: true }, { inf: 'correr', lugar: true }, { inf: 'saltar', lugar: true },
    { inf: 'nadar', lugar: true }, { inf: 'bailar', lugar: true }, { inf: 'descansar', lugar: true },
    { inf: 'pasear', lugar: true }, { inf: 'vivir', lugar: true },
];
const TERM = {
    presente: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
    imperfecto: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
    futuro: { all: ['é', 'ás', 'á', 'emos', 'éis', 'án'] },
};
function conjugar(inf, tiempo, persona) {
    if (tiempo === 'futuro') return inf + TERM.futuro.all[persona];
    const raiz = inf.slice(0, -2), tipo = inf.slice(-2);
    return raiz + TERM[tiempo][tipo][persona];
}

// Pronombres personales sujeto: [forma, persona(0-5), género]
const PRONOMBRES = [['yo', 0], ['tú', 1], ['él', 2, 'm'], ['ella', 2, 'f'], ['nosotros', 3, 'm'], ['nosotras', 3, 'f'],
    ['vosotros', 4, 'm'], ['vosotras', 4, 'f'], ['ellos', 5, 'm'], ['ellas', 5, 'f']];

const ADV = {
    presente: [['hoy', 'de tiempo'], ['ahora', 'de tiempo'], ['siempre', 'de tiempo'], ['todavía', 'de tiempo']],
    imperfecto: [['antes', 'de tiempo'], ['siempre', 'de tiempo'], ['entonces', 'de tiempo']],
    futuro: [['mañana', 'de tiempo'], ['pronto', 'de tiempo'], ['luego', 'de tiempo']],
    modo: [['rápidamente', 'de modo'], ['tranquilamente', 'de modo'], ['bien', 'de modo'], ['despacio', 'de modo'], ['así', 'de modo'], ['alegremente', 'de modo']],
    lugar: [['aquí', 'de lugar'], ['allí', 'de lugar'], ['cerca', 'de lugar'], ['lejos', 'de lugar'], ['fuera', 'de lugar']],
    cantidad: [['mucho', 'de cantidad'], ['poco', 'de cantidad'], ['bastante', 'de cantidad']],
};
const CONJS = [['y', 'copulativa', 3], ['pero', 'adversativa', 3], ['porque', 'causal', 2], ['o', 'disyuntiva', 1], ['ni', 'copulativa', 0]];

// ── Construcción ────────────────────────────────────────────────────
function sintagmaNominal(n, num, adjs, { eso, soloArticulo = false, probAdj = 0.6 }) {
    const out = [elegirDet(n.g, num, soloArticulo), { t: num === 'p' ? plural(n) : n.s, cat: 'SUST' }];
    if (adjs && chance(probAdj)) {
        if (eso && chance(0.3)) out.push({ t: rnd(['muy', 'bastante', 'tan']) === 'tan' ? 'muy' : rnd(['muy', 'bastante']), cat: 'ADV', sub: 'de cantidad' });
        out.push({ t: formaAdj(rnd(adjs), n.g, num), cat: 'ADJ' });
    }
    return out;
}

function clausula({ eso, tiempo }) {
    const toks = [];
    // Sujeto
    let persona;
    if (eso && chance(0.35)) {
        const p = rnd(PRONOMBRES);
        persona = p[1];
        toks.push({ t: p[0], cat: 'PRON', sub: 'personal' });
    } else {
        const num = chance(0.4) ? 'p' : 's';
        persona = num === 'p' ? 5 : 2;
        toks.push(...sintagmaNominal(rnd(SERES), num, ADJ_SERES, { eso }));
    }
    const v = rnd(VERBOS);
    const negar = eso && chance(0.15);
    if (negar) toks.push({ t: 'no', cat: 'ADV', sub: 'de negación' });
    else if (eso && chance(0.08)) toks.push({ t: 'también', cat: 'ADV', sub: 'de afirmación' });
    toks.push({ t: conjugar(v.inf, tiempo, persona), cat: 'VERB' });

    const usarObj = v.obj && (!v.lugar || chance(0.5));
    if (usarObj) {
        const n = OBJ[rnd(v.obj)];
        toks.push(...sintagmaNominal(n, chance(0.3) ? 'p' : 's', ADJ_OBJ, { eso }));
    } else if (eso && !negar && v.inf !== 'vivir' && chance(0.25)) {
        const [t, sub] = rnd([...ADV.lugar, ...ADV.cantidad, ...ADV.modo]);
        toks.push({ t, cat: 'ADV', sub });
    } else {
        const [prep, lugar] = rnd(DONDE[v.inf]).split(' ');
        if (prep === 'cerca_de') toks.push({ t: 'cerca', cat: 'ADV', sub: 'de lugar' }, { t: 'de', cat: 'PREP' });
        else toks.push({ t: prep, cat: 'PREP' });
        toks.push(...sintagmaNominal(LUGARES[lugar], 's', ADJ_LUGAR, { eso, soloArticulo: true, probAdj: 0.35 }));
    }
    // Complemento final opcional
    if (eso && chance(0.35)) {
        const [t, sub] = rnd(chance(0.5) || v.inf === 'vivir' ? ADV[tiempo] : ADV.modo);
        if (!toks.some(x => x.t === t)) toks.push({ t, cat: 'ADV', sub });
    }
    return toks;
}

export function generarFrase({ nivel = 'eso' } = {}) {
    const eso = nivel !== 'primaria';
    const tiempo = rnd(['presente', 'presente', 'imperfecto', 'futuro']);
    let toks = clausula({ eso, tiempo });
    if (eso && chance(0.45)) {
        const bolsa = CONJS.flatMap(c => Array(c[2]).fill(c));
        const [t, sub] = rnd(bolsa);
        toks = [...toks, { t, cat: 'CONJ', sub }, ...clausula({ eso, tiempo })];
    }
    toks[0] = { ...toks[0], t: toks[0].t[0].toUpperCase() + toks[0].t.slice(1) };
    return [...toks, { t: '.', cat: null }];
}

// Genera frases hasta encontrar una que contenga la clase pedida.
export function generarFraseCon(cat, opts) {
    for (let i = 0; i < 40; i++) {
        const f = generarFrase(opts);
        if (!cat || f.some(t => t.cat === cat)) return f;
    }
    return generarFrase(opts);
}
