import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveProvider, LiveEditor } from 'react-live';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { buildSrcdoc } from '../utils/miniAppSrcdoc';

// ── Constants ──────────────────────────────────────────────────────────────────
const DEFAULT_CODE = `function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', textAlign: 'center' }}>
      <h2>Mi Mini-App de clase 🎓</h2>
      <p>Contador: <strong>{count}</strong></p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ padding: '8px 20px', fontSize: 16, cursor: 'pointer',
          background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8 }}>
        +1
      </button>
    </div>
  );
}`;

const AI_PROMPT = `Crea un componente React llamado App para usar en una pizarra digital de aula.

REGLAS ESTRICTAS:
- NO uses ningún import ni export
- NO uses librerías externas (solo React puro)
- Las variables de hook ya están disponibles: useState, useEffect, useRef, useCallback, useMemo, useReducer
- Usa únicamente estilos inline (style={{}}) — no className, no Tailwind, no CSS externo
- Devuelve SOLO el bloque de código del componente App, listo para pegar, sin ningún texto adicional

Descripción de la aplicación que quiero:
[ESCRIBE TU DESCRIPCIÓN AQUÍ]`;

const MATERIAS = [
  'General', 'Matemáticas', 'Lengua', 'Inglés', 'Ciencias Naturales',
  'Historia', 'Geografía', 'Música', 'Plástica', 'Educación Física',
  'Tecnología', 'Filosofía', 'Física', 'Química', 'Biología', 'Otra',
];

const MATERIA_COLORS = {
  'Matemáticas': '#3b82f6', 'Lengua': '#8b5cf6', 'Inglés': '#06b6d4',
  'Ciencias Naturales': '#10b981', 'Historia': '#f59e0b', 'Geografía': '#84cc16',
  'Música': '#ec4899', 'Física': '#6366f1', 'Química': '#f97316',
  'Biología': '#14b8a6', 'Tecnología': '#64748b', 'General': '#6c63ff',
};

const SORT_OPTIONS = [
  { value: 'reciente', label: '📅 Más reciente' },
  { value: 'antiguo',  label: '📅 Más antiguo'  },
  { value: 'titulo',   label: '🔤 Título A→Z'   },
];

