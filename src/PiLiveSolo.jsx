import { useState, useEffect, useRef, memo } from 'react';
import { db } from './firebase';
import { doc, getDoc, addDoc, updateDoc, increment, collection } from 'firebase/firestore';
import confetti from 'canvas-confetti';

// --- AUDIOS ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import startSoundFile from './assets/inicio-juego.mp3';

const _mkAudio = src => { let a; return { get currentTime(){ return a?.currentTime??0; }, set currentTime(v){ (a??=new Audio(src)).currentTime=v; }, play(){ return (a??=new Audio(src)).play(); } }; };
const audioCorrect = _mkAudio(correctSoundFile);
const audioWrong   = _mkAudio(wrongSoundFile);
const audioWin     = _mkAudio(winSoundFile);
const audioStart   = _mkAudio(startSoundFile);

const safePlay = (audioObj) => {
    audioObj.currentTime = 0;
    audioObj.play().catch(e => console.log("Audio bloqueado por navegador", e));
};

const clean = (s) => s ? String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() : "";

const parseText = (text) => {
    if (!text) return "";
    let p = String(text).replace(/\((.*?)\)\^\((.*?)\)/g, '<span>$1<sup>$2</sup></span>');
    p = p.replace(/\((.*?)\)\/\((.*?)\)/g, '<span class="fraction"><span class="numer">$1</span><span class="denom">$2</span></span>');
    return <span dangerouslySetInnerHTML={{ __html: p }} />;
};

// Texto de la respuesta correcta según el tipo de pregunta
const getCorrectAnswerText = (data) => {
    if (!data) return '';
    if (data.tipo === 'ORDENAR') return (data.bloques || []).join('  ');
    if (data.tipo === 'RELLENAR') return data.bloques?.[1] || '';
    return data.respuesta || data.correcta || data.a || '';
};

// ============================================================================
// PILIVE SOLO — juego individual (sin sala), copia independiente de ThinkHootGame.jsx
// Pensado para no tocar el flujo de presentación en vivo. Soporta preguntas
// MUSICAL con reproductor de YouTube real (el motor en vivo solo lo soporta en sala).
// ============================================================================
export default function PiLiveSolo({ recurso, usuario, alTerminar }) {
    if (!recurso) return <div style={{ color: 'white', padding: 20 }}>Cargando...</div>;
    const [fase, setFase] = useState('SETUP');
    const [puntuacion, setPuntuacion] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [fallos, setFallos] = useState(0);
    const [nombreInvitado, setNombreInvitado] = useState('');
    const [guardando, setGuardando] = useState(false);
    const esInvitado = !usuario || !usuario.email;
    const esPro = recurso?.tipo === 'PRO';

    const playSound = (type) => {
        if (type === 'START') safePlay(audioStart);
        else if (type === 'WIN') safePlay(audioWin);
        else if (type === 'CORRECT') safePlay(audioCorrect);
        else if (type === 'WRONG') safePlay(audioWrong);
    };

    const incrementarPlayCount = async () => { if (recurso.id) try { await updateDoc(doc(db, 'resources', recurso.id), { playCount: increment(1) }); } catch (e) { } };

    const guardarRanking = async () => {
        if (guardando) return; setGuardando(true);
        try {
            const nombre = esInvitado ? (nombreInvitado || "Invitado") : usuario.displayName;
            const email = esInvitado ? 'invitado' : usuario.email;
            await addDoc(collection(db, 'ranking'), { recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'THINKHOOT', email, jugador: nombre, aciertos: puntuacion, fecha: new Date() });
            alTerminar();
        } catch (e) { alert("Error guardando"); }
        setGuardando(false);
    };

    if (fase === 'SETUP') return <PantallaSetup recurso={recurso} esPro={esPro} esInvitado={esInvitado} nombreInvitado={nombreInvitado} setNombreInvitado={setNombreInvitado} onStart={() => setFase('COUNTDOWN')} onExit={alTerminar} />;
    if (fase === 'COUNTDOWN') return <PantallaCuentaAtras playSound={playSound} onFinished={() => { incrementarPlayCount(); setFase('JUEGO'); }} />;
    if (fase === 'FIN') return <PantallaFin puntuacion={puntuacion} aciertos={aciertos} fallos={fallos} recurso={recurso} guardarRanking={guardarRanking} guardando={guardando} esInvitado={esInvitado} alTerminar={alTerminar} playSound={playSound} />;

    return (
        <EngineLocal
            recurso={recurso}
            esPro={esPro}
            setPuntuacionTotal={setPuntuacion}
            puntuacionActual={puntuacion}
            onResultadoPregunta={(ok) => { if (ok) setAciertos(a => a + 1); else setFallos(f => f + 1); }}
            onFinish={() => setFase('FIN')}
            onExit={alTerminar}
            playSound={playSound}
        />
    );
}

