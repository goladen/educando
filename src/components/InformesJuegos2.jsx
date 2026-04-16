import React, { useState, useEffect, useCallback } from 'react';
import GruposTab from './GruposTab';
import ModalAgregarAGrupo from './ModalAgregarAGrupo';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, getDoc, doc,
    updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import {
    BarChart2, Users, Calendar, TrendingUp, RefreshCw,
    ChevronDown, ChevronUp, Filter, Save, Edit2, CheckCircle,
    Trash2, AlertTriangle, X, Clock,
    Flame, Sword, Shield, Skull, Heart, Star, CloudRain, Sun, Zap, Ghost,
    Key, Map, Compass, Anchor, Bell, Book, Camera, Car, Castle, Crown,
    Droplet, Eye, Feather, Flag, Gift, Hammer, Home, Leaf, Moon, Music,
    Rocket, Scissors, Smile, Frown, Snowflake, Tent, Trees, Trophy, Umbrella,
    Wand, Watch, Wind, Wrench, Bug, Cat, Dog, Bird, Fish, Coffee, Mountain,
    Bike, Train, Plane
} from 'lucide-react';

const STORY_ICONS = {
    Flame, Sword, Shield, Skull, Heart, Star, CloudRain, Sun, Zap, Ghost,
    Key, Map, Compass, Anchor, Bell, Book, Camera, Car, Castle, Crown,
    Droplet, Eye, Feather, Flag, Gift, Hammer, Home, Leaf, Moon, Music,
    Rocket, Scissors, Smile, Frown, Snowflake, Tent, Trees, Trophy, Umbrella,
    Wand, Watch, Wind, Wrench, Bug, Cat, Dog, Bird, Fish, Coffee, Mountain,
    Bike, Train, Plane,
};
const DiceIcon = ({ name }) => {
    const Icon = STORY_ICONS[name];
    return Icon ? <Icon size={26} strokeWidth={1.5} /> : <span style={{ fontSize:'0.75rem' }}>{name}</span>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pctColor = (p) => p >= 80 ? '#27ae60' : p >= 50 ? '#e67e22' : '#e74c3c';
const pctBg    = (p) => p >= 80 ? '#e8f5e9' : p >= 50 ? '#fff8e1' : '#fdecea';
const fmtFecha = (f) => {
    if (!f) return '—';
    const d = f?.toDate ? f.toDate() : new Date(f);
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })
         + ' ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
};
const TIPO_LABEL  = { OCA:'🦆 Oca Matemática', CAZABURBUJAS:'🔵 Cazaburbujas', PIKATRON:'⚡ Pikatron', SOPA:'🔤 Sopa de Letras', WORDLE:'🟩 Wordle', PASAPALABRA:'🔠 Pasapalabra', FUNCIONES:'∫ Funciones', APAREJADOS:'🃏 Aparejados', STORYCUBES:'🎲 Story Cubes' };
const TIPO_ICON   = { OCA:'🦆', CAZABURBUJAS:'🔵', PIKATRON:'⚡', SOPA:'🔤', WORDLE:'🟩', PASAPALABRA:'🔠', FUNCIONES:'∫', APAREJADOS:'🃏', STORYCUBES:'🎲' };
const tipoLabel   = (t) => TIPO_LABEL[t] || ('🎮 ' + (t||'Juego'));
const tipoIcon    = (t) => TIPO_ICON[t]  || '🎮';

// ─── Colores de los filtros ───────────────────────────────────────────────────
const inp = { padding:'7px 10px', borderRadius:8, border:'1.5px solid #e0e4f0', fontSize:'0.85rem', outline:'none', fontFamily:'inherit' };

