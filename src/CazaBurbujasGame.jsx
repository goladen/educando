import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';

export default function CazaBurbujasGame({ recurso, usuario, alTerminar }) {
    const [fase, setFase] = useState('SETUP');
    const [puntuacion, setPuntuacion] = useState(0);
    const [modo, setModo] = useState('Burbujas');
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [verRanking, setVerRanking] = useState(false);
    const [guardando, setGuardando] = useState(false); // Estado para evitar doble click

    const iniciar = (modoJuego, hoja) => {
        setModo(modoJuego);
        setHojaSeleccionada(hoja);
        setPuntuacion(0);
        setFase('JUEGO');
    };

    const guardarRanking = async () => {
        if (guardando) return;
        setGuardando(true);
        try {
            const rankingRef = collection(db, 'ranking');

            // 1. BUSCAR SI YA EXISTE UN RECORD
            const q = query(
                rankingRef,
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hojaSeleccionada),
                where('email', '==', usuario.email), // Filtrar por email es más seguro
                where('tipoJuego', '==', 'CAZABURBUJAS') // Nuevo identificador estándar
            );

            const snap = await getDocs(q);

            // Calcular medalla
            const medallaCalc = puntuacion >= 20 ? '🥇' : (puntuacion >= 10 ? '🥈' : (puntuacion > 0 ? '🥉' : ''));

            if (!snap.empty) {
                // YA EXISTE -> ACTUALIZAR SI ES MEJOR
                const docRef = snap.docs[0];
                const oldScore = docRef.data().aciertos;

                if (puntuacion > oldScore) {
                    await updateDoc(doc(db, 'ranking', docRef.id), {
                        aciertos: puntuacion,
                        fecha: new Date(),
                        medalla: medallaCalc,
                        recursoTitulo: recurso.titulo // Actualizar título por si cambió
                    });
                    alert("🚀 ¡Nuevo Récord Personal! Guardado.");
                } else {
                    alert(`⚠️ No has superado tu mejor registro en ${hojaSeleccionada}. (Tu récord: ${oldScore})`);
                }
            } else {
                // NO EXISTE -> CREAR NUEVO
                await addDoc(rankingRef, {
                    recursoId: recurso.id,
                    recursoTitulo: recurso.titulo,   // VITAL PARA DASHBOARD
                    tipoJuego: 'CAZABURBUJAS',       // VITAL PARA COLOR/ICONO
                    juego: 'CazaBurbujas',           // (Legacy)
                    modo: modo,
                    categoria: hojaSeleccionada,
                    email: usuario.email,            // VITAL PARA MIS RECORDS
                    jugador: usuario.displayName || "Anónimo",
                    aciertos: puntuacion,
                    fecha: new Date(),
                    medalla: medallaCalc
                });
                alert("✅ Puntuación Guardada.");
            }
            alTerminar();
        } catch (e) {
            console.error(e);
            alert("Error al guardar. Inténtalo de nuevo.");
            setGuardando(false);
        }
    };

    if (fase === 'SETUP' && !verRanking) return <PantallaSetup recurso={recurso} onStart={iniciar} onRanking={() => setVerRanking(true)} onExit={alTerminar} />;

    if (verRanking) return <PantallaRanking recurso={recurso} usuario={usuario} onBack={() => setVerRanking(false)} />;

    if (fase === 'FIN') {
        return (
            <div className="card-menu">
                <h1>¡Juego Terminado!</h1>
                <h2 style={{ color: '#f1c40f', fontSize: '3rem' }}>{puntuacion} pts</h2>
                <button className="btn-success" onClick={guardarRanking} disabled={guardando}>
                    {guardando ? 'Procesando...' : '💾 GUARDAR RESULTADO'}
                </button>
                <button className="btn-back" onClick={alTerminar}>Salir sin guardar</button>
                <EstilosComunes />
            </div>
        );
    }

    return (
        <EngineBurbujas recurso={recurso} modo={modo} hoja={hojaSeleccionada} setPuntuacionTotal={setPuntuacion} onFinish={() => setFase('FIN')} onExit={alTerminar} />
    );
}

// --- PANTALLAS AUXILIARES ---

const PantallaSetup = ({ recurso, onStart, onRanking, onExit }) => {
    const [hoja, setHoja] = useState('General');
    const hojasDisponibles = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    return (
        <div className="card-menu">
            <h1>Caza la Respuesta</h1>
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
            <button className="btn-burbujas" onClick={() => onStart('Burbujas', hoja)}>🔴 Jugar Burbujas</button>
            <button className="btn-test" onClick={() => onStart('Test', hoja)}>📝 Jugar Modo Test</button>
            <button className="btn-ranking" onClick={onRanking}>🏆 VER RANKING</button>
            <button className="btn-back" onClick={onExit}>⬅ Volver</button>
            <EstilosComunes />
        </div>
    );
}

