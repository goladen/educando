// ─────────────────────────────────────────────────────────────────────────────
//  Recursos PiKT: las preguntas de 4 opciones que ya hay en las herramientas
//  (Trivial de Primaria, general y experto + bancos de Invasión Pi, Bunker,
//  Plataformas y Luz roja · Luz verde, e Inglés de ESO por contenidos, en
//  bancoPreguntas/datos/) convertidas
//  en «recursos virtuales» por ETAPA y MATERIA, con el formato de cada juego:
//    · quiz       → { pregunta, respuesta, incorrectas[3] }   (Burbujas, Pikatron,
//                   Calamar, Money Board, Bunker, Invasión Pi…)
//    · pasapalabra→ { letra, pregunta: 'Empieza por X: …', respuesta }
//    · parejas    → { terminoA, terminoB }                    (AparejaDOS, cartas)
//  Se AÑADEN detrás de los recursos de los profesores (nunca los sustituyen).
//  Los datos se cargan con import dinámico la primera vez que se piden.
//  Id: 'pikt--<TIPOJUEGO>--<etapa>--<materia>' (sirve para el enlace ?r=).
// ─────────────────────────────────────────────────────────────────────────────

export const PREFIJO_PIKT = 'pikt--';
export const esRecursoPikt = (r) => !!r && (r.esPikt === true || String(r.id || '').startsWith(PREFIJO_PIKT));

const ETAPAS = {
    pri:  { label: 'Primaria',     ciclo: 'Primaria' },
    eso:  { label: 'ESO',          ciclo: 'Secundaria' },
    bach: { label: 'Bachillerato', ciclo: 'Bachillerato' },
};
const ORDEN_ETAPAS = ['pri', 'eso', 'bach'];

const MATERIAS = {
    matematicas:  { label: 'Matemáticas',        emoji: '🔢' },
    geografia:    { label: 'Geografía',          emoji: '🌍' },
    historia:     { label: 'Historia',           emoji: '🏛️' },
    ciencias:     { label: 'Ciencias',           emoji: '🔬' },
    biologia:     { label: 'Biología',           emoji: '🧬' },
    fyq:          { label: 'Física y Química',   emoji: '⚗️' },
    ingles:       { label: 'Inglés',             emoji: '🇬🇧' },
    frances:      { label: 'Francés',            emoji: '🇫🇷' },
    arte:         { label: 'Arte y Literatura',  emoji: '🎨' },
    espectaculos: { label: 'Cine, música y TV',  emoji: '🎬' },
    deportes:     { label: 'Deportes',           emoji: '⚽' },
};
const CAT_TRIVIAL = { geo: 'geografia', his: 'historia', cie: 'ciencias', art: 'arte', esp: 'espectaculos', dep: 'deportes' };
const BANCO_INVASORES = { INGLES: 'ingles', GEOGRAFIA: 'geografia', BIOLOGIA: 'biologia', CIENCIAS: 'fyq' };
// Bancos propios de los juegos (bancoPreguntas/datos/): [materia, etapa]
const BANCO_BUNKER = { MATES: ['matematicas', 'eso'], GEO: ['geografia', 'pri'], ENG: ['ingles', 'pri'], CIEN: ['ciencias', 'pri'] };
const BANCO_PLATAFORMAS = { INGLES: 'ingles', MATES: 'matematicas', FRANCES: 'frances', GEOGRAFIA: 'geografia' }; // todo Primaria
// Inglés de Primaria por temas (así en Money Board cada tema es una categoría, como en ESO).
// Plataformas: cada nivel es un tema; Bunker: según el enunciado.
const TEMAS_PLATAFORMAS_INGLES = ['Animales y colores', 'Comida y bebida', 'La familia', 'Verbos de acción'];
const temaInglesPri = (q) => {
    const t = norm(q);
    if (/plural|pasado|articulo/.test(t)) return 'Gramática: plurales y pasados';
    if (/perro|gato|pajaro|rojo|azul|verde|color/.test(t)) return 'Animales y colores';
    if (/manzana|agua|pan|leche|queso|comida/.test(t)) return 'Comida y bebida';
    return 'Días, números y más';
};
// Banco libre de Luz roja (mezclado): materia según el enunciado
const materiaPorTexto = (q) => {
    const t = norm(q);
    if (/cuanto es|raiz|%|×|\d\s*:\s*\d|numero|mayor/.test(t)) return 'matematicas';
    if (/capital|oceano|rio |rio$|continente|pais/.test(t)) return 'geografia';
    if (/ingles|pasado simple|"go"/.test(t)) return 'ingles';
    if (/organo|hueso|sangre|celula/.test(t)) return 'biologia';
    if (/quimic|formula|planeta|sol\b/.test(t)) return 'fyq';
    return null;
};

