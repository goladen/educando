
import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, Settings, Trophy, Search, BookOpen, Globe, ArrowLeft, Zap, Clock } from 'lucide-react';
import Confetti from 'react-confetti';

// --- CONFIGURACIÓN DE IDIOMAS ---
const LANGUAGES = {
    ES: {
        label: 'Español',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt',
        keyboard: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']]
    },
    CA: {
        label: 'Català',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ca/ca_50k.txt',
        keyboard: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']]
    },
    EN: {
        label: 'English',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
        keyboard: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']]
    },
    FR: {
        label: 'Français',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt',
        keyboard: [['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'], ['W', 'X', 'C', 'V', 'B', 'N']]
    }
};

export default function TextWordleGame({ usuario, onExit, recurso, modoOlimpico = false, tiempoOlimpico = null, hojaOlimpica = 'General', onOlimpicoFinish = null }) {

    // --- ESTADOS DE PANTALLA ---
    const [screen, setScreen] = useState('CONFIG'); // CONFIG, LOADING, MODE_SELECT, GAME, VICTORY, RANKING_VIEW, TIMEOUT

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
            const t = setInterval(() => {
                setTiempoRestante(prev => {
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
            const langData = LANGUAGES[idioma] || LANGUAGES['ES'];
            const response = await fetch(langData.url);
            if (!response.ok) throw new Error("Error diccionario");
            const text = await response.text();

            const allWords = text.split('\n').map(line => {
                const [word] = line.split(' ');
                return word ? normalizeWord(word) : '';
            });

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
                // Filtramos las 2000 más comunes de esa longitud
                pool = allWords.filter(w => w.length === config.length && /^[A-ZÑ]+$/.test(w)).slice(0, 2000);
                pool.sort(() => Math.random() - 0.5);
                setIsCustomGame(false);
            }

            if (pool.length === 0) throw new Error("No hay palabras válidas");

            // --- CORRECCIÓN AQUÍ ---
            // Creamos un diccionario de validación "generoso".
            // Aceptamos cualquier palabra común (top 40.000) que tenga entre 4 y 9 letras.
            // Esto permite que el alumno escriba cualquier palabra válida del idioma, 
            // no solo las que están en el recurso del profesor.
            const validSet = new Set(
                allWords.filter(w =>
                    /^[A-ZÑ]+$/.test(w) &&
                    w.length >= 4 && w.length <= 9 // Aceptamos rango amplio para evitar errores de longitud
                ).slice(0, 40000) // Ampliamos el diccionario general
            );

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
        setScreen('GAME');
    };

    // PROCESAR INTENTO
    const validarIntento = () => {
        const newGuesses = [...guesses, currentGuess];
        setGuesses(newGuesses);
        setCurrentGuess("");

        if (currentGuess === solution) {
            // --- ACIERTO ---
            if (gameMode === 'TIME_ATTACK') {
                setScore(s => s + 1);
                showMessage("¡Bien! +1 Pts 🚀");
                setTimeout(() => {
                    siguientePalabra(null);
                }, 1000);
            } else {
                setScreen('VICTORY');
                showMessage("¡Correcto! 🏆");
            }
        }
        else if (newGuesses.length >= 6) {
            // --- FALLO ---
            if (gameMode === 'TIME_ATTACK') {
                showMessage(`Era: ${solution}`);
                // En contrarreloj, si fallas, pasas a la siguiente sin sumar punto
                setTimeout(() => {
                    siguientePalabra(null);
                }, 1500);
            } else {
                alert(`La palabra era: ${solution}`);
                setScreen('CONFIG');
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
    }, [screen, currentGuess]);

    const handleKey = (key) => {
        const targetLen = solution.length;
        if (key === 'ENTER') {
            if (currentGuess.length !== targetLen) { showMessage("Faltan letras"); triggerShake(); return; }
            if (!validWords.has(currentGuess)) { showMessage("No está en el diccionario"); triggerShake(); return; }
            validarIntento();
        }
        else if (key === 'DEL') setCurrentGuess(prev => prev.slice(0, -1));
        else if (currentGuess.length < targetLen) setCurrentGuess(prev => prev + key);
    };

    const getCellColor = (char, index, guessStr) => {
        if (!guessStr) return styles.absent;
        const solArr = solution.split('');
        const guessArr = guessStr.split('');
        const solFreq = {};
        solArr.forEach(c => solFreq[c] = (solFreq[c] || 0) + 1);
        const statusArr = new Array(solution.length).fill('absent');
        guessArr.forEach((c, i) => { if (c === solArr[i]) { statusArr[i] = 'correct'; solFreq[c]--; } });
        guessArr.forEach((c, i) => { if (statusArr[i] === 'correct') return; if (solFreq[c] > 0) { statusArr[i] = 'present'; solFreq[c]--; } });
        const status = statusArr[index];
        if (status === 'correct') return styles.correct;
        if (status === 'present') return styles.present;
        return styles.absent;
    };

    const showMessage = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 2000); };
    const triggerShake = () => { setShakeRow(true); setTimeout(() => setShakeRow(false), 500); };
    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // Lógica Ranking (Simplificada)
    const guardarPuntuacion = async () => { /* Tu lógica de guardar */ showMessage("Guardado"); setScreen('CONFIG'); };
    const cargarRanking = async () => { /* Tu lógica de cargar */ };


    // =========================================================
    // VISTAS
    // =========================================================

    if (screen === 'LOADING') return <div style={styles.screen}><div className="spin" style={{ border: '4px solid white', borderTop: '4px solid #333', borderRadius: '50%', width: '40px', height: '40px' }}></div></div>;

    // --- NUEVA PANTALLA: SELECCIÓN DE MODO ---
    if (screen === 'MODE_SELECT') return (
        <div style={styles.screen}>
            <button onClick={() => setScreen('CONFIG')} style={styles.backBtn}><ArrowLeft size={20} /> Volver</button>
            <h1 style={{ ...styles.h1, color: '#f1c40f' }}>Elige Modo</h1>

            <div style={styles.card}>
                <p style={{ marginBottom: '20px', color: '#555' }}>¿Cómo quieres jugar?</p>

                <button onClick={() => { setGameMode('CLASSIC'); siguientePalabra(null); }} style={{ ...styles.btn, background: '#3498db', marginBottom: '15px' }}>
                    <Search size={24} style={{ marginBottom: '5px' }} />
                    <div>Modo Clásico</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9 }}>Adivina 1 palabra en 6 intentos</div>
                </button>

                <button onClick={() => { setGameMode('TIME_ATTACK'); setTiempoRestante(300); siguientePalabra(null); }} style={{ ...styles.btn, background: '#e74c3c' }}>
                    <Zap size={24} style={{ marginBottom: '5px' }} />
                    <div>Contrarreloj (5 min)</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9 }}>
                        {isCustomGame ? 'Completa todas las palabras' : '¡Infinitas palabras!'}
                    </div>
                </button>
            </div>
        </div>
    );

    // --- PANTALLA DE JUEGO (Adaptada) ---
    if (screen === 'GAME') return (
        <div style={{ ...styles.screen, justifyContent: 'flex-start', background: (modoOlimpico || gameMode === 'TIME_ATTACK') ? '#7e7b5280' : '#7e7b5280' }}>
            <div style={styles.header}>
                <div style={{ ...styles.timer, background: (modoOlimpico || gameMode === 'TIME_ATTACK') ? '#e74c3c' : 'white', color: (modoOlimpico || gameMode === 'TIME_ATTACK') ? 'white' : 'black' }}>
                    {/* Reloj dinámico */}
                    {(modoOlimpico || gameMode === 'TIME_ATTACK') ?
                        <><Clock size={14} style={{ verticalAlign: 'middle' }} /> {formatTime(tiempoRestante)}</> :
                        formatTime(elapsedTime)
                    }
                </div>

                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '1px', color: 'white' }}>WORDLE</h2>
                    {(modoOlimpico || gameMode === 'TIME_ATTACK') &&
                        <span style={{ background: '#f1c40f', color: 'black', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                            ⭐ {score} pts
                        </span>
                    }
                </div>

                {!modoOlimpico && <div style={{ width: '40px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setScreen('CONFIG')}><Settings color="white" /></div>}
            </div>

            <div style={styles.gridScroll}>
                <div style={styles.gridContainer}>
                    {guesses.map((g, i) => (
                        <div key={i} style={styles.row}>
                            {g.split('').map((char, j) => (
                                <div key={j} style={{ ...styles.cell, ...getCellColor(char, j, g) }}>{char}</div>
                            ))}
                        </div>
                    ))}
                    <div style={{ ...styles.row, animation: shakeRow ? 'shake 0.4s' : 'none' }}>
                        {Array.from({ length: solution.length }).map((_, j) => (
                            <div key={j} style={{ ...styles.cell, borderColor: currentGuess[j] ? '#888' : '#333' }}>{currentGuess[j] || ''}</div>
                        ))}
                    </div>
                    {Array.from({ length: Math.max(0, 5 - guesses.length) }).map((_, i) => (
                        <div key={`empty-${i}`} style={styles.row}>
                            {Array.from({ length: solution.length }).map((_, j) => <div key={j} style={styles.cell}></div>)}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...styles.toast, opacity: message ? 1 : 0 }}>{message}</div>

            <div style={styles.keyboard}>
                {(LANGUAGES[config.lang] || LANGUAGES['ES']).keyboard.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', width: '100%', justifyContent: 'center' }}>
                        {row.map(char => (
                            <button key={char} onClick={() => handleKey(char)} style={{ ...styles.key, backgroundColor: '#818384' }}>{char}</button>
                        ))}
                    </div>
                ))}
                <div style={{ display: 'flex', gap: '5px', width: '100%', justifyContent: 'center', marginTop: '5px' }}>
                    <button onClick={() => handleKey('ENTER')} style={{ ...styles.key, width: '65px', fontSize: '0.8rem', background: '#538d4e' }}>ENTER</button>
                    <button onClick={() => handleKey('DEL')} style={{ ...styles.key, width: '65px', background: '#b04848' }}>⌫</button>
                </div>
            </div>
            <style>{`@keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-5px);} 75%{transform:translateX(5px);} }`}</style>
        </div>
    );

    // --- PANTALLA DE RESULTADOS ---
    if (screen === 'VICTORY' || screen === 'TIMEOUT') return (
        <div style={{ ...styles.screen, backgroundColor: screen === 'TIMEOUT' ? '#e74c3c' : '#27ae60' }}>
            {screen === 'VICTORY' && <Confetti recycle={false} />}
            <h1 style={{ ...styles.h1, color: 'white' }}>{screen === 'VICTORY' ? '¡COMPLETADO! 🥳' : '¡TIEMPO AGOTADO! ⏳'}</h1>

            {gameMode === 'TIME_ATTACK' ? (
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'white', fontSize: '1.2rem' }}>Has conseguido:</p>
                    <div style={{ fontSize: '4rem', color: '#f1c40f', fontWeight: 'bold', textShadow: '2px 2px 0 black' }}>{score}</div>
                    <p style={{ color: 'white' }}>Palabras</p>
                </div>
            ) : (
                    <p style={{ color: 'white', fontSize: '1.2rem' }}>Palabra: <b style={{ color: '#f1c40f' }}>{solution}</b></p>
                )}

            {!modoOlimpico ? (
                <div style={{ margin: '20px 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {!usuario && <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Tu Nombre" maxLength={12} style={styles.inputName} />}
                    {usuario && <p style={{ color: '#f1c40f', marginBottom: '10px' }}>Jugador: <b>{usuario.displayName}</b></p>}
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={guardarPuntuacion}>Guardar Resultado</button>
                    <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('CONFIG')}>Menú Principal</button>
                </div>
            ) : (
                    <div style={{ color: '#f1c40f', fontWeight: 'bold', marginTop: '30px', fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>
                        Enviando {score} puntos al profesor... 🚀
                </div>
                )}
        </div>
    );

    // --- PANTALLA INICIAL (CONFIG) ---
    return (<div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#2c3e50', zIndex: 5000 }}>
        <div style={styles.screen}>
            <button onClick={onExit} style={styles.backBtn}><ArrowLeft size={20} /> Volver</button>
            <h1 style={styles.h1}>WORDLE</h1>

            {/* ZONA 1: JUEGO ALEATORIO */}
            <div style={styles.card}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}><Globe size={16} style={{ verticalAlign: 'middle' }} /> Idioma</label>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        {Object.keys(LANGUAGES).map(k => (
                            <button key={k} onClick={() => setConfig({ ...config, lang: k })} style={{ ...styles.optionBtn, background: config.lang === k ? '#3F51B5' : '#eee', color: config.lang === k ? 'white' : '#333' }}>{LANGUAGES[k].label}</button>
                        ))}
                    </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}>Longitud: {config.length} Letras</label>
                    <input type="range" min="4" max="8" step="1" value={config.length} onChange={(e) => setConfig({ ...config, length: parseInt(e.target.value) })} style={{ width: '100%', cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div>
                </div>
                {/* BOTÓN JUGAR: AHORA LLEVA A ELEGIR MODO */}
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => cargarDiccionarioYJugar(null, null, false)}>JUGAR</button>
            </div>

            {/* ZONA 2: CÓDIGO DE PROFE */}
            <div style={{ ...styles.card, marginTop: '15px', background: '#e3f2fd', border: '1px solid #90caf9' }}>
                <label style={{ ...styles.label, color: '#1565c0' }}><BookOpen size={16} style={{ verticalAlign: 'middle' }} /> Jugar Desafío</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="CÓDIGO..." style={styles.inputCode} maxLength={6} />
                    <button onClick={cargarNivelPersonalizado} style={styles.btnSearch}><Search size={20} /></button>
                </div>
            </div>

            {/* ZONA 3: BUSCADOR */}
            <div style={{ ...styles.card, marginTop: '15px', background: '#e8f5e9', border: '1px solid #81c784' }}>
                <h3 style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}><Search size={20} /> Explorar</h3>
                <button onClick={buscarRecursosPublicos} style={{ ...styles.button, borderRadius: '10px', width: '100%', background: '#2e7d32', color: 'white', border: 'none', padding: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {buscando ? 'Buscando...' : '🔍 Buscar Wordles Públicos'}
                </button>
                {/* (Aquí iría tu lista de resultados horizontal si quieres mantenerla) */}
                {bibliotecaWordle.length > 0 && (
                    <div style={{ marginTop: '15px', display: 'flex', overflowX: 'auto', gap: '10px', paddingBottom: '10px' }}>
                        {bibliotecaWordle.map(r => (
                            <div key={r.id} onClick={() => procesarRecurso(r)} style={{ minWidth: '150px', background: 'white', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #ccc' }}>
                                <b>{r.titulo}</b>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
    );
}

// ESTILOS
const styles = {
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#2c3e50', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', fontFamily: "'Roboto', sans-serif", overflowY: 'auto', padding: '20px 0', WebkitOverflowScrolling: 'touch' },
    backBtn: { position: 'absolute', top: '10px', left: '10px', background: 'white', border: 'none', borderRadius: '20px', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', zIndex: 6000 },
    card: { background: '#fffacb', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '500px', width: '80%', textAlign: 'center', marginBottom: '20px' },
    h1: { fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0', color: '#f1c40f' },
    label: { display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#555', fontSize: '0.9rem' },
    optionBtn: { padding: '8px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '5px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: '#538d4e', color: 'white' },
    btnSecondary: { backgroundColor: '#818384', color: 'white' },
    btnOutline: { background: 'transparent', border: '2px solid #3a3a3c', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    inputCode: { flex: 1, padding: '12px', fontSize: '1.2rem', textAlign: 'center', borderRadius: '5px', border: '1px solid #90caf9', outline: 'none' },
    btnSearch: { background: '#1565c0', color: 'white', border: 'none', borderRadius: '5px', padding: '0 15px', cursor: 'pointer' },

    // Grid Wordle
    header: { padding: '10px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    timer: { fontFamily: "'Roboto Mono', monospace", background: 'white', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' },
    gridScroll: { flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px' },
    gridContainer: { display: 'flex', flexDirection: 'column', gap: '5px' },
    row: { display: 'flex', gap: '5px', marginBottom: '5px', justifyContent: 'center' },
    cell: { width: '45px', height: '45px', border: '2px solid #3a3a3c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px', fontWeight: 'bold', textTransform: 'uppercase', color: 'white' },
    correct: { backgroundColor: '#538d4e', borderColor: '#538d4e' },
    present: { backgroundColor: '#b59f3b', borderColor: '#b59f3b' },
    absent: { backgroundColor: '#3a3a3c', borderColor: '#3a3a3c' },
    keyboard: { display: 'flex', flexDirection: 'column', gap: '6px', width: '95%', maxWidth: '500px', padding: '10px', paddingBottom: '30px' },
    key: { color: 'white', padding: '15px 0', border: 'none', borderRadius: '4px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, minWidth: '25px' },
    toast: { position: 'absolute', top: '15%', background: 'white', color: 'black', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 6000 },

    inputName: { padding: '10px', width: '200px', textAlign: 'center', borderRadius: '5px', border: 'none', marginBottom: '10px', fontSize: '1rem' },
    miniInputFilter: { background: '#fffacb', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', width: '100%', boxSizing: 'border-box' },


};
