import React, { useState, useRef, useEffect } from 'react';

/* ── helpers ─────────────────────────────────────────────── */
const shuffle = a => [...a].sort(() => Math.random() - 0.5);
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const isPerfSq = n => Number.isInteger(Math.sqrt(n));
const divPairs = n => { const p = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) p.push([i, n / i]); return p; };

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* pools */
const PRIMES     = [2, 3, 5, 7, 11, 13, 17, 19];
const COMPOSITES = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
const SQUARES    = [4, 9, 16, 25, 36, 49];
const NON_SQ     = [5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 26, 27, 28];
const EVENS      = [6, 8, 10, 12, 14, 16, 18, 20];
const ODDS       = [5, 7, 9, 11, 13, 15, 17];

/* chip initial positions: grid + jitter */
function initChips(n, W, H, R) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(n * W / H)));
  const rows = Math.ceil(n / cols);
  const cw = W / cols, ch = H / rows;
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: Math.max(R, Math.min(W - R, cw * (i % cols + 0.5) + (Math.random() - 0.5) * cw * 0.55)),
    y: Math.max(R, Math.min(H - R, ch * (Math.floor(i / cols) + 0.5) + (Math.random() - 0.5) * ch * 0.55)),
  }));
}

/* ── DraggableChipArea ───────────────────────────────────── */
function DraggableChipArea({ chips, setChips, R, W = 480, H = 270, pairedIds = new Set() }) {
  const areaRef = useRef(null);
  const dragRef = useRef(null); // {id, ox, oy}

  const getXY = e => {
    const rect = areaRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  };

  const onChipDown = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const chip = chips.find(c => c.id === id);
    const [cx, cy] = getXY(e);
    dragRef.current = { id, ox: cx - chip.x, oy: cy - chip.y };
  };

  const onMove = e => {
    if (!dragRef.current) return;
    e.preventDefault();
    const [cx, cy] = getXY(e);
    const x = Math.max(R, Math.min(W - R, cx - dragRef.current.ox));
    const y = Math.max(R, Math.min(H - R, cy - dragRef.current.oy));
    setChips(prev => prev.map(c => c.id === dragRef.current.id ? { ...c, x, y } : c));
  };

  const onUp = () => { dragRef.current = null; };

  return (
    <div ref={areaRef}
      onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchMove={onMove} onTouchEnd={onUp}
      style={{ position: 'relative', width: W, height: H, maxWidth: '100%', borderRadius: 14, background: '#f0f4ff', border: '2px dashed #c3dafe', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)', touchAction: 'none', userSelect: 'none', overflow: 'hidden', flexShrink: 0 }}
    >
      {chips.map(chip => {
        const isPrd = pairedIds.has(chip.id);
        return (
          <div key={chip.id}
            onMouseDown={e => onChipDown(e, chip.id)}
            onTouchStart={e => onChipDown(e, chip.id)}
            style={{
              position: 'absolute', left: chip.x - R, top: chip.y - R,
              width: R * 2, height: R * 2, borderRadius: '50%', cursor: 'grab',
              background: isPrd ? 'linear-gradient(135deg,#68d391,#38a169)' : 'linear-gradient(135deg,#667eea,#764ba2)',
              border: `3px solid ${isPrd ? '#276749' : '#5a67d8'}`,
              boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
              transition: 'background 0.25s, border 0.25s',
            }}
          />
        );
      })}
    </div>
  );
}

