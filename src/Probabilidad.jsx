import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import applauseAudio from './assets/applause-small-audience-97257.mp3';

// ─── Audio ────────────────────────────────────────────────────────────────────

function playApplause() {
  try { new Audio(applauseAudio).play(); } catch (_) {}
}

// ─── Audio: hoof clop ─────────────────────────────────────────────────────────

function playHoofSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // 4 quick percussive clops
    [0, 0.13, 0.25, 0.38].forEach((t) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + t + 0.09);
      gain.gain.setValueAtTime(0.45, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.09);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.11);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (_) {}
}

// ─── Audio: fanfare (game show ascending jingle) ──────────────────────────────

function playFanfare() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // C4→E4→G4 then C5+E5+G5 chord
    const notes = [
      [0,    262, 0.18],
      [0.20, 330, 0.18],
      [0.40, 392, 0.18],
      [0.60, 523, 0.55],
      [0.60, 659, 0.55],
      [0.60, 784, 0.55],
    ];
    notes.forEach(([t, freq, dur]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.28, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.05);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

// ─── Audio: wrong answer (sad trombone) ───────────────────────────────────────

function playWrong() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Descending Bb3→A3→Ab3→G3
    const notes = [
      [0,    233, 0.22],
      [0.26, 220, 0.22],
      [0.52, 208, 0.22],
      [0.78, 196, 0.55],
    ];
    notes.forEach(([t, freq, dur]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.05);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch (_) {}
}

// ─── Race helpers ─────────────────────────────────────────────────────────────

function calcResult(d1, d2, op) {
  if (op === 'suma')  return d1 + d2;
  if (op === 'resta') return Math.abs(d1 - d2);
  if (op === 'multi') return d1 * d2;
  return d1 + d2;
}

function getRows(op) {
  if (op === 'suma')  return Array.from({ length: 12 }, (_, i) => i + 1);
  if (op === 'resta') return Array.from({ length: 6 },  (_, i) => i);
  if (op === 'multi') {
    const s = new Set();
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) s.add(i * j);
    return [...s].sort((a, b) => a - b);
  }
  return [];
}

function countCombos(res, op) {
  let n = 0;
  for (let i = 1; i <= 6; i++)
    for (let j = 1; j <= 6; j++)
      if (calcResult(i, j, op) === res) n++;
  return n;
}

// ─── Simulator helpers ────────────────────────────────────────────────────────

function applyOp(vals, op) {
  if (vals.length === 1) return vals[0];
  if (op === 'suma')  return vals.reduce((a, b) => a + b, 0);
  if (op === 'resta') return vals.reduce((a, b) => a - b);
  if (op === 'multi') return vals.reduce((a, b) => a * b, 1);
  if (op === 'div') {
    let r = vals[0];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] === 0) return null;
      r /= vals[i];
    }
    return Number.isInteger(r) ? r : +r.toFixed(2);
  }
  return vals[0];
}

