import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { validarNombre } from './utils/filtroNombres';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal, sonidoActivo } from './utils/sonidosFeedback';
import confetti from 'canvas-confetti';
import { useMandosOvni, ElegirPiloto, PilotoEnJuego } from './ovniMandos.jsx';
import ChipAntena from './mandos/ChipAntena.jsx';
import { BotonTutorialMandos } from './mandos/TutorialMandos.jsx';
import { categoriasDeRecurso, conOpcionesParaElegir, barajar } from './utils/normalizarPreguntas';
import { conRecursosPikt } from './bancoPreguntas/recursosPikt';
import { crearVuelo, COLORES_OPCION } from './aviones/motorVuelo';
import HojasRecurso, { filtrarHojas, textoHojas } from './components/HojasRecurso';
import { ValoracionRecurso, OrdenRecursos, ordenarRecursos } from './components/ValoracionRecurso';
import { contarJugada } from './utils/valoracionRecursos';

// ─── Pilota el avión (three.js) ──────────────────────────────────────────────
// Despega, sigue el circuito de aros, responde pasando por el aro de la respuesta
// correcta (A-D) y aterriza. De momento 1 piloto; el motor ya admite 2 (pantalla partida).
const FUENTE = "'Segoe UI', system-ui, sans-serif";
const CIAN = '#29b6f6', NARANJA = '#ff9800';
const SIN_PREGUNTAS = { id: 'solo', titulo: '✈️ Solo pilotar (sin preguntas)', temas: 'Aros y aterrizaje', soloAros: true, hojas: [] };
const LETRAS = ['A', 'B', 'C', 'D'];
const LS_CFG = 'pikt_aviones_cfg';
const leerCfg = () => { try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}') || {}; } catch { return {}; } };
const fondo = { minHeight: '100vh', background: 'linear-gradient(160deg,#0b2545 0%,#13315c 45%,#1e5aa0 100%)', color: 'white', fontFamily: FUENTE };
const titulo = { fontSize: '2.1rem', fontWeight: 900, margin: '0 0 6px', color: '#fff', textShadow: '0 3px 14px rgba(0,0,0,0.4)' };
const boton = (bg) => ({ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white', background: bg, fontFamily: FUENTE });

/** Preguntas de elegir (A-D) del recurso y hoja elegidos. */
function preguntasPara(recurso, hoja) {
    if (!recurso || recurso.soloAros) return [];
    const cats = categoriasDeRecurso(recurso);
    const lista = filtrarHojas(cats, hoja).flatMap(c => c.preguntas);
    return barajar(conOpcionesParaElegir(lista).filter(p => p && p.tipo === 'MULTIPLE' && Array.isArray(p.opciones) && p.opciones.length >= 2))
        .map(p => ({ ...p, opciones: barajar(p.opciones.slice(0, 4).includes(p.correcta) ? p.opciones.slice(0, 4) : [p.correcta, ...p.opciones.filter(o => o !== p.correcta).slice(0, 3)]) }));
}

// ═══════════════════════════ ELEGIR PREGUNTAS ══════════════════════════════
function PantallaPrevia({ onIniciar, onSalir }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [sel, setSel] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [orden, setOrden] = useState('jugados'); // 🔥 más jugados · ❤️ más gustan · 🆕 recientes
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false)));
                const profes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setRecursos([SIN_PREGUNTAS, ...(await conRecursosPikt(profes, 'CAZABURBUJAS'))]);
            } catch (e) { console.error('Aviones:', e); setRecursos([SIN_PREGUNTAS]); }
            setCargando(false);
        })();
    }, []);
    const hojas = sel?.hojas?.map(h => h.nombreHoja).filter(Boolean) || [];
    const filtrados = recursos.filter(r => !filtro || `${r.titulo} ${r.temas || ''} ${r.ciclo || ''}`.toLowerCase().includes(filtro.toLowerCase()));
    // La opción especial del juego siempre la primera; el resto, en el orden elegido
    const lista = [...filtrados.filter(r => r.soloAros), ...ordenarRecursos(filtrados.filter(r => !(r.soloAros)), orden)];
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: 900, display: 'flex' }}><button onClick={onSalir} style={{ ...boton('rgba(255,255,255,0.12)'), padding: '8px 14px', fontSize: '0.85rem' }}>← Salir</button></div>
            <div style={{ fontSize: '3.2rem' }}>✈️</div>
            <h1 style={titulo}>Pilota el avión</h1>
            <p style={{ color: '#cfe3f7', margin: '0 0 18px', textAlign: 'center', maxWidth: 620, lineHeight: 1.5 }}>Despega, vuela por los aros y en cada puerta de pregunta <b>pasa por el aro de la respuesta correcta</b>. Al final, ¡aterriza en la pista!</p>
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔎 Buscar recurso, tema o curso…" style={{ width: '100%', maxWidth: 900, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.95rem', marginBottom: 14, boxSizing: 'border-box' }} />
            <OrdenRecursos valor={orden} onChange={setOrden} oscuro color={CIAN} style={{ width: '100%', maxWidth: 900, marginBottom: 14 }} />
            {cargando ? <p style={{ color: '#cfe3f7' }}>Cargando recursos…</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12, width: '100%', maxWidth: 900 }}>
                    {lista.map(r => (
                        <div key={r.id} onClick={() => setSel(r)} style={{ background: sel?.id === r.id ? 'rgba(41,182,246,0.25)' : 'rgba(255,255,255,0.08)', border: `2px solid ${sel?.id === r.id ? CIAN : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.soloAros ? '' : r.esPikt ? 'π ' : '📚 '}{r.titulo}</div>
                            <div style={{ color: '#cfe3f7', fontSize: '0.78rem' }}>{r.temas || r.profesorNombre || ''}{r.ciclo ? ` · ${r.ciclo}` : ''}</div>
                            {!r.soloAros && <div style={{ color: '#cfe3f7', fontSize: '0.78rem' }}>{r.hojas?.length || 1} hoja(s)</div>}
                            <ValoracionRecurso r={r} oscuro style={{ marginTop: 6 }} />
                        </div>
                    ))}
                </div>
            )}
            {sel && (
                <div style={{ width: '100%', maxWidth: 900, marginTop: 18, marginBottom: 30 }}>
                    <HojasRecurso key={sel.id} recurso={sel} color={CIAN} colores={COLORES_OPCION} textoContinuar="✈️ Continuar" onElegir={(h) => { contarJugada(sel); onIniciar(sel, h); }} />
                </div>
            )}
        </div>
    );
}

function PantallaHoja({ recurso, onElegir, onSalir }) {
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
            <div style={{ fontSize: '3rem' }}>✈️</div>
            <div style={{ width: '100%', maxWidth: 820 }}>
                <HojasRecurso recurso={recurso} color={CIAN} colores={COLORES_OPCION} bajar={false} onElegir={onElegir} />
            </div>
            <button style={boton('rgba(255,255,255,0.12)')} onClick={onSalir}>← Salir</button>
        </div>
    );
}

// ═══════════════════════════ CONFIGURACIÓN ═════════════════════════════════
function PantallaConfig({ recurso, hoja, nDisponibles, onEmpezar, onVolver, pilotos, setPilotos, mandos, setMandos, ctrl }) {
    const [nombres, setNombres] = useState(['', '']);
    const guardada = leerCfg();
    const [nPreguntas, setNPreguntas] = useState(guardada.nPreguntas || 6);
    const [arosEntre, setArosEntre] = useState(guardada.arosEntre || 2);
    const [invertir, setInvertir] = useState(!!guardada.invertir);
    const [vista, setVista] = useState(guardada.vista || 'exterior');
    const sinPreg = recurso.soloAros || nDisponibles === 0;
    const Op = ({ val, set, ops }) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ops.map(([v, t]) => <button key={String(v)} onClick={() => set(v)} style={{ padding: '9px 16px', borderRadius: 10, border: `2px solid ${val === v ? CIAN : 'rgba(255,255,255,0.18)'}`, background: val === v ? 'rgba(41,182,246,0.25)' : 'rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{t}</button>)}
        </div>
    );
    const h4 = { margin: '18px 0 8px', color: CIAN, fontSize: '0.85rem', letterSpacing: 1, textTransform: 'uppercase' };
    const empezar = () => {
        const cfg = { nPreguntas: sinPreg ? 0 : Math.min(nPreguntas, nDisponibles), arosEntre: sinPreg ? 3 : arosEntre, invertir, vista, pilotos, nombres: nombres.slice(0, pilotos).map((x, j) => x.trim() || (pilotos > 1 ? `Piloto ${j + 1}` : 'Tú')) };
        try { localStorage.setItem(LS_CFG, JSON.stringify({ nPreguntas, arosEntre, invertir, vista })); } catch { /* */ }
        onEmpezar(cfg);
    };
    return (
        <div style={{ ...fondo, padding: '24px 16px' }}>
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
                <button onClick={onVolver} style={{ ...boton('rgba(255,255,255,0.12)'), padding: '8px 14px', fontSize: '0.85rem' }}>← Preguntas</button>
                <h1 style={{ ...titulo, marginTop: 14 }}>Prepara el vuelo</h1>
                <p style={{ color: '#cfe3f7', margin: 0 }}>{recurso.titulo}{textoHojas(hoja) !== 'General' ? ` · ${textoHojas(hoja)}` : ''}{!sinPreg ? ` · ${nDisponibles} preguntas de elegir` : ''}</p>
                {!recurso.soloAros && nDisponibles === 0 && <div style={{ marginTop: 10, color: '#ffe082' }}>⚠️ Este recurso no tiene preguntas de elegir entre opciones: volarás solo por los aros.</div>}
                <div style={h4}>Pilotos</div>
                <Op val={pilotos} set={setPilotos} ops={[[1, '👤 1 piloto'], [2, '👥 2 pilotos (pantalla partida)']]} />
                {pilotos > 1 && (<>
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        {[0, 1].map(j => <input key={j} value={nombres[j]} maxLength={16} onChange={ev => setNombres(x => { const c = [...x]; c[j] = ev.target.value; return c; })} placeholder={`Nombre del piloto ${j + 1}`}
                            style={{ flex: 1, minWidth: 150, padding: '10px 12px', borderRadius: 10, border: `2px solid ${COLORES_PILOTO[j]}`, background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.95rem' }} />)}
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
                        {[[COLORES_PILOTO[0], 'Piloto 1 (izquierda / arriba)', 'W S morro · A D girar · Q más potencia · E menos · Espacio frena'], [COLORES_PILOTO[1], 'Piloto 2 (derecha / abajo)', '↑ ↓ morro · ← → girar · + más potencia · − menos (o RePág / AvPág) · Enter frena']].map(([c, t, d]) => (
                            <div key={t} style={{ background: 'rgba(255,255,255,0.07)', borderLeft: `5px solid ${c}`, borderRadius: 12, padding: '9px 13px', color: '#e3f2fd', fontSize: '0.86rem', lineHeight: 1.5 }}><b style={{ color: 'white' }}>{t}</b><br />{d}</div>
                        ))}
                        <div style={{ gridColumn: '1 / -1', color: '#cfe3f7', fontSize: '0.84rem' }}>🕹️ En una pantalla táctil cada piloto tiene sus botones en su mitad. Cada uno pasa sus propias puertas de pregunta. Cuando uno aterriza, el otro tiene 90 s para terminar. Gana quien tenga más puntos.</div>
                    </div>
                </>)}
                <div style={h4}>Mandos micro:bit</div>
                <Op val={!!mandos.activos} set={(v) => setMandos({ ...mandos, activos: v })} ops={[[false, 'No'], [true, '🎮 Sí: inclinar para pilotar · A / B potencia']]} />
                {mandos.activos && (
                    <div style={{ marginTop: 10, border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.07)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <ChipAntena />
                            <BotonTutorialMandos inicial="ovni" texto="📖 Cómo se usa el mando" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', padding: '7px 12px' }} />
                        </div>
                        <div style={{ fontSize: '0.86rem', color: '#e3f2fd', lineHeight: 1.55 }}>
                            Los mismos mandos de los juegos (modo volante, como en el Ovni). <b>Inclina</b> el mando a los lados para girar; <b>hacia delante</b> baja el morro y <b>hacia ti</b> lo sube. Mantén <b>A</b> para dar más potencia y <b>B</b> para quitarla; el <b>logo</b> frena en la pista. Las preguntas se responden volando por el aro, como siempre.
                            {ctrl.version > 0 && !ctrl.continuo && <div style={{ color: '#fde68a', marginTop: 6 }}>💡 Esta antena tiene un programa antiguo: el avión se moverá a golpes. Regraba antena y mandos (v6 o más) en Programación y robótica → 🎮 Mandos micro:bit.</div>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {Array.from({ length: pilotos }, (_, j) => (
                                <label key={j} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', color: pilotos > 1 ? COLORES_PILOTO[j] : 'white', fontWeight: 700 }}>
                                    {pilotos > 1 ? `✈️ ${nombres[j]?.trim() || `Piloto ${j + 1}`}:` : '✈️ Pilota:'}
                                    <ElegirPiloto ctrl={ctrl} i={j} color={pilotos > 1 ? COLORES_PILOTO[j] : undefined} />
                                </label>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#b0c4de' }}>«Automático» = lo coge el primer mando que se mueva. En pleno vuelo se puede pasar el mando a otro alumno (▾ o ⏭).</div>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: '#e3f2fd', cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!mandos.invertirGiro} onChange={ev => setMandos({ ...mandos, invertirGiro: ev.target.checked })} /> ⇄ Invertir el giro (si al inclinar a la derecha gira a la izquierda)
                        </label>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: '#e3f2fd', cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!mandos.invertirMorro} onChange={ev => setMandos({ ...mandos, invertirMorro: ev.target.checked })} /> ↕ Invertir delante / detrás (si al inclinarlo hacia delante el morro sube)
                        </label>
                    </div>
                )}
                {!sinPreg && (<>
                    <div style={h4}>Puertas de pregunta</div>
                    <Op val={nPreguntas} set={setNPreguntas} ops={[[4, '4 (vuelo corto)'], [6, '6'], [8, '8'], [10, '10 (vuelo largo)']]} />
                    <div style={h4}>Aros entre preguntas</div>
                    <Op val={arosEntre} set={setArosEntre} ops={[[1, '1'], [2, '2'], [3, '3']]} />
                </>)}
                <div style={h4}>Mandos</div>
                <Op val={invertir} set={setInvertir} ops={[[false, '⬆️ sube el morro (más fácil)'], [true, '⬆️ baja el morro (como un avión de verdad)']]} />
                <div style={h4}>Vista inicial</div>
                <Op val={vista} set={setVista} ops={[['exterior', '🎥 Por detrás'], ['cabina', '🧑‍✈️ Desde la cabina']]} />
                <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px', color: '#e3f2fd', fontSize: '0.9rem', lineHeight: 1.75 }}>
                    <b>W</b> / <b>S</b> más o menos potencia · <b>⬆️ ⬇️</b> subir y bajar el morro · <b>⬅️ ➡️</b> inclinarse para girar · <b>Espacio</b> frenar · <b>C</b> cambiar de cámara<br />
                    🛫 <b>Despegue:</b> sube la potencia con W y, a más de 110 km/h, levanta el morro.<br />
                    🎯 <b>Preguntas:</b> al acercarte verás la pregunta arriba; pasa por el aro (A, B, C o D) de la respuesta correcta. ✅ = turbo · ❌ = +5 s.<br />
                    🛬 <b>Aterrizaje:</b> al acabar los aros, alinéate con la pista, baja la potencia y desciende despacio. Toca la pista suave y frena.<br />
                    📱 En el móvil o la pantalla táctil: botones ▲ SUBIR / ▼ BAJAR y ◀ ▶ a la izquierda; palanca de POTENCIA y FRENO a la derecha. También funciona con mando.
                </div>
                <div style={{ textAlign: 'center', marginTop: 22 }}>
                    <button style={{ ...boton(`linear-gradient(135deg,${NARANJA},#f4511e)`), fontSize: '1.2rem', padding: '16px 40px' }} onClick={empezar}>🛫 ¡A LA PISTA!</button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════ CELEBRACIÓN ═══════════════════════════════════
// Petardo de fuegos artificiales: golpe grave + chisporroteo (ruido filtrado), con WebAudio.
let ctxAudio = null;
function petardo(volumen = 1) {
    if (!sonidoActivo()) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctxAudio = ctxAudio || new AC(); ctxAudio.resume?.();
        const c = ctxAudio, t = c.currentTime;
        const golpe = c.createOscillator(), gG = c.createGain();
        golpe.type = 'sine'; golpe.frequency.setValueAtTime(140 + Math.random() * 40, t); golpe.frequency.exponentialRampToValueAtTime(40, t + 0.25);
        gG.gain.setValueAtTime(0.35 * volumen, t); gG.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        golpe.connect(gG); gG.connect(c.destination); golpe.start(t); golpe.stop(t + 0.32);
        const dur = 0.55, buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) { const x = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 2.2) * (Math.random() < 0.18 ? 1 : 0.35); }
        const src = c.createBufferSource(), fil = c.createBiquadFilter(), gR = c.createGain();
        src.buffer = buf; fil.type = 'highpass'; fil.frequency.value = 1600; gR.gain.value = 0.22 * volumen;
        src.connect(fil); fil.connect(gR); gR.connect(c.destination); src.start(t + 0.03);
    } catch { /* sin audio */ }
}
/** Paso por un aro: «fiu» de aire + campanitas que suben (más alegres cuantos más aros seguidos). */
function sonidoAro(racha = 0) {
    if (!sonidoActivo()) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctxAudio = ctxAudio || new AC(); ctxAudio.resume?.();
        const c = ctxAudio, t = c.currentTime;
        // fiu: ruido con un filtro que barre hacia arriba
        const dur = 0.45, buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) { const x = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * x); }
        const src = c.createBufferSource(), fil = c.createBiquadFilter(), gR = c.createGain();
        src.buffer = buf; fil.type = 'bandpass'; fil.Q.value = 3; fil.frequency.setValueAtTime(500, t); fil.frequency.exponentialRampToValueAtTime(3500, t + dur);
        gR.gain.value = 0.28; src.connect(fil); fil.connect(gR); gR.connect(c.destination); src.start(t);
        // campanitas: arpegio mayor que sube medio tono por cada aro seguido (máx. 6)
        const base = 659 * Math.pow(2, Math.min(racha, 6) / 12);
        [1, 1.26, 1.5, 2].forEach((m, i) => {
            const o = c.createOscillator(), g = c.createGain(), ti = t + 0.08 + i * 0.07;
            o.type = 'triangle'; o.frequency.value = base * m;
            g.gain.setValueAtTime(0.0001, ti); g.gain.exponentialRampToValueAtTime(0.16, ti + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.35);
            o.connect(g); g.connect(c.destination); o.start(ti); o.stop(ti + 0.4);
        });
    } catch { /* sin audio */ }
}
/** Confeti en ráfagas por toda la pantalla, como en los otros juegos de PiKT. */
function confetiAcierto() {
    const colores = ['#ff1744', '#ffd600', '#00e5ff', '#76ff03', '#ff4081', '#ffffff', '#ff9100'];
    [0, 250, 520].forEach((ms, i) => setTimeout(() => {
        try {
            confetti({ particleCount: 70, spread: 75 + i * 10, startVelocity: 42, origin: { x: 0.2 + Math.random() * 0.6, y: 0.35 + Math.random() * 0.15 }, colors: colores, zIndex: 9000, scalar: 1.1 });
        } catch { /* */ }
    }, ms));
    setTimeout(() => { try { confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: colores, zIndex: 9000 }); confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: colores, zIndex: 9000 }); } catch { /* */ } }, 200);
}

