// La Mansión Pitagórica — escape room 3D (three.js) con preguntas.
// Antes era un build de Unity de 103 MB (public/build nuevo); ahora el motor está en
// src/mansion/ y pesa solo su código. Funciona en ordenador, móvil y gafas VR (WebXR).
import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, limit } from 'firebase/firestore';
import { validarNombre } from './utils/filtroNombres';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { despertarAudio, sonidoFinal } from './utils/sonidosFeedback';
import { categoriasDeRecurso, conOpcionesParaElegir, barajar } from './utils/normalizarPreguntas';
import { conRecursosPikt } from './bancoPreguntas/recursosPikt';
import HojasRecurso, { filtrarHojas, textoHojas } from './components/HojasRecurso';
import { crearMansion, pedirSesionVR, VIDAS } from './mansion/motorMansion';
import { ESCENARIOS, ORDEN_ESCENARIOS } from './mansion/escenarios';
import { FRASES, fraseDe, urlFrase } from './mansion/narracion';
import { crearAudio } from './utils/audioTenebroso';

const FUENTE = "'Segoe UI', system-ui, sans-serif";
const MORADO = '#a855f7';
const COLORES_OPCION = ['#7c3aed', '#db2777', '#d97706', '#059669'];
const LETRAS = ['A', 'B', 'C', 'D'];
const fondo = { minHeight: '100vh', background: 'linear-gradient(135deg,#0d0221,#1a0533,#0f1f40)', color: 'white', fontFamily: FUENTE };
const boton = (bg, extra = {}) => ({ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white', background: bg, fontFamily: FUENTE, ...extra });
const LS_CFG = 'pikt_mansion_cfg';
const leerCfg = () => { try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}') || {}; } catch { return {}; } };
const guardarCfg = (c) => { try { localStorage.setItem(LS_CFG, JSON.stringify({ ...leerCfg(), ...c })); } catch { } };

// ─── Preguntas ────────────────────────────────────────────────────────────────
// Banco propio para jugar sin recurso: tablas, cuadrados, raíces y Pitágoras.
const SIN_RECURSO = { id: 'libre', titulo: '🧮 Sin recurso: cálculo y Pitágoras', temas: 'Tablas, cuadrados, raíces y triángulos', libre: true, hojas: [] };
function preguntasLibres() {
    const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const op = (correcta, cerca) => {
        const s = new Set([String(correcta)]);
        cerca.forEach(v => { if (v > 0 && s.size < 4) s.add(String(v)); });
        while (s.size < 4) { const v = correcta + r(-9, 9); if (v > 0) s.add(String(v)); }
        return barajar([...s]);
    };
    const out = [];
    for (let i = 0; i < 14; i++) { const a = r(2, 9), b = r(2, 9), c = a * b; out.push({ tipo: 'MULTIPLE', enunciado: `${a} × ${b} = ?`, correcta: String(c), opciones: op(c, [c + a, c - b, c + 1]) }); }
    for (let i = 0; i < 8; i++) { const a = r(2, 15), c = a * a; out.push({ tipo: 'MULTIPLE', enunciado: `${a}² = ?`, correcta: String(c), opciones: op(c, [a * 2, c + a, c - 1]) }); }
    for (let i = 0; i < 8; i++) { const a = r(2, 13), c = a * a; out.push({ tipo: 'MULTIPLE', enunciado: `√${c} = ?`, correcta: String(a), opciones: op(a, [a + 1, a - 1, a * 2]) }); }
    const TERNAS = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [15, 20, 25]];
    TERNAS.forEach(([a, b, h]) => out.push(Math.random() < 0.6
        ? { tipo: 'MULTIPLE', enunciado: `Triángulo rectángulo de catetos ${a} y ${b}. ¿Cuánto mide la hipotenusa?`, correcta: String(h), opciones: op(h, [a + b, h + 1, h - 2]) }
        : { tipo: 'MULTIPLE', enunciado: `Hipotenusa ${h} y un cateto ${a}. ¿Cuánto mide el otro cateto?`, correcta: String(b), opciones: op(b, [h - a, b + 2, b - 1]) }));
    return barajar(out);
}
function preguntasPara(recurso, hoja) {
    if (!recurso || recurso.libre) return preguntasLibres();
    const cats = categoriasDeRecurso(recurso);
    const lista = filtrarHojas(cats, hoja).flatMap(c => c.preguntas);
    return barajar(conOpcionesParaElegir(lista).filter(p => p && p.tipo === 'MULTIPLE' && Array.isArray(p.opciones) && p.opciones.length >= 2))
        .map(p => ({ ...p, opciones: barajar(p.opciones.slice(0, 4).includes(p.correcta) ? p.opciones.slice(0, 4) : [p.correcta, ...p.opciones.filter(o => o !== p.correcta).slice(0, 3)]) }));
}

function useVRSoportado() {
    const [ok, setOk] = useState(false);
    useEffect(() => {
        let vivo = true;
        if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(r => { if (vivo) setOk(!!r); }).catch(() => { });
        return () => { vivo = false; };
    }, []);
    return ok;
}
const esTactil = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

// ─── 1. Elegir recurso ────────────────────────────────────────────────────────
function PantallaPrevia({ onIniciar, onSalir }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [sel, setSel] = useState(null);
    const [filtro, setFiltro] = useState('');
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false)));
                const profes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setRecursos([SIN_RECURSO, ...(await conRecursosPikt(profes, 'CAZABURBUJAS'))]);
            } catch (e) { console.error('Mansion:', e); setRecursos([SIN_RECURSO]); }
            setCargando(false);
        })();
    }, []);
    const lista = recursos.filter(r => !filtro || `${r.titulo} ${r.temas || ''} ${r.ciclo || ''}`.toLowerCase().includes(filtro.toLowerCase()));
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: 900, display: 'flex' }}><button onClick={onSalir} style={boton('rgba(255,255,255,0.12)', { padding: '8px 14px', fontSize: '0.85rem' })}>← Salir</button></div>
            <div style={{ fontSize: '3.2rem' }}>🏚️</div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '0 0 6px', background: 'linear-gradient(90deg,#a855f7,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>La Mansión Pitagórica</h1>
            <p style={{ color: '#c4b5fd', margin: '0 0 18px', textAlign: 'center', maxWidth: 640, lineHeight: 1.5 }}>
                Escape room en 3D: responde para abrir las puertas, busca las pistas del <b>candado</b> y escapa sin que te atrapen. ¡También con gafas de realidad virtual!
            </p>
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔎 Buscar recurso, tema o curso…" style={{ width: '100%', maxWidth: 900, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.95rem', marginBottom: 14, boxSizing: 'border-box' }} />
            {cargando ? <p style={{ color: '#c4b5fd' }}>Cargando recursos…</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12, width: '100%', maxWidth: 900 }}>
                    {lista.map(r => (
                        <div key={r.id} onClick={() => r.libre ? onIniciar(r, 'General') : setSel(r)} style={{ background: sel?.id === r.id ? 'rgba(168,85,247,0.25)' : r.libre ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.07)', border: `2px solid ${sel?.id === r.id ? MORADO : r.libre ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.libre ? '' : r.esPikt ? 'π ' : '📚 '}{r.titulo}</div>
                            <div style={{ color: '#c4b5fd', fontSize: '0.78rem' }}>{r.temas || r.profesorNombre || ''}{r.ciclo ? ` · ${r.ciclo}` : ''}</div>
                            {!r.libre && <div style={{ color: '#c4b5fd', fontSize: '0.78rem' }}>{r.hojas?.length || 1} hoja(s)</div>}
                        </div>
                    ))}
                </div>
            )}
            {sel && (
                <div style={{ width: '100%', maxWidth: 900, marginTop: 18, marginBottom: 30 }}>
                    <HojasRecurso key={sel.id} recurso={sel} color={MORADO} colores={COLORES_OPCION} textoContinuar="🏚️ Continuar" onElegir={(h) => onIniciar(sel, h)} />
                </div>
            )}
        </div>
    );
}

