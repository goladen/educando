import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, Delete, Globe, Settings, Trophy } from 'lucide-react';
import Confetti from 'react-confetti';

// CONFIGURACIÓN DE IDIOMAS Y RECURSOS
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
        ] // Layout AZERTY simplificado
    }
};

export default function TextWordleGame({ usuario, onExit }) {
    // --- ESTADOS DE CONFIGURACIÓN ---
    const [screen, setScreen] = useState('CONFIG'); // CONFIG, LOADING, GAME, VICTORY, RANKING_VIEW
    const [config, setConfig] = useState({ lang: 'ES', length: 5 });

    // --- DATOS DEL JUEGO ---
    const [solution, setSolution] = useState("");
    const [validWords, setValidWords] = useState(new Set()); // Diccionario para validar
    const [commonWords, setCommonWords] = useState([]); // Lista para elegir solución (más restrictiva)

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

    // =========================================================
    // 1. CARGA INTELIGENTE DE DICCIONARIO
    // =========================================================
    const cargarDiccionario = async () => {
        setScreen('LOADING');
        try {
            const langData = LANGUAGES[config.lang];
            const response = await fetch(langData.url);
            if (!response.ok) throw new Error("Error de conexión");

            const text = await response.text();

            // PROCESAMIENTO DE LISTA DE FRECUENCIA
            // El formato es: "palabra frecuencia" (ej: "casa 12312")
            const allWords = text.split('\n')
                .map(line => {
                    const [word] = line.split(' '); // Cogemos solo la palabra
                    return word ? normalizeWord(word) : '';
                })
                .filter(w => w.length === config.length && /^[A-ZÑ]+$/.test(w));

            // ESTRATEGIA DE FILTRADO:
            // 1. Common Words: Las top 1000 palabras más frecuentes (para SOLUCIONES)
            // 2. Valid Words: Las top 15000 palabras (para permitir intentos válidos aunque raros)
            const topCommon = allWords.slice(0, 1000);
            const topValid = allWords.slice(0, 15000);

            if (topCommon.length < 50) throw new Error("Pocas palabras encontradas");

            setCommonWords(topCommon);
            setValidWords(new Set(topValid));

            iniciarPartida(topCommon);

        } catch (e) {
            console.error(e);
            setMessage("Error cargando diccionario. Revisa tu conexión.");
            setScreen('CONFIG');
        }
    };

    // Función para quitar acentos y poner mayúsculas
    const normalizeWord = (word) => {
        return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const iniciarPartida = (listaPalabras = commonWords) => {
        if (listaPalabras.length === 0) return;

        const randomWord = listaPalabras[Math.floor(Math.random() * listaPalabras.length)];
        setSolution(randomWord);
        // console.log("Solución:", randomWord); // Descomenta para pruebas

        setGuesses([]);
        setCurrentGuess("");
        setScreen('GAME');

        // Timer
        const now = Date.now();
        setStartTime(now);
        setElapsedTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - now) / 1000));
        }, 1000);
    };

    // =========================================================
    // 2. LÓGICA DE JUEGO
    // =========================================================
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (screen !== 'GAME') return;
            const key = e.key.toUpperCase();

            if (key === 'ENTER') handleKey('ENTER');
            else if (key === 'BACKSPACE') handleKey('DEL');
            else if (/^[A-ZÑ]$/.test(key)) handleKey(key); // Acepta letras y Ñ
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [screen, currentGuess]);

    const handleKey = (key) => {
        if (key === 'ENTER') {
            if (currentGuess.length !== config.length) {
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
            if (currentGuess.length < config.length) {
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
            setScreen('CONFIG');
        }
    };

    // =========================================================
    // 3. RANKING
    // =========================================================
    const cargarRanking = async () => {
        setLoadingRanking(true);
        try {
            const modoStr = `${config.lang}-${config.length}`; // Ej: ES-5
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
                modo: `${config.lang}-${config.length}`, // Guardamos modo
                lang: config.lang
            });
            showMessage("¡Guardado!");
            cargarRanking();
            setScreen('RANKING_VIEW');
        } catch (e) { showMessage("Error al guardar"); }
    };

    // =========================================================
    // 4. UTILS & COLORES
    // =========================================================
    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(null), 2000);
    };

    const triggerShake = () => {
        setShakeRow(true);
        setTimeout(() => setShakeRow(false), 500);
    };

    const getCellColor = (char, index, guessStr) => {
        if (!guessStr) return styles.absent;
        const solArr = solution.split('');
        const guessArr = guessStr.split('');
        const solFreq = {};
        solArr.forEach(c => solFreq[c] = (solFreq[c] || 0) + 1);
        const statusArr = new Array(config.length).fill('absent');

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

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // =========================================================
    // 5. RENDERIZADO
    // =========================================================

    // --- PANTALLA DE CARGA ---
    if (screen === 'LOADING') return (
        <div style={styles.screen}>
            <div className="spin" style={{ border: '4px solid #333', borderTop: '4px solid #fff', borderRadius: '50%', width: '40px', height: '40px' }}></div>
            <p style={{ marginTop: '20px', color: 'white' }}>Cargando Palabras...</p>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    // --- PANTALLA DE CONFIGURACIÓN (MAIN) ---
    if (screen === 'CONFIG') return (
        <div style={styles.screen}>
            <h1 style={styles.h1}>WORDLE MULTI</h1>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>Configura tu partida</p>

            <div style={styles.card}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}>Idioma</label>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        {Object.keys(LANGUAGES).map(k => (
                            <button
                                key={k}
                                onClick={() => setConfig({ ...config, lang: k })}
                                style={{ ...styles.optionBtn, background: config.lang === k ? '#3F51B5' : '#eee', color: config.lang === k ? 'white' : '#333' }}
                            >
                                {LANGUAGES[k].label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}>Longitud: {config.length} Letras</label>
                    <input
                        type="range" min="4" max="8" step="1"
                        value={config.length}
                        onChange={(e) => setConfig({ ...config, length: parseInt(e.target.value) })}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                        <span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
                    </div>
                </div>

                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={cargarDiccionario}>COMENZAR</button>
            </div>

            <button style={{ ...styles.btnOutline, marginTop: '20px' }} onClick={onExit}>SALIR</button>
        </div>
    );

    // --- PANTALLA DE JUEGO ---
    if (screen === 'GAME') return (
        <div style={{ ...styles.screen, justifyContent: 'flex-start' }}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.timer}>{formatTime(elapsedTime)}</div>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '1px' }}>WORDLE</h2>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>{LANGUAGES[config.lang].label} ({config.length})</span>
                </div>
                <div style={{ width: '40px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setScreen('CONFIG')}><Settings color="white" /></div>
            </div>

            {/* Grid */}
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
                        {Array.from({ length: config.length }).map((_, j) => (
                            <div key={j} style={{ ...styles.cell, borderColor: currentGuess[j] ? '#888' : '#333' }}>
                                {currentGuess[j] || ''}
                            </div>
                        ))}
                    </div>
                    {/* Filas Restantes */}
                    {Array.from({ length: Math.max(0, 5 - guesses.length) }).map((_, i) => (
                        <div key={`empty-${i}`} style={styles.row}>
                            {Array.from({ length: config.length }).map((_, j) => <div key={j} style={styles.cell}></div>)}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...styles.toast, opacity: message ? 1 : 0 }}>{message}</div>

            {/* Teclado Dinámico según Idioma */}
            <div style={styles.keyboard}>
                {LANGUAGES[config.lang].keyboard.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', width: '100%', justifyContent: 'center' }}>
                        {row.map(char => {
                            // Colores de teclado simplificados
                            let keyColor = '#818384';
                            // ...lógica visual opcional aquí...
                            return (
                                <button key={char} onClick={() => handleKey(char)} style={{ ...styles.key, backgroundColor: keyColor }}>{char}</button>
                            );
                        })}
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

    // --- PANTALLA RANKING ---
    if (screen === 'RANKING_VIEW') return (
        <div style={styles.screen}>
            <h2 style={{ color: '#b59f3b' }}><Trophy /> Top 10</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>Modo: {LANGUAGES[config.lang].label} - {config.length} Letras</p>
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

    // --- PANTALLA VICTORIA ---
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
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#121213', zIndex: 5000, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto', sans-serif" },
    card: { background: 'white', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '350px', textAlign: 'center', color: '#333' },
    h1: { fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0' },
    label: { display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#555', fontSize: '0.9rem' },
    optionBtn: { padding: '8px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '5px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%' },
    btnPrimary: { backgroundColor: '#538d4e', color: 'white' },
    btnSecondary: { backgroundColor: '#818384', color: 'white' },
    btnOutline: { background: 'transparent', border: '2px solid #3a3a3c', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },

    header: { padding: '15px', width: '100%', borderBottom: '1px solid #3a3a3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' },
    timer: { fontFamily: "'Roboto Mono', monospace", background: '#3a3a3c', padding: '5px 10px', borderRadius: '4px' },

    gridScroll: { flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '20px' },
    gridContainer: { display: 'flex', flexDirection: 'column', gap: '5px' },
    row: { display: 'flex', gap: '5px', marginBottom: '5px', justifyContent: 'center' },
    cell: { width: '45px', height: '45px', border: '2px solid #3a3a3c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px', fontWeight: 'bold', textTransform: 'uppercase' },

    correct: { backgroundColor: '#538d4e', borderColor: '#538d4e' },
    present: { backgroundColor: '#b59f3b', borderColor: '#b59f3b' },
    absent: { backgroundColor: '#3a3a3c', borderColor: '#3a3a3c' },

    keyboard: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '500px', padding: '10px', paddingBottom: '30px' },
    key: { color: 'white', padding: '15px 0', border: 'none', borderRadius: '4px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, minWidth: '25px' },

    toast: { position: 'absolute', top: '12%', background: 'white', color: 'black', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 6000 },
    rankingContainer: { width: '90%', maxWidth: '350px', maxHeight: '300px', overflowY: 'auto', margin: '15px 0', border: '1px solid #3a3a3c', borderRadius: '5px', background: '#121213' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    td: { padding: '10px', textAlign: 'left', borderBottom: '1px solid #3a3a3c', color: '#ddd' },
    inputName: { padding: '10px', width: '200px', textAlign: 'center', borderRadius: '5px', border: 'none', marginBottom: '10px', fontSize: '1rem' }
};