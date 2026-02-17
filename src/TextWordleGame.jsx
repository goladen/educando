import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { X, Delete, RotateCcw } from 'lucide-react';
import Confetti from 'react-confetti';

// --- LISTA DE RESPALDO (Por si falla la carga externa) ---
const FALLBACK_WORDS = [
    "JUEGO", "TEXTO", "CLASE", "PROFE", "LIBRO", "PAPEL", "LAPIZ", "REGLA", "GOMAR", "RATON",
    "AUDIO", "VIDEO", "REDES", "DATOS", "WIFIS", "PIZZA", "PLAZA", "PLAYA", "CAMPO", "MONTE",
    "ARBOL", "PERRO", "GATOS", "TIGRE", "LEONES", "BARCO", "AVION", "COCHE", "TRENES", "METRO",
    "RELOJ", "TIEMPO", "HORAS", "LUNES", "MARZO", "ABRIL", "JUNIO", "JULIO", "ENERO", "SALUD",
    "COMER", "BEBER", "DULCE", "ACIDO", "SALAR", "COCER", "ASADO", "FRUTA", "CARNE", "PESCA",
    "MUNDO", "CIELO", "NUBES", "LLUVIA", "NIEVE", "CALOR", "FUEGO", "AGUAS", "TIERRA", "SUELO",
    "COLOR", "VERDE", "ROJOS", "AZULES", "NEGRO", "BLANCO", "GRIS", "CLARO", "OSCURO", "FONDO",
    "PIEZA", "TORRE", "REINA", "CASCO", "BOTAS", "GUANTE", "GAFAS", "TRAJE", "FALDA", "BLUSA"
];

