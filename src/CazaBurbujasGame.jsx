import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, orderBy, limit, updateDoc, getCountFromServer, increment } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import ReactionAvatar from './components/ReactionAvatar';

// --- IMPORTACIÓN DE AUDIOS ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import startSoundFile from './assets/inicio juego.mp3';

const TICK_SOUND_URL = 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_73686360b7.mp3?filename=clock-ticking-2-106637.mp3';

export default function CazaBurbujasGame({ recurso, usuario, alTerminar }) {
    const [fase, setFase] = useState('SETUP');
    const [puntuacion, setPuntuacion] = useState(0);
    const [modo, setModo] = useState('Burbujas');
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [verRanking, setVerRanking] = useState(false);
    const [guardando, setGuardando] = useState(false);

    // Detectar invitado
    const esInvitado = !usuario || !usuario.email;

    // --- SONIDOS ---
    const playSound = (type) => {
        let file = null;
        if (type === 'CORRECT') file = correctSoundFile;
        else if (type === 'WRONG') file = wrongSoundFile;
        else if (type === 'WIN') file = winSoundFile;
        else if (type === 'START') file = startSoundFile;
        else if (type === 'TICK') file = TICK_SOUND_URL;

        if (file) {
            const audio = new Audio(file);
            audio.volume = 0.6;
            audio.play().catch(e => { });
            if (type === 'CORRECT') {
                setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
            }
        }
    };

    // --- INCREMENTAR CONTADOR ---
    const incrementarPlayCount = async () => {
        try {
            const ref = doc(db, 'resources', recurso.id);
            await updateDoc(ref, { playCount: increment(1) });
        } catch (error) { console.error("Error stats", error); }
    };

    const iniciar = (modoJuego, hoja) => {
        setModo(modoJuego);
        setHojaSeleccionada(hoja);
        setPuntuacion(0);
        setFase('COUNTDOWN');
    };

    const guardarRanking = async () => {
        if (guardando || esInvitado) return;
        setGuardando(true);
        try {
            const rankingRef = collection(db, 'ranking');
            
            // Calcular Ranking
            const qBetter = query(
                rankingRef, 
                where('recursoId', '==', recurso.id),
                where('categoria', '==', hojaSeleccionada),
                where('tipoJuego', '==', 'CAZABURBUJAS'),
                where('aciertos', '>', puntuacion)
            );
            
            let rank = 1;
            try {
                const snapBetter = await getCountFromServer(qBetter);
                rank = snapBetter.data().count + 1;
            } catch (err) { console.warn("Index needed", err); }

            let medallaCalc = '';
            if (rank === 1) medallaCalc = '🥇';
            if (rank === 2) medallaCalc = '🥈';
            if (rank === 3) medallaCalc = '🥉';

            const q = query(rankingRef, where('recursoId', '==', recurso.id), where('categoria', '==', hojaSeleccionada), where('email', '==', usuario.email), where('tipoJuego', '==', 'CAZABURBUJAS'));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const docRef = snap.docs[0];
                if (puntuacion > docRef.data().aciertos) {
                    await updateDoc(doc(db, 'ranking', docRef.id), { aciertos: puntuacion, fecha: new Date(), medalla: medallaCalc, recursoTitulo: recurso.titulo });
                    alert(`¡Nuevo Récord! Estás en la posición #${rank} 🏆`);
                } else {
                    alert(`No has superado tu récord. Posición actual: #${rank}`);
                }
            } else {
                await addDoc(rankingRef, {
                    recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'CAZABURBUJAS', juego: 'CazaBurbujas',
                    modo: modo, categoria: hojaSeleccionada, email: usuario.email, jugador: usuario.displayName || "Anónimo",
                    aciertos: puntuacion, fecha: new Date(), medalla: medallaCalc
                });
                alert(`Puntuación Guardada. Posición #${rank} 🚀`);
            }
            alTerminar();
        } catch (e) {
            console.error(e);
            alert("Error al guardar.");
            setGuardando(false);
        }
    };

    if (fase === 'SETUP' && !verRanking) return <PantallaSetup recurso={recurso} onStart={iniciar} onRanking={() => setVerRanking(true)} onExit={alTerminar} />;
    if (verRanking) return <PantallaRanking recurso={recurso} usuario={usuario} onBack={() => setVerRanking(false)} />;
    
    if (fase === 'COUNTDOWN') {
        return (
            <PantallaCuentaAtras 
                hoja={hojaSeleccionada} 
                profesor={recurso.profesorNombre || recurso.nombreProfesor || "Tu Profesor"} 
                instrucciones={recurso.instrucciones}
                playSound={playSound} 
                onFinished={() => {
                    incrementarPlayCount(); 
                    setFase('JUEGO');
                }} 
            />
        );
    }

    if (fase === 'FIN') {
        return (
            <PantallaFin 
                puntuacion={puntuacion} 
                guardarRanking={guardarRanking} 
                guardando={guardando} 
                esInvitado={esInvitado}
                alTerminar={alTerminar} 
                playSound={playSound} 
            />
        );
    }

    return (
        <EngineBurbujas 
            recurso={recurso} 
            modo={modo} 
            hoja={hojaSeleccionada} 
            setPuntuacionTotal={setPuntuacion} 
            onFinish={() => setFase('FIN')} 
            onExit={alTerminar} 
            playSound={playSound} 
        />
    );
}

