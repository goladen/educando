// ═══════════════════════════════════════════════════════════════════
//  EJERCICIOS DE LENGUA — catálogo de temas y generadores de preguntas
//  Cada ejercicio: { id, nombre, emoji, desc, config:[…], generar(cfg) }
//  Tipos de pregunta que devuelve generar():
//   · opciones  { instruccion, enunciado, opciones:[{v,label,color}], correcta, explicacion }
//   · cazar     { instruccion, tokens, objetivo, explicacion }
//   · emparejar { instruccion, pares:[[a,b]] }
//  enunciado: { tipo:'palabra'|'hueco'|'frase'|'texto', … }
// ═══════════════════════════════════════════════════════════════════
import { ACENTUACION, CLASES_ACENTO, GRUPOS_LETRAS, formaContraria, explicarTilde, quitarTildes } from './bancoOrtografia';
import { CLASES, CLASES_PRIMARIA, CLASES_ESO, SUBCLASES, generarFrase, generarFraseCon } from './generadorMorfologia';
import { SINONIMOS, ANTONIMOS, CAMPOS, FAMILIAS, REFRANES, partirRefran } from './bancoLexico';

export const rnd = (a) => a[Math.floor(Math.random() * a.length)];
export const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const tomar = (a, n, excluir = []) => barajar(a.filter(x => !excluir.includes(x))).slice(0, n);
const op = (v, label = v, color) => ({ v, label, color });
const unA = (cat) => (cat === 'PREP' || cat === 'CONJ' ? 'una' : 'un');

// ── ORTOGRAFÍA ──────────────────────────────────────────────────────
const poolAcento = (cfg) => ACENTUACION.filter(w => (cfg.clases || [1, 2, 3, 4]).includes(w.pos));

const ORTOGRAFIA = [
    {
        id: 'acento', nombre: 'Agudas, llanas y esdrújulas', emoji: '🎯',
        desc: 'Clasifica cada palabra según dónde está su sílaba tónica.',
        config: [
            { key: 'silabas', label: 'Ayuda', opciones: [{ v: true, l: '✂️ Mostrar sílabas' }, { v: false, l: '🙈 Sin ayuda' }], def: true },
            { key: 'clases', label: 'Clases', multi: true, opciones: [1, 2, 3, 4].map(i => ({ v: i, l: CLASES_ACENTO[i].label })), def: [1, 2, 3, 4] },
        ],
        generar(cfg) {
            const w = rnd(poolAcento(cfg));
            const tonica = w.sil[w.sil.length - w.pos];
            return {
                tipo: 'opciones', instruccion: '¿Qué clase de palabra es según su acentuación?',
                enunciado: { tipo: 'palabra', texto: w.palabra, silabas: cfg.silabas ? w.sil : null },
                opciones: (cfg.clases || [1, 2, 3, 4]).map(i => op(i, CLASES_ACENTO[i].label, CLASES_ACENTO[i].color)),
                correcta: w.pos,
                explicacion: `${w.sil.map(s => s === tonica ? s.toUpperCase() : s).join('-')} → la sílaba tónica es «${tonica}» (${['', 'última', 'penúltima', 'antepenúltima', 'anterior a la antepenúltima'][w.pos]}).`,
            };
        },
    },
    {
        id: 'tonica', nombre: 'Encuentra la sílaba tónica', emoji: '🔊',
        desc: 'Toca la sílaba que se pronuncia con más fuerza.',
        config: [],
        generar() {
            const w = rnd(ACENTUACION.filter(x => x.sil.length >= 2));
            const sil = w.sil.map(quitarTildes);
            const k = w.sil.length - w.pos;
            return {
                tipo: 'opciones', instruccion: '¿Cuál es la sílaba tónica?',
                enunciado: { tipo: 'texto', texto: quitarTildes(w.palabra), grande: true },
                opciones: sil.map((s, i) => op(i, s)), ordenFijo: true,
                correcta: k,
                explicacion: `La tónica de «${w.palabra}» es «${w.sil[k]}» → ${CLASES_ACENTO[w.pos].label.toLowerCase()}.`,
            };
        },
    },
    {
        id: 'tilde', nombre: '¿Lleva tilde?', emoji: '✍️',
        desc: 'Elige la forma bien escrita y repasa la regla general.',
        config: [
            { key: 'clases', label: 'Clases', multi: true, opciones: [1, 2, 3, 4].map(i => ({ v: i, l: CLASES_ACENTO[i].label })), def: [1, 2, 3, 4] },
        ],
        generar(cfg) {
            const w = rnd(poolAcento(cfg));
            return {
                tipo: 'opciones', instruccion: '¿Cuál está bien escrita?',
                enunciado: null,
                opciones: barajar([op(w.palabra), op(formaContraria(w))]),
                correcta: w.palabra, grandes: true,
                explicacion: explicarTilde(w),
            };
        },
    },
    {
        id: 'letras', nombre: 'Letras dudosas', emoji: '🔤',
        desc: 'b/v, g/j, h, ll/y, c/cc, c/z, m/n, r/rr: completa el hueco.',
        config: [
            { key: 'grupos', label: 'Letras', multi: true, opciones: GRUPOS_LETRAS.map(g => ({ v: g.id, l: g.label })), def: ['bv', 'gj', 'h', 'lly'] },
        ],
        generar(cfg) {
            const grupos = GRUPOS_LETRAS.filter(g => (cfg.grupos?.length ? cfg.grupos : ['bv']).includes(g.id));
            const g = rnd(grupos);
            const p = rnd(g.palabras);
            return {
                tipo: 'opciones', instruccion: `Completa con ${g.label}`,
                enunciado: { tipo: 'hueco', antes: p.antes, despues: p.despues },
                opciones: g.opciones.map(o => op(o, o === '—' ? '(nada)' : o, g.color)), ordenFijo: true,
                correcta: p.letra, grandes: true,
                explicacion: `Se escribe «${p.palabra}». ${g.regla}`,
                solucion: p.palabra,
            };
        },
    },
];

