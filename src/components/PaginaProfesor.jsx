// PaginaProfesor.jsx — Página pública del profesor
// Accesible via ?p=uid
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { BookOpen, ClipboardList, Calendar, Globe, ArrowLeft } from 'lucide-react';

const TIPO_EMOJI = {
  PASAPALABRA:'🔤', CAZABURBUJAS:'🫧', APAREJADOS:'🃏', THINKHOOT:'⚡',
  OMNINTERACTIVE:'📚', VIDEOQUIZZ:'🎬', WORDLE:'🟩', SOPA:'🔍',
  RULETA:'🎡', SINTAXIS:'✏️', ETIQUETAS:'🏷️', MATHLIVE:'📐',
};

function RecursoCard({ recurso }) {
  const emoji = TIPO_EMOJI[recurso.tipoJuego] || '🎮';
  const handleOpen = () => {
    const url = `${window.location.origin}${window.location.pathname}?r=${recurso.id}`;
    window.open(url, '_blank');
  };
  return (
    <div onClick={handleOpen} style={{
      background:'white', borderRadius:12, padding:'14px 16px',
      border:'1px solid #E2E8F0', cursor:'pointer', transition:'all 0.2s',
      display:'flex', flexDirection:'column', gap:6,
      boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
    }}
    onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.1)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ fontSize:24 }}>{emoji}</div>
      <div style={{ fontWeight:700, fontSize:14, color:'#0F172A', lineHeight:1.3 }}>{recurso.titulo}</div>
      {recurso.descripcion && <div style={{ fontSize:12, color:'#64748B', lineHeight:1.4 }}>{recurso.descripcion.slice(0,80)}{recurso.descripcion.length>80?'…':''}</div>}
      <div style={{ fontSize:11, color:'#94A3B8', fontWeight:500, marginTop:'auto' }}>{recurso.tipoJuego}</div>
    </div>
  );
}

