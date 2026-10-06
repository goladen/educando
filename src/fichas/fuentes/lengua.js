// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de LENGUA para las fichas: ORTOGRAFÍA, MORFOLOGÍA y SEMÁNTICA Y
//  LÉXICO. Reutiliza el catálogo de ejercicios de la herramienta de Lengua
//  (src/lengua/ejercicios.js: TEMAS → ejercicios con generar(cfg)) y convierte
//  cada pregunta (opciones · cazar · emparejar) en un apartado de ficha.
//  Nivel de la ficha: 1 = Primaria · 2 = ESO · 3 = ESO (todo el banco).
// ─────────────────────────────────────────────────────────────────────────────
import { TEMAS, configPorDefecto } from '../../lengua/ejercicios';
import { GRUPOS_LETRAS } from '../../lengua/bancoOrtografia';

const LETRAS = 'abcdefghij';
const ejercicio = (tema, id) => TEMAS.find(t => t.id === tema)?.ejercicios?.find(e => e.id === id);

// Configuración del ejercicio original según el nivel de la ficha
const cfgSegunNivel = (ej, nv, extra = {}) => {
    const cfg = { ...configPorDefecto(ej), ...extra };
    if ('nivel' in cfg) {
        const opciones = (ej.config.find(c => c.key === 'nivel')?.opciones || []).map(o => o.v);
        if (opciones.includes('primaria')) cfg.nivel = nv === 1 ? 'primaria' : 'eso';
        else if (opciones.includes('p')) cfg.nivel = nv === 1 ? 'p' : nv === 2 ? 'e' : 'todo';
    }
    if ('grupos' in cfg && nv > 1) cfg.grupos = GRUPOS_LETRAS.map(g => g.id); // ESO: todas las letras dudosas
    if ('silabas' in cfg) cfg.silabas = nv === 1;                              // Primaria: con las sílabas separadas
    return cfg;
};

// Texto del enunciado de una pregunta del juego
const textoEnunciado = (en) => {
    if (!en) return '';
    if (en.tipo === 'palabra') return en.silabas ? `${en.texto}   (${en.silabas.join(' - ')})` : en.texto;
    if (en.tipo === 'hueco') return `${en.antes}___${en.despues}`;
    if (en.tipo === 'frase') return en.tokens.map((t, i) => (i === en.resaltar ? `«${t.t}»` : t.t)).join(' ').replace(/\s+([.,;:!?])/g, '$1');
    return en.texto || '';
};
const frase = (tokens) => tokens.map(t => t.t).join(' ').replace(/\s+([.,;:!?])/g, '$1');

