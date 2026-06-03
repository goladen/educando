import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import imgBarcoRojo  from './assets/BarcoRojo.png';
import imgBarcoAzul  from './assets/BarcoAzul.png';
import imgFondoMarino from './assets/FondoMarino.png';
import sndCorrecto from './assets/correct-choice-43861.mp3';
import sndFallo    from './assets/negative_beeps-6008.mp3';
import sndDisparo  from './assets/disparocanon.mp3';
import sndImpacto  from './assets/sonidoaciertoBlanco.mp3';
import sndAgua     from './assets/sonidomonedamal.mp3';
import sndMusica   from './assets/musicafondopiratas.mp3';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const VIDAS_MAX    = 10;
const ANGULO_MIN   = -55;
const ANGULO_MAX   = 55;
const ANGULO_SPEED = 0.7;
const HIT_ZONE_DEG = 25;
const BALA_SPEED   = 0.014;
const COOLDOWN_MS  = 1800;
const FLAME_FRAMES = 210;
const COLORES      = ['#c0392b', '#1a6eb5'];
const NOMBRES      = ['Barco Rojo', 'Barco Azul'];

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS_ANIM = `
  @keyframes dp-hitText { 0% { opacity:1; transform:translateY(0) scale(1); } 100% { opacity:0; transform:translateY(-70px) scale(1.5); } }
  @keyframes dp-sway    { 0% { transform:rotate(-1.8deg) translateY(0px); } 50% { transform:rotate(1.8deg) translateY(-4px); } 100% { transform:rotate(-1.8deg) translateY(0px); } }
  @keyframes dp-rock    { 0% { transform:rotate(0deg) translateY(0px); } 12% { transform:rotate(-11deg) translateY(-7px); } 28% { transform:rotate(9deg) translateY(-4px); } 46% { transform:rotate(-6deg) translateY(-2px); } 62% { transform:rotate(5deg) translateY(-1px); } 78% { transform:rotate(-2.5deg) translateY(0px); } 90% { transform:rotate(1.5deg) translateY(0px); } 100% { transform:rotate(-1.8deg) translateY(0px); } }
  .dp-sway      { animation: dp-sway 3.6s ease-in-out infinite; }
  .dp-ship-rock { animation: dp-rock 0.95s ease-out forwards !important; }
`;

