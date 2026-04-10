// EditorPaginaProfesor.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Globe, Plus, Trash2, Eye, Save, BookOpen, Link, Gamepad2, Image, Video, ExternalLink, ChevronDown, ChevronUp, X, Search } from 'lucide-react';

const COLORES_CURSO = ['#6D28D9','#1D4ED8','#047857','#DC2626','#D97706','#0F766E','#BE185D','#374151'];

const JUEGOS_DISPONIBLES = [
  { id:'pasapalabra',     nombre:'Pasapalabra',         emoji:'🔤', desc:'El rosco de letras',            url:'/pasapalabra',        grupo:'general' },
  { id:'cazaburbujas',    nombre:'Cazaburbujas',        emoji:'🫧', desc:'Explota las burbujas',          url:'/cazaburbujas',       grupo:'general' },
  { id:'aparejados',      nombre:'AparejaDOS',          emoji:'🃏', desc:'Encuentra las parejas',         url:'/aparejados',         grupo:'general' },
  { id:'ruleta',          nombre:'La Ruleta',           emoji:'🎡', desc:'Ruleta de la suerte',           url:'/ruleta',             grupo:'general' },
  { id:'sopa',            nombre:'Sopa de Letras',      emoji:'🔍', desc:'Encuentra las palabras',        url:'/sopa_letras',        grupo:'general' },
  { id:'wordle',          nombre:'WordLe',              emoji:'🟩', desc:'Adivina la palabra',            url:'/wordle',             grupo:'general' },
  { id:'mathle',          nombre:'MathLe',              emoji:'🔢', desc:'Adivina la ecuación',           url:'/mathle',             grupo:'general' },
  { id:'omninteractive',  nombre:'OmniInteractive',     emoji:'📚', desc:'Actividades interactivas',      url:'/omninteractive',     grupo:'general' },
  { id:'videoquizz',      nombre:'VideoQuizz',          emoji:'🎬', desc:'Quiz sobre vídeos',             url:'/videoquizz',         grupo:'general' },
  { id:'sintaxis',        nombre:'Sintaxis',            emoji:'🖍️', desc:'Analiza frases',               url:'/sintaxis',           grupo:'general' },
  { id:'listening',       nombre:'Listening',           emoji:'🙉', desc:'Escucha y completa',            url:'/listening',          grupo:'general' },
  { id:'etiquetas',       nombre:'EtiquetaMe',          emoji:'🏷️', desc:'Pon las etiquetas correctas',  url:'/etiquetas',          grupo:'general' },
  { id:'pikatron',        nombre:'Pikatron',            emoji:'⚡', desc:'Runner con preguntas',          url:'/pikatron',           grupo:'general' },
  { id:'pikatron_2',      nombre:'Plataformas',         emoji:'🏃', desc:'Plataformas con preguntas',     url:'/pikatron_2',         grupo:'general' },
  { id:'kartinged',       nombre:'Karting',             emoji:'🚗', desc:'Carreras con preguntas',        url:'/kartinged',          grupo:'general' },
  { id:'kartinged_multi', nombre:'Karting Multi',       emoji:'🏎️', desc:'Carreras multijugador',        url:'/kartinged_multi',    grupo:'general' },
  { id:'pilive',          nombre:'PiLive',              emoji:'🎯', desc:'Quiz en vivo',                  url:'/thinkhoot',          grupo:'vivo' },
  { id:'mathlive',        nombre:'MathLive',            emoji:'📊', desc:'Matemáticas en tiempo real',    url:'/mathlive',           grupo:'vivo' },
  { id:'olympiclive',     nombre:'Olympic Live',        emoji:'🏅', desc:'Minijuegos en directo',         url:'/olympiclive',        grupo:'vivo' },
  { id:'geometrix',       nombre:'Geometrix',           emoji:'📐', desc:'Áreas y volúmenes',             url:'/geometrix',          grupo:'math' },
  { id:'calculo',         nombre:'Cálculo',             emoji:'🧠', desc:'Agilidad mental',               url:'/calculo',            grupo:'math' },
  { id:'funciones',       nombre:'Funciones',           emoji:'📈', desc:'Representación de funciones',   url:'/funciones',          grupo:'math' },
  { id:'geom_analitica',  nombre:'Geometría Analítica', emoji:'♐', desc:'Rectas, parábolas y análisis',  url:'/geometria_analitica', grupo:'math' },
  { id:'ecuaciones',      nombre:'Ecuaciones',          emoji:'⚖️', desc:'Despeja la X paso a paso',     url:'/ecuaciones',         grupo:'math' },
  { id:'oca',             nombre:'Oca Matemática',      emoji:'🎲', desc:'Juego de oca con mates',        url:'/oca',                grupo:'math' },
];

