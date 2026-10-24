// src/SesionEquipos.jsx
//
// Sesión de equipos como MONITORIZACIÓN EN VIVO:
//   · SesionEquipos    → crear/continuar una sesión: profesor, fecha+hora, cursos de la comunidad,
//                        equipos de alumno. Al abrirla se monitoriza (pantallas + nombres + batería)
//                        hasta cerrarla; al cerrar queda registrada con DURACIÓN.
//   · RegistroSesiones → histórico de sesiones (cerradas), con cursos, duración, alumno/obs/batería.

import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from './firebase';
import {
    collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, getDoc,
    deleteDoc, doc, setDoc, onSnapshot,
} from 'firebase/firestore';

const collForScope = (scope) => (scope === 'comunidad' ? 'aulas_comunidad' : 'aulas_fijas');
const bateriaTxt = (b) => (b == null ? '— (sobremesa)' : `${b}%`);
const bateriaColor = (b) => (b == null ? '#64748b' : b <= 20 ? '#dc2626' : b <= 50 ? '#d97706' : '#16a34a');
const dos = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
const fmtDur = (ms) => { if (ms == null) return '—'; const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h > 0 ? `${h} h ${m % 60} min` : `${m} min`; };
const fmtFecha = (ms) => { try { return new Date(ms).toLocaleString('es-ES'); } catch { return ''; } };

