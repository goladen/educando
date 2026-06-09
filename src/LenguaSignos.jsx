import React, { useState, useMemo, useEffect } from 'react';
import lenguadesignoImg from './assets/lenguadesigno.jpg';

// Carga la imagen una vez y cachea sus dimensiones naturales
let _naturalW = null;
let _naturalH = null;
const _listeners = new Set();

function loadSpriteDims() {
  if (_naturalW) return;
  const img = new Image();
  img.onload = () => {
    _naturalW = img.naturalWidth;
    _naturalH = img.naturalHeight;
    _listeners.forEach(cb => cb());
    _listeners.clear();
  };
  img.src = lenguadesignoImg;
}

function useSpriteDims() {
  const [dims, setDims] = useState(_naturalW ? { w: _naturalW, h: _naturalH } : null);
  useEffect(() => {
    if (_naturalW) { setDims({ w: _naturalW, h: _naturalH }); return; }
    const cb = () => setDims({ w: _naturalW, h: _naturalH });
    _listeners.add(cb);
    loadSpriteDims();
    return () => _listeners.delete(cb);
  }, []);
  return dims;
}

// Fracción del ancho de celda que ocupa el margen izquierdo (y derecho) del sprite
const PAD_RATIO = 0.14;

// Sprite grid: 7 cols × 6 rows
// Row 0: A B C D E F G
// Row 1: H I J K L M N
// Row 2: O P Q R S T U
// Row 3: V W X Y Z (cols 0-4)
// Row 4: 1 2 3 4 5 6 7
// Row 5: 8 9 10 (cols 2-4, centered)
const COLS = 7;
const ROWS = 6;

