// Pestaña «🦘 Canguro» de Pizarras verticales: los problemas del Canguro Matemático 2026 de cada curso (1.º ESO … 2.º Bach.)
// en interactivo (elegir respuesta, corregir, explicación, manipulaciones), con el PDF original y puntuación oficial.
import React, { useState, useEffect, useMemo } from 'react';
import { CANGURO_INFO as INFO, CANGURO_NIVELES } from './canguro2026';
import { INTERACTIVOS } from './CanguroInteractivos';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { ModalCompartirCanguro } from './CanguroReto';

const LS_NIVEL = 'pv_canguro_2026_nivel';
const claveNivel = id => `pv_canguro_2026_${id}_v1`;
const leer = id => { try { return JSON.parse(localStorage.getItem(claveNivel(id))) || {}; } catch { return {}; } };
const guardar = (id, v) => { try { localStorage.setItem(claveNivel(id), JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const COLOR_PUNTOS = { 3: '#16a34a', 4: '#ea580c', 5: '#dc2626' };

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit', ...extra,
});
const Parrafos = ({ texto, style }) => (
    <div style={style}>{String(texto || '').split('\n').map((l, i) => <div key={i} style={{ minHeight: l ? undefined : '0.6em' }}>{l}</div>)}</div>
);

export const puntuacion = (resp, PREG) => {
    let p = INFO.puntosIniciales, ok = 0, mal = 0;
    PREG.forEach(q => {
        const r = resp[q.n];
        if (!r) return;
        if (r === q.correcta) { p += q.puntos; ok++; } else { p -= q.puntos / 4; mal++; }
    });
    return { puntos: p, ok, mal, blanco: PREG.length - ok - mal };
};

// ─────────── Vista de una pregunta ───────────
function Pregunta({ q, total, pdf, resp, modoPrueba, corregida, onResponder, onAnterior, onSiguiente, grande, setGrande, onLista }) {
    const elegida = resp[q.n];
    const mostrar = !modoPrueba || corregida;
    const [verExp, setVerExp] = useState(false);
    const [verInter, setVerInter] = useState(false);
    useEffect(() => { setVerExp(false); setVerInter(false); }, [q.n]);
    const inter = q.interactivo && INTERACTIVOS[q.interactivo];
    const oscuro = grande;
    const tinta = oscuro ? 'white' : '#1f2937';
    const panel = { background: oscuro ? 'rgba(255,255,255,0.06)' : 'white', borderRadius: 16, padding: 16, border: oscuro ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e5e7eb' };
    const fs = grande ? 'clamp(1.2rem, 2.4vw, 2rem)' : '1.08rem';

    const estiloOpcion = (letra) => {
        const sel = elegida === letra;
        let bg = oscuro ? 'rgba(255,255,255,0.08)' : 'white', borde = oscuro ? 'rgba(255,255,255,0.25)' : '#cbd5e1';
        if (sel && !mostrar) { bg = oscuro ? 'rgba(59,130,246,0.35)' : '#dbeafe'; borde = '#2563eb'; }
        if (mostrar && elegida) {
            if (letra === q.correcta) { bg = oscuro ? 'rgba(22,163,74,0.35)' : '#dcfce7'; borde = '#16a34a'; }
            else if (sel) { bg = oscuro ? 'rgba(220,38,38,0.35)' : '#fee2e2'; borde = '#dc2626'; }
        }
        return {
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            border: `2.5px solid ${borde}`, background: bg, color: tinta, fontFamily: 'inherit', fontSize: grande ? 'clamp(1.05rem, 2vw, 1.6rem)' : '1rem', fontWeight: 600,
        };
    };

    const contenido = (
        <div style={{ color: tinta, maxWidth: grande ? 1400 : 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                {!grande && <button onClick={onLista} style={btn('#e5e7eb', '#1f2937')}>← Las 30</button>}
                <span style={{ background: COLOR_PUNTOS[q.puntos], color: 'white', borderRadius: 8, padding: '4px 10px', fontWeight: 800 }}>Pregunta {q.n} · {q.puntos} puntos</span>
                <div style={{ flex: 1 }} />
                <button onClick={onAnterior} disabled={q.n === 1} style={btn(q.n === 1 ? '#cbd5e1' : '#475569')}>◀</button>
                <button onClick={onSiguiente} disabled={q.n === total} style={btn(q.n === total ? '#cbd5e1' : '#475569')}>▶</button>
                <a href={`${pdf}#page=${q.pagina}`} target="_blank" rel="noreferrer" style={{ ...btn('#64748b'), textDecoration: 'none' }}>📄 En el PDF</a>
                <button onClick={() => setGrande(!grande)} style={btn(grande ? '#ef4444' : '#7c3aed')}>{grande ? '✕ Salir' : '📽️ Proyectar'}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16, alignItems: 'start' }}>
                <div style={panel}>
                    <Parrafos texto={q.enunciado} style={{ fontSize: fs, lineHeight: 1.45, fontWeight: 500 }} />
                    {(q.figuras || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: 12, background: 'white', borderRadius: 12, padding: 8 }}>
                            {q.figuras.map(src => <img key={src} src={src} alt="" style={{ maxWidth: '100%', maxHeight: grande ? '42vh' : (q.figuras.length > 2 ? 90 : 260), objectFit: 'contain' }} />)}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {q.opciones.map((o, i) => {
                        const L = LETRAS[i];
                        return (
                            <button key={L} onClick={() => onResponder(q, L)} disabled={mostrar && !!elegida} style={estiloOpcion(L)}>
                                <span style={{ fontWeight: 900, minWidth: 26 }}>{L})</span>
                                {typeof o === 'string' ? <span>{o}</span> : <img src={o.img} alt={`Opción ${L}`} style={{ maxHeight: grande ? 110 : 70, background: 'white', borderRadius: 6 }} />}
                            </button>
                        );
                    })}
                    {mostrar && elegida && (
                        <div style={{ fontWeight: 900, fontSize: grande ? '1.5rem' : '1.1rem', color: elegida === q.correcta ? '#16a34a' : '#dc2626' }}>
                            {elegida === q.correcta ? `✅ ¡Correcto! +${q.puntos}` : `❌ La correcta es la ${q.correcta}. −${q.puntos / 4}`}
                        </div>
                    )}
                    {modoPrueba && !corregida && elegida && <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>Respuesta guardada. Se corrige al terminar la prueba. (Puedes cambiarla.)</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(mostrar) && <button onClick={() => setVerExp(v => !v)} style={btn('#0f766e')}>💡 {verExp ? 'Ocultar' : 'Ver'} explicación</button>}
                        {inter && <button onClick={() => setVerInter(v => !v)} style={btn('#f59e0b')}>🧪 {verInter ? 'Ocultar' : inter.titulo}</button>}
                    </div>
                    {verExp && mostrar && (
                        <div style={{ ...panel, borderLeft: '5px solid #0f766e', fontSize: grande ? '1.3rem' : '0.98rem', lineHeight: 1.5 }}>
                            <b>Respuesta {q.correcta}.</b> {q.explica}
                        </div>
                    )}
                </div>
            </div>
            {verInter && inter && (
                <div style={{ ...panel, marginTop: 16, color: '#1f2937', background: 'white' }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>🧪 {inter.titulo}</div>
                    <inter.Comp />
                </div>
            )}
            <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: 14 }}>{INFO.credito}</div>
        </div>
    );

    if (!grande) return contenido;
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: '#0f172a', overflowY: 'auto', padding: 'clamp(12px, 3vw, 36px)', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            {contenido}
        </div>
    );
}