// --- PANTALLAS AUXILIARES ---

function PantallaSetup({ recurso, onStart, onRanking, onExit }) {
    const [hoja, setHoja] = useState('General');
    const hojas = recurso.hojas || [];
    return (
        <div className="card-menu">
            <h1>Caza la Respuesta</h1>
            <h2 style={{color:'white', fontSize:'1.2rem'}}>{recurso.titulo}</h2>
            {hojas.length > 0 && (
                <div style={{marginBottom:'20px', textAlign:'left'}}>
                    <label style={{display:'block', marginBottom:'5px', color:'#ccc'}}>Modalidad:</label>
                    <select value={hoja} onChange={e=>setHoja(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'10px'}}>
                        <option value="General">General (Mezcla)</option>
                        {hojas.map(h=><option key={h.nombreHoja} value={h.nombreHoja}>{h.nombreHoja}</option>)}
                    </select>
                </div>
            )}
            <button className="btn-burbujas" onClick={()=>onStart('Burbujas', hoja)}>Jugar Burbujas</button>
            <button className="btn-test" onClick={()=>onStart('Test', hoja)}>Jugar Modo Test</button>
            <button className="btn-ranking" onClick={onRanking}>VER RANKING</button>
            <button className="btn-back" onClick={onExit}>Volver</button>
            <EstilosComunes />
        </div>
    );
}

