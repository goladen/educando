import React, { useState, useEffect, useRef } from 'react';
import { bibliotecaIrregularVerbs as verbosData } from './BibliotecaIrregularVerbs';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment, collection, addDoc } from 'firebase/firestore';
import { Share2, Send, Users, Copy, Check, Play } from 'lucide-react';
import confetti from 'canvas-confetti';

import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile  from './assets/negative_beeps-6008.mp3';
import winSoundFile    from './assets/applause-small-audience-97257.mp3';
import startSoundFile  from './assets/inicio-juego.mp3';
import piHappy   from './assets/Pi-contento.png';
import piAngry   from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';

const audioCorrect = new Audio(correctSoundFile);
const audioWrong   = new Audio(wrongSoundFile);
const audioWin     = new Audio(winSoundFile);
const audioStart   = new Audio(startSoundFile);
const safePlay = (a) => { a.currentTime = 0; a.play().catch(() => {}); };

// ── Utilidades ────────────────────────────────────────────────────────────────
const normalize = (s) => s ? String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim() : '';
const isCorrect = (input, answer) => normalize(input) !== '' && answer.split('/').map(normalize).includes(normalize(input));

const COLS_ALL      = ['baseForm','pastSimple','pastParticiple','translation'];
const COLS_NO_TRANS = ['baseForm','pastSimple','pastParticiple'];
const COLS_BASE     = ['baseForm','pastSimple'];
const COL_LABELS    = { baseForm:'Base Form', pastSimple:'Past Simple', pastParticiple:'Past Participle', translation:'Traducción' };

const getActiveCols = (mode) =>
  mode === 'base_past' ? COLS_BASE : mode === 'no_translation' ? COLS_NO_TRANS : COLS_ALL;

const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

const generateCode = () => Math.random().toString(36).substring(2,8).toUpperCase();

const getOrCreateClientId = () => {
  let id = sessionStorage.getItem('verb_live_client_id');
  if (!id) { id = 'c_' + Math.random().toString(36).substring(2,11); sessionStorage.setItem('verb_live_client_id', id); }
  return id;
};

// ── Estilos base ──────────────────────────────────────────────────────────────
const dark = { bg:'#0f0f1a', card:'#1a1a2e', border:'rgba(255,255,255,0.1)', text:'#e8eaf6', muted:'#90909a' };

