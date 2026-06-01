import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, addDoc, updateDoc, onSnapshot, increment, collection, writeBatch, deleteField } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { Users, Play, Send, Save, CheckCircle, XCircle, Medal, Trophy, Loader, ArrowUp, X } from 'lucide-react';

// --- AUDIOS ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import startSoundFile from './assets/inicio-juego.mp3';

// --- IMÁGENES DEL AVATAR ---
import piHappy from './assets/Pi-contento.png';
import piAngry from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';

// --- AUDIOS (PRE-CARGADOS) ---
const _mkAudio = src => { let a; return { get currentTime(){ return a?.currentTime??0; }, set currentTime(v){ (a??=new Audio(src)).currentTime=v; }, play(){ return (a??=new Audio(src)).play(); } }; };
const audioCorrect = _mkAudio(correctSoundFile);
const audioWrong   = _mkAudio(wrongSoundFile);
const audioWin     = _mkAudio(winSoundFile);
const audioStart   = _mkAudio(startSoundFile);
const safePlay = (ao) => { ao.currentTime = 0; ao.play().catch(() => {}); };

// --- BANCO DE PALABRAS ---
const PALABRAS_EAE = [
    { p: 'MARIPOSA',   t: ['insecto', 'volar', 'alas', 'oruga', 'flor'] },
    { p: 'SUBMARINO',  t: ['barco', 'agua', 'mar', 'nadar', 'hundirse'] },
    { p: 'VOLCÁN',     t: ['lava', 'erupción', 'fuego', 'montaña', 'humo'] },
    { p: 'ASTRONAUTA', t: ['espacio', 'cohete', 'luna', 'traje', 'gravedad'] },
    { p: 'BIBLIOTECA', t: ['libro', 'leer', 'silencio', 'estante', 'estudiar'] },
    { p: 'DINOSAURIO', t: ['prehistórico', 'extinto', 'grande', 'reptil', 'fósil'] },
    { p: 'ARCOÍRIS',   t: ['color', 'lluvia', 'sol', 'cielo', 'arco'] },
    { p: 'PIRÁMIDE',   t: ['Egipto', 'faraón', 'triángulo', 'momia', 'arena'] },
    { p: 'SOMBRERO',   t: ['cabeza', 'llevar', 'ponerse', 'hat', 'ropa'] },
    { p: 'TELÉFONO',   t: ['llamar', 'hablar', 'móvil', 'marcar', 'ring'] },
    { p: 'ELEFANTE',   t: ['trompa', 'grande', 'gris', 'África', 'animal'] },
    { p: 'BICICLETA',  t: ['rueda', 'pedalear', 'montar', 'velocidad', 'transporte'] },
    { p: 'GUITARRA',   t: ['música', 'instrumento', 'cuerda', 'tocar', 'cantar'] },
    { p: 'PINGÜINO',   t: ['polo', 'frío', 'nieve', 'ave', 'nadar'] },
    { p: 'CASTILLO',   t: ['rey', 'piedra', 'medieval', 'princesa', 'torre'] },
    { p: 'SEMÁFORO',   t: ['tráfico', 'rojo', 'verde', 'calle', 'luz'] },
    { p: 'PARAGUAS',   t: ['lluvia', 'mojarse', 'abrirse', 'agua', 'proteger'] },
    { p: 'RELOJ',      t: ['tiempo', 'hora', 'minuto', 'segundero', 'manecilla'] },
    { p: 'GLOBO',      t: ['inflar', 'redondo', 'volar', 'fiesta', 'helio'] },
    { p: 'LABERINTO',  t: ['camino', 'perderse', 'salida', 'ruta', 'girar'] },
    { p: 'CARACOL',    t: ['concha', 'lento', 'babosa', 'animal', 'molusco'] },
    { p: 'COHETE',     t: ['espacio', 'lanzar', 'velocidad', 'astronauta', 'nave'] },
    { p: 'TORMENTA',   t: ['lluvia', 'trueno', 'rayo', 'viento', 'nube'] },
    { p: 'ESPEJO',     t: ['reflejo', 'mirar', 'cristal', 'imagen', 'verse'] },
    { p: 'TORTUGA',    t: ['lento', 'concha', 'animal', 'reptil', 'caparazón'] },
    { p: 'DRAGÓN',     t: ['fuego', 'volar', 'escamas', 'mito', 'fantástico'] },
    { p: 'FARO',       t: ['luz', 'barco', 'costa', 'noche', 'señal'] },
    { p: 'ESCALERA',   t: ['subir', 'peldaño', 'bajar', 'arriba', 'piso'] },
    { p: 'CARNAVAL',   t: ['fiesta', 'disfraz', 'máscara', 'desfile', 'bailar'] },
    { p: 'BRÚJULA',    t: ['norte', 'orientar', 'dirección', 'navegar', 'perder'] },
    { p: 'CUEVA',      t: ['oscuro', 'piedra', 'murciélago', 'entrar', 'profundo'] },
    { p: 'TIBURÓN',    t: ['mar', 'pez', 'nadar', 'dientes', 'agua'] },
    { p: 'PARACAÍDAS', t: ['saltar', 'avión', 'volar', 'caer', 'paracaidista'] },
    { p: 'MICROSCOPIO',t: ['ver', 'pequeño', 'ciencia', 'laboratorio', 'lente'] },
];

// --- UTILIDADES ---
const clean = (s) => s ? String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() : "";

const detectarTabu = (texto, tabues) => {
    if (!texto || !tabues?.length) return null;
    const palabras = clean(texto).split(/\s+/).filter(w => w.length >= 3);
    for (const w of palabras) {
        for (const t of tabues) {
            const root = clean(t).substring(0, Math.min(4, clean(t).length));
            if (root.length >= 3 && w.length >= root.length && w.substring(0, root.length) === root) {
                return t;
            }
        }
    }
    return null;
};

const calcPuntosGuesser = (timestamp, startTime, tiempoTotal) => {
    const elapsed = Math.max(0, (timestamp - startTime) / 1000);
    const factor = Math.max(0, Math.min(1, (tiempoTotal - elapsed) / tiempoTotal));
    return Math.round(20 + 80 * factor); // 100 pts at t=0, 20 pts at t=end
};

// ============================================================================
// HELPER: Prepara los datos de la próxima ronda (ganador, palabra, modo)
// ============================================================================
const COLORES_RULETA_EAE = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#e91e63'];

function prepararDatosRonda(data) {
    const lista       = Object.values(data.jugadores || {});
    const usados      = data.anfitrionesUsados || [];
    const disponibles = lista.filter(j => !usados.includes(j.uid));
    if (disponibles.length === 0) return null;

    const anfitrion  = disponibles[Math.floor(Math.random() * disponibles.length)];
    const usadas     = data.palabrasUsadas || [];
    const pool       = PALABRAS_EAE.filter(pw => !usadas.includes(pw.p));
    const banco      = pool.length > 0 ? pool : PALABRAS_EAE;
    const entrada    = banco[Math.floor(Math.random() * banco.length)];
    const modoConf   = data.modoJuego;
    // MIXTO: alterna estrictamente en vez de aleatorio
    const modo       = modoConf === 'DIBUJAR'  ? 'DIBUJAR'
                     : modoConf === 'DESCRIBIR' ? 'DESCRIBIR'
                     : (data.ultimoModo === 'DIBUJAR' ? 'DESCRIBIR' : 'DIBUJAR');

    return {
        disponiblesNombres: disponibles.map(j => j.nombre),
        ganadorIndex:       disponibles.findIndex(j => j.uid === anfitrion.uid),
        rondaData: {
            anfitrionUid:      anfitrion.uid,
            anfitrionNombre:   anfitrion.nombre,
            modoRonda:         modo,
            palabraSecreta:    entrada.p,
            palabrasTabu:      modo === 'DESCRIBIR' ? entrada.t : [],
            anfitrionesUsados: [...usados, anfitrion.uid],
            palabrasUsadas:    [...usadas, entrada.p],
            rondaActual:       (data.rondaActual || 0) + 1,
            ultimoModo:        modo,
        },
    };
}

