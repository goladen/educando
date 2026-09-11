import { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { normalizarConfigPuntuacion } from '../utils/miniAppPuntuacion';

// Modal «Enviar al profesor» para mini-apps publicadas.
// `puntuacion` ya viene validada por sanitizarPuntuacion(); la mini-app nunca toca Firestore.
export default function MiniAppEnviarProfe({ app, config, puntuacion, onClose }) {
  const [codigo, setCodigo]     = useState('');
  const [nombre, setNombre]     = useState('');
  const [curso, setCurso]       = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado]   = useState(false);
  const [error, setError]       = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code)          { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      const cfg = normalizarConfigPuntuacion(config);
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'MINIAPP',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        miniappId: app.id,
        recursoTitulo: app.titulo || '',
        config: { tipoPuntuacion: cfg.tipo, etiqueta: cfg.etiqueta, max: cfg.max },
        jugadores: [{
          nombre: nombre.trim().slice(0, 60),
          curso:  curso.trim().slice(0, 40),
          tipoPuntuacion: cfg.tipo,
          ...puntuacion,
        }],
      });
      setEnviado(true);
    } catch (e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(255,255,255,0.15)',
    background:'rgba(255,255,255,0.08)', color:'white', fontSize:'0.9rem',
    outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:'0.78rem', color:'#aaa', fontWeight:600, display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10000, display:'flex', justifyContent:'center', alignItems:'center', padding:12 }}>
      <div style={{ background:'#1e272e', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, width:'100%', maxWidth:380, padding:'24px 26px', color:'white', fontFamily:"'Segoe UI',sans-serif" }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:'1.05rem', color:'#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:'1.2rem' }}>✕</button>
        </div>
        <div style={{ background:'rgba(241,196,15,0.12)', border:'1px solid rgba(241,196,15,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:14, fontSize:'0.88rem' }}>
          <div style={{ color:'#aaa', fontSize:'0.72rem', marginBottom:2 }}>{app.titulo}</div>
          <strong>{puntuacion.resumen}</strong>
          {puntuacion.porcentaje != null && <span style={{ marginLeft:8, color:'#f1c40f', fontWeight:700 }}>{puntuacion.porcentaje}%</span>}
        </div>
        {enviado ? (
          <div style={{ textAlign:'center', padding:'14px 0' }}>
            <div style={{ fontSize:'3rem' }}>✅</div>
            <div style={{ color:'#2ecc71', fontWeight:700 }}>¡Resultado enviado!</div>
            <button onClick={onClose} style={{ marginTop:16, padding:'9px 22px', borderRadius:10, border:'none', background:'rgba(255,255,255,0.1)', cursor:'pointer', color:'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div><label style={lbl}>Nombre y apellido</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" maxLength={60} style={inp} /></div>
            <div><label style={lbl}>Curso</label>
              <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º Primaria A" maxLength={40} style={inp} /></div>
            <div><label style={lbl}>Código del profesor</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing:2, fontWeight:700 }} /></div>
            {error && <div style={{ color:'#e74c3c', fontSize:'0.8rem' }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:9, marginTop:4 }}>
              <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', cursor:'pointer', color:'white' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor: enviando ? 'default' : 'pointer' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