// ═══════════════════════════ VUELO ═════════════════════════════════════════
const esTactil = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

/**
 * Cruceta translúcida: ▲ sube el morro, ▼ lo baja, ◀ ▶ inclinan para girar. Cada botón sigue a su
 * dedo, así que se pueden pulsar dos a la vez (p. ej. ▲ y ▶) con dos dedos.
 */
function Cruceta({ onCambio, tam = 68 }) {
    const pulsados = useRef({ arriba: 0, abajo: 0, izq: 0, der: 0 });
    const [vis, setVis] = useState({});
    const aplicar = () => { const p = pulsados.current; onCambio({ cabeceo: p.arriba - p.abajo, alabeo: p.der - p.izq }); setVis({ ...p }); };
    const boton = (clave, txt, pos) => {
        const fin = () => { pulsados.current[clave] = 0; aplicar(); };
        return (
            <button key={clave} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); pulsados.current[clave] = 1; aplicar(); }}
                onPointerUp={fin} onPointerCancel={fin} onLostPointerCapture={fin}
                style={{ position: 'absolute', ...pos, width: tam, height: tam, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.45)', background: vis[clave] ? 'rgba(41,182,246,0.55)' : 'rgba(8,20,40,0.28)', color: 'white', fontSize: tam * 0.36, fontWeight: 900, touchAction: 'none', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
                {txt}
            </button>
        );
    };
    const L = tam * 3 + 8;
    return (
        <div style={{ position: 'absolute', left: 12, bottom: 14, width: L, height: L, zIndex: 8, touchAction: 'none' }}>
            {boton('arriba', <><span>▲</span><span style={{ fontSize: tam * 0.15 }}>SUBIR</span></>, { left: tam + 4, top: 0 })}
            {boton('abajo', <><span style={{ fontSize: tam * 0.15 }}>BAJAR</span><span>▼</span></>, { left: tam + 4, bottom: 0 })}
            {boton('izq', '◀', { left: 0, top: tam + 4 })}
            {boton('der', '▶', { right: 0, top: tam + 4 })}
        </div>
    );
}