const PantallaRanking = ({ recurso, usuario, onBack }) => {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const [cargando, setCargando] = useState(false);
    const hojas = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    useEffect(() => {
        const fetchRanking = async () => {
            setCargando(true);
            try {
                const ref = collection(db, 'ranking');

                // Query Top 10
                const qTop = query(
                    ref,
                    where('recursoId', '==', recurso.id),
                    where('tipoJuego', '==', 'CAZABURBUJAS'),
                    where('categoria', '==', hoja),
                    orderBy('aciertos', 'desc'),
                    limit(10)
                );
                const snapTop = await getDocs(qTop);
                setTop10(snapTop.docs.map(d => d.data()));

                // Query Personal Best (Por email)
                const qMejor = query(
                    ref,
                    where('recursoId', '==', recurso.id),
                    where('tipoJuego', '==', 'CAZABURBUJAS'),
                    where('categoria', '==', hoja),
                    where('email', '==', usuario.email),
                    orderBy('aciertos', 'desc'),
                    limit(1)
                );
                const snapMejor = await getDocs(qMejor);
                if (!snapMejor.empty) setMiMejor(snapMejor.docs[0].data().aciertos);
            } catch (e) { console.log(e); }
            setCargando(false);
        };
        fetchRanking();
    }, [hoja]);

    const getMedalla = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1);

    return (
        <div className="card-menu">
            <h2 style={{ color: '#f1c40f' }}>🏆 Ranking</h2>
            <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '5px' }}><option value="General">General</option>{hojas.map(h => <option key={h} value={h}>{h}</option>)}</select>

            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '200px', overflowY: 'auto', marginBottom: '15px' }}>
                {cargando ? <p>Cargando...</p> : top10.length === 0 ? <p>No hay puntuaciones.</p> : (
                    top10.map((f, i) => <div key={i} className="ranking-row"><span className="rank-pos">{getMedalla(i)}</span><span className="rank-name">{f.jugador}</span><span className="rank-score">{f.aciertos}</span></div>)
                )}
            </div>

            {miMejor !== null && <div className="personal-best">Tu Record: {miMejor}</div>}
            <button className="btn-back" onClick={onBack}>Cerrar</button>
            <EstilosComunes />
        </div>
    );
};

// --- MOTOR DEL JUEGO (Engine) ---

