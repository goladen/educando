import React, { useState, useCallback } from 'react';
import sonidoCorrecto from './assets/correct-choice-43861.mp3';
import sonidoFallo    from './assets/negative_beeps-6008.mp3';

const CSS = `
  @keyframes tironP1 {
    0%,100% { transform: scaleX(-1) translateX(0); }
    50%     { transform: scaleX(-1) translateX(-5px); }
  }
  @keyframes tironP2 {
    0%,100% { transform: translateX(0); }
    50%     { transform: translateX(5px); }
  }
  @keyframes ganadorBounce {
    0%,100% { transform: translateY(0); }
    40%     { transform: translateY(-12px); }
  }
  @keyframes cuerda {
    0%,100% { transform: scaleY(1); }
    50%     { transform: scaleY(1.06); }
  }
  @keyframes banderin {
    0%,100% { transform: translateY(0) rotate(-3deg); }
    50%     { transform: translateY(-4px) rotate(3deg); }
  }
  @keyframes flashOk {
    0%   { background: rgba(76,217,100,0.45); }
    100% { background: rgba(76,217,100,0); }
  }
  @keyframes flashFail {
    0%   { background: rgba(244,67,54,0.45); }
    100% { background: rgba(244,67,54,0); }
  }
`;

const LIMITE = 10;

// ── Fraction helpers ──────────────────────────────────────────────────────────
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

const OPS_TODAS  = ['suma','resta','multi','div'];
const OPS_OTROS  = ['suma','resta','multi'];