// ── MORFOLOGÍA ──────────────────────────────────────────────────────
const cfgNivel = { key: 'nivel', label: 'Nivel', opciones: [{ v: 'primaria', l: '🎒 Primaria (4 clases)' }, { v: 'eso', l: '🎓 ESO (8 clases)' }], def: 'primaria' };
const clasesDe = (nivel) => (nivel === 'eso' ? CLASES_ESO : CLASES_PRIMARIA);

const MORFOLOGIA = [
    {
        id: 'cazar', nombre: 'Caza la palabra', emoji: '🏹',
        desc: 'Frases infinitas: toca todas las palabras de la clase pedida.',
        config: [cfgNivel, { key: 'objetivo', label: 'Cazar', opciones: [{ v: 'AZAR', l: '🎲 Al azar' }, ...CLASES_ESO.map(c => ({ v: c, l: CLASES[c].label }))], def: 'AZAR' }],
        generar(cfg) {
            const permitidas = clasesDe(cfg.nivel);
            const obj = cfg.objetivo && cfg.objetivo !== 'AZAR' ? cfg.objetivo : rnd(permitidas);
            const nivel = permitidas.includes(obj) ? cfg.nivel : 'eso';
            const tokens = generarFraseCon(obj, { nivel });
            const lista = tokens.filter(t => t.cat === obj).map(t => t.t.toLowerCase());
            return {
                tipo: 'cazar', instruccion: `Caza ${lista.length > 1 ? (unA(obj) === 'una' ? 'todas las' : 'todos los') : (unA(obj) === 'una' ? 'la' : 'el')} ${lista.length > 1 ? CLASES[obj].plural : CLASES[obj].label.toLowerCase()}`,
                tokens, objetivo: obj, color: CLASES[obj].color,
                explicacion: `${CLASES[obj].plural[0].toUpperCase() + CLASES[obj].plural.slice(1)} de la frase: ${lista.join(', ')}.`,
            };
        },
    },
    {
        id: 'clase', nombre: '¿Qué clase de palabra es?', emoji: '🔎',
        desc: 'Mira la palabra resaltada y di a qué categoría gramatical pertenece.',
        config: [cfgNivel],
        generar(cfg) {
            const permitidas = clasesDe(cfg.nivel);
            const obj = rnd(permitidas);
            const tokens = generarFraseCon(obj, { nivel: cfg.nivel });
            const idxs = tokens.map((t, i) => (t.cat === obj ? i : -1)).filter(i => i >= 0);
            const k = rnd(idxs);
            const t = tokens[k];
            return {
                tipo: 'opciones', instruccion: '¿Qué clase de palabra es la resaltada?',
                enunciado: { tipo: 'frase', tokens, resaltar: k },
                opciones: permitidas.map(c => op(c, `${CLASES[c].emoji} ${CLASES[c].label}`, CLASES[c].color)), ordenFijo: true,
                correcta: obj,
                explicacion: `«${t.t}» es ${unA(obj)} ${CLASES[obj].label.toLowerCase()}${t.sub ? ` (${t.sub})` : ''}.`,
            };
        },
    },
    {
        id: 'tipos', nombre: 'Tipos de determinantes, adverbios y conjunciones', emoji: '🧩', soloEso: true,
        desc: 'Nivel ESO: clasifica la palabra resaltada dentro de su categoría.',
        config: [{ key: 'cat', label: 'Categoría', opciones: [{ v: 'TODAS', l: '🎲 Todas' }, { v: 'DET', l: 'Determinantes' }, { v: 'ADV', l: 'Adverbios' }, { v: 'CONJ', l: 'Conjunciones' }], def: 'TODAS' }],
        generar(cfg) {
            const cat = cfg.cat && cfg.cat !== 'TODAS' ? cfg.cat : rnd(['DET', 'DET', 'ADV', 'CONJ']);
            const tokens = generarFraseCon(cat, { nivel: 'eso' });
            const idxs = tokens.map((t, i) => (t.cat === cat ? i : -1)).filter(i => i >= 0);
            const k = rnd(idxs);
            const t = tokens[k];
            return {
                tipo: 'opciones', instruccion: `¿Qué tipo de ${CLASES[cat].label.toLowerCase()} es?`,
                enunciado: { tipo: 'frase', tokens, resaltar: k },
                opciones: SUBCLASES[cat].map(s => op(s, s, CLASES[cat].color)), ordenFijo: true,
                correcta: t.sub,
                explicacion: `«${t.t}» es ${unA(cat)} ${CLASES[cat].label.toLowerCase()} ${t.sub}.`,
            };
        },
    },
];

