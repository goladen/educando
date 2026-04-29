import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import {
    PASOS, INSTRUMENTOS_SEQ, gridVacio, genCodigo, exportarWav,
} from './musicUtils';

// ─── Grid serialization (Firestore no admite nested arrays) ──────────────────

const flatGrid   = (g) => g.flat();                                          // 4×16 → 64
const unFlatGrid = (f) => Array.from({ length: 4 }, (_, i) =>               // 64 → 4×16
    (f || []).slice(i * PASOS, (i + 1) * PASOS).map(Boolean)
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COL = '#f59e0b';
const DARK_BG = 'linear-gradient(135deg, #0f0f2e 0%, #1a1040 100%)';

function Btn({ onClick, bg = COL, color = '#fff', disabled = false, style = {}, children }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '11px 24px', borderRadius: 10, border: 'none',
                background: disabled ? '#374151' : bg, color: disabled ? '#6b7280' : color,
                fontWeight: 700, fontSize: '0.9rem', cursor: disabled ? 'default' : 'pointer',
                transition: 'opacity 0.15s', ...style,
            }}
        >
            {children}
        </button>
    );
}

function Card({ children, style = {} }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: 22, ...style,
        }}>
            {children}
        </div>
    );
}

function Label({ children }) {
    return <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 6 }}>{children}</div>;
}

// ─── Beat-marker row ─────────────────────────────────────────────────────────

function BeatStrip({ pulso }) {
    return (
        <div style={{ display: 'flex', gap: 3, marginBottom: 6, paddingLeft: 72 }}>
            {Array.from({ length: PASOS }, (_, i) => (
                <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: pulso === i ? COL : i % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)',
                    transition: 'background 0.05s',
                }} />
            ))}
        </div>
    );
}

// ─── Grid editor ─────────────────────────────────────────────────────────────

