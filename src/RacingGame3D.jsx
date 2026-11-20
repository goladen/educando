import { validarNombre } from './utils/filtroNombres';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from './utils/sonidosFeedback';
import { categoriasDeRecurso, conOpcionesParaElegir, barajar, esRespuestaCorrecta } from './utils/normalizarPreguntas';
import { conRecursosPikt } from './bancoPreguntas/recursosPikt';
import { generarTest } from './conduccion/preguntasTest';
import { senalDataURL } from './conduccion/senales';
import { CIRCUITOS } from './carreras/circuitos';
import { crearCarrera } from './carreras/motorCarreras';
import HojasRecurso, { filtrarHojas, textoHojas } from './components/HojasRecurso';
import { useMandosOvni, ElegirPiloto, PilotoEnJuego } from './ovniMandos.jsx';
import ChipAntena from './mandos/ChipAntena.jsx';
import { BotonTutorialMandos } from './mandos/TutorialMandos.jsx';
import { dueloMando, finDuelosMandos } from './mandos/mandosMicrobit.js';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, getCountFromServer } from 'firebase/firestore';

// ─── Racing 3D (three.js) ────────────────────────────────────────────────────
// Carrera en coche o en moto contra 3-4 rivales con IA. En cada checkpoint se
// responde una pregunta del recurso elegido: acierto = turbo, fallo = +5 s.
const FUENTE = "'Segoe UI', system-ui, sans-serif";
const AZUL = '#00C6FF', MORADO = '#7B2FFF';
const RECURSO_VIAL = { id: 'vial', titulo: '🚦 Educación vial (test de conducir)', temas: 'Señales, prioridad, velocidad, seguridad', ciclo: 'ESO', esVial: true, hojas: [] };

