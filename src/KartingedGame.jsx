import { useState, useEffect, useRef } from 'react';
import GameLauncher from './components/GameLauncher';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
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
                // Dos consultas separadas para evitar índice compuesto en Firestore
                const [snapBurbujas, snapKart] = await Promise.all([
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false))),
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'KARTINGED'), where('isPrivate', '==', false))),
                ]);
                const todos = [
                    ...snapBurbujas.docs.map(d => ({ id: d.id, ...d.data() })),
                    ...snapKart.docs.map(d => ({ id: d.id, ...d.data() })),
                ];
                setRecursos(todos);
            } catch (e) {
                console.error('Error cargando recursos Karting:', e);
            }
            setCargando(false);
        };
        fetchRecursos();
    }, []);

    const seleccionarRecurso = (r) => {
        setRecursoSeleccionado(r);
        setHojas(r.hojas?.map(h => h.nombreHoja).filter(Boolean) || []);
    };

    const iniciar = (hoja) => onIniciar(recursoSeleccionado, hoja);

    const styles = {
        container: { minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
        title: { fontSize: '2.2rem', fontWeight: 900, margin: '0 0 6px', background: 'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
        subtitle: { color: '#aaa', marginBottom: 30 },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16, width: '100%', maxWidth: 860 },
        card: (selected) => ({ background: selected ? 'rgba(255,107,0,0.25)' : 'rgba(255,255,255,0.07)', border: `2px solid ${selected ? '#FF6B00' : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }),
        cardTitle: { fontWeight: 700, fontSize: '1rem', marginBottom: 4 },
        cardSub: { color: '#aaa', fontSize: '0.78rem' },
        sheetPanel: { marginTop: 28, width: '100%', maxWidth: 860 },
        sheetTitle: { fontWeight: 700, fontSize: '1.1rem', marginBottom: 14, color: '#FFD700' },
        sheetGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
        sheetBtn: (i) => ({ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'white', background: ['linear-gradient(135deg,#FF6B00,#CC4400)', 'linear-gradient(135deg,#2196F3,#1565C0)', 'linear-gradient(135deg,#9C27B0,#6A1B9A)', 'linear-gradient(135deg,#4CAF50,#2E7D32)', 'linear-gradient(135deg,#FF9800,#E65100)', 'linear-gradient(135deg,#E91E63,#AD1457)'][i % 6] }),
        mixBtn: { padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#1a1a2e', background: 'linear-gradient(135deg,#FFD700,#FFA000)' },
    };

    return (
        <div style={styles.container}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏎️</div>
            <h1 style={styles.title}>Karting Educativo</h1>
            <p style={styles.subtitle}>Elige un recurso para cargar las preguntas de la carrera</p>

            {cargando ? (
                <p style={{ color: '#aaa' }}>Cargando recursos...</p>
            ) : (
                <>
                    <div style={styles.grid}>
                        {recursos.map(r => (
                            <div key={r.id} style={styles.card(recursoSeleccionado?.id === r.id)} onClick={() => seleccionarRecurso(r)}>
                                <div style={styles.cardTitle}>🚗 {r.titulo}</div>
                                <div style={styles.cardSub}>{r.temas || 'Sin tema'} · {r.ciclo || ''}</div>
                                <div style={styles.cardSub}>{r.hojas?.length || 1} hoja(s)</div>
                            </div>
                        ))}
                        {recursos.length === 0 && <p style={{ color: '#aaa' }}>No hay recursos disponibles.</p>}
                    </div>

                    {recursoSeleccionado && (
                        <div style={styles.sheetPanel}>
                            <div style={styles.sheetTitle}>¿Con qué preguntas quieres jugar?</div>
                            <div style={styles.sheetGrid}>
                                {hojas.length > 1 && (
                                    <button style={styles.mixBtn} onClick={() => iniciar('General')}>
                                        🔀 Mezclar todas las hojas
                                    </button>
                                )}
                                {hojas.map((h, i) => (
                                    <button key={h} style={styles.sheetBtn(i)} onClick={() => iniciar(h)}>
                                        {h}
                                    </button>
                                ))}
                                {hojas.length === 0 && (
                                    <button style={styles.mixBtn} onClick={() => iniciar('General')}>
                                        🏁 Jugar
                                    </button>
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
// PANTALLA DE RESULTADOS + RANKING + ENVÍO PROFE
// ─────────────────────────────────────────────
function PantallaResultados({ resultado, recurso, usuario, onSalir }) {
    const [ranking, setRanking] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [miPosicion, setMiPosicion] = useState(null);
    const [modalProfe, setModalProfe] = useState(false);
    const [autoGuardado, setAutoGuardado] = useState(false);

    useEffect(() => {
        cargarRanking();
        autoGuardarInforme();
    }, []);

    const autoGuardarInforme = async () => {
        try {
            if (!recurso.profesorUid) return;
            const profSnap = await getDoc(doc(db, 'users', recurso.profesorUid));
            if (!profSnap.exists()) return;
            const codigoProfesor = profSnap.data().codigoProfesor;
            if (!codigoProfesor) return;

            const nombre = usuario?.displayName || 'Anónimo';
            const email  = usuario?.email || 'invitado';
            const acertadas = resultado.acertadas ?? 0;
            const falladas  = resultado.falladas  ?? 0;
            const total     = acertadas + falladas;
            const pct       = total > 0 ? Math.round(acertadas / total * 100) : 0;

            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'KARTINGED', modalidad: 'Individual', fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo,
                hoja: resultado.hoja, codigoProfesor,
                jugadores: [{ nombre, email, hoja: resultado.hoja,
                    tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado,
                    puntos: resultado.puntos, posicion: resultado.posicion,
                    intentos: total, aciertos: acertadas, fallos: falladas, porcentaje: pct }],
            });
            setAutoGuardado(true);
        } catch (e) { console.error('Auto-save informe:', e); }
    };

    const cargarRanking = async () => {
        try {
            const snap = await getDocs(query(
                collection(db, 'ranking'),
                where('recursoId', '==', recurso.id),
                where('categoria', '==', resultado.hoja),
                where('tipoJuego', '==', 'KARTINGED'),
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
        const email  = usuario?.email || 'invitado';
        try {
            // Calcular posición por tiempo (menor es mejor)
            const snapBetter = await getCountFromServer(query(
                collection(db, 'ranking'),
                where('recursoId', '==', recurso.id),
                where('categoria', '==', resultado.hoja),
                where('tipoJuego', '==', 'KARTINGED'),
                where('tiempo', '<', resultado.tiempo)
            ));
            const pos = snapBetter.data().count + 1;
            setMiPosicion(pos);
            const medalla = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';

            if (email !== 'invitado') {
                const snap = await getDocs(query(
                    collection(db, 'ranking'),
                    where('recursoId', '==', recurso.id),
                    where('categoria', '==', resultado.hoja),
                    where('email', '==', email),
                    where('tipoJuego', '==', 'KARTINGED')
                ));
                if (!snap.empty) {
                    const existing = snap.docs[0];
                    if (resultado.tiempo < existing.data().tiempo) {
                        await updateDoc(doc(db, 'ranking', existing.id), { tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla });
                    }
                } else {
                    await addDoc(collection(db, 'ranking'), { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'KARTINGED', categoria: resultado.hoja, email, jugador: nombre, tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla });
                }
            } else {
                await addDoc(collection(db, 'ranking'), { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'KARTINGED', categoria: resultado.hoja, email, jugador: nombre, tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado, puntos: resultado.puntos, posicion: resultado.posicion, fecha: new Date(), medalla });
            }
            guardarRegistroLocal('KARTINGED', {
                titulo: recurso.titulo, aciertos: resultado.acertadas ?? 0,
                intentos: (resultado.acertadas ?? 0) + (resultado.falladas ?? 0),
                nombre, via: 'ranking',
            });
            setGuardado(true);
            cargarRanking();
        } catch (e) { console.error(e); }
        setGuardando(false);
    };

    const st = {
        page: { minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
        box: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480, marginBottom: 24 },
        stat: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '1.05rem' },
        btn: (bg) => ({ padding: '13px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'white', background: bg }),
        row: (i) => ({ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent', fontSize: '0.9rem' }),
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏁</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 24px', color: '#FFD700' }}>¡Carrera terminada!</h1>

            <div style={st.box}>
                <div style={st.stat}><span>⏱ Tiempo</span><b>{resultado.tiempoFormateado}</b></div>
                <div style={st.stat}><span>🏆 Puntos</span><b>{resultado.puntos}</b></div>
                <div style={st.stat}><span>🚦 Posición</span><b>{resultado.posicion}º</b></div>
                {resultado.acertadas != null && (
                    <div style={st.stat}><span>✅ Acertadas</span><b style={{ color: '#2ecc71' }}>{resultado.acertadas}</b></div>
                )}
                {resultado.falladas != null && (
                    <div style={st.stat}><span>❌ Falladas</span><b style={{ color: '#e74c3c' }}>{resultado.falladas}</b></div>
                )}
                {resultado.acertadas != null && resultado.falladas != null && resultado.acertadas + resultado.falladas > 0 && (
                    <div style={st.stat}><span>📊 Acierto</span><b>{Math.round(resultado.acertadas / (resultado.acertadas + resultado.falladas) * 100)}%</b></div>
                )}
                <div style={{ ...st.stat, borderBottom: 'none' }}><span>📚 Recurso</span><b style={{ maxWidth: 200, textAlign: 'right', fontSize: '0.9rem' }}>{recurso.titulo} — {resultado.hoja}</b></div>
            </div>

            {autoGuardado && (
                <div style={{ color: '#2ecc71', fontSize: '0.82rem', marginBottom: 8 }}>
                    ✅ Informe enviado al profesor automáticamente
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                {!guardado
                    ? <button style={st.btn('linear-gradient(135deg,#FF6B00,#CC4400)')} onClick={guardarRanking} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar en ranking'}</button>
                    : <div style={{ color: '#2ecc71', fontWeight: 700 }}>✅ Guardado {miPosicion ? `— Posición #${miPosicion}` : ''}</div>
                }
                <button style={st.btn('linear-gradient(135deg,#3498db,#1a5276)')} onClick={() => setModalProfe(true)}>📤 Enviar al profesor</button>
                <button style={st.btn('rgba(255,255,255,0.1)')} onClick={onSalir}>🏠 Salir</button>
            </div>

            {ranking.length > 0 && (
                <div style={{ ...st.box, maxWidth: 480 }}>
                    <h3 style={{ margin: '0 0 14px', color: '#FFD700' }}>🏆 Ranking — {resultado.hoja}</h3>
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
// MODAL ENVIAR AL PROFESOR
// ─────────────────────────────────────────────
function ModalEnviarProfe({ resultado, recurso, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso,  setCurso]  = useState('');
    const [codigo, setCodigo] = useState('');
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
            const acertadas = resultado.acertadas ?? 0;
            const falladas  = resultado.falladas  ?? 0;
            const total     = acertadas + falladas;
            const pct       = total > 0 ? Math.round(acertadas / total * 100) : 0;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'KARTINGED', modalidad: 'Individual', fecha: new Date(),
                recursoId: recurso.id, recursoTitulo: recurso.titulo,
                hoja: resultado.hoja, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), hoja: resultado.hoja,
                    tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado,
                    puntos: resultado.puntos, posicion: resultado.posicion,
                    intentos: total, aciertos: acertadas, fallos: falladas, porcentaje: pct }],
            });
            guardarRegistroLocal('KARTINGED', {
                titulo: recurso.titulo, aciertos: acertadas, intentos: total,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const st = { overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }, box: { background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }, input: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' } };

    return (
        <div style={st.overlay}>
            <div style={st.box}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, marginTop: 8 }}>¡Informe enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Tiempo: {resultado.tiempoFormateado} · Puntos: {resultado.puntos}</div>
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
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// PANTALLA DE INSTRUCCIONES
// ─────────────────────────────────────────────
function PantallaInstrucciones({ recurso, hoja, onEmpezar }) {
    const st = {
        page: { minHeight: '100vh', background: 'linear-gradient(160deg,#0d0d1a 0%,#1a0a00 50%,#0d1a00 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
        card: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,107,0,0.4)', borderRadius: 24, padding: '36px 40px', maxWidth: 560, width: '100%', boxShadow: '0 0 60px rgba(255,107,0,0.15)' },
        title: { fontSize: '2rem', fontWeight: 900, textAlign: 'center', margin: '0 0 4px', background: 'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
        sub: { textAlign: 'center', color: '#aaa', marginBottom: 28, fontSize: '0.9rem' },
        section: { marginBottom: 22 },
        sectionTitle: { fontWeight: 700, color: '#FFD700', fontSize: '0.85rem', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
        row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: '0.95rem' },
        icon: { fontSize: '1.4rem', width: 36, textAlign: 'center', flexShrink: 0 },
        kbd: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, padding: '3px 10px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#FFD700' },
        divider: { borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' },
        btn: { width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '1.2rem', color: 'white', background: 'linear-gradient(135deg,#FF6B00,#FFD700)', boxShadow: '0 6px 24px rgba(255,107,0,0.5)', marginTop: 8, letterSpacing: 1 },
    };

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🏎️</div>
            <div style={st.card}>
                <h1 style={st.title}>¡A las pistas!</h1>
                <p style={st.sub}>{recurso.titulo} · {hoja}</p>

                <div style={st.section}>
                    <div style={st.sectionTitle}>🏁 Objetivo</div>
                    <div style={st.row}><span style={st.icon}>🔄</span><span>Completa <b>4 vueltas</b> al circuito en el menor tiempo posible</span></div>
                    <div style={st.row}><span style={st.icon}>✅</span><span>Responder <b>correctamente</b> en los checkpoints <b>suma puntos</b></span></div>
                    <div style={st.row}><span style={st.icon}>❌</span><span>Responder <b>mal</b> añade <b>+5 segundos</b> de penalización al tiempo</span></div>
                    <div style={st.row}><span style={st.icon}>🚦</span><span>Hay <b>5 checkpoints</b> por vuelta — ¡20 preguntas en total!</span></div>
                </div>

                <hr style={st.divider} />

                <div style={st.section}>
                    <div style={st.sectionTitle}>🎮 Controles</div>
                    <div style={st.row}><span style={st.icon}>⬆️</span><span><span style={st.kbd}>↑</span> / <span style={st.kbd}>W</span> — Acelerar</span></div>
                    <div style={st.row}><span style={st.icon}>⬇️</span><span><span style={st.kbd}>↓</span> / <span style={st.kbd}>S</span> — Frenar / marcha atrás</span></div>
                    <div style={st.row}><span style={st.icon}>↩️</span><span><span style={st.kbd}>←</span> <span style={st.kbd}>→</span> / <span style={st.kbd}>A</span> <span style={st.kbd}>D</span> — Girar</span></div>
                    <div style={st.row}><span style={st.icon}>📱</span><span>En móvil usa el <b>joystick</b> en pantalla</span></div>
                </div>

                <button style={st.btn} onClick={onEmpezar}>🚦 ¡EMPEZAR CARRERA!</button>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function KartingedGame({
    usuario, alTerminar,
    // ── Contrato "modo olímpico" (Control de Aula / OlympicLive): recurso ya cargado,
    //    salta el selector y reporta la puntuación en vez de mostrar su pantalla propia ──
    recurso: recursoProp = null, modoOlimpico = false, tiempoOlimpico = null,
    hojaOlimpica = 'General', onOlimpicoFinish = null,
    onExit = null,
}) {
    const salir = alTerminar || onExit || (() => {});
    const [fase, setFase] = useState(modoOlimpico && recursoProp ? 'INSTRUCCIONES' : 'PREVIO'); // PREVIO | INSTRUCCIONES | JUGANDO | RESULTADO
    const [recurso, setRecurso]   = useState(modoOlimpico ? recursoProp : null);
    const [hoja,    setHoja]      = useState(modoOlimpico ? (hojaOlimpica || 'General') : 'General');
    const [resultado, setResultado] = useState(null);

    // Ref al callback de puntuación para no re-registrar el listener en cada render.
    const finishRef = useRef(onOlimpicoFinish);
    finishRef.current = onOlimpicoFinish;

    // Escuchar el postMessage de Unity cuando termina la carrera
    useEffect(() => {
        const handler = (e) => {
            if (e.data?.type === 'KARTINGED_RESULT') {
                const data = e.data.data || {};
                if (modoOlimpico) {
                    // Reporta los puntos (mayor = mejor, coherente con el resto de juegos puntuables).
                    if (finishRef.current) finishRef.current(Number(data.puntos) || 0);
                    setResultado(data);
                    setFase('FIN_OLIMPICO');
                } else {
                    setResultado(data);
                    setFase('RESULTADO');
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [modoOlimpico]);

    const iniciarJuego = (rec, hojaElegida) => {
        setRecurso(rec);
        setHoja(hojaElegida);
        setFase('INSTRUCCIONES');
    };

    if (fase === 'PREVIO')
        return <PantallaPrevia usuario={usuario} onIniciar={iniciarJuego} />;

    if (fase === 'INSTRUCCIONES')
        return <PantallaInstrucciones recurso={recurso} hoja={hoja} onEmpezar={() => setFase('JUGANDO')} />;

    // En modo olímpico no se muestra la pantalla de resultados propia: la puntuación ya se
    // ha reportado y el contenedor (Control de Aula) gestiona el ranking global.
    if (fase === 'FIN_OLIMPICO')
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: "'Segoe UI',sans-serif", gap: 10 }}>
                <div style={{ fontSize: '3.5rem' }}>🏁</div>
                <h2 style={{ margin: 0, color: '#FFD700' }}>¡Carrera terminada!</h2>
                {resultado && <div style={{ opacity: 0.85 }}>🏆 {resultado.puntos} puntos · ⏱ {resultado.tiempoFormateado}</div>}
                <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Puntuación enviada.</div>
            </div>
        );

    if (fase === 'RESULTADO' && resultado)
        return <PantallaResultados resultado={resultado} recurso={recurso} usuario={usuario} onSalir={salir} />;

    // JUGANDO — iframe con recursoId y hoja en la URL
    const hojaParam = encodeURIComponent(hoja);
    const iframeSrc = `/kartinged/index.html?recursoId=${recurso.id}&hoja=${hojaParam}`;

    return (
        <GameLauncher
            src={iframeSrc}
            title="Karting Educativo"
            onMessage={(data) => { if (data.type === 'KARTINGED_RESULT') setResultado(data.data); }}
            onSalir={salir}
        />
    );
}