/** Palanca de potencia vertical (arrastrar). */
function Palanca({ valor, onCambio, estilo, alto = 200 }) {
    const ref = useRef(null), dedo = useRef(null);
    const mover = (e) => { const r = ref.current.getBoundingClientRect(); onCambio(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))); };
    const fin = (e) => { if (dedo.current === e.pointerId) dedo.current = null; };
    return (
        <div ref={ref} onPointerDown={(e) => { e.preventDefault(); dedo.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); mover(e); }}
            onPointerMove={(e) => { if (dedo.current === e.pointerId) mover(e); }} onPointerUp={fin} onPointerCancel={fin}
            style={{ position: 'absolute', width: 58, height: alto, borderRadius: 16, background: 'rgba(8,20,40,0.3)', border: '2px solid rgba(255,255,255,0.4)', touchAction: 'none', zIndex: 8, backdropFilter: 'blur(2px)', ...estilo }}>
            <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: `calc(${valor * 100}% - 12px)`, minHeight: 4, borderRadius: 10, background: 'linear-gradient(0deg,#ff9800cc,#ffeb3bcc)' }} />
            <div style={{ position: 'absolute', top: -20, left: -6, right: -6, textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: 'white', textShadow: '0 1px 3px #000' }}>POTENCIA</div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '45%', textAlign: 'center', fontSize: '0.8rem', fontWeight: 900, color: 'white', textShadow: '0 1px 3px #000', pointerEvents: 'none' }}>{Math.round(valor * 100)}%</div>
        </div>
    );
}

