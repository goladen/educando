// Modal «Ficha PDF» de Menseki: elegir retos (Primaria, Secundaria, generados),
// añadir retos nuevos al azar y opciones de la ficha.
import React, { useMemo, useState } from 'react';
import { MENSEKI_BASE } from '../../../data/mensekiData';
import { generarVariosMenseki } from './generadorMenseki';
import { descargarFichaMenseki } from './fichaMenseki';

const TINTA = '#1f2937';
const barajar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const chip = (activo, color) => ({
    border: `2px solid ${activo ? color : '#e2e8f0'}`, background: activo ? color : 'white', color: activo ? 'white' : '#334155',
    borderRadius: 10, padding: '6px 11px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
});

export default function ModalPdfMenseki({ onClose, generados = [], seleccionInicial = [] }) {
    const [sel, setSel] = useState(() => new Set(seleccionInicial));
    const [nuevos, setNuevos] = useState(0);
    const [nivelNuevos, setNivelNuevos] = useState('primaria');
    const [difNuevos, setDifNuevos] = useState(2);
    const [porPagina, setPorPagina] = useState(4);
    const [conPista, setConPista] = useState(false);
    const [conSoluciones, setConSoluciones] = useState(true);
    const [azar, setAzar] = useState(false);
    const [titulo, setTitulo] = useState('Menseki · Laberintos de áreas');
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState('');

    const grupos = useMemo(() => [
        { id: 'primaria', nombre: '🎒 Primaria', color: '#0d9488', retos: MENSEKI_BASE.filter(r => r.nivel === 'primaria') },
        { id: 'secundaria', nombre: '🎓 Secundaria', color: '#4338ca', retos: MENSEKI_BASE.filter(r => r.nivel === 'secundaria') },
        { id: 'generados', nombre: '🎲 Mis retos generados', color: '#c2410c', retos: generados },
    ].filter(g => g.retos.length), [generados]);

    const toggle = (id) => setSel(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
    const marcarGrupo = (g, si) => setSel(prev => { const s = new Set(prev); g.retos.forEach(r => (si ? s.add(r.id) : s.delete(r.id))); return s; });

    const total = sel.size + (Number(nuevos) || 0);

    const descargar = async () => {
        setError('');
        if (!total) { setError('Elige al menos un reto o añade retos nuevos.'); return; }
        setGenerando(true);
        try {
            const todos = grupos.flatMap(g => g.retos);
            let lista = todos.filter(r => sel.has(r.id));
            const n = Math.max(0, Math.min(30, Number(nuevos) || 0));
            if (n) lista = lista.concat(generarVariosMenseki(n, nivelNuevos, difNuevos));
            if (azar) lista = barajar(lista);
            await descargarFichaMenseki({ retos: lista, porPagina, conPista, conSoluciones, titulo: titulo.trim() || 'Menseki' });
        } catch (e) {
            console.error('[Menseki PDF]', e);
            setError('No se ha podido generar el PDF. Inténtalo de nuevo.');
        } finally {
            setGenerando(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', padding: 20, color: TINTA, fontFamily: "'Segoe UI', system-ui, sans-serif", boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, fontWeight: 900, fontSize: '1.2rem' }}>🖨️ Ficha PDF de Menseki</div>
                    <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>
                <p style={{ margin: '4px 0 14px', color: '#64748b', fontSize: '0.88rem' }}>Marca los retos que quieres imprimir. Puedes añadir retos nuevos generados al azar. Al final van las soluciones explicadas.</p>

                {grupos.map(g => {
                    const n = g.retos.filter(r => sel.has(r.id)).length;
                    return (
                        <div key={g.id} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 900, color: g.color }}>{g.nombre}</span>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{n}/{g.retos.length}</span>
                                <button onClick={() => marcarGrupo(g, true)} style={{ ...chip(false, g.color), padding: '3px 9px', fontSize: '0.78rem' }}>Todos</button>
                                <button onClick={() => marcarGrupo(g, false)} style={{ ...chip(false, g.color), padding: '3px 9px', fontSize: '0.78rem' }}>Ninguno</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: 6 }}>
                                {g.retos.map((r, i) => {
                                    const on = sel.has(r.id);
                                    return (
                                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${on ? g.color : '#e2e8f0'}`, background: on ? '#f8fafc' : 'white', fontSize: '0.85rem' }}>
                                            <input type="checkbox" checked={on} onChange={() => toggle(r.id)} style={{ width: 17, height: 17, accentColor: g.color }} />
                                            <span style={{ fontWeight: 800, color: '#94a3b8', minWidth: 18 }}>{i + 1}</span>
                                            <span style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</span>
                                            <span style={{ color: '#f59e0b', fontSize: 10, whiteSpace: 'nowrap' }}>{'★'.repeat(r.dificultad)}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Retos nuevos al azar */}
                <div style={{ background: '#fff7ed', border: '2px dashed #fdba74', borderRadius: 14, padding: 12, marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, color: '#c2410c', marginBottom: 8 }}>🎲 Añadir retos nuevos al azar</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem' }}>
                            Cantidad
                            <input type="number" min={0} max={30} value={nuevos} onChange={e => setNuevos(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                                style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[['primaria', 'Primaria'], ['secundaria', 'Secundaria']].map(([id, l]) => (
                                <button key={id} onClick={() => setNivelNuevos(id)} style={chip(nivelNuevos === id, '#c2410c')}>{l}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[[1, 'Fácil'], [2, 'Media'], [3, 'Difícil']].map(([id, l]) => (
                                <button key={id} onClick={() => setDifNuevos(id)} style={chip(difNuevos === id, '#c2410c')}>{l}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Opciones */}
                <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.88rem', flexWrap: 'wrap' }}>
                        Título
                        <input value={titulo} onChange={e => setTitulo(e.target.value.slice(0, 80))}
                            style={{ flex: 1, minWidth: 180, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.92rem' }} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 700, fontSize: '0.88rem' }}>
                        Retos por página
                        {[1, 2, 4, 6].map(n => <button key={n} onClick={() => setPorPagina(n)} style={chip(porPagina === n, '#0d9488')}>{n}</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontWeight: 700, fontSize: '0.88rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={conPista} onChange={e => setConPista(e.target.checked)} style={{ width: 17, height: 17 }} /> Con pista</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={conSoluciones} onChange={e => setConSoluciones(e.target.checked)} style={{ width: 17, height: 17 }} /> Hoja de soluciones</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={azar} onChange={e => setAzar(e.target.checked)} style={{ width: 17, height: 17 }} /> Orden al azar</label>
                    </div>
                </div>

                {error && <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: 10 }}>{error}</div>}
                <button onClick={descargar} disabled={generando || !total} style={{
                    width: '100%', border: 'none', borderRadius: 14, padding: '14px', fontSize: '1.1rem', fontWeight: 900, fontFamily: 'inherit',
                    background: total ? 'linear-gradient(135deg, #0d9488, #4338ca)' : '#cbd5e1', color: 'white', cursor: total && !generando ? 'pointer' : 'default',
                }}>{generando ? 'Generando…' : `⬇️ Descargar PDF (${total} reto${total === 1 ? '' : 's'})`}</button>
            </div>
        </div>
    );
}