function GridEditor({ grid, onToggle, lockedGrid = null, pulso = -1, readOnly = false }) {
    return (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 500 }}>
                <BeatStrip pulso={pulso} />
                {INSTRUMENTOS_SEQ.map((inst, fi) => (
                    <div key={inst.nombre} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                        <div style={{ width: 68, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 18 }}>{inst.emoji}</span>
                            <span style={{ color: inst.color, fontSize: '0.68rem', fontWeight: 700 }}>{inst.nombre}</span>
                        </div>
                        {grid[fi].map((activa, ci) => {
                            const locked = lockedGrid ? lockedGrid[fi][ci] : false;
                            const isActive = activa;
                            return (
                                <button
                                    key={ci}
                                    onClick={() => !readOnly && !locked && onToggle(fi, ci)}
                                    style={{
                                        flex: 1, height: 34, border: 'none', borderRadius: 4, cursor: readOnly || locked ? 'default' : 'pointer',
                                        background: isActive
                                            ? locked ? inst.color + 'aa' : inst.color
                                            : pulso === ci ? 'rgba(255,255,255,0.18)'
                                            : ci % 4 === 0 ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.05)',
                                        outline: pulso === ci && !isActive ? `2px solid ${inst.color}40` : 'none',
                                        opacity: locked && !isActive ? 0.4 : 1,
                                        transition: 'background 0.05s',
                                    }}
                                />
                            );
                        })}
                    </div>
                ))}
                {/* Beat numbers */}
                <div style={{ display: 'flex', gap: 3, marginTop: 2, paddingLeft: 72 }}>
                    {Array.from({ length: PASOS }, (_, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.55rem', color: i % 4 === 0 ? COL : '#475569', fontWeight: i % 4 === 0 ? 700 : 400 }}>
                            {i % 4 === 0 ? String(i / 4 + 1) : '·'}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Sequencer hook (live AudioContext playback) ──────────────────────────────

function useSequencer(grid, bpm) {
    const [pulso, setPulso] = useState(-1);
    const [playing, setPlaying] = useState(false);
    const gridRef = useRef(grid);
    useEffect(() => { gridRef.current = grid; }, [grid]);

    useEffect(() => {
        if (!playing) { setPulso(-1); return; }
        const ms = Math.round(60000 / bpm / 4);
        const id = setInterval(() => {
            setPulso(p => {
                const next = (p + 1) % PASOS;
                gridRef.current.forEach((fila, i) => { if (fila[next]) INSTRUMENTOS_SEQ[i].play(); });
                return next;
            });
        }, ms);
        return () => clearInterval(id);
    }, [playing, bpm]);

    return { pulso, playing, setPlaying };
}

// ─── One-shot play (escucha phase) ───────────────────────────────────────────

function useOneShot(grid, bpm, onDone) {
    const gridRef = useRef(grid);
    const onDoneRef = useRef(onDone);
    useEffect(() => { gridRef.current = grid; }, [grid]);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

    const [pulso, setPulso] = useState(-1);
    const [running, setRunning] = useState(false);
    const stepRef = useRef(0);

    const start = useCallback(() => {
        stepRef.current = 0;
        setRunning(true);
        setPulso(-1);
    }, []);

    useEffect(() => {
        if (!running) return;
        const ms = Math.round(60000 / bpm / 4);
        const id = setInterval(() => {
            const next = stepRef.current;
            if (next >= PASOS) {
                clearInterval(id);
                setRunning(false);
                setPulso(-1);
                onDoneRef.current?.();
                return;
            }
            setPulso(next);
            gridRef.current.forEach((fila, i) => { if (fila[next]) INSTRUMENTOS_SEQ[i].play(); });
            stepRef.current = next + 1;
        }, ms);
        return () => clearInterval(id);
    }, [running, bpm]);

    return { pulso, running, start };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreadorRitmosColab({ onBack, usuario }) {
    const [fase, setFase] = useState('menu');          // menu | crear | unirse | lobby | escucha | edicion | esperando | resultado
    const [codigo, setCodigo] = useState('');
    const [inputCodigo, setInputCodigo] = useState('');
    const [inputNombre, setInputNombre] = useState(usuario?.displayName || '');
    const [sesion, setSesion] = useState(null);
    const [bpmLocal, setBpmLocal] = useState(120);
    const [tiempoPorTurno, setTiempoPorTurno] = useState(30);
    const [localGrid, setLocalGrid] = useState(gridVacio);
    const [baselineGrid, setBaselineGrid] = useState(gridVacio); // grid at start of my turn (locked)
    const [timerSeg, setTimerSeg] = useState(0);
    const [playbackBpm, setPlaybackBpm] = useState(120);
    const [codigoProfesorInput, setCodigoProfesorInput] = useState('');
    const [descargando, setDescargando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const localGridRef = useRef(localGrid);
    useEffect(() => { localGridRef.current = localGrid; }, [localGrid]);

    const miUid = usuario?.uid || ('guest_' + Math.random().toString(36).slice(2, 8));
    const miNombre = inputNombre || usuario?.displayName || 'Jugador';
    const miUidRef = useRef(miUid);

    // ── Firestore listener ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!codigo) return;
        const unsub = onSnapshot(doc(db, 'ritmo_sesiones', codigo), snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (data.grid) data.grid = unFlatGrid(data.grid);
            setSesion(data);
        });
        return () => unsub();
    }, [codigo]);

    // ── Derive my position in the session ─────────────────────────────────────

    const participantes = sesion?.participantes || [];
    const miOrden = participantes.findIndex(p => p.uid === miUidRef.current);
    const esMiTurno = sesion?.estado === 'jugando' && sesion?.turnoActual === miOrden;
    const esCreador = sesion?.creadorUid === miUidRef.current;

    // ── Transition into my turn when Firestore signals it ────────────────────

    const faseRef = useRef(fase);
    useEffect(() => { faseRef.current = fase; }, [fase]);

    useEffect(() => {
        if (!sesion) return;
        const f = faseRef.current;
        if (sesion.estado === 'jugando') {
            if (esMiTurno && (f === 'esperando' || f === 'lobby')) {
                setBaselineGrid(sesion.grid.map(r => [...r]));
                setLocalGrid(sesion.grid.map(r => [...r]));
                setFase('escucha');
            } else if (!esMiTurno && f === 'lobby') {
                setFase('esperando');
            }
        }
        if (sesion.estado === 'terminado' && f !== 'resultado') {
            setPlaybackBpm(sesion.bpm || 120);
            setFase('resultado');
        }
    }, [sesion, esMiTurno]);

    // ── Listen phase: play one loop, then move to edit ────────────────────────

    const escuchaGrid = sesion?.grid || gridVacio();
    const { pulso: escuchaPulso, running: escuchaRunning, start: iniciarEscucha } =
        useOneShot(escuchaGrid, sesion?.bpm || 120, () => {
            setTimerSeg(sesion?.tiempoPorTurno || 30);
            setFase('edicion');
        });

    useEffect(() => {
        if (fase === 'escucha' && !escuchaRunning) {
            iniciarEscucha();
        }
    }, [fase, escuchaRunning, iniciarEscucha]);

    // ── Edit phase timer ──────────────────────────────────────────────────────

    useEffect(() => {
        if (fase !== 'edicion') return;
        if (timerSeg <= 0) { submitTurno(); return; }
        const id = setInterval(() => setTimerSeg(t => t - 1), 1000);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, timerSeg]);

    // ── Edit phase sequencer ──────────────────────────────────────────────────

    const { pulso: editPulso, playing: editPlaying, setPlaying: setEditPlaying } =
        useSequencer(localGrid, sesion?.bpm || 120);

    // ── Result phase sequencer ────────────────────────────────────────────────

    const { pulso: resultPulso, playing: resultPlaying, setPlaying: setResultPlaying } =
        useSequencer(sesion?.grid || gridVacio(), playbackBpm);

    // ── Submit turn ───────────────────────────────────────────────────────────

    const submitTurno = useCallback(async () => {
        if (!codigo || !sesion) return;
        setEditPlaying(false);
        setFase('esperando');

        // Merge: keep all baseline cells, add new ones (can't remove others' beats)
        const merged = localGridRef.current.map((fila, fi) =>
            fila.map((v, ci) => v || (sesion.grid?.[fi]?.[ci] ?? false))
        );

        const eraElUltimo = sesion.turnoActual >= participantes.length - 1;
        await updateDoc(doc(db, 'ritmo_sesiones', codigo), {
            grid: flatGrid(merged),
            turnoActual: sesion.turnoActual + 1,
            estado: eraElUltimo ? 'terminado' : 'jugando',
        });

        if (eraElUltimo) setFase('resultado');
    }, [codigo, sesion, participantes.length, setEditPlaying]);

    // ── Toggle grid cell ──────────────────────────────────────────────────────

    const toggleCell = useCallback((fi, ci) => {
        setLocalGrid(prev => prev.map((r, ri) =>
            ri === fi ? r.map((v, ci2) => ci2 === ci ? !v : v) : r
        ));
    }, []);

    // ── Download WAV (uses current playbackBpm) ───────────────────────────────

    const descargarWav = async () => {
        if (!sesion?.grid) return;
        setResultPlaying(false);
        setDescargando(true);
        try {
            const blob = await exportarWav(sesion.grid, playbackBpm, 4);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `ritmo_${codigo}.wav`; a.click();
            URL.revokeObjectURL(url);
        } catch (e) { console.error(e); }
        setDescargando(false);
    };

    // ── Send to teacher ───────────────────────────────────────────────────────

    const enviarAlProfesor = async () => {
        if (!sesion?.grid || enviado) return;
        const codProf = codigoProfesorInput.trim().toUpperCase();
        if (!codProf) { setError('Introduce el código de tu profesor.'); return; }
        setError('');
        try {
            await setDoc(doc(db, 'ritmos_guardados', codigo), {
                codigo,
                grid: flatGrid(sesion.grid),
                bpm: sesion.bpm,
                participantes: sesion.participantes,
                creadorUid: sesion.creadorUid,
                codigoProfesor: codProf,
                creadoEn: serverTimestamp(),
            });
            setEnviado(true);
        } catch (e) { setError('Error al enviar. Inténtalo de nuevo.'); }
    };

    // ── Create session ────────────────────────────────────────────────────────

    const crearSesion = async () => {
        const code = genCodigo();
        const data = {
            bpm: bpmLocal,
            tiempoPorTurno,
            estado: 'lobby',
            turnoActual: 0,
            grid: flatGrid(gridVacio()),
            participantes: [{ uid: miUidRef.current, nombre: miNombre }],
            creadorUid: miUidRef.current,
            creadoEn: serverTimestamp(),
        };
        await setDoc(doc(db, 'ritmo_sesiones', code), data);
        setCodigo(code);
        setFase('lobby');
    };

    // ── Join session ──────────────────────────────────────────────────────────

    const unirse = async () => {
        const code = inputCodigo.trim().toUpperCase();
        if (!code) return;
        setError('');
        const { getDoc } = await import('firebase/firestore');
        try {
            const ref = doc(db, 'ritmo_sesiones', code);
            const snap = await getDoc(ref);
            if (!snap.exists()) { setError('Código no encontrado.'); return; }
            const existing = snap.data();
            if (existing.estado !== 'lobby') { setError('La sesión ya ha comenzado.'); return; }
            if (existing.participantes.some(p => p.uid === miUidRef.current)) {
                // Already in session
                setCodigo(code);
                setFase('lobby');
                return;
            }
            await updateDoc(ref, {
                participantes: [...existing.participantes, { uid: miUidRef.current, nombre: miNombre }],
            });
            setCodigo(code);
            setFase('lobby');
        } catch (e) { setError('No se pudo unir a la sesión.'); }
    };

    // ── Start game (creator only) ─────────────────────────────────────────────

    const iniciarJuego = async () => {
        await updateDoc(doc(db, 'ritmo_sesiones', codigo), { estado: 'jugando' });
        // My turn is first (turnoActual=0), so I go to escucha
        setBaselineGrid(gridVacio());
        setLocalGrid(gridVacio());
        setFase('escucha');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    const wrap = (children) => (
        <div style={{ minHeight: '100vh', background: DARK_BG, padding: '20px 16px', fontFamily: 'inherit' }}>
            <div style={{ maxWidth: 580, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={onBack} style={s.backBtn}>←</button>
                    <span style={{ fontSize: 22 }}>🥁</span>
                    <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700 }}>Ritmos Colaborativos</h2>
                </div>
                {children}
            </div>
        </div>
    );

    // ── Menu ─────────────────────────────────────────────────────────────────

    if (fase === 'menu') return wrap(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: '0 0 8px' }}>
                Crea un beat entre varios. Cada participante escucha lo que hay y añade su parte. Al final podéis descargar la canción.
            </p>
            {!inputNombre && (
                <Card>
                    <Label>Tu nombre (opcional)</Label>
                    <input value={inputNombre} onChange={e => setInputNombre(e.target.value)}
                        placeholder="Escribe tu nombre..."
                        style={{ ...s.input, width: '100%' }} />
                </Card>
            )}
            <Btn onClick={() => setFase('crear')} bg="#8b5cf6">🎵 Crear sesión</Btn>
            <Btn onClick={() => setFase('unirse')} bg="rgba(255,255,255,0.12)" color="#f1f5f9">🔗 Unirse a una sesión</Btn>
        </div>
    );

    // ── Crear sesión ─────────────────────────────────────────────────────────

    if (fase === 'crear') return wrap(
        <Card>
            <h3 style={{ margin: '0 0 18px', color: '#f1f5f9', fontSize: '1rem' }}>Configurar sesión</h3>
            <div style={{ marginBottom: 16 }}>
                <Label>Tu nombre</Label>
                <input value={inputNombre} onChange={e => setInputNombre(e.target.value)}
                    placeholder="Tu nombre..." style={{ ...s.input, width: '100%' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
                <Label>BPM <b style={{ color: COL }}>{bpmLocal}</b></Label>
                <input type="range" min="60" max="200" value={bpmLocal} onChange={e => setBpmLocal(Number(e.target.value))}
                    style={{ width: '100%', accentColor: COL }} />
            </div>
            <div style={{ marginBottom: 22 }}>
                <Label>Tiempo por turno: <b style={{ color: COL }}>{tiempoPorTurno}s</b></Label>
                <input type="range" min="15" max="120" step="5" value={tiempoPorTurno} onChange={e => setTiempoPorTurno(Number(e.target.value))}
                    style={{ width: '100%', accentColor: COL }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <Btn onClick={() => setFase('menu')} bg="rgba(255,255,255,0.1)" color="#94a3b8">Volver</Btn>
                <Btn onClick={crearSesion} bg="#8b5cf6">Crear sesión</Btn>
            </div>
        </Card>
    );

    // ── Unirse ───────────────────────────────────────────────────────────────

    if (fase === 'unirse') return wrap(
        <Card>
            <h3 style={{ margin: '0 0 18px', color: '#f1f5f9', fontSize: '1rem' }}>Unirse a una sesión</h3>
            <div style={{ marginBottom: 14 }}>
                <Label>Tu nombre</Label>
                <input value={inputNombre} onChange={e => setInputNombre(e.target.value)}
                    placeholder="Tu nombre..." style={{ ...s.input, width: '100%' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
                <Label>Código de sesión</Label>
                <input value={inputCodigo} onChange={e => setInputCodigo(e.target.value.toUpperCase())}
                    placeholder="Ej: X7KPQ" maxLength={5}
                    style={{ ...s.input, width: '100%', letterSpacing: 4, fontSize: '1.1rem', textTransform: 'uppercase' }} />
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
                <Btn onClick={() => setFase('menu')} bg="rgba(255,255,255,0.1)" color="#94a3b8">Volver</Btn>
                <Btn onClick={unirse} bg="#8b5cf6" disabled={!inputCodigo.trim()}>Unirse</Btn>
            </div>
        </Card>
    );

    // ── Lobby ────────────────────────────────────────────────────────────────

    if (fase === 'lobby') return wrap(
        <div>
            <Card style={{ marginBottom: 14, textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 6 }}>Código de sesión</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: 10, color: COL }}>{codigo}</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4 }}>Comparte este código con tus compañeros</div>
            </Card>

            <Card style={{ marginBottom: 14 }}>
                <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 10 }}>
                    Participantes ({participantes.length})
                </div>
                {participantes.map((p, i) => (
                    <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < participantes.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: COL + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: COL }}>{i + 1}</div>
                        <span style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{p.nombre}</span>
                        {p.uid === sesion?.creadorUid && <span style={{ color: '#8b5cf6', fontSize: '0.72rem' }}>creador</span>}
                    </div>
                ))}
            </Card>

            {esCreador ? (
                <Btn onClick={iniciarJuego} bg="#22c55e" disabled={participantes.length < 1} style={{ width: '100%' }}>
                    ▶ Iniciar ({participantes.length} {participantes.length === 1 ? 'jugador' : 'jugadores'})
                </Btn>
            ) : (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: 12 }}>
                    Esperando a que el creador inicie la sesión…
                </div>
            )}
        </div>
    );

    // ── Escucha ──────────────────────────────────────────────────────────────

    if (fase === 'escucha') {
        const grid = sesion?.grid || gridVacio();
        const hayAlgo = grid.some(r => r.some(Boolean));
        return wrap(
            <div>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>👂</div>
                    <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.05rem' }}>
                        {hayAlgo ? 'Escucha lo que llevan hasta ahora…' : 'Eres el primero. ¡Empieza el ritmo!'}
                    </div>
                    {hayAlgo && <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>Tu turno empieza después</div>}
                </div>
                <GridEditor grid={grid} onToggle={() => {}} readOnly pulso={escuchaPulso} />
                {!hayAlgo && (
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <Btn onClick={() => { setTimerSeg(sesion?.tiempoPorTurno || 30); setFase('edicion'); }}>
                            Saltar escucha
                        </Btn>
                    </div>
                )}
            </div>
        );
    }

    // ── Edición ──────────────────────────────────────────────────────────────

    if (fase === 'edicion') {
        const urgente = timerSeg <= 10;
        return wrap(
            <div>
                {/* Timer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ color: urgente ? '#ef4444' : '#f1f5f9', fontWeight: 800, fontSize: '1.3rem' }}>
                        ⏱ {timerSeg}s
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Btn onClick={() => setEditPlaying(p => !p)} bg={editPlaying ? '#ef4444' : '#22c55e'} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
                            {editPlaying ? '⏹' : '▶'}
                        </Btn>
                        <Btn onClick={submitTurno} bg="#8b5cf6" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
                            Listo ✓
                        </Btn>
                    </div>
                </div>

                {/* Timer bar */}
                <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${(timerSeg / (sesion?.tiempoPorTurno || 30)) * 100}%`,
                        background: urgente ? '#ef4444' : COL,
                        transition: 'width 0.95s linear, background 0.3s',
                    }} />
                </div>

                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: 10 }}>
                    Las celdas sombreadas son de otros participantes. Añade tus propios beats.
                </div>

                <GridEditor grid={localGrid} onToggle={toggleCell} lockedGrid={baselineGrid} pulso={editPulso} />
            </div>
        );
    }

    // ── Esperando ────────────────────────────────────────────────────────────

    if (fase === 'esperando') {
        const turnoActual = sesion?.turnoActual ?? 0;
        const jugadorActivo = participantes[turnoActual];
        return wrap(
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>⏳</div>
                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>
                    Turno de {jugadorActivo?.nombre || '…'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 24 }}>
                    Turno {Math.min(turnoActual + 1, participantes.length)} de {participantes.length}
                </div>
                {/* Progress */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {participantes.map((p, i) => (
                        <div key={p.uid} style={{
                            padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
                            background: i < turnoActual ? '#22c55e22' : i === turnoActual ? COL + '33' : 'rgba(255,255,255,0.07)',
                            color: i < turnoActual ? '#22c55e' : i === turnoActual ? COL : '#64748b',
                            border: i === turnoActual ? `1px solid ${COL}` : '1px solid transparent',
                        }}>
                            {i < turnoActual ? '✓ ' : i === turnoActual ? '▶ ' : ''}{p.nombre}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Resultado ────────────────────────────────────────────────────────────

    if (fase === 'resultado') {
        const finalGrid = sesion?.grid || gridVacio();
        return wrap(
            <div>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                    <h3 style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: '1.1rem' }}>¡Beat completado!</h3>
                    <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                        {participantes.map(p => p.nombre).join(' · ')}
                    </div>
                </div>

                {/* Playback controls */}
                <Card style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Btn
                            onClick={() => setResultPlaying(p => !p)}
                            bg={resultPlaying ? '#ef4444' : '#22c55e'}
                            style={{ padding: '10px 22px', minWidth: 110 }}
                        >
                            {resultPlaying ? '⏹ Stop' : '▶ Escuchar'}
                        </Btn>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                BPM <b style={{ color: COL }}>{playbackBpm}</b>
                            </span>
                            <input type="range" min="60" max="200" value={playbackBpm}
                                onChange={e => setPlaybackBpm(Number(e.target.value))}
                                style={{ flex: 1, accentColor: COL, cursor: 'pointer' }} />
                        </div>
                    </div>
                </Card>

                <GridEditor grid={finalGrid} onToggle={() => {}} readOnly pulso={resultPulso} />

                {/* Download */}
                <div style={{ marginTop: 16 }}>
                    <Btn onClick={descargarWav} bg="#3b82f6" disabled={descargando} style={{ width: '100%' }}>
                        {descargando ? '⏳ Procesando…' : '⬇ Descargar WAV'}
                    </Btn>
                </div>

                {/* Send to teacher */}
                <Card style={{ marginTop: 14 }}>
                    <Label>Código del profesor (para enviarle el ritmo)</Label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={codigoProfesorInput}
                            onChange={e => setCodigoProfesorInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            placeholder="Ej: PROFA1"
                            maxLength={10}
                            disabled={enviado}
                            style={{ ...s.input, flex: 1, letterSpacing: 2 }}
                        />
                        <Btn
                            onClick={enviarAlProfesor}
                            bg={enviado ? '#22c55e' : '#8b5cf6'}
                            disabled={enviado || !codigoProfesorInput.trim()}
                        >
                            {enviado ? '✓ Enviado' : '📤 Enviar'}
                        </Btn>
                    </div>
                    {error && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8 }}>{error}</div>}
                    {enviado && <div style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 8 }}>Ritmo enviado correctamente al profesor.</div>}
                </Card>

                <div style={{ marginTop: 14 }}>
                    <Btn onClick={onBack} bg="rgba(255,255,255,0.1)" color="#94a3b8" style={{ width: '100%' }}>
                        Volver al menú
                    </Btn>
                </div>
            </div>
        );
    }

    return null;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
    backBtn: {
        background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f1f5f9',
        borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
    },
    input: {
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
        boxSizing: 'border-box',
    },
};
