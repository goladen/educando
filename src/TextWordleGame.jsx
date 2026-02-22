import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
// Importamos lo necesario para buscar recursos por código
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, Settings, Trophy, Search, BookOpen, Globe,ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
// CONFIGURACIÓN DE IDIOMAS Y RECURSOS (Listas de Frecuencia)
const LANGUAGES = {
    ES: {
        label: 'Español',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt',
        keyboard: [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
            ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
        ]
    },
    EN: {
        label: 'English',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
        keyboard: [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
        ]
    },
    FR: {
        label: 'Français',
        url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt',
        keyboard: [
            ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
            ['W', 'X', 'C', 'V', 'B', 'N']
        ]
    }
};

export default function TextWordleGame({ usuario, onExit, recursoInicial }) {
    // --- ESTADOS DE PANTALLA ---
    const [screen, setScreen] = useState('CONFIG'); // CONFIG, LOADING, GAME, VICTORY, RANKING_VIEW

    // Configuración actual (Idioma y Longitud)
    const [config, setConfig] = useState({ lang: 'ES', length: 5 });

    // Estado para "Jugar Nivel de Profe"
    const [customCode, setCustomCode] = useState('');
    const [isCustomGame, setIsCustomGame] = useState(false); // Para saber si guardamos ranking como 'Custom'

    // --- DATOS DEL JUEGO ---
    const [solution, setSolution] = useState("");
    const [validWords, setValidWords] = useState(new Set()); // Diccionario grande para validar intentos

    // --- ESTADOS DE PARTIDA ---
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [shakeRow, setShakeRow] = useState(false);
    const [message, setMessage] = useState(null);

    // --- TIMER ---
    const [startTime, setStartTime] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef(null);

    // --- RANKING ---
    const [ranking, setRanking] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    const [playerName, setPlayerName] = useState(usuario?.displayName || '');
    // --- ESTADOS PARA EL BUSCADOR ---
    // --- ESTADOS PARA EL BUSCADOR (NUEVO) ---
    const [bibliotecaWordle, setBibliotecaWordle] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [filtros, setFiltros] = useState({
        tema: '', ciclo: 'Secundaria',
        pais: '', region: '', poblacion: '', autor: ''
    });
    useEffect(() => {
        if (recursoInicial) {
            try {
                procesarRecurso(recursoInicial);
            } catch (error) {
                console.error("Error al iniciar Wordle:", error);
                alert(error.message);
                setScreen('CONFIG');
            }
        }
    }, [recursoInicial]);
    // Función de búsqueda con filtros avanzados
    const buscarRecursosPublicos = async () => {
        setBuscando(true);
        try {
            // Consulta base a Firebase
            const q = query(
                collection(db, "resources"),
                where("tipoJuego", "==", "WORDLE"),
                where("isPrivate", "==", false),
                // where("isFinished", "==", true), // Descomenta esta línea si ya tienes este campo en la BD
                limit(50)
            );
            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filtrado "Amplio" en el cliente (insensible a mayúsculas/acentos)
            const filtrados = docs.filter(r => {
                const clean = (t) => t ? t.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
                const fTema = clean(filtros.tema);
                const fPais = clean(filtros.pais);
                const fReg = clean(filtros.region);
                const fPob = clean(filtros.poblacion);
                const fAut = clean(filtros.autor);

                // Comprobamos si cumple TODOS los filtros activos
                const cumpleTema = !filtros.tema || clean(r.titulo).includes(fTema) || clean(r.temas).includes(fTema);
                const cumpleCiclo = !filtros.ciclo || r.ciclo === filtros.ciclo;
                const cumplePais = !filtros.pais || clean(r.pais).includes(fPais);
                const cumpleRegion = !filtros.region || clean(r.region).includes(fReg);
                const cumplePob = !filtros.poblacion || clean(r.poblacion).includes(fPob);
                const cumpleAutor = !filtros.autor || clean(r.profesorNombre).includes(fAut);

                return cumpleTema && cumpleCiclo && cumplePais && cumpleRegion && cumplePob && cumpleAutor;
            });

            setBibliotecaWordle(filtrados);
        } catch (e) {
            console.error("Error buscando:", e);
        }
        setBuscando(false);
    };
    // =========================================================
    // 1. GESTIÓN DE DICCIONARIOS Y MODOS DE JUEGO
    // =========================================================

    // Normaliza palabras: quita acentos y pone mayúsculas
    const normalizeWord = (word) => {
        return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    };

    // Función principal para iniciar cualquier modo
    const cargarDiccionarioYJugar = async (palabraForzada = null, idiomaForzado = null) => {
        setScreen('LOADING');
        const idioma = idiomaForzado || config.lang; // Si viene forzado (custom), lo usamos

        try {
            // 1. Descargamos el diccionario de frecuencia del idioma correspondiente
            // Esto es necesario SIEMPRE para validar que lo que escribe el alumno existe
            const langData = LANGUAGES[idioma] || LANGUAGES['ES'];
            const response = await fetch(langData.url);

            if (!response.ok) throw new Error("Error de conexión al diccionario");

            const text = await response.text();

            // 2. Procesamos todas las palabras del idioma
            const allWords = text.split('\n').map(line => {
                const [word] = line.split(' ');
                return word ? normalizeWord(word) : '';
            });

            // 3. Configurar la partida según el modo
            let targetLen = config.length;
            let solucionFinal = "";

            // MODO A: NIVEL DE PROFE (Palabra Forzada)
            if (palabraForzada) {
                targetLen = palabraForzada.length;
                solucionFinal = palabraForzada;

                // Actualizamos la config visual para que coincida con la palabra del profe
                setConfig({ lang: idioma, length: targetLen });
                setIsCustomGame(true);
            }
            // MODO B: ALEATORIO (Normal)
            else {
                // Filtramos las 1000 más comunes de la longitud elegida
                const topCommon = allWords.filter(w => w.length === config.length && /^[A-ZÑ]+$/.test(w)).slice(0, 1000);

                if (topCommon.length === 0) throw new Error("No hay palabras comunes de esa longitud");

                solucionFinal = topCommon[Math.floor(Math.random() * topCommon.length)];
                setIsCustomGame(false);
            }

            // 4. Crear el Set de Validación (Permitimos las 20.000 más comunes para validar)
            // Filtramos por la longitud que vamos a jugar
            const validSet = new Set(
                allWords
                    .filter(w => w.length === targetLen && /^[A-ZÑ]+$/.test(w))
                    .slice(0, 20000)
            );

            // Aseguramos que la solución sea válida (por si es una palabra rara del profe)
            validSet.add(solucionFinal);

            // 5. Guardamos estados e iniciamos
            setValidWords(validSet);
            setSolution(solucionFinal);
            iniciarJuegoLogica();

        } catch (e) {
            console.error(e);
            setMessage("Error cargando. Revisa tu conexión.");
            setScreen('CONFIG');
        }
    };

    // Lógica para buscar el recurso en Firebase
    // Lógica para buscar el recurso en Firebase
    const cargarNivelPersonalizado = async () => {
        if (!customCode.trim()) return showMessage("Escribe un código");

        setScreen('LOADING');
        try {
            // Buscamos por accessCode (código global)
            let q = query(collection(db, "resources"), where("accessCode", "==", customCode.toUpperCase().trim()));
            let snap = await getDocs(q);

            // Si no encuentra, buscamos por código de hoja
            if (snap.empty) {
                q = query(collection(db, "resources"), where("hojasCodes", "array-contains", customCode.toUpperCase().trim()));
                snap = await getDocs(q);
            }

            if (snap.empty) throw new Error("Código no encontrado");

            const data = snap.docs[0].data();

            // --- FILTRO DE SEGURIDAD (NUEVO) ---
            if (data.tipoJuego !== 'WORDLE') {
                setMessage("Código no válido para esta aplicación"); // Mensaje de error
                setScreen('CONFIG');
                return; // Detenemos la ejecución aquí
            }
            // -----------------------------------

            procesarRecurso(data);

        } catch (e) {
            console.error(e);
            setMessage(e.message === "Código no encontrado" ? "Código no encontrado" : "Error de conexión");
            setScreen('CONFIG');
        }
    };

    const procesarRecurso = (data) => {
        let palabrasCandidatas = [];

        // Como ya hemos validado que es WORDLE, buscamos directamente 'palabras'
        if (data.hojas) {
            data.hojas.forEach(h => {
                if (h.palabras && Array.isArray(h.palabras)) {
                    h.palabras.forEach(palabra => {
                        const limpia = normalizeWord(palabra);
                        // Filtro de seguridad (4 a 9 letras)
                        if (limpia && /^[A-ZÑ]+$/.test(limpia) && limpia.length >= 4 && limpia.length <= 9) {
                            palabrasCandidatas.push(limpia);
                        }
                    });
                }
            });
        }

        if (palabrasCandidatas.length === 0) {
            throw new Error("El recurso no tiene palabras válidas.");
        }

        // Elegir una al azar
        const elegida = palabrasCandidatas[Math.floor(Math.random() * palabrasCandidatas.length)];

        // Detectar idioma (o usar ES por defecto)
        const idiomaRecurso = data.config?.idioma || 'ES';

        console.log(`Recurso cargado. Palabra: ${elegida} (${idiomaRecurso})`);

        // Iniciar Juego con esa palabra
        cargarDiccionarioYJugar(elegida, idiomaRecurso);
    };

    // =========================================================
    // 2. MOTOR DE JUEGO (LÓGICA INTERNA)
    // =========================================================
    const iniciarJuegoLogica = () => {
        setGuesses([]);
        setCurrentGuess("");
        setScreen('GAME');

        // Timer Reset
        const now = Date.now();
        setStartTime(now);
        setElapsedTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - now) / 1000));
        }, 1000);
    };

    // Manejo de Teclado
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
        // Usamos solution.length porque en modo custom la config.length puede no haberse actualizado visualmente aún
        const targetLen = solution.length;

        if (key === 'ENTER') {
            if (currentGuess.length !== targetLen) {
                showMessage("Faltan letras");
                triggerShake();
                return;
            }
            if (!validWords.has(currentGuess)) {
                showMessage("No está en el diccionario");
                triggerShake();
                return;
            }
            validarIntento();
        }
        else if (key === 'DEL') {
            setCurrentGuess(prev => prev.slice(0, -1));
        }
        else {
            if (currentGuess.length < targetLen) {
                setCurrentGuess(prev => prev + key);
            }
        }
    };

    const validarIntento = () => {
        const newGuesses = [...guesses, currentGuess];
        setGuesses(newGuesses);
        setCurrentGuess("");

        if (currentGuess === solution) {
            clearInterval(timerRef.current);
            setScreen('VICTORY');
            showMessage("¡Correcto! 🏆");
        }
        else if (newGuesses.length >= 6) {
            clearInterval(timerRef.current);
            alert(`La palabra era: ${solution}`);
            setScreen('CONFIG'); // Volvemos a config al perder
        }
    };

    // =========================================================
    // 3. RANKING & UTILS
    // =========================================================
    const cargarRanking = async () => {
        setLoadingRanking(true);
        try {
            // Si es custom, mostramos un ranking genérico de 'CUSTOM' o podríamos filtrar por código si quisiéramos
            const modoStr = isCustomGame ? 'CUSTOM' : `${config.lang}-${config.length}`;
            const q = query(
                collection(db, "ranking_wordle"),
                where("modo", "==", modoStr),
                orderBy("tiempo", "asc"),
                limit(10)
            );
            const snap = await getDocs(q);
            setRanking(snap.docs.map(d => d.data()));
        } catch (e) { console.error(e); }
        setLoadingRanking(false);
    };

    const guardarPuntuacion = async () => {
        if (!playerName.trim()) return showMessage("Escribe un nombre");
        try {
            await addDoc(collection(db, "ranking_wordle"), {
                fecha: new Date(),
                nombre: playerName.trim(),
                tiempo: Number(elapsedTime),
                modo: isCustomGame ? 'CUSTOM' : `${config.lang}-${config.length}`,
                lang: config.lang
            });
            showMessage("¡Guardado!");
            cargarRanking();
            setScreen('RANKING_VIEW');
        } catch (e) { showMessage("Error al guardar"); }
    };

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(null), 2000);
    };

    const triggerShake = () => {
        setShakeRow(true);
        setTimeout(() => setShakeRow(false), 500);
    };

    // COLORES (Lógica Wordle Estricta - Dos Pasadas)
    const getCellColor = (char, index, guessStr) => {
        if (!guessStr) return styles.absent;
        const solArr = solution.split('');
        const guessArr = guessStr.split('');

        // Frecuencias
        const solFreq = {};
        solArr.forEach(c => solFreq[c] = (solFreq[c] || 0) + 1);
        const statusArr = new Array(solution.length).fill('absent');

        // Verdes
        guessArr.forEach((c, i) => {
            if (c === solArr[i]) {
                statusArr[i] = 'correct';
                solFreq[c]--;
            }
        });
        // Amarillos
        guessArr.forEach((c, i) => {
            if (statusArr[i] === 'correct') return;
            if (solFreq[c] > 0) {
                statusArr[i] = 'present';
                solFreq[c]--;
            }
        });

        const status = statusArr[index];
        if (status === 'correct') return styles.correct;
        if (status === 'present') return styles.present;
        return styles.absent;
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // =========================================================
    // 4. RENDERIZADO
    // =========================================================

    if (screen === 'LOADING') return (
        <div style={styles.screen}>
            <div className="spin" style={{ border: '4px solid #333', borderTop: '4px solid #fff', borderRadius: '50%', width: '40px', height: '40px' }}></div>
            <p style={{ marginTop: '20px', color: 'white' }}>Cargando...</p>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (screen === 'CONFIG') return (


        <div style={styles.screen}>
            <button
                onClick={onExit}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '30px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: '#333',
                    fontWeight: 'bold',
                    zIndex: 1000,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
            >
                <ArrowLeft size={20} /> Volver
                </button>


            <h1 style={styles.h1}>WORDLE</h1>
            <p style={{ color: 'white', marginBottom: '20px' }}>Configura tu partida</p>

            {/* --- ZONA 1: JUEGO ALEATORIO --- */}
            <div style={styles.card}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}><Globe size={16} style={{ verticalAlign: 'middle' }} /> Idioma</label>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        {Object.keys(LANGUAGES).map(k => (
                            <button key={k} onClick={() => setConfig({ ...config, lang: k })} style={{ ...styles.optionBtn, background: config.lang === k ? '#3F51B5' : '#eee', color: config.lang === k ? 'white' : '#333' }}>
                                {LANGUAGES[k].label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}>Longitud: {config.length} Letras</label>
                    <input type="range" min="4" max="8" step="1" value={config.length} onChange={(e) => setConfig({ ...config, length: parseInt(e.target.value) })} style={{ width: '100%', cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div>
                </div>

                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => cargarDiccionarioYJugar(null, null)}>JUGAR</button>
            </div>

            {/* --- ZONA 2: CÓDIGO DE PROFE --- */}
            <div style={{ ...styles.card, marginTop: '15px', background: '#e3f2fd', border: '1px solid #90caf9' }}>
                <label style={{ ...styles.label, color: '#1565c0' }}><BookOpen size={16} style={{ verticalAlign: 'middle' }} /> Jugar Desafio</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                        value={customCode}
                        onChange={e => setCustomCode(e.target.value.toUpperCase())}
                        placeholder="CÓDIGO..."
                        style={styles.inputCode}
                        maxLength={6}
                    />
                    <button onClick={cargarNivelPersonalizado} style={styles.btnSearch}><Search size={20} /></button>
                </div>
            </div>
            {/* --- BUSCADOR DE BIBLIOTECA (NUEVO) --- */}
         
                <div style={{ ...styles.card, marginTop: '15px', background: '#e3f2fd', border: '1px solid #90caf9' }}>

                <h3 style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Search size={20} /> Buscar sobre un tema
                        </h3>
              
                {/* Filtros Básicos */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <input
                        placeholder="Tema o Título..."
                        value={filtros.tema}
                        onChange={e => setFiltros({ ...filtros, tema: e.target.value })}
                        style={styles.miniInputFilter}
                    />
                    <select
                        value={filtros.ciclo}
                        onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })}
                        style={styles.miniInputFilter}
                    >
                        <option value="Infantil">Infantil</option>
                        <option value="Primaria">Primaria</option>
                        <option value="Secundaria">Secundaria</option>
                        <option value="Bachillerato">Bachillerato</option>
                        <option value="FP">FP</option>
                        <option value="Universidad">Universidad</option>
                    </select>
                </div>

                {/* Botón Más Filtros */}
                <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                    <button
                        onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)}
                        style={{ background: '#3F51B580', border: 'line', borderRadius:'4px', color: 'white', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                        {mostrarMasFiltros ? "- Menos filtros" : "+ Más filtros (País, Región...)"}
                    </button>
                </div>

                {/* Filtros Avanzados (Ocultos) */}
                {mostrarMasFiltros && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
                        <input placeholder="País" value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })} style={styles.miniInputFilter} />
                        <input placeholder="Región/CCAA" value={filtros.region} onChange={e => setFiltros({ ...filtros, region: e.target.value })} style={styles.miniInputFilter} />
                        <input placeholder="Localidad" value={filtros.poblacion} onChange={e => setFiltros({ ...filtros, poblacion: e.target.value })} style={styles.miniInputFilter} />
                        <input placeholder="Nombre Profesor" value={filtros.autor} onChange={e => setFiltros({ ...filtros, autor: e.target.value })} style={styles.miniInputFilter} />
                    </div>
                )}

                <button onClick={buscarRecursosPublicos} style={{ ...styles.button, borderRadius: '10px', width: '80%', background: '#2e7d32' }}>
                    {buscando ? 'Buscando...' : '🔍 Buscar Desafíos'}
                </button>

                {/* Resultados */}
                {/* RESULTADOS CON SCROLL LATERAL */}
                {/* RESULTADOS CON SCROLL LATERAL ROBUSTO */}
                <div style={{
                    marginTop: '20px',
                    width: '100%',               // Ocupa todo el ancho disponible
                    boxSizing: 'border-box',     // El padding no afecta al ancho total
                    display: 'flex',             // Disposición horizontal
                    flexWrap: 'nowrap',          // PROHIBIDO saltar de línea
                    overflowX: 'auto',        // 'auto' en vez de 'scroll' (solo sale si es necesario)
                    scrollbarWidth: 'none',   // Oculta la barra en Firefox
                    msOverflowStyle: 'none',         // Forzar scroll horizontal
                    gap: '15px',                 // Espacio entre tarjetas
                    padding: '10px 5px',         // Un poco de aire para las sombras
                    scrollBehavior: 'smooth',    // Desplazamiento suave
                    WebkitOverflowScrolling: 'touch' // Mejora para móviles (iPhone/iPad)
                }}>
                    {bibliotecaWordle.map(r => (
                        <div key={r.id} onClick={() => procesarRecurso(r)} style={{
                            minWidth: '240px',       // Ancho FIJO (importante)
                            width: '240px',          // Aseguramos que no se estire ni encoja
                            flexShrink: 0,           // PROHIBIDO encogerse (clave del fix)

                            background: 'white',
                            padding: '15px',
                            borderRadius: '12px',
                            border: '1px solid #e0e0e0',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            position: 'relative'     // Para posicionar elementos dentro si hace falta
                        }}>
                            <div style={{ marginBottom: '10px' }}>
                                <h4 style={{
                                    margin: '0 0 5px 0',
                                    color: '#2e7d32',
                                    fontSize: '15px',
                                    whiteSpace: 'nowrap',      // Texto en una línea
                                    overflow: 'hidden',        // Cortar si es muy largo
                                    textOverflow: 'ellipsis'   // Poner "..."
                                }}>
                                    {r.titulo}
                                </h4>
                                <div style={{ fontSize: '12px', color: '#555' }}>
                                    🏫 {r.ciclo}
                                </div>
                                <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>
                                    👤 {r.profesorNombre || 'Anónimo'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                    📍 {r.poblacion || 'Global'}
                                </div>
                            </div>

                            <button style={{
                                background: '#2e7d32',
                                color: 'white',
                                border: '1px',
                                padding: '8px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                width: '100%',
                                fontSize: '12px',
                                marginTop: 'auto' // Empuja el botón al fondo de la tarjeta
                            }}>
                                JUGAR
            </button>
                        </div>
                    ))}

                   
                    {/* Mensaje si no hay resultados */}
                    {bibliotecaWordle.length === 0 && !buscando && (
                        <div style={{ width: '100%', textAlign: 'center', color: '#999', padding: '20px' }}>
                            <p style={{ margin: 0, fontSize: '14px' }}>No se encontraron juegos con esos filtros.</p>
                        </div>
                    )}
                </div>







            </div>
        </div>
            );


    if (screen === 'GAME') return (
        <div style={{ ...styles.screen, justifyContent: 'flex-start' }}>
            <div style={styles.header}>
                <div style={styles.timer}>{formatTime(elapsedTime)}</div>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '1px' }}>WORDLE</h2>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>
                        {isCustomGame ? 'NIVEL PROFESOR' : `${LANGUAGES[config.lang].label} (${config.length})`}
                    </span>
                </div>
                <div style={{ width: '40px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setScreen('CONFIG')}><Settings color="white" /></div>
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
                    {/* Fila Actual */}
                    <div style={{ ...styles.row, animation: shakeRow ? 'shake 0.4s' : 'none' }}>
                        {Array.from({ length: solution.length }).map((_, j) => (
                            <div key={j} style={{ ...styles.cell, borderColor: currentGuess[j] ? '#888' : '#333' }}>
                                {currentGuess[j] || ''}
                            </div>
                        ))}
                    </div>
                    {/* Filas Restantes */}
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

    if (screen === 'RANKING_VIEW') return (
        <div style={styles.screen}>
            <h2 style={{ color: '#b59f3b' }}><Trophy /> Top 10</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
                {isCustomGame ? 'Nivel Personalizado' : `${LANGUAGES[config.lang].label} - ${config.length}`}
            </p>
            <div style={styles.rankingContainer}>
                {loadingRanking ? <p style={{ color: '#888', textAlign: 'center' }}>Cargando...</p> : (
                    <table style={styles.table}>
                        <tbody>
                            {ranking.length === 0 ? <tr><td colSpan="2" style={{ color: '#888', textAlign: 'center' }}>Sin récords</td></tr> :
                                ranking.map((r, i) => (
                                    <tr key={i}>
                                        <td style={styles.td}>{i + 1}. {r.nombre}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', color: '#538d4e' }}>{formatTime(r.tiempo)}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                )}
            </div>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('CONFIG')}>Volver</button>
        </div>
    );

    if (screen === 'VICTORY') return (
        <div style={styles.screen}>
            <Confetti recycle={false} />
            <h1 style={styles.h1}>¡EXCELENTE! 🥳</h1>
            <p style={{ color: 'white', fontSize: '1.2rem' }}>Palabra: <b style={{ color: '#538d4e' }}>{solution}</b></p>
            <p style={{ color: '#aaa' }}>Tiempo: <span style={{ color: '#538d4e', fontWeight: 'bold', fontSize: '1.5rem' }}>{formatTime(elapsedTime)}</span></p>
            <div style={{ margin: '20px 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {!usuario && <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Tu Nombre" maxLength={12} style={styles.inputName} />}
                {usuario && <p style={{ color: '#b59f3b', marginBottom: '10px' }}>Jugador: <b>{usuario.displayName}</b></p>}
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={guardarPuntuacion}>Guardar Resultado</button>
            </div>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('CONFIG')}>Jugar otra vez</button>
            <button style={{ ...styles.btnOutline, marginTop: '10px', fontSize: '0.8rem', border: 'none' }} onClick={() => { cargarRanking(); setScreen('RANKING_VIEW'); }}>Ver Ranking</button>
        </div>
    );

    return null;
}

const styles = {
    screen: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '90%',
        backgroundColor: '#7e7b5280',//'#121213',
        zIndex: 5000,
        color: 'black',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start', // CAMBIO 1: Empieza arriba en vez de centrar (para que no se corte lo de arriba)
        fontFamily: "'Roboto', sans-serif",
        overflowY: 'auto',            // CAMBIO 2: Activa el scroll vertical
        padding: '40px 0',            // CAMBIO 3: Deja un poco de aire arriba y abajo
        WebkitOverflowScrolling: 'touch' // Mejora para móviles
    },
   // card: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '350px', textAlign: 'center', color: '#333', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' },
    card: {
        background: '#fffacb',
        padding: '2rem',
        borderRadius: '20px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '80%',
        textAlign: 'center',
        marginBottom: '40px' // Un poco de margen abajo por si acaso
    
    },

    h1: { fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0' },
    label: { display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#555', fontSize: '0.9rem' },
    optionBtn: { padding: '8px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '5px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '70%' },
    btnPrimary: { backgroundColor: '#538d4e', color: 'white' },
    btnSecondary: { backgroundColor: '#818384', color: 'white' },
    btnOutline: { background: 'transparent', border: '2px solid #3a3a3c', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },

    inputCode: { flex: 1, padding: '12px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '5px', border: '1px solid #90caf9', outline: 'none' },
    btnSearch: { background: '#1565c0', color: 'white', border: 'none', borderRadius: '5px', padding: '0 15px', cursor: 'pointer' },

    header: { padding: '15px', width: '100%', borderBottom: '1px solid #3a3a3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' },
    timer: { fontFamily: "'Roboto Mono', monospace", background: 'white', padding: '5px 10px', borderRadius: '4px' },

    gridScroll: { flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '20px' },
    gridContainer: { display: 'flex', flexDirection: 'column', gap: '5px' },
    row: { display: 'flex', gap: '5px', marginBottom: '5px', justifyContent: 'center' },
    cell: { width: '45px', height: '45px', border: '2px solid #3a3a3c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px', fontWeight: 'bold', textTransform: 'uppercase' },

    correct: { backgroundColor: '#538d4e', borderColor: '#538d4e' },
    present: { backgroundColor: '#b59f3b', borderColor: '#b59f3b' },
    absent: { backgroundColor: '#3a3a3c', borderColor: '#3a3a3c' },

    keyboard: { display: 'flex', flexDirection: 'column', gap: '6px', width: '85%', maxWidth: '500px', padding: '10px', paddingBottom: '30px' },
    key: { color: 'white', padding: '15px 0', border: 'none', borderRadius: '4px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, minWidth: '25px' },

    toast: { position: 'absolute', top: '12%', background: 'white', color: 'black', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 6000 },
    rankingContainer: { width: '90%', maxWidth: '350px', maxHeight: '300px', overflowY: 'auto', margin: '15px 0', border: '1px solid #3a3a3c', borderRadius: '5px', background: '#121213' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    td: { padding: '10px', textAlign: 'left', borderBottom: '1px solid #3a3a3c', color: '#ddd' },
    inputName: { padding: '10px', width: '200px', textAlign: 'center', borderRadius: '5px', border: 'none', marginBottom: '10px', fontSize: '1rem' },
    miniInputFilter: {

        background: '#fffacb',
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '13px',
        width: '100%',
        boxSizing: 'border-box'
    },




};