import { useState, useEffect } from 'react';
import GameLauncher from './components/GameLauncher';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, getCountFromServer } from 'firebase/firestore';

// ─────────────────────────────────────────────
// PANTALLA PREVIA: selector de recurso y hoja
// ─────────────────────────────────────────────
function PantallaPrevia({ usuario, onIniciar }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [recursoSeleccionado, setRecursoSeleccionado] = useState(null);
    const [hojas, setHojas] = useState([]);

    useEffect(() => {
        const fetchRecursos = async () => {
            try {
                const [snapBurbujas, snapKart] = await Promise.all([
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false))),
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'KARTINGED'),    where('isPrivate', '==', false))),
                ]);
                const todos = [
                    ...snapBurbujas.docs.map(d => ({ id: d.id, ...d.data() })),
                    ...snapKart.docs.map(d => ({ id: d.id, ...d.data() })),
                ];
                setRecursos(todos);
            } catch (e) {
                console.error('Error cargando recursos Racing 3D:', e);
            }
            setCargando(false);
        };
        fetchRecursos();
    }, []);

    const seleccionarRecurso = (r) => {
        setRecursoSeleccionado(r);
        setHojas(r.hojas?.map(h => h.nombreHoja).filter(Boolean) || []);
    };

    const st = {
        container: { minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a1a,#1a0a2e,#0a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
        title: { fontSize: '2.2rem', fontWeight: 900, margin: '0 0 6px', background: 'linear-gradient(90deg,#00C6FF,#7B2FFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
        subtitle: { color: '#aaa', marginBottom: 30 },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16, width: '100%', maxWidth: 860 },
        card: (sel) => ({ background: sel ? 'rgba(0,198,255,0.18)' : 'rgba(255,255,255,0.06)', border: `2px solid ${sel ? '#00C6FF' : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }),
        sheetPanel: { marginTop: 28, width: '100%', maxWidth: 860 },
        sheetTitle: { fontWeight: 700, fontSize: '1.1rem', marginBottom: 14, color: '#00C6FF' },
        sheetGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
        sheetBtn: (i) => ({ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'white', background: ['linear-gradient(135deg,#00C6FF,#0072FF)', 'linear-gradient(135deg,#7B2FFF,#4A00E0)', 'linear-gradient(135deg,#00F260,#0575E6)', 'linear-gradient(135deg,#f7971e,#ffd200)', 'linear-gradient(135deg,#ee0979,#ff6a00)', 'linear-gradient(135deg,#56ab2f,#a8e063)'][i % 6] }),
        mixBtn: { padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#0a0a1a', background: 'linear-gradient(135deg,#00C6FF,#7B2FFF)' },
    };

    return (
        <div style={st.container}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏁</div>
            <h1 style={st.title}>Racing 3D Educativo</h1>
            <p style={st.subtitle}>Elige un recurso para cargar las preguntas de la carrera</p>

            {cargando ? (
                <p style={{ color: '#aaa' }}>Cargando recursos...</p>
            ) : (
                <>
                    <div style={st.grid}>
                        {recursos.map(r => (
                            <div key={r.id} style={st.card(recursoSeleccionado?.id === r.id)} onClick={() => seleccionarRecurso(r)}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>🏎️ {r.titulo}</div>
                                <div style={{ color: '#aaa', fontSize: '0.78rem' }}>{r.temas || 'Sin tema'} · {r.ciclo || ''}</div>
                                <div style={{ color: '#aaa', fontSize: '0.78rem' }}>{r.hojas?.length || 1} hoja(s)</div>
                            </div>
                        ))}
                        {recursos.length === 0 && <p style={{ color: '#aaa' }}>No hay recursos disponibles.</p>}
                    </div>

                    {recursoSeleccionado && (
                        <div style={st.sheetPanel}>
                            <div style={st.sheetTitle}>¿Con qué preguntas quieres jugar?</div>
                            <div style={st.sheetGrid}>
                                {hojas.length > 1 && (
                                    <button style={st.mixBtn} onClick={() => onIniciar(recursoSeleccionado, 'General')}>
                                        🔀 Mezclar todas las hojas
                                    </button>
                                )}
                                {hojas.map((h, i) => (
                                    <button key={h} style={st.sheetBtn(i)} onClick={() => onIniciar(recursoSeleccionado, h)}>{h}</button>
                                ))}
                                {hojas.length === 0 && (
                                    <button style={st.mixBtn} onClick={() => onIniciar(recursoSeleccionado, 'General')}>🏁 Jugar</button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// PANTALLA DE INSTRUCCIONES
// ─────────────────────────────────────────────
function PantallaInstrucciones({ recurso, hoja, onEmpezar }) {
    const st = {
        page: { minHeight: '100vh', background: 'linear-gradient(160deg,#0a0a1a 0%,#1a0a2e 50%,#0a1a1a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
        card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,198,255,0.35)', borderRadius: 24, padding: '36px 40px', maxWidth: 560, width: '100%', boxShadow: '0 0 60px rgba(0,198,255,0.12)' },
        title: { fontSize: '2rem', fontWeight: 900, textAlign: 'center', margin: '0 0 4px', background: 'linear-gradient(90deg,#00C6FF,#7B2FFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
        sub: { textAlign: 'center', color: '#aaa', marginBottom: 28, fontSize: '0.9rem' },
        sectionTitle: { fontWeight: 700, color: '#00C6FF', fontSize: '0.85rem', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
        row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: '0.95rem' },
        icon: { fontSize: '1.4rem', width: 36, textAlign: 'center', flexShrink: 0 },
        kbd: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, padding: '3px 10px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#00C6FF' },
        btn: { width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '1.2rem', color: 'white', background: 'linear-gradient(135deg,#00C6FF,#7B2FFF)', boxShadow: '0 6px 24px rgba(0,198,255,0.4)', marginTop: 8, letterSpacing: 1 },
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🏁</div>
            <div style={st.card}>
                <h1 style={st.title}>¡A las pistas!</h1>
                <p style={st.sub}>{recurso.titulo} · {hoja}</p>

                <div style={{ marginBottom: 22 }}>
                    <div style={st.sectionTitle}>🏁 Objetivo</div>
                    <div style={st.row}><span style={st.icon}>🔄</span><span>Completa <b>4 vueltas</b> al circuito en el menor tiempo posible</span></div>
                    <div style={st.row}><span style={st.icon}>✅</span><span>Responder <b>correctamente</b> en checkpoints <b>suma puntos</b></span></div>
                    <div style={st.row}><span style={st.icon}>❌</span><span>Responder <b>mal</b> añade <b>+5 segundos</b> de penalización</span></div>
                    <div style={st.row}><span style={st.icon}>🤖</span><span><b>3 coches AI</b> compiten contra ti</span></div>
                </div>

                <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

                <div style={{ marginBottom: 22 }}>
                    <div style={st.sectionTitle}>🎮 Controles</div>
                    <div style={st.row}><span style={st.icon}>⬆️</span><span><span style={st.kbd}>W</span> / <span style={st.kbd}>↑</span> — Acelerar</span></div>
                    <div style={st.row}><span style={st.icon}>⬇️</span><span><span style={st.kbd}>S</span> / <span style={st.kbd}>↓</span> — Frenar / Reversa</span></div>
                    <div style={st.row}><span style={st.icon}>↩️</span><span><span style={st.kbd}>A</span> <span style={st.kbd}>D</span> / <span style={st.kbd}>←</span> <span style={st.kbd}>→</span> — Girar</span></div>
                    <div style={st.row}><span style={st.icon}>🕹️</span><span>Joystick analógico también compatible</span></div>
                </div>

                <button style={st.btn} onClick={onEmpezar}>🚦 ¡EMPEZAR CARRERA!</button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// MODAL ENVIAR AL PROFESOR
// ─────────────────────────────────────────────
function ModalEnviarProfe({ resultado, recurso, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'KARTINGED', modalidad: 'Racing3D', fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo,
                hoja: resultado.hoja, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, hoja: resultado.hoja }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const st = { overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }, box: { background: '#0d0d1f', border: '1px solid rgba(0,198,255,0.2)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }, input: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' } };

    return (
        <div style={st.overlay}>
            <div style={st.box}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, color: '#00C6FF' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, marginTop: 8 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false], ['Curso', curso, setCurso, 'Ej: 3º ESO A', false], ['Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]].map(([label, val, setter, ph, mono], i) => (
                            <div key={i}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={{ ...st.input, letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }} />
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#00C6FF,#7B2FFF)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// PANTALLA DE RESULTADOS
// ─────────────────────────────────────────────
function PantallaResultados({ resultado, recurso, usuario, onSalir }) {
    const [ranking, setRanking] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [miPosicion, setMiPosicion] = useState(null);
    const [modalProfe, setModalProfe] = useState(false);

    useEffect(() => { cargarRanking(); }, []);

    const cargarRanking = async () => {
        try {
            const snap = await getDocs(query(
                collection(db, 'ranking'),
                where('recursoId', '==', recurso.id),
                where('categoria', '==', resultado.hoja),
                where('tipoJuego', '==', 'RACING3D'),
                orderBy('tiempo', 'asc'),
                limit(10)
            ));
            setRanking(snap.docs.map(d => d.data()));
        } catch (e) { console.warn('Ranking:', e); }
    };

    const guardarRanking = async () => {
        if (guardando || guardado) return;
        setGuardando(true);
        const nombre = usuario?.displayName || 'Anónimo';
        const email = usuario?.email || 'invitado';
        try {
            const snapBetter = await getCountFromServer(query(
                collection(db, 'ranking'),
                where('recursoId', '==', recurso.id),
                where('categoria', '==', resultado.hoja),
                where('tipoJuego', '==', 'RACING3D'),
                where('tiempo', '<', resultado.tiempo)
            ));
            const pos = snapBetter.data().count + 1;
            setMiPosicion(pos);
            const medalla = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';

            if (email !== 'invitado') {
                const snap = await getDocs(query(collection(db, 'ranking'), where('recursoId', '==', recurso.id), where('categoria', '==', resultado.hoja), where('email', '==', email), where('tipoJuego', '==', 'RACING3D')));
                if (!snap.empty) {
                    const existing = snap.docs[0];
                    if (resultado.tiempo < existing.data().tiempo)
                        await updateDoc(doc(db, 'ranking', existing.id), { tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla });
                } else {
                    await addDoc(collection(db, 'ranking'), { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'RACING3D', categoria: resultado.hoja, email, jugador: nombre, tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla });
                }
            } else {
                await addDoc(collection(db, 'ranking'), { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'RACING3D', categoria: resultado.hoja, email, jugador: nombre, tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla });
            }
            setGuardado(true);
            cargarRanking();
        } catch (e) { console.error(e); }
        setGuardando(false);
    };

    const st = {
        page: { minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a1a,#1a0a2e,#0a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
        box: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,198,255,0.2)', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480, marginBottom: 24 },
        stat: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '1.05rem' },
        btn: (bg) => ({ padding: '13px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'white', background: bg }),
        row: (i) => ({ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent', fontSize: '0.9rem' }),
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏁</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 24px', color: '#00C6FF' }}>¡Carrera terminada!</h1>

            <div style={st.box}>
                <div style={st.stat}><span>⏱ Tiempo</span><b>{resultado.tiempoFormateado}</b></div>
                <div style={st.stat}><span>🏆 Puntos</span><b>{resultado.puntos}</b></div>
                <div style={st.stat}><span>🚦 Posición</span><b>{resultado.posicion}º</b></div>
                <div style={{ ...st.stat, borderBottom: 'none' }}><span>📚 Recurso</span><b style={{ maxWidth: 200, textAlign: 'right', fontSize: '0.9rem' }}>{recurso.titulo} — {resultado.hoja}</b></div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                {!guardado
                    ? <button style={st.btn('linear-gradient(135deg,#00C6FF,#0072FF)')} onClick={guardarRanking} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar en ranking'}</button>
                    : <div style={{ color: '#2ecc71', fontWeight: 700 }}>✅ Guardado {miPosicion ? `— Posición #${miPosicion}` : ''}</div>
                }
                <button style={st.btn('linear-gradient(135deg,#7B2FFF,#4A00E0)')} onClick={() => setModalProfe(true)}>📤 Enviar al profesor</button>
                <button style={st.btn('rgba(255,255,255,0.1)')} onClick={onSalir}>🏠 Salir</button>
            </div>

            {ranking.length > 0 && (
                <div style={{ ...st.box, maxWidth: 480 }}>
                    <h3 style={{ margin: '0 0 14px', color: '#00C6FF' }}>🏆 Ranking — {resultado.hoja}</h3>
                    {ranking.map((r, i) => (
                        <div key={i} style={st.row(i)}>
                            <span>{r.medalla || `#${i + 1}`} {r.jugador}</span>
                            <span>{r.tiempoFormateado} · {r.puntos} pts</span>
                        </div>
                    ))}
                </div>
            )}

            {modalProfe && <ModalEnviarProfe resultado={resultado} recurso={recurso} onClose={() => setModalProfe(false)} />}
        </div>
    );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function RacingGame3D({ usuario, alTerminar }) {
    const [fase, setFase] = useState('PREVIO');
    const [recurso, setRecurso] = useState(null);
    const [hoja, setHoja] = useState('General');
    const [resultado, setResultado] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            if (e.data?.type === 'KARTINGED_RESULT') {
                setResultado(e.data.data);
                setFase('RESULTADO');
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const iniciarJuego = (rec, hojaElegida) => {
        setRecurso(rec);
        setHoja(hojaElegida);
        setFase('INSTRUCCIONES');
    };

    if (fase === 'PREVIO')
        return <PantallaPrevia usuario={usuario} onIniciar={iniciarJuego} />;

    if (fase === 'INSTRUCCIONES')
        return <PantallaInstrucciones recurso={recurso} hoja={hoja} onEmpezar={() => setFase('JUGANDO')} />;

    if (fase === 'RESULTADO' && resultado)
        return <PantallaResultados resultado={resultado} recurso={recurso} usuario={usuario} onSalir={alTerminar} />;

    // JUGANDO — iframe Unity 3D
    const hojaParam = encodeURIComponent(hoja);
    const iframeSrc = `/racing3d/index.html?recursoId=${recurso.id}&hoja=${hojaParam}`;

    return (
        <GameLauncher
            src={iframeSrc}
            title="Racing 3D Educativo"
            onMessage={(data) => { if (data.type === 'KARTINGED_RESULT') { setResultado(data.data); setFase('RESULTADO'); } }}
            onSalir={alTerminar}
        />
    );
}
