// Six Seven 🔢 — minijuegos de cálculo mental alrededor del 67 (Speed Run, Target 67, Neon Grid).
// Efecto propio: «6» y «7» que suben flotando como los corazones de un directo (lanzar67).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { guardarRegistroLocal } from './utils/registrosLocales';

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

const WinScreen = ({ score, onMenu, onRestart, message = "GOD TIER", color = theme.neonGreen }) => {
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

const ArcadeGame = ({ onBack, timeLimit }) => {
  const [round, setRound] = useState(1);
  const maxTime = timeLimit === 'inf' ? null : timeLimit * 1000;
  const [time, setTime] = useState(maxTime);
  const [status, setStatus] = useState('playing');
  const [question, setQuestion] = useState(null);
  const [flash, setFlash] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  const generateQuestion = useCallback((currentRound) => {
    let q = '';
    let ans = 0;
    const is67First = Math.random() > 0.5;

    if (currentRound <= 2) {
      const b = Math.floor(Math.random() * 30) + 1;
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        q = is67First ? `67 + ${b}` : `${b} + 67`;
        ans = 67 + b;
      } else {
        q = is67First ? `67 - ${b}` : `${b + 67} - 67`;
        ans = is67First ? 67 - b : b;
      }
    } else if (currentRound <= 4) {
      const b = Math.floor(Math.random() * 9) + 2;
      q = is67First ? `67 × ${b}` : `${b} × 67`;
      ans = 67 * b;
    } else {
      const b = Math.floor(Math.random() * 5) + 2;
      const c = Math.floor(Math.random() * 20) + 1;
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        q = is67First ? `67 × ${b} + ${c}` : `${c} + 67 × ${b}`;
        ans = 67 * b + c;
      } else {
        q = is67First ? `67 × ${b} - ${c}` : `${c + 67 * b} - 67 × ${b}`;
        ans = is67First ? 67 * b - c : c;
      }
    }
    
    let opts = new Set([ans]);
    while (opts.size < 4) {
        let offset = Math.floor(Math.random() * 15) + 1;
        const cand = ans + (Math.random() > 0.5 ? offset : -offset);
        if (cand >= 0) opts.add(cand);
    }
    
    setQuestion({ q, ans, options: Array.from(opts).sort(() => Math.random() - 0.5) });
    setTime(maxTime);
  }, [maxTime]);

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
    guardarRegistroLocal('SIXSEVEN', { titulo: 'Six Seven · Speed Run', aciertos, intentos: status === 'won' ? 6 : round, via: 'juego' });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = (opt, e) => {
    if (status !== 'playing') return;
    if (opt === question.ans) {
      lanzar67(e?.clientX, e?.clientY, round === 6 ? 14 : 4 + round);
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
              <li>¡Llega hasta el final para ver la celebración secreta!</li>
            </ul>
          } 
        />

        {status === 'won' ? (
          <WinScreen message="¡SIX SEVEN SUPERADO!" color={theme.neonCyan} onMenu={onBack} onRestart={() => { setRound(1); setStatus('playing'); generateQuestion(1); setFlash(null); }} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '30px' }}>
              <button style={styles.btnSecondary} onClick={onBack}>← ABORT</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ color: theme.neonCyan, fontWeight: '900', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', letterSpacing: '2px' }}>
                  LVL {round}/6
                </div>
                <button style={styles.btnInfo} onClick={() => { audioManager.init(); setShowInfo(true); }}>?</button>
              </div>
            </div>

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
                <button style={{...styles.btnPrimary, background: theme.neonPink, color: '#000', maxWidth: '300px', margin: '0 auto'}} onClick={() => { setRound(1); setStatus('playing'); generateQuestion(1); setFlash(null); }}>
                  RETRY
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TargetGame = ({ onBack }) => {
  const [originalNums, setOriginalNums] = useState([]);
  const [nums, setNums] = useState([]);
  const [activeNum, setActiveNum] = useState(null);
  const [activeOp, setActiveOp] = useState(null);
  const [status, setStatus] = useState('loading');
  const [showInfo, setShowInfo] = useState(false);
  const [solution, setSolution] = useState(null);
  const [showSolutionModal, setShowSolutionModal] = useState(false);

  const generateNewBoard = useCallback(() => {
    let b, s;
    while (!s) {
      b = [
        Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1,
        Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1,
        [25, 50, 75, 100][Math.floor(Math.random() * 4)],
        [25, 50, 75, 100][Math.floor(Math.random() * 4)]
      ];
      s = solveCountdown(b, 67);
    }
    setOriginalNums(b);
    setNums(b);
    setSolution(s);
    setActiveNum(null);
    setActiveOp(null);
    setStatus('playing');
    setShowSolutionModal(false);
  }, []);

  useEffect(() => {
    generateNewBoard();
  }, [generateNewBoard]);

  useEffect(() => {
    if (status !== 'won' && status !== 'lost') return;
    guardarRegistroLocal('SIXSEVEN', { titulo: 'Six Seven · Target 67', aciertos: status === 'won' ? 1 : 0, intentos: 1, via: 'juego' });
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
              <div style={{ color: theme.muted, textTransform: 'uppercase', letterSpacing: '3px', fontSize: 'clamp(0.9rem, 2vw, 1.2rem)' }}>Target Acquired</div>
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

const MatrixGame = ({ onBack, timeLimit }) => {
  const [subMode, setSubMode] = useState(null);
  const [grid, setGrid] = useState([]);
  const [selected, setSelected] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [status, setStatus] = useState('menu');
  const [showInfo, setShowInfo] = useState(false);
  const isDragging = useRef(false);
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
      setGrid(Array.from({ length: 42 }, () => generateNumber()));
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
    for (let c = 0; c < 6; c++) {
      let colVals = [];
      for (let r = 0; r < 7; r++) if (newGrid[r * 6 + c] !== null) colVals.push(newGrid[r * 6 + c]);
      while (colVals.length < 7) colVals.unshift(generateNumber());
      for (let r = 0; r < 7; r++) newGrid[r * 6 + c] = colVals[r];
    }
    return newGrid;
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
           <WinScreen score={score} message={timeLimit === 'inf' ? 'SESSION ENDED' : 'TIME UP!'} color={theme.neonPink} onMenu={onBack} onRestart={() => { setSubMode(null); setStatus('menu'); }} />
        </div>
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
             SWIPE 3 BLOCKS: A {subMode === 'add' ? '+' : subMode === 'sub' ? '-' : subMode === 'mul' ? '×' : '÷'} B = C
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

const MainMenu = ({ setMode, onExit }) => {
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
      </div>
    </div>
  );
};

export default function SixSeven({ onExit }) {
  const [mode, setMode] = useState('menu');
  const [settings, setSettings] = useState({ arcadeTime: 13, matrixTime: 67 });
  useWindowSize();

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* ignorar */ } }, []);

  let pantalla;
  if (mode === 'settings') pantalla = <SettingsScreen settings={settings} updateSettings={(k, v) => setSettings(s => ({...s, [k]: v}))} onBack={() => setMode('menu')} />;
  else if (mode === 'arcade') pantalla = <ArcadeGame timeLimit={settings.arcadeTime} onBack={() => setMode('menu')} />;
  else if (mode === 'target') pantalla = <TargetGame onBack={() => setMode('menu')} />;
  else if (mode === 'matrix') pantalla = <MatrixGame timeLimit={settings.matrixTime} onBack={() => setMode('menu')} />;
  else pantalla = <MainMenu setMode={setMode} onExit={onExit} />;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: theme.bg, overflowY: 'auto', overflowX: 'hidden' }}>
      {pantalla}
      <CapaSeisSiete />
    </div>
  );
}