// ============================================================================
// RULETA: Overlay animado que gira y aterriza en el ganador preelegido
// ============================================================================
function RuletaEAE({ disponibles, ganadorIndex }) {
    const canvasRef = useRef(null);
    const [rotacion, setRotacion] = useState(0);
    const [mostrarGanador, setMostrarGanador] = useState(false);

    const dibujar = () => {
        const canvas = canvasRef.current;
        if (!canvas || !disponibles.length) return;
        const ctx  = canvas.getContext('2d');
        const S    = canvas.width;
        const c    = S / 2;
        const r    = c - 8;
        const n    = disponibles.length;
        const ang  = (2 * Math.PI) / n;
        ctx.clearRect(0, 0, S, S);
        for (let i = 0; i < n; i++) {
            const a0 = i * ang, a1 = a0 + ang;
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.arc(c, c, r, a0, a1);
            ctx.fillStyle = COLORES_RULETA_EAE[i % COLORES_RULETA_EAE.length];
            ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.save();
            ctx.translate(c, c);
            ctx.rotate(a0 + ang / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            const fs = Math.max(9, Math.min(18, 110 / n));
            ctx.font = `bold ${fs}px Arial`;
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
            const txt = disponibles[i].length > 11 ? disponibles[i].slice(0, 10) + '…' : disponibles[i];
            ctx.fillText(txt, r - 12, fs * 0.38);
            ctx.restore();
        }
    };

    useEffect(() => { dibujar(); }, [disponibles]);

    useEffect(() => {
        const t = setTimeout(() => {
            const n   = disponibles.length;
            const ang = 360 / n;
            // Queremos que la sección de ganadorIndex quede en el puntero (derecha = 0°)
            const centerOfSection = (ganadorIndex + 0.5) * ang;
            const target = (360 - centerOfSection % 360 + 360) % 360;
            const cur    = rotacion % 360;
            let delta    = target - cur;
            if (delta < 0) delta += 360;
            const newRot = rotacion + 5 * 360 + delta;
            setRotacion(newRot);
            setTimeout(() => setMostrarGanador(true), 4300);
        }, 600);
        return () => clearTimeout(t);
    }, []); // solo al montar

    const SZ = Math.min(300, (typeof window !== 'undefined' ? window.innerWidth : 400) - 60);

    return (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.93)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <h2 style={{ color:'#f1c40f', fontFamily:"'Righteous',sans-serif", marginBottom:20, fontSize:'1.6rem', textAlign:'center' }}>
                🎡 ¿Quién es el siguiente?
            </h2>
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {/* Puntero derecha */}
                <div style={{ position:'absolute', right:-22, top:'50%', transform:'translateY(-50%)', width:0, height:0, borderTop:'16px solid transparent', borderBottom:'16px solid transparent', borderRight:'32px solid #f1c40f', zIndex:10 }} />
                <div style={{ width:SZ, height:SZ, borderRadius:'50%', overflow:'hidden', border:'5px solid #f1c40f', boxShadow:'0 0 30px rgba(241,196,15,0.5)' }}>
                    <canvas ref={canvasRef} width={SZ} height={SZ}
                        style={{ transform:`rotate(${rotacion}deg)`, transition:'transform 4s cubic-bezier(0.2,0.8,0.2,1)', display:'block' }} />
                </div>
            </div>
            {mostrarGanador && disponibles[ganadorIndex] && (
                <div style={{ marginTop:24, background:'#f1c40f', padding:'16px 40px', borderRadius:16, color:'#1a1a2e', fontSize:'2rem', fontWeight:'bold', animation:'pop 0.4s', textAlign:'center', border:'4px solid #e67e22', boxShadow:'0 8px 25px rgba(241,196,15,0.4)' }}>
                    🎭 {disponibles[ganadorIndex]}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MAIN EXPORT — DISPATCHER
// ============================================================================
export default function ExpresionArtEscri(props) {
    if (props.isHost) return <EAEHost {...props} />;
    if (props.codigoSala) return <EAEClient {...props} />;
    return (
        <div style={{ color: 'white', padding: 40, textAlign: 'center' }}>
            <h2>🎨 ExpresionArt & Escri</h2>
            <p>Este juego solo está disponible en modo sala en vivo.</p>
        </div>
    );
}

// ============================================================================
// 1. HOST (PROFESOR)
// ============================================================================
function EAEHost({ codigoSala, onExit, usuario }) {
    const [gameData, setGameData]         = useState(null);
    const [jugadores, setJugadores]       = useState([]);
    const [faseHost, setFaseHost]         = useState('LOBBY');
    const [faseRonda, setFaseRonda]       = useState('JUGANDO');
    const [timerVisual, setTimerVisual]   = useState(0);
    const [cargando, setCargando]         = useState(false);
    const [guardandoGlobal, setGuardandoGlobal] = useState(false);
    const [enviandoInforme, setEnviandoInforme] = useState(false);
    const [informeEnviado, setInformeEnviado]   = useState(false);

    const timerRef           = useRef(null);
    const gameDataRef        = useRef(null);
    const terminarInProgress = useRef(false);
    const pingIdRef          = useRef(null);
    const [pingState,   setPingState]   = useState(null); // null | 'PINGING' | 'RESULT'
    const [pingResult,  setPingResult]  = useState(null); // { respondidos, noRespondidos }
    const [pingCountdown, setPingCountdown] = useState(0);

    useEffect(() => { gameDataRef.current = gameData; }, [gameData]);

    const playSound = (t) => {
        if (t === 'START')   safePlay(audioStart);
        else if (t === 'WIN')     safePlay(audioWin);
        else if (t === 'CORRECT') safePlay(audioCorrect);
        else if (t === 'WRONG')   safePlay(audioWrong);
    };

    // ─── Firebase listener ───────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setGameData(data);
            setFaseHost(data.estado || 'LOBBY');
            setFaseRonda(data.faseRonda || 'JUGANDO');
            setJugadores(data.jugadores ? Object.values(data.jugadores) : []);

            // Procesar respuestas pendientes de los adivinadores
            if (data.estado === 'JUEGO' && data.faseRonda === 'JUGANDO') {
                const respuestas = data.respuestasRonda || {};
                const updates    = {};
                let hayCambios   = false;

                Object.entries(respuestas).forEach(([uid, r]) => {
                    if (!r.processed) {
                        hayCambios = true;
                        let puntos = 0;
                        if (r.correct) {
                            puntos = calcPuntosGuesser(r.timestamp, data.roundStartTime, data.config?.tiempoRonda || 60);
                            if (data.jugadores?.[uid]) {
                                updates[`jugadores.${uid}.puntos`] = increment(puntos);
                            }
                        }
                        updates[`respuestasRonda.${uid}.puntos`]    = puntos;
                        updates[`respuestasRonda.${uid}.processed`] = true;
                    }
                });

                if (hayCambios) await updateDoc(doc(db, 'live_games', codigoSala), updates);

                // Auto-avance si todos los adivinadores respondieron
                const numJugadores  = Object.keys(data.jugadores || {}).length;
                const numAdivinos   = Math.max(0, numJugadores - 1);
                const numRespuestas = Object.keys(respuestas).length;
                if (numAdivinos > 0 && numRespuestas >= numAdivinos) {
                    terminarRonda(data);
                }
            }
        });
        return () => unsub();
    }, [codigoSala]);

    // ─── Timer del host ───────────────────────────────────────────────────────
    useEffect(() => {
        if (faseHost !== 'JUEGO' || faseRonda !== 'JUGANDO' || !gameData) {
            clearInterval(timerRef.current);
            return;
        }
        const tiempoTotal = gameData.config?.tiempoRonda || 60;
        const inicio      = gameData.roundStartTime || Date.now();

        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const restante = Math.max(0, Math.ceil(tiempoTotal - (Date.now() - inicio) / 1000));
            setTimerVisual(restante);
            if (restante <= 0) {
                clearInterval(timerRef.current);
                if (gameDataRef.current) terminarRonda(gameDataRef.current);
            }
        }, 500);

        return () => clearInterval(timerRef.current);
    }, [faseHost, faseRonda, gameData?.roundStartTime]);

    // ─── Ping: comprobar conexiones ──────────────────────────────────────────
    const enviarPing = async () => {
        if (pingState === 'PINGING') return;
        const pingId = Date.now().toString();
        pingIdRef.current = pingId;
        setPingState('PINGING');
        setPingCountdown(8);
        setPingResult(null);
        await updateDoc(doc(db, 'live_games', codigoSala), {
            pingRequest: { id: pingId, respondedBy: {} }
        });
        const intervalo = setInterval(() => {
            setPingCountdown(prev => {
                if (prev <= 1) { clearInterval(intervalo); return 0; }
                return prev - 1;
            });
        }, 1000);
        setTimeout(() => {
            clearInterval(intervalo);
            const data = gameDataRef.current;
            if (!data || pingIdRef.current !== pingId) return;
            const respondidos    = Object.keys(data.pingRequest?.respondedBy || {});
            const todosUids      = Object.keys(data.jugadores || {});
            const noRespondidos  = todosUids.filter(uid => !respondidos.includes(uid));
            const nombrarUid = uid => data.jugadores?.[uid]?.nombre || uid;
            setPingResult({
                respondidos:   respondidos.map(nombrarUid),
                noRespondidos: noRespondidos.map(uid => ({ uid, nombre: nombrarUid(uid) })),
            });
            setPingState('RESULT');
        }, 8000);
    };

    const kickJugador = async (uid) => {
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`jugadores.${uid}`]: deleteField()
        });
        setPingResult(prev => prev ? {
            ...prev,
            noRespondidos: prev.noRespondidos.filter(j => j.uid !== uid)
        } : prev);
    };

    // ─── Pasar palabra (nueva palabra, mismo anfitrión) ──────────────────────
    const pasarPalabra = async () => {
        const data = gameDataRef.current;
        if (!data || data.faseRonda !== 'JUGANDO') return;
        terminarInProgress.current = false;
        const usadas  = [...(data.palabrasUsadas || [])];
        const pool    = PALABRAS_EAE.filter(pw => !usadas.includes(pw.p));
        const banco   = pool.length > 0 ? pool : PALABRAS_EAE;
        const entrada = banco[Math.floor(Math.random() * banco.length)];
        const modoConf = data.modoJuego;
        const modo = modoConf === 'DIBUJAR'  ? 'DIBUJAR'
                   : modoConf === 'DESCRIBIR' ? 'DESCRIBIR'
                   : (data.ultimoModo === 'DIBUJAR' ? 'DESCRIBIR' : 'DIBUJAR');
        await updateDoc(doc(db, 'live_games', codigoSala), {
            palabraSecreta:    entrada.p,
            palabrasTabu:      modo === 'DESCRIBIR' ? entrada.t : [],
            modoRonda:         modo,
            textoDescripcion:  '',
            imagenDibujo:      '',
            respuestasRonda:   {},
            roundStartTime:    Date.now(),
            palabrasUsadas:    [...usadas, entrada.p],
        });
        playSound('START');
    };

    // ─── Funciones de flujo ───────────────────────────────────────────────────
    const empezarPartida = async () => {
        await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'COUNTDOWN' });
    };

    const finCuentaAtras = () => mostrarRuleta(gameDataRef.current);

    const mostrarRuleta = async (data) => {
        if (!data) return;
        setCargando(false);
        terminarInProgress.current = false;
        const prepared = prepararDatosRonda(data);
        if (!prepared) {
            await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'FIN' });
            playSound('WIN');
            return;
        }
        await updateDoc(doc(db, 'live_games', codigoSala), {
            faseRonda:          'RULETA',
            ruletaDisponibles:  prepared.disponiblesNombres,
            ruletaGanadorIndex: prepared.ganadorIndex,
            ruletaRondaData:    prepared.rondaData,
        });
    };

    const iniciarRondaDesdeRuleta = async (data) => {
        if (!data?.ruletaRondaData) return;
        const r = data.ruletaRondaData;
        await updateDoc(doc(db, 'live_games', codigoSala), {
            estado:            'JUEGO',
            faseRonda:         'JUGANDO',
            anfitrionUid:      r.anfitrionUid,
            anfitrionNombre:   r.anfitrionNombre,
            modoRonda:         r.modoRonda,
            palabraSecreta:    r.palabraSecreta,
            palabrasTabu:      r.palabrasTabu,
            textoDescripcion:  '',
            imagenDibujo:      '',
            respuestasRonda:   {},
            roundStartTime:    Date.now(),
            puntuacionAnfitrion: 0,
            anfitrionesUsados: r.anfitrionesUsados,
            palabrasUsadas:    r.palabrasUsadas,
            rondaActual:       r.rondaActual,
            ultimoModo:        r.modoRonda,
        });
        playSound('START');
    };

    // Auto-transición RULETA → JUGANDO (6s = 0.6s delay + 4s spin + 1.4s mostrar ganador)
    useEffect(() => {
        if (faseRonda !== 'RULETA' || !gameData) return;
        const t = setTimeout(() => iniciarRondaDesdeRuleta(gameDataRef.current), 6000);
        return () => clearTimeout(t);
    }, [faseRonda, gameData?.ruletaGanadorIndex]);

    const terminarRonda = async (data) => {
        if (data.faseRonda !== 'JUGANDO') return;
        if (terminarInProgress.current)   return;
        terminarInProgress.current = true;
        clearInterval(timerRef.current);

        // Media sobre TODOS los adivinadores (incluyendo 0 pts).
        // Recalculamos puntos desde r.correct+timestamp porque data.respuestasRonda[uid].puntos
        // puede ser 0 todavía (el updateDoc previo no ha llegado al snapshot).
        const respuestas  = Object.values(data.respuestasRonda || {});
        const numAdivinos = Math.max(1, Object.keys(data.jugadores || {}).length - 1);
        const totalPuntos = respuestas.reduce((s, r) => {
            if (!r.correct) return s;
            return s + calcPuntosGuesser(r.timestamp, data.roundStartTime, data.config?.tiempoRonda || 60);
        }, 0);
        const avgPuntos = Math.round(totalPuntos / numAdivinos);
        const hayAciertos = respuestas.some(r => r.correct);

        const updates = { faseRonda: 'REVEAL', puntuacionAnfitrion: avgPuntos };
        if (avgPuntos > 0 && data.anfitrionUid && data.jugadores?.[data.anfitrionUid]) {
            updates[`jugadores.${data.anfitrionUid}.puntos`] = increment(avgPuntos);
        }

        await updateDoc(doc(db, 'live_games', codigoSala), updates);

        playSound(hayAciertos ? 'CORRECT' : 'WRONG');

        setTimeout(async () => {
            await updateDoc(doc(db, 'live_games', codigoSala), { faseRonda: 'LEADERBOARD' });
        }, 6000);
    };

    const siguienteRonda = async () => {
        if (cargando) return;
        setCargando(true);
        await mostrarRuleta(gameDataRef.current);
    };

    const guardarResultados = async () => {
        if (!usuario?.uid) return alert('Debes iniciar sesión.');
        if (guardandoGlobal) return;
        setGuardandoGlobal(true);
        try {
            const batch = writeBatch(db);
            jugadores.forEach(j => {
                batch.set(doc(collection(db, 'ranking')), {
                    recursoId: gameData.recursoId || codigoSala,
                    recursoTitulo: 'ExpresionArt&Escri', tipoJuego: 'EAE',
                    jugador: j.nombre, puntos: j.puntos || 0, fecha: new Date(),
                });
            });
            await batch.commit();
            alert(`✅ Guardados (${jugadores.length} jugadores).`);
        } catch { alert('Error al guardar.'); }
        setGuardandoGlobal(false);
    };

    const enviarInforme = async () => {
        if (!usuario?.uid) return;
        if (enviandoInforme) return;
        setEnviandoInforme(true);
        try {
            const snap = await getDoc(doc(db, 'users', usuario.uid));
            const codigoProfesor = snap.data()?.codigoProfesor;
            if (!codigoProfesor) { alert('Sin código de profesor.'); setEnviandoInforme(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'EAE', modalidad: 'Online', fecha: new Date(),
                recursoTitulo: 'ExpresionArt&Escri', codigoProfesor,
                jugadores: jugadores.map(j => ({ nombre: j.nombre, puntos: j.puntos || 0 })),
            });
            setInformeEnviado(true);
            alert(`✅ Informe enviado (${jugadores.length} jugadores).`);
        } catch (e) { alert('Error: ' + e.message); }
        setEnviandoInforme(false);
    };

    if (!gameData) return <div style={{ color: 'white', padding: 20 }}>Cargando sala...</div>;

    const totalRondas  = Object.values(gameData.jugadores || {}).length;
    const rondaActual  = gameData.rondaActual || 0;
    const quedan       = totalRondas - (gameData.anfitrionesUsados?.length || 0);
    const jugOrd       = [...jugadores].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));

    return (
        <div className="game-container host-mode">
            <EstilosComunes />
            <EstilosThinkHoot />
            <EstilosEAE />

            {/* HUD */}
            <div className="top-hud host-hud">
                <button className="btn-exit" onClick={onExit}>X</button>
                <div className="room-code">CÓDIGO: <span>{codigoSala}</span></div>
                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                    {faseHost === 'JUEGO' && <div className="q-counter">Ronda {rondaActual}/{totalRondas}</div>}
                    <div className="player-counter"><Users size={20} /> {jugadores.length}</div>
                </div>
            </div>

            <div className="game-area-host">

                {/* LOBBY */}
                {faseHost === 'LOBBY' && (
                    <div className="lobby-screen">
                        <h1 style={{ fontFamily: "'Righteous', sans-serif", color: '#f1c40f', fontSize: '2.2rem' }}>
                            🎨 ExpresionArt & ✍️ Escri
                        </h1>
                        <p style={{ color: '#3498db', fontSize: '1.1rem' }}>Pictionary + Tabú Multijugador</p>
                        <div className="big-code">{codigoSala}</div>
                        <p style={{ color: '#bdc3c7' }}>Esperando jugadores...</p>
                        <div className="players-grid">
                            {jugadores.map((j, i) => <div key={i} className="player-chip">{j.nombre}</div>)}
                        </div>
                        <button className="btn-start-big" onClick={empezarPartida}
                            disabled={jugadores.length === 0} style={{ opacity: jugadores.length === 0 ? 0.5 : 1 }}>
                            <Play size={32} fill="white" /> EMPEZAR
                        </button>
                    </div>
                )}

                {/* COUNTDOWN */}
                {faseHost === 'COUNTDOWN' && <PantallaCuentaAtras playSound={playSound} onFinished={finCuentaAtras} />}

                {/* RULETA */}
                {faseHost === 'JUEGO' && faseRonda === 'RULETA' && gameData.ruletaDisponibles && (
                    <RuletaEAE
                        disponibles={gameData.ruletaDisponibles}
                        ganadorIndex={gameData.ruletaGanadorIndex ?? 0}
                    />
                )}

                {/* JUEGO */}
                {faseHost === 'JUEGO' && (
                    <>
                        {/* ── FASE JUGANDO ── */}
                        {faseRonda === 'JUGANDO' && (
                            <div className="host-ronda-layout">
                                {/* Panel central: lo que ocurre */}
                                <div className="host-centro">
                                    <div className="host-ronda-chips">
                                        <div className="chip-anfitrion">🎭 {gameData.anfitrionNombre}</div>
                                        <div className={`chip-modo ${gameData.modoRonda === 'DIBUJAR' ? 'modo-dibujo' : 'modo-tabu'}`}>
                                            {gameData.modoRonda === 'DIBUJAR' ? '🎨 DIBUJANDO' : '✍️ DESCRIBIENDO'}
                                        </div>
                                        <div className="host-timer-big">{timerVisual}s</div>
                                    </div>

                                    <div className="host-content-box">
                                        {gameData.modoRonda === 'DIBUJAR' ? (
                                            gameData.imagenDibujo
                                                ? <img src={gameData.imagenDibujo} className="host-drawing-img" alt="Dibujo en tiempo real" />
                                                : <div className="host-waiting-inner"><Loader className="spin-icon" size={48} /><p>Esperando dibujo…</p></div>
                                        ) : (
                                            <div className="host-desc-box">
                                                {gameData.textoDescripcion || <span className="text-muted-italic">Esperando descripción…</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                                        <button className="btn-force-timeout" onClick={() => terminarRonda(gameData)}>
                                            ⏹ Forzar Final
                                        </button>
                                        <button className="btn-force-timeout" style={{ background: '#8e44ad' }} onClick={pasarPalabra}>
                                            ⏭ Pasar Palabra
                                        </button>
                                        <button className="btn-force-timeout"
                                            style={{ background: pingState === 'PINGING' ? '#555' : '#2980b9' }}
                                            onClick={enviarPing}
                                            disabled={pingState === 'PINGING'}>
                                            {pingState === 'PINGING' ? `📡 Comprobando… (${pingCountdown}s)` : '📡 Comprobar Conexión'}
                                        </button>
                                    </div>

                                    {pingState === 'RESULT' && pingResult && (
                                        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #444', borderRadius: 10, padding: 12, marginTop: 10, fontSize: '0.88rem' }}>
                                            <div style={{ color: '#2ecc71', marginBottom: 6 }}>
                                                ✅ Conectados: {pingResult.respondidos.join(', ') || 'ninguno'}
                                            </div>
                                            {pingResult.noRespondidos.length > 0 && (
                                                <div>
                                                    <div style={{ color: '#e74c3c', marginBottom: 6 }}>
                                                        ❌ Sin respuesta: {pingResult.noRespondidos.map(j => j.nombre).join(', ')}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        {pingResult.noRespondidos.map(j => (
                                                            <button key={j.uid}
                                                                onClick={() => kickJugador(j.uid)}
                                                                style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                                Eliminar {j.nombre}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <button onClick={() => setPingState(null)}
                                                style={{ marginTop: 8, background: 'transparent', border: '1px solid #666', color: '#aaa', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                Cerrar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Sidebar ranking en tiempo real */}
                                <div className="host-sidebar-ranking">
                                    <div className="sidebar-title">🏆 Ranking</div>
                                    {jugOrd.map((j, i) => (
                                        <div key={j.uid} className={`sidebar-row ${j.uid === gameData.anfitrionUid ? 'sidebar-anfitrion' : ''}`}>
                                            <span className="sidebar-pos">{i + 1}º</span>
                                            <span className="sidebar-name">{j.nombre}{j.uid === gameData.anfitrionUid ? ' 🎭' : ''}</span>
                                            <span className="sidebar-pts">{j.puntos || 0}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── FASE REVEAL ── */}
                        {faseRonda === 'REVEAL' && (
                            <div className="host-reveal-container">
                                <div className="reveal-word-badge">
                                    <div style={{ color: '#bdc3c7', fontSize: '0.9rem', marginBottom: 6, letterSpacing: 2 }}>LA PALABRA ERA</div>
                                    <div className="reveal-palabra-grande">{gameData.palabraSecreta}</div>
                                </div>

                                <div className="reveal-two-col">
                                    <div className="reveal-content-side">
                                        {gameData.modoRonda === 'DIBUJAR' && gameData.imagenDibujo && (
                                            <img src={gameData.imagenDibujo} className="reveal-img-final" alt="Dibujo final" />
                                        )}
                                        {gameData.modoRonda === 'DESCRIBIR' && gameData.textoDescripcion && (
                                            <div className="reveal-desc-final">{gameData.textoDescripcion}</div>
                                        )}
                                    </div>

                                    <div className="reveal-scores-side">
                                        <div style={{ color: '#f1c40f', fontWeight: 700, marginBottom: 8 }}>Resultados</div>
                                        {Object.entries(gameData.respuestasRonda || {}).map(([uid, r]) => {
                                            const j = jugadores.find(jj => jj.uid === uid);
                                            return (
                                                <div key={uid} className={`reveal-score-row ${r.correct ? 'correcto' : 'incorrecto'}`}>
                                                    <span>{j?.nombre || 'Jugador'}</span>
                                                    <span>{r.correct ? `✓ +${r.puntos} pts` : '✗'}</span>
                                                </div>
                                            );
                                        })}
                                        <div className="reveal-anfitrion-bonus">
                                            🎭 {gameData.anfitrionNombre}: <strong>+{gameData.puntuacionAnfitrion || 0} pts</strong>
                                            <div style={{ fontSize: '0.8rem', color: '#95a5a6' }}>(media de adivinadores)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── FASE LEADERBOARD ── */}
                        {faseRonda === 'LEADERBOARD' && (
                            <div className="podium-screen">
                                <h2 style={{ color: '#f1c40f', fontFamily: "'Righteous', sans-serif" }}>
                                    🏆 Ranking — Ronda {rondaActual}
                                </h2>
                                <PodiumDisplay jugadores={jugadores} />
                                <div className="host-controls">
                                    <button className="btn-next-floating" onClick={siguienteRonda}
                                        disabled={cargando} style={{ opacity: cargando ? 0.7 : 1 }}>
                                        {cargando ? 'Cargando...' : quedan <= 0 ? '🏆 Ranking Final' : `Siguiente Ronda (${quedan} restantes)`}
                                        {!cargando && <ArrowUp className="rotate-90" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* FIN */}
                {faseHost === 'FIN' && (
                    <div className="podium-screen">
                        <h1 style={{ color: '#f1c40f', fontFamily: "'Righteous', sans-serif" }}>🏆 PODIO FINAL 🏆</h1>
                        <PodiumDisplay jugadores={jugadores} final={true} playSound={playSound} />
                        <div style={{ display: 'flex', gap: 15, marginTop: 30, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {!informeEnviado ? (
                                <button className="btn-save-global" onClick={enviarInforme} disabled={enviandoInforme}
                                    style={{ background: enviandoInforme ? '#555' : '#9C27B0' }}>
                                    <Send size={20} /> {enviandoInforme ? 'Enviando…' : 'Enviar a Informes'}
                                </button>
                            ) : (
                                <div style={{ padding: '12px 20px', background: 'rgba(46,204,113,0.2)', border: '2px solid #2ecc71', borderRadius: 12, color: '#2ecc71', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle size={18} /> Informe enviado
                                </div>
                            )}
                            <button className="btn-save-global" onClick={guardarResultados} disabled={guardandoGlobal}>
                                <Save size={20} /> Guardar en Ranking
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
// 2. CLIENT (ALUMNO) — también maneja el rol de admin en modo sinProfesor
// ============================================================================
function EAEClient({ codigoSala, usuario, onExit }) {
    const [gameData, setGameData]         = useState(null);
    const [fase, setFase]                 = useState('LOBBY');
    const [faseRonda, setFaseRonda]       = useState('JUGANDO');
    const [puntuacion, setPuntuacion]     = useState(0);
    const [jugadores, setJugadores]       = useState([]);
    const [enviadoProfe, setEnviadoProfe] = useState(false);
    const [cargandoRonda, setCargandoRonda] = useState(false);
    const joiningRef         = useRef(false);
    const timerRef           = useRef(null);
    const gameDataRef        = useRef(null);
    const terminarInProgress = useRef(false);
    const lastPingIdRef      = useRef(null);
    const pingIdRef          = useRef(null);
    const [pingState,    setPingState]    = useState(null);
    const [pingResult,   setPingResult]   = useState(null);
    const [pingCountdown, setPingCountdown] = useState(0);

    useEffect(() => { gameDataRef.current = gameData; }, [gameData]);

    // Unique ID per component mount — avoids collisions when multiple tabs share localStorage
    const sessionIdRef = useRef(
        usuario?.uid || ('sess_' + Math.random().toString(36).substring(2, 11))
    );
    const myUid  = sessionIdRef.current;
    const myName = usuario?.displayName || 'Invitado';

    // ─── Firebase listener ───────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async (snap) => {
            if (!snap.exists()) { alert('Sala cerrada.'); onExit(); return; }
            const data = snap.data();
            setGameData(data);
            setFase(data.estado || 'LOBBY');
            setFaseRonda(data.faseRonda || 'JUGANDO');
            setJugadores(data.jugadores ? Object.values(data.jugadores) : []);

            // Auto-responder al ping del host/admin
            const pingId = data.pingRequest?.id;
            if (pingId && pingId !== lastPingIdRef.current) {
                lastPingIdRef.current = pingId;
                if (!data.pingRequest?.respondedBy?.[myUid]) {
                    updateDoc(doc(db, 'live_games', codigoSala), {
                        [`pingRequest.respondedBy.${myUid}`]: true
                    }).catch(() => {});
                }
            }

            const jMap = data.jugadores || {};
            if (jMap[myUid]) {
                setPuntuacion(jMap[myUid].puntos || 0);
            } else if ((data.estado === 'LOBBY' || data.estado === 'JUEGO') && !joiningRef.current) {
                joiningRef.current = true;
                await updateDoc(doc(db, 'live_games', codigoSala), {
                    [`jugadores.${myUid}`]: { uid: myUid, nombre: myName, puntos: 0, joinedAt: Date.now() }
                });
                joiningRef.current = false;
            }

            if (data.estado === 'FIN') confetti();
        });
        return () => unsub();
    }, [codigoSala]);

    // ─── Admin: procesar respuestas + auto-avance ────────────────────────────
    const isAdmin = !!(gameData?.sinProfesor && gameData?.hostId === myUid);

    useEffect(() => {
        if (!isAdmin || !gameData || gameData.estado !== 'JUEGO' || gameData.faseRonda !== 'JUGANDO') return;
        const procesar = async () => {
            const respuestas = gameData.respuestasRonda || {};
            const updates    = {};
            let hayCambios   = false;

            Object.entries(respuestas).forEach(([uid, r]) => {
                if (!r.processed) {
                    hayCambios = true;
                    let puntos = 0;
                    if (r.correct) {
                        puntos = calcPuntosGuesser(r.timestamp, gameData.roundStartTime, gameData.config?.tiempoRonda || 60);
                        if (gameData.jugadores?.[uid]) updates[`jugadores.${uid}.puntos`] = increment(puntos);
                    }
                    updates[`respuestasRonda.${uid}.puntos`]    = puntos;
                    updates[`respuestasRonda.${uid}.processed`] = true;
                }
            });

            if (hayCambios) await updateDoc(doc(db, 'live_games', codigoSala), updates);

            const numJugadores  = Object.keys(gameData.jugadores || {}).length;
            const numAdivinos   = Math.max(0, numJugadores - 1);
            const numRespuestas = Object.keys(respuestas).length;
            if (numAdivinos > 0 && numRespuestas >= numAdivinos) terminarRondaAdmin(gameData);
        };
        procesar();
    }, [isAdmin, gameData?.respuestasRonda, codigoSala]);

    // ─── Admin: timer ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isAdmin || fase !== 'JUEGO' || faseRonda !== 'JUGANDO' || !gameData) {
            clearInterval(timerRef.current);
            return;
        }
        const tiempoTotal = gameData.config?.tiempoRonda || 60;
        const inicio      = gameData.roundStartTime || Date.now();
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const restante = Math.max(0, Math.ceil(tiempoTotal - (Date.now() - inicio) / 1000));
            if (restante <= 0) {
                clearInterval(timerRef.current);
                if (gameDataRef.current) terminarRondaAdmin(gameDataRef.current);
            }
        }, 500);
        return () => clearInterval(timerRef.current);
    }, [isAdmin, fase, faseRonda, gameData?.roundStartTime]);

    // ─── Admin: ping + pasar palabra ─────────────────────────────────────────
    const enviarPingAdmin = async () => {
        if (pingState === 'PINGING') return;
        const pingId = Date.now().toString();
        pingIdRef.current = pingId;
        setPingState('PINGING');
        setPingCountdown(8);
        setPingResult(null);
        await updateDoc(doc(db, 'live_games', codigoSala), {
            pingRequest: { id: pingId, respondedBy: {} }
        });
        const intervalo = setInterval(() => {
            setPingCountdown(prev => {
                if (prev <= 1) { clearInterval(intervalo); return 0; }
                return prev - 1;
            });
        }, 1000);
        setTimeout(() => {
            clearInterval(intervalo);
            const data = gameDataRef.current;
            if (!data || pingIdRef.current !== pingId) return;
            const respondidos   = Object.keys(data.pingRequest?.respondedBy || {});
            const todosUids     = Object.keys(data.jugadores || {});
            const noRespondidos = todosUids.filter(uid => !respondidos.includes(uid));
            const nombrarUid    = uid => data.jugadores?.[uid]?.nombre || uid;
            setPingResult({
                respondidos:   respondidos.map(nombrarUid),
                noRespondidos: noRespondidos.map(uid => ({ uid, nombre: nombrarUid(uid) })),
            });
            setPingState('RESULT');
        }, 8000);
    };

    const kickJugadorAdmin = async (uid) => {
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`jugadores.${uid}`]: deleteField()
        });
        setPingResult(prev => prev ? {
            ...prev,
            noRespondidos: prev.noRespondidos.filter(j => j.uid !== uid)
        } : prev);
    };

    const pasarPalabraAdmin = async () => {
        const data = gameDataRef.current;
        if (!data || data.faseRonda !== 'JUGANDO') return;
        terminarInProgress.current = false;
        const usadas  = [...(data.palabrasUsadas || [])];
        const pool    = PALABRAS_EAE.filter(pw => !usadas.includes(pw.p));
        const banco   = pool.length > 0 ? pool : PALABRAS_EAE;
        const entrada = banco[Math.floor(Math.random() * banco.length)];
        const modoConf = data.modoJuego;
        const modo = modoConf === 'DIBUJAR'  ? 'DIBUJAR'
                   : modoConf === 'DESCRIBIR' ? 'DESCRIBIR'
                   : (data.ultimoModo === 'DIBUJAR' ? 'DESCRIBIR' : 'DIBUJAR');
        await updateDoc(doc(db, 'live_games', codigoSala), {
            palabraSecreta:   entrada.p,
            palabrasTabu:     modo === 'DESCRIBIR' ? entrada.t : [],
            modoRonda:        modo,
            textoDescripcion: '',
            imagenDibujo:     '',
            respuestasRonda:  {},
            roundStartTime:   Date.now(),
            palabrasUsadas:   [...usadas, entrada.p],
        });
        safePlay(audioStart);
    };

    // ─── Admin funciones de flujo ─────────────────────────────────────────────
    const empezarPartidaAdmin = () =>
        updateDoc(doc(db, 'live_games', codigoSala), { estado: 'COUNTDOWN' });

    const mostrarRuletaAdmin = async (data) => {
        if (!data) return;
        setCargandoRonda(false);
        terminarInProgress.current = false;
        const prepared = prepararDatosRonda(data);
        if (!prepared) {
            await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'FIN' });
            safePlay(audioWin);
            return;
        }
        await updateDoc(doc(db, 'live_games', codigoSala), {
            faseRonda:          'RULETA',
            ruletaDisponibles:  prepared.disponiblesNombres,
            ruletaGanadorIndex: prepared.ganadorIndex,
            ruletaRondaData:    prepared.rondaData,
        });
    };

    const iniciarRondaDesdeRuletaAdmin = async (data) => {
        if (!data?.ruletaRondaData) return;
        const r = data.ruletaRondaData;
        await updateDoc(doc(db, 'live_games', codigoSala), {
            estado:            'JUEGO',
            faseRonda:         'JUGANDO',
            anfitrionUid:      r.anfitrionUid,
            anfitrionNombre:   r.anfitrionNombre,
            modoRonda:         r.modoRonda,
            palabraSecreta:    r.palabraSecreta,
            palabrasTabu:      r.palabrasTabu,
            textoDescripcion:  '',
            imagenDibujo:      '',
            respuestasRonda:   {},
            roundStartTime:    Date.now(),
            puntuacionAnfitrion: 0,
            anfitrionesUsados: r.anfitrionesUsados,
            palabrasUsadas:    r.palabrasUsadas,
            rondaActual:       r.rondaActual,
            ultimoModo:        r.modoRonda,
        });
        safePlay(audioStart);
    };

    // Auto-transición RULETA → JUGANDO (admin)
    useEffect(() => {
        if (!isAdmin || faseRonda !== 'RULETA' || !gameData) return;
        const t = setTimeout(() => iniciarRondaDesdeRuletaAdmin(gameDataRef.current), 6000);
        return () => clearTimeout(t);
    }, [isAdmin, faseRonda, gameData?.ruletaGanadorIndex]);

    const terminarRondaAdmin = async (data) => {
        if (data.faseRonda !== 'JUGANDO') return;
        if (terminarInProgress.current) return;
        terminarInProgress.current = true;
        clearInterval(timerRef.current);

        const respuestas  = Object.values(data.respuestasRonda || {});
        const numAdivinos = Math.max(1, Object.keys(data.jugadores || {}).length - 1);
        const totalPuntos = respuestas.reduce((s, r) => {
            if (!r.correct) return s;
            return s + calcPuntosGuesser(r.timestamp, data.roundStartTime, data.config?.tiempoRonda || 60);
        }, 0);
        const avgPuntos   = Math.round(totalPuntos / numAdivinos);
        const hayAciertos = respuestas.some(r => r.correct);

        const updates = { faseRonda: 'REVEAL', puntuacionAnfitrion: avgPuntos };
        if (avgPuntos > 0 && data.anfitrionUid && data.jugadores?.[data.anfitrionUid]) {
            updates[`jugadores.${data.anfitrionUid}.puntos`] = increment(avgPuntos);
        }
        await updateDoc(doc(db, 'live_games', codigoSala), updates);
        safePlay(hayAciertos ? audioCorrect : audioWrong);

        setTimeout(async () => {
            await updateDoc(doc(db, 'live_games', codigoSala), { faseRonda: 'LEADERBOARD' });
        }, 6000);
    };

    const siguienteRondaAdmin = async () => {
        if (cargandoRonda) return;
        setCargandoRonda(true);
        await mostrarRuletaAdmin(gameDataRef.current);
    };

    // ─── Acciones del adivinador ──────────────────────────────────────────────
    const enviarRespuesta = async (esCorrecta) => {
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`respuestasRonda.${myUid}`]: {
                uid: myUid, nombre: myName,
                correct: esCorrecta, puntos: 0,
                timestamp: Date.now(), processed: false,
            }
        });
    };

    const enviarAlProfesor = async () => {
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`resultadosFinales.${myUid}`]: { nombre: myName, puntos: puntuacion }
        });
        setEnviadoProfe(true);
    };

    if (!gameData) return <div style={{ color: 'white', padding: 20 }}>Conectando...</div>;

    const soyAnfitrion = gameData.anfitrionUid === myUid;
    const miRespuesta  = gameData.respuestasRonda?.[myUid];
    const tiempoRonda  = gameData.config?.tiempoRonda || 60;
    const sinProfesor  = !!gameData.sinProfesor;
    const totalRondas  = jugadores.length;
    const quedan       = totalRondas - (gameData.anfitrionesUsados?.length || 0);

    return (
        <div className="game-container client-mode">
            <EstilosComunes />
            <EstilosThinkHoot />
            <EstilosEAE />

            {/* Header alumno */}
            <div className="client-header-container">
                <button className="btn-exit" onClick={onExit} style={{ position: 'absolute', left: 10 }}>X</button>
                <div className="client-score-wrapper">
                    <div className="score-badge blue-pill">{puntuacion} pts</div>
                </div>
            </div>

            {/* LOBBY */}
            {fase === 'LOBBY' && (
                <div className="lobby-screen" style={{ marginTop: 60 }}>
                    <h1 style={{ fontFamily: "'Righteous', sans-serif", color: '#e67e22', fontSize: '2rem' }}>
                        🎨 PictoTabú
                    </h1>
                    <p style={{ color: '#3498db' }}>Pictionary + Tabú</p>
                    <div className="big-code" style={{ fontSize: '4rem' }}>{codigoSala}</div>
                    {sinProfesor && (
                        <div className="players-grid">
                            {jugadores.map((j, i) => <div key={i} className="player-chip">{j.nombre}</div>)}
                        </div>
                    )}
                    {isAdmin ? (
                        <button className="btn-start-big" onClick={empezarPartidaAdmin}
                            disabled={jugadores.length < 2} style={{ opacity: jugadores.length < 2 ? 0.5 : 1, marginTop: 20 }}>
                            <Play size={28} fill="white" /> EMPEZAR
                        </button>
                    ) : (
                        <p style={{ color: '#bdc3c7', marginTop: 12 }}>
                            {sinProfesor ? 'Esperando al anfitrión...' : 'Espera al profesor...'}
                        </p>
                    )}
                </div>
            )}

            {/* COUNTDOWN */}
            {fase === 'COUNTDOWN' && (
                isAdmin
                    ? <PantallaCuentaAtras playSound={() => safePlay(audioStart)} onFinished={() => mostrarRuletaAdmin(gameDataRef.current)} />
                    : <div className="lobby-wait">
                        <h1 style={{ fontSize: '4rem', color: '#f1c40f', fontFamily: "'Righteous', sans-serif" }}>¡ATENTOS!</h1>
                    </div>
            )}

            {/* JUEGO */}
            {fase === 'JUEGO' && (
                <>
                    {/* RULETA: todos los jugadores la ven */}
                    {faseRonda === 'RULETA' && gameData.ruletaDisponibles && (
                        <RuletaEAE
                            disponibles={gameData.ruletaDisponibles}
                            ganadorIndex={gameData.ruletaGanadorIndex ?? 0}
                        />
                    )}

                    {/* sinProfesor: REVEAL compartido */}
                    {sinProfesor && faseRonda === 'REVEAL' && (
                        <EAERevealCompartido
                            gameData={gameData}
                            jugadores={jugadores}
                            miRespuesta={miRespuesta}
                            soyAnfitrion={soyAnfitrion}
                        />
                    )}

                    {/* sinProfesor: LEADERBOARD compartido */}
                    {sinProfesor && faseRonda === 'LEADERBOARD' && (
                        <div className="podium-screen">
                            <h2 style={{ color: '#e67e22', fontFamily: "'Righteous', sans-serif" }}>
                                🏆 Ranking — Ronda {gameData.rondaActual}
                            </h2>
                            <PodiumDisplay jugadores={jugadores} />
                            {isAdmin && (
                                <div className="host-controls">
                                    <button className="btn-next-floating" onClick={siguienteRondaAdmin}
                                        disabled={cargandoRonda} style={{ opacity: cargandoRonda ? 0.7 : 1 }}>
                                        {cargandoRonda ? 'Cargando...' : quedan <= 0 ? '🏆 Final' : `Siguiente Ronda (${quedan})`}
                                        {!cargandoRonda && <ArrowUp className="rotate-90" />}
                                    </button>
                                </div>
                            )}
                            {!isAdmin && (
                                <p style={{ color: '#bdc3c7', marginTop: 20 }}>Esperando la siguiente ronda...</p>
                            )}
                        </div>
                    )}

                    {/* Flujo normal: JUGANDO (o REVEAL/LEADERBOARD cuando conProfesor) */}
                    {(!sinProfesor || faseRonda === 'JUGANDO') && (
                        <>
                            {/* Barra de control para el admin en sinProfesor */}
                            {isAdmin && faseRonda === 'JUGANDO' && (
                                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', borderTop: '2px solid #e67e22', padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: pingState === 'RESULT' && pingResult ? 6 : 0 }}>
                                        <button onClick={pasarPalabraAdmin}
                                            style={{ background: '#8e44ad', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                                            ⏭ Pasar Palabra
                                        </button>
                                        <button onClick={() => terminarRondaAdmin(gameDataRef.current)}
                                            style={{ background: '#c0392b', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                                            ⏹ Forzar Final
                                        </button>
                                        <button onClick={enviarPingAdmin}
                                            disabled={pingState === 'PINGING'}
                                            style={{ background: pingState === 'PINGING' ? '#555' : '#2980b9', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: pingState === 'PINGING' ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                                            {pingState === 'PINGING' ? `📡 Comprobando… (${pingCountdown}s)` : '📡 Comprobar Conexión'}
                                        </button>
                                    </div>
                                    {pingState === 'RESULT' && pingResult && (
                                        <div style={{ fontSize: '0.82rem', textAlign: 'center' }}>
                                            <span style={{ color: '#2ecc71' }}>✅ {pingResult.respondidos.join(', ') || 'ninguno'}</span>
                                            {pingResult.noRespondidos.length > 0 && (
                                                <>
                                                    <span style={{ color: '#e74c3c', marginLeft: 10 }}>❌ Sin respuesta: </span>
                                                    {pingResult.noRespondidos.map(j => (
                                                        <button key={j.uid} onClick={() => kickJugadorAdmin(j.uid)}
                                                            style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontSize: '0.78rem', marginLeft: 4 }}>
                                                            Eliminar {j.nombre}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                            <button onClick={() => setPingState(null)}
                                                style={{ marginLeft: 10, background: 'transparent', border: '1px solid #666', color: '#aaa', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {soyAnfitrion ? (
                                <AnfitrionView
                                    key={gameData.rondaActual}
                                    modoRonda={gameData.modoRonda}
                                    palabraSecreta={gameData.palabraSecreta}
                                    palabrasTabu={gameData.palabrasTabu || []}
                                    codigoSala={codigoSala}
                                    myUid={myUid}
                                    faseRonda={faseRonda}
                                    roundStartTime={gameData.roundStartTime}
                                    tiempoRonda={tiempoRonda}
                                    puntuacionAnfitrion={gameData.puntuacionAnfitrion}
                                    myPuntos={puntuacion}
                                />
                            ) : (
                                <AdivinadorView
                                    key={gameData.rondaActual}
                                    modoRonda={gameData.modoRonda}
                                    imagenDibujo={gameData.imagenDibujo}
                                    textoDescripcion={gameData.textoDescripcion}
                                    palabraSecreta={gameData.palabraSecreta}
                                    anfitrionNombre={gameData.anfitrionNombre}
                                    faseRonda={faseRonda}
                                    miRespuesta={miRespuesta}
                                    roundStartTime={gameData.roundStartTime}
                                    tiempoRonda={tiempoRonda}
                                    onResponder={enviarRespuesta}
                                    puntuacion={puntuacion}
                                />
                            )}
                        </>
                    )}
                </>
            )}

            {/* FIN */}
            {fase === 'FIN' && (
                sinProfesor ? (
                    <div className="podium-screen">
                        <h1 style={{ color: '#e67e22', fontFamily: "'Righteous', sans-serif" }}>🏆 PODIO FINAL 🏆</h1>
                        <PodiumDisplay jugadores={jugadores} final={true} />
                        <button className="btn-exit-big" onClick={onExit} style={{ marginTop: 30 }}>Cerrar</button>
                    </div>
                ) : (
                    <div className="final-screen-client">
                        <h1 className="final-title">🎨 ¡FIN!</h1>
                        <div className="final-card-client">
                            <p className="final-text-intro">Enhorabuena <span className="highlight-name">{myName}</span></p>
                            <p className="final-text-body">con <span className="highlight-score">{puntuacion} puntos</span></p>
                            {!enviadoProfe ? (
                                <button onClick={enviarAlProfesor}
                                    style={{ marginTop: 8, width: '100%', padding: '14px', border: 'none', borderRadius: 30, background: '#9C27B0', color: 'white', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Send size={18} /> Enviar al Profesor
                                </button>
                            ) : (
                                <div style={{ marginTop: 8, padding: '12px', background: 'rgba(46,204,113,0.15)', border: '2px solid #2ecc71', borderRadius: 12, color: '#2ecc71', fontWeight: 700, textAlign: 'center' }}>
                                    ✓ Resultados enviados
                                </div>
                            )}
                        </div>
                    </div>
                )
            )}
        </div>
    );
}

// ============================================================================
// 3b. REVEAL COMPARTIDO (sinProfesor mode — todos los jugadores lo ven)
// ============================================================================
function EAERevealCompartido({ gameData, jugadores, miRespuesta, soyAnfitrion }) {
    const fueCorrecta = miRespuesta?.correct;
    const ptsGanados  = miRespuesta?.puntos || 0;

    return (
        <div className="host-reveal-container" style={{ marginTop: 60 }}>
            <div className="reveal-word-badge">
                <div style={{ color: '#bdc3c7', fontSize: '0.9rem', marginBottom: 6, letterSpacing: 2 }}>LA PALABRA ERA</div>
                <div className="reveal-palabra-grande">{gameData.palabraSecreta}</div>
            </div>

            <div className="reveal-two-col">
                <div className="reveal-content-side">
                    {gameData.modoRonda === 'DIBUJAR' && gameData.imagenDibujo && (
                        <img src={gameData.imagenDibujo} className="reveal-img-final" alt="Dibujo" />
                    )}
                    {gameData.modoRonda === 'DESCRIBIR' && gameData.textoDescripcion && (
                        <div className="reveal-desc-final">{gameData.textoDescripcion}</div>
                    )}
                </div>
                <div className="reveal-scores-side">
                    <div style={{ color: '#f1c40f', fontWeight: 700, marginBottom: 8 }}>Resultados</div>
                    {!soyAnfitrion && miRespuesta !== undefined && (
                        <div className={`reveal-score-row ${fueCorrecta ? 'correcto' : 'incorrecto'}`} style={{ marginBottom: 8, fontWeight: 700 }}>
                            <span>Tú</span>
                            <span>{fueCorrecta ? `✓ +${ptsGanados} pts` : '✗'}</span>
                        </div>
                    )}
                    {Object.entries(gameData.respuestasRonda || {}).map(([uid, r]) => {
                        const j = jugadores.find(jj => jj.uid === uid);
                        return (
                            <div key={uid} className={`reveal-score-row ${r.correct ? 'correcto' : 'incorrecto'}`}>
                                <span>{j?.nombre || 'Jugador'}</span>
                                <span>{r.correct ? `✓ +${r.puntos} pts` : '✗'}</span>
                            </div>
                        );
                    })}
                    <div className="reveal-anfitrion-bonus">
                        🎭 {gameData.anfitrionNombre}: <strong>+{gameData.puntuacionAnfitrion || 0} pts</strong>
                        <div style={{ fontSize: '0.8rem', color: '#95a5a6' }}>(media de adivinadores)</div>
                    </div>
                </div>
            </div>
            <p style={{ color: '#95a5a6', fontSize: '0.85rem', marginTop: 16 }}>Espera el ranking...</p>
        </div>
    );
}

// ============================================================================
// 3. ANFITRIÓN VIEW (wrapper que gestiona el estado y el timer visual)
// ============================================================================
function AnfitrionView({ modoRonda, palabraSecreta, palabrasTabu, codigoSala, myUid, faseRonda, roundStartTime, tiempoRonda, puntuacionAnfitrion, myPuntos }) {
    const [timeLeft, setTimeLeft] = useState(100);
    const [isLate, setIsLate]     = useState(false);

    useEffect(() => {
        if (faseRonda !== 'JUGANDO') return;
        const iv = setInterval(() => {
            const elapsed = (Date.now() - roundStartTime) / 1000;
            const pct = Math.max(0, 100 - (elapsed / tiempoRonda * 100));
            setTimeLeft(pct);
            if (pct < 20) setIsLate(true);
        }, 200);
        return () => clearInterval(iv);
    }, [roundStartTime, faseRonda]);

    // Pantalla de feedback al terminar la ronda
    if (faseRonda === 'REVEAL' || faseRonda === 'LEADERBOARD') {
        return (
            <div className="feedback-container">
                <div className="pi-feedback-wrapper">
                    <img src={piHappy} className="pi-feedback happy" alt="Pi" />
                </div>
                <div className="neon-card success">
                    <div className="neon-title">¡Ronda terminada!</div>
                    {faseRonda === 'LEADERBOARD' && (
                        <>
                            <div className="neon-label">Tu puntuación como Anfitrión:</div>
                            <div className="points-added">+{puntuacionAnfitrion || 0} pts</div>
                            <div style={{ color: '#f1c40f', marginTop: 10, fontSize: '1.2rem', fontWeight: 700 }}>
                                Total: {myPuntos} pts
                            </div>
                        </>
                    )}
                    <div style={{ color: '#bdc3c7', marginTop: 15, fontSize: '0.95rem' }}>
                        Espera al siguiente anfitrión...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="anfitrion-outer">
            {/* Badge de rol */}
            <div className="anfitrion-role-badge">🎭 ¡Eres el Anfitrión!</div>

            {/* Timer */}
            <div style={{ width: '100%', maxWidth: 420 }}>
                <div className={`timer-bar-container ${isLate ? 'blinking' : ''}`}>
                    <div className="timer-bar-fill" style={{ width: `${timeLeft}%`, backgroundColor: isLate ? '#e74c3c' : '#f1c40f' }} />
                </div>
            </div>

            {/* Palabra secreta */}
            <div className="palabra-secreta-card">
                <div className="palabra-label">Palabra Secreta</div>
                <div className="palabra-text">{palabraSecreta}</div>
            </div>

            {/* Modo: dibujo o tabú */}
            {modoRonda === 'DIBUJAR'
                ? <AnfitrionDibujo codigoSala={codigoSala} />
                : <AnfitrionTabu palabrasTabu={palabrasTabu} codigoSala={codigoSala} myUid={myUid} />
            }
        </div>
    );
}

// ============================================================================
// 4. PIZARRA DEL ANFITRIÓN (modo Pictionary)
// ============================================================================
function AnfitrionDibujo({ codigoSala }) {
    const canvasRef    = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor]         = useState('#2c3e50');
    const uploadRef    = useRef(null);

    // Fondo blanco inicial + prevenir scroll táctil
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const block = e => e.preventDefault();
        canvas.addEventListener('touchmove', block, { passive: false });
        return () => canvas.removeEventListener('touchmove', block);
    }, []);

    // Enviar captura a Firebase cada 2 segundos
    useEffect(() => {
        uploadRef.current = setInterval(async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const base64 = canvas.toDataURL('image/jpeg', 0.3);
            try { await updateDoc(doc(db, 'live_games', codigoSala), { imagenDibujo: base64 }); } catch { /* silencioso */ }
        }, 2000);
        return () => clearInterval(uploadRef.current);
    }, [codigoSala]);

    const getPos = (e) => {
        const rect   = canvasRef.current.getBoundingClientRect();
        const src    = e.touches ? e.touches[0] : e;
        const scaleX = canvasRef.current.width  / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    };

    const startDraw = (e) => {
        setIsDrawing(true);
        const pos = getPos(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    };
    const draw = (e) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.strokeStyle = color === 'ERASER' ? '#ffffff' : color;
        ctx.lineWidth   = color === 'ERASER' ? 22 : 4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
    };
    const stopDraw = () => setIsDrawing(false);

    const limpiar = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const COLORES = ['#2c3e50', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ffffff', 'ERASER'];

    return (
        <div className="canvas-anfitrion-wrap">
            <canvas
                ref={canvasRef} width={350} height={280}
                style={{ background: 'white', border: '3px solid #f1c40f', borderRadius: 15, touchAction: 'none', maxWidth: '100%', cursor: 'crosshair' }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
            <div className="palette-row">
                {COLORES.map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: c === 'ERASER' ? '#ecf0f1' : c,
                        border: color === c ? '4px solid #f1c40f' : '2px solid rgba(255,255,255,0.3)',
                        cursor: 'pointer', fontSize: '1rem',
                    }}>{c === 'ERASER' ? '🧹' : ''}</button>
                ))}
                <button onClick={limpiar} style={{ padding: '5px 12px', background: 'rgba(231,76,60,0.8)', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700 }}>🗑️</button>
            </div>
            <p style={{ color: '#95a5a6', fontSize: '0.78rem', marginTop: 4 }}>📡 Enviando dibujo en tiempo real (cada 2s)</p>
        </div>
    );
}

// ============================================================================
// 5. TABÚ DEL ANFITRIÓN (modo Describir)
// ============================================================================
function AnfitrionTabu({ palabrasTabu, codigoSala, myUid }) {
    const [texto, setTexto]             = useState('');
    const [tabooFlash, setTabooFlash]   = useState(null);
    const [penaltyAnim, setPenaltyAnim] = useState(false);
    const lastViolRef  = useRef('');
    const fireTimer    = useRef(null);

    const handleChange = async (e) => {
        const val       = e.target.value;
        const violation = detectarTabu(val, palabrasTabu);

        if (violation) {
            // Eliminar la última palabra escrita (la infractora)
            const partes   = val.trimEnd().split(/\s+/);
            const sinUltima = partes.length > 1 ? partes.slice(0, -1).join(' ') + ' ' : '';
            setTexto(sinUltima);

            // Animación de penalización
            setTabooFlash(violation);
            setPenaltyAnim(true);
            safePlay(audioWrong);
            setTimeout(() => { setTabooFlash(null); setPenaltyAnim(false); }, 1500);

            // -5 pts (solo una vez por instancia única de violación)
            const sig = violation + '|' + sinUltima.length;
            if (lastViolRef.current !== sig) {
                lastViolRef.current = sig;
                try {
                    await updateDoc(doc(db, 'live_games', codigoSala), {
                        [`jugadores.${myUid}.puntos`]: increment(-5)
                    });
                } catch { /* silencioso */ }
            }
            return;
        }

        setTexto(val);
        // Envío con debounce a Firebase (los demás ven el texto en tiempo real)
        if (fireTimer.current) clearTimeout(fireTimer.current);
        fireTimer.current = setTimeout(async () => {
            try { await updateDoc(doc(db, 'live_games', codigoSala), { textoDescripcion: val }); } catch { /* silencioso */ }
        }, 300);
    };

    return (
        <div className="tabu-wrap">
            {/* Palabras prohibidas */}
            <div className="tabu-taboo-box">
                <div className="tabu-header-label">⛔ Palabras Prohibidas</div>
                <div className="tabu-chips-row">
                    {palabrasTabu.map((t, i) => <span key={i} className="tabu-chip">{t}</span>)}
                </div>
            </div>

            {/* Flash de penalización */}
            {tabooFlash && (
                <div className="tabu-flash">
                    ⛔ ¡PROHIBIDO! «{tabooFlash}» — <strong>-5 pts</strong>
                </div>
            )}

            {/* Textarea de descripción */}
            <textarea
                value={texto}
                onChange={handleChange}
                placeholder="Describe la palabra sin usar las palabras prohibidas ni sus derivados..."
                className={`tabu-textarea ${penaltyAnim ? 'tabu-penalty' : ''}`}
                rows={4}
            />
            <p style={{ color: '#95a5a6', fontSize: '0.78rem', marginTop: 4 }}>
                📡 Los demás ven tu descripción en tiempo real
            </p>
        </div>
    );
}

// ============================================================================
// 6. ADIVINADOR VIEW
// ============================================================================
function AdivinadorView({ modoRonda, imagenDibujo, textoDescripcion, palabraSecreta, anfitrionNombre, faseRonda, miRespuesta, roundStartTime, tiempoRonda, onResponder, puntuacion }) {
    const [respuesta, setRespuesta]   = useState('');
    const [timeLeft, setTimeLeft]     = useState(100);
    const [isLate, setIsLate]         = useState(false);
    const [yaRespondido, setYaRespondido] = useState(false);

    useEffect(() => {
        if (faseRonda !== 'JUGANDO' || yaRespondido || miRespuesta) return;
        const iv = setInterval(() => {
            const elapsed = (Date.now() - roundStartTime) / 1000;
            const pct = Math.max(0, 100 - (elapsed / tiempoRonda * 100));
            setTimeLeft(pct);
            if (pct < 20) setIsLate(true);
            if (pct <= 0) {
                clearInterval(iv);
                if (!yaRespondido && !miRespuesta) { setYaRespondido(true); onResponder(false); }
            }
        }, 200);
        return () => clearInterval(iv);
    }, [roundStartTime, faseRonda, yaRespondido, miRespuesta]);

    const enviar = () => {
        if (yaRespondido || miRespuesta) return;
        const ok = clean(respuesta) === clean(palabraSecreta);
        // No sound yet — esperar a que todos contesten (REVEAL)
        setYaRespondido(true);
        onResponder(ok);
    };

    // Sonido y feedback solo cuando llega REVEAL (todos han contestado o expiró el tiempo)
    useEffect(() => {
        if (faseRonda === 'REVEAL') {
            safePlay(miRespuesta?.correct ? audioCorrect : audioWrong);
        }
    }, [faseRonda]);

    // ── REVEAL / LEADERBOARD: feedback ──────────────────────────────────────
    if (faseRonda === 'REVEAL' || faseRonda === 'LEADERBOARD') {
        const fueCorrecta = miRespuesta?.correct;
        const ptsGanados  = miRespuesta?.puntos || 0;
        return (
            <div className="feedback-container">
                <div className="pi-feedback-wrapper">
                    <img src={fueCorrecta ? piHappy : piAngry}
                        className={`pi-feedback ${fueCorrecta ? 'happy' : 'angry'}`} alt="Pi" />
                </div>
                <div className={`neon-card ${fueCorrecta ? 'success' : 'error'}`}>
                    <div className="neon-title">
                        {fueCorrecta ? '¡CORRECTO!' : (!miRespuesta ? '¡TIEMPO!' : '¡FALLASTE!')}
                    </div>
                    {fueCorrecta && <div className="points-added">+{ptsGanados} pts</div>}
                    {faseRonda === 'LEADERBOARD' && (
                        <>
                            <div className="neon-label">La palabra era:</div>
                            <div className="neon-answer">{palabraSecreta}</div>
                            <div style={{ color: '#f1c40f', marginTop: 10, fontWeight: 700 }}>Total: {puntuacion} pts</div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── JUGANDO ──────────────────────────────────────────────────────────────
    return (
        <div className="adivinador-outer">
            {/* Header con nombre anfitrión y timer */}
            <div className="adivinador-header">
                <span style={{ color: '#bdc3c7' }}>
                    <strong style={{ color: '#f1c40f' }}>{anfitrionNombre}</strong> está {modoRonda === 'DIBUJAR' ? '🎨 dibujando' : '✍️ describiendo'}...
                </span>
                <div className={`timer-bar-container ${isLate ? 'blinking' : ''}`} style={{ marginTop: 6 }}>
                    <div className="timer-bar-fill" style={{ width: `${timeLeft}%`, backgroundColor: isLate ? '#e74c3c' : '#2ecc71' }} />
                </div>
            </div>

            {/* Contenido: dibujo o descripción */}
            <div className="adivinador-content">
                {modoRonda === 'DIBUJAR' ? (
                    imagenDibujo
                        ? <img src={imagenDibujo} className="drawing-viewer-img" alt="Dibujo en tiempo real" />
                        : <div className="waiting-draw"><Loader className="spin-icon" size={40} /><p>Esperando dibujo...</p></div>
                ) : (
                    <div className="descripcion-viewer-box">
                        {textoDescripcion || <span style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Esperando descripción…</span>}
                    </div>
                )}
            </div>

            {/* Input para adivinar */}
            {(yaRespondido || miRespuesta) ? (
                <div className="waiting-others">
                    <Loader className="spin-icon" size={36} />
                    <p>Respuesta enviada. Esperando a los demás...</p>
                </div>
            ) : (
                <div className="guess-row">
                    <input
                        value={respuesta}
                        onChange={e => setRespuesta(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && enviar()}
                        placeholder="¿Cuál es la palabra?"
                        className="guess-input"
                    />
                    <button onClick={enviar} className="guess-btn">ADIVINAR</button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COMPONENTES REUTILIZADOS (igual que ThinkHootGame)
// ============================================================================
function PantallaCuentaAtras({ playSound, onFinished }) {
    const [paso, setPaso] = useState(0); const [txt, setTxt] = useState('π');
    useEffect(() => { if (playSound) playSound('START'); const seq = async () => { setTxt("π"); setPaso(0); await new Promise(r => setTimeout(r, 1000)); setTxt("K"); setPaso(1); await new Promise(r => setTimeout(r, 1000)); setTxt("T"); setPaso(2); await new Promise(r => setTimeout(r, 1000)); setTxt("¡YA!"); setPaso(3); await new Promise(r => setTimeout(r, 1000)); onFinished(); }; seq(); }, []);
    return <div className="fullscreen-overlay"><div className={`countdown-text step-${paso}`}>{txt}</div><style>{`.fullscreen-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,#2c3e50,#000);display:flex;justify-content:center;align-items:center;z-index:9999}.countdown-text{font-size:10rem;font-weight:bold;color:white;animation:zoomIn 0.5s}.step-0{color:#3498db}.step-1{color:#e74c3c}.step-2{color:#f1c40f}.step-3{color:#2ecc71;transform:scale(1.2)}@keyframes zoomIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style></div>;
}

function PodiumDisplay({ jugadores, final, playSound }) {
    const sorted = [...jugadores].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
    const top3   = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
    const rest   = sorted.slice(3);
    useEffect(() => { if (final) { confetti(); if (playSound) playSound('WIN'); } }, [final]);
    return (
        <div className="podium-container">
            <div className="podium-stage">
                {top3.map(j => {
                    const rank = sorted.indexOf(j) + 1;
                    const h    = rank === 1 ? '160px' : rank === 2 ? '120px' : '100px';
                    return (
                        <div key={j.uid} className={`podium-pedestal rank-${rank}`}>
                            <div className="podium-avatar">{rank === 1 && <Trophy size={40} color="#f1c40f" />}{rank === 2 && <Medal size={30} color="#bdc3c7" />}{rank === 3 && <Medal size={30} color="#d35400" />}</div>
                            <div className="pedestal-bar" style={{ height: h }}><div className="p-rank">{rank}º</div></div>
                            <div className="p-name">{j.nombre}</div>
                            <div className="p-score">{j.puntos || 0}</div>
                        </div>
                    );
                })}
            </div>
            {final && sorted.length > 0 && (
                <div style={{ width: '100%', maxWidth: 600, marginTop: 20, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', color: 'white' }}>
                        <thead><tr style={{ background: 'rgba(255,255,255,0.1)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: 1 }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nombre</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center', color: '#f1c40f' }}>Pts</th>
                        </tr></thead>
                        <tbody>{sorted.map((j, i) => (
                            <tr key={j.uid} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <td style={{ padding: '7px 10px', fontWeight: 700 }}>{i + 1}º</td>
                                <td style={{ padding: '7px 10px' }}>{j.nombre}</td>
                                <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: '#f1c40f' }}>{j.puntos || 0}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
            {!final && rest.length > 0 && (
                <div className="rest-list">{rest.map((j, i) => (<div key={j.uid} className="rest-row"><span>{i + 4}º {j.nombre}</span><span>{j.puntos || 0}</span></div>))}</div>
            )}
        </div>
    );
}

// ============================================================================
// ESTILOS
// ============================================================================
const EstilosComunes = () => (<style>{` @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Roboto:wght@400;700&display=swap'); .card-menu { background: rgba(0,0,0,0.85); padding: 40px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; color: white; font-family: 'Roboto', sans-serif; box-shadow: 0 20px 50px rgba(0,0,0,0.5); margin: 50px auto; } .btn-success { width: 100%; padding: 15px; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; color: #fff; background: #2ecc71; margin-bottom: 10px; font-size: 1.2rem; } .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; } `}</style>);

const EstilosThinkHoot = () => (
    <style>{`
        .game-container { width: 100vw; height: 100vh; background: #2c3e50; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; position: relative; font-family: 'Roboto', sans-serif; }
        .lobby-wait { display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center; gap: 12px; animation: popIn 0.4s; }
        .lobby-wait h1, .lobby-wait h2 { color: #f1c40f; font-family: 'Righteous', sans-serif; margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        .lobby-wait p { color: #ecf0f1; font-size: 1.2rem; margin: 0; opacity: 0.85; }
        .feedback-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 20px; width: 100%; position: fixed; top: 0; left: 0; z-index: 2000; background: rgba(44, 62, 80, 0.95); }
        .pi-feedback-wrapper { display: flex; justify-content: center; width: 100%; margin-bottom: 10px; }
        .pi-feedback { width: 150px; height: 150px; object-fit: contain; animation: popIn 0.5s; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); }
        .pi-feedback.happy { animation: bounce 2s infinite; }
        .pi-feedback.angry { animation: shake 0.5s; }
        .neon-card { background: #1a1a1a; padding: 25px; border-radius: 15px; text-align: center; color: white; width: 90%; max-width: 400px; animation: popIn 0.3s; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
        .neon-card.error { border: 3px solid #ff003c; box-shadow: 0 0 20px #ff003c, inset 0 0 10px #ff003c; }
        .neon-card.success { border: 3px solid #2ecc71; box-shadow: 0 0 20px #2ecc71, inset 0 0 10px #2ecc71; }
        .neon-card.neutral { border: 3px solid #f1c40f; box-shadow: 0 0 20px #f1c40f, inset 0 0 10px #f1c40f; }
        .neon-title { font-size: 1.8rem; font-weight: bold; margin-bottom: 10px; }
        .neon-card.error .neon-title { color: #ff003c; text-shadow: 0 0 10px #ff003c; }
        .neon-card.success .neon-title { color: #2ecc71; text-shadow: 0 0 10px #2ecc71; }
        .neon-card.neutral .neon-title { color: #f1c40f; text-shadow: 0 0 10px #f1c40f; }
        .neon-label { color: #ccc; margin-bottom: 10px; }
        .neon-answer { font-size: 1.5rem; font-weight: bold; background: rgba(255,0,60,0.1); padding: 10px; border-radius: 8px; border: 1px solid #ff003c; width: 100%; }
        .points-added { font-size: 2rem; font-weight: bold; color: #f1c40f; animation: bounce 1s infinite; }
        .client-header-container { position: absolute; top: 0; left: 0; width: 100%; padding: 15px; display: flex; justify-content: center; align-items: center; z-index: 3000; }
        .client-score-wrapper { display: flex; align-items: center; gap: 0; }
        .score-badge.blue-pill { background: #3498db; color: white; padding: 10px 20px; border-radius: 30px; font-weight: bold; font-size: 1.2rem; min-width: 80px; text-align: center; }
        .final-screen-client { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; animation: popIn 0.5s; z-index: 10; position: relative; }
        .final-title { font-family: 'Righteous'; font-size: 3rem; color: #f1c40f; text-shadow: 0 5px 10px rgba(0,0,0,0.5); margin-bottom: 20px; letter-spacing: 2px; }
        .final-card-client { background: rgba(0,0,0,0.6); padding: 40px 20px; border-radius: 20px; width: 90%; max-width: 400px; border: 2px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; }
        .final-text-intro { font-size: 1.5rem; color: white; margin-bottom: 20px; }
        .final-text-body { font-size: 1.2rem; color: #ccc; margin: 15px 0; line-height: 1.5; }
        .highlight-name { color: #2ecc71; font-family: 'Righteous'; font-size: 2rem; display: block; margin-top: 5px; }
        .highlight-score { color: #3498db; font-family: 'Righteous'; font-size: 2rem; display: block; margin-top: 5px; }
        .host-hud { background: #34495e; height: 60px; padding: 0 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); width: 100%; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; }
        .game-area-host { flex: 1; display: flex; flex-direction: column; align-items: center; width: 100%; position: relative; padding-top: 60px; overflow-y: auto; }
        .host-mode .top-hud { position: absolute; top: 0; left: 0; right: 0; z-index: 100; }
        .room-code { color: white; font-size: 1.5rem; font-weight: bold; }
        .room-code span { color: #f1c40f; }
        .player-counter { color: white; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
        .q-counter { color: white; font-weight: bold; font-family: 'Righteous'; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 5px; }
        .podium-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; color: white; overflow-y: auto; padding-top: 60px; padding-bottom: 100px; }
        .podium-container { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; max-width: 800px; }
        .podium-stage { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin-bottom: 30px; }
        .podium-pedestal { display: flex; flex-direction: column; align-items: center; animation: bounceIn 1s; }
        .pedestal-bar { width: 80px; background: linear-gradient(to bottom, #f39c12, #d35400); border-radius: 10px 10px 0 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .rank-2 .pedestal-bar { background: linear-gradient(to bottom, #bdc3c7, #7f8c8d); }
        .rank-3 .pedestal-bar { background: linear-gradient(to bottom, #e67e22, #a0500d); }
        .p-rank { font-size: 2rem; font-weight: bold; color: rgba(0,0,0,0.3); }
        .p-name { margin-top: 10px; font-weight: bold; font-size: 1.1rem; color: white; }
        .p-score { background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 10px; margin-top: 5px; font-size: 0.9rem; color: white; }
        .rest-list { width: 80%; background: rgba(0,0,0,0.2); border-radius: 10px; max-height: 150px; overflow-y: auto; padding: 10px; margin-top: 20px; }
        .rest-row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: white; }
        .host-controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 100; }
        .btn-next-floating { background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: none; padding: 15px 40px; font-size: 1.5rem; border-radius: 50px; cursor: pointer; display: flex; align-items: center; gap: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transition: transform 0.1s; font-family: 'Righteous'; border: 2px solid white; }
        .btn-next-floating:active { transform: translateX(-50%) scale(0.95); }
        .btn-force-timeout { background: rgba(231,76,60,0.2); color: #e74c3c; border: 1px solid #e74c3c; padding: 5px 15px; border-radius: 20px; cursor: pointer; margin-top: 15px; font-size: 0.9rem; font-weight: bold; transition: all 0.2s; }
        .btn-force-timeout:hover { background: #e74c3c; color: white; }
        .btn-save-global { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 1rem; }
        .btn-exit-big { background: transparent; border: 2px solid #ccc; color: #ccc; padding: 10px 30px; border-radius: 20px; cursor: pointer; font-size: 1rem; }
        .btn-exit { background: rgba(255,255,255,0.15); color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 0.9rem; }
        .big-code { font-size: 6rem; font-family: 'Righteous'; color: #f1c40f; letter-spacing: 5px; margin: 20px 0; text-shadow: 0 0 30px rgba(241,196,15,0.5); }
        .players-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 800px; margin: 30px 0; }
        .player-chip { background: #3498db; color: white; padding: 10px 20px; border-radius: 20px; font-weight: bold; animation: popIn 0.3s; }
        .btn-start-big { background: #2ecc71; color: white; border: none; padding: 20px 50px; font-size: 2rem; border-radius: 50px; cursor: pointer; font-family: 'Righteous'; display: flex; align-items: center; gap: 15px; box-shadow: 0 10px 0 #27ae60; transition: transform 0.1s; }
        .btn-start-big:active { transform: translateY(10px); box-shadow: none; }
        .timer-bar-container { width: 100%; height: 10px; background: #444; border-radius: 5px; margin-bottom: 20px; overflow: hidden; }
        .timer-bar-fill { height: 100%; transition: width 0.1s linear; }
        .blinking { animation: flashRed 0.5s infinite; }
        .waiting-others { text-align: center; color: #ccc; margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .spin-icon { animation: spin 2s linear infinite; }
        .lobby-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center; gap: 10px; padding: 20px; }
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); } 70% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes flashRed { 0%, 100% { box-shadow: 0 0 0 transparent; } 50% { box-shadow: 0 0 20px red; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .rotate-90 { transform: rotate(90deg); }
    `}</style>
);

const EstilosEAE = () => (
    <style>{`
        /* ── HOST LAYOUT ───────────────────────────────────────── */
        .host-ronda-layout {
            display: flex;
            width: 100%;
            gap: 0;
            height: 100%;
            align-items: flex-start;
        }
        .host-centro {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            gap: 15px;
        }
        .host-ronda-chips {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .chip-anfitrion {
            background: rgba(155,89,182,0.25);
            border: 2px solid #9b59b6;
            color: #d7bde2;
            padding: 7px 16px;
            border-radius: 20px;
            font-size: 1rem;
        }
        .chip-modo {
            padding: 7px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 1rem;
        }
        .modo-dibujo { background: rgba(52,152,219,0.2); border: 2px solid #3498db; color: #7fb3d3; }
        .modo-tabu   { background: rgba(231,76,60,0.2);  border: 2px solid #e74c3c; color: #f1948a; }
        .host-timer-big {
            font-size: 3rem; font-weight: bold; color: #f1c40f;
            font-family: 'Righteous', sans-serif;
            animation: pulse 1s infinite;
            min-width: 80px; text-align: center;
        }
        .host-content-box {
            width: 100%; max-width: 580px;
            display: flex; justify-content: center; align-items: center;
            min-height: 200px;
        }
        .host-drawing-img {
            max-width: 100%; max-height: 300px;
            border: 3px solid #3498db; border-radius: 15px;
            background: white; box-shadow: 0 5px 20px rgba(0,0,0,0.4);
        }
        .host-desc-box {
            background: rgba(52,152,219,0.1);
            border: 3px solid #3498db;
            border-radius: 15px; padding: 20px;
            font-size: 1.4rem; color: white;
            min-height: 120px; width: 100%;
            line-height: 1.6; text-align: center;
            box-sizing: border-box;
        }
        .host-waiting-inner {
            display: flex; flex-direction: column;
            align-items: center; gap: 10px; color: #bdc3c7; padding: 40px;
        }
        .text-muted-italic { color: #95a5a6; font-style: italic; }

        /* ── HOST SIDEBAR RANKING ───────────────────────────── */
        .host-sidebar-ranking {
            width: 220px;
            min-width: 180px;
            background: rgba(0,0,0,0.35);
            border-left: 2px solid rgba(255,255,255,0.08);
            padding: 15px 12px;
            overflow-y: auto;
            height: 100%;
        }
        .sidebar-title {
            color: #f1c40f;
            font-family: 'Righteous', sans-serif;
            font-size: 1.1rem;
            margin-bottom: 12px;
            text-align: center;
        }
        .sidebar-row {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 4px;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            color: white; font-size: 0.88rem;
        }
        .sidebar-row.sidebar-anfitrion {
            background: rgba(155,89,182,0.2);
            border-radius: 8px; padding: 6px 6px;
        }
        .sidebar-pos  { color: #f1c40f; font-weight: bold; min-width: 24px; }
        .sidebar-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-pts  { color: #2ecc71; font-weight: bold; }

        /* ── HOST REVEAL ────────────────────────────────────── */
        .host-reveal-container {
            display: flex; flex-direction: column;
            align-items: center; gap: 20px;
            padding: 20px; width: 100%;
            overflow-y: auto;
        }
        .reveal-word-badge {
            text-align: center;
            background: rgba(0,0,0,0.4);
            border: 3px solid #f1c40f;
            border-radius: 20px; padding: 15px 30px;
            animation: popIn 0.5s;
        }
        .reveal-palabra-grande {
            font-family: 'Righteous', sans-serif;
            font-size: 3.5rem; color: #f1c40f;
            text-shadow: 0 0 30px rgba(241,196,15,0.5);
            letter-spacing: 3px;
        }
        .reveal-two-col {
            display: flex; gap: 20px;
            width: 100%; max-width: 800px;
            flex-wrap: wrap; justify-content: center;
        }
        .reveal-content-side {
            flex: 1; min-width: 240px;
            display: flex; justify-content: center; align-items: center;
        }
        .reveal-img-final {
            max-width: 100%; max-height: 250px;
            border: 3px solid #2ecc71; border-radius: 15px;
            background: white;
        }
        .reveal-desc-final {
            background: rgba(46,204,113,0.1);
            border: 2px solid #2ecc71;
            border-radius: 15px; padding: 20px;
            color: white; font-size: 1.2rem; text-align: center;
            width: 100%;
        }
        .reveal-scores-side {
            flex: 1; min-width: 200px;
            display: flex; flex-direction: column; gap: 8px;
        }
        .reveal-score-row {
            display: flex; justify-content: space-between;
            padding: 8px 15px; border-radius: 10px;
            color: white; font-size: 0.95rem;
        }
        .reveal-score-row.correcto   { background: rgba(46,204,113,0.2);  border: 1px solid #2ecc71; }
        .reveal-score-row.incorrecto { background: rgba(231,76,60,0.12);   border: 1px solid rgba(231,76,60,0.3); color: #bdc3c7; }
        .reveal-anfitrion-bonus {
            background: rgba(155,89,182,0.2);
            border: 2px solid #9b59b6;
            padding: 10px 15px; border-radius: 12px;
            color: white; text-align: center;
            font-size: 0.95rem; margin-top: 8px;
        }

        /* ── ANFITRIÓN (alumno) ─────────────────────────────── */
        .anfitrion-outer {
            width: 100%; max-width: 480px;
            display: flex; flex-direction: column;
            align-items: center; gap: 14px;
            padding: 20px; box-sizing: border-box;
            margin-top: 60px;
            overflow-y: auto;
        }
        .anfitrion-role-badge {
            background: linear-gradient(135deg, #8e44ad, #9b59b6);
            color: white; padding: 9px 22px;
            border-radius: 30px; font-weight: bold;
            font-size: 1.1rem;
            box-shadow: 0 4px 15px rgba(155,89,182,0.5);
            animation: popIn 0.4s;
        }
        .palabra-secreta-card {
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 3px solid #f1c40f;
            border-radius: 20px; padding: 18px 28px;
            text-align: center;
            box-shadow: 0 0 30px rgba(241,196,15,0.25);
            width: 100%;
        }
        .palabra-label {
            color: #f1c40f; font-size: 0.8rem;
            text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px;
        }
        .palabra-text {
            color: white; font-family: 'Righteous', sans-serif;
            font-size: 2.4rem; letter-spacing: 4px;
            text-shadow: 0 0 20px rgba(241,196,15,0.4);
        }

        /* ── CANVAS ANFITRIÓN ───────────────────────────────── */
        .canvas-anfitrion-wrap {
            display: flex; flex-direction: column;
            align-items: center; gap: 10px; width: 100%;
        }
        .palette-row {
            display: flex; gap: 7px;
            flex-wrap: wrap; justify-content: center;
        }

        /* ── TABÚ ANFITRIÓN ─────────────────────────────────── */
        .tabu-wrap {
            width: 100%; position: relative;
            display: flex; flex-direction: column; gap: 10px;
        }
        .tabu-taboo-box {
            background: rgba(231,76,60,0.1);
            border: 2px solid rgba(231,76,60,0.45);
            border-radius: 14px; padding: 14px;
        }
        .tabu-header-label {
            color: #e74c3c; font-weight: bold;
            margin-bottom: 10px; font-size: 0.88rem;
        }
        .tabu-chips-row { display: flex; flex-wrap: wrap; gap: 7px; }
        .tabu-chip {
            background: #e74c3c; color: white;
            padding: 5px 12px; border-radius: 20px;
            font-size: 0.82rem; font-weight: bold;
            text-transform: uppercase;
        }
        .tabu-textarea {
            width: 100%; padding: 15px;
            border: 3px solid #3498db; border-radius: 14px;
            font-size: 1.1rem; font-family: 'Roboto', sans-serif;
            resize: none;
            background: rgba(52,152,219,0.1);
            color: white; box-sizing: border-box;
            transition: border-color 0.3s;
        }
        .tabu-textarea:focus { outline: none; border-color: #f1c40f; }
        .tabu-textarea.tabu-penalty {
            border-color: #e74c3c !important;
            animation: shake 0.5s;
        }
        .tabu-flash {
            background: #e74c3c; color: white;
            padding: 10px 20px; border-radius: 30px;
            font-weight: bold; font-size: 1rem;
            text-align: center; animation: popIn 0.3s;
            box-shadow: 0 5px 20px rgba(231,76,60,0.5);
        }

        /* ── ADIVINADOR ─────────────────────────────────────── */
        .adivinador-outer {
            width: 100%; max-width: 500px;
            display: flex; flex-direction: column;
            align-items: center; gap: 14px;
            padding: 20px; box-sizing: border-box;
            margin-top: 60px;
        }
        .adivinador-header {
            width: 100%; text-align: center;
            font-size: 1rem;
        }
        .adivinador-content {
            width: 100%; display: flex;
            justify-content: center; align-items: center;
            min-height: 180px;
        }
        .drawing-viewer-img {
            max-width: 100%; max-height: 280px;
            border: 3px solid #3498db; border-radius: 15px;
            background: white;
            box-shadow: 0 5px 20px rgba(0,0,0,0.35);
        }
        .descripcion-viewer-box {
            background: rgba(52,152,219,0.1);
            border: 3px solid #3498db; border-radius: 15px;
            padding: 20px; font-size: 1.3rem;
            color: white; min-height: 120px; width: 100%;
            line-height: 1.6; text-align: center;
            box-sizing: border-box;
        }
        .waiting-draw {
            display: flex; flex-direction: column;
            align-items: center; gap: 10px; color: #bdc3c7;
        }
        .guess-row {
            display: flex; gap: 10px; width: 100%;
        }
        .guess-input {
            flex: 1; padding: 15px; font-size: 1.3rem;
            border: 3px solid #f1c40f; border-radius: 12px;
            text-align: center; font-weight: bold;
            background: white; color: #2c3e50;
        }
        .guess-btn {
            padding: 15px 22px; background: #2ecc71; color: white;
            border: none; border-radius: 12px; font-weight: bold;
            font-size: 1.1rem; cursor: pointer;
            box-shadow: 0 4px 0 #27ae60; transition: transform 0.1s;
        }
        .guess-btn:active { transform: translateY(4px); box-shadow: none; }

        /* ── RESPONSIVE ─────────────────────────────────────── */
        @media (max-width: 640px) {
            .host-sidebar-ranking { display: none; }
            .host-ronda-layout    { flex-direction: column; }
            .reveal-two-col       { flex-direction: column; }
            .big-code             { font-size: 4rem; }
            .palabra-text         { font-size: 1.8rem; }
            .reveal-palabra-grande{ font-size: 2.5rem; }
        }
    `}</style>
);
