// Listening creado por el profesor (tipoJuego LISTENING_RECURSO).
// Lógica compartida por el editor (components/EditorListening.jsx) y el juego
// (ListeningRecursoGame.jsx): voces, prompt para la IA, importador de la
// respuesta y montaje de los huecos en el formato del ListeningGame.
//
// Estructura del recurso (Firestore `resources`):
//   titulo, idioma, nivel, texto, dialogo, voz, voz2, velocidad,
//   huecos:    [{ id, palabra, ocurrencia, distractores: [] }]
//   preguntas: [{ id, enunciado, opciones: [], correcta }]
//   ordenPartes: 'preguntas' | 'huecos'   (qué se hace primero)
//   audioUrl, audioPublicId, audioDuracion, audioFirma
// El hueco se localiza por palabra + nº de aparición (no por posición), así
// sobrevive a retoques del texto en otras partes.

export const TIPO_LISTENING_RECURSO = 'LISTENING_RECURSO';

export const IDIOMAS_CREAR = {
    en: { flag: '🇬🇧', nombre: 'inglés',    label: 'English',   lang: 'en-GB', voces: [
        { id: 'en-GB-SoniaNeural', label: 'Sonia · UK' }, { id: 'en-GB-RyanNeural', label: 'Ryan · UK' },
        { id: 'en-US-JennyNeural', label: 'Jenny · US' }, { id: 'en-US-GuyNeural', label: 'Guy · US' },
    ] },
    fr: { flag: '🇫🇷', nombre: 'francés',   label: 'Français',  lang: 'fr-FR', voces: [
        { id: 'fr-FR-DeniseNeural', label: 'Denise' }, { id: 'fr-FR-HenriNeural', label: 'Henri' },
    ] },
    de: { flag: '🇩🇪', nombre: 'alemán',    label: 'Deutsch',   lang: 'de-DE', voces: [
        { id: 'de-DE-KatjaNeural', label: 'Katja' }, { id: 'de-DE-ConradNeural', label: 'Conrad' },
    ] },
    it: { flag: '🇮🇹', nombre: 'italiano',  label: 'Italiano',  lang: 'it-IT', voces: [
        { id: 'it-IT-ElsaNeural', label: 'Elsa' }, { id: 'it-IT-DiegoNeural', label: 'Diego' },
    ] },
    pt: { flag: '🇵🇹', nombre: 'portugués', label: 'Português', lang: 'pt-PT', voces: [
        { id: 'pt-PT-RaquelNeural', label: 'Raquel · PT' }, { id: 'pt-PT-DuarteNeural', label: 'Duarte · PT' },
        { id: 'pt-BR-FranciscaNeural', label: 'Francisca · BR' }, { id: 'pt-BR-AntonioNeural', label: 'Antonio · BR' },
    ] },
    es: { flag: '🇪🇸', nombre: 'español',   label: 'Español',   lang: 'es-ES', voces: [
        { id: 'es-ES-ElviraNeural', label: 'Elvira' }, { id: 'es-ES-AlvaroNeural', label: 'Álvaro' },
    ] },
    ca: { flag: '🏴', nombre: 'catalán',   label: 'Català',    lang: 'ca-ES', voces: [
        { id: 'ca-ES-JoanaNeural', label: 'Joana' }, { id: 'ca-ES-EnricNeural', label: 'Enric' },
    ] },
};

export const NIVELES_MCER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Velocidad de lectura (prosody rate de Edge)
export const VELOCIDADES_VOZ = [
    { id: '-25%', label: '🐢 Lenta' },
    { id: '-10%', label: '🙂 Pausada' },
    { id: '+0%',  label: '🗣️ Natural' },
];

export const TIPOS_TEXTO = [
    { id: 'narracion',  label: 'Narración / historia', dialogo: false },
    { id: 'dialogo',    label: 'Diálogo (2 personas)',  dialogo: true },
    { id: 'entrevista', label: 'Entrevista',            dialogo: true },
    { id: 'noticia',    label: 'Noticia / reportaje',   dialogo: false },
    { id: 'anuncio',    label: 'Anuncio / mensaje',     dialogo: false },
    { id: 'monologo',   label: 'Monólogo / exposición', dialogo: false },
];

