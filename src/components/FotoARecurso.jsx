import React, { useState, useRef, useCallback } from 'react';
import { callGeminiProxy, extractText } from '../geminiProxy.js';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';

// ─── Constantes ────────────────────────────────────────────────────────────────
const JUEGOS = [
    {
        id: 'PASAPALABRA',
        label: 'Pasapalabra',
        emoji: '🔤',
        color: '#3F51B5',
        colorLight: '#E8EAF6',
        desc: 'Definiciones por letra del abecedario',
        ejemplo: '[{"letra":"A","pregunta":"Capital de España","respuesta":"Madrid"}]',
    },
    {
        id: 'CAZABURBUJAS',
        label: 'Burbujas',
        emoji: '🫧',
        color: '#E91E63',
        colorLight: '#FCE4EC',
        desc: 'Preguntas de opción múltiple',
        ejemplo: '[{"pregunta":"¿...?","correcta":"Bien","incorrectas":["Mal1","Mal2","Mal3"]}]',
    },
    {
        id: 'APAREJADOS',
        label: 'AparejaDOS',
        emoji: '🔗',
        color: '#FF9800',
        colorLight: '#FFF3E0',
        desc: 'Parejas de conceptos para unir',
        ejemplo: '[{"terminoA":"Concepto","terminoB":"Definición"}]',
    },
    {
        id: 'THINKHOOT',
        label: 'Pi-Live',
        emoji: '⚡',
        color: '#9C27B0',
        colorLight: '#F3E5F5',
        desc: 'Quiz competitivo tipo Kahoot',
        ejemplo: '[{"pregunta":"...","correcta":"...","incorrectas":["...","...","..."]}]',
    },
    {
        id: 'PILIVE_PRO',
        label: 'Pi Live Pro',
        emoji: '🎯',
        color: '#00897B',
        colorLight: '#E0F2F1',
        desc: 'Mix de tipos: opción múltiple, respuesta corta, ordenar, rellenar, dibujo',
        ejemplo: '[{"tipo":"MULTIPLE","pregunta":"...","correcta":"...","incorrectas":["...","...","..."]}]',
    },
];

const MODELOS_GEMINI = ['gemini-2.0-flash', 'gemini-2.5-flash'];

// Instrucciones comunes a todos los prompts
const INSTRUCCIONES_COMUNES = `
⚠️ OUTPUT LANGUAGE RULE (HIGHEST PRIORITY — NEVER IGNORE):
Detect the language of the document image. ALL JSON field values (pregunta, respuesta, correcta, incorrectas, terminoA, terminoB, bloques, etc.) MUST be written in THAT SAME language.
- Document in English → write every value in English. NEVER translate to Spanish.
- Document in French → write every value in French.
- Document in Spanish → write every value in Spanish.
This rule overrides everything else. The JSON keys remain as specified, but the VALUES use the document's language.

REGLAS ESTRICTAS DE CALIDAD (aplícalas antes de incluir cualquier pregunta):
1. AUTOSUFICIENCIA: Cada pregunta debe poder responderse SIN ver el documento. Si hace referencia a "el ejercicio anterior", "el párrafo 3" o algo externo → DESCÁRTALA.
2. LONGITUD: El enunciado no debe superar 15 palabras. Reformúlalo si es necesario.
3. NIVEL ESO: Lenguaje adecuado para alumnos de secundaria (12-16 años).
4. REFORMULACIÓN: Ejercicios tipo "Calcula 3x+5=20" → pregunta directa "¿Cuánto vale x si 3x+5=20?".
5. COMPLETO: La respuesta correcta debe deducirse del enunciado, nunca de contexto externo.
`;

