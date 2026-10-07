
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { Search } from 'lucide-react';
import { leerCompeticionUrl, soloPrimitivos } from './utils/retoLink';
import ModalEnviarCompeticion from './components/ModalEnviarCompeticion';
import { cargarPalabrasWordle } from './utils/diccionarios';
import { despertarAudio, sonidoCorrecto, sonidoIncorrecto } from './utils/sonidosFeedback';
import { T, FUENTE, ESTILOS_CSS, CapaLetras, lanzarLetras, sonidoFicha, sonidoPalabra, sonidoTic, Boton, Opciones, Reloj, BotonSonido, Pantalla, Cabecera, Tarjeta, useWindowSize } from './vanila/comun';

// --- CONFIGURACIÓN DE IDIOMAS ---
const LANGUAGES = {
    ES: {
        label: 'Español',
        keyboard: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']]
    },
    CA: {
        label: 'Català',
        keyboard: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']]
    },
    EN: {
        label: 'English',
        keyboard: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']]
    },
    FR: {
        label: 'Français',
        keyboard: [['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'], ['W', 'X', 'C', 'V', 'B', 'N']]
    }
};

// Enlace de competición (&comp=…&cat=…): la puntuación va a esa prueba, no al profesor
function ModalEnviarProfe(p) {
    const comp = leerCompeticionUrl();
    if (comp) return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.datos?.score) || 0}
        detalle={soloPrimitivos(p.datos)} nombreJuego="Wordle" tituloReto={comp.titulo} onClose={p.onClose} />;
    return <ModalEnviarProfeBase {...p} />;
}

