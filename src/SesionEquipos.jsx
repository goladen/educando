// src/SesionEquipos.jsx
//
// Sesión de uso de equipos.
//   · SesionEquipos    → crear una sesión (profesor, fecha auto, grupo, elegir portátiles),
//                        ver la sesión con solo esos equipos (+ añadir más), pedir nombres,
//                        ver batería en vivo y guardarla como registro de uso.
//   · RegistroSesiones → histórico de sesiones guardadas (registro_equipos).

import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';

const bateriaTxt = (b) => (b == null ? '— (sobremesa)' : `${b}%`);
const bateriaColor = (b) => (b == null ? '#64748b' : b <= 20 ? '#dc2626' : b <= 50 ? '#d97706' : '#16a34a');
const hoyStr = () => { try { return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

// ── Crear / llevar una sesión ──
export default function SesionEquipos({ scope, codigoEquipos, agentes, machineIds, online, onCmd, onClose }) {
    const [fase, setFase] = useState('form');                 // 'form' | 'activa'
    const [profesor, setProfesor] = useState(auth.currentUser?.displayName || '');
    const [grupo, setGrupo] = useState('');
    const [ids, setIds] = useState(() => new Set(machineIds || []));
    const [añadir, setAñadir] = useState(false);
    const [datos, setDatos] = useState({});   // machineId → { alumno?, observacion? } (ediciones del profe)
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);

    // Valor del alumno: lo que el profe escribió; si no tocó el campo, lo que mandó el agente.
    const alumnoDe = (a) => (datos[a.id]?.alumno !== undefined ? datos[a.id].alumno : (a.student?.name || ''));
    const setCampo = (id, campo, val) => setDatos((d) => ({ ...d, [id]: { ...d[id], [campo]: val } }));

    const fecha = useMemo(() => hoyStr(), []);
    // En una sesión solo se usan los equipos de ALUMNO (los de profesor no aparecen aquí).
    const elegibles = agentes.filter((a) => (a.tipo || 'alumno') !== 'profesor');
    const equipos = agentes.filter((a) => ids.has(a.id));
    const fuera = elegibles.filter((a) => !ids.has(a.id));    // equipos de alumno aún no añadidos
    const idsOnline = () => equipos.filter(online).map((a) => a.id);
    const toggle = (id) => setIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const pedirNombres = () => idsOnline().forEach((id) => onCmd(id, 'askName', { message: `${profesor || 'Tu profe'} te pide tu nombre para la clase` }));

    const crear = () => {
        if (!profesor.trim()) { alert('Pon el nombre del profesor/a.'); return; }
        if (ids.size === 0) { alert('Elige al menos un equipo.'); return; }
        setFase('activa');
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            await addDoc(collection(db, 'registro_equipos'), {
                scope, code: codigoEquipos || null,
                profesor: profesor.trim(),
                grupo: grupo.trim() || null,
                titulo: [grupo.trim(), profesor.trim()].filter(Boolean).join(' · ') || 'Sesión',
                fecha: serverTimestamp(), fechaMs: Date.now(),
                ownerUid: auth.currentUser?.uid || null,
                equipos: equipos.map((a) => ({
                    machineId: a.id, equipo: a.name || 'Equipo',
                    alumno: (alumnoDe(a).trim() || null),
                    observacion: (datos[a.id]?.observacion?.trim() || null),
                    bateria: a.battery ?? null,
                })),
            });
            setGuardado(true);
        } catch (e) { console.error('guardar sesión', e); alert('No se pudo guardar la sesión.'); }
        setGuardando(false);
    };

    // Fila de un equipo elegible (checklist del formulario / añadir).
    const filaElegible = (a, marcado) => (
        <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: marcado ? '#eef2ff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
            <input type="checkbox" checked={marcado} onChange={() => toggle(a.id)} />
            <span style={{ fontWeight: 700, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💻 {a.name || 'Equipo'}</span>
            <span style={{ fontSize: '0.74rem', color: bateriaColor(a.battery) }}>🔋 {bateriaTxt(a.battery)}</span>
            <span style={{ fontSize: '0.74rem' }}>{online(a) ? '🟢' : '⚫'}</span>
        </label>
    );

    return (
        <div onClick={onClose} style={ov}>
            <div onClick={(e) => e.stopPropagation()} style={card}>
                <div style={headRow}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        📋 {fase === 'form' ? 'Nueva sesión de equipos' : 'Sesión en curso'}
                    </h3>
                    <button onClick={onClose} style={cerrarBtn}>✕</button>
                </div>

                {fase === 'form' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
                            <div>
                                <label style={lbl}>👤 Profesor/a</label>
                                <input value={profesor} onChange={(e) => setProfesor(e.target.value)} placeholder="Tu nombre" style={inp} />
                            </div>
                            <div>
                                <label style={lbl}>👥 Grupo de alumnos</label>
                                <input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ej: 2ºB" style={inp} />
                            </div>
                            <div>
                                <label style={lbl}>📅 Fecha</label>
                                <div style={{ ...inp, background: '#f1f5f9', color: '#475569' }}>{fecha}</div>
                            </div>
                        </div>

                        <div>
                            <label style={lbl}>💻 Elige los equipos de alumno de esta sesión ({ids.size} elegidos)</label>
                            {elegibles.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No hay equipos de alumno disponibles. (En Configuración puedes marcar equipos como «Alumno».)</div> : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px,100%),1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                                    {elegibles.map((a) => filaElegible(a, ids.has(a.id)))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={crear} style={btn('#16a34a')}>Crear sesión →</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.88rem', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                            <span>👤 <b>{profesor}</b></span>
                            {grupo && <span>👥 <b>{grupo}</b></span>}
                            <span>📅 {fecha}</span>
                            <span>💻 {equipos.length} equipos</span>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={pedirNombres} style={btn('#4f46e5')}>✍️ Pedir nombres</button>
                            <button onClick={() => setAñadir((v) => !v)} style={btn('#0ea5e9')}>➕ Añadir equipos</button>
                        </div>

                        {añadir && (
                            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: 10 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Marca para añadir a la sesión:</div>
                                {fuera.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No quedan más equipos.</div> : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px,100%),1fr))', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                                        {fuera.map((a) => filaElegible(a, false))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 520 }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                                        <th style={th}>Equipo</th><th style={th}>Alumno</th><th style={th}>Observación / incidencia</th><th style={th}>Batería</th><th style={th}>Estado</th><th style={th}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipos.map((a) => (
                                        <tr key={a.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                            <td style={td}>💻 {a.name || 'Equipo'}</td>
                                            <td style={td}>
                                                <input value={alumnoDe(a)} onChange={(e) => setCampo(a.id, 'alumno', e.target.value)} placeholder="— nombre —" style={inpMini} />
                                            </td>
                                            <td style={td}>
                                                <input value={datos[a.id]?.observacion || ''} onChange={(e) => setCampo(a.id, 'observacion', e.target.value)} placeholder="sin incidencias" style={inpMini} />
                                            </td>
                                            <td style={{ ...td, fontWeight: 700, color: bateriaColor(a.battery) }}>🔋 {bateriaTxt(a.battery)}</td>
                                            <td style={td}>{online(a) ? '🟢' : '⚫'}</td>
                                            <td style={td}><button onClick={() => toggle(a.id)} title="Quitar de la sesión" style={{ ...cerrarBtn, padding: '2px 8px' }}>✕</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={guardar} disabled={guardando} style={btn('#16a34a')}>
                                {guardado ? '✅ Guardada' : guardando ? 'Guardando…' : '💾 Guardar sesión'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Histórico ──
// canGestionar = es el gestor (creador) de la comunidad → puede editar/borrar cualquier registro.
// El dueño de cada registro (ownerUid) también puede editarlo/borrarlo.
export function RegistroSesiones({ scope, codigoEquipos, canGestionar = false, onClose }) {
    const [lista, setLista] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [editId, setEditId] = useState(null);
    const [ed, setEd] = useState(null);           // { profesor, grupo, equipos:[...] }
    const [guardando, setGuardando] = useState(false);
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
    const fechaStr = (s) => { try { return new Date(s.fechaMs || 0).toLocaleString('es-ES'); } catch { return ''; } };

    const borrar = async (s) => {
        if (!window.confirm(`¿Borrar la sesión "${s.titulo}"?`)) return;
        try { await deleteDoc(doc(db, 'registro_equipos', s.id)); setLista((l) => l.filter((x) => x.id !== s.id)); }
        catch (e) { console.error(e); alert('No se pudo borrar. ¿Tienes permiso?'); }
    };

    const empezarEdicion = (s) => {
        setEditId(s.id); setAbierto(s.id);
        setEd({ profesor: s.profesor || '', grupo: s.grupo || '', equipos: (s.equipos || []).map((e) => ({ ...e })) });
    };
    const setEq = (i, campo, val) => setEd((e) => { const eq = e.equipos.slice(); eq[i] = { ...eq[i], [campo]: val }; return { ...e, equipos: eq }; });
    const guardarEdicion = async (s) => {
        setGuardando(true);
        try {
            const titulo = [ed.grupo.trim(), ed.profesor.trim()].filter(Boolean).join(' · ') || 'Sesión';
            const payload = {
                profesor: ed.profesor.trim() || null, grupo: ed.grupo.trim() || null, titulo,
                equipos: ed.equipos.map((e) => ({ ...e, alumno: (e.alumno || '').trim() || null, observacion: (e.observacion || '').trim() || null })),
            };
            await updateDoc(doc(db, 'registro_equipos', s.id), payload);
            setLista((l) => l.map((x) => (x.id === s.id ? { ...x, ...payload } : x)));
            setEditId(null); setEd(null);
        } catch (e) { console.error(e); alert('No se pudo guardar. ¿Tienes permiso?'); }
        setGuardando(false);
    };

    const copiarEnlace = () => {
        const url = `${window.location.origin}/?equipos_registro=${encodeURIComponent(codigoEquipos || '')}`;
        try { navigator.clipboard?.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* nada */ }
    };

    return (
        <div onClick={onClose} style={ov}>
            <div onClick={(e) => e.stopPropagation()} style={card}>
                <div style={headRow}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📚 Registro de uso de equipos</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {scope === 'comunidad' && codigoEquipos && (
                            <button onClick={copiarEnlace} style={cerrarBtn} title="Enlace al registro (visible para los miembros)">{copiado ? '✅ Copiado' : '🔗 Enlace'}</button>
                        )}
                        <button onClick={onClose} style={cerrarBtn}>✕</button>
                    </div>
                </div>
                <div style={{ marginTop: 12, maxHeight: '64vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lista === null ? <div style={{ color: '#94a3b8' }}>Cargando…</div>
                        : lista.length === 0 ? <div style={{ color: '#94a3b8' }}>Aún no hay sesiones guardadas.</div>
                        : lista.map((s) => {
                            const editando = editId === s.id;
                            return (
                                <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', cursor: 'pointer' }} onClick={() => !editando && setAbierto(abierto === s.id ? null : s.id)}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{s.titulo}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                {s.profesor ? `👤 ${s.profesor} · ` : ''}{s.grupo ? `👥 ${s.grupo} · ` : ''}{fechaStr(s)} · {s.equipos?.length || 0} equipos
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {puede(s) && !editando && <button onClick={(e) => { e.stopPropagation(); empezarEdicion(s); }} style={{ ...cerrarBtn, padding: '6px 10px' }}>✏️</button>}
                                            {puede(s) && <button onClick={(e) => { e.stopPropagation(); borrar(s); }} style={{ ...btn('#fee2e2'), color: '#b91c1c', padding: '6px 10px' }}>🗑️</button>}
                                            {!editando && <span style={{ color: '#64748b', fontWeight: 700 }}>{abierto === s.id ? '▲' : '▼'}</span>}
                                        </div>
                                    </div>

                                    {editando ? (
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                                                <input value={ed.profesor} onChange={(e) => setEd({ ...ed, profesor: e.target.value })} placeholder="Profesor/a" style={{ ...inpMini, minWidth: 160 }} />
                                                <input value={ed.grupo} onChange={(e) => setEd({ ...ed, grupo: e.target.value })} placeholder="Grupo" style={{ ...inpMini, minWidth: 120 }} />
                                            </div>
                                            <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 440 }}>
                                                <thead><tr style={{ color: '#475569', textAlign: 'left' }}><th style={th}>Equipo</th><th style={th}>Alumno</th><th style={th}>Observación</th><th style={th}>Batería</th></tr></thead>
                                                <tbody>
                                                    {ed.equipos.map((e, i) => (
                                                        <tr key={i} style={{ borderTop: '1px solid #eef2f7' }}>
                                                            <td style={td}>💻 {e.equipo}</td>
                                                            <td style={td}><input value={e.alumno || ''} onChange={(ev) => setEq(i, 'alumno', ev.target.value)} placeholder="— nombre —" style={inpMini} /></td>
                                                            <td style={td}><input value={e.observacion || ''} onChange={(ev) => setEq(i, 'observacion', ev.target.value)} placeholder="sin incidencias" style={inpMini} /></td>
                                                            <td style={{ ...td, color: bateriaColor(e.bateria) }}>🔋 {bateriaTxt(e.bateria)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                                                <button onClick={() => { setEditId(null); setEd(null); }} style={cerrarBtn}>Cancelar</button>
                                                <button onClick={() => guardarEdicion(s)} disabled={guardando} style={btn('#16a34a')}>{guardando ? 'Guardando…' : '💾 Guardar cambios'}</button>
                                            </div>
                                        </div>
                                    ) : abierto === s.id && (
                                        <div style={{ overflowX: 'auto', marginTop: 10 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 420 }}>
                                            <thead><tr style={{ color: '#475569', textAlign: 'left' }}><th style={th}>Equipo</th><th style={th}>Alumno</th><th style={th}>Observación</th><th style={th}>Batería</th></tr></thead>
                                            <tbody>
                                                {(s.equipos || []).map((e, i) => (
                                                    <tr key={i} style={{ borderTop: '1px solid #eef2f7' }}>
                                                        <td style={td}>💻 {e.equipo}</td>
                                                        <td style={td}>{e.alumno || '—'}</td>
                                                        <td style={{ ...td, color: e.observacion ? '#b45309' : '#cbd5e1' }}>{e.observacion || '—'}</td>
                                                        <td style={{ ...td, color: bateriaColor(e.bateria) }}>🔋 {bateriaTxt(e.bateria)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}

// estilos
const ov = { position: 'fixed', inset: 0, zIndex: 10010, background: 'rgba(2,6,23,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const card = { background: 'white', borderRadius: 16, padding: 20, width: 'min(820px, 96vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' };
const headRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 };
const cerrarBtn = { background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, color: '#475569' };
const btn = (bg) => ({ background: bg, color: bg === '#fee2e2' ? '#b91c1c' : 'white', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' });
const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 5 };
const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' };
const th = { padding: '8px 10px', fontWeight: 700 };
const td = { padding: '8px 10px', color: '#334155' };
const inpMini = { width: '100%', minWidth: 110, padding: '6px 8px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.84rem', boxSizing: 'border-box' };
