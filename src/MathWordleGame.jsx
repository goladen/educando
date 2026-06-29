import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { Trophy, X, Delete } from 'lucide-react';
import { guardarRegistroLocal } from './utils/registrosLocales';
import Confetti from 'react-confetti';

function ModalEnviarProfe({ datos, onClose }) {
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
                tipo: 'MATHLE', modalidad: 'Individual', fecha: new Date(),
                codigoProfesor: code,
                config: { operacion: datos.operacion, cifras: datos.cifras },
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), tiempo: datos.tiempo, intentos: datos.intentos }],
            });
            guardarRegistroLocal('MATHLE', {
                titulo: `${datos.operacion || 'MathLe'} (${datos.cifras} cif) · ${datos.intentos} intentos`,
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

export default function MathWordleGame({ usuario, onExit }) {
    // --- ESTADOS DE PANTALLA ---
    const [screen, setScreen] = useState('MAIN'); // MAIN, CONFIG, GAME, VICTORY, RANKING_VIEW
    const [gameMode, setGameMode] = useState('SUMA'); // SUMA, RESTA, MULTI
    const [digits, setDigits] = useState(3); // Cifras por número (2, 3, 4)

    // --- ESTADOS DE JUEGO ---
    const [targetNum, setTargetNum] = useState(0); // El resultado objetivo
    const [solutionStr, setSolutionStr] = useState(""); // La cadena de dígitos "N1N2"
    const [guesses, setGuesses] = useState([]); // Historial de intentos
    const [currentGuess, setCurrentGuess] = useState(""); // Lo que escribe el usuario
    const [shakeRow, setShakeRow] = useState(false);
    const [message, setMessage] = useState(null);

    // --- TIMER (MM:SS) ---
    const [startTime, setStartTime] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef(null);

    // --- RANKING ---
    const [ranking, setRanking] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    const [playerName, setPlayerName] = useState(usuario?.displayName || '');
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    // ==========================================
    // LÓGICA DEL JUEGO
    // ==========================================

    const iniciarPartida = () => {
        // Generar números según cifras
        let min = Math.pow(10, digits - 1);
        let max = Math.pow(10, digits) - 1;

        // Ajuste Multiplicación (evitar 1 cifra trivial)
        if (gameMode === 'MULTI' && digits === 1) min = 2;

        let n1 = randomInt(min, max);
        let n2 = randomInt(min, max);
        let result = 0;

        // LÓGICA DE MODOS
        if (gameMode === 'SUMA') {
            result = n1 + n2;
        }
        else if (gameMode === 'MULTI') {
            result = n1 * n2;
        }
        else if (gameMode === 'RESTA') {
            // Asegurar N1 > N2 y que sean distintos
            while (n1 === n2) n2 = randomInt(min, max);

            // Ordenamos mayor primero
            if (n2 > n1) {
                const temp = n1; n1 = n2; n2 = temp;
            }
            result = n1 - n2;
        }

        setTargetNum(result);
        setSolutionStr(n1.toString() + n2.toString());

        // Reset
        setGuesses([]);
        setCurrentGuess("");
        setScreen('GAME');

        // --- CORRECCIÓN TIMER AQUÍ ---
        const now = Date.now(); // 1. Capturamos la hora EXACTA en una variable local
        setStartTime(now);      // 2. Actualizamos el estado (para usarlo luego al ganar)
        setElapsedTime(0);

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            // 3. Usamos la variable 'now' local, que NO cambia y es correcta
            setElapsedTime(Math.floor((Date.now() - now) / 1000));
        }, 1000);
        // -----------------------------
    };

    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // --- MANEJO DE TECLADO ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (screen !== 'GAME') return;
            if (e.key === 'Enter') handleKey('ENTER');
            else if (e.key === 'Backspace') handleKey('DEL');
            else if (!isNaN(e.key)) handleKey(e.key);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [screen, currentGuess]);

    const handleKey = (key) => {
        const maxLen = digits * 2;

        if (key === 'ENTER') {
            if (currentGuess.length !== maxLen) {
                showMessage("Faltan números");
                triggerShake();
                return;
            }
            validarIntento();
        }
        else if (key === 'DEL') {
            setCurrentGuess(prev => prev.slice(0, -1));
        }
        else {
            if (currentGuess.length < maxLen) {
                setCurrentGuess(prev => prev + key);
            }
        }
    };

    const validarIntento = () => {
        const s1 = currentGuess.substring(0, digits);
        const s2 = currentGuess.substring(digits);
        const n1 = parseInt(s1);
        const n2 = parseInt(s2);

        let calc = 0;
        let opSymbol = '+';

        if (gameMode === 'SUMA') { calc = n1 + n2; opSymbol = '+'; }
        else if (gameMode === 'RESTA') { calc = n1 - n2; opSymbol = '-'; }
        else if (gameMode === 'MULTI') { calc = n1 * n2; opSymbol = '×'; }

        // 1. Comprobar resultado
        if (calc !== targetNum) {
            showMessage(`${n1} ${opSymbol} ${n2} = ${calc} (Incorrecto)`);
            triggerShake();
            return;
        }

        // 2. Avanzar turno
        const newGuesses = [...guesses, currentGuess];
        setGuesses(newGuesses);
        setCurrentGuess("");

        // 3. Victoria o Derrota
        if (currentGuess === solutionStr) {
            clearInterval(timerRef.current);
            setScreen('VICTORY');
            showMessage("¡Correcto! 🏆");
        }
        else if (newGuesses.length >= 6) {
            clearInterval(timerRef.current);
            const sol1 = solutionStr.substring(0, digits);
            const sol2 = solutionStr.substring(digits);
            alert(`Fin del juego. La solución era: ${sol1} ${opSymbol} ${sol2}`);
            setScreen('CONFIG');
        }
    };

    // ==========================================
    // BACKEND & RANKING
    // ==========================================

    const cargarRanking = async () => {
        setLoadingRanking(true);
        try {
            const modoStr = `${gameMode} (${digits} cif)`;
            const q = query(
                collection(db, "ranking_mathwordle"),
                where("modo", "==", modoStr),
                orderBy("tiempo", "asc"),
                limit(10)
            );
            const snap = await getDocs(q);
            setRanking(snap.docs.map(d => d.data()));
        } catch (e) {
            console.error(e);
        }
        setLoadingRanking(false);
    };

    const guardarPuntuacion = async () => {
        if (!playerName.trim()) return showMessage("Escribe un nombre");
        try {
            const modoStr = `${gameMode} (${digits} cif)`;
            // Usamos 'elapsedTime' que ya tiene el valor correcto del último tick
            await addDoc(collection(db, "ranking_mathwordle"), {
                fecha: new Date(),
                nombre: playerName.trim(),
                tiempo: Number(elapsedTime),
                modo: modoStr,
                operacion: gameMode
            });
            guardarRegistroLocal('MATHLE', {
                titulo: modoStr, nombre: playerName.trim(), via: 'ranking',
            });
            showMessage("¡Guardado!");
            cargarRanking();
            setScreen('RANKING_VIEW');
        } catch (e) {
            showMessage("Error al guardar");
        }
    };

    // ==========================================
    // UTILS VISUALES
    // ==========================================
    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(null), 2000);
    };

    const triggerShake = () => {
        setShakeRow(true);
        setTimeout(() => setShakeRow(false), 500);
    };

    // Formato estricto Minutos:Segundos (00:00)
    const formatTime = (seconds) => {
        const totalSec = Math.floor(seconds);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Lógica Wordle Estricta (Dos Pasadas)
    const getCellColor = (digit, index, guessStr) => {
        if (!guessStr) return styles.absent;

        // 1. Convertimos a arrays para trabajar mejor
        const solutionArr = solutionStr.split('');
        const guessArr = guessStr.split('');

        // 2. Mapa de frecuencia de la SOLUCIÓN (Cuántas veces aparece cada carácter)
        // Ej: si la solución es "10+5=15", el mapa de '5' será 1, de '1' será 2...
        const solFreq = {};
        solutionArr.forEach(char => {
            solFreq[char] = (solFreq[char] || 0) + 1;
        });

        // 3. Array temporal para guardar los estados de esta fila
        // Inicialmente todos 'absent' (gris)
        const rowStatus = new Array(guessArr.length).fill('absent');

        // --- PASADA 1: DETECTAR VERDES (Prioridad Máxima) ---
        guessArr.forEach((char, i) => {
            if (char === solutionArr[i]) {
                rowStatus[i] = 'correct'; // Verde
                solFreq[char]--; // Gastamos una ocurrencia de este carácter
            }
        });

        // --- PASADA 2: DETECTAR AMARILLOS (Lo que sobra) ---
        guessArr.forEach((char, i) => {
            // Si ya es verde, lo saltamos
            if (rowStatus[i] === 'correct') return;

            // Si el carácter existe en la solución Y aún quedan ocurrencias disponibles
            if (solFreq[char] > 0) {
                rowStatus[i] = 'present'; // Amarillo
                solFreq[char]--; // Gastamos una ocurrencia
            }
        });

        // 4. Devolvemos el estilo correspondiente al índice que pide React
        const status = rowStatus[index];

        if (status === 'correct') return styles.correct;
        if (status === 'present') return styles.present;
        return styles.absent;
    };

    const getOpSymbol = () => {
        if (gameMode === 'SUMA') return '+';
        if (gameMode === 'RESTA') return '-';
        return 'x';
    };

    // ==========================================
    // RENDERIZADO
    // ==========================================

    // --- 1. MENÚ PRINCIPAL ---
    if (screen === 'MAIN') return (
        <div style={styles.screen}>
            <h1 style={styles.h1}>MATH WORDLE</h1>
            <p style={{ color: '#818384', marginBottom: '20px' }}>Selecciona el modo de juego</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'center' }}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => { setGameMode('SUMA'); setScreen('CONFIG'); }}>➕ SUMA</button>
                <button style={{ ...styles.btn, backgroundColor: '#e57373', color: 'white' }} onClick={() => { setGameMode('RESTA'); setScreen('CONFIG'); }}>➖ RESTA</button>
                <button style={{ ...styles.btn, backgroundColor: '#b59f3b', color: 'white' }} onClick={() => { setGameMode('MULTI'); setScreen('CONFIG'); }}>✖ MULTIPLICACIÓN</button>
            </div>
            <button style={styles.btnOutline} onClick={onExit}>SALIR</button>
        </div>
    );

    // --- 2. CONFIGURACIÓN ---
    if (screen === 'CONFIG') return (
        <div style={styles.screen}>
            <h2 style={styles.h2}>MODO {gameMode}</h2>
            <label style={{ color: 'white', marginBottom: '5px' }}>Dificultad (Cifras por número):</label>
            <select value={digits} onChange={(e) => setDigits(parseInt(e.target.value))} style={styles.select}>
                {gameMode === 'MULTI' ? (
                    <>
                        <option value="1">1 Cifra (Muy Fácil)</option>
                        <option value="2">2 Cifras (Normal)</option>
                        <option value="3">3 Cifras (Difícil)</option>
                    </>
                ) : (
                        <>
                            <option value="2">2 Cifras (Fácil)</option>
                            <option value="3">3 Cifras (Normal)</option>
                            <option value="4">4 Cifras (Difícil)</option>
                        </>
                    )}
            </select>

            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={iniciarPartida}>JUGAR</button>
            <button style={{ ...styles.btnOutline, borderColor: '#b59f3b', color: '#b59f3b', marginTop: '20px' }} onClick={() => { cargarRanking(); setScreen('RANKING_VIEW'); }}>
                🏆 VER RANKING
            </button>
            <button style={{ ...styles.btnOutline, border: 'none', fontSize: '0.9rem', marginTop: '10px' }} onClick={() => setScreen('MAIN')}>↩ Volver</button>
        </div>
    );

    // --- 3. VISTA RANKING ---
    if (screen === 'RANKING_VIEW') return (
        <div style={styles.screen}>
            <h2 style={{ color: '#b59f3b' }}>🏆 Ranking Top 10</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>{gameMode} ({digits} cifras)</p>
            <div style={styles.rankingContainer}>
                {loadingRanking ? <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Cargando...</p> : (
                    <table style={styles.table}>
                        <tbody>
                            {ranking.length === 0 ? <tr><td colSpan="2" style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Sin récords todavía</td></tr> : (
                                ranking.map((r, i) => (
                                    <tr key={i}>
                                        <td style={styles.td}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.'} {r.nombre}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', color: '#538d4e', fontFamily: 'monospace' }}>{formatTime(r.tiempo)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('CONFIG')}>Volver</button>
        </div>
    );

    // --- 4. VICTORIA ---
    if (screen === 'VICTORY') return (
        <div style={styles.screen}>
            <Confetti recycle={false} />
            <h1 style={styles.h1}>¡GANASTE! 🏆</h1>
            <p style={{ color: 'white' }}>Tiempo: <span style={{ color: '#538d4e', fontWeight: 'bold', fontSize: '1.5rem' }}>{formatTime(elapsedTime)}</span></p>
            <div style={{ margin: '20px 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {!usuario && (
                    <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Tu Nombre" maxLength={12} style={styles.inputName} />
                )}
                {usuario && <p style={{ color: '#b59f3b', marginBottom: '10px' }}>Jugador: <b>{usuario.displayName}</b></p>}
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={guardarPuntuacion}>Guardar Resultado</button>
            </div>
            <button style={{ ...styles.btn, background: 'linear-gradient(135deg,#27ae60,#2ecc71)', color: 'white' }} onClick={() => setMostrarEnvio(true)}>📤 Enviar al profesor</button>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setScreen('CONFIG')}>Jugar de Nuevo</button>
            {mostrarEnvio && <ModalEnviarProfe datos={{ tiempo: elapsedTime, operacion: gameMode, cifras: digits, intentos: guesses.length }} onClose={() => setMostrarEnvio(false)} />}
        </div>
    );

    // --- 5. JUEGO ---
    return (
        <div style={{ ...styles.screen, justifyContent: 'flex-start' }}>
            <div style={styles.header}>
                <div style={styles.timer}>{formatTime(elapsedTime)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#818384' }}>OBJETIVO</span>
                    <span style={styles.targetNum}>{targetNum}</span>
                </div>
                <div style={{ width: '40px', textAlign: 'right', cursor: 'pointer' }} onClick={() => setScreen('CONFIG')}><X color="white" /></div>
            </div>

            <div style={styles.gridScroll}>
                <div style={styles.gridContainer}>
                    {guesses.map((g, i) => (
                        <div key={i} style={styles.row}>
                            {g.substring(0, digits).split('').map((char, j) => (
                                <div key={`L-${j}`} style={{ ...styles.cell, ...getCellColor(char, j, g) }}>{char}</div>
                            ))}
                            <div style={styles.operator}>{getOpSymbol()}</div>
                            {g.substring(digits).split('').map((char, j) => (
                                <div key={`R-${j}`} style={{ ...styles.cell, ...getCellColor(char, digits + j, g) }}>{char}</div>
                            ))}
                        </div>
                    ))}
                    <div style={{ ...styles.row, animation: shakeRow ? 'shake 0.4s' : 'none' }}>
                        {Array.from({ length: digits }).map((_, j) => (
                            <div key={`curr-L-${j}`} style={{ ...styles.cell, borderColor: currentGuess[j] ? '#818384' : '#3a3a3c' }}>
                                {currentGuess[j] || ''}
                            </div>
                        ))}
                        <div style={styles.operator}>{getOpSymbol()}</div>
                        {Array.from({ length: digits }).map((_, j) => (
                            <div key={`curr-R-${j}`} style={{ ...styles.cell, borderColor: currentGuess[digits + j] ? '#818384' : '#3a3a3c' }}>
                                {currentGuess[digits + j] || ''}
                            </div>
                        ))}
                    </div>
                    {Array.from({ length: Math.max(0, 5 - guesses.length) }).map((_, i) => (
                        <div key={`empty-${i}`} style={styles.row}>
                            {Array.from({ length: digits }).map((_, j) => <div key={j} style={styles.cell}></div>)}
                            <div style={styles.operator}>{getOpSymbol()}</div>
                            {Array.from({ length: digits }).map((_, j) => <div key={j} style={styles.cell}></div>)}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...styles.toast, opacity: message ? 1 : 0 }}>{message}</div>

            <div style={styles.keyboard}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} style={styles.key} onClick={() => handleKey(n.toString())}>{n}</button>
                ))}
                <button style={{ ...styles.key, backgroundColor: '#b04848' }} onClick={() => handleKey('DEL')}>⌫</button>
                <button style={styles.key} onClick={() => handleKey('0')}>0</button>
                <button style={{ ...styles.key, backgroundColor: '#538d4e' }} onClick={() => handleKey('ENTER')}>OK</button>
            </div>

            <style>{`
                @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-5px);} 75%{transform:translateX(5px);} }
            `}</style>
        </div>
    );
}