const PROMPTS = {
    PASAPALABRA: `Eres un asistente que convierte documentos educativos en juegos de Pasapalabra para alumnos de ESO.
${INSTRUCCIONES_COMUNES}
TAREA:
- Lee el documento imagen completo.
- Muy importnte, para cada concepto, término o pregunta válida que encuentres, genera una DEFINICIÓN BREVE (máx 15 palabras) cuya respuesta sea UNA SOLA PALABRA que empiece por una letra del abecedario.
- La definición debe poder responderse sin ver el documento original.
- Varía las letras: intenta cubrir distintas letras del abecedario.

Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin texto extra):
[{"letra":"A","pregunta":"Definición breve y autosuficiente","respuesta":"PalabraQueEmpiezaPorA"}, ...]
Si no hay contenido aprovechable responde exactamente: {"error":"No se pudo extraer contenido"}`,

    CAZABURBUJAS: `Eres un asistente que convierte documentos educativos en preguntas de opción múltiple para alumnos de ESO.
${INSTRUCCIONES_COMUNES}
TAREA:
- Lee el documento imagen completo.
- Muy importante, para cada pregunta del documento o concepto válido, que encuentres, formula una pregunta directa (máx 15 palabras) que se pueda responder sin ver el documento.
- Inventa 3 respuestas incorrectas pero plausibles y del mismo tipo que la correcta (no absurdas).
- Si el documento tiene ejercicios numéricos, incluye también opciones numéricas cercanas al valor correcto.

Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin texto extra):
[{"pregunta":"Pregunta autosuficiente (máx 15 palabras)","correcta":"Respuesta correcta","incorrectas":["Opción2","Opción3","Opción4"]}, ...]
Si no hay contenido aprovechable responde exactamente: {"error":"No se pudo extraer contenido"}`,

    APAREJADOS: `Eres un asistente que convierte documentos educativos en ejercicios de emparejar para alumnos de ESO.
${INSTRUCCIONES_COMUNES}
TAREA:
- Lee el documento imagen completo.
- Extrae pares de conceptos relacionados: término-definición, causa-consecuencia, pregunta-respuesta, fórmula-nombre, fecha-evento, palabra-traducción, etc.
- El término A debe ser breve (1-5 palabras). El término B debe ser una respuesta concisa (máx 10 palabras).
- Ambos términos deben ser comprensibles sin necesidad del documento original.

Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin texto extra):
[{"terminoA":"Concepto breve","terminoB":"Definición o respuesta concisa"}, ...]
Si no hay contenido aprovechable responde exactamente: {"error":"No se pudo extraer contenido"}`,

    THINKHOOT: `Eres un asistente que convierte documentos educativos en preguntas de quiz rápido para alumnos de ESO.
${INSTRUCCIONES_COMUNES}
TAREA:
- Lee el documento imagen completo.
- Muy importante, para cada pregunta o concepto válido que encuentres, formula una pregunta directa (máx 15 palabras) que se pueda responder sin ver el documento.
- Inventa 3 respuestas incorrectas plausibles. En un quiz rápido las opciones deben ser cortas (1-4 palabras si es posible).
- Prioriza preguntas con respuesta única y clara.

Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin texto extra):
[{"pregunta":"Pregunta autosuficiente (máx 15 palabras)","correcta":"Respuesta","incorrectas":["Opción2","Opción3","Opción4"]}, ...]
Si no hay contenido aprovechable responde exactamente: {"error":"No se pudo extraer contenido"}`,

    PILIVE_PRO: `You are an assistant that converts educational documents into a mixed set of interactive questions for secondary school students (ESO / 12-16 years old).
${INSTRUCCIONES_COMUNES}
TASK:
- Read the entire document image.
- For each question, exercise or concept found, choose the BEST question type from the list below and produce the matching JSON object.
- Generate a variety of types when the document allows it.

QUESTION TYPES AND THEIR EXACT JSON FORMAT:

1. MULTIPLE — Multiple-choice question (use when there is one clear correct answer and plausible wrong options can be invented):
   {"tipo":"MULTIPLE","pregunta":"Question (max 15 words)","correcta":"Correct answer","incorrectas":["Wrong1","Wrong2","Wrong3"],"tiempo":20,"puntosMax":100,"puntosMin":10}

2. SIMPLE — Short answer (use for definitions, calculations with a single numerical/textual answer, or when inventing wrong options is hard):
   {"tipo":"SIMPLE","pregunta":"Question (max 15 words)","respuesta":"Correct answer","tiempo":30,"puntosMax":100,"puntosMin":10}

3. ORDENAR — Put items in order (use when the document has steps, sequences, chronological events or processes to sort):
   {"tipo":"ORDENAR","pregunta":"Order the following steps / Put in chronological order...","bloques":["Item1","Item2","Item3","Item4"],"numBloques":4,"tiempo":45,"puntosMax":100,"puntosMin":10}
   IMPORTANT: "bloques" must list items in their CORRECT order. The game will shuffle them for the student.
   Use between 3 and 6 bloques. Set numBloques to match the length of bloques.

4. RELLENAR — Fill in the blank (use for sentences with a key term missing, vocabulary, formulas):
   {"tipo":"RELLENAR","pregunta":"Complete sentence with ___ where the blank goes","respuesta":"Word that fills the blank","tiempo":25,"puntosMax":100,"puntosMin":10}
   IMPORTANT: use exactly three underscores ___ to mark the blank in the sentence. The sentence must be self-contained.

5. DIBUJO — Drawing prompt (use ONLY when the document explicitly asks to draw, sketch or diagram something):
   {"tipo":"DIBUJO","pregunta":"Draw / Sketch / Label the diagram of...","tiempo":120,"puntosMax":100,"puntosMin":10}

Return ONLY a valid JSON array (no markdown, no extra text):
[{...}, {...}, ...]
If no usable educational content is found, respond exactly: {"error":"No se pudo extraer contenido"}`,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const generarCodigo = () =>
    Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

const fileToBase64 = (file) =>
    new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
    });

