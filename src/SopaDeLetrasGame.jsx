import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, Settings, Trophy, Search, BookOpen, Globe, ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
import SopaDeLetras from './SopaDeLetras'; // <--- Importamos el motor de la sopa que ya creamos

// --- DICCIONARIOS (Igual que Wordle) ---
const LANGUAGES = {
    ES: { label: 'Español', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt' },
    CA: { label: 'Català', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ca/ca_50k.txt' },
    EN: { label: 'English', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt' },
    FR: { label: 'Français', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt' }

};

export default function SopaDeLetrasGame({ usuario, onExit, recurso, modoOlimpico = false, tiempoOlimpico = null, hojaOlimpica = 'General', onOlimpicoFinish = null }) { // --- ESTADOS DE PANTALLA ---


    const [screen, setScreen] = useState('CONFIG'); // CONFIG, LOADING, GAME, VICTORY, RANKING


    // --- CONFIGURACIÓN ---
    const [config, setConfig] = useState({ lang: 'ES', numWords: 8 }); // Entre 6 y 10 palabras
    const [customCode, setCustomCode] = useState('');
    const [isCustomGame, setIsCustomGame] = useState(false);

    // --- DATOS DEL JUEGO ---
    const [palabrasJuego, setPalabrasJuego] = useState([]);

    // --- TIMER ---
    const [startTime, setStartTime] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef(null);

    // --- RANKING ---
    const [recursoActual, setRecursoActual] = useState(null); // Guardará el objeto del recurso si es PROFE
    const [rankingData, setRankingData] = useState([]);
    const [cargandoRanking, setCargandoRanking] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [recursoPendiente, setRecursoPendiente] = useState(null);
    // --- BUSCADOR (Igual que Wordle) ---
    const [biblioteca, setBiblioteca] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [filtros, setFiltros] = useState({ tema: '', ciclo: 'Secundaria', pais: '', region: '', poblacion: '', autor: '' });

    const [playerName, setPlayerName] = useState(usuario?.displayName || '');
    const [ranking, setRanking] = useState([]);



    // --- NUEVOS ESTADOS OLÍMPICOS Y SALVAVIDAS ---
    const [tiempoRestante, setTiempoRestante] = useState(tiempoOlimpico || 60);
    const [puntos, setPuntos] = useState(0);

    // Referencias para el salvavidas (guardan el valor actual sin provocar renderizados)
    const puntosRef = useRef(0);
    const hasFinishedRef = useRef(false);





    // 1. Mantener el espejo actualizado punto a punto
    useEffect(() => {
        puntosRef.current = puntos;
    }, [puntos]);

    // 2. Cronómetro Olímpico
    useEffect(() => {
        if (!modoOlimpico) return;
        const t = setInterval(() => {
            setTiempoRestante(prev => {
                if (prev <= 1) {
                    clearInterval(t);
                    setScreen('TIMEOUT');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [modoOlimpico, tiempoOlimpico]);

    // 3. Auto-Arranque Olímpico (MANDA SOBRE TODO LO DEMÁS)
    useEffect(() => {
        if (modoOlimpico && recurso && screen === 'CONFIG') {
            iniciarJuegoConHoja(recurso, hojaOlimpica);
        }
    }, [modoOlimpico, recurso, screen, hojaOlimpica]);

    // 4. Interceptor de Final Natural (Victoria o Tiempo)
    useEffect(() => {
        if ((screen === 'VICTORY' || screen === 'TIMEOUT') && modoOlimpico && !hasFinishedRef.current) {
            hasFinishedRef.current = true;
            // Si gana, aseguramos que envíe el total de palabras. Si es tiempo, lo que lleve.
            const notaFinal = screen === 'VICTORY' ? palabrasJuego.length : puntos;
            if (onOlimpicoFinish) onOlimpicoFinish(notaFinal);
        }
    }, [screen, modoOlimpico, puntos, onOlimpicoFinish, palabrasJuego]);

    // 5. EL SALVAVIDAS: Interceptor de Corte Brusco (Si el profe pasa de diapo)
    /*useEffect(() => {
        return () => {
            // Se ejecuta solo si el componente se destruye sin haber terminado "bien"
            if (modoOlimpico && !hasFinishedRef.current) {
                hasFinishedRef.current = true;
                if (onOlimpicoFinish) onOlimpicoFinish(puntosRef.current);
            }
        };
    }, [modoOlimpico]);*/
    

    useEffect(() => {
        if (recurso && !modoOlimpico) {
            procesarRecurso(recurso);
        }
    }, [recurso, modoOlimpico]);

    // =========================================================
    // 1. LÓGICA DE DICCIONARIOS Y PREPARACIÓN
    // =========================================================
    const normalizeWord = (word) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    const cargarDiccionarioYJugar = async (palabrasForzadas = null, idiomaForzado = null) => {
        setScreen('LOADING');
        const idioma = idiomaForzado || config.lang;

        try {
            let palabrasFinales = [];

            if (palabrasForzadas && palabrasForzadas.length > 0) {
                // MODO PROFESOR: Usamos las palabras del recurso
                // Mezclamos y cogemos hasta un máximo de 10
                palabrasFinales = palabrasForzadas;
                setIsCustomGame(true);
            } else {
                // MODO ALEATORIO: Descargamos diccionario
                const langData = LANGUAGES[idioma] || LANGUAGES['ES'];
                const response = await fetch(langData.url);
                if (!response.ok) throw new Error("Error de conexión al diccionario");
                const text = await response.text();

                // Filtramos palabras de 4 a 8 letras que sean solo texto
                let validWords = [];
                text.split('\n').forEach(line => {
                    const [word] = line.split(' ');
                    if (word) {
                        const limpia = normalizeWord(word);
                        if (limpia.length >= 4 && limpia.length <= 8 && /^[A-ZÑ]+$/.test(limpia)) {
                            validWords.push(limpia);
                        }
                    }
                });

                // Cogemos las 5000 más comunes, las mezclamos y elegimos 'config.numWords'
                const topWords = validWords.slice(0, 5000).sort(() => Math.random() - 0.5);
                palabrasFinales = topWords.slice(0, config.numWords);
                setIsCustomGame(false);
            }

            setPalabrasJuego(palabrasFinales);
            iniciarTimer();
            setScreen('GAME');

        } catch (e) {
            console.error(e);
            alert("Error cargando la sopa. Revisa tu conexión.");
            setScreen('CONFIG');
        }
    };

    // =========================================================
    // 2. BUSCADOR DE RECURSOS PROFE
    // =========================================================
    const cargarNivelPersonalizado = async () => {
        if (!customCode.trim()) return alert("Escribe un código");
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
            if (data.tipoJuego !== 'SOPA') throw new Error("Este código no es de una Sopa de Letras");
            
            procesarRecurso(data);
        } catch (e) {
            alert(e.message);
            setScreen('CONFIG');
        }
    };

    const buscarRecursosPublicos = async () => {
        setBuscando(true);
        try {
            // Buscamos TODOS los recursos públicos. El filtrado fino lo haremos en JavaScript
            // para poder aceptar tanto 'SOPA' como 'WORDLE'.
            const q = query(collection(db, "resources"), where("isPrivate", "==", false), limit(150));
            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const clean = (t) => t ? t.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

            const filtrados = docs.filter(r => {
                // 1. ACEPTAMOS SOPA Y WORDLE
                if (r.tipoJuego !== 'SOPA' && r.tipoJuego !== 'WORDLE') return false;

                // 2. FILTROS DE TEMA Y CICLO
                const cumpleTema = !filtros.tema || clean(r.titulo).includes(clean(filtros.tema)) || clean(r.temas).includes(clean(filtros.tema));
                const cumpleCiclo = !filtros.ciclo || r.ciclo === filtros.ciclo;

                return cumpleTema && cumpleCiclo;
            });

            // Ordenamos por fecha de creación (los más nuevos primero)
            filtrados.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));

            setBiblioteca(filtrados);
            if (filtrados.length === 0) alert("No se han encontrado sopas de letras públicas con esos filtros.");
        } catch (e) {
            console.error("Error buscando:", e);
            alert("Error al buscar recursos.");
        }
        setBuscando(false);
    };

    const procesarRecurso = (data) => {
        setRecursoActual(data);
        // Si hay más de 1 hoja, mostramos el selector. Si no, jugamos directamente 'General'
        if (data.hojas && data.hojas.length > 1) {
            setRecursoPendiente(data);
            setScreen('SELECT_HOJA');
        } else {
            iniciarJuegoConHoja(data, 'General');
        }
    };

    const iniciarJuegoConHoja = (data, nombreHoja) => {
        let palabrasCandidatas = [];

        if (data.hojas) {
            data.hojas.forEach(h => {
                // Filtramos por la hoja seleccionada (o todas si es 'General')
                if ((nombreHoja === 'General' || h.nombreHoja === nombreHoja) && h.palabras && Array.isArray(h.palabras)) {
                    h.palabras.forEach(palabra => {
                        const limpia = normalizeWord(palabra);
                        if (limpia && /^[A-ZÑ]+$/.test(limpia)) {
                            palabrasCandidatas.push(limpia);
                        }
                    });
                }
            });
        }

        if (palabrasCandidatas.length === 0) {
            alert("No hay palabras válidas en esta selección.");
            setScreen('CONFIG');
            return;
        }

        // MAGIA: Leemos cuántas palabras configuró el profesor (o 8 por defecto)
        const limitePalabras = data.config?.numPalabras || data.config?.numWords || 8;

        // Mezclamos TODAS las palabras válidas y cogemos solo la cantidad del límite
        const mezcladas = palabrasCandidatas.sort(() => Math.random() - 0.5);
        const seleccionFinal = mezcladas.slice(0, limitePalabras);

        // Arrancamos la sopa con esas palabras
        cargarDiccionarioYJugar(seleccionFinal, data.config?.idioma || 'ES');
    };

    // =========================================================
    // 3. TIMER Y VICTORIA
    // =========================================================
    const iniciarTimer = () => {
        const now = Date.now();
        setStartTime(now);
        setElapsedTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - now) / 1000));
        }, 1000);
    };

    const handleVictoria = () => {
        clearInterval(timerRef.current);
        setScreen('VICTORY');
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;


    // =========================================================
    // 4. RANKING
    // =========================================================
    const guardarPuntuacion = async () => {
        if (!playerName.trim()) return alert("Escribe tu nombre");
        setGuardando(true);
        try {
            const isGuest = !usuario || !usuario.email;
            const email = isGuest ? 'invitado' : usuario.email;

            if (isCustomGame && recursoActual) {
                // RANKING TIPO PASAPALABRA (Para el Profesor)
                await addDoc(collection(db, "ranking"), {
                    recursoId: recursoActual.id || customCode,
                    recursoTitulo: recursoActual.titulo || "Sopa de Letras",
                    tipoJuego: 'SOPA',
                    juego: 'Sopa de Letras',
                    email: email,
                    jugador: playerName.trim(),
                    tiempo: elapsedTime, // Guardamos el tiempo (ganará el más rápido)
                    fecha: new Date()
                });
            } else {
                // RANKING GLOBAL ALEATORIO (Por Idioma y Nº Palabras)
                await addDoc(collection(db, "ranking_sopa"), {
                    fecha: new Date(),
                    nombre: playerName.trim(),
                    tiempo: elapsedTime,
                    modo: `${config.lang}-${config.numWords}`,
                    lang: config.lang
                });
            }
            alert("¡Resultado guardado!");
            cargarRanking();
        } catch (e) {
            console.error("Error al guardar:", e);
            alert("Error al guardar la puntuación");
        }
        setGuardando(false);
    };

    const cargarRanking = async () => {
        setCargandoRanking(true);
        setScreen('RANKING');
        try {
            let q;
            if (isCustomGame && recursoActual) {
                q = query(collection(db, "ranking"), where("recursoId", "==", recursoActual.id || customCode), where("tipoJuego", "==", "SOPA"), orderBy("tiempo", "asc"), limit(10));
            } else {
                q = query(collection(db, "ranking_sopa"), where("modo", "==", `${config.lang}-${config.numWords}`), orderBy("tiempo", "asc"), limit(10));
            }
            const snap = await getDocs(q);
            setRankingData(snap.docs.map(d => d.data()));
        } catch (e) {
            console.error(e);
        }
        setCargandoRanking(false);
    };

    // =========================================================
    // RENDERIZADO
    // =========================================================
    if (screen === 'LOADING') return (
        <div style={styles.screen}>
            <div className="spin" style={{ border: '4px solid #333', borderTop: '4px solid #fff', borderRadius: '50%', width: '40px', height: '40px' }}></div>
            <p style={{ marginTop: '20px', color: 'white' }}>Generando tablero...</p>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (screen === 'SELECT_HOJA') return (
        <div style={styles.screen}>
            <button onClick={() => setScreen('CONFIG')} style={styles.backBtn}><ArrowLeft size={20} /> Volver</button>
            <h1 style={{ ...styles.h1, color: '#f1c40f', marginTop: '40px' }}>Elige un Nivel</h1>

            <div style={{ ...styles.card, marginTop: '20px' }}>
                <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>{recursoPendiente?.titulo}</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Botón de Jugar General (Mezcla) */}
                    <button
                        onClick={() => iniciarJuegoConHoja(recursoPendiente, 'General')}
                        style={{ ...styles.btn, ...styles.btnPrimary, width: '100%' }}
                    >
                        🌟 Jugar General (Mezcla)
                    </button>

                    <div style={{ width: '100%', height: '1px', background: '#ddd', margin: '10px 0' }}></div>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', fontWeight: 'bold' }}>O elige una hoja específica:</p>

                    {/* Botones por cada hoja */}
                    {recursoPendiente?.hojas.map((h, i) => (
                        <button
                            key={i}
                            onClick={() => iniciarJuegoConHoja(recursoPendiente, h.nombreHoja)}
                            style={{ ...styles.btn, background: '#eee', color: '#333', width: '100%', border: '2px solid #ccc' }}
                        >
                            📂 {h.nombreHoja} <span style={{ fontSize: '0.8rem', color: '#777' }}>({h.palabras?.length || 0} pal.)</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );


    if (screen === 'CONFIG') return (
        <div style={styles.screen}>
            <button onClick={onExit} style={styles.backBtn}><ArrowLeft size={20} /> Volver</button>
            <h1 style={styles.h1}>SOPA DE LETRAS</h1>
            
            {/* JUEGO ALEATORIO */}
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
                    <label style={styles.label}>Nº Palabras: {config.numWords}</label>
                    <input type="range" min="6" max="10" step="1" value={config.numWords} onChange={(e) => setConfig({ ...config, numWords: parseInt(e.target.value) })} style={{ width: '100%', cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}><span>6</span><span>10</span></div>
                    <p style={{fontSize: '11px', color: '#888', marginTop: '5px'}}>Longitud automática (4-8 letras)</p>
                </div>

                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => cargarDiccionarioYJugar(null, null)}>GENERAR Y JUGAR</button>
            </div>

            {/* CÓDIGO PROFE */}
            <div style={{ ...styles.card, marginTop: '15px', background: '#e3f2fd', border: '1px solid #90caf9' }}>
                <label style={{ ...styles.label, color: '#1565c0' }}><BookOpen size={16} style={{ verticalAlign: 'middle' }} /> Jugar Desafío de Profe</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="CÓDIGO..." style={styles.inputCode} maxLength={6} />
                    <button onClick={cargarNivelPersonalizado} style={styles.btnSearch}><Search size={20} /></button>
                </div>
            </div>

            {/* BUSCADOR BIBLIOTECA (Simplificado para el ejemplo) */}
            <div style={{ ...styles.card, marginBottom: '50px', marginTop: '15px', background: '#e8f5e9', border: '1px solid #81c784' }}>
                <h3 style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}><Search size={20} /> Explorar Sopas</h3>
                <button onClick={buscarRecursosPublicos} style={{ ...styles.btn, background: '#2e7d32', color: 'white' }}>{buscando ? 'Buscando...' : 'Ver Sopas Públicas'}</button>
                
                <div style={styles.scrollX}>
                    {biblioteca.map(r => (
                        <div key={r.id} onClick={() => procesarRecurso(r)} style={styles.miniCard}>
                            <h4 style={{ margin: '0 0 5px 0', color: '#2e7d32', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</h4>
                            <div style={{ fontSize: '11px', color: '#555' }}>🏫 {r.ciclo}</div>
                            <button style={styles.miniPlayBtn}>JUGAR</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (screen === 'GAME') return (
        <div style={{ ...styles.screen, backgroundColor: '#2c3e50' }}>
            {/* Header del juego */}
            <div style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ fontFamily: "'Roboto Mono', monospace", background: modoOlimpico ? '#e74c3c' : 'white', color: modoOlimpico ? 'white' : 'black', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>
                        ⏱ {modoOlimpico ? `${tiempoRestante}s` : formatTime(elapsedTime)}
                    </div>
                    {modoOlimpico && (
                        <div style={{ background: '#f1c40f', color: '#2c3e50', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>
                            ⭐ {puntos} pts
                        </div>
                    )}
                </div>

                <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>{modoOlimpico ? 'Torneo Olímpico' : isCustomGame ? 'Desafío PRO' : 'Modo Libre'}</h2>

                {!modoOlimpico && (
                    <div style={{ cursor: 'pointer' }} onClick={() => setScreen('CONFIG')}><X color="white" /></div>
                )}
            </div>

            {/* AQUI INYECTAMOS EL MOTOR DE LA SOPA */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
                <SopaDeLetras
                    palabras={palabrasJuego}
                    mostrarLista={true}
                    onTerminar={handleVictoria}
                    onPalabraEncontrada={() => setPuntos(p => p + 1)} // <--- CLAVE PARA EL MODO OLÍMPICO
                />
            </div>
        </div>
    );

    if (screen === 'VICTORY' || screen === 'TIMEOUT') return (
        <div style={{ ...styles.screen, backgroundColor: screen === 'TIMEOUT' ? '#e74c3c' : '#27ae60' }}>
            {screen === 'VICTORY' && <Confetti recycle={false} />}
            <h1 style={{ ...styles.h1, color: 'white' }}>
                {screen === 'VICTORY' ? '¡SOPA COMPLETADA! 🥳' : '¡TIEMPO AGOTADO! ⏳'}
            </h1>
            <p style={{ color: 'white', fontSize: '1.2rem' }}>¡Has encontrado {screen === 'VICTORY' ? palabrasJuego.length : puntos} palabras!
            </p>

            {!modoOlimpico && (
                <p style={{ color: '#d4edda' }}>Tiempo total: <span style={{ color: 'white', fontWeight: 'bold', fontSize: '2.5rem', display: 'block', margin: '10px 0' }}>{formatTime(elapsedTime)}</span></p>
            )}

            {/* ZONA DE GUARDADO (Oculta en Olimpiadas) */}
            {!modoOlimpico ? (
                <>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '15px', marginTop: '20px', width: '90%', maxWidth: '350px', textAlign: 'center' }}>
                        <p style={{ color: 'white', marginBottom: '10px', fontWeight: 'bold' }}>{isCustomGame ? '🏆 Ranking del Recurso' : `🏆 Ranking ${LANGUAGES[config.lang].label} (${config.numWords} pal)`}</p>

                        {(!usuario || !usuario.email) && (
                            <input
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Escribe tu nombre..."
                                maxLength={15}
                                style={{ padding: '12px', width: '100%', textAlign: 'center', borderRadius: '8px', border: 'none', marginBottom: '15px', fontSize: '1.1rem', boxSizing: 'border-box' }}
                            />
                        )}
                        {usuario && usuario.email && <p style={{ color: '#f1c40f', marginBottom: '15px', fontSize: '1.2rem' }}><b>{usuario.displayName}</b></p>}

                        <button style={{ ...styles.btn, width: '100%', background: '#f1c40f', color: '#2c3e50' }} onClick={guardarPuntuacion} disabled={guardando}>
                            {guardando ? 'Guardando...' : '💾 Guardar mi Tiempo'}
                        </button>
                    </div>

                    <button style={{ ...styles.btn, background: 'transparent', color: 'white', border: '2px solid white', marginTop: '15px' }} onClick={cargarRanking}>Ver Ranking</button>
                    <button style={{ ...styles.btn, ...styles.btnPrimary, background: 'white', color: '#27ae60', marginTop: '15px' }} onClick={() => setScreen('CONFIG')}>Jugar otra vez</button>
                </>
            ) : (
                    <div style={{ color: '#f1c40f', fontWeight: 'bold', marginTop: '30px', fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>
                        Enviando {puntos} puntos al profesor... 🚀
                </div>
                )}
        </div>
    );

    if (screen === 'RANKING') return (
        <div style={styles.screen}>
            <h1 style={{ ...styles.h1, color: '#f1c40f' }}><Trophy size={32} style={{ verticalAlign: 'bottom' }} /> TOP 10</h1>
            <p style={{ color: '#bdc3c7', marginBottom: '20px' }}>
                {isCustomGame && recursoActual ? `Recurso: ${recursoActual.titulo}` : `${LANGUAGES[config.lang].label} - ${config.numWords} palabras`}
            </p>

            <div style={{ width: '90%', maxWidth: '400px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px', padding: '10px', minHeight: '300px' }}>
                {cargandoRanking ? <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>Cargando tiempos...</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
                        <tbody>
                            {rankingData.length === 0 ? <tr><td colSpan="2" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>Nadie ha jugado aún. ¡Sé el primero!</td></tr> :
                                rankingData.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <td style={{ padding: '15px 10px', fontSize: '1.1rem' }}>
                                            <span style={{ color: i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#d35400' : '#7f8c8d', fontWeight: 'bold', marginRight: '10px' }}>{i + 1}º</span>
                                            {r.jugador || r.nombre}
                                        </td>
                                        <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: '#2ecc71', fontSize: '1.1rem' }}>
                                            ⏱ {formatTime(r.tiempo)}
                                        </td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                )}
            </div>

            <button style={{ ...styles.btn, ...styles.btnPrimary, marginTop: '30px' }} onClick={() => setScreen('CONFIG')}>Volver al Menú</button>
        </div>
    );

    return null;
}

const styles = {
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#2c3e50', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', fontFamily: "'Roboto', sans-serif", overflowY: 'auto', padding: '40px 0', WebkitOverflowScrolling: 'touch' },
    backBtn: { position: 'absolute', top: '20px', left: '20px', background: 'white', border: '1px solid #ddd', borderRadius: '30px', padding: '8px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#333', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    card: { background: '#fffacb', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '500px', width: '80%',textAlign: 'center' },
    h1: { fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0', color: '#f1c40f', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },
    label: { display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#555', fontSize: '0.9rem' },
    optionBtn: { padding: '8px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '5px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '70%' },
    btnPrimary: { backgroundColor: '#3498db', color: 'white' },
    inputCode: { flex: 1, padding: '12px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '5px', border: '1px solid #90caf9', outline: 'none' },
    btnSearch: { background: '#1565c0', color: 'white', border: 'none', borderRadius: '5px', padding: '0 15px', cursor: 'pointer' },
    scrollX: { marginTop: '15px', width: '100%', display: 'flex', overflowX: 'auto', gap: '10px', padding: '10px 5px', scrollBehavior: 'smooth' },
    miniCard: { minWidth: '180px', width: '180px', flexShrink: 0, background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e0e0e0', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
    miniPlayBtn: { background: '#2e7d32', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }
};