// Palabras por minuto aproximadas según nivel (con la voz algo pausada)
const PPM = { A1: 80, A2: 95, B1: 110, B2: 125, C1: 140, C2: 150 };

export const getIdiomaCrear = (id) => IDIOMAS_CREAR[id] || IDIOMAS_CREAR.en;

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const contarPalabras = (texto) => (String(texto || '').match(/[\p{L}\p{N}]+/gu) || []).length;
export const minutosEstimados = (texto, nivel = 'B1') => contarPalabras(texto) / (PPM[nivel] || 110);

// ─── Prompt para la IA ────────────────────────────────────────────────────────
export function construirPrompt({ idioma = 'en', nivel = 'B1', minutos = 2, tema = '', tipoTexto = 'narracion', numHuecos = 8, numPreguntas = 5, publico = '' }) {
    const idi = getIdiomaCrear(idioma);
    const tipo = TIPOS_TEXTO.find(t => t.id === tipoTexto) || TIPOS_TEXTO[0];
    const palabras = Math.round((PPM[nivel] || 110) * minutos);
    const lineasDialogo = tipo.dialogo
        ? `\n- Es un texto dialogado entre 2 personas. Escribe CADA intervención en una línea nueva que empiece por el nombre del personaje y dos puntos (por ejemplo «Anna: ...»). Usa siempre los mismos 2 nombres, sin acotaciones ni narrador.`
        : `\n- Escríbelo en párrafos normales, sin títulos ni viñetas.`;

    return `Actúa como profesor/a experto/a en la enseñanza de ${idi.nombre} como lengua extranjera.

Crea el material para una actividad de LISTENING (el texto se convertirá en audio con una voz sintética):
- Idioma del texto: ${idi.nombre}
- Nivel MCER: ${nivel}. Vocabulario y estructuras gramaticales propios de ese nivel.
- Duración leído en voz alta: unos ${minutos} minuto${minutos === 1 ? '' : 's'} (≈ ${palabras} palabras).
- Tipo de texto: ${tipo.label.toLowerCase()}.
- Tema: ${tema.trim() || 'libre, cercano e interesante para el alumnado'}.${publico.trim() ? `\n- Alumnado: ${publico.trim()}.` : ''}${lineasDialogo}
- No uses emojis, abreviaturas raras ni símbolos que una voz no pueda leer bien.

Después:
1. HUECOS: elige ${numHuecos} palabras del texto para convertirlas en huecos. Cada una debe ser UNA sola palabra escrita exactamente igual que en el texto, repartidas a lo largo de todo el texto y en el mismo orden en que aparecen. Prioriza vocabulario clave y estructuras del nivel; evita nombres propios. Para cada una da 3 distractores plausibles (misma categoría gramatical, que puedan confundirse al oído o por el sentido).
2. PREGUNTAS: escribe ${numPreguntas} preguntas de comprensión sobre el texto, redactadas en ${idi.nombre}, de opción múltiple con 3 o 4 opciones y UNA sola correcta. Puedes incluir alguna de verdadero/falso con 2 opciones. Que no se puedan responder sin haber entendido el audio.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después y sin comentarios, con este formato exacto:
{
  "titulo": "Título corto en ${idi.nombre}",
  "idioma": "${idioma}",
  "nivel": "${nivel}",
  "texto": "Texto completo. Usa \\n para los saltos de línea.",
  "huecos": [
    { "palabra": "palabra_del_texto", "distractores": ["opción1", "opción2", "opción3"] }
  ],
  "preguntas": [
    { "pregunta": "Enunciado", "opciones": ["A", "B", "C", "D"], "correcta": 0 }
  ]
}
"correcta" es el índice (empezando en 0) de la opción correcta dentro de "opciones".`;
}