const EngineBurbujas = ({ recurso, modo, hoja, setPuntuacionTotal, onFinish, onExit }) => {
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [puntos, setPuntos] = useState(0);
    const [tiempoBarra, setTiempoBarra] = useState(100);
    const [opcionesTest, setOpcionesTest] = useState([]);
    const [indiceFeedback, setIndiceFeedback] = useState(null);
    const [tipoFeedback, setTipoFeedback] = useState(null);

    const gameContainerRef = useRef(null);
    const bubblesRef = useRef([]);
    const animationRef = useRef(null);
    const timerRef = useRef(null);
    const preguntasJugables = useRef([]);
    const indiceActual = useRef(0);

    useEffect(() => {
        let pool = [];
        if (hoja === 'General') recurso.hojas.forEach(h => pool.push(...h.preguntas));
        else { const hObj = recurso.hojas.find(h => h.nombreHoja === hoja); if (hObj) pool = [...hObj.preguntas]; }
        pool.sort(() => Math.random() - 0.5);
        const limiteReal = Math.min(pool.length, parseInt(recurso.config?.numPreguntas) || 10);
        preguntasJugables.current = pool.slice(0, limiteReal);
        indiceActual.current = 0;
        cargarPregunta();
        return () => { cancelAnimationFrame(animationRef.current); clearInterval(timerRef.current); };
    }, []);

    const cargarPregunta = () => {
        limpiarBurbujas();
        setIndiceFeedback(null); setTipoFeedback(null);
        if (indiceActual.current >= preguntasJugables.current.length) { onFinish(); return; }

        const datos = preguntasJugables.current[indiceActual.current];
        setPreguntaActual(datos);

        const tiempoMax = parseFloat(recurso.config?.tiempoPregunta) || 20;
        iniciarTimer(tiempoMax);

        let opciones = [{ txt: datos.correcta || datos.respuesta, ok: true }];
        const falsas = datos.incorrectas || datos.falsas || ["Error 1", "Error 2", "Error 3"];
        const numFalsas = modo === 'Burbujas' ? 5 : 3;
        const seleccionFalsas = falsas.slice(0, numFalsas);
        seleccionFalsas.forEach(f => opciones.push({ txt: f, ok: false }));
        opciones.sort(() => Math.random() - 0.5);

        if (modo === 'Burbujas') { crearBurbujasDOM(opciones); animarLoop(); }
        else setOpcionesTest(opciones);
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
            const pts = parseInt(recurso.config?.puntosAcierto) || 10;
            setPuntos(prev => { const n = prev + pts; setPuntuacionTotal(n); return n; });
            if (elementoDOM) { elementoDOM.style.transform = "scale(1.5)"; elementoDOM.style.opacity = "0"; }
            clearInterval(timerRef.current); pasarSiguientePregunta();
        } else {
            const pts = parseInt(recurso.config?.puntosFallo) || 2;
            setPuntos(prev => { const n = prev - pts; setPuntuacionTotal(n); return n; });
            if (elementoDOM) { elementoDOM.style.transform = "scale(0)"; }
            bubblesRef.current = bubblesRef.current.filter(b => b.el !== elementoDOM);
            setTimeout(() => elementoDOM?.remove(), 200);
        }
    };

    const clickTest = (opcion, idxBoton) => {
        if (indiceFeedback !== null) return;
        clearInterval(timerRef.current);
        const esCorrecta = opcion.ok;
        setIndiceFeedback(idxBoton); setTipoFeedback(esCorrecta ? 'correct' : 'incorrect');
        if (esCorrecta) { const pts = parseInt(recurso.config?.puntosAcierto) || 10; setPuntos(prev => { const n = prev + pts; setPuntuacionTotal(n); return n; }); }
        else { const pts = parseInt(recurso.config?.puntosFallo) || 2; setPuntos(prev => { const n = prev - pts; setPuntuacionTotal(n); return n; }); }
        setTimeout(pasarSiguientePregunta, 1500);
    };

    const crearBurbujasDOM = (opciones) => {
        const container = gameContainerRef.current; if (!container) return;
        const cols = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'];
        opciones.forEach(op => {
            const el = document.createElement('div');
            const colorClass = cols[Math.floor(Math.random() * 6)];
            el.className = `shape-container ${colorClass}`;
            el.innerHTML = `<span>${op.txt}</span>`;
            let size = 90 + Math.random() * 30; let w = size, h = size; if (Math.random() > 0.5) w = size * 1.2; else h = size * 1.1;
            el.style.width = `${w}px`; el.style.height = `${h}px`;
            const maxX = window.innerWidth - w; const maxY = window.innerHeight - 150;
            let x = Math.random() * maxX; let y = Math.random() * (maxY - 120) + 120;
            el.style.left = `${x}px`; el.style.top = `${y}px`;
            let vx = (Math.random() - 0.5) * 3; let vy = (Math.random() - 0.5) * 3; if (Math.abs(vx) < 0.5) vx = 1;
            const handleClick = (e) => { e.stopPropagation(); clickBurbuja(op.ok, el); };
            el.addEventListener('mousedown', handleClick); el.addEventListener('touchstart', handleClick);
            container.appendChild(el);
            bubblesRef.current.push({ el, x, y, vx, vy, w, h, r: Math.min(w, h) / 2 });
        });
    };
    const limpiarBurbujas = () => { if (gameContainerRef.current) gameContainerRef.current.innerHTML = ''; bubblesRef.current = []; cancelAnimationFrame(animationRef.current); };
    const animarLoop = () => {
        const W = window.innerWidth; const H = window.innerHeight; const topLimit = 120;
        bubblesRef.current.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            if (b.x <= 0) { b.x = 0; b.vx *= -1; } if (b.x + b.w >= W) { b.x = W - b.w; b.vx *= -1; }
            if (b.y <= topLimit) { b.y = topLimit; b.vy *= -1; } if (b.y + b.h >= H) { b.y = H - b.h; b.vy *= -1; }
        });
        const bubbles = bubblesRef.current;
        for (let i = 0; i < bubbles.length; i++) {
            for (let j = i + 1; j < bubbles.length; j++) {
                const b1 = bubbles[i]; const b2 = bubbles[j];
                const dx = (b2.x + b2.w / 2) - (b1.x + b1.w / 2); const dy = (b2.y + b2.h / 2) - (b1.y + b1.h / 2);
                const dist = Math.sqrt(dx * dx + dy * dy); const minDist = b1.r + b2.r;
                if (dist < minDist) {
                    const angle = Math.atan2(dy, dx); const tx = Math.cos(angle) * (minDist - dist) / 2; const ty = Math.sin(angle) * (minDist - dist) / 2;
                    b1.x -= tx; b1.y -= ty; b2.x += tx; b2.y += ty;
                    const tempVx = b1.vx; const tempVy = b1.vy; b1.vx = b2.vx; b1.vy = b2.vy; b2.vx = tempVx; b2.vy = tempVy;
                }
            }
        }
        bubblesRef.current.forEach(b => { b.el.style.left = b.x + 'px'; b.el.style.top = b.y + 'px'; });
        animationRef.current = requestAnimationFrame(animarLoop);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle, #2f3640, #1e272e)' }}>
            <EstilosComunes />
            <div id="top-bar">
                <button className="btn-back-game" onClick={onExit}>Salir</button>
                <div id="timer-container"><div id="timer-bar" style={{ width: `${tiempoBarra}%`, background: tiempoBarra < 30 ? '#ff4757' : '#2ecc71' }}></div></div>
                <div id="score-display">{puntos} pts</div>
                <div style={{ color: 'white', fontSize: '0.8rem' }}>Pregunta {indiceActual.current + 1} / {preguntasJugables.current.length}</div>
                <div id="question-text">{preguntaActual ? preguntaActual.pregunta : 'Cargando...'}</div>
            </div>
            {modo === 'Burbujas' ? (<div ref={gameContainerRef} style={{ width: '100%', height: '100%' }} />) : (
                <div id="test-area">
                    {opcionesTest.map((op, i) => (
                        <div key={i} className={`test-option ${indiceFeedback === i ? tipoFeedback : ''}`} onClick={() => clickTest(op, i)}>{op.txt}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const EstilosComunes = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@400;700&display=swap');
    .card-menu { background: rgba(0,0,0,0.6); padding: 30px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); margin: 50px auto; color: white; font-family: 'Roboto', sans-serif; }
    h1, h2 { font-family: 'Fredoka One'; margin: 0 0 20px 0; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
    .btn-burbujas { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: white; background: #ff4757; margin-bottom: 10px; font-size: 1rem; box-shadow: 0 4px 0 rgba(0,0,0,0.2); }
    .btn-test { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: #2d3436; background: #2ed573; margin-bottom: 10px; font-size: 1rem; box-shadow: 0 4px 0 rgba(0,0,0,0.2); }
    .btn-success { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: #333; background: #2ecc71; margin-bottom: 10px; }
    .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; }
    .btn-back-game { position: absolute; left: 10px; top: 10px; background: rgba(0,0,0,0.5); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer; z-index: 50; }
    .btn-ranking { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; background: #8e44ad; color: white; font-size: 1rem; margin-bottom: 10px; }
    #top-bar { position: absolute; top: 0; left: 0; width: 100%; height: 120px; background: rgba(0,0,0,0.85); z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; border-bottom: 2px solid #444; padding-top: 5px; }
    #timer-container { width: 90%; height: 10px; background: #555; border-radius: 5px; overflow: hidden; margin-bottom: 5px; }
    #timer-bar { height: 100%; transition: width 0.1s linear; }
    #score-display { font-family: 'Fredoka One'; font-size: 1.5rem; color: #f1c40f; }
    #question-text { font-size: 1.1rem; max-width: 90%; text-align: center; color: #fff; margin-top: 5px; line-height: 1.2; font-weight: bold; font-family: 'Roboto'; }
    .shape-container { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: bold; font-size: 0.9rem; cursor: pointer; user-select: none; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); box-shadow: inset -5px -5px 15px rgba(0,0,0,0.3), 2px 2px 5px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; transition: transform 0.2s; }
    .c-1 { background: linear-gradient(135deg, #ff0055, #a30036); } .c-2 { background: linear-gradient(135deg, #00e600, #008000); } .c-3 { background: linear-gradient(135deg, #00ccff, #006680); } .c-4 { background: linear-gradient(135deg, #ffcc00, #cc9900); } .c-5 { background: linear-gradient(135deg, #9b59b6, #6c3483); } .c-6 { background: linear-gradient(135deg, #e67e22, #a0500d); }
    #test-area { position: absolute; top: 130px; width: 100%; display: flex; flex-direction: column; align-items: center; }
    .test-option { background: white; width: 90%; max-width: 500px; padding: 15px; margin-bottom: 10px; border-radius: 10px; color: #333; font-weight: bold; cursor: pointer; border-left: 6px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: 0.2s; }
    .test-option:hover { transform: scale(1.02); }
    .correct { background: #2ecc71 !important; color: white !important; border-color: #27ae60 !important; }
    .incorrect { background: #e74c3c !important; color: white !important; border-color: #c0392b !important; }
    .ranking-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; color:white; }
    .rank-pos { width: 30px; font-weight: bold; }
    .rank-name { flex: 1; text-align: left; }
    .rank-score { font-weight: bold; color: #f1c40f; }
    .personal-best { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid #f1c40f; color: #f1c40f; font-weight: bold; }
    `}</style>
);