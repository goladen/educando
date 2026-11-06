import { ORDEN_SALAS } from './bancoEscape';
import { tr } from './i18n';

export const TIPO_JUEGO = 'ESCAPE_HALLOWEEN';

export const ETAPAS = [
    { v: 'PRIMARIA', get l() { return tr("🎒 Primaria"); } },
    { v: 'ESO', get l() { return tr("🎓 ESO"); } },
];
export const DURACIONES = [15, 20, 30, 45, 60];
export const RITMOS = [
    { v: 3, get l() { return tr("⚡ Corto"); }, get d() { return tr("3 aciertos por alumno en cada sala"); } },
    { v: 5, get l() { return tr("🕯️ Normal"); }, get d() { return tr("5 aciertos por alumno en cada sala"); } },
    { v: 8, get l() { return tr("🌑 Largo"); }, get d() { return tr("8 aciertos por alumno en cada sala"); } },
];
export const ZOMBIS = {
    FACIL: { get l() { return tr("🧟 Zombi dormilón"); }, golpesPorAlumno: 4, ataqueMs: 20000, escudo: 0.4 },
    NORMAL: { get l() { return tr("🧟‍♂️ Zombi hambriento"); }, golpesPorAlumno: 6, ataqueMs: 16000, escudo: 0.6 },
    DIFICIL: { get l() { return tr("💀 Rey zombi"); }, golpesPorAlumno: 8, ataqueMs: 12000, escudo: 0.8 },
};
export const MAX_PRUEBAS = 9;
export const EMOJIS_MANUAL = ['🗝️', '📦', '🕯️', '🔮', '📜', '⚰️', '🕸️', '🎃', '🦇', '🧪', '🗺️', '🖼️'];

export const nuevaId = () => Math.random().toString(36).slice(2, 9);
export const pruebaMateria = (materia, tema = 'MIX') => ({ id: nuevaId(), tipo: 'MATERIA', materia, tema, nombre: '' });
export const pruebaManual = () => ({
    id: nuevaId(), tipo: 'MANUAL', nombre: '', emoji: '🗝️', texto: '', codigo: '', pista: '', imagen: '', materiaRetos: null, temaRetos: 'MIX',
});

export const configPorDefecto = () => ({
    etapa: 'ESO', minutos: 30, ritmo: 5, zombi: 'NORMAL',
    pruebas: ORDEN_SALAS.slice(0, 5).map(m => pruebaMateria(m)),
});

export const PLANTILLAS = [
    { id: 'TODAS', get l() { return tr("🎲 Todas las materias"); }, crear: () => ORDEN_SALAS.slice(0, 5).map(m => pruebaMateria(m)) },
    {
        id: 'MATES', get l() { return tr("🧪 Solo Matemáticas"); },
        crear: (etapa) => (etapa === 'PRIMARIA' ? ['OPERACIONES', 'TABLAS', 'FRACCIONES', 'PORCENTAJES'] : ['ENTEROS', 'FRACCIONES', 'POTENCIAS', 'ECUACIONES']).map(t => pruebaMateria('MATES', t)),
    },
    { id: 'CIENCIAS', get l() { return tr("🦴 Ciencias y Geografía"); }, crear: () => [pruebaMateria('BIOLOGIA', 'HUESOS'), pruebaMateria('GEOGRAFIA', 'BANDERAS'), pruebaMateria('BIOLOGIA', 'ORGANOS'), pruebaMateria('GEOGRAFIA', 'CAPITALES')] },
    { id: 'LETRAS', get l() { return tr("📜 Lengua, Historia e Inglés"); }, crear: () => [pruebaMateria('LENGUA', 'ORTOGRAFIA'), pruebaMateria('HISTORIA'), pruebaMateria('INGLES', 'PAST'), pruebaMateria('LENGUA', 'LEXICO')] },
    { id: 'ENGLISH', get l() { return tr("🇬🇧 Clase de inglés"); }, crear: () => [pruebaMateria('INGLES', 'PAST'), pruebaMateria('GEOGRAFIA', 'CAPITALES'), pruebaMateria('INGLES', 'PARTICIPLE'), pruebaMateria('BIOLOGIA', 'ORGANOS'), pruebaMateria('INGLES', 'VOCAB')] },
];