// ─── Importar la respuesta pegada ─────────────────────────────────────────────
const normalizarPalabra = (s) => String(s || '').toLowerCase().normalize('NFC').trim();

// Divide el texto en fichas: { t, palabra: bool }
export function tokenizar(texto) {
    const partes = String(texto || '').split(/([\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*)/u);
    return partes.filter(p => p !== '').map(t => ({ t, palabra: /^[\p{L}\p{M}\p{N}]/u.test(t) }));
}

// Posición (índice de ficha) de cada hueco en el texto; null si ya no está
export function localizarHuecos(tokens, huecos) {
    const pos = {};
    (huecos || []).forEach(h => {
        const objetivo = normalizarPalabra(h.palabra);
        let visto = 0;
        pos[h.id] = null;
        for (let i = 0; i < tokens.length; i++) {
            if (!tokens[i].palabra || normalizarPalabra(tokens[i].t) !== objetivo) continue;
            visto++;
            if (visto === (h.ocurrencia || 1)) { pos[h.id] = i; break; }
        }
    });
    return pos;
}

// Nº de aparición de la ficha i entre las fichas con la misma palabra
export function ocurrenciaEn(tokens, i) {
    const objetivo = normalizarPalabra(tokens[i].t);
    let n = 0;
    for (let k = 0; k <= i; k++) if (tokens[k].palabra && normalizarPalabra(tokens[k].t) === objetivo) n++;
    return n;
}

// Distractores de relleno: otras palabras del propio texto de longitud parecida
export function distractoresAuto(texto, palabra, n = 3) {
    const obj = normalizarPalabra(palabra);
    const vistas = new Set([obj]);
    const candidatas = tokenizar(texto)
        .filter(t => t.palabra && t.t.length >= 3 && !/^\p{N}+$/u.test(t.t))
        .map(t => t.t.toLowerCase())
        .filter(w => { if (vistas.has(w)) return false; vistas.add(w); return true; })
        .sort((a, b) => Math.abs(a.length - obj.length) - Math.abs(b.length - obj.length) || Math.random() - 0.5);
    return candidatas.slice(0, Math.max(n * 3, n)).sort(() => Math.random() - 0.5).slice(0, n);
}

function sacarJSON(txt) {
    let s = String(txt || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
    const i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('No encuentro ningún bloque JSON en lo que has pegado.');
    s = s.slice(i, j + 1);
    try { return JSON.parse(s); }
    catch (e1) {
        // Arreglos habituales: comas finales y comillas tipográficas en las claves
        const arreglado = s.replace(/,\s*([}\]])/g, '$1').replace(/[“”]([^“”]*)[“”]\s*:/g, '"$1":');
        try { return JSON.parse(arreglado); }
        catch { throw new Error('El JSON no es válido: ' + e1.message); }
    }
}

const indiceCorrecta = (correcta, opciones) => {
    if (typeof correcta === 'number') return correcta >= 0 && correcta < opciones.length ? correcta : 0;
    const s = String(correcta ?? '').trim();
    if (/^\d+$/.test(s)) return Math.min(parseInt(s, 10), opciones.length - 1);
    if (/^[A-Da-d]$/.test(s)) return Math.min(s.toUpperCase().charCodeAt(0) - 65, opciones.length - 1);
    const k = opciones.findIndex(o => normalizarPalabra(o) === normalizarPalabra(s));
    return k >= 0 ? k : 0;
};

