// Dinámicas de aula (DINAMICAS_AULA, /dinamicas): 10 dinámicas activas para orquestar desde la PDI
// (tiempos, turnos, equipos y contenido por materia) + fichas imprimibles para el profe y cada grupo.
// Basado en ideas de @myteachingexperience.
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
    DINAMICAS, MATERIAS, BANCOS, AGRUPAMIENTOS, EQUIPOS_BASE, TIPOS_BANCO, CREDITO, CREDITO_URL,
    dinamicaDe, materiaDe, ajustesPorDefecto, contenidoDe, leerPropios, guardarPropio, bancoATexto, barajar, recursoATexto,
} from './dinamicas';
import { PROYECTORES, Confeti } from './Proyectores';
import ImpresionDinamica, { CSS_IMPRESION } from './FichasDinamica';
import { sonidoActivo, setSonidoActivo } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { despertar } from './sonidos';

const GruposPizarras = lazy(() => import('../pizarrasVerticales/GruposPizarras'));
const BuscadorRecursos = lazy(() => import('../MoneyBoard').then(m => ({ default: m.BuscadorRecursos })));

const TINTA = '#1f2937';
const FUENTE = "'Fredoka', 'Nunito', 'Segoe UI', system-ui, sans-serif";
const leerLS = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 14, padding: '10px 16px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'inherit', boxShadow: '0 3px 0 rgba(0,0,0,0.15)', ...extra,
});
const chip = (activo, color) => ({
    padding: '6px 12px', borderRadius: 999, border: `2px solid ${color}`, cursor: 'pointer', fontWeight: 700,
    fontSize: '0.85rem', background: activo ? color : 'white', color: activo ? 'white' : color, fontFamily: 'inherit',
});
const tarjeta = (extra = {}) => ({ background: 'white', borderRadius: 20, padding: 18, boxShadow: '0 6px 20px rgba(0,0,0,0.06)', ...extra });

const CSS_ANIM = `
@keyframes da-pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes da-latido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes da-latido-suave { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes da-caer { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(540deg); opacity: 0.6; } }
@keyframes da-rodar { 0% { transform: rotate(0) scale(1); } 50% { transform: rotate(200deg) scale(0.85); } 100% { transform: rotate(360deg) scale(1); } }
@keyframes da-bailar { 0%,100% { transform: rotate(-8deg) translateY(0); } 50% { transform: rotate(8deg) translateY(-12px); } }
@keyframes da-explosion { 0% { transform: scale(0.3); filter: brightness(3); } 40% { transform: scale(1.25); } 60% { transform: scale(0.95) rotate(-2deg); } 80% { transform: rotate(2deg); } 100% { transform: scale(1); filter: none; } }
@keyframes da-temblor { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-10px); } 40%,80% { transform: translateX(10px); } }
@keyframes da-deslizar { 0% { transform: translateX(-30px); } 100% { transform: translateX(30px); } }
@keyframes da-girar-texto { 0% { transform: translateY(-6px); opacity: 0.4; } 100% { transform: translateY(6px); opacity: 1; } }
.da-pop { animation: da-pop 0.4s ease-out both; }
.da-latido { animation: da-latido 0.6s ease-in-out infinite; }
.da-latido-suave { animation: da-latido-suave 1.4s ease-in-out infinite; }
.da-caer { animation: da-caer linear forwards; }
.da-rodar { animation: da-rodar 0.3s linear infinite; }
.da-bailar { animation: da-bailar 0.5s ease-in-out infinite; display: inline-block; }
.da-explosion { animation: da-explosion 0.8s ease-out both; }
.da-temblor { animation: da-temblor 0.4s ease-in-out; }
.da-deslizar { animation: da-deslizar 0.8s ease-in-out infinite alternate; }
.da-girar-texto { animation: da-girar-texto 0.08s linear infinite; }
.da-card:hover { transform: translateY(-5px) rotate(-0.5deg); box-shadow: 0 14px 30px rgba(0,0,0,0.12) !important; }
`;

