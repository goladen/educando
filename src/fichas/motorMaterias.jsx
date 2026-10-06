import { crearFuente } from './fuenteTexto';
import { crearMotorMultitema, conTema } from './motorMultitema';
import { BIOLOGIA } from './fuentes/biologia';
import { GEOGRAFIA } from './fuentes/geografia';
import { SINTAXIS } from './fuentes/sintaxis';
import { ORTOGRAFIA, MORFOLOGIA, LEXICO } from './fuentes/lengua';
import { MUSICA } from './fuentes/musica';

// ─────────────────────────────────────────────────────────────────────────────
//  Motores de fichas de MATERIAS: Biología, Geografía, Lengua (sintaxis,
//  ortografía, morfología, léxico) y Música. Mismo centro de fichas que Math
//  World (catálogo, filtros, galería, PDF, pizarra, enlace público), cada uno
//  con su colección. La materia de Lengua conserva la clave 'sintaxis' (y la
//  colección fichas_sintaxis) para que sigan valiendo los enlaces ya creados.
//  Rutas públicas: /fichas/biologia · /fichas/geografia · /fichas/lengua (= /fichas/sintaxis) · /fichas/musica
// ─────────────────────────────────────────────────────────────────────────────

// [id, título, etapa, cursos, descripción, [[tipo, nivel, n] | [fuente, tipo, nivel, n]…]]
// (sin fuente explícita se usa la principal de la materia)
const catalogo = (fuente, items) => items.map(([id, titulo, etapa, cursos, desc, ejs]) => {
    const ejercicios = ejs.map(e => (e.length === 4
        ? { fuente: e[0], tipo: e[1], nivel: e[2], n: e[3] }
        : { fuente, tipo: e[0], nivel: e[1], n: e[2] }));
    return { id, titulo, etapa, cursos, desc, temas: [...new Set(ejercicios.map(e => e.fuente))], ejercicios };
});

const P = ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'];