/* ── LassoChipArea ───────────────────────────────────────── */
function LassoChipArea({ chips, R, W = 480, H = 270, pairedIds, onLassoDone }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pathRef = useRef(null);

  // Set canvas pixel size to match rendered size
  useEffect(() => {
    const resize = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      canvasRef.current.width = w;
      canvasRef.current.height = h;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getXY = (e, rect) => {
    const src = e.touches ? e.touches[0] : e;
    return [src.clientX - rect.left, src.clientY - rect.top];
  };

  const startDraw = e => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const [x, y] = getXY(e, rect);
    pathRef.current = [[x, y]];
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = 'rgba(49,130,206,0.85)';
    ctx.fillStyle = 'rgba(49,130,206,0.06)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  };

  const moveDraw = e => {
    if (!pathRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const [x, y] = getXY(e, rect);
    pathRef.current.push([x, y]);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = e => {
    if (!pathRef.current || pathRef.current.length < 4) { pathRef.current = null; return; }
    e.preventDefault();
    const path = pathRef.current;
    pathRef.current = null;

    // chip centers relative to canvas (same bounding box)
    const rect = canvasRef.current.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    const offX = cRect.left - rect.left;
    const offY = cRect.top - rect.top;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    // Scale path to canvas pixel space
    const scaledPath = path.map(([px, py]) => [px * scaleX, py * scaleY]);
    const scaledChips = chips.map(c => ({ ...c, cx: (c.x + offX) * scaleX, cy: (c.y + offY) * scaleY }));

    const inside = scaledChips.filter(c => !pairedIds.has(c.id) && pointInPoly(c.cx, c.cy, scaledPath));

    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    ctx.fillStyle = inside.length === 2 ? 'rgba(72,187,120,0.18)' : 'rgba(245,101,101,0.12)';
    ctx.fill();

    setTimeout(() => {
      if (canvasRef.current) {
        const c = canvasRef.current.getContext('2d');
        c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }, 500);

    if (inside.length === 2) onLassoDone(inside.map(c => c.id));
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: W, height: H, maxWidth: '100%', borderRadius: 14, background: '#fef9f0', border: '2px dashed #f6ad55', overflow: 'hidden' }}>
      {/* Chip layer */}
      {chips.map(chip => {
        const isPrd = pairedIds.has(chip.id);
        return (
          <div key={chip.id} style={{
            position: 'absolute', left: chip.x - R, top: chip.y - R,
            width: R * 2, height: R * 2, borderRadius: '50%',
            background: isPrd ? 'linear-gradient(135deg,#68d391,#38a169)' : 'linear-gradient(135deg,#ed8936,#dd6b20)',
            border: `3px solid ${isPrd ? '#276749' : '#c05621'}`,
            boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
            transition: 'background 0.3s, border 0.3s',
            pointerEvents: 'none',
          }} />
        );
      })}
      {/* Canvas lasso on top */}
      <canvas ref={canvasRef}
        onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 14, cursor: 'crosshair', touchAction: 'none' }}
      />
    </div>
  );
}

/* ── Botón pregunta ──────────────────────────────────────── */
const Btn = ({ active, onClick, label, color }) => (
  <button onClick={onClick} style={{
    padding: '10px 22px', borderRadius: 10, border: `2px solid ${color}`,
    background: active ? color : 'white', color: active ? 'white' : color,
    fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.15s',
  }}>{label}</button>
);

/* ── Resumen común ───────────────────────────────────────── */
function Resumen({ game, results, onReplay, onMenu }) {
  const rows = results.map((r, i) => {
    if (game === 'primos') {
      const sc1 = !isPrime(r.target) === (r.ansLinea === 'si');
      const sc2 = isPrime(r.target) === (r.ansPrimo === 'primo');
      return { key: i, n: r.target, cols: [
        { ok: sc1, label: sc1 ? '✅ Agrupable' : `❌ ${isPrime(r.target) ? 'Solo línea' : 'Sí rectangular'}` },
        { ok: sc2, label: sc2 ? `✅ ${isPrime(r.target) ? 'Primo' : 'Compuesto'}` : `❌ Es ${isPrime(r.target) ? 'primo' : 'compuesto'}` },
      ], score: (sc1 ? 1 : 0) + (sc2 ? 1 : 0), max: 2 };
    }
    if (game === 'cuadrado') {
      const ok = isPerfSq(r.target) === (r.ansCuad === 'si');
      return { key: i, n: r.target, cols: [
        { ok, label: ok ? `✅ ${isPerfSq(r.target) ? `${Math.round(Math.sqrt(r.target))}×${Math.round(Math.sqrt(r.target))}` : 'No es cuadrado'}` : `❌ ${isPerfSq(r.target) ? `Sí, ${Math.round(Math.sqrt(r.target))}²` : 'No es cuadrado'}` },
      ], score: ok ? 1 : 0, max: 1 };
    }
    // pares
    const ok = r.target % 2 === 0 ? r.ansPares === 'si' : r.ansPares === 'no';
    return { key: i, n: r.target, cols: [
      { ok, label: ok ? `✅ ${r.target % 2 === 0 ? 'Par → sí' : 'Impar → no'}` : `❌ Es ${r.target % 2 === 0 ? 'par, sí se puede' : 'impar, no se puede'}` },
    ], score: ok ? 1 : 0, max: 1 };
  });
  const total = rows.reduce((s, r) => s + r.score, 0);
  const maxPts = rows.reduce((s, r) => s + r.max, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2d3748', margin: 0 }}>📊 Resumen</h2>
      <div style={{ background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: 520, width: '100%' }}>
        {rows.map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontWeight: 900, fontSize: '1.6rem', color: '#4a5568', minWidth: 40 }}>{r.n}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.cols.map((c, j) => <div key={j} style={{ fontSize: '0.9rem', color: c.ok ? '#276749' : '#c53030' }}>{c.label}</div>)}
            </div>
            <span style={{ marginLeft: 'auto', fontWeight: 800, color: r.score === r.max ? '#38a169' : r.score === 0 ? '#e53e3e' : '#d69e2e' }}>{r.score}/{r.max}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, textAlign: 'center', fontWeight: 800, fontSize: '1.2rem' }}>
          Puntuación: <span style={{ fontSize: '1.8rem', color: total / maxPts >= 0.8 ? '#38a169' : total / maxPts >= 0.5 ? '#d69e2e' : '#e53e3e' }}>{total}</span> / {maxPts}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onReplay} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#3182ce', color: 'white', fontWeight: 800, cursor: 'pointer' }}>🔄 Repetir</button>
        <button onClick={onMenu} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#718096', color: 'white', fontWeight: 800, cursor: 'pointer' }}>🏠 Menú</button>
      </div>
    </div>
  );
}