// ─────────── Pestaña principal ───────────
function CanguroNivel({ nivel, selector }) {
    const PREG = nivel.preguntas;
    const [datos, setDatos] = useState(() => ({ resp: {}, modoPrueba: false, corregida: false, ...leer(nivel.id) }));
    const [actual, setActual] = useState(null);
    const [grande, setGrande] = useState(false);
    const [verPdf, setVerPdf] = useState(false);
    const [compartir, setCompartir] = useState(false);
    const [inicioPrueba, setInicioPrueba] = useState(null);
    const [ahora, setAhora] = useState(Date.now());
    const { resp, modoPrueba, corregida } = datos;
    const actualiza = cambios => setDatos(d => { const n = { ...d, ...cambios }; guardar(nivel.id, n); return n; });

    useEffect(() => {
        if (!inicioPrueba || corregida) return undefined;
        const t = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(t);
    }, [inicioPrueba, corregida]);
    useEffect(() => {
        if (!grande) return undefined;
        const onKey = e => { if (e.key === 'Escape') setGrande(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [grande]);

    const res = useMemo(() => puntuacion(resp, PREG), [resp, PREG]);
    const q = actual ? PREG.find(p => p.n === actual) : null;

    const responder = (preg, letra) => {
        if (modoPrueba && !corregida) { actualiza({ resp: { ...resp, [preg.n]: letra } }); return; }
        if (resp[preg.n]) return;
        actualiza({ resp: { ...resp, [preg.n]: letra } });
        try { if (letra === preg.correcta) sonidoCorrecto(); else sonidoIncorrecto(); } catch { /* sin audio */ }
    };
    const reiniciar = (prueba) => {
        if (Object.keys(resp).length && !window.confirm('¿Borrar las respuestas de este dispositivo y empezar de nuevo?')) return;
        actualiza({ resp: {}, modoPrueba: prueba, corregida: false });
        setInicioPrueba(prueba ? Date.now() : null);
        setActual(1);
    };
    const corregir = () => {
        actualiza({ corregida: true });
        const r = puntuacion(resp, PREG);
        guardarRegistroLocal('PIZARRAS_VERTICALES', {
            titulo: `Canguro 2026 · ${nivel.curso} (${r.puntos} puntos)`, aciertos: r.ok, intentos: PREG.length, nombre: 'Prueba Canguro', via: 'canguro',
        });
    };

    const restante = inicioPrueba && !corregida ? Math.max(0, INFO.minutos * 60 - Math.floor((ahora - inicioPrueba) / 1000)) : null;
    const estadoDe = p => {
        const r = resp[p.n];
        if (!r) return 'blanco';
        if (modoPrueba && !corregida) return 'marcada';
        return r === p.correcta ? 'ok' : 'mal';
    };
    const colorEstado = { blanco: 'white', marcada: '#dbeafe', ok: '#dcfce7', mal: '#fee2e2' };

    const barra = (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'white', borderRadius: 14, padding: '10px 14px', border: '1px solid #e5e7eb', marginBottom: 14 }}>
            <span style={{ fontWeight: 800 }}>{modoPrueba ? (corregida ? '📋 Prueba corregida' : '📝 Modo prueba') : '🎯 Modo práctica'}</span>
            {(!modoPrueba || corregida) && <span>Puntos: <b style={{ fontSize: '1.15rem' }}>{res.puntos}</b> / 150 · ✅ {res.ok} · ❌ {res.mal} · ⬜ {res.blanco}</span>}
            {modoPrueba && !corregida && <span>Contestadas: <b>{res.ok + res.mal}</b> / 30</span>}
            {restante != null && <span style={{ fontWeight: 800, color: restante < 300 ? '#dc2626' : undefined }}>⏱ {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</span>}
            <div style={{ flex: 1 }} />
            {modoPrueba && !corregida && <button onClick={corregir} style={btn('#16a34a')}>✔ Terminar y corregir</button>}
            <button onClick={() => reiniciar(false)} style={btn('#0f766e')}>🎯 Practicar</button>
            <button onClick={() => reiniciar(true)} style={btn('#7c3aed')}>📝 Hacer la prueba (75 min)</button>
        </div>
    );

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' }}>
            <div style={{ background: 'linear-gradient(135deg, #b91c1c, #f59e0b)', color: 'white', borderRadius: 18, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: '2.4rem' }}>🦘</div>
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.25rem' }}>{INFO.titulo} · {nivel.nivel}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{INFO.fecha} · 30 preguntas (3, 4 y 5 puntos) · empiezas con 30 puntos y cada fallo resta ¼</div>
                </div>
                <button onClick={() => setCompartir(true)} style={btn('white', '#b91c1c')}>🔗 Compartir con alumnos</button>
                <button onClick={() => setVerPdf(v => !v)} style={btn('rgba(255,255,255,0.22)')}>📄 {verPdf ? 'Ocultar PDF' : 'Ver el PDF'}</button>
                <a href={nivel.pdf} download style={{ ...btn('rgba(255,255,255,0.22)'), textDecoration: 'none' }}>⬇️ Descargar</a>
                <a href={INFO.web} target="_blank" rel="noreferrer" style={{ ...btn('rgba(255,255,255,0.22)'), textDecoration: 'none' }}>🌐 canguromat.es</a>
            </div>

            {selector}
            {compartir && <ModalCompartirCanguro nivel={nivel} onClose={() => setCompartir(false)} />}

            {verPdf && (
                <div style={{ marginBottom: 14, background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <iframe title={`Canguro Matemático 2026 · ${nivel.curso}`} src={nivel.pdf} style={{ width: '100%', height: '78vh', border: 'none' }} />
                    <div style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        ¿No se ve? <a href={nivel.pdf} target="_blank" rel="noreferrer">Abrir el PDF en otra pestaña</a> · <a href={INFO.soluciones} target="_blank" rel="noreferrer">Soluciones oficiales (todos los niveles)</a>
                    </div>
                </div>
            )}

            {barra}

            {q ? (
                <Pregunta q={q} total={PREG.length} pdf={nivel.pdf} resp={resp} modoPrueba={modoPrueba} corregida={corregida} onResponder={responder}
                    onAnterior={() => setActual(n => Math.max(1, n - 1))} onSiguiente={() => setActual(n => Math.min(PREG.length, n + 1))}
                    grande={grande} setGrande={setGrande} onLista={() => { setActual(null); setGrande(false); }} />
            ) : (
                <>
                    {[3, 4, 5].map(pt => (
                        <div key={pt} style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 900, color: COLOR_PUNTOS[pt], marginBottom: 8 }}>Preguntas de {pt} puntos</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
                                {PREG.filter(p => p.puntos === pt).map(p => {
                                    const e = estadoDe(p);
                                    return (
                                        <button key={p.n} onClick={() => setActual(p.n)} style={{
                                            textAlign: 'left', borderRadius: 14, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
                                            border: `2px solid ${COLOR_PUNTOS[pt]}`, background: colorEstado[e], color: '#1f2937', display: 'flex', gap: 10, alignItems: 'flex-start',
                                        }}>
                                            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: COLOR_PUNTOS[pt], minWidth: 28 }}>{p.n}</span>
                                            <span style={{ flex: 1, fontSize: '0.85rem', lineHeight: 1.35 }}>
                                                {p.enunciado.split('\n')[0].slice(0, 110)}{p.enunciado.length > 110 ? '…' : ''}
                                                <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', opacity: 0.75 }}>
                                                    {p.figuras ? '🖼️ ' : ''}{p.interactivo ? '🧪 manipulable ' : ''}
                                                    {e === 'ok' && '✅'}{e === 'mal' && `❌ (${resp[p.n]})`}{e === 'marcada' && `📝 ${resp[p.n]}`}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{INFO.credito} Las explicaciones son de Pikt. Las respuestas se guardan solo en este dispositivo.</div>
                </>
            )}
        </div>
    );
}

// ─────────── Selector de curso ───────────
export default function CanguroPizarras() {
    const [nivelId, setNivelId] = useState(() => {
        try { return localStorage.getItem(LS_NIVEL) || '1eso'; } catch { return '1eso'; }
    });
    const nivel = CANGURO_NIVELES.find(n => n.id === nivelId) || CANGURO_NIVELES[0];
    const elegir = id => { setNivelId(id); try { localStorage.setItem(LS_NIVEL, id); } catch { /* sin almacenamiento */ } };
    const selector = (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', marginRight: 4 }}>Curso:</span>
            {CANGURO_NIVELES.map(n => {
                const on = n.id === nivel.id;
                const hechas = Object.keys(leer(n.id).resp || {}).length;
                return (
                    <button key={n.id} onClick={() => elegir(n.id)} title={n.nivel} style={{
                        padding: '7px 13px', borderRadius: 999, border: '2px solid #b91c1c', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit',
                        fontSize: '0.85rem', background: on ? '#b91c1c' : 'white', color: on ? 'white' : '#b91c1c',
                    }}>{n.curso}{hechas ? ` · ${hechas}/30` : ''}</button>
                );
            })}
        </div>
    );
    return <CanguroNivel key={nivel.id} nivel={nivel} selector={selector} />;
}
