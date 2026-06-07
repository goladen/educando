import React, { useRef, useEffect, useState, useCallback } from 'react';
import sandTile88 from './kenney_racing-pack/PNG/Tiles/Sand road/road_sand88.png';

const CS         = 480;
const DEFAULT_SZ = Math.round(CS / 5); // 96 px
const ROT_STEP   = Math.PI / 8;        // 22.5° por clic

export default function TrackEditor({ onVolver }) {
  const canvasRef    = useRef(null);
  const imgRef       = useRef(null);
  const lastRef      = useRef(null);
  const drawing      = useRef(false);
  const stampsRef    = useRef([]);        // [{ x, y, angle, size }]
  const szRef        = useRef(DEFAULT_SZ);
  const selRef       = useRef(-1);        // índice del sello seleccionado

  const [sz,       setSz]       = useState(DEFAULT_SZ);
  const [count,    setCount]    = useState(0);
  const [mode,     setMode]     = useState('draw'); // 'draw' | 'select'
  const [selIdx,   setSelIdx]   = useState(-1);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.src = sandTile88;
    imgRef.current = img;
    bg(canvasRef.current.getContext('2d'));
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function bg(ctx) {
    ctx.fillStyle = '#3a6428';
    ctx.fillRect(0, 0, CS, CS);
  }

  function drawStamp(ctx, x, y, angle, size, save) {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (save) { stampsRef.current.push({ x, y, angle, size }); setCount(c => c + 1); }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function redrawAll() {
    const ctx = canvasRef.current.getContext('2d');
    bg(ctx);
    const sel = selRef.current;
    stampsRef.current.forEach((s, i) => {
      drawStamp(ctx, s.x, s.y, s.angle, s.size, false);
      if (i === sel) {
        // Anillo de selección
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth   = 3;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });
  }

  // ── Pincel ──────────────────────────────────────────────────────────────────
  function paintTo(to) {
    let from = lastRef.current;
    if (!from) { lastRef.current = { ...to }; return; }
    const size = szRef.current;
    const step = Math.round(size * 0.39);
    const ctx  = canvasRef.current.getContext('2d');
    while (true) {
      const dx = to.x - from.x, dy = to.y - from.y;
      if (Math.hypot(dx, dy) < step) break;
      const angle = Math.atan2(dy, dx);
      const nx = from.x + Math.cos(angle) * step;
      const ny = from.y + Math.sin(angle) * step;
      drawStamp(ctx, nx, ny, angle, size, true);
      from = { x: nx, y: ny };
    }
    lastRef.current = from;
  }

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (CS / r.width),
      y: (e.clientY - r.top)  * (CS / r.height),
    };
  }

  // ── Seleccionar sello al hacer clic ────────────────────────────────────────
  function selectAt(pt) {
    const stamps = stampsRef.current;
    let found = -1;
    for (let i = stamps.length - 1; i >= 0; i--) {
      const s = stamps[i];
      if (Math.hypot(pt.x - s.x, pt.y - s.y) <= s.size / 2) { found = i; break; }
    }
    selRef.current = found;
    setSelIdx(found);
    redrawAll();
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const onDown = (e) => {
    e.preventDefault();
    const pt = pos(e);
    if (mode === 'select') { selectAt(pt); return; }

    drawing.current = true;
    const ctx  = canvasRef.current.getContext('2d');
    const last = lastRef.current;
    const size = szRef.current;
    let angle  = 0;
    if (last) {
      const dx = pt.x - last.x, dy = pt.y - last.y;
      if (Math.hypot(dx, dy) > 2) angle = Math.atan2(dy, dx);
    }
    drawStamp(ctx, pt.x, pt.y, angle, size, true);
    lastRef.current = { x: pt.x, y: pt.y };
  };

  const onMove = (e) => {
    if (!drawing.current || mode !== 'draw') return;
    paintTo(pos(e));
  };

  const endStroke = () => { drawing.current = false; };

  // ── Rotar sello seleccionado ───────────────────────────────────────────────
  const rotate = (delta) => {
    const idx = selRef.current;
    if (idx < 0) return;
    stampsRef.current[idx].angle += delta;
    redrawAll();
  };

  // ── Deshacer ────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (!stampsRef.current.length) return;
    const removed = stampsRef.current.pop();
    setCount(stampsRef.current.length);
    // Si el sello eliminado era el seleccionado, limpiar selección
    if (selRef.current === stampsRef.current.length) {
      selRef.current = -1;
      setSelIdx(-1);
    }
    redrawAll();
    const last = stampsRef.current.at(-1);
    lastRef.current = last ? { x: last.x, y: last.y } : null;
  }, []);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo]);

  // ── Cambiar modo ────────────────────────────────────────────────────────────
  const toggleMode = () => {
    const next = mode === 'draw' ? 'select' : 'draw';
    setMode(next);
    if (next === 'draw') {
      selRef.current = -1;
      setSelIdx(-1);
      redrawAll();
    }
  };

  // ── Limpiar ─────────────────────────────────────────────────────────────────
  const clear = () => {
    stampsRef.current = [];
    lastRef.current   = null;
    selRef.current    = -1;
    setCount(0);
    setSelIdx(-1);
    bg(canvasRef.current.getContext('2d'));
  };

  const onSlider = (e) => { const v = +e.target.value; setSz(v); szRef.current = v; };

  // ── Render ──────────────────────────────────────────────────────────────────
  const hasSel = selIdx >= 0;

  return (
    <div style={S.page}>
      <div style={{ fontSize:'2.4rem', marginBottom:4 }}>🏗️</div>
      <h2 style={S.title}>Constructor de Circuitos</h2>
      <p style={S.hint}>
        {mode === 'draw'
          ? 'Arrastra para pintar · Ctrl+Z para deshacer'
          : hasSel ? 'Sello seleccionado · usa los botones de rotación' : 'Haz clic sobre un sello para seleccionarlo'}
      </p>

      <div style={S.wrap}>
        <canvas
          ref={canvasRef}
          width={CS} height={CH}
          style={{ display:'block', width:'100%', cursor: mode === 'select' ? 'pointer' : 'crosshair' }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
        />
      </div>

      {/* Slider */}
      <div style={S.sliderRow}>
        <span style={S.lbl}>🔍 Radio</span>
        <input type="range" min={24} max={200} value={sz}
          onChange={onSlider}
          style={{ flex:1, accentColor:'#FF6B00', cursor:'pointer' }}
        />
        <span style={S.val}>{sz}px</span>
      </div>

      {/* Fila: modo + rotación */}
      <div style={S.btns}>
        <button onClick={toggleMode}
          style={btn(mode === 'select' ? '#b06020' : '#2a5a3a')}>
          {mode === 'select' ? '✏️ Dibujar' : '👆 Seleccionar'}
        </button>

        <button onClick={() => rotate(-ROT_STEP)} disabled={!hasSel}
          style={btn(hasSel ? '#2d5a8a' : '#333')}>
          ↺ Girar
        </button>
        <button onClick={() => rotate(+ROT_STEP)} disabled={!hasSel}
          style={btn(hasSel ? '#2d5a8a' : '#333')}>
          ↻ Girar
        </button>
      </div>

      {/* Fila: deshacer + limpiar + volver */}
      <div style={S.btns}>
        <button onClick={undo} disabled={!count}
          style={btn(count ? '#5a3a7a' : '#333')}>
          ↩ Deshacer {count > 0 && <span style={S.badge}>{count}</span>}
        </button>
        <button onClick={clear}    style={btn('#555')}>🗑️ Limpiar</button>
        <button onClick={onVolver} style={btn('rgba(255,255,255,0.10)')}>← Volver</button>
      </div>
    </div>
  );
}

