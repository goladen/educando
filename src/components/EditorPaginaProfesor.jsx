// EditorPaginaProfesor.jsx — Editor de la página pública del profesor
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Globe, Plus, Trash2, Eye, Save, BookOpen, ClipboardList, Link, MapPin } from 'lucide-react';

const COLORES_CURSO = ['#6D28D9','#1D4ED8','#047857','#DC2626','#D97706','#0F766E','#BE185D','#374151'];

function newCurso() {
  return { id: 'c_'+Math.random().toString(36).slice(2,8), nombre: 'Nuevo curso', color: '#6D28D9', recursos: [], tareas: [] };
}
function newTarea() {
  return { id: 't_'+Math.random().toString(36).slice(2,8), titulo: '', descripcion: '', fechaEntrega: '' };
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
}

export default function EditorPaginaProfesor({ usuario, onPreview }) {
  const [pagina, setPagina] = useState({
    nombre: usuario?.displayName || '',
    descripcion: '',
    asignatura: '',
    localidad: '',
    slug: '',
    publicada: false,
    cursos: [],
  });
  const [misRecursos, setMisRecursos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState(null);
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'ok' | 'taken' | 'empty'

  const pageUrl = pagina.slug
    ? `${window.location.origin}/${pagina.slug}`
    : `${window.location.origin}/?p=${usuario?.uid}`;

  useEffect(() => {
    if (!usuario?.uid) return;
    getDoc(doc(db,'paginas_profesores',usuario.uid)).then(snap => {
      if (snap.exists()) {
        setPagina(p => ({ ...p, ...snap.data() }));
        if (snap.data().slug) setSlugStatus('ok');
      }
    });
    const q = query(collection(db,'resources'), where('profesorUid','==',usuario.uid), where('isFinished','==',true));
    getDocs(q).then(snap => setMisRecursos(snap.docs.map(d => ({ ...d.data(), id:d.id }))));
  }, [usuario?.uid]);

  const SLUGS_RESERVADOS = new Set([
    'populares','inicio','pasapalabra','cazaburbujas','burbujas','pikatron','pikatron_2',
    'kartinged','karting','kartinged_multi','aparejados','ruleta','wordle','mathle',
    'thinkhoot','pilive','mathlive','olympiclive','sopa','sopa_letras','question_sender',
    'omninteractive','videoquizz','sintaxis','etiquetas','api','admin','login','app',
  ]);

  const checkSlug = async (val) => {
    const s = slugify(val);
    setField('slug', s);
    if (!s) { setSlugStatus('empty'); return; }
    if (SLUGS_RESERVADOS.has(s)) { setSlugStatus('taken'); return; }
    setSlugStatus('checking');
    try {
      const snap = await getDocs(query(collection(db,'paginas_profesores'), where('slug','==',s)));
      const taken = snap.docs.some(d => d.id !== usuario?.uid);
      setSlugStatus(taken ? 'taken' : 'ok');
    } catch { setSlugStatus('ok'); } // si falla el check, no bloquear al usuario
  };

  const setField = (k, v) => setPagina(p => ({ ...p, [k]: v }));

  const addCurso = () => {
    const c = newCurso();
    setPagina(p => ({ ...p, cursos: [...p.cursos, c] }));
    setTab(c.id);
  };
  const updateCurso = (id, field, val) => setPagina(p => ({ ...p, cursos: p.cursos.map(c => c.id===id ? {...c,[field]:val} : c) }));
  const deleteCurso = (id) => { setPagina(p => ({ ...p, cursos: p.cursos.filter(c=>c.id!==id) })); if (tab===id) setTab(null); };
  const moveCurso = (id, dir) => setPagina(p => {
    const arr = [...p.cursos]; const i = arr.findIndex(c=>c.id===id); const j = i+dir;
    if (j<0||j>=arr.length) return p;
    [arr[i],arr[j]]=[arr[j],arr[i]];
    return {...p, cursos:arr};
  });

  const toggleRecurso = (cursoId, recursoId) => setPagina(p => ({
    ...p, cursos: p.cursos.map(c => {
      if (c.id !== cursoId) return c;
      const tiene = c.recursos.includes(recursoId);
      return { ...c, recursos: tiene ? c.recursos.filter(r=>r!==recursoId) : [...c.recursos, recursoId] };
    })
  }));

  const addTarea = (cursoId) => setPagina(p => ({
    ...p, cursos: p.cursos.map(c => c.id===cursoId ? {...c, tareas:[...c.tareas, newTarea()]} : c)
  }));
  const updateTarea = (cursoId, tareaId, field, val) => setPagina(p => ({
    ...p, cursos: p.cursos.map(c => c.id===cursoId ? {...c, tareas:c.tareas.map(t=>t.id===tareaId?{...t,[field]:val}:t)} : c)
  }));
  const deleteTarea = (cursoId, tareaId) => setPagina(p => ({
    ...p, cursos: p.cursos.map(c => c.id===cursoId ? {...c, tareas:c.tareas.filter(t=>t.id!==tareaId)} : c)
  }));

  const save = async (publicar) => {
    if (!pagina.slug) { alert('Elige una dirección (URL) para tu página antes de guardar.'); return; }
    if (slugStatus === 'taken') { alert('Esa dirección ya está en uso. Elige otra.'); return; }
    if (slugStatus === 'checking') { alert('Espera, estamos verificando la disponibilidad de la dirección.'); return; }
    setSaving(true);
    try {
      const data = { ...pagina, publicada: publicar ?? pagina.publicada, profesorUid: usuario.uid, updatedAt: new Date() };
      await setDoc(doc(db,'paginas_profesores',usuario.uid), data);
      setPagina(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) { alert('Error: '+e.message); }
    setSaving(false);
  };

  const cursoActivo = pagina.cursos.find(c=>c.id===tab);

  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px 60px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ background:'#EDE9FE', borderRadius:'50%', padding:10 }}>
            <Globe size={24} color="#6D28D9" />
          </div>
          <div>
            <h2 style={{ margin:0, color:'#1E1B4B', fontSize:20 }}>Mi Página de Profesor</h2>
            <p style={{ margin:0, fontSize:12, color:'#94A3B8' }}>Crea tu espacio para tus alumnos</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => onPreview?.(usuario.uid)} style={btnOutline}>
            <Eye size={15} /> Vista previa
          </button>
          <button onClick={() => { navigator.clipboard.writeText(pageUrl); alert('¡Enlace copiado!'); }} style={btnOutline}>
            <Link size={15} /> Copiar enlace
          </button>
          <button onClick={() => save()} disabled={saving} style={{ ...btnPrimary, background:'#4F46E5' }}>
            <Save size={15} /> {saving ? 'Guardando…' : saved ? '¡Guardado!' : 'Guardar'}
          </button>
          <button onClick={() => save(!pagina.publicada)} disabled={saving} style={{ ...btnPrimary, background: pagina.publicada ? '#DC2626' : '#059669' }}>
            {pagina.publicada ? '🔒 Despublicar' : '🌐 Publicar'}
          </button>
        </div>
      </div>

      {pagina.publicada && (
        <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#166534', display:'flex', gap:8, alignItems:'center' }}>
          <Globe size={14}/> Tu página está publicada: <a href={pageUrl} target="_blank" rel="noreferrer" style={{ color:'#6D28D9', fontWeight:600 }}>{pageUrl}</a>
        </div>
      )}

      {/* Info general */}
      <section style={card}>
        <h3 style={sectionTitle}>Información general</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={lbl}>Nombre visible</label>
            <input style={inp} value={pagina.nombre} onChange={e=>setField('nombre',e.target.value)} placeholder="Ej: Profe García" />
          </div>
          <div>
            <label style={lbl}>Asignatura / Centro</label>
            <input style={inp} value={pagina.asignatura||''} onChange={e=>setField('asignatura',e.target.value)} placeholder="Ej: Inglés · IES Ejemplo" />
          </div>
          <div>
            <label style={lbl}>Localidad</label>
            <input style={inp} value={pagina.localidad||''} onChange={e=>setField('localidad',e.target.value)} placeholder="Ej: Madrid" />
          </div>
          <div>
            <label style={lbl}>Dirección de tu página (URL)</label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'#94A3B8', flexShrink:0 }}>pikt.es/</span>
              <input style={{ ...inp, flex:1 }} value={pagina.slug||''} onChange={e=>checkSlug(e.target.value)} placeholder="profe-garcia" />
            </div>
            {slugStatus === 'checking' && <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>⏳ Comprobando disponibilidad…</div>}
            {slugStatus === 'ok'       && <div style={{ fontSize:11, color:'#059669', marginTop:3 }}>✓ Disponible — pikt.es/{pagina.slug}</div>}
            {slugStatus === 'taken'    && <div style={{ fontSize:11, color:'#DC2626', marginTop:3 }}>✗ Ya está en uso. Elige otra dirección.</div>}
            {slugStatus === 'empty'    && <div style={{ fontSize:11, color:'#F59E0B', marginTop:3 }}>Elige una dirección para tu página.</div>}
          </div>
        </div>
        <label style={{ ...lbl, marginTop:12 }}>Descripción (visible en tu página)</label>
        <textarea style={{ ...inp, height:80, resize:'vertical' }} value={pagina.descripcion} onChange={e=>setField('descripcion',e.target.value)} placeholder="Preséntate brevemente a tus alumnos…" />
      </section>

      {/* Cursos */}
      <section style={{ ...card, marginTop:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ ...sectionTitle, margin:0 }}>Cursos / Grupos</h3>
          <button onClick={addCurso} style={{ ...btnPrimary, background:'#6D28D9', fontSize:13, padding:'6px 14px' }}>
            <Plus size={14} /> Añadir curso
          </button>
        </div>

        {pagina.cursos.length === 0 && (
          <p style={{ color:'#94A3B8', textAlign:'center', padding:'24px 0', fontSize:14 }}>Añade cursos para organizar tus recursos y tareas por grupo.</p>
        )}

        {/* Tabs de cursos */}
        {pagina.cursos.length > 0 && (
          <>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {pagina.cursos.map(c => (
                <button key={c.id} onClick={()=>setTab(c.id)} style={{
                  padding:'6px 16px', borderRadius:20, border:`2px solid ${c.color}`,
                  background: tab===c.id ? c.color : 'white',
                  color: tab===c.id ? 'white' : c.color,
                  fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s',
                }}>{c.nombre}</button>
              ))}
            </div>

            {cursoActivo && (
              <div style={{ border:`2px solid ${cursoActivo.color}20`, borderRadius:12, padding:16 }}>
                {/* Curso header */}
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
                  <input style={{ ...inp, flex:1, minWidth:140, fontWeight:700, fontSize:15 }}
                    value={cursoActivo.nombre} onChange={e=>updateCurso(cursoActivo.id,'nombre',e.target.value)} placeholder="Nombre del curso" />
                  <div style={{ display:'flex', gap:4 }}>
                    {COLORES_CURSO.map(col => (
                      <div key={col} onClick={()=>updateCurso(cursoActivo.id,'color',col)}
                        style={{ width:20, height:20, borderRadius:'50%', background:col, cursor:'pointer',
                          border: cursoActivo.color===col ? '3px solid #0F172A' : '2px solid transparent' }} />
                    ))}
                  </div>
                  <button onClick={()=>moveCurso(cursoActivo.id,-1)} style={btnIcon} title="Mover izquierda">←</button>
                  <button onClick={()=>moveCurso(cursoActivo.id,1)} style={btnIcon} title="Mover derecha">→</button>
                  <button onClick={()=>deleteCurso(cursoActivo.id)} style={{ ...btnIcon, color:'#DC2626', borderColor:'#FCA5A5' }}>
                    <Trash2 size={14}/>
                  </button>
                </div>

                {/* Dos columnas: recursos + tareas */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                  {/* Recursos */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                      <BookOpen size={15} color={cursoActivo.color}/>
                      <span style={{ fontWeight:700, fontSize:13, color:cursoActivo.color }}>Recursos ({cursoActivo.recursos.length})</span>
                    </div>
                    <div style={{ maxHeight:260, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                      {misRecursos.length === 0 && <p style={{ fontSize:12, color:'#94A3B8' }}>No tienes recursos publicados aún.</p>}
                      {misRecursos.map(r => {
                        const sel = cursoActivo.recursos.includes(r.id);
                        return (
                          <div key={r.id} onClick={()=>toggleRecurso(cursoActivo.id,r.id)} style={{
                            display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8,
                            border:`1.5px solid ${sel ? cursoActivo.color : '#E2E8F0'}`,
                            background: sel ? `${cursoActivo.color}12` : 'white',
                            cursor:'pointer', fontSize:13, transition:'all 0.15s',
                          }}>
                            <span style={{ width:18, height:18, borderRadius:4, border:`2px solid ${sel?cursoActivo.color:'#CBD5E1'}`, background:sel?cursoActivo.color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {sel && <span style={{ color:'white', fontSize:11, fontWeight:900 }}>✓</span>}
                            </span>
                            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.titulo}</span>
                            <span style={{ fontSize:10, color:'#94A3B8', flexShrink:0 }}>{r.tipoJuego}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tareas */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <ClipboardList size={15} color={cursoActivo.color}/>
                        <span style={{ fontWeight:700, fontSize:13, color:cursoActivo.color }}>Tareas ({cursoActivo.tareas.length})</span>
                      </div>
                      <button onClick={()=>addTarea(cursoActivo.id)} style={{ fontSize:11, padding:'3px 10px', borderRadius:8, border:`1px solid ${cursoActivo.color}`, background:'white', color:cursoActivo.color, cursor:'pointer', fontWeight:600 }}>
                        + Añadir
                      </button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:260, overflowY:'auto' }}>
                      {cursoActivo.tareas.length === 0 && <p style={{ fontSize:12, color:'#94A3B8' }}>Sin tareas todavía.</p>}
                      {cursoActivo.tareas.map(t => (
                        <div key={t.id} style={{ border:'1px solid #E2E8F0', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ display:'flex', gap:6, marginBottom:5 }}>
                            <input style={{ ...inp, flex:1, padding:'4px 8px', fontWeight:600, fontSize:12 }}
                              value={t.titulo} onChange={e=>updateTarea(cursoActivo.id,t.id,'titulo',e.target.value)} placeholder="Título de la tarea" />
                            <button onClick={()=>deleteTarea(cursoActivo.id,t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#DC2626', padding:'0 4px' }}>
                              <Trash2 size={13}/>
                            </button>
                          </div>
                          <textarea style={{ ...inp, height:44, resize:'none', fontSize:11, padding:'4px 8px' }}
                            value={t.descripcion} onChange={e=>updateTarea(cursoActivo.id,t.id,'descripcion',e.target.value)} placeholder="Descripción…" />
                          <input type="date" style={{ ...inp, fontSize:11, padding:'3px 8px', marginTop:4 }}
                            value={t.fechaEntrega} onChange={e=>updateTarea(cursoActivo.id,t.id,'fechaEntrega',e.target.value)} />
                        </div>
                      ))}
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

const card   = { background:'white', borderRadius:14, padding:'20px 24px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'1px solid #F1F5F9' };
const lbl    = { display:'block', fontSize:12, fontWeight:600, color:'#64748B', marginBottom:4 };
const inp    = { width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:8, border:'1px solid #CBD5E1', fontSize:13, fontFamily:'inherit', outline:'none' };
const btnPrimary = { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:10, border:'none', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnOutline = { display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'1px solid #CBD5E1', background:'white', color:'#374151', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnIcon    = { display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, border:'1px solid #E2E8F0', background:'white', cursor:'pointer', color:'#374151', fontSize:13 };
const sectionTitle = { margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#1E1B4B' };
