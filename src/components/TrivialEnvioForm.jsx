import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

const CAT_IDS  = ['geo', 'esp', 'his', 'art', 'cie', 'dep'];
const CAT_HEX  = { geo: '#3498db', esp: '#e84393', his: '#f1c40f', art: '#9b59b6', cie: '#2ecc71', dep: '#e67e22' };
const CAT_DEF  = {
    geo: { nombre: 'Geografía',    emoji: '🌍' },
    esp: { nombre: 'Espectáculos', emoji: '🎬' },
    his: { nombre: 'Historia',     emoji: '📜' },
    art: { nombre: 'Arte y Lit.',  emoji: '🎨' },
    cie: { nombre: 'Ciencias',     emoji: '🔬' },
    dep: { nombre: 'Deportes',     emoji: '⚽' },
};

const TIPOS = [
    { id: 'SELECCION', label: 'Selección múltiple', icon: '🔘' },
    { id: 'CORTA',     label: 'Respuesta corta',    icon: '✏️' },
    { id: 'RELLENAR',  label: 'Rellenar el hueco',  icon: '🔲' },
    { id: 'ORDENAR',   label: 'Ordenar elementos',  icon: '🔀' },
];

function catInfo(id, categorias) {
    if (categorias?.[id]) return { nombre: categorias[id].nombre, emoji: categorias[id].emoji, hex: CAT_HEX[id] };
    return { ...CAT_DEF[id], hex: CAT_HEX[id] };
}

const IDIOMAS = [
    { value: 'es-ES', label: '🇪🇸 Español' },
    { value: 'fr-FR', label: '🇫🇷 Francés' },
    { value: 'en-US', label: '🇬🇧 Inglés' },
    { value: 'ca-ES', label: '🏴 Catalán' },
];

function emptyQ(defaultCat) {
    return { tipo: 'SELECCION', q: '', a: '', w: ['', '', ''], bloques: ['', '', ''], alternativas: [], lectura: '', lecturaIdioma: 'es-ES', cat: defaultCat || 'geo' };
}

