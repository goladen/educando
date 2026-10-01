// Generación de recursos con IA: prompts por juego + lectura/validación de la
// respuesta. Lógica pura (sin Firebase ni navegador), compartida por:
//   - api/ia-recurso.js        (construye el prompt y valida en el servidor)
//   - src/iaGenerador.js       (navegador: modo automático)
//   - ModalCrearIA.jsx         (modo «copiar prompt y pegar respuesta»)
//   - scripts/probar-nvidia.mjs (prueba local)

export const JUEGOS_IA = {
    PASAPALABRA:  { label: 'Pasapalabra',          min: 15, max: 25, def: 20, unidad: 'palabras' },
    CAZABURBUJAS: { label: 'Burbujas y Pikatron',  min: 5,  max: 30, def: 10, unidad: 'preguntas' },
    THINKHOOT:    { label: 'Pi-Live',              min: 5,  max: 30, def: 10, unidad: 'preguntas' },
    RULETA:       { label: 'La Ruleta',            min: 5,  max: 20, def: 10, unidad: 'preguntas' },
    APAREJADOS:   { label: 'AparejaDOS',           min: 4,  max: 16, def: 8,  unidad: 'parejas' },
};

export const IDIOMAS_IA = ['Español', 'Inglés', 'Francés', 'Catalán', 'Gallego', 'Euskera', 'Alemán', 'Italiano', 'Portugués'];

export const NIVELES_IA = [
    '6-8 años (1º-2º Primaria)',
    '8-10 años (3º-4º Primaria)',
    '10-12 años (5º-6º Primaria)',
    '12-14 años (1º-2º ESO)',
    '14-16 años (3º-4º ESO)',
    '16-18 años (Bachillerato)',
    'Adultos',
];

export const MAX_TEXTO_IA = 20000; // caracteres del texto/documento de referencia

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpiarStr = (v) => String(v ?? '').trim();

/** Normaliza y acota los parámetros que llegan del formulario (o del cliente al servidor). */
export function normalizarParams(tipo, p = {}) {
    const j = JUEGOS_IA[tipo];
    if (!j) throw new Error(`El juego ${tipo} no admite generación con IA.`);
    const n = Math.min(j.max, Math.max(j.min, Math.round(Number(p.n) || j.def)));
    return {
        tema: limpiarStr(p.tema).slice(0, 200),
        observaciones: limpiarStr(p.observaciones).slice(0, 1000),
        nivel: limpiarStr(p.nivel).slice(0, 80) || NIVELES_IA[2],
        idioma: limpiarStr(p.idioma).slice(0, 40) || 'Español',
        texto: limpiarStr(p.texto).slice(0, MAX_TEXTO_IA),
        n,
    };
}

/** Mínimo de elementos válidos para dar la respuesta por buena. */
export const minimoValidas = (n) => Math.ceil(n * 0.6);

// ---------------------------------------------------------------------------
// PROMPTS
// ---------------------------------------------------------------------------

function bloqueContexto({ tema, observaciones, nivel, idioma, texto }) {
    let s = `- Temática: ${tema || 'la que se deduzca del texto de referencia'}
- Idioma de TODO el contenido: ${idioma}
- Edad / nivel del alumnado: ${nivel}`;
    if (observaciones) s += `\n- Indicaciones del profesor: ${observaciones}`;
    if (texto) {
        s += `\n\nTEXTO DE REFERENCIA. Todas las preguntas deben poder responderse con la información de este texto (no uses conocimientos externos a él):
<<<
${texto}
>>>`;
    }
    return s;
}

const REGLAS_JSON = 'Responde ÚNICAMENTE con el JSON pedido: sin markdown, sin explicaciones, sin notas ni comentarios. No uses comillas dobles dentro de los textos.';

