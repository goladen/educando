import React, { useState, useRef, useEffect, useCallback } from 'react';
import { db } from './firebase';
import {
    collection, addDoc, doc, setDoc, updateDoc, onSnapshot, getDoc
} from 'firebase/firestore';
import {
    Volume2, Play, Pause, RotateCcw, Send, Users, Monitor,
    ChevronRight, ArrowLeft, Trophy, Clock, Loader, CheckCircle, XCircle, Headphones
} from 'lucide-react';
import { NIVELES_LISTENING, LISTENING_ITEMS } from './BibliotecaListening';

// ─── Constantes ───────────────────────────────────────────────────────────────
const AUDIO_DURACION_EST = 62; // segundos estimados por audio (~1 min)

const generarCodigo = () =>
    Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

const cleanText = (s) =>
    String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ─── Parsear gapped transcript en segmentos ───────────────────────────────────
// Devuelve: [ {type:'text', text}, {type:'gap', gapNum, answer, opciones} ]
const parsearTranscript = (gapped, gaps) => {
    const parts = gapped.split(/(\[___\d+___\])/);
    const gapMap = {};
    gaps.forEach(g => { gapMap[g.gap_number] = g; });
    return parts.map((p, i) => {
        const m = p.match(/\[___(\d+)___\]/);
        if (m) {
            const num = parseInt(m[1]);
            const g = gapMap[num];
            return { type: 'gap', gapNum: num, answer: g?.answer || '', opciones: g?.multiple_choice_options || [] };
        }
        return { type: 'text', text: p };
    }).filter(s => s.type !== 'text' || s.text);
};

// Dividir segmentos en frases (split en puntos/signos de puntuación)
const dividirEnFrases = (segmentos) => {
    const frases = [];
    let actual = [];
    segmentos.forEach(seg => {
        actual.push(seg);
        if (seg.type === 'text' && /[.!?]/.test(seg.text)) {
            frases.push(actual);
            actual = [];
        }
    });
    if (actual.length) frases.push(actual);
    return frases;
};

// Estimar el tiempo de inicio de cada frase basado en palabras
const estimarTiemposFrases = (frases, duracion = AUDIO_DURACION_EST) => {
    const palabrasPorFrase = frases.map(f =>
        f.reduce((acc, s) => acc + (s.type === 'text' ? s.text.split(/\s+/).filter(Boolean).length : 1), 0)
    );
    const totalPalabras = palabrasPorFrase.reduce((a, b) => a + b, 0);
    let acumulado = 0;
    return palabrasPorFrase.map(n => {
        const t = (acumulado / totalPalabras) * duracion;
        acumulado += n;
        return t;
    });
};

