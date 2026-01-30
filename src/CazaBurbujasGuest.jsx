import { useState, useEffect, useRef } from 'react';

// Si no tienes canvas-confetti instalado, este efecto se omitirá suavemente o puedes usar una función simple
// Aquí asumimos que si no está, no pasa nada, pero la estructura está lista.

export default function CazaBurbujasGuest({ recurso, onBack, onLoginRequest }) {
    const [fase, setFase] = useState('SETUP');
    const [puntuacion, setPuntuacion] = useState(0);

    const iniciar = () => {
        setPuntuacion(0);
        setFase('JUEGO');
    };

    if (fase === 'SETUP') return (
        <div className="game-overlay">
            <div className="card-menu">
                <h1>Caza la Respuesta</h1>
                <h2 style={{ color: 'white', fontSize: '1.2rem' }}>{recurso.titulo}</h2>
                <p style={{ color: '#ccc', fontSize: '0.9rem' }}>Modo <b>Invitado</b></p>
                <button className="btn-burbujas" onClick={iniciar}> Jugar Ahora</button>
                <button className="btn-back" onClick={onBack}> Volver</button>
                <EstilosComunes />
            </div>
        </div>
    );

    if (fase === 'FIN') {
        return (
            <div className="game-overlay">
                <PantallaFinGuest puntuacion={puntuacion} onLoginRequest={onLoginRequest} onExit={onBack} />
                <EstilosComunes />
            </div>
        );
    }

    return (
        <div className="game-overlay">
            <EngineBurbujas recurso={recurso} setPuntuacionTotal={setPuntuacion} onFinish={() => setFase('FIN')} onExit={onBack} />
            <EstilosComunes />
        </div>
    );
}

// --- PANTALLA FIN GUEST ---
const PantallaFinGuest = ({ puntuacion, onLoginRequest, onExit }) => {
    useEffect(() => {
        // Efecto confeti simple simulado si no hay librería
        if (window.confetti) {
            window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 3000 });
        }
    }, []);

    return (
        <div className="card-menu">
            <h1>¡Juego Terminado!</h1>
            <h2 style={{ color: '#f1c40f', fontSize: '3rem' }}>{puntuacion} pts</h2>

            <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '15px' }}>
                <p style={{ color: '#eee', lineHeight: '1.4' }}>
                    Para <b>guardar tu récord</b> y aparecer en el ranking, necesitas una cuenta.
                </p>
                <p style={{ color: 'white', fontWeight: 'bold' }}>¡Únete a LearnJoy hoy mismo!</p>
            </div>

            <button className="btn-marketing" onClick={onLoginRequest}>
                🚀 UNIRSE A LA COMUNIDAD
            </button>
            <button className="btn-back" onClick={onExit}>Volver al inicio</button>
        </div>
    );
};

