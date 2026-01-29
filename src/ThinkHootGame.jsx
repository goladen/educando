import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc } from 'firebase/firestore';
import { Home, Check, X, Trophy, Save } from 'lucide-react';

export default function ThinkHootGame({ isHost, codigoSala, usuario, onExit }) {
    const [gameState, setGameState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [miPuntuacion, setMiPuntuacion] = useState(0);
    const [miPosicion, setMiPosicion] = useState(0);
    const [respuestaEnviada, setRespuestaEnviada] = useState(false);
    const [resultadoRonda, setResultadoRonda] = useState(null);
    const [puntosGanadosRonda, setPuntosGanadosRonda] = useState(0);

    // Estados para la animación final
    const [pasoAnimacion, setPasoAnimacion] = useState(0); // Controla qué posiciones se ven
    const [confettiActive, setConfettiActive] = useState(false);

    const timerRef = useRef(null);

    // --- UTILS: CONFETI EN CSS/JS PURO ---
    const lanzarConfeti = () => {
        setConfettiActive(true);
        setTimeout(() => setConfettiActive(false), 6000); // 5 segundos de fiesta
    };

    // --- FUNCIONES HOST ---
    const hostEndGame = async () => {
        try {
            await updateDoc(doc(db, "live_games", codigoSala), { estado: 'FINISHED' });
        } catch (e) { console.error(e); }
    };

    const hostEndRound = async () => {
        try {
            await updateDoc(doc(db, "live_games", codigoSala), { estado: 'RESULT' });
            setTimeout(async () => {
                await updateDoc(doc(db, "live_games", codigoSala), { estado: 'LEADERBOARD' });
            }, 5000);
        } catch (e) { console.error(e); }
    };

    const hostNextQuestion = async () => {
        if (!gameState) return;
        // Si el índice actual + 1 es igual al total, hemos terminado
        if (gameState.indicePregunta + 1 >= gameState.preguntas.length) {
            hostEndGame();
            return;
        }

        // Avanzar índice y resetear
        const updates = {
            estado: 'QUESTION',
            startTime: new Date(),
            respuestasRonda: {},
            indicePregunta: gameState.indicePregunta + 1 // Avanzamos aquí
        };

        Object.keys(gameState.jugadores || {}).forEach(uid => {
            updates[`jugadores.${uid}.lastAnswer`] = null;
        });

        await updateDoc(doc(db, "live_games", codigoSala), updates);
    };

    const hostStartGame = async () => {
        await updateDoc(doc(db, "live_games", codigoSala), { estado: 'PRE_QUESTION' });
        setTimeout(() => {
            // Iniciar la primera pregunta
            updateDoc(doc(db, "live_games", codigoSala), {
                estado: 'QUESTION',
                startTime: new Date(),
                indicePregunta: 0
            });
        }, 3000);
    };

    // --- GUARDADO FINAL (SOLO PROFESOR) ---
    const guardarRankingEnBD = async () => {
        if (!gameState || !isHost) return;
        const rankingRef = collection(db, 'ranking');
        const timestamp = new Date();

        try {
            const promises = Object.values(gameState.jugadores).map(player => {
                return addDoc(rankingRef, {
                    recursoId: gameState.recursoId || 'unknown',
                    tituloJuego: gameState.recursoTitulo || 'Juego en Vivo',
                    juego: 'ThinkHoot',
                    categoria: 'En Vivo', // O la hoja seleccionada si la guardaste
                    jugador: player.name,
                    email: player.email || 'No registrado', // Guardamos email si existe
                    aciertos: player.score,
                    fecha: timestamp
                });
            });
            await Promise.all(promises);
            alert("✅ ¡Ranking guardado correctamente en la base de datos!");
        } catch (error) {
            console.error(error);
            alert("Error al guardar: " + error.message);
        }
    };

    // --- CONEXIÓN FIRESTORE ---
    useEffect(() => {
        if (!codigoSala) return;
        const gameRef = doc(db, "live_games", codigoSala);

        // Registro Alumno
        if (!isHost && usuario?.uid) {
            updateDoc(gameRef, {
                [`jugadores.${usuario.uid}`]: {
                    name: usuario.displayName || "Anónimo",
                    email: usuario.email || null, // Guardamos el email para el profe
                    score: 0,
                    lastAnswer: null
                }
            }).catch(e => { console.error(e); alert("Sala cerrada o error"); onExit(); });
        }

        const unsubscribe = onSnapshot(gameRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setGameState(data);

                // Detectar cambio a FINISHED para activar animación local
                if (data.estado === 'FINISHED') {
                    lanzarConfeti();
                    // Secuencia de animación
                    setPasoAnimacion(0);
                    setTimeout(() => setPasoAnimacion(1), 1000); // 5º y 4º
                    setTimeout(() => setPasoAnimacion(2), 3000); // 3º y 2º
                    setTimeout(() => setPasoAnimacion(3), 5000); // 1º (CAMPEÓN)
                }

                // Datos propios (Alumno)
                if (!isHost && data.jugadores?.[usuario.uid]) {
                    setMiPuntuacion(data.jugadores[usuario.uid].score);
                    if (data.estado === 'QUESTION' && !data.respuestasRonda?.[usuario.uid]) {
                        setRespuestaEnviada(false);
                        setResultadoRonda(null);
                        setPuntosGanadosRonda(0);
                    }
                }

                // Tiempo
                if (data.estado === 'QUESTION' && data.startTime) {
                    const start = data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime);
                    const elapsed = (new Date() - start) / 1000;
                    const total = parseInt(data.config.tiempoPregunta) || 30;
                    setTimeLeft(Math.max(0, Math.ceil(total - elapsed)));
                }
            } else {
                alert("Sala cerrada."); onExit();
            }
        });
        return () => unsubscribe();
    }, [codigoSala]);

    // --- VIGILANTE HOST ---
    useEffect(() => {
        if (isHost && gameState?.estado === 'QUESTION') {
            const total = Object.keys(gameState.jugadores || {}).length;
            const resps = Object.keys(gameState.respuestasRonda || {}).length;
            if ((total > 0 && resps >= total) || timeLeft === 0) {
                if (timeLeft > 0) setTimeout(hostEndRound, 1500); // Pequeña espera para ver el feedback
                else hostEndRound();
            }
        }
    }, [gameState?.respuestasRonda, timeLeft, isHost]);

    // --- TIMER LOCAL ---
    useEffect(() => {
        if (gameState?.estado === 'QUESTION' && timeLeft > 0) {
            timerRef.current = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
        } else clearInterval(timerRef.current);
        return () => clearInterval(timerRef.current);
    }, [gameState?.estado, timeLeft]);

    // --- ALUMNO: ENVIAR ---
    const enviarRespuesta = async (respuesta) => {
        if (respuestaEnviada || gameState.estado !== 'QUESTION') return;
        setRespuestaEnviada(true);

        const currentQ = gameState.preguntas[gameState.indicePregunta];
        const start = gameState.startTime.toDate ? gameState.startTime.toDate() : new Date(gameState.startTime);
        const elapsed = (new Date() - start) / 1000;
        const totalTime = parseInt(gameState.config.tiempoPregunta) || 30;
        const maxPts = parseInt(gameState.config.puntosMax) || 120;
        const minPts = parseInt(gameState.config.puntosMin) || 30;

        const esCorrecta = String(respuesta).trim().toLowerCase() === String(currentQ.a).trim().toLowerCase();
        let pts = 0;

        if (esCorrecta) {
            const pen = (maxPts - minPts) * (elapsed / totalTime);
            pts = Math.floor(Math.max(minPts, maxPts - pen));
            setResultadoRonda('CORRECT');
            setPuntosGanadosRonda(pts);
        } else {
            setResultadoRonda('WRONG');
            setPuntosGanadosRonda(0);
        }

        const pRef = `jugadores.${usuario.uid}`;
        await updateDoc(doc(db, "live_games", codigoSala), {
            [`${pRef}.lastAnswer`]: respuesta,
            [`${pRef}.score`]: (gameState.jugadores[usuario.uid].score || 0) + pts,
            [`respuestasRonda.${usuario.uid}`]: true
        });
    };

    // --- RENDERIZADO ---
    if (!gameState) return <div style={STYLES.screen}>Cargando...</div>;
    const currentQ = gameState.preguntas && gameState.preguntas[gameState.indicePregunta];

    // Confeti Overlay
    const ConfettiOverlay = () => (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
            {Array.from({ length: 50 }).map((_, i) => (
                <div key={i} className="confetti" style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    backgroundColor: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'][Math.floor(Math.random() * 4)]
                }} />
            ))}
            <style>{`
                .confetti { position: absolute; top:-10px; width:10px; height:10px; animation: fall 3s linear infinite; }
                @keyframes fall { to { transform: translateY(100vh) rotate(720deg); } }
            `}</style>
        </div>
    );

    // 1. LOBBY
    if (gameState.estado === 'LOBBY') {
        return (
            <div style={STYLES.screen}>
                <h1 style={{ fontSize: '1.5rem' }}>CÓDIGO: <span style={{ color: '#f1c40f', fontSize: '4rem' }}>{codigoSala}</span></h1>
                <p>Jugadores: {Object.keys(gameState.jugadores || {}).length}</p>
                <div style={STYLES.grid}>
                    {Object.values(gameState.jugadores || {}).map((p, i) => <div key={i} style={STYLES.chip}>{p.name}</div>)}
                </div>
                {isHost ? <button onClick={hostStartGame} style={STYLES.btnBig}>COMENZAR JUEGO</button> : <p>Esperando al profesor...</p>}
                <button onClick={onExit} style={STYLES.btnExit}><Home /></button>
            </div>
        );
    }

    // 2. PRE-QUESTION
    if (gameState.estado === 'PRE_QUESTION') {
        return <div style={STYLES.screen}><h1 style={{ fontSize: '3rem' }}>Pregunta {gameState.indicePregunta + 1}</h1></div>;
    }

    // 3. JUEGO (QUESTION)
    if (gameState.estado === 'QUESTION' && currentQ) {
        const isMultipleChoice = currentQ.tipo === 'opciones' || (currentQ.opcionesFijas && currentQ.opcionesFijas.length > 1);
        return (
            <div style={STYLES.screen}>
                <div style={STYLES.timerBox}><div style={{ ...STYLES.timerFill, width: `${(timeLeft / (gameState.config.tiempoPregunta || 30)) * 100}%` }}></div></div>
                <h2 style={{ fontSize: '2.5rem', textAlign: 'center', margin: '20px', maxWidth: '90%' }}>{currentQ.q}</h2>
                {isHost ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', fontWeight: 'bold' }}>{timeLeft}</div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button onClick={hostEndRound} style={STYLES.btnStop}>Parar Tiempo</button>
                            <button onClick={hostNextQuestion} style={STYLES.btnNext}>Pasar Pregunta</button>
                        </div>
                    </div>
                ) : (
                        <div style={{ width: '100%', maxWidth: '800px' }}>
                            {respuestaEnviada ? <h2>Respuesta Enviada...</h2> : (
                                isMultipleChoice ? (
                                    <div style={STYLES.gridOpts}>
                                        {currentQ.opcionesFijas.map((opt, i) => (
                                            <button key={i} onClick={() => enviarRespuesta(opt)} style={STYLES.btnOpt}>{opt}</button>
                                        ))}
                                    </div>
                                ) : (
                                        <div style={{ display: 'flex', gap: 10, flexDirection: 'column', alignItems: 'center' }}>
                                            <input id="ansInput" style={STYLES.input} placeholder="Respuesta..." autoComplete="off" />
                                            <button onClick={() => enviarRespuesta(document.getElementById('ansInput').value)} style={STYLES.btnSend}>ENVIAR</button>
                                        </div>
                                    )
                            )}
                        </div>
                    )}
            </div>
        );
    }

    // 4. RESULTADO
    if (gameState.estado === 'RESULT') {
        return (
            <div style={{ ...STYLES.screen, background: (!isHost && resultadoRonda === 'CORRECT') ? '#27ae60' : (!isHost && resultadoRonda === 'WRONG' ? '#c0392b' : '#2c3e50') }}>
                {isHost ? (
                    <div style={{ textAlign: 'center' }}>
                        <h2>Respuesta Correcta:</h2>
                        <h1 style={{ fontSize: '4rem', color: '#f1c40f' }}>{currentQ.a}</h1>
                    </div>
                ) : (
                        <div style={{ textAlign: 'center' }}>
                            {resultadoRonda === 'CORRECT' ? (
                                <><Check size={100} /><h1>¡CORRECTO!</h1><div style={{ fontSize: '2rem', fontWeight: 'bold' }}>+ {puntosGanadosRonda} Puntos</div></>
                            ) : (
                                    <><X size={100} /><h1>INCORRECTO</h1><h3>Era: {currentQ.a}</h3></>
                                )}
                        </div>
                    )}
            </div>
        );
    }

    // 5. RANKING INTERMEDIO
    if (gameState.estado === 'LEADERBOARD') {
        const sorted = Object.values(gameState.jugadores || {}).sort((a, b) => b.score - a.score);
        return (
            <div style={STYLES.screen}>
                <h1 style={{ color: '#f1c40f' }}>🏆 Ranking</h1>
                <div style={STYLES.list}>
                    {sorted.slice(0, 5).map((p, i) => (
                        <div key={i} style={STYLES.row}><span style={{ fontWeight: 'bold' }}>#{i + 1}</span> <span>{p.name}</span> <span>{p.score}</span></div>
                    ))}
                </div>
                {isHost && (
                    <button onClick={hostNextQuestion} style={STYLES.btnBig}>Siguiente Pregunta ➡</button>
                )}
            </div>
        );
    }

    // 6. FIN DEL JUEGO (ANIMACIÓN DRAMÁTICA)
    if (gameState.estado === 'FINISHED') {
        const sorted = Object.values(gameState.jugadores || {}).sort((a, b) => b.score - a.score);
        return (
            <div style={STYLES.screen}>
                {confettiActive && <ConfettiOverlay />}

                <h1 style={{ fontSize: '3rem', marginBottom: '20px', color: '#f1c40f', textShadow: '0 0 10px black' }}>
                    ¡Enhorabuena! Juego Terminado
                </h1>

                {/* PODIO DINÁMICO */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '350px', gap: '20px', marginBottom: '30px' }}>

                    {/* PLATA (Paso 2) */}
                    {sorted[1] && pasoAnimacion >= 2 && (
                        <div className="podium-bar" style={{ ...STYLES.podiumBar, height: '200px', background: '#bdc3c7', animation: 'popIn 0.5s ease' }}>
                            <div style={{ fontSize: '3rem' }}>🥈</div>
                            <div style={{ fontWeight: 'bold' }}>{sorted[1].name}</div>
                            <div>{sorted[1].score} pts</div>
                        </div>
                    )}

                    {/* ORO (Paso 3) */}
                    {sorted[0] && pasoAnimacion >= 3 && (
                        <div className="podium-bar" style={{ ...STYLES.podiumBar, height: '280px', background: '#f1c40f', transform: 'scale(1.1)', zIndex: 10, animation: 'popInBig 0.8s bounce' }}>
                            <Trophy size={60} color="#d35400" />
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '10px' }}>{sorted[0].name}</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{sorted[0].score} pts</div>
                        </div>
                    )}

                    {/* BRONCE (Paso 2) */}
                    {sorted[2] && pasoAnimacion >= 2 && (
                        <div className="podium-bar" style={{ ...STYLES.podiumBar, height: '150px', background: '#cd7f32', animation: 'popIn 0.5s ease' }}>
                            <div style={{ fontSize: '3rem' }}>🥉</div>
                            <div style={{ fontWeight: 'bold' }}>{sorted[2].name}</div>
                            <div>{sorted[2].score} pts</div>
                        </div>
                    )}
                </div>

                {/* RESTO DE JUGADORES (Paso 1) */}
                {pasoAnimacion >= 1 && (
                    <div style={{ width: '80%', maxWidth: '600px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '10px', animation: 'fadeIn 1s' }}>
                        {sorted.slice(3).map((p, i) => (
                            <div key={i} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>#{i + 4} {p.name}</span>
                                <span>{p.score} pts</span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: '30px', display: 'flex', gap: '20px' }}>
                    <button onClick={onExit} style={STYLES.btnExit}><Home /></button>
                    {isHost && (
                        <button onClick={guardarRankingEnBD} style={{ ...STYLES.btnBig, background: '#8e44ad', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <Save /> Guardar Ranking
                        </button>
                    )}
                </div>

                <style>{`
                    @keyframes popIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    @keyframes popInBig { 0% { transform: translateY(100%) scale(1); opacity: 0; } 80% { transform: translateY(0) scale(1.2); opacity: 1; } 100% { transform: translateY(0) scale(1.1); } }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                `}</style>
            </div>
        );
    }

    return <div style={STYLES.screen}>Esperando...</div>;
}

const STYLES = {
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5000, fontFamily: 'sans-serif' },
    grid: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', margin: 20 },
    chip: { background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: 20 },
    btnBig: { padding: '15px 40px', fontSize: '1.5rem', background: '#27ae60', color: 'white', border: 'none', borderRadius: 50, cursor: 'pointer', marginTop: 20 },
    btnExit: { position: 'absolute', top: 20, left: 20, background: 'white', color: '#333', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    timerBox: { position: 'absolute', top: 0, left: 0, width: '100%', height: 15, background: '#555' },
    timerFill: { height: '100%', background: '#f1c40f', transition: 'width 1s linear' },
    gridOpts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, width: '90%', maxWidth: 800 },
    btnOpt: { padding: 30, fontSize: '1.3rem', background: 'white', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.1s' },
    input: { padding: 20, fontSize: '1.5rem', width: '100%', maxWidth: 400, borderRadius: 10, border: 'none', textAlign: 'center' },
    btnSend: { padding: '20px 40px', fontSize: '1.2rem', background: '#3498db', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold', marginTop: 10 },
    list: { width: '90%', maxWidth: 600, background: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 20, marginBottom: 20 },
    row: { display: 'flex', justifyContent: 'space-between', padding: 15, borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '1.2rem' },
    podiumBar: { width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 15, color: '#2c3e50', borderRadius: '15px 15px 0 0', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
    btnStop: { padding: 10, background: '#e74c3c', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' },
    btnNext: { padding: 10, background: '#3498db', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }
};