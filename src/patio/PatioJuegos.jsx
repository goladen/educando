// ═══════════════════════════════════════════════════════════════════
//  PATIO DE JUEGOS — juegos de Primaria para la clase
//  1. Eliges curso (1º–6º) y materia (Mates / Lengua)
//  2. Eliges juego (tablas, sumas y restas, acentuación…)
//  3. Modo: Mi camino (mapa de 5 paradas y jefe final), Carrera en la
//     pizarra (2–4 alumnos a la vez, en columnas) o Toda la clase
//     (equipos por turnos / la clase contra el Rey Garabato).
//  Resultados: informes_juegos tipo PATIO + guardarRegistroLocal('PATIO').
// ═══════════════════════════════════════════════════════════════════
import { validarNombre } from '../utils/filtroNombres';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal, despertarAudio, sonidoActivo, setSonidoActivo } from '../utils/sonidosFeedback';
import { CURSOS, COLOR_CURSO, MATERIAS, materiaPorId, juegosDe, juegoPorId, crearGenerador } from './juegosPatio';
import FichaPapel from './FichaPapel';
import Monstruo, { MONSTRUOS, JEFE } from './Monstruo';

const FUENTE = "'Fredoka','Nunito','Segoe UI',system-ui,sans-serif";
const TINTA = '#2b1d4e';
const NIVELES = [
    { n: 1, nombre: 'El prado', vida: 6, tiempo: 0, tipo: 0 },
    { n: 2, nombre: 'El bosque', vida: 7, tiempo: 0, tipo: 2 },
    { n: 3, nombre: 'El río', vida: 8, tiempo: 20, tipo: 1 },
    { n: 4, nombre: 'La montaña', vida: 9, tiempo: 15, tipo: 4 },
    { n: 5, nombre: 'El castillo', vida: 12, tiempo: 12, tipo: 3, jefe: true },
];
const CORAZONES = 3;

const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const claveProgreso = (juegoId, curso) => `patio_prog_${juegoId}_${curso}`;

// ── Estilos globales (fuente, animaciones) ──────────────────────────
function EstilosPatio() {
    useEffect(() => {
        if (document.getElementById('patio-fuente')) return;
        const l = document.createElement('link');
        l.id = 'patio-fuente'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap';
        document.head.appendChild(l);
    }, []);
    return (
        <style>{`
            @keyframes patioFlota { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
            @keyframes patioSalto { 0% { transform: translateY(0) scale(1) } 40% { transform: translateY(-18px) scale(1.06) } 100% { transform: translateY(0) scale(1) } }
            @keyframes patioTiembla { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-8px) } 40% { transform: translateX(8px) } 60% { transform: translateX(-5px) } 80% { transform: translateX(5px) } }
            @keyframes patioNube { from { transform: translateX(-30vw) } to { transform: translateX(130vw) } }
            @keyframes patioAparece { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: scale(1) } }
            @keyframes patioConfeti { from { transform: translateY(-10vh) rotate(0) } to { transform: translateY(110vh) rotate(720deg) } }
            @keyframes patioBorra { 0% { transform: rotate(0) scale(1); opacity: 1 } 25% { transform: rotate(-12deg) scale(.92); opacity: .55 } 50% { transform: rotate(10deg) scale(.95); opacity: .8 } 75% { transform: rotate(-5deg) scale(.97); opacity: .6 } 100% { transform: rotate(0) scale(1); opacity: 1 } }
            @keyframes patioPop { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.4) } 30% { opacity: 1; transform: translate(-50%,-50%) scale(1.15) } 70% { opacity: 1; transform: translate(-50%,-50%) scale(1) } 100% { opacity: 0; transform: translate(-50%,-80%) scale(1) } }
            @keyframes patioLatido { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }
            .patio-btn { transition: transform .08s, box-shadow .08s, filter .15s; -webkit-tap-highlight-color: transparent; }
            .patio-btn:hover:not(:disabled) { filter: brightness(1.06); }
            .patio-btn:active:not(:disabled) { transform: translateY(5px); }
        `}</style>
    );
}

// ── Escenario: cielo, nubes y suelo de bloques ──────────────────────
function Escenario({ children, cielo = 'linear-gradient(180deg,#7dd3fc 0%,#bae6fd 55%,#e0f7ff 100%)' }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden', background: cielo, fontFamily: FUENTE, color: TINTA }}>
            <EstilosPatio />
            {[{ top: '8%', d: 70, s: 1 }, { top: '22%', d: 95, s: 0.7 }, { top: '14%', d: 120, s: 1.3 }].map((n, i) => (
                <div key={i} style={{ position: 'absolute', top: n.top, left: 0, animation: `patioNube ${n.d}s linear infinite`, animationDelay: `${-i * 25}s`, opacity: 0.85, pointerEvents: 'none' }}>
                    <div style={{ width: 120 * n.s, height: 40 * n.s, background: 'white', borderRadius: 40, position: 'relative', boxShadow: `${30 * n.s}px ${-18 * n.s}px 0 ${4 * n.s}px white` }} />
                </div>
            ))}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, pointerEvents: 'none', background: 'repeating-linear-gradient(90deg,#4ade80 0 40px,#22c55e 40px 80px)', borderTop: '6px solid #15803d' }}>
                <div style={{ position: 'absolute', inset: '14px 0 0 0', background: 'repeating-linear-gradient(90deg,#b45309 0 38px,#92400e 38px 40px), #b45309' }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>
        </div>
    );
}

function BotonGordo({ color = '#3a86ff', children, onClick, onPointerDown, disabled, style, grande }) {
    const sombra = `0 6px 0 rgba(0,0,0,0.25), 0 10px 18px ${color}55`;
    return (
        <button className="patio-btn" disabled={disabled} onClick={onClick} onPointerDown={onPointerDown}
            style={{
                background: color, color: 'white', border: '3px solid rgba(0,0,0,0.12)', borderRadius: 18,
                padding: grande ? '16px 26px' : '10px 18px', fontSize: grande ? '1.25rem' : '1rem', fontWeight: 700,
                fontFamily: FUENTE, cursor: disabled ? 'default' : 'pointer', boxShadow: sombra,
                textShadow: '0 2px 0 rgba(0,0,0,0.18)', opacity: disabled ? 0.55 : 1, touchAction: 'manipulation', ...style,
            }}>{children}</button>
    );
}

