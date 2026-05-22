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

function emptyQ(defaultCat) {
    return { q: '', a: '', w: ['', '', ''], cat: defaultCat || 'geo' };
}

// Returns the display info for a category id, using custom categorias if available
function catInfo(id, categorias) {
    if (categorias?.[id]) return { nombre: categorias[id].nombre, emoji: categorias[id].emoji, hex: CAT_HEX[id] };
    return { ...CAT_DEF[id], hex: CAT_HEX[id] };
}

export default function TrivialEnvioForm({ codigoInicial, onBack }) {
    const [fase,     setFase]     = useState(codigoInicial ? 'CARGANDO' : 'CODIGO');
    const [codigo,   setCodigo]   = useState(codigoInicial || '');
    const [info,     setInfo]     = useState(null);   // { recursoId, titulo, categorias, creadorNombre }
    const [preguntas,setPreguntas]= useState([]);
    const [nombre,   setNombre]   = useState('');
    const [curso,    setCurso]    = useState('');
    const [error,    setError]    = useState('');
    const [enviando, setEnviando] = useState(false);

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

    const updateW = (idx, wi, value) => {
        setPreguntas(prev => {
            const next = [...prev];
            const w = [...next[idx].w];
            w[wi] = value;
            next[idx] = { ...next[idx], w };
            return next;
        });
    };

    const addQ = () => {
        const cats = CAT_IDS.filter(id => info?.categorias?.[id] !== undefined);
        const defaultCat = cats[0] || 'geo';
        setPreguntas(prev => [...prev, emptyQ(defaultCat)]);
        // Scroll to bottom after adding
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
            if (!p.q.trim())           { setError(`Falta el texto de la pregunta ${i + 1}.`); return; }
            if (!p.a.trim())           { setError(`Falta la respuesta correcta en la pregunta ${i + 1}.`); return; }
            if (p.w.some(w => !w.trim())) { setError(`Completa las 3 respuestas incorrectas en la pregunta ${i + 1}.`); return; }
            if (!p.cat)                { setError(`Selecciona categoría en la pregunta ${i + 1}.`); return; }
        }
        setEnviando(true);
        try {
            const col = collection(db, 'trivial_recursos', info.recursoId, 'preguntas_pendientes');
            await Promise.all(preguntas.map(p =>
                addDoc(col, {
                    q: p.q.trim(), a: p.a.trim(), w: p.w.map(s => s.trim()),
                    categoria: p.cat,
                    enviadoPor: { nombre: nombre.trim(), curso: curso.trim() },
                    fechaCreacion: serverTimestamp(),
                    estado: 'PENDIENTE',
                })
            ));
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
    const cats = CAT_IDS.filter(id => info?.categorias ? true : true); // always show all

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
                            {/* Card header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem', minWidth: 80 }}>Pregunta {idx + 1}</span>
                                {/* Category selector */}
                                <select
                                    value={p.cat}
                                    onChange={e => updateQ(idx, 'cat', e.target.value)}
                                    style={{ background: ci.hex + '18', border: `1.5px solid ${ci.hex}`, color: ci.hex, borderRadius: 8, padding: '5px 10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', outline: 'none', flex: 1, minWidth: 140 }}
                                >
                                    {CAT_IDS.map(id => {
                                        const c = catInfo(id, info?.categorias);
                                        return <option key={id} value={id}>{c.emoji} {c.nombre}</option>;
                                    })}
                                </select>
                                {preguntas.length > 1 && (
                                    <button onClick={() => removeQ(idx)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>✕</button>
                                )}
                            </div>

                            {/* Question */}
                            <div style={{ marginBottom: 12 }}>
                                <label style={lbl}>Pregunta</label>
                                <textarea
                                    value={p.q}
                                    onChange={e => updateQ(idx, 'q', e.target.value)}
                                    placeholder="Escribe aquí la pregunta…"
                                    rows={2}
                                    style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>

                            {/* Correct */}
                            <div style={{ marginBottom: 8 }}>
                                <label style={{ ...lbl, color: '#16a34a' }}>✓ Respuesta correcta</label>
                                <input
                                    value={p.a}
                                    onChange={e => updateQ(idx, 'a', e.target.value)}
                                    placeholder="La respuesta correcta"
                                    style={{ ...inputBase, borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }}
                                />
                            </div>

                            {/* Wrong answers */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px' }}>
                                {p.w.map((w, wi) => (
                                    <div key={wi}>
                                        <label style={{ ...lbl, color: '#dc2626' }}>✗ Incorrecta {wi + 1}</label>
                                        <input
                                            value={w}
                                            onChange={e => updateW(idx, wi, e.target.value)}
                                            placeholder={`Opción falsa ${wi + 1}`}
                                            style={{ ...inputBase, borderColor: '#fca5a5', background: '#fff5f5', color: '#991b1b' }}
                                        />
                                    </div>
                                ))}
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
                            <input
                                value={nombre}
                                onChange={e => { setNombre(e.target.value); setError(''); }}
                                placeholder="Tu nombre completo"
                                style={{ ...inputBase, borderColor: nombre.trim() ? '#86efac' : '#e2e8f0' }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                            <label style={lbl}>Curso / Clase</label>
                            <input
                                value={curso}
                                onChange={e => setCurso(e.target.value)}
                                placeholder="Ej: 3ºA"
                                style={inputBase}
                            />
                        </div>
                    </div>
                </div>

                {/* Error + submit */}
                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: '0.88rem' }}>
                        ⚠ {error}
                    </div>
                )}
                <button
                    onClick={enviar}
                    disabled={enviando}
                    style={{ ...btnPrimary, padding: '16px', fontSize: '1.05rem', opacity: enviando ? 0.6 : 1 }}
                >
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