/** Horizonte artificial pequeño. */
function Horizonte({ cabeceo, alabeo }) {
    return (
        <div style={{ width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '3px solid rgba(255,255,255,0.6)', background: '#0b1b2b' }}>
            <div style={{ position: 'absolute', left: -40, right: -40, top: -40, bottom: -40, transform: `rotate(${-alabeo * 57.3}deg) translateY(${cabeceo * 70}px)`, background: 'linear-gradient(#4fa3e0 50%, #8d6e3f 50%)' }} />
            <div style={{ position: 'absolute', left: 18, right: 18, top: 40, height: 3, background: '#ffd600' }} />
            <div style={{ position: 'absolute', left: 39, top: 36, width: 6, height: 6, borderRadius: '50%', background: '#ffd600' }} />
        </div>
    );
}

/** Zona de pantalla de cada piloto (igual que las vistas del motor): a dos, lado a lado o arriba/abajo. */
function zonaDe(n, j, vertical) {
    if (n === 1) return { left: 0, top: 0, right: 0, bottom: 0 };
    return vertical ? (j === 0 ? { left: 0, top: 0, bottom: 0, width: '50%' } : { right: 0, top: 0, bottom: 0, width: '50%' })
        : (j === 0 ? { left: 0, right: 0, top: 0, height: '50%' } : { left: 0, right: 0, bottom: 0, height: '50%' });
}
const COLORES_PILOTO = ['#1565c0', '#e91e63'];