function fmtMs(ms) {
  if (ms === null) return '';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(3)} s`;
}

function opSym(op) {
  return { suma: '+', resta: '−', multi: '×', div: '÷' }[op] ?? '+';
}

// ─── Shared style ─────────────────────────────────────────────────────────────

const inputSt = {
  padding: '10px 14px', fontSize: 15, borderRadius: 8,
  border: '2px solid #cbd5e1', outline: 'none',
  backgroundColor: '#f8fafc', width: '100%', boxSizing: 'border-box',
};

const DICE_OPTIONS = [
  { value: 4,   label: 'D4 — Tetraedro' },
  { value: 6,   label: 'D6 — Cubo' },
  { value: 8,   label: 'D8 — Octaedro' },
  { value: 10,  label: 'D10 — Trapezoedro' },
  { value: 12,  label: 'D12 — Dodecaedro' },
  { value: 20,  label: 'D20 — Icosaedro' },
  { value: 100, label: 'D100 — Porcentajes' },
];

const SIM_OPS = [
  { value: 'suma',  label: '+ Suma' },
  { value: 'resta', label: '− Resta' },
  { value: 'multi', label: '× Multiplicación' },
  { value: 'div',   label: '÷ División' },
];

const RACE_OPS = [
  { value: 'suma',  label: 'Suma (2–12)' },
  { value: 'resta', label: 'Resta |D1−D2| (0–5)' },
  { value: 'multi', label: 'Multiplicación (1–36)' },
];

const RACE_OP_SYMBOLS = { suma: '+', resta: '|−|', multi: '×' };
const RACE_OP_LABELS  = { suma: 'Suma', resta: '|Resta|', multi: 'Producto' };

// ─── SimuladorDados ───────────────────────────────────────────────────────────

function SimuladorDados({ onBack }) {
  const [caras, setCaras]           = useState(6);
  const [numDados, setNumDados]     = useState(1);
  const [numTiradas, setNumTiradas] = useState(10);
  const [operacion, setOperacion]   = useState('suma');
  const [resultados, setResultados]         = useState([]);
  const [resumenDirecto, setResumenDirecto] = useState(null);
  const [lanzando, setLanzando]   = useState(false);
  const [elapsed, setElapsed]     = useState(null);
  const [liveMs, setLiveMs]       = useState(null);
  const startRef   = useRef(null);
  const timerRef   = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(pendingRef.current);
  }, []);

  const handleLanzar = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(pendingRef.current);
    setLanzando(true);
    setResultados([]);
    setResumenDirecto(null);
    setElapsed(null);
    setLiveMs(0);
    startRef.current = performance.now();
    timerRef.current = setInterval(() => {
      setLiveMs(performance.now() - startRef.current);
    }, 50);
    const delay = numTiradas <= 2000 ? 600 : 80;
    pendingRef.current = setTimeout(() => {
      const modoCompleto = numTiradas <= 100;
      if (modoCompleto) {
        const nuevos = [];
        for (let i = 0; i < numTiradas; i++) {
          const dados = [];
          for (let j = 0; j < numDados; j++) dados.push(Math.floor(Math.random() * caras) + 1);
          const resultado = numDados > 1 ? applyOp(dados, operacion) : dados[0];
          nuevos.push({ dados, resultado: resultado ?? '∞' });
        }
        setResultados(nuevos);
        setResumenDirecto(null);
      } else {
        const conteo = {};
        let sumTotal = 0;
        for (let i = 0; i < numTiradas; i++) {
          let resultado;
          if (numDados === 1) {
            resultado = Math.floor(Math.random() * caras) + 1;
            sumTotal += resultado;
          } else {
            const dados = [];
            for (let j = 0; j < numDados; j++) dados.push(Math.floor(Math.random() * caras) + 1);
            const r = applyOp(dados, operacion);
            resultado = r ?? '∞';
            if (typeof resultado === 'number') sumTotal += resultado;
          }
          const key = String(resultado);
          conteo[key] = (conteo[key] || 0) + 1;
        }
        setResultados([]);
        setResumenDirecto({ conteo, total: numTiradas, sumTotal });
      }
      clearInterval(timerRef.current);
      const fin = performance.now() - startRef.current;
      setElapsed(fin);
      setLiveMs(fin);
      setLanzando(false);
    }, delay);
  }, [caras, numDados, numTiradas, operacion]);

  const resumen = useMemo(() => {
    let conteo, total, sumTotal;
    if (resumenDirecto) {
      ({ conteo, total, sumTotal } = resumenDirecto);
    } else if (resultados.length > 0) {
      conteo = {};
      sumTotal = 0;
      resultados.forEach(({ resultado }) => {
        const key = String(resultado);
        conteo[key] = (conteo[key] || 0) + 1;
        if (typeof resultado === 'number') sumTotal += resultado;
      });
      total = resultados.length;
    } else {
      return null;
    }
    const ordenadas = Object.entries(conteo).sort((a, b) => {
      const na = Number(a[0]), nb = Number(b[0]);
      return (!isNaN(na) && !isNaN(nb)) ? na - nb : a[0].localeCompare(b[0]);
    });
    const masFrec = ordenadas.reduce((best, cur) => cur[1] > best[1] ? cur : best, ordenadas[0]);
    const maxCnt  = Math.max(...ordenadas.map(([, c]) => c));
    return { conteo, ordenadas, masFrec, maxCnt, total, sumTotal };
  }, [resultados, resumenDirecto]);

  const modoResumen = numTiradas > 100;

  return (
    <div style={{ fontFamily: 'Segoe UI, Roboto, sans-serif', padding: 24, maxWidth: 900, margin: '0 auto', backgroundColor: '#f8fafc', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', color: '#1e293b' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', marginBottom: 12, fontWeight: 700, fontSize: '0.9rem', padding: '4px 0' }}>
        ← Volver al menú
      </button>
      <h1 style={{ textAlign: 'center', fontSize: 28, fontWeight: 'bold', margin: '0 0 24px 0' }}>🎲 Simulador de Dados</h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', backgroundColor: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 140px', minWidth: 130 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Tipo de dado</label>
          <select value={caras} onChange={e => setCaras(Number(e.target.value))} disabled={lanzando} style={inputSt}>
            {DICE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 110px', minWidth: 110 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Nº de dados</label>
          <select value={numDados} onChange={e => setNumDados(Number(e.target.value))} disabled={lanzando} style={inputSt}>
            <option value={1}>1 dado</option>
            <option value={2}>2 dados</option>
            <option value={3}>3 dados</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 130px', minWidth: 120 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
            Nº tiradas <span style={{ fontWeight: 400, color: '#94a3b8' }}>(máx 1M)</span>
          </label>
          <input type="number" min="1" max="1000000" value={numTiradas}
            onChange={e => setNumTiradas(Math.max(1, Math.min(1000000, Number(e.target.value))))}
            disabled={lanzando} style={inputSt} />
        </div>
        {numDados > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 160px', minWidth: 150 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Operación</label>
            <select value={operacion} onChange={e => setOperacion(e.target.value)} disabled={lanzando} style={inputSt}>
              {SIM_OPS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>
        )}
        <button onClick={handleLanzar} disabled={lanzando}
          style={{ padding: '12px 28px', fontSize: 16, fontWeight: 'bold', color: '#fff', backgroundColor: lanzando ? '#94a3b8' : '#2563eb', border: 'none', borderRadius: 8, cursor: lanzando ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px rgba(37,99,235,0.2)', flexShrink: 0, alignSelf: 'flex-end' }}>
          {lanzando ? '⏳ Lanzando...' : '🎲 Lanzar'}
        </button>
      </div>

      {(lanzando || elapsed !== null) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, backgroundColor: lanzando ? '#fefce8' : '#f0fdf4', border: `1px solid ${lanzando ? '#fcd34d' : '#86efac'}`, borderRadius: 10, padding: '10px 20px', fontSize: 16, fontWeight: 700, color: lanzando ? '#92400e' : '#166534' }}>
          <span style={{ fontSize: 20 }}>{lanzando ? '⏱' : '✅'}</span>
          {lanzando
            ? <>Calculando… <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>{fmtMs(liveMs)}</span></>
            : <>Completado en <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMs(elapsed)}</span> · {numTiradas.toLocaleString('es-ES')} tiradas</>
          }
        </div>
      )}

      {!lanzando && numTiradas > 100 && !elapsed && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 14, color: '#92400e' }}>
          ℹ️ Con más de 100 tiradas solo se muestra el resumen de resultados.
        </div>
      )}

      {lanzando && (
        <div style={{ textAlign: 'center', fontSize: 20, color: '#64748b', margin: '40px 0' }}>
          🎲 Agitando {numTiradas.toLocaleString('es-ES')} {numTiradas === 1 ? 'dado' : 'dados'}…
        </div>
      )}

      {!lanzando && (resultados.length > 0 || resumenDirecto) && (
        <>
          {!modoResumen && resultados.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 12 }}>
                Resultados — {numTiradas} tirada{numTiradas !== 1 ? 's' : ''}
                {numDados > 1 && ` (${SIM_OPS.find(o => o.value === operacion)?.label})`}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10 }}>
                {resultados.map(({ dados, resultado }, idx) => (
                  <div key={idx} style={{ backgroundColor: '#fff', border: '2px solid #334155', borderRadius: 10, padding: '8px 6px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                    {numDados > 1 && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
                        {dados.join(` ${opSym(operacion)} `)}
                      </div>
                    )}
                    <div style={{ fontSize: numDados > 1 ? 20 : 24, fontWeight: 'bold', color: '#1e293b' }}>{resultado}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resumen && (
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', color: '#1e40af', fontSize: 18 }}>
                📊 {modoResumen ? `Resumen de ${resumen.total.toLocaleString('es-ES')} tiradas` : 'Frecuencia de resultados'}
              </h3>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 18, fontSize: 14 }}>
                <span><strong>Más frecuente:</strong> {resumen.masFrec[0]} ({resumen.masFrec[1].toLocaleString('es-ES')} veces)</span>
                {numDados === 1 && <span><strong>Suma total:</strong> {resumen.sumTotal.toLocaleString('es-ES')}</span>}
                {numDados === 1 && <span><strong>Media:</strong> {(resumen.sumTotal / resumen.total).toFixed(4)}</span>}
                <span><strong>Valores distintos:</strong> {resumen.ordenadas.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {resumen.ordenadas.map(([val, cnt]) => {
                  const pct = (cnt / resumen.total) * 100;
                  const barPct = (cnt / resumen.maxCnt) * 100;
                  return (
                    <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ minWidth: 46, textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1e40af' }}>{val}</span>
                      <div style={{ flex: 1, height: 20, backgroundColor: '#dbeafe', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: 5 }} />
                      </div>
                      <span style={{ minWidth: 110, fontSize: 12, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                        {cnt.toLocaleString('es-ES')} ({pct.toFixed(2)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── CarreraCamellos ──────────────────────────────────────────────────────────

function CarreraCamellos({ onBack }) {
  const [op, setOp]               = useState('suma');
  const [tokens, setTokens]       = useState([]);
  const [dice, setDice]           = useState([1, 1]);
  const [rolling, setRolling]     = useState(false);
  const [showResult, setShowResult] = useState(false); // overlay visible 1 s tras la tirada
  const [pendingRes, setPendingRes] = useState(null);  // resultado a aplicar tras el 1 s
  const [winners, setWinners]     = useState([]);
  const [litRow, setLitRow]       = useState(null);

  const [fNombre, setFNombre] = useState('');
  const [fColor,  setFColor]  = useState('#ef4444');
  const [fFila,   setFFila]   = useState(2);

  const litRef      = useRef(null);
  const rollRef     = useRef(null);
  const resultRef   = useRef(null);

  const rows = useMemo(() => getRows(op), [op]);

  useEffect(() => () => {
    clearTimeout(litRef.current);
    clearInterval(rollRef.current);
    clearTimeout(resultRef.current);
  }, []);

  const handleOpChange = (newOp) => {
    clearTimeout(litRef.current);
    clearInterval(rollRef.current);
    clearTimeout(resultRef.current);
    setOp(newOp);
    setTokens([]);
    setDice([1, 1]);
    setWinners([]);
    setLitRow(null);
    setRolling(false);
    setShowResult(false);
    setPendingRes(null);
    setFFila(getRows(newOp)[0]);
  };

  const handleAddToken = (e) => {
    e.preventDefault();
    if (!fNombre.trim() || winners.length > 0) return;
    setTokens(prev => [...prev, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      nombre: fNombre.trim().substring(0, 3).toUpperCase(),
      color: fColor,
      fila: Number(fFila),
      pos: 0,
    }]);
    setFNombre('');
  };

  const handleRoll = () => {
    if (rolling || showResult || winners.length > 0) return;
    setRolling(true);
    clearTimeout(litRef.current);
    setLitRow(null);

    let iter = 0;
    rollRef.current = setInterval(() => {
      setDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      iter++;
      if (iter >= 12) {
        clearInterval(rollRef.current);
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const result = calcResult(d1, d2, op);
        setDice([d1, d2]);
        setPendingRes(result);
        setRolling(false);
        setShowResult(true);

        // Tras 1 segundo: ocultar overlay y mover camellos
        resultRef.current = setTimeout(() => {
          setShowResult(false);
          setPendingRes(null);
          setLitRow(result);

          setTokens((prev) => {
            const moved = [];
            const updated = prev.map((t) => {
              if (t.fila === result && t.pos < 5) { moved.push(t.id); return { ...t, pos: t.pos + 1 }; }
              return t;
            });
            if (moved.length > 0) playHoofSound();
            const newWinners = updated.filter(t => t.pos === 5);
            if (newWinners.length > 0) { setWinners(newWinners); playApplause(); }
            return updated;
          });

          litRef.current = setTimeout(() => setLitRow(null), 2500);
        }, 1000);
      }
    }, 60);
  };

  const handleReset = () => {
    clearInterval(rollRef.current);
    clearTimeout(litRef.current);
    clearTimeout(resultRef.current);
    setTokens([]);
    setDice([1, 1]);
    setWinners([]);
    setRolling(false);
    setShowResult(false);
    setPendingRes(null);
    setLitRow(null);
  };

  const overlayResult = calcResult(dice[0], dice[1], op);
  const isDisabled    = rolling || showResult || winners.length > 0;

  return (
    <div style={{ fontFamily: 'Segoe UI, Roboto, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto', background: '#f8fafc', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', color: '#1e293b' }}>

      <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', marginBottom: 12, fontWeight: 700, fontSize: '0.9rem', padding: '4px 0' }}>
        ← Volver al menú
      </button>
      <h1 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, margin: '0 0 20px 0' }}>🐪 Carrera de Camellos</h1>

      {/* Panel: config + formulario (sin controles de dados) */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Operación */}
        <div style={{ flex: '1 1 240px', background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px', fontWeight: 700, color: '#334155', fontSize: 14, borderBottom: '2px solid #f1f5f9', paddingBottom: 8 }}>⚙️ Operación</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RACE_OPS.map(o => (
              <button key={o.value} onClick={() => handleOpChange(o.value)}
                style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: '2px solid', cursor: 'pointer',
                  borderColor: op === o.value ? '#2563eb' : '#cbd5e1',
                  background: op === o.value ? '#eff6ff' : '#f8fafc',
                  color: op === o.value ? '#1d4ed8' : '#64748b' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Añadir camello */}
        <div style={{ flex: '2 1 400px', background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px', fontWeight: 700, color: '#334155', fontSize: 14, borderBottom: '2px solid #f1f5f9', paddingBottom: 8 }}>🐪 Añadir Camello</h3>
          <form onSubmit={handleAddToken} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 110px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nombre (máx. 3)</label>
              <input type="text" maxLength={3} placeholder="ANA" value={fNombre}
                onChange={e => setFNombre(e.target.value)} disabled={winners.length > 0} style={inputSt} />
            </div>
            <div style={{ flex: '0 0 54px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Color</label>
              <input type="color" value={fColor} onChange={e => setFColor(e.target.value)}
                disabled={winners.length > 0}
                style={{ ...inputSt, height: 42, padding: 3, cursor: 'pointer', width: 54 }} />
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Fila</label>
              <select value={fFila} onChange={e => setFFila(Number(e.target.value))}
                disabled={winners.length > 0} style={inputSt}>
                {rows.map(r => <option key={r} value={r}>Fila {r}</option>)}
              </select>
            </div>
            <button type="submit" disabled={winners.length > 0 || !fNombre.trim()}
              style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 8,
                background: !fNombre.trim() || winners.length > 0 ? '#94a3b8' : '#10b981',
                cursor: !fNombre.trim() || winners.length > 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              ➕ Añadir
            </button>
            <button type="button" onClick={handleReset}
              style={{ flex: '0 0 auto', padding: '10px 16px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#ef4444', border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔄 Reiniciar
            </button>
          </form>
        </div>
      </div>

      {/* TABLERO — position:relative para los overlays */}
      <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', overflowX: 'auto' }}>

        {/* Botón de tirar (icono flotante en el tablero) */}
        <button
          onClick={handleRoll}
          disabled={isDisabled}
          title="Tirar dados"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 5,
            width: 58, height: 58, fontSize: 30,
            background: isDisabled ? '#94a3b8' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: 14,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isDisabled ? 'none' : '0 4px 14px rgba(37,99,235,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          🎲
        </button>

        {/* Cabecera de columnas */}
        <div style={{ display: 'flex', marginBottom: 6, minWidth: 600, paddingRight: 74 }}>
          <div style={{ width: 86, flexShrink: 0 }} />
          {['Salida', '1', '2', '3', '4', '🏁 META'].map((lbl, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', minWidth: 68 }}>
              {lbl}
            </div>
          ))}
        </div>

        {/* Filas */}
        <div style={{ minWidth: 600, paddingRight: 74 }}>
          {rows.map((rowNum) => {
            const isLit = litRow === rowNum;
            return (
              <div key={rowNum} style={{
                display: 'flex', alignItems: 'stretch', minHeight: 62,
                borderRadius: 10, marginBottom: 5, overflow: 'hidden',
                border: isLit ? '2px solid #eab308' : '1px solid #e2e8f0',
                boxShadow: isLit ? '0 0 18px rgba(234,179,8,0.55)' : '0 1px 2px rgba(0,0,0,0.04)',
                background: isLit ? '#fefce8' : '#fff',
                transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s',
              }}>
                <div style={{
                  width: 86, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLit ? '#fde047' : '#f8fafc',
                  borderRight: `2px solid ${isLit ? '#fbbf24' : '#e2e8f0'}`,
                  transition: 'background 0.3s',
                }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: isLit ? '#854d0e' : '#334155' }}>{rowNum}</span>
                </div>

                {[0, 1, 2, 3, 4, 5].map((posIdx) => {
                  const cellTokens = tokens.filter(t => t.fila === rowNum && t.pos === posIdx);
                  const isMeta  = posIdx === 5;
                  const isStart = posIdx === 0;
                  return (
                    <div key={posIdx} style={{
                      flex: 1, minWidth: 68,
                      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
                      padding: '3px 2px', gap: 3,
                      background: isMeta ? '#f0fdf4' : isStart ? '#f9fafb' : 'transparent',
                      borderRight: isMeta ? 'none' : '1px dashed #e2e8f0',
                      borderLeft: isMeta ? '3px solid #22c55e' : 'none',
                      position: 'relative',
                    }}>
                      {!isStart && !isMeta && (
                        <span style={{ position: 'absolute', fontSize: 17, fontWeight: 700, color: isLit ? '#fef9c3' : '#f1f5f9', pointerEvents: 'none', userSelect: 'none' }}>
                          {posIdx}
                        </span>
                      )}
                      {cellTokens.map(tok => (
                        <div key={tok.id} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '3px 6px', borderRadius: 10,
                          border: `2px solid ${tok.color}`,
                          background: `${tok.color}25`,
                          zIndex: 2,
                        }}>
                          <span style={{ fontSize: 20, lineHeight: 1, filter: `drop-shadow(0 1px 2px ${tok.color})` }}>🐪</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: tok.color, letterSpacing: '-0.3px', marginTop: 1 }}>{tok.nombre}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── OVERLAY: tirada de dados ── */}
        {(rolling || showResult) && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10, borderRadius: 16,
            background: 'rgba(2, 6, 23, 0.68)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#fff', borderRadius: 24, padding: '28px 44px',
              textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
              minWidth: 300,
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', marginBottom: showResult ? 18 : 0 }}>
                {/* Dado 1 */}
                <div style={{ width: 80, height: 80, border: '3px solid #1e293b', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.14)' }}>
                  {dice[0]}
                </div>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#64748b' }}>{RACE_OP_SYMBOLS[op]}</span>
                {/* Dado 2 */}
                <div style={{ width: 80, height: 80, border: '3px solid #1e293b', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.14)' }}>
                  {dice[1]}
                </div>
                <span style={{ fontSize: 26, color: '#94a3b8', fontWeight: 700 }}>=</span>
                {/* Resultado */}
                <div style={{ fontSize: 72, fontWeight: 900, color: '#1d4ed8', minWidth: 72, textAlign: 'center', lineHeight: 1 }}>
                  {overlayResult}
                </div>
              </div>
              {showResult && (
                <p style={{ margin: 0, fontSize: 16, color: '#475569', fontWeight: 600 }}>
                  {tokens.some(t => t.fila === pendingRes && t.pos < 5)
                    ? `🐪 ¡Fila ${pendingRes} avanza!`
                    : `Nadie en la fila ${pendingRes}`}
                </p>
              )}
              {rolling && (
                <p style={{ margin: 0, fontSize: 15, color: '#94a3b8' }}>🎰 Lanzando…</p>
              )}
            </div>
          </div>
        )}

        {/* ── OVERLAY: ganador ── */}
        {winners.length > 0 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20, borderRadius: 16,
            background: 'rgba(0, 0, 0, 0.62)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#fef08a', border: '5px solid #eab308', borderRadius: 24,
              padding: '36px 48px', textAlign: 'center',
              boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
              maxWidth: '80%',
            }}>
              <div style={{ fontSize: 60, marginBottom: 10 }}>🏆</div>
              <h2 style={{ fontSize: 36, fontWeight: 900, color: '#854d0e', margin: '0 0 18px' }}>¡GANADOR!</h2>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                {winners.map(w => (
                  <span key={w.id} style={{ color: '#fff', padding: '10px 24px', borderRadius: 999, fontWeight: 700, fontSize: 20, backgroundColor: w.color, textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                    🐪 {w.nombre} — Fila {w.fila}
                  </span>
                ))}
              </div>
              <button onClick={handleReset}
                style={{ padding: '14px 32px', fontSize: 17, fontWeight: 800, color: '#fff', background: '#ef4444', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                🔄 Jugar de nuevo
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── TresPuertas (Monty Hall) ─────────────────────────────────────────────────

function TresPuertas({ onBack }) {
  const [showPhase, setShowPhase] = useState('INTRO'); // 'INTRO' | 'OPENING' | 'PLAYING'
  const [curtainOpen, setCurtainOpen] = useState(false);
  const curtainRef = useRef(null);
  const playRef    = useRef(null);

  const [carPosition,    setCarPosition]    = useState(() => Math.floor(Math.random() * 3) + 1);
  const [selectedDoor,   setSelectedDoor]   = useState(null);
  const [revealedDoor,   setRevealedDoor]   = useState(null);
  const [gameState,      setGameState]      = useState('CHOOSE'); // CHOOSE | DECIDE | REVEAL
  const [playerDecision, setPlayerDecision] = useState(null);
  const [lastResult,     setLastResult]     = useState(null);
  const [stats, setStats] = useState({ switchWins: 0, switchLosses: 0, stayWins: 0, stayLosses: 0 });

  useEffect(() => () => { clearTimeout(curtainRef.current); clearTimeout(playRef.current); }, []);

  const startShow = () => {
    setShowPhase('OPENING');
    playFanfare();
    curtainRef.current = setTimeout(() => setCurtainOpen(true), 50);
    playRef.current    = setTimeout(() => setShowPhase('PLAYING'), 2100);
  };

  const startNewRound = () => {
    setCarPosition(Math.floor(Math.random() * 3) + 1);
    setSelectedDoor(null);
    setRevealedDoor(null);
    setGameState('CHOOSE');
    setPlayerDecision(null);
    setLastResult(null);
  };

  const resetAll = () => {
    startNewRound();
    setStats({ switchWins: 0, switchLosses: 0, stayWins: 0, stayLosses: 0 });
  };

  const handleDoorClick = (doorNum) => {
    if (gameState !== 'CHOOSE') return;
    setSelectedDoor(doorNum);
    const avail = [1, 2, 3].filter(d => d !== doorNum && d !== carPosition);
    setRevealedDoor(avail[Math.floor(Math.random() * avail.length)]);
    setGameState('DECIDE');
  };

  const handleDecision = (decision) => {
    if (gameState !== 'DECIDE') return;
    setPlayerDecision(decision);
    let finalDoor = selectedDoor;
    if (decision === 'SWITCH') {
      finalDoor = [1, 2, 3].find(d => d !== selectedDoor && d !== revealedDoor);
      setSelectedDoor(finalDoor);
    }
    const isWin = finalDoor === carPosition;
    setLastResult(isWin ? 'WIN' : 'LOSS');
    setStats(prev => {
      const ns = { ...prev };
      if (decision === 'SWITCH') { if (isWin) ns.switchWins++; else ns.switchLosses++; }
      else                       { if (isWin) ns.stayWins++;   else ns.stayLosses++;   }
      return ns;
    });
    setGameState('REVEAL');
    if (isWin) playApplause(); else playWrong();
  };

  const runBulkSimulation = (strategy, count) => {
    let sW = 0, sL = 0, stW = 0, stL = 0;
    for (let i = 0; i < count; i++) {
      const car    = Math.floor(Math.random() * 3) + 1;
      const choice = Math.floor(Math.random() * 3) + 1;
      const avail  = [1, 2, 3].filter(d => d !== choice && d !== car);
      const reveal = avail[Math.floor(Math.random() * avail.length)];
      if (strategy === 'SWITCH') {
        const final = [1, 2, 3].find(d => d !== choice && d !== reveal);
        if (final === car) sW++; else sL++;
      } else {
        if (choice === car) stW++; else stL++;
      }
    }
    setStats(prev => ({
      switchWins:   prev.switchWins   + sW,
      switchLosses: prev.switchLosses + sL,
      stayWins:     prev.stayWins     + stW,
      stayLosses:   prev.stayLosses   + stL,
    }));
  };

  const totalSwitch = stats.switchWins + stats.switchLosses;
  const totalStay   = stats.stayWins   + stats.stayLosses;
  const pctSwitch   = totalSwitch > 0 ? ((stats.switchWins / totalSwitch) * 100).toFixed(1) : '—';
  const pctStay     = totalStay   > 0 ? ((stats.stayWins   / totalStay)   * 100).toFixed(1) : '—';

  const presenterText = () => {
    if (gameState === 'CHOOSE') return '🎤 ¡Bienvenidos a Las Tres Puertas! Detrás de una de estas puertas hay un coche increíble... ¡Elige una puerta!';
    if (gameState === 'DECIDE') return `🎤 ¡Interesante! He abierto la puerta ${revealedDoor}... ¡y hay una cabra! 🐐 ¿Mantienes la puerta ${selectedDoor} o cambias a la otra?`;
    if (gameState === 'REVEAL' && lastResult === 'WIN' && playerDecision === 'SWITCH') return '🎤 ¡¡¡ENHORABUENA!!! ¡Cambiaste de puerta y ganaste el coche! 🚗🎉 La probabilidad te sonrió — cambiando ganas 2 de cada 3 veces.';
    if (gameState === 'REVEAL' && lastResult === 'WIN' && playerDecision === 'STAY')   return '🎤 ¡¡ENHORABUENA!! ¡Mantuviste tu puerta y ganaste el coche! 🚗✨ ¡Eres de los afortunados — solo ganas 1 de cada 3 veces así!';
    if (gameState === 'REVEAL' && lastResult === 'LOSS' && playerDecision === 'SWITCH') return '🎤 ¡Ay, mala suerte! Cambiaste pero era una cabra esta vez. 🐐 Estadísticamente, cambiando ganarías el 66.7% de las veces.';
    if (gameState === 'REVEAL' && lastResult === 'LOSS' && playerDecision === 'STAY')  return '🎤 ¡Mantuviste y había cabra! 🐐 Si hubieras cambiado, tenías un 66.7% de posibilidades de ganar el coche. ¡Inténtalo de nuevo!';
    return '';
  };

  // ── INTRO ──
  if (showPhase === 'INTRO') {
    return (
      <div style={{ fontFamily: 'Segoe UI, Roboto, sans-serif', minHeight: 480, background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#fff', textAlign: 'center', position: 'relative' }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: '0.9rem' }}>
          ← Volver al menú
        </button>
        <div style={{ fontSize: 80, marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.5))' }}>🚪🎰🚪</div>
        <h1 style={{ fontSize: 44, fontWeight: 900, color: '#fbbf24', margin: '0 0 14px', textShadow: '0 0 30px rgba(251,191,36,0.5)', letterSpacing: '-0.5px' }}>
          Las Tres Puertas
        </h1>
        <p style={{ fontSize: 19, color: 'rgba(255,255,255,0.75)', marginBottom: 10, maxWidth: 480, lineHeight: 1.5 }}>
          El famoso Problema de Monty Hall
        </p>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 44, maxWidth: 420, lineHeight: 1.5 }}>
          Detrás de una puerta hay un 🚗 coche. Detrás de las otras dos, una 🐐 cabra. ¡El concurso de TV que desafía tu intuición matemática!
        </p>
        <button
          onClick={startShow}
          style={{ padding: '20px 52px', fontSize: 24, fontWeight: 900, color: '#1e1b4b', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', borderRadius: 18, cursor: 'pointer', boxShadow: '0 8px 32px rgba(251,191,36,0.5)', letterSpacing: '0.5px', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 12px 44px rgba(251,191,36,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   e.currentTarget.style.boxShadow = '0 8px 32px rgba(251,191,36,0.5)'; }}
        >
          🎬 ¡COMENZAR EL SHOW!
        </button>
      </div>
    );
  }

  // ── CURTAIN OPENING ──
  if (showPhase === 'OPENING') {
    return (
      <div style={{ fontFamily: 'Segoe UI, Roboto, sans-serif', background: 'linear-gradient(135deg, #0f0c29, #302b63)', borderRadius: 20, minHeight: 480, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Top valance */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, background: 'linear-gradient(135deg, #7c2d12, #b45309)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 18, letterSpacing: 4 }}>🌟  LAS TRES PUERTAS  🌟</span>
        </div>
        {/* Door preview behind curtains */}
        <div style={{ display: 'flex', gap: 24, marginTop: 52 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ width: 140, height: 220, background: '#1e1b4b', borderRadius: 16, border: '4px solid rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>🚪</div>
          ))}
        </div>
        {/* Left curtain */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
          background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 3px, transparent 3px, transparent 18px), linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%)',
          transform: curtainOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 1.8s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRight: '8px solid #92400e',
          zIndex: 10,
        }} />
        {/* Right curtain */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
          background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 3px, transparent 3px, transparent 18px), linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%)',
          transform: curtainOpen ? 'translateX(100%)' : 'translateX(0)',
          transition: 'transform 1.8s cubic-bezier(0.4, 0, 0.2, 1)',
          borderLeft: '8px solid #92400e',
          zIndex: 10,
        }} />
        {/* Center seam */}
        {!curtainOpen && (
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 10, height: '100%', background: '#7c2d12', zIndex: 11 }} />
        )}
      </div>
    );
  }

  // ── PLAYING ──
  return (
    <div style={{ fontFamily: 'Segoe UI, Roboto, sans-serif', background: 'linear-gradient(160deg, #0f0c29 0%, #1a1740 100%)', borderRadius: 20, color: '#fff', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ background: 'linear-gradient(135deg, #7c2d12, #b45309)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.9rem' }}>
          ← Volver al menú
        </button>
        <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: 17, letterSpacing: 3 }}>🌟 LAS TRES PUERTAS 🌟</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{totalSwitch + totalStay} partidas</span>
      </div>

      <div style={{ padding: '20px 24px 28px' }}>
        {/* Presenter speech bubble */}
        <div style={{ background: 'rgba(255,255,255,0.09)', border: '1.5px solid rgba(251,191,36,0.35)', borderRadius: 16, padding: '14px 22px', marginBottom: 22, fontSize: 16, fontWeight: 600, color: '#fef3c7', lineHeight: 1.55 }}>
          {presenterText()}
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

          {/* Game area */}
          <div style={{ flex: '2', minWidth: 300 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, justifyContent: 'center' }}>
              {[1, 2, 3].map(doorNum => {
                const isSel   = selectedDoor === doorNum;
                const isRev   = revealedDoor  === doorNum;
                const isOpen  = gameState === 'REVEAL' || isRev;
                const hasCar  = carPosition === doorNum;

                let bg = 'rgba(255,255,255,0.07)';
                let border = '3px solid rgba(255,255,255,0.18)';
                let labelCol = 'rgba(255,255,255,0.5)';
                let shadow = 'none';
                if (isSel && gameState !== 'REVEAL') {
                  bg = 'rgba(251,191,36,0.18)'; border = '3px solid #fbbf24';
                  labelCol = '#fbbf24'; shadow = '0 0 24px rgba(251,191,36,0.35)';
                }
                if (isRev && gameState === 'DECIDE') {
                  bg = 'rgba(255,255,255,0.03)'; border = '3px solid rgba(255,255,255,0.1)';
                }
                if (gameState === 'REVEAL') {
                  if (hasCar) { bg = 'rgba(34,197,94,0.18)'; border = '3px solid #22c55e'; labelCol = '#86efac'; shadow = '0 0 28px rgba(34,197,94,0.35)'; }
                  else        { bg = 'rgba(239,68,68,0.12)';  border = '3px solid #ef4444'; labelCol = '#fca5a5'; }
                }

                return (
                  <div key={doorNum} onClick={() => handleDoorClick(doorNum)}
                    style={{ flex: 1, minWidth: 110, maxWidth: 175, height: 248, borderRadius: 18, border, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: gameState === 'CHOOSE' ? 'pointer' : 'default', transform: isSel && gameState !== 'REVEAL' ? 'scale(1.05)' : 'scale(1)', opacity: isRev && gameState === 'DECIDE' ? 0.45 : 1, transition: 'all 0.2s ease', boxShadow: shadow, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 12, left: 12, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>
                      {doorNum}
                    </div>
                    <div style={{ fontSize: 72, lineHeight: 1 }}>
                      {!isOpen ? '🚪' : (hasCar ? '🚗' : '🐐')}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: labelCol }}>
                      {isSel && gameState !== 'REVEAL' && '⭐ Elegida'}
                      {isRev && gameState === 'DECIDE' && '🗑️ Cabra'}
                      {gameState === 'REVEAL' && (hasCar ? '🏆 ¡Coche!' : '🐐 Cabra')}
                      {!isSel && !isRev && gameState !== 'REVEAL' && '🚪 Cerrada'}
                    </div>
                  </div>
                );
              })}
            </div>

            {gameState === 'DECIDE' && (
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 16 }}>
                <button onClick={() => handleDecision('STAY')}
                  style={{ padding: '14px 26px', fontSize: 18, fontWeight: 800, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 16px rgba(220,38,38,0.45)' }}>
                  ✋ Mantener
                </button>
                <button onClick={() => handleDecision('SWITCH')}
                  style={{ padding: '14px 26px', fontSize: 18, fontWeight: 800, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 16px rgba(37,99,235,0.45)' }}>
                  🔄 Cambiar
                </button>
              </div>
            )}

            {gameState === 'REVEAL' && (
              <div style={{ textAlign: 'center' }}>
                <button onClick={startNewRound}
                  style={{ padding: '14px 36px', fontSize: 17, fontWeight: 800, color: '#fff', background: '#10b981', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.45)' }}>
                  🚪 Siguiente Ronda
                </button>
              </div>
            )}
          </div>

          {/* Stats sidebar */}
          <div style={{ flex: '1', minWidth: 260 }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 18, marginBottom: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: '0 0 14px', color: '#fbbf24', fontSize: 15, fontWeight: 700 }}>📊 Estadísticas</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Estrategia', '🏆', '❌', '%'].map((h, i) => (
                      <th key={i} style={{ padding: '7px 5px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textAlign: i === 0 ? 'left' : 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 5px', fontWeight: 700, color: '#60a5fa' }}>🔄 Cambiar</td>
                    <td style={{ padding: '10px 5px', textAlign: 'center', color: '#86efac' }}>{stats.switchWins}</td>
                    <td style={{ padding: '10px 5px', textAlign: 'center', color: '#fca5a5' }}>{stats.switchLosses}</td>
                    <td style={{ padding: '10px 5px', textAlign: 'center', fontWeight: 700, color: '#86efac' }}>{pctSwitch}%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 5px', fontWeight: 700, color: '#f87171' }}>✋ Mantener</td>
                    <td style={{ padding: '10px 5px', textAlign: 'center', color: '#86efac' }}>{stats.stayWins}</td>
                    <td style={{ padding: '10px 5px', textAlign: 'center', color: '#fca5a5' }}>{stats.stayLosses}</td>
                    <td style={{ padding: '10px 5px', textAlign: 'center', fontWeight: 700, color: '#86efac' }}>{pctStay}%</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Total: {totalSwitch + totalStay} partidas</p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 18, border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 style={{ margin: '0 0 10px', color: '#fbbf24', fontSize: 14, fontWeight: 700 }}>🤖 Simulación masiva</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>Genera 100 partidas automáticas para demostrar la paradoja:</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={() => runBulkSimulation('SWITCH', 100)}
                  style={{ flex: 1, padding: '9px 6px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  🔄 Cambiar (100)
                </button>
                <button onClick={() => runBulkSimulation('STAY', 100)}
                  style={{ flex: 1, padding: '9px 6px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  ✋ Mantener (100)
                </button>
              </div>
              <button onClick={resetAll}
                style={{ width: '100%', padding: '9px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                🗑️ Limpiar estadísticas
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main menu selector ───────────────────────────────────────────────────────

export default function SimuladorProbabilidad({ onExit }) {
  const [modo, setModo] = useState(null); // null | 'DADOS' | 'CARRERA' | 'PUERTAS'

  if (modo === 'DADOS')   return <SimuladorDados   onBack={() => setModo(null)} />;
  if (modo === 'CARRERA') return <CarreraCamellos  onBack={() => setModo(null)} />;
  if (modo === 'PUERTAS') return <TresPuertas      onBack={() => setModo(null)} />;

  return (
    <div style={{
      fontFamily: 'Segoe UI, Roboto, sans-serif', padding: 24,
      maxWidth: 800, margin: '0 auto', background: '#f8fafc',
      borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', color: '#1e293b',
    }}>
      {onExit && (
        <button onClick={onExit} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', marginBottom: 12, fontWeight: 700, fontSize: '0.9rem', padding: '4px 0' }}>
          ← Volver a Math World
        </button>
      )}

      <h1 style={{ textAlign: 'center', fontSize: 34, fontWeight: 800, margin: '0 0 8px' }}>🎲 Probabilidad</h1>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 44, fontSize: 16 }}>Elige una actividad</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, maxWidth: 860, margin: '0 auto' }}>

        {/* Card: Simulador de Dados */}
        <div
          onClick={() => setModo('DADOS')}
          style={{ background: '#eff6ff', border: '3px solid #2563eb', borderRadius: 22, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(37,99,235,0.12)', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(37,99,235,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.12)'; }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎲</div>
          <h2 style={{ color: '#1d4ed8', fontSize: 21, fontWeight: 800, margin: '0 0 10px' }}>Simulador de Dados</h2>
          <p style={{ color: '#475569', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            D4–D100 · 1–3 dados · hasta 1 000 000 tiradas<br />Suma, Resta, Multiplicación o División
          </p>
        </div>

        {/* Card: Carrera de Camellos */}
        <div
          onClick={() => setModo('CARRERA')}
          style={{ background: '#fefce8', border: '3px solid #ca8a04', borderRadius: 22, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(202,138,4,0.12)', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(202,138,4,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = '0 8px 24px rgba(202,138,4,0.12)'; }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>🐪</div>
          <h2 style={{ color: '#92400e', fontSize: 21, fontWeight: 800, margin: '0 0 10px' }}>Carrera de Camellos</h2>
          <p style={{ color: '#475569', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            2 dados D6 · Suma, |Resta| o Multiplicación<br />Asigna camellos a filas · ¡Que gane la probabilidad!
          </p>
        </div>

        {/* Card: Las Tres Puertas */}
        <div
          onClick={() => setModo('PUERTAS')}
          style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '3px solid #7c3aed', borderRadius: 22, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(124,58,237,0.2)', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(124,58,237,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.2)'; }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>🚪</div>
          <h2 style={{ color: '#fbbf24', fontSize: 21, fontWeight: 800, margin: '0 0 10px' }}>Las Tres Puertas</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            El Problema de Monty Hall<br />¿Cambias de puerta o te mantienes? 🚗🐐
          </p>
        </div>

      </div>
    </div>
  );
}
