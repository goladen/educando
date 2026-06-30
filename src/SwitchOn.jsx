import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

export default function SwitchOn({ onVolver, completados = [], onLevelComplete }) {
  // ─── Sonidos (Web Audio API) ───────────────────────────────────────────────
  const audioCtxRef = useRef(null);
  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);
  const playTone = useCallback((freq, dur, type = 'sine', vol = 0.25, delay = 0) => {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
      gain.gain.setValueAtTime(vol, ac.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + dur);
    } catch (_) {}
  }, [getCtx]);
  // Clic seco tipo buscaminas al cambiar de estado un nodo.
  const playClick = useCallback(() => playTone(420, 0.06, 'square', 0.18), [playTone]);
  // Melodía ascendente al superar el nivel.
  const playWin = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.25, 'sine', 0.22, i * 0.1));
  }, [playTone]);

  const levelsData = useMemo(() => {
    const l4Edges = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let u = r * 4 + c;
        if (c < 3) l4Edges.push({ u, v: u + 1 });
        if (r < 3) l4Edges.push({ u, v: u + 4 });
        if (r < 3 && c < 3) l4Edges.push({ u, v: u + 5 });
        if (r < 3 && c > 0) l4Edges.push({ u, v: u + 3 });
      }
    }

    const l6Edges = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let u = r * 4 + c;
        const moves = [
          [r - 2, c - 1], [r - 2, c + 1], [r - 1, c - 2], [r - 1, c + 2],
          [r + 1, c - 2], [r + 1, c + 2], [r + 2, c - 1], [r + 2, c + 1]
        ];
        moves.forEach(([nr, nc]) => {
          if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
            let v = nr * 4 + nc;
            if (u < v && !l6Edges.some(e => e.u === u && e.v === v)) {
              l6Edges.push({ u, v });
            }
          }
        });
      }
    }

    return [
      {
        id: 1, rows: 1, cols: 6, nodes: 6, width: 600, height: 250, states: 2,
        edges: [{ u: 0, v: 1 }, { u: 1, v: 2 }, { u: 2, v: 3 }, { u: 3, v: 4 }, { u: 4, v: 5 }],
        initial: [1, 0, 1, 1, 1, 1], objective: [0, 0, 0, 0, 0, 0]
      },
      {
        id: 2, rows: 1, cols: 5, nodes: 5, width: 600, height: 250, states: 2,
        edges: [{ u: 0, v: 4, curve: 100 }, { u: 0, v: 1 }, { u: 1, v: 2 }, { u: 2, v: 3 }, { u: 3, v: 4 }],
        initial: [0, 0, 1, 0, 0], objective: [0, 0, 0, 0, 0]
      },
      {
        id: 3, rows: 3, cols: 3, nodes: 9, width: 450, height: 450, states: 2,
        edges: [{ u: 0, v: 1 }, { u: 1, v: 2 }, { u: 3, v: 4 }, { u: 4, v: 5 }, { u: 6, v: 7 }, { u: 7, v: 8 }, { u: 0, v: 3 }, { u: 3, v: 6 }, { u: 1, v: 4 }, { u: 4, v: 7 }, { u: 2, v: 5 }, { u: 5, v: 8 }],
        initial: Array(9).fill(0), objective: [1, 0, 1, 0, 1, 0, 1, 0, 1]
      },
      {
        id: 4, rows: 4, cols: 4, nodes: 16, width: 500, height: 500, states: 2,
        edges: l4Edges, 
        initial: [1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1], 
        objective: Array(16).fill(1)
      },
      {
        id: 5, rows: 3, cols: 3, nodes: 9, width: 450, height: 450, states: 3,
        edges: [{ u: 0, v: 1 }, { u: 1, v: 2 }, { u: 3, v: 4 }, { u: 4, v: 5 }, { u: 6, v: 7 }, { u: 7, v: 8 }, { u: 0, v: 3 }, { u: 3, v: 6 }, { u: 1, v: 4 }, { u: 4, v: 7 }, { u: 2, v: 5 }, { u: 5, v: 8 }],
        initial: Array(9).fill(0), 
        objective: [2, 1, 0, 1, 1, 2, 0, 2, 0]
      },
      {
        id: 6, rows: 4, cols: 4, nodes: 16, width: 500, height: 500, states: 5,
        edges: l6Edges, 
        initial: Array(16).fill(0), 
        objective: [1, 4, 2, 3, 3, 1, 4, 2, 2, 3, 1, 4, 4, 2, 3, 1]
      }
    ];
  }, []);

  const [currentLevel, setCurrentLevel] = useState(1);
  const [board, setBoard] = useState([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWon, setIsWon] = useState(false);

  const handleReset = useCallback(() => {
    setBoard([...levelsData[currentLevel - 1].initial]);
    setMoves(0);
    setTime(0);
    setIsPlaying(false);
    setIsWon(false);
  }, [currentLevel, levelsData]);

  useEffect(() => {
    handleReset();
  }, [currentLevel, handleReset]);

  useEffect(() => {
    let interval;
    if (isPlaying && !isWon) {
      interval = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isWon]);

  useEffect(() => {
    if (board.length > 0) {
      const level = levelsData[currentLevel - 1];
      if (JSON.stringify(board) === JSON.stringify(level.objective) && !isWon) {
        setIsWon(true);
        setIsPlaying(false);
        playWin();
        if (onLevelComplete) onLevelComplete(currentLevel);
      }
    }
  }, [board, currentLevel, levelsData, onLevelComplete, isWon, playWin]);

  const handleNodeClick = (idx) => {
    if (isWon) return;
    playClick();
    if (!isPlaying) setIsPlaying(true);

    const level = levelsData[currentLevel - 1];
    const toToggle = [idx];

    level.edges.forEach(edge => {
      if (edge.u === idx && !toToggle.includes(edge.v)) toToggle.push(edge.v);
      if (edge.v === idx && !toToggle.includes(edge.u)) toToggle.push(edge.u);
    });

    setBoard(prev => {
      const newBoard = [...prev];
      toToggle.forEach(n => {
        newBoard[n] = (newBoard[n] + 1) % level.states;
      });
      return newBoard;
    });
    setMoves(m => m + 1);
  };

  const getNodeCenters = useCallback((rows, cols, nodes, width, height, padding = 70) => {
    const centers = [];
    const useW = width - padding * 2;
    const useH = height - padding * 2;
    for (let i = 0; i < nodes; i++) {
      if (rows === 1) {
        const step = cols > 1 ? useW / (cols - 1) : 0;
        centers.push({ x: padding + i * step, y: height / 2 });
      } else {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const stepX = cols > 1 ? useW / (cols - 1) : 0;
        const stepY = rows > 1 ? useH / (rows - 1) : 0;
        centers.push({ x: padding + c * stepX, y: padding + r * stepY });
      }
    }
    return centers;
  }, []);

  const getColor = (state) => {
    switch (state) {
      case 0: return '#64748b'; // Apagado (Gris)
      case 1: return '#22c55e'; // Verde
      case 2: return '#eab308'; // Amarillo
      case 3: return '#ef4444'; // Rojo
      case 4: return '#3b82f6'; // Azul
      default: return '#64748b';
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const lvlData = levelsData[currentLevel - 1];
  const centers = getNodeCenters(lvlData.rows, lvlData.cols, lvlData.nodes, lvlData.width, lvlData.height);
  
  const objWidth = lvlData.width * 0.6;
  const objHeight = lvlData.height * 0.6;
  const objCenters = getNodeCenters(lvlData.rows, lvlData.cols, lvlData.nodes, objWidth, objHeight, 40);

  if (board.length !== lvlData.nodes) return null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f8fafc', color: '#1e293b' }}>
     <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>

      {onVolver && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
          <button onClick={onVolver} style={{
            background: '#e2e8f0', border: 'none', color: '#334155', padding: '10px 16px',
            borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'
          }}>← Volver</button>
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: 'bold' }}>El Juego de las Luces</h1>
        <p style={{ margin: '0', fontSize: '18px', color: '#64748b' }}>Consigue el objetivo</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: '20px', color: '#475569' }}>Nivel:</span>
        {levelsData.map(lvl => (
          <button key={lvl.id} onClick={() => setCurrentLevel(lvl.id)} style={{
            position: 'relative',
            width: '44px', height: '44px', borderRadius: '50%',
            border: completados.includes(lvl.id) ? '2px solid #22c55e' : 'none',
            backgroundColor: currentLevel === lvl.id ? '#7c3aed' : '#f1f5f9',
            color: currentLevel === lvl.id ? '#fff' : '#475569',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '20px',
            transition: 'all 0.2s'
          }}>
            {lvl.id}
            {completados.includes(lvl.id) && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px', fontSize: '14px',
                background: '#22c55e', color: '#fff', borderRadius: '50%',
                width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✓</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '50px' }}>
        <span style={{ fontSize: '22px', fontWeight: '600', color: '#64748b' }}>Movimientos: {moves}</span>
        <span style={{ fontSize: '22px', fontWeight: '600', color: '#64748b', marginLeft: '10px' }}>Tiempo: {formatTime(time)}</span>
        <button onClick={handleReset} style={{
          marginLeft: '15px', width: '40px', height: '40px', borderRadius: '50%',
          backgroundColor: '#e2e8f0', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', color: '#475569',
          transition: 'background-color 0.2s'
        }}>
          ↻
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: '60px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', letterSpacing: '2px', color: '#64748b', marginBottom: '15px' }}>TU PUZZLE</h2>
          <div style={{
            position: 'relative', width: `${lvlData.width}px`, height: `${lvlData.height}px`,
            border: '4px solid #a855f7', borderRadius: '20px', backgroundColor: '#fff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
              {lvlData.edges.map((edge, i) => {
                const p1 = centers[edge.u];
                const p2 = centers[edge.v];
                if (!p1 || !p2) return null;
                if (edge.curve) {
                  const cx = (p1.x + p2.x) / 2;
                  const cy = ((p1.y + p2.y) / 2) + edge.curve;
                  return <path key={i} d={`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`} stroke="#94a3b8" strokeWidth="3" fill="none" />
                }
                return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth="3" />
              })}
            </svg>
            
            {centers.map((pos, idx) => (
              <button key={idx} onClick={() => handleNodeClick(idx)} style={{
                position: 'absolute', left: `${pos.x}px`, top: `${pos.y}px`,
                transform: 'translate(-50%, -50%)', width: '56px', height: '56px',
                borderRadius: '50%', border: '3px solid #1e293b',
                backgroundColor: getColor(board[idx]), color: '#fff',
                fontSize: '24px', fontWeight: 'bold', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)', transition: 'background-color 0.2s',
                zIndex: 10
              }}>
                {idx + 1}
              </button>
            ))}
            
            {isWon && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '16px', zIndex: 20 }}>
                <div style={{ backgroundColor: '#16a34a', color: '#fff', padding: '15px 30px', borderRadius: '12px', fontSize: '28px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  ¡Nivel Completado!
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', letterSpacing: '2px', color: '#64748b', marginBottom: '15px' }}>OBJETIVO</h2>
          <div style={{
            position: 'relative', width: `${objWidth}px`, height: `${objHeight}px`,
            border: '3px dashed #cbd5e1', borderRadius: '20px', backgroundColor: '#f8fafc'
          }}>
            {objCenters.map((pos, idx) => (
              <div key={idx} style={{
                position: 'absolute', left: `${pos.x}px`, top: `${pos.y}px`,
                transform: 'translate(-50%, -50%)', width: '32px', height: '32px',
                borderRadius: '50%', border: '2px solid #334155',
                backgroundColor: getColor(lvlData.objective[idx])
              }}></div>
            ))}
          </div>
        </div>

      </div>
     </div>
    </div>
  );
}