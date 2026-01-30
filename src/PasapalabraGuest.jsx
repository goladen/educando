import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti'; // Si no tienes esto instalado, el efecto visual será sencillo o puedes instalarlo con 'npm install canvas-confetti'

// --- ESTILOS CSS (Iguales al original) ---
const STYLES = `
  :root { --azul: #273c75; --naranja: #e67e22; --verde: #2ecc71; --rojo: #e74c3c; --amarillo: #f1c40f; --violeta: #9b59b6; }
  .game-wrapper { font-family: 'Segoe UI', sans-serif; background: radial-gradient(circle, #2f3640, #1e272e); height: 100vh; width: 100vw; display: flex; justify-content: center; align-items: center; color: white; overflow: hidden; position: relative; z-index: 1000; position: fixed; top: 0; left: 0; }
  .card-menu { background: rgba(0,0,0,0.85); padding: 30px; border-radius: 20px; width: 90%; max-width: 450px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 100; position: relative; }
  .btn-primary { width: 100%; padding: 12px; margin-bottom: 10px; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; background: var(--azul); color: white; transition: 0.2s; font-size: 1rem; }
  .btn-marketing { width: 100%; padding: 15px; margin-top: 15px; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; background: linear-gradient(45deg, #FF9800, #F44336); color: white; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4); animation: pulse 2s infinite; }
  @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
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
  @media (max-width: 700px) { #game-container { transform: scale(0.6); } }
`;

export default function PasapalabraGuest({ recurso, onBack, onLoginRequest }) {
    const [fase, setFase] = useState('SETUP');
    const [jugadores, setJugadores] = useState([]);
    const [turno, setTurno] = useState(0);

    const iniciar = () => {
        // En modo invitado siempre es 1 jugador y Hoja General (o la primera)
        const pool = [];
        if (recurso.hojas) recurso.hojas.forEach(h => pool.push(...h.preguntas));

        // Eliminar duplicados de letras
        const unicas = {};
        pool.forEach(p => { if (!unicas[p.letra]) unicas[p.letra] = p; });
        const preguntasFinales = Object.values(unicas).sort((a, b) => a.letra.localeCompare(b.letra));

        const roscoInicial = preguntasFinales.map(p => ({ ...p, estado: null }));
        const tiempo = parseInt(recurso.config?.tiempoTotal) || 150;

        setJugadores([
            { nombre: 'Invitado', color: '#273c75', rosco: roscoInicial, aciertos: 0, fallos: 0, indice: 0, tiempo, terminado: false }
        ]);
        setFase('JUEGO');
    };

    return (
        <div className="game-wrapper">
            <style>{STYLES}</style>
            {fase === 'SETUP' && (
                <div className="card-menu">
                    <h1 style={{ color: '#f1c40f', fontFamily: 'sans-serif', margin: 0 }}>Pasapalabra</h1>
                    <h2 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '20px', fontWeight: 'normal' }}>{recurso.titulo}</h2>
                    <p style={{ color: '#ccc', fontSize: '0.9rem' }}>Estás probando este recurso como <b>Invitado</b>.</p>
                    <button className="btn-primary" onClick={iniciar}> JUGAR AHORA</button>
                    <button className="btn-back" onClick={onBack}> Volver</button>
                </div>
            )}

            {fase === 'JUEGO' && (
                <Tablero
                    jugadores={jugadores}
                    setJugadores={setJugadores}
                    turno={turno}
                    setTurno={setTurno}
                    onFinish={() => setFase('FIN')}
                />
            )}

            {fase === 'FIN' && (
                <PantallaFinGuest
                    puntuacion={jugadores[0].aciertos}
                    onLoginRequest={onLoginRequest}
                    onExit={onBack}
                />
            )}
        </div>
    );
}

// --- TABLERO (Lógica simplificada para 1 jugador) ---
const Tablero = ({ jugadores, setJugadores, turno, onFinish }) => {
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
                    onFinish();
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
            if (clean(input) === clean(item.respuesta || item.correcta)) {
                item.estado = 'acierto';
                copyJugadores[turno].aciertos++;
            } else {
                item.estado = 'fallo';
                copyJugadores[turno].fallos++;
            }
        }

        let next = jugador.indice + 1;
        let vueltas = 0;
        while (vueltas < 2) {
            if (next >= copyRosco.length) { next = 0; vueltas++; }
            if (copyRosco[next].estado === null) break;
            next++;
        }

        if (vueltas >= 2 || copyRosco.every(p => p.estado !== null)) {
            copyJugadores[turno].terminado = true;
            onFinish();
        } else {
            copyJugadores[turno].indice = next;
        }

        copyJugadores[turno].rosco = copyRosco;
        setJugadores(copyJugadores);
        setInput('');
    };

    return (
        <div id="game-container">
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
                <div id="timer">{jugador.tiempo}</div>
                <h2 id="letra-grande">{preguntaActual.letra}</h2>
                <div id="pregunta-box">{preguntaActual.pregunta}</div>
                <input id="respuesta-usuario" autoComplete="off" placeholder="Respuesta..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && procesar(false)} autoFocus />
                <div className="controles"><button className="btn-ok" onClick={() => procesar(false)}>ENVIAR</button><button className="btn-pasa" onClick={() => procesar(true)}>PASAPALABRA</button></div>
            </div>
        </div>
    );
};

// --- PANTALLA FIN (MARKETING) ---
const PantallaFinGuest = ({ puntuacion, onLoginRequest, onExit }) => {
    useEffect(() => {
        // Lanzar Confeti simple
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            // Si tienen la librería:
            if (window.confetti) {
                window.confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                window.confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }
        }, 250);
    }, []);

    return (
        <div className="card-menu">
            <h1 style={{ color: '#f1c40f' }}>¡Bien Hecho!</h1>
            <h2 style={{ color: 'white' }}>Has conseguido {puntuacion} aciertos</h2>

            <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '15px' }}>
                <p style={{ color: '#eee', lineHeight: '1.5' }}>
                    ¿Quieres <b>guardar tus puntuaciones</b>, competir en rankings y <b>crear tus propios juegos</b>?
                </p>
                <p style={{ color: 'white', fontWeight: 'bold' }}>¡Únete a la comunidad de LearnJoy!</p>
            </div>

            <button className="btn-marketing" onClick={onLoginRequest}>
                🚀 UNIRSE / INICIAR SESIÓN
            </button>
            <button className="btn-back" onClick={onExit}>Volver al inicio</button>
        </div>
    );
};