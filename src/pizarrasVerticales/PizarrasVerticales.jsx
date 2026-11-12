// Pizarras verticales · Problemas de ingenio (PIZARRAS_VERTICALES, /pizarras_verticales)
// Banco de problemas para aulas de pensamiento, por sentidos matemáticos (marco ARCOMAT / LOMLOE),
// con instrucciones para el profesor, modo proyector, formación de grupos aleatorios,
// registro de sesiones y problemas propios del profesor (guardados en el dispositivo).
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { TEMAS, NIVELES, HEURISTICAS, PROBLEMAS, GUIA_METODO, SESION_TIPO } from './problemas';
import FiguraProblema from './FigurasProblema';
import GruposPizarras from './GruposPizarras';
import JuegosMagia from './JuegosMagia';
import { createPortal } from 'react-dom';
import { guardarRegistroLocal } from '../utils/registrosLocales';

const LS_MIOS = 'pv_mis_problemas_v1';
const LS_GRUPOS = 'pv_ultimos_grupos_v1';
const LS_SESIONES = 'pv_sesiones_v1';

const leerLS = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const temaDe = id => TEMAS.find(t => t.id === id) || TEMAS[0];
const FONDO = '#f5f3ee';
const TINTA = '#1f2937';

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit', ...extra,
});
const chip = (activo, color) => ({
    padding: '6px 12px', borderRadius: 999, border: `2px solid ${color}`, cursor: 'pointer', fontWeight: 700,
    fontSize: '0.82rem', background: activo ? color : 'white', color: activo ? 'white' : color, fontFamily: 'inherit',
});

// ─────────────────────────── Cronómetro (cuenta atrás) ───────────────────────────
function Cronometro({ minutos, oscuro }) {
    const [restante, setRestante] = useState(minutos * 60);
    const [activo, setActivo] = useState(false);
    useEffect(() => { setRestante(minutos * 60); setActivo(false); }, [minutos]);
    useEffect(() => {
        if (!activo) return undefined;
        const t = setInterval(() => setRestante(r => Math.max(0, r - 1)), 1000);
        return () => clearInterval(t);
    }, [activo]);
    useEffect(() => { if (restante === 0) setActivo(false); }, [restante]);
    const mm = String(Math.floor(restante / 60)).padStart(2, '0');
    const ss = String(restante % 60).padStart(2, '0');
    const fin = restante === 0;
    const c = oscuro ? 'white' : TINTA;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: oscuro ? '1.6rem' : '1.1rem', color: fin ? '#ef4444' : c }}>⏱ {mm}:{ss}</span>
            <button onClick={() => setActivo(v => !v)} style={btn(activo ? '#64748b' : '#16a34a', 'white', { padding: '6px 10px' })}>{activo ? '⏸' : '▶'}</button>
            <button onClick={() => { setActivo(false); setRestante(minutos * 60); }} style={btn('#94a3b8', 'white', { padding: '6px 10px' })}>↺</button>
            <button onClick={() => setRestante(r => r + 60)} style={btn('#94a3b8', 'white', { padding: '6px 10px' })}>+1′</button>
        </div>
    );
}

// ─────────────────────────── Texto con saltos de línea ───────────────────────────
const Parrafos = ({ texto, style }) => (
    <div style={style}>{String(texto || '').split('\n').map((l, i) => <div key={i} style={{ minHeight: l ? undefined : '0.6em' }}>{l}</div>)}</div>
);

