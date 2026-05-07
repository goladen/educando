import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';

// ── SVG note primitives ────────────────────────────────────────────
const NC = '#1e293b';
const SV = { width: 74, height: 62, display: 'block' };

const nh  = (cx, cy = 64) =>
    <ellipse cx={cx} cy={cy} rx={10} ry={7} transform={`rotate(-22 ${cx} ${cy})`} fill={NC} />;
const nho = (cx, cy = 64) =>
    <ellipse cx={cx} cy={cy} rx={10} ry={7} transform={`rotate(-22 ${cx} ${cy})`} fill="none" stroke={NC} strokeWidth="2.5" />;
const st  = (x) =>
    <line x1={x} y1={61} x2={x} y2={21} stroke={NC} strokeWidth="3" strokeLinecap="round" />;
const bm  = (x1, x2, y) =>
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={NC} strokeWidth="6" strokeLinecap="butt" />;
const dt  = (cx, cy) =>
    <circle cx={cx} cy={cy} r={3.5} fill={NC} />;
const fl  = (x, top = 21) =>
    <path d={`M${x},${top} Q${x + 13},${top + 7} ${x + 7},${top + 17}`}
          fill="none" stroke={NC} strokeWidth="3" strokeLinecap="round" />;
const er  = (cx, y = 55) => <>
    <circle cx={cx - 8} cy={y + 7} r={3.8} fill={NC} />
    <line x1={cx - 4} y1={y + 4} x2={cx + 8} y2={y - 22} stroke={NC} strokeWidth="3" strokeLinecap="round" />
    <path d={`M${cx + 8},${y - 22} Q${cx + 20},${y - 15} ${cx + 13},${y - 5}`}
          fill="none" stroke={NC} strokeWidth="3" strokeLinecap="round" />
</>;

// ── Rhythm palette ─────────────────────────────────────────────────
const RHYTHMS = [
    {
        id: 'negra', beats: 1, bg: '#bae6fd', label: 'negra',
        ticks: [0],
        svg: <svg viewBox="0 0 100 80" style={SV}>{nh(42)}{st(52)}</svg>
    },
    {
        id: '2_corcheas', beats: 1, bg: '#fef08a', label: '2 corcheas',
        ticks: [0, 0.5],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {nh(20)}{nh(64)}{st(30)}{st(74)}{bm(30, 74, 21)}
        </svg>
    },
    {
        id: '4_semicorcheas', beats: 1, bg: '#a7f3d0', label: '4 semicorcheas',
        ticks: [0, 0.25, 0.5, 0.75],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {nh(11)}{nh(36)}{nh(61)}{nh(86)}
            {st(21)}{st(46)}{st(71)}{st(96)}
            {bm(21, 96, 21)}{bm(21, 96, 29)}
        </svg>
    },
    {
        id: 'tresillo', beats: 1, bg: '#c4b5fd', label: 'tresillo',
        ticks: [0, 1 / 3, 2 / 3],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {nh(12)}{nh(46)}{nh(80)}{st(22)}{st(56)}{st(90)}{bm(22, 90, 21)}
            <line x1="22" y1="16" x2="43" y2="16" stroke={NC} strokeWidth="1.5" />
            <line x1="69" y1="16" x2="90" y2="16" stroke={NC} strokeWidth="1.5" />
            <line x1="22" y1="12" x2="22" y2="16" stroke={NC} strokeWidth="1.5" />
            <line x1="90" y1="12" x2="90" y2="16" stroke={NC} strokeWidth="1.5" />
            <text x="56" y="14" textAnchor="middle" fontSize="11" fontWeight="700"
                  fontStyle="italic" fill={NC} fontFamily="serif">3</text>
        </svg>
    },
    {
        id: 'corchea_puntillo_semi', beats: 1, bg: '#67e8f9', label: 'corchea . + semicorchea',
        ticks: [0, 0.75],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {nh(17)}{dt(32, 61)}{nh(64)}{st(27)}{st(74)}
            {bm(27, 74, 21)}{bm(51, 74, 29)}
        </svg>
    },
    {
        id: 'silencio_corchea', beats: 1, bg: '#fed7aa', label: 'silencio + corchea',
        ticks: [0.5],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {er(32, 55)}{nh(68)}{st(78)}{fl(78)}
        </svg>
    },
    {
        id: 'silencio_negra', beats: 1, bg: '#fda4af', label: 'silencio de negra',
        ticks: [],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            <path d="M57,16 L43,28 L62,37 Q46,52 45,63 Q43,73 52,76 Q60,79 64,71 Q66,63 58,61"
                  fill="none" stroke={NC} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    },
    {
        id: '2_negras', beats: 2, bg: '#e0e7ff', label: '2 negras',
        ticks: [0, 1],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {nh(22)}{nh(66)}{st(32)}{st(76)}
        </svg>
    },
    {
        id: 'blanca', beats: 2, bg: '#d1fae5', label: 'blanca',
        ticks: [0],
        svg: <svg viewBox="0 0 100 80" style={SV}>{nho(42)}{st(52)}</svg>
    },
    {
        id: 'negra_puntillo_corchea', beats: 2, bg: '#fdba74', label: 'negra . + corchea',
        ticks: [0, 1.5],
        svg: <svg viewBox="0 0 100 80" style={SV}>
            {nh(20)}{dt(35, 61)}{st(30)}
            {nh(65)}{st(75)}{fl(75)}
        </svg>
    },
];