const validarPreguntas = (json, tipoJuego) => {
    if (!Array.isArray(json) || json.length === 0) return false;
    const item = json[0];
    if (tipoJuego === 'PASAPALABRA') return item.letra && item.pregunta && item.respuesta;
    if (tipoJuego === 'CAZABURBUJAS' || tipoJuego === 'THINKHOOT') return item.pregunta && item.correcta;
    if (tipoJuego === 'APAREJADOS') return item.terminoA && item.terminoB;
    if (tipoJuego === 'PILIVE_PRO') return item.tipo && item.pregunta;
    return false;
};

// ─── Componente principal ──────────────────────────────────────────────────────
export default function FotoARecurso({ usuario, perfilProfesor }) {
    const [paso, setPaso] = useState(1); // 1=juego, 2=foto, 3=resultado
    const [juegoSel, setJuegoSel] = useState(null);
    const [imagen, setImagen] = useState(null);      // { file, dataUrl }
    const [procesando, setProcesando] = useState(false);
    const [progreso, setProgreso] = useState('');
    const [preguntas, setPreguntas] = useState(null);
    const [error, setError] = useState('');
    const [tituloRecurso, setTituloRecurso] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const [arrastrando, setArrastrando] = useState(false);
    const inputRef = useRef(null);
    const [modalDestino, setModalDestino] = useState(false);
    const [destino, setDestino]           = useState('NUEVO'); // 'NUEVO' | 'HOJA_NUEVA' | 'HOJA_EXIST'
    const [recursosExist, setRecursosExist] = useState([]);
    const [recursoDestId, setRecursoDestId] = useState('');
    const [hojaDestIdx, setHojaDestIdx]   = useState(0);
    const [nombreHojaNueva, setNombreHojaNueva] = useState('Desde foto');

    const juego = JUEGOS.find(j => j.id === juegoSel);

    // ── Subida de imagen ──────────────────────────────────────────────────────
    const procesarArchivo = (file) => {
        if (!file) return;
        const esImagen = file.type.startsWith('image/');
        const esPDF    = file.type === 'application/pdf';
        if (!esImagen && !esPDF) {
            setError('Por favor sube una imagen (JPG, PNG, WEBP...) o un PDF');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setError('El archivo es demasiado grande (máx 20MB)');
            return;
        }
        setError('');
        if (esImagen) {
            const reader = new FileReader();
            reader.onload = (e) => setImagen({ file, dataUrl: e.target.result, esPDF: false });
            reader.readAsDataURL(file);
        } else {
            // PDF: mostrar icono en lugar de preview de imagen
            setImagen({ file, dataUrl: null, esPDF: true });
        }
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setArrastrando(false);
        procesarArchivo(e.dataTransfer.files[0]);
    }, []);

    // ── Llamar a Gemini con visión ────────────────────────────────────────────
    const procesarConGemini = async () => {

        if (!imagen) { setError('Sube una imagen primero'); return; }

        setProcesando(true);
        setError('');
        setPreguntas(null);

        const base64 = await fileToBase64(imagen.file);
        const mimeType = imagen.esPDF ? 'application/pdf' : imagen.file.type;
        let errorFinal = null;

        for (const modelo of MODELOS_GEMINI) {
            try {
                setProgreso(`🔍 Analizando imagen con ${modelo}...`);
                const data = await callGeminiProxy({
                    model: modelo,
                    contents: [{ parts: [
                        { text: PROMPTS[juegoSel] },
                        { inline_data: { mime_type: mimeType, data: base64 } },
                    ]}],
                });

                const texto = extractText(data).replace(/```json/g, '').replace(/```/g, '').trim();

                // Detectar error explícito de Gemini
                if (texto.includes('"error"')) {
                    setError('No se encontró contenido educativo en la imagen. Prueba con otra foto más clara.');
                    setProcesando(false);
                    return;
                }

                const parsed = JSON.parse(texto);

                if (!validarPreguntas(parsed, juegoSel)) {
                    setError('La IA generó datos en formato incorrecto. Prueba con otra imagen.');
                    setProcesando(false);
                    return;
                }

                setProgreso(`✅ ¡Extraídas ${parsed.length} preguntas!`);
                setPreguntas(parsed);
                setTituloRecurso(`Recurso desde foto · ${juego.label}`);
                setPaso(3);
                setProcesando(false);
                return;

            } catch (e) {
                console.warn(`❌ ${modelo}:`, e.message);
                if (e.message?.includes('429')) {
                    setError('⏳ La IA está saturada (Error 429). Espera 1 minuto y vuelve a intentarlo.');
                    setProcesando(false);
                    return;
                }
                errorFinal = e;
            }
        }

        setError(`No se pudo procesar la imagen. ${errorFinal?.message || ''}`);
        setProcesando(false);
    };

    // ── Construir hoja a partir de las preguntas ─────────────────────────────
    const construirHoja = (nombre) => {
        if (juegoSel === 'APAREJADOS') return { nombreHoja: nombre, parejas: preguntas };
        return { nombreHoja: nombre, preguntas };
    };

    // ── Abrir modal de destino ────────────────────────────────────────────────
    const abrirModalDestino = async () => {
        if (!tituloRecurso.trim() && destino === 'NUEVO') {
            setError('Ponle un título al recurso'); return;
        }
        setError('');
        // Cargar recursos del profesor del mismo tipo para poder añadir a uno existente
        try {
            const q = query(collection(db,'resources'), where('profesorUid','==',usuario.uid), where('tipoJuego','==',juegoSel));
            const snap = await getDocs(q);
            setRecursosExist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch(e) { console.warn(e); }
        setModalDestino(true);
    };

    // ── Guardar según destino elegido ─────────────────────────────────────────
    const guardarConDestino = async () => {
        setGuardando(true); setError('');
        try {
            if (destino === 'NUEVO') {
                if (!tituloRecurso.trim()) { setError('Ponle un título al recurso'); setGuardando(false); return; }
                await addDoc(collection(db,'resources'), {
                    titulo: tituloRecurso.trim(), temas: 'Generado desde foto/PDF',
                    tipoJuego: juegoSel, profesorUid: usuario.uid,
                    profesorNombre: perfilProfesor?.nombre || usuario.displayName || '',
                    pais: perfilProfesor?.pais || '', region: perfilProfesor?.region || '',
                    poblacion: perfilProfesor?.poblacion || '',
                    hojas: [construirHoja('Desde foto')],
                    config: juegoSel === 'PILIVE_PRO' ? { aleatorio: true, numPreguntas: preguntas.length } : {},
                    ...(juegoSel === 'PILIVE_PRO' && { tipo: 'PRO' }),
                    isPrivate: true, origen: 'foto-ia',
                    accessCode: generarCodigo(), playCount: 0, fechaCreacion: new Date(),
                });
            } else if (destino === 'HOJA_NUEVA') {
                if (!recursoDestId) { setError('Elige un recurso'); setGuardando(false); return; }
                const nombre = nombreHojaNueva.trim() || 'Desde foto';
                await updateDoc(doc(db,'resources',recursoDestId), {
                    hojas: arrayUnion(construirHoja(nombre))
                });
            } else if (destino === 'HOJA_EXIST') {
                if (!recursoDestId) { setError('Elige un recurso'); setGuardando(false); return; }
                const recurso = recursosExist.find(r => r.id === recursoDestId);
                const hoja = recurso?.hojas?.[hojaDestIdx];
                if (!hoja) { setError('Hoja no encontrada'); setGuardando(false); return; }
                const nuevasHojas = recurso.hojas.map((h, i) => {
                    if (i !== hojaDestIdx) return h;
                    if (juegoSel === 'APAREJADOS') return { ...h, parejas: [...(h.parejas||[]), ...preguntas] };
                    return { ...h, preguntas: [...(h.preguntas||[]), ...preguntas] };
                });
                await updateDoc(doc(db,'resources',recursoDestId), { hojas: nuevasHojas });
            }
            setModalDestino(false);
            setGuardadoOk(true);
        } catch(e) {
            setError('Error al guardar: ' + e.message);
        }
        setGuardando(false);
    };

    const reiniciar = () => {
        setPaso(1); setJuegoSel(null); setImagen(null);
        setPreguntas(null); setError(''); setProgreso('');
        setGuardadoOk(false); setTituloRecurso('');
    };

    // ─── RENDER ─────────────────────────────────────────────────────────────
    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 40px' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: '2.8rem', marginBottom: 6 }}>📸</div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1a1a2e' }}>
                    Foto → Recurso
                </h2>
                <p style={{ margin: '6px 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                    Fotografía cualquier documento con preguntas y la IA lo convierte automáticamente
                </p>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
                {['Elige juego', 'Añade foto', 'Revisa y guarda'].map((label, i) => {
                    const num = i + 1;
                    const activo = paso === num;
                    const hecho = paso > num;
                    return (
                        <React.Fragment key={num}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '0.88rem',
                                    background: hecho ? '#27ae60' : activo ? '#2980b9' : '#ecf0f1',
                                    color: (hecho || activo) ? 'white' : '#aaa',
                                    transition: 'all 0.3s',
                                }}>
                                    {hecho ? '✓' : num}
                                </div>
                                <span style={{ fontSize: '0.7rem', color: activo ? '#2980b9' : '#aaa', fontWeight: activo ? 700 : 400, whiteSpace: 'nowrap' }}>
                                    {label}
                                </span>
                            </div>
                            {i < 2 && <div style={{ width: 48, height: 2, background: paso > i + 1 ? '#27ae60' : '#ecf0f1', margin: '0 4px 18px', transition: 'all 0.3s' }} />}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ── PASO 1: Seleccionar juego ── */}
            {paso === 1 && (
                <div style={{ background: 'white', borderRadius: 18, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#2c3e50', fontWeight: 700 }}>
                        ¿A qué juego vas a convertir las preguntas?
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {JUEGOS.map(j => (
                            <button key={j.id} onClick={() => setJuegoSel(j.id)}
                                style={{
                                    padding: '16px 14px', borderRadius: 14, border: `2px solid ${juegoSel === j.id ? j.color : '#e8ecf0'}`,
                                    background: juegoSel === j.id ? j.colorLight : 'white',
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s', fontFamily: 'inherit',
                                    boxShadow: juegoSel === j.id ? `0 4px 14px ${j.color}33` : 'none',
                                }}
                            >
                                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{j.emoji}</div>
                                <div style={{ fontWeight: 700, color: j.id === juegoSel ? j.color : '#2c3e50', fontSize: '0.92rem' }}>{j.label}</div>
                                <div style={{ fontSize: '0.74rem', color: '#7f8c8d', marginTop: 2 }}>{j.desc}</div>
                            </button>
                        ))}
                    </div>


                    <button
                        onClick={() => { if (!juegoSel) { setError('Elige un juego primero'); return; } setError(''); setPaso(2); }}
                        disabled={!juegoSel}
                        style={{
                            marginTop: 20, width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                            background: juegoSel ? '#2980b9' : '#ecf0f1', color: juegoSel ? 'white' : '#aaa',
                            fontWeight: 700, fontSize: '0.95rem', cursor: juegoSel ? 'pointer' : 'default',
                            transition: 'all 0.2s', fontFamily: 'inherit',
                        }}
                    >
                        Continuar →
                    </button>
                    {error && <p style={{ color: '#e74c3c', fontSize: '0.82rem', marginTop: 8, textAlign: 'center' }}>⚠ {error}</p>}
                </div>
            )}

            {/* ── PASO 2: Subir foto ── */}
            {paso === 2 && (
                <div style={{ background: 'white', borderRadius: 18, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <div style={{ background: juego.colorLight, borderRadius: 10, padding: '6px 12px', color: juego.color, fontWeight: 700, fontSize: '0.88rem' }}>
                            {juego.emoji} {juego.label}
                        </div>
                        <button onClick={() => { setPaso(1); setImagen(null); setError(''); }} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.78rem', color: '#7f8c8d' }}>
                            ← Cambiar
                        </button>
                    </div>

                    {/* Zona de drag & drop */}
                    <div
                        onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
                        onDragLeave={() => setArrastrando(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        style={{
                            border: `2.5px dashed ${arrastrando ? juego.color : (imagen ? '#27ae60' : '#c8d6e5')}`,
                            borderRadius: 16, padding: imagen ? 12 : '32px 24px',
                            textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                            background: arrastrando ? juego.colorLight : (imagen ? '#f0fdf4' : '#fafbfc'),
                            position: 'relative', overflow: 'hidden',
                        }}
                    >
                        <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                            onChange={e => procesarArchivo(e.target.files[0])} />

                        {imagen ? (
                            <div>
                                {imagen.esPDF ? (
                                    <div style={{ fontSize: '4rem', marginBottom: 8 }}>📄</div>
                                ) : (
                                    <img src={imagen.dataUrl} alt="preview"
                                        style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 10, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                                )}
                                <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#27ae60', fontWeight: 600 }}>
                                    ✅ {imagen.file.name} ({(imagen.file.size / 1024).toFixed(0)} KB) · Haz clic para cambiar
                                </p>
                            </div>
                        ) : (
                            <>
                                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📷</div>
                                <div style={{ fontWeight: 700, color: '#2c3e50', marginBottom: 4 }}>
                                    {arrastrando ? '¡Suelta la imagen!' : 'Arrastra tu foto aquí'}
                                </div>
                                <div style={{ color: '#aaa', fontSize: '0.82rem' }}>o haz clic para seleccionar · JPG, PNG, WEBP, PDF · Máx 20MB</div>
                            </>
                        )}
                    </div>

                    {/* Consejos */}
                    <div style={{ marginTop: 14, background: '#f8f9fa', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#5d6d7e' }}>
                        <strong>💡 Consejos para mejores resultados:</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                            <li>Foto bien iluminada y sin sombras</li>
                            <li>El texto debe ser legible (no girado ni borroso)</li>
                            <li>Cuantas más preguntas tenga el documento, mejor</li>
                        </ul>
                    </div>

                    {error && <p style={{ color: '#e74c3c', fontSize: '0.82rem', marginTop: 10, textAlign: 'center' }}>⚠ {error}</p>}

                    {procesando ? (
                        <div style={{ marginTop: 16, textAlign: 'center' }}>
                            <div style={{ display: 'inline-block', width: 36, height: 36, border: `4px solid ${juego.color}33`, borderTopColor: juego.color, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                            <p style={{ color: juego.color, fontWeight: 600, marginTop: 8, fontSize: '0.9rem' }}>{progreso}</p>
                        </div>
                    ) : (
                        <button
                            onClick={procesarConGemini}
                            disabled={!imagen}
                            style={{
                                marginTop: 16, width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                                background: imagen ? `linear-gradient(135deg, ${juego.color}, ${juego.color}cc)` : '#ecf0f1',
                                color: imagen ? 'white' : '#aaa', fontWeight: 700, fontSize: '0.95rem',
                                cursor: imagen ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.2s',
                                boxShadow: imagen ? `0 4px 16px ${juego.color}44` : 'none',
                            }}
                        >
                            🤖 Analizar con IA
                        </button>
                    )}
                </div>
            )}

            {/* ── PASO 3: Resultado ── */}
            {paso === 3 && preguntas && (
                <div style={{ background: 'white', borderRadius: 18, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

                    {guardadoOk ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>🎉</div>
                            <h3 style={{ margin: 0, color: '#27ae60', fontSize: '1.2rem' }}>¡Recurso creado!</h3>
                            <p style={{ color: '#7f8c8d', margin: '8px 0 20px', fontSize: '0.88rem' }}>
                                Ya aparece en tu lista de recursos privados como <strong>"{tituloRecurso}"</strong>
                            </p>
                            <button onClick={reiniciar} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#2980b9', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' }}>
                                📸 Crear otro recurso
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '6px 12px', color: '#27ae60', fontWeight: 700, fontSize: '0.88rem' }}>
                                    ✅ {preguntas.length} preguntas extraídas · {juego.emoji} {juego.label}
                                </div>
                                <button onClick={() => setPaso(2)} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.78rem', color: '#7f8c8d' }}>
                                    ← Repetir
                                </button>
                            </div>

                            {/* Vista previa de las preguntas */}
                            <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 10, border: '1.5px solid #ecf0f1', marginBottom: 16 }}>
                                {preguntas.map((p, i) => (
                                    <PreguntaCard key={i} pregunta={p} juego={juegoSel} juegoDef={juego} index={i} />
                                ))}
                            </div>

                            {/* Título del recurso */}
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: '0.8rem', color: '#7f8c8d', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                    📝 Título del recurso
                                </label>
                                <input
                                    value={tituloRecurso}
                                    onChange={e => setTituloRecurso(e.target.value)}
                                    placeholder="Ej: Examen Tema 3 - Historia"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #dde', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            {error && <p style={{ color: '#e74c3c', fontSize: '0.82rem', marginBottom: 10 }}>⚠ {error}</p>}

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={reiniciar} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #dde', background: 'white', color: '#7f8c8d', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Cancelar
                                </button>
                                <button onClick={abrirModalDestino} disabled={guardando}
                                    style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: guardando ? '#aaa' : '#27ae60', color: 'white', fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                    {guardando ? '⏳ Guardando...' : '💾 Guardar →'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Modal selección de destino ── */}
            {modalDestino && (
                <div style={{ position:'fixed',inset:0,zIndex:3000,background:'rgba(8,12,24,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)' }}>
                    <div style={{ background:'white',borderRadius:20,width:'100%',maxWidth:440,boxShadow:'0 30px 80px rgba(0,0,0,0.4)',padding:'26px 28px' }}>
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
                            <h3 style={{ margin:0,fontSize:'1.05rem',color:'#2c3e50',fontWeight:800 }}>¿Dónde guardar las preguntas?</h3>
                            <button onClick={()=>setModalDestino(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'#aaa',fontSize:'1.3rem' }}>✕</button>
                        </div>

                        {/* Opciones */}
                        {[
                            { id:'NUEVO', emoji:'🆕', label:'Nuevo recurso', desc:'Crea un recurso nuevo independiente' },
                            { id:'HOJA_NUEVA', emoji:'📋', label:'Hoja nueva en recurso existente', desc:'Añade una hoja extra a uno de tus recursos' },
                            { id:'HOJA_EXIST', emoji:'➕', label:'Añadir a hoja existente', desc:'Agrega las preguntas al final de una hoja ya existente' },
                        ].map(op => (
                            <button key={op.id} onClick={()=>setDestino(op.id)}
                                style={{ width:'100%',padding:'12px 14px',borderRadius:12,border:`2px solid ${destino===op.id?juego.color:'#ecf0f1'}`,background:destino===op.id?juego.colorLight:'white',cursor:'pointer',textAlign:'left',marginBottom:8,fontFamily:'inherit',transition:'all 0.15s' }}>
                                <span style={{ fontWeight:700,color:destino===op.id?juego.color:'#2c3e50',fontSize:'0.9rem' }}>{op.emoji} {op.label}</span>
                                <div style={{ fontSize:'0.75rem',color:'#7f8c8d',marginTop:2 }}>{op.desc}</div>
                            </button>
                        ))}

                        {/* Sub-opciones según destino */}
                        {destino === 'NUEVO' && (
                            <div style={{ marginTop:12 }}>
                                <label style={{ fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:5 }}>Título del nuevo recurso</label>
                                <input value={tituloRecurso} onChange={e=>setTituloRecurso(e.target.value)} placeholder="Ej: Examen Tema 3"
                                    style={{ width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #dde',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',fontFamily:'inherit' }}/>
                            </div>
                        )}

                        {(destino === 'HOJA_NUEVA' || destino === 'HOJA_EXIST') && (
                            <div style={{ marginTop:12 }}>
                                <label style={{ fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:5 }}>Recurso de destino ({juego.emoji} {juego.label})</label>
                                {recursosExist.length === 0 ? (
                                    <div style={{ background:'#fef2f2',borderRadius:9,padding:'10px 12px',color:'#e74c3c',fontSize:'0.82rem' }}>
                                        No tienes recursos de tipo {juego.label}. Elige "Nuevo recurso".
                                    </div>
                                ) : (
                                    <select value={recursoDestId} onChange={e=>{ setRecursoDestId(e.target.value); setHojaDestIdx(0); }}
                                        style={{ width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #dde',fontSize:'0.88rem',outline:'none',fontFamily:'inherit',background:'white' }}>
                                        <option value="">— Elige un recurso —</option>
                                        {recursosExist.map(r => <option key={r.id} value={r.id}>{r.titulo}</option>)}
                                    </select>
                                )}
                            </div>
                        )}

                        {destino === 'HOJA_NUEVA' && (
                            <div style={{ marginTop:10 }}>
                                <label style={{ fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:5 }}>Nombre de la nueva hoja</label>
                                <input value={nombreHojaNueva} onChange={e=>setNombreHojaNueva(e.target.value)} placeholder="Ej: Nivel 2"
                                    style={{ width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #dde',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',fontFamily:'inherit' }}/>
                            </div>
                        )}

                        {destino === 'HOJA_EXIST' && recursoDestId && (
                            <div style={{ marginTop:10 }}>
                                <label style={{ fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:5 }}>Hoja de destino</label>
                                {(() => {
                                    const hojas = recursosExist.find(r=>r.id===recursoDestId)?.hojas || [];
                                    return hojas.length === 0 ? (
                                        <div style={{ fontSize:'0.8rem',color:'#e74c3c' }}>Este recurso no tiene hojas.</div>
                                    ) : (
                                        <select value={hojaDestIdx} onChange={e=>setHojaDestIdx(parseInt(e.target.value))}
                                            style={{ width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #dde',fontSize:'0.88rem',outline:'none',fontFamily:'inherit',background:'white' }}>
                                            {hojas.map((h,i) => <option key={i} value={i}>{h.nombreHoja} ({(h.preguntas||h.parejas||[]).length} ítems)</option>)}
                                        </select>
                                    );
                                })()}
                            </div>
                        )}

                        {error && <p style={{ color:'#e74c3c',fontSize:'0.8rem',marginTop:10 }}>⚠ {error}</p>}

                        <div style={{ display:'flex',gap:9,marginTop:18 }}>
                            <button onClick={()=>setModalDestino(false)} style={{ flex:1,padding:'11px',borderRadius:10,border:'1px solid #dde',background:'white',cursor:'pointer',fontFamily:'inherit',color:'#7f8c8d',fontWeight:600 }}>Cancelar</button>
                            <button onClick={guardarConDestino} disabled={guardando}
                                style={{ flex:2,padding:'11px',borderRadius:10,border:'none',background:guardando?'#aaa':`linear-gradient(135deg,${juego.color},${juego.color}cc)`,color:'white',fontWeight:700,cursor:guardando?'default':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7 }}>
                                {guardando?'⏳ Guardando...':'💾 Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Tarjeta de vista previa por tipo ─────────────────────────────────────────
function PreguntaCard({ pregunta: p, juego, juegoDef, index }) {
    const st = {
        row: { padding: '10px 14px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.83rem' },
        idx: { minWidth: 22, height: 22, borderRadius: '50%', background: juegoDef.color, color: 'white', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
        ok: { color: '#27ae60', fontWeight: 700 },
        fail: { color: '#e74c3c', fontSize: '0.78rem' },
    };

    if (juego === 'PASAPALABRA') return (
        <div style={st.row}>
            <div style={{ ...st.idx, background: '#3F51B5' }}>{p.letra || '?'}</div>
            <div style={{ flex: 1 }}>
                <div style={{ color: '#2c3e50' }}>{p.pregunta}</div>
                <div style={st.ok}>→ {p.respuesta}</div>
            </div>
        </div>
    );

    if (juego === 'CAZABURBUJAS' || juego === 'THINKHOOT') return (
        <div style={st.row}>
            <div style={st.idx}>{index + 1}</div>
            <div style={{ flex: 1 }}>
                <div style={{ color: '#2c3e50', marginBottom: 3 }}>{p.pregunta}</div>
                <div style={st.ok}>✓ {p.correcta}</div>
                {p.incorrectas?.map((inc, k) => <div key={k} style={st.fail}>✗ {inc}</div>)}
            </div>
        </div>
    );

    if (juego === 'APAREJADOS') return (
        <div style={st.row}>
            <div style={{ ...st.idx, background: '#FF9800' }}>{index + 1}</div>
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ background: '#FFF3E0', padding: '3px 10px', borderRadius: 8, color: '#E65100', fontWeight: 600 }}>{p.terminoA}</span>
                <span style={{ color: '#aaa' }}>↔</span>
                <span style={{ background: '#E3F2FD', padding: '3px 10px', borderRadius: 8, color: '#0D47A1', fontWeight: 600 }}>{p.terminoB}</span>
            </div>
        </div>
    );

    if (juego === 'PILIVE_PRO') {
        const TIPO_META = {
            MULTIPLE:  { icon: '🔵', label: 'Opción múltiple', bg: '#E8EAF6', col: '#3F51B5' },
            SIMPLE:    { icon: '✏️',  label: 'Respuesta corta', bg: '#E8F5E9', col: '#2E7D32' },
            ORDENAR:   { icon: '🔢', label: 'Ordenar',          bg: '#FFF8E1', col: '#F57F17' },
            RELLENAR:  { icon: '📝', label: 'Rellenar hueco',   bg: '#F3E5F5', col: '#7B1FA2' },
            DIBUJO:    { icon: '🎨', label: 'Dibujo',           bg: '#FBE9E7', col: '#BF360C' },
        };
        const meta = TIPO_META[p.tipo] || { icon: '❓', label: p.tipo, bg: '#f5f5f5', col: '#555' };
        return (
            <div style={st.row}>
                <div style={{ ...st.idx, background: '#00897B' }}>{index + 1}</div>
                <div style={{ flex: 1 }}>
                    <span style={{ background: meta.bg, color: meta.col, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginBottom: 4, display: 'inline-block' }}>
                        {meta.icon} {meta.label}
                    </span>
                    <div style={{ color: '#2c3e50', marginBottom: 3 }}>{p.pregunta}</div>
                    {p.tipo === 'MULTIPLE' && <>
                        <div style={st.ok}>✓ {p.correcta}</div>
                        {p.incorrectas?.map((inc, k) => <div key={k} style={st.fail}>✗ {inc}</div>)}
                    </>}
                    {p.tipo === 'SIMPLE' && <div style={st.ok}>→ {p.respuesta}</div>}
                    {p.tipo === 'ORDENAR' && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                            {(p.bloques || []).map((b, k) => (
                                <span key={k} style={{ background: '#FFF8E1', border: '1px solid #F57F17', borderRadius: 6, padding: '1px 8px', fontSize: '0.75rem', color: '#E65100' }}>
                                    {k + 1}. {b}
                                </span>
                            ))}
                        </div>
                    )}
                    {p.tipo === 'RELLENAR' && <div style={st.ok}>→ {p.respuesta}</div>}
                    {p.tipo === 'DIBUJO' && <div style={{ color: '#BF360C', fontSize: '0.75rem' }}>🎨 Pregunta de dibujo libre</div>}
                </div>
            </div>
        );
    }

    return null;
}
