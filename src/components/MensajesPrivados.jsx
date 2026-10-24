import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, orderBy, limit, onSnapshot, getDocs, getDoc,
    addDoc, doc, setDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { Send, ChevronLeft, X, MessageSquare, PenSquare } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes privados (colección `conversaciones`, subcolección `mensajes`):
//  · Directos entre dos profes que comparten comunidad: id = uids ordenados
//    unidos por «_», participantes [a, b].
//  · Buzón del administrador: el profe abre un hilo (problema / cambio /
//    sugerencia) con paraAdmin: true y participantes [profe]; el admin los lee
//    todos por su email (reglas) y responde dentro del hilo.
// Leídos: users/{uid}.conversacionesLeidas { convId: ms } (como comunidadesLeidas).
// Se abre desde la campana (BuzonNovedades) y desde Comunidades → Miembros.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_EMAIL = 'goladen@gmail.com';
export const CATEGORIAS_ADMIN = [
    { id: 'problema',   label: '🐞 Problema',   color: '#e74c3c' },
    { id: 'cambio',     label: '🔧 Cambio',     color: '#e67e22' },
    { id: 'sugerencia', label: '💡 Sugerencia', color: '#27ae60' },
];
const AZUL = '#1565C0';
const categoria = (id) => CATEGORIAS_ADMIN.find(c => c.id === id) || CATEGORIAS_ADMIN[2];
export const idDirecto = (a, b) => [a, b].sort().join('_');
const miNombre = (u) => u?.displayName || 'Profesor/a';
const fmt = (ms) => {
    if (!ms) return '';
    const d = ms.toDate ? ms.toDate() : new Date(ms);
    const hoy = new Date().toDateString() === d.toDateString();
    return hoy ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Conversaciones del usuario (y, si es admin, todas las del buzón) + no leídas
export function useConversaciones(usuario) {
    const [propias, setPropias] = useState([]);
    const [buzon, setBuzon] = useState([]);
    const [leidas, setLeidas] = useState({});
    const uid = usuario?.uid;
    const esAdmin = usuario?.email === ADMIN_EMAIL;

    useEffect(() => {
        if (!uid) return;
        const q = query(collection(db, 'conversaciones'), where('participantes', 'array-contains', uid));
        return onSnapshot(q, s => setPropias(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setPropias([]));
    }, [uid]);
    useEffect(() => {
        if (!uid || !esAdmin) { setBuzon([]); return; }
        const q = query(collection(db, 'conversaciones'), where('paraAdmin', '==', true));
        return onSnapshot(q, s => setBuzon(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setBuzon([]));
    }, [uid, esAdmin]);
    useEffect(() => {
        if (!uid) return;
        return onSnapshot(doc(db, 'users', uid), s => setLeidas(s.data()?.conversacionesLeidas || {}), () => {});
    }, [uid]);

    const conversaciones = useMemo(() => {
        const m = {};
        [...propias, ...buzon].forEach(c => { m[c.id] = c; });
        return Object.values(m).sort((a, b) => (b.ultimoAt || 0) - (a.ultimoAt || 0));
    }, [propias, buzon]);
    const sinLeer = conversaciones.filter(c => c.ultimoAt && c.ultimoPor !== uid && c.ultimoAt > (leidas[c.id] || 0));
    return { conversaciones, sinLeer, leidas };
}

// Título de una conversación visto por `usuario`
function tituloConv(c, usuario, esAdmin) {
    if (c.paraAdmin) {
        const quien = esAdmin ? (c.nombres?.[c.participantes?.[0]] || 'Profesor/a') : 'Administrador de Pikt';
        return { quien, detalle: `${categoria(c.categoria).label} · ${c.asunto || ''}` };
    }
    const otro = (c.participantes || []).find(u => u !== usuario.uid);
    return { quien: c.nombres?.[otro] || 'Profesor/a', detalle: null };
}

/**
 * Modal de mensajes privados.
 * inicial: { convId } abre ese hilo · { con: { uid, nombre } } abre el directo con ese profe ·
 *          { admin: true } abre el formulario para escribir al administrador.
 */
export default function PanelConversaciones({ usuario, onClose, inicial = null }) {
    const esAdmin = usuario?.email === ADMIN_EMAIL;
    const { conversaciones, leidas } = useConversaciones(usuario);
    // vista: 'lista' | 'nuevoAdmin' | 'nuevoDirecto' | { convId } | { con }
    const [vista, setVista] = useState(() => {
        if (inicial?.admin) return 'nuevoAdmin';
        if (inicial?.convId) return { convId: inicial.convId };
        if (inicial?.con) return { con: inicial.con };
        return 'lista';
    });
    const [filtro, setFiltro] = useState('todos'); // admin: todos | buzon | abiertos | directos

    const lista = conversaciones.filter(c => {
        if (filtro === 'buzon') return c.paraAdmin;
        if (filtro === 'abiertos') return c.paraAdmin && c.estado !== 'resuelto';
        if (filtro === 'directos') return !c.paraAdmin;
        return true;
    });

    const chip = (on) => ({ background: on ? AZUL : 'white', color: on ? 'white' : '#546e7a', border: `1.5px solid ${on ? AZUL : '#d9e2ec'}`, borderRadius: 20, padding: '4px 11px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 });

    let cuerpo;
    if (vista === 'nuevoAdmin') {
        cuerpo = <NuevoAdmin usuario={usuario} onCreado={id => setVista({ convId: id })} />;
    } else if (vista === 'nuevoDirecto') {
        cuerpo = <ElegirCompanero usuario={usuario} onElegir={con => setVista({ con })} />;
    } else if (vista !== 'lista') {
        const convId = vista.convId || idDirecto(usuario.uid, vista.con.uid);
        const conv = conversaciones.find(c => c.id === convId);
        cuerpo = <Chat usuario={usuario} esAdmin={esAdmin} convId={convId} conv={conv} con={vista.con} />;
    } else {
        cuerpo = (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #eef1f5', flexShrink: 0 }}>
                    <button onClick={() => setVista('nuevoDirecto')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 5 }}>
                        <PenSquare size={13} /> Escribir a un compañero
                    </button>
                    {!esAdmin && (
                        <button onClick={() => setVista('nuevoAdmin')} style={{ ...chip(false), color: '#c15600', borderColor: '#f5c99a' }}>
                            📮 Escribir al administrador
                        </button>
                    )}
                    {esAdmin && [['todos', 'Todos'], ['abiertos', '📮 Pendientes'], ['buzon', '📮 Buzón'], ['directos', '💬 Directos']].map(([id, l]) => (
                        <button key={id} onClick={() => setFiltro(id)} style={chip(filtro === id)}>{l}</button>
                    ))}
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {lista.length === 0 && (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#b0bec5', fontSize: '0.88rem' }}>
                            <MessageSquare size={28} style={{ marginBottom: 6 }} /><br />
                            No hay conversaciones todavía.
                        </div>
                    )}
                    {lista.map(c => {
                        const { quien, detalle } = tituloConv(c, usuario, esAdmin);
                        const nueva = c.ultimoAt && c.ultimoPor !== usuario.uid && c.ultimoAt > (leidas[c.id] || 0);
                        return (
                            <button key={c.id} onClick={() => setVista({ convId: c.id })}
                                style={{ display: 'flex', width: '100%', textAlign: 'left', gap: 10, alignItems: 'flex-start', padding: '11px 16px', border: 'none', borderBottom: '1px solid #f1f4f8', background: nueva ? '#eef5ff' : 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                                <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>{c.paraAdmin ? '📮' : '💬'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, color: '#2c3e50', fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quien}</span>
                                        {c.paraAdmin && c.estado === 'resuelto' && <span style={{ fontSize: '0.66rem', background: '#e8f6ee', color: '#1e8449', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>✅ Resuelto</span>}
                                        <span style={{ fontSize: '0.7rem', color: '#b0bec5', whiteSpace: 'nowrap' }}>{fmt(c.ultimoAt)}</span>
                                        {nueva && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e67e22', flexShrink: 0 }} />}
                                    </div>
                                    {detalle && <div style={{ fontSize: '0.74rem', color: '#8a6b3f', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detalle}</div>}
                                    <div style={{ fontSize: '0.8rem', color: '#78909c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.ultimoPor === usuario.uid ? 'Tú: ' : ''}{c.ultimoTexto}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()}
                style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 560, height: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.32)' }}>
                <div style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${AZUL}, #1e88e5)`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {vista !== 'lista' && (
                        <button onClick={() => setVista('lista')} title="Volver"
                            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '5px 7px', cursor: 'pointer', display: 'flex' }}>
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    <h3 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.02rem', flex: 1 }}>💬 Mensajes</h3>
                    <button onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: 'white', borderRadius: 9, padding: '5px 7px', cursor: 'pointer', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>
                {cuerpo}
            </div>
        </div>
    );
}

// ── Hilo de mensajes ─────────────────────────────────────────────────────────
function Chat({ usuario, esAdmin, convId, conv, con }) {
    const [mensajes, setMensajes] = useState([]);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const finRef = useRef();
    const existe = !!conv;

    useEffect(() => {
        if (!existe) { setMensajes([]); return; }
        const q = query(collection(db, 'conversaciones', convId, 'mensajes'), orderBy('fecha', 'asc'), limit(300));
        return onSnapshot(q, s => setMensajes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    }, [convId, existe]);

    // Leído al abrir y cada vez que llega algo con el hilo abierto
    useEffect(() => {
        if (!existe) return;
        updateDoc(doc(db, 'users', usuario.uid), { [`conversacionesLeidas.${convId}`]: Date.now() }).catch(() => {});
    }, [convId, existe, mensajes.length, usuario.uid]);
    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes.length]);

    const enviar = async () => {
        const t = texto.trim();
        if (!t) return;
        setEnviando(true);
        try {
            const ref = doc(db, 'conversaciones', convId);
            if (!existe && con) {
                // Primer mensaje de un directo: crear el hilo
                await setDoc(ref, {
                    participantes: [usuario.uid, con.uid].sort(),
                    nombres: { [usuario.uid]: miNombre(usuario), [con.uid]: con.nombre || 'Profesor/a' },
                    paraAdmin: false,
                    creadoAt: Date.now(),
                }, { merge: true });
            }
            await addDoc(collection(db, 'conversaciones', convId, 'mensajes'), {
                autorUid: usuario.uid, autorNombre: esAdmin ? 'Administrador de Pikt' : miNombre(usuario),
                texto: t, fecha: serverTimestamp(),
            });
            await updateDoc(ref, {
                ultimoTexto: t.slice(0, 140), ultimoAt: Date.now(), ultimoPor: usuario.uid,
                // Si el profe vuelve a escribir en un hilo resuelto, se reabre
                ...(conv?.paraAdmin && !esAdmin && conv.estado === 'resuelto' ? { estado: 'abierto' } : {}),
            });
            setTexto('');
        } catch (e) { alert('No se pudo enviar: ' + e.message); }
        setEnviando(false);
    };

    const cambiarEstado = () => updateDoc(doc(db, 'conversaciones', convId), { estado: conv.estado === 'resuelto' ? 'abierto' : 'resuelto' })
        .catch(e => alert('Error: ' + e.message));

    const { quien, detalle } = conv ? tituloConv(conv, usuario, esAdmin) : { quien: con?.nombre || 'Profesor/a', detalle: null };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #eef1f5', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#2c3e50', fontSize: '0.92rem' }}>{quien}</div>
                    {detalle && <div style={{ fontSize: '0.76rem', color: '#8a6b3f', fontWeight: 600 }}>{detalle}</div>}
                </div>
                {esAdmin && conv?.paraAdmin && (
                    <button onClick={cambiarEstado}
                        style={{ background: conv.estado === 'resuelto' ? 'white' : '#27ae60', color: conv.estado === 'resuelto' ? '#27ae60' : 'white', border: '1.5px solid #27ae60', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        {conv.estado === 'resuelto' ? '↩ Reabrir' : '✅ Resuelto'}
                    </button>
                )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#f8f9fb', padding: 12 }}>
                {mensajes.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#b0bec5', padding: 30, fontSize: '0.86rem' }}>Escribe el primer mensaje.</div>
                )}
                {mensajes.map(m => {
                    const mio = m.autorUid === usuario.uid;
                    return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                            <div style={{ maxWidth: '80%', background: mio ? AZUL : 'white', color: mio ? 'white' : '#2c3e50', borderRadius: 12, padding: '7px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                                {!mio && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: AZUL, marginBottom: 2 }}>{m.autorNombre}</div>}
                                <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>
                                <div style={{ fontSize: '0.62rem', opacity: 0.6, textAlign: 'right', marginTop: 2 }}>{fmt(m.fecha)}</div>
                            </div>
                        </div>
                    );
                })}
                <div ref={finRef} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #eef1f5', flexShrink: 0 }}>
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={4000}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                    placeholder="Escribe un mensaje… (Mayús+Intro para salto de línea)"
                    style={{ flex: 1, padding: '8px 11px', borderRadius: 10, border: '1.5px solid #d9e2ec', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'none', outline: 'none' }} />
                <button onClick={enviar} disabled={enviando || !texto.trim()}
                    style={{ background: texto.trim() ? AZUL : '#b0bec5', color: 'white', border: 'none', borderRadius: 10, padding: '0 14px', cursor: texto.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}>
                    <Send size={17} />
                </button>
            </div>
        </div>
    );
}

// ── Nuevo hilo al administrador ──────────────────────────────────────────────
function NuevoAdmin({ usuario, onCreado }) {
    const [cat, setCat] = useState('problema');
    const [asunto, setAsunto] = useState('');
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);

    const enviar = async () => {
        if (!asunto.trim() || !texto.trim()) return;
        setEnviando(true);
        try {
            const ahora = Date.now();
            const ref = await addDoc(collection(db, 'conversaciones'), {
                participantes: [usuario.uid],
                nombres: { [usuario.uid]: miNombre(usuario) },
                email: usuario.email || '',
                paraAdmin: true, categoria: cat, asunto: asunto.trim().slice(0, 120), estado: 'abierto',
                ruta: window.location.pathname,
                creadoAt: ahora, ultimoAt: ahora, ultimoPor: usuario.uid, ultimoTexto: texto.trim().slice(0, 140),
            });
            await addDoc(collection(db, 'conversaciones', ref.id, 'mensajes'), {
                autorUid: usuario.uid, autorNombre: miNombre(usuario), texto: texto.trim(), fecha: serverTimestamp(),
            });
            onCreado(ref.id);
        } catch (e) { alert('No se pudo enviar: ' + e.message); setEnviando(false); }
    };

    const input = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d9e2ec', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
    return (
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#2c3e50', marginBottom: 4 }}>📮 Escribir al administrador</div>
            <div style={{ fontSize: '0.8rem', color: '#78909c', marginBottom: 12 }}>
                Cuéntanos un problema, un cambio que necesitas o una idea para mejorar Pikt. Te responderemos aquí mismo y lo verás en la campana 🔔.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {CATEGORIAS_ADMIN.map(c => (
                    <button key={c.id} onClick={() => setCat(c.id)}
                        style={{ background: cat === c.id ? c.color : 'white', color: cat === c.id ? 'white' : c.color, border: `1.5px solid ${c.color}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                        {c.label}
                    </button>
                ))}
            </div>
            <input value={asunto} onChange={e => setAsunto(e.target.value)} maxLength={120}
                placeholder={cat === 'problema' ? 'Ej.: El Pasapalabra no carga mi recurso' : 'Asunto'} style={{ ...input, marginBottom: 8 }} />
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} maxLength={4000}
                placeholder={cat === 'problema' ? '¿Qué estabas haciendo, en qué juego o pantalla, y qué ha pasado?' : 'Explícalo con el detalle que quieras…'}
                style={{ ...input, resize: 'vertical' }} />
            <button onClick={enviar} disabled={enviando || !asunto.trim() || !texto.trim()}
                style={{ marginTop: 10, background: enviando || !asunto.trim() || !texto.trim() ? '#b0bec5' : AZUL, color: 'white', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={15} /> {enviando ? 'Enviando…' : 'Enviar'}
            </button>
        </div>
    );
}

// ── Elegir un compañero de mis comunidades ───────────────────────────────────
function ElegirCompanero({ usuario, onElegir }) {
    const [gente, setGente] = useState(null); // [{ uid, nombre, comunidades: [] }]
    const [texto, setTexto] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'comunidades'), where('miembros', 'array-contains', usuario.uid)));
                const mapa = {};
                snap.docs.forEach(d => {
                    const c = d.data();
                    (c.miembros || []).filter(u => u !== usuario.uid).forEach(u => {
                        (mapa[u] = mapa[u] || { uid: u, comunidades: [] }).comunidades.push(c.nombre);
                    });
                });
                const lista = Object.values(mapa);
                await Promise.all(lista.map(async p => {
                    try { const s = await getDoc(doc(db, 'users', p.uid)); const u = s.data() || {}; p.nombre = u.displayName || u.nombre || 'Profesor/a'; }
                    catch (_) { p.nombre = 'Profesor/a'; }
                }));
                setGente(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
            } catch (_) { setGente([]); }
        })();
    }, [usuario.uid]);

    const t = texto.trim().toLowerCase();
    const filtrados = (gente || []).filter(p => !t || p.nombre.toLowerCase().includes(t));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef1f5', flexShrink: 0 }}>
                <div style={{ fontSize: '0.8rem', color: '#78909c', marginBottom: 8 }}>Puedes escribir a los profes de tus comunidades.</div>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar por nombre…"
                    style={{ width: '100%', padding: '8px 11px', borderRadius: 9, border: '1.5px solid #d9e2ec', fontSize: '0.86rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {!gente && <div style={{ padding: 20, textAlign: 'center', color: '#b0bec5', fontSize: '0.86rem' }}>Cargando…</div>}
                {gente && !filtrados.length && (
                    <div style={{ padding: 20, textAlign: 'center', color: '#b0bec5', fontSize: '0.86rem' }}>
                        {gente.length ? 'Nadie con ese nombre.' : 'Aún no compartes ninguna comunidad con otros profes.'}
                    </div>
                )}
                {filtrados.map(p => (
                    <button key={p.uid} onClick={() => onElegir({ uid: p.uid, nombre: p.nombre })}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', borderBottom: '1px solid #f1f4f8', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.88rem' }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.72rem', color: '#90a4ae' }}>{p.comunidades.join(' · ')}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