const fondo = { minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a1a,#1a0a2e,#0a1a2e)', color: 'white', fontFamily: FUENTE };
const titulo = { fontSize: '2.1rem', fontWeight: 900, margin: '0 0 6px', background: `linear-gradient(90deg,${AZUL},${MORADO})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const botonGrad = (bg) => ({ padding: '13px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white', background: bg, fontFamily: FUENTE });

/** Preguntas de la carrera a partir del recurso y la hoja elegida. */
function preguntasPara(recurso, hoja, soloElegir = false) {
    if (recurso.esVial) {
        return generarTest({ n: 40, modo: 'examen' }).map(p => ({ tipo: 'MULTIPLE', enunciado: p.pregunta, opciones: p.opciones, correcta: p.opciones[p.correcta], senal: p.senal, explicacion: p.explicacion }));
    }
    const cats = categoriasDeRecurso(recurso);
    const lista = filtrarHojas(cats, hoja).flatMap(c => c.preguntas);
    return barajar(conOpcionesParaElegir(lista).filter(p => p && (p.tipo === 'MULTIPLE' || (p.tipo === 'CORTA' && !soloElegir))));
}

// ═══════════════════════════ ELEGIR PREGUNTAS ══════════════════════════════
function PantallaPrevia({ onIniciar, onSalir }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [sel, setSel] = useState(null);
    const [filtro, setFiltro] = useState('');
    useEffect(() => {
        (async () => {
            try {
                const [snapBurbujas, snapKart] = await Promise.all([
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false))),
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'KARTINGED'), where('isPrivate', '==', false))),
                ]);
                const profes = [...snapBurbujas.docs, ...snapKart.docs].map(d => ({ id: d.id, ...d.data() }));
                setRecursos([RECURSO_VIAL, ...(await conRecursosPikt(profes, 'CAZABURBUJAS'))]);
            } catch (e) { console.error('Racing 3D:', e); setRecursos([RECURSO_VIAL]); }
            setCargando(false);
        })();
    }, []);
    const hojas = sel?.hojas?.map(h => h.nombreHoja).filter(Boolean) || [];
    const lista = recursos.filter(r => !filtro || `${r.titulo} ${r.temas || ''} ${r.ciclo || ''}`.toLowerCase().includes(filtro.toLowerCase()));
    const COLORES = ['#00C6FF,#0072FF', '#7B2FFF,#4A00E0', '#00F260,#0575E6', '#f7971e,#ffd200', '#ee0979,#ff6a00', '#56ab2f,#a8e063'];
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: 900, display: 'flex' }}><button onClick={onSalir} style={{ ...botonGrad('rgba(255,255,255,0.1)'), padding: '8px 14px', fontSize: '0.85rem' }}>← Salir</button></div>
            <div style={{ fontSize: '3rem' }}>🏁</div>
            <h1 style={titulo}>Racing 3D</h1>
            <p style={{ color: '#aaa', margin: '0 0 18px', textAlign: 'center' }}>Elige las preguntas de los checkpoints</p>
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔎 Buscar recurso, tema o curso…" style={{ width: '100%', maxWidth: 900, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.95rem', marginBottom: 14, boxSizing: 'border-box' }} />
            {cargando ? <p style={{ color: '#aaa' }}>Cargando recursos…</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12, width: '100%', maxWidth: 900 }}>
                    {lista.map(r => (
                        <div key={r.id} onClick={() => setSel(r)} style={{ background: sel?.id === r.id ? 'rgba(0,198,255,0.18)' : 'rgba(255,255,255,0.06)', border: `2px solid ${sel?.id === r.id ? AZUL : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.esVial ? '' : r.esPikt ? 'π ' : '🏎️ '}{r.titulo}</div>
                            <div style={{ color: '#aaa', fontSize: '0.78rem' }}>{r.temas || r.profesorNombre || ''}{r.ciclo ? ` · ${r.ciclo}` : ''}</div>
                            {!r.esVial && <div style={{ color: '#aaa', fontSize: '0.78rem' }}>{r.hojas?.length || 1} hoja(s)</div>}
                        </div>
                    ))}
                </div>
            )}
            {sel && (
                <div style={{ width: '100%', maxWidth: 900, marginTop: 18, marginBottom: 30 }}>
                    <HojasRecurso key={sel.id} recurso={sel} color={AZUL} colores={['#0072FF', '#7B2FFF', '#00a86b', '#f7971e', '#ee0979', '#56ab2f']} textoContinuar="🏁 Elegir circuito" onElegir={(h) => onIniciar(sel, h)} />
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════ CONFIGURAR ═══════════════════════════════════
function PantallaConfig({ recurso, hoja, onEmpezar, onVolver, mandos, setMandos, ctrl, jugadores, setJugadores }) {
    const [circuito, setCircuito] = useState('asfalto');
    const [vehiculo, setVehiculo] = useState('coche');
    const [rivales, setRivales] = useState(3);
    const [vueltas, setVueltas] = useState(3);
    const [checkpoints, setCheckpoints] = useState(4);
    const [nombres, setNombres] = useState(['', '', '', '']);
    const Op = ({ val, set, ops }) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ops.map(([v, t]) => <button key={v} onClick={() => set(v)} style={{ padding: '9px 16px', borderRadius: 10, border: `2px solid ${val === v ? AZUL : 'rgba(255,255,255,0.15)'}`, background: val === v ? 'rgba(0,198,255,0.2)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{t}</button>)}
        </div>
    );
    const h4 = { margin: '18px 0 8px', color: AZUL, fontSize: '0.85rem', letterSpacing: 1, textTransform: 'uppercase' };
    return (
        <div style={{ ...fondo, padding: '24px 16px' }}>
            <div style={{ maxWidth: 820, margin: '0 auto' }}>
                <button onClick={onVolver} style={{ ...botonGrad('rgba(255,255,255,0.1)'), padding: '8px 14px', fontSize: '0.85rem' }}>← Preguntas</button>
                <h1 style={{ ...titulo, marginTop: 14 }}>Prepara la carrera</h1>
                <p style={{ color: '#aaa', margin: 0 }}>{recurso.titulo}{textoHojas(hoja) !== 'General' ? ` · ${textoHojas(hoja)}` : ''}</p>
                <div style={h4}>Circuito</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                    {Object.values(CIRCUITOS).map(c => (
                        <button key={c.id} onClick={() => setCircuito(c.id)} style={{ textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', background: circuito === c.id ? 'rgba(0,198,255,0.16)' : 'rgba(255,255,255,0.05)', border: `2px solid ${circuito === c.id ? AZUL : 'rgba(255,255,255,0.1)'}`, borderTop: `5px solid ${c.color}`, color: 'white', fontFamily: FUENTE }}>
                            <div style={{ fontSize: '1.8rem' }}>{c.emoji}</div>
                            <div style={{ fontWeight: 800, margin: '4px 0' }}>{c.nombre}</div>
                            <div style={{ color: '#aaa', fontSize: '0.82rem', lineHeight: 1.4 }}>{c.desc}</div>
                        </button>
                    ))}
                </div>
                <div style={h4}>Jugadores</div>
                <Op val={jugadores} set={setJugadores} ops={[[1, '👤 1'], [2, '👥 2 (pantalla partida)'], [3, '3 jugadores'], [4, '4 jugadores (2 arriba · 2 abajo)']]} />
                {jugadores > 1 && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        {Array.from({ length: jugadores }, (_, j) => <input key={j} value={nombres[j]} maxLength={16} onChange={e => setNombres(n => { const c = [...n]; c[j] = e.target.value; return c; })} placeholder={`Nombre del jugador ${j + 1}`}
                            style={{ flex: 1, minWidth: 150, padding: '10px 12px', borderRadius: 10, border: `2px solid ${COLORES_J[j]}`, background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.95rem' }} />)}
                    </div>
                )}
                {jugadores >= 3 && (
                    <div style={{ marginTop: 10, background: 'rgba(255,214,0,0.08)', border: '1px solid rgba(255,214,0,0.35)', borderRadius: 12, padding: '10px 14px', color: '#fde68a', fontSize: '0.86rem', lineHeight: 1.5 }}>
                        Para 3-4 jugadores hace falta un <b>monitor táctil grande</b> (cada uno conduce con el dedo en su cuarto de pantalla), <b>mandos micro:bit</b> o mandos de consola: en el teclado solo caben 2. La imagen pierde las sombras para que vaya fluida.
                    </div>
                )}
                <div style={h4}>Mandos micro:bit</div>
                <Op val={mandos.activos} set={(v) => setMandos({ ...mandos, activos: v })} ops={[[false, 'No'], [true, '🎮 Sí: inclinar = girar · A acelerar · B frenar']]} />
                {mandos.activos && (
                    <div style={{ marginTop: 10, border: '1px solid rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.06)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <ChipAntena />
                            <BotonTutorialMandos inicial="ovni" texto="📖 Cómo se usa el mando" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', padding: '7px 12px' }} />
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                            Los mismos mandos de los juegos (modo volante, como en el Ovni). <b>Inclina</b> el mando a los lados para girar, mantén <b>A</b> para acelerar y <b>B</b> para frenar (parado, marcha atrás). En los checkpoints la pregunta se contesta con el mando: <b>A</b> cambia la letra y <b>B</b> o agitar responde.
                            {ctrl.version > 0 && !ctrl.continuo && <div style={{ color: '#fde68a', marginTop: 6 }}>💡 Esta antena tiene un programa antiguo: el giro irá a golpes. Regraba antena y mandos (v6 o más) en Programación y robótica → 🎮 Mandos micro:bit.</div>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {Array.from({ length: jugadores }, (_, j) => (
                                <label key={j} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', color: COLORES_J[j], fontWeight: 700 }}>
                                    {jugadores > 1 ? `🚗 ${nombres[j]?.trim() || `Jugador ${j + 1}`}:` : '🚗 Conduce:'}
                                    <ElegirPiloto ctrl={ctrl} i={j} color={COLORES_J[j]} />
                                </label>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>«Automático» = lo coge el primer mando que se mueva en la carrera. Durante la carrera puedes cambiar el piloto de cada coche (▾ o ⏭) para que conduzca otro alumno.</div>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!mandos.invertir} onChange={e => setMandos({ ...mandos, invertir: e.target.checked })} /> ⇄ Invertir el giro (si al inclinar a la derecha el coche va a la izquierda)
                        </label>
                    </div>
                )}
                <div style={h4}>Vehículo</div>
                <Op val={vehiculo} set={setVehiculo} ops={[['coche', '🚗 Coche'], ['moto', '🏍️ Moto']]} />
                <div style={h4}>Rivales (IA)</div>
                <Op val={rivales} set={setRivales} ops={[[3, '3 rivales'], [4, '4 rivales']]} />
                <div style={h4}>Vueltas</div>
                <Op val={vueltas} set={setVueltas} ops={[[2, '2'], [3, '3'], [4, '4']]} />
                <div style={h4}>Checkpoints con pregunta por vuelta</div>
                <Op val={checkpoints} set={setCheckpoints} ops={[[3, '3'], [4, '4'], [5, '5']]} />
                {jugadores >= 2 && (
                    <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
                        {[['#1565c0', 'Jugador 1', 'W acelerar · A D girar · S atrás · Espacio frenar/derrapar · responde con 1 2 3 4'], ['#e91e63', 'Jugador 2', '↑ acelerar · ← → girar · ↓ atrás · Enter o Shift dcho. frenar/derrapar · responde con 7 8 9 0 (o el teclado numérico)']].map(([c, t, d]) => (
                            <div key={t} style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `5px solid ${c}`, borderRadius: 12, padding: '10px 14px', color: '#cfd8dc', fontSize: '0.88rem', lineHeight: 1.5 }}><b style={{ color: 'white' }}>{t}</b><br />{d}</div>
                        ))}
                        <div style={{ gridColumn: '1 / -1', color: '#9fb3c8', fontSize: '0.85rem' }}>🕹️ En un monitor táctil cada jugador conduce con el dedo en su zona: lo apoya donde quiera y lo mueve (arriba acelera, abajo atrás, a los lados gira) y tiene su botón de FRENO. Pueden jugar todos a la vez.{jugadores >= 3 ? ' Los jugadores 3 y 4 no tienen teclas: táctil, micro:bit o mando de consola.' : ''} Mandos de consola: el primero es el jugador 1, el segundo el 2… Cuando uno llega a un checkpoint solo se para su coche: ¡contestar rápido también cuenta!</div>
                    </div>
                )}
                <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 16px', color: '#cfd8dc', fontSize: '0.9rem', lineHeight: 1.7, display: jugadores >= 2 ? 'none' : 'block' }}>
                    ⬆️ acelerar · ⬅️ ➡️ girar · <b>Espacio</b> frenar · ⬇️ frena y, parado, marcha atrás · <b>C</b> cambiar cámara<br />
                    💨 <b>Derrapa</b> en las curvas: gira fuerte a buena velocidad (o gira mientras pulsas Espacio). Si aguantas el derrape más de 1 s, al salir ganas un <b>mini-turbo</b>.<br />
                    En cada checkpoint la carrera se detiene para responder: ✅ acierto = <b>turbo</b> · ❌ fallo = <b>+5 s</b> y frenazo.
                </div>
                <div style={{ textAlign: 'center', marginTop: 22 }}>
                    <button style={{ ...botonGrad(`linear-gradient(135deg,${AZUL},${MORADO})`), fontSize: '1.2rem', padding: '16px 40px' }} onClick={() => onEmpezar({ circuito, vehiculo, rivales, vueltas, checkpoints, jugadores, nombres: nombres.slice(0, jugadores).map((n, j) => n.trim() || `Jugador ${j + 1}`) })}>🚦 ¡A LA PARRILLA!</button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════ CARRERA ═══════════════════════════════════════
function Pregunta({ pregunta, onResponder, teclas = [['Digit1', 'Numpad1'], ['Digit2', 'Numpad2'], ['Digit3', 'Numpad3'], ['Digit4', 'Numpad4']], jugador = null, compacta = false, muyCompacta = false, elegirRef = null, etiquetas = null }) {
    const [elegida, setElegida] = useState(null);
    const [texto, setTexto] = useState('');
    const [resta, setResta] = useState(25);
    const respondida = useRef(false);
    const responder = (dada) => {
        if (respondida.current) return; respondida.current = true;
        const ok = dada != null && esRespuestaCorrecta(pregunta, dada);
        setElegida(dada ?? '');
        if (ok) sonidoCorrecto(); else sonidoIncorrecto();
        setTimeout(() => onResponder(ok, dada), ok ? 700 : 1600);
    };
    useEffect(() => {
        if (resta <= 0) { responder(null); return; }
        const t = setTimeout(() => setResta(x => x - 1), 1000); return () => clearTimeout(t);
    }, [resta]); // eslint-disable-line react-hooks/exhaustive-deps
    if (elegirRef) elegirRef.current = (i) => { if (pregunta.tipo === 'MULTIPLE' && pregunta.opciones[i] != null) responder(pregunta.opciones[i]); };
    useEffect(() => () => { if (elegirRef) elegirRef.current = null; }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const k = (e) => { if (pregunta.tipo !== 'MULTIPLE') return; const i = teclas.findIndex(t => t.includes(e.code)); if (i >= 0 && pregunta.opciones[i] != null) { e.preventDefault(); responder(pregunta.opciones[i]); } };
        window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    }); // eslint-disable-line react-hooks/exhaustive-deps
    const color = (o) => elegida == null ? 'rgba(255,255,255,0.08)' : o === pregunta.correcta ? 'rgba(0,200,83,0.45)' : o === elegida ? 'rgba(255,82,82,0.45)' : 'rgba(255,255,255,0.05)';
    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,8,20,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: muyCompacta ? 6 : 14 }}>
            <div style={{ width: '100%', maxWidth: compacta ? 560 : 620, maxHeight: '100%', overflowY: 'auto', background: 'rgba(15,18,40,0.96)', color: '#ffffff', fontFamily: FUENTE, border: `3px solid ${jugador?.color || AZUL}`, borderRadius: 20, padding: compacta ? '12px 14px' : '20px 22px', boxShadow: `0 0 40px ${jugador?.color || AZUL}55` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: jugador?.color || AZUL, fontWeight: 800, fontSize: '0.85rem', marginBottom: compacta ? 6 : 10 }}>
                    <span>❓ {jugador ? jugador.nombre.toUpperCase() : 'CHECKPOINT'}</span><span style={{ color: resta <= 5 ? '#ff5252' : '#cfd8dc' }}>⏱ {Math.max(0, resta)} s</span>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                    {pregunta.senal && <img src={senalDataURL(pregunta.senal, 200)} alt="" style={{ width: compacta ? 64 : 90, height: compacta ? 64 : 90, background: '#e8edf2', borderRadius: 10, padding: 4 }} />}
                    <div style={{ fontSize: muyCompacta ? '0.95rem' : compacta ? '1.08rem' : '1.25rem', fontWeight: 800, lineHeight: 1.3, color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{pregunta.enunciado}</div>
                </div>
                {pregunta.tipo === 'MULTIPLE' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: pregunta.opciones.some(o => String(o).length > 28) ? '1fr' : '1fr 1fr', gap: 9 }}>
                        {pregunta.opciones.map((o, i) => (
                            <button key={i} onClick={() => responder(o)} style={{ touchAction: 'manipulation', minHeight: muyCompacta ? 40 : 48, padding: muyCompacta ? '6px 10px' : compacta ? '9px 12px' : '12px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.18)', background: color(o), color: 'white', fontWeight: 700, fontSize: '0.98rem', cursor: 'pointer', textAlign: 'left', fontFamily: FUENTE }}>
                                <span style={{ color: '#ffd600', marginRight: 8 }}>{etiquetas ? etiquetas[i] : ETIQ[teclas[i]?.[0]] || (teclas[i]?.length ? i + 1 : '•')}</span>{o}
                            </button>
                        ))}
                    </div>
                ) : (
                    <form onSubmit={e => { e.preventDefault(); responder(texto); }} style={{ display: 'flex', gap: 8 }}>
                        <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe la respuesta" style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '1rem' }} />
                        <button type="submit" style={botonGrad(`linear-gradient(135deg,${AZUL},${MORADO})`)}>OK</button>
                    </form>
                )}
                {etiquetas && elegida == null && <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#fde68a' }}>🎮 Con el mando: A cambia la letra · B o agitar responde (o toca la respuesta)</div>}
                {elegida != null && (
                    <div style={{ marginTop: 12, fontWeight: 800, color: esRespuestaCorrecta(pregunta, elegida) ? '#69f0ae' : '#ff8a80' }}>
                        {esRespuestaCorrecta(pregunta, elegida) ? '✅ ¡Correcto! TURBO 🚀' : `❌ Era: ${pregunta.correcta} · +5 s`}
                    </div>
                )}
            </div>
        </div>
    );
}

const esTactil = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

// Teclas para responder: 1 jugador = 1-4; a varios, J1 = 1-4 y J2 = 7-0 (o el teclado numérico).
// J3 y J4 no tienen teclado: responden tocando su pregunta o con el mando micro:bit.
const TECLAS_1J = [['Digit1', 'Numpad1'], ['Digit2', 'Numpad2'], ['Digit3', 'Numpad3'], ['Digit4', 'Numpad4']];
const TECLAS_J1 = [['Digit1'], ['Digit2'], ['Digit3'], ['Digit4']];
const TECLAS_J2 = [['Digit7', 'Numpad1'], ['Digit8', 'Numpad2'], ['Digit9', 'Numpad3'], ['Digit0', 'Numpad4']];
const SIN_TECLAS = [[], [], [], []];
const ETIQ = { Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0' };
const COLORES_J = ['#1565c0', '#e91e63', '#00c853', '#ff9100'];
const LETRAS_MANDO = ['A', 'B', 'C', 'D'];

/**
 * Joystick FLOTANTE para monitores táctiles: aparece donde se apoya el dedo dentro de la zona del
 * jugador (no hay que acertar en un círculo pequeño). Arriba acelera, abajo frena / marcha atrás,
 * a los lados gira. Cada zona sigue a su propio dedo (multitáctil: varios jugadores a la vez).
 */
function ZonaJoystick({ color, onCambio, estilo, radio = 80, etiqueta }) {
    const [pomo, setPomo] = useState(null); // { cx, cy, dx, dy } en px dentro de la zona
    const dedo = useRef(null);
    const zm = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    const mover = (e, cx, cy) => {
        let dx = (e.clientX - cx) / radio, dy = (e.clientY - cy) / radio;
        const d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d; }
        setPomo(p => ({ ...p, dx, dy }));
        onCambio({ steer: zm(dx), acel: Math.min(1, Math.max(0, zm(-dy) * 1.3)), atras: Math.min(1, Math.max(0, zm(dy) * 1.3)) });
    };
    const abajo = (e) => {
        if (dedo.current != null) return; // esta zona ya tiene su dedo
        e.preventDefault();
        dedo.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect();
        setPomo({ cx: e.clientX - r.left, cy: e.clientY - r.top, dx: 0, dy: 0 });
        onCambio({ steer: 0, acel: 0, atras: 0 });
    };
    const mueve = (e) => { if (dedo.current?.id === e.pointerId) mover(e, dedo.current.cx, dedo.current.cy); };
    const arriba = (e) => { if (dedo.current?.id !== e.pointerId) return; dedo.current = null; setPomo(null); onCambio({ steer: 0, acel: 0, atras: 0 }); };
    return (
        <div onPointerDown={abajo} onPointerMove={mueve} onPointerUp={arriba} onPointerCancel={arriba} onLostPointerCapture={arriba}
            style={{ position: 'absolute', touchAction: 'none', zIndex: 8, ...estilo }}>
            {pomo ? (
                <div style={{ position: 'absolute', left: pomo.cx - radio, top: pomo.cy - radio, width: radio * 2, height: radio * 2, borderRadius: '50%', background: 'rgba(8,10,25,0.4)', border: `3px solid ${color}cc`, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', width: radio * 0.85, height: radio * 0.85, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #fff, ${color})`, left: radio + pomo.dx * radio * 0.75 - radio * 0.425, top: radio + pomo.dy * radio * 0.75 - radio * 0.425, boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }} />
                </div>
            ) : (
                <div style={{ position: 'absolute', inset: 0, border: `2px dashed ${color}55`, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff66', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', pointerEvents: 'none', padding: 6 }}>
                    {etiqueta || '👆 Pon el dedo aquí y muévelo'}
                </div>
            )}
        </div>
    );
}

function BotonFreno({ onCambio, estilo, tam = 86 }) {
    const dedo = useRef(null);
    const soltar = (e) => { if (dedo.current !== e.pointerId) return; dedo.current = null; onCambio({ freno: 0 }); };
    return (
        <button onPointerDown={(e) => { e.preventDefault(); dedo.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); onCambio({ freno: 1 }); }} onPointerUp={soltar} onPointerCancel={soltar} onLostPointerCapture={soltar}
            style={{ position: 'absolute', width: tam, height: tam, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(183,28,28,0.75)', color: 'white', fontWeight: 900, fontSize: '0.8rem', touchAction: 'none', zIndex: 9, ...estilo }}>FRENO<br />💨</button>
    );
}

/** Rectángulo CSS de la zona de cada jugador (igual que las vistas del motor). */
function zonaDe(n, j, vertical) {
    if (n === 1) return { left: 0, top: 0, right: 0, bottom: 0 };
    if (n === 2) return vertical ? (j === 0 ? { left: 0, top: 0, bottom: 0, width: '50%' } : { right: 0, top: 0, bottom: 0, width: '50%' }) : (j === 0 ? { left: 0, right: 0, top: 0, height: '50%' } : { left: 0, right: 0, bottom: 0, height: '50%' });
    const arriba = j < 2;
    if (n === 3 && j === 2) return { left: 0, right: 0, bottom: 0, height: '50%' };
    return { ...(arriba ? { top: 0 } : { bottom: 0 }), ...(j % 2 === 0 ? { left: 0 } : { right: 0 }), width: '50%', height: '50%' };
}

function Carrera({ config, preguntas, onFin, onSalir, mandos }) {
    const n = config.jugadores || 1, varios = n > 1, chico = n >= 3;
    const contRef = useRef(null), mmRef = useRef(null), motorRef = useRef(null);
    const [est, setEst] = useState(null);
    const [pregs, setPregs] = useState([null, null, null, null]);
    const pregsRef = useRef(pregs); pregsRef.current = pregs;
    const [avisos, setAvisos] = useState([null, null, null, null]);
    const [aviso, setAviso] = useState(null);
    const [tactil, setTactil] = useState(esTactil());
    const [tam, setTam] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => { const f = () => setTam({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
    const colas = useRef([0, 1, 2, 3].map(() => barajar(preguntas))), indices = useRef([0, 0, 0, 0]);
    const elegirRefs = useRef([0, 1, 2, 3].map(() => ({ current: null })));
    const ponerAvisoJ = (j, txt, ms = 1800) => {
        if (!varios) { setAviso(txt); setTimeout(() => setAviso(a => (a === txt ? null : a)), ms); return; }
        setAvisos(a => { const c = [...a]; c[j] = txt; return c; });
        setTimeout(() => setAvisos(a => { const c = [...a]; if (c[j] === txt) c[j] = null; return c; }), ms);
    };
    useEffect(() => {
        const m = crearCarrera(contRef.current, { ...config, minimapa: mmRef.current }, {
            onEstado: setEst,
            onCheckpoint: ({ jugador = 0 }) => {
                const cola = colas.current[jugador];
                if (!cola.length) { motorRef.current?.responder(true, { sinPregunta: true }, jugador); return; }
                const p = cola[indices.current[jugador] % cola.length]; indices.current[jugador]++;
                setPregs(a => { const c = [...a]; c[jugador] = p; return c; });
            },
            onVuelta: (v, total, j = 0) => ponerAvisoJ(j, v === total ? '🏁 ¡ÚLTIMA VUELTA!' : `Vuelta ${v} de ${total}`, 2200),
            onMiniTurbo: (t, j = 0) => ponerAvisoJ(j, '💨 ¡MINI-TURBO!', 1000),
            onJugadorMeta: (j, puesto) => { if (varios) ponerAvisoJ(j, `🏁 ¡META! ${puesto}º`, 6000); },
            onSalida: () => { setAviso('¡YA!'); setTimeout(() => setAviso(null), 900); },
            onMeta: (r) => { sonidoFinal(); onFin(r); },
        });
        motorRef.current = m;
        return () => { m.destruir(); motorRef.current = null; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const m = () => motorRef.current;
    const responder = (j, ok, dada) => {
        const p = pregsRef.current[j];
        setPregs(a => { const c = [...a]; c[j] = null; return c; });
        m()?.responder(ok, { enunciado: String(p?.enunciado ?? '').slice(0, 140), dada: String(dada ?? '').slice(0, 80), correcta: String(p?.correcta ?? '').slice(0, 80) }, j);
    };

    // ── Mandos micro:bit (modo volante, como en el Ovni): inclinar = girar, A = acelerar, B = frenar / atrás ──
    const conMandos = !!mandos?.activos && !!mandos.ctrl;
    const ctrl = mandos?.ctrl;
    const estMando = useRef([0, 1, 2, 3].map(() => ({ steer: 0, acel: 0, atras: 0, freno: 0, tGiro: 0, tA: 0, tB: 0, tL: 0 })));
    useEffect(() => {
        if (!conMandos) return undefined;
        const invertir = !!mandos.invertir;
        ctrl.manejadorRef.current = (idx, ev) => {
            if (idx >= n) return;
            const s = estMando.current[idx], ahora = Date.now();
            if (ev.tipo === 'letra') { // respuesta a la pregunta (duelo del mando)
                const i = LETRAS_MANDO.indexOf(ev.letra);
                if (pregsRef.current[idx] && i >= 0) elegirRefs.current[idx].current?.(i);
                return;
            }
            if (ev.tipo !== 'futbol') return;
            if (ev.accion === 'V') {
                const g = ev.x != null ? ev.x / 100 : ev.dir.includes('I') ? -1 : ev.dir.includes('D') ? 1 : 0;
                s.steer = Math.max(-1, Math.min(1, (invertir ? -1 : 1) * g * 1.25)); s.tGiro = ahora;
            } else if (ev.accion === 'P') { // placas antiguas (modo fútbol): empujón de giro
                s.steer = ev.dir === 'I' ? -1 : ev.dir === 'D' ? 1 : 0; s.tGiro = ahora;
            } else if (ev.accion === 'A') { s.acel = ev.on ? 1 : 0; s.tA = ahora; }
            else if (ev.accion === 'B') { s.atras = ev.on ? 1 : 0; s.tB = ahora; }
            else if (ev.accion === 'L') { s.freno = ev.on ? 1 : 0; s.tL = ahora; }
            m()?.setEntradaMando({ steer: s.steer, acel: s.acel, atras: s.atras, freno: s.freno }, idx);
        };
        // sin latido: el botón se da por soltado (1,3 s) y la inclinación por plana (1,2 s)
        const t = setInterval(() => {
            const ahora = Date.now();
            estMando.current.forEach((s, idx) => {
                let cambio = false;
                if (s.steer && ahora - s.tGiro > 1200) { s.steer = 0; cambio = true; }
                if (s.acel && ahora - s.tA > 1300) { s.acel = 0; cambio = true; }
                if (s.atras && ahora - s.tB > 1300) { s.atras = 0; cambio = true; }
                if (s.freno && ahora - s.tL > 1300) { s.freno = 0; cambio = true; }
                if (cambio) m()?.setEntradaMando({ steer: s.steer, acel: s.acel, atras: s.atras, freno: s.freno }, idx);
            });
        }, 200);
        return () => { clearInterval(t); ctrl.manejadorRef.current = null; };
    }, [conMandos, mandos?.invertir]); // eslint-disable-line react-hooks/exhaustive-deps
    // al cambiar de piloto, ese coche suelta los mandos
    const pilotosClave = conMandos ? ctrl.pilotos.slice(0, n).join(',') : '';
    useEffect(() => {
        if (!conMandos) return;
        estMando.current.forEach((s, idx) => { Object.assign(s, { steer: 0, acel: 0, atras: 0, freno: 0 }); m()?.setEntradaMando({ steer: 0, acel: 0, atras: 0, freno: 0 }, idx); });
    }, [pilotosClave]); // eslint-disable-line react-hooks/exhaustive-deps
    // preguntas con mando: el mando del piloto entra en «duelo» (elige A-D). Se repite cada segundo
    // por si se pierde el mensaje y se cierra al responder.
    const pendientesMando = conMandos ? pregs.map((p, j) => (p && j < n ? ctrl.pilotos[j] : null)) : [];
    const claveDuelos = pendientesMando.join(',');
    useEffect(() => {
        if (!conMandos) return undefined;
        const ids = pendientesMando.filter(id => id != null && id < 900);
        if (!ids.length) { finDuelosMandos(); return undefined; }
        ids.forEach(id => dueloMando(id));
        const t = setInterval(() => ids.forEach(id => dueloMando(id)), 1000);
        return () => clearInterval(t);
    }, [claveDuelos]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => { if (conMandos) finDuelosMandos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toque = (j) => (o) => { m()?.despertarAudio(); m()?.setEntradaTactil(o, j); };
    const pedal = (campo) => ({
        onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); m()?.despertarAudio(); m()?.setEntradaTactil({ [campo]: 1 }); },
        onPointerUp: () => m()?.setEntradaTactil({ [campo]: 0 }), onPointerCancel: () => m()?.setEntradaTactil({ [campo]: 0 }),
    });
    const dir = (v) => ({
        onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); m()?.setEntradaTactil({ steer: v }); },
        onPointerUp: () => m()?.setEntradaTactil({ steer: 0 }), onPointerCancel: () => m()?.setEntradaTactil({ steer: 0 }),
    });
    const caja = { background: 'rgba(8,10,25,0.78)', borderRadius: 14, padding: chico ? '4px 10px' : '6px 14px', color: 'white', fontFamily: FUENTE, backdropFilter: 'blur(4px)' };
    const btnT = { width: 74, height: 74, borderRadius: 18, border: '2px solid rgba(255,255,255,0.25)', background: 'rgba(8,10,25,0.6)', color: 'white', fontSize: '1.8rem', touchAction: 'none', userSelect: 'none' };
    const vertical = (est?.division ?? (tam.w >= tam.h ? 'vertical' : 'horizontal')) === 'vertical';
    const ests = est?.jugadores || [];
    // tamaño de cada zona (px) para dimensionar joystick y freno
    const zonaW = n === 1 ? tam.w : n === 2 ? (vertical ? tam.w / 2 : tam.w) : tam.w / 2;
    const zonaH = n === 1 ? tam.h : n === 2 ? (vertical ? tam.h : tam.h / 2) : tam.h / 2;
    const radioJoy = Math.round(Math.max(55, Math.min(110, Math.min(zonaW, zonaH) * 0.16)));
    const tamFreno = Math.round(Math.max(70, Math.min(120, Math.min(zonaW, zonaH) * 0.17)));

    const HudJugador = ({ j }) => {
        const e = ests[j]; if (!e) return null;
        const fz = chico ? 0.8 : 1;
        return (
            <>
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, flexWrap: 'wrap', pointerEvents: 'none', zIndex: 5, maxWidth: 'calc(100% - 16px)' }}>
                    <div style={{ ...caja, borderLeft: `5px solid ${e.color}` }}><div style={{ fontSize: '0.7rem', color: '#ccc' }}>{e.nombre}</div><div style={{ fontSize: `${1.7 * fz}rem`, fontWeight: 900, lineHeight: 1 }}>{e.posicion}º<span style={{ fontSize: '0.75rem', color: '#aaa' }}> /{est.total}</span></div></div>
                    <div style={caja}><div style={{ fontSize: '0.7rem', color: '#aaa' }}>VUELTA</div><div style={{ fontSize: `${1.15 * fz}rem`, fontWeight: 800 }}>{e.vuelta}/{est.vueltas}</div></div>
                    {!chico && <div style={caja}><div style={{ fontSize: '0.7rem', color: '#aaa' }}>TIEMPO</div><div style={{ fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e.tiempo}</div></div>}
                    <div style={caja}><div style={{ fontSize: `${fz}rem`, fontWeight: 800 }}><span style={{ color: '#69f0ae' }}>✔{e.aciertos}</span> <span style={{ color: '#ff8a80' }}>✘{e.fallos}</span></div></div>
                </div>
                <div style={{ position: 'absolute', right: 10, top: chico ? 8 : 'auto', bottom: chico ? 'auto' : 12, textAlign: 'right', pointerEvents: 'none', zIndex: 5, ...caja }}>
                    <div style={{ fontSize: `${2 * fz}rem`, fontWeight: 900, lineHeight: 1, color: e.turbo ? '#40c4ff' : 'white' }}>{e.kmh}</div>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>km/h {e.atras ? '· R' : ''}</div>
                    {e.derrape && <div style={{ color: '#ffd600', fontWeight: 900 }}>💨{chico ? '' : ' DERRAPE'}{e.tDerrape >= 1 ? ' ✨' : ''}</div>}
                    {e.turbo && <div style={{ color: '#40c4ff', fontWeight: 900 }}>🚀{chico ? '' : ' TURBO'}</div>}
                    {e.lento && <div style={{ color: '#ff8a80', fontWeight: 900 }}>🐢 +5 s</div>}
                </div>
                {e.terminado && <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', fontSize: chico ? '1.6rem' : '2.2rem', fontWeight: 900, color: '#ffd600', textShadow: '0 4px 20px #000', pointerEvents: 'none', zIndex: 6 }}>🏁 {e.puesto}º · {e.tiempo}{est.cierre != null ? <div style={{ fontSize: '1rem', color: '#fff' }}>Esperando al resto… {est.cierre} s</div> : null}</div>}
                {avisos[j] && !e.terminado && <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, textAlign: 'center', zIndex: 6, fontSize: chico ? 'clamp(1.2rem,3vw,2.2rem)' : 'clamp(1.5rem,4vw,3rem)', fontWeight: 900, color: '#ffd600', textShadow: '0 4px 20px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>{avisos[j]}</div>}
            </>
        );
    };

    // en la zona del jugador: joystick a la izquierda y freno a la derecha (los de la derecha, al revés,
    // para que los dos alumnos de una misma fila no choquen las manos en el centro)
    const ladoJoy = (j) => (n === 2 ? (vertical ? (j === 0 ? 'izq' : 'der') : 'izq') : n === 3 && j === 2 ? 'izq' : j % 2 === 0 ? 'izq' : 'der');

    return (
        <div onPointerDown={(e) => { if ((e.pointerType === 'touch' || e.pointerType === 'pen') && !tactil) setTactil(true); }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none', overscrollBehavior: 'none', fontFamily: FUENTE }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />
            {varios ? (
                <>
                    {Array.from({ length: n }, (_, j) => <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), pointerEvents: 'none' }}><HudJugador j={j} /></div>)}
                    {(n >= 3 || vertical) && <div style={{ position: 'absolute', zIndex: 4, background: '#000', left: 'calc(50% - 2px)', width: 4, top: 0, ...(n === 3 ? { height: '50%' } : { bottom: 0 }) }} />}
                    {(n >= 3 || !vertical) && <div style={{ position: 'absolute', zIndex: 4, background: '#000', top: 'calc(50% - 2px)', height: 4, left: 0, right: 0 }} />}
                </>
            ) : (
                <>
                    <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', pointerEvents: 'none', zIndex: 5, maxWidth: 'calc(100% - 210px)' }}>
                        <div style={{ ...caja, textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>{est?.posicion ?? '-'}º</div><div style={{ fontSize: '0.7rem', color: '#aaa' }}>de {est?.total ?? '-'}</div></div>
                        <div style={caja}><div style={{ fontSize: '0.7rem', color: '#aaa' }}>VUELTA</div><div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{est?.vuelta ?? 1}/{est?.vueltas ?? '-'}</div></div>
                        <div style={caja}><div style={{ fontSize: '0.7rem', color: '#aaa' }}>TIEMPO</div><div style={{ fontSize: '1.3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{est?.tiempo ?? '0:00.00'}</div></div>
                        <div style={caja}><div style={{ fontSize: '0.7rem', color: '#aaa' }}>PREGUNTAS</div><div style={{ fontSize: '1.1rem', fontWeight: 800 }}><span style={{ color: '#69f0ae' }}>✔ {est?.aciertos ?? 0}</span> <span style={{ color: '#ff8a80' }}>✘ {est?.fallos ?? 0}</span></div></div>
                    </div>
                    {est?.clasif && (
                        <div style={{ position: 'absolute', left: 10, top: 92, zIndex: 5, ...caja, padding: '6px 10px', fontSize: '0.82rem', pointerEvents: 'none' }}>
                            {est.clasif.map((c, i) => <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: c.esJugador ? 900 : 500, color: c.esJugador ? '#ffd600' : 'white' }}><span style={{ width: 16 }}>{i + 1}.</span><span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />{c.nombre}</div>)}
                        </div>
                    )}
                    <div style={{ position: 'absolute', right: 14, bottom: tactil ? 110 : 16, zIndex: 5, ...caja, textAlign: 'right', pointerEvents: 'none' }}>
                        <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, color: est?.turbo ? '#40c4ff' : 'white' }}>{est?.kmh ?? 0}</div>
                        <div style={{ fontSize: '0.75rem', color: '#aaa' }}>km/h {est?.atras ? '· R' : ''}</div>
                        {est?.derrape && <div style={{ color: '#ffd600', fontWeight: 900 }}>💨 DERRAPE {est.tDerrape >= 1 ? '✨' : ''}</div>}
                        {est?.turbo && <div style={{ color: '#40c4ff', fontWeight: 900 }}>🚀 TURBO</div>}
                        {est?.lento && <div style={{ color: '#ff8a80', fontWeight: 900 }}>🐢 +5 s</div>}
                        {est?.fuera && <div style={{ color: '#ffcc80', fontWeight: 700, fontSize: '0.8rem' }}>Fuera de la pista</div>}
                    </div>
                </>
            )}
            {/* Botones y minimapa: arriba en el centro (a 3-4 jugadores, en el cruce de las 4 zonas) */}
            <div style={{ position: 'absolute', ...(n >= 3 ? { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' } : varios ? { top: 10, left: '50%', transform: 'translateX(-50%)' } : { top: 10, right: 10 }), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 25 }}>
                <canvas ref={mmRef} width={180} height={180} style={{ width: n >= 3 ? 'min(120px,16vmin)' : varios ? 'min(140px,22vw)' : 'min(180px,30vw)', height: n >= 3 ? 'min(120px,16vmin)' : varios ? 'min(140px,22vw)' : 'min(180px,30vw)', borderRadius: 14, border: '2px solid rgba(255,255,255,0.2)', pointerEvents: 'none', display: n >= 3 ? 'none' : 'block' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { m()?.pausar(true); onSalir(); }} style={{ ...caja, border: 'none', cursor: 'pointer', fontWeight: 700, padding: '5px 10px' }}>✕</button>
                    <button onClick={() => m()?.alternarCamara()} style={{ ...caja, border: 'none', cursor: 'pointer', padding: '5px 10px' }}>🎥</button>
                    <button title="Joysticks en pantalla" onClick={() => setTactil(t => !t)} style={{ ...caja, border: 'none', cursor: 'pointer', padding: '5px 10px', background: tactil ? '#1565c0' : caja.background }}>🕹️</button>
                </div>
            </div>
            {/* Cuenta atrás y avisos comunes */}
            {(est?.cuenta != null && est.cuenta > 0) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', gap: 14, background: 'rgba(0,0,0,0.6)', padding: '16px 22px', borderRadius: 20 }}>
                        {[3, 2, 1].map(k => <div key={k} style={{ width: 56, height: 56, borderRadius: '50%', background: est.cuenta <= k ? '#ff1744' : '#3a0d0d', boxShadow: est.cuenta <= k ? '0 0 24px #ff1744' : 'none' }} />)}
                    </div>
                </div>
            )}
            {aviso && <div style={{ position: 'absolute', top: '32%', left: 0, right: 0, textAlign: 'center', zIndex: 9, fontSize: 'clamp(2rem,7vw,4rem)', fontWeight: 900, color: '#ffd600', textShadow: '0 4px 20px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>{aviso}</div>}
            {/* Controles táctiles: 1 jugador = botones; a varios = joystick flotante + freno en cada zona */}
            {tactil && !varios && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, display: 'flex', justifyContent: 'space-between', zIndex: 5, touchAction: 'none' }}>
                    <div style={{ display: 'flex', gap: 10 }}><button {...dir(-1)} style={btnT}>◀</button><button {...dir(1)} style={btnT}>▶</button></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button {...pedal('atras')} style={{ ...btnT, fontSize: '1.2rem' }}>⬇</button>
                        <button {...pedal('freno')} style={{ ...btnT, fontSize: '0.8rem', fontWeight: 800, background: 'rgba(183,28,28,0.7)' }}>FRENO</button>
                        <button {...pedal('acel')} style={{ ...btnT, height: 96, fontSize: '1.4rem', background: 'rgba(27,94,32,0.75)' }}>⬆</button>
                    </div>
                </div>
            )}
            {tactil && varios && Array.from({ length: n }, (_, j) => {
                const col = ests[j]?.color || COLORES_J[j];
                const izq = ladoJoy(j) === 'izq';
                const margen = 12, anchoJoy = `calc(62% - ${margen}px)`;
                const abajoExtra = n >= 3 && j < 2 ? 26 : 0; // fila de arriba: aire para los botones del centro
                return (
                    <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), pointerEvents: 'none' }}>
                        <div style={{ pointerEvents: 'auto' }}>
                            {/* zona del joystick: la mitad inferior de la zona del jugador, del lado de fuera */}
                            <ZonaJoystick color={col} onCambio={toque(j)} radio={radioJoy}
                                etiqueta={chico ? '👆 Mueve aquí' : '👆 Pon el dedo aquí y muévelo: arriba acelera, abajo atrás'}
                                estilo={{ bottom: margen + abajoExtra, top: '42%', ...(izq ? { left: margen } : { right: margen }), width: anchoJoy }} />
                            <BotonFreno onCambio={toque(j)} tam={tamFreno} estilo={izq ? { right: margen + 6, bottom: margen + 6 + abajoExtra } : { left: margen + 6, bottom: margen + 6 + abajoExtra }} />
                        </div>
                    </div>
                );
            })}
            {/* Quién pilota cada coche con los mandos micro:bit (se puede cambiar en plena carrera) */}
            {conMandos && Array.from({ length: n }, (_, j) => (
                <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), pointerEvents: 'none', zIndex: 10 }}>
                    <div style={{ position: 'absolute', top: chico ? (ladoJoy(j) === 'izq' ? 54 : 100) : 72, ...(ladoJoy(j) === 'izq' ? { left: 8 } : { right: 8 }) }}>
                        <PilotoEnJuego ctrl={ctrl} i={j} color={ests[j]?.color || COLORES_J[j]} />
                    </div>
                </div>
            ))}
            {/* Preguntas: cada una en la zona de su jugador */}
            {Array.from({ length: n }, (_, j) => pregs[j] && (
                <div key={j} style={{ position: 'absolute', ...zonaDe(n, j, vertical), zIndex: 20 }}>
                    <Pregunta pregunta={pregs[j]} onResponder={(ok, dada) => responder(j, ok, dada)} elegirRef={elegirRefs.current[j]}
                        teclas={!varios ? TECLAS_1J : j === 0 ? TECLAS_J1 : j === 1 ? TECLAS_J2 : SIN_TECLAS}
                        etiquetas={conMandos && ctrl.pilotos[j] != null ? LETRAS_MANDO : null}
                        jugador={varios ? ests[j] : null} compacta={varios} muyCompacta={chico} />
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════ RESULTADOS ═══════════════════════════════════
function ModalEnviarProfe({ resultado, recurso, onClose }) {
    const lista = resultado.jugadores?.length ? resultado.jugadores : [resultado];
    const dos = lista.length > 1;
    const [nombresA, setNombresA] = useState(() => lista.map(j => (/^(Tú|Jugador \d)$/.test(j.nombre || '') ? '' : j.nombre)));
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const enviar = async () => {
        for (const n of nombresA) { const v = validarNombre(n); if (!v.ok) { setError(v.mensaje); return; } }
        const code = codigo.trim().toUpperCase(); if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const jugadores = lista.map((j, i) => {
                const intentos = j.aciertos + j.fallos;
                return {
                    nombre: nombresA[i].trim(), curso: curso.trim(), aciertos: j.aciertos, intentos, porcentaje: intentos ? Math.round((j.aciertos / intentos) * 100) : 0,
                    tiempo: j.tiempo, tiempoFormateado: j.tiempoFormateado, puntos: j.puntos, posicion: j.posicion, total: resultado.total, hoja: resultado.hoja,
                    preguntas: (j.preguntas || []).slice(0, 40).filter(p => !p.sinPregunta).map(p => ({ enunciado: p.enunciado || '', dada: p.dada || '', correcta: p.correcta || '', ok: !!p.ok })),
                };
            });
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'RACING3D', modalidad: `${resultado.circuito} · ${resultado.vehiculo === 'moto' ? 'moto' : 'coche'}${dos ? ` · ${lista.length} jugadores` : ''}`, fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo, hoja: resultado.hoja, codigoProfesor: code, jugadores,
            });
            jugadores.forEach(j => guardarRegistroLocal('RACING3D', { titulo: recurso.titulo, aciertos: j.aciertos, intentos: j.intentos, porcentaje: j.porcentaje, nombre: j.nombre, curso: j.curso, via: 'profesor' }));
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#0d0d1f', border: '1px solid rgba(0,198,255,0.25)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: FUENTE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: AZUL }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}><div style={{ fontSize: '3rem' }}>✅</div><div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ ...botonGrad('rgba(255,255,255,0.1)'), marginTop: 14 }}>Cerrar</button></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lista.map((j, i) => <input key={i} value={nombresA[i]} onChange={e => { const v = e.target.value; setNombresA(n => { const c = [...n]; c[i] = v; return c; }); }} placeholder={dos ? `Nombre y apellido · ${j.nombre}` : 'Nombre y apellido'} style={{ ...inp, borderColor: dos ? j.color : inp.border }} />)}
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Curso (ej. 3º ESO A)" style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <button onClick={enviar} disabled={enviando} style={botonGrad(enviando ? '#555' : `linear-gradient(135deg,${AZUL},${MORADO})`)}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function PantallaResultados({ resultado, recurso, usuario, onRepetir, onSalir }) {
    const [ranking, setRanking] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [miPosicion, setMiPosicion] = useState(null);
    const [modalProfe, setModalProfe] = useState(false);
    const categoria = `${resultado.hoja} · ${resultado.circuito}`;
    const base = useMemo(() => [where('recursoId', '==', recurso.id), where('categoria', '==', categoria), where('tipoJuego', '==', 'RACING3D')], [recurso.id, categoria]);
    const cargarRanking = async () => {
        try { const snap = await getDocs(query(collection(db, 'ranking'), ...base, orderBy('tiempo', 'asc'), limit(10))); setRanking(snap.docs.map(d => d.data())); }
        catch (e) { console.warn('Ranking:', e); }
    };
    const dos = !!resultado.dosJugadores;
    useEffect(() => {
        if (!dos) cargarRanking();
        (resultado.jugadores || [resultado]).forEach(j => {
            const intentos = j.aciertos + j.fallos;
            guardarRegistroLocal('RACING3D', { titulo: `${recurso.titulo} · ${resultado.circuito}${dos ? ` · ${j.nombre}` : ''}`, aciertos: j.aciertos, intentos, porcentaje: intentos ? Math.round((j.aciertos / intentos) * 100) : 0, via: 'juego' });
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const guardarRanking = async () => {
        if (guardando || guardado) return;
        setGuardando(true);
        const nombre = usuario?.displayName || 'Anónimo', email = usuario?.email || 'invitado';
        try {
            const pos = (await getCountFromServer(query(collection(db, 'ranking'), ...base, where('tiempo', '<', resultado.tiempo)))).data().count + 1;
            setMiPosicion(pos);
            const medalla = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';
            const datos = { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'RACING3D', categoria, email, jugador: nombre, tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla, vehiculo: resultado.vehiculo };
            if (email !== 'invitado') {
                const snap = await getDocs(query(collection(db, 'ranking'), ...base, where('email', '==', email)));
                if (!snap.empty) { if (resultado.tiempo < snap.docs[0].data().tiempo) await updateDoc(doc(db, 'ranking', snap.docs[0].id), datos); }
                else await addDoc(collection(db, 'ranking'), datos);
            } else await addDoc(collection(db, 'ranking'), datos);
            setGuardado(true); cargarRanking();
        } catch (e) { console.error(e); }
        setGuardando(false);
    };
    const fila = { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' };
    const caja = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,198,255,0.2)', borderRadius: 20, padding: '20px 24px', width: '100%', maxWidth: 520, marginBottom: 18, boxSizing: 'border-box' };
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            {dos ? (() => {
                const gana = resultado.jugadores.reduce((x, y) => (y.posicion < x.posicion ? y : x));
                return (<>
                    <div style={{ fontSize: '3rem' }}>🏆</div>
                    <h1 style={{ ...titulo, marginBottom: 16 }}>¡Gana {gana.nombre}!</h1>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, width: '100%', maxWidth: resultado.jugadores.length > 2 ? 940 : 620, marginBottom: 18 }}>
                        {resultado.jugadores.map((j, i) => (
                            <div key={i} style={{ ...caja, maxWidth: 'none', marginBottom: 0, borderTop: `6px solid ${j.color}` }}>
                                <div style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: 6 }}>{j === gana ? '🏆 ' : ''}{j.nombre}</div>
                                <div style={fila}><span>Puesto</span><b>{j.posicion}º de {resultado.total}</b></div>
                                <div style={fila}><span>⏱ Tiempo</span><b>{j.tiempoFormateado}</b></div>
                                {j.penalizacion > 0 && <div style={{ ...fila, color: '#ff8a80' }}><span>➕ Penalización</span><b>+{j.penalizacion} s</b></div>}
                                <div style={fila}><span>✅ / ❌</span><b>{j.aciertos} / {j.fallos}</b></div>
                                <div style={{ ...fila, borderBottom: 'none' }}><span>🏆 Puntos</span><b>{j.puntos}</b></div>
                            </div>
                        ))}
                    </div>
                </>);
            })() : (<>
            <div style={{ fontSize: '3rem' }}>{resultado.posicion === 1 ? '🏆' : resultado.posicion <= 3 ? '🥇' : '🏁'}</div>
            <h1 style={{ ...titulo, marginBottom: 16 }}>{resultado.posicion === 1 ? '¡Has ganado!' : `¡Has llegado ${resultado.posicion}º!`}</h1>
            <div style={caja}>
                <div style={fila}><span>⏱ Tiempo total</span><b>{resultado.tiempoFormateado}</b></div>
                {resultado.penalizacion > 0 && <div style={{ ...fila, color: '#ff8a80' }}><span>➕ Penalización por fallos</span><b>+{resultado.penalizacion} s</b></div>}
                <div style={fila}><span>✅ Aciertos / ❌ fallos</span><b>{resultado.aciertos} / {resultado.fallos}</b></div>
                <div style={fila}><span>🏆 Puntos</span><b>{resultado.puntos}</b></div>
                <div style={{ ...fila, borderBottom: 'none' }}><span>🗺️ Circuito</span><b>{resultado.circuito} · {resultado.vehiculo === 'moto' ? '🏍️' : '🚗'}</b></div>
            </div>
            </>)}
            <div style={caja}>
                <h3 style={{ margin: '0 0 10px', color: AZUL }}>Clasificación</h3>
                {resultado.clasificacion.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', fontWeight: c.esJugador ? 900 : 500, color: c.esJugador ? '#ffd600' : 'white' }}>
                        <span>{i + 1}. <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.color, marginRight: 6 }} />{c.nombre}</span><span>{c.tiempo || '—'}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                {dos ? null : !guardado ? <button style={botonGrad(`linear-gradient(135deg,${AZUL},#0072FF)`)} onClick={guardarRanking} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar en ranking'}</button>
                    : <div style={{ color: '#2ecc71', fontWeight: 700, alignSelf: 'center' }}>✅ Guardado {miPosicion ? `— puesto #${miPosicion}` : ''}</div>}
                <button style={botonGrad(`linear-gradient(135deg,${MORADO},#4A00E0)`)} onClick={() => setModalProfe(true)}>📤 Enviar al profesor</button>
                <button style={botonGrad('linear-gradient(135deg,#00b09b,#96c93d)')} onClick={onRepetir}>🔁 Otra carrera</button>
                <button style={botonGrad('rgba(255,255,255,0.1)')} onClick={onSalir}>🏠 Salir</button>
            </div>
            {ranking.length > 0 && (
                <div style={caja}>
                    <h3 style={{ margin: '0 0 12px', color: AZUL }}>🏆 Ranking — {categoria}</h3>
                    {ranking.map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.05)', fontSize: '0.9rem' }}><span>{r.medalla || `#${i + 1}`} {r.jugador}</span><span>{r.tiempoFormateado} · {r.puntos} pts</span></div>)}
                </div>
            )}
            {modalProfe && <ModalEnviarProfe resultado={resultado} recurso={recurso} onClose={() => setModalProfe(false)} />}
        </div>
    );
}

// ═══════════════════════════ RAÍZ ══════════════════════════════════════════
function PantallaHoja({ recurso, onElegir, onSalir }) {
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }}>
            <div style={{ fontSize: '3rem' }}>🏁</div>
            <h1 style={titulo}>Racing 3D</h1>
            <div style={{ width: '100%', maxWidth: 820 }}>
                <HojasRecurso recurso={recurso} color={AZUL} colores={['#0072FF', '#7B2FFF', '#00a86b', '#f7971e', '#ee0979', '#56ab2f']} bajar={false} textoContinuar="🏁 Elegir circuito" onElegir={onElegir} />
            </div>
            <button onClick={onSalir} style={{ ...botonGrad('rgba(255,255,255,0.1)'), padding: '8px 14px', fontSize: '0.85rem' }}>← Salir</button>
        </div>
    );
}

/**
 * Props opcionales:
 *  · recurso / hojaInicial: entra directamente con ese recurso (p. ej. desde GamePlayer).
 *  · modoOlimpico, hojaOlimpica, onOlimpicoFinish(puntos): contrato de Control de Aula / OlympicLive.
 */
export default function RacingGame3D({ usuario, alTerminar, onExit, recurso: recursoProp = null, hojaInicial = 'General', modoOlimpico = false, hojaOlimpica = 'General', onOlimpicoFinish = null }) {
    const varias = (recursoProp?.hojas?.length || 0) > 1;
    const [fase, setFase] = useState(recursoProp ? (varias && !modoOlimpico && hojaInicial === 'General' ? 'HOJA' : 'CONFIG') : 'PREVIO');
    const [recurso, setRecurso] = useState(recursoProp);
    const [hoja, setHoja] = useState(modoOlimpico ? (hojaOlimpica || 'General') : hojaInicial);
    const [config, setConfig] = useState(null);
    const [preguntas, setPreguntas] = useState([]);
    const [resultado, setResultado] = useState(null);
    const [clave, setClave] = useState(0);
    const [nJugadores, setNJugadores] = useState(1);
    const [mandos, setMandosE] = useState(() => { try { return { activos: false, invertir: false, ...JSON.parse(localStorage.getItem('pikt_racing_mandos') || '{}') }; } catch { return { activos: false, invertir: false }; } });
    const setMandos = (v) => { setMandosE(v); try { localStorage.setItem('pikt_racing_mandos', JSON.stringify(v)); } catch { /* */ } };
    const acepta = (ev) => ev.tipo === 'futbol' || ev.tipo === 'letra';
    const ctrlMandos = useMandosOvni(mandos.activos, config?.jugadores || nJugadores, { acepta });
    const salir = () => (alTerminar || onExit)?.();
    if (fase === 'HOJA') return <PantallaHoja recurso={recurso} onSalir={salir} onElegir={(h) => { setHoja(h); setFase('CONFIG'); }} />;
    if (fase === 'FIN_OLIMPICO') return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: '3.5rem' }}>🏁</div>
            <h2 style={{ margin: 0, color: '#FFD700' }}>¡Carrera terminada!</h2>
            {resultado && <div style={{ opacity: 0.85 }}>🏆 {resultado.puntos} puntos · {resultado.posicion}º · ⏱ {resultado.tiempoFormateado}</div>}
            <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Puntuación enviada.</div>
        </div>
    );
    if (fase === 'PREVIO') return <PantallaPrevia onSalir={salir} onIniciar={(r, h) => { setRecurso(r); setHoja(h); setFase('CONFIG'); }} />;
    if (fase === 'CONFIG') return <PantallaConfig recurso={recurso} hoja={hoja} mandos={mandos} setMandos={setMandos} ctrl={ctrlMandos} jugadores={nJugadores} setJugadores={setNJugadores} onVolver={() => (recursoProp ? (varias && !modoOlimpico ? setFase('HOJA') : salir()) : setFase('PREVIO'))} onEmpezar={(c) => { setConfig(c); setPreguntas(preguntasPara(recurso, hoja, c.jugadores >= 2 || mandos.activos)); setClave(k => k + 1); setFase('JUGANDO'); }} />;
    if (fase === 'RESULTADO' && resultado) return <PantallaResultados resultado={{ ...resultado, hoja: textoHojas(hoja) }} recurso={recurso} usuario={usuario} onRepetir={() => setFase('CONFIG')} onSalir={salir} />;
    return <Carrera key={clave} config={config} preguntas={preguntas} mandos={{ ...mandos, ctrl: ctrlMandos }} onSalir={() => setFase('CONFIG')} onFin={(r) => {
        setResultado(r);
        if (modoOlimpico) { onOlimpicoFinish?.(Number(r.puntos) || 0); setFase('FIN_OLIMPICO'); }
        else setFase('RESULTADO');
    }} />;
}