/* ── JuegoPrimos ─────────────────────────────────────────── */
function JuegoPrimos({ onFinish }) {
  const [rounds] = useState(() => {
    const ps = shuffle(PRIMES).slice(0, 2);
    const cs = shuffle(COMPOSITES).slice(0, 2);
    const pool = shuffle([...PRIMES, ...COMPOSITES]).filter(n => !ps.includes(n) && !cs.includes(n));
    return shuffle([...ps, ...cs, pool[0]]);
  });

  const W = 480, H = 270, R = 18;
  const [round, setRound] = useState(0);
  const target = rounds[round];
  const [chips, setChips] = useState(() => initChips(target, W, H, R));
  const [ansLinea, setAnsLinea] = useState(null);
  const [ansPrimo, setAnsPrimo] = useState(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState([]);

  const pairs = divPairs(target);
  const nonLinear = pairs.filter(([a, b]) => a !== 1 && a !== b);
  const correctLinea = nonLinear.length > 0; // composite → can form rectangle

  const comprobar = () => {
    const r = { target, ansLinea, ansPrimo };
    const list = [...results, r];
    setResults(list);
    setChecked(true);
  };

  const siguiente = () => {
    if (round + 1 >= 5) { onFinish(results); return; }
    const nr = round + 1;
    setRound(nr);
    setChips(initChips(rounds[nr], W, H, R));
    setAnsLinea(null); setAnsPrimo(null); setChecked(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#718096', fontWeight: 700 }}>Ronda {round + 1} / 5</span>
        <div style={{ background: '#ebf8ff', border: '3px solid #3182ce', borderRadius: 14, padding: '10px 24px' }}>
          <span style={{ color: '#2c5282', fontWeight: 900, fontSize: '1.2rem' }}>{target} fichas</span>
        </div>
      </div>

      <p style={{ color: '#4a5568', maxWidth: 480, textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>
        Arrastra las fichas e intenta <strong>agruparlas en filas y columnas que no sean una sola línea</strong>.
      </p>

      <DraggableChipArea chips={chips} setChips={setChips} R={R} W={W} H={H} />

      <div style={{ background: 'white', borderRadius: 14, padding: '16px 22px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#2d3748' }}>¿Puedes agruparlas de forma NO lineal?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn active={ansLinea === 'si'} onClick={() => !checked && setAnsLinea('si')} label="Sí" color="#38a169" />
            <Btn active={ansLinea === 'no'} onClick={() => !checked && setAnsLinea('no')} label="No" color="#e53e3e" />
          </div>
          {checked && <span style={{ fontSize: '1.2rem' }}>{correctLinea === (ansLinea === 'si') ? '✅' : '❌'}</span>}
        </div>

        {checked && (
          <div style={{ background: '#ebf8ff', borderRadius: 10, padding: '10px 14px', fontSize: '0.88rem', color: '#2c5282' }}>
            <strong>Todas las agrupaciones de {target}:</strong> {pairs.map(([a, b]) => `${a}×${b}`).join(', ')}
            {nonLinear.length > 0
              ? <div style={{ color: '#276749', marginTop: 4 }}>Rectangulares (no línea): {nonLinear.map(([a, b]) => `${a}×${b}`).join(', ')}</div>
              : <div style={{ color: '#c53030', marginTop: 4 }}>Solo en línea (1×{target} o {target}×1) → ¡Es primo!</div>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#2d3748' }}>¿Es primo o compuesto?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn active={ansPrimo === 'primo'} onClick={() => !checked && setAnsPrimo('primo')} label="Primo" color="#805ad5" />
            <Btn active={ansPrimo === 'compuesto'} onClick={() => !checked && setAnsPrimo('compuesto')} label="Compuesto" color="#d69e2e" />
          </div>
          {checked && <span style={{ fontSize: '1.2rem' }}>{isPrime(target) === (ansPrimo === 'primo') ? '✅' : `❌ Es ${isPrime(target) ? 'primo' : 'compuesto'}`}</span>}
        </div>
      </div>

      {!checked
        ? <button disabled={!ansLinea || !ansPrimo} onClick={comprobar} style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: (!ansLinea || !ansPrimo) ? '#e2e8f0' : '#3182ce', color: (!ansLinea || !ansPrimo) ? '#a0aec0' : 'white', fontWeight: 800, fontSize: '1.05rem', cursor: (!ansLinea || !ansPrimo) ? 'default' : 'pointer' }}>✔ Comprobar</button>
        : <button onClick={siguiente} style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: '#3182ce', color: 'white', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer' }}>{round < 4 ? '▶ Siguiente ronda' : '📊 Ver resumen'}</button>
      }
    </div>
  );
}

/* ── JuegoCuadrado ───────────────────────────────────────── */
function JuegoCuadrado({ onFinish }) {
  const [rounds] = useState(() => {
    const sq = shuffle(SQUARES).slice(0, 2);
    const nsq = shuffle(NON_SQ).slice(0, 2);
    const pool = shuffle([...SQUARES, ...NON_SQ]).filter(n => !sq.includes(n) && !nsq.includes(n));
    return shuffle([...sq, ...nsq, pool[0]]);
  });

  const W = 480, H = 280;
  const getR = n => n <= 16 ? 20 : n <= 25 ? 17 : n <= 36 ? 15 : 12;
  const [round, setRound] = useState(0);
  const target = rounds[round];
  const R = getR(target);
  const [chips, setChips] = useState(() => initChips(target, W, H, R));
  const [ansCuad, setAnsCuad] = useState(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState([]);

  const comprobar = () => {
    setResults(prev => [...prev, { target, ansCuad }]);
    setChecked(true);
  };

  const siguiente = () => {
    if (round + 1 >= 5) { onFinish([...results, { target, ansCuad }]); return; }
    const nr = round + 1;
    setRound(nr);
    const t = rounds[nr];
    setChips(initChips(t, W, H, getR(t)));
    setAnsCuad(null); setChecked(false);
  };

  const correct = isPerfSq(target);
  const lado = Math.round(Math.sqrt(target));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#718096', fontWeight: 700 }}>Ronda {round + 1} / 5</span>
        <div style={{ background: '#fef3c7', border: '3px solid #d69e2e', borderRadius: 14, padding: '10px 24px' }}>
          <span style={{ color: '#92400e', fontWeight: 900, fontSize: '1.2rem' }}>{target} fichas</span>
        </div>
      </div>

      <p style={{ color: '#4a5568', maxWidth: 480, textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>
        Arrastra las fichas e intenta <strong>formar un cuadrado</strong> con todas ellas. ¿Se puede?
      </p>

      <DraggableChipArea chips={chips} setChips={setChips} R={R} W={W} H={H} />

      {checked && (
        <div style={{ background: correct ? '#f0fff4' : '#fff5f5', border: `2px solid ${correct ? '#68d391' : '#f56565'}`, borderRadius: 10, padding: '10px 18px', fontSize: '0.9rem', color: correct ? '#22543d' : '#742a2a', maxWidth: 480, width: '100%', textAlign: 'center' }}>
          {correct
            ? `✓ Sí. ${target} = ${lado} × ${lado}. Es un cuadrado perfecto (${lado}²).`
            : `✗ No. √${target} ≈ ${Math.sqrt(target).toFixed(2)}, no es entero. No es cuadrado perfecto.`}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 14, padding: '14px 22px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', maxWidth: 480, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#2d3748' }}>¿Puedes formar un cuadrado perfecto?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn active={ansCuad === 'si'} onClick={() => !checked && setAnsCuad('si')} label="Sí" color="#38a169" />
            <Btn active={ansCuad === 'no'} onClick={() => !checked && setAnsCuad('no')} label="No" color="#e53e3e" />
          </div>
          {checked && <span style={{ fontSize: '1.2rem' }}>{correct === (ansCuad === 'si') ? '✅' : '❌'}</span>}
        </div>
      </div>

      {!checked
        ? <button disabled={!ansCuad} onClick={comprobar} style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: !ansCuad ? '#e2e8f0' : '#d69e2e', color: !ansCuad ? '#a0aec0' : 'white', fontWeight: 800, fontSize: '1.05rem', cursor: !ansCuad ? 'default' : 'pointer' }}>✔ Comprobar</button>
        : <button onClick={siguiente} style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: '#d69e2e', color: 'white', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer' }}>{round < 4 ? '▶ Siguiente ronda' : '📊 Ver resumen'}</button>
      }
    </div>
  );
}

/* ── JuegoPares ──────────────────────────────────────────── */
function JuegoPares({ onFinish }) {
  const [rounds] = useState(() => {
    const ev = shuffle(EVENS).slice(0, 3);
    const od = shuffle(ODDS).slice(0, 2);
    return shuffle([...ev, ...od]);
  });

  const W = 480, H = 270, R = 17;
  const [round, setRound] = useState(0);
  const target = rounds[round];
  const [chips, setChips] = useState(() => initChips(target, W, H, R));
  const [pairedIds, setPairedIds] = useState(new Set());
  const [ansPares, setAnsPares] = useState(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState([]);

  const onLasso = ids => {
    setPairedIds(prev => new Set([...prev, ...ids]));
  };

  const comprobar = () => {
    setResults(prev => [...prev, { target, ansPares }]);
    setChecked(true);
  };

  const siguiente = () => {
    if (round + 1 >= 5) { onFinish([...results, { target, ansPares }]); return; }
    const nr = round + 1;
    setRound(nr);
    setChips(initChips(rounds[nr], W, H, R));
    setPairedIds(new Set()); setAnsPares(null); setChecked(false);
  };

  const correctPares = target % 2 === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#718096', fontWeight: 700 }}>Ronda {round + 1} / 5</span>
        <div style={{ background: '#faf5ff', border: '3px solid #805ad5', borderRadius: 14, padding: '10px 24px' }}>
          <span style={{ color: '#553c9a', fontWeight: 900, fontSize: '1.2rem' }}>{target} fichas</span>
        </div>
      </div>

      <p style={{ color: '#4a5568', maxWidth: 480, textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>
        <strong>Rodea con el dedo pares de fichas</strong> para agruparlas de 2 en 2. ¿Puedes hacer parejas con todas?
      </p>

      <LassoChipArea chips={chips} R={R} W={W} H={H} pairedIds={pairedIds} onLassoDone={onLasso} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem', color: '#718096' }}>
        <span>Emparejadas: <strong style={{ color: '#553c9a' }}>{pairedIds.size}</strong> / {target}</span>
        {pairedIds.size > 0 && !checked && (
          <button onClick={() => setPairedIds(new Set())} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Reiniciar</button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 14, padding: '14px 22px', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', maxWidth: 480, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#2d3748' }}>¿Puedes hacer parejas con todas?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn active={ansPares === 'si'} onClick={() => !checked && setAnsPares('si')} label="Sí" color="#38a169" />
            <Btn active={ansPares === 'no'} onClick={() => !checked && setAnsPares('no')} label="No" color="#e53e3e" />
          </div>
          {checked && <span style={{ fontSize: '1.2rem' }}>{correctPares === (ansPares === 'si') ? '✅' : `❌ ${correctPares ? 'Sí se puede (es par)' : 'No se puede (es impar)'}`}</span>}
        </div>
      </div>

      {!checked
        ? <button disabled={!ansPares} onClick={comprobar} style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: !ansPares ? '#e2e8f0' : '#805ad5', color: !ansPares ? '#a0aec0' : 'white', fontWeight: 800, fontSize: '1.05rem', cursor: !ansPares ? 'default' : 'pointer' }}>✔ Comprobar</button>
        : <button onClick={siguiente} style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: '#805ad5', color: 'white', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer' }}>{round < 4 ? '▶ Siguiente ronda' : '📊 Ver resumen'}</button>
      }
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function DescubreMates({ onBack }) {
  const [view, setView] = useState('menu');
  const [game, setGame] = useState(null);
  const [results, setResults] = useState([]);

  const finish = (g, r) => { setGame(g); setResults(r); setView('resumen'); };

  const hdr = (title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 520, marginBottom: 4 }}>
      <button onClick={() => setView('menu')} style={{ background: '#4a5568', color: 'white', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>⬅ Volver</button>
      <h2 style={{ margin: 0, color: '#2d3748', fontSize: '1.2rem' }}>{title}</h2>
    </div>
  );

  if (view === 'primos') return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>{hdr('⚛️ Fichas y Primos')}<JuegoPrimos onFinish={r => finish('primos', r)} /></div>;
  if (view === 'cuadrado') return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>{hdr('🔲 Fichas y Cuadrados')}<JuegoCuadrado onFinish={r => finish('cuadrado', r)} /></div>;
  if (view === 'pares') return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>{hdr('🫧 Fichas y Pares')}<JuegoPares onFinish={r => finish('pares', r)} /></div>;

  if (view === 'resumen') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
      <Resumen game={game} results={results} onReplay={() => setView(game)} onMenu={() => setView('menu')} />
    </div>
  );

  // sub-menu
  const card = (emoji, title, sub, color, v) => (
    <button onClick={() => setView(v)}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      style={{ padding: '28px 16px', borderRadius: 18, border: 'none', background: color, color: 'white', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', boxShadow: `0 6px 18px ${color}99`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'transform 0.15s' }}>
      <span style={{ fontSize: '2.8rem' }}>{emoji}</span>
      <span>{title}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 400, opacity: 0.9 }}>{sub}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: '#4a5568', color: 'white', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', marginBottom: 22 }}>⬅ Volver al Menú</button>
      <h2 style={{ color: '#2d3748', marginBottom: 6, textAlign: 'center' }}>🔍 Descubre Primos, Cuadrados y Pares</h2>
      <p style={{ color: '#718096', marginBottom: 28, textAlign: 'center', fontSize: '0.95rem' }}>Elige un tema. 5 rondas con fichas arrastrables.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 22, maxWidth: 560, width: '100%' }}>
        {card('⚛️', 'Primos', '¿Primo o compuesto?', '#3182ce', 'primos')}
        {card('🔲', 'Cuadrados', '¿Cuadrado perfecto?', '#d69e2e', 'cuadrado')}
        {card('🫧', 'Pares', '¿Par o impar?', '#805ad5', 'pares')}
      </div>
    </div>
  );
}
