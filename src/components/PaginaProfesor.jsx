// PaginaProfesor.jsx — Página pública del profesor
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { BookOpen, ClipboardList, Calendar, Globe, ArrowLeft, Gamepad2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const TIPO_EMOJI = {
  PASAPALABRA:'🔤', CAZABURBUJAS:'🫧', APAREJADOS:'🃏', THINKHOOT:'⚡',
  OMNINTERACTIVE:'📚', VIDEOQUIZZ:'🎬', WORDLE:'🟩', SOPA:'🔍',
  RULETA:'🎡', SINTAXIS:'✏️', ETIQUETAS:'🏷️', MATHLIVE:'📐',
};

const JUEGOS_INFO = {
  pasapalabra:     { nombre:'Pasapalabra',          emoji:'🔤', url:'/pasapalabra' },
  cazaburbujas:    { nombre:'Cazaburbujas',          emoji:'🫧', url:'/cazaburbujas' },
  aparejados:      { nombre:'AparejaDOS',            emoji:'🃏', url:'/aparejados' },
  ruleta:          { nombre:'La Ruleta',             emoji:'🎡', url:'/ruleta' },
  sopa:            { nombre:'Sopa de Letras',        emoji:'🔍', url:'/sopa_letras' },
  wordle:          { nombre:'WordLe',                emoji:'🟩', url:'/wordle' },
  mathle:          { nombre:'MathLe',                emoji:'🔢', url:'/mathle' },
  omninteractive:  { nombre:'OmniInteractive',       emoji:'📚', url:'/omninteractive' },
  videoquizz:      { nombre:'VideoQuizz',            emoji:'🎬', url:'/videoquizz' },
  sintaxis:        { nombre:'Sintaxis',              emoji:'🖍️', url:'/sintaxis' },
  listening:       { nombre:'Listening',             emoji:'🙉', url:'/listening' },
  etiquetas:       { nombre:'EtiquetaMe',            emoji:'🏷️', url:'/etiquetas' },
  pikatron:        { nombre:'Pikatron',              emoji:'⚡', url:'/pikatron' },
  pikatron_2:      { nombre:'Plataformas',           emoji:'🏃', url:'/pikatron_2' },
  kartinged:       { nombre:'Karting',               emoji:'🚗', url:'/kartinged' },
  kartinged_multi: { nombre:'Karting Multi',         emoji:'🏎️', url:'/kartinged_multi' },
  pilive:          { nombre:'PiLive',                emoji:'🎯', url:'/thinkhoot' },
  mathlive:        { nombre:'MathLive',              emoji:'📊', url:'/mathlive' },
  olympiclive:     { nombre:'Olympic Live',          emoji:'🏅', url:'/olympiclive' },
  geometrix:       { nombre:'Geometrix',             emoji:'📐', url:'/geometrix' },
  calculo:         { nombre:'Cálculo',               emoji:'🧠', url:'/calculo' },
  funciones:       { nombre:'Funciones',             emoji:'📈', url:'/funciones' },
  geom_analitica:  { nombre:'Geometría Analítica',   emoji:'♐', url:'/geometria_analitica' },
  ecuaciones:      { nombre:'Ecuaciones',            emoji:'⚖️', url:'/ecuaciones' },
  oca:             { nombre:'Oca Matemática',        emoji:'🎲', url:'/oca' },
};

function getYouTubeEmbed(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function getTareaJuegoUrl(tarea) {
  if (tarea.juegoId) {
    if (tarea.recursoId) return `${window.location.origin}/?r=${tarea.recursoId}`;
    const info = JUEGOS_INFO[tarea.juegoId];
    return info ? `${window.location.origin}${info.url}` : null;
  }
  if (tarea.juegoUrl) {
    if (tarea.juegoUrl.startsWith('http')) return tarea.juegoUrl;
    return `${window.location.origin}${tarea.juegoUrl.startsWith('/')?'':'/'}${tarea.juegoUrl}`;
  }
  return null;
}

// ─── Tarjeta de recurso ───────────────────────────────────────────────────────
function RecursoCard({ recurso }) {
  const emoji = TIPO_EMOJI[recurso.tipoJuego] || '🎮';
  const handleOpen = () => window.open(`${window.location.origin}/?r=${recurso.id}`, '_blank');
  return (
    <div onClick={handleOpen} style={{
      background:'white', borderRadius:12, padding:'14px 16px',
      border:'1px solid #E2E8F0', cursor:'pointer', transition:'all 0.2s',
      display:'flex', flexDirection:'column', gap:6, boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.1)';}}
    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';}}>
      <div style={{ fontSize:24 }}>{emoji}</div>
      <div style={{ fontWeight:700, fontSize:14, color:'#0F172A', lineHeight:1.3 }}>{recurso.titulo}</div>
      {recurso.descripcion && <div style={{ fontSize:12, color:'#64748B', lineHeight:1.4 }}>{recurso.descripcion.slice(0,80)}{recurso.descripcion.length>80?'…':''}</div>}
      <div style={{ fontSize:11, color:'#94A3B8', fontWeight:500, marginTop:'auto' }}>{recurso.tipoJuego}</div>
    </div>
  );
}

// ─── Tarjeta de juego completo ────────────────────────────────────────────────
function JuegoCard({ juegoId, color }) {
  const info = JUEGOS_INFO[juegoId];
  if (!info) return null;
  return (
    <div onClick={()=>window.open(`${window.location.origin}${info.url}`,'_blank')} style={{
      background:'white', borderRadius:12, padding:'14px 16px',
      border:'1px solid #E2E8F0', cursor:'pointer', transition:'all 0.2s',
      display:'flex', flexDirection:'column', gap:6, boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.1)';}}
    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';}}>
      <div style={{ fontSize:24 }}>{info.emoji}</div>
      <div style={{ fontWeight:700, fontSize:14, color:'#0F172A', lineHeight:1.3 }}>{info.nombre}</div>
      <div style={{ fontSize:11, color:color||'#6D28D9', fontWeight:600, marginTop:'auto', display:'flex', alignItems:'center', gap:4 }}>
        <Gamepad2 size={11}/> Juego completo
      </div>
    </div>
  );
}

// ─── Convierte cualquier URL de presentación en URL embebible ────────────────
function getPresentacionEmbed(url) {
  if (!url) return null;
  // Google Slides: /pub?… → ya es embebible; /edit o /present → convertir
  const gsMatch = url.match(/docs\.google\.com\/presentation\/d\/([^/]+)/);
  if (gsMatch) {
    // Si ya es /pub devolvemos tal cual (puede tener ?start=false&loop=false&delayms=…)
    if (url.includes('/pub')) return url.includes('output=embed') ? url : url + (url.includes('?') ? '&' : '?') + 'output=embed';
    return `https://docs.google.com/presentation/d/${gsMatch[1]}/embed?start=false&loop=false&delayms=3000`;
  }
  // PPTX directo o OneDrive → Office Online viewer
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

// ─── Tarjeta de tarea ─────────────────────────────────────────────────────────
function TareaCard({ tarea, color }) {
  const hoy = new Date();
  const fecha = tarea.fechaEntrega ? new Date(tarea.fechaEntrega) : null;
  const vencida = fecha && fecha < hoy;
  const proxima = fecha && !vencida && (fecha - hoy) < 7*24*60*60*1000;
  const ytEmbed  = getYouTubeEmbed(tarea.videoUrl);
  const juegoUrl = getTareaJuegoUrl(tarea);
  const juegoInfo = tarea.juegoId ? JUEGOS_INFO[tarea.juegoId] : null;
  const pptxEmbed = getPresentacionEmbed(tarea.pptxUrl);
  const [juegoAbierto, setJuegoAbierto] = useState(false);
  const [juegoListo,   setJuegoListo]   = useState(false);
  const [pptxAbierto, setPptxAbierto]   = useState(false);

  const abrirJuego = () => { setJuegoAbierto(true); setJuegoListo(false); };
  const cerrarJuego = () => { setJuegoAbierto(false); setJuegoListo(false); if (document.fullscreenElement) document.exitFullscreen(); };
  const entrarFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    setJuegoListo(true);
  };

  return (
    <div style={{
      background:'white', borderRadius:12, padding:'14px 16px',
      border:`1.5px solid ${vencida?'#FCA5A5':proxima?'#FCD34D':'#E2E8F0'}`,
      display:'flex', flexDirection:'column', gap:8, boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontWeight:700, fontSize:15, color:'#0F172A' }}>{tarea.titulo||'Tarea sin título'}</div>
      {tarea.descripcion && <div style={{ fontSize:13, color:'#475569', lineHeight:1.5 }}>{tarea.descripcion}</div>}

      {fecha && (
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:vencida?'#DC2626':proxima?'#D97706':'#64748B' }}>
          <Calendar size={12}/>
          Entrega: {fecha.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
          {vencida&&' · Vencida'}{proxima&&' · Esta semana'}
        </div>
      )}

      {tarea.imagenUrl && (
        <img src={tarea.imagenUrl} alt="Imagen" style={{ width:'100%', borderRadius:8, maxHeight:220, objectFit:'cover', border:'1px solid #E2E8F0' }}
          onError={e=>{e.currentTarget.style.display='none';}}/>
      )}

      {ytEmbed && (
        <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #E2E8F0' }}>
          <iframe src={ytEmbed} title="Video" width="100%" height="200" frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ display:'block' }}/>
        </div>
      )}
      {tarea.videoUrl && !ytEmbed && (
        <video src={tarea.videoUrl} controls style={{ width:'100%', borderRadius:8, maxHeight:220, border:'1px solid #E2E8F0' }}/>
      )}

      {tarea.enlaceUrl && (
        <a href={tarea.enlaceUrl} target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, background:color||'#6D28D9', color:'white', fontWeight:600, fontSize:13, textDecoration:'none', width:'fit-content' }}>
          <ExternalLink size={13}/> {tarea.enlaceTitulo||'Abrir enlace'}
        </a>
      )}

      {pptxEmbed && (
        <button onClick={()=>setPptxAbierto(true)}
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:`2px solid ${color||'#6D28D9'}`, background:'white', color:color||'#6D28D9', fontWeight:700, fontSize:13, cursor:'pointer', width:'fit-content', fontFamily:'inherit' }}>
          📊 Ver presentación
        </button>
      )}

      {tarea.presentacionId && (
        <button onClick={()=>window.open(`/pikt-viewer.html?id=${tarea.presentacionId}`,'_blank')}
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:`2px solid ${color||'#6D28D9'}`, background:'white', color:color||'#6D28D9', fontWeight:700, fontSize:13, cursor:'pointer', width:'fit-content', fontFamily:'inherit' }}>
          🎞️ Ver presentación PiKT
        </button>
      )}
      {pptxEmbed && pptxAbierto && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#1e1e1e', display:'flex', flexDirection:'column' }}>
          <div style={{ background:color||'#6D28D9', padding:'6px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:13, fontWeight:700 }}>📊 Presentación</span>
            <button onClick={()=>setPptxAbierto(false)}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, color:'white', cursor:'pointer', fontSize:13, fontWeight:700, padding:'4px 14px', fontFamily:'inherit' }}>
              ✕ Cerrar
            </button>
          </div>
          <iframe src={pptxEmbed} title="Presentación"
            style={{ flex:1, width:'100%', border:'none', display:'block' }}
            allow="fullscreen" allowFullScreen/>
        </div>
      )}

      {juegoUrl && !juegoAbierto && (
        <button onClick={abrirJuego} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:9, border:`2px solid ${color||'#6D28D9'}`, background:'white', color:color||'#6D28D9', fontWeight:700, fontSize:13, cursor:'pointer', width:'fit-content', fontFamily:'inherit' }}>
          {juegoInfo ? <span>{juegoInfo.emoji}</span> : <Gamepad2 size={14}/>}
          {juegoInfo ? `Jugar — ${juegoInfo.nombre}` : '¡Jugar ahora!'}
        </button>
      )}
      {juegoUrl && juegoAbierto && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#000', display:'flex', flexDirection:'column' }}>
          {/* Barra superior */}
          <div style={{ background:color||'#6D28D9', padding:'6px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:13, fontWeight:700 }}>{juegoInfo?`${juegoInfo.emoji} ${juegoInfo.nombre}`:'🎮 Juego'}</span>
            <button onClick={cerrarJuego} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, color:'white', cursor:'pointer', fontSize:13, fontWeight:700, padding:'4px 14px', fontFamily:'inherit' }}>✕ Cerrar</button>
          </div>
          {/* Splash "toca para jugar" */}
          {!juegoListo && (
            <div onClick={entrarFullscreen} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, cursor:'pointer', userSelect:'none' }}>
              <div style={{ fontSize:64 }}>{juegoInfo?.emoji||'🎮'}</div>
              <div style={{ fontSize:22, fontWeight:800, color:'white' }}>{juegoInfo?.nombre||'Juego'}</div>
              <div style={{ fontSize:15, color:'rgba(255,255,255,0.7)', textAlign:'center', maxWidth:280 }}>Toca la pantalla para jugar<br/>a pantalla completa</div>
              <div style={{ marginTop:8, padding:'12px 32px', borderRadius:50, background:color||'#6D28D9', color:'white', fontWeight:700, fontSize:15 }}>▶ Jugar</div>
            </div>
          )}
          {/* Iframe del juego */}
          {juegoListo && (
            <iframe src={juegoUrl} title="Juego" style={{ flex:1, width:'100%', border:'none', display:'block' }} allow="autoplay; fullscreen; pointer-lock *"/>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sección de un tema ───────────────────────────────────────────────────────
function TemaSection({ tema, cursoColor }) {
  const [abierto, setAbierto] = useState(false);
  const color = tema.color || cursoColor || '#6D28D9';
  if (!tema.tareas?.length && !tema.descripcion && !tema.presentacionId) return null;

  return (
    <div style={{ marginBottom:12, borderRadius:12, border:`1.5px solid ${abierto ? color : '#E2E8F0'}`, overflow:'hidden', transition:'border-color 0.2s' }}>
      <div onClick={()=>setAbierto(!abierto)}
        style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'12px 16px',
          background: abierto ? `${color}0d` : 'white' }}>
        <div style={{ width:4, height:20, borderRadius:2, background:color, flexShrink:0 }}/>
        <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0F172A', flex:1 }}>{tema.titulo||'Tema'}</h3>
        {!abierto && tema.tareas?.length > 0 && (
          <span style={{ fontSize:11, color:'#94A3B8', fontWeight:600 }}>{tema.tareas.length} tarea{tema.tareas.length!==1?'s':''}</span>
        )}
        <span style={{ color, transition:'transform 0.2s', display:'inline-flex' }}>
          {abierto ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </span>
      </div>
      {abierto && (
        <div style={{ padding:'0 16px 16px' }}>
          {tema.descripcion && (
            <div style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px', marginBottom:12, marginTop:8, fontSize:13, color:'#475569', lineHeight:1.6, borderLeft:`3px solid ${color}`, whiteSpace:'pre-wrap' }}>
              {tema.descripcion}
            </div>
          )}
          {tema.presentacionId && (
            <button onClick={()=>window.open(`/pikt-viewer.html?id=${tema.presentacionId}`,'_blank')}
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9, border:`2px solid ${color}`, background:'white', color, fontWeight:700, fontSize:13, cursor:'pointer', width:'fit-content', fontFamily:'inherit', marginBottom:12 }}>
              🎞️ Presentación del tema
            </button>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(tema.tareas||[]).map(t=><TareaCard key={t.id} tarea={t} color={color}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PaginaProfesor({ uid, slug, onBack }) {
  const [pagina,   setPagina]   = useState(null);
  const [recursos, setRecursos] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [tabActivo,setTabActivo]= useState(null);

  useEffect(() => {
    if (!uid && !slug) return;
    (async () => {
      let snap;
      if (uid) {
        snap = await getDoc(doc(db,'paginas_profesores',uid));
        if (!snap.exists()||!snap.data().publicada) { setLoading(false); return; }
      } else {
        const q = query(collection(db,'paginas_profesores'), where('slug','==',slug), where('publicada','==',true));
        const res = await getDocs(q);
        if (res.empty) { setLoading(false); return; }
        snap = res.docs[0];
      }
      const data = snap.data();
      setPagina(data);
      setTabActivo(data.cursos?.[0]?.id||null);

      const allIds = [...new Set((data.cursos||[]).flatMap(c=>c.recursos||[]))].filter(id=>typeof id==='string'&&id.length>0);
      if (allIds.length>0) {
        const chunks = [];
        for (let i=0;i<allIds.length;i+=10) chunks.push(allIds.slice(i,i+10));
        const found = {};
        await Promise.all(chunks.map(async chunk=>{
          const q = query(collection(db,'resources'), where('__name__','in',chunk));
          const s = await getDocs(q);
          s.docs.forEach(d=>{ found[d.id]={...d.data(),id:d.id}; });
        }));
        setRecursos(found);
      }
      setLoading(false);
    })();
  }, [uid]);

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFC' }}>
      <div style={{ fontSize:16, color:'#94A3B8' }}>Cargando página…</div>
    </div>
  );

  if (!pagina) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#F8FAFC', gap:16 }}>
      <div style={{ fontSize:48 }}>🔒</div>
      <h2 style={{ color:'#374151', margin:0 }}>Página no disponible</h2>
      <p style={{ color:'#94A3B8', margin:0 }}>Esta página no existe o no está publicada.</p>
      {onBack && <button onClick={onBack} style={{ marginTop:8, padding:'8px 20px', borderRadius:10, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color:'#374151' }}>← Volver</button>}
    </div>
  );

  const cursoActivo      = (pagina.cursos||[]).find(c=>c.id===tabActivo);
  const recursosDelCurso = (cursoActivo?.recursos||[]).map(id=>recursos[id]).filter(Boolean);
  const juegosDelCurso   = cursoActivo?.juegos||[];
  const temasDelCurso    = cursoActivo?.temas||[];
  // Backward compat: cursos viejos con tareas planas
  const tareasLegacy     = cursoActivo?.tareas||[];
  const totalTareas      = temasDelCurso.filter(t=>!t.oculto).reduce((acc,t)=>acc+(t.tareas?.length||0),0) + tareasLegacy.length;

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'inherit' }}>
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#4338CA,#6D28D9)', padding:'40px 20px 32px', color:'white' }}>
        {onBack && (
          <div style={{ maxWidth:960, margin:'0 auto', marginBottom:20 }}>
            <button onClick={onBack} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, padding:'6px 14px', color:'white', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:5 }}>
              <ArrowLeft size={14}/> Volver
            </button>
          </div>
        )}
        <div style={{ maxWidth:960, margin:'0 auto', display:'flex', gap:20, alignItems:'center' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, flexShrink:0 }}>👨‍🏫</div>
          <div>
            <h1 style={{ margin:'0 0 4px', fontSize:26, fontWeight:800 }}>{pagina.nombre||'Profesor'}</h1>
            {pagina.asignatura && <div style={{ opacity:0.8, fontSize:14, marginBottom:6 }}>{pagina.asignatura}</div>}
            {pagina.descripcion && <p style={{ margin:0, opacity:0.85, fontSize:14, lineHeight:1.6, maxWidth:600 }}>{pagina.descripcion}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {(pagina.cursos||[]).length>0 && (
        <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'0 20px' }}>
          <div style={{ maxWidth:960, margin:'0 auto', display:'flex', gap:2, overflowX:'auto' }}>
            {(pagina.cursos||[]).map(c=>(
              <button key={c.id} onClick={()=>setTabActivo(c.id)} style={{ padding:'14px 20px', border:'none', background:'none', cursor:'pointer', fontWeight:700, fontSize:14, fontFamily:'inherit',
                color:tabActivo===c.id?c.color:'#94A3B8', borderBottom:tabActivo===c.id?`3px solid ${c.color}`:'3px solid transparent', whiteSpace:'nowrap', transition:'all 0.15s' }}>{c.nombre}</button>
            ))}
          </div>
        </div>
      )}

      {/* Contenido */}
      <div style={{ maxWidth:720, margin:'0 auto', padding:'28px 16px' }}>
        {!cursoActivo && <p style={{ textAlign:'center', color:'#94A3B8', fontSize:15 }}>Esta página no tiene cursos todavía.</p>}

        {cursoActivo && (
          <div style={{ display:'flex', flexDirection:'column', gap:28 }}>

            {/* 1. Bienvenida + enlaces */}
            {(cursoActivo.bienvenida || (cursoActivo.enlaces||[]).length > 0) && (
              <div style={{ background:'white', borderRadius:14, padding:'18px 20px', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', borderLeft:`4px solid ${cursoActivo.color||'#6D28D9'}` }}>
                {cursoActivo.bienvenida && (
                  <p style={{ margin:0, fontSize:15, color:'#334155', lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:(cursoActivo.enlaces||[]).length>0?14:0 }}>{cursoActivo.bienvenida}</p>
                )}
                {(cursoActivo.enlaces||[]).length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(cursoActivo.enlaces||[]).filter(en=>en.url).map(en=>(
                      <a key={en.id} href={en.url} target="_blank" rel="noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9,
                          background:cursoActivo.color||'#6D28D9', color:'white', fontWeight:600, fontSize:13,
                          textDecoration:'none', boxShadow:`0 2px 8px ${cursoActivo.color||'#6D28D9'}40` }}>
                        <ExternalLink size={13}/> {en.titulo||en.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Recursos */}
            {recursosDelCurso.length>0 && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <BookOpen size={18} color={cursoActivo.color}/>
                  <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#0F172A' }}>Recursos</h2>
                  <span style={{ fontSize:12, color:'#94A3B8' }}>{recursosDelCurso.length} actividades</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                  {recursosDelCurso.map(r=><RecursoCard key={r.id} recurso={r}/>)}
                </div>
              </div>
            )}

            {/* 3. Juegos */}
            {juegosDelCurso.length>0 && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <Gamepad2 size={18} color={cursoActivo.color}/>
                  <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#0F172A' }}>Juegos</h2>
                  <span style={{ fontSize:12, color:'#94A3B8' }}>{juegosDelCurso.length} juegos</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                  {juegosDelCurso.map(id=><JuegoCard key={id} juegoId={id} color={cursoActivo.color}/>)}
                </div>
              </div>
            )}

            {/* 4. Temas con tareas */}
            {(temasDelCurso.length>0 || tareasLegacy.length>0) && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                  <ClipboardList size={18} color={cursoActivo.color}/>
                  <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#0F172A' }}>Tareas</h2>
                  <span style={{ fontSize:12, color:'#94A3B8' }}>{totalTareas}</span>
                </div>

                {temasDelCurso.filter(t=>!t.oculto).map(tema=>(
                  <TemaSection key={tema.id} tema={tema} cursoColor={cursoActivo.color}/>
                ))}

                {tareasLegacy.length>0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {tareasLegacy.map(t=><TareaCard key={t.id} tarea={t} color={cursoActivo.color}/>)}
                  </div>
                )}
              </div>
            )}

            {recursosDelCurso.length===0 && juegosDelCurso.length===0 && totalTareas===0 && (
              <p style={{ color:'#94A3B8', fontSize:14, textAlign:'center' }}>No hay contenido en este curso todavía.</p>
            )}

          </div>
        )}
      </div>

      <div style={{ textAlign:'center', padding:'20px', fontSize:12, color:'#CBD5E1' }}>
        Creado con <a href="https://pikt.es" style={{ color:'#6D28D9', fontWeight:600 }}>PiKT</a>
      </div>
    </div>
  );
}