function promptUsuario(tipo, p) {
    const ctx = bloqueContexto(p);
    const { n, idioma, nivel } = p;

    if (tipo === 'PASAPALABRA') {
        // El orden de los campos importa: el modelo escribe primero la PALABRA y luego
        // la define. Si escribe antes la definición, fuerza palabras que no encajan.
        return `Crea un rosco de Pasapalabra con EXACTAMENTE ${n} palabras.
${ctx}

Cómo hacerlo:
1. Elige ${n} palabras reales en ${idioma}, relacionadas con la temática y conocidas a ese nivel, cada una con una letra inicial DISTINTA (A-Z, sin Ñ). No hace falta usar todas las letras: sáltate las difíciles.
2. Solo si te faltan palabras, puedes usar alguna que CONTENGA la letra (sin empezar por ella).
3. Para cada palabra escribe una definición correcta y precisa que tenga como única respuesta esa palabra. La palabra no puede aparecer en la definición.
4. La definición empieza por "Empieza por la X:" (o "Contiene la X:" en el caso 2), traducido al ${idioma}.
5. Revisa que cada definición describe exactamente su palabra (no otra del tema), que es adecuada al nivel ${nivel} y que todo está en ${idioma}. Si una palabra es demasiado difícil para ese nivel, cámbiala por otra.
6. Las definiciones son una sola frase, sin aclaraciones ni paréntesis.

${REGLAS_JSON}
Formato exacto (ordenado por letra, "respuesta" siempre primero):
[{"respuesta":"Asteroide","letra":"A","pregunta":"Empieza por la A: ..."}]`;
    }

    if (tipo === 'APAREJADOS') {
        return `Crea EXACTAMENTE ${n} parejas de conceptos relacionados para un juego de unir parejas.
${ctx}

Reglas:
1. Cada pareja une un término (A) con su definición, equivalente o concepto asociado (B).
2. Cada B corresponde a UN solo A, sin ambigüedad entre parejas.
3. Textos breves (máximo 8 palabras cada uno), adecuados al nivel y en ${idioma}.

${REGLAS_JSON}
Formato exacto:
[{"terminoA":"...","terminoB":"..."}]`;
    }

    const opcionMultiple = `1. Cada pregunta tiene UNA respuesta correcta y 3 incorrectas plausibles (del mismo tipo que la correcta, pero claramente falsas).
2. Respuestas breves (máximo 6 palabras). Preguntas claras, adecuadas al nivel y en ${idioma}.
3. Varía la dificultad y los aspectos del tema; no repitas preguntas.`;

    if (tipo === 'RULETA') {
        return `Crea un panel para el juego La Ruleta (tipo Ruleta de la Suerte) con EXACTAMENTE ${n} preguntas y 2 frases ocultas.
${ctx}

Reglas:
${opcionMultiple}
4. Las frases ocultas son frases cortas (3 a 6 palabras, en MAYÚSCULAS, sin signos de puntuación) relacionadas con la temática, que los alumnos irán descubriendo.

${REGLAS_JSON}
Formato exacto:
{"frases":["FRASE UNO","FRASE DOS"],"preguntas":[{"pregunta":"...","correcta":"...","incorrectas":["...","...","..."]}]}`;
    }

    // CAZABURBUJAS / THINKHOOT
    return `Crea EXACTAMENTE ${n} preguntas de opción múltiple para un juego de preguntas.
${ctx}

Reglas:
${opcionMultiple}

${REGLAS_JSON}
Formato exacto:
[{"pregunta":"...","correcta":"...","incorrectas":["...","...","..."]}]`;
}

const SYSTEM = 'Eres un profesor experto que crea recursos educativos de calidad para juegos de clase. Respondes ÚNICAMENTE con JSON válido.';

/** Mensajes para la API (formato OpenAI). */
export function mensajesRecurso(tipo, params) {
    const p = normalizarParams(tipo, params);
    return [{ role: 'system', content: SYSTEM }, { role: 'user', content: promptUsuario(tipo, p) }];
}

