// Deduce los intereses de un profesor (ids de INTERESES en
// hooks/useNotificacionesProfesor.js) a partir de texto libre: sus
// «temas preferidos» del alta y los títulos/temas/tipo de sus recursos.
// Lo usa el panel de usuarios del admin para los profes que no han marcado
// intereses en la campana.

const limpiar = (s) => ` ${String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;

// Raíces de palabra por interés. Educación física va antes que ciencias y se
// quita del texto para que «física» no cuente también como ciencias.
const CLAVES = [
    ['edfisica', ['educacion fisica', 'ed fisica', 'efisica', 'deporte', 'deportiv', 'atletism', 'baloncesto', 'futbol', 'gimnasi', 'escalada', 'climbing', 'olympic']],
    ['mates',    ['matemat', 'mates', 'algebra', 'ecuacion', 'fraccion', 'geometr', 'calculo', 'numero', 'estadist', 'probabil', 'funcion', 'potencia', 'derivad', 'mathlive', 'geometrix', 'trigonometr', 'aritmet', 'divisib', 'decimal', 'porcentaj']],
    ['lengua',   ['lengua', 'literat', 'sintaxis', 'ortograf', 'gramatic', 'castellano', 'lectura', 'poesia', 'poema', 'morfolog', 'acentua', 'catalan', 'valencia', 'euskera', 'gallego', 'redaccion', 'escritura']],
    ['idiomas',  ['ingles', 'english', 'frances', 'french', 'francais', 'aleman', 'german', 'italiano', 'idioma', 'listening', 'vocabulary', 'irregular verb', 'phrasal', 'grammar', 'wordle', 'enigmic', 'listening recurso']],
    ['ciencias', ['ciencia', 'biolog', 'fisica', 'quimic', 'naturales', 'geolog', 'celula', 'cuerpo humano', 'anatom', 'sistema solar', 'astronom', 'ecosistema', 'periodic', 'element', 'energia', 'planeta', 'solar system', 'genetic']],
    ['sociales', ['historia', 'geograf', 'sociales', 'imperio', 'prehistori', 'edad media', 'edad antigua', 'romano', 'mapa', 'capital', 'economia', 'filosof', 'linea tiempo', 'revolucion', 'constitucion', 'paises', 'rios']],
    ['musica',   ['musica', 'music', 'instrumento', 'ritmo', 'partitura', 'melodia', 'canción', 'cancion']],
    ['plastica', ['plastica', 'dibujo', 'arte', 'pintur', 'visual', 'diedric', 'artista', 'escultur']],
    ['tecno',    ['tecnolog', 'robot', 'program', 'informat', 'scratch', 'arduino', 'microbit', 'digital', 'codigo', 'blockly', 'computac']],
    ['infantil', ['infantil', 'primaria', 'abecedario', 'colores', 'sumas', 'restas', 'tablas de multiplicar', 'oaoa']],
    ['tutoria',  ['tutoria', 'convivencia', 'emocion', 'valores', 'orientacion', 'acoso', 'igualdad', 'quien es quien']],
];

/** Devuelve los ids de interés que aparecen en el texto, del más mencionado al menos. */
export function inferirIntereses(...textos) {
    let t = limpiar(textos.flat().filter(Boolean).join(' · '));
    const cuenta = {};
    for (const [id, raices] of CLAVES) {
        for (const r of raices) {
            const patron = new RegExp(` ${limpiar(r).trim()}`, 'g');
            const n = (t.match(patron) || []).length;
            if (!n) continue;
            cuenta[id] = (cuenta[id] || 0) + n;
            if (id === 'edfisica') t = t.replace(patron, ' ');   // que no sume a ciencias
        }
    }
    return Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
}

/** Texto de un recurso que sirve para deducir su materia. */
export const textoRecurso = (r) => [r.titulo, r.temas, r.materia, r.asignatura, r.tipoJuego].filter(Boolean).join(' · ');