// ─── LOAD RESOURCE ───────────────────────────────────────────────────────────
async function cargarRecurso(codigo) {
  const q = query(collection(db, 'resources'), where('accessCode', '==', codigo.toUpperCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Código no encontrado');
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ─── NORMALIZE QUESTIONS ─────────────────────────────────────────────────────
// Returns [{display, respuesta, opciones: string[]|null}]
function normalizarPreguntas(recurso) {
  let raw = [];
  if (Array.isArray(recurso.preguntas)) raw = recurso.preguntas;
  else if (Array.isArray(recurso.hojas) && recurso.hojas[0]?.preguntas) raw = recurso.hojas[0].preguntas;

  const items = raw.map(p => {
    if (!p) return null;
    // Standard: pregunta + respuesta
    if (p.pregunta !== undefined && p.respuesta !== undefined)
      return { display: String(p.pregunta), respuesta: String(p.respuesta), opciones: Array.isArray(p.opciones) ? p.opciones.map(String) : null };
    // Aparejados: termino + definicion
    if (p.termino !== undefined && p.definicion !== undefined)
      return { display: String(p.definicion), respuesta: String(p.termino), opciones: null };
    // Pasapalabra: pista + respuesta
    if (p.pista !== undefined && p.respuesta !== undefined)
      return { display: (p.letra ? `[${String(p.letra).toUpperCase()}] ` : '') + String(p.pista), respuesta: String(p.respuesta), opciones: null };
    return null;
  }).filter(Boolean);

  const esPasapalabra = recurso.tipoJuego === 'PASAPALABRA';
  if (esPasapalabra) return items; // text-input mode

  // For all other types without opciones: generate 2 wrong options from pool
  return items.map((item, idx) => {
    if (item.opciones) return item;
    const wrongs = items
      .filter((_, i) => i !== idx)
      .map(p => p.respuesta)
      .filter((r, i, arr) => arr.indexOf(r) === i && r !== item.respuesta)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const opts = Array.from(new Set([item.respuesta, ...wrongs])).sort(() => Math.random() - 0.5);
    return { ...item, opciones: opts };
  });
}

// ─── FIREBASE SAVE ────────────────────────────────────────────────────────────
async function guardarPartida(data) {
  try { await addDoc(collection(db, 'duelo_piratas'), { ...data, timestamp: serverTimestamp() }); }
  catch(e) { console.error('[DueloPiratasRecurso]', e); }
}

// ─── SHIP COLUMN ─────────────────────────────────────────────────────────────
function ShipColumn({ playerId, side, vidas, shipRef, cañonRef, muzzleRef }) {
  const color   = COLORES[playerId];
  const label   = playerId === 0 ? '🔴 ROJO' : '🔵 AZUL';
  const img     = playerId === 0 ? imgBarcoRojo : imgBarcoAzul;
  const isRight = side === 'right';

  const mountWrapStyle  = isRight ? { position:'absolute', left:'14%', top:'60%' } : { position:'absolute', right:'14%', top:'60%' };
  const cannonBase      = { position:'absolute', width:'clamp(38px,5.5vw,56px)', height:13, background:'linear-gradient(to bottom,#6a6a6a,#1c1c1c)', boxShadow:'0 2px 6px rgba(0,0,0,0.7)', transformOrigin:isRight?'right center':'left center', borderRadius:isRight?'5px 2px 2px 5px':'2px 5px 5px 2px' };
  const cannonInnerStyle = isRight ? { right:0, top:'-6px', ...cannonBase } : { left:0, top:'-6px', ...cannonBase };
  const muzzleStyle     = isRight ? { position:'absolute', left:0,  top:'50%', transform:'translateY(-50%)', width:2, height:2, pointerEvents:'none' } : { position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', width:2, height:2, pointerEvents:'none' };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'10px clamp(8px,2vw,20px) 0'}}>
      <div style={{background:`${color}cc`,color:'white',fontWeight:800,fontSize:'clamp(0.7rem,1.3vw,0.9rem)',borderRadius:8,padding:'4px 12px',marginBottom:5,backdropFilter:'blur(4px)',whiteSpace:'nowrap'}}>
        {label} · {vidas} vidas
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center',maxWidth:190,marginBottom:4}}>
        {Array.from({length:VIDAS_MAX}).map((_,i) => (
          <span key={i} style={{fontSize:'clamp(0.7rem,1.4vw,1rem)',opacity:i<vidas?1:0.12,transition:'opacity 0.3s'}}>❤️</span>
        ))}
      </div>
      <div style={{flex:1}}/>
      <div ref={shipRef} className="dp-sway" style={{position:'relative',display:'inline-block',marginBottom:'-8px'}}>
        <img src={img} alt={NOMBRES[playerId]} style={{width:'clamp(120px,17vw,210px)',height:'auto',display:'block',filter:vidas<=3?'drop-shadow(0 0 14px rgba(255,50,50,.95))':'drop-shadow(0 6px 10px rgba(0,0,0,0.6))',transition:'filter 0.35s'}}/>
        <div style={mountWrapStyle}>
          <div ref={cañonRef} style={cannonInnerStyle}>
            <div ref={muzzleRef} style={muzzleStyle}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONTROL PANEL ───────────────────────────────────────────────────────────
function ControlPanel({ playerId, pregunta, cooldown, aimRef, onRespuesta, hitStart, hitWidth }) {
  const color = COLORES[playerId];
  const [texto, setTexto] = useState('');
  const tieneOpciones = Array.isArray(pregunta?.opciones) && pregunta.opciones.length > 0;

  // Clear text when question changes
  useEffect(() => { setTexto(''); }, [pregunta?.display]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!texto.trim() || cooldown) return;
    onRespuesta(texto.trim());
    setTexto('');
  };

  return (
    <div style={{flex:1,position:'relative',overflow:'hidden',background:`linear-gradient(135deg,${color}1a 0%,${color}09 100%)`,border:`2px solid ${color}55`,borderRadius:14,padding:'8px 10px'}}>
      {cooldown && (
        <div style={{position:'absolute',inset:0,zIndex:8,background:'rgba(0,0,0,.78)',borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#ff5252',fontWeight:900,gap:6}}>
          <span style={{fontSize:'1.8rem'}}>⏳</span>
          <span style={{fontSize:'0.9rem'}}>Penalización...</span>
        </div>
      )}

      {/* Aim meter */}
      <div style={{marginBottom:6}}>
        <div style={{fontSize:'0.58rem',color:'#888',textAlign:'center',marginBottom:2}}>Zona de disparo</div>
        <div style={{position:'relative',height:16,background:'rgba(0,0,0,.45)',borderRadius:8,overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,bottom:0,left:`${hitStart}%`,width:`${hitWidth}%`,background:'rgba(0,230,118,.22)',borderLeft:'1px solid rgba(0,230,118,.6)',borderRight:'1px solid rgba(0,230,118,.6)'}}/>
          <div ref={aimRef} style={{position:'absolute',top:1,bottom:1,width:4,borderRadius:2,background:'#ff5252',transform:'translateX(-50%)'}}/>
        </div>
      </div>

      {/* Question */}
      <div style={{textAlign:'center',marginBottom:8,minHeight:40,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>
        <div style={{fontSize:'clamp(0.82rem,1.6vw,1.05rem)',fontWeight:800,color:'white',wordBreak:'break-word',lineHeight:1.3}}>
          {pregunta?.display ?? '...'}
        </div>
      </div>

      {/* Answer: buttons or text input */}
      {tieneOpciones ? (
        <div style={{display:'flex',gap:'clamp(4px,1vw,10px)',justifyContent:'center',flexWrap:'wrap'}}>
          {pregunta.opciones.map((op, i) => (
            <button key={i} onClick={() => onRespuesta(op)}
              style={{
                flex:'1 1 auto', maxWidth:'33%', minWidth:'clamp(38px,5vw,56px)',
                padding:'clamp(5px,1vw,9px) clamp(3px,0.8vw,7px)',
                borderRadius:8, border:`2px solid ${color}`,
                background:'rgba(255,255,255,.94)', color, fontWeight:800,
                fontSize:'clamp(0.72rem,1.1vw,0.9rem)', cursor:'pointer',
                boxShadow:`0 3px 10px ${color}44`, transition:'transform 0.1s',
                wordBreak:'break-word', lineHeight:1.2, textAlign:'center',
              }}
              onPointerDown={e => e.currentTarget.style.transform='scale(0.87)'}
              onPointerUp={e =>   e.currentTarget.style.transform='scale(1)'}
              onPointerLeave={e => e.currentTarget.style.transform='scale(1)'}
            >{op}</button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{display:'flex',gap:6}}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            disabled={!!cooldown}
            placeholder="Escribe tu respuesta…"
            style={{
              flex:1, padding:'8px 10px', borderRadius:8,
              border:`2px solid ${color}88`, background:'rgba(255,255,255,.92)',
              fontSize:'clamp(0.78rem,1.1vw,0.95rem)', outline:'none',
              color:'#1a1a2e', fontWeight:600,
            }}
          />
          <button type="submit" disabled={!!cooldown || !texto.trim()}
            style={{
              padding:'8px 13px', borderRadius:8, border:'none',
              background:cooldown?'rgba(255,255,255,0.15)':color,
              color:'white', fontWeight:900, fontSize:'1.1rem',
              cursor:cooldown?'not-allowed':'pointer', transition:'background 0.2s',
            }}>⚡</button>
        </form>
      )}
    </div>
  );
}

// ─── MENU SCREEN ─────────────────────────────────────────────────────────────
function MenuPantalla({ onStart, onExit }) {
  const [codigo,   setCodigo]   = useState('');
  const [buscando, setBuscando] = useState(false);
  const [recurso,  setRecurso]  = useState(null);
  const [error,    setError]    = useState('');

  const buscar = async () => {
    if (!codigo.trim()) return;
    setBuscando(true); setError(''); setRecurso(null);
    try { setRecurso(await cargarRecurso(codigo)); }
    catch(e) { setError(e.message || 'Error al cargar el recurso'); }
    setBuscando(false);
  };

  const pregsCount = recurso
    ? Array.isArray(recurso.preguntas) ? recurso.preguntas.length
    : (Array.isArray(recurso.hojas) && recurso.hojas[0]?.preguntas ? recurso.hojas[0].preguntas.length : 0)
    : 0;

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'linear-gradient(180deg,#07111f 0%,#0e2a44 45%,#0a4060 100%)',display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',padding:'24px 16px 32px'}}>
      <style>{CSS_ANIM}</style>

      <div style={{textAlign:'center',marginBottom:24}}>
        <div style={{fontSize:'2.5rem',marginBottom:6}}>⚓ 🏴‍☠️ ⚓</div>
        <h1 style={{margin:0,color:'#f9c74f',fontSize:'clamp(1.8rem,5vw,2.8rem)',fontFamily:'Georgia,serif',textShadow:'0 0 24px rgba(249,199,79,.55),2px 2px 0 #7a4f00'}}>
          Duelo de Piratas
        </h1>
        <p style={{color:'#94d2bd',margin:'6px 0 0',fontSize:'0.9rem'}}>Carga cualquier recurso del aula · ¡a cañonazos!</p>
      </div>

      {/* Code input */}
      <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',borderRadius:14,padding:'18px',marginBottom:18,maxWidth:420,width:'100%'}}>
        <div style={{color:'rgba(255,255,255,0.65)',fontSize:'0.82rem',marginBottom:8,fontWeight:600}}>📋 Código del recurso (4-5 letras)</div>
        <div style={{display:'flex',gap:8}}>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5))}
            onKeyDown={e => e.key==='Enter' && buscar()}
            placeholder="Ej: AB12C"
            maxLength={5}
            style={{
              flex:1, padding:'11px 14px', borderRadius:10,
              border:'2px solid rgba(249,199,79,0.45)', background:'rgba(255,255,255,0.08)',
              color:'white', fontSize:'1.3rem', letterSpacing:5, textAlign:'center',
              fontWeight:800, outline:'none',
            }}
          />
          <button onClick={buscar} disabled={buscando || codigo.length < 4}
            style={{
              padding:'11px 18px', borderRadius:10, border:'none',
              background:codigo.length<4?'rgba(255,255,255,0.08)':'#f9c74f',
              color:codigo.length<4?'#555':'#1a1a1a',
              fontWeight:800, fontSize:'0.88rem', cursor:codigo.length<4?'not-allowed':'pointer',
            }}>
            {buscando?'⏳':'🔍 Buscar'}
          </button>
        </div>
        {error && <div style={{color:'#ff5252',fontSize:'0.82rem',marginTop:8}}>⚠️ {error}</div>}
      </div>

      {/* Resource info */}
      {recurso && (
        <div style={{background:'rgba(249,199,79,0.1)',border:'2px solid rgba(249,199,79,0.4)',borderRadius:14,padding:'16px 20px',marginBottom:18,maxWidth:420,width:'100%',textAlign:'center'}}>
          <div style={{fontSize:'1.4rem',marginBottom:5}}>📚</div>
          <div style={{color:'#f9c74f',fontWeight:800,fontSize:'1rem',marginBottom:3}}>{recurso.titulo||recurso.nombre||'Recurso'}</div>
          <div style={{color:'#94d2bd',fontSize:'0.82rem',marginBottom:3}}>{recurso.tipoJuego} · {pregsCount} preguntas</div>
          {recurso.tipoJuego === 'PASAPALABRA'
            ? <div style={{color:'rgba(255,255,255,0.5)',fontSize:'0.75rem',marginBottom:10}}>🖊️ Modo escritura — cada jugador escribe su respuesta</div>
            : <div style={{color:'rgba(255,255,255,0.5)',fontSize:'0.75rem',marginBottom:10}}>🔘 Modo botones — opciones de respuesta generadas automáticamente</div>
          }
          {pregsCount < 3
            ? <div style={{color:'#ff5252',fontSize:'0.8rem'}}>⚠️ Se necesitan al menos 3 preguntas</div>
            : <button onClick={() => onStart(recurso)}
                style={{background:'linear-gradient(135deg,#f9c74f,#f4a261)',color:'#1a1a1a',border:'none',borderRadius:10,padding:'11px 28px',fontWeight:900,fontSize:'0.95rem',cursor:'pointer',boxShadow:'0 4px 14px rgba(249,199,79,0.4)'}}>
                ⚓ ¡Comenzar Duelo!
              </button>
          }
        </div>
      )}

      <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'12px 18px',marginBottom:22,maxWidth:420,width:'100%'}}>
        <p style={{color:'#ddd',margin:0,fontSize:'0.8rem',lineHeight:1.85,textAlign:'center'}}>
          🎯 Responde <strong style={{color:'#f9c74f'}}>sincronizando el cañón</strong> en zona <span style={{color:'#00e676'}}>VERDE</span><br/>
          💨 Correcto fuera de zona → la bala cae al mar<br/>
          ❌ Incorrecto → penalización de {(COOLDOWN_MS/1000).toFixed(1)}s · 💀 10 vidas por barco<br/>
          🔘 Burbujas/Aparejados · 🖊️ Pasapalabra · 📝 Respuesta múltiple
        </p>
      </div>

      <button onClick={onExit} style={{background:'transparent',border:'1px solid rgba(255,255,255,.25)',color:'#999',borderRadius:8,padding:'8px 28px',cursor:'pointer',fontSize:'0.9rem'}}>← Volver</button>
    </div>
  );
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
function GameOverPantalla({ ganador, stats, tituloRecurso, onReintentar, onMenu, onExit }) {
  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'radial-gradient(circle at 50% 35%,#1a3a5c 0%,#07111f 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',padding:24,overflowY:'auto'}}>
      <div style={{fontSize:'4rem',marginBottom:10}}>{ganador===0?'🔴':'🔵'}</div>
      <h2 style={{margin:'0 0 4px',fontSize:'2.4rem',color:'#f9c74f',fontFamily:'Georgia,serif'}}>¡Victoria!</h2>
      <p style={{color:'#94d2bd',marginBottom:24,fontSize:'1.05rem'}}>{NOMBRES[ganador]} gana · <span style={{opacity:0.7}}>{tituloRecurso}</span></p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,width:'100%',maxWidth:440,marginBottom:28}}>
        {[0,1].map(p => {
          const s = stats[p];
          const prec = s.balasDisparadas>0 ? Math.round((s.balasImpacto/s.balasDisparadas)*100) : 0;
          return (
            <div key={p} style={{background:`${COLORES[p]}1a`,border:`2px solid ${COLORES[p]}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontWeight:800,marginBottom:10,color:COLORES[p]}}>{p===0?'🔴':'🔵'} {NOMBRES[p]}</div>
              <div style={{fontSize:'0.82rem',lineHeight:2.1,color:'#ccc'}}>
                <div>✅ Aciertos: <strong style={{color:'#fff'}}>{s.aciertos}</strong></div>
                <div>❌ Fallos: <strong style={{color:'#fff'}}>{s.fallos}</strong></div>
                <div>💣 Disparos: <strong style={{color:'#fff'}}>{s.balasDisparadas}</strong></div>
                <div>💥 Impactos: <strong style={{color:'#fff'}}>{s.balasImpacto}</strong></div>
                <div>🎯 Precisión: <strong style={{color:'#f9c74f'}}>{prec}%</strong></div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={onReintentar} style={{background:'#f9c74f',color:'#1a1a1a',border:'none',borderRadius:10,padding:'12px 26px',fontWeight:800,fontSize:'1rem',cursor:'pointer'}}>🔄 Revancha</button>
        <button onClick={onMenu} style={{background:'rgba(255,255,255,0.1)',color:'#fff',border:'1px solid rgba(255,255,255,0.28)',borderRadius:10,padding:'12px 26px',fontWeight:700,fontSize:'1rem',cursor:'pointer'}}>📋 Otro Recurso</button>
        <button onClick={onExit} style={{background:'transparent',color:'#888',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'12px 20px',fontWeight:600,fontSize:'0.9rem',cursor:'pointer'}}>✕ Salir</button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DueloPiratasRecurso({ onExit }) {
  const [fase,          setFase]        = useState('menu');
  const [recursoActual, setRecurso]     = useState(null);
  const [tituloRecurso, setTitulo]      = useState('');
  const [vidas,         setVidas]       = useState([VIDAS_MAX, VIDAS_MAX]);
  const [preguntas,     setPregs]       = useState([null, null]);
  const [cooldown,      setCooldown]    = useState([false, false]);
  const [ganador,       setGanador]     = useState(null);
  const [stats,         setStats]       = useState([
    {aciertos:0,fallos:0,balasDisparadas:0,balasImpacto:0},
    {aciertos:0,fallos:0,balasDisparadas:0,balasImpacto:0},
  ]);
  const [mensajes, setMensajes] = useState([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const angulosRef     = useRef([0, 20]);
  const dirRef         = useRef([1, -1]);
  const cañonEls       = useRef([null, null]);
  const muzzleEls      = useRef([null, null]);
  const aimEls         = useRef([null, null]);
  const canvasRef      = useRef(null);
  const balasRef       = useRef([]);
  const balaId         = useRef(0);
  const flameEmitters  = useRef([]);
  const flameParticles = useRef([]);
  const vivoRef        = useRef(false);
  const vidasRef       = useRef([VIDAS_MAX, VIDAS_MAX]);
  const cooldownRef    = useRef([false, false]);
  const preguntasRef   = useRef([null, null]);
  const statsRef       = useRef([
    {aciertos:0,fallos:0,balasDisparadas:0,balasImpacto:0},
    {aciertos:0,fallos:0,balasDisparadas:0,balasImpacto:0},
  ]);
  const mensajeId = useRef(0);
  const rafRef    = useRef(null);
  const shipEls   = useRef([null, null]);
  const sfxRef    = useRef(null);
  const musicRef  = useRef(null);
  const poolRef   = useRef([]);     // normalised question array
  const poolIdxRef = useRef([0,0]); // per-player index

  useEffect(() => { preguntasRef.current = preguntas; }, [preguntas]);

  // ── Audio init ────────────────────────────────────────────────────────────
  useEffect(() => {
    sfxRef.current = {
      correcto: new Audio(sndCorrecto),
      fallo:    new Audio(sndFallo),
      disparo:  new Audio(sndDisparo),
      impacto:  new Audio(sndImpacto),
      agua:     new Audio(sndAgua),
    };
    const music = new Audio(sndMusica);
    music.loop = true; music.volume = 0.35;
    musicRef.current = music;
    return () => { music.pause(); };
  }, []);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'game') return;
    vivoRef.current = true;

    const c = canvasRef.current;
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    window.addEventListener('resize', () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } });

    const music = musicRef.current;
    if (music) { music.currentTime = 0; music.play().catch(() => {}); }

    const playSfx = (key) => { try { const a = sfxRef.current?.[key]; if (!a) return; a.currentTime=0; a.play().catch(()=>{}); } catch(e) {} };

    const addFlame = (enemigo) => {
      const el = shipEls.current[enemigo]; if (!el) return;
      const r = el.getBoundingClientRect();
      flameEmitters.current.push({ cx: r.left + r.width*0.5, cy: r.top + r.height*0.35, framesLeft: FLAME_FRAMES });
    };

    const loop = () => {
      if (!vivoRef.current) return;

      for (let p = 0; p < 2; p++) {
        angulosRef.current[p] += ANGULO_SPEED * dirRef.current[p];
        if (angulosRef.current[p] >= ANGULO_MAX)       { angulosRef.current[p] = ANGULO_MAX;  dirRef.current[p] = -1; }
        else if (angulosRef.current[p] <= ANGULO_MIN)  { angulosRef.current[p] = ANGULO_MIN;  dirRef.current[p] =  1; }
        const ang = angulosRef.current[p];
        const cEl = cañonEls.current[p]; if (cEl) cEl.style.transform = `rotate(${-ang}deg)`;
        const aEl = aimEls.current[p];
        if (aEl) {
          const norm   = (ang - ANGULO_MIN) / (ANGULO_MAX - ANGULO_MIN);
          const inZone = Math.abs(ang) <= HIT_ZONE_DEG;
          aEl.style.left       = `${norm*100}%`;
          aEl.style.background = inZone ? '#00e676' : '#ff5252';
          aEl.style.boxShadow  = inZone ? '0 0 10px #00e676' : 'none';
        }
      }

      const canvas = canvasRef.current;
      const ctx    = canvas ? canvas.getContext('2d') : null;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (ctx) {
        const ARC = 140;
        const pos = (b, t) => ({ x: b.x+(b.tx-b.x)*t, y: b.y+(b.ty-b.y)*t - Math.sin(Math.max(0,Math.min(1,t))*Math.PI)*ARC });

        for (const b of balasRef.current) {
          if (b.prog >= 1 && !b.arrived) {
            b.arrived = true;
            if (b.hit) { playSfx('impacto'); addFlame(1-b.pl); }
            else        { playSfx('agua'); }
          }
        }
        balasRef.current = balasRef.current.filter(b => !b.arrived);

        for (const b of balasRef.current) {
          b.prog = Math.min(1, b.prog + BALA_SPEED);
          const t = b.prog; const cur = pos(b, t);
          for (let j = 1; j <= 5; j++) {
            const tp = pos(b, Math.max(0, t-j*0.04));
            ctx.beginPath(); ctx.arc(tp.x, tp.y, Math.max(1,9-j*1.5), 0, Math.PI*2);
            ctx.fillStyle = `rgba(190,155,100,${(1-j*0.18)*0.55})`; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(cur.x, cur.y, 18, 0, Math.PI*2);
          ctx.fillStyle = b.pl===0?'rgba(255,110,0,0.35)':'rgba(60,140,255,0.35)'; ctx.fill();
          const grad = ctx.createRadialGradient(cur.x-3,cur.y-3,1,cur.x,cur.y,13);
          grad.addColorStop(0,'#bbb'); grad.addColorStop(0.45,'#555'); grad.addColorStop(1,'#0d0d0d');
          ctx.beginPath(); ctx.arc(cur.x, cur.y, 13, 0, Math.PI*2);
          ctx.fillStyle=grad; ctx.shadowBlur=22; ctx.shadowColor=b.pl===0?'#ff8800':'#3388ff'; ctx.fill(); ctx.shadowBlur=0;
          ctx.beginPath(); ctx.arc(cur.x-4, cur.y-4, 3.5, 0, Math.PI*2);
          ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fill();
        }
      }

      for (const em of flameEmitters.current) {
        em.framesLeft--;
        if (em.framesLeft % 2 === 0) {
          for (let k = 0; k < 4; k++) {
            flameParticles.current.push({ cx:em.cx+(Math.random()-.5)*50, cy:em.cy+(Math.random()-.5)*25, vx:(Math.random()-.5)*2.2, vy:-Math.random()*3.5-.8, r:Math.random()*13+6, age:0, maxAge:28+Math.random()*22, hue:Math.random()*38 });
          }
        }
      }
      flameEmitters.current = flameEmitters.current.filter(e => e.framesLeft > 0);

      if (ctx) {
        flameParticles.current = flameParticles.current.filter(f => f.age < f.maxAge);
        for (const f of flameParticles.current) {
          f.age++; f.cx+=f.vx; f.cy+=f.vy; f.vy-=0.09;
          const prog=f.age/f.maxAge;
          ctx.beginPath(); ctx.arc(f.cx,f.cy,Math.max(0.5,f.r*(1-prog*0.65)),0,Math.PI*2);
          ctx.fillStyle=`hsla(${f.hue+5},100%,${48+prog*28}%,${(1-prog)*0.92})`;
          ctx.shadowBlur=7; ctx.shadowColor='rgba(255,90,0,0.7)'; ctx.fill(); ctx.shadowBlur=0;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      vivoRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (music) { music.pause(); music.currentTime = 0; }
    };
  }, [fase]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const playSfx = (key) => { try { const a = sfxRef.current?.[key]; if (!a) return; a.currentTime=0; a.play().catch(()=>{}); } catch(e) {} };

  const triggerShake = (playerHit) => {
    const el = shipEls.current[playerHit]; if (!el) return;
    el.classList.remove('dp-sway','dp-ship-rock'); void el.offsetWidth;
    el.classList.add('dp-ship-rock');
    setTimeout(() => { el.classList.remove('dp-ship-rock'); el.classList.add('dp-sway'); }, 980);
  };

  const showMsg = (text, color, playerId) => {
    const id = mensajeId.current++;
    const xPct = playerId===0 ? 62+Math.random()*14 : 8+Math.random()*14;
    setMensajes(prev => [...prev, {id,text,color,x:xPct,y:18+Math.random()*14}]);
    setTimeout(() => setMensajes(prev => prev.filter(m => m.id!==id)), 950);
  };

  const disparar = (playerId, hit) => {
    let startX, startY;
    const muzzleEl = muzzleEls.current[playerId];
    if (muzzleEl) { const r = muzzleEl.getBoundingClientRect(); startX=r.left; startY=r.top; }
    else { startX = playerId===0?window.innerWidth*0.78:window.innerWidth*0.22; startY = window.innerHeight*0.50; }
    let endX, endY;
    if (hit) {
      const shipEl = shipEls.current[1-playerId];
      if (shipEl) { const r = shipEl.getBoundingClientRect(); endX=r.left+r.width*0.5; endY=r.top+r.height*0.38; }
      else { endX=playerId===0?window.innerWidth*0.22:window.innerWidth*0.78; endY=window.innerHeight*0.50; }
    } else {
      const ang=angulosRef.current[playerId]; const dir=playerId===0?-1:1;
      endX=startX+dir*window.innerWidth*0.30; endY=startY-ang*5;
    }
    playSfx('disparo');
    balasRef.current.push({id:balaId.current++,x:startX,y:startY,tx:endX,ty:endY,prog:0,pl:playerId,hit,arrived:false});
  };

  const siguientePregunta = (playerId) => {
    const pool = poolRef.current;
    if (!pool.length) return null;
    const idx = poolIdxRef.current[playerId] % pool.length;
    poolIdxRef.current[playerId]++;
    return pool[idx];
  };

  const terminarJuego = (ganadorId, finalStats) => {
    vivoRef.current = false;
    setGanador(ganadorId);
    setFase('gameover');
    guardarPartida({ ganador: NOMBRES[ganadorId], recurso: tituloRecurso, jugadores: [{color:'Rojo',...finalStats[0]},{color:'Azul',...finalStats[1]}] });
  };

  // ── Answer handler ─────────────────────────────────────────────────────────
  const handleRespuesta = (playerId, opcion) => {
    if (!vivoRef.current || cooldownRef.current[playerId]) return;
    const pregunta = preguntasRef.current[playerId];
    if (!pregunta) return;

    const angulo      = angulosRef.current[playerId];
    const tieneOpts   = Array.isArray(pregunta.opciones);
    const esCorrecta  = tieneOpts
      ? opcion === pregunta.respuesta
      : opcion.toLowerCase().trim() === pregunta.respuesta.toLowerCase().trim();
    const enZona      = Math.abs(angulo) <= HIT_ZONE_DEG;
    const newStats    = statsRef.current.map(s => ({...s}));

    if (esCorrecta && enZona) {
      playSfx('correcto'); disparar(playerId, true); showMsg('💥 ¡IMPACTO!','#00e676',playerId);
      newStats[playerId].aciertos++; newStats[playerId].balasDisparadas++; newStats[playerId].balasImpacto++;
      const enemigo = 1-playerId;
      const newVidas = [...vidasRef.current]; newVidas[enemigo] = Math.max(0,newVidas[enemigo]-1);
      vidasRef.current = newVidas; setVidas([...newVidas]);
      triggerShake(enemigo);
      if (newVidas[enemigo] <= 0) { statsRef.current=newStats; setStats([...newStats]); terminarJuego(playerId,newStats); return; }
    } else if (esCorrecta && !enZona) {
      playSfx('correcto'); disparar(playerId, false); showMsg('💨 ¡Fuera!','#ffb347',playerId);
      newStats[playerId].aciertos++; newStats[playerId].balasDisparadas++;
    } else {
      playSfx('fallo'); showMsg('✗ Error','#ff5252',playerId);
      newStats[playerId].fallos++;
      cooldownRef.current[playerId] = true;
      setCooldown(prev => { const n=[...prev]; n[playerId]=true; return n; });
      setTimeout(() => {
        cooldownRef.current[playerId] = false;
        setCooldown(prev => { const n=[...prev]; n[playerId]=false; return n; });
      }, COOLDOWN_MS);
    }

    statsRef.current = newStats; setStats([...newStats]);
    const newQ = siguientePregunta(playerId);
    preguntasRef.current = [...preguntasRef.current]; preguntasRef.current[playerId] = newQ;
    setPregs([...preguntasRef.current]);
  };

  // ── Start game ─────────────────────────────────────────────────────────────
  const iniciarJuego = (recurso) => {
    const pool = normalizarPreguntas(recurso).sort(() => Math.random() - 0.5);
    if (!pool.length) { alert('No se encontraron preguntas válidas en este recurso'); return; }
    poolRef.current  = pool;
    poolIdxRef.current = [0, Math.floor(pool.length / 2)]; // offset so players start on different Qs

    const q0 = siguientePregunta(0), q1 = siguientePregunta(1);
    preguntasRef.current = [q0, q1]; setPregs([q0, q1]);
    vidasRef.current = [VIDAS_MAX, VIDAS_MAX]; setVidas([VIDAS_MAX, VIDAS_MAX]);
    cooldownRef.current = [false,false]; setCooldown([false,false]);
    const initStats = [{aciertos:0,fallos:0,balasDisparadas:0,balasImpacto:0},{aciertos:0,fallos:0,balasDisparadas:0,balasImpacto:0}];
    statsRef.current = initStats; setStats(initStats);
    setGanador(null); setMensajes([]);
    balasRef.current=[]; flameEmitters.current=[]; flameParticles.current=[];
    angulosRef.current=[0,20]; dirRef.current=[1,-1];
    setRecurso(recurso);
    setTitulo(recurso.titulo || recurso.nombre || 'Recurso');
    setFase('game');
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (fase==='menu') return <MenuPantalla onStart={iniciarJuego} onExit={onExit}/>;
  if (fase==='gameover') return (
    <GameOverPantalla ganador={ganador} stats={stats} tituloRecurso={tituloRecurso}
      onReintentar={() => iniciarJuego(recursoActual)}
      onMenu={() => setFase('menu')} onExit={onExit}
    />
  );

  const hitStart = ((-HIT_ZONE_DEG-ANGULO_MIN)/(ANGULO_MAX-ANGULO_MIN))*100;
  const hitWidth = (HIT_ZONE_DEG*2/(ANGULO_MAX-ANGULO_MIN))*100;

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,overflow:'hidden',userSelect:'none',display:'flex',flexDirection:'column'}}>
      <style>{CSS_ANIM}</style>
      <img src={imgFondoMarino} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center bottom',zIndex:0}}/>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:5,pointerEvents:'none'}}/>

      {mensajes.map(m => (
        <div key={m.id} style={{position:'absolute',zIndex:20,left:`${m.x}%`,top:`${m.y}%`,color:m.color,fontWeight:900,fontSize:'1.3rem',textShadow:'0 2px 8px rgba(0,0,0,.9)',animation:'dp-hitText 0.9s ease-out forwards',pointerEvents:'none',whiteSpace:'nowrap'}}>
          {m.text}
        </div>
      ))}

      {/* Top bar */}
      <div style={{position:'relative',zIndex:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 14px',background:'rgba(0,0,0,.7)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
        <span style={{color:'#94d2bd',fontSize:'0.78rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'40%'}}>📚 {tituloRecurso}</span>
        <span style={{color:'#f9c74f',fontWeight:800,fontSize:'0.95rem',fontFamily:'Georgia,serif'}}>Duelo de Piratas</span>
        <button onClick={() => { vivoRef.current=false; setFase('menu'); }} style={{background:'transparent',border:'1px solid rgba(255,255,255,.25)',color:'#aaa',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:'0.8rem'}}>✕</button>
      </div>

      {/* Ships arena */}
      <div style={{position:'relative',zIndex:2,flex:1,display:'flex',minHeight:0,overflow:'visible'}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:'38%',background:'linear-gradient(to top,rgba(0,40,100,0.38) 0%,transparent 100%)',pointerEvents:'none',zIndex:4}}/>

        {/* Blue (p=1) – LEFT */}
        <ShipColumn playerId={1} side="left" vidas={vidas[1]}
          shipRef={el => { shipEls.current[1]=el; }}
          cañonRef={el => { cañonEls.current[1]=el; }}
          muzzleRef={el => { muzzleEls.current[1]=el; }}
        />
        <div style={{position:'absolute',left:'50%',top:'30%',transform:'translate(-50%,-50%)',background:'rgba(0,0,0,.75)',color:'#f9c74f',fontWeight:900,fontSize:'1.5rem',fontFamily:'Georgia,serif',borderRadius:'50%',width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #f9c74f55',zIndex:6,pointerEvents:'none'}}>VS</div>

        {/* Red (p=0) – RIGHT */}
        <ShipColumn playerId={0} side="right" vidas={vidas[0]}
          shipRef={el => { shipEls.current[0]=el; }}
          cañonRef={el => { cañonEls.current[0]=el; }}
          muzzleRef={el => { muzzleEls.current[0]=el; }}
        />
      </div>

      {/* Control panels */}
      <div style={{position:'relative',zIndex:10,flexShrink:0,display:'flex',gap:8,padding:'8px 10px',background:'rgba(0,0,10,.82)',borderTop:'1px solid rgba(255,255,255,.1)'}}>
        <ControlPanel playerId={1} pregunta={preguntas[1]} cooldown={cooldown[1]}
          aimRef={el => { aimEls.current[1]=el; }}
          onRespuesta={op => handleRespuesta(1,op)}
          hitStart={hitStart} hitWidth={hitWidth}
        />
        <ControlPanel playerId={0} pregunta={preguntas[0]} cooldown={cooldown[0]}
          aimRef={el => { aimEls.current[0]=el; }}
          onRespuesta={op => handleRespuesta(0,op)}
          hitStart={hitStart} hitWidth={hitWidth}
        />
      </div>
    </div>
  );
}