export default function TextWordleGame({ usuario, onExit }) {
    // --- ESTADOS ---
    const [screen, setScreen] = useState('LOADING'); // LOADING, MAIN, GAME, VICTORY, RANKING_VIEW
    const [solution, setSolution] = useState("");
    const [dictionary, setDictionary] = useState(new Set()); // Para validar palabras
    const [wordList, setWordList] = useState([]); // Para elegir la solución

    // Juego
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [shakeRow, setShakeRow] = useState(false);
    const [message, setMessage] = useState(null);

    // Timer
    const [startTime, setStartTime] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef(null);

    // Ranking
    const [ranking, setRanking] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    const [playerName, setPlayerName] = useState(usuario?.displayName || '');

    // --- 1. CARGAR DICCIONARIO (CON RESPALDO) ---
    useEffect(() => {
        const fetchDictionary = async () => {
            try {
                // URL ESTABLE DE PALABRAS DE 5 LETRAS
                const response = await fetch('https://raw.githubusercontent.com/bayu01/Wordle-ES/master/palabras_de_cinco_letras.txt');

                if (!response.ok) throw new Error("Error fetching dictionary");

                const text = await response.text();

                // Procesamos el texto: limpiamos, mayúsculas y filtramos 5 letras
                const words = text.split('\n')
                    .map(w => w.trim().toUpperCase())
                    .filter(w => w.length === 5 && /^[A-ZÑ]+$/.test(w)); // Solo letras válidas

                if (words.length < 50) throw new Error("Diccionario vacío");

                setDictionary(new Set(words));
                setWordList(words);
                console.log(`Diccionario cargado: ${words.length} palabras.`);
                setScreen('MAIN');

            } catch (e) {
                console.warn("⚠️ Falló la carga online, usando lista local de respaldo.", e);
                // SI FALLA, USAMOS LA LISTA LOCAL
                setDictionary(new Set(FALLBACK_WORDS));
                setWordList(FALLBACK_WORDS);
                setScreen('MAIN');
                setMessage("Modo Offline activado (Diccionario reducido)");
            }
        };
        fetchDictionary();
    }, []);

    // --- 2. INICIAR PARTIDA ---
    const iniciarPartida = () => {
        if (wordList.length === 0) return;

        // Elegir palabra aleatoria
        const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
        setSolution(randomWord);
        // console.log("Solución (Debug):", randomWord); // Descomentar para trampas

        // Reset
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

    // --- 3. TECLADO ---
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
        if (key === 'ENTER') {
            if (currentGuess.length !== 5) {
                showMessage("Faltan letras");
                triggerShake();
                return;
            }
            // OPCIONAL: Si estamos en modo offline/respaldo, podemos ser más laxos
            // pero lo ideal es validar siempre si está en la lista.
            if (!dictionary.has(currentGuess)) {
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
            if (currentGuess.length < 5) {
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
            setScreen('MAIN');
        }
    };

    // --- 4. RANKING ---
    const cargarRanking = async () => {
        setLoadingRanking(true);
        try {
            const q = query(
                collection(db, "ranking_wordle"),
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
                tiempo: Number(elapsedTime)
            });
            showMessage("¡Guardado!");
            cargarRanking();
            setScreen('RANKING_VIEW');
        } catch (e) { showMessage("Error al guardar"); }
    };

    // --- UTILS ---
    const formatTime = (seconds) => {
        const totalSec = Math.floor(seconds);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(null), 2000);
    };

    const triggerShake = () => {
        setShakeRow(true);
        setTimeout(() => setShakeRow(false), 500);
    };

    // --- COLORES (Lógica Wordle Estricta - Dos Pasadas) ---
    const getCellColor = (char, index, guessStr) => {
        if (!guessStr) return styles.absent;

        const solArr = solution.split('');
        const guessArr = guessStr.split('');

        // Mapa de frecuencias de la solución
        const solFreq = {};
        solArr.forEach(c => solFreq[c] = (solFreq[c] || 0) + 1);

        const statusArr = new Array(5).fill('absent');

        // 1. Verdes (Prioridad)
        guessArr.forEach((c, i) => {
            if (c === solArr[i]) {
                statusArr[i] = 'correct';
                solFreq[c]--;
            }
        });

        // 2. Amarillos (Resto)
        guessArr.forEach((c, i) => {
            if (statusArr[i] === 'correct') return; // Ya es verde
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

    // Teclado QWERTY Español
    const keyboardRows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];

    // ==========================================
    // RENDERIZADO
    // ==========================================

    if (screen === 'LOADING') return (
        <div style={styles.screen}>
            <div className="spin" style={{ border: '4px solid #333', borderTop: '4px solid #fff', borderRadius: '50%', width: '40px', height: '40px' }}></div>
            <p style={{ marginTop: '20px', color: 'white' }}>Cargando Diccionario...</p>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (screen === 'MAIN') return (
        <div style={styles.screen}>
            <h1 style={styles.h1}>WORDLE (ES)</h1>
            <p style={{ color: '#818384' }}>Adivina la palabra de 5 letras</p>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={iniciarPartida}>JUGAR</button>
            <button style={{ ...styles.btnOutline, borderColor: '#b59f3b', color: '#b59f3b' }} onClick={() => { cargarRanking(); setScreen('RANKING_VIEW'); }}>🏆 VER RANKING</button>
            <button style={styles.btnOutline} onClick={onExit}>SALIR</button>
        </div>
    );

    if (screen === 'RANKING_VIEW') return (
        <div style={styles.screen}>
            <h2 style={{ color: '#b59f3b' }}>🏆 Top 10</h2>
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
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('MAIN')}>Volver</button>
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
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('MAIN')}>Menú</button>
        </div>
    );

    return (
        <div style={{ ...styles.screen, justifyContent: 'flex-start' }}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.timer}>{formatTime(elapsedTime)}</div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px' }}>WORDLE</h2>
                <div style={{ width: '40px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setScreen('MAIN')}><X color="white" /></div>
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
                    <div style={{ ...styles.row, animation: shakeRow ? 'shake 0.4s' : 'none' }}>
                        {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} style={{ ...styles.cell, borderColor: currentGuess[j] ? '#565758' : '#3a3a3c' }}>
                                {currentGuess[j] || ''}
                            </div>
                        ))}
                    </div>
                    {Array.from({ length: Math.max(0, 5 - guesses.length) }).map((_, i) => (
                        <div key={`empty-${i}`} style={styles.row}>
                            {Array.from({ length: 5 }).map((_, j) => <div key={j} style={styles.cell}></div>)}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...styles.toast, opacity: message ? 1 : 0 }}>{message}</div>

            {/* Teclado */}
            <div style={styles.keyboard}>
                {keyboardRows.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: '5px', width: '100%', justifyContent: 'center' }}>
                        {row.map(char => {
                            // Pintamos el teclado con colores simples (mejorable si se quiere la lógica estricta aquí también)
                            let keyStyle = styles.key;
                            // Lógica visual simple para teclado
                            let status = 'none';
                            // Iteramos intentos para ver si esta letra se usó
                            for (let g of guesses) {
                                for (let k = 0; k < 5; k++) {
                                    if (g[k] === char) {
                                        if (solution[k] === char) status = 'correct';
                                        else if (solution.includes(char) && status !== 'correct') status = 'present';
                                        else if (status === 'none') status = 'absent';
                                    }
                                }
                            }

                            if (status === 'correct') keyStyle = { ...styles.key, ...styles.correct };
                            else if (status === 'present') keyStyle = { ...styles.key, ...styles.present };
                            else if (status === 'absent') keyStyle = { ...styles.key, ...styles.absent };

                            return (
                                <button key={char} onClick={() => handleKey(char)} style={keyStyle}>{char}</button>
                            );
                        })}
                    </div>
                ))}
                <div style={{ display: 'flex', gap: '5px', width: '100%', justifyContent: 'center', marginTop: '5px' }}>
                    <button onClick={() => handleKey('ENTER')} style={{ ...styles.key, width: '65px', fontSize: '0.8rem' }}>ENTER</button>
                    <button onClick={() => handleKey('DEL')} style={{ ...styles.key, width: '65px', background: '#b04848' }}>⌫</button>
                </div>
            </div>

            <style>{`@keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-5px);} 75%{transform:translateX(5px);} }`}</style>
        </div>
    );
}

