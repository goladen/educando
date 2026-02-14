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
// --- NUEVO: IMPORTAR FONDOS ---
import bg1 from './assets/pantalla5.jpeg';
import bg2 from './assets/pantalla2.jpeg';
import bg3 from './assets/pantalla3.jpeg';
import bg4 from './assets/pantalla4.jpeg';

const BACKGROUNDS = [bg1, bg2, bg3, bg4]; // Array para elegir al azar
const TICK_SOUND_URL = 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_73686360b7.mp3?filename=clock-ticking-2-106637.mp3';

// =================================================================================
//  GENERADOR DE OPERACIONES (MOTOR MATEMÁTICO)
// =================================================================================
// =================================================================================
//  GENERADOR DE OPERACIONES MEJORADO (LÓGICA EXACTA)
// =================================================================================
const generarPreguntasMatematicas = (config) => {
    const questions = [];
    const count = parseInt(config.mathCount || 0);
    if (count <= 0) return [];

    const types = config.mathTypes || ['POSITIVOS'];
    const ops = config.mathOps || ['SUMA'];
    const min = parseInt(config.mathMin || 1);
    const max = parseInt(config.mathMax || 10);

    // Función aleatoria uniforme pura
    const getRandomInt = (min, max) => {
        const minCeiled = Math.ceil(min);
        const maxFloored = Math.floor(max);
        return Math.floor(Math.random() * (maxFloored - minCeiled + 1)) + minCeiled;
    };

    const getRandomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(1);
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const simplify = (n, d) => { const common = gcd(Math.abs(n), Math.abs(d)); return { n: n / common, d: d / common }; };

    for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const op = ops[i % ops.length];
        let pObj = { pregunta: '', respuesta: '', incorrectas: [] };

        let isFraction = type === 'FRACCIONES';
        let isDecimal = type === 'DECIMALES';
        let isPositiveOnly = type === 'POSITIVOS';

        // --- CASO 1: FRACCIONES ---
        if (isFraction) {
            const n1 = getRandomInt(min, max); const d1 = getRandomInt(min, max);
            const n2 = getRandomInt(min, max); const d2 = getRandomInt(min, max);
            let resN, resD, symbol;

            if (op === 'SUMA') { symbol = '+'; resN = n1 * d2 + n2 * d1; resD = d1 * d2; }
            else if (op === 'RESTA') { symbol = '-'; resN = n1 * d2 - n2 * d1; resD = d1 * d2; }
            else if (op === 'MULT') { symbol = '·'; resN = n1 * n2; resD = d1 * d2; }
            else { symbol = ':'; resN = n1 * d2; resD = d1 * n2; }

            const s = simplify(resN, resD);
            if (s.d < 0) { s.n = -s.n; s.d = -s.d; } // Signo arriba

            pObj.pregunta = `${n1}/${d1} ${symbol} ${n2}/${d2}`;
            pObj.respuesta = `${s.n}/${s.d}`;
            pObj.incorrectas = [`${s.n + 1}/${s.d}`, `${s.n}/${s.d + 1}`, `${s.d}/${s.n}`].filter(x => x !== pObj.respuesta);
        }

        // --- CASO 2: DECIMALES (Aleatoriedad pura, sin reglas de orden) ---
        else if (isDecimal) {
            let a = parseFloat(getRandomFloat(min, max));
            let b = parseFloat(getRandomFloat(min, max));
            let res, symbol;

            if (op === 'SUMA') { symbol = '+'; res = a + b; }
            else if (op === 'RESTA') { symbol = '-'; res = a - b; }
            else if (op === 'MULT') { symbol = '·'; res = a * b; }
            else {
                symbol = ':';
                if (b === 0) b = 1;
                res = a / b;
            }

            // Redondear resultado y formatear
            res = parseFloat(res.toFixed(1));
            const format = (n) => String(n).replace('.', ',');

            pObj.pregunta = `${format(a)} ${symbol} ${format(b)}`;
            pObj.respuesta = format(res);
            pObj.incorrectas = [format((res + 0.1).toFixed(1)), format((res - 0.1).toFixed(1)), format((res + 1.1).toFixed(1))];
        }

        // --- CASO 3: ENTEROS (Positivos y Negativos) ---
        else {
            let num1 = getRandomInt(min, max);
            let num2 = getRandomInt(min, max);
            let res, symbol, enunciado;

            if (op === 'SUMA') {
                symbol = '+';
                res = num1 + num2;
                enunciado = `${num1} ${symbol} ${num2}`;
            }
            else if (op === 'RESTA') {
                symbol = '-';
                // REGLA: Si es POSITIVOS, ordenar Mayor - Menor
                if (isPositiveOnly) {
                    if (num2 > num1) [num1, num2] = [num2, num1]; // Swap
                }
                res = num1 - num2;
                enunciado = `${num1} ${symbol} ${num2}`;
            }
            else if (op === 'MULT') {
                symbol = '·';
                res = num1 * num2;
                enunciado = `${num1} ${symbol} ${num2}`;
            }
            else if (op === 'DIV') {
                symbol = ':';
                // REGLA: Construir división exacta
                // Elegimos dos números (divisor y cociente)
                let divisor = num1;
                if (divisor === 0) divisor = 1; // Evitar dividir por 0
                let cociente = num2;

                // Calculamos el dividendo
                let dividendo = divisor * cociente;

                // La pregunta es: Dividendo : Divisor = ¿Cociente?
                enunciado = `${dividendo} ${symbol} ${divisor}`;
                res = cociente;
            }

            // Formatear paréntesis para negativos si es necesario (ej: 5 + (-3))
            // En la división generada, 'divisor' es el segundo término visualmente
            if (op !== 'DIV' && num2 < 0) enunciado = `${num1} ${symbol} (${num2})`;
            if (op === 'DIV' && num1 < 0) enunciado = `${num1 * num2} ${symbol} (${num1})`; // Ajuste visual si usamos variables internas

            pObj.pregunta = enunciado;
            pObj.respuesta = String(res);

            // Generar incorrectas (enteros cercanos)
            pObj.incorrectas = [
                String(res + 1),
                String(res - 1),
                String(res + getRandomInt(2, 5))
            ].filter(x => x !== String(res));
        }

        questions.push(pObj);
    }
    return questions;
};





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

    const guardarRanking = async (nombreInvitado = null) => {
        // Permitimos guardar si es usuario registrado O si es invitado y ha puesto nombre
        if (guardando) return;

        const nombreFinal = esInvitado ? nombreInvitado : (usuario.displayName || "Anónimo");
        const emailFinal = esInvitado ? 'invitado' : usuario.email;

        if (!nombreFinal) return alert("Error: Nombre necesario.");

        setGuardando(true);
        try {
            const rankingRef = collection(db, 'ranking');

            // Calcular Ranking Global para mostrar la medalla
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

            // Lógica diferente: Invitado siempre crea nueva entrada. Usuario actualiza la suya.
            if (esInvitado) {
                await addDoc(rankingRef, {
                    recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'CAZABURBUJAS', juego: 'CazaBurbujas',
                    modo: modo, categoria: hojaSeleccionada, email: 'invitado', jugador: nombreFinal,
                    aciertos: puntuacion, fecha: new Date(), medalla: medallaCalc
                });
                alert(`¡Puntuación Guardada como ${nombreFinal}! Posición #${rank} 🚀`);
            } else {
                // Lógica de usuario registrado (busca si ya existe para actualizar)
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
                        modo: modo, categoria: hojaSeleccionada, email: usuario.email, jugador: nombreFinal,
                        aciertos: puntuacion, fecha: new Date(), medalla: medallaCalc
                    });
                    alert(`Puntuación Guardada. Posición #${rank} 🚀`);
                }
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
    const [nombreInvitado, setNombreInvitado] = useState('');

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

    const handleGuardarInvitado = () => {
        if (nombreInvitado.trim().length === 0) return alert("Escribe un nombre");
        guardarRanking(nombreInvitado); // Pasamos el nombre a la función principal
    };

    return (
        <div className="card-menu">
            <h1>¡Juego Terminado!</h1>
            <h2 style={{ color: '#f1c40f', fontSize: '4rem', margin: '20px 0' }}>{puntuacion} pts</h2>

            {esInvitado ? (
                <div style={{ margin: '20px 0', padding: '20px', background: 'rgba(255,255,255,0.15)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.3)' }}>
                    <p style={{ color: '#eee', marginBottom: '10px' }}>Introduce tu nombre para el ranking:</p>
                    <input
                        type="text"
                        placeholder="Tu Nombre"
                        value={nombreInvitado}
                        onChange={(e) => setNombreInvitado(e.target.value)}
                        maxLength={15}
                        style={{ padding: '10px', borderRadius: '5px', border: 'none', width: '80%', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '15px' }}
                    />
                    <button className="btn-success" onClick={handleGuardarInvitado} disabled={guardando}>
                        {guardando ? 'Guardando...' : '💾 GUARDAR EN RANKING'}
                    </button>
                </div>
            ) : (
                    <button className="btn-success" onClick={() => guardarRanking()} disabled={guardando}>
                        {guardando ? 'Guardando...' : '💾 GUARDAR RESULTADO'}
                    </button>
                )}

            <button className="btn-back" onClick={alTerminar}>Salir</button>
            <EstilosComunes />
        </div>
    );
}