// ── Crear / llevar una sesión ──
export default function SesionEquipos({ scope, codigoEquipos, agentes, online, onCmd, onVivo, esGestor = false, onClose, sesionIdInicial = null }) {
    const coll = collForScope(scope);
    const [fase, setFase] = useState('cargando');   // 'cargando' | 'form' | 'abierta'
    const [regId, setRegId] = useState(sesionIdInicial);
    const [profesor, setProfesor] = useState(auth.currentUser?.displayName || '');
    const [cuando, setCuando] = useState(() => toLocalInput(new Date()));
    const [cursosLista, setCursosLista] = useState([]);
    const [cursosSel, setCursosSel] = useState(() => new Set());
    const [grupoTexto, setGrupoTexto] = useState('');     // scope personal (sin cursos)
    const [ids, setIds] = useState(() => new Set());
    const [inicioMs, setInicioMs] = useState(null);
    const [verPantallas, setVerPantallas] = useState(true);
    const [thumbs, setThumbs] = useState({});             // machineId → { data, at }
    const [datos, setDatos] = useState({});               // machineId → { alumno?, observacion? }
    const [añadir, setAñadir] = useState(false);
    const [, setTick] = useState(0);                      // refresca el contador de tiempo
    const [cerrando, setCerrando] = useState(false);

    const equipos = agentes.filter((a) => ids.has(a.id));
    const elegibles = agentes.filter((a) => (a.tipo || 'alumno') !== 'profesor');
    const fuera = elegibles.filter((a) => !ids.has(a.id));
    const idsKey = [...ids].sort().join(',');

    const alumnoDe = (a) => (datos[a.id]?.alumno !== undefined ? datos[a.id].alumno : (a.student?.name || ''));
    // Incidencias de configuración ocurridas DURANTE la sesión (desde que se abrió).
    const incsDe = (a) => (a.incidencias || []).filter((i) => i && i.at >= (inicioMs || 0));
    const setCampo = (id, campo, val) => setDatos((d) => ({ ...d, [id]: { ...d[id], [campo]: val } }));
    const pedirMensaje = () => { const t = window.prompt('Mensaje para la pantalla:'); return (t && t.trim()) ? t.trim() : null; };
    const pedirUrl = () => { const u = window.prompt('Web a abrir (https://…):', 'https://'); return (u && /^https?:\/\//i.test(u.trim())) ? u.trim() : null; };
    const miniBtn = (bg, on = true) => ({ background: bg, color: 'white', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: on ? 'pointer' : 'default', fontSize: '0.74rem', fontWeight: 700, opacity: on ? 1 : 0.45 });

    // Cargar: cursos de la comunidad + (si se continúa) los datos de la sesión abierta.
    useEffect(() => {
        let vivo = true;
        (async () => {
            if (scope === 'comunidad' && codigoEquipos) {
                try {
                    const s = await getDocs(collection(db, 'comunidades', codigoEquipos, 'cursos'));
                    if (vivo) setCursosLista(s.docs.map((d) => ({ id: d.id, nombre: d.data().nombre || 'Curso' })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
                } catch { /* sin cursos */ }
            }
            if (sesionIdInicial) {
                try {
                    const snap = await getDoc(doc(db, 'registro_equipos', sesionIdInicial));
                    if (vivo && snap.exists()) {
                        const d = snap.data();
                        setProfesor(d.profesor || '');
                        setCursosSel(new Set((d.cursos || []).map((c) => c.id)));
                        setGrupoTexto(d.grupo || '');
                        setIds(new Set(d.machineIds || []));
                        setInicioMs(d.inicioMs || d.fechaMs || Date.now());
                        setDatos(Object.fromEntries((d.equipos || []).map((e) => [e.machineId, { alumno: e.alumno || undefined, observacion: e.observacion || undefined }])));
                        setFase('abierta');
                    } else if (vivo) setFase('form');
                } catch { if (vivo) setFase('form'); }
            } else if (vivo) setFase('form');
        })();
        return () => { vivo = false; };
    }, [sesionIdInicial, scope, codigoEquipos]);

    // Contador de tiempo transcurrido (refresca cada 20 s).
    useEffect(() => {
        if (fase !== 'abierta') return;
        const t = setInterval(() => setTick((x) => x + 1), 20000);
        return () => clearInterval(t);
    }, [fase]);

    // Mientras se monitoriza: activar "ver pantallas" (flag del aula) y suscribirse a las
    // miniaturas de los equipos de la sesión. Al salir, apagar las miniaturas.
    useEffect(() => {
        if (fase !== 'abierta' || !verPantallas || !codigoEquipos) { setThumbs({}); return; }
        setDoc(doc(db, coll, codigoEquipos), { thumbs: true }, { merge: true }).catch(() => {});
        const unsubs = [...ids].map((aid) => onSnapshot(
            doc(db, coll, codigoEquipos, 'agents', aid, 'screen', 'latest'),
            (snap) => setThumbs((prev) => ({ ...prev, [aid]: snap.exists() ? snap.data() : null })),
            () => {}
        ));
        return () => {
            unsubs.forEach((u) => u());
            setDoc(doc(db, coll, codigoEquipos), { thumbs: false }, { merge: true }).catch(() => {});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, verPantallas, coll, codigoEquipos, idsKey]);

    const toggle = (id) => setIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const pedirNombres = () => equipos.filter(online).forEach((a) => onCmd(a.id, 'askName', { message: `${profesor || 'Tu profe'} te pide tu nombre para la clase` }));

    const abrir = async () => {
        if (!profesor.trim()) { alert('Pon el nombre del profesor/a.'); return; }
        if (ids.size === 0) { alert('Elige al menos un equipo.'); return; }
        const inicio = new Date(cuando).getTime() || Date.now();
        const cursos = cursosLista.filter((c) => cursosSel.has(c.id)).map((c) => ({ id: c.id, nombre: c.nombre }));
        const equiposSnap = equipos.map((a) => ({ machineId: a.id, equipo: a.name || 'Equipo', alumno: a.student?.name || null, observacion: null, bateria: a.battery ?? null }));
        try {
            const ref = await addDoc(collection(db, 'registro_equipos'), {
                scope, code: codigoEquipos || null, ownerUid: auth.currentUser?.uid || null,
                profesor: profesor.trim(),
                cursos, grupo: scope !== 'comunidad' ? (grupoTexto.trim() || null) : null,
                titulo: cursos.map((c) => c.nombre).join(', ') || grupoTexto.trim() || 'Sesión',
                estado: 'abierta',
                inicio: serverTimestamp(), inicioMs: inicio,
                fin: null, finMs: null, duracionMs: null,
                fecha: serverTimestamp(), fechaMs: inicio,
                machineIds: [...ids], equipos: equiposSnap,
            });
            setRegId(ref.id); setInicioMs(inicio); setFase('abierta');
        } catch (e) { console.error('abrir sesión', e); alert('No se pudo abrir la sesión.'); }
    };

    const cerrar = async () => {
        const sinNombre = equipos.filter((a) => !(alumnoDe(a).trim()));
        if (sinNombre.length && !window.confirm(`⚠️ ${sinNombre.length} equipo(s) sin nombre de alumno (${sinNombre.map((a) => a.name || a.id).join(', ')}).\n¿Cerrar la sesión igualmente?`)) return;
        setCerrando(true);
        const fin = Date.now();
        const equiposFinal = equipos.map((a) => ({
            machineId: a.id, equipo: a.name || 'Equipo',
            alumno: (alumnoDe(a).trim() || null),
            observacion: (datos[a.id]?.observacion?.trim() || null),
            bateria: a.battery ?? null,
            incidencias: incsDe(a).map((i) => ({ tipo: i.tipo || null, detalle: i.detalle || '', at: i.at || null, alumno: (alumnoDe(a).trim() || null) })),
        }));
        try {
            await updateDoc(doc(db, 'registro_equipos', regId), {
                estado: 'cerrada', fin: serverTimestamp(), finMs: fin,
                duracionMs: Math.max(0, fin - (inicioMs || fin)), equipos: equiposFinal,
            });
            try { await setDoc(doc(db, coll, codigoEquipos), { thumbs: false }, { merge: true }); } catch { /* nada */ }
            onClose();
        } catch (e) { console.error('cerrar sesión', e); alert('No se pudo cerrar la sesión.'); setCerrando(false); }
    };

    const filaElegible = (a, marcado) => (
        <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: marcado ? '#eef2ff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
            <input type="checkbox" checked={marcado} onChange={() => toggle(a.id)} />
            <span style={{ fontWeight: 700, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💻 {a.name || 'Equipo'}{a.ubicacion ? ` · 📍${a.ubicacion}` : ''}</span>
            <span style={{ fontSize: '0.74rem', color: bateriaColor(a.battery) }}>🔋 {bateriaTxt(a.battery)}</span>
            <span style={{ fontSize: '0.74rem' }}>{online(a) ? '🟢' : '⚫'}</span>
        </label>
    );

    const sinNombreN = fase === 'abierta' ? equipos.filter((a) => !alumnoDe(a).trim()).length : 0;

    return (
        <div onClick={fase === 'form' ? onClose : undefined} style={ov}>
            <div onClick={(e) => e.stopPropagation()} style={card}>
                <div style={headRow}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        📋 {fase === 'abierta' ? 'Sesión en curso' : 'Nueva sesión'}
                    </h3>
                    <button onClick={onClose} style={cerrarBtn}>{fase === 'abierta' ? 'Minimizar ✕' : '✕'}</button>
                </div>

                {fase === 'cargando' ? (
                    <div style={{ color: '#94a3b8', padding: 20 }}>Cargando…</div>
                ) : fase === 'form' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
                            <div>
                                <label style={lbl}>👤 Profesor/a</label>
                                <input value={profesor} onChange={(e) => setProfesor(e.target.value)} placeholder="Tu nombre" style={inp} />
                            </div>
                            <div>
                                <label style={lbl}>📅 Fecha y hora</label>
                                <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} style={inp} />
                            </div>
                        </div>

                        {scope === 'comunidad' ? (
                            <div>
                                <label style={lbl}>👥 Curso(s) de la comunidad ({cursosSel.size})</label>
                                {cursosLista.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>La comunidad no tiene cursos. (Se pueden crear en la pestaña Cursos.)</div> : (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {cursosLista.map((c) => {
                                            const on = cursosSel.has(c.id);
                                            return <button key={c.id} onClick={() => setCursosSel((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                                                style={{ ...chip, ...(on ? chipOn : {}) }}>{on ? '✓ ' : ''}{c.nombre}</button>;
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <label style={lbl}>👥 Grupo</label>
                                <input value={grupoTexto} onChange={(e) => setGrupoTexto(e.target.value)} placeholder="Ej: 2ºB" style={inp} />
                            </div>
                        )}

                        <div>
                            <label style={lbl}>💻 Equipos de alumno ({ids.size} elegidos)</label>
                            {elegibles.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No hay equipos de alumno disponibles.</div> : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px,100%),1fr))', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                                    {elegibles.map((a) => filaElegible(a, ids.has(a.id)))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={abrir} style={btn('#16a34a')}>▶ Abrir sesión y monitorizar</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.88rem', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                            <span>👤 <b>{profesor}</b></span>
                            {(cursosLista.filter((c) => cursosSel.has(c.id)).map((c) => c.nombre).join(', ') || grupoTexto) && <span>👥 <b>{cursosLista.filter((c) => cursosSel.has(c.id)).map((c) => c.nombre).join(', ') || grupoTexto}</b></span>}
                            <span>🕐 {fmtFecha(inicioMs)}</span>
                            <span style={{ color: '#16a34a', fontWeight: 800 }}>⏱️ {fmtDur(Date.now() - (inicioMs || Date.now()))} abierta</span>
                            {sinNombreN > 0 && <span style={{ color: '#b45309', fontWeight: 700 }}>⚠️ {sinNombreN} sin nombre</span>}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={pedirNombres} style={btn('#4f46e5')}>✍️ Pedir nombres</button>
                            <button onClick={() => setVerPantallas((v) => !v)} style={btn(verPantallas ? '#f59e0b' : '#64748b')}>{verPantallas ? '🙈 Ocultar pantallas' : '👁️ Ver pantallas'}</button>
                            <button onClick={() => setAñadir((v) => !v)} style={btn('#0ea5e9')}>➕ Añadir equipos</button>
                        </div>

                        {añadir && (
                            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: 10 }}>
                                {fuera.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No quedan más equipos de alumno.</div> : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px,100%),1fr))', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                                        {fuera.map((a) => filaElegible(a, false))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Rejilla de equipos: pantalla + nombre (editable) + observación + batería */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%),1fr))', gap: 10 }}>
                            {equipos.map((a) => {
                                const on = online(a);
                                const th = thumbs[a.id];
                                return (
                                    <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                                            <span style={{ fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💻 {a.name || 'Equipo'}</span>
                                            <span style={{ display: 'flex', gap: 6, fontSize: '0.75rem' }}>
                                                <span style={{ color: bateriaColor(a.battery), fontWeight: 700 }}>🔋 {a.battery == null ? '—' : a.battery + '%'}</span>
                                                <span>{on ? '🟢' : '⚫'}</span>
                                            </span>
                                        </div>
                                        {verPantallas && (
                                            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#0f172a', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
                                                {th?.data ? <img src={th.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 1 : 0.4 }} />
                                                    : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.78rem' }}>{on ? '⏳ esperando…' : 'sin señal'}</div>}
                                            </div>
                                        )}
                                        {incsDe(a).length > 0 && (
                                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '4px 7px', marginBottom: 6, fontSize: '0.74rem', color: '#991b1b' }}>
                                                {incsDe(a).slice(-3).map((i, k) => <div key={k}>🚨 {i.detalle} <span style={{ color: '#f87171' }}>({fmtFecha(i.at).split(' ').slice(-1)[0] || ''})</span></div>)}
                                            </div>
                                        )}
                                        <input value={alumnoDe(a)} onChange={(e) => setCampo(a.id, 'alumno', e.target.value)} placeholder="— nombre del alumno —"
                                            style={{ ...inpMini, marginBottom: 6, borderColor: alumnoDe(a).trim() ? '#cbd5e1' : '#fca5a5' }} />
                                        <input value={datos[a.id]?.observacion || ''} onChange={(e) => setCampo(a.id, 'observacion', e.target.value)} placeholder="observación / incidencia" style={inpMini} />
                                        {esGestor && (
                                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                                                {onVivo && <button onClick={() => onVivo(a)} disabled={!on} style={miniBtn('#e11d48', on)}>📹 En vivo</button>}
                                                {a.locked
                                                    ? <button onClick={() => onCmd(a.id, 'unlock')} disabled={!on} style={miniBtn('#16a34a', on)}>🔓</button>
                                                    : <button onClick={() => onCmd(a.id, 'lock', { message: 'Atiende a la pantalla del profesor' })} disabled={!on} style={miniBtn('#dc2626', on)}>🔒 Bloquear</button>}
                                                <button onClick={() => { const m = pedirMensaje(); if (m) onCmd(a.id, 'message', { text: m }); }} disabled={!on} style={miniBtn('#7c3aed', on)}>💬</button>
                                                <button onClick={() => { const u = pedirUrl(); if (u) onCmd(a.id, 'openUrl', { url: u }); }} disabled={!on} style={miniBtn('#0ea5e9', on)}>🌐</button>
                                                <button onClick={() => onCmd(a.id, 'reset')} disabled={!on} title="Parar órdenes" style={miniBtn('#0f766e', on)}>🧯</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Puedes cerrar esta ventana y la sesión sigue abierta; vuelve a entrar desde «Continuar sesión».</span>
                            <button onClick={cerrar} disabled={cerrando} style={btn('#dc2626')}>{cerrando ? 'Cerrando…' : '🔴 Cerrar y guardar sesión'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Histórico (sesiones cerradas) ──
export function RegistroSesiones({ scope, codigoEquipos, canGestionar = false, onClose }) {
    const [lista, setLista] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const uid = auth.currentUser?.uid;

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'registro_equipos'), where('code', '==', codigoEquipos || '')));
                const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.fechaMs || 0) - (a.fechaMs || 0));
                if (vivo) setLista(arr);
            } catch (e) { console.error('registro', e); if (vivo) setLista([]); }
        })();
        return () => { vivo = false; };
    }, [codigoEquipos]);

    const puede = (s) => canGestionar || (uid && s.ownerUid === uid);
    const borrar = async (s) => {
        if (!window.confirm(`¿Borrar la sesión "${s.titulo}"?`)) return;
        try { await deleteDoc(doc(db, 'registro_equipos', s.id)); setLista((l) => l.filter((x) => x.id !== s.id)); }
        catch (e) { console.error(e); alert('No se pudo borrar. ¿Tienes permiso?'); }
    };
    const copiarEnlace = () => {
        const url = `${window.location.origin}/?equipos_registro=${encodeURIComponent(codigoEquipos || '')}`;
        try { navigator.clipboard?.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* nada */ }
    };
    const cursosTxt = (s) => (s.cursos || []).map((c) => c.nombre).join(', ') || s.grupo || '';

    return (
        <div onClick={onClose} style={ov}>
            <div onClick={(e) => e.stopPropagation()} style={card}>
                <div style={headRow}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📚 Registro de sesiones</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {scope === 'comunidad' && codigoEquipos && <button onClick={copiarEnlace} style={cerrarBtn}>{copiado ? '✅ Copiado' : '🔗 Enlace'}</button>}
                        <button onClick={onClose} style={cerrarBtn}>✕</button>
                    </div>
                </div>
                <div style={{ marginTop: 12, maxHeight: '64vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lista === null ? <div style={{ color: '#94a3b8' }}>Cargando…</div>
                        : lista.length === 0 ? <div style={{ color: '#94a3b8' }}>Aún no hay sesiones guardadas.</div>
                        : lista.map((s) => (
                            <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', cursor: 'pointer' }} onClick={() => setAbierto(abierto === s.id ? null : s.id)}>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {cursosTxt(s) || 'Sesión'}
                                            {s.estado === 'abierta' && <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>🟢 abierta</span>}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                            {s.profesor ? `👤 ${s.profesor} · ` : ''}{fmtFecha(s.inicioMs || s.fechaMs)}{s.duracionMs != null ? ` · ⏱️ ${fmtDur(s.duracionMs)}` : ''} · {s.equipos?.length || 0} equipos
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {puede(s) && <button onClick={(e) => { e.stopPropagation(); borrar(s); }} style={{ ...btn('#fee2e2'), color: '#b91c1c', padding: '6px 10px' }}>🗑️</button>}
                                        <span style={{ color: '#64748b', fontWeight: 700 }}>{abierto === s.id ? '▲' : '▼'}</span>
                                    </div>
                                </div>
                                {abierto === s.id && (
                                    <div style={{ overflowX: 'auto', marginTop: 10 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 420 }}>
                                            <thead><tr style={{ color: '#475569', textAlign: 'left' }}><th style={th}>Equipo</th><th style={th}>Alumno</th><th style={th}>Observación</th><th style={th}>Batería</th><th style={th}>Incidencias</th></tr></thead>
                                            <tbody>
                                                {(s.equipos || []).map((e, i) => (
                                                    <tr key={i} style={{ borderTop: '1px solid #eef2f7' }}>
                                                        <td style={td}>💻 {e.equipo}</td>
                                                        <td style={{ ...td, color: e.alumno ? '#334155' : '#f87171' }}>{e.alumno || '⚠️ sin nombre'}</td>
                                                        <td style={{ ...td, color: e.observacion ? '#b45309' : '#cbd5e1' }}>{e.observacion || '—'}</td>
                                                        <td style={{ ...td, color: bateriaColor(e.bateria) }}>🔋 {bateriaTxt(e.bateria)}</td>
                                                        <td style={{ ...td, color: (e.incidencias || []).length ? '#b91c1c' : '#cbd5e1' }}>
                                                            {(e.incidencias || []).length
                                                                ? (e.incidencias || []).map((inc, k) => <div key={k}>🚨 {inc.detalle}{inc.alumno ? ` — ${inc.alumno}` : ''}{inc.at ? ` (${fmtFecha(inc.at)})` : ''}</div>)
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

// estilos
const ov = { position: 'fixed', inset: 0, zIndex: 10010, background: 'rgba(2,6,23,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const card = { background: 'white', borderRadius: 16, padding: 20, width: 'min(900px, 96vw)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' };
const headRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 };
const cerrarBtn = { background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, color: '#475569' };
const btn = (bg) => ({ background: bg, color: bg === '#fee2e2' ? '#b91c1c' : 'white', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' });
const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 5 };
const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' };
const inpMini = { width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.84rem', boxSizing: 'border-box' };
const chip = { background: 'white', border: '1px solid #cbd5e1', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, color: '#334155', fontSize: '0.85rem' };
const chipOn = { background: '#4f46e5', color: 'white', borderColor: '#4f46e5' };
const th = { padding: '8px 10px', fontWeight: 700 };
const td = { padding: '8px 10px', color: '#334155' };
