// ═══════════════════════════════════════════════════════════════════
//  PRUEBAS CON RECURSOS DE PROFES (colección `resources`)
//  Usa el normalizador común (utils/normalizarPreguntas.js) y lo pasa al formato del escape room:
//   · opción múltiple tal cual;
//   · respuesta corta y rellenar hueco → opción múltiple con distractores sacados de otras respuestas del recurso;
//   · ordenar → se descarta (no cabe en el formato de opciones).
//  La prueba guarda una COPIA de las preguntas ({ tipo:'RECURSO', recursoId, recursoTitulo, autor, hojas, preguntas })
//  para que el escape room funcione igual aunque el autor cambie el recurso después.
// ═══════════════════════════════════════════════════════════════════
import { categoriasDeRecurso, limpiar } from '../utils/normalizarPreguntas';

export const MAX_PREGUNTAS_RECURSO = 80;
export const MIN_PREGUNTAS_RECURSO = 4;

const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Pasa las preguntas normalizadas de una hoja al formato { texto, detalle?, opciones, correcta }. */
function convertir(normalizadas, respuestasDelRecurso) {
    const out = [];
    for (const q of normalizadas) {
        if (q.tipo === 'ORDENAR') continue;
        let texto = q.enunciado, detalle;
        if (q.tipo === 'RELLENAR') { detalle = `${q.bloques[0]} ____ ${q.bloques[2]}`.trim(); }
        let opciones;
        if (q.tipo === 'MULTIPLE' && q.opciones?.length >= 2) opciones = q.opciones;
        else {
            const otras = [...new Set(respuestasDelRecurso.filter(r => limpiar(r) !== limpiar(q.correcta)))];
            if (otras.length < 2) continue;                       // no hay con qué inventar distractores
            opciones = barajar([q.correcta, ...barajar(otras).slice(0, 3)]);
        }
        const correcta = opciones.findIndex(o => limpiar(o) === limpiar(q.correcta));
        if (correcta < 0) continue;
        out.push(detalle ? { texto, detalle, opciones, correcta } : { texto, opciones, correcta });
    }
    return out;
}

/** Hojas de un recurso con cuántas preguntas aprovechables tiene cada una. */
export function hojasDeRecurso(recurso) {
    const cats = categoriasDeRecurso(recurso);
    const respuestas = cats.flatMap(c => c.preguntas.map(q => q.correcta));
    return cats.map(c => ({ nombre: c.nombre, n: convertir(c.preguntas, respuestas).length })).filter(h => h.n > 0);
}

/** Preguntas del recurso (solo de las hojas elegidas; null = todas). */
export function preguntasEscapeDeRecurso(recurso, hojasSel = null) {
    const cats = categoriasDeRecurso(recurso);
    const respuestas = cats.flatMap(c => c.preguntas.map(q => q.correcta));
    const elegidas = cats.filter(c => !hojasSel || hojasSel.includes(c.nombre));
    return elegidas.flatMap(c => convertir(c.preguntas, respuestas)).slice(0, MAX_PREGUNTAS_RECURSO);
}

/** Construye la prueba a partir de un recurso de Firestore. */
export function pruebaDeRecurso(recurso, hojasSel = null, base = {}) {
    return {
        ...base,
        tipo: 'RECURSO', recursoId: recurso.id, recursoTitulo: recurso.titulo || 'Recurso',
        autor: recurso.profesorNombre || '', hojas: hojasSel,
        preguntas: preguntasEscapeDeRecurso(recurso, hojasSel),
    };
}

/** Una pregunta al azar de la prueba, con las opciones barajadas. */
export function preguntaDeRecurso(prueba) {
    const q = pick(prueba.preguntas || []);
    if (!q) return null;
    const orden = barajar(q.opciones.map((_, i) => i));
    return { ...q, opciones: orden.map(i => q.opciones[i]), correcta: orden.indexOf(q.correcta), materia: 'RECURSO' };
}

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Candado de las respuestas: 4 preguntas del recurso; la letra de cada respuesta correcta, en orden, forma el código. */
export function candadoRecurso(prueba) {
    const pool = barajar((prueba.preguntas || []).filter(q => q.opciones.length <= 6));
    const elegidas = pool.slice(0, Math.min(4, pool.length));
    const codigo = elegidas.map(q => LETRAS[q.correcta]).join('');
    return {
        titulo: 'El candado de las respuestas',
        instruccion: `Cada pista es una pregunta. La letra de cada respuesta correcta, en orden, forma el código de ${elegidas.length} letras. ¡Las preguntas están repartidas entre vuestros móviles!`,
        tipo: 'texto', longitud: elegidas.length,
        pistas: elegidas.map((q, k) => ({
            texto: `${k + 1}.ª letra · ${q.texto}${q.detalle ? ` «${q.detalle}»` : ''} — ${q.opciones.map((o, i) => `${LETRAS[i]}) ${o}`).join('   ')}`,
        })),
        soluciones: [codigo],
        solucionVisible: codigo,
    };
}