const TOTAL_BEATS   = 3;
const BPM           = 80;
const BEAT_DURATION = 60 / BPM;

// ── Modal enviar al profesor ───────────────────────────────────────
function ModalEnviar({ historial, puntuacion, onClose }) {
    const [nombre,   setNombre]   = useState('');
    const [curso,    setCurso]    = useState('');
    const [codigo,   setCodigo]   = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code)          { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'MUSIC_COMPASS',
                modalidad: 'Individual',
                fecha: new Date(),
                recursoId: 'music-compass',
                recursoTitulo: 'Entrenamiento Auditivo (Ritmo)',
                codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(),
                    curso:  curso.trim(),
                    puntuacionTotal:       puntuacion,
                    ejerciciosCompletados: historial.length,
                    detalle: historial.map((h, i) => ({
                        ejercicio: i + 1,
                        intentos:  h.intentos,
                        puntos:    h.puntos,
                        sinPuntos: h.sinPuntos,
                    })),
                }],
            });
            setEnviado(true);
        } catch (e) { setError('Error al enviar: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#1e293b', borderRadius: 20, padding: '28px 26px', maxWidth: 380, width: '100%', color: 'white', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>
                {enviado ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#34d399', margin: '0 0 6px' }}>¡Enviado al profesor!</p>
                        <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: '0.9rem' }}>
                            {historial.length} ejercicio{historial.length !== 1 ? 's' : ''} · {puntuacion} pts totales
                        </p>
                        <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 50, border: 'none', background: '#34d399', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
                    </div>
                ) : (<>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>📤 Enviar al profesor</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    </div>

                    {/* Resumen + lista de ejercicios */}
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: '0.85rem', color: '#94a3b8' }}>
                            <span><span style={{ color: '#f1f5f9', fontWeight: 700 }}>{historial.length}</span> ejercicio{historial.length !== 1 ? 's' : ''}</span>
                            <span style={{ color: '#fbbf24', fontWeight: 800 }}>⭐ {puntuacion} pts totales</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
                            {historial.map((h, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '5px 10px', fontSize: '0.78rem' }}>
                                    <span style={{ color: '#94a3b8' }}>Ejercicio {i + 1}</span>
                                    <span style={{ color: '#cbd5e1' }}>{h.intentos} intento{h.intentos !== 1 ? 's' : ''}</span>
                                    <span style={{ fontWeight: 700, color: h.sinPuntos ? '#64748b' : h.puntos >= 8 ? '#34d399' : h.puntos >= 4 ? '#fbbf24' : '#f87171' }}>
                                        {h.sinPuntos ? 'sin pts' : `+${h.puntos} pts`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {[['Tu nombre', nombre, setNombre, 'text'], ['Curso (opcional)', curso, setCurso, 'text'], ['Código del profesor', codigo, setCodigo, 'text']].map(([ph, val, set, type]) => (
                        <input key={ph} type={type} placeholder={ph} value={val}
                            onChange={e => { set(type === 'text' && ph.includes('Código') ? e.target.value.toUpperCase() : e.target.value); setError(''); }}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                        />
                    ))}

                    {error && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '0 0 10px' }}>{error}</p>}

                    <button onClick={enviar} disabled={enviando} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: enviando ? '#475569' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: enviando ? 'not-allowed' : 'pointer' }}>
                        {enviando ? 'Enviando…' : 'Enviar resultados'}
                    </button>
                </>)}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────
