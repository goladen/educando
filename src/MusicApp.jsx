import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { PASOS, NOTAS, NOTAS_STAFF, INSTRUMENTOS_SEQ, playTone } from './musicUtils';
import CreadorRitmosColab from './CreadorRitmosColab';
import EarTrainingGame from './MusicCompass';
import MusicaInstrumentos from './MusicaInstrumentos';
const PizarraMusical = lazy(() => import('./GestionAula').then(m => ({ default: m.PizarraApp })));
import { db } from './firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

// ─── Hub ─────────────────────────────────────────────────────────────────────

export default function MusicApp({ onBack, usuario = null }) {
    const [app, setApp] = useState(null);
    const [sesionMusical, setSesionMusical] = useState([]);
    const [modalEnviar, setModalEnviar] = useState(false);
    const [mNombre, setMNombre] = useState('');
    const [mCurso, setMCurso] = useState('');
    const [mCodigo, setMCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);

    const agregarPartida = (partida) => {
        setSesionMusical(prev => [...prev, { ...partida, _id: Date.now() }]);
    };

    const enviarAlProfesor = async () => {
        if (!mNombre.trim()) { alert('Introduce tu nombre'); return; }
        const cod = mCodigo.trim().toUpperCase();
        if (cod.length < 3) { alert('Introduce el código de tu profesor'); return; }
        if (sesionMusical.length === 0) { alert('No hay partidas guardadas en la sesión'); return; }
        setEnviando(true);
        try {
            const codigoSnap = await getDoc(doc(db, 'codigos_profesor', cod));
            if (!codigoSnap.exists()) { alert('Código de profesor no encontrado. Pídelo a tu profe.'); setEnviando(false); return; }
            const totalPuntos = sesionMusical.reduce((s, p) => s + (p.puntos || 0), 0);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'MUSIC_GAMES',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: cod,
                jugadores: [{
                    nombre: mNombre.trim(),
                    curso: mCurso.trim(),
                    puntos: totalPuntos,
                    partidas: sesionMusical.map(p => ({
                        juego: p.juego, emoji: p.emoji, puntos: p.puntos,
                        ...(p.nivel !== undefined ? { nivel: p.nivel } : {}),
                    })),
                }],
            });
            alert(`✅ Sesión enviada al profesor. ${sesionMusical.length} partida(s) incluidas.`);
            setSesionMusical([]);
            setModalEnviar(false);
            setMNombre(''); setMCurso(''); setMCodigo('');
        } catch (e) { alert('Error al enviar: ' + e.message); }
        setEnviando(false);
    };

    if (app === 'lluvia')  return <LluviaDeNotas onBack={() => setApp(null)} onPartidaTerminada={agregarPartida} />;
    if (app === 'simon')   return <SimonDiceMusical onBack={() => setApp(null)} onPartidaTerminada={agregarPartida} />;
    if (app === 'ritmos')  return <CreadorDeRitmos onBack={() => setApp(null)} usuario={usuario} />;
    if (app === 'colab')   return <CreadorRitmosColab onBack={() => setApp(null)} usuario={usuario} />;
    if (app === 'compass') return <EarTrainingGame onBack={() => setApp(null)} />;
    if (app === 'instrumentos') return <MusicaInstrumentos onBack={() => setApp(null)} />;
    if (app === 'pizarra') return (
        <div style={{ minHeight: '100vh', background: '#fce4ec', padding: '14px 12px', boxSizing: 'border-box' }}>
            <button onClick={() => setApp(null)} style={{ ...s.backBtn, marginBottom: 14, background: 'white', color: '#333', border: '1px solid #ccc' }}>← Volver</button>
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#7f8c8d' }}>Cargando pizarra…</div>}>
                <PizarraMusical initialModo="musica" />
            </Suspense>
        </div>
    );

    const APPS_MUSICA = [
        { id: 'instrumentos', titulo: 'Instrumentos',          desc: 'Toca piano, xilófono, batería y guitarra realista. Multitáctil para móvil y pizarra.', emoji: '🎸', color: '#ef4444' },
        { id: 'pizarra',  titulo: 'Pizarra musical',           desc: 'Pizarra interactiva con pentagramas, notas, silencios y alteraciones para escribir música.', emoji: '🎼', color: '#3b82f6' },
        { id: 'lluvia',   titulo: 'Lluvia de Notas',          desc: 'Lee la nota en el pentagrama y responde antes de que se acabe el tiempo.', emoji: '🎼', color: '#6366f1' },
        { id: 'simon',    titulo: 'Simón Dice Musical',       desc: 'Escucha y repite la secuencia musical. ¿Cuántos niveles puedes superar?',   emoji: '🎹', color: '#10b981' },
        { id: 'ritmos',   titulo: 'Creador de Ritmos',        desc: 'Programa tu propio beat con bombo, caja, hi-hat y melodía.',                emoji: '🥁', color: '#f59e0b' },
        { id: 'colab',    titulo: 'Ritmos Colaborativos',     desc: 'Cread un beat entre varios. Cada uno añade su parte por turnos.',           emoji: '🎶', color: '#8b5cf6' },
        { id: 'compass',  titulo: 'Entrenamiento Auditivo',   desc: 'Escucha una secuencia rítmica e identifica qué figuras la componen.',       emoji: '🎧', color: '#fb7185' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f2e 0%, #1a1040 100%)', padding: '24px 16px', fontFamily: 'inherit' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
                <button onClick={onBack} style={s.backBtn}>← Volver</button>

                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{ fontSize: 52, marginBottom: 8 }}>🎵</div>
                    <h1 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.8rem', fontWeight: 800 }}>Música</h1>
                    <p style={{ color: '#94a3b8', margin: '8px 0 0', fontSize: '0.95rem' }}>Elige una actividad</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {APPS_MUSICA.map(a => (
                        <button key={a.id} onClick={() => setApp(a.id)}
                            style={{ background: 'rgba(255,255,255,0.06)', border: `2px solid ${a.color}40`, borderRadius: 16, padding: '20px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 18, textAlign: 'left', width: '100%' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${a.color}20`; e.currentTarget.style.borderColor = a.color; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = `${a.color}40`; }}
                        >
                            <div style={{ fontSize: 36, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${a.color}20`, borderRadius: 12, flexShrink: 0 }}>
                                {a.emoji}
                            </div>
                            <div>
                                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.05rem', marginBottom: 4 }}>{a.titulo}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.4 }}>{a.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ── Sesión acumulada ─────────────────────────────────── */}
                {sesionMusical.length > 0 && (
                    <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px', border: '1.5px solid rgba(124,58,237,0.4)' }}>
                        <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '0.88rem', letterSpacing: 0.5, marginBottom: 14 }}>🎵 SESIÓN ACTUAL</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                            {sesionMusical.map((p) => (
                                <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 10 }}>
                                    <span style={{ fontSize: 20 }}>{p.emoji}</span>
                                    <span style={{ color: '#cbd5e1', fontSize: '0.88rem', flex: 1 }}>{p.juego}</span>
                                    {p.nivel !== undefined && (
                                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Niv. {p.nivel}</span>
                                    )}
                                    <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.95rem', minWidth: 46, textAlign: 'right' }}>{p.puntos} pts</span>
                                    <button onClick={() => setSesionMusical(prev => prev.filter(x => x._id !== p._id))}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                            <div style={{ color: '#f1f5f9', fontWeight: 700 }}>
                                Total: <span style={{ color: '#a78bfa', fontSize: '1.1rem' }}>{sesionMusical.reduce((s, p) => s + (p.puntos || 0), 0)} pts</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setSesionMusical([])}
                                    style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
                                    🗑 Limpiar
                                </button>
                                <button onClick={() => setModalEnviar(true)}
                                    style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(124,58,237,0.45)' }}>
                                    📤 Enviar al Profesor
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal enviar al profesor ─────────────────────────────── */}
            {modalEnviar && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
                    <div style={{ background: '#1e1b4b', borderRadius: 18, padding: 28, width: '100%', maxWidth: 390, border: '1.5px solid rgba(167,139,250,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                        <h3 style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700 }}>📤 Enviar al Profesor</h3>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.82rem', marginBottom: 5 }}>Tu nombre *</label>
                            <input value={mNombre} onChange={e => setMNombre(e.target.value)} placeholder="Ej: Ana García"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.82rem', marginBottom: 5 }}>Curso (opcional)</label>
                            <input value={mCurso} onChange={e => setMCurso(e.target.value)} placeholder="Ej: 5ºA"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.82rem', marginBottom: 5 }}>Código del Profesor *</label>
                            <input value={mCodigo} onChange={e => setMCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 2 }} />
                        </div>
                        {/* Resumen sesión */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: '0.82rem' }}>
                            <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 8 }}>Resumen — {sesionMusical.length} partida(s)</div>
                            {sesionMusical.map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', padding: '3px 0' }}>
                                    <span>{p.emoji} {p.juego}{p.nivel !== undefined ? ` (Niv. ${p.nivel})` : ''}</span>
                                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>{p.puntos} pts</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 8, fontWeight: 700, color: '#f1f5f9' }}>
                                <span>Total</span>
                                <span style={{ color: '#a78bfa' }}>{sesionMusical.reduce((s, p) => s + (p.puntos || 0), 0)} pts</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setModalEnviar(false)}
                                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                Cancelar
                            </button>
                            <button onClick={enviarAlProfesor} disabled={enviando}
                                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#4c1d95' : '#7c3aed', color: 'white', cursor: enviando ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Pentagrama SVG ───────────────────────────────────────────────────────────

function Pentagrama({ nota, flash }) {
    const LINES = [20, 32, 44, 56, 68];
    const nd    = NOTAS_STAFF.find(n => n.nombre === nota?.nombre);
    const fill  = flash === 'error' ? '#ef4444' : flash === 'ok' ? '#22c55e' : '#1e293b';

    return (
        <svg width="100%" viewBox="0 0 320 100"
            style={{ background: '#fffef5', borderRadius: 12, display: 'block', maxWidth: 420, margin: '0 auto' }}>
            {/* Treble clef */}
            <text x="12" y="77" fontSize="64" fontFamily="'Times New Roman', Georgia, serif" fill="#334155">𝄞</text>

            {/* Staff lines */}
            {LINES.map(y => <line key={y} x1="10" y1={y} x2="308" y2={y} stroke="#475569" strokeWidth="1.5" />)}

            {/* Right barline */}
            <line x1="308" y1="20" x2="308" y2="68" stroke="#475569" strokeWidth="2.5" />

            {/* Ledger line for Do (below staff) */}
            {nd?.ledger && <line x1="148" y1="80" x2="174" y2="80" stroke="#475569" strokeWidth="1.5" />}

            {/* Note head */}
            {nd && (
                <ellipse cx="160" cy={nd.y} rx="10" ry="7.5"
                    fill={fill}
                    transform={`rotate(-20,160,${nd.y})`}
                    style={{ transition: 'fill 0.15s' }}
                />
            )}
        </svg>
    );
}

// ─── 1. LLUVIA DE NOTAS ──────────────────────────────────────────────────────

function LluviaDeNotas({ onBack, onPartidaTerminada }) {
    const [estado,   setEstado]   = useState('inicio');
    const [nota,     setNota]     = useState(null);
    const [puntos,   setPuntos]   = useState(0);
    const [vidas,    setVidas]    = useState(3);
    const [tiempo,   setTiempo]   = useState(5);
    const [flash,    setFlash]    = useState(null);   // null | 'ok' | 'error'
    const [guardada, setGuardada] = useState(false);

    const bloqRef  = useRef(false);
    const vidasRef = useRef(3);

    const rnd = () => NOTAS_STAFF[Math.floor(Math.random() * NOTAS_STAFF.length)];

    const iniciar = () => {
        bloqRef.current  = false;
        vidasRef.current = 3;
        setVidas(3);
        setPuntos(0);
        setFlash(null);
        setNota(rnd());
        setTiempo(5);
        setEstado('playing');
        setGuardada(false);
    };

    const procesar = useCallback((acerto) => {
        if (bloqRef.current) return;
        bloqRef.current = true;

        if (acerto) {
            setPuntos(p => p + 1);
            setFlash('ok');
            setNota(cur => { playTone(NOTAS.find(n => n.nombre === cur?.nombre)?.freq || 523, 0.3); return cur; });
        } else {
            vidasRef.current -= 1;
            setVidas(vidasRef.current);
            setFlash('error');
            playTone(130, 0.45, 'sawtooth', 0.2);
        }

        setTimeout(() => {
            if (!acerto && vidasRef.current <= 0) { setEstado('gameover'); return; }
            bloqRef.current = false;
            setFlash(null);
            setNota(rnd());
            setTiempo(5);
        }, acerto ? 350 : 700);
    }, []);

    // Countdown — pauses while flash is active
    useEffect(() => {
        if (estado !== 'playing' || flash !== null) return;
        if (tiempo <= 0) { procesar(false); return; }
        const id = setTimeout(() => setTiempo(t => t - 1), 1000);
        return () => clearTimeout(id);
    }, [estado, tiempo, flash, procesar]);

    if (estado === 'inicio') return (
        <GameScreen onBack={onBack} titulo="Lluvia de Notas" emoji="🎼" color="#6366f1">
            <p style={{ color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
                Identifica la nota que aparece en el pentagrama<br />
                antes de que se acabe el tiempo.<br /><br />
                Tienes <b style={{ color: '#f1f5f9' }}>3 vidas</b> y <b style={{ color: '#f1f5f9' }}>5 segundos</b> por nota.
            </p>
            <CenteredBtn onClick={iniciar} color="#6366f1">¡Empezar!</CenteredBtn>
        </GameScreen>
    );

    if (estado === 'gameover') return (
        <GameScreen onBack={onBack} titulo="¡Fin del juego!" emoji="🎼" color="#6366f1">
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
                <div style={{ fontSize: 60, marginBottom: 12 }}>🎖️</div>
                <div style={{ color: '#94a3b8', marginBottom: 6 }}>Puntuación final</div>
                <div style={{ color: '#6366f1', fontWeight: 800, fontSize: '2.4rem', marginBottom: 22 }}>{puntos}</div>
                {onPartidaTerminada && !guardada && (
                    <div style={{ marginBottom: 14 }}>
                        <button onClick={() => { onPartidaTerminada({ juego: 'Lluvia de Notas', emoji: '🎼', puntos }); setGuardada(true); }}
                            style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
                            ✓ Guardar en sesión
                        </button>
                    </div>
                )}
                {guardada && (
                    <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 14, fontSize: '0.9rem' }}>✓ Guardado en sesión</div>
                )}
                <CenteredBtn onClick={iniciar} color="#6366f1">Jugar de nuevo</CenteredBtn>
            </div>
        </GameScreen>
    );

    return (
        <GameScreen onBack={onBack} titulo="Lluvia de Notas" emoji="🎼" color="#6366f1">
            {/* HUD */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 18, letterSpacing: 2 }}>
                    {'❤️'.repeat(vidas)}{'🖤'.repeat(3 - vidas)}
                </div>
                <div style={{ color: '#6366f1', fontWeight: 700, fontSize: '1.05rem' }}>⭐ {puntos}</div>
            </div>

            {/* Timer bar */}
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 18, overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${(tiempo / 5) * 100}%`,
                    background: tiempo <= 1 ? '#ef4444' : tiempo <= 2 ? '#f97316' : '#6366f1',
                    borderRadius: 3,
                    transition: 'width 0.92s linear, background 0.3s',
                }} />
            </div>

            {/* Staff */}
            <div style={{
                marginBottom: 22,
                transform: flash === 'error' ? 'translateX(-5px)' : 'none',
                transition: 'transform 0.08s',
            }}>
                <Pentagrama nota={nota} flash={flash} />
            </div>

            {/* Answer buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {NOTAS.map(n => (
                    <button key={n.nombre}
                        onClick={() => procesar(n.nombre === nota?.nombre)}
                        style={{ padding: '12px 4px', background: n.color + '22', border: `2px solid ${n.color}`, borderRadius: 10, color: n.color, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = n.color; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = n.color + '22'; e.currentTarget.style.color = n.color; }}
                    >
                        {n.nombre}
                    </button>
                ))}
            </div>
        </GameScreen>
    );
}

// ─── 2. SIMÓN DICE MUSICAL ───────────────────────────────────────────────────

function SimonDiceMusical({ onBack, onPartidaTerminada }) {
    const [secuencia,  setSecuencia]  = useState([]);
    const [turno,      setTurno]      = useState('inicio');  // inicio | mostrando | alumno | ok | gameover
    const [paso,       setPaso]       = useState(0);
    const [iluminada,  setIluminada]  = useState(null);
    const [guardada,   setGuardada]   = useState(false);
    const tidsRef = useRef([]);

    const clearAll = () => { tidsRef.current.forEach(clearTimeout); tidsRef.current = []; };
    const later    = (fn, ms) => { const id = setTimeout(fn, ms); tidsRef.current.push(id); };

    useEffect(() => () => clearAll(), []);

    const mostrar = useCallback((seq) => {
        clearAll();
        setTurno('mostrando');
        let t = 500;
        seq.forEach(idx => {
            later(() => { setIluminada(idx); playTone(NOTAS[idx].freq, 0.38); }, t);
            t += 600;
            later(() => setIluminada(null), t - 180);
        });
        later(() => { setTurno('alumno'); setPaso(0); }, t + 200);
    }, []);

    const iniciar = () => {
        clearAll();
        setGuardada(false);
        const seq = [Math.floor(Math.random() * 7)];
        setSecuencia(seq);
        mostrar(seq);
    };

    const pulsar = (idx) => {
        if (turno !== 'alumno') return;
        playTone(NOTAS[idx].freq, 0.28);
        setIluminada(idx);
        later(() => setIluminada(null), 200);

        if (idx !== secuencia[paso]) {
            playTone(120, 0.55, 'sawtooth', 0.2);
            setTurno('gameover');
            return;
        }

        const nuevoPaso = paso + 1;
        if (nuevoPaso >= secuencia.length) {
            setTurno('ok');
            later(() => {
                const nueva = [...secuencia, Math.floor(Math.random() * 7)];
                setSecuencia(nueva);
                mostrar(nueva);
            }, 900);
        } else {
            setPaso(nuevoPaso);
        }
    };

    const nivel = secuencia.length;

    return (
        <GameScreen onBack={onBack} titulo="Simón Dice Musical" emoji="🎹" color="#10b981">
            {/* Status message */}
            <div style={{ textAlign: 'center', minHeight: 36, marginBottom: 16 }}>
                {turno === 'inicio'    && <span style={{ color: '#94a3b8' }}>Pulsa "Empezar" para escuchar la primera secuencia.</span>}
                {turno === 'mostrando' && <span style={{ color: '#10b981', fontWeight: 700 }}>👂 Escucha la secuencia…</span>}
                {turno === 'alumno'    && <span style={{ color: '#f1f5f9', fontWeight: 700 }}>🎵 Tu turno — Nivel {nivel} ({nivel} nota{nivel > 1 ? 's' : ''})</span>}
                {turno === 'ok'        && <span style={{ color: '#22c55e', fontWeight: 700 }}>✅ ¡Nivel {nivel} superado!</span>}
                {turno === 'gameover'  && <span style={{ color: '#ef4444', fontWeight: 700 }}>❌ ¡Fallaste en el nivel {nivel}!</span>}
            </div>

            {/* Xylophone — bars get shorter for higher notes */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'flex-end', marginBottom: 28, padding: '0 4px' }}>
                {NOTAS.map((n, i) => {
                    const lit = iluminada === i;
                    const h   = 130 - i * 10; // Do=130 (tallest), Si=60 (shortest)
                    return (
                        <button key={n.nombre} onClick={() => pulsar(i)} style={{
                            flex: 1, minWidth: 36, height: h,
                            background: lit ? n.color : n.color + '30',
                            border: `3px solid ${n.color}`,
                            borderRadius: '6px 6px 12px 12px',
                            cursor: turno === 'alumno' ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                            paddingBottom: 8,
                            color: lit ? '#fff' : n.color,
                            fontWeight: 700, fontSize: '0.78rem',
                            transform: lit ? 'scale(1.07)' : 'scale(1)',
                            boxShadow: lit ? `0 0 18px ${n.color}99` : 'none',
                            transition: 'all 0.1s',
                        }}>
                            {n.nombre}
                        </button>
                    );
                })}
            </div>

            {turno === 'gameover' && onPartidaTerminada && !guardada && (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <button onClick={() => { onPartidaTerminada({ juego: 'Simón Dice Musical', emoji: '🎹', puntos: nivel, nivel }); setGuardada(true); }}
                        style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
                        ✓ Guardar en sesión
                    </button>
                </div>
            )}
            {turno === 'gameover' && guardada && (
                <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>✓ Guardado en sesión</div>
            )}
            {(turno === 'inicio' || turno === 'gameover') && (
                <CenteredBtn onClick={iniciar} color="#10b981">
                    {turno === 'gameover' ? 'Reintentar' : 'Empezar'}
                </CenteredBtn>
            )}
        </GameScreen>
    );
}

// ─── 3. CREADOR DE RITMOS ────────────────────────────────────────────────────

function CreadorDeRitmos({ onBack, usuario }) {
    const [grid,  setGrid]  = useState(() => INSTRUMENTOS_SEQ.map(() => Array(PASOS).fill(false)));
    const [repro, setRepro] = useState(false);
    const [pulso, setPulso] = useState(-1);
    const [bpm,   setBpm]   = useState(120);
    const gridRef = useRef(grid);
    useEffect(() => { gridRef.current = grid; }, [grid]);

    // Sequencer loop — restarts when bpm or repro changes
    useEffect(() => {
        if (!repro) { setPulso(-1); return; }
        const ms = Math.round(60000 / bpm / 4);
        const id = setInterval(() => {
            setPulso(p => {
                const next = (p + 1) % PASOS;
                gridRef.current.forEach((fila, i) => { if (fila[next]) INSTRUMENTOS_SEQ[i].play(); });
                return next;
            });
        }, ms);
        return () => clearInterval(id);
    }, [repro, bpm]);

    const toggle = (fi, ci) =>
        setGrid(prev => prev.map((r, ri) => ri === fi ? r.map((v, ci2) => ci2 === ci ? !v : v) : r));

    const limpiar = () => setGrid(INSTRUMENTOS_SEQ.map(() => Array(PASOS).fill(false)));

    // Beat markers (1–4 repeating)
    const beat = i => i % 4 === 0 ? String(i / 4 + 1) : '·';

    return (
        <GameScreen onBack={onBack} titulo="Creador de Ritmos" emoji="🥁" color="#f59e0b">
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <button onClick={() => setRepro(r => !r)} style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: '0.95rem',
                    background: repro ? '#ef4444' : '#22c55e', color: '#fff', cursor: 'pointer', minWidth: 88,
                }}>
                    {repro ? '⏹ Stop' : '▶ Play'}
                </button>

                <button onClick={limpiar} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>
                    Limpiar
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        BPM <b style={{ color: '#f59e0b' }}>{bpm}</b>
                    </span>
                    <input type="range" min="60" max="200" value={bpm}
                        onChange={e => setBpm(Number(e.target.value))}
                        style={{ width: 90, accentColor: '#f59e0b', cursor: 'pointer' }} />
                </div>
            </div>

            {/* Scrollable grid */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ minWidth: 520 }}>
                    {/* Pulse indicator strip */}
                    <div style={{ display: 'flex', gap: 3, marginBottom: 6, paddingLeft: 80 }}>
                        {Array.from({ length: PASOS }, (_, i) => (
                            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: pulso === i ? '#f59e0b' : i % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)', transition: 'background 0.05s' }} />
                        ))}
                    </div>

                    {/* Instrument rows */}
                    {INSTRUMENTOS_SEQ.map((inst, fi) => (
                        <div key={inst.nombre} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                            <div style={{ width: 76, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, paddingRight: 4 }}>
                                <span style={{ fontSize: 20 }}>{inst.emoji}</span>
                                <span style={{ color: inst.color, fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.2 }}>{inst.nombre}</span>
                            </div>
                            {grid[fi].map((activa, ci) => (
                                <button key={ci} onClick={() => toggle(fi, ci)} style={{
                                    flex: 1, height: 38, border: 'none', borderRadius: 5, cursor: 'pointer',
                                    background: activa
                                        ? inst.color
                                        : pulso === ci
                                            ? 'rgba(255,255,255,0.18)'
                                            : ci % 4 === 0
                                                ? 'rgba(255,255,255,0.11)'
                                                : 'rgba(255,255,255,0.05)',
                                    outline: pulso === ci && !activa ? `2px solid ${inst.color}50` : 'none',
                                    transition: 'background 0.06s',
                                }} />
                            ))}
                        </div>
                    ))}

                    {/* Beat numbers */}
                    <div style={{ display: 'flex', gap: 3, marginTop: 4, paddingLeft: 80 }}>
                        {Array.from({ length: PASOS }, (_, i) => (
                            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.58rem', color: i % 4 === 0 ? '#f59e0b' : '#475569', fontWeight: i % 4 === 0 ? 700 : 400 }}>
                                {beat(i)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </GameScreen>
    );
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function GameScreen({ onBack, titulo, emoji, color, children }) {
    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f2e 0%, #1a1040 100%)', padding: '20px 16px', fontFamily: 'inherit' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={onBack} style={s.backBtn}>←</button>
                    <span style={{ fontSize: 22 }}>{emoji}</span>
                    <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.2rem', fontWeight: 700 }}>{titulo}</h2>
                </div>
                {children}
            </div>
        </div>
    );
}

function CenteredBtn({ onClick, color, children }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <button onClick={onClick} style={{ padding: '13px 40px', fontSize: '1rem', fontWeight: 700, background: color, color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: `0 4px 20px ${color}55` }}>
                {children}
            </button>
        </div>
    );
}

const s = {
    backBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f1f5f9', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginBottom: 0 },
};
