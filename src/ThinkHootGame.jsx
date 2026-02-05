import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
import { doc, updateDoc, onSnapshot, increment, deleteField, collection, writeBatch } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { MessageSquare, X, UserX, ThumbsUp, ThumbsDown, ArrowUp, ArrowDown, Image as ImageIcon, Users, Play, Send, Loader, Trophy, CheckCircle, XCircle, Medal, Save, Monitor } from 'lucide-react';

// --- AUDIOS ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import startSoundFile from './assets/inicio juego.mp3';
import popSoundFile from './assets/negative_beeps-6008.mp3';

// --- IMÁGENES DEL AVATAR ---
import piHappy from './assets/Pi-contento.png';
import piAngry from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';

// ============================================================================
// COMPONENTE ENRUTADOR
// ============================================================================
export default function ThinkHootGame(props) {
    if (props.isHost) return <ThinkHootHost {...props} />;
    if (props.codigoSala) return <ThinkHootClient {...props} />;
    return <ThinkHootLocal {...props} />;
}

// --- UTILIDADES ---
const clean = (s) => s ? String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

const parseText = (text) => {
    if (!text) return "";
    // Reemplazo de superíndices (ej: (base)^(exp))
    let p = String(text).replace(/\((.*?)\)\^\((.*?)\)/g, '<span>$1<sup>$2</sup></span>');
    // Reemplazo de fracciones (ej: (num)/(den))
    p = p.replace(/\((.*?)\)\/\((.*?)\)/g, '<span class="fraction"><span class="numer">$1</span><span class="denom">$2</span></span>');
    return <span dangerouslySetInnerHTML={{ __html: p }} />;
};

