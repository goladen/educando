import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, updateDoc, addDoc, collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import confetti from 'canvas-confetti';

// --- IMPORTACIÓN DE AUDIOS ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';

// URL externa para el reloj (Tic-Tac)
const TICK_SOUND_URL = 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_73686360b7.mp3?filename=clock-ticking-2-106637.mp3';

// --- ESTILOS CSS ---
const STYLES = `
  :root { --azul: #273c75; --naranja: #e67e22; --verde: #2ecc71; --rojo: #e74c3c; --amarillo: #f1c40f; --violeta: #9b59b6; }
  .game-wrapper { font-family: 'Segoe UI', sans-serif; background: radial-gradient(circle, #2f3640, #1e272e); height: 100vh; width: 100vw; display: flex; justify-content: center; align-items: center; color: white; overflow: hidden; position: relative; }
  
  /* MENÚS */
  .card-menu { background: rgba(0,0,0,0.85); padding: 40px; border-radius: 20px; width: 90%; max-width: 500px; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); z-index: 100; position: relative; animation: fadeIn 0.5s ease; }
  .btn-primary { width: 100%; padding: 15px; margin-bottom: 12px; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; background: var(--azul); color: white; transition: 0.3s; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(39, 60, 117, 0.4); }
  .btn-primary:hover { transform: scale(1.02); }
  
  .btn-duel { width: 100%; padding: 15px; margin-bottom: 12px; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; background: linear-gradient(90deg, var(--azul) 50%, var(--naranja) 50%); color: white; text-shadow: 1px 1px 2px black; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.3s; }
  .btn-duel:hover { transform: scale(1.02); }

  .btn-ranking { width: 100%; padding: 15px; margin-bottom: 12px; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; background: #8e44ad; color: white; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; }
  .btn-back { background: transparent; border: 2px solid #555; color: #ccc; width: 100%; padding: 10px; border-radius: 30px; cursor: pointer; margin-top: 10px; font-weight: bold; transition: 0.3s; }
  .btn-back:hover { border-color: #fff; color: #fff; }

  /* GAME */
  #game-container { position: relative; width: 650px; height: 650px; display: flex; justify-content: center; align-items: center; transition: background 0.3s; border-radius: 50%; }
  .turno-p2 #panel-central { border-color: var(--naranja); box-shadow: 0 0 30px rgba(230, 126, 34, 0.1); }
  
  #rosco { position: relative; width: 550px; height: 550px; list-style: none; padding: 0; margin: 0; }
  .letra-circulo { position: absolute; width: 45px; height: 45px; background: var(--azul); border: 3px solid #1e272e; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1.2rem; transition: all 0.3s; color: white; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 1; }
  .p2-active .letra-circulo { background: var(--naranja); }
  
  .acierto { background: var(--verde) !important; transform: scale(1.1); box-shadow: 0 0 15px var(--verde); border-color: white !important; }
  .fallo { background: var(--rojo) !important; opacity: 0.7; }
  .actual { transform: scale(1.6); z-index: 10; box-shadow: 0 0 30px var(--amarillo); background: var(--amarillo) !important; color: black !important; border-color: white !important; }
  
  #panel-central { position: absolute; width: 380px; height: 380px; text-align: center; background: rgba(30, 39, 46, 0.85); border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; backdrop-filter: blur(10px); border: 2px solid rgba(255,255,255,0.1); box-shadow: inset 0 0 50px rgba(0,0,0,0.5); }
  
  #marcador-dual { display: flex; gap: 20px; margin-bottom: 10px; width: 100%; justify-content: center; }
  .ficha { padding: 5px 20px; border-radius: 20px; font-weight: bold; font-size: 1rem; opacity: 0.4; transition: 0.3s; border: 2px solid transparent; transform: scale(0.9); }
  .ficha.activa { opacity: 1; transform: scale(1.1); border-color: white; box-shadow: 0 0 15px rgba(255,255,255,0.2); }

  #timer { font-size: 3rem; color: var(--amarillo); margin: 0; font-family: monospace; font-weight: bold; text-shadow: 0 0 10px rgba(241, 196, 15, 0.5); }
  .timer-warning { color: var(--rojo) !important; animation: blink 0.5s infinite; }
  
  #letra-grande { font-size: 4rem; margin: 0; color: white; font-weight: 800; line-height: 1; text-shadow: 0 4px 0 rgba(0,0,0,0.3); }
  #pregunta-box { height: 90px; overflow-y: auto; margin: 10px 0; width: 95%; font-size: 1.1rem; line-height: 1.4; color: #ecf0f1; font-weight: 500; }
  
  #respuesta-usuario { width: 80%; padding: 15px; margin: 15px 0; border-radius: 30px; border: none; font-size: 1.3rem; text-align: center; background: white; color: #2c3e50; outline: none; font-weight: bold; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
  #respuesta-usuario:focus { box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.5); }
  
  .controles { display: flex; gap: 15px; margin-top: 5px; width: 100%; justify-content: center; }
  .btn-ok { background: var(--verde); padding: 12px 30px; border-radius: 25px; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1rem; }
  .btn-ok:hover { transform: scale(1.05); background: #27ae60; }
  .btn-pasa { background: var(--amarillo); padding: 12px 30px; border-radius: 25px; color: black; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1rem; }
  .btn-pasa:hover { transform: scale(1.05); background: #f39c12; }

  /* RANKING & WINNER */
  .ranking-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1rem; }
  .rank-pos { width: 30px; font-weight: bold; color: var(--amarillo); }
  .rank-name { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rank-score { font-weight: bold; color: var(--verde); }
  .winner-title { font-size: 2.5rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 20px rgba(255,255,255,0.5); }
  
  /* NEON ERROR MODAL - VERSIÓN COMPACTA */
  .modal-overlay { 
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
      background: rgba(0,0,0,0.9); z-index: 9999; 
      display: flex; justify-content: center; align-items: center; 
      backdrop-filter: blur(5px); 
  }
  
  .neon-card { 
      background: #1a1a1a; 
      padding: 25px; 
      border-radius: 15px; 
      border: 3px solid #ff003c; 
      box-shadow: 0 0 20px #ff003c, inset 0 0 10px #ff003c; 
      text-align: center; 
      color: white; 
      width: 90%; 
      max-width: 400px; 
      animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
      display: flex; flex-direction: column; align-items: center; justify-content: center; 
  }

  .neon-title { 
      font-size: 1.8rem; 
      color: #ff003c; 
      text-shadow: 0 0 10px #ff003c; 
      margin-bottom: 10px; 
      font-weight: bold; 
      text-transform: uppercase; 
      letter-spacing: 2px; 
  }

  .neon-answer-label { 
      font-size: 1rem; 
      color: #ccc; 
      margin-bottom: 10px; 
      text-transform: uppercase; 
      letter-spacing: 1px; 
  }
  
  .neon-answer { 
      font-size: 1.5rem; 
      font-weight: bold; 
      color: white; 
      margin-bottom: 20px; 
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.8); 
      line-height: 1.2; 
      background: rgba(255, 0, 60, 0.1); 
      padding: 10px 15px; 
      border-radius: 8px;
      border: 1px solid #ff003c;
      width: 100%;
      word-wrap: break-word;
      box-sizing: border-box; 
  }
  
  .neon-btn { 
      background: transparent; 
      border: 2px solid #ff003c; 
      color: #ff003c; 
      padding: 10px 30px; 
      font-size: 1.1rem; 
      font-weight: bold; 
      text-transform: uppercase; 
      letter-spacing: 1px; 
      cursor: pointer; 
      transition: 0.3s; 
      box-shadow: 0 0 10px #ff003c; 
      border-radius: 50px; 
  }
  
  .neon-btn:hover { 
      background: #ff003c; 
      color: white; 
      box-shadow: 0 0 30px #ff003c; 
      transform: scale(1.05); 
  }

  @keyframes blink { 50% { opacity: 0.5; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @media (max-width: 700px) { #game-container { transform: scale(0.6); } }
`;