function Vuelo({ config, preguntas, onFin, onSalir, mandos }) {
    const n = config.pilotos || 1, dos = n > 1;
    const contRef = useRef(null), mmRef = useRef(null), motorRef = useRef(null);
    const [est, setEst] = useState(null);
    const [avisos, setAvisos] = useState([[], []]);
    const [tactil, setTactil] = useState(esTactil());
    const [potencia, setPotencia] = useState([0, 0]);
    const [sonido, setSonido] = useState(true);
    const sonidoRef = useRef(true); sonidoRef.current = sonido;
    const rachaRef = useRef([0, 0]); // aros seguidos sin fallar: la campanita sube de tono
    const [tam, setTam] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => { const f = () => setTam({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
    useEffect(() => {
        const ponerAviso = (j, texto) => {
            const id = Math.random();
            setAvisos(l => { const c = [...l]; c[j] = [...(c[j] || []).slice(-1), { id, texto }]; return c; });
            setTimeout(() => setAvisos(l => { const c = [...l]; c[j] = (c[j] || []).filter(a => a.id !== id); return c; }), 3200);
        };
        const m = crearVuelo(contRef.current, { preguntas, nPreguntas: config.nPreguntas, arosEntre: config.arosEntre, invertir: config.invertir, pilotos: n, nombres: config.nombres, minimapa: mmRef.current }, {
            onEstado: setEst,
            onAviso: ({ jugador = 0, texto }) => ponerAviso(jugador, texto),
            onRespuesta: ({ ok }) => {
                if (ok) confetiAcierto();
                if (!sonidoRef.current) return;
                if (ok) sonidoCorrecto('FANFARRIA'); else sonidoIncorrecto();
            },
            onEstallido: () => { if (sonidoRef.current) petardo(0.7 + Math.random() * 0.5); },
            onAro: ({ jugador = 0, dentro }) => {
                const r = rachaRef.current; r[jugador] = dentro ? r[jugador] + 1 : 0;
                if (dentro && sonidoRef.current) sonidoAro(r[jugador] - 1);
            },
            onFin: (r) => { sonidoFinal(); onFin(r); },
        });
        motorRef.current = m;
        if (config.vista === 'cabina') for (let j = 0; j < n; j++) m.alternarCamara(j);
        return () => { m.destruir(); motorRef.current = null; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const m = () => motorRef.current;
    const estRef = useRef(null); estRef.current = est;
    // al pasar a los mandos táctiles, la palanca empieza con la potencia que llevaba cada avión
    useEffect(() => {
        if (tactil) setPotencia((estRef.current?.pilotos || []).map(p => p.motor / 100).concat([0, 0]).slice(0, 2));
        else for (let j = 0; j < n; j++) m()?.setEntradaTactil({ motor: null }, j);
    }, [tactil]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (tactil) for (let j = 0; j < n; j++) m()?.setEntradaTactil({ motor: potencia[j] }, j); }, [potencia, tactil]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Mandos micro:bit (modo volante, como en el Ovni y las carreras) ──
    // inclinar a los lados = girar · hacia delante = bajar el morro, hacia atrás = subirlo
    // mantener A = más potencia · mantener B = menos · logo = frenar
    const conMandos = !!mandos?.activos && !!mandos.ctrl;
    const ctrl = mandos?.ctrl;
    const estMando = useRef([0, 1].map(() => ({ cabeceo: 0, alabeo: 0, motor: 0, freno: 0, a: 0, b: 0, tGiro: 0, tA: 0, tB: 0, tL: 0 })));
    useEffect(() => {
        if (!conMandos) return undefined;
        const invG = !!mandos.invertirGiro, invM = !!mandos.invertirMorro;
        const enviar = (idx) => { const s = estMando.current[idx]; s.motor = s.a - s.b; m()?.setEntradaMando({ cabeceo: s.cabeceo, alabeo: s.alabeo, motor: s.motor, freno: s.freno }, idx); };
        ctrl.manejadorRef.current = (idx, ev) => {
            if (idx >= n || ev.tipo !== 'futbol') return;
            const s = estMando.current[idx], ahora = Date.now();
            if (ev.accion === 'V' || ev.accion === 'P') {
                const d = ev.dir || '';
                const magX = ev.x != null ? Math.min(1, Math.abs(ev.x) / 70) : 1, magY = ev.y != null ? Math.min(1, Math.abs(ev.y) / 70) : 1;
                s.alabeo = (d.includes('I') ? -magX : d.includes('D') ? magX : 0) * (invG ? -1 : 1);
                s.cabeceo = (d.includes('F') ? -magY : d.includes('T') ? magY : 0) * (invM ? -1 : 1);
                s.tGiro = ahora;
            } else if (ev.accion === 'A') { s.a = ev.on ? 1 : 0; s.tA = ahora; }
            else if (ev.accion === 'B') { s.b = ev.on ? 1 : 0; s.tB = ahora; }
            else if (ev.accion === 'L') { s.freno = ev.on ? 1 : 0; s.tL = ahora; }
            m()?.despertarAudio();
            enviar(idx);
        };
        // sin latido: botones soltados (1,3 s) e inclinación plana (1,2 s)
        const t = setInterval(() => {
            const ahora = Date.now();
            estMando.current.forEach((s, idx) => {
                let c = false;
                if ((s.cabeceo || s.alabeo) && ahora - s.tGiro > 1200) { s.cabeceo = 0; s.alabeo = 0; c = true; }
                if (s.a && ahora - s.tA > 1300) { s.a = 0; c = true; }
                if (s.b && ahora - s.tB > 1300) { s.b = 0; c = true; }
                if (s.freno && ahora - s.tL > 1300) { s.freno = 0; c = true; }
                if (c && idx < n) enviar(idx);
            });
        }, 200);
        return () => { clearInterval(t); ctrl.manejadorRef.current = null; };
    }, [conMandos, mandos?.invertirGiro, mandos?.invertirMorro]); // eslint-disable-line react-hooks/exhaustive-deps
    // al cambiar de piloto, ese avión suelta los mandos
    const pilotosClave = conMandos ? ctrl.pilotos.slice(0, n).join(',') : '';
    useEffect(() => {
        if (!conMandos) return;
        estMando.current.forEach((s, idx) => { Object.assign(s, { cabeceo: 0, alabeo: 0, motor: 0, freno: 0, a: 0, b: 0 }); if (idx < n) m()?.setEntradaMando({ cabeceo: 0, alabeo: 0, motor: 0, freno: 0 }, idx); });
    }, [pilotosClave]); // eslint-disable-line react-hooks/exhaustive-deps

    const vertical = tam.w >= tam.h; // a dos: lado a lado si la pantalla es apaisada
    const zonaW = !dos ? tam.w : vertical ? tam.w / 2 : tam.w, zonaH = !dos ? tam.h : vertical ? tam.h : tam.h / 2;
    // móvil, pantalla táctil o pantalla partida: interfaz reducida
    const compacto = dos || tactil || tam.w < 760;
    const caja = { background: 'rgba(6,18,36,0.62)', borderRadius: 14, padding: '6px 12px', color: 'white', backdropFilter: 'blur(4px)' };
    const btn = { ...caja, border: 'none', cursor: 'pointer', fontWeight: 700, padding: compacto ? '6px 9px' : '7px 11px', fontSize: compacto ? '0.82rem' : '0.9rem' };
    const ests = est?.pilotos || [];
    const despierta = () => m()?.despertarAudio();
    const ladoDer = (j) => dos && vertical && j === 1; // tarjeta del piloto 2 a la derecha (lado de fuera)
    const topPanel = dos && vertical ? 132 : compacto ? 58 : 70; // a dos, debajo del minimapa central
    const tamCruceta = Math.round(Math.max(48, Math.min(78, Math.min(zonaW, zonaH) * 0.15)));
    const altoPalanca = Math.round(Math.max(110, Math.min(200, zonaH * 0.42)));

    // HUD de un piloto (en su zona)
    const Hud = ({ j }) => {
        const e = ests[j]; if (!e) return null;
        const preg = e.pregunta, color = COLORES_PILOTO[j];
        return (<>
            {/* tarjeta de progreso */}
            {compacto ? (
                <div style={{ position: 'absolute', top: 8, ...(ladoDer(j) ? { right: 8 } : { left: 8 }), zIndex: 5, pointerEvents: 'none', ...caja, padding: '5px 10px', fontSize: '0.8rem', lineHeight: 1.45, fontVariantNumeric: 'tabular-nums', maxWidth: dos ? (vertical ? 'calc(100% - 100px)' : 'calc(100% - 16px)') : 'calc(100% - 130px)', borderLeft: dos ? `5px solid ${color}` : 'none' }}>
                    <div>{dos ? <b>{e.nombre} · </b> : null}⏱ {e.tiempo} · ⭕ {Math.min(e.hechas, e.totalPuertas)}/{e.totalPuertas}{config.nPreguntas > 0 ? <> · <span style={{ color: '#69f0ae' }}>✔{e.aciertos}</span> <span style={{ color: '#ff8a80' }}>✘{e.fallos}</span></> : null} · <span style={{ color: '#ffd54f' }}>⭐{e.puntos}</span></div>
                    <div style={{ fontWeight: 800 }}><span style={{ color: e.turbo ? '#40c4ff' : 'white' }}>{e.kmh} km/h{e.turbo ? ' 🚀' : ''}</span> · {e.altitud} m · ⚡{e.motor}%</div>
                </div>
            ) : (
                <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, flexWrap: 'wrap', zIndex: 5, pointerEvents: 'none', maxWidth: '55%' }}>
                    <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>TIEMPO</div><div style={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e.tiempo}</div></div>
                    <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>RECORRIDO</div><div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{Math.min(e.hechas, e.totalPuertas)}/{e.totalPuertas}</div></div>
                    {config.nPreguntas > 0 && <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>PREGUNTAS</div><div style={{ fontSize: '1.15rem', fontWeight: 800 }}><span style={{ color: '#69f0ae' }}>✔ {e.aciertos}</span> <span style={{ color: '#ff8a80' }}>✘ {e.fallos}</span></div></div>}
                    <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>PUNTOS</div><div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffd54f' }}>{e.puntos}</div></div>
                </div>
            )}
            {/* pregunta */}
            {preg && (
                <div style={{ position: 'absolute', top: topPanel, left: '50%', transform: 'translateX(-50%)', width: compacto ? 'calc(100% - 24px)' : 'min(720px, 94vw)', maxWidth: 620, zIndex: 6, ...caja, padding: compacto ? '7px 10px' : '10px 14px', border: `2px solid ${dos ? color : '#ffd54f'}`, pointerEvents: 'none', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#ffd54f', fontWeight: 800 }}><span>❓ {compacto ? 'PASA POR EL ARO CORRECTO' : 'PASA POR EL ARO DE LA RESPUESTA CORRECTA'}</span><span>{preg.dist} m</span></div>
                    <div style={{ fontSize: compacto ? '0.92rem' : 'clamp(1rem,2.2vw,1.25rem)', fontWeight: 800, margin: '4px 0 6px', lineHeight: 1.25 }}>{preg.enunciado}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: preg.opciones.some(o => String(o).length > 24) ? '1fr' : '1fr 1fr', gap: 5 }}>
                        {preg.opciones.map((o, i) => <div key={i} style={{ background: COLORES_OPCION[i], borderRadius: 9, padding: compacto ? '3px 8px' : '6px 10px', fontWeight: 800, fontSize: compacto ? '0.82rem' : '0.95rem', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{LETRAS[i]} · {o}</div>)}
                    </div>
                </div>
            )}
            {/* avisos */}
            <div style={{ position: 'absolute', top: preg ? '58%' : '32%', left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', pointerEvents: 'none', width: '86%' }}>
                {(avisos[j] || []).map(a => <div key={a.id} style={{ ...caja, fontSize: compacto ? '0.92rem' : 'clamp(1rem,2.4vw,1.4rem)', fontWeight: 900, textAlign: 'center', padding: '6px 14px' }}>{a.texto}</div>)}
                {e.perdida && <div style={{ ...caja, background: 'rgba(183,28,28,0.9)', fontWeight: 900, fontSize: compacto ? '0.92rem' : '1.2rem' }}>⚠️ ¡PÉRDIDA! Más potencia y baja el morro</div>}
                {e.fase === 'despegue' && e.suelo && <div style={{ ...caja, fontWeight: 700, fontSize: compacto ? '0.86rem' : '1rem', textAlign: 'center' }}>{e.kmh < 20 ? (tactil ? 'Sube la POTENCIA para rodar' : conMandos ? 'Mantén A para dar potencia' : dos ? (j === 0 ? 'Potencia: Q (más) · E (menos)' : 'Potencia: + (más) · − (menos)') : 'Sube la potencia (W) para rodar') : e.kmh < 110 ? `Acelerando… ${e.kmh} km/h` : (tactil ? '¡Pulsa ▲ SUBIR!' : conMandos ? '¡Inclina el mando hacia ti!' : '¡Levanta el morro!')}</div>}
                {e.cierre != null && !e.terminado && <div style={{ ...caja, fontWeight: 800, color: '#ffd54f', fontSize: '0.9rem' }}>⏱ Quedan {e.cierre} s</div>}
            </div>
            {/* instrumentos (solo en pantallas grandes, un piloto) */}
            {!compacto && (
                <div style={{ position: 'absolute', left: 10, bottom: 12, display: 'flex', gap: 8, alignItems: 'flex-end', zIndex: 5, pointerEvents: 'none' }}>
                    <Horizonte cabeceo={e.cabeceo} alabeo={e.alabeo} />
                    <div style={{ ...caja, textAlign: 'center', minWidth: 74 }}><div style={{ fontSize: '1.7rem', fontWeight: 900, lineHeight: 1, color: e.turbo ? '#40c4ff' : 'white' }}>{e.kmh}</div><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>km/h{e.turbo ? ' 🚀' : ''}</div></div>
                    <div style={{ ...caja, textAlign: 'center', minWidth: 74 }}><div style={{ fontSize: '1.7rem', fontWeight: 900, lineHeight: 1 }}>{e.altitud}</div><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>m de altura</div></div>
                    <div style={{ ...caja, textAlign: 'center' }}>
                        <div style={{ width: 14, height: 54, background: '#1d2b3a', borderRadius: 7, position: 'relative', margin: '0 auto', overflow: 'hidden' }}><div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${e.motor}%`, background: 'linear-gradient(0deg,#ff9800,#ffeb3b)' }} /></div>
                        <div style={{ fontSize: '0.65rem', color: '#9ec9ee' }}>{e.motor}%</div>
                    </div>
                    {e.dist != null && !e.suelo && (
                        <div style={{ ...caja, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', transform: `rotate(${-e.rumbo * 57.3}deg)`, transition: 'transform 0.15s' }}>⬆️</div>
                            <div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>{e.dist >= 1000 ? `${(e.dist / 1000).toFixed(1)} km` : `${e.dist} m`}</div>
                        </div>
                    )}
                </div>
            )}
            {/* ayuda de aterrizaje */}
            {e.alineado && e.alineado.distPista > -200 && !e.terminado && (
                <div style={{ position: 'absolute', ...(compacto ? { top: topPanel } : { bottom: 110 }), left: '50%', transform: 'translateX(-50%)', zIndex: 6, ...caja, textAlign: 'center', fontSize: compacto ? '0.78rem' : '0.9rem', lineHeight: 1.45, pointerEvents: 'none', width: 'max-content', maxWidth: '92%' }}>
                    <b>🛬 Pista a {Math.max(0, e.alineado.distPista)} m</b>{e.tAterrizar != null ? <span style={{ color: e.tAterrizar <= 20 ? '#ff8a80' : '#9ec9ee' }}> · ⏱ {e.tAterrizar} s</span> : null}<br />
                    {Math.abs(e.alineado.lat) < 8 ? '✅ Alineado' : e.alineado.lat > 0 ? '⬅️ Corrige a la izquierda' : 'Corrige a la derecha ➡️'} · {Math.max(0, e.alineado.alturaPista)} m · bajas <b style={{ color: e.vs < -5 ? '#ff5252' : e.vs < -2.5 ? '#ffd54f' : '#69f0ae' }}>{Math.abs(e.vs).toFixed(1)} m/s</b>
                </div>
            )}
            {e.terminado && dos && <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', fontSize: '1.6rem', fontWeight: 900, color: '#ffd600', textShadow: '0 4px 20px #000', pointerEvents: 'none', zIndex: 6 }}>🏁 ¡Terminado! ⭐{e.puntos}</div>}
        </>);
    };

    return (
        <div onPointerDown={(ev) => { if ((ev.pointerType === 'touch' || ev.pointerType === 'pen') && !tactil) setTactil(true); }} onContextMenu={(ev) => ev.preventDefault()}
            style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none', fontFamily: FUENTE }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />
            {Array.from({ length: n }, (_, j) => <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), pointerEvents: 'none' }}><Hud j={j} /></div>)}
            {dos && <div style={{ position: 'absolute', zIndex: 4, background: '#000', ...(vertical ? { left: 'calc(50% - 2px)', width: 4, top: 0, bottom: 0 } : { top: 'calc(50% - 2px)', height: 4, left: 0, right: 0 }) }} />}
            {/* minimapa y botones: arriba a la derecha (a dos, en el centro) */}
            <div style={{ position: 'absolute', ...(dos ? (vertical ? { top: 6, left: '50%', transform: 'translateX(-50%)' } : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }) : { top: 8, right: 8 }), display: 'flex', flexDirection: 'column', alignItems: dos ? 'center' : 'flex-end', gap: 6, zIndex: 9 }}>
                <canvas ref={mmRef} width={170} height={170} style={{ width: compacto ? (dos ? 80 : 92) : 'min(150px,26vw)', height: compacto ? (dos ? 80 : 92) : 'min(150px,26vw)', pointerEvents: 'none', opacity: 0.9, display: dos && !vertical ? 'none' : 'block' }} />
                <div style={{ display: 'flex', gap: 5 }}>
                    <button style={btn} title="Salir" onClick={() => { m()?.pausar(true); onSalir(); }}>✕</button>
                    <button style={btn} title="Cámara (C)" onClick={() => { for (let j = 0; j < n; j++) m()?.alternarCamara(j); }}>🎥</button>
                    <button style={btn} title="Sonido" onClick={() => { m()?.setSonido(!sonido); setSonido(!sonido); }}>{sonido ? '🔊' : '🔇'}</button>
                    <button style={{ ...btn, background: tactil ? '#0277bd' : caja.background }} title="Mandos en pantalla" onClick={() => setTactil(t => !t)}>🕹️</button>
                </div>
                {ests.some(e => e.fase === 'aterrizar' && !e.terminado) && <button style={{ ...btn, background: 'rgba(120,40,0,0.85)', fontSize: '0.78rem' }} onClick={() => m()?.rendirse()}>🏁 Terminar</button>}
            </div>
            {/* quién pilota con micro:bit (se puede cambiar en pleno vuelo) */}
            {conMandos && Array.from({ length: n }, (_, j) => (
                <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), pointerEvents: 'none', zIndex: 10 }}>
                    <div style={{ position: 'absolute', top: compacto ? 56 : 72, ...(ladoDer(j) ? { right: 8 } : { left: 8 }) }}><PilotoEnJuego ctrl={ctrl} i={j} color={COLORES_PILOTO[j]} /></div>
                </div>
            ))}
            {/* mandos táctiles de cada piloto: cruceta a la izquierda, potencia y freno a la derecha de su zona */}
            {tactil && Array.from({ length: n }, (_, j) => (
                <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), pointerEvents: 'none' }}>
                    <div style={{ pointerEvents: 'auto' }}>
                        <Cruceta tam={tamCruceta} onCambio={(o) => { despierta(); m()?.setEntradaTactil(o, j); }} />
                        <Palanca valor={potencia[j]} alto={altoPalanca} onCambio={(v) => { despierta(); setPotencia(p => { const c = [...p]; c[j] = v; return c; }); }} estilo={{ right: 14, bottom: 16 }} />
                        <button onPointerDown={(ev) => { ev.preventDefault(); ev.currentTarget.setPointerCapture?.(ev.pointerId); m()?.setEntradaTactil({ freno: 1 }, j); }} onPointerUp={() => m()?.setEntradaTactil({ freno: 0 }, j)} onPointerCancel={() => m()?.setEntradaTactil({ freno: 0 }, j)}
                            style={{ position: 'absolute', right: 84, bottom: 16, width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(183,28,28,0.45)', color: 'white', fontWeight: 900, fontSize: '0.66rem', touchAction: 'none', zIndex: 8 }}>FRENO</button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════ RESULTADOS ════════════════════════════════════
function ModalEnviarProfe({ resultado, recurso, hoja, onClose }) {
    const lista = resultado.pilotos?.length > 1 ? resultado.pilotos : [resultado];
    const dos = lista.length > 1;
    const [nombresA, setNombresA] = useState(() => lista.map(j => (/^(Tú|Piloto \d)$/.test(j.nombre || '') ? '' : j.nombre)));
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const enviar = async () => {
        for (const x of nombresA) { const v = validarNombre(x); if (!v.ok) { setError(v.mensaje); return; } }
        const code = codigo.trim().toUpperCase(); if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const jugadores = lista.map((r, i) => {
                const intentos = r.aciertos + r.fallos;
                return {
                    nombre: nombresA[i].trim(), curso: curso.trim(), aciertos: r.aciertos, intentos, porcentaje: intentos ? Math.round((r.aciertos / intentos) * 100) : 0,
                    tiempo: r.tiempo, tiempoFormateado: r.tiempoFormateado, puntos: r.puntos, aros: r.aros, arosTotal: r.arosTotal,
                    choques: r.choques, aterrizaje: r.aterrizaje || null, hoja: textoHojas(hoja),
                    preguntas: (r.preguntas || []).slice(0, 40).map(p => ({ enunciado: String(p.enunciado || '').slice(0, 200), dada: String(p.dada || ''), correcta: String(p.correcta || ''), ok: !!p.ok })),
                };
            });
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'AVIONES', modalidad: `${resultado.nPreguntas} preguntas${dos ? ' · 2 pilotos' : ` · aterrizaje ${resultado.aterrizaje || 'no'}`}`, fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo, hoja: textoHojas(hoja), codigoProfesor: code, jugadores,
            });
            jugadores.forEach(j => guardarRegistroLocal('AVIONES', { titulo: recurso.titulo, aciertos: j.aciertos, intentos: j.intentos, porcentaje: j.porcentaje, nombre: j.nombre, curso: j.curso, via: 'profesor' }));
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#0b1f3a', border: `1px solid ${CIAN}55`, borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: FUENTE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: CIAN }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}><div style={{ fontSize: '3rem' }}>✅</div><div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ ...boton('rgba(255,255,255,0.12)'), marginTop: 14 }}>Cerrar</button></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lista.map((r, i) => <input key={i} value={nombresA[i]} onChange={ev => { const v = ev.target.value; setNombresA(x => { const c = [...x]; c[i] = v; return c; }); }} placeholder={dos ? `Nombre y apellido · ${r.nombre}` : 'Nombre y apellido'} style={{ ...inp, borderColor: dos ? r.color : inp.border }} />)}
                        <input value={curso} onChange={ev => setCurso(ev.target.value)} placeholder="Curso (ej. 3º ESO A)" style={inp} />
                        <input value={codigo} onChange={ev => setCodigo(ev.target.value.toUpperCase())} placeholder="Código del profesor" style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                        {error && <div style={{ color: '#ff8a80', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <button onClick={enviar} disabled={enviando} style={boton(enviando ? '#555' : `linear-gradient(135deg,${CIAN},#0277bd)`)}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function PantallaResultados({ resultado, recurso, hoja, onRepetir, onSalir }) {
    const [modal, setModal] = useState(false);
    const dos = resultado.pilotos?.length > 1;
    useEffect(() => {
        (dos ? resultado.pilotos : [resultado]).forEach(r => {
            const intentos = r.aciertos + r.fallos;
            guardarRegistroLocal('AVIONES', { titulo: `${recurso.titulo}${dos ? ` · ${r.nombre}` : ''}`, aciertos: r.aciertos, intentos, porcentaje: intentos ? Math.round((r.aciertos / intentos) * 100) : 0, via: 'juego' });
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const fila = { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' };
    const caja = { background: 'rgba(255,255,255,0.08)', border: `1px solid ${CIAN}44`, borderRadius: 20, padding: '20px 24px', width: '100%', maxWidth: 520, marginBottom: 18, boxSizing: 'border-box' };
    const at = { perfecto: '🛬 Perfecto (+500)', bueno: '🛬 Bueno (+300)', duro: '🛬 Duro (+120)', 'sin aterrizar': '— Sin aterrizar' }[resultado.aterrizaje] || '—';
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            {dos ? (() => {
                const gana = resultado.pilotos.reduce((x, y) => (y.puntos > x.puntos ? y : x));
                const empate = resultado.pilotos[0].puntos === resultado.pilotos[1].puntos;
                return (<>
                    <div style={{ fontSize: '3rem' }}>🏆</div>
                    <h1 style={{ ...titulo, marginBottom: 16 }}>{empate ? '¡Empate!' : `¡Gana ${gana.nombre}!`}</h1>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, width: '100%', maxWidth: 640, marginBottom: 18 }}>
                        {resultado.pilotos.map((r, i) => (
                            <div key={i} style={{ ...caja, maxWidth: 'none', marginBottom: 0, borderTop: `6px solid ${r.color}` }}>
                                <div style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: 6 }}>{!empate && r === gana ? '🏆 ' : ''}{r.nombre}</div>
                                <div style={fila}><span>🏆 Puntos</span><b style={{ color: '#ffd54f' }}>{r.puntos}</b></div>
                                <div style={fila}><span>⏱ Tiempo</span><b>{r.tiempoFormateado}</b></div>
                                {resultado.nPreguntas > 0 && <div style={fila}><span>✅ / ❌</span><b>{r.aciertos} / {r.fallos}</b></div>}
                                <div style={fila}><span>⭕ Aros</span><b>{r.aros} / {r.arosTotal}</b></div>
                                <div style={fila}><span>💥 Choques</span><b>{r.choques}</b></div>
                                <div style={{ ...fila, borderBottom: 'none' }}><span>Aterrizaje</span><b>{({ perfecto: '🛬 Perfecto', bueno: '🛬 Bueno', duro: '🛬 Duro' })[r.aterrizaje] || '—'}</b></div>
                            </div>
                        ))}
                    </div>
                </>);
            })() : (<>
            <div style={{ fontSize: '3rem' }}>{resultado.aterrizaje === 'perfecto' ? '🏆' : '✈️'}</div>
            <h1 style={{ ...titulo, marginBottom: 16 }}>¡Vuelo completado!</h1>
            <div style={caja}>
                <div style={fila}><span>🏆 Puntos</span><b style={{ color: '#ffd54f' }}>{resultado.puntos}</b></div>
                <div style={fila}><span>⏱ Tiempo</span><b>{resultado.tiempoFormateado}</b></div>
                {resultado.penalizacion > 0 && <div style={{ ...fila, color: '#ff8a80' }}><span>➕ Penalización</span><b>+{resultado.penalizacion} s</b></div>}
                {resultado.nPreguntas > 0 && <div style={fila}><span>✅ Aciertos / ❌ fallos</span><b>{resultado.aciertos} / {resultado.fallos}</b></div>}
                <div style={fila}><span>⭕ Aros</span><b>{resultado.aros} / {resultado.arosTotal}</b></div>
                <div style={fila}><span>💥 Choques</span><b>{resultado.choques}</b></div>
                <div style={{ ...fila, borderBottom: 'none' }}><span>Aterrizaje</span><b>{at}</b></div>
            </div>
            </>)}
            {!dos && resultado.preguntas?.length > 0 && (
                <div style={caja}>
                    <h3 style={{ margin: '0 0 10px', color: CIAN }}>Preguntas</h3>
                    {resultado.preguntas.map((p, i) => (
                        <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem' }}>
                            <div>{p.ok ? '✅' : '❌'} {p.enunciado}</div>
                            {!p.ok && <div style={{ color: '#ffcc80', fontSize: '0.82rem' }}>{p.dada ? `Elegiste «${p.dada}» · ` : 'No pasaste por ningún aro · '}era «{p.correcta}»</div>}
                        </div>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {!recurso.soloAros && <button style={boton('linear-gradient(135deg,#7b2fff,#4a00e0)')} onClick={() => setModal(true)}>📤 Enviar al profesor</button>}
                <button style={boton('linear-gradient(135deg,#00b09b,#96c93d)')} onClick={onRepetir}>🔁 Volar otra vez</button>
                <button style={boton('rgba(255,255,255,0.12)')} onClick={onSalir}>🏠 Salir</button>
            </div>
            {modal && <ModalEnviarProfe resultado={resultado} recurso={recurso} hoja={hoja} onClose={() => setModal(false)} />}
        </div>
    );
}

// ═══════════════════════════ RAÍZ ══════════════════════════════════════════
/**
 * Pilota el avión.
 *  · recurso / hojaInicial: entra directamente con ese recurso (p. ej. desde GamePlayer).
 */
export default function AvionesGame3D(props) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 9990, overflowY: 'auto', background: '#0b2545' }}><AvionesGame3DInterno {...props} /></div>;
}
function AvionesGame3DInterno({ alTerminar, onExit, recurso: recursoProp = null, hojaInicial = 'General' }) {
    const varias = (recursoProp?.hojas?.length || 0) > 1;
    const [fase, setFase] = useState(recursoProp ? (varias && hojaInicial === 'General' ? 'HOJA' : 'CONFIG') : 'PREVIO');
    const [recurso, setRecurso] = useState(recursoProp);
    const [hoja, setHoja] = useState(hojaInicial);
    const [config, setConfig] = useState(null);
    const [preguntas, setPreguntas] = useState([]);
    const [resultado, setResultado] = useState(null);
    const [clave, setClave] = useState(0);
    const [pilotos, setPilotos] = useState(1);
    const [mandos, setMandosE] = useState(() => { try { return { activos: false, invertirGiro: false, invertirMorro: false, ...JSON.parse(localStorage.getItem('pikt_aviones_mandos') || '{}') }; } catch { return { activos: false }; } });
    const setMandos = (v) => { setMandosE(v); try { localStorage.setItem('pikt_aviones_mandos', JSON.stringify(v)); } catch { /* */ } };
    const ctrlMandos = useMandosOvni(!!mandos.activos, fase === 'VOLANDO' ? (config?.pilotos || 1) : pilotos);
    const salir = () => (alTerminar || onExit)?.();
    const disponibles = recurso ? preguntasPara(recurso, hoja).length : 0;
    if (fase === 'PREVIO') return <PantallaPrevia onSalir={salir} onIniciar={(r, h) => { setRecurso(r); setHoja(h); setFase('CONFIG'); }} />;
    if (fase === 'HOJA') return <PantallaHoja recurso={recurso} onSalir={salir} onElegir={(h) => { setHoja(h); setFase('CONFIG'); }} />;
    if (fase === 'CONFIG') return <PantallaConfig recurso={recurso} hoja={hoja} nDisponibles={disponibles} pilotos={pilotos} setPilotos={setPilotos} mandos={mandos} setMandos={setMandos} ctrl={ctrlMandos} onVolver={() => (recursoProp ? salir() : setFase('PREVIO'))}
        onEmpezar={(c) => { setConfig(c); setPreguntas(preguntasPara(recurso, hoja)); setClave(k => k + 1); setFase('VOLANDO'); }} />;
    if (fase === 'RESULTADO' && resultado) return <PantallaResultados resultado={resultado} recurso={recurso} hoja={hoja} onRepetir={() => setFase('CONFIG')} onSalir={salir} />;
    return <Vuelo key={clave} config={config} preguntas={preguntas} mandos={{ ...mandos, ctrl: ctrlMandos }} onSalir={() => setFase('CONFIG')} onFin={(r) => { setResultado(r); setFase('RESULTADO'); }} />;
}