function PantallaHoja({ recurso, onElegir, onSalir }) {
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
            <div style={{ fontSize: '3rem' }}>🏚️</div>
            <div style={{ width: '100%', maxWidth: 820 }}><HojasRecurso recurso={recurso} color={MORADO} colores={COLORES_OPCION} bajar={false} onElegir={onElegir} /></div>
            <button style={boton('rgba(255,255,255,0.12)')} onClick={onSalir}>← Salir</button>
        </div>
    );
}

// ─── 2. Elegir escenario + instrucciones ──────────────────────────────────────
function PantallaEscenario({ recurso, hoja, nPreguntas, onEmpezar, onVolver }) {
    const cfg = leerCfg();
    const [elegido, setElegido] = useState(cfg.escenario && (ESCENARIOS[cfg.escenario] || cfg.escenario === 'todos') ? cfg.escenario : 'mansion');
    const [modo, setModo] = useState(cfg.modo === 'clasico' ? 'clasico' : 'pi');
    const [nJug, setNJug] = useState(cfg.jugadores === 2 ? 2 : 1);
    const jugadores = modo === 'pi' ? nJug : 1;   // el modo dual solo existe en Aventura con Pi
    const vr = useVRSoportado();
    const tactil = esTactil();
    const empezar = (conVR) => { guardarCfg({ escenario: elegido, modo, jugadores: nJug }); onEmpezar(elegido === 'todos' ? ORDEN_ESCENARIOS : [elegido], conVR, modo, jugadores); };
    const tarjetaModo = (id, emoji, nombre, desc) => (
        <div key={id} onClick={() => setModo(id)} style={{ cursor: 'pointer', borderRadius: 16, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', background: modo === id ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.06)', border: `2px solid ${modo === id ? '#facc15' : 'rgba(255,255,255,0.12)'}` }}>
            <div style={{ fontSize: '2.2rem' }}>{emoji}</div>
            <div><div style={{ fontWeight: 800 }}>{nombre}</div><div style={{ fontSize: '0.8rem', color: '#d4d4f0', lineHeight: 1.4 }}>{desc}</div></div>
        </div>
    );
    const tarjeta = (id, emoji, nombre, desc, acento) => (
        <div key={id} onClick={() => setElegido(id)} style={{ cursor: 'pointer', borderRadius: 16, padding: '16px 16px 14px', background: elegido === id ? `${acento}33` : 'rgba(255,255,255,0.06)', border: `2px solid ${elegido === id ? acento : 'rgba(255,255,255,0.12)'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '2.6rem' }}>{emoji}</div>
            <div style={{ fontWeight: 800, margin: '4px 0' }}>{nombre}</div>
            <div style={{ fontSize: '0.8rem', color: '#d4d4f0', lineHeight: 1.4 }}>{desc}</div>
        </div>
    );
    const chipJug = (n, texto) => (
        <button key={n} onClick={() => setNJug(n)} style={boton(nJug === n ? 'linear-gradient(135deg,#a855f7,#7c3aed)' : 'rgba(255,255,255,0.1)', { padding: '9px 16px', fontSize: '0.92rem', border: `2px solid ${nJug === n ? '#e9d5ff' : 'transparent'}` })}>{texto}</button>
    );
    const fila = (icono, texto) => <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '0.9rem', lineHeight: 1.4 }}><span style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>{icono}</span><span>{texto}</span></div>;
    const vidas = VIDAS + (jugadores === 2 ? 1 : 0);
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: 900, display: 'flex' }}><button onClick={onVolver} style={boton('rgba(255,255,255,0.12)', { padding: '8px 14px', fontSize: '0.85rem' })}>← Volver</button></div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '6px 0 2px' }}>Elige cómo jugar</h1>
            <p style={{ color: '#c4b5fd', margin: '0 0 16px', fontSize: '0.9rem', textAlign: 'center' }}>{recurso.titulo}{recurso.libre ? '' : ` · ${textoHojas(hoja)}`} · {nPreguntas} preguntas</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, width: '100%', maxWidth: 900, marginBottom: 12 }}>
                {tarjetaModo('pi', '🦸', 'Aventura con Pi', 'Ves a tu personaje π. Salta a la caja de la respuesta correcta y no entres en el cono de visión de los enemigos.')}
                {tarjetaModo('clasico', '🔦', 'Clásico', 'En primera persona. La pregunta sale en un panel al llegar a la puerta y los enemigos te persiguen si te ven.')}
            </div>
            {modo === 'pi' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                    {chipJug(1, '👤 1 jugador')}
                    {chipJug(2, '👥 2 jugadores · colaborativo')}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, width: '100%', maxWidth: 900 }}>
                {ORDEN_ESCENARIOS.map(id => { const e = ESCENARIOS[id]; return tarjeta(id, e.emoji, e.nombre, e.descripcion, e.colorAcento); })}
                {tarjeta('todos', '🔁', 'Aventura completa', 'Los 3 escenarios seguidos: escapa de uno y pasas al siguiente.', '#22c55e')}
            </div>
            <div style={{ width: '100%', maxWidth: 640, marginTop: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '14px 20px' }}>
                {jugadores === 2 && fila('👥', <><b>Pantalla partida:</b> cada uno empieza en una parte distinta de la casa. Las pistas, el código y las vidas son de los dos, y para escapar <b>tenéis que llegar juntos a la salida</b>.</>)}
                {modo === 'pi'
                    ? fila('📦', <>Delante de cada puerta salen <b>4 cajas</b> (A-D): ponte debajo de la correcta y <b>salta</b> para darle con la cabeza. Si fallas, perdéis una vida.</>)
                    : fila('🚪', <>Acércate a una puerta <b>?</b> y responde. Si aciertas, se abre; si fallas, pierdes una vida.</>)}
                {fila('📜', <>Busca las <b>pistas</b> brillantes: cada una te da una cifra del código.</>)}
                {fila('🔒', <>Con todas las cifras, abre el <b>candado</b> y corre a la salida.</>)}
                {fila('🔦', <>Hay <b>trampas invisibles</b> en el suelo: ilumínalas con la linterna para verlas y esquivarlas.</>)}
                {modo === 'pi'
                    ? fila('👁️', <>Los fantasmas, momias y drones siguen siempre el mismo recorrido: <b>no entres en su cono de visión</b> (la luz del suelo) o te atrapan. {jugadores === 2 ? 'Tenéis' : 'Tienes'} <b>{vidas} vidas</b>.</>)
                    : fila('👻', <>Que no te atrapen los fantasmas, momias o drones: si te ven, te persiguen. Tienes <b>{vidas} vidas</b>.</>)}
                {jugadores === 2
                    ? fila('🎮', tactil
                        ? <>Cada jugador tiene su joystick (🟣 izquierda, 🟢 derecha): arriba/abajo para andar y a los lados para girar, con su botón <b>⤒</b> para saltar.</>
                        : <>🟣 <b>Jugador 1:</b> W/S andar, A/D girar, Q/E de lado, <b>espacio</b> saltar. 🟢 <b>Jugador 2:</b> ↑/↓ andar, ←/→ girar, <b>Enter</b> saltar.</>)
                    : fila('🎮', tactil
                        ? (modo === 'pi'
                            ? <>Joystick a la izquierda: arriba/abajo para andar y a los lados para <b>girar</b>. Botón <b>⤒</b> para saltar. También puedes girar arrastrando a la derecha.</>
                            : <>Joystick a la izquierda para andar y arrastra a la derecha para mirar.</>)
                        : <><b>WASD</b> o flechas para andar, <b>ratón</b> para mirar (clic en el juego){modo === 'pi' ? <>, <b>← →</b> para girar, <b>A/D</b> para ir de lado, <b>espacio</b> para saltar</> : <>, <b>1-4</b> para responder</>} y <b>V</b> para cambiar la cámara.</>)}
                {fila('🎵', <>Música de suspense y narrador con voz: se pueden quitar con los botones <b>🎵</b> y <b>🗣️</b> durante la partida.</>)}
                {vr && jugadores === 1 && fila('🥽', <>Gafas VR: stick izquierdo para andar, derecho para girar, <b>A/X</b> mantenido para teletransportarte y <b>gatillo</b> para pulsar{modo === 'pi' ? ' (apunta a la caja de tu respuesta)' : ''}. La linterna va en la mano derecha (grip para cambiarla de mano).</>)}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', margin: '20px 0 30px' }}>
                <button style={boton('linear-gradient(135deg,#a855f7,#7c3aed)', { fontSize: '1.15rem', padding: '15px 32px', boxShadow: '0 6px 24px rgba(168,85,247,0.45)' })} onClick={() => empezar(false)}>🔮 ¡ENTRAR!</button>
                {vr && jugadores === 1 && <button style={boton('linear-gradient(135deg,#0ea5e9,#2563eb)', { fontSize: '1.15rem', padding: '15px 28px' })} onClick={() => empezar(true)}>🥽 Jugar con gafas VR</button>}
            </div>
        </div>
    );
}

// ─── 3. Partida ───────────────────────────────────────────────────────────────
function Joystick({ onCambio, lado = 'izq', color = 'rgba(255,255,255,0.45)' }) {
    const ref = useRef(null), [p, setP] = useState(null);
    const R = 55;
    const mover = (e) => {
        const r = ref.current.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
        setP({ dx, dy }); onCambio(dx / R, dy / R);
    };
    const soltar = () => { setP(null); onCambio(0, 0); };
    return (
        <div ref={ref} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); mover(e); }} onPointerMove={e => p && mover(e)} onPointerUp={soltar} onPointerCancel={soltar}
            style={{ position: 'absolute', [lado === 'izq' ? 'left' : 'right']: 22, bottom: 26, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)', touchAction: 'none', zIndex: 6 }}>
            <div style={{ position: 'absolute', left: 45 + (p?.dx || 0), top: 45 + (p?.dy || 0), width: 50, height: 50, borderRadius: '50%', background: color, pointerEvents: 'none' }} />
        </div>
    );
}
function BotonSalto({ onSaltar, estilo }) {
    return <button onPointerDown={e => { e.preventDefault(); onSaltar(); }} style={{ position: 'absolute', width: 84, height: 84, borderRadius: '50%', zIndex: 7, border: '2px solid rgba(255,255,255,0.4)', background: 'rgba(250,204,21,0.35)', color: 'white', fontSize: '2rem', fontWeight: 900, touchAction: 'none', ...estilo }} title="Saltar">⤒</button>;
}

function PanelPregunta({ pregunta, onResponder, onCerrar, acento }) {
    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(5,2,15,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 720, background: 'rgba(16,8,36,0.96)', border: `2px solid ${acento}`, borderRadius: 20, padding: '20px 22px', boxShadow: '0 10px 50px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ color: acento, fontWeight: 800, fontSize: '0.85rem' }}>🚪 PUERTA CERRADA</span>
                    <button onClick={onCerrar} style={boton('rgba(255,255,255,0.12)', { padding: '6px 12px', fontSize: '0.8rem' })}>Salir (Esc)</button>
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3.2vw, 1.6rem)', fontWeight: 800, textAlign: 'center', margin: '8px 0 18px', lineHeight: 1.35 }}>{pregunta.enunciado}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
                    {pregunta.opciones.map((o, i) => (
                        <button key={i} onClick={() => onResponder(i)} style={boton(COLORES_OPCION[i], { textAlign: 'left', fontSize: '1.05rem', padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' })}>
                            <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '2px 9px' }}>{LETRAS[i]}</span><span>{o}</span>
                        </button>
                    ))}
                </div>
                <div style={{ textAlign: 'center', color: '#a1a1c4', fontSize: '0.75rem', marginTop: 10 }}>Teclas 1-4 para responder</div>
            </div>
        </div>
    );
}

// Modo Pi: aviso corto mientras hay cajas delante (la pregunta está en la puerta y las respuestas en las cajas)
function BarraPregunta({ tactil, tecla = 'espacio', estilo = {} }) {
    return (
        <div style={{ position: 'absolute', left: '50%', bottom: tactil ? 176 : 18, transform: 'translateX(-50%)', zIndex: 9, pointerEvents: 'none', background: 'rgba(12,6,28,0.85)', border: '2px solid #facc15', borderRadius: 14, padding: '8px 16px', fontWeight: 700, color: '#fde68a', fontSize: '0.9rem', textAlign: 'center', maxWidth: 'calc(100% - 32px)', ...estilo }}>
            📦 Ponte debajo de la caja con la respuesta correcta y salta ({tactil ? 'botón ⤒' : tecla})
        </div>
    );
}

function PanelCandado({ info, onProbar, onCerrar, mitad = null }) {
    const [vals, setVals] = useState(() => Array(info.len).fill(0));
    const [error, setError] = useState(false);
    const cambiar = (k, d) => { setError(false); setVals(v => v.map((x, i) => i === k ? (x + d + 10) % 10 : x)); };
    const probar = () => { if (!onProbar(vals)) { setError(true); } };
    // Teclado: escribir las cifras seguidas (van rellenando de izquierda a derecha) y Enter para abrir
    const posRef = useRef(0);
    useEffect(() => {
        if (mitad !== null) return; // en dual el teclado lo usan los dos jugadores: el candado se pulsa con el ratón o el dedo
        const f = (e) => {
            if (/^[0-9]$/.test(e.key)) { const k = posRef.current; posRef.current = (k + 1) % info.len; setError(false); setVals(v => v.map((x, i) => i === k ? +e.key : x)); }
            if (e.key === 'Enter') document.getElementById('mansion-abrir')?.click();
        };
        window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
    }, [info.len, mitad]);
    const zona = mitad === null ? { inset: 0 } : { top: 0, bottom: 0, width: '50%', [mitad ? 'right' : 'left']: 0 };
    return (
        <div style={{ position: 'absolute', ...zona, zIndex: 15, background: 'rgba(5,2,15,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 520, background: 'rgba(28,18,4,0.97)', border: '2px solid #facc15', borderRadius: 20, padding: '20px 22px', textAlign: 'center', animation: error ? 'mansionTiembla .35s' : 'none' }}>
                <div style={{ fontSize: '2.4rem' }}>🔒</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', marginBottom: 4 }}>Candado de la salida</div>
                <div style={{ color: '#fde68a', fontSize: '0.9rem', marginBottom: 14 }}>
                    Pistas encontradas: <b style={{ letterSpacing: 4 }}>{info.pistas.map(d => d === null ? '?' : d).join(' ')}</b>
                    {info.pistas.some(d => d === null) && <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: 4 }}>Faltan pistas. ¡Explorad las salas!</div>}
                </div>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 16 }}>
                    {vals.map((v, k) => (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button onClick={() => cambiar(k, 1)} style={boton('rgba(255,255,255,0.12)', { padding: '8px 18px' })}>▲</button>
                            <div style={{ fontSize: '2.6rem', fontWeight: 900, color: '#facc15', background: '#000', borderRadius: 10, border: '2px solid #facc15', padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                            <button onClick={() => cambiar(k, -1)} style={boton('rgba(255,255,255,0.12)', { padding: '8px 18px' })}>▼</button>
                        </div>
                    ))}
                </div>
                {error && <div style={{ color: '#fca5a5', fontWeight: 700, marginBottom: 10 }}>Código incorrecto</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button id="mansion-abrir" onClick={probar} style={boton('linear-gradient(135deg,#16a34a,#15803d)')}>🔓 Abrir</button>
                    <button onClick={onCerrar} style={boton('rgba(255,255,255,0.12)')}>Salir</button>
                </div>
            </div>
            <style>{`@keyframes mansionTiembla{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}`}</style>
        </div>
    );
}

// Narrador: frases de escape room como subtítulo y, si está activada, con voz tenebrosa (audioTenebroso.narrar).
// Las frases frecuentes (puerta, fallo, visto…) se espacian para no hablar todo el rato.
const IMPORTANTES = new Set(['inicio', 'candado', 'pistas_todas', 'candado_abierto', 'nivel', 'victoria', 'derrota', 'ultima_vida', 'esperar']);
function useNarradorMansion(audio, opciones, motorRef) {
    const [subtitulo, setSubtitulo] = useState('');
    const ultimo = useRef(0), t = useRef(null);
    useEffect(() => () => clearTimeout(t.current), []);
    const decir = async (evento, extra) => {
        const ahora = performance.now();
        if (!IMPORTANTES.has(evento)) {
            if (ahora - ultimo.current < 9000) return;
            if (evento === 'puerta' && Math.random() < 0.5) return;
        }
        const id = fraseDe(evento, extra);
        const texto = id && FRASES[id];
        if (!texto) return;
        ultimo.current = ahora;
        setSubtitulo(texto);
        motorRef.current?.avisoVR?.(`🕯️ ${texto}`);
        clearTimeout(t.current);
        let dur = null;
        if (opciones.current.voz && audio) dur = await audio.narrar(urlFrase(id));
        t.current = setTimeout(() => setSubtitulo(s => (s === texto ? '' : s)), dur ? dur * 1000 + 500 : 3500 + texto.length * 40);
    };
    return { decir, subtitulo };
}

function Partida({ escenarios, preguntas, xrSession, modo, jugadores = 1, onFin, onSalir }) {
    const contRef = useRef(null), mapaRef = useRef(null), motorRef = useRef(null);
    const dual = jugadores === 2;
    const [est, setEst] = useState(null);
    const [preguntasJ, setPreguntasJ] = useState([null, null]);
    const [candado, setCandado] = useState(null);
    const [avisos, setAvisos] = useState([]);
    const [nivel, setNivel] = useState(null);
    const [bloqueado, setBloqueado] = useState(false);
    const [tiempo, setTiempo] = useState(0);
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    const cfg0 = useMemo(leerCfg, []);
    const [musica, setMusica] = useState(cfg0.musica !== false);
    const [voz, setVoz] = useState(cfg0.voz !== false);
    const opcionesAudio = useRef({ voz }); opcionesAudio.current.voz = voz;
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const narrador = useNarradorMansion(audioRef.current, opcionesAudio, motorRef);
    const decirRef = useRef(narrador.decir); decirRef.current = narrador.decir;
    const tactil = useMemo(esTactil, []);
    const vr = useVRSoportado();
    const onFinRef = useRef(onFin); onFinRef.current = onFin;
    const pregunta = preguntasJ[0];

    useEffect(() => {
        const a = audioRef.current;
        const ponerAviso = (texto, tipo) => {
            const id = Math.random();
            setAvisos(l => [...l.slice(-2), { id, texto, tipo }]);
            setTimeout(() => setAvisos(l => l.filter(x => x.id !== id)), 3600);
        };
        const m = crearMansion(contRef.current, { escenarios, preguntas, xrSession, modo, jugadores, minimapa: mapaRef.current }, {
            onEstado: setEst,
            onPregunta: (j, p) => setPreguntasJ(l => { const c = [...l]; c[j] = p; return c; }),
            onCandado: setCandado,
            onAviso: ponerAviso,
            onEvento: (tipo, extra) => decirRef.current(tipo, extra),
            onNivel: (n) => { setNivel(n); setTimeout(() => setNivel(x => (x === n ? null : x)), 3500); },
            onPunteroBloqueado: setBloqueado,
            onTiempo: setTiempo,
            onFin: (r) => { a.musica(false); onFinRef.current(r); },
        });
        motorRef.current = m;
        if (import.meta.env.DEV) window.__mansion = m; // pruebas desde la consola
        if (cfg0.musica !== false) a.musica(true);
        return () => { m.destruir(); motorRef.current = null; a.cerrar(); };
    }, []);

    const alternarMusica = () => { const v = !musica; setMusica(v); guardarCfg({ musica: v }); audioRef.current.musica(v); };
    const alternarVoz = () => { const v = !voz; setVoz(v); guardarCfg({ voz: v }); if (!v) audioRef.current.callarNarrador(); };

    useEffect(() => {
        const f = () => setPantallaCompleta(!!(document.fullscreenElement || document.webkitFullscreenElement));
        document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
        return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
    }, []);
    const alternarPantalla = () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); }
        else (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    };
    const salir = () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch { }
        onSalir();
    };
    const entrarVR = () => pedirSesionVR().then(s => motorRef.current ? motorRef.current.entrarVR(s) : s.end()).catch(e => console.warn('VR', e));

    // Mirar arrastrando (móvil, un jugador)
    const arrastre = useRef(null);
    const enVR = !!est?.vr;
    const acento = est?.escenario?.acento || MORADO;
    const mmss = `${Math.floor(tiempo / 60)}:${String(tiempo % 60).padStart(2, '0')}`;
    const chip = { background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '6px 12px', fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap' };
    const panelAbierto = !!(pregunta?.panel || (candado && !dual));
    const redondo = { background: 'rgba(0,0,0,0.6)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 44, height: 44, color: 'white', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const etiqueta = (j) => ({ position: 'absolute', top: 58, [j ? 'right' : 'left']: 12, zIndex: 8, pointerEvents: 'none', ...chip, fontSize: '0.85rem', color: j ? '#6ee7b7' : '#d8b4fe' });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', fontFamily: FUENTE, color: 'white', overflow: 'hidden', userSelect: 'none' }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />
            {dual && <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 4, marginLeft: -2, background: 'rgba(0,0,0,0.85)', zIndex: 4, pointerEvents: 'none' }} />}

            {/* Controles táctiles */}
            {tactil && !dual && !panelAbierto && (
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '60%', zIndex: 5, touchAction: 'none' }}
                    onPointerDown={e => { despertarAudio(); e.currentTarget.setPointerCapture(e.pointerId); arrastre.current = { x: e.clientX, y: e.clientY }; }}
                    onPointerMove={e => { if (!arrastre.current) return; motorRef.current?.mirar(e.clientX - arrastre.current.x, e.clientY - arrastre.current.y); arrastre.current = { x: e.clientX, y: e.clientY }; }}
                    onPointerUp={() => { arrastre.current = null; }} onPointerCancel={() => { arrastre.current = null; }} />
            )}
            {tactil && !panelAbierto && <Joystick onCambio={(x, y) => motorRef.current?.setJoystick(x, y, 0)} color={dual ? 'rgba(192,132,252,0.75)' : undefined} />}
            {tactil && dual && <Joystick lado="der" onCambio={(x, y) => motorRef.current?.setJoystick(x, y, 1)} color="rgba(52,211,153,0.75)" />}
            {tactil && !panelAbierto && !enVR && modo !== 'clasico' && (dual
                ? <>
                    <BotonSalto onSaltar={() => motorRef.current?.saltar(0)} estilo={{ left: 'calc(50% - 110px)', bottom: 40 }} />
                    <BotonSalto onSaltar={() => motorRef.current?.saltar(1)} estilo={{ left: 'calc(50% + 26px)', bottom: 40 }} />
                </>
                : <BotonSalto onSaltar={() => motorRef.current?.saltar(0)} estilo={{ right: 24, bottom: 160 }} />)}

            {/* HUD (común: las vidas, las pistas y los puntos son de los dos) */}
            <div style={{ position: 'absolute', top: 10, left: 64, right: 64, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', zIndex: 8, pointerEvents: 'none' }}>
                {est && <>
                    <span style={chip}>{est.escenario?.emoji} {est.totalNiveles > 1 ? `${est.nivel}/${est.totalNiveles}` : est.escenario?.nombre}</span>
                    <span style={{ ...chip, color: '#ff4d6d', letterSpacing: 1 }}>{'❤'.repeat(Math.max(0, est.vidas))}<span style={{ opacity: 0.3 }}>{'❤'.repeat(Math.max(0, est.maxVidas - est.vidas))}</span></span>
                    <span style={{ ...chip, color: '#facc15' }}>{est.candadoAbierto ? '🔓' : '🔒'} {est.pistas.map(d => d === null ? '?' : d).join(' ')}</span>
                    <span style={chip}>🚪 {est.puertasAbiertas}/{est.puertasTotal}</span>
                    <span style={chip}>⭐ {est.puntos}</span>
                    <span style={{ ...chip, fontWeight: 600 }}>⏱ {mmss}</span>
                </>}
            </div>
            {dual && <>
                <span style={etiqueta(0)}>🟣 Jugador 1{est?.enSalida?.[0] ? ' · 🚪 en la salida' : ''}</span>
                <span style={etiqueta(1)}>🟢 Jugador 2{est?.enSalida?.[1] ? ' · 🚪 en la salida' : ''}</span>
            </>}
            <canvas ref={mapaRef} width={190} height={170} style={{ position: 'absolute', right: dual ? 'calc(50% - 75px)' : 12, bottom: dual ? (tactil ? 140 : 12) : 12, width: 150, height: 134, zIndex: 7, background: 'rgba(0,0,0,0.45)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', pointerEvents: 'none', display: enVR ? 'none' : 'block' }} />

            <button onClick={salir} style={{ ...redondo, position: 'absolute', top: 10, left: 12, zIndex: 20 }} title="Salir">⬅</button>
            <div style={{ position: 'absolute', top: dual ? 100 : 10, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={alternarPantalla} style={redondo} title="Pantalla completa">{pantallaCompleta ? '⛶' : '⤢'}</button>
                <button onClick={alternarMusica} style={{ ...redondo, opacity: musica ? 1 : 0.5 }} title={musica ? 'Quitar la música' : 'Poner la música'}>{musica ? '🎵' : '🔇'}</button>
                <button onClick={alternarVoz} style={{ ...redondo, opacity: voz ? 1 : 0.5 }} title={voz ? 'Quitar la voz del narrador' : 'Poner la voz del narrador'}>{voz ? '🗣️' : '🤐'}</button>
                {!enVR && !dual && <button onClick={() => motorRef.current?.alternarVista()} style={redondo} title="Cambiar cámara (V)">{est?.tercera ? '👁️' : 'π'}</button>}
                {vr && !enVR && !dual && <button onClick={entrarVR} style={{ ...redondo, fontSize: '1.2rem' }} title="Jugar con gafas VR">🥽</button>}
            </div>

            {/* Mira y ayuda de controles */}
            {!tactil && !panelAbierto && !enVR && !dual && (bloqueado
                ? (!est?.tercera && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: -3, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', zIndex: 6, pointerEvents: 'none' }} />)
                : !pregunta && <div style={{ position: 'absolute', left: '50%', bottom: 26, transform: 'translateX(-50%)', ...chip, fontWeight: 600, zIndex: 6, pointerEvents: 'none' }}>🖱️ Haz clic en el juego para mirar con el ratón · WASD para andar{modo !== 'clasico' ? ' · ← → para girar · espacio para saltar' : ''}</div>)}
            {!tactil && dual && tiempo < 25 && (
                <div style={{ position: 'absolute', left: '50%', top: 58, transform: 'translateX(-50%)', ...chip, fontWeight: 600, fontSize: '0.8rem', zIndex: 6, pointerEvents: 'none', whiteSpace: 'normal', textAlign: 'center', maxWidth: '62%' }}>
                    🟣 W/S andar · A/D girar · espacio saltar &nbsp;|&nbsp; 🟢 ↑/↓ andar · ←/→ girar · Enter saltar
                </div>
            )}

            {/* Subtítulo del narrador */}
            {narrador.subtitulo && !enVR && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: dual ? (tactil ? 290 : 160) : (tactil ? 240 : 70), display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', padding: '0 16px' }}>
                    <div key={narrador.subtitulo} style={{ maxWidth: 820, padding: '10px 18px', borderRadius: 14, background: 'rgba(8,2,18,0.86)', border: '2px solid rgba(255,140,26,0.45)', color: '#f5e9ff', fontStyle: 'italic', fontSize: 'clamp(0.95rem,1.6vw,1.25rem)', lineHeight: 1.4, textAlign: 'center', animation: 'mansionSub .5s' }}>🕯️ {narrador.subtitulo}</div>
                    <style>{`@keyframes mansionSub{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
                </div>
            )}

            {/* Avisos */}
            <div style={{ position: 'absolute', top: dual ? 100 : 62, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 12, pointerEvents: 'none', padding: '0 16px' }}>
                {avisos.map(a => (
                    <div key={a.id} style={{ background: a.tipo === 'mal' ? 'rgba(127,29,29,0.92)' : a.tipo === 'ok' ? 'rgba(20,83,45,0.92)' : 'rgba(30,20,60,0.92)', border: `1px solid ${a.tipo === 'pista' ? '#facc15' : 'rgba(255,255,255,0.2)'}`, borderRadius: 12, padding: '8px 16px', fontWeight: 700, maxWidth: 640, textAlign: 'center' }}>{a.texto}</div>
                ))}
            </div>

            {/* Cartel al empezar cada nivel */}
            {nivel && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '18px 30px', animation: 'mansionAparece 3.5s forwards' }}>
                        <div style={{ fontSize: '3.4rem' }}>{nivel.emoji}</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 900 }}>{nivel.nombre}</div>
                        {nivel.total > 1 && <div style={{ color: '#c4b5fd' }}>Nivel {nivel.idx + 1} de {nivel.total}</div>}
                        <div style={{ color: '#e9d5ff', fontSize: '0.9rem', marginTop: 6 }}>{nivel.peligros}</div>
                    </div>
                    <style>{`@keyframes mansionAparece{0%{opacity:0;transform:scale(.9)}12%{opacity:1;transform:scale(1)}80%{opacity:1}100%{opacity:0}}`}</style>
                </div>
            )}

            {/* Preguntas y candado */}
            {!dual && pregunta && !pregunta.panel && !enVR && <BarraPregunta tactil={tactil} />}
            {dual && preguntasJ.map((p, j) => p && <BarraPregunta key={j} tactil={tactil} tecla={j ? 'Enter' : 'espacio'} estilo={{ left: j ? '75%' : '25%', maxWidth: 'calc(50% - 24px)', fontSize: '0.8rem' }} />)}
            {pregunta?.panel && !enVR && <PanelPregunta pregunta={pregunta} acento={acento} onResponder={(i) => motorRef.current?.responder(i)} onCerrar={() => motorRef.current?.cerrarModal()} />}
            {candado && !enVR && <PanelCandado info={candado} mitad={dual ? candado.jugador : null} onProbar={(v) => motorRef.current?.probarCodigo(v)} onCerrar={() => motorRef.current?.cerrarModal()} />}
            {enVR && <div style={{ position: 'absolute', inset: 0, zIndex: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, background: 'rgba(0,0,0,0.7)' }}>🥽 Jugando con las gafas…</div>}
        </div>
    );
}

