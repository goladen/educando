import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
    Users, ArrowLeft, ChevronLeft, Share2, Globe, ExternalLink,
    RefreshCw, GraduationCap, Calendar, Lock, LayoutGrid, FileText,
    UserPlus, Check, Clock, LogIn
} from 'lucide-react';
import { Calendario, EscaparateMiembros, HorarioView } from './ComunidadesTab';

const AZUL = '#1565C0';

function useIsMobile() {
    const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const on = () => setM(window.innerWidth < 640);
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    return m;
}

// Compartir con Web Share API o copiar al portapapeles
async function compartir(titulo, url) {
    try { if (navigator.share) { await navigator.share({ title: titulo, url }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(url); alert('Enlace copiado:\n' + url); }
    catch { window.prompt('Copia el enlace:', url); }
}

function BtnCompartir({ titulo, url, full }) {
    return (
        <button onClick={() => compartir(titulo, url)} title="Compartir enlace"
            style={{ display: full ? 'flex' : 'inline-flex', width: full ? '100%' : undefined, justifyContent: 'center', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #cdd6ea', background: 'white', color: AZUL, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Share2 size={14} /> Compartir
        </button>
    );
}

// Interpreta la URL → { comId, tab, cursoId, unirse }
function parsePath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'comunidad' && parts[1]) {
        const comId = parts[1];
        if (parts[2] === 'curso') return { comId, tab: 'calendarios', cursoId: parts[3] || null, unirse: false };
        if (parts[2] === 'unirse') return { comId, tab: 'recursos', cursoId: null, unirse: true };
        const tab = ['recursos', 'paginas', 'calendarios'].includes(parts[2]) ? parts[2] : 'recursos';
        return { comId, tab, cursoId: null, unirse: false };
    }
    return { comId: null, tab: 'recursos', cursoId: null, unirse: false };
}

// ─── Sección: solicitar unirse (con login si hace falta) ──────────────────────
function SolicitarUnirse({ comunidad, destacado }) {
    const [user, setUser]   = useState(auth.currentUser);
    const [estado, setEstado] = useState('idle'); // idle | enviando | enviada
    const [error, setError] = useState('');

    useEffect(() => auth.onAuthStateChanged(setUser), []);

    const yaMiembro = user && (comunidad.miembros || []).includes(user.uid);

    // Si ya hay una solicitud previa, mostrarlo
    useEffect(() => {
        if (!user || yaMiembro) return;
        getDoc(doc(db, 'comunidades', comunidad.id, 'solicitudes', user.uid))
            .then(s => { if (s.exists()) setEstado('enviada'); }).catch(() => {});
    }, [user, yaMiembro, comunidad.id]);

    const solicitar = async () => {
        setError(''); setEstado('enviando');
        let u = auth.currentUser;
        if (!u) {
            try { const r = await signInWithPopup(auth, new GoogleAuthProvider()); u = r.user; }
            catch { setEstado('idle'); return; }
        }
        try {
            await setDoc(doc(db, 'comunidades', comunidad.id, 'solicitudes', u.uid), {
                uid: u.uid,
                nombre: u.displayName || 'Profesor/a',
                email: u.email || '',
                fecha: serverTimestamp(),
            });
            setEstado('enviada');
        } catch (e) { setError('No se pudo enviar: ' + e.message); setEstado('idle'); }
    };

    if (yaMiembro) return (
        <div style={{ ...st.joinBox, background: '#e8f5e9', borderColor: '#b6e2c1' }}>
            <Check size={18} color="#27ae60" /> <span style={{ color: '#1e8449', fontWeight: 600 }}>Ya eres miembro de esta comunidad.</span>
        </div>
    );

    if (estado === 'enviada') return (
        <div style={{ ...st.joinBox, background: '#fff8e1', borderColor: '#ffe082' }}>
            <Clock size={18} color="#b8860b" /> <span style={{ color: '#8a6d00', fontWeight: 600 }}>Solicitud enviada. El creador de la comunidad la revisará.</span>
        </div>
    );

    return (
        <div style={{ ...st.joinBox, background: destacado ? '#eaf1fb' : 'white', borderColor: destacado ? AZUL : '#e0e4f0', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            {destacado && <div style={{ fontWeight: 800, color: AZUL, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={18} /> Te han invitado a unirte a {comunidad.nombre}</div>}
            <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                {user ? 'Solicita acceso; el creador aprobará tu entrada.' : 'Inicia sesión con Google para darte de alta y solicitar acceso. El creador aprobará tu entrada.'}
            </div>
            <button onClick={solicitar} disabled={estado === 'enviando'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: 'none', background: AZUL, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.92rem' }}>
                {estado === 'enviando' ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</>
                    : user ? <><UserPlus size={16} /> Solicitar unirme</>
                    : <><LogIn size={16} /> Entrar con Google y solicitar unirme</>}
            </button>
            {error && <div style={{ color: '#e74c3c', fontSize: '0.82rem' }}>{error}</div>}
        </div>
    );
}

const TABS = [
    { id: 'recursos',    label: 'Recursos',    icon: LayoutGrid },
    { id: 'paginas',     label: 'Páginas',     icon: FileText },
    { id: 'calendarios', label: 'Calendarios', icon: Calendar },
];

// ─── Vista de un centro/comunidad ─────────────────────────────────────────────
function CentroPublico({ comunidadId, tab, cursoFoco, unirse, onTab, onCurso, onVolver, origin, isMobile }) {
    const [comunidad, setComunidad] = useState(null);
    const [cursos, setCursos]       = useState([]);
    const [cargando, setCargando]   = useState(true);
    const [error, setError]         = useState('');

    useEffect(() => {
        (async () => {
            setCargando(true); setError('');
            try {
                const s = await getDoc(doc(db, 'comunidades', comunidadId));
                if (!s.exists()) { setError('Esta comunidad no existe.'); setCargando(false); return; }
                setComunidad({ id: s.id, ...s.data() });
                const cs = await getDocs(collection(db, 'comunidades', comunidadId, 'cursos'));
                const docs = cs.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.oculto || (c.horario && !c.horarioOculto));
                docs.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
                setCursos(docs);
            } catch (e) { setError('No se pudo cargar: ' + e.message); }
            setCargando(false);
        })();
    }, [comunidadId]);

    if (cargando) return <div style={st.loader}><RefreshCw size={26} style={{ animation: 'spin 1s linear infinite' }} /></div>;
    if (error) return <div style={{ padding: 20 }}><button onClick={onVolver} style={st.backBtn}><ChevronLeft size={16} /> Comunidades</button><div style={st.aviso}>{error}</div></div>;

    const cursosMostrar = cursoFoco ? cursos.filter(c => c.id === cursoFoco) : cursos;

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '0 2px 40px' : '0 4px 40px' }}>
            <button onClick={onVolver} style={st.backBtn}><ChevronLeft size={16} /> Todas las comunidades</button>

            {/* Cabecera del centro */}
            <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                {comunidad.imagenUrl && <img src={comunidad.imagenUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: isMobile ? 110 : 160, objectFit: 'cover' }} />}
                <div style={{ padding: isMobile ? '14px 14px' : '18px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Users size={24} color={AZUL} />
                        <h1 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.5rem', color: '#2c3e50', flex: 1, minWidth: 120 }}>{comunidad.nombre}</h1>
                        <BtnCompartir titulo={comunidad.nombre} url={`${origin}/comunidad/${comunidad.id}`} />
                    </div>
                    {comunidad.descripcion && <p style={{ margin: '8px 0 0', color: '#7f8c8d' }}>{comunidad.descripcion}</p>}
                    <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#95a5a6', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{comunidad.creadorNombre}</span>
                        {comunidad.webUrl && <a href={comunidad.webUrl} target="_blank" rel="noreferrer" style={{ color: AZUL, display: 'flex', alignItems: 'center', gap: 3 }}><ExternalLink size={12} /> Web del centro</a>}
                    </div>
                </div>
            </div>

            {/* Solicitar unirse (enlace de invitación) */}
            <div style={{ marginBottom: 16 }}>
                <SolicitarUnirse comunidad={comunidad} destacado={unirse} />
            </div>

            {/* Menú de pestañas */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '2px solid #dfe6f2' }}>
                {TABS.map(t => {
                    const Ico = t.icon;
                    const activo = tab === t.id;
                    return (
                        <button key={t.id} onClick={() => onTab(t.id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, padding: isMobile ? '9px 4px' : '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: isMobile ? '0.82rem' : '0.92rem', marginBottom: -2, color: activo ? AZUL : '#7f8c8d', borderBottom: activo ? `3px solid ${AZUL}` : '3px solid transparent', fontWeight: activo ? 700 : 500, whiteSpace: 'nowrap' }}>
                            <Ico size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Contenido según pestaña */}
            {(tab === 'recursos' || tab === 'paginas') && (
                <EscaparateMiembros comunidad={comunidad} soloSeccion={tab} />
            )}

            {tab === 'calendarios' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <h2 style={{ ...st.h2, margin: 0 }}><Calendar size={20} /> Calendarios</h2>
                        {cursos.length > 0 && (
                            <select value={cursoFoco || 'todos'}
                                onChange={e => e.target.value === 'todos' ? onTab('calendarios') : onCurso(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: 9, border: '1.5px solid #cdd6ea', fontSize: '0.88rem', background: 'white', color: '#2c3e50', cursor: 'pointer', fontWeight: 600 }}>
                                <option value="todos">Todos los grupos</option>
                                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}
                        <div style={{ marginLeft: 'auto' }}>
                            <BtnCompartir titulo={cursoFoco ? `Calendario de ${cursos.find(c => c.id === cursoFoco)?.nombre || ''}` : `Calendarios de ${comunidad.nombre}`} url={cursoFoco ? `${origin}/comunidad/${comunidad.id}/curso/${cursoFoco}` : `${origin}/comunidad/${comunidad.id}/calendarios`} />
                        </div>
                    </div>

                    {cursosMostrar.length === 0 ? (
                        <div style={st.vacio}>Este centro todavía no tiene grupos con calendario.</div>
                    ) : cursosMostrar.map(c => (
                        <div key={c.id} style={{ background: 'white', borderRadius: 14, padding: isMobile ? 8 : 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                <GraduationCap size={20} color={AZUL} />
                                <h3 style={{ margin: 0, color: '#2c3e50', flex: 1, cursor: 'pointer' }} onClick={() => onCurso(c.id)}>{c.nombre}</h3>
                                <BtnCompartir titulo={`Calendario de ${c.nombre}`} url={`${origin}/comunidad/${comunidad.id}/curso/${c.id}`} />
                            </div>
                            {!c.oculto && <Calendario usuario={{}} comunidad={comunidad} cursoId={c.id} cursoNombre={c.nombre} puedeEditar={false} sinFinde={!!c.sinFinde} acento={c.color} />}
                            {c.horario && !c.horarioOculto && (
                                <div style={{ marginTop: c.oculto ? 0 : 14 }}>
                                    <h4 style={{ margin: '0 0 8px', color: '#2c3e50', fontSize: '0.92rem' }}>🕐 Horario</h4>
                                    <HorarioView horario={c.horario} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ ...st.aviso, margin: '18px 0 0' }}>
                <Lock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                Los listados de alumnos, planos y mensajes solo son visibles para los profesores miembros de la comunidad.
            </div>
            <style>{spin}</style>
        </div>
    );
}

// ─── Lista de comunidades ─────────────────────────────────────────────────────
function ListaComunidades({ onAbrir, origin, isMobile }) {
    const [comunidades, setComunidades] = useState([]);
    const [cargando, setCargando]       = useState(true);

    useEffect(() => {
        getDocs(collection(db, 'comunidades'))
            .then(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
                setComunidades(docs);
            })
            .catch(() => {})
            .finally(() => setCargando(false));
    }, []);

    if (cargando) return <div style={st.loader}><RefreshCw size={26} style={{ animation: 'spin 1s linear infinite' }} /></div>;

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 4px 40px' }}>
            <div style={{ ...st.aviso, marginBottom: 20 }}>
                <Users size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                Comunidades de centros educativos. Puedes ver sus recursos, páginas y calendarios de grupos sin registrarte.
            </div>
            {comunidades.length === 0 ? <div style={st.vacio}>Todavía no hay comunidades públicas.</div> : (
                <div style={{ display: 'grid', gap: isMobile ? 10 : 14, gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 240}px, 1fr))` }}>
                    {comunidades.map(c => (
                        <div key={c.id} style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {c.imagenUrl && <img src={c.imagenUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: 90, objectFit: 'cover' }} />}
                            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Users size={18} color={AZUL} />
                                    <div style={{ fontWeight: 700, color: '#2c3e50', flex: 1 }}>{c.nombre}</div>
                                </div>
                                {c.descripcion && <p style={{ margin: 0, color: '#7f8c8d', fontSize: '0.82rem', minHeight: 18 }}>{c.descripcion}</p>}
                                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
                                    <button onClick={() => onAbrir(c.id)} style={{ ...st.btnPrimary, ...(isMobile ? { width: '100%' } : { flex: 1 }), justifyContent: 'center' }}>Ver centro</button>
                                    <BtnCompartir titulo={c.nombre} url={`${origin}/comunidad/${c.id}`} full={isMobile} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <style>{spin}</style>
        </div>
    );
}

// ─── Componente público principal ─────────────────────────────────────────────
export default function ComunidadesPublico({ onExit }) {
    const origin = window.location.origin;
    const isMobile = useIsMobile();
    const [estado, setEstado] = useState(parsePath); // { comId, tab, cursoId }

    // Sincroniza con navegación atrás/adelante del navegador
    useEffect(() => {
        const onPop = () => setEstado(parsePath());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const abrir       = (id) => { setEstado({ comId: id, tab: 'recursos', cursoId: null }); window.history.pushState({}, '', `/comunidad/${id}`); };
    const cambiarTab  = (t)  => { setEstado(e => ({ ...e, tab: t, cursoId: null })); window.history.pushState({}, '', `/comunidad/${estado.comId}/${t}`); };
    const verCurso    = (cid)=> { setEstado(e => ({ ...e, tab: 'calendarios', cursoId: cid })); window.history.pushState({}, '', `/comunidad/${estado.comId}/curso/${cid}`); };
    const volverLista = ()   => { setEstado({ comId: null, tab: 'recursos', cursoId: null }); window.history.pushState({}, '', '/comunidades'); };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eaf1fb,#f5f8fc)', paddingTop: 60 }}>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', zIndex: 100 }}>
                <button onClick={() => onExit()} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: AZUL, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                    <ArrowLeft size={18} /> Inicio
                </button>
                <div style={{ fontWeight: 800, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}><Users size={20} color={AZUL} /> Comunidades</div>
            </div>
            <div style={{ padding: isMobile ? '12px 6px' : '16px 12px' }}>
                {estado.comId
                    ? <CentroPublico comunidadId={estado.comId} tab={estado.tab} cursoFoco={estado.cursoId} unirse={estado.unirse} onTab={cambiarTab} onCurso={verCurso} onVolver={volverLista} origin={origin} isMobile={isMobile} />
                    : <ListaComunidades onAbrir={abrir} origin={origin} isMobile={isMobile} />}
            </div>
        </div>
    );
}

const spin = `@keyframes spin{100%{transform:rotate(360deg)}}`;
const st = {
    loader:     { textAlign: 'center', padding: 50, color: '#95a5a6' },
    aviso:      { fontSize: '0.85rem', color: '#7f8c8d', background: '#eef4fb', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 8 },
    vacio:      { textAlign: 'center', padding: 30, color: '#bdc3c7', fontSize: '0.9rem', background: 'white', borderRadius: 12, marginBottom: 16 },
    backBtn:    { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: AZUL, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', margin: '4px 0 14px', padding: 0 },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: AZUL, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
    h2:         { color: '#2c3e50', fontSize: '1.15rem', margin: '10px 0 12px', display: 'flex', alignItems: 'center', gap: 8 },
    joinBox:    { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e0e4f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
};
