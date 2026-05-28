import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Copy, Check, Plus, Trash2, Save, ChevronRight, Shield } from 'lucide-react';

const TIPOS = {
    PASAPALABRA: {
        label: 'Pasapalabra',
        color: '#3F51B5',
        bg: '#E8EAF6',
        emoji: '🔤',
        config: { tiempoTotal: 150 },
        promptTemplate: (tema, nivel) =>
            `Dame exactamente 26 preguntas de pasapalabra sobre "${tema}" para alumnos de ${nivel}.\n` +
            `Cada respuesta debe empezar por una letra del abecedario (A, B, C, D, E, F, G, H, I, J, K, L, M, N, Ñ, O, P, Q, R, S, T, U, V, W, X, Y, Z).\n` +
            `Responde ÚNICAMENTE con un array JSON válido, sin explicaciones ni texto adicional:\n` +
            `[\n  {"letra":"A","pregunta":"Con la letra A, ...","respuesta":"PALABRA"},\n  {"letra":"B","pregunta":"Con la letra B, ...","respuesta":"PALABRA"},\n  ...\n]`,
        validarPregunta: (p) =>
            typeof p.letra === 'string' && p.letra.length === 1 &&
            typeof p.pregunta === 'string' && p.pregunta.trim() &&
            typeof p.respuesta === 'string' && p.respuesta.trim(),
        resumenPregunta: (p) => `[${p.letra}] ${p.pregunta} → ${p.respuesta}`,
    },
    CAZABURBUJAS: {
        label: 'Burbujas / Quiz',
        color: '#E91E63',
        bg: '#FCE4EC',
        emoji: '🫧',
        config: { tiempoPregunta: 20, numPreguntas: 10, puntosAcierto: 10, puntosFallo: 2 },
        promptTemplate: (tema, nivel) =>
            `Dame 10 preguntas de opción múltiple sobre "${tema}" para alumnos de ${nivel}.\n` +
            `Responde ÚNICAMENTE con un array JSON válido, sin explicaciones ni texto adicional:\n` +
            `[\n  {"pregunta":"¿...?","respuesta":"Respuesta correcta","incorrectas":["Incorrecta 1","Incorrecta 2","Incorrecta 3"]},\n  ...\n]\n` +
            `"respuesta" es el texto de la respuesta correcta. "incorrectas" es un array con 3 opciones incorrectas.`,
        validarPregunta: (p) =>
            typeof p.pregunta === 'string' && p.pregunta.trim() &&
            typeof p.respuesta === 'string' && p.respuesta.trim() &&
            Array.isArray(p.incorrectas) && p.incorrectas.length >= 1,
        resumenPregunta: (p) => `${p.pregunta} ✓ ${p.respuesta}`,
    },
    APAREJADOS: {
        label: 'AparejaDOS',
        color: '#FF9800',
        bg: '#FFF3E0',
        emoji: '🔗',
        config: { tiempoTotal: 60, numParejas: 8, puntosPareja: 10 },
        promptTemplate: (tema, nivel) =>
            `Dame 8 parejas para un juego de aparejados sobre "${tema}" para alumnos de ${nivel}.\n` +
            `Responde ÚNICAMENTE con un array JSON válido, sin explicaciones ni texto adicional:\n` +
            `[\n  {"terminoA":"Concepto o término","terminoB":"Definición o pareja"},\n  ...\n]\n` +
            `"terminoA" es el concepto (columna izquierda). "terminoB" es la pareja o definición (columna derecha).`,
        validarPregunta: (p) =>
            typeof p.terminoA === 'string' && p.terminoA.trim() &&
            typeof p.terminoB === 'string' && p.terminoB.trim(),
        resumenPregunta: (p) => `${p.terminoA} ↔ ${p.terminoB}`,
    },
};

function generarCodigo() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function parseHojaJson(raw, tipo) {
    if (!raw.trim()) return { preguntas: [], error: null };
    try {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No se encontró un array JSON válido');
        const arr = JSON.parse(match[0]);
        if (!Array.isArray(arr)) throw new Error('El JSON debe ser un array');
        const invalidas = arr.filter(p => !TIPOS[tipo].validarPregunta(p));
        if (invalidas.length > 0)
            throw new Error(`${invalidas.length} pregunta(s) con formato incorrecto`);
        return { preguntas: arr, error: null };
    } catch (e) {
        return { preguntas: [], error: e.message };
    }
}