function EngineBurbujas({ recurso, modo, hoja, setPuntuacionTotal, onFinish, onExit, playSound }) {
    const [preguntaActualState, setPreguntaActualState] = useState(null); // Solo para renderizar texto
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

    // USAMOS REF PARA ACCESO INMEDIATO EN LOS CLICKS (Evita el error null)
    const preguntaActualRef = useRef(null);

    const bloqueoRef = useRef(false);

    const config = recurso.config || {};
    const tiempoMaximo = parseFloat(config.tiempoPregunta) || 20;
    const puntosAcierto = parseInt(config.puntosAcierto) || 10;
    const puntosFallo = parseInt(config.puntosFallo) || 2;
    const maxPreguntas = (config.numPreguntas !== undefined && config.numPreguntas !== "")
        ? parseInt(config.numPreguntas)
        : 10;

    // VELOCIDADES AJUSTADAS (Un poco más suaves)
    const VELOCIDADES = {
        'LENTO': 0.10,
        'MODERADO': 0.25,
        'RAPIDO': 0.45
    };

    const [bgImage, setBgImage] = useState('');

    // 1. Efecto SOLO PARA EL FONDO (Se ejecuta una única vez al empezar)
    useEffect(() => {
        const randomBg = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
        setBgImage(randomBg);
    }, []); // Array vacío = Solo al montar

    // 2. Efecto SOLO PARA LOS PUNTOS (Se ejecuta cada vez que cambia 'puntos')
    useEffect(() => {
        setPuntuacionTotal(puntos);
    }, [puntos]);

    const triggerAvatar = (mood) => {
        setAvatarMood(mood);
        setTimeout(() => setAvatarMood('neutral'), 1500);
    };

    // --- CARGA INICIAL ---
    useEffect(() => {
        let pool = [];
        let hojasAProcesar = [];

        if (hoja === 'General') {
            hojasAProcesar = recurso.hojas || [];
        } else {
            const hObj = recurso.hojas?.find(h => h.nombreHoja === hoja);
            if (hObj) hojasAProcesar = [hObj];
        }

        hojasAProcesar.forEach(h => {
            // A) Manuales
            let manuales = [...(h.preguntas || [])];
            manuales.sort(() => Math.random() - 0.5);
            if (manuales.length > maxPreguntas) {
                manuales = manuales.slice(0, maxPreguntas);
            }

            // B) Generador
            let generadas = [];
            if (recurso.tipo === 'PRO-BURBUJAS' || config.mathCount > 0) {
                const configGen = h.mathConfig || config;
                // Nota: Asegúrate de que generarPreguntasMatematicas está definida fuera
                generadas = generarPreguntasMatematicas(configGen);
            }

            pool.push(...manuales, ...generadas);

            // C) Pregunta Especial
            if (h.preguntaEspecial && h.preguntaEspecial.activo) {
                pool.push({
                    esEspecial: true,
                    pregunta: h.preguntaEspecial.enunciado,
                    correctas: h.preguntaEspecial.correctas,
                    incorrectas: h.preguntaEspecial.incorrectas,
                    tiempoExtra: 10
                });
            }
        });

        pool.sort(() => Math.random() - 0.5);

        preguntasJugables.current = pool;
        indiceActual.current = 0;
        setProgreso({ actual: 1, total: preguntasJugables.current.length });

        cargarPregunta();

        // Limpieza al salir
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // --- CARGAR PREGUNTA ---
    const cargarPregunta = () => {
        // 1. LIMPIEZA CRÍTICA (Evita que la velocidad se dispare)
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (gameContainerRef.current) gameContainerRef.current.innerHTML = '';

        bubblesRef.current = [];
        setIndiceFeedback(null);
        setTipoFeedback(null);
        bloqueoRef.current = false;

        if (indiceActual.current >= preguntasJugables.current.length) { onFinish(); return; }

        setProgreso({ actual: indiceActual.current + 1, total: preguntasJugables.current.length });

        const datos = preguntasJugables.current[indiceActual.current];

        // ACTUALIZAMOS REF Y STATE
        preguntaActualRef.current = datos;
        setPreguntaActualState(datos);

        if (timerRef.current) clearInterval(timerRef.current);
        setTiempoBarra(100);

        const tiempoBase = datos.esEspecial ? (tiempoMaximo * 1.5) : tiempoMaximo;
        const decremento = 100 / (tiempoBase * 20);

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

        let opciones = [];

        if (datos.esEspecial) {
            datos.correctas.forEach(txt => opciones.push({ txt, ok: true }));
            datos.incorrectas.forEach(txt => opciones.push({ txt, ok: false }));
        } else {
            opciones = [{ txt: datos.correcta || datos.respuesta, ok: true }];
            const falsas = datos.incorrectas || ["Error 1", "Error 2", "Error 3"];
            const num = modo === 'Burbujas' ? 5 : 3;
            const falsasMezcladas = [...falsas].sort(() => Math.random() - 0.5);
            falsasMezcladas.slice(0, num).forEach(f => opciones.push({ txt: f, ok: false }));
        }

        opciones.sort(() => Math.random() - 0.5);

        if (modo === 'Burbujas') {
            crearBurbujas(opciones);
            animar(); // Inicia el bucle nuevo
        }
        else setOpcionesTest(opciones);
    };

    const pasarSiguiente = (esAcierto) => {
        const esEspecial = preguntaActualRef.current?.esEspecial;

        // En normal bloqueamos tras fallo/acierto. En especial solo por tiempo.
        if (bloqueoRef.current && !esAcierto && !esEspecial) return;

        bloqueoRef.current = true;
        clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);

        setTimeout(() => {
            indiceActual.current++;
            cargarPregunta();
        }, 1000);
    };

    const clickBurbuja = (e, ok, el) => {
        e.preventDefault();
        e.stopPropagation();

        // USAMOS LA REF PARA LEER EL ESTADO ACTUAL SIN ERRORES
        const datosActuales = preguntaActualRef.current;
        if (!datosActuales) return;

        const esEspecial = datosActuales.esEspecial;

        if (bloqueoRef.current && !esEspecial) return;

        if (ok) {
            playSound('CORRECT');
            triggerAvatar('happy');

            if (esEspecial) {
                setPuntos(p => p + 1);
            } else {
                setPuntos(p => p + puntosAcierto);
                bloqueoRef.current = true;
                clearInterval(timerRef.current);
            }

            if (el) {
                el.style.transition = "transform 0.3s, opacity 0.3s";
                el.style.transform = "scale(1.5)";
                el.style.opacity = "0";
                const bubbleData = bubblesRef.current.find(b => b.el === el);
                if (bubbleData) bubbleData.eliminada = true;
            }

            if (esEspecial) {
                // Comprobar si quedan correctas
                const quedanCorrectas = bubblesRef.current.some(b => b.esCorrecta && !b.eliminada);
                if (!quedanCorrectas) pasarSiguiente(true);
            } else {
                pasarSiguiente(true);
            }

        } else {
            playSound('WRONG');
            triggerAvatar('angry');

            if (esEspecial) {
                setPuntos(p => Math.max(0, p - 1));
            } else {
                setPuntos(p => Math.max(0, p - puntosFallo));
            }

            if (el) {
                el.style.transition = "transform 0.2s";
                el.style.transform = "scale(0)";
                const bubbleData = bubblesRef.current.find(b => b.el === el);
                if (bubbleData) bubbleData.eliminada = true;
                setTimeout(() => el.remove(), 200);
            }
        }
    };

    const clickTest = (op, i) => {
        if (bloqueoRef.current || indiceFeedback !== null) return;

        clearInterval(timerRef.current);
        setIndiceFeedback(i);
        bloqueoRef.current = true;

        if (op.ok) {
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
        const container = gameContainerRef.current; if (!container) return;
        const cols = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'];

        container.innerHTML = '';
        bubblesRef.current = [];

        const velocidadBase = VELOCIDADES[config.velocidad] || 0.25;

        // Ajustamos tamaño base según dispositivo (menor en móvil)
        const isMobile = window.innerWidth < 600;
        const baseSizeVmin = isMobile ? 18 : 14;

        opciones.forEach(op => {
            const el = document.createElement('div');
            const color = cols[Math.floor(Math.random() * 6)];
            el.className = `shape-container ${color}`;
            el.innerHTML = `<span>${op.txt}</span>`;

            // Tamaño dinámico (vmin asegura que no sea gigante en monitores wide)
            const randomSize = Math.random() * 4 + baseSizeVmin;
            el.style.width = `${randomSize}vmin`;
            el.style.height = `${randomSize}vmin`;

            // --- CORRECCIÓN DE POSICIÓN ---
            // Left: entre 5% y 85% (evita cortes laterales)
            el.style.left = `${Math.random() * 80 + 5}%`;

            // Top: IMPORTANTE. Empezar en 20% (debajo de barra) y acabar en 80%
            // Esto evita que salgan tapadas por la barra superior
            el.style.top = `${Math.random() * 60 + 20}%`;

            el.onpointerdown = (e) => clickBurbuja(e, op.ok, el);

            container.appendChild(el);

            const dirX = Math.random() < 0.5 ? -1 : 1;
            const dirY = Math.random() < 0.5 ? -1 : 1;
            const variation = Math.random() * 0.15;

            bubblesRef.current.push({
                el,
                esCorrecta: op.ok,
                x: parseFloat(el.style.left) || 50,
                y: parseFloat(el.style.top) || 50,
                vx: (variation + velocidadBase) * dirX,
                vy: (variation + velocidadBase) * dirY
            });
        });
    };

    const animar = () => {
        if (!gameContainerRef.current) return;

        bubblesRef.current.forEach(b => {
            if (b.eliminada) return;

            b.x += b.vx;
            b.y += b.vy;

            // REBOTE LATERAL (0% a 90% aprox dependiendo del ancho burbuja)
            if (b.x <= 0 || b.x >= 85) b.vx *= -1;

            // REBOTE VERTICAL (IMPORTANTE: 18% para no tocar la barra, 85% para no tocar fondo)
            if (b.y <= 18 || b.y >= 85) b.vy *= -1;

            b.el.style.left = `${b.x}%`;
            b.el.style.top = `${b.y}%`;
        });

        animationRef.current = requestAnimationFrame(animar);
    };

    return (
        <div style={{
            width: '100%',
            height: '100dvh',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0,
            // CORRECCIÓN: Usar propiedades separadas en lugar de 'background' shorthand
            backgroundImage: `url(${bgImage})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover', // Ahora sí funcionará y cubrirá todo
            backgroundColor: '#2f3640' // Color de respaldo por si tarda en cargar
        }}>
            {/* Capa oscura para mejorar legibilidad */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', zIndex: 0 }}></div>

            <EstilosComunes />

            <div className="avatar-position-right" style={{ zIndex: 50 }}>
                <ReactionAvatar mood={avatarMood} />
            </div>

            <div id="top-bar" style={{ zIndex: 20 }}>
                <button className="btn-back-game" onClick={onExit}>Salir</button>
                <div id="timer-container"><div id="timer-bar" style={{ width: `${tiempoBarra}%`, background: tiempoBarra < 30 ? '#ff4757' : '#2ecc71' }}></div></div>
                <div id="score-display">{puntos} pts</div>
                <div style={{ color: 'white', fontSize: '0.8rem' }}>Pregunta {progreso.actual} / {progreso.total}</div>
                <div id="question-text">{preguntaActualState?.pregunta || '...'}</div>
            </div>

            {modo === 'Burbujas' ? (
                <div ref={gameContainerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 10 }} />
            ) : (
                    <div id="test-area" style={{ zIndex: 10 }}>
                        {opcionesTest.map((op, i) => (
                            <div key={i} className={`test-option ${indiceFeedback === i ? tipoFeedback : ''}`} onClick={() => clickTest(op, i)}>{op.txt}</div>
                        ))}
                    </div>
                )}
        </div>
    );
}
const EstilosComunes = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@400;700&display=swap');
    
    /* BLOQUEAR SELECCIÓN DE TEXTO (Mejora experiencia táctil) */
    * { user-select: none; -webkit-user-select: none; touch-action: manipulation; }

    .card-menu { 
        background: rgba(0,0,0,0.7); 
        padding: 20px; 
        border-radius: 20px; 
        width: 90%; 
        max-width: 400px; 
        text-align: center; 
        backdrop-filter: blur(10px); 
        border: 1px solid rgba(255,255,255,0.1); 
        margin: auto; 
        color: white; 
        font-family: 'Roboto', sans-serif; 
        position: absolute; 
        top: 50%; left: 50%; 
        transform: translate(-50%, -50%); /* Centrado perfecto */
        z-index: 100; 
        max-height: 90vh;
        overflow-y: auto;
    }

    h1 { font-size: clamp(1.5rem, 5vw, 2.5rem); font-family: 'Fredoka One'; margin: 0 0 15px 0; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
    h2 { font-size: clamp(1rem, 4vw, 1.5rem); font-family: 'Fredoka One'; margin: 0 0 15px 0; color: #f1c40f; }

    .btn-burbujas, .btn-success, .btn-test, .btn-ranking { width: 100%; padding: 12px; border: none; border-radius: 15px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-size: 1rem; box-shadow: 0 4px 0 rgba(0,0,0,0.2); transition: transform 0.1s; }
    .btn-burbujas:active, .btn-success:active, .btn-test:active { transform: translateY(2px); box-shadow: none; }
    
    .btn-burbujas { color: white; background: #ff4757; }
    .btn-test { color: #2d3436; background: #2ed573; }
    .btn-success { color: #333; background: #2ecc71; }
    .btn-ranking { background: #8e44ad; color: white; }
    .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; }
    
    .btn-back-game { position: absolute; left: 10px; top: 10px; background: rgba(0,0,0,0.5); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer; z-index: 50; font-size: 0.8rem; }
    
    /* BARRA SUPERIOR RESPONSIVA */
    #top-bar { 
        position: absolute; top: 0; left: 0; width: 100%; 
        height: 15vh; /* Altura dinámica */
        min-height: 80px; max-height: 130px;
        background: rgba(0,0,0,0.85); 
        z-index: 20; 
        display: flex; flex-direction: column; 
        align-items: center; justify-content: center; 
        border-bottom: 2px solid #444; 
        padding: 5px; box-sizing: border-box; 
    }
    
    #timer-container { width: 90%; height: 6px; background: #555; border-radius: 5px; overflow: hidden; margin-bottom: 5px; }
    #timer-bar { height: 100%; transition: width 0.1s linear; }
    
    #score-display { font-family: 'Fredoka One'; font-size: clamp(1.2rem, 4vw, 1.8rem); color: #f1c40f; }
    
    #question-text { 
        font-size: clamp(0.9rem, 3.5vw, 1.4rem); /* Texto que escala */
        max-width: 90%; 
        text-align: center; 
        color: #fff; 
        margin-top: 2px; 
        line-height: 1.1; 
        font-weight: bold; 
        font-family: 'Roboto';
        display: -webkit-box;
        -webkit-line-clamp: 2; /* Máximo 2 líneas */
        -webkit-box-orient: vertical;
        overflow: hidden; 
    }
    
    /* BURBUJAS */
    .shape-container { 
        position: absolute; 
        display: flex; align-items: center; justify-content: center; 
        text-align: center; 
        font-weight: bold; 
        font-size: clamp(0.8rem, 3vw, 1.5rem); 
        cursor: pointer; 
        color: white; 
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8); 
        box-shadow: inset -5px -5px 15px rgba(0,0,0,0.3), 2px 2px 5px rgba(0,0,0,0.3); 
        border: 2px solid rgba(255,255,255,0.4); 
        border-radius: 50%; 
        touch-action: none; 
    }
    
    .c-1 { background: radial-gradient(circle at 30% 30%, #ff4757, #a30036); } 
    .c-2 { background: radial-gradient(circle at 30% 30%, #2ecc71, #008000); } 
    .c-3 { background: radial-gradient(circle at 30% 30%, #00d2d3, #006680); } 
    .c-4 { background: radial-gradient(circle at 30% 30%, #ffa502, #cc9900); } 
    .c-5 { background: radial-gradient(circle at 30% 30%, #a29bfe, #6c3483); } 
    .c-6 { background: radial-gradient(circle at 30% 30%, #ff6b81, #c0392b); }
    
    /* MODO TEST RESPONSIVO */
    #test-area { 
        position: absolute; top: 16vh; /* Justo debajo del top-bar */
        width: 100%; 
        display: flex; flex-direction: column; align-items: center; 
        padding-bottom: 20px; overflow-y: auto; 
        height: 84vh; 
    }
    .test-option { background: white; width: 90%; max-width: 500px; padding: 15px; margin-bottom: 10px; border-radius: 10px; color: #333; font-weight: bold; cursor: pointer; border-left: 6px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.2); font-size: 1rem; }
    
    .ranking-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; color:white; }
    .personal-best { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid #f1c40f; color: #f1c40f; font-weight: bold; }
    
    /* AVATAR RESPONSIVO */
    .avatar-position-right { 
        position: absolute; 
        top: 16vh; /* Debajo de la barra siempre */
        right: 10px; 
        z-index: 50; 
        pointer-events: none; 
        transform-origin: top right;
    }
    
    /* MÓVILES (Pantallas pequeñas) */
    @media (max-width: 600px) { 
        .avatar-position-right { transform: scale(0.6); right: 5px; } 
        #question-text { font-size: 0.95rem; }
        .btn-back-game { padding: 4px 8px; font-size: 0.7rem; top: 5px; left: 5px; }
    }

    /* MODO PAISAJE (Móvil horizontal) - Reducir barra */
    @media (max-height: 500px) {
        #top-bar { height: 20vh; min-height: 60px; flex-direction: row; gap: 10px; justify-content: space-around; }
        #question-text { font-size: 0.9rem; max-width: 50%; -webkit-line-clamp: 1; }
        #timer-container { width: 20%; position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; border-radius: 0; }
        .btn-back-game { position: static; }
        .avatar-position-right { transform: scale(0.5); top: 22vh; }
        #test-area { top: 22vh; height: 78vh; }
    }
    `}</style>
);