// --- MOTOR DEL JUEGO (Copia simplificada del original) ---
const EngineBurbujas = ({ recurso, setPuntuacionTotal, onFinish, onExit }) => {
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [puntos, setPuntos] = useState(0);
    const [tiempoBarra, setTiempoBarra] = useState(100);

    const gameContainerRef = useRef(null);
    const bubblesRef = useRef([]);
    const animationRef = useRef(null);
    const timerRef = useRef(null);
    const preguntasJugables = useRef([]);
    const indiceActual = useRef(0);

    useEffect(() => {
        let pool = [];
        // En modo invitado cogemos TODAS las preguntas mezcladas
        if (recurso.hojas) recurso.hojas.forEach(h => pool.push(...h.preguntas));
        pool.sort(() => Math.random() - 0.5);
        // Limitamos a 10 preguntas para invitados
        const limite = Math.min(pool.length, 10);
        preguntasJugables.current = pool.slice(0, limite);
        indiceActual.current = 0;
        cargarPregunta();
        return () => { cancelAnimationFrame(animationRef.current); clearInterval(timerRef.current); };
    }, []);

    const cargarPregunta = () => {
        limpiarBurbujas();
        if (indiceActual.current >= preguntasJugables.current.length) { onFinish(); return; }

        const datos = preguntasJugables.current[indiceActual.current];
        setPreguntaActual(datos);
        const tiempoMax = parseFloat(recurso.config?.tiempoPregunta) || 20;
        iniciarTimer(tiempoMax);

        let opciones = [{ txt: datos.correcta || datos.respuesta, ok: true }];
        const falsas = datos.incorrectas || ["Error 1", "Error 2", "Error 3", "Error 4", "Error 5"];
        const seleccionFalsas = falsas.slice(0, 5); // 5 falsas + 1 correcta = 6 burbujas
        seleccionFalsas.forEach(f => opciones.push({ txt: f, ok: false }));
        opciones.sort(() => Math.random() - 0.5);

        crearBurbujasDOM(opciones);
        animarLoop();
    };

    const iniciarTimer = (segundos) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTiempoBarra(100);
        const decremento = 100 / (segundos * 20);
        timerRef.current = setInterval(() => {
            setTiempoBarra(prev => {
                if (prev <= 0) { clearInterval(timerRef.current); pasarSiguientePregunta(); return 0; }
                return prev - decremento;
            });
        }, 50);
    };

    const pasarSiguientePregunta = () => { indiceActual.current += 1; setTimeout(() => cargarPregunta(), 500); };

    const clickBurbuja = (esCorrecta, elementoDOM) => {
        if (esCorrecta) {
            const pts = 10;
            setPuntos(prev => { const n = prev + pts; setPuntuacionTotal(n); return n; });
            if (elementoDOM) { elementoDOM.style.transform = "scale(1.5)"; elementoDOM.style.opacity = "0"; }
            clearInterval(timerRef.current); pasarSiguientePregunta();
        } else {
            const pts = 2;
            setPuntos(prev => { const n = prev - pts; setPuntuacionTotal(n); return n; });
            if (elementoDOM) { elementoDOM.style.transform = "scale(0)"; }
            bubblesRef.current = bubblesRef.current.filter(b => b.el !== elementoDOM);
            setTimeout(() => elementoDOM?.remove(), 200);
        }
    };

    const crearBurbujasDOM = (opciones) => {
        const container = gameContainerRef.current; if (!container) return;
        const cols = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'];
        opciones.forEach(op => {
            const el = document.createElement('div');
            const colorClass = cols[Math.floor(Math.random() * 6)];
            el.className = `shape-container ${colorClass}`;
            el.innerHTML = `<span>${op.txt}</span>`;
            let size = 90 + Math.random() * 30;
            el.style.width = `${size}px`; el.style.height = `${size}px`;
            const maxX = window.innerWidth - size; const maxY = window.innerHeight - 150;
            let x = Math.random() * maxX; let y = Math.random() * (maxY - 120) + 120;
            el.style.left = `${x}px`; el.style.top = `${y}px`;
            let vx = (Math.random() - 0.5) * 3; let vy = (Math.random() - 0.5) * 3;
            const handleClick = (e) => { e.stopPropagation(); clickBurbuja(op.ok, el); };
            el.addEventListener('mousedown', handleClick); el.addEventListener('touchstart', handleClick);
            container.appendChild(el);
            bubblesRef.current.push({ el, x, y, vx, vy, w: size, h: size, r: size / 2 });
        });
    };

    const limpiarBurbujas = () => { if (gameContainerRef.current) gameContainerRef.current.innerHTML = ''; bubblesRef.current = []; cancelAnimationFrame(animationRef.current); };

    const animarLoop = () => {
        const W = window.innerWidth; const H = window.innerHeight; const topLimit = 120;
        bubblesRef.current.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            if (b.x <= 0 || b.x + b.w >= W) b.vx *= -1;
            if (b.y <= topLimit || b.y + b.h >= H) b.y = Math.max(topLimit, Math.min(b.y, H - b.h));
            // Simple bounce logic
            if (b.y <= topLimit || b.y + b.h >= H) b.vy *= -1;
        });
        bubblesRef.current.forEach(b => { b.el.style.left = b.x + 'px'; b.el.style.top = b.y + 'px'; });
        animationRef.current = requestAnimationFrame(animarLoop);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle, #2f3640, #1e272e)' }}>
            <div id="top-bar">
                <button className="btn-back-game" onClick={onExit}>Salir</button>
                <div id="timer-container"><div id="timer-bar" style={{ width: `${tiempoBarra}%`, background: tiempoBarra < 30 ? '#ff4757' : '#2ecc71' }}></div></div>
                <div id="score-display">{puntos} pts</div>
                <div style={{ color: 'white', fontSize: '0.8rem' }}>Pregunta {indiceActual.current + 1} / {preguntasJugables.current.length}</div>
                <div id="question-text">{preguntaActual ? preguntaActual.pregunta : 'Cargando...'}</div>
            </div>
            <div ref={gameContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

const EstilosComunes = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@400;700&display=swap');
    .game-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: radial-gradient(circle, #2f3640, #1e272e); z-index: 1000; display: flex; justify-content: center; align-items: center; }
    .card-menu { background: rgba(0,0,0,0.6); padding: 30px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); margin: 50px auto; color: white; font-family: 'Roboto', sans-serif; }
    h1, h2 { font-family: 'Fredoka One'; margin: 0 0 20px 0; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
    .btn-burbujas { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: white; background: #ff4757; margin-bottom: 10px; font-size: 1rem; box-shadow: 0 4px 0 rgba(0,0,0,0.2); }
    .btn-marketing { width: 100%; padding: 15px; margin-top: 15px; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; background: linear-gradient(45deg, #FF9800, #F44336); color: white; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; margin-top: 10px; }
    .btn-back-game { position: absolute; left: 10px; top: 10px; background: rgba(0,0,0,0.5); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer; z-index: 50; }
    #top-bar { position: absolute; top: 0; left: 0; width: 100%; height: 120px; background: rgba(0,0,0,0.85); z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; border-bottom: 2px solid #444; padding-top: 5px; }
    #timer-container { width: 90%; height: 10px; background: #555; border-radius: 5px; overflow: hidden; margin-bottom: 5px; }
    #timer-bar { height: 100%; transition: width 0.1s linear; }
    #score-display { font-family: 'Fredoka One'; font-size: 1.5rem; color: #f1c40f; }
    #question-text { font-size: 1.1rem; max-width: 90%; text-align: center; color: #fff; margin-top: 5px; line-height: 1.2; font-weight: bold; font-family: 'Roboto'; }
    .shape-container { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; font-size: 0.9rem; cursor: pointer; user-select: none; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); box-shadow: inset -5px -5px 15px rgba(0,0,0,0.3), 2px 2px 5px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; transition: transform 0.2s; }
    .c-1 { background: linear-gradient(135deg, #ff0055, #a30036); } .c-2 { background: linear-gradient(135deg, #00e600, #008000); } .c-3 { background: linear-gradient(135deg, #00ccff, #006680); } .c-4 { background: linear-gradient(135deg, #ffcc00, #cc9900); } .c-5 { background: linear-gradient(135deg, #9b59b6, #6c3483); } .c-6 { background: linear-gradient(135deg, #e67e22, #a0500d); }
    `}</style>
);