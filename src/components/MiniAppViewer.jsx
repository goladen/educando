import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { buildSrcdoc } from '../utils/miniAppSrcdoc';

export default function MiniAppViewer({ miniappId, onBack }) {
  const [app, setApp]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [runtimeError, setRuntimeError] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (iframeRef.current) {
      iframeRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    getDoc(doc(db, 'miniapps', miniappId))
      .then(snap => {
        if (snap.exists() && snap.data().estado === 'aprobada') {
          setApp({ id: snap.id, ...snap.data() });
        } else {
          setError('Esta herramienta no está disponible o aún no ha sido aprobada.');
        }
      })
      .catch(() => setError('Error al cargar la herramienta.'))
      .finally(() => setLoading(false));
  }, [miniappId]);

  useEffect(() => {
    const h = (e) => { if (e.data?.type === 'miniapp-error') setRuntimeError(e.data.msg); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
        <p style={{ color:'#6b7280' }}>Cargando herramienta…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
        <p style={{ color:'#374151', fontWeight:700 }}>{error}</p>
        {onBack && <button onClick={onBack} style={{ marginTop:12, padding:'8px 20px', background:'#6c63ff', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>Volver</button>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:'system-ui' }}>
      {/* Header */}
      <div style={{ background:'#1e293b', padding:'12px 20px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
        {onBack && (
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem' }}>
            ← Volver
          </button>
        )}
        <div style={{ flex:1 }}>
          <h1 style={{ margin:0, color:'#fff', fontSize:'1.1rem', fontWeight:900 }}>⚡ {app.titulo}</h1>
          {app.descripcion && <p style={{ margin:0, color:'#94a3b8', fontSize:'0.78rem' }}>{app.descripcion}</p>}
        </div>
        <span style={{ fontSize:'0.72rem', color:'#64748b', background:'rgba(255,255,255,0.07)', padding:'3px 10px', borderRadius:20 }}>
          por {app.autorNombre}
        </span>
        <button onClick={() => { setRuntimeError(''); setIframeKey(k => k+1); }}
          style={{ background:'rgba(108,99,255,0.3)', border:'none', color:'#c4b5fd', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.8rem', fontWeight:700 }}>
          ↺ Recargar
        </button>
        <button onClick={toggleFullscreen}
          style={{ background:'rgba(108,99,255,0.3)', border:'none', color:'#c4b5fd', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.8rem', fontWeight:700 }}>
          {isFullscreen ? '⤡ Salir de pantalla completa' : '⛶ Pantalla completa'}
        </button>
      </div>

      {runtimeError && (
        <div style={{ background:'#fef2f2', borderBottom:'1px solid #fecaca', padding:'8px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#dc2626', fontSize:'0.8rem', fontFamily:'monospace' }}>⚠ {runtimeError}</span>
          <button onClick={() => setRuntimeError('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>
        </div>
      )}

      {/* Sandboxed app */}
      <iframe
        ref={iframeRef}
        key={iframeKey}
        srcDoc={buildSrcdoc(app.code)}
        sandbox="allow-scripts"
        title={app.titulo}
        style={{ width:'100%', height:'calc(100vh - 58px)', border:'none', display:'block', background:'#fff' }}
      />
    </div>
  );
}