function ModalEnviarProfeBase({ datos, onClose }) {
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
                tipo: 'WORDLE', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
                codigoProfesor: code,
                config: { idioma: datos.idioma, longitud: datos.longitud, modo: datos.modo },
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.score, tiempo: datos.tiempo, intentos: datos.intentos }],
            });
            guardarRegistroLocal('WORDLE', {
                titulo: datos.recursoTitulo, aciertos: datos.score,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
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

function PantallaPresentacionWordle({ presentacion, onEmpezar, onExit }) {
    const toEmbed = (url) => {
        if (!url) return '';
        let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
        m = url.match(/youtu\.be\/([^?&]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
        m = url.match(/vimeo\.com\/(\d+)/);
        if (m) return `https://player.vimeo.com/video/${m[1]}`;
        return url;
    };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0f0c29 0%,#302b63 55%,#24243e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '24px 20px', overflowY: 'auto', fontFamily: 'Arial,sans-serif', boxSizing: 'border-box' }}>
            {onExit && <button onClick={onExit} style={{ position: 'fixed', top: 10, left: 10, background: 'white', border: '2px solid #333', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 9999, fontSize: 18, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>←</button>}
            <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                <h1 style={{ color: 'white', margin: 0, fontSize: 'clamp(1.6rem,5vw,2.8rem)', textAlign: 'center', fontWeight: 900, lineHeight: 1.2, textShadow: '0 0 40px rgba(255,255,255,0.22)' }}>{presentacion.titulo}</h1>
                {presentacion.video && toEmbed(presentacion.video) ? (
                    <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)', position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                        <iframe src={toEmbed(presentacion.video)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={presentacion.titulo} />
                    </div>
                ) : presentacion.imagen ? (
                    <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}>
                        <img src={presentacion.imagen} alt={presentacion.titulo} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '42vh', objectFit: 'cover' }} />
                    </div>
                ) : null}
                {presentacion.descripcion && <p style={{ color: 'rgba(255,255,255,0.88)', margin: 0, fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', textAlign: 'center', lineHeight: 1.7 }}>{presentacion.descripcion}</p>}
                <button onClick={onEmpezar} style={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', color: 'white', border: 'none', borderRadius: 50, padding: '16px 52px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(102,126,234,0.55)', display: 'flex', alignItems: 'center', gap: 10 }}>▶ ¡Empezar!</button>
            </div>
        </div>
    );
}

export default function TextWordleGame({ usuario, onExit, recurso, modoOlimpico = false, tiempoOlimpico = null, hojaOlimpica = 'General', onOlimpicoFinish = null }) {

    // --- ESTADOS DE PANTALLA ---
    const [screen, setScreen] = useState('CONFIG'); // CONFIG, LOADING, MODE_SELECT, GAME, VICTORY, RANKING_VIEW, TIMEOUT
    const [presentacionVista, setPresentacionVista] = useState(() => !recurso?.presentacion?.titulo);

    // --- CONFIGURACIÓN Y JUEGO ---
    const [config, setConfig] = useState({ lang: 'ES', length: 5 });
    const [gameMode, setGameMode] = useState('CLASSIC'); // 'CLASSIC' o 'TIME_ATTACK'
    const [poolPalabras, setPoolPalabras] = useState([]); // Reserva de palabras para el modo infinito

    // --- ESTADOS OLÍMPICOS / CONTRARRELOJ ---
    const [tiempoRestante, setTiempoRestante] = useState(tiempoOlimpico || 300); // 5 min (300s) por defecto
    const [score, setScore] = useState(0); // Contador de palabras acertadas
    const puntosRef = useRef(0);
    const hasFinishedRef = useRef(false);

    // --- DATOS DEL TABLERO ---
    const [solution, setSolution] = useState("");
    const [validWords, setValidWords] = useState(new Set());
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [shakeRow, setShakeRow] = useState(false);
    const [message, setMessage] = useState(null);
    const [esperando, setEsperando] = useState(false);   // mientras gira la fila evaluada
    const { w: anchoVentana } = useWindowSize();
    const tiempoInicialRef = useRef(0);

    // --- TIMER CLÁSICO (Cuenta hacia adelante) ---
    const [elapsedTime, setElapsedTime] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const timerRef = useRef(null);

    // --- ESTADOS DE PROFE / BÚSQUEDA ---
    const [customCode, setCustomCode] = useState('');
    const [isCustomGame, setIsCustomGame] = useState(false);
    const [ranking, setRanking] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    const [playerName, setPlayerName] = useState(usuario?.displayName || '');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    // Buscador
    const [bibliotecaWordle, setBibliotecaWordle] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [filtros, setFiltros] = useState({ tema: '', ciclo: 'Secundaria', pais: '', region: '', poblacion: '', autor: '' });

    // =========================================================
    // 1. LÓGICA OLÍMPICA Y TEMPORIZADORES
    // =========================================================

    // Espejo de puntos para el salvavidas
    useEffect(() => { puntosRef.current = score; }, [score]);

    // Cronómetro Dual (Sirve para Olímpico y Contrarreloj Local)
    useEffect(() => {
        if (screen !== 'GAME') return;

        // Si es Contrarreloj (Local u Olímpico), cuenta atrás
        if (modoOlimpico || gameMode === 'TIME_ATTACK') {
            setTiempoRestante(prev => { if (prev > tiempoInicialRef.current) tiempoInicialRef.current = prev; return prev; });
            const t = setInterval(() => {
                setTiempoRestante(prev => {
                    if (prev <= 11 && prev > 1) sonidoTic(prev <= 6);
                    if (prev <= 1) {
                        clearInterval(t);
                        setScreen('TIMEOUT'); // Fin por tiempo
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(t);
        } else {
            // Si es Clásico, cuenta adelante
            const now = Date.now();
            setStartTime(now);
            const t = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - now) / 1000));
            }, 1000);
            return () => clearInterval(t);
        }
    }, [screen, modoOlimpico, gameMode]);

    // Auto-Start Olímpico
    useEffect(() => {
        if (modoOlimpico && recurso && screen === 'CONFIG') {
            setGameMode('TIME_ATTACK');
            // Usar tiempo del recurso o el global
            const tiempoFinal = tiempoOlimpico || recurso.config?.tiempo || 300;
            setTiempoRestante(tiempoFinal);

            // Forzamos el inicio sin pasar por pantallas
            procesarRecurso(recurso, true);
        }
    }, [modoOlimpico, recurso, screen, tiempoOlimpico]);

    // Interceptor de Final (Envío de Puntos)
    useEffect(() => {
        if ((screen === 'VICTORY' || screen === 'TIMEOUT') && modoOlimpico && !hasFinishedRef.current) {
            hasFinishedRef.current = true;
            // En Wordle Olímpico, la nota es el número de palabras acertadas (score)
            if (onOlimpicoFinish) onOlimpicoFinish(score);
        }
    }, [screen, modoOlimpico, score]);

   /* // Salvavidas (Si se cierra de golpe)
    useEffect(() => {
        return () => {
            if (modoOlimpico && !hasFinishedRef.current) {
                hasFinishedRef.current = true;
                if (onOlimpicoFinish) onOlimpicoFinish(puntosRef.current);
            }
        };
    }, [modoOlimpico]);*/

    useEffect(() => {
        if (recurso && !modoOlimpico) {
            try {
                procesarRecurso(recurso, false);
            } catch (e) {
                console.error(e);
                setMessage("Error cargando el recurso.");
                setScreen('CONFIG'); // ← esto es lo que faltaba
            }
        }
    }, [recurso, modoOlimpico]);


    // =========================================================
    // 2. LÓGICA DE DICCIONARIOS Y JUEGO
    // =========================================================

    const normalizeWord = (word) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    // PREPARAR PARTIDA
    // Función modificada para preparar el pool de palabras
    const cargarDiccionarioYJugar = async (palabrasForzadas = null, idiomaForzado = null, autoStart = false) => {
        setScreen('LOADING');
        const idioma = idiomaForzado || config.lang;

        try {
            // Diccionario común de juegos de palabras (Hunspell de LibreOffice + frecuencias),
            // el mismo que VaniLa. Aquí se usa sin tildes: todo en MAYÚSCULAS normalizado.
            const { validas, conocidas } = await cargarPalabrasWordle((LANGUAGES[idioma] ? idioma : 'ES').toLowerCase());

            let pool = [];
            let targetLen = config.length;

            // Variable local para saber si es custom (sin depender del estado asíncrono)
            const esModoProfe = palabrasForzadas && palabrasForzadas.length > 0;

            // CASO 1: Recurso del Profe (Palabras forzadas)
            if (esModoProfe) {
                // Filtramos por longitud para que sean consistentes si es posible, 
                // o cogemos la longitud de la primera si no se especificó.
                const firstLen = palabrasForzadas[0].length;

                pool = [...palabrasForzadas]; // Copia para no mutar
                targetLen = firstLen; // Referencia inicial

                setConfig({ lang: idioma, length: targetLen });
                setIsCustomGame(true);
            }
            // CASO 2: Diccionario Aleatorio
            else {
                // Las 2000 más usadas de esa longitud
                pool = conocidas.filter(w => w.length === config.length && /^[A-Z]+$/.test(w)).slice(0, 2000);
                pool.sort(() => Math.random() - 0.5);
                setIsCustomGame(false);
            }

            if (pool.length === 0) throw new Error("No hay palabras válidas");

            // Validación: CUALQUIER forma del diccionario (plurales, conjugaciones…) de 4 a 9 letras.
            const validSet = new Set([...validas].filter(w => w.length >= 4 && w.length <= 9));

            // IMPORTANTE: Aseguramos que las palabras del recurso (que pueden ser raras) estén sí o sí
            pool.forEach(p => validSet.add(p));

            setValidWords(validSet);
            setPoolPalabras(pool);
            setScore(0);

            // Si es autoStart (Olímpico) o ya elegimos modo, arrancamos. 
            // Si no, vamos a selección de modo.
            if (autoStart) {
                siguientePalabra(pool);
            } else {
                setScreen('MODE_SELECT');
            }

        } catch (e) {
            console.error(e);
            setMessage("Error cargando.");
            setScreen('CONFIG');
        }
    };
    // FUNCIÓN PARA SACAR LA SIGUIENTE PALABRA (Ciclo Contrarreloj)
    const siguientePalabra = (currentPool) => {
        let pool = currentPool || poolPalabras;

        if (pool.length === 0) {
            // Se acabaron las palabras del recurso
            if (isCustomGame && gameMode === 'TIME_ATTACK') {
                setScreen('VICTORY'); // Fin del juego (ha hecho todas)
                return;
            }
            // Si es diccionario infinito, no debería pasar, pero por si acaso
            return;
        }

        const nextWord = pool[0];
        const remainingPool = pool.slice(1);

        setPoolPalabras(remainingPool);
        setSolution(nextWord);
        setGuesses([]);
        setCurrentGuess("");
        setShakeRow(false);
        setEsperando(false);
        setScreen('GAME');
    };

    // PROCESAR INTENTO
    const validarIntento = () => {
        const newGuesses = [...guesses, currentGuess];
        setGuesses(newGuesses);
        setCurrentGuess("");

        const giro = solution.length * 130 + 450;   // lo que tarda en girar la fila
        if (currentGuess === solution) {
            // --- ACIERTO ---
            setEsperando(true);
            setTimeout(() => {
                sonidoCorrecto(); sonidoPalabra(solution.length);
                lanzarLetras(window.innerWidth / 2, window.innerHeight * 0.4, solution, '#22c55e');
            }, giro);
            if (gameMode === 'TIME_ATTACK') {
                setScore(s => s + 1);
                setTimeout(() => showMessage("¡Bien! +1 🚀"), giro);
                setTimeout(() => siguientePalabra(null), giro + 900);
            } else {
                setTimeout(() => setScreen('VICTORY'), giro + 900);
            }
        }
        else if (newGuesses.length >= 6) {
            // --- FALLO ---
            setEsperando(true);
            setTimeout(() => sonidoIncorrecto(), giro);
            if (gameMode === 'TIME_ATTACK') {
                setTimeout(() => showMessage(`Era: ${solution}`), giro);
                // En contrarreloj, si fallas, pasas a la siguiente sin sumar punto
                setTimeout(() => siguientePalabra(null), giro + 1500);
            } else {
                setTimeout(() => setScreen('DERROTA'), giro + 300);
            }
        }
    };

    // --- HELPERS ---
    const procesarRecurso = (data, forceStart = false, intento = 0) => {
        let palabrasCandidatas = [];
        if (data.hojas) {
            data.hojas.forEach(h => {
                if (h.palabras && Array.isArray(h.palabras)) {
                    h.palabras.forEach(palabra => {
                        const limpia = normalizeWord(palabra);
                        if (limpia && /^[A-ZÑ]+$/.test(limpia) && limpia.length >= 4 && limpia.length <= 9) {
                            palabrasCandidatas.push(limpia);
                        }
                    });
                }
            });
        }

        if (palabrasCandidatas.length === 0) {
            if (intento < 2) {
                // Reintenta en 2s, pero solo si el componente sigue montado
                setTimeout(() => {
                    // hasFinishedRef es false = componente activo
                    // En modo olímpico esto evita actuar sobre componente desmontado
                    if (modoOlimpico && hasFinishedRef.current) return;
                    procesarRecurso(data, forceStart, intento + 1);
                }, 2000);
                return;
            }
            throw new Error("Sin palabras válidas.");
        }
        palabrasCandidatas.sort(() => Math.random() - 0.5);

        // Configurar tiempo si el recurso lo trae
        if (data.config?.tiempo && !modoOlimpico) setTiempoRestante(data.config.tiempo);

        cargarDiccionarioYJugar(palabrasCandidatas, data.config?.idioma || 'ES', forceStart);
    };

    const cargarNivelPersonalizado = async () => {
        if (!customCode.trim()) return showMessage("Escribe un código");
        setScreen('LOADING');
        try {
            let q = query(collection(db, "resources"), where("accessCode", "==", customCode.toUpperCase().trim()));
            let snap = await getDocs(q);
            if (snap.empty) {
                q = query(collection(db, "resources"), where("hojasCodes", "array-contains", customCode.toUpperCase().trim()));
                snap = await getDocs(q);
            }
            if (snap.empty) throw new Error("Código no encontrado");

            const data = snap.docs[0].data();
            if (data.tipoJuego !== 'WORDLE') {
                setMessage("Código no válido para Wordle");
                setScreen('CONFIG');
                return;
            }
            procesarRecurso(data);
        } catch (e) {
            console.error(e);
            setMessage("Error al buscar.");
            setScreen('CONFIG');
        }
    };

    const buscarRecursosPublicos = async () => {
        setBuscando(true);
        try {
            const q = query(collection(db, "resources"), where("tipoJuego", "==", "WORDLE"), where("isPrivate", "==", false), limit(50));
            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const clean = (t) => t ? t.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            const filtrados = docs.filter(r => {
                const fTema = clean(filtros.tema);
                const cumpleTema = !filtros.tema || clean(r.titulo).includes(fTema);
                const cumpleCiclo = !filtros.ciclo || r.ciclo === filtros.ciclo;
                return cumpleTema && cumpleCiclo;
            });
            setBibliotecaWordle(filtrados);
        } catch (e) { console.error(e); }
        setBuscando(false);
    };

    // Manejo de Teclado y Inputs
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (screen !== 'GAME') return;
            const key = e.key.toUpperCase();
            if (key === 'ENTER') handleKey('ENTER');
            else if (key === 'BACKSPACE') handleKey('DEL');
            else if (/^[A-ZÑ]$/.test(key)) handleKey(key);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [screen, currentGuess, esperando]);

    const handleKey = (key) => {
        if (esperando) return;
        const targetLen = solution.length;
        if (key === 'ENTER') {
            if (currentGuess.length !== targetLen) { showMessage("Faltan letras"); triggerShake(); return; }
            if (!validWords.has(currentGuess)) { showMessage("No está en el diccionario"); triggerShake(); return; }
            validarIntento();
        }
        else if (key === 'DEL') setCurrentGuess(prev => prev.slice(0, -1));
        else if (currentGuess.length < targetLen) { sonidoFicha(currentGuess.length); setCurrentGuess(prev => prev + key); }
    };

    // 'correcta' | 'presente' | 'ausente' (respeta letras repetidas)
    const estadoCelda = (index, guessStr) => {
        const solArr = solution.split('');
        const guessArr = guessStr.split('');
        const solFreq = {};
        solArr.forEach(c => solFreq[c] = (solFreq[c] || 0) + 1);
        const statusArr = new Array(solution.length).fill('absent');
        guessArr.forEach((c, i) => { if (c === solArr[i]) { statusArr[i] = 'correct'; solFreq[c]--; } });
        guessArr.forEach((c, i) => { if (statusArr[i] === 'correct') return; if (solFreq[c] > 0) { statusArr[i] = 'present'; solFreq[c]--; } });
        return { correct: 'correcta', present: 'presente', absent: 'ausente' }[statusArr[index]];
    };
    // Mejor estado conocido de cada letra para colorear el teclado
    const estadoTeclas = useMemo(() => {
        const rango = { ausente: 1, presente: 2, correcta: 3 };
        const m = {};
        guesses.forEach(g => g.split('').forEach((ch, i) => {
            const e = estadoCelda(i, g);
            if (!m[ch] || rango[e] > rango[m[ch]]) m[ch] = e;
        }));
        return m;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guesses, solution]);

    const showMessage = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 2000); };
    const triggerShake = () => { setShakeRow(true); sonidoIncorrecto(); setTimeout(() => setShakeRow(false), 500); };
    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // Lógica Ranking (Simplificada)
    const guardarPuntuacion = async () => { /* Tu lógica de guardar */ showMessage("Guardado"); setScreen('CONFIG'); };
    const cargarRanking = async () => { /* Tu lógica de cargar */ };


    // =========================================================
    // VISTAS (estética neón compartida con VaniLa: src/vanila/comun.jsx)
    // =========================================================

    const contrarreloj = modoOlimpico || gameMode === 'TIME_ATTACK';
    const nLetras = solution.length || config.length;
    const tamCelda = Math.max(34, Math.min(60, Math.floor((anchoVentana - 40 - (nLetras - 1) * 6) / nLetras)));
    const tamTecla = Math.max(26, Math.min(46, Math.floor((anchoVentana - 24 - 9 * 5) / 10)));
    const marco = (contenido) => (
        <>
            <style>{ESTILOS_CSS + WORDLE_CSS}</style>
            {contenido}
            <CapaLetras />
        </>
    );

    if (!presentacionVista) return marco(
        <PantallaPresentacionWordle
            presentacion={recurso.presentacion}
            onEmpezar={() => setPresentacionVista(true)}
            onExit={onExit}
        />
    );

    if (screen === 'LOADING') return marco(
        <Pantalla zIndex={Z_WORDLE}>
            <TituloWordle tam={Math.min(56, (anchoVentana - 60) / 7)} />
            <div style={{ color: T.suave, marginTop: 24, fontWeight: 700, animation: 'nlParpadeo 1.2s infinite' }}>Cargando diccionario…</div>
        </Pantalla>
    );

    // --- SELECCIÓN DE MODO ---
    if (screen === 'MODE_SELECT') return marco(
        <Pantalla zIndex={Z_WORDLE}>
            <div style={{ position: 'fixed', top: 14, left: 14, zIndex: 2 }}><Boton onClick={() => setScreen('CONFIG')} color={T.suave}>← Volver</Boton></div>
            <TituloWordle tam={Math.min(56, (anchoVentana - 60) / 7)} />
            <div style={{ color: T.suave, fontWeight: 800, letterSpacing: 2, margin: '22px 0 18px' }}>¿CÓMO QUIERES JUGAR?</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                    ['CLASSIC', '🔍', 'Clásico', 'Adivina una palabra en 6 intentos.', W.correcta],
                    ['TIME_ATTACK', '⚡', 'Contrarreloj · 5 min', isCustomGame ? 'Completa todas las palabras del reto.' : '¡Palabras infinitas! ¿Cuántas sacas?', T.rosa],
                ].map(([modo, emo, nom, desc, c]) => (
                    <button key={modo} className="nl-btn" onClick={() => {
                        despertarAudio();
                        setGameMode(modo);
                        if (modo === 'TIME_ATTACK') setTiempoRestante(300);
                        siguientePalabra(null);
                    }} style={{
                        width: 260, padding: '24px 22px', borderRadius: 22, cursor: 'pointer', textAlign: 'left', fontFamily: FUENTE,
                        background: `linear-gradient(160deg, ${c}22, rgba(20,18,45,0.9))`, border: `2px solid ${c}`, color: T.texto, boxShadow: `0 0 28px ${c}33`,
                    }}>
                        <div style={{ fontSize: '2.3rem' }}>{emo}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: c, margin: '6px 0' }}>{nom}</div>
                        <div style={{ color: T.suave, fontSize: '0.9rem', lineHeight: 1.45 }}>{desc}</div>
                    </button>
                ))}
            </div>
        </Pantalla>
    );

    // --- PANTALLA DE JUEGO ---
    if (screen === 'GAME') return marco(
        <Pantalla zIndex={Z_WORDLE} centrar={false}>
            <Cabecera
                izquierda={!modoOlimpico ? <Boton onClick={() => setScreen('CONFIG')} color={T.suave}>← Menú</Boton> : <span />}
                centro={
                    <div>
                        <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: '0.95rem', color: W.correcta, textShadow: `0 0 12px ${W.correcta}` }}>WORDLE</div>
                        {contrarreloj && <div style={{ fontWeight: 900, color: T.ambar, fontSize: '1.1rem', textShadow: `0 0 10px ${T.ambar}` }}>⭐ {score}</div>}
                    </div>
                }
                derecha={contrarreloj
                    ? <Reloj restante={tiempoRestante} total={tiempoInicialRef.current || 300} tam={52} />
                    : <span style={{ fontFamily: 'monospace', fontWeight: 800, padding: '6px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.borde}` }}>{formatTime(elapsedTime)}</span>}
            />

            {/* Cuadrícula */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0 14px', perspective: 800 }}>
                {Array.from({ length: 6 }).map((_, fila) => {
                    const evaluada = guesses[fila];
                    const actual = fila === guesses.length;
                    const texto = evaluada || (actual ? currentGuess : '');
                    return (
                        <div key={fila + '-' + solution} className="nl-anim" style={{ display: 'flex', gap: 6, justifyContent: 'center', animation: actual && shakeRow ? 'nlShake .4s' : undefined }}>
                            {Array.from({ length: nLetras }).map((_, j) => {
                                const ch = texto[j] || '';
                                const est = evaluada ? estadoCelda(j, evaluada) : null;
                                const c = est ? W[est] : null;
                                return (
                                    <div key={j + (evaluada ? '-e' : ch ? '-' + ch : '')} className="nl-anim" style={{
                                        width: tamCelda, height: tamCelda, borderRadius: Math.max(8, tamCelda * 0.18), boxSizing: 'border-box',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: FUENTE, fontWeight: 900, fontSize: tamCelda * 0.5, color: '#fff',
                                        border: est ? `2px solid ${c}` : ch ? `2px solid ${T.lila}` : '2px dashed rgba(255,255,255,0.12)',
                                        background: est ? `linear-gradient(160deg, ${c}, ${c}aa)` : ch ? `${T.lila}22` : 'rgba(255,255,255,0.02)',
                                        boxShadow: est && est !== 'ausente' ? `0 0 16px ${c}88` : ch && !est ? `0 0 10px ${T.lila}55` : 'none',
                                        textShadow: est ? '0 1px 2px rgba(0,0,0,0.4)' : `0 0 8px ${T.lila}`,
                                        animation: est ? `wlGira .55s ease ${j * 0.13}s both` : ch ? 'nlPop .18s ease-out' : undefined,
                                    }}>{ch}</div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            <div style={{ minHeight: 34 }}>
                {message && <span key={message} className="nl-anim" style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 20, fontWeight: 800, background: T.ambar, color: '#0A0918', boxShadow: `0 0 20px ${T.ambar}88`, animation: 'nlPop .25s ease-out' }}>{message}</span>}
            </div>

            {/* Teclado: cada tecla toma el color de lo que ya se sabe de esa letra */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%', maxWidth: 560, marginTop: 6 }}>
                {(LANGUAGES[config.lang] || LANGUAGES['ES']).keyboard.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: 5, justifyContent: 'center', width: '100%' }}>
                        {i === 2 && <Tecla onClick={() => handleKey('ENTER')} ancho={tamTecla * 1.6} color={W.correcta} relleno>↵</Tecla>}
                        {row.map(char => {
                            const est = estadoTeclas[char];
                            return <Tecla key={char} onClick={() => handleKey(char)} ancho={tamTecla} color={est ? W[est] : null} relleno={!!est}>{char}</Tecla>;
                        })}
                        {i === 2 && <Tecla onClick={() => handleKey('DEL')} ancho={tamTecla * 1.6} color={T.rojo}>⌫</Tecla>}
                    </div>
                ))}
            </div>
        </Pantalla>
    );

    // --- RESULTADOS ---
    if (screen === 'VICTORY' || screen === 'TIMEOUT' || screen === 'DERROTA') {
        const gano = screen === 'VICTORY';
        const c = gano ? W.correcta : screen === 'TIMEOUT' ? T.ambar : T.rojo;
        return marco(
            <Pantalla zIndex={Z_WORDLE}>
                <Tarjeta style={{ maxWidth: 480, width: '100%', boxSizing: 'border-box', textAlign: 'center', border: `2px solid ${c}`, boxShadow: `0 0 50px ${c}44`, animation: 'nlPop .4s ease-out' }}>
                    <div style={{ fontSize: '3rem' }}>{gano ? '🏆' : screen === 'TIMEOUT' ? '⏳' : '😅'}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: c, textShadow: `0 0 18px ${c}` }}>
                        {gano ? '¡COMPLETADO!' : screen === 'TIMEOUT' ? '¡TIEMPO AGOTADO!' : '¡Casi!'}
                    </div>
                    {gameMode === 'TIME_ATTACK' ? (
                        <div style={{ margin: '14px 0' }}>
                            <div style={{ fontSize: '4rem', fontWeight: 900, color: T.ambar, textShadow: `0 0 24px ${T.ambar}`, lineHeight: 1 }}>{score}</div>
                            <div style={{ color: T.suave, fontWeight: 800, letterSpacing: 2, fontSize: '0.8rem' }}>PALABRAS</div>
                        </div>
                    ) : (
                        <div style={{ margin: '18px 0' }}>
                            <div style={{ color: T.suave, fontSize: '0.85rem', marginBottom: 8 }}>{gano ? `En ${guesses.length} intento${guesses.length === 1 ? '' : 's'} · ${formatTime(elapsedTime)}` : 'La palabra era'}</div>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                                {solution.split('').map((ch, i) => (
                                    <div key={i} className="nl-anim" style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', background: W.correcta, boxShadow: `0 0 12px ${W.correcta}88`, animation: `wlGira .5s ease ${i * 0.1}s both` }}>{ch}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    {!modoOlimpico ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 8 }}>
                            {gameMode !== 'TIME_ATTACK' && poolPalabras.length > 0 && <Boton onClick={() => siguientePalabra(null)} color={W.correcta} relleno grande>🔁 Otra palabra</Boton>}
                            {screen !== 'DERROTA' && !usuario && <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Tu nombre" maxLength={12} style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.borde}`, background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '1rem', fontFamily: FUENTE, textAlign: 'center', outline: 'none', width: 220 }} />}
                            {screen !== 'DERROTA' && usuario && <div style={{ color: T.ambar }}>Jugador: <b>{usuario.displayName}</b></div>}
                            {screen !== 'DERROTA' && <Boton onClick={guardarPuntuacion} color={W.correcta} relleno>💾 Guardar resultado</Boton>}
                            <Boton onClick={() => setMostrarEnvio(true)} color={T.ambar} relleno>📤 Enviar al profesor</Boton>
                            <Boton onClick={() => setScreen('CONFIG')} color={T.suave}>Menú principal</Boton>
                        </div>
                    ) : (
                        <div style={{ color: T.ambar, fontWeight: 800, marginTop: 20, fontSize: '1.2rem', animation: 'nlParpadeo 1.4s infinite' }}>
                            Enviando {score} puntos al profesor… 🚀
                        </div>
                    )}
                </Tarjeta>
                {mostrarEnvio && <ModalEnviarProfe datos={{ recursoId: recurso?.id, recursoTitulo: recurso?.titulo, score, idioma: config.lang, longitud: config.length, modo: gameMode, tiempo: elapsedTime, intentos: guesses.length }} onClose={() => setMostrarEnvio(false)} />}
            </Pantalla>
        );
    }

    // --- PANTALLA INICIAL (CONFIG) ---
    const etq = { color: T.suave, fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' };
    return marco(
        <Pantalla zIndex={Z_WORDLE} centrar={false}>
            <div style={{ position: 'fixed', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 2, pointerEvents: 'none' }}>
                <span style={{ pointerEvents: 'auto' }}>{onExit ? <Boton onClick={onExit} color={T.suave}>← Volver</Boton> : null}</span>
                <span style={{ pointerEvents: 'auto' }}><BotonSonido /></span>
            </div>
            <div style={{ marginTop: 64 }}><TituloWordle tam={Math.min(64, (anchoVentana - 60) / 7)} /></div>
            <p style={{ color: T.suave, textAlign: 'center', maxWidth: 480, lineHeight: 1.5, margin: '18px 0 20px' }}>
                Adivina la palabra secreta en 6 intentos. <span style={{ color: W.correcta, fontWeight: 800 }}>Verde</span>: letra en su sitio · <span style={{ color: W.presente, fontWeight: 800 }}>amarillo</span>: está en otro sitio.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 520, alignItems: 'stretch' }}>
                {/* JUEGO ALEATORIO */}
                <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                        <div style={etq}>🌐 Idioma</div>
                        <Opciones color={W.correcta} valor={config.lang} onChange={k => setConfig({ ...config, lang: k })} opciones={Object.keys(LANGUAGES).map(k => [k, LANGUAGES[k].label])} />
                    </div>
                    <div>
                        <div style={etq}>Letras</div>
                        <Opciones color={W.correcta} valor={config.length} onChange={n => setConfig({ ...config, length: n })} opciones={[4, 5, 6, 7, 8].map(n => [n, String(n)])} />
                    </div>
                    <Boton onClick={() => { despertarAudio(); cargarDiccionarioYJugar(null, null, false); }} color={W.correcta} relleno grande>▶ JUGAR</Boton>
                    {message && <div style={{ color: T.rojo, textAlign: 'center', fontWeight: 700 }}>⚠ {message}</div>}
                </Tarjeta>

                {/* CÓDIGO DE PROFE */}
                <Tarjeta style={{ border: `1px solid ${T.cian}55` }}>
                    <div style={{ ...etq, color: T.cian }}>📘 Jugar desafío del profe</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={6}
                            style={{ flex: 1, minWidth: 0, padding: '12px', fontSize: '1.2rem', letterSpacing: 4, textAlign: 'center', borderRadius: 12, border: `1.5px solid ${T.cian}66`, background: 'rgba(255,255,255,0.06)', color: 'white', fontWeight: 800, fontFamily: FUENTE, outline: 'none' }} />
                        <Boton onClick={cargarNivelPersonalizado} color={T.cian} relleno><Search size={20} /></Boton>
                    </div>
                </Tarjeta>

                {/* BUSCADOR */}
                <Tarjeta style={{ border: `1px solid ${T.lila}55` }}>
                    <Boton onClick={buscarRecursosPublicos} color={T.lila} style={{ width: '100%' }}>{buscando ? 'Buscando…' : '🔍 Explorar Wordles públicos'}</Boton>
                    {bibliotecaWordle.length > 0 && (
                        <div style={{ marginTop: 14, display: 'flex', overflowX: 'auto', gap: 10, paddingBottom: 6 }}>
                            {bibliotecaWordle.map(r => (
                                <button key={r.id} className="nl-btn" onClick={() => procesarRecurso(r)} style={{ minWidth: 150, padding: '12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: FUENTE, fontSize: '0.85rem', fontWeight: 700, color: T.texto, background: `${T.lila}18`, border: `1px solid ${T.lila}66` }}>
                                    {r.titulo}
                                </button>
                            ))}
                        </div>
                    )}
                </Tarjeta>

                {/* ENLACE A VANILA (mismo diccionario, con tildes) */}
                <a href={`/vanila?idioma=${(config.lang || 'ES').toLowerCase()}`} className="nl-btn" style={{
                    display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', padding: '16px 20px', borderRadius: 22,
                    background: `linear-gradient(135deg, ${T.lila}33, rgba(20,18,45,0.9))`, border: `2px solid ${T.lila}`, color: T.texto, boxShadow: `0 0 24px ${T.lila}33`,
                }}>
                    <span style={{ display: 'flex', gap: 3 }}>{['V', 'A', 'N'].map((l, i) => <span key={l} style={{ width: 22, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', border: `1.5px solid ${i === 1 ? T.cian : T.lila}`, background: `${i === 1 ? T.cian : T.lila}33` }}>{l}</span>)}</span>
                    <span style={{ flex: 1 }}>
                        <b style={{ color: T.lila, fontSize: '1.05rem' }}>¿Te gusta? Prueba VaniLa</b><br />
                        <span style={{ fontSize: '0.85rem', color: T.suave }}>9 letras contrarreloj, con tildes. Solo, duelo o tablero con amigos.</span>
                    </span>
                    <span style={{ fontSize: '1.4rem' }}>›</span>
                </a>
            </div>
        </Pantalla>
    );
}

// ─── Estética ────────────────────────────────────────────────────────────────
const Z_WORDLE = 5000;
// Colores de las casillas (claves = estados de estadoCelda)
// «ausente» en rojo apagado: se distingue bien del fondo oscuro y de las casillas vacías
const W = { correcta: '#22c55e', presente: '#eab308', ausente: '#b4383d' };
const GRIS_TITULO = '#334155';
const WORDLE_CSS = `
@keyframes wlGira { 0% { transform: rotateX(90deg); filter: brightness(1.6) } 60% { transform: rotateX(-12deg) } 100% { transform: rotateX(0); filter: none } }
`;

// Título W-O-R-D-L-E con fichas de colores animadas
function TituloWordle({ tam = 56 }) {
    const colores = [W.correcta, W.presente, GRIS_TITULO, W.correcta, W.presente, W.correcta];
    return (
        <div style={{ display: 'flex', gap: tam * 0.12, justifyContent: 'center' }}>
            {[...'WORDLE'].map((l, i) => {
                const c = colores[i];
                return (
                    <div key={i} className="nl-anim" style={{
                        width: tam, height: tam, borderRadius: tam * 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: tam * 0.56, color: '#fff', fontFamily: FUENTE, textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        background: `linear-gradient(160deg, ${c}, ${c}99)`, boxShadow: c === GRIS_TITULO ? 'none' : `0 0 18px ${c}77`,
                        border: `2px solid ${c}`, '--r': `${(i % 2 ? 1 : -1) * 3}deg`,
                        animation: `wlGira .6s ease ${i * 0.1}s both, nlFlota 2.6s ease-in-out ${1 + i * 0.12}s infinite`,
                    }}>{l}</div>
                );
            })}
        </div>
    );
}

const Tecla = ({ children, onClick, ancho, color, relleno }) => (
    <button className="nl-btn" onClick={onClick} style={{
        width: ancho, height: Math.max(44, ancho * 1.25), padding: 0, borderRadius: 10, cursor: 'pointer', flexShrink: 1, minWidth: 0,
        fontFamily: FUENTE, fontWeight: 900, fontSize: Math.max(13, ancho * 0.42), color: '#fff',
        border: `1.5px solid ${color || 'rgba(255,255,255,0.14)'}`,
        background: relleno && color ? `linear-gradient(160deg, ${color}, ${color}bb)` : 'rgba(255,255,255,0.07)',
        boxShadow: relleno && color && color !== W.ausente ? `0 0 12px ${color}66` : 'none',
        opacity: relleno && color === W.ausente ? 0.8 : 1,
    }}>{children}</button>
);
