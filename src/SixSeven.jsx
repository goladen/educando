// Six Seven 🔢 — minijuegos de cálculo mental alrededor del 67 (Speed Run, Target 67, Neon Grid).
// Efecto propio: «6» y «7» que suben flotando como los corazones de un directo (lanzar67).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';

// ─── Partículas 6/7 ──────────────────────────────────────────────────────────
const emisor67 = new Set();
// Lanza `cantidad` números desde (x, y) en coordenadas de pantalla; sin coordenadas, desde abajo a la derecha.
export const lanzar67 = (x, y, cantidad = 6) => emisor67.forEach(fn => fn(x, y, cantidad));
const lanzar67DesdeElemento = (el, cantidad) => {
  if (!el) return lanzar67(undefined, undefined, cantidad);
  const r = el.getBoundingClientRect();
  lanzar67(r.left + r.width / 2, r.top + r.height / 2, cantidad);
};
const movimientoReducido = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const CapaSeisSiete = () => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let siguienteId = 0;
    const timers = new Set();
    const onEmit = (x, y, cantidad) => {
      const W = window.innerWidth, H = window.innerHeight;
      const n = movimientoReducido() ? Math.min(2, cantidad) : cantidad;
      const ox = x ?? W - 70, oy = y ?? H - 50;
      const nuevos = Array.from({ length: n }, (_, i) => {
        const r = Math.random();
        return {
          id: ++siguienteId,
          x: ox + (Math.random() - 0.5) * 40,
          y: oy + (Math.random() - 0.5) * 20,
          digito: r < 0.12 ? '67' : r < 0.56 ? '6' : '7',
          dx: (Math.random() - 0.5) * 180,
          dy: -(H * 0.3 + Math.random() * H * 0.35),
          rot: (Math.random() - 0.5) * 70,
          size: 26 + Math.random() * 36,
          dur: 1.6 + Math.random() * 1.3,
          delay: i * 0.06,
          sway: 0.45 + Math.random() * 0.5,
        };
      });
      const ids = new Set(nuevos.map(p => p.id));
      setItems(prev => [...prev, ...nuevos].slice(-90));
      const vida = Math.max(...nuevos.map(p => p.dur + p.delay)) * 1000 + 100;
      const t = setTimeout(() => { timers.delete(t); setItems(prev => prev.filter(p => !ids.has(p.id))); }, vida);
      timers.add(t);
    };
    emisor67.add(onEmit);
    return () => { emisor67.delete(onEmit); timers.forEach(clearTimeout); };
  }, []);

  const colorDe = (d) => d === '6' ? theme.neonPink : d === '7' ? theme.neonCyan : theme.neonGreen;
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300, overflow: 'hidden' }}>
      <style>{`
        @keyframes sube67 {
          0%   { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
          12%  { transform: translate(calc(var(--dx) * 0.1), calc(var(--dy) * 0.08)) scale(1.2) rotate(calc(var(--rot) * 0.2)); opacity: 1; }
          70%  { opacity: 0.9; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.8) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes balanceo67 { from { transform: translateX(-10px); } to { transform: translateX(10px); } }
      `}</style>
      {items.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: p.x, top: p.y, opacity: 0,
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
          animation: `sube67 ${p.dur}s cubic-bezier(0.22, 0.61, 0.36, 1) ${p.delay}s forwards`,
        }}>
          <div style={{
            marginLeft: -p.size * (p.digito.length > 1 ? 0.6 : 0.3), marginTop: -p.size * 0.6,
            fontSize: p.size, fontWeight: 900, lineHeight: 1,
            color: colorDe(p.digito), textShadow: `0 0 12px ${colorDe(p.digito)}, 0 0 2px #fff`,
            animation: `balanceo67 ${p.sway}s ease-in-out infinite alternate`,
          }}>{p.digito}</div>
        </div>
      ))}
    </div>
  );
};

// Chorro continuo de 6/7 mientras el componente está montado (victorias y menú).
const useChorro67 = (cada = 220, cantidad = 2, desdeAbajo = false) => {
  useEffect(() => {
    if (movimientoReducido()) return;
    const iv = setInterval(() => {
      if (desdeAbajo) lanzar67(window.innerWidth * (0.1 + Math.random() * 0.8), window.innerHeight - 20, cantidad);
      else lanzar67(undefined, undefined, cantidad);
    }, cada);
    return () => clearInterval(iv);
  }, [cada, cantidad, desdeAbajo]);
};

const useWindowSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
};

const audioManager = {
  ctx: null,
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
  },
  play(type) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    
    if (type === 'win') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance("Six Seven");
        msg.lang = 'en-US';
        msg.rate = 1.3;
        msg.pitch = 1.1;
        msg.volume = 0.6;
        window.speechSynthesis.speak(msg);
      }
    } else if (type === 'fail') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }
};

const solveCountdown = (numbers, target) => {
  let solution = null;
  const search = (list) => {
    if (solution) return;
    for (let i = 0; i < list.length; i++) {
      if (list[i].val === target) {
        solution = list[i].expr;
        return;
      }
    }
    if (list.length === 1) return;

    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i], b = list[j];
        const nextList = [];
        for (let k = 0; k < list.length; k++) {
          if (k !== i && k !== j) nextList.push(list[k]);
        }
        
        // Suma (conmutativa)
        if (i < j) {
          nextList.push({ val: a.val + b.val, expr: `(${a.expr} + ${b.expr})` });
          search(nextList);
          nextList.pop();
        }
        // Resta (evitar negativos)
        if (a.val > b.val) {
          nextList.push({ val: a.val - b.val, expr: `(${a.expr} - ${b.expr})` });
          search(nextList);
          nextList.pop();
        }
        // Multiplicación (conmutativa, evitar * 1)
        if (i < j && a.val > 1 && b.val > 1) {
          nextList.push({ val: a.val * b.val, expr: `(${a.expr} × ${b.expr})` });
          search(nextList);
          nextList.pop();
        }
        // División (evitar / 1 y decimales)
        if (b.val > 1 && a.val % b.val === 0) {
          nextList.push({ val: a.val / b.val, expr: `(${a.expr} ÷ ${b.expr})` });
          search(nextList);
          nextList.pop();
        }
      }
    }
  };
  search(numbers.map(n => ({ val: n, expr: String(n) })));
  
  if (solution && solution.startsWith('(') && solution.endsWith(')')) {
      solution = solution.slice(1, -1);
  }
  return solution;
};

const theme = {
  bg: '#09090E',
  panel: 'rgba(20, 20, 35, 0.7)',
  neonCyan: '#00F0FF',
  neonPink: '#FF007F',
  neonPurple: '#B026FF',
  neonGreen: '#39FF14',
  text: '#FFFFFF',
  muted: '#6B7280',
};

