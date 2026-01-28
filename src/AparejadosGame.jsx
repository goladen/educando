import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';
import Confetti from 'react-confetti';

export default function AparejadosGame({ recurso, usuario, alTerminar }) {
    const [fase, setFase] = useState('SETUP');
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [modoDuelo, setModoDuelo] = useState(false);

    // Estados del Juego
    const [cartas, setCartas] = useState([]);
    const [flipped, setFlipped] = useState([]);
    const [matched, setMatched] = useState([]); // Array de uniqueIds que ya han sido emparejados

    // Puntuación
    const [puntos, setPuntos] = useState(0); // Para modo Solitario
    const [puntosDuelo, setPuntosDuelo] = useState([0, 0]); // [Jugador1, Jugador2]
    const [turno, setTurno] = useState(0); // 0 = Azul, 1 = Naranja

    const [tiempo, setTiempo] = useState(60);
    const [verRanking, setVerRanking] = useState(false);
    const [guardando, setGuardando] = useState(false);

    // --- INICIAR PARTIDA ---
    const iniciar = (esDuelo, hoja) => {
        setModoDuelo(esDuelo);
        setHojaSeleccionada(hoja);

        // Preparar cartas
        let pool = [];
        if (hoja === 'General') {
            recurso.hojas.forEach(h => { h.preguntas.forEach((p, i) => pool.push({ ...p, idOriginal: i })); });
        } else {
            const hObj = recurso.hojas.find(h => h.nombreHoja === hoja);
            if (hObj) hObj.preguntas.forEach((p, i) => pool.push({ ...p, idOriginal: i }));
        }

        pool.sort(() => Math.random() - 0.5);
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
        setTiempo(parseInt(recurso.config?.tiempoTotal) || 60);
        setFase('JUEGO');
    };

    // --- CRONÓMETRO (Solo Solitario) ---
    useEffect(() => {
        if (fase !== 'JUEGO' || modoDuelo) return; // En duelo no hay tiempo límite por ahora
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

    // --- LÓGICA AL CLICKAR CARTA ---
    const handleClick = (carta) => {
        // Bloqueos: Si ya hay 2 levantadas, o si la carta ya está emparejada o levantada
        if (flipped.length >= 2 || flipped.includes(carta.uniqueId) || matched.includes(carta.uniqueId)) return;

        const newFlipped = [...flipped, carta.uniqueId];
        setFlipped(newFlipped);

        if (newFlipped.length === 2) {
            // Verificar Pareja
            const carta1 = cartas.find(c => c.uniqueId === newFlipped[0]);
            const carta2 = cartas.find(c => c.uniqueId === newFlipped[1]);

            if (carta1.pairId === carta2.pairId) {
                // ¡ACIERTO!
                const newMatched = [...matched, carta1.uniqueId, carta2.uniqueId];
                setMatched(newMatched);
                setFlipped([]); // Limpiamos flipped inmediatamente para que pueda seguir jugando

                // Puntuación
                const ptsPareja = parseInt(recurso.config?.puntosPareja) || 10;
                if (modoDuelo) {
                    setPuntosDuelo(prev => {
                        const copy = [...prev];
                        copy[turno] += ptsPareja;
                        return copy;
                    });
                    // En duelo, si acierta REPITE TURNO (no cambiamos setTurno)
                } else {
                    setPuntos(p => p + ptsPareja);
                }

                // Fin del juego?
                if (newMatched.length === cartas.length) {
                    setTimeout(() => setFase('FIN'), 500);
                }

            } else {
                // FALLO
                setTimeout(() => {
                    setFlipped([]);
                    // En duelo, si falla CAMBIA TURNO
                    if (modoDuelo) {
                        setTurno(prev => prev === 0 ? 1 : 0);
                    }
                }, 1000);
            }
        }
    };

    // --- GUARDADO (Solo Solitario) ---
    const guardarRanking = async () => {
        if (guardando) return;
        setGuardando(true);
        try {
            const rankingRef = collection(db, 'ranking');
            const q = query(
                rankingRef,
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hojaSeleccionada),
                where('email', '==', usuario.email),
                where('tipoJuego', '==', 'APAREJADOS')
            );
            const snap = await getDocs(q);

            const medallaCalc = puntos >= 50 ? '🥇' : (puntos >= 30 ? '🥈' : (puntos > 0 ? '🥉' : ''));

            if (!snap.empty) {
                const old = snap.docs[0].data().aciertos;
                if (puntos > old) {
                    await updateDoc(doc(db, 'ranking', snap.docs[0].id), {
                        aciertos: puntos,
                        fecha: new Date(),
                        medalla: medallaCalc,
                        recursoTitulo: recurso.titulo
                    });
                    alert("🚀 ¡Nuevo Récord Personal!");
                } else {
                    alert(`⚠️ No has superado tu récord (${old}).`);
                }
            } else {
                await addDoc(rankingRef, {
                    recursoId: recurso.id,
                    recursoTitulo: recurso.titulo,
                    tipoJuego: 'APAREJADOS',
                    juego: 'Aparejados',
                    categoria: hojaSeleccionada,
                    email: usuario.email,
                    jugador: usuario.displayName || "Anónimo",
                    aciertos: puntos,
                    fecha: new Date(),
                    medalla: medallaCalc
                });
                alert("✅ Guardado");
            }
            alTerminar();
        } catch (e) { console.error(e); alert("Error guardando"); }
        setGuardando(false);
    };

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

    if (fase === 'FIN') {
        const ganadorDuelo = puntosDuelo[0] > puntosDuelo[1] ? 0 : (puntosDuelo[1] > puntosDuelo[0] ? 1 : -1); // -1 empate
        return (
            <div className="card-menu">
                <Confetti numberOfPieces={300} recycle={false} />
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
                            <button className="btn-success" onClick={guardarRanking} disabled={guardando}>
                                {guardando ? 'Guardando...' : '💾 Guardar Récord'}
                            </button>
                            <button className="btn-back" onClick={alTerminar}>Salir sin guardar</button>
                        </>
                    )}
                <EstilosComunes />
            </div>
        )
    }

    return (
        <div id="game-ui">
            {/* HEADER */}
            <header>
                <button className="btn-back-small" onClick={alTerminar}>SALIR</button>

                {modoDuelo ? (
                    <div className="duelo-header">
                        <div className={`marcador ${turno === 0 ? 'activo azul' : ''}`}>AZUL: {puntosDuelo[0]}</div>
                        <div className="vs">VS</div>
                        <div className={`marcador ${turno === 1 ? 'activo naranja' : ''}`}>NARANJA: {puntosDuelo[1]}</div>
                    </div>
                ) : (
                        <>
                            <div className="stat-box">⏱ {tiempo}</div>
                            <div className="stat-box">⭐ {puntos}</div>
                        </>
                    )}
            </header>

            {/* TABLERO */}
            <div className="table-container">
                <div className="game-board" style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(cartas.length))}, 1fr)` }}>
                    {cartas.map(carta => {
                        const isMatched = matched.includes(carta.uniqueId);
                        const isFlipped = flipped.includes(carta.uniqueId);

                        return (
                            <div
                                key={carta.uniqueId}
                                className={`card ${isFlipped || isMatched ? 'flipped' : ''}`}
                                onClick={() => handleClick(carta)}
                                style={{ visibility: isMatched ? 'hidden' : 'visible', opacity: isMatched ? 0 : 1, transition: 'opacity 0.5s' }}
                            >
                                <div className="face front">{carta.content}</div>
                                <div className="face back">?</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <EstilosComunes />
            {/* ESTILOS ESPECÍFICOS DEL TABLERO */}
            <style>{`
                #game-ui { display: flex; flex-direction: column; height: 100vh; width: 100%; position:fixed; top:0; left:0; background: #2c3e50; }
                header { height: 60px; background: rgba(0,0,0,0.4); display: flex; justify-content: space-between; align-items: center; padding: 0 20px; color: white; }
                .stat-box { font-family: 'Fredoka One'; font-size: 1.5rem; color: #f1c40f; margin: 0 10px; }
                .btn-back-small { background: rgba(0,0,0,0.5); border: 1px solid #777; color: white; padding: 5px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; }
                
                /* DUELO STYLES */
                .duelo-header { display: flex; align-items: center; gap: 15px; font-weight: bold; }
                .marcador { padding: 5px 15px; border-radius: 15px; background: #555; opacity: 0.6; transition: 0.3s; }
                .marcador.azul { background: #3498db; }
                .marcador.naranja { background: #e67e22; }
                .marcador.activo { opacity: 1; transform: scale(1.1); box-shadow: 0 0 15px rgba(255,255,255,0.5); border: 2px solid white; }
                .vs { font-style: italic; color: #888; }

                /* TAPETE */
                .table-container { flex: 1; background-color: #27ae60; border: 8px solid #196f3d; border-radius: 15px; margin: 20px; box-shadow: inset 0 0 80px rgba(0,0,0,0.6); padding: 20px; display: flex; justify-content: center; align-items: center; overflow: hidden; }
                .game-board { display: grid; gap: 15px; width: 100%; height: 100%; justify-items: center; align-items: center; max-width: 1000px; max-height: 800px; }
                
                /* CARTAS */
                .card { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.4s; cursor: pointer; aspect-ratio: 3/4; max-width: 150px; }
                .card.flipped { transform: rotateY(180deg); }
                .face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: bold; font-size: clamp(12px, 2.5vmin, 20px); padding: 5px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
                
                .face.back { background: repeating-linear-gradient(45deg, #c0392b, #c0392b 10px, #e74c3c 10px, #e74c3c 20px); border: 3px solid white; color: white; font-size: 2.5rem; text-shadow: 2px 2px 0 rgba(0,0,0,0.3); }
                .face.front { background: #ecf0f1; color: #2c3e50; transform: rotateY(180deg); border: 2px solid #bdc3c7; }
            `}</style>
        </div>
    );
}

// --- PANTALLAS AUXILIARES ---

const PantallaSetup = ({ recurso, onStart, onRanking, onExit }) => {
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

const PantallaRanking = ({ recurso, usuario, onBack }) => {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const hojas = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    useEffect(() => {
        const fetchRanking = async () => {
            try {
                const ref = collection(db, 'ranking');

                // 🛠️ CORRECCIÓN AQUÍ: Usamos 'juego' == 'Aparejados' para que salgan los viejos y los nuevos
                const qTop = query(
                    ref,
                    where('recursoId', '==', recurso.id),
                    where('juego', '==', 'Aparejados'), // <--- CAMBIO CLAVE
                    where('categoria', '==', hoja),
                    orderBy('aciertos', 'desc'),
                    limit(10)
                );
                const snapTop = await getDocs(qTop);
                setTop10(snapTop.docs.map(d => d.data()));

                // 🛠️ CORRECCIÓN TAMBIÉN AQUÍ
                const qMejor = query(
                    ref,
                    where('recursoId', '==', recurso.id),
                    where('juego', '==', 'Aparejados'), // <--- CAMBIO CLAVE
                    where('categoria', '==', hoja),
                    where('email', '==', usuario.email),
                    orderBy('aciertos', 'desc'),
                    limit(1)
                );
                const snapMejor = await getDocs(qMejor);
                if (!snapMejor.empty) setMiMejor(snapMejor.docs[0].data().aciertos);
            } catch (e) {
                console.log("Error cargando ranking:", e);
            }
        };
        fetchRanking();
    }, [hoja]);

    const getMedalla = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1);

    return (
        <div className="card-menu">
            <h2 style={{ color: '#f1c40f' }}>🏆 Ranking</h2>
            <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '5px' }}>
                <option value="General">General</option>
                {hojas.map(h => <option key={h} value={h}>{h}</option>)}
            </select>

            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '200px', overflowY: 'auto', marginBottom: '15px' }}>
                {top10.length === 0 ? <p>No hay datos aún.</p> : (
                    top10.map((f, i) => (
                        <div key={i} className="ranking-row">
                            <span className="rank-pos">{getMedalla(i)}</span>
                            <span className="rank-name">{f.jugador}</span>
                            <span className="rank-score">{f.aciertos}</span>
                        </div>
                    ))
                )}
            </div>

            {miMejor !== null && <div className="personal-best">Tu Récord: {miMejor}</div>}
            <button className="btn-back" onClick={onBack}>Cerrar</button>
            <EstilosComunes />
        </div>
    );
};

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