// Juegos que NO necesitan recurso (aplicaciones standalone)
const JUEGOS_STANDALONE = new Set(['geometrix','calculo','funciones','geom_analitica','ecuaciones','oca','pilive','mathlive','olympiclive','kartinged_multi']);

// Mapeo juegoId → tipoJuego de Firestore para filtrar recursos
const JUEGO_TIPO_FILTRO = {
  pasapalabra:'PASAPALABRA', cazaburbujas:'CAZABURBUJAS', aparejados:'APAREJADOS',
  ruleta:'RULETA', sopa:'SOPA', wordle:'WORDLE', mathle:'MATHLE',
  omninteractive:'OMNINTERACTIVE', videoquizz:'VIDEOQUIZZ',
  sintaxis:'SINTAXIS', listening:'LISTENING', etiquetas:'ETIQUETAS',
  pikatron:'PIKATRON', pikatron_2:'PIKATRON_2',
  kartinged:'KARTINGED', kartinged_multi:'KARTINGED_MULTI',
  pilive:'THINKHOOT', mathlive:'MATHLIVE', olympiclive:'OLYMPICLIVE',
};

// ─── Migración de formato antiguo ────────────────────────────────────────────
function migrateCurso(c) {
  if (c.temas !== undefined) return { juegos:[], ...c };
  const temas = [];
  if ((c.tareas||[]).length > 0) {
    temas.push({ id:'tema_legacy', titulo:'Tareas generales', descripcion:'', tareas: c.tareas });
  }
  const { tareas: _t, ...rest } = c;
  return { juegos:[], ...rest, temas };
}

function newCurso() {
  return { id:'c_'+Math.random().toString(36).slice(2,8), nombre:'Nuevo curso', color:'#6D28D9', recursos:[], juegos:[], temas:[] };
}
function newTema() {
  return { id:'tm_'+Math.random().toString(36).slice(2,8), titulo:'Nuevo tema', descripcion:'', tareas:[] };
}
function newTarea() {
  return { id:'ta_'+Math.random().toString(36).slice(2,8), titulo:'', descripcion:'', fechaEntrega:'',
    imagenUrl:'', videoUrl:'', enlaceUrl:'', enlaceTitulo:'', juegoId:'', recursoId:'' };
}
function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
}

