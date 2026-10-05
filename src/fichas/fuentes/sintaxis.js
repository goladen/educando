// ─────────────────────────────────────────────────────────────────────────────
//  Fuente de SINTAXIS para las fichas: usa la biblioteca de oraciones ya
//  analizadas del juego de Sintaxis (BibliotecaFrases.js: cada palabra con su
//  función). Nivel 1 = Primaria · 2 = ESO · 3 = Bachillerato.
// ─────────────────────────────────────────────────────────────────────────────
import { CATEGORIAS, FRASES } from '../../BibliotecaFrases';
import { pick } from '../fuenteTexto';

const barajar = (a) => [...a].sort(() => Math.random() - 0.5);
const NIVEL = { 1: 'primaria', 2: 'eso', 3: 'bachillerato' };
const ABREV = {
    'Sujeto': 'S', 'Verbo': 'V', 'Complemento Directo': 'CD', 'Complemento Indirecto': 'CI', 'Complemento Circunstancial': 'CC',
    'Atributo': 'Atrib.', 'Complemento Predicativo': 'C.Pvo.', 'Complemento de Régimen': 'C.Rég.', 'Complemento Agente': 'C.Ag.',
};
const etiqueta = (f) => CATEGORIAS[f]?.label || f;

// Oración → constituyentes: palabras seguidas con la misma función (la primera de cada palabra)
const constituyentes = (frase) => {
    const out = [];
    frase.tokens.forEach(t => {
        const f = (t.funcion || [])[0] || '—';
        const ult = out[out.length - 1];
        if (ult && ult.f === f) ult.texto += ` ${t.text}`; else out.push({ f, texto: t.text });
    });
    return out;
};
const textoFrase = (frase) => {
    const t = frase.tokens.map(x => x.text).join(' ');
    return t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.');
};
const frasesNivel = (nv) => {
    const l = FRASES.filter(f => f.nivel === NIVEL[nv]);
    return l.length ? l : FRASES;
};
const analisisTxt = (cs) => cs.map(c => `[${c.texto}] ${ABREV[c.f] || c.f}`).join('  ');

export const SINTAXIS = {
    id: 'sintaxis', nombre: 'Sintaxis', emoji: '🖍️', color: '#3498db', etapas: ['primaria', 'eso', 'bach'],
    desc: 'Análisis sintáctico, sujeto y verbo, funciones y complementos',
    tipos: {
        analisis: {
            label: '🔍 Análisis completo', titulo: 'Analiza sintácticamente las siguientes oraciones.', cols: 1, alto: 90,
            gen: (nv) => {
                const fr = pick(frasesNivel(nv)), cs = constituyentes(fr);
                const suj = cs.find(c => c.f === 'Sujeto'), verbo = cs.find(c => c.f === 'Verbo');
                return { largo: true, e: textoFrase(fr), s: analisisTxt(cs),
                    r: [{ etiqueta: 'Sujeto:', tipo: 'texto', v: suj ? suj.texto : ['omitido', 'sujeto omitido', 'eliptico', 'sujeto eliptico'], placeholder: suj ? 'sujeto' : 'omitido' },
                        ...(verbo ? [{ etiqueta: 'Verbo:', tipo: 'texto', v: verbo.texto, placeholder: 'verbo' }] : [])],
                    pasos: cs.map(c => `«${c.texto}» → ${etiqueta(c.f)}`) };
            },
        },
        sujetoPredicado: {
            label: '👤 Sujeto y predicado', titulo: 'Separa el sujeto y el predicado de cada oración.', cols: 1, alto: 50,
            gen: (nv) => {
                const fr = pick(frasesNivel(nv)), cs = constituyentes(fr);
                const suj = cs.filter(c => c.f === 'Sujeto').map(c => c.texto).join(' ');
                const pred = cs.filter(c => c.f !== 'Sujeto').map(c => c.texto).join(' ');
                return { largo: true, e: textoFrase(fr), s: `Sujeto: ${suj || '(omitido)'} · Predicado: ${pred}`,
                    r: [{ etiqueta: 'Sujeto:', tipo: 'texto', v: suj || ['omitido', 'sujeto omitido', 'eliptico'], placeholder: 'sujeto' }],
                    pasos: [suj ? `El sujeto concuerda con el verbo: «${suj}»` : 'El sujeto está omitido (se sabe por la forma del verbo)', `Predicado: «${pred}»`] };
            },
        },
        funcion: {
            label: '🎯 ¿Qué función cumple?', titulo: '¿Qué función cumple el fragmento destacado?', cols: 1, alto: 45,
            gen: (nv) => {
                const fr = pick(frasesNivel(nv)), cs = constituyentes(fr).filter(c => c.f !== 'Verbo' && CATEGORIAS[c.f]);
                if (!cs.length) return null;
                const c = pick(cs);
                const presentes = Object.keys(CATEGORIAS).filter(k => k !== 'Verbo' && (nv > 1 || ['Sujeto', 'Complemento Directo', 'Complemento Indirecto', 'Complemento Circunstancial', 'Atributo'].includes(k)));
                const ops = barajar([c.f, ...barajar(presentes.filter(k => k !== c.f)).slice(0, 3)]).map(etiqueta);
                return { largo: true, e: `${textoFrase(fr)}\n→ «${c.texto}»`, s: etiqueta(c.f), r: [{ tipo: 'opcion', v: etiqueta(c.f), opciones: ops }], pasos: [analisisTxt(constituyentes(fr))] };
            },
        },
        buscarComplemento: {
            label: '🔎 Busca el complemento', titulo: 'Escribe el complemento que se pide en cada oración.', cols: 1, alto: 45,
            gen: (nv) => {
                const tipo = pick(nv === 1 ? ['Complemento Directo', 'Complemento Circunstancial'] : ['Complemento Directo', 'Complemento Indirecto', 'Complemento Circunstancial', 'Atributo', 'Complemento de Régimen', 'Complemento Predicativo', 'Complemento Agente']);
                const candidatas = frasesNivel(nv).filter(f => constituyentes(f).some(c => c.f === tipo));
                if (!candidatas.length) return null;
                const fr = pick(candidatas), todos = constituyentes(fr).filter(x => x.f === tipo);
                return { largo: true, e: `${textoFrase(fr)}\n→ ${CATEGORIAS[tipo]?.label || tipo}:`, s: todos.map(x => x.texto).join(' / '), r: [{ tipo: 'texto', v: todos.map(x => x.texto), placeholder: 'complemento' }], pasos: [analisisTxt(constituyentes(fr))] };
            },
        },
    },
};