export default function TrivialEnvioForm({ codigoInicial, onBack }) {
    const [fase,      setFase]      = useState(codigoInicial ? 'CARGANDO' : 'CODIGO');
    const [codigo,    setCodigo]    = useState(codigoInicial || '');
    const [info,      setInfo]      = useState(null);
    const [preguntas, setPreguntas] = useState([]);
    const [nombre,    setNombre]    = useState('');
    const [curso,     setCurso]     = useState('');
    const [error,     setError]     = useState('');
    const [enviando,  setEnviando]  = useState(false);

    useEffect(() => {
        if (codigoInicial) buscar(codigoInicial);
    }, []);

    const buscar = async (code) => {
        const c = (code || codigo).trim().toUpperCase();
        if (!c) return;
        setFase('CARGANDO');
        setError('');
        try {
            const snap = await getDoc(doc(db, 'trivial_envio_codigos', c));
            if (!snap.exists()) { setError('Código no encontrado. Comprueba con tu profesor.'); setFase('CODIGO'); return; }
            const data = snap.data();
            setInfo(data);
            const firstCat = CAT_IDS.find(id => data.categorias?.[id]) || 'geo';
            setPreguntas([emptyQ(firstCat)]);
            setFase('FORMULARIO');
        } catch (e) {
            console.error(e);
            setError('Error al buscar. Inténtalo de nuevo.');
            setFase('CODIGO');
        }
    };

    const updateQ = (idx, field, value) => {
        setPreguntas(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const updateTipo = (idx, tipo) => {
        setPreguntas(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], tipo, q: '', a: '', w: ['', '', ''], bloques: tipo === 'RELLENAR' ? ['', '', ''] : ['', ''], alternativas: [] };
            return next;
        });
    };

    const updateW = (idx, wi, value) => {
        setPreguntas(prev => {
            const next = [...prev];
            const w = [...next[idx].w];
            w[wi] = value;
            next[idx] = { ...next[idx], w };
            return next;
        });
    };

    const updateBloque = (idx, bi, value) => {
        setPreguntas(prev => {
            const next = [...prev];
            const bloques = [...next[idx].bloques];
            bloques[bi] = value;
            next[idx] = { ...next[idx], bloques };
            return next;
        });
    };

    const addBloque = (idx) => {
        setPreguntas(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], bloques: [...next[idx].bloques, ''] };
            return next;
        });
    };

    const removeBloque = (idx, bi) => {
        setPreguntas(prev => {
            const next = [...prev];
            const bloques = next[idx].bloques.filter((_, i) => i !== bi);
            next[idx] = { ...next[idx], bloques };
            return next;
        });
    };

    const addQ = () => {
        const cats = CAT_IDS.filter(id => info?.categorias?.[id] !== undefined);
        const defaultCat = cats[0] || 'geo';
        setPreguntas(prev => [...prev, emptyQ(defaultCat)]);
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
    };

    const removeQ = (idx) => {
        if (preguntas.length <= 1) return;
        setPreguntas(prev => prev.filter((_, i) => i !== idx));
    };

    const enviar = async () => {
        setError('');
        if (!nombre.trim()) { setError('Escribe tu nombre antes de enviar.'); return; }
        for (let i = 0; i < preguntas.length; i++) {
            const p = preguntas[i];
            const n = i + 1;
            if (!p.q.trim() && p.tipo !== 'RELLENAR') { setError(`Falta el texto de la pregunta ${n}.`); return; }
            if (p.tipo === 'SELECCION') {
                if (!p.a.trim()) { setError(`Falta la respuesta correcta en la pregunta ${n}.`); return; }
                if (p.w.some(w => !w.trim())) { setError(`Completa las 3 respuestas incorrectas en la pregunta ${n}.`); return; }
            } else if (p.tipo === 'CORTA') {
                if (!p.a.trim()) { setError(`Falta la respuesta en la pregunta ${n}.`); return; }
            } else if (p.tipo === 'RELLENAR') {
                if (!p.bloques[0].trim()) { setError(`Escribe el texto antes del hueco en la pregunta ${n}.`); return; }
                if (!p.bloques[1].trim()) { setError(`Escribe la respuesta correcta en la pregunta ${n}.`); return; }
            } else if (p.tipo === 'ORDENAR') {
                const items = p.bloques.filter(b => b.trim());
                if (items.length < 2) { setError(`Añade al menos 2 elementos para ordenar en la pregunta ${n}.`); return; }
            }
            if (!p.cat) { setError(`Selecciona categoría en la pregunta ${n}.`); return; }
        }
        setEnviando(true);
        try {
            const col = collection(db, 'trivial_recursos', info.recursoId, 'preguntas_pendientes');
            await Promise.all(preguntas.map(p => {
                const lecturaData = p.lectura.trim() ? { lectura: p.lectura.trim(), lecturaIdioma: p.lecturaIdioma } : {};
                const base = {
                    tipo: p.tipo,
                    categoria: p.cat,
                    enviadoPor: { nombre: nombre.trim(), curso: curso.trim() },
                    fechaCreacion: serverTimestamp(),
                    estado: 'PENDIENTE',
                    ...lecturaData,
                };
                if (p.tipo === 'SELECCION') return addDoc(col, { ...base, q: p.q.trim(), a: p.a.trim(), w: p.w.map(s => s.trim()) });
                if (p.tipo === 'CORTA')     return addDoc(col, { ...base, q: p.q.trim(), a: p.a.trim() });
                if (p.tipo === 'RELLENAR') {
                    const alts = (p.alternativas || []).map(s => s.trim()).filter(Boolean);
                    const rData = { ...base, bloques: [p.bloques[0].trim(), p.bloques[1].trim(), p.bloques[2]?.trim() || ''] };
                    if (alts.length) rData.alternativas = alts;
                    return addDoc(col, rData);
                }
                if (p.tipo === 'ORDENAR')   return addDoc(col, { ...base, q: p.q.trim(), bloques: p.bloques.filter(b => b.trim()) });
                return Promise.resolve();
            }));
            setFase('EXITO');
        } catch (e) {
            console.error(e);
            setError('Error al enviar. Inténtalo de nuevo.');
        }
        setEnviando(false);
    };

    // ─── RENDER: CÓDIGO ───────────────────────────────────────────────────────
    if (fase === 'CODIGO' || fase === 'CARGANDO') return (
        <div style={wrap}>
            {onBack && <button onClick={onBack} style={btnVolver}>← Volver</button>}
            <div style={card}>
                <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎯</div>
                <h2 style={{ color: '#1e293b', margin: '0 0 6px', fontSize: '1.5rem' }}>Enviar preguntas Trivial</h2>
                <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: '0.95rem' }}>Introduce el código que te ha dado tu profesor</p>
                <input
                    value={codigo}
                    onChange={e => { setCodigo(e.target.value.toUpperCase()); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && buscar()}
                    placeholder="CÓDIGO DEL TRIVIAL"
                    maxLength={8}
                    style={{ ...inputBase, textAlign: 'center', fontSize: '1.4rem', letterSpacing: 6, fontFamily: 'monospace', fontWeight: 700, marginBottom: 14 }}
                />
                {error && <p style={{ color: '#dc2626', margin: '0 0 10px', fontSize: '0.88rem' }}>{error}</p>}
                <button
                    onClick={() => buscar()}
                    disabled={fase === 'CARGANDO' || codigo.length < 4}
                    style={{ ...btnPrimary, opacity: (fase === 'CARGANDO' || codigo.length < 4) ? 0.5 : 1 }}
                >
                    {fase === 'CARGANDO' ? 'Buscando…' : 'Entrar →'}
                </button>
            </div>
        </div>
    );

    // ─── RENDER: ÉXITO ────────────────────────────────────────────────────────
    if (fase === 'EXITO') return (
        <div style={wrap}>
            <div style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: 8 }}>🎉</div>
                <h2 style={{ color: '#16a34a', margin: '0 0 8px' }}>¡Preguntas enviadas!</h2>
                <p style={{ color: '#64748b', margin: '0 0 6px' }}>
                    <strong>{preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''}</strong> enviada{preguntas.length !== 1 ? 's' : ''} correctamente.
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 24px' }}>
                    El profesor las revisará y las añadirá al Trivial si las aprueba. ¡Gracias por participar!
                </p>
                {onBack && <button onClick={onBack} style={btnPrimary}>Volver al inicio</button>}
            </div>
        </div>
    );

    // ─── RENDER: FORMULARIO ───────────────────────────────────────────────────
    return (
        <div style={{ ...wrap, justifyContent: 'flex-start', paddingTop: 20, paddingBottom: 40 }}>
            {onBack && <button onClick={onBack} style={{ ...btnVolver, position: 'static', marginBottom: 12 }}>← Volver</button>}

            {/* Header */}
            <div style={{ ...card, marginBottom: 20, textAlign: 'center', paddingTop: 24, paddingBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
                    {CAT_IDS.map(id => {
                        const c = catInfo(id, info?.categorias);
                        return <span key={id} style={{ fontSize: '1.3rem' }} title={c.nombre}>{c.emoji}</span>;
                    })}
                </div>
                <h2 style={{ color: '#1e293b', margin: '0 0 4px', fontSize: '1.4rem' }}>🎯 {info?.titulo || 'Trivial'}</h2>
                {info?.creadorNombre && (
                    <p style={{ color: '#64748b', margin: 0, fontSize: '0.88rem' }}>Enviando preguntas a <strong>{info.creadorNombre}</strong></p>
                )}
            </div>

            {/* Question cards */}
            <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {preguntas.map((p, idx) => {
                    const ci = catInfo(p.cat, info?.categorias);
                    return (
                        <div key={idx} style={{ background: 'white', borderRadius: 16, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', border: `2px solid ${ci.hex}40` }}>
                            {/* Card header: category + type + delete */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.92rem', flexShrink: 0 }}>Pregunta {idx + 1}</span>

                                {/* Category */}
                                <select
                                    value={p.cat}
                                    onChange={e => updateQ(idx, 'cat', e.target.value)}
                                    style={{ background: ci.hex + '18', border: `1.5px solid ${ci.hex}`, color: ci.hex, borderRadius: 8, padding: '5px 9px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', outline: 'none', flex: 1, minWidth: 130 }}
                                >
                                    {CAT_IDS.map(id => {
                                        const c = catInfo(id, info?.categorias);
                                        return <option key={id} value={id}>{c.emoji} {c.nombre}</option>;
                                    })}
                                </select>

                                {/* Type */}
                                <select
                                    value={p.tipo}
                                    onChange={e => updateTipo(idx, e.target.value)}
                                    style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', color: '#475569', borderRadius: 8, padding: '5px 9px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', outline: 'none', flex: 1, minWidth: 150 }}
                                >
                                    {TIPOS.map(t => (
                                        <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                                    ))}
                                </select>

                                {preguntas.length > 1 && (
                                    <button onClick={() => removeQ(idx)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>✕</button>
                                )}
                            </div>

                            {/* ── SELECCION ── */}
                            {p.tipo === 'SELECCION' && (<>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={lbl}>Pregunta</label>
                                    <textarea value={p.q} onChange={e => updateQ(idx, 'q', e.target.value)} placeholder="Escribe aquí la pregunta…" rows={2} style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} />
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ ...lbl, color: '#16a34a' }}>✓ Respuesta correcta</label>
                                    <input value={p.a} onChange={e => updateQ(idx, 'a', e.target.value)} placeholder="La respuesta correcta" style={{ ...inputBase, borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px' }}>
                                    {p.w.map((w, wi) => (
                                        <div key={wi}>
                                            <label style={{ ...lbl, color: '#dc2626' }}>✗ Incorrecta {wi + 1}</label>
                                            <input value={w} onChange={e => updateW(idx, wi, e.target.value)} placeholder={`Opción falsa ${wi + 1}`} style={{ ...inputBase, borderColor: '#fca5a5', background: '#fff5f5', color: '#991b1b' }} />
                                        </div>
                                    ))}
                                </div>
                            </>)}

                            {/* ── CORTA ── */}
                            {p.tipo === 'CORTA' && (<>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={lbl}>Pregunta</label>
                                    <textarea value={p.q} onChange={e => updateQ(idx, 'q', e.target.value)} placeholder="Escribe aquí la pregunta…" rows={2} style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} />
                                </div>
                                <div>
                                    <label style={{ ...lbl, color: '#16a34a' }}>✓ Respuesta correcta</label>
                                    <input value={p.a} onChange={e => updateQ(idx, 'a', e.target.value)} placeholder="Respuesta exacta (el jugador deberá escribirla)" style={{ ...inputBase, borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }} />
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '8px 0 0' }}>El jugador escribe la respuesta. Acentos y mayúsculas se ignoran al comparar.</p>
                            </>)}

                            {/* ── RELLENAR ── */}
                            {p.tipo === 'RELLENAR' && (<>
                                <div style={{ marginBottom: 10 }}>
                                    <label style={lbl}>Texto antes del hueco</label>
                                    <input value={p.bloques[0]} onChange={e => updateBloque(idx, 0, e.target.value)} placeholder="Ej: La capital de España es" style={inputBase} />
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ ...lbl, color: '#16a34a' }}>✓ Respuesta correcta (lo que va en el hueco)</label>
                                    <input value={p.bloques[1]} onChange={e => updateBloque(idx, 1, e.target.value)} placeholder="Ej: Madrid" style={{ ...inputBase, borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }} />
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <label style={lbl}>Texto después del hueco <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
                                    <input value={p.bloques[2] || ''} onChange={e => updateBloque(idx, 2, e.target.value)} placeholder="Ej: , la ciudad más grande de España" style={inputBase} />
                                </div>
                                <div>
                                    <label style={lbl}>Respuestas alternativas válidas <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
                                    {(p.alternativas || []).map((alt, ai) => (
                                        <div key={ai} style={{ display: 'flex', gap: 7, marginBottom: 6, alignItems: 'center' }}>
                                            <input value={alt} onChange={e => { setPreguntas(prev => { const next=[...prev]; const alts=[...(next[idx].alternativas||[])]; alts[ai]=e.target.value; next[idx]={...next[idx],alternativas:alts}; return next; }); }} placeholder={`Alternativa ${ai+1}`} style={{ ...inputBase, flex: 1, marginBottom: 0 }} />
                                            <button onClick={() => setPreguntas(prev => { const next=[...prev]; next[idx]={...next[idx],alternativas:(next[idx].alternativas||[]).filter((_,j)=>j!==ai)}; return next; })} style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#ef4444', borderRadius:6, padding:'6px 8px', cursor:'pointer', fontSize:'0.75rem', flexShrink:0 }}>✕</button>
                                        </div>
                                    ))}
                                    <button onClick={() => setPreguntas(prev => { const next=[...prev]; next[idx]={...next[idx],alternativas:[...(next[idx].alternativas||[]),'']};return next; })} style={{ background:'#f0fdf4', border:'1px dashed #86efac', color:'#16a34a', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:'0.78rem' }}>+ Añadir alternativa</button>
                                </div>
                            </>)}

                            {/* ── ORDENAR ── */}
                            {p.tipo === 'ORDENAR' && (<>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={lbl}>Instrucción</label>
                                    <textarea value={p.q} onChange={e => updateQ(idx, 'q', e.target.value)} placeholder="Ej: Ordena estos presidentes de mayor a menor antigüedad" rows={2} style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} />
                                </div>
                                <label style={lbl}>Elementos en el orden correcto</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {p.bloques.map((b, bi) => (
                                        <div key={bi} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: 22, flexShrink: 0, textAlign: 'center' }}>{bi + 1}</span>
                                            <input
                                                value={b}
                                                onChange={e => updateBloque(idx, bi, e.target.value)}
                                                placeholder={`Elemento ${bi + 1}`}
                                                style={{ ...inputBase, flex: 1 }}
                                            />
                                            {p.bloques.length > 2 && (
                                                <button onClick={() => removeBloque(idx, bi)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => addBloque(idx)}
                                    style={{ marginTop: 8, background: '#f8fafc', border: '1.5px dashed #cbd5e1', color: '#64748b', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, width: '100%' }}
                                >
                                    ＋ Añadir elemento
                                </button>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '8px 0 0' }}>El jugador verá los elementos desordenados y deberá ponerlos en este orden.</p>
                            </>)}

                            {/* ── TTS (todos los tipos) ── */}
                            <div style={{ marginTop: 14, background: '#f0f9ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #bae6fd' }}>
                                <label style={{ ...lbl, color: '#0369a1', marginBottom: 7 }}>🔊 Texto para leer en voz alta <span style={{ fontWeight: 400, color: '#94a3b8' }}>(opcional)</span></label>
                                <textarea
                                    value={p.lectura}
                                    onChange={e => updateQ(idx, 'lectura', e.target.value)}
                                    placeholder="Si rellenas este campo, el navegador leerá este texto al jugador cuando aparezca la pregunta."
                                    rows={2}
                                    style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit', background: 'white', borderColor: p.lectura.trim() ? '#38bdf8' : '#e2e8f0', marginBottom: 8 }}
                                />
                                <select
                                    value={p.lecturaIdioma}
                                    onChange={e => updateQ(idx, 'lecturaIdioma', e.target.value)}
                                    disabled={!p.lectura.trim()}
                                    style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '5px 10px', fontSize: '0.82rem', fontWeight: 600, cursor: p.lectura.trim() ? 'pointer' : 'default', outline: 'none', opacity: p.lectura.trim() ? 1 : 0.4 }}
                                >
                                    {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                </select>
                            </div>
                        </div>
                    );
                })}

                {/* Add question */}
                <button
                    onClick={addQ}
                    style={{ background: 'white', border: '2px dashed #cbd5e1', color: '#64748b', borderRadius: 14, padding: '14px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, width: '100%', transition: '0.15s' }}
                    onMouseEnter={e => { e.target.style.borderColor = '#94a3b8'; e.target.style.color = '#475569'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.color = '#64748b'; }}
                >
                    ＋ Añadir otra pregunta
                </button>

                {/* Sender info */}
                <div style={{ background: 'white', borderRadius: 16, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 14, fontSize: '0.95rem' }}>✍ Tus datos</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label style={lbl}>Nombre y apellidos *</label>
                            <input value={nombre} onChange={e => { setNombre(e.target.value); setError(''); }} placeholder="Tu nombre completo" style={{ ...inputBase, borderColor: nombre.trim() ? '#86efac' : '#e2e8f0' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                            <label style={lbl}>Curso / Clase</label>
                            <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3ºA" style={inputBase} />
                        </div>
                    </div>
                </div>

                {/* Error + submit */}
                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: '0.88rem' }}>
                        ⚠ {error}
                    </div>
                )}
                <button onClick={enviar} disabled={enviando} style={{ ...btnPrimary, padding: '16px', fontSize: '1.05rem', opacity: enviando ? 0.6 : 1 }}>
                    {enviando ? 'Enviando…' : `Enviar ${preguntas.length} pregunta${preguntas.length !== 1 ? 's' : ''} →`}
                </button>
            </div>
        </div>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const wrap       = { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' };
const card       = { background: 'white', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' };
const inputBase  = { width: '100%', padding: '10px 13px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none', background: 'white', transition: 'border-color 0.15s' };
const btnPrimary = { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1d4ed8, #4f46e5)', color: 'white', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(29,78,216,0.4)' };
const btnVolver  = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.88rem', alignSelf: 'flex-start', marginBottom: 16 };
const lbl        = { display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 4, fontWeight: 600 };