// ─── 4. Resultados ────────────────────────────────────────────────────────────
function PantallaResultados({ resultado, recurso, hoja, onRepetir, onSalir }) {
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [ranking, setRanking] = useState([]);
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState('');
    const [modalProfe, setModalProfe] = useState(false);
    const intentos = resultado.aciertos + resultado.fallos;

    useEffect(() => {
        cargarRanking();
        sonidoFinal();
        guardarRegistroLocal('MANSION_PITAGORICA', { titulo: recurso.titulo, aciertos: resultado.aciertos, intentos, via: 'juego' });
    }, []);

    const cargarRanking = async () => {
        try {
            // Sin orderBy: así no hace falta índice compuesto en Firestore (se ordena aquí)
            const snap = await getDocs(query(collection(db, 'ranking'), where('recursoId', '==', recurso.id), where('tipoJuego', '==', 'MANSION_PITAGORICA'), limit(200)));
            setRanking(snap.docs.map(d => d.data()).sort((a, b) => (b.puntos || 0) - (a.puntos || 0)).slice(0, 10));
        } catch (e) { console.warn(e); }
    };
    const guardar = async () => {
        if (guardando || guardado) return;
        const v = validarNombre(nombre.trim() || 'Jugador');
        if (!v.ok) { setError(v.mensaje); return; }
        setGuardando(true); setError('');
        try {
            await addDoc(collection(db, 'ranking'), {
                recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'MANSION_PITAGORICA',
                categoria: textoHojas(hoja), jugador: nombre.trim() || 'Jugador', puntos: resultado.puntos ?? 0, fecha: new Date(),
            });
            setGuardado(true); cargarRanking();
        } catch (e) { console.error(e); setError('No se pudo guardar.'); }
        setGuardando(false);
    };
    const fmt = (s) => `${Math.floor(s / 60)} min ${s % 60} s`;
    const stat = (k, v) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}><span>{k}</span><b>{v}</b></div>;
    const nombresEsc = resultado.escenarios.map(id => ESCENARIOS[id]?.emoji).join(' ');

    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 16px' }}>
            <div style={{ fontSize: '3.5rem' }}>{resultado.completado ? '🏆' : '👻'}</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '4px 0 18px', color: resultado.completado ? '#f59e0b' : '#f87171', textAlign: 'center' }}>
                {resultado.completado ? '¡Has escapado!' : '¡Te has quedado atrapado!'}
            </h1>
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '18px 26px', width: '100%', maxWidth: 440, marginBottom: 18 }}>
                {stat('⭐ Puntos', resultado.puntos)}
                {stat('✅ Aciertos', resultado.aciertos)}
                {stat('❌ Fallos', resultado.fallos)}
                {stat(`${nombresEsc} Escenarios superados`, `${resultado.niveles} / ${resultado.totalNiveles}`)}
                {stat('⏱ Tiempo', fmt(resultado.tiempo))}
                {resultado.jugadores === 2 && stat('👥 Modo', 'Dual colaborativo')}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0' }}><span>📚 Recurso</span><b style={{ maxWidth: 220, textAlign: 'right', fontSize: '0.88rem' }}>{recurso.titulo}</b></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                {!guardado ? <>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={24} placeholder="Tu nombre" style={{ padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.95rem', width: 160 }} />
                    <button style={boton('linear-gradient(135deg,#a855f7,#7c3aed)')} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar en ranking'}</button>
                </> : <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Guardado</span>}
            </div>
            {error && <div style={{ color: '#f87171', marginBottom: 12 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button style={boton('linear-gradient(135deg,#3b82f6,#1d4ed8)')} onClick={() => setModalProfe(true)}>📤 Enviar al profesor</button>
                <button style={boton('linear-gradient(135deg,#16a34a,#15803d)')} onClick={onRepetir}>🔁 Jugar otra vez</button>
                <button style={boton('rgba(255,255,255,0.12)')} onClick={onSalir}>🏠 Salir</button>
            </div>
            {ranking.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '18px 22px', width: '100%', maxWidth: 440 }}>
                    <h3 style={{ margin: '0 0 12px', color: '#f59e0b' }}>🏆 Ranking</h3>
                    {ranking.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent', fontSize: '0.88rem' }}>
                            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {r.jugador}</span><span>{r.puntos} pts</span>
                        </div>
                    ))}
                </div>
            )}
            {modalProfe && <ModalEnviarProfe resultado={resultado} recurso={recurso} onClose={() => setModalProfe(false)} />}
        </div>
    );
}

