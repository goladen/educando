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

// ─── «Elegir» en vez de escribir ─────────────────────────────────────────────
// Para jugar con opciones una ficha / recurso de respuesta escrita: los distractores salen de
// las respuestas de las OTRAS preguntas (o de números cercanos) y SIN azar, para que no cambien
// las preguntas ni el orden de las partidas con semilla (fichas PDF de Invasión Pi).
const hashTexto = (s) => {
    let h = 2166136261;
    for (const c of String(s ?? '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
};

/** Hasta n distractores para una respuesta escrita (siempre los mismos para los mismos datos). */
export function distractoresSinAzar(correcta, otras = [], n = 3) {
    const txt = String(correcta ?? '').trim();
    const lc = limpiar(txt);
    const out = [];
    const vistos = new Set([lc]);
    const add = (x) => {
        const s = String(x ?? '').trim();
        const k = limpiar(s);
        if (s && k && !vistos.has(k) && out.length < n) { vistos.add(k); out.push(s); }
    };
    // Números: primero los cercanos
    if (/^-?\d+([.,]\d+)?$/.test(txt)) {
        const sep = txt.includes(',') ? ',' : '.';
        const dec = (txt.split(/[.,]/)[1] || '').length;
        const v = Number(txt.replace(',', '.'));
        const paso = dec ? 10 ** -dec : 1;
        [1, -1, 2, 10].forEach((d) => {
            const x = v + d * paso;
            if (v >= 0 && x < 0) return;
            add(dec ? x.toFixed(dec).replace('.', sep) : String(Math.round(x)));
        });
        return out;
    }
    const h = hashTexto(txt);
    const cand = [...new Set(otras.map((x) => String(x ?? '').trim()))]
        .filter((x) => x && limpiar(x) !== lc && !/^-?\d+([.,]\d+)?$/.test(x))
        // primero las de longitud parecida; a igualdad, un orden fijo que depende de la pregunta
        .sort((a, b) => Math.abs(a.length - txt.length) - Math.abs(b.length - txt.length) || hashTexto(a + h) - hashTexto(b + h));
    cand.forEach(add);
    return out;
}

/** Correcta + distractores en un orden fijo (depende del texto, no del azar). */
export function opcionesSinAzar(correcta, mal) {
    const ops = [correcta, ...mal];
    const k = hashTexto(correcta) % ops.length;
    return [...ops.slice(k), ...ops.slice(0, k)];
}

/** Preguntas normalizadas: las de escribir (CORTA / RELLENAR) pasan a opción múltiple. */
export function conOpcionesParaElegir(preguntas = []) {
    const validas = preguntas.filter((p) => p && p.tipo !== 'ORDENAR');
    const respuestas = validas.map((p) => p.correcta);
    return preguntas.map((p) => {
        if (!p || (p.tipo !== 'CORTA' && p.tipo !== 'RELLENAR')) return p;
        // Primero respuestas de preguntas del mismo tipo (rellenar con rellenar…); si faltan, del resto
        let mal = distractoresSinAzar(p.correcta, validas.filter((q) => q.tipo === p.tipo).map((q) => q.correcta));
        if (mal.length < 3) mal = [...mal, ...distractoresSinAzar(p.correcta, respuestas.filter((r) => !mal.includes(r)))].slice(0, 3);
        if (!mal.length) return p;
        const enunciado = p.tipo === 'RELLENAR' ? `${p.enunciado}: ${p.bloques[0]} ____ ${p.bloques[2]}`.trim() : p.enunciado;
        return { tipo: 'MULTIPLE', enunciado, correcta: p.correcta, opciones: opcionesSinAzar(p.correcta, mal), deEscribir: true };
    });
}
