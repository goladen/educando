import { useState, useEffect, useRef, useCallback } from 'react';
import { PASOS, NOTAS, NOTAS_STAFF, INSTRUMENTOS_SEQ, playTone } from './musicUtils';
import CreadorRitmosColab from './CreadorRitmosColab';

// ─── Hub ─────────────────────────────────────────────────────────────────────

export default function MusicApp({ onBack, usuario = null }) {
    const [app, setApp] = useState(null);

    if (app === 'lluvia') return <LluviaDeNotas onBack={() => setApp(null)} />;
    if (app === 'simon')  return <SimonDiceMusical onBack={() => setApp(null)} />;
    if (app === 'ritmos') return <CreadorDeRitmos onBack={() => setApp(null)} usuario={usuario} />;
    if (app === 'colab')  return <CreadorRitmosColab onBack={() => setApp(null)} usuario={usuario} />;

    const APPS_MUSICA = [
        { id: 'lluvia', titulo: 'Lluvia de Notas',       desc: 'Lee la nota en el pentagrama y responde antes de que se acabe el tiempo.', emoji: '🎼', color: '#6366f1' },
        { id: 'simon',  titulo: 'Simón Dice Musical',    desc: 'Escucha y repite la secuencia musical. ¿Cuántos niveles puedes superar?',   emoji: '🎹', color: '#10b981' },
        { id: 'ritmos', titulo: 'Creador de Ritmos',     desc: 'Programa tu propio beat con bombo, caja, hi-hat y melodía.',                emoji: '🥁', color: '#f59e0b' },
        { id: 'colab',  titulo: 'Ritmos Colaborativos',  desc: 'Cread un beat entre varios. Cada uno añade su parte por turnos.',           emoji: '🎶', color: '#8b5cf6' },
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
            </div>
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

function LluviaDeNotas({ onBack }) {
    const [estado, setEstado] = useState('inicio');
    const [nota,   setNota]   = useState(null);
    const [puntos, setPuntos] = useState(0);
    const [vidas,  setVidas]  = useState(3);
    const [tiempo, setTiempo] = useState(5);
    const [flash,  setFlash]  = useState(null);   // null | 'ok' | 'error'

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
                <div style={{ color: '#6366f1', fontWeight: 800, fontSize: '2.4rem', marginBottom: 28 }}>{puntos}</div>
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

function SimonDiceMusical({ onBack }) {
    const [secuencia,  setSecuencia]  = useState([]);
    const [turno,      setTurno]      = useState('inicio');  // inicio | mostrando | alumno | ok | gameover
    const [paso,       setPaso]       = useState(0);
    const [iluminada,  setIluminada]  = useState(null);
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