// ── Gallery subcomponent ───────────────────────────────────────────────────────
function MiniAppGallery({ onCargar, onAbrir }) {
  const [apps, setApps]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [filtroCreador, setFiltroCreador] = useState('');
  const [ordenar, setOrdenar]     = useState('reciente');
  const [previewId, setPreviewId] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [copiadoId, setCopiadoId] = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, 'miniapps'), where('estado', '==', 'aprobada'), orderBy('creadoEn', 'desc')))
      .then(snap => setApps(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const creadores = [...new Set(apps.map(a => a.autorNombre).filter(Boolean))].sort();

  const filtradas = apps
    .filter(a => {
      const q = busqueda.toLowerCase();
      const matchQ = !q || a.titulo?.toLowerCase().includes(q) || a.descripcion?.toLowerCase().includes(q) || a.autorNombre?.toLowerCase().includes(q) || a.materia?.toLowerCase().includes(q);
      const matchM = !filtroMateria || a.materia === filtroMateria;
      const matchC = !filtroCreador || a.autorNombre === filtroCreador;
      return matchQ && matchM && matchC;
    })
    .sort((a, b) => {
      if (ordenar === 'titulo')  return (a.titulo || '').localeCompare(b.titulo || '');
      if (ordenar === 'antiguo') return (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0);
      return (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0);
    });

  const copiarLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/?miniapp=${id}`);
    setCopiadoId(id); setTimeout(() => setCopiadoId(null), 2000);
  };

  const formatFecha = (ts) => {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
  };

  return (
    <div style={{ marginTop: 32 }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:'1rem', fontWeight:900, color:'#1e293b' }}>
          ⚡ Herramientas de la comunidad
        </h3>
        <span style={{ background:'#6c63ff', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:'0.72rem', fontWeight:700 }}>
          {filtradas.length}
        </span>
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        {/* Búsqueda libre */}
        <div style={{ position:'relative', flex:'1 1 200px', minWidth:160 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:14 }}>🔍</span>
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, materia…"
            style={{ width:'100%', boxSizing:'border-box', paddingLeft:32, paddingRight:10, paddingTop:7, paddingBottom:7, borderRadius:8, border:'1px solid #e2e8f0', fontSize:'0.82rem', outline:'none' }}
          />
          {busqueda && <button onClick={() => setBusqueda('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:14, lineHeight:1 }}>✕</button>}
        </div>

        {/* Filtro materia */}
        <select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:'0.82rem', background:'#fff', cursor:'pointer', outline:'none', minWidth:130 }}>
          <option value="">📚 Toda materia</option>
          {MATERIAS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Filtro creador */}
        <select value={filtroCreador} onChange={e => setFiltroCreador(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:'0.82rem', background:'#fff', cursor:'pointer', outline:'none', minWidth:130 }}>
          <option value="">👤 Todo creador</option>
          {creadores.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Ordenar */}
        <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:'0.82rem', background:'#fff', cursor:'pointer', outline:'none', minWidth:140 }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {(busqueda || filtroMateria || filtroCreador) && (
          <button onClick={() => { setBusqueda(''); setFiltroMateria(''); setFiltroCreador(''); }}
            style={{ padding:'7px 12px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:8, cursor:'pointer', fontSize:'0.78rem', fontWeight:700, whiteSpace:'nowrap' }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Lista ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color:'#94a3b8', textAlign:'center', padding:30 }}>Cargando herramientas…</p>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign:'center', padding:'30px 0', color:'#94a3b8' }}>
          <p style={{ fontSize:'2rem', marginBottom:8 }}>🔭</p>
          <p style={{ margin:0, fontSize:'0.85rem' }}>{apps.length === 0 ? 'Aún no hay herramientas aprobadas.' : 'Ninguna herramienta coincide con los filtros.'}</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%,320px),1fr))', gap:12 }}>
          {filtradas.map(app => {
            const isOpen = previewId === app.id;
            const mColor = MATERIA_COLORS[app.materia] || '#6c63ff';
            return (
              <div key={app.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', transition:'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'}>

                {/* Card header */}
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:4 }}>
                    <div style={{ flex:1 }}>
                      <h4 style={{ margin:'0 0 2px', fontSize:'0.9rem', fontWeight:800, color:'#1e293b', lineHeight:1.3 }}>
                        {app.titulo || '(sin título)'}
                      </h4>
                      {app.descripcion && (
                        <p style={{ margin:0, fontSize:'0.75rem', color:'#64748b', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                          {app.descripcion}
                        </p>
                      )}
                    </div>
                    {app.materia && (
                      <span style={{ background: mColor + '1a', color: mColor, border:`1px solid ${mColor}40`, borderRadius:20, padding:'2px 8px', fontSize:'0.68rem', fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
                        {app.materia}
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.7rem', color:'#94a3b8' }}>
                    <span>👤 {app.autorNombre}</span>
                    <span>·</span>
                    <span>📅 {formatFecha(app.creadoEn)}</span>
                  </div>
                </div>

                {/* Inline preview */}
                {isOpen && (
                  <div style={{ borderBottom:'1px solid #e2e8f0' }}>
                    <iframe key={previewKey} srcDoc={buildSrcdoc(app.code)} sandbox="allow-scripts"
                      title={app.titulo} style={{ width:'100%', height:200, border:'none', display:'block' }} />
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding:'8px 10px', display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button
                    onClick={() => { setPreviewId(isOpen ? null : app.id); setPreviewKey(k => k+1); }}
                    style={{ flex:1, padding:'6px 0', background: isOpen ? '#1e293b' : '#f1f5f9', color: isOpen ? '#fff' : '#374151', border:'none', borderRadius:7, cursor:'pointer', fontSize:'0.75rem', fontWeight:700 }}>
                    {isOpen ? '▲ Cerrar' : '▶ Ver app'}
                  </button>
                  <button
                    onClick={() => { onCargar(app.code); window.scrollTo({ top:0, behavior:'smooth' }); }}
                    style={{ flex:1, padding:'6px 0', background:'rgba(108,99,255,0.1)', color:'#6c63ff', border:'1px solid rgba(108,99,255,0.25)', borderRadius:7, cursor:'pointer', fontSize:'0.75rem', fontWeight:700 }}>
                    ✏️ Cargar en editor
                  </button>
                  <button
                    onClick={() => onAbrir(app.id)}
                    style={{ padding:'6px 9px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:7, cursor:'pointer', fontSize:'0.75rem', fontWeight:700 }}>
                    ⛶
                  </button>
                  <button
                    onClick={() => copiarLink(app.id)}
                    style={{ padding:'6px 9px', background: copiadoId===app.id ? '#16a34a' : '#f8fafc', color: copiadoId===app.id ? '#fff' : '#64748b', border:'1px solid #e2e8f0', borderRadius:7, cursor:'pointer', fontSize:'0.75rem', fontWeight:700 }}>
                    {copiadoId===app.id ? '✅' : '🔗'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MiniAppCreator({ onAbrirViewer }) {
  const [code, setCode]             = useState(DEFAULT_CODE);
  const [runCode, setRunCode]       = useState(DEFAULT_CODE);
  const [iframeKey, setIframeKey]   = useState(0);
  const [runtimeError, setRuntimeError] = useState('');
  const [copied, setCopied]         = useState(false);
  const [previewH, setPreviewH]     = useState(380);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  // Submission state
  const [showSubmit, setShowSubmit] = useState(false);
  const [titulo, setTitulo]         = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [materia, setMateria]       = useState('General');
  const [enviando, setEnviando]     = useState(false);
  const [enviado, setEnviado]       = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.data?.type === 'miniapp-error') setRuntimeError(e.data.msg); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return unsub;
  }, []);

  const handleRun = useCallback(() => {
    setRuntimeError('');
    setRunCode(code);
    setIframeKey(k => k + 1);
  }, [code]);

  const copyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const startDrag = (e) => {
    const startY = e.clientY, startH = previewH;
    const onMove = (ev) => setPreviewH(Math.max(180, Math.min(800, startH + ev.clientY - startY)));
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleEnviar = async () => {
    if (!titulo.trim()) { alert('Añade un título a tu app.'); return; }
    if (!code.trim())   { alert('El editor está vacío.'); return; }
    setEnviando(true);
    try {
      const user = auth.currentUser;
      const ref = await addDoc(collection(db, 'miniapps'), {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        materia,
        code,
        autorId:     user.uid,
        autorNombre: user.displayName || user.email,
        autorEmail:  user.email,
        estado:      'pendiente',
        creadoEn:    serverTimestamp(),
      });
      setEnviado({ id: ref.id, link: `${window.location.origin}/?miniapp=${ref.id}` });
    } catch (e) {
      alert('Error al enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleCargarEnEditor = (appCode) => {
    setCode(appCode);
    setRunCode(appCode);
    setIframeKey(k => k + 1);
  };

  return (
    <div style={{ fontFamily: 'system-ui' }}>

      {/* ── Prompt helper ─────────────────────────────────────────────────── */}
      <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200 }}>
          <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:'0.85rem', color:'#0369a1' }}>💡 Cómo crear tu app con IA (Claude / Gemini)</p>
          <p style={{ margin:0, fontSize:'0.78rem', color:'#475569', lineHeight:1.5 }}>
            Copia el prompt, pégalo en Claude o Gemini, describe tu aplicación al final, y pega el código en el editor. Luego pulsa <strong>▶ Ejecutar</strong>.
          </p>
        </div>
        <button onClick={copyPrompt}
          style={{ padding:'8px 14px', background: copied ? '#16a34a' : '#0284c7', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:'0.8rem', whiteSpace:'nowrap', flexShrink:0 }}>
          {copied ? '✅ ¡Copiado!' : '📋 Copiar prompt para IA'}
        </button>
      </div>

      {/* ── Editor ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontWeight:700, fontSize:'0.85rem', color:'#374151' }}>📝 Código JSX</span>
          <button onClick={handleRun}
            style={{ padding:'7px 18px', background:'linear-gradient(135deg, #6c63ff, #3b82f6)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:800, fontSize:'0.9rem', boxShadow:'0 2px 6px rgba(108,99,255,0.35)' }}>
            ▶ Ejecutar
          </button>
        </div>
        <LiveProvider code={code} noInline language="jsx">
          <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #d1d5db' }}>
            <LiveEditor onChange={setCode}
              style={{ fontFamily:"'Fira Code', monospace", fontSize:13, minHeight:220, background:'#1e1e2e' }} />
          </div>
        </LiveProvider>
      </div>

      {/* ── Runtime error ─────────────────────────────────────────────────── */}
      {runtimeError && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
          <span style={{ color:'#dc2626', fontSize:'0.8rem', fontFamily:'monospace', whiteSpace:'pre-wrap' }}>⚠ {runtimeError}</span>
          <button onClick={() => setRuntimeError('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>
        </div>
      )}

      {/* ── Secure preview ────────────────────────────────────────────────── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontWeight:700, fontSize:'0.85rem', color:'#374151' }}>🔒 Previsualización segura</span>
          <span style={{ fontSize:'0.72rem', color:'#6b7280', background:'#f3f4f6', padding:'2px 8px', borderRadius:20 }}>aislada · sin acceso a la app principal</span>
        </div>
        <div style={{ border:'2px solid #e5e7eb', borderRadius:10, overflow:'hidden', background:'#fff' }}>
          <iframe key={iframeKey} srcDoc={buildSrcdoc(runCode)} sandbox="allow-scripts"
            title="Previsualización" style={{ width:'100%', height:previewH, border:'none', display:'block' }} />
          <div onMouseDown={startDrag}
            style={{ height:8, cursor:'ns-resize', background:'#f9fafb', borderTop:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:32, height:3, background:'#d1d5db', borderRadius:2 }} />
          </div>
        </div>
      </div>

      {/* ── Enviar como herramienta ───────────────────────────────────────── */}
      {!currentUser ? (
        <div style={{ background:'#f8fafc', border:'2px dashed #e2e8f0', borderRadius:10, padding:'16px 18px', marginBottom:16, textAlign:'center' }}>
          <p style={{ margin:'0 0 4px', fontSize:'1.2rem' }}>🔒</p>
          <p style={{ margin:'0 0 6px', fontWeight:700, color:'#374151', fontSize:'0.9rem' }}>Inicia sesión para enviar tu herramienta</p>
          <p style={{ margin:0, fontSize:'0.78rem', color:'#64748b' }}>
            Cualquiera puede usar y probar las apps de la galería sin cuenta.<br/>
            Solo necesitas registro para enviar tu propia herramienta a revisión.
          </p>
        </div>
      ) : enviado ? (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
          <p style={{ margin:'0 0 8px', fontWeight:800, color:'#15803d' }}>✅ ¡App enviada para revisión!</p>
          <p style={{ margin:'0 0 8px', fontSize:'0.82rem', color:'#166534' }}>
            El administrador la revisará y, si se aprueba, estará disponible con este enlace:
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <code style={{ background:'#dcfce7', padding:'4px 10px', borderRadius:6, fontSize:'0.8rem', color:'#15803d', wordBreak:'break-all' }}>
              {enviado.link}
            </code>
            <button onClick={() => navigator.clipboard.writeText(enviado.link)}
              style={{ padding:'4px 12px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'0.78rem', whiteSpace:'nowrap' }}>
              📋 Copiar enlace
            </button>
          </div>
          <button onClick={() => { setEnviado(null); setTitulo(''); setDescripcion(''); setMateria('General'); setShowSubmit(false); }}
            style={{ marginTop:10, background:'none', border:'none', color:'#15803d', cursor:'pointer', fontSize:'0.8rem', textDecoration:'underline' }}>
            Crear otra app
          </button>
        </div>
      ) : showSubmit ? (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
          <p style={{ margin:'0 0 10px', fontWeight:700, color:'#1e293b', fontSize:'0.9rem' }}>📤 Enviar como herramienta pública</p>
          <p style={{ margin:'0 0 10px', fontSize:'0.78rem', color:'#64748b' }}>
            El administrador revisará el código antes de publicarla.
          </p>
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Título de la herramienta *"
            style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:'0.85rem', marginBottom:8, outline:'none' }} />
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Descripción breve (opcional)…" rows={2}
            style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:'0.85rem', marginBottom:8, outline:'none', resize:'vertical' }} />
          <select value={materia} onChange={e => setMateria(e.target.value)}
            style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:'0.85rem', marginBottom:12, outline:'none', background:'#fff', cursor:'pointer' }}>
            {MATERIAS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleEnviar} disabled={enviando}
              style={{ flex:1, padding:'9px 0', background: enviando ? '#94a3b8' : '#6c63ff', color:'#fff', border:'none', borderRadius:8, cursor: enviando ? 'not-allowed' : 'pointer', fontWeight:800, fontSize:'0.9rem' }}>
              {enviando ? '⏳ Enviando…' : '📤 Enviar para revisión'}
            </button>
            <button onClick={() => setShowSubmit(false)}
              style={{ padding:'9px 16px', background:'#f1f5f9', color:'#475569', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowSubmit(true)}
          style={{ width:'100%', padding:'10px 0', background:'linear-gradient(135deg, #7c3aed, #6c63ff)', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:'0.9rem', boxShadow:'0 2px 8px rgba(108,99,255,0.3)', marginBottom:16 }}>
          📤 Enviar como herramienta pública
        </button>
      )}

      {/* ── Galería de herramientas aprobadas ─────────────────────────────── */}
      <MiniAppGallery
        onCargar={handleCargarEnEditor}
        onAbrir={onAbrirViewer || ((id) => window.open(`/?miniapp=${id}`, '_blank'))}
      />
    </div>
  );
}
