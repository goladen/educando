import React, { useState, useRef, useEffect, memo } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, addDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const CHAMPIONS_VIDEO_ID = '04854XqcfCY'; // We Are The Champions (empieza en seg. 37)
const CHAMPIONS_START = 37;

// --- AUDIOS ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import goalSoundFile from './assets/gol-cutmp3.mp3';
import whistleSoundFile from './assets/piarbitro.mp3';

const _mkAudio = src => { let a; return { play() { return (a ??= new Audio(src)).play(); }, reset() { if (a) a.currentTime = 0; } }; };
const audioCorrect = _mkAudio(correctSoundFile);
const audioWrong = _mkAudio(wrongSoundFile);
const audioGoal = _mkAudio(goalSoundFile);
const safePlay = (audioObj) => { audioObj.reset(); audioObj.play().catch(() => { }); };

// Silbato del árbitro: una instancia nueva por pitido para poder solaparlos
const playWhistle = () => { try { const a = new Audio(whistleSoundFile); a.play().catch(() => { }); } catch (e) { } };
// Tres pitidos seguidos (inicio de partido)
const playWhistleTriple = () => { [0, 600, 1200].forEach(d => setTimeout(playWhistle, d)); };

// ============================================================================
// Helpers de preguntas (compartidos con el motor PiLive)
// ============================================================================
const clean = (s) => s ? String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() : "";

const parseText = (text) => {
    if (!text) return "";
    let p = String(text).replace(/\((.*?)\)\^\((.*?)\)/g, '<span>$1<sup>$2</sup></span>');
    p = p.replace(/\((.*?)\)\/\((.*?)\)/g, '<span class="fraction"><span class="numer">$1</span><span class="denom">$2</span></span>');
    return <span dangerouslySetInnerHTML={{ __html: p }} />;
};

const getCorrectAnswerText = (data) => {
    if (!data) return '';
    if (data.tipo === 'ORDENAR') return (data.bloques || []).join('  ');
    if (data.tipo === 'RELLENAR') return data.bloques?.[1] || '';
    return data.respuesta || data.correcta || data.a || '';
};