function PantallaRanking({ recurso, usuario, onBack }) {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const hojas = recurso.hojas || [];

    useEffect(() => {
        const cargar = async () => {
            try {
                const ref = collection(db, 'ranking');
                const qTop = query(ref, where('recursoId','==',recurso.id), where('tipoJuego','==','CAZABURBUJAS'), where('categoria','==',hoja), orderBy('aciertos','desc'), limit(10));
                const snapTop = await getDocs(qTop);
                setTop10(snapTop.docs.map(d=>d.data()));
                
                if (usuario && usuario.email) {
                    const qMejor = query(ref, where('recursoId','==',recurso.id), where('tipoJuego','==','CAZABURBUJAS'), where('categoria','==',hoja), where('email','==',usuario.email), orderBy('aciertos','desc'), limit(1));
                    const snapMejor = await getDocs(qMejor);
                    if(!snapMejor.empty) setMiMejor(snapMejor.docs[0].data().aciertos);
                }
            } catch(e) { console.log(e); }
        };
        cargar();
    }, [hoja]);

    return (
        <div className="card-menu">
            <h2 style={{color:'#f1c40f'}}>Ranking</h2>
            <select value={hoja} onChange={e=>setHoja(e.target.value)} style={{width:'100%', padding:'8px', marginBottom:'15px'}}>
                <option value="General">General</option>
                {hojas.map(h=><option key={h.nombreHoja} value={h.nombreHoja}>{h.nombreHoja}</option>)}
            </select>
            <div style={{background:'rgba(0,0,0,0.3)', borderRadius:'10px', height:'200px', overflowY:'auto', marginBottom:'15px'}}>
                {top10.length===0 ? <p>Sin datos</p> : top10.map((f,i)=>(
                    <div key={i} className="ranking-row"><span className="rank-pos">{i+1}</span><span className="rank-name">{f.jugador}</span><span className="rank-score">{f.aciertos}</span></div>
                ))}
            </div>
            {miMejor!==null && <div className="personal-best">Tu Récord: {miMejor}</div>}
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
            setTexto("3"); setCount(3); await new Promise(r=>setTimeout(r,1000));
            setTexto("2"); setCount(2); await new Promise(r=>setTimeout(r,1000));
            setTexto("1"); setCount(1); await new Promise(r=>setTimeout(r,1000));
            setTexto("¡YA!"); setCount(0); await new Promise(r=>setTimeout(r,1000));
            onFinished();
        };
        run();
    }, []);

    return (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'radial-gradient(circle, #2f3640, #1e272e)', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', color:'white', zIndex:9999}}>
            <div style={{textAlign:'center', marginBottom:'30px', animation:'fadeIn 1s'}}>
                <h3 style={{fontSize:'1.2rem', color:'#aaa', margin:0}}>JUGANDO A</h3>
                <h1 style={{fontSize:'2.5rem', color:'#f1c40f', margin:'10px 0'}}>{hoja}</h1>
                <h3 style={{fontSize:'1.2rem', color:'#aaa', margin:0}}>de <span style={{color:'#2ecc71'}}>{profesor}</span></h3>
                {instrucciones && (
                    <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', maxWidth:'80%', margin:'20px auto' }}>
                        <p style={{fontSize:'1.1rem', color:'#eee', fontStyle:'italic'}}>"{instrucciones}"</p>
                    </div>
                )}
            </div>
            <div style={{fontSize:'8rem', fontWeight:'bold', color: count===0?'#2ecc71':'white', animation:'popIn 0.5s'}}>{texto}</div>
            <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
}

function PantallaFin({ puntuacion, guardarRanking, guardando, esInvitado, alTerminar, playSound }) {
    useEffect(() => {
        playSound('WIN');
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;
        
        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            if(confetti) {
                confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount: 50, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }
        }, 250);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="card-menu">
            <h1>¡Juego Terminado!</h1>
            <h2 style={{color:'#f1c40f', fontSize:'4rem', margin:'20px 0'}}>{puntuacion} pts</h2>
            
            {esInvitado ? (
                <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '15px' }}>
                    <p style={{ color: '#eee', lineHeight: '1.5' }}>
                        Regístrate para <b>guardar tus resultados</b> y descubrir muchos más juegos.
                    </p>
                    <p style={{ color: 'white', fontWeight: 'bold' }}>¡Únete a LearnJoy!</p>
                </div>
            ) : (
                <button className="btn-success" onClick={guardarRanking} disabled={guardando}>
                    {guardando ? 'Guardando...' : '💾 GUARDAR RESULTADO'}
                </button>
            )}

            <button className="btn-back" onClick={alTerminar}>Salir</button>
            <EstilosComunes />
        </div>
    );
}