// ─── Modal Enviar al Profesor ─────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo]     = useState('');
    const [nombre, setNombre]     = useState('');
    const [curso,  setCurso]      = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');
    const esLive = !!datos.jugadores;

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!esLive && !nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const jugs = esLive ? datos.jugadores
                : [{ nombre: nombre.trim(), curso: curso.trim(),
                     aciertos: datos.aciertos, total: datos.total,
                     porcentaje: datos.porcentaje, tema: datos.tema, modo: datos.modo }];
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'LISTENING', modalidad: datos.modalidad || 'Individual',
                tema: datos.tema || '', fecha: new Date(),
                codigoProfesor: code, jugadores: jugs,
            });
            setEnviado(true);
        } catch(e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
    return (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(8,12,24,0.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'0 30px 80px rgba(0,0,0,0.5)', padding:'26px 28px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.05rem' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:'1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                        <CheckCircle size={48} color="#27ae60" style={{ marginBottom:10 }}/>
                        <div style={{ color:'#27ae60', fontWeight:700 }}>¡Informe enviado!</div>
                        {datos.porcentaje !== undefined && (
                            <div style={{ marginTop:8, fontSize:'1.6rem', fontWeight:900, color: datos.porcentaje>=80?'#27ae60':datos.porcentaje>=50?'#e67e22':'#e74c3c' }}>
                                {datos.porcentaje}%
                            </div>
                        )}
                        <button onClick={onClose} style={{ marginTop:14, padding:'9px 22px', borderRadius:10, border:'none', background:'#f0f0f0', cursor:'pointer' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {!esLive && (<>
                            <div><label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Nombre y apellido</label>
                            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp}/></div>
                            <div><label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Curso</label>
                            <input value={curso} onChange={e=>setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp}/></div>
                        </>)}
                        {esLive && <div style={{ background:'#f8f9fa', borderRadius:10, padding:'10px 12px', fontSize:'0.83rem', color:'#555' }}>
                            Se enviarán <strong>{datos.jugadores.length}</strong> resultados.
                        </div>}
                        <div><label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Código del profesor</label>
                        <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{...inp, letterSpacing:2, fontWeight:700}}/></div>
                        {error && <div style={{ color:'#e74c3c', fontSize:'0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display:'flex', gap:9, marginTop:4 }}>
                            <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #ddd', background:'white', cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:enviando?'#95a5a6':'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:enviando?'default':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                                <Send size={15}/>{enviando?'Enviando…':'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Reproductor de audio ─────────────────────────────────────────────────────
function AudioPlayer({ url, onTimeUpdate, onEnded, controlRef, small = false }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (controlRef) controlRef.current = audioRef.current;
    }, []);

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) a.pause(); else a.play();
        setPlaying(!playing);
    };

    const handleTimeUpdate = () => {
        const a = audioRef.current;
        if (!a) return;
        const t = a.currentTime;
        setCurrentTime(t);
        setProgress(a.duration ? t / a.duration * 100 : 0);
        if (onTimeUpdate) onTimeUpdate(t);
    };

    const handleEnded = () => { setPlaying(false); if (onEnded) onEnded(); };
    const handleLoaded = () => setDuration(audioRef.current?.duration || 0);

    const seek = (e) => {
        const a = audioRef.current;
        if (!a || !a.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
    };

    const restart = () => {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = 0; a.play(); setPlaying(true);
    };

    return (
        <div style={{ background: small ? 'rgba(255,255,255,0.1)' : '#1a1a2e', borderRadius: 16, padding: small ? '10px 14px' : '16px 20px', display:'flex', alignItems:'center', gap:10 }}>
            <audio ref={audioRef} src={url} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onLoadedMetadata={handleLoaded}/>
            <button onClick={restart} title="Reiniciar" style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <RotateCcw size={14} color="white"/>
            </button>
            <button onClick={toggle} style={{ background:'#3498db', border:'none', borderRadius:'50%', width: small ? 36 : 44, height: small ? 36 : 44, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 12px rgba(52,152,219,0.5)' }}>
                {playing ? <Pause size={small?16:20} color="white"/> : <Play size={small?16:20} color="white"/>}
            </button>
            <div style={{ flex:1 }}>
                <div onClick={seek} style={{ height:6, background:'rgba(255,255,255,0.15)', borderRadius:3, cursor:'pointer', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${progress}%`, background:'#3498db', transition:'width 0.3s linear', borderRadius:3 }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:'0.7rem', color:'rgba(255,255,255,0.5)' }}>
                    <span>{fmtTime(currentTime)}</span>
                    <span>{fmtTime(duration)}</span>
                </div>
            </div>
            <Volume2 size={16} color="rgba(255,255,255,0.4)" style={{ flexShrink:0 }}/>
        </div>
    );
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ─── Componente de hueco ──────────────────────────────────────────────────────
function Hueco({ gap, modo, respuesta, onRespuesta, revealed, comprobado, hostView=false }) {
    const correcto = comprobado ? cleanText(respuesta) === cleanText(gap.answer) : null;
    const width = Math.max(80, gap.answer.length * 10 + 20);

    if (hostView) {
        return (
            <span style={{ display:'inline-block', margin:'0 2px', padding:'2px 9px', borderRadius:6, background:'rgba(52,152,219,0.25)', border:'1px dashed #3498db', color:'#7fc3f0', fontWeight:700, fontSize:'0.88rem', verticalAlign:'middle' }}>
                {gap.answer}
            </span>
        );
    }
    if (!revealed) {
        return (
            <span style={{ display:'inline-block', width, height:22, background:'rgba(255,255,255,0.08)', borderRadius:4, verticalAlign:'middle', margin:'0 2px' }}/>
        );
    }

    if (modo === 'multiple') {
        if (comprobado) {
            return (
                <span style={{ display:'inline-block', margin:'0 2px', padding:'2px 8px', borderRadius:6, background: correcto ? '#27ae60' : '#e74c3c', color:'white', fontWeight:700, fontSize:'0.9rem', verticalAlign:'middle' }}>
                    {respuesta || '___'}
                    {!correcto && <span style={{ fontSize:'0.78rem', marginLeft:4, opacity:.8 }}>→{gap.answer}</span>}
                </span>
            );
        }
        return (
            <select value={respuesta || ''} onChange={e => onRespuesta(e.target.value)}
                style={{ display:'inline-block', margin:'0 2px', padding:'3px 7px', borderRadius:6, border: respuesta ? '2px solid #2980b9' : '2px solid #bdc3c7', background: respuesta ? '#d6eaf8' : '#f8f9fa', cursor:'pointer', fontSize:'0.88rem', fontFamily:'inherit', verticalAlign:'middle', maxWidth:130, color:'#2c3e50', fontWeight: respuesta?700:400 }}>
                <option value="">…</option>
                {gap.opciones.map((o, i) => <option key={i} value={o}>{o}</option>)}
            </select>
        );
    }

    // Write mode
    if (comprobado) {
        return (
            <span style={{ display:'inline-block', margin:'0 2px', padding:'2px 8px', borderRadius:6, background: correcto ? '#27ae60' : '#e74c3c', color:'white', fontWeight:700, fontSize:'0.9rem', verticalAlign:'middle' }}>
                {respuesta || '___'}
                {!correcto && <span style={{ fontSize:'0.78rem', marginLeft:4, opacity:.8 }}>→{gap.answer}</span>}
            </span>
        );
    }
    return (
        <input value={respuesta || ''} onChange={e => onRespuesta(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
            placeholder="___"
            style={{ display:'inline-block', width, margin:'0 2px', padding:'3px 7px', borderRadius:6, border: respuesta ? '2px solid #2980b9' : '2px solid #bdc3c7', background: respuesta ? '#d6eaf8' : '#f8f9fa', fontSize:'0.88rem', fontFamily:'inherit', verticalAlign:'middle', outline:'none', textAlign:'center', color:'#2c3e50', fontWeight: respuesta?700:400 }}
        />
    );
}

// ─── Vista del transcript con huecos ──────────────────────────────────────────
function TranscriptView({ segmentos, modo, respuestas, onRespuesta, frasesReveladas, comprobado, totalFrases, hostView=false }) {
    const frases = dividirEnFrases(segmentos);
    return (
        <div style={{ lineHeight: 2.2, fontSize:'1.05rem', color:'white' }}>
            {frases.map((frase, fi) => {
                const visible = fi < frasesReveladas;
                return (
                    <span key={fi} style={{ opacity: visible ? 1 : 0, transition:'opacity 0.5s ease', display:'inline' }}>
                        {frase.map((seg, si) => {
                            if (seg.type === 'text') return <span key={si}>{seg.text}</span>;
                            return (
                                <Hueco key={si} gap={seg} modo={modo}
                                    respuesta={respuestas[seg.gapNum] || ''}
                                    onRespuesta={v => onRespuesta(seg.gapNum, v)}
                                    revealed={visible}
                                    comprobado={comprobado}
                                    hostView={hostView}
                                />
                            );
                        })}
                    </span>
                );
            })}
        </div>
    );
}

// ─── Pantalla principal: selección de tema ────────────────────────────────────
function PantallaSeleccion({ onSel, onLive, onUnirse, onBack }) {
    const [filtro, setFiltro] = useState(null);
    const [joinCode, setJoinCode] = useState('');
    const [busqueda, setBusqueda] = useState('');

    const items = LISTENING_ITEMS.filter(it => {
        if (filtro === 'A-G' && !['A','B','C','D','E','F','G'].includes(it.letter)) return false;
        if (filtro === 'H-N' && !['H','I','J','K','L','M','N'].includes(it.letter)) return false;
        if (filtro === 'O-Z' && !['O','P','Q','R','S','T','U','V','W','X','Y','Z'].includes(it.letter)) return false;
        if (busqueda && !it.titulo.toLowerCase().includes(busqueda.toLowerCase())) return false;
        return true;
    });

    return (
        <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e)', fontFamily:"'Segoe UI',sans-serif", padding:'0 0 40px' }}>
            <div style={{ background:'rgba(255,255,255,0.05)', padding:'20px 24px', display:'flex', alignItems:'center', gap:12 }}>
                {onBack && <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'8px 14px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.88rem', marginRight:4 }}>
                    <ArrowLeft size={16}/> Volver
                </button>}
                <Headphones size={28} color="#3498db"/>
                <div>
                    <div style={{ color:'white', fontWeight:800, fontSize:'1.2rem' }}>Listening Practice</div>
                    <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.78rem' }}>Listen a Minute · 95 topics</div>
                </div>
            </div>

            <div style={{ maxWidth:800, margin:'0 auto', padding:'20px 16px' }}>
                {/* Filtros */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                    {NIVELES_LISTENING.map(n => (
                        <button key={String(n.id)} onClick={() => setFiltro(n.id)}
                            style={{ padding:'6px 14px', borderRadius:20, border:`2px solid ${filtro===n.id?n.color:'rgba(255,255,255,0.15)'}`, background: filtro===n.id?n.color:'transparent', color:'white', cursor:'pointer', fontFamily:'inherit', fontWeight: filtro===n.id?700:400, fontSize:'0.82rem' }}>
                            {n.emoji} {n.label}
                        </button>
                    ))}
                    <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍 Search topic..."
                        style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:20, border:'2px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'white', outline:'none', fontSize:'0.82rem', fontFamily:'inherit', minWidth:160 }}/>
                </div>

                {/* Grid de topics */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:28 }}>
                    {items.map(it => (
                        <button key={it.id} onClick={() => onSel(it)}
                            style={{ padding:'14px 12px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', cursor:'pointer', color:'white', fontFamily:'inherit', textAlign:'left', transition:'all 0.18s', display:'flex', flexDirection:'column', gap:4 }}
                            onMouseEnter={e=>{e.currentTarget.style.background='rgba(52,152,219,0.2)';e.currentTarget.style.borderColor='#3498db';}}
                            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';}}>
                            <span style={{ fontSize:'1.1rem', fontWeight:800, color:'#3498db' }}>{it.letter}</span>
                            <span style={{ fontSize:'0.88rem', fontWeight:600 }}>{it.titulo}</span>
                            <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.4)' }}>7 gaps</span>
                        </button>
                    ))}
                </div>

                {/* Online */}
                <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px 20px', border:'1.5px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ color:'white', fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                        <Monitor size={18} color="#27ae60"/> Sesión Online
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        <button onClick={onLive} style={{ padding:'10px 18px', borderRadius:10, border:'none', background:'#27ae60', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                            <Users size={15}/> Crear sala
                        </button>
                        <div style={{ display:'flex', gap:8, flex:1 }}>
                            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="CÓDIGO SALA" maxLength={6}
                                style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', outline:'none', fontSize:'0.9rem', letterSpacing:2, fontFamily:'inherit', textAlign:'center' }}/>
                            <button onClick={() => { if(joinCode.length===6) onUnirse(joinCode); }}
                                style={{ padding:'10px 16px', borderRadius:10, border:'none', background:'#3498db', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                Unirse
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Pantalla modo selección ───────────────────────────────────────────────────
function PantallaModo({ item, onModo, onBack }) {
    return (
        <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e)', fontFamily:"'Segoe UI',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:24, padding:'32px 28px', maxWidth:440, width:'100%', textAlign:'center' }}>
                <button onClick={onBack} style={{ position:'absolute', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:4, fontSize:'0.82rem' }}>
                    <ArrowLeft size={14}/> Back
                </button>
                <div style={{ fontSize:'3rem', marginBottom:8 }}>🎧</div>
                <div style={{ color:'white', fontWeight:800, fontSize:'1.3rem', marginBottom:4 }}>{item.titulo}</div>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.8rem', marginBottom:28 }}>7 gap-fill questions</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <button onClick={() => onModo('multiple')}
                        style={{ padding:'18px 20px', borderRadius:16, border:'2px solid #3498db', background:'rgba(52,152,219,0.15)', cursor:'pointer', color:'white', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
                        <span style={{ fontSize:'1.6rem' }}>🔘</span>
                        <div>
                            <div style={{ fontWeight:700 }}>Multiple Choice</div>
                            <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', marginTop:2 }}>Choose the correct word from 4 options</div>
                        </div>
                    </button>
                    <button onClick={() => onModo('write')}
                        style={{ padding:'18px 20px', borderRadius:16, border:'2px solid #27ae60', background:'rgba(39,174,96,0.15)', cursor:'pointer', color:'white', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:14 }}>
                        <span style={{ fontSize:'1.6rem' }}>✍️</span>
                        <div>
                            <div style={{ fontWeight:700 }}>Write the Answer</div>
                            <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', marginTop:2 }}>Type the missing words as you listen</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Juego individual ──────────────────────────────────────────────────────────
function JuegoIndividual({ item, modo, onBack }) {
    const segmentos = parsearTranscript(item.gappedTranscript, item.gaps);
    const frases = dividirEnFrases(segmentos);
    const tiempos = estimarTiemposFrases(frases);

    const [respuestas, setRespuestas] = useState({});
    const [frasesReveladas, setFrasesReveladas] = useState(1);
    const [comprobado, setComprobado] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const audioRef = useRef(null);

    const onTimeUpdate = useCallback((t) => {
        const nuevaFrase = tiempos.findLastIndex(ti => ti <= t) + 2;
        setFrasesReveladas(prev => Math.max(prev, Math.min(nuevaFrase, frases.length + 1)));
    }, [tiempos, frases.length]);

    const revelarTodo = () => setFrasesReveladas(frases.length + 1);

    const comprobar = () => {
        revelarTodo();
        setComprobado(true);
    };

    const gaps = item.gaps;
    const aciertos = comprobado ? gaps.filter(g => cleanText(respuestas[g.gap_number]) === cleanText(g.answer)).length : 0;
    const pct = comprobado ? Math.round(aciertos / gaps.length * 100) : 0;

    return (
        <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e)', fontFamily:"'Segoe UI',sans-serif" }}>
            {/* Header */}
            <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:10, background:'rgba(0,0,0,0.2)' }}>
                <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, padding:'7px 12px', cursor:'pointer', color:'white', display:'flex', alignItems:'center', gap:5, fontSize:'0.82rem' }}>
                    <ArrowLeft size={14}/> Back
                </button>
                <div style={{ color:'white', fontWeight:700, flex:1 }}>{item.titulo}</div>
                <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'4px 12px', color:'rgba(255,255,255,0.7)', fontSize:'0.78rem' }}>
                    {modo === 'multiple' ? '🔘 Multiple Choice' : '✍️ Write'}
                </div>
            </div>

            <div style={{ maxWidth:760, margin:'0 auto', padding:'16px 16px 40px' }}>
                {/* Audio */}
                <div style={{ marginBottom:16 }}>
                    <AudioPlayer url={item.audioUrl} onTimeUpdate={onTimeUpdate} controlRef={audioRef}/>
                </div>

                {/* Instrucción */}
                {!comprobado && (
                    <div style={{ background:'rgba(52,152,219,0.15)', border:'1px solid rgba(52,152,219,0.3)', borderRadius:10, padding:'10px 14px', color:'rgba(255,255,255,0.7)', fontSize:'0.82rem', marginBottom:14 }}>
                        🎧 Listen and fill in the gaps. The text appears as the audio progresses.
                        <button onClick={revelarTodo} style={{ marginLeft:12, background:'none', border:'none', cursor:'pointer', color:'#3498db', fontSize:'0.8rem', textDecoration:'underline' }}>Show all text</button>
                    </div>
                )}

                {/* Transcript */}
                <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:16, padding:'22px 20px', marginBottom:16, minHeight:200 }}>
                    <TranscriptView segmentos={segmentos} modo={modo} respuestas={respuestas}
                        onRespuesta={(num, val) => setRespuestas(prev => ({ ...prev, [num]: val }))}
                        frasesReveladas={frasesReveladas} comprobado={comprobado} totalFrases={frases.length}/>
                </div>

                {/* Resultado */}
                {comprobado && (
                    <div style={{ background: pct >= 80 ? 'rgba(39,174,96,0.2)' : pct >= 50 ? 'rgba(230,126,34,0.2)' : 'rgba(231,76,60,0.2)', border:`2px solid ${pct>=80?'#27ae60':pct>=50?'#e67e22':'#e74c3c'}`, borderRadius:16, padding:'16px 20px', marginBottom:16 }}>
                        <div style={{ color:'white', fontWeight:800, fontSize:'1.1rem', marginBottom:4 }}>
                            {pct >= 80 ? '🎉 Excellent!' : pct >= 50 ? '👍 Good effort!' : '💪 Keep practising!'}
                        </div>
                        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.9rem' }}>
                            {aciertos}/{gaps.length} correct · {pct}%
                        </div>
                    </div>
                )}

                {/* Botones */}
                <div style={{ display:'flex', gap:10 }}>
                    {!comprobado ? (
                        <button onClick={comprobar}
                            style={{ flex:1, padding:'13px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, fontSize:'0.95rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                            <CheckCircle size={18}/> Check Answers
                        </button>
                    ) : (
                        <>
                            <button onClick={onBack} style={{ flex:1, padding:'13px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.2)', background:'transparent', color:'white', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                                ← New Topic
                            </button>
                            <button onClick={() => setMostrarEnvio(true)}
                                style={{ flex:1, padding:'13px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#27ae60,#2ecc71)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                                <Send size={16}/> Send to Teacher
                            </button>
                        </>
                    )}
                </div>
            </div>
            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ aciertos, total: gaps.length, porcentaje: pct, tema: item.titulo, modo, modalidad: 'Individual' }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}

// ─── Transcript toggle para el host ──────────────────────────────────────────
function TranscriptHostToggle({ transcript, gapped, gaps }) {
    const [mostrar, setMostrar] = useState(false);
    const [vista, setVista] = useState('full'); // 'full' | 'gapped'
    return (
        <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
                <button onClick={() => setMostrar(m => !m)}
                    style={{ padding:'7px 16px', borderRadius:10, border:'none', background: mostrar?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.08)', color:'white', cursor:'pointer', fontFamily:'inherit', fontWeight:600, fontSize:'0.85rem', display:'flex', alignItems:'center', gap:6 }}>
                    {mostrar ? '🙈 Ocultar transcript' : '👁 Mostrar transcript'}
                </button>
                {mostrar && (
                    <div style={{ display:'flex', gap:6 }}>
                        {[{id:'full',label:'Completo'},{id:'gapped',label:'Con huecos'}].map(v=>(
                            <button key={v.id} onClick={()=>setVista(v.id)}
                                style={{ padding:'5px 12px', borderRadius:8, border:`1.5px solid ${vista===v.id?'#3498db':'rgba(255,255,255,0.2)'}`, background:vista===v.id?'rgba(52,152,219,0.3)':'transparent', color:'white', cursor:'pointer', fontSize:'0.78rem', fontFamily:'inherit' }}>
                                {v.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {mostrar && (
                <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:14, padding:'18px 20px', lineHeight:1.9, fontSize:'0.92rem', color:'rgba(255,255,255,0.9)', maxHeight:320, overflowY:'auto' }}>
                    {vista === 'full' ? transcript : (
                        <span dangerouslySetInnerHTML={{ __html: gapped.replace(/\[___(\d+)___\]/g, (_, n) => {
                            const g = gaps.find(g=>g.gap_number===parseInt(n));
                            return `<span style="background:#3498db;color:white;padding:1px 8px;border-radius:6px;font-weight:700;margin:0 2px">${g?.answer||'???'}</span>`;
                        })}}/>
                    )}
                </div>
            )}
        </div>
    );
}



// ─── MODO ONLINE: HOST ────────────────────────────────────────────────────────
function ListeningLiveHost({ codigoSala, onExit }) {
    const [sala, setSala] = useState(null);
    const salaRef = useRef(null);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), snap => {
            if (!snap.exists()) return;
            const d = snap.data();
            setSala(d); salaRef.current = d;
        });
        return () => unsub();
    }, [codigoSala]);

    const empezarRonda = async (itemId) => {
        const item = LISTENING_ITEMS.find(i => i.id === itemId);
        if (!item) return;
        await updateDoc(doc(db, 'live_games', codigoSala), {
            estado: 'JUGANDO', itemActual: itemId,
            respuestasRonda: {}, tiempoLimite: salaRef.current?.config?.tiempoLimite || 90,
            inicioRonda: Date.now(),
        });
    };

    const finalizarRonda = async () => {
        await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'RESULTADOS' });
    };

    if (!sala) return <div style={{ minHeight:'100vh', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center' }}><Loader size={40} color="white"/></div>;

    const jugadores = Object.values(sala.jugadores || {});
    const itemActual = sala.itemActual ? LISTENING_ITEMS.find(i => i.id === sala.itemActual) : null;
    const ranking = [...jugadores].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));

    const datosFin = {
        modalidad: 'Online', tema: itemActual?.titulo || '',
        jugadores: ranking.map(j => ({ nombre: j.nombre, curso: '', puntos: j.puntos || 0, aciertos: j.aciertos || 0, total: 7, porcentaje: Math.round((j.aciertos || 0) / 7 * 100) }))
    };

    return (
        <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e)', fontFamily:"'Segoe UI',sans-serif", color:'white' }}>
            <div style={{ padding:'14px 20px', background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:12 }}>
                <Headphones size={22} color="#3498db"/>
                <span style={{ fontWeight:700, flex:1 }}>Listening Online — Sala: <strong style={{ letterSpacing:2 }}>{codigoSala}</strong></span>
                <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)' }}><Users size={13} style={{ verticalAlign:'middle' }}/> {jugadores.length} alumnos</span>
                <button onClick={onExit} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:'0.8rem' }}>✕ Salir</button>
            </div>

            <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px' }}>
                {/* LOBBY */}
                {sala.estado === 'LOBBY' && (
                    <div>
                        <h2 style={{ marginBottom:20 }}>Selecciona un listening para la clase</h2>
                        {/* Config modo + tiempo */}
                        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', flexDirection:'column', gap:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                                <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.88rem', minWidth:120 }}>🎯 Modo alumno:</span>
                                {[{id:'write',label:'✍️ Escribir',col:'#27ae60'},{id:'multiple',label:'🔘 Opciones',col:'#3498db'}].map(m => (
                                    <button key={m.id} onClick={() => updateDoc(doc(db,'live_games',codigoSala),{config:{...sala.config,modoAlumno:m.id}})}
                                        style={{ padding:'6px 16px', borderRadius:20, border:`2px solid ${(sala.config?.modoAlumno||'write')===m.id?m.col:'rgba(255,255,255,0.2)'}`, background:(sala.config?.modoAlumno||'write')===m.id?`${m.col}44`:'transparent', color:'white', cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit', fontWeight:(sala.config?.modoAlumno||'write')===m.id?700:400 }}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                                <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.88rem', minWidth:120 }}>⏱ Tiempo:</span>
                                {[60, 90, 120, 180].map(t => (
                                    <button key={t} onClick={() => updateDoc(doc(db,'live_games',codigoSala),{config:{...sala.config,tiempoLimite:t}})}
                                        style={{ padding:'5px 14px', borderRadius:20, border:`2px solid ${sala.config?.tiempoLimite===t?'#3498db':'rgba(255,255,255,0.2)'}`, background:sala.config?.tiempoLimite===t?'rgba(52,152,219,0.3)':'transparent', color:'white', cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit' }}>
                                        {t}s
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Alumnos conectados */}
                        <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'14px 18px', marginBottom:20 }}>
                            <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', marginBottom:10 }}>Alumnos en sala:</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                                {jugadores.map(j => <span key={j.uid} style={{ background:'rgba(52,152,219,0.2)', borderRadius:20, padding:'4px 12px', fontSize:'0.82rem' }}>{j.nombre}</span>)}
                                {jugadores.length === 0 && <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.82rem' }}>Esperando alumnos...</span>}
                            </div>
                        </div>
                        {/* Topics grid */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
                            {LISTENING_ITEMS.map(it => (
                                <button key={it.id} onClick={() => empezarRonda(it.id)}
                                    style={{ padding:'12px 10px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', cursor:'pointer', color:'white', fontFamily:'inherit', textAlign:'left' }}>
                                    <div style={{ fontWeight:800, color:'#3498db', fontSize:'0.9rem' }}>{it.letter}</div>
                                    <div style={{ fontSize:'0.82rem', marginTop:2 }}>{it.titulo}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* JUGANDO */}
                {sala.estado === 'JUGANDO' && itemActual && (
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                            <h2 style={{ margin:0, flex:1 }}>{itemActual.titulo}</h2>
                            <span style={{ background:'rgba(39,174,96,0.2)', border:'1px solid #27ae60', borderRadius:20, padding:'4px 14px', fontSize:'0.8rem', color:'#2ecc71' }}>
                                🔴 En directo
                            </span>
                        </div>
                        {/* Audio del host */}
                        <div style={{ marginBottom:20 }}>
                            <AudioPlayer url={itemActual.audioUrl}/>
                        </div>
                        {/* Transcript completo del host - oculto por defecto */}
                        <TranscriptHostToggle transcript={itemActual.fullTranscript} gapped={itemActual.gappedTranscript} gaps={itemActual.gaps}/>
                        {/* Respuestas recibidas */}
                        <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'14px 18px', marginBottom:16 }}>
                            <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', marginBottom:8 }}>
                                Respuestas: {Object.keys(sala.respuestasRonda || {}).length}/{jugadores.length}
                            </div>
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                {jugadores.map(j => {
                                    const resp = sala.respuestasRonda?.[j.uid];
                                    return (
                                        <span key={j.uid} style={{ background: resp ? 'rgba(39,174,96,0.2)' : 'rgba(255,255,255,0.05)', borderRadius:20, padding:'4px 12px', fontSize:'0.78rem', border:`1px solid ${resp?'#27ae60':'rgba(255,255,255,0.1)'}` }}>
                                            {j.nombre} {resp ? '✓' : '…'}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                            <button onClick={finalizarRonda} style={{ flex:1, padding:'13px', borderRadius:12, border:'none', background:'#e74c3c', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                ⏹ Ver Resultados
                            </button>
                            <button onClick={() => updateDoc(doc(db,'live_games',codigoSala),{estado:'LOBBY',itemActual:null})}
                                style={{ padding:'13px 18px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.2)', background:'transparent', color:'white', cursor:'pointer', fontFamily:'inherit' }}>
                                Nuevo tema
                            </button>
                        </div>
                    </div>
                )}

                {/* RESULTADOS */}
                {sala.estado === 'RESULTADOS' && (
                    <div>
                        <h2 style={{ textAlign:'center', marginBottom:24 }}>🏆 Resultados</h2>
                        <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:16, overflow:'hidden', marginBottom:20 }}>
                            {ranking.map((j, i) => (
                                <div key={j.uid} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', background: i===0?'rgba(241,196,15,0.1)':'transparent' }}>
                                    <span style={{ fontWeight:900, fontSize:'1.2rem', minWidth:28 }}>{['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
                                    <span style={{ flex:1, fontWeight:600 }}>{j.nombre}</span>
                                    <span style={{ color:'#f1c40f', fontWeight:700 }}>{j.aciertos||0}/7</span>
                                    <span style={{ background:'rgba(52,152,219,0.2)', borderRadius:12, padding:'3px 10px', fontSize:'0.82rem', color:'#3498db' }}>
                                        {Math.round((j.aciertos||0)/7*100)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                            <button onClick={() => setMostrarEnvio(true)}
                                style={{ flex:1, padding:'13px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#27ae60,#2ecc71)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                                <Send size={16}/> Enviar al Profesor
                            </button>
                            <button onClick={() => updateDoc(doc(db,'live_games',codigoSala),{estado:'LOBBY',itemActual:null,respuestasRonda:{}})}
                                style={{ flex:1, padding:'13px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.2)', background:'transparent', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                Nuevo Tema
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {mostrarEnvio && <ModalEnviarProfe datos={datosFin} onClose={() => setMostrarEnvio(false)}/>}
        </div>
    );
}

// ─── MODO ONLINE: CLIENT ─────────────────────────────────────────────────────
function ListeningLiveClient({ codigoSala, onExit, usuario }) {
    const [sala, setSala] = useState(null);
    const [nombre, setNombre] = useState(() => localStorage.getItem('pikt_guest_name') || '');
    const [uid] = useState(() => localStorage.getItem('pikt_guest_id') || ('guest_' + Math.random().toString(36).slice(2)));
    const [joined, setJoined] = useState(false);
    const [respuestas, setRespuestas] = useState({});
    const [enviado, setEnviado] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const prevItemRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('pikt_guest_id', uid);
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), snap => {
            if (!snap.exists()) return;
            const d = snap.data();
            setSala(d);
            // Nueva ronda → resetear respuestas
            if (d.itemActual !== prevItemRef.current) {
                prevItemRef.current = d.itemActual;
                setRespuestas({});
                setEnviado(false);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    const unirse = async () => {
        if (!nombre.trim()) return;
        localStorage.setItem('pikt_guest_name', nombre.trim());
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`jugadores.${uid}`]: { uid, nombre: nombre.trim(), puntos: 0, aciertos: 0 }
        });
        setJoined(true);
    };

    const enviarRespuestas = async () => {
        if (enviado || !sala?.itemActual) return;
        const item = LISTENING_ITEMS.find(i => i.id === sala.itemActual);
        if (!item) return;
        const aciertos = item.gaps.filter(g => cleanText(respuestas[g.gap_number]) === cleanText(g.answer)).length;
        setEnviado(true);
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`respuestasRonda.${uid}`]: { enviado: true },
            [`jugadores.${uid}.aciertos`]: aciertos,
            [`jugadores.${uid}.puntos`]: aciertos * 10,
        });
    };

    if (!sala) return <div style={{ minHeight:'100vh', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center' }}><Loader size={40} color="white"/></div>;

    const jugadores = Object.values(sala.jugadores || {});
    const yo = sala.jugadores?.[uid];
    const item = sala.itemActual ? LISTENING_ITEMS.find(i => i.id === sala.itemActual) : null;
    const segmentos = item ? parsearTranscript(item.gappedTranscript, item.gaps) : [];
    const pct = yo ? Math.round((yo.aciertos || 0) / 7 * 100) : 0;

    // JOIN screen
    if (!joined) return (
        <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',sans-serif" }}>
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:24, padding:'32px 28px', maxWidth:380, width:'100%', textAlign:'center' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>🎧</div>
                <h2 style={{ color:'white', marginBottom:8 }}>Listening Online</h2>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.88rem', marginBottom:24 }}>Sala: <strong style={{ letterSpacing:2 }}>{codigoSala}</strong></p>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"
                    onKeyDown={e => e.key === 'Enter' && unirse()}
                    style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'none', background:'rgba(255,255,255,0.1)', color:'white', fontSize:'1rem', outline:'none', marginBottom:14, boxSizing:'border-box', fontFamily:'inherit' }}/>
                <button onClick={unirse} disabled={!nombre.trim()}
                    style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#3498db', color:'white', fontWeight:700, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }}>
                    Unirse a la sala
                </button>
            </div>
        </div>
    );

    const isDark = sala.estado !== 'JUGANDO';
    return (
        <div style={{ minHeight:'100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', fontFamily:"'Segoe UI',sans-serif", transition:'background 0.4s' }}>
            <div style={{ padding:'12px 16px', background: isDark ? 'rgba(0,0,0,0.3)' : '#2c3e50', display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={onExit} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'white', fontSize:'0.78rem' }}>✕</button>
                <span style={{ flex:1, fontWeight:700, color:'white' }}>{nombre}</span>
                {yo && <span style={{ background:'rgba(241,196,15,0.3)', border:'1px solid #f1c40f', borderRadius:20, padding:'4px 12px', fontSize:'0.78rem', color:'#ffe066', fontWeight:700 }}>
                    {yo.aciertos||0}/7 · {pct}%
                </span>}
            </div>

            <div style={{ maxWidth:700, margin:'0 auto', padding:'16px 16px 40px' }}>
                {/* LOBBY */}
                {sala.estado === 'LOBBY' && (
                    <div style={{ textAlign:'center', marginTop:60 }}>
                        <div style={{ fontSize:'3rem', marginBottom:12 }}>⏳</div>
                        <h2 style={{ color: isDark?'white':'#2c3e50' }}>¡Hola {nombre}!</h2>
                        <p style={{ color: isDark?'rgba(255,255,255,0.5)':'#7f8c8d' }}>Esperando que el profesor empiece...</p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginTop:20 }}>
                            {jugadores.map(j => (
                                <span key={j.uid} style={{ background: j.uid===uid?'#3498db':(isDark?'rgba(255,255,255,0.1)':'#ecf0f1'), color: j.uid===uid?'white':'#2c3e50', borderRadius:20, padding:'5px 14px', fontSize:'0.82rem' }}>
                                    {j.nombre}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* JUGANDO */}
                {sala.estado === 'JUGANDO' && item && (
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                            <h3 style={{ margin:0, flex:1, color:'#2c3e50', fontSize:'1.1rem' }}>{item.titulo}</h3>
                            <span style={{ background:'#eaf4fe', borderRadius:12, padding:'4px 12px', fontSize:'0.8rem', color:'#2980b9', fontWeight:600 }}>
                                {sala.config?.modoAlumno==='multiple'?'🔘 Elige la opción':'✍️ Escribe la palabra'}
                            </span>
                            {enviado && <span style={{ background:'#e8f5e9', borderRadius:20, padding:'4px 12px', fontSize:'0.78rem', color:'#27ae60', fontWeight:700, border:'1px solid #27ae60' }}>✓ Enviado</span>}
                        </div>
                        {/* Transcript CON TODOS LOS HUECOS VISIBLES */}
                        <div style={{ background:'white', borderRadius:16, padding:'22px 20px', marginBottom:16, lineHeight:2.8, fontSize:'1rem', color:'#2c3e50', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
                            <TranscriptView segmentos={segmentos} modo={sala.config?.modoAlumno||'write'}
                                respuestas={respuestas}
                                onRespuesta={(num, val) => !enviado && setRespuestas(prev => ({ ...prev, [num]: val }))}
                                frasesReveladas={999} comprobado={false} totalFrases={999}/>
                        </div>
                        {!enviado ? (
                            <button onClick={enviarRespuestas}
                                style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#27ae60,#2ecc71)', color:'white', fontWeight:700, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                                <Send size={18}/> Enviar Respuestas
                            </button>
                        ) : (
                            <div style={{ textAlign:'center', background:'rgba(39,174,96,0.15)', border:'1px solid #27ae60', borderRadius:12, padding:'16px', color:'#2ecc71', fontWeight:600 }}>
                                ✅ Respuestas enviadas · Esperando al resto...
                            </div>
                        )}
                    </div>
                )}

                {/* RESULTADOS */}
                {sala.estado === 'RESULTADOS' && (
                    <div>
                        <div style={{ textAlign:'center', marginBottom:24 }}>
                            <div style={{ fontSize:'3rem', marginBottom:8 }}>{pct>=80?'🎉':pct>=50?'👍':'💪'}</div>
                            <div style={{ fontSize:'1.6rem', fontWeight:900, color:'#e67e22' }}>{yo?.aciertos||0}/7</div>
                            <div style={{ color:'#7f8c8d', marginTop:4 }}>{pct}% · {nombre}</div>
                        </div>
                        {/* Ranking */}
                        <div style={{ background:'white', borderRadius:16, overflow:'hidden', marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
                            {[...jugadores].sort((a,b)=>(b.aciertos||0)-(a.aciertos||0)).map((j, i) => (
                                <div key={j.uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:'1px solid #f0f0f0', background: j.uid===uid?'#eaf4fe':(i===0?'#fffbf0':'white') }}>
                                    <span style={{ fontWeight:900, minWidth:26, fontSize:'1.1rem' }}>{['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
                                    <span style={{ flex:1, fontWeight: j.uid===uid?700:400, color:'#2c3e50' }}>{j.nombre}{j.uid===uid?' (tú)':''}</span>
                                    <span style={{ color:'#e67e22', fontWeight:700 }}>{j.aciertos||0}/7</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setMostrarEnvio(true)}
                            style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 12px rgba(52,152,219,0.35)' }}>
                            <Send size={16}/> Enviar al Profesor
                        </button>
                    </div>
                )}
            </div>
            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ aciertos: yo?.aciertos||0, total:7, porcentaje:pct, tema:item?.titulo||'', modalidad:'Online' }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}

// ─── Crear sala online ────────────────────────────────────────────────────────
async function crearSalaListening() {
    const codigo = generarCodigo();
    await setDoc(doc(db, 'live_games', codigo), {
        tipoJuego: 'LISTENING',
        estado: 'LOBBY',
        jugadores: {},
        itemActual: null,
        respuestasRonda: {},
        config: { tiempoLimite: 90 },
        creadoEn: Date.now(),
    });
    return codigo;
}

// ─── Export principal ─────────────────────────────────────────────────────────
export default function ListeningGame({ onExit, isHost, codigoSala: codigoExterno, usuario }) {
    const [pantalla, setPantalla]         = useState('SELECCION');
    const [itemSel, setItemSel]           = useState(null);
    const [modo, setModo]                 = useState(null);
    const [internalHost, setInternalHost] = useState(null);
    const [internalClient, setInternalClient] = useState(null);

    // Modo externo (desde LandingGames)
    if (isHost && codigoExterno) return <ListeningLiveHost codigoSala={codigoExterno} onExit={onExit || (()=>{})} />;
    if (codigoExterno) return <ListeningLiveClient codigoSala={codigoExterno} onExit={onExit || (()=>{})} usuario={usuario}/>;

    // Modo interno
    if (internalHost) return <ListeningLiveHost codigoSala={internalHost} onExit={() => setInternalHost(null)}/>;
    if (internalClient) return <ListeningLiveClient codigoSala={internalClient} onExit={() => setInternalClient(null)} usuario={usuario}/>;

    if (pantalla === 'MODO' && itemSel) {
        return (
            <PantallaModo item={itemSel} onBack={() => setPantalla('SELECCION')}
                onModo={m => { setModo(m); setPantalla('JUEGO'); }}/>
        );
    }
    if (pantalla === 'JUEGO' && itemSel && modo) {
        return (
            <JuegoIndividual item={itemSel} modo={modo}
                onBack={() => { setModo(null); setPantalla('SELECCION'); }}/>
        );
    }

    return (
        <PantallaSeleccion
            onBack={onExit}
            onSel={item => { setItemSel(item); setPantalla('MODO'); }}
            onLive={async () => {
                const codigo = await crearSalaListening();
                setInternalHost(codigo);
            }}
            onUnirse={code => setInternalClient(code)}
        />
    );
}