function ModalEnviarProfe({ resultado, recurso, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const enviar = async () => {
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!validarNombre(nombre).ok) { setError(validarNombre(nombre).mensaje); return; }
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const intentos = resultado.aciertos + resultado.fallos;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'MANSION_PITAGORICA', modalidad: 'Individual', fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo, codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(), puntos: resultado.puntos, aciertos: resultado.aciertos, fallos: resultado.fallos,
                    intentos, porcentaje: intentos ? Math.round(resultado.aciertos / intentos * 100) : 0,
                    completado: resultado.completado, escenarios: `${resultado.niveles}/${resultado.totalNiveles}`, tiempo: resultado.tiempo, dual: resultado.jugadores === 2,
                }],
            });
            guardarRegistroLocal('MANSION_PITAGORICA', { titulo: recurso.titulo, aciertos: resultado.aciertos, intentos, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
    const etiqueta = { fontSize: '0.78rem', color: '#a0a0c0', display: 'block', marginBottom: 4 };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <div style={{ background: '#120a2a', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 20, width: '100%', maxWidth: 370, padding: '26px 28px', color: 'white', fontFamily: FUENTE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: MORADO }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '2.5rem' }}>✅</div>
                        <div style={{ color: '#10b981', fontWeight: 700, marginTop: 8 }}>¡Enviado!</div>
                        <button onClick={onClose} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={etiqueta}>Nombre</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={inp} /></div>
                        <div><label style={etiqueta}>Curso</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} /></div>
                        <div><label style={etiqueta}>Código del profesor</label><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#444' : 'linear-gradient(135deg,#a855f7,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{enviando ? 'Enviando…' : 'Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MansionPitagoricaGame({ alTerminar, recurso: recursoProp = null, hojaInicial = 'General' }) {
    const [fase, setFase] = useState(recursoProp ? ((recursoProp.hojas?.length || 0) > 1 ? 'HOJA' : 'ESCENARIO') : 'PREVIO');
    const [recurso, setRecurso] = useState(recursoProp);
    const [hoja, setHoja] = useState(hojaInicial);
    const [partida, setPartida] = useState(null);   // { escenarios, preguntas, xrSession, clave }
    const [resultado, setResultado] = useState(null);
    const preguntas = useMemo(() => recurso ? preguntasPara(recurso, hoja) : [], [recurso, hoja]);
    const salir = () => alTerminar?.();

    const empezar = async (escenarios, conVR, modo, jugadores = 1) => {
        despertarAudio();
        let xrSession = null;
        if (conVR) { try { xrSession = await pedirSesionVR(); } catch (e) { console.warn('VR', e); } }
        // Preguntas nuevas en cada partida (en «sin recurso» también cambian los números)
        setPartida({ escenarios, modo, jugadores, preguntas: recurso.libre ? preguntasLibres() : barajar(preguntas), xrSession, clave: Date.now() });
        setFase('JUGANDO');
    };

    if (fase === 'PREVIO') return <PantallaPrevia onSalir={salir} onIniciar={(r, h) => { setRecurso(r); setHoja(h); setFase('ESCENARIO'); }} />;
    if (fase === 'HOJA') return <PantallaHoja recurso={recurso} onSalir={salir} onElegir={(h) => { setHoja(h); setFase('ESCENARIO'); }} />;
    if (fase === 'ESCENARIO') {
        if (!recurso.libre && preguntas.length === 0) return (
            <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: '3rem' }}>🤔</div>
                <div>Este recurso no tiene preguntas de elegir respuesta para la mansión.</div>
                <button style={boton('rgba(255,255,255,0.12)')} onClick={() => setFase('PREVIO')}>← Elegir otro</button>
            </div>
        );
        return <PantallaEscenario recurso={recurso} hoja={hoja} nPreguntas={recurso.libre ? '∞' : preguntas.length} onVolver={() => recursoProp ? salir() : setFase('PREVIO')} onEmpezar={empezar} />;
    }
    if (fase === 'RESULTADO' && resultado) return <PantallaResultados resultado={resultado} recurso={recurso} hoja={hoja} onSalir={salir} onRepetir={() => { setResultado(null); setFase('ESCENARIO'); }} />;
    if (fase === 'JUGANDO' && partida) return (
        <Partida key={partida.clave} escenarios={partida.escenarios} modo={partida.modo} jugadores={partida.jugadores} preguntas={partida.preguntas} xrSession={partida.xrSession}
            onFin={(r) => { setResultado(r); setFase('RESULTADO'); }} onSalir={() => setFase('ESCENARIO')} />
    );
    return null;
}