// Juegos que pueden usar estas preguntas y con qué formato
export const FORMATO_JUEGO = {
    CAZABURBUJAS: 'quiz', PIKATRON: 'quiz', PASAPALABRA: 'pasapalabra', APAREJADOS: 'parejas',
};
export const juegoAdmitePikt = (tipoJuego) => !!FORMATO_JUEGO[tipoJuego];

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ── Carga y unificación de los bancos ───────────────────────────────────────
let promesaPreguntas = null;
/** [{ pregunta, respuesta, incorrectas[3], etapa, materia }] sin duplicados. */
export function cargarPreguntasPikt() {
    if (!promesaPreguntas) {
        promesaPreguntas = Promise.all([
            import('../preguntas_trivial_primaria.json'),
            import('../preguntas_trivial.json'),
            import('../preguntas_trivial_super.json'),
            import('../invasores/preguntas.js'),
            import('./datos/bunker.js'),
            import('./datos/plataformas.js'),
            import('./datos/calamar.js'),
            import('./datos/inglesEso.js'),
        ]).then(([pri, eso, bach, inv, bunker, plataformas, calamar, inglesEso]) => {
            const out = [];
            const vistos = new Set();
            // extra: { tema, curso, rellenar } (rellenar = la pregunta es una frase con un hueco «___»)
            const meter = (etapa, materia, pregunta, respuesta, incorrectas, extra = {}) => {
                pregunta = String(pregunta ?? '').trim(); respuesta = String(respuesta ?? '').trim();
                const mal = (incorrectas || []).map(x => String(x ?? '').trim()).filter(x => x && norm(x) !== norm(respuesta));
                if (!pregunta || !respuesta || mal.length < 3) return; // solo las de 4 opciones
                const clave = `${etapa}|${materia}|${norm(pregunta)}`;
                if (vistos.has(clave)) return;
                vistos.add(clave);
                const p = { pregunta, respuesta, incorrectas: mal.slice(0, 3), etapa, materia };
                if (extra.tema) p.tema = extra.tema;
                if (extra.curso) p.curso = extra.curso;
                if (extra.rellenar && pregunta.split('___').length === 2) {
                    const [antes, despues] = pregunta.split('___');
                    p.bloques = [antes.trim(), respuesta, despues.trim()];
                }
                out.push(p);
            };
            // Inglés de ESO por contenidos (temas y cursos)
            (inglesEso.INGLES_ESO || []).forEach(({ tema, curso, preguntas }) => {
                (preguntas || []).forEach(([tipo, q, ok, mal]) => meter('eso', 'ingles', q, ok, mal, { tema, curso, rellenar: tipo === 'r' }));
            });
            [['pri', pri], ['eso', eso], ['bach', bach]].forEach(([etapa, mod]) => {
                const datos = mod.default || mod;
                Object.entries(datos).forEach(([cat, lista]) => {
                    const materia = CAT_TRIVIAL[cat];
                    if (!materia) return;
                    (lista || []).forEach(p => {
                        if (p.tipo && p.tipo !== 'SELECCION') return;
                        meter(etapa, materia, p.q, p.a, p.w);
                    });
                });
            });
            Object.entries(inv.BANCOS || {}).forEach(([clave, banco]) => {
                const materia = BANCO_INVASORES[clave];
                if (!materia) return;
                (banco.preguntas || []).forEach(([q, ok, mal]) => meter('eso', materia, q, ok, mal));
            });
            Object.entries(bunker.BANCOS_BUNKER || {}).forEach(([clave, banco]) => {
                const [materia, etapa] = BANCO_BUNKER[clave] || [];
                if (materia) (banco.preguntas || []).forEach(p => meter(etapa, materia, p.q, p.ok, p.mal,
                    materia === 'ingles' && etapa === 'pri' ? { tema: temaInglesPri(p.q) } : {}));
            });
            Object.entries(plataformas.MATERIAS_PLATAFORMAS || {}).forEach(([clave, m]) => {
                const materia = BANCO_PLATAFORMAS[clave];
                if (!materia) return;
                (m.niveles || []).forEach((nivel, i) => (nivel || []).forEach(p => meter('pri', materia, p.q, p.a, p.inc,
                    materia === 'ingles' ? { tema: TEMAS_PLATAFORMAS_INGLES[i] || temaInglesPri(p.q) } : {})));
            });
            (calamar.BANCO_LIBRE_CALAMAR || []).forEach(p => {
                const materia = materiaPorTexto(p.pregunta);
                if (materia) meter('eso', materia, p.pregunta, p.correcta, p.incorrectas);
            });
            return out;
        }).catch(e => { promesaPreguntas = null; throw e; });
    }
    return promesaPreguntas;
}

