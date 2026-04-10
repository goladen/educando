// BuscadorPaginas.jsx — Buscador público de páginas de profesores
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, Globe, BookOpen, MapPin, ArrowLeft } from 'lucide-react';

export default function BuscadorPaginas({ onSelect, onBack }) {
  const [paginas, setPaginas]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [q,       setQ]         = useState('');
  const [filtro,  setFiltro]    = useState({ asignatura:'', localidad:'' });

  useEffect(() => {
    getDocs(query(collection(db,'paginas_profesores'), where('publicada','==',true)))
      .then(snap => {
        setPaginas(snap.docs.map(d => ({ ...d.data(), uid: d.id })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const asignaturas = useMemo(() => [...new Set(paginas.map(p=>p.asignatura).filter(Boolean))].sort(), [paginas]);
  const localidades = useMemo(() => [...new Set(paginas.map(p=>p.localidad||p.poblacion||'').filter(Boolean))].sort(), [paginas]);

  const filtradas = useMemo(() => {
    const text = q.toLowerCase();
    return paginas.filter(p => {
      if (filtro.asignatura && !(p.asignatura||'').toLowerCase().includes(filtro.asignatura.toLowerCase())) return false;
      if (filtro.localidad  && !((p.localidad||p.poblacion||'')).toLowerCase().includes(filtro.localidad.toLowerCase())) return false;
      if (!text) return true;
      return (p.nombre||'').toLowerCase().includes(text)
        || (p.asignatura||'').toLowerCase().includes(text)
        || (p.descripcion||'').toLowerCase().includes(text)
        || (p.localidad||p.poblacion||'').toLowerCase().includes(text)
        || (p.slug||'').toLowerCase().includes(text);
    });
  }, [paginas, q, filtro]);

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'inherit' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#4338CA,#6D28D9)', padding:'28px 20px', color:'white' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, padding:'6px 14px', color:'white', cursor:'pointer', fontSize:13, display:'inline-flex', alignItems:'center', gap:6, marginBottom:20 }}>
            <ArrowLeft size={14}/> Volver
          </button>
          <h1 style={{ margin:'0 0 6px', fontSize:24, fontWeight:800 }}>👨‍🏫 Páginas de Profesores</h1>
          <p style={{ margin:'0 0 20px', opacity:0.8, fontSize:14 }}>Encuentra la página de tu profesor y accede a sus recursos y tareas.</p>
          {/* Search bar */}
          <div style={{ position:'relative' }}>
            <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} />
            <input
              value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Busca por nombre, materia, localidad…"
              style={{ width:'100%', boxSizing:'border-box', height:46, paddingLeft:42, paddingRight:16, borderRadius:12, border:'none', outline:'none', fontSize:14, fontFamily:'inherit', background:'rgba(255,255,255,0.95)', color:'#0F172A', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}
            />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'12px 20px' }}>
        <div style={{ maxWidth:800, margin:'0 auto', display:'flex', gap:10, flexWrap:'wrap' }}>
          <select value={filtro.asignatura} onChange={e=>setFiltro(f=>({...f,asignatura:e.target.value}))}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, fontFamily:'inherit', outline:'none', background:'white', color: filtro.asignatura?'#6D28D9':'#94A3B8' }}>
            <option value="">📚 Todas las materias</option>
            {asignaturas.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtro.localidad} onChange={e=>setFiltro(f=>({...f,localidad:e.target.value}))}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, fontFamily:'inherit', outline:'none', background:'white', color: filtro.localidad?'#6D28D9':'#94A3B8' }}>
            <option value="">📍 Todas las localidades</option>
            {localidades.map(l=><option key={l} value={l}>{l}</option>)}
          </select>
          {(q||filtro.asignatura||filtro.localidad) && (
            <button onClick={()=>{ setQ(''); setFiltro({asignatura:'',localidad:''}); }}
              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #FCA5A5', background:'#FFF1F2', color:'#DC2626', fontSize:13, cursor:'pointer', fontWeight:600 }}>
              ✕ Limpiar
            </button>
          )}
          <span style={{ marginLeft:'auto', fontSize:13, color:'#94A3B8', alignSelf:'center' }}>
            {loading ? 'Cargando…' : `${filtradas.length} página${filtradas.length!==1?'s':''}`}
          </span>
        </div>
      </div>

      {/* Results */}
      <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 20px' }}>
        {loading && <p style={{ textAlign:'center', color:'#94A3B8' }}>Cargando páginas…</p>}
        {!loading && filtradas.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#94A3B8' }}>
            <Globe size={40} style={{ marginBottom:12, opacity:0.4 }}/>
            <p style={{ fontSize:15 }}>No se encontraron páginas con esos criterios.</p>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {filtradas.map(p => (
            <div key={p.uid} onClick={()=>onSelect(p.slug||p.uid)}
              style={{ background:'white', borderRadius:14, padding:'20px', border:'1px solid #E2E8F0', cursor:'pointer', transition:'all 0.2s', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; }}
            >
              <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#4338CA,#6D28D9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>👨‍🏫</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:'#0F172A', marginBottom:2 }}>{p.nombre||'Profesor'}</div>
                  {p.asignatura && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#6D28D9', fontWeight:600 }}>
                      <BookOpen size={11}/> {p.asignatura}
                    </div>
                  )}
                  {(p.localidad||p.poblacion) && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#64748B', marginTop:2 }}>
                      <MapPin size={11}/> {p.localidad||p.poblacion}
                    </div>
                  )}
                </div>
              </div>
              {p.descripcion && <p style={{ margin:'0 0 12px', fontSize:13, color:'#475569', lineHeight:1.5 }}>{p.descripcion.slice(0,120)}{p.descripcion.length>120?'…':''}</p>}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#94A3B8' }}>
                  {(p.cursos||[]).length} curso{(p.cursos||[]).length!==1?'s':''}
                </span>
                <span style={{ fontSize:12, color:'#6D28D9', fontWeight:700 }}>
                  pikt.es/{p.slug||'…'} →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