const styles = {
  wrapper: {
    width: '100%',
    minHeight: '100vh',
    background: `radial-gradient(circle at 50% 0%, #1a1a2e 0%, ${theme.bg} 80%)`,
    color: theme.text,
    fontFamily: '"Inter", "Montserrat", system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(10px, 3vw, 20px)',
    boxSizing: 'border-box',
    overflow: 'hidden',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  glassCard: {
    background: theme.panel,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid rgba(255, 255, 255, 0.1)`,
    borderRadius: '24px',
    padding: 'clamp(20px, 5vw, 40px)',
    width: '100%',
    maxWidth: '900px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  glitchTitle: {
    fontSize: 'clamp(3rem, 10vw, 7rem)',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '-2px',
    margin: '0 0 10px 0',
    background: `linear-gradient(to right, ${theme.neonCyan}, ${theme.neonPink})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    filter: `drop-shadow(0 0 15px rgba(255,0,127,0.4))`,
    textAlign: 'center',
    lineHeight: '1',
  },
  btnPrimary: {
    position: 'relative',
    width: '100%',
    padding: 'clamp(15px, 3vw, 25px)',
    fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: theme.text,
    background: `linear-gradient(90deg, ${theme.neonPurple}, ${theme.neonPink})`,
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    boxShadow: `0 0 20px rgba(255,0,127,0.4)`,
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
  },
  btnSecondary: {
    background: 'transparent',
    border: `2px solid ${theme.neonCyan}`,
    color: theme.neonCyan,
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: `0 0 10px rgba(0,240,255,0.2)`,
  },
  btnInfo: {
    background: 'transparent',
    border: `2px solid ${theme.neonPurple}`,
    color: theme.neonPurple,
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 15px rgba(176,38,255,0.4)`,
    transition: 'all 0.2s',
  }
};

const InfoModal = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: 'inherit'
    }}>
      <div style={{
        background: theme.panel, border: `2px solid ${theme.neonPurple}`, borderRadius: '20px',
        padding: '30px', maxWidth: '400px', textAlign: 'center', boxShadow: `0 0 30px ${theme.neonPurple}`,
        width: '100%'
      }}>
        <h2 style={{ color: theme.neonCyan, marginTop: 0, fontSize: '1.8rem', textTransform: 'uppercase' }}>{title}</h2>
        <div style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#fff', marginBottom: '30px', textAlign: 'left' }}>
          {content}
        </div>
        <button style={{...styles.btnPrimary, background: theme.neonPurple, padding: '15px'}} onClick={onClose}>
          ENTENDIDO
        </button>
      </div>
    </div>
  );
};

const WinScreen = ({ score, onMenu, onRestart, message = "GOD TIER", color = theme.neonGreen, children }) => {
  useChorro67(160, 2, true);
  return (
  <div style={{ textAlign: 'center', padding: '20px 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
    <style>{`
      @keyframes dance6 {
        0%, 100% { transform: translateY(0) rotate(-10deg) scale(1); }
        25% { transform: translateY(-30px) rotate(15deg) scale(1.1); }
        50% { transform: translateY(0) rotate(-10deg) scale(1); }
        75% { transform: translateY(-15px) rotate(5deg) scale(1.05); }
      }
      @keyframes dance7 {
        0%, 100% { transform: translateY(0) rotate(10deg) scale(1); }
        25% { transform: translateY(-15px) rotate(-5deg) scale(1.05); }
        50% { transform: translateY(0) rotate(10deg) scale(1); }
        75% { transform: translateY(-30px) rotate(-15deg) scale(1.1); }
      }
    `}</style>
    <h2 style={{
      fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: color, textShadow: `0 0 20px ${color}`,
      textTransform: 'uppercase', margin: '0 0 10px 0', lineHeight: 1.1
    }}>
      {message}
    </h2>
    {score !== undefined && (
      <div style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', color: '#fff', marginBottom: '20px' }}>
        SCORE: <span style={{color: theme.neonCyan}}>{score}</span>
      </div>
    )}
    <div style={{ display: 'flex', gap: 'clamp(10px, 4vw, 30px)', margin: '20px 0 40px 0' }}>
      <div style={{
        fontSize: 'clamp(6rem, 15vw, 12rem)', fontWeight: '900', color: theme.neonPink,
        textShadow: `0 0 30px ${theme.neonPink}`, animation: 'dance6 0.6s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }}>6</div>
      <div style={{
        fontSize: 'clamp(6rem, 15vw, 12rem)', fontWeight: '900', color: theme.neonCyan,
        textShadow: `0 0 30px ${theme.neonCyan}`, animation: 'dance7 0.6s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s'
      }}>7</div>
    </div>
    {children}
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
       <button style={{...styles.btnPrimary, width: 'auto', padding: '15px 30px', background: color, color: '#000'}} onClick={onRestart}>
         PLAY AGAIN
       </button>
       <button style={{...styles.btnSecondary, padding: '15px 30px', fontSize: '1.2rem'}} onClick={onMenu}>
         MAIN MENU
       </button>
    </div>
  </div>
  );
};

// Pantalla para elegir nivel (Speed Run y Target 67)
const SelectorNivel = ({ titulo, normal, dificil, onElegir, onBack }) => (
  <div style={styles.wrapper}>
    <div style={styles.glassCard}>
      <h2 style={{...styles.glitchTitle, fontSize: 'clamp(2rem, 6vw, 4rem)', marginBottom: '30px', marginTop: '10px'}}>{titulo}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px' }}>
        <button style={{...styles.btnPrimary, background: `linear-gradient(90deg, #0072FF, ${theme.neonCyan})`, boxShadow: `0 0 20px rgba(0,240,255,0.4)`}} onClick={() => { audioManager.init(); onElegir('normal'); }}>
          <span>Normal</span>
          <span style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.6)', letterSpacing: '1px', fontWeight: 'bold', textTransform: 'none' }}>{normal}</span>
        </button>
        <button style={styles.btnPrimary} onClick={() => { audioManager.init(); onElegir('hard'); }}>
          <span>Hard</span>
          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '1px', fontWeight: 'normal', textTransform: 'none' }}>{dificil}</span>
        </button>
      </div>
      <button style={{...styles.btnSecondary, marginTop: '30px'}} onClick={onBack}>← MAIN MENU</button>
    </div>
  </div>
);

// ─── Ranking (colección compartida `ranking`, tipoJuego SIXSEVEN) ────────────
// Un ranking por variante: recursoId = 'sixseven-<juego>-<opciones>'. Empate → gana el más antiguo.
const RANKING_VARIANTES = {
  arcade: {
    titulo: 'Speed Run',
    dims: [
      { key: 'nivel', ops: [['normal', 'Normal'], ['hard', 'Hard']] },
      { key: 'tiempo', ops: [['13', '13 s'], ['inf', 'Sin tiempo']] },
    ],
  },
  matrix: {
    titulo: 'Neon Grid',
    dims: [
      { key: 'modo', ops: [['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷'], ['multiples', 'Múltiplos']] },
      { key: 'tiempo', ops: [['67', '67 s'], ['130', '130 s']] },
    ],
  },
};
const claveRanking = (juego, sel) => `sixseven-${juego}-${RANKING_VARIANTES[juego].dims.map(d => sel[d.key]).join('-')}`;
const tituloRanking = (juego, sel) => `Six Seven · ${RANKING_VARIANTES[juego].titulo} · ${RANKING_VARIANTES[juego].dims.map(d => (d.ops.find(o => o[0] === sel[d.key]) || [])[1]).join(' · ')}`;
const msFecha = (f) => (f?.toMillis ? f.toMillis() : f instanceof Date ? f.getTime() : (f?.seconds || 0) * 1000);
const KEY_NOMBRE = 'pikt_sixseven_nombre';

const cargarRanking = async (clave) => {
  let docs;
  try {
    const snap = await getDocs(query(collection(db, 'ranking'), where('recursoId', '==', clave), where('tipoJuego', '==', 'SIXSEVEN'), orderBy('aciertos', 'desc'), limit(100)));
    docs = snap.docs;
  } catch (e) {
    // Sin índice compuesto: se ordena en el cliente (el aviso trae el enlace para crear el índice)
    console.warn('[SixSeven] Ranking sin índice, ordenando en el cliente:', e?.message);
    const snap = await getDocs(query(collection(db, 'ranking'), where('recursoId', '==', clave), where('tipoJuego', '==', 'SIXSEVEN'), limit(500)));
    docs = snap.docs;
  }
  return docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.aciertos - a.aciertos) || (msFecha(a.fecha) - msFecha(b.fecha)))
    .slice(0, 10);
};