// ── Conversión al formato de cada juego ─────────────────────────────────────
const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const letraInicial = (txt) => {
    const t = String(txt).trim().replace(/^(el|la|los|las|un|una)\s+/i, '');
    const c = t.charAt(0).toUpperCase();
    if (c === 'Ñ') return 'Ñ';
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return LETRAS.includes(base) ? base : null;
};
const sinTildes = (s) => String(s).toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ');

// En el rosco la respuesta se escribe: sin artículo inicial y como mucho 3 palabras
const respuestaRosco = (r) => String(r).trim().replace(/^(el|la|los|las|un|una)\s+/i, '');

function aPasapalabra(preguntas) {
    const cortas = preguntas
        .map(p => ({ ...p, respuesta: respuestaRosco(p.respuesta) }))
        .filter(p => p.respuesta.length <= 30 && !/^\d/.test(p.respuesta) && !/^por\s/i.test(p.respuesta)
            && p.respuesta.split(/\s+/).length <= 3 && !/[()]/.test(p.respuesta));
    const out = [];
    const conLetra = new Set();
    cortas.forEach(p => {
        const l = letraInicial(p.respuesta);
        if (!l) return;
        conLetra.add(l);
        out.push({ letra: l, pregunta: `Empieza por ${l}: ${p.pregunta}`, respuesta: p.respuesta });
    });
    // Letras sin ninguna respuesta que empiece por ellas → «Contiene la X»
    LETRAS.filter(l => !conLetra.has(l)).forEach(l => {
        const p = cortas.find(x => sinTildes(x.respuesta).includes(l));
        if (p) out.push({ letra: l, pregunta: `Contiene la ${l}: ${p.pregunta}`, respuesta: p.respuesta });
    });
    return out;
}

// opts.rellenar: el juego sabe pedir que se ESCRIBA la palabra del hueco (tipo RELLENAR de
// utils/normalizarPreguntas: Money Board, Luz roja, Invasión Pi). Si no, la frase con «___» se
// juega como opción múltiple (Pikatron, Burbujas, Bunker…).
const aFormato = (formato, preguntas, opts = {}) => {
    if (formato === 'pasapalabra') return aPasapalabra(preguntas);
    if (formato === 'parejas') return preguntas
        .filter(p => p.pregunta.length <= 90 && p.respuesta.length <= 30)
        .map(p => ({ terminoA: p.pregunta, terminoB: p.respuesta }));
    return preguntas.map(p => (opts.rellenar && p.bloques
        ? { tipo: 'RELLENAR', pregunta: 'Complete the sentence', bloques: p.bloques, respuesta: p.respuesta, incorrectas: p.incorrectas }
        : { pregunta: p.pregunta, respuesta: p.respuesta, incorrectas: p.incorrectas }));
};

// Hojas de un conjunto de preguntas: una por tema si las preguntas traen tema; si no, una sola
const hojasPorTema = (preguntas, nombreSinTema, formato, opts) => {
    const conTema = preguntas.some(p => p.tema);
    if (!conTema) {
        const lista = aFormato(formato, preguntas, opts);
        return lista.length ? [{ nombreHoja: nombreSinTema, preguntas: lista }] : [];
    }
    const orden = [];
    const grupos = {};
    preguntas.forEach(p => {
        const t = p.tema || 'Vocabulario y repaso';
        if (!grupos[t]) { grupos[t] = []; orden.push(t); }
        grupos[t].push(p);
    });
    return orden.map(t => ({ nombreHoja: t, preguntas: aFormato(formato, grupos[t], opts) }))
        .filter(h => h.preguntas.length > 0);
};

const recursoBase = (tipoJuego, etapa, materia, titulo, temas, hojas) => ({
    id: `${PREFIJO_PIKT}${tipoJuego}--${etapa}--${materia}`,
    esPikt: true,
    titulo,
    tipoJuego,
    temas,
    ciclo: ETAPAS[etapa].ciclo,
    etapaPikt: etapa,
    materiaPikt: materia,
    profesorNombre: 'PiKT',
    isFinished: true,
    isPrivate: false,
    playCount: 0,
    config: { aleatorio: true, numParejas: 8, isFinished: true },
    hojas,
});