export default function EarTrainingGame({ onBack }) {
    const [targetSequence,  setTargetSequence]  = useState([]);
    const [userSequence,    setUserSequence]    = useState([]);
    const [feedback,        setFeedback]        = useState([]);
    const [isPlaying,       setIsPlaying]       = useState(false);
    const [isPlayingUser,   setIsPlayingUser]   = useState(false);
    const [activeLED,       setActiveLED]       = useState(null);
    const [gameState,       setGameState]       = useState('playing');
    const [intentos,        setIntentos]        = useState(0);
    const [puntuacion,      setPuntuacion]      = useState(0);
    const [ptsGanados,      setPtsGanados]      = useState(null);
    const [solucionVisible, setSolucionVisible] = useState(false);
    const [sinPuntos,       setSinPuntos]       = useState(false);
    const [historial,       setHistorial]       = useState([]); // [{intentos, puntos, sinPuntos}]
    const [modalEnviar,     setModalEnviar]     = useState(false);
    const audioCtxRef = useRef(null);

    const generateNewSequence = useCallback(() => {
        let seq = [], beats = 0;
        while (beats < TOTAL_BEATS) {
            const avail = RHYTHMS.filter(r => r.beats <= TOTAL_BEATS - beats);
            const r = avail[Math.floor(Math.random() * avail.length)];
            seq.push(r);
            beats += r.beats;
        }
        setTargetSequence(seq);
        setUserSequence([]);
        setFeedback([]);
        setGameState('playing');
        setActiveLED(null);
        setIntentos(0);
        setPtsGanados(null);
        setSolucionVisible(false);
        setSinPuntos(false);
    }, []);

    useEffect(() => {
        generateNewSequence();
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AC();
    }, [generateNewSequence]);

    // ── Clave synthesis ────────────────────────────────────────────
    const playClave = useCallback((time, strong = false) => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        const f0 = strong ? 2500 : 2100, amp0 = strong ? 0.60 : 0.42;
        [[f0, amp0, 0.065], [f0 * 1.52, amp0 * 0.36, 0.040], [f0 * 2.10, amp0 * 0.13, 0.024]]
            .forEach(([freq, amp, dur]) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.type = 'sine'; osc.frequency.value = freq;
                g.gain.setValueAtTime(amp, time);
                g.gain.exponentialRampToValueAtTime(0.001, time + dur);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(time); osc.stop(time + dur + 0.005);
            });
        const len = Math.ceil(ctx.sampleRate * 0.009);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch  = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bpf = ctx.createBiquadFilter();
        bpf.type = 'bandpass'; bpf.frequency.value = strong ? 3400 : 2700; bpf.Q.value = 2;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(strong ? 0.38 : 0.26, time);
        gn.gain.exponentialRampToValueAtTime(0.001, time + 0.009);
        src.connect(bpf); bpf.connect(gn); gn.connect(ctx.destination);
        src.start(time); src.stop(time + 0.011);
    }, []);

    const playFeedback = useCallback((time, isSuccess) => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (isSuccess) {
            [[523, 0], [659, 0.10], [784, 0.20]].forEach(([freq, delay]) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.type = 'sine'; osc.frequency.value = freq;
                g.gain.setValueAtTime(0, time + delay);
                g.gain.linearRampToValueAtTime(0.32, time + delay + 0.025);
                g.gain.exponentialRampToValueAtTime(0.001, time + delay + 0.38);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(time + delay); osc.stop(time + delay + 0.42);
            });
        } else {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, time);
            osc.frequency.exponentialRampToValueAtTime(100, time + 0.38);
            g.gain.setValueAtTime(0.30, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(time); osc.stop(time + 0.40);
        }
    }, []);

    const playUserSequence = () => {
        if (isPlayingUser || isPlaying || !audioCtxRef.current || !isFull) return;
        setIsPlayingUser(true);
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        const startTime = audioCtxRef.current.currentTime + 0.2;
        let offset = 0;
        userSequence.forEach(rhythm => {
            rhythm.ticks.forEach(tick =>
                playClave(startTime + (offset + tick) * BEAT_DURATION, tick === 0)
            );
            offset += rhythm.beats;
        });
        setTimeout(() => setIsPlayingUser(false),
            (0.2 + TOTAL_BEATS * BEAT_DURATION) * 1000);
    };

    const playSequence = () => {
        if (isPlaying || !audioCtxRef.current) return;
        setIsPlaying(true);
        setGameState('playing');
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        const startTime = audioCtxRef.current.currentTime + 0.2;
        let offset = 0;
        targetSequence.forEach(rhythm => {
            rhythm.ticks.forEach(tick =>
                playClave(startTime + (offset + tick) * BEAT_DURATION, tick === 0)
            );
            offset += rhythm.beats;
        });
        for (let i = 0; i < TOTAL_BEATS; i++)
            setTimeout(() => setActiveLED(i), (0.2 + i * BEAT_DURATION) * 1000);
        setTimeout(() => { setActiveLED(null); setIsPlaying(false); },
            (0.2 + TOTAL_BEATS * BEAT_DURATION) * 1000);
    };

    const handleRhythmClick = (rhythm) => {
        if (gameState === 'won') return;
        const beats = userSequence.reduce((a, r) => a + r.beats, 0);
        if (beats + rhythm.beats <= TOTAL_BEATS) {
            setUserSequence([...userSequence, rhythm]);
            setFeedback([]);
            setGameState('playing');
        }
    };

    const clearLast = () => { setUserSequence(s => s.slice(0, -1)); setFeedback([]); setGameState('playing'); };
    const clearAll  = () => { setUserSequence([]); setFeedback([]); setGameState('playing'); };

    const checkAnswer = () => {
        const newIntentos = intentos + 1;
        setIntentos(newIntentos);
        const fb = userSequence.map((r, i) =>
            targetSequence[i]?.id === r.id ? 'correct' : 'incorrect'
        );
        setFeedback(fb);
        const allOk = fb.length === targetSequence.length && fb.every(f => f === 'correct');
        setGameState(allOk ? 'won' : 'error');
        playFeedback(audioCtxRef.current.currentTime, allOk);
        if (allOk) {
            // -2 pts por cada intento fallido (mínimo 1)
            const pts = sinPuntos ? 0 : Math.max(12 - 2 * newIntentos, 1);
            setPtsGanados(pts);
            setPuntuacion(p => p + pts);
            setHistorial(h => [...h, { intentos: newIntentos, puntos: pts, sinPuntos }]);
        }
    };

    const currentBeats = userSequence.reduce((a, r) => a + r.beats, 0);
    const isFull       = currentBeats === TOTAL_BEATS;
    const nCorrect     = feedback.filter(f => f === 'correct').length;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f2e 0%, #1a1040 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
            <style>{`
                @keyframes mc-bounce { 0%,100%{transform:translateY(-4px)} 50%{transform:translateY(0)} }
                @keyframes mc-pulse  { 0%,100%{opacity:1} 50%{opacity:0.55} }
                @keyframes mc-fadein { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
                @keyframes mc-pts    { 0%{opacity:0;transform:scale(0.6) translateY(8px)} 60%{opacity:1;transform:scale(1.15) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
            `}</style>

            {modalEnviar && (
                <ModalEnviar
                    historial={historial}
                    puntuacion={puntuacion}
                    onClose={() => setModalEnviar(false)}
                />
            )}

            <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', padding: '24px 24px 28px', maxWidth: 680, width: '100%', border: '1px solid #f1f5f9' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    {onBack && (
                        <button onClick={onBack} style={{ background: 'rgba(0,0,0,0.07)', border: 'none', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: '#334155', flexShrink: 0 }}>←</button>
                    )}
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#334155', flexGrow: 1 }}>🎧 Entrenamiento Auditivo</h1>

                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                        {intentos > 0 && (
                            <span style={{ background: '#f1f5f9', borderRadius: 20, padding: '4px 11px', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                                {intentos} {intentos === 1 ? 'intento' : 'intentos'}
                            </span>
                        )}
                        <span style={{ background: '#fef9c3', borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 800, color: '#78350f' }}>
                            ⭐ {puntuacion}
                        </span>
                        {historial.length > 0 && (
                            <button onClick={() => setModalEnviar(true)}
                                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 20, padding: '5px 13px', fontSize: '0.72rem', fontWeight: 700, color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                📤 Enviar al profesor
                            </button>
                        )}
                    </div>
                </div>

                {/* Play button + LEDs */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, gap: 18 }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        {/* Botón escuchar objetivo */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <button onClick={playSequence} disabled={isPlaying || isPlayingUser} style={{
                                width: 80, height: 80, borderRadius: '50%', border: 'none',
                                cursor: (isPlaying || isPlayingUser) ? 'not-allowed' : 'pointer',
                                background: isPlaying ? '#cbd5e1' : '#fb7185',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: isPlaying ? 'none' : '0 8px 26px rgba(251,113,133,0.55)',
                                transform: isPlaying ? 'scale(0.95)' : 'scale(1)',
                                transition: 'all 0.15s',
                            }}>
                                <svg style={{ width: 40, height: 40, fill: 'white', marginLeft: 5 }} viewBox="0 0 20 20">
                                    <path d="M4 4l12 6-12 6z" />
                                </svg>
                            </button>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Escuchar</span>
                        </div>

                        {/* Botón escuchar propuesta */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <button onClick={playUserSequence} disabled={!isFull || isPlaying || isPlayingUser || gameState === 'won'}
                                title={isFull ? 'Escuchar tu propuesta' : 'Rellena los 3 tiempos primero'}
                                style={{
                                    width: 80, height: 80, borderRadius: '50%', border: '3px solid',
                                    borderColor: isFull && gameState !== 'won' ? '#818cf8' : '#e2e8f0',
                                    cursor: (isFull && !isPlaying && !isPlayingUser && gameState !== 'won') ? 'pointer' : 'not-allowed',
                                    background: isPlayingUser ? '#cbd5e1' : isFull && gameState !== 'won' ? 'linear-gradient(135deg,#6366f1,#818cf8)' : '#f1f5f9',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: (isFull && !isPlayingUser && gameState !== 'won') ? '0 8px 26px rgba(99,102,241,0.45)' : 'none',
                                    transform: isPlayingUser ? 'scale(0.95)' : 'scale(1)',
                                    transition: 'all 0.15s',
                                    opacity: (!isFull || gameState === 'won') ? 0.4 : 1,
                                }}>
                                <svg style={{ width: 40, height: 40, fill: (isFull && gameState !== 'won') ? 'white' : '#94a3b8', marginLeft: 5 }} viewBox="0 0 20 20">
                                    <path d="M4 4l12 6-12 6z" />
                                </svg>
                            </button>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: (isFull && gameState !== 'won') ? '#6366f1' : '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Mi propuesta</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 28 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                                <div style={{
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: activeLED === i ? '#34d399' : '#e2e8f0',
                                    border: `2px solid ${activeLED === i ? '#10b981' : '#cbd5e1'}`,
                                    boxShadow: activeLED === i ? '0 0 14px rgba(52,211,153,0.8)' : 'none',
                                    transition: 'all 0.2s',
                                }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P {i + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Solution zone */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, background: '#f1f5f9', padding: 11, borderRadius: 14, minHeight: 128 }}>
                        {userSequence.map((rhythm, idx) => {
                            const fb     = feedback[idx];
                            const border = fb === 'correct' ? '#10b981' : fb === 'incorrect' ? '#f43f5e' : 'rgba(0,0,0,0.07)';
                            const glow   = fb === 'correct' ? '0 0 0 3px #d1fae5' : fb === 'incorrect' ? '0 0 0 3px #fee2e2' : 'none';
                            return (
                                <div key={idx} style={{
                                    background: rhythm.bg,
                                    gridColumn: rhythm.beats === 2 ? 'span 2' : 'span 1',
                                    borderRadius: 11, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    border: `3px solid ${border}`, boxShadow: glow,
                                    position: 'relative', padding: '10px 0',
                                    animation: 'mc-fadein 0.2s ease',
                                    transition: 'border-color 0.25s, box-shadow 0.25s',
                                }}>
                                    {fb && <span style={{ position: 'absolute', top: 5, right: 7, fontSize: '0.85rem' }}>{fb === 'correct' ? '✅' : '❌'}</span>}
                                    {rhythm.svg}
                                    <span style={{ fontSize: '0.6rem', color: NC, position: 'absolute', bottom: 5, opacity: 0.5, fontStyle: 'italic' }}>{rhythm.label}</span>
                                </div>
                            );
                        })}
                        {Array.from({ length: TOTAL_BEATS - currentBeats }).map((_, i) => (
                            <div key={`e${i}`} style={{
                                gridColumn: 'span 1', border: '3px dashed #cbd5e1', borderRadius: 11,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(248,250,252,0.5)', minHeight: 100,
                            }}>
                                <span style={{ color: '#cbd5e1', fontSize: '1.6rem', fontWeight: 700 }}>{currentBeats + i + 1}</span>
                            </div>
                        ))}
                    </div>

                    {/* Feedback message */}
                    <div style={{ minHeight: 30, marginTop: 10, textAlign: 'center' }}>
                        {gameState === 'won' && (
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ color: '#10b981', display: 'inline-block', animation: 'mc-bounce 0.7s ease infinite' }}>¡Correcto! 🎉</span>
                                {ptsGanados !== null && (
                                    <span style={{ background: ptsGanados > 0 ? '#fef9c3' : '#f1f5f9', color: ptsGanados > 0 ? '#92400e' : '#64748b', borderRadius: 20, padding: '2px 12px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-block', animation: 'mc-pts 0.4s ease both' }}>
                                        {ptsGanados > 0 ? `+${ptsGanados} pts` : 'sin puntos'}
                                    </span>
                                )}
                            </p>
                        )}
                        {gameState === 'error' && (
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                                <span style={{ color: '#10b981' }}>{nCorrect} correcto{nCorrect !== 1 ? 's' : ''}</span>
                                <span style={{ color: '#94a3b8' }}> · </span>
                                <span style={{ color: '#f43f5e' }}>{userSequence.length - nCorrect} incorrecto{userSequence.length - nCorrect !== 1 ? 's' : ''}</span>
                                <span style={{ color: '#64748b' }}> — ¡Vuelve a escuchar!</span>
                            </p>
                        )}
                    </div>

                    {/* Controls — solo "Siguiente" cuando won */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {gameState === 'won' ? (
                            <button onClick={generateNewSequence}
                                style={{ padding: '10px 30px', borderRadius: 50, border: 'none', fontWeight: 700, fontSize: '0.95rem', color: '#fff', background: '#10b981', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.45)', animation: 'mc-pulse 1.4s ease infinite' }}>
                                Siguiente reto ▶
                            </button>
                        ) : (<>
                            <button onClick={clearAll} disabled={userSequence.length === 0}
                                style={{ padding: '8px 16px', borderRadius: 50, border: 'none', fontWeight: 600, fontSize: '0.82rem', color: '#475569', background: '#e2e8f0', cursor: userSequence.length === 0 ? 'not-allowed' : 'pointer', opacity: userSequence.length === 0 ? 0.5 : 1 }}>
                                Borrar Todo
                            </button>
                            <button onClick={clearLast} disabled={userSequence.length === 0}
                                style={{ padding: '8px 16px', borderRadius: 50, border: 'none', fontWeight: 600, fontSize: '0.82rem', color: '#475569', background: '#e2e8f0', cursor: userSequence.length === 0 ? 'not-allowed' : 'pointer', opacity: userSequence.length === 0 ? 0.5 : 1 }}>
                                Borrar Último
                            </button>
                            <button onClick={checkAnswer} disabled={!isFull}
                                style={{ padding: '8px 22px', borderRadius: 50, border: 'none', fontWeight: 700, fontSize: '0.88rem', color: '#fff', background: isFull ? '#06b6d4' : '#a5f3fc', cursor: isFull ? 'pointer' : 'not-allowed', boxShadow: isFull ? '0 4px 14px rgba(6,182,212,0.45)' : 'none', transition: 'all 0.15s' }}>
                                Comprobar
                            </button>
                            {!solucionVisible && (
                                <button onClick={() => { setSolucionVisible(true); setSinPuntos(true); }}
                                    style={{ padding: '8px 18px', borderRadius: 50, border: '2px solid #fbbf24', fontWeight: 700, fontSize: '0.82rem', color: '#92400e', background: '#fef9c3', cursor: 'pointer' }}>
                                    💡 Ver solución
                                </button>
                            )}
                        </>)}
                    </div>

                    {/* Solution reveal */}
                    {solucionVisible && (
                        <div style={{ marginTop: 14, background: '#fffbeb', border: '2px solid #fde68a', borderRadius: 14, padding: '12px 14px', animation: 'mc-fadein 0.3s ease' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                💡 Solución (sin puntuación)
                            </p>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {targetSequence.map((r, i) => (
                                    <div key={i} style={{ background: r.bg, borderRadius: 12, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                        {r.svg}
                                        <span style={{ fontSize: '0.62rem', color: NC, marginTop: 4, opacity: 0.65, fontStyle: 'italic' }}>{r.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Rhythm palette */}
                <div>
                    <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', margin: '0 0 10px' }}>
                        Paleta de Ritmos
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 9 }}>
                        {RHYTHMS.map(rhythm => {
                            const dis = gameState === 'won' || currentBeats + rhythm.beats > TOTAL_BEATS;
                            return (
                                <button key={rhythm.id} onClick={() => handleRhythmClick(rhythm)} disabled={dis}
                                    style={{
                                        background: rhythm.bg, height: 108, borderRadius: 13,
                                        border: '2px solid transparent',
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', gap: 3,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                        cursor: dis ? 'not-allowed' : 'pointer',
                                        opacity: dis ? 0.35 : 1,
                                        transition: 'all 0.12s',
                                    }}
                                    onMouseEnter={e => { if (!dis) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 7px 18px rgba(0,0,0,0.13)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; } }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >
                                    {rhythm.svg}
                                    <span style={{ fontSize: '0.56rem', fontWeight: 600, color: NC, opacity: 0.62, textAlign: 'center', lineHeight: 1.25, padding: '0 2px', fontStyle: 'italic' }}>
                                        {rhythm.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