const CH = CS; // canvas cuadrado

const S = {
  page: {
    minHeight:'100vh',
    background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
    display:'flex', flexDirection:'column', alignItems:'center',
    padding:'24px 16px', color:'white', fontFamily:"'Segoe UI',sans-serif",
  },
  title: {
    fontSize:'1.9rem', fontWeight:900, margin:'0 0 4px',
    background:'linear-gradient(90deg,#FF6B00,#FFD700)',
    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
  },
  hint: { color:'#bbb', marginBottom:14, fontSize:'0.84rem', textAlign:'center', minHeight:20 },
  wrap: {
    borderRadius:12, overflow:'hidden',
    border:'2px solid rgba(255,255,255,0.12)',
    boxShadow:'0 10px 40px rgba(0,0,0,0.65)',
    width:'100%', maxWidth:CS,
  },
  sliderRow: { display:'flex', alignItems:'center', gap:12, marginTop:14, width:'100%', maxWidth:CS },
  lbl: { fontSize:'0.84rem', color:'#aaa', whiteSpace:'nowrap' },
  val: { fontSize:'0.82rem', color:'#FFD700', width:40, textAlign:'right' },
  btns: { display:'flex', gap:10, marginTop:10, flexWrap:'wrap', justifyContent:'center' },
  badge: {
    background:'rgba(255,255,255,0.25)', borderRadius:8,
    padding:'0 6px', marginLeft:6, fontSize:'0.75rem',
  },
};

function btn(bg) {
  return {
    padding:'10px 20px', borderRadius:10, cursor:'pointer',
    border:'1px solid rgba(255,255,255,0.18)',
    background:bg, color:'white', fontSize:'0.87rem', fontWeight:700,
  };
}
