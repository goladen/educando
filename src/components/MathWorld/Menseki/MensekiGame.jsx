// Menseki (laberintos de áreas): 15 retos de Primaria + 15 de Secundaria
// + retos generados al azar (generadorMenseki.js) + ficha PDF de varios retos.
// Se usa suelto (/primaria/menseki, a pantalla completa con onExit) y como
// pestaña de Pizarras verticales (embebido). Progreso en localStorage, sin login.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MENSEKI_BASE } from '../../../data/mensekiData';
import MensekiBoard from './MensekiBoard';
import ModalPdfMenseki from './ModalPdfMenseki';
import { generarRetoMenseki } from './generadorMenseki';
import { sonidoCorrecto, sonidoIncorrecto, sonidoPasar, despertarAudio } from '../../../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../../../utils/registrosLocales';

const LS_RESUELTOS = 'menseki_resueltos_v1';
const LS_POSICION = 'menseki_posicion_v1';
const LS_GENERADOS = 'menseki_generados_v1';
const MAX_GENERADOS = 30;

const leerLS = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const ETAPAS = [
    { id: 'primaria', label: 'Primaria', emoji: '🎒', color: '#0d9488' },
    { id: 'secundaria', label: 'Secundaria', emoji: '🎓', color: '#4338ca' },
    { id: 'generados', label: 'Generados', emoji: '🎲', color: '#c2410c' },
];
const DIFICULTADES = [[1, 'Fácil'], [2, 'Media'], [3, 'Difícil']];

const chip = (activo, color) => ({
    border: `2px solid ${activo ? color : '#e2e8f0'}`, background: activo ? color : 'white', color: activo ? 'white' : '#334155',
    borderRadius: 10, padding: '7px 12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem',
});

const TINTA = '#1f2937';
const MAX_DIGITOS = 5;

const Estrellas = ({ n, tam = 12, color = '#f59e0b' }) => (
    <span style={{ fontSize: tam, letterSpacing: -1, lineHeight: 1, whiteSpace: 'nowrap' }} aria-label={`Dificultad ${n} de 5`}>
        <span style={{ color }}>{'★'.repeat(n)}</span><span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - n)}</span>
    </span>
);

const CSS = `
.mk-main { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr); gap: 18px; align-items: start; }
@media (max-width: 920px) { .mk-main { grid-template-columns: minmax(0, 1fr); } }
.mk-niveles { display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 6px; }
@media (max-width: 920px) { .mk-niveles { grid-template-columns: repeat(8, minmax(0, 1fr)); } }
@media (max-width: 480px) { .mk-niveles { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.mk-tecla { border: none; border-radius: 16px; font-size: 1.7rem; font-weight: 900; min-height: 62px; cursor: pointer;
  background: white; color: ${TINTA}; box-shadow: 0 4px 0 #cbd5e1, 0 6px 12px rgba(0,0,0,0.06); font-family: inherit;
  transition: transform .06s, box-shadow .06s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.mk-tecla:active { transform: translateY(3px); box-shadow: 0 1px 0 #cbd5e1; }
.mk-tecla:disabled { opacity: .45; cursor: default; }
@keyframes mk-sacudir { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-8px); } 40%, 60% { transform: translateX(8px); } }
.mk-sacudir { animation: mk-sacudir .5s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes mk-pulso { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.mk-pulso { animation: mk-pulso 1.6s ease-in-out infinite; }
@keyframes mk-entrar { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
.mk-entrar { animation: mk-entrar .3s ease-out both; }
@keyframes mk-bote { 0% { transform: scale(.6); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
.mk-bote { display: inline-block; animation: mk-bote .45s ease-out both; }
`;