export default function GamePlayer({ recurso, usuario, alTerminar }) {
    const [fase, setFase] = useState('SETUP');
    const [modoDuelo, setModoDuelo] = useState(false);
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [jugadores, setJugadores] = useState([]);
    const [turno, setTurno] = useState(0);
    const [verRanking, setVerRanking] = useState(false);

    // --- REPRODUCCIÓN DE SONIDO ---
    const playSound = (type) => {
        let file = null;
        if (type === 'CORRECT') file = correctSoundFile;
        else if (type === 'WRONG') file = wrongSoundFile;
        else if (type === 'WIN') file = winSoundFile;
        else if (type === 'TICK') file = TICK_SOUND_URL;

        if (file) {
            const audio = new Audio(file);
            audio.volume = 0.6;
            audio.play().catch(e => console.warn("Audio play prevented:", e));

            // CORTAR EL SONIDO DE ACIERTO SI ES LARGO
            if (type === 'CORRECT') {
                setTimeout(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }, 1500);
            }
        }
    };

    // --- GENERADOR DE ROSCOS ---
    const generarRoscos = (duelo, hoja) => {
        const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        let poolTotal = [];
        if (hoja === 'General') {
            recurso.hojas.forEach(h => poolTotal.push(...h.preguntas));
        } else {
            const hObj = recurso.hojas.find(h => h.nombreHoja === hoja);
            if (hObj) poolTotal = [...hObj.preguntas];
        }

        const sacos = {};
        poolTotal.forEach(p => {
            const l = p.letra ? p.letra.toUpperCase() : '?';
            if (!sacos[l]) sacos[l] = [];
            if (!p._tempId) p._tempId = Math.random().toString(36);
            sacos[l].push(p);
        });

        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const rosco1 = [];
        const usadosJ1 = {};

        for (let i = 0; i < abecedario.length; i++) {
            const letra = abecedario[i];
            if (sacos[letra] && sacos[letra].length > 0) {
                const p = pickRandom(sacos[letra]);
                rosco1.push({ ...p, estado: null });
                usadosJ1[letra] = p._tempId;
            }
        }

        let rosco2 = [];
        if (duelo) {
            for (let i = 0; i < abecedario.length; i++) {
                const letra = abecedario[i];
                if (sacos[letra] && sacos[letra].length > 0) {
                    const disponibles = sacos[letra].filter(p => p._tempId !== usadosJ1[letra]);
                    if (disponibles.length > 0) rosco2.push({ ...pickRandom(disponibles), estado: null });
                    else rosco2.push({ ...pickRandom(sacos[letra]), estado: null });
                }
            }
        }

        return { rosco1, rosco2 };
    };

    const iniciar = (duelo, hoja) => {
        setModoDuelo(duelo);
        setHojaSeleccionada(hoja);
        const { rosco1, rosco2 } = generarRoscos(duelo, hoja);
        const tiempo = parseInt(recurso.config?.tiempoTotal) || 150;

        if (duelo) {
            setJugadores([
                { nombre: 'AZUL', color: '#273c75', rosco: rosco1, aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false },
                { nombre: 'NARANJA', color: '#e67e22', rosco: rosco2, aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false }
            ]);
        } else {
            setJugadores([
                { nombre: usuario.displayName, color: '#273c75', rosco: rosco1, aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false }
            ]);
        }
        setTurno(0);
        setFase('JUEGO');
    };

    return (
        <div className="game-wrapper">
            <style>{STYLES}</style>

            {fase === 'SETUP' && !verRanking && (
                <PantallaSetup recurso={recurso} onStart={iniciar} onRanking={() => setVerRanking(true)} onExit={alTerminar} />
            )}

            {verRanking && (
                <PantallaRanking recurso={recurso} usuario={usuario} onBack={() => setVerRanking(false)} />
            )}

            {fase === 'JUEGO' && (
                <Tablero
                    jugadores={jugadores}
                    setJugadores={setJugadores}
                    turno={turno}
                    setTurno={setTurno}
                    modoDuelo={modoDuelo}
                    playSound={playSound}
                    onFinish={() => setFase('FIN')}
                />
            )}

            {fase === 'FIN' && (
                <PantallaFin
                    jugadores={jugadores}
                    recurso={recurso}
                    hoja={hojaSeleccionada}
                    usuario={usuario}
                    modoDuelo={modoDuelo}
                    playSound={playSound}
                    onExit={alTerminar}
                />
            )}
        </div>
    );
}