// Panel de ranking. Con `jugada` ({ juego, sel, puntos }) permite guardar esa puntuación.
const RankingSixSeven = ({ juegoInicial = 'arcade', selInicial = null, jugada = null, usuario = null, onClose }) => {
  const [juego, setJuego] = useState(jugada?.juego || juegoInicial);
  const selPorDefecto = (j) => Object.fromEntries(RANKING_VARIANTES[j].dims.map(d => [d.key, d.ops[0][0]]));
  const [sel, setSel] = useState(jugada?.sel || selInicial || selPorDefecto(juegoInicial));
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState(() => { try { return localStorage.getItem(KEY_NOMBRE) || ''; } catch { return ''; } });
  const [guardando, setGuardando] = useState(false);
  const [miId, setMiId] = useState(null);
  const conSesion = !!usuario?.email;
  const clave = claveRanking(juego, sel);
  const puedeGuardar = jugada && jugada.puntos > 0 && claveRanking(jugada.juego, jugada.sel) === clave && !miId;

  useEffect(() => {
    let vivo = true;
    setCargando(true); setError('');
    cargarRanking(clave)
      .then(f => { if (vivo) setFilas(f); })
      .catch(() => { if (vivo) setError('No se pudo cargar el ranking.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [clave, miId]);

  const guardar = async () => {
    const jugador = conSesion ? (usuario.displayName || usuario.email.split('@')[0]) : nombre.trim().slice(0, 24);
    if (!jugador) { setError('Escribe tu nombre para el ranking.'); return; }
    setGuardando(true); setError('');
    try {
      if (!conSesion) { try { localStorage.setItem(KEY_NOMBRE, jugador); } catch { /* ignorar */ } }
      const ref = await addDoc(collection(db, 'ranking'), {
        recursoId: clave,
        recursoTitulo: tituloRanking(juego, sel),
        tipoJuego: 'SIXSEVEN',
        juego: 'Six Seven',
        jugador,
        email: conSesion ? usuario.email : 'invitado',
        aciertos: jugada.puntos,
        fecha: new Date(),
        categoria: clave.replace('sixseven-', ''),
      });
      setMiId(ref.id);
      lanzar67(undefined, undefined, 12);
    } catch { setError('Error al guardar. Inténtalo de nuevo.'); }
    setGuardando(false);
  };

  const chip = (activo, color) => ({
    padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem',
    background: activo ? color : 'transparent', color: activo ? '#000' : theme.text,
    border: `2px solid ${activo ? color : 'rgba(255,255,255,0.2)'}`, transition: 'all 0.2s',
  });
  const posicionMia = miId ? filas.findIndex(f => f.id === miId) : -1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ ...styles.glassCard, maxWidth: '520px', border: `2px solid ${theme.neonPurple}`, boxShadow: `0 0 30px ${theme.neonPurple}`, padding: 'clamp(18px, 4vw, 30px)' }}>
        <h2 style={{ color: theme.neonCyan, margin: '0 0 14px', fontSize: 'clamp(1.5rem, 5vw, 2rem)', textTransform: 'uppercase', textShadow: `0 0 12px ${theme.neonCyan}` }}>🏆 Ranking</h2>

        {!jugada && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {Object.keys(RANKING_VARIANTES).map(j => (
              <button key={j} style={chip(juego === j, theme.neonPink)} onClick={() => { setJuego(j); setSel(selPorDefecto(j)); }}>{RANKING_VARIANTES[j].titulo}</button>
            ))}
          </div>
        )}
        {RANKING_VARIANTES[juego].dims.map(d => (
          <div key={d.key} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '10px' }}>
            {d.ops.map(([v, label]) => (
              <button key={v} style={chip(sel[d.key] === v, theme.neonCyan)} onClick={() => setSel(s => ({ ...s, [d.key]: v }))}>{label}</button>
            ))}
          </div>
        ))}

        <div style={{ width: '100%', background: 'rgba(0,0,0,0.35)', borderRadius: '14px', padding: '8px 12px', margin: '6px 0 14px', minHeight: '120px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)' }}>
          {cargando ? <div style={{ color: theme.muted, padding: '16px', textAlign: 'center' }}>LOADING...</div>
            : filas.length === 0 ? <div style={{ color: theme.muted, padding: '16px', textAlign: 'center' }}>Sin puntuaciones todavía. ¡Sé el primero!</div>
            : filas.map((f, i) => {
              const mia = f.id === miId;
              const color = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : theme.muted;
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: mia ? 'rgba(57,255,20,0.12)' : 'transparent', borderRadius: mia ? '8px' : 0 }}>
                  <span style={{ width: '34px', fontWeight: 900, color }}>#{i + 1}</span>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: mia ? 900 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.jugador}</span>
                  <span style={{ color: theme.muted, fontSize: '0.8rem' }}>{msFecha(f.fecha) ? new Date(msFecha(f.fecha)).toLocaleDateString() : ''}</span>
                  <span style={{ fontWeight: 900, color: theme.neonCyan, minWidth: '64px', textAlign: 'right' }}>{f.aciertos}</span>
                </div>
              );
            })}
        </div>

        {miId && (
          <div style={{ color: theme.neonGreen, fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
            ¡Guardado! {posicionMia >= 0 ? `Estás en el puesto #${posicionMia + 1}` : 'Todavía fuera del top 10'}
          </div>
        )}
        {puedeGuardar && (
          <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '12px', flexWrap: 'wrap' }}>
            {!conSesion && (
              <input value={nombre} maxLength={24} placeholder="Tu nombre" onChange={e => setNombre(e.target.value)}
                style={{ flex: '1 1 160px', padding: '12px', borderRadius: '12px', border: `2px solid ${theme.neonCyan}`, background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '1rem', outline: 'none' }} />
            )}
            <button disabled={guardando} onClick={guardar} style={{ ...styles.btnPrimary, flex: '1 1 160px', width: 'auto', padding: '12px', fontSize: '1rem', background: theme.neonGreen, color: '#000', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'GUARDANDO...' : `GUARDAR ${jugada.puntos} PTS`}
            </button>
          </div>
        )}
        {error && <div style={{ color: theme.neonPink, marginBottom: '10px' }}>{error}</div>}
        <button style={styles.btnSecondary} onClick={onClose}>CERRAR</button>
      </div>
    </div>
  );
};

// Speed Run: puntos por respuesta según lo rápido que se acierte (referencia: 13 s)
const puntosPorTiempo = (seg) => 100 + Math.round(900 * Math.max(0, 1 - seg / 13));
const etiquetaVelocidad = (seg) =>
  seg < 2.5 ? { texto: '⚡ ¡RAYO!', color: theme.neonGreen }
  : seg < 5 ? { texto: '🔥 RÁPIDO', color: theme.neonCyan }
  : seg < 9 ? { texto: '👍 BIEN', color: '#FF9500' }
  : { texto: '🐢 LENTO', color: theme.neonPink };

// Distractores: en «hard» acaban en la misma cifra que la respuesta (no basta con mirar las unidades)
const opcionesArcade = (ans, nivel) => {
  const opts = new Set([ans]);
  let guard = 0;
  while (opts.size < 4 && guard++ < 200) {
    let cand;
    if (nivel === 'hard') {
      const k = Math.floor(Math.random() * 3) + 1;
      const paso = ans >= 150 && Math.random() < 0.3 ? 100 : 10;
      cand = ans + (Math.random() > 0.5 ? k : -k) * paso;
    } else {
      const offset = Math.floor(Math.random() * 15) + 1;
      cand = ans + (Math.random() > 0.5 ? offset : -offset);
    }
    if (cand >= 0) opts.add(cand);
  }
  for (let k = 1; opts.size < 4; k++) opts.add(ans + k * 10);
  return Array.from(opts).sort(() => Math.random() - 0.5);
};

