import React, { useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import { Youtube, Loader2, Download, ChevronLeft, Eye, CheckCircle2 } from 'lucide-react';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const IDIOMAS = ['Español', 'English', 'Français', 'Deutsch', 'Italiano', 'Português', 'Català', 'Euskera', 'Galego'];
const NUM_SLIDES = [5, 8, 10, 12, 15, 20];

function extractVideoId(url) {
    try {
        const u = new URL(url.trim());
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
        return null;
    } catch { return null; }
}

function buildPrompt({ idioma, numSlides, conEjercicios, promptExtra }) {
    return `Analiza el video de YouTube proporcionado, transcribe su contenido y crea una presentación educativa estructurada.

CONFIGURACIÓN:
- Idioma de salida: ${idioma}
- Número de diapositivas de contenido: ${numSlides}
- Incluir ejercicios de comprensión: ${conEjercicios ? 'SÍ' : 'NO'}
${promptExtra ? `- Instrucciones adicionales del profesor: ${promptExtra}` : ''}

INSTRUCCIONES:
1. Analiza y transcribe el video completamente
2. Extrae las ideas clave y organízalas en ${numSlides} diapositivas progresivas
3. Usa un lenguaje apropiado para el nivel educativo del contenido
4. La presentación debe fluir: introducción → desarrollo (puntos principales) → conclusión

${conEjercicios ? `Para cada diapositiva de contenido, añade una pregunta de comprensión tipo test (4 opciones).` : ''}

RESPONDE EXCLUSIVAMENTE CON ESTE JSON (sin markdown, sin bloques de código, sin texto extra):
{
  "titulo": "Título principal extraído del video",
  "subtitulo": "Descripción breve del contenido",
  "diapositivas": [
    {
      "titulo": "Título de la diapositiva",
      "puntos": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
      "nota": "Nota del presentador con más detalle"${conEjercicios ? `,
      "ejercicio": {
        "pregunta": "Pregunta de comprensión en ${idioma}",
        "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
        "correcta": 0
      }` : ''}
    }
  ]
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON válido
- Cada diapositiva: 3-5 puntos concisos (max 15 palabras cada uno)
- Todo el texto en ${idioma}
- correcta es el índice (0-3) de la opción correcta`;
}

async function generarConGemini({ youtubeUrl, idioma, numSlides, conEjercicios, promptExtra }) {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { fileData: { mimeType: 'video/mp4', fileUri: youtubeUrl } },
                        { text: buildPrompt({ idioma, numSlides, conEjercicios, promptExtra }) }
                    ]
                }],
                generationConfig: { temperature: 0.6, maxOutputTokens: 8192 }
            })
        }
    );
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Error ${res.status}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
}