function Cabecera({ titulo, onVolver, textoVolver = '← Volver', derecha }) {
    const [sonido, setSonido] = useState(() => sonidoActivo());
    const [pc, setPc] = useState(!!document.fullscreenElement);
    useEffect(() => { const f = () => setPc(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
    const pantallaCompleta = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch { /* no soportado */ } };
    const chip = { background: 'white', border: `3px solid ${TINTA}22`, borderRadius: 14, padding: '7px 12px', fontWeight: 700, fontFamily: FUENTE, cursor: 'pointer', color: TINTA, fontSize: '0.95rem', boxShadow: '0 4px 0 rgba(0,0,0,0.12)' };
    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(6px)', borderBottom: `3px solid ${TINTA}14` }}>
            {onVolver && <button onClick={onVolver} style={chip}>{textoVolver}</button>}
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 'clamp(1rem,3.2vw,1.35rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
            {derecha}
            <button onClick={() => { setSonidoActivo(!sonido); setSonido(!sonido); }} style={chip} title={sonido ? 'Silenciar' : 'Activar sonido'}>{sonido ? '🔊' : '🔇'}</button>
            <button onClick={pantallaCompleta} style={chip} title="Pantalla completa">{pc ? '🗗' : '⛶'}</button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function PatioJuegos({ onExit, materiaInicial = null }) {
    const [curso, setCursoSt] = useState(() => leerLS('patio_curso', null));
    const [materia, setMateriaSt] = useState(() => materiaInicial || leerLS('patio_materia', 'mates'));
    const setMateria = (m) => { setMateriaSt(m); guardarLS('patio_materia', m); };
    const [juegoId, setJuegoId] = useState(null);
    const [modo, setModo] = useState(null); // AVENTURA | COMPE | GRUPAL
    const [nivel, setNivel] = useState(null);
    const [partida, setPartida] = useState(0); // fuerza reinicio al repetir un nivel
    const setCurso = (c) => { setCursoSt(c); guardarLS('patio_curso', c); };
    const salir = () => (typeof onExit === 'function' ? onExit() : window.location.assign('/'));
    const juego = juegoId ? juegoPorId(juegoId) : null;

    // Si cambias de curso y el juego no existe en ese curso, vuelve a la lista
    useEffect(() => { if (juego && curso && !juego.cursos.includes(curso)) { setJuegoId(null); setModo(null); } }, [curso, juego]);

    if (juego && modo === 'AVENTURA' && nivel) return <Nivel key={`${nivel.n}-${partida}`} juego={juego} curso={curso} nivel={nivel} onVolver={() => setNivel(null)} onSiguiente={(n) => { setNivel(NIVELES.find(x => x.n === n) || null); setPartida(p => p + 1); }} />;
    if (juego && modo === 'AVENTURA') return <MapaAventura juego={juego} curso={curso} onNivel={setNivel} onVolver={() => setModo(null)} />;
    if (juego && modo === 'COMPE') return <Competitivo juego={juego} curso={curso} onVolver={() => setModo(null)} />;
    if (juego && modo === 'FICHA') return <FichaPapel juego={juego} curso={curso} onVolver={() => setModo(null)} />;
    if (juego && modo === 'GRUPAL') return <Grupal juego={juego} curso={curso} onVolver={() => setModo(null)} />;
    if (juego) return <PantallaModo juego={juego} curso={curso} onModo={(m) => { despertarAudio(); setModo(m); }} onVolver={() => setJuegoId(null)} />;
    return <PantallaInicio curso={curso} setCurso={setCurso} materia={materia} setMateria={setMateria} onJuego={setJuegoId} onSalir={salir} />;
}

// ── Inicio: curso + materia + juegos ────────────────────────────────
function PantallaInicio({ curso, setCurso, materia, setMateria, onJuego, onSalir }) {
    const juegos = curso ? juegosDe(materia, curso) : [];
    return (
        <Escenario>
            <Cabecera titulo="🛝 Patio de Juegos" onVolver={onSalir} textoVolver="← Salir" />
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '18px 16px 90px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                    <Monstruo tipo={0} size={70} />
                    <h1 style={{ margin: 0, fontSize: 'clamp(2.1rem,7vw,3.6rem)', fontWeight: 700, color: '#ffd60a', letterSpacing: 1, textShadow: `0 4px 0 #e85d04, 0 7px 0 ${TINTA}, 0 10px 16px rgba(0,0,0,.25)`, WebkitTextStroke: `2px ${TINTA}`, lineHeight: 1.1, textAlign: 'center' }}>Patio de Juegos</h1>
                    <Monstruo tipo={1} size={70} style={{ animationDelay: '-1.5s' }} />
                </div>
                <p style={{ textAlign: 'center', margin: '10px 0 22px', fontWeight: 600, fontSize: '1.1rem' }}>Aprende jugando: mates, lengua, ciencias, geografía e historia</p>

                <TituloSeccion>Elige tu curso</TituloSeccion>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 14, marginBottom: 26 }}>
                    {CURSOS.map(c => {
                        const activo = curso === c;
                        return (
                            <button key={c} className="patio-btn" onClick={() => setCurso(c)}
                                style={{ background: COLOR_CURSO[c], border: `4px solid ${activo ? TINTA : 'rgba(0,0,0,0.12)'}`, borderRadius: 22, padding: '14px 8px', cursor: 'pointer', fontFamily: FUENTE, color: 'white', boxShadow: activo ? `0 0 0 5px white, 0 7px 0 rgba(0,0,0,.25)` : '0 7px 0 rgba(0,0,0,.22)', transform: activo ? 'scale(1.04)' : 'none' }}>
                                <div style={{ fontSize: '2.6rem', fontWeight: 700, lineHeight: 1, textShadow: '0 3px 0 rgba(0,0,0,.2)' }}>{c}º</div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Primaria</div>
                            </button>
                        );
                    })}
                </div>

                {curso && <>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                        {MATERIAS.map(m => (
                            <BotonGordo key={m.id} color={materia === m.id ? m.color : '#94a3b8'} onClick={() => setMateria(m.id)} grande style={{ minWidth: 170, boxShadow: materia === m.id ? '0 0 0 4px white, 0 6px 0 rgba(0,0,0,0.25)' : undefined }}>{m.emoji} {m.label}</BotonGordo>
                        ))}
                    </div>
                    <TituloSeccion>{materiaPorId(materia).emoji} {materiaPorId(materia).label} · {curso}º de Primaria</TituloSeccion>
                    {!juegos.length && <p style={{ textAlign: 'center', fontWeight: 600 }}>Todavía no hay juegos de esta materia para {curso}º.</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                        {juegos.map((j, i) => (
                            <button key={j.id} className="patio-btn" onClick={() => onJuego(j.id)}
                                style={{ background: 'white', border: `4px solid ${j.color}`, borderRadius: 24, padding: 0, cursor: 'pointer', fontFamily: FUENTE, color: TINTA, textAlign: 'left', boxShadow: `0 7px 0 ${j.color}`, overflow: 'hidden', animation: `patioAparece .3s ease ${i * 0.04}s both` }}>
                                <div style={{ background: j.color, padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 54, height: 54, borderRadius: 16, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', flexShrink: 0 }}>{j.emoji}</div>
                                    <div style={{ color: 'white', fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.15, textShadow: '0 2px 0 rgba(0,0,0,.2)' }}>{j.nombre}</div>
                                </div>
                                <div style={{ padding: '10px 14px 14px', fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.35 }}>{j.desc}</div>
                                <Estrellitas juegoId={j.id} curso={curso} />
                            </button>
                        ))}
                    </div>
                </>}
                {!curso && <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.1rem' }}>👆 Toca tu curso para ver los juegos</p>}
            </div>
        </Escenario>
    );
}

function TituloSeccion({ children }) {
    return <h2 style={{ textAlign: 'center', margin: '0 0 14px', fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontWeight: 700, color: 'white', textShadow: `0 3px 0 ${TINTA}, 0 0 2px ${TINTA}` }}>{children}</h2>;
}

function Estrellitas({ juegoId, curso }) {
    const prog = leerLS(claveProgreso(juegoId, curso), {});
    const total = Object.values(prog).reduce((a, b) => a + (b || 0), 0);
    if (!total) return null;
    return <div style={{ padding: '0 14px 12px', fontWeight: 700, color: '#b45309' }}>⭐ {total} / {NIVELES.length * 3}</div>;
}

// ── Elegir modo ─────────────────────────────────────────────────────
function PantallaModo({ juego, curso, onModo, onVolver }) {
    const modos = [
        { id: 'AVENTURA', emoji: '🗺️', titulo: 'Mi camino', texto: 'Recorre 5 paradas, borra a los garabatos y llega hasta el Rey Garabato. Gana estrellas y envía tu resultado al profe.', color: '#3a86ff', tipo: 1 },
        { id: 'COMPE', emoji: '🏁', titulo: 'Carrera en la pizarra', texto: 'De 2 a 4 alumnos a la vez, cada uno en su carril. ¿Quién suma más aciertos antes de que acabe el tiempo?', color: '#ff5d73', tipo: 0 },
        { id: 'GRUPAL', emoji: '🤝', titulo: 'Toda la clase', texto: 'Equipos que se turnan o la clase entera unida contra el Rey Garabato.', color: '#16a34a', tipo: 5 },
        { id: 'FICHA', emoji: '🖨️', titulo: 'Ficha en papel', texto: 'Crea una ficha con las mismas preguntas para imprimir o guardar en PDF, con hoja de soluciones.', color: '#64748b', tipo: 2 },
    ];
    return (
        <Escenario>
            <Cabecera titulo={`${juego.emoji} ${juego.nombre} · ${curso}º`} onVolver={onVolver} />
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '22px 16px 90px' }}>
                <TituloSeccion>¿A qué jugamos hoy?</TituloSeccion>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 18 }}>
                    {modos.map((m, i) => (
                        <button key={m.id} className="patio-btn" onClick={() => onModo(m.id)}
                            style={{ background: 'white', border: `5px solid ${m.color}`, borderRadius: 28, padding: '18px 18px 22px', cursor: 'pointer', fontFamily: FUENTE, color: TINTA, boxShadow: `0 8px 0 ${m.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: `patioAparece .3s ease ${i * 0.06}s both` }}>
                            <Monstruo tipo={m.tipo} size={96} style={{ animationDelay: `${-i}s` }} />
                            <div style={{ fontSize: '1.7rem', fontWeight: 700, color: m.color }}>{m.emoji} {m.titulo}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>{m.texto}</div>
                        </button>
                    ))}
                </div>
            </div>
        </Escenario>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  PREGUNTA (común a todos los modos)
// ═══════════════════════════════════════════════════════════════════
function Enunciado({ e, q, resuelta, escala = 1 }) {
    if (!e) return null;
    const grande = `calc(${escala} * clamp(2rem,6vw,3.6rem))`;
    if (e.tipo === 'palabra') return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: grande, fontWeight: 700 }}>{e.texto}</div>
            {e.silabas && <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {e.silabas.map((s, i) => <span key={i} style={{ padding: '4px 12px', borderRadius: 12, background: '#ede9fe', fontWeight: 700, fontSize: `calc(${escala} * 1.2rem)` }}>{s}</span>)}
            </div>}
        </div>
    );
    if (e.tipo === 'emoji') return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: `calc(${escala} * clamp(3.4rem,10vw,5.5rem))`, lineHeight: 1.1 }}>{e.emoji}</div>
            {e.texto && <div style={{ fontSize: `calc(${escala} * clamp(1.2rem,3.6vw,1.8rem))`, fontWeight: 700, marginTop: 4 }}>{e.texto}</div>}
        </div>
    );
    if (e.tipo === 'hueco') return (
        <div style={{ textAlign: 'center', fontSize: grande, fontWeight: 700, letterSpacing: 1 }}>
            {e.antes}
            <span style={{ display: 'inline-block', minWidth: '1.2em', margin: '0 3px', padding: '0 6px', borderBottom: '5px solid #a78bfa', color: resuelta ? '#16a34a' : 'transparent' }}>
                {resuelta ? (q.correcta === '—' ? '∅' : q.correcta) : '_'}
            </span>
            {e.despues}
        </div>
    );
    if (e.tipo === 'frase') return (
        <div style={{ textAlign: 'center', fontSize: `calc(${escala} * clamp(1.15rem,3.4vw,1.7rem))`, lineHeight: 1.9, fontWeight: 600 }}>
            {e.tokens.map((t, i) => (
                <React.Fragment key={i}>
                    {t.cat === null ? '' : i > 0 ? ' ' : ''}
                    <span style={i === e.resaltar ? { background: '#ffd60a', padding: '2px 8px', borderRadius: 8, fontWeight: 700, boxShadow: '0 3px 0 #e85d04' } : undefined}>{t.t}</span>
                </React.Fragment>
            ))}
        </div>
    );
    return <div style={{ textAlign: 'center', fontSize: e.grande ? grande : `calc(${escala} * 1.4rem)`, fontWeight: 700, whiteSpace: 'pre-wrap' }}>{e.texto}</div>;
}

// Respuesta con pointerdown: funciona con varios dedos a la vez (modo competitivo)
function Pregunta({ q, onResponder, elegida, bloqueada, escala = 1, columnas = 2, mostrarExplicacion = true }) {
    const resuelta = elegida != null;
    const acierto = resuelta && elegida === q.correcta;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * escala, width: '100%' }}>
            <div style={{ textAlign: 'center', fontWeight: 600, fontSize: `calc(${escala} * 1.15rem)`, opacity: 0.85 }}>{q.instruccion}</div>
            {q.enunciado && (
                <div style={{ background: 'white', borderRadius: 22, padding: `${16 * escala}px 12px`, border: `4px solid ${resuelta ? (acierto ? '#16a34a' : '#ef4444') : '#e9e3ff'}`, boxShadow: '0 6px 0 rgba(0,0,0,.12)', minHeight: 70 * escala, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Enunciado e={q.enunciado} q={q} resuelta={resuelta} escala={escala} />
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(columnas, q.opciones.length)},1fr)`, gap: 10 * escala }}>
                {q.opciones.map((o, i) => {
                    const esCorrecta = o.v === q.correcta;
                    const marcada = resuelta && o.v === elegida;
                    let fondo = o.color || '#3a86ff';
                    if (resuelta) fondo = esCorrecta ? '#16a34a' : marcada ? '#ef4444' : '#cbd5e1';
                    return (
                        <BotonGordo key={i} color={fondo} disabled={bloqueada || resuelta}
                            onPointerDown={(ev) => { if (ev.button > 0) return; if (!bloqueada && !resuelta) onResponder(o.v); }}
                            onClick={(ev) => { if (ev.detail === 0 && !bloqueada && !resuelta) onResponder(o.v); }}
                            style={{ fontSize: `calc(${escala} * clamp(1.15rem,3vw,1.7rem))`, padding: `${14 * escala}px 8px`, minHeight: 64 * escala, opacity: 1, animation: marcada && !esCorrecta ? 'patioTiembla .4s' : undefined, wordBreak: 'break-word' }}>
                            {resuelta && esCorrecta ? '✓ ' : ''}{o.label}
                        </BotonGordo>
                    );
                })}
            </div>
            {resuelta && mostrarExplicacion && q.explicacion && (
                <div style={{ background: acierto ? '#dcfce7' : '#fee2e2', borderRadius: 16, padding: '10px 14px', fontWeight: 600, textAlign: 'center', fontSize: `calc(${escala} * 1.05rem)`, animation: 'patioAparece .2s' }}>
                    {acierto ? '🎉 ¡Muy bien! ' : '💡 '}{q.explicacion}
                </div>
            )}
        </div>
    );
}

function BarraVida({ actual, max, color = '#ef4444', etiqueta }) {
    return (
        <div style={{ width: '100%', maxWidth: 360 }}>
            {etiqueta && <div style={{ fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', marginBottom: 3 }}>{etiqueta}</div>}
            <div style={{ height: 20, borderRadius: 12, background: '#1f1235', border: '3px solid white', overflow: 'hidden', boxShadow: '0 3px 0 rgba(0,0,0,.2)' }}>
                <div style={{ height: '100%', width: `${Math.max(0, actual / max) * 100}%`, background: `linear-gradient(180deg,${color},${color}cc)`, transition: 'width .35s' }} />
            </div>
        </div>
    );
}

function Confeti() {
    const piezas = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ i, x: Math.random() * 100, d: 2.2 + Math.random() * 2.5, del: Math.random() * 1.5, c: ['#ff5d73', '#ffd60a', '#3a86ff', '#2ec4b6', '#8e5cff', '#ff9f1c'][i % 6] })), []);
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
            {piezas.map(p => <div key={p.i} style={{ position: 'absolute', left: `${p.x}%`, top: 0, width: 10, height: 16, background: p.c, borderRadius: 3, animation: `patioConfeti ${p.d}s linear ${p.del}s forwards`, transform: 'translateY(-10vh)' }} />)}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  INDIVIDUAL · MAPA DE AVENTURA
// ═══════════════════════════════════════════════════════════════════
function MapaAventura({ juego, curso, onNivel, onVolver }) {
    const prog = leerLS(claveProgreso(juego.id, curso), {});
    const desbloqueado = (n) => n === 1 || (prog[n - 1] || 0) > 0;
    // Posiciones en zigzag sobre un camino
    const pos = [{ x: 12, y: 78 }, { x: 32, y: 42 }, { x: 52, y: 72 }, { x: 72, y: 36 }, { x: 88, y: 64 }];
    return (
        <Escenario cielo="linear-gradient(180deg,#a5f3fc 0%,#bbf7d0 60%,#86efac 100%)">
            <Cabecera titulo={`🗺️ Mi camino · ${juego.nombre} · ${curso}º`} onVolver={onVolver} />
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '14px 16px 90px' }}>
                <TituloSeccion>El camino de {curso}º</TituloSeccion>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', minHeight: 300, background: 'rgba(255,255,255,0.35)', borderRadius: 28, border: '4px solid white', boxShadow: '0 8px 0 rgba(0,0,0,.08)' }}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        <polyline points={pos.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fde68a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={pos.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2 2" />
                    </svg>
                    {NIVELES.map((nv, i) => {
                        const ok = desbloqueado(nv.n);
                        const est = prog[nv.n] || 0;
                        return (
                            <button key={nv.n} className="patio-btn" disabled={!ok} onClick={() => onNivel(nv)}
                                style={{ position: 'absolute', left: `${pos[i].x}%`, top: `${pos[i].y}%`, transform: 'translate(-50%,-50%)', background: 'none', border: 'none', cursor: ok ? 'pointer' : 'not-allowed', fontFamily: FUENTE, color: TINTA, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 'clamp(56px,9vw,84px)', height: 'clamp(56px,9vw,84px)', borderRadius: '50%', background: ok ? (nv.jefe ? '#8e5cff' : ['#ff5d73', '#ff9f1c', '#2ec4b6', '#3a86ff'][i]) : '#94a3b8', border: '5px solid white', boxShadow: '0 6px 0 rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'clamp(1.4rem,3.5vw,2.2rem)', fontWeight: 700, animation: ok && !est ? 'patioLatido 1.4s infinite' : undefined }}>
                                    {ok ? (nv.jefe ? '👑' : nv.n) : '🔒'}
                                </div>
                                <div style={{ marginTop: 4, background: 'white', borderRadius: 12, padding: '2px 10px', fontWeight: 700, fontSize: 'clamp(0.75rem,1.8vw,0.95rem)', whiteSpace: 'nowrap', boxShadow: '0 3px 0 rgba(0,0,0,.12)' }}>
                                    {nv.nombre}<br /><span style={{ letterSpacing: 1 }}>{[1, 2, 3].map(k => (k <= est ? '⭐' : '☆')).join('')}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <p style={{ textAlign: 'center', fontWeight: 600, marginTop: 14 }}>En cada parada te espera un garabato. Cada acierto lo va borrando. Tienes {CORAZONES} corazones ❤️. Desde el nivel 3 hay tiempo para responder.</p>
            </div>
        </Escenario>
    );
}

// Cartel grande sobre el garabato: deja claro si se ha acertado
const FRASES_OK = ['¡Muy bien!', '¡Genial!', '¡Correcto!', '¡Bravo!', '¡Así se hace!'];
function AvisoRespuesta({ ok }) {
    const [frase] = useState(() => FRASES_OK[Math.floor(Math.random() * FRASES_OK.length)]);
    return (
        <div style={{ position: 'absolute', left: '50%', top: '45%', zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap', animation: 'patioPop 1.1s ease forwards', background: ok ? '#16a34a' : '#ef4444', color: 'white', fontWeight: 800, fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', padding: '6px 22px', borderRadius: 999, border: '4px solid white', boxShadow: '0 6px 0 rgba(0,0,0,.25)' }}>
            {ok ? `✔ ${frase}` : '✘ ¡Uy!'}
        </div>
    );
}

function Nivel({ juego, curso, nivel, onVolver, onSiguiente }) {
    const generar = useMemo(() => crearGenerador(juego, curso), [juego, curso]);
    const [q, setQ] = useState(() => generar());
    const [elegida, setElegida] = useState(null);
    const [vidaMonstruo, setVidaMonstruo] = useState(nivel.vida);
    const [corazones, setCorazones] = useState(CORAZONES);
    const [racha, setRacha] = useState(0);
    const [puntos, setPuntos] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [intentos, setIntentos] = useState(0);
    const [animoM, setAnimoM] = useState('normal');
    const [tiempo, setTiempo] = useState(nivel.tiempo);
    const [fin, setFin] = useState(null); // 'GANA' | 'PIERDE'
    const [enviar, setEnviar] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const inicio = useRef(Date.now());

    const siguiente = useCallback(() => { setQ(generar()); setElegida(null); setAnimoM('normal'); setTiempo(nivel.tiempo); }, [generar, nivel.tiempo]);

    const responder = useCallback((v) => {
        if (elegida != null || fin) return;
        const ok = v === q.correcta;
        setElegida(v === undefined ? '__tiempo__' : v);
        setIntentos(n => n + 1);
        if (ok) {
            sonidoCorrecto();
            const r = racha + 1;
            setRacha(r); setAciertos(n => n + 1);
            const mult = r >= 6 ? 3 : r >= 3 ? 2 : 1;
            setPuntos(p => p + 100 * mult);
            setAnimoM('golpe');
            const vm = vidaMonstruo - 1;
            setVidaMonstruo(vm);
            setTimeout(() => { if (vm <= 0) setFin('GANA'); else siguiente(); }, 1100);
        } else {
            sonidoIncorrecto();
            setRacha(0); setAnimoM('feliz');
            const c = corazones - 1;
            setCorazones(c);
            setTimeout(() => { if (c <= 0) setFin('PIERDE'); else siguiente(); }, 2200);
        }
    }, [elegida, fin, q, racha, vidaMonstruo, corazones, siguiente]);

    // Temporizador por pregunta (niveles 3-5)
    useEffect(() => {
        if (!nivel.tiempo || elegida != null || fin) return;
        if (tiempo <= 0) { responder(undefined); return; }
        const t = setTimeout(() => setTiempo(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [tiempo, elegida, fin, nivel.tiempo, responder]);

    const estrellas = fin === 'GANA' ? (corazones >= 3 ? 3 : corazones === 2 ? 2 : 1) : 0;
    useEffect(() => {
        if (fin !== 'GANA') return;
        sonidoFinal();
        const k = claveProgreso(juego.id, curso);
        const prog = leerLS(k, {});
        if ((prog[nivel.n] || 0) < estrellas) guardarLS(k, { ...prog, [nivel.n]: estrellas });
    }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps

    const porcentaje = intentos ? Math.round((aciertos / intentos) * 100) : 0;
    const datos = {
        aciertos, intentos, porcentaje, tiempo: Math.round((Date.now() - inicio.current) / 1000),
        config: { juego: juego.nombre, materia: materiaPorId(juego.materia).informe, curso: `${curso}º Primaria`, modo: `Mi camino · parada ${nivel.n} (${nivel.nombre})`, estrellas, puntos },
    };
    const guardarLocal = () => {
        guardarRegistroLocal('PATIO', { titulo: `${juego.nombre} · ${curso}º · parada ${nivel.n}`, aciertos, intentos, porcentaje, via: 'local' });
        setGuardado(true);
    };

    if (fin) return (
        <Escenario cielo={fin === 'GANA' ? 'linear-gradient(180deg,#fde68a,#fbcfe8)' : 'linear-gradient(180deg,#c7d2fe,#e0e7ff)'}>
            {fin === 'GANA' && <Confeti />}
            <Cabecera titulo={`${juego.nombre} · parada ${nivel.n}`} onVolver={onVolver} textoVolver="← Mapa" />
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '22px 16px 90px', textAlign: 'center' }}>
                <Monstruo tipo={nivel.tipo} color={nivel.jefe ? JEFE.color : undefined} corona={nivel.jefe} size={140} animo={fin === 'GANA' ? 'golpe' : 'feliz'} />
                <h1 style={{ fontSize: '2.6rem', margin: '6px 0', color: fin === 'GANA' ? '#16a34a' : '#e11d48' }}>{fin === 'GANA' ? (nivel.jefe ? '¡Has borrado al Rey Garabato!' : '¡Parada superada!') : '¡Casi! Inténtalo otra vez'}</h1>
                {fin === 'GANA' && <div style={{ fontSize: '3rem', letterSpacing: 6 }}>{[1, 2, 3].map(k => (k <= estrellas ? '⭐' : '☆')).join('')}</div>}
                <div style={{ background: 'white', borderRadius: 22, padding: 16, margin: '12px 0', fontWeight: 600, fontSize: '1.15rem', boxShadow: '0 6px 0 rgba(0,0,0,.1)' }}>
                    ✅ {aciertos} de {intentos} ({porcentaje}%) · 🏆 {puntos} puntos
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 10 }}>
                    {fin === 'GANA' && nivel.n < NIVELES.length && <BotonGordo color="#16a34a" grande onClick={() => onSiguiente(nivel.n + 1)}>Siguiente parada ▶</BotonGordo>}
                    <BotonGordo color="#ff9f1c" grande onClick={() => onSiguiente(nivel.n)}>🔁 Repetir</BotonGordo>
                    <BotonGordo color="#3a86ff" grande onClick={() => setEnviar(true)}>📤 Enviar al profe</BotonGordo>
                    <BotonGordo color="#64748b" onClick={guardarLocal} disabled={guardado}>{guardado ? '✓ Guardado' : '💾 Guardar en este equipo'}</BotonGordo>
                </div>
            </div>
            {enviar && <ModalEnviarProfe datos={datos} onClose={() => setEnviar(false)} />}
        </Escenario>
    );

    const mult = racha >= 6 ? 3 : racha >= 3 ? 2 : 1;
    return (
        <Escenario cielo={nivel.jefe ? 'linear-gradient(180deg,#4c1d95 0%,#7c3aed 60%,#c4b5fd 100%)' : undefined}>
            <Cabecera titulo={`${juego.emoji} ${juego.nombre} · Parada ${nivel.n}`} onVolver={onVolver} textoVolver="← Mapa" />
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '10px 16px 90px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontWeight: 700, fontSize: '1.2rem', color: nivel.jefe ? 'white' : TINTA }}>
                    <div style={{ fontSize: '1.6rem' }}>{Array.from({ length: CORAZONES }, (_, i) => (i < corazones ? '❤️' : '🖤')).join('')}</div>
                    <div>🏆 {puntos}{mult > 1 && <span key={racha} style={{ marginLeft: 8, background: '#ffd60a', color: TINTA, borderRadius: 12, padding: '2px 10px', display: 'inline-block', animation: 'patioSalto .4s' }}>¡Racha ×{mult}!</span>}</div>
                    {nivel.tiempo > 0 && <div style={{ background: tiempo <= 3 ? '#ef4444' : 'white', color: tiempo <= 3 ? 'white' : TINTA, borderRadius: 14, padding: '2px 12px', minWidth: 64, textAlign: 'center' }}>⏱️ {Math.max(0, tiempo)}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0 12px', position: 'relative' }}>
                    {elegida != null && <AvisoRespuesta key={intentos} ok={elegida === q.correcta} />}
                    <Monstruo key={`${animoM}-${intentos}`} tipo={nivel.tipo} color={nivel.jefe ? JEFE.color : undefined} corona={nivel.jefe} size={nivel.jefe ? 150 : 120} animo={animoM} />
                    <BarraVida actual={vidaMonstruo} max={nivel.vida} etiqueta={nivel.jefe ? `👑 ${JEFE.nombre}` : `Garabato ${nivel.nombre.replace(/^El /, 'del ').replace(/^La /, 'de la ')}`} />
                </div>
                <Pregunta q={q} elegida={elegida} onResponder={responder} />
            </div>
        </Escenario>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  COMPETITIVO · 2-4 alumnos a la vez en la pizarra
// ═══════════════════════════════════════════════════════════════════
const DURACIONES = [60, 90, 120];

function ConfigJugadores({ titulo, n, setN, minimo = 2, nombres, setNombres, tipos, setTipos, extra, onEmpezar, onVolver, prefijo = 'Jugador' }) {
    return (
        <Escenario>
            <Cabecera titulo={titulo} onVolver={onVolver} />
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '18px 16px 90px' }}>
                <TituloSeccion>¿Cuántos {prefijo === 'Equipo' ? 'equipos' : 'jugadores'}?</TituloSeccion>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                    {[2, 3, 4].filter(k => k >= minimo).map(k => <BotonGordo key={k} grande color={n === k ? '#8e5cff' : '#94a3b8'} onClick={() => setN(k)} style={{ minWidth: 80, fontSize: '1.8rem' }}>{k}</BotonGordo>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(180px,1fr))`, gap: 14, marginBottom: 20 }}>
                    {Array.from({ length: n }, (_, i) => (
                        <div key={i} style={{ background: 'white', borderRadius: 22, padding: 12, border: `4px solid ${MONSTRUOS[tipos[i] % 6].color}`, boxShadow: `0 6px 0 ${MONSTRUOS[tipos[i] % 6].color}`, textAlign: 'center' }}>
                            <button onClick={() => setTipos(t => t.map((x, j) => (j === i ? (x + 1) % 6 : x)))} title="Cambiar garabato" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Monstruo tipo={tipos[i]} size={86} />
                            </button>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.7 }}>Toca el garabato para cambiarlo</div>
                            <input value={nombres[i]} onChange={e => setNombres(a => a.map((x, j) => (j === i ? e.target.value : x)))} maxLength={16}
                                style={{ marginTop: 6, width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 12, border: '2px solid #e2e8f0', fontFamily: FUENTE, fontSize: '1.05rem', fontWeight: 600, textAlign: 'center', color: TINTA }} />
                        </div>
                    ))}
                </div>
                {extra}
                <div style={{ textAlign: 'center', marginTop: 18 }}>
                    <BotonGordo grande color="#16a34a" onClick={onEmpezar} style={{ fontSize: '1.6rem', padding: '16px 40px' }}>¡A jugar! ▶</BotonGordo>
                </div>
            </div>
        </Escenario>
    );
}

function Competitivo({ juego, curso, onVolver }) {
    const [fase, setFase] = useState('CONFIG'); // CONFIG | CUENTA | JUEGO | FIN
    const [n, setN] = useState(2);
    const [nombres, setNombres] = useState(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4']);
    const [tipos, setTipos] = useState([0, 1, 2, 3]);
    const [duracion, setDuracion] = useState(60);
    const [cuenta, setCuenta] = useState(3);
    const [restante, setRestante] = useState(60);
    const [puntos, setPuntos] = useState([0, 0, 0, 0]);

    useEffect(() => {
        if (fase !== 'CUENTA') return;
        if (cuenta <= 0) { setFase('JUEGO'); return; }
        const t = setTimeout(() => setCuenta(c => c - 1), 800);
        return () => clearTimeout(t);
    }, [fase, cuenta]);
    useEffect(() => {
        if (fase !== 'JUEGO') return;
        if (restante <= 0) { sonidoFinal(); setFase('FIN'); return; }
        const t = setTimeout(() => setRestante(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [fase, restante]);

    const empezar = () => { despertarAudio(); setPuntos([0, 0, 0, 0]); setRestante(duracion); setCuenta(3); setFase('CUENTA'); };
    const sumar = useCallback((i) => setPuntos(p => p.map((x, j) => (j === i ? x + 1 : x))), []);

    if (fase === 'CONFIG') return (
        <ConfigJugadores titulo={`🏁 Carrera · ${juego.nombre} · ${curso}º`} n={n} setN={setN} nombres={nombres} setNombres={setNombres} tipos={tipos} setTipos={setTipos} onVolver={onVolver} onEmpezar={empezar}
            extra={<>
                <TituloSeccion>Tiempo de la partida</TituloSeccion>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    {DURACIONES.map(d => <BotonGordo key={d} color={duracion === d ? '#ff9f1c' : '#94a3b8'} onClick={() => setDuracion(d)} grande>{d} s</BotonGordo>)}
                </div>
            </>} />
    );

    if (fase === 'FIN') return <Podio jugadores={Array.from({ length: n }, (_, i) => ({ nombre: nombres[i] || `Jugador ${i + 1}`, tipo: tipos[i], puntos: puntos[i] }))} onOtra={() => setFase('CONFIG')} onVolver={onVolver} titulo={`${juego.nombre} · ${curso}º`} />;

    return (
        <Escenario>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(255,255,255,0.8)', borderBottom: `3px solid ${TINTA}14` }}>
                    <button onClick={() => setFase('FIN')} style={{ background: 'white', border: `3px solid ${TINTA}22`, borderRadius: 12, padding: '4px 10px', fontFamily: FUENTE, fontWeight: 700, cursor: 'pointer' }}>⏹ Terminar</button>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{juego.emoji} {juego.nombre} · {curso}º</div>
                    <div style={{ fontWeight: 700, fontSize: '1.4rem', background: restante <= 10 ? '#ef4444' : '#ffd60a', color: restante <= 10 ? 'white' : TINTA, borderRadius: 14, padding: '2px 14px' }}>⏱️ {restante}</div>
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${n},1fr)`, minHeight: 0, touchAction: 'manipulation' }}>
                    {Array.from({ length: n }, (_, i) => (
                        <ColumnaJugador key={i} indice={i} n={n} juego={juego} curso={curso} nombre={nombres[i] || `Jugador ${i + 1}`} tipo={tipos[i]} puntos={puntos[i]} onAcierto={sumar} activa={fase === 'JUEGO'} />
                    ))}
                </div>
            </div>
            {fase === 'CUENTA' && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(43,29,78,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div key={cuenta} style={{ fontSize: '12rem', fontWeight: 700, color: '#ffd60a', textShadow: `0 8px 0 ${TINTA}`, animation: 'patioAparece .5s', fontFamily: FUENTE }}>{cuenta > 0 ? cuenta : '¡YA!'}</div>
                </div>
            )}
        </Escenario>
    );
}

function ColumnaJugador({ indice, n, juego, curso, nombre, tipo, puntos, onAcierto, activa }) {
    const generar = useMemo(() => crearGenerador(juego, curso), [juego, curso]);
    const [q, setQ] = useState(() => generar());
    const [elegida, setElegida] = useState(null);
    const [animo, setAnimo] = useState('normal');
    const [racha, setRacha] = useState(0);
    const color = MONSTRUOS[tipo % 6].color;
    const escala = n >= 4 ? 0.62 : n === 3 ? 0.75 : 0.9;

    const responder = (v) => {
        if (!activa || elegida != null) return;
        setElegida(v);
        const ok = v === q.correcta;
        if (ok) { sonidoCorrecto(); onAcierto(indice); setAnimo('feliz'); setRacha(r => r + 1); }
        else { sonidoIncorrecto(); setAnimo('triste'); setRacha(0); }
        // Penalización: tras un fallo se queda bloqueado un poco más
        setTimeout(() => { setQ(generar()); setElegida(null); setAnimo('normal'); }, ok ? 500 : 1500);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: indice < n - 1 ? `4px dashed ${TINTA}33` : 'none', background: `${color}18`, padding: '8px 10px 52px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: color, color: 'white', borderRadius: 18, padding: '4px 10px', boxShadow: '0 5px 0 rgba(0,0,0,.2)', marginBottom: 10 }}>
                <Monstruo key={animo + puntos} tipo={tipo} size={n >= 4 ? 44 : 56} animo={animo} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: n >= 4 ? '0.95rem' : '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 0 rgba(0,0,0,.2)' }}>{nombre}</div>
                    {racha >= 3 && <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>🔥 racha de {racha}</div>}
                </div>
                <div key={puntos} style={{ fontSize: n >= 4 ? '1.8rem' : '2.3rem', fontWeight: 700, textShadow: '0 3px 0 rgba(0,0,0,.25)', animation: puntos ? 'patioSalto .4s' : undefined }}>{puntos}</div>
            </div>
            <Pregunta q={q} elegida={elegida} onResponder={responder} bloqueada={!activa} escala={escala} columnas={n >= 3 ? 1 : 2} mostrarExplicacion={false} />
        </div>
    );
}

function Podio({ jugadores, onOtra, onVolver, titulo }) {
    const orden = [...jugadores].sort((a, b) => b.puntos - a.puntos);
    const empate = orden.length > 1 && orden[0].puntos === orden[1].puntos;
    const medallas = ['🥇', '🥈', '🥉', '🎖️'];
    const alturas = [200, 150, 115, 90];
    const visual = orden.length >= 3 ? [orden[1], orden[0], orden[2], orden[3]].filter(Boolean) : [orden[0], orden[1]];
    return (
        <Escenario cielo="linear-gradient(180deg,#fde68a,#fbcfe8)">
            <Confeti />
            <Cabecera titulo={`🏆 Resultados · ${titulo}`} onVolver={onVolver} />
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '18px 16px 90px', textAlign: 'center' }}>
                <h1 style={{ fontSize: 'clamp(2rem,6vw,3.2rem)', margin: '0 0 6px', color: '#e85d04', textShadow: `0 3px 0 ${TINTA}22` }}>{empate ? '¡Empate!' : `¡Gana ${orden[0].nombre}!`}</h1>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginTop: 20 }}>
                    {visual.map((j) => {
                        const pos = orden.indexOf(j);
                        const color = MONSTRUOS[j.tipo % 6].color;
                        return (
                            <div key={pos} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'clamp(90px,20vw,170px)' }}>
                                <Monstruo tipo={j.tipo} size={pos === 0 ? 110 : 84} animo={pos === 0 ? 'feliz' : 'normal'} corona={pos === 0 && !empate} />
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', margin: '4px 0' }}>{j.nombre}</div>
                                <div style={{ width: '100%', height: alturas[pos], background: color, borderRadius: '18px 18px 0 0', border: '4px solid white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10, color: 'white', boxShadow: '0 6px 0 rgba(0,0,0,.15)' }}>
                                    <div style={{ fontSize: '2.2rem' }}>{medallas[pos]}</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, textShadow: '0 3px 0 rgba(0,0,0,.2)' }}>{j.puntos}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
                    <BotonGordo grande color="#16a34a" onClick={onOtra}>🔁 Otra partida</BotonGordo>
                    <BotonGordo grande color="#3a86ff" onClick={onVolver}>Elegir otro modo</BotonGordo>
                </div>
            </div>
        </Escenario>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  TODA LA CLASE · equipos por turnos o la clase contra el Rey Garabato
// ═══════════════════════════════════════════════════════════════════
function Grupal({ juego, curso, onVolver }) {
    const [tipoGrupal, setTipoGrupal] = useState(null); // EQUIPOS | CLASE
    if (tipoGrupal === 'EQUIPOS') return <Equipos juego={juego} curso={curso} onVolver={() => setTipoGrupal(null)} />;
    if (tipoGrupal === 'CLASE') return <ClaseVsMonstruo juego={juego} curso={curso} onVolver={() => setTipoGrupal(null)} />;
    const opciones = [
        { id: 'EQUIPOS', emoji: '🚩', titulo: 'Equipos por turnos', texto: 'De 2 a 4 equipos. En cada turno sale a la pizarra alguien de un equipo. ¡Cada acierto es un punto!', color: '#ff9f1c', tipo: 3 },
        { id: 'CLASE', emoji: '🐉', titulo: 'Contra el Rey Garabato', texto: 'Toda la clase contra el Rey Garabato. Pensad la respuesta juntos antes de que se acabe el tiempo.', color: '#8e5cff', tipo: 4 },
    ];
    return (
        <Escenario>
            <Cabecera titulo={`🤝 Toda la clase · ${juego.nombre} · ${curso}º`} onVolver={onVolver} />
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '22px 16px 90px' }}>
                <TituloSeccion>¿Cómo jugamos juntos?</TituloSeccion>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
                    {opciones.map(o => (
                        <button key={o.id} className="patio-btn" onClick={() => { despertarAudio(); setTipoGrupal(o.id); }}
                            style={{ background: 'white', border: `5px solid ${o.color}`, borderRadius: 28, padding: 18, cursor: 'pointer', fontFamily: FUENTE, color: TINTA, boxShadow: `0 8px 0 ${o.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <Monstruo tipo={o.tipo} size={96} color={o.id === 'CLASE' ? JEFE.color : undefined} corona={o.id === 'CLASE'} />
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: o.color }}>{o.emoji} {o.titulo}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>{o.texto}</div>
                        </button>
                    ))}
                </div>
            </div>
        </Escenario>
    );
}

function Equipos({ juego, curso, onVolver }) {
    const [fase, setFase] = useState('CONFIG');
    const [n, setN] = useState(2);
    const [nombres, setNombres] = useState(['Equipo Rojo', 'Equipo Azul', 'Equipo Verde', 'Equipo Naranja']);
    const [tipos, setTipos] = useState([0, 1, 2, 3]);
    const [rondas, setRondas] = useState(5);
    const [turno, setTurno] = useState(0);
    const [puntos, setPuntos] = useState([0, 0, 0, 0]);
    const generar = useMemo(() => crearGenerador(juego, curso), [juego, curso]);
    const [q, setQ] = useState(() => generar());
    const [elegida, setElegida] = useState(null);
    const total = rondas * n;
    const equipo = turno % n;

    const responder = (v) => {
        if (elegida != null) return;
        setElegida(v);
        if (v === q.correcta) { sonidoCorrecto(); setPuntos(p => p.map((x, j) => (j === equipo ? x + 1 : x))); } else sonidoIncorrecto();
    };
    const pasar = () => {
        if (turno + 1 >= total) { sonidoFinal(); setFase('FIN'); return; }
        setTurno(t => t + 1); setQ(generar()); setElegida(null);
    };
    const empezar = () => { setTurno(0); setPuntos([0, 0, 0, 0]); setQ(generar()); setElegida(null); setFase('JUEGO'); };

    if (fase === 'CONFIG') return (
        <ConfigJugadores titulo={`🚩 Equipos · ${juego.nombre} · ${curso}º`} prefijo="Equipo" n={n} setN={setN} nombres={nombres} setNombres={setNombres} tipos={tipos} setTipos={setTipos} onVolver={onVolver} onEmpezar={empezar}
            extra={<>
                <TituloSeccion>Preguntas por equipo</TituloSeccion>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    {[3, 5, 8, 10].map(r => <BotonGordo key={r} color={rondas === r ? '#ff9f1c' : '#94a3b8'} onClick={() => setRondas(r)} grande>{r}</BotonGordo>)}
                </div>
            </>} />
    );
    if (fase === 'FIN') return <Podio jugadores={Array.from({ length: n }, (_, i) => ({ nombre: nombres[i] || `Equipo ${i + 1}`, tipo: tipos[i], puntos: puntos[i] }))} onOtra={() => setFase('CONFIG')} onVolver={onVolver} titulo={`${juego.nombre} · ${curso}º`} />;

    const color = MONSTRUOS[tipos[equipo] % 6].color;
    return (
        <Escenario>
            <Cabecera titulo={`🚩 ${juego.nombre} · pregunta ${turno + 1} de ${total}`} onVolver={() => setFase('CONFIG')} textoVolver="⏹ Terminar" />
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 16px 90px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n},1fr)`, gap: 10, marginBottom: 12 }}>
                    {Array.from({ length: n }, (_, i) => {
                        const c = MONSTRUOS[tipos[i] % 6].color;
                        const activo = i === equipo;
                        return (
                            <div key={i} style={{ background: activo ? c : 'white', color: activo ? 'white' : TINTA, border: `4px solid ${c}`, borderRadius: 18, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: activo ? `0 0 0 4px white, 0 6px 0 ${c}` : `0 4px 0 ${c}`, transform: activo ? 'scale(1.04)' : 'none', transition: 'all .2s' }}>
                                <Monstruo tipo={tipos[i]} size={44} animo={activo && elegida != null ? (elegida === q.correcta ? 'feliz' : 'triste') : 'normal'} key={`${i}-${turno}-${elegida}`} />
                                <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombres[i]}</div>
                                <div style={{ fontWeight: 700, fontSize: '1.8rem' }}>{puntos[i]}</div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.4rem', color: 'white', textShadow: `0 3px 0 ${color}, 0 0 3px ${TINTA}`, marginBottom: 8 }}>Turno de {nombres[equipo]}</div>
                <Pregunta q={q} elegida={elegida} onResponder={responder} />
                {elegida != null && <div style={{ textAlign: 'center', marginTop: 14 }}><BotonGordo grande color="#16a34a" onClick={pasar}>{turno + 1 >= total ? 'Ver resultados 🏆' : 'Siguiente turno ▶'}</BotonGordo></div>}
            </div>
        </Escenario>
    );
}

function ClaseVsMonstruo({ juego, curso, onVolver }) {
    const VIDA = 10, VIDAS_CLASE = 5;
    const [tiempoPregunta, setTiempoPregunta] = useState(20);
    const [fase, setFase] = useState('CONFIG');
    const generar = useMemo(() => crearGenerador(juego, curso), [juego, curso]);
    const [q, setQ] = useState(() => generar());
    const [elegida, setElegida] = useState(null);
    const [vida, setVida] = useState(VIDA);
    const [vidas, setVidas] = useState(VIDAS_CLASE);
    const [tiempo, setTiempo] = useState(20);
    const [animo, setAnimo] = useState('normal');

    const responder = useCallback((v) => {
        if (elegida != null || fase !== 'JUEGO') return;
        setElegida(v === undefined ? '__tiempo__' : v);
        if (v === q.correcta) { sonidoCorrecto(); setVida(x => x - 1); setAnimo('golpe'); }
        else { sonidoIncorrecto(); setVidas(x => x - 1); setAnimo('feliz'); }
    }, [elegida, fase, q]);

    useEffect(() => {
        if (fase !== 'JUEGO' || elegida != null) return;
        if (tiempo <= 0) { responder(undefined); return; }
        const t = setTimeout(() => setTiempo(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [fase, tiempo, elegida, responder]);

    const pasar = () => {
        if (vida <= 0) { sonidoFinal(); setFase('GANA'); return; }
        if (vidas <= 0) { setFase('PIERDE'); return; }
        setQ(generar()); setElegida(null); setTiempo(tiempoPregunta); setAnimo('normal');
    };
    const empezar = () => { setVida(VIDA); setVidas(VIDAS_CLASE); setQ(generar()); setElegida(null); setTiempo(tiempoPregunta); setAnimo('normal'); setFase('JUEGO'); };

    if (fase === 'CONFIG') return (
        <Escenario cielo="linear-gradient(180deg,#4c1d95 0%,#7c3aed 60%,#c4b5fd 100%)">
            <Cabecera titulo={`🐉 Contra el Rey Garabato · ${juego.nombre}`} onVolver={onVolver} />
            <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 90px', textAlign: 'center', color: 'white' }}>
                <Monstruo tipo={3} color={JEFE.color} corona size={170} />
                <h1 style={{ margin: '6px 0', fontSize: '2.4rem', textShadow: `0 4px 0 ${TINTA}` }}>¡El {JEFE.nombre} ataca!</h1>
                <p style={{ fontWeight: 600, fontSize: '1.15rem' }}>Acertad {VIDA} preguntas para vencerlo. Si falláis o se acaba el tiempo, la clase pierde un corazón (tenéis {VIDAS_CLASE}).</p>
                <TituloSeccion>Segundos por pregunta</TituloSeccion>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
                    {[15, 20, 30, 45].map(s => <BotonGordo key={s} grande color={tiempoPregunta === s ? '#ff9f1c' : '#94a3b8'} onClick={() => setTiempoPregunta(s)}>{s}</BotonGordo>)}
                </div>
                <BotonGordo grande color="#16a34a" onClick={empezar} style={{ fontSize: '1.6rem', padding: '16px 40px' }}>¡A la batalla! ⚔️</BotonGordo>
            </div>
        </Escenario>
    );

    if (fase === 'GANA' || fase === 'PIERDE') return (
        <Escenario cielo={fase === 'GANA' ? 'linear-gradient(180deg,#fde68a,#fbcfe8)' : 'linear-gradient(180deg,#4c1d95,#7c3aed)'}>
            {fase === 'GANA' && <Confeti />}
            <Cabecera titulo="🐉 Contra el Rey Garabato" onVolver={onVolver} />
            <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 90px', textAlign: 'center' }}>
                <Monstruo tipo={3} color={JEFE.color} corona size={160} animo={fase === 'GANA' ? 'golpe' : 'feliz'} />
                <h1 style={{ fontSize: '2.6rem', margin: '8px 0', color: fase === 'GANA' ? '#16a34a' : 'white', textShadow: `0 4px 0 ${TINTA}55` }}>{fase === 'GANA' ? '¡La clase ha ganado! 🎉' : '¡El Rey Garabato se escapa!'}</h1>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                    <BotonGordo grande color="#16a34a" onClick={empezar}>🔁 Revancha</BotonGordo>
                    <BotonGordo grande color="#3a86ff" onClick={onVolver}>Volver</BotonGordo>
                </div>
            </div>
        </Escenario>
    );

    return (
        <Escenario cielo="linear-gradient(180deg,#4c1d95 0%,#7c3aed 55%,#c4b5fd 100%)">
            <Cabecera titulo={`🐉 ${juego.nombre} · ${curso}º`} onVolver={() => setFase('CONFIG')} textoVolver="⏹ Terminar" />
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '10px 16px 90px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', fontWeight: 700, fontSize: '1.3rem' }}>
                    <div>👧🧒 Clase: {Array.from({ length: VIDAS_CLASE }, (_, i) => (i < vidas ? '❤️' : '🖤')).join('')}</div>
                    <div style={{ background: tiempo <= 5 ? '#ef4444' : '#ffd60a', color: tiempo <= 5 ? 'white' : TINTA, borderRadius: 14, padding: '2px 14px' }}>⏱️ {Math.max(0, tiempo)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0 12px', color: 'white', position: 'relative' }}>
                    {elegida != null && <AvisoRespuesta key={`${vida}-${vidas}`} ok={elegida === q.correcta} />}
                    <Monstruo key={`${animo}-${vida}-${vidas}`} tipo={3} color={JEFE.color} corona size={150} animo={animo} />
                    <BarraVida actual={vida} max={VIDA} etiqueta={`👑 ${JEFE.nombre}`} />
                </div>
                <Pregunta q={q} elegida={elegida} onResponder={responder} />
                {elegida != null && <div style={{ textAlign: 'center', marginTop: 14 }}><BotonGordo grande color="#16a34a" onClick={pasar}>{vida <= 0 || vidas <= 0 ? 'Ver final' : 'Siguiente ▶'}</BotonGordo></div>}
            </div>
        </Escenario>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  ENVÍO AL PROFESOR (informes_juegos · tipo PATIO)
// ═══════════════════════════════════════════════════════════════════
function ModalEnviarProfe({ datos, onClose }) {
    const [nombre, setNombre] = useState('');
    const [grupo, setGrupo] = useState('');
    const [codigo, setCodigo] = useState('');
    const [estado, setEstado] = useState('form');
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) return setError('Escribe tu nombre.');
        if (!validarNombre(nombre).ok) return setError(validarNombre(nombre).mensaje);
        if (!code) return setError('Escribe el código del profesor.');
        setEstado('enviando'); setError('');
        try {
            const cod = await getDoc(doc(db, 'codigos_profesor', code));
            if (!cod.exists()) { setError('Código no encontrado.'); setEstado('form'); return; }
            const curso = grupo.trim() || datos.config.curso;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'PATIO', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                config: datos.config,
                jugadores: [{ nombre: nombre.trim(), curso, aciertos: datos.aciertos, intentos: datos.intentos, porcentaje: datos.porcentaje, tiempo: datos.tiempo }],
            });
            guardarRegistroLocal('PATIO', {
                titulo: `${datos.config.juego} · ${datos.config.curso} · ${datos.config.modo}`, aciertos: datos.aciertos, intentos: datos.intentos,
                porcentaje: datos.porcentaje, nombre: nombre.trim(), curso, via: 'profesor',
            });
            setEstado('ok');
        } catch (e) { console.error(e); setError('Error al enviar: ' + e.message); setEstado('form'); }
    };

    const inp = { padding: '12px 14px', borderRadius: 14, border: '3px solid #e2e8f0', fontSize: '1.05rem', width: '100%', boxSizing: 'border-box', fontFamily: FUENTE, fontWeight: 600, color: TINTA };
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(43,29,78,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: FUENTE, color: TINTA }}>
            <div style={{ background: 'white', borderRadius: 26, padding: 20, width: '100%', maxWidth: 400, border: '5px solid #3a86ff', boxShadow: '0 8px 0 #3a86ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <b style={{ fontSize: '1.3rem' }}>📤 Enviar al profe</b>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>
                {estado === 'ok' ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <Monstruo tipo={5} size={90} animo="feliz" />
                        <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '1.3rem' }}>¡Resultado enviado!</div>
                        <BotonGordo color="#3a86ff" onClick={onClose} style={{ marginTop: 12 }}>Cerrar</BotonGordo>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#eef2ff', borderRadius: 14, padding: '8px 12px', fontWeight: 600 }}>
                            {datos.config.juego} · {datos.config.curso}<br />{datos.config.modo}<br /><b>{datos.aciertos}/{datos.intentos}</b> ({datos.porcentaje}%) · {'⭐'.repeat(datos.config.estrellas || 0)}
                        </div>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre y apellido" style={inp} />
                        <input value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Tu clase (ej: 3º B)" style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profe" maxLength={10} style={{ ...inp, letterSpacing: 2 }} />
                        {error && <div style={{ color: '#e11d48', fontWeight: 600 }}>⚠ {error}</div>}
                        <BotonGordo grande color="#16a34a" onClick={enviar} disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviar'}</BotonGordo>
                    </div>
                )}
            </div>
        </div>
    );
}
