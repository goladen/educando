import React, { useState, useMemo, useEffect, useCallback } from 'react';
import lenguadesignoImg from './assets/lenguadesigno.jpg';
import { FRASES_PIC } from './BibliotecaLenguaSignos';

// ─── Utilidades ARASAAC ───────────────────────────────────────────────────────
const PIC_API = 'https://api.arasaac.org/v1/pictograms/es/search';
const picImg  = id => `https://static.arasaac.org/pictograms/${id}/${id}_2500.png`;
const _picCache = new Map();

function stripAccents(w) {
  return w.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Verbos irregulares con diptongo: forma conjugada → infinitivo
const IRREG = {
  juega:'jugar', juegan:'jugar', juegas:'jugar',
  duerme:'dormir', duermen:'dormir', duermo:'dormir',
  vuela:'volar', vuelan:'volar', vuelas:'volar', vuelo:'volar',
  fluye:'fluir', fluyen:'fluir', fluyo:'fluir',
  puede:'poder', pueden:'poder', puedo:'poder',
  tiene:'tener', tienen:'tener', tengo:'tener',
  viene:'venir', vienen:'venir', vengo:'venir',
  quiere:'querer', quieren:'querer', quiero:'querer',
  sigue:'seguir', siguen:'seguir', sigo:'seguir',
  pide:'pedir', piden:'pedir', pido:'pedir',
  sirve:'servir', sirven:'servir',
  calienta:'calentar', calientan:'calentar',
  enciende:'encender', encienden:'encender',
  pierde:'perder', pierden:'perder',
  cierra:'cerrar', cierran:'cerrar',
  empieza:'empezar', empiezan:'empezar',
  elige:'elegir', eligen:'elegir',
  mueve:'mover', mueven:'mover',
  siente:'sentir', sienten:'sentir',
  miente:'mentir', mienten:'mentir',
};

function verbVariants(w) {
  // Primero: irregulares con diptongo
  if (IRREG[w]) return [IRREG[w]];

  const v = [];
  // Gerundios
  if (/ando$/.test(w)) return [w.slice(0,-4)+'ar'];
  if (/iendo$/.test(w)) return [w.slice(0,-5)+'er', w.slice(0,-5)+'ir'];

  // Plural → singular (intenta quitando -s, -n)
  if (/[^aeiou]an$/.test(w) && w.length > 4) v.push(w.slice(0,-2));  // cazan→caza
  else if (/[^aeiou]en$/.test(w) && w.length > 4) v.push(w.slice(0,-2)); // comen→come
  else if (/[^aeiou]n$/.test(w) && w.length > 4) v.push(w.slice(0,-1));
  else if (/s$/.test(w) && w.length > 3) v.push(w.slice(0,-1));

  // Forma base + r → infinitivo regular (dibuja→dibujar, escribe→escribir, navega→navegar)
  if (/[^aeiou][ae]$/.test(w) && w.length > 3) v.push(w + 'r');
  // Para las formas plurales ya reducidas, también añadir +r
  v.forEach(s => { if (/[^aeiou][ae]$/.test(s) && s.length > 3) v.push(s + 'r'); });

  return [...new Set(v)];
}

async function tryFetch(candidate) {
  if (_picCache.has(candidate)) return _picCache.get(candidate);
  try {
    const r = await fetch(`${PIC_API}/${encodeURIComponent(candidate)}`);
    if (!r.ok) return undefined; // undefined = not tried yet / not found, don't cache
    const d = await r.json();
    const id = Array.isArray(d) && d.length > 0 ? d[0]._id : null;
    _picCache.set(candidate, id);
    return id;
  } catch { return undefined; }
}

async function fetchPicId(word) {
  const base = stripAccents(word.toLowerCase().trim());
  if (_picCache.has(base)) return _picCache.get(base);

  // Intentar: palabra normalizada, luego variantes de infinitivo
  const candidates = [base, ...verbVariants(base)];
  for (const c of candidates) {
    const id = await tryFetch(c);
    if (id !== undefined) { // found (even if null = "no pictogram")
      _picCache.set(base, id);
      return id;
    }
  }
  _picCache.set(base, null);
  return null;
}

// Caché de todos los IDs por palabra (para el selector de alternativas)
const _picCacheAll = new Map();

async function fetchAllPicIds(word) {
  const base = stripAccents(word.toLowerCase().trim());
  if (_picCacheAll.has(base)) return _picCacheAll.get(base);

  const candidates = [base, ...verbVariants(base)];
  for (const c of candidates) {
    try {
      const r = await fetch(`${PIC_API}/${encodeURIComponent(c)}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (Array.isArray(d) && d.length > 0) {
        const ids = d.slice(0, 12).map(x => x._id).filter(Boolean);
        _picCacheAll.set(base, ids);
        if (!_picCache.has(base)) _picCache.set(base, ids[0]);
        return ids;
      }
    } catch {}
  }
  _picCacheAll.set(base, []);
  return [];
}

function fraseTexto(f) { return f.texto; }
function contentWords(f, max = 6) {
  return f.tokens.slice(0, max);
}
function pickRandom(arr, n, exclude = []) {
  const pool = arr.filter(x => !exclude.includes(x));
  const out = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

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
const HEART_CONFIG = [
  { left:'38%', delay:0,    size:'2rem'  },
  { left:'50%', delay:80,   size:'2.6rem'},
  { left:'62%', delay:160,  size:'1.8rem'},
  { left:'44%', delay:240,  size:'2.2rem'},
  { left:'56%', delay:320,  size:'1.6rem'},
  { left:'34%', delay:400,  size:'2rem'  },
  { left:'66%', delay:480,  size:'1.9rem'},
];

function HeartsEffect({ show }) {
  if (!show) return null;
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:99999 }}>
      {HEART_CONFIG.map((h, i) => (
        <div key={i} style={{
          position:'absolute', bottom:'40%', left: h.left,
          fontSize: h.size, lineHeight:1,
          animation:`floatHeart 1.1s ease-out ${h.delay}ms forwards`,
        }}>❤️</div>
      ))}
    </div>
  );
}

function ModoTranscripcion() {
  const [texto, setTexto] = useState('');
  const [hablando, setHablando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const recRef = React.useRef(null);
  const chars = texto.toUpperCase().split('').filter(c => c !== '\n');

  const escucharTTS = () => {
    if (!window.speechSynthesis || !texto.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES'; u.rate = 0.85;
    u.onstart = () => setHablando(true);
    u.onend = () => setHablando(false);
    u.onerror = () => setHablando(false);
    window.speechSynthesis.speak(u);
  };

  const iniciarMicrofono = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz.'); return; }
    if (recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    recRef.current = rec;
    setEscuchando(true);
    rec.onresult = (e) => { setTexto(e.results[0][0].transcript); };
    rec.onerror = () => { setEscuchando(false); recRef.current = null; };
    rec.onend   = () => { setEscuchando(false); recRef.current = null; };
    rec.start();
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe una palabra o frase... o usa el micrófono 🎤"
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
        <div style={{ display:'flex', gap:10, marginTop:10 }}>
          <button onClick={escucharTTS} disabled={!texto.trim()}
            style={{ padding:'8px 18px', fontWeight:700, fontSize:'0.88rem',
              background: hablando ? '#DBEAFE' : 'white',
              color: hablando ? '#1D4ED8' : '#64748B',
              border:`2px solid ${hablando ? '#93C5FD' : '#E2E8F0'}`,
              borderRadius:10, cursor: texto.trim() ? 'pointer':'default',
              opacity: texto.trim() ? 1 : 0.45,
              transition:'all 0.2s', display:'inline-flex', alignItems:'center', gap:6 }}>
            <span>{hablando ? '🔊' : '🔈'}</span>
            {hablando ? 'Reproduciendo...' : 'Escuchar'}
          </button>
          <button onClick={iniciarMicrofono}
            style={{ padding:'8px 18px', fontWeight:700, fontSize:'0.88rem',
              background: escuchando ? '#FEE2E2' : 'white',
              color: escuchando ? '#DC2626' : '#64748B',
              border:`2px solid ${escuchando ? '#FCA5A5' : '#E2E8F0'}`,
              borderRadius:10, cursor:'pointer',
              transition:'all 0.2s', display:'inline-flex', alignItems:'center', gap:6,
              animation: escuchando ? 'pulse 1s infinite' : 'none' }}>
            <span>{escuchando ? '⏺️' : '🎤'}</span>
            {escuchando ? 'Escuchando...' : 'Dictar'}
          </button>
        </div>
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
  const [showHearts, setShowHearts] = useState(false);
  const [hablando, setHablando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const recRef = React.useRef(null);

  const palabra = PALABRAS[palabraIdx];

  const teclado = useMemo(() => shuffle(LETTERS), [palabraIdx]);

  const escucharTTS = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(palabra.toLowerCase());
    u.lang = 'es-ES'; u.rate = 0.8;
    u.onstart = () => setHablando(true);
    u.onend = () => setHablando(false);
    u.onerror = () => setHablando(false);
    window.speechSynthesis.speak(u);
  };

  const iniciarMicrofono = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz.'); return; }
    if (recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    recRef.current = rec;
    setEscuchando(true); setTranscripcion('');
    rec.onresult = (e) => { setTranscripcion(e.results[0][0].transcript); };
    rec.onerror = () => { setEscuchando(false); recRef.current = null; };
    rec.onend   = () => { setEscuchando(false); recRef.current = null; };
    rec.start();
  };

  const clickLetra = (letra) => {
    if (estado !== 'jugando') return;
    const nueva = [...escrito, letra];
    setEscrito(nueva);

    if (nueva.length === palabra.length) {
      const correcto = nueva.join('') === palabra;
      setEstado(correcto ? 'ok' : 'error');
      setIntentos(i => i + 1);
      if (correcto) {
        setPuntos(p => p + 1);
        setShowHearts(true);
        setTimeout(() => setShowHearts(false), 1600);
      }
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
      <HeartsEffect show={showHearts} />
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
          borderRadius:16, boxShadow:'0 4px 12px rgba(0,0,0,0.08)', marginBottom:12 }}>
          {palabra}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={escucharTTS}
            style={{ padding:'8px 18px', fontWeight:700, fontSize:'0.88rem',
              background: hablando ? '#DBEAFE' : 'white',
              color: hablando ? '#1D4ED8' : '#64748B',
              border:`2px solid ${hablando ? '#93C5FD' : '#E2E8F0'}`,
              borderRadius:10, cursor:'pointer',
              transition:'all 0.2s', display:'inline-flex', alignItems:'center', gap:6 }}>
            <span>{hablando ? '🔊' : '🔈'}</span>
            {hablando ? 'Reproduciendo...' : 'Escuchar'}
          </button>
          <button onClick={iniciarMicrofono}
            style={{ padding:'8px 18px', fontWeight:700, fontSize:'0.88rem',
              background: escuchando ? '#FEE2E2' : 'white',
              color: escuchando ? '#DC2626' : '#64748B',
              border:`2px solid ${escuchando ? '#FCA5A5' : '#E2E8F0'}`,
              borderRadius:10, cursor:'pointer',
              transition:'all 0.2s', display:'inline-flex', alignItems:'center', gap:6,
              animation: escuchando ? 'pulse 1s infinite' : 'none' }}>
            <span>{escuchando ? '⏺️' : '🎤'}</span>
            {escuchando ? 'Escuchando...' : 'Decir palabra'}
          </button>
        </div>
        {transcripcion && (
          <p style={{ margin:'10px 0 0', fontSize:'0.82rem', color:'#64748B', fontStyle:'italic' }}>
            Reconocido: "<strong>{transcripcion}</strong>"
          </p>
        )}
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

// ─── MODO PICTOGRAMAS (traductor) ─────────────────────────────────────────────
function PicCell({ id, word, size = 90, hasAlts, onClick }) {
  const [err, setErr] = useState(false);
  const found = id && !err;
  return (
    <div onClick={hasAlts ? onClick : undefined}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4,
        cursor: hasAlts ? 'pointer' : 'default', position:'relative' }}>
      <div style={{ width:size, height:size, borderRadius:10, overflow:'hidden',
        background: found ? '#F0FDF4' : '#F8FAFC',
        border:'2px solid ' + (found ? '#A7F3D0' : '#E2E8F0'),
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hasAlts ? '0 2px 8px rgba(5,150,105,0.12)' : 'none' }}>
        {found
          ? <img src={picImg(id)} alt={word} onError={() => setErr(true)}
              style={{ width:size, height:size, objectFit:'contain' }} />
          : <span style={{ fontSize:'1.4rem', color:'#CBD5E1' }}>🔤</span>}
      </div>
      {hasAlts && (
        <div style={{ position:'absolute', top:4, right:4,
          background:'#059669', borderRadius:'50%', width:16, height:16,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'0.6rem', color:'white', fontWeight:900, lineHeight:1 }}>⊕</div>
      )}
      <span style={{ fontSize:'0.7rem', fontWeight:700, color: found ? '#065F46':'#94A3B8',
        maxWidth:size, textAlign:'center', wordBreak:'break-word' }}>{word}</span>
    </div>
  );
}

function AltsModal({ word, ids, selectedId, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999,
      background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:20,
        padding:'20px 24px', maxWidth:460, width:'90%',
        boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'80vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:800, color:'#1E293B' }}>
            Pictogramas para <em>"{word}"</em>
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:'1.3rem', cursor:'pointer', color:'#94A3B8', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
          {ids.map((id) => (
            <button key={id} onClick={() => onSelect(id)} style={{
              padding:6, border:`3px solid ${id === selectedId ? '#059669' : '#E2E8F0'}`,
              borderRadius:14, cursor:'pointer',
              background: id === selectedId ? '#F0FDF4' : 'white',
              transition:'all 0.15s', boxShadow: id === selectedId ? '0 0 0 2px #A7F3D0' : 'none' }}>
              <img src={picImg(id)} alt="" style={{ width:80, height:80, objectFit:'contain', display:'block' }} />
            </button>
          ))}
        </div>
        <p style={{ margin:'14px 0 0', fontSize:'0.75rem', color:'#94A3B8', textAlign:'center' }}>
          Haz clic en un pictograma para seleccionarlo
        </p>
      </div>
    </div>
  );
}

function ModoPictogramas() {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [popup, setPopup] = useState(null); // { idx, word, ids, selectedId }
  const recRef = React.useRef(null);

  const traducir = useCallback(async () => {
    const tokens = texto.trim().split(/\s+/)
      .map(w => w.replace(/[.,;:!?¿¡"'()]/g, '').trim()).filter(Boolean);
    if (!tokens.length) return;
    setCargando(true);
    setResultados(tokens.map(w => ({ word: w, ids: [], selectedId: null, loading: true })));
    await Promise.all(tokens.map((w, i) =>
      fetchAllPicIds(w).then(ids => setResultados(p => {
        const n = [...p]; n[i] = { word: w, ids, selectedId: ids[0] ?? null, loading: false }; return n;
      }))
    ));
    setCargando(false);
  }, [texto]);

  const iniciarMicrofono = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz.'); return; }
    if (recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    recRef.current = rec;
    setEscuchando(true);
    rec.onresult = (e) => { setTexto(e.results[0][0].transcript); };
    rec.onerror = () => { setEscuchando(false); recRef.current = null; };
    rec.onend   = () => { setEscuchando(false); recRef.current = null; };
    rec.start();
  };

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <textarea value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) traducir(); }}
          placeholder="Escribe una frase... o usa el micrófono 🎤"
          rows={2}
          style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px',
            fontSize:'1rem', border:'2px solid #A7F3D0', borderRadius:12,
            outline:'none', resize:'vertical', fontFamily:'inherit', background:'#F0FDF4' }} />
        <div style={{ display:'flex', gap:10, marginTop:10, flexWrap:'wrap' }}>
          <button onClick={traducir} disabled={!texto.trim() || cargando}
            style={{ padding:'10px 24px', fontWeight:700,
              background: !texto.trim()||cargando ? '#D1FAE5' : 'linear-gradient(135deg,#059669,#047857)',
              color: !texto.trim()||cargando ? '#6EE7B7' : 'white',
              border:'none', borderRadius:10, cursor: !texto.trim()||cargando ? 'default':'pointer',
              boxShadow: texto.trim()&&!cargando ? '0 3px 10px rgba(5,150,105,0.3)':'none' }}>
            {cargando ? '⏳ Buscando...' : '🔍 Traducir'}
          </button>
          <button onClick={iniciarMicrofono}
            style={{ padding:'10px 18px', fontWeight:700, fontSize:'0.88rem',
              background: escuchando ? '#FEE2E2' : 'white',
              color: escuchando ? '#DC2626' : '#64748B',
              border:`2px solid ${escuchando ? '#FCA5A5' : '#E2E8F0'}`,
              borderRadius:10, cursor:'pointer',
              transition:'all 0.2s', display:'inline-flex', alignItems:'center', gap:6,
              animation: escuchando ? 'pulse 1s infinite' : 'none' }}>
            <span>{escuchando ? '⏺️' : '🎤'}</span>
            {escuchando ? 'Escuchando...' : 'Dictar'}
          </button>
        </div>
      </div>
      {resultados.length > 0 && (
        <>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'12px 10px',
            justifyContent:'center', padding:'16px 8px',
            background:'#F8FAFC', borderRadius:14, border:'1.5px solid #E2E8F0' }}>
            {resultados.map((r, i) => (
              r.word === ' ' ? <div key={i} style={{ width:16 }} />
                : <PicCell key={i} id={r.selectedId} word={r.word} size={80}
                    hasAlts={r.ids.length > 1}
                    onClick={() => setPopup({ idx: i, word: r.word, ids: r.ids, selectedId: r.selectedId })} />
            ))}
          </div>
          <p style={{ margin:'8px 0 0', fontSize:'0.75rem', color:'#94A3B8', textAlign:'center' }}>
            Los pictogramas con <strong style={{ color:'#059669' }}>⊕</strong> tienen alternativas — haz clic para cambiarlos
          </p>
        </>
      )}
      {popup && (
        <AltsModal
          word={popup.word}
          ids={popup.ids}
          selectedId={resultados[popup.idx]?.selectedId}
          onSelect={(id) => {
            setResultados(p => p.map((r, i) => i === popup.idx ? { ...r, selectedId: id } : r));
            setPopup(null);
          }}
          onClose={() => setPopup(null)}
        />
      )}
      {!resultados.length && (
        <div style={{ textAlign:'center', color:'#94A3B8', padding:'30px 0' }}>
          <div style={{ fontSize:'3rem', marginBottom:8 }}>🖼️</div>
          <p style={{ margin:0 }}>Los pictogramas aparecerán aquí</p>
          <p style={{ margin:'4px 0 0', fontSize:'0.8rem' }}>Powered by ARASAAC</p>
        </div>
      )}
    </div>
  );
}

// ─── MODO QUIZ PICTOGRAMAS ────────────────────────────────────────────────────
function OptionCard({ frase, pics, selected, estado, isCorrect, onClick, label }) {
  const words = contentWords(frase);
  const border = selected
    ? isCorrect ? '3px solid #16A34A' : '3px solid #DC2626'
    : '2px solid #E2E8F0';
  const bg = selected
    ? isCorrect ? '#F0FDF4' : '#FEF2F2'
    : '#FAFAFA';

  return (
    <button onClick={onClick} disabled={estado !== 'jugando'}
      style={{ background:bg, border, borderRadius:16, padding:'12px 10px',
        cursor: estado==='jugando' ? 'pointer':'default', textAlign:'center',
        display:'flex', flexDirection:'column', alignItems:'center', gap:8,
        transition:'all 0.2s', flex:'1 1 200px', minWidth:0,
        boxShadow: selected ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => { if(estado==='jugando') e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; }}>
      <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#94A3B8', letterSpacing:1 }}>{label}</span>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
        {words.map((w, i) => {
          const id = pics[w];
          return (
            <div key={i} style={{ width:56, height:56, borderRadius:8, overflow:'hidden',
              background: id ? '#EFF6FF':'#F1F5F9', border:'1px solid #E2E8F0',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {id
                ? <img src={picImg(id)} alt={w} style={{ width:56, height:56, objectFit:'contain' }} />
                : <span style={{ fontSize:'0.65rem', color:'#94A3B8', padding:2, textAlign:'center' }}>{w}</span>}
            </div>
          );
        })}
      </div>
      {selected && (
        <span style={{ fontSize:'1.2rem' }}>{isCorrect ? '✅' : '❌'}</span>
      )}
    </button>
  );
}

function ModoQuizPictogramas() {
  const [puntos, setPuntos] = useState(0);
  const [intentos, setIntentos] = useState(0);
  const [pregunta, setPregunta] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [hablando, setHablando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [showHearts, setShowHearts] = useState(false);
  const recRef = React.useRef(null);

  const escuchar = useCallback((texto) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES'; u.rate = 0.85;
    u.onstart = () => setHablando(true);
    u.onend = () => setHablando(false);
    u.onerror = () => setHablando(false);
    window.speechSynthesis.speak(u);
  }, []);


  const iniciarMicrofono = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz.'); return; }
    if (recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    recRef.current = rec;
    setEscuchando(true); setTranscripcion('');
    rec.onresult = (e) => { setTranscripcion(e.results[0][0].transcript); };
    rec.onerror = () => { setEscuchando(false); recRef.current = null; };
    rec.onend  = () => { setEscuchando(false); recRef.current = null; };
    rec.start();
  }, []);

  const generarPregunta = useCallback(async () => {
    setEstado('cargando');
    setSeleccion(null);
    const [correcta, ...distractores] = pickRandom(FRASES_PIC, 4);
    const options = [correcta, ...distractores];
    // Mezclar opciones
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const correctIdx = options.indexOf(correcta);
    // Recopilar todas las palabras de contenido únicas
    const allWords = [...new Set(options.flatMap(f => contentWords(f)))];
    // Fetch en paralelo
    const entries = await Promise.all(allWords.map(w => fetchPicId(w).then(id => [w, id])));
    const pics = Object.fromEntries(entries);
    setPregunta({ correcta, options, correctIdx, pics });
    setEstado('jugando');
  }, []);

  useEffect(() => { generarPregunta(); }, [generarPregunta]);

  const dispararCorazones = () => {
    setShowHearts(true);
    setTimeout(() => setShowHearts(false), 1600);
  };

  const seleccionar = (idx) => {
    if (estado !== 'jugando') return;
    setSeleccion(idx);
    setEstado('resuelto');
    setIntentos(i => i + 1);
    if (idx === pregunta.correctIdx) { setPuntos(p => p + 1); dispararCorazones(); }
  };

  if (estado === 'cargando' || !pregunta) return (
    <div style={{ textAlign:'center', padding:'40px 0', color:'#64748B' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>⏳</div>
      <p style={{ margin:0, fontWeight:600 }}>Buscando pictogramas...</p>
    </div>
  );

  return (
    <div>
      <HeartsEffect show={showHearts} />
      {/* Marcador */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ background:'#EFF6FF', borderRadius:12, padding:'6px 16px',
          fontSize:'0.9rem', fontWeight:700, color:'#1D4ED8' }}>✅ {puntos} / {intentos}</div>
        <span style={{ fontSize:'0.8rem', color:'#94A3B8', fontWeight:600 }}>
          ¿Qué pictogramas corresponden a esta frase?
        </span>
      </div>

      {/* Frase objetivo */}
      <div style={{ textAlign:'center', marginBottom:20,
        background:'linear-gradient(135deg,#EFF6FF,#F0F9FF)', borderRadius:16,
        padding:'18px 24px', border:'2px solid #BFDBFE' }}>
        <p style={{ margin:'0 0 12px', fontSize:'1.25rem', fontWeight:800, color:'#1E293B', lineHeight:1.4 }}>
          "{fraseTexto(pregunta.correcta)}"
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => escuchar(fraseTexto(pregunta.correcta))}
            style={{ padding:'8px 18px', fontWeight:700, fontSize:'0.88rem',
              background: hablando ? '#DBEAFE' : 'white',
              color: hablando ? '#1D4ED8' : '#64748B',
              border:`2px solid ${hablando ? '#93C5FD' : '#E2E8F0'}`,
              borderRadius:10, cursor:'pointer', transition:'all 0.2s',
              display:'inline-flex', alignItems:'center', gap:6 }}>
            <span>{hablando ? '🔊' : '🔈'}</span>
            {hablando ? 'Reproduciendo...' : 'Escuchar'}
          </button>

          <button onClick={iniciarMicrofono}
            style={{ padding:'8px 18px', fontWeight:700, fontSize:'0.88rem',
              background: escuchando ? '#FEE2E2' : 'white',
              color: escuchando ? '#DC2626' : '#64748B',
              border:`2px solid ${escuchando ? '#FCA5A5' : '#E2E8F0'}`,
              borderRadius:10, cursor:'pointer',
              transition:'all 0.2s', display:'inline-flex', alignItems:'center', gap:6,
              animation: escuchando ? 'pulse 1s infinite' : 'none' }}>
            <span>{escuchando ? '⏺️' : '🎤'}</span>
            {escuchando ? 'Escuchando...' : 'Decir frase'}
          </button>
        </div>

        {transcripcion && (
          <p style={{ margin:'10px 0 0', fontSize:'0.82rem', color:'#64748B', fontStyle:'italic' }}>
            Reconocido: "<strong>{transcripcion}</strong>"
          </p>
        )}
      </div>

      {/* Opciones 2×2 */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        {pregunta.options.map((f, i) => (
          <OptionCard key={f.id} frase={f} pics={pregunta.pics}
            selected={seleccion === i} estado={estado}
            isCorrect={i === pregunta.correctIdx}
            onClick={() => seleccionar(i)}
            label={`Opción ${i + 1}`} />
        ))}
      </div>

      {/* Feedback */}
      {estado === 'resuelto' && (
        <div style={{ textAlign:'center' }}>
          {seleccion === pregunta.correctIdx
            ? <p style={{ color:'#16A34A', fontWeight:700, fontSize:'1.05rem', margin:'0 0 12px' }}>¡Correcto! 🎉</p>
            : <p style={{ color:'#DC2626', fontWeight:700, fontSize:'0.95rem', margin:'0 0 12px' }}>
                Incorrecto — la respuesta correcta era la opción {pregunta.correctIdx + 1}
              </p>}
          <button onClick={generarPregunta}
            style={{ padding:'12px 32px', background:'linear-gradient(135deg,#059669,#047857)',
              border:'none', borderRadius:12, cursor:'pointer', fontWeight:700, color:'white',
              boxShadow:'0 4px 12px rgba(5,150,105,0.35)', fontSize:'1rem' }}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function LenguaSignos({ onExit }) {
  const [modo, setModo] = useState('transcripcion');

  const tabs = [
    { id:'transcripcion', label:'✍️ Signos',      desc:'Texto → signos' },
    { id:'deletrear',     label:'🖐️ Deletrear',   desc:'Quiz signos' },
    { id:'referencia',    label:'📖 Referencia',  desc:'Abecedario' },
    { id:'pictogramas',   label:'🖼️ Pictogramas', desc:'Texto → pics' },
    { id:'quizpic',       label:'🎯 Quiz Pics',   desc:'Adivina la frase' },
  ];

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'linear-gradient(135deg,#EFF6FF 0%,#F0F9FF 50%,#F8FAFC 100%)',
      overflowY:'auto', fontFamily:'system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes floatHeart{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-160px) scale(1.4);opacity:0}}
      `}</style>
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

      {/* Tabs — scrollable en móvil */}
      <div style={{ overflowX:'auto', padding:'14px 20px 0',
        maxWidth:740, margin:'0 auto', WebkitOverflowScrolling:'touch' }}>
        <div style={{ display:'flex', gap:6, minWidth:'max-content' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setModo(t.id)}
              style={{
                padding:'8px 14px', border:'2px solid',
                borderColor: modo === t.id
                  ? (t.id === 'pictogramas'||t.id === 'quizpic' ? '#059669' : '#2563EB')
                  : '#E2E8F0',
                borderRadius:12, cursor:'pointer', fontWeight:700, whiteSpace:'nowrap',
                background: modo === t.id
                  ? (t.id === 'pictogramas'||t.id === 'quizpic' ? '#ECFDF5' : '#EFF6FF')
                  : 'white',
                color: modo === t.id
                  ? (t.id === 'pictogramas'||t.id === 'quizpic' ? '#065F46' : '#1D4ED8')
                  : '#94A3B8',
                fontSize:'0.82rem', transition:'all 0.2s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth:740, margin:'0 auto', padding:'16px 20px 40px' }}>
        <div style={{
          background:'white', borderRadius:20, padding:'24px 20px',
          boxShadow:'0 4px 20px rgba(0,0,0,0.07)', border:'1.5px solid #E2E8F0',
        }}>
          {modo === 'transcripcion' && <ModoTranscripcion />}
          {modo === 'deletrear'     && <ModoDeletrear />}
          {modo === 'referencia'    && <ModoReferencia />}
          {modo === 'pictogramas'   && <ModoPictogramas />}
          {modo === 'quizpic'       && <ModoQuizPictogramas />}
        </div>
      </div>
    </div>
  );
}
