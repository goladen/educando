import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

const COLORS_MAP = {
    geo: { hex: '#3498db', name: 'Geografía' },
    esp: { hex: '#e84393', name: 'Espectáculos' },
    his: { hex: '#f1c40f', name: 'Historia' },
    art: { hex: '#9b59b6', name: 'Arte y Lit.' },
    cie: { hex: '#2ecc71', name: 'Ciencias' },
    dep: { hex: '#e67e22', name: 'Deportes' },
};

function diasRestantes(fecha) {
    if (!fecha) return '?';
    const ms = 7 * 24 * 60 * 60 * 1000 - (Date.now() - fecha.toDate().getTime());
    if (ms <= 0) return 0;
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function formatFecha(fecha) {
    if (!fecha) return '—';
    return fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TrivialPartidasView({ usuario }) {
    const [partidas, setPartidas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!usuario?.uid) return;
        cargarPartidas();
    }, [usuario]);

    const cargarPartidas = async () => {
        setCargando(true);
        setError('');
        try {
            const snap = await getDocs(query(
                collection(db, 'trivial_partidas'),
                where('profesorUid', '==', usuario.uid)
            ));

            const ahora = Date.now();
            const SEMANA = 7 * 24 * 60 * 60 * 1000;
            const expiradas = [];
            const activas = [];

            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                const ultima = data.fechaUltimaActividad?.toDate?.() || new Date(0);
                if (ahora - ultima.getTime() > SEMANA) {
                    expiradas.push(d.id);
                } else {
                    activas.push(data);
                }
            });

            // Borrar expiradas en paralelo
            await Promise.all(expiradas.map(id => deleteDoc(doc(db, 'trivial_partidas', id))));

            activas.sort((a, b) => {
                const fa = b.fechaUltimaActividad?.toDate?.() || new Date(0);
                const fb = a.fechaUltimaActividad?.toDate?.() || new Date(0);
                return fa - fb;
            });

            setPartidas(activas);
        } catch (e) {
            console.error(e);
            setError('Error al cargar las partidas.');
        }
        setCargando(false);
    };

    const eliminarPartida = async (id) => {
        if (!window.confirm('¿Eliminar esta partida guardada?')) return;
        await deleteDoc(doc(db, 'trivial_partidas', id));
        setPartidas(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div style={{ padding: '30px 20px', maxWidth: 900, margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
                <div style={{ fontSize: '2.5rem' }}>🎯</div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>Trivial — Partidas guardadas</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                        Los alumnos guardan sus partidas usando tu código de profesor. Se eliminan automáticamente tras 7 días sin actividad.
                    </p>
                </div>
                <button onClick={cargarPartidas} style={{ marginLeft: 'auto', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                    🔄 Actualizar
                </button>
            </div>

            {cargando && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Cargando partidas…</p>}
            {error && <p style={{ color: '#e74c3c', textAlign: 'center' }}>{error}</p>}

            {!cargando && partidas.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📭</div>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>No hay partidas guardadas activas.</p>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {partidas.map(p => {
                    const dias = diasRestantes(p.fechaUltimaActividad);
                    const diasColor = dias <= 1 ? '#e74c3c' : dias <= 2 ? '#f59e0b' : '#2ecc71';

                    return (
                        <div key={p.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

                                {/* Código de partida */}
                                <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 100 }}>
                                    <div style={{ color: '#38bdf8', fontSize: '1.5rem', fontWeight: 900, letterSpacing: 4 }}>{p.codigoPartida}</div>
                                    <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: 4 }}>CÓDIGO</div>
                                </div>

                                {/* Jugadores */}
                                <div style={{ flex: 1, minWidth: 220 }}>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                        {p.jugadores?.map((j, i) => {
                                            const esTurno = i === p.turnoActivo;
                                            return (
                                                <div key={i} style={{ background: esTurno ? j.color + '22' : '#f8fafc', border: `2px solid ${esTurno ? j.color : '#e2e8f0'}`, borderRadius: 10, padding: '6px 12px' }}>
                                                    <div style={{ fontWeight: 700, color: j.color, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: j.color }} />
                                                        {j.nombre}
                                                        {esTurno && <span style={{ fontSize: '0.7rem', background: j.color, color: 'white', padding: '1px 6px', borderRadius: 8 }}>TURNO</span>}
                                                    </div>
                                                    {/* Quesitos */}
                                                    <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                                                        {Object.entries(COLORS_MAP).map(([id, c]) => (
                                                            <div key={id} title={c.name} style={{ width: 12, height: 12, borderRadius: '50%', background: j.quesitos?.includes(id) ? c.hex : '#e2e8f0', border: `1px solid ${j.quesitos?.includes(id) ? c.hex : '#cbd5e1'}` }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                        Última actividad: {formatFecha(p.fechaUltimaActividad)}
                                    </div>
                                </div>

                                {/* Expira en */}
                                <div style={{ textAlign: 'center', minWidth: 70 }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: diasColor }}>{dias}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{dias === 1 ? 'día' : 'días'}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>para expirar</div>
                                </div>

                                {/* Borrar */}
                                <button onClick={() => eliminarPartida(p.id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', alignSelf: 'center' }}>
                                    🗑 Eliminar
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