// --- PANTALLAS AUXILIARES ---
const PantallaSetup = ({ recurso, onStart, onRanking, onExit }) => {
    const [hoja, setHoja] = useState('General');
    const hojasDisponibles = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];
    return (
        <div className="card-menu">
            <h1 style={{ color: '#f1c40f', fontFamily: 'sans-serif', margin: 0 }}>Pasapalabra</h1>
            <h2 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '30px', fontWeight: 'normal' }}>{recurso.titulo}</h2>
            {hojasDisponibles.length > 0 && (
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontWeight: 'bold' }}>Selecciona Modalidad:</label>
                    <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '1rem' }}>
                        <option value="General">General (Mezcla)</option>
                        {hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            )}
            <button className="btn-primary" onClick={() => onStart(false, hoja)}>👤 1 JUGADOR</button>
            <button className="btn-duel" onClick={() => onStart(true, hoja)}>⚔️ DUELO (2J)</button>
            <button className="btn-ranking" onClick={onRanking}>🏆 RANKING</button>
            <button className="btn-back" onClick={onExit}>Volver</button>
        </div>
    );
};

const PantallaRanking = ({ recurso, usuario, onBack }) => {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        const cargar = async () => {
            setCargando(true); setTop10([]); setMiMejor(null);
            try {
                const ref = collection(db, 'ranking');
                const qTop = query(ref, where('recursoId', '==', recurso.id), where('categoria', '==', hoja), where('tipoJuego', '==', 'PASAPALABRA'), orderBy('aciertos', 'desc'), limit(10));
                const sTop = await getDocs(qTop);
                setTop10(sTop.docs.map(d => d.data()));

                const qMejor = query(ref, where('recursoId', '==', recurso.id), where('categoria', '==', hoja), where('tipoJuego', '==', 'PASAPALABRA'), where('email', '==', usuario.email), orderBy('aciertos', 'desc'), limit(1));
                const sMejor = await getDocs(qMejor);
                if (!sMejor.empty) setMiMejor(sMejor.docs[0].data().aciertos);
            } catch (e) { console.error(e); }
            setCargando(false);
        };
        cargar();
    }, [hoja]);

    return (
        <div className="card-menu" style={{ maxWidth: '600px' }}>
            <h2 style={{ color: '#f1c40f' }}>🏆 Ranking Top 10</h2>
            <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px' }}>
                <option value="General">General</option>
                {recurso.hojas?.map(h => <option key={h.nombreHoja} value={h.nombreHoja}>{h.nombreHoja}</option>)}
            </select>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '300px', overflowY: 'auto', marginBottom: '20px' }}>
                {cargando ? <p>Cargando...</p> : top10.length === 0 ? <p style={{ padding: '20px' }}>No hay puntuaciones aún.</p> : top10.map((f, i) => (
                    <div key={i} className="ranking-row"><span className="rank-pos">#{i + 1}</span><span className="rank-name">{f.jugador}</span><span className="rank-score">{f.aciertos} pts</span></div>
                ))}
            </div>
            {miMejor !== null && <div className="personal-best">Tu Mejor Puntuación: {miMejor} pts</div>}
            <button className="btn-back" onClick={onBack}>Cerrar</button>
        </div>
    );
};

