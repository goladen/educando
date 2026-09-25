// Normalización de preguntas de CUALQUIER recurso del profesor.
// Extraído de JuegoCalamar para poder compartirlo con otros juegos que
// admiten todos los tipos de recurso (Money Board, Calamar, ...).
//
// Tipos soportados: opción múltiple, respuesta corta (SIMPLE), RELLENAR y ORDENAR.
// Se descartan PRESENTATION y DIBUJO (no son respondibles).

export const limpiar = (s) => String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

export const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

/** Convierte una pregunta cruda de Firestore en { tipo, enunciado, correcta, opciones?, bloques? }. */
export function normalizarPregunta(p) {
    if (!p) return null;
    const tipoOrig = String(p.tipo || '').toUpperCase();
    if (tipoOrig === 'PRESENTATION' || tipoOrig === 'DIBUJO') return null;

    const enunciado = String(p.pregunta || p.q || p.enunciado || '').trim();
    const bloques = Array.isArray(p.bloques) ? p.bloques.map(b => String(b ?? '').trim()) : [];

    // --- Ordenar ---
    if (tipoOrig === 'ORDENAR') {
        const bs = bloques.filter(Boolean);
        if (bs.length < 2) return null;
        return { tipo: 'ORDENAR', enunciado: enunciado || 'Ordena los bloques', bloques: bs, correcta: bs.join(' ') };
    }

    // --- Rellenar hueco ---
    if (tipoOrig === 'RELLENAR') {
        const hueco = bloques[1] || '';
        if (!hueco) return null;
        return {
            tipo: 'RELLENAR',
            enunciado: enunciado || 'Completa la frase',
            bloques: [bloques[0] || '', hueco, bloques[2] || ''],
            correcta: hueco,
        };
    }

    // --- Opción múltiple / respuesta corta ---
    const correcta = String(p.correcta ?? p.respuesta ?? p.ok ?? p.a ?? '').trim();
    if (!enunciado || !correcta) return null;

    let mal = p.incorrectas || p.mal || p.distractores || [];
    if (!Array.isArray(mal)) mal = [];
    mal = [...new Set(mal.map(x => String(x ?? '').trim()).filter(x => x && limpiar(x) !== limpiar(correcta)))].slice(0, 3);

    if (tipoOrig === 'SIMPLE' || mal.length === 0) return { tipo: 'CORTA', enunciado, correcta };
    return { tipo: 'MULTIPLE', enunciado, correcta, opciones: barajar([correcta, ...mal]) };
}

/** Todas las preguntas válidas de un recurso, aplanando sus hojas. */
export function preguntasDeRecurso(recurso) {
    if (!recurso) return [];
    const crudas = Array.isArray(recurso.hojas) && recurso.hojas.length
        ? recurso.hojas.flatMap(h => h.preguntas || [])
        : (recurso.preguntas || []);
    return crudas.map(normalizarPregunta).filter(Boolean);
}

/**
 * Preguntas agrupadas POR HOJA: cada hoja es una categoría.
 * Devuelve [{ nombre, preguntas: [...] }] descartando hojas sin preguntas válidas.
 */
export function categoriasDeRecurso(recurso) {
    if (!recurso) return [];
    const hojas = Array.isArray(recurso.hojas) && recurso.hojas.length
        ? recurso.hojas
        : [{ nombreHoja: recurso.titulo || 'Preguntas', preguntas: recurso.preguntas || [] }];
    return hojas
        .map((h, i) => ({
            nombre: String(h.nombreHoja || `Hoja ${i + 1}`).trim() || `Hoja ${i + 1}`,
            preguntas: (h.preguntas || []).map(normalizarPregunta).filter(Boolean),
        }))
        .filter(c => c.preguntas.length > 0);
}

/** Compara la respuesta dada con la correcta (tolerante a tildes, mayúsculas y signos). */
export function esRespuestaCorrecta(pregunta, dada) {
    if (!pregunta) return false;
    if (pregunta.tipo === 'ORDENAR') return limpiar(dada) === limpiar(pregunta.bloques.join(' '));
    return limpiar(dada) === limpiar(pregunta.correcta);
}
