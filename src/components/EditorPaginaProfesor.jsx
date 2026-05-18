// EditorPaginaProfesor.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Globe, Plus, Trash2, Eye, Save, Link, Gamepad2, Image, Video, ExternalLink, ChevronDown, ChevronUp, X, Search, BookOpen } from 'lucide-react';

const COLORES_CURSO = ['#6D28D9','#1D4ED8','#047857','#DC2626','#D97706','#0F766E','#BE185D','#374151'];

const JUEGOS_DISPONIBLES = [
  { id:'pasapalabra',     nombre:'Pasapalabra',         emoji:'🔤', desc:'El rosco de letras',            grupo:'general' },
  { id:'cazaburbujas',    nombre:'Cazaburbujas',        emoji:'🫧', desc:'Explota las burbujas',          grupo:'general' },
  { id:'aparejados',      nombre:'AparejaDOS',          emoji:'🃏', desc:'Encuentra las parejas',         grupo:'general' },
  { id:'ruleta',          nombre:'La Ruleta',           emoji:'🎡', desc:'Ruleta de la suerte',           grupo:'general' },
  { id:'sopa',            nombre:'Sopa de Letras',      emoji:'🔍', desc:'Encuentra las palabras',        grupo:'general' },
  { id:'wordle',          nombre:'WordLe',              emoji:'🟩', desc:'Adivina la palabra',            grupo:'general' },
  { id:'mathle',          nombre:'MathLe',              emoji:'🔢', desc:'Adivina la ecuación',           grupo:'general' },
  { id:'omninteractive',  nombre:'OmniInteractive',     emoji:'📚', desc:'Actividades interactivas',      grupo:'general' },
  { id:'videoquizz',      nombre:'VideoQuizz',          emoji:'🎬', desc:'Quiz sobre vídeos',             grupo:'general' },
  { id:'sintaxis',        nombre:'Sintaxis',            emoji:'🖍️', desc:'Analiza frases',               grupo:'general' },
  { id:'listening',       nombre:'Listening',           emoji:'🙉', desc:'Escucha y completa',            grupo:'general' },
  { id:'etiquetas',       nombre:'EtiquetaMe',          emoji:'🏷️', desc:'Pon las etiquetas correctas',  grupo:'general' },
  { id:'pikatron',        nombre:'Pikatron',            emoji:'⚡', desc:'Runner con preguntas',          grupo:'general' },
  { id:'pikatron_2',      nombre:'Plataformas',         emoji:'🏃', desc:'Plataformas con preguntas',     grupo:'general' },
  { id:'kartinged',       nombre:'Karting',             emoji:'🚗', desc:'Carreras con preguntas',        grupo:'general' },
  { id:'kartinged_multi', nombre:'Karting Multi',       emoji:'🏎️', desc:'Carreras multijugador',        grupo:'general' },
  { id:'pilive',          nombre:'PiLive',              emoji:'🎯', desc:'Quiz en vivo',                  grupo:'vivo' },
  { id:'mathlive',        nombre:'MathLive',            emoji:'📊', desc:'Matemáticas en tiempo real',    grupo:'vivo' },
  { id:'olympiclive',     nombre:'Olympic Live',        emoji:'🏅', desc:'Minijuegos en directo',         grupo:'vivo' },
  { id:'geometrix',       nombre:'Geometrix',           emoji:'📐', desc:'Áreas y volúmenes',             grupo:'math' },
  { id:'calculo',         nombre:'Cálculo',             emoji:'🧠', desc:'Agilidad mental',               grupo:'math' },
  { id:'funciones',       nombre:'Funciones',           emoji:'📈', desc:'Representación de funciones',   grupo:'math' },
  { id:'geom_analitica',  nombre:'Geometría Analítica', emoji:'♐',  desc:'Rectas, parábolas y análisis',  grupo:'math' },
  { id:'ecuaciones',      nombre:'Ecuaciones',          emoji:'⚖️', desc:'Despeja la X paso a paso',     grupo:'math' },
  { id:'oca',             nombre:'Oca Matemática',      emoji:'🎲', desc:'Juego de oca con mates',        grupo:'math' },
];

const JUEGOS_STANDALONE = new Set(['geometrix','calculo','funciones','geom_analitica','ecuaciones','oca','pilive','mathlive','olympiclive','kartinged_multi']);

const JUEGO_TIPO_FILTRO = {
  pasapalabra:'PASAPALABRA', cazaburbujas:'CAZABURBUJAS', aparejados:'APAREJADOS',
  ruleta:'RULETA', sopa:'SOPA', wordle:'WORDLE', mathle:'MATHLE',
  omninteractive:'OMNINTERACTIVE', videoquizz:'VIDEOQUIZZ',
  sintaxis:'SINTAXIS', listening:'LISTENING', etiquetas:'ETIQUETAS',
  pikatron:'PIKATRON', pikatron_2:'PIKATRON_2',
  kartinged:'KARTINGED', kartinged_multi:'KARTINGED_MULTI',
  pilive:'THINKHOOT', mathlive:'MATHLIVE', olympiclive:'OLYMPICLIVE',
};

function migrateCurso(c) {
  if (c.temas !== undefined) return { juegos:[], bienvenida:'', ...c };
  const temas = (c.tareas||[]).length > 0
    ? [{ id:'tema_legacy', titulo:'Tareas generales', descripcion:'', tareas: c.tareas }]
    : [];
  const { tareas: _t, ...rest } = c;
  return { juegos:[], bienvenida:'', ...rest, temas };
}
function newCurso() {
  return { id:'c_'+Math.random().toString(36).slice(2,8), nombre:'Nuevo curso', color:'#6D28D9', bienvenida:'', recursos:[], juegos:[], temas:[], enlaces:[] };
}
function newEnlaceCurso() {
  return { id:'en_'+Math.random().toString(36).slice(2,8), titulo:'', url:'' };
}
function newTema() {
  return { id:'tm_'+Math.random().toString(36).slice(2,8), titulo:'Nuevo tema', descripcion:'', tareas:[], presentacionId:'' };
}
function newTarea() {
  return { id:'ta_'+Math.random().toString(36).slice(2,8), titulo:'', descripcion:'', fechaEntrega:'',
    imagenUrl:'', videoUrl:'', enlaceUrl:'', enlaceTitulo:'', pptxUrl:'', juegoId:'', recursoId:'', presentacionId:'' };
}
function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
}