/** Convierte la respuesta de la IA en campos del recurso. Lanza Error si no se puede leer. */
export function importarRespuestaIA(txt) {
    const obj = sacarJSON(txt);
    const avisos = [];
    const texto = Array.isArray(obj.texto) ? obj.texto.join('\n') : String(obj.texto || obj.text || '').trim();
    if (!texto) throw new Error('La respuesta no trae el campo "texto".');

    // Huecos: se buscan en orden, cada uno después del anterior
    const tokens = tokenizar(texto);
    const huecos = [];
    const ocupadas = new Set();
    let desde = 0;
    for (const h of (obj.huecos || obj.gaps || [])) {
        const palabra = String(h.palabra || h.word || h.answer || '').trim();
        if (!palabra) continue;
        if (/\s/.test(palabra)) { avisos.push(`«${palabra}» tiene varias palabras: se ha descartado.`); continue; }
        const objetivo = normalizarPalabra(palabra);
        const buscar = (ini) => tokens.findIndex((t, i) => i >= ini && t.palabra && !ocupadas.has(i) && normalizarPalabra(t.t) === objetivo);
        let i = buscar(desde);
        if (i < 0) i = buscar(0);
        if (i < 0) { avisos.push(`«${palabra}» no aparece en el texto: se ha descartado.`); continue; }
        ocupadas.add(i);
        desde = i + 1;
        const distractores = (h.distractores || h.opciones || h.options || [])
            .map(x => String(x).trim()).filter(x => x && normalizarPalabra(x) !== objetivo).slice(0, 3);
        huecos.push({ id: nuevoId(), palabra: tokens[i].t, ocurrencia: ocurrenciaEn(tokens, i),
            distractores: distractores.length ? distractores : distractoresAuto(texto, palabra) });
    }

    const preguntas = (obj.preguntas || obj.questions || []).map(p => {
        const opciones = (p.opciones || p.options || []).map(x => String(x).trim()).filter(Boolean);
        return { id: nuevoId(), enunciado: String(p.pregunta || p.enunciado || p.question || '').trim(), opciones, correcta: indiceCorrecta(p.correcta ?? p.correct ?? p.answer, opciones) };
    }).filter(p => p.enunciado && p.opciones.length >= 2);

    const idioma = IDIOMAS_CREAR[obj.idioma] ? obj.idioma : null;
    const nivel = NIVELES_MCER.includes(String(obj.nivel || '').toUpperCase()) ? String(obj.nivel).toUpperCase() : null;
    // Diálogo si casi todas las líneas empiezan por "Nombre:"
    const lineas = texto.split(/\n+/).filter(l => l.trim());
    const conPersonaje = lineas.filter(l => /^\p{L}[\p{L} .'-]{0,28}:\s/u.test(l.trim())).length;
    const dialogo = lineas.length >= 2 && conPersonaje / lineas.length >= 0.7;

    return {
        campos: { titulo: String(obj.titulo || obj.title || '').trim(), texto, huecos, preguntas, dialogo,
            ...(idioma ? { idioma } : {}), ...(nivel ? { nivel } : {}) },
        avisos,
    };
}

// ─── Del recurso al ítem del ListeningGame ────────────────────────────────────
const barajar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** { id, titulo, audioUrl, fullTranscript, gappedTranscript, gaps } — mismo formato que las bibliotecas. */
export function construirItem(recurso) {
    const texto = recurso.texto || '';
    const tokens = tokenizar(texto);
    const pos = localizarHuecos(tokens, recurso.huecos);
    const porPos = {};
    (recurso.huecos || []).forEach(h => { if (pos[h.id] != null) porPos[pos[h.id]] = h; });

    const gaps = [];
    const trozos = tokens.map((tk, i) => {
        const h = porPos[i];
        if (!h) return tk.t;
        const n = gaps.length + 1;
        const opciones = barajar([tk.t, ...(h.distractores || []).filter(Boolean)]);
        gaps.push({ gap_number: n, answer: tk.t, multiple_choice_options: opciones });
        return `[___${n}___]`;
    });
    return {
        id: recurso.id || 'listening-propio',
        titulo: recurso.titulo || 'Listening',
        audioUrl: recurso.audioUrl || '',
        fullTranscript: texto,
        gappedTranscript: trozos.join(''),
        gaps,
    };
}

// Firma de lo que se ha grabado: si cambia, el audio está desactualizado
export function firmaAudio(r) {
    const s = [r.texto, r.voz, r.voz2, r.dialogo ? 1 : 0, r.velocidad].join('|');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}
