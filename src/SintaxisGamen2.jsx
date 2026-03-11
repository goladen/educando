import React, { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { CheckCircle, XCircle, RotateCcw, Play, Trophy, PaintBucket, ArrowRight,
         BookOpen, ChevronRight, Search, Key, ChevronDown, ChevronUp, Clock,
         Users, AlertTriangle } from 'lucide-react';
import { CATEGORIAS, NIVELES, FRASES } from './BibliotecaFrases';



// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────
const generarCodigo = () =>
    Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

const cleanText = (str) =>
    String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const checkFuzzy = (text, search) => {
    const t = cleanText(text), s = cleanText(search);
    if (!t || !s) return false;
    if (t.includes(s) || s.includes(t)) return true;
    const len = Math.max(t.length, s.length);
    if (len === 0) return true;
    const dist = (() => {
        const a = [], sl = s.length, tl = t.length;
        for (let i = 0; i <= sl; i++) { a[i] = [i]; for (let j = 1; j <= tl; j++) a[i][j] = i === 0 ? j : Math.min(a[i-1][j]+1, a[i][j-1]+1, a[i-1][j-1]+(s[i-1]===t[j-1]?0:1)); }
        return a[sl][tl];
    })();
    return 1 - dist / len >= 0.8;
};

// Obtiene el pool de frases según nivel/recurso
const getPool = (nivelId, recurso) => {
    if (recurso?.frases?.length) return recurso.frases;
    return FRASES.filter(f => !nivelId || f.nivel === nivelId);
};

// Anti-repetición bag
const createBag = (pool) => ({ ids: pool.map(f => f.id || f._idx), used: new Set() });
const pickFromBag = (bag, pool) => {
    let avail = bag.ids.filter(id => !bag.used.has(id));
    if (!avail.length) { bag.used.clear(); avail = bag.ids; }
    const id = avail[Math.floor(Math.random() * avail.length)];
    bag.used.add(id);
    return pool.find(f => (f.id || f._idx) === id);
};

// Para el modo primaria: sólo categorías presentes en la frase
const getCatsEnFrase = (tokens) => {
    const s = new Set();
    tokens.forEach(t => (t.funcion || []).forEach(f => s.add(f)));
    return s;
};

// Cálculo de fondo gradiente para token
const tokenBg = (ans) => {
    if (!ans?.length) return 'transparent';
    if (ans.length === 1) return CATEGORIAS[ans[0]]?.color || 'transparent';
    return `linear-gradient(135deg, ${CATEGORIAS[ans[0]]?.color} 50%, ${CATEGORIAS[ans[1]]?.color} 50%)`;
};
const correctBg = (esp) => {
    if (!esp?.length) return '#ccc';
    if (esp.length === 1) return CATEGORIAS[esp[0]]?.color || '#ccc';
    return `linear-gradient(135deg, ${CATEGORIAS[esp[0]]?.color} 50%, ${CATEGORIAS[esp[1]]?.color} 50%)`;
};

// Nombre del nivel seleccionado
const nivelLabel = (nivelId, recurso) => {
    if (recurso) return `Personal`;
    if (!nivelId) return 'Todos';
    return NIVELES.find(n => n.id === nivelId)?.label || nivelId;
};

// Tiempo formateado mm:ss
const fmtTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

// ─────────────────────────────────────────────────────────────────────
// MAIN EXPORT — ROUTER
// ─────────────────────────────────────────────────────────────────────
export default function SintaxisGame({ onExit, isHost, codigoSala, usuario, recurso }) {
    if (isHost) return <SintaxisLiveHost codigoSala={codigoSala} usuario={usuario} onExit={onExit} />;
    if (codigoSala) return <SintaxisLiveClient codigoSala={codigoSala} usuario={usuario} onExit={onExit} />;
    return <SintaxisApp onExit={onExit} recursoInicial={recurso} />;
}

// ─────────────────────────────────────────────────────────────────────
// APP CONTAINER (gestiona pantallas locales + entrada al modo online)
// ─────────────────────────────────────────────────────────────────────
function SintaxisApp({ onExit, recursoInicial}) {
    const [screen, setScreen] = useState(recursoInicial ? 'MODOS' : 'NIVEL');
    const [nivelSel, setNivelSel] = useState(null);
    const [recurso, setRecurso] = useState(recursoInicial || null);
    const [internalHost, setInternalHost] = useState(null);
    const [internalClient, setInternalClient] = useState(null);
    const [joinCode, setJoinCode]       = useState('');
    const [showLiveConfig, setShowLiveConfig] = useState(false);
    const [liveConfig, setLiveConfig]   = useState({ tiempoPregunta: 30, numPreguntas: 8, puntosMax: 100, puntosMin: 50 });
    const [creandoSala, setCreandoSala] = useState(false);

    const handleExit = () => typeof onExit === 'function' ? onExit() : (window.location.href = 'https://www.pikt.es');

    const crearSala = async () => {
        setCreandoSala(true);
        try {
            const codigo = generarCodigo();
            const pool = getPool(nivelSel, recurso);
            const bag = createBag(pool);
            const preguntas = Array.from({ length: liveConfig.numPreguntas }, (_, i) => {
                const f = pickFromBag(bag, pool);
                return { tokens: f.tokens, nivel: f.nivel || nivelSel || 'eso', fid: f.id || i };
            });
            await setDoc(doc(db, 'live_games', codigo), {
                tipoJuego: 'SINTAXIS', estado: 'LOBBY', fasePregunta: 'RESPONDING',
                jugadores: {}, preguntas, indicePregunta: 0, respuestasRonda: {},
                questionStartTime: null, config: liveConfig, catStats: {}, creadoEn: Date.now(),
            });
            setShowLiveConfig(false);
            setInternalHost(codigo);
        } catch (e) { console.error(e); alert('Error al crear sala. Comprueba la conexión.'); }
        setCreandoSala(false);
    };

    const unirse = () => {
        const c = joinCode.trim().toUpperCase();
        if (c.length !== 6) return alert('El código debe tener 6 caracteres.');
        setInternalClient(c);
    };

    if (internalHost)   return <SintaxisLiveHost   codigoSala={internalHost}   onExit={() => setInternalHost(null)} />;
    if (internalClient) return <SintaxisLiveClient codigoSala={internalClient} onExit={() => setInternalClient(null)} />;

    if (screen === 'LOCAL')          return <ModoLocal         nivel={nivelSel} recurso={recurso} onBack={() => setScreen('MODOS')} />;
    if (screen === 'CONTRARRELOJ')   return <ModoContrarreloj  nivel={nivelSel} recurso={recurso} onBack={() => setScreen('MODOS')} />;
    if (screen === 'DUAL')           return <ModoDual          nivel={nivelSel} recurso={recurso} onBack={() => setScreen('MODOS')} />;

    if (screen === 'MODOS') return (
        <PantallaModos
            nivelSel={nivelSel} recurso={recurso}
            onBack={() => setScreen('NIVEL')}
            onLocal={() => setScreen('LOCAL')}
            onContrarreloj={() => setScreen('CONTRARRELOJ')}
            onDual={() => setScreen('DUAL')}
            onLive={() => setShowLiveConfig(true)}
            joinCode={joinCode} setJoinCode={setJoinCode} onUnirse={unirse}
            showLiveConfig={showLiveConfig} setShowLiveConfig={setShowLiveConfig}
            liveConfig={liveConfig} setLiveConfig={setLiveConfig}
            crearSala={crearSala} creandoSala={creandoSala}
        />
    );

    return (
        <PantallaNivel
            nivelSel={nivelSel} setNivelSel={setNivelSel}
            recurso={recurso} setRecurso={setRecurso}
            joinCode={joinCode} setJoinCode={setJoinCode} onUnirse={unirse}
            onNext={() => setScreen('MODOS')}
            onExit={handleExit}
        />
    );
}

// ─────────────────────────────────────────────────────────────────────
// PANTALLA 1 — SELECCIÓN DE NIVEL / RECURSO
// ─────────────────────────────────────────────────────────────────────
function PantallaNivel({ nivelSel, setNivelSel, recurso, setRecurso, joinCode, setJoinCode, onUnirse, onNext, onExit }) {
    const [showSearch, setShowSearch] = useState(false);

    const selectNivel = (id) => { setNivelSel(id); setRecurso(null); setShowSearch(false); };
    const selectRecurso = (r) => { setRecurso(r); setNivelSel(null); setShowSearch(false); };

    const activeNivel = recurso ? '__recurso__' : nivelSel;

    return (
        <div style={g.container}>
            <div style={g.header}>
                <button onClick={onExit} style={g.btnBack}><RotateCcw size={16}/> Salir</button>
                <span style={g.titulo}>🪄 Análisis Sintáctico</span>
                <div style={{width:60}}/>
            </div>
            <div style={g.centerBox}>
                <div style={{...g.card, maxWidth:560}}>
                    <div style={{fontSize:'3rem',marginBottom:6}}>🪄</div>
                    <h1 style={g.cardTitle}>Elige el nivel</h1>
                    <p style={{color:'#666',fontSize:'0.88rem',marginBottom:20}}>
                        Selecciona un nivel para empezar o busca un recurso de tu profesor.
                    </p>

                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                        {NIVELES.map(n => (
                            <button key={String(n.id)} onClick={() => selectNivel(n.id)}
                                style={{
                                    padding:'13px 8px', borderRadius:14, cursor:'pointer',
                                    fontWeight:'bold', fontSize:'0.9rem', transition:'all 0.15s',
                                    background: activeNivel === n.id ? n.color : '#f5f5f5',
                                    color: activeNivel === n.id ? 'white' : '#444',
                                    border:`2px solid ${n.color}`,
                                }}>
                                {n.emoji} {n.label}
                                <div style={{fontSize:'0.68rem',opacity:.8,marginTop:2,fontWeight:'normal'}}>
                                    {FRASES.filter(f => !n.id || f.nivel === n.id).length} frases
                                </div>
                            </button>
                        ))}

                        {/* Buscar Recurso */}
                        <button onClick={() => setShowSearch(s => !s)}
                            style={{
                                gridColumn:'1/-1', padding:'13px 8px', borderRadius:14, cursor:'pointer',
                                fontWeight:'bold', fontSize:'0.9rem', transition:'all 0.15s',
                                background: activeNivel === '__recurso__' ? '#e67e22' : (showSearch ? '#fff3e0' : '#f5f5f5'),
                                color: activeNivel === '__recurso__' ? 'white' : '#e67e22',
                                border:'2px solid #e67e22',
                            }}>
                            <Search size={15} style={{verticalAlign:'middle',marginRight:5}}/>
                            {recurso ? `📄 ${recurso.titulo}` : 'Buscar Recurso del Profesor'}
                            {showSearch ? <ChevronUp size={14} style={{marginLeft:5}}/> : <ChevronDown size={14} style={{marginLeft:5}}/>}
                        </button>
                    </div>

                    {showSearch && (
                        <BuscadorRecursos onSelect={selectRecurso} />
                    )}

                    {/* Unirse a sesión */}
                    <div style={{borderTop:'2px dashed #eee',paddingTop:16,marginTop:8}}>
                        <p style={{color:'#888',fontSize:'0.78rem',marginBottom:8,textAlign:'center'}}>
                            ¿Tienes un código de sesión en vivo?
                        </p>
                        <div style={{display:'flex',gap:8}}>
                            <input
                                placeholder="CÓDIGO 6 LETRAS"
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                style={{
                                    flex:1, padding:'10px 14px', borderRadius:30, border:'2px solid #ccc',
                                    textAlign:'center', fontSize:'1rem', letterSpacing:3, textTransform:'uppercase',
                                    outline:'none', fontWeight:'bold',
                                }}
                            />
                            <button onClick={onUnirse} style={{...g.btnSuccess,padding:'10px 18px',margin:0}}>
                                Unirse
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={onNext}
                        disabled={nivelSel === undefined && !recurso}
                        style={{
                            ...g.btnPrimary, width:'100%', marginTop:20, justifyContent:'center',
                            opacity:(nivelSel !== undefined || recurso) ? 1 : 0.4,
                        }}>
                        <ChevronRight size={20}/> Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// BUSCADOR DE RECURSOS
// ─────────────────────────────────────────────────────────────────────
function BuscadorRecursos({ onSelect }) {
    const [filtros, setFiltros] = useState({ tema:'', ciclo:'', pais:'', region:'', poblacion:'', autor:'' });
    const [codigo, setCodigo]   = useState('');
    const [modoBusq, setModoBusq] = useState('FILTROS');
    const [masFiltros, setMasFiltros] = useState(false);
    const [buscando, setBuscando]   = useState(false);
    const [resultados, setResultados] = useState([]);
    const [errorPermisos, setErrorPermisos] = useState(false);

    const buscar = async () => {
        setBuscando(true);
        setResultados([]);
        setErrorPermisos(false);
        try {
            const ref = collection(db, 'resources');
            if (modoBusq === 'CODIGO' && codigo.trim()) {
                const q = query(ref, where('accessCode', '==', codigo.trim().toUpperCase()), where('tipoJuego', '==', 'SINTAXIS'));
                const snap = await getDocs(query(ref, where('tipoJuego', '==', 'SINTAXIS')));
                if (snap.empty) { alert('No se encontró ningún recurso con ese código.'); setBuscando(false); return; }
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setResultados(docs);
            } else {
                const snap = await getDocs(query(ref, where('tipoJuego', '==', 'SINTAXIS')));
                let todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                todos = todos.filter(r => {
                    if (filtros.ciclo && !checkFuzzy(r.ciclo, filtros.ciclo)) return false;
                    if (filtros.tema && !checkFuzzy(r.temas, filtros.tema) && !checkFuzzy(r.titulo, filtros.tema)) return false;
                    if (filtros.pais && !checkFuzzy(r.pais, filtros.pais)) return false;
                    if (filtros.region && !checkFuzzy(r.region, filtros.region)) return false;
                    if (filtros.poblacion && !checkFuzzy(r.poblacion, filtros.poblacion)) return false;
                    if (filtros.autor && !checkFuzzy(r.profesorNombre, filtros.autor)) return false;
                    return true;
                });
                if (!todos.length) alert('No se encontraron recursos con esos filtros.');
                setResultados(todos);
            }
        } catch (e) {
            console.error(e);
            if (e.code === 'permission-denied' || e.message?.includes('permissions')) {
                setErrorPermisos(true);
            } else {
                alert('Error de conexión. Comprueba tu red.');
            }
        }
        setBuscando(false);
    };

    return (
        <div style={{background:'#fff8f0',borderRadius:14,padding:'14px 16px',marginBottom:14,border:'2px solid #f0d0a0'}}>
            <h4 style={{margin:'0 0 10px',color:'#e67e22',fontSize:'0.9rem'}}>🔍 Buscar recurso del profesor</h4>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
                {['FILTROS','CODIGO'].map(m => (
                    <button key={m} onClick={() => setModoBusq(m)}
                        style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:'bold',fontSize:'0.8rem',
                            background: modoBusq === m ? '#e67e22' : '#eee', color: modoBusq === m ? 'white' : '#555'}}>
                        {m === 'FILTROS' ? <><Search size={12} style={{verticalAlign:'middle',marginRight:3}}/>Filtros</> : <><Key size={12} style={{verticalAlign:'middle',marginRight:3}}/>Código</>}
                    </button>
                ))}
            </div>

            {modoBusq === 'CODIGO' ? (
                <input placeholder="Código del recurso (ej: ABCDE)"
                    value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
                    style={{...g.inputSmall, width:'100%', textTransform:'uppercase', letterSpacing:2}}/>
            ) : (
                <div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <select style={g.inputSmall} value={filtros.ciclo} onChange={e => setFiltros({...filtros,ciclo:e.target.value})}>
                            <option value="">🎓 Cualquier ciclo</option>
                            <option>Infantil</option><option>Primaria</option>
                            <option>Secundaria</option><option>Bachillerato</option><option>Otros</option>
                        </select>
                        <input style={g.inputSmall} placeholder="Tema (ej: Literatura)"
                            value={filtros.tema} onChange={e => setFiltros({...filtros,tema:e.target.value})}/>
                    </div>
                    <button onClick={() => setMasFiltros(x=>!x)}
                        style={{background:'none',border:'none',color:'#e67e22',cursor:'pointer',fontSize:'0.78rem',marginTop:6,display:'flex',alignItems:'center',gap:4}}>
                        {masFiltros ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {masFiltros ? 'Menos filtros' : 'País, autor...'}
                    </button>
                    {masFiltros && (
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8,padding:10,background:'#f5f5f5',borderRadius:10}}>
                            {[['pais','País'],['region','Región'],['poblacion','Localidad'],['autor','Nombre del profesor']].map(([k,p]) => (
                                <input key={k} style={g.inputSmall} placeholder={p}
                                    value={filtros[k]} onChange={e => setFiltros({...filtros,[k]:e.target.value})}/>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <button onClick={buscar} disabled={buscando}
                style={{...g.btnPrimary, width:'100%', marginTop:10, justifyContent:'center', fontSize:'0.85rem', padding:'9px'}}>
                {buscando ? 'Buscando...' : 'Buscar'}
            </button>

            {errorPermisos && (
                <div style={{marginTop:12,background:'#fff3cd',border:'2px solid #f39c12',borderRadius:10,padding:'12px 14px',fontSize:'0.82rem',color:'#7d5a00'}}>
                    <strong>⚠️ La colección aún no tiene permisos de lectura.</strong><br/>
                    Añade esta regla en <strong>Firestore → Rules</strong>:
                    <pre style={{background:'#f5f5f5',borderRadius:8,padding:'8px',marginTop:8,fontSize:'0.75rem',overflowX:'auto',color:'#333',textAlign:'left'}}>
{`match /sintaxis_recursos/{doc} {
  allow read: if true;
  allow write: if request.auth != null;
}`}
                    </pre>
                </div>
            )}

            {resultados.length > 0 && (
                <div style={{marginTop:12,maxHeight:280,overflowY:'auto'}}>
                    {resultados.map(r => (
                        <div key={r.id} onClick={() => onSelect(r)}
                            style={{background:'white',borderRadius:10,padding:'10px 12px',marginBottom:8,cursor:'pointer',
                                border:'2px solid #f0d0a0',boxShadow:'0 2px 6px rgba(0,0,0,0.06)'}}>
                            <div style={{fontWeight:'bold',color:'#e67e22',fontSize:'0.9rem'}}>{r.titulo}</div>
                            <div style={{fontSize:'0.75rem',color:'#888',marginTop:4}}>
                                🎓 {r.ciclo || '—'} · 📚 {r.temas || '—'} · {r.frases?.length || 0} frases
                            </div>
                            <div style={{fontSize:'0.7rem',color:'#aaa',marginTop:2}}>
                                <Key size={10} style={{verticalAlign:'middle'}}/> {r.accessCode} · 👤 {r.profesorNombre}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// PANTALLA 2 — SELECCIÓN DE MODO
// ─────────────────────────────────────────────────────────────────────
function PantallaModos({ nivelSel, recurso, onBack, onLocal, onContrarreloj, onDual, onLive,
    joinCode, setJoinCode, onUnirse,
    showLiveConfig, setShowLiveConfig, liveConfig, setLiveConfig, crearSala, creandoSala }) {

    const nInfo = NIVELES.find(n => n.id === nivelSel);
    const titulo = recurso ? `Sintaxis Personal · ${recurso.titulo}` : `Sintaxis ${nivelLabel(nivelSel, recurso)}`;
    const accentColor = recurso ? '#e67e22' : (nInfo?.color || '#3498db');

    const modos = [
        {
            label: '📖 Empezar a Analizar',
            desc: 'Practica a tu ritmo. Una frase, coloréala y comprueba.',
            color: '#3498db', action: onLocal,
        },
        {
            label: '⏱️ Contrarreloj 180s',
            desc: 'Analiza el máximo de frases en 3 minutos.',
            color: '#e74c3c', action: onContrarreloj,
        },
        {
            label: '👥 Modo Dual',
            desc: 'Dos jugadores, dos frases distintas en la misma pantalla.',
            color: '#27ae60', action: onDual,
            warning: '⚠️ Diseñado para pantallas grandes',
        },
    ];

    return (
        <div style={g.container}>
            <div style={g.header}>
                <button onClick={onBack} style={g.btnBack}><RotateCcw size={16}/> Atrás</button>
                <span style={{...g.titulo, color: accentColor}}>{titulo}</span>
                <div style={{width:60}}/>
            </div>

            {showLiveConfig && (
                <ModalLiveConfig
                    config={liveConfig} setConfig={setLiveConfig}
                    onCancel={() => setShowLiveConfig(false)}
                    onCrear={crearSala} creando={creandoSala}
                />
            )}

            <div style={g.centerBox}>
                <div style={{...g.card, maxWidth:540}}>
                    <div style={{fontSize:'2.2rem',marginBottom:6}}>
                        {recurso ? '📄' : (nInfo?.emoji || '📚')}
                    </div>
                    <h1 style={{...g.cardTitle, color: accentColor}}>{titulo}</h1>
                    <p style={{color:'#888',fontSize:'0.85rem',marginBottom:22}}>Elige cómo quieres practicar</p>

                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        {modos.map(m => (
                            <button key={m.label} onClick={m.action}
                                style={{
                                    display:'flex',alignItems:'flex-start',gap:14,padding:'14px 16px',
                                    background:'white',border:`2px solid ${m.color}`,borderRadius:14,
                                    cursor:'pointer',textAlign:'left',transition:'transform 0.15s',
                                    boxShadow:'0 3px 10px rgba(0,0,0,0.06)',width:'100%',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                                <div style={{flex:1}}>
                                    <div style={{fontWeight:'bold',color:m.color,fontSize:'1rem'}}>{m.label}</div>
                                    <div style={{color:'#888',fontSize:'0.8rem',marginTop:2}}>{m.desc}</div>
                                    {m.warning && <div style={{color:'#f39c12',fontSize:'0.75rem',marginTop:3}}>{m.warning}</div>}
                                </div>
                            </button>
                        ))}

                        {/* Modo Online */}
                        <div style={{borderTop:'2px solid #eee',paddingTop:12,marginTop:4}}>
                            <button onClick={() => setShowLiveConfig(true)}
                                style={{
                                    display:'flex',alignItems:'flex-start',gap:14,padding:'14px 16px',
                                    background:'white',border:'2px solid #9b59b6',borderRadius:14,
                                    cursor:'pointer',textAlign:'left',transition:'transform 0.15s',
                                    boxShadow:'0 3px 10px rgba(0,0,0,0.06)',width:'100%',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                                <div style={{flex:1}}>
                                    <div style={{fontWeight:'bold',color:'#9b59b6',fontSize:'1rem'}}>📡 Lanzar Sesión en Vivo</div>
                                    <div style={{color:'#888',fontSize:'0.8rem',marginTop:2}}>Multijugador en tiempo real. Genera un código para tu clase.</div>
                                </div>
                            </button>

                            <div style={{display:'flex',gap:8,marginTop:10}}>
                                <input placeholder="CÓDIGO 6 LETRAS" value={joinCode}
                                    onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6}
                                    style={{flex:1,padding:'10px 14px',borderRadius:30,border:'2px solid #ccc',
                                        textAlign:'center',fontSize:'0.95rem',letterSpacing:3,textTransform:'uppercase',
                                        outline:'none',fontWeight:'bold'}}/>
                                <button onClick={onUnirse} style={{...g.btnSuccess,padding:'10px 18px',margin:0}}>Unirse</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Modal configuración live
function ModalLiveConfig({ config, setConfig, onCancel, onCrear, creando }) {
    const set = (k,v) => setConfig(c => ({...c,[k]:v}));
    return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'white',borderRadius:20,padding:28,maxWidth:460,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
                <h2 style={{margin:'0 0 18px',color:'#9b59b6',fontSize:'1.3rem'}}>📡 Sesión en Vivo — Configurar</h2>

                <SectionTitle>Tiempo por pregunta</SectionTitle>
                <ChipRow>
                    {[20,30,45,60].map(t => (
                        <Chip key={t} active={config.tiempoPregunta===t} color="#e74c3c" onClick={() => set('tiempoPregunta',t)}>{t}s</Chip>
                    ))}
                    <input type="number" min="5" max="300" placeholder="···"
                        value={![20,30,45,60].includes(config.tiempoPregunta)?config.tiempoPregunta:''}
                        onChange={e=>{const v=parseInt(e.target.value);if(v>0)set('tiempoPregunta',v);}}
                        style={{width:52,padding:'6px 8px',borderRadius:20,border:'2px solid #ccc',textAlign:'center',fontSize:'0.9rem',outline:'none'}}/>
                </ChipRow>

                <SectionTitle>Número de preguntas</SectionTitle>
                <ChipRow>
                    {[5,8,10,15].map(n => (
                        <Chip key={n} active={config.numPreguntas===n} color="#009688" onClick={() => set('numPreguntas',n)}>{n}</Chip>
                    ))}
                    <input type="number" min="1" max="50" placeholder="···"
                        value={![5,8,10,15].includes(config.numPreguntas)?config.numPreguntas:''}
                        onChange={e=>{const v=parseInt(e.target.value);if(v>0)set('numPreguntas',v);}}
                        style={{width:52,padding:'6px 8px',borderRadius:20,border:'2px solid #ccc',textAlign:'center',fontSize:'0.9rem',outline:'none'}}/>
                </ChipRow>

                <SectionTitle>Puntuación por respuesta</SectionTitle>
                <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
                    {[['puntosMax','Máx pts'],['puntosMin','Mín pts']].map(([k,l]) => (
                        <label key={k} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,fontSize:'0.82rem',color:'#555'}}>
                            {l}
                            <input type="number" value={config[k]} onChange={e => set(k,parseInt(e.target.value)||0)}
                                style={{width:70,padding:'7px',borderRadius:10,border:'2px solid #ddd',textAlign:'center',fontWeight:'bold'}}/>
                        </label>
                    ))}
                </div>

                <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:22}}>
                    <button onClick={onCancel} style={{...g.btnGray,padding:'11px 22px'}}>Cancelar</button>
                    <button onClick={onCrear} disabled={creando} style={{...g.btnPrimary,background:'#9b59b6',boxShadow:'0 4px 14px rgba(155,89,182,0.4)'}}>
                        {creando ? '⏳ Creando...' : '🚀 Lanzar Juego'}
                    </button>
                </div>
            </div>
        </div>
    );
}
const SectionTitle = ({children}) => <div style={{fontWeight:'bold',color:'#555',fontSize:'0.82rem',textTransform:'uppercase',letterSpacing:'0.5px',margin:'14px 0 8px'}}>{children}</div>;
const ChipRow = ({children}) => <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',alignItems:'center'}}>{children}</div>;
const Chip = ({active,color,onClick,children}) => <button onClick={onClick} style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:'bold',fontSize:'0.85rem',background:active?color:'#f0f0f0',color:active?'white':'#555'}}>{children}</button>;

// ─────────────────────────────────────────────────────────────────────
// COMPONENTE COMPARTIDO — PALETA DE FUNCIONES
// ─────────────────────────────────────────────────────────────────────
function Paleta({ catSel, setCatSel, nivel, tokens }) {
    // En modo primaria, sólo las categorías presentes en la frase
    const visibles = (nivel === 'primaria' && tokens)
        ? Object.entries(CATEGORIAS).filter(([k]) => getCatsEnFrase(tokens).has(k))
        : Object.entries(CATEGORIAS);

    return (
        <div style={{background:'#f8f9fa',padding:'12px 16px',borderRadius:14,marginBottom:20}}>
            <div style={{fontWeight:'bold',color:'#333',display:'flex',alignItems:'center',gap:6,marginBottom:9,fontSize:'0.88rem'}}>
                <PaintBucket size={14}/> Elige el rotulador
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {visibles.map(([k,v]) => {
                    const sel = catSel === k;
                    return (
                        <button key={k} onClick={() => setCatSel(k)}
                            style={{padding:'6px 11px',borderRadius:20,fontWeight:'bold',cursor:'pointer',
                                fontSize:'0.78rem',display:'flex',alignItems:'center',gap:3,transition:'all 0.15s',
                                background:sel?v.color:'#f0f0f0',color:sel?'white':'#555',
                                border:`2px solid ${v.color}`,transform:sel?'scale(1.05)':'scale(1)',
                                boxShadow:sel?`0 3px 10px ${v.color}55`:'none'}}>
                            {v.emoji} {v.label}
                        </button>
                    );
                })}
            </div>
            <p style={{margin:'8px 0 0',color:'#999',fontSize:'0.72rem',fontStyle:'italic'}}>
                💡 Pulsa la misma palabra con el mismo color para borrarlo · Máx. 2 funciones por palabra
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// COMPONENTE COMPARTIDO — FRASE INTERACTIVA
// ─────────────────────────────────────────────────────────────────────
function FraseTokens({ tokens, answers, onClickWord, readonly, results }) {
    return (
        <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',padding:'12px 0'}}>
            {tokens.map((t, i) => {
                const ans = answers?.[i] || [];
                const r = results?.[i];
                return (
                    <div key={i}
                        onClick={readonly ? undefined : () => onClickWord(i)}
                        style={{
                            padding:'10px 13px', borderRadius:10,
                            display:'flex',flexDirection:'column',alignItems:'center',
                            transition:'all 0.18s', minWidth:46, userSelect:'none',
                            cursor: readonly ? 'default' : 'pointer',
                            background: readonly && r ? correctBg(r.esp) : tokenBg(ans),
                            color: (readonly && r) || ans.length ? 'white' : '#333',
                            border: readonly && r
                                ? `3px solid ${r.ok?'#27ae60':'#c0392b'}`
                                : (ans.length ? '2px solid transparent' : '2px dashed #ccc'),
                            opacity: readonly && r && !r.ok ? 0.85 : 1,
                        }}>
                        <span style={{fontSize:'1.1rem',fontWeight:'bold',textShadow:(ans.length||(readonly&&r))?'0 1px 3px rgba(0,0,0,0.3)':'none'}}>
                            {t.text}
                        </span>
                        {ans.length > 0 && !readonly && (
                            <div style={{display:'flex',gap:2,marginTop:2}}>
                                {ans.map(a => <span key={a} style={{fontSize:'0.72rem'}}>{CATEGORIAS[a]?.emoji}</span>)}
                            </div>
                        )}
                        {readonly && r && (
                            <div style={{marginTop:2}}>
                                {r.ok ? <CheckCircle size={12} color="#27ae60" style={{background:'white',borderRadius:'50%'}}/>
                                       : <XCircle size={12} color="#c0392b" style={{background:'white',borderRadius:'50%'}}/>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// COMPONENTE COMPARTIDO — DESGLOSE DE RESULTADOS
// ─────────────────────────────────────────────────────────────────────
function Desglose({ tokens, results }) {
    const total = results.reduce((a,r) => a + r.puntos, 0);
    return (
        <div style={{background:'#f8f9fa',borderRadius:16,padding:'16px'}}>
            <h3 style={{margin:'0 0 12px',color:'#2c3e50',fontSize:'0.9rem',fontWeight:'bold'}}>📋 Desglose</h3>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {results.map((r,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:'white',borderRadius:10,
                        padding:'8px 12px',borderLeft:`4px solid ${r.ok?'#27ae60':'#e74c3c'}`,
                        background:r.ok?'#f0fdf4':'#fef2f2'}}>
                        <span style={{background:correctBg(r.esp),color:'white',padding:'2px 8px',borderRadius:6,fontWeight:'bold',fontSize:'0.88rem',minWidth:40,textAlign:'center'}}>
                            {tokens[i].text}
                        </span>
                        <div style={{flex:1,fontSize:'0.82rem'}}>
                            {r.ok
                                ? <span style={{color:'#27ae60',fontWeight:'bold',display:'flex',alignItems:'center',gap:3}}><CheckCircle size={12}/> {r.esp.map(f=>`${CATEGORIAS[f]?.emoji} ${CATEGORIAS[f]?.label}`).join(' + ')}</span>
                                : <span style={{color:'#c0392b',display:'flex',flexDirection:'column',gap:1}}>
                                    <span style={{display:'flex',alignItems:'center',gap:3,fontWeight:'bold'}}><XCircle size={12}/> {r.dad.length ? `Dijiste: ${r.dad.map(f=>`${CATEGORIAS[f]?.emoji} ${CATEGORIAS[f]?.label}`).join(' + ')}` : 'Sin respuesta'}</span>
                                    <span style={{display:'flex',alignItems:'center',gap:3,color:'#777',fontSize:'0.78rem'}}><ArrowRight size={11}/> Era: {r.esp.map(f=>`${CATEGORIAS[f]?.emoji} ${CATEGORIAS[f]?.label}`).join(' + ')}</span>
                                  </span>
                            }
                        </div>
                        <span style={{fontWeight:'bold',fontSize:'0.9rem',color:r.ok?'#27ae60':'#c0392b',minWidth:40,textAlign:'right'}}>
                            {r.ok?`+${r.puntos}`:'0'} pts
                        </span>
                    </div>
                ))}
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12,padding:'11px 14px',background:'#2c3e50',borderRadius:12,color:'white',fontWeight:'bold'}}>
                <span>Esta ronda:</span>
                <span style={{fontSize:'1.6rem',color:'#f1c40f'}}>+{total} pts</span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// LÓGICA COMPARTIDA DE COMPROBACIÓN
// ─────────────────────────────────────────────────────────────────────
const comprobarFrase = (tokens, answers) =>
    tokens.map((t, i) => {
        const esp = t.funcion;
        const dad = answers[i] || [];
        const ok = esp.length === dad.length && esp.every(f => dad.includes(f));
        const puntos = ok ? esp.reduce((a,f) => a+(CATEGORIAS[f]?.puntos||10), 0) : 0;
        return { ok, esp, dad, puntos };
    });

// ─────────────────────────────────────────────────────────────────────
// MODO LOCAL
// ─────────────────────────────────────────────────────────────────────
function ModoLocal({ nivel, recurso, onBack }) {
    const pool = getPool(nivel, recurso);
    const bagRef = useRef(createBag(pool));
    const [frase, setFrase]     = useState(() => pickFromBag(bagRef.current, pool));
    const [answers, setAnswers] = useState(() => []);
    const [catSel, setCatSel]   = useState(Object.keys(CATEGORIAS)[0]);
    const [results, setResults] = useState(null);
    const [score, setScore]     = useState(0);
    const [animScore, setAnimScore] = useState(null);

    useEffect(() => { setAnswers(frase.tokens.map(()=>[])); setResults(null); }, [frase]);

    const clickWord = (i) => {
        if (results) return;
        const a = answers.map(x=>[...x]);
        const c = a[i];
        if (c.includes(catSel)) a[i] = c.filter(x=>x!==catSel);
        else if (c.length < 2) a[i] = [...c, catSel];
        setAnswers(a);
    };

    const comprobar = () => {
        const r = comprobarFrase(frase.tokens, answers);
        const pts = r.reduce((a,x)=>a+x.puntos,0);
        setResults(r); setScore(s=>s+pts); setAnimScore(pts);
        setTimeout(() => setAnimScore(null), 2000);
    };

    const siguiente = () => {
        const f = pickFromBag(bagRef.current, pool);
        setFrase(f); setCatSel(Object.keys(CATEGORIAS)[0]);
    };

    const nInfo = NIVELES.find(n => n.id === (frase.nivel||nivel));

    return (
        <div style={g.container}>
            <div style={g.header}>
                <button onClick={onBack} style={g.btnBack}><RotateCcw size={16}/> Menú</button>
                <span style={g.titulo}>📖 Analizar</span>
                <div style={g.scoreboard}><Trophy size={14} color="#f1c40f"/><span>{score}</span>
                    {animScore!==null && <span style={g.animPts}>+{animScore}</span>}
                </div>
            </div>
            <div style={{maxWidth:860,margin:'20px auto',background:'white',padding:'20px 16px',borderRadius:20,boxShadow:'0 10px 30px rgba(0,0,0,0.07)'}}>
                {nInfo && <div style={{textAlign:'center',marginBottom:10}}><span style={{background:nInfo.color,color:'white',padding:'3px 12px',borderRadius:20,fontSize:'0.75rem',fontWeight:'bold'}}>{nInfo.emoji} {nInfo.label}</span></div>}
                {!results && <Paleta catSel={catSel} setCatSel={setCatSel} nivel={nivel} tokens={frase.tokens}/>}
                <FraseTokens tokens={frase.tokens} answers={answers} onClickWord={clickWord} readonly={!!results} results={results}/>
                {!results
                    ? <div style={{textAlign:'center',marginTop:24}}><button onClick={comprobar} style={g.btnSuccess}><CheckCircle size={17}/> Comprobar</button></div>
                    : <>
                        <Desglose tokens={frase.tokens} results={results}/>
                        <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
                            <button onClick={siguiente} style={g.btnPrimary}><ChevronRight size={17}/> Siguiente Frase</button>
                            <button onClick={onBack} style={g.btnGray}><BookOpen size={15}/> Cambiar Nivel</button>
                        </div>
                      </>
                }
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// MODO CONTRARRELOJ 180s
// ─────────────────────────────────────────────────────────────────────
function ModoContrarreloj({ nivel, recurso, onBack }) {
    const DURACION = 180;
    const pool = getPool(nivel, recurso);
    const bagRef = useRef(createBag(pool));

    const [phase, setPhase]     = useState('READY');   // READY | PLAYING | FINISHED
    const [frase, setFrase]     = useState(null);
    const [answers, setAnswers] = useState([]);
    const [catSel, setCatSel]   = useState(Object.keys(CATEGORIAS)[0]);
    const [results, setResults] = useState(null);
    const [score, setScore]     = useState(0);
    const [frasesDone, setFrasesDone] = useState(0);
    const [timeLeft, setTimeLeft] = useState(DURACION);
    const timerRef = useRef(null);

    const start = () => {
        const f = pickFromBag(bagRef.current, pool);
        setFrase(f); setAnswers(f.tokens.map(()=>[])); setResults(null);
        setCatSel(Object.keys(CATEGORIAS)[0]);
        setScore(0); setFrasesDone(0); setTimeLeft(DURACION);
        setPhase('PLAYING');
        timerRef.current = setInterval(() => {
            setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current); setPhase('FINISHED'); return 0; } return t - 1; });
        }, 1000);
    };

    useEffect(() => () => clearInterval(timerRef.current), []);

    const clickWord = (i) => {
        if (results) return;
        const a = answers.map(x=>[...x]);
        const c = a[i];
        if (c.includes(catSel)) a[i] = c.filter(x=>x!==catSel);
        else if (c.length < 2) a[i] = [...c, catSel];
        setAnswers(a);
    };

    const comprobar = () => {
        const r = comprobarFrase(frase.tokens, answers);
        const pts = r.reduce((a,x)=>a+x.puntos,0);
        setResults(r); setScore(s=>s+pts);
    };

    const siguiente = () => {
        const f = pickFromBag(bagRef.current, pool);
        setFrase(f); setAnswers(f.tokens.map(()=>[]));
        setResults(null); setCatSel(Object.keys(CATEGORIAS)[0]);
        setFrasesDone(n=>n+1);
    };

    const urgente = timeLeft <= 30;

    return (
        <div style={g.container}>
            <div style={g.header}>
                <button onClick={() => { clearInterval(timerRef.current); onBack(); }} style={g.btnBack}><RotateCcw size={16}/> Salir</button>
                <span style={g.titulo}>⏱️ Contrarreloj</span>
                {phase === 'PLAYING' && (
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{...g.scoreboard,background:urgente?'#e74c3c':'#2c3e50'}}>
                            <Clock size={14}/> {fmtTime(timeLeft)}
                        </div>
                        <div style={g.scoreboard}><Trophy size={14} color="#f1c40f"/> {score}</div>
                    </div>
                )}
                {phase !== 'PLAYING' && <div style={{width:60}}/>}
            </div>

            {phase === 'READY' && (
                <div style={g.centerBox}>
                    <div style={g.card}>
                        <div style={{fontSize:'3rem',marginBottom:8}}>⏱️</div>
                        <h1 style={g.cardTitle}>Contrarreloj</h1>
                        <p style={{color:'#666',marginBottom:22,lineHeight:1.6}}>
                            Tienes <strong>3 minutos</strong> para analizar el máximo de frases posible.<br/>
                            Cada respuesta correcta suma puntos. ¡A toda velocidad!
                        </p>
                        <button onClick={start} style={{...g.btnPrimary,justifyContent:'center',width:'100%'}}><Play size={18}/> ¡Empezar!</button>
                    </div>
                </div>
            )}

            {phase === 'PLAYING' && frase && (
                <div style={{maxWidth:860,margin:'16px auto',background:'white',padding:'18px 14px',borderRadius:20,boxShadow:'0 10px 30px rgba(0,0,0,0.07)'}}>
                    {urgente && !results && (
                        <div style={{background:'#ffeaea',borderRadius:10,padding:'8px 14px',marginBottom:12,color:'#e74c3c',fontWeight:'bold',fontSize:'0.85rem',textAlign:'center'}}>
                            ⚡ ¡Date prisa! Quedan {timeLeft}s
                        </div>
                    )}
                    {!results && <Paleta catSel={catSel} setCatSel={setCatSel} nivel={nivel} tokens={frase.tokens}/>}
                    <FraseTokens tokens={frase.tokens} answers={answers} onClickWord={clickWord} readonly={!!results} results={results}/>
                    {!results
                        ? <div style={{textAlign:'center',marginTop:20}}><button onClick={comprobar} style={g.btnSuccess}><CheckCircle size={17}/> Comprobar</button></div>
                        : <>
                            <Desglose tokens={frase.tokens} results={results}/>
                            <div style={{textAlign:'center',marginTop:14}}>
                                <button onClick={siguiente} style={{...g.btnPrimary,justifyContent:'center'}}><ChevronRight size={17}/> Siguiente ▶</button>
                            </div>
                          </>
                    }
                </div>
            )}

            {phase === 'FINISHED' && (
                <div style={g.centerBox}>
                    <div style={g.card}>
                        <div style={{fontSize:'3rem',marginBottom:8}}>🏁</div>
                        <h1 style={g.cardTitle}>¡Tiempo!</h1>
                        <div style={{background:'#f8f9fa',borderRadius:14,padding:'20px',margin:'16px 0'}}>
                            <div style={{fontSize:'3rem',fontWeight:900,color:'#f1c40f'}}>{score}</div>
                            <div style={{color:'#888',fontSize:'0.9rem'}}>puntos totales</div>
                            <div style={{marginTop:10,color:'#555',fontWeight:'bold'}}>
                                📖 {frasesDone + (results?1:0)} frases analizadas
                            </div>
                        </div>
                        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                            <button onClick={start} style={g.btnPrimary}><RotateCcw size={16}/> Repetir</button>
                            <button onClick={onBack} style={g.btnGray}><BookOpen size={15}/> Cambiar modo</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// MODO DUAL — DOS JUGADORES EN PANTALLA GRANDE
// ─────────────────────────────────────────────────────────────────────
function ModoDual({ nivel, recurso, onBack }) {
    const pool = getPool(nivel, recurso);
    const bag1 = useRef(createBag(pool));
    const bag2 = useRef(createBag(pool));

    const pickDos = () => {
        const f1 = pickFromBag(bag1.current, pool);
        // f2 debe ser distinta de f1
        let f2 = pickFromBag(bag2.current, pool);
        if (f2.id === f1.id && pool.length > 1) {
            bag2.current.used.delete(f2.id);
            f2 = pickFromBag(bag2.current, pool);
        }
        return [f1, f2];
    };

    const init = () => {
        const [f1, f2] = pickDos();
        return { frase:f1, answers: f1.tokens.map(()=>[]), catSel: Object.keys(CATEGORIAS)[0], results: null };
    };

    const [left, setLeft]   = useState(() => { const [f1] = pickDos(); return { frase:f1, answers:f1.tokens.map(()=>[]), catSel:Object.keys(CATEGORIAS)[0], results:null }; });
    const [right, setRight] = useState(() => { const [,f2] = pickDos(); return { frase:f2, answers:f2.tokens.map(()=>[]), catSel:Object.keys(CATEGORIAS)[0], results:null }; });
    const [scores, setScores] = useState([0,0]);

    const updateSide = (side, setter, bagRef) => ({
        clickWord: (i) => {
            if (side.results) return;
            const a = side.answers.map(x=>[...x]);
            const c = a[i];
            if (c.includes(side.catSel)) a[i] = c.filter(x=>x!==side.catSel);
            else if (c.length < 2) a[i] = [...c, side.catSel];
            setter({...side, answers:a});
        },
        setCat: (cat) => setter({...side, catSel:cat}),
        comprobar: () => {
            const r = comprobarFrase(side.frase.tokens, side.answers);
            const pts = r.reduce((a,x)=>a+x.puntos,0);
            setter({...side, results:r});
            setScores(s => side === left ? [s[0]+pts,s[1]] : [s[0],s[1]+pts]);
        },
        siguiente: () => {
            const f = pickFromBag(bagRef.current, pool);
            setter({ frase:f, answers:f.tokens.map(()=>[]), catSel:Object.keys(CATEGORIAS)[0], results:null });
        },
    });

    const lActions = updateSide(left, setLeft, bag1);
    const rActions = updateSide(right, setRight, bag2);

    const [dismissed, setDismissed] = useState(false);

    const PlayerPanel = ({ side, actions, label, color, score: sc }) => (
        <div style={{flex:1,minWidth:0,background:'white',borderRadius:18,padding:'14px 12px',boxShadow:'0 6px 20px rgba(0,0,0,0.07)',display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:900,color,fontSize:'1rem'}}>{label}</span>
                <div style={{background:color,color:'white',padding:'4px 12px',borderRadius:20,fontWeight:'bold',fontSize:'0.85rem'}}>
                    <Trophy size={13}/> {sc}
                </div>
            </div>
            {!side.results && <Paleta catSel={side.catSel} setCatSel={actions.setCat} nivel={nivel} tokens={side.frase.tokens}/>}
            <FraseTokens tokens={side.frase.tokens} answers={side.answers} onClickWord={actions.clickWord} readonly={!!side.results} results={side.results}/>
            {!side.results
                ? <div style={{textAlign:'center'}}><button onClick={actions.comprobar} style={{...g.btnSuccess,fontSize:'0.85rem',padding:'9px 18px',justifyContent:'center'}}><CheckCircle size={15}/> Comprobar</button></div>
                : <>
                    <Desglose tokens={side.frase.tokens} results={side.results}/>
                    <div style={{textAlign:'center'}}><button onClick={actions.siguiente} style={{...g.btnPrimary,fontSize:'0.85rem',padding:'9px 18px',justifyContent:'center'}}><ChevronRight size={14}/> Siguiente</button></div>
                  </>
            }
        </div>
    );

    return (
        <div style={g.container}>
            <div style={g.header}>
                <button onClick={onBack} style={g.btnBack}><RotateCcw size={16}/> Salir</button>
                <span style={g.titulo}>👥 Modo Dual</span>
                <div style={{width:60}}/>
            </div>

            {!dismissed && (
                <div style={{background:'#fff9e6',border:'2px solid #f39c12',borderRadius:12,padding:'10px 16px',margin:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
                    <AlertTriangle size={18} color="#f39c12"/>
                    <span style={{fontSize:'0.85rem',color:'#7d6608',flex:1}}><strong>Modo pantalla grande:</strong> Este modo está diseñado para usarse en un monitor o tablet en horizontal, con dos jugadores sentados frente a la misma pantalla.</span>
                    <button onClick={() => setDismissed(true)} style={{background:'#f39c12',color:'white',border:'none',borderRadius:20,padding:'5px 12px',cursor:'pointer',fontWeight:'bold',fontSize:'0.78rem'}}>OK</button>
                </div>
            )}

            <div style={{display:'flex',gap:14,padding:'8px 14px',alignItems:'flex-start'}}>
                <PlayerPanel side={left}  actions={lActions} label="🔵 Jugador 1" color="#3498db" score={scores[0]}/>
                <div style={{width:3,background:'#eee',alignSelf:'stretch',borderRadius:4,flexShrink:0}}/>
                <PlayerPanel side={right} actions={rActions} label="🔴 Jugador 2" color="#e74c3c" score={scores[1]}/>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// LIVE HOST
// ─────────────────────────────────────────────────────────────────────
function SintaxisLiveHost({ codigoSala, onExit }) {
    const [sala, setSala]       = useState(null);
    const [answers, setAnswers] = useState([]);
    const [catSel, setCatSel]   = useState(Object.keys(CATEGORIAS)[0]);
    const [timerLocal, setTimerLocal] = useState(0);
    const timerRef = useRef(null);
    const [revealResults, setRevealResults] = useState(null);
    const [weakCats, setWeakCats] = useState([]);
    const [showWeakModal, setShowWeakModal] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), snap => {
            if (!snap.exists()) return;
            const d = snap.data();
            setSala(d);
            if (d.estado === 'PLAYING' && d.fasePregunta === 'RESPONDING') {
                const elapsed = d.questionStartTime ? Math.floor((Date.now() - d.questionStartTime) / 1000) : 0;
                const remaining = Math.max(0, d.config.tiempoPregunta - elapsed);
                setTimerLocal(remaining);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    // Timer local countdown
    useEffect(() => {
        clearInterval(timerRef.current);
        if (sala?.estado === 'PLAYING' && sala?.fasePregunta === 'RESPONDING') {
            timerRef.current = setInterval(() => {
                setTimerLocal(t => {
                    if (t <= 1) { clearInterval(timerRef.current); hostReveal(); return 0; }
                    return t - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [sala?.indicePregunta, sala?.fasePregunta]);

    const iniciarJuego = async () => {
        const preg0 = sala.preguntas[0];
        await updateDoc(doc(db, 'live_games', codigoSala), {
            estado: 'PLAYING', fasePregunta: 'RESPONDING',
            indicePregunta: 0, respuestasRonda: {},
            questionStartTime: Date.now(),
        });
        setAnswers(preg0.tokens.map(()=>[]));
        setCatSel(Object.keys(CATEGORIAS)[0]);
    };

    const hostReveal = async () => {
        clearInterval(timerRef.current);
        if (!sala) return;
        const idx = sala.indicePregunta;
        const preg = sala.preguntas[idx];
        const jugadores = sala.jugadores || {};
        const resps = sala.respuestasRonda || {};
        const catStats = { ...(sala.catStats || {}) };

        // Calcular resultados por jugador y actualizar catStats
        const resultadosJugadores = {};
        Object.entries(jugadores).forEach(([uid, j]) => {
            const resp = resps[uid] || {};
            let pts = 0;
            preg.tokens.forEach((t, i) => {
                const esp = t.funcion;
                const dad = resp[i] || [];
                const ok = esp.length === dad.length && esp.every(f => dad.includes(f));
                if (ok) {
                    const puntosTok = esp.reduce((a,f) => a + (CATEGORIAS[f]?.puntos||10), 0);
                    const tiempoBonus = j.tiempoRespuesta
                        ? Math.max(0, sala.config.tiempoPregunta - j.tiempoRespuesta) / sala.config.tiempoPregunta
                        : 0;
                    pts += Math.round(puntosTok * (0.5 + 0.5 * tiempoBonus));
                }
                // catStats
                esp.forEach(f => {
                    if (!catStats[f]) catStats[f] = { total: 0, correct: 0 };
                    catStats[f].total++;
                    if (ok) catStats[f].correct++;
                });
            });
            resultadosJugadores[uid] = { ...j, puntos: (j.puntos || 0) + pts };
        });

        // Detectar categorías débiles (<40%)
        const weak = Object.entries(catStats)
            .filter(([,v]) => v.total > 0 && v.correct / v.total < 0.4)
            .map(([cat]) => cat);
        setWeakCats(weak);

        const r = comprobarFrase(preg.tokens, answers);
        setRevealResults(r);

        await updateDoc(doc(db, 'live_games', codigoSala), {
            fasePregunta: 'REVEAL',
            jugadores: resultadosJugadores,
            catStats,
        });

        setTimeout(async () => {
            if (weak.length > 0) {
                setShowWeakModal(true);
                await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'WEAKCAT' });
                setTimeout(async () => {
                    setShowWeakModal(false);
                    await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'LEADERBOARD' });
                    setTimeout(() => hostNextOrEnd(), 4000);
                }, 5000);
            } else {
                await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'LEADERBOARD' });
                setTimeout(() => hostNextOrEnd(), 4000);
            }
        }, 4000);
    };

    const hostNextOrEnd = async () => {
        if (!sala) return;
        const next = sala.indicePregunta + 1;
        if (next >= sala.preguntas.length) {
            await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'FIN' });
        } else {
            setRevealResults(null);
            const preg = sala.preguntas[next];
            setAnswers(preg.tokens.map(()=>[]));
            setCatSel(Object.keys(CATEGORIAS)[0]);
            await updateDoc(doc(db, 'live_games', codigoSala), {
                estado: 'PLAYING', fasePregunta: 'RESPONDING',
                indicePregunta: next, respuestasRonda: {},
                questionStartTime: Date.now(),
            });
        }
    };

    const clickWord = (i) => {
        if (sala?.fasePregunta !== 'RESPONDING') return;
        const a = answers.map(x=>[...x]);
        const c = a[i];
        if (c.includes(catSel)) a[i] = c.filter(x=>x!==catSel);
        else if (c.length < 2) a[i] = [...c, catSel];
        setAnswers(a);
    };

    if (!sala) return <div style={g.centerBox}><div style={{color:'#555'}}>Conectando...</div></div>;

    const jugadores = sala.jugadores || {};
    const numJugadores = Object.keys(jugadores).length;
    const preg = sala.preguntas?.[sala.indicePregunta];
    const urgente = timerLocal <= 10;

    // LEADERBOARD
    const Leaderboard = () => {
        const sorted = Object.entries(jugadores).sort(([,a],[,b]) => (b.puntos||0)-(a.puntos||0));
        return (
            <div style={{maxWidth:500,margin:'0 auto',background:'white',borderRadius:20,padding:'20px'}}>
                <h2 style={{color:'#9b59b6',textAlign:'center',margin:'0 0 16px'}}>🏆 Marcador</h2>
                {sorted.map(([uid,j],i) => (
                    <div key={uid} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:i===0?'#fffbea':'#f8f9fa',borderRadius:12,marginBottom:8,border:i===0?'2px solid #f1c40f':'none'}}>
                        <span style={{fontWeight:900,fontSize:'1.2rem',minWidth:28}}>{['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
                        <span style={{flex:1,fontWeight:'bold'}}>{j.nombre||uid}</span>
                        <span style={{fontWeight:900,color:'#9b59b6',fontSize:'1.1rem'}}>{j.puntos||0} pts</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={g.container}>
            <div style={g.header}>
                <button onClick={onExit} style={g.btnBack}><RotateCcw size={16}/> Salir</button>
                <span style={g.titulo}>📡 En Vivo · {codigoSala}</span>
                <div style={{...g.scoreboard,background:'#9b59b6'}}>
                    <Users size={14}/> {numJugadores}
                </div>
            </div>

            {/* Modal categorías débiles */}
            {showWeakModal && weakCats.length > 0 && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                    <div style={{background:'white',borderRadius:20,padding:28,maxWidth:440,width:'100%',textAlign:'center'}}>
                        <div style={{fontSize:'2.5rem',marginBottom:8}}>⚠️</div>
                        <h2 style={{color:'#e74c3c',margin:'0 0 6px'}}>Puntos débiles</h2>
                        <p style={{color:'#666',fontSize:'0.88rem',marginBottom:16}}>Estas categorías tienen menos del 40% de aciertos. ¡Practicad más!</p>
                        <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
                            {weakCats.map(cat => (
                                <span key={cat} style={{background:CATEGORIAS[cat]?.color||'#ccc',color:'white',padding:'6px 14px',borderRadius:20,fontWeight:'bold',fontSize:'0.9rem'}}>
                                    {CATEGORIAS[cat]?.emoji} {CATEGORIAS[cat]?.label||cat}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* LOBBY */}
            {sala.estado === 'LOBBY' && (
                <div style={g.centerBox}>
                    <div style={g.card}>
                        <div style={{fontSize:'2.5rem',marginBottom:8}}>📡</div>
                        <h1 style={g.cardTitle}>Sesión en Vivo</h1>
                        <div style={{background:'#9b59b6',color:'white',padding:'12px 28px',borderRadius:14,fontSize:'2rem',fontWeight:900,letterSpacing:6,margin:'12px 0'}}>
                            {codigoSala}
                        </div>
                        <p style={{color:'#888',fontSize:'0.85rem',marginBottom:8}}>Comparte este código con tu clase</p>
                        <div style={{background:'#f8f9fa',padding:'12px',borderRadius:12,marginBottom:16}}>
                            <div style={{color:'#555',fontSize:'0.88rem'}}><strong>{numJugadores}</strong> jugador{numJugadores!==1?'es':''} conectado{numJugadores!==1?'s':''}</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8,justifyContent:'center'}}>
                                {Object.entries(jugadores).map(([uid,j]) => (
                                    <span key={uid} style={{background:'#9b59b6',color:'white',padding:'3px 10px',borderRadius:20,fontSize:'0.78rem'}}>{j.nombre||'Anónimo'}</span>
                                ))}
                            </div>
                        </div>
                        <div style={{fontSize:'0.82rem',color:'#888',marginBottom:16}}>
                            {sala.preguntas?.length} preguntas · {sala.config?.tiempoPregunta}s por pregunta
                        </div>
                        <button onClick={iniciarJuego} disabled={numJugadores < 1}
                            style={{...g.btnPrimary,background:'#9b59b6',boxShadow:'0 4px 14px rgba(155,89,182,0.4)',justifyContent:'center',width:'100%',opacity:numJugadores<1?0.5:1}}>
                            🚀 Iniciar Juego
                        </button>
                    </div>
                </div>
            )}

            {/* PLAYING */}
            {sala.estado === 'PLAYING' && preg && (
                <div style={{maxWidth:860,margin:'16px auto',background:'white',padding:'18px 14px',borderRadius:20,boxShadow:'0 10px 30px rgba(0,0,0,0.07)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                        <span style={{fontWeight:'bold',color:'#9b59b6',fontSize:'0.9rem'}}>
                            Pregunta {sala.indicePregunta+1}/{sala.preguntas.length}
                        </span>
                        {sala.fasePregunta === 'RESPONDING' && (
                            <div style={{background:urgente?'#e74c3c':'#9b59b6',color:'white',padding:'5px 14px',borderRadius:20,fontWeight:900,fontSize:'1.1rem'}}>
                                <Clock size={14} style={{verticalAlign:'middle',marginRight:4}}/>{timerLocal}s
                            </div>
                        )}
                    </div>

                    {sala.fasePregunta === 'RESPONDING' && (
                        <>
                            <Paleta catSel={catSel} setCatSel={setCatSel} nivel={preg.nivel} tokens={preg.tokens}/>
                            <FraseTokens tokens={preg.tokens} answers={answers} onClickWord={clickWord}/>
                            <div style={{textAlign:'center',marginTop:16}}>
                                <button onClick={hostReveal} style={{...g.btnSuccess,justifyContent:'center'}}>
                                    ⏭️ Revelar Respuestas
                                </button>
                            </div>
                        </>
                    )}

                    {(sala.fasePregunta === 'REVEAL' || sala.fasePregunta === 'WEAKCAT') && revealResults && (
                        <>
                            <FraseTokens tokens={preg.tokens} answers={[]} readonly results={revealResults}/>
                            <Desglose tokens={preg.tokens} results={revealResults}/>
                        </>
                    )}

                    {sala.fasePregunta === 'LEADERBOARD' && <Leaderboard/>}

                    {/* Espera de jugadores */}
                    <div style={{marginTop:14,background:'#f8f9fa',borderRadius:12,padding:'10px 14px',fontSize:'0.82rem',color:'#888'}}>
                        Respuestas recibidas: {Object.keys(sala.respuestasRonda||{}).length}/{numJugadores}
                    </div>
                </div>
            )}

            {/* FIN */}
            {sala.estado === 'FIN' && (
                <div style={g.centerBox}>
                    <div style={g.card}>
                        <div style={{fontSize:'2.5rem',marginBottom:8}}>🏆</div>
                        <h1 style={g.cardTitle}>¡Fin del Juego!</h1>
                        <Leaderboard/>
                        {/* Resumen categorías débiles globales */}
                        {sala.catStats && Object.entries(sala.catStats).some(([,v])=>v.total>0&&v.correct/v.total<0.4) && (
                            <div style={{background:'#fef2f2',borderRadius:14,padding:'14px',marginTop:16}}>
                                <div style={{fontWeight:'bold',color:'#e74c3c',marginBottom:8,fontSize:'0.9rem'}}>⚠️ Categorías con dificultad (menos del 40% de aciertos globales):</div>
                                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                                    {Object.entries(sala.catStats).filter(([,v])=>v.total>0&&v.correct/v.total<0.4).map(([cat,v])=>(
                                        <span key={cat} style={{background:CATEGORIAS[cat]?.color||'#ccc',color:'white',padding:'5px 12px',borderRadius:20,fontSize:'0.82rem',fontWeight:'bold'}}>
                                            {CATEGORIAS[cat]?.emoji} {CATEGORIAS[cat]?.label||cat} ({Math.round(v.correct/v.total*100)}%)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={onExit} style={{...g.btnGray,marginTop:18,justifyContent:'center',width:'100%'}}>Salir</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// LIVE CLIENT
// ─────────────────────────────────────────────────────────────────────
function SintaxisLiveClient({ codigoSala, onExit }) {
    const [nombre, setNombre]   = useState(() => localStorage.getItem('pikt_guest_name') || '');
    const [uid]                 = useState(() => localStorage.getItem('pikt_guest_id') || ('guest_' + Math.random().toString(36).slice(2)));
    const [sala, setSala]       = useState(null);
    const [joined, setJoined]   = useState(false);
    const [answers, setAnswers] = useState([]);
    const [catSel, setCatSel]   = useState(Object.keys(CATEGORIAS)[0]);
    const [submitted, setSubmitted] = useState(false);
    const [timerLocal, setTimerLocal] = useState(0);
    const timerRef = useRef(null);
    const prevIdx = useRef(-1);

    useEffect(() => {
        localStorage.setItem('pikt_guest_id', uid);
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), snap => {
            if (!snap.exists()) return;
            setSala(snap.data());
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!sala) return;
        if (sala.estado === 'PLAYING' && sala.fasePregunta === 'RESPONDING') {
            const idx = sala.indicePregunta;
            if (idx !== prevIdx.current) {
                prevIdx.current = idx;
                setSubmitted(false);
                const preg = sala.preguntas[idx];
                setAnswers(preg.tokens.map(()=>[]));
                setCatSel(Object.keys(CATEGORIAS)[0]);
                const elapsed = sala.questionStartTime ? Math.floor((Date.now() - sala.questionStartTime)/1000) : 0;
                setTimerLocal(Math.max(0, sala.config.tiempoPregunta - elapsed));
                clearInterval(timerRef.current);
                timerRef.current = setInterval(() => setTimerLocal(t => Math.max(0,t-1)), 1000);
            }
        } else {
            clearInterval(timerRef.current);
        }
    }, [sala?.estado, sala?.fasePregunta, sala?.indicePregunta]);

    useEffect(() => () => clearInterval(timerRef.current), []);

    const unirse = async () => {
        if (!nombre.trim()) return alert('Introduce tu nombre.');
        localStorage.setItem('pikt_guest_name', nombre.trim());
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`jugadores.${uid}`]: { nombre: nombre.trim(), puntos: 0 }
        });
        setJoined(true);
    };

    const enviarRespuesta = async () => {
        if (submitted) return;
        setSubmitted(true);
        const tiempoResp = sala.questionStartTime ? Math.floor((Date.now() - sala.questionStartTime)/1000) : sala.config.tiempoPregunta;
        const respObj = {};
        answers.forEach((a, i) => { respObj[i] = a; });
        await updateDoc(doc(db, 'live_games', codigoSala), {
            [`respuestasRonda.${uid}`]: respObj,
            [`jugadores.${uid}.tiempoRespuesta`]: tiempoResp,
        });
    };

    const clickWord = (i) => {
        if (submitted || sala?.fasePregunta !== 'RESPONDING') return;
        const a = answers.map(x=>[...x]);
        const c = a[i];
        if (c.includes(catSel)) a[i] = c.filter(x=>x!==catSel);
        else if (c.length < 2) a[i] = [...c, catSel];
        setAnswers(a);
    };

    if (!sala) return <div style={g.centerBox}><div style={{color:'#555'}}>Conectando a la sala...</div></div>;

    const jugadores = sala.jugadores || {};
    const preg = sala.preguntas?.[sala.indicePregunta];
    const urgente = timerLocal <= 10 && timerLocal > 0;
    const myScore = jugadores[uid]?.puntos || 0;

    // Pantalla JOIN
    if (!joined) return (
        <div style={g.centerBox}>
            <div style={g.card}>
                <div style={{fontSize:'2.5rem',marginBottom:8}}>📡</div>
                <h1 style={g.cardTitle}>Unirse a {codigoSala}</h1>
                <input placeholder="Tu nombre" value={nombre} onChange={e=>setNombre(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&unirse()}
                    style={{width:'100%',padding:'12px',borderRadius:30,border:'2px solid #ccc',fontSize:'1rem',textAlign:'center',outline:'none',marginBottom:14,boxSizing:'border-box'}}/>
                <button onClick={unirse} style={{...g.btnPrimary,justifyContent:'center',width:'100%'}}>Unirse 🚀</button>
            </div>
        </div>
    );

    // LOBBY
    if (sala.estado === 'LOBBY') return (
        <div style={g.centerBox}>
            <div style={g.card}>
                <div style={{fontSize:'2.5rem',marginBottom:8}}>⏳</div>
                <h1 style={g.cardTitle}>Esperando al profesor...</h1>
                <p style={{color:'#888',marginBottom:12}}>Conectado como <strong style={{color:'#9b59b6'}}>{nombre}</strong></p>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center'}}>
                    {Object.entries(jugadores).map(([id,j])=>(
                        <span key={id} style={{background:id===uid?'#9b59b6':'#eee',color:id===uid?'white':'#555',padding:'4px 12px',borderRadius:20,fontSize:'0.82rem',fontWeight:id===uid?'bold':'normal'}}>
                            {j.nombre}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );

    // LEADERBOARD/WEAKCAT
    if (sala.fasePregunta === 'LEADERBOARD' || sala.fasePregunta === 'WEAKCAT') {
        const sorted = Object.entries(jugadores).sort(([,a],[,b])=>(b.puntos||0)-(a.puntos||0));
        return (
            <div style={g.centerBox}>
                <div style={{...g.card, maxWidth:460}}>
                    {sala.fasePregunta === 'WEAKCAT' && sala.catStats && (
                        <div style={{background:'#fef2f2',borderRadius:14,padding:'14px',marginBottom:16}}>
                            <div style={{fontWeight:'bold',color:'#e74c3c',fontSize:'0.9rem',marginBottom:8}}>⚠️ Puntos débiles de la clase</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                                {Object.entries(sala.catStats).filter(([,v])=>v.total>0&&v.correct/v.total<0.4).map(([cat,v])=>(
                                    <span key={cat} style={{background:CATEGORIAS[cat]?.color||'#ccc',color:'white',padding:'5px 12px',borderRadius:20,fontSize:'0.82rem',fontWeight:'bold'}}>
                                        {CATEGORIAS[cat]?.emoji} {CATEGORIAS[cat]?.label||cat} ({Math.round(v.correct/v.total*100)}%)
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <h2 style={{color:'#9b59b6',textAlign:'center',margin:'0 0 14px'}}>🏆 Marcador</h2>
                    {sorted.map(([id,j],i)=>(
                        <div key={id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:id===uid?'#f3e5f5':(i===0?'#fffbea':'#f8f9fa'),borderRadius:12,marginBottom:7,border:id===uid?'2px solid #9b59b6':'none'}}>
                            <span style={{fontWeight:900,minWidth:26}}>{['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
                            <span style={{flex:1,fontWeight:id===uid?'bold':'normal'}}>{j.nombre}{id===uid?' (tú)':''}</span>
                            <span style={{fontWeight:900,color:'#9b59b6'}}>{j.puntos||0} pts</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // FIN
    if (sala.estado === 'FIN') {
        const sorted = Object.entries(jugadores).sort(([,a],[,b])=>(b.puntos||0)-(a.puntos||0));
        const myPos = sorted.findIndex(([id])=>id===uid)+1;
        return (
            <div style={g.centerBox}>
                <div style={g.card}>
                    <div style={{fontSize:'2.5rem',marginBottom:8}}>{myPos===1?'🥇':myPos===2?'🥈':myPos===3?'🥉':'🎉'}</div>
                    <h1 style={g.cardTitle}>¡Fin del Juego!</h1>
                    <div style={{background:'#f3e5f5',borderRadius:14,padding:'16px',margin:'12px 0',textAlign:'center'}}>
                        <div style={{fontSize:'2.5rem',fontWeight:900,color:'#9b59b6'}}>{myScore}</div>
                        <div style={{color:'#888',fontSize:'0.85rem'}}>puntos · Puesto {myPos}º de {sorted.length}</div>
                    </div>
                    {sorted.map(([id,j],i)=>(
                        <div key={id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:id===uid?'#f3e5f5':(i===0?'#fffbea':'#f8f9fa'),borderRadius:12,marginBottom:6,border:id===uid?'2px solid #9b59b6':'none'}}>
                            <span style={{fontWeight:900,minWidth:26}}>{['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
                            <span style={{flex:1,fontWeight:id===uid?'bold':'normal'}}>{j.nombre}</span>
                            <span style={{fontWeight:900,color:'#9b59b6'}}>{j.puntos||0} pts</span>
                        </div>
                    ))}
                    <button onClick={onExit} style={{...g.btnGray,marginTop:16,justifyContent:'center',width:'100%'}}>Salir</button>
                </div>
            </div>
        );
    }

    // PLAYING - REVEAL
    if (sala.fasePregunta === 'REVEAL' && preg) {
        const r = comprobarFrase(preg.tokens, answers);
        return (
            <div style={{maxWidth:800,margin:'16px auto',background:'white',padding:'18px 14px',borderRadius:20,boxShadow:'0 10px 30px rgba(0,0,0,0.07)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                    <span style={{fontWeight:'bold',color:'#9b59b6'}}>Pregunta {sala.indicePregunta+1}/{sala.preguntas.length}</span>
                    <div style={g.scoreboard}><Trophy size={14} color="#f1c40f"/> {myScore}</div>
                </div>
                <FraseTokens tokens={preg.tokens} answers={answers} readonly results={r}/>
                <Desglose tokens={preg.tokens} results={r}/>
            </div>
        );
    }

    // PLAYING - RESPONDING
    if (sala.estado === 'PLAYING' && preg) return (
        <div style={{maxWidth:800,margin:'16px auto',background:'white',padding:'18px 14px',borderRadius:20,boxShadow:'0 10px 30px rgba(0,0,0,0.07)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <span style={{fontWeight:'bold',color:'#9b59b6',fontSize:'0.88rem'}}>Pregunta {sala.indicePregunta+1}/{sala.preguntas.length}</span>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <div style={{background:urgente?'#e74c3c':'#9b59b6',color:'white',padding:'5px 12px',borderRadius:20,fontWeight:900}}>
                        <Clock size={13} style={{verticalAlign:'middle',marginRight:3}}/>{timerLocal}s
                    </div>
                    <div style={g.scoreboard}><Trophy size={13} color="#f1c40f"/> {myScore}</div>
                </div>
            </div>
            {urgente && !submitted && (
                <div style={{background:'#ffeaea',borderRadius:10,padding:'6px 12px',marginBottom:10,color:'#e74c3c',fontWeight:'bold',fontSize:'0.82rem',textAlign:'center'}}>
                    ⚡ ¡Envía tu respuesta antes de que acabe el tiempo!
                </div>
            )}
            {!submitted ? (
                <>
                    <Paleta catSel={catSel} setCatSel={setCatSel} nivel={preg.nivel} tokens={preg.tokens}/>
                    <FraseTokens tokens={preg.tokens} answers={answers} onClickWord={clickWord}/>
                    <div style={{textAlign:'center',marginTop:18}}>
                        <button onClick={enviarRespuesta} style={{...g.btnSuccess,justifyContent:'center'}}>
                            <CheckCircle size={17}/> Enviar Respuesta
                        </button>
                    </div>
                </>
            ) : (
                <div style={{textAlign:'center',padding:'40px 0',color:'#9b59b6'}}>
                    <CheckCircle size={50} style={{marginBottom:12}}/>
                    <h3>¡Respuesta enviada!</h3>
                    <p style={{color:'#888',fontSize:'0.85rem'}}>Esperando al resto de la clase...</p>
                </div>
            )}
        </div>
    );

    return <div style={g.centerBox}><div style={{color:'#555'}}>⏳ Cargando...</div></div>;
}

// ─────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────
const g = {
    container:{minHeight:'100vh',background:'linear-gradient(135deg,#f5f7fa,#e8ecf1)',fontFamily:"'Segoe UI',Tahoma,sans-serif",paddingBottom:40},
    header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 18px',background:'white',boxShadow:'0 2px 10px rgba(0,0,0,0.08)',position:'sticky',top:0,zIndex:100},
    titulo:{fontWeight:'bold',fontSize:'1rem',color:'#2c3e50',textAlign:'center',flex:1,padding:'0 8px'},
    btnBack:{padding:'7px 13px',background:'#f5f5f5',border:'1px solid #ddd',borderRadius:20,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontWeight:'bold',color:'#555',fontSize:'0.82rem',whiteSpace:'nowrap'},
    scoreboard:{background:'#2c3e50',padding:'6px 13px',borderRadius:20,fontWeight:'bold',fontSize:'0.88rem',display:'flex',alignItems:'center',gap:6,color:'white',position:'relative'},
    animPts:{position:'absolute',top:'-10px',right:'-5px',color:'#f1c40f',fontWeight:'bold',fontSize:'1rem',animation:'popUp 2s ease-out forwards',pointerEvents:'none'},
    centerBox:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'80vh',padding:20},
    card:{background:'white',borderRadius:24,padding:'32px 26px',maxWidth:520,width:'100%',textAlign:'center',boxShadow:'0 20px 40px rgba(0,0,0,0.1)'},
    cardTitle:{fontSize:'1.8rem',color:'#2c3e50',marginBottom:8,fontWeight:800},
    inputSmall:{padding:'8px 12px',borderRadius:10,border:'2px solid #ddd',fontSize:'0.85rem',outline:'none',width:'100%',boxSizing:'border-box'},
    btnPrimary:{padding:'12px 24px',background:'#3498db',color:'white',border:'none',borderRadius:30,fontSize:'0.95rem',fontWeight:'bold',cursor:'pointer',display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 14px rgba(52,152,219,0.4)'},
    btnSuccess:{padding:'12px 24px',background:'#27ae60',color:'white',border:'none',borderRadius:30,fontSize:'0.95rem',fontWeight:'bold',cursor:'pointer',display:'flex',alignItems:'center',gap:8,margin:'0 auto',boxShadow:'0 4px 14px rgba(39,174,96,0.4)'},
    btnGray:{padding:'12px 22px',background:'#7f8c8d',color:'white',border:'none',borderRadius:30,fontSize:'0.9rem',fontWeight:'bold',cursor:'pointer',display:'flex',alignItems:'center',gap:7,boxShadow:'0 4px 14px rgba(127,140,141,0.4)'},
};

// Keyframe injection
if (typeof document !== 'undefined' && !document.getElementById('sintaxis-kf')) {
    const s = document.createElement('style');
    s.id = 'sintaxis-kf';
    s.textContent = `@keyframes popUp{0%{opacity:0;transform:translateY(0) scale(.8)}50%{opacity:1;transform:translateY(-28px) scale(1.2)}100%{opacity:0;transform:translateY(-56px) scale(1)}}`;
    document.head.appendChild(s);
}
