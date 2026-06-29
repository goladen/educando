import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { doc, setDoc, updateDoc, onSnapshot, collection, addDoc, getDoc, arrayUnion } from 'firebase/firestore';
import Confetti from 'react-confetti';
import {
    Flame, Sword, Shield, Skull, Heart, Star, CloudRain, Sun, Zap, Ghost,
    Key, Map, Compass, Anchor, Bell, Book, Camera, Car, Castle, Crown,
    Droplet, Eye, Feather, Flag, Gift, Hammer, Home, Leaf, Moon, Music,
    Rocket, Scissors, Smile, Frown, Snowflake, Tent, Trees, Trophy, Umbrella,
    Wand, Watch, Wind, Wrench, Bug, Cat, Dog, Bird, Fish, Coffee, Mountain,
    Bike, Train, Plane, ArrowLeft, Play, Send, Dices, User, CheckCircle, Timer
} from 'lucide-react';

// ─── DADOS ────────────────────────────────────────────────────────────────────
const DICE_MAP = {
    Flame:<Flame size={40} strokeWidth={1.5}/>, Sword:<Sword size={40} strokeWidth={1.5}/>, Shield:<Shield size={40} strokeWidth={1.5}/>,
    Skull:<Skull size={40} strokeWidth={1.5}/>, Heart:<Heart size={40} strokeWidth={1.5}/>, Star:<Star size={40} strokeWidth={1.5}/>,
    CloudRain:<CloudRain size={40} strokeWidth={1.5}/>, Sun:<Sun size={40} strokeWidth={1.5}/>, Zap:<Zap size={40} strokeWidth={1.5}/>,
    Ghost:<Ghost size={40} strokeWidth={1.5}/>, Key:<Key size={40} strokeWidth={1.5}/>, Map:<Map size={40} strokeWidth={1.5}/>,
    Compass:<Compass size={40} strokeWidth={1.5}/>, Anchor:<Anchor size={40} strokeWidth={1.5}/>, Bell:<Bell size={40} strokeWidth={1.5}/>,
    Book:<Book size={40} strokeWidth={1.5}/>, Camera:<Camera size={40} strokeWidth={1.5}/>, Car:<Car size={40} strokeWidth={1.5}/>,
    Castle:<Castle size={40} strokeWidth={1.5}/>, Crown:<Crown size={40} strokeWidth={1.5}/>, Droplet:<Droplet size={40} strokeWidth={1.5}/>,
    Eye:<Eye size={40} strokeWidth={1.5}/>, Feather:<Feather size={40} strokeWidth={1.5}/>, Flag:<Flag size={40} strokeWidth={1.5}/>,
    Gift:<Gift size={40} strokeWidth={1.5}/>, Hammer:<Hammer size={40} strokeWidth={1.5}/>, Home:<Home size={40} strokeWidth={1.5}/>,
    Leaf:<Leaf size={40} strokeWidth={1.5}/>, Moon:<Moon size={40} strokeWidth={1.5}/>, Music:<Music size={40} strokeWidth={1.5}/>,
    Rocket:<Rocket size={40} strokeWidth={1.5}/>, Scissors:<Scissors size={40} strokeWidth={1.5}/>, Smile:<Smile size={40} strokeWidth={1.5}/>,
    Frown:<Frown size={40} strokeWidth={1.5}/>, Snowflake:<Snowflake size={40} strokeWidth={1.5}/>, Tent:<Tent size={40} strokeWidth={1.5}/>,
    Trees:<Trees size={40} strokeWidth={1.5}/>, Trophy:<Trophy size={40} strokeWidth={1.5}/>, Umbrella:<Umbrella size={40} strokeWidth={1.5}/>,
    Wand:<Wand size={40} strokeWidth={1.5}/>, Watch:<Watch size={40} strokeWidth={1.5}/>, Wind:<Wind size={40} strokeWidth={1.5}/>,
    Wrench:<Wrench size={40} strokeWidth={1.5}/>, Bug:<Bug size={40} strokeWidth={1.5}/>, Cat:<Cat size={40} strokeWidth={1.5}/>,
    Dog:<Dog size={40} strokeWidth={1.5}/>, Bird:<Bird size={40} strokeWidth={1.5}/>, Fish:<Fish size={40} strokeWidth={1.5}/>,
    Coffee:<Coffee size={40} strokeWidth={1.5}/>, Mountain:<Mountain size={40} strokeWidth={1.5}/>, Bike:<Bike size={40} strokeWidth={1.5}/>,
    Train:<Train size={40} strokeWidth={1.5}/>, Plane:<Plane size={40} strokeWidth={1.5}/>
};
const DICE_KEYS = Object.keys(DICE_MAP);

