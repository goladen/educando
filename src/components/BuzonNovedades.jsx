import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, collectionGroup, query, where, orderBy, limit, onSnapshot,
    addDoc, doc, setDoc, updateDoc, arrayUnion, getDoc, deleteDoc
} from 'firebase/firestore';
import { Users, Check, X as XIcon, MessageSquare, UserPlus, Settings } from 'lucide-react';
import useNotificacionesProfesor, { INTERESES } from '../hooks/useNotificacionesProfesor';

const ADMIN_EMAIL = 'goladen@gmail.com';

export default function BuzonNovedades({ usuario, onIr }) {
    const [open, setOpen]           = useState(false);
    const [novedades, setNovedades] = useState([]);
    const [leidas, setLeidas]       = useState([]);
    const [redactando, setRedactando] = useState(false);
    const [nueva, setNueva]         = useState({ titulo: '', cuerpo: '', tipo: 'aviso', categorias: [] });
    const [editIntereses, setEditIntereses] = useState(false);
    const [enviando, setEnviando]   = useState(false);
    const [confirmDel, setConfirmDel] = useState(null); // id de novedad a borrar
    const [invitaciones, setInvitaciones] = useState([]);
    const [procInv, setProcInv]     = useState(null);
    const [comunidadesLeidas, setComunidadesLeidas] = useState({});
    const [misComunidades, setMisComunidades] = useState([]);
    const [solicitudesPend, setSolicitudesPend] = useState([]);
    const [procSol, setProcSol]     = useState(null);

    const esAdmin = usuario?.email === ADMIN_EMAIL;

    // Notificaciones agregadas: resultados nuevos, preguntas del trivial y apps nuevas
    const { grupos, total: totalGrupos, marcarVisto, intereses } = useNotificacionesProfesor(usuario);

    const toggleInteres = async (id) => {
        if (!usuario?.uid) return;
        const next = intereses.includes(id) ? intereses.filter(x => x !== id) : [...intereses, id];
        try { await setDoc(doc(db, 'users', usuario.uid), { intereses: next }, { merge: true }); } catch (_) {}
    };

    // Destino de cada grupo dentro del panel del profesor
    const irAGrupo = (g) => {
        marcarVisto(g.clave);
        if (g.clave === 'resultados' && onIr) { onIr('INFORMES'); setOpen(false); }
        if (g.clave === 'preguntas'  && onIr) { onIr('TRIVIAL_RECURSOS'); setOpen(false); }
    };
    const comsConMensajes = misComunidades.filter(c =>
        c.ultimoMensajeAt && c.ultimoMensajePor !== usuario?.uid &&
        c.ultimoMensajeAt > (comunidadesLeidas[c.id] || 0)
    );
    const nombreCom = (id) => misComunidades.find(c => c.id === id)?.nombre || 'tu comunidad';
    const noLeidas = novedades.filter(n => !leidas.includes(n.id)).length
        + invitaciones.length + comsConMensajes.length + solicitudesPend.length + totalGrupos;

    // Comunidades a las que pertenezco (para detectar mensajes nuevos)
    useEffect(() => {
        if (!usuario?.uid) return;
        const q = query(collection(db, 'comunidades'), where('miembros', 'array-contains', usuario.uid));
        return onSnapshot(q, snap => setMisComunidades(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    }, [usuario?.uid]);

    // Solicitudes de acceso pendientes en las comunidades que YO he creado
    const misCreadasKey = misComunidades.filter(c => c.creadorUid === usuario?.uid).map(c => c.id).sort().join(',');
    useEffect(() => {
        if (!usuario?.uid || !misCreadasKey) { setSolicitudesPend([]); return; }
        const ids = misCreadasKey.split(',');
        const mapa = {};
        const unsubs = ids.map(cid => onSnapshot(
            collection(db, 'comunidades', cid, 'solicitudes'),
            snap => {
                mapa[cid] = snap.docs.map(d => ({ id: d.id, ...d.data(), comId: cid }));
                setSolicitudesPend(Object.values(mapa).flat());
            }, () => {}
        ));
        return () => unsubs.forEach(u => u());
    }, [misCreadasKey, usuario?.uid]);

    const aprobarSol = async (s) => {
        setProcSol(s.id);
        try {
            await updateDoc(doc(db, 'comunidades', s.comId), { miembros: arrayUnion(s.uid) });
            await deleteDoc(doc(db, 'comunidades', s.comId, 'solicitudes', s.uid));
        } catch (e) { alert('No se pudo aprobar: ' + e.message); }
        setProcSol(null);
    };
    const denegarSol = async (s) => {
        setProcSol(s.id);
        try { await deleteDoc(doc(db, 'comunidades', s.comId, 'solicitudes', s.uid)); }
        catch (e) { alert('Error: ' + e.message); }
        setProcSol(null);
    };

    // Suscripción a invitaciones de comunidad dirigidas a este usuario
    useEffect(() => {
        if (!usuario?.uid) return;
        const q = query(collectionGroup(db, 'invitaciones'), where('paraUid', '==', usuario.uid));
        return onSnapshot(q,
            snap => setInvitaciones(snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))),
            err => console.error('[Comunidades] Invitaciones (campanita):', err.code, err.message)
        );
    }, [usuario?.uid]);

    const aceptarInv = async (inv) => {
        setProcInv(inv.id);
        try {
            await updateDoc(doc(db, 'comunidades', inv.comunidadId), { miembros: arrayUnion(usuario.uid) });
            await deleteDoc(inv.ref);
        } catch (e) { alert('No se pudo aceptar: ' + e.message); }
        setProcInv(null);
    };
    const rechazarInv = async (inv) => {
        setProcInv(inv.id);
        try { await deleteDoc(inv.ref); } catch (e) { alert('Error: ' + e.message); }
        setProcInv(null);
    };

    // Suscripción en tiempo real a novedades
    useEffect(() => {
        const q = query(collection(db, 'novedades'), orderBy('fecha', 'desc'), limit(40));
        return onSnapshot(q, snap =>
            setNovedades(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
    }, []);

    // Perfil del usuario en tiempo real (novedades leídas + comunidades leídas)
    useEffect(() => {
        if (!usuario?.uid) return;
        return onSnapshot(doc(db, 'users', usuario.uid), snap => {
            setLeidas(snap.data()?.novedadesLeidas || []);
            setComunidadesLeidas(snap.data()?.comunidadesLeidas || {});
        }, () => {});
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
                tipo: nueva.tipo,               // 'aviso' | 'app' | 'actualizacion'
                categorias: nueva.categorias,   // vacío = para todos los intereses
                fecha: new Date(),
                autor: usuario.displayName || usuario.email,
            });
            setNueva({ titulo: '', cuerpo: '', tipo: 'aviso', categorias: [] });
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
                                <button onClick={() => setEditIntereses(v => !v)} title="Mis intereses"
                                    style={{ background: editIntereses ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '6px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Settings size={16} />
                                </button>
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
                                {/* Tipo de novedad */}
                                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                    {[
                                        { id: 'aviso',        label: '📢 Aviso' },
                                        { id: 'app',          label: '🆕 App nueva' },
                                        { id: 'actualizacion', label: '⬆️ Actualización' },
                                    ].map(t => (
                                        <button key={t.id} onClick={() => setNueva(p => ({ ...p, tipo: t.id }))}
                                            style={{ background: nueva.tipo === t.id ? '#e67e22' : 'white', color: nueva.tipo === t.id ? 'white' : '#8a6b3f', border: '1.5px solid #f39c12', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Categorías: a qué intereses afecta (vacío = a todos) */}
                                {nueva.tipo !== 'aviso' && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: '0.74rem', color: '#8a6b3f', marginBottom: 5 }}>
                                            Intereses a los que avisar (ninguno = a todos):
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                            {INTERESES.map(i => {
                                                const on = nueva.categorias.includes(i.id);
                                                return (
                                                    <button key={i.id}
                                                        onClick={() => setNueva(p => ({ ...p, categorias: on ? p.categorias.filter(x => x !== i.id) : [...p.categorias, i.id] }))}
                                                        style={{ background: on ? '#fde4c3' : 'white', border: `1.5px solid ${on ? '#e67e22' : '#eadfce'}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600, color: '#7a5a2e' }}>
                                                        {i.emoji} {i.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={publicar}
                                    disabled={enviando || !nueva.titulo.trim() || !nueva.cuerpo.trim()}
                                    style={{ marginTop: 8, background: enviando ? '#ccc' : '#e67e22', color: 'white', border: 'none', borderRadius: 9, padding: '9px 20px', cursor: enviando ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem' }}
                                >
                                    {enviando ? 'Publicando…' : '📢 Publicar'}
                                </button>
                            </div>
                        )}

                        {/* Mis intereses (para filtrar las apps nuevas) */}
                        {editIntereses && (
                            <div style={{ padding: '12px 20px', background: '#f7f9fc', borderBottom: '1px solid #e9eef5', flexShrink: 0 }}>
                                <div style={{ fontSize: '0.78rem', color: '#546e7a', marginBottom: 7 }}>
                                    Elige tus intereses: solo te avisaremos de apps nuevas de estas áreas.
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {INTERESES.map(i => {
                                        const on = intereses.includes(i.id);
                                        return (
                                            <button key={i.id} onClick={() => toggleInteres(i.id)}
                                                style={{ background: on ? '#1565C0' : 'white', color: on ? 'white' : '#546e7a', border: `1.5px solid ${on ? '#1565C0' : '#d9e2ec'}`, borderRadius: 20, padding: '4px 11px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {i.emoji} {i.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {intereses.length === 0 && (
                                    <div style={{ fontSize: '0.72rem', color: '#90a4ae', marginTop: 7 }}>
                                        Sin intereses marcados recibirás todas las novedades.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lista */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* Resumen agregado: resultados, preguntas del trivial y apps nuevas */}
                            {grupos.map(g => (
                                <div key={g.clave} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f3f3', background: '#f4f8ff' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{g.emoji}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: '#1565C0', fontSize: '0.95rem' }}>{g.titulo}</div>
                                            {g.detalle && (
                                                <p style={{ margin: '3px 0 8px', color: '#555', fontSize: '0.84rem' }}>{g.detalle}</p>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {g.clave !== 'apps' && (
                                                    <button onClick={() => irAGrupo(g)}
                                                        style={{ background: '#1565C0', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                                                        {g.clave === 'resultados' ? 'Ver informes' : 'Revisar preguntas'}
                                                    </button>
                                                )}
                                                <button onClick={() => marcarVisto(g.clave)}
                                                    style={{ background: 'white', color: '#1565C0', border: '1.5px solid #cfe0f5', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                                                    Marcar como visto
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Invitaciones a comunidades */}
                            {invitaciones.map(inv => (
                                <div key={inv.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f3f3', background: '#eef4ff' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                                        <Users size={20} color="#1565C0" style={{ marginTop: 2, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: '#1565C0', fontSize: '0.95rem' }}>Invitación a una comunidad</div>
                                            <p style={{ margin: '4px 0 8px', color: '#555', fontSize: '0.87rem', lineHeight: 1.5 }}>
                                                <strong>{inv.deNombre}</strong> te invita a <strong>{inv.comunidadNombre}</strong>.
                                            </p>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => aceptarInv(inv)} disabled={procInv === inv.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#27ae60', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                                                    <Check size={14} /> Aceptar
                                                </button>
                                                <button onClick={() => rechazarInv(inv)} disabled={procInv === inv.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', color: '#e74c3c', border: '1.5px solid #f3c9c4', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                                                    <XIcon size={14} /> Rechazar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Solicitudes de acceso a mis comunidades */}
                            {solicitudesPend.map(s => (
                                <div key={s.comId + s.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f3f3', background: '#fff5ec' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                                        <UserPlus size={20} color="#e67e22" style={{ marginTop: 2, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: '#c15600', fontSize: '0.95rem' }}>Solicitud de acceso a {nombreCom(s.comId)}</div>
                                            <p style={{ margin: '3px 0 8px', color: '#555', fontSize: '0.87rem' }}>
                                                <strong>{s.nombre}</strong>{s.email ? ` · ${s.email}` : ''}
                                            </p>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => aprobarSol(s)} disabled={procSol === s.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#27ae60', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                                                    <Check size={14} /> Aprobar
                                                </button>
                                                <button onClick={() => denegarSol(s)} disabled={procSol === s.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', color: '#e74c3c', border: '1.5px solid #f3c9c4', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                                                    <XIcon size={14} /> Denegar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Comunidades con mensajes nuevos */}
                            {comsConMensajes.map(c => (
                                <div key={c.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f3f3', background: '#eefaf3' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                                        <MessageSquare size={20} color="#27ae60" style={{ marginTop: 2, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: '#1e8449', fontSize: '0.95rem' }}>Mensajes nuevos en {c.nombre}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#95a5a6', marginTop: 3 }}>Ábrela en Comunidades → {c.nombre} → Mensajes</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {novedades.length === 0 && invitaciones.length === 0 && comsConMensajes.length === 0 && solicitudesPend.length === 0 && grupos.length === 0 ? (
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