const ArcadeGame = ({ onBack, timeLimit, nivel = 'normal', usuario }) => {
  const hard = nivel === 'hard';
  const [round, setRound] = useState(1);
  const maxTime = timeLimit === 'inf' ? null : timeLimit * 1000;
  const [time, setTime] = useState(maxTime);
  const [status, setStatus] = useState('playing');
  const [question, setQuestion] = useState(null);
  const [flash, setFlash] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [score, setScore] = useState(0);
  const [ultimo, setUltimo] = useState(null); // { pts, texto, color, seg, id } de la última respuesta
  const [verRanking, setVerRanking] = useState(false);
  const inicioPregunta = useRef(performance.now());
  const pausaDesde = useRef(null);
  const rankingSel = { nivel, tiempo: String(timeLimit) };

  // El tiempo con la ayuda abierta no cuenta
  useEffect(() => {
    if (showInfo) pausaDesde.current = performance.now();
    else if (pausaDesde.current != null) { inicioPregunta.current += performance.now() - pausaDesde.current; pausaDesde.current = null; }
  }, [showInfo]);

  const generateQuestion = useCallback((currentRound) => {
    let q = '';
    let ans = 0;
    const is67First = Math.random() > 0.5;

    if (currentRound <= 2) {
      const b = Math.floor(Math.random() * (hard ? 89 : 30)) + (hard ? 11 : 1);
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        q = is67First ? `67 + ${b}` : `${b} + 67`;
        ans = 67 + b;
      } else if (is67First && b > 67) {
        q = `${b} - 67`;
        ans = b - 67;
      } else {
        q = is67First ? `67 - ${b}` : `${b + 67} - 67`;
        ans = is67First ? 67 - b : b;
      }
    } else if (currentRound <= 4) {
      const b = Math.floor(Math.random() * (hard ? 18 : 9)) + 2;
      q = is67First ? `67 × ${b}` : `${b} × 67`;
      ans = 67 * b;
    } else {
      const b = Math.floor(Math.random() * (hard ? 8 : 5)) + 2;
      const c = Math.floor(Math.random() * (hard ? 90 : 20)) + (hard ? 10 : 1);
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        q = is67First ? `67 × ${b} + ${c}` : `${c} + 67 × ${b}`;
        ans = 67 * b + c;
      } else {
        q = is67First ? `67 × ${b} - ${c}` : `${c + 67 * b} - 67 × ${b}`;
        ans = is67First ? 67 * b - c : c;
      }
    }
    
    setQuestion({ q, ans, options: opcionesArcade(ans, nivel) });
    setTime(maxTime);
    inicioPregunta.current = performance.now();
  }, [maxTime, hard, nivel]);

  useEffect(() => generateQuestion(1), [generateQuestion]);

  useEffect(() => {
    if (status !== 'playing' || maxTime === null || showInfo) return;
    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev <= 50) {
          audioManager.play('fail');
          setStatus('lost');
          setFlash(theme.neonPink);
          return 0;
        }
        return prev - 50;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [status, maxTime, showInfo]);

  // Registro local al acabar la partida (icono Pi de la tarjeta)
  useEffect(() => {
    if (status !== 'won' && status !== 'lost') return;
    const aciertos = status === 'won' ? 6 : round - 1;
    guardarRegistroLocal('SIXSEVEN', { titulo: `Six Seven · Speed Run${hard ? ' (hard)' : ''}`, aciertos, intentos: status === 'won' ? 6 : round, via: 'juego' });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const reiniciar = () => { setRound(1); setScore(0); setUltimo(null); setVerRanking(false); setStatus('playing'); generateQuestion(1); setFlash(null); };

  const handleAnswer = (opt, e) => {
    if (status !== 'playing') return;
    if (opt === question.ans) {
      const seg = (performance.now() - inicioPregunta.current) / 1000;
      const pts = puntosPorTiempo(seg);
      const et = etiquetaVelocidad(seg);
      setScore(s => s + pts);
      setUltimo({ pts, seg, ...et, id: Date.now() });
      lanzar67(e?.clientX, e?.clientY, round === 6 ? 14 : seg < 2.5 ? 10 : seg < 5 ? 7 : 4);
      if (round === 6) {
        audioManager.play('win');
        setFlash(theme.neonGreen);
        setStatus('won');
      } else {
        audioManager.play('win');
        setFlash(theme.neonGreen);
        setTimeout(() => setFlash(null), 150);
        setRound((r) => r + 1);
        generateQuestion(round + 1);
      }
    } else {
      audioManager.play('fail');
      setStatus('lost');
      setFlash(theme.neonPink);
    }
  };

  return (
    <div style={{...styles.wrapper, transition: 'background 0.2s', background: flash ? `radial-gradient(circle, ${flash}33 0%, ${theme.bg} 80%)` : styles.wrapper.background}}>
      <div style={styles.glassCard}>
        <InfoModal 
          isOpen={showInfo} 
          onClose={() => setShowInfo(false)} 
          title="Cómo jugar" 
          content={
            <ul>
              <li style={{marginBottom: '10px'}}>Resuelve <strong>6 rondas</strong> de cálculo mental.</li>
              <li style={{marginBottom: '10px'}}>Atención: ¡El número <strong>67</strong> siempre forma parte de la operación!</li>
              <li style={{marginBottom: '10px'}}>{timeLimit !== 'inf' ? `Tienes ${timeLimit} segundos por ronda.` : 'No hay límite de tiempo.'}</li>
              <li style={{marginBottom: '10px'}}>Cuanto más rápido aciertes, más puntos: de <strong>1000</strong> (al instante) a <strong>100</strong> (13 s o más). ⚡ Rayo &lt; 2,5 s · 🔥 Rápido &lt; 5 s · 👍 Bien &lt; 9 s · 🐢 Lento.</li>
              {hard && <li style={{marginBottom: '10px'}}>Modo <strong>HARD</strong>: todas las opciones acaban en la misma cifra, ¡no basta con mirar las unidades!</li>}
              <li>¡Llega hasta el final para ver la celebración secreta!</li>
            </ul>
          } 
        />

        {verRanking && (
          <RankingSixSeven
            jugada={status !== 'playing' ? { juego: 'arcade', sel: rankingSel, puntos: score } : null}
            juegoInicial="arcade" selInicial={rankingSel} usuario={usuario}
            onClose={() => setVerRanking(false)}
          />
        )}

        {status === 'won' ? (
          <WinScreen message="¡SIX SEVEN SUPERADO!" score={score} color={theme.neonCyan} onMenu={onBack} onRestart={reiniciar}>
            <button style={{...styles.btnPrimary, width: 'auto', padding: '15px 30px', marginBottom: '20px', background: `linear-gradient(90deg, ${theme.neonPurple}, ${theme.neonPink})`}} onClick={() => setVerRanking(true)}>
              🏆 GUARDAR EN RANKING
            </button>
          </WinScreen>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '30px', gap: '10px', flexWrap: 'wrap' }}>
              <button style={styles.btnSecondary} onClick={onBack}>← ABORT</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: theme.neonCyan, fontWeight: '900', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', letterSpacing: '2px', lineHeight: 1.1 }}>
                    {hard ? 'HARD · ' : ''}LVL {round}/6
                  </div>
                  <div style={{ color: theme.neonPink, fontWeight: '900', fontSize: 'clamp(1rem, 2.5vw, 1.4rem)', textShadow: `0 0 10px ${theme.neonPink}` }}>{score} PTS</div>
                </div>
                <button style={styles.btnInfo} onClick={() => { audioManager.init(); setShowInfo(true); }}>?</button>
              </div>
            </div>

            {ultimo && status === 'playing' && (
              <div key={ultimo.id} style={{ height: 0, overflow: 'visible', width: '100%', position: 'relative' }}>
                <style>{`@keyframes popPts67 { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; } 15% { transform: translate(-50%, -10px) scale(1.15); opacity: 1; } 75% { opacity: 1; } 100% { transform: translate(-50%, -40px) scale(1); opacity: 0; } }`}</style>
                <div style={{
                  position: 'absolute', left: '50%', top: '-24px', whiteSpace: 'nowrap', pointerEvents: 'none',
                  fontWeight: 900, fontSize: 'clamp(1.1rem, 3vw, 1.6rem)', color: ultimo.color, textShadow: `0 0 12px ${ultimo.color}`,
                  animation: 'popPts67 1.3s ease-out forwards',
                }}>
                  {ultimo.texto} +{ultimo.pts} <span style={{ opacity: 0.7, fontSize: '0.75em' }}>({ultimo.seg.toFixed(1)} s)</span>
                </div>
              </div>
            )}

            {status === 'playing' && question && (
              <>
                {maxTime !== null && (
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '40px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                    <div style={{ 
                      width: `${(time / maxTime) * 100}%`, 
                      height: '100%', 
                      background: (time / maxTime) < 0.35 ? theme.neonPink : theme.neonCyan,
                      boxShadow: `0 0 10px ${(time / maxTime) < 0.35 ? theme.neonPink : theme.neonCyan}`,
                      transition: 'width 0.05s linear' 
                    }} />
                  </div>
                )}
                
                <div style={{ 
                  fontSize: 'clamp(3rem, 10vw, 7rem)', 
                  fontWeight: '900', 
                  color: '#fff',
                  textShadow: `0 0 20px ${theme.neonPurple}`,
                  marginBottom: maxTime === null ? '80px' : '50px', 
                  textAlign: 'center' 
                }}>
                  {question.q}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(15px, 4vw, 30px)', width: '100%' }}>
                  {question.options.map((opt, i) => (
                    <button
                      key={i}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px solid rgba(255,255,255,0.2)`,
                        color: '#fff',
                        fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                        fontWeight: 'bold',
                        padding: 'clamp(15px, 4vw, 30px)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        touchAction: 'manipulation',
                      }}
                      onPointerDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.95)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                        handleAnswer(opt, e);
                      }}
                      onPointerUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            )}

            {status === 'lost' && (
              <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
                <h2 style={{ 
                  fontSize: 'clamp(3rem, 8vw, 6rem)', color: theme.neonPink, textShadow: `0 0 20px ${theme.neonPink}`,
                  textTransform: 'uppercase', margin: '0 0 10px 0', lineHeight: 1.1
                }}>WASTED</h2>
                <div style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', color: '#fff', marginBottom: '40px' }}>
                  <span style={{opacity: 0.8}}>La respuesta correcta era:</span><br/>
                  <span style={{ color: theme.neonCyan, fontSize: 'clamp(3rem, 6vw, 4rem)', fontWeight: '900', textShadow: `0 0 15px ${theme.neonCyan}` }}>
                    {question.ans}
                  </span>
                </div>
                <div style={{ fontSize: 'clamp(1.3rem, 3vw, 2rem)', color: '#fff', marginBottom: '25px' }}>
                  SCORE: <span style={{ color: theme.neonCyan, fontWeight: 900 }}>{score}</span>
                </div>
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button style={{...styles.btnPrimary, background: theme.neonPink, color: '#000', maxWidth: '300px'}} onClick={reiniciar}>
                    RETRY
                  </button>
                  {score > 0 && (
                    <button style={{...styles.btnPrimary, maxWidth: '300px', background: `linear-gradient(90deg, ${theme.neonPurple}, ${theme.neonPink})`}} onClick={() => setVerRanking(true)}>
                      🏆 RANKING
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Analiza todas las formas de llegar a `target` con subconjuntos de `nums` (programación dinámica por máscaras).
// Devuelve el mínimo de números necesarios, si existe una vía solo con sumas/restas y una solución (preferiblemente con ÷).
const LIMITE_TARGET = 2000;
const analizarTablero = (nums, target) => {
  const n = nums.length, FULL = (1 << n) - 1;
  const reach = new Array(FULL + 1);
  const bits = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
  let minK = Infinity, soloSumas = false, mejor = null, mejorDiv = null;
  for (let mask = 1; mask <= FULL; mask++) {
    const m = new Map();
    if (bits(mask) === 1) {
      const v = nums[Math.log2(mask)];
      m.set(v, { e: String(v), s: true, d: false });
    } else {
      const put = (v, e, s, d) => {
        if (v < 1 || v > LIMITE_TARGET) return;
        const old = m.get(v);
        if (!old || (s && !old.s)) m.set(v, { e, s, d });
      };
      for (let a = (mask - 1) & mask; a > 0; a = (a - 1) & mask) {
        const b = mask ^ a;
        if (a < b) continue;
        for (const [x, ex] of reach[a]) for (const [y, ey] of reach[b]) {
          const s = ex.s && ey.s, d = ex.d || ey.d;
          put(x + y, `(${ex.e} + ${ey.e})`, s, d);
          if (x !== y) {
            const [h, eh, l, el] = x > y ? [x, ex, y, ey] : [y, ey, x, ex];
            put(h - l, `(${eh.e} - ${el.e})`, s, d);
            if (l > 1 && h % l === 0) put(h / l, `(${eh.e} ÷ ${el.e})`, false, true);
          }
          if (x > 1 && y > 1) put(x * y, `(${ex.e} × ${ey.e})`, false, d);
        }
      }
    }
    reach[mask] = m;
    const t = m.get(target);
    if (t) {
      const k = bits(mask);
      if (t.s) soloSumas = true;
      if (k < minK) { minK = k; mejor = t.e; }
      if (t.d && !mejorDiv) mejorDiv = t.e;
    }
  }
  const limpiar = (e) => e && e.startsWith('(') && e.endsWith(')') ? e.slice(1, -1) : e;
  return { minK, soloSumas, solucion: limpiar(mejor), solucionDiv: limpiar(mejorDiv) };
};

const azar = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const tableroTargetNormal = () => {
  let b, s;
  while (!s) {
    b = [azar(1, 10), azar(1, 10), azar(1, 10), azar(1, 10), [25, 50, 75, 100][azar(0, 3)], [25, 50, 75, 100][azar(0, 3)]];
    s = solveCountdown(b, 67);
  }
  return { numeros: b, solucion: s };
};

// Hard: sin vía solo de sumas/restas y sin solución con 4 números o menos (si tarda, se acepta 4) → hay que usar 5 o 6 números con × o ÷.
const tableroTargetDificil = () => {
  let reserva = null;
  for (let intento = 0; intento < 80; intento++) {
    const b = [azar(2, 10), azar(2, 10), azar(2, 10), azar(2, 10), azar(2, 10), [12, 15, 25, 50, 75, 100][azar(0, 5)]];
    const r = analizarTablero(b, 67);
    if (r.minK === Infinity || r.soloSumas) continue;
    const res = { numeros: b, solucion: r.solucionDiv || r.solucion };
    if (r.minK >= 5) return res;
    if (r.minK >= 4 && !reserva) reserva = res;
  }
  return reserva || tableroTargetNormal();
};

const TargetGame = ({ onBack, nivel = 'normal' }) => {
  const hard = nivel === 'hard';
  const [originalNums, setOriginalNums] = useState([]);
  const [nums, setNums] = useState([]);
  const [activeNum, setActiveNum] = useState(null);
  const [activeOp, setActiveOp] = useState(null);
  const [status, setStatus] = useState('loading');
  const [showInfo, setShowInfo] = useState(false);
  const [solution, setSolution] = useState(null);
  const [showSolutionModal, setShowSolutionModal] = useState(false);

  const generateNewBoard = useCallback(() => {
    setStatus('loading');
    // setTimeout: deja pintar «LOADING» mientras se busca un tablero difícil (~0,1 s cada uno)
    setTimeout(() => {
      const { numeros: b, solucion: s } = hard ? tableroTargetDificil() : tableroTargetNormal();
      setOriginalNums(b);
      setNums(b);
      setSolution(s);
      setActiveNum(null);
      setActiveOp(null);
      setStatus('playing');
      setShowSolutionModal(false);
    }, 30);
  }, [hard]);

  useEffect(() => {
    generateNewBoard();
  }, [generateNewBoard]);

  useEffect(() => {
    if (status !== 'won' && status !== 'lost') return;
    guardarRegistroLocal('SIXSEVEN', { titulo: `Six Seven · Target 67${hard ? ' (hard)' : ''}`, aciertos: status === 'won' ? 1 : 0, intentos: 1, via: 'juego' });
  }, [status]);

  const handleNumClick = (idx, e) => {
    if (status !== 'playing' || showInfo || showSolutionModal) return;
    audioManager.init();

    if (activeNum !== null && activeOp !== null && activeNum !== idx) {
      const n1 = nums[activeNum];
      const n2 = nums[idx];
      let res = 0;
      if (activeOp === '+') res = n1 + n2;
      if (activeOp === '-') res = Math.abs(n1 - n2);
      if (activeOp === '×') res = n1 * n2;
      if (activeOp === '÷') {
        if (n1 % n2 !== 0 && n2 % n1 !== 0) { setActiveOp(null); setActiveNum(idx); return; }
        res = n1 > n2 ? n1 / n2 : n2 / n1;
      }

      const newNums = nums.filter((_, i) => i !== activeNum && i !== idx);
      newNums.push(res);
      setNums(newNums);
      setActiveNum(null);
      setActiveOp(null);

      if (res === 67) {
        audioManager.play('win');
        lanzar67(e?.clientX, e?.clientY, 20);
        setStatus('won');
      } else if (newNums.length === 1) {
        audioManager.play('fail');
        setStatus('lost');
      }
    } else {
      setActiveNum(activeNum === idx ? null : idx);
    }
  };

  const resetCurrentBoard = () => { 
    setNums([...originalNums]); 
    setActiveNum(null); 
    setActiveOp(null); 
    setStatus('playing'); 
  };

  if (status === 'loading') return <div style={styles.wrapper}><div style={styles.glitchTitle}>LOADING...</div></div>;

  return (
    <div style={styles.wrapper}>
      <div style={styles.glassCard}>
        <InfoModal 
          isOpen={showInfo} 
          onClose={() => setShowInfo(false)} 
          title="Cómo jugar" 
          content={
            <ul>
              <li style={{marginBottom: '10px'}}>Tu objetivo es llegar exactamente al número <strong>67</strong>.</li>
              <li style={{marginBottom: '10px'}}>Toca un número, luego un operador matemático (+, -, ×, ÷), y luego otro número para operarlos.</li>
              {hard && <li style={{marginBottom: '10px'}}>Modo <strong>HARD</strong>: no se puede llegar solo sumando y restando, ni con pocos números. Necesitas multiplicar o dividir y usar casi todos los números.</li>}
              <li>Si te quedas sin números y no llegas al 67, pierdes. (¡Todos los tableros tienen solución exacta garantizada!)</li>
            </ul>
          } 
        />
        
        <InfoModal 
          isOpen={showSolutionModal} 
          onClose={() => setShowSolutionModal(false)} 
          title="Posible Solución" 
          content={
            <div style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 'bold', color: theme.neonCyan, margin: '20px 0' }}>
              {solution} = 67
            </div>
          } 
        />

        {status === 'won' ? (
          <WinScreen message="HACK SUCCESSFUL" color={theme.neonGreen} onMenu={onBack} onRestart={generateNewBoard} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={styles.btnSecondary} onClick={onBack}>← ABORT</button>
                <button style={styles.btnInfo} onClick={() => { audioManager.init(); setShowInfo(true); }}>?</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{...styles.btnInfo, color: theme.neonGreen, borderColor: theme.neonGreen, fontSize: '1.2rem'}} onClick={() => setShowSolutionModal(true)}>
                  💡
                </button>
                <button style={{...styles.btnSecondary, borderColor: theme.neonPink, color: theme.neonPink}} onClick={resetCurrentBoard}>
                  RESET
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ color: theme.muted, textTransform: 'uppercase', letterSpacing: '3px', fontSize: 'clamp(0.9rem, 2vw, 1.2rem)' }}>{hard ? 'Hard · Target Acquired' : 'Target Acquired'}</div>
              <div style={{ fontSize: 'clamp(5rem, 15vw, 9rem)', fontWeight: '900', color: theme.neonCyan, textShadow: `0 0 30px ${theme.neonCyan}`, lineHeight: 1 }}>
                67
              </div>
            </div>

            {status === 'lost' ? (
              <div style={{ textAlign: 'center', width: '100%', padding: '20px 0' }}>
                 <h2 style={{ color: theme.neonPink, fontSize: 'clamp(2.5rem, 6vw, 5rem)', textShadow: `0 0 20px ${theme.neonPink}`, margin: '0 0 30px 0' }}>SYSTEM FAILURE</h2>
                 <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                     <button style={{...styles.btnPrimary, background: theme.neonPink, color: '#000', maxWidth: '200px'}} onClick={resetCurrentBoard}>RETRY BOARD</button>
                     <button style={{...styles.btnPrimary, background: theme.neonCyan, color: '#000', maxWidth: '200px'}} onClick={generateNewBoard}>NEW GAME</button>
                 </div>
                 <button style={{...styles.btnSecondary, marginTop: '30px', padding: '15px 30px'}} onClick={() => setShowSolutionModal(true)}>VER SOLUCIÓN</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(10px, 3vw, 20px)', marginBottom: '40px', width: '100%' }}>
                  {nums.map((n, i) => {
                    const isActive = activeNum === i;
                    return (
                      <div
                        key={i}
                        onPointerDown={(e) => handleNumClick(i, e)}
                        style={{
                          background: isActive ? `linear-gradient(135deg, ${theme.neonCyan}, ${theme.neonPurple})` : 'rgba(255,255,255,0.05)',
                          border: `2px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                          color: isActive ? '#000' : '#fff',
                          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                          fontWeight: '900',
                          width: 'clamp(70px, 15vw, 110px)',
                          aspectRatio: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          boxShadow: isActive ? `0 0 20px ${theme.neonCyan}` : 'none',
                          transform: isActive ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(10px, 3vw, 20px)' }}>
                  {['+', '-', '×', '÷'].map((op) => {
                    const isActiveOp = activeOp === op;
                    return (
                      <div
                        key={op}
                        onPointerDown={() => {
                          audioManager.init();
                          if (activeNum !== null && !showInfo && !showSolutionModal) setActiveOp(op);
                        }}
                        style={{
                          background: isActiveOp ? theme.neonPink : 'transparent',
                          border: `2px solid ${activeNum === null ? 'rgba(255,255,255,0.1)' : theme.neonPink}`,
                          color: isActiveOp ? '#000' : (activeNum === null ? theme.muted : theme.neonPink),
                          fontSize: 'clamp(2rem, 5vw, 3rem)',
                          width: 'clamp(60px, 12vw, 90px)',
                          aspectRatio: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          cursor: activeNum !== null && !showInfo && !showSolutionModal ? 'pointer' : 'not-allowed',
                          boxShadow: isActiveOp ? `0 0 15px ${theme.neonPink}` : 'none',
                          transition: 'all 0.2s',
                          transform: isActiveOp ? 'scale(1.1)' : 'scale(1)'
                        }}
                      >
                        {op}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Neon Grid: jugadas disponibles ──────────────────────────────────────────
// Una jugada = camino de 3 casillas contiguas (A→B→C, como al deslizar) que cumple la operación del modo.
const GRID_COLS = 6, GRID_ROWS = 7, GRID_N = GRID_COLS * GRID_ROWS;
const VECINOS = Array.from({ length: GRID_N }, (_, i) => {
  const r = Math.floor(i / GRID_COLS), c = i % GRID_COLS, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < GRID_ROWS && cc >= 0 && cc < GRID_COLS) out.push(rr * GRID_COLS + cc);
  }
  return out;
});
const MAX_VALOR_GRID = 99;
const JUGADAS_MIN = 5;

const esTrioValido = (modo, a, b, c) => {
  if (modo === 'add') return a + b === c;
  if (modo === 'sub') return Math.abs(a - b) === c;
  if (modo === 'mul') return a * b === c;
  if (modo === 'div') return (b !== 0 && a / b === c) || (a !== 0 && b / a === c);
  return false;
};

// Número de jugadas distintas (mismas 3 casillas = 1 jugada)
const contarJugadas = (grid, modo) => {
  const vistas = new Set();
  for (let i1 = 0; i1 < GRID_N; i1++) {
    if (grid[i1] == null) continue;
    for (const i2 of VECINOS[i1]) {
      if (grid[i2] == null) continue;
      for (const i3 of VECINOS[i2]) {
        if (i3 === i1 || grid[i3] == null) continue;
        if (esTrioValido(modo, grid[i1], grid[i2], grid[i3])) vistas.add([i1, i2, i3].sort((x, y) => x - y).join(','));
      }
    }
  }
  return vistas.size;
};

// Valores que, puestos en `cell`, crean al menos una jugada (como resultado C o como primer número A)
const valoresQueCompletan = (grid, modo, cell) => {
  const cands = [];
  for (const i2 of VECINOS[cell]) {
    const b = grid[i2];
    if (b == null) continue;
    for (const io of VECINOS[i2]) {
      if (io === cell || grid[io] == null) continue;
      const o = grid[io];
      // cell como resultado: o (op) b = cell
      if (modo === 'add') cands.push(o + b);
      if (modo === 'sub') cands.push(Math.abs(o - b));
      if (modo === 'mul') cands.push(o * b);
      if (modo === 'div') { if (o % b === 0) cands.push(o / b); if (b % o === 0) cands.push(b / o); }
      // cell como primer número: cell (op) b = o
      if (modo === 'add') cands.push(o - b);
      if (modo === 'sub') { cands.push(b + o); cands.push(b - o); }
      if (modo === 'mul' && o % b === 0) cands.push(o / b);
      if (modo === 'div') { cands.push(b * o); if (b % o === 0) cands.push(b / o); }
    }
  }
  const min = modo === 'mul' || modo === 'div' ? 2 : 1;
  return cands.filter(v => Number.isInteger(v) && v >= min && v <= MAX_VALOR_GRID);
};

const elegir = (arr) => arr[Math.floor(Math.random() * arr.length)];
const barajar = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

// Garantiza al menos `objetivo` jugadas. Las casillas nuevas solo completan jugada a veces (probNatural);
// si aun así faltan, se retocan primero casillas nuevas y, en último caso, alguna antigua.
const asegurarJugadas = (grid, modo, nuevos, objetivo = JUGADAS_MIN, probNatural = 0.3) => {
  const g = [...grid];
  nuevos.forEach(i => {
    if (Math.random() < probNatural) {
      const c = valoresQueCompletan(g, modo, i);
      if (c.length) g[i] = elegir(c);
    }
  });
  const enNuevos = new Set(nuevos);
  const orden = [...barajar(nuevos), ...barajar(Array.from({ length: GRID_N }, (_, i) => i).filter(i => !enNuevos.has(i)))];
  for (let k = 0; k < orden.length && contarJugadas(g, modo) < objetivo; k++) {
    const i = orden[k];
    const antes = g[i];
    const c = valoresQueCompletan(g, modo, i);
    if (!c.length) continue;
    g[i] = elegir(c);
    // Si el retoque rompe más jugadas de las que crea, se deshace
    if (contarJugadas(g, modo) < contarJugadas([...g.slice(0, i), antes, ...g.slice(i + 1)], modo)) g[i] = antes;
  }
  return g;
};

const MatrixGame = ({ onBack, timeLimit, usuario }) => {
  const [verRanking, setVerRanking] = useState(false);
  const [subMode, setSubMode] = useState(null);
  const [grid, setGrid] = useState([]);
  const [selected, setSelected] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [status, setStatus] = useState('menu');
  const [showInfo, setShowInfo] = useState(false);
  const isDragging = useRef(false);
  const jugadasDisponibles = React.useMemo(
    () => (subMode && subMode !== 'multiples' && grid.length === GRID_N ? contarJugadas(grid, subMode) : 0),
    [grid, subMode]
  );
  const stats = useRef({ aciertos: 0, intentos: 0 });

  const MODOS_NOMBRE = { add: 'Suma', sub: 'Resta', mul: 'Multiplicación', div: 'División', multiples: 'Múltiplos' };
  const guardarPartida = () => {
    const { aciertos, intentos } = stats.current;
    if (intentos > 0) guardarRegistroLocal('SIXSEVEN', { titulo: `Six Seven · Neon Grid ${MODOS_NOMBRE[subMode] || ''} · ${score} pts`, aciertos, intentos, via: 'juego' });
    stats.current = { aciertos: 0, intentos: 0 };
  };
  const volverMenu = () => { guardarPartida(); setSubMode(null); setStatus('menu'); };

  useEffect(() => { if (status === 'won') guardarPartida(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateNumber = useCallback(() => {
    if (subMode === 'multiples') {
      if (Math.random() < 0.4) {
        const base = Math.random() > 0.5 ? 6 : 7;
        return base * (Math.floor(Math.random() * 12) + 1);
      }
      let val = Math.floor(Math.random() * 90) + 1;
      while (val % 6 === 0 || val % 7 === 0) val = Math.floor(Math.random() * 90) + 1;
      return val;
    }
    if (subMode === 'mul' || subMode === 'div') {
      return Math.random() > 0.5 ? Math.floor(Math.random() * 9) + 2 : Math.floor(Math.random() * 50) + 10;
    }
    return Math.floor(Math.random() * 40) + 1;
  }, [subMode]);

  useEffect(() => {
    if (subMode) {
      const inicial = Array.from({ length: GRID_N }, () => generateNumber());
      setGrid(subMode === 'multiples'
        ? inicial
        : asegurarJugadas(inicial, subMode, [], JUGADAS_MIN + (Math.random() < 0.5 ? 1 : 0), 0));
      setScore(0);
      setCombo(0);
      setTimeLeft(timeLimit);
      setStatus('playing');
    }
  }, [subMode, generateNumber, timeLimit]);

  useEffect(() => {
    if (status === 'playing' && timeLimit !== 'inf' && !showInfo) {
      const timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            audioManager.play('fail');
            setStatus('won'); 
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, timeLimit, showInfo]);

  const handlePointerDown = (e) => { 
    if (showInfo) return;
    audioManager.init();
    if (subMode === 'multiples') return; 
    isDragging.current = true; 
    processPointer(e); 
  };
  const handlePointerMove = (e) => { if (isDragging.current && !showInfo) processPointer(e); };
  const handlePointerUp = () => { isDragging.current = false; if (selected.length > 0 && selected.length < 3) setSelected([]); };

  const processPointer = (e) => {
    if (selected.length >= 3) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const elem = document.elementFromPoint(clientX, clientY);
    if (elem && elem.dataset.idx !== undefined) {
      const idx = parseInt(elem.dataset.idx, 10);
      if (!selected.includes(idx)) {
        if (selected.length === 0) setSelected([idx]);
        else {
          const lastIdx = selected[selected.length - 1];
          const r1 = Math.floor(lastIdx / 6), c1 = lastIdx % 6;
          const r2 = Math.floor(idx / 6), c2 = idx % 6;
          
          if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
            const newSel = [...selected, idx];
            setSelected(newSel);
            if (newSel.length === 3) validateAndResolve(newSel);
          }
        }
      }
    }
  };

  const applyGravity = (currentGrid) => {
    let newGrid = [...currentGrid];
    const nuevos = [];
    for (let c = 0; c < 6; c++) {
      let colVals = [];
      for (let r = 0; r < 7; r++) if (newGrid[r * 6 + c] !== null) colVals.push(newGrid[r * 6 + c]);
      const faltan = 7 - colVals.length;
      while (colVals.length < 7) colVals.unshift(generateNumber());
      for (let r = 0; r < 7; r++) newGrid[r * 6 + c] = colVals[r];
      for (let r = 0; r < faltan; r++) nuevos.push(r * 6 + c);
    }
    if (subMode === 'multiples') return newGrid;
    return asegurarJugadas(newGrid, subMode, nuevos);
  };

  const handleMultipleTap = (idx, e) => {
    if (status !== 'playing' || subMode !== 'multiples' || showInfo) return;
    const val = grid[idx];
    if (val === null) return;
    stats.current.intentos++;
    if (val % 6 === 0 || val % 7 === 0 || val === 67) {
      stats.current.aciertos++;
      audioManager.play('win');
      lanzar67(e?.clientX, e?.clientY, Math.min(3 + combo, 10));
      setCombo(c => c + 1);
      setScore(s => s + 50 * (combo + 1));
      setGrid(prev => {
        let newGrid = [...prev];
        newGrid[idx] = null;
        return applyGravity(newGrid);
      });
    } else {
      audioManager.play('fail');
      setCombo(0);
      setScore(s => Math.max(0, s - 10));
    }
  };

  const validateAndResolve = (sel) => {
    const [i1, i2, i3] = sel;
    const v1 = grid[i1], v2 = grid[i2], v3 = grid[i3];
    
    let isValid = false;
    if (subMode === 'add') isValid = v1 + v2 === v3;
    if (subMode === 'sub') isValid = Math.abs(v1 - v2) === v3;
    if (subMode === 'mul') isValid = v1 * v2 === v3;
    if (subMode === 'div') isValid = (v2 !== 0 && v1 / v2 === v3) || (v1 !== 0 && v2 / v1 === v3);

    stats.current.intentos++;
    if (isValid) {
      stats.current.aciertos++;
      audioManager.play('win');
      const especial = v3 === 6 || v3 === 7 || v3 === 67;
      lanzar67DesdeElemento(document.querySelector(`[data-idx="${i3}"]`), Math.min((especial ? 8 : 3) + combo, 14));
      setCombo(c => c + 1);
      setScore(s => s + ((v3 === 6 || v3 === 7 || v3 === 67 ? 50 : 10) * (combo + 1)));
      
      setTimeout(() => {
        setGrid(prevGrid => {
          let newGrid = [...prevGrid];
          newGrid[i1] = null; newGrid[i2] = null; newGrid[i3] = null;
          return applyGravity(newGrid);
        });
        setSelected([]);
      }, 250);
    } else {
      audioManager.play('fail');
      setCombo(0);
      setTimeout(() => setSelected([]), 300);
    }
  };

  if (status === 'menu') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.glassCard}>
           <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
              <button style={styles.btnInfo} onClick={() => { audioManager.init(); setShowInfo(true); }}>?</button>
           </div>
           
           <InfoModal 
             isOpen={showInfo} 
             onClose={() => setShowInfo(false)} 
             title="Cómo jugar" 
             content={
               <ul>
                 <li style={{marginBottom: '10px'}}>En los modos de <strong>operación</strong>, desliza el dedo/ratón conectando 3 bloques seguidos para hacer un cálculo (Ej: 2, 3, 5 para 2+3=5).</li>
                 <li style={{marginBottom: '10px'}}>En el modo <strong>Múltiplos</strong>, toca rápidamente los bloques que sean múltiplos de 6 o de 7.</li>
                 <li>Si usas un 6, un 7 o un 67 en tus combinaciones, ¡ganarás muchos más puntos!</li>
               </ul>
             } 
           />

           <h2 style={{...styles.glitchTitle, fontSize: 'clamp(2rem, 6vw, 4rem)', marginBottom: '30px', marginTop: '20px'}}>SELECT PROTOCOL</h2>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px' }}>
              <button style={{...styles.btnPrimary, background: theme.neonCyan, color: '#000'}} onClick={()=>setSubMode('add')}>SUMA (+)</button>
              <button style={{...styles.btnPrimary, background: theme.neonPink, color: '#000'}} onClick={()=>setSubMode('sub')}>RESTA (-)</button>
              <button style={{...styles.btnPrimary, background: theme.neonPurple}} onClick={()=>setSubMode('mul')}>MULTIPLICACIÓN (×)</button>
              <button style={{...styles.btnPrimary, background: '#FF9500', color: '#000'}} onClick={()=>setSubMode('div')}>DIVISIÓN (÷)</button>
              <button style={{...styles.btnPrimary, background: theme.neonGreen, color: '#000', marginTop: '20px'}} onClick={()=>setSubMode('multiples')}>
                 <span>FIND MULTIPLES</span>
                 <span style={{fontSize:'0.9rem', color:'rgba(0,0,0,0.7)'}}>TAP 6 & 7 MULTIPLES</span>
              </button>
           </div>
           <button style={{...styles.btnSecondary, marginTop: '30px'}} onClick={onBack}>← MAIN MENU</button>
        </div>
      </div>
    );
  }

  if (status === 'won') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.glassCard}>
           <WinScreen score={score} message={timeLimit === 'inf' ? 'SESSION ENDED' : 'TIME UP!'} color={theme.neonPink} onMenu={onBack} onRestart={() => { setSubMode(null); setVerRanking(false); setStatus('menu'); }}>
             {timeLimit !== 'inf' && (
               <button style={{...styles.btnPrimary, width: 'auto', padding: '15px 30px', marginBottom: '20px'}} onClick={() => setVerRanking(true)}>
                 🏆 {score > 0 ? 'GUARDAR EN RANKING' : 'VER RANKING'}
               </button>
             )}
           </WinScreen>
        </div>
        {verRanking && (
          <RankingSixSeven
            jugada={{ juego: 'matrix', sel: { modo: subMode, tiempo: String(timeLimit) }, puntos: score }}
            usuario={usuario} onClose={() => setVerRanking(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{...styles.wrapper, touchAction: 'none'}} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <InfoModal 
        isOpen={showInfo} 
        onClose={() => setShowInfo(false)} 
        title="Recordatorio" 
        content={
          subMode === 'multiples' 
          ? "Toca los bloques que sean múltiplos de 6 o de 7. (Ej: 12, 14, 21, 24...)"
          : `Desliza el dedo conectando 3 bloques para hacer la operación seleccionada (A ${subMode==='add'?'+':subMode==='sub'?'-':subMode==='mul'?'×':'÷'} B = C).`
        } 
      />

      <div style={{ width: '100%', maxWidth: '600px', filter: showInfo ? 'blur(3px)' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.btnSecondary} onClick={volverMenu}>← ABORT</button>
              <button style={{...styles.btnInfo, width: '36px', height: '36px', fontSize: '1.2rem'}} onClick={() => { audioManager.init(); setShowInfo(true); }}>?</button>
            </div>
            <div style={{ color: timeLeft !== 'inf' && timeLeft <= 10 ? theme.neonPink : '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
              {timeLeft === 'inf' ? 'TIME: Ꝏ' : `TIME: ${timeLeft}s`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: theme.neonCyan, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: '900', textShadow: `0 0 10px ${theme.neonCyan}` }}>
              {score} PTS
            </div>
            {combo > 1 && <div style={{ color: theme.neonPink, fontSize: '1rem', fontWeight: 'bold' }}>{combo}x COMBO!</div>}
          </div>
        </div>

        {subMode !== 'multiples' && (
           <div style={{ textAlign: 'center', color: theme.muted, marginBottom: '10px', fontSize: '0.9rem', letterSpacing: '1px' }}>
             SWIPE 3 BLOCKS: A {subMode === 'add' ? '+' : subMode === 'sub' ? '-' : subMode === 'mul' ? '×' : '÷'} B = C · <span style={{ color: theme.neonGreen }}>{jugadasDisponibles} JUGADAS</span>
           </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'clamp(4px, 1vw, 10px)',
          width: '100%', aspectRatio: '6/7', background: 'rgba(255,255,255,0.02)',
          padding: 'clamp(10px, 2vw, 20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
        }}>
          {grid.map((val, idx) => {
            const isSel = selected.includes(idx);
            const isLast = selected[selected.length - 1] === idx;
            return (
              <div 
                key={idx} 
                data-idx={idx} 
                onPointerDown={subMode === 'multiples' && !showInfo ? (e) => handleMultipleTap(idx, e) : undefined}
                style={{
                  background: isSel ? `linear-gradient(135deg, ${theme.neonPurple}, ${theme.neonPink})` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isSel ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                  color: isSel ? '#fff' : theme.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'clamp(1.2rem, 4vw, 2.5rem)', fontWeight: '900', borderRadius: '12px',
                  boxShadow: isSel ? `0 0 15px ${theme.neonPink}` : 'none',
                  transform: isLast ? 'scale(1.15)' : (isSel ? 'scale(1.05)' : 'scale(1)'),
                  transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  opacity: val === null ? 0 : 1,
                  cursor: subMode === 'multiples' && !showInfo ? 'pointer' : 'default'
                }}
              >
                {val}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SettingsScreen = ({ settings, updateSettings, onBack }) => (
  <div style={styles.wrapper}>
    <div style={styles.glassCard}>
      <h2 style={{...styles.glitchTitle, fontSize: 'clamp(2rem, 6vw, 4rem)', marginBottom: '30px'}}>SETTINGS</h2>
      
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        <div>
          <div style={{ color: theme.neonCyan, fontWeight: 'bold', marginBottom: '10px', fontSize: '1.2rem', textTransform: 'uppercase' }}>
            Arcade Time (Per Round)
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[13, 'inf'].map(val => (
              <button key={val} onClick={() => updateSettings('arcadeTime', val)} style={{
                flex: 1, padding: '15px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                background: settings.arcadeTime === val ? theme.neonPink : 'transparent',
                color: settings.arcadeTime === val ? '#000' : theme.text,
                border: `2px solid ${settings.arcadeTime === val ? theme.neonPink : 'rgba(255,255,255,0.2)'}`,
                transition: 'all 0.2s'
              }}>
                {val === 'inf' ? 'Ꝏ (No Time)' : `${val}s`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ color: theme.neonCyan, fontWeight: 'bold', marginBottom: '10px', fontSize: '1.2rem', textTransform: 'uppercase' }}>
            Matrix Grid Time
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[67, 130, 'inf'].map(val => (
              <button key={val} onClick={() => updateSettings('matrixTime', val)} style={{
                flex: 1, padding: '15px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                background: settings.matrixTime === val ? theme.neonGreen : 'transparent',
                color: settings.matrixTime === val ? '#000' : theme.text,
                border: `2px solid ${settings.matrixTime === val ? theme.neonGreen : 'rgba(255,255,255,0.2)'}`,
                transition: 'all 0.2s'
              }}>
                {val === 'inf' ? 'Ꝏ' : `${val}s`}
              </button>
            ))}
          </div>
        </div>

      </div>
      <button style={{...styles.btnSecondary, marginTop: '40px', padding: '15px 30px'}} onClick={onBack}>← SAVE & RETURN</button>
    </div>
  </div>
);

const MainMenu = ({ setMode, onExit, usuario }) => {
  const [verRanking, setVerRanking] = useState(false);
  useChorro67(900, 1);

  const handlePointerDownInit = (e, nextMode) => {
    audioManager.init();
    e.currentTarget.style.transform = 'scale(0.95)';
    setMode(nextMode);
  };

  return (
    <div style={styles.wrapper}>
      {onExit && (
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <button style={styles.btnSecondary} onClick={onExit}>← SALIR</button>
        </div>
      )}
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
         <button style={styles.btnSecondary} onClick={() => { audioManager.init(); setMode('settings'); }}>⚙ SETTINGS</button>
      </div>

      <h1
        style={{ ...styles.glitchTitle, cursor: 'pointer', marginTop: '50px' }}
        onPointerDown={(e) => lanzar67(e.clientX, e.clientY, 10)}
      >SIX<br/>SEVEN</h1>
      <p style={{
          fontSize: 'clamp(1rem, 3vw, 1.5rem)', color: theme.neonCyan, textTransform: 'uppercase',
          letterSpacing: '4px', marginBottom: 'clamp(30px, 6vw, 50px)', textAlign: 'center', fontWeight: '600'
      }}>Select Neural Link</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '400px' }}>
        <button style={styles.btnPrimary} onPointerDown={(e) => handlePointerDownInit(e, 'arcade')}>
          <span>Speed Run</span>
          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', fontWeight: 'normal' }}>6 Rounds • Always 67</span>
        </button>
        
        <button style={{...styles.btnPrimary, background: `linear-gradient(90deg, #0072FF, ${theme.neonCyan})`, boxShadow: `0 0 20px rgba(0,240,255,0.4)`}} onPointerDown={(e) => handlePointerDownInit(e, 'target')}>
          <span>Target 67</span>
          <span style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.6)', letterSpacing: '1px', fontWeight: 'bold' }}>Crack the Code</span>
        </button>
        
        <button style={{...styles.btnPrimary, background: `linear-gradient(90deg, #0BA360, ${theme.neonGreen})`, boxShadow: `0 0 20px rgba(57,255,20,0.4)`}} onPointerDown={(e) => handlePointerDownInit(e, 'matrix')}>
          <span style={{color: '#000'}}>Neon Grid</span>
          <span style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.6)', letterSpacing: '1px', fontWeight: 'bold' }}>Multiple Modes</span>
        </button>

        <button style={{...styles.btnSecondary, marginTop: '10px', padding: '14px 20px', borderColor: theme.neonPurple, color: theme.neonPurple, boxShadow: `0 0 12px rgba(176,38,255,0.35)`}} onClick={() => setVerRanking(true)}>
          🏆 RANKINGS
        </button>
      </div>
      {verRanking && <RankingSixSeven usuario={usuario} onClose={() => setVerRanking(false)} />}
    </div>
  );
};

export default function SixSeven({ onExit, usuario = null }) {
  const [mode, setMode] = useState('menu');
  const [settings, setSettings] = useState({ arcadeTime: 13, matrixTime: 67 });
  useWindowSize();

  const [nivel, setNivel] = useState(null); // 'normal' | 'hard' para Speed Run y Target 67
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* ignorar */ } }, []);

  const alMenu = () => { setNivel(null); setMode('menu'); };

  let pantalla;
  if (mode === 'settings') pantalla = <SettingsScreen settings={settings} updateSettings={(k, v) => setSettings(s => ({...s, [k]: v}))} onBack={() => setMode('menu')} />;
  else if ((mode === 'arcade' || mode === 'target') && !nivel) pantalla = mode === 'arcade'
    ? <SelectorNivel titulo="SPEED RUN" normal="Como siempre: opciones cercanas a la respuesta" dificil="Todas las opciones acaban en la misma cifra" onElegir={setNivel} onBack={alMenu} />
    : <SelectorNivel titulo="TARGET 67" normal="Como siempre: sumas y restas suelen bastar" dificil="Necesitas × o ÷ y usar casi todos los números" onElegir={setNivel} onBack={alMenu} />;
  else if (mode === 'arcade') pantalla = <ArcadeGame key={nivel} nivel={nivel} usuario={usuario} timeLimit={settings.arcadeTime} onBack={alMenu} />;
  else if (mode === 'target') pantalla = <TargetGame key={nivel} nivel={nivel} onBack={alMenu} />;
  else if (mode === 'matrix') pantalla = <MatrixGame usuario={usuario} timeLimit={settings.matrixTime} onBack={() => setMode('menu')} />;
  else pantalla = <MainMenu setMode={setMode} onExit={onExit} usuario={usuario} />;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: theme.bg, overflowY: 'auto', overflowX: 'hidden' }}>
      {pantalla}
      <CapaSeisSiete />
    </div>
  );
}