import React, { useState, useRef, useMemo } from 'react';
import sonidoCorrecto from './assets/correct-choice-43861.mp3';
import sonidoFallo    from './assets/negative_beeps-6008.mp3';
import { CompeticionCuerda } from './components/TironCuerdaEscena';
import { useMandoPregunta, LetraMando } from './components/MandosCuerda';

// Destello del panel al acertar o fallar (el escenario de la cuerda va en TironCuerdaEscena)
const CSS = `
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

// ── Opción múltiple para los mandos micro:bit ─────────────────────────────────
// El resultado correcto y tres cercanos (±1, ±10…; en decimales ±0,1; en fracciones, otras sumas).
const mezclar = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
function opcionesFeria(op, tipoNum) {
  const r = op.respuesta;
  let candidatos;
  if (typeof r === 'string') {
    candidatos = [];
    for (let i = 0; i < 40 && candidatos.length < 6; i++) {
      const o = generarFracciones().respuesta;
      if (o !== r && !candidatos.includes(o)) candidatos.push(o);
    }
  } else if (tipoNum === 'decimales') {
    candidatos = [r + 0.1, r - 0.1, r + 1, r - 1, r + 1.1].map((v) => Math.round(v * 10) / 10);
  } else {
    candidatos = [r + 1, r - 1, r + 10, r - 10, r + 2, -r].filter((v) => tipoNum === 'negativos' || v >= 0);
  }
  const malas = mezclar([...new Set(candidatos)].filter((v) => v !== r)).slice(0, 3);
  const valores = mezclar([r, ...malas]);
  const txt = (v) => (typeof v === 'string' ? v : String(v).replace('.', ',').replace('-', '−'));
  return { opciones: valores.map(txt), correcta: valores.indexOf(r) };
}

// ── Panel de un equipo (dentro de CompeticionCuerda) ──────────────────────────
function PanelEquipoFeria({ equipo, aplicar, bloqueado, tipoNum, tiposOp, primaria }) {
  const [op, setOp] = useState(() => generarOp(tipoNum, tiposOp, primaria));
  const [valor, setValor] = useState('');
  const [flash, setFlash] = useState(null);
  const [pts, setPts] = useState(0);
  const audioOk = useRef(new Audio(sonidoCorrecto));
  const audioFail = useRef(new Audio(sonidoFallo));

  const esJ1 = equipo === 1;
  const color = esJ1 ? '#0D47A1' : '#B71C1C';
  const colorL = esJ1 ? '#1565C0' : '#C62828';
  const colorH = esJ1 ? '#42A5F5' : '#EF5350';

  const resolver = (correcto) => {
    const audio = correcto ? audioOk.current : audioFail.current;
    try { audio.currentTime = 0; audio.play(); } catch { /* sin audio */ }
    if (correcto) setPts((p) => p + 1);
    setFlash(correcto ? 'ok' : 'fail'); setTimeout(() => setFlash(null), 400);
    aplicar(correcto);
    setValor('');
    setOp(generarOp(tipoNum, tiposOp, primaria));
  };
  const confirmar = () => { if (bloqueado || !valor) return; resolver(esCorrecta(valor, op.respuesta)); };

  // Mandos micro:bit: el equipo vota entre 4 resultados
  const mc = useMemo(() => opcionesFeria(op, tipoNum), [op, tipoNum]);
  const { conMandos } = useMandoPregunta({ clave: op, n: mc.opciones.length, correcta: mc.correcta, elegir: (i) => { if (!bloqueado) resolver(i === mc.correcta); }, activa: !bloqueado });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 10px', position: 'relative', borderRadius: 16, overflow: 'hidden', background: `linear-gradient(160deg,${color},${colorL})` }}>
      {flash === 'ok' && <div style={{ position: 'absolute', inset: 0, animation: 'flashOk 0.4s ease forwards', pointerEvents: 'none', zIndex: 5 }} />}
      {flash === 'fail' && <div style={{ position: 'absolute', inset: 0, animation: 'flashFail 0.4s ease forwards', pointerEvents: 'none', zIndex: 5 }} />}
      <div style={{ fontWeight: 900, fontSize: '0.95rem', color: 'white', marginBottom: 2 }}>{esJ1 ? '🔵 Equipo 1' : '🔴 Equipo 2'}</div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600 }}>{pts} aciertos</div>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: '8px 12px', marginBottom: 10, textAlign: 'center', border: '2px solid rgba(255,255,255,0.1)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>{op?.texto} = ?</div>
      </div>
      {conMandos ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 260 }}>
          {mc.opciones.map((o, i) => (
            <button key={i} onClick={() => !bloqueado && resolver(i === mc.correcta)} disabled={bloqueado}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 900, fontSize: '1.2rem', cursor: bloqueado ? 'default' : 'pointer' }}>
              <LetraMando i={i} />{o}
            </button>
          ))}
        </div>
      ) : (
        <Teclado valor={valor} onDigit={(d) => { if (!bloqueado) setValor((v) => (v.length < 8 ? v + d : v)); }} onErase={() => setValor((v) => v.slice(0, -1))}
          onConfirm={confirmar} tipoNum={tipoNum} color={colorH} />
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
// Menú propio (operaciones y tipo de números) + partida con el tirón de cuerda COMPARTIDO
// (components/TironCuerdaEscena: escenario, meta, personajes y mandos micro:bit).
export default function TironCuerdaJuego({ primaria = false }) {
  const [pantalla, setPantalla] = useState('menu');
  const [tipoNum, setTipoNum] = useState('naturales');
  const [tiposOp, setTiposOp] = useState(OPS_TODAS);
  const [partida, setPartida] = useState(0);
  const movil = typeof window !== 'undefined' && window.innerWidth < 720;

  const btnBase = { border: 'none', cursor: 'pointer', fontWeight: 900, borderRadius: 18 };

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
        maxWidth:380, fontSize:'0.88rem' }}>
        2 equipos. Acierta para tirar · Falla y pierdes terreno.<br/>
        En la partida eliges la meta, los personajes y, si quieres, <b style={{color:'#FFE234'}}>jugar con mandos micro:bit</b>.
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

      <button onClick={() => { setPartida(p => p + 1); setPantalla('juego'); }} style={{ ...btnBase, padding:'16px 44px', fontSize:'1.1rem',
        background:'linear-gradient(135deg,#f093fb,#f5576c)', color:'white',
        boxShadow:'0 8px 24px rgba(245,87,108,0.4)' }}>
        🪢 ¡Empezar!
      </button>
    </div>
  );

  // ── Juego (armazón compartido) ──
  return (
    <div style={{ height:'100vh', overflowY:'auto', background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
      fontFamily:"'Segoe UI',Nunito,Arial,sans-serif", padding:'56px 12px 24px', boxSizing:'border-box' }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
          <span style={{ fontSize:'1.1rem', fontWeight:900, color:'#FFE234' }}>🪢 Tirón de Cuerda</span>
          <button onClick={() => setPantalla('menu')} style={{ ...btnBase, padding:'7px 14px', fontSize:'0.8rem', background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.2)' }}>⚙️ Operaciones</button>
        </div>
        <CompeticionCuerda key={partida} metaInicial={LIMITE} isMobile={movil} onSalir={() => setPantalla('menu')}
          renderPanel={(equipo, { key, aplicar, bloqueado }) => (
            <PanelEquipoFeria key={key} equipo={equipo} aplicar={aplicar} bloqueado={bloqueado} tipoNum={tipoNum} tiposOp={tiposOp} primaria={primaria} />
          )} />
      </div>
    </div>
  );
}
