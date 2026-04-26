import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── FETCH PREGUNTAS ──────────────────────────────────────────────────────────
async function fetchPreguntas(recurso, hoja) {
    const r = await getDoc(doc(db, 'resources', recurso.id));
    if (!r.exists()) return [];
    const data = r.data();
    const hojas = data.hojas || [];

    let preguntas = [];
    if (hoja === 'General') {
        hojas.forEach(h => { preguntas = preguntas.concat(h.preguntas || []); });
    } else {
        const h = hojas.find(h => h.nombreHoja === hoja);
        if (h) preguntas = h.preguntas || [];
    }

    return shuffle(preguntas).map((p, i) => ({
        pregunta:              p.pregunta    || p.question || '',
        respuestaCorrecta:     p.correcta    || p.respuesta || p.answer || '',
        respuestasIncorrectas: p.incorrectas || p.respuestasIncorrectas || [],
        nivel:                 p.nivel ?? 1,
    })).filter(p => p.pregunta && p.respuestaCorrecta);
}

// ─── PANTALLA PREVIA ──────────────────────────────────────────────────────────
function PantallaPrevia({ onIniciar }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [recursoSel, setRecursoSel] = useState(null);
    const [hojas, setHojas] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false))
                );
                setRecursos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) { console.error(e); }
            setCargando(false);
        })();
    }, []);

    const seleccionar = (r) => {
        setRecursoSel(r);
        setHojas(r.hojas?.map(h => h.nombreHoja).filter(Boolean) || []);
    };

    const iniciar = (hoja) => onIniciar(recursoSel, hoja);

    const st = {
        page:  { minHeight: '100vh', background: 'linear-gradient(135deg,#0d0221,#1a0533,#0f1f40)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI', sans-serif" },
        title: { fontSize: '2.2rem', fontWeight: 900, margin: '0 0 4px', background: 'linear-gradient(90deg,#a855f7,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
        sub:   { color: '#a0a0c0', marginBottom: 28, fontSize: '0.95rem' },
        grid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14, width: '100%', maxWidth: 860 },
        card:  (sel) => ({ background: sel ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)', border: `2px solid ${sel ? '#a855f7' : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }),
        hojaPanel: { marginTop: 28, width: '100%', maxWidth: 860 },
        hojaTitle: { fontWeight: 700, fontSize: '1.05rem', marginBottom: 12, color: '#f59e0b' },
        btnHoja: (i) => ({ padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'white', background: ['linear-gradient(135deg,#a855f7,#7c3aed)', 'linear-gradient(135deg,#ec4899,#be185d)', 'linear-gradient(135deg,#f59e0b,#d97706)', 'linear-gradient(135deg,#10b981,#047857)', 'linear-gradient(135deg,#3b82f6,#1d4ed8)'][i % 5] }),
        btnMix: { padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: '#1a0533', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>🏛️</div>
            <h1 style={st.title}>La Mansión Pitagórica</h1>
            <p style={st.sub}>Elige un recurso de preguntas para explorar la mansión</p>

            {cargando ? (
                <p style={{ color: '#a0a0c0' }}>Cargando recursos…</p>
            ) : (
                <>
                    <div style={st.grid}>
                        {recursos.map(r => (
                            <div key={r.id} style={st.card(recursoSel?.id === r.id)} onClick={() => seleccionar(r)}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>🫧 {r.titulo}</div>
                                <div style={{ color: '#a0a0c0', fontSize: '0.78rem' }}>{r.temas || 'Sin tema'} · {r.ciclo || ''}</div>
                                <div style={{ color: '#a0a0c0', fontSize: '0.78rem' }}>{r.hojas?.length || 1} hoja(s)</div>
                            </div>
                        ))}
                        {recursos.length === 0 && <p style={{ color: '#a0a0c0' }}>No hay recursos disponibles.</p>}
                    </div>

                    {recursoSel && (
                        <div style={st.hojaPanel}>
                            <div style={st.hojaTitle}>¿Qué preguntas quieres usar?</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {hojas.length > 1 && (
                                    <button style={st.btnMix} onClick={() => iniciar('General')}>🔀 Mezclar todas</button>
                                )}
                                {hojas.map((h, i) => (
                                    <button key={h} style={st.btnHoja(i)} onClick={() => iniciar(h)}>{h}</button>
                                ))}
                                {hojas.length === 0 && (
                                    <button style={st.btnMix} onClick={() => iniciar('General')}>🏛️ Entrar</button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── PANTALLA INSTRUCCIONES ───────────────────────────────────────────────────
function PantallaInstrucciones({ recurso, hoja, onEmpezar }) {
    const st = {
        page:  { minHeight: '100vh', background: 'linear-gradient(135deg,#0d0221,#1a0533,#0f1f40)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI', sans-serif" },
        card:  { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480 },
        title: { fontSize: '1.6rem', fontWeight: 900, margin: '0 0 6px', color: '#a855f7' },
        sub:   { color: '#a0a0c0', marginBottom: 22, fontSize: '0.88rem' },
        row:   { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.92rem' },
        icon:  { fontSize: '1.3rem', width: 30, flexShrink: 0, textAlign: 'center' },
        btn:   { width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '1.2rem', color: 'white', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', boxShadow: '0 6px 24px rgba(168,85,247,0.5)', marginTop: 24, letterSpacing: 1 },
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🏛️</div>
            <div style={st.card}>
                <h1 style={st.title}>¡A explorar!</h1>
                <p style={st.sub}>{recurso.titulo} · {hoja}</p>
                <div style={st.row}><span style={st.icon}>🧩</span><span>Responde las preguntas para avanzar por las salas de la mansión</span></div>
                <div style={st.row}><span style={st.icon}>✅</span><span>Responder <b>correctamente</b> abre las puertas y suma puntos</span></div>
                <div style={st.row}><span style={st.icon}>❌</span><span>Responder <b>mal</b> activa las trampas de la mansión</span></div>
                <div style={st.row}><span style={st.icon}>🏆</span><span>¡Escapa de la mansión con la máxima puntuación!</span></div>
                <button style={st.btn} onClick={onEmpezar}>🔮 ¡ENTRAR!</button>
            </div>
        </div>
    );
}

// ─── PANTALLA RESULTADO ───────────────────────────────────────────────────────
function PantallaResultados({ resultado, recurso, onSalir }) {
    const [guardando, setGuardando] = useState(false);
    const [guardado,  setGuardado]  = useState(false);
    const [ranking,   setRanking]   = useState([]);
    const [modalProfe, setModalProfe] = useState(false);

    useEffect(() => { cargarRanking(); }, []);

    const cargarRanking = async () => {
        try {
            const snap = await getDocs(query(
                collection(db, 'ranking'),
                where('recursoId', '==', recurso.id),
                where('tipoJuego', '==', 'MANSION_PITAGORICA'),
                orderBy('puntos', 'desc'),
                limit(10)
            ));
            setRanking(snap.docs.map(d => d.data()));
        } catch (e) { console.warn(e); }
    };

    const guardar = async () => {
        if (guardando || guardado) return;
        setGuardando(true);
        try {
            await addDoc(collection(db, 'ranking'), {
                recursoId: recurso.id,
                recursoTitulo: recurso.titulo,
                tipoJuego: 'MANSION_PITAGORICA',
                categoria: resultado.hoja || 'General',
                jugador: 'Jugador',
                puntos: resultado.puntos ?? 0,
                fecha: new Date(),
            });
            setGuardado(true);
            cargarRanking();
        } catch (e) { console.error(e); }
        setGuardando(false);
    };

    const st = {
        page: { minHeight: '100vh', background: 'linear-gradient(135deg,#0d0221,#1a0533,#0f1f40)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI', sans-serif" },
        box:  { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '26px 30px', width: '100%', maxWidth: 440, marginBottom: 20 },
        stat: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '1rem' },
        btn:  (bg) => ({ padding: '13px 26px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'white', background: bg }),
        row:  (i) => ({ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent', fontSize: '0.88rem' }),
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>🏆</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 22px', color: '#f59e0b' }}>¡Mansión completada!</h1>

            <div style={st.box}>
                <div style={st.stat}><span>🏆 Puntos</span><b>{resultado.puntos ?? '—'}</b></div>
                {resultado.aciertos !== undefined && <div style={st.stat}><span>✅ Aciertos</span><b>{resultado.aciertos}</b></div>}
                {resultado.fallos   !== undefined && <div style={st.stat}><span>❌ Fallos</span><b>{resultado.fallos}</b></div>}
                <div style={{ ...st.stat, borderBottom: 'none' }}><span>📚 Recurso</span><b style={{ maxWidth: 200, textAlign: 'right', fontSize: '0.88rem' }}>{recurso.titulo}</b></div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                {!guardado
                    ? <button style={st.btn('linear-gradient(135deg,#a855f7,#7c3aed)')} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar en ranking'}</button>
                    : <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Guardado</span>
                }
                <button style={st.btn('linear-gradient(135deg,#3b82f6,#1d4ed8)')} onClick={() => setModalProfe(true)}>📤 Enviar al profesor</button>
                <button style={st.btn('rgba(255,255,255,0.1)')} onClick={onSalir}>🏠 Salir</button>
            </div>

            {ranking.length > 0 && (
                <div style={{ ...st.box, maxWidth: 440 }}>
                    <h3 style={{ margin: '0 0 12px', color: '#f59e0b' }}>🏆 Ranking</h3>
                    {ranking.map((r, i) => (
                        <div key={i} style={st.row(i)}>
                            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {r.jugador}</span>
                            <span>{r.puntos} pts</span>
                        </div>
                    ))}
                </div>
            )}

            {modalProfe && <ModalEnviarProfe resultado={resultado} recurso={recurso} onClose={() => setModalProfe(false)} />}
        </div>
    );
}

// ─── MODAL ENVIAR PROFESOR ────────────────────────────────────────────────────
function ModalEnviarProfe({ resultado, recurso, onClose }) {
    const [nombre,   setNombre]   = useState('');
    const [curso,    setCurso]    = useState('');
    const [codigo,   setCodigo]   = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'MANSION_PITAGORICA', modalidad: 'Individual', fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), puntos: resultado.puntos ?? 0, aciertos: resultado.aciertos ?? 0, fallos: resultado.fallos ?? 0 }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const st = {
        overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 },
        box:     { background: '#120a2a', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 20, width: '100%', maxWidth: 370, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI', sans-serif" },
        inp:     { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
    };

    return (
        <div style={st.overlay}>
            <div style={st.box}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: '#a855f7' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '2.5rem' }}>✅</div>
                        <div style={{ color: '#10b981', fontWeight: 700, marginTop: 8 }}>¡Enviado!</div>
                        <div style={{ color: '#a0a0c0', fontSize: '0.85rem', marginTop: 4 }}>Puntos: {resultado.puntos ?? 0}</div>
                        <button onClick={onClose} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={{ fontSize: '0.78rem', color: '#a0a0c0', display: 'block', marginBottom: 4 }}>Nombre</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={st.inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#a0a0c0', display: 'block', marginBottom: 4 }}>Curso</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={st.inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#a0a0c0', display: 'block', marginBottom: 4 }}>Código del profesor</label><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="PROF01" maxLength={10} style={{ ...st.inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#444' : 'linear-gradient(135deg,#a855f7,#7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                {enviando ? 'Enviando…' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── LANZADOR DEL JUEGO (iframe + comunicación) ───────────────────────────────
function MansionLauncher({ recurso, hoja, onResultado, onSalir }) {
    const iframeRef  = useRef(null);
    const mobile     = useMemo(() => isMobile(), []);
    const [listo,    setListo]    = useState(!mobile);
    const [cargando, setCargando] = useState(true);
    const enviadoRef = useRef(false);
    const [saliendo, setSaliendo] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Cache-bust URL — fijo en el mount para que no cambie con re-renders
    const src = useMemo(() => `/build nuevo/index.html?_t=${Date.now()}`, []);

    // MOBILE: navegar directamente a la página del juego (evita el bug de WASM en iOS)
    useEffect(() => {
        if (!mobile) return;
        (async () => {
            const preguntas = await fetchPreguntas(recurso, hoja);
            if (preguntas.length > 0) {
                sessionStorage.setItem('mansionPreguntas', JSON.stringify({ arrayPreguntas: preguntas }));
            }
            sessionStorage.setItem('mansionContext', JSON.stringify({
                recursoId: recurso.id,
                recursoTitulo: recurso.titulo,
                hoja
            }));
            window.location.href = `/build nuevo/index.html?_t=${Date.now()}`;
        })();
    }, []);

    const enviarPreguntas = async () => {
        if (enviadoRef.current) return;
        enviadoRef.current = true;
        const preguntas = await fetchPreguntas(recurso, hoja);
        if (preguntas.length === 0) {
            enviadoRef.current = false;
            console.warn('[Mansion] fetchPreguntas devolvió 0 — reintento posible');
            return;
        }
        setCargando(false);
        iframeRef.current?.contentWindow?.postMessage(
            { type: 'MANSION_PREGUNTAS', preguntas },
            '*'
        );
    };

    // Escuchar mensajes de Unity / index.html (solo desktop — iframe)
    useEffect(() => {
        if (mobile) return;
        const handler = (e) => {
            if (e.data?.type === 'MANSION_LISTO') {
                enviarPreguntas();
            }
            if (e.data?.type === 'MANSION_RESULTADO') {
                onResultado(e.data.data);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    // Fallback: si MANSION_LISTO no llega en 10 s, enviar de todas formas (solo desktop)
    useEffect(() => {
        if (mobile) return;
        const t = setTimeout(enviarPreguntas, 10000);
        return () => clearTimeout(t);
    }, []);

    const handleSalir = () => {
        if (saliendo) return;
        setSaliendo(true);
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            try { document.exitFullscreen?.() || document.webkitExitFullscreen?.(); } catch (_) {}
        }
        try { iframeRef.current?.contentWindow?.postMessage('UNITY_QUIT', '*'); } catch (_) {}
        try { iframeRef.current.src = 'about:blank'; } catch (_) {}
        setTimeout(() => onSalir(), 900);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        setListo(true);
    };

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}>

            {/* Splash móvil */}
            {!listo && (
                <div onClick={toggleFullscreen} style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#0d0221', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 16 }}>🏛️</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#a855f7' }}>La Mansión Pitagórica</div>
                    <div style={{ marginTop: 24, padding: '14px 36px', borderRadius: 14, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', fontWeight: 700, fontSize: '1rem' }}>
                        ▶ Toca para jugar a pantalla completa
                    </div>
                </div>
            )}

            {cargando && listo && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(13,2,33,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏛️</div>
                    <div style={{ color: '#a855f7', fontWeight: 700 }}>Cargando preguntas…</div>
                </div>
            )}

            <button onClick={handleSalir} style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '1.1rem' }} title="Salir">
                ⬅
            </button>

            <button onClick={toggleFullscreen} style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '1.1rem' }} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
                {isFullscreen ? '⛶' : '⤢'}
            </button>

            <iframe
                ref={iframeRef}
                src={src}
                title="La Mansión Pitagórica"
                allow="fullscreen"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function MansionPitagoricaGame({ alTerminar }) {
    const [fase,      setFase]      = useState('PREVIO');  // PREVIO | INSTRUCCIONES | JUGANDO | RESULTADO
    const [recurso,   setRecurso]   = useState(null);
    const [hoja,      setHoja]      = useState('General');
    const [resultado, setResultado] = useState(null);

    // Recuperar resultado guardado por la navegación móvil (full-page mode)
    useEffect(() => {
        const resultadoStr = sessionStorage.getItem('mansionResultado');
        const ctxStr = sessionStorage.getItem('mansionContext');
        if (resultadoStr && ctxStr) {
            sessionStorage.removeItem('mansionResultado');
            sessionStorage.removeItem('mansionContext');
            try {
                const data = JSON.parse(resultadoStr);
                const ctx  = JSON.parse(ctxStr);
                const rec  = { id: ctx.recursoId, titulo: ctx.recursoTitulo };
                setRecurso(rec);
                setHoja(ctx.hoja);
                setResultado({ ...data, hoja: ctx.hoja });
                setFase('RESULTADO');
            } catch (e) { console.error('[Mansion] Error leyendo sessionStorage:', e); }
        }
    }, []);

    const iniciar = (rec, hojaElegida) => {
        setRecurso(rec);
        setHoja(hojaElegida);
        setFase('INSTRUCCIONES');
    };

    if (fase === 'PREVIO')
        return <PantallaPrevia onIniciar={iniciar} />;

    if (fase === 'INSTRUCCIONES')
        return <PantallaInstrucciones recurso={recurso} hoja={hoja} onEmpezar={() => setFase('JUGANDO')} />;

    if (fase === 'RESULTADO' && resultado)
        return <PantallaResultados resultado={resultado} recurso={recurso} onSalir={alTerminar} />;

    return (
        <MansionLauncher
            recurso={recurso}
            hoja={hoja}
            onResultado={(data) => { setResultado({ ...data, hoja }); setFase('RESULTADO'); }}
            onSalir={alTerminar}
        />
    );
}
