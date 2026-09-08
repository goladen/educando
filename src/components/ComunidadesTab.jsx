import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { descargarPNG, descargarPDF, compartirClassroom } from '../utils/exportar';
import {
    collection, query, where, getDocs, getDoc, setDoc,
    doc, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove,
    serverTimestamp, onSnapshot, orderBy, limit
} from 'firebase/firestore';
import {
    Users, Plus, Search, X, LogIn, LogOut, Share2, Copy, Trash2,
    Eye, RefreshCw, CheckCircle, ChevronLeft, Lock, Globe, UserCircle,
    Mail, Send, MessageSquare, UserPlus, Clock, Check, ExternalLink,
    FileText, LayoutGrid, ShieldCheck, ChevronRight, GraduationCap, ClipboardList, Calendar,
    MoreVertical, Pencil, Image as ImageIcon, Download
} from 'lucide-react';
import { EditorAula } from './MapaAula';

// ─── Helpers ────────────────────────────────────────────────────────────────
const norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const AZUL = '#1565C0';
const nuevoId = () => Math.random().toString(36).slice(2, 9);
const fmtFecha = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Borra una comunidad y TODAS sus subcolecciones (Firestore no lo hace en cascada).
// El doc padre se borra el último para que las reglas (que hacen get(padre)) sigan válidas.
async function eliminarComunidadCompleta(comId) {
    // Cursos: borrar su subdoc privado y luego el curso
    const cursosSnap = await getDocs(collection(db, 'comunidades', comId, 'cursos'));
    for (const c of cursosSnap.docs) {
        const priv = await getDocs(collection(db, 'comunidades', comId, 'cursos', c.id, 'privado'));
        await Promise.all(priv.docs.map(d => deleteDoc(d.ref)));
        await deleteDoc(c.ref);
    }
    const subs = ['grupos_compartidos', 'mensajes', 'invitaciones', 'solicitudes', 'eventos'];
    for (const sub of subs) {
        const snap = await getDocs(collection(db, 'comunidades', comId, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, 'comunidades', comId));
}

// ─── Barra de exportación (imagen / PDF / Classroom) ──────────────────────────
function ExportBar({ targetRef, nombre, classroomUrl, compact, pdfLandscape }) {
    const [busy, setBusy] = useState(false);
    const run = async (fn) => { setBusy(true); try { await fn(targetRef.current, nombre); } catch (e) { alert('No se pudo exportar: ' + e.message); } setBusy(false); };
    return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => run(descargarPNG)} disabled={busy} style={st.miniBtn} title="Descargar imagen (PNG)"><ImageIcon size={13} />{compact ? '' : ' Imagen'}</button>
            <button onClick={() => run((el, n) => descargarPDF(el, n, pdfLandscape ? { orientacion: 'l' } : undefined))} disabled={busy} style={st.miniBtn} title="Descargar PDF"><Download size={13} />{compact ? '' : ' PDF'}</button>
            {classroomUrl && <button onClick={() => compartirClassroom(classroomUrl, nombre)} style={st.miniBtn} title="Compartir en Google Classroom"><GraduationCap size={13} />{compact ? '' : ' Classroom'}</button>}
        </div>
    );
}