const styles = {
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#121213', zIndex: 5000, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Roboto', sans-serif" },
    h1: { fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0' },
    h2: { color: '#b59f3b', margin: '5px 0 20px 0', fontSize: '1.5rem' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '5px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '80%', maxWidth: '250px', transition: 'transform 0.1s' },
    btnPrimary: { backgroundColor: '#538d4e', color: 'white' },
    btnSecondary: { backgroundColor: '#818384', color: 'white' },
    btnOutline: { background: 'transparent', border: '2px solid #3a3a3c', color: '#fff', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' },
    select: { padding: '10px', fontSize: '1rem', borderRadius: '5px', margin: '15px 0', background: '#3a3a3c', color: 'white', border: '1px solid #565758', width: '80%', maxWidth: '250px' },
    header: { padding: '15px', width: '100%', borderBottom: '1px solid #3a3a3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' },
    timer: { fontFamily: "'Roboto Mono', monospace", background: '#3a3a3c', padding: '5px 10px', borderRadius: '4px' },
    targetNum: { fontWeight: 'bold', fontSize: '1.8rem', color: '#fff', borderBottom: '3px solid #b59f3b', marginLeft: '5px' },
    gridScroll: { flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '20px' },
    gridContainer: { display: 'flex', flexDirection: 'column', gap: '5px' },
    row: { display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' },
    cell: { width: '40px', height: '40px', border: '2px solid #3a3a3c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', fontWeight: 'bold', fontFamily: "'Roboto Mono', monospace" },
    operator: { width: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', color: '#818384', margin: '0 5px' },
    correct: { backgroundColor: '#538d4e', borderColor: '#538d4e' },
    present: { backgroundColor: '#b59f3b', borderColor: '#b59f3b' },
    absent: { backgroundColor: '#3a3a3c', borderColor: '#3a3a3c' },
    keyboard: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', width: '95%', maxWidth: '300px', padding: '10px', paddingBottom: '30px' },
    key: { backgroundColor: '#818384', color: 'white', padding: '15px 0', border: 'none', borderRadius: '4px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' },
    toast: { position: 'absolute', top: '12%', background: 'white', color: 'black', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', transition: 'opacity 0.3s', pointerEvents: 'none' },
    rankingContainer: { width: '90%', maxWidth: '350px', maxHeight: '300px', overflowY: 'auto', margin: '15px 0', border: '1px solid #3a3a3c', borderRadius: '5px', background: '#121213' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    td: { padding: '10px', textAlign: 'left', borderBottom: '1px solid #3a3a3c', color: '#ddd' },
    inputName: { padding: '10px', width: '200px', textAlign: 'center', borderRadius: '5px', border: 'none', marginBottom: '10px', fontSize: '1rem' }
};