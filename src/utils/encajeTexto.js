// ¿Cabe el texto de una pregunta en cada juego?
//
// Una sola fuente de verdad para tres cosas:
//   1. Los juegos encogen la letra de los textos largos (factorLetra / letraAjustada / dibujarAjustado).
//   2. Al lanzar un juego se avisa de las preguntas que no caben y se pueden excluir (revisarRecurso / recursoQueCabe).
//   3. Los editores previsualizan cada pregunta en cada juego y avisan al guardar (revisarPregunta / avisosAlGuardar).
//
// Cada elemento de texto de un juego tiene { cabe, min }:
//   - cabe: caracteres que se ven bien con la letra normal del juego.
//   - min:  cuánto puede encogerse la letra como mucho (0.6 = hasta el 60 %).
// La letra escala con la raíz (el texto ocupa área): con la letra mínima caben cabe / min² caracteres.
// Por encima de ese límite la pregunta «no cabe» en ese juego.

/** Factor (≤ 1) para encoger la letra de un texto según su longitud. */
export function factorLetra(texto, cabe, min = 0.6) {
    const n = String(texto ?? '').length;
    if (!cabe || n <= cabe) return 1;
    return Math.max(min, Math.sqrt(cabe / n));
}

/** Tamaño CSS ajustado: letraAjustada('1.2rem', texto, 40) → 'calc(1.2rem * 0.8)'. */
export function letraAjustada(base, texto, cabe, min = 0.6) {
    const f = factorLetra(texto, cabe, min);
    return f >= 1 ? base : `calc(${base} * ${f.toFixed(3)})`;
}

const limite = (el) => (el ? Math.floor(el.cabe / (el.min * el.min)) : Infinity);

// Respuestas que son imágenes o fórmulas no se miden por caracteres.
const esImagen = (s) => /^(https?:|data:image)/i.test(String(s || '').trim());

/**
 * Perfiles de cada juego. Los valores salen del tamaño real de cada caja
 * (consultar el juego antes de cambiarlos; si se cambia la letra de un juego, revisar aquí).
 */
export const PERFILES_JUEGO = {
    BURBUJAS:    { nombre: 'Caza Burbujas', icono: '🫧', pregunta: { cabe: 90, min: 0.65 }, respuesta: { cabe: 14, min: 0.55 } },
    TEST:        { nombre: 'Burbujas · modo Test', icono: '📝', pregunta: { cabe: 90, min: 0.65 }, respuesta: { cabe: 80, min: 0.7 } },
    PIKATRON:    { nombre: 'Pikatron Run', icono: '🏃', pregunta: { cabe: 110, min: 0.7 }, respuesta: { cabe: 12, min: 0.6 } },
    PLATAFORMAS: { nombre: 'Plataformas', icono: '🧗', pregunta: { cabe: 70, min: 0.7 }, respuesta: { cabe: 12, min: 0.7 } },
    PASAPALABRA: { nombre: 'Pasapalabra', icono: '🔤', pregunta: { cabe: 150, min: 0.7 }, respuesta: { cabe: 35, min: 1 }, respuestaEscrita: true },
    APAREJADOS:  { nombre: 'AparejaDOS', icono: '🃏', pregunta: null, respuesta: { cabe: 18, min: 0.5 } },
    RULETA:      { nombre: 'Ruleta', icono: '🎡', pregunta: { cabe: 140, min: 0.7 }, respuesta: { cabe: 40, min: 0.7 } },
    PILIVE_SOLO: { nombre: 'PiLive (individual)', icono: '🎯', pregunta: { cabe: 140, min: 0.65 }, respuesta: { cabe: 60, min: 0.7 } },
    MONEYBOARD:  { nombre: 'Money Board', icono: '💰', pregunta: { cabe: 200, min: 0.65 }, respuesta: { cabe: 50, min: 0.7 } },
    CALAMAR:     { nombre: 'Luz roja · Luz verde', icono: '🚦', pregunta: { cabe: 120, min: 0.65 }, respuesta: { cabe: 40, min: 0.7 } },
    BUNKER:      { nombre: 'Bunker', icono: '🔫', pregunta: { cabe: 110, min: 0.7 }, respuesta: { cabe: 16, min: 0.6 } },
    INVASORES:   { nombre: 'Invasión Pi', icono: '👾', pregunta: { cabe: 60, min: 0.65 }, respuesta: { cabe: 10, min: 0.6 } },
};