// ─────────────────────────── Modo proyector ───────────────────────────
function Proyector({ p, grupos, onClose }) {
    const ref = useRef(null);
    const [pistas, setPistas] = useState(0);
    const [exts, setExts] = useState(0);
    const [verGrupos, setVerGrupos] = useState(false);
    const [verSol, setVerSol] = useState(false);
    const tema = temaDe(p.tema);

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape' && !document.fullscreenElement) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const pantallaCompleta = () => {
        try {
            if (document.fullscreenElement) document.exitFullscreen();
            else ref.current?.requestFullscreen?.();
        } catch { /* sin soporte */ }
    };

    const ctrl = { ...btn('rgba(255,255,255,0.12)', 'white'), border: '1px solid rgba(255,255,255,0.25)' };
    return (
        <div ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ background: tema.color, borderRadius: 8, padding: '4px 10px', fontWeight: 800 }}>{tema.emoji} {tema.nombre}</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', flex: 1 }}>{p.titulo}</span>
                <Cronometro minutos={p.minutos || 30} oscuro />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px, 4vw, 48px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Parrafos texto={p.enunciado} style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2.8rem)', lineHeight: 1.35, maxWidth: 1300, fontWeight: 600 }} />
                {p.figura && <div style={{ width: 'min(380px, 60vw)', marginTop: 16 }}><FiguraProblema id={verSol && p.figuraSolucion ? p.figuraSolucion : p.figura} color="white" /></div>}
                {pistas > 0 && (
                    <div style={{ marginTop: 24, maxWidth: 1200, width: '100%' }}>
                        {(p.pistas || []).slice(0, pistas).map((t, i) => (
                            <div key={i} style={{ background: 'rgba(250,204,21,0.15)', border: '2px solid #facc15', borderRadius: 14, padding: '12px 18px', marginBottom: 10, fontSize: 'clamp(1.05rem, 2vw, 1.7rem)' }}>💡 {t}</div>
                        ))}
                    </div>
                )}
                {exts > 0 && (
                    <div style={{ marginTop: 16, maxWidth: 1200, width: '100%' }}>
                        {(p.extensiones || []).slice(0, exts).map((t, i) => (
                            <div key={i} style={{ background: 'rgba(56,189,248,0.15)', border: '2px solid #38bdf8', borderRadius: 14, padding: '12px 18px', marginBottom: 10, fontSize: 'clamp(1.05rem, 2vw, 1.7rem)' }}>🚀 {t}</div>
                        ))}
                    </div>
                )}
                {verSol && (
                    <div style={{ marginTop: 16, maxWidth: 1200, width: '100%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', borderRadius: 14, padding: '14px 18px', fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}>
                        <Parrafos texto={'✅ ' + p.solucion} />
                    </div>
                )}
                {verGrupos && (
                    <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, width: '100%', maxWidth: 1300 }}>
                        {grupos.length === 0 && <div style={{ opacity: 0.7 }}>Aún no has formado grupos (pestaña «Formar grupos»).</div>}
                        {grupos.map((g, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px' }}>
                                <div style={{ fontWeight: 900, color: '#facc15', fontSize: '1.2rem' }}>Pizarra {i + 1}</div>
                                {g.map((n, k) => <div key={k} style={{ fontSize: '1.15rem' }}>{n}</div>)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.1)', justifyContent: 'center' }}>
                <button style={ctrl} disabled={pistas >= (p.pistas || []).length} onClick={() => setPistas(n => n + 1)}>💡 Mostrar pista ({pistas}/{(p.pistas || []).length})</button>
                {pistas > 0 && <button style={ctrl} onClick={() => setPistas(0)}>Ocultar pistas</button>}
                <button style={ctrl} disabled={exts >= (p.extensiones || []).length} onClick={() => setExts(n => n + 1)}>🚀 Extensión ({exts}/{(p.extensiones || []).length})</button>
                {exts > 0 && <button style={ctrl} onClick={() => setExts(0)}>Ocultar extensiones</button>}
                <button style={ctrl} onClick={() => setVerGrupos(v => !v)}>👥 {verGrupos ? 'Ocultar' : 'Ver'} grupos</button>
                {p.solucion && <button style={ctrl} onClick={() => setVerSol(v => !v)}>{verSol ? 'Ocultar solución' : '✅ Solución'}</button>}
                <button style={ctrl} onClick={pantallaCompleta}>⛶ Pantalla completa</button>
                <button style={btn('#ef4444')} onClick={onClose}>✕ Cerrar</button>
            </div>
        </div>
    );
}

// ─────────────────────────── Registrar sesión ───────────────────────────
function ModalSesion({ p, nGruposSugerido, onClose, onGuardado }) {
    const [curso, setCurso] = useState('');
    const [grupos, setGrupos] = useState(nGruposSugerido || 8);
    const [resueltos, setResueltos] = useState(0);
    const [extensiones, setExtensiones] = useState(0);
    const [notas, setNotas] = useState('');
    const inp = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: '0.92rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    const lab = { fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 3 };

    const guardar = () => {
        const g = Math.max(1, Number(grupos) || 1);
        const r = Math.min(g, Math.max(0, Number(resueltos) || 0));
        guardarRegistroLocal('PIZARRAS_VERTICALES', {
            titulo: p.titulo, aciertos: r, intentos: g, nombre: 'Sesión de pizarras', curso: curso.trim(), via: 'pizarras',
        });
        const ses = leerLS(LS_SESIONES, []);
        ses.push({ id: Date.now().toString(36), fecha: new Date().toISOString(), problema: p.id, titulo: p.titulo, curso: curso.trim(), grupos: g, resueltos: r, extensiones: Number(extensiones) || 0, notas: notas.trim() });
        guardarLS(LS_SESIONES, ses.slice(-300));
        onGuardado();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 420, padding: 22, color: TINTA }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📝 Registrar sesión · {p.titulo}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div><label style={lab}>Curso / grupo</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej.: 1º ESO B" style={inp} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div><label style={lab}>Nº de pizarras</label><input type="number" min={1} value={grupos} onChange={e => setGrupos(e.target.value)} style={inp} /></div>
                        <div><label style={lab}>Lo resolvieron</label><input type="number" min={0} value={resueltos} onChange={e => setResueltos(e.target.value)} style={inp} /></div>
                        <div><label style={lab}>Con extensión</label><input type="number" min={0} value={extensiones} onChange={e => setExtensiones(e.target.value)} style={inp} /></div>
                    </div>
                    <div><label style={lab}>Observaciones (qué funcionó, pistas usadas, alumnos a seguir…)</label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} /></div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Se guarda en este dispositivo y aparece en «Mis registros».</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} style={btn('#e5e7eb', TINTA, { flex: 1 })}>Cancelar</button>
                        <button onClick={guardar} style={btn('#16a34a', 'white', { flex: 2 })}>Guardar sesión</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────── Ficha del problema (profesor) ───────────────────────────
function Seccion({ titulo, color, children }) {
    return (
        <div style={{ background: 'white', borderRadius: 14, padding: '12px 16px', borderLeft: `5px solid ${color}`, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 800, color, fontSize: '0.9rem', marginBottom: 6 }}>{titulo}</div>
            <div style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>{children}</div>
        </div>
    );
}

function VistaProblema({ p, onVolver, onProyectar, onEditar, onImprimir, grupos, sesiones, onSesionGuardada }) {
    const tema = temaDe(p.tema);
    const [verSol, setVerSol] = useState(false);
    const [pistasVistas, setPistasVistas] = useState(0);
    const [registrar, setRegistrar] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const misSesiones = sesiones.filter(s => s.problema === p.id).slice().reverse();

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0 14px' }}>
                <button onClick={onVolver} style={btn('#e5e7eb', TINTA)}>← Problemas</button>
                <div style={{ flex: 1 }} />
                <button onClick={onProyectar} style={btn(tema.color)}>📽️ Proyectar</button>
                <button onClick={() => onImprimir('alumnos')} style={btn('#475569')}>🖨️ Enunciado</button>
                <button onClick={() => onImprimir('profesor')} style={btn('#475569')}>🖨️ Ficha profesor</button>
                <button onClick={() => { setRegistrar(true); setGuardadoOk(false); }} style={btn('#16a34a')}>📝 Registrar sesión</button>
                {p.propio && <button onClick={onEditar} style={btn('#f59e0b')}>✏️ Editar</button>}
            </div>
            {guardadoOk && <div style={{ background: '#dcfce7', color: '#166534', padding: '8px 14px', borderRadius: 10, marginBottom: 12, fontWeight: 700 }}>✅ Sesión guardada.</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16, alignItems: 'start' }}>
                {/* Enunciado */}
                <div style={{ background: 'white', borderRadius: 18, padding: 20, border: `3px solid ${tema.color}`, position: 'sticky', top: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ background: tema.color, color: 'white', borderRadius: 8, padding: '3px 9px', fontSize: '0.78rem', fontWeight: 800 }}>{tema.emoji} {tema.nombre}</span>
                        {p.tipo === 'arranque' && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '3px 9px', fontSize: '0.78rem', fontWeight: 800 }}>🌱 Arranque</span>}
                        {p.propio && <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 8, padding: '3px 9px', fontSize: '0.78rem', fontWeight: 800 }}>Mío</span>}
                    </div>
                    <h2 style={{ margin: '0 0 10px', color: TINTA }}>{p.titulo}</h2>
                    <Parrafos texto={p.enunciado} style={{ fontSize: '1.15rem', lineHeight: 1.5, color: TINTA }} />
                    {p.figura && <FiguraProblema id={verSol && p.figuraSolucion ? p.figuraSolucion : p.figura} color={TINTA} />}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14, fontSize: '0.85rem', color: '#4b5563' }}>
                        <span>⏱ {p.minutos || 30} min</span>
                        <span>🎓 {(p.niveles || []).join(' · ')}</span>
                        {p.material && <span>🧰 {p.material}</span>}
                    </div>
                    {(p.heuristicas || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                            {p.heuristicas.map(h => <span key={h} style={{ background: '#f1f5f9', borderRadius: 999, padding: '3px 10px', fontSize: '0.76rem', color: '#334155' }}>🧭 {HEURISTICAS[h] || h}</span>)}
                        </div>
                    )}
                    {p.fuente && <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#6b7280' }}>Fuente: {p.fuente}</div>}
                    <div style={{ marginTop: 14 }}><Cronometro minutos={p.minutos || 30} /></div>
                </div>

                {/* Instrucciones del profesor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 900, color: TINTA, fontSize: '1.05rem' }}>👩‍🏫 Instrucciones para el profesor</div>
                    {p.lanzamiento && <Seccion titulo="🎬 Cómo lanzarlo (de pie, en voz alta)" color="#2563eb">{p.lanzamiento}</Seccion>}
                    {(p.pistas || []).length > 0 && (
                        <Seccion titulo="💡 Pistas para grupos atascados (de menos a más)" color="#ca8a04">
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6 }}>Ve desvelándolas solo si hace falta: reducen el reto sin dar la respuesta.</div>
                            {p.pistas.map((t, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 800, color: '#ca8a04' }}>{i + 1}.</span>
                                    {i < pistasVistas
                                        ? <span>{t}</span>
                                        : <button onClick={() => setPistasVistas(i + 1)} style={btn('#fef3c7', '#92400e', { padding: '3px 10px', fontSize: '0.8rem' })}>Ver pista {i + 1}</button>}
                                </div>
                            ))}
                        </Seccion>
                    )}
                    {(p.extensiones || []).length > 0 && (
                        <Seccion titulo="🚀 Extensiones para los que terminan (techo alto)" color="#0284c7">
                            <ul style={{ margin: 0, paddingLeft: 18 }}>{p.extensiones.map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}</ul>
                        </Seccion>
                    )}
                    {p.errores && <Seccion titulo="⚠️ Errores y bloqueos frecuentes" color="#dc2626">{p.errores}</Seccion>}
                    {p.consolidacion && <Seccion titulo="🧷 Consolidación desde las pizarras" color="#7c3aed">{p.consolidacion}<div style={{ marginTop: 6, fontSize: '0.82rem', color: '#6b7280' }}>Cierra con 5 minutos de «notas para mí mismo» en el cuaderno.</div></Seccion>}
                    {p.solucion && (
                        <Seccion titulo="✅ Solución" color="#16a34a">
                            {verSol
                                ? <><Parrafos texto={p.solucion} /><button onClick={() => setVerSol(false)} style={btn('#e5e7eb', TINTA, { marginTop: 8, padding: '4px 10px', fontSize: '0.8rem' })}>Ocultar</button></>
                                : <button onClick={() => setVerSol(true)} style={btn('#dcfce7', '#166534', { padding: '5px 12px', fontSize: '0.82rem' })}>Mostrar solución</button>}
                        </Seccion>
                    )}
                    {misSesiones.length > 0 && (
                        <Seccion titulo={`📚 Sesiones anteriores (${misSesiones.length})`} color="#475569">
                            {misSesiones.slice(0, 6).map(s => (
                                <div key={s.id} style={{ borderTop: '1px solid #f1f5f9', padding: '5px 0', fontSize: '0.85rem' }}>
                                    <b>{new Date(s.fecha).toLocaleDateString('es-ES')}</b>{s.curso && ` · ${s.curso}`} · {s.resueltos}/{s.grupos} pizarras lo resolvieron{s.extensiones ? ` · ${s.extensiones} con extensión` : ''}
                                    {s.notas && <div style={{ color: '#6b7280' }}>{s.notas}</div>}
                                </div>
                            ))}
                        </Seccion>
                    )}
                </div>
            </div>
            {registrar && <ModalSesion p={p} nGruposSugerido={grupos.length || 8} onClose={() => setRegistrar(false)} onGuardado={() => { setRegistrar(false); setGuardadoOk(true); onSesionGuardada(); }} />}
        </div>
    );
}

// ─────────────────────────── Guía del método ───────────────────────────
function VistaGuia() {
    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 40px', color: TINTA }}>
            <div style={{ background: 'white', borderRadius: 18, padding: 20, marginBottom: 16 }}>
                <h2 style={{ marginTop: 0 }}>🧱 Cómo trabajar en pizarras verticales</h2>
                <p style={{ lineHeight: 1.6, margin: 0 }}>
                    Las pizarras verticales son una de las prácticas de las <b>aulas de pensamiento</b> (<i>Building Thinking Classrooms</i>, Peter Liljedahl):
                    grupos aleatorios de tres, de pie, resuelven un problema en una superficie vertical que se borra con facilidad.
                    Encaja con el enfoque del programa <b>ARCOMAT</b> de Aragón para 1º y 2º de ESO: resolución de problemas, razonamiento,
                    comunicación y el <b>sentido socioafectivo</b> (perseverancia, trabajo en equipo, gestión del error).
                    Los problemas de este banco están ordenados por los <b>sentidos matemáticos</b> del currículo.
                </p>
            </div>
            <div style={{ background: 'white', borderRadius: 18, padding: 20, marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>⏳ Una sesión tipo (50 min)</h3>
                {SESION_TIPO.map(s => (
                    <div key={s.min} style={{ display: 'flex', gap: 12, padding: '6px 0', borderTop: '1px solid #f1f5f9' }}>
                        <b style={{ minWidth: 60, color: '#2563eb' }}>{s.min}′</b><span>{s.texto}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 12 }}>
                {GUIA_METODO.map((g, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', borderTop: '4px solid #f59e0b' }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>{i + 1}. {g.titulo}</div>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#374151' }}>{g.texto}</div>
                    </div>
                ))}
            </div>
            <div style={{ background: '#fffbeb', borderRadius: 14, padding: 16, marginTop: 16, fontSize: '0.9rem', lineHeight: 1.55 }}>
                <b>🧭 Estrategias de resolución que conviene hacer explícitas:</b> {Object.values(HEURISTICAS).join(' · ')}.
                En cada problema aparecen las que más ayudan; nómbralas en la consolidación para que el alumnado las reconozca y las reutilice.
            </div>
        </div>
    );
}

// ─────────────────────────── Editor de problemas propios ───────────────────────────
const VACIO = { titulo: '', tema: 'NUMERICO', tipo: 'curricular', niveles: ['1º ESO'], minutos: 30, material: '', enunciado: '', lanzamiento: '', pistasTxt: '', extensionesTxt: '', errores: '', consolidacion: '', solucion: '', fuente: '' };

function EditorProblema({ inicial, onGuardar, onCancelar, onBorrar }) {
    const [f, setF] = useState(() => inicial
        ? { ...VACIO, ...inicial, pistasTxt: (inicial.pistas || []).join('\n'), extensionesTxt: (inicial.extensiones || []).join('\n') }
        : VACIO);
    const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
    const inp = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid #d1d5db', fontSize: '0.92rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    const lab = { fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', display: 'block', margin: '8px 0 3px' };
    const area = (k, label, rows = 3, ph = '') => (
        <div><label style={lab}>{label}</label><textarea value={f[k]} onChange={e => set(k, e.target.value)} rows={rows} placeholder={ph} style={{ ...inp, resize: 'vertical' }} /></div>
    );
    const valido = f.titulo.trim() && f.enunciado.trim();
    const guardar = () => {
        if (!valido) return;
        const { pistasTxt, extensionesTxt, ...resto } = f;
        onGuardar({
            ...resto,
            id: inicial?.id || `U${Date.now().toString(36)}`,
            propio: true,
            minutos: Number(f.minutos) || 30,
            pistas: pistasTxt.split('\n').map(s => s.trim()).filter(Boolean),
            extensiones: extensionesTxt.split('\n').map(s => s.trim()).filter(Boolean),
        });
    };

    return (
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 16px 40px', color: TINTA }}>
            <div style={{ background: 'white', borderRadius: 18, padding: 20 }}>
                <h3 style={{ marginTop: 0 }}>{inicial ? '✏️ Editar problema' : '➕ Nuevo problema propio'}</h3>
                <p style={{ marginTop: 0, fontSize: '0.85rem', color: '#6b7280' }}>Útil para los problemas que ya usáis en el centro (libros de problemas, olimpiadas, retos propios). Indica la fuente.</p>
                <label style={lab}>Título *</label><input value={f.titulo} onChange={e => set('titulo', e.target.value)} style={inp} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    <div><label style={lab}>Tema</label>
                        <select value={f.tema} onChange={e => set('tema', e.target.value)} style={inp}>{TEMAS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>)}</select></div>
                    <div><label style={lab}>Tipo</label>
                        <select value={f.tipo} onChange={e => set('tipo', e.target.value)} style={inp}><option value="arranque">🌱 Arranque (no curricular)</option><option value="curricular">Curricular</option></select></div>
                    <div><label style={lab}>Minutos</label><input type="number" min={5} value={f.minutos} onChange={e => set('minutos', e.target.value)} style={inp} /></div>
                </div>
                <label style={lab}>Niveles</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {NIVELES.map(n => {
                        const on = f.niveles.includes(n);
                        return <button key={n} onClick={() => set('niveles', on ? f.niveles.filter(x => x !== n) : [...f.niveles, n])} style={chip(on, '#2563eb')}>{n}</button>;
                    })}
                </div>
                {area('enunciado', 'Enunciado (lo que se proyecta) *', 5)}
                <label style={lab}>Material</label><input value={f.material} onChange={e => set('material', e.target.value)} style={inp} />
                {area('lanzamiento', 'Cómo lanzarlo')}
                {area('pistasTxt', 'Pistas (una por línea, de menos a más ayuda)', 3)}
                {area('extensionesTxt', 'Extensiones (una por línea)', 3)}
                {area('errores', 'Errores frecuentes', 2)}
                {area('consolidacion', 'Consolidación', 2)}
                {area('solucion', 'Solución', 3)}
                <label style={lab}>Fuente</label><input value={f.fuente} onChange={e => set('fuente', e.target.value)} placeholder="Ej.: libro, autor y página" style={inp} />
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                    <button onClick={onCancelar} style={btn('#e5e7eb', TINTA)}>Cancelar</button>
                    {inicial && <button onClick={() => { if (window.confirm('¿Borrar este problema?')) onBorrar(inicial.id); }} style={btn('#fee2e2', '#b91c1c')}>🗑 Borrar</button>}
                    <div style={{ flex: 1 }} />
                    <button onClick={guardar} disabled={!valido} style={btn(valido ? '#16a34a' : '#9ca3af')}>Guardar</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────── Impresión ───────────────────────────
function Impresion({ p, modo }) {
    if (!p) return null;
    const tema = temaDe(p.tema);
    return createPortal(
        <div className="pv-print">
            <div style={{ fontSize: 12, color: '#555' }}>{tema.nombre} · {(p.niveles || []).join(' · ')}</div>
            <h1 style={{ margin: '4px 0 12px', fontSize: 26 }}>{p.titulo}</h1>
            <Parrafos texto={p.enunciado} style={{ fontSize: modo === 'alumnos' ? 22 : 16, lineHeight: 1.5 }} />
            {p.figura && <div style={{ width: 260, margin: '12px auto' }}><FiguraProblema id={p.figura} color="#000" /></div>}
            {modo === 'profesor' && (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <p><b>Tiempo:</b> {p.minutos} min · <b>Material:</b> {p.material || '—'}{(p.heuristicas || []).length ? <> · <b>Estrategias:</b> {p.heuristicas.map(h => HEURISTICAS[h] || h).join(', ')}</> : null}</p>
                    {p.lanzamiento && <p><b>Lanzamiento:</b> {p.lanzamiento}</p>}
                    {(p.pistas || []).length > 0 && <><b>Pistas:</b><ol>{p.pistas.map((t, i) => <li key={i}>{t}</li>)}</ol></>}
                    {(p.extensiones || []).length > 0 && <><b>Extensiones:</b><ul>{p.extensiones.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
                    {p.errores && <p><b>Errores frecuentes:</b> {p.errores}</p>}
                    {p.consolidacion && <p><b>Consolidación:</b> {p.consolidacion}</p>}
                    {p.solucion && <div><b>Solución:</b> <Parrafos texto={p.solucion} /></div>}
                    {p.fuente && <p style={{ color: '#555' }}>Fuente: {p.fuente}</p>}
                </div>
            )}
        </div>,
        document.body
    );
}

// ─────────────────────────── Componente principal ───────────────────────────
export default function PizarrasVerticales({ onExit }) {
    const [vista, setVista] = useState('lista'); // lista | problema | guia | grupos | editor
    const [selId, setSelId] = useState(null);
    const [editando, setEditando] = useState(null);
    const [proyectar, setProyectar] = useState(false);
    const [mios, setMios] = useState(() => leerLS(LS_MIOS, []));
    const [sesiones, setSesiones] = useState(() => leerLS(LS_SESIONES, []));
    const [grupos, setGruposEstado] = useState(() => leerLS(LS_GRUPOS, []));
    const setGrupos = g => { setGruposEstado(g); guardarLS(LS_GRUPOS, g); };
    const [fTema, setFTema] = useState('');
    const [fNivel, setFNivel] = useState('');
    const [fTipo, setFTipo] = useState('');
    const [busca, setBusca] = useState('');
    const [imprimir, setImprimir] = useState(null); // 'alumnos' | 'profesor'
    const importRef = useRef(null);

    const todos = useMemo(() => [...PROBLEMAS, ...mios], [mios]);
    const sel = todos.find(p => p.id === selId) || null;
    const hechos = useMemo(() => new Set(sesiones.map(s => s.problema)), [sesiones]);

    const filtrados = todos.filter(p =>
        (!fTema || p.tema === fTema)
        && (!fNivel || (p.niveles || []).includes(fNivel))
        && (!fTipo || (fTipo === 'mios' ? p.propio : p.tipo === fTipo))
        && (!busca.trim() || `${p.titulo} ${p.enunciado}`.toLowerCase().includes(busca.trim().toLowerCase())));

    const guardarMios = lista => { setMios(lista); guardarLS(LS_MIOS, lista); };

    const lanzarImpresion = useCallback(modo => {
        setImprimir(modo);
        setTimeout(() => { window.print(); setImprimir(null); }, 80);
    }, []);

    const exportar = () => {
        const blob = new Blob([JSON.stringify(mios, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'mis_problemas_pizarras.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const importar = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                const datos = JSON.parse(r.result);
                if (!Array.isArray(datos)) throw new Error('formato');
                const ids = new Set(mios.map(m => m.id));
                const nuevos = datos.filter(d => d && d.titulo && d.enunciado && !ids.has(d.id)).map(d => ({ ...d, propio: true, id: d.id || `U${Math.random().toString(36).slice(2, 9)}` }));
                guardarMios([...mios, ...nuevos]);
                window.alert(`${nuevos.length} problemas importados.`);
            } catch { window.alert('El archivo no tiene el formato esperado.'); }
        };
        r.readAsText(file);
        e.target.value = '';
    };

    const pestanas = [
        ['lista', '📚 Problemas'], ['guia', '🧱 Guía del método'], ['juegos', '🎩 Juegos y acertijos'], ['grupos', '👥 Formar grupos'],
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: FONDO, overflowY: 'auto', fontFamily: "'Segoe UI', system-ui, sans-serif", color: TINTA }}>
            <style>{`
                .pv-print { display: none; }
                @media print {
                    body * { visibility: hidden !important; }
                    .pv-print, .pv-print * { visibility: visible !important; }
                    .pv-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 16mm; box-sizing: border-box; color: #000; background: #fff; }
                }
            `}</style>

            {/* Cabecera */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #7c3aed)', color: 'white', padding: '14px 16px 0' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button onClick={onExit} style={btn('rgba(255,255,255,0.18)')}>← Volver</button>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ fontWeight: 900, fontSize: '1.35rem' }}>🧱 Pizarras verticales · Problemas de ingenio</div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>Competencia matemática para aulas de pensamiento · por sentidos matemáticos (ARCOMAT · LOMLOE)</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
                        {pestanas.map(([id, lbl]) => (
                            <button key={id} onClick={() => setVista(id)} style={{
                                border: 'none', borderRadius: '10px 10px 0 0', padding: '9px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                                background: (vista === id || (id === 'lista' && (vista === 'problema' || vista === 'editor'))) ? FONDO : 'transparent',
                                color: (vista === id || (id === 'lista' && (vista === 'problema' || vista === 'editor'))) ? TINTA : 'white',
                            }}>{lbl}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ paddingTop: 16 }}>
                {vista === 'lista' && (
                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' }}>
                        {/* Temas */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 175px), 1fr))', gap: 10, marginBottom: 14 }}>
                            {TEMAS.map(t => {
                                const n = todos.filter(p => p.tema === t.id).length;
                                const on = fTema === t.id;
                                return (
                                    <button key={t.id} onClick={() => setFTema(on ? '' : t.id)} style={{
                                        textAlign: 'left', borderRadius: 14, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
                                        border: `2px solid ${t.color}`, background: on ? t.color : 'white', color: on ? 'white' : TINTA,
                                    }}>
                                        <div style={{ fontWeight: 800 }}>{t.emoji} {t.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{n} problemas · {t.desc}</div>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Filtros */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                            <button onClick={() => setFNivel('')} style={chip(!fNivel, '#334155')}>Todos los niveles</button>
                            {NIVELES.map(n => <button key={n} onClick={() => setFNivel(fNivel === n ? '' : n)} style={chip(fNivel === n, '#334155')}>{n}</button>)}
                            <span style={{ width: 8 }} />
                            <button onClick={() => setFTipo(fTipo === 'arranque' ? '' : 'arranque')} style={chip(fTipo === 'arranque', '#b45309')}>🌱 Arranque</button>
                            <button onClick={() => setFTipo(fTipo === 'curricular' ? '' : 'curricular')} style={chip(fTipo === 'curricular', '#b45309')}>Curriculares</button>
                            <button onClick={() => setFTipo(fTipo === 'mios' ? '' : 'mios')} style={chip(fTipo === 'mios', '#4338ca')}>Mis problemas ({mios.length})</button>
                            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar…" style={{ padding: '7px 12px', borderRadius: 999, border: '1.5px solid #cbd5e1', fontFamily: 'inherit', minWidth: 160, flex: '1 1 160px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                            <button onClick={() => { setEditando(null); setVista('editor'); }} style={btn('#4338ca')}>➕ Añadir problema propio</button>
                            {mios.length > 0 && <button onClick={exportar} style={btn('#e0e7ff', '#3730a3')}>⬇️ Exportar mis problemas</button>}
                            <button onClick={() => importRef.current?.click()} style={btn('#e0e7ff', '#3730a3')}>⬆️ Importar</button>
                            <input ref={importRef} type="file" accept="application/json,.json" onChange={importar} style={{ display: 'none' }} />
                        </div>
                        {fTipo === 'arranque' && <div style={{ background: '#fffbeb', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: '0.88rem' }}>🌱 Problemas «de arranque»: no dependen del temario. Úsalos en las primeras sesiones para crear la cultura de pensar en grupo.</div>}

                        {/* Tarjetas */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: 12 }}>
                            {filtrados.map(p => {
                                const t = temaDe(p.tema);
                                return (
                                    <button key={p.id} onClick={() => { setSelId(p.id); setVista('problema'); window.scrollTo?.(0, 0); }} style={{
                                        textAlign: 'left', background: 'white', borderRadius: 16, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit',
                                        border: 'none', borderTop: `5px solid ${t.color}`, boxShadow: '0 3px 10px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 6, color: TINTA,
                                    }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: t.color, fontWeight: 800 }}>
                                            {t.emoji} {t.nombre}
                                            {p.tipo === 'arranque' && <span style={{ color: '#b45309' }}>· 🌱</span>}
                                            {p.propio && <span style={{ color: '#4338ca' }}>· Mío</span>}
                                            {hechos.has(p.id) && <span title="Ya lo has registrado en alguna sesión" style={{ marginLeft: 'auto', color: '#16a34a' }}>✓ hecho</span>}
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '1.02rem' }}>{p.titulo}</div>
                                        <div style={{ fontSize: '0.84rem', color: '#4b5563', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.enunciado}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 'auto' }}>⏱ {p.minutos || 30} min · {(p.niveles || []).join(' · ')}</div>
                                    </button>
                                );
                            })}
                        </div>
                        {filtrados.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', padding: 30 }}>No hay problemas con esos filtros.</div>}
                    </div>
                )}

                {vista === 'problema' && sel && (
                    <VistaProblema
                        p={sel} grupos={grupos} sesiones={sesiones}
                        onVolver={() => setVista('lista')}
                        onProyectar={() => setProyectar(true)}
                        onEditar={() => { setEditando(sel); setVista('editor'); }}
                        onImprimir={lanzarImpresion}
                        onSesionGuardada={() => setSesiones(leerLS(LS_SESIONES, []))}
                    />
                )}
                {vista === 'guia' && <VistaGuia />}
                {vista === 'juegos' && <JuegosMagia />}
                {vista === 'grupos' && <GruposPizarras grupos={grupos} setGrupos={setGrupos} />}
                {vista === 'editor' && (
                    <EditorProblema
                        key={editando?.id || 'nuevo'}
                        inicial={editando}
                        onCancelar={() => setVista(editando ? 'problema' : 'lista')}
                        onBorrar={id => { guardarMios(mios.filter(m => m.id !== id)); setSelId(null); setVista('lista'); }}
                        onGuardar={prob => {
                            const existe = mios.some(m => m.id === prob.id);
                            guardarMios(existe ? mios.map(m => (m.id === prob.id ? prob : m)) : [...mios, prob]);
                            setSelId(prob.id); setVista('problema');
                        }}
                    />
                )}
            </div>

            {proyectar && sel && <Proyector p={sel} grupos={grupos} onClose={() => setProyectar(false)} />}
            {imprimir && <Impresion p={sel} modo={imprimir} />}
        </div>
    );
}
