// ═══════════════════════════════════════════════════════════════════
//  GENERADOR DE FRASES ETIQUETADAS — Morfología (Lengua · Pikt)
//  Crea frases aleatorias con concordancia (género/número, persona del
//  verbo) y devuelve cada palabra con su clase y subclase:
//      [{ t:'El', cat:'DET', sub:'artículo' }, { t:'perro', cat:'SUST' }, …]
//  El léxico es semántico: cada verbo indica qué sujetos admite, qué
//  complementos, lugares, adverbios y causas tienen sentido con él, y
//  cada sustantivo lleva sus propios adjetivos.
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

// ── Adjetivos: A(masc, fem) · plural automático ─────────────────────
const A = (m, f = m) => ({ m, f });
const formaAdj = (a, g, num) => {
    const base = a[g];
    if (num !== 'p') return base;
    return /[aeiouáéó]$/.test(base) ? base + 's' : /z$/.test(base) ? base.slice(0, -1) + 'ces' : base + 'es';
};

// ── Sustantivos ─────────────────────────────────────────────────────
//  g: género · pl: plural irregular · adj: adjetivos con sentido
//  masa: incontable (sin plural, sin numerales) · pos: admite posesivo como sujeto
const plural = (w) => w.pl || (/[aeiouáéó]$/.test(w.s) ? w.s + 's' : /z$/.test(w.s) ? w.s.slice(0, -1) + 'ces' : w.s + 'es');
const N = (s, g, adj = [], extra = {}) => ({ s, g, adj, ...extra });

const ADJ_PERSONA = [A('simpático', 'simpática'), A('amable'), A('alegre'), A('valiente'), A('curioso', 'curiosa'),
    A('divertido', 'divertida'), A('tranquilo', 'tranquila'), A('alto', 'alta'), A('trabajador', 'trabajadora'), A('generoso', 'generosa')];
const ADJ_ANIMAL = [A('pequeño', 'pequeña'), A('blanco', 'blanca'), A('negro', 'negra'), A('travieso', 'traviesa'), A('hambriento', 'hambrienta'), A('precioso', 'preciosa')];

// Personas (pareja masculino/femenino para variar)
const PERSONAS = [
    N('niño', 'm', ADJ_PERSONA), N('niña', 'f', ADJ_PERSONA), N('alumno', 'm', ADJ_PERSONA), N('alumna', 'f', ADJ_PERSONA),
    N('profesora', 'f', ADJ_PERSONA), N('profesor', 'm', ADJ_PERSONA, { pl: 'profesores' }), N('médica', 'f', ADJ_PERSONA),
    N('abuela', 'f', ADJ_PERSONA, { pos: true, familia: true }), N('abuelo', 'm', ADJ_PERSONA, { pos: true, familia: true }), N('hermano', 'm', ADJ_PERSONA, { pos: true, familia: true }),
    N('hermana', 'f', ADJ_PERSONA, { pos: true, familia: true }), N('prima', 'f', ADJ_PERSONA, { pos: true, familia: true }), N('primo', 'm', ADJ_PERSONA, { pos: true, familia: true }),
    N('vecina', 'f', ADJ_PERSONA, { pos: true }), N('vecino', 'm', ADJ_PERSONA, { pos: true }), N('amiga', 'f', ADJ_PERSONA, { pos: true }),
    N('amigo', 'm', ADJ_PERSONA, { pos: true }),
];
const NOMBRES = [['Lucía', 'f'], ['Pablo', 'm'], ['Marta', 'f'], ['Hugo', 'm'], ['Sara', 'f'], ['Daniel', 'm'], ['Irene', 'f'], ['Mario', 'm'], ['Carmen', 'f'], ['Álex', 'm']];
const ANIMALES = {
    perro: N('perro', 'm', ADJ_ANIMAL, { pos: true }), gata: N('gata', 'f', ADJ_ANIMAL, { pos: true }), caballo: N('caballo', 'm', ADJ_ANIMAL),
    conejo: N('conejo', 'm', ADJ_ANIMAL, { pos: true }), pajaro: N('pájaro', 'm', [A('pequeño', 'pequeña'), A('precioso', 'preciosa'), A('amarillo', 'amarilla')]),
};

