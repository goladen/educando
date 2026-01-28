import { useState, useEffect } from 'react';
import { db } from './firebase';
import { addDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

// ESTILOS CSS
const STYLES = `
  :root { --azul: #273c75; --naranja: #e67e22; --verde: #2ecc71; --rojo: #e74c3c; --amarillo: #f1c40f; --violeta: #9b59b6; }
  .game-wrapper { font-family: 'Segoe UI', sans-serif; background: radial-gradient(circle, #2f3640, #1e272e); height: 100vh; width: 100vw; display: flex; justify-content: center; align-items: center; color: white; overflow: hidden; position: relative; }
  
  /* MENÚS */
  .card-menu { background: rgba(0,0,0,0.85); padding: 30px; border-radius: 20px; width: 90%; max-width: 450px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 100; position: relative; }
  .btn-primary { width: 100%; padding: 12px; margin-bottom: 10px; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; background: var(--azul); color: white; transition: 0.2s; font-size: 1rem; }
  .btn-duel { width: 100%; padding: 12px; margin-bottom: 10px; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; background: linear-gradient(90deg, var(--azul) 50%, var(--naranja) 50%); color: white; text-shadow: 1px 1px 2px black; font-size: 1rem; }
  .btn-ranking { width: 100%; padding: 12px; margin-bottom: 10px; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; background: #8e44ad; color: white; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; margin-top: 10px; }

  /* GAME */
  #game-container { position: relative; width: 650px; height: 650px; display: flex; justify-content: center; align-items: center; }
  #rosco { position: relative; width: 550px; height: 550px; list-style: none; padding: 0; margin: 0; }
  .letra-circulo { position: absolute; width: 42px; height: 42px; background: var(--azul); border: 2px solid white; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1.1rem; transition: transform 0.3s, background 0.3s; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
  .acierto { background: var(--verde) !important; }
  .fallo { background: var(--rojo) !important; }
  .actual { transform: scale(1.5); z-index: 10; box-shadow: 0 0 25px var(--amarillo); background: var(--amarillo) !important; color: black !important; border-color: white !important; }
  #panel-central { position: absolute; width: 360px; height: 360px; text-align: center; background: rgba(255, 255, 255, 0.05); border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
  #timer { font-size: 2.5rem; color: var(--amarillo); margin: 5px 0; font-family: monospace; font-weight: bold; }
  #letra-grande { font-size: 3.5rem; margin: 0; color: white; font-weight: 800; line-height: 1; }
  #pregunta-box { height: 80px; overflow-y: auto; margin: 10px 0; width: 90%; font-size: 1rem; line-height: 1.4; color: #eee; font-weight: 500; }
  #respuesta-usuario { width: 70%; padding: 12px; margin: 10px 0; border-radius: 25px; border: none; font-size: 1.1rem; text-align: center; background: white; color: #333; outline: none; font-weight: bold; }
  .controles { display: flex; gap: 10px; margin-top: 5px; }
  .btn-ok { background: var(--verde); padding: 10px 25px; border-radius: 20px; color: white; border: none; font-weight: bold; cursor: pointer; }
  .btn-pasa { background: var(--amarillo); padding: 10px 25px; border-radius: 20px; color: black; border: none; font-weight: bold; cursor: pointer; }

  /* RANKING */
  .ranking-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; }
  .rank-pos { width: 30px; font-weight: bold; }
  .rank-name { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rank-score { font-weight: bold; color: var(--amarillo); }
  .personal-best { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid var(--amarillo); color: var(--amarillo); font-weight: bold; }
  
  @media (max-width: 700px) { #game-container { transform: scale(0.6); } }
`;

export default function PasapalabraGame({ recurso, usuario, alTerminar }) {
    const [fase, setFase] = useState('SETUP');
    const [modoDuelo, setModoDuelo] = useState(false);
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [jugadores, setJugadores] = useState([]);
    const [turno, setTurno] = useState(0);
    const [verRanking, setVerRanking] = useState(false); // Estado para mostrar modal ranking

    const iniciar = (duelo, hoja) => {
        setModoDuelo(duelo);
        setHojaSeleccionada(hoja);

        // 1. FILTRADO DE PREGUNTAS POR HOJA
        let pool = [];
        if (hoja === 'General') {
            // En Pasapalabra General, idealmente cogemos 1 pregunta por cada letra mezclando hojas
            // Para simplificar, cogemos la primera hoja completa o mezclamos (aquí usaremos la hoja 0 como base y rellenamos si hay huecos, o un merge inteligente)
            // Estrategia simple: Usar todas las preguntas de todas las hojas y filtrar por letra única (la primera que encuentre)
            const todas = [];
            recurso.hojas.forEach(h => todas.push(...h.preguntas));
            // Unificar por letra (A, B, C...)
            const unicas = {};
            todas.forEach(p => { if (!unicas[p.letra]) unicas[p.letra] = p; });
            pool = Object.values(unicas).sort((a, b) => a.letra.localeCompare(b.letra));
        } else {
            const hObj = recurso.hojas.find(h => h.nombreHoja === hoja);
            if (hObj) pool = [...hObj.preguntas];
        }

        // Inicializar estado de preguntas
        const roscoInicial = pool.map(p => ({ ...p, estado: null }));
        const tiempo = parseInt(recurso.config?.tiempoTotal) || 150;

        if (duelo) {
            setJugadores([
                { nombre: 'AZUL', color: '#273c75', rosco: JSON.parse(JSON.stringify(roscoInicial)), aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false },
                { nombre: 'NARANJA', color: '#e67e22', rosco: JSON.parse(JSON.stringify(roscoInicial)), aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false }
            ]);
        } else {
            setJugadores([
                { nombre: usuario.displayName, color: '#273c75', rosco: roscoInicial, aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false }
            ]);
        }
        setFase('JUEGO');
    };

    return (
        <div className="game-wrapper">
            <style>{STYLES}</style>

            {/* SETUP */}
            {fase === 'SETUP' && !verRanking && (
                <PantallaSetup
                    recurso={recurso}
                    onStart={iniciar}
                    onRanking={() => setVerRanking(true)}
                    onExit={alTerminar}
                />
            )}

            {/* RANKING */}
            {verRanking && (
                <PantallaRanking
                    recurso={recurso}
                    usuario={usuario}
                    onBack={() => setVerRanking(false)}
                />
            )}

            {/* JUEGO */}
            {fase === 'JUEGO' && (
                <Tablero
                    jugadores={jugadores}
                    setJugadores={setJugadores}
                    turno={turno}
                    setTurno={setTurno}
                    modoDuelo={modoDuelo}
                    onFinish={() => setFase('FIN')}
                />
            )}

            {/* FIN */}
            {fase === 'FIN' && (
                <PantallaFin
                    jugadores={jugadores}
                    recurso={recurso}
                    hoja={hojaSeleccionada}
                    usuario={usuario}
                    onExit={alTerminar}
                />
            )}
        </div>
    );
}

// --- PANTALLA SETUP ---
const PantallaSetup = ({ recurso, onStart, onRanking, onExit }) => {
    const [hoja, setHoja] = useState('General');
    const hojasDisponibles = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    return (
        <div className="card-menu">
            <h1 style={{ color: '#f1c40f', fontFamily: 'sans-serif', margin: 0 }}>Pasapalabra</h1>
            <h2 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '20px', fontWeight: 'normal' }}>{recurso.titulo}</h2>

            {/* DESPLEGABLE HOJAS */}
            {hojasDisponibles.length > 0 && (
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Selecciona Modalidad:</label>
                    <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none' }}>
                        <option value="General">General (Mezcla)</option>
                        {hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            )}

            <button className="btn-primary" onClick={() => onStart(false, hoja)}>👤 1 JUGADOR</button>
            <button className="btn-duel" onClick={() => onStart(true, hoja)}>👥 DUELO</button>
            <button className="btn-ranking" onClick={onRanking}>🏆 VER RANKING</button>
            <button className="btn-back" onClick={onExit}>⬅ Volver</button>
        </div>
    );
};

