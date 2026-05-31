import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [initialVelocity, setInitialVelocity] = useState(20);
  const [angle, setAngle] = useState(45);
  const [initialHeight, setInitialHeight] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Estados del cuestionario
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const requestRef = useRef();
  const startTimeRef = useRef();

  const g = 9.81; 
  
  // Cálculos físicos teóricos
  const angleRad = (angle * Math.PI) / 180;
  const v0x = initialVelocity * Math.cos(angleRad);
  const v0y = initialVelocity * Math.sin(angleRad);

  // Ecuación de segundo grado para el tiempo de vuelo: y = y0 + v0y*t - 0.5*g*t^2 = 0
  const timeOfFlight = (v0y + Math.sqrt(v0y * v0y + 2 * g * initialHeight)) / g;
  const maxHeight = initialHeight + (v0y * v0y) / (2 * g);
  const maxRange = v0x * timeOfFlight;

  // Estado instantáneo
  const currentX = v0x * elapsedTime;
  const currentY = Math.max(0, initialHeight + v0y * elapsedTime - 0.5 * g * elapsedTime * elapsedTime);
  const currentVy = v0y - g * elapsedTime;
  const currentVelocity = Math.sqrt(v0x * v0x + currentVy * currentVy);

  const animate = (time) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    const currentElapsed = (time - startTimeRef.current) / 1000;

    if (currentElapsed >= timeOfFlight) {
      setElapsedTime(timeOfFlight);
      setIsPlaying(false);
      return;
    }

    setElapsedTime(currentElapsed);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      if (elapsedTime >= timeOfFlight) {
        setElapsedTime(0);
        startTimeRef.current = null;
      }
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, timeOfFlight]);

  const handlePlay = () => {
    if (elapsedTime >= timeOfFlight) {
      setElapsedTime(0);
    }
    setIsPlaying(!isPlaying);
    startTimeRef.current = null; 
  };

  const handleReset = () => {
    setIsPlaying(false);
    setElapsedTime(0);
  };

  // Cálculos de renderizado SVG con escala dinámica
  const svgWidth = 600;
  const svgHeight = 380;
  
  // Auto-escalado para que el gráfico siempre quepa
  const maxDisplayX = Math.max(maxRange * 1.1, 10);
  const maxDisplayY = Math.max(maxHeight * 1.2, 10);

  const getSvgX = (mX) => 50 + (mX / maxDisplayX) * 500;
  const getSvgY = (mY) => 340 - (mY / maxDisplayY) * 280;

  // Generar la parábola proyectada (línea punteada)
  const trajectoryPoints = [];
  for (let t = 0; t <= timeOfFlight; t += timeOfFlight / 50) {
    const tx = v0x * t;
    const ty = Math.max(0, initialHeight + v0y * t - 0.5 * g * t * t);
    trajectoryPoints.push(`${getSvgX(tx)},${getSvgY(ty)}`);
  }

  const formatNumber = (num) => (isNaN(num) ? "0.00" : num.toFixed(2));

  // Preguntas del cuestionario
  const questions = [
    { id: 1, text: "Desde el suelo, ¿qué ángulo de lanzamiento proporciona el alcance horizontal máximo (sin rozamiento)?", options: ["30°", "45°", "60°", "90°"], correct: 1 },
    { id: 2, text: "En el punto más alto de la trayectoria parabólica, ¿cuál es la velocidad vertical (Vy) del proyectil?", options: ["Máxima", "Cero (0 m/s)", "Igual a la velocidad inicial"], correct: 1 },
    { id: 3, text: "¿Cómo se comporta la velocidad horizontal (Vx) a lo largo de todo el vuelo?", options: ["Aumenta constantemente", "Disminuye constantemente", "Se mantiene constante (MRU)"], correct: 2 },
    { id: 4, text: "En el punto más alto, ¿cuál es la aceleración que experimenta el proyectil?", options: ["Cero", "9.81 m/s² hacia abajo", "9.81 m/s² hacia arriba"], correct: 1 },
    { id: 5, text: "Si un objeto se lanza horizontalmente y otro se deja caer desde la misma altura al mismo tiempo, ¿qué sucede?", options: ["El que cae llega primero", "El lanzado llega primero", "Ambos llegan al suelo al mismo tiempo"], correct: 2 }
  ];

  const handleAnswer = (qId, optionIdx) => {
    if (!showResults) {
      setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    }
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct) score++;
    });
    return score;
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResults(false);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', backgroundColor: '#f0fdf4', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ padding: '1.5rem', backgroundColor: '#ea580c', color: 'white', textAlign: 'center', borderBottom: '4px solid #c2410c' }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800' }}>Simulador de Tiro Parabólico</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Laboratorio Virtual de Cinemática (2D) • Sin Rozamiento • g = 9.81 m/s²</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', backgroundColor: '#0f172a', padding: '1rem', color: '#fff', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: '140px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #3b82f6' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>⏱️ Tiempo (t)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 'bold' }}>
              {formatNumber(elapsedTime)}<span style={{ fontSize: '1rem', color: '#64748b' }}>s</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '140px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #22c55e' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>📏 Distancia (X)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#4ade80', fontWeight: 'bold' }}>
              {formatNumber(currentX)}<span style={{ fontSize: '1rem', color: '#64748b' }}>m</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '140px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #a855f7' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>🚀 Altura (Y)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#c084fc', fontWeight: 'bold' }}>
              {formatNumber(currentY)}<span style={{ fontSize: '1rem', color: '#64748b' }}>m</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '140px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #f59e0b' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>💨 Velocidad (v)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 'bold' }}>
              {formatNumber(currentVelocity)}<span style={{ fontSize: '1rem', color: '#64748b' }}>m/s</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '1.5rem', gap: '2rem' }}>
          
          <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', width: '100%', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
              <svg width="100%" height={svgHeight} viewBox={`0 0 600 ${svgHeight}`} style={{ display: 'block' }}>
                <defs>
                  <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrowHeadBlue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
                  </marker>
                </defs>

                {/* Cielo / Fondo */}
                <rect x="0" y="0" width="600" height={svgHeight} fill="#f0f9ff" />
                
                {/* Cuadrícula base */}
                <line x1="50" y1="50" x2="50" y2="340" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="50" y1="340" x2="550" y2="340" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" />
                
                {/* Suelo */}
                <rect x="0" y="340" width="600" height="40" fill="#22c55e" />
                <line x1="0" y1="340" x2="600" y2="340" stroke="#16a34a" strokeWidth="4" />

                {/* Plataforma (si hay altura inicial) */}
                {initialHeight > 0 && (
                  <rect 
                    x="20" 
                    y={getSvgY(initialHeight)} 
                    width="30" 
                    height={340 - getSvgY(initialHeight)} 
                    fill="#94a3b8" 
                    stroke="#64748b" 
                    strokeWidth="2" 
                  />
                )}

                {/* Trayectoria punteada */}
                <polyline points={trajectoryPoints.join(' ')} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,4" />

                {/* Vector de velocidad inicial */}
                {elapsedTime === 0 && !isPlaying && (
                  <line 
                    x1={getSvgX(0)} 
                    y1={getSvgY(initialHeight)} 
                    x2={getSvgX(0) + Math.cos(angleRad) * 60} 
                    y2={getSvgY(initialHeight) - Math.sin(angleRad) * 60} 
                    stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowHeadBlue)" 
                  />
                )}

                {/* Proyectil */}
                <g transform={`translate(${getSvgX(currentX)}, ${getSvgY(currentY)})`}>
                  <circle cx="0" cy="0" r="10" fill="#ea580c" stroke="#c2410c" strokeWidth="2" />
                  
                  {/* Vectores de velocidad (Vx, Vy) */}
                  {currentVelocity > 0 && (
                    <>
                      {/* Vector Vx (Constante) */}
                      <line x1="0" y1="0" x2={v0x * 2} y2="0" stroke="#3b82f6" strokeWidth="3" markerEnd="url(#arrowHeadBlue)" />
                      {/* Vector Vy (Variable) */}
                      <line x1="0" y1="0" x2="0" y2={-currentVy * 2} stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrowHead)" />
                    </>
                  )}
                </g>

                {/* Ejes y Etiquetas */}
                <text x="560" y="355" fill="#475569" fontSize="12" fontWeight="bold">X (m)</text>
                <text x="25" y="45" fill="#475569" fontSize="12" fontWeight="bold">Y (m)</text>
                <text x="20" y="335" fill="#475569" fontSize="12" fontWeight="bold">0</text>
              </svg>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button onClick={handlePlay} style={{ flex: 2, padding: '0.8rem', backgroundColor: isPlaying ? '#eab308' : '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                {isPlaying ? '⏸ Pausar' : elapsedTime > 0 && elapsedTime < timeOfFlight ? '▶ Continuar' : '▶ Lanzar Proyectil'}
              </button>
              <button onClick={handleReset} style={{ flex: 1, padding: '0.8rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                ⟲ Reiniciar
              </button>
            </div>

            {/* Fórmulas */}
            <div style={{ marginTop: '1.5rem', backgroundColor: '#fff7ed', padding: '1rem', borderRadius: '8px', border: '1px solid #fed7aa' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#c2410c', fontSize: '1.1rem' }}>📐 Fórmulas Físicas (Descomposición 2D)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ffedd5', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Eje X (MRU)</span><br/>
                  <strong style={{ fontSize: '1rem' }}>Vx = V₀·cos(θ)</strong><br/>
                  <strong style={{ fontSize: '1rem' }}>x = Vx·t</strong>
                </div>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ffedd5', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Eje Y (MRUA)</span><br/>
                  <strong style={{ fontSize: '1rem' }}>Vy = V₀·sen(θ) - g·t</strong><br/>
                  <strong style={{ fontSize: '1rem' }}>y = h₀ + V₀y·t - ½g·t²</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>⚙️ Parámetros de Disparo</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Velocidad Inicial (V₀): <span style={{ color: '#ea580c' }}>{initialVelocity} m/s</span></label>
                <input type="range" min="5" max="50" step="1" value={initialVelocity} onChange={(e) => { setInitialVelocity(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Ángulo (θ): <span style={{ color: '#ea580c' }}>{angle}°</span></label>
                <input type="range" min="0" max="90" value={angle} onChange={(e) => { setAngle(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Altura inicial (h₀): <span style={{ color: '#ea580c' }}>{initialHeight} m</span></label>
                <input type="range" min="0" max="100" step="5" value={initialHeight} onChange={(e) => { setInitialHeight(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.1rem' }}>📊 Resultados Teóricos Esperados</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Velocidad Inicial X (V₀x):</span> <strong>{formatNumber(v0x)} m/s</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Velocidad Inicial Y (V₀y):</span> <strong>{formatNumber(v0y)} m/s</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}><span>Altura Máxima (Y max):</span> <strong style={{ color: '#c084fc' }}>{formatNumber(maxHeight)} m</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Alcance Máximo (X max):</span> <strong style={{ color: '#4ade80' }}>{formatNumber(maxRange)} m</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tiempo Total de Vuelo:</span> <strong style={{ color: '#38bdf8' }}>{formatNumber(timeOfFlight)} s</strong></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sección de Cuestionario Interactivo */}
        <div style={{ backgroundColor: '#ffedd5', padding: '2rem', borderTop: '2px solid #fdba74' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#9a3412', fontSize: '1.5rem' }}>📝 Ponte a prueba</h3>
            {showResults && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: calculateScore() >= 3 ? '#dcfce7' : '#fee2e2', color: calculateScore() >= 3 ? '#166534' : '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>
                Puntuación: {calculateScore()} / {questions.length}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {questions.map((q) => (
              <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #fdba74', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <p style={{ margin: '0 0 1rem 0', fontWeight: '600', color: '#1e293b' }}>{q.id}. {q.text}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {q.options.map((opt, idx) => {
                    const isSelected = answers[q.id] === idx;
                    let bgColor = '#f8fafc';
                    let borderColor = '#cbd5e1';
                    
                    if (showResults) {
                      if (idx === q.correct) {
                        bgColor = '#dcfce7';
                        borderColor = '#22c55e';
                      } else if (isSelected && idx !== q.correct) {
                        bgColor = '#fee2e2';
                        borderColor = '#ef4444';
                      }
                    } else if (isSelected) {
                      bgColor = '#ffedd5';
                      borderColor = '#f97316';
                    }

                    return (
                      <button 
                        key={idx}
                        onClick={() => handleAnswer(q.id, idx)}
                        disabled={showResults}
                        style={{ padding: '0.75rem', textAlign: 'left', backgroundColor: bgColor, border: `1px solid ${borderColor}`, borderRadius: '6px', cursor: showResults ? 'default' : 'pointer', transition: 'all 0.2s', color: '#334155' }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            {!showResults ? (
              <button 
                onClick={() => setShowResults(true)} 
                disabled={Object.keys(answers).length < questions.length}
                style={{ padding: '0.75rem 2rem', backgroundColor: Object.keys(answers).length < questions.length ? '#cbd5e1' : '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer' }}
              >
                Corregir Respuestas
              </button>
            ) : (
              <button 
                onClick={resetQuiz}
                style={{ padding: '0.75rem 2rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Reintentar Cuestionario
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