// Objetos (complemento directo) con sus adjetivos naturales
const OBJ = {
    libro: N('libro', 'm', [A('interesante'), A('nuevo', 'nueva'), A('antiguo', 'antigua'), A('divertido', 'divertida')]),
    cuento: N('cuento', 'm', [A('divertido', 'divertida'), A('precioso', 'preciosa'), A('corto', 'corta'), A('largo', 'larga')]),
    revista: N('revista', 'f', [A('nuevo', 'nueva'), A('interesante')]),
    carta: N('carta', 'f', [A('largo', 'larga'), A('bonito', 'bonita'), A('importante')]),
    poema: N('poema', 'm', [A('precioso', 'preciosa'), A('corto', 'corta'), A('triste')]),
    mensaje: N('mensaje', 'm', [A('corto', 'corta'), A('importante'), A('largo', 'larga')]),
    redaccion: N('redacción', 'f', [A('largo', 'larga'), A('original')], { pl: 'redacciones' }),
    leccion: N('lección', 'f', [A('nuevo', 'nueva'), A('difícil')], { pl: 'lecciones' }),
    tema: N('tema', 'm', [A('difícil'), A('nuevo', 'nueva')]),
    casa: N('casa', 'f', [A('grande'), A('bonito', 'bonita'), A('antiguo', 'antigua')]),
    arbol: N('árbol', 'm', [A('alto', 'alta'), A('enorme'), A('frondoso', 'frondosa')], { pl: 'árboles' }),
    flor: N('flor', 'f', [A('amarillo', 'amarilla'), A('rojo', 'roja'), A('precioso', 'preciosa')]),
    paisaje: N('paisaje', 'm', [A('precioso', 'preciosa'), A('nevado', 'nevada')]),
    mapa: N('mapa', 'm', [A('antiguo', 'antigua'), A('grande')]),
    cuadro: N('cuadro', 'm', [A('bonito', 'bonita'), A('antiguo', 'antigua'), A('enorme')]),
    pared: N('pared', 'f', [A('blanco', 'blanca')], { pl: 'paredes' }),
    valla: N('valla', 'f', [A('verde'), A('viejo', 'vieja')]),
    puerta: N('puerta', 'f', [A('verde'), A('viejo', 'vieja'), A('principal')]),
    ventana: N('ventana', 'f', [A('grande'), A('pequeño', 'pequeña')]),
    caja: N('caja', 'f', [A('pesado', 'pesada'), A('vacío', 'vacía'), A('grande')]),
    regalo: N('regalo', 'm', [A('bonito', 'bonita'), A('grande'), A('sorprendente')]),
    pan: N('pan', 'm', [A('tierno', 'tierna'), A('crujiente')], { masa: true }),
    fruta: N('fruta', 'f', [A('fresco', 'fresca')], { masa: true }),
    camiseta: N('camiseta', 'f', [A('azul'), A('nuevo', 'nueva'), A('blanco', 'blanca')]),
    bicicleta: N('bicicleta', 'f', [A('nuevo', 'nueva'), A('rojo', 'roja')]),
    lapiz: N('lápiz', 'm', [A('azul'), A('nuevo', 'nueva')], { pl: 'lápices' }),
    llave: N('llave', 'f', [A('pequeño', 'pequeña'), A('dorado', 'dorada')]),
    mochila: N('mochila', 'f', [A('nuevo', 'nueva'), A('pesado', 'pesada'), A('azul')]),
    juguete: N('juguete', 'm', [A('favorito', 'favorita'), A('nuevo', 'nueva')]),
    pelota: N('pelota', 'f', [A('rojo', 'roja'), A('pequeño', 'pequeña'), A('nuevo', 'nueva')]),
    foto: N('foto', 'f', [A('antiguo', 'antigua'), A('divertido', 'divertida')]),
    pelicula: N('película', 'f', [A('divertido', 'divertida'), A('interesante'), A('largo', 'larga')]),
    cancion: N('canción', 'f', [A('alegre'), A('bonito', 'bonita'), A('nuevo', 'nueva')], { pl: 'canciones' }),
    manzana: N('manzana', 'f', [A('rojo', 'roja'), A('verde'), A('maduro', 'madura')]),
    galleta: N('galleta', 'f', [A('crujiente'), A('casero', 'casera')]),
    bocadillo: N('bocadillo', 'm', [A('enorme'), A('rico', 'rica')]),
    sopa: N('sopa', 'f', [A('caliente'), A('rico', 'rica')], { masa: true }),
    zanahoria: N('zanahoria', 'f', [A('fresco', 'fresca'), A('grande')]),
    cena: N('cena', 'f', [A('rico', 'rica')], { masa: true }),
    maleta: N('maleta', 'f', [A('grande'), A('pesado', 'pesada')]),
};

