import React, { useState, useEffect, useCallback, useRef } from 'react';
import GruposTab, { AgrupacionesTab } from './GruposTab';
import MapaAula from './MapaAula';
import ModalAgregarAGrupo from './ModalAgregarAGrupo';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, getDoc, doc,
    updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { PASOS, INSTRUMENTOS_SEQ } from '../musicUtils';
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
const fmtTiempo = (s) => {
    if (s == null) return '—';
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};
const ConfigBadge = ({ icon, label }) => (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:20, background:'#eef2ff', color:'#3b4fcc', fontSize:'0.72rem', fontWeight:600 }}>
        {icon} {label}
    </span>
);
const TIPO_LABEL  = { OCA:'🦆 Oca Matemática', CAZABURBUJAS:'🔵 Cazaburbujas', PIKATRON:'⚡ Pikatron', SOPA:'🔤 Sopa de Letras', WORDLE:'🟩 Wordle', MATHLE:'🔢 Mathle', PASAPALABRA:'🔠 Pasapalabra', FUNCIONES:'∫ Funciones', FUNCIONES_ANALISIS:'📈 Análisis de Funciones', APAREJADOS:'🃏 Aparejados', STORYCUBES:'🎲 Story Cubes', IRREGULAR_VERBS:'🇬🇧 Verbos Irregulares', THINKHOOT:'🦉 PiLive', MATHLIVE:'🧮 MathLive', OLYMPICLIVE:'🏅 OlympicLive', ALGEBRA:'✖️ Álgebra', DOMINO:'🁣 Dominó', ESTADISTICA:'📊 Estadística', MUSIC_COMPASS:'🎵 Entrenamiento Auditivo', MUSIC_GAMES:'🎼 Juegos Musicales', GEOGRAFIA:'🌍 Test de Geografía', BIOLOGIA:'🔬 Test de Biología' };
const TIPO_ICON   = { OCA:'🦆', CAZABURBUJAS:'🔵', PIKATRON:'⚡', SOPA:'🔤', WORDLE:'🟩', MATHLE:'🔢', PASAPALABRA:'🔠', FUNCIONES:'∫', FUNCIONES_ANALISIS:'📈', APAREJADOS:'🃏', STORYCUBES:'🎲', IRREGULAR_VERBS:'🇬🇧', THINKHOOT:'🦉', MATHLIVE:'🧮', OLYMPICLIVE:'🏅', ALGEBRA:'✖️', DOMINO:'🁣', ESTADISTICA:'📊', MUSIC_COMPASS:'🎵', MUSIC_GAMES:'🎼', GEOGRAFIA:'🌍', BIOLOGIA:'🔬' };
const TIPO_LIVE = new Set(['THINKHOOT', 'MATHLIVE', 'OLYMPICLIVE']);
const tipoLabel   = (t) => TIPO_LABEL[t] || ('🎮 ' + (t||'Juego'));
const tipoIcon    = (t) => TIPO_ICON[t]  || '🎮';

// ─── Colores de los filtros ───────────────────────────────────────────────────
const inp = { padding:'7px 10px', borderRadius:8, border:'1.5px solid #e0e4f0', fontSize:'0.85rem', outline:'none', fontFamily:'inherit' };