// --- MOTOR DEL JUEGO (Tablero) ---
const Tablero = ({ jugadores, setJugadores, turno, setTurno, modoDuelo, playSound, onFinish }) => {
    const [input, setInput] = useState('');
    const [pausado, setPausado] = useState(false);
    const [datosError, setDatosError] = useState(null);
    const inputRef = useRef(null); // REFERENCIA AL INPUT PARA EL FOCO AUTOMÁTICO

    const jugador = jugadores[turno];
    const preguntaActual = jugador.rosco[jugador.indice];

    // FOCO AUTOMÁTICO AL CAMBIAR PREGUNTA O CERRAR MODAL
    useEffect(() => {
        if (!pausado && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 50);
        }
    }, [preguntaActual, pausado, turno]);

    // Timer con soporte de pausa
    useEffect(() => {
        if (jugador.terminado || pausado) return;
        const interval = setInterval(() => {
            setJugadores(prev => {
                const copy = [...prev];
                const jActivo = copy[turno];

                if (!jActivo.terminado) {
                    if (jActivo.tiempo > 0) {
                        jActivo.tiempo--;
                        if (jActivo.tiempo === 10) playSound('TICK');
                    } else {
                        jActivo.terminado = true;
                        playSound('WRONG');
                        gestionarCambioTurno(copy, true);
                    }
                }
                return copy;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [turno, jugador.terminado, pausado]);

    const gestionarCambioTurno = (copyJugadores, forzarCambio = false) => {
        if (!modoDuelo) {
            if (copyJugadores[0].terminado) onFinish();
            return;
        }
        const otro = turno === 0 ? 1 : 0;
        const esteTermino = copyJugadores[turno].terminado;
        const otroTermino = copyJugadores[otro].terminado;

        if (esteTermino && otroTermino) onFinish();
        else if (esteTermino) setTurno(otro);
        else if (forzarCambio && !otroTermino) setTurno(otro);
    };

    const procesar = (esPasapalabra) => {
        const copyJugadores = [...jugadores];
        const copyRosco = [...jugador.rosco];
        const item = copyRosco[jugador.indice];
        let acierto = false;
        let esFalloReal = false;

        if (!esPasapalabra) {
            const clean = (t) => t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
            const respUsuario = clean(input);
            const respCorrecta = clean(item.respuesta || item.correcta);

            if (respUsuario === respCorrecta) {
                item.estado = 'acierto';
                copyJugadores[turno].aciertos++;
                acierto = true;
                playSound('CORRECT');
            } else {
                item.estado = 'fallo';
                copyJugadores[turno].fallos++;
                playSound('WRONG');
                esFalloReal = true;
            }
        }

        let next = jugador.indice + 1;
        let vueltas = 0;
        while (vueltas < 2) {
            if (next >= copyRosco.length) { next = 0; vueltas++; }
            if (copyRosco[next].estado === null) break;
            next++;
        }

        if (copyRosco.every(p => p.estado !== null)) copyJugadores[turno].terminado = true;
        else copyJugadores[turno].indice = next;

        copyJugadores[turno].rosco = copyRosco;
        setJugadores(copyJugadores);
        setInput('');

        if (esFalloReal) {
            setPausado(true);
            // CORRECCIÓN: Aseguramos que siempre haya un texto para mostrar
            const textoCorrecto = item.respuesta || item.correcta || item.solucion || "ERROR EN DATOS";
            setDatosError({ correcta: textoCorrecto });
        } else {
            const deboCambiar = esPasapalabra || !acierto;
            gestionarCambioTurno(copyJugadores, deboCambiar);
        }
    };

    const cerrarModalError = () => {
        setPausado(false);
        setDatosError(null);
        gestionarCambioTurno(jugadores, true);
    };

    return (
        <>
            <div id="game-container" className={turno === 1 ? 'p2-active' : ''}>
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
                    {modoDuelo && (
                        <div id="marcador-dual">
                            <div className={`ficha ${turno === 0 ? 'activa' : ''}`} style={{ background: '#273c75' }}>AZUL: {jugadores[0].aciertos}</div>
                            <div className={`ficha ${turno === 1 ? 'activa' : ''}`} style={{ background: '#e67e22' }}>NARANJA: {jugadores[1].aciertos}</div>
                        </div>
                    )}
                    <div id="timer" className={jugador.tiempo <= 10 ? 'timer-warning' : ''}>{jugador.tiempo}</div>
                    <h2 id="letra-grande">{preguntaActual.letra}</h2>
                    <div id="pregunta-box">{preguntaActual.pregunta}</div>

                    <input
                        ref={inputRef} // REFERENCIA AÑADIDA
                        id="respuesta-usuario"
                        autoComplete="off"
                        placeholder="Respuesta..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !pausado && procesar(false)}
                        autoFocus
                        disabled={pausado}
                    />

                    <div className="controles">
                        <button className="btn-ok" onClick={() => procesar(false)} disabled={pausado}>ENVIAR</button>
                        <button className="btn-pasa" onClick={() => procesar(true)} disabled={pausado}>PASAPALABRA</button>
                    </div>
                </div>
            </div>

            {/* MODAL ERROR (Fuera del contenedor del juego para evitar z-index issues) */}
            {pausado && datosError && (
                <div className="modal-overlay">
                    <div className="neon-card">
                        <div className="neon-title">¡INCORRECTO!</div>
                        <div className="neon-answer-label">La respuesta correcta era:</div>
                        <div className="neon-answer">{datosError.correcta}</div>
                        <button className="neon-btn" onClick={cerrarModalError}>CONTINUAR</button>
                    </div>
                </div>
            )}
        </>
    );
};

// --- PANTALLA FIN ---
const PantallaFin = ({ jugadores, recurso, hoja, usuario, modoDuelo, playSound, onExit }) => {
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        playSound('WIN');
        lanzarConfeti();
    }, []);

    const lanzarConfeti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 3000 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;
        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            if (confetti) {
                confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }
        }, 250);
    };

    const guardar = async () => {
        if (modoDuelo) return;
        setGuardando(true);
        try {
            const score = jugadores[0].aciertos;
            const rankingRef = collection(db, 'ranking');

            const qBetter = query(rankingRef, where('recursoId', '==', recurso.id), where('categoria', '==', hoja), where('tipoJuego', '==', 'PASAPALABRA'), where('aciertos', '>', score));
            let rank = 1;
            try { const snapBetter = await getCountFromServer(qBetter); rank = snapBetter.data().count + 1; } catch (err) { console.warn("Index needed", err); }

            let medallaCalc = '';
            if (rank === 1) medallaCalc = '🥇';
            if (rank === 2) medallaCalc = '🥈';
            if (rank === 3) medallaCalc = '🥉';

            const q = query(rankingRef, where('recursoId', '==', recurso.id), where('categoria', '==', hoja), where('email', '==', usuario.email), where('tipoJuego', '==', 'PASAPALABRA'));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const docExistente = snap.docs[0];
                if (score > docExistente.data().aciertos) {
                    await updateDoc(doc(db, 'ranking', docExistente.id), { aciertos: score, fecha: new Date(), medalla: medallaCalc, recursoTitulo: recurso.titulo });
                    alert(`¡Nuevo Récord Personal! Estás en la posición #${rank} 🏆`);
                } else alert(`No has superado tu récord. Posición actual: #${rank}`);
            } else {
                await addDoc(rankingRef, {
                    recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'PASAPALABRA', juego: 'Pasapalabra', categoria: hoja,
                    email: usuario.email, jugador: usuario.displayName || "Anónimo", aciertos: score, fecha: new Date(), medalla: medallaCalc
                });
                alert(`Puntuación Guardada. Estás en la posición #${rank} 🚀`);
            }
            onExit();
        } catch (e) { console.error(e); alert("Error guardando."); setGuardando(false); }
    };

    let mensajeGanador = "";
    let colorGanador = "white";
    if (modoDuelo) {
        const p1 = jugadores[0].aciertos;
        const p2 = jugadores[1].aciertos;
        if (p1 > p2) { mensajeGanador = "🏆 ¡GANA EL EQUIPO AZUL!"; colorGanador = "#273c75"; }
        else if (p2 > p1) { mensajeGanador = "🏆 ¡GANA EL EQUIPO NARANJA!"; colorGanador = "#e67e22"; }
        else { mensajeGanador = "🤝 ¡EMPATE!"; colorGanador = "#f1c40f"; }
    }

    return (
        <div className="card-menu">
            <h1 style={{ fontSize: '3rem', margin: '0 0 20px 0' }}>¡JUEGO TERMINADO!</h1>

            {modoDuelo && (
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '15px', marginBottom: '20px', border: `2px solid ${colorGanador}` }}>
                    <h2 className="winner-title" style={{ color: colorGanador }}>{mensajeGanador}</h2>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
                {jugadores.map((j, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: j.color }}>{j.nombre}</div>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', textShadow: `0 0 20px ${j.color}` }}>{j.aciertos}</div>
                        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Aciertos</div>
                    </div>
                ))}
            </div>

            {!modoDuelo && (
                <button className="btn-primary" onClick={guardar} disabled={guardando}>
                    {guardando ? 'Procesando...' : '💾 GUARDAR RESULTADO'}
                </button>
            )}

            <button className="btn-back" onClick={onExit}>
                {modoDuelo ? 'Salir' : 'Salir sin guardar'}
            </button>
        </div>
    );
};