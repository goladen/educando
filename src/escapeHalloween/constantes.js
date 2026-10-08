import { ORDEN_SALAS } from './bancoEscape';

export const TIPO_JUEGO = 'ESCAPE_HALLOWEEN';

export const ETAPAS = [
    { v: 'PRIMARIA', l: '🎒 Primaria' },
    { v: 'ESO', l: '🎓 ESO' },
];
export const DURACIONES = [15, 20, 30, 45, 60];
export const RITMOS = [
    { v: 3, l: '⚡ Corto', d: '3 aciertos por alumno en cada sala' },
    { v: 5, l: '🕯️ Normal', d: '5 aciertos por alumno en cada sala' },
    { v: 8, l: '🌑 Largo', d: '8 aciertos por alumno en cada sala' },
];
export const ZOMBIS = {
    FACIL: { l: '🧟 Zombi dormilón', golpesPorAlumno: 4, ataqueMs: 20000, escudo: 0.4 },
    NORMAL: { l: '🧟‍♂️ Zombi hambriento', golpesPorAlumno: 6, ataqueMs: 16000, escudo: 0.6 },
    DIFICIL: { l: '💀 Rey zombi', golpesPorAlumno: 8, ataqueMs: 12000, escudo: 0.8 },
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
    { id: 'TODAS', l: '🎲 Todas las materias', crear: () => ORDEN_SALAS.slice(0, 5).map(m => pruebaMateria(m)) },
    {
        id: 'MATES', l: '🧪 Solo Matemáticas',
        crear: (etapa) => (etapa === 'PRIMARIA' ? ['OPERACIONES', 'TABLAS', 'FRACCIONES', 'PORCENTAJES'] : ['ENTEROS', 'FRACCIONES', 'POTENCIAS', 'ECUACIONES']).map(t => pruebaMateria('MATES', t)),
    },
    { id: 'CIENCIAS', l: '🦴 Ciencias y Geografía', crear: () => [pruebaMateria('BIOLOGIA', 'HUESOS'), pruebaMateria('GEOGRAFIA', 'BANDERAS'), pruebaMateria('BIOLOGIA', 'ORGANOS'), pruebaMateria('GEOGRAFIA', 'CAPITALES')] },
    { id: 'LETRAS', l: '📜 Lengua, Historia e Inglés', crear: () => [pruebaMateria('LENGUA', 'ORTOGRAFIA'), pruebaMateria('HISTORIA'), pruebaMateria('INGLES', 'PAST'), pruebaMateria('LENGUA', 'LEXICO')] },
];
