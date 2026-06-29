import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { X, Trophy, Search, BookOpen, Globe, ArrowLeft, Zap, Clock, Share2 } from 'lucide-react';
import { guardarRegistroLocal } from './utils/registrosLocales';
import Confetti from 'react-confetti';

// --- CONFIGURACIÓN DE IDIOMAS (igual que Wordle / Sopa) ---
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

const MAX_ERRORES = 7;
const T_LETRA_SOLO = 15;   // segundos por letra en solo con tiempo
const T_LETRA_PVP = 10;    // segundos por letra en duelo
const T_PALABRA_PVP = 20;  // segundos para escribir la palabra en duelo

// ─── Modal Enviar al Profesor ────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'AHORCADO', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
                codigoProfesor: code,
                config: { idioma: datos.idioma, modo: datos.modo },
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.palabras, intentos: datos.intentos, tiempo: datos.tiempo }],
            });
            guardarRegistroLocal('AHORCADO', {
                titulo: datos.recursoTitulo, aciertos: datos.palabras,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
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
                        ['curso', 'Curso', curso, setCurso, 'Ej: 3º ESO A', false],
                        ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }} />
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

// ─── Modal de opciones para compartir ────────────────────────────────────────
function ShareModal({ url, titulo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = () => { navigator.clipboard.writeText(url).catch(() => { }); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
    const texto = encodeURIComponent(`🪢 Juega a este Ahorcado: ${titulo}\n${url}`);
    const opciones = [
        { label: 'Copiar enlace', icon: copiado ? '✅' : '🔗', color: '#2c3e50', bg: copiado ? '#e8f5e9' : '#f4f6f8', action: copiar },
        { label: 'WhatsApp', icon: '💬', color: '#25D366', bg: '#e8f8ee', action: () => window.open(`https://wa.me/?text=${texto}`, '_blank') },
        { label: 'Telegram', icon: '✈️', color: '#0088cc', bg: '#e8f4fb', action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`🪢 ${titulo}`)}`, '_blank') },
        { label: 'Correo', icon: '📧', color: '#e74c3c', bg: '#fdecea', action: () => window.open(`mailto:?subject=${encodeURIComponent(`Ahorcado: ${titulo}`)}&body=${texto}`, '_blank') },
        { label: 'Google Classroom', icon: '🎓', color: '#1565C0', bg: '#e3f2fd', action: () => window.open(`https://classroom.google.com/share?url=${encodeURIComponent(url)}`, '_blank') },
    ];
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 360, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.05rem' }}>🪢 Compartir ahorcado</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', padding: 4 }}>✕</button>
                </div>
                <div style={{ background: '#f4f6f8', borderRadius: 10, padding: '8px 12px', fontSize: '0.75rem', color: '#7f8c8d', wordBreak: 'break-all', marginBottom: 16 }}>{url}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {opciones.map(op => (
                        <button key={op.label} onClick={op.action}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${op.color}22`, background: op.bg, cursor: 'pointer', textAlign: 'left', fontSize: '0.93rem', fontWeight: 600, color: op.color }}>
                            <span style={{ fontSize: '1.2rem', width: 24, textAlign: 'center' }}>{op.icon}</span>
                            {op.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Ahorcado({ usuario, onExit, recurso }) {
    // PANTALLAS: CONFIG, LOADING, MODE_SELECT, GAME, VICTORY, LOST, TIMEOUT, RANKING, PVP_SETUP, PVP_PLAY, GAME_OVER
    const [screen, setScreen] = useState('CONFIG');

    // --- CONFIGURACIÓN ---
    const [config, setConfig] = useState({ lang: 'ES' });
    const [gameMode, setGameMode] = useState('CLASSIC'); // 'CLASSIC' | 'TIME_ATTACK'
    const [soloTimed, setSoloTimed] = useState(false);   // clásico con tiempo por letra

    // --- DATOS DEL JUEGO (solo y duelo) ---
    const [poolPalabras, setPoolPalabras] = useState([]);
    const [solution, setSolution] = useState('');
    const [guessed, setGuessed] = useState([]);
    const [mistakes, setMistakes] = useState(0);
    const [status, setStatus] = useState('playing'); // 'playing' | 'won' | 'lost' | 'proposer-timeout'
    const [score, setScore] = useState(0);

    // --- DUELO (2 jugadores local) ---
    const [inputWord, setInputWord] = useState('');
    const [p1Score, setP1Score] = useState(0);
    const [p2Score, setP2Score] = useState(0);
    const [round, setRound] = useState(1);
    const [proposer, setProposer] = useState(1);

    // --- TIEMPOS ---
    const [tiempoRestante, setTiempoRestante] = useState(300); // contrarreloj global
    const [timeLeft, setTimeLeft] = useState(null);            // por jugada (solo con tiempo / duelo)
    const [elapsedTime, setElapsedTime] = useState(0);
    const startRef = useRef(0);

    // --- RECURSO / PROFE ---
    const [customCode, setCustomCode] = useState('');
    const [isCustomGame, setIsCustomGame] = useState(false);
    const [recursoActual, setRecursoActual] = useState(null);

    // --- BUSCADOR ---
    const [biblioteca, setBiblioteca] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [filtros, setFiltros] = useState({ tema: '', ciclo: 'Secundaria' });

    // --- RANKING / ENVÍOS / COMPARTIR ---
    const [playerName, setPlayerName] = useState(usuario?.displayName || '');
    const [rankingData, setRankingData] = useState([]);
    const [cargandoRanking, setCargandoRanking] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [shareModal, setShareModal] = useState(null);

    const normalizeWord = (word) => word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

    // =========================================================
    // SISTEMA DE AUDIO (Web Audio API)
    // =========================================================
    const playTone = useCallback((freq, type, duration, vol = 0.1, startTime = 0) => {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
            const ctx = window.gameAudioCtx;
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
            gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(ctx.currentTime + startTime);
            osc.stop(ctx.currentTime + startTime + duration);
        } catch (e) { /* audio no disponible */ }
    }, []);

    const playCorrect = useCallback(() => { playTone(660, 'sine', 0.12, 0.12, 0); playTone(880, 'sine', 0.14, 0.12, 0.08); }, [playTone]);
    const playWrong = useCallback(() => { playTone(160, 'sawtooth', 0.25, 0.12, 0); }, [playTone]);
    const playBeep = useCallback(() => playTone(800, 'sine', 0.1, 0.05, 0), [playTone]);
    const playWin = useCallback(() => {
        playTone(440, 'triangle', 0.15, 0.1, 0); playTone(554, 'triangle', 0.15, 0.1, 0.15);
        playTone(659, 'triangle', 0.15, 0.1, 0.3); playTone(880, 'triangle', 0.4, 0.15, 0.45);
    }, [playTone]);
    const playLose = useCallback(() => {
        playTone(300, 'sawtooth', 0.3, 0.1, 0); playTone(250, 'sawtooth', 0.3, 0.1, 0.3); playTone(200, 'sawtooth', 0.6, 0.15, 0.6);
    }, [playTone]);

    const despertarAudio = () => {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
        if (window.gameAudioCtx.state === 'suspended') window.gameAudioCtx.resume();
    };

    // =========================================================
    // CARGA DE RECURSOS (prop o ?ahorcado=ID)
    // =========================================================
    useEffect(() => {
        if (recurso) procesarRecurso(recurso);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recurso]);

    useEffect(() => {
        if (recurso) return;
        const params = new URLSearchParams(window.location.search);
        const id = params.get('ahorcado');
        if (!id) return;
        getDoc(doc(db, 'resources', id)).then(snap => {
            if (snap.exists()) procesarRecurso({ id: snap.id, ...snap.data() });
        }).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // =========================================================
    // CRONÓMETRO CONTRARRELOJ (global)
    // =========================================================
    useEffect(() => {
        if (screen !== 'GAME' || gameMode !== 'TIME_ATTACK') return;
        const t = setInterval(() => {
            setTiempoRestante(prev => { if (prev <= 1) { clearInterval(t); setScreen('TIMEOUT'); return 0; } return prev - 1; });
        }, 1000);
        return () => clearInterval(t);
    }, [screen, gameMode]);

    // Cronómetro ascendente (clásico, para mostrar tiempo)
    useEffect(() => {
        if (screen !== 'GAME' || gameMode !== 'CLASSIC') return;
        const now = Date.now();
        startRef.current = now;
        const t = setInterval(() => setElapsedTime(Math.floor((Date.now() - now) / 1000)), 1000);
        return () => clearInterval(t);
    }, [screen, gameMode]);

    // Cronómetro por jugada (solo con tiempo / duelo)
    useEffect(() => {
        if (timeLeft === null) return;
        const activo = (screen === 'GAME' && gameMode === 'CLASSIC' && soloTimed && status === 'playing')
            || (screen === 'PVP_SETUP' && status === 'playing')
            || (screen === 'PVP_PLAY' && status === 'playing');
        if (!activo) return;
        if (timeLeft <= 0) { handleMoveTimeout(); return; }
        if (timeLeft <= 3) playBeep();
        const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, screen, status, gameMode, soloTimed]);

    // Detección de victoria de la palabra actual (solo y duelo)
    useEffect(() => {
        if (status !== 'playing' || !solution) return;
        if (screen !== 'GAME' && screen !== 'PVP_PLAY') return;
        const completa = solution.split('').every(ch => ch === ' ' || guessed.includes(ch));
        if (!completa) return;
        if (screen === 'PVP_PLAY') ganarRondaPvP();
        else gestionarAcierto();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guessed, solution, status, screen]);

    // =========================================================
    // PREPARACIÓN DEL POOL (solo / contrarreloj)
    // =========================================================
    const cargarDiccionarioYJugar = async (palabrasForzadas = null, idiomaForzado = null) => {
        setScreen('LOADING');
        const idioma = idiomaForzado || config.lang;
        try {
            let pool = [];
            if (palabrasForzadas && palabrasForzadas.length > 0) {
                pool = [...palabrasForzadas];
                setIsCustomGame(true);
            } else {
                // Palabras aleatorias del diccionario, de CUALQUIER longitud (4-12)
                const langData = LANGUAGES[idioma] || LANGUAGES.ES;
                const response = await fetch(langData.url);
                if (!response.ok) throw new Error('Error de conexión al diccionario');
                const text = await response.text();
                const allWords = text.split('\n').map(line => { const [w] = line.split(' '); return w ? normalizeWord(w) : ''; });
                pool = allWords.filter(w => w.length >= 4 && w.length <= 12 && /^[A-ZÑ]+$/.test(w)).slice(0, 4000);
                pool.sort(() => Math.random() - 0.5);
                setIsCustomGame(false);
            }
            if (pool.length === 0) throw new Error('No hay palabras válidas');
            setConfig(c => ({ ...c, lang: idioma }));
            setPoolPalabras(pool);
            setScore(0);
            setElapsedTime(0);
            setScreen('MODE_SELECT');
        } catch (e) {
            console.error(e);
            alert('Error cargando el diccionario. Revisa tu conexión.');
            setScreen('CONFIG');
        }
    };

    // Saca la siguiente palabra y prepara el tablero
    const siguientePalabra = (currentPool, modo, timed) => {
        const pool = currentPool || poolPalabras;
        const modoActual = modo || gameMode;
        if (pool.length === 0) { if (modoActual === 'TIME_ATTACK') setScreen('VICTORY'); return; }
        const next = pool[0];
        setPoolPalabras(pool.slice(1));
        setSolution(next);
        setGuessed([]);
        setMistakes(0);
        setStatus('playing');
        setTimeLeft((modoActual === 'CLASSIC' && timed) ? T_LETRA_SOLO : null);
        setScreen('GAME');
    };

    const empezarModo = (modo, timed = false) => {
        despertarAudio();
        setGameMode(modo);
        setSoloTimed(timed);
        if (modo === 'TIME_ATTACK') setTiempoRestante(300);
        else setElapsedTime(0);
        siguientePalabra(poolPalabras, modo, timed);
    };

    // =========================================================
    // LÓGICA DE JUEGO (solo)
    // =========================================================
    const gestionarAcierto = () => {
        setStatus('won');
        setTimeLeft(null);
        if (gameMode === 'TIME_ATTACK') {
            setScore(s => s + 1);
            playWin();
            setTimeout(() => siguientePalabra(null, 'TIME_ATTACK', false), 1100);
        } else {
            setScore(1);
            playWin();
            setElapsedTime(Math.floor((Date.now() - startRef.current) / 1000));
            setScreen('VICTORY');
        }
    };

    const gestionarFallo = () => {
        setStatus('lost');
        setTimeLeft(null);
        playLose();
        if (gameMode === 'TIME_ATTACK') setTimeout(() => siguientePalabra(null, 'TIME_ATTACK', false), 1500);
        else setScreen('LOST');
    };

    // =========================================================
    // LÓGICA DE JUEGO (duelo)
    // =========================================================
    const empezarDuelo = () => {
        despertarAudio();
        setP1Score(0); setP2Score(0); setRound(1); setProposer(1);
        startPvPRound(1, 1);
    };

    const startPvPRound = (currentRound, currentProposer) => {
        setInputWord(''); setSolution(''); setGuessed([]); setMistakes(0);
        setStatus('playing'); setProposer(currentProposer); setRound(currentRound);
        setTimeLeft(T_PALABRA_PVP);
        setScreen('PVP_SETUP');
    };

    const submitWord = () => {
        const clean = inputWord.trim();
        if (!clean) return;
        setSolution(clean); setGuessed([]); setMistakes(0); setStatus('playing');
        setTimeLeft(T_LETRA_PVP);
        setScreen('PVP_PLAY');
    };

    const ganarRondaPvP = () => {
        setStatus('won'); setTimeLeft(null); playWin();
        const guesser = proposer === 1 ? 2 : 1;
        if (guesser === 1) setP1Score(s => s + 1); else setP2Score(s => s + 1);
    };

    const perderRondaPvP = () => {
        setStatus('lost'); setTimeLeft(null); playLose();
        // El que adivinaba ha fallado → punto para quien propuso
        if (proposer === 1) setP1Score(s => s + 1); else setP2Score(s => s + 1);
    };

    const nextRound = () => {
        if (p1Score >= 3 || p2Score >= 3) setScreen('GAME_OVER');
        else startPvPRound(round + 1, proposer === 1 ? 2 : 1);
    };

    // =========================================================
    // TIMEOUTS POR JUGADA
    // =========================================================
    const handleMoveTimeout = () => {
        if (screen === 'PVP_SETUP') {
            // El proponente no escribió a tiempo → punto para el rival
            setStatus('proposer-timeout'); setTimeLeft(null); playLose();
            const guesser = proposer === 1 ? 2 : 1;
            if (guesser === 1) setP1Score(s => s + 1); else setP2Score(s => s + 1);
            return;
        }
        // Solo con tiempo o duelo jugando → cuenta como fallo
        const nuevos = mistakes + 1;
        setMistakes(nuevos);
        if (nuevos >= MAX_ERRORES) {
            if (screen === 'PVP_PLAY') perderRondaPvP();
            else gestionarFallo();
        } else {
            playWrong();
            setTimeLeft(screen === 'PVP_PLAY' ? T_LETRA_PVP : T_LETRA_SOLO);
        }
    };

    // =========================================================
    // PULSACIÓN DE LETRAS
    // =========================================================
    const pulsarLetra = (key) => {
        if (status !== 'playing' || guessed.includes(key)) return;
        setGuessed(prev => [...prev, key]);
        if (solution.includes(key)) {
            playCorrect();
            if (screen === 'PVP_PLAY') setTimeLeft(T_LETRA_PVP);
            else if (soloTimed) setTimeLeft(T_LETRA_SOLO);
        } else {
            const nuevos = mistakes + 1;
            setMistakes(nuevos);
            if (nuevos >= MAX_ERRORES) {
                if (screen === 'PVP_PLAY') perderRondaPvP();
                else gestionarFallo();
            } else {
                playWrong();
                if (screen === 'PVP_PLAY') setTimeLeft(T_LETRA_PVP);
                else if (soloTimed) setTimeLeft(T_LETRA_SOLO);
            }
        }
    };

    // Escribir la palabra (proponente del duelo)
    const pulsarSetup = (key) => {
        if (key === 'BORRAR') setInputWord(prev => prev.slice(0, -1));
        else if (key === 'ESPACIO') { if (inputWord.length < 20) setInputWord(prev => prev + ' '); }
        else if (inputWord.length < 20) setInputWord(prev => prev + key);
    };

    // Teclado físico
    useEffect(() => {
        const handler = (e) => {
            const key = e.key.toUpperCase();
            if (screen === 'GAME' || screen === 'PVP_PLAY') { if (/^[A-ZÑ]$/.test(key)) pulsarLetra(key); }
            else if (screen === 'PVP_SETUP' && status === 'playing') {
                if (/^[A-ZÑ]$/.test(key)) pulsarSetup(key);
                else if (e.key === 'Backspace') pulsarSetup('BORRAR');
                else if (e.key === ' ') pulsarSetup('ESPACIO');
                else if (e.key === 'Enter') submitWord();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen, status, guessed, solution, mistakes, inputWord]);

    // =========================================================
    // RECURSOS DEL PROFESOR (acepta Wordle y Sopa)
    // =========================================================
    const procesarRecurso = (data) => {
        let palabrasCandidatas = [];
        if (data.hojas) {
            data.hojas.forEach(h => {
                if (h.palabras && Array.isArray(h.palabras)) {
                    h.palabras.forEach(p => {
                        const limpia = normalizeWord(p);
                        if (limpia && /^[A-ZÑ]+$/.test(limpia) && limpia.length >= 3) palabrasCandidatas.push(limpia);
                    });
                }
            });
        }
        if (palabrasCandidatas.length === 0) { alert('Este recurso no tiene palabras válidas para el ahorcado.'); setScreen('CONFIG'); return; }
        palabrasCandidatas.sort(() => Math.random() - 0.5);
        setRecursoActual(data);
        if (data.id) window.history.replaceState({}, '', `?ahorcado=${data.id}`);
        cargarDiccionarioYJugar(palabrasCandidatas, data.config?.idioma || 'ES');
    };

    const cargarNivelPersonalizado = async () => {
        if (!customCode.trim()) return alert('Escribe un código');
        setScreen('LOADING');
        try {
            const code = customCode.toUpperCase().trim();
            let q = query(collection(db, 'resources'), where('accessCode', '==', code));
            let snap = await getDocs(q);
            if (snap.empty) { q = query(collection(db, 'resources'), where('hojasCodes', 'array-contains', code)); snap = await getDocs(q); }
            if (snap.empty) throw new Error('Código no encontrado');
            const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
            if (data.tipoJuego !== 'WORDLE' && data.tipoJuego !== 'SOPA') throw new Error('Este código no sirve para el Ahorcado (usa un recurso de Wordle o Sopa de Letras).');
            procesarRecurso(data);
        } catch (e) { alert(e.message); setScreen('CONFIG'); }
    };

    const buscarRecursosPublicos = async () => {
        setBuscando(true);
        try {
            const q = query(collection(db, 'resources'), where('isPrivate', '==', false), limit(150));
            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const clean = (t) => t ? t.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
            const filtrados = docs.filter(r => {
                if (r.tipoJuego !== 'WORDLE' && r.tipoJuego !== 'SOPA') return false;
                const cumpleTema = !filtros.tema || clean(r.titulo).includes(clean(filtros.tema)) || clean(r.temas).includes(clean(filtros.tema));
                const cumpleCiclo = !filtros.ciclo || r.ciclo === filtros.ciclo;
                return cumpleTema && cumpleCiclo;
            });
            filtrados.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
            setBiblioteca(filtrados);
            if (filtrados.length === 0) alert('No se han encontrado recursos públicos con esos filtros.');
        } catch (e) { console.error(e); alert('Error al buscar recursos.'); }
        setBuscando(false);
    };

    const compartirRecurso = (id, titulo) => {
        const url = `${window.location.origin}${window.location.pathname}?ahorcado=${id}`;
        setShareModal({ url, titulo: titulo || 'Ahorcado' });
    };

    // =========================================================
    // RANKING — solo modo CONTRARRELOJ
    // =========================================================
    const guardarPuntuacion = async () => {
        if (!playerName.trim()) return alert('Escribe tu nombre');
        setGuardando(true);
        try {
            const isGuest = !usuario || !usuario.email;
            const email = isGuest ? 'invitado' : usuario.email;
            const base = { fecha: new Date(), email, jugador: playerName.trim(), palabras: score, tiempo: elapsedTime, modo: 'TIME_ATTACK', lang: config.lang };
            if (isCustomGame && recursoActual) {
                await addDoc(collection(db, 'ranking'), { ...base, recursoId: recursoActual.id || customCode, recursoTitulo: recursoActual.titulo || 'Ahorcado', tipoJuego: 'AHORCADO', juego: 'Ahorcado' });
            } else {
                await addDoc(collection(db, 'ranking_ahorcado'), { ...base });
            }
            guardarRegistroLocal('AHORCADO', { titulo: (isCustomGame && recursoActual) ? (recursoActual.titulo || 'Ahorcado') : `Aleatorio (${config.lang})`, aciertos: score, nombre: playerName.trim(), via: 'ranking' });
            alert('¡Resultado guardado!');
            cargarRanking();
        } catch (e) { console.error(e); alert('Error al guardar la puntuación'); }
        setGuardando(false);
    };

    const cargarRanking = async () => {
        setCargandoRanking(true);
        setScreen('RANKING');
        try {
            let q;
            if (isCustomGame && recursoActual) {
                q = query(collection(db, 'ranking'), where('recursoId', '==', recursoActual.id || customCode), where('tipoJuego', '==', 'AHORCADO'), limit(50));
            } else {
                q = query(collection(db, 'ranking_ahorcado'), where('modo', '==', 'TIME_ATTACK'), where('lang', '==', config.lang), limit(50));
            }
            const snap = await getDocs(q);
            let datos = snap.docs.map(d => d.data());
            datos.sort((a, b) => (b.palabras || 0) - (a.palabras || 0) || (a.tiempo || 0) - (b.tiempo || 0));
            setRankingData(datos.slice(0, 10));
        } catch (e) { console.error(e); }
        setCargandoRanking(false);
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const volverAlMenu = () => { setScreen('CONFIG'); setIsCustomGame(false); setRecursoActual(null); setTimeLeft(null); setStatus('playing'); };

    // =========================================================
    // RENDER: MUÑECO DEL AHORCADO
    // =========================================================
    const renderHangman = () => (
        <svg viewBox="0 0 200 250" style={{ width: '100%', maxWidth: '230px', height: 'auto', display: 'block', margin: '0 auto', filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.25))' }}>
            {mistakes > 0 && (
                <g stroke="#1e293b" strokeWidth="8" strokeLinecap="round">
                    <line x1="20" y1="230" x2="120" y2="230" />
                    <line x1="70" y1="230" x2="70" y2="20" />
                    <line x1="66" y1="20" x2="150" y2="20" />
                    <line x1="150" y1="16" x2="150" y2="50" strokeWidth="6" stroke="#475569" />
                </g>
            )}
            {mistakes > 1 && <circle cx="150" cy="75" r="20" stroke="#e53e3e" strokeWidth="6" fill="#fff" />}
            {mistakes > 2 && <line x1="150" y1="95" x2="150" y2="160" stroke="#e53e3e" strokeWidth="6" strokeLinecap="round" />}
            {mistakes > 3 && <line x1="150" y1="110" x2="120" y2="140" stroke="#e53e3e" strokeWidth="6" strokeLinecap="round" />}
            {mistakes > 4 && <line x1="150" y1="110" x2="180" y2="140" stroke="#e53e3e" strokeWidth="6" strokeLinecap="round" />}
            {mistakes > 5 && <line x1="150" y1="160" x2="120" y2="210" stroke="#e53e3e" strokeWidth="6" strokeLinecap="round" />}
            {mistakes > 6 && (
                <g stroke="#e53e3e" strokeWidth="6" strokeLinecap="round">
                    <line x1="150" y1="160" x2="180" y2="210" />
                    <line x1="140" y1="65" x2="145" y2="70" strokeWidth="3" />
                    <line x1="145" y1="65" x2="140" y2="70" strokeWidth="3" />
                    <line x1="155" y1="65" x2="160" y2="70" strokeWidth="3" />
                    <line x1="160" y1="65" x2="155" y2="70" strokeWidth="3" />
                </g>
            )}
        </svg>
    );

    // Teclado de adivinar (solo y duelo)
    const renderTeclado = () => {
        const kb = (LANGUAGES[config.lang] || LANGUAGES.ES).keyboard;
        const bloqueado = status !== 'playing';
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', width: '100%', maxWidth: '600px', opacity: bloqueado ? 0.55 : 1, pointerEvents: bloqueado ? 'none' : 'auto' }}>
                {kb.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', gap: '4px', justifyContent: 'center', width: '100%' }}>
                        {row.map(key => {
                            const usada = guessed.includes(key);
                            const acierto = usada && solution.includes(key);
                            return (
                                <button key={key} onClick={() => pulsarLetra(key)} disabled={usada}
                                    style={{ flex: 1, minWidth: '24px', maxWidth: '46px', aspectRatio: '1/1', padding: 0, fontSize: 'clamp(0.9rem, 4vw, 1.4rem)', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: usada ? 'default' : 'pointer', background: usada ? (acierto ? '#22c55e' : '#ef4444') : '#e2e8f0', color: usada ? '#fff' : '#1e293b', boxShadow: usada ? 'none' : '0 3px 5px rgba(0,0,0,0.12)', transition: 'all 0.15s', touchAction: 'manipulation' }}>
                                    {key}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    // Teclado del proponente (duelo): escribir la palabra
    const renderTecladoSetup = () => {
        const kb = (LANGUAGES[config.lang] || LANGUAGES.ES).keyboard;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
                {kb.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', gap: '4px', justifyContent: 'center', width: '100%' }}>
                        {row.map(key => (
                            <button key={key} onClick={() => pulsarSetup(key)}
                                style={{ flex: 1, minWidth: '24px', maxWidth: '46px', aspectRatio: '1/1', padding: 0, fontSize: 'clamp(0.9rem, 4vw, 1.4rem)', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#e2e8f0', color: '#1e293b', boxShadow: '0 3px 5px rgba(0,0,0,0.12)', touchAction: 'manipulation' }}>
                                {key}
                            </button>
                        ))}
                    </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', width: '100%', marginTop: '4px' }}>
                    <button onClick={() => pulsarSetup('ESPACIO')} style={{ flex: 2, padding: '14px 0', fontSize: '1rem', fontWeight: 'bold', borderRadius: '8px', border: 'none', background: '#cbd5e1', color: '#1e293b', cursor: 'pointer' }}>ESPACIO</button>
                    <button onClick={() => pulsarSetup('BORRAR')} style={{ flex: 1, padding: '14px 0', fontSize: '1rem', fontWeight: 'bold', borderRadius: '8px', border: 'none', background: '#f87171', color: '#fff', cursor: 'pointer' }}>⌫</button>
                </div>
            </div>
        );
    };

    const renderPalabra = () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(3px,1vw,8px)', justifyContent: 'center', minHeight: '55px', width: '100%' }}>
            {solution.split('').map((char, i) => char === ' ' ? (
                <div key={i} style={{ width: 'clamp(15px,4vw,30px)' }} />
            ) : (
                <div key={i} style={{ width: 'clamp(24px,7vw,44px)', height: 'clamp(34px,9vw,54px)', borderBottom: 'clamp(3px,1vw,5px) solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 'clamp(1.4rem,6vw,2.4rem)', fontWeight: 'bold', color: status === 'lost' && !guessed.includes(char) ? '#fca5a5' : 'white' }}>
                    {(guessed.includes(char) || status !== 'playing') ? char : ''}
                </div>
            ))}
        </div>
    );

    // =========================================================
    // VISTAS
    // =========================================================
    if (screen === 'LOADING') return (
        <div style={styles.screen}>
            <div className="spin" style={{ border: '4px solid #333', borderTop: '4px solid #fff', borderRadius: '50%', width: '40px', height: '40px' }} />
            <p style={{ marginTop: '20px', color: 'white' }}>Preparando partida...</p>
            <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (screen === 'MODE_SELECT') return (
        <div style={styles.screen}>
            <button onClick={volverAlMenu} style={styles.backBtn}><ArrowLeft size={20} /> Volver</button>
            <h1 style={{ ...styles.h1, color: '#f1c40f' }}>Elige Modo</h1>
            <div style={styles.card}>
                <p style={{ marginBottom: '20px', color: '#555' }}>¿Cómo quieres jugar al ahorcado?</p>
                <button onClick={() => empezarModo('CLASSIC', false)} style={{ ...styles.btn, background: '#3498db', color: 'white' }}>
                    👤 Un jugador · Sin tiempo
                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9 }}>Adivina con calma antes de 7 fallos</div>
                </button>
                <button onClick={() => empezarModo('CLASSIC', true)} style={{ ...styles.btn, background: '#0ea5e9', color: 'white', marginTop: '12px' }}>
                    ⏱️ Un jugador · Con tiempo
                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9 }}>{T_LETRA_SOLO}s por cada letra</div>
                </button>
                <button onClick={() => empezarModo('TIME_ATTACK', false)} style={{ ...styles.btn, background: '#e74c3c', color: 'white', marginTop: '12px' }}>
                    <Zap size={22} style={{ marginBottom: 4 }} /> Contrarreloj (5 min)
                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9 }}>{isCustomGame ? 'Adivina todas las que puedas · con ranking' : '¡Palabras infinitas! · con ranking'}</div>
                </button>
            </div>
        </div>
    );

    // --- SOLO: GAME ---
    if (screen === 'GAME') return (
        <div style={{ ...styles.screen, backgroundColor: '#2c3e50', justifyContent: 'flex-start' }}>
            <div style={{ width: '100%', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {gameMode === 'TIME_ATTACK' ? (
                        <div style={{ fontFamily: "'Roboto Mono', monospace", background: '#e74c3c', color: 'white', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}><Clock size={14} style={{ verticalAlign: 'middle' }} /> {formatTime(tiempoRestante)}</div>
                    ) : soloTimed ? (
                        <div style={{ fontFamily: "'Roboto Mono', monospace", background: timeLeft <= 3 ? '#e74c3c' : 'white', color: timeLeft <= 3 ? 'white' : 'black', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>⏱ {timeLeft}s</div>
                    ) : (
                        <div style={{ fontFamily: "'Roboto Mono', monospace", background: 'white', color: 'black', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>⏱ {formatTime(elapsedTime)}</div>
                    )}
                    {gameMode === 'TIME_ATTACK' && <div style={{ background: '#f1c40f', color: '#2c3e50', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>⭐ {score}</div>}
                </div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{isCustomGame ? 'Desafío Profe' : 'Ahorcado'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isCustomGame && recursoActual?.id && (
                        <button onClick={() => compartirRecurso(recursoActual.id, recursoActual.titulo)} title="Compartir" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white' }}><Share2 size={16} /></button>
                    )}
                    <div style={{ cursor: 'pointer' }} onClick={volverAlMenu}><X color="white" /></div>
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', width: '100%', maxWidth: '1100px', gap: '20px', padding: '20px 15px', boxSizing: 'border-box', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {renderHangman()}
                    <div style={{ marginTop: 8, color: mistakes >= 5 ? '#fca5a5' : '#94a3b8', fontWeight: 'bold' }}>Fallos: {mistakes} / {MAX_ERRORES}</div>
                    {status === 'won' && <div style={{ marginTop: 8, color: '#22c55e', fontWeight: 'bold', fontSize: '1.3rem' }}>¡Acertaste! 🎉</div>}
                    {status === 'lost' && <div style={{ marginTop: 8, color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>La palabra era: {solution}</div>}
                </div>
                <div style={{ flex: '2 1 360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                    {renderPalabra()}
                    {renderTeclado()}
                </div>
            </div>
            {shareModal && <ShareModal url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />}
        </div>
    );

    // --- DUELO: PROPONER PALABRA ---
    if (screen === 'PVP_SETUP') return (
        <div style={{ ...styles.screen, backgroundColor: '#2c3e50', justifyContent: 'flex-start' }}>
            <button onClick={volverAlMenu} style={styles.backBtn}><ArrowLeft size={20} /> Salir</button>
            <div style={{ marginTop: 50, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ color: 'white', fontWeight: 'bold' }}>Ronda {round} / 5</div>
                <div style={{ color: '#f1c40f', fontWeight: 'bold' }}>Marcador: {p1Score} - {p2Score}</div>
            </div>
            {status === 'playing' ? (
                <>
                    <h2 style={{ color: '#3b82f6', textAlign: 'center', margin: '14px 0 6px' }}>Jugador {proposer}, escribe la palabra</h2>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: timeLeft <= 5 ? '#ef4444' : '#f59e0b' }}>⏳ {timeLeft}s</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', minHeight: 50, width: '90%', maxWidth: 500, padding: 12, margin: '14px 0', background: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
                        {inputWord.length === 0 ? <span style={{ color: '#94a3b8' }}>Usa el teclado de abajo…</span> :
                            inputWord.split('').map((c, i) => (
                                <div key={i} style={{ width: 26, height: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.6rem', fontWeight: 'bold', color: 'white', borderBottom: c !== ' ' ? '3px solid #94a3b8' : 'none' }}>{c === ' ' ? '' : '•'}</div>
                            ))}
                    </div>
                    {renderTecladoSetup()}
                    <button onClick={submitWord} disabled={!inputWord.trim()} style={{ ...styles.btn, background: '#10b981', color: 'white', marginTop: 16, maxWidth: 400, opacity: inputWord.trim() ? 1 : 0.5 }}>🙈 Esconder y jugar</button>
                </>
            ) : (
                <div style={{ textAlign: 'center', marginTop: 40 }}>
                    <h2 style={{ color: '#ef4444' }}>¡Tiempo agotado!</h2>
                    <p style={{ color: 'white' }}>El Jugador {proposer} tardó demasiado. Punto para el Jugador {proposer === 1 ? 2 : 1}.</p>
                    <button onClick={nextRound} style={{ ...styles.btn, ...styles.btnPrimary, maxWidth: 400 }}>Siguiente ronda</button>
                </div>
            )}
        </div>
    );

    // --- DUELO: ADIVINAR ---
    if (screen === 'PVP_PLAY') return (
        <div style={{ ...styles.screen, backgroundColor: '#2c3e50', justifyContent: 'flex-start' }}>
            <div style={{ width: '100%', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ fontFamily: "'Roboto Mono', monospace", background: timeLeft <= 3 ? '#e74c3c' : 'white', color: timeLeft <= 3 ? 'white' : 'black', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold' }}>⏱ {timeLeft}s</div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1rem' }}>Ronda {round}/5 · {p1Score}-{p2Score}</h2>
                <div style={{ cursor: 'pointer' }} onClick={volverAlMenu}><X color="white" /></div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', width: '100%', maxWidth: '1100px', gap: '20px', padding: '20px 15px', boxSizing: 'border-box', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {renderHangman()}
                    <div style={{ marginTop: 8, color: mistakes >= 5 ? '#fca5a5' : '#94a3b8', fontWeight: 'bold' }}>Fallos: {mistakes} / {MAX_ERRORES}</div>
                    {status === 'won' && <div style={{ marginTop: 8, color: '#22c55e', fontWeight: 'bold', fontSize: '1.2rem' }}>¡Acertó el Jugador {proposer === 1 ? 2 : 1}! 🎉</div>}
                    {status === 'lost' && <div style={{ marginTop: 8, color: '#ef4444', fontWeight: 'bold', fontSize: '1.05rem' }}>¡Ahorcado! Punto para el Jugador {proposer}. La palabra era: {solution}</div>}
                    {status !== 'playing' && <button onClick={nextRound} style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 14, maxWidth: 300 }}>Continuar</button>}
                </div>
                <div style={{ flex: '2 1 360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                    {renderPalabra()}
                    {renderTeclado()}
                </div>
            </div>
        </div>
    );

    // --- DUELO: FIN DE PARTIDA ---
    if (screen === 'GAME_OVER') return (
        <div style={{ ...styles.screen, backgroundColor: '#27ae60' }}>
            <Confetti recycle={false} />
            <h1 style={{ ...styles.h1, color: 'white' }}>¡Partida finalizada!</h1>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', margin: '20px 0' }}>
                <div style={{ padding: 20, borderRadius: 15, background: p1Score >= 3 ? '#f1c40f' : 'rgba(255,255,255,0.15)', color: p1Score >= 3 ? '#2c3e50' : 'white', fontWeight: 'bold', fontSize: '1.4rem', minWidth: 160, textAlign: 'center' }}>Jugador 1<br />{p1Score}</div>
                <div style={{ padding: 20, borderRadius: 15, background: p2Score >= 3 ? '#f1c40f' : 'rgba(255,255,255,0.15)', color: p2Score >= 3 ? '#2c3e50' : 'white', fontWeight: 'bold', fontSize: '1.4rem', minWidth: 160, textAlign: 'center' }}>Jugador 2<br />{p2Score}</div>
            </div>
            <h2 style={{ color: 'white' }}>🏆 ¡Gana el Jugador {p1Score >= 3 ? 1 : 2}!</h2>
            <button onClick={empezarDuelo} style={{ ...styles.btn, background: 'white', color: '#27ae60', marginTop: 14, maxWidth: 400 }}>🔁 Revancha</button>
            <button onClick={volverAlMenu} style={{ ...styles.btn, background: 'rgba(0,0,0,0.2)', color: 'white', marginTop: 12, maxWidth: 400 }}>🏠 Menú principal</button>
        </div>
    );

    // --- SOLO: RESULTADO ---
    if (screen === 'VICTORY' || screen === 'TIMEOUT' || screen === 'LOST') {
        const ganada = screen === 'VICTORY';
        const bg = screen === 'TIMEOUT' ? '#e67e22' : ganada ? '#27ae60' : '#c0392b';
        const esContrarreloj = gameMode === 'TIME_ATTACK';
        return (
            <div style={{ ...styles.screen, backgroundColor: bg }}>
                {ganada && <Confetti recycle={false} />}
                <h1 style={{ ...styles.h1, color: 'white' }}>{screen === 'TIMEOUT' ? '¡TIEMPO AGOTADO! ⏳' : ganada ? '¡VICTORIA! 🥳' : '¡AHORCADO! 💀'}</h1>
                {esContrarreloj ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'white', fontSize: '1.2rem' }}>Has adivinado:</p>
                        <div style={{ fontSize: '4rem', color: '#f1c40f', fontWeight: 'bold', textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}>{score}</div>
                        <p style={{ color: 'white' }}>palabras</p>
                    </div>
                ) : (
                    <p style={{ color: 'white', fontSize: '1.2rem' }}>{ganada ? <>Tiempo: <b style={{ color: '#f1c40f' }}>{formatTime(elapsedTime)}</b></> : <>La palabra era: <b style={{ color: '#f1c40f' }}>{solution}</b></>}</p>
                )}

                {/* Ranking SOLO en contrarreloj */}
                {esContrarreloj && (
                    <>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '15px', marginTop: '20px', width: '90%', maxWidth: '350px', textAlign: 'center' }}>
                            {(!usuario || !usuario.email) ? (
                                <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Escribe tu nombre..." maxLength={15} style={{ padding: '12px', width: '100%', textAlign: 'center', borderRadius: '8px', border: 'none', marginBottom: '12px', fontSize: '1.1rem', boxSizing: 'border-box' }} />
                            ) : (
                                <p style={{ color: '#f1c40f', marginBottom: '12px', fontSize: '1.1rem' }}><b>{usuario.displayName}</b></p>
                            )}
                            <button style={{ ...styles.btn, width: '100%', background: '#f1c40f', color: '#2c3e50' }} onClick={guardarPuntuacion} disabled={guardando}>{guardando ? 'Guardando...' : '💾 Guardar puntuación'}</button>
                        </div>
                        <button style={{ ...styles.btn, background: 'transparent', color: 'white', border: '2px solid white', marginTop: '14px', maxWidth: 350 }} onClick={cargarRanking}>🏆 Ver Ranking</button>
                    </>
                )}

                <button style={{ ...styles.btn, background: 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', marginTop: '12px', maxWidth: 350 }} onClick={() => setMostrarEnvio(true)}>📤 Enviar al profesor</button>
                {isCustomGame && recursoActual?.id && (
                    <button style={{ ...styles.btn, background: 'white', color: '#2c3e50', marginTop: '12px', maxWidth: 350, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }} onClick={() => compartirRecurso(recursoActual.id, recursoActual.titulo)}><Share2 size={15} /> Compartir ahorcado</button>
                )}
                <button style={{ ...styles.btn, background: 'white', color: '#27ae60', marginTop: '12px', maxWidth: 350 }} onClick={() => setScreen('MODE_SELECT')}>🔁 Jugar otra vez</button>
                <button style={{ ...styles.btn, background: 'rgba(0,0,0,0.2)', color: 'white', marginTop: '12px', maxWidth: 350 }} onClick={volverAlMenu}>🏠 Menú principal</button>

                {mostrarEnvio && <ModalEnviarProfe datos={{ recursoId: recursoActual?.id, recursoTitulo: recursoActual?.titulo, palabras: score, intentos: mistakes, idioma: config.lang, modo: gameMode, tiempo: elapsedTime }} onClose={() => setMostrarEnvio(false)} />}
                {shareModal && <ShareModal url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />}
            </div>
        );
    }

    if (screen === 'RANKING') return (
        <div style={styles.screen}>
            <h1 style={{ ...styles.h1, color: '#f1c40f' }}><Trophy size={32} style={{ verticalAlign: 'bottom' }} /> TOP 10</h1>
            <p style={{ color: '#bdc3c7', marginBottom: '20px' }}>{isCustomGame && recursoActual ? `Recurso: ${recursoActual.titulo}` : `${LANGUAGES[config.lang].label} · Contrarreloj`}</p>
            <div style={{ width: '90%', maxWidth: '400px', background: 'rgba(0,0,0,0.2)', borderRadius: '15px', padding: '10px', minHeight: '260px' }}>
                {cargandoRanking ? <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>Cargando...</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
                        <tbody>
                            {rankingData.length === 0 ? <tr><td style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>Nadie ha jugado aún. ¡Sé el primero!</td></tr> :
                                rankingData.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <td style={{ padding: '13px 10px', fontSize: '1.05rem' }}>
                                            <span style={{ color: i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#d35400' : '#7f8c8d', fontWeight: 'bold', marginRight: '10px' }}>{i + 1}º</span>
                                            {r.jugador || r.nombre}
                                        </td>
                                        <td style={{ padding: '13px 10px', textAlign: 'right', fontWeight: 'bold', color: '#2ecc71', fontSize: '1.05rem' }}>⭐ {r.palabras || 0}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                )}
            </div>
            <button style={{ ...styles.btn, ...styles.btnPrimary, marginTop: '30px', maxWidth: 400 }} onClick={volverAlMenu}>Volver al Menú</button>
        </div>
    );

    // --- PANTALLA INICIAL (CONFIG) ---
    return (
        <div style={styles.screen}>
            <button onClick={onExit} style={styles.backBtn}><ArrowLeft size={20} /> Volver</button>
            <h1 style={styles.h1}>AHORCADO</h1>

            <div style={styles.card}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={styles.label}><Globe size={16} style={{ verticalAlign: 'middle' }} /> Idioma</label>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {Object.keys(LANGUAGES).map(k => (
                            <button key={k} onClick={() => setConfig({ ...config, lang: k })} style={{ ...styles.optionBtn, background: config.lang === k ? '#3F51B5' : '#eee', color: config.lang === k ? 'white' : '#333' }}>{LANGUAGES[k].label}</button>
                        ))}
                    </div>
                </div>
                <p style={{ fontSize: '12px', color: '#888', marginTop: '-6px', marginBottom: '16px' }}>Palabras aleatorias del diccionario (cualquier longitud), igual que en Wordle</p>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => cargarDiccionarioYJugar(null, null)}>🎲 Jugar (1 jugador)</button>
                <button style={{ ...styles.btn, background: '#8e44ad', color: 'white' }} onClick={empezarDuelo}>👥 2 Jugadores · Duelo (mejor de 5)</button>
            </div>

            {/* CÓDIGO PROFE */}
            <div style={{ ...styles.card, marginTop: '15px', background: '#e3f2fd', border: '1px solid #90caf9' }}>
                <label style={{ ...styles.label, color: '#1565c0' }}><BookOpen size={16} style={{ verticalAlign: 'middle' }} /> Jugar Desafío de Profe</label>
                <p style={{ fontSize: '11px', color: '#1565c0', margin: '0 0 8px' }}>Sirven los códigos de Wordle y Sopa de Letras</p>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="CÓDIGO..." style={styles.inputCode} maxLength={6} />
                    <button onClick={cargarNivelPersonalizado} style={styles.btnSearch}><Search size={20} /></button>
                </div>
            </div>

            {/* BUSCADOR */}
            <div style={{ ...styles.card, marginBottom: '50px', marginTop: '15px', background: '#e8f5e9', border: '1px solid #81c784' }}>
                <h3 style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}><Search size={20} /> Explorar palabras</h3>
                <button onClick={buscarRecursosPublicos} style={{ ...styles.btn, background: '#2e7d32', color: 'white' }}>{buscando ? 'Buscando...' : 'Ver recursos públicos'}</button>
                <div style={styles.scrollX}>
                    {biblioteca.map(r => (
                        <div key={r.id} style={styles.miniCard}>
                            <h4 style={{ margin: '0 0 5px 0', color: '#2e7d32', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</h4>
                            <div style={{ fontSize: '11px', color: '#555' }}>🏫 {r.ciclo} · {r.tipoJuego === 'WORDLE' ? 'Wordle' : 'Sopa'}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button onClick={() => procesarRecurso(r)} style={{ ...styles.miniPlayBtn, flex: 1 }}>JUGAR</button>
                                <button onClick={e => { e.stopPropagation(); compartirRecurso(r.id, r.titulo); }} title="Compartir" style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #81c784', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#2e7d32' }}><Share2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {shareModal && <ShareModal url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />}
        </div>
    );
}

const styles = {
    screen: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#2c3e50', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', fontFamily: "'Roboto', sans-serif", overflowY: 'auto', padding: '40px 0', WebkitOverflowScrolling: 'touch' },
    backBtn: { position: 'absolute', top: '20px', left: '20px', background: 'white', border: '1px solid #ddd', borderRadius: '30px', padding: '8px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#333', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    card: { background: '#fffacb', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '500px', width: '80%', textAlign: 'center', display: 'flex', flexDirection: 'column' },
    h1: { fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '2px', margin: '10px 0', color: '#f1c40f', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },
    label: { display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#555', fontSize: '0.9rem' },
    optionBtn: { padding: '8px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' },
    btn: { padding: '15px', fontSize: '1.1rem', borderRadius: '8px', margin: '8px 0', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%' },
    btnPrimary: { backgroundColor: '#3498db', color: 'white' },
    inputCode: { flex: 1, padding: '12px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '5px', border: '1px solid #90caf9', outline: 'none' },
    btnSearch: { background: '#1565c0', color: 'white', border: 'none', borderRadius: '5px', padding: '0 15px', cursor: 'pointer' },
    scrollX: { marginTop: '15px', width: '100%', display: 'flex', overflowX: 'auto', gap: '10px', padding: '10px 5px', scrollBehavior: 'smooth' },
    miniCard: { minWidth: '180px', width: '180px', flexShrink: 0, background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' },
    miniPlayBtn: { background: '#2e7d32', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
};