// Repartos según el agrupamiento
const repartir = (n) => (nombres) => {
    const a = barajar(nombres);
    const g = Array.from({ length: Math.max(1, Math.min(n, a.length)) }, () => []);
    a.forEach((x, i) => g[i % g.length].push(x));
    return g;
};
const enDosFilas = (nombres) => { const a = barajar(nombres); return [a.filter((_, i) => i % 2 === 0), a.filter((_, i) => i % 2 === 1)]; };

export default function DinamicasAula({ onExit }) {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const [dinId, setDinId] = useState(() => (dinamicaDe(params.get('d')) ? params.get('d') : null));
    const [materiaId, setMateriaId] = useState(() => (MATERIAS.some(m => m.id === params.get('m')) ? params.get('m') : leerLS('da_materia_v1', 'ingles')));
    const [filtro, setFiltro] = useState('todas');
    const [cfgs, setCfgs] = useState(() => leerLS('da_cfg_v1', {}));
    const [nEquipos, setNEquipos] = useState(() => leerLS('da_nequipos_v1', 4));
    const [grupos, setGrupos] = useState([]);
    const [verGrupos, setVerGrupos] = useState(false);
    const [proyector, setProyector] = useState(false);
    const [modalPdf, setModalPdf] = useState(false);
    const [imprimir, setImprimir] = useState(null);
    const [compartir, setCompartir] = useState(false);
    const [versionContenido, setVersionContenido] = useState(0);
    const [sonido, setSonido] = useState(() => sonidoActivo());
    const [guardado, setGuardado] = useState(false);
    const stats = useRef({ a: 0, n: 0 });

    // Fuente Fredoka (divertida y legible en la PDI y en las fichas)
    useEffect(() => {
        if (document.getElementById('da-fredoka')) return;
        const l = document.createElement('link');
        l.id = 'da-fredoka'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap';
        document.head.appendChild(l);
    }, []);

    const din = dinId ? dinamicaDe(dinId) : null;
    const materia = materiaDe(materiaId);
    useEffect(() => { guardarLS('da_materia_v1', materiaId); }, [materiaId]);
    useEffect(() => { guardarLS('da_nequipos_v1', nEquipos); }, [nEquipos]);

    // URL compartible: /dinamicas?d=<id>&m=<materia>
    useEffect(() => {
        const base = window.location.pathname.startsWith('/dinamicas') ? '/dinamicas' : window.location.pathname;
        const q = new URLSearchParams(window.location.search);
        if (din) { q.set('d', din.id); q.set('m', materiaId); } else { q.delete('d'); q.delete('m'); }
        const s = q.toString();
        window.history.replaceState(window.history.state, '', `${base}${s ? `?${s}` : ''}`);
    }, [din, materiaId]);

    useEffect(() => { setGrupos([]); }, [dinId]);

    const cfg = din ? { ...ajustesPorDefecto(din), ...(cfgs[din.id] || {}) } : {};
    const setCfg = (k, v) => setCfgs(prev => { const n = { ...prev, [din.id]: { ...(prev[din.id] || {}), [k]: v } }; guardarLS('da_cfg_v1', n); return n; });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const contenido = useMemo(() => (din ? contenidoDe(din, materiaId) : []), [din, materiaId, versionContenido]);
    const extra = useMemo(() => ({
        pistas: BANCOS[materiaId]?.pistas || BANCOS.propio.pistas,
        piezas: BANCOS[materiaId]?.piezas,
    }), [materiaId]);

    const esFilas = din?.agrupamiento === 'filas';
    const filas = esFilas && grupos.length === 2 ? grupos : null;
    const equipos = useMemo(() => {
        const n = !esFilas && grupos.length ? grupos.length : nEquipos;
        return Array.from({ length: n }, (_, i) => ({ ...EQUIPOS_BASE[i % EQUIPOS_BASE.length], miembros: (!esFilas && grupos[i]) || [] }));
    }, [grupos, nEquipos, esFilas]);

    const url = din ? `${window.location.origin}/dinamicas?d=${din.id}&m=${materiaId}` : `${window.location.origin}/dinamicas`;

    // Impresión: montar el portal, imprimir y desmontar
    useEffect(() => {
        if (!imprimir) return undefined;
        const fin = () => setImprimir(null);
        window.addEventListener('afterprint', fin);
        const t = setTimeout(() => window.print(), 600); // deja cargar la fuente y el QR
        return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); };
    }, [imprimir]);

    const abrirProyector = () => {
        despertar(); stats.current = { a: 0, n: 0 }; setGuardado(false); setProyector(true);
        try { document.documentElement.requestFullscreen?.(); } catch { /* sin pantalla completa */ }
    };
    const cerrarProyector = () => { setProyector(false); try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* */ } };
    const guardarSesion = () => {
        const { a, n } = stats.current;
        guardarRegistroLocal('DINAMICAS_AULA', { titulo: `${din.nombre} · ${materia.nombre}`, aciertos: a, intentos: n, porcentaje: n ? Math.round((a / n) * 100) : 100, via: 'proyector' });
        setGuardado(true);
    };

    const estilos = <style>{CSS_ANIM + CSS_IMPRESION}</style>;
    const impresion = imprimir && din && (
        <ImpresionDinamica din={din} materia={materia} cfg={cfg} contenido={contenido} extra={extra} equipos={equipos} filas={filas} opciones={imprimir} url={url} />
    );

    // ─────────────────────────── PROYECTOR ───────────────────────────
    if (proyector && din) {
        const Escena = PROYECTORES[din.id];
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10000, overflowY: 'auto', fontFamily: FUENTE, color: 'white', background: `radial-gradient(circle at 20% 0%, ${din.color}, #1e1b4b 75%)` }}>
                {estilos}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <button onClick={cerrarProyector} style={btn('rgba(255,255,255,0.18)')}>← Salir</button>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 800, fontSize: 'clamp(1.1rem, 2.6vw, 1.6rem)' }}>{din.emoji} {din.nombre}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{materia.emoji} {materia.nombre} · {CREDITO}</div>
                    </div>
                    <button onClick={() => setSonido(setSonidoActivo(!sonido))} title="Sonido" style={btn('rgba(255,255,255,0.18)')}>{sonido ? '🔊' : '🔇'}</button>
                    <button onClick={() => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch { /* */ } }} title="Pantalla completa" style={btn('rgba(255,255,255,0.18)')}>⛶</button>
                    <button onClick={guardarSesion} disabled={guardado} style={btn(guardado ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.18)')}>{guardado ? '✔ Guardada' : '🏁 Guardar sesión'}</button>
                </div>
                <div style={{ padding: '6px 16px 30px', maxWidth: 1400, margin: '0 auto' }}>
                    <Escena key={`${din.id}-${materiaId}-${versionContenido}`} din={din} cfg={cfg} contenido={contenido} extra={extra} equipos={equipos} filas={filas}
                        onStat={(ok) => { stats.current.n += 1; if (ok) stats.current.a += 1; }} />
                </div>
            </div>
        );
    }

    // ─────────────────────────── CATÁLOGO ───────────────────────────
    const cabecera = (
        <div style={{ background: 'linear-gradient(120deg, #f97316, #ec4899 45%, #8b5cf6)', color: 'white', padding: '14px 16px 22px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: -60, fontSize: 200, opacity: 0.12, transform: 'rotate(12deg)', pointerEvents: 'none' }}>🎲</div>
            <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => (din ? setDinId(null) : onExit?.())} style={btn('rgba(255,255,255,0.2)')}>← {din ? 'Todas las dinámicas' : 'Volver'}</button>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setCompartir(true)} style={btn('rgba(255,255,255,0.2)')}>🔗 Compartir</button>
                </div>
                <div style={{ fontWeight: 700, fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', marginTop: 10, lineHeight: 1.1 }}>🎉 Dinámicas de aula</div>
                <div style={{ fontSize: '1rem', opacity: 0.95, marginTop: 4 }}>Juego, movimiento y conversación para cualquier materia. PiKT marca los tiempos, los turnos y los equipos en la PDI.</div>
                <a href={CREDITO_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 10, background: 'white', color: '#be185d', borderRadius: 999, padding: '5px 14px', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', transform: 'rotate(-1.5deg)' }}>
                    ✨ {CREDITO}
                </a>
            </div>
        </div>
    );

    const selectorMateria = (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MATERIAS.map(m => <button key={m.id} onClick={() => setMateriaId(m.id)} style={chip(materiaId === m.id, m.color)}>{m.emoji} {m.nombre}</button>)}
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: '#fff7ed', fontFamily: FUENTE, color: TINTA }}>
            {estilos}
            {cabecera}
            {!din ? (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 16px 40px' }}>
                    <div style={{ ...tarjeta({ padding: 14 }), marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><b>📚 Materia del contenido:</b> <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>preguntas, palabras y retos listos (puedes cambiarlos por los tuyos)</span></div>
                        {selectorMateria}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <b style={{ marginRight: 4 }}>👥 Agrupamiento:</b>
                            <button onClick={() => setFiltro('todas')} style={chip(filtro === 'todas', '#334155')}>Todas</button>
                            {Object.entries(AGRUPAMIENTOS).map(([k, a]) => <button key={k} onClick={() => setFiltro(k)} style={chip(filtro === k, '#334155')}>{a.emoji} {a.nombre}</button>)}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(270px, 100%), 1fr))', gap: 16 }}>
                        {DINAMICAS.filter(d => filtro === 'todas' || d.agrupamiento === filtro).map((d, i) => (
                            <button key={d.id} className="da-card" onClick={() => setDinId(d.id)} style={{
                                ...tarjeta({ padding: 0 }), border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: TINTA,
                                overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', display: 'flex', flexDirection: 'column',
                            }}>
                                <div style={{ background: `linear-gradient(135deg, ${d.color}, ${d.color}aa)`, padding: '14px 16px', color: 'white', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                                    <span style={{ fontSize: 44, transform: `rotate(${i % 2 ? 8 : -8}deg)` }}>{d.emoji}</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.15 }}>{d.nombre}</div>
                                        <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>«{d.original}»</div>
                                    </div>
                                    <span style={{ position: 'absolute', top: 8, right: 10, background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{i + 1}</span>
                                </div>
                                <div style={{ padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                    <div style={{ fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.4, flex: 1 }}>{d.resumen.length > 170 ? `${d.resumen.slice(0, 167)}…` : d.resumen}</div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 700 }}>
                                        <span style={{ background: `${d.color}1f`, color: d.color, borderRadius: 999, padding: '3px 9px' }}>{AGRUPAMIENTOS[d.agrupamiento].emoji} {AGRUPAMIENTOS[d.agrupamiento].nombre}</span>
                                        <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '3px 9px' }}>⏱️ {d.minutos} min</span>
                                        <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '3px 9px' }}>🖨️ Fichas</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <Detalle din={din} materia={materia} selectorMateria={selectorMateria} cfg={cfg} setCfg={setCfg} contenido={contenido} materiaId={materiaId}
                    nEquipos={nEquipos} setNEquipos={setNEquipos} grupos={grupos} setGrupos={setGrupos} equipos={equipos} filas={filas}
                    onGrupos={() => setVerGrupos(true)} onProyector={abrirProyector} onPdf={() => setModalPdf(true)} onCompartir={() => setCompartir(true)}
                    onContenido={() => setVersionContenido(v => v + 1)} />
            )}

            {verGrupos && din && (
                <Modal onClose={() => setVerGrupos(false)} ancho={1000} fondo="#f1f5f9">
                    <Suspense fallback={<div style={{ padding: 30, textAlign: 'center' }}>Cargando…</div>}>
                        <GruposPizarras
                            grupos={grupos} setGrupos={setGrupos}
                            formar={esFilas ? enDosFilas : din.agrupamiento === 'equipos' ? repartir(nEquipos) : undefined}
                            titulo={esFilas ? '↔️ Reparto en dos filas' : din.agrupamiento === 'equipos' ? `👥 Sorteo en ${nEquipos} equipos` : '🎲 Grupos de 3 o 4'}
                            descripcion={esFilas ? 'La fila A se queda quieta y la fila B rota. PiKT mostrará las parejas de cada cita.' : din.agrupamiento === 'equipos' ? 'Los alumnos se reparten al azar en los equipos. Cambia el número de equipos en la configuración.' : 'Grupos aleatorios de 3; si sobran alumnos, algunos serán de 4.'}
                            nombreGrupo={esFilas ? (i => (i ? '🔵 Fila B (rota)' : '🔴 Fila A (fija)')) : (i => `${EQUIPOS_BASE[i % 8].emoji} ${din.agrupamiento === 'equipos' ? EQUIPOS_BASE[i % 8].nombre : `Grupo ${i + 1}`}`)}
                        />
                    </Suspense>
                    <div style={{ textAlign: 'center', paddingBottom: 10 }}><button onClick={() => setVerGrupos(false)} style={btn('#16a34a')}>✔ Usar estos grupos</button></div>
                </Modal>
            )}

            {modalPdf && din && <ModalPdf din={din} grupos={grupos} equipos={equipos} onClose={() => setModalPdf(false)} onImprimir={(o) => { setModalPdf(false); setImprimir(o); }} />}
            {compartir && <ModalCompartir url={url} titulo={din ? `${din.emoji} ${din.nombre}` : '🎉 Dinámicas de aula'} onClose={() => setCompartir(false)} />}
            {impresion}
        </div>
    );
}