const PASOS = ['Tipo de juego', 'Datos del recurso', 'Hojas y preguntas', 'Guardar'];

export default function AdminRecursosUploader({ usuario, onBack }) {
    const [paso, setPaso] = useState(0);
    const [tipoJuego, setTipoJuego] = useState('PASAPALABRA');
    const [meta, setMeta] = useState({
        titulo: '', tema: '', nivel: 'Primaria',
        profesorNombre: usuario?.displayName || 'Admin',
        pais: 'España', region: '', poblacion: '',
        isPrivate: false,
    });
    const [hojas, setHojas] = useState([{ nombre: 'Hoja 1', rawJson: '' }]);
    const [hojaIdx, setHojaIdx] = useState(0);
    const [copiado, setCopiado] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [error, setError] = useState('');

    const tipo = TIPOS[tipoJuego];

    const prompt = tipo.promptTemplate(meta.tema || '[tema]', meta.nivel || '[nivel]');

    const copiarPrompt = useCallback(async () => {
        await navigator.clipboard.writeText(prompt);
        setCopiado('prompt');
        setTimeout(() => setCopiado(null), 2000);
    }, [prompt]);

    const actualizarHoja = (idx, campo, valor) => {
        setHojas(prev => prev.map((h, i) => i === idx ? { ...h, [campo]: valor } : h));
    };

    const agregarHoja = () => {
        if (hojas.length >= 3) return;
        const nuevas = [...hojas, { nombre: `Hoja ${hojas.length + 1}`, rawJson: '' }];
        setHojas(nuevas);
        setHojaIdx(nuevas.length - 1);
    };

    const eliminarHoja = (idx) => {
        if (hojas.length <= 1) return;
        const nuevas = hojas.filter((_, i) => i !== idx);
        setHojas(nuevas);
        setHojaIdx(Math.min(hojaIdx, nuevas.length - 1));
    };

    const hojasParseadas = hojas.map(h => ({
        ...h,
        ...parseHojaJson(h.rawJson, tipoJuego),
    }));

    const todasValidas = hojasParseadas.every(h => !h.error && h.preguntas.length > 0);

    const guardar = async () => {
        if (!meta.titulo.trim()) { setError('El título es obligatorio.'); return; }
        if (!todasValidas) { setError('Hay hojas con errores o vacías.'); return; }
        setError('');
        setGuardando(true);
        try {
            const dataHojas = hojasParseadas.map(h => ({
                nombreHoja: h.nombre,
                preguntas: h.preguntas,
            }));
            await addDoc(collection(db, 'resources'), {
                profesorUid: usuario.uid,
                tipoJuego,
                tipo: '',
                titulo: meta.titulo.trim(),
                temas: meta.tema.trim(),
                profesorNombre: meta.profesorNombre.trim(),
                pais: meta.pais.trim(),
                region: meta.region.trim(),
                poblacion: meta.poblacion.trim(),
                config: tipo.config,
                hojas: dataHojas,
                isPrivate: meta.isPrivate,
                accessCode: generarCodigo(),
                playCount: 0,
                origen: 'admin-uploader',
                fechaCreacion: serverTimestamp(),
            });
            setGuardado(true);
        } catch (e) {
            setError('Error al guardar: ' + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const resetear = () => {
        setGuardado(false);
        setPaso(0);
        setTipoJuego('PASAPALABRA');
        setMeta({ titulo: '', tema: '', nivel: 'Primaria', profesorNombre: usuario?.displayName || 'Admin', pais: 'España', region: '', poblacion: '', isPrivate: false });
        setHojas([{ nombre: 'Hoja 1', rawJson: '' }]);
        setHojaIdx(0);
        setError('');
    };

    if (guardado) return (
        <div style={s.container}>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: '#10b981', marginBottom: 8 }}>¡Recurso guardado!</h2>
                <p style={{ color: '#64748b', marginBottom: 32 }}>El recurso "{meta.titulo}" se ha publicado en Firebase y ya está disponible en la aplicación.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button onClick={resetear} style={s.btnPrimary}>+ Crear otro recurso</button>
                    <button onClick={onBack} style={s.btnSecondary}>← Volver</button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={s.container}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button onClick={onBack} style={s.btnBack}>← Volver</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={20} color="#6D28D9" />
                    <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: 700 }}>
                        Cargador de Recursos con IA
                    </h2>
                    <span style={s.badge}>Solo admin</span>
                </div>
            </div>

            {/* Stepper */}
            <div style={s.stepper}>
                {PASOS.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem',
                            background: i <= paso ? '#6D28D9' : '#e2e8f0',
                            color: i <= paso ? 'white' : '#94a3b8',
                        }}>{i + 1}</div>
                        <span style={{ fontSize: '0.8rem', color: i <= paso ? '#6D28D9' : '#94a3b8', fontWeight: i === paso ? 700 : 400, display: 'none' }}
                            className="stepper-label">{p}</span>
                        {i < PASOS.length - 1 && <ChevronRight size={14} color="#cbd5e1" style={{ margin: '0 4px' }} />}
                    </div>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{PASOS[paso]}</span>
            </div>

            {/* ── Paso 0: Tipo de juego ── */}
            {paso === 0 && (
                <div>
                    <p style={s.label}>Selecciona el tipo de juego que quieres crear:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                        {Object.entries(TIPOS).map(([key, t]) => (
                            <div key={key} onClick={() => setTipoJuego(key)}
                                style={{
                                    ...s.card, borderColor: tipoJuego === key ? t.color : '#e2e8f0',
                                    borderWidth: tipoJuego === key ? 2 : 1,
                                    background: tipoJuego === key ? t.bg : 'white',
                                }}>
                                <div style={{ fontSize: 40, marginBottom: 10 }}>{t.emoji}</div>
                                <div style={{ fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.label}</div>
                                {tipoJuego === key && <div style={{ color: t.color, fontSize: 18 }}>✓</div>}
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setPaso(1)} style={s.btnPrimary}>Siguiente →</button>
                </div>
            )}

            {/* ── Paso 1: Metadatos ── */}
            {paso === 1 && (
                <div>
                    <div style={s.formGrid}>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Título del recurso *</label>
                            <input value={meta.titulo} onChange={e => setMeta({ ...meta, titulo: e.target.value })}
                                placeholder="Ej: Pasapalabra de los animales" style={s.input} />
                        </div>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Tema / materia *</label>
                            <input value={meta.tema} onChange={e => setMeta({ ...meta, tema: e.target.value })}
                                placeholder="Ej: los animales vertebrados" style={s.input} />
                        </div>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Nivel educativo</label>
                            <select value={meta.nivel} onChange={e => setMeta({ ...meta, nivel: e.target.value })} style={s.input}>
                                {['Infantil', 'Primaria', '1º Primaria', '2º Primaria', '3º Primaria', '4º Primaria', '5º Primaria', '6º Primaria',
                                    'Secundaria', '1º ESO', '2º ESO', '3º ESO', '4º ESO', 'Bachillerato'].map(n =>
                                    <option key={n}>{n}</option>)}
                            </select>
                        </div>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Nombre del profesor</label>
                            <input value={meta.profesorNombre} onChange={e => setMeta({ ...meta, profesorNombre: e.target.value })} style={s.input} />
                        </div>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>País</label>
                            <input value={meta.pais} onChange={e => setMeta({ ...meta, pais: e.target.value })} style={s.input} />
                        </div>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Región (opcional)</label>
                            <input value={meta.region} onChange={e => setMeta({ ...meta, region: e.target.value })} style={s.input} />
                        </div>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Publicado</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 6 }}>
                                <input type="checkbox" checked={!meta.isPrivate} onChange={e => setMeta({ ...meta, isPrivate: !e.target.checked })}
                                    style={{ width: 18, height: 18 }} />
                                <span style={{ fontSize: '0.9rem', color: '#374151' }}>Visible en biblioteca pública</span>
                            </label>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                        <button onClick={() => setPaso(0)} style={s.btnSecondary}>← Atrás</button>
                        <button onClick={() => { if (!meta.titulo.trim() || !meta.tema.trim()) return setError('Título y tema son obligatorios.'); setError(''); setPaso(2); }} style={s.btnPrimary}>Siguiente →</button>
                    </div>
                    {error && <p style={s.errorText}>{error}</p>}
                </div>
            )}

            {/* ── Paso 2: Hojas ── */}
            {paso === 2 && (
                <div>
                    {/* Cabecera gestión de hojas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                            <p style={{ ...s.label, margin: 0 }}>Hojas de preguntas ({hojas.length}/3)</p>
                            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                                Cada hoja es un set independiente de preguntas. Llena el JSON de Gemini en cada una.
                            </p>
                        </div>
                        {hojas.length < 3 && (
                            <button onClick={agregarHoja}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: '2px dashed #6D28D9', background: '#f5f3ff', color: '#6D28D9', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
                                <Plus size={16} /> Añadir hoja
                            </button>
                        )}
                    </div>

                    {/* Tabs de hojas */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                        {hojas.map((h, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button onClick={() => setHojaIdx(i)}
                                    style={{ ...s.tab, background: hojaIdx === i ? tipo.color : 'white', color: hojaIdx === i ? 'white' : '#374151', border: hojaIdx === i ? 'none' : '1px solid #e2e8f0' }}>
                                    {hojasParseadas[i].error ? '⚠️' : hojasParseadas[i].preguntas.length > 0 ? '✅' : '📋'} {h.nombre}
                                </button>
                                {hojas.length > 1 && (
                                    <button onClick={() => eliminarHoja(i)} title="Eliminar esta hoja"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Contenido de la hoja activa */}
                    <div style={s.hojaCard}>
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Nombre de esta hoja</label>
                            <input value={hojas[hojaIdx].nombre}
                                onChange={e => actualizarHoja(hojaIdx, 'nombre', e.target.value)}
                                style={{ ...s.input, maxWidth: 280 }} />
                        </div>

                        {/* Prompt para Gemini */}
                        <div style={s.formGroup}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <label style={s.fieldLabel}>Prompt para Gemini</label>
                                <button onClick={copiarPrompt} style={s.btnCopy}>
                                    {copiado === 'prompt' ? <><Check size={13} /> ¡Copiado!</> : <><Copy size={13} /> Copiar</>}
                                </button>
                            </div>
                            <pre style={s.promptBox}>{prompt}</pre>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0' }}>
                                Copia este prompt, pégalo en Gemini (gemini.google.com) y pega la respuesta abajo.
                            </p>
                        </div>

                        {/* Textarea para pegar la respuesta */}
                        <div style={s.formGroup}>
                            <label style={s.fieldLabel}>Pega aquí la respuesta JSON de Gemini</label>
                            <textarea
                                value={hojas[hojaIdx].rawJson}
                                onChange={e => actualizarHoja(hojaIdx, 'rawJson', e.target.value)}
                                placeholder={'[\n  {"letra":"A","pregunta":"Con la letra A...","respuesta":"AGUA"},\n  ...\n]'}
                                style={s.textarea}
                                spellCheck={false}
                            />
                        </div>

                        {/* Estado del parse */}
                        {hojasParseadas[hojaIdx].error && (
                            <div style={s.errorBox}>
                                ⚠️ Error al parsear: {hojasParseadas[hojaIdx].error}
                            </div>
                        )}
                        {!hojasParseadas[hojaIdx].error && hojasParseadas[hojaIdx].preguntas.length > 0 && (
                            <div style={s.successBox}>
                                ✅ {hojasParseadas[hojaIdx].preguntas.length} pregunta(s) válidas
                            </div>
                        )}

                        {/* Preview de preguntas */}
                        {hojasParseadas[hojaIdx].preguntas.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <p style={{ ...s.fieldLabel, marginBottom: 6 }}>Vista previa:</p>
                                <div style={s.previewList}>
                                    {hojasParseadas[hojaIdx].preguntas.slice(0, 5).map((p, i) => (
                                        <div key={i} style={s.previewItem}>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', minWidth: 20 }}>{i + 1}.</span>
                                            <span style={{ fontSize: '0.8rem', color: '#334155' }}>{tipo.resumenPregunta(p)}</span>
                                        </div>
                                    ))}
                                    {hojasParseadas[hojaIdx].preguntas.length > 5 && (
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '4px 8px' }}>
                                            … y {hojasParseadas[hojaIdx].preguntas.length - 5} más
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                        <button onClick={() => setPaso(1)} style={s.btnSecondary}>← Atrás</button>
                        <button onClick={() => { if (!todasValidas) return setError('Completa todas las hojas con JSON válido.'); setError(''); setPaso(3); }} style={s.btnPrimary}>
                            Revisar y guardar →
                        </button>
                    </div>
                    {error && <p style={s.errorText}>{error}</p>}
                </div>
            )}

            {/* ── Paso 3: Resumen y guardar ── */}
            {paso === 3 && (
                <div>
                    <div style={s.resumenCard}>
                        <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>Resumen del recurso</h3>
                        <div style={s.resumenGrid}>
                            <div><span style={s.resumenKey}>Tipo</span><span style={{ ...s.resumenVal, color: tipo.color }}>{tipo.emoji} {tipo.label}</span></div>
                            <div><span style={s.resumenKey}>Título</span><span style={s.resumenVal}>{meta.titulo}</span></div>
                            <div><span style={s.resumenKey}>Tema</span><span style={s.resumenVal}>{meta.tema}</span></div>
                            <div><span style={s.resumenKey}>Nivel</span><span style={s.resumenVal}>{meta.nivel}</span></div>
                            <div><span style={s.resumenKey}>Visibilidad</span><span style={s.resumenVal}>{meta.isPrivate ? '🔒 Privado' : '🌐 Público'}</span></div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <span style={s.resumenKey}>Hojas ({hojas.length}):</span>
                            {hojasParseadas.map((h, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{h.nombre}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#10b981' }}>✅ {h.preguntas.length} preguntas</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <p style={s.errorText}>{error}</p>}

                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                        <button onClick={() => setPaso(2)} style={s.btnSecondary}>← Atrás</button>
                        <button onClick={guardar} disabled={guardando} style={{ ...s.btnPrimary, opacity: guardando ? 0.7 : 1 }}>
                            {guardando ? '⏳ Guardando…' : <><Save size={16} /> Guardar en Firebase</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const s = {
    container: { padding: '20px', maxWidth: 860, margin: '0 auto' },
    stepper: { display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: 12, padding: '12px 16px', marginBottom: 28, gap: 4 },
    label: { color: '#374151', fontWeight: 600, marginBottom: 16, fontSize: '0.95rem' },
    fieldLabel: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 },
    input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
    textarea: { width: '100%', minHeight: 180, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.8rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none' },
    card: { padding: '24px 16px', borderRadius: 14, border: '2px solid', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
    tab: { padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
    btnPrimary: { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#6D28D9', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
    btnSecondary: { padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' },
    btnBack: { padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' },
    btnCopy: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#374151' },
    btnAddHoja: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, border: '1.5px dashed #6D28D9', background: 'white', color: '#6D28D9', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
    badge: { background: '#EDE9FE', color: '#6D28D9', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
    promptBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', fontSize: '0.78rem', color: '#334155', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5, maxHeight: 200, overflowY: 'auto' },
    textarea2: {},
    errorBox: { background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px', color: '#DC2626', fontSize: '0.82rem', marginTop: 8 },
    successBox: { background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '8px 12px', color: '#15803D', fontSize: '0.82rem', marginTop: 8 },
    errorText: { color: '#DC2626', fontSize: '0.82rem', marginTop: 8 },
    hojaCard: { background: '#f8fafc', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 },
    formGroup: { display: 'flex', flexDirection: 'column' },
    previewList: { background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' },
    previewItem: { display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' },
    resumenCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24 },
    resumenGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 },
    resumenKey: { display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 },
    resumenVal: { display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' },
};