// ─── Componente principal ──────────────────────────────────────────────────────
export default function InformesJuegos({ usuario, googleToken }) {
    // Estado del código de profesor
    const [codigoProf,    setCodigoProf]    = useState('');
    const [codigoEdit,    setCodigoEdit]    = useState('');
    const [editandoCod,   setEditandoCod]   = useState(false);
    const [guardandoCod,  setGuardandoCod]  = useState(false);
    const [errCodigo,     setErrCodigo]     = useState('');
    const [codOK,         setCodOK]         = useState(false);

    // Datos
    const [informes,     setInformes]     = useState([]);  // enviados con código
    const [ranking,      setRanking]      = useState([]);  // de recursos propios
    const [cargando,     setCargando]     = useState(true);
    const [error,        setError]        = useState('');

    // Filtros
    const [filtroTipo,   setFiltroTipo]   = useState('');
    const [filtroMod,    setFiltroMod]    = useState('');
    const [filtroFecDes, setFiltroFecDes] = useState('');
    const [filtroFecHas, setFiltroFecHas] = useState('');
    const [mostrarFilt,  setMostrarFilt]  = useState(false);

    // UI
    const [expandido,    setExpandido]    = useState(null);
    const [borrando,     setBorrando]     = useState(null);  // id del informe a borrar
    const [borrandoOk,   setBorrandoOk]   = useState(null);
    const [modalAgregar, setModalAgregar] = useState(null);  // informe seleccionado para añadir a grupo

    // ── Carga del código de profesor desde users collection ──────────────────
    const cargarCodigo = async () => {
        try {
            const snap = await getDoc(doc(db, 'users', usuario.uid));
            const data = snap.exists() ? snap.data() : {};
            if (data.codigoProfesor) {
                setCodigoProf(data.codigoProfesor);
                setCodigoEdit(data.codigoProfesor);
                // Cargar informes directamente aquí para no depender del useEffect
                cargar(data.codigoProfesor);
            } else {
                // Sugerir código basado en uid; profesor decide si guardarlo
                const auto = usuario.uid.substring(0,6).toUpperCase();
                setCodigoProf('');
                setCodigoEdit(auto);
                setEditandoCod(true);
                setCargando(false); // No hay código → no hay nada que cargar
            }
        } catch(e) {
            console.error('Error al cargar código:', e);
            setCargando(false);
        }
    };

    // ── Guardar código con comprobación de duplicados ─────────────────────────
    const guardarCodigo = async () => {
        const nuevo = codigoEdit.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!nuevo || nuevo.length < 3) { setErrCodigo('El código debe tener al menos 3 caracteres.'); return; }
        setGuardandoCod(true); setErrCodigo(''); setCodOK(false);
        try {
            // Comprobar si el código ya existe (el ID del doc ES el código)
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', nuevo));
            if (codigoDoc.exists() && codigoDoc.data().uid !== usuario.uid) {
                setErrCodigo(`El código "${nuevo}" ya está en uso. Elige otro.`);
                setGuardandoCod(false); return;
            }
            // Liberar código anterior si tenía uno
            if (codigoProf && codigoProf !== nuevo) {
                await deleteDoc(doc(db, 'codigos_profesor', codigoProf));
            }
            // Reservar el nuevo código
            await setDoc(doc(db, 'codigos_profesor', nuevo), { uid: usuario.uid });
            // Guardar en el perfil del usuario
            await setDoc(doc(db, 'users', usuario.uid), { codigoProfesor: nuevo }, { merge: true });
            setCodigoProf(nuevo); setEditandoCod(false); setCodOK(true);
            setTimeout(() => setCodOK(false), 3000);
            cargar(nuevo);
        } catch (e) {
            console.error('Error:', e);
            setErrCodigo(`Error: ${e.message}`);
        }
        setGuardandoCod(false);
    };

    // ── Cargar informes ───────────────────────────────────────────────────────
    const cargar = useCallback(async (cod) => {
        const codigo = cod || codigoProf;
        setCargando(true); setError('');
        try {
            const resultados = [];

            // 1. Informes enviados con código (colección informes_juegos)
            if (codigo) {
                const snap = await getDocs(query(
                    collection(db, 'informes_juegos'),
                    where('codigoProfesor', '==', codigo)
                ));
                snap.docs.forEach(d => resultados.push({ id: d.id, ...d.data(), _origen: 'codigo' }));
                // Ordenar client-side para evitar índice compuesto
                resultados.sort((a,b) => {
                    const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha||0);
                    const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha||0);
                    return fb - fa;
                });
            }

            setInformes(resultados);

            // 2. Entradas de ranking de recursos propios
            const misRes = await getDocs(query(
                collection(db, 'resources'),
                where('profesorUid', '==', usuario.uid)
            ));
            const misIds = misRes.docs.map(d => d.id);
            const rankSnap = [];
            // Firestore no permite 'in' con +10 items; hacemos batches de 10
            for (let i = 0; i < misIds.length; i += 10) {
                const batch = misIds.slice(i, i+10);
                if (!batch.length) continue;
                const rq = await getDocs(query(
                    collection(db, 'ranking'),
                    where('recursoId', 'in', batch)
                ));
                rq.docs.forEach(d => rankSnap.push({ id: d.id, ...d.data(), _origen: 'ranking' }));
            }
            // Enriquecer con nombre del recurso
            const resMap = {};
            misRes.docs.forEach(d => { resMap[d.id] = d.data(); });
            const rankEnriquecido = rankSnap.map(r => ({
                ...r,
                _recursoTitulo: resMap[r.recursoId]?.titulo || r.recursoTitulo || '—',
                _tipoJuego:     resMap[r.recursoId]?.tipoJuego || r.tipoJuego || '',
            })).sort((a,b) => {
                const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha||0);
                const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha||0);
                return fb - fa;
            });
            setRanking(rankEnriquecido);
        } catch(e) {
            console.error(e);
            // Fallback sin orderBy si falta índice
            try {
                const snap2 = await getDocs(query(collection(db,'informes_juegos'), where('codigoProfesor','==',(cod||codigoProf))));
                const fb = snap2.docs.map(d=>({id:d.id,...d.data(),_origen:'codigo'})).sort((a,b)=>{
                    const fa2=a.fecha?.toDate?a.fecha.toDate():new Date(a.fecha||0);
                    const fb2=b.fecha?.toDate?b.fecha.toDate():new Date(b.fecha||0);
                    return fb2-fa2;
                });
                setInformes(fb);
            } catch(e2) {
                setError('Error al cargar. Puede que falte un índice de Firestore (ver consola).');
            }
        }
        setCargando(false);
    }, [codigoProf, usuario.uid]);

    useEffect(() => { cargarCodigo(); }, []);

    // ── Borrar informe (solo los de código) ───────────────────────────────────
    const borrar = async (id) => {
        setBorrando(id);
        try {
            await deleteDoc(doc(db, 'informes_juegos', id));
            setInformes(prev => prev.filter(i => i.id !== id));
            setBorrandoOk(id); setTimeout(()=>setBorrandoOk(null),2000);
        } catch(e) { alert('Error al borrar: ' + e.message); }
        setBorrando(null);
    };

    // ── Filtrado combinado ────────────────────────────────────────────────────
    const filtrarItem = (item) => {
        const tipo = item._tipoJuego || item.tipo || '';
        const mod  = item.modalidad  || '';
        if (filtroTipo && tipo !== filtroTipo) return false;
        if (filtroMod  && mod  !== filtroMod)  return false;
        const fecha = item.fecha?.toDate ? item.fecha.toDate() : item.fecha ? new Date(item.fecha) : null;
        if (fecha && filtroFecDes && fecha < new Date(filtroFecDes)) return false;
        if (fecha && filtroFecHas) {
            const hasta = new Date(filtroFecHas); hasta.setHours(23,59,59);
            if (fecha > hasta) return false;
        }
        return true;
    };

    const informesFilt = informes.filter(filtrarItem);
    const rankingFilt  = ranking.filter(filtrarItem);

    // Opciones de filtro
    const todosItems = [...informes, ...ranking];
    const tiposOpts  = [...new Set(todosItems.map(i=>i._tipoJuego||i.tipo).filter(Boolean))];
    const modOpts    = [...new Set(informes.map(i=>i.modalidad).filter(Boolean))];

    // Resumen global
    const totPartidas  = informesFilt.length;
    const totJugadores = informesFilt.reduce((s,i)=>s+(i.jugadores?.length||0),0);
    const totInt       = informesFilt.reduce((s,i)=>s+(i.jugadores||[]).reduce((a,j)=>a+(j.intentos||0),0),0);
    const totAci       = informesFilt.reduce((s,i)=>s+(i.jugadores||[]).reduce((a,j)=>a+(j.aciertos||0),0),0);
    const pctGlobal    = totInt>0 ? Math.round(totAci/totInt*100) : null;
    const totRanking   = rankingFilt.length;

    const filtrosActivos = !!(filtroTipo||filtroMod||filtroFecDes||filtroFecHas);

    const [pestañaActiva, setPestañaActiva] = useState('informes');

    return (
        <div style={{ fontFamily:'Arial,sans-serif', padding:'4px 0 40px' }}>

            {/* ── Pestañas ──────────────────────────────────────────────── */}
            <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid #e0e4f0' }}>
                {[
                    { id:'informes', label:'📋 Informes' },
                    { id:'grupos',   label:'👥 Grupos' },
                ].map(t => (
                    <button key={t.id} onClick={() => setPestañaActiva(t.id)}
                        style={{ padding:'10px 22px', border:'none', background:'none', fontWeight: pestañaActiva===t.id ? 700 : 400,
                            color: pestañaActiva===t.id ? '#1565C0' : '#7f8c8d', cursor:'pointer', fontSize:'0.95rem',
                            borderBottom: pestañaActiva===t.id ? '3px solid #1565C0' : '3px solid transparent',
                            marginBottom:-2, transition:'all 0.15s' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Grupos ────────────────────────────────────────────── */}
            {pestañaActiva === 'grupos' && <GruposTab usuario={usuario} googleToken={googleToken} />}
            {pestañaActiva !== 'grupos' && <>

            {/* ── Cabecera ─────────────────────────────────────────────── */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22, flexWrap:'wrap', gap:10 }}>
                <div>
                    <h2 style={{ color:'#2c3e50', margin:'0 0 4px', fontSize:'1.4rem', display:'flex', alignItems:'center', gap:8 }}>
                        <BarChart2 size={22} color="#1565C0"/> Informes de Juegos
                    </h2>
                    <p style={{ color:'#7f8c8d', margin:0, fontSize:'0.83rem' }}>
                        Resultados de alumnos por código de profesor y de tus recursos propios
                    </p>
                </div>
                <button onClick={()=>cargar()} disabled={cargando} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid #bdc3c7', background:'white', cursor:'pointer', color:'#555', fontSize:'0.83rem' }}>
                    <RefreshCw size={14} style={{ animation: cargando?'spin 1s linear infinite':'none' }}/> Actualizar
                </button>
            </div>

            {/* ── Panel código de profesor ──────────────────────────────── */}
            <div style={{ background:'white', borderRadius:14, padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)', marginBottom:20, border:'1.5px solid #e3eaf8' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                        <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#7f8c8d', letterSpacing:.8, marginBottom:5 }}>
                            TU CÓDIGO DE PROFESOR (compártelo con los alumnos)
                        </div>
                        {editandoCod ? (
                            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                                <input
                                    value={codigoEdit}
                                    onChange={e=>setCodigoEdit(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                                    maxLength={10}
                                    placeholder="Ej: PROFA1"
                                    style={{ ...inp, fontSize:'1.1rem', fontWeight:700, letterSpacing:2, width:140 }}
                                    onFocus={e=>e.target.style.borderColor='#1565C0'}
                                    onBlur={e=>e.target.style.borderColor='#e0e4f0'}
                                />
                                <button onClick={guardarCodigo} disabled={guardandoCod} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#1565C0', color:'white', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'0.85rem' }}>
                                    <Save size={14}/> {guardandoCod?'Comprobando…':'Guardar'}
                                </button>
                                {codigoProf && <button onClick={()=>{setEditandoCod(false);setCodigoEdit(codigoProf);setErrCodigo('');}} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #ddd', background:'white', cursor:'pointer' }}><X size={14}/></button>}
                            </div>
                        ) : (
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <span style={{ fontSize:'1.6rem', fontWeight:900, color:'#1565C0', letterSpacing:3, fontFamily:'monospace' }}>
                                    {codigoProf || '—'}
                                </span>
                                <button onClick={()=>{setEditandoCod(true);setErrCodigo('');}} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #ddd', background:'#f8f9fa', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', color:'#555' }}>
                                    <Edit2 size={12}/> Editar
                                </button>
                                {codOK && <span style={{ color:'#27ae60', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={14}/> Guardado</span>}
                            </div>
                        )}
                        {errCodigo && <div style={{ color:'#e74c3c', fontSize:'0.78rem', marginTop:5, display:'flex', alignItems:'center', gap:5 }}><AlertTriangle size={12}/>{errCodigo}</div>}
                    </div>
                    {codigoProf && (
                        <div style={{ background:'#f0f4ff', borderRadius:10, padding:'8px 14px', fontSize:'0.78rem', color:'#1565C0', textAlign:'center', flexShrink:0 }}>
                            <div style={{ fontWeight:700, marginBottom:2 }}>Los alumnos introducen este código</div>
                            <div style={{ color:'#7f8c8d' }}>al finalizar una partida para enviarte sus resultados</div>
                        </div>
                    )}
                </div>
            </div>

            {error && <div style={{ background:'#fdecea', border:'1px solid #e74c3c', borderRadius:8, padding:'10px 14px', color:'#c0392b', marginBottom:16, fontSize:'0.85rem' }}>{error}</div>}

            {/* ── Tarjetas de resumen ───────────────────────────────────── */}
            {!cargando && (totPartidas > 0 || totRanking > 0) && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:20 }}>
                    {[
                        { icon:'📋', val:totPartidas,   lbl:'Partidas (código)' },
                        { icon:'👥', val:totJugadores,  lbl:'Jugadores' },
                        { icon:'✅', val:`${totAci}/${totInt}`, lbl:'Aciertos' },
                        { icon:'📊', val:pctGlobal!=null?`${pctGlobal}%`:'—', lbl:'% acierto', color:pctGlobal!=null?pctColor(pctGlobal):undefined },
                        { icon:'🏆', val:totRanking,    lbl:'En ranking' },
                    ].map((c,k)=>(
                        <div key={k} style={{ background:'white', borderRadius:12, padding:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', textAlign:'center' }}>
                            <div style={{ fontSize:'1.3rem', marginBottom:2 }}>{c.icon}</div>
                            <div style={{ fontSize:'1.2rem', fontWeight:'bold', color:c.color||'#2c3e50' }}>{c.val}</div>
                            <div style={{ fontSize:'0.68rem', color:'#95a5a6', lineHeight:1.2 }}>{c.lbl}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Filtros ───────────────────────────────────────────────── */}
            <div style={{ marginBottom:16 }}>
                <button onClick={()=>setMostrarFilt(!mostrarFilt)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8, border:`1.5px solid ${filtrosActivos?'#1565C0':'#ddd'}`, background:filtrosActivos?'#e8f0fe':'white', color:filtrosActivos?'#1565C0':'#555', cursor:'pointer', fontSize:'0.82rem', fontWeight:filtrosActivos?700:400 }}>
                    <Filter size={14}/> Filtros {filtrosActivos&&`(activos)`} {mostrarFilt?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                </button>
                {mostrarFilt && (
                    <div style={{ background:'white', borderRadius:10, padding:'14px 16px', marginTop:8, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
                        {tiposOpts.length > 1 && (
                            <div>
                                <div style={{ fontSize:'0.72rem', color:'#7f8c8d', marginBottom:4 }}>Tipo de juego</div>
                                <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={inp}>
                                    <option value="">Todos</option>
                                    {tiposOpts.map(t=><option key={t} value={t}>{tipoLabel(t)}</option>)}
                                </select>
                            </div>
                        )}
                        {modOpts.length > 1 && (
                            <div>
                                <div style={{ fontSize:'0.72rem', color:'#7f8c8d', marginBottom:4 }}>Modalidad</div>
                                <select value={filtroMod} onChange={e=>setFiltroMod(e.target.value)} style={inp}>
                                    <option value="">Todas</option>
                                    {modOpts.map(m=><option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize:'0.72rem', color:'#7f8c8d', marginBottom:4 }}>Desde</div>
                            <input type="date" value={filtroFecDes} onChange={e=>setFiltroFecDes(e.target.value)} style={inp}/>
                        </div>
                        <div>
                            <div style={{ fontSize:'0.72rem', color:'#7f8c8d', marginBottom:4 }}>Hasta</div>
                            <input type="date" value={filtroFecHas} onChange={e=>setFiltroFecHas(e.target.value)} style={inp}/>
                        </div>
                        {filtrosActivos && (
                            <button onClick={()=>{setFiltroTipo('');setFiltroMod('');setFiltroFecDes('');setFiltroFecHas('');}} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e74c3c', background:'white', color:'#e74c3c', cursor:'pointer', fontSize:'0.82rem' }}>
                                ✕ Limpiar
                            </button>
                        )}
                    </div>
                )}
            </div>

            {cargando ? (
                <div style={{ textAlign:'center', padding:'50px 0', color:'#95a5a6' }}>
                    <RefreshCw size={30} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 12px' }}/>
                    Cargando informes…
                </div>
            ) : (
                <>
                    {/* ── Sección: Informes por código ───────────────────── */}
                    <SectionTitle icon="📋" title="Enviados con código" count={informesFilt.length} />
                    {informesFilt.length === 0 ? (
                        <EmptyCard msg={codigoProf ? 'Aún no hay informes con este código.' : 'Configura tu código de profesor para recibir informes.'} />
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
                            {informesFilt.map(inf => {
                                const tipo = inf._tipoJuego || inf.tipo || '';
                                if (tipo === 'STORYCUBES') return (
                                    <StoryCubesCard
                                        key={inf.id} inf={inf}
                                        expandido={expandido===inf.id}
                                        onToggle={()=>setExpandido(expandido===inf.id?null:inf.id)}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        onAgregarAGrupo={()=>setModalAgregar(inf)}
                                    />
                                );
                                return (
                                    <InformeCard
                                        key={inf.id} inf={inf}
                                        expandido={expandido===inf.id}
                                        onToggle={()=>setExpandido(expandido===inf.id?null:inf.id)}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        canDelete={true}
                                        onAgregarAGrupo={()=>setModalAgregar(inf)}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* ── Sección: Ranking de recursos propios ───────────── */}
                    <SectionTitle icon="🏆" title="Ranking de tus recursos" count={rankingFilt.length} subtitle="Solo lectura — pertenecen al ranking global" />
                    {rankingFilt.length === 0 ? (
                        <EmptyCard msg="Aún no hay entradas de ranking en tus recursos." />
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {rankingFilt.map(r => <RankingCard key={r.id} r={r} />)}
                        </div>
                    )}
                </>
            )}

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
            </>}

            {/* ── Modal añadir a grupo ────────────────────────────────────── */}
            {modalAgregar && (
                <ModalAgregarAGrupo
                    informe={modalAgregar}
                    profesorUid={usuario.uid}
                    googleToken={googleToken}
                    onClose={() => setModalAgregar(null)}
                />
            )}
        </div>
    );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
const SectionTitle = ({ icon, title, count, subtitle }) => (
    <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:'1.1rem' }}>{icon}</span>
        <span style={{ fontWeight:700, color:'#2c3e50', fontSize:'1rem' }}>{title}</span>
        <span style={{ background:'#e8f0fe', color:'#1565C0', borderRadius:20, padding:'1px 8px', fontSize:'0.75rem', fontWeight:700 }}>{count}</span>
        {subtitle && <span style={{ color:'#95a5a6', fontSize:'0.75rem' }}> · {subtitle}</span>}
    </div>
);

const EmptyCard = ({ msg }) => (
    <div style={{ background:'white', borderRadius:12, padding:'28px 20px', textAlign:'center', color:'#95a5a6', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', marginBottom:20, fontSize:'0.88rem' }}>
        <div style={{ fontSize:'2rem', marginBottom:8 }}>📭</div>{msg}
    </div>
);

const pctColor2 = (p) => p >= 80 ? '#27ae60' : p >= 50 ? '#e67e22' : '#e74c3c';
const pctBg2    = (p) => p >= 80 ? '#e8f5e9' : p >= 50 ? '#fff8e1' : '#fdecea';

const InformeCard = ({ inf, expandido, onToggle, onBorrar, borrando, borradoOk, canDelete, onAgregarAGrupo }) => {
    const [confirmar, setConfirmar] = useState(false);
    const jugs   = inf.jugadores || [];
    const totInt = jugs.reduce((s,j)=>s+(j.intentos||0), 0);
    const totAci = jugs.reduce((s,j)=>s+(j.aciertos||0), 0);
    const pct    = totInt > 0 ? Math.round(totAci/totInt*100) : (jugs.length>0 ? Math.round(jugs.reduce((s,j)=>s+(j.porcentaje||0),0)/jugs.length) : 0);
    const tipo   = inf._tipoJuego || inf.tipo || '';

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border:'1px solid #f0f0f0' }}>
            <div onClick={onToggle} style={{ padding:'11px 15px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:'1.3rem' }}>{tipoIcon(tipo)}</span>
                <div style={{ flex:1, minWidth:100 }}>
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.92rem' }}>
                        {tipoLabel(tipo)}
                        {inf.modalidad && <span style={{ marginLeft:8, fontWeight:400, color:'#7f8c8d', fontSize:'0.8rem' }}>{inf.modalidad}</span>}
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'#95a5a6', marginTop:1, display:'flex', alignItems:'center', gap:4 }}>
                        <Clock size={10}/>{fmtFecha(inf.fecha)}
                    </div>
                </div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {jugs.slice(0,3).map((j,k)=>(
                        <span key={k} style={{ padding:'2px 7px', borderRadius:20, background:'#f0f0f0', fontSize:'0.72rem', color:'#555' }}>{j.nombre}</span>
                    ))}
                    {jugs.length>3 && <span style={{ padding:'2px 7px', borderRadius:20, background:'#f0f0f0', fontSize:'0.72rem', color:'#555' }}>+{jugs.length-3}</span>}
                </div>
                <span style={{ padding:'3px 9px', borderRadius:20, background:pctBg2(pct), color:pctColor2(pct), fontWeight:700, fontSize:'0.8rem', flexShrink:0 }}>{pct}%</span>
                <button
                    onClick={e=>{ e.stopPropagation(); onAgregarAGrupo?.(); }}
                    style={{ padding:'4px 9px', borderRadius:7, border:'1px solid #c8e6c9', background:'#e8f5e9', color:'#27ae60', cursor:'pointer', flexShrink:0, fontWeight:600, fontSize:'0.75rem', display:'flex', alignItems:'center', gap:4 }}
                    title="Añadir calificación a un grupo"
                >
                    <Users size={12}/> Añadir a grupo
                </button>
                {canDelete && (
                    <button
                        onClick={e=>{ e.stopPropagation(); setConfirmar(true); }}
                        style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }}
                        title="Eliminar informe"
                    ><Trash2 size={13}/></button>
                )}
                {expandido ? <ChevronUp size={16} color="#aaa"/> : <ChevronDown size={16} color="#aaa"/>}
            </div>

            {/* Confirmación borrado */}
            {confirmar && (
                <div style={{ background:'#fdecea', borderTop:'1px solid #fdd', padding:'10px 15px', display:'flex', alignItems:'center', gap:10, fontSize:'0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c"/>
                    <span style={{ flex:1, color:'#c0392b' }}>¿Eliminar este informe? Esta acción no se puede deshacer.</span>
                    <button onClick={()=>{ setConfirmar(false); onBorrar(); }} disabled={borrando} style={{ padding:'4px 12px', borderRadius:7, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                        {borrando?'Borrando…':'Eliminar'}
                    </button>
                    <button onClick={()=>setConfirmar(false)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background:'#e8f5e9', padding:'8px 15px', fontSize:'0.8rem', color:'#27ae60', display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13}/>Eliminado</div>}

            {/* Detalle */}
            {expandido && (
                <div style={{ borderTop:'1px solid #f0f0f0', padding:'12px 15px' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.83rem' }}>
                        <thead>
                            <tr style={{ color:'#95a5a6', fontSize:'0.72rem' }}>
                                <th style={{ textAlign:'left', padding:'4px 6px', fontWeight:600 }}>Jugador</th>
                                <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>Intentos</th>
                                <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>Aciertos</th>
                                <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>%</th>
                                <th style={{ padding:'4px 6px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jugs.map((j,k)=>(
                                <tr key={k} style={{ borderTop:'1px solid #f8f9fa' }}>
                                    <td style={{ padding:'6px 6px', color:'#2c3e50', fontWeight:600 }}>{j.nombre}</td>
                                    <td style={{ padding:'6px 6px', textAlign:'center', color:'#7f8c8d' }}>{j.intentos??'—'}</td>
                                    <td style={{ padding:'6px 6px', textAlign:'center', color:'#27ae60', fontWeight:700 }}>{j.aciertos??'—'}</td>
                                    <td style={{ padding:'6px 6px', textAlign:'center' }}>
                                        <span style={{ padding:'2px 7px', borderRadius:12, background:pctBg2(j.porcentaje), color:pctColor2(j.porcentaje), fontWeight:700, fontSize:'0.78rem' }}>{j.porcentaje}%</span>
                                    </td>
                                    <td style={{ padding:'6px 6px' }}>
                                        <div style={{ height:6, background:'#ecf0f1', borderRadius:3, overflow:'hidden', minWidth:60 }}>
                                            <div style={{ height:'100%', width:`${j.porcentaje}%`, background:pctColor2(j.porcentaje), borderRadius:3 }}/>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop:'2px solid #ecf0f1', fontWeight:700 }}>
                                <td style={{ padding:'6px 6px', color:'#2c3e50', fontSize:'0.78rem' }}>TOTAL</td>
                                <td style={{ padding:'6px 6px', textAlign:'center', color:'#7f8c8d' }}>{totInt||'—'}</td>
                                <td style={{ padding:'6px 6px', textAlign:'center', color:'#27ae60' }}>{totAci}</td>
                                <td style={{ padding:'6px 6px', textAlign:'center' }}>
                                    <span style={{ padding:'2px 7px', borderRadius:12, background:pctBg2(pct), color:pctColor2(pct), fontWeight:700, fontSize:'0.78rem' }}>{pct}%</span>
                                </td>
                                <td/>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Tarjeta especial para Story Cubes ───────────────────────────────────────
const StoryCubesCard = ({ inf, expandido, onToggle, onBorrar, borrando, borradoOk, onAgregarAGrupo }) => {
    const [confirmar, setConfirmar] = useState(false);
    const historia = inf.historia || [];
    const autores  = [...new Set(historia.map(s => s.autor))];

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border:'1.5px solid #e8d5f5' }}>

            {/* Cabecera */}
            <div onClick={onToggle} style={{ padding:'11px 15px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:'1.4rem' }}>🎲</span>
                <div style={{ flex:1, minWidth:100 }}>
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.92rem' }}>
                        Story Cubes
                        <span style={{ marginLeft:8, fontWeight:400, color:'#7f8c8d', fontSize:'0.8rem' }}>Colaborativo Online</span>
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'#95a5a6', marginTop:1, display:'flex', alignItems:'center', gap:4 }}>
                        <Clock size={10}/>{fmtFecha(inf.fecha)}
                        {inf.nombreEnviador && <span style={{ marginLeft:6 }}>· Enviado por <strong>{inf.nombreEnviador}</strong>{inf.cursoEnviador ? ` (${inf.cursoEnviador})` : ''}</span>}
                    </div>
                </div>
                {/* Autores */}
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {autores.slice(0,3).map((a,i) => (
                        <span key={i} style={{ padding:'2px 7px', borderRadius:20, background:'#f3e8fd', fontSize:'0.72rem', color:'#8e44ad' }}>{a}</span>
                    ))}
                    {autores.length > 3 && <span style={{ padding:'2px 7px', borderRadius:20, background:'#f3e8fd', fontSize:'0.72rem', color:'#8e44ad' }}>+{autores.length-3}</span>}
                </div>
                <span style={{ padding:'3px 9px', borderRadius:20, background:'#f3e8fd', color:'#8e44ad', fontWeight:700, fontSize:'0.8rem', flexShrink:0 }}>
                    {historia.length} fragmentos
                </span>
                <button
                    onClick={e=>{ e.stopPropagation(); onAgregarAGrupo?.(); }}
                    style={{ padding:'4px 9px', borderRadius:7, border:'1px solid #c8e6c9', background:'#e8f5e9', color:'#27ae60', cursor:'pointer', flexShrink:0, fontWeight:600, fontSize:'0.75rem', display:'flex', alignItems:'center', gap:4 }}
                    title="Añadir calificación a un grupo"
                >
                    <Users size={12}/> Añadir a grupo
                </button>
                <button
                    onClick={e=>{ e.stopPropagation(); setConfirmar(true); }}
                    style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }}
                    title="Eliminar informe"
                ><Trash2 size={13}/></button>
                {expandido ? <ChevronUp size={16} color="#aaa"/> : <ChevronDown size={16} color="#aaa"/>}
            </div>

            {/* Confirmación borrado */}
            {confirmar && (
                <div style={{ background:'#fdecea', borderTop:'1px solid #fdd', padding:'10px 15px', display:'flex', alignItems:'center', gap:10, fontSize:'0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c"/>
                    <span style={{ flex:1, color:'#c0392b' }}>¿Eliminar este informe? Esta acción no se puede deshacer.</span>
                    <button onClick={()=>{ setConfirmar(false); onBorrar(); }} disabled={borrando} style={{ padding:'4px 12px', borderRadius:7, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                        {borrando?'Borrando…':'Eliminar'}
                    </button>
                    <button onClick={()=>setConfirmar(false)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background:'#e8f5e9', padding:'8px 15px', fontSize:'0.8rem', color:'#27ae60', display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13}/>Eliminado</div>}

            {/* Historia expandida */}
            {expandido && (
                <div style={{ borderTop:'2px solid #f3e8fd', padding:'16px 18px', background:'#fdfaff' }}>
                    <div style={{ fontWeight:700, color:'#8e44ad', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>
                        📖 Historia completa
                    </div>
                    {historia.map((seg, idx) => (
                        <div key={idx} style={{ marginBottom:16, background:'white', borderRadius:10, padding:'12px 14px', borderLeft:'4px solid #8e44ad', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                            {/* Autor */}
                            <div style={{ fontSize:'0.78rem', color:'#8e44ad', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>
                                ✍️ {seg.autor}
                            </div>
                            {/* Dados */}
                            {seg.dados?.length > 0 && (
                                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                                    {seg.dados.map((d, i) => (
                                        <div key={i} style={{ width:52, height:52, background:'white', border:'2px solid #d6aef5', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, color:'#6c3483', boxShadow:'0 2px 6px rgba(142,68,173,0.12)' }}>
                                            <DiceIcon name={d} />
                                            <span style={{ fontSize:'0.55rem', color:'#a569bd', textTransform:'uppercase', letterSpacing:0.3 }}>{d}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Texto */}
                            <div style={{ fontSize:'0.95rem', color:'#2c3e50', lineHeight:1.7, whiteSpace:'pre-wrap', fontStyle: seg.texto==='(sin texto)' ? 'italic' : 'normal', color: seg.texto==='(sin texto)' ? '#bdc3c7' : '#2c3e50' }}>
                                {seg.texto || '(sin texto)'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RankingCard = ({ r }) => (
    <div style={{ background:'white', borderRadius:11, padding:'10px 14px', boxShadow:'0 1px 5px rgba(0,0,0,0.05)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', border:'1px solid #f0f0f0' }}>
        <span style={{ fontSize:'1.1rem' }}>{tipoIcon(r._tipoJuego)}</span>
        <div style={{ flex:1, minWidth:80 }}>
            <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }} title={r._recursoTitulo}>{r._recursoTitulo}</div>
            <div style={{ fontSize:'0.72rem', color:'#95a5a6' }}>{tipoLabel(r._tipoJuego)} · {r.categoria||'General'}</div>
        </div>
        <div style={{ textAlign:'right' }}>
            <div style={{ fontWeight:700, color:'#2c3e50' }}>{r.jugador}</div>
            <div style={{ fontSize:'0.72rem', color:'#7f8c8d' }}>{r.aciertos ?? r.puntuacion ?? '—'} pts · {fmtFecha(r.fecha)}</div>
        </div>
    </div>
);
