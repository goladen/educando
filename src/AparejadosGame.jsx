import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
// AÑADIDO: 'increment' para sumar 1 al playCount
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, orderBy, limit, updateDoc, getCountFromServer, increment } from 'firebase/firestore';
import confetti from 'canvas-confetti';

// --- IMPORTACIÓN DE AUDIOS ---
import startSoundFile from './assets/inicio juego.mp3';
import correctSoundFile from './assets/correct-choice-43861.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';

export default function AparejadosGame({ recurso, usuario, alTerminar, modoOlimpico = false, tiempoOlimpico = null, onOlimpicoFinish = null}) {
    const [fase, setFase] = useState('SETUP');
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [modoDuelo, setModoDuelo] = useState(false);

    // Estados del Juego
    const [cartas, setCartas] = useState([]);
    const [flipped, setFlipped] = useState([]);
    const [matched, setMatched] = useState([]);
   

    // Puntuación
    const [puntos, setPuntos] = useState(0);
    const [puntosDuelo, setPuntosDuelo] = useState([0, 0]);
    const [turno, setTurno] = useState(0);

    const [tiempo, setTiempo] = useState(60);
    const [verRanking, setVerRanking] = useState(false);
    const [guardando, setGuardando] = useState(false);

    // --- AUTO-START MODO OLÍMPICO ---
    useEffect(() => {
        if (modoOlimpico && recurso && fase === 'SETUP') {
            iniciar(false, 'General'); // Inicia 1 Jugador automáticamente
        }
    }, [modoOlimpico, recurso, fase]);

    // --- INTERCEPTOR FINAL MODO OLÍMPICO ---
    useEffect(() => {
        if (fase === 'FIN' && modoOlimpico) {
            if (onOlimpicoFinish) onOlimpicoFinish(puntos);
        }
    }, [fase, modoOlimpico, puntos]); // Pasará la variable 'puntos' actual


    // Detectar si es invitado (sin usuario logueado)
    const esInvitado = !usuario || !usuario.email;

    // --- SONIDOS ---
    const playSound = (type) => {
        let file = null;
        if (type === 'START') file = startSoundFile;
        else if (type === 'CORRECT') file = correctSoundFile;
        else if (type === 'WIN') file = winSoundFile;

        if (file) {
            const audio = new Audio(file);
            audio.volume = 0.6;
            audio.play().catch(e => { });

            if (type === 'CORRECT') {
                setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1000);
            }
        }
    };

    // --- INCREMENTAR CONTADOR DE PARTIDAS ---
    const incrementarPlayCount = async () => {
        try {
            const ref = doc(db, 'resources', recurso.id);
            await updateDoc(ref, {
                playCount: increment(1)
            });
        } catch (error) {
            console.error("Error al incrementar playCount:", error);
        }
    };

    // --- INICIAR PARTIDA ---
    const iniciar = (esDuelo, hoja) => {
        setModoDuelo(esDuelo);
        setHojaSeleccionada(hoja);

        let pool = [];
        if (hoja === 'General') {
            recurso.hojas?.forEach(h => { h.preguntas.forEach((p, i) => pool.push({ ...p, idOriginal: i })); });
        } else {
            const hObj = recurso.hojas?.find(h => h.nombreHoja === hoja);
            if (hObj) hObj.preguntas.forEach((p, i) => pool.push({ ...p, idOriginal: i }));
        }
        if (recurso.config?.aleatorio !== false) {
            // ALGORITMO FISHER-YATES (Barajado perfecto)
            // Recorremos el array hacia atrás e intercambiamos cada elemento con uno aleatorio anterior
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
        }

        
        const limitConfig = parseInt(recurso.config?.numParejas) || 8;
        const limitReal = Math.min(pool.length, limitConfig);
        const seleccion = pool.slice(0, limitReal);

        let mazo = [];
        seleccion.forEach((p, i) => {
            mazo.push({ id: i, content: p.terminoA, pairId: i, uniqueId: `a-${i}` });
            mazo.push({ id: i, content: p.terminoB, pairId: i, uniqueId: `b-${i}` });
        });

        mazo.sort(() => Math.random() - 0.5);

        setCartas(mazo);
        setMatched([]);
        setFlipped([]);
        setPuntos(0);
        setPuntosDuelo([0, 0]);
        setTurno(0);
        setTiempo(modoOlimpico && tiempoOlimpico ? tiempoOlimpico : (parseInt(recurso.config?.tiempoTotal) || 60));
        // IR A CUENTA ATRÁS PRIMERO
        setFase('COUNTDOWN');
    };

    // --- CRONÓMETRO ---
    useEffect(() => {
        if (fase !== 'JUEGO' || modoDuelo) return;
        const t = setInterval(() => {
            setTiempo(prev => {
                if (prev <= 1) {
                    setFase('FIN');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [fase, modoDuelo]);

    // --- LÓGICA JUEGO ---
    const handleClick = (carta) => {
        if (flipped.length >= 2 || flipped.includes(carta.uniqueId) || matched.includes(carta.uniqueId)) return;

        const newFlipped = [...flipped, carta.uniqueId];
        setFlipped(newFlipped);

        if (newFlipped.length === 2) {
            const carta1 = cartas.find(c => c.uniqueId === newFlipped[0]);
            const carta2 = cartas.find(c => c.uniqueId === newFlipped[1]);

            if (carta1.pairId === carta2.pairId) {
                // ACIERTO
                playSound('CORRECT');
                const newMatched = [...matched, carta1.uniqueId, carta2.uniqueId];
                setMatched(newMatched);
                setFlipped([]);

                const ptsPareja = parseInt(recurso.config?.puntosPareja) || 10;
                if (modoDuelo) {
                    setPuntosDuelo(prev => {
                        const copy = [...prev];
                        copy[turno] += ptsPareja;
                        return copy;
                    });
                } else {
                    setPuntos(p => p + ptsPareja);
                }

                if (newMatched.length === cartas.length) {
                    setTimeout(() => setFase('FIN'), 500);
                }

            } else {
                // FALLO
                setTimeout(() => {
                    setFlipped([]);
                    if (modoDuelo) {
                        setTurno(prev => prev === 0 ? 1 : 0);
                    }
                }, 1000);
            }
        }
    };

    // --- GUARDADO RANKING ---
    const guardarRanking = async (nombreJugadorManual = null) => {
        if (guardando) return;

        if (esInvitado && !nombreJugadorManual) {
            alert("Por favor, escribe tu nombre para guardar el récord.");
            return;
        }

        setGuardando(true);
        try {
            const rankingRef = collection(db, 'ranking');
            const emailUsuario = esInvitado ? 'invitado' : usuario.email;
            const nombreJugador = esInvitado ? nombreJugadorManual : (usuario.displayName || "Anónimo");

            const qBetter = query(
                rankingRef,
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hojaSeleccionada),
                where('tipoJuego', '==', 'APAREJADOS'),
                where('aciertos', '>', puntos)
            );

            let rank = 1;
            try {
                const snapBetter = await getCountFromServer(qBetter);
                rank = snapBetter.data().count + 1;
            } catch (err) { console.warn("Falta índice Firebase", err); }

            let medallaCalc = '';
            if (rank === 1) medallaCalc = '🥇';
            if (rank === 2) medallaCalc = '🥈';
            if (rank === 3) medallaCalc = '🥉';

            let docExistenteId = null;
            let oldScore = 0;

            if (!esInvitado) {
                const q = query(
                    rankingRef,
                    where('recursoId', '==', recurso.id),
                    where('categoria', '==', hojaSeleccionada),
                    where('email', '==', emailUsuario),
                    where('tipoJuego', '==', 'APAREJADOS')
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    docExistenteId = snap.docs[0].id;
                    oldScore = snap.docs[0].data().aciertos;
                }
            }

            if (docExistenteId) {
                if (puntos > oldScore) {
                    await updateDoc(doc(db, 'ranking', docExistenteId), {
                        aciertos: puntos,
                        fecha: new Date(),
                        medalla: medallaCalc,
                        recursoTitulo: recurso.titulo
                    });
                    alert(`🚀 ¡Nuevo Récord Personal! Estás en la posición #${rank}`);
                } else {
                    alert(`⚠️ No has superado tu récord (${oldScore}). Posición actual: #${rank}`);
                }
            } else {
                await addDoc(rankingRef, {
                    recursoId: recurso.id,
                    recursoTitulo: recurso.titulo,
                    tipoJuego: 'APAREJADOS',
                    juego: 'Aparejados',
                    categoria: hojaSeleccionada,
                    email: emailUsuario,
                    jugador: nombreJugador,
                    aciertos: puntos,
                    fecha: new Date(),
                    medalla: medallaCalc
                });
                alert(`✅ Puntuación Guardada. Posición #${rank}`);
            }
            alTerminar();
        } catch (e) { console.error(e); alert("Error guardando"); }
        setGuardando(false);
    };
    // --- DETECTAR SI ES IMAGEN ---
    const esImagen = (texto) => {
        if (typeof texto !== 'string') return false;
        // Detecta extensiones comunes de imagen o si viene de flagcdn
        return /\.(jpeg|jpg|gif|png|svg|webp)$/i.test(texto) || texto.includes('flagcdn.com');
    };
    // --- CÁLCULO DE COLUMNAS Y FILAS PARA CSS GRID ---
    const calcularGrid = () => {
        const total = cartas.length;
        if (total === 0) return { cols: 1, rows: 1 };
        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);
        return { cols, rows };
    };
    const { cols, rows } = calcularGrid();

    // --- RENDERIZADO PANTALLAS ---

    if (fase === 'SETUP' && !verRanking) return (
        <PantallaSetup
            recurso={recurso}
            onStart={iniciar}
            onRanking={() => setVerRanking(true)}
            onExit={alTerminar}
        />
    );

    if (verRanking) return <PantallaRanking recurso={recurso} usuario={usuario} onBack={() => setVerRanking(false)} />;

    if (fase === 'COUNTDOWN') {
        return (
            <PantallaCuentaAtras
                hoja={hojaSeleccionada}
                profesor={recurso.profesorNombre || "Tu Profesor"}
                instrucciones={recurso.instrucciones}
                playSound={playSound}
                onFinished={() => {
                    incrementarPlayCount(); // Sumar +1 partida al terminar la cuenta atrás
                    setFase('JUEGO');
                }}
            />
        );
    }

    if (fase === 'FIN') {
        return (
            <PantallaFin
                puntos={puntos}
                puntosDuelo={puntosDuelo}
                modoDuelo={modoDuelo}
                esInvitado={esInvitado}
                guardarRanking={guardarRanking}
                guardando={guardando}
                alTerminar={alTerminar}
                playSound={playSound}
                recurso={recurso}
                hoja={hojaSeleccionada}
                modoOlimpico={modoOlimpico}
            />
        );
    }

    return (
        <div id="game-ui">
            {/* HEADER */}
            <header>
                {/* OCULTAMOS EL BOTÓN SALIR SI ESTAMOS EN OLIMPIADAS */}
                {!modoOlimpico && (
                    <button className="btn-back-small" onClick={alTerminar}>SALIR</button>
                )}
                {modoDuelo ? (
                    <div className="duelo-header">
                        <div className={`marcador ${turno === 0 ? 'activo azul' : ''}`}>AZUL: {puntosDuelo[0]}</div>
                        <div className="vs">VS</div>
                        <div className={`marcador ${turno === 1 ? 'activo naranja' : ''}`}>NARANJA: {puntosDuelo[1]}</div>
                    </div>
                ) : (
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div className="stat-box">⏱ {tiempo}</div>
                            <div className="stat-box">⭐ {puntos}</div>
                        </div>
                    )}
            </header>

            {/* TABLERO RESPONSIVE */}
            <div className="table-container">
                <div
                    className="game-board"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gridTemplateRows: `repeat(${rows}, 1fr)`
                    }}
                >
                    {cartas.map(carta => {
                        const isMatched = matched.includes(carta.uniqueId);
                        const isFlipped = flipped.includes(carta.uniqueId);

                        return (
                            <div key={carta.uniqueId} className="card-cell">
                                <div
                                    className={`card ${isFlipped || isMatched ? 'flipped' : ''}`}
                                    onClick={() => handleClick(carta)}
                                    style={{ visibility: isMatched ? 'hidden' : 'visible', opacity: isMatched ? 0 : 1 }}
                                >
                                    <div className="face front">
                                        {esImagen(carta.content) ? (
                                            <img
                                                src={carta.content}
                                                alt="contenido"
                                                style={{
                                                    maxWidth: '90%',
                                                    maxHeight: '90%',
                                                    objectFit: 'contain',
                                                    pointerEvents: 'none' // Para evitar arrastrar la imagen
                                                }}
                                            />
                                        ) : (
                                                <span>{carta.content}</span>
                                            )}
                                    </div>
                                    <div className="face back">?</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <EstilosComunes />

            <style>{`
                /* CONTENEDOR PRINCIPAL 100% RESPONSIVE */
                #game-ui { 
                    display: flex; 
                    flex-direction: column; 
                    height: 100vh; 
                    height: 100dvh; 
                    width: 100%; 
                    position: fixed; 
                    top: 0; left: 0; 
                    background: #2c3e50; 
                    overflow: hidden;
                }

                /* HEADER COMPACTO */
                header { 
                    flex: 0 0 auto; 
                    height: 50px; 
                    background: rgba(0,0,0,0.4); 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding: 0 15px; 
                    color: white; 
                    z-index: 10;
                }
                
                .stat-box { font-family: 'Fredoka One'; font-size: 1.2rem; color: #f1c40f; font-weight: bold; }
                .btn-back-small { background: rgba(0,0,0,0.5); border: 1px solid #777; color: white; padding: 5px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }
                
                .duelo-header { display: flex; align-items: center; gap: 10px; font-weight: bold; font-size: 0.9rem; }
                .marcador { padding: 4px 10px; border-radius: 12px; background: #555; opacity: 0.6; transition: 0.3s; white-space: nowrap; }
                .marcador.azul { background: #3498db; }
                .marcador.naranja { background: #e67e22; }
                .marcador.activo { opacity: 1; transform: scale(1.1); box-shadow: 0 0 10px rgba(255,255,255,0.5); border: 2px solid white; }
                .vs { font-style: italic; color: #888; }

                /* TAPETE FLEXIBLE */
                .table-container { 
                    flex: 1 1 auto; 
                    background-color: #27ae60; 
                    border: 5px solid #196f3d; 
                    border-radius: 10px; 
                    margin: 10px; 
                    box-shadow: inset 0 0 40px rgba(0,0,0,0.6); 
                    padding: 10px; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    overflow: hidden; 
                    position: relative;
                }
                
                /* GRID AJUSTABLE */
                .game-board { 
                    display: grid; 
                    gap: 2vmin; 
                    width: 100%; 
                    height: 100%; 
                    justify-content: center;
                    align-content: center;
                    box-sizing: border-box;
                }
                
                /* CELDA DE CARTA */
                .card-cell {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-width: 0; 
                    min-height: 0;
                }

                /* CARTA RESPONSIVA */
                .card { 
                    position: relative; 
                    width: 100%; 
                    height: 100%; 
                    aspect-ratio: 3/4; 
                    max-width: 100%;
                    max-height: 100%;
                    transform-style: preserve-3d; 
                    transition: transform 0.4s, opacity 0.5s; 
                    cursor: pointer; 
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                }
                
                .card.flipped { transform: rotateY(180deg); }
                
                /* CARAS DE LA CARTA */
                .face { 
                    position: absolute; width: 100%; height: 100%; 
                    backface-visibility: hidden; 
                    display: flex; align-items: center; justify-content: center; 
                    border-radius: 8px; 
                    padding: 5px; 
                    text-align: center;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                
                /* TEXTO RESPONSIVO */
                .face span {
                    font-size: clamp(10px, 4vmin, 24px); 
                    font-weight: bold;
                    line-height: 1.2;
                    word-wrap: break-word;
                }
                
                .face.back { 
                    background: repeating-linear-gradient(45deg, #c0392b, #c0392b 10px, #e74c3c 10px, #e74c3c 20px); 
                    border: 2px solid white; 
                    color: white; 
                    font-size: 2.5rem; 
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                }
                
                .face.front { 
                    background: #ecf0f1; 
                    color: #2c3e50; 
                    transform: rotateY(180deg); 
                    border: 2px solid #bdc3c7; 
                }
            `}</style>
        </div>
    );
}

// --- PANTALLAS AUXILIARES ---

function PantallaSetup({ recurso, onStart, onRanking, onExit }) {
    const [hoja, setHoja] = useState('General');
    const hojasDisponibles = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    return (
        <div className="card-menu">
            <h1>Juego de Parejas</h1>
            <h2 style={{ color: 'white', fontSize: '1.2rem' }}>{recurso.titulo}</h2>
            {hojasDisponibles.length > 0 && (
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Selecciona Modalidad:</label>
                    <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none' }}>
                        <option value="General">General (Mezcla todo)</option>
                        {hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            )}
            <button className="btn-success" onClick={() => onStart(false, hoja)}>👤 1 JUGADOR</button>
            <button className="btn-duel" onClick={() => onStart(true, hoja)}>👥 DUELO 1vs1</button>
            <button className="btn-ranking" onClick={onRanking}>🏆 Ver Ranking</button>
            <button className="btn-back" onClick={onExit}>⬅ Volver</button>
            <EstilosComunes />
        </div>
    );
}

function PantallaRanking({ recurso, usuario, onBack }) {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const hojas = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    useEffect(() => {
        const fetchRanking = async () => {
            try {
                const ref = collection(db, 'ranking');
                const qTop = query(
                    ref,
                    where('recursoId', '==', recurso.id),
                    where('tipoJuego', '==', 'APAREJADOS'),
                    where('categoria', '==', hoja),
                    orderBy('aciertos', 'desc'),
                    limit(10)
                );
                const snapTop = await getDocs(qTop);
                setTop10(snapTop.docs.map(d => d.data()));

                if (usuario && usuario.email) {
                    const qMejor = query(
                        ref,
                        where('recursoId', '==', recurso.id),
                        where('tipoJuego', '==', 'APAREJADOS'),
                        where('categoria', '==', hoja),
                        where('email', '==', usuario.email),
                        orderBy('aciertos', 'desc'),
                        limit(1)
                    );
                    const snapMejor = await getDocs(qMejor);
                    if (!snapMejor.empty) setMiMejor(snapMejor.docs[0].data().aciertos);
                }
            } catch (e) { console.log("Error ranking:", e); }
        };
        fetchRanking();
    }, [hoja]);

    const getMedalla = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1);

    return (
        <div className="card-menu">
            <h2 style={{ color: '#f1c40f' }}>🏆 Ranking</h2>
            <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '5px' }}><option value="General">General</option>{hojas.map(h => <option key={h} value={h}>{h}</option>)}</select>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '200px', overflowY: 'auto', marginBottom: '15px' }}>
                {top10.length === 0 ? <p>No hay datos aún.</p> : (
                    top10.map((f, i) => (
                        <div key={i} className="ranking-row"><span className="rank-pos">{getMedalla(i)}</span><span className="rank-name">{f.jugador}</span><span className="rank-score">{f.aciertos}</span></div>
                    ))
                )}
            </div>
            {miMejor !== null && <div className="personal-best">Tu Récord: {miMejor}</div>}
            <button className="btn-back" onClick={onBack}>Cerrar</button>
            <EstilosComunes />
        </div>
    );
}

function PantallaCuentaAtras({ hoja, profesor, instrucciones, playSound, onFinished }) {
    const [count, setCount] = useState(3);
    const [texto, setTexto] = useState('3');

    useEffect(() => {
        playSound('START');
        const run = async () => {
            setTexto("3"); setCount(3); await new Promise(r => setTimeout(r, 1000));
            setTexto("2"); setCount(2); await new Promise(r => setTimeout(r, 1000));
            setTexto("1"); setCount(1); await new Promise(r => setTimeout(r, 1000));
            setTexto("¡YA!"); setCount(0); await new Promise(r => setTimeout(r, 1000));
            onFinished();
        };
        run();
    }, []);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle, #2f3640, #1e272e)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', zIndex: 9999 }}>
            <div style={{ textAlign: 'center', marginBottom: '30px', animation: 'fadeIn 1s' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#aaa', margin: 0 }}>JUGANDO A</h3>
                <h1 style={{ fontSize: '2.5rem', color: '#f1c40f', margin: '10px 0' }}>{hoja}</h1>
                <h3 style={{ fontSize: '1.2rem', color: '#aaa', margin: 0 }}>de <span style={{ color: '#2ecc71' }}>{profesor}</span></h3>

                {instrucciones && (
                    <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', maxWidth: '80%', margin: '20px auto' }}>
                        <p style={{ fontSize: '1.1rem', color: '#eee', fontStyle: 'italic' }}>"{instrucciones}"</p>
                    </div>
                )}
            </div>
            <div style={{ fontSize: '8rem', fontWeight: 'bold', color: count === 0 ? '#2ecc71' : 'white', animation: 'popIn 0.5s' }}>{texto}</div>
            <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
}

function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo]   = useState('');
    const [nombre, setNombre]   = useState('');
    const [curso,  setCurso]    = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'APAREJADOS', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
                hoja: datos.hoja, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.puntos, fallos: 0, hoja: datos.hoja }],
            });
            setEnviado(true);
        } catch(e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>{datos.puntos} puntos</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso',  'Curso',             curso,  setCurso,  'Ej: 3º ESO A',       false],
                          ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key==='codigo'?10:undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }}/>
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PantallaFin({ puntos, puntosDuelo, modoDuelo, esInvitado, guardarRanking, guardando, alTerminar, playSound, recurso, hoja, modoOlimpico }) {
    const [nombreInvitado, setNombreInvitado] = useState('');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    useEffect(() => {
        playSound('WIN');
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;
        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            if (confetti) {
                confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }
        }, 250);
        return () => clearInterval(interval);
    }, []);

    const ganadorDuelo = puntosDuelo[0] > puntosDuelo[1] ? 0 : (puntosDuelo[1] > puntosDuelo[0] ? 1 : -1);

    return (
        <div className="card-menu">
            <h1>¡Fin de Partida!</h1>
            {modoDuelo ? (
                <>
                    <h2 style={{ color: '#3498db' }}>AZUL: {puntosDuelo[0]}</h2>
                    <h2 style={{ color: '#e67e22' }}>NARANJA: {puntosDuelo[1]}</h2>
                    <h3 style={{ marginTop: '20px', color: '#f1c40f', fontSize: '1.5rem' }}>
                        {ganadorDuelo === -1 ? "¡EMPATE!" : `¡GANA JUGADOR ${ganadorDuelo === 0 ? 'AZUL' : 'NARANJA'}!`}
                    </h3>
                    <button className="btn-back" onClick={alTerminar} style={{ marginTop: '20px' }}>Salir</button>
                </>
            ) : (
                    <>
                        <h2>Puntos: {puntos}</h2>

                        {/* SI ES INVITADO MOSTRAR MARKETING, SI NO BOTÓN DE GUARDAR */}
                        {esInvitado ? (
                            <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '15px' }}>
                                <p style={{ color: '#eee', lineHeight: '1.5' }}>
                                    Regístrate para <b>guardar tus resultados</b> y descubrir muchos más juegos.
                            </p>
                                <p style={{ color: 'white', fontWeight: 'bold' }}>¡Únete a PiKT!</p>
                            </div>
                        ) : (
                                <button className="btn-success" onClick={() => guardarRanking(nombreInvitado)} disabled={guardando}>
                                    {guardando ? 'Guardando...' : '💾 Guardar Récord'}
                                </button>
                            )}

                        <button className="btn-back" onClick={alTerminar}>Salir sin guardar</button>
                    </>
                )}
            {!modoDuelo && !modoOlimpico && (
                <button className="btn-success" onClick={() => setMostrarEnvio(true)}
                    style={{ background: 'linear-gradient(135deg,#27ae60,#2ecc71)', marginTop: 6 }}>
                    📤 Enviar al profesor
                </button>
            )}
            <EstilosComunes />
            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ recursoId: recurso?.id, recursoTitulo: recurso?.titulo, hoja, puntos }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    )
}

const EstilosComunes = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@400;700&display=swap');
    .card-menu { background: rgba(0,0,0,0.75); padding: 30px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); margin: 50px auto; color: white; font-family: 'Roboto', sans-serif; position: relative; z-index: 100; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1, h2 { font-family: 'Fredoka One'; margin: 0 0 20px 0; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
    .btn-success { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: #333; background: #2ecc71; margin-bottom: 10px; font-size:1.1rem; }
    .btn-duel { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: white; background: linear-gradient(90deg, #3498db 50%, #e67e22 50%); margin-bottom: 10px; font-size:1.1rem; text-shadow: 1px 1px 2px black; }
    .btn-ranking { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; background: #8e44ad; color: white; font-size: 1rem; margin-bottom: 10px; }
    .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; }
    .ranking-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; color:white; }
    .rank-pos { width: 30px; font-weight: bold; }
    .rank-name { flex: 1; text-align: left; }
    .rank-score { font-weight: bold; color: #f1c40f; }
    .personal-best { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid #f1c40f; color: #f1c40f; font-weight: bold; }
  `}</style>
);