// Versión pequeña para el historial
const DICE_MAP_SM = Object.fromEntries(
    Object.entries(DICE_MAP).map(([k]) => [k,
        React.cloneElement(DICE_MAP[k], { size: 28 })
    ])
);

const generarDados = () => [
    DICE_KEYS[Math.floor(Math.random() * DICE_KEYS.length)],
    DICE_KEYS[Math.floor(Math.random() * DICE_KEYS.length)],
];

const GEN_CODE = () =>
    Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

const OPCIONES_TIEMPO = [
    { label: 'Sin límite', value: 0 },
    { label: '30 segundos', value: 30 },
    { label: '1 minuto', value: 60 },
    { label: '1 min 30 s', value: 90 },
    { label: '2 minutos', value: 120 },
    { label: '3 minutos', value: 180 },
];

// ─── COUNTDOWN HOOK ────────────────────────────────────────────────────────────
function useCountdown(dadosTiradosAt, tiempoPorJugador, onExpire) {
    const [remaining, setRemaining] = useState(null);
    const expiredRef = useRef(false);

    useEffect(() => {
        if (!dadosTiradosAt || !tiempoPorJugador) { setRemaining(null); return; }
        expiredRef.current = false;

        const tick = () => {
            const elapsed = (Date.now() - dadosTiradosAt) / 1000;
            const left = Math.max(0, tiempoPorJugador - elapsed);
            setRemaining(Math.ceil(left));
            if (left <= 0 && !expiredRef.current) {
                expiredRef.current = true;
                onExpire();
            }
        };
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dadosTiradosAt, tiempoPorJugador]);

    return remaining;
}