async function generarPPTX({ titulo, subtitulo, slides, conEjercicios, idioma }) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

    const C_PRIMARY   = '6D28D9';
    const C_LIGHT_BG  = 'F5F3FF';
    const C_TEXT      = '1F2937';
    const C_ACCENT    = 'EDE9FE';
    const C_GREEN     = '059669';
    const C_WHITE     = 'FFFFFF';
    const C_SOFT      = 'DDD6FE';

    // ── Portada ──────────────────────────────────────────
    const portada = pptx.addSlide();
    portada.background = { color: C_PRIMARY };

    portada.addShape(pptx.ShapeType.rect, {
        x: 0, y: 5.8, w: '100%', h: 1.7,
        fill: { color: '5B21B6' }, line: { color: '5B21B6' }
    });

    portada.addText(titulo, {
        x: 0.6, y: 1.2, w: 12.1, h: 2.5,
        fontSize: 38, bold: true, color: C_WHITE,
        align: 'center', valign: 'middle', wrap: true
    });

    if (subtitulo) {
        portada.addText(subtitulo, {
            x: 0.6, y: 3.9, w: 12.1, h: 0.8,
            fontSize: 18, color: C_SOFT, align: 'center', italic: true
        });
    }

    portada.addText('📹 Generado con pikt.es a partir de YouTube', {
        x: 0.6, y: 6.2, w: 12.1, h: 0.6,
        fontSize: 12, color: C_SOFT, align: 'center'
    });

    // ── Diapositivas de contenido ─────────────────────────
    slides.forEach((s, i) => {
        const slide = pptx.addSlide();
        slide.background = { color: C_LIGHT_BG };

        // Barra superior
        slide.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: '100%', h: 1.05,
            fill: { color: C_PRIMARY }, line: { color: C_PRIMARY }
        });

        // Número
        slide.addText(`${i + 1} / ${slides.length}`, {
            x: 11.5, y: 0.15, w: 1.5, h: 0.4,
            fontSize: 10, color: C_SOFT, align: 'right'
        });

        // Título
        slide.addText(s.titulo || '', {
            x: 0.35, y: 0.12, w: 10.8, h: 0.8,
            fontSize: 22, bold: true, color: C_WHITE, valign: 'middle'
        });

        // Determinar altura disponible para puntos
        const hasEj = conEjercicios && s.ejercicio;
        const puntosH = hasEj ? 3.0 : 5.8;

        // Puntos / bullets
        const bullets = (s.puntos || []).map(p => ({
            text: p,
            options: {
                bullet: { type: 'bullet', indent: 25 },
                paraSpaceAfter: 6
            }
        }));

        if (bullets.length > 0) {
            slide.addText(bullets, {
                x: 0.6, y: 1.2, w: 12.0, h: puntosH,
                fontSize: 17, color: C_TEXT, valign: 'top',
                lineSpacingMultiple: 1.35
            });
        }

        // Ejercicio
        if (hasEj) {
            const ej = s.ejercicio;
            const ejY = 4.35;

            slide.addShape(pptx.ShapeType.rect, {
                x: 0.5, y: ejY, w: 12.3, h: 2.85,
                fill: { color: C_ACCENT }, line: { color: C_PRIMARY, width: 1.5 }
            });

            slide.addText('❓ ' + (ej.pregunta || ''), {
                x: 0.75, y: ejY + 0.12, w: 11.8, h: 0.7,
                fontSize: 13, bold: true, color: C_PRIMARY, wrap: true
            });

            const letters = ['A', 'B', 'C', 'D'];
            (ej.opciones || []).forEach((op, oi) => {
                const isCorrect = oi === ej.correcta;
                slide.addText(`${letters[oi]}) ${op}`, {
                    x: oi % 2 === 0 ? 0.75 : 6.9,
                    y: ejY + 0.9 + Math.floor(oi / 2) * 0.7,
                    w: 5.8, h: 0.6,
                    fontSize: 12,
                    color: isCorrect ? C_GREEN : C_TEXT,
                    bold: isCorrect
                });
            });
        }

        // Nota del presentador
        if (s.nota) slide.addNotes(s.nota);
    });

    // ── Cierre ────────────────────────────────────────────
    const cierre = pptx.addSlide();
    cierre.background = { color: C_PRIMARY };

    cierre.addText(idioma === 'English' ? 'Thank you!' : idioma === 'Français' ? 'Merci !' : '¡Gracias!', {
        x: 0.5, y: 2.2, w: 12.3, h: 1.8,
        fontSize: 52, bold: true, color: C_WHITE, align: 'center'
    });

    cierre.addText('pikt.es', {
        x: 0.5, y: 4.2, w: 12.3, h: 0.6,
        fontSize: 18, color: C_SOFT, align: 'center', italic: true
    });

    const fileName = titulo.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ \-_]/g, '').trim() || 'presentacion';
    await pptx.writeFile({ fileName: `${fileName}.pptx` });
}

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────
export default function VideoAPresentacion({ onBack }) {
    const [step, setStep] = useState('config'); // config | loading | preview | done
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [idioma, setIdioma] = useState('Español');
    const [numSlides, setNumSlides] = useState(10);
    const [conEjercicios, setConEjercicios] = useState(false);
    const [promptExtra, setPromptExtra] = useState('');
    const [titulo, setTitulo] = useState('');
    const [subtitulo, setSubtitulo] = useState('');
    const [slides, setSlides] = useState([]);
    const [error, setError] = useState('');
    const [loadingMsg, setLoadingMsg] = useState('');

    const videoId = extractVideoId(youtubeUrl);
    const urlValida = !!videoId;

    const handleGenerar = async () => {
        if (!urlValida) { setError('Introduce una URL válida de YouTube.'); return; }
        if (!GEMINI_KEY) { setError('No se encontró la clave de Gemini (VITE_GEMINI_API_KEY).'); return; }
        setError('');
        setStep('loading');
        setLoadingMsg('Analizando el video con IA… Esto puede tardar 30-60 segundos.');
        try {
            const parsed = await generarConGemini({ youtubeUrl, idioma, numSlides, conEjercicios, promptExtra });
            setTitulo(parsed.titulo || 'Presentación');
            setSubtitulo(parsed.subtitulo || '');
            setSlides(parsed.diapositivas || []);
            setStep('preview');
        } catch (e) {
            setError('Error: ' + e.message);
            setStep('config');
        }
    };

    const handleDescargar = async () => {
        setStep('loading');
        setLoadingMsg('Generando archivo PPTX…');
        try {
            await generarPPTX({ titulo, subtitulo, slides, conEjercicios, idioma });
            setStep('done');
        } catch (e) {
            setError('Error al generar PPTX: ' + e.message);
            setStep('preview');
        }
    };

    // ── Loading ───────────────────────────────────────────
    if (step === 'loading') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 18 }}>
                <Loader2 size={48} color="#6D28D9" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#6D28D9', fontWeight: 600, fontSize: '1rem', textAlign: 'center', maxWidth: 360 }}>{loadingMsg}</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ── Done ──────────────────────────────────────────────
    if (step === 'done') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 20 }}>
                <CheckCircle2 size={64} color="#059669" />
                <h3 style={{ color: '#1F2937', margin: 0 }}>¡PPTX descargado!</h3>
                <p style={{ color: '#6B7280', margin: 0 }}>Revisa tu carpeta de descargas.</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button onClick={() => setStep('preview')} style={btnSecondary}>← Ver presentación</button>
                    <button onClick={() => { setStep('config'); setYoutubeUrl(''); setSlides([]); }} style={btnPrimary}>Nueva presentación</button>
                </div>
            </div>
        );
    }

    // ── Preview ───────────────────────────────────────────
    if (step === 'preview') {
        return (
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 8px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => setStep('config')} style={btnSecondary}>← Editar config</button>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, color: '#6D28D9', fontSize: '1.25rem' }}>{titulo}</h2>
                        {subtitulo && <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.85rem' }}>{subtitulo}</p>}
                    </div>
                    <button onClick={handleDescargar} style={btnPrimary}>
                        <Download size={16} /> Descargar PPTX
                    </button>
                </div>

                {error && <div style={errorBox}>{error}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Portada preview */}
                    <div style={slideCard('#6D28D9', 'white')}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Portada</span>
                        <h3 style={{ margin: '6px 0 4px', fontSize: '1.2rem', color: 'white' }}>{titulo}</h3>
                        {subtitulo && <p style={{ margin: 0, fontSize: '0.85rem', color: '#DDD6FE' }}>{subtitulo}</p>}
                    </div>

                    {slides.map((s, i) => (
                        <div key={i} style={slideCard('#F5F3FF', '#1F2937')}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{ background: '#6D28D9', color: 'white', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{i + 1}</span>
                                        <strong style={{ color: '#6D28D9', fontSize: '1rem' }}>{s.titulo}</strong>
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                        {(s.puntos || []).map((p, j) => <li key={j}>{p}</li>)}
                                    </ul>
                                    {s.nota && (
                                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#9CA3AF', fontStyle: 'italic' }}>
                                            📝 {s.nota}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {conEjercicios && s.ejercicio && (
                                <div style={{ marginTop: 12, background: '#EDE9FE', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #6D28D9' }}>
                                    <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#6D28D9', fontSize: '0.85rem' }}>❓ {s.ejercicio.pregunta}</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                        {(s.ejercicio.opciones || []).map((op, oi) => (
                                            <span key={oi} style={{
                                                fontSize: '0.8rem',
                                                color: oi === s.ejercicio.correcta ? '#059669' : '#374151',
                                                fontWeight: oi === s.ejercicio.correcta ? 700 : 400
                                            }}>
                                                {['A', 'B', 'C', 'D'][oi]}) {op}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Cierre preview */}
                    <div style={slideCard('#6D28D9', 'white')}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Cierre</span>
                        <h3 style={{ margin: '6px 0 4px', fontSize: '1.5rem', color: 'white', textAlign: 'center' }}>
                            {idioma === 'English' ? 'Thank you!' : idioma === 'Français' ? 'Merci !' : '¡Gracias!'}
                        </h3>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 28 }}>
                    <button onClick={handleDescargar} style={{ ...btnPrimary, fontSize: '1rem', padding: '12px 32px' }}>
                        <Download size={18} /> Descargar PPTX
                    </button>
                </div>
            </div>
        );
    }

    // ── Config ────────────────────────────────────────────
    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px 32px' }}>
            <button onClick={onBack} style={{ ...btnSecondary, marginBottom: 28 }}>← Volver a herramientas</button>

            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ background: '#EDE9FE', borderRadius: '50%', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Youtube size={32} color="#6D28D9" />
                </div>
                <h2 style={{ margin: 0, color: '#6D28D9' }}>Video → Presentación</h2>
                <p style={{ color: '#9CA3AF', margin: '6px 0 0', fontSize: '0.9rem' }}>
                    Convierte cualquier video de YouTube en una presentación PPTX lista para usar.
                </p>
            </div>

            {error && <div style={errorBox}>{error}</div>}

            <div style={card}>
                {/* URL */}
                <label style={labelStyle}>URL del video de YouTube *</label>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                    <input
                        type="url"
                        value={youtubeUrl}
                        onChange={e => { setYoutubeUrl(e.target.value); setError(''); }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        style={{ ...inputStyle, paddingRight: 48, borderColor: youtubeUrl && !urlValida ? '#EF4444' : undefined }}
                    />
                    {urlValida && (
                        <CheckCircle2 size={18} color="#059669" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    )}
                </div>

                {urlValida && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: '0.83rem', color: '#166534' }}>
                        ✅ Video detectado: <code style={{ fontSize: '0.8rem' }}>{videoId}</code>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {/* Idioma */}
                    <div>
                        <label style={labelStyle}>Idioma de la presentación</label>
                        <select value={idioma} onChange={e => setIdioma(e.target.value)} style={inputStyle}>
                            {IDIOMAS.map(i => <option key={i}>{i}</option>)}
                        </select>
                    </div>
                    {/* Nº diapositivas */}
                    <div>
                        <label style={labelStyle}>Número de diapositivas</label>
                        <select value={numSlides} onChange={e => setNumSlides(Number(e.target.value))} style={inputStyle}>
                            {NUM_SLIDES.map(n => <option key={n} value={n}>{n} diapositivas</option>)}
                        </select>
                    </div>
                </div>

                {/* Ejercicios toggle */}
                <div
                    onClick={() => setConEjercicios(v => !v)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        background: conEjercicios ? '#EDE9FE' : '#F9FAFB',
                        border: `2px solid ${conEjercicios ? '#6D28D9' : '#E5E7EB'}`,
                        borderRadius: 10, cursor: 'pointer', marginBottom: 20,
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{
                        width: 46, height: 26, borderRadius: 99,
                        background: conEjercicios ? '#6D28D9' : '#D1D5DB',
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0
                    }}>
                        <div style={{
                            position: 'absolute', top: 3, left: conEjercicios ? 23 : 3,
                            width: 20, height: 20, borderRadius: '50%', background: 'white',
                            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: conEjercicios ? '#6D28D9' : '#374151', fontSize: '0.95rem' }}>
                            Incluir ejercicios de comprensión
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                            Añade una pregunta tipo test al final de cada diapositiva
                        </div>
                    </div>
                </div>

                {/* Prompt extra */}
                <label style={labelStyle}>Instrucciones adicionales (opcional)</label>
                <textarea
                    value={promptExtra}
                    onChange={e => setPromptExtra(e.target.value)}
                    placeholder="Ej: «Adapta el contenido para alumnos de 4º de ESO», «Enfócate en los aspectos históricos», «Añade ejemplos prácticos»…"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />

                <button
                    onClick={handleGenerar}
                    disabled={!urlValida}
                    style={{
                        ...btnPrimary, width: '100%', marginTop: 24,
                        fontSize: '1rem', padding: '13px',
                        opacity: urlValida ? 1 : 0.5,
                        cursor: urlValida ? 'pointer' : 'not-allowed'
                    }}
                >
                    <Eye size={18} /> Generar presentación
                </button>

                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.78rem', margin: '10px 0 0' }}>
                    Usa Gemini 2.0 Flash para analizar el video · Puede tardar hasta 1 minuto
                </p>
            </div>
        </div>
    );
}

// ── Estilos ───────────────────────────────────────────────
const btnPrimary = {
    background: '#6D28D9', color: 'white', border: 'none',
    borderRadius: 10, padding: '9px 20px', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem',
    display: 'inline-flex', alignItems: 'center', gap: 7
};

const btnSecondary = {
    background: 'white', color: '#555', border: '1px solid #dde',
    borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
    fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 5
};

const card = {
    background: 'white', borderRadius: 16, padding: '28px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: '1px solid #EDE9FE'
};

const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #D1D5DB', fontSize: '0.93rem',
    outline: 'none', boxSizing: 'border-box', background: 'white'
};

const labelStyle = {
    display: 'block', fontSize: '0.82rem', fontWeight: 600,
    color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5
};

const errorBox = {
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    padding: '10px 14px', color: '#DC2626', fontSize: '0.88rem', marginBottom: 16
};

const slideCard = (bg, color) => ({
    background: bg, borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color
});