/** Juegos en los que se puede jugar cada tipo de recurso (para la previsualización de los editores). */
export const JUEGOS_DE_TIPO = {
    CAZABURBUJAS: ['BURBUJAS', 'TEST', 'PIKATRON', 'PLATAFORMAS', 'MONEYBOARD', 'CALAMAR', 'BUNKER', 'INVASORES'],
    PIKATRON:     ['PIKATRON', 'BURBUJAS', 'TEST', 'PLATAFORMAS', 'MONEYBOARD', 'CALAMAR', 'BUNKER', 'INVASORES'],
    THINKHOOT:    ['PILIVE_SOLO', 'MONEYBOARD', 'CALAMAR', 'BUNKER'],
    RULETA:       ['RULETA', 'MONEYBOARD', 'CALAMAR'],
    PASAPALABRA:  ['PASAPALABRA'],
    APAREJADOS:   ['APAREJADOS'],
    MONEYBOARD:   ['MONEYBOARD', 'CALAMAR', 'BUNKER'],
    JEOPARDY:     ['MONEYBOARD', 'CALAMAR', 'BUNKER'],
};

/** Textos de una pregunta cruda, sea del formato que sea. */
export function textosDePregunta(p) {
    if (!p || typeof p !== 'object') return { enunciado: '', respuestas: [] };
    const tipo = String(p.tipo || '').toUpperCase();
    if (tipo === 'PRESENTATION' || tipo === 'DIBUJO') return { enunciado: '', respuestas: [], omitir: true };
    // Parejas: cada término va en su propia carta
    if (p.terminoA !== undefined || p.terminoB !== undefined) {
        return { enunciado: '', respuestas: [p.terminoA, p.terminoB].map(x => String(x ?? '').trim()).filter(Boolean) };
    }
    const bloques = Array.isArray(p.bloques) ? p.bloques.map(b => String(b ?? '').trim()) : [];
    let enunciado = String(p.pregunta ?? p.q ?? p.enunciado ?? p.definicion ?? '').trim();
    if (tipo === 'RELLENAR' && bloques.length) enunciado = [bloques[0], '____', bloques[2]].filter(Boolean).join(' ');
    const lista = [];
    const meter = (x) => {
        if (x == null) return;
        if (Array.isArray(x)) { x.forEach(meter); return; }
        const s = typeof x === 'object' ? (x.texto ?? x.text ?? x.txt ?? '') : x;
        const t = String(s ?? '').trim();
        if (t && !esImagen(t)) lista.push(t);
    };
    if (tipo === 'RELLENAR') meter(bloques[1]);
    else if (tipo === 'ORDENAR') meter(bloques);
    else {
        meter(p.respuesta ?? p.correcta ?? p.ok ?? p.a);
        meter(p.correctas); meter(p.incorrectas); meter(p.mal); meter(p.distractores); meter(p.opciones); meter(p.inc);
    }
    return { enunciado: esImagen(enunciado) ? '' : enunciado, respuestas: [...new Set(lista)] };
}

