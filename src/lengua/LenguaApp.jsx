// ═══════════════════════════════════════════════════════════════════
//  LENGUA — hub de la antigua herramienta «Sintaxis»
//  Temas: Sintaxis (SintaxisGamen2, sin cambios) · Ortografía ·
//  Morfología · Semántica y léxico. Cada ejercicio se juega en
//  Práctica (10 preguntas + envío al profe), Contrarreloj o
//  Competición por equipos (tirón de cuerda).
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import SintaxisGame from '../SintaxisGamen2';
import { leerRetoUrl } from '../utils/retoLink';
import { CompeticionCuerda } from '../components/TironCuerdaEscena';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal, despertarAudio, sonidoActivo, setSonidoActivo } from '../utils/sonidosFeedback';
import { TEMAS, temaPorId, configPorDefecto, resumenConfig, barajar, CAMPOS } from './ejercicios';
import BotonFichas from '../components/BotonFichas';

const PRACTICA_N = 10;
const PRACTICA_N_EMPAREJAR = 4;
const DURACIONES = [60, 90, 120, 180];

const useEsMovil = () => {
    const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 720);
    useEffect(() => { const f = () => setM(window.innerWidth < 720); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
    return m;
};

// ── Estilos comunes ─────────────────────────────────────────────────
const S = {
    pagina: { position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(160deg,#fdf6ec 0%,#f3f6fd 100%)', fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif", color: '#2c3e50' },
    barra: { position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #ece6da' },
    btnVolver: { padding: '8px 14px', borderRadius: 12, border: '2px solid #e0d8c8', background: 'white', fontWeight: 800, cursor: 'pointer', color: '#5d4e37', fontFamily: 'inherit', fontSize: '0.88rem' },
    titulo: { flex: 1, textAlign: 'center', fontWeight: 900, fontSize: 'clamp(1rem,3.5vw,1.3rem)' },
    contenido: { maxWidth: 960, margin: '0 auto', padding: '18px 16px 40px' },
    tarjeta: { background: 'white', borderRadius: 20, boxShadow: '0 6px 22px rgba(60,40,10,0.08)', padding: 20 },
    chip: (activo, color) => ({ padding: '7px 13px', borderRadius: 20, border: `2px solid ${color}`, background: activo ? color : 'white', color: activo ? 'white' : color, fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem', fontFamily: 'inherit' }),
    btnGrande: (color) => ({ padding: '14px 22px', borderRadius: 16, border: 'none', background: color, color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 6px 16px ${color}55` }),
};

function Barra({ titulo, onVolver, textoVolver = '← Volver', derecha = null }) {
    const [sonido, setSonido] = useState(() => sonidoActivo());
    return (
        <div style={S.barra}>
            {onVolver ? <button onClick={onVolver} style={S.btnVolver}>{textoVolver}</button> : <div style={{ width: 70 }} />}
            <div style={S.titulo}>{titulo}</div>
            {derecha}
            <button onClick={() => { setSonidoActivo(!sonido); setSonido(!sonido); }} title={sonido ? 'Silenciar' : 'Activar sonido'}
                style={{ ...S.btnVolver, padding: '8px 10px' }}>{sonido ? '🔊' : '🔇'}</button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function LenguaApp({ onExit, usuario, recurso, isHost, codigoSala, temaInicial = null }) {
    // Recursos de Sintaxis del profesor, retos por enlace y salas en vivo → directos a Sintaxis
    const [directoSintaxis] = useState(() => !!(recurso || isHost || codigoSala || leerRetoUrl()));
    const [temaId, setTemaId] = useState(temaInicial);
    const [ej, setEj] = useState(null);
    const salir = () => (typeof onExit === 'function' ? onExit() : window.location.assign('/'));

    if (directoSintaxis) return <SintaxisGame onExit={onExit} usuario={usuario} recurso={recurso} isHost={isHost} codigoSala={codigoSala} />;
    if (temaId === 'SINTAXIS') return <SintaxisGame onExit={() => setTemaId(null)} usuario={usuario} />;

    const tema = temaPorId(temaId);
    if (tema && ej) return <PantallaEjercicio tema={tema} ej={ej} onVolver={() => setEj(null)} />;
    if (tema) return <PantallaTema tema={tema} onElegir={setEj} onVolver={() => setTemaId(null)} />;
    return <PantallaInicio onElegir={setTemaId} onSalir={salir} />;
}

// ── Inicio: los 4 temas ─────────────────────────────────────────────
function PantallaInicio({ onElegir, onSalir }) {
    return (
        <div style={S.pagina}>
            <Barra titulo="📖 Lengua" onVolver={onSalir} textoVolver="← Salir" />
            <div style={S.contenido}>
                <p style={{ textAlign: 'center', color: '#7a6a55', margin: '4px 0 20px', fontSize: '0.98rem' }}>
                    Elige un bloque. Todos los ejercicios se generan al momento: ¡nunca se acaban!
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16 }}>
                    {TEMAS.map(t => (
                        <button key={t.id} onClick={() => onElegir(t.id)}
                            style={{ ...S.tarjeta, border: `3px solid ${t.color}22`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform .15s' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                            <div style={{ width: 58, height: 58, borderRadius: 16, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>{t.emoji}</div>
                            <div style={{ fontWeight: 900, fontSize: '1.2rem', color: t.color }}>{t.nombre}</div>
                            <div style={{ fontSize: '0.86rem', color: '#6b6355', lineHeight: 1.45 }}>{t.desc}</div>
                            {t.ejercicios && <div style={{ fontSize: '0.75rem', color: '#a09682', fontWeight: 700 }}>{t.ejercicios.length} ejercicios</div>}
                        </button>
                    ))}
                </div>

                {/* Fichas imprimibles de Lengua (para el profesor) */}
                <div style={{ marginTop: 18, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
                    <BotonFichas materia="sintaxis" color="#7B1FA2" texto="Fichas de Lengua para imprimir" subtexto="Sintaxis, ortografía, morfología y léxico · PDF y corrección en la pizarra" />
                </div>
            </div>
        </div>
    );
}

// ── Lista de ejercicios de un tema ──────────────────────────────────
function PantallaTema({ tema, onElegir, onVolver }) {
    return (
        <div style={S.pagina}>
            <Barra titulo={`${tema.emoji} ${tema.nombre}`} onVolver={onVolver} />
            <div style={S.contenido}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
                    {tema.ejercicios.map(e => (
                        <button key={e.id} onClick={() => onElegir(e)}
                            style={{ ...S.tarjeta, padding: 16, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', gap: 14, alignItems: 'center', border: '2px solid transparent' }}
                            onMouseEnter={ev => { ev.currentTarget.style.borderColor = tema.color; }}
                            onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'transparent'; }}>
                            <div style={{ fontSize: '2rem', flexShrink: 0 }}>{e.emoji}</div>
                            <div>
                                <div style={{ fontWeight: 900, color: tema.color, fontSize: '1rem' }}>{e.nombre}{e.soloEso && <span style={{ marginLeft: 6, fontSize: '0.68rem', background: '#8e44ad', color: 'white', borderRadius: 8, padding: '2px 6px' }}>ESO</span>}</div>
                                <div style={{ fontSize: '0.82rem', color: '#6b6355', marginTop: 3, lineHeight: 1.4 }}>{e.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Configuración + elección de modo ────────────────────────────────
function PantallaEjercicio({ tema, ej, onVolver }) {
    const [cfg, setCfg] = useState(() => configPorDefecto(ej));
    const [modo, setModo] = useState(null);
    const [duracion, setDuracion] = useState(90);

    if (ej.especial === 'RULETA_CAMPOS') return <RuletaCampos onVolver={onVolver} />;
    if (modo === 'COMPETICION') return <ModoCompeticionLengua tema={tema} ej={ej} cfg={cfg} onVolver={() => setModo(null)} />;
    if (modo) return <Sesion tema={tema} ej={ej} cfg={cfg} modo={modo} duracion={duracion} onVolver={() => setModo(null)} />;

    const toggleMulti = (key, v) => setCfg(c => {
        const actual = c[key] || [];
        const nuevo = actual.includes(v) ? actual.filter(x => x !== v) : [...actual, v];
        return { ...c, [key]: nuevo.length ? nuevo : actual };
    });

    return (
        <div style={S.pagina}>
            <Barra titulo={`${ej.emoji} ${ej.nombre}`} onVolver={onVolver} />
            <div style={{ ...S.contenido, maxWidth: 720 }}>
                <div style={{ ...S.tarjeta, marginBottom: 16 }}>
                    <p style={{ marginTop: 0, color: '#6b6355' }}>{ej.desc}</p>
                    {(ej.config || []).map(c => (
                        <div key={c.key} style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#8a7c66', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                {c.opciones.map(o => {
                                    const activo = c.multi ? (cfg[c.key] || []).includes(o.v) : cfg[c.key] === o.v;
                                    return <button key={String(o.v)} onClick={() => (c.multi ? toggleMulti(c.key, o.v) : setCfg(x => ({ ...x, [c.key]: o.v })))} style={S.chip(activo, tema.color)}>{o.l}</button>;
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                    <TarjetaModo emoji="📝" titulo="Práctica" color="#2980b9"
                        texto={`${ej.id === 'emparejar' ? PRACTICA_N_EMPAREJAR + ' tableros' : PRACTICA_N + ' preguntas'} con explicación. Al final puedes enviar el resultado al profe.`}
                        onClick={() => { despertarAudio(); setModo('PRACTICA'); }} />
                    <TarjetaModo emoji="⏱️" titulo="Contrarreloj" color="#e67e22"
                        texto="¿Cuántas aciertas antes de que se acabe el tiempo?"
                        extra={<div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }} onClick={e => e.stopPropagation()}>
                            {DURACIONES.map(d => <button key={d} onClick={() => setDuracion(d)} style={{ ...S.chip(duracion === d, '#e67e22'), padding: '4px 9px', fontSize: '0.75rem' }}>{d}s</button>)}
                        </div>}
                        onClick={() => { despertarAudio(); setModo('CONTRARRELOJ'); }} />
                    {!ej.sinCompeticion && (
                        <TarjetaModo emoji="🪢" titulo="Competición por equipos" color="#c0392b"
                            texto="Dos equipos en la pizarra digital: cada acierto tira de la cuerda."
                            onClick={() => { despertarAudio(); setModo('COMPETICION'); }} />
                    )}
                </div>
            </div>
        </div>
    );
}

function TarjetaModo({ emoji, titulo, texto, color, onClick, extra }) {
    return (
        <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
            style={{ ...S.tarjeta, padding: 16, cursor: 'pointer', borderTop: `5px solid ${color}` }}>
            <div style={{ fontSize: '1.8rem' }}>{emoji}</div>
            <div style={{ fontWeight: 900, color, fontSize: '1.05rem', margin: '4px 0' }}>{titulo}</div>
            <div style={{ fontSize: '0.82rem', color: '#6b6355', lineHeight: 1.4 }}>{texto}</div>
            {extra}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  SESIÓN: práctica / contrarreloj
// ═══════════════════════════════════════════════════════════════════
function Sesion({ tema, ej, cfg, modo, duracion, onVolver }) {
    const esCrono = modo === 'CONTRARRELOJ';
    const total = ej.id === 'emparejar' ? PRACTICA_N_EMPAREJAR : PRACTICA_N;
    const nueva = useCallback(() => ({ ...ej.generar(cfg), _id: Math.random() }), [ej, cfg]);
    const [q, setQ] = useState(nueva);
    const [respondida, setRespondida] = useState(null); // null | true | false
    const [aciertos, setAciertos] = useState(0);
    const [intentos, setIntentos] = useState(0);
    const [tiempo, setTiempo] = useState(duracion);
    const [fin, setFin] = useState(false);
    const [envio, setEnvio] = useState(false);
    const inicio = useRef(Date.now());
    const timeoutRef = useRef(null);

    useEffect(() => () => clearTimeout(timeoutRef.current), []);
    useEffect(() => {
        if (!esCrono || fin) return undefined;
        const id = setInterval(() => setTiempo(t => {
            if (t <= 1) { clearInterval(id); setFin(true); return 0; }
            return t - 1;
        }), 1000);
        return () => clearInterval(id);
    }, [esCrono, fin]);
    useEffect(() => { if (fin) sonidoFinal(); }, [fin]);

    const siguiente = () => {
        clearTimeout(timeoutRef.current);
        if (!esCrono && intentos >= total) { setFin(true); return; }
        setRespondida(null);
        setQ(nueva());
    };

    const resolver = (ok) => {
        if (respondida !== null || fin) return;
        setRespondida(ok);
        setIntentos(n => n + 1);
        if (ok) { setAciertos(n => n + 1); sonidoCorrecto(); } else sonidoIncorrecto();
        if (esCrono) timeoutRef.current = setTimeout(siguiente, ok ? 700 : 2200);
    };

    const reiniciar = () => {
        setAciertos(0); setIntentos(0); setTiempo(duracion); setFin(false); setRespondida(null); setQ(nueva()); inicio.current = Date.now();
    };

    const porcentaje = intentos ? Math.round((aciertos / intentos) * 100) : 0;
    const datosEnvio = {
        aciertos, intentos, porcentaje, tiempo: Math.round((Date.now() - inicio.current) / 1000),
        config: { tema: tema.nombre, ejercicio: ej.nombre, modo: esCrono ? `Contrarreloj ${duracion}s` : 'Práctica', ajustes: resumenConfig(ej, cfg) },
    };

    if (fin) return (
        <div style={S.pagina}>
            <Barra titulo={`${ej.emoji} ${ej.nombre}`} onVolver={onVolver} />
            <div style={{ ...S.contenido, maxWidth: 520 }}>
                <div style={{ ...S.tarjeta, textAlign: 'center', padding: 28 }}>
                    <div style={{ fontSize: '3.4rem' }}>{porcentaje >= 80 ? '🏆' : porcentaje >= 50 ? '👍' : '💪'}</div>
                    <h2 style={{ margin: '6px 0 4px' }}>{esCrono ? '¡Tiempo!' : '¡Terminado!'}</h2>
                    <div style={{ fontSize: '2.6rem', fontWeight: 900, color: porcentaje >= 80 ? '#27ae60' : porcentaje >= 50 ? '#e67e22' : '#e74c3c' }}>{aciertos} / {intentos}</div>
                    <div style={{ color: '#8a7c66', marginBottom: 18 }}>{porcentaje}% de aciertos</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button onClick={() => setEnvio(true)} disabled={!intentos} style={{ ...S.btnGrande('#2980b9'), opacity: intentos ? 1 : 0.5 }}>📤 Enviar al profesor</button>
                        <button onClick={reiniciar} style={S.btnGrande(tema.color)}>🔄 Otra vez</button>
                        <button onClick={onVolver} style={{ ...S.btnVolver, padding: 12 }}>← Cambiar de modo</button>
                    </div>
                </div>
            </div>
            {envio && <ModalEnviarProfe datos={datosEnvio} onClose={() => setEnvio(false)} />}
        </div>
    );

    const progreso = esCrono ? tiempo / duracion : intentos / total;
    return (
        <div style={S.pagina}>
            <Barra titulo={`${ej.emoji} ${ej.nombre}`} onVolver={onVolver}
                derecha={<div style={{ fontWeight: 900, color: '#27ae60', whiteSpace: 'nowrap' }}>✔ {aciertos}{esCrono ? '' : `/${total}`}</div>} />
            <div style={{ height: 6, background: '#efe8da' }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, progreso)) * 100}%`, background: esCrono ? (tiempo <= 10 ? '#e74c3c' : '#e67e22') : tema.color, transition: 'width .4s' }} />
            </div>
            <div style={{ ...S.contenido, maxWidth: 760 }}>
                {esCrono && <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.5rem', color: tiempo <= 10 ? '#e74c3c' : '#5d4e37', marginBottom: 8 }}>⏱️ {tiempo}s</div>}
                {!esCrono && <div style={{ textAlign: 'center', color: '#a09682', fontWeight: 800, fontSize: '0.85rem', marginBottom: 8 }}>{Math.min(intentos + (respondida === null ? 1 : 0), total)} de {total}</div>}
                <PreguntaView key={q._id} q={q} color={tema.color} onResuelta={resolver} />
                {respondida !== null && !esCrono && (
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <button autoFocus onClick={siguiente} style={S.btnGrande(tema.color)}>{intentos >= total ? 'Ver resultado →' : 'Siguiente →'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  VISTA DE UNA PREGUNTA (opciones · cazar · emparejar)
// ═══════════════════════════════════════════════════════════════════
function PreguntaView({ q, color, onResuelta, compacto = false, bloqueado = false }) {
    const [elegida, setElegida] = useState(null);
    const [resultado, setResultado] = useState(null);
    const terminar = (ok) => { if (resultado !== null) return; setResultado(ok); onResuelta(ok); };

    return (
        <div style={{ ...S.tarjeta, padding: compacto ? 14 : 22 }}>
            <div style={{ fontWeight: 900, fontSize: compacto ? '0.98rem' : 'clamp(1.02rem,3vw,1.2rem)', textAlign: 'center', marginBottom: 14 }}>{q.instruccion}</div>

            {q.tipo === 'opciones' && (<>
                <Enunciado e={q.enunciado} resultado={resultado} q={q} compacto={compacto} />
                <div style={{ display: 'grid', gridTemplateColumns: q.largas ? '1fr' : `repeat(auto-fit,minmax(${q.grandes ? 140 : 120}px,1fr))`, gap: 9, marginTop: 14 }}>
                    {q.opciones.map(o => {
                        const esCorrecta = o.v === q.correcta;
                        const marcada = elegida === o.v;
                        let bg = 'white', bd = o.color || '#d8cfbd', fg = '#2c3e50';
                        if (resultado !== null && esCorrecta) { bg = '#27ae60'; bd = '#27ae60'; fg = 'white'; }
                        else if (resultado !== null && marcada) { bg = '#e74c3c'; bd = '#e74c3c'; fg = 'white'; }
                        return (
                            <button key={String(o.v)} disabled={resultado !== null || bloqueado}
                                onClick={() => { setElegida(o.v); terminar(esCorrecta); }}
                                style={{ padding: q.grandes ? '16px 10px' : '12px 10px', borderRadius: 14, border: `2.5px solid ${bd}`, background: bg, color: fg, fontWeight: 800,
                                    fontSize: q.grandes ? 'clamp(1.1rem,4vw,1.45rem)' : q.largas ? '0.9rem' : '0.98rem', cursor: resultado === null ? 'pointer' : 'default',
                                    fontFamily: 'inherit', textAlign: q.largas ? 'left' : 'center', transition: 'background .15s', lineHeight: 1.3 }}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            </>)}

            {q.tipo === 'cazar' && <Cazar q={q} onResuelta={terminar} bloqueado={bloqueado} compacto={compacto} />}
            {q.tipo === 'emparejar' && <Emparejar q={q} color={color} onResuelta={terminar} />}

            {resultado !== null && q.explicacion && (
                <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: resultado ? '#eafaf1' : '#fdecea', color: resultado ? '#1e8449' : '#a93226', fontSize: compacto ? '0.82rem' : '0.9rem', lineHeight: 1.45 }}>
                    <b>{resultado ? '✔ ¡Correcto!' : '✘ No es correcto.'}</b> {q.explicacion}
                </div>
            )}
        </div>
    );
}

function Enunciado({ e, resultado, q, compacto }) {
    if (!e) return null;
    const grande = compacto ? '1.6rem' : 'clamp(1.8rem,7vw,2.8rem)';
    if (e.tipo === 'palabra') return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: grande, fontWeight: 900, letterSpacing: 1 }}>{e.texto}</div>
            {e.silabas && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {e.silabas.map((s, i) => <span key={i} style={{ padding: '4px 10px', borderRadius: 10, background: '#f4efe4', fontWeight: 800, color: '#7a6a55' }}>{s}</span>)}
            </div>}
        </div>
    );
    if (e.tipo === 'hueco') return (
        <div style={{ textAlign: 'center', fontSize: grande, fontWeight: 900, letterSpacing: 1 }}>
            {e.antes}
            <span style={{ display: 'inline-block', minWidth: '1.3em', margin: '0 3px', padding: '0 6px', borderBottom: '4px solid #c9b88f', color: resultado === null ? 'transparent' : '#27ae60' }}>
                {resultado === null ? '_' : (q.correcta === '—' ? '∅' : q.correcta)}
            </span>
            {e.despues}
        </div>
    );
    if (e.tipo === 'frase') return (
        <div style={{ textAlign: 'center', fontSize: compacto ? '1rem' : 'clamp(1.05rem,3.6vw,1.4rem)', lineHeight: 2, fontWeight: 700 }}>
            {e.tokens.map((t, i) => (
                <React.Fragment key={i}>
                    {t.cat === null ? '' : i > 0 ? ' ' : ''}
                    <span style={i === e.resaltar ? { background: '#fff1a8', borderBottom: '3px solid #f1c40f', padding: '2px 6px', borderRadius: 6, fontWeight: 900 } : undefined}>{t.t}</span>
                </React.Fragment>
            ))}
        </div>
    );
    return <div style={{ textAlign: 'center', fontSize: e.grande ? grande : (compacto ? '1rem' : 'clamp(1.05rem,3.4vw,1.35rem)'), fontWeight: e.grande ? 900 : 700, lineHeight: 1.5 }}>{e.texto}</div>;
}

function Cazar({ q, onResuelta, bloqueado, compacto }) {
    const [sel, setSel] = useState([]);
    const [hecho, setHecho] = useState(false);
    const toggle = (i) => !hecho && !bloqueado && setSel(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]));
    const comprobar = () => {
        const buenos = q.tokens.map((t, i) => (t.cat === q.objetivo ? i : -1)).filter(i => i >= 0);
        const ok = buenos.length === sel.length && buenos.every(i => sel.includes(i));
        setHecho(true);
        onResuelta(ok);
    };
    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: compacto ? 6 : 8, justifyContent: 'center' }}>
                {q.tokens.map((t, i) => {
                    if (t.cat === null) return null;
                    const marcada = sel.includes(i);
                    const esObj = t.cat === q.objetivo;
                    let bg = marcada ? q.color : '#f7f3ea', fg = marcada ? 'white' : '#2c3e50', bd = marcada ? q.color : '#e6dcc8';
                    if (hecho) {
                        if (esObj && marcada) { bg = '#27ae60'; bd = '#27ae60'; fg = 'white'; }
                        else if (esObj) { bg = 'white'; bd = '#e67e22'; fg = '#e67e22'; }
                        else if (marcada) { bg = '#e74c3c'; bd = '#e74c3c'; fg = 'white'; }
                    }
                    return (
                        <button key={i} onClick={() => toggle(i)}
                            style={{ padding: compacto ? '7px 10px' : '10px 14px', borderRadius: 12, border: `2.5px ${hecho && esObj && !marcada ? 'dashed' : 'solid'} ${bd}`, background: bg, color: fg,
                                fontWeight: 800, fontSize: compacto ? '0.95rem' : 'clamp(1rem,3.4vw,1.25rem)', cursor: hecho ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                            {t.t}
                        </button>
                    );
                })}
            </div>
            {!hecho && (
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button onClick={comprobar} disabled={bloqueado} style={S.btnGrande(q.color)}>✔ Comprobar ({sel.length})</button>
                </div>
            )}
        </div>
    );
}

function Emparejar({ q, color, onResuelta }) {
    const [der] = useState(() => barajar(q.pares.map(p => p[1])));
    const [izqSel, setIzqSel] = useState(null);
    const [hechos, setHechos] = useState([]); // índices de pares resueltos
    const [fallo, setFallo] = useState(null);
    const fallos = useRef(0);

    const elegirDer = (palabra) => {
        if (izqSel === null) return;
        if (q.pares[izqSel][1] === palabra) {
            const nuevos = [...hechos, izqSel];
            setHechos(nuevos); setIzqSel(null); sonidoCorrecto();
            if (nuevos.length === q.pares.length) onResuelta(fallos.current <= 1);
        } else {
            fallos.current += 1; setFallo(palabra); sonidoIncorrecto();
            setTimeout(() => setFallo(null), 500);
        }
    };
    const btn = (activo, ok, mal) => ({ padding: '11px 10px', borderRadius: 12, fontWeight: 800, fontSize: '0.98rem', fontFamily: 'inherit', cursor: ok ? 'default' : 'pointer',
        border: `2.5px solid ${ok ? '#27ae60' : mal ? '#e74c3c' : activo ? color : '#e2d8c4'}`, background: ok ? '#eafaf1' : mal ? '#fdecea' : activo ? `${color}22` : 'white', color: ok ? '#1e8449' : '#2c3e50', opacity: ok ? 0.65 : 1 });
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.pares.map((p, i) => <button key={p[0]} disabled={hechos.includes(i)} onClick={() => setIzqSel(i)} style={btn(izqSel === i, hechos.includes(i), false)}>{p[0]}</button>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {der.map(w => {
                        const ok = hechos.some(i => q.pares[i][1] === w);
                        return <button key={w} disabled={ok} onClick={() => elegirDer(w)} style={btn(false, ok, fallo === w)}>{w}</button>;
                    })}
                </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#a09682', marginTop: 10 }}>Toca una palabra de la izquierda y después su pareja · Fallos: {fallos.current}</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  COMPETICIÓN POR EQUIPOS (tirón de cuerda)
// ═══════════════════════════════════════════════════════════════════
function ModoCompeticionLengua({ tema, ej, cfg, onVolver }) {
    const movil = useEsMovil();
    return (
        <div style={S.pagina}>
            <Barra titulo={`🪢 ${ej.nombre}`} onVolver={onVolver} />
            <div style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 12px 30px' }}>
                <CompeticionCuerda onSalir={onVolver} isMobile={movil}
                    renderPanel={(equipo, api) => <PanelEquipo key={api.key} equipo={equipo} ej={ej} cfg={cfg} color={tema.color} aplicar={api.aplicar} bloqueado={api.bloqueado} />} />
            </div>
        </div>
    );
}

function PanelEquipo({ equipo, ej, cfg, color, aplicar, bloqueado }) {
    const [q, setQ] = useState(() => ({ ...ej.generar(cfg), _id: Math.random() }));
    const t = useRef(null);
    useEffect(() => () => clearTimeout(t.current), []);
    const resolver = (ok) => {
        aplicar(ok);
        if (ok) sonidoCorrecto(); else sonidoIncorrecto();
        t.current = setTimeout(() => setQ({ ...ej.generar(cfg), _id: Math.random() }), ok ? 900 : 2000);
    };
    const c = equipo === 1 ? '#2b7bd6' : '#d64545';
    return (
        <div style={{ border: `3px solid ${c}`, borderRadius: 22, padding: 6, background: `${c}0d` }}>
            <div style={{ textAlign: 'center', fontWeight: 900, color: c, margin: '2px 0 6px' }}>{equipo === 1 ? '🔵 Equipo 1' : '🔴 Equipo 2'}</div>
            <PreguntaView key={q._id} q={q} color={color} onResuelta={resolver} compacto bloqueado={bloqueado} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  RULETA DE CAMPOS SEMÁNTICOS (actividad de clase)
// ═══════════════════════════════════════════════════════════════════
const COLORES_RULETA = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];

function RuletaCampos({ onVolver }) {
    const n = CAMPOS.length;
    const [giro, setGiro] = useState(0);
    const [girando, setGirando] = useState(false);
    const [campo, setCampo] = useState(null);
    const [seg, setSeg] = useState(60);
    const [tiempo, setTiempo] = useState(null);
    const [mostrarEjemplos, setMostrarEjemplos] = useState(false);

    useEffect(() => {
        if (tiempo === null || tiempo <= 0) { if (tiempo === 0) sonidoFinal(); return undefined; }
        const id = setTimeout(() => setTiempo(x => x - 1), 1000);
        return () => clearTimeout(id);
    }, [tiempo]);

    const girar = () => {
        if (girando) return;
        despertarAudio();
        const k = Math.floor(Math.random() * n);
        // El sector k queda bajo la flecha (arriba)
        const angSector = 360 / n;
        const destino = 360 - (k * angSector + angSector / 2);
        const vueltas = 5 * 360;
        const base = giro - (giro % 360);
        setGiro(base + vueltas + destino);
        setGirando(true); setCampo(null); setTiempo(null); setMostrarEjemplos(false);
        setTimeout(() => { setGirando(false); setCampo(CAMPOS[k]); }, 4200);
    };

    const R = 150;
    const sector = (i) => {
        const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
        return `M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 0 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`;
    };

    return (
        <div style={S.pagina}>
            <Barra titulo="🎡 Ruleta de campos semánticos" onVolver={onVolver} />
            <div style={{ ...S.contenido, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <p style={{ margin: 0, color: '#6b6355', textAlign: 'center', maxWidth: 560 }}>Gira la ruleta. Cuando salga un campo, cada alumno (o equipo) escribe todas las palabras que pueda de ese campo antes de que acabe el tiempo.</p>
                <div style={{ position: 'relative', width: 'min(84vw,320px)', aspectRatio: '1' }}>
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', zIndex: 2, fontSize: '2rem', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.3))' }}>🔻</div>
                    <svg viewBox={`0 0 ${2 * R} ${2 * R}`} style={{ width: '100%', height: '100%', transform: `rotate(${giro}deg)`, transition: girando ? 'transform 4s cubic-bezier(.17,.67,.21,1)' : 'none' }}>
                        {CAMPOS.map((c, i) => {
                            const am = ((i + 0.5) / n) * 360;
                            return (
                                <g key={c.campo}>
                                    <path d={sector(i)} fill={COLORES_RULETA[i % COLORES_RULETA.length]} stroke="white" strokeWidth="2" />
                                    <text x={R} y={30} fontSize="20" textAnchor="middle" transform={`rotate(${am} ${R} ${R})`}>{c.emoji}</text>
                                </g>
                            );
                        })}
                        <circle cx={R} cy={R} r={22} fill="white" stroke="#ddd" strokeWidth="3" />
                    </svg>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {[30, 60, 90, 120].map(s => <button key={s} onClick={() => setSeg(s)} style={S.chip(seg === s, '#27ae60')}>{s}s</button>)}
                </div>
                <button onClick={girar} disabled={girando} style={{ ...S.btnGrande('#27ae60'), opacity: girando ? 0.6 : 1 }}>{girando ? 'Girando…' : '🎡 ¡Girar!'}</button>

                {campo && (
                    <div style={{ ...S.tarjeta, textAlign: 'center', width: '100%', maxWidth: 520 }}>
                        <div style={{ fontSize: '3rem' }}>{campo.emoji}</div>
                        <div style={{ fontSize: 'clamp(1.5rem,6vw,2.2rem)', fontWeight: 900, color: '#27ae60' }}>{campo.campo}</div>
                        {tiempo === null
                            ? <button onClick={() => setTiempo(seg)} style={{ ...S.btnGrande('#e67e22'), marginTop: 12 }}>⏱️ Empezar ({seg}s)</button>
                            : <div style={{ fontSize: '2.6rem', fontWeight: 900, marginTop: 8, color: tiempo <= 10 ? '#e74c3c' : '#5d4e37' }}>{tiempo > 0 ? `${tiempo}s` : '⏰ ¡Tiempo!'}</div>}
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMostrarEjemplos(v => !v)} style={S.btnVolver}>{mostrarEjemplos ? 'Ocultar ejemplos' : '👀 Ver ejemplos'}</button>
                            {mostrarEjemplos && <div style={{ marginTop: 10, color: '#6b6355', lineHeight: 1.7 }}>{campo.palabras.join(' · ')}</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  ENVÍO AL PROFESOR (informes_juegos · tipo LENGUA)
// ═══════════════════════════════════════════════════════════════════
function ModalEnviarProfe({ datos, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [estado, setEstado] = useState('form'); // form | enviando | ok
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) return setError('Escribe tu nombre.');
        if (!code) return setError('Escribe el código del profesor.');
        setEstado('enviando'); setError('');
        try {
            const cod = await getDoc(doc(db, 'codigos_profesor', code));
            if (!cod.exists()) { setError('Código no encontrado.'); setEstado('form'); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'LENGUA', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                config: datos.config,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, intentos: datos.intentos, porcentaje: datos.porcentaje, tiempo: datos.tiempo }],
            });
            guardarRegistroLocal('LENGUA', {
                titulo: `${datos.config.tema} · ${datos.config.ejercicio}`, aciertos: datos.aciertos, intentos: datos.intentos,
                porcentaje: datos.porcentaje, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEstado('ok');
        } catch (e) { console.error(e); setError('Error al enviar: ' + e.message); setEstado('form'); }
    };

    const inp = { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0d8c8', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(20,14,4,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ ...S.tarjeta, width: '100%', maxWidth: 380 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <b>📤 Enviar al profesor</b>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>✕</button>
                </div>
                {estado === 'ok' ? (
                    <div style={{ textAlign: 'center', padding: '14px 0' }}>
                        <div style={{ fontSize: '2.6rem' }}>✅</div>
                        <div style={{ fontWeight: 800, color: '#27ae60' }}>¡Resultado enviado!</div>
                        <button onClick={onClose} style={{ ...S.btnVolver, marginTop: 14 }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: '0.85rem', color: '#7a6a55', background: '#faf6ee', borderRadius: 10, padding: '8px 10px' }}>
                            {datos.config.tema} · {datos.config.ejercicio}<br /><b>{datos.aciertos}/{datos.intentos}</b> ({datos.porcentaje}%) · {datos.config.modo}
                        </div>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={inp} />
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Curso (ej: 2º ESO B)" style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 800 }} />
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.82rem' }}>⚠ {error}</div>}
                        <button onClick={enviar} disabled={estado === 'enviando'} style={{ ...S.btnGrande('#2980b9'), opacity: estado === 'enviando' ? 0.6 : 1 }}>{estado === 'enviando' ? 'Enviando…' : 'Enviar'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