// --- ENGINE LOCAL ---
function EngineLocal({ recurso, esPro, setPuntuacionTotal, puntuacionActual, onResultadoPregunta, onFinish, onExit, playSound }) {
    const [indice, setIndice] = useState(0);
    const [preguntas, setPreguntas] = useState([]);
    const [tiempoRestante, setTiempoRestante] = useState(0);
    const [pausa, setPausa] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [subFase, setSubFase] = useState('RESPONDING'); // RESPONDING | REVEAL
    const [revealInfo, setRevealInfo] = useState(null);    // { ok, correctText, esPresentacion }
    const timerRef = useRef(null);
    const tiempoRef = useRef(0);
    const revealTimeoutRef = useRef(null);
    const preguntasRef = useRef([]);
    const indiceRef = useRef(0);
    const pausaRef = useRef(false);

    useEffect(() => {
        let pool = recurso.preguntas ? [...recurso.preguntas] : [];
        if (pool.length === 0 && recurso.hojas) recurso.hojas.forEach(h => { if (h.preguntas) pool.push(...h.preguntas); });
        // En modo solo los dibujos no se pueden evaluar → se descartan
        pool = pool.filter(p => p && p.tipo !== 'DIBUJO');
        preguntasRef.current = pool;
        setPreguntas(pool);
        if (pool.length > 0) cargarPregunta(0, pool); else onFinish();
        return () => { clearInterval(timerRef.current); clearTimeout(revealTimeoutRef.current); };
    }, []);

    const avanzar = () => {
        const list = preguntasRef.current; const idx = indiceRef.current;
        if (idx + 1 < list.length) cargarPregunta(idx + 1, list); else onFinish();
    };

    const cargarPregunta = (idx, list) => {
        const p = list[idx]; if (!p) { onFinish(); return; }
        indiceRef.current = idx; pausaRef.current = false;
        setIndice(idx); setFeedback(null); setPausa(false); setSubFase('RESPONDING'); setRevealInfo(null);
        if (timerRef.current) clearInterval(timerRef.current);
        if (p.tipo === 'MUSICAL') { setTiempoRestante(0); return; } // gestionado por MusicalQuestionLocal
        const tGlobal = parseInt(recurso.config?.tiempoPregunta) || 20;
        const t = esPro ? (parseInt(p.tiempo) || tGlobal) : tGlobal;
        tiempoRef.current = t;
        setTiempoRestante(t);
        timerRef.current = setInterval(() => {
            tiempoRef.current -= 1;
            if (tiempoRef.current <= 0) {
                clearInterval(timerRef.current);
                setTiempoRestante(0);
                gestionarRespuesta(false);
            } else {
                setTiempoRestante(tiempoRef.current);
            }
        }, 1000);
    };

    const gestionarRespuesta = (ok) => {
        if (pausaRef.current) return; pausaRef.current = true; setPausa(true); clearInterval(timerRef.current);
        const list = preguntasRef.current; const idx = indiceRef.current;
        const p = list[idx]; if (!p) return;
        const esPresentacion = p.tipo === 'PRESENTATION';
        const ptsWin = esPro ? (parseInt(p.puntosMax) || 100) : (parseInt(recurso.config?.puntosAcierto) || 10);
        const ptsLose = esPro ? (parseInt(p.puntosMin) || 0) : (parseInt(recurso.config?.puntosFallo) || 2);
        if (!esPresentacion) {
            if (ok) { playSound('CORRECT'); setFeedback('correct'); setPuntuacionTotal(v => v + ptsWin); onResultadoPregunta?.(true); }
            else { playSound('WRONG'); setFeedback('incorrect'); setPuntuacionTotal(v => Math.max(0, v - ptsLose)); onResultadoPregunta?.(false); }
        }
        // Fase de revelado: mostramos cuál era la respuesta correcta
        setRevealInfo({ ok, correctText: getCorrectAnswerText(p), esPresentacion });
        setSubFase('REVEAL');
        revealTimeoutRef.current = setTimeout(() => avanzar(), 3000);
    };

    const p = preguntas[indice]; if (!p) return <div>Cargando...</div>;

    if (p.tipo === 'MUSICAL') {
        return (
            <div className="game-container"><EstilosComunes /><EstilosThinkHoot />
                <div className="game-area">
                    <div className="top-hud">
                        <button className="btn-exit" onClick={onExit}>Salir</button>
                        <div className="q-counter">{indice + 1} / {preguntas.length}</div>
                        <div className="score-badge">{puntuacionActual} pts</div>
                    </div>
                    <MusicalQuestionLocal
                        key={indice}
                        pregunta={p}
                        recurso={recurso}
                        playSound={playSound}
                        onResultadoBlanco={(ok) => onResultadoPregunta?.(ok)}
                        onSumarPuntos={(pts) => setPuntuacionTotal(v => Math.max(0, v + pts))}
                        onFinishQuestion={avanzar}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="game-container"><EstilosComunes /><EstilosThinkHoot />
            <div className="game-area">
                <div className="top-hud">
                    <button className="btn-exit" onClick={onExit}>Salir</button>
                    <div className="q-counter">{indice + 1} / {preguntas.length}</div>
                    <div className="timer-badge">{subFase === 'REVEAL' ? '—' : `${tiempoRestante}s`}</div>
                    <div className="score-badge">{puntuacionActual} pts</div>
                </div>
                {subFase === 'REVEAL' && revealInfo ? (
                    <div className="question-card" style={{ textAlign: 'center' }}>
                        {!revealInfo.esPresentacion && (
                            <>
                                <div style={{ fontSize: '3rem' }}>{revealInfo.ok ? '✅' : '❌'}</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: 14, color: revealInfo.ok ? '#2ecc71' : '#e74c3c' }}>
                                    {revealInfo.ok ? '¡Correcto!' : 'Incorrecto'}
                                </div>
                            </>
                        )}
                        {revealInfo.correctText && (
                            <>
                                <div style={{ color: '#ccc', fontSize: '0.95rem' }}>La respuesta correcta era:</div>
                                <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: '#f1c40f', marginTop: 8 }}>{parseText(revealInfo.correctText)}</div>
                            </>
                        )}
                        {revealInfo.esPresentacion && !revealInfo.correctText && (
                            <div style={{ color: '#ccc', fontSize: '1.1rem' }}>Continuando...</div>
                        )}
                    </div>
                ) : (
                    <QuestionDisplay data={p} onAnswer={gestionarRespuesta} disabled={pausa} feedback={feedback} />
                )}
            </div>
        </div>
    );
}