// ── Generadores ───────────────────────────────────────────────────────────────
function generarNaturales(tiposOp = OPS_TODAS, primaria = false) {
  const pool = tiposOp.filter(o => OPS_TODAS.includes(o));
  const tipo = pool[Math.floor(Math.random() * pool.length)];
  let n1, n2, ans, txt;
  if (tipo === 'suma') {
    n1 = primaria ? Math.floor(Math.random()*20)+1  : Math.floor(Math.random()*40)+5;
    n2 = primaria ? Math.floor(Math.random()*20)+1  : Math.floor(Math.random()*40)+5;
    ans = n1+n2; txt = `${n1} + ${n2}`;
  } else if (tipo === 'resta') {
    n1 = primaria ? Math.floor(Math.random()*20)+11 : Math.floor(Math.random()*60)+20;
    n2 = primaria ? Math.floor(Math.random()*n1)+1  : Math.floor(Math.random()*(n1-1))+1;
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

function generarDecimales(tiposOp = OPS_OTROS) {
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

function generarNegativos(tiposOp = OPS_OTROS) {
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

function generarFracciones() {
  const nums = [[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[5,6]];
  const [n1,d1] = nums[Math.floor(Math.random()*nums.length)];
  const [n2,d2] = nums[Math.floor(Math.random()*nums.length)];
  const rn = n1*d2 + n2*d1;
  const rd = d1*d2;
  const r  = reducir(rn, rd);
  return {
    texto:    `${fracStr(n1,d1)} + ${fracStr(n2,d2)}`,
    respuesta: fracStr(r.n, r.d),
  };
}

function generarOp(tipoNum = 'naturales', tiposOp = OPS_TODAS, primaria = false) {
  if (tipoNum === 'decimales')  return generarDecimales(tiposOp);
  if (tipoNum === 'negativos')  return generarNegativos(tiposOp);
  if (tipoNum === 'fracciones') return generarFracciones();
  return generarNaturales(tiposOp, primaria);
}

function esCorrecta(valor, respuesta) {
  if (typeof respuesta === 'string') return valor.trim() === respuesta.trim();
  const num = parseFloat(valor);
  return !isNaN(num) && Math.abs(num - respuesta) < 0.001;
}

// ── Config ────────────────────────────────────────────────────────────────────
const TIPO_LISTA = [
  { key:'naturales',  label:'Naturales',  emoji:'🔢', especial: null },
  { key:'decimales',  label:'Decimales',  emoji:'🔣', especial: '.' },
  { key:'negativos',  label:'Negativos',  emoji:'➖', especial: '-' },
  { key:'fracciones', label:'Fracciones', emoji:'½',  especial: '/' },
];

// ── Teclado virtual ───────────────────────────────────────────────────────────
function Teclado({ valor, onDigit, onErase, onConfirm, tipoNum, color }) {
  const info     = TIPO_LISTA.find(t => t.key === tipoNum) || TIPO_LISTA[0];
  const especial = info.especial;

  const bStyle = (bg) => ({
    border:'none', borderRadius:10, cursor:'pointer', fontWeight:900,
    fontSize:'1.15rem', color:'white', background: bg,
    padding:'11px 0', transition:'transform 0.08s', textAlign:'center',
  });
  const press = e => { e.currentTarget.style.transform = 'scale(0.9)'; };
  const rel   = e => { e.currentTarget.style.transform = 'scale(1)'; };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%', maxWidth:210 }}>
      {/* Display */}
      <div style={{
        background:'rgba(0,0,0,0.4)', borderRadius:12, padding:'9px 14px',
        fontSize:'1.5rem', fontWeight:900, color:'white', textAlign:'center',
        minHeight:48, border:`2px solid ${color}55`, letterSpacing:3,
      }}>
        {valor || <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'1rem' }}>—</span>}
      </div>

      {/* Dígitos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
        {[7,8,9,4,5,6,1,2,3].map(d => (
          <button key={d} onClick={() => onDigit(String(d))} onMouseDown={press} onMouseUp={rel}
            style={bStyle('rgba(255,255,255,0.12)')}>{d}</button>
        ))}
        {especial
          ? <button key="esp" onClick={() => onDigit(especial)} onMouseDown={press} onMouseUp={rel}
              style={bStyle('rgba(255,255,255,0.08)')}>{especial}</button>
          : <div key="esp"/>
        }
        <button key="0" onClick={() => onDigit('0')} onMouseDown={press} onMouseUp={rel}
          style={bStyle('rgba(255,255,255,0.12)')}>0</button>
        <button key="del" onClick={onErase} onMouseDown={press} onMouseUp={rel}
          style={bStyle('rgba(255,255,255,0.07)')}>⌫</button>
      </div>

      {/* Confirmar */}
      <button onClick={onConfirm} onMouseDown={press} onMouseUp={rel}
        style={{ ...bStyle(`linear-gradient(135deg,${color},${color}99)`),
          padding:'13px 0', fontSize:'1rem', borderRadius:12,
          boxShadow:`0 4px 14px ${color}44` }}>
        ✓ Confirmar
      </button>
    </div>
  );
}

// ── Zona cuerda ───────────────────────────────────────────────────────────────
function ZonaCuerda({ diff, ganador }) {
  const offset = diff * 4;

  return (
    <div style={{
      position:'relative', height:96, display:'flex', alignItems:'center',
      background:'linear-gradient(180deg,#1a1a2e,#0f3460)',
      flexShrink:0, overflow:'hidden',
    }}>
      <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:2,
        background:'rgba(255,255,255,0.12)', zIndex:1 }}/>

      <div style={{
        position:'absolute', left:0, right:0, top:0, bottom:0,
        transform:`translateX(${offset}%)`,
        transition:'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        display:'flex', alignItems:'center', zIndex:2,
      }}>
        <div style={{
          position:'absolute', left:'6%', fontSize:'2.2rem',
          display:'inline-block', transform:'scaleX(-1)',
          animation: ganador === 1 ? 'ganadorBounce 0.45s ease infinite' : 'tironP1 0.7s ease-in-out infinite',
          filter: ganador === 1 ? 'drop-shadow(0 0 8px #FFE234)' : 'none',
        }}>🏋️</div>

        <div style={{
          position:'absolute', left:'11%', right:'11%', height:10,
          background:'repeating-linear-gradient(90deg,#8B6914 0px,#C8921A 6px,#8B6914 12px)',
          borderRadius:5, boxShadow:'0 3px 10px rgba(0,0,0,0.5)',
          animation:'cuerda 0.6s ease-in-out infinite',
        }}>
          <div style={{
            position:'absolute', left:'50%', bottom:8, transform:'translateX(-50%)',
            animation:'banderin 0.7s ease-in-out infinite',
            display:'flex', flexDirection:'column', alignItems:'center',
          }}>
            <div style={{ width:2, height:24, background:'#FFE234' }}/>
            <div style={{
              width:20, height:14,
              background:'linear-gradient(135deg,#E53935,#FF5722)',
              clipPath:'polygon(0 0,100% 0,80% 100%,0 100%)',
            }}/>
          </div>
        </div>

        <div style={{
          position:'absolute', right:'6%', fontSize:'2.2rem',
          display:'inline-block',
          animation: ganador === 2 ? 'ganadorBounce 0.45s ease infinite' : 'tironP2 0.7s ease-in-out infinite',
          filter: ganador === 2 ? 'drop-shadow(0 0 8px #FFE234)' : 'none',
        }}>🏋️</div>
      </div>

      <div style={{
        position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.6)', borderRadius:20, padding:'2px 12px',
        fontSize:'0.7rem', color:'rgba(255,255,255,0.45)', fontWeight:700,
        zIndex:5, whiteSpace:'nowrap',
      }}>
        {diff === 0 ? '— Empate —' : diff < 0 ? `J1 lleva +${Math.abs(diff)}` : `J2 lleva +${diff}`}
      </div>
    </div>
  );
}

