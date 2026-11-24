// Canguro Matemático 2026 compartido con los alumnos por enlace (/canguro?reto=…).
//  · ModalCompartirCanguro (profesor): prueba completa de un curso o mini prueba de N preguntas de distinto valor.
//  · CanguroAlumno (alumno, sin login): hace la prueba con tiempo, se corrige al terminar y la envía al profesor.
// La configuración viaja en la URL (utils/retoLink.js): { v, nivel, preguntas?, minutos, soluciones }.
import React, { useState, useEffect, useMemo } from 'react';
import { CANGURO_INFO as INFO, CANGURO_NIVELES } from './canguro2026';
import { INTERACTIVOS } from './CanguroInteractivos';
import ModalCompartirReto from '../components/ModalCompartirReto';
import ModalEnviarResultado from '../components/retos/ModalEnviarResultado';
import { leerRetoUrl } from '../utils/retoLink';
import { guardarRegistroLocal } from '../utils/registrosLocales';

export const RUTA_CANGURO = '/canguro';
const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const COLOR_PUNTOS = { 3: '#16a34a', 4: '#ea580c', 5: '#dc2626' };
const TINTA = '#1f2937';

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', ...extra,
});
const Parrafos = ({ texto, style }) => (
    <div style={style}>{String(texto || '').split('\n').map((l, i) => <div key={i} style={{ minHeight: l ? undefined : '0.6em' }}>{l}</div>)}</div>
);

// ─────────── Puntuación (regla oficial generalizada) ───────────
// Se empieza con tantos puntos como preguntas (30 en la prueba completa); acierto +valor, fallo −valor/4, blanco 0.
export function puntuarCanguro(preguntas, resp) {
    let puntos = preguntas.length, ok = 0, mal = 0;
    preguntas.forEach(q => {
        const r = resp[q.n];
        if (!r) return;
        if (r === q.correcta) { puntos += q.puntos; ok++; } else { puntos -= q.puntos / 4; mal++; }
    });
    const max = preguntas.length + preguntas.reduce((s, q) => s + q.puntos, 0);
    return { puntos, max, ok, mal, blanco: preguntas.length - ok - mal, nota: Math.round((Math.max(0, puntos) / max) * 100) / 10 };
}

// Selección aleatoria de una mini prueba: cuántas de cada valor.
export function sortearMini(preguntas, cuantas) {
    const elegidas = [];
    [3, 4, 5].forEach(v => {
        const pool = preguntas.filter(q => q.puntos === v).map(q => q.n);
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        elegidas.push(...pool.slice(0, cuantas[v] || 0));
    });
    return elegidas.sort((a, b) => a - b);
}