const SIGN_MAP = {
  'A':[0,0],'B':[1,0],'C':[2,0],'D':[3,0],'E':[4,0],'F':[5,0],'G':[6,0],
  'H':[0,1],'I':[1,1],'J':[2,1],'K':[3,1],'L':[4,1],'M':[5,1],'N':[6,1],
  'O':[0,2],'P':[1,2],'Q':[2,2],'R':[3,2],'S':[4,2],'T':[5,2],'U':[6,2],
  'V':[1,3],'W':[2,3],'X':[3,3],'Y':[4,3],'Z':[5,3],
  '1':[0,4],'2':[1,4],'3':[2,4],'4':[3,4],'5':[4,4],'6':[5,4],'7':[6,4],
  '8':[3,5],'9':[4,5],'10':[5,5],
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = ['1','2','3','4','5','6','7','8','9','10'];

const PALABRAS = [
  'HOLA','SOL','LUZ','MAR','PAZ','OJO','PIE',
  'CASA','GATO','LUNA','MESA','AGUA','AMOR','MAMA','PAPA',
  'LIBRO','AMIGO','PERRO','COLOR','MUNDO','CLASE','BARCO',
  'MADRE','PADRE','BANCO','CAMPO','TEXTO','FLOR','NUBE',
  'ESCUELA','PELOTA','VENTANA','FAMILIA','PRIMERO',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Renders one sign from the sprite sheet.
// hideLabel=true crops the bottom 28% to remove the letter label.
function Sign({ char, size = 80, hideLabel = false }) {
  const dims = useSpriteDims();
  const key = char.toUpperCase();
  const pos = SIGN_MAP[key];
  if (!pos) return null;
  const [col, row] = pos;

  // Fallback antes de que cargue la imagen
  if (!dims) return <div style={{ width: size, height: Math.round(size * 0.82), flexShrink: 0 }} />;

  // Escalar imagen: bgW = COLS * size exacto
  const scale = (size * COLS) / dims.w;
  const cellH = (dims.h / ROWS) * scale;
  const displayH = hideLabel ? Math.round(cellH * 0.82) : cellH;

  // Corrección de margen: celdas reales < size → error acumulado por columna
  // xPos centra el contenido de cada celda dentro del contenedor de `size` px
  const leftPad = size * PAD_RATIO;
  const cellW   = (COLS * size - 2 * leftPad) / COLS;
  const xPos    = leftPad + (col + 0.6) * cellW - size / 2;
  const yPos    = row * cellH;

  return (
    <div style={{
      width: size,
      height: displayH,
      overflow: 'hidden',
      flexShrink: 0,
      backgroundImage: `url(${lenguadesignoImg})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${COLS * size}px ${dims.h * scale}px`,
      backgroundPosition: `-${xPos}px -${yPos}px`,
    }} />
  );
}

// Sign with a letter label below (used in transcription mode)
function SignLabeled({ char, size = 70 }) {
  const hasSign = !!SIGN_MAP[char.toUpperCase()];
  if (!hasSign) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
        <div style={{ width:size, height:size * 0.72, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: size * 0.55, color:'#bbb', border:'2px dashed #ddd', borderRadius:10 }}>
          {char === ' ' ? '·' : char}
        </div>
        <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#aaa', minHeight:16 }}>&nbsp;</span>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <Sign char={char} size={size} hideLabel={false} />
      <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#2563EB' }}>{char.toUpperCase()}</span>
    </div>
  );
}

// ─── MODO TRANSCRIPCIÓN ──────────────────────────────────────────────────────
function ModoTranscripcion() {
  const [texto, setTexto] = useState('');
  const chars = texto.toUpperCase().split('').filter(c => c !== '\n');

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe una palabra o frase..."
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px 16px', fontSize: '1.1rem',
            border: '2px solid #93C5FD', borderRadius: 14,
            outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', background: '#F0F9FF',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = '#2563EB'}
          onBlur={e => e.target.style.borderColor = '#93C5FD'}
        />
      </div>

      {chars.length === 0 && (
        <div style={{ textAlign:'center', color:'#94A3B8', fontSize:'1rem', padding:'40px 0' }}>
          Los signos aparecerán aquí mientras escribes ✍️
        </div>
      )}

      {chars.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px 16px',
          justifyContent: 'center', padding: '20px 10px',
          background: '#F8FAFC', borderRadius: 16,
          border: '1.5px solid #E2E8F0',
          minHeight: 120,
        }}>
          {chars.map((ch, i) => (
            ch === ' '
              ? <div key={i} style={{ width: 20 }} />
              : <SignLabeled key={i} char={ch} size={72} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MODO DELETREAR ──────────────────────────────────────────────────────────
function ModoDeletrear() {
  const [palabraIdx, setPalabraIdx] = useState(() => Math.floor(Math.random() * PALABRAS.length));
  const [escrito, setEscrito] = useState([]);
  const [estado, setEstado] = useState('jugando'); // 'jugando' | 'ok' | 'error'
  const [mostrarPista, setMostrarPista] = useState(false);
  const [puntos, setPuntos] = useState(0);
  const [intentos, setIntentos] = useState(0);

  const palabra = PALABRAS[palabraIdx];

  const teclado = useMemo(() => shuffle(LETTERS), [palabraIdx]);

  const clickLetra = (letra) => {
    if (estado !== 'jugando') return;
    const nueva = [...escrito, letra];
    setEscrito(nueva);

    if (nueva.length === palabra.length) {
      const correcto = nueva.join('') === palabra;
      setEstado(correcto ? 'ok' : 'error');
      setIntentos(i => i + 1);
      if (correcto) setPuntos(p => p + 1);
    }
  };

  const borrar = () => {
    if (estado !== 'jugando') return;
    setEscrito(e => e.slice(0, -1));
  };

  const siguiente = () => {
    let next;
    do { next = Math.floor(Math.random() * PALABRAS.length); } while (next === palabraIdx);
    setPalabraIdx(next);
    setEscrito([]);
    setEstado('jugando');
    setMostrarPista(false);
  };

  const reintentar = () => {
    setEscrito([]);
    setEstado('jugando');
    setMostrarPista(false);
  };

  return (
    <div>
      {/* Marcador */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ background:'#EFF6FF', borderRadius:12, padding:'6px 16px', fontSize:'0.9rem', fontWeight:700, color:'#1D4ED8' }}>
          ✅ {puntos} / {intentos}
        </div>
        <button
          onClick={() => setMostrarPista(m => !m)}
          style={{ padding:'6px 14px', background: mostrarPista ? '#FEF3C7' : '#F1F5F9',
            border:'2px solid ' + (mostrarPista ? '#F59E0B' : '#CBD5E1'),
            borderRadius:10, cursor:'pointer', fontSize:'0.85rem', fontWeight:600,
            color: mostrarPista ? '#92400E' : '#64748B' }}>
          {mostrarPista ? '🙈 Ocultar pista' : '💡 Ver pista'}
        </button>
      </div>

      {/* Palabra objetivo */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <p style={{ color:'#64748B', fontSize:'0.85rem', margin:'0 0 8px' }}>Deletrea esta palabra con los signos:</p>
        <div style={{ fontSize:'2.5rem', fontWeight:900, letterSpacing:6, color:'#1E293B',
          background:'white', display:'inline-block', padding:'12px 32px',
          borderRadius:16, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
          {palabra}
        </div>
      </div>

      {/* Zona de escritura */}
      <div style={{
        display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center',
        minHeight:90, padding:'12px 16px', marginBottom:16,
        background: estado === 'ok' ? '#F0FDF4' : estado === 'error' ? '#FEF2F2' : '#F8FAFC',
        borderRadius:14, border:'2px solid ' + (estado === 'ok' ? '#86EFAC' : estado === 'error' ? '#FCA5A5' : '#E2E8F0'),
        transition:'all 0.3s',
        alignItems:'center',
      }}>
        {escrito.length === 0 && estado === 'jugando' && (
          <span style={{ color:'#CBD5E1', fontSize:'0.9rem' }}>Haz clic en los signos del teclado...</span>
        )}
        {escrito.map((l, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <Sign char={l} size={52} hideLabel />
            {mostrarPista && <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#F59E0B' }}>{l}</span>}
          </div>
        ))}
        {estado === 'ok' && (
          <span style={{ fontSize:'1.8rem', marginLeft:8 }}>🎉</span>
        )}
        {estado === 'error' && (
          <span style={{ fontSize:'1.8rem', marginLeft:8 }}>❌</span>
        )}
      </div>

      {/* Resultado */}
      {estado !== 'jugando' && (
        <div style={{ textAlign:'center', marginBottom:16 }}>
          {estado === 'ok' ? (
            <p style={{ color:'#16A34A', fontWeight:700, fontSize:'1.1rem', margin:0 }}>
              ¡Correcto! 🌟
            </p>
          ) : (
            <p style={{ color:'#DC2626', fontWeight:700, fontSize:'1rem', margin:'0 0 4px' }}>
              Incorrecto — la palabra era <strong>{palabra}</strong>
            </p>
          )}
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:12 }}>
            {estado === 'error' && (
              <button onClick={reintentar}
                style={{ padding:'10px 22px', background:'white', border:'2px solid #94A3B8',
                  borderRadius:12, cursor:'pointer', fontWeight:600, color:'#475569' }}>
                🔄 Reintentar
              </button>
            )}
            <button onClick={siguiente}
              style={{ padding:'10px 22px', background:'linear-gradient(135deg,#2563EB,#1D4ED8)',
                border:'none', borderRadius:12, cursor:'pointer', fontWeight:700, color:'white',
                boxShadow:'0 4px 12px rgba(37,99,235,0.35)' }}>
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Controles teclado */}
      {estado === 'jugando' && escrito.length > 0 && (
        <div style={{ textAlign:'center', marginBottom:8 }}>
          <button onClick={borrar}
            style={{ padding:'7px 18px', background:'white', border:'2px solid #E2E8F0',
              borderRadius:10, cursor:'pointer', fontWeight:600, color:'#64748B', fontSize:'0.85rem' }}>
            ⌫ Borrar último
          </button>
        </div>
      )}

      {/* Teclado de signos */}
      <div style={{
        display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center',
        padding:'16px 8px', background:'#F1F5F9', borderRadius:16,
        border:'1.5px solid #E2E8F0',
      }}>
        {teclado.map(letra => (
          <button
            key={letra}
            onClick={() => clickLetra(letra)}
            disabled={estado !== 'jugando'}
            style={{
              padding:0, background:'white', border:'2px solid #E2E8F0',
              borderRadius:10, cursor: estado === 'jugando' ? 'pointer' : 'default',
              transition:'all 0.15s', overflow:'hidden',
              opacity: estado !== 'jugando' ? 0.5 : 1,
              boxShadow:'0 2px 4px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => { if(estado==='jugando') { e.currentTarget.style.transform='scale(1.12)'; e.currentTarget.style.borderColor='#93C5FD'; e.currentTarget.style.boxShadow='0 4px 12px rgba(37,99,235,0.2)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.boxShadow='0 2px 4px rgba(0,0,0,0.06)'; }}
          >
            <Sign char={letra} size={48} hideLabel />
          </button>
        ))}
      </div>
      <p style={{ textAlign:'center', color:'#94A3B8', fontSize:'0.75rem', marginTop:8 }}>
        Teclado mezclado — ¡sin pistas de qué letra es cada signo!
      </p>
    </div>
  );
}

// ─── PANEL REFERENCIA (abecedario completo) ───────────────────────────────────
function ModoReferencia() {
  return (
    <div>
      <p style={{ textAlign:'center', color:'#64748B', marginBottom:20, fontSize:'0.9rem' }}>
        Abecedario completo en lengua de signos española
      </p>
      <p style={{ color:'#94A3B8', fontSize:'0.8rem', fontWeight:600, marginBottom:8, marginTop:0 }}>
        Letras
      </p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 8px', justifyContent:'center', marginBottom:24 }}>
        {LETTERS.map(l => (
          <div key={l} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            background:'white', borderRadius:12, padding:'10px 8px',
            boxShadow:'0 2px 8px rgba(0,0,0,0.07)', border:'1.5px solid #E2E8F0',
            minWidth:62,
          }}>
            <Sign char={l} size={56} hideLabel={false} />
            <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#2563EB' }}>{l}</span>
          </div>
        ))}
      </div>

      <p style={{ color:'#94A3B8', fontSize:'0.8rem', fontWeight:600, marginBottom:8 }}>
        Números
      </p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 8px', justifyContent:'center' }}>
        {NUMBERS.map(n => (
          <div key={n} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            background:'white', borderRadius:12, padding:'10px 8px',
            boxShadow:'0 2px 8px rgba(0,0,0,0.07)', border:'1.5px solid #E2E8F0',
            minWidth:62,
          }}>
            <Sign char={n} size={56} hideLabel={false} />
            <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#7C3AED' }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function LenguaSignos({ onExit }) {
  const [modo, setModo] = useState('transcripcion');

  const tabs = [
    { id:'transcripcion', label:'✍️ Transcribir', desc:'Texto → signos' },
    { id:'deletrear',     label:'🖐️ Deletrear',   desc:'Quiz de signos' },
    { id:'referencia',    label:'📖 Referencia',  desc:'Abecedario' },
  ];

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'linear-gradient(135deg,#EFF6FF 0%,#F0F9FF 50%,#F8FAFC 100%)',
      overflowY:'auto', fontFamily:'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg,#2563EB,#1D4ED8)',
        padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
        boxShadow:'0 4px 20px rgba(37,99,235,0.3)', position:'sticky', top:0, zIndex:10,
      }}>
        <button
          onClick={onExit}
          style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:10,
            padding:'8px 14px', color:'white', cursor:'pointer', fontWeight:600,
            fontSize:'0.9rem', backdropFilter:'blur(4px)' }}>
          ← Volver
        </button>
        <div>
          <h1 style={{ margin:0, color:'white', fontSize:'1.3rem', fontWeight:800 }}>
            🤟 Lengua de Signos
          </h1>
          <p style={{ margin:0, color:'rgba(255,255,255,0.7)', fontSize:'0.78rem' }}>
            Aprende el alfabeto manual español
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display:'flex', gap:8, padding:'16px 20px 0',
        maxWidth:700, margin:'0 auto',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setModo(t.id)}
            style={{
              flex:1, padding:'10px 8px', border:'2px solid',
              borderColor: modo === t.id ? '#2563EB' : '#E2E8F0',
              borderRadius:12, cursor:'pointer', fontWeight:700,
              background: modo === t.id ? '#EFF6FF' : 'white',
              color: modo === t.id ? '#1D4ED8' : '#94A3B8',
              fontSize:'0.8rem', transition:'all 0.2s',
              display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            }}>
            <span>{t.label}</span>
            <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.7 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ maxWidth:700, margin:'0 auto', padding:'20px 20px 40px' }}>
        <div style={{
          background:'white', borderRadius:20, padding:'24px 20px',
          boxShadow:'0 4px 20px rgba(0,0,0,0.07)', border:'1.5px solid #E2E8F0',
        }}>
          {modo === 'transcripcion' && <ModoTranscripcion />}
          {modo === 'deletrear'     && <ModoDeletrear />}
          {modo === 'referencia'    && <ModoReferencia />}
        </div>
      </div>
    </div>
  );
}