/**
 * Recursos virtuales de PiKT para un juego.
 *  · Por cada etapa: uno por materia (una hoja) y uno «Todas las materias» (una hoja por materia,
 *    útil para Money Board o para jugar en «General»).
 *  · Pasapalabra: solo el de «Todas las materias» (un rosco necesita muchas letras).
 */
//  · Materias con temas y cursos (Inglés de ESO): el recurso de la materia tiene una hoja por tema
//    (en Money Board cada tema es una categoría) y además hay uno por curso (1.º, 2.º… ESO).
export async function recursosPikt(tipoJuego = 'CAZABURBUJAS', opts = {}) {
    const formato = FORMATO_JUEGO[tipoJuego] || 'quiz';
    const todas = await cargarPreguntasPikt();
    const out = [];
    ORDEN_ETAPAS.forEach(etapa => {
        const deEtapa = todas.filter(p => p.etapa === etapa);
        const hojas = [];
        Object.keys(MATERIAS).forEach(materia => {
            const deMateria = deEtapa.filter(p => p.materia === materia);
            const m = MATERIAS[materia];
            const preguntas = aFormato(formato, deMateria, opts);
            if (preguntas.length < 4) return;
            hojas.push({ nombreHoja: m.label, preguntas });
            if (formato === 'pasapalabra') return;
            out.push(recursoBase(tipoJuego, etapa, materia, `${m.emoji} ${m.label} · ${ETAPAS[etapa].label}`, m.label,
                hojasPorTema(deMateria, m.label, formato, opts)));
            // Un recurso por curso (si las preguntas lo indican)
            [...new Set(deMateria.map(p => p.curso).filter(Boolean))].sort().forEach(curso => {
                const hojasCurso = hojasPorTema(deMateria.filter(p => p.curso === curso), m.label, formato, opts);
                if (!hojasCurso.length) return;
                out.push(recursoBase(tipoJuego, etapa, `${materia}-c${curso}`, `${m.emoji} ${m.label} · ${curso}.º ${ETAPAS[etapa].label}`,
                    hojasCurso.map(h => h.nombreHoja).join(', '), hojasCurso));
            });
        });
        if (hojas.length >= 2) {
            out.push(recursoBase(tipoJuego, etapa, 'mezcla',
                `✨ ${formato === 'pasapalabra' ? 'Rosco' : 'Todas las materias'} · ${ETAPAS[etapa].label}`,
                hojas.map(h => h.nombreHoja).join(', '), hojas));
        }
    });
    return out;
}

/** Recurso virtual a partir de su id (enlace ?r=pikt--…). null si no existe. */
export async function recursoPiktPorId(id) {
    if (!String(id || '').startsWith(PREFIJO_PIKT)) return null;
    const [tipoJuego] = id.slice(PREFIJO_PIKT.length).split('--');
    const lista = await recursosPikt(tipoJuego);
    return lista.find(r => r.id === id) || null;
}

/** Aplica los filtros de los buscadores (texto de tema/título y ciclo) a los recursos PiKT. */
export function filtrarPikt(lista, { tema = '', ciclo = '' } = {}) {
    const t = norm(tema), c = norm(ciclo);
    return lista.filter(r => {
        if (c && norm(r.ciclo) !== c) return false;
        if (!t) return true;
        return [r.titulo, r.temas, ...(r.hojas || []).map(h => h.nombreHoja), 'pikt']
            .some(x => norm(x).includes(t) || t.split(/\s+/).every(w => norm(x).includes(w)));
    });
}

/** Lista de profes + recursos PiKT del juego detrás (sin romper si fallan los datos).
 *  opts.rellenar: el juego admite preguntas de escribir la palabra del hueco (tipo RELLENAR). */
export async function conRecursosPikt(listaProfes, tipoJuego, filtros = {}, opts = {}) {
    try { return [...listaProfes, ...filtrarPikt(await recursosPikt(tipoJuego, opts), filtros)]; }
    catch (e) { console.warn('[Recursos PiKT]', e); return listaProfes; }
}

/** Etiquetas de etapas y materias (para buscadores e importadores). */
export const ETIQUETAS_PIKT = { ETAPAS, MATERIAS };