// ─── Búsqueda difusa de nombres ──────────────────────────────────────────────
const normNombre = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
const similarNombre = (a, b) => {
    const na = normNombre(a), nb = normNombre(b);
    if (!na || !nb) return 0;
    if (na.includes(nb) || nb.includes(na)) return 1;
    const bigs = s => { const r=new Set(); for(let i=0;i<s.length-1;i++) r.add(s.slice(i,i+2)); return r; };
    const ba=bigs(na), bb=bigs(nb);
    const common=[...ba].filter(g=>bb.has(g)).length;
    return (2*common)/(ba.size+bb.size);
};
const jugadoresDeInforme = inf => {
    if (inf.historia) return inf.historia.map(s=>s.autor||'');
    return (inf.jugadores||[]).map(j=>typeof j==='string'?j:(j.nombre||''));
};

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
    const [informes,        setInformes]        = useState([]);
    const [ranking,         setRanking]         = useState([]);
    const [ritmosGuardados, setRitmosGuardados] = useState([]);
    const [cargando,        setCargando]        = useState(true);
    const [error,           setError]           = useState('');

    // Filtros
    const [filtroTipo,   setFiltroTipo]   = useState('');
    const [filtroMod,    setFiltroMod]    = useState('');
    const [filtroFecDes, setFiltroFecDes] = useState('');
    const [filtroFecHas, setFiltroFecHas] = useState('');
    const [mostrarFilt,  setMostrarFilt]  = useState(false);

    // UI
    const [expandido,    setExpandido]    = useState(null);
    const [borrando,     setBorrando]     = useState(null);
    const [borrandoOk,   setBorrandoOk]   = useState(null);
    const [modalAgregar, setModalAgregar] = useState(null);

    // Selección en lote
    const [modoSeleccion,   setModoSeleccion]   = useState(false);
    const [seleccionados,   setSeleccionados]   = useState(new Set());
    const [borrandoLote,    setBorrandoLote]    = useState(false);

    // Búsqueda por jugador
    const [busquedaJugador, setBusquedaJugador] = useState('');

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

            // 2. Ritmos colaborativos recibidos
            if (codigo) {
                try {
                    const ritmosSnap = await getDocs(query(
                        collection(db, 'ritmos_guardados'),
                        where('codigoProfesor', '==', codigo)
                    ));
                    const ritmos = ritmosSnap.docs
                        .map(d => {
                            const data = d.data();
                            if (Array.isArray(data.grid) && !Array.isArray(data.grid[0])) {
                                data.grid = Array.from({ length: 4 }, (_, i) =>
                                    data.grid.slice(i * 16, (i + 1) * 16).map(Boolean)
                                );
                            }
                            return { id: d.id, ...data };
                        })
                        .sort((a, b) => {
                            const fa = a.creadoEn?.toDate ? a.creadoEn.toDate() : new Date(a.creadoEn || 0);
                            const fb = b.creadoEn?.toDate ? b.creadoEn.toDate() : new Date(b.creadoEn || 0);
                            return fb - fa;
                        });
                    setRitmosGuardados(ritmos);
                } catch (e) { console.error('ritmos_guardados:', e); }
            }

            // 3. Entradas de ranking de recursos propios
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

    // ── Borrar informe individual ─────────────────────────────────────────────
    const borrar = async (id) => {
        setBorrando(id);
        try {
            await deleteDoc(doc(db, 'informes_juegos', id));
            setInformes(prev => prev.filter(i => i.id !== id));
            setBorrandoOk(id); setTimeout(()=>setBorrandoOk(null),2000);
        } catch(e) { alert('Error al borrar: ' + e.message); }
        setBorrando(null);
    };

    // ── Borrar en lote ────────────────────────────────────────────────────────
    const borrarLote = async () => {
        setBorrandoLote(true);
        try {
            await Promise.all([...seleccionados].map(id => deleteDoc(doc(db, 'informes_juegos', id))));
            setInformes(prev => prev.filter(i => !seleccionados.has(i.id)));
            setSeleccionados(new Set());
            setModoSeleccion(false);
        } catch(e) { alert('Error al borrar: ' + e.message); }
        setBorrandoLote(false);
    };

    const toggleSeleccion = (id) => setSeleccionados(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

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

    const informesFiltFinal = busquedaJugador
        ? informesFilt.filter(inf => jugadoresDeInforme(inf).some(n => similarNombre(n, busquedaJugador) >= 0.5))
        : informesFilt;

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
    const totRitmos    = ritmosGuardados.length;

    const filtrosActivos = !!(filtroTipo||filtroMod||filtroFecDes||filtroFecHas);

    const [pestañaActiva, setPestañaActiva] = useState('informes');

    return (
        <div style={{ fontFamily:'Arial,sans-serif', padding:'4px 0 40px' }}>

            {/* ── Pestañas ──────────────────────────────────────────────── */}
            <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid #e0e4f0', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                {[
                    { id:'informes',     label:'📋 Informes' },
                    { id:'grupos',       label:'👥 Grupos' },
                    { id:'agrupaciones', label:'🗂 Agrupaciones' },
                    { id:'plano',        label:'🪑 Plano' },
                ].map(t => (
                    <button key={t.id} onClick={() => setPestañaActiva(t.id)}
                        style={{ padding:'10px 16px', border:'none', background:'none', fontWeight: pestañaActiva===t.id ? 700 : 400,
                            color: pestañaActiva===t.id ? '#1565C0' : '#7f8c8d', cursor:'pointer', fontSize:'0.9rem',
                            borderBottom: pestañaActiva===t.id ? '3px solid #1565C0' : '3px solid transparent',
                            marginBottom:-2, transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0 }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Grupos ────────────────────────────────────────────── */}
            {pestañaActiva === 'grupos' && <GruposTab usuario={usuario} googleToken={googleToken} />}
            {/* ── Tab Agrupaciones ──────────────────────────────────────── */}
            {pestañaActiva === 'agrupaciones' && <AgrupacionesTab usuario={usuario} />}
            {/* ── Tab Plano de clase ────────────────────────────────────── */}
            {pestañaActiva === 'plano' && <MapaAula usuario={usuario} />}
            {pestañaActiva !== 'grupos' && pestañaActiva !== 'agrupaciones' && pestañaActiva !== 'plano' && <>

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
            {!cargando && (totPartidas > 0 || totRanking > 0 || totRitmos > 0) && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:20 }}>
                    {[
                        { icon:'📋', val:totPartidas,   lbl:'Partidas (código)' },
                        { icon:'👥', val:totJugadores,  lbl:'Jugadores' },
                        { icon:'✅', val:`${totAci}/${totInt}`, lbl:'Aciertos' },
                        { icon:'📊', val:pctGlobal!=null?`${pctGlobal}%`:'—', lbl:'% acierto', color:pctGlobal!=null?pctColor(pctGlobal):undefined },
                        { icon:'🏆', val:totRanking,    lbl:'En ranking' },
                        { icon:'🥁', val:totRitmos,     lbl:'Ritmos' },
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
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                        <SectionTitle icon="📋" title="Enviados con código" count={informesFiltFinal.length} />
                        <div style={{ flex:1 }}/>
                        {/* Toolbar selección */}
                        <button onClick={() => { setModoSeleccion(!modoSeleccion); setSeleccionados(new Set()); }}
                            style={{ padding:'5px 11px', borderRadius:7, border:`1.5px solid ${modoSeleccion?'#e74c3c':'#bdc3c7'}`, background:modoSeleccion?'#fdecea':'white', color:modoSeleccion?'#e74c3c':'#555', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
                            {modoSeleccion ? '✕ Cancelar' : '☑ Seleccionar'}
                        </button>
                        {modoSeleccion && (
                            <button onClick={() => setSeleccionados(new Set(informesFiltFinal.map(i=>i.id)))}
                                style={{ padding:'5px 11px', borderRadius:7, border:'1.5px solid #1565C0', background:'#e8f0fe', color:'#1565C0', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
                                Seleccionar todo
                            </button>
                        )}
                        {modoSeleccion && seleccionados.size > 0 && (
                            <button onClick={() => { if(window.confirm(`¿Eliminar ${seleccionados.size} informe(s)? Esta acción no se puede deshacer.`)) borrarLote(); }}
                                disabled={borrandoLote}
                                style={{ padding:'5px 11px', borderRadius:7, border:'none', background: borrandoLote?'#aaa':'#e74c3c', color:'white', cursor:'pointer', fontSize:'0.78rem', fontWeight:700 }}>
                                {borrandoLote ? 'Eliminando…' : `🗑 Eliminar ${seleccionados.size}`}
                            </button>
                        )}
                    </div>

                    {/* Banner búsqueda jugador */}
                    {busquedaJugador && (
                        <div style={{ background:'#e8f0fe', borderRadius:10, padding:'9px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:'0.84rem', color:'#1565C0', flex:1 }}>
                                🔍 Resultados de <strong>"{busquedaJugador}"</strong> — {informesFiltFinal.length} partida(s)
                            </span>
                            <button onClick={()=>setBusquedaJugador('')}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'#1565C0', fontSize:'1rem', padding:0 }}>✕</button>
                        </div>
                    )}

                    {informesFiltFinal.length === 0 ? (
                        <EmptyCard msg={codigoProf ? (busquedaJugador ? 'Sin resultados para ese jugador.' : 'Aún no hay informes con este código.') : 'Configura tu código de profesor para recibir informes.'} />
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
                            {informesFiltFinal.map(inf => {
                                const tipo = inf._tipoJuego || inf.tipo || '';
                                const selec = seleccionados.has(inf.id);
                                if (tipo === 'MUSIC_COMPASS') return (
                                    <MusicCompassCard
                                        key={inf.id} inf={inf}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        modoSeleccion={modoSeleccion}
                                        seleccionado={selec}
                                        onSeleccionar={()=>toggleSeleccion(inf.id)}
                                        onBuscarJugador={setBusquedaJugador}
                                    />
                                );
                                if (tipo === 'STORYCUBES') return (
                                    <StoryCubesCard
                                        key={inf.id} inf={inf}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        onAgregarAGrupo={()=>setModalAgregar(inf)}
                                        modoSeleccion={modoSeleccion}
                                        seleccionado={selec}
                                        onSeleccionar={()=>toggleSeleccion(inf.id)}
                                        onBuscarJugador={setBusquedaJugador}
                                    />
                                );
                                if (tipo === 'MUSIC_GAMES') return (
                                    <MusicGamesCard
                                        key={inf.id} inf={inf}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        modoSeleccion={modoSeleccion}
                                        seleccionado={selec}
                                        onSeleccionar={()=>toggleSeleccion(inf.id)}
                                        onBuscarJugador={setBusquedaJugador}
                                    />
                                );
                                if (tipo === 'OAOA') return (
                                    <OAOACard
                                        key={inf.id} inf={inf}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        modoSeleccion={modoSeleccion}
                                        seleccionado={selec}
                                        onSeleccionar={()=>toggleSeleccion(inf.id)}
                                        onBuscarJugador={setBusquedaJugador}
                                    />
                                );
                                if (tipo === 'CALCULO') return (
                                    <CalculoCard
                                        key={inf.id} inf={inf}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        modoSeleccion={modoSeleccion}
                                        seleccionado={selec}
                                        onSeleccionar={()=>toggleSeleccion(inf.id)}
                                        onBuscarJugador={setBusquedaJugador}
                                    />
                                );
                                return (
                                    <InformeCard
                                        key={inf.id} inf={inf}
                                        expandido={expandido===inf.id}
                                        onToggle={()=>{ if(!modoSeleccion) setExpandido(expandido===inf.id?null:inf.id); else toggleSeleccion(inf.id); }}
                                        onBorrar={()=>borrar(inf.id)}
                                        borrando={borrando===inf.id}
                                        borradoOk={borrandoOk===inf.id}
                                        canDelete={true}
                                        onAgregarAGrupo={()=>setModalAgregar(inf)}
                                        modoSeleccion={modoSeleccion}
                                        seleccionado={selec}
                                        onSeleccionar={()=>toggleSeleccion(inf.id)}
                                        onBuscarJugador={setBusquedaJugador}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* ── Sección: Ritmos colaborativos ──────────────────── */}
                    <SectionTitle icon="🥁" title="Ritmos de alumnos" count={totRitmos} />
                    {totRitmos === 0 ? (
                        <EmptyCard msg={codigoProf ? 'Aún no has recibido ningún ritmo.' : 'Configura tu código para recibir ritmos.'} />
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
                            {ritmosGuardados.map(r => <RitmoCard key={r.id} ritmo={r} />)}
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

const InformeCard = ({ inf, expandido, onToggle, onBorrar, borrando, borradoOk, canDelete, onAgregarAGrupo, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) => {
    const [confirmar, setConfirmar] = useState(false);
    const jugs   = inf.jugadores || [];
    const totInt = jugs.reduce((s,j)=>s+(j.intentos||0), 0);
    const totAci = jugs.reduce((s,j)=>s+(j.aciertos||0), 0);
    const pct    = totInt > 0 ? Math.round(totAci/totInt*100) : (jugs.length>0 ? Math.round(jugs.reduce((s,j)=>s+(j.porcentaje||0),0)/jugs.length) : 0);
    const tipo   = inf._tipoJuego || inf.tipo || '';

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border: seleccionado ? '2px solid #1565C0' : '1px solid #f0f0f0', transition:'border 0.1s' }}>
            <div onClick={onToggle} style={{ padding:'11px 15px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', background: seleccionado ? '#f0f4ff' : 'white' }}>
                {modoSeleccion && (
                    <input type="checkbox" checked={seleccionado} onChange={e=>{e.stopPropagation();onSeleccionar();}}
                        onClick={e=>e.stopPropagation()}
                        style={{ width:17, height:17, cursor:'pointer', accentColor:'#1565C0', flexShrink:0 }}/>
                )}
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
                    {jugs.slice(0,3).map((j,k)=> j.nombre ? (
                        <span key={k} onClick={e=>{ e.stopPropagation(); onBuscarJugador?.(j.nombre); }}
                            style={{ padding:'2px 7px', borderRadius:20, background:'#f0f0f0', fontSize:'0.72rem', color:'#555', cursor:'pointer' }}
                            title={`Ver todos los resultados de ${j.nombre}`}>
                            {j.nombre}
                        </span>
                    ) : null)}
                    {jugs.length>3 && <span style={{ padding:'2px 7px', borderRadius:20, background:'#f0f0f0', fontSize:'0.72rem', color:'#555' }}>+{jugs.length-3}</span>}
                </div>
                <span style={{ padding:'3px 9px', borderRadius:20, background:pctBg2(pct), color:pctColor2(pct), fontWeight:700, fontSize:'0.8rem', flexShrink:0 }}>{pct}%</span>
                {!modoSeleccion && (
                    <button
                        onClick={e=>{ e.stopPropagation(); onAgregarAGrupo?.(); }}
                        style={{ padding:'4px 9px', borderRadius:7, border:'1px solid #c8e6c9', background:'#e8f5e9', color:'#27ae60', cursor:'pointer', flexShrink:0, fontWeight:600, fontSize:'0.75rem', display:'flex', alignItems:'center', gap:4 }}
                        title="Añadir calificación a un grupo"
                    >
                        <Users size={12}/> Añadir a grupo
                    </button>
                )}
                {canDelete && !modoSeleccion && (
                    <button
                        onClick={e=>{ e.stopPropagation(); setConfirmar(true); }}
                        style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }}
                        title="Eliminar informe"
                    ><Trash2 size={13}/></button>
                )}
                {!modoSeleccion && (expandido ? <ChevronUp size={16} color="#aaa"/> : <ChevronDown size={16} color="#aaa"/>)}
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
                    {/* Config badges */}
                    {(() => {
                        const cfg = inf.config || {};
                        const jugador0 = (inf.jugadores || [])[0] || {};
                        const badges = [];
                        if (tipo === 'MATHLE') {
                            if (cfg.operacion) badges.push(<ConfigBadge key="op" icon="➕" label={cfg.operacion}/>);
                            if (cfg.cifras)    badges.push(<ConfigBadge key="cif" icon="🔢" label={`${cfg.cifras} cifras`}/>);
                        } else if (tipo === 'WORDLE') {
                            if (cfg.idioma)   badges.push(<ConfigBadge key="id" icon="🌐" label={cfg.idioma}/>);
                            if (cfg.longitud) badges.push(<ConfigBadge key="lon" icon="🔤" label={`${cfg.longitud} letras`}/>);
                            if (cfg.modo)     badges.push(<ConfigBadge key="modo" icon="🎮" label={cfg.modo}/>);
                        } else if (tipo === 'SOPA') {
                            if (cfg.idioma)      badges.push(<ConfigBadge key="id" icon="🌐" label={cfg.idioma}/>);
                            if (cfg.numPalabras) badges.push(<ConfigBadge key="np" icon="📝" label={`${cfg.numPalabras} palabras`}/>);
                        } else if (tipo === 'IRREGULAR_VERBS') {
                            if (cfg.nivel)     badges.push(<ConfigBadge key="niv" icon="📊" label={cfg.nivel}/>);
                            if (cfg.numVerbos) badges.push(<ConfigBadge key="nv" icon="🔢" label={`${cfg.numVerbos} verbos`}/>);
                            if (cfg.modo)      badges.push(<ConfigBadge key="modo" icon="📝" label={cfg.modo}/>);
                        } else if (tipo === 'GEOGRAFIA') {
                            const modoLabel = { mundo:'Países del Mundo', provincias:'Provincias ESP', fisico:'Geo. Física', banderas:'Banderas' };
                            const modoIcon  = { mundo:'🌍', provincias:'🗺️', fisico:'🏔️', banderas:'🚩' };
                            if (cfg.modoJuego)     badges.push(<ConfigBadge key="mj" icon={modoIcon[cfg.modoJuego]||'🌍'} label={modoLabel[cfg.modoJuego] || cfg.modoJuego}/>);
                            if (cfg.zona)          badges.push(<ConfigBadge key="z"  icon="📍" label={cfg.zona}/>);
                            if (cfg.tipoElemento)  badges.push(<ConfigBadge key="te" icon="🌊" label={cfg.tipoElemento}/>);
                            if (cfg.tipoPregunta)  badges.push(<ConfigBadge key="tp" icon="❓" label={cfg.tipoPregunta}/>);
                            if (cfg.modoRespuesta) badges.push(<ConfigBadge key="mr" icon="📝" label={cfg.modoRespuesta}/>);
                        } else if (tipo === 'BIOLOGIA') {
                          const modoLabel = { cuerpo:'Partes del Cuerpo', musculos:'Músculos', huesos:'Huesos', circulatorio:'Sist. Circulatorio', digestivo:'Sist. Digestivo', respiratorio:'Sist. Respiratorio' };
                          const modoIcon  = { cuerpo:'🧍', musculos:'💪', huesos:'🦴', circulatorio:'🫀', digestivo:'🍽️', respiratorio:'🫁' };
                          if (cfg.modoJuego)     badges.push(<ConfigBadge key="mj" icon={modoIcon[cfg.modoJuego]||'🔬'} label={modoLabel[cfg.modoJuego]||cfg.modoJuego}/>);
                          if (cfg.nivel)         badges.push(<ConfigBadge key="niv" icon="📊" label={cfg.nivel}/>);
                          if (cfg.modoRespuesta) badges.push(<ConfigBadge key="mr" icon="📝" label={cfg.modoRespuesta}/>);
                        } else if (tipo === 'FUNCIONES_ANALISIS') {
                            const tf = cfg.tipoFuncion || jugador0.tipoEjercicio;
                            const id = cfg.idFuncion   || jugador0.idFuncion;
                            if (tf) badges.push(<ConfigBadge key="tf" icon="📈" label={tf}/>);
                            if (id) badges.push(<ConfigBadge key="id" icon="🔖" label={`Ejercicio #${id}`}/>);
                        } else if (tipo === 'FUNCIONES') {
                            const te = cfg.tipoEjercicio || jugador0.tipoEjercicio;
                            if (te) badges.push(<ConfigBadge key="te" icon="∫" label={te}/>);
                        }
                        return badges.length > 0 ? (
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>{badges}</div>
                        ) : null;
                    })()}
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.83rem' }}>
                        <thead>
                            <tr style={{ color:'#95a5a6', fontSize:'0.72rem' }}>
                                <th style={{ textAlign:'left', padding:'4px 6px', fontWeight:600 }}>Jugador</th>
                                {TIPO_LIVE.has(tipo)
                                    ? <>
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600, color:'#f1c40f' }}>Puntos</th>
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600, color:'#27ae60' }}>✓</th>
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600, color:'#e74c3c' }}>✗</th>
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>%</th>
                                    </>
                                    : <>
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>Intentos</th>
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>Aciertos</th>
                                        {jugs.some(j=>j.tiempo!=null) && <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600, color:'#7f8c8d' }}>⏱ Tiempo</th>}
                                        <th style={{ textAlign:'center', padding:'4px 6px', fontWeight:600 }}>%</th>
                                        <th style={{ padding:'4px 6px' }}></th>
                                    </>
                                }
                            </tr>
                        </thead>
                        <tbody>
                            {jugs.map((j,k)=>(
                                <tr key={k} style={{ borderTop:'1px solid #f8f9fa' }}>
                                    <td style={{ padding:'6px 6px', color:'#2c3e50', fontWeight:600 }}>
                                        <span onClick={()=>onBuscarJugador?.(j.nombre)} style={{ cursor:'pointer', borderBottom:'1px dotted #aaa' }} title="Ver todos sus resultados">{j.nombre}</span>
                                    </td>
                                    {TIPO_LIVE.has(tipo)
                                        ? <>
                                            <td style={{ padding:'6px 6px', textAlign:'center', color:'#e67e22', fontWeight:700 }}>{j.puntos??'—'}</td>
                                            <td style={{ padding:'6px 6px', textAlign:'center', color:'#27ae60', fontWeight:700 }}>{j.aciertos??'—'}</td>
                                            <td style={{ padding:'6px 6px', textAlign:'center', color:'#e74c3c', fontWeight:700 }}>{j.fallos??'—'}</td>
                                            <td style={{ padding:'6px 6px', textAlign:'center' }}>
                                                <span style={{ padding:'2px 7px', borderRadius:12, background:pctBg2(j.precision??j.porcentaje), color:pctColor2(j.precision??j.porcentaje), fontWeight:700, fontSize:'0.78rem' }}>{j.precision??j.porcentaje??'—'}{(j.precision!=null||j.porcentaje!=null)?'%':''}</span>
                                            </td>
                                        </>
                                        : <>
                                            <td style={{ padding:'6px 6px', textAlign:'center', color:'#7f8c8d' }}>{j.intentos??'—'}</td>
                                            <td style={{ padding:'6px 6px', textAlign:'center', color:'#27ae60', fontWeight:700 }}>{j.aciertos??'—'}</td>
                                            {jugs.some(j2=>j2.tiempo!=null) && (
                                                <td style={{ padding:'6px 6px', textAlign:'center', color:'#7f8c8d' }}>{fmtTiempo(j.tiempo)}</td>
                                            )}
                                            <td style={{ padding:'6px 6px', textAlign:'center' }}>
                                                <span style={{ padding:'2px 7px', borderRadius:12, background:pctBg2(j.porcentaje), color:pctColor2(j.porcentaje), fontWeight:700, fontSize:'0.78rem' }}>{j.porcentaje}%</span>
                                            </td>
                                            <td style={{ padding:'6px 6px' }}>
                                                <div style={{ height:6, background:'#ecf0f1', borderRadius:3, overflow:'hidden', minWidth:60 }}>
                                                    <div style={{ height:'100%', width:`${j.porcentaje}%`, background:pctColor2(j.porcentaje), borderRadius:3 }}/>
                                                </div>
                                            </td>
                                        </>
                                    }
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop:'2px solid #ecf0f1', fontWeight:700 }}>
                                <td style={{ padding:'6px 6px', color:'#2c3e50', fontSize:'0.78rem' }}>TOTAL</td>
                                <td style={{ padding:'6px 6px', textAlign:'center', color:'#7f8c8d' }}>{totInt||'—'}</td>
                                <td style={{ padding:'6px 6px', textAlign:'center', color:'#27ae60' }}>{totAci}</td>
                                {jugs.some(j=>j.tiempo!=null) && <td/>}
                                <td style={{ padding:'6px 6px', textAlign:'center' }}>
                                    <span style={{ padding:'2px 7px', borderRadius:12, background:pctBg2(pct), color:pctColor2(pct), fontWeight:700, fontSize:'0.78rem' }}>{pct}%</span>
                                </td>
                                <td/>
                            </tr>
                        </tfoot>
                    </table>
                    {/* Desglose de módulos para ALGEBRA */}
                    {tipo === 'ALGEBRA' && jugs.some(j => j.modulos?.length > 0) && (
                        <div style={{ marginTop:12, padding:'10px 12px', background:'#f8f9fa', borderRadius:10, border:'1px solid #ecf0f1' }}>
                            <div style={{ fontSize:'0.72rem', color:'#7f8c8d', fontWeight:700, letterSpacing:.5, marginBottom:8 }}>DESGLOSE POR MÓDULO</div>
                            {jugs[0].modulos.map((m,i) => (
                                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid #ecf0f1', fontSize:'0.82rem' }}>
                                    <span style={{ color:'#2c3e50' }}>{m.nombre}</span>
                                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                        <span style={{ color:'#7f8c8d' }}>{m.aciertos}/{m.intentos}</span>
                                        <span style={{ padding:'2px 7px', borderRadius:12, background:pctBg2(m.porcentaje), color:pctColor2(m.porcentaje), fontWeight:700, fontSize:'0.75rem' }}>{m.porcentaje}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Tarjeta especial para Bloques OAOA (Cálculo Primaria) ──────────────────
const OAOACard = ({ inf, onBorrar, borrando, borradoOk, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) => {
    const [confirmar, setConfirmar] = useState(false);
    const j = (inf.jugadores || [])[0] || {};
    const sumas  = j.sumas  || { aciertos: 0, intentos: 0 };
    const restas = j.restas || { aciertos: 0, intentos: 0 };
    const pctSumas  = sumas.intentos  > 0 ? Math.round((sumas.aciertos  / sumas.intentos)  * 100) : 0;
    const pctRestas = restas.intentos > 0 ? Math.round((restas.aciertos / restas.intentos) * 100) : 0;
    const pctTotal  = j.porcentaje ?? (j.intentos > 0 ? Math.round((j.aciertos / j.intentos) * 100) : 0);
    const pctColor  = p => p >= 80 ? '#27ae60' : p >= 50 ? '#e67e22' : '#e74c3c';

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border: seleccionado ? '2px solid #1565C0' : '1.5px solid #e8e8e8', transition:'border 0.1s' }}>
            {/* Cabecera */}
            <div onClick={modoSeleccion ? onSeleccionar : undefined} style={{ padding:'11px 15px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', cursor: modoSeleccion ? 'pointer' : 'default', background: seleccionado ? '#f0f4ff' : 'white' }}>
                {modoSeleccion && (
                    <input type="checkbox" checked={seleccionado} onChange={e=>{e.stopPropagation();onSeleccionar();}} onClick={e=>e.stopPropagation()} style={{ width:17, height:17, cursor:'pointer', accentColor:'#1565C0', flexShrink:0 }}/>
                )}
                <span style={{ fontSize:'1.4rem' }}>🧮</span>
                <div style={{ flex:1, minWidth:100 }}>
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.92rem' }}>
                        Bloques OAOA
                        <span style={{ marginLeft:8, fontWeight:400, color:'#7f8c8d', fontSize:'0.8rem' }}>Cálculo Primaria</span>
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'#95a5a6', marginTop:1 }}>
                        {fmtFecha(inf.fecha)}
                        {j.nombre && <> · <span onClick={e=>{e.stopPropagation();onBuscarJugador?.(j.nombre);}} style={{ cursor:'pointer', borderBottom:'1px dotted #aaa', fontWeight:600, color:'#2c3e50' }}>{j.nombre}</span></>}
                        {j.curso  && <span style={{ marginLeft:5, color:'#aaa' }}>({j.curso})</span>}
                    </div>
                </div>
                {/* Badges sumas / restas */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {sumas.intentos > 0 && (
                        <span style={{ padding:'2px 8px', borderRadius:20, background:'#fff3e0', color:'#FF6B35', fontWeight:700, fontSize:'0.78rem' }}>
                            ➕ {sumas.aciertos}/{sumas.intentos} ({pctSumas}%)
                        </span>
                    )}
                    {restas.intentos > 0 && (
                        <span style={{ padding:'2px 8px', borderRadius:20, background:'#fce4ec', color:'#E91E63', fontWeight:700, fontSize:'0.78rem' }}>
                            ➖ {restas.aciertos}/{restas.intentos} ({pctRestas}%)
                        </span>
                    )}
                    <span style={{ padding:'2px 8px', borderRadius:20, background:'#f3f4f6', fontWeight:700, fontSize:'0.78rem', color: pctColor(pctTotal) }}>
                        Total {pctTotal}%
                    </span>
                </div>
                {!modoSeleccion && (
                    <button onClick={e=>{e.stopPropagation();setConfirmar(true);}} style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }} title="Eliminar informe">
                        <Trash2 size={13}/>
                    </button>
                )}
            </div>
            {confirmar && (
                <div style={{ background:'#fdecea', borderTop:'1px solid #fdd', padding:'10px 15px', display:'flex', alignItems:'center', gap:10, fontSize:'0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c"/>
                    <span style={{ flex:1, color:'#c0392b' }}>¿Eliminar este informe?</span>
                    <button onClick={()=>{setConfirmar(false);onBorrar();}} disabled={borrando} style={{ padding:'4px 12px', borderRadius:7, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>{borrando?'Borrando…':'Eliminar'}</button>
                    <button onClick={()=>setConfirmar(false)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background:'#e8f5e9', padding:'8px 15px', fontSize:'0.8rem', color:'#27ae60', display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13}/>Eliminado</div>}
        </div>
    );
};

// ─── Tarjeta especial para Cálculo Mental ────────────────────────────────────
const CalculoCard = ({ inf, onBorrar, borrando, borradoOk, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) => {
    const [confirmar, setConfirmar] = useState(false);
    const j = (inf.jugadores || [])[0] || {};
    const aciertos = j.aciertos ?? 0;
    const fallos   = j.fallos   ?? 0;
    const intentos = j.intentos ?? (aciertos + fallos);
    const puntos   = j.puntos   ?? 0;
    const skips    = j.skips    ?? 0;
    const pct      = j.porcentaje ?? (intentos > 0 ? Math.round((aciertos / intentos) * 100) : 0);
    const pctColor = p => p >= 80 ? '#27ae60' : p >= 50 ? '#e67e22' : '#e74c3c';
    const cfg      = j.config || {};

    const opsActivas = cfg.operaciones
        ? Object.entries(cfg.operaciones).filter(([,v]) => v).map(([k]) =>
            ({ suma: '➕', resta: '➖', multiplicacion: '✖️', division: '➗' }[k] || k))
        : [];
    const tiposActivos = cfg.tipos
        ? Object.entries(cfg.tipos).filter(([,v]) => v).map(([k]) =>
            ({ positivos: 'Positivos', negativos: 'Negativos', decimales: 'Decimales', fracciones: 'Fracciones' }[k] || k))
        : [];
    const modoTexto = cfg.numEjercicios
        ? `${cfg.numEjercicios} ejercicios`
        : cfg.tiempo
        ? `${cfg.tiempo < 60 ? cfg.tiempo + 's' : cfg.tiempo / 60 + ' min'}`
        : null;

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border: seleccionado ? '2px solid #1565C0' : '1.5px solid #fce4ec', transition:'border 0.1s' }}>
            {/* Cabecera */}
            <div onClick={modoSeleccion ? onSeleccionar : undefined} style={{ padding:'11px 15px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', cursor: modoSeleccion ? 'pointer' : 'default', background: seleccionado ? '#f0f4ff' : 'white' }}>
                {modoSeleccion && (
                    <input type="checkbox" checked={seleccionado} onChange={e=>{e.stopPropagation();onSeleccionar();}} onClick={e=>e.stopPropagation()} style={{ width:17, height:17, cursor:'pointer', accentColor:'#1565C0', flexShrink:0 }}/>
                )}
                <span style={{ fontSize:'1.4rem' }}>🧠</span>
                <div style={{ flex:1, minWidth:100 }}>
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.92rem' }}>
                        Cálculo Mental
                        {puntos > 0 && <span style={{ marginLeft:8, fontWeight:400, color:'#E91E63', fontSize:'0.8rem' }}>🏆 {puntos} pts</span>}
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'#95a5a6', marginTop:1 }}>
                        {fmtFecha(inf.fecha)}
                        {j.nombre && <> · <span onClick={e=>{e.stopPropagation();onBuscarJugador?.(j.nombre);}} style={{ cursor:'pointer', borderBottom:'1px dotted #aaa', fontWeight:600, color:'#2c3e50' }}>{j.nombre}</span></>}
                        {j.curso  && <span style={{ marginLeft:5, color:'#aaa' }}>({j.curso})</span>}
                    </div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, background:'#e8f5e9', color:'#27ae60', fontWeight:700, fontSize:'0.78rem' }}>✅ {aciertos}</span>
                    <span style={{ padding:'2px 8px', borderRadius:20, background:'#fdecea', color:'#e74c3c', fontWeight:700, fontSize:'0.78rem' }}>❌ {fallos}</span>
                    {skips > 0 && <span style={{ padding:'2px 8px', borderRadius:20, background:'#fff8e1', color:'#f39c12', fontWeight:700, fontSize:'0.78rem' }}>⏭ {skips}</span>}
                    <span style={{ padding:'2px 8px', borderRadius:20, background:'#f3f4f6', fontWeight:700, fontSize:'0.78rem', color: pctColor(pct) }}>{pct}%</span>
                </div>
                {!modoSeleccion && (
                    <button onClick={e=>{e.stopPropagation();setConfirmar(true);}} style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }} title="Eliminar informe">
                        <Trash2 size={13}/>
                    </button>
                )}
            </div>
            {/* Desglose configuración */}
            {(opsActivas.length > 0 || tiposActivos.length > 0 || modoTexto) && (
                <div style={{ padding:'8px 15px 10px', borderTop:'1px solid #fce4ec', background:'#fff9fb', display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                    {opsActivas.length > 0 && (
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:'0.7rem', color:'#aaa', fontWeight:600 }}>OPS</span>
                            {opsActivas.map(op => (
                                <span key={op} style={{ padding:'1px 7px', borderRadius:10, background:'#fce4ec', color:'#E91E63', fontWeight:700, fontSize:'0.78rem' }}>{op}</span>
                            ))}
                        </div>
                    )}
                    {tiposActivos.length > 0 && (
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:'0.7rem', color:'#aaa', fontWeight:600 }}>TIPO</span>
                            {tiposActivos.map(t => (
                                <span key={t} style={{ padding:'1px 7px', borderRadius:10, background:'#f3f4f6', color:'#555', fontWeight:600, fontSize:'0.75rem' }}>{t}</span>
                            ))}
                        </div>
                    )}
                    {(cfg.minNum != null || cfg.maxNum != null) && (
                        <span style={{ fontSize:'0.75rem', color:'#7f8c8d' }}>📏 {cfg.minNum}–{cfg.maxNum}</span>
                    )}
                    {modoTexto && (
                        <span style={{ fontSize:'0.75rem', color:'#7f8c8d' }}>⏱ {modoTexto}</span>
                    )}
                </div>
            )}
            {confirmar && (
                <div style={{ background:'#fdecea', borderTop:'1px solid #fdd', padding:'10px 15px', display:'flex', alignItems:'center', gap:10, fontSize:'0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c"/>
                    <span style={{ flex:1, color:'#c0392b' }}>¿Eliminar este informe?</span>
                    <button onClick={()=>{setConfirmar(false);onBorrar();}} disabled={borrando} style={{ padding:'4px 12px', borderRadius:7, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>{borrando?'Borrando…':'Eliminar'}</button>
                    <button onClick={()=>setConfirmar(false)} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background:'#e8f5e9', padding:'8px 15px', fontSize:'0.8rem', color:'#27ae60', display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13}/>Eliminado</div>}
        </div>
    );
};

// ─── Tarjeta especial para Entrenamiento Auditivo (MusicCompass) ─────────────
const MusicCompassCard = ({ inf, onBorrar, borrando, borradoOk, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) => {
    const [expandido,  setExpandido]  = useState(false);
    const [confirmar,  setConfirmar]  = useState(false);
    const [borrando2,  setBorrando2]  = useState(false);

    const jugadores = inf.jugadores || [];

    const puntoColor = (pts, sinPuntos) => {
        if (sinPuntos) return '#94a3b8';
        if (pts >= 8)  return '#22c55e';
        if (pts >= 4)  return '#f59e0b';
        return '#ef4444';
    };
    const puntoBg = (pts, sinPuntos) => {
        if (sinPuntos) return '#f1f5f9';
        if (pts >= 8)  return '#f0fdf4';
        if (pts >= 4)  return '#fffbeb';
        return '#fef2f2';
    };

    const handleBorrar = async () => {
        setBorrando2(true);
        await onBorrar();
        setBorrando2(false);
    };

    return (
        <div style={{ background: 'white', borderRadius: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', border: seleccionado ? '2px solid #1565C0' : '1.5px solid #dbeafe', transition: 'border 0.1s' }}>

            {/* Cabecera */}
            <div
                onClick={modoSeleccion ? onSeleccionar : () => setExpandido(p => !p)}
                style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', background: seleccionado ? '#f0f4ff' : 'white' }}
            >
                {modoSeleccion && (
                    <input type="checkbox" checked={seleccionado} onChange={e => { e.stopPropagation(); onSeleccionar(); }}
                        onClick={e => e.stopPropagation()} style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#1565C0', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: '1.4rem' }}>🎵</span>
                <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.92rem' }}>
                        Entrenamiento Auditivo
                        <span style={{ marginLeft: 8, fontWeight: 400, color: '#7f8c8d', fontSize: '0.8rem' }}>Individual</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#95a5a6', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} />{fmtFecha(inf.fecha)}
                    </div>
                </div>

                {/* Chips de jugadores */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {jugadores.map((j, i) => (
                        <span key={i}
                            onClick={e => { e.stopPropagation(); onBuscarJugador?.(j.nombre); }}
                            title={`Ver todos los resultados de ${j.nombre}`}
                            style={{ padding: '2px 8px', borderRadius: 20, background: '#e0f2fe', fontSize: '0.72rem', color: '#0369a1', cursor: 'pointer', fontWeight: 600 }}>
                            {j.nombre}{j.curso ? ` · ${j.curso}` : ''}
                        </span>
                    ))}
                </div>

                {/* Total pts */}
                {jugadores[0] && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>
                        {jugadores[0].puntuacionTotal ?? '—'} pts
                    </span>
                )}
                {/* Ejercicios */}
                {jugadores[0]?.ejerciciosCompletados != null && (
                    <span style={{ padding: '3px 9px', borderRadius: 20, background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '0.78rem', flexShrink: 0 }}>
                        {jugadores[0].ejerciciosCompletados} ejerc.
                    </span>
                )}

                {/* Borrar */}
                {!modoSeleccion && (
                    <button onClick={e => { e.stopPropagation(); setConfirmar(true); }}
                        style={{ padding: '4px 7px', borderRadius: 7, border: '1px solid #fdd', background: '#fdecea', color: '#e74c3c', cursor: 'pointer', flexShrink: 0 }}
                        title="Eliminar informe"><Trash2 size={13} /></button>
                )}
                {!modoSeleccion && (expandido ? <ChevronUp size={16} color="#aaa" /> : <ChevronDown size={16} color="#aaa" />)}
            </div>

            {/* Confirmación borrado */}
            {confirmar && (
                <div style={{ background: '#fdecea', borderTop: '1px solid #fdd', padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c" />
                    <span style={{ flex: 1, color: '#c0392b' }}>¿Eliminar este informe? Esta acción no se puede deshacer.</span>
                    <button onClick={() => { setConfirmar(false); handleBorrar(); }} disabled={borrando2}
                        style={{ padding: '4px 12px', borderRadius: 7, border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                        {borrando2 ? 'Borrando…' : 'Eliminar'}
                    </button>
                    <button onClick={() => setConfirmar(false)}
                        style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background: '#e8f5e9', padding: '8px 15px', fontSize: '0.8rem', color: '#27ae60', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={13} />Eliminado</div>}

            {/* Detalle expandido */}
            {expandido && (
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '14px 16px' }}>
                    {jugadores.map((jugador, ji) => {
                        const detalle = jugador.detalle || [];
                        const puntosValidos = detalle.filter(e => !e.sinPuntos);
                        const totalPts = puntosValidos.reduce((s, e) => s + (e.puntos || 0), 0);
                        const maxPts   = puntosValidos.length * 10;
                        const pct      = maxPts > 0 ? Math.round(totalPts / maxPts * 100) : 0;

                        return (
                            <div key={ji} style={{ marginBottom: ji < jugadores.length - 1 ? 20 : 0 }}>
                                {/* Resumen jugador */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 9, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{jugador.nombre}</span>
                                    {jugador.curso && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{jugador.curso}</span>}
                                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>{jugador.puntuacionTotal ?? totalPts} pts totales</span>
                                        <span style={{ fontWeight: 700, color: '#64748b', fontSize: '0.82rem' }}>{detalle.length} ejercicios</span>
                                        {maxPts > 0 && (
                                            <span style={{ padding: '2px 8px', borderRadius: 12, background: pct >= 80 ? '#f0fdf4' : pct >= 50 ? '#fffbeb' : '#fef2f2', color: pct >= 80 ? '#15803d' : pct >= 50 ? '#b45309' : '#dc2626', fontWeight: 700, fontSize: '0.78rem' }}>
                                                {pct}%
                                            </span>
                                        )}
                                    </span>
                                </div>

                                {/* Tabla de ejercicios */}
                                {detalle.length > 0 ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.72rem', borderRadius: '6px 0 0 0' }}>Ejercicio</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.72rem' }}>Intentos</th>
                                                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.72rem', borderRadius: '0 6px 0 0' }}>Puntuación</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalle.map((e, ei) => (
                                                <tr key={ei} style={{ borderTop: '1px solid #f1f5f9', background: ei % 2 === 0 ? 'white' : '#fafafa' }}>
                                                    <td style={{ padding: '7px 10px', color: '#334155', fontWeight: 600 }}>
                                                        🎵 Ejercicio {e.ejercicio ?? ei + 1}
                                                    </td>
                                                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b' }}>
                                                        {e.intentos ?? '—'} {e.intentos === 1 ? 'intento' : 'intentos'}
                                                    </td>
                                                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                                        <span style={{ padding: '3px 10px', borderRadius: 12, background: puntoBg(e.puntos, e.sinPuntos), color: puntoColor(e.puntos, e.sinPuntos), fontWeight: 700, fontSize: '0.82rem' }}>
                                                            {e.sinPuntos ? 'sin pts' : `+${e.puntos ?? 0} pts`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                                <td style={{ padding: '7px 10px', fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>TOTAL</td>
                                                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                                    {detalle.reduce((s, e) => s + (e.intentos || 0), 0)} intentos
                                                </td>
                                                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: 12, background: pct >= 80 ? '#f0fdf4' : pct >= 50 ? '#fffbeb' : '#fef2f2', color: pct >= 80 ? '#15803d' : pct >= 50 ? '#b45309' : '#dc2626', fontWeight: 800, fontSize: '0.82rem' }}>
                                                        {jugador.puntuacionTotal ?? totalPts} pts
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', padding: '8px 10px' }}>Sin detalle de ejercicios.</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Tarjeta especial para Story Cubes ───────────────────────────────────────
const StoryCubesCard = ({ inf, onBorrar, borrando, borradoOk, onAgregarAGrupo, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) => {
    const [confirmar, setConfirmar] = useState(false);
    const historia = inf.historia || [];
    const autores  = [...new Set(historia.map(s => s.autor))];

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border: seleccionado ? '2px solid #1565C0' : '1.5px solid #e8d5f5', transition:'border 0.1s' }}>

            {/* Cabecera */}
            <div onClick={modoSeleccion ? onSeleccionar : undefined} style={{ padding:'11px 15px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', cursor: modoSeleccion ? 'pointer' : 'default', background: seleccionado ? '#f0f4ff' : 'white' }}>
                {modoSeleccion && (
                    <input type="checkbox" checked={seleccionado} onChange={e=>{e.stopPropagation();onSeleccionar();}}
                        onClick={e=>e.stopPropagation()}
                        style={{ width:17, height:17, cursor:'pointer', accentColor:'#1565C0', flexShrink:0 }}/>
                )}
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
                    {autores.map((a,i) => (
                        <span key={i} onClick={e=>{ e.stopPropagation(); onBuscarJugador?.(a); }}
                            style={{ padding:'2px 7px', borderRadius:20, background:'#f3e8fd', fontSize:'0.72rem', color:'#8e44ad', cursor:'pointer' }}
                            title={`Ver todos los resultados de ${a}`}>{a}</span>
                    ))}
                </div>
                <span style={{ padding:'3px 9px', borderRadius:20, background:'#f3e8fd', color:'#8e44ad', fontWeight:700, fontSize:'0.8rem', flexShrink:0 }}>
                    {historia.length} fragmentos
                </span>
                {!modoSeleccion && (
                    <button
                        onClick={e=>{ e.stopPropagation(); onAgregarAGrupo?.(); }}
                        style={{ padding:'4px 9px', borderRadius:7, border:'1px solid #c8e6c9', background:'#e8f5e9', color:'#27ae60', cursor:'pointer', flexShrink:0, fontWeight:600, fontSize:'0.75rem', display:'flex', alignItems:'center', gap:4 }}
                        title="Añadir calificación a un grupo"
                    >
                        <Users size={12}/> Añadir a grupo
                    </button>
                )}
                {!modoSeleccion && (
                    <button
                        onClick={e=>{ e.stopPropagation(); setConfirmar(true); }}
                        style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }}
                        title="Eliminar informe"
                    ><Trash2 size={13}/></button>
                )}
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

            {/* Historia completa — siempre visible */}
            <div style={{ borderTop:'2px solid #f3e8fd', padding:'16px 18px', background:'#fdfaff' }}>
                <div style={{ fontWeight:700, color:'#8e44ad', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>
                    📖 Historia completa
                </div>
                {historia.length === 0 ? (
                    <div style={{ color:'#95a5a6', fontStyle:'italic', fontSize:'0.85rem' }}>Sin fragmentos guardados.</div>
                ) : historia.map((seg, idx) => (
                    <div key={idx} style={{ marginBottom:14, background:'white', borderRadius:10, padding:'12px 14px', borderLeft:'4px solid #8e44ad', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                        {/* Autor */}
                        <div style={{ fontSize:'0.78rem', color:'#8e44ad', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>
                            ✍️ <span onClick={()=>onBuscarJugador?.(seg.autor)} style={{ cursor:'pointer', borderBottom:'1px dotted #8e44ad' }} title="Ver todos sus resultados">{seg.autor}</span>
                        </div>
                        {/* Dados */}
                        {seg.dados?.length > 0 && (
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                                {seg.dados.map((d, i) => (
                                    <div key={i} style={{ width:44, height:44, background:'white', border:'2px solid #d6aef5', borderRadius:9, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, color:'#6c3483', boxShadow:'0 2px 6px rgba(142,68,173,0.12)' }}>
                                        <DiceIcon name={d} />
                                        <span style={{ fontSize:'0.5rem', color:'#a569bd', textTransform:'uppercase', letterSpacing:0.3 }}>{d}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Texto */}
                        <div style={{ fontSize:'0.95rem', lineHeight:1.7, whiteSpace:'pre-wrap', fontStyle: seg.texto==='(sin texto)' ? 'italic' : 'normal', color: seg.texto==='(sin texto)' ? '#bdc3c7' : '#2c3e50' }}>
                            {seg.texto || '(sin texto)'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Tarjeta especial para Juegos Musicales (Lluvia de Notas / Simón Dice) ────
const MusicGamesCard = ({ inf, onBorrar, borrando, borradoOk, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) => {
    const [expandido, setExpandido] = useState(false);
    const [confirmar, setConfirmar] = useState(false);
    const jugadores = inf.jugadores || [];
    const totalPts  = jugadores.reduce((s, j) => s + (j.puntos || 0), 0);

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border: seleccionado ? '2px solid #1565C0' : '1.5px solid #ddd4fe', transition:'border 0.1s' }}>

            {/* Cabecera */}
            <div onClick={modoSeleccion ? onSeleccionar : () => setExpandido(p => !p)}
                style={{ padding:'11px 15px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', cursor:'pointer', background: seleccionado ? '#f0f4ff' : 'white' }}>
                {modoSeleccion && (
                    <input type="checkbox" checked={seleccionado} onChange={e=>{e.stopPropagation();onSeleccionar();}}
                        onClick={e=>e.stopPropagation()}
                        style={{ width:17, height:17, cursor:'pointer', accentColor:'#1565C0', flexShrink:0 }}/>
                )}
                <span style={{ fontSize:'1.4rem' }}>🎼</span>
                <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontWeight:700, color:'#1e293b', fontSize:'0.92rem' }}>
                        Juegos Musicales
                        <span style={{ marginLeft:8, fontWeight:400, color:'#7f8c8d', fontSize:'0.8rem' }}>Individual</span>
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'#95a5a6', marginTop:1, display:'flex', alignItems:'center', gap:4 }}>
                        <Clock size={10}/>{fmtFecha(inf.fecha)}
                    </div>
                </div>
                {/* Chips jugadores */}
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {jugadores.map((j,i) => (
                        <span key={i} onClick={e=>{ e.stopPropagation(); onBuscarJugador?.(j.nombre); }}
                            title={`Ver todos los resultados de ${j.nombre}`}
                            style={{ padding:'2px 8px', borderRadius:20, background:'#ede9fe', fontSize:'0.72rem', color:'#7c3aed', cursor:'pointer', fontWeight:600 }}>
                            {j.nombre}{j.curso ? ` · ${j.curso}` : ''}
                        </span>
                    ))}
                </div>
                <span style={{ padding:'3px 10px', borderRadius:20, background:'#ede9fe', color:'#6d28d9', fontWeight:800, fontSize:'0.82rem', flexShrink:0 }}>
                    {totalPts} pts
                </span>
                {!modoSeleccion && (
                    <button onClick={e=>{ e.stopPropagation(); setConfirmar(true); }}
                        style={{ padding:'4px 7px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer', flexShrink:0 }}
                        title="Eliminar informe"><Trash2 size={13}/></button>
                )}
                {!modoSeleccion && (expandido ? <ChevronUp size={16} color="#aaa"/> : <ChevronDown size={16} color="#aaa"/>)}
            </div>

            {/* Confirmación borrado */}
            {confirmar && (
                <div style={{ background:'#fdecea', borderTop:'1px solid #fdd', padding:'10px 15px', display:'flex', alignItems:'center', gap:10, fontSize:'0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c"/>
                    <span style={{ flex:1, color:'#c0392b' }}>¿Eliminar este informe? Esta acción no se puede deshacer.</span>
                    <button onClick={()=>{ setConfirmar(false); onBorrar(); }} disabled={borrando}
                        style={{ padding:'4px 12px', borderRadius:7, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                        {borrando?'Borrando…':'Eliminar'}
                    </button>
                    <button onClick={()=>setConfirmar(false)}
                        style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background:'#e8f5e9', padding:'8px 15px', fontSize:'0.8rem', color:'#27ae60', display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13}/>Eliminado</div>}

            {/* Detalle expandido */}
            {expandido && (
                <div style={{ borderTop:'1px solid #f0f0f0', padding:'14px 16px' }}>
                    {jugadores.map((jugador, ji) => {
                        const partidas = jugador.partidas || [];
                        const total = jugador.puntos ?? partidas.reduce((s, p) => s + (p.puntos || 0), 0);
                        return (
                            <div key={ji} style={{ marginBottom: ji < jugadores.length - 1 ? 18 : 0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 12px', background:'#faf5ff', borderRadius:9, flexWrap:'wrap' }}>
                                    <span style={{ fontWeight:700, color:'#1e293b', fontSize:'0.9rem' }}>{jugador.nombre}</span>
                                    {jugador.curso && <span style={{ color:'#64748b', fontSize:'0.8rem' }}>{jugador.curso}</span>}
                                    <span style={{ marginLeft:'auto', fontWeight:800, color:'#7c3aed', fontSize:'0.88rem' }}>{total} pts totales</span>
                                </div>
                                {partidas.length > 0 ? (
                                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                                        <thead>
                                            <tr style={{ background:'#f5f3ff' }}>
                                                <th style={{ textAlign:'left', padding:'5px 8px', fontWeight:600, color:'#6d28d9', fontSize:'0.72rem', borderRadius:'6px 0 0 0' }}>Juego</th>
                                                <th style={{ textAlign:'center', padding:'5px 8px', fontWeight:600, color:'#6d28d9', fontSize:'0.72rem' }}>Puntos</th>
                                                <th style={{ textAlign:'center', padding:'5px 8px', fontWeight:600, color:'#6d28d9', fontSize:'0.72rem', borderRadius:'0 6px 0 0' }}>Nivel</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {partidas.map((p, pi) => (
                                                <tr key={pi} style={{ borderTop:'1px solid #f5f3ff', background: pi%2===0?'white':'#fdfaff' }}>
                                                    <td style={{ padding:'6px 8px', color:'#2c3e50', fontWeight:600 }}>
                                                        <span style={{ marginRight:6 }}>{p.emoji}</span>{p.juego}
                                                    </td>
                                                    <td style={{ padding:'6px 8px', textAlign:'center', color:'#7c3aed', fontWeight:700 }}>{p.puntos}</td>
                                                    <td style={{ padding:'6px 8px', textAlign:'center', color:'#64748b' }}>{p.nivel ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop:'2px solid #ede9fe', fontWeight:700, background:'#f5f3ff' }}>
                                                <td style={{ padding:'6px 8px', color:'#2c3e50', fontSize:'0.78rem' }}>TOTAL</td>
                                                <td style={{ padding:'6px 8px', textAlign:'center', color:'#7c3aed' }}>{total}</td>
                                                <td/>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                    <div style={{ color:'#95a5a6', fontSize:'0.82rem', padding:'6px 8px' }}>Sin detalle de partidas.</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Ritmo Card ───────────────────────────────────────────────────────────────

const RitmoCard = ({ ritmo }) => {
    const [playing,   setPlaying]   = useState(false);
    const [pulso,     setPulso]     = useState(-1);
    const [bpm,       setBpm]       = useState(ritmo.bpm || 120);
    const [expandido, setExpandido] = useState(false);
    const gridRef = useRef(ritmo.grid);
    useEffect(() => { gridRef.current = ritmo.grid; }, [ritmo.grid]);

    useEffect(() => {
        if (!playing) { setPulso(-1); return; }
        const ms = Math.round(60000 / bpm / 4);
        const id = setInterval(() => {
            setPulso(p => {
                const next = (p + 1) % PASOS;
                gridRef.current?.forEach((fila, i) => { if (fila[next]) INSTRUMENTOS_SEQ[i].play(); });
                return next;
            });
        }, ms);
        return () => clearInterval(id);
    }, [playing, bpm]);

    const participantes = ritmo.participantes || [];
    const fecha = ritmo.creadoEn?.toDate ? ritmo.creadoEn.toDate() : ritmo.creadoEn ? new Date(ritmo.creadoEn) : null;

    return (
        <div style={{ background:'white', borderRadius:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden', border:'1px solid #f0f0f0' }}>
            <div style={{ padding:'11px 15px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:'1.3rem' }}>🥁</span>
                <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.92rem' }}>
                        Ritmo colaborativo
                        <span style={{ marginLeft:8, color:'#7f8c8d', fontSize:'0.78rem', fontWeight:400 }}>
                            {participantes.length} participante{participantes.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'#95a5a6', marginTop:2 }}>
                        {participantes.map(p => p.nombre).join(' · ')}
                        {fecha ? ' · ' + fmtFecha(fecha) : ''}
                    </div>
                </div>

                <button
                    onClick={() => setPlaying(p => !p)}
                    style={{ padding:'6px 18px', borderRadius:8, border:'none', background: playing ? '#e74c3c' : '#27ae60', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.85rem', flexShrink:0 }}
                >
                    {playing ? '⏹' : '▶'}
                </button>

                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:140 }}>
                    <span style={{ fontSize:'0.72rem', color:'#7f8c8d', whiteSpace:'nowrap' }}>
                        BPM <b style={{ color:'#e67e22' }}>{bpm}</b>
                    </span>
                    <input type="range" min="60" max="200" value={bpm}
                        onChange={e => setBpm(Number(e.target.value))}
                        style={{ width:80, accentColor:'#e67e22', cursor:'pointer' }} />
                </div>

                <button
                    onClick={() => setExpandido(e => !e)}
                    style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #ddd', background:'#f8f9fa', cursor:'pointer', fontSize:'0.78rem', color:'#555', flexShrink:0 }}
                >
                    {expandido ? '▲ Ocultar' : '▼ Ver grid'}
                </button>
            </div>

            {playing && (
                <div style={{ display:'flex', gap:2, padding:'0 15px 8px' }}>
                    {Array.from({ length: PASOS }, (_, i) => (
                        <div key={i} style={{ flex:1, height:3, borderRadius:2, background: pulso === i ? '#e67e22' : i % 4 === 0 ? '#ddd' : '#f0f0f0', transition:'background 0.05s' }} />
                    ))}
                </div>
            )}

            {expandido && (
                <div style={{ borderTop:'1px solid #f0f0f0', padding:'12px 15px', overflowX:'auto' }}>
                    <MiniGrid grid={ritmo.grid || []} pulso={pulso} />
                </div>
            )}
        </div>
    );
};

const MiniGrid = ({ grid, pulso }) => (
    <div style={{ minWidth:440 }}>
        <div style={{ display:'flex', gap:2, marginBottom:5, paddingLeft:58 }}>
            {Array.from({ length: PASOS }, (_, i) => (
                <div key={i} style={{ flex:1, height:3, borderRadius:2, background: pulso === i ? '#e67e22' : i % 4 === 0 ? '#d0d0d0' : '#ececec' }} />
            ))}
        </div>
        {INSTRUMENTOS_SEQ.map((inst, fi) => (
            <div key={inst.nombre} style={{ display:'flex', alignItems:'center', gap:2, marginBottom:3 }}>
                <div style={{ width:54, flexShrink:0, display:'flex', alignItems:'center', gap:3 }}>
                    <span style={{ fontSize:14 }}>{inst.emoji}</span>
                    <span style={{ color:inst.color, fontSize:'0.62rem', fontWeight:700 }}>{inst.nombre}</span>
                </div>
                {(grid[fi] || Array(PASOS).fill(false)).map((activa, ci) => (
                    <div key={ci} style={{
                        flex:1, height:22, borderRadius:3,
                        background: activa ? inst.color : pulso === ci ? '#e8e8e8' : ci % 4 === 0 ? '#efefef' : '#f7f7f7',
                        outline: pulso === ci && !activa ? `1.5px solid ${inst.color}40` : 'none',
                        transition:'background 0.05s',
                    }} />
                ))}
            </div>
        ))}
        <div style={{ display:'flex', gap:2, marginTop:3, paddingLeft:58 }}>
            {Array.from({ length: PASOS }, (_, i) => (
                <div key={i} style={{ flex:1, textAlign:'center', fontSize:'0.52rem', color: i % 4 === 0 ? '#e67e22' : '#bbb', fontWeight: i % 4 === 0 ? 700 : 400 }}>
                    {i % 4 === 0 ? String(i / 4 + 1) : '·'}
                </div>
            ))}
        </div>
    </div>
);

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
