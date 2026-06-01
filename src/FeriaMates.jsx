import React, { useState, useEffect, useRef } from 'react';
import sonidoCorrecto from './assets/correct-choice-43861.mp3';
import sonidoFallo    from './assets/negative_beeps-6008.mp3';
import fondoImg       from './assets/pantalla1.jpeg';
import TironCuerdaJuego from './TironCuerda';

const COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7',
  '#DDA0DD','#FF9A9E','#A8E063','#F9CA24','#6C5CE7','#FD79A8','#55EFC4',
];

const STARS = [
  {l:5,t:10},{l:15,t:30},{l:25,t:15},{l:35,t:45},{l:48,t:8},
  {l:58,t:38},{l:68,t:20},{l:78,t:55},{l:88,t:12},{l:93,t:42},
  {l:10,t:65},{l:80,t:70},{l:42,t:55},{l:60,t:75},{l:30,t:80},
];

const CSS = `
  @keyframes floatUp {
    from { bottom: -90px; opacity: 1; }
    to   { bottom: 108%; opacity: 0.7; }
  }
  @keyframes shakeMal {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-10px); }
    50%     { transform: translateX(10px); }
    80%     { transform: translateX(-6px); }
  }
  @keyframes flashOk {
    0%   { opacity: 0.5; }
    100% { opacity: 0; }
  }
  @keyframes cortinaIzq {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
  @keyframes cortinaDer {
    0%   { transform: translateX(0); }
    100% { transform: translateX(100%); }
  }
  @keyframes gearSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

// ── Helpers fracciones ───────────────────────────────────────────────────────
function gcd(a, b) { return b === 0 ? Math.abs(a) : gcd(b, Math.abs(a % b)); }
function reducir(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d);
  return { n: n / g, d: d / g };
}
function fracStr(n, d) {
  const r = reducir(n, d);
  if (r.d === 1) return String(r.n);
  return `${r.n}/${r.d}`;
}

const FRAC_POOL = [
  '1/2','1/3','2/3','1/4','3/4','1/5','2/5','3/5','4/5',
  '1/6','5/6','1/8','3/8','5/8','7/8','3/2','5/4','7/4','4/3','5/3',
];

const OPS_NATURALES = ['suma','resta','multi','div'];
const OPS_OTROS     = ['suma','resta','multi']; // sin div para decimales/negativos

// ── Generadores de operaciones ───────────────────────────────────────────────
function generarOpNaturales(tiposOp = OPS_NATURALES, primaria = false) {
  const pool = tiposOp.filter(o => OPS_NATURALES.includes(o));
  const tipo = pool[Math.floor(Math.random() * pool.length)];
  let n1, n2, ans, txt;
  if (tipo === 'suma') {
    n1 = primaria ? Math.floor(Math.random()*20)+1  : Math.floor(Math.random()*50)+10;
    n2 = primaria ? Math.floor(Math.random()*20)+1  : Math.floor(Math.random()*40)+10;
    ans = n1+n2; txt = `${n1} + ${n2}`;
  } else if (tipo === 'resta') {
    n1 = primaria ? Math.floor(Math.random()*20)+11 : Math.floor(Math.random()*60)+30;
    n2 = primaria ? Math.floor(Math.random()*n1)+1  : Math.floor(Math.random()*(n1-10))+5;
    ans = n1-n2; txt = `${n1} − ${n2}`;
  } else if (tipo === 'multi') {
    n1 = primaria ? Math.floor(Math.random()*9)+2   : Math.floor(Math.random()*9)+2;
    n2 = primaria ? Math.floor(Math.random()*9)+2   : Math.floor(Math.random()*9)+2;
    ans = n1*n2; txt = `${n1} × ${n2}`;
  } else {
    n2 = primaria ? Math.floor(Math.random()*8)+2   : Math.floor(Math.random()*8)+2;
    const coc = primaria ? Math.floor(Math.random()*9)+2 : Math.floor(Math.random()*12)+2;
    n1 = n2*coc; ans = coc; txt = `${n1} ÷ ${n2}`;
  }
  return { texto: txt, respuesta: ans };
}

function generarOpDecimales(tiposOp = OPS_OTROS) {
  const pool = tiposOp.filter(o => OPS_OTROS.includes(o));
  const tipo = pool[Math.floor(Math.random() * pool.length)];
  const d1 = () => Math.round((Math.random()*9+1)*10)/10;
  let n1, n2, ans, txt;
  if (tipo === 'suma') {
    n1 = d1(); n2 = d1();
    ans = Math.round((n1+n2)*10)/10; txt = `${n1} + ${n2}`;
  } else if (tipo === 'resta') {
    n1 = Math.round((Math.random()*9+5)*10)/10;
    n2 = Math.round((Math.random()*4+1)*10)/10;
    ans = Math.round((n1-n2)*10)/10; txt = `${n1} − ${n2}`;
  } else {
    n1 = Math.round((Math.random()*4+1)*10)/10;
    n2 = Math.floor(Math.random()*5)+2;
    ans = Math.round(n1*n2*10)/10; txt = `${n1} × ${n2}`;
  }
  return { texto: txt, respuesta: ans };
}

function generarOpNegativos(tiposOp = OPS_OTROS) {
  const pool = tiposOp.filter(o => OPS_OTROS.includes(o));
  const tipo = pool[Math.floor(Math.random() * pool.length)];
  const fmt  = n => n < 0 ? `(${n})` : `${n}`;
  let n1, n2, ans, txt;
  if (tipo === 'suma') {
    n1 = Math.floor(Math.random()*21)-10; n2 = Math.floor(Math.random()*21)-10;
    ans = n1+n2; txt = `${fmt(n1)} + ${fmt(n2)}`;
  } else if (tipo === 'resta') {
    n1 = Math.floor(Math.random()*21)-10; n2 = Math.floor(Math.random()*21)-10;
    ans = n1-n2; txt = `${fmt(n1)} − ${fmt(n2)}`;
  } else {
    n1 = Math.floor(Math.random()*7)-3; n2 = Math.floor(Math.random()*7)-3;
    ans = n1*n2; txt = `${fmt(n1)} × ${fmt(n2)}`;
  }
  return { texto: txt, respuesta: ans };
}

function generarOpFracciones() {
  const nums  = [[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[5,6]];
  const [n1,d1] = nums[Math.floor(Math.random()*nums.length)];
  const [n2,d2] = nums[Math.floor(Math.random()*nums.length)];
  const tipo    = Math.random() > 0.5 ? 'suma' : 'resta';
  const rn = tipo === 'suma' ? n1*d2 + n2*d1 : n1*d2 - n2*d1;
  const rd = d1*d2;
  const r  = reducir(rn, rd);
  return {
    texto:    `${fracStr(n1,d1)} ${tipo==='suma'?'+':'−'} ${fracStr(n2,d2)}`,
    respuesta: fracStr(r.n, r.d),
  };
}

function generarOp(tipoNum = 'naturales', tiposOp = OPS_NATURALES, primaria = false) {
  if (tipoNum === 'decimales')  return generarOpDecimales(tiposOp);
  if (tipoNum === 'negativos')  return generarOpNegativos(tiposOp);
  if (tipoNum === 'fracciones') return generarOpFracciones();
  return generarOpNaturales(tiposOp, primaria);
}

// ── Crear globos ─────────────────────────────────────────────────────────────
function crearGlobos(resp, n = 4, tipoNum = 'naturales', tiempoPregunta = 14) {
  const dur  = () => (tiempoPregunta * 0.7) + Math.random() * (tiempoPregunta * 0.3);
  const base = (i) => ({ dur: dur(), delay: i*0.3, color: COLORS[Math.floor(Math.random()*COLORS.length)],
    left: 6 + i*(n===3?28:22)+Math.floor(Math.random()*6) });

  if (tipoNum === 'fracciones') {
    const set  = new Set([String(resp)]);
    const pool = FRAC_POOL.filter(f => f !== String(resp));
    let t = 0;
    while (set.size < n && t++ < 80) set.add(pool[Math.floor(Math.random()*pool.length)]);
    return Array.from(set).sort(()=>Math.random()-.5).map((v, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`, valor: v, ...base(i),
    }));
  }

  const set = new Set([resp]);
  let t = 0;
  while (set.size < n && t++ < 80) {
    let f;
    if (tipoNum === 'decimales') {
      const d = (Math.floor(Math.random()*5)+1)*0.1*(Math.random()>.5?1:-1);
      f = Math.round((resp+d)*10)/10;
    } else {
      const d = (Math.floor(Math.random()*5)+1)*(Math.random()>.5?1:-1);
      f = resp+d;
      if (tipoNum === 'naturales' && f <= 0) continue;
    }
    if (f !== resp) set.add(f);
  }
  return Array.from(set).sort(()=>Math.random()-.5).map((v, i) => ({
    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`, valor: v, ...base(i),
  }));
}

// ── BalloonField ─────────────────────────────────────────────────────────────
function BalloonField({ globos, onClickGlobo, globoMal, flashOk, altura = 340 }) {
  return (
    <div style={{ position:'relative', height:altura, overflow:'hidden',
      background:'linear-gradient(180deg,#0a1628 0%,#1b3a5c 65%,#2d5986 100%)' }}>
      {STARS.map((s, i) => (
        <div key={i} style={{ position:'absolute', width:2, height:2, borderRadius:'50%',
          background:'white', opacity:0.45, left:`${s.l}%`, top:`${s.t}%` }}/>
      ))}
      {flashOk && (
        <div style={{ position:'absolute', inset:0, background:'rgba(76,217,100,0.4)',
          zIndex:5, animation:'flashOk 0.5s ease forwards', pointerEvents:'none' }}/>
      )}
      {globos.map(g => {
        const esFrac = typeof g.valor === 'string' && g.valor.includes('/');
        return (
          <div key={g.id} style={{ position:'absolute', left:`${g.left}%`, bottom:'-90px',
            zIndex:2, animation:`floatUp ${g.dur}s ${g.delay}s linear forwards`, textAlign:'center' }}>
            <div onClick={()=>onClickGlobo(g)} style={{
              cursor:'pointer', userSelect:'none',
              animation: globoMal===g.id ? 'shakeMal 0.45s ease' : 'none',
            }}>
              <div style={{
                width:62, height:78,
                background:`radial-gradient(circle at 35% 28%, rgba(255,255,255,0.55) 0%, ${g.color} 48%, ${g.color}bb 100%)`,
                borderRadius:'50% 50% 50% 50% / 58% 58% 42% 42%',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: esFrac ? '0.82rem' : '1.3rem',
                fontWeight:900, color:'white',
                textShadow:'1px 1px 4px rgba(0,0,0,0.65)',
                boxShadow:`0 6px 20px ${g.color}66, inset 0 -4px 10px rgba(0,0,0,0.2)`,
                position:'relative',
              }}>
                {g.valor}
                <div style={{ position:'absolute', bottom:-9, left:'50%', transform:'translateX(-50%)',
                  width:0, height:0, borderLeft:'5px solid transparent',
                  borderRight:'5px solid transparent', borderTop:`9px solid ${g.color}` }}/>
              </div>
              <div style={{ width:1.5, height:28, background:'rgba(255,255,255,0.35)', margin:'0 auto' }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Config metadata ───────────────────────────────────────────────────────────
const TIPO_INFO = {
  naturales:  { label:'Naturales',  emoji:'🔢', desc:'Sumas, restas, × y ÷' },
  decimales:  { label:'Decimales',  emoji:'🔣', desc:'Números con coma decimal' },
  negativos:  { label:'Negativos',  emoji:'➖', desc:'Incluye números negativos' },
  fracciones: { label:'Fracciones', emoji:'½',  desc:'Operaciones con fracciones' },
};

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function JuegoFeriaOAOA({ primaria = false }) {
  const [pantalla,   setPantalla]   = useState(primaria ? 'selector' : 'menu');
  const [modo,       setModo]       = useState('');
  const [segundos,   setSegundos]   = useState(120);
  const [cortina,    setCortina]    = useState(false);
  const [mostrarCfg, setMostrarCfg] = useState(false);
  const [config,     setConfig]     = useState({ tipoNum:'naturales', tiempoPregunta:14, tiposOp: OPS_NATURALES });
  const [gearHover,  setGearHover]  = useState(false);

  // Velocidad adaptativa
  const [tiempoActualG,  setTiempoActualG]  = useState(14);
  const [tiempoActualP1, setTiempoActualP1] = useState(14);
  const [tiempoActualP2, setTiempoActualP2] = useState(14);

  // Globos
  const [opG,     setOpG]     = useState(null);
  const [globosG, setGlobosG] = useState([]);
  const [puntosG, setPuntosG] = useState(0);
  const [flashG,  setFlashG]  = useState(false);
  const [malG,    setMalG]    = useState(null);

  // Dual
  const [opP1,     setOpP1]     = useState(null);
  const [opP2,     setOpP2]     = useState(null);
  const [globosP1, setGlobosP1] = useState([]);
  const [globosP2, setGlobosP2] = useState([]);
  const [puntosP1, setPuntosP1] = useState(0);
  const [puntosP2, setPuntosP2] = useState(0);
  const [flashP1,  setFlashP1]  = useState(false);
  const [flashP2,  setFlashP2]  = useState(false);
  const [malP1,    setMalP1]    = useState(null);
  const [malP2,    setMalP2]    = useState(null);

  const audioOk   = useRef(new Audio(sonidoCorrecto));
  const audioFail = useRef(new Audio(sonidoFallo));

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pantalla !== 'globos' && pantalla !== 'dual') return; // tiron no usa timer global
    if (segundos <= 0) { setPantalla('fin'); return; }
    const t = setTimeout(() => setSegundos(s => s-1), 1000);
    return () => clearTimeout(t);
  }, [segundos, pantalla]);

  // ── Auto-refresh si no se responde ────────────────────────────────────────
  useEffect(() => {
    if (pantalla !== 'globos' || !opG) return;
    const t = setTimeout(() => {
      setTiempoActualG(config.tiempoPregunta);
      const nOp = generarOp(config.tipoNum, config.tiposOp, primaria);
      setOpG(nOp); setGlobosG(crearGlobos(nOp.respuesta, 4, config.tipoNum, config.tiempoPregunta));
    }, tiempoActualG * 1000);
    return () => clearTimeout(t);
  }, [opG, pantalla, tiempoActualG]);

  useEffect(() => {
    if (pantalla !== 'dual' || !opP1) return;
    const t = setTimeout(() => {
      setTiempoActualP1(config.tiempoPregunta);
      const nOp = generarOp(config.tipoNum, config.tiposOp, primaria);
      setOpP1(nOp); setGlobosP1(crearGlobos(nOp.respuesta, 3, config.tipoNum, config.tiempoPregunta));
    }, tiempoActualP1 * 1000);
    return () => clearTimeout(t);
  }, [opP1, pantalla, tiempoActualP1]);

  useEffect(() => {
    if (pantalla !== 'dual' || !opP2) return;
    const t = setTimeout(() => {
      setTiempoActualP2(config.tiempoPregunta);
      const nOp = generarOp(config.tipoNum, config.tiposOp, primaria);
      setOpP2(nOp); setGlobosP2(crearGlobos(nOp.respuesta, 3, config.tipoNum, config.tiempoPregunta));
    }, tiempoActualP2 * 1000);
    return () => clearTimeout(t);
  }, [opP2, pantalla, tiempoActualP2]);

  // ── Iniciar ───────────────────────────────────────────────────────────────
  const lanzarConCortina = (fn) => {
    setCortina(true);
    setTimeout(() => { fn(); setCortina(false); }, 900);
  };

  const iniciarGlobos = () => {
    const tp = config.tiempoPregunta;
    setTiempoActualG(tp);
    setModo('globos'); setSegundos(120); setPuntosG(0); setFlashG(false); setMalG(null);
    const op = generarOp(config.tipoNum, config.tiposOp, primaria);
    setOpG(op); setGlobosG(crearGlobos(op.respuesta, 4, config.tipoNum, tp));
    setPantalla('globos');
  };

  const iniciarDual = () => {
    const tp = config.tiempoPregunta;
    setTiempoActualP1(tp); setTiempoActualP2(tp);
    setModo('dual'); setSegundos(120);
    setPuntosP1(0); setPuntosP2(0);
    setFlashP1(false); setFlashP2(false); setMalP1(null); setMalP2(null);
    const op1 = generarOp(config.tipoNum, config.tiposOp, primaria), op2 = generarOp(config.tipoNum, config.tiposOp, primaria);
    setOpP1(op1); setOpP2(op2);
    setGlobosP1(crearGlobos(op1.respuesta, 3, config.tipoNum, tp));
    setGlobosP2(crearGlobos(op2.respuesta, 3, config.tipoNum, tp));
    setPantalla('dual');
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const clickG = (g) => {
    if (g.valor === opG.respuesta) {
      audioOk.current.currentTime = 0; audioOk.current.play();
      setPuntosG(p => p+10);
      setFlashG(true); setTimeout(() => setFlashG(false), 500);
      const nuevoT = Math.max(3, tiempoActualG - 0.5);
      setTiempoActualG(nuevoT);
      const nOp = generarOp(config.tipoNum, config.tiposOp, primaria);
      setOpG(nOp); setGlobosG(crearGlobos(nOp.respuesta, 4, config.tipoNum, nuevoT));
    } else {
      audioFail.current.currentTime = 0; audioFail.current.play();
      setMalG(g.id); setTimeout(() => setMalG(null), 450);
      setTiempoActualG(config.tiempoPregunta);
    }
  };

  const clickP = (g, j) => {
    const op          = j===1 ? opP1 : opP2;
    const tiempoActual = j===1 ? tiempoActualP1 : tiempoActualP2;
    if (g.valor === op.respuesta) {
      audioOk.current.currentTime = 0; audioOk.current.play();
      const nuevoT = Math.max(3, tiempoActual - 0.5);
      const nOp = generarOp(config.tipoNum, config.tiposOp, primaria);
      if (j===1) {
        setTiempoActualP1(nuevoT);
        setPuntosP1(p=>p+10); setFlashP1(true); setTimeout(()=>setFlashP1(false),500);
        setOpP1(nOp); setGlobosP1(crearGlobos(nOp.respuesta, 3, config.tipoNum, nuevoT));
      } else {
        setTiempoActualP2(nuevoT);
        setPuntosP2(p=>p+10); setFlashP2(true); setTimeout(()=>setFlashP2(false),500);
        setOpP2(nOp); setGlobosP2(crearGlobos(nOp.respuesta, 3, config.tipoNum, nuevoT));
      }
    } else {
      audioFail.current.currentTime = 0; audioFail.current.play();
      if (j===1) { setMalP1(g.id); setTimeout(()=>setMalP1(null),450); setTiempoActualP1(config.tiempoPregunta); }
      else       { setMalP2(g.id); setTimeout(()=>setMalP2(null),450); setTiempoActualP2(config.tiempoPregunta); }
    }
  };

  const timerCol = segundos > 30 ? '#4CAF50' : segundos > 10 ? '#FF9800' : '#E53935';
  const pct      = (segundos / 120) * 100;
  const btnBase  = { border:'none', cursor:'pointer', fontWeight:900, borderRadius:18, transition:'transform 0.12s' };

  return (
    <div style={{
      minHeight:'100vh', position:'relative', overflow:'hidden',
      backgroundImage:`url(${fondoImg})`, backgroundSize:'cover', backgroundPosition:'center',
      fontFamily:"'Segoe UI',Nunito,Arial,sans-serif",
      padding:'70px 12px 40px', boxSizing:'border-box', userSelect:'none',
    }}>
      <style>{CSS}</style>

      {/* Capa oscura */}
      <div style={{ position:'fixed', inset:0, background:'rgba(10,10,30,0.72)', zIndex:0, pointerEvents:'none' }}/>

      {/* Cortina */}
      {cortina && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', pointerEvents:'none' }}>
          <div style={{ flex:1, background:'#8B0000',
            backgroundImage:'repeating-linear-gradient(90deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 8px,transparent 8px,transparent 24px)',
            animation:'cortinaIzq 0.85s cubic-bezier(0.7,0,1,1) forwards',
            boxShadow:'inset -8px 0 20px rgba(0,0,0,0.4)' }}/>
          <div style={{ flex:1, background:'#8B0000',
            backgroundImage:'repeating-linear-gradient(90deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 8px,transparent 8px,transparent 24px)',
            animation:'cortinaDer 0.85s cubic-bezier(0.7,0,1,1) forwards',
            boxShadow:'inset 8px 0 20px rgba(0,0,0,0.4)' }}/>
        </div>
      )}

      {/* ── Modal CONFIGURACIÓN ──────────────────────────────────────── */}
      {mostrarCfg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', zIndex:5000,
          display:'flex', justifyContent:'center', alignItems:'center', padding:'20px' }}>
          <div style={{ background:'#12103a', borderRadius:24, padding:'28px 30px', maxWidth:460, width:'100%',
            border:'2px solid rgba(255,255,255,0.12)', color:'white', fontFamily:'inherit',
            boxShadow:'0 30px 80px rgba(0,0,0,0.7)' }}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:'1.5rem', display:'inline-block',
                  animation:'gearSpin 3s linear infinite' }}>⚙️</span>
                <h3 style={{ margin:0, fontSize:'1.2rem', color:'#FFE234', fontWeight:900 }}>Configuración</h3>
              </div>
              <button onClick={()=>setMostrarCfg(false)} style={{ background:'rgba(255,255,255,0.08)',
                border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', color:'#aaa',
                fontSize:'1rem', borderRadius:8, width:32, height:32,
                display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>

            {/* Tipo de operación */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Tipo de operación</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {[
                  { key:'suma',  label:'Suma',  emoji:'➕' },
                  { key:'resta', label:'Resta', emoji:'➖' },
                  { key:'multi', label:'×',     emoji:'✖️' },
                  { key:'div',   label:'÷',     emoji:'➗' },
                ].map(op => {
                  const activo = config.tiposOp.includes(op.key);
                  const soloQueda = activo && config.tiposOp.length === 1;
                  return (
                    <button key={op.key} onClick={() => {
                      if (soloQueda) return;
                      setConfig(c => ({
                        ...c,
                        tiposOp: activo
                          ? c.tiposOp.filter(x => x !== op.key)
                          : [...c.tiposOp, op.key],
                      }));
                    }} style={{
                      padding:'12px 4px', borderRadius:12, border:'2px solid',
                      borderColor: activo ? '#FFE234' : 'rgba(255,255,255,0.08)',
                      cursor: soloQueda ? 'default' : 'pointer',
                      background: activo ? 'rgba(255,226,52,0.15)' : 'rgba(255,255,255,0.05)',
                      color: activo ? '#FFE234' : 'rgba(255,255,255,0.4)',
                      fontWeight:800, fontSize:'0.85rem', transition:'all 0.2s',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                    }}>
                      <span style={{ fontSize:'1.1rem' }}>{op.emoji}</span>
                      <span>{op.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipo de números */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Tipo de números</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {Object.entries(TIPO_INFO).map(([key, {label, emoji, desc}]) => (
                  <button key={key} onClick={()=>setConfig(c=>({...c,tipoNum:key}))} style={{
                    padding:'14px 12px', borderRadius:14, border:'2px solid',
                    borderColor: config.tipoNum===key ? '#f5576c' : 'rgba(255,255,255,0.08)',
                    cursor:'pointer', textAlign:'left',
                    background: config.tipoNum===key
                      ? 'linear-gradient(135deg,rgba(240,147,251,0.2),rgba(245,87,108,0.2))'
                      : 'rgba(255,255,255,0.05)',
                    color:'white', transition:'all 0.2s',
                  }}>
                    <div style={{ fontSize:'1.3rem', marginBottom:4 }}>{emoji}</div>
                    <div style={{ fontWeight:800, fontSize:'0.9rem' }}>{label}</div>
                    <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', marginTop:2 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tiempo por pregunta */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Tiempo por pregunta</div>
              <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.3)', marginBottom:12 }}>
                Los globos flotan durante este tiempo antes de cambiar solos
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[8,12,16,20,25].map(t => (
                  <button key={t} onClick={()=>setConfig(c=>({...c,tiempoPregunta:t}))} style={{
                    flex:'1 1 50px', padding:'12px 4px', borderRadius:12,
                    border:'2px solid', borderColor: config.tiempoPregunta===t ? '#4facfe' : 'rgba(255,255,255,0.08)',
                    cursor:'pointer',
                    background: config.tiempoPregunta===t
                      ? 'linear-gradient(135deg,#4facfe,#00f2fe)'
                      : 'rgba(255,255,255,0.05)',
                    color:'white', fontWeight:700, fontSize:'0.95rem', transition:'all 0.2s',
                  }}>{t}s</button>
                ))}
              </div>
            </div>

            <button onClick={()=>setMostrarCfg(false)} style={{
              width:'100%', padding:'13px', borderRadius:14, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#4facfe,#00f2fe)',
              color:'white', fontWeight:900, fontSize:'1rem',
              boxShadow:'0 6px 18px rgba(79,172,254,0.4)',
            }}>✓ Guardar y cerrar</button>
          </div>
        </div>
      )}

      <div style={{ position:'relative', zIndex:1 }}>

        {/* ── SELECTOR DE OPERACIONES (solo primaria) ─────────────── */}
        {pantalla === 'selector' && (
          <div style={{ maxWidth:500, margin:'0 auto', textAlign:'center' }}>
            <div style={{ fontSize:'3rem', marginBottom:6 }}>🧮</div>
            <h2 style={{ fontSize:'1.8rem', fontWeight:900, color:'#FFE234', margin:'0 0 8px',
              textShadow:'0 3px 12px rgba(255,226,52,0.5)' }}>
              ¿Qué vamos a practicar?
            </h2>
            <p style={{ color:'rgba(255,255,255,0.5)', marginBottom:28, fontSize:'0.92rem' }}>
              Marca las operaciones que quieres en el juego
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:28 }}>
              {[
                { key:'suma',  emoji:'➕', label:'Sumas',             ejemplo:'5 + 3 = ?',  color:'#4CAF50' },
                { key:'resta', emoji:'➖', label:'Restas',            ejemplo:'9 − 4 = ?',  color:'#F44336' },
                { key:'multi', emoji:'✖️', label:'Multiplicaciones',  ejemplo:'4 × 6 = ?',  color:'#FF9800' },
                { key:'div',   emoji:'➗', label:'Divisiones',        ejemplo:'12 ÷ 3 = ?', color:'#9C27B0' },
              ].map(op => {
                const activo    = config.tiposOp.includes(op.key);
                const soloQueda = activo && config.tiposOp.length === 1;
                return (
                  <button key={op.key} onClick={() => {
                    if (soloQueda) return;
                    setConfig(c => ({
                      ...c,
                      tiposOp: activo
                        ? c.tiposOp.filter(x => x !== op.key)
                        : [...c.tiposOp, op.key],
                    }));
                  }} style={{
                    padding:'22px 14px', borderRadius:20, border:'4px solid',
                    borderColor: activo ? op.color : 'rgba(255,255,255,0.1)',
                    cursor: soloQueda ? 'default' : 'pointer', textAlign:'center',
                    background: activo
                      ? `linear-gradient(135deg,${op.color}44,${op.color}22)`
                      : 'rgba(255,255,255,0.05)',
                    color:'white', transition:'all 0.18s', position:'relative',
                    boxShadow: activo ? `0 6px 20px ${op.color}44` : 'none',
                  }}>
                    {/* Indicador check */}
                    <div style={{
                      position:'absolute', top:10, right:12,
                      width:26, height:26, borderRadius:'50%',
                      background: activo ? op.color : 'rgba(255,255,255,0.12)',
                      border: activo ? 'none' : '2px solid rgba(255,255,255,0.2)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'0.9rem', fontWeight:900, transition:'all 0.18s',
                    }}>
                      {activo ? '✓' : ''}
                    </div>
                    <div style={{ fontSize:'2.2rem', marginBottom:8 }}>{op.emoji}</div>
                    <div style={{ fontWeight:900, fontSize:'1.05rem',
                      color: activo ? op.color : 'rgba(255,255,255,0.55)', marginBottom:5 }}>
                      {op.label}
                    </div>
                    <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.35)',
                      fontFamily:'monospace' }}>
                      {op.ejemplo}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPantalla('menu')}
              disabled={config.tiposOp.length === 0}
              style={{
                border:'none', borderRadius:18, cursor:'pointer', fontWeight:900,
                padding:'16px 48px', fontSize:'1.1rem',
                background: config.tiposOp.length > 0
                  ? 'linear-gradient(135deg,#f093fb,#f5576c)'
                  : 'rgba(255,255,255,0.1)',
                color: config.tiposOp.length > 0 ? 'white' : 'rgba(255,255,255,0.3)',
                boxShadow: config.tiposOp.length > 0
                  ? '0 8px 24px rgba(245,87,108,0.4)' : 'none',
                transition:'all 0.2s',
              }}>
              ✓ ¡Jugar con estas operaciones!
            </button>
          </div>
        )}

        {/* ── MENÚ ─────────────────────────────────────────────────── */}
        {pantalla === 'menu' && (
          <div style={{ maxWidth:640, margin:'0 auto', textAlign:'center', position:'relative' }}>

            {/* Botón configuración */}
            <button
              onClick={()=>setMostrarCfg(true)}
              onMouseEnter={()=>setGearHover(true)}
              onMouseLeave={()=>setGearHover(false)}
              style={{
                position:'absolute', top:0, right:0,
                width:50, height:50, borderRadius:'50%',
                border:'2px solid rgba(255,255,255,0.2)',
                background:'rgba(255,255,255,0.08)',
                cursor:'pointer', fontSize:'1.5rem',
                display:'flex', alignItems:'center', justifyContent:'center',
                backdropFilter:'blur(4px)', transition:'all 0.2s',
                boxShadow: gearHover ? '0 0 18px rgba(255,226,52,0.4)' : 'none',
              }} title="Configuración">
              <span style={{ display:'inline-block',
                animation: gearHover ? 'gearSpin 1s linear infinite' : 'none' }}>⚙️</span>
            </button>

            {/* Badges de config actual */}
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:10, flexWrap:'wrap' }}>
              <span style={{ background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'4px 14px',
                fontSize:'0.78rem', color:'rgba(255,255,255,0.6)', fontWeight:600 }}>
                {TIPO_INFO[config.tipoNum].emoji} {TIPO_INFO[config.tipoNum].label}
              </span>
              <span style={{ background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'4px 14px',
                fontSize:'0.78rem', color:'rgba(255,255,255,0.6)', fontWeight:600 }}>
                ⏱ {config.tiempoPregunta}s por pregunta
              </span>
            </div>

            <div style={{ fontSize:'4rem', marginBottom:6 }}>🎈</div>
            <h1 style={{ fontSize:'2.2rem', fontWeight:900, color:'#FFE234', margin:'0 0 6px',
              textShadow:'0 3px 12px rgba(255,226,52,0.5)' }}>Feria del Cálculo</h1>
            <p style={{ color:'rgba(255,255,255,0.55)', marginBottom:32, fontSize:'0.95rem' }}>
              ¡Explota el globo con el resultado correcto antes de que se escape!
            </p>

            <div style={{ display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={()=>lanzarConCortina(iniciarGlobos)}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                style={{ ...btnBase, padding:'26px 36px',
                  background:'linear-gradient(135deg,#f093fb,#f5576c)',
                  boxShadow:'0 8px 24px rgba(245,87,108,0.45)',
                  color:'white', fontSize:'1.15rem', flex:'1 1 200px', maxWidth:250 }}>
                <div style={{ fontSize:'2.5rem', marginBottom:8 }}>🎈</div>
                <div>Modo Globos</div>
                <div style={{ fontSize:'0.78rem', fontWeight:400, opacity:0.85, marginTop:4 }}>1 jugador · 120 s</div>
              </button>
              <button onClick={()=>lanzarConCortina(iniciarDual)}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                style={{ ...btnBase, padding:'26px 36px',
                  background:'linear-gradient(135deg,#4facfe,#00f2fe)',
                  boxShadow:'0 8px 24px rgba(79,172,254,0.45)',
                  color:'white', fontSize:'1.15rem', flex:'1 1 200px', maxWidth:250 }}>
                <div style={{ fontSize:'2.5rem', marginBottom:8 }}>👥</div>
                <div>Modo Dual</div>
                <div style={{ fontSize:'0.78rem', fontWeight:400, opacity:0.85, marginTop:4 }}>2 jugadores · 120 s</div>
              </button>
              <button onClick={()=>lanzarConCortina(()=>setPantalla('tiron'))}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                style={{ ...btnBase, padding:'26px 36px',
                  background:'linear-gradient(135deg,#a18cd1,#fbc2eb)',
                  boxShadow:'0 8px 24px rgba(161,140,209,0.45)',
                  color:'white', fontSize:'1.15rem', flex:'1 1 200px', maxWidth:250 }}>
                <div style={{ fontSize:'2.5rem', marginBottom:8 }}>🪢</div>
                <div>Tirón de Cuerda</div>
                <div style={{ fontSize:'0.78rem', fontWeight:400, opacity:0.85, marginTop:4 }}>2 jugadores · sin límite</div>
              </button>
            </div>
          </div>
        )}

        {/* ── TIRÓN DE CUERDA ──────────────────────────────────────── */}
        {pantalla === 'tiron' && (
          <div style={{ position:'fixed', inset:0, zIndex:100 }}>
            <button onClick={()=>setPantalla('menu')} style={{
              position:'fixed', top:12, left:12, zIndex:200,
              background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.2)',
              color:'white', borderRadius:10, padding:'6px 14px', cursor:'pointer',
              fontWeight:700, fontSize:'0.85rem', backdropFilter:'blur(4px)',
            }}>← Feria</button>
            <TironCuerdaJuego primaria={primaria} />
          </div>
        )}

        {/* ── MODO GLOBOS ──────────────────────────────────────────── */}
        {pantalla === 'globos' && (
          <div style={{ maxWidth:700, margin:'0 auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:'2rem', fontWeight:900, color:timerCol, fontVariantNumeric:'tabular-nums' }}>⏱ {segundos}s</span>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{
                  background: tiempoActualG <= config.tiempoPregunta * 0.5 ? 'rgba(244,67,54,0.2)' : tiempoActualG <= config.tiempoPregunta * 0.75 ? 'rgba(255,152,0,0.2)' : 'rgba(255,255,255,0.08)',
                  borderRadius:12, padding:'4px 12px', fontSize:'0.82rem', fontWeight:700,
                  color: tiempoActualG <= config.tiempoPregunta * 0.5 ? '#EF5350' : tiempoActualG <= config.tiempoPregunta * 0.75 ? '#FFA726' : 'rgba(255,255,255,0.5)',
                }}>⚡ {tiempoActualG.toFixed(1)}s</span>
                <span style={{ background:'rgba(255,226,52,0.15)', borderRadius:12, padding:'6px 20px',
                  fontWeight:900, fontSize:'1.2rem', color:'#FFE234' }}>🎈 {puntosG} pts</span>
              </div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:8, height:8, marginBottom:14, overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', background:timerCol, borderRadius:8,
                transition:'width 1s linear, background 0.5s' }}/>
            </div>
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:20, padding:'14px 24px',
              textAlign:'center', marginBottom:14, border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize:'2.8rem', fontWeight:900, color:'#FFE234', textShadow:'0 2px 10px rgba(0,0,0,0.5)' }}>
                {opG?.texto} = ?
              </div>
            </div>
            <BalloonField globos={globosG} onClickGlobo={clickG} globoMal={malG} flashOk={flashG} altura={400} />
          </div>
        )}

        {/* ── MODO DUAL ────────────────────────────────────────────── */}
        {pantalla === 'dual' && (
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:10 }}>
              <span style={{ fontSize:'2rem', fontWeight:900, color:timerCol, fontVariantNumeric:'tabular-nums' }}>⏱ {segundos}s</span>
            </div>
            <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:8, height:8, marginBottom:14, overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', background:timerCol, borderRadius:8,
                transition:'width 1s linear, background 0.5s' }}/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1, border:'3px solid #4facfe', borderRadius:20, overflow:'hidden', minWidth:0 }}>
                <div style={{ background:'rgba(79,172,254,0.15)', padding:'10px 16px',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  borderBottom:'1px solid rgba(79,172,254,0.3)' }}>
                  <span style={{ color:'#4facfe', fontWeight:900 }}>👤 Jugador 1</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700,
                      color: tiempoActualP1 <= config.tiempoPregunta*0.5 ? '#EF5350' : tiempoActualP1 <= config.tiempoPregunta*0.75 ? '#FFA726' : 'rgba(255,255,255,0.4)',
                    }}>⚡{tiempoActualP1.toFixed(1)}s</span>
                    <span style={{ color:'#FFE234', fontWeight:900 }}>🎈 {puntosP1} pts</span>
                  </div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.05)', padding:'10px 16px', textAlign:'center',
                  borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize:'1.8rem', fontWeight:900, color:'#FFE234' }}>{opP1?.texto} = ?</div>
                </div>
                <BalloonField globos={globosP1} onClickGlobo={g=>clickP(g,1)} globoMal={malP1} flashOk={flashP1} altura={340} />
              </div>

              <div style={{ width:6, background:'rgba(255,255,255,0.12)', borderRadius:3, flexShrink:0 }}/>

              <div style={{ flex:1, border:'3px solid #f5576c', borderRadius:20, overflow:'hidden', minWidth:0 }}>
                <div style={{ background:'rgba(245,87,108,0.15)', padding:'10px 16px',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  borderBottom:'1px solid rgba(245,87,108,0.3)' }}>
                  <span style={{ color:'#f5576c', fontWeight:900 }}>👤 Jugador 2</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700,
                      color: tiempoActualP2 <= config.tiempoPregunta*0.5 ? '#EF5350' : tiempoActualP2 <= config.tiempoPregunta*0.75 ? '#FFA726' : 'rgba(255,255,255,0.4)',
                    }}>⚡{tiempoActualP2.toFixed(1)}s</span>
                    <span style={{ color:'#FFE234', fontWeight:900 }}>🎈 {puntosP2} pts</span>
                  </div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.05)', padding:'10px 16px', textAlign:'center',
                  borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize:'1.8rem', fontWeight:900, color:'#FFE234' }}>{opP2?.texto} = ?</div>
                </div>
                <BalloonField globos={globosP2} onClickGlobo={g=>clickP(g,2)} globoMal={malP2} flashOk={flashP2} altura={340} />
              </div>
            </div>
          </div>
        )}

        {/* ── FIN ──────────────────────────────────────────────────── */}
        {pantalla === 'fin' && (
          <div style={{ maxWidth:560, margin:'0 auto', textAlign:'center' }}>
            <div style={{ fontSize:'5rem', marginBottom:12 }}>🏆</div>
            <h2 style={{ fontSize:'2.2rem', fontWeight:900, color:'#FFE234', margin:'0 0 24px' }}>¡Tiempo!</h2>

            {modo === 'globos' ? (
              <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:22, padding:'28px 32px',
                marginBottom:28, border:'2px solid rgba(255,226,52,0.3)' }}>
                <div style={{ fontSize:'0.9rem', color:'rgba(255,255,255,0.45)', fontWeight:600,
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Puntuación final</div>
                <div style={{ fontSize:'5.5rem', fontWeight:900, color:'#4CAF50', lineHeight:1 }}>{puntosG}</div>
                <div style={{ color:'rgba(255,255,255,0.4)', marginTop:6 }}>puntos · {puntosG/10} globos explotados</div>
              </div>
            ) : (
              <div style={{ display:'flex', gap:16, justifyContent:'center', marginBottom:28, flexWrap:'wrap' }}>
                {[{label:'Jugador 1',pts:puntosP1,color:'#4facfe'},{label:'Jugador 2',pts:puntosP2,color:'#f5576c'}].map(j => {
                  const winner = puntosP1 !== puntosP2 && j.pts === Math.max(puntosP1, puntosP2);
                  const empate = puntosP1 === puntosP2;
                  return (
                    <div key={j.label} style={{ flex:'1 1 180px', maxWidth:230,
                      background:'rgba(255,255,255,0.07)', borderRadius:22, padding:'24px 20px',
                      border:`3px solid ${j.color}`, textAlign:'center' }}>
                      <div style={{ fontWeight:900, color:j.color, fontSize:'1.1rem', marginBottom:10 }}>{j.label}</div>
                      <div style={{ fontSize:'4.5rem', fontWeight:900, color:'#FFE234', lineHeight:1 }}>{j.pts}</div>
                      <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.82rem', marginTop:6 }}>{j.pts/10} aciertos</div>
                      {winner && <div style={{ marginTop:10, fontSize:'1.5rem' }}>🏆 ¡Ganador!</div>}
                      {empate  && <div style={{ marginTop:10, fontSize:'1.1rem', color:'#FFE234' }}>🤝 Empate</div>}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={()=>lanzarConCortina(modo==='globos'?iniciarGlobos:iniciarDual)}
                style={{ ...btnBase, padding:'14px 34px', fontSize:'1rem',
                  background:'linear-gradient(135deg,#f093fb,#f5576c)', color:'white',
                  boxShadow:'0 6px 18px rgba(245,87,108,0.35)' }}>🔄 Jugar de nuevo</button>
              <button onClick={()=>setPantalla(primaria ? 'selector' : 'menu')}
                style={{ ...btnBase, padding:'14px 28px', fontSize:'0.95rem',
                  background:'transparent', color:'rgba(255,255,255,0.7)',
                  border:'2px solid rgba(255,255,255,0.2)' }}>← Menú</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