// ─── Selector de juego ────────────────────────────────────────────────────────
function GamePicker({ misRecursos, onSelect, onClose }) {
  const [paso, setPaso] = useState(1);
  const [juegoElegido, setJuegoElegido] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const grupos = [
    { id:'general', label:'🎮 Juegos con recursos' },
    { id:'vivo',    label:'⚡ En vivo' },
    { id:'math',    label:'🧮 Math World' },
  ];

  const filtrados = busqueda
    ? JUEGOS_DISPONIBLES.filter(j => j.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : JUEGOS_DISPONIBLES;

  const handleJuego = (j) => {
    if (JUEGOS_STANDALONE.has(j.id)) {
      onSelect({ juegoId: j.id, recursoId: '' });
    } else {
      setJuegoElegido(j);
      setPaso(2);
    }
  };

  const recursosParaJuego = juegoElegido
    ? misRecursos.filter(r => {
        const tipo = JUEGO_TIPO_FILTRO[juegoElegido.id];
        return tipo && (Array.isArray(tipo) ? tipo.includes(r.tipoJuego) : r.tipoJuego === tipo);
      })
    : [];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:600, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 30px 80px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {paso===2 && <button onClick={()=>setPaso(1)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#6D28D9', padding:0 }}>←</button>}
            <Gamepad2 size={18} color="#6D28D9"/>
            <span style={{ fontWeight:700, fontSize:15, color:'#1E1B4B' }}>
              {paso===1 ? 'Elige un juego' : `${juegoElegido?.emoji} ${juegoElegido?.nombre} — elige recurso`}
            </span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8' }}><X size={20}/></button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'16px 20px' }}>
          {paso === 1 && (
            <>
              {/* Búsqueda */}
              <div style={{ position:'relative', marginBottom:14 }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }}/>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar juego…"
                  style={{ width:'100%', boxSizing:'border-box', paddingLeft:32, paddingRight:12, height:36, borderRadius:8, border:'1px solid #CBD5E1', fontSize:13, fontFamily:'inherit', outline:'none' }}/>
              </div>
              {/* Grupos */}
              {(busqueda ? [{ id:'all', label:'Resultados' }] : grupos).map(grupo => {
                const items = busqueda ? filtrados : filtrados.filter(j=>j.grupo===grupo.id);
                if (!items.length) return null;
                return (
                  <div key={grupo.id} style={{ marginBottom:16 }}>
                    {!busqueda && <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>{grupo.label}</div>}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8 }}>
                      {items.map(j => (
                        <button key={j.id} onClick={()=>handleJuego(j)} style={{
                          display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 8px',
                          borderRadius:10, border:'1.5px solid #E2E8F0', background:'white', cursor:'pointer',
                          transition:'all 0.15s', textAlign:'center', fontFamily:'inherit',
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#6D28D9';e.currentTarget.style.background='#F5F3FF';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F0';e.currentTarget.style.background='white';}}>
                          <span style={{ fontSize:22 }}>{j.emoji}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#0F172A', lineHeight:1.2 }}>{j.nombre}</span>
                          <span style={{ fontSize:10, color:'#94A3B8', lineHeight:1.3 }}>{j.desc}</span>
                          {!JUEGOS_STANDALONE.has(j.id) && <span style={{ fontSize:10, color:'#6D28D9', fontWeight:600 }}>Elige recurso →</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {paso === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={()=>onSelect({ juegoId:juegoElegido.id, recursoId:'' })}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, border:'2px dashed #CBD5E1', background:'#F8FAFC', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                <span style={{ fontSize:20 }}>🌐</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'#374151' }}>Sin recurso específico</div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>Abre la versión genérica del juego</div>
                </div>
              </button>
              {recursosParaJuego.length === 0 && (
                <p style={{ fontSize:12, color:'#94A3B8', textAlign:'center', padding:'20px 0' }}>No tienes recursos de tipo {juegoElegido?.nombre} publicados.</p>
              )}
              {recursosParaJuego.map(r => (
                <button key={r.id} onClick={()=>onSelect({ juegoId:juegoElegido.id, recursoId:r.id })}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, border:'1.5px solid #E2E8F0', background:'white', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all 0.15s' }}
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

// ─── Editor de una tarea ──────────────────────────────────────────────────────
function TareaEditor({ tarea, misRecursos, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [pickerAbierto, setPickerAbierto] = useState(false);

  const juegoInfo = tarea.juegoId ? JUEGOS_DISPONIBLES.find(j=>j.id===tarea.juegoId) : null;
  const recursoInfo = tarea.recursoId ? misRecursos.find(r=>r.id===tarea.recursoId) : null;
  const tieneExtra = tarea.imagenUrl||tarea.videoUrl||tarea.enlaceUrl||tarea.juegoId;

  return (
    <div style={{ border:'1px solid #E2E8F0', borderRadius:10, padding:'10px 12px', background:'white' }}>
      <div style={{ display:'flex', gap:6, marginBottom:5 }}>
        <input style={{ ...inp, flex:1, padding:'5px 8px', fontWeight:600, fontSize:13 }}
          value={tarea.titulo} onChange={e=>onUpdate({ titulo:e.target.value })} placeholder="Título de la tarea" />
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'#DC2626', padding:'0 4px', flexShrink:0 }}>
          <Trash2 size={13}/>
        </button>
      </div>
      <textarea style={{ ...inp, height:48, resize:'none', fontSize:12, padding:'5px 8px' }}
        value={tarea.descripcion} onChange={e=>onUpdate({ descripcion:e.target.value })} placeholder="Descripción…" />
      <input type="date" style={{ ...inp, fontSize:12, padding:'4px 8px', marginTop:5 }}
        value={tarea.fechaEntrega} onChange={e=>onUpdate({ fechaEntrega:e.target.value })} />

      {/* Juego seleccionado */}
      {juegoInfo && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, padding:'5px 8px', background:'#F5F3FF', borderRadius:8, border:'1px solid #DDD6FE' }}>
          <span style={{ fontSize:16 }}>{juegoInfo.emoji}</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#6D28D9', flex:1 }}>
            {juegoInfo.nombre}{recursoInfo ? ` · ${recursoInfo.titulo}` : ''}
          </span>
          <button onClick={()=>onUpdate({ juegoId:'', recursoId:'' })} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', padding:0 }}><X size={13}/></button>
        </div>
      )}

      {/* Barra de acciones */}
      <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
        <button onClick={()=>setPickerAbierto(true)} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 10px', borderRadius:7, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color:'#6D28D9', fontWeight:600, fontFamily:'inherit' }}>
          <Gamepad2 size={11}/> {juegoInfo ? 'Cambiar juego' : '+ Juego'}
        </button>
        <button onClick={()=>setExpanded(!expanded)} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 10px', borderRadius:7, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color: tieneExtra&&!juegoInfo ? '#6D28D9' : '#94A3B8', fontFamily:'inherit' }}>
          {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          {tieneExtra && !juegoInfo ? '✦ Contenido extra' : 'Imagen / Video / Enlace'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:7, borderTop:'1px dashed #E2E8F0', paddingTop:8 }}>
          <div>
            <label style={{ ...lbl, fontSize:10, display:'flex', alignItems:'center', gap:4 }}><Image size={11}/>URL de imagen</label>
            <input style={{ ...inp, fontSize:11, padding:'4px 8px' }}
              value={tarea.imagenUrl||''} onChange={e=>onUpdate({ imagenUrl:e.target.value })} placeholder="https://…/imagen.jpg" />
          </div>
          <div>
            <label style={{ ...lbl, fontSize:10, display:'flex', alignItems:'center', gap:4 }}><Video size={11}/>URL de video (YouTube o directo)</label>
            <input style={{ ...inp, fontSize:11, padding:'4px 8px' }}
              value={tarea.videoUrl||''} onChange={e=>onUpdate({ videoUrl:e.target.value })} placeholder="https://youtube.com/watch?v=…" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:6 }}>
            <div>
              <label style={{ ...lbl, fontSize:10, display:'flex', alignItems:'center', gap:4 }}><ExternalLink size={11}/>Enlace externo</label>
              <input style={{ ...inp, fontSize:11, padding:'4px 8px' }}
                value={tarea.enlaceUrl||''} onChange={e=>onUpdate({ enlaceUrl:e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <label style={{ ...lbl, fontSize:10 }}>Texto del botón</label>
              <input style={{ ...inp, fontSize:11, padding:'4px 8px' }}
                value={tarea.enlaceTitulo||''} onChange={e=>onUpdate({ enlaceTitulo:e.target.value })} placeholder="Ver recurso" />
            </div>
          </div>
        </div>
      )}

      {pickerAbierto && (
        <GamePicker
          misRecursos={misRecursos}
          onSelect={({ juegoId, recursoId }) => { onUpdate({ juegoId, recursoId }); setPickerAbierto(false); }}
          onClose={() => setPickerAbierto(false)}
        />
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EditorPaginaProfesor({ usuario, onPreview }) {
  const [pagina, setPagina] = useState({
    nombre: usuario?.displayName || '', descripcion:'', asignatura:'', localidad:'',
    slug:'', publicada:false, cursos:[],
  });
  const [misRecursos, setMisRecursos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [tab, setTab]       = useState(null);
  const [slugStatus, setSlugStatus] = useState(null);
  const [temasExpanded, setTemasExpanded] = useState(new Set());

  const pageUrl = pagina.slug
    ? `${window.location.origin}/${pagina.slug}`
    : `${window.location.origin}/?p=${usuario?.uid}`;

  useEffect(() => {
    if (!usuario?.uid) return;
    getDoc(doc(db,'paginas_profesores',usuario.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setPagina(p => ({ ...p, ...data, cursos:(data.cursos||[]).map(migrateCurso) }));
        if (data.slug) setSlugStatus('ok');
      }
    });
    const q = query(collection(db,'resources'), where('profesorUid','==',usuario.uid), where('isFinished','==',true));
    getDocs(q).then(snap => setMisRecursos(snap.docs.map(d => ({ ...d.data(), id:d.id }))));
  }, [usuario?.uid]);

  const SLUGS_RESERVADOS = new Set([
    'populares','inicio','pasapalabra','cazaburbujas','burbujas','pikatron','pikatron_2','plataformas',
    'kartinged','karting','kartinged_multi','karting_multi','aparejados','ruleta','wordle','mathle',
    'thinkhoot','pilive','mathlive','olympiclive','olympic_live','sopa','sopa_letras',
    'question_sender','q-sender','omninteractive','videoquizz','sintaxis','listening',
    'etiquetas','etiquetame','geometrix','calculo','funciones','funciones2',
    'geometria_analitica','geometriaanalitica','ecuaciones','oca','api','admin','login','app',
  ]);

  const checkSlug = async (val) => {
    const s = slugify(val);
    setField('slug', s);
    if (!s) { setSlugStatus('empty'); return; }
    if (SLUGS_RESERVADOS.has(s)) { setSlugStatus('taken'); return; }
    setSlugStatus('checking');
    try {
      const snap = await getDocs(query(collection(db,'paginas_profesores'), where('slug','==',s)));
      setSlugStatus(snap.docs.some(d=>d.id!==usuario?.uid) ? 'taken' : 'ok');
    } catch { setSlugStatus('ok'); }
  };

  const setField = (k, v) => setPagina(p => ({ ...p, [k]:v }));

  // ─── Cursos ───────────────────────────────────────────────────────────────
  const addCurso = () => { const c=newCurso(); setPagina(p=>({...p,cursos:[...p.cursos,c]})); setTab(c.id); };
  const updateCurso = (id,f,v) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const deleteCurso = (id) => { setPagina(p=>({...p,cursos:p.cursos.filter(c=>c.id!==id)})); if(tab===id) setTab(null); };
  const moveCurso = (id,dir) => setPagina(p=>{
    const arr=[...p.cursos]; const i=arr.findIndex(c=>c.id===id); const j=i+dir;
    if(j<0||j>=arr.length) return p; [arr[i],arr[j]]=[arr[j],arr[i]]; return {...p,cursos:arr};
  });
  const toggleRecurso = (cid,rid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>{
    if(c.id!==cid) return c; const t=c.recursos.includes(rid);
    return {...c,recursos:t?c.recursos.filter(r=>r!==rid):[...c.recursos,rid]};
  })}));
  const toggleJuego = (cid,jid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>{
    if(c.id!==cid) return c; const t=(c.juegos||[]).includes(jid);
    return {...c,juegos:t?c.juegos.filter(j=>j!==jid):[...(c.juegos||[]),jid]};
  })}));

  // ─── Temas ────────────────────────────────────────────────────────────────
  const addTema = (cid) => { const t=newTema(); setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{...c,temas:[...(c.temas||[]),t]})}));
    setTemasExpanded(s=>{const n=new Set(s); n.add(t.id); return n;}); };
  const updateTema = (cid,tid,f,v) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,[f]:v})})}));
  const deleteTema = (cid,tid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).filter(t=>t.id!==tid)})}));
  const moveTema = (cid,tid,dir) => setPagina(p=>{
    const ci=p.cursos.findIndex(c=>c.id===cid); if(ci<0) return p;
    const temas=[...(p.cursos[ci].temas||[])]; const i=temas.findIndex(t=>t.id===tid); const j=i+dir;
    if(j<0||j>=temas.length) return p; [temas[i],temas[j]]=[temas[j],temas[i]];
    const cursos=[...p.cursos]; cursos[ci]={...cursos[ci],temas}; return {...p,cursos};
  });
  const toggleExpandTema = (tid) => setTemasExpanded(s=>{const n=new Set(s); n.has(tid)?n.delete(tid):n.add(tid); return n;});

  // ─── Tareas ───────────────────────────────────────────────────────────────
  const addTarea = (cid,tid) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,tareas:[...t.tareas,newTarea()]})})}));
  const updateTarea = (cid,tid,taId,patch) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,tareas:t.tareas.map(ta=>ta.id!==taId?ta:{...ta,...patch})})})}));
  const deleteTarea = (cid,tid,taId) => setPagina(p=>({...p,cursos:p.cursos.map(c=>c.id!==cid?c:{
    ...c,temas:(c.temas||[]).map(t=>t.id!==tid?t:{...t,tareas:t.tareas.filter(ta=>ta.id!==taId)})})}));

  const save = async (publicar) => {
    if (!pagina.slug) { alert('Elige una dirección (URL) para tu página antes de guardar.'); return; }
    if (slugStatus==='taken') { alert('Esa dirección ya está en uso. Elige otra.'); return; }
    if (slugStatus==='checking') { alert('Espera, estamos verificando la disponibilidad.'); return; }
    setSaving(true);
    try {
      const data = { ...pagina, publicada: publicar??pagina.publicada, profesorUid:usuario.uid, updatedAt:new Date() };
      await setDoc(doc(db,'paginas_profesores',usuario.uid), data);
      setPagina(data); setSaved(true); setTimeout(()=>setSaved(false),2500);
    } catch(e) { alert('Error: '+e.message); }
    setSaving(false);
  };

  const cursoActivo = pagina.cursos.find(c=>c.id===tab);

  return (
    <div style={{ maxWidth:960, margin:'0 auto', padding:'0 16px 60px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ background:'#EDE9FE', borderRadius:'50%', padding:10 }}><Globe size={24} color="#6D28D9"/></div>
          <div>
            <h2 style={{ margin:0, color:'#1E1B4B', fontSize:20 }}>Mi Página de Profesor</h2>
            <p style={{ margin:0, fontSize:12, color:'#94A3B8' }}>Crea tu espacio para tus alumnos</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>onPreview?.(usuario.uid)} style={btnOutline}><Eye size={15}/> Vista previa</button>
          <button onClick={()=>{navigator.clipboard.writeText(pageUrl);alert('¡Enlace copiado!');}} style={btnOutline}><Link size={15}/> Copiar enlace</button>
          <button onClick={()=>save()} disabled={saving} style={{...btnPrimary,background:'#4F46E5'}}>
            <Save size={15}/> {saving?'Guardando…':saved?'¡Guardado!':'Guardar'}
          </button>
          <button onClick={()=>save(!pagina.publicada)} disabled={saving} style={{...btnPrimary,background:pagina.publicada?'#DC2626':'#059669'}}>
            {pagina.publicada?'🔒 Despublicar':'🌐 Publicar'}
          </button>
        </div>
      </div>

      {pagina.publicada && (
        <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#166534', display:'flex', gap:8, alignItems:'center' }}>
          <Globe size={14}/> Tu página: <a href={pageUrl} target="_blank" rel="noreferrer" style={{ color:'#6D28D9', fontWeight:600 }}>{pageUrl}</a>
        </div>
      )}

      {/* Info general */}
      <section style={card}>
        <h3 style={sectionTitle}>Información general</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div><label style={lbl}>Nombre visible</label>
            <input style={inp} value={pagina.nombre} onChange={e=>setField('nombre',e.target.value)} placeholder="Ej: Profe García" /></div>
          <div><label style={lbl}>Asignatura / Centro</label>
            <input style={inp} value={pagina.asignatura||''} onChange={e=>setField('asignatura',e.target.value)} placeholder="Ej: Inglés · IES Ejemplo" /></div>
          <div><label style={lbl}>Localidad</label>
            <input style={inp} value={pagina.localidad||''} onChange={e=>setField('localidad',e.target.value)} placeholder="Ej: Madrid" /></div>
          <div>
            <label style={lbl}>Dirección de tu página (URL)</label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'#94A3B8', flexShrink:0 }}>pikt.es/</span>
              <input style={{...inp,flex:1}} value={pagina.slug||''} onChange={e=>checkSlug(e.target.value)} placeholder="profe-garcia" />
            </div>
            {slugStatus==='checking' && <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>⏳ Comprobando…</div>}
            {slugStatus==='ok'       && <div style={{ fontSize:11, color:'#059669', marginTop:3 }}>✓ Disponible</div>}
            {slugStatus==='taken'    && <div style={{ fontSize:11, color:'#DC2626', marginTop:3 }}>✗ Ya está en uso</div>}
            {slugStatus==='empty'    && <div style={{ fontSize:11, color:'#F59E0B', marginTop:3 }}>Elige una dirección</div>}
          </div>
        </div>
        <label style={{...lbl,marginTop:12}}>Descripción</label>
        <textarea style={{...inp,height:80,resize:'vertical'}} value={pagina.descripcion} onChange={e=>setField('descripcion',e.target.value)} placeholder="Preséntate brevemente a tus alumnos…" />
      </section>

      {/* Cursos */}
      <section style={{...card,marginTop:16}}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{...sectionTitle,margin:0}}>Cursos / Grupos</h3>
          <button onClick={addCurso} style={{...btnPrimary,background:'#6D28D9',fontSize:13,padding:'6px 14px'}}><Plus size={14}/> Añadir curso</button>
        </div>

        {pagina.cursos.length===0 && (
          <p style={{ color:'#94A3B8', textAlign:'center', padding:'24px 0', fontSize:14 }}>Añade cursos para organizar tus recursos y tareas por grupo.</p>
        )}

        {pagina.cursos.length>0 && (
          <>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {pagina.cursos.map(c=>(
                <button key={c.id} onClick={()=>setTab(c.id)} style={{ padding:'6px 16px', borderRadius:20, border:`2px solid ${c.color}`,
                  background:tab===c.id?c.color:'white', color:tab===c.id?'white':c.color, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s' }}>{c.nombre}</button>
              ))}
            </div>

            {cursoActivo && (
              <div style={{ border:`2px solid ${cursoActivo.color}20`, borderRadius:12, padding:16 }}>
                {/* Curso header */}
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
                  <input style={{...inp,flex:1,minWidth:140,fontWeight:700,fontSize:15}}
                    value={cursoActivo.nombre} onChange={e=>updateCurso(cursoActivo.id,'nombre',e.target.value)} placeholder="Nombre del curso"/>
                  <div style={{ display:'flex', gap:4 }}>
                    {COLORES_CURSO.map(col=>(
                      <div key={col} onClick={()=>updateCurso(cursoActivo.id,'color',col)}
                        style={{ width:20,height:20,borderRadius:'50%',background:col,cursor:'pointer',
                          border:cursoActivo.color===col?'3px solid #0F172A':'2px solid transparent'}}/>
                    ))}
                  </div>
                  <button onClick={()=>moveCurso(cursoActivo.id,-1)} style={btnIcon}>←</button>
                  <button onClick={()=>moveCurso(cursoActivo.id,1)} style={btnIcon}>→</button>
                  <button onClick={()=>deleteCurso(cursoActivo.id)} style={{...btnIcon,color:'#DC2626',borderColor:'#FCA5A5'}}><Trash2 size={14}/></button>
                </div>

                {/* Layout: recursos+juegos | temas */}
                <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start' }}>

                  {/* Columna izquierda: Recursos + Juegos en la página */}
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:7 }}>
                        <BookOpen size={13} color={cursoActivo.color}/>
                        <span style={{ fontWeight:700, fontSize:12, color:cursoActivo.color }}>Mis recursos ({cursoActivo.recursos.length})</span>
                      </div>
                      <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                        {misRecursos.length===0 && <p style={{ fontSize:11, color:'#94A3B8' }}>No tienes recursos publicados.</p>}
                        {misRecursos.map(r=>{ const sel=cursoActivo.recursos.includes(r.id); return (
                          <div key={r.id} onClick={()=>toggleRecurso(cursoActivo.id,r.id)} style={{
                            display:'flex', alignItems:'center', gap:7, padding:'5px 9px', borderRadius:7,
                            border:`1.5px solid ${sel?cursoActivo.color:'#E2E8F0'}`,
                            background:sel?`${cursoActivo.color}12`:'white', cursor:'pointer', fontSize:12 }}>
                            <span style={{ width:15,height:15,borderRadius:3,border:`2px solid ${sel?cursoActivo.color:'#CBD5E1'}`,background:sel?cursoActivo.color:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                              {sel&&<span style={{ color:'white',fontSize:9,fontWeight:900 }}>✓</span>}
                            </span>
                            <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.titulo}</span>
                            <span style={{ fontSize:10,color:'#94A3B8',flexShrink:0 }}>{r.tipoJuego}</span>
                          </div>
                        );})}
                      </div>
                    </div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:7 }}>
                        <Gamepad2 size={13} color={cursoActivo.color}/>
                        <span style={{ fontWeight:700, fontSize:12, color:cursoActivo.color }}>Juegos completos ({(cursoActivo.juegos||[]).length})</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                        {JUEGOS_DISPONIBLES.map(j=>{ const sel=(cursoActivo.juegos||[]).includes(j.id); return (
                          <div key={j.id} onClick={()=>toggleJuego(cursoActivo.id,j.id)} style={{
                            display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderRadius:7,
                            border:`1.5px solid ${sel?cursoActivo.color:'#E2E8F0'}`,
                            background:sel?`${cursoActivo.color}12`:'white', cursor:'pointer', fontSize:11 }}>
                            <span style={{ width:14,height:14,borderRadius:3,border:`2px solid ${sel?cursoActivo.color:'#CBD5E1'}`,background:sel?cursoActivo.color:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                              {sel&&<span style={{ color:'white',fontSize:8,fontWeight:900 }}>✓</span>}
                            </span>
                            <span style={{ fontSize:12 }}>{j.emoji}</span>
                            <span style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{j.nombre}</span>
                          </div>
                        );})}
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha: Temas */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:cursoActivo.color }}>📚 Temas ({(cursoActivo.temas||[]).length})</span>
                      <button onClick={()=>addTema(cursoActivo.id)} style={{ fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px solid ${cursoActivo.color}`, background:'white', color:cursoActivo.color, cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>
                        + Añadir tema
                      </button>
                    </div>

                    {(cursoActivo.temas||[]).length===0 && (
                      <p style={{ fontSize:12, color:'#94A3B8', textAlign:'center', padding:'20px 0' }}>Añade temas para organizar las tareas del curso.</p>
                    )}

                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {(cursoActivo.temas||[]).map((tema,ti)=>{
                        const isOpen = temasExpanded.has(tema.id);
                        return (
                          <div key={tema.id} style={{ border:`1.5px solid ${isOpen?cursoActivo.color:'#E2E8F0'}`, borderRadius:10, overflow:'hidden', transition:'border-color 0.15s' }}>
                            {/* Tema header */}
                            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', background: isOpen?`${cursoActivo.color}08`:'#FAFAFA', cursor:'pointer' }}
                              onClick={()=>toggleExpandTema(tema.id)}>
                              <span style={{ fontSize:14 }}>{isOpen?'▾':'▸'}</span>
                              <input value={tema.titulo} onChange={e=>{e.stopPropagation();updateTema(cursoActivo.id,tema.id,'titulo',e.target.value);}}
                                onClick={e=>e.stopPropagation()}
                                style={{ flex:1, border:'none', background:'transparent', fontWeight:700, fontSize:13, color:'#0F172A', outline:'none', fontFamily:'inherit', cursor:'text' }}
                                placeholder="Título del tema"/>
                              <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
                                <button onClick={()=>moveTema(cursoActivo.id,tema.id,-1)} disabled={ti===0} style={{...btnIcon,width:22,height:22,fontSize:11,opacity:ti===0?0.3:1}}>↑</button>
                                <button onClick={()=>moveTema(cursoActivo.id,tema.id,1)} disabled={ti===(cursoActivo.temas.length-1)} style={{...btnIcon,width:22,height:22,fontSize:11,opacity:ti===(cursoActivo.temas.length-1)?0.3:1}}>↓</button>
                                <button onClick={()=>deleteTema(cursoActivo.id,tema.id)} style={{...btnIcon,width:22,height:22,color:'#DC2626',borderColor:'#FCA5A5'}}><Trash2 size={11}/></button>
                              </div>
                            </div>

                            {isOpen && (
                              <div style={{ padding:'10px 12px', borderTop:`1px solid ${cursoActivo.color}20` }}>
                                <textarea style={{...inp,height:52,resize:'none',fontSize:12,marginBottom:10}}
                                  value={tema.descripcion} onChange={e=>updateTema(cursoActivo.id,tema.id,'descripcion',e.target.value)}
                                  placeholder="Descripción o índice del tema…"/>

                                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                                  {tema.tareas.map(ta=>(
                                    <TareaEditor key={ta.id} tarea={ta} misRecursos={misRecursos}
                                      onUpdate={patch=>updateTarea(cursoActivo.id,tema.id,ta.id,patch)}
                                      onDelete={()=>deleteTarea(cursoActivo.id,tema.id,ta.id)}
                                    />
                                  ))}
                                </div>

                                <button onClick={()=>addTarea(cursoActivo.id,tema.id)} style={{ marginTop:8, width:'100%', padding:'7px', borderRadius:8, border:`1px dashed ${cursoActivo.color}`, background:'white', color:cursoActivo.color, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
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
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const card        = { background:'white', borderRadius:14, padding:'20px 24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'1px solid #F1F5F9' };
const lbl         = { display:'block', fontSize:12, fontWeight:600, color:'#64748B', marginBottom:4 };
const inp         = { width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:8, border:'1px solid #CBD5E1', fontSize:13, fontFamily:'inherit', outline:'none' };
const btnPrimary  = { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:10, border:'none', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnOutline  = { display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'1px solid #CBD5E1', background:'white', color:'#374151', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnIcon     = { display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color:'#374151', fontSize:13 };
const sectionTitle = { margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#1E1B4B' };
