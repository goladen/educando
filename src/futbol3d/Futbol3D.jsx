// Partido 3D de Fútbol Quizz: 3 + portero contra el ordenador, en tiempo real.
// Las preguntas dan ventajas: cada acierto suma una carga ⚡ (súper tiro) y 3 aciertos seguidos dan turbo.
// El visor de preguntas, el normalizador de recursos y la pantalla final vienen de FutbolQuizz.jsx (props).
import React, { useEffect, useRef, useState } from 'react';
import { montarMotor } from './motorFutbol3D';

import correctSoundFile from '../assets/correct-choice-43861.mp3';
import wrongSoundFile from '../assets/negative_beeps-6008.mp3';
import goalSoundFile from '../assets/gol-cutmp3.mp3';
import whistleSoundFile from '../assets/piarbitro.mp3';

const _mkAudio = src => { let a; return { play() { return (a ??= new Audio(src)).play(); }, reset() { if (a) a.currentTime = 0; } }; };
const audioCorrect = _mkAudio(correctSoundFile);
const audioWrong = _mkAudio(wrongSoundFile);
const audioGoal = _mkAudio(goalSoundFile);
const safePlay = (a) => { a.reset(); a.play().catch(() => { }); };
const playWhistle = () => { try { new Audio(whistleSoundFile).play().catch(() => { }); } catch (e) { } };

const MAX_CARGAS = 3;

// Preguntas de cálculo para jugar sin recurso
function generarPreguntasLibres(n = 60) {
    const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const out = [];
    for (let i = 0; i < n; i++) {
        const op = ['+', '−', '×', '÷'][i % 4];
        let a, b, res;
        if (op === '+') { a = r(12, 89); b = r(5, 60); res = a + b; }
        else if (op === '−') { a = r(30, 99); b = r(5, a - 5); res = a - b; }
        else if (op === '×') { a = r(2, 10); b = r(2, 10); res = a * b; }
        else { b = r(2, 10); res = r(2, 10); a = b * res; }
        const malas = new Set();
        while (malas.size < 3) {
            const m = res + r(-10, 10);
            if (m !== res && m >= 0) malas.add(m);
        }
        out.push({ q: `${a} ${op} ${b} = ?`, respuesta: String(res), incorrectas: [...malas].map(String) });
    }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
}

// ---------------------------------------------------------------------------
// Mandos táctiles: joystick + botones (escriben en inputRef, que lee el motor)
// ---------------------------------------------------------------------------
// Fuera de ControlesTactiles para que no se vuelva a montar (y pierda la pulsación) al mover el joystick
function BotonTactil({ inputRef, nombre, children, color, size = 62 }) {
    return (
        <button
            onPointerDown={e => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { } inputRef.current[nombre] = true; }}
            onPointerUp={() => { inputRef.current[nombre] = false; }}
            onPointerCancel={() => { inputRef.current[nombre] = false; }}
            onContextMenu={e => e.preventDefault()}
            style={{ width: size, height: size, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.55)', background: color, color: 'white', fontWeight: 900, fontSize: size > 64 ? '0.95rem' : '0.72rem', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.45)', padding: 0, lineHeight: 1.1 }}>
            {children}
        </button>
    );
}

