// ═══════════════════════════════════════════════════════════════════
//  IDIOMA DEL ESCAPE ROOM (español / inglés)
//  tr('texto en español')            → traducción del idioma activo (o el original)
//  tr('Sala {0} de {1}', [n, total]) → con huecos numerados
//  El diccionario inglés está en i18n.en.js (clave = texto original en español).
//  Es un módulo y no un contexto de React para que también sirva fuera de los componentes:
//  generadores de preguntas, candados, PDF de las fichas, narrador…
//  El componente raíz (EscapeHalloween.jsx) fija el idioma en cada render con fijarIdiomaEscape:
//  el del selector de la web, o el de la sala en el móvil del alumno.
// ═══════════════════════════════════════════════════════════════════
import { EN } from './i18n.en.js';

export const IDIOMAS_ESCAPE = {
    es: { bandera: '🇪🇸', etiqueta: 'Español' },
    en: { bandera: '🇬🇧', etiqueta: 'English' },
};

let idioma = 'es';
const avisadas = new Set();

export const idiomaEscape = () => idioma;
export const esIngles = () => idioma === 'en';
/** Solo hay es y en: cualquier otro idioma de la web (ca, fr) juega en español. */
export const idiomaSoportado = (l) => (l === 'en' ? 'en' : 'es');
export function fijarIdiomaEscape(l) { idioma = idiomaSoportado(l); }

export function tr(texto, vars) {
    if (typeof texto !== 'string') return texto;
    let s = texto;
    if (idioma === 'en') {
        const t = EN[texto];
        if (t !== undefined) s = t;
        else if (import.meta.env?.DEV && !avisadas.has(texto)) { avisadas.add(texto); console.warn('[escape i18n] falta en inglés:', texto); }
    }
    return vars ? s.replace(/\{(\d+)\}/g, (_, i) => String(vars[i] ?? '')) : s;
}