// ── Panel jugador ─────────────────────────────────────────────────────────────
function PanelJugador({ jugador, op, valor, onDigit, onErase, onConfirm, flash, ganador, pts, tipoNum }) {
  const esJ1   = jugador === 1;
  const color  = esJ1 ? '#0D47A1' : '#B71C1C';
  const colorL = esJ1 ? '#1565C0' : '#C62828';
  const colorH = esJ1 ? '#42A5F5' : '#EF5350';

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'10px 8px 10px', position:'relative', minWidth:0, overflowY:'auto',
      background:`linear-gradient(160deg,${color},${colorL})`,
    }}>
      {flash === 'ok'   && <div style={{ position:'absolute', inset:0, animation:'flashOk 0.4s ease forwards', pointerEvents:'none', zIndex:5 }}/>}
      {flash === 'fail' && <div style={{ position:'absolute', inset:0, animation:'flashFail 0.4s ease forwards', pointerEvents:'none', zIndex:5 }}/>}

      <div style={{ fontWeight:900, fontSize:'0.9rem', color:'white', opacity:0.75, marginBottom:2 }}>
        {esJ1 ? '👤 Jugador 1' : '👤 Jugador 2'}
      </div>
      <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.4)', marginBottom:8, fontWeight:600 }}>
        {pts} aciertos
      </div>

      <div style={{
        background:'rgba(0,0,0,0.3)', borderRadius:14, padding:'8px 12px',
        marginBottom:10, textAlign:'center', border:'2px solid rgba(255,255,255,0.1)',
        width:'100%', boxSizing:'border-box',
      }}>
        <div style={{ fontSize:'1.5rem', fontWeight:900, color:'white' }}>
          {op?.texto} = ?
        </div>
      </div>

      <Teclado
        valor={valor} onDigit={onDigit} onErase={onErase} onConfirm={onConfirm}
        tipoNum={tipoNum} color={colorH}
      />

      {ganador === jugador && <div style={{ marginTop:8, fontSize:'1.5rem' }}>🏆</div>}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function TironCuerdaJuego({ primaria = false }) {
  const [pantalla, setPantalla] = useState('menu');
  const [tipoNum,  setTipoNum]  = useState('naturales');
  const [tiposOp,  setTiposOp]  = useState(OPS_TODAS);
  const [diff,     setDiff]     = useState(0);
  const [opP1,     setOpP1]     = useState(null);
  const [opP2,     setOpP2]     = useState(null);
  const [val1,     setVal1]     = useState('');
  const [val2,     setVal2]     = useState('');
  const [ptsP1,    setPtsP1]    = useState(0);
  const [ptsP2,    setPtsP2]    = useState(0);
  const [flashP1,  setFlashP1]  = useState(null);
  const [flashP2,  setFlashP2]  = useState(null);
  const [ganador,  setGanador]  = useState(null);

  const audioOk   = React.useRef(new Audio(sonidoCorrecto));
  const audioFail = React.useRef(new Audio(sonidoFallo));

  const iniciar = () => {
    setDiff(0); setGanador(null);
    setPtsP1(0); setPtsP2(0);
    setVal1(''); setVal2('');
    setFlashP1(null); setFlashP2(null);
    setOpP1(generarOp(tipoNum, tiposOp, primaria));
    setOpP2(generarOp(tipoNum, tiposOp, primaria));
    setPantalla('juego');
  };

  const confirmar = useCallback((jugador) => {
    const valor = jugador === 1 ? val1 : val2;
    const op    = jugador === 1 ? opP1 : opP2;
    if (!op || ganador || !valor) return;

    const setFlash = jugador === 1 ? setFlashP1 : setFlashP2;
    const setVal   = jugador === 1 ? setVal1    : setVal2;
    const setOp    = jugador === 1 ? setOpP1    : setOpP2;
    const setPts   = jugador === 1 ? setPtsP1   : setPtsP2;

    const correcto = esCorrecta(valor, op.respuesta);

    if (correcto) {
      audioOk.current.currentTime = 0; audioOk.current.play();
      setPts(p => p+1);
      setFlash('ok'); setTimeout(() => setFlash(null), 400);
    } else {
      audioFail.current.currentTime = 0; audioFail.current.play();
      setFlash('fail'); setTimeout(() => setFlash(null), 400);
    }

    // correcto: diff va a favor del jugador; fallo: diff va en contra
    const delta = correcto
      ? (jugador === 1 ? -1 : 1)
      : (jugador === 1 ?  1 : -1);
    const newDiff = diff + delta;
    setDiff(newDiff);
    setVal('');
    setOp(generarOp(tipoNum, tiposOp, primaria));
    if (Math.abs(newDiff) >= LIMITE) setGanador(newDiff < 0 ? 1 : 2);
  }, [val1, val2, opP1, opP2, diff, ganador, tipoNum]);

  const digit = (j, d) => {
    if (ganador) return;
    (j === 1 ? setVal1 : setVal2)(v => v.length < 8 ? v + d : v);
  };
  const erase = (j) => (j === 1 ? setVal1 : setVal2)(v => v.slice(0,-1));

  const btnBase = { border:'none', cursor:'pointer', fontWeight:900, borderRadius:18 };

  // ── Menú ──
  if (pantalla === 'menu') return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
      fontFamily:"'Segoe UI',Nunito,Arial,sans-serif",
      padding:'24px', boxSizing:'border-box',
    }}>
      <style>{CSS}</style>
      <div style={{ fontSize:'3.5rem', marginBottom:6 }}>🪢</div>
      <h1 style={{ fontSize:'2rem', fontWeight:900, color:'#FFE234', margin:'0 0 8px',
        textShadow:'0 3px 12px rgba(255,226,52,0.5)' }}>Tirón de Cuerda</h1>
      <p style={{ color:'rgba(255,255,255,0.45)', marginBottom:24, textAlign:'center',
        maxWidth:360, fontSize:'0.88rem' }}>
        2 jugadores. Acierta para tirar · Falla y pierdes terreno.<br/>
        <b style={{color:'#FFE234'}}>Meta: ±{LIMITE} puntos de ventaja</b>
      </p>

      {/* Tipo de operación */}
      <div style={{ marginBottom:16, width:'100%', maxWidth:360 }}>
        <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.35)', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, textAlign:'center' }}>
          Tipo de operación
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
          {[
            { key:'suma',  emoji:'➕', label:'Suma' },
            { key:'resta', emoji:'➖', label:'Resta' },
            { key:'multi', emoji:'✖️', label:'×' },
            { key:'div',   emoji:'➗', label:'÷' },
          ].map(op => {
            const activo    = tiposOp.includes(op.key);
            const soloQueda = activo && tiposOp.length === 1;
            return (
              <button key={op.key} onClick={() => {
                if (soloQueda) return;
                setTiposOp(prev => activo ? prev.filter(x => x !== op.key) : [...prev, op.key]);
              }} style={{
                padding:'10px 4px', borderRadius:11, border:'2px solid',
                borderColor: activo ? '#FFE234' : 'rgba(255,255,255,0.08)',
                cursor: soloQueda ? 'default' : 'pointer',
                background: activo ? 'rgba(255,226,52,0.15)' : 'rgba(255,255,255,0.05)',
                color: activo ? '#FFE234' : 'rgba(255,255,255,0.4)',
                fontWeight:800, fontSize:'0.82rem', transition:'all 0.2s',
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              }}>
                <span style={{ fontSize:'1rem' }}>{op.emoji}</span>
                <span>{op.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tipo de números */}
      <div style={{ marginBottom:24, width:'100%', maxWidth:360 }}>
        <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.35)', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, textAlign:'center' }}>
          Tipo de números
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {TIPO_LISTA.map(t => (
            <button key={t.key} onClick={() => setTipoNum(t.key)} style={{
              padding:'11px 12px', borderRadius:12, border:'2px solid',
              borderColor: tipoNum === t.key ? '#f5576c' : 'rgba(255,255,255,0.08)',
              cursor:'pointer', textAlign:'center',
              background: tipoNum === t.key
                ? 'linear-gradient(135deg,rgba(240,147,251,0.2),rgba(245,87,108,0.2))'
                : 'rgba(255,255,255,0.05)',
              color:'white', fontWeight:800, fontSize:'0.9rem', transition:'all 0.2s',
            }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={iniciar} style={{ ...btnBase, padding:'16px 44px', fontSize:'1.1rem',
        background:'linear-gradient(135deg,#f093fb,#f5576c)', color:'white',
        boxShadow:'0 8px 24px rgba(245,87,108,0.4)' }}>
        🪢 ¡Empezar!
      </button>
    </div>
  );

  // ── Juego ──
  return (
    <div style={{
      height:'100vh', display:'flex', flexDirection:'column',
      fontFamily:"'Segoe UI',Nunito,Arial,sans-serif", overflow:'hidden',
    }}>
      <style>{CSS}</style>

      {/* Barra superior */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'#07071a', padding:'5px 14px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          <div style={{ width:100, height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:3,
              width:`${((diff + LIMITE) / (LIMITE*2)) * 100}%`,
              background: diff < 0 ? '#1976D2' : diff > 0 ? '#C62828' : '#666',
              transition:'width 0.35s',
            }}/>
          </div>
          <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.7rem' }}>
            {diff === 0 ? 'Empate' : diff < 0 ? `J1 +${Math.abs(diff)}` : `J2 +${diff}`}
          </span>
        </div>
        <span style={{ fontSize:'0.95rem', fontWeight:900, color:'#FFE234' }}>🪢 Tirón de Cuerda</span>
        <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'0.7rem' }}>Meta ±{LIMITE}</span>
      </div>

      <ZonaCuerda diff={diff} ganador={ganador} />

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <PanelJugador jugador={1} op={opP1} valor={val1}
          onDigit={d => digit(1,d)} onErase={() => erase(1)} onConfirm={() => confirmar(1)}
          flash={flashP1} ganador={ganador} pts={ptsP1} tipoNum={tipoNum} />
        <div style={{ width:3, background:'rgba(255,255,255,0.07)', flexShrink:0 }}/>
        <PanelJugador jugador={2} op={opP2} valor={val2}
          onDigit={d => digit(2,d)} onErase={() => erase(2)} onConfirm={() => confirmar(2)}
          flash={flashP2} ganador={ganador} pts={ptsP2} tipoNum={tipoNum} />
      </div>

      {ganador && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:9999, gap:14,
        }}>
          <div style={{ fontSize:'4.5rem' }}>🏆</div>
          <div style={{ fontSize:'2.2rem', fontWeight:900, color:'#FFE234',
            textShadow:'0 4px 16px rgba(255,226,52,0.5)' }}>
            ¡Gana el Jugador {ganador}!
          </div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.88rem' }}>
            J1: {ptsP1} aciertos · J2: {ptsP2} aciertos
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
            <button onClick={iniciar} style={{ ...btnBase, padding:'13px 32px', fontSize:'1rem',
              background:'linear-gradient(135deg,#f093fb,#f5576c)', color:'white',
              boxShadow:'0 6px 18px rgba(245,87,108,0.35)' }}>🔄 Revancha</button>
            <button onClick={() => setPantalla('menu')} style={{ ...btnBase, padding:'13px 24px', fontSize:'0.9rem',
              background:'transparent', color:'rgba(255,255,255,0.6)',
              border:'2px solid rgba(255,255,255,0.2)' }}>← Menú</button>
          </div>
        </div>
      )}
    </div>
  );
}