// ─── MODAL ENVIAR AL PROFESOR ─────────────────────────────────────────────────
function ModalEnviarProfe({ historia, jugadores, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso,  setCurso]  = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }

            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'STORYCUBES',
                modalidad: 'Colaborativo Online',
                fecha: new Date(),
                codigoProfesor: code,
                recursoId: 'storycubes',
                recursoTitulo: 'Story Cubes',
                nombreEnviador: nombre.trim(),
                cursoEnviador: curso.trim(),
                // Historia completa en orden
                historia: historia.map(seg => ({
                    autor: seg.nombre,
                    dados: seg.dados,
                    texto: seg.texto || '(sin texto)',
                })),
                jugadores: jugadores.map(j => j.nombre),
                // Texto plano legible para el profesor
                historiaTexto: historia.map(seg =>
                    `[${seg.dados.join(' · ')}]\n${seg.nombre}: ${seg.texto || '(sin texto)'}`
                ).join('\n\n'),
            });
            guardarRegistroLocal('STORYCUBES', {
                titulo: 'Story Cubes', nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) {
            console.error(e);
            setError('Error al enviar: ' + e.message);
        }
        setEnviando(false);
    };

    const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'2px solid #bdc3c7', fontSize:'1rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' };

    return (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:420, padding:28 }}>
                <h3 style={{ margin:'0 0 16px', color:'#2c3e50' }}>📤 Enviar Historia al Profesor</h3>
                {enviado ? (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                        <CheckCircle size={50} color="#27ae60" style={{ marginBottom:10 }}/>
                        <div style={{ color:'#27ae60', fontWeight:'bold', fontSize:'1.1rem' }}>¡Historia enviada con éxito!</div>
                        <div style={{ color:'#7f8c8d', fontSize:'0.85rem', marginTop:8 }}>{historia.length} segmentos · {jugadores.length} autores</div>
                        <button onClick={onClose} style={{ marginTop:20, padding:'10px 24px', borderRadius:10, border:'none', background:'#ecf0f1', cursor:'pointer', fontWeight:'bold' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        <div style={{ background:'#f8f9fa', padding:12, borderRadius:8, fontSize:'0.88rem', color:'#555' }}>
                            Se enviará la historia completa con <strong>{historia.length} fragmentos</strong> de <strong>{jugadores.length} autores</strong>.
                        </div>
                        {[
                            ['Tu nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                            ['Curso', curso, setCurso, 'Ej: 3º ESO A', false],
                            ['Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true],
                        ].map(([label, val, setter, ph, mono], i) => (
                            <div key={i}>
                                <label style={{ fontSize:'0.78rem', fontWeight:'bold', color:'#7f8c8d', display:'block', marginBottom:4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                                    style={{ ...inp, letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400, textTransform: mono ? 'uppercase' : 'none' }}/>
                            </div>
                        ))}
                        {error && <div style={{ color:'#e74c3c', fontSize:'0.85rem' }}>⚠ {error}</div>}
                        <div style={{ display:'flex', gap:10, marginTop:6 }}>
                            <button onClick={onClose} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid #bdc3c7', background:'white', cursor:'pointer' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:12, borderRadius:10, border:'none', background: enviando ? '#95a5a6' : '#3498db', color:'white', fontWeight:'bold', cursor: enviando ? 'default' : 'pointer' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar Historia'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── BARRA DE CUENTA ATRÁS ────────────────────────────────────────────────────
function CountdownBar({ remaining, total }) {
    if (remaining === null || !total) return null;
    const pct = Math.max(0, remaining / total) * 100;
    const color = pct > 50 ? '#27ae60' : pct > 25 ? '#f39c12' : '#e74c3c';
    return (
        <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, color, fontWeight:'bold', fontSize:'0.9rem' }}>
                    <Timer size={15}/> {remaining}s restantes
                </div>
                <div style={{ fontSize:'0.78rem', color:'#95a5a6' }}>Tiempo máximo: {total}s</div>
            </div>
            <div style={{ height:6, background:'#ecf0f1', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.5s linear' }}/>
            </div>
        </div>
    );
}

// ─── SALA DE JUEGO ────────────────────────────────────────────────────────────
function SalaStoryCubes({ codigoSala, nombreJugador, usuarioUid, onExit }) {
    const [roomData,      setRoomData]      = useState(null);
    const [miTexto,       setMiTexto]       = useState('');
    const [dadosTirados,  setDadosTirados]  = useState(false);
    const [animando,      setAnimando]      = useState(false);
    const [mostrarEnvio,  setMostrarEnvio]  = useState(false);

    // Ref del texto para el auto-submit del timer (evita closure stale)
    const miTextoRef  = useRef('');
    const submitRef   = useRef(null);
    const onExitRef   = useRef(onExit);
    useEffect(() => { onExitRef.current = onExit; }, [onExit]);

    const myUid = useRef(usuarioUid).current;

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
            if (!snap.exists()) { alert('La sala ya no existe.'); onExitRef.current(); return; }
            const data = snap.data();
            setRoomData(data);

            // Unirse automáticamente si estoy en LOBBY y no estoy ya en la lista
            const yaEstoy = (data.jugadores || []).some(j => j.uid === myUid);
            if (data.estado === 'LOBBY' && !yaEstoy) {
                await updateDoc(doc(db, 'live_games', codigoSala), {
                    jugadores: arrayUnion({ uid: myUid, nombre: nombreJugador }),
                });
            }
        });
        return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoSala, myUid]);

    // Valores derivados con fallback para que los hooks siempre se llamen en el mismo orden
    const isHost           = roomData?.hostUid === myUid;
    const jugadores        = roomData?.jugadores || [];
    const historia         = roomData?.historia  || [];
    const turnoActual      = roomData?.turnoIndex || 0;
    const jugadorActivo    = jugadores[turnoActual];
    const esMiTurno        = jugadorActivo?.uid === myUid;
    const terminado        = roomData?.estado === 'FINISHED';
    const tiempoPorJugador = roomData?.tiempoPorJugador || 0;

    // ── Acciones ──────────────────────────────────────────────────────────────

    const iniciarJuego = async (tiempoElegido) => {
        await updateDoc(doc(db, 'live_games', codigoSala), {
            estado: 'PLAYING',
            turnoIndex: 0,
            historia: [],
            dadosActivos: null,
            dadosTiradosAt: null,
            tiempoPorJugador: tiempoElegido,
        });
    };

    const tirarMisDados = async () => {
        setAnimando(true);
        const nuevosDados = generarDados();
        setTimeout(async () => {
            await updateDoc(doc(db, 'live_games', codigoSala), {
                dadosActivos: nuevosDados,
                dadosTiradosAt: Date.now(),
            });
            setDadosTirados(true);
            setAnimando(false);
        }, 800);
    };

    const enviarParte = useCallback(async (textoForzado) => {
        const texto = typeof textoForzado === 'string' ? textoForzado : miTextoRef.current;
        const nuevoSegmento = {
            uid: myUid,
            nombre: nombreJugador,
            texto: texto.trim(),
            dados: roomData?.dadosActivos || [],
        };
        const nuevaHistoria = [...historia, nuevoSegmento];
        const proximoTurno  = turnoActual + 1;
        const fin           = proximoTurno >= jugadores.length;

        await updateDoc(doc(db, 'live_games', codigoSala), {
            historia: nuevaHistoria,
            turnoIndex: proximoTurno,
            dadosActivos: null,
            dadosTiradosAt: null,
            estado: fin ? 'FINISHED' : 'PLAYING',
        });

        setMiTexto('');
        miTextoRef.current = '';
        setDadosTirados(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historia, jugadores.length, myUid, nombreJugador, roomData?.dadosActivos, turnoActual, codigoSala]);

    // Guardamos la referencia para el timer
    submitRef.current = enviarParte;

    const forzarSiguiente = async () => {
        if (!window.confirm('¿Saltar el turno de este jugador?')) return;
        const proximo = turnoActual + 1;
        await updateDoc(doc(db, 'live_games', codigoSala), {
            turnoIndex: proximo,
            dadosActivos: null,
            dadosTiradosAt: null,
            estado: proximo >= jugadores.length ? 'FINISHED' : 'PLAYING',
        });
    };

    // ── Countdown — siempre se llama, con null cuando no aplica ──
    const remaining = useCountdown(
        esMiTurno && dadosTirados ? roomData?.dadosTiradosAt : null,
        tiempoPorJugador,
        () => submitRef.current?.(miTextoRef.current),
    );

    // Early return DESPUÉS de todos los hooks
    if (!roomData) return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#2c3e50', color:'white', fontSize:'1.1rem' }}>
            Cargando sala…
        </div>
    );

    // ── LOBBY ─────────────────────────────────────────────────────────────────
    if (roomData.estado === 'LOBBY') {
        return <LobbyView
            codigoSala={codigoSala}
            jugadores={jugadores}
            myUid={myUid}
            hostUid={roomData.hostUid}
            isHost={isHost}
            onIniciar={iniciarJuego}
            onExit={onExit}
        />;
    }

    // ── JUEGO / FIN ───────────────────────────────────────────────────────────
    return (
        <div style={st.containerGame}>
            {terminado && <Confetti recycle={false} numberOfPieces={300}/>}

            {/* Cabecera */}
            <div style={st.headerBar}>
                <button onClick={onExit} style={st.btnHeader}><ArrowLeft size={16}/> Salir</button>
                <div style={{ fontWeight:'bold', color:'white', fontSize:'1.1rem', display:'flex', alignItems:'center', gap:8 }}>
                    <Dices size={20}/> Story Cubes
                </div>
                <div style={{ background:'rgba(255,255,255,0.15)', padding:'4px 12px', borderRadius:20, color:'white', fontSize:'0.85rem', fontWeight:'bold' }}>
                    Sala: {codigoSala}
                </div>
            </div>

            <div style={st.mainLayout}>
                {/* ── Columna izquierda: historia ── */}
                <div style={st.storyBoard}>
                    <h3 style={{ margin:'0 0 20px', color:'#2c3e50', fontSize:'1.1rem', fontWeight:800, letterSpacing:0.5 }}>
                        📖 Historia en construcción
                    </h3>
                    {historia.length === 0 ? (
                        <div style={{ textAlign:'center', padding:40, color:'#95a5a6', fontStyle:'italic' }}>
                            Érase una vez…<br/>La historia está esperando al primer escritor.
                        </div>
                    ) : (
                        historia.map((seg, idx) => (
                            <div key={idx} style={st.storySegment}>
                                <div style={st.segmentAuthor}>✍️ {seg.nombre}</div>
                                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                                    {/* Dados */}
                                    <div style={st.diceColumn}>
                                        {seg.dados.map((d, i) => (
                                            <div key={i} style={st.diceSmall}>{DICE_MAP_SM[d]}</div>
                                        ))}
                                    </div>
                                    {/* Texto */}
                                    <div style={st.segmentText}>
                                        {seg.texto || <em style={{ color:'#bdc3c7' }}>(sin texto)</em>}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {terminado && (
                        <div style={{ textAlign:'center', marginTop:24, padding:20, background:'#e8f8f5', borderRadius:14, border:'2px dashed #1abc9c' }}>
                            <div style={{ fontSize:'2rem', marginBottom:8 }}>🏁</div>
                            <h2 style={{ color:'#16a085', margin:'0 0 6px' }}>¡Historia completada!</h2>
                            <p style={{ color:'#2c3e50', margin:0, fontSize:'0.9rem' }}>
                                {jugadores.length} autores · {historia.length} fragmentos
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Columna derecha: acción ── */}
                <div style={st.actionPanel}>
                    {terminado ? (
                        <div style={{ textAlign:'center', padding:20 }}>
                            <Book size={55} color="#8e44ad" style={{ marginBottom:14 }}/>
                            <h3 style={{ color:'#2c3e50', margin:'0 0 8px' }}>Obra completada</h3>
                            <p style={{ color:'#7f8c8d', fontSize:'0.88rem', marginBottom:24 }}>
                                Podéis leer la historia completa en el panel izquierdo.
                            </p>
                            {isHost && (
                                <button onClick={() => setMostrarEnvio(true)} style={{ ...st.btnPrimario, width:'100%', marginBottom:10 }}>
                                    <Send size={16}/> Enviar al Profesor
                                </button>
                            )}
                            <button onClick={onExit} style={{ ...st.btnSecundario, width:'100%' }}>Volver al Menú</button>
                        </div>
                    ) : esMiTurno ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:14, height:'100%' }}>
                            <div style={{ background:'#27ae60', color:'white', padding:'10px 14px', borderRadius:10, textAlign:'center', fontWeight:'bold', fontSize:'1rem', boxShadow:'0 4px 12px rgba(39,174,96,0.3)' }}>
                                ¡Es tu turno!
                            </div>

                            {!dadosTirados ? (
                                <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:20 }}>
                                    <div style={{ fontSize:'3.5rem', animation: animando ? 'spin 0.4s infinite linear' : 'none' }}>🎲</div>
                                    <button onClick={tirarMisDados} disabled={animando}
                                        style={{ ...st.btnPrimario, width:'100%', padding:18, fontSize:'1.1rem', background: animando ? '#95a5a6' : '#8e44ad' }}>
                                        {animando ? 'Tirando dados…' : '🎲 Tirar Dados'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
                                    {/* Cuenta atrás */}
                                    <CountdownBar remaining={remaining} total={tiempoPorJugador}/>

                                    <div style={{ textAlign:'center', fontSize:'0.85rem', color:'#7f8c8d' }}>
                                        Tus dados — inspírate:
                                    </div>
                                    <div style={{ display:'flex', justifyContent:'center', gap:16 }}>
                                        {roomData.dadosActivos?.map((d, i) => (
                                            <div key={i} style={st.diceBox}>
                                                {DICE_MAP[d]}
                                                <div style={{ fontSize:'0.65rem', color:'#95a5a6', marginTop:4, textTransform:'uppercase' }}>{d}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <textarea
                                        autoFocus
                                        value={miTexto}
                                        onChange={e => { setMiTexto(e.target.value); miTextoRef.current = e.target.value; }}
                                        placeholder="Escribe tu parte de la historia…"
                                        style={st.textArea}
                                    />

                                    <button onClick={() => enviarParte()} style={{ ...st.btnPrimario, width:'100%' }}>
                                        Pasar al siguiente →
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ textAlign:'center', padding:30 }}>
                            <div style={{ fontSize:'2.5rem', marginBottom:16 }}>⏳</div>
                            <h3 style={{ color:'#2c3e50', margin:'0 0 8px' }}>Turno de {jugadorActivo?.nombre}</h3>
                            <p style={{ color:'#7f8c8d', fontSize:'0.9rem' }}>
                                Está escribiendo su parte de la historia…
                            </p>

                            {/* Progreso de turnos */}
                            <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:6 }}>
                                {jugadores.map((j, i) => {
                                    const hecho    = i < turnoActual;
                                    const activo   = i === turnoActual;
                                    const pendiente = i > turnoActual;
                                    return (
                                        <div key={j.uid} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8,
                                            background: activo ? '#fef9e7' : hecho ? '#eafaf1' : '#f8f9fa',
                                            border: activo ? '1.5px solid #f39c12' : hecho ? '1.5px solid #2ecc71' : '1.5px solid #ecf0f1',
                                            fontSize:'0.88rem', color:'#2c3e50' }}>
                                            <span>{hecho ? '✅' : activo ? '✍️' : '⬜'}</span>
                                            <span style={{ flex:1, textAlign:'left', fontWeight: activo ? 700 : 400 }}>{j.nombre}</span>
                                            {pendiente && <span style={{ color:'#bdc3c7', fontSize:'0.78rem' }}>en espera</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {isHost && (
                                <button onClick={forzarSiguiente}
                                    style={{ marginTop:24, background:'transparent', border:'1px solid #e74c3c', color:'#e74c3c', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:'0.85rem' }}>
                                    Saltar turno (Solo creador)
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

            {mostrarEnvio && (
                <ModalEnviarProfe
                    historia={historia}
                    jugadores={jugadores}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function LobbyView({ codigoSala, jugadores, myUid, hostUid, isHost, onIniciar, onExit }) {
    const [tiempoElegido, setTiempoElegido] = useState(60);

    return (
        <div style={st.container}>
            <div style={st.card}>
                <div style={{ textAlign:'center', marginBottom:20 }}>
                    <Dices size={48} color="#8e44ad" style={{ marginBottom:8 }}/>
                    <h2 style={{ margin:0, color:'#2c3e50', fontSize:'1.8rem' }}>Story Cubes</h2>
                    <p style={{ color:'#7f8c8d', margin:'4px 0 0' }}>Sala de espera</p>
                </div>

                {/* Código */}
                <div style={{ background:'#f4f6f8', padding:'16px 20px', borderRadius:14, textAlign:'center', marginBottom:20 }}>
                    <div style={{ fontSize:'0.8rem', color:'#7f8c8d', textTransform:'uppercase', fontWeight:'bold', letterSpacing:1 }}>Código de Sala</div>
                    <div style={{ fontSize:'2.8rem', fontWeight:'bold', color:'#2c3e50', letterSpacing:6, fontFamily:'monospace' }}>{codigoSala}</div>
                    <div style={{ fontSize:'0.8rem', color:'#95a5a6', marginTop:4 }}>Comparte este código con tus compañeros</div>
                </div>

                {/* Jugadores */}
                <h4 style={{ color:'#2c3e50', borderBottom:'2px solid #ecf0f1', paddingBottom:8, margin:'0 0 12px' }}>
                    Escritores unidos ({jugadores.length})
                </h4>
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:180, overflowY:'auto', marginBottom:20 }}>
                    {jugadores.map((j, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                            background: j.uid === myUid ? '#eaf4fd' : '#fff',
                            border:`1px solid ${j.uid === myUid ? '#3498db' : '#ecf0f1'}`,
                            borderRadius:10, fontSize:'0.95rem', color:'#34495e' }}>
                            <User size={18} color={j.uid === myUid ? '#3498db' : '#95a5a6'}/>
                            <span style={{ flex:1, fontWeight: j.uid === myUid ? 700 : 400 }}>{j.nombre}</span>
                            {j.uid === hostUid && (
                                <span style={{ fontSize:'0.75rem', background:'#f1c40f', color:'#856404', padding:'2px 8px', borderRadius:10 }}>Creador</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Tiempo por jugador (solo host) */}
                {isHost && (
                    <div style={{ marginBottom:20 }}>
                        <label style={{ fontSize:'0.82rem', fontWeight:'bold', color:'#7f8c8d', display:'block', marginBottom:6 }}>
                            <Timer size={13} style={{ verticalAlign:'middle', marginRight:4 }}/>
                            Tiempo para escribir por jugador
                        </label>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {OPCIONES_TIEMPO.map(op => (
                                <button key={op.value} onClick={() => setTiempoElegido(op.value)}
                                    style={{ padding:'7px 14px', borderRadius:20, border:`2px solid ${tiempoElegido === op.value ? '#8e44ad' : '#ecf0f1'}`,
                                        background: tiempoElegido === op.value ? '#8e44ad' : 'white',
                                        color: tiempoElegido === op.value ? 'white' : '#7f8c8d',
                                        fontWeight:'bold', cursor:'pointer', fontSize:'0.82rem' }}>
                                    {op.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                    <button onClick={onExit} style={st.btnSecundario}>Salir</button>
                    {isHost ? (
                        <button onClick={() => onIniciar(tiempoElegido)} disabled={jugadores.length < 1}
                            style={{ ...st.btnPrimario, flex:2, background:'#8e44ad' }}>
                            <Play size={16}/> Iniciar Historia
                        </button>
                    ) : (
                        <div style={{ flex:2, textAlign:'center', padding:14, background:'#f4f6f8', color:'#7f8c8d', borderRadius:10, fontSize:'0.9rem', fontWeight:'bold' }}>
                            Esperando al creador…
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── PANTALLA PRINCIPAL (MENÚ) ────────────────────────────────────────────────
export default function StoryCubes({ onExit, usuario }) {
    const [pantalla,    setPantalla]    = useState('MENU');
    const [codigoSala,  setCodigoSala]  = useState('');
    const [inputCodigo, setInputCodigo] = useState('');
    const [nombreTemp,  setNombreTemp]  = useState('');

    // Nombre efectivo — usa displayName del usuario o el nombre temporal escrito
    const nombreEfectivo = usuario?.displayName || nombreTemp.trim() || '';
    const usuarioUid     = usuario?.uid || null;

    // UID estable para invitados — se genera una sola vez y se reutiliza en crear y unirse
    const guestUidRef    = useRef('guest_' + Math.random().toString(36).slice(2, 10));
    const myEffectiveUid = usuarioUid || guestUidRef.current;

    const crearSala = async () => {
        if (!usuario?.displayName && !nombreTemp.trim()) {
            alert('Escribe tu nombre antes de crear una sala.');
            return;
        }
        const codigo = GEN_CODE();

        await setDoc(doc(db, 'live_games', codigo), {
            tipoJuego: 'STORYCUBES',
            estado: 'LOBBY',
            hostUid: myEffectiveUid,
            turnoIndex: 0,
            historia: [],
            dadosActivos: null,
            dadosTiradosAt: null,
            tiempoPorJugador: 60,
            jugadores: [{ uid: myEffectiveUid, nombre: nombreEfectivo || 'Escritor Anónimo' }],
        });

        setCodigoSala(codigo);
        setPantalla('ROOM');
    };

    const unirseSala = () => {
        const cod = inputCodigo.trim().toUpperCase();
        if (cod.length !== 6) { alert('El código debe tener 6 caracteres.'); return; }
        if (!usuario?.displayName && !nombreTemp.trim()) { alert('Escribe tu nombre antes de unirte.'); return; }
        setCodigoSala(cod);
        setPantalla('ROOM');
    };

    if (pantalla === 'ROOM') {
        return (
            <SalaStoryCubes
                codigoSala={codigoSala}
                nombreJugador={nombreEfectivo || 'Escritor Anónimo'}
                usuarioUid={myEffectiveUid}
                onExit={() => setPantalla('MENU')}
            />
        );
    }

    return (
        <div style={st.container}>
            <div style={st.card}>
                <button onClick={onExit} style={{ background:'transparent', border:'none', color:'#95a5a6', cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginBottom:20, fontWeight:'bold', fontSize:'0.9rem' }}>
                    <ArrowLeft size={15}/> Volver al Menú
                </button>

                <div style={{ textAlign:'center', marginBottom:28 }}>
                    <div style={{ background:'#8e44ad', width:76, height:76, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 10px 24px rgba(142,68,173,0.4)' }}>
                        <Dices size={42} color="white"/>
                    </div>
                    <h1 style={{ color:'#2c3e50', margin:'0 0 8px', fontSize:'2.2rem' }}>Story Cubes</h1>
                    <p style={{ color:'#7f8c8d', fontSize:'1rem', margin:0 }}>Crea historias increíbles en equipo, cada uno con sus dados.</p>
                </div>

                {!usuario?.displayName && (
                    <div style={{ marginBottom:16 }}>
                        <label style={{ fontSize:'0.8rem', fontWeight:'bold', color:'#7f8c8d', display:'block', marginBottom:5 }}>Tu nombre</label>
                        <input type="text" placeholder="Nombre y apellido…" value={nombreTemp}
                            onChange={e => setNombreTemp(e.target.value)}
                            style={{ ...st.input, width:'100%' }}/>
                    </div>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <button onClick={crearSala} style={{ ...st.btnPrimario, background:'#8e44ad', fontSize:'1.1rem', padding:16 }}>
                        ✨ Crear Nueva Historia
                    </button>

                    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0' }}>
                        <div style={{ flex:1, height:1, background:'#ecf0f1' }}/>
                        <div style={{ color:'#bdc3c7', fontSize:'0.82rem', fontWeight:'bold' }}>O UNIRSE A UNA EXISTENTE</div>
                        <div style={{ flex:1, height:1, background:'#ecf0f1' }}/>
                    </div>

                    <div style={{ display:'flex', gap:10 }}>
                        <input type="text" placeholder="Código de 6 letras…" value={inputCodigo}
                            onChange={e => setInputCodigo(e.target.value.toUpperCase())}
                            maxLength={6}
                            style={{ ...st.input, flex:1, letterSpacing:3, textAlign:'center', fontWeight:'bold', textTransform:'uppercase' }}/>
                        <button onClick={unirseSala} style={st.btnPrimario}>Unirse</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const st = {
    container:    { minHeight:'100vh', background:'linear-gradient(135deg,#2c3e50,#8e44ad)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Georgia',serif" },
    containerGame:{ minHeight:'100vh', background:'#f4f6f8', display:'flex', flexDirection:'column', fontFamily:"'Georgia',serif" },
    card:         { background:'white', borderRadius:20, padding:36, width:'100%', maxWidth:500, boxShadow:'0 20px 50px rgba(0,0,0,0.3)' },

    headerBar: { background:'#2c3e50', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 },
    btnHeader: { background:'rgba(255,255,255,0.1)', border:'none', color:'white', padding:'7px 14px', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontWeight:'bold', fontSize:'0.9rem' },

    mainLayout: { display:'flex', flex:1, overflow:'hidden', flexWrap:'wrap' },

    storyBoard:   { flex:2, minWidth:280, padding:'24px 28px', overflowY:'auto', background:'white', borderRight:'2px solid #ecf0f1' },
    storySegment: { marginBottom:22, background:'#fafafa', padding:'16px 18px', borderRadius:14, borderLeft:'5px solid #8e44ad', boxShadow:'0 2px 6px rgba(0,0,0,0.04)' },
    segmentAuthor:{ fontSize:'0.82rem', color:'#8e44ad', fontWeight:'bold', marginBottom:10, textTransform:'uppercase', letterSpacing:0.8 },
    segmentText:  { fontSize:'1.1rem', color:'#2c3e50', lineHeight:1.8, whiteSpace:'pre-wrap' },
    diceColumn:   { display:'flex', flexDirection:'column', gap:6, flexShrink:0 },
    diceSmall:    { background:'white', border:'1.5px solid #ecf0f1', borderRadius:8, padding:4, display:'flex', alignItems:'center', justifyContent:'center', color:'#2c3e50' },

    actionPanel: { flex:1, minWidth:280, maxWidth:460, background:'#fcfcfc', padding:'24px 22px', display:'flex', flexDirection:'column', overflowY:'auto' },

    diceBox: { width:76, height:76, background:'white', borderRadius:14, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'2.5px solid #bdc3c7', boxShadow:'0 6px 14px rgba(0,0,0,0.08)' },
    textArea: { flex:1, minHeight:140, padding:14, borderRadius:10, border:'2px solid #bdc3c7', fontSize:'1.05rem', fontFamily:"'Georgia',serif", resize:'none', outline:'none', color:'#2c3e50', lineHeight:1.6 },

    input:       { padding:'12px 14px', borderRadius:10, border:'2px solid #ecf0f1', fontSize:'1rem', outline:'none', boxSizing:'border-box', fontFamily:"'Georgia',serif" },
    btnPrimario: { background:'#3498db', color:'white', border:'none', padding:'13px 18px', borderRadius:10, fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:'0.95rem' },
    btnSecundario:{ background:'#ecf0f1', color:'#7f8c8d', border:'none', padding:'13px 18px', borderRadius:10, fontWeight:'bold', cursor:'pointer', fontSize:'0.95rem' },
};
