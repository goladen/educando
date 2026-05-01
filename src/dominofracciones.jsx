// DominoMatematico.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Play, Clock, AlertCircle, RotateCcw, ShieldAlert, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { generarFichas, MODOS_DOMINO } from './fichasdomino';

const COLORES_J = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

// ─── Sonidos via Web Audio API ────────────────────────────────────────────────
function useAudio() {
    const ctx = useRef(null);
    const getCtx = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
        return ctx.current;
    };

    const playTone = (freqs, duration, type = 'sine', vol = 0.3) => {
        try {
            const ac = getCtx();
            freqs.forEach(({ f, t, d }) => {
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.connect(gain);
                gain.connect(ac.destination);
                osc.type = type;
                osc.frequency.setValueAtTime(f, ac.currentTime + t);
                gain.gain.setValueAtTime(vol, ac.currentTime + t);
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + d);
                osc.start(ac.currentTime + t);
                osc.stop(ac.currentTime + t + d);
            });
        } catch (_) {}
    };

    return {
        acierto: () => playTone([
            { f: 523, t: 0,    d: 0.12 },
            { f: 659, t: 0.1,  d: 0.12 },
            { f: 784, t: 0.2,  d: 0.25 },
        ], 0.5, 'sine', 0.28),

        error: () => playTone([
            { f: 320, t: 0,    d: 0.15 },
            { f: 220, t: 0.12, d: 0.15 },
            { f: 160, t: 0.24, d: 0.25 },
        ], 0.5, 'sawtooth', 0.2),

        cambioTurno: () => playTone([
            { f: 440, t: 0,    d: 0.1 },
            { f: 440, t: 0.15, d: 0.1 },
        ], 0.3, 'sine', 0.18),

        victoria: () => {
            const notes = [523, 659, 784, 1047];
            notes.forEach((f, i) => playTone([{ f, t: i * 0.12, d: 0.3 }], 0.5, 'sine', 0.25));
        },
    };
}

