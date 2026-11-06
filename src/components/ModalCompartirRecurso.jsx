// ─────────────────────────────────────────────────────────────────────────────
//  ModalCompartirRecurso
//  Botón «Compartir» de las tarjetas de «Mis recursos» (ProfesorDashboard):
//    · Enlace para jugar (/?r=ID) y código de acceso (lo de siempre).
//    · Compartir con un compañero: sugerencias = miembros de mis comunidades,
//      o un correo de pikt.es escrito a mano.
//
//  Datos en el propio recurso (resources/{id}):
//    compartidoCon:  [uid]                         ← se consulta con array-contains
//    compartidoInfo: { uid: { nombre, email, fecha, porUid, porNombre } }
//  Quien lo recibe lo ve en sus «Mis recursos» (mismo juego), puede editar el
//  original o hacerse una copia. El dueño (profesorUid) no cambia al editar.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteField,
} from 'firebase/firestore';
import { X, Copy, Check, UserPlus, Trash2, Link2, Key, Users } from 'lucide-react';

const esEmail = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);

// Miembros de todas mis comunidades (sin mí), con nombre y correo
async function cargarCompaneros(miUid) {
    const snap = await getDocs(query(collection(db, 'comunidades'), where('miembros', 'array-contains', miUid)));
    const mapa = {};
    snap.docs.forEach(d => {
        const c = d.data();
        (c.miembros || []).filter(u => u !== miUid).forEach(u => {
            (mapa[u] = mapa[u] || { uid: u, comunidades: [] }).comunidades.push(c.nombre || 'Comunidad');
        });
    });
    const lista = Object.values(mapa);
    await Promise.all(lista.map(async p => {
        try {
            const s = await getDoc(doc(db, 'users', p.uid));
            const u = s.data() || {};
            p.nombre = u.displayName || u.nombre || 'Profesor/a';
            p.email = u.email || '';
        } catch (_) { p.nombre = 'Profesor/a'; p.email = ''; }
    }));
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function buscarPorEmail(texto) {
    const e = texto.trim().toLowerCase();
    let snap = await getDocs(query(collection(db, 'users'), where('email', '==', e)));
    if (snap.empty && e !== texto.trim()) snap = await getDocs(query(collection(db, 'users'), where('email', '==', texto.trim())));
    if (snap.empty) return null;
    const d = snap.docs[0];
    const u = d.data() || {};
    return { uid: d.id, nombre: u.displayName || u.nombre || e, email: u.email || e };
}

export default function ModalCompartirRecurso({ recurso, usuario, perfil, onClose, onCambio }) {
    const [compartidoCon, setCompartidoCon] = useState(recurso.compartidoCon || []);
    const [info, setInfo] = useState(recurso.compartidoInfo || {});
    const [companeros, setCompaneros] = useState(null);
    const [texto, setTexto] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [msg, setMsg] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [copiado, setCopiado] = useState('');

    const enlace = `${window.location.origin}/?r=${recurso.id}`;

    useEffect(() => {
        cargarCompaneros(usuario.uid).then(setCompaneros).catch(() => setCompaneros([]));
    }, [usuario.uid]);

    const t = texto.trim().toLowerCase();
    const sugerencias = useMemo(() => (companeros || [])
        .filter(p => !compartidoCon.includes(p.uid))
        .filter(p => !t || p.nombre.toLowerCase().includes(t) || (p.email || '').toLowerCase().includes(t)),
    [companeros, compartidoCon, t]);

    const copiar = (valor, clave) => {
        navigator.clipboard?.writeText(valor).then(() => {
            setCopiado(clave);
            setTimeout(() => setCopiado(''), 1800);
        }).catch(() => {});
    };

    const compartir = async (persona) => {
        if (!persona?.uid) return;
        if (persona.uid === usuario.uid) { setMsg('❌ Ese eres tú: el recurso ya es tuyo.'); return; }
        if (compartidoCon.includes(persona.uid)) { setMsg(`Ya lo compartes con ${persona.nombre}.`); return; }
        setOcupado(true); setMsg('');
        const datos = {
            nombre: persona.nombre || '',
            email: persona.email || '',
            fecha: Date.now(),
            porUid: usuario.uid,
            porNombre: perfil?.nombre || usuario.displayName || 'Profesor/a',
        };
        try {
            await updateDoc(doc(db, 'resources', recurso.id), {
                compartidoCon: arrayUnion(persona.uid),
                [`compartidoInfo.${persona.uid}`]: datos,
            });
            const nuevoCon = [...compartidoCon, persona.uid];
            const nuevoInfo = { ...info, [persona.uid]: datos };
            setCompartidoCon(nuevoCon); setInfo(nuevoInfo);
            onCambio?.({ compartidoCon: nuevoCon, compartidoInfo: nuevoInfo });
            setMsg(`✅ Compartido con ${persona.nombre}. Lo verá en sus recursos y en su campanita 🔔.`);
            setTexto(''); setAbierto(false);
        } catch (e) {
            setMsg('❌ No se pudo compartir: ' + e.message);
        }
        setOcupado(false);
    };

    const compartirTexto = async () => {
        const v = texto.trim();
        if (!v) return;
        // Si coincide exactamente con una sugerencia, esa
        const exacta = sugerencias.find(p => p.email.toLowerCase() === t || p.nombre.toLowerCase() === t);
        if (exacta) return compartir(exacta);
        if (sugerencias.length === 1 && !esEmail(v)) return compartir(sugerencias[0]);
        if (!esEmail(v)) { setMsg('Elige un compañero de la lista o escribe su correo completo.'); return; }
        setOcupado(true); setMsg('');
        try {
            const u = await buscarPorEmail(v);
            setOcupado(false);
            if (!u) { setMsg('❌ No hay ningún usuario de pikt.es con ese correo.'); return; }
            compartir(u);
        } catch (e) { setOcupado(false); setMsg('❌ ' + e.message); }
    };

    const dejarDeCompartir = async (uid) => {
        const nombre = info[uid]?.nombre || 'esta persona';
        if (!confirm(`¿Dejar de compartir «${recurso.titulo}» con ${nombre}?`)) return;
        try {
            await updateDoc(doc(db, 'resources', recurso.id), {
                compartidoCon: arrayRemove(uid),
                [`compartidoInfo.${uid}`]: deleteField(),
            });
            const nuevoCon = compartidoCon.filter(u => u !== uid);
            const nuevoInfo = { ...info }; delete nuevoInfo[uid];
            setCompartidoCon(nuevoCon); setInfo(nuevoInfo);
            onCambio?.({ compartidoCon: nuevoCon, compartidoInfo: nuevoInfo });
        } catch (e) { alert('No se pudo quitar: ' + e.message); }
    };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.modal} onClick={e => e.stopPropagation()}>
                <div style={st.header}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Compartir</div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recurso.titulo}</div>
                    </div>
                    <button onClick={onClose} style={st.cerrar} title="Cerrar"><X size={20} /></button>
                </div>

                <div style={st.cuerpo}>
                    {/* ── Lo de siempre: enlace y código ── */}
                    <div style={st.seccion}>
                        <div style={st.titSeccion}><Link2 size={16} /> Enlace para jugar</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input readOnly value={enlace} style={{ ...st.input, flex: 1, color: '#555' }} onFocus={e => e.target.select()} />
                            <button onClick={() => copiar(enlace, 'enlace')} style={st.btnSec} title="Copiar enlace">
                                {copiado === 'enlace' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                        {recurso.accessCode && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.88rem', color: '#555' }}>
                                <Key size={16} color="#FF9800" /> Código de acceso:
                                <b style={{ letterSpacing: 2, color: '#E65100', fontSize: '1rem' }}>{recurso.accessCode}</b>
                                <button onClick={() => copiar(recurso.accessCode, 'codigo')} style={{ ...st.btnSec, padding: '4px 8px' }} title="Copiar código">
                                    {copiado === 'codigo' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Compartir con un compañero ── */}
                    <div style={st.seccion}>
                        <div style={st.titSeccion}><UserPlus size={16} /> Compartir con un compañero</div>
                        <div style={{ fontSize: '0.8rem', color: '#78909c', marginBottom: 8 }}>
                            Lo verá en sus recursos, podrá editarlo y hacerse una copia. Seguirá siendo tuyo.
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    value={texto}
                                    onChange={e => { setTexto(e.target.value); setAbierto(true); setMsg(''); }}
                                    onFocus={() => setAbierto(true)}
                                    onKeyDown={e => { if (e.key === 'Enter') compartirTexto(); if (e.key === 'Escape') setAbierto(false); }}
                                    placeholder="Nombre de un miembro o correo…"
                                    style={{ ...st.input, flex: 1 }}
                                />
                                <button onClick={compartirTexto} disabled={ocupado || !texto.trim()} style={{ ...st.btnPri, opacity: ocupado || !texto.trim() ? 0.5 : 1 }}>
                                    {ocupado ? '…' : 'Compartir'}
                                </button>
                            </div>
                            {abierto && (
                                <div style={st.lista}>
                                    {companeros === null && <div style={st.vacio}>Cargando miembros de tus comunidades…</div>}
                                    {companeros !== null && sugerencias.length === 0 && (
                                        <div style={st.vacio}>
                                            {companeros.length === 0
                                                ? 'No tienes compañeros en comunidades. Escribe su correo de pikt.es.'
                                                : esEmail(texto.trim()) ? 'Pulsa «Compartir» para buscar ese correo.' : 'Ningún miembro coincide. Puedes escribir su correo.'}
                                        </div>
                                    )}
                                    {sugerencias.map(p => (
                                        <button key={p.uid} onClick={() => compartir(p)} disabled={ocupado} style={st.sugerencia}>
                                            <span style={st.avatar}>{(p.nombre || '?').charAt(0).toUpperCase()}</span>
                                            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                <span style={{ display: 'block', fontWeight: 700, color: '#263238', fontSize: '0.88rem' }}>{p.nombre}</span>
                                                <span style={{ display: 'block', color: '#90a4ae', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {[p.email, p.comunidades.join(', ')].filter(Boolean).join(' · ')}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {msg && <div style={{ marginTop: 8, fontSize: '0.84rem', color: msg.startsWith('✅') ? '#2E7D32' : '#c0392b' }}>{msg}</div>}

                        {compartidoCon.length > 0 && (
                            <div style={{ marginTop: 14 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#546e7a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Users size={14} /> Compartido con ({compartidoCon.length})
                                </div>
                                {compartidoCon.map(uid => (
                                    <div key={uid} style={st.fila}>
                                        <span style={st.avatar}>{(info[uid]?.nombre || '?').charAt(0).toUpperCase()}</span>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem' }}>{info[uid]?.nombre || 'Profesor/a'}</span>
                                            {info[uid]?.email && <span style={{ display: 'block', color: '#90a4ae', fontSize: '0.74rem' }}>{info[uid].email}</span>}
                                        </span>
                                        <button onClick={() => dejarDeCompartir(uid)} style={{ ...st.btnSec, color: '#C62828', borderColor: '#f5c6c6' }} title="Dejar de compartir">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const st = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' },
    header: { background: 'linear-gradient(135deg,#1565C0,#6D28D9)', color: 'white', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    cerrar: { background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' },
    cuerpo: { padding: 18, overflowY: 'auto' },
    seccion: { marginBottom: 18 },
    titSeccion: { fontWeight: 800, color: '#1565C0', fontSize: '0.92rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
    input: { padding: '9px 11px', borderRadius: 9, border: '1.5px solid #d9e2ec', fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', minWidth: 0 },
    btnPri: { background: '#1565C0', color: 'white', border: 'none', borderRadius: 9, padding: '0 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' },
    btnSec: { background: 'white', color: '#1565C0', border: '1.5px solid #cfe0f5', borderRadius: 9, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    lista: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #d9e2ec', borderRadius: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto', zIndex: 5 },
    vacio: { padding: '12px 14px', color: '#90a4ae', fontSize: '0.84rem' },
    sugerencia: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'white', border: 'none', borderBottom: '1px solid #f1f4f8', cursor: 'pointer', fontFamily: 'inherit' },
    avatar: { width: 30, height: 30, borderRadius: '50%', background: '#E3F2FD', color: '#1565C0', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.85rem' },
    fila: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f4f8' },
};