// Lugares (solo con artículo) y sus adjetivos
const LUGARES = {
    parque: N('parque', 'm', [A('tranquilo', 'tranquila'), A('cercano', 'cercana')]),
    playa: N('playa', 'f', [A('tranquilo', 'tranquila'), A('solitario', 'solitaria')]),
    calle: N('calle', 'f', [A('principal'), A('estrecho', 'estrecha')]),
    bosque: N('bosque', 'm', [A('frondoso', 'frondosa'), A('cercano', 'cercana')]),
    escuela: N('escuela', 'f', []),
    campo: N('campo', 'm', []),
    patio: N('patio', 'm', [A('grande')]),
    jardin: N('jardín', 'm', [A('precioso', 'preciosa')], { pl: 'jardines' }),
    sofa: N('sofá', 'm', [A('cómodo', 'cómoda')], { pl: 'sofás' }),
    charco: N('charco', 'm', [A('enorme')]),
    piscina: N('piscina', 'f', [A('municipal')]),
    rio: N('río', 'm', [A('cercano', 'cercana')]),
    mar: N('mar', 'm', []),
    fiesta: N('fiesta', 'f', [A('divertido', 'divertida')], { indef: true }),
    escenario: N('escenario', 'm', [A('grande')]),
    salon: N('salón', 'm', [A('grande')], { pl: 'salones' }),
    arbol: N('árbol', 'm', [A('alto', 'alta')]),
    habitacion: N('habitación', 'f', [], { pl: 'habitaciones' }),
    pueblo: N('pueblo', 'm', [A('pequeño', 'pequeña'), A('tranquilo', 'tranquila')], { indef: true }),
    ciudad: N('ciudad', 'f', [A('grande'), A('ruidoso', 'ruidosa')], { indef: true }),
    montana: N('montaña', 'f', [A('alto', 'alta')]),
};

// ── Determinantes ───────────────────────────────────────────────────
const DETS = {
    def: { sub: 'artículo', f: { ms: 'el', fs: 'la', mp: 'los', fp: 'las' } },
    indef: { sub: 'artículo', f: { ms: 'un', fs: 'una', mp: 'unos', fp: 'unas' } },
    este: { sub: 'demostrativo', f: { ms: 'este', fs: 'esta', mp: 'estos', fp: 'estas' } },
    ese: { sub: 'demostrativo', f: { ms: 'ese', fs: 'esa', mp: 'esos', fp: 'esas' } },
    aquel: { sub: 'demostrativo', f: { ms: 'aquel', fs: 'aquella', mp: 'aquellos', fp: 'aquellas' } },
    mi: { sub: 'posesivo', f: { ms: 'mi', fs: 'mi', mp: 'mis', fp: 'mis' } },
    tu: { sub: 'posesivo', f: { ms: 'tu', fs: 'tu', mp: 'tus', fp: 'tus' } },
    vuestro: { sub: 'posesivo', f: { ms: 'vuestro', fs: 'vuestra', mp: 'vuestros', fp: 'vuestras' } },
    su: { sub: 'posesivo', f: { ms: 'su', fs: 'su', mp: 'sus', fp: 'sus' } },
    nuestro: { sub: 'posesivo', f: { ms: 'nuestro', fs: 'nuestra', mp: 'nuestros', fp: 'nuestras' } },
    dos: { sub: 'numeral', f: { mp: 'dos', fp: 'dos' } },
    tres: { sub: 'numeral', f: { mp: 'tres', fp: 'tres' } },
    algunos: { sub: 'indefinido', f: { mp: 'algunos', fp: 'algunas' } },
    varios: { sub: 'indefinido', f: { mp: 'varios', fp: 'varias' } },
    muchos: { sub: 'indefinido', f: { mp: 'muchos', fp: 'muchas' } },
};
// Posesivo que corresponde a la persona del sujeto (yo → mi, nosotros → nuestro…)
const POSESIVO_DE = ['mi', 'tu', 'su', 'nuestro', 'vuestro', 'su'];
const det = (clave, g, num) => ({ t: DETS[clave].f[g + num], cat: 'DET', sub: DETS[clave].sub });