function EngineBurbujas({ recurso, modo, hoja, setPuntuacionTotal, onFinish, onExit, playSound }) {
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [puntos, setPuntos] = useState(0);
    const [tiempoBarra, setTiempoBarra] = useState(100);
    const [opcionesTest, setOpcionesTest] = useState([]);
    const [indiceFeedback, setIndiceFeedback] = useState(null);
    const [tipoFeedback, setTipoFeedback] = useState(null);
    const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
    const [avatarMood, setAvatarMood] = useState('neutral');

    const gameContainerRef = useRef(null);
    const bubblesRef = useRef([]);
    const animationRef = useRef(null);
    const timerRef = useRef(null);
    const preguntasJugables = useRef([]);
    const indiceActual = useRef(0);
    
    // BLOQUEO PARA EVITAR DOBLE CLICK Y SALTOS RAROS
    const bloqueoRef = useRef(false);

    // CONFIGURACIÓN DEL RECURSO
    const config = recurso.config || {};
    const tiempoMaximo = parseFloat(config.tiempoPregunta) || 20; 
    const puntosAcierto = parseInt(config.puntosAcierto) || 10;
    const puntosFallo = parseInt(config.puntosFallo) || 2;
    const maxPreguntas = parseInt(config.numPreguntas) || 10;

    useEffect(() => {
        setPuntuacionTotal(puntos);
    }, [puntos]);

    const triggerAvatar = (mood) => {
        setAvatarMood(mood);
        setTimeout(() => setAvatarMood('neutral'), 1500);
    };

    useEffect(() => {
        let pool = [];
        if (hoja === 'General') recurso.hojas?.forEach(h => pool.push(...h.preguntas));
        else { const hObj = recurso.hojas?.find(h => h.nombreHoja === hoja); if(hObj) pool = [...hObj.preguntas]; }
        pool.sort(() => Math.random() - 0.5);
        
        const limite = Math.min(pool.length, maxPreguntas);
        preguntasJugables.current = pool.slice(0, limite);
        indiceActual.current = 0;
        setProgreso({ actual: 1, total: preguntasJugables.current.length });
        
        cargarPregunta();
        return () => { cancelAnimationFrame(animationRef.current); clearInterval(timerRef.current); };
    }, []);

    const cargarPregunta = () => {
        if(gameContainerRef.current) gameContainerRef.current.innerHTML = '';
        bubblesRef.current = [];
        setIndiceFeedback(null); 
        setTipoFeedback(null);
        bloqueoRef.current = false; 

        if (indiceActual.current >= preguntasJugables.current.length) { onFinish(); return; }

        setProgreso({ actual: indiceActual.current + 1, total: preguntasJugables.current.length });

        const datos = preguntasJugables.current[indiceActual.current];
        setPreguntaActual(datos);
        
        if(timerRef.current) clearInterval(timerRef.current);
        setTiempoBarra(100);
        
        const decremento = 100 / (tiempoMaximo * 20); 
        
        timerRef.current = setInterval(() => {
            setTiempoBarra(prev => {
                if (prev <= 0) { 
                    clearInterval(timerRef.current); 
                    pasarSiguiente(false); 
                    return 0; 
                }
                return prev - decremento;
            });
        }, 50);

        let opciones = [{ txt: datos.correcta || datos.respuesta, ok: true }];
        const falsas = datos.incorrectas || ["Falso 1", "Falso 2", "Falso 3"];
        const num = modo === 'Burbujas' ? 5 : 3;
        falsas.slice(0, num).forEach(f => opciones.push({ txt: f, ok: false }));
        opciones.sort(() => Math.random() - 0.5);

        if (modo === 'Burbujas') { crearBurbujas(opciones); animar(); }
        else setOpcionesTest(opciones);
    };

    const pasarSiguiente = (esAcierto) => {
        if(bloqueoRef.current && !esAcierto) return; 
        bloqueoRef.current = true;
        clearInterval(timerRef.current);
        
        setTimeout(() => {
            indiceActual.current++; 
            cargarPregunta();
        }, 1000);
    };

    const clickBurbuja = (e, ok, el) => {
        e.preventDefault(); 
        e.stopPropagation();
        
        if (bloqueoRef.current) return; 

        if (ok) {
            bloqueoRef.current = true; 
            clearInterval(timerRef.current); 
            playSound('CORRECT');
            triggerAvatar('happy');
            setPuntos(p => p + puntosAcierto);
            
            if(el) { 
                el.style.transition = "transform 0.3s, opacity 0.3s";
                el.style.transform = "scale(1.5)"; 
                el.style.opacity = "0"; 
            }
            pasarSiguiente(true);
        } else {
            playSound('WRONG');
            triggerAvatar('angry');
            setPuntos(p => Math.max(0, p - puntosFallo));
            
            if(el) {
                el.style.transition = "transform 0.2s";
                el.style.transform = "scale(0)";
                bubblesRef.current = bubblesRef.current.filter(b => b.el !== el);
                setTimeout(() => el.remove(), 200);
            }
        }
    };

    const clickTest = (op, i) => {
        if(bloqueoRef.current || indiceFeedback !== null) return;
        
        clearInterval(timerRef.current);
        setIndiceFeedback(i);
        bloqueoRef.current = true;

        if(op.ok) {
            playSound('CORRECT');
            triggerAvatar('happy');
            setTipoFeedback('correct');
            setPuntos(p => p + puntosAcierto);
        } else {
            playSound('WRONG');
            triggerAvatar('angry');
            setTipoFeedback('incorrect');
            setPuntos(p => Math.max(0, p - puntosFallo));
        }
        setTimeout(() => pasarSiguiente(true), 1500);
    };

    const crearBurbujas = (opciones) => {
        const container = gameContainerRef.current; if(!container) return;
        const cols = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'];
        
        container.innerHTML = '';
        bubblesRef.current = [];

        opciones.forEach(op => {
            const el = document.createElement('div');
            const color = cols[Math.floor(Math.random()*6)];
            el.className = `shape-container ${color}`;
            el.innerHTML = `<span>${op.txt}</span>`;
            
            const sizeBase = Math.random() * 5 + 18; 
            el.style.width = `${sizeBase}vmin`; 
            el.style.height = `${sizeBase}vmin`;
            
            el.style.left = `${Math.random() * 80 + 5}%`; 
            el.style.top = `${Math.random() * 50 + 20}%`; 
            
            // CORREGIDO: USAR SOLO POINTERDOWN PARA UNIFICAR
            el.onpointerdown = (e) => clickBurbuja(e, op.ok, el);
            
            container.appendChild(el);
            
            bubblesRef.current.push({ 
                el, 
                x: parseFloat(el.style.left) || 50, 
                y: parseFloat(el.style.top) || 50,
                vx: (Math.random()-0.5) * 0.3, 
                vy: (Math.random()-0.5) * 0.3 
            });
        });
    };

    // CORRECCIÓN: ELIMINADA COMPROBACIÓN DE 'fase' QUE DABA ERROR
    const animar = () => {
        if(!gameContainerRef.current) return;

        bubblesRef.current.forEach(b => {
            b.x += b.vx; 
            b.y += b.vy;
            
            if(b.x <= 0 || b.x >= 85) b.vx *= -1; 
            if(b.y <= 15 || b.y >= 85) b.vy *= -1; 

            b.el.style.left = `${b.x}%`; 
            b.el.style.top = `${b.y}%`;
        });
        animationRef.current = requestAnimationFrame(animar);
    };

    return (
        <div style={{width:'100%', height:'100dvh', overflow:'hidden', position:'fixed', top:0, left:0, background:'radial-gradient(circle, #2f3640, #1e272e)'}}>
            <EstilosComunes />
            
            <div className="avatar-position-right">
                <ReactionAvatar mood={avatarMood} />
            </div>

            <div id="top-bar">
                <button className="btn-back-game" onClick={onExit}>Salir</button>
                <div id="timer-container"><div id="timer-bar" style={{width:`${tiempoBarra}%`, background: tiempoBarra<30?'#ff4757':'#2ecc71'}}></div></div>
                <div id="score-display">{puntos} pts</div>
                <div style={{color:'white', fontSize:'0.8rem'}}>Pregunta {progreso.actual} / {progreso.total}</div>
                <div id="question-text">{preguntaActual?.pregunta || '...'}</div>
            </div>
            
            {modo === 'Burbujas' ? (
                <div ref={gameContainerRef} style={{width:'100%', height:'100%', position:'relative', zIndex:10}} />
            ) : (
                <div id="test-area">
                    {opcionesTest.map((op, i) => (
                        <div key={i} className={`test-option ${indiceFeedback===i?tipoFeedback:''}`} onClick={()=>clickTest(op,i)}>{op.txt}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

const EstilosComunes = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@400;700&display=swap');
    .card-menu { background: rgba(0,0,0,0.6); padding: 30px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); margin: 50px auto; color: white; font-family: 'Roboto', sans-serif; position: relative; z-index: 100; }
    h1, h2 { font-family: 'Fredoka One'; margin: 0 0 20px 0; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
    .btn-burbujas, .btn-success, .btn-test, .btn-ranking { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-size: 1rem; }
    .btn-burbujas { color: white; background: #ff4757; }
    .btn-test { color: #2d3436; background: #2ed573; }
    .btn-success { color: #333; background: #2ecc71; }
    .btn-ranking { background: #8e44ad; color: white; }
    .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; }
    .btn-back-game { position: absolute; left: 10px; top: 10px; background: rgba(0,0,0,0.5); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer; z-index: 50; }
    
    #top-bar { position: absolute; top: 0; left: 0; width: 100%; height: 130px; background: rgba(0,0,0,0.85); z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; border-bottom: 2px solid #444; padding: 5px; box-sizing: border-box; }
    
    #timer-container { width: 90%; height: 8px; background: #555; border-radius: 5px; overflow: hidden; margin-bottom: 5px; }
    #timer-bar { height: 100%; transition: width 0.1s linear; }
    #score-display { font-family: 'Fredoka One'; font-size: 1.5rem; color: #f1c40f; }
    #question-text { font-size: clamp(1rem, 4vw, 1.3rem); max-width: 95%; text-align: center; color: #fff; margin-top: 5px; line-height: 1.2; font-weight: bold; font-family: 'Roboto'; }
    
    /* BURBUJAS */
    .shape-container { 
        position: absolute; 
        display: flex; align-items: center; justify-content: center; 
        text-align: center; 
        font-weight: bold; 
        font-size: clamp(0.7rem, 2.5vmin, 1.2rem); 
        cursor: pointer; 
        user-select: none; 
        color: white; 
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8); 
        box-shadow: inset -5px -5px 15px rgba(0,0,0,0.3), 2px 2px 5px rgba(0,0,0,0.3); 
        border: 2px solid rgba(255,255,255,0.3); 
        border-radius: 50%; 
        transition: transform 0.1s; 
        touch-action: none; 
    }
    .shape-container:active { transform: scale(0.95); }

    .c-1 { background: linear-gradient(135deg, #ff0055, #a30036); } .c-2 { background: linear-gradient(135deg, #00e600, #008000); } .c-3 { background: linear-gradient(135deg, #00ccff, #006680); } .c-4 { background: linear-gradient(135deg, #ffcc00, #cc9900); } .c-5 { background: linear-gradient(135deg, #9b59b6, #6c3483); } .c-6 { background: linear-gradient(135deg, #e67e22, #a0500d); }
    
    #test-area { position: absolute; top: 140px; width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; overflow-y: auto; height: calc(100% - 140px); }
    .test-option { background: white; width: 90%; max-width: 500px; padding: 15px; margin-bottom: 10px; border-radius: 10px; color: #333; font-weight: bold; cursor: pointer; border-left: 6px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: 0.2s; font-size: 1rem; }
    .test-option:active { transform: scale(0.98); background: #eee; }
    .correct { background: #2ecc71 !important; color: white !important; }
    .incorrect { background: #e74c3c !important; color: white !important; }
    .ranking-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; color:white; }
    .rank-pos { width: 30px; font-weight: bold; }
    .rank-name { flex: 1; text-align: left; }
    .rank-score { font-weight: bold; color: #f1c40f; }
    .personal-best { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid #f1c40f; color: #f1c40f; font-weight: bold; }
    
    .avatar-position-right { position: absolute; top: 135px; right: 10px; z-index: 50; pointer-events: none; }
    @media (max-width: 600px) { 
        .avatar-position-right { top: 140px; right: 5px; transform: scale(0.6); transform-origin: top right; } 
    }
    `}</style>
);