export default function MensekiGame({ onExit = null, embebido = false, nivelInicial = null }) {
    const [etapa, setEtapa] = useState(() => nivelInicial || leerLS(LS_POSICION, {}).etapa || 'primaria');
    const [indices, setIndices] = useState(() => ({ primaria: 0, secundaria: 0, generados: 0, ...(leerLS(LS_POSICION, {}).indices || {}) }));
    const [generados, setGenerados] = useState(() => { const g = leerLS(LS_GENERADOS, []); return Array.isArray(g) ? g : []; });
    const [genNivel, setGenNivel] = useState(() => { const e = nivelInicial || leerLS(LS_POSICION, {}).etapa; return e === 'secundaria' ? 'secundaria' : 'primaria'; });
    const [genDif, setGenDif] = useState(2);
    const [confirmarVaciar, setConfirmarVaciar] = useState(false);
    const [verPdf, setVerPdf] = useState(false);
    const [resueltos, setResueltos] = useState(() => new Set(leerLS(LS_RESUELTOS, [])));
    const [entrada, setEntrada] = useState('');
    const [estado, setEstado] = useState('jugando'); // jugando | fallo | acierto | solucion
    const [verPista, setVerPista] = useState(false);
    const [intentos, setIntentos] = useState(0);
    const [sacudida, setSacudida] = useState(0);

    const retos = useMemo(() => (etapa === 'generados' ? generados : MENSEKI_BASE.filter(r => r.nivel === etapa)), [etapa, generados]);
    const idx = Math.min(indices[etapa] || 0, Math.max(0, retos.length - 1));
    const reto = retos[idx];
    const colorEtapa = ETAPAS.find(e => e.id === etapa)?.color || '#0d9488';
    const terminado = estado === 'acierto' || estado === 'solucion';

    useEffect(() => { guardarLS(LS_POSICION, { etapa, indices }); }, [etapa, indices]);

    // Reinicio al cambiar de reto
    useEffect(() => { setEntrada(''); setEstado('jugando'); setVerPista(false); setIntentos(0); }, [reto?.id]);

    const irA = useCallback((i, et = etapa) => {
        setEtapa(et);
        setIndices(prev => ({ ...prev, [et]: i }));
    }, [etapa]);

    // Reto nuevo al azar: se guarda en «Generados» (los últimos MAX_GENERADOS) y se abre.
    const generar = useCallback((nivel = genNivel, dif = genDif) => {
        const r = generarRetoMenseki(nivel, dif);
        if (!r) return;
        setGenerados(prev => {
            const lista = [...prev, r].slice(-MAX_GENERADOS);
            guardarLS(LS_GENERADOS, lista);
            setIndices(ind => ({ ...ind, generados: lista.length - 1 }));
            return lista;
        });
        setEtapa('generados');
    }, [genNivel, genDif]);

    const vaciarGenerados = () => {
        setGenerados([]); guardarLS(LS_GENERADOS, []);
        setIndices(ind => ({ ...ind, generados: 0 }));
        setConfirmarVaciar(false);
    };

    const siguiente = useCallback(() => {
        // Siguiente sin resolver a partir del actual; si no queda ninguno, el siguiente sin más
        // (en «Generados» se crea uno nuevo).
        for (let k = 1; k <= retos.length; k++) {
            const j = (idx + k) % retos.length;
            if (!resueltos.has(retos[j].id)) { irA(j); return; }
        }
        if (etapa === 'generados') { generar(); return; }
        irA((idx + 1) % retos.length);
    }, [idx, retos, resueltos, irA, etapa, generar]);

    const comprobar = useCallback(() => {
        if (!reto || terminado || entrada === '') return;
        despertarAudio();
        const n = intentos + 1;
        setIntentos(n);
        if (Number(entrada) === reto.solucion) {
            setEstado('acierto');
            sonidoCorrecto();
            setResueltos(prev => {
                const s = new Set(prev); s.add(reto.id);
                guardarLS(LS_RESUELTOS, [...s]);
                return s;
            });
            guardarRegistroLocal('MENSEKI', { titulo: `${reto.generado ? 'Generado · ' : ''}${reto.nivel === 'primaria' ? 'Primaria' : 'Secundaria'} · ${reto.titulo}`, aciertos: 1, intentos: n });
        } else {
            setEstado('fallo');
            setSacudida(s => s + 1);
            sonidoIncorrecto();
        }
    }, [reto, terminado, entrada, intentos]);

    const pulsar = useCallback((d) => {
        if (terminado) return;
        setEstado(e => (e === 'fallo' ? 'jugando' : e));
        setEntrada(v => (v.length >= MAX_DIGITOS ? v : (v === '0' ? String(d) : v + d)));
    }, [terminado]);
    const borrar = useCallback(() => {
        if (terminado) return;
        setEstado(e => (e === 'fallo' ? 'jugando' : e));
        setEntrada(v => v.slice(0, -1));
    }, [terminado]);

    const verSolucion = () => { setEstado('solucion'); setVerPista(true); sonidoPasar(); };

    // Teclado físico
    useEffect(() => {
        const onKey = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey || e.altKey || verPdf || !reto) return;
            if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pulsar(e.key); }
            else if (e.key === 'Backspace') { e.preventDefault(); borrar(); }
            else if (e.key === 'Enter') { e.preventDefault(); if (terminado) siguiente(); else comprobar(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pulsar, borrar, comprobar, siguiente, terminado, verPdf, reto]);

    const hechosEtapa = retos.filter(r => resueltos.has(r.id)).length;
    const queBuscar = reto?.unidad === 'cm²' ? 'el área del rectángulo marcado con ?' : 'la longitud marcada con ?';
    const nombreEtapa = etapa === 'primaria' ? 'Primaria' : etapa === 'secundaria' ? 'Secundaria' : 'Generados';

    const botonesCabecera = (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => generar()} style={{ ...chip(false, '#c2410c'), borderColor: '#fdba74', color: '#c2410c' }} title="Crear un reto nuevo al azar">🎲 Generar reto</button>
            <button onClick={() => setVerPdf(true)} style={{ ...chip(false, '#0d9488'), borderColor: '#5eead4', color: '#0f766e' }} title="Imprimir varios retos en PDF">🖨️ Fichas PDF</button>
        </div>
    );

    const contenido = (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: embebido ? '0 16px 40px' : '16px 16px 40px', color: TINTA, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <style>{CSS}</style>

            {/* Cabecera */}
            {!embebido && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    {onExit && <button onClick={onExit} style={{ background: colorEtapa, color: 'white', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>← Volver</button>}
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 900, fontSize: '1.5rem' }}>📐 Menseki · Laberintos de áreas</div>
                        <div style={{ fontSize: '0.88rem', color: '#64748b' }}>Encuentra la medida que falta usando solo áreas y lados. ¡Sin fórmulas raras ni decimales!</div>
                    </div>
                    {botonesCabecera}
                </div>
            )}
            {embebido && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontWeight: 900, fontSize: '1.25rem' }}>📐 Menseki · Laberintos de áreas</div>
                        <div style={{ fontSize: '0.86rem', color: '#64748b' }}>Ideal para pizarra: proyecta la figura, deja que cada grupo la resuelva y usa el lápiz para anotar medidas intermedias.</div>
                    </div>
                    {botonesCabecera}
                </div>
            )}

            {/* Etapas */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {ETAPAS.map(e => {
                    const lista = e.id === 'generados' ? generados : MENSEKI_BASE.filter(r => r.nivel === e.id);
                    const n = lista.length;
                    const h = lista.filter(r => resueltos.has(r.id)).length;
                    const activo = etapa === e.id;
                    return (
                        <button key={e.id} onClick={() => setEtapa(e.id)} style={{
                            border: `2px solid ${e.color}`, background: activo ? e.color : 'white', color: activo ? 'white' : e.color,
                            borderRadius: 14, padding: '9px 16px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.98rem',
                        }}>{e.emoji} {e.label} ({n}) <span style={{ opacity: 0.8, fontWeight: 700, fontSize: '0.82rem' }}>· {h}/{n} ✓</span></button>
                    );
                })}
            </div>

            {/* Generador */}
            {etapa === 'generados' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff7ed', border: '2px dashed #fdba74', borderRadius: 16, padding: '10px 12px', marginBottom: 10 }}>
                    <span style={{ fontWeight: 900, color: '#c2410c' }}>🎲 Reto nuevo:</span>
                    {[['primaria', 'Primaria'], ['secundaria', 'Secundaria']].map(([id, l]) => (
                        <button key={id} onClick={() => setGenNivel(id)} style={chip(genNivel === id, '#c2410c')}>{l}</button>
                    ))}
                    <span style={{ width: 1, height: 26, background: '#fdba74' }} />
                    {DIFICULTADES.map(([d, l]) => (
                        <button key={d} onClick={() => setGenDif(d)} style={chip(genDif === d, '#c2410c')}>{l}</button>
                    ))}
                    <button onClick={() => generar()} style={{ ...chip(true, '#c2410c'), padding: '8px 16px', fontSize: '0.95rem' }}>Generar</button>
                    <span style={{ flex: 1 }} />
                    {generados.length > 0 && (confirmarVaciar ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#9a3412' }}>
                            ¿Borrar los {generados.length} retos generados?
                            <button onClick={vaciarGenerados} style={chip(true, '#b91c1c')}>Sí, borrar</button>
                            <button onClick={() => setConfirmarVaciar(false)} style={chip(false, '#64748b')}>No</button>
                        </span>
                    ) : (
                        <button onClick={() => setConfirmarVaciar(true)} style={chip(false, '#64748b')}>🗑️ Vaciar lista</button>
                    ))}
                </div>
            )}

            {!reto && (
                <div style={{ background: 'white', borderRadius: 20, padding: '40px 20px', textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: 54 }}>🎲</div>
                    <div style={{ fontWeight: 900, fontSize: '1.2rem', margin: '8px 0 4px' }}>Todavía no has generado ningún reto</div>
                    <div style={{ color: '#64748b', marginBottom: 16 }}>Elige la etapa y la dificultad y pulsa «Generar». Cada reto es nuevo y siempre tiene solución con números enteros.</div>
                    <button onClick={() => generar()} style={{ ...chip(true, '#c2410c'), padding: '12px 22px', fontSize: '1.05rem' }}>🎲 Generar mi primer reto</button>
                </div>
            )}

            {reto && (<>
            {/* Selector de retos */}
            <div className="mk-niveles" style={{ background: 'white', borderRadius: 18, padding: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                {retos.map((r, i) => {
                    const activo = i === idx;
                    const hecho = resueltos.has(r.id);
                    return (
                        <button key={r.id} onClick={() => irA(i)} title={r.titulo} style={{
                            position: 'relative', border: `2px solid ${activo ? colorEtapa : hecho ? '#86efac' : '#e2e8f0'}`,
                            background: activo ? colorEtapa : hecho ? '#f0fdf4' : '#f8fafc', color: activo ? 'white' : TINTA,
                            borderRadius: 12, padding: '6px 2px 5px', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: 52,
                        }}>
                            <span style={{ fontWeight: 900, fontSize: '1.05rem' }}>{i + 1}</span>
                            <Estrellas n={r.dificultad} tam={9} color={activo ? '#fde68a' : '#f59e0b'} />
                            {hecho && <span style={{ position: 'absolute', top: -7, right: -6, background: '#16a34a', color: 'white', borderRadius: '50%', width: 19, height: 19, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>✓</span>}
                        </button>
                    );
                })}
            </div>

            <div className="mk-main">
                {/* Izquierda: figura */}
                <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ background: colorEtapa, color: 'white', borderRadius: 10, padding: '4px 10px', fontWeight: 900, fontSize: '0.85rem' }}>Reto {idx + 1}/{retos.length}</span>
                        <span style={{ fontWeight: 900, fontSize: '1.2rem', flex: 1, minWidth: 140 }}>{reto.titulo}</span>
                        <Estrellas n={reto.dificultad} tam={18} />
                        {resueltos.has(reto.id) && <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.85rem' }}>✓ Resuelto</span>}
                    </div>
                    <MensekiBoard reto={reto} revelado={terminado} />
                </div>

                {/* Derecha: respuesta y ayudas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 10 }}>Calcula {queBuscar}.</div>

                        {/* Pantalla de la respuesta */}
                        <div key={sacudida} className={estado === 'fallo' ? 'mk-sacudir' : undefined} style={{
                            display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: '10px 16px', marginBottom: 12,
                            border: `3px solid ${estado === 'acierto' ? '#16a34a' : estado === 'fallo' ? '#dc2626' : estado === 'solucion' ? '#d97706' : '#cbd5e1'}`,
                            background: estado === 'acierto' ? '#f0fdf4' : estado === 'fallo' ? '#fef2f2' : '#f8fafc',
                        }}>
                            <span style={{ flex: 1, textAlign: 'right', fontSize: '2.4rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', minHeight: 50, letterSpacing: 1, color: entrada ? TINTA : '#cbd5e1' }}>
                                {estado === 'solucion' ? reto.solucion : (entrada || '?')}
                            </span>
                            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: colorEtapa, minWidth: 54 }}>{reto.unidad}</span>
                        </div>

                        {/* Teclado numérico */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
                            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d => (
                                <button key={d} className="mk-tecla" onClick={() => pulsar(d)} disabled={terminado}>{d}</button>
                            ))}
                            <button className="mk-tecla" onClick={borrar} disabled={terminado} aria-label="Borrar" style={{ background: '#fee2e2', color: '#b91c1c' }}>⌫</button>
                            <button className="mk-tecla" onClick={() => pulsar('0')} disabled={terminado}>0</button>
                            <button className="mk-tecla" onClick={comprobar} disabled={terminado || !entrada} aria-label="Comprobar"
                                style={{ background: '#16a34a', color: 'white', boxShadow: '0 4px 0 #15803d' }}>✓</button>
                        </div>
                        {!terminado && (
                            <button onClick={comprobar} disabled={!entrada} style={{
                                width: '100%', marginTop: 10, border: 'none', borderRadius: 16, padding: '14px', fontSize: '1.15rem', fontWeight: 900,
                                background: entrada ? colorEtapa : '#cbd5e1', color: 'white', cursor: entrada ? 'pointer' : 'default', fontFamily: 'inherit',
                            }}>Comprobar</button>
                        )}
                        {terminado && (
                            <button onClick={siguiente} className="mk-entrar" style={{
                                width: '100%', marginTop: 10, border: 'none', borderRadius: 16, padding: '16px', fontSize: '1.25rem', fontWeight: 900,
                                background: 'linear-gradient(135deg, #16a34a, #0d9488)', color: 'white', cursor: 'pointer', fontFamily: 'inherit',
                                boxShadow: '0 6px 16px rgba(22,163,74,0.35)',
                            }}>Siguiente reto →</button>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>También con el teclado: números, ⌫ y Enter</div>
                    </div>

                    {/* Mensajes */}
                    {estado === 'fallo' && (
                        <div className="mk-entrar" style={{ background: '#fef2f2', border: '2px solid #fecaca', color: '#991b1b', borderRadius: 16, padding: '12px 14px', fontWeight: 700 }}>
                            ¡Casi! Revisa tus cálculos e inténtalo otra vez{!verPista ? ', o pide una pista' : ''}. 💪
                        </div>
                    )}
                    {estado === 'acierto' && (
                        <div className="mk-entrar" style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 16, padding: '14px 16px' }}>
                            <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#15803d', marginBottom: 6 }}>
                                <span className="mk-bote">🎉</span> ¡Correcto! {reto.solucion} {reto.unidad}
                                {intentos === 1 && <span style={{ fontSize: '0.85rem', fontWeight: 800, marginLeft: 8, color: '#16a34a' }}>a la primera</span>}
                            </div>
                            <PasoAPaso texto={reto.explicacion} />
                            {hechosEtapa === retos.length && <div style={{ marginTop: 8, fontWeight: 800, color: '#0f766e' }}>{etapa === 'generados' ? '🎲 ¡Todos tus retos generados resueltos! «Siguiente reto» crea uno nuevo.' : `🏆 ¡Has resuelto los ${retos.length} retos de ${nombreEtapa}!`}</div>}
                        </div>
                    )}
                    {estado === 'solucion' && (
                        <div className="mk-entrar" style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 16, padding: '14px 16px' }}>
                            <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#b45309', marginBottom: 6 }}>Solución: {reto.solucion} {reto.unidad}</div>
                            <PasoAPaso texto={reto.explicacion} />
                        </div>
                    )}

                    {/* Ayudas */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setVerPista(v => !v)} style={{
                            flex: 1, border: '2px solid #f59e0b', background: verPista ? '#f59e0b' : 'white', color: verPista ? 'white' : '#b45309',
                            borderRadius: 14, padding: '12px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem',
                        }}>💡 Pista</button>
                        <button onClick={verSolucion} disabled={terminado} style={{
                            flex: 1, border: '2px solid #64748b', background: 'white', color: '#334155', opacity: terminado ? 0.5 : 1,
                            borderRadius: 14, padding: '12px', fontWeight: 900, cursor: terminado ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '1rem',
                        }}>👁️ Ver solución</button>
                    </div>
                    {verPista && (
                        <div className="mk-entrar" style={{ background: '#fffbeb', border: '2px dashed #fbbf24', borderRadius: 16, padding: '12px 14px', color: '#78350f', fontWeight: 600, lineHeight: 1.45 }}>
                            💡 {reto.pista}
                        </div>
                    )}
                </div>
            </div>
            </>)}

            {verPdf && <ModalPdfMenseki onClose={() => setVerPdf(false)} generados={generados} seleccionInicial={reto ? [reto.id] : []} />}
        </div>
    );

    if (embebido) return contenido;
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(180deg, #ecfeff 0%, #f8fafc 260px)' }}>
            {contenido}
        </div>
    );
}

// La explicación viene en frases; cada una es un paso.
function PasoAPaso({ texto }) {
    const pasos = String(texto || '').split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ0-9(])/).filter(Boolean);
    return (
        <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.55, color: TINTA, fontWeight: 600 }}>
            {pasos.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
        </ol>
    );
}