// --- PREGUNTA MUSICAL EN SOLITARIO (con vídeo de YouTube real) ---
function MusicalQuestionLocal({ pregunta, recurso, playSound, onResultadoBlanco, onSumarPuntos, onFinishQuestion }) {
    const [fase, setFase] = useState('WATCHING'); // WATCHING | RESPONDING | REVEAL
    const [blancoActual, setBlancoActual] = useState(0);
    const [tiempoRestante, setTiempoRestante] = useState(0);
    const [respuestaOk, setRespuestaOk] = useState(null);
    const ytPlayerRef = useRef(null);
    const ytReadyRef = useRef(false);
    const watchIntervalRef = useRef(null);
    const timerRef = useRef(null);
    const tiempoRef = useRef(0);
    const respondidoRef = useRef(false);

    const numBlancos = Math.max(1, pregunta.blancos?.length || 1);
    const tiempoTotal = parseInt(pregunta.tiempo || recurso.config?.tiempoPregunta) || 20;

    // Crear el reproductor de YouTube una vez por pregunta
    useEffect(() => {
        const videoId = pregunta.videoId;
        if (!videoId) { onFinishQuestion(); return; }

        let cancelled = false;
        let initTimeoutId = null;

        const createPlayer = () => {
            if (cancelled) return;
            const div = document.getElementById('yt-solo-player');
            if (!div) return;
            ytPlayerRef.current = new window.YT.Player('yt-solo-player', {
                videoId,
                height: '100%',
                width: '100%',
                playerVars: { autoplay: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
                events: {
                    onReady: (e) => { if (cancelled) return; ytReadyRef.current = true; e.target.playVideo(); },
                }
            });
        };

        if (window.YT && window.YT.Player) {
            initTimeoutId = setTimeout(createPlayer, 100);
        } else {
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
            }
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { if (prev) prev(); initTimeoutId = setTimeout(createPlayer, 100); };
        }

        return () => {
            cancelled = true;
            if (initTimeoutId) clearTimeout(initTimeoutId);
            clearInterval(watchIntervalRef.current); clearInterval(timerRef.current);
            if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch (e) { } ytPlayerRef.current = null; }
            ytReadyRef.current = false;
        };
    }, []);

    const iniciarRespuesta = () => {
        respondidoRef.current = false;
        setFase('RESPONDING');
        tiempoRef.current = tiempoTotal;
        setTiempoRestante(tiempoTotal);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            tiempoRef.current -= 1;
            if (tiempoRef.current <= 0) {
                clearInterval(timerRef.current);
                setTiempoRestante(0);
                responder(false);
            } else {
                setTiempoRestante(tiempoRef.current);
            }
        }, 1000);
    };

    // Auto-pausa el vídeo al llegar al timestamp del blanco actual
    useEffect(() => {
        if (fase !== 'WATCHING') { clearInterval(watchIntervalRef.current); return; }
        const blanco = pregunta.blancos?.[blancoActual];
        if (!blanco) { onFinishQuestion(); return; }
        if (!blanco.timestamp || blanco.timestamp <= 0) { iniciarRespuesta(); return; }

        watchIntervalRef.current = setInterval(() => {
            if (!ytPlayerRef.current || !ytReadyRef.current) return;
            try {
                const t = ytPlayerRef.current.getCurrentTime();
                if (t >= blanco.timestamp) {
                    clearInterval(watchIntervalRef.current);
                    ytPlayerRef.current.pauseVideo();
                    iniciarRespuesta();
                }
            } catch (e) { }
        }, 300);
        return () => clearInterval(watchIntervalRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, blancoActual]);

    const responder = (ok) => {
        if (respondidoRef.current) return;
        respondidoRef.current = true;
        clearInterval(timerRef.current);
        playSound(ok ? 'CORRECT' : 'WRONG');
        setRespuestaOk(ok);
        const max = Math.round((parseInt(pregunta.puntosMax) || 100) / numBlancos);
        const min = Math.round((parseInt(pregunta.puntosMin) || 0) / numBlancos);
        if (ok) onSumarPuntos(max); else onSumarPuntos(-min);
        onResultadoBlanco(ok);
        setFase('REVEAL');
        setTimeout(() => {
            const next = blancoActual + 1;
            if (next < numBlancos) {
                setBlancoActual(next);
                setFase('WATCHING');
                if (ytPlayerRef.current) { try { ytPlayerRef.current.playVideo(); } catch (e) { } }
            } else {
                onFinishQuestion();
            }
        }, 2500);
    };

    const blanco = pregunta.blancos?.[blancoActual];

    return (
        <div className="question-card" style={{ width: '90%', maxWidth: 600 }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden', display: fase === 'WATCHING' ? 'block' : 'none' }}>
                <div id="yt-solo-player" style={{ width: '100%', height: '100%' }} />
            </div>
            {fase === 'WATCHING' && <div style={{ textAlign: 'center', color: '#bb8fce', marginTop: 12, fontWeight: 'bold' }}>🎵 Escucha la canción...</div>}
            {fase === 'RESPONDING' && (
                <>
                    <div style={{ textAlign: 'center', color: '#f1c40f', fontWeight: 'bold', marginBottom: 8 }}>⏱ {tiempoRestante}s</div>
                    <QuestionDisplay data={pregunta} onAnswer={responder} disabled={respondidoRef.current} feedback={null} blancoActual={blancoActual} />
                </>
            )}
            {fase === 'REVEAL' && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: '2.5rem' }}>{respuestaOk ? '✅' : '❌'}</div>
                    <div style={{ color: '#ccc', marginTop: 8 }}>La palabra era:</div>
                    <div style={{ color: '#f1c40f', fontSize: '1.5rem', fontWeight: 'bold' }}>{blanco?.palabra}</div>
                </div>
            )}
        </div>
    );
}

