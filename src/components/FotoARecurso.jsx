import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

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
];

const MODELOS_GEMINI = ['gemini-2.0-flash', 'gemini-2.5-flash'];

const PROMPTS = {
    PASAPALABRA: `Analiza esta imagen de un documento educativo. Extrae TODAS las preguntas/definiciones y respuestas que veas.
Conviértelas al formato Pasapalabra: cada respuesta debe ser una palabra que empiece por una letra del abecedario.
Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin explicaciones):
[{"letra":"A","pregunta":"Definición o pregunta","respuesta":"Palabra que empieza por A"}, ...]
Si no encuentras contenido educativo útil responde exactamente: {"error":"No se pudo extraer contenido"}`,

    CAZABURBUJAS: `Analiza esta imagen de un documento educativo. Extrae TODAS las preguntas y respuestas que veas.
Conviértelas a preguntas de opción múltiple. Inventa 3 respuestas incorrectas plausibles para cada pregunta correcta.
Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin explicaciones):
[{"pregunta":"¿Pregunta?","correcta":"Respuesta correcta","incorrectas":["Incorrecta1","Incorrecta2","Incorrecta3"]}, ...]
Si no encuentras contenido educativo útil responde exactamente: {"error":"No se pudo extraer contenido"}`,

    APAREJADOS: `Analiza esta imagen de un documento educativo. Extrae TODOS los conceptos, términos, definiciones o parejas que veas.
Conviértelos en parejas para unir (concepto-definición, pregunta-respuesta, término-significado, etc.).
Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin explicaciones):
[{"terminoA":"Concepto o término","terminoB":"Definición o respuesta"}, ...]
Si no encuentras contenido educativo útil responde exactamente: {"error":"No se pudo extraer contenido"}`,

    THINKHOOT: `Analiza esta imagen de un documento educativo. Extrae TODAS las preguntas y respuestas que veas.
Conviértelas a preguntas de quiz rápido. Inventa 3 respuestas incorrectas plausibles para cada pregunta.
Devuelve ÚNICAMENTE un JSON array válido (sin markdown, sin explicaciones):
[{"pregunta":"¿Pregunta?","correcta":"Respuesta correcta","incorrectas":["Incorrecta1","Incorrecta2","Incorrecta3"]}, ...]
Si no encuentras contenido educativo útil responde exactamente: {"error":"No se pudo extraer contenido"}`,
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
    return false;
};

// ─── Componente principal ──────────────────────────────────────────────────────
export default function FotoARecurso({ usuario, perfilProfesor }) {
    const [paso, setPaso] = useState(1); // 1=juego, 2=foto, 3=resultado
    const [juegoSel, setJuegoSel] = useState(null);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
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

    const juego = JUEGOS.find(j => j.id === juegoSel);

    // ── Subida de imagen ──────────────────────────────────────────────────────
    const procesarArchivo = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            setError('Por favor sube una imagen (JPG, PNG, WEBP...)');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('La imagen es demasiado grande (máx 10MB)');
            return;
        }
        setError('');
        const reader = new FileReader();
        reader.onload = (e) => setImagen({ file, dataUrl: e.target.result });
        reader.readAsDataURL(file);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setArrastrando(false);
        procesarArchivo(e.dataTransfer.files[0]);
    }, []);

    // ── Llamar a Gemini con visión ────────────────────────────────────────────
    const procesarConGemini = async () => {
        if (!apiKey) { setError('API Key no configurada en el servidor. Contacta al administrador.'); return; }
        if (!imagen) { setError('Sube una imagen primero'); return; }

        setProcesando(true);
        setError('');
        setPreguntas(null);

        const base64 = await fileToBase64(imagen.file);
        const mimeType = imagen.file.type;
        let errorFinal = null;

        for (const modelo of MODELOS_GEMINI) {
            try {
                setProgreso(`🔍 Analizando imagen con ${modelo}...`);
                const genAI = new GoogleGenerativeAI(apiKey);
                const aiModel = genAI.getGenerativeModel({ model: modelo });

                const result = await aiModel.generateContent([
                    { text: PROMPTS[juegoSel] },
                    { inlineData: { mimeType, data: base64 } },
                ]);

                const texto = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

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

    // ── Guardar en Firebase ───────────────────────────────────────────────────
    const guardar = async () => {
        if (!tituloRecurso.trim()) { setError('Ponle un título al recurso'); return; }
        setGuardando(true);
        try {
            const hojas = [{ nombreHoja: 'Desde foto', preguntas }];
            // APAREJADOS usa "parejas" en lugar de "preguntas"
            const hojasFinales = juegoSel === 'APAREJADOS'
                ? [{ nombreHoja: 'Desde foto', parejas: preguntas }]
                : hojas;

            await addDoc(collection(db, 'resources'), {
                titulo: tituloRecurso.trim(),
                temas: 'Generado desde foto',
                tipoJuego: juegoSel,
                profesorUid: usuario.uid,
                profesorNombre: perfilProfesor?.nombre || usuario.displayName || '',
                pais: perfilProfesor?.pais || '',
                region: perfilProfesor?.region || '',
                poblacion: perfilProfesor?.poblacion || '',
                hojas: hojasFinales,
                config: {},
                isPrivate: true,
                origen: 'foto-ia',
                accessCode: generarCodigo(),
                playCount: 0,
                fechaCreacion: new Date(),
            });
            setGuardadoOk(true);
        } catch (e) {
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
                        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => procesarArchivo(e.target.files[0])} />

                        {imagen ? (
                            <div>
                                <img src={imagen.dataUrl} alt="preview"
                                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 10, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
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
                                <div style={{ color: '#aaa', fontSize: '0.82rem' }}>o haz clic para seleccionar · JPG, PNG, WEBP · Máx 10MB</div>
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
                                <button onClick={guardar} disabled={guardando}
                                    style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: guardando ? '#aaa' : '#27ae60', color: 'white', fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                    {guardando ? '⏳ Guardando...' : '💾 Guardar recurso privado'}
                                </button>
                            </div>
                        </>
                    )}
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

    return null;
}