// --- PANTALLA RANKING (Reutilizable) ---
const PantallaRanking = ({ recurso, usuario, onBack }) => {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const [cargando, setCargando] = useState(false);

    const hojasDisponibles = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    useEffect(() => {
        cargarDatos();
    }, [hoja]);

    const cargarDatos = async () => {
        setCargando(true);
        setTop10([]);
        setMiMejor(null);
        try {
            const ref = collection(db, 'ranking');
            // Query Top 10
            const qTop = query(
                ref,
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hoja),
                where('juego', '==', 'Pasapalabra'),
                orderBy('aciertos', 'desc'),
                limit(10)
            );
            const snapTop = await getDocs(qTop);
            setTop10(snapTop.docs.map(d => d.data()));

            // Query Personal Best
            const qMejor = query(
                ref,
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hoja),
                where('juego', '==', 'Pasapalabra'),
                where('jugador', '==', usuario.displayName),
                orderBy('aciertos', 'desc'),
                limit(1)
            );
            const snapMejor = await getDocs(qMejor);
            if (!snapMejor.empty) setMiMejor(snapMejor.docs[0].data().aciertos);

        } catch (error) {
            console.error("Error ranking (Falta índice en Firebase):", error);
        }
        setCargando(false);
    };

    const getMedalla = (i) => {
        if (i === 0) return '🥇';
        if (i === 1) return '🥈';
        if (i === 2) return '🥉';
        return i + 1;
    };

    return (
        <div className="card-menu" style={{ maxWidth: '500px' }}>
            <h2 style={{ color: '#f1c40f' }}>🏆 Ranking Top 10</h2>

            {/* Selector dentro del ranking */}
            <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '5px' }}>
                <option value="General">General</option>
                {hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}
            </select>

            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '250px', overflowY: 'auto', marginBottom: '15px' }}>
                {cargando ? <p>Cargando...</p> : top10.length === 0 ? <p>No hay puntuaciones aún.</p> : (
                    top10.map((fila, i) => (
                        <div key={i} className="ranking-row">
                            <span className="rank-pos">{getMedalla(i)}</span>
                            <span className="rank-name">{fila.jugador}</span>
                            <span className="rank-score">{fila.aciertos} pts</span>
                        </div>
                    ))
                )}
            </div>

            {miMejor !== null && (
                <div className="personal-best">
                    Tu Mejor Puntuación: {miMejor} pts
                </div>
            )}

            <button className="btn-back" onClick={onBack}>Cerrar Ranking</button>
        </div>
    );
};