export default function DominoMatematico({ onExit }) {
    const audio = useAudio();

    const [pantalla, setPantalla] = useState('SETUP');
    const [modo, setModo] = useState('NATURALES');
    const [numJ, setNumJ] = useState(2);
    const [tiempo, setTiempo] = useState(30);
    const [nombres, setNombres] = useState(['', '', '', '']);
    const [showReglas, setShowReglas] = useState(false);

    const [jugadores, setJugadores] = useState([]);
    const [pozo, setPozo] = useState([]);
    const [tablero, setTablero] = useState([]);
    const [turno, setTurno] = useState(0);
    const [fichaSeleccionada, setFichaSeleccionada] = useState(null);

    const [timeLeft, setTimeLeft] = useState(0);
    const [mensajeError, setMensajeError] = useState('');
    const timerRef = useRef(null);

    const [extremoIzq, setExtremoIzq] = useState(null);
    const [extremoDer, setExtremoDer] = useState(null);

    const [ganador, setGanador] = useState(null);

    const iniciarJuego = () => {
        const todasLasFichas = generarFichas(modo);
        let nuevosJugadores = [];
        let indexFicha = 0;
        for (let i = 0; i < numJ; i++) {
            nuevosJugadores.push({
                id: i,
                nombre: nombres[i].trim() || `Jugador ${i + 1}`,
                color: COLORES_J[i],
                fichas: todasLasFichas.slice(indexFicha, indexFicha + 7)
            });
            indexFicha += 7;
        }
        setPozo(todasLasFichas.slice(indexFicha));
        setJugadores(nuevosJugadores);
        setTablero([]);
        setExtremoIzq(null);
        setExtremoDer(null);
        setTurno(0);
        setMensajeError('');
        setGanador(null);
        setPantalla('ESCONDIDO');
    };

    const iniciarTurno = () => {
        setPantalla('PLAYING');
        setTimeLeft(tiempo);
        setFichaSeleccionada(null);
        setMensajeError('');
    };

    useEffect(() => {
        if (pantalla !== 'PLAYING') return;
        if (timeLeft <= 0) {
            handlePenalizacion('¡Tiempo agotado! Pierdes el turno.');
            return;
        }
        timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timeLeft, pantalla]);

    const pasarTurnoNormal = (nuevosJugadores = jugadores) => {
        const ganadorEncontrado = nuevosJugadores.find(j => j.fichas.length === 0);
        if (ganadorEncontrado) {
            setGanador(ganadorEncontrado);
            setJugadores(nuevosJugadores);
            audio.victoria();
            setPantalla('FIN');
            return;
        }
        setJugadores(nuevosJugadores);
        setTurno(t => (t + 1) % numJ);
        audio.cambioTurno();
        setPantalla('ESCONDIDO');
    };

    const handlePenalizacion = (mensaje) => {
        setMensajeError(mensaje);
        clearTimeout(timerRef.current);
        setTimeout(() => {
            setMensajeError('');
            pasarTurnoNormal();
        }, 2500);
    };

    const intentarColocar = (lado) => {
        if (!fichaSeleccionada) return;
        const jActual = jugadores[turno];
        let esValido = false;
        let fichaVolteada = false;

        if (tablero.length === 0) {
            esValido = true;
            setExtremoIzq(fichaSeleccionada.valA);
            setExtremoDer(fichaSeleccionada.valB);
        } else {
            const targetVal = lado === 'IZQ' ? extremoIzq : extremoDer;
            if (fichaSeleccionada.valB === targetVal) { esValido = true; fichaVolteada = lado === 'DER'; }
            else if (fichaSeleccionada.valA === targetVal) { esValido = true; fichaVolteada = lado === 'IZQ'; }
        }

        if (esValido) {
            audio.acierto();
            const nuevaFichaTablero = { ...fichaSeleccionada, flipped: fichaVolteada };
            let nuevoTablero = [...tablero];
            if (lado === 'IZQ' || tablero.length === 0) {
                nuevoTablero.unshift(nuevaFichaTablero);
                if (tablero.length > 0) setExtremoIzq(fichaVolteada ? fichaSeleccionada.valB : fichaSeleccionada.valA);
            } else {
                nuevoTablero.push(nuevaFichaTablero);
                if (tablero.length > 0) setExtremoDer(fichaVolteada ? fichaSeleccionada.valA : fichaSeleccionada.valB);
            }
            const nuevasFichasMano = jActual.fichas.filter(f => f.id !== fichaSeleccionada.id);
            const nuevosJugadores = jugadores.map((j, i) => i === turno ? { ...j, fichas: nuevasFichasMano } : j);
            setTablero(nuevoTablero);
            pasarTurnoNormal(nuevosJugadores);
        } else {
            audio.error();
            handlePenalizacion('¡Error! Esta ficha no encaja con el resultado matemático. Pierdes el turno.');
        }
    };

    // Al pasar turno: roba una ficha aleatoria del pozo si queda alguna
    const handlePasarTurno = () => {
        clearTimeout(timerRef.current);
        if (pozo.length > 0) {
            const idx = Math.floor(Math.random() * pozo.length);
            const nuevaFicha = pozo[idx];
            const nuevoPozo = pozo.filter((_, i) => i !== idx);
            const nuevosJugadores = jugadores.map((j, i) =>
                i === turno ? { ...j, fichas: [...j.fichas, nuevaFicha] } : j
            );
            setPozo(nuevoPozo);
            pasarTurnoNormal(nuevosJugadores);
        } else {
            pasarTurnoNormal();
        }
    };

    // ─── RENDER: SETUP ────────────────────────────────────────────────────────────
    if (pantalla === 'SETUP') {
        return (
            <div style={{ minHeight: '100vh', background: '#1a2a4a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, fontFamily: "'Segoe UI',sans-serif", color: 'white' }}>
                <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>← Volver</button>
                    <button onClick={() => {
                        const url = 'https://pikt.es/?juego=DOMINO';
                        if (navigator.share) navigator.share({ title: 'Dominó Matemático', text: '¡Echa una partida al Dominó Matemático!', url }).catch(() => {});
                        else navigator.clipboard.writeText(url).then(() => alert('✅ Enlace copiado'));
                    }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Share2 size={16} /> Compartir
                    </button>
                </div>

                <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Título */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 20, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 6 }}>🁣</div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Dominó Matemático</h1>
                        <p style={{ margin: '8px 0 0', opacity: 0.7, fontSize: '0.9rem' }}>Un dominó donde los extremos son operaciones y resultados</p>
                    </div>

                    {/* ¿Cómo se juega? */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                        <button
                            onClick={() => setShowReglas(v => !v)}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(241,196,15,0.15)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                        >
                            <span>📖 ¿Cómo se juega?</span>
                            {showReglas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {showReglas && (
                            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[
                                    { icon: '🃏', text: 'Se reparten 7 fichas a cada jugador. El resto forma el pozo.' },
                                    { icon: '🔗', text: 'Cada ficha tiene dos mitades: una operación matemática y un resultado. Los extremos del tablero deben coincidir en valor para poder colocar.' },
                                    { icon: '⏱️', text: 'Cada turno tienes un tiempo limitado para seleccionar una ficha y elegir en qué extremo del tablero la colocas (izquierda o derecha).' },
                                    { icon: '✅', text: 'Si la ficha encaja (el valor matemático coincide con el extremo), se coloca y pasa el turno.' },
                                    { icon: '❌', text: 'Si la ficha no encaja o se acaba el tiempo, ¡pierdes el turno!' },
                                    { icon: '📦', text: 'Si no puedes o no quieres jugar, pulsa "Pasar turno": recibirás automáticamente una ficha aleatoria del pozo (si queda alguna).' },
                                    { icon: '🁣', text: 'Las fichas dobles (mismo valor en ambas mitades) se colocan en vertical sobre el tablero.' },
                                    { icon: '🏆', text: '¡Gana el primero en quedarse sin fichas!' },
                                ].map((paso, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: 1 }}>{paso.icon}</span>
                                        <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.85, lineHeight: 1.5 }}>{paso.text}</p>
                                    </div>
                                ))}
                                <div style={{ marginTop: 4, padding: '10px 14px', background: 'rgba(241,196,15,0.12)', borderRadius: 10, border: '1px solid rgba(241,196,15,0.3)', fontSize: '0.82rem', opacity: 0.9 }}>
                                    💡 <b>Ejemplo:</b> Si el extremo del tablero muestra <b>4</b>, puedes colocar una ficha cuya mitad sea <b>2+2</b>, <b>8÷2</b> o el número <b>4</b> directamente.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Configuración */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>MODO DE JUEGO</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {MODOS_DOMINO.map(m => (
                                    <button key={m.id} onClick={() => setModo(m.id)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${modo === m.id ? m.color : 'rgba(255,255,255,0.2)'}`, background: modo === m.id ? `${m.color}33` : 'transparent', color: 'white', cursor: 'pointer', textAlign: 'left' }}>
                                        <div style={{ fontSize: '1.2rem' }}>{m.icon} {m.label}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{m.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', marginBottom: 10 }}>JUGADORES</div>
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {[2, 3, 4].map(n => <button key={n} onClick={() => setNumJ(n)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `2px solid ${numJ === n ? '#f1c40f' : '#555'}`, background: numJ === n ? '#f1c40f33' : 'transparent', color: 'white', cursor: 'pointer' }}>{n}</button>)}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', marginBottom: 10 }}>TIEMPO (seg)</div>
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {[20, 30, 45].map(t => <button key={t} onClick={() => setTiempo(t)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `2px solid ${tiempo === t ? '#e74c3c' : '#555'}`, background: tiempo === t ? '#e74c3c33' : 'transparent', color: 'white', cursor: 'pointer' }}>{t}</button>)}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>NOMBRES</div>
                            {Array.from({ length: numJ }, (_, i) => (
                                <input key={i} value={nombres[i]} onChange={e => setNombres(p => { const n = [...p]; n[i] = e.target.value; return n; })} placeholder={`Jugador ${i + 1}`} style={{ width: '100%', marginBottom: 10, padding: 10, borderRadius: 8, border: 'none', outline: 'none', boxSizing: 'border-box' }} />
                            ))}
                        </div>

                        <button onClick={iniciarJuego} style={{ width: '100%', padding: 15, background: '#f1c40f', border: 'none', borderRadius: 10, fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Play size={20} /> EMPEZAR JUEGO
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── RENDER: FIN ─────────────────────────────────────────────────────────────
    if (pantalla === 'FIN') {
        const winner = ganador || jugadores.find(j => j.fichas.length === 0) || jugadores[0];
        const clasificacion = [...jugadores].sort((a, b) => a.fichas.length - b.fichas.length);
        return (
            <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, #0f0c29, #302b63, #24243e)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI',sans-serif", color: 'white', padding: 20, textAlign: 'center' }}>
                <Confetti recycle={false} numberOfPieces={300} colors={[winner.color, '#f1c40f', '#fff', '#2ecc71']} />

                {/* Trofeo animado */}
                <div style={{ fontSize: '6rem', animation: 'bounce 0.8s ease infinite alternate', marginBottom: 8 }}>🏆</div>
                <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-14px); } }`}</style>

                {/* Nombre ganador */}
                <div style={{ background: winner.color, padding: '6px 28px', borderRadius: 40, fontSize: '0.85rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, opacity: 0.9 }}>¡GANADOR!</div>
                <h1 style={{ fontSize: '3rem', margin: '0 0 6px', textShadow: `0 0 30px ${winner.color}` }}>{winner.nombre}</h1>
                <p style={{ opacity: 0.7, margin: '0 0 32px' }}>Se quedó sin fichas primero 🎉</p>

                {/* Clasificación */}
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 24px', marginBottom: 28, width: '100%', maxWidth: 340 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 12, opacity: 0.6, fontSize: '0.8rem', letterSpacing: 1, textTransform: 'uppercase' }}>Clasificación final</div>
                    {clasificacion.map((j, i) => (
                        <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < clasificacion.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                            <span style={{ fontSize: '1.4rem', width: 28, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: j.color, flexShrink: 0 }} />
                                <span style={{ fontWeight: j.id === winner.id ? 700 : 400 }}>{j.nombre}</span>
                            </div>
                            <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                                {j.fichas.length === 0 ? '✅ Sin fichas' : `${j.fichas.length} ficha${j.fichas.length !== 1 ? 's' : ''}`}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setPantalla('SETUP')} style={{ padding: '12px 24px', background: '#f1c40f', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RotateCcw size={18} /> Volver a Jugar
                    </button>
                    <button onClick={onExit} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 12, fontSize: '1rem', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        Salir
                    </button>
                </div>
            </div>
        );
    }

    const jActual = jugadores[turno];

    // ─── RENDER: ESCONDIDO ────────────────────────────────────────────────────────
    if (pantalla === 'ESCONDIDO') {
        return (
            <div style={{ minHeight: '100vh', background: '#1a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: 20 }}>
                <div style={{ background: jActual.color, padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: 400 }}>
                    <ShieldAlert size={60} style={{ marginBottom: 20 }} />
                    <h2 style={{ fontSize: '2rem', margin: 0 }}>Turno de {jActual.nombre}</h2>
                    <p style={{ fontSize: '1.1rem', margin: '20px 0' }}>Pasa el dispositivo. ¡Asegúrate de que nadie más mire la pantalla!</p>
                    <button onClick={iniciarTurno} style={{ padding: '15px 30px', fontSize: '1.2rem', borderRadius: 10, cursor: 'pointer', background: 'white', color: jActual.color, border: 'none', fontWeight: 'bold' }}>
                        👀 Mostrar mis fichas
                    </button>
                </div>
            </div>
        );
    }

    // ─── RENDER: PLAYING ─────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#1a2a4a', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI',sans-serif", color: 'white' }}>

            <div style={{ padding: 15, background: jActual.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Turno: {jActual.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft <= 5 ? '#fff' : 'inherit', background: timeLeft <= 5 ? 'rgba(0,0,0,0.25)' : 'transparent', borderRadius: 8, padding: '4px 10px', transition: 'background 0.3s' }}>
                    <Clock size={18} /> {timeLeft}s
                </div>
            </div>

            {mensajeError && (
                <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: '#e74c3c', padding: '15px 25px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, zIndex: 50, fontWeight: 'bold', boxShadow: '0 5px 15px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
                    <AlertCircle size={20} /> {mensajeError}
                </div>
            )}

            <div style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', overflowX: 'auto', background: 'rgba(0,0,0,0.2)' }}>
                {tablero.length === 0 ? (
                    <div style={{ margin: 'auto', opacity: 0.5, fontSize: '1.5rem' }}>El tablero está vacío. Coloca tu primera ficha.</div>
                ) : (
                    <div style={{ display: 'flex', gap: 4, margin: 'auto', padding: '0 20px', alignItems: 'center' }}>
                        {tablero.map((ficha, idx) => ficha.isDouble ? (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', background: '#ecf0f1', color: '#2c3e50', borderRadius: 6, border: '2px solid #95a5a6', overflow: 'hidden', width: 52, height: 80, fontWeight: 'bold', flexShrink: 0 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px', borderBottom: '2px solid #bdc3c7', fontSize: '0.75rem', textAlign: 'center' }}>
                                    {ficha.flipped ? ficha.textB : ficha.textA}
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center' }}>
                                    {ficha.flipped ? ficha.textA : ficha.textB}
                                </div>
                            </div>
                        ) : (
                            <div key={idx} style={{ display: 'flex', background: '#ecf0f1', color: '#2c3e50', borderRadius: 6, border: '2px solid #bdc3c7', overflow: 'hidden', minWidth: 100, height: 50, fontWeight: 'bold', flexShrink: 0 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', borderRight: '2px solid #bdc3c7', fontSize: '0.85rem' }}>
                                    {ficha.flipped ? ficha.textB : ficha.textA}
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontSize: '0.85rem' }}>
                                    {ficha.flipped ? ficha.textA : ficha.textB}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: 20, background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 15, marginBottom: 15, minHeight: 45 }}>
                    {fichaSeleccionada && tablero.length > 0 && (
                        <>
                            <button onClick={() => intentarColocar('IZQ')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#3498db', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><ArrowLeft size={18} /> Izquierda</button>
                            <button onClick={() => intentarColocar('DER')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#9b59b6', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>Derecha <ArrowRight size={18} /></button>
                        </>
                    )}
                    {fichaSeleccionada && tablero.length === 0 && (
                        <button onClick={() => intentarColocar('IZQ')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2ecc71', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Poner primera ficha</button>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginBottom: 10, fontSize: '0.9rem', opacity: 0.8 }}>TUS FICHAS — selecciona una:</div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
                    {jActual.fichas.map(ficha => {
                        const sel = fichaSeleccionada?.id === ficha.id;
                        const base = { background: sel ? '#f1c40f' : 'white', color: '#111', borderRadius: 8, border: sel ? '3px solid #e67e22' : '3px solid #ccc', cursor: 'pointer', padding: 0, overflow: 'hidden', transform: sel ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.1s, border-color 0.1s' };
                        if (ficha.isDouble) return (
                            <button key={ficha.id} onClick={() => setFichaSeleccionada(ficha)}
                                style={{ ...base, display: 'flex', flexDirection: 'column', width: 52, height: 72 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px', borderBottom: `2px solid ${sel ? '#e67e22' : '#ccc'}`, fontWeight: 'bold', fontSize: '0.78rem', textAlign: 'center' }}>{ficha.textA}</div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px', fontWeight: 'bold', fontSize: '0.78rem', textAlign: 'center' }}>{ficha.textB}</div>
                            </button>
                        );
                        return (
                            <button key={ficha.id} onClick={() => setFichaSeleccionada(ficha)}
                                style={{ ...base, display: 'flex', minWidth: 110, height: 55 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', borderRight: `2px solid ${sel ? '#e67e22' : '#ccc'}`, fontWeight: 'bold', fontSize: '0.85rem' }}>{ficha.textA}</div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontWeight: 'bold', fontSize: '0.85rem' }}>{ficha.textB}</div>
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button onClick={handlePasarTurno} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#7f8c8d', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                        Pasar turno{pozo.length > 0 ? ` (+1 del pozo)` : ''}
                    </button>
                </div>

            </div>
        </div>
    );
}