// ── SEMÁNTICA Y LÉXICO ──────────────────────────────────────────────
const cfgNivelLex = { key: 'nivel', label: 'Nivel', opciones: [{ v: 'p', l: '🎒 Primaria' }, { v: 'e', l: '🎓 ESO' }, { v: 'todo', l: '🎲 Todo' }], def: 'todo' };
const filtraNivel = (lista, nivel) => (nivel === 'p' || nivel === 'e' ? lista.filter(x => x[2] === nivel) : lista);

function preguntaPareja(lista, cfg, rel) {
    const pool = filtraNivel(lista, cfg.nivel);
    const par = rnd(pool);
    const [a, b] = Math.random() < 0.5 ? par : [par[1], par[0]];
    const otros = pool.filter(p => p !== par).flatMap(p => [p[0], p[1]]);
    return {
        tipo: 'opciones', instruccion: `¿Cuál es ${rel === 'sin' ? 'un sinónimo' : 'el antónimo'} de…?`,
        enunciado: { tipo: 'texto', texto: a, grande: true },
        opciones: barajar([op(b), ...tomar(otros, 3, [a, b]).map(x => op(x))]),
        correcta: b,
        explicacion: rel === 'sin' ? `«${a}» y «${b}» significan lo mismo o casi lo mismo.` : `«${a}» y «${b}» tienen significados opuestos.`,
    };
}

