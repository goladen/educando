import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, serverTimestamp, orderBy
} from 'firebase/firestore';

const CATS = {
    geo: { hex: '#3498db', name: 'Geografía',    emoji: '🌍' },
    esp: { hex: '#e84393', name: 'Espectáculos', emoji: '🎬' },
    his: { hex: '#f1c40f', name: 'Historia',     emoji: '📜' },
    art: { hex: '#9b59b6', name: 'Arte y Lit.',  emoji: '🎨' },
    cie: { hex: '#2ecc71', name: 'Ciencias',     emoji: '🔬' },
    dep: { hex: '#e67e22', name: 'Deportes',     emoji: '⚽' },
};

function genCode(len = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

export default function EditorTrivial({ recurso, usuario, onClose, onSaved }) {
    const esNuevo = !recurso?.id;
    const esCreador = esNuevo || recurso?.creadorUid === usuario?.uid;

    // Metadata
    const [titulo, setTitulo] = useState(recurso?.titulo || '');
    const [descripcion, setDescripcion] = useState(recurso?.descripcion || '');
    const [publica, setPublica] = useState(recurso?.publica ?? true);
    const [recursoId, setRecursoId] = useState(recurso?.id || null);
    const [codigosCategoria, setCodigosCategoria] = useState(recurso?.codigosCategoria || null);
    const [colaboradores, setColaboradores] = useState(recurso?.colaboradores || []);
    const [codigoJuego, setCodigoJuego] = useState(recurso?.codigoJuego || null);

    // Content
    const [tabActiva, setTabActiva] = useState('geo');
    const [preguntas, setPreguntas] = useState({ geo: [], esp: [], his: [], art: [], cie: [], dep: [] });
    const [preguntasCargadas, setPreguntasCargadas] = useState({});
    const [cargandoPreguntas, setCargandoPreguntas] = useState(false);

    // Form
    const [formAbierto, setFormAbierto] = useState(false);
    const [formQ, setFormQ] = useState('');
    const [formA, setFormA] = useState('');
    const [formW, setFormW] = useState(['', '', '']);
    const [guardandoPregunta, setGuardandoPregunta] = useState(false);
    const [errorForm, setErrorForm] = useState('');

    // Collaboration panel
    const [panelColab, setPanelColab] = useState(false);
    const [emailNuevo, setEmailNuevo] = useState('');
    const [agregandoColab, setAgregandoColab] = useState(false);
    const [errorColab, setErrorColab] = useState('');

    // Save
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [copiado, setCopiado] = useState('');

    useEffect(() => {
        if (recursoId && !preguntasCargadas[tabActiva]) {
            cargarPreguntas(tabActiva);
        }
    }, [recursoId, tabActiva]);

    const cargarPreguntas = async (cat) => {
        setCargandoPreguntas(true);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'trivial_recursos', recursoId, 'preguntas'),
                    where('categoria', '==', cat),
                    orderBy('fechaCreacion', 'asc')
                )
            );
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPreguntas(prev => ({ ...prev, [cat]: lista }));
            setPreguntasCargadas(prev => ({ ...prev, [cat]: true }));
        } catch (e) {
            console.error(e);
        }
        setCargandoPreguntas(false);
    };

    const guardarRecurso = async () => {
        if (!titulo.trim()) { setErrorGuardar('El título es obligatorio.'); return; }
        setGuardando(true);
        setErrorGuardar('');
        try {
            if (esNuevo) {
                const codigos = {};
                for (const cat of Object.keys(CATS)) codigos[cat] = genCode(8);
                const codigoJ = genCode(6);

                const data = {
                    titulo: titulo.trim(),
                    descripcion: descripcion.trim(),
                    publica,
                    creadorUid: usuario.uid,
                    creadorEmail: usuario.email,
                    creadorNombre: usuario.displayName || usuario.email,
                    codigosCategoria: codigos,
                    codigoJuego: codigoJ,
                    colaboradores: [],
                    tipoJuego: 'TRIVIAL',
                    fechaCreacion: serverTimestamp(),
                    fechaModificacion: serverTimestamp(),
                };

                const ref = await addDoc(collection(db, 'trivial_recursos'), data);

                await Promise.all(
                    Object.entries(codigos).map(([cat, code]) =>
                        setDoc(doc(db, 'trivial_inv_codigos', code), {
                            recursoId: ref.id,
                            categoria: cat,
                            titulo: titulo.trim(),
                        })
                    )
                );

                setRecursoId(ref.id);
                setCodigosCategoria(codigos);
                setCodigoJuego(codigoJ);
                if (onSaved) onSaved({ id: ref.id, ...data, codigosCategoria: codigos });
            } else {
                await updateDoc(doc(db, 'trivial_recursos', recursoId), {
                    titulo: titulo.trim(),
                    descripcion: descripcion.trim(),
                    publica,
                    fechaModificacion: serverTimestamp(),
                });
                if (onSaved) onSaved({ id: recursoId, titulo: titulo.trim(), descripcion: descripcion.trim(), publica });
            }
        } catch (e) {
            console.error(e);
            setErrorGuardar('Error al guardar. Inténtalo de nuevo.');
        }
        setGuardando(false);
    };

    const agregarPregunta = async () => {
        setErrorForm('');
        if (!formQ.trim()) { setErrorForm('Escribe la pregunta.'); return; }
        if (!formA.trim()) { setErrorForm('Escribe la respuesta correcta.'); return; }
        if (formW.some(w => !w.trim())) { setErrorForm('Completa las tres respuestas incorrectas.'); return; }
        if (!recursoId) { setErrorGuardar('Guarda el recurso primero (botón "Crear" arriba).'); return; }

        setGuardandoPregunta(true);
        try {
            const ref = await addDoc(
                collection(db, 'trivial_recursos', recursoId, 'preguntas'),
                {
                    categoria: tabActiva,
                    q: formQ.trim(),
                    a: formA.trim(),
                    w: formW.map(s => s.trim()),
                    autorUid: usuario.uid,
                    autorNombre: usuario.displayName || usuario.email,
                    fechaCreacion: serverTimestamp(),
                }
            );
            setPreguntas(prev => ({
                ...prev,
                [tabActiva]: [
                    ...prev[tabActiva],
                    {
                        id: ref.id,
                        categoria: tabActiva,
                        q: formQ.trim(),
                        a: formA.trim(),
                        w: formW.map(s => s.trim()),
                        autorUid: usuario.uid,
                        autorNombre: usuario.displayName || usuario.email,
                    }
                ]
            }));
            setFormQ('');
            setFormA('');
            setFormW(['', '', '']);
            setFormAbierto(false);
        } catch (e) {
            console.error(e);
            setErrorForm('Error al guardar la pregunta.');
        }
        setGuardandoPregunta(false);
    };

    const eliminarPregunta = async (pregId, autorUid) => {
        if (!esCreador && autorUid !== usuario?.uid) return;
        if (!window.confirm('¿Eliminar esta pregunta?')) return;
        try {
            await deleteDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', pregId));
            setPreguntas(prev => ({
                ...prev,
                [tabActiva]: prev[tabActiva].filter(p => p.id !== pregId)
            }));
        } catch (e) {
            console.error(e);
        }
    };

    const agregarColaboradorPorEmail = async () => {
        if (!emailNuevo.trim()) return;
        setAgregandoColab(true);
        setErrorColab('');
        try {
            const snap = await getDocs(
                query(collection(db, 'users'), where('email', '==', emailNuevo.trim().toLowerCase()))
            );
            if (snap.empty) {
                setErrorColab('No se encontró ningún usuario con ese email.');
                setAgregandoColab(false);
                return;
            }
            const uid = snap.docs[0].id;
            const userData = snap.docs[0].data();
            if (colaboradores.find(c => c.uid === uid)) {
                setErrorColab('Ya es colaborador.');
                setAgregandoColab(false);
                return;
            }
            const nuevos = [...colaboradores, {
                uid,
                email: userData.email,
                nombre: userData.displayName || userData.email,
            }];
            await updateDoc(doc(db, 'trivial_recursos', recursoId), { colaboradores: nuevos });
            setColaboradores(nuevos);
            setEmailNuevo('');
        } catch (e) {
            console.error(e);
            setErrorColab('Error al agregar colaborador.');
        }
        setAgregandoColab(false);
    };

    const quitarColaborador = async (uid) => {
        const nuevos = colaboradores.filter(c => c.uid !== uid);
        await updateDoc(doc(db, 'trivial_recursos', recursoId), { colaboradores: nuevos });
        setColaboradores(nuevos);
    };

    const copiar = (texto, key) => {
        navigator.clipboard.writeText(texto).then(() => {
            setCopiado(key);
            setTimeout(() => setCopiado(''), 2000);
        });
    };

    const cat = CATS[tabActiva];
    const pregsCat = preguntas[tabActiva];
    const totalPreguntas = Object.values(preguntas).reduce((s, arr) => s + arr.length, 0);

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: '#0f172a', zIndex: 2000,
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Segoe UI', sans-serif",
        }}>
            {/* ─── HEADER ─── */}
            <div style={{
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
            }}>
                <button
                    onClick={onClose}
                    title="Volver"
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.3rem', padding: '2px 8px', lineHeight: 1, borderRadius: 6 }}
                >
                    ←
                </button>
                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Título del Trivial…"
                    disabled={!esCreador}
                    style={{
                        flex: 1, background: 'transparent', border: 'none',
                        color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700,
                        outline: 'none', minWidth: 0,
                    }}
                />
                {totalPreguntas > 0 && (
                    <span style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {totalPreguntas} preguntas
                    </span>
                )}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {esCreador && (
                        <button
                            onClick={() => setPublica(p => !p)}
                            style={{
                                background: publica ? '#0f4c2a' : '#3b1f0a',
                                border: `1px solid ${publica ? '#2ecc71' : '#e67e22'}`,
                                color: publica ? '#2ecc71' : '#e67e22',
                                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 600,
                            }}
                        >
                            {publica ? '🌐 Pública' : '🔒 Privada'}
                        </button>
                    )}
                    <button
                        onClick={() => setPanelColab(p => !p)}
                        style={{
                            background: panelColab ? '#1e3a8a' : '#1e293b',
                            border: '1px solid #3b82f6',
                            color: '#60a5fa',
                            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 600,
                        }}
                    >
                        👥 Colaborar
                    </button>
                    {esCreador && (
                        <button
                            onClick={guardarRecurso}
                            disabled={guardando}
                            style={{
                                background: '#1d4ed8', border: 'none', color: 'white',
                                padding: '8px 18px', borderRadius: 8, cursor: guardando ? 'default' : 'pointer',
                                fontSize: '0.9rem', fontWeight: 700,
                                opacity: guardando ? 0.7 : 1,
                            }}
                        >
                            {guardando ? '…' : esNuevo ? '✓ Crear' : '✓ Guardar'}
                        </button>
                    )}
                </div>
            </div>

            {errorGuardar && (
                <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 20px', fontSize: '0.85rem', flexShrink: 0 }}>
                    ⚠ {errorGuardar}
                </div>
            )}

            {/* ─── CATEGORY TABS ─── */}
            <div style={{
                display: 'flex',
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                flexShrink: 0,
                overflowX: 'auto',
            }}>
                {Object.entries(CATS).map(([id, c]) => {
                    const count = preguntas[id]?.length ?? 0;
                    const active = id === tabActiva;
                    return (
                        <button
                            key={id}
                            onClick={() => setTabActiva(id)}
                            style={{
                                flex: 1, minWidth: 88, padding: '10px 6px',
                                border: 'none',
                                borderBottom: active ? `3px solid ${c.hex}` : '3px solid transparent',
                                background: active ? c.hex + '18' : 'transparent',
                                color: active ? c.hex : '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: active ? 700 : 500,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                transition: 'all 0.15s',
                            }}
                        >
                            <span style={{ fontSize: '1.15rem' }}>{c.emoji}</span>
                            <span>{c.name}</span>
                            <span style={{
                                background: active ? c.hex : '#334155',
                                color: active ? 'white' : '#94a3b8',
                                borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem',
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ─── MAIN AREA ─── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Questions column */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* "Save first" hint when brand new */}
                    {esNuevo && !recursoId && (
                        <div style={{
                            background: '#1e3a8a22', border: '1px solid #3b82f660',
                            borderRadius: 12, padding: '14px 18px',
                            color: '#93c5fd', fontSize: '0.9rem',
                        }}>
                            Pon un título y pulsa <strong>✓ Crear</strong> para empezar a añadir preguntas.
                        </div>
                    )}

                    {/* Add question form */}
                    {recursoId && (
                        <div style={{
                            background: '#1e293b',
                            borderRadius: 14,
                            border: `1px solid ${cat.hex}50`,
                            overflow: 'hidden',
                        }}>
                            <button
                                onClick={() => { setFormAbierto(p => !p); setErrorForm(''); }}
                                style={{
                                    width: '100%', padding: '13px 18px',
                                    background: 'none', border: 'none',
                                    color: cat.hex, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    fontSize: '0.92rem', fontWeight: 700,
                                }}
                            >
                                <span style={{ fontSize: '1.1rem', transition: 'transform 0.2s', transform: formAbierto ? 'rotate(45deg)' : 'none', display: 'inline-block' }}>＋</span>
                                Añadir pregunta de {cat.name}
                            </button>

                            {formAbierto && (
                                <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <textarea
                                        value={formQ}
                                        onChange={e => setFormQ(e.target.value)}
                                        placeholder="¿Cuál es la pregunta?"
                                        rows={2}
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            background: '#0f172a', border: '1px solid #334155',
                                            borderRadius: 8, color: '#f1f5f9',
                                            padding: '10px 13px', fontSize: '0.9rem',
                                            resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                                        }}
                                    />
                                    <input
                                        value={formA}
                                        onChange={e => setFormA(e.target.value)}
                                        placeholder="✓ Respuesta correcta"
                                        style={{
                                            background: '#0d2b1b', border: '2px solid #2ecc71',
                                            borderRadius: 8, color: '#4ade80',
                                            padding: '9px 13px', fontSize: '0.88rem',
                                            fontFamily: 'inherit', outline: 'none',
                                        }}
                                    />
                                    {formW.map((w, i) => (
                                        <input
                                            key={i}
                                            value={w}
                                            onChange={e => {
                                                const nw = [...formW];
                                                nw[i] = e.target.value;
                                                setFormW(nw);
                                            }}
                                            placeholder={`✗ Respuesta incorrecta ${i + 1}`}
                                            style={{
                                                background: '#2a0d0d', border: '2px solid #e74c3c',
                                                borderRadius: 8, color: '#fca5a5',
                                                padding: '9px 13px', fontSize: '0.88rem',
                                                fontFamily: 'inherit', outline: 'none',
                                            }}
                                        />
                                    ))}
                                    {errorForm && (
                                        <div style={{ color: '#fca5a5', fontSize: '0.82rem' }}>⚠ {errorForm}</div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <button
                                            onClick={() => { setFormAbierto(false); setFormQ(''); setFormA(''); setFormW(['', '', '']); setErrorForm(''); }}
                                            style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={agregarPregunta}
                                            disabled={guardandoPregunta}
                                            style={{
                                                background: cat.hex, border: 'none', color: 'white',
                                                padding: '8px 22px', borderRadius: 8,
                                                cursor: guardandoPregunta ? 'default' : 'pointer',
                                                fontWeight: 700, fontSize: '0.88rem',
                                                opacity: guardandoPregunta ? 0.6 : 1,
                                            }}
                                        >
                                            {guardandoPregunta ? 'Guardando…' : '+ Añadir'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {cargandoPreguntas && (
                        <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Cargando preguntas…</p>
                    )}

                    {/* Empty state */}
                    {!cargandoPreguntas && recursoId && pregsCat.length === 0 && (
                        <div style={{
                            textAlign: 'center', padding: '36px 20px',
                            background: '#1e293b', borderRadius: 14,
                            border: '2px dashed #334155',
                        }}>
                            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{cat.emoji}</div>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
                                No hay preguntas de {cat.name} todavía.
                            </p>
                        </div>
                    )}

                    {/* Questions list */}
                    {pregsCat.map((p, idx) => {
                        const puedeEliminar = esCreador || p.autorUid === usuario?.uid;
                        return (
                            <div
                                key={p.id}
                                style={{
                                    background: '#1e293b',
                                    borderRadius: 12,
                                    padding: '14px 18px',
                                    border: `1px solid ${cat.hex}28`,
                                }}
                            >
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: '#475569', fontSize: '0.72rem', marginBottom: 6 }}>
                                            #{idx + 1} · {p.autorNombre}
                                        </div>
                                        <div style={{ color: '#f1f5f9', fontSize: '0.92rem', fontWeight: 600, marginBottom: 10, lineHeight: 1.45 }}>
                                            {p.q}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                                                <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>{p.a}</span>
                                            </div>
                                            {p.w?.map((wr, wi) => (
                                                <div key={wi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e74c3c', flexShrink: 0 }} />
                                                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{wr}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {puedeEliminar && (
                                        <button
                                            onClick={() => eliminarPregunta(p.id, p.autorUid)}
                                            title="Eliminar pregunta"
                                            style={{
                                                background: '#7f1d1d30', border: '1px solid #ef444430',
                                                color: '#f87171', padding: '5px 9px',
                                                borderRadius: 7, cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0,
                                            }}
                                        >
                                            🗑
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ─── COLLABORATION PANEL ─── */}
                {panelColab && (
                    <div style={{
                        width: 300, background: '#1e293b',
                        borderLeft: '1px solid #334155',
                        overflowY: 'auto', padding: 18,
                        flexShrink: 0,
                        display: 'flex', flexDirection: 'column', gap: 20,
                    }}>

                        {/* Game code */}
                        {codigoJuego && (
                            <div>
                                <div style={labelStyle}>Código para alumnos</div>
                                <div style={codeBox}>
                                    <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.25rem', letterSpacing: 4 }}>
                                        {codigoJuego}
                                    </span>
                                    <CopyBtn texto={codigoJuego} id="juego" copiado={copiado} copiar={copiar} />
                                </div>
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '6px 0 0' }}>
                                    Los alumnos usan este código en el buscador del juego.
                                </p>
                            </div>
                        )}

                        {/* Invitation codes */}
                        {codigosCategoria && (
                            <div>
                                <div style={labelStyle}>Códigos de invitación por categoría</div>
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0 0 10px' }}>
                                    Comparte el código de una categoría para que otro profesor pueda añadir preguntas en ella.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {Object.entries(CATS).map(([id, c]) => (
                                        <div key={id} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span>{c.emoji}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: c.hex, fontSize: '0.73rem', fontWeight: 600 }}>{c.name}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.78rem', fontFamily: 'monospace', letterSpacing: 1 }}>{codigosCategoria[id]}</div>
                                            </div>
                                            <CopyBtn texto={codigosCategoria[id]} id={id} copiado={copiado} copiar={copiar} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Email sharing — creator only */}
                        {esCreador && recursoId && (
                            <div>
                                <div style={labelStyle}>Compartir con profesor</div>
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0 0 10px' }}>
                                    El profesor añadido podrá añadir y borrar sus propias preguntas.
                                </p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        value={emailNuevo}
                                        onChange={e => { setEmailNuevo(e.target.value); setErrorColab(''); }}
                                        onKeyDown={e => e.key === 'Enter' && agregarColaboradorPorEmail()}
                                        placeholder="email@profesor.com"
                                        style={{
                                            flex: 1, background: '#0f172a',
                                            border: '1px solid #334155', borderRadius: 7,
                                            color: '#f1f5f9', padding: '8px 10px',
                                            fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
                                        }}
                                    />
                                    <button
                                        onClick={agregarColaboradorPorEmail}
                                        disabled={agregandoColab}
                                        style={{ background: '#1d4ed8', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                                    >
                                        {agregandoColab ? '…' : 'Añadir'}
                                    </button>
                                </div>
                                {errorColab && (
                                    <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: 6 }}>⚠ {errorColab}</div>
                                )}

                                {colaboradores.length > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {colaboradores.map(c => (
                                            <div key={c.uid} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ color: '#e2e8f0', fontSize: '0.83rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                                                    <div style={{ color: '#64748b', fontSize: '0.73rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                                                </div>
                                                <button
                                                    onClick={() => quitarColaborador(c.uid)}
                                                    title="Quitar colaborador"
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: 2 }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {!esCreador && (
                            <div style={{ color: '#64748b', fontSize: '0.83rem', background: '#0f172a', borderRadius: 8, padding: 12, lineHeight: 1.5 }}>
                                Eres colaborador de este recurso. Puedes añadir preguntas y eliminar las tuyas propias.
                            </div>
                        )}

                        {/* Stats per category */}
                        {recursoId && (
                            <div>
                                <div style={labelStyle}>Preguntas por categoría</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {Object.entries(CATS).map(([id, c]) => {
                                        const n = preguntas[id]?.length ?? 0;
                                        const pct = Math.min(100, (n / 20) * 100);
                                        return (
                                            <div key={id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <span style={{ color: c.hex, fontSize: '0.76rem' }}>{c.emoji} {c.name}</span>
                                                    <span style={{ color: '#64748b', fontSize: '0.76rem' }}>{n}</span>
                                                </div>
                                                <div style={{ height: 4, background: '#334155', borderRadius: 2 }}>
                                                    <div style={{ height: 4, background: c.hex, borderRadius: 2, width: `${pct}%`, transition: 'width 0.4s' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Helper sub-components ─────────────────────────────────────────────────

function CopyBtn({ texto, id, copiado, copiar }) {
    const done = copiado === id;
    return (
        <button
            onClick={() => copiar(texto, id)}
            style={{
                background: done ? '#166534' : '#334155',
                border: 'none', color: done ? '#4ade80' : '#94a3b8',
                padding: '4px 10px', borderRadius: 6,
                cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0,
                transition: 'background 0.2s',
            }}
        >
            {done ? '✓' : 'Copiar'}
        </button>
    );
}

const labelStyle = {
    color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 8,
};

const codeBox = {
    background: '#0f172a', borderRadius: 10, padding: '10px 14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