function ControlesTactiles({ inputRef }) {
    const baseRef = useRef(null);
    const pidRef = useRef(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });

    const mover = (e) => {
        const r = baseRef.current.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const max = r.width / 2, d = Math.hypot(dx, dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        setKnob({ x: dx, y: dy });
        inputRef.current.x = dx / max; inputRef.current.z = dy / max;
    };
    const soltar = () => { pidRef.current = null; setKnob({ x: 0, y: 0 }); inputRef.current.x = 0; inputRef.current.z = 0; };

    return (
        <>
            <div ref={baseRef}
                onPointerDown={e => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { } pidRef.current = e.pointerId; mover(e); }}
                onPointerMove={e => { if (pidRef.current === e.pointerId) mover(e); }}
                onPointerUp={soltar} onPointerCancel={soltar}
                style={{ position: 'absolute', left: 18, bottom: 22, width: 130, height: 130, borderRadius: '50%', background: 'rgba(15,23,42,0.35)', border: '3px solid rgba(255,255,255,0.35)', touchAction: 'none', zIndex: 30 }}>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: '50%', background: 'rgba(255,255,255,0.75)', transform: `translate(${knob.x}px, ${knob.y}px)`, pointerEvents: 'none' }} />
            </div>
            <div style={{ position: 'absolute', right: 14, bottom: 18, zIndex: 30, display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 8, alignItems: 'end', justifyItems: 'center' }}>
                <BotonTactil inputRef={inputRef} nombre="cambio" color="rgba(71,85,105,0.85)" size={50}>⇄</BotonTactil>
                <BotonTactil inputRef={inputRef} nombre="vaselina" color="rgba(147,51,234,0.85)">VASE<br />LINA</BotonTactil>
                <BotonTactil inputRef={inputRef} nombre="super" color="rgba(234,179,8,0.95)" size={58}>⚡</BotonTactil>
                <BotonTactil inputRef={inputRef} nombre="sprint" color="rgba(22,163,74,0.85)" size={54}>SPRINT</BotonTactil>
                <BotonTactil inputRef={inputRef} nombre="pase" color="rgba(37,99,235,0.9)" size={68}>PASE</BotonTactil>
                <BotonTactil inputRef={inputRef} nombre="tiro" color="rgba(220,38,38,0.92)" size={76}>TIRO</BotonTactil>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Panel de controles (al empezar el partido y con el botón 🎮)