const LEXICO = [
    {
        id: 'sinonimos', nombre: 'Sinónimos', emoji: '🤝', desc: 'Palabras que significan lo mismo.',
        config: [cfgNivelLex], generar: (cfg) => preguntaPareja(SINONIMOS, cfg, 'sin'),
    },
    {
        id: 'antonimos', nombre: 'Antónimos', emoji: '↔️', desc: 'Palabras de significado contrario.',
        config: [cfgNivelLex], generar: (cfg) => preguntaPareja(ANTONIMOS, cfg, 'ant'),
    },
    {
        id: 'emparejar', nombre: 'Empareja a contrarreloj', emoji: '🃏', sinCompeticion: true,
        desc: 'Une cada palabra con su pareja (estilo AparejaDOS).',
        config: [{ key: 'rel', label: 'Relación', opciones: [{ v: 'sin', l: '🤝 Sinónimos' }, { v: 'ant', l: '↔️ Antónimos' }], def: 'sin' }, cfgNivelLex],
        generar(cfg) {
            const pool = filtraNivel(cfg.rel === 'ant' ? ANTONIMOS : SINONIMOS, cfg.nivel);
            return { tipo: 'emparejar', instruccion: `Une cada palabra con su ${cfg.rel === 'ant' ? 'antónimo' : 'sinónimo'}`, pares: tomar(pool, 6).map(p => [p[0], p[1]]) };
        },
    },
    {
        id: 'campos', nombre: 'Campos semánticos', emoji: '🗂️', desc: 'Agrupa palabras por su significado y encuentra el intruso.',
        config: [],
        generar() {
            const c = rnd(CAMPOS);
            if (Math.random() < 0.55) {
                const intruso = rnd(rnd(CAMPOS.filter(x => x !== c)).palabras);
                return {
                    tipo: 'opciones', instruccion: `¿Qué palabra NO pertenece al campo «${c.campo}»?`,
                    enunciado: { tipo: 'texto', texto: c.emoji, grande: true },
                    opciones: barajar([op(intruso), ...tomar(c.palabras, 3).map(x => op(x))]),
                    correcta: intruso,
                    explicacion: `«${intruso}» no es del campo semántico «${c.campo}».`,
                };
            }
            const muestra = tomar(c.palabras, 4);
            return {
                tipo: 'opciones', instruccion: '¿A qué campo semántico pertenecen estas palabras?',
                enunciado: { tipo: 'texto', texto: muestra.join(' · ') },
                opciones: barajar([op(c.campo, `${c.emoji} ${c.campo}`), ...tomar(CAMPOS.filter(x => x !== c), 3).map(x => op(x.campo, `${x.emoji} ${x.campo}`))]),
                correcta: c.campo,
                explicacion: `Son palabras del campo semántico «${c.campo}».`,
            };
        },
    },
    {
        id: 'familias', nombre: 'Familias de palabras', emoji: '🌳', desc: 'Palabras que comparten el mismo lexema… ¡y las que solo lo parecen!',
        config: [],
        generar() {
            const f = rnd(FAMILIAS);
            if (Math.random() < 0.5) {
                const buena = rnd(f.palabras);
                return {
                    tipo: 'opciones', instruccion: `¿Qué palabra es de la familia de «${f.lexema}»?`,
                    enunciado: null,
                    opciones: barajar([op(buena), ...tomar(f.falsas, 3).map(x => op(x))]),
                    correcta: buena,
                    explicacion: `«${buena}» comparte el lexema de «${f.lexema}». Las otras se le parecen, pero su significado no tiene relación.`,
                };
            }
            const falsa = rnd(f.falsas);
            return {
                tipo: 'opciones', instruccion: `¿Cuál NO es de la familia de «${f.lexema}»?`,
                enunciado: null,
                opciones: barajar([op(falsa), ...tomar(f.palabras, 3).map(x => op(x))]),
                correcta: falsa,
                explicacion: `«${falsa}» se parece por la forma, pero su significado no tiene nada que ver con «${f.lexema}».`,
            };
        },
    },
    {
        id: 'refranes', nombre: 'Refranes y frases hechas', emoji: '💬', desc: 'Lenguaje figurado: ¿qué significan?',
        config: [{ key: 'tipo', label: 'Tipo', opciones: [{ v: 'todo', l: '🎲 Todo' }, { v: 'refrán', l: '📜 Refranes' }, { v: 'frase hecha', l: '🗣️ Frases hechas' }], def: 'todo' }],
        generar(cfg) {
            const pool = cfg.tipo && cfg.tipo !== 'todo' ? REFRANES.filter(r => r.tipo === cfg.tipo) : REFRANES;
            const r = rnd(pool);
            if (r.tipo === 'refrán' && Math.random() < 0.4) {
                const [ini, fin] = partirRefran(r.t);
                const otros = REFRANES.filter(x => x.tipo === 'refrán' && x !== r).map(x => partirRefran(x.t)[1]);
                return {
                    tipo: 'opciones', instruccion: 'Completa el refrán',
                    enunciado: { tipo: 'texto', texto: `«${ini}…»` },
                    opciones: barajar([op(fin), ...tomar(otros, 3).map(x => op(x))]),
                    correcta: fin,
                    explicacion: `«${r.t}»: ${r.s}`,
                };
            }
            return {
                tipo: 'opciones', instruccion: `¿Qué significa ${r.tipo === 'refrán' ? 'este refrán' : 'esta frase hecha'}?`,
                enunciado: { tipo: 'texto', texto: `«${r.t}»` },
                opciones: barajar([op(r.s), ...tomar(REFRANES.filter(x => x !== r).map(x => x.s), 3).map(x => op(x))]),
                correcta: r.s, largas: true,
                explicacion: `«${r.t}»: ${r.s}`,
            };
        },
    },
    {
        id: 'ruleta', nombre: 'Ruleta de campos semánticos', emoji: '🎡', especial: 'RULETA_CAMPOS',
        desc: 'Para toda la clase: gira la ruleta y escribid todas las palabras que podáis del campo que salga.',
        config: [],
    },
];

