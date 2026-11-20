import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { validarNombre } from './utils/filtroNombres';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal, sonidoActivo } from './utils/sonidosFeedback';
import confetti from 'canvas-confetti';
import { categoriasDeRecurso, conOpcionesParaElegir, barajar } from './utils/normalizarPreguntas';
import { conRecursosPikt } from './bancoPreguntas/recursosPikt';
import { crearVuelo, COLORES_OPCION } from './aviones/motorVuelo';
import HojasRecurso, { filtrarHojas, textoHojas } from './components/HojasRecurso';

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
    const lista = recursos.filter(r => !filtro || `${r.titulo} ${r.temas || ''} ${r.ciclo || ''}`.toLowerCase().includes(filtro.toLowerCase()));
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: 900, display: 'flex' }}><button onClick={onSalir} style={{ ...boton('rgba(255,255,255,0.12)'), padding: '8px 14px', fontSize: '0.85rem' }}>← Salir</button></div>
            <div style={{ fontSize: '3.2rem' }}>✈️</div>
            <h1 style={titulo}>Pilota el avión</h1>
            <p style={{ color: '#cfe3f7', margin: '0 0 18px', textAlign: 'center', maxWidth: 620, lineHeight: 1.5 }}>Despega, vuela por los aros y en cada puerta de pregunta <b>pasa por el aro de la respuesta correcta</b>. Al final, ¡aterriza en la pista!</p>
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔎 Buscar recurso, tema o curso…" style={{ width: '100%', maxWidth: 900, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.95rem', marginBottom: 14, boxSizing: 'border-box' }} />
            {cargando ? <p style={{ color: '#cfe3f7' }}>Cargando recursos…</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12, width: '100%', maxWidth: 900 }}>
                    {lista.map(r => (
                        <div key={r.id} onClick={() => setSel(r)} style={{ background: sel?.id === r.id ? 'rgba(41,182,246,0.25)' : 'rgba(255,255,255,0.08)', border: `2px solid ${sel?.id === r.id ? CIAN : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.soloAros ? '' : r.esPikt ? 'π ' : '📚 '}{r.titulo}</div>
                            <div style={{ color: '#cfe3f7', fontSize: '0.78rem' }}>{r.temas || r.profesorNombre || ''}{r.ciclo ? ` · ${r.ciclo}` : ''}</div>
                            {!r.soloAros && <div style={{ color: '#cfe3f7', fontSize: '0.78rem' }}>{r.hojas?.length || 1} hoja(s)</div>}
                        </div>
                    ))}
                </div>
            )}
            {sel && (
                <div style={{ width: '100%', maxWidth: 900, marginTop: 18, marginBottom: 30 }}>
                    <HojasRecurso key={sel.id} recurso={sel} color={CIAN} colores={COLORES_OPCION} textoContinuar="✈️ Continuar" onElegir={(h) => onIniciar(sel, h)} />
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
function PantallaConfig({ recurso, hoja, nDisponibles, onEmpezar, onVolver }) {
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
        const cfg = { nPreguntas: sinPreg ? 0 : Math.min(nPreguntas, nDisponibles), arosEntre: sinPreg ? 3 : arosEntre, invertir, vista };
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
                    📱 En pantalla táctil: mueve el dedo en la izquierda para pilotar y usa la palanca de potencia de la derecha. También funciona con mando.
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

/** Joystick flotante: aparece donde se apoya el dedo. Arriba/abajo = morro, lados = inclinarse. */
function ZonaJoystick({ onCambio, invertir, estilo }) {
    const [pomo, setPomo] = useState(null);
    const dedo = useRef(null);
    const R = 70;
    const zm = (v) => (Math.abs(v) < 0.1 ? 0 : (v - Math.sign(v) * 0.1) / 0.9);
    const fin = (e) => { if (dedo.current?.id !== e.pointerId) return; dedo.current = null; setPomo(null); onCambio({ cabeceo: 0, alabeo: 0 }); };
    return (
        <div onPointerDown={(e) => {
            if (dedo.current) return; e.preventDefault();
            dedo.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect(); setPomo({ cx: e.clientX - r.left, cy: e.clientY - r.top, dx: 0, dy: 0 });
        }} onPointerMove={(e) => {
            if (dedo.current?.id !== e.pointerId) return;
            let dx = (e.clientX - dedo.current.cx) / R, dy = (e.clientY - dedo.current.cy) / R; const d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d; }
            setPomo(p => ({ ...p, dx, dy }));
            onCambio({ alabeo: zm(dx), cabeceo: (invertir ? 1 : -1) * zm(dy) });
        }} onPointerUp={fin} onPointerCancel={fin} onLostPointerCapture={fin}
            style={{ position: 'absolute', touchAction: 'none', zIndex: 8, ...estilo }}>
            {pomo ? (
                <div style={{ position: 'absolute', left: pomo.cx - R, top: pomo.cy - R, width: R * 2, height: R * 2, borderRadius: '50%', background: 'rgba(8,20,40,0.35)', border: '3px solid rgba(255,255,255,0.6)', pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fff, #29b6f6)', left: R + pomo.dx * R * 0.75 - 30, top: R + pomo.dy * R * 0.75 - 30 }} />
                </div>
            ) : <div style={{ position: 'absolute', inset: 0, border: '2px dashed rgba(255,255,255,0.3)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff88', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none', textAlign: 'center', padding: 6 }}>👆 Pilota aquí</div>}
        </div>
    );
}

/** Palanca de potencia vertical (arrastrar). */
function Palanca({ valor, onCambio, estilo }) {
    const ref = useRef(null), dedo = useRef(null);
    const mover = (e) => { const r = ref.current.getBoundingClientRect(); onCambio(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))); };
    const fin = (e) => { if (dedo.current === e.pointerId) dedo.current = null; };
    return (
        <div ref={ref} onPointerDown={(e) => { e.preventDefault(); dedo.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); mover(e); }}
            onPointerMove={(e) => { if (dedo.current === e.pointerId) mover(e); }} onPointerUp={fin} onPointerCancel={fin}
            style={{ position: 'absolute', width: 64, height: 200, borderRadius: 16, background: 'rgba(8,20,40,0.55)', border: '2px solid rgba(255,255,255,0.35)', touchAction: 'none', zIndex: 8, ...estilo }}>
            <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: `calc(${valor * 100}% - 12px)`, minHeight: 4, borderRadius: 10, background: 'linear-gradient(0deg,#ff9800,#ffeb3b)' }} />
            <div style={{ position: 'absolute', top: -22, left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', fontWeight: 800 }}>POTENCIA</div>
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

function Vuelo({ config, preguntas, onFin, onSalir }) {
    const contRef = useRef(null), mmRef = useRef(null), motorRef = useRef(null);
    const [est, setEst] = useState(null);
    const [avisos, setAvisos] = useState([]);
    const [tactil, setTactil] = useState(esTactil());
    const [potencia, setPotencia] = useState(0);
    const [sonido, setSonido] = useState(true);
    const sonidoRef = useRef(true); sonidoRef.current = sonido;
    const rachaRef = useRef(0); // aros seguidos sin fallar: la campanita sube de tono
    useEffect(() => {
        const ponerAviso = (texto) => {
            const id = Math.random();
            setAvisos(l => [...l.slice(-2), { id, texto }]);
            setTimeout(() => setAvisos(l => l.filter(a => a.id !== id)), 3200);
        };
        const m = crearVuelo(contRef.current, { preguntas, nPreguntas: config.nPreguntas, arosEntre: config.arosEntre, invertir: config.invertir, minimapa: mmRef.current }, {
            onEstado: setEst,
            onAviso: ({ texto }) => ponerAviso(texto),
            onRespuesta: ({ ok }) => {
                if (!sonidoRef.current) { if (ok) confetiAcierto(); return; }
                if (ok) { sonidoCorrecto('FANFARRIA'); confetiAcierto(); } else sonidoIncorrecto();
            },
            onEstallido: () => { if (sonidoRef.current) petardo(0.7 + Math.random() * 0.5); },
            onAro: ({ dentro }) => {
                rachaRef.current = dentro ? rachaRef.current + 1 : 0;
                if (dentro && sonidoRef.current) sonidoAro(rachaRef.current - 1);
            },
            onFin: (r) => { sonidoFinal(); onFin(r); },
        });
        motorRef.current = m;
        if (config.vista === 'cabina') m.alternarCamara();
        return () => { m.destruir(); motorRef.current = null; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const m = () => motorRef.current;
    const estRef = useRef(null); estRef.current = est;
    // al pasar a la palanca táctil, empieza con la potencia que llevaba el avión
    useEffect(() => { if (tactil) setPotencia(estRef.current ? estRef.current.motor / 100 : 0); else m()?.setEntradaTactil({ motor: null }); }, [tactil]);
    useEffect(() => { if (tactil) m()?.setEntradaTactil({ motor: potencia }); }, [potencia, tactil]);

    const caja = { background: 'rgba(6,18,36,0.72)', borderRadius: 14, padding: '6px 12px', color: 'white', backdropFilter: 'blur(4px)' };
    const btn = { ...caja, border: 'none', cursor: 'pointer', fontWeight: 700, padding: '7px 11px', fontSize: '0.9rem' };
    const e = est;
    const preg = e?.pregunta;
    const flechaGiro = e && e.dist != null ? e.rumbo : 0;
    return (
        <div onPointerDown={(ev) => { if ((ev.pointerType === 'touch' || ev.pointerType === 'pen') && !tactil) setTactil(true); }} onContextMenu={(ev) => ev.preventDefault()}
            style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', fontFamily: FUENTE }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />
            {/* arriba a la izquierda: progreso */}
            <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, flexWrap: 'wrap', zIndex: 5, pointerEvents: 'none', maxWidth: '55%' }}>
                <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>TIEMPO</div><div style={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e?.tiempo ?? '0:00.0'}</div></div>
                <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>RECORRIDO</div><div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{e ? `${Math.min(e.hechas, e.totalPuertas)}/${e.totalPuertas}` : '-'}</div></div>
                {config.nPreguntas > 0 && <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>PREGUNTAS</div><div style={{ fontSize: '1.15rem', fontWeight: 800 }}><span style={{ color: '#69f0ae' }}>✔ {e?.aciertos ?? 0}</span> <span style={{ color: '#ff8a80' }}>✘ {e?.fallos ?? 0}</span></div></div>}
                <div style={caja}><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>PUNTOS</div><div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffd54f' }}>{e?.puntos ?? 0}</div></div>
            </div>
            {/* arriba a la derecha: minimapa y botones */}
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, zIndex: 7 }}>
                <canvas ref={mmRef} width={170} height={170} style={{ width: 'min(150px,26vw)', height: 'min(150px,26vw)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btn} title="Salir" onClick={() => { m()?.pausar(true); onSalir(); }}>✕</button>
                    <button style={btn} title="Cámara (C)" onClick={() => m()?.alternarCamara()}>🎥</button>
                    <button style={btn} title="Sonido" onClick={() => { m()?.setSonido(!sonido); setSonido(!sonido); }}>{sonido ? '🔊' : '🔇'}</button>
                    <button style={{ ...btn, background: tactil ? '#0277bd' : caja.background }} title="Mandos en pantalla" onClick={() => setTactil(t => !t)}>🕹️</button>
                </div>
                {e?.fase === 'aterrizar' && <button style={{ ...btn, background: 'rgba(120,40,0,0.85)', fontSize: '0.8rem' }} onClick={() => m()?.rendirse()}>🏁 Terminar sin aterrizar</button>}
            </div>
            {/* pregunta */}
            {preg && (
                <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', width: 'min(720px, 94vw)', zIndex: 6, ...caja, padding: '10px 14px', border: '2px solid #ffd54f', pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#ffd54f', fontWeight: 800 }}><span>❓ PASA POR EL ARO DE LA RESPUESTA CORRECTA</span><span>{preg.dist} m</span></div>
                    <div style={{ fontSize: 'clamp(1rem,2.2vw,1.25rem)', fontWeight: 800, margin: '6px 0 8px', lineHeight: 1.3 }}>{preg.enunciado}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: preg.opciones.some(o => String(o).length > 26) ? '1fr' : '1fr 1fr', gap: 6 }}>
                        {preg.opciones.map((o, i) => <div key={i} style={{ background: COLORES_OPCION[i], borderRadius: 10, padding: '6px 10px', fontWeight: 800, fontSize: '0.95rem', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{LETRAS[i]} · {o}</div>)}
                    </div>
                </div>
            )}
            {/* avisos */}
            <div style={{ position: 'absolute', top: preg ? '48%' : '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', pointerEvents: 'none', width: 'min(560px, 92vw)' }}>
                {avisos.map(a => <div key={a.id} style={{ ...caja, fontSize: 'clamp(1rem,2.4vw,1.4rem)', fontWeight: 900, textAlign: 'center', padding: '8px 16px' }}>{a.texto}</div>)}
                {e?.perdida && <div style={{ ...caja, background: 'rgba(183,28,28,0.9)', fontWeight: 900, fontSize: '1.2rem' }}>⚠️ ¡PÉRDIDA! Más potencia y baja el morro</div>}
                {e?.fase === 'despegue' && e.suelo && <div style={{ ...caja, fontWeight: 700 }}>{e.kmh < 20 ? 'Sube la potencia (W o la palanca) para rodar' : e.kmh < 110 ? `Acelerando… ${e.kmh} km/h` : '¡Levanta el morro! (⬆️)'}</div>}
            </div>
            {/* abajo a la izquierda: instrumentos */}
            {e && (
                <div style={{ position: 'absolute', left: 10, bottom: tactil ? 'auto' : 12, top: tactil ? 140 : 'auto', display: 'flex', gap: 8, alignItems: 'flex-end', zIndex: 5, pointerEvents: 'none' }}>
                    <Horizonte cabeceo={e.cabeceo} alabeo={e.alabeo} />
                    <div style={{ ...caja, textAlign: 'center', minWidth: 74 }}><div style={{ fontSize: '1.7rem', fontWeight: 900, lineHeight: 1, color: e.turbo ? '#40c4ff' : 'white' }}>{e.kmh}</div><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>km/h{e.turbo ? ' 🚀' : ''}</div></div>
                    <div style={{ ...caja, textAlign: 'center', minWidth: 74 }}><div style={{ fontSize: '1.7rem', fontWeight: 900, lineHeight: 1 }}>{e.altitud}</div><div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>m de altura</div></div>
                    <div style={{ ...caja, textAlign: 'center' }}>
                        <div style={{ width: 14, height: 54, background: '#1d2b3a', borderRadius: 7, position: 'relative', margin: '0 auto', overflow: 'hidden' }}><div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${e.motor}%`, background: 'linear-gradient(0deg,#ff9800,#ffeb3b)' }} /></div>
                        <div style={{ fontSize: '0.65rem', color: '#9ec9ee' }}>{e.motor}%</div>
                    </div>
                    {e.dist != null && !e.suelo && (
                        <div style={{ ...caja, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', transform: `rotate(${-flechaGiro * 57.3}deg)`, transition: 'transform 0.15s' }}>⬆️</div>
                            <div style={{ fontSize: '0.7rem', color: '#9ec9ee' }}>{e.dist >= 1000 ? `${(e.dist / 1000).toFixed(1)} km` : `${e.dist} m`}</div>
                        </div>
                    )}
                </div>
            )}
            {/* ayuda de aterrizaje */}
            {e?.alineado && e.alineado.distPista > -200 && (
                <div style={{ position: 'absolute', bottom: tactil ? 240 : 110, left: '50%', transform: 'translateX(-50%)', zIndex: 6, ...caja, textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.5, pointerEvents: 'none' }}>
                    <b>🛬 Aproximación</b> · pista a {Math.max(0, e.alineado.distPista)} m{e.tAterrizar != null ? <span style={{ color: e.tAterrizar <= 20 ? '#ff8a80' : '#9ec9ee' }}> · ⏱ {e.tAterrizar} s</span> : null}<br />
                    {Math.abs(e.alineado.lat) < 8 ? '✅ Alineado' : e.alineado.lat > 0 ? '⬅️ Corrige a la izquierda' : 'Corrige a la derecha ➡️'} · altura {Math.max(0, e.alineado.alturaPista)} m · descenso <b style={{ color: e.vs < -5 ? '#ff5252' : e.vs < -2.5 ? '#ffd54f' : '#69f0ae' }}>{Math.abs(e.vs).toFixed(1)} m/s</b>
                </div>
            )}
            {/* mandos táctiles */}
            {tactil && (<>
                <ZonaJoystick invertir={config.invertir} onCambio={(o) => { m()?.despertarAudio(); m()?.setEntradaTactil(o); }} estilo={{ left: 12, bottom: 12, width: '46%', height: '42%' }} />
                <Palanca valor={potencia} onCambio={(v) => { m()?.despertarAudio(); setPotencia(v); }} estilo={{ right: 24, bottom: 24 }} />
                <button onPointerDown={(ev) => { ev.preventDefault(); ev.currentTarget.setPointerCapture?.(ev.pointerId); m()?.setEntradaTactil({ freno: 1 }); }} onPointerUp={() => m()?.setEntradaTactil({ freno: 0 })} onPointerCancel={() => m()?.setEntradaTactil({ freno: 0 })}
                    style={{ position: 'absolute', right: 104, bottom: 24, width: 76, height: 76, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(183,28,28,0.75)', color: 'white', fontWeight: 900, fontSize: '0.8rem', touchAction: 'none', zIndex: 8 }}>FRENO</button>
            </>)}
        </div>
    );
}

// ═══════════════════════════ RESULTADOS ════════════════════════════════════
function ModalEnviarProfe({ resultado, recurso, hoja, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const enviar = async () => {
        const v = validarNombre(nombre); if (!v.ok) { setError(v.mensaje); return; }
        const code = codigo.trim().toUpperCase(); if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const intentos = resultado.aciertos + resultado.fallos;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'AVIONES', modalidad: `${resultado.nPreguntas} preguntas · aterrizaje ${resultado.aterrizaje || 'no'}`, fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo, hoja: textoHojas(hoja), codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(), aciertos: resultado.aciertos, intentos, porcentaje: intentos ? Math.round((resultado.aciertos / intentos) * 100) : 0,
                    tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, aros: resultado.aros, arosTotal: resultado.arosTotal,
                    choques: resultado.choques, aterrizaje: resultado.aterrizaje || null, hoja: textoHojas(hoja),
                    preguntas: (resultado.preguntas || []).slice(0, 40).map(p => ({ enunciado: String(p.enunciado || '').slice(0, 200), dada: String(p.dada || ''), correcta: String(p.correcta || ''), ok: !!p.ok })),
                }],
            });
            guardarRegistroLocal('AVIONES', { titulo: recurso.titulo, aciertos: resultado.aciertos, intentos, porcentaje: intentos ? Math.round((resultado.aciertos / intentos) * 100) : 0, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
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
                        <input value={nombre} onChange={ev => setNombre(ev.target.value)} placeholder="Nombre y apellido" style={inp} />
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
    useEffect(() => {
        const intentos = resultado.aciertos + resultado.fallos;
        guardarRegistroLocal('AVIONES', { titulo: recurso.titulo, aciertos: resultado.aciertos, intentos, porcentaje: intentos ? Math.round((resultado.aciertos / intentos) * 100) : 0, via: 'juego' });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const fila = { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' };
    const caja = { background: 'rgba(255,255,255,0.08)', border: `1px solid ${CIAN}44`, borderRadius: 20, padding: '20px 24px', width: '100%', maxWidth: 520, marginBottom: 18, boxSizing: 'border-box' };
    const at = { perfecto: '🛬 Perfecto (+500)', bueno: '🛬 Bueno (+300)', duro: '🛬 Duro (+120)', 'sin aterrizar': '— Sin aterrizar' }[resultado.aterrizaje] || '—';
    return (
        <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
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
            {resultado.preguntas?.length > 0 && (
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
export default function AvionesGame3D({ alTerminar, onExit, recurso: recursoProp = null, hojaInicial = 'General' }) {
    const varias = (recursoProp?.hojas?.length || 0) > 1;
    const [fase, setFase] = useState(recursoProp ? (varias && hojaInicial === 'General' ? 'HOJA' : 'CONFIG') : 'PREVIO');
    const [recurso, setRecurso] = useState(recursoProp);
    const [hoja, setHoja] = useState(hojaInicial);
    const [config, setConfig] = useState(null);
    const [preguntas, setPreguntas] = useState([]);
    const [resultado, setResultado] = useState(null);
    const [clave, setClave] = useState(0);
    const salir = () => (alTerminar || onExit)?.();
    const disponibles = recurso ? preguntasPara(recurso, hoja).length : 0;
    if (fase === 'PREVIO') return <PantallaPrevia onSalir={salir} onIniciar={(r, h) => { setRecurso(r); setHoja(h); setFase('CONFIG'); }} />;
    if (fase === 'HOJA') return <PantallaHoja recurso={recurso} onSalir={salir} onElegir={(h) => { setHoja(h); setFase('CONFIG'); }} />;
    if (fase === 'CONFIG') return <PantallaConfig recurso={recurso} hoja={hoja} nDisponibles={disponibles} onVolver={() => (recursoProp ? salir() : setFase('PREVIO'))}
        onEmpezar={(c) => { setConfig(c); setPreguntas(preguntasPara(recurso, hoja)); setClave(k => k + 1); setFase('VOLANDO'); }} />;
    if (fase === 'RESULTADO' && resultado) return <PantallaResultados resultado={resultado} recurso={recurso} hoja={hoja} onRepetir={() => setFase('CONFIG')} onSalir={salir} />;
    return <Vuelo key={clave} config={config} preguntas={preguntas} onSalir={() => setFase('CONFIG')} onFin={(r) => { setResultado(r); setFase('RESULTADO'); }} />;
}
