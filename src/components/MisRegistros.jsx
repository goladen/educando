import { useState, useEffect } from 'react';
import {
    getResumenRegistros,
    getRegistrosPorTipo,
    borrarRegistro,
    borrarTipo,
    borrarTodo,
    metaDe,
} from '../utils/registrosLocales';

const fmtFecha = (iso) => {
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) +
            ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

const pctColor = (p) => (p >= 80 ? '#27ae60' : p >= 50 ? '#e67e22' : '#e74c3c');

// ─── Vista detalle de un juego ───────────────────────────────────────────────
function DetalleJuego({ tipo, onVolver, onCambio }) {
    const [registros, setRegistros] = useState(() => getRegistrosPorTipo(tipo));
    const [confirmarTodos, setConfirmarTodos] = useState(false);
    const meta = metaDe(tipo);

    const borrarUno = (id) => {
        borrarRegistro(tipo, id);
        const quedan = getRegistrosPorTipo(tipo);
        setRegistros(quedan);
        onCambio();
        if (quedan.length === 0) onVolver();
    };

    const borrarTodos = () => {
        borrarTipo(tipo);
        onCambio();
        onVolver();
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button onClick={onVolver} style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
                    borderRadius: 9, padding: '7px 12px', cursor: 'pointer', fontWeight: 700,
                }}>← Volver</button>
                <span style={{ fontSize: '1.5rem' }}>{meta.emoji}</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'white', flex: 1 }}>{meta.nombre}</h3>
                <button onClick={() => setConfirmarTodos(true)} style={{
                    background: '#fdecea', border: 'none', color: '#e74c3c',
                    borderRadius: 9, padding: '7px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                }}>🗑 Borrar todos</button>
            </div>

            {confirmarTodos && (
                <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)', borderRadius: 12, padding: '12px 15px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.86rem', color: '#fff' }}>
                    <span style={{ flex: 1 }}>¿Borrar todos los registros de {meta.nombre}?</span>
                    <button onClick={borrarTodos} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Sí, borrar</button>
                    <button onClick={() => setConfirmarTodos(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: '52vh', overflowY: 'auto' }}>
                {registros.map((r) => (
                    <FilaRegistro key={r.id} r={r} onBorrar={() => borrarUno(r.id)} />
                ))}
            </div>
        </div>
    );
}

function FilaRegistro({ r, onBorrar }) {
    const [confirmar, setConfirmar] = useState(false);
    return (
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{r.titulo || 'Partida'}</div>
                <div style={{ fontSize: '0.74rem', color: '#9aa4ad' }}>
                    {fmtFecha(r.fecha)}
                    {r.nombre && <> · {r.nombre}</>}
                    {r.via && <> · {r.via === 'profesor' ? '📤 al profesor' : '🏆 ranking'}</>}
                </div>
            </div>
            {r.intentos > 0 ? (
                <>
                    <span style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '0.78rem', color: pctColor(r.porcentaje) }}>{r.porcentaje}%</span>
                    <span style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(46,204,113,0.18)', fontWeight: 700, fontSize: '0.78rem', color: '#2ecc71' }}>✓ {r.aciertos}/{r.intentos}</span>
                </>
            ) : r.aciertos > 0 ? (
                <span style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(46,204,113,0.18)', fontWeight: 700, fontSize: '0.78rem', color: '#2ecc71' }}>🎯 {r.aciertos} pts</span>
            ) : null}
            {confirmar ? (
                <span style={{ display: 'flex', gap: 6 }}>
                    <button onClick={onBorrar} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>Borrar</button>
                    <button onClick={() => setConfirmar(false)} style={{ padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
                </span>
            ) : (
                <button onClick={() => setConfirmar(true)} title="Borrar" style={{ padding: '4px 8px', borderRadius: 7, border: 'none', background: 'rgba(231,76,60,0.15)', color: '#e74c3c', cursor: 'pointer' }}>🗑</button>
            )}
        </div>
    );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MisRegistros({ onClose, tipoInicial = null }) {
    const [resumen, setResumen] = useState(() => getResumenRegistros());
    const [tipoActivo, setTipoActivo] = useState(tipoInicial);
    const [confirmarTodo, setConfirmarTodo] = useState(false);

    // Refrescar el resumen tras cualquier borrado.
    const refrescar = () => setResumen(getResumenRegistros());

    useEffect(() => {
        if (resumen.length === 0) setTipoActivo(null);
    }, [resumen.length]);

    const borrarTodos = () => {
        borrarTodo();
        setResumen([]);
        setConfirmarTodo(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 480, padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI',sans-serif", boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f1c40f' }}>📋 Mis registros</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.3rem' }}>✕</button>
                </div>

                {resumen.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '34px 0', color: '#8c97a1' }}>
                        <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>🗒️</div>
                        Todavía no tienes partidas guardadas en este dispositivo.
                    </div>
                ) : tipoActivo ? (
                    <DetalleJuego tipo={tipoActivo} onVolver={() => setTipoActivo(null)} onCambio={refrescar} />
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                            {resumen.map((g) => (
                                <button key={g.tipo} onClick={() => setTipoActivo(g.tipo)} style={{
                                    position: 'relative', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 14, padding: '16px 10px', cursor: 'pointer', color: 'white',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'background 0.2s',
                                }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}>
                                    <span style={{ fontSize: '2rem' }}>{g.emoji}</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>{g.nombre}</span>
                                    <span style={{ position: 'absolute', top: 8, right: 8, background: g.color, color: 'white', borderRadius: 20, padding: '1px 8px', fontSize: '0.74rem', fontWeight: 800 }}>x{g.count}</span>
                                </button>
                            ))}
                        </div>

                        {confirmarTodo ? (
                            <div style={{ marginTop: 18, background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)', borderRadius: 12, padding: '14px 15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6 }}>⚠️ Atención</div>
                                <div style={{ fontSize: '0.86rem', color: '#e9eef2', marginBottom: 12 }}>
                                    Se borrarán <b>todos</b> los registros de <b>todos</b> los juegos de este dispositivo. Esta acción no se puede deshacer.
                                </div>
                                <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
                                    <button onClick={() => setConfirmarTodo(false)} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                                    <button onClick={borrarTodos} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Sí, borrar todo</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: 18, textAlign: 'center' }}>
                                <button onClick={() => setConfirmarTodo(true)} style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.35)', color: '#e74c3c', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>🗑 Borrar todos los registros</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