// ---------------------------------------------------------------------------
const CONTROLES_TECLADO = [
    { t: ['W', 'A', 'S', 'D'], alt: 'o flechas', d: 'Mover al jugador' },
    { t: ['Shift'], d: 'Sprint (gasta la barra verde)' },
    { t: ['J'], d: 'Pase al compañero hacia donde apuntas · sin balón: cambiar de jugador' },
    { t: ['K'], d: 'Tiro: mantén para cargar y suelta · sin balón: entrada' },
    { t: ['L'], d: 'Vaselina (cerca de la portería) o pase elevado' },
    { t: ['Espacio'], d: '⚡ Súper tiro (necesita una carga)' },
    { t: ['E'], alt: 'o Q', d: 'Cambiar al jugador más cercano al balón' },
];
const CONTROLES_TACTIL = [
    { b: '🕹️', d: 'Joystick (izquierda): mover al jugador' },
    { b: 'TIRO', c: '#dc2626', d: 'Mantén para cargar y suelta · sin balón: entrada' },
    { b: 'PASE', c: '#2563eb', d: 'Pase al compañero · sin balón: cambiar de jugador' },
    { b: 'VASE', c: '#9333ea', d: 'Vaselina o pase elevado' },
    { b: '⚡', c: '#eab308', d: 'Súper tiro (necesita una carga)' },
    { b: 'SPRINT', c: '#16a34a', d: 'Mantén para correr más' },
    { b: '⇄', c: '#475569', d: 'Cambiar al jugador más cercano al balón' },
];
const tecla = { display: 'inline-block', minWidth: 26, padding: '3px 7px', margin: '0 2px', borderRadius: 6, background: '#e2e8f0', color: '#0f172a', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', boxShadow: '0 2px 0 #94a3b8' };

function PanelControles({ esTactil, setEsTactil, inicial, onCerrar }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onCerrar(); }; // Enter ya lo recoge el botón (autoFocus)
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCerrar]);
    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, overflowY: 'auto' }}>
            <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '20px 22px', width: '100%', maxWidth: 520, color: 'white', boxShadow: '0 16px 40px rgba(0,0,0,0.6)', maxHeight: '100%', overflowY: 'auto' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center' }}>🎮 Controles</div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginBottom: 14 }}>
                    Juegas con el equipo <b style={{ color: '#ef4444' }}>rojo</b> y atacas hacia la <b>derecha</b>. Tu jugador lleva un <b style={{ color: '#facc15' }}>aro amarillo</b>.
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {[{ k: false, t: '⌨️ Teclado' }, { k: true, t: '📱 Táctil' }].map(o => (
                        <button key={String(o.k)} onClick={() => setEsTactil(o.k)}
                            style={{ flex: 1, padding: '8px', borderRadius: 10, border: esTactil === o.k ? '2px solid #f1c40f' : '1.5px solid rgba(255,255,255,0.2)', background: esTactil === o.k ? 'rgba(241,196,15,0.18)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>{o.t}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(esTactil ? CONTROLES_TACTIL : CONTROLES_TECLADO).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '7px 10px' }}>
                            <div style={{ minWidth: esTactil ? 64 : 128, textAlign: 'center', flexShrink: 0 }}>
                                {esTactil
                                    ? <span style={{ display: 'inline-block', minWidth: 46, padding: '5px 8px', borderRadius: 20, background: c.c || 'transparent', fontWeight: 900, fontSize: c.c ? '0.72rem' : '1.4rem' }}>{c.b}</span>
                                    : <>{c.t.map(k => <span key={k} style={tecla}>{k}</span>)}{c.alt && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3 }}>{c.alt}</div>}</>}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{c.d}</div>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '8px 12px', fontSize: '0.85rem', color: '#fde68a' }}>
                    ⚡ Acierta preguntas (antes de cada saque o con <b>❓ Ganar ⚡</b>) para conseguir súper tiros. 3 aciertos seguidos = turbo.
                </div>
                <button onClick={onCerrar} autoFocus
                    style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer' }}>
                    {inicial ? '⚽ ¡A jugar!' : '▶ Volver al partido'}
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export default function Futbol3D({ config, pool, QuestionDisplay, EstilosPregunta, parseText, getCorrectAnswerText, onVolverInicio, onFin }) {
    const nombres = { red: config?.nombreRojo || 'Jugador', blue: 'Ordenador' };
    const golesParaGanar = config?.golesParaGanar || 3;
    const dificultad = config?.dificultad || 'normal';

    const hostRef = useRef(null);
    const motorRef = useRef(null);
    const inputRef = useRef({ x: 0, z: 0, sprint: false, tiro: false, pase: false, vaselina: false, super: false, cambio: false });
    const poolRef = useRef(pool?.length ? pool : generarPreguntasLibres());
    const idxRef = useRef(0);
    const timeoutsRef = useRef([]);
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timeoutsRef.current.push(id); return id; };

    const [score, setScore] = useState({ red: 0, blue: 0 });
    const scoreRef = useRef(score);
    const [cargas, setCargas] = useState(0);
    const cargasRef = useRef(0);
    const [stats, setStats] = useState({ aciertos: 0, fallos: 0 });
    const statsRef = useRef(stats);
    const rachaRef = useRef(0);
    const finRef = useRef(false);

    const [pregunta, setPregunta] = useState(null); // { data, motivo: 'SAQUE' | 'EXTRA', key }
    const [modalFase, setModalFase] = useState('RESPONDER');
    const [revealInfo, setRevealInfo] = useState(null);
    const [cuenta, setCuenta] = useState(null);
    const [golFlash, setGolFlash] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [turbo, setTurbo] = useState(false);
    const [ayuda, setAyuda] = useState('INICIO'); // 'INICIO' (antes del primer saque) | 'PARTIDO' (abierto con 🎮) | false
    const pausaAyudaRef = useRef(false);
    const avisoTimeoutRef = useRef(null);

    // Táctil solo si el puntero PRINCIPAL es un dedo (muchos portátiles con Windows declaran pantalla táctil
    // y con maxTouchPoints salían los mandos del móvil). Después se adapta a lo que se use de verdad.
    const [esTactil, setEsTactil] = useState(() => {
        try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) { return false; }
    });
    useEffect(() => {
        const onPointer = (e) => { if (e.pointerType === 'touch') setEsTactil(true); };
        const onKey = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            if (/^(w|a|s|d|j|k|l|e|q| |shift|arrow.*)$/.test(e.key.toLowerCase())) setEsTactil(false);
        };
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey); };
    }, []);

    const mostrarAviso = (txt) => {
        setAviso(txt);
        clearTimeout(avisoTimeoutRef.current);
        avisoTimeoutRef.current = setTimeout(() => setAviso(null), 1800);
    };

    const abrirPregunta = (motivo) => {
        const p = poolRef.current;
        const data = p[idxRef.current % p.length];
        idxRef.current += 1;
        setPregunta({ data, motivo, key: idxRef.current });
        setModalFase('RESPONDER');
        setRevealInfo(null);
        if (motivo === 'EXTRA') motorRef.current?.pausar(true);
    };

    const iniciarCuenta = () => {
        setCuenta(3);
        later(() => setCuenta(2), 700);
        later(() => setCuenta(1), 1400);
        later(() => { setCuenta('¡YA!'); playWhistle(); motorRef.current?.saque(); }, 2100);
        later(() => setCuenta(null), 2700);
    };

    const cerrarPregunta = (motivo) => {
        setPregunta(null);
        if (motivo === 'SAQUE') iniciarCuenta();
        else motorRef.current?.pausar(false);
    };

    const responder = (ok) => {
        if (!pregunta || modalFase === 'REVEAL') return;
        const motivo = pregunta.motivo;
        setModalFase('REVEAL');
        setRevealInfo({ ok, correctText: ok ? null : getCorrectAnswerText(pregunta.data) });
        safePlay(ok ? audioCorrect : audioWrong);
        const ns = { ...statsRef.current, [ok ? 'aciertos' : 'fallos']: statsRef.current[ok ? 'aciertos' : 'fallos'] + 1 };
        statsRef.current = ns; setStats(ns);
        if (ok) {
            cargasRef.current = Math.min(MAX_CARGAS, cargasRef.current + 1);
            setCargas(cargasRef.current);
            rachaRef.current += 1;
            if (rachaRef.current % 3 === 0) {
                motorRef.current?.turbo(10);
                setTurbo(true);
                later(() => setTurbo(false), 10000);
                later(() => mostrarAviso('🚀 ¡3 aciertos seguidos! Turbo 10 s'), 1100);
            }
        } else rachaRef.current = 0;
        later(() => cerrarPregunta(motivo), ok ? 1000 : 2200);
    };

    const saltarPregunta = () => { setPregunta(null); iniciarCuenta(); };

    // Callbacks del motor (se leen siempre frescos a través de la ref)
    const cbRef = useRef({});
    cbRef.current = {
        onGol: (team) => {
            safePlay(audioGoal);
            setGolFlash(team);
            later(() => setGolFlash(null), 2400);
            const n = { ...scoreRef.current, [team]: scoreRef.current[team] + 1 };
            scoreRef.current = n; setScore(n);
        },
        onFinCelebracion: (team) => {
            const sc = scoreRef.current;
            const ganador = sc.red >= golesParaGanar ? 'red' : sc.blue >= golesParaGanar ? 'blue' : null;
            if (ganador) {
                if (finRef.current) return;
                finRef.current = true;
                [0, 600, 1200].forEach(d => later(playWhistle, d));
                const s = statsRef.current;
                later(() => onFin({
                    ganador, nombres, golesParaGanar, score: { ...sc }, vsCPU: true, modo3D: true,
                    stats: {
                        red: { goles: sc.red, aciertos: s.aciertos, fallos: s.fallos },
                        blue: { goles: sc.blue, aciertos: 0, fallos: 0 },
                    },
                }), 1500);
                return;
            }
            motorRef.current?.prepararSaque(team === 'red' ? 'blue' : 'red');
            abrirPregunta('SAQUE');
        },
        usarCarga: () => {
            if (cargasRef.current <= 0) return false;
            cargasRef.current -= 1; setCargas(cargasRef.current);
            return true;
        },
        onAviso: mostrarAviso,
        onSuper: () => mostrarAviso('🔥 ¡SÚPER TIRO!'),
    };

    useEffect(() => {
        const m = montarMotor({ host: hostRef.current, dificultad, input: inputRef.current, cb: () => cbRef.current });
        motorRef.current = m;
        m.prepararSaque('red');
        const timeouts = timeoutsRef.current;
        return () => {
            m.destroy();
            motorRef.current = null;
            timeouts.forEach(clearTimeout);
            clearTimeout(avisoTimeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pantalla completa
    const [isFs, setIsFs] = useState(false);
    useEffect(() => {
        const onFs = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
        document.addEventListener('fullscreenchange', onFs);
        document.addEventListener('webkitfullscreenchange', onFs);
        return () => { document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs); };
    }, []);
    const toggleFullscreen = () => {
        try {
            if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
                const el = document.documentElement;
                (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
            } else (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        } catch (e) { }
    };

    const abrirControles = () => {
        if (ayuda || pregunta) return;
        pausaAyudaRef.current = !!motorRef.current?.enJuego();
        if (pausaAyudaRef.current) motorRef.current.pausar(true);
        setAyuda('PARTIDO');
    };
    const cerrarControles = () => {
        const inicial = ayuda === 'INICIO';
        setAyuda(false);
        if (inicial) abrirPregunta('SAQUE');
        else if (pausaAyudaRef.current) { pausaAyudaRef.current = false; motorRef.current?.pausar(false); }
    };

    const pedirExtra = () => {
        if (pregunta || cuenta !== null || cargasRef.current >= MAX_CARGAS) return;
        if (!motorRef.current?.enJuego()) return;
        abrirPregunta('EXTRA');
    };
    const extraDisabled = !!pregunta || cuenta !== null || cargas >= MAX_CARGAS || !!golFlash;
    const teamColor = (t) => t === 'red' ? '#ef4444' : '#3b82f6';
    const btnTop = { background: 'rgba(15,23,42,0.7)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', fontFamily: 'system-ui, sans-serif', userSelect: 'none', touchAction: 'none', overflow: 'hidden' }}>
            <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

            {/* Barra superior */}
            <div style={{ position: 'absolute', top: 'max(8px, env(safe-area-inset-top))', left: 8, right: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, zIndex: 20, pointerEvents: 'none' }}>
                <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
                    <button onClick={onVolverInicio} style={btnTop}>← Menú</button>
                    <button onClick={abrirControles} style={btnTop} title="Controles">🎮</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 3vw, 22px)', background: 'rgba(15,23,42,0.88)', padding: '5px clamp(12px, 4vw, 26px)', borderRadius: 30, border: '2px solid #334155', boxShadow: '0 4px 18px rgba(0,0,0,0.5)' }}>
                        <div style={{ textAlign: 'center', maxWidth: 100 }}>
                            <div style={{ fontSize: 'clamp(9px, 2.4vw, 12px)', color: '#fca5a5', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombres.red}</div>
                            <div style={{ fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>{score.red}</div>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 'clamp(10px, 2.5vw, 13px)', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>⚽<br /><span style={{ fontSize: '0.75em' }}>a {golesParaGanar}</span></div>
                        <div style={{ textAlign: 'center', maxWidth: 100 }}>
                            <div style={{ fontSize: 'clamp(9px, 2.4vw, 12px)', color: '#93c5fd', fontWeight: 700 }}>🤖 {nombres.blue}</div>
                            <div style={{ fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{score.blue}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
                        <div title="Cargas de súper tiro" style={{ display: 'flex', gap: 3, background: 'rgba(15,23,42,0.8)', borderRadius: 20, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)' }}>
                            {Array.from({ length: MAX_CARGAS }).map((_, i) => (
                                <span key={i} style={{ fontSize: '1.05rem', filter: i < cargas ? 'none' : 'grayscale(1) opacity(0.3)', transition: 'filter 0.3s' }}>⚡</span>
                            ))}
                        </div>
                        <button onClick={pedirExtra} disabled={extraDisabled}
                            style={{ background: extraDisabled ? 'rgba(71,85,105,0.7)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', border: 'none', borderRadius: 20, padding: '6px 12px', fontWeight: 800, fontSize: '0.8rem', cursor: extraDisabled ? 'default' : 'pointer', boxShadow: extraDisabled ? 'none' : '0 3px 10px rgba(217,119,6,0.5)' }}>
                            ❓ Ganar ⚡
                        </button>
                        {turbo && <span style={{ background: '#0891b2', color: 'white', borderRadius: 20, padding: '4px 10px', fontWeight: 800, fontSize: '0.78rem' }}>🚀 TURBO</span>}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
                    <span style={{ ...btnTop, cursor: 'default', color: '#cbd5e1' }}>✓{stats.aciertos} ✗{stats.fallos}</span>
                    <button onClick={toggleFullscreen} style={btnTop} title="Pantalla completa">{isFs ? '🗗' : '⛶'}</button>
                </div>
            </div>

            {/* Controles: al empezar y con el botón 🎮 */}
            {ayuda && <PanelControles esTactil={esTactil} setEsTactil={setEsTactil} inicial={ayuda === 'INICIO'} onCerrar={cerrarControles} />}

            {esTactil && <ControlesTactiles inputRef={inputRef} />}

            {/* Avisos */}
            {aviso && (
                <div style={{ position: 'absolute', top: '24%', left: '50%', transform: 'translateX(-50%)', zIndex: 25, background: 'rgba(15,23,42,0.88)', color: '#fde68a', padding: '8px 18px', borderRadius: 20, fontWeight: 800, fontSize: 'clamp(0.85rem, 3vw, 1.1rem)', pointerEvents: 'none', whiteSpace: 'nowrap' }}><div key={aviso} style={{ animation: 'f3dPop 0.25s ease' }}>{aviso}</div></div>
            )}

            {/* Gol */}
            {golFlash && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${teamColor(golFlash)}22`, pointerEvents: 'none' }}>
                    <div style={{ fontSize: 'clamp(2.4rem, 11vw, 6rem)', fontWeight: 900, color: teamColor(golFlash), textShadow: '0 4px 18px rgba(0,0,0,0.7)', animation: 'f3dPop 0.5s ease' }}>⚽ ¡GOOOL!</div>
                </div>
            )}

            {/* Cuenta atrás */}
            {cuenta !== null && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div key={cuenta} style={{ fontSize: 'clamp(3rem, 14vw, 7rem)', fontWeight: 900, color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,0.7)', animation: 'f3dPop 0.4s ease' }}>{cuenta}</div>
                </div>
            )}

            {/* Pregunta */}
            {pregunta && (
                <div className="fq-modal-backdrop" style={{ zIndex: 40 }}>
                    <EstilosPregunta />
                    <div className="fq-modal-hud" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span className="fq-team-chip" style={{ background: '#d97706' }}>⚡ Acierta y gana un súper tiro</span>
                        <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{pregunta.motivo === 'SAQUE' ? 'Antes del saque' : 'Partido en pausa'}</span>
                    </div>
                    {modalFase === 'REVEAL' && revealInfo ? (
                        <div className="question-card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem' }}>{revealInfo.ok ? '✅' : '❌'}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: 10, color: revealInfo.ok ? '#2ecc71' : '#e74c3c' }}>{revealInfo.ok ? '¡Correcto! +1 ⚡' : 'Incorrecto'}</div>
                            {revealInfo.correctText && (
                                <>
                                    <div style={{ color: '#ccc', fontSize: '0.95rem' }}>La respuesta correcta era:</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#f1c40f', marginTop: 8 }}>{parseText(revealInfo.correctText)}</div>
                                </>
                            )}
                        </div>
                    ) : (
                        <QuestionDisplay key={pregunta.key} data={pregunta.data} onAnswer={responder} disabled={modalFase === 'REVEAL'} feedback={null} />
                    )}
                    {modalFase === 'RESPONDER' && (
                        <button onClick={pregunta.motivo === 'SAQUE' ? saltarPregunta : () => cerrarPregunta('EXTRA')}
                            style={{ marginTop: 16, background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}>
                            {pregunta.motivo === 'SAQUE' ? 'Saltar y jugar ▶' : 'Volver al partido ▶'}
                        </button>
                    )}
                </div>
            )}

            <style>{`@keyframes f3dPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </div>
    );
}