// Construye y baraja el pool de preguntas de un recurso (THINKHOOT, CAZABURBUJAS o PASAPALABRA).
// Si se pasan hojasSeleccionadas, solo se incluyen esas hojas; al barajar se mezclan entre sí.
function construirPool(recurso, hojasSeleccionadas) {
    if (!recurso) return [];
    let pool = [];
    if (Array.isArray(recurso.preguntas)) pool.push(...recurso.preguntas);
    if (Array.isArray(recurso.hojas)) {
        const usar = (hojasSeleccionadas && hojasSeleccionadas.length)
            ? recurso.hojas.filter(h => hojasSeleccionadas.includes(h.nombreHoja))
            : recurso.hojas;
        usar.forEach(h => { if (Array.isArray(h.preguntas)) pool.push(...h.preguntas); });
    }

    pool = pool
        .filter(p => p && p.tipo !== 'DIBUJO' && p.tipo !== 'MUSICAL' && p.tipo !== 'PRESENTATION')
        .filter(p => p.q || p.pregunta)
        .map(p => {
            const resp = p.respuesta ?? p.correcta ?? p.a ?? '';
            const enun = p.q || p.pregunta || '';
            // En Pasapalabra añadimos la letra como pista si la pregunta no es de opciones
            const tieneOpciones = (p.opcionesFijas?.length > 0) || (p.incorrectas?.length > 0);
            const q = (p.letra && !tieneOpciones && !p.bloques)
                ? `Letra ${String(p.letra).toUpperCase()} · ${enun}`
                : enun;
            return { ...p, q, respuesta: resp, a: p.a ?? resp };
        });

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

// ============================================================================
// VISUALIZADOR DE PREGUNTA (copia adaptada de PiLiveSolo / ThinkHootGame)
// ============================================================================
const QuestionDisplay = memo(function QuestionDisplay({ data, onAnswer, disabled, feedback }) {
    const [orden, setOrden] = useState([]);
    const [texto, setTexto] = useState('');
    const [slots, setSlots] = useState([]);
    const [opcionesMezcladas, setOpcionesMezcladas] = useState([]);

    useEffect(() => {
        if (data.tipo === 'ORDENAR' && data.bloques) {
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

        const rawOptions = data.opcionesFijas || [data.respuesta || data.correcta, ...(data.incorrectas || [])];
        const validOptions = rawOptions.filter(opt => opt && String(opt).trim() !== "");
        let opcionesM = [...validOptions];
        for (let i = opcionesM.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opcionesM[i], opcionesM[j]] = [opcionesM[j], opcionesM[i]];
        }
        setOpcionesMezcladas(opcionesM);
        setTexto('');
    }, [data.q, data.pregunta, data.tipo]);

    const responderSimple = (op) => {
        const correctStr = data.correcta || data.respuesta || data.a;
        onAnswer(clean(op) === clean(correctStr));
    };

    const addToSlot = (block) => { if (disabled) return; const firstEmpty = slots.findIndex(s => s === null); if (firstEmpty !== -1) { const n = [...slots]; n[firstEmpty] = block; setSlots(n); } };
    const removeFromSlot = (i) => { if (disabled) return; const n = [...slots]; n[i] = null; setSlots(n); };
    const confirmarOrden = () => { if (slots.some(s => s === null)) return; onAnswer(JSON.stringify(slots) === JSON.stringify(data.bloques)); };
    const responderCompletar = () => onAnswer(clean(texto) === clean(data.bloques?.[1]));

    const isOrdenar = data.tipo === 'ORDENAR';
    const isRellenar = data.tipo === 'RELLENAR';
    const validIncorrectas = data.incorrectas ? data.incorrectas.filter(opt => opt && String(opt).trim() !== "") : [];
    const hasOptions = (data.opcionesFijas && data.opcionesFijas.length > 0) || (validIncorrectas.length > 0);
    const isMultiple = hasOptions && !isOrdenar && !isRellenar;
    const isShortAnswer = !isMultiple && !isOrdenar && !isRellenar;

    return (
        <div className="question-card">
            <h2>{parseText(data.q || data.pregunta)}</h2>
            {data.imagenUrl && <img src={data.imagenUrl} className="question-img-small" alt="" />}

            {isOrdenar && (
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
                            <button key={i} className="block-chip" onClick={() => addToSlot(bloque)} disabled={slots.includes(bloque) || disabled}
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
                        <input value={texto} onChange={e => setTexto(e.target.value)} className="input-hueco-amarillo" disabled={disabled}
                            onKeyDown={e => { if (e.key === 'Enter') responderCompletar(); }} />
                        <div className="bloque-azul">{parseText(data.bloques?.[2])}</div>
                    </div>
                    <button className="btn-confirmar-amarillo" onClick={responderCompletar} disabled={disabled}>ENVIAR</button>
                </div>
            )}

            {isShortAnswer && (
                <div className="short-answer-ruleta">
                    <input placeholder="Escribe tu respuesta..." value={texto} onChange={e => setTexto(e.target.value)} disabled={disabled} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') onAnswer(clean(texto) === clean(data.a || data.respuesta)); }} />
                    <button onClick={() => onAnswer(clean(texto) === clean(data.a || data.respuesta))} disabled={disabled}>ENVIAR</button>
                </div>
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

const EstilosPregunta = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Roboto:wght@400;700&display=swap');
        .fq-modal-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,0.92); z-index: 200; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 14px; box-sizing: border-box; font-family: 'Roboto', sans-serif; overflow-y: auto; }
        .fq-modal-hud { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; font-weight: 700; color: white; }
        .fq-team-chip { padding: 7px 18px; border-radius: 20px; font-weight: 800; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.4); }

        .question-card { background: #1a1a1a; padding: 22px; border-radius: 15px; text-align: center; color: white; width: 95%; max-width: 560px; animation: popIn 0.3s; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .question-card h2 { font-size: 1.4rem; margin-bottom: 12px; }
        .question-img-small { max-width: 220px; max-height: 150px; border-radius: 10px; margin-bottom: 10px; }

        .sort-wrapper { display: flex; flex-direction: column; gap: 16px; width: 100%; align-items: center; }
        .source-blocks { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .block-chip { padding: 12px 18px; background: #3498db; color: white; border-radius: 8px; border: 2px solid #2980b9; font-weight: bold; box-shadow: 0 3px 0 #2980b9; transition: all 0.2s; font-size: 1rem; cursor: pointer; }
        .block-chip:active { transform: translateY(2px); box-shadow: none; }
        .target-slots { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin: 14px 0; }
        .slot-box { width: 100px; height: 56px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); color: white; font-weight: bold; cursor: pointer; font-size: 1.1rem; }
        .slot-content { background: #27ae60; width: 100%; height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .slot-num { color: #888; font-size: 1.5rem; opacity: 0.5; }

        .completar-wrapper { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; }
        .completar-box { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-size: 1.3rem; color: white; }
        .bloque-azul { background: #3498db; padding: 10px 18px; border-radius: 10px; font-weight: bold; }
        .input-hueco-amarillo { background: #f1c40f; color: #2c3e50; border: none; padding: 10px; border-radius: 10px; font-weight: bold; font-size: 1.3rem; width: 150px; text-align: center; }

        .short-answer-ruleta { display: flex; justify-content: center; gap: 10px; width: 100%; margin-top: 14px; flex-wrap: wrap; }
        .short-answer-ruleta input { padding: 14px; font-size: 1.3rem; border: 3px solid #f1c40f; border-radius: 10px; width: 60%; min-width: 180px; text-align: center; font-weight: bold; background: white; color: #2c3e50; box-sizing: border-box; }
        .short-answer-ruleta button { padding: 14px 26px; font-size: 1.1rem; background: #2ecc71; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 0 #27ae60; }
        .short-answer-ruleta button:active { transform: translateY(4px); box-shadow: none; }

        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; margin-top: 16px; }
        .btn-option { padding: 18px; border: none; border-radius: 15px; font-size: 1.25rem; cursor: pointer; color: white; font-weight: bold; transition: transform 0.1s; box-shadow: 0 5px 0 rgba(0,0,0,0.2); }
        .btn-option:nth-child(1) { background: #e74c3c; }
        .btn-option:nth-child(2) { background: #3498db; }
        .btn-option:nth-child(3) { background: #f1c40f; }
        .btn-option:nth-child(4) { background: #2ecc71; }
        .btn-option:nth-child(5) { background: #9b59b6; }
        .btn-option:nth-child(6) { background: #1abc9c; }
        .btn-option:active { transform: translateY(4px); box-shadow: none; }
        .btn-option.correct { outline: 4px solid #2ecc71; }
        .btn-option.dimmed { opacity: 0.25; transform: scale(0.96); }

        .btn-confirmar-amarillo { background: #f1c40f; color: #2c3e50; padding: 13px 36px; border-radius: 30px; border: none; font-size: 1.1rem; cursor: pointer; font-weight: bold; box-shadow: 0 5px 0 #d4ac0d; }
        .btn-confirmar-amarillo:active { transform: translateY(4px); box-shadow: none; }

        .feedback-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 4rem; font-weight: bold; color: white; z-index: 500; pointer-events: none; animation: fadeIn 0.2s; }
        .feedback-overlay.correct { background: rgba(46, 204, 113, 0.85); }
        .feedback-overlay.incorrect { background: rgba(231, 76, 60, 0.85); }

        @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 600px) {
            .question-card { padding: 14px; }
            .question-card h2 { font-size: 1.15rem; }
            .options-grid { grid-template-columns: 1fr; }
            .btn-option { padding: 13px; font-size: 1rem; }
        }
    `}</style>
);

// ============================================================================
// PANTALLA INICIAL — reglas + elección de recurso
// ============================================================================
function PantallaInicio({ onJugar, onExit }) {
    const [codigo, setCodigo] = useState('');
    const [tema, setTema] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [error, setError] = useState('');
    const [resultados, setResultados] = useState([]);
    const [nombreRojo, setNombreRojo] = useState('');
    const [nombreAzul, setNombreAzul] = useState('');
    const [golesParaGanar, setGolesParaGanar] = useState(3);
    const [vsCPU, setVsCPU] = useState(false);
    const [recursoElegido, setRecursoElegido] = useState(null); // recurso a la espera de elegir hojas
    const [hojasSel, setHojasSel] = useState(new Set());

    const lanzar = (recurso, hojas = null) => onJugar({
        recurso, hojas, vsCPU,
        nombreRojo: nombreRojo.trim() || (vsCPU ? 'Jugador' : 'Equipo Rojo'),
        nombreAzul: vsCPU ? 'Ordenador' : (nombreAzul.trim() || 'Equipo Azul'),
        golesParaGanar
    });

    // Hojas (con preguntas) de un recurso
    const hojasDe = (r) => (r.hojas || []).filter(h => h.preguntas?.length > 0).map(h => h.nombreHoja);

    // Tras elegir recurso: si tiene varias hojas, pedir cuáles; si no, lanzar directo
    const seleccionarRecurso = (r) => {
        const hojas = hojasDe(r);
        if (hojas.length > 1) {
            setRecursoElegido(r);
            setHojasSel(new Set(hojas)); // todas marcadas por defecto
        } else {
            lanzar(r, hojas.length ? hojas : null);
        }
    };

    const toggleHoja = (nombre) => {
        setHojasSel(prev => {
            const n = new Set(prev);
            if (n.has(nombre)) n.delete(nombre); else n.add(nombre);
            return n;
        });
    };

    const tipoLabel = (r) => {
        const tj = r.tipoJuego;
        if (tj === 'CAZABURBUJAS' || tj === 'PIKATRON') return { txt: 'Burbujas', color: '#de896e' };
        if (tj === 'PASAPALABRA') return { txt: 'Pasapalabra', color: '#0A0E45' };
        return { txt: 'PiLive', color: '#9C27B0' };
    };

    const tienePreguntas = (r) => (r.preguntas?.length > 0) || (r.hojas?.some(h => h.preguntas?.length > 0));

    const cargarPorCodigo = async () => {
        const c = codigo.trim().toUpperCase();
        if (!c) { setError('Escribe un código.'); return; }
        setBuscando(true); setError('');
        try {
            const ref = collection(db, 'resources');
            let snap = await getDocs(query(ref, where('accessCode', '==', c)));
            if (snap.empty) snap = await getDocs(query(ref, where('hojasCodes', 'array-contains', c)));
            if (snap.empty) { setError('Código no encontrado.'); setBuscando(false); return; }
            const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
            if (!tienePreguntas(r)) { setError('Ese recurso no tiene preguntas jugables.'); setBuscando(false); return; }
            seleccionarRecurso(r);
        } catch (e) { setError('Error: ' + e.message); }
        setBuscando(false);
    };

    const buscarPorTema = async () => {
        setBuscando(true); setError(''); setResultados([]);
        try {
            const ref = collection(db, 'resources');
            const snap = await getDocs(query(ref, orderBy('fechaCreacion', 'desc'), limit(150)));
            const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            const tiposOk = new Set(['CAZABURBUJAS', 'PASAPALABRA', 'THINKHOOT']);
            const t = clean(tema);
            const res = raw.filter(r => {
                const tj = r.tipoJuego;
                const esVivo = tj === 'THINKHOOT' || (r.tipo === 'PRO' && tj !== 'WORDLE' && tj !== 'MATHLIVE');
                if (!tiposOk.has(tj) && !esVivo) return false;
                if (!tienePreguntas(r)) return false;
                if (t) {
                    const inTit = clean(r.titulo).includes(t);
                    const inHoja = r.hojas?.some(h => clean(h.nombreHoja).includes(t));
                    const inTema = clean(r.temas).includes(t);
                    if (!inTit && !inHoja && !inTema) return false;
                }
                return true;
            }).slice(0, 30);
            setResultados(res);
            if (res.length === 0) setError('Sin resultados. Prueba con el código del profesor.');
        } catch (e) { setError('Error buscando: ' + e.message); }
        setBuscando(false);
    };

    const inp = { padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.95rem', outline: 'none', flex: 1, boxSizing: 'border-box', fontFamily: 'inherit', minWidth: 0 };
    const btn = (bg) => ({ padding: '11px 18px', borderRadius: 10, border: 'none', background: bg, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap' });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(160deg,#0f172a 0%,#15803d 120%)', fontFamily: 'system-ui, sans-serif', padding: '24px 16px', boxSizing: 'border-box' }}>
            {onExit && (
                <button onClick={onExit} style={{ position: 'fixed', top: 14, left: 14, background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>← Volver</button>
            )}
            <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, color: 'white' }}>
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <div style={{ fontSize: '3.5rem' }}>⚽</div>
                    <h1 style={{ margin: '4px 0', fontSize: '2rem', fontWeight: 900 }}>Fútbol Quizz</h1>
                </div>

                {/* Reglas */}
                <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: '18px 20px', lineHeight: 1.6, fontSize: '0.95rem' }}>
                    <div style={{ fontWeight: 800, color: '#f1c40f', marginBottom: 8, fontSize: '1.05rem' }}>📋 Cómo se juega</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                        <li>Antes de tirar hay que <b>responder una pregunta</b> (el primer tiro es libre).</li>
                        <li>Si <b>aciertas</b>, arrastra un jugador y suéltalo para chutar a portería.</li>
                        {vsCPU
                            ? <li><b>1 jugador:</b> si fallas <b>más de 3 preguntas seguidas</b>, el Ordenador marca gol.</li>
                            : <li><b>2 jugadores:</b> si fallas, el turno pasa al otro equipo.</li>}
                        <li>Gana el primero en marcar los goles fijados.</li>
                    </ul>
                    <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: '0.85rem' }}>Admite recursos de tipo <b>PiLive</b>, <b>Burbujas</b> y <b>Pasapalabra</b>.</div>
                </div>

                {/* Modo de juego */}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>🎮 Modo de juego</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[{ k: false, t: '👥 2 Jugadores', d: 'Rojo vs Azul' }, { k: true, t: '🤖 1 Jugador', d: 'vs Ordenador' }].map(o => (
                            <button key={String(o.k)} onClick={() => setVsCPU(o.k)}
                                style={{ flex: 1, padding: '12px', borderRadius: 12, border: vsCPU === o.k ? '2px solid #f1c40f' : '1.5px solid rgba(255,255,255,0.2)', background: vsCPU === o.k ? 'rgba(241,196,15,0.18)' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
                                <div>{o.t}</div>
                                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 500 }}>{o.d}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Equipos y goles para ganar */}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>{vsCPU ? '🙋 Tu nombre' : '👥 Jugadores'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={nombreRojo} onChange={e => setNombreRojo(e.target.value)} maxLength={20} placeholder={vsCPU ? 'Tu nombre' : 'Nombre Equipo Rojo'}
                            style={{ ...inp, borderColor: '#ef4444', flex: 1 }} />
                        {!vsCPU && (
                            <input value={nombreAzul} onChange={e => setNombreAzul(e.target.value)} maxLength={20} placeholder="Nombre Equipo Azul"
                                style={{ ...inp, borderColor: '#3b82f6', flex: 1 }} />
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>🏆 Gana el primero en marcar:</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {[1, 2, 3, 5, 7].map(n => (
                                <button key={n} onClick={() => setGolesParaGanar(n)}
                                    style={{ width: 40, height: 40, borderRadius: 10, border: golesParaGanar === n ? '2px solid #f1c40f' : '1.5px solid rgba(255,255,255,0.2)', background: golesParaGanar === n ? '#f1c40f' : 'rgba(255,255,255,0.08)', color: golesParaGanar === n ? '#1e293b' : 'white', fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>{n}</button>
                            ))}
                        </div>
                        <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>goles</span>
                    </div>
                </div>

                {/* Elegir recurso por código */}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>🎯 Elige un recurso</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" style={{ ...inp, letterSpacing: 1, fontWeight: 700 }}
                            onKeyDown={e => { if (e.key === 'Enter') cargarPorCodigo(); }} />
                        <button onClick={cargarPorCodigo} disabled={buscando} style={btn('#2563eb')}>Cargar</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Buscar por tema o título" style={inp}
                            onKeyDown={e => { if (e.key === 'Enter') buscarPorTema(); }} />
                        <button onClick={buscarPorTema} disabled={buscando} style={btn('#16a34a')}>Buscar</button>
                    </div>
                    {buscando && <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>⏳ Buscando…</div>}
                    {error && <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>⚠ {error}</div>}

                    {resultados.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                            {resultados.map(r => {
                                const tl = tipoLabel(r);
                                return (
                                    <button key={r.id} onClick={() => seleccionarRecurso(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', color: 'white' }}>
                                        <span style={{ ...{ padding: '3px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700 }, background: tl.color }}>{tl.txt}</span>
                                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{r.titulo || 'Sin título'}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>▶</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Jugar sin recurso */}
                <button onClick={() => lanzar(null)} style={{ padding: '15px', borderRadius: 14, border: '2px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', color: 'white', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer' }}>
                    ▶ Jugar sin recurso (libre)
                </button>
            </div>

            {/* Modal: elegir hoja(s) del recurso */}
            {recursoElegido && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, width: '100%', maxWidth: 420, padding: '22px 24px', color: 'white', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📄 Elige las hojas</h3>
                            <button onClick={() => setRecursoElegido(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: 12 }}>{recursoElegido.titulo} — se mezclarán las preguntas de las hojas elegidas.</div>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <button onClick={() => setHojasSel(new Set(hojasDe(recursoElegido)))} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Todas</button>
                            <button onClick={() => setHojasSel(new Set())} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Ninguna</button>
                        </div>

                        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                            {hojasDe(recursoElegido).map(nombre => {
                                const sel = hojasSel.has(nombre);
                                const numP = recursoElegido.hojas.find(h => h.nombreHoja === nombre)?.preguntas?.length || 0;
                                return (
                                    <button key={nombre} onClick={() => toggleHoja(nombre)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: sel ? 'rgba(46,204,113,0.18)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${sel ? '#2ecc71' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: 'white' }}>
                                        <span style={{ fontSize: '1.1rem' }}>{sel ? '☑' : '☐'}</span>
                                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{nombre}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{numP} preg.</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={() => { if (hojasSel.size === 0) return; lanzar(recursoElegido, Array.from(hojasSel)); }}
                            disabled={hojasSel.size === 0}
                            style={{ marginTop: 14, padding: '13px', borderRadius: 12, border: 'none', background: hojasSel.size === 0 ? '#555' : 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: hojasSel.size === 0 ? 'default' : 'pointer' }}>
                            ▶ Empezar partido ({hojasSel.size} {hojasSel.size === 1 ? 'hoja' : 'hojas'})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// JUEGO — campo de fútbol + físicas + preguntas
// ============================================================================
function JuegoFutbol({ config, onExit, onVolverInicio, onFin }) {
    const recurso = config?.recurso || null;
    const vsCPU = !!config?.vsCPU;
    const nombres = { red: config?.nombreRojo || 'Equipo Rojo', blue: config?.nombreAzul || (vsCPU ? 'Ordenador' : 'Equipo Azul') };
    const golesParaGanar = config?.golesParaGanar || 3;

    const width = 800;
    const height = 500;
    const goalHalf = 95; // semialtura de la portería (mayor = portería más grande)
    const goalYTop = height / 2 - goalHalf;
    const goalYBottom = height / 2 + goalHalf;

    const initialPlayers = [
        { id: 'r1', team: 'red', x: 100, y: 250, r: 18, angle: 0, vx: 0, vy: 0 },
        { id: 'r2', team: 'red', x: 250, y: 150, r: 18, angle: 0, vx: 0, vy: 0 },
        { id: 'r3', team: 'red', x: 250, y: 350, r: 18, angle: 0, vx: 0, vy: 0 },
        { id: 'r4', team: 'red', x: 380, y: 250, r: 18, angle: 0, vx: 0, vy: 0 },
        { id: 'b1', team: 'blue', x: 700, y: 250, r: 18, angle: Math.PI, vx: 0, vy: 0 },
        { id: 'b2', team: 'blue', x: 550, y: 150, r: 18, angle: Math.PI, vx: 0, vy: 0 },
        { id: 'b3', team: 'blue', x: 550, y: 350, r: 18, angle: Math.PI, vx: 0, vy: 0 },
        { id: 'b4', team: 'blue', x: 420, y: 250, r: 18, angle: Math.PI, vx: 0, vy: 0 },
    ];

    // Pool de preguntas (mezcla las hojas elegidas)
    const poolRef = useRef(construirPool(recurso, config?.hojas));
    const idxRef = useRef(0);
    const modoConPreguntas = poolRef.current.length > 0;

    const [game, setGame] = useState({
        ball: { x: width / 2, y: height / 2, vx: 0, vy: 0 },
        players: initialPlayers.map(p => ({ ...p })),
        activeTeam: 'red',
        isSimulating: false,
        score: { red: 0, blue: 0 },
        shooterId: null,       // jugador lanzado en el tiro actual (para detectar penalti)
        ballTouched: false,    // si el balón se ha tocado durante el tiro actual
        penaltiActivo: false,  // estamos ejecutando un penalti (campo sin obstáculos)
        pendingPenalti: null,  // equipo al que se le concede un penalti
        golPausa: false,       // acaba de marcarse un gol → transición antes de la pregunta
        message: modoConPreguntas ? `¡${nombres.red}! Primer tiro libre: arrastra para tirar.` : `¡Turno de ${nombres.red}! Arrastra un jugador para apuntar.`
    });

    const [aiming, setAiming] = useState({ isActive: false, playerId: null, currentX: 0, currentY: 0 });

    // Estado de preguntas y estadísticas por equipo
    const [stats, setStats] = useState({ red: { aciertos: 0, fallos: 0 }, blue: { aciertos: 0, fallos: 0 } });
    const statsRef = useRef(stats);
    const [faseTurno, setFaseTurno] = useState('TIRAR'); // PREGUNTA | TIRAR (el primer tiro de cada equipo es libre)
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [modalFase, setModalFase] = useState('RESPONDER'); // RESPONDER | REVEAL
    const [revealInfo, setRevealInfo] = useState(null);
    const [golFlash, setGolFlash] = useState(null);

    const svgRef = useRef(null);
    const revealTimeoutRef = useRef(null);
    const finalizadoRef = useRef(false);
    // El primer tiro de cada equipo es libre (sin pregunta); luego ya hay que responder.
    const primerTiroRef = useRef({ red: false, blue: false });
    // vs Ordenador: racha de fallos seguidos del alumno (a los >3 marca el ordenador)
    const streakRef = useRef(0);
    const [rachaFallos, setRachaFallos] = useState(0);
    // vs Ordenador: control del turno automático de la IA
    const cpuTimeoutRef = useRef(null);
    const cpuPensandoRef = useRef(false);
    // Penalti
    const prePenaltiRef = useRef(null); // posiciones congeladas "antes del penalti"
    const penaltiTimeoutRef = useRef(null);
    const [penaltiBanner, setPenaltiBanner] = useState(false);
    // Transición tras gol (espera antes de mostrar la siguiente pregunta)
    const golQTimeoutRef = useRef(null);

    // Tamaño del campo: rellena todo el área disponible manteniendo proporción (clave en escritorio)
    const fieldAreaRef = useRef(null);
    const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });
    useEffect(() => {
        const el = fieldAreaRef.current;
        if (!el) return;
        const ratio = width / height;
        const recompute = () => {
            const aw = el.clientWidth, ah = el.clientHeight;
            if (!aw || !ah) return;
            let w = aw, h = aw / ratio;
            if (h > ah) { h = ah; w = ah * ratio; }
            setFieldSize({ w: Math.round(w), h: Math.round(h) });
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const playSound = (ok) => safePlay(ok ? audioCorrect : audioWrong);
    const playGoalSound = () => safePlay(audioGoal);

    // Pitido triple del árbitro al comenzar el partido
    useEffect(() => { playWhistleTriple(); }, []);

    const registrarRespuesta = (team, ok) => {
        setStats(prev => {
            const n = { ...prev, [team]: { ...prev[team], [ok ? 'aciertos' : 'fallos']: prev[team][ok ? 'aciertos' : 'fallos'] + 1 } };
            statsRef.current = n;
            return n;
        });
    };

    // Detecta gol (cambio de marcador) → sonido + flash + comprobar victoria
    const prevScoreRef = useRef({ red: 0, blue: 0 });
    useEffect(() => {
        const ps = prevScoreRef.current;
        if (game.score.red !== ps.red || game.score.blue !== ps.blue) {
            const quien = game.score.red > ps.red ? 'red' : 'blue';
            playGoalSound();
            setGolFlash(quien);
            setTimeout(() => setGolFlash(null), 2200);
            prevScoreRef.current = { ...game.score };

            // ¿Victoria?
            const ganador = game.score.red >= golesParaGanar ? 'red' : game.score.blue >= golesParaGanar ? 'blue' : null;
            if (ganador && !finalizadoRef.current) {
                finalizadoRef.current = true;
                const score = { ...game.score };
                const s = statsRef.current;
                setTimeout(() => onFin({
                    ganador, nombres, golesParaGanar, score, vsCPU,
                    stats: {
                        red: { goles: score.red, aciertos: s.red.aciertos, fallos: s.red.fallos },
                        blue: { goles: score.blue, aciertos: s.blue.aciertos, fallos: s.blue.fallos },
                    }
                }), 1600);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.score.red, game.score.blue]);

    // --- Carga de la siguiente pregunta al iniciarse un turno ---
    const cargarSiguientePregunta = () => {
        const pool = poolRef.current;
        if (!pool.length) { setFaseTurno('TIRAR'); return; }
        const idx = idxRef.current % pool.length;
        idxRef.current = idx + 1;
        setPreguntaActual(pool[idx]);
        setFaseTurno('PREGUNTA');
        setModalFase('RESPONDER');
        setRevealInfo(null);
    };

    // --- TURNO DEL ORDENADOR: apunta a portería y dispara (acierta a veces) ---
    const dispararCPU = () => {
        const ball = game.ball;
        const blues = game.players.filter(p => p.team === 'blue');
        if (!blues.length) return;
        // Portería contraria del ordenador = izquierda (x≈8). Punto objetivo con variación → unos entran y otros no.
        const goalY = height / 2 + (Math.random() * 240 - 120);
        const G = { x: 6, y: goalY };
        // Elegir el jugador azul mejor situado (detrás del balón respecto a la portería)
        let best = blues[0], bestSc = -Infinity;
        blues.forEach(p => {
            const bx = ball.x - p.x, by = ball.y - p.y; const bl = Math.hypot(bx, by) || 1;
            const gx = G.x - ball.x, gy = G.y - ball.y; const gl = Math.hypot(gx, gy) || 1;
            const align = (bx / bl) * (gx / gl) + (by / bl) * (gy / gl); // alineación tiro→portería
            const sc = align - bl / 700; // mejor si está alineado y cerca
            if (sc > bestSc) { bestSc = sc; best = p; }
        });
        // Preview de apuntado (línea hacia el balón) para que se vea que "va a portería"
        setAiming({ isActive: true, playerId: best.id, currentX: ball.x, currentY: ball.y });
        setGame(prev => ({ ...prev, message: '🤖 El Ordenador apunta…' }));
        clearTimeout(cpuTimeoutRef.current);
        cpuTimeoutRef.current = setTimeout(() => {
            if (finalizadoRef.current) return;
            setAiming({ isActive: false, playerId: null, currentX: 0, currentY: 0 });
            const dx = ball.x - best.x, dy = ball.y - best.y; const dl = Math.hypot(dx, dy) || 1;
            const speed = 30 + Math.random() * 9; // fuerza del disparo
            const vx = (dx / dl) * speed, vy = (dy / dl) * speed;
            setGame(prev => {
                if (prev.isSimulating) return prev;
                const players = prev.players.map(p => p.id === best.id ? { ...p, vx, vy, angle: Math.atan2(vy, vx) } : p);
                return { ...prev, players, isSimulating: true, shooterId: best.id, ballTouched: false, message: prev.penaltiActivo ? '🤖 ¡Penalti del Ordenador!' : '🤖 ¡El Ordenador dispara!' };
            });
            cpuPensandoRef.current = false; // listo para el siguiente turno azul
        }, 850);
    };

    useEffect(() => {
        if (finalizadoRef.current) return; // partido terminado
        if (game.isSimulating) return;
        if (game.pendingPenalti) return; // mostrando el cartel de penalti, esperar

        const trasGol = game.golPausa;
        if (trasGol) setGame(prev => ({ ...prev, golPausa: false }));

        // Turno automático del ordenador (azul), también para lanzar su penalti
        if (vsCPU && game.activeTeam === 'blue') {
            if (!cpuPensandoRef.current) { cpuPensandoRef.current = true; dispararCPU(); }
            return;
        }
        cpuPensandoRef.current = false;

        // Penalti del jugador humano: se tira sin pregunta
        if (game.penaltiActivo) return;

        // Turno del jugador
        if (!modoConPreguntas) return; // sin recurso: puede tirar libremente
        if (faseTurno === 'TIRAR') return; // ya respondió (o tiro libre), esperando el tiro
        const team = game.activeTeam;
        // Primer tiro de cada equipo: sin pregunta
        if (!primerTiroRef.current[team]) {
            setFaseTurno('TIRAR');
            setPreguntaActual(null);
            setGame(prev => ({ ...prev, message: `¡${nombres[team]}! Primer tiro libre: arrastra para tirar.` }));
            return;
        }
        // Tras un gol, dar una transición antes de mostrar la pregunta
        if (trasGol) {
            setPreguntaActual(null); // ocultar el modal durante la celebración
            clearTimeout(golQTimeoutRef.current);
            golQTimeoutRef.current = setTimeout(() => { if (!finalizadoRef.current) cargarSiguientePregunta(); }, 1800);
            return;
        }
        cargarSiguientePregunta();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.activeTeam, game.isSimulating, game.penaltiActivo]);

    useEffect(() => () => clearTimeout(cpuTimeoutRef.current), []);

    // --- PENALTI: muestra el cartel y monta el campo sin obstáculos ---
    useEffect(() => {
        if (!game.pendingPenalti) return;
        if (finalizadoRef.current) return;
        const team = game.pendingPenalti;
        // Guardar las posiciones "antes del penalti" (para restaurarlas si falla)
        prePenaltiRef.current = { ball: { ...game.ball, vx: 0, vy: 0 }, players: game.players.map(p => ({ ...p, vx: 0, vy: 0 })) };
        playWhistle(); // pitido del árbitro señalando el penalti
        setPenaltiBanner(true);
        clearTimeout(penaltiTimeoutRef.current);
        penaltiTimeoutRef.current = setTimeout(() => {
            setPenaltiBanner(false);
            // Un único jugador del equipo, balón en el centro, sin obstáculos
            const base = initialPlayers.find(p => p.id === (team === 'red' ? 'r4' : 'b4')) || initialPlayers.find(p => p.team === team);
            const taker = { ...base, x: team === 'red' ? width / 2 - 95 : width / 2 + 95, y: height / 2, vx: 0, vy: 0, angle: team === 'red' ? 0 : Math.PI };
            setFaseTurno('TIRAR'); // se tira sin pregunta
            setGame(prev => ({
                ...prev,
                pendingPenalti: null,
                penaltiActivo: true,
                ball: { x: width / 2, y: height / 2, vx: 0, vy: 0 },
                players: [taker],
                activeTeam: team,
                isSimulating: false,
                shooterId: null,
                ballTouched: false,
                message: `⚽ Penalti de ${nombres[team]}. ¡Tira a portería!`
            }));
        }, 1400);
        return () => clearTimeout(penaltiTimeoutRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.pendingPenalti]);

    const responderPregunta = (ok) => {
        if (modalFase !== 'RESPONDER') return;
        const team = game.activeTeam;
        playSound(ok);
        registrarRespuesta(team, ok);
        // Racha de fallos (solo relevante en modo vs Ordenador)
        streakRef.current = ok ? 0 : streakRef.current + 1;
        setRachaFallos(streakRef.current);
        const cpuMarca = vsCPU && !ok && streakRef.current > 3;
        const cpuGana = cpuMarca && (game.score.blue + 1) >= golesParaGanar;
        if (cpuMarca) streakRef.current = 0;
        setRevealInfo({ ok, correctText: getCorrectAnswerText(preguntaActual) });
        setModalFase('REVEAL');
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = setTimeout(() => {
            if (finalizadoRef.current) return;
            if (ok) {
                setRevealInfo(null);
                setModalFase('RESPONDER');
                setFaseTurno('TIRAR');
                setGame(prev => ({ ...prev, message: `¡Correcto! ${nombres[team]}, arrastra para tirar.` }));
                return;
            }
            // FALLO
            if (vsCPU) {
                if (cpuMarca) {
                    setRachaFallos(0);
                    setGame(prev => ({
                        ...prev,
                        score: { ...prev.score, blue: prev.score.blue + 1 },
                        ball: { x: width / 2, y: height / 2, vx: 0, vy: 0 },
                        players: initialPlayers.map(p => ({ ...p })),
                        isSimulating: false,
                        message: '🤖 ¡Fallaste 4 seguidas! El Ordenador marca.'
                    }));
                } else {
                    setGame(prev => ({ ...prev, message: `¡Fallo! (${streakRef.current} de 4 seguidos) Inténtalo otra vez.` }));
                }
                // El alumno mantiene el turno → nueva pregunta (salvo que el ordenador gane el partido)
                setRevealInfo(null);
                setModalFase('RESPONDER');
                if (!cpuGana) cargarSiguientePregunta();
                return;
            }
            // 2 jugadores: falla → pasa el turno (el effect cargará la nueva pregunta)
            setGame(prev => {
                const nt = prev.activeTeam === 'red' ? 'blue' : 'red';
                return { ...prev, activeTeam: nt, message: `¡Fallo! Turno de ${nombres[nt]}.` };
            });
        }, ok ? 1300 : 2700);
    };

    useEffect(() => () => clearTimeout(revealTimeoutRef.current), []);

    // --- Bucle de físicas (idéntico al original) ---
    useEffect(() => {
        let animationFrameId;
        const updatePhysics = () => {
            setGame((prev) => {
                if (!prev.isSimulating && prev.ball.vx === 0 && prev.ball.vy === 0) return prev;

                let newBall = { ...prev.ball };
                let newPlayers = prev.players.map(p => ({ ...p }));
                let newScore = { ...prev.score };
                let newTeam = prev.activeTeam;
                let newMessage = prev.message;
                let isSimulating = prev.isSimulating;
                let isMoving = false;

                newBall.vx *= 0.97; newBall.vy *= 0.97;
                newBall.x += newBall.vx; newBall.y += newBall.vy;
                if (Math.abs(newBall.vx) > 0.1 || Math.abs(newBall.vy) > 0.1) isMoving = true;
                else { newBall.vx = 0; newBall.vy = 0; }

                if (newBall.x <= 15 && newBall.y >= goalYTop && newBall.y <= goalYBottom) {
                    newScore.blue += 1;
                    return { ...prev, score: newScore, activeTeam: 'red', message: vsCPU ? '🤖 ¡El Ordenador marca! Te toca.' : `¡GOOOL de ${nombres.blue}! Turno de ${nombres.red}.`, ball: { x: width / 2, y: height / 2, vx: 0, vy: 0 }, players: initialPlayers.map(p => ({ ...p })), isSimulating: false, shooterId: null, ballTouched: false, penaltiActivo: false, pendingPenalti: null, golPausa: true };
                }
                if (newBall.x >= width - 15 && newBall.y >= goalYTop && newBall.y <= goalYBottom) {
                    newScore.red += 1;
                    return { ...prev, score: newScore, activeTeam: 'blue', message: vsCPU ? '⚽ ¡GOOOL! Ahora dispara el Ordenador.' : `¡GOOOL de ${nombres.red}! Turno de ${nombres.blue}.`, ball: { x: width / 2, y: height / 2, vx: 0, vy: 0 }, players: initialPlayers.map(p => ({ ...p })), isSimulating: false, shooterId: null, ballTouched: false, penaltiActivo: false, pendingPenalti: null, golPausa: true };
                }

                if (newBall.x < 15) { newBall.x = 15; newBall.vx *= -0.7; }
                if (newBall.x > width - 15) { newBall.x = width - 15; newBall.vx *= -0.7; }
                if (newBall.y < 15) { newBall.y = 15; newBall.vy *= -0.7; }
                if (newBall.y > height - 15) { newBall.y = height - 15; newBall.vy *= -0.7; }

                newPlayers.forEach(p => {
                    p.vx *= 0.93; p.vy *= 0.93; p.x += p.vx; p.y += p.vy;
                    if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) { isMoving = true; p.angle = Math.atan2(p.vy, p.vx); }
                    else { p.vx = 0; p.vy = 0; }
                    if (p.x < 25) { p.x = 25; p.vx *= -0.5; }
                    if (p.x > width - 25) { p.x = width - 25; p.vx *= -0.5; }
                    if (p.y < 25) { p.y = 25; p.vy *= -0.5; }
                    if (p.y > height - 25) { p.y = height - 25; p.vy *= -0.5; }
                });

                // Colisión jugador-balón (marca si el balón se ha tocado)
                let ballHit = false;
                newPlayers.forEach(p => {
                    const dx = newBall.x - p.x, dy = newBall.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
                    const minDist = p.r + 17; // radio de choque mayor → evita atascos y "tunneling"
                    if (dist < minDist) {
                        ballHit = true;
                        const overlap = minDist - dist, ax = dx / dist, ay = dy / dist;
                        // Separar el balón en ambos ejes (antes solo en X → se atascaba en esquinas)
                        newBall.x += ax * overlap;
                        newBall.y += ay * overlap;
                        const rvx = newBall.vx - p.vx, rvy = newBall.vy - p.vy;
                        const dot = rvx * ax + rvy * ay;
                        if (dot < 0) { newBall.vx -= 1.5 * dot * ax; newBall.vy -= 1.5 * dot * ay; p.vx += 0.3 * dot * ax; p.vy += 0.3 * dot * ay; }
                    }
                });
                const ballTouchedNow = prev.ballTouched || ballHit;

                // Colisión jugador-jugador (detecta penalti: el tirador toca a un rival sin haber tocado el balón)
                let foulCommitted = false;
                for (let i = 0; i < newPlayers.length; i++) {
                    for (let j = i + 1; j < newPlayers.length; j++) {
                        const p1 = newPlayers[i], p2 = newPlayers[j];
                        const dx = p2.x - p1.x, dy = p2.y - p1.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = p1.r + p2.r;
                        if (dist < minDist) {
                            const overlap = minDist - dist, ax = dx / dist, ay = dy / dist;
                            p1.x -= ax * overlap / 2; p2.x += ax * overlap / 2;
                            const rvx = p2.vx - p1.vx, rvy = p2.vy - p1.vy;
                            const dot = rvx * ax + rvy * ay;
                            if (dot < 0) { p1.vx += dot * ax * 0.7; p1.vy += dot * ay * 0.7; p2.vx -= dot * ax * 0.7; p2.vy -= dot * ay * 0.7; }
                            // ¿Falta? El jugador lanzado choca con un rival y aún no se ha tocado el balón
                            if (!ballTouchedNow && prev.shooterId && !prev.penaltiActivo && p1.team !== p2.team
                                && (p1.id === prev.shooterId || p2.id === prev.shooterId)) {
                                foulCommitted = true;
                            }
                        }
                    }
                }

                // PENALTI: se detiene la jugada y se concede al equipo contrario (el que sufre la falta)
                if (foulCommitted) {
                    return {
                        ...prev,
                        ball: { ...newBall, vx: 0, vy: 0 },
                        players: newPlayers.map(p => ({ ...p, vx: 0, vy: 0 })),
                        isSimulating: false,
                        shooterId: null,
                        ballTouched: false,
                        pendingPenalti: prev.activeTeam === 'red' ? 'blue' : 'red',
                        message: '⚠️ ¡PENALTI!'
                    };
                }

                if (isSimulating && !isMoving) {
                    isSimulating = false;
                    // Penalti fallado (un gol habría salido antes): se restaura "como estaba antes del penalti"
                    if (prev.penaltiActivo) {
                        const snap = prePenaltiRef.current;
                        const restPlayers = snap ? snap.players.map(p => ({ ...p, vx: 0, vy: 0 })) : initialPlayers.map(p => ({ ...p }));
                        const restBall = snap ? { ...snap.ball, vx: 0, vy: 0 } : { x: width / 2, y: height / 2, vx: 0, vy: 0 };
                        return {
                            ...prev, ball: restBall, players: restPlayers, isSimulating: false,
                            penaltiActivo: false, shooterId: null, ballTouched: false, pendingPenalti: null,
                            activeTeam: prev.activeTeam, // mantiene el turno del que tiró el penalti
                            message: (vsCPU && prev.activeTeam === 'blue') ? '🤖 Penalti fallado.' : 'Penalti fallado. Sigue tu turno.'
                        };
                    }
                    newTeam = prev.activeTeam === 'red' ? 'blue' : 'red';
                    newMessage = vsCPU
                        ? (newTeam === 'blue' ? '🤖 Turno del Ordenador' : `¡Tu turno, ${nombres.red}!`)
                        : `¡Turno de ${nombres[newTeam]}!`;
                }

                if (!isMoving && prev.isSimulating === isSimulating && newTeam === prev.activeTeam) return prev;

                return { ...prev, ball: newBall, players: newPlayers, isSimulating, activeTeam: newTeam, message: newMessage, shooterId: isSimulating ? prev.shooterId : null, ballTouched: isSimulating ? ballTouchedNow : false };
            });
            animationFrameId = requestAnimationFrame(updatePhysics);
        };
        animationFrameId = requestAnimationFrame(updatePhysics);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    const getMouseCoords = (e) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: ((clientX - rect.left) / rect.width) * width, y: ((clientY - rect.top) / rect.height) * height };
    };

    const puedeTirar = !modoConPreguntas || faseTurno === 'TIRAR';

    const handleStartAim = (player, e) => {
        if (game.isSimulating || game.activeTeam !== player.team) return;
        if (vsCPU && player.team === 'blue') return; // el ordenador controla el azul
        if (!puedeTirar) return;
        if (e.cancelable) e.preventDefault();
        const coords = getMouseCoords(e);
        setAiming({ isActive: true, playerId: player.id, currentX: coords.x, currentY: coords.y });
    };

    const handleMoveAim = (e) => {
        if (!aiming.isActive) return;
        if (vsCPU && game.activeTeam === 'blue') return; // apuntando el ordenador, ignorar al humano
        if (e.cancelable) e.preventDefault();
        const coords = getMouseCoords(e);
        setAiming(prev => ({ ...prev, currentX: coords.x, currentY: coords.y }));
    };

    const handleEndAim = (e) => {
        if (!aiming.isActive) return;
        if (vsCPU && game.activeTeam === 'blue') return; // disparo gestionado por la IA
        if (e.cancelable) e.preventDefault();
        setGame(prev => {
            const player = prev.players.find(p => p.id === aiming.playerId);
            if (!player) return prev;
            const dx = aiming.currentX - player.x, dy = aiming.currentY - player.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 140;
            if (dist > maxDist) dist = maxDist;
            const forceFactor = 0.22;
            const ax = dist === 0 ? 0 : dx / dist, ay = dist === 0 ? 0 : dy / dist;
            const newVx = ax * dist * forceFactor, newVy = ay * dist * forceFactor;
            const newPlayers = prev.players.map(p => p.id === player.id ? { ...p, vx: newVx, vy: newVy, angle: Math.atan2(newVy, newVx) } : p);
            return { ...prev, players: newPlayers, isSimulating: true, shooterId: player.id, ballTouched: false, message: prev.penaltiActivo ? '⚽ ¡Penalti lanzado!' : '¡Jugada en movimiento...!' };
        });
        // Este equipo ya ha gastado su tiro libre inicial
        primerTiroRef.current[game.activeTeam] = true;
        // Tras tirar, el siguiente turno requerirá pregunta de nuevo
        if (modoConPreguntas) setFaseTurno('PREGUNTA');
        setAiming({ isActive: false, playerId: null, currentX: 0, currentY: 0 });
    };

    const reiniciar = () => {
        setGame({
            ball: { x: width / 2, y: height / 2, vx: 0, vy: 0 },
            players: initialPlayers.map(p => ({ ...p })),
            activeTeam: 'red', isSimulating: false, score: { red: 0, blue: 0 },
            shooterId: null, ballTouched: false, penaltiActivo: false, pendingPenalti: null, golPausa: false,
            message: modoConPreguntas ? `¡${nombres.red}! Responde para poder tirar.` : `Reiniciado. Turno de ${nombres.red}.`
        });
        setAiming({ isActive: false, playerId: null, currentX: 0, currentY: 0 });
        const ceros = { red: { aciertos: 0, fallos: 0 }, blue: { aciertos: 0, fallos: 0 } };
        setStats(ceros); statsRef.current = ceros;
        idxRef.current = 0;
        prevScoreRef.current = { red: 0, blue: 0 };
        finalizadoRef.current = false;
        primerTiroRef.current = { red: false, blue: false };
        streakRef.current = 0; setRachaFallos(0);
        cpuPensandoRef.current = false; clearTimeout(cpuTimeoutRef.current);
        prePenaltiRef.current = null; setPenaltiBanner(false); clearTimeout(penaltiTimeoutRef.current);
        clearTimeout(golQTimeoutRef.current);
        setPreguntaActual(null);
        setFaseTurno('TIRAR'); // el primer tiro vuelve a ser libre
    };

    const aimingPlayer = aiming.isActive ? game.players.find(p => p.id === aiming.playerId) : null;
    let aimTargetX = 0, aimTargetY = 0, aimDistPercent = 0;
    if (aimingPlayer) {
        const dx = aiming.currentX - aimingPlayer.x, dy = aiming.currentY - aimingPlayer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 140;
        const finalDist = dist > maxDist ? maxDist : dist;
        aimDistPercent = finalDist / maxDist;
        const ax = dist === 0 ? 0 : dx / dist, ay = dist === 0 ? 0 : dy / dist;
        aimTargetX = aimingPlayer.x + ax * finalDist;
        aimTargetY = aimingPlayer.y + ay * finalDist;
    }

    const mostrarModal = modoConPreguntas && faseTurno === 'PREGUNTA' && !game.isSimulating && preguntaActual && !game.golPausa && (!vsCPU || game.activeTeam === 'red');
    const teamColor = (t) => t === 'red' ? '#ef4444' : '#3b82f6';
    const teamName = (t) => t === 'red' ? 'Rojo' : 'Azul';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#1e293b', fontFamily: 'system-ui, sans-serif', padding: 'env(safe-area-inset-top, 8px) 8px env(safe-area-inset-bottom, 8px) 8px', boxSizing: 'border-box', userSelect: 'none', touchAction: 'none', overflow: 'hidden' }}>

            {/* Barra superior: volver + marcador con goles y aciertos */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', flexShrink: 0, position: 'relative', marginBottom: '4px' }}>
                <button onClick={onVolverInicio} style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>← Menú</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3.5vw, 30px)', backgroundColor: '#0f172a', padding: '6px clamp(14px, 4.5vw, 36px)', borderRadius: '40px', border: '3px solid #334155', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                    <div style={{ textAlign: 'center', maxWidth: 110 }}>
                        <div style={{ fontSize: 'clamp(9px, 2.4vw, 12px)', color: '#fca5a5', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombres.red}</div>
                        <div style={{ fontSize: 'clamp(24px, 6.5vw, 34px)', fontWeight: 'bold', color: '#ef4444', lineHeight: 1 }}>{game.score.red}</div>
                        {modoConPreguntas && <div style={{ fontSize: 'clamp(8px, 2.2vw, 11px)', color: '#94a3b8', fontWeight: 700 }}>✓{stats.red.aciertos} ✗{stats.red.fallos}</div>}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 'clamp(11px, 2.6vw, 14px)', fontWeight: '700', textAlign: 'center', lineHeight: 1.2 }}>⚽<br /><span style={{ fontSize: '0.7em' }}>a {golesParaGanar}</span></div>
                    <div style={{ textAlign: 'center', maxWidth: 110 }}>
                        <div style={{ fontSize: 'clamp(9px, 2.4vw, 12px)', color: '#93c5fd', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombres.blue}</div>
                        <div style={{ fontSize: 'clamp(24px, 6.5vw, 34px)', fontWeight: 'bold', color: '#3b82f6', lineHeight: 1 }}>{game.score.blue}</div>
                        {modoConPreguntas && (vsCPU
                            ? <div style={{ fontSize: 'clamp(8px, 2.2vw, 11px)', color: '#94a3b8', fontWeight: 700 }}>🤖 racha {rachaFallos}/4</div>
                            : <div style={{ fontSize: 'clamp(8px, 2.2vw, 11px)', color: '#94a3b8', fontWeight: 700 }}>✓{stats.blue.aciertos} ✗{stats.blue.fallos}</div>)}
                    </div>
                </div>
                <button onClick={reiniciar} title="Reiniciar partido" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>↻</button>
            </div>

            {/* Campo */}
            <div ref={fieldAreaRef} style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {/* Indicador de turno (flotante sobre el campo) */}
                <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontSize: 'clamp(10px, 2.8vw, 15px)', fontWeight: 600, color: '#fff', textAlign: 'center', backgroundColor: game.isSimulating ? 'rgba(71,85,105,0.92)' : (game.activeTeam === 'red' ? 'rgba(153,27,27,0.92)' : 'rgba(30,64,175,0.92)'), padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)', transition: 'background-color 0.3s', maxWidth: '92%', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {game.message}
                </div>
                <div style={{ position: 'relative', boxShadow: '0 15px 35px rgba(0,0,0,0.8)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#15803d', border: '4px solid #1e293b', width: fieldSize.w ? `${fieldSize.w}px` : '100%', height: fieldSize.h ? `${fieldSize.h}px` : 'auto', aspectRatio: fieldSize.w ? undefined : `${width} / ${height}`, boxSizing: 'border-box' }}>
                    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: '100%' }}
                        onMouseMove={handleMoveAim} onMouseUp={handleEndAim} onMouseLeave={handleEndAim} onTouchMove={handleMoveAim} onTouchEnd={handleEndAim}>
                        <rect x="15" y="15" width={width - 30} height={height - 30} fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.5" />
                        <line x1={width / 2} y1="15" x2={width / 2} y2={height - 15} stroke="#ffffff" strokeWidth="4" opacity="0.5" />
                        <circle cx={width / 2} cy={height / 2} r="70" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.5" />
                        <circle cx={width / 2} cy={height / 2} r="6" fill="#ffffff" />
                        <rect x="15" y={height / 2 - 130} width="90" height="260" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.5" />
                        <rect x={width - 105} y={height / 2 - 130} width="90" height="260" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.5" />
                        <rect x="2" y={goalYTop} width="13" height={goalYBottom - goalYTop} fill="#1e293b" stroke="#fff" strokeWidth="2" opacity="0.9" />
                        <rect x={width - 15} y={goalYTop} width="13" height={goalYBottom - goalYTop} fill="#1e293b" stroke="#fff" strokeWidth="2" opacity="0.9" />

                        {aimingPlayer && (
                            <g style={{ pointerEvents: 'none' }}>
                                <circle cx={aimingPlayer.x} cy={aimingPlayer.y} r="140" fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="5,5" opacity="0.3" />
                                <line x1={aimingPlayer.x} y1={aimingPlayer.y} x2={aimTargetX} y2={aimTargetY} stroke={aimDistPercent > 0.8 ? '#ef4444' : '#eab308'} strokeWidth="6" strokeLinecap="round" opacity="0.8" />
                                <circle cx={aimTargetX} cy={aimTargetY} r="8" fill="#ffffff" />
                            </g>
                        )}

                        {game.players.map((player) => {
                            const isAimingThis = aimingPlayer?.id === player.id;
                            const isSelectable = !game.isSimulating && game.activeTeam === player.team && puedeTirar;
                            let renderAngle = player.angle;
                            if (isAimingThis) renderAngle = Math.atan2(aimTargetY - player.y, aimTargetX - player.x);
                            return (
                                <g key={player.id} transform={`translate(${player.x}, ${player.y}) rotate(${(renderAngle * 180) / Math.PI})`}
                                    style={{ cursor: isSelectable ? 'pointer' : 'default' }}
                                    onMouseDown={(e) => handleStartAim(player, e)} onTouchStart={(e) => handleStartAim(player, e)}>
                                    <circle cx="0" cy="0" r={player.r} fill={player.team === 'red' ? '#ef4444' : '#3b82f6'} stroke={isAimingThis ? '#ffffff' : '#0f172a'} strokeWidth={isAimingThis ? '3' : '2'} />
                                    <path d={`M ${player.r - 4} -10 A ${player.r} ${player.r} 0 0 1 ${player.r - 4} 10`} fill="none" stroke="#ffffff" strokeWidth="3" />
                                    <circle cx="-2" cy="0" r="7" fill="#fecdd3" stroke={player.team === 'red' ? '#991b1b' : '#1e40af'} strokeWidth="1.5" />
                                    {isSelectable && !aiming.isActive && (
                                        <circle cx="0" cy="0" r={player.r + 5} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="2,4" opacity="0.6">
                                            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
                                        </circle>
                                    )}
                                </g>
                            );
                        })}

                        <g transform={`translate(${game.ball.x}, ${game.ball.y})`} style={{ pointerEvents: 'none' }}>
                            <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                            <circle cx="0" cy="0" r="4" fill="#0f172a" />
                            <line x1="0" y1="-4" x2="0" y2="-11" stroke="#0f172a" strokeWidth="1.5" />
                            <line x1="-3" y1="2" x2="-9" y2="6" stroke="#0f172a" strokeWidth="1.5" />
                            <line x1="3" y1="2" x2="9" y2="6" stroke="#0f172a" strokeWidth="1.5" />
                            <line x1="-4" y1="-2" x2="-10" y2="-5" stroke="#0f172a" strokeWidth="1.5" />
                            <line x1="4" y1="-2" x2="10" y2="-5" stroke="#0f172a" strokeWidth="1.5" />
                        </g>
                    </svg>

                    {/* Flash de GOL */}
                    {golFlash && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${teamColor(golFlash)}22`, pointerEvents: 'none' }}>
                            <div style={{ fontSize: 'clamp(2rem, 9vw, 5rem)', fontWeight: 900, color: teamColor(golFlash), textShadow: '0 4px 14px rgba(0,0,0,0.6)', animation: 'fqGol 0.5s ease' }}>⚽ ¡GOOOL!</div>
                        </div>
                    )}

                    {/* Cartel de PENALTI */}
                    {penaltiBanner && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(234,179,8,0.18)', pointerEvents: 'none' }}>
                            <div style={{ fontSize: 'clamp(2rem, 9vw, 5rem)', fontWeight: 900, color: '#eab308', textShadow: '0 4px 14px rgba(0,0,0,0.7)', animation: 'fqGol 0.5s ease', letterSpacing: 2 }}>⚠️ ¡PENALTI!</div>
                        </div>
                    )}
                </div>

                {/* MODAL DE PREGUNTA */}
                {mostrarModal && (
                    <div className="fq-modal-backdrop">
                        <EstilosPregunta />
                        <div className="fq-modal-hud">
                            <span className="fq-team-chip" style={{ background: teamColor(game.activeTeam) }}>{nombres[game.activeTeam]}</span>
                            <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Responde para tirar</span>
                            {vsCPU && <span style={{ color: rachaFallos >= 3 ? '#ef4444' : '#94a3b8', fontSize: '0.85rem', fontWeight: 700 }}>🤖 Fallos: {rachaFallos}/4</span>}
                        </div>
                        {modalFase === 'REVEAL' && revealInfo ? (
                            <div className="question-card" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem' }}>{revealInfo.ok ? '✅' : '❌'}</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: 14, color: revealInfo.ok ? '#2ecc71' : '#e74c3c' }}>{revealInfo.ok ? '¡Correcto!' : 'Incorrecto'}</div>
                                {revealInfo.correctText && (
                                    <>
                                        <div style={{ color: '#ccc', fontSize: '0.95rem' }}>La respuesta correcta era:</div>
                                        <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: '#f1c40f', marginTop: 8 }}>{parseText(revealInfo.correctText)}</div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <QuestionDisplay data={preguntaActual} onAnswer={responderPregunta} disabled={modalFase === 'REVEAL'} feedback={modalFase === 'REVEAL' && revealInfo ? (revealInfo.ok ? 'correct' : 'incorrect') : null} />
                        )}
                    </div>
                )}
            </div>

            <style>{`@keyframes fqGol { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </div>
    );
}

// ============================================================================
// PANTALLA DE CAMPEONES — celebración final
// ============================================================================
function PantallaCampeones({ resultado, recurso, hojas, onJugarOtra, onExit }) {
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const { ganador, nombres, stats, golesParaGanar } = resultado;
    const colorGana = ganador === 'red' ? '#ef4444' : '#3b82f6';
    const nombreGana = nombres[ganador];

    // Confeti + reproductor "We Are The Champions"
    const ytRef = useRef(null);
    useEffect(() => {
        // Confeti repetido
        const fin = Date.now() + 6000;
        const lanzar = () => {
            confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 }, colors: ['#f1c40f', colorGana, '#ffffff'] });
            confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 }, colors: ['#f1c40f', colorGana, '#ffffff'] });
            if (Date.now() < fin) requestAnimationFrame(lanzar);
        };
        lanzar();

        // YouTube
        let cancelled = false; let initId = null;
        const create = () => {
            if (cancelled || !document.getElementById('fq-champ-yt') || !window.YT?.Player) return;
            ytRef.current = new window.YT.Player('fq-champ-yt', {
                videoId: CHAMPIONS_VIDEO_ID, height: '180', width: '320',
                playerVars: { autoplay: 1, start: CHAMPIONS_START, rel: 0, modestbranding: 1, origin: window.location.origin },
                events: { onReady: (e) => { try { e.target.seekTo(CHAMPIONS_START); e.target.playVideo(); } catch (err) { } } }
            });
        };
        if (window.YT && window.YT.Player) initId = setTimeout(create, 120);
        else {
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
            }
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { prev && prev(); initId = setTimeout(create, 120); };
        }
        return () => { cancelled = true; if (initId) clearTimeout(initId); if (ytRef.current) { try { ytRef.current.destroy(); } catch (e) { } } };
    }, []);

    const Equipo = ({ team }) => {
        const s = stats[team];
        const col = team === 'red' ? '#ef4444' : '#3b82f6';
        const esGana = team === ganador;
        return (
            <div style={{ flex: 1, minWidth: 130, background: esGana ? `${col}22` : 'rgba(255,255,255,0.05)', border: `2px solid ${esGana ? col : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, color: col, fontSize: '1rem', marginBottom: 4 }}>{esGana ? '🏆 ' : ''}{nombres[team]}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{s.goles}</div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 6 }}>⚽ goles</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8, fontSize: '0.85rem', fontWeight: 700 }}>
                    <span style={{ color: '#2ecc71' }}>✓ {s.aciertos}</span>
                    <span style={{ color: '#e74c3c' }}>✗ {s.fallos}</span>
                </div>
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden', background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0b1220 100%)', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px 16px', boxSizing: 'border-box', overflowY: 'auto' }}>
            {/* Balones cayendo */}
            {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', top: '-60px', left: `${(i * 7 + 3) % 100}%`, fontSize: `${1.4 + (i % 4) * 0.5}rem`, animation: `fqCaer ${4 + (i % 5)}s linear ${(i % 6) * 0.6}s infinite`, pointerEvents: 'none' }}>⚽</div>
            ))}

            <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: '3.5rem', animation: 'fqLatido 1s ease infinite' }}>🏆</div>
                <h1 style={{ margin: 0, color: colorGana, fontSize: 'clamp(1.6rem, 7vw, 2.4rem)', fontWeight: 900, textAlign: 'center', textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
                    ¡{nombreGana} CAMPEÓN!
                </h1>
                <div style={{ color: '#cbd5e1', fontWeight: 600 }}>Primero en marcar {golesParaGanar} {golesParaGanar === 1 ? 'gol' : 'goles'}</div>

                {/* Vídeo We Are The Champions */}
                <div style={{ width: '100%', maxWidth: 320, borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', background: '#000', aspectRatio: '16/9' }}>
                    <div id="fq-champ-yt" style={{ width: '100%', height: '100%' }} />
                </div>

                {/* Estadísticas por equipo */}
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <Equipo team="red" />
                    <Equipo team="blue" />
                </div>

                {/* Acciones */}
                <button onClick={() => setMostrarEnvio(true)} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                    📤 Enviar resultados al profesor
                </button>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <button onClick={onJugarOtra} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#16a34a', color: 'white', fontWeight: 800, cursor: 'pointer' }}>🔄 Jugar otra vez</button>
                    <button onClick={onExit} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Salir</button>
                </div>
            </div>

            {mostrarEnvio && <ModalEnviarProfeFutbol resultado={resultado} recurso={recurso} hojas={hojas} onClose={() => setMostrarEnvio(false)} />}

            <style>{`
                @keyframes fqCaer { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(110vh) rotate(360deg); } }
                @keyframes fqLatido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
            `}</style>
        </div>
    );
}

// Modal de envío al profesor (guarda en informes_juegos, tipo FUTBOLQUIZZ)
function ModalEnviarProfeFutbol({ resultado, recurso, hojas, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const { nombres, stats, ganador } = resultado;

    // Hojas jugadas: las seleccionadas, o todas las del recurso
    const hojasUsadas = (hojas && hojas.length) ? hojas : (recurso?.hojas?.map(h => h.nombreHoja) || []);

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const mkJugador = (team) => {
                const s = stats[team];
                const total = s.aciertos + s.fallos;
                return {
                    nombre: nombres[team], curso: curso.trim(), equipo: team === 'red' ? 'Rojo' : 'Azul',
                    goles: s.goles, aciertos: s.aciertos, fallos: s.fallos,
                    intentos: total, porcentaje: total > 0 ? Math.round((s.aciertos / total) * 100) : 0,
                    ganador: team === ganador,
                };
            };
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'FUTBOLQUIZZ', modalidad: resultado.vsCPU ? 'Individual (vs Ordenador)' : 'Versus', fecha: new Date(),
                recursoId: recurso?.id || '', recursoTitulo: recurso?.titulo || 'Fútbol Quizz (libre)',
                hojas: hojasUsadas,
                codigoProfesor: code,
                ganador: nombres[ganador],
                jugadores: [mkJugador('red'), mkJugador('blue')],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', color: '#ddd' }}>
                            <div><b style={{ color: '#ef4444' }}>{nombres.red}</b>: {stats.red.goles}⚽ · {stats.red.aciertos}✓ {stats.red.fallos}✗</div>
                            <div style={{ marginTop: 3 }}><b style={{ color: '#3b82f6' }}>{nombres.blue}</b>: {stats.blue.goles}⚽ · {stats.blue.aciertos}✓ {stats.blue.fallos}✗</div>
                            {recurso?.titulo && <div style={{ marginTop: 5, color: '#aaa' }}>📚 {recurso.titulo}</div>}
                            {hojasUsadas.length > 0 && <div style={{ color: '#aaa' }}>📄 {hojasUsadas.join(', ')}</div>}
                        </div>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso (opcional)</label>
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

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function FutbolQuizz({ onExit }) {
    const [fase, setFase] = useState('INICIO');
    const [config, setConfig] = useState(null);
    const [resultado, setResultado] = useState(null);

    if (fase === 'INICIO') {
        return <PantallaInicio onExit={onExit} onJugar={(cfg) => { setConfig(cfg); setResultado(null); setFase('JUGANDO'); }} />;
    }
    if (fase === 'FIN') {
        return <PantallaCampeones
            resultado={resultado}
            recurso={config?.recurso || null}
            hojas={config?.hojas || null}
            onJugarOtra={() => { setResultado(null); setFase('INICIO'); }}
            onExit={onExit}
        />;
    }
    return <JuegoFutbol
        config={config}
        onExit={onExit}
        onVolverInicio={() => { setConfig(null); setFase('INICIO'); }}
        onFin={(res) => { setResultado(res); setFase('FIN'); }}
    />;
}