// ============================================================================
// 1. MODO HOST (PROFESOR)
// ============================================================================
function ThinkHootHost({ codigoSala, onExit }) {
    const [gameData, setGameData] = useState(null);
    const [jugadores, setJugadores] = useState([]);
    const [mensajes, setMensajes] = useState([]);
    const [mensajeActivo, setMensajeActivo] = useState(null);
    const [mostrarPanelDudas, setMostrarPanelDudas] = useState(false);

    // Estados visuales locales del Host
    const [faseHost, setFaseHost] = useState('LOBBY');
    const [subFase, setSubFase] = useState('RESPONDING');
    const [timerVisual, setTimerVisual] = useState(0);
    const [puntosGanadosRonda, setPuntosGanadosRonda] = useState({});
    const [guardandoGlobal, setGuardandoGlobal] = useState(false);
    const [procesandoSiguiente, setProcesandoSiguiente] = useState(false);

    // Estados para el Avatar
    const [stats, setStats] = useState({ aciertos: 0, total: 0, pct: 0 });
    const [avatarMood, setAvatarMood] = useState('neutral');

    const timerRef = useRef(null);

    // Suscripción a la Sala
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "live_games", codigoSala), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGameData(data);
                setFaseHost(data.estado || 'LOBBY');
                setSubFase(data.fasePregunta || 'RESPONDING');

                const listaJugadores = data.jugadores ? Object.values(data.jugadores) : [];
                setJugadores(listaJugadores);

                if (data.mensajes) setMensajes(Object.entries(data.mensajes).map(([k, v]) => ({ id: k, ...v })));
                else setMensajes([]);

                // Controlar fin de respuestas automático (Solo si NO es presentación)
                const currentP = data.preguntas?.[data.indicePregunta];
                const isPresentation = currentP?.tipo === 'PRESENTATION';

                if (!isPresentation && data.estado === 'JUEGO' && data.fasePregunta === 'RESPONDING') {
                    const numRespuestas = Object.keys(data.respuestasRonda || {}).length;
                    const numJugadores = listaJugadores.length;
                    if (numJugadores > 0 && numRespuestas >= numJugadores) {
                        revelarRespuestas(data);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [codigoSala]);

    // Timer del Host
    useEffect(() => {
        if (faseHost === 'JUEGO' && subFase === 'RESPONDING' && gameData) {
            const p = gameData.preguntas[gameData.indicePregunta];
            // Si es presentación, no hay timer automático
            if (p.tipo === 'PRESENTATION') {
                setTimerVisual(0);
                if (timerRef.current) clearInterval(timerRef.current);
                return;
            }

            const tiempoTotal = parseInt(p.tiempo || gameData.config?.tiempoPregunta || 20);
            const inicio = gameData.questionStartTime || Date.now();

            if (timerRef.current) clearInterval(timerRef.current);

            timerRef.current = setInterval(() => {
                const transcurrido = (Date.now() - inicio) / 1000;
                const restante = Math.max(0, Math.ceil(tiempoTotal - transcurrido));
                setTimerVisual(restante);

                if (restante <= 0) {
                    clearInterval(timerRef.current);
                    revelarRespuestas(gameData);
                }
            }, 500);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [faseHost, subFase, gameData?.indicePregunta, gameData?.questionStartTime]);

    const playSound = (type) => {
        let file = null;
        if (type === 'START') file = startSoundFile;
        else if (type === 'WIN') file = winSoundFile;
        if (file) new Audio(file).play().catch(e => { });
    };

    // --- ACCIONES DEL FLUJO ---

    const empezarPartida = async () => {
        await updateDoc(doc(db, "live_games", codigoSala), { estado: 'COUNTDOWN' });
    };

    const finCuentaAtras = async () => {
        if (gameData?.recursoId && jugadores.length > 0) {
            try { await updateDoc(doc(db, 'resources', gameData.recursoId), { playCount: increment(jugadores.length) }); } catch (e) { }
        }
        await updateDoc(doc(db, "live_games", codigoSala), {
            estado: 'JUEGO',
            indicePregunta: 0,
            respuestasRonda: {},
            fasePregunta: 'RESPONDING',
            questionStartTime: Date.now()
        });
    };

    const revelarRespuestas = async (dataActual) => {
        if (dataActual.fasePregunta !== 'RESPONDING') return;

        const respuestas = Object.values(dataActual.respuestasRonda || {});
        const totalR = respuestas.length;
        const aciertos = respuestas.filter(r => r.correct).length;
        const pct = totalR > 0 ? Math.round((aciertos / totalR) * 100) : 0;

        setStats({ aciertos, total: totalR, pct });
        let newMood = 'neutral';
        if (totalR > 0) {
            if (pct < 30) newMood = 'angry';
            else if (pct >= 60) newMood = 'happy';
        }
        setAvatarMood(newMood);

        await updateDoc(doc(db, "live_games", codigoSala), { fasePregunta: 'REVEAL' });

        setTimeout(async () => {
            mostrarRanking(dataActual);
        }, 5000);
    };

    const mostrarRanking = async (dataActual) => {
        const diffPuntos = {};
        const respuestas = dataActual.respuestasRonda || {};

        Object.values(respuestas).forEach(r => {
            if (r.puntosGanados > 0) {
                diffPuntos[r.uid] = r.puntosGanados;
            }
        });
        setPuntosGanadosRonda(diffPuntos);

        await updateDoc(doc(db, "live_games", codigoSala), { fasePregunta: 'LEADERBOARD' });
        setProcesandoSiguiente(false);
    };

    const siguientePregunta = async () => {
        if (procesandoSiguiente) return;
        setProcesandoSiguiente(true);

        const nextIdx = (gameData.indicePregunta || 0) + 1;
        if (nextIdx < gameData.preguntas.length) {
            await updateDoc(doc(db, "live_games", codigoSala), {
                indicePregunta: nextIdx,
                respuestasRonda: {},
                fasePregunta: 'RESPONDING',
                questionStartTime: Date.now()
            });
            setAvatarMood('neutral');
            setPuntosGanadosRonda({});
            setProcesandoSiguiente(false);
        } else {
            await updateDoc(doc(db, "live_games", codigoSala), { estado: 'FIN' });
            playSound('WIN');
            setProcesandoSiguiente(false);
        }
    };

    const guardarResultadosGlobales = async () => {
        if (guardandoGlobal) return;
        setGuardandoGlobal(true);
        try {
            const batch = writeBatch(db);
            const rankingRef = collection(db, 'ranking');

            jugadores.forEach(j => {
                const newDocRef = doc(rankingRef);
                batch.set(newDocRef, {
                    recursoId: gameData.recursoId,
                    recursoTitulo: gameData.titulo || "Juego en Vivo",
                    tipoJuego: 'THINKHOOT',
                    juego: 'ThinkHoot',
                    categoria: 'General',
                    email: 'alumno@clase.com',
                    jugador: j.nombre,
                    aciertos: j.puntos,
                    fecha: new Date(),
                    medalla: ''
                });
            });

            await batch.commit();
            alert(`✅ Se han guardado los resultados de ${jugadores.length} alumnos.`);
        } catch (error) {
            console.error(error);
            alert("Error al guardar resultados.");
        }
        setGuardandoGlobal(false);
    };

    const resolverDuda = async (accion) => {
        if (!mensajeActivo) return;
        const refSala = doc(db, "live_games", codigoSala);
        const keyJugador = Object.keys(gameData.jugadores).find(k => gameData.jugadores[k].uid === mensajeActivo.uid);

        if (keyJugador) {
            if (accion === 'PUNTOS_MAS') await updateDoc(refSala, { [`jugadores.${keyJugador}.puntos`]: increment(100) });
            else if (accion === 'PUNTOS_MENOS') await updateDoc(refSala, { [`jugadores.${keyJugador}.puntos`]: increment(-50) });
            else if (accion === 'KICK') await updateDoc(refSala, { [`jugadores.${keyJugador}`]: deleteField() });
        }
        const nuevosMensajes = { ...gameData.mensajes };
        delete nuevosMensajes[mensajeActivo.id];
        await updateDoc(refSala, { mensajes: nuevosMensajes });
        setMensajeActivo(null);
    };

    if (!gameData) return <div style={{ color: 'white', padding: 20 }}>Cargando sala...</div>;

    const currentQ = (gameData.indicePregunta || 0) + 1;
    const totalQ = gameData.preguntas ? gameData.preguntas.length : 0;
    const isLastQuestion = currentQ >= totalQ;

    // Configuración pregunta actual
    const currentP = gameData.preguntas?.[gameData.indicePregunta];
    let correctStr = "";
    if (currentP) {
        if (currentP.tipo === 'RELLENAR' && currentP.bloques) correctStr = currentP.bloques[1]; // 2º campo
        else if (currentP.tipo === 'ORDENAR') correctStr = ""; // Se ve visualmente
        else correctStr = (currentP.correcta || currentP.respuesta || currentP.a) || "";
    }

    const isPresentation = currentP?.tipo === 'PRESENTATION';

    return (
        <div className="game-container host-mode">
            <EstilosComunes />
            <EstilosThinkHoot />

            {/* AVATAR PI (No sale en presentaciones) */}
            {faseHost === 'JUEGO' && !isPresentation && (
                <div className="pi-avatar-container">
                    <img src={avatarMood === 'happy' ? piHappy : (avatarMood === 'angry' ? piAngry : piNeutral)} className={`pi-avatar-img ${avatarMood}`} />
                    <div className="pi-stats-badge">{stats.pct}% Aciertos</div>
                </div>
            )}

            {/* HEADER */}
            <div className="top-hud">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="btn-exit" onClick={onExit}>X</button>
                    {faseHost === 'JUEGO' && <div className="q-counter">Pregunta {currentQ}/{totalQ}</div>}
                </div>

                <div className="room-code">CÓDIGO: <span>{codigoSala}</span></div>

                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                    <button className={`btn-inbox ${mensajes.length > 0 ? 'has-messages' : ''}`} onClick={() => setMostrarPanelDudas(!mostrarPanelDudas)}>
                        <MessageSquare size={24} />
                        {mensajes.length > 0 && <span className="badge">{mensajes.length}</span>}
                    </button>
                    <div className="player-counter"><Users size={20} /> {jugadores.length}</div>
                </div>
            </div>

            {/* PANEL DUDAS */}
            {mostrarPanelDudas && (
                <div className="dudas-panel">
                    <div className="dudas-header"><span>Dudas ({mensajes.length})</span><button onClick={() => setMostrarPanelDudas(false)}><X size={16} /></button></div>
                    <div className="dudas-list">
                        {mensajes.length === 0 && <div style={{ padding: 10, color: '#999' }}>No hay preguntas.</div>}
                        {!mensajeActivo ? mensajes.map(m => (<div key={m.id} className="duda-item" onClick={() => setMensajeActivo(m)}><b>{m.alumno}</b>: {m.texto.substring(0, 20)}...</div>)) : (
                            <div className="duda-detalle">
                                <div className="duda-info"><p><b>{mensajeActivo.alumno}:</b> "{mensajeActivo.texto}"</p></div>
                                <div className="duda-actions">
                                    <button className="act-btn green" onClick={() => resolverDuda('PUNTOS_MAS')}><ThumbsUp size={16} /></button>
                                    <button className="act-btn red" onClick={() => resolverDuda('PUNTOS_MENOS')}><ThumbsDown size={16} /></button>
                                    <button className="act-btn dark" onClick={() => resolverDuda('KICK')}><UserX size={16} /></button>
                                    <button className="act-btn gray" onClick={() => resolverDuda('CLOSE')}><X size={16} /></button>
                                </div>
                                <button className="btn-back-small" onClick={() => setMensajeActivo(null)}>Volver</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AREA JUEGO */}
            <div className="game-area">
                {faseHost === 'LOBBY' && (
                    <div className="lobby-screen">
                        <h1>¡Únete a la partida!</h1>
                        <div className="big-code">{codigoSala}</div>
                        <p>Esperando jugadores...</p>
                        <div className="players-grid">{jugadores.map((j, i) => (<div key={i} className="player-chip">{j.nombre}</div>))}</div>
                        <button className="btn-start-big" onClick={empezarPartida} disabled={jugadores.length === 0} style={{ opacity: jugadores.length === 0 ? 0.5 : 1, cursor: jugadores.length === 0 ? 'not-allowed' : 'pointer' }}>
                            <Play size={32} fill="white" /> EMPEZAR
                        </button>
                    </div>
                )}

                {faseHost === 'COUNTDOWN' && <PantallaCuentaAtras playSound={playSound} onFinished={finCuentaAtras} />}

                {faseHost === 'JUEGO' && (
                    <>
                        {subFase === 'RESPONDING' && (
                            <div className="host-question-view centered">
                                {isPresentation ? (
                                    <div className="question-card presentation-card">
                                        <h2 className="p-top">{parseText(currentP.bloques?.[0])}</h2>
                                        {currentP.bloques?.[1] && <img src={currentP.bloques[1]} className="presentation-img-large" />}
                                        <div className="p-bottom">{parseText(currentP.bloques?.[2])}</div>

                                        <div className="host-controls">
                                            <button className="btn-next-floating" onClick={siguientePregunta}>
                                                {isLastQuestion ? "🏆 Ranking Final" : "Siguiente"} <ArrowUp className="rotate-90" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                        <div className="question-card">
                                            <h2>{parseText(currentP.q)}</h2>
                                            {currentP.imagenUrl && <img src={currentP.imagenUrl} className="question-img-small" />}
                                            <div className="host-waiting">
                                                <Loader className="spin-icon" size={64} />
                                                <p>Esperando respuestas...</p>
                                                <div className="timer-big">{timerVisual}s</div>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        )}

                        {subFase === 'REVEAL' && (
                            <div className="host-question-view centered">
                                {/* RESPUESTA CORRECTA MOVIDA MÁS ABAJO */}
                                <div className="correct-answer-reveal" style={{ marginTop: '150px' }}>
                                    <div className="reveal-label">Solución:</div>

                                    {currentP.tipo === 'ORDENAR' ? (
                                        <div className="ordered-solution">
                                            {currentP.bloques.map((b, i) => <span key={i} className="order-chip">{parseText(b)}</span>)}
                                        </div>
                                    ) : (
                                            <div className="reveal-text">{parseText(correctStr)}</div>
                                        )}
                                </div>
                            </div>
                        )}

                        {subFase === 'LEADERBOARD' && (
                            <div className="podium-screen">
                                <h2>🏆 Ranking de la Ronda</h2>
                                <PodiumDisplay jugadores={jugadores} />

                                <div className="host-controls">
                                    <button className="btn-next-floating" onClick={siguientePregunta} disabled={procesandoSiguiente}>
                                        {isLastQuestion ? "🏆 Ranking Final" : "Siguiente Pregunta"}
                                        {!isLastQuestion && <ArrowUp className="rotate-90" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {faseHost === 'FIN' && (
                    <div className="podium-screen">
                        <h1>🏆 PODIO FINAL 🏆</h1>
                        <PodiumDisplay jugadores={jugadores} final={true} playSound={playSound} />

                        <div style={{ display: 'flex', gap: 15, marginTop: 30 }}>
                            <button className="btn-save-global" onClick={guardarResultadosGlobales} disabled={guardandoGlobal}>
                                <Save size={20} /> {guardandoGlobal ? 'Guardando...' : 'Guardar Resultados'}
                            </button>
                            <button className="btn-exit-big" onClick={onExit}>Cerrar Sala</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// 2. MODO CLIENTE (ALUMNO)
// ============================================================================
function ThinkHootClient({ codigoSala, usuario, onExit }) {
    const [gameData, setGameData] = useState(null);
    const [fase, setFase] = useState('LOBBY');
    const [subFase, setSubFase] = useState('RESPONDING');
    const [puntuacion, setPuntuacion] = useState(0);
    const [myResult, setMyResult] = useState(null);
    const [myRank, setMyRank] = useState(null);
    const [textoDuda, setTextoDuda] = useState('');
    const [showDudaModal, setShowDudaModal] = useState(false);
    const joiningRef = useRef(false);

    const guestId = useMemo(() => {
        if (usuario?.uid) return usuario.uid;
        const stored = localStorage.getItem('pikt_guest_id');
        if (stored) return stored;
        const newId = 'guest_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('pikt_guest_id', newId);
        return newId;
    }, [usuario]);
    const myUid = usuario?.uid || guestId;
    const myName = usuario?.displayName || "Invitado";

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "live_games", codigoSala), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGameData(data);
                setFase(data.estado);
                setSubFase(data.fasePregunta);

                const misRespuestas = data.respuestasRonda ? data.respuestasRonda[myUid] : null;
                setMyResult(misRespuestas);

                const jugadoresMap = data.jugadores || {};
                const estoyDentro = Object.values(jugadoresMap).some(j => j.uid === myUid);

                if (estoyDentro) {
                    const misDatos = Object.values(jugadoresMap).find(j => j.uid === myUid);
                    if (misDatos) setPuntuacion(misDatos.puntos || 0);
                } else {
                    if (data.estado === 'LOBBY' && !joiningRef.current) {
                        joiningRef.current = true;
                        await updateDoc(doc(db, "live_games", codigoSala), {
                            [`jugadores.${myUid}`]: { uid: myUid, nombre: myName, puntos: 0, joinedAt: Date.now() }
                        });
                        joiningRef.current = false;
                    } else if (data.estado !== 'FIN') {
                        alert("Desconectado."); onExit();
                    }
                }

                if (data.estado === 'FIN') {
                    const sorted = Object.values(jugadoresMap).sort((a, b) => b.puntos - a.puntos);
                    const rank = sorted.findIndex(j => j.uid === myUid) + 1;
                    setMyRank(rank);
                    if (rank <= 3) confetti();
                }
            } else { alert("Sala cerrada."); onExit(); }
        });
        return () => unsubscribe();
    }, [codigoSala]);

    const notificarRespuesta = async (esCorrecta) => {
        let puntosGanados = 0;
        if (esCorrecta && gameData) {
            const p = gameData.preguntas[gameData.indicePregunta];
            // Si es presentación no suma puntos
            if (p.tipo !== 'PRESENTATION') {
                const max = parseInt(p.puntosMax || gameData.config?.puntosMax || 100);
                const min = parseInt(p.puntosMin || gameData.config?.puntosMin || 50);
                const tiempoTotal = parseInt(p.tiempo || gameData.config?.tiempoPregunta || 20);
                const inicio = gameData.questionStartTime || Date.now();
                const transcurrido = (Date.now() - inicio) / 1000;
                const factorTiempo = Math.max(0, (tiempoTotal - transcurrido) / tiempoTotal);
                puntosGanados = Math.round(min + (max - min) * factorTiempo);
            }
        }

        const respuestaData = { uid: myUid, correct: esCorrecta, puntosGanados, timestamp: Date.now() };
        if (esCorrecta) {
            await updateDoc(doc(db, "live_games", codigoSala), { [`jugadores.${myUid}.puntos`]: increment(puntosGanados) });
        }
        await updateDoc(doc(db, "live_games", codigoSala), { [`respuestasRonda.${myUid}`]: respuestaData });
    };

    const enviarDuda = async () => {
        if (!textoDuda.trim()) return;
        const dudaId = `msg_${Date.now()}`;
        await updateDoc(doc(db, "live_games", codigoSala), { [`mensajes.${dudaId}`]: { uid: myUid, alumno: myName, texto: textoDuda, timestamp: Date.now() } });
        setTextoDuda(''); setShowDudaModal(false); alert("Enviado");
    };

    if (!gameData) return <div style={{ color: 'white', padding: 20 }}>Conectando...</div>;

    const preguntaActual = gameData.preguntas?.[gameData.indicePregunta];

    // Determinar texto correcto para feedback
    let textoRespuestaCorrecta = "";
    if (preguntaActual) {
        if (preguntaActual.tipo === 'RELLENAR' && preguntaActual.bloques) textoRespuestaCorrecta = preguntaActual.bloques[1];
        else if (preguntaActual.tipo === 'ORDENAR') textoRespuestaCorrecta = "Orden Incorrecto";
        else textoRespuestaCorrecta = (preguntaActual.correcta || preguntaActual.respuesta || preguntaActual.a || "");
    }

    const currentQ = (gameData.indicePregunta || 0) + 1;
    const totalQ = gameData.preguntas ? gameData.preguntas.length : 0;

    return (
        <div className="game-container client-mode">
            <EstilosComunes />
            <EstilosThinkHoot />

            <div className="top-hud">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="btn-exit" onClick={onExit}>X</button>
                    {fase === 'JUEGO' && <div className="q-counter">{currentQ}/{totalQ}</div>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <div className="score-badge">{puntuacion} pts</div>
                    <button className="btn-inbox client-msg-btn" onClick={() => setShowDudaModal(true)}><Send size={28} color="white" /></button>
                </div>
            </div>

            {showDudaModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Preguntar al Profesor</h3>
                        <textarea value={textoDuda} onChange={e => setTextoDuda(e.target.value)} rows={3} />
                        <div className="modal-actions"><button className="btn-cancel" onClick={() => setShowDudaModal(false)}>Cancelar</button><button className="btn-confirm" onClick={enviarDuda}>Enviar</button></div>
                    </div>
                </div>
            )}

            {fase === 'LOBBY' && <div className="lobby-wait"><h2>¡Estás dentro, {myName}!</h2><p>Espera al profesor...</p><div className="avatar-wait">🦉</div></div>}
            {fase === 'COUNTDOWN' && <div className="lobby-wait"><h1>¡ATENTOS!</h1></div>}

            {fase === 'JUEGO' && (
                <div className="client-question-area">
                    {preguntaActual ? (
                        <ClientQuestionEngine
                            data={preguntaActual}
                            config={gameData.config}
                            startTime={gameData.questionStartTime}
                            subFase={subFase}
                            myResult={myResult}
                            correctAnswerText={textoRespuestaCorrecta}
                            currentTotalScore={puntuacion}
                            onResponded={notificarRespuesta}
                        />
                    ) : <div>Cargando...</div>}
                </div>
            )}

            {fase === 'FIN' && (
                <div className="lobby-wait">
                    <h1>FIN DE PARTIDA</h1>
                    <h2>Puntuación Final: {puntuacion}</h2>
                    {myRank && <div className="final-rank-badge">Has quedado en la posición <span>{myRank}º</span></div>}
                </div>
            )}
        </div>
    );
}

// --- ENGINE DEL ALUMNO ---
function ClientQuestionEngine({ data, config, startTime, subFase, myResult, correctAnswerText, currentTotalScore, onResponded }) {
    const [answeredLocal, setAnsweredLocal] = useState(false);
    const [timeLeft, setTimeLeft] = useState(100);
    const [isLate, setIsLate] = useState(false);

    useEffect(() => {
        setAnsweredLocal(false);
        setIsLate(false);
        setTimeLeft(100);
    }, [data]);

    useEffect(() => {
        if (subFase !== 'RESPONDING' || answeredLocal || data.tipo === 'PRESENTATION') return;
        const tiempoTotal = parseInt(data.tiempo || config?.tiempoPregunta || 20);
        const interval = setInterval(() => {
            const transcurrido = (Date.now() - startTime) / 1000;
            const pct = Math.max(0, 100 - (transcurrido / tiempoTotal * 100));
            setTimeLeft(pct);
            if (pct < 20) setIsLate(true);
            if (pct <= 0) {
                clearInterval(interval);
                if (!answeredLocal && !myResult) {
                    handleAnswer(false);
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [startTime, subFase, answeredLocal, myResult, data]);

    const handleAnswer = (isCorrect) => {
        if (answeredLocal) return;
        setAnsweredLocal(true);
        onResponded(isCorrect);
    };

    // MODO PRESENTACIÓN (ALUMNO)
    if (data.tipo === 'PRESENTATION') {
        return (
            <div className="waiting-others">
                <Monitor size={64} color="white" />
                <h2>¡Mira la pantalla del profesor!</h2>
            </div>
        );
    }

    // MODO FEEDBACK (REVEAL) - CENTRADO ABSOLUTO EN PANTALLA
    if (subFase === 'REVEAL') {
        const fueCorrecta = myResult?.correct;
        const puntosGanados = myResult?.puntosGanados || 0;

        if (fueCorrecta) {
            return (
                <div className="feedback-container">
                    <div className="pi-feedback-wrapper">
                        <img src={piHappy} className="pi-feedback happy" alt="Happy Pi" />
                    </div>
                    <div className="neon-card success">
                        <CheckCircle size={50} color="#2ecc71" />
                        <div className="neon-title">¡CORRECTO!</div>
                        <div className="points-added">+{puntosGanados} pts</div>
                    </div>
                </div>
            );
        } else {
            const mensajeError = (!myResult) ? "¡TIEMPO!" : "¡INCORRECTO!";
            return (
                <div className="feedback-container">
                    <div className="pi-feedback-wrapper">
                        <img src={piAngry} className="pi-feedback angry" alt="Angry Pi" />
                    </div>
                    <div className="neon-card error">
                        <XCircle size={50} color="#ff003c" />
                        <div className="neon-title">{mensajeError}</div>
                        {correctAnswerText && (
                            <>
                                <div className="neon-label">La respuesta correcta era:</div>
                                <div className="neon-answer">{parseText(correctAnswerText)}</div>
                            </>
                        )}
                    </div>
                </div>
            );
        }
    }

    // MODO LEADERBOARD
    if (subFase === 'LEADERBOARD') {
        return (
            <div className="feedback-container">
                <div className="pi-feedback-wrapper">
                    <img src={piNeutral} className="pi-feedback" alt="Neutral Pi" />
                </div>
                <div className="neon-card neutral">
                    <div className="neon-title">Puntuación Total</div>
                    <div className="points-added big">{currentTotalScore} pts</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', maxWidth: '600px' }}>
            <div className={`timer-bar-container ${isLate ? 'blinking' : ''}`}>
                <div className="timer-bar-fill" style={{ width: `${timeLeft}%`, backgroundColor: isLate ? '#e74c3c' : '#2ecc71' }}></div>
            </div>

            {answeredLocal || myResult ? (
                <div className="waiting-others">
                    <Loader className="spin-icon" size={48} />
                    <p>Respuesta enviada. Esperando...</p>
                </div>
            ) : (
                    <QuestionDisplay data={data} onAnswer={handleAnswer} disabled={false} isHostView={false} />
                )}
        </div>
    );
}

// ============================================================================
// 3. MODO LOCAL (Solo)
// ============================================================================
function ThinkHootLocal({ recurso, usuario, alTerminar }) {
    if (!recurso) return <div style={{ color: 'white', padding: 20 }}>Cargando...</div>;
    const [fase, setFase] = useState('SETUP');
    const [puntuacion, setPuntuacion] = useState(0);
    const [nombreInvitado, setNombreInvitado] = useState('');
    const [guardando, setGuardando] = useState(false);
    const esInvitado = !usuario || !usuario.email;
    const esPro = recurso?.tipo === 'PRO';

    const playSound = (type) => {
        let file = null;
        if (type === 'CORRECT') file = correctSoundFile; else if (type === 'WRONG') file = wrongSoundFile; else if (type === 'WIN') file = winSoundFile; else if (type === 'START') file = startSoundFile;
        if (file) new Audio(file).play().catch(() => { });
    };

    const incrementarPlayCount = async () => { if (recurso.id) try { await updateDoc(doc(db, 'resources', recurso.id), { playCount: increment(1) }); } catch (e) { } };

    const guardarRanking = async () => {
        if (guardando) return; setGuardando(true);
        try {
            const nombre = esInvitado ? (nombreInvitado || "Invitado") : usuario.displayName;
            const email = esInvitado ? 'invitado' : usuario.email;
            await updateDoc(collection(db, 'ranking'), { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'THINKHOOT', email, jugador: nombre, aciertos: puntuacion, fecha: new Date() });
            alTerminar();
        } catch (e) { alert("Error guardando"); }
        setGuardando(false);
    };

    if (fase === 'SETUP') return <PantallaSetup recurso={recurso} esPro={esPro} esInvitado={esInvitado} nombreInvitado={nombreInvitado} setNombreInvitado={setNombreInvitado} onStart={() => { setFase('COUNTDOWN') }} onExit={alTerminar} />;
    if (fase === 'COUNTDOWN') return <PantallaCuentaAtras playSound={playSound} onFinished={() => { incrementarPlayCount(); setFase('JUEGO') }} />;
    if (fase === 'FIN') return <PantallaFin puntuacion={puntuacion} guardarRanking={guardarRanking} guardando={guardando} esInvitado={esInvitado} alTerminar={alTerminar} playSound={playSound} />;

    return <EngineLocal recurso={recurso} esPro={esPro} setPuntuacionTotal={setPuntuacion} puntuacionActual={puntuacion} onFinish={() => setFase('FIN')} onExit={alTerminar} playSound={playSound} />;
}

// --- ENGINE LOCAL ---
function EngineLocal({ recurso, esPro, setPuntuacionTotal, puntuacionActual, onFinish, onExit, playSound }) {
    const [indice, setIndice] = useState(0); const [preguntas, setPreguntas] = useState([]); const [tiempoRestante, setTiempoRestante] = useState(0); const [pausa, setPausa] = useState(false); const [feedback, setFeedback] = useState(null); const timerRef = useRef(null);
    useEffect(() => {
        let pool = recurso.preguntas ? [...recurso.preguntas] : [];
        if (pool.length === 0 && recurso.hojas) recurso.hojas.forEach(h => { if (h.preguntas) pool.push(...h.preguntas); });
        setPreguntas(pool); if (pool.length > 0) cargarPregunta(0, pool); else onFinish();
        return () => clearInterval(timerRef.current);
    }, []);
    const cargarPregunta = (idx, list) => {
        const p = list[idx]; if (!p) { onFinish(); return; }
        setIndice(idx); setFeedback(null); setPausa(false);
        const tGlobal = parseInt(recurso.config?.tiempoPregunta) || 20; const t = esPro ? (parseInt(p.tiempo) || tGlobal) : tGlobal;
        setTiempoRestante(t); if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => { setTiempoRestante(prev => { if (prev <= 1) { clearInterval(timerRef.current); gestionarRespuesta(false); return 0; } return prev - 1; }); }, 1000);
    };
    const gestionarRespuesta = (ok) => {
        if (pausa) return; setPausa(true); clearInterval(timerRef.current);
        const p = preguntas[indice]; const ptsWin = esPro ? (parseInt(p.puntosMax) || 100) : (parseInt(recurso.config?.puntosAcierto) || 10); const ptsLose = esPro ? (parseInt(p.puntosMin) || 0) : (parseInt(recurso.config?.puntosFallo) || 2);
        if (ok) { playSound('CORRECT'); setFeedback('correct'); setPuntuacionTotal(v => v + ptsWin); }
        else { if (p.tipo !== 'PRESENTATION') { playSound('WRONG'); setFeedback('incorrect'); setPuntuacionTotal(v => Math.max(0, v - ptsLose)); } }
        setTimeout(() => { if (indice + 1 < preguntas.length) cargarPregunta(indice + 1, preguntas); else onFinish(); }, 2000);
    };
    const p = preguntas[indice]; if (!p) return <div>Cargando...</div>;
    return <div className="game-container"><EstilosComunes /><EstilosThinkHoot /><div className="game-area"><div className="top-hud"><button className="btn-exit" onClick={onExit}>Salir</button><div className="timer-badge">{tiempoRestante}s</div><div className="score-badge">{puntuacionActual} pts</div></div><QuestionDisplay data={p} onAnswer={gestionarRespuesta} disabled={pausa} feedback={feedback} /></div></div>;
}

// --- PANTALLAS EXTRA ---
function PantallaSetup({ recurso, esPro, esInvitado, nombreInvitado, setNombreInvitado, onStart, onExit }) {
    return <div className="card-menu"><h1>ThinkHoot</h1><h2>{recurso.titulo}</h2><p style={{ color: '#ccc' }}>Modo: {esPro ? '🔥 PRO' : 'Estándar'}</p>{esInvitado && <div style={{ marginBottom: 20 }}><input value={nombreInvitado} onChange={e => setNombreInvitado(e.target.value)} placeholder="Tu nombre..." style={{ padding: 10, width: '80%', borderRadius: 5, textAlign: 'center' }} /></div>}<button className="btn-success" onClick={() => { if (esInvitado && !nombreInvitado) return alert("Nombre requerido"); onStart() }}>JUGAR</button><button className="btn-back" onClick={onExit}>Volver</button><EstilosComunes /></div>;
}
function PantallaCuentaAtras({ playSound, onFinished }) {
    const [paso, setPaso] = useState(0); const [txt, setTxt] = useState('π');
    useEffect(() => { if (playSound) playSound('START'); const seq = async () => { setTxt("π"); setPaso(0); await new Promise(r => setTimeout(r, 1000)); setTxt("K"); setPaso(1); await new Promise(r => setTimeout(r, 1000)); setTxt("T"); setPaso(2); await new Promise(r => setTimeout(r, 1000)); setTxt("¡YA!"); setPaso(3); await new Promise(r => setTimeout(r, 1000)); onFinished(); }; seq(); }, []);
    return <div className="fullscreen-overlay"><div className={`countdown-text step-${paso}`}>{txt}</div><style>{`.fullscreen-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,#2c3e50,#000);display:flex;justify-content:center;align-items:center;z-index:9999}.countdown-text{font-size:10rem;font-weight:bold;color:white;animation:zoomIn 0.5s}.step-0{color:#3498db}.step-1{color:#e74c3c}.step-2{color:#f1c40f}.step-3{color:#2ecc71;transform:scale(1.2)}@keyframes zoomIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style></div>;
}
function PantallaFin({ puntuacion, guardarRanking, guardando, esInvitado, alTerminar, playSound }) {
    useEffect(() => { if (playSound) playSound('WIN'); confetti(); }, []);
    return <div className="card-menu"><h1>¡Juego Terminado!</h1><h2 style={{ color: '#f1c40f', fontSize: '4rem' }}>{puntuacion} pts</h2>{esInvitado ? <div style={{ background: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 10, margin: '20px 0' }}><p style={{ color: 'white' }}>¡Regístrate para guardar récords!</p><button className="btn-back" onClick={alTerminar}>Salir</button></div> : <button className="btn-success" onClick={guardarRanking} disabled={guardando}>{guardando ? 'Guardando...' : '💾 Guardar'}</button>}{!esInvitado && <button className="btn-back" onClick={alTerminar}>Salir</button>}<EstilosComunes /></div>;
}

// --- PODIUM (HOST) ---
function PodiumDisplay({ jugadores, final, playSound }) {
    const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos);
    const top3 = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
    const runnerUps = sorted.slice(3, 5);
    const rest = sorted.slice(5);

    useEffect(() => { if (final) { confetti(); if (playSound) playSound('WIN'); } }, [final]);

    return (
        <div className="podium-container">
            <div className="podium-stage">
                {top3.map((j, idx) => {
                    const realRank = sorted.indexOf(j) + 1;
                    let height = '100px'; if (realRank === 1) height = '160px'; if (realRank === 2) height = '120px';
                    return (
                        <div key={j.uid} className={`podium-pedestal rank-${realRank}`}>
                            <div className="podium-avatar">{realRank === 1 && <Trophy size={40} color="#f1c40f" />}{realRank === 2 && <Medal size={30} color="#bdc3c7" />}{realRank === 3 && <Medal size={30} color="#d35400" />}</div>
                            <div className="pedestal-bar" style={{ height }}><div className="p-rank">{realRank}º</div></div>
                            <div className="p-name">{j.nombre}</div>
                            <div className="p-score">{j.puntos}</div>
                        </div>
                    );
                })}
            </div>
            <div className="runners-up-grid">
                {runnerUps.map((j, i) => (
                    <div key={j.uid} className="runner-up-card"><span className="r-rank">{i + 4}º</span><span className="r-name">{j.nombre}</span><span className="r-score">{j.puntos}</span></div>
                ))}
            </div>
            {rest.length > 0 && (
                <div className="rest-list">{rest.map((j, i) => (<div key={j.uid} className="rest-row"><span>{i + 6}º {j.nombre}</span><span>{j.puntos}</span></div>))}</div>
            )}
        </div>
    );
}

// --- VISUALIZADOR DE PREGUNTA ---
function QuestionDisplay({ data, onAnswer, disabled, feedback, isHostView, showAnswer }) {
    const [orden, setOrden] = useState([]);
    const [texto, setTexto] = useState('');

    useEffect(() => {
        if (data.tipo === 'ORDENAR' && data.bloques) setOrden(isHostView ? data.bloques : [...data.bloques].sort(() => Math.random() - 0.5));
        setTexto('');
    }, [data, isHostView]);

    const responderSimple = (op) => {
        if (!isHostView) {
            const correctStr = data.correcta || data.respuesta || data.a;
            const ok = clean(op) === clean(correctStr);
            onAnswer(ok);
        }
    };
    const responderOrdenar = () => { if (!isHostView) onAnswer(JSON.stringify(data.bloques) === JSON.stringify(orden)); };
    const responderCompletar = () => { if (!isHostView) onAnswer(clean(texto) === clean(data.bloques?.[1])); };

    // Logic Ordenar
    const [slots, setSlots] = useState([]);
    useEffect(() => {
        if (!isHostView && data.tipo === 'ORDENAR' && data.bloques) {
            setSlots(new Array(data.bloques.length).fill(null));
        }
    }, [data, isHostView]);

    const addToSlot = (block, i) => { if (isHostView || disabled) return; const firstEmpty = slots.findIndex(s => s === null); if (firstEmpty !== -1) { const n = [...slots]; n[firstEmpty] = block; setSlots(n); } };
    const removeFromSlot = (i) => { if (isHostView || disabled) return; const n = [...slots]; n[i] = null; setSlots(n); };
    const confirmarOrden = () => { if (slots.some(s => s === null)) return; onAnswer(JSON.stringify(slots) === JSON.stringify(data.bloques)); };

    return (
        <div className="question-card">
            <h2>{parseText(data.q || data.pregunta)}</h2>
            {data.imagenUrl && <img src={data.imagenUrl} className="question-img-small" alt="" />}
            {data.tipo === 'PRESENTATION' && <div className="info-text">Presentación</div>}

            {data.tipo === 'ORDENAR' && !isHostView && (
                <div className="sort-wrapper">
                    <div className="source-blocks">{orden.map((b, i) => (<button key={i} className="block-chip" onClick={() => addToSlot(b, i)} disabled={slots.includes(b) || disabled} style={{ opacity: slots.includes(b) ? 0.3 : 1 }}>{parseText(b)}</button>))}</div>
                    <div className="target-slots">{slots.map((s, i) => (<div key={i} className="slot-box" onClick={() => removeFromSlot(i)}>{s ? parseText(s) : <span className="slot-num">{i + 1}</span>}</div>))}</div>
                    <button className="btn-confirmar" onClick={confirmarOrden} disabled={disabled || slots.includes(null)}>ENVIAR</button>
                </div>
            )}

            {data.tipo === 'ORDENAR' && isHostView && (
                <div className="ordered-solution">
                    {data.bloques.map((b, i) => <span key={i} className="order-chip">{parseText(b)}</span>)}
                </div>
            )}

            {data.tipo === 'RELLENAR' && (
                <div className="completar-box">
                    <div className="bloque-azul">{parseText(data.bloques?.[0])}</div>
                    {isHostView ? <span className="respuesta-host">[{data.bloques?.[1]}]</span> : <input value={texto} onChange={e => setTexto(e.target.value)} className="input-hueco-amarillo" disabled={disabled} />}
                    <div className="bloque-azul">{parseText(data.bloques?.[2])}</div>
                    {!isHostView && <button className="btn-confirmar" onClick={responderCompletar} disabled={disabled}>Enviar</button>}
                </div>
            )}

            {/* RESPUESTA CORTA CLIENTE: INPUT + BOTON */}
            {(!data.tipo || data.tipo === 'SIMPLE' || data.tipo === 'texto') && !isHostView && !data.incorrectas && !data.opcionesFijas && (
                <div className="short-answer-client">
                    <input placeholder="Tu respuesta..." value={texto} onChange={e => setTexto(e.target.value)} className="input-grande" disabled={disabled} />
                    <button className="btn-confirmar" onClick={() => onAnswer(clean(texto) === clean(data.a || data.respuesta))} disabled={disabled}>ENVIAR</button>
                </div>
            )}

            {/* OPCIONES MÚLTIPLES */}
            {(data.opcionesFijas || data.incorrectas) && (
                <div className="options-grid">
                    {(data.opcionesFijas || [data.respuesta || data.correcta, ...data.incorrectas].sort(() => Math.random() - 0.5)).map((op, k) => (
                        <button key={k} className={`btn-option ${feedback === 'correct' && clean(op) === clean(data.respuesta || data.correcta || data.a) ? 'correct' : ''} ${feedback === 'incorrect' ? 'dimmed' : ''} ${showAnswer && clean(op) === clean(data.respuesta || data.correcta || data.a) ? 'host-correct' : ''}`} onClick={() => responderSimple(op)} disabled={disabled || isHostView}>{parseText(op)}</button>
                    ))}
                </div>
            )}
            {feedback && <div className={`feedback-overlay ${feedback}`}>{feedback === 'correct' ? '¡BIEN!' : '¡MAL!'}</div>}
        </div>
    );
}

const EstilosComunes = () => (<style>{` @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Roboto:wght@400;700&display=swap'); .card-menu { background: rgba(0,0,0,0.85); padding: 40px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; color: white; font-family: 'Roboto', sans-serif; box-shadow: 0 20px 50px rgba(0,0,0,0.5); margin: 50px auto; } .btn-success { width: 100%; padding: 15px; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; color: #fff; background: #2ecc71; margin-bottom: 10px; font-size: 1.2rem; } .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; } `}</style>);

const EstilosThinkHoot = () => (
    <style>{`
        .game-container { width: 100vw; height: 100vh; background: #2c3e50; display: flex; overflow: hidden; position: relative; font-family: 'Roboto', sans-serif; }
        
        /* AVATAR PI - RESPONSIVE Y CENTRADO */
        .pi-avatar-container { position: absolute; top: 80px; left: 20px; z-index: 50; display: flex; flex-direction: column; align-items: center; transition: all 0.3s; }
        .pi-avatar-img { width: 120px; height: 120px; object-fit: contain; animation: popIn 0.5s; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3)); }
        .pi-stats-badge { background: #f1c40f; color: #2c3e50; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-family: 'Righteous'; margin-top: -10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .pi-avatar-img.angry { animation: shake 0.5s; }
        .pi-avatar-img.happy { animation: bounce 1s infinite; }

        /* FEEDBACK SCREEN CENTRADA */
        .feedback-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 20px; width: 100%; position: fixed; top: 0; left: 0; z-index: 2000; background: rgba(44, 62, 80, 0.95); }
        .pi-feedback-wrapper { display: flex; justify-content: center; width: 100%; margin-bottom: 10px; }
        .pi-feedback { width: 150px; height: 150px; object-fit: contain; animation: popIn 0.5s; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); }
        .pi-feedback.happy { animation: bounce 2s infinite; }
        .pi-feedback.angry { animation: shake 0.5s; }

        /* HOST LAYOUT */
        .host-mode .top-hud { background: #34495e; height: 60px; padding: 0 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); width: 100%; box-sizing: border-box; }
        .room-code { color: white; font-size: 1.5rem; font-weight: bold; }
        .room-code span { color: #f1c40f; }
        .player-counter { color: white; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
        .q-counter { color: white; font-weight: bold; font-family: 'Righteous'; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 5px; }
        
        /* BOTÓN MENSAJE ESTUDIANTE VERDE */
        .client-msg-btn { background: #2ecc71 !important; padding: 10px !important; border-radius: 50% !important; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; box-shadow: 0 4px 0 #27ae60; }
        .client-msg-btn:active { transform: translateY(2px); box-shadow: none; }

        /* CORRECT ANSWER REVEAL (HOST) */
        .host-question-view.centered { display: flex; justify-content: center; align-items: center; height: 100%; width: 100%; flex-direction: column; flex-grow: 1; }
        .correct-answer-reveal { background: #2ecc71; padding: 40px; border-radius: 20px; text-align: center; color: white; width: 90%; max-width: 600px; animation: popIn 0.5s; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 5px solid #27ae60; margin: auto; margin-top: 150px; }
        .reveal-label { font-size: 1.5rem; margin-bottom: 20px; opacity: 0.8; }
        .reveal-text { font-size: 3rem; font-weight: bold; font-family: 'Righteous'; line-height: 1.2; }

        /* HOST CONTROLS (BOTÓN SIGUIENTE AZUL) */
        .host-controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 100; }
        .btn-next-floating { background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: none; padding: 15px 40px; font-size: 1.5rem; border-radius: 50px; cursor: pointer; display: flex; align-items: center; gap: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transition: transform 0.1s; font-family: 'Righteous'; border: 2px solid white; }
        .btn-next-floating:active { transform: translateX(-50%) scale(0.95); }

        /* ORDENAR STYLES */
        .sort-wrapper { display: flex; flex-direction: column; gap: 20px; width: 100%; align-items: center; }
        .source-blocks { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .block-chip { padding: 10px 15px; background: #3498db; color: white; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; box-shadow: 0 3px 0 #2980b9; transition: transform 0.1s; }
        .block-chip:active { transform: translateY(2px); box-shadow: none; }
        .target-slots { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
        .slot-box { width: 100px; height: 50px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); color: white; font-weight: bold; cursor: pointer; }
        .slot-num { color: #555; }
        .ordered-solution { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .order-chip { background: #27ae60; color: white; padding: 10px; border-radius: 5px; font-weight: bold; }

        .completar-box { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-size: 1.5rem; color: white; }
        .bloque-azul { background: #3498db; padding: 10px 20px; border-radius: 10px; font-weight: bold; }
        .input-hueco-amarillo { background: #f1c40f; color: #2c3e50; border: none; padding: 10px; border-radius: 10px; font-weight: bold; font-size: 1.5rem; width: 150px; text-align: center; }
        
        .presentation-card { background: #2c3e50; border: 4px solid #3498db; padding: 20px; border-radius: 20px; text-align: center; }
        .p-top { font-family: 'Righteous'; color: #f1c40f; font-size: 2.5rem; margin-bottom: 20px; }
        .p-bottom { font-family: 'Roboto'; color: white; font-size: 1.5rem; margin-top: 20px; font-weight: bold; }
        .presentation-img-large { border: 5px solid white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 50vh; }

        .short-answer-client { display: flex; flex-direction: column; gap: 15px; width: 100%; align-items: center; }
        .input-grande { width: 100%; padding: 20px; font-size: 1.5rem; border-radius: 15px; border: none; text-align: center; }

        /* PODIUM STYLES */
        .podium-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; color: white; overflow-y: auto; padding-top: 60px; padding-bottom: 100px; }
        .podium-container { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; max-width: 800px; }
        .podium-stage { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin-bottom: 30px; }
        .podium-pedestal { display: flex; flex-direction: column; align-items: center; animation: bounceIn 1s; }
        .pedestal-bar { width: 80px; background: linear-gradient(to bottom, #f39c12, #d35400); border-radius: 10px 10px 0 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .rank-2 .pedestal-bar { background: linear-gradient(to bottom, #bdc3c7, #7f8c8d); }
        .rank-3 .pedestal-bar { background: linear-gradient(to bottom, #e67e22, #a0500d); }
        .p-rank { font-size: 2rem; font-weight: bold; color: rgba(0,0,0,0.3); }
        .p-name { margin-top: 10px; font-weight: bold; font-size: 1.1rem; }
        .p-score { background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 10px; margin-top: 5px; font-size: 0.9rem; }
        
        .runners-up-grid { display: flex; gap: 10px; width: 100%; justify-content: center; animation: slideInDown 0.5s; flex-wrap: wrap; }
        .runner-up-card { background: rgba(255,255,255,0.1); padding: 10px 20px; border-radius: 10px; display: flex; gap: 10px; align-items: center; font-weight: bold; }
        .r-rank { color: #f1c40f; }
        
        .rest-list { width: 80%; background: rgba(0,0,0,0.2); border-radius: 10px; max-height: 150px; overflow-y: auto; padding: 10px; margin-top: 20px; }
        .rest-row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }

        .btn-save-global { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 1rem; }
        .btn-exit-big { background: transparent; border: 2px solid #ccc; color: #ccc; padding: 10px 30px; border-radius: 20px; cursor: pointer; font-size: 1rem; }

        /* PANEL DUDAS */
        .btn-inbox { background: transparent; border: none; color: white; cursor: pointer; position: relative; padding: 5px; }
        .btn-inbox.has-messages { color: #f1c40f; animation: pulse 2s infinite; }
        .badge { position: absolute; top: -5px; right: -5px; background: #e74c3c; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; }
        .dudas-panel { position: absolute; top: 70px; right: 20px; width: 320px; max-height: 500px; background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; z-index: 100; animation: slideInDown 0.3s; }
        .dudas-header { background: #2c3e50; color: white; padding: 10px 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .dudas-header button { background: none; border: none; color: white; cursor: pointer; }
        .dudas-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
        .duda-item { background: #f9f9f9; padding: 10px; border-radius: 5px; cursor: pointer; border: 1px solid #eee; font-size: 0.9rem; transition: background 0.2s; color: #333; }
        .duda-item:hover { background: #e3f2fd; }
        .duda-detalle { display: flex; flex-direction: column; gap: 10px; }
        .duda-info { background: #f0f0f0; padding: 10px; border-radius: 5px; color: #333; }
        .duda-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
        .act-btn { border: none; padding: 8px; border-radius: 5px; cursor: pointer; color: white; display: flex; justify-content: center; }
        .act-btn.green { background: #2ecc71; } .act-btn.red { background: #e74c3c; } .act-btn.dark { background: #34495e; } .act-btn.gray { background: #95a5a6; }
        .btn-back-small { background: transparent; border: 1px solid #ccc; color: #666; padding: 5px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; margin-top: 5px; }

        /* GAME AREA */
        .lobby-screen, .lobby-wait { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; width: 100%; }
        .big-code { font-size: 6rem; font-family: 'Righteous'; color: #f1c40f; letter-spacing: 5px; margin: 20px 0; text-shadow: 0 0 30px rgba(241, 196, 15, 0.5); }
        .players-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 800px; margin: 30px 0; }
        .player-chip { background: #3498db; color: white; padding: 10px 20px; border-radius: 20px; font-weight: bold; animation: popIn 0.3s; }
        .btn-start-big { background: #2ecc71; color: white; border: none; padding: 20px 50px; font-size: 2rem; border-radius: 50px; cursor: pointer; font-family: 'Righteous'; display: flex; align-items: center; gap: 15px; box-shadow: 0 10px 0 #27ae60; transition: transform 0.1s; }
        .btn-start-big:active { transform: translateY(10px); box-shadow: none; }
        .btn-start-big:disabled { background: #95a5a6; box-shadow: none; cursor: not-allowed; opacity: 0.5; }

        .game-area { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; width: 100%; }
        .top-hud { position: absolute; top: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; width: calc(100% - 40px); }
        .btn-exit { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 8px 15px; border-radius: 20px; cursor: pointer; }
        .timer-badge { background: #f1c40f; color: #2c3e50; padding: 10px 20px; border-radius: 50%; font-weight: bold; font-size: 1.5rem; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .score-badge { background: #3498db; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; }

        .question-card { background: white; padding: 30px; border-radius: 20px; width: 90%; max-width: 800px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3); position: relative; overflow: hidden; margin-top: 100px; }
        .question-card h2 { color: #2c3e50; margin-bottom: 20px; font-size: 1.8rem; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .btn-option { padding: 20px; border: none; border-radius: 10px; font-size: 1.2rem; cursor: pointer; color: white; font-weight: bold; transition: transform 0.1s; background: #34495e; box-shadow: 0 4px 0 #2c3e50; }
        .btn-option:nth-child(1) { background: #e74c3c; box-shadow: 0 4px 0 #c0392b; }
        .btn-option:nth-child(2) { background: #3498db; box-shadow: 0 4px 0 #2980b9; }
        .btn-option:nth-child(3) { background: #f1c40f; box-shadow: 0 4px 0 #f39c12; }
        .btn-option:nth-child(4) { background: #2ecc71; box-shadow: 0 4px 0 #27ae60; }
        .btn-option:active { transform: translateY(4px); box-shadow: none; }
        .btn-option.dimmed { opacity: 0.3; }
        .host-correct { border: 4px solid #27ae60; transform: scale(1.05); }
        
        /* Matemáticas */
        sup { vertical-align: super; font-size: smaller; }
        .fraction { display: inline-block; text-align: center; vertical-align: middle; margin: 0 5px; font-size: 0.9em; }
        .numer { border-bottom: 2px solid white; display: block; padding: 0 2px; }
        .denom { display: block; padding: 0 2px; }

        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); } 70% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes flashRed { 0%, 100% { box-shadow: 0 0 0 transparent; } 50% { box-shadow: 0 0 20px red; } }
        @keyframes floatUp { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-30px); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .rotate-90 { transform: rotate(90deg); }

        /* RESPONSIVE */
        @media (max-width: 600px) {
            .pi-avatar-container { top: unset; bottom: 20px; left: 10px; transform: scale(0.6); transform-origin: bottom left; }
            .top-hud { padding: 0 10px; height: 50px; font-size: 0.8rem; }
            .room-code { font-size: 1rem; }
            .question-card { margin-top: 20px; padding: 15px; width: 95%; }
            .question-card h2 { font-size: 1.2rem; }
            .options-grid { grid-template-columns: 1fr; }
            .btn-option { padding: 15px; font-size: 1rem; }
            .timer-big { font-size: 2.5rem; }
            .podium-row { padding: 10px 15px; font-size: 1rem; }
        }
    `}</style>
);