// ── Verbos ──────────────────────────────────────────────────────────
//  suj: 'p' (personas) + claves de ANIMALES que también lo hacen
//  obj: complementos directos (personas) · objAnimal: los de animales
//  donde: 'prep lugar' (· '|p' = solo personas) · modo / lugarAdv: adverbios con sentido
//  causas: claves de CAUSAS para «porque…»
const VERBOS = {
    leer: { posesivo: true, suj: ['p'], obj: ['libro', 'cuento', 'revista', 'carta', 'poema'], modo: ['atentamente', 'despacio'] },
    escribir: { suj: ['p'], obj: ['carta', 'poema', 'cuento', 'mensaje', 'redaccion'], modo: ['cuidadosamente', 'despacio'] },
    estudiar: { suj: ['p'], obj: ['leccion', 'tema'], modo: ['atentamente'], causas: ['examen'] },
    dibujar: { suj: ['p'], obj: ['casa', 'arbol', 'flor', 'paisaje', 'mapa'], modo: ['cuidadosamente'] },
    pintar: { suj: ['p'], obj: ['cuadro', 'pared', 'puerta', 'valla'], modo: ['cuidadosamente'] },
    comprar: { suj: ['p'], obj: ['pan', 'fruta', 'camiseta', 'regalo', 'bicicleta', 'lapiz'] },
    preparar: { posesivo: true, suj: ['p'], obj: ['cena', 'mochila', 'maleta'], modo: ['tranquilamente'] },
    buscar: { posesivo: true, suj: ['p', 'perro'], obj: ['llave', 'mochila', 'lapiz', 'juguete', 'pelota'], objAnimal: ['pelota', 'juguete'] },
    abrir: { posesivo: true, suj: ['p'], obj: ['puerta', 'ventana', 'caja', 'regalo'], modo: ['despacio'], causas: ['calor', 'cumple'] },
    mirar: { posesivo: true, suj: ['p'], obj: ['foto', 'cuadro', 'mapa', 'paisaje', 'pelicula'], modo: ['atentamente'] },
    comer: { suj: ['p', 'conejo', 'caballo'], obj: ['manzana', 'galleta', 'bocadillo', 'sopa', 'pan', 'fruta'], objAnimal: ['zanahoria', 'manzana'], modo: ['despacio', 'tranquilamente'], causas: ['hambre'] },
    cantar: {
        suj: ['p', 'pajaro'], obj: ['cancion'], donde: ['en fiesta|p', 'sobre escenario|p', 'en salon|p', 'en jardin', 'en arbol'],
        modo: ['bien', 'alegremente'], causas: ['contento'],
    },
    correr: {
        suj: ['p', 'perro', 'caballo', 'conejo', 'gata'], donde: ['por parque', 'por playa', 'por campo', 'hacia escuela|p', 'por calle|p'],
        modo: ['rápidamente', 'deprisa'], cantidad: true, causas: ['tarde'],
    },
    caminar: { suj: ['p'], donde: ['por parque', 'por playa', 'por calle', 'hacia escuela', 'por bosque'], modo: ['despacio', 'tranquilamente'], cantidad: true, causas: ['buenTiempo', 'sol'] },
    pasear: { suj: ['p', 'perro'], donde: ['por parque', 'por playa', 'por bosque', 'por calle|p'], modo: ['tranquilamente', 'despacio'], causas: ['buenTiempo', 'sol'] },
    saltar: { suj: ['p', 'perro', 'gata', 'conejo'], donde: ['en patio', 'sobre charco|p', 'en jardin', 'sobre sofa'], modo: ['alegremente'], causas: ['contento'] },
    nadar: { suj: ['p', 'perro'], donde: ['en piscina', 'en rio', 'en mar|p'], modo: ['bien', 'rápidamente'], cantidad: true, causas: ['calor'] },
    bailar: { suj: ['p'], donde: ['en fiesta', 'sobre escenario', 'en salon', 'en plaza'], modo: ['bien', 'alegremente'], cantidad: true, causas: ['contento', 'cumple'] },
    descansar: { suj: ['p', 'perro', 'gata', 'caballo'], donde: ['en sofa', 'en jardin', 'bajo arbol', 'en habitacion|p'], modo: ['tranquilamente'], lugarAdv: ['aquí', 'allí'], causas: ['cansado'] },
    vivir: { suj: ['p', 'pajaro'], donde: ['en pueblo|p', 'en ciudad|p', 'cerca_de playa|p', 'cerca_de montana|p', 'en bosque'], lugarAdv: ['cerca', 'lejos', 'aquí'] },
};
LUGARES.plaza = N('plaza', 'f', [A('mayor')]);