// --- LOGICA DE JUEGO (Tablero) ---
const Tablero = ({ jugadores, setJugadores, turno, setTurno, modoDuelo, onFinish }) => {
    const [input, setInput] = useState('');
    const jugador = jugadores[turno];
    const preguntaActual = jugador.rosco[jugador.indice];

    useEffect(() => {
        if (jugador.terminado) return;
        const interval = setInterval(() => {
            setJugadores(prev => {
                const copy = [...prev];
                if (copy[turno].tiempo > 0) copy[turno].tiempo--;
                else {
                    copy[turno].terminado = true;
                    if (modoDuelo) {
                        const otro = turno === 0 ? 1 : 0;
                        if (!copy[otro].terminado) setTurno(otro); else onFinish();
                    } else onFinish();
                }
                return copy;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [turno, jugador.terminado]);

    const procesar = (esPasapalabra) => {
        const copyJugadores = [...jugadores];
        const copyRosco = [...jugador.rosco];
        const item = copyRosco[jugador.indice];

        if (!esPasapalabra) {
            const clean = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (clean(input) === clean(item.respuesta)) { item.estado = 'acierto'; copyJugadores[turno].aciertos++; }
            else { item.estado = 'fallo'; copyJugadores[turno].fallos++; }
        }

        let next = jugador.indice + 1;
        let vueltas = 0;
        while (vueltas < 2) {
            if (next >= copyRosco.length) { next = 0; vueltas++; }
            if (copyRosco[next].estado === null) break;
            next++;
        }

        if (vueltas >= 2 || copyRosco.every(p => p.estado !== null)) copyJugadores[turno].terminado = true;
        else copyJugadores[turno].indice = next;

        copyJugadores[turno].rosco = copyRosco;
        setJugadores(copyJugadores);
        setInput('');

        if (modoDuelo) {
            const otro = turno === 0 ? 1 : 0;
            if (!copyJugadores[otro].terminado) setTurno(otro); else if (copyJugadores[turno].terminado) onFinish();
        } else if (copyJugadores[turno].terminado) onFinish();
    };

    return (
        <div id="game-container" className={turno === 1 ? 'turno-p2' : ''}>
            <ul id="rosco">
                {jugador.rosco.map((p, i) => {
                    const angulo = (i * (2 * Math.PI / jugador.rosco.length)) - (Math.PI / 2);
                    const left = (275 + 270 * Math.cos(angulo) - 21) + "px";
                    const top = (275 + 270 * Math.sin(angulo) - 21) + "px";
                    let c = 'letra-circulo';
                    if (p.estado === 'acierto') c += ' acierto';
                    if (p.estado === 'fallo') c += ' fallo';
                    if (i === jugador.indice && !jugador.terminado) c += ' actual';
                    return <li key={i} className={c} style={{ left, top }}>{p.letra}</li>;
                })}
            </ul>
            <div id="panel-central">
                {modoDuelo && <div id="marcador-dual"><div className={`ficha ${turno === 0 ? 'activa' : ''}`} style={{ background: '#273c75' }}>AZUL: {jugadores[0].aciertos}</div><div className={`ficha ${turno === 1 ? 'activa' : ''}`} style={{ background: '#e67e22' }}>NARANJA: {jugadores[1].aciertos}</div></div>}
                <div id="timer">{jugador.tiempo}</div>
                <h2 id="letra-grande">{preguntaActual.letra}</h2>
                <div id="pregunta-box">{preguntaActual.pregunta}</div>
                <input id="respuesta-usuario" autoComplete="off" placeholder="Respuesta..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && procesar(false)} autoFocus />
                <div className="controles"><button className="btn-ok" onClick={() => procesar(false)}>ENVIAR</button><button className="btn-pasa" onClick={() => procesar(true)}>PASAPALABRA</button></div>
            </div>
        </div>
    );
};

const PantallaFin = ({ jugadores, recurso, hoja, usuario, onExit }) => {
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        setGuardando(true);
        try {
            const score = jugadores[0].aciertos; // En duelo, guarda P1 por ahora
            const rankingRef = collection(db, 'ranking');

            // 1. BUSCAR SI YA EXISTE UN RECORD
            const q = query(
                rankingRef,
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hoja), // Importante: Hoja específica
                where('jugador', '==', usuario.displayName),
                where('juego', '==', 'Pasapalabra')
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // YA EXISTE -> COMPARAR
                const docExistente = querySnapshot.docs[0];
                const oldScore = docExistente.data().aciertos;

                if (score > oldScore) {
                    // Nuevo record! Actualizamos
                    await updateDoc(doc(db, 'ranking', docExistente.id), {
                        aciertos: score,
                        fecha: new Date()
                    });
                    alert("🚀 ¡Nuevo Récord Personal! Guardado.");
                } else {
                    // No superado
                    alert(`⚠️ No has superado tu mejor registro en ${hoja} de ${recurso.titulo}. (Tu récord: ${oldScore})`);
                }
            } else {
                // NO EXISTE -> CREAR NUEVO
                await addDoc(rankingRef, {
                    recursoId: recurso.id,
                    tituloJuego: recurso.titulo,
                    juego: 'Pasapalabra',
                    categoria: hoja,
                    jugador: usuario.displayName,
                    aciertos: score,
                    fecha: new Date()
                });
                alert("✅ Puntuación Guardada.");
            }
            onExit(); // Volver al inicio
        } catch (e) {
            console.error(e);
            alert("Error al guardar. Intenta de nuevo.");
            setGuardando(false);
        }
    };

    return (
        <div className="card-menu">
            <h1>¡Finalizado!</h1>
            {jugadores.map((j, i) => <h2 key={i} style={{ color: j.color }}>{j.nombre}: {j.aciertos} aciertos</h2>)}
            <button className="btn-primary" onClick={guardar} disabled={guardando} style={{ marginTop: '20px' }}>
                {guardando ? 'Procesando...' : '💾 GUARDAR RESULTADO'}
            </button>
            <button className="btn-back" onClick={onExit}>Salir sin guardar</button>
        </div>
    );
};




/*
const PantallaFin = ({ jugadores, recurso, hoja, usuario, onExit }) => {
    const [guardado, setGuardado] = useState(false);
    const guardar = async () => {
        try {
            await addDoc(collection(db, 'ranking'), {
                recursoId: recurso.id,
                juego: 'Pasapalabra',
                categoria: hoja,
                jugador: usuario.displayName,
                aciertos: jugadores[0].aciertos,
                fecha: new Date()
            });
            alert("¡Guardado!"); setGuardado(true);
        } catch (e) { alert("Error guardando"); }
    };
    return (
        <div className="card-menu">
            <h1>¡Finalizado!</h1>
            {jugadores.map((j, i) => <h2 key={i} style={{ color: j.color }}>{j.nombre}: {j.aciertos} aciertos</h2>)}
            {!guardado ? <button className="btn-primary" onClick={guardar} style={{ marginTop: '20px' }}>💾 GUARDAR RESULTADO</button> : <p style={{ color: 'lime' }}>Resultado Guardado</p>}
            <button className="btn-back" onClick={onExit}>Salir</button>
        </div>
    );
};*/