// Pregunta del juego → apartado de ficha
const aApartado = (q) => {
    if (!q) return null;
    if (q.tipo === 'opciones') {
        const etiqueta = (o) => String(o.label ?? o.v);
        const correcta = q.opciones.find(o => o.v === q.correcta) || { v: q.correcta, label: q.solucion || q.correcta };
        const enun = textoEnunciado(q.enunciado);
        // La instrucción va en el apartado si cambia de una pregunta a otra (lleva «…») o si no hay enunciado
        const conInstruccion = !enun || /«/.test(q.instruccion);
        const largas = q.largas || q.opciones.some(o => etiqueta(o).length > 22);
        const opcionesTxt = q.opciones.map((o, i) => `${LETRAS[i]}) ${etiqueta(o).replace(/^[^\p{L}\p{N}«(¿¡]+\s/u, '') /* sin el emoji inicial */}`).join(largas ? '\n' : '     ');
        return {
            largo: true,
            e: [conInstruccion ? q.instruccion : '', enun, opcionesTxt].filter(Boolean).join('\n'),
            s: (q.solucion ? `${etiqueta(correcta)} → ${q.solucion}` : etiqueta(correcta)).replace(/^[^\p{L}\p{N}«(¿¡]+\s/u, ''),
            r: [{ tipo: 'opcion', v: etiqueta(correcta), opciones: q.opciones.map(etiqueta) }],
            pasos: q.explicacion ? [q.explicacion] : [],
        };
    }
    if (q.tipo === 'cazar') {
        const lista = q.tokens.filter(t => t.cat === q.objetivo).map(t => t.t);
        return { largo: true, e: `${q.instruccion}:\n${frase(q.tokens)}`, s: lista.join(', '), pasos: q.explicacion ? [q.explicacion] : [] };
    }
    if (q.tipo === 'emparejar') {
        const derecha = [...q.pares.map(p => p[1])].sort(() => Math.random() - 0.5);
        const filas = q.pares.map((p, i) => `${i + 1}. ${p[0]}${' '.repeat(Math.max(2, 18 - p[0].length))}${LETRAS[i]}) ${derecha[i]}`);
        return {
            largo: true, e: `${q.instruccion}:\n${filas.join('\n')}`,
            s: q.pares.map((p, i) => `${i + 1}-${LETRAS[derecha.indexOf(p[1])]}`).join('  '),
            pasos: q.pares.map(p => `${p[0]} → ${p[1]}`),
        };
    }
    return null;
};

// Tipo de ficha a partir de un ejercicio del juego
const tipoDe = (tema, id, extra = {}) => {
    const ej = ejercicio(tema, id);
    if (!ej?.generar) return null;
    return {
        label: `${ej.emoji} ${ej.nombre}`,
        titulo: ej.desc,
        cols: 1, alto: 30,
        gen: (nv) => aApartado(ej.generar(cfgSegunNivel(ej, nv, extra))),
        ...(ej.soloEso ? { niveles: false } : {}),
    };
};
const tipos = (lista) => Object.fromEntries(lista.map(([k, tema, id, extra, mods]) => [k, { ...tipoDe(tema, id, extra), ...(mods || {}) }]).filter(([, t]) => t.gen));

export const ORTOGRAFIA = {
    id: 'ortografia', nombre: 'Ortografía', emoji: '✍️', color: '#e74c3c', etapas: ['primaria', 'eso'],
    desc: 'Acentuación (agudas, llanas, esdrújulas, sílaba tónica, tilde) y letras dudosas',
    tipos: tipos([
        ['acento', 'ORTOGRAFIA', 'acento', {}, { titulo: 'Clasifica cada palabra en aguda, llana, esdrújula o sobresdrújula.', cols: 2 }],
        ['tonica', 'ORTOGRAFIA', 'tonica', {}, { titulo: 'Rodea la sílaba tónica de cada palabra.', cols: 2, niveles: false }],
        ['tilde', 'ORTOGRAFIA', 'tilde', {}, { titulo: 'Marca la palabra que está bien escrita.', cols: 2 }],
        ['letras', 'ORTOGRAFIA', 'letras', {}, { titulo: 'Completa con la letra que falta.', cols: 3 }],
    ]),
};

export const MORFOLOGIA = {
    id: 'morfologia', nombre: 'Morfología', emoji: '🧱', color: '#f39c12', etapas: ['primaria', 'eso'],
    desc: 'Clases de palabras con frases generadas: sustantivos, verbos, adjetivos, determinantes…',
    tipos: tipos([
        ['cazar', 'MORFOLOGIA', 'cazar', {}, { titulo: 'Subraya las palabras que se piden en cada oración.', alto: 25 }],
        ['clase', 'MORFOLOGIA', 'clase', {}, { titulo: '¿Qué clase de palabra es la palabra entre comillas?' }],
        ['tiposPalabra', 'MORFOLOGIA', 'tipos', {}, { titulo: 'Indica de qué tipo es la palabra entre comillas (determinantes, adverbios y conjunciones).' }],
    ]),
};

export const LEXICO = {
    id: 'lexico', nombre: 'Semántica y léxico', emoji: '📚', color: '#27ae60', etapas: ['primaria', 'eso'],
    desc: 'Sinónimos, antónimos, emparejar, campos semánticos, familias de palabras y refranes',
    tipos: tipos([
        ['sinonimos', 'LEXICO', 'sinonimos', {}, { titulo: 'Marca el sinónimo de cada palabra.', cols: 2 }],
        ['antonimos', 'LEXICO', 'antonimos', {}, { titulo: 'Marca el antónimo de cada palabra.', cols: 2 }],
        ['emparejarSin', 'LEXICO', 'emparejar', { rel: 'sin' }, { label: '🃏 Une sinónimos', titulo: 'Une cada palabra con su sinónimo.', alto: 20, max: 4 }],
        ['emparejarAnt', 'LEXICO', 'emparejar', { rel: 'ant' }, { label: '🃏 Une antónimos', titulo: 'Une cada palabra con su antónimo.', alto: 20, max: 4 }],
        ['campos', 'LEXICO', 'campos', {}, { titulo: 'Campos semánticos: responde a cada pregunta.', niveles: false }],
        ['familias', 'LEXICO', 'familias', {}, { titulo: 'Familias de palabras: responde a cada pregunta.', niveles: false }],
        ['refranes', 'LEXICO', 'refranes', {}, { titulo: 'Refranes y frases hechas: elige la respuesta correcta.', niveles: false }],
    ]),
};