const TERM = {
    presente: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
    imperfecto: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
    futuro: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
};
const IRREG = {
    tener: { presente: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], futuro: 'tendr' },
    estar: { presente: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'] },
    hacer: { presente: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'], futuro: 'har' },
    ser: { presente: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], imperfecto: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'] },
};
function conjugar(inf, tiempo, persona) {
    const irr = IRREG[inf];
    if (irr?.[tiempo] && Array.isArray(irr[tiempo])) return irr[tiempo][persona];
    if (tiempo === 'futuro') return (irr?.futuro || inf) + TERM.futuro[persona];
    return inf.slice(0, -2) + TERM[tiempo][inf.slice(-2)][persona];
}
const V = (inf, tiempo, persona) => ({ t: conjugar(inf, tiempo, persona), cat: 'VERB' });

// Causas para «porque…» (concuerdan con el sujeto)
const CAUSAS = {
    hambre: (s, ti) => [V('tener', ti, s.persona), { t: 'hambre', cat: 'SUST' }],
    examen: (s, ti) => [V('tener', ti, s.persona), det('indef', 'm', 's'), { t: 'examen', cat: 'SUST' }],
    tarde: (s, ti) => [V('llegar', ti, s.persona), { t: 'tarde', cat: 'ADV', sub: 'de tiempo' }],
    cansado: (s, ti) => [V('estar', ti, s.persona), { t: formaAdj(A('cansado', 'cansada'), s.g, s.num), cat: 'ADJ' }],
    contento: (s, ti) => [V('estar', ti, s.persona), { t: formaAdj(A('contento', 'contenta'), s.g, s.num), cat: 'ADJ' }],
    calor: (s, ti) => [V('hacer', ti, 2), { t: 'calor', cat: 'SUST' }],
    sol: (s, ti) => [V('hacer', ti, 2), { t: 'sol', cat: 'SUST' }],
    buenTiempo: (s, ti) => [V('hacer', ti, 2), { t: 'buen', cat: 'ADJ' }, { t: 'tiempo', cat: 'SUST' }],
    cumple: (s, ti) => [V('ser', ti, 2), det(s.persona === 0 ? 'mi' : 'su', 'm', 's'), { t: 'cumpleaños', cat: 'SUST' }],
};

const ADV_INICIO = { presente: ['hoy', 'ahora'], imperfecto: ['antes', 'entonces'], futuro: ['mañana', 'pronto'] };
const ADV_TIEMPO = {
    presente: ['hoy', 'ahora', 'siempre'],
    imperfecto: ['antes', 'siempre', 'entonces'],
    futuro: ['mañana', 'pronto', 'luego'],
};

// Pronombres personales sujeto: [forma, persona(0-5), género, número]
const PRONOMBRES = [['yo', 0, null, 's'], ['tú', 1, null, 's'], ['él', 2, 'm', 's'], ['ella', 2, 'f', 's'], ['nosotros', 3, 'm', 'p'],
    ['nosotras', 3, 'f', 'p'], ['vosotros', 4, 'm', 'p'], ['vosotras', 4, 'f', 'p'], ['ellos', 5, 'm', 'p'], ['ellas', 5, 'f', 'p']];

// ── Sintagmas ───────────────────────────────────────────────────────
// Adjetivos que admiten «muy / bastante» (los colores, «nevado», «municipal»… no)
const GRADUABLES = new Set(['simpático', 'amable', 'alegre', 'valiente', 'curioso', 'divertido', 'tranquilo', 'alto', 'trabajador', 'generoso',
    'pequeño', 'travieso', 'hambriento', 'interesante', 'antiguo', 'corto', 'largo', 'bonito', 'importante', 'difícil', 'grande', 'pesado',
    'tierno', 'crujiente', 'fresco', 'rico', 'caliente', 'cómodo', 'cercano', 'estrecho', 'ruidoso', 'frondoso', 'original', 'triste', 'precioso']);
function adjetivo(n, num, eso, prob) {
    if (!n.adj.length || !chance(prob)) return [];
    const a = rnd(n.adj);
    const out = [];
    if (eso && GRADUABLES.has(a.m) && chance(0.25)) out.push({ t: rnd(['muy', 'bastante']), cat: 'ADV', sub: 'de cantidad' });
    out.push({ t: formaAdj(a, n.g, num), cat: 'ADJ' });
    return out;
}

function sujeto({ eso, animalesPosibles }) {
    // Pronombre personal (solo ESO)
    if (eso && chance(0.3)) {
        const [t, persona, g, num] = rnd(PRONOMBRES);
        return { toks: [{ t, cat: 'PRON', sub: 'personal' }], persona, g: g || rnd(['m', 'f']), num, tipo: 'p' };
    }
    // Nombre propio
    if (chance(0.2)) {
        const [t, g] = rnd(NOMBRES);
        return { toks: [{ t, cat: 'SUST' }], persona: 2, g, num: 's', tipo: 'p' };
    }
    // Animal (si el verbo lo admite)
    const esAnimal = animalesPosibles.length && chance(0.3);
    const tipo = esAnimal ? rnd(animalesPosibles) : 'p';
    const n = esAnimal ? ANIMALES[tipo] : rnd(PERSONAS);
    const num = chance(0.35) ? 'p' : 's';
    let claves = num === 'p' ? ['def', 'def', 'este', 'aquel', 'algunos', 'varios', 'dos', 'tres'] : ['def', 'def', 'def', 'indef', 'este', 'ese', 'aquel'];
    if (n.familia) claves = num === 'p' ? ['mi', 'su', 'nuestro', 'dos', 'tres'] : ['mi', 'su', 'nuestro'];
    else if (n.pos) claves = [...claves, 'mi', 'su', 'nuestro'];
    const toks = [det(rnd(claves), n.g, num), { t: num === 'p' ? plural(n) : n.s, cat: 'SUST' }, ...adjetivo(n, num, eso, 0.45)];
    return { toks, persona: num === 'p' ? 5 : 2, g: n.g, num, tipo };
}

function complementoDirecto(clave, eso, posesivo) {
    const n = OBJ[clave];
    const num = !n.masa && chance(0.25) ? 'p' : 's';
    let claves;
    if (n.masa) claves = ['def', 'def', 'este'];
    else if (num === 'p') claves = ['def', 'def', 'indef', 'dos', 'tres', 'algunos', 'este'];
    else claves = ['def', 'def', 'indef', 'indef', 'este', 'ese', 'aquel'];
    if (posesivo && !n.masa) claves = [...claves, posesivo, posesivo];
    return [det(rnd(claves), n.g, num), { t: num === 'p' ? plural(n) : n.s, cat: 'SUST' }, ...adjetivo(n, num, eso, 0.5)];
}

function complementoLugar(entrada, eso) {
    const [prep, clave] = entrada.split('|')[0].split(' ');
    const n = LUGARES[clave];
    const toks = prep === 'cerca_de'
        ? [{ t: 'cerca', cat: 'ADV', sub: 'de lugar' }, { t: 'de', cat: 'PREP' }]
        : [{ t: prep, cat: 'PREP' }];
    toks.push(det(n.indef && chance(0.4) ? 'indef' : 'def', n.g, 's'), { t: n.s, cat: 'SUST' }, ...adjetivo(n, 's', eso, 0.3));
    return toks;
}

// Predicado (sin sujeto). Devuelve null si el verbo no admite ese sujeto.
function predicado(vClave, suj, { eso, tiempo, negar = false, conAdverbio = true, sinTambien = false }) {
    const v = VERBOS[vClave];
    const toks = [];
    if (negar) toks.push({ t: 'no', cat: 'ADV', sub: 'de negación' });
    else if (eso && !sinTambien && chance(0.07)) toks.push({ t: 'también', cat: 'ADV', sub: 'de afirmación' });
    toks.push(V(vClave, tiempo, suj.persona));
    const posVerbo = toks.length;

    const esPersona = suj.tipo === 'p';
    const objs = esPersona ? v.obj : v.objAnimal;
    const donde = (v.donde || []).filter(d => esPersona || !d.endsWith('|p'));
    let usado = null;
    if (objs?.length && (!donde.length || chance(0.6))) { toks.push(...complementoDirecto(rnd(objs), eso, v.posesivo ? POSESIVO_DE[suj.persona] : null)); usado = 'cd'; }
    else if (eso && conAdverbio && !negar && (v.cantidad || v.lugarAdv) && chance(0.25)) {
        const solos = [...(v.lugarAdv || []).map(t => ({ t, cat: 'ADV', sub: 'de lugar' })), ...(v.cantidad ? [{ t: rnd(['mucho', 'poco']), cat: 'ADV', sub: 'de cantidad' }] : [])];
        toks.push(rnd(solos)); usado = 'adv';
    } else if (donde.length) { toks.push(...complementoLugar(rnd(donde), eso)); usado = 'lugar'; }

    // Un solo adverbio final como mucho, y solo si encaja con el verbo
    if (eso && conAdverbio && !negar && usado !== 'adv' && chance(0.3)) {
        const finales = [];
        if (!usado && v.lugarAdv) finales.push(...v.lugarAdv.map(t => ({ t, cat: 'ADV', sub: 'de lugar' })));
        if (!usado && v.cantidad) finales.push({ t: rnd(['mucho', 'poco']), cat: 'ADV', sub: 'de cantidad' });
        if (v.modo && (!finales.length || chance(0.4))) toks.splice(posVerbo, 0, { t: rnd(v.modo), cat: 'ADV', sub: 'de modo' });
        else if (finales.length) toks.push(rnd(finales));
    }
    return toks;
}

const verbosPara = (tipo, excluir) => Object.keys(VERBOS).filter(k => k !== excluir && VERBOS[k].suj.includes(tipo));

// ── Frase completa ──────────────────────────────────────────────────
export function generarFrase({ nivel = 'eso' } = {}) {
    const eso = nivel !== 'primaria';
    const tiempo = rnd(['presente', 'presente', 'imperfecto', 'futuro']);

    // Primer verbo y sujeto compatible
    const v1 = rnd(Object.keys(VERBOS));
    const animalesPosibles = VERBOS[v1].suj.filter(s => s !== 'p');
    const suj = sujeto({ eso, animalesPosibles });
    const vPrimero = VERBOS[v1].suj.includes(suj.tipo) ? v1 : rnd(verbosPara(suj.tipo));

    // ¿Oración compuesta? (solo ESO)
    let nexo = null;
    if (eso && chance(0.45)) {
        const r = Math.random();
        nexo = r < 0.35 ? 'y' : r < 0.6 ? 'pero' : r < 0.7 ? 'o' : 'porque';
        if (nexo === 'porque' && !VERBOS[vPrimero].causas) nexo = 'y';
    }
    const negar1 = eso && !nexo && chance(0.15);

    // Adverbio de tiempo al principio de vez en cuando
    const toks = [];
    const advInicio = eso && chance(0.2);
    if (advInicio) toks.push({ t: rnd(ADV_INICIO[tiempo]), cat: 'ADV', sub: 'de tiempo' });
    toks.push(...suj.toks);
    toks.push(...predicado(vPrimero, suj, { eso, tiempo, negar: negar1, conAdverbio: !nexo, sinTambien: advInicio }));

    if (nexo === 'porque') {
        toks.push({ t: 'porque', cat: 'CONJ', sub: 'causal' });
        toks.push(...CAUSAS[rnd(VERBOS[vPrimero].causas)](suj, tiempo));
    } else if (nexo) {
        const v2 = rnd(verbosPara(suj.tipo, vPrimero));
        if (nexo === 'pero') toks.push({ t: ',', cat: null });
        toks.push({ t: nexo, cat: 'CONJ', sub: { y: 'copulativa', o: 'disyuntiva', pero: 'adversativa' }[nexo] });
        toks.push(...predicado(v2, suj, { eso, tiempo, negar: nexo === 'pero' }));
    } else if (eso && !advInicio && chance(0.2)) {
        toks.push({ t: rnd(ADV_TIEMPO[tiempo]), cat: 'ADV', sub: 'de tiempo' });
    }

    toks[0] = { ...toks[0], t: toks[0].t[0].toUpperCase() + toks[0].t.slice(1) };
    return [...toks, { t: '.', cat: null }];
}

// Genera frases hasta encontrar una que contenga la clase pedida.
export function generarFraseCon(cat, opts) {
    for (let i = 0; i < 60; i++) {
        const f = generarFrase(opts);
        if (!cat || f.some(t => t.cat === cat)) return f;
    }
    return generarFrase(opts);
}