/** ¿Cabe esta pregunta en este juego? → { ok, problemas: ['La pregunta tiene 240 letras (máx. 213)', …] } */
export function revisarPregunta(p, juego) {
    const perfil = PERFILES_JUEGO[juego];
    if (!perfil) return { ok: true, problemas: [] };
    const { enunciado, respuestas, omitir } = textosDePregunta(p);
    if (omitir) return { ok: true, problemas: [] };
    const problemas = [];
    const maxP = limite(perfil.pregunta);
    if (perfil.pregunta && enunciado.length > maxP) problemas.push(`La pregunta tiene ${enunciado.length} letras (máx. ${maxP})`);
    const maxR = limite(perfil.respuesta);
    const largas = respuestas.filter(r => r.length > maxR);
    if (perfil.respuesta && largas.length) {
        const peor = largas.reduce((a, b) => (b.length > a.length ? b : a));
        problemas.push(`${perfil.respuestaEscrita ? 'La respuesta' : largas.length > 1 ? `${largas.length} respuestas son largas` : 'Una respuesta es larga'}: «${peor.length > 40 ? peor.slice(0, 38) + '…' : peor}» (${peor.length} letras, máx. ${maxR})`);
    }
    return { ok: problemas.length === 0, problemas };
}

/** Límites legibles de un juego, para mostrarlos en los editores. */
export function limitesJuego(juego) {
    const perfil = PERFILES_JUEGO[juego];
    if (!perfil) return null;
    return { pregunta: perfil.pregunta ? limite(perfil.pregunta) : null, respuesta: perfil.respuesta ? limite(perfil.respuesta) : null };
}

const hojasDe = (recurso) => (Array.isArray(recurso?.hojas) && recurso.hojas.length
    ? recurso.hojas
    : [{ nombreHoja: recurso?.titulo || 'Preguntas', preguntas: recurso?.preguntas || [], _plana: true }]);

/** Revisa un recurso entero → { total, largas: [{ hoja, indice, texto, problemas }] } */
export function revisarRecurso(recurso, juego) {
    const res = { total: 0, largas: [] };
    if (!recurso || !PERFILES_JUEGO[juego]) return res;
    hojasDe(recurso).forEach((h, hi) => {
        (h.preguntas || []).forEach((p, i) => {
            if (textosDePregunta(p).omitir) return;
            res.total++;
            const r = revisarPregunta(p, juego);
            if (!r.ok) {
                const t = textosDePregunta(p);
                res.largas.push({ hoja: h.nombreHoja || h.nombre || `Hoja ${hi + 1}`, indice: i, texto: t.enunciado || t.respuestas.join(' / '), problemas: r.problemas });
            }
        });
    });
    return res;
}

/**
 * Copia del recurso sin las preguntas que no caben en el juego.
 * Nunca deja una hoja vacía: si en una hoja no cabe ninguna, se queda como estaba
 * (el juego seguirá funcionando y el aviso ya habrá dicho que puede verse mal).
 */
export function recursoQueCabe(recurso, juego) {
    if (!recurso || !PERFILES_JUEGO[juego]) return recurso;
    const filtrar = (lista) => {
        const quedan = (lista || []).filter(p => textosDePregunta(p).omitir || revisarPregunta(p, juego).ok);
        const conPreguntas = quedan.some(p => !textosDePregunta(p).omitir);
        return conPreguntas ? quedan : lista;
    };
    const copia = { ...recurso };
    if (Array.isArray(recurso.hojas) && recurso.hojas.length) copia.hojas = recurso.hojas.map(h => ({ ...h, preguntas: filtrar(h.preguntas) }));
    else if (Array.isArray(recurso.preguntas)) copia.preguntas = filtrar(recurso.preguntas);
    return copia;
}

/** Juego concreto en el que se va a jugar un recurso, según su tipo y el modo elegido. */
export function juegoDeLanzamiento(recurso, modo) {
    const m = String(modo || recurso?.modoEspecial || '').toUpperCase();
    const t = String(recurso?.tipoJuego || '').toUpperCase();
    if (['PIKATRON', 'PLATAFORMAS', 'TEST', 'BURBUJAS', 'CALAMAR', 'MONEYBOARD', 'BUNKER', 'PILIVE_SOLO', 'INVASORES'].includes(m)) return m;
    if (t === 'PIKATRON') return 'PIKATRON';
    if (t === 'CAZABURBUJAS') return 'BURBUJAS';
    if (t === 'PASAPALABRA' || t === 'APAREJADOS' || t === 'RULETA') return t;
    return null;
}

