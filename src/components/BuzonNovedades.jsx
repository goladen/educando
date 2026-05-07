import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, query, orderBy, limit, onSnapshot,
    addDoc, doc, updateDoc, arrayUnion, getDoc, deleteDoc
} from 'firebase/firestore';

const ADMIN_EMAIL = 'goladen@gmail.com';

export default function BuzonNovedades({ usuario }) {
    const [open, setOpen]           = useState(false);
    const [novedades, setNovedades] = useState([]);
    const [leidas, setLeidas]       = useState([]);
    const [redactando, setRedactando] = useState(false);
    const [nueva, setNueva]         = useState({ titulo: '', cuerpo: '' });
    const [enviando, setEnviando]   = useState(false);
    const [confirmDel, setConfirmDel] = useState(null); // id de novedad a borrar

    const esAdmin = usuario?.email === ADMIN_EMAIL;
    const noLeidas = novedades.filter(n => !leidas.includes(n.id)).length;

    // Suscripción en tiempo real a novedades
    useEffect(() => {
        const q = query(collection(db, 'novedades'), orderBy('fecha', 'desc'), limit(40));
        return onSnapshot(q, snap =>
            setNovedades(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
    }, []);

    // Cargar IDs leídas del perfil del usuario
    useEffect(() => {
        if (!usuario?.uid) return;
        getDoc(doc(db, 'users', usuario.uid)).then(snap => {
            setLeidas(snap.data()?.novedadesLeidas || []);
        });
    }, [usuario?.uid]);

    const marcarLeidas = async () => {
        if (!usuario?.uid || novedades.length === 0) return;
        const ids = novedades.map(n => n.id);
        setLeidas(ids);
        try {
            await updateDoc(doc(db, 'users', usuario.uid), {
                novedadesLeidas: arrayUnion(...ids)
            });
        } catch (_) {}
    };

    const abrir = () => {
        setOpen(true);
        marcarLeidas();
    };

    const publicar = async () => {
        if (!nueva.titulo.trim() || !nueva.cuerpo.trim()) return;
        setEnviando(true);
        try {
            await addDoc(collection(db, 'novedades'), {
                titulo: nueva.titulo.trim(),
                cuerpo: nueva.cuerpo.trim(),
                fecha: new Date(),
                autor: usuario.displayName || usuario.email,
            });
            setNueva({ titulo: '', cuerpo: '' });
            setRedactando(false);
        } catch (e) { alert('Error al publicar: ' + e.message); }
        setEnviando(false);
    };

    const borrar = async (id) => {
        try { await deleteDoc(doc(db, 'novedades', id)); } catch (_) {}
        setConfirmDel(null);
    };

    const fmtFecha = (ts) => {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <>
            {/* ── Campana ── */}
            <button
                onClick={abrir}
                title="Novedades"
                style={{ position: 'relative', background: 'white', color: '#e67e22', border: 'none', padding: '8px 13px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontSize: '1.15rem' }}
            >
                🔔
                {noLeidas > 0 && (
                    <span style={{ position: 'absolute', top: -5, right: -5, background: '#e74c3c', color: 'white', borderRadius: '50%', minWidth: 18, height: 18, fontSize: '0.68rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                        {noLeidas > 9 ? '9+' : noLeidas}
                    </span>
                )}
            </button>

            {/* ── Modal ── */}
            {open && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.32)', overflow: 'hidden' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cabecera */}
                        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#e67e22,#f39c12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🔔 Novedades
                                {novedades.length > 0 && (
                                    <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {novedades.length}
                                    </span>
                                )}
                            </h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {esAdmin && (
                                    <button onClick={() => setRedactando(p => !p)} style={{ background: redactando ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                                        {redactando ? '✕ Cancelar' : '+ Nueva'}
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>✕</button>
                            </div>
                        </div>

                        {/* Formulario admin */}
                        {esAdmin && redactando && (
                            <div style={{ padding: '14px 20px 10px', borderBottom: '2px dashed #f39c12', background: '#fffbf2', flexShrink: 0 }}>
                                <input
                                    value={nueva.titulo}
                                    onChange={e => setNueva(p => ({ ...p, titulo: e.target.value }))}
                                    placeholder="Título de la novedad..."
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #f39c12', marginBottom: 8, fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
                                />
                                <textarea
                                    value={nueva.cuerpo}
                                    onChange={e => setNueva(p => ({ ...p, cuerpo: e.target.value }))}
                                    placeholder="Descripción del mensaje para los profesores..."
                                    rows={4}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #f39c12', fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                                />
                                <button
                                    onClick={publicar}
                                    disabled={enviando || !nueva.titulo.trim() || !nueva.cuerpo.trim()}
                                    style={{ marginTop: 8, background: enviando ? '#ccc' : '#e67e22', color: 'white', border: 'none', borderRadius: 9, padding: '9px 20px', cursor: enviando ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem' }}
                                >
                                    {enviando ? 'Publicando…' : '📢 Publicar'}
                                </button>
                            </div>
                        )}

                        {/* Lista */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {novedades.length === 0 ? (
                                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#bbb' }}>
                                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔔</div>
                                    <div style={{ fontSize: '0.92rem' }}>No hay novedades todavía.</div>
                                </div>
                            ) : (
                                novedades.map(n => {
                                    const esNueva = !leidas.includes(n.id);
                                    return (
                                        <div key={n.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f3f3', background: esNueva ? '#fff9f2' : 'white', position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                                                {esNueva && (
                                                    <span style={{ marginTop: 6, width: 8, height: 8, borderRadius: '50%', background: '#e67e22', flexShrink: 0, display: 'inline-block' }} />
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 800, color: '#2c3e50', fontSize: '0.95rem' }}>{n.titulo}</span>
                                                        <span style={{ color: '#bbb', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{fmtFecha(n.fecha)}</span>
                                                    </div>
                                                    <p style={{ margin: 0, color: '#555', fontSize: '0.87rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{n.cuerpo}</p>
                                                </div>
                                            </div>

                                            {/* Borrar (solo admin) */}
                                            {esAdmin && (
                                                confirmDel === n.id ? (
                                                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.78rem', color: '#e74c3c' }}>¿Borrar?</span>
                                                        <button onClick={() => borrar(n.id)} style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Sí</button>
                                                        <button onClick={() => setConfirmDel(null)} style={{ background: '#eee', color: '#555', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem' }}>No</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setConfirmDel(n.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>🗑 Borrar</button>
                                                )
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