export const MATERIAS_FICHAS = {
    biologia: {
        fuente: BIOLOGIA,
        opts: { coleccion: 'fichas_biologia', ruta: '/fichas/biologia', nombre: 'Fichas de Biología', tituloFicha: 'Ficha de Biología', emoji: '🔬', volver: 'Biología' },
        catalogo: [
            ['bio-p-animales', 'Los animales', 'primaria', ['2.º', '3.º', '4.º'], 'Vertebrados e invertebrados, grupos y alimentación', [['vertebradoInvertebrado', 1, 6], ['clasificarAnimales', 1, 9], ['alimentacion', 1, 6]]],
            ['bio-p-cuerpo', 'El cuerpo humano', 'primaria', ['4.º', '5.º', '6.º'], 'Órganos, huesos y músculos con fotos', [['anatomiaFoto', 1, 6], ['organoHuesoMusculo', 1, 9], ['aparatos', 1, 4]]],
            ['bio-p-aparatos', 'Aparatos y sistemas', 'primaria', ['5.º', '6.º'], 'Funciones de los aparatos y a qué sistema pertenece cada órgano', [['aparatos', 1, 6], ['anatomiaSistema', 1, 6]]],
            ['bio-e-celula', 'La célula', 'eso', ['1.º', '3.º'], 'Orgánulos y sus funciones', [['celula', 1, 8]]],
            ['bio-e-clasificacion', 'Clasificación de los seres vivos', 'eso', ['1.º'], 'Grupos de vertebrados e invertebrados', [['clasificarAnimales', 2, 12], ['vertebradoInvertebrado', 1, 6]]],
            ['bio-e-anatomia', 'Anatomía humana', 'eso', ['3.º'], 'Identificar órganos, huesos y músculos, definiciones y sistemas', [['anatomiaFoto', 2, 6], ['anatomiaDefinicion', 2, 4], ['anatomiaSistema', 2, 6]]],
            ['bio-e-repaso', 'Repaso: anatomía avanzada', 'eso', ['3.º', '4.º'], 'Todo el dataset de anatomía, también nivel experto', [['anatomiaFoto', 3, 9], ['anatomiaDefinicion', 3, 4]]],
        ],
    },
    geografia: {
        fuente: GEOGRAFIA,
        opts: { coleccion: 'fichas_geografia', ruta: '/fichas/geografia', nombre: 'Fichas de Geografía', tituloFicha: 'Ficha de Geografía', emoji: '🌍', volver: 'Geografía' },
        catalogo: [
            ['geo-p-espana', 'España: comunidades y provincias', 'primaria', ['5.º', '6.º'], 'Comunidades autónomas, capitales y provincias', [['ccaaCapitales', 1, 8], ['provincias', 1, 8]]],
            ['geo-p-rios', 'Ríos y montañas de España', 'primaria', ['5.º', '6.º'], 'Ríos y cordilleras de España y sus vertientes', [['relieve', 1, 6], ['vertientes', 1, 6]]],
            ['geo-p-europa', 'Países y capitales de Europa', 'primaria', ['6.º'], 'Capitales y banderas de Europa', [['capitales', 1, 10], ['banderas', 1, 6]]],
            ['geo-e-europa', 'Europa: países, capitales y relieve', 'eso', ['1.º', '3.º'], 'Capitales, banderas, ríos y cordilleras de Europa', [['capitales', 1, 8], ['paisDeCapital', 1, 6], ['relieve', 2, 6]]],
            ['geo-e-mundo', 'El mundo: capitales y banderas', 'eso', ['1.º', '2.º', '3.º'], 'Países de todos los continentes', [['capitales', 3, 10], ['banderas', 3, 9], ['continentes', 1, 9]]],
            ['geo-e-relieve', 'Relieve del mundo', 'eso', ['1.º'], 'Grandes ríos y cordilleras de todos los continentes', [['relieve', 3, 10]]],
            ['geo-e-espana', 'Geografía de España', 'eso', ['3.º'], 'Comunidades, provincias, ríos y vertientes', [['ccaaCapitales', 1, 6], ['provincias', 1, 8], ['vertientes', 1, 6], ['relieve', 1, 6]]],
        ],
    },
    sintaxis: {
        fuente: SINTAXIS,
        otrasFuentes: [ORTOGRAFIA, MORFOLOGIA, LEXICO],
        opts: { coleccion: 'fichas_sintaxis', ruta: '/fichas/lengua', nombre: 'Fichas de Lengua', tituloFicha: 'Ficha de Lengua', emoji: '📖', volver: 'Lengua' },
        catalogo: [
            // Ortografía
            ['len-p-acentuacion', 'Agudas, llanas y esdrújulas', 'primaria', ['4.º', '5.º', '6.º'], 'Clasificar palabras, sílaba tónica y tilde', [['ortografia', 'acento', 1, 8], ['ortografia', 'tonica', 1, 6], ['ortografia', 'tilde', 1, 6]]],
            ['len-p-letras', 'Letras dudosas', 'primaria', ['3.º', '4.º', '5.º', '6.º'], 'b/v, g/j, h y ll/y', [['ortografia', 'letras', 1, 15]]],
            ['len-e-ortografia', 'Ortografía', 'eso', ['1.º', '2.º'], 'Acentuación y todas las letras dudosas', [['ortografia', 'acento', 2, 6], ['ortografia', 'tilde', 2, 6], ['ortografia', 'letras', 2, 12]]],
            // Morfología
            ['len-p-clases', 'Clases de palabras', 'primaria', ['3.º', '4.º', '5.º', '6.º'], 'Sustantivos, verbos, adjetivos y determinantes', [['morfologia', 'cazar', 1, 5], ['morfologia', 'clase', 1, 6]]],
            ['len-e-morfologia', 'Las clases de palabras', 'eso', ['1.º', '2.º'], 'Las ocho clases de palabras y sus tipos', [['morfologia', 'clase', 2, 8], ['morfologia', 'cazar', 2, 4], ['morfologia', 'tiposPalabra', 1, 6]]],
            // Léxico
            ['len-p-lexico', 'Sinónimos y antónimos', 'primaria', ['2.º', '3.º', '4.º', '5.º', '6.º'], 'Sinónimos, antónimos y campos semánticos', [['lexico', 'sinonimos', 1, 6], ['lexico', 'antonimos', 1, 6], ['lexico', 'emparejarSin', 1, 1], ['lexico', 'campos', 1, 4]]],
            ['len-e-lexico', 'Semántica y léxico', 'eso', ['1.º', '2.º', '3.º'], 'Sinónimos, antónimos, familias de palabras, refranes y frases hechas', [['lexico', 'sinonimos', 2, 4], ['lexico', 'antonimos', 2, 4], ['lexico', 'familias', 1, 4], ['lexico', 'refranes', 1, 4]]],
            // Sintaxis
            ['sin-p-sujeto', 'Sujeto y predicado', 'primaria', ['4.º', '5.º', '6.º'], 'Separar sujeto y predicado en oraciones sencillas', [['sujetoPredicado', 1, 8]]],
            ['sin-p-funciones', 'Primeros complementos', 'primaria', ['5.º', '6.º'], 'Complemento directo y circunstancial', [['buscarComplemento', 1, 6], ['funcion', 1, 6]]],
            ['sin-e-analisis', 'Análisis de la oración simple', 'eso', ['1.º', '2.º'], 'Análisis completo de oraciones simples', [['sujetoPredicado', 2, 4], ['analisis', 2, 6]]],
            ['sin-e-complementos', 'Los complementos del verbo', 'eso', ['2.º', '3.º'], 'CD, CI, CC, atributo, régimen, predicativo y agente', [['buscarComplemento', 2, 8], ['funcion', 2, 8]]],
            ['sin-b-analisis', 'Análisis sintáctico (Bachillerato)', 'bach', ['1.º', '2.º'], 'Oraciones de nivel de Bachillerato', [['analisis', 3, 8], ['funcion', 3, 6]]],
        ],
    },
    musica: {
        fuente: MUSICA,
        opts: { coleccion: 'fichas_musica', ruta: '/fichas/musica', nombre: 'Fichas de Música', tituloFicha: 'Ficha de Música', emoji: '🎵', volver: 'Música' },
        catalogo: [
            ['mus-p-notas', 'Las notas en el pentagrama', 'primaria', P.slice(1, 4), 'Leer notas en clave de sol', [['leerNotas', 1, 12]]],
            ['mus-p-figuras', 'Figuras musicales', 'primaria', ['3.º', '4.º', '5.º'], 'Duración de las figuras y sumas', [['duracion', 1, 6], ['sumaFiguras', 1, 6]]],
            ['mus-p-instrumentos', 'Familias de instrumentos', 'primaria', ['4.º', '5.º', '6.º'], 'Cuerda, viento y percusión', [['instrumentos', 1, 10]]],
            ['mus-e-lenguaje', 'Lenguaje musical', 'eso', ['1.º', '2.º'], 'Notas, figuras con puntillo, compases e intervalos', [['leerNotas', 3, 9], ['sumaFiguras', 2, 4], ['compas', 1, 4], ['intervalos', 1, 6]]],
            ['mus-e-terminos', 'Dinámica y tempo', 'eso', ['1.º', '2.º', '3.º'], 'Términos de intensidad y velocidad', [['terminos', 1, 10]]],
            ['mus-e-repaso', 'Repaso de teoría musical', 'eso', ['2.º', '3.º'], 'Un poco de todo', [['leerNotas', 2, 6], ['compas', 1, 3], ['intervalos', 1, 4], ['instrumentos', 1, 4], ['terminos', 1, 4]]],
        ],
    },
};

const MOTORES = {};
// Motor de fichas de una materia (con un tema preseleccionado opcional)
export const motorMateria = (materia) => {
    const m = MATERIAS_FICHAS[materia];
    if (!m) return null;
    if (!MOTORES[materia]) {
        const fuente = crearFuente(m.fuente);
        const fuentes = { [fuente.id]: fuente };
        (m.otrasFuentes || []).forEach(def => { fuentes[def.id] = crearFuente(def); });
        MOTORES[materia] = conTema(crearMotorMultitema(fuentes, { ...m.opts, catalogo: catalogo(fuente.id, m.catalogo) }), fuente.id);
        MOTORES[materia].volver = m.opts.volver;
        MOTORES[materia].temaInicial = null; // en el centro se ven todos los temas
    }
    return MOTORES[materia];
};