// ─────────────────────────── Detalle y configuración ───────────────────────────
function Detalle({ din, materia, selectorMateria, cfg, setCfg, contenido, materiaId, nEquipos, setNEquipos, grupos, setGrupos, equipos, filas, onGrupos, onProyector, onPdf, onCompartir, onContenido }) {
    const clave = `${din.id}:${materiaId}`;
    const propio = leerPropios()[clave];
    const [texto, setTexto] = useState(() => propio ?? bancoATexto(din.banco, BANCOS[materiaId]?.[din.banco] || []));
    useEffect(() => {
        const p = leerPropios()[clave];
        setTexto(p ?? bancoATexto(din.banco, BANCOS[materiaId]?.[din.banco] || []));
    }, [clave, din.banco, materiaId]);
    const editar = (t) => { setTexto(t); guardarPropio(clave, t); onContenido(); };
    const restaurar = () => { guardarPropio(clave, null); setTexto(bancoATexto(din.banco, BANCOS[materiaId]?.[din.banco] || [])); onContenido(); };
    const [importar, setImportar] = useState(false);
    const puedeImportar = din.banco !== 'estructuras';
    const importarRecurso = (r, cats) => {
        const t = recursoATexto(din.banco, cats);
        setImportar(false);
        if (!t) { window.alert('Ese recurso no tiene preguntas que se puedan usar aquí.'); return; }
        if (leerPropios()[clave] != null && !window.confirm(`Se cambiará tu contenido de «${materia.nombre}» por las preguntas de «${r.titulo || 'el recurso'}». ¿Seguimos?`)) return;
        editar(t);
    };
    const tipo = TIPOS_BANCO[din.banco];
    const avisoCantidad = din.banco === 'estructuras' && contenido.length < 6 ? '⚠️ Necesitas 6 líneas (una por número del dado).'
        : din.id === 'sobres' && contenido.length < 10 ? `⚠️ Hay ${contenido.length} retos: el juego tendrá ${contenido.length} sobres.` : '';
    const agr = AGRUPAMIENTOS[din.agrupamiento];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 16px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
            {/* Columna izquierda: la dinámica */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ ...tarjeta({ padding: 0 }), overflow: 'hidden' }}>
                    <div style={{ background: `linear-gradient(135deg, ${din.color}, ${din.color}aa)`, color: 'white', padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <span style={{ fontSize: 56 }}>{din.emoji}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.1 }}>{din.nombre}</div>
                            <div style={{ opacity: 0.9 }}>«{din.original}» · {agr.emoji} {agr.nombre} · ⏱️ {din.minutos} min</div>
                        </div>
                    </div>
                    <div style={{ padding: 18 }}>
                        <p style={{ marginTop: 0, fontSize: '1rem', lineHeight: 1.5 }}>{din.resumen}</p>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>🪜 Paso a paso</div>
                        <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.55 }}>{din.pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                    </div>
                </div>
                <div style={tarjeta()}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>🌈 En cada materia</div>
                    <p style={{ margin: '0 0 6px' }}><b>🗣️ Idiomas:</b> {din.variantes.idiomas}</p>
                    <p style={{ margin: '0 0 6px' }}><b>➗ Matemáticas:</b> {din.variantes.mates}</p>
                    <p style={{ margin: 0 }}><b>📚 Otras:</b> {din.variantes.otras}</p>
                </div>
                <div style={tarjeta()}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>⭐ Notas para el profe</div>
                    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>{[...din.preparacion, ...din.consejos].map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
            </div>

            {/* Columna derecha: preparar la sesión */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ ...tarjeta(), display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={onProyector} style={btn(din.color, 'white', { fontSize: '1.15rem', padding: '14px 22px', flex: '1 1 220px' })}>📽️ Lanzar en la PDI</button>
                    <button onClick={onPdf} style={btn('#7c3aed', 'white', { flex: '1 1 140px' })}>🖨️ Fichas PDF</button>
                    <button onClick={onCompartir} style={btn('#0ea5e9', 'white', { flex: '1 1 120px' })}>🔗 Compartir</button>
                </div>

                <div style={tarjeta()}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>📚 Materia</div>
                    {selectorMateria}
                </div>

                {(din.ajustes || []).length > 0 && (
                    <div style={tarjeta()}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>⏱️ Tiempos y reglas</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
                            {din.ajustes.map(a => (
                                <label key={a.k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem', fontWeight: 600 }}>
                                    {a.label}
                                    {a.opciones
                                        ? <select value={cfg[a.k]} onChange={e => setCfg(a.k, e.target.value)} style={inputS}>{a.opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                                        : <input type="number" min={a.min} max={a.max} value={cfg[a.k]} onChange={e => setCfg(a.k, Math.max(a.min, Math.min(a.max, Number(e.target.value) || a.min)))} style={inputS} />}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {din.agrupamiento !== 'parejas' && (
                    <div style={tarjeta()}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>{din.agrupamiento === 'filas' ? '↔️ Filas' : '👥 Equipos y grupos'}</div>
                        {din.agrupamiento !== 'filas' && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                                <span style={{ fontSize: '0.9rem' }}>Número de {din.agrupamiento === 'grupos' ? 'grupos' : 'equipos'}:</span>
                                {[2, 3, 4, 5, 6, 7, 8].map(n => <button key={n} onClick={() => { setNEquipos(n); setGrupos([]); }} style={chip(nEquipos === n && !grupos.length, '#334155')}>{n}</button>)}
                            </div>
                        )}
                        {din.agrupamiento !== 'filas' && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                {equipos.map((e, i) => (
                                    <span key={i} style={{ background: `${e.color}1f`, border: `2px solid ${e.color}`, borderRadius: 12, padding: '4px 10px', fontSize: '0.85rem' }}>
                                        <b style={{ color: e.color }}>{e.emoji} {e.nombre}</b>{e.miembros.length ? <span style={{ color: '#4b5563' }}> · {e.miembros.join(', ')}</span> : null}
                                    </span>
                                ))}
                            </div>
                        )}
                        {filas && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                {filas.map((g, i) => (
                                    <span key={i} style={{ background: '#f1f5f9', borderRadius: 12, padding: '4px 10px', fontSize: '0.85rem' }}>
                                        <b>{i ? '🔵 Fila B' : '🔴 Fila A'}</b> · {g.join(', ')}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={onGrupos} style={btn('#2563eb')}>🎲 {grupos.length ? 'Volver a sortear' : 'Sortear con mi lista de clase'}</button>
                            {grupos.length > 0 && <button onClick={() => setGrupos([])} style={btn('#f1f5f9', TINTA)}>✕ Quitar nombres</button>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 6 }}>
                            {din.agrupamiento === 'filas' ? 'Con la lista, PiKT dice quién se sienta con quién en cada cita.' : 'Opcional: los nombres salen en el marcador y en la ficha de cada equipo.'}
                        </div>
                    </div>
                )}

                <div style={tarjeta()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, flex: 1 }}>📋 Contenido · {tipo.nombre}</div>
                        {puedeImportar && <button onClick={() => setImportar(true)} style={btn('#1e3a8a', 'white', { padding: '6px 12px', fontSize: '0.8rem' })}>{din.id === 'tablero' ? '💰 Usar un tablero de Money Board' : '📥 Importar de un recurso PiKT'}</button>}
                        {leerPropios()[clave] != null && materiaId !== 'propio' && <button onClick={restaurar} style={btn('#f1f5f9', TINTA, { padding: '6px 12px', fontSize: '0.8rem' })}>↺ Restaurar el de PiKT</button>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6 }}>
                        {tipo.ayuda} Tus cambios se guardan en este dispositivo para «{materia.nombre}».
                        {din.id === 'tablero' && <> Escribe una línea <b>«# Categoría»</b> antes de sus retos y el tablero se verá por columnas, como en Money Board (10, 20, 30… puntos por fila).</>}
                    </div>
                    <textarea value={texto} onChange={e => editar(e.target.value)} rows={10} spellCheck={false}
                        placeholder={din.banco === 'retos' ? '¿Capital de Francia? | París\n7 × 8 | 56' : 'Una línea por elemento…'}
                        style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid #d1d5db', padding: 10, fontFamily: 'inherit', fontSize: '0.92rem', lineHeight: 1.45 }} />
                    <div style={{ fontSize: '0.8rem', color: avisoCantidad ? '#b45309' : '#6b7280', marginTop: 4 }}>{contenido.length} elementos. {avisoCantidad}</div>
                    {importar && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10002 }}>
                            <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#0f1f4d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>}>
                                <BuscadorRecursos minCats={1} onBack={() => setImportar(false)} onPick={importarRecurso}
                                    ayuda={din.id === 'tablero'
                                        ? <>Elige un tablero de <b>Money Board</b> o cualquier recurso: cada <b>hoja</b> será una columna del tablero sorpresa (máx. 6 columnas y 5 filas).</>
                                        : <>Las preguntas del recurso sustituirán el contenido de «{materia.nombre}». {din.banco === 'retos' ? 'La respuesta correcta queda como solución.' : din.banco === 'palabras' ? 'Se usan las respuestas correctas como palabras.' : 'Se usan los enunciados.'}</>} />
                            </Suspense>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
const inputS = { padding: '8px 10px', borderRadius: 10, border: '1.5px solid #d1d5db', fontFamily: 'inherit', fontSize: '0.95rem' };

// ─────────────────────────── Modales ───────────────────────────
function Modal({ children, onClose, ancho = 520, fondo = 'white' }) {
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 12px' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: fondo, borderRadius: 22, width: `min(${ancho}px, 100%)`, padding: 18, position: 'relative', boxSizing: 'border-box', fontFamily: FUENTE, color: TINTA }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
                {children}
            </div>
        </div>
    );
}

function ModalPdf({ din, grupos, equipos, onClose, onImprimir }) {
    const porAlumno = din.agrupamiento === 'parejas' || din.agrupamiento === 'filas';
    const alumnos = grupos.flat().length;
    const [o, setO] = useState({ profe: true, grupos: true, tarjetas: ['preguntas', 'palabras', 'estructuras'].includes(din.banco) || ['kaboom', 'sobres'].includes(din.id), copias: alumnos || 1 });
    const t = (k) => setO(p => ({ ...p, [k]: !p[k] }));
    const opcion = (k, emoji, titulo, desc) => (
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: o[k] ? `${din.color}14` : '#f8fafc', border: `2px solid ${o[k] ? din.color : '#e2e8f0'}`, borderRadius: 14, padding: '10px 12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!o[k]} onChange={() => t(k)} style={{ marginTop: 4 }} />
            <div><div style={{ fontWeight: 700 }}>{emoji} {titulo}</div><div style={{ fontSize: '0.83rem', color: '#6b7280' }}>{desc}</div></div>
        </label>
    );
    return (
        <Modal onClose={onClose}>
            <div style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: 4 }}>🖨️ Fichas para imprimir</div>
            <div style={{ fontSize: '0.88rem', color: '#6b7280', marginBottom: 12 }}>En la ventana de impresión elige <b>«Guardar como PDF»</b> para compartirlas con otros profes o subirlas a tu aula virtual.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opcion('profe', '👩‍🏫', 'Ficha del profesor', 'Paso a paso, tiempos, adaptación por materias, contenido con soluciones, tabla de observación y QR para lanzarla en la PDI.')}
                {opcion('grupos', porAlumno ? '🧒' : '👥', porAlumno ? 'Ficha del alumno/a' : `Una ficha por equipo (${equipos.length})`, porAlumno ? 'Reglas y hoja de registro para cada alumno.' : 'Reglas, nombres del equipo y hoja de trabajo de la dinámica.')}
                {porAlumno && o.grupos && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 12, fontSize: '0.9rem' }}>
                        Copias: <input type="number" min={1} max={40} value={o.copias} onChange={e => setO(p => ({ ...p, copias: Math.max(1, Math.min(40, Number(e.target.value) || 1)) }))} style={{ ...inputS, width: 80 }} />
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>(o 1 y fotocópiala)</span>
                    </label>
                )}
                {opcion('tarjetas', '✂️', din.banco === 'estructuras' ? 'Dado para recortar' : din.id === 'kaboom' ? 'Palitos para el bote (con KABOOM)' : din.id === 'sobres' ? `Retos para los sobres (${Math.max(1, equipos.length)} juegos)` : 'Tarjetas recortables', 'Con el contenido de la materia elegida.')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button onClick={onClose} style={btn('#f1f5f9', TINTA)}>Cancelar</button>
                <button onClick={() => onImprimir(o)} disabled={!o.profe && !o.grupos && !o.tarjetas} style={btn(din.color)}>🖨️ Imprimir / PDF</button>
            </div>
        </Modal>
    );
}

function ModalCompartir({ url, titulo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = async () => {
        try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt('Copia el enlace:', url); }
    };
    const texto = `${titulo} · Dinámica de aula en PiKT (${CREDITO}): ${url}`;
    return (
        <Modal onClose={onClose} ancho={440}>
            <div style={{ textAlign: 'center' }}>
                <Confeti n={14} />
                <div style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 10 }}>🔗 Compartir {titulo}</div>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(url)}`} alt="QR" style={{ width: 200, height: 200, borderRadius: 14, border: '4px solid #f1f5f9' }} />
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '8px 10px', fontSize: '0.85rem', wordBreak: 'break-all', margin: '10px 0' }}>{url}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={copiar} style={btn('#2563eb')}>{copiado ? '✔ Copiado' : '📋 Copiar enlace'}</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" style={{ ...btn('#16a34a'), textDecoration: 'none' }}>💬 WhatsApp</a>
                    {navigator.share && <button onClick={() => navigator.share({ title: titulo, text: texto, url }).catch(() => {})} style={btn('#7c3aed')}>📤 Más…</button>}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 10 }}>El enlace abre la dinámica con la misma materia. Las fichas en PDF se comparten desde «🖨️ Fichas PDF».</div>
            </div>
        </Modal>
    );
}