// --- VISUALIZADOR DE PREGUNTA (copia de ThinkHootGame.jsx) ---
const QuestionDisplay = memo(function QuestionDisplay({ data, onAnswer, disabled, feedback, isHostView, showAnswer, blancoActual }) {
    const [orden, setOrden] = useState([]);
    const [texto, setTexto] = useState('');
    const [slots, setSlots] = useState([]);
    const [opcionesMezcladas, setOpcionesMezcladas] = useState([]);
    useEffect(() => {
        if (data.tipo === 'ORDENAR' && data.bloques) {
            if (isHostView) {
                setOrden(data.bloques);
            } else {
                let mezclado = [...data.bloques];
                for (let i = mezclado.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [mezclado[i], mezclado[j]] = [mezclado[j], mezclado[i]];
                }
                if (mezclado.length > 1 && JSON.stringify(mezclado) === JSON.stringify(data.bloques)) {
                    [mezclado[0], mezclado[1]] = [mezclado[1], mezclado[0]];
                }
                setOrden(mezclado);
                setSlots(new Array(data.bloques.length).fill(null));
            }
        }

        const rawOptions = data.opcionesFijas || [data.respuesta || data.correcta, ...(data.incorrectas || [])];
        const validOptions = rawOptions.filter(opt => opt && String(opt).trim() !== "");
        let opcionesM = [...validOptions];
        for (let i = opcionesM.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opcionesM[i], opcionesM[j]] = [opcionesM[j], opcionesM[i]];
        }
        setOpcionesMezcladas(opcionesM);
        setTexto('');
    }, [data.q, data.pregunta, data.tipo, isHostView]);

    const responderSimple = (op) => {
        if (!isHostView) {
            const correctStr = data.correcta || data.respuesta || data.a;
            onAnswer(clean(op) === clean(correctStr));
        }
    };

    const addToSlot = (block, i) => { if (isHostView || disabled) return; const firstEmpty = slots.findIndex(s => s === null); if (firstEmpty !== -1) { const n = [...slots]; n[firstEmpty] = block; setSlots(n); } };
    const removeFromSlot = (i) => { if (isHostView || disabled) return; const n = [...slots]; n[i] = null; setSlots(n); };
    const confirmarOrden = () => { if (slots.some(s => s === null)) return; onAnswer(JSON.stringify(slots) === JSON.stringify(data.bloques)); };
    const responderCompletar = () => { if (!isHostView) onAnswer(clean(texto) === clean(data.bloques?.[1])); };

    const isOrdenar = data.tipo === 'ORDENAR';
    const isRellenar = data.tipo === 'RELLENAR';
    const isPresentation = data.tipo === 'PRESENTATION';
    const validIncorrectas = data.incorrectas ? data.incorrectas.filter(opt => opt && String(opt).trim() !== "") : [];
    const hasOptions = (data.opcionesFijas && data.opcionesFijas.length > 0) || (validIncorrectas.length > 0);
    const isMultiple = hasOptions && !isOrdenar && !isRellenar;
    const isShortAnswer = !isMultiple && !isOrdenar && !isRellenar && !isPresentation && data.tipo !== 'DIBUJO' && data.tipo !== 'MUSICAL';

    if (data.tipo === 'MUSICAL') {
        const blanco = data.blancos?.[blancoActual || 0];
        const contextLines = (() => {
            if (!data.letra || !blanco) return [];
            const lines = data.letra.split('\n');
            let charPos = 0;
            for (let i = 0; i < lines.length; i++) {
                if (blanco.letraIdx >= charPos && blanco.letraIdx < charPos + lines[i].length + 1) {
                    const blank = lines[i].substring(0, blanco.letraIdx - charPos) + '____' + lines[i].substring(blanco.letraIdx - charPos + blanco.palabra.length);
                    return [i > 0 ? lines[i - 1] : null, blank, i < lines.length - 1 ? lines[i + 1] : null].filter(Boolean);
                }
                charPos += lines[i].length + 1;
            }
            return [];
        })();

        return (
            <div className="question-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#bb8fce', fontWeight: 'bold', fontSize: '1rem', marginBottom: '10px' }}>🎵 Completa la palabra</div>
                {contextLines.length > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '14px', lineHeight: '2', fontStyle: 'italic', fontSize: '1rem' }}>
                        {contextLines.map((line, i) => (
                            <div key={i} style={{ color: line === contextLines[Math.floor(contextLines.length / 2)] ? 'white' : '#aaa', fontWeight: line === contextLines[Math.floor(contextLines.length / 2)] ? 'bold' : 'normal' }}>
                                {line}
                            </div>
                        ))}
                    </div>
                )}
                {!isHostView && (
                    <div className="completar-wrapper">
                        <input
                            value={texto}
                            onChange={e => setTexto(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') onAnswer(clean(texto) === clean(blanco?.palabra || '')); }}
                            className="input-hueco-amarillo"
                            placeholder="Escribe la palabra..."
                            disabled={disabled}
                            autoFocus
                        />
                        <button className="btn-confirmar-amarillo" onClick={() => onAnswer(clean(texto) === clean(blanco?.palabra || ''))} disabled={disabled}>ENVIAR</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="question-card">
            <h2>{parseText(data.q || data.pregunta)}</h2>
            {data.imagenUrl && <img src={data.imagenUrl} className="question-img-small" alt="" />}

            {isOrdenar && !isHostView && (
                <div className="sort-wrapper">
                    <div className="target-slots">
                        {slots.map((s, i) => (
                            <div key={i} className="slot-box" onClick={() => removeFromSlot(i)}>
                                {s ? <span className="slot-content">{parseText(s)}</span> : <span className="slot-num">{i + 1}</span>}
                            </div>
                        ))}
                    </div>
                    <div className="source-blocks">
                        {orden.map((bloque, i) => (
                            <button key={i} className="block-chip" onClick={() => addToSlot(bloque, i)} disabled={slots.includes(bloque) || disabled}
                                style={{ opacity: slots.includes(bloque) ? 0 : 1, pointerEvents: slots.includes(bloque) ? 'none' : 'auto' }}>
                                {parseText(bloque)}
                            </button>
                        ))}
                    </div>
                    <button className="btn-confirmar-amarillo" onClick={confirmarOrden} disabled={disabled || slots.includes(null)}>ENVIAR</button>
                </div>
            )}

            {isRellenar && (
                <div className="completar-wrapper">
                    <div className="completar-box">
                        <div className="bloque-azul">{parseText(data.bloques?.[0])}</div>
                        <input value={texto} onChange={e => setTexto(e.target.value)} className="input-hueco-amarillo" disabled={disabled} />
                        <div className="bloque-azul">{parseText(data.bloques?.[2])}</div>
                    </div>
                    <button className="btn-confirmar-amarillo" onClick={responderCompletar} disabled={disabled}>ENVIAR</button>
                </div>
            )}

            {isShortAnswer && (
                <div className="short-answer-ruleta">
                    <input placeholder="Escribe tu respuesta..." value={texto} onChange={e => setTexto(e.target.value)} disabled={disabled} onKeyDown={(e) => { if (e.key === 'Enter') onAnswer(clean(texto) === clean(data.a || data.respuesta)); }} />
                    <button onClick={() => onAnswer(clean(texto) === clean(data.a || data.respuesta))} disabled={disabled}>ENVIAR</button>
                </div>
            )}

            {data.tipo === 'DIBUJO' && (
                <DrawingPad onSend={(isCorrect, base64) => onAnswer(isCorrect, base64)} disabled={disabled} />
            )}

            {isMultiple && (
                <div className="options-grid">
                    {opcionesMezcladas.map((op, k) => (
                        <button key={k} className={`btn-option ${feedback === 'correct' && clean(op) === clean(data.respuesta || data.correcta || data.a) ? 'correct' : ''} ${feedback === 'incorrect' ? 'dimmed' : ''}`} onClick={() => responderSimple(op)} disabled={disabled}>{parseText(op)}</button>
                    ))}
                </div>
            )}

            {feedback && <div className={`feedback-overlay ${feedback}`}>{feedback === 'correct' ? '¡BIEN!' : '¡MAL!'}</div>}
        </div>
    );
});

// --- PIZARRA DE DIBUJO (copia de ThinkHootGame.jsx) ---
function DrawingPad({ onSend, disabled }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#2c3e50');

    useEffect(() => {
        const preventScroll = (e) => e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            canvas.addEventListener('touchmove', preventScroll, { passive: false });
            return () => canvas.removeEventListener('touchmove', preventScroll);
        }
    }, []);

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e) => {
        if (disabled) return;
        setIsDrawing(true);
        const pos = getPos(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawing || disabled) return;
        const pos = getPos(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.strokeStyle = color === 'ERASER' ? '#ffffff' : color;
        ctx.lineWidth = color === 'ERASER' ? 20 : 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDraw = () => setIsDrawing(false);

    const handleSend = () => {
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.4);
        onSend(true, base64);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', marginTop: '20px' }}>
            <canvas
                ref={canvasRef}
                width={300}
                height={250}
                style={{ background: 'white', border: '3px solid #bdc3c7', borderRadius: '15px', touchAction: 'none' }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
            {!disabled && (
                <div style={{ display: 'flex', gap: '10px' }}>
                    {['#2c3e50', '#e74c3c', '#3498db', '#2ecc71', 'ERASER'].map(c => (
                        <button key={c} onClick={() => setColor(c)} style={{ width: 45, height: 45, borderRadius: '50%', background: c === 'ERASER' ? '#ecf0f1' : c, border: color === c ? '4px solid #f1c40f' : '2px solid transparent', fontSize: '1.2rem', cursor: 'pointer' }}>
                            {c === 'ERASER' ? '🧹' : ''}
                        </button>
                    ))}
                </div>
            )}
            {!disabled && <button className="btn-confirmar-amarillo" onClick={handleSend} style={{ marginTop: '10px' }}>ENVIAR DIBUJO</button>}
        </div>
    );
}

// --- PANTALLAS ---
function PantallaSetup({ recurso, esPro, esInvitado, nombreInvitado, setNombreInvitado, onStart, onExit }) {
    return (
        <div className="card-menu">
            <h1>PiLive Solo</h1>
            <h2>{recurso.titulo}</h2>
            <p style={{ color: '#ccc' }}>Modo: {esPro ? '🔥 PRO' : 'Estándar'}</p>
            {esInvitado && (
                <div style={{ marginBottom: 20 }}>
                    <input value={nombreInvitado} onChange={e => setNombreInvitado(e.target.value)} placeholder="Tu nombre..." style={{ padding: 10, width: '80%', borderRadius: 5, textAlign: 'center' }} />
                </div>
            )}
            <button className="btn-success" onClick={() => { if (esInvitado && !nombreInvitado) return alert("Nombre requerido"); onStart(); }}>JUGAR</button>
            <button className="btn-back" onClick={onExit}>Volver</button>
            <EstilosComunes />
        </div>
    );
}

function PantallaCuentaAtras({ playSound, onFinished }) {
    const [paso, setPaso] = useState(0); const [txt, setTxt] = useState('π');
    useEffect(() => {
        if (playSound) playSound('START');
        const seq = async () => {
            setTxt("π"); setPaso(0); await new Promise(r => setTimeout(r, 1000));
            setTxt("K"); setPaso(1); await new Promise(r => setTimeout(r, 1000));
            setTxt("T"); setPaso(2); await new Promise(r => setTimeout(r, 1000));
            setTxt("¡YA!"); setPaso(3); await new Promise(r => setTimeout(r, 1000));
            onFinished();
        };
        seq();
    }, []);
    return (
        <div className="fullscreen-overlay">
            <div className={`countdown-text step-${paso}`}>{txt}</div>
            <style>{`.fullscreen-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,#2c3e50,#000);display:flex;justify-content:center;align-items:center;z-index:9999}.countdown-text{font-size:10rem;font-weight:bold;color:white;animation:zoomIn 0.5s}.step-0{color:#3498db}.step-1{color:#e74c3c}.step-2{color:#f1c40f}.step-3{color:#2ecc71;transform:scale(1.2)}@keyframes zoomIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        </div>
    );
}

function PantallaFin({ puntuacion, aciertos = 0, fallos = 0, recurso, guardarRanking, guardando, esInvitado, alTerminar, playSound }) {
    const [mostrarEnvio, setMostrarEnvio] = useState(true);
    useEffect(() => { if (playSound) playSound('WIN'); confetti(); }, []);
    return (
        <div className="card-menu">
            <h1>¡Juego Terminado!</h1>
            <h2 style={{ color: '#f1c40f', fontSize: '4rem' }}>{puntuacion} pts</h2>
            <p style={{ color: '#ccc', margin: '0 0 15px 0' }}>✓ {aciertos} &nbsp;·&nbsp; ✗ {fallos}</p>
            {esInvitado ? (
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 10, margin: '20px 0' }}>
                    <p style={{ color: 'white' }}>¡Regístrate para guardar récords!</p>
                    <button className="btn-back" onClick={alTerminar}>Salir</button>
                </div>
            ) : (
                <button className="btn-success" onClick={guardarRanking} disabled={guardando}>{guardando ? 'Guardando...' : '💾 Guardar'}</button>
            )}
            <button className="btn-success" style={{ background: '#3498db' }} onClick={() => setMostrarEnvio(true)}>📤 Enviar al profesor</button>
            {!esInvitado && <button className="btn-back" onClick={alTerminar}>Salir</button>}
            <EstilosComunes />
            {mostrarEnvio && (
                <ModalEnviarProfePiLive
                    datos={{ recursoId: recurso?.id || '', recursoTitulo: recurso?.titulo || 'PiLive', hoja: recurso?.hojaNombreSeleccionada || '', puntos: puntuacion, aciertos, fallos }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}

function ModalEnviarProfePiLive({ datos, onClose }) {
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
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const total = datos.aciertos + datos.fallos;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'THINKHOOT',
                modalidad: 'Individual',
                fecha: new Date(),
                recursoId: datos.recursoId,
                recursoTitulo: datos.recursoTitulo,
                hoja: datos.hoja,
                codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(),
                    curso: curso.trim(),
                    puntos: datos.puntos,
                    aciertos: datos.aciertos,
                    fallos: datos.fallos,
                    precision: total > 0 ? Math.round((datos.aciertos / total) * 100) : 0,
                }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{datos.puntos} pts · {datos.aciertos}✓ {datos.fallos}✗</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', color: '#ddd' }}>
                            <div><b style={{ color: '#f1c40f' }}>{datos.puntos} pts</b> &nbsp;·&nbsp; <span style={{ color: '#2ecc71' }}>{datos.aciertos} ✓</span> &nbsp; <span style={{ color: '#e74c3c' }}>{datos.fallos} ✗</span></div>
                            {datos.hoja && <div style={{ marginTop: 4, color: '#aaa' }}>📄 {datos.hoja}</div>}
                        </div>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellido</label>
                            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
                            <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º Primaria A" style={inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
                            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const EstilosComunes = () => (<style>{` @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Roboto:wght@400;700&display=swap'); .card-menu { background: rgba(0,0,0,0.85); padding: 40px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; color: white; font-family: 'Roboto', sans-serif; box-shadow: 0 20px 50px rgba(0,0,0,0.5); margin: 50px auto; } .btn-success { width: 100%; padding: 15px; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; color: #fff; background: #2ecc71; margin-bottom: 10px; font-size: 1.2rem; } .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; } `}</style>);

const EstilosThinkHoot = () => (
    <style>{`
        .game-container { width: 100vw; height: 100vh; background: #2c3e50; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; position: relative; font-family: 'Roboto', sans-serif; }
        .game-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; position: relative; padding-top: 60px; box-sizing: border-box; }
        .top-hud { position: absolute; top: 0; left: 0; right: 0; height: 60px; background: #34495e; box-shadow: 0 2px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; box-sizing: border-box; z-index: 50; }
        .btn-exit { background: rgba(255,255,255,0.15); border: none; color: white; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: bold; }
        .timer-badge { background: #f1c40f; color: #2c3e50; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-family: 'Righteous'; }
        .score-badge { background: #3498db; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
        .q-counter { color: white; font-weight: bold; font-family: 'Righteous'; background: rgba(0,0,0,0.2); padding: 6px 14px; border-radius: 14px; }

        .question-card { background: #1a1a1a; padding: 25px; border-radius: 15px; text-align: center; color: white; width: 90%; max-width: 600px; animation: popIn 0.3s; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .question-card h2 { font-size: 1.6rem; margin-bottom: 10px; }

        .sort-wrapper { display: flex; flex-direction: column; gap: 20px; width: 100%; align-items: center; }
        .source-blocks { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .block-chip { padding: 12px 18px; background: #3498db; color: white; border-radius: 8px; border: 2px solid #2980b9; font-weight: bold; box-shadow: 0 3px 0 #2980b9; transition: all 0.2s; font-size: 1rem; cursor: pointer; }
        .block-chip:active { transform: translateY(2px); box-shadow: none; }
        .target-slots { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin: 20px 0; }
        .slot-box { width: 100px; height: 60px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); color: white; font-weight: bold; cursor: pointer; font-size: 1.1rem; }
        .slot-content { background: #27ae60; width: 100%; height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .slot-num { color: #555; font-size: 1.5rem; opacity: 0.5; }

        .completar-wrapper { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; }
        .completar-box { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-size: 1.5rem; color: white; }
        .bloque-azul { background: #3498db; padding: 10px 20px; border-radius: 10px; font-weight: bold; }
        .input-hueco-amarillo { background: #f1c40f; color: #2c3e50; border: none; padding: 10px; border-radius: 10px; font-weight: bold; font-size: 1.5rem; width: 150px; text-align: center; }

        .short-answer-ruleta { display: flex; justify-content: center; gap: 10px; width: 100%; margin-top: 20px; }
        .short-answer-ruleta input { padding: 15px; font-size: 1.5rem; border: 3px solid #f1c40f; border-radius: 10px; width: 60%; text-align: center; font-weight: bold; background: white; color: #2c3e50; }
        .short-answer-ruleta button { padding: 15px 30px; font-size: 1.2rem; background: #2ecc71; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 0 #27ae60; transition: transform 0.1s; }
        .short-answer-ruleta button:active { transform: translateY(4px); box-shadow: none; }

        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; width: 100%; margin-top: 20px; }
        .btn-option { padding: 20px; border: none; border-radius: 15px; font-size: 1.5rem; cursor: pointer; color: white; font-weight: bold; transition: transform 0.1s; box-shadow: 0 5px 0 rgba(0,0,0,0.2); text-transform: uppercase; }
        .btn-option:nth-child(1) { background: #e74c3c; }
        .btn-option:nth-child(2) { background: #3498db; }
        .btn-option:nth-child(3) { background: #f1c40f; }
        .btn-option:nth-child(4) { background: #2ecc71; }
        .btn-option:active { transform: translateY(4px); box-shadow: none; }
        .btn-option.dimmed { opacity: 0.2; transform: scale(0.95); }

        .btn-confirmar-amarillo { background: #f1c40f; color: #2c3e50; padding: 15px 40px; border-radius: 30px; border: none; font-size: 1.2rem; cursor: pointer; font-weight: bold; margin-top: 20px; box-shadow: 0 5px 0 #d4ac0d; transition: transform 0.1s; }
        .btn-confirmar-amarillo:active { transform: translateY(4px); box-shadow: none; }

        .feedback-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 4rem; font-weight: bold; color: white; z-index: 500; pointer-events: none; animation: fadeIn 0.2s; }
        .feedback-overlay.correct { background: rgba(46, 204, 113, 0.85); }
        .feedback-overlay.incorrect { background: rgba(231, 76, 60, 0.85); }

        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 600px) {
            .top-hud { padding: 0 10px; height: 50px; font-size: 0.8rem; }
            .question-card { margin-top: 20px; padding: 15px; width: 95%; }
            .question-card h2 { font-size: 1.2rem; }
            .options-grid { grid-template-columns: 1fr; }
            .btn-option { padding: 15px; font-size: 1rem; }
        }
    `}</style>
);