/**
 * Avisos para el editor al guardar: en qué juegos hay preguntas que pueden no verse bien.
 * → [{ juego, nombre, icono, cuantas, total }]
 */
export function avisosAlGuardar(recurso, tipoJuego) {
    const juegos = JUEGOS_DE_TIPO[String(tipoJuego || recurso?.tipoJuego || '').toUpperCase()] || [];
    return juegos.map(j => {
        const r = revisarRecurso(recurso, j);
        return { juego: j, nombre: PERFILES_JUEGO[j].nombre, icono: PERFILES_JUEGO[j].icono, cuantas: r.largas.length, total: r.total };
    }).filter(a => a.cuantas > 0);
}

/** Texto para un window.confirm al guardar. Devuelve '' si todo cabe. */
export function mensajeAvisoGuardar(recurso, tipoJuego) {
    const av = avisosAlGuardar(recurso, tipoJuego);
    if (!av.length) return '';
    return 'Algunas preguntas tienen textos largos y pueden no verse enteras en estos juegos:\n\n'
        + av.map(a => `${a.icono} ${a.nombre}: ${a.cuantas} de ${a.total}`).join('\n')
        + '\n\nAl jugar, esas preguntas se podrán excluir. Usa «Ver en los juegos» del editor para revisarlas.\n\n¿Guardar de todas formas?';
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

/** Parte un texto en líneas que no pasen de maxW con la fuente actual del contexto. */
function partirLineas(ctx, texto, maxW) {
    const palabras = String(texto ?? '').split(/\s+/).filter(Boolean);
    const lineas = []; let cur = '';
    for (const w of palabras) {
        const prueba = cur ? cur + ' ' + w : w;
        if (cur && ctx.measureText(prueba).width > maxW) { lineas.push(cur); cur = w; }
        else cur = prueba;
    }
    if (cur) lineas.push(cur);
    return lineas;
}

/**
 * Dibuja un texto centrado en (cx, cy) encogiendo la letra y partiéndolo en líneas
 * para que quepa en maxW × maxH. Si ni con la letra mínima cabe, recorta con «…».
 */
export function dibujarAjustado(ctx, texto, cx, cy, maxW, maxH, { maxPx = 16, minPx = 9, peso = 'bold', familia = 'Arial', maxLineas = 3 } = {}) {
    const t = String(texto ?? '');
    let px = maxPx, lineas = [t];
    for (; px >= minPx; px--) {
        ctx.font = `${peso} ${px}px ${familia}`;
        lineas = partirLineas(ctx, t, maxW);
        const alto = lineas.length * px * 1.15;
        if (lineas.length <= maxLineas && alto <= maxH && lineas.every(l => ctx.measureText(l).width <= maxW)) break;
    }
    if (px < minPx) {
        px = minPx; ctx.font = `${peso} ${px}px ${familia}`;
        lineas = partirLineas(ctx, t, maxW);
        const caben = Math.max(1, Math.min(maxLineas, Math.floor(maxH / (px * 1.15))));
        if (lineas.length > caben) lineas = lineas.slice(0, caben);
        const ult = lineas.length - 1;
        let l = lineas[ult];
        const recortada = lineas.join(' ').length < t.length || ctx.measureText(l).width > maxW;
        if (recortada) {
            while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1);
            lineas[ult] = l + '…';
        }
    }
    const lh = px * 1.15;
    const y0 = cy - (lineas.length - 1) * lh / 2;
    const alineado = ctx.textAlign, base = ctx.textBaseline;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lineas.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh));
    ctx.textAlign = alineado; ctx.textBaseline = base;
    return { px, lineas };
}