// ─── Picker de actividades (recursos + juegos) ────────────────────────────────
function ActividadesPicker({ misRecursos, selRecursos, selJuegos, onToggleRecurso, onToggleJuego, onClose }) {
  const [busqueda, setBusqueda] = useState('');
  const [pestana, setPestana] = useState('juegos'); // 'juegos' | 'recursos'

  const grupos = [
    { id:'general', label:'🎮 Juegos con recursos' },
    { id:'vivo',    label:'⚡ En vivo' },
    { id:'math',    label:'🧮 Math World' },
  ];

  const juegosFiltrados = busqueda
    ? JUEGOS_DISPONIBLES.filter(j => j.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : JUEGOS_DISPONIBLES;

  const recursosFiltrados = busqueda
    ? misRecursos.filter(r => (r.titulo||'').toLowerCase().includes(busqueda.toLowerCase()))
    : misRecursos;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'#E2E8F0' }}/>
        </div>
        {/* Header */}
        <div style={{ padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:800, fontSize:16, color:'#1E1B4B' }}>Añadir actividad</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', padding:4 }}><X size={22}/></button>
        </div>
        {/* Búsqueda */}
        <div style={{ padding:'0 20px 10px' }}>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }}/>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar…"
              style={{ width:'100%', boxSizing:'border-box', paddingLeft:32, height:38, borderRadius:10, border:'1px solid #CBD5E1', fontSize:14, fontFamily:'inherit', outline:'none' }}/>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #E2E8F0', padding:'0 20px' }}>
          {[['juegos','🎮 Juegos'],['recursos','📁 Mis recursos']].map(([id,label])=>(
            <button key={id} onClick={()=>setPestana(id)} style={{ padding:'8px 16px', border:'none', background:'none', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit',
              color: pestana===id ? '#6D28D9' : '#94A3B8', borderBottom: pestana===id ? '3px solid #6D28D9' : '3px solid transparent' }}>{label}</button>
          ))}
        </div>
        {/* Contenido */}
        <div style={{ overflowY:'auto', flex:1, padding:'16px 20px' }}>
          {pestana==='juegos' && (
            <>
              {(busqueda ? [{id:'all',label:'Resultados'}] : grupos).map(grupo=>{
                const items = busqueda ? juegosFiltrados : juegosFiltrados.filter(j=>j.grupo===grupo.id);
                if (!items.length) return null;
                return (
                  <div key={grupo.id} style={{ marginBottom:16 }}>
                    {!busqueda && <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>{grupo.label}</div>}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                      {items.map(j=>{
                        const sel = selJuegos.includes(j.id);
                        return (
                          <button key={j.id} onClick={()=>onToggleJuego(j.id)} style={{
                            display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 8px',
                            borderRadius:10, border: sel ? '2px solid #6D28D9' : '1.5px solid #E2E8F0',
                            background: sel ? '#F5F3FF' : 'white', cursor:'pointer', fontFamily:'inherit', textAlign:'center',
                          }}>
                            <span style={{ fontSize:22 }}>{j.emoji}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:'#0F172A', lineHeight:1.2 }}>{j.nombre}</span>
                            {sel && <span style={{ fontSize:10, color:'#6D28D9', fontWeight:700 }}>✓ Añadido</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {pestana==='recursos' && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {misRecursos.length===0 && <p style={{ color:'#94A3B8', fontSize:13, textAlign:'center', padding:'20px 0' }}>No tienes recursos publicados aún.</p>}
              {recursosFiltrados.map(r=>{
                const sel = selRecursos.includes(r.id);
                return (
                  <div key={r.id} onClick={()=>onToggleRecurso(r.id)} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10,
                    border: sel ? '2px solid #6D28D9' : '1.5px solid #E2E8F0',
                    background: sel ? '#F5F3FF' : 'white', cursor:'pointer',
                  }}>
                    <span style={{ width:20, height:20, borderRadius:5, border:`2px solid ${sel?'#6D28D9':'#CBD5E1'}`, background:sel?'#6D28D9':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {sel && <span style={{ color:'white', fontSize:11, fontWeight:900 }}>✓</span>}
                    </span>
                    <span style={{ flex:1, fontWeight:600, fontSize:13, color:'#0F172A' }}>{r.titulo}</span>
                    <span style={{ fontSize:11, color:'#94A3B8' }}>{r.tipoJuego}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid #E2E8F0' }}>
          <button onClick={onClose} style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:'#6D28D9', color:'white', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Picker de presentación PiKT ─────────────────────────────────────────────
function PiKTPresentacionPicker({ usuario, presentacionId, onSelect, onClose }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!usuario?.uid) return;
    getDocs(query(collection(db,'presentations'), where('uid','==',usuario.uid)))
      .then(snap => {
        const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
        docs.sort((a,b)=>(b.updatedAt?.toMillis?.()??0)-(a.updatedAt?.toMillis?.()??0));
        setLista(docs); setLoading(false);
      }).catch(()=>setLoading(false));
  }, [usuario?.uid]);
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
      <div style={{ background:'white',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:640,maxHeight:'75vh',display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',justifyContent:'center',padding:'12px 0 0' }}>
          <div style={{ width:40,height:4,borderRadius:2,background:'#E2E8F0' }}/>
        </div>
        <div style={{ padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <span style={{ fontWeight:800,fontSize:16,color:'#1E1B4B' }}>📊 Seleccionar presentación PiKT</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#94A3B8',padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ overflowY:'auto',flex:1,padding:'0 20px' }}>
          {loading && <div style={{ textAlign:'center',padding:30,color:'#94A3B8' }}>⏳ Cargando…</div>}
          {!loading && lista.length===0 && (
            <div style={{ textAlign:'center',padding:30,color:'#94A3B8',fontSize:13 }}>
              No tienes presentaciones creadas.<br/>Créalas desde el menú "📊 Presentaciones".
            </div>
          )}
          {lista.map(p=>(
            <div key={p.id} onClick={()=>onSelect(p.id)}
              style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',marginBottom:6,
                borderRadius:10,border:presentacionId===p.id?'2px solid #6D28D9':'1.5px solid #E2E8F0',
                background:presentacionId===p.id?'#F5F3FF':'white',cursor:'pointer' }}>
              <div style={{ width:40,height:26,borderRadius:5,background:'linear-gradient(135deg,#6c63ff,#a855f7)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>📊</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:14,color:'#0F172A',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis' }}>{p.titulo||'Sin título'}</div>
                <div style={{ fontSize:11,color:'#94A3B8' }}>{p.slides?.length||0} diapositivas</div>
              </div>
              {presentacionId===p.id&&<span style={{ color:'#6D28D9',fontWeight:700,fontSize:12,flexShrink:0 }}>✓</span>}
            </div>
          ))}
        </div>
        {presentacionId&&(
          <div style={{ padding:'8px 20px 0' }}>
            <button onClick={()=>onSelect('')} style={{ width:'100%',padding:'9px',borderRadius:10,border:'1px solid #FCA5A5',background:'#FEF2F2',color:'#DC2626',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
              ✕ Quitar presentación
            </button>
          </div>
        )}
        <div style={{ padding:'12px 20px 20px' }}>
          <button onClick={onClose} style={{ width:'100%',padding:'12px',borderRadius:12,border:'none',background:'#6D28D9',color:'white',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit' }}>Listo</button>
        </div>
      </div>
    </div>
  );
}

// ─── Picker de juego para tarea ───────────────────────────────────────────────
function GamePicker({ misRecursos, onSelect, onClose }) {
  const [paso, setPaso] = useState(1);
  const [juegoElegido, setJuegoElegido] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const grupos = [
    { id:'general', label:'🎮 Juegos con recursos' },
    { id:'vivo',    label:'⚡ En vivo' },
    { id:'math',    label:'🧮 Math World' },
  ];
  const filtrados = busqueda ? JUEGOS_DISPONIBLES.filter(j=>j.nombre.toLowerCase().includes(busqueda.toLowerCase())) : JUEGOS_DISPONIBLES;

  const handleJuego = (j) => {
    if (JUEGOS_STANDALONE.has(j.id)) { onSelect({ juegoId:j.id, recursoId:'' }); }
    else { setJuegoElegido(j); setPaso(2); }
  };

  const recursosParaJuego = juegoElegido
    ? misRecursos.filter(r=>{ const t=JUEGO_TIPO_FILTRO[juegoElegido.id]; return t&&r.tipoJuego===t; })
    : [];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'#E2E8F0' }}/>
        </div>
        <div style={{ padding:'12px 20px', display:'flex', alignItems:'center', gap:8 }}>
          {paso===2 && <button onClick={()=>setPaso(1)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#6D28D9', padding:0 }}>←</button>}
          <span style={{ fontWeight:800, fontSize:16, color:'#1E1B4B', flex:1 }}>
            {paso===1 ? 'Elige un juego' : `${juegoElegido?.emoji} ${juegoElegido?.nombre}`}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8' }}><X size={22}/></button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'0 20px 20px' }}>
          {paso===1 && (
            <>
              <div style={{ position:'relative', marginBottom:12 }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }}/>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar juego…"
                  style={{ width:'100%', boxSizing:'border-box', paddingLeft:32, height:38, borderRadius:10, border:'1px solid #CBD5E1', fontSize:14, fontFamily:'inherit', outline:'none' }}/>
              </div>
              {(busqueda?[{id:'all',label:'Resultados'}]:grupos).map(grupo=>{
                const items=busqueda?filtrados:filtrados.filter(j=>j.grupo===grupo.id);
                if(!items.length) return null;
                return (
                  <div key={grupo.id} style={{ marginBottom:16 }}>
                    {!busqueda && <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>{grupo.label}</div>}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
                      {items.map(j=>(
                        <button key={j.id} onClick={()=>handleJuego(j)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 6px', borderRadius:10, border:'1.5px solid #E2E8F0', background:'white', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor='#6D28D9';e.currentTarget.style.background='#F5F3FF';}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F0';e.currentTarget.style.background='white';}}>
                          <span style={{ fontSize:22 }}>{j.emoji}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#0F172A', lineHeight:1.2 }}>{j.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {paso===2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={()=>onSelect({juegoId:juegoElegido.id,recursoId:''})}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px', borderRadius:10, border:'2px dashed #CBD5E1', background:'#F8FAFC', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                <span style={{ fontSize:20 }}>🌐</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'#374151' }}>Sin recurso específico</div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>Versión genérica del juego</div>
                </div>
              </button>
              {recursosParaJuego.length===0 && <p style={{ fontSize:12, color:'#94A3B8', textAlign:'center', padding:'12px 0' }}>No tienes recursos de {juegoElegido?.nombre}.</p>}
              {recursosParaJuego.map(r=>(
                <button key={r.id} onClick={()=>onSelect({juegoId:juegoElegido.id,recursoId:r.id})}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px', borderRadius:10, border:'1.5px solid #E2E8F0', background:'white', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#6D28D9';e.currentTarget.style.background='#F5F3FF';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F0';e.currentTarget.style.background='white';}}>
                  <span style={{ fontSize:20 }}>{juegoElegido?.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#0F172A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.titulo}</div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{r.tipoJuego}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editor de tarea ──────────────────────────────────────────────────────────
function TareaEditor({ tarea, misRecursos, usuario, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [presPickerAbierto, setPresPickerAbierto] = useState(false);
  const juegoInfo = tarea.juegoId ? JUEGOS_DISPONIBLES.find(j=>j.id===tarea.juegoId) : null;
  const recursoInfo = tarea.recursoId ? misRecursos.find(r=>r.id===tarea.recursoId) : null;

  return (
    <div style={{ border:'1px solid #E2E8F0', borderRadius:12, padding:'12px', background:'white' }}>
      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
        <input style={{ ...inp, flex:1, fontWeight:600 }}
          value={tarea.titulo} onChange={e=>onUpdate({titulo:e.target.value})} placeholder="Título de la tarea"/>
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'#DC2626', flexShrink:0, padding:'0 4px' }}><Trash2 size={14}/></button>
      </div>
      <textarea style={{ ...inp, height:52, resize:'none', fontSize:13 }}
        value={tarea.descripcion} onChange={e=>onUpdate({descripcion:e.target.value})} placeholder="Descripción…"/>
      <input type="date" style={{ ...inp, marginTop:6 }}
        value={tarea.fechaEntrega} onChange={e=>onUpdate({fechaEntrega:e.target.value})}/>

      {juegoInfo && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, padding:'6px 10px', background:'#F5F3FF', borderRadius:8, border:'1px solid #DDD6FE' }}>
          <span style={{ fontSize:16 }}>{juegoInfo.emoji}</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#6D28D9', flex:1 }}>
            {juegoInfo.nombre}{recursoInfo?` · ${recursoInfo.titulo}`:''}
          </span>
          <button onClick={()=>onUpdate({juegoId:'',recursoId:''})} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', padding:0 }}><X size={13}/></button>
        </div>
      )}

      <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
        <button onClick={()=>setPickerAbierto(true)} style={btnSmall}>
          <Gamepad2 size={12}/> {juegoInfo?'Cambiar juego':'+ Juego'}
        </button>
        <button onClick={()=>setExpanded(!expanded)} style={btnSmall}>
          {expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>} Imagen/Video/Enlace/PPT
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8, borderTop:'1px dashed #E2E8F0', paddingTop:10 }}>
          <div>
            <label style={lbl}><Image size={11} style={{ display:'inline', marginRight:4 }}/>URL de imagen</label>
            <input style={inp} value={tarea.imagenUrl||''} onChange={e=>onUpdate({imagenUrl:e.target.value})} placeholder="https://…/imagen.jpg"/>
          </div>
          <div>
            <label style={lbl}><Video size={11} style={{ display:'inline', marginRight:4 }}/>URL de video (YouTube o directo)</label>
            <input style={inp} value={tarea.videoUrl||''} onChange={e=>onUpdate({videoUrl:e.target.value})} placeholder="https://youtube.com/watch?v=…"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={lbl}><ExternalLink size={11} style={{ display:'inline', marginRight:4 }}/>Enlace externo</label>
              <input style={inp} value={tarea.enlaceUrl||''} onChange={e=>onUpdate({enlaceUrl:e.target.value})} placeholder="https://…"/>
            </div>
            <div>
              <label style={lbl}>Texto del botón</label>
              <input style={inp} value={tarea.enlaceTitulo||''} onChange={e=>onUpdate({enlaceTitulo:e.target.value})} placeholder="Ver recurso"/>
            </div>
          </div>
          <div>
            <label style={lbl}>📊 URL de presentación (.pptx / Google Slides)</label>
            <input style={inp} value={tarea.pptxUrl||''} onChange={e=>onUpdate({pptxUrl:e.target.value})}
              placeholder="https://docs.google.com/presentation/… o enlace directo .pptx"/>
            <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>
              Google Slides: Archivo → Publicar en la web → Insertar → copia la URL. PPTX: sube a OneDrive/Drive y copia el enlace público.
            </div>
          </div>
          <div>
            <label style={lbl}>🎞️ Presentación PiKT</label>
            {tarea.presentacionId ? (
              <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'#F5F3FF',border:'1px solid #C4B5FD',borderRadius:8 }}>
                <span style={{ fontSize:16 }}>📊</span>
                <span style={{ flex:1,fontSize:13,fontWeight:600,color:'#6D28D9' }}>Presentación PiKT seleccionada</span>
                <button onClick={()=>setPresPickerAbierto(true)} style={{ fontSize:11,color:'#6D28D9',background:'none',border:'none',cursor:'pointer',fontWeight:700,padding:'2px 6px' }}>Cambiar</button>
                <button onClick={()=>onUpdate({presentacionId:''})} style={{ fontSize:11,color:'#DC2626',background:'none',border:'none',cursor:'pointer',fontWeight:700,padding:'2px 4px' }}>✕</button>
              </div>
            ) : (
              <button onClick={()=>setPresPickerAbierto(true)}
                style={{ ...inp,background:'#F5F3FF',color:'#6D28D9',border:'1.5px dashed #C4B5FD',cursor:'pointer',textAlign:'center',fontWeight:600,fontSize:13,fontFamily:'inherit',padding:'10px' }}>
                🎞️ + Añadir presentación PiKT
              </button>
            )}
          </div>
        </div>
      )}

      {pickerAbierto && (
        <GamePicker misRecursos={misRecursos}
          onSelect={({juegoId,recursoId})=>{onUpdate({juegoId,recursoId});setPickerAbierto(false);}}
          onClose={()=>setPickerAbierto(false)}/>
      )}
      {presPickerAbierto && (
        <PiKTPresentacionPicker usuario={usuario} presentacionId={tarea.presentacionId}
          onSelect={id=>{onUpdate({presentacionId:id});setPresPickerAbierto(false);}}
          onClose={()=>setPresPickerAbierto(false)}/>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EditorPaginaProfesor({ usuario, onPreview }) {
  const [pagina, setPagina] = useState({
    nombre:usuario?.displayName||'', descripcion:'', asignatura:'', localidad:'',
    slug:'', publicada:false, cursos:[],
  });
  const [misRecursos, setMisRecursos] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [tab,     setTab]     = useState(null);
  const [slugStatus, setSlugStatus] = useState(null);
  const [temasExpanded, setTemasExpanded] = useState(new Set());
  const [actividadesPickerAbierto, setActividadesPickerAbierto] = useState(false);
  const [temaPresPickerAbierto, setTemaPresPickerAbierto] = useState(null); // tema.id o null
  const [esNuevaPagina, setEsNuevaPagina] = useState(false);

  const pageUrl = pagina.slug
    ? `${window.location.origin}/${pagina.slug}`
    : `${window.location.origin}/?p=${usuario?.uid}`;

  useEffect(() => {
    if (!usuario?.uid) return;
    getDoc(doc(db,'paginas_profesores',usuario.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setPagina(p=>({...p,...data,cursos:(data.cursos||[]).map(migrateCurso)}));
        if (data.slug) setSlugStatus('ok');
      } else {
        setEsNuevaPagina(true);
      }
    });
    const q = query(collection(db,'resources'), where('profesorUid','==',usuario.uid), where('isFinished','==',true));
    getDocs(q).then(snap=>setMisRecursos(snap.docs.map(d=>({...d.data(),id:d.id}))));
  }, [usuario?.uid]);

  const syncMisRecursos = () => {
    const ids = misRecursos.map(r => r.id);
    setPagina(p => {
      const existe = p.cursos.find(c => c.id === 'mis_recursos_auto');
      if (existe) {
        return { ...p, cursos: p.cursos.map(c => c.id === 'mis_recursos_auto' ? { ...c, recursos: ids } : c) };
      }
      const nuevo = { id:'mis_recursos_auto', nombre:'Mis recursos', color:'#6D28D9', bienvenida:'', recursos:ids, juegos:[], temas:[], enlaces:[] };
      return { ...p, cursos: [nuevo, ...p.cursos] };
    });
  };

  useEffect(() => {
    if (!esNuevaPagina || misRecursos.length === 0) return;
    syncMisRecursos();
    setEsNuevaPagina(false);
  }, [esNuevaPagina, misRecursos]);

  const SLUGS_RESERVADOS = new Set([
    'populares','inicio','pasapalabra','cazaburbujas','burbujas','pikatron','pikatron_2','plataformas',
    'kartinged','karting','kartinged_multi','karting_multi','aparejados','ruleta','wordle','mathle',
    'thinkhoot','pilive','mathlive','olympiclive','olympic_live','sopa','sopa_letras',
    'question_sender','q-sender','omninteractive','videoquizz','sintaxis','listening',
    'etiquetas','etiquetame','geometrix','calculo','funciones','funciones2',
    'geometria_analitica','geometriaanalitica','ecuaciones','oca','api','admin','login','app',
  ]);

  const checkSlug = async (val) => {
    const s = slugify(val); setField('slug',s);
    if (!s) { setSlugStatus('empty'); return; }
    if (SLUGS_RESERVADOS.has(s)) { setSlugStatus('taken'); return; }
    setSlugStatus('checking');
    try {
      const snap = await getDocs(query(collection(db,'paginas_profesores'),where('slug','==',s)));
      setSlugStatus(snap.docs.some(d=>d.id!==usuario?.uid)?'taken':'ok');
    } catch { setSlugStatus('ok'); }
  };

  const setField = (k,v) => setPagina(p=>({...p,[k]:v}));

  const addCurso = () => { const c=newCurso(); setPagina(p=>({...p,cursos:[...p.cursos,c]})); setTab(c.id); };
  const updateCurso = (id,f,v) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const deleteCurso = (id) => { setPagina(p=>({...p,cursos:p.cursos.filter(c=>c.id!==id)})); if(tab===id) setTab(null); };
  const duplicateCurso = (id) => setPagina(p=>{
    const orig=p.cursos.find(c=>c.id===id); if(!orig) return p;
    const copy={...orig, id:'c_'+Math.random().toString(36).slice(2,8), nombre:orig.nombre+' (copia)',
      temas:(orig.temas||[]).map(t=>({...t,id:'tm_'+Math.random().toString(36).slice(2,8),
        tareas:(t.tareas||[]).map(ta=>({...ta,id:'ta_'+Math.random().toString(36).slice(2,8)}))}))};
    const idx=p.cursos.findIndex(c=>c.id===id);
    const arr=[...p.cursos]; arr.splice(idx+1,0,copy);
    return {...p,cursos:arr};
  });
  const moveCurso = (id,dir) => setPagina(p=>{
    const arr=[...p.cursos]; const i=arr.findIndex(c=>c.id===id); const j=i+dir;
    if(j<0||j>=arr.length) return p; [arr[i],arr[j]]=[arr[j],arr[i]]; return {...p,cursos:arr};
  });

  const updateCursoEnlaces = (cid, enlaces) => updateCurso(cid, 'enlaces', enlaces);

  const toggleRecurso = (cid,rid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>{
    if(c.id!==cid) return c; const t=c.recursos.includes(rid);
    return {...c,recursos:t?c.recursos.filter(r=>r!==rid):[...c.recursos,rid]};
  })}));
  const toggleJuego = (cid,jid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>{
    if(c.id!==cid) return c; const t=(c.juegos||[]).includes(jid);
    return {...c,juegos:t?c.juegos.filter(j=>j!==jid):[...(c.juegos||[]),jid]};
  })}));

  const addTema = (cid) => { const t=newTema();
    setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{...c,temas:[...(c.temas||[]),t]})}));
    setTemasExpanded(s=>{const n=new Set(s);n.add(t.id);return n;});
  };
  const updateTema = (cid,tid,f,v) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,[f]:v})})}));
  const deleteTema = (cid,tid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).filter(t=>t.id!==tid)})}));
  const duplicateTema = (cid,tid) => setPagina(p=>{
    const ci=p.cursos.findIndex(c=>c.id===cid); if(ci<0) return p;
    const temas=[...(p.cursos[ci].temas||[])];
    const idx=temas.findIndex(t=>t.id===tid); if(idx<0) return p;
    const orig=temas[idx];
    const copy={...orig, id:'tm_'+Math.random().toString(36).slice(2,8), titulo:orig.titulo+' (copia)',
      tareas:(orig.tareas||[]).map(ta=>({...ta,id:'ta_'+Math.random().toString(36).slice(2,8)}))};
    temas.splice(idx+1,0,copy);
    const cursos=[...p.cursos]; cursos[ci]={...cursos[ci],temas}; return {...p,cursos};
  });
  const toggleOcultoTema = (cid,tid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,oculto:!t.oculto})})}));
  const moveTema = (cid,tid,dir) => setPagina(p=>{
    const ci=p.cursos.findIndex(c=>c.id===cid); if(ci<0) return p;
    const temas=[...(p.cursos[ci].temas||[])]; const i=temas.findIndex(t=>t.id===tid); const j=i+dir;
    if(j<0||j>=temas.length) return p; [temas[i],temas[j]]=[temas[j],temas[i]];
    const cursos=[...p.cursos]; cursos[ci]={...cursos[ci],temas}; return {...p,cursos};
  });
  const toggleExpandTema = (tid) => setTemasExpanded(s=>{const n=new Set(s);n.has(tid)?n.delete(tid):n.add(tid);return n;});

  const addTarea = (cid,tid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,tareas:[...t.tareas,newTarea()]})})}));
  const updateTarea = (cid,tid,taId,patch) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,tareas:t.tareas.map(ta=>ta.id!==taId?ta:{...ta,...patch})})})}));
  const deleteTarea = (cid,tid,taId) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,tareas:t.tareas.filter(ta=>ta.id!==taId)})})}));

  const save = async (publicar) => {
    if (!pagina.slug) { alert('Elige una dirección (URL) para tu página antes de guardar.'); return; }
    if (slugStatus==='taken') { alert('Esa dirección ya está en uso. Elige otra.'); return; }
    if (slugStatus==='checking') { alert('Espera, verificando disponibilidad…'); return; }
    setSaving(true);
    try {
      const data={...pagina,publicada:publicar??pagina.publicada,profesorUid:usuario.uid,updatedAt:new Date()};
      await setDoc(doc(db,'paginas_profesores',usuario.uid),data);
      setPagina(data); setSaved(true); setTimeout(()=>setSaved(false),2500);
    } catch(e) { alert('Error: '+e.message); }
    setSaving(false);
  };

  const cursoActivo = pagina.cursos.find(c=>c.id===tab);
  const totalActividades = cursoActivo ? (cursoActivo.recursos?.length||0)+(cursoActivo.juegos?.length||0) : 0;

  return (
    <div style={{ maxWidth:700, margin:'0 auto', padding:'0 12px 80px' }}>

      {/* Header botones */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'white', padding:'12px 0', borderBottom:'1px solid #F1F5F9', marginBottom:20, display:'flex', gap:8, flexWrap:'wrap' }}>
        <button onClick={()=>onPreview?.(usuario.uid)} style={btnOutline}><Eye size={14}/> Vista previa</button>
        <button onClick={()=>{navigator.clipboard.writeText(pageUrl);alert('¡Copiado!');}} style={btnOutline}><Link size={14}/> Enlace</button>
        <button onClick={syncMisRecursos} style={btnOutline} title="Sincronizar curso 'Mis recursos' con todos tus recursos publicados">
          🔄 Mis recursos
        </button>
        <div style={{ flex:1 }}/>
        <button onClick={()=>save()} disabled={saving} style={{...btnPrimary,background:'#4F46E5'}}>
          <Save size={14}/> {saving?'…':saved?'✓':'Guardar'}
        </button>
        <button onClick={()=>save(!pagina.publicada)} disabled={saving} style={{...btnPrimary,background:pagina.publicada?'#DC2626':'#059669'}}>
          {pagina.publicada?'🔒':'🌐'} {pagina.publicada?'Ocultar':'Publicar'}
        </button>
      </div>

      {pagina.publicada && (
        <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#166534' }}>
          <Globe size={13} style={{ display:'inline', marginRight:4 }}/>
          <a href={pageUrl} target="_blank" rel="noreferrer" style={{ color:'#6D28D9', fontWeight:700 }}>{pageUrl}</a>
        </div>
      )}

      {/* Info general */}
      <section style={card}>
        <h3 style={sectionTitle}>Información general</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div><label style={lbl}>Nombre visible</label>
            <input style={inp} value={pagina.nombre} onChange={e=>setField('nombre',e.target.value)} placeholder="Ej: Profe García"/></div>
          <div><label style={lbl}>Asignatura / Centro</label>
            <input style={inp} value={pagina.asignatura||''} onChange={e=>setField('asignatura',e.target.value)} placeholder="Ej: Inglés · IES Ejemplo"/></div>
          <div><label style={lbl}>Localidad</label>
            <input style={inp} value={pagina.localidad||''} onChange={e=>setField('localidad',e.target.value)} placeholder="Ej: Madrid"/></div>
          <div>
            <label style={lbl}>Dirección de tu página</label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'#94A3B8', flexShrink:0 }}>pikt.es/</span>
              <input style={{...inp,flex:1}} value={pagina.slug||''} onChange={e=>checkSlug(e.target.value)} placeholder="profe-garcia"/>
            </div>
            {slugStatus==='checking' && <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>⏳ Comprobando…</div>}
            {slugStatus==='ok'       && <div style={{ fontSize:11, color:'#059669', marginTop:3 }}>✓ Disponible</div>}
            {slugStatus==='taken'    && <div style={{ fontSize:11, color:'#DC2626', marginTop:3 }}>✗ Ya está en uso</div>}
            {slugStatus==='empty'    && <div style={{ fontSize:11, color:'#F59E0B', marginTop:3 }}>Elige una dirección</div>}
          </div>
          <div><label style={lbl}>Descripción</label>
            <textarea style={{...inp,height:72,resize:'vertical'}} value={pagina.descripcion} onChange={e=>setField('descripcion',e.target.value)} placeholder="Preséntate brevemente…"/></div>
        </div>
      </section>

      {/* Cursos */}
      <section style={{...card,marginTop:14}}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{...sectionTitle,margin:0}}>Cursos</h3>
          <button onClick={addCurso} style={{...btnPrimary,background:'#6D28D9',padding:'7px 14px',fontSize:13}}><Plus size={14}/> Añadir</button>
        </div>

        {pagina.cursos.length===0 && (
          <p style={{ color:'#94A3B8', textAlign:'center', padding:'20px 0', fontSize:13 }}>Añade cursos para organizar tu contenido.</p>
        )}

        {/* Tabs */}
        {pagina.cursos.length>0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
            {pagina.cursos.map(c=>(
              <button key={c.id} onClick={()=>setTab(c.id)} style={{ padding:'6px 14px', borderRadius:20, border:`2px solid ${c.color}`,
                background:tab===c.id?c.color:'white', color:tab===c.id?'white':c.color, fontWeight:700, fontSize:13, cursor:'pointer' }}>{c.nombre}</button>
            ))}
          </div>
        )}

        {cursoActivo && (
          <div style={{ border:`2px solid ${cursoActivo.color}25`, borderRadius:12, padding:14 }}>

            {/* Nombre + color + orden */}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
              <input style={{...inp,flex:1,minWidth:120,fontWeight:700,fontSize:14}}
                value={cursoActivo.nombre} onChange={e=>updateCurso(cursoActivo.id,'nombre',e.target.value)} placeholder="Nombre del curso"/>
              <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                {COLORES_CURSO.map(col=>(
                  <div key={col} onClick={()=>updateCurso(cursoActivo.id,'color',col)}
                    style={{ width:22,height:22,borderRadius:'50%',background:col,cursor:'pointer',
                      border:cursoActivo.color===col?'3px solid #0F172A':'2px solid transparent'}}/>
                ))}
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={()=>moveCurso(cursoActivo.id,-1)} style={btnIcon} title="Mover izquierda">←</button>
                <button onClick={()=>moveCurso(cursoActivo.id,1)} style={btnIcon} title="Mover derecha">→</button>
                <button onClick={()=>{ if(window.confirm('¿Duplicar este curso?')) { duplicateCurso(cursoActivo.id); } }} style={{...btnIcon,fontSize:14}} title="Duplicar curso">⧉</button>
                <button onClick={()=>{ if(window.confirm('¿Eliminar este curso?')) deleteCurso(cursoActivo.id); }} style={{...btnIcon,color:'#DC2626',borderColor:'#FCA5A5'}} title="Eliminar curso"><Trash2 size={13}/></button>
              </div>
            </div>

            {/* Mensaje de bienvenida */}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>💬 Mensaje de bienvenida del curso</label>
              <textarea style={{...inp,height:70,resize:'vertical'}}
                value={cursoActivo.bienvenida||''}
                onChange={e=>updateCurso(cursoActivo.id,'bienvenida',e.target.value)}
                placeholder="Escribe un mensaje para tus alumnos de este curso…"/>
            </div>

            {/* Enlaces del curso */}
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <label style={{...lbl,margin:0}}>🔗 Enlace rápidos del curso</label>
                <button onClick={()=>updateCursoEnlaces(cursoActivo.id,[...(cursoActivo.enlaces||[]),newEnlaceCurso()])}
                  style={{...btnPrimary,background:cursoActivo.color,padding:'5px 11px',fontSize:12}}>
                  <Plus size={11}/> Añadir enlace
                </button>
              </div>
              {(cursoActivo.enlaces||[]).length===0 && (
                <p style={{ fontSize:12, color:'#94A3B8', margin:0 }}>Añade enlaces que aparecerán como botones debajo del mensaje de bienvenida.</p>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(cursoActivo.enlaces||[]).map((en,ei)=>(
                  <div key={en.id} style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input style={{...inp,flex:'0 0 140px'}} value={en.titulo} placeholder="Texto del botón"
                      onChange={e=>{const arr=[...(cursoActivo.enlaces||[])];arr[ei]={...en,titulo:e.target.value};updateCursoEnlaces(cursoActivo.id,arr);}}/>
                    <input style={{...inp,flex:1}} value={en.url} placeholder="https://…"
                      onChange={e=>{const arr=[...(cursoActivo.enlaces||[])];arr[ei]={...en,url:e.target.value};updateCursoEnlaces(cursoActivo.id,arr);}}/>
                    <button onClick={()=>updateCursoEnlaces(cursoActivo.id,(cursoActivo.enlaces||[]).filter((_,j)=>j!==ei))}
                      style={{ background:'none',border:'none',cursor:'pointer',color:'#DC2626',flexShrink:0,padding:'0 2px' }}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actividades (recursos + juegos) */}
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <label style={{...lbl,margin:0}}>🎮 Actividades ({totalActividades})</label>
                <button onClick={()=>setActividadesPickerAbierto(true)}
                  style={{...btnPrimary,background:cursoActivo.color,padding:'6px 12px',fontSize:12}}>
                  <Plus size={12}/> Añadir
                </button>
              </div>
              {totalActividades===0 && (
                <p style={{ fontSize:12, color:'#94A3B8', margin:0 }}>Pulsa "Añadir" para incluir juegos o recursos.</p>
              )}
              {totalActividades>0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {/* Recursos */}
                  {(cursoActivo.recursos||[]).map(rid=>{
                    const r=misRecursos.find(x=>x.id===rid);
                    return r ? (
                      <div key={rid} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:`${cursoActivo.color}15`, border:`1px solid ${cursoActivo.color}40`, fontSize:12, fontWeight:600, color:'#0F172A' }}>
                        📁 {r.titulo}
                        <button onClick={()=>toggleRecurso(cursoActivo.id,rid)} style={{ background:'none',border:'none',cursor:'pointer',color:'#94A3B8',padding:0,lineHeight:1 }}>×</button>
                      </div>
                    ) : null;
                  })}
                  {/* Juegos */}
                  {(cursoActivo.juegos||[]).map(jid=>{
                    const j=JUEGOS_DISPONIBLES.find(x=>x.id===jid);
                    return j ? (
                      <div key={jid} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:`${cursoActivo.color}15`, border:`1px solid ${cursoActivo.color}40`, fontSize:12, fontWeight:600, color:'#0F172A' }}>
                        {j.emoji} {j.nombre}
                        <button onClick={()=>toggleJuego(cursoActivo.id,jid)} style={{ background:'none',border:'none',cursor:'pointer',color:'#94A3B8',padding:0,lineHeight:1 }}>×</button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Temas */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <label style={{...lbl,margin:0}}>📚 Temas ({(cursoActivo.temas||[]).length})</label>
                <button onClick={()=>addTema(cursoActivo.id)}
                  style={{...btnPrimary,background:cursoActivo.color,padding:'6px 12px',fontSize:12}}>
                  <Plus size={12}/> Añadir tema
                </button>
              </div>

              {(cursoActivo.temas||[]).length===0 && (
                <p style={{ fontSize:12, color:'#94A3B8', margin:0 }}>Añade temas para organizar las tareas del curso.</p>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(cursoActivo.temas||[]).map((tema,ti)=>{
                  const isOpen=temasExpanded.has(tema.id);
                  return (
                    <div key={tema.id} style={{ border:`1.5px solid ${isOpen?(tema.color||cursoActivo.color):tema.oculto?'#FCD34D':'#E2E8F0'}`, borderRadius:10, overflow:'hidden' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:isOpen?`${tema.color||cursoActivo.color}08`:tema.oculto?'#FEF9C3':'#FAFAFA', cursor:'pointer' }}
                        onClick={()=>toggleExpandTema(tema.id)}>
                        <span style={{ fontSize:12 }}>{isOpen?'▾':'▸'}</span>
                        <input value={tema.titulo} onChange={e=>{e.stopPropagation();updateTema(cursoActivo.id,tema.id,'titulo',e.target.value);}}
                          onClick={e=>e.stopPropagation()}
                          style={{ flex:1,border:'none',background:'transparent',fontWeight:700,fontSize:14,color:tema.oculto?'#92400E':'#0F172A',outline:'none',fontFamily:'inherit'}}
                          placeholder="Título del tema"/>
                        {tema.oculto && <span style={{ fontSize:10, color:'#92400E', fontWeight:700, background:'#FEF3C7', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>Oculto</span>}
                        <div style={{ display:'flex', gap:3 }} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>toggleOcultoTema(cursoActivo.id,tema.id)}
                            title={tema.oculto?'Mostrar al público':'Ocultar al público'}
                            style={{...btnIcon,width:22,height:22,fontSize:13,background:tema.oculto?'#FEF3C7':'white',borderColor:tema.oculto?'#FCD34D':'#E2E8F0'}}>
                            {tema.oculto?'👁':'🙈'}
                          </button>
                          <button onClick={()=>duplicateTema(cursoActivo.id,tema.id)} title="Duplicar tema"
                            style={{...btnIcon,width:22,height:22,fontSize:12}}>⧉</button>
                          <button onClick={()=>moveTema(cursoActivo.id,tema.id,-1)} disabled={ti===0} style={{...btnIcon,width:22,height:22,fontSize:11,opacity:ti===0?0.3:1}}>↑</button>
                          <button onClick={()=>moveTema(cursoActivo.id,tema.id,1)} disabled={ti===(cursoActivo.temas.length-1)} style={{...btnIcon,width:22,height:22,fontSize:11,opacity:ti===(cursoActivo.temas.length-1)?0.3:1}}>↓</button>
                          <button onClick={()=>deleteTema(cursoActivo.id,tema.id)} style={{...btnIcon,width:22,height:22,color:'#DC2626',borderColor:'#FCA5A5'}}><Trash2 size={11}/></button>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding:'10px 12px', borderTop:`1px solid ${(tema.color||cursoActivo.color)}20` }}>
                          {/* Color del tema */}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                            <span style={{ fontSize:11, fontWeight:600, color:'#64748B' }}>Color:</span>
                            {COLORES_CURSO.map(col=>(
                              <div key={col} onClick={()=>updateTema(cursoActivo.id,tema.id,'color',col)}
                                style={{ width:18,height:18,borderRadius:'50%',background:col,cursor:'pointer',
                                  border:(tema.color||cursoActivo.color)===col?'3px solid #0F172A':'2px solid transparent',flexShrink:0}}/>
                            ))}
                            {tema.color && tema.color!==cursoActivo.color && (
                              <button onClick={()=>updateTema(cursoActivo.id,tema.id,'color','')}
                                style={{ fontSize:11,color:'#94A3B8',background:'none',border:'none',cursor:'pointer',marginLeft:2,padding:0 }}>↩ reset</button>
                            )}
                          </div>
                          <textarea style={{...inp,height:52,resize:'none',marginBottom:10}}
                            value={tema.descripcion} onChange={e=>updateTema(cursoActivo.id,tema.id,'descripcion',e.target.value)}
                            placeholder="Descripción o índice del tema…"/>
                          {/* Presentación PiKT del tema */}
                          <div style={{ marginBottom:10 }}>
                            <label style={{...lbl,marginBottom:4}}>🎞️ Presentación del tema</label>
                            {tema.presentacionId ? (
                              <div style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'#F5F3FF',border:'1px solid #C4B5FD',borderRadius:8 }}>
                                <span>📊</span>
                                <span style={{ flex:1,fontSize:12,fontWeight:600,color:'#6D28D9' }}>Presentación PiKT</span>
                                <button onClick={()=>setTemaPresPickerAbierto(tema.id)} style={{ fontSize:11,color:'#6D28D9',background:'none',border:'none',cursor:'pointer',fontWeight:700 }}>Cambiar</button>
                                <button onClick={()=>updateTema(cursoActivo.id,tema.id,'presentacionId','')} style={{ fontSize:11,color:'#DC2626',background:'none',border:'none',cursor:'pointer',fontWeight:700 }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={()=>setTemaPresPickerAbierto(tema.id)}
                                style={{ ...inp,background:'#F5F3FF',color:'#6D28D9',border:'1.5px dashed #C4B5FD',cursor:'pointer',textAlign:'center',fontWeight:600,fontSize:12,fontFamily:'inherit',padding:'7px' }}>
                                🎞️ + Añadir presentación PiKT
                              </button>
                            )}
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {tema.tareas.map(ta=>(
                              <TareaEditor key={ta.id} tarea={ta} misRecursos={misRecursos} usuario={usuario}
                                onUpdate={patch=>updateTarea(cursoActivo.id,tema.id,ta.id,patch)}
                                onDelete={()=>deleteTarea(cursoActivo.id,tema.id,ta.id)}/>
                            ))}
                          </div>
                          <button onClick={()=>addTarea(cursoActivo.id,tema.id)}
                            style={{ marginTop:8,width:'100%',padding:'8px',borderRadius:8,border:`1px dashed ${tema.color||cursoActivo.color}`,background:'white',color:tema.color||cursoActivo.color,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit' }}>
                            + Añadir tarea
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </section>

      {/* Picker de actividades */}
      {actividadesPickerAbierto && cursoActivo && (
        <ActividadesPicker
          misRecursos={misRecursos}
          selRecursos={cursoActivo.recursos||[]}
          selJuegos={cursoActivo.juegos||[]}
          onToggleRecurso={rid=>toggleRecurso(cursoActivo.id,rid)}
          onToggleJuego={jid=>toggleJuego(cursoActivo.id,jid)}
          onClose={()=>setActividadesPickerAbierto(false)}
        />
      )}
      {/* Picker de presentación PiKT para tema */}
      {temaPresPickerAbierto && cursoActivo && (()=>{
        const tema=cursoActivo.temas?.find(t=>t.id===temaPresPickerAbierto);
        return tema ? (
          <PiKTPresentacionPicker usuario={usuario} presentacionId={tema.presentacionId||''}
            onSelect={id=>{updateTema(cursoActivo.id,temaPresPickerAbierto,'presentacionId',id);setTemaPresPickerAbierto(null);}}
            onClose={()=>setTemaPresPickerAbierto(null)}/>
        ) : null;
      })()}
    </div>
  );
}

const card        = { background:'white', borderRadius:14, padding:'18px 16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'1px solid #F1F5F9' };
const lbl         = { display:'block', fontSize:12, fontWeight:600, color:'#64748B', marginBottom:4 };
const inp         = { width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, border:'1px solid #CBD5E1', fontSize:14, fontFamily:'inherit', outline:'none' };
const btnPrimary  = { display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', borderRadius:10, border:'none', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnOutline  = { display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, border:'1px solid #CBD5E1', background:'white', color:'#374151', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnIcon     = { display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color:'#374151', fontSize:13 };
const btnSmall    = { display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:7, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color:'#6D28D9', fontSize:12, fontWeight:600, fontFamily:'inherit' };
const sectionTitle = { margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#1E1B4B' };