/** Prompt en un solo bloque para copiar y pegar en cualquier IA. */
export function promptParaCopiar(tipo, params) {
    const p = normalizarParams(tipo, params);
    return `${SYSTEM}\n\n${promptUsuario(tipo, p)}`;
}

// ---------------------------------------------------------------------------
// LECTURA DE LA RESPUESTA
// ---------------------------------------------------------------------------

const limpiarRespuesta = (texto) => String(texto || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

const parsear = (s) => {
    try { return JSON.parse(s.replace(/,\s*([\]}])/g, '$1')); } catch { return null; }
};

/** Objeto raíz {…} si la respuesta lo es (La Ruleta). */
function extraerObjeto(texto) {
    const limpio = limpiarRespuesta(texto);
    const ini = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (ini === -1 || fin <= ini) return null;
    const v = parsear(limpio.slice(ini, fin + 1));
    return v && !Array.isArray(v) ? v : null;
}

// Extrae la lista de elementos aunque el modelo añada razonamiento (<think>),
// markdown, texto alrededor, comas finales o corte la respuesta a medias.
export function extraerArrayJSON(texto) {
    const limpio = limpiarRespuesta(texto);
    const comoArray = (v) => Array.isArray(v) ? v
        : (v && Object.values(v).filter(Array.isArray).find(a => a.some(x => x && typeof x === 'object'))) || null;

    const ini = limpio.search(/\[\s*\{/);
    if (ini !== -1) {
        const fin = limpio.lastIndexOf(']');
        const completo = fin > ini && comoArray(parsear(limpio.slice(ini, fin + 1)));
        if (completo) return completo;
        // Respuesta cortada: quedarse hasta el último objeto cerrado
        const ultimo = limpio.lastIndexOf('}');
        const cortado = ultimo > ini && comoArray(parsear(limpio.slice(ini, ultimo + 1) + ']'));
        if (cortado) return cortado;
    }
    const obj = limpio.indexOf('{');
    const envuelto = obj !== -1 && comoArray(parsear(limpio.slice(obj, limpio.lastIndexOf('}') + 1)));
    if (envuelto) return envuelto;

    // Último recurso: objeto a objeto, sacando los campos con regex. Rescata JSON
    // con comillas sin escapar dentro de los textos (aspecto de "rollo").
    const campo = (trozo, nombre) =>
        trozo.match(new RegExp(`"${nombre}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?=,\\s*"\\w+"\\s*:|\\s*\\}?$)`))?.[1];
    const lista = (trozo, nombre) => {
        const m = trozo.match(new RegExp(`"${nombre}"\\s*:\\s*\\[([\\s\\S]*?)\\]`));
        return m ? (m[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map(x => x.slice(1, -1)) : undefined;
    };
    const rescatados = (limpio.match(/\{[^{}]*\}/g) || [])
        .map(t => t.trim())
        .map(t => parsear(t) || {
            letra: campo(t, 'letra'), pregunta: campo(t, 'pregunta'), respuesta: campo(t, 'respuesta'),
            correcta: campo(t, 'correcta'), incorrectas: lista(t, 'incorrectas'),
            terminoA: campo(t, 'terminoA'), terminoB: campo(t, 'terminoB'),
        })
        .filter(q => q && typeof q === 'object' && !Array.isArray(q));
    if (rescatados.length) return rescatados;

    throw new Error(`JSON no válido (empieza por: "${limpio.slice(0, 80).replace(/\s+/g, ' ')}…")`);
}

// ---------------------------------------------------------------------------
// VALIDACIÓN POR JUEGO → formato del editor
// ---------------------------------------------------------------------------

export function validarRosco(crudo) {
    const usadas = new Set();
    const preguntas = [];
    for (const q of crudo) {
        const pregunta = limpiarStr(q?.pregunta);
        const respuesta = limpiarStr(q?.respuesta);
        const letra = sinTildes(String(q?.letra || respuesta.charAt(0) || '')).toUpperCase().charAt(0);
        if (!pregunta || !respuesta || !ABC.includes(letra) || usadas.has(letra)) continue;
        // "Contiene la X" (en cualquier idioma) → basta con contenerla; si no, debe empezar por ella
        const resp = sinTildes(respuesta).toUpperCase();
        const contiene = /^\s*(contiene|contains|contient|cont[eé]|enth[aä]lt|cont[eé]m)\b/i.test(pregunta);
        if (contiene ? !resp.includes(letra) : !resp.startsWith(letra)) continue;
        // Notas del propio modelo coladas en la definición ("Nota: no es válida…")
        if (/\(\s*nota|\bnot[ae]\s*:|corregir|no es v[aá]lid/i.test(pregunta)) continue;
        usadas.add(letra);
        preguntas.push({ letra, pregunta, respuesta, correcta: '', incorrectas: ['', '', ''] });
    }
    return preguntas.sort((a, b) => a.letra.localeCompare(b.letra));
}

function validarOpcionMultiple(crudo) {
    const vistas = new Set();
    const preguntas = [];
    for (const q of crudo) {
        const pregunta = limpiarStr(q?.pregunta);
        const correcta = limpiarStr(q?.correcta ?? q?.respuesta);
        if (!pregunta || !correcta || vistas.has(pregunta.toLowerCase())) continue;
        const incorrectas = [...new Set((Array.isArray(q?.incorrectas) ? q.incorrectas : [])
            .map(limpiarStr)
            .filter(x => x && x.toLowerCase() !== correcta.toLowerCase()))]
            .slice(0, 3);
        if (incorrectas.length < 2) continue;
        while (incorrectas.length < 3) incorrectas.push('');
        vistas.add(pregunta.toLowerCase());
        preguntas.push({ pregunta, respuesta: correcta, correcta, incorrectas });
    }
    // Huecos de incorrectas → respuestas correctas de otras preguntas (como el Conversor)
    const pool = preguntas.map(q => q.correcta);
    for (const q of preguntas) {
        const otras = pool.filter(r => r !== q.correcta && !q.incorrectas.includes(r));
        q.incorrectas = q.incorrectas.map(x => x || otras.shift() || '');
    }
    return preguntas;
}

function validarParejas(crudo) {
    const vistosA = new Set();
    const vistosB = new Set();
    const parejas = [];
    for (const q of crudo) {
        const terminoA = limpiarStr(q?.terminoA ?? q?.pregunta);
        const terminoB = limpiarStr(q?.terminoB ?? q?.respuesta);
        if (!terminoA || !terminoB) continue;
        if (vistosA.has(terminoA.toLowerCase()) || vistosB.has(terminoB.toLowerCase())) continue;
        vistosA.add(terminoA.toLowerCase());
        vistosB.add(terminoB.toLowerCase());
        parejas.push({ terminoA, terminoB, pregunta: '', respuesta: '', correcta: '', incorrectas: ['', '', ''] });
    }
    return parejas;
}

/**
 * Convierte la respuesta de la IA en las hojas del editor.
 * @returns {{ hojas: Array, validas: number }}  lanza Error si no se puede leer nada.
 */
export function interpretarRespuesta(tipo, texto, params) {
    const p = normalizarParams(tipo, params);
    const crudo = extraerArrayJSON(texto);

    let preguntas;
    if (tipo === 'PASAPALABRA') preguntas = validarRosco(crudo);
    else if (tipo === 'APAREJADOS') preguntas = validarParejas(crudo);
    else preguntas = validarOpcionMultiple(crudo);
    preguntas = preguntas.slice(0, p.n);

    const hoja = { nombreHoja: (p.tema || 'IA').slice(0, 40), preguntas };
    if (tipo === 'RULETA') {
        const frases = (extraerObjeto(texto)?.frases || [])
            .map(f => limpiarStr(f).toUpperCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(0, 3);
        hoja.frasesOcultas = frases.length ? frases : [''];
    }
    return { hojas: [hoja], validas: preguntas.length };
}