const BtnPrimary = ({ children, onClick, disabled, style={} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ background: disabled ? '#333' : 'linear-gradient(135deg,#6c63ff,#a855f7)',
      color:'white', border:'none', borderRadius:12, padding:'13px 28px', fontWeight:700,
      fontSize:'1rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      transition:'all 0.2s', ...style }}>
    {children}
  </button>
);

// ── Modal Enviar Profesor ─────────────────────────────────────────────────────
function ModalEnviarProfe({ onClose, score }) {
  const [codigo,setCodigo] = useState('');
  const [nombre,setNombre] = useState('');
  const [curso,setCurso]   = useState('');
  const [enviando,setEnviando] = useState(false);
  const [enviado,setEnviado]   = useState(false);
  const [error,setError]       = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db,'codigos_profesor',code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db,'informes_juegos'), {
        tipo:'IRREGULAR_VERBS', modalidad:'Individual', fecha:new Date(),
        recursoId:'irregular-verbs-test', recursoTitulo:'Test de Verbos Irregulares',
        codigoProfesor: code,
        jugadores:[{ nombre:nombre.trim(), curso:curso.trim(), puntuacion:score.points, maxPuntuacion:score.maxPoints }],
      });
      setEnviado(true);
    } catch(e) { setError('Error: '+e.message); }
    setEnviando(false);
  };

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:10000,display:'flex',justifyContent:'center',alignItems:'center' }}>
      <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,width:'100%',maxWidth:380,padding:'26px 28px',color:dark.text }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <h3 style={{ margin:0,color:'#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:dark.muted,fontSize:'1.2rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign:'center',padding:'20px 0' }}>
            <div style={{ fontSize:'3rem',marginBottom:10 }}>✅</div>
            <div style={{ color:'#2ecc71',fontWeight:700 }}>¡Informe enviado!</div>
            <button onClick={onClose} style={{ marginTop:16,padding:'9px 22px',borderRadius:10,border:`1px solid ${dark.border}`,background:'transparent',cursor:'pointer',color:dark.text }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {[['nombre','Nombre y apellido',nombre,setNombre,'Tu nombre',false],
              ['curso','Curso',curso,setCurso,'3º ESO A',false],
              ['cod','Código del profesor',codigo,v=>setCodigo(v.toUpperCase()),'PROF01',true]
            ].map(([k,lbl,val,set,ph,mono]) => (
              <div key={k}>
                <label style={{ fontSize:'0.78rem',color:dark.muted,fontWeight:600,display:'block',marginBottom:4 }}>{lbl}</label>
                <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                  style={{ padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.07)',
                    color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box',letterSpacing:mono?2:0,fontWeight:mono?700:400 }}/>
              </div>
            ))}
            {error && <div style={{ color:'#e74c3c',fontSize:'0.8rem' }}>⚠ {error}</div>}
            <div style={{ display:'flex',gap:9,marginTop:4 }}>
              <button onClick={onClose} style={{ flex:1,padding:'10px',borderRadius:10,border:`1px solid ${dark.border}`,background:'transparent',cursor:'pointer',color:dark.text }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando}
                style={{ flex:2,padding:'10px',borderRadius:10,border:'none',background:enviando?'#555':'linear-gradient(135deg,#3498db,#2980b9)',color:'white',fontWeight:700,cursor:'pointer' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Enviar Profe (Host multijugador) ────────────────────────────────────
function ModalEnviarProfeHost({ onClose, jugadores, preguntas, config }) {
  const [codigo, setCodigo]   = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const maxPtsMap = { all:3, no_translation:2, base_past:1 };
  const totalMax  = (preguntas?.length||0) * (maxPtsMap[config?.columnsMode]||3);

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db,'codigos_profesor',code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db,'informes_juegos'), {
        tipo:'IRREGULAR_VERBS', modalidad:'Online Multijugador', fecha:new Date(),
        recursoId:'irregular-verbs-live', recursoTitulo:'Reto de Verbos Irregulares',
        codigoProfesor: code,
        jugadores: jugadores.map(j=>({
          nombre: j.nombre,
          puntuacion: j.puntos||0,
          maxPuntuacion: totalMax,
          porcentaje: totalMax>0 ? Math.round((j.puntos||0)/totalMax*100) : 0,
        })),
      });
      setEnviado(true);
    } catch(e) { setError('Error: '+e.message); }
    setEnviando(false);
  };

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:10000,display:'flex',justifyContent:'center',alignItems:'center' }}>
      <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,width:'100%',maxWidth:360,padding:'26px 28px',color:dark.text }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <h3 style={{ margin:0,color:'#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:dark.muted,fontSize:'1.2rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign:'center',padding:'20px 0' }}>
            <div style={{ fontSize:'3rem',marginBottom:10 }}>✅</div>
            <div style={{ color:'#2ecc71',fontWeight:700 }}>¡Informe enviado!</div>
            <button onClick={onClose} style={{ marginTop:16,padding:'9px 22px',borderRadius:10,border:`1px solid ${dark.border}`,background:'transparent',cursor:'pointer',color:dark.text }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div style={{ fontSize:'0.82rem',color:dark.muted }}>Se enviarán las puntuaciones de <b style={{ color:dark.text }}>{jugadores.length}</b> jugadores (máx. {totalMax} pts).</div>
            <div>
              <label style={{ fontSize:'0.78rem',color:dark.muted,fontWeight:600,display:'block',marginBottom:4 }}>Código del profesor</label>
              <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="PROF01"
                style={{ padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.07)',
                  color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box',letterSpacing:3,fontWeight:700 }}/>
            </div>
            {error && <div style={{ color:'#e74c3c',fontSize:'0.8rem' }}>⚠ {error}</div>}
            <BtnPrimary onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : '📤 Enviar puntuaciones'}</BtnPrimary>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PANTALLA DE INICIO ────────────────────────────────────────────────────────
function HomeScreen({ onSolo, onHostLive, onJoinLive, shareUrl }) {
  const cards = [
    { icon:'📝', title:'Iniciar test', subtitle:'Test individual a tu ritmo', color:'#6c63ff', onClick: onSolo },
    { icon:'🏆', title:'Crear reto online', subtitle:'Crea una sala y compite en clase', color:'#f59e0b', onClick: onHostLive },
    { icon:'🚀', title:'Unirse a un reto', subtitle:'Entra con el código de tu profesor', color:'#10b981', onClick: onJoinLive },
  ];
  const compartir = () => {
    if (navigator.share) { navigator.share({ title:'Verbos Irregulares', url: shareUrl }); }
    else { navigator.clipboard.writeText(shareUrl).then(()=>alert('Enlace copiado')); }
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:20,padding:24 }}>
      <div style={{ textAlign:'center',marginBottom:12,position:'relative' }}>
        {shareUrl && (
          <button onClick={compartir} title="Compartir"
            style={{ position:'absolute',top:0,right:-40,background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.4)',
              borderRadius:8,padding:'6px 8px',cursor:'pointer',color:'#a78bfa',display:'flex',alignItems:'center',gap:4,fontSize:'0.8rem' }}>
            <Share2 size={14}/> Compartir
          </button>
        )}
        <div style={{ fontSize:52,marginBottom:8 }}>🇬🇧</div>
        <h1 style={{ margin:0,fontSize:'clamp(1.4rem,4vw,2rem)',fontWeight:800,
          background:'linear-gradient(90deg,#6c63ff,#a855f7)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>
          Verbos Irregulares
        </h1>
        <p style={{ margin:'8px 0 0',color:dark.muted,fontSize:'0.95rem' }}>Elige cómo quieres practicar</p>
      </div>
      <div style={{ display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',width:'100%',maxWidth:700 }}>
        {cards.map((c,i) => (
          <button key={i} onClick={c.onClick}
            style={{ flex:'1 1 190px',maxWidth:220,background:dark.card,border:`2px solid ${c.color}44`,borderRadius:20,
              padding:'28px 18px',cursor:'pointer',color:dark.text,transition:'all 0.2s',textAlign:'center' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=c.color; e.currentTarget.style.transform='translateY(-4px)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${c.color}44`; e.currentTarget.style.transform='translateY(0)'; }}>
            <div style={{ fontSize:36,marginBottom:10 }}>{c.icon}</div>
            <div style={{ fontWeight:700,fontSize:'1.05rem',marginBottom:4 }}>{c.title}</div>
            <div style={{ fontSize:'0.8rem',color:dark.muted,lineHeight:1.4 }}>{c.subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SOLO CONFIG ───────────────────────────────────────────────────────────────
function SoloConfig({ onStart, onBack, initialConfig }) {
  const [cfg, setCfg] = useState(initialConfig || { level:'sencillo', numVerbs:10, timeLimit:60, columnsMode:'all' });
  const [saveNum, setSaveNum]   = useState('');
  const [loadNum, setLoadNum]   = useState('');
  const [saving,  setSaving]    = useState(false);
  const [loading, setLoading]   = useState(false);
  const [savedOk, setSavedOk]   = useState(false);
  const [loadErr, setLoadErr]   = useState('');

  const inputStyle = { padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.06)',
    color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box' };
  const labelStyle = { fontSize:'0.78rem',color:dark.muted,fontWeight:600,display:'block',marginBottom:4 };

  const guardar = async () => {
    const n = saveNum.trim();
    if (!n || isNaN(n)) return alert('Introduce un número válido.');
    setSaving(true); setSavedOk(false);
    try {
      await setDoc(doc(db,'verb_test_configs', String(n)), { config: cfg, fecha: new Date() });
      setSavedOk(true); setTimeout(()=>setSavedOk(false), 2500);
    } catch(e) { alert('Error al guardar: '+e.message); }
    setSaving(false);
  };

  const cargar = async () => {
    const n = loadNum.trim();
    if (!n) return;
    setLoading(true); setLoadErr('');
    try {
      const snap = await getDoc(doc(db,'verb_test_configs', String(n)));
      if (!snap.exists()) { setLoadErr('Número no encontrado.'); } else {
        setCfg(snap.data().config);
        setLoadErr('');
      }
    } catch(e) { setLoadErr('Error: '+e.message); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth:440,margin:'0 auto',padding:'28px 20px' }}>
      <button onClick={onBack} style={{ background:'none',border:'none',color:dark.muted,cursor:'pointer',fontSize:'0.9rem',marginBottom:16 }}>← Volver</button>
      <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:'28px 24px',color:dark.text }}>
        <h2 style={{ margin:'0 0 22px',fontSize:'1.3rem',fontWeight:800 }}>⚙️ Configurar test</h2>

        {/* Cargar config por número */}
        <div style={{ background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:12,padding:'14px 16px',marginBottom:20 }}>
          <div style={{ ...labelStyle,color:'#10b981',marginBottom:8 }}>📥 Cargar configuración por número</div>
          <div style={{ display:'flex',gap:8 }}>
            <input value={loadNum} onChange={e=>setLoadNum(e.target.value)} placeholder="Ej: 23"
              style={{ ...inputStyle,flex:1 }} onKeyDown={e=>e.key==='Enter'&&cargar()} />
            <button onClick={cargar} disabled={loading}
              style={{ padding:'9px 16px',borderRadius:9,border:'none',background:'#10b981',color:'white',fontWeight:700,cursor:'pointer',flexShrink:0 }}>
              {loading ? '…' : 'Cargar'}
            </button>
          </div>
          {loadErr && <div style={{ color:'#e74c3c',fontSize:'0.8rem',marginTop:6 }}>⚠ {loadErr}</div>}
        </div>

        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {[
            ['Nivel', 'level', 'select', [['sencillo','Sencillo'],['medio','Medio (S+M)'],['dificil','Difícil (Todos)']]],
            ['Nº de verbos', 'numVerbs', 'number', null],
            ['Tiempo (segundos)', 'timeLimit', 'number', null],
            ['Columnas', 'columnsMode', 'select', [['all','Las 4 columnas'],['no_translation','Sin traducción (3)'],['base_past','Solo Base y Past (2)']]],
          ].map(([lbl,key,type,opts]) => (
            <div key={key}>
              <label style={labelStyle}>{lbl}</label>
              {type==='select' ? (
                <select value={cfg[key]} onChange={e=>setCfg({...cfg,[key]:e.target.value})} style={inputStyle}>
                  {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input type="number" value={cfg[key]} onChange={e=>setCfg({...cfg,[key]:parseInt(e.target.value)||1})} style={inputStyle} min={1} />
              )}
            </div>
          ))}
        </div>

        <BtnPrimary onClick={()=>onStart(cfg)} style={{ width:'100%',marginTop:22 }}>Empezar test</BtnPrimary>

        {/* Guardar config con número */}
        <div style={{ background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.25)',borderRadius:12,padding:'14px 16px',marginTop:16 }}>
          <div style={{ ...labelStyle,color:'#a78bfa',marginBottom:8 }}>💾 Guardar configuración con número</div>
          <div style={{ display:'flex',gap:8 }}>
            <input value={saveNum} onChange={e=>setSaveNum(e.target.value)} placeholder="Ej: 23"
              style={{ ...inputStyle,flex:1 }} />
            <button onClick={guardar} disabled={saving}
              style={{ padding:'9px 16px',borderRadius:9,border:'none',background:'#6c63ff',color:'white',fontWeight:700,cursor:'pointer',flexShrink:0 }}>
              {saving ? '…' : savedOk ? '✓' : 'Guardar'}
            </button>
          </div>
          <div style={{ fontSize:'0.75rem',color:dark.muted,marginTop:6 }}>Comparte este número con tus alumnos para que usen la misma configuración</div>
        </div>

        {/* Compartir config como URL */}
        <button
          onClick={()=>{
            const json = JSON.stringify(cfg);
            const encoded = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g,(_,p)=>String.fromCharCode(+('0x'+p))));
            const url = `${window.location.origin}${window.location.pathname}?juego=irregular_verbs&verbconfig=${encoded}`;
            if (navigator.share) navigator.share({ title:'Verbos Irregulares', url });
            else navigator.clipboard.writeText(url).then(()=>alert('Enlace copiado'));
          }}
          style={{ width:'100%',marginTop:10,padding:'10px',borderRadius:10,border:`1px solid rgba(108,99,255,0.4)`,
            background:'rgba(108,99,255,0.1)',color:'#a78bfa',fontWeight:600,cursor:'pointer',fontSize:'0.88rem',
            display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
          <Share2 size={14}/> Compartir esta configuración
        </button>
      </div>
    </div>
  );
}

// ── SOLO TEST + RESULTS ───────────────────────────────────────────────────────
function SoloTest({ cfg, onBack }) {
  const activeCols = getActiveCols(cfg.columnsMode);

  const [testData,     setTestData]     = useState([]);
  const [answers,      setAnswers]      = useState({});
  const [timeLeft,     setTimeLeft]     = useState(cfg.timeLimit);
  const [phase,        setPhase]        = useState('test');
  const [score,        setScore]        = useState({ points:0, maxPoints:0 });
  const [showEnviar,   setShowEnviar]   = useState(false);

  useEffect(() => {
    const levels = cfg.level==='sencillo'?['sencillo']:cfg.level==='medio'?['sencillo','medio']:['sencillo','medio','dificil'];
    const filtered = verbosData.filter(v=>levels.includes(v.level));
    const shuffled = [...filtered].sort(()=>0.5-Math.random()).slice(0, cfg.numVerbs);
    const data = shuffled.map((verb,i) => {
      const col = activeCols[Math.floor(Math.random()*activeCols.length)];
      return { id:i, verbData:verb, givenCol:col };
    });
    setTestData(data);
  }, []);

  useEffect(() => {
    if (phase !== 'test') return;
    if (timeLeft <= 0) { corregir(); return; }
    const t = setInterval(()=>setTimeLeft(p=>p-1), 1000);
    return ()=>clearInterval(t);
  }, [phase, timeLeft]);

  const corregir = () => {
    let pts=0, max=0;
    testData.forEach(row => {
      activeCols.forEach(col => {
        if (col !== row.givenCol) { max++; if (isCorrect(answers[`${row.id}-${col}`]||'', row.verbData[col])) pts++; }
      });
    });
    setScore({ points:pts, maxPoints:max });
    setPhase('results');
  };

  const compartir = async () => {
    const txt = `¡He conseguido ${score.points}/${score.maxPoints} en el test de Verbos Irregulares!`;
    if (navigator.share) { try { await navigator.share({ title:'Test Verbos Irregulares', text:txt, url:window.location.href }); } catch {} }
    else { navigator.clipboard.writeText(txt+' '+window.location.href); alert('Copiado al portapapeles'); }
  };

  return (
    <>
      {showEnviar && <ModalEnviarProfe onClose={()=>setShowEnviar(false)} score={score} />}
      <div style={{ maxWidth:'56rem',margin:'0 auto',padding:'16px' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <button onClick={onBack} style={{ background:'none',border:'none',color:dark.muted,cursor:'pointer' }}>← Volver</button>
          {phase==='test' && (
            <div style={{ fontFamily:'monospace',fontWeight:700,fontSize:'1.1rem',padding:'6px 14px',borderRadius:8,
              background:timeLeft<=10?'#450a0a':'rgba(255,255,255,0.08)',color:timeLeft<=10?'#f87171':dark.text }}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
        </div>

        <div style={{ overflowX:'auto',borderRadius:12,border:`1px solid ${dark.border}` }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#1e1b4b' }}>
                {activeCols.map(col=>(
                  <th key={col} style={{ padding:'12px 14px',color:'#c4b5fd',fontWeight:700,textAlign:'left',fontSize:'0.85rem',letterSpacing:1 }}>
                    {COL_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testData.map(row=>(
                <tr key={row.id} style={{ borderBottom:`1px solid ${dark.border}` }}>
                  {activeCols.map(col=>{
                    const given = col===row.givenCol;
                    const val   = given ? row.verbData[col] : (answers[`${row.id}-${col}`]||'');
                    let bg='transparent', color=dark.text, fw=400;
                    if (given) { bg='rgba(108,99,255,0.15)'; fw=700; color='#a78bfa'; }
                    else if (phase==='results') {
                      const ok = isCorrect(val, row.verbData[col]);
                      bg  = ok?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)';
                      color = ok?'#6ee7b7':'#fca5a5'; fw=600;
                    }
                    return (
                      <td key={col} style={{ padding:'10px 12px' }}>
                        <input type="text" value={val}
                          onChange={e=>setAnswers(p=>({...p,[`${row.id}-${col}`]:e.target.value}))}
                          disabled={given||phase==='results'}
                          placeholder={given?'':'…'}
                          style={{ width:'100%',padding:'7px 10px',borderRadius:7,border:`1.5px solid ${dark.border}`,
                            background:bg,color,fontWeight:fw,fontSize:'0.88rem',outline:'none',boxSizing:'border-box',
                            textDecoration:phase==='results'&&!given&&!isCorrect(val,row.verbData[col])?'line-through':'none' }} />
                        {phase==='results' && !given && !isCorrect(val,row.verbData[col]) && (
                          <div style={{ fontSize:'0.78rem',color:'#6ee7b7',marginTop:3,fontWeight:700 }}>{row.verbData[col]}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop:28,textAlign:'center' }}>
          {phase==='test' ? (
            <BtnPrimary onClick={corregir}>Corregir test</BtnPrimary>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:14,alignItems:'center' }}>
              <div style={{ fontSize:'1.4rem',fontWeight:800,padding:'16px 28px',borderRadius:14,
                background:'rgba(108,99,255,0.15)',border:'1px solid rgba(108,99,255,0.3)',color:'#c4b5fd' }}>
                {score.points === score.maxPoints ? '🌟 ' : ''}
                {score.points} / {score.maxPoints} puntos
              </div>
              <div style={{ display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center' }}>
                <button onClick={onBack} style={{ padding:'11px 22px',borderRadius:10,border:`1px solid ${dark.border}`,background:'transparent',color:dark.text,fontWeight:700,cursor:'pointer' }}>Volver</button>
                <button onClick={compartir} style={{ padding:'11px 18px',borderRadius:10,border:'none',background:'#7c3aed',color:'white',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
                  <Share2 size={15}/> Compartir
                </button>
                <button onClick={()=>setShowEnviar(true)} style={{ padding:'11px 18px',borderRadius:10,border:'none',background:'#ea580c',color:'white',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
                  <Send size={15}/> Enviar al profe
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── LIVE HOST ─────────────────────────────────────────────────────────────────
function LiveHost({ onBack }) {
  const [liveStep, setLiveStep] = useState('setup'); // setup | lobby | game | fin
  const [nombre,   setNombre]   = useState('');
  const [cfg,      setCfg]      = useState({ level:'sencillo', numRows:8, timePerRow:30, columnsMode:'all' });
  const [codigo,   setCodigo]   = useState('');
  const [gameData, setGameData] = useState(null);
  const [copiado,       setCopiado]       = useState(false);
  const [timer,         setTimer]         = useState(0);
  const [avatarMood,    setAvatarMood]    = useState('neutral');
  const [showEnviarHost,setShowEnviarHost]= useState(false);
  const timerRef = useRef(null);

  // Escuchar sala
  useEffect(() => {
    if (!codigo) return;
    const unsub = onSnapshot(doc(db,'live_games',codigo), snap => {
      if (snap.exists()) setGameData(snap.data());
    });
    return ()=>unsub();
  }, [codigo]);

  // Auto-revelar cuando todos han respondido
  useEffect(() => {
    if (gameData?.estado !== 'JUEGO' || gameData?.fasePregunta !== 'RESPONDING') return;
    const numJugadores = Object.keys(gameData.jugadores || {}).length;
    const numResps     = Object.keys(gameData.respuestasRonda || {}).length;
    if (numJugadores > 0 && numResps >= numJugadores) {
      clearInterval(timerRef.current);
      revelar();
    }
  }, [gameData?.respuestasRonda]);

  // Timer local
  useEffect(() => {
    if (gameData?.estado==='JUEGO' && gameData?.fasePregunta==='RESPONDING') {
      const inicio = gameData.questionStartTime || Date.now();
      const total  = cfg.timePerRow;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(()=>{
        const restante = Math.max(0, total - Math.ceil((Date.now()-inicio)/1000));
        setTimer(restante);
        if (restante<=0) { clearInterval(timerRef.current); revelar(); }
      }, 500);
    } else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  }, [gameData?.indicePregunta, gameData?.fasePregunta, gameData?.questionStartTime]);

  const generarPreguntas = (c) => {
    const levels = c.level==='sencillo'?['sencillo']:c.level==='medio'?['sencillo','medio']:['sencillo','medio','dificil'];
    const filtered = verbosData.filter(v=>levels.includes(v.level));
    const shuffled = [...filtered].sort(()=>0.5-Math.random()).slice(0,c.numRows);
    const cols = getActiveCols(c.columnsMode);
    return shuffled.map((verb,i)=>({ id:i, verbData:verb, givenCol: cols[Math.floor(Math.random()*cols.length)] }));
  };

  const crearSala = async () => {
    if (!nombre.trim()) return alert('Introduce tu nombre.');
    const code   = generateCode();
    const pregs  = generarPreguntas(cfg);
    await setDoc(doc(db,'live_games',code), {
      tipoJuego: 'IRREGULAR_VERBS_LIVE',
      estado: 'LOBBY',
      hostNombre: nombre.trim(),
      config: cfg,
      preguntas: pregs,
      indicePregunta: 0,
      fasePregunta: 'RESPONDING',
      jugadores: {},
      respuestasRonda: {},
      questionStartTime: null,
      createdAt: new Date(),
    });
    setCodigo(code);
    setLiveStep('lobby');
  };

  const iniciarJuego = async () => {
    await updateDoc(doc(db,'live_games',codigo), {
      estado: 'JUEGO',
      indicePregunta: 0,
      respuestasRonda: {},
      fasePregunta: 'RESPONDING',
      questionStartTime: Date.now(),
    });
    safePlay(audioStart);
    setLiveStep('game');
  };

  const revelar = async () => {
    // Fetch fresh data to avoid stale closure from timer interval
    const snap = await getDoc(doc(db,'live_games',codigo));
    if (!snap.exists()) return;
    const gd = snap.data();
    if (gd.fasePregunta !== 'RESPONDING') return;
    const preg   = gd.preguntas[gd.indicePregunta];
    const cols   = getActiveCols(gd.config?.columnsMode || 'all').filter(c=>c!==preg.givenCol);
    const resps  = gd.respuestasRonda || {};
    const updates = {};
    let totalAciertos = 0, totalAlumnos = 0;
    Object.entries(resps).forEach(([uid,r])=>{
      if (r.processed) return;
      totalAlumnos++;
      const pts = cols.reduce((sum,col)=> isCorrect(r.answers?.[col]||'', preg.verbData[col]||'') ? sum+1 : sum, 0);
      totalAciertos += pts;
      updates[`respuestasRonda.${uid}.puntos`]    = pts;
      updates[`respuestasRonda.${uid}.processed`] = true;
      updates[`jugadores.${uid}.puntos`] = increment(pts);
    });
    const pct = totalAlumnos>0 ? Math.round(totalAciertos/(totalAlumnos*cols.length)*100) : 0;
    setAvatarMood(pct>=60?'happy':pct<30?'angry':'neutral');
    if (pct>=60) safePlay(audioCorrect); else safePlay(audioWrong);
    updates.fasePregunta = 'RESULTADOS';
    await updateDoc(doc(db,'live_games',codigo), updates);
  };

  const siguiente = async () => {
    if (!gameData) return;
    if (gameData.fasePregunta==='RESPONDING') { await revelar(); return; }
    const next = gameData.indicePregunta + 1;
    if (next < gameData.preguntas.length) {
      await updateDoc(doc(db,'live_games',codigo), {
        indicePregunta: next, respuestasRonda: {}, fasePregunta: 'RESPONDING', questionStartTime: Date.now()
      });
      setAvatarMood('neutral');
    } else {
      await updateDoc(doc(db,'live_games',codigo), { estado:'FIN' });
      safePlay(audioWin);
      confetti({ particleCount:120, spread:80, origin:{y:0.6} });
      setLiveStep('fin');
    }
  };

  const copiarCodigo = () => {
    navigator.clipboard.writeText(codigo);
    setCopiado(true); setTimeout(()=>setCopiado(false),2000);
  };

  const jugadoresList = gameData ? Object.values(gameData.jugadores||{}).sort((a,b)=>b.puntos-a.puntos) : [];
  const respsActuales = gameData ? Object.entries(gameData.respuestasRonda||{}) : [];
  const preg = gameData?.preguntas?.[gameData?.indicePregunta];
  // ── SETUP ──
  if (liveStep==='setup') return (
    <div style={{ maxWidth:440,margin:'0 auto',padding:'28px 20px' }}>
      <button onClick={onBack} style={{ background:'none',border:'none',color:dark.muted,cursor:'pointer',marginBottom:16 }}>← Volver</button>
      <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:'28px 24px',color:dark.text }}>
        <h2 style={{ margin:'0 0 20px',fontSize:'1.3rem',fontWeight:800 }}>🏆 Crear reto online</h2>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div>
            <label style={{ fontSize:'0.78rem',color:dark.muted,fontWeight:600,display:'block',marginBottom:4 }}>Tu nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del profesor"
              style={{ padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.06)',color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box' }}/>
          </div>
          {[
            ['Nivel','level','select',[['sencillo','Sencillo'],['medio','Medio'],['dificil','Difícil']]],
            ['Número de rondas (filas)','numRows','number',null],
            ['Tiempo por ronda (seg)','timePerRow','number',null],
            ['Columnas','columnsMode','select',[['all','4 columnas (0-3 pts)'],['no_translation','Sin traducción (0-2 pts)'],['base_past','Solo Base y Past (0-1 pts)']]],
          ].map(([lbl,key,type,opts])=>(
            <div key={key}>
              <label style={{ fontSize:'0.78rem',color:dark.muted,fontWeight:600,display:'block',marginBottom:4 }}>{lbl}</label>
              {type==='select'?(
                <select value={cfg[key]} onChange={e=>setCfg({...cfg,[key]:e.target.value})}
                  style={{ padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.06)',color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box' }}>
                  {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              ):(
                <input type="number" value={cfg[key]} min={1}
                  onChange={e=>setCfg({...cfg,[key]:parseInt(e.target.value)||1})}
                  style={{ padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.06)',color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box' }}/>
              )}
            </div>
          ))}
          <BtnPrimary onClick={crearSala} style={{ marginTop:8 }}>Crear sala</BtnPrimary>
        </div>
      </div>
    </div>
  );

  // ── LOBBY HOST ──
  if (liveStep==='lobby') return (
    <div style={{ maxWidth:520,margin:'0 auto',padding:24,color:dark.text }}>
      <div style={{ textAlign:'center',background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:28 }}>
        <div style={{ fontSize:'0.9rem',color:dark.muted,marginBottom:8 }}>Código de sala</div>
        <div style={{ fontSize:'3.5rem',fontWeight:900,letterSpacing:12,color:'#a78bfa',marginBottom:14 }}>{codigo}</div>
        <button onClick={copiarCodigo}
          style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:10,border:`1px solid ${dark.border}`,
            background:'rgba(255,255,255,0.06)',color:dark.text,fontWeight:600,cursor:'pointer',marginBottom:24 }}>
          {copiado?<Check size={15}/>:<Copy size={15}/>} {copiado?'Copiado':'Copiar código'}
        </button>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.85rem',color:dark.muted,marginBottom:10 }}>
            <Users size={14} style={{ verticalAlign:'middle',marginRight:4 }}/>
            {jugadoresList.length} alumno{jugadoresList.length!==1?'s':''} conectado{jugadoresList.length!==1?'s':''}
          </div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center' }}>
            {jugadoresList.map(j=>(
              <div key={j.uid} style={{ padding:'6px 14px',borderRadius:20,background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.4)',fontSize:'0.85rem' }}>{j.nombre}</div>
            ))}
            {jugadoresList.length===0 && <div style={{ color:dark.muted,fontSize:'0.85rem' }}>Esperando jugadores…</div>}
          </div>
        </div>
        <BtnPrimary onClick={iniciarJuego} disabled={jugadoresList.length===0}>
          <Play size={16} style={{ marginRight:6 }}/> Iniciar juego ({jugadoresList.length} jugadores)
        </BtnPrimary>
      </div>
    </div>
  );

  // ── GAME HOST ──
  if (liveStep==='game' && gameData?.estado==='JUEGO' && preg) {
    const fase = gameData.fasePregunta;
    return (
      <div style={{ maxWidth:700,margin:'0 auto',padding:'16px 20px',color:dark.text }}>
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div style={{ fontSize:'0.9rem',color:dark.muted }}>
            Ronda <b style={{ color:dark.text }}>{gameData.indicePregunta+1}</b> / {gameData.preguntas.length}
          </div>
          <div style={{ fontFamily:'monospace',fontWeight:700,fontSize:'1.2rem',color:timer<=5?'#f87171':'#6ee7b7' }}>
            ⏱ {timer}s
          </div>
          <div style={{ fontSize:'0.85rem',color:dark.muted }}>{respsActuales.length}/{jugadoresList.length} resp.</div>
        </div>

        {/* Verbo - fila */}
        <div style={{ background:dark.card,borderRadius:16,border:`1px solid ${dark.border}`,padding:'18px 20px',marginBottom:16 }}>
          <div style={{ display:'grid',gridTemplateColumns:`repeat(${getActiveCols(cfg.columnsMode).length},1fr)`,gap:10 }}>
            {getActiveCols(cfg.columnsMode).map(col=>{
              const given = col===preg.givenCol;
              return (
                <div key={col} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'0.7rem',color:dark.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>{COL_LABELS[col]}</div>
                  <div style={{ padding:'10px',borderRadius:10,fontWeight:given?700:400,
                    background:given?'rgba(108,99,255,0.25)':'rgba(255,255,255,0.04)',
                    border:`1px solid ${given?'rgba(108,99,255,0.5)':dark.border}`,
                    color:given?'#c4b5fd':'rgba(255,255,255,0.35)' }}>
                    {given ? preg.verbData[col] : (fase==='RESULTADOS' ? <span style={{ color:'#6ee7b7' }}>{preg.verbData[col]}</span> : '?')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Avatar Pi + Stats */}
        <div style={{ display:'flex',gap:14,marginBottom:14 }}>
          <img src={avatarMood==='happy'?piHappy:avatarMood==='angry'?piAngry:piNeutral} alt="Pi"
            style={{ width:60,height:60,objectFit:'contain' }}/>
          <div style={{ flex:1,display:'flex',flexDirection:'column',gap:6,justifyContent:'center' }}>
            {fase==='RESULTADOS' && respsActuales.map(([uid,r])=>{
              const j = gameData.jugadores?.[uid];
              return (
                <div key={uid} style={{ display:'flex',justifyContent:'space-between',background:'rgba(255,255,255,0.04)',
                  borderRadius:8,padding:'5px 10px',fontSize:'0.82rem' }}>
                  <span>{j?.nombre||uid}</span>
                  <span style={{ fontWeight:700,color:r.puntos>0?'#6ee7b7':'#fca5a5' }}>+{r.puntos} pts</span>
                </div>
              );
            })}
            {fase==='RESPONDING' && (
              <div style={{ color:dark.muted,fontSize:'0.85rem' }}>Esperando respuestas…</div>
            )}
          </div>
        </div>

        {/* Ranking lateral */}
        <div style={{ background:dark.card,borderRadius:14,border:`1px solid ${dark.border}`,padding:'14px 16px',marginBottom:16 }}>
          <div style={{ fontSize:'0.8rem',color:dark.muted,marginBottom:10,fontWeight:700 }}>🏅 Clasificación</div>
          {jugadoresList.map((j,i)=>(
            <div key={j.uid||i} style={{ display:'flex',alignItems:'center',gap:10,padding:'5px 0',borderBottom:`1px solid ${dark.border}` }}>
              <span style={{ fontSize:'0.85rem',color:dark.muted,width:18 }}>{i+1}.</span>
              <span style={{ flex:1,fontSize:'0.9rem' }}>{j.nombre}</span>
              <span style={{ fontWeight:700,color:'#a78bfa' }}>{j.puntos||0}</span>
            </div>
          ))}
        </div>

        <button onClick={siguiente}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:'linear-gradient(135deg,#6c63ff,#a855f7)',color:'white',fontWeight:700,fontSize:'1rem',cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
          {fase==='RESPONDING' ? '⏭ Revelar respuestas' : gameData.indicePregunta+1 < gameData.preguntas.length ? 'Siguiente ronda →' : '🏁 Ver resultados finales'}
        </button>
      </div>
    );
  }

  // ── FIN HOST ──
  if (liveStep==='fin' || gameData?.estado==='FIN') {
    const maxPtsMap = { all:3, no_translation:2, base_past:1 };
    const totalMax  = (gameData?.preguntas?.length||0) * (maxPtsMap[gameData?.config?.columnsMode]||3);
    return (
      <>
        {showEnviarHost && (
          <ModalEnviarProfeHost
            onClose={()=>setShowEnviarHost(false)}
            jugadores={jugadoresList}
            preguntas={gameData?.preguntas||[]}
            config={gameData?.config||{}}
          />
        )}
        <div style={{ maxWidth:500,margin:'0 auto',padding:24,color:dark.text }}>
          <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:28,textAlign:'center' }}>
            <div style={{ fontSize:56,marginBottom:10 }}>🏆</div>
            <h2 style={{ margin:'0 0 20px',color:'#fbbf24' }}>¡Reto finalizado!</h2>
            {jugadoresList.map((j,i)=>{
              const pct = totalMax>0 ? Math.round((j.puntos||0)/totalMax*100) : 0;
              return (
                <div key={j.uid||i} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,
                  background:i===0?'rgba(251,191,36,0.12)':'rgba(255,255,255,0.03)',
                  border:`1px solid ${i===0?'rgba(251,191,36,0.3)':dark.border}`,marginBottom:8 }}>
                  <span style={{ fontSize:'1.1rem' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '}</span>
                  <span style={{ flex:1,fontWeight:700,textAlign:'left' }}>{j.nombre}</span>
                  <span style={{ fontWeight:700,color:i===0?'#fbbf24':'#a78bfa',minWidth:48 }}>{j.puntos||0} pts</span>
                  <span style={{ fontSize:'0.82rem',fontWeight:700,minWidth:38,textAlign:'right',
                    color:pct>=60?'#6ee7b7':pct>=40?'#fbbf24':'#fca5a5' }}>{pct}%</span>
                </div>
              );
            })}
            <div style={{ display:'flex',gap:10,marginTop:20,flexWrap:'wrap',justifyContent:'center' }}>
              <button onClick={()=>setShowEnviarHost(true)}
                style={{ padding:'11px 20px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'white',fontWeight:700,cursor:'pointer' }}>
                📤 Enviar al profesor
              </button>
              <button onClick={onBack}
                style={{ padding:'11px 20px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#6c63ff,#a855f7)',color:'white',fontWeight:700,cursor:'pointer' }}>
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}

// ── LIVE CLIENT ───────────────────────────────────────────────────────────────
function LiveClient({ onBack }) {
  const [joinStep, setJoinStep] = useState('form'); // form | game
  const [nombre,   setNombre]   = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [codigo,   setCodigo]   = useState('');
  const [gameData, setGameData] = useState(null);
  const [myId]     = useState(getOrCreateClientId);
  const [answers,  setAnswers]  = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [timer,    setTimer]    = useState(0);
  const [puntosDelta, setPuntosDelta] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!codigo) return;
    const unsub = onSnapshot(doc(db,'live_games',codigo), snap=>{
      if (snap.exists()) setGameData(snap.data());
    });
    return ()=>unsub();
  }, [codigo]);

  // Reset al cambiar de ronda
  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setPuntosDelta(null);
  }, [gameData?.indicePregunta]);

  // Timer local
  useEffect(()=>{
    if (gameData?.estado==='JUEGO' && gameData?.fasePregunta==='RESPONDING') {
      const inicio = gameData.questionStartTime||Date.now();
      const total  = gameData.config?.timePerRow||30;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(()=>{
        const r = Math.max(0, total - Math.ceil((Date.now()-inicio)/1000));
        setTimer(r);
      },500);
    } else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  },[gameData?.indicePregunta, gameData?.fasePregunta, gameData?.questionStartTime]);

  // Ver puntos obtenidos al revelar
  useEffect(()=>{
    if (gameData?.fasePregunta==='RESULTADOS') {
      const r = gameData.respuestasRonda?.[myId];
      if (r?.processed) {
        setPuntosDelta(r.puntos);
        if (r.puntos>0) safePlay(audioCorrect); else safePlay(audioWrong);
      }
    }
  },[gameData?.fasePregunta]);

  const unirse = async () => {
    const code = codigoInput.trim().toUpperCase();
    if (!nombre.trim() || !code) return alert('Introduce tu nombre y el código.');
    const snap = await getDoc(doc(db,'live_games',code));
    if (!snap.exists()) return alert('Código no encontrado.');
    await updateDoc(doc(db,'live_games',code), {
      [`jugadores.${myId}`]: { uid:myId, nombre:nombre.trim(), puntos:0 }
    });
    setCodigo(code);
    setJoinStep('game');
  };

  const enviarRespuestas = async () => {
    if (submitted || !gameData || gameData.fasePregunta!=='RESPONDING') return;
    setSubmitted(true);
    await updateDoc(doc(db,'live_games',codigo), {
      [`respuestasRonda.${myId}`]: { answers, puntos:0, processed:false, uid:myId }
    });
  };

  const preg   = gameData?.preguntas?.[gameData?.indicePregunta];
  const myData = gameData?.jugadores?.[myId];
  const jugadoresList = gameData ? Object.values(gameData.jugadores||{}).sort((a,b)=>b.puntos-a.puntos) : [];
  const miPosicion = jugadoresList.findIndex(j=>j.uid===myId);
  const cols = preg ? getActiveCols(gameData.config?.columnsMode||'all') : [];
  const filledCols = cols.filter(c=>c!==preg?.givenCol);

  if (joinStep==='form') return (
    <div style={{ maxWidth:400,margin:'0 auto',padding:'28px 20px' }}>
      <button onClick={onBack} style={{ background:'none',border:'none',color:dark.muted,cursor:'pointer',marginBottom:16 }}>← Volver</button>
      <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:'28px 24px',color:dark.text }}>
        <h2 style={{ margin:'0 0 20px',fontSize:'1.3rem',fontWeight:800 }}>🚀 Unirse a un reto</h2>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {[['Tu nombre','text',nombre,setNombre,'Tu nombre completo'],
            ['Código de sala','text',codigoInput,v=>setCodigoInput(v.toUpperCase()),'Ej: AB12CD']
          ].map(([lbl,type,val,set,ph])=>(
            <div key={lbl}>
              <label style={{ fontSize:'0.78rem',color:dark.muted,fontWeight:600,display:'block',marginBottom:4 }}>{lbl}</label>
              <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                style={{ padding:'9px 12px',borderRadius:9,border:`1.5px solid ${dark.border}`,background:'rgba(255,255,255,0.06)',
                  color:dark.text,fontSize:'0.9rem',width:'100%',boxSizing:'border-box',letterSpacing:lbl.includes('Código')?4:0,fontWeight:lbl.includes('Código')?700:400 }}
                onKeyDown={e=>e.key==='Enter'&&unirse()}/>
            </div>
          ))}
          <BtnPrimary onClick={unirse} style={{ marginTop:4 }}>Entrar</BtnPrimary>
        </div>
      </div>
    </div>
  );

  if (!gameData) return <div style={{ textAlign:'center',padding:40,color:dark.muted }}>Conectando…</div>;

  // Lobby espera
  if (gameData.estado==='LOBBY') return (
    <div style={{ maxWidth:420,margin:'0 auto',padding:28,textAlign:'center',color:dark.text }}>
      <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:28 }}>
        <img src={piNeutral} alt="Pi" style={{ width:80,marginBottom:12 }}/>
        <h3 style={{ margin:'0 0 6px',color:'#a78bfa' }}>¡Sala unida!</h3>
        <div style={{ color:dark.muted,marginBottom:16 }}>Esperando a que el profesor inicie el juego…</div>
        <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:20,background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.4)' }}>
          <Users size={14}/> {jugadoresList.length} conectado{jugadoresList.length!==1?'s':''}
        </div>
      </div>
    </div>
  );

  // FIN
  if (gameData.estado==='FIN') {
    const pos = miPosicion+1;
    return (
      <div style={{ maxWidth:420,margin:'0 auto',padding:24,color:dark.text }}>
        <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:20,padding:28,textAlign:'center' }}>
          <img src={pos===1?piHappy:piNeutral} alt="Pi" style={{ width:80,marginBottom:12 }}/>
          <h2 style={{ margin:'0 0 6px',color:'#fbbf24' }}>¡Reto terminado!</h2>
          <div style={{ fontSize:'1.3rem',fontWeight:700,marginBottom:4,color:'#a78bfa' }}>
            {myData?.puntos||0} puntos
          </div>
          <div style={{ color:dark.muted,marginBottom:20 }}>Posición {pos} de {jugadoresList.length}</div>
          {jugadoresList.map((j,i)=>(
            <div key={j.uid||i} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:10,
              background:j.uid===myId?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',marginBottom:6 }}>
              <span style={{ fontSize:'1rem' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '}</span>
              <span style={{ flex:1,fontSize:'0.9rem',fontWeight:j.uid===myId?700:400 }}>{j.nombre}</span>
              <span style={{ fontWeight:700,color:j.uid===myId?'#a78bfa':dark.muted }}>{j.puntos||0}</span>
            </div>
          ))}
          <button onClick={onBack} style={{ marginTop:16,padding:'12px 28px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#6c63ff,#a855f7)',color:'white',fontWeight:700,cursor:'pointer' }}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // JUEGO
  if (gameData.estado==='JUEGO' && preg) {
    const fase    = gameData.fasePregunta;
    const revelar = fase==='RESULTADOS';
    return (
      <div style={{ maxWidth:520,margin:'0 auto',padding:'16px 20px',color:dark.text }}>
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div style={{ fontSize:'0.85rem',color:dark.muted }}>Ronda {gameData.indicePregunta+1}/{gameData.preguntas.length}</div>
          {!submitted && fase==='RESPONDING' && (
            <div style={{ fontFamily:'monospace',fontWeight:700,fontSize:'1.1rem',color:timer<=5?'#f87171':'#6ee7b7' }}>⏱ {timer}s</div>
          )}
          <div style={{ fontWeight:700,color:'#a78bfa' }}>{myData?.puntos||0} pts</div>
        </div>

        {/* Pregunta: fila de verbos */}
        <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:16,padding:'20px 18px',marginBottom:16 }}>
          <div style={{ display:'grid',gridTemplateColumns:`repeat(${cols.length},1fr)`,gap:10,marginBottom:16 }}>
            {cols.map(col=>{
              const given = col===preg.givenCol;
              const ans   = answers[col]||'';
              let bg='rgba(255,255,255,0.04)', border=dark.border, color=dark.text, fw=400;
              if (given) { bg='rgba(108,99,255,0.2)'; border='rgba(108,99,255,0.5)'; color='#c4b5fd'; fw=700; }
              else if (revelar) {
                const ok = isCorrect(ans, preg.verbData[col]);
                bg    = ok?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.12)';
                border= ok?'rgba(16,185,129,0.5)':'rgba(239,68,68,0.5)';
                color = ok?'#6ee7b7':'#fca5a5';
                fw    = 700;
              }
              return (
                <div key={col}>
                  <div style={{ fontSize:'0.68rem',color:dark.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>{COL_LABELS[col]}</div>
                  {given ? (
                    <div style={{ padding:'10px 12px',borderRadius:10,background:bg,border:`1.5px solid ${border}`,color,fontWeight:fw,textAlign:'center' }}>
                      {preg.verbData[col]}
                    </div>
                  ) : (
                    <>
                      <input type="text" value={ans}
                        onChange={e=>setAnswers(p=>({...p,[col]:e.target.value}))}
                        disabled={submitted||revelar}
                        placeholder="…"
                        style={{ width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${border}`,
                          background:bg,color,fontWeight:fw,fontSize:'0.9rem',outline:'none',boxSizing:'border-box',
                          textDecoration:revelar&&!isCorrect(ans,preg.verbData[col])?'line-through':'none' }}/>
                      {revelar && !isCorrect(ans,preg.verbData[col]) && (
                        <div style={{ fontSize:'0.78rem',color:'#6ee7b7',marginTop:3,fontWeight:700 }}>{preg.verbData[col]}</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Puntos obtenidos */}
          {revelar && puntosDelta !== null && (
            <div style={{ textAlign:'center',padding:'12px',borderRadius:12,
              background:puntosDelta>0?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.1)',
              border:`1px solid ${puntosDelta>0?'rgba(16,185,129,0.4)':'rgba(239,68,68,0.3)'}` }}>
              <span style={{ fontWeight:800,fontSize:'1.3rem',color:puntosDelta>0?'#6ee7b7':'#fca5a5' }}>
                {puntosDelta>0?'+':''}{puntosDelta} / {filledCols.length} puntos
              </span>
              <span style={{ fontSize:'0.85rem',color:dark.muted,marginLeft:10 }}>en esta ronda</span>
            </div>
          )}

          {!revelar && !submitted && (
            <BtnPrimary onClick={enviarRespuestas} style={{ width:'100%',marginTop:8 }}>Enviar respuestas</BtnPrimary>
          )}
          {!revelar && submitted && (
            <div style={{ textAlign:'center',padding:'12px',borderRadius:12,background:'rgba(108,99,255,0.1)',border:`1px solid rgba(108,99,255,0.3)`,color:'#a78bfa',fontWeight:600 }}>
              ✓ Respuestas enviadas, esperando…
            </div>
          )}
        </div>

        {/* Mini ranking */}
        <div style={{ background:dark.card,border:`1px solid ${dark.border}`,borderRadius:14,padding:'12px 14px' }}>
          <div style={{ fontSize:'0.78rem',color:dark.muted,marginBottom:8,fontWeight:700 }}>🏅 Clasificación</div>
          {jugadoresList.slice(0,5).map((j,i)=>(
            <div key={j.uid||i} style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 0',fontSize:'0.82rem',
              fontWeight:j.uid===myId?700:400, color:j.uid===myId?'#a78bfa':dark.text }}>
              <span style={{ width:16,color:dark.muted }}>{i+1}.</span>
              <span style={{ flex:1 }}>{j.nombre}{j.uid===myId?' (tú)':''}</span>
              <span style={{ fontWeight:700 }}>{j.puntos||0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div style={{ textAlign:'center',padding:40,color:dark.muted }}>Cargando…</div>;
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function IrregularVerbsTest({ initialConfig }) {
  const [mode, setMode] = useState('home');
  const [soloCfg, setSoloCfg] = useState(null);

  const goHome = () => setMode('home');
  const baseUrl = `${window.location.origin}${window.location.pathname}?juego=irregular_verbs`;

  if (mode==='home')        return <HomeScreen onSolo={()=>setMode('solo_config')} onHostLive={()=>setMode('live_host')} onJoinLive={()=>setMode('live_client')} shareUrl={baseUrl}/>;
  if (mode==='solo_config') return <SoloConfig onStart={cfg=>{setSoloCfg(cfg);setMode('solo_test');}} onBack={goHome} initialConfig={initialConfig}/>;
  if (mode==='solo_test')   return <SoloTest cfg={soloCfg} onBack={()=>setMode('solo_config')}/>;
  if (mode==='live_host')   return <LiveHost onBack={goHome}/>;
  if (mode==='live_client') return <LiveClient onBack={goHome}/>;
  return null;
}
