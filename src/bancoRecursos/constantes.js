// Catálogos del Banco de recursos (materias, niveles/cursos, tipos de recurso).
import { INTERESES } from '../hooks/useNotificacionesProfesor';

export const MATERIAS_BANCO = [
    ...INTERESES.filter(i => i.id !== 'tutoria'),
    { id: 'filosofia', label: 'Filosofía y Valores',   emoji: '🤔' },
    { id: 'economia',  label: 'Economía',              emoji: '💶' },
    { id: 'clasicas',  label: 'Latín y Griego',        emoji: '🏛️' },
    { id: 'religion',  label: 'Religión',              emoji: '🕊️' },
    { id: 'infantil',  label: 'Infantil (globalizado)', emoji: '🧸' },
    { id: 'tutoria',   label: 'Tutoría y aula',        emoji: '🍎' },
    { id: 'otras',     label: 'Otras',                 emoji: '📦' },
];

export const ETAPAS_BANCO = [
    { id: 'inf',  label: 'Infantil',     cursos: ['3 años', '4 años', '5 años'] },
    { id: 'pri',  label: 'Primaria',     cursos: ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'] },
    { id: 'eso',  label: 'ESO',          cursos: ['1.º', '2.º', '3.º', '4.º'] },
    { id: 'bach', label: 'Bachillerato', cursos: ['1.º', '2.º'] },
    { id: 'fp',   label: 'FP',           cursos: ['Básica', 'Grado medio', 'Grado superior'] },
];

// Curso = '<etapa>-<índice>' (p. ej. 'eso-0' = 1.º ESO)
export const etiquetaCurso = (id) => {
    const [e, i] = String(id).split('-');
    const et = ETAPAS_BANCO.find(x => x.id === e);
    if (!et) return id;
    const c = et.cursos[Number(i)] ?? '?';
    if (e === 'inf') return `Infantil ${c}`;
    if (e === 'fp') return `FP ${c}`;
    return `${c} ${et.label}`;
};

export const TIPOS_BANCO = [
    { id: 'presentacion', label: 'Presentación',              emoji: '📊' },
    { id: 'apuntes',      label: 'Apuntes / teoría',          emoji: '📘' },
    { id: 'ficha',        label: 'Ficha / ejercicios',        emoji: '📝' },
    { id: 'examen',       label: 'Examen / evaluación',       emoji: '✅' },
    { id: 'rubrica',      label: 'Rúbrica',                   emoji: '📏' },
    { id: 'sa',           label: 'Situación de aprendizaje / programación', emoji: '🗂️' },
    { id: 'video',        label: 'Vídeo',                     emoji: '🎬' },
    { id: 'audio',        label: 'Audio / podcast',           emoji: '🎧' },
    { id: 'imagen',       label: 'Imagen / infografía',       emoji: '🖼️' },
    { id: 'interactivo',  label: 'Web / app interactiva',     emoji: '🖱️' },
    { id: 'juego',        label: 'Juego',                     emoji: '🎮' },
    { id: 'carpeta',      label: 'Carpeta de materiales',     emoji: '📁' },
    { id: 'otro',         label: 'Otro',                      emoji: '🔗' },
];

export const buscar = (lista, id) => lista.find(x => x.id === id) || null;

/** Añade https:// si falta y quita espacios. */
export const normalizarUrl = (u) => {
    const s = String(u || '').trim();
    if (!s) return '';
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

export const dominioDe = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** 'drive' | 'docs' | 'onedrive' | null según el dominio. */
export const servicioDeUrl = (u) => {
    const h = dominioDe(u);
    if (h === 'drive.google.com') return 'drive';
    if (h === 'docs.google.com') return 'docs';
    if (/(onedrive\.live\.com|1drv\.ms|sharepoint\.com)$/.test(h)) return 'onedrive';
    return null;
};

/** Para Documentos/Hojas/Presentaciones de Google: enlace que obliga a hacer una copia. */
export const enlaceCopiaGoogle = (u) => {
    const m = String(u).match(/^(https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation|drawings)\/d\/[\w-]+)/);
    return m ? `${m[1]}/copy` : null;
};
