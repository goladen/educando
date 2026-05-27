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

// ─── Main menu selector ───────────────────────────────────────────────────────

export default function SimuladorProbabilidad({ onExit }) {
  const [modo, setModo] = useState(null); // null | 'DADOS' | 'CARRERA'

  if (modo === 'DADOS')   return <SimuladorDados   onBack={() => setModo(null)} />;
  if (modo === 'CARRERA') return <CarreraCamellos  onBack={() => setModo(null)} />;

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28, maxWidth: 620, margin: '0 auto' }}>

        {/* Card: Simulador de Dados */}
        <div
          onClick={() => setModo('DADOS')}
          style={{ background: '#eff6ff', border: '3px solid #2563eb', borderRadius: 22, padding: '40px 28px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(37,99,235,0.12)', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(37,99,235,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.12)'; }}
        >
          <div style={{ fontSize: 68, marginBottom: 18 }}>🎲</div>
          <h2 style={{ color: '#1d4ed8', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Simulador de Dados</h2>
          <p style={{ color: '#475569', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            D4–D100 · 1–3 dados · hasta 1 000 000 tiradas<br />Suma, Resta, Multiplicación o División
          </p>
        </div>

        {/* Card: Carrera de Camellos */}
        <div
          onClick={() => setModo('CARRERA')}
          style={{ background: '#fefce8', border: '3px solid #ca8a04', borderRadius: 22, padding: '40px 28px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(202,138,4,0.12)', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(202,138,4,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = '0 8px 24px rgba(202,138,4,0.12)'; }}
        >
          <div style={{ fontSize: 68, marginBottom: 18 }}>🐪</div>
          <h2 style={{ color: '#92400e', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Carrera de Camellos</h2>
          <p style={{ color: '#475569', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            2 dados D6 · Suma, |Resta| o Multiplicación<br />Asigna camellos a filas · ¡Que gane la probabilidad!
          </p>
        </div>

      </div>
    </div>
  );
}