// ─── Modal: crear comunidad ───────────────────────────────────────────────────
function ModalCrearComunidad({ usuario, onClose, onCreada }) {
    const [nombre, setNombre]           = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [imagenUrl, setImagenUrl]     = useState('');
    const [webUrl, setWebUrl]           = useState('');
    const [guardando, setGuardando]     = useState(false);
    const [error, setError]             = useState('');

    const crear = async () => {
        const n = nombre.trim();
        if (!n) { setError('Ponle un nombre a la comunidad.'); return; }
        setGuardando(true); setError('');
        try {
            const ref = await addDoc(collection(db, 'comunidades'), {
                nombre: n,
                descripcion: descripcion.trim(),
                imagenUrl: imagenUrl.trim(),
                webUrl: webUrl.trim(),
                creadorUid: usuario.uid,
                creadorNombre: usuario.displayName || 'Profesor/a',   // nunca el correo
                miembros: [usuario.uid],
                fechaCreacion: serverTimestamp(),
            });
            onCreada({ id: ref.id });
        } catch (e) {
            setError('No se pudo crear: ' + e.message);
            setGuardando(false);
        }
    };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={{ ...st.panel, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div style={st.header}>
                    <div style={st.hTitle}><Users size={20} color={AZUL} /> Nueva comunidad</div>
                    <button onClick={onClose} style={st.closeBtn}><X size={18} /></button>
                </div>
                <div style={st.label}>Nombre</div>
                <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Profes de Matemáticas 3º ESO" style={st.input} />
                <div style={st.label}>Descripción (opcional)</div>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                    placeholder="¿De qué va esta comunidad? ¿Quién puede unirse?"
                    rows={3} style={{ ...st.input, resize: 'vertical' }} />
                <div style={st.label}>Imagen (URL, opcional)</div>
                <input value={imagenUrl} onChange={e => setImagenUrl(e.target.value)}
                    placeholder="https://…/logo.png" style={st.input} />
                {imagenUrl.trim() && (
                    <img src={imagenUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />
                )}
                <div style={st.label}>Dirección web (opcional)</div>
                <input value={webUrl} onChange={e => setWebUrl(e.target.value)}
                    placeholder="https://…" style={st.input} />
                <div style={st.aviso}>
                    <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    Cualquier profesor verá el nombre y el escaparate. Para entrar deberá <strong>pedir acceso</strong> (tú lo apruebas) o aceptar tu <strong>invitación</strong>.
                </div>
                {error && <div style={st.error}>{error}</div>}
                <div style={st.btnRow}>
                    <button onClick={onClose} style={st.btnSec}>Cancelar</button>
                    <button onClick={crear} disabled={guardando} style={st.btnPrimary}>
                        {guardando ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creando…</> : <><Plus size={14} /> Crear</>}
                    </button>
                </div>
                <style>{spin}</style>
            </div>
        </div>
    );
}

// ─── Modal: compartir un grupo (SOLO NOMBRES, sin notas) ──────────────────────
function ModalCompartirGrupo({ usuario, comunidad, onClose, onCompartido }) {
    const [grupos, setGrupos]     = useState([]);
    const [cargando, setCargando] = useState(true);
    const [compartiendo, setCompartiendo] = useState(null);
    const [error, setError]       = useState('');

    useEffect(() => {
        getDocs(query(collection(db, 'grupos_profesor'), where('profesorUid', '==', usuario.uid)))
            .then(snap => setGrupos(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(e => setError(e.message))
            .finally(() => setCargando(false));
    }, [usuario.uid]);

    const compartir = async (g) => {
        setCompartiendo(g.id); setError('');
        try {
            // Solo se comparten los NOMBRES de los alumnos (y su subgrupo). Nunca notas.
            const alumnos = (g.alumnos || []).map(a => ({ id: a.id, nombre: a.nombre, grupo: a.grupo || '' }));
            await addDoc(collection(db, 'comunidades', comunidad.id, 'grupos_compartidos'), {
                nombre: g.nombre || 'Grupo',
                alumnos,
                grupoOrigenId: g.id,
                compartidoPor: usuario.uid,
                compartidoPorNombre: usuario.displayName || usuario.email || 'Profesor/a',
                fechaCompartido: serverTimestamp(),
            });
            onCompartido();
        } catch (e) {
            setError('No se pudo compartir: ' + e.message);
            setCompartiendo(null);
        }
    };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={{ ...st.panel, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={st.header}>
                    <div style={st.hTitle}><Share2 size={19} color={AZUL} /> Compartir un grupo</div>
                    <button onClick={onClose} style={st.closeBtn}><X size={18} /></button>
                </div>
                <div style={st.aviso}>
                    <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    Se comparte solo la <strong>lista de nombres</strong> de los alumnos. Las notas y calificaciones <strong>nunca</strong> se comparten.
                </div>
                {cargando ? (
                    <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
                ) : grupos.length === 0 ? (
                    <div style={st.vacio}>No tienes grupos. Créalos en Informes → Grupos.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                        {grupos.map(g => (
                            <button key={g.id} onClick={() => compartir(g)} disabled={compartiendo} style={st.grupoBtn}>
                                <Users size={15} color={AZUL} />
                                <span style={{ flex: 1, textAlign: 'left' }}>
                                    <strong>{g.nombre}</strong>
                                    <span style={{ marginLeft: 8, color: '#95a5a6', fontSize: '0.8rem' }}>{g.alumnos?.length || 0} alumnos</span>
                                </span>
                                {compartiendo === g.id
                                    ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                    : <Share2 size={15} color="#bdc3c7" />}
                            </button>
                        ))}
                    </div>
                )}
                {error && <div style={{ ...st.error, marginTop: 12 }}>{error}</div>}
                <style>{spin}</style>
            </div>
        </div>
    );
}

// ─── Modal: ver un grupo compartido (solo nombres) ────────────────────────────
function ModalVerGrupo({ compartido, onClose }) {
    const alumnos = compartido.alumnos || [];
    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={{ ...st.panel, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <div style={st.header}>
                    <div>
                        <div style={st.hTitle}>👥 {compartido.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: '#95a5a6', marginTop: 2 }}>
                            Compartido por {compartido.compartidoPorNombre} · {alumnos.length} alumnos
                        </div>
                    </div>
                    <button onClick={onClose} style={st.closeBtn}><X size={18} /></button>
                </div>
                <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #e0e4f0', borderRadius: 10 }}>
                    {alumnos.map((a, i) => (
                        <div key={a.id || i} style={{ padding: '8px 12px', borderBottom: '1px solid #f3f3f3', background: i % 2 ? '#fafafa' : 'white', display: 'flex', gap: 8 }}>
                            <span style={{ color: '#bdc3c7', fontSize: '0.8rem', width: 20 }}>{i + 1}</span>
                            <span style={{ color: '#2c3e50' }}>{a.nombre}</span>
                            {a.grupo && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#95a5a6' }}>{a.grupo}</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Lista de nombres de miembros (sin correos) ───────────────────────────────
function ListaNombresMiembros({ comunidad }) {
    const [nombres, setNombres] = useState(null);
    useEffect(() => {
        (async () => {
            const res = [];
            await Promise.all((comunidad.miembros || []).map(async u => {
                try {
                    const s = await getDoc(doc(db, 'users', u));
                    res.push({ uid: u, nombre: (s.exists() && (s.data().displayName || s.data().nombre)) || 'Profesor/a', esCreador: u === comunidad.creadorUid });
                } catch (_) { res.push({ uid: u, nombre: 'Profesor/a', esCreador: u === comunidad.creadorUid }); }
            }));
            res.sort((a, b) => (b.esCreador ? 1 : 0) - (a.esCreador ? 1 : 0));
            setNombres(res);
        })();
    }, [comunidad.miembros, comunidad.creadorUid]);

    return (
        <div style={{ marginBottom: 20 }}>
            <h3 style={st.h3}><Users size={16} /> Miembros ({comunidad.miembros?.length || 0})</h3>
            {nombres === null ? <div style={st.vacioMini}>Cargando…</div> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {nombres.map(m => (
                        <span key={m.uid} style={{ ...st.chipLink, background: '#f1f3f7', color: '#2c3e50', cursor: 'default' }}>
                            <UserCircle size={13} /> {m.nombre}{m.esCreador && <ShieldCheck size={12} color="#27ae60" />}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Escaparate público: recursos y páginas de los profes miembros ────────────
export function EscaparateMiembros({ comunidad, soloSeccion = null }) {
    const [recursos, setRecursos] = useState([]);
    const [paginas, setPaginas]   = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const uids = (comunidad.miembros || []).slice(0, 30);
        if (uids.length === 0) { setCargando(false); return; }
        (async () => {
            try {
                // Recursos públicos de los miembros (in admite hasta 30 valores)
                const recs = [];
                for (let i = 0; i < uids.length; i += 10) {
                    const trozo = uids.slice(i, i + 10);
                    const snap = await getDocs(query(collection(db, 'resources'), where('profesorUid', 'in', trozo)));
                    snap.forEach(d => { const r = { id: d.id, ...d.data() }; if (!r.isPrivate) recs.push(r); });
                }
                setRecursos(recs.slice(0, 60));
                // Páginas de profesor publicadas (doc id = uid)
                const pags = [];
                await Promise.all(uids.map(async u => {
                    const s = await getDoc(doc(db, 'paginas_profesores', u));
                    if (s.exists() && s.data().publicada) pags.push({ uid: u, ...s.data() });
                }));
                setPaginas(pags);
            } catch (e) { console.error(e); }
            setCargando(false);
        })();
    }, [comunidad.miembros]);

    if (cargando) return <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>;

    const verPaginas  = soloSeccion !== 'recursos';
    const verRecursos = soloSeccion !== 'paginas';

    return (
        <div>
            {verPaginas && <>
                <h3 style={st.h3}><FileText size={16} /> Páginas de los profesores ({paginas.length})</h3>
                {paginas.length === 0 ? <div style={st.vacioMini}>Ningún miembro tiene página publicada.</div> : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                        {paginas.map(p => (
                            <a key={p.uid} href={`/${p.slug}`} target="_blank" rel="noreferrer" style={st.chipLink}>
                                <Globe size={13} /> {p.titulo || p.slug} <ExternalLink size={11} />
                            </a>
                        ))}
                    </div>
                )}
            </>}
            {verRecursos && <>
                <h3 style={st.h3}><LayoutGrid size={16} /> Recursos públicos ({recursos.length})</h3>
                {recursos.length === 0 ? <div style={st.vacioMini}>Los miembros no tienen recursos públicos.</div> : (
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                        {recursos.map(r => (
                            <a key={r.id} href={`/?r=${r.id}`} target="_blank" rel="noreferrer" style={st.recCard}>
                                <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.86rem' }}>{r.titulo || 'Recurso'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#95a5a6', marginTop: 3 }}>{r.tipoJuego}</div>
                            </a>
                        ))}
                    </div>
                )}
            </>}
        </div>
    );
}

// ─── Vista pública de una comunidad (no soy miembro) ──────────────────────────
function VistaPublicaComunidad({ usuario, comunidad, onBack, onCambio }) {
    const [solicitada, setSolicitada] = useState(false);
    const [invitado, setInvitado]     = useState(false);
    const [cargando, setCargando]     = useState(true);
    const [proc, setProc]             = useState(false);
    const [error, setError]           = useState('');

    useEffect(() => {
        (async () => {
            try {
                const sol = await getDoc(doc(db, 'comunidades', comunidad.id, 'solicitudes', usuario.uid));
                setSolicitada(sol.exists());
                const inv = await getDoc(doc(db, 'comunidades', comunidad.id, 'invitaciones', usuario.uid));
                setInvitado(inv.exists());
            } catch (_) {}
            setCargando(false);
        })();
    }, [comunidad.id, usuario.uid]);

    const pedirAcceso = async () => {
        setProc(true); setError('');
        try {
            await setDoc(doc(db, 'comunidades', comunidad.id, 'solicitudes', usuario.uid), {
                uid: usuario.uid,
                nombre: usuario.displayName || usuario.email || 'Profesor/a',
                email: usuario.email || '',
                fecha: serverTimestamp(),
            });
            setSolicitada(true);
        } catch (e) { setError('No se pudo enviar: ' + e.message); }
        setProc(false);
    };

    const aceptarInvitacion = async () => {
        setProc(true); setError('');
        try {
            await updateDoc(doc(db, 'comunidades', comunidad.id), { miembros: arrayUnion(usuario.uid) });
            await deleteDoc(doc(db, 'comunidades', comunidad.id, 'invitaciones', usuario.uid));
            onCambio();
        } catch (e) { setError('No se pudo aceptar: ' + e.message); }
        setProc(false);
    };

    return (
        <div>
            <button onClick={onBack} style={st.backBtn}><ChevronLeft size={16} /> Comunidades</button>
            <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
                {comunidad.imagenUrl && (
                    <img src={comunidad.imagenUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                )}
                <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={22} color={AZUL} />
                        <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#2c3e50' }}>{comunidad.nombre}</h2>
                    </div>
                    {comunidad.descripcion && <p style={{ margin: '6px 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>{comunidad.descripcion}</p>}
                    <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#95a5a6', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span><UserCircle size={13} style={{ verticalAlign: -2 }} /> {comunidad.creadorNombre}</span>
                        <span>{comunidad.miembros?.length || 1} miembros</span>
                        {comunidad.webUrl && <a href={comunidad.webUrl} target="_blank" rel="noreferrer" style={{ color: AZUL, display: 'flex', alignItems: 'center', gap: 3 }}><ExternalLink size={12} /> Web</a>}
                    </div>
                    <div style={{ marginTop: 14 }}>
                        {cargando ? <span style={{ color: '#95a5a6', fontSize: '0.85rem' }}>…</span>
                            : invitado ? (
                                <button onClick={aceptarInvitacion} disabled={proc} style={{ ...st.btnPrimary, background: '#27ae60' }}>
                                    <Check size={15} /> Tienes invitación — Aceptar y entrar
                                </button>
                            ) : solicitada ? (
                                <span style={st.chipPend}><Clock size={14} /> Solicitud enviada — pendiente de aprobación</span>
                            ) : (
                                <button onClick={pedirAcceso} disabled={proc} style={st.btnPrimary}>
                                    {proc ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <><LogIn size={15} /> Pedir acceso</>}
                                </button>
                            )}
                    </div>
                    {error && <div style={{ ...st.error, marginTop: 10 }}>{error}</div>}
                </div>
            </div>

            <div style={st.aviso}>
                <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Los grupos de alumnos y los mensajes solo son visibles para los miembros. Abajo puedes ver los miembros y los recursos y páginas públicos de sus profesores.
            </div>

            <h3 style={st.h3}><Calendar size={16} /> Calendario de la comunidad</h3>
            <div style={{ background: 'white', borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
                <Calendario usuario={usuario} comunidad={comunidad} puedeEditar={false} />
            </div>

            <ListaNombresMiembros comunidad={comunidad} />
            <EscaparateMiembros comunidad={comunidad} />
            <style>{spin}</style>
        </div>
    );
}

// ─── Panel: mensajes entre miembros ───────────────────────────────────────────
function PanelMensajes({ usuario, comunidad }) {
    const [mensajes, setMensajes] = useState([]);
    const [texto, setTexto]       = useState('');
    const [enviando, setEnviando] = useState(false);
    const finRef = useRef();

    // Marca esta comunidad como "leída" para el aviso de la campanita
    const marcarLeido = () => {
        updateDoc(doc(db, 'users', usuario.uid), { [`comunidadesLeidas.${comunidad.id}`]: Date.now() }).catch(() => {});
    };

    useEffect(() => {
        const q = query(collection(db, 'comunidades', comunidad.id, 'mensajes'), orderBy('fecha', 'asc'), limit(200));
        return onSnapshot(q, snap => setMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [comunidad.id]);

    // Al ver la pestaña y cada vez que llegan mensajes estando abierta → leído
    useEffect(() => { marcarLeido(); }, [comunidad.id, mensajes.length]);

    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes.length]);

    const enviar = async () => {
        const t = texto.trim();
        if (!t) return;
        setEnviando(true);
        try {
            await addDoc(collection(db, 'comunidades', comunidad.id, 'mensajes'), {
                autorUid: usuario.uid,
                autorNombre: usuario.displayName || usuario.email || 'Profesor/a',
                texto: t,
                fecha: serverTimestamp(),
            });
            // Resumen para el aviso de la campanita (sin texto: el doc es público)
            updateDoc(doc(db, 'comunidades', comunidad.id), {
                ultimoMensajeAt: Date.now(),
                ultimoMensajePor: usuario.uid,
            }).catch(() => {});
            setTexto('');
        } catch (e) { alert('No se pudo enviar: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div>
            <div style={{ maxHeight: 380, overflowY: 'auto', background: '#f8f9fb', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                {mensajes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#bdc3c7', padding: 30, fontSize: '0.88rem' }}>
                        <MessageSquare size={26} style={{ marginBottom: 6 }} /><br />No hay mensajes. ¡Escribe el primero!
                    </div>
                ) : mensajes.map(m => {
                    const mio = m.autorUid === usuario.uid;
                    return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                            <div style={{ maxWidth: '78%', background: mio ? AZUL : 'white', color: mio ? 'white' : '#2c3e50', borderRadius: 12, padding: '7px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                                {!mio && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: AZUL, marginBottom: 2 }}>{m.autorNombre}</div>}
                                <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.texto}</div>
                                <div style={{ fontSize: '0.62rem', opacity: 0.6, textAlign: 'right', marginTop: 2 }}>{fmtFecha(m.fecha)}</div>
                            </div>
                        </div>
                    );
                })}
                <div ref={finRef} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                    placeholder="Escribe un mensaje…" style={{ ...st.input, marginBottom: 0, flex: 1 }} />
                <button onClick={enviar} disabled={enviando || !texto.trim()} style={st.btnPrimary}><Send size={16} /></button>
            </div>
        </div>
    );
}

// ─── Panel: miembros, correos, invitar, solicitudes ───────────────────────────
function PanelMiembros({ usuario, comunidad, onCambio }) {
    const esCreador = comunidad.creadorUid === usuario.uid;
    const [info, setInfo]           = useState({});   // uid → { nombre, email }
    const [solicitudes, setSolicitudes] = useState([]);
    const [email, setEmail]         = useState('');
    const [invMsg, setInvMsg]       = useState('');
    const [invitando, setInvitando] = useState(false);
    const [proc, setProc]           = useState(null);
    const [linkCopiado, setLinkCopiado] = useState(false);

    const enlaceInvitacion = `${window.location.origin}/comunidad/${comunidad.id}/unirse`;
    const copiarEnlace = async () => {
        try { await navigator.clipboard.writeText(enlaceInvitacion); }
        catch { window.prompt('Copia el enlace:', enlaceInvitacion); }
        setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2500);
    };

    // Cargar datos (nombre/email) de cada miembro desde 'users'
    useEffect(() => {
        (async () => {
            const res = {};
            await Promise.all((comunidad.miembros || []).map(async u => {
                try { const s = await getDoc(doc(db, 'users', u)); if (s.exists()) res[u] = s.data(); } catch (_) {}
            }));
            setInfo(res);
        })();
    }, [comunidad.miembros]);

    // Solicitudes de acceso (solo el creador puede leerlas por reglas)
    useEffect(() => {
        if (!esCreador) return;
        const ref = collection(db, 'comunidades', comunidad.id, 'solicitudes');
        return onSnapshot(ref, snap => setSolicitudes(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => {});
    }, [comunidad.id, esCreador]);

    const aprobar = async (s) => {
        setProc(s.id);
        try {
            await updateDoc(doc(db, 'comunidades', comunidad.id), { miembros: arrayUnion(s.uid) });
            await deleteDoc(doc(db, 'comunidades', comunidad.id, 'solicitudes', s.uid));
            onCambio();
        } catch (e) { alert('Error: ' + e.message); }
        setProc(null);
    };
    const denegar = async (s) => {
        setProc(s.id);
        try { await deleteDoc(doc(db, 'comunidades', comunidad.id, 'solicitudes', s.uid)); } catch (e) { alert('Error: ' + e.message); }
        setProc(null);
    };
    const expulsar = async (uid) => {
        setProc(uid);
        try { await updateDoc(doc(db, 'comunidades', comunidad.id), { miembros: arrayRemove(uid) }); onCambio(); }
        catch (e) { alert('Error: ' + e.message); }
        setProc(null);
    };

    const invitar = async () => {
        const e = email.trim().toLowerCase();
        setInvMsg('');
        if (!e) return;
        setInvitando(true);
        try {
            // Buscar al usuario de pikt.es por correo
            let snap = await getDocs(query(collection(db, 'users'), where('email', '==', e)));
            if (snap.empty) snap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
            if (snap.empty) { setInvMsg('❌ No hay ningún usuario de pikt.es con ese correo.'); setInvitando(false); return; }
            const u = snap.docs[0];
            if ((comunidad.miembros || []).includes(u.id)) { setInvMsg('Ese usuario ya es miembro.'); setInvitando(false); return; }
            await setDoc(doc(db, 'comunidades', comunidad.id, 'invitaciones', u.id), {
                paraUid: u.id,
                paraEmail: e,
                comunidadId: comunidad.id,
                comunidadNombre: comunidad.nombre,
                deNombre: usuario.displayName || 'Profesor/a',   // nunca el correo
                fecha: serverTimestamp(),
            });
            setInvMsg('✅ Invitación enviada. La verá en su campanita 🔔.');
            setEmail('');
        } catch (err) { setInvMsg('Error: ' + err.message); }
        setInvitando(false);
    };

    return (
        <div>
            {esCreador && (
                <>
                    {solicitudes.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                            <h3 style={st.h3}><Clock size={16} /> Solicitudes de acceso ({solicitudes.length})</h3>
                            {solicitudes.map(s => (
                                <div key={s.id} style={st.filaMiembro}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#2c3e50' }}>{s.nombre}</div>
                                        <div style={{ fontSize: '0.76rem', color: '#95a5a6' }}>{s.email}</div>
                                    </div>
                                    <button onClick={() => aprobar(s)} disabled={proc === s.id} style={{ ...st.miniBtn, color: '#27ae60', borderColor: '#b6e2c1' }}><Check size={13} /> Aprobar</button>
                                    <button onClick={() => denegar(s)} disabled={proc === s.id} style={{ ...st.miniBtn, color: '#e74c3c', borderColor: '#f3c9c4' }}><X size={13} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ marginBottom: 18 }}>
                        <h3 style={st.h3}><UserPlus size={16} /> Invitar por correo</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                                onKeyDown={e => e.key === 'Enter' && invitar()}
                                placeholder="correo@ejemplo.com" style={{ ...st.input, marginBottom: 0, flex: 1 }} />
                            <button onClick={invitar} disabled={invitando || !email.trim()} style={st.btnPrimary}>
                                {invitando ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <><Mail size={15} /> Invitar</>}
                            </button>
                        </div>
                        {invMsg && <div style={{ fontSize: '0.8rem', color: invMsg.startsWith('❌') || invMsg.startsWith('Error') ? '#e74c3c' : '#27ae60', marginTop: 6 }}>{invMsg}</div>}
                    </div>
                </>
            )}

            {/* Enlace de invitación (cualquier miembro puede compartirlo) */}
            <div style={{ marginBottom: 18 }}>
                <h3 style={st.h3}><Share2 size={16} /> Enlace de invitación</h3>
                <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: 8 }}>
                    Compártelo con quien quieras. Al abrirlo podrá <strong>solicitar unirse</strong> (tú apruebas), y si no tiene cuenta se dará de alta con Google.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input readOnly value={enlaceInvitacion} onFocus={e => e.target.select()}
                        style={{ ...st.input, marginBottom: 0, flex: 1, color: '#555', background: '#f8f9fb' }} />
                    <button onClick={copiarEnlace} style={{ ...st.btnPrimary, background: linkCopiado ? '#27ae60' : AZUL }}>
                        {linkCopiado ? <><CheckCircle size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                    </button>
                </div>
            </div>

            <h3 style={st.h3}><Users size={16} /> Miembros ({comunidad.miembros?.length || 0})</h3>
            {(comunidad.miembros || []).map(uid => {
                const d = info[uid] || {};
                const esC = uid === comunidad.creadorUid;
                return (
                    <div key={uid} style={st.filaMiembro}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {d.displayName || d.nombre || 'Profesor/a'}
                                {esC && <span style={st.chipMine}><ShieldCheck size={11} /> Creador</span>}
                                {uid === usuario.uid && <span style={{ fontSize: '0.7rem', color: '#95a5a6' }}>(tú)</span>}
                            </div>
                            {d.email && <div style={{ fontSize: '0.78rem', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> {d.email}</div>}
                        </div>
                        {esCreador && !esC && (
                            <button onClick={() => expulsar(uid)} disabled={proc === uid} title="Expulsar"
                                style={{ ...st.miniBtn, color: '#e74c3c', borderColor: '#f3c9c4' }}><LogOut size={13} /></button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ═══ CURSOS DEL CENTRO ═════════════════════════════════════════════════════════

// Constantes del plano (mismas que MapaAula.jsx)
const CANVAS_W = 760, CANVAS_H = 520, SEAT_W = 74, SEAT_GAP = 3, PAD = 8;
const deskWidth = n => n * SEAT_W + (n - 1) * SEAT_GAP + PAD;

const TIPOS_EVENTO = {
    examen:    { label: 'Examen',    color: '#e74c3c', emoji: '📝' },
    actividad: { label: 'Actividad', color: '#1565C0', emoji: '🎉' },
    entrega:   { label: 'Entrega',   color: '#e67e22', emoji: '📤' },
    reunion:   { label: 'Reunión',   color: '#8e44ad', emoji: '👥' },
    otro:      { label: 'Otro',      color: '#7f8c8d', emoji: '📌' },
};

// ─── Plano del aula en solo lectura ───────────────────────────────────────────
function PlanoView({ plano, nombre, exportable }) {
    const ref = useRef();
    if (!plano || !plano.mesas?.length) return <div style={st.vacioMini}>Sin plano.</div>;
    const sc = 0.62;
    const cw = plano.canvasW || CANVAS_W;
    const ch = plano.canvasH || CANVAS_H;
    return (
      <div>
        {exportable && <div style={{ marginBottom: 8 }}><ExportBar targetRef={ref} nombre={`Plano ${nombre || ''}`.trim()} /></div>}
        <div style={{ overflowX: 'auto' }}>
            <div ref={ref} style={{ position: 'relative', width: cw * sc, height: ch * sc, background: 'linear-gradient(180deg,#f0f4ff,#f8faff)', border: '2px solid #e0e4f0', borderRadius: 12, flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: 0, right: 0, textAlign: 'center', fontSize: '0.55rem', color: '#bdc3c7', fontWeight: 700 }}>▲ PIZARRA / FRENTE</div>
                {plano.mesas.map(m => {
                    const isP = m.tipo === 'profesor';
                    const col = isP ? '#e67e22' : '#1565C0';
                    const w = (isP ? 180 : deskWidth(m.asientos.length)) * sc;
                    return (
                        <div key={m.id} style={{ position: 'absolute', left: m.x * sc, top: m.y * sc, width: w, borderRadius: 7, border: `2px solid ${col}`, background: 'white', overflow: 'hidden', transform: `rotate(${m.rot || 0}deg)`, transformOrigin: 'center center' }}>
                            <div style={{ background: col, height: 12 }} />
                            <div style={{ display: 'flex', gap: SEAT_GAP * sc, padding: 2 }}>
                                {m.asientos.map(s => (
                                    <div key={s.id} style={{ width: SEAT_W * sc, minHeight: 26, borderRadius: 4, border: `1px solid ${isP ? '#e67e22' : s.alumno ? '#a5d6a7' : '#f5c6c2'}`, background: isP ? '#fdf3e7' : s.alumno ? '#e8f5e9' : '#fdeceb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 600, color: '#2c3e50', textAlign: 'center', lineHeight: 1.1, padding: 1, wordBreak: 'break-word' }}>
                                        {isP ? 'profe' : (s.alumno || '')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    );
}

// ─── Modal: elegir un plano propio (colección planos_aula) ────────────────────
function ModalElegirPlano({ usuario, onClose, onElegido }) {
    const [planes, setPlanes] = useState([]);
    const [cargando, setCargando] = useState(true);
    useEffect(() => {
        getDocs(query(collection(db, 'planos_aula'), where('profesorUid', '==', usuario.uid)))
            .then(s => setPlanes(s.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(() => {}).finally(() => setCargando(false));
    }, [usuario.uid]);
    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={{ ...st.panel, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <div style={st.header}><div style={st.hTitle}>🪑 Elegir plano</div><button onClick={onClose} style={st.closeBtn}><X size={18} /></button></div>
                {cargando ? <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
                    : planes.length === 0 ? <div style={st.vacio}>No tienes planos. Créalos en Informes → Plano de clase.</div>
                    : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {planes.map(p => (
                                <button key={p.id} onClick={() => onElegido({ nombre: p.nombre || 'Plano', mesas: p.mesas || [], grupoNombre: p.grupoNombre || '' })} style={st.grupoBtn}>
                                    🪑 <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{p.nombre || 'Plano'}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{p.grupoNombre}</span>
                                </button>
                            ))}
                        </div>
                    )}
            </div>
        </div>
    );
}

// ─── Modal: definir listado (grupo compartido, grupo propio o pegar nombres) ──
function ModalListado({ usuario, comunidad, onClose, onGuardado }) {
    const [compartidos, setCompartidos] = useState([]);
    const [propios, setPropios]     = useState([]);
    const [pegar, setPegar]         = useState('');
    const [cargando, setCargando]   = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const c = await getDocs(collection(db, 'comunidades', comunidad.id, 'grupos_compartidos'));
                setCompartidos(c.docs.map(d => ({ id: d.id, ...d.data() })));
                const p = await getDocs(query(collection(db, 'grupos_profesor'), where('profesorUid', '==', usuario.uid)));
                setPropios(p.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (_) {}
            setCargando(false);
        })();
    }, [comunidad.id, usuario.uid]);

    const usarAlumnos = (alumnos) => onGuardado((alumnos || []).map(a => ({ id: a.id || Math.random().toString(36).slice(2, 8), nombre: a.nombre, grupo: a.grupo || '' })));
    const usarPegado = () => {
        const nombres = pegar.split(/\r?\n/).map(l => l.split('\t')[0].trim()).filter(Boolean);
        if (!nombres.length) return;
        onGuardado(nombres.map(n => ({ id: Math.random().toString(36).slice(2, 8), nombre: n, grupo: '' })));
    };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={{ ...st.panel, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={st.header}><div style={st.hTitle}>📋 Listado del curso</div><button onClick={onClose} style={st.closeBtn}><X size={18} /></button></div>
                {cargando ? <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div> : (
                    <>
                        {compartidos.length > 0 && <>
                            <div style={st.label}>Grupos compartidos en la comunidad</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {compartidos.map(g => <button key={g.id} onClick={() => usarAlumnos(g.alumnos)} style={st.grupoBtn}><Users size={14} color={AZUL} /><span style={{ flex: 1, textAlign: 'left' }}>{g.nombre}</span><span style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{g.alumnos?.length || 0}</span></button>)}
                            </div>
                        </>}
                        {propios.length > 0 && <>
                            <div style={st.label}>Mis grupos</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {propios.map(g => <button key={g.id} onClick={() => usarAlumnos(g.alumnos)} style={st.grupoBtn}><Users size={14} color="#7f8c8d" /><span style={{ flex: 1, textAlign: 'left' }}>{g.nombre}</span><span style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{g.alumnos?.length || 0}</span></button>)}
                            </div>
                        </>}
                        <div style={st.label}>O pegar nombres (uno por línea)</div>
                        <textarea value={pegar} onChange={e => setPegar(e.target.value)} rows={4} placeholder={'Ana García\nLuis Pérez\n…'} style={{ ...st.input, resize: 'vertical' }} />
                        <div style={st.btnRow}><button onClick={usarPegado} disabled={!pegar.trim()} style={st.btnPrimary}>Usar estos nombres</button></div>
                    </>
                )}
                <style>{spin}</style>
            </div>
        </div>
    );
}

// ─── Calendario (mes) ─────────────────────────────────────────────────────────
export function Calendario({ usuario, comunidad, cursoId, cursoNombre, puedeEditar, sinFinde = false, acento }) {
    const ACC = acento || AZUL;
    const hoy = new Date();
    const [eventos, setEventos] = useState([]);
    const [ver, setVer]         = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
    const [diaSel, setDiaSel]   = useState(null); // 'YYYY-MM-DD'
    const [anchor, setAnchor]   = useState(null); // DOMRect de la celda pulsada (para el popover)
    const [form, setForm]       = useState(null); // { id?, fecha, titulo, tipo, descripcion }
    const [cursosLista, setCursosLista] = useState([]); // para copiar a otros calendarios
    const [menuEv, setMenuEv]   = useState(null);       // id de evento con menú abierto
    const [copiar, setCopiar]   = useState(null);       // evento a copiar
    const [dragId, setDragId]   = useState(null);       // id de evento arrastrado
    const calRef = useRef(null);                        // para exportar a imagen/PDF

    useEffect(() => {
        const ref = collection(db, 'comunidades', comunidad.id, 'eventos');
        return onSnapshot(ref, snap => {
            let ev = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (cursoId) ev = ev.filter(e => e.cursoId === cursoId);
            setEventos(ev);
        }, () => {});
    }, [comunidad.id, cursoId]);

    // Lista de calendarios (cursos) para "copiar a otros"
    useEffect(() => {
        if (!puedeEditar) return;
        getDocs(collection(db, 'comunidades', comunidad.id, 'cursos'))
            .then(s => setCursosLista(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999))))
            .catch(() => {});
    }, [comunidad.id, puedeEditar]);

    const pad = n => String(n).padStart(2, '0');
    const wd1 = (new Date(ver.y, ver.m, 1).getDay() + 6) % 7; // lunes=0..domingo=6
    const diasMes = new Date(ver.y, ver.m + 1, 0).getDate();
    const cols = sinFinde ? 5 : 7;
    const firstCol = sinFinde ? (wd1 < 5 ? wd1 : 0) : wd1;
    const celdas = [];
    for (let i = 0; i < firstCol; i++) celdas.push(null);
    for (let d = 1; d <= diasMes; d++) {
        if (sinFinde) { const wd = (new Date(ver.y, ver.m, d).getDay() + 6) % 7; if (wd >= 5) continue; }
        celdas.push(d);
    }

    const eventosDe = (d) => {
        if (!d) return [];
        const key = `${ver.y}-${pad(ver.m + 1)}-${pad(d)}`;
        return eventos.filter(e => e.fecha === key);
    };
    const cambiarMes = (delta) => {
        const nm = ver.m + delta;
        setVer({ y: ver.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 });
        setDiaSel(null);
    };
    const abrirForm = (d) => {
        if (!puedeEditar) return;
        const fecha = d ? `${ver.y}-${pad(ver.m + 1)}-${pad(d)}` : `${ver.y}-${pad(ver.m + 1)}-01`;
        setForm({ fecha, titulo: '', tipo: 'examen', descripcion: '' });
    };
    const guardarEvento = async () => {
        if (!form.titulo.trim() || !form.fecha) return;
        try {
            if (form.id) {
                await updateDoc(doc(db, 'comunidades', comunidad.id, 'eventos', form.id), {
                    titulo: form.titulo.trim(), fecha: form.fecha, tipo: form.tipo, descripcion: form.descripcion.trim(),
                });
            } else {
                await addDoc(collection(db, 'comunidades', comunidad.id, 'eventos'), {
                    cursoId: cursoId || '', cursoNombre: cursoNombre || '',
                    titulo: form.titulo.trim(), fecha: form.fecha, tipo: form.tipo,
                    descripcion: form.descripcion.trim(),
                    autorUid: usuario.uid, autorNombre: usuario.displayName || 'Profesor/a',
                    creado: serverTimestamp(),
                });
            }
            setForm(null);
        } catch (e) { alert('No se pudo guardar: ' + e.message); }
    };
    const borrarEvento = async (id) => {
        try { await deleteDoc(doc(db, 'comunidades', comunidad.id, 'eventos', id)); } catch (e) { alert('Error: ' + e.message); }
    };
    const abrirEditar = (e) => { setMenuEv(null); setForm({ id: e.id, fecha: e.fecha, titulo: e.titulo, tipo: e.tipo, descripcion: e.descripcion || '' }); };
    const moverEventoDia = async (id, nuevaFecha) => {
        const ev = eventos.find(e => e.id === id);
        if (!ev || ev.fecha === nuevaFecha) return;
        try { await updateDoc(doc(db, 'comunidades', comunidad.id, 'eventos', id), { fecha: nuevaFecha }); }
        catch (e) { alert('No se pudo mover: ' + e.message); }
    };
    const copiarEventoA = async (cursoIds) => {
        const ev = copiar;
        try {
            await Promise.all(cursoIds.map(cid => {
                const cn = cursosLista.find(c => c.id === cid)?.nombre || '';
                return addDoc(collection(db, 'comunidades', comunidad.id, 'eventos'), {
                    cursoId: cid, cursoNombre: cn,
                    titulo: ev.titulo, fecha: ev.fecha, tipo: ev.tipo, descripcion: ev.descripcion || '',
                    autorUid: usuario.uid, autorNombre: usuario.displayName || 'Profesor/a', creado: serverTimestamp(),
                });
            }));
            setCopiar(null);
        } catch (e) { alert('No se pudo copiar: ' + e.message); }
    };

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const hoyKey = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const eventosDiaSel = diaSel ? eventos.filter(e => e.fecha === diaSel) : [];
    const publicUrl = `${window.location.origin}/comunidad/${comunidad.id}/${cursoId ? 'curso/' + cursoId : 'calendarios'}`;
    const nombreExport = `${cursoNombre ? cursoNombre + ' - ' : ''}Calendario ${MESES[ver.m]} ${ver.y}`;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => cambiarMes(-1)} style={st.miniBtn}><ChevronLeft size={14} /></button>
                <div style={{ fontWeight: 700, color: '#2c3e50', flex: 1, textAlign: 'center', minWidth: 120 }}>{MESES[ver.m]} {ver.y}</div>
                <button onClick={() => cambiarMes(1)} style={st.miniBtn}><ChevronRight size={14} /></button>
                {puedeEditar && <button onClick={() => abrirForm(hoy.getMonth() === ver.m ? hoy.getDate() : 1)} style={{ ...st.btnPrimary, background: ACC }}><Plus size={15} /> Evento</button>}
                <ExportBar targetRef={calRef} nombre={nombreExport} classroomUrl={publicUrl} compact />
            </div>

            <div ref={calRef} style={{ background: 'white', padding: 6, borderRadius: 8 }}>
            <div style={{ textAlign: 'center', fontWeight: 700, color: '#2c3e50', fontSize: '0.92rem', marginBottom: 6 }}>{cursoNombre ? cursoNombre + ' · ' : ''}{MESES[ver.m]} {ver.y}</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 3 }}>
                {(sinFinde ? ['L', 'M', 'X', 'J', 'V'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D']).map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#95a5a6', padding: 2 }}>{d}</div>)}
                {celdas.map((d, i) => {
                    const evs = eventosDe(d);
                    const key = d ? `${ver.y}-${pad(ver.m + 1)}-${pad(d)}` : null;
                    const esHoy = key === hoyKey;
                    return (
                        <div key={i} onClick={(ev) => d && (setDiaSel(key), setAnchor(ev.currentTarget.getBoundingClientRect()), puedeEditar && evs.length === 0 && abrirForm(d))}
                            onDragOver={puedeEditar ? (ev => { if (dragId && d) ev.preventDefault(); }) : undefined}
                            onDrop={puedeEditar ? (ev => { if (dragId && d) { ev.preventDefault(); moverEventoDia(dragId, key); setDragId(null); } }) : undefined}
                            style={{ minHeight: 64, borderRadius: 8, border: `1.5px ${(puedeEditar && dragId && d) ? 'dashed #94a3b8' : 'solid'} ${diaSel === key ? ACC : (puedeEditar && dragId && d) ? '#94a3b8' : '#eef1f6'}`, background: d ? (esHoy ? ACC + '18' : 'white') : 'transparent', padding: 2, cursor: d ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {d && <div style={{ fontSize: '0.7rem', fontWeight: esHoy ? 800 : 600, color: esHoy ? ACC : '#7f8c8d', textAlign: 'right', flexShrink: 0 }}>{d}</div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1, overflow: 'hidden' }}>
                                {evs.slice(0, 3).map(e => {
                                    const t = TIPOS_EVENTO[e.tipo] || TIPOS_EVENTO.otro;
                                    return (
                                        <div key={e.id} title={e.titulo}
                                            draggable={puedeEditar}
                                            onDragStart={puedeEditar ? (ev => { ev.stopPropagation(); setDragId(e.id); ev.dataTransfer.effectAllowed = 'move'; }) : undefined}
                                            onDragEnd={() => setDragId(null)}
                                            style={{ fontSize: '0.58rem', lineHeight: 1.25, background: t.color, color: 'white', borderRadius: 3, padding: '0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: puedeEditar ? 'grab' : 'default', opacity: dragId === e.id ? 0.4 : 1 }}>
                                            {e.titulo}
                                        </div>
                                    );
                                })}
                                {evs.length > 3 && <div style={{ fontSize: '0.56rem', color: '#95a5a6', fontWeight: 700, paddingLeft: 2 }}>+{evs.length - 3}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>

            {/* Popover del día pulsado (sale de la celda) */}
            {diaSel && anchor && (
                <>
                    <div onClick={() => setDiaSel(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div onClick={e => e.stopPropagation()} style={{
                        position: 'fixed', zIndex: 41,
                        left: Math.max(8, Math.min(anchor.left, window.innerWidth - 268)),
                        top: Math.min(anchor.bottom + 6, Math.max(60, window.innerHeight - 240)),
                        width: 260, maxWidth: '92vw', maxHeight: '60vh', overflowY: 'auto',
                        background: 'white', borderRadius: 12, border: `2px solid ${ACC}`, boxShadow: '0 12px 34px rgba(0,0,0,0.28)', padding: 12,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ fontWeight: 800, color: ACC, fontSize: '0.95rem' }}>{diaSel.split('-').reverse().join('/')}</div>
                            {puedeEditar && <button onClick={() => abrirForm(parseInt(diaSel.slice(-2), 10))} title="Añadir" style={{ ...st.miniBtn, marginLeft: 'auto', padding: '4px 8px' }}><Plus size={13} /></button>}
                            <button onClick={() => setDiaSel(null)} style={{ ...st.miniBtn, padding: '4px 8px', marginLeft: puedeEditar ? 0 : 'auto' }}><X size={13} /></button>
                        </div>
                        {eventosDiaSel.length === 0 ? <div style={st.vacioMini}>Sin eventos este día.</div> : eventosDiaSel.map(e => {
                            const t = TIPOS_EVENTO[e.tipo] || TIPOS_EVENTO.otro;
                            return (
                                <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderLeft: `4px solid ${t.color}`, background: '#fafbfc', borderRadius: 8, marginBottom: 6, position: 'relative' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.86rem' }}>{t.emoji} {e.titulo}</div>
                                        {!cursoId && e.cursoNombre && <div style={{ fontSize: '0.72rem', color: AZUL }}>{e.cursoNombre}</div>}
                                        {e.descripcion && <div style={{ fontSize: '0.78rem', color: '#7f8c8d', marginTop: 2, whiteSpace: 'pre-wrap' }}>{e.descripcion}</div>}
                                        <div style={{ fontSize: '0.68rem', color: '#bdc3c7', marginTop: 2 }}>{t.label} · {e.autorNombre}</div>
                                    </div>
                                    {puedeEditar && (
                                        <div style={{ position: 'relative' }}>
                                            <button onClick={() => setMenuEv(menuEv === e.id ? null : e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', padding: 2 }}><MoreVertical size={16} /></button>
                                            {menuEv === e.id && (
                                                <>
                                                    <div onClick={() => setMenuEv(null)} style={{ position: 'fixed', inset: 0, zIndex: 42 }} />
                                                    <div style={{ position: 'absolute', right: 0, top: 24, background: 'white', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.22)', zIndex: 43, minWidth: 175, overflow: 'hidden' }}>
                                                        <button onClick={() => abrirEditar(e)} style={st.menuItemEv}><Pencil size={13} /> Editar</button>
                                                        <button onClick={() => { setMenuEv(null); setCopiar(e); }} style={st.menuItemEv}><Copy size={13} /> Copiar a calendarios</button>
                                                        <button onClick={() => { setMenuEv(null); borrarEvento(e.id); }} style={{ ...st.menuItemEv, color: '#e74c3c', borderBottom: 'none' }}><Trash2 size={13} /> Eliminar</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Form nuevo evento */}
            {form && (
                <div style={st.overlay} onClick={() => setForm(null)}>
                    <div style={{ ...st.panel, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div style={st.header}><div style={st.hTitle}>📅 {form.id ? 'Editar evento' : 'Nuevo evento'}</div><button onClick={() => setForm(null)} style={st.closeBtn}><X size={18} /></button></div>
                        <div style={st.label}>Fecha</div>
                        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={st.input} />
                        <div style={st.label}>Título</div>
                        <input autoFocus value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Examen de fracciones" style={st.input} />
                        <div style={st.label}>Tipo</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                            {Object.entries(TIPOS_EVENTO).map(([k, t]) => (
                                <button key={k} onClick={() => setForm({ ...form, tipo: k })} style={{ ...st.miniBtn, background: form.tipo === k ? t.color : 'white', color: form.tipo === k ? 'white' : t.color, borderColor: t.color }}>{t.emoji} {t.label}</button>
                            ))}
                        </div>
                        <div style={st.label}>Descripción (opcional)</div>
                        <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} style={{ ...st.input, resize: 'vertical' }} />
                        <div style={st.btnRow}>
                            <button onClick={() => setForm(null)} style={st.btnSec}>Cancelar</button>
                            <button onClick={guardarEvento} disabled={!form.titulo.trim()} style={st.btnPrimary}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {copiar && <ModalCopiarEvento evento={copiar} cursos={cursosLista} cursoActual={cursoId} onClose={() => setCopiar(null)} onCopiar={copiarEventoA} />}
            <style>{spin}</style>
        </div>
    );
}

// ─── Modal: copiar un evento a otros calendarios ──────────────────────────────
function ModalCopiarEvento({ evento, cursos, cursoActual, onClose, onCopiar }) {
    const [sel, setSel] = useState(new Set());
    const [copiando, setCopiando] = useState(false);
    const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const confirmar = async () => { if (sel.size === 0) return; setCopiando(true); await onCopiar([...sel]); setCopiando(false); };
    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={{ ...st.panel, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <div style={st.header}><div style={st.hTitle}><Copy size={18} color={AZUL} /> Copiar «{evento.titulo}»</div><button onClick={onClose} style={st.closeBtn}><X size={18} /></button></div>
                <div style={{ fontSize: '0.82rem', color: '#7f8c8d', marginBottom: 10 }}>Elige los calendarios donde copiarlo (día {evento.fecha.split('-').reverse().join('/')}).</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {cursos.length === 0 ? <div style={st.vacioMini}>No hay otros calendarios.</div> : cursos.map(c => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1.5px solid ' + (sel.has(c.id) ? AZUL : '#e0e4f0'), cursor: 'pointer', background: sel.has(c.id) ? '#eff5ff' : 'white' }}>
                            <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                            <GraduationCap size={15} color={c.color || AZUL} />
                            <span style={{ flex: 1, fontWeight: 600, color: '#2c3e50' }}>{c.nombre}</span>
                            {c.id === cursoActual && <span style={{ fontSize: '0.68rem', color: '#95a5a6' }}>actual</span>}
                        </label>
                    ))}
                </div>
                <div style={st.btnRow}>
                    <button onClick={onClose} style={st.btnSec}>Cancelar</button>
                    <button onClick={confirmar} disabled={sel.size === 0 || copiando} style={st.btnPrimary}>
                        {copiando ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Copiando…</> : <><Copy size={14} /> Copiar{sel.size ? ` (${sel.size})` : ''}</>}
                    </button>
                </div>
                <style>{spin}</style>
            </div>
        </div>
    );
}

// ─── Horario semanal del curso (L-V × franjas, materias arrastrables) ─────────
const PALETA_COLORES = ['#e74c3c', '#1565C0', '#8e44ad', '#16a34a', '#e67e22', '#0891b2', '#db2777', '#ca8a04', '#4f46e5', '#0d9488'];
const DIAS_SEM = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MATERIAS_DEF = () => ([
    { id: 'm1', nombre: 'Matemáticas', profesor: '', color: '#e74c3c' },
    { id: 'm2', nombre: 'Lengua', profesor: '', color: '#1565C0' },
    { id: 'm3', nombre: 'Geografía e Historia', profesor: '', color: '#8e44ad' },
    { id: 'm4', nombre: 'Inglés', profesor: '', color: '#16a34a' },
    { id: 'm5', nombre: 'Educación Física', profesor: '', color: '#e67e22' },
]);

// Vista de solo lectura del horario (para la parte pública)
export function HorarioView({ horario }) {
    if (!horario || !horario.materias) return null;
    const franjas = horario.franjas || [];
    const celdas = horario.celdas || {};
    const materiaDe = (id) => (horario.materias || []).find(m => m.id === id);
    if (!franjas.length) return null;
    return (
        <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(5, minmax(80px, 1fr))', gap: 3, minWidth: 500 }}>
                <div />
                {DIAS_SEM.map(d => <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#7f8c8d', fontSize: '0.74rem', padding: '4px 0' }}>{d}</div>)}
                {franjas.map((f, i) => (
                    <React.Fragment key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#7f8c8d', background: '#f8f9fb', borderRadius: 6, padding: 2, textAlign: 'center' }}>{f}</div>
                        {DIAS_SEM.map((_, d) => {
                            const m = materiaDe(celdas[`${d}_${i}`]);
                            return (
                                <div key={d} style={{ minHeight: 42, borderRadius: 6, border: '1.5px solid #eef1f6', background: m ? m.color : 'white', padding: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
                                    {m && <>
                                        <div style={{ color: 'white', fontWeight: 700, fontSize: '0.68rem', lineHeight: 1.15 }}>{m.nombre}</div>
                                        {m.profesor && <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.58rem' }}>{m.profesor}</div>}
                                    </>}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

function HorarioCurso({ horario, onSave, nombre, publicUrl }) {
    const gridRef = useRef();
    const h = {
        franjas: horario?.franjas || ['1', '2', '3', '4', '5', '6', '7', '8'],
        materias: horario?.materias || MATERIAS_DEF(),
        celdas: horario?.celdas || {},
    };
    const [sel, setSel]       = useState(null);   // materia seleccionada por clic
    const [drag, setDrag]     = useState(null);   // materia arrastrada
    const [editMat, setEditMat] = useState(false);

    const guardar = (campos) => onSave({ ...h, ...campos });
    const setFranja = (i, v) => { const f = [...h.franjas]; f[i] = v; guardar({ franjas: f }); };
    const addFranja = () => guardar({ franjas: [...h.franjas, String(h.franjas.length + 1)] });
    const delFranja = () => {
        if (h.franjas.length <= 1) return;
        const idx = h.franjas.length - 1;
        const c = { ...h.celdas }; DIAS_SEM.forEach((_, d) => delete c[`${d}_${idx}`]);
        guardar({ franjas: h.franjas.slice(0, -1), celdas: c });
    };
    const addMateria = () => guardar({ materias: [...h.materias, { id: nuevoId(), nombre: 'Nueva materia', profesor: '', color: PALETA_COLORES[h.materias.length % PALETA_COLORES.length] }] });
    const setMateria = (id, campos) => guardar({ materias: h.materias.map(m => m.id === id ? { ...m, ...campos } : m) });
    const delMateria = (id) => {
        const c = { ...h.celdas }; Object.keys(c).forEach(k => { if (c[k] === id) delete c[k]; });
        guardar({ materias: h.materias.filter(m => m.id !== id), celdas: c });
        if (sel === id) setSel(null);
    };
    const asignar = (d, i, materiaId) => {
        const c = { ...h.celdas }; const key = `${d}_${i}`;
        if (materiaId == null) delete c[key]; else c[key] = materiaId;
        guardar({ celdas: c });
    };
    const materiaDe = (id) => h.materias.find(m => m.id === id);
    const clicCelda = (d, i) => {
        const key = `${d}_${i}`;
        if (sel) asignar(d, i, sel);
        else if (h.celdas[key]) asignar(d, i, null);
    };

    const franjaInput = { width: '100%', boxSizing: 'border-box', border: '1px solid #e0e4f0', borderRadius: 6, padding: '4px 4px', fontSize: '0.72rem', textAlign: 'center', color: '#555', fontFamily: 'inherit', outline: 'none', background: '#f8f9fb' };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <ExportBar targetRef={gridRef} nombre={nombre || 'Horario'} classroomUrl={publicUrl} pdfLandscape />
            </div>
            <div style={{ overflowX: 'auto' }}>
                <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '72px repeat(5, minmax(88px, 1fr))', gap: 3, minWidth: 520, background: 'white', padding: 4 }}>
                    <div />
                    {DIAS_SEM.map(d => <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#7f8c8d', fontSize: '0.76rem', padding: '4px 0' }}>{d}</div>)}
                    {h.franjas.map((f, i) => (
                        <React.Fragment key={i}>
                            <input defaultValue={f} onBlur={e => { if (e.target.value !== f) setFranja(i, e.target.value); }} title="Franja horaria" style={franjaInput} />
                            {DIAS_SEM.map((_, d) => {
                                const mid = h.celdas[`${d}_${i}`]; const m = mid && materiaDe(mid);
                                return (
                                    <div key={d} onClick={() => clicCelda(d, i)}
                                        onDragOver={e => { if (drag) e.preventDefault(); }}
                                        onDrop={e => { e.preventDefault(); if (drag) asignar(d, i, drag); }}
                                        style={{ minHeight: 46, borderRadius: 6, border: `1.5px ${(sel || drag) ? 'dashed #94a3b8' : 'solid #eef1f6'}`, background: m ? m.color : 'white', cursor: 'pointer', padding: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
                                        {m && <>
                                            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.7rem', lineHeight: 1.15 }}>{m.nombre}</div>
                                            {m.profesor && <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.6rem' }}>{m.profesor}</div>}
                                        </>}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={addFranja} style={st.miniBtn}><Plus size={13} /> Franja</button>
                <button onClick={delFranja} disabled={h.franjas.length <= 1} style={st.miniBtn}>− Franja</button>
                {sel && <span style={{ fontSize: '0.75rem', color: AZUL }}>Toca una celda para colocar «{materiaDe(sel)?.nombre}» · <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.75rem', padding: 0 }}>cancelar</button></span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 8px', flexWrap: 'wrap' }}>
                <h3 style={{ ...st.h3, margin: 0 }}>Materias</h3>
                <button onClick={() => setEditMat(v => !v)} style={{ ...st.miniBtn, marginLeft: 'auto' }}>{editMat ? 'Hecho' : <><Pencil size={13} /> Editar</>}</button>
                <button onClick={addMateria} style={st.btnPrimary}><Plus size={14} /> Materia</button>
            </div>

            {!editMat ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {h.materias.map(m => (
                        <div key={m.id} draggable onDragStart={() => setDrag(m.id)} onDragEnd={() => setDrag(null)}
                            onClick={() => setSel(sel === m.id ? null : m.id)}
                            style={{ display: 'flex', flexDirection: 'column', padding: '6px 12px', borderRadius: 10, background: m.color, color: 'white', cursor: 'grab', border: sel === m.id ? '3px solid #2c3e50' : '3px solid transparent', minWidth: 80 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{m.nombre}</span>
                            {m.profesor && <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>{m.profesor}</span>}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {h.materias.map(m => (
                        <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="color" value={m.color} onChange={e => setMateria(m.id, { color: e.target.value })} style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            <input defaultValue={m.nombre} onBlur={e => { const v = e.target.value.trim(); if (v && v !== m.nombre) setMateria(m.id, { nombre: v }); }} placeholder="Materia" style={{ ...st.input, marginBottom: 0, flex: 1, minWidth: 120 }} />
                            <input defaultValue={m.profesor} onBlur={e => { const v = e.target.value.trim(); if (v !== m.profesor) setMateria(m.id, { profesor: v }); }} placeholder="Profesor (opcional)" style={{ ...st.input, marginBottom: 0, flex: 1, minWidth: 120 }} />
                            <button onClick={() => delMateria(m.id)} style={{ ...st.miniBtn, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={13} /></button>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ fontSize: '0.72rem', color: '#bdc3c7', marginTop: 8 }}>Arrastra una materia a una celda, o toca la materia y luego la celda. Toca una celda ocupada para vaciarla.</div>
        </div>
    );
}

// ─── Detalle de un curso (miembro) ────────────────────────────────────────────
function CursoDetalle({ usuario, comunidad, curso, onBack }) {
    const [sub, setSub]       = useState('listado');
    const [priv, setPriv]     = useState(null); // { listado, plano }
    const [modalListado, setModalListado] = useState(false);
    const [modalPlano, setModalPlano]     = useState(false);
    const [planoEdit, setPlanoEdit]       = useState(null); // null | { id: string|null, data: plano|null }
    const [copiadoListado, setCopiadoListado] = useState(false);
    const [mostrarCopiaModal, setMostrarCopiaModal] = useState(false);
    const [copiandoListado, setCopiandoListado] = useState(false);
    const [nuevoAlumno, setNuevoAlumno]   = useState('');
    const privRef = doc(db, 'comunidades', comunidad.id, 'cursos', curso.id, 'privado', 'data');

    const guardarListaAlumnos = async (lista) => {
        try { await setDoc(privRef, { listado: lista }, { merge: true }); }
        catch (e) { alert('No se pudo guardar: ' + e.message); }
    };
    const añadirAlumno = () => {
        const n = nuevoAlumno.trim(); if (!n) return;
        guardarListaAlumnos([...(priv?.listado || []), { id: nuevoId(), nombre: n, grupo: '' }]);
        setNuevoAlumno('');
    };
    const eliminarAlumno = (id) => guardarListaAlumnos((priv?.listado || []).filter(a => a.id !== id));
    const renombrarAlumno = (id, nombre) => {
        const n = (nombre || '').trim(); if (!n) return;
        guardarListaAlumnos((priv?.listado || []).map(a => a.id === id ? { ...a, nombre: n } : a));
    };

    const copiarListadoAMisGrupos = async () => {
        setCopiandoListado(true);
        try {
            await addDoc(collection(db, 'grupos_profesor'), {
                profesorUid: usuario.uid,
                nombre: curso.nombre || 'Curso',
                alumnos: (priv?.listado || []).map(a => ({ ...a })),
                columnas: [], celdas: {},
                fechaCreacion: serverTimestamp(),
            });
            setMostrarCopiaModal(false);
            setCopiadoListado(true); setTimeout(() => setCopiadoListado(false), 2500);
        } catch (e) { alert('No se pudo copiar: ' + e.message); }
        setCopiandoListado(false);
    };

    useEffect(() => onSnapshot(privRef, s => setPriv(s.exists() ? s.data() : { listado: [], planos: [] }), () => setPriv({ listado: [], planos: [] })), [comunidad.id, curso.id]);

    // Normaliza a lista de planos (migra el antiguo campo 'plano' único)
    const planos = priv?.planos || (priv?.plano ? [{ id: 'principal', ...priv.plano }] : []);

    const guardarListado = async (listado) => {
        try { await setDoc(privRef, { listado }, { merge: true }); setModalListado(false); }
        catch (e) { alert('No se pudo guardar: ' + e.message); }
    };
    const upsertPlano = async (planoObj, id) => {
        const theId = id || nuevoId();
        const lista = [...planos];
        const i = lista.findIndex(p => p.id === theId);
        if (i >= 0) lista[i] = { ...planoObj, id: theId }; else lista.push({ ...planoObj, id: theId });
        try { await setDoc(privRef, { planos: lista, plano: null }, { merge: true }); return theId; }
        catch (e) { alert('No se pudo guardar el plano: ' + e.message); }
    };
    const borrarPlanoItem = async (id) => {
        try { await setDoc(privRef, { planos: planos.filter(p => p.id !== id), plano: null }, { merge: true }); }
        catch (e) { alert('No se pudo borrar: ' + e.message); }
    };
    const actualizarCurso = async (campos) => {
        try { await updateDoc(doc(db, 'comunidades', comunidad.id, 'cursos', curso.id), campos); }
        catch (e) { alert('No se pudo guardar el ajuste: ' + e.message); }
    };
    // El horario va en el doc del curso (público de lectura) para poder mostrarlo fuera
    const saveHorario = async (hor) => {
        try { await updateDoc(doc(db, 'comunidades', comunidad.id, 'cursos', curso.id), { horario: hor }); }
        catch (e) { alert('No se pudo guardar el horario: ' + e.message); }
    };

    return (
        <div>
            <button onClick={onBack} style={st.backBtn}><ChevronLeft size={16} /> Cursos</button>
            <h2 style={{ margin: '0 0 12px', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}><GraduationCap size={22} color={AZUL} /> {curso.nombre}</h2>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e0e4f0' }}>
                {[['listado', '📋 Listado'], ['horario', '🕐 Horario'], ['plano', '🪑 Plano'], ['calendario', '📅 Calendario']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setSub(id)} style={{ ...st.tabBtn, color: sub === id ? AZUL : '#7f8c8d', borderBottom: sub === id ? `3px solid ${AZUL}` : '3px solid transparent', fontWeight: sub === id ? 700 : 500 }}>{lbl}</button>
                ))}
            </div>

            {priv === null ? <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div> : <>
                {sub === 'listado' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>{priv.listado?.length || 0} alumnos · solo visible para miembros</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {priv.listado?.length > 0 && (
                                    <button onClick={() => setMostrarCopiaModal(true)} style={{ ...st.btnSec, color: copiadoListado ? '#27ae60' : AZUL, borderColor: copiadoListado ? '#27ae60' : '#cdd6ea' }}>
                                        {copiadoListado ? <><CheckCircle size={15} /> Copiado</> : <><Copy size={15} /> Copiar a mi zona</>}
                                    </button>
                                )}
                                <button onClick={() => setModalListado(true)} style={st.btnPrimary}><ClipboardList size={15} /> Definir listado</button>
                            </div>
                        </div>
                        {(!priv.listado || priv.listado.length === 0) ? <div style={st.vacio}>Sin listado. Pulsa «Definir listado» o añade alumnos uno a uno abajo.</div> : (
                            <div style={{ border: '1px solid #e0e4f0', borderRadius: 10, overflow: 'hidden' }}>
                                {priv.listado.map((a, i) => (
                                    <div key={a.id || i} style={{ padding: '5px 10px', borderBottom: '1px solid #f3f3f3', background: i % 2 ? '#fafafa' : 'white', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ color: '#bdc3c7', fontSize: '0.8rem', width: 22, flexShrink: 0 }}>{i + 1}</span>
                                        <input defaultValue={a.nombre}
                                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                            onBlur={e => { const v = e.target.value.trim(); if (v && v !== a.nombre) renombrarAlumno(a.id, v); else if (!v) e.target.value = a.nombre; }}
                                            style={{ flex: 1, minWidth: 0, border: '1px solid transparent', borderRadius: 6, padding: '5px 6px', fontSize: '0.86rem', color: '#2c3e50', fontFamily: 'inherit', outline: 'none', background: 'transparent' }}
                                            onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#cdd6ea'; }} />
                                        {a.grupo && <span style={{ fontSize: '0.72rem', color: '#95a5a6', flexShrink: 0 }}>{a.grupo}</span>}
                                        <button onClick={() => eliminarAlumno(a.id)} title="Eliminar alumno" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', padding: 2, flexShrink: 0 }}><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Añadir un alumno */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <input value={nuevoAlumno} onChange={e => setNuevoAlumno(e.target.value)} onKeyDown={e => e.key === 'Enter' && añadirAlumno()}
                                placeholder="Añadir un alumno…" style={{ ...st.input, marginBottom: 0, flex: 1 }} />
                            <button onClick={añadirAlumno} disabled={!nuevoAlumno.trim()} style={st.btnPrimary}><Plus size={15} /> Añadir</button>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#bdc3c7', marginTop: 6 }}>Toca un nombre para reescribirlo (se guarda al salir del campo).</div>
                    </div>
                )}
                {sub === 'horario' && (
                    <div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: '#f8f9fb', borderRadius: 10, fontSize: '0.82rem', color: '#555' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!curso.horarioOculto} onChange={e => actualizarCurso({ horarioOculto: e.target.checked })} /> Ocultar horario en la parte pública
                            </label>
                        </div>
                        <HorarioCurso horario={curso.horario || priv.horario} onSave={saveHorario}
                            nombre={`Horario ${curso.nombre}`}
                            publicUrl={curso.horarioOculto ? null : `${window.location.origin}/comunidad/${comunidad.id}/curso/${curso.id}`} />
                    </div>
                )}
                {sub === 'plano' && (planoEdit ? (
                    <EditorAula
                        planInicial={planoEdit.data || undefined}
                        poolAlumnos={(priv.listado || []).map(a => a.nombre)}
                        onGuardar={async (po) => { const id = await upsertPlano(po, planoEdit.id); setPlanoEdit(pe => pe ? { ...pe, id, data: po } : pe); }}
                        onBack={() => setPlanoEdit(null)}
                        backLabel="Volver al curso"
                        profesorUid={usuario.uid}
                    />
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>{planos.length} plano{planos.length === 1 ? '' : 's'} · uno por materia si quieres · solo visible para miembros</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={() => setPlanoEdit({ id: null, data: null })} style={st.btnPrimary}><Plus size={15} /> Nuevo plano</button>
                                <button onClick={() => setModalPlano(true)} style={st.btnSec}>Importar de mis planos</button>
                            </div>
                        </div>
                        {planos.length === 0 ? <div style={st.vacio}>Sin planos. Crea uno desde cero (usa el listado del curso) o impórtalo. Puedes tener varios, p. ej. uno por asignatura.</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {planos.map(p => (
                                    <div key={p.id} style={{ border: '1px solid #e0e4f0', borderRadius: 12, padding: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                            <div style={{ fontWeight: 700, color: '#2c3e50', flex: 1 }}>🪑 {p.nombre || 'Plano'}</div>
                                            <button onClick={() => setPlanoEdit({ id: p.id, data: p })} style={st.miniBtn}><Pencil size={13} /> Editar</button>
                                            <button onClick={() => borrarPlanoItem(p.id)} style={{ ...st.miniBtn, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={13} /></button>
                                        </div>
                                        <PlanoView plano={p} nombre={`${curso.nombre} ${p.nombre || ''}`} exportable />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {sub === 'calendario' && (
                    <div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: '#f8f9fb', borderRadius: 10, fontSize: '0.82rem', color: '#555' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                🎨 Color <input type="color" value={curso.color || '#1565C0'} onChange={e => actualizarCurso({ color: e.target.value })} style={{ width: 34, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!curso.sinFinde} onChange={e => actualizarCurso({ sinFinde: e.target.checked })} /> Ocultar fines de semana
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!curso.oculto} onChange={e => actualizarCurso({ oculto: e.target.checked })} /> Ocultar en la parte pública
                            </label>
                        </div>
                        <Calendario usuario={usuario} comunidad={comunidad} cursoId={curso.id} cursoNombre={curso.nombre} puedeEditar sinFinde={!!curso.sinFinde} acento={curso.color} />
                    </div>
                )}
            </>}

            {mostrarCopiaModal && (
                <div style={st.overlay} onClick={() => setMostrarCopiaModal(false)}>
                    <div style={{ ...st.panel, maxWidth: 470 }} onClick={e => e.stopPropagation()}>
                        <div style={st.header}>
                            <div style={st.hTitle}><Copy size={19} color={AZUL} /> Copiar a tu zona personal</div>
                            <button onClick={() => setMostrarCopiaModal(false)} style={st.closeBtn}><X size={18} /></button>
                        </div>
                        <p style={{ margin: '0 0 12px', color: '#555', fontSize: '0.9rem', lineHeight: 1.55 }}>
                            Se creará un grupo con estos <strong>{priv?.listado?.length || 0} alumnos</strong> en <strong>Informes → Grupos</strong> (tu cuaderno personal). Allí, de forma privada, podrás:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><Users size={16} color={AZUL} style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: '0.86rem', color: '#2c3e50' }}>Crear tus propios <strong>subgrupos</strong>.</span></div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontSize: 15, marginTop: 1 }}>🪑</span><span style={{ fontSize: '0.86rem', color: '#2c3e50' }}>Hacer <strong>planos de clase</strong>.</span></div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontSize: 15, marginTop: 1 }}>📝</span><span style={{ fontSize: '0.86rem', color: '#2c3e50' }}>Usarlo para apuntar <strong>calificaciones</strong>.</span></div>
                        </div>
                        <div style={{ ...st.aviso, marginBottom: 14 }}>
                            <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                            Es una copia: lo que hagas en tu zona no afecta al curso de la comunidad.
                        </div>
                        <div style={st.btnRow}>
                            <button onClick={() => setMostrarCopiaModal(false)} style={st.btnSec}>Cancelar</button>
                            <button onClick={copiarListadoAMisGrupos} disabled={copiandoListado} style={st.btnPrimary}>
                                {copiandoListado ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Copiando…</> : <><CheckCircle size={15} /> Confirmar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalListado && <ModalListado usuario={usuario} comunidad={comunidad} onClose={() => setModalListado(false)} onGuardado={guardarListado} />}
            {modalPlano && <ModalElegirPlano usuario={usuario} onClose={() => setModalPlano(false)} onElegido={async (po) => { await upsertPlano(po, null); setModalPlano(false); }} />}
            <style>{spin}</style>
        </div>
    );
}

// ─── Panel de cursos (dentro del detalle de comunidad) ────────────────────────
function CursosPanel({ usuario, comunidad }) {
    const [cursos, setCursos]   = useState([]);
    const [cargando, setCargando] = useState(true);
    const [nuevo, setNuevo]     = useState('');
    const [creando, setCreando] = useState(false);
    const [abierto, setAbierto] = useState(null);
    const [confirmarBorrar, setConfirmarBorrar] = useState(null);
    const [conteos, setConteos] = useState({}); // cursoId -> nº alumnos del listado

    useEffect(() => {
        const ref = collection(db, 'comunidades', comunidad.id, 'cursos');
        return onSnapshot(ref, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
            setCursos(docs); setCargando(false);
        }, () => setCargando(false));
    }, [comunidad.id]);

    // Nº de alumnos del listado de cada curso (subdoc privado, solo miembros)
    const cursosKey = cursos.map(c => c.id).join(',');
    useEffect(() => {
        if (!cursos.length) { setConteos({}); return; }
        let vivo = true;
        (async () => {
            const res = {};
            await Promise.all(cursos.map(async c => {
                try { const s = await getDoc(doc(db, 'comunidades', comunidad.id, 'cursos', c.id, 'privado', 'data')); res[c.id] = (s.exists() && (s.data().listado || []).length) || 0; }
                catch (_) { res[c.id] = 0; }
            }));
            if (vivo) setConteos(res);
        })();
        return () => { vivo = false; };
    }, [comunidad.id, cursosKey, abierto]);

    const mover = async (idx, dir) => {
        const arr = [...cursos];
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        try { await Promise.all(arr.map((c, i) => updateDoc(doc(db, 'comunidades', comunidad.id, 'cursos', c.id), { orden: i }))); }
        catch (e) { alert('No se pudo reordenar: ' + e.message); }
    };

    const crear = async () => {
        const n = nuevo.trim();
        if (!n) return;
        setCreando(true);
        try {
            await addDoc(collection(db, 'comunidades', comunidad.id, 'cursos'), {
                nombre: n, creadoPor: usuario.uid, creadoPorNombre: usuario.displayName || 'Profesor/a', orden: cursos.length, fecha: serverTimestamp(),
            });
            setNuevo('');
        } catch (e) { alert('No se pudo crear: ' + e.message); }
        setCreando(false);
    };
    const borrar = async (c) => {
        try {
            const priv = await getDocs(collection(db, 'comunidades', comunidad.id, 'cursos', c.id, 'privado'));
            await Promise.all(priv.docs.map(d => deleteDoc(d.ref)));
            const evs = await getDocs(collection(db, 'comunidades', comunidad.id, 'eventos'));
            await Promise.all(evs.docs.filter(d => d.data().cursoId === c.id).map(d => deleteDoc(d.ref)));
            await deleteDoc(doc(db, 'comunidades', comunidad.id, 'cursos', c.id));
        } catch (e) { alert('No se pudo borrar: ' + e.message); }
        setConfirmarBorrar(null);
    };

    if (abierto) {
        const viva = cursos.find(c => c.id === abierto.id) || abierto;
        return <CursoDetalle usuario={usuario} comunidad={comunidad} curso={viva} onBack={() => setAbierto(null)} />;
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} placeholder="Nombre del curso (ej: 1º ESO A)" style={{ ...st.input, marginBottom: 0, flex: 1 }} />
                <button onClick={crear} disabled={creando || !nuevo.trim()} style={st.btnPrimary}><Plus size={16} /> Curso</button>
            </div>
            {cargando ? <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
                : cursos.length === 0 ? <div style={st.vacio}>Aún no hay cursos. Crea el primero arriba.</div>
                : (
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                        {cursos.map((c, idx) => (
                            <div key={c.id} style={{ ...st.tarjetaGrupo, borderLeft: `4px solid ${c.color || AZUL}` }}>
                                <div style={{ fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <GraduationCap size={16} color={c.color || AZUL} /> {c.nombre}
                                    {c.oculto && <span title="Oculto en la parte pública" style={{ marginLeft: 'auto', fontSize: '0.66rem', background: '#f1f3f7', color: '#95a5a6', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>oculto</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#95a5a6' }}>{conteos[c.id] ?? 0} alumnos</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', alignItems: 'center' }}>
                                    <button onClick={() => mover(idx, -1)} disabled={idx === 0} title="Subir" style={{ ...st.miniBtn, padding: '5px 7px', opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                                    <button onClick={() => mover(idx, 1)} disabled={idx === cursos.length - 1} title="Bajar" style={{ ...st.miniBtn, padding: '5px 7px', opacity: idx === cursos.length - 1 ? 0.4 : 1 }}>↓</button>
                                    <button onClick={() => setAbierto(c)} style={{ ...st.miniBtn, color: AZUL, borderColor: '#cdd6ea' }}><Eye size={13} /> Abrir</button>
                                    {confirmarBorrar === c.id ? (
                                        <>
                                            <button onClick={() => borrar(c)} style={{ ...st.miniBtn, color: 'white', background: '#e74c3c', borderColor: '#e74c3c' }}>Sí</button>
                                            <button onClick={() => setConfirmarBorrar(null)} style={st.miniBtn}>No</button>
                                        </>
                                    ) : <button onClick={() => setConfirmarBorrar(c.id)} style={{ ...st.miniBtn, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={13} /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}

// ─── Panel: todos los calendarios con selector ────────────────────────────────
function PanelCalendarios({ usuario, comunidad }) {
    const [cursos, setCursos]   = useState([]);
    const [sel, setSel]         = useState('todos');
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const ref = collection(db, 'comunidades', comunidad.id, 'cursos');
        return onSnapshot(ref, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
            setCursos(docs); setCargando(false);
            setSel(prev => prev === 'todos' || docs.some(c => c.id === prev) ? prev : 'todos');
        }, () => setCargando(false));
    }, [comunidad.id]);

    const cursoSel = cursos.find(c => c.id === sel);
    const chip = (activo, color) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${color}`, background: activo ? color : 'white', color: activo ? 'white' : color, cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap' });
    const actualizarCurso = async (campos) => {
        try { await updateDoc(doc(db, 'comunidades', comunidad.id, 'cursos', sel), campos); }
        catch (e) { alert('No se pudo guardar el ajuste: ' + e.message); }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <button onClick={() => setSel('todos')} style={chip(sel === 'todos', AZUL)}>🗓️ Todos</button>
                {cursos.map(c => (
                    <button key={c.id} onClick={() => setSel(c.id)} style={chip(sel === c.id, c.color || AZUL)}>
                        <GraduationCap size={14} /> {c.nombre}
                    </button>
                ))}
            </div>
            {cargando ? <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
                : cursos.length === 0 ? <div style={st.vacio}>No hay cursos con calendario. Créalos en la pestaña «Cursos».</div>
                : sel === 'todos'
                    ? <Calendario usuario={usuario} comunidad={comunidad} puedeEditar />
                    : cursoSel && (
                        <div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: '#f8f9fb', borderRadius: 10, fontSize: '0.82rem', color: '#555' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🎨 Color <input type="color" value={cursoSel.color || '#1565C0'} onChange={e => actualizarCurso({ color: e.target.value })} style={{ width: 34, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={!!cursoSel.sinFinde} onChange={e => actualizarCurso({ sinFinde: e.target.checked })} /> Ocultar fines de semana
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={!!cursoSel.oculto} onChange={e => actualizarCurso({ oculto: e.target.checked })} /> Ocultar en la parte pública
                                </label>
                            </div>
                            <Calendario usuario={usuario} comunidad={comunidad} cursoId={cursoSel.id} cursoNombre={cursoSel.nombre} acento={cursoSel.color} sinFinde={!!cursoSel.sinFinde} puedeEditar />
                        </div>
                    )}
        </div>
    );
}

// ─── Detalle de una comunidad (soy miembro) ───────────────────────────────────
function DetalleComunidad({ usuario, comunidad, onBack, onSalir, onCambio }) {
    const [tab, setTab] = useState('cursos'); // cursos | calendario | mensajes | miembros
    const [compartidos, setCompartidos] = useState([]);
    const [cargando, setCargando]       = useState(true);
    const [modalCompartir, setModalCompartir] = useState(false);
    const [viendo, setViendo]           = useState(null);
    const [copiando, setCopiando]       = useState(null);
    const [copiadoOk, setCopiadoOk]     = useState(null);
    const [borrando, setBorrando]       = useState(null);
    const [aviso, setAviso]             = useState('');
    const [confirmarBorrarCom, setConfirmarBorrarCom] = useState(false);
    const [borrandoCom, setBorrandoCom] = useState(false);
    const esCreador = comunidad.creadorUid === usuario.uid;

    const eliminarComunidad = async () => {
        setBorrandoCom(true); setAviso('');
        try {
            await eliminarComunidadCompleta(comunidad.id);
            onBack();
            onCambio && onCambio();
        } catch (e) {
            setAviso('No se pudo eliminar la comunidad: ' + e.message);
            setBorrandoCom(false);
        }
    };

    useEffect(() => {
        const ref = collection(db, 'comunidades', comunidad.id, 'grupos_compartidos');
        return onSnapshot(ref, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.fechaCompartido?.seconds || 0) - (a.fechaCompartido?.seconds || 0));
            setCompartidos(docs); setCargando(false);
        }, err => { setAviso('No se pudieron cargar los grupos: ' + err.message); setCargando(false); });
    }, [comunidad.id]);

    const copiarAMisGrupos = async (c) => {
        setCopiando(c.id); setAviso('');
        try {
            await addDoc(collection(db, 'grupos_profesor'), {
                profesorUid: usuario.uid,
                nombre: `${c.nombre} (de ${c.compartidoPorNombre})`,
                alumnos: (c.alumnos || []).map(a => ({ ...a })),
                columnas: [], celdas: {},
                fechaCreacion: serverTimestamp(),
            });
            setCopiadoOk(c.id); setTimeout(() => setCopiadoOk(null), 2500);
        } catch (e) { setAviso('No se pudo copiar: ' + e.message); }
        setCopiando(null);
    };
    const borrarCompartido = async (c) => {
        setBorrando(c.id);
        try { await deleteDoc(doc(db, 'comunidades', comunidad.id, 'grupos_compartidos', c.id)); }
        catch (e) { setAviso('No se pudo eliminar: ' + e.message); }
        setBorrando(null);
    };

    return (
        <div>
            <button onClick={onBack} style={st.backBtn}><ChevronLeft size={16} /> Comunidades</button>
            <div style={{ background: 'white', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    {comunidad.imagenUrl && <img src={comunidad.imagenUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />}
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}><Users size={20} color={AZUL} /> {comunidad.nombre}</h2>
                        {comunidad.descripcion && <p style={{ margin: '4px 0 0', color: '#7f8c8d', fontSize: '0.86rem' }}>{comunidad.descripcion}</p>}
                        <div style={{ marginTop: 6, fontSize: '0.76rem', color: '#95a5a6' }}>{comunidad.miembros?.length || 1} miembros{comunidad.webUrl && <> · <a href={comunidad.webUrl} target="_blank" rel="noreferrer" style={{ color: AZUL }}>web</a></>}</div>
                    </div>
                    {!esCreador ? (
                        <button onClick={onSalir} style={{ ...st.btnSec, color: '#e74c3c', borderColor: '#f3c9c4' }}><LogOut size={15} /> Salir</button>
                    ) : confirmarBorrarCom ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '0.76rem', color: '#e74c3c', fontWeight: 600 }}>¿Eliminar toda la comunidad?</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={eliminarComunidad} disabled={borrandoCom} style={{ ...st.btnSec, background: '#e74c3c', color: 'white', borderColor: '#e74c3c' }}>
                                    {borrandoCom ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Eliminando…</> : <><Trash2 size={14} /> Sí, eliminar</>}
                                </button>
                                <button onClick={() => setConfirmarBorrarCom(false)} disabled={borrandoCom} style={st.btnSec}>Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setConfirmarBorrarCom(true)} style={{ ...st.btnSec, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={15} /> Eliminar</button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e0e4f0' }}>
                {[['cursos', '📚 Cursos'], ['calendario', '📅 Calendario'], ['mensajes', '💬 Mensajes'], ['miembros', '👤 Miembros']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setTab(id)} style={{ ...st.tabBtn, color: tab === id ? AZUL : '#7f8c8d', borderBottom: tab === id ? `3px solid ${AZUL}` : '3px solid transparent', fontWeight: tab === id ? 700 : 500 }}>{lbl}</button>
                ))}
            </div>

            {aviso && <div style={{ ...st.error, marginBottom: 12 }}>{aviso}</div>}

            {tab === 'grupos' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} /> Solo se comparten nombres de alumnos, nunca notas.</div>
                        <button onClick={() => setModalCompartir(true)} style={st.btnPrimary}><Share2 size={15} /> Compartir grupo</button>
                    </div>
                    {cargando ? <div style={st.loader}><RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
                        : compartidos.length === 0 ? <div style={st.vacio}>Todavía no hay grupos compartidos.</div>
                        : (
                            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                                {compartidos.map(c => {
                                    const mio = c.compartidoPor === usuario.uid;
                                    return (
                                        <div key={c.id} style={st.tarjetaGrupo}>
                                            <div style={{ fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} color={AZUL} /> {c.nombre}</div>
                                            <div style={{ fontSize: '0.76rem', color: '#95a5a6' }}>{c.alumnos?.length || 0} alumnos · por {mio ? 'ti' : c.compartidoPorNombre}</div>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
                                                <button onClick={() => setViendo(c)} style={st.miniBtn}><Eye size={13} /> Ver</button>
                                                <button onClick={() => copiarAMisGrupos(c)} disabled={copiando === c.id} style={{ ...st.miniBtn, color: copiadoOk === c.id ? '#27ae60' : AZUL, borderColor: copiadoOk === c.id ? '#27ae60' : '#cdd6ea' }}>
                                                    {copiadoOk === c.id ? <><CheckCircle size={13} /> Copiado</> : copiando === c.id ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><Copy size={13} /> Copiar</>}
                                                </button>
                                                {(mio || esCreador) && <button onClick={() => borrarCompartido(c)} disabled={borrando === c.id} style={{ ...st.miniBtn, color: '#e74c3c', borderColor: '#f3c9c4' }}><Trash2 size={13} /></button>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                </div>
            )}

            {tab === 'cursos' && <CursosPanel usuario={usuario} comunidad={comunidad} />}
            {tab === 'calendario' && <PanelCalendarios usuario={usuario} comunidad={comunidad} />}
            {tab === 'mensajes' && <PanelMensajes usuario={usuario} comunidad={comunidad} />}
            {tab === 'miembros' && <PanelMiembros usuario={usuario} comunidad={comunidad} onCambio={onCambio} />}

            {modalCompartir && <ModalCompartirGrupo usuario={usuario} comunidad={comunidad} onClose={() => setModalCompartir(false)} onCompartido={() => setModalCompartir(false)} />}
            {viendo && <ModalVerGrupo compartido={viendo} onClose={() => setViendo(null)} />}
            <style>{spin}</style>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComunidadesTab({ usuario }) {
    const [comunidades, setComunidades] = useState([]);
    const [cargando, setCargando]       = useState(true);
    const [busqueda, setBusqueda]       = useState('');
    const [modalCrear, setModalCrear]   = useState(false);
    const [abierta, setAbierta]         = useState(null);   // { id, publica }
    const [error, setError]             = useState('');

    const cargar = useCallback(async () => {
        setCargando(true); setError('');
        try {
            const snap = await getDocs(collection(db, 'comunidades'));
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
            setComunidades(docs);
        } catch (e) { setError('No se pudieron cargar las comunidades: ' + e.message); }
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const esMiembro = (c) => (c.miembros || []).includes(usuario.uid);

    const salir = async (c) => {
        try {
            await updateDoc(doc(db, 'comunidades', c.id), { miembros: arrayRemove(usuario.uid) });
            setAbierta(null); cargar();
        } catch (e) { setError('No se pudo salir: ' + e.message); }
    };

    if (abierta) {
        const viva = comunidades.find(c => c.id === abierta.id);
        if (viva && esMiembro(viva)) {
            return <DetalleComunidad usuario={usuario} comunidad={viva} onBack={() => setAbierta(null)} onSalir={() => salir(viva)} onCambio={() => cargar()} />;
        }
        if (viva) {
            return <VistaPublicaComunidad usuario={usuario} comunidad={viva} onBack={() => setAbierta(null)} onCambio={() => cargar()} />;
        }
    }

    const filtro = norm(busqueda);
    const filtradas = comunidades.filter(c => !filtro || norm(c.nombre).includes(filtro) || norm(c.descripcion).includes(filtro));
    const mias  = filtradas.filter(esMiembro);
    const otras = filtradas.filter(c => !esMiembro(c));

    const Tarjeta = ({ c, mine }) => (
        <div style={st.card}>
            {c.imagenUrl && <img src={c.imagenUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10, marginBottom: 4 }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={19} color={AZUL} />
                <div style={{ fontWeight: 700, color: '#2c3e50', flex: 1 }}>{c.nombre}</div>
                {mine ? <span style={st.chipMine}><CheckCircle size={12} /> Miembro</span> : <span style={st.chipPub}><Globe size={12} /> Pública</span>}
            </div>
            {c.descripcion && <p style={{ margin: 0, color: '#7f8c8d', fontSize: '0.83rem', minHeight: 18 }}>{c.descripcion}</p>}
            <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{c.creadorNombre} · {c.miembros?.length || 1} miembros</div>
            <button onClick={() => setAbierta({ id: c.id })} style={{ ...(mine ? st.btnPrimary : st.btnSec), width: '100%', justifyContent: 'center', marginTop: 4, ...(mine ? {} : { color: AZUL, borderColor: '#cdd6ea' }) }}>
                {mine ? <><Eye size={15} /> Entrar</> : <><Search size={15} /> Ver</>}
            </button>
        </div>
    );

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                <h2 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 10 }}><Users size={28} color={AZUL} /> Comunidades</h2>
                <div style={{ flex: 1 }} />
                <div style={{ position: 'relative' }}>
                    <Search size={15} color="#95a5a6" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar comunidad…" style={{ ...st.input, marginBottom: 0, paddingLeft: 32, width: 220 }} />
                </div>
                <button onClick={() => setModalCrear(true)} style={st.btnPrimary}><Plus size={16} /> Crear</button>
            </div>

            <div style={{ ...st.aviso, marginBottom: 18 }}>
                <Lock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                Comparte <strong>grupos de alumnos</strong> (solo nombres) y mensajes con otros profesores. El contenido solo es visible para los <strong>miembros</strong>; para entrar hay que pedir acceso o ser invitado.
            </div>

            {error && <div style={{ ...st.error, marginBottom: 12 }}>{error}</div>}

            {cargando ? <div style={st.loader}><RefreshCw size={26} style={{ animation: 'spin 1s linear infinite' }} /></div> : (
                <>
                    <h3 style={st.h3}>Mis comunidades</h3>
                    {mias.length === 0 ? <div style={st.vacioMini}>No perteneces a ninguna comunidad. Únete a una o crea la tuya.</div>
                        : <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginBottom: 24 }}>{mias.map(c => <Tarjeta key={c.id} c={c} mine />)}</div>}

                    <h3 style={st.h3}>Explorar comunidades</h3>
                    {otras.length === 0 ? <div style={st.vacioMini}>No hay más comunidades.</div>
                        : <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>{otras.map(c => <Tarjeta key={c.id} c={c} mine={false} />)}</div>}
                </>
            )}

            {modalCrear && <ModalCrearComunidad usuario={usuario} onClose={() => setModalCrear(false)} onCreada={() => { setModalCrear(false); cargar(); }} />}
            <style>{spin}</style>
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const spin = `@keyframes spin{100%{transform:rotate(360deg)}}`;
const st = {
    overlay:    { position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel:      { background: 'white', borderRadius: 20, width: '100%', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
    header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    hTitle:     { fontWeight: 700, color: '#2c3e50', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 },
    closeBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', padding: 4, flexShrink: 0 },
    label:      { fontSize: '0.78rem', fontWeight: 700, color: '#7f8c8d', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, marginTop: 4 },
    input:      { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e4f0', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12 },
    grupoBtn:   { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e4f0', background: 'white', cursor: 'pointer', fontSize: '0.9rem' },
    error:      { color: '#e74c3c', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, background: '#fdecea', borderRadius: 8, padding: '8px 12px' },
    aviso:      { fontSize: '0.8rem', color: '#7f8c8d', background: '#f4f6f8', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8 },
    btnRow:     { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: AZUL, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' },
    btnSec:     { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1.5px solid #e0e4f0', background: 'white', color: '#7f8c8d', fontWeight: 600, cursor: 'pointer', fontSize: '0.86rem' },
    backBtn:    { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: AZUL, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginBottom: 14, padding: 0 },
    miniBtn:    { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 7, border: '1.5px solid #cdd6ea', background: 'white', color: '#555', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 },
    tabBtn:     { padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem', marginBottom: -2 },
    chipMine:   { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', background: '#e8f5e9', color: '#27ae60', padding: '2px 7px', borderRadius: 8, fontWeight: 700 },
    chipPub:    { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', background: '#e8f0fe', color: AZUL, padding: '2px 7px', borderRadius: 8, fontWeight: 700 },
    chipPend:   { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', background: '#fff8e1', color: '#b8860b', padding: '7px 12px', borderRadius: 9, fontWeight: 600 },
    chipLink:   { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', background: '#e8f0fe', color: AZUL, padding: '6px 12px', borderRadius: 20, textDecoration: 'none', fontWeight: 600 },
    recCard:    { display: 'block', background: 'white', borderRadius: 10, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none' },
    card:       { background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8 },
    tarjetaGrupo:{ background: 'white', borderRadius: 12, padding: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8 },
    filaMiembro:{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid #f0f0f0' },
    h3:         { color: '#2c3e50', fontSize: '1rem', margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: 6 },
    loader:     { textAlign: 'center', padding: 30, color: '#95a5a6' },
    vacio:      { textAlign: 'center', padding: 30, color: '#bdc3c7', fontSize: '0.9rem', background: 'white', borderRadius: 12 },
    vacioMini:  { color: '#bdc3c7', fontSize: '0.88rem', marginBottom: 16 },
    menuItemEv: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f3f3f3', cursor: 'pointer', fontSize: '0.82rem', color: '#2c3e50', textAlign: 'left' },
};