export const TEMAS = [
    { id: 'SINTAXIS', nombre: 'Sintaxis', emoji: '🖍️', color: '#3498db', desc: 'Análisis sintáctico: sujeto, predicado y complementos. Español, francés y catalán.', externo: true },
    { id: 'ORTOGRAFIA', nombre: 'Ortografía', emoji: '✍️', color: '#e74c3c', desc: 'Acentuación (agudas, llanas, esdrújulas) y letras dudosas: b/v, g/j, h, ll/y, c/cc…', ejercicios: ORTOGRAFIA },
    { id: 'MORFOLOGIA', nombre: 'Morfología', emoji: '🧱', color: '#f39c12', desc: 'Clases de palabras con frases generadas al infinito: sustantivos, verbos, adjetivos, determinantes…', ejercicios: MORFOLOGIA },
    { id: 'LEXICO', nombre: 'Semántica y léxico', emoji: '📚', color: '#27ae60', desc: 'Sinónimos, antónimos, campos semánticos, familias de palabras, refranes y frases hechas.', ejercicios: LEXICO },
];

export const temaPorId = (id) => TEMAS.find(t => t.id === id);
export const configPorDefecto = (ej) => Object.fromEntries((ej.config || []).map(c => [c.key, c.def]));
export const resumenConfig = (ej, cfg) => (ej.config || []).map(c => {
    const val = cfg[c.key];
    if (c.multi) return c.opciones.filter(o => (val || []).includes(o.v)).map(o => o.l).join(', ');
    return c.opciones.find(o => o.v === val)?.l?.replace(/^\S+\s/, '') || '';
}).filter(Boolean).join(' · ');

// Re-export útil para la vista
export { CLASES, CAMPOS, generarFrase };