function TareaCard({ tarea }) {
  const hoy = new Date();
  const fecha = tarea.fechaEntrega ? new Date(tarea.fechaEntrega) : null;
  const vencida = fecha && fecha < hoy;
  const proxima = fecha && !vencida && (fecha - hoy) < 7*24*60*60*1000;
  return (
    <div style={{
      background:'white', borderRadius:10, padding:'12px 16px',
      border:`1.5px solid ${vencida?'#FCA5A5':proxima?'#FCD34D':'#E2E8F0'}`,
      display:'flex', flexDirection:'column', gap:4,
    }}>
      <div style={{ fontWeight:700, fontSize:14, color:'#0F172A' }}>{tarea.titulo || 'Tarea sin título'}</div>
      {tarea.descripcion && <div style={{ fontSize:13, color:'#475569', lineHeight:1.5 }}>{tarea.descripcion}</div>}
      {fecha && (
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, marginTop:4, color: vencida?'#DC2626':proxima?'#D97706':'#64748B' }}>
          <Calendar size={12}/>
          Entrega: {fecha.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
          {vencida && ' · Vencida'}{proxima && ' · Esta semana'}
        </div>
      )}
    </div>
  );
}

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
        if (!snap.exists() || !snap.data().publicada) { setLoading(false); return; }
      } else {
        const q = query(collection(db,'paginas_profesores'), where('slug','==',slug), where('publicada','==',true));
        const res = await getDocs(q);
        if (res.empty) { setLoading(false); return; }
        snap = res.docs[0];
      }
      const data = snap.data();
      setPagina(data);
      setTabActivo(data.cursos?.[0]?.id || null);

      // Load all resources referenced in any course
      const allIds = [...new Set((data.cursos||[]).flatMap(c=>c.recursos||[]))];
      if (allIds.length > 0) {
        const chunks = [];
        for (let i=0; i<allIds.length; i+=10) chunks.push(allIds.slice(i,i+10));
        const found = {};
        await Promise.all(chunks.map(async chunk => {
          const q = query(collection(db,'resources'), where('__name__','in',chunk));
          const s = await getDocs(q);
          s.docs.forEach(d => { found[d.id] = { id:d.id, ...d.data() }; });
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

  const cursoActivo = (pagina.cursos||[]).find(c=>c.id===tabActivo);
  const recursosDelCurso = (cursoActivo?.recursos||[]).map(id=>recursos[id]).filter(Boolean);
  const tareasDelCurso = cursoActivo?.tareas || [];

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'inherit' }}>
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#4338CA,#6D28D9)', padding:'40px 20px 32px', color:'white' }}>
        {onBack && (
          <div style={{ maxWidth:860, margin:'0 auto', marginBottom:20 }}>
            <button onClick={onBack} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, padding:'6px 14px', color:'white', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:5 }}>
              <ArrowLeft size={14}/> Volver
            </button>
          </div>
        )}
        <div style={{ maxWidth:860, margin:'0 auto', display:'flex', gap:20, alignItems:'center' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, flexShrink:0 }}>
            👨‍🏫
          </div>
          <div>
            <h1 style={{ margin:'0 0 4px', fontSize:26, fontWeight:800 }}>{pagina.nombre || 'Profesor'}</h1>
            {pagina.asignatura && <div style={{ opacity:0.8, fontSize:14, marginBottom:6 }}>{pagina.asignatura}</div>}
            {pagina.descripcion && <p style={{ margin:0, opacity:0.85, fontSize:14, lineHeight:1.6, maxWidth:600 }}>{pagina.descripcion}</p>}
          </div>
        </div>
      </div>

      {/* Tabs de cursos */}
      {(pagina.cursos||[]).length > 0 && (
        <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'0 20px' }}>
          <div style={{ maxWidth:860, margin:'0 auto', display:'flex', gap:2, overflowX:'auto' }}>
            {(pagina.cursos||[]).map(c => (
              <button key={c.id} onClick={()=>setTabActivo(c.id)} style={{
                padding:'14px 20px', border:'none', background:'none', cursor:'pointer',
                fontWeight:700, fontSize:14, fontFamily:'inherit',
                color: tabActivo===c.id ? c.color : '#94A3B8',
                borderBottom: tabActivo===c.id ? `3px solid ${c.color}` : '3px solid transparent',
                whiteSpace:'nowrap', transition:'all 0.15s',
              }}>{c.nombre}</button>
            ))}
          </div>
        </div>
      )}

      {/* Contenido del curso */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 20px' }}>
        {!cursoActivo && (
          <p style={{ textAlign:'center', color:'#94A3B8', fontSize:15 }}>Esta página no tiene cursos todavía.</p>
        )}

        {cursoActivo && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:28, alignItems:'start' }}>

            {/* Recursos */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <BookOpen size={18} color={cursoActivo.color}/>
                <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#0F172A' }}>Recursos</h2>
                <span style={{ fontSize:12, color:'#94A3B8', fontWeight:500 }}>{recursosDelCurso.length} actividades</span>
              </div>
              {recursosDelCurso.length === 0 ? (
                <p style={{ color:'#94A3B8', fontSize:14 }}>No hay recursos en este curso.</p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                  {recursosDelCurso.map(r => <RecursoCard key={r.id} recurso={r} />)}
                </div>
              )}
            </div>

            {/* Tareas */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <ClipboardList size={18} color={cursoActivo.color}/>
                <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#0F172A' }}>Tareas</h2>
                <span style={{ fontSize:12, color:'#94A3B8', fontWeight:500 }}>{tareasDelCurso.length}</span>
              </div>
              {tareasDelCurso.length === 0 ? (
                <p style={{ color:'#94A3B8', fontSize:14 }}>Sin tareas asignadas.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {tareasDelCurso.map(t => <TareaCard key={t.id} tarea={t} />)}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      <div style={{ textAlign:'center', padding:'20px', fontSize:12, color:'#CBD5E1' }}>
        Creado con <a href="https://pikt.es" style={{ color:'#6D28D9', fontWeight:600 }}>PiKT</a>
      </div>
    </div>
  );
}
