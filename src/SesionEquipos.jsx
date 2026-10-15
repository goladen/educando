// src/SesionEquipos.jsx
//
// Sesión de uso de equipos: seleccionas unos equipos, les pides el nombre al alumno,
// ves su nivel de batería en vivo y guardas la sesión como registro de uso.
//   · SesionEquipos    → modal de la sesión activa (pedir nombres + guardar)
//   · RegistroSesiones → histórico de sesiones guardadas (registro_equipos)

import React, { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

const bateriaTxt = (b) => (b == null ? '— (sobremesa)' : `${b}%`);
const bateriaColor = (b) => (b == null ? '#64748b' : b <= 20 ? '#dc2626' : b <= 50 ? '#d97706' : '#16a34a');

// ── Sesión activa ──
export default function SesionEquipos({ scope, codigoEquipos, agentes, machineIds, online, onCmd, onClose }) {
    const [titulo, setTitulo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);

    const equipos = agentes.filter((a) => machineIds.includes(a.id));
    const idsOnline = () => equipos.filter(online).map((a) => a.id);

    const pedirNombres = () => idsOnline().forEach((id) => onCmd(id, 'askName', { message: 'Tu profe te pide tu nombre para la clase' }));

    const guardar = async () => {
        setGuardando(true);
        try {
            await addDoc(collection(db, 'registro_equipos'), {
                scope, code: codigoEquipos || null,
                titulo: titulo.trim() || 'Sesión sin título',
                fecha: serverTimestamp(),
                fechaMs: Date.now(),
                ownerUid: auth.currentUser?.uid || null,
                equipos: equipos.map((a) => ({
                    machineId: a.id,
                    equipo: a.name || 'Equipo',
                    alumno: a.student?.name || null,
                    bateria: a.battery ?? null,
                })),
            });
            setGuardado(true);
        } catch (e) { console.error('guardar sesión', e); alert('No se pudo guardar la sesión.'); }
        setGuardando(false);
    };

    return (
        <div onClick={onClose} style={ov}>
            <div onClick={(e) => e.stopPropagation()} style={card}>
                <div style={headRow}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📋 Sesión de equipos ({equipos.length})</h3>
                    <button onClick={onClose} style={cerrarBtn}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                    <button onClick={pedirNombres} style={btn('#4f46e5')}>✍️ Pedir nombres a los alumnos</button>
                </div>

                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                                <th style={th}>Equipo</th><th style={th}>Alumno</th><th style={th}>Batería</th><th style={th}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equipos.map((a) => (
                                <tr key={a.id} style={{ borderTop: '1px solid #eef2f7' }}>
                                    <td style={td}>💻 {a.name || 'Equipo'}</td>
                                    <td style={{ ...td, fontWeight: 700, color: a.student?.name ? '#1e293b' : '#cbd5e1' }}>{a.student?.name || '— esperando —'}</td>
                                    <td style={{ ...td, fontWeight: 700, color: bateriaColor(a.battery) }}>🔋 {bateriaTxt(a.battery)}</td>
                                    <td style={td}>{online(a) ? '🟢' : '⚫'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la sesión (ej: 2ºB — Matemáticas)"
                        style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem' }} />
                    <button onClick={guardar} disabled={guardando} style={btn('#16a34a')}>
                        {guardado ? '✅ Guardada' : guardando ? 'Guardando…' : '💾 Guardar sesión'}
                    </button>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 8 }}>
                    Al guardar se crea un registro de uso con los equipos, los alumnos y la batería de este momento.
                </div>
            </div>
        </div>
    );
}

// ── Histórico de sesiones ──
export function RegistroSesiones({ codigoEquipos, onClose }) {
    const [lista, setLista] = useState(null);
    const [abierto, setAbierto] = useState(null); // id de sesión expandida

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

    const borrar = async (s) => {
        if (!window.confirm(`¿Borrar la sesión "${s.titulo}"?`)) return;
        try { await deleteDoc(doc(db, 'registro_equipos', s.id)); setLista((l) => l.filter((x) => x.id !== s.id)); } catch (e) { console.error(e); }
    };

    const fechaStr = (s) => { try { return new Date(s.fechaMs || 0).toLocaleString('es-ES'); } catch { return ''; } };

    return (
        <div onClick={onClose} style={ov}>
            <div onClick={(e) => e.stopPropagation()} style={card}>
                <div style={headRow}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📚 Registro de uso de equipos</h3>
                    <button onClick={onClose} style={cerrarBtn}>✕</button>
                </div>
                <div style={{ marginTop: 12, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lista === null ? <div style={{ color: '#94a3b8' }}>Cargando…</div>
                        : lista.length === 0 ? <div style={{ color: '#94a3b8' }}>Aún no hay sesiones guardadas.</div>
                        : lista.map((s) => (
                            <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', cursor: 'pointer' }} onClick={() => setAbierto(abierto === s.id ? null : s.id)}>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#1e293b' }}>{s.titulo}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{fechaStr(s)} · {s.equipos?.length || 0} equipos</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={(e) => { e.stopPropagation(); borrar(s); }} style={{ ...btn('#fee2e2'), color: '#b91c1c', padding: '6px 10px' }}>🗑️</button>
                                        <span style={{ color: '#64748b', fontWeight: 700 }}>{abierto === s.id ? '▲' : '▼'}</span>
                                    </div>
                                </div>
                                {abierto === s.id && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', marginTop: 10 }}>
                                        <thead><tr style={{ color: '#475569', textAlign: 'left' }}><th style={th}>Equipo</th><th style={th}>Alumno</th><th style={th}>Batería</th></tr></thead>
                                        <tbody>
                                            {(s.equipos || []).map((e, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid #eef2f7' }}>
                                                    <td style={td}>💻 {e.equipo}</td>
                                                    <td style={td}>{e.alumno || '—'}</td>
                                                    <td style={{ ...td, color: bateriaColor(e.bateria) }}>🔋 {bateriaTxt(e.bateria)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
const card = { background: 'white', borderRadius: 16, padding: 20, width: 'min(760px, 96vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' };
const headRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 };
const cerrarBtn = { background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, color: '#475569' };
const btn = (bg) => ({ background: bg, color: bg === '#fee2e2' ? '#b91c1c' : 'white', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' });
const th = { padding: '8px 10px', fontWeight: 700 };
const td = { padding: '8px 10px', color: '#334155' };
