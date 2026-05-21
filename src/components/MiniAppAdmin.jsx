import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { buildSrcdoc } from '../utils/miniAppSrcdoc';

const ESTADOS = { pendiente:'🕐 Pendiente', aprobada:'✅ Aprobada', rechazada:'❌ Rechazada' };
const COLORES  = { pendiente:'#f59e0b', aprobada:'#10b981', rechazada:'#ef4444' };

export default function MiniAppAdmin({ usuario }) {
  const [apps, setApps]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtro, setFiltro]           = useState('pendiente');
  const [preview, setPreview]         = useState(null); // { app, iframeKey }
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [accionando, setAccionando]   = useState(null); // id being acted on
  const [runtimeError, setRuntimeError] = useState('');
  const [copiado, setCopiado]         = useState(null); // id copiado

  const cargar = () => {
    setLoading(true);
    getDocs(query(collection(db, 'miniapps'), orderBy('creadoEn', 'desc')))
      .then(snap => setApps(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const h = (e) => { if (e.data?.type === 'miniapp-error') setRuntimeError(e.data.msg); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  const aprobar = async (app) => {
    setAccionando(app.id);
    await updateDoc(doc(db, 'miniapps', app.id), { estado:'aprobada', aprobadoEn: serverTimestamp(), motivoRechazo: '' });
    setApps(prev => prev.map(a => a.id === app.id ? { ...a, estado:'aprobada' } : a));
    setAccionando(null);
  };

  const rechazar = async (app) => {
    if (!motivoRechazo.trim()) { alert('Añade un motivo de rechazo.'); return; }
    setAccionando(app.id);
    await updateDoc(doc(db, 'miniapps', app.id), { estado:'rechazada', motivoRechazo: motivoRechazo.trim() });
    setApps(prev => prev.map(a => a.id === app.id ? { ...a, estado:'rechazada', motivoRechazo: motivoRechazo.trim() } : a));
    setMotivoRechazo('');
    setAccionando(null);
  };

  const copiarLink = (id) => {
    const link = `${window.location.origin}/?miniapp=${id}`;
    navigator.clipboard.writeText(link).then(() => { setCopiado(id); setTimeout(() => setCopiado(null), 2000); });
  };

  const filtradas = apps.filter(a => a.estado === filtro);

  return (
    <div style={{ fontFamily:'system-ui', maxWidth:900, margin:'0 auto' }}>
      <h2 style={{ marginBottom:4, color:'#1e293b' }}>🛡 Panel de revisión — Mini-Apps</h2>
      <p style={{ color:'#64748b', fontSize:'0.85rem', marginBottom:16 }}>
        Solo visible para administradores. Revisa el código antes de aprobar.
      </p>

      {/* Filtro tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['pendiente','aprobada','rechazada'].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            style={{ padding:'6px 16px', borderRadius:20, border:'2px solid', fontWeight:700, fontSize:'0.82rem', cursor:'pointer',
              borderColor: filtro===e ? COLORES[e] : '#e2e8f0',
              background: filtro===e ? COLORES[e] : '#f8fafc',
              color: filtro===e ? '#fff' : '#64748b' }}>
            {ESTADOS[e]} ({apps.filter(a=>a.estado===e).length})
          </button>
        ))}
        <button onClick={cargar} style={{ marginLeft:'auto', padding:'6px 14px', background:'#f1f5f9', border:'none', borderRadius:20, cursor:'pointer', fontSize:'0.82rem', color:'#475569', fontWeight:700 }}>↺ Actualizar</button>
      </div>

      {loading ? (
        <p style={{ color:'#94a3b8', textAlign:'center', padding:40 }}>Cargando…</p>
      ) : filtradas.length === 0 ? (
        <p style={{ color:'#94a3b8', textAlign:'center', padding:40 }}>No hay mini-apps en estado «{filtro}»</p>
      ) : (
        filtradas.map(app => (
          <div key={app.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, marginBottom:16, overflow:'hidden', background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* App header */}
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <h3 style={{ margin:'0 0 2px', color:'#1e293b', fontSize:'1rem' }}>{app.titulo || '(sin título)'}</h3>
                {app.descripcion && <p style={{ margin:'0 0 4px', color:'#64748b', fontSize:'0.8rem' }}>{app.descripcion}</p>}
                <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>
                  por <b>{app.autorNombre}</b> · {app.autorEmail}
                  {app.creadoEn?.toDate && (' · ' + app.creadoEn.toDate().toLocaleDateString('es-ES'))}
                  {app.materia && <span style={{ marginLeft:6, background:'#ede9fe', color:'#7c3aed', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>{app.materia}</span>}
                </span>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                {app.estado === 'aprobada' && (
                  <button onClick={() => copiarLink(app.id)}
                    style={{ padding:'5px 12px', background: copiado===app.id ? '#10b981' : '#6c63ff', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.78rem', fontWeight:700 }}>
                    {copiado===app.id ? '✅ Copiado' : '🔗 Copiar enlace'}
                  </button>
                )}
                <button onClick={() => { setRuntimeError(''); setPreview(preview?.app.id === app.id ? null : { app, iframeKey: Date.now() }); }}
                  style={{ padding:'5px 12px', background: preview?.app.id===app.id ? '#1e293b' : '#f1f5f9', color: preview?.app.id===app.id ? '#fff' : '#374151', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.78rem', fontWeight:700 }}>
                  {preview?.app.id === app.id ? '⬆ Ocultar preview' : '👁 Ver preview'}
                </button>
                {app.estado !== 'aprobada' && (
                  <button onClick={() => aprobar(app)} disabled={!!accionando}
                    style={{ padding:'5px 12px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.78rem', fontWeight:700, opacity: accionando ? 0.6 : 1 }}>
                    ✅ Aprobar
                  </button>
                )}
                {app.estado !== 'rechazada' && (
                  <button onClick={() => rechazar(app)} disabled={!!accionando}
                    style={{ padding:'5px 12px', background:'#ef4444', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.78rem', fontWeight:700, opacity: accionando ? 0.6 : 1 }}>
                    ❌ Rechazar
                  </button>
                )}
              </div>
            </div>

            {/* Motivo rechazo input (solo visible si el botón de rechazar está disponible) */}
            {app.estado !== 'rechazada' && (
              <div style={{ padding:'8px 16px', background:'#fef9f9', borderBottom:'1px solid #f1f5f9', display:'flex', gap:8, alignItems:'center' }}>
                <input
                  value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                  placeholder="Motivo de rechazo (requerido para rechazar)…"
                  style={{ flex:1, padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:'0.8rem', outline:'none' }}
                />
              </div>
            )}
            {app.motivoRechazo && (
              <div style={{ padding:'6px 16px', background:'#fef2f2', fontSize:'0.78rem', color:'#dc2626' }}>
                Motivo: {app.motivoRechazo}
              </div>
            )}

            {/* Sandboxed preview */}
            {preview?.app.id === app.id && (
              <div>
                {runtimeError && (
                  <div style={{ background:'#fef2f2', padding:'6px 14px', display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:'#dc2626', fontFamily:'monospace' }}>
                    ⚠ {runtimeError}
                    <button onClick={() => setRuntimeError('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>
                  </div>
                )}
                <iframe
                  key={preview.iframeKey}
                  srcDoc={buildSrcdoc(app.code)}
                  sandbox="allow-scripts"
                  title={`Preview: ${app.titulo}`}
                  style={{ width:'100%', height:340, border:'none', display:'block', borderTop:'2px dashed #e2e8f0' }}
                />
                {/* Code viewer */}
                <details style={{ borderTop:'1px solid #f1f5f9' }}>
                  <summary style={{ padding:'8px 16px', cursor:'pointer', fontWeight:700, fontSize:'0.8rem', color:'#475569', userSelect:'none', background:'#f8fafc' }}>
                    {'{ }'} Ver código fuente
                  </summary>
                  <pre style={{ margin:0, padding:'12px 16px', background:'#1e1e2e', color:'#cdd6f4', fontSize:'0.78rem', overflowX:'auto', maxHeight:300, fontFamily:"'Fira Code', monospace" }}>
                    {app.code}
                  </pre>
                </details>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
