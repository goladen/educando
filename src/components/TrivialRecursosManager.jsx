import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, doc, getDocs, getDoc, deleteDoc,
    query, where, orderBy, arrayUnion, updateDoc
} from 'firebase/firestore';
import EditorTrivial from './EditorTrivial';

const CATS = {
    geo: { hex: '#3498db', name: 'Geografía',    emoji: '🌍' },
    esp: { hex: '#e84393', name: 'Espectáculos', emoji: '🎬' },
    his: { hex: '#f1c40f', name: 'Historia',     emoji: '📜' },
    art: { hex: '#9b59b6', name: 'Arte y Lit.',  emoji: '🎨' },
    cie: { hex: '#2ecc71', name: 'Ciencias',     emoji: '🔬' },
    dep: { hex: '#e67e22', name: 'Deportes',     emoji: '⚽' },
};

export default function TrivialRecursosManager({ usuario }) {
    const [propios, setPropios] = useState([]);
    const [compartidos, setCompartidos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    // Editor state
    const [recursoEditando, setRecursoEditando] = useState(null); // null = cerrado, {} = nuevo, {id,...} = editar
    const [editorAbierto, setEditorAbierto] = useState(false);

    // Join with code
    const [codigoUnirse, setCodigoUnirse] = useState('');
    const [uniendose, setUniendose] = useState(false);
    const [mensajeUnirse, setMensajeUnirse] = useState('');

    useEffect(() => {
        if (usuario?.uid) cargarRecursos();
    }, [usuario]);

    const cargarRecursos = async () => {
        setCargando(true);
        setError('');
        try {
            // Own resources
            const snapPropios = await getDocs(
                query(
                    collection(db, 'trivial_recursos'),
                    where('creadorUid', '==', usuario.uid),
                    orderBy('fechaModificacion', 'desc')
                )
            );
            setPropios(snapPropios.docs.map(d => ({ id: d.id, ...d.data() })));

            // Shared (colaborador)
            const snapComp = await getDocs(
                query(
                    collection(db, 'trivial_recursos'),
                    where('colaboradores', 'array-contains', { uid: usuario.uid, email: usuario.email, nombre: usuario.displayName || usuario.email })
                )
            );
            // array-contains on object can miss partial matches; fallback: filter client-side
            // Use a simpler approach: query by uid field in colaboradores array is not directly supported,
            // so we'll rely on the data already loaded or use a secondary query by email
            const snapComp2 = await getDocs(
                query(collection(db, 'trivial_recursos'), where('colaboradoresUids', 'array-contains', usuario.uid))
            );
            setCompartidos(snapComp2.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
            setError('Error al cargar los recursos.');
        }
        setCargando(false);
    };

    const unirseConCodigo = async () => {
        const code = codigoUnirse.trim().toUpperCase();
        if (!code) return;
        setUniendose(true);
        setMensajeUnirse('');
        try {
            const invDoc = await getDoc(doc(db, 'trivial_inv_codigos', code));
            if (!invDoc.exists()) {
                setMensajeUnirse('Código no encontrado.');
                setUniendose(false);
                return;
            }
            const { recursoId, categoria, titulo } = invDoc.data();

            // Check already collaborator
            const recursoRef = doc(db, 'trivial_recursos', recursoId);
            const recursoSnap = await getDoc(recursoRef);
            if (!recursoSnap.exists()) {
                setMensajeUnirse('El recurso ya no existe.');
                setUniendose(false);
                return;
            }
            const data = recursoSnap.data();

            if (data.creadorUid === usuario.uid) {
                setMensajeUnirse('Eres el creador de este recurso.');
                setUniendose(false);
                return;
            }

            const yaColaborador = data.colaboradores?.some(c => c.uid === usuario.uid);
            if (!yaColaborador) {
                const nuevoColab = {
                    uid: usuario.uid,
                    email: usuario.email,
                    nombre: usuario.displayName || usuario.email,
                };
                const nuevosColabs = [...(data.colaboradores || []), nuevoColab];
                const nuevosUids = [...(data.colaboradoresUids || []), usuario.uid];
                await updateDoc(recursoRef, {
                    colaboradores: nuevosColabs,
                    colaboradoresUids: nuevosUids,
                });
            }

            setMensajeUnirse(`¡Unido! Ahora puedes editar la categoría "${CATS[categoria]?.name || categoria}" del recurso "${titulo}".`);
            setCodigoUnirse('');

            // Open the resource in editor
            const recursoActualizado = { id: recursoId, ...data };
            setRecursoEditando(recursoActualizado);
            setEditorAbierto(true);
            await cargarRecursos();
        } catch (e) {
            console.error(e);
            setMensajeUnirse('Error al unirse. Inténtalo de nuevo.');
        }
        setUniendose(false);
    };

    const eliminarRecurso = async (id) => {
        if (!window.confirm('¿Eliminar este recurso Trivial y todas sus preguntas? Esta acción no se puede deshacer.')) return;
        try {
            // Delete all questions in subcollection
            const pregSnap = await getDocs(collection(db, 'trivial_recursos', id, 'preguntas'));
            await Promise.all(pregSnap.docs.map(d => deleteDoc(d.ref)));
            await deleteDoc(doc(db, 'trivial_recursos', id));
            setPropios(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const abrirEditor = (recurso) => {
        setRecursoEditando(recurso || {});
        setEditorAbierto(true);
    };

    const cerrarEditor = () => {
        setEditorAbierto(false);
        setRecursoEditando(null);
        cargarRecursos();
    };

    if (editorAbierto) {
        return (
            <EditorTrivial
                recurso={recursoEditando?.id ? recursoEditando : null}
                usuario={usuario}
                onClose={cerrarEditor}
                onSaved={() => {}}
            />
        );
    }

    return (
        <div style={{ padding: '28px 20px', maxWidth: 900, margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '2.2rem' }}>🎯</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#1e293b' }}>Editor Trivial</h2>
                    <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                        Crea recursos Trivial con preguntas propias y compártelos con otros profesores.
                    </p>
                </div>
                <button
                    onClick={() => abrirEditor(null)}
                    style={{
                        background: '#1d4ed8', border: 'none', color: 'white',
                        padding: '10px 22px', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.95rem',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}
                >
                    ＋ Nuevo Trivial
                </button>
            </div>

            {/* Join with code */}
            <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 14, padding: '18px 20px', marginBottom: 28,
            }}>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: 10, fontSize: '0.95rem' }}>
                    🔑 Unirme a un Trivial con código de invitación
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        value={codigoUnirse}
                        onChange={e => { setCodigoUnirse(e.target.value.toUpperCase()); setMensajeUnirse(''); }}
                        onKeyDown={e => e.key === 'Enter' && unirseConCodigo()}
                        placeholder="Código de 8 letras…"
                        maxLength={8}
                        style={{
                            flex: 1, border: '1px solid #d1d5db', borderRadius: 8,
                            padding: '10px 14px', fontSize: '0.95rem',
                            fontFamily: 'monospace', letterSpacing: 2, outline: 'none',
                            textTransform: 'uppercase',
                        }}
                    />
                    <button
                        onClick={unirseConCodigo}
                        disabled={uniendose || codigoUnirse.length < 6}
                        style={{
                            background: '#0f172a', border: 'none', color: 'white',
                            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.9rem',
                            opacity: (uniendose || codigoUnirse.length < 6) ? 0.5 : 1,
                        }}
                    >
                        {uniendose ? '…' : 'Unirme'}
                    </button>
                </div>
                {mensajeUnirse && (
                    <div style={{
                        marginTop: 8, fontSize: '0.85rem',
                        color: mensajeUnirse.startsWith('¡') ? '#16a34a' : '#dc2626',
                    }}>
                        {mensajeUnirse}
                    </div>
                )}
            </div>

            {cargando && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Cargando recursos…</p>}
            {error && <p style={{ color: '#dc2626', textAlign: 'center' }}>{error}</p>}

            {/* My resources */}
            {!cargando && (
                <>
                    <Section
                        titulo="Mis recursos Trivial"
                        emoji="📚"
                        recursos={propios}
                        usuario={usuario}
                        esPropio
                        onEditar={abrirEditor}
                        onEliminar={eliminarRecurso}
                        emptyMsg="Todavía no has creado ningún Trivial. Pulsa «+ Nuevo Trivial» para empezar."
                    />

                    {compartidos.length > 0 && (
                        <Section
                            titulo="Compartidos conmigo"
                            emoji="🤝"
                            recursos={compartidos}
                            usuario={usuario}
                            esPropio={false}
                            onEditar={abrirEditor}
                            onEliminar={null}
                            emptyMsg=""
                        />
                    )}
                </>
            )}
        </div>
    );
}

function Section({ titulo, emoji, recursos, usuario, esPropio, onEditar, onEliminar, emptyMsg }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <h3 style={{ color: '#1e293b', fontSize: '1.1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                {emoji} {titulo}
                <span style={{ background: '#e2e8f0', color: '#64748b', borderRadius: 10, padding: '1px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {recursos.length}
                </span>
            </h3>

            {recursos.length === 0 && emptyMsg && (
                <div style={{
                    background: '#f8fafc', border: '2px dashed #e2e8f0',
                    borderRadius: 14, padding: '36px 20px', textAlign: 'center',
                }}>
                    <p style={{ color: '#94a3b8', margin: 0 }}>{emptyMsg}</p>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recursos.map(r => (
                    <RecursoCard
                        key={r.id}
                        recurso={r}
                        esPropio={esPropio}
                        onEditar={() => onEditar(r)}
                        onEliminar={onEliminar ? () => onEliminar(r.id) : null}
                    />
                ))}
            </div>
        </div>
    );
}

function RecursoCard({ recurso: r, esPropio, onEditar, onEliminar }) {
    const totalPreguntas = r.totalPreguntas || '—';
    const fecha = r.fechaModificacion?.toDate?.()?.toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric'
    }) || '—';

    return (
        <div style={{
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '16px 20px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
            <div style={{ fontSize: '2rem' }}>🎯</div>
            <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>{r.titulo}</span>
                    <span style={{
                        background: r.publica ? '#dcfce7' : '#fef3c7',
                        color: r.publica ? '#16a34a' : '#d97706',
                        borderRadius: 8, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600,
                    }}>
                        {r.publica ? '🌐 Pública' : '🔒 Privada'}
                    </span>
                </div>
                {r.descripcion && (
                    <div style={{ color: '#64748b', fontSize: '0.83rem', marginTop: 3 }}>{r.descripcion}</div>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    {Object.entries(CATS).map(([id, c]) => (
                        <span key={id} style={{ color: c.hex, fontSize: '0.78rem' }} title={c.name}>{c.emoji}</span>
                    ))}
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>· Modificado: {fecha}</span>
                    {r.colaboradores?.length > 0 && (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>· 👥 {r.colaboradores.length} colaborador{r.colaboradores.length !== 1 ? 'es' : ''}</span>
                    )}
                </div>
            </div>

            {/* Game code badge */}
            {r.codigoJuego && (
                <div style={{ background: '#0f172a', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1rem', letterSpacing: 3 }}>{r.codigoJuego}</div>
                    <div style={{ color: '#475569', fontSize: '0.68rem' }}>CÓDIGO JUEGO</div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                    onClick={onEditar}
                    style={{
                        background: '#eff6ff', border: '1px solid #bfdbfe',
                        color: '#1d4ed8', padding: '8px 16px',
                        borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                    }}
                >
                    ✏ Editar
                </button>
                {onEliminar && (
                    <button
                        onClick={onEliminar}
                        style={{
                            background: '#fef2f2', border: '1px solid #fecaca',
                            color: '#ef4444', padding: '8px 12px',
                            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
                        }}
                    >
                        🗑
                    </button>
                )}
            </div>
        </div>
    );
}