// ─────────── Profesor: crear el enlace ───────────
export function ModalCompartirCanguro({ nivel, onClose }) {
    const PREG = nivel.preguntas;
    const [modo, setModo] = useState('mini');
    const [cuantas, setCuantas] = useState({ 3: 4, 4: 3, 5: 3 });
    const [sel, setSel] = useState(() => sortearMini(PREG, { 3: 4, 4: 3, 5: 3 }));
    const [minutos, setMinutos] = useState(25);
    const [soluciones, setSoluciones] = useState(true);
    const [paso, setPaso] = useState('config');

    const cambiarCuantas = (v, d) => {
        const n = { ...cuantas, [v]: Math.max(0, Math.min(10, (cuantas[v] || 0) + d)) };
        setCuantas(n);
        const s = sortearMini(PREG, n);
        setSel(s);
        setMinutos(Math.max(5, Math.round(s.length * 2.5)));
    };
    const toggle = n => {
        const s = sel.includes(n) ? sel.filter(x => x !== n) : [...sel, n].sort((a, b) => a - b);
        setSel(s);
        setCuantas({ 3: 0, 4: 0, 5: 0, ...Object.fromEntries([3, 4, 5].map(v => [v, s.filter(x => PREG.find(q => q.n === x)?.puntos === v).length])) });
    };
    const elegirModo = m => { setModo(m); setMinutos(m === 'completa' ? INFO.minutos : Math.max(5, Math.round(sel.length * 2.5))); };

    const nPreg = modo === 'completa' ? PREG.length : sel.length;
    const config = { v: 1, nivel: nivel.id, minutos: Number(minutos) || 0, soluciones, ...(modo === 'mini' ? { preguntas: sel } : {}) };
    const resumen = [
        `🦘 ${nivel.curso}`,
        modo === 'completa' ? '📝 Prueba completa (30)' : `📝 Mini prueba (${sel.length})`,
        ...(modo === 'mini' ? [3, 4, 5].filter(v => cuantas[v]).map(v => `${cuantas[v]} de ${v} puntos`) : []),
        Number(minutos) ? `⏱ ${minutos} min` : '⏱ Sin límite',
        soluciones ? '💡 Ven las soluciones al terminar' : '🔒 Solo ven su nota',
    ];

    if (paso === 'enlace') return (
        <ModalCompartirReto ruta={RUTA_CANGURO} config={config} resumen={resumen} nombreJuego={`el Canguro Matemático 2026 (${nivel.curso})`}
            onEditar={() => setPaso('config')} onClose={onClose} />
    );

    const lab = { fontWeight: 800, fontSize: '0.85rem', color: '#475569', margin: '14px 0 6px' };
    const chipModo = on => ({ flex: 1, padding: '12px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: `2px solid ${on ? '#b91c1c' : '#e5e7eb'}`, background: on ? '#fef2f2' : 'white', color: TINTA });
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(8,12,24,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px', color: TINTA, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>🔗 Compartir con los alumnos · {nivel.curso}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#64748b' }}>Los alumnos abren el enlace (sin iniciar sesión), hacen la prueba en interactivo y, al terminar, te envían el resultado con tu código de profesor. Lo verás en Informes.</p>

                <div style={lab}>Tipo de prueba</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => elegirModo('completa')} style={chipModo(modo === 'completa')}>
                        <div style={{ fontWeight: 900 }}>📝 Prueba completa</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Las 30 preguntas del curso, como el día del Canguro.</div>
                    </button>
                    <button onClick={() => elegirModo('mini')} style={chipModo(modo === 'mini')}>
                        <div style={{ fontWeight: 900 }}>⚡ Mini prueba</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Unas pocas preguntas de 3, 4 y 5 puntos.</div>
                    </button>
                </div>

                {modo === 'mini' && (
                    <>
                        <div style={lab}>Preguntas de cada valor</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            {[3, 4, 5].map(v => (
                                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, border: `2px solid ${COLOR_PUNTOS[v]}`, borderRadius: 12, padding: '4px 8px' }}>
                                    <span style={{ fontWeight: 800, color: COLOR_PUNTOS[v] }}>{v} pts</span>
                                    <button onClick={() => cambiarCuantas(v, -1)} style={btn('#f1f5f9', TINTA, { padding: '3px 10px' })}>−</button>
                                    <b style={{ minWidth: 18, textAlign: 'center' }}>{cuantas[v] || 0}</b>
                                    <button onClick={() => cambiarCuantas(v, +1)} style={btn('#f1f5f9', TINTA, { padding: '3px 10px' })}>+</button>
                                </div>
                            ))}
                            <button onClick={() => setSel(sortearMini(PREG, cuantas))} style={btn('#7c3aed')}>🎲 Sortear otras</button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 4px' }}>Elegidas: <b>{sel.length}</b>. Toca una pregunta para quitarla o añadirla a mano.</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 230, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, padding: 6 }}>
                            {PREG.map(q => {
                                const on = sel.includes(q.n);
                                return (
                                    <button key={q.n} onClick={() => toggle(q.n)} style={{
                                        display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left', padding: '5px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                        border: 'none', background: on ? '#fef2f2' : 'transparent', color: TINTA, fontSize: '0.82rem',
                                    }}>
                                        <span style={{ width: 18 }}>{on ? '☑️' : '⬜'}</span>
                                        <b style={{ color: COLOR_PUNTOS[q.puntos], minWidth: 54 }}>{q.n} · {q.puntos} pts</b>
                                        <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{q.enunciado.split('\n')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <div style={lab}>Tiempo</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="number" min={0} value={minutos} onChange={e => setMinutos(e.target.value)} style={{ width: 90, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '1rem' }} />
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>minutos (0 = sin límite). Al acabar el tiempo se corrige sola.</span>
                </div>

                <div style={lab}>Al terminar</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setSoluciones(true)} style={{ ...chipModo(soluciones), flex: '1 1 200px', padding: '8px 10px' }}>💡 Ven su nota, la respuesta correcta y la explicación de cada pregunta</button>
                    <button onClick={() => setSoluciones(false)} style={{ ...chipModo(!soluciones), flex: '1 1 200px', padding: '8px 10px' }}>🔒 Solo ven su nota (para que no se pasen las respuestas)</button>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btn('#e5e7eb', TINTA)}>Cancelar</button>
                    <button onClick={() => setPaso('enlace')} disabled={!nPreg} style={btn(nPreg ? '#b91c1c' : '#9ca3af')}>🔗 Crear enlace ({nPreg} preguntas)</button>
                </div>
            </div>
        </div>
    );
}

// ─────────── Alumno: hacer la prueba ───────────
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

function PreguntaAlumno({ q, elegida, corregida, soluciones, onResponder }) {
    const [verExp, setVerExp] = useState(false);
    const [verInter, setVerInter] = useState(false);
    useEffect(() => { setVerExp(false); setVerInter(false); }, [q.n]);
    const mostrar = corregida && soluciones;
    const inter = mostrar && q.interactivo && INTERACTIVOS[q.interactivo];

    const estilo = L => {
        const sel = elegida === L;
        let bg = 'white', borde = '#cbd5e1';
        if (sel) { bg = '#dbeafe'; borde = '#2563eb'; }
        if (mostrar) {
            if (L === q.correcta) { bg = '#dcfce7'; borde = '#16a34a'; }
            else if (sel) { bg = '#fee2e2'; borde = '#dc2626'; }
        }
        return {
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 14px', borderRadius: 12, cursor: corregida ? 'default' : 'pointer',
            border: `2.5px solid ${borde}`, background: bg, color: TINTA, fontFamily: 'inherit', fontSize: '1rem', fontWeight: 600,
        };
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e5e7eb' }}>
                <span style={{ background: COLOR_PUNTOS[q.puntos], color: 'white', borderRadius: 8, padding: '3px 10px', fontWeight: 800, fontSize: '0.85rem' }}>{q.puntos} puntos</span>
                <Parrafos texto={q.enunciado} style={{ fontSize: '1.08rem', lineHeight: 1.45, marginTop: 10 }} />
                {(q.figuras || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                        {q.figuras.map(src => <img key={src} src={src} alt="" style={{ maxWidth: '100%', maxHeight: q.figuras.length > 2 ? 110 : 280, objectFit: 'contain' }} />)}
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {q.opciones.map((o, i) => {
                    const L = LETRAS[i];
                    return (
                        <button key={L} onClick={() => !corregida && onResponder(elegida === L ? null : L)} style={estilo(L)}>
                            <span style={{ fontWeight: 900, minWidth: 26 }}>{L})</span>
                            {typeof o === 'string' ? <span>{o}</span> : <img src={o.img} alt={`Opción ${L}`} style={{ maxHeight: 70, maxWidth: '100%' }} />}
                        </button>
                    );
                })}
                {!corregida && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{elegida ? 'Toca otra vez tu respuesta para dejarla en blanco.' : 'Si no lo sabes, puedes dejarla en blanco: un fallo resta ¼ de su valor.'}</div>}
                {corregida && (
                    <div style={{ fontWeight: 900, color: !elegida ? '#64748b' : elegida === q.correcta ? '#16a34a' : '#dc2626' }}>
                        {!elegida ? '⬜ En blanco' : elegida === q.correcta ? `✅ Correcta · +${q.puntos}` : `❌ Incorrecta · −${q.puntos / 4}${soluciones ? ` (era la ${q.correcta})` : ''}`}
                    </div>
                )}
                {mostrar && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setVerExp(v => !v)} style={btn('#0f766e')}>💡 {verExp ? 'Ocultar' : 'Ver'} explicación</button>
                        {inter && <button onClick={() => setVerInter(v => !v)} style={btn('#f59e0b')}>🧪 {verInter ? 'Ocultar' : inter.titulo}</button>}
                    </div>
                )}
                {verExp && mostrar && <div style={{ background: 'white', borderRadius: 12, padding: 12, borderLeft: '5px solid #0f766e', lineHeight: 1.5 }}><b>Respuesta {q.correcta}.</b> {q.explica}</div>}
            </div>
            {verInter && inter && (
                <div style={{ gridColumn: '1 / -1', background: 'white', borderRadius: 16, padding: 16, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>🧪 {inter.titulo}</div>
                    <inter.Comp />
                </div>
            )}
        </div>
    );
}

export default function CanguroAlumno({ onExit }) {
    const [reto] = useState(() => leerRetoUrl());
    const cfg = reto?.config || {};
    const nivel = CANGURO_NIVELES.find(n => n.id === cfg.nivel);
    const preguntas = useMemo(() => {
        if (!nivel) return [];
        if (!Array.isArray(cfg.preguntas)) return nivel.preguntas;
        return cfg.preguntas.map(n => nivel.preguntas.find(q => q.n === n)).filter(Boolean);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nivel]);
    const minutos = Number(cfg.minutos) || 0;
    const soluciones = cfg.soluciones !== false;

    // Progreso guardado en el dispositivo (por si se recarga la página a mitad)
    const clave = useMemo(() => {
        try { const p = new URLSearchParams(window.location.search); return `pv_canguro_reto_${hash(`${p.get('reto')}|${p.get('t')}`)}`; } catch { return 'pv_canguro_reto_x'; }
    }, []);
    const [estado, setEstado] = useState(() => ({ fase: 'inicio', resp: {}, inicio: null, ...leerLS(clave, {}) }));
    const act = cambios => setEstado(e => { const n = { ...e, ...cambios }; guardarLS(clave, n); return n; });
    const { fase, resp, inicio } = estado;
    const [idx, setIdx] = useState(0);
    const [ahora, setAhora] = useState(Date.now());
    const [confirmar, setConfirmar] = useState(false);
    const [enviar, setEnviar] = useState(false);

    const res = useMemo(() => puntuarCanguro(preguntas, resp), [preguntas, resp]);
    const restante = fase === 'prueba' && minutos ? Math.max(0, minutos * 60 - Math.floor((ahora - inicio) / 1000)) : null;

    const terminar = () => {
        setConfirmar(false); setIdx(0);
        act({ fase: 'fin' });
        const r = puntuarCanguro(preguntas, resp);
        guardarRegistroLocal('PIZARRAS_VERTICALES', {
            titulo: `Canguro 2026 · ${nivel.curso} (${r.puntos}/${r.max})`, aciertos: r.ok, intentos: preguntas.length, nombre: 'Prueba Canguro', via: 'canguro-enlace',
        });
    };

    useEffect(() => {
        if (fase !== 'prueba' || !minutos) return undefined;
        const t = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(t);
    }, [fase, minutos]);
    useEffect(() => { if (restante === 0) terminar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [restante]);

    const marco = children => (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fef7ed', overflowY: 'auto', fontFamily: "'Segoe UI', system-ui, sans-serif", color: TINTA }}>
            <div style={{ background: 'linear-gradient(135deg, #b91c1c, #f59e0b)', color: 'white', padding: '12px 16px' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {onExit && <button onClick={onExit} style={btn('rgba(255,255,255,0.2)')}>← Salir</button>}
                    <span style={{ fontSize: '1.8rem' }}>🦘</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{reto?.titulo || INFO.titulo}</div>
                        {nivel && <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>{INFO.titulo} · {nivel.nivel}</div>}
                    </div>
                    {restante != null && <span style={{ fontWeight: 900, fontSize: '1.3rem', background: restante < 120 ? '#7f1d1d' : 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '4px 12px' }}>⏱ {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</span>}
                </div>
            </div>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 40px' }}>{children}</div>
        </div>
    );

    if (!nivel || !preguntas.length) return marco(
        <div style={{ background: 'white', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>🤔</div>
            <div style={{ fontWeight: 800 }}>Este enlace no es válido o está incompleto.</div>
            <div style={{ color: '#64748b', marginTop: 6 }}>Pide a tu profesor que te lo vuelva a enviar.</div>
        </div>,
    );

    const valores = [3, 4, 5].map(v => [v, preguntas.filter(q => q.puntos === v).length]).filter(([, c]) => c);

    if (fase === 'inicio') return marco(
        <div style={{ background: 'white', borderRadius: 18, padding: 22, maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ marginTop: 0 }}>{preguntas.length === nivel.preguntas.length ? 'Prueba completa' : 'Mini prueba'} · {nivel.curso}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '4px 10px', fontWeight: 700 }}>📝 {preguntas.length} preguntas</span>
                {valores.map(([v, c]) => <span key={v} style={{ background: COLOR_PUNTOS[v], color: 'white', borderRadius: 999, padding: '4px 10px', fontWeight: 700 }}>{c} de {v} puntos</span>)}
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '4px 10px', fontWeight: 700 }}>⏱ {minutos ? `${minutos} minutos` : 'Sin límite de tiempo'}</span>
            </div>
            <ul style={{ lineHeight: 1.6, paddingLeft: 20 }}>
                <li>Cada pregunta tiene <b>5 respuestas</b> y solo una es correcta.</li>
                <li>Empiezas con <b>{preguntas.length} puntos</b>. Cada acierto suma el valor de la pregunta y cada fallo resta <b>la cuarta parte</b>. Las preguntas en blanco no suman ni restan.</li>
                <li>Puedes ir y volver entre las preguntas y cambiar tus respuestas hasta que pulses <b>Terminar</b>.</li>
                <li>Usa papel y lápiz. No se permite calculadora.</li>
                {minutos ? <li>Cuando se acabe el tiempo, la prueba se corrige sola.</li> : null}
            </ul>
            <button onClick={() => { act({ fase: 'prueba', inicio: Date.now() }); setAhora(Date.now()); }} style={btn('#b91c1c', 'white', { fontSize: '1.1rem', padding: '12px 26px' })}>🦘 Empezar</button>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 16 }}>{INFO.credito}</div>
        </div>,
    );

    const q = preguntas[idx];
    const corregida = fase === 'fin';
    const colorCasilla = p => {
        const r = resp[p.n];
        if (!corregida) return r ? '#2563eb' : 'white';
        if (!r) return '#e5e7eb';
        if (!soluciones) return '#94a3b8';
        return r === p.correcta ? '#16a34a' : '#dc2626';
    };

    return marco(
        <>
            {corregida && (
                <div style={{ background: 'white', borderRadius: 18, padding: 18, marginBottom: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 700 }}>Tu resultado</div>
                    <div style={{ fontSize: 'clamp(2.4rem, 8vw, 4rem)', fontWeight: 900, color: '#b91c1c', lineHeight: 1.1 }}>{res.puntos} <span style={{ fontSize: '0.45em', color: '#64748b' }}>/ {res.max} puntos</span></div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, margin: '4px 0 8px' }}>Nota: {String(res.nota).replace('.', ',')} / 10</div>
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', fontWeight: 700 }}>
                        <span style={{ color: '#16a34a' }}>✅ {res.ok} correctas</span>
                        <span style={{ color: '#dc2626' }}>❌ {res.mal} incorrectas</span>
                        <span style={{ color: '#64748b' }}>⬜ {res.blanco} en blanco</span>
                    </div>
                    <button onClick={() => setEnviar(true)} style={btn('linear-gradient(135deg,#f1c40f,#e67e22)', 'white', { marginTop: 14, fontSize: '1.05rem', padding: '12px 24px' })}>📤 Enviar al profesor</button>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 8 }}>{soluciones ? 'Repasa abajo cada pregunta con su explicación.' : 'Tu profesor corregirá las preguntas en clase.'}</div>
                </div>
            )}

            {/* Navegación entre preguntas */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                {preguntas.map((p, i) => {
                    const bg = colorCasilla(p);
                    return (
                        <button key={p.n} onClick={() => setIdx(i)} title={`${p.puntos} puntos`} style={{
                            width: 38, height: 38, borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit',
                            border: i === idx ? '3px solid #111827' : `2px solid ${COLOR_PUNTOS[p.puntos]}`,
                            background: bg, color: bg === 'white' || bg === '#e5e7eb' ? TINTA : 'white',
                        }}>{i + 1}</button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <b>Pregunta {idx + 1} de {preguntas.length}</b>
                <div style={{ flex: 1 }} />
                <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} style={btn(idx === 0 ? '#cbd5e1' : '#475569')}>◀ Anterior</button>
                <button onClick={() => setIdx(i => Math.min(preguntas.length - 1, i + 1))} disabled={idx === preguntas.length - 1} style={btn(idx === preguntas.length - 1 ? '#cbd5e1' : '#475569')}>Siguiente ▶</button>
                {!corregida && <button onClick={() => setConfirmar(true)} style={btn('#16a34a')}>✔ Terminar</button>}
            </div>

            {confirmar && !corregida && (
                <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1 }}>
                        {res.blanco ? <>Te quedan <b>{res.blanco}</b> {res.blanco === 1 ? 'pregunta' : 'preguntas'} en blanco. </> : null}
                        ¿Seguro que quieres terminar? Después no podrás cambiar las respuestas.
                    </span>
                    <button onClick={() => setConfirmar(false)} style={btn('#e5e7eb', TINTA)}>Seguir</button>
                    <button onClick={terminar} style={btn('#16a34a')}>Sí, terminar</button>
                </div>
            )}

            <PreguntaAlumno q={q} elegida={resp[q.n]} corregida={corregida} soluciones={soluciones}
                onResponder={L => { const r = { ...resp }; if (L) r[q.n] = L; else delete r[q.n]; act({ resp: r }); }} />

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 16 }}>{INFO.credito}</div>

            {enviar && (
                <ModalEnviarResultado tipo="CANGURO" nombreJuego={`Canguro 2026 · ${nivel.curso}`} reto={reto} onClose={() => setEnviar(false)}
                    datos={{
                        puntos: res.puntos, puntosMax: res.max, nota: res.nota, aciertos: res.ok, intentos: preguntas.length,
                        fallos: res.mal, blanco: res.blanco, nivel: nivel.curso,
                        modo: preguntas.length === nivel.preguntas.length ? 'completa' : 'mini',
                        respuestas: preguntas.map(p => ({ n: p.n, puntos: p.puntos, r: resp[p.n] || '', ok: resp[p.n] === p.correcta })),
                    }} />
            )}
        </>,
    );
}