// ESTILOS
const styles = {
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#121213', zIndex: 5000, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto', sans-serif" },
    h1: { fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '5px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '80%', maxWidth: '250px' },
    btnPrimary: { backgroundColor: '#538d4e', color: 'white' },
    btnSecondary: { backgroundColor: '#818384', color: 'white' },
    btnOutline: { background: 'transparent', border: '2px solid #3a3a3c', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' },

    header: { padding: '15px', width: '100%', borderBottom: '1px solid #3a3a3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' },
    timer: { fontFamily: "'Roboto Mono', monospace", background: '#3a3a3c', padding: '5px 10px', borderRadius: '4px' },

    gridScroll: { flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '20px' },
    gridContainer: { display: 'flex', flexDirection: 'column', gap: '5px' },
    row: { display: 'flex', gap: '5px', marginBottom: '5px', justifyContent: 'center' },
    cell: { width: '50px', height: '50px', border: '2px solid #3a3a3c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' },

    correct: { backgroundColor: '#538d4e', borderColor: '#538d4e' },
    present: { backgroundColor: '#b59f3b', borderColor: '#b59f3b' },
    absent: { backgroundColor: '#3a3a3c', borderColor: '#3a3a3c' },

    keyboard: { display: 'flex', flexDirection: 'column', gap: '8px', width: '95%', maxWidth: '500px', padding: '10px', paddingBottom: '30px' },
    key: { backgroundColor: '#818384', color: 'white', padding: '15px 0', border: 'none', borderRadius: '4px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', flex: 1, minWidth: '30px' },

    toast: { position: 'absolute', top: '12%', background: 'white', color: 'black', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 6000 },
    rankingContainer: { width: '90%', maxWidth: '350px', maxHeight: '300px', overflowY: 'auto', margin: '15px 0', border: '1px solid #3a3a3c', borderRadius: '5px', background: '#121213' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    td: { padding: '10px', textAlign: 'left', borderBottom: '1px solid #3a3a3c', color: '#ddd' },
    inputName: { padding: '10px', width: '200px', textAlign: 'center', borderRadius: '5px', border: 'none', marginBottom: '10px', fontSize: '1rem' }
};