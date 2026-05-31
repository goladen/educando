import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [angle, setAngle] = useState(30);
  const [mass, setMass] = useState(10);
  const [rampLength, setRampLength] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Estados del cuestionario
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const requestRef = useRef();
  const startTimeRef = useRef();

  const g = 9.81; 
  const angleRad = (angle * Math.PI) / 180;
  
  const acceleration = g * Math.sin(angleRad);
  const forceParallel = mass * acceleration;
  const forceNormal = mass * g * Math.cos(angleRad);
  const maxTime = angle > 0 ? Math.sqrt((2 * rampLength) / acceleration) : 0;

  const currentDistanceMeters = 0.5 * acceleration * elapsedTime * elapsedTime;
  const currentVelocity = acceleration * elapsedTime;
  const maxVelocity = acceleration * maxTime;

  const animate = (time) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    const currentElapsed = (time - startTimeRef.current) / 1000;

    if (currentElapsed >= maxTime) {
      setElapsedTime(maxTime);
      setIsPlaying(false);
      return;
    }

    setElapsedTime(currentElapsed);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      if (elapsedTime >= maxTime) {
        setElapsedTime(0);
        startTimeRef.current = null;
      }
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, maxTime]);

  const handlePlay = () => {
    if (angle === 0) return;
    if (elapsedTime >= maxTime) {
      setElapsedTime(0);
    }
    setIsPlaying(!isPlaying);
    startTimeRef.current = null; 
  };

  const handleReset = () => {
    setIsPlaying(false);
    setElapsedTime(0);
  };

  const hypPx = 500;
  const distancePx = angle > 0 ? (currentDistanceMeters / rampLength) * hypPx : 0;

  const baseX = 50;
  const baseY = 320;
  const topY = baseY - hypPx * Math.sin(angleRad);
  const rightX = baseX + hypPx * Math.cos(angleRad);

  const blockX = baseX + distancePx * Math.cos(angleRad);
  const blockY = topY + distancePx * Math.sin(angleRad);

  const formatNumber = (num) => (isNaN(num) ? "0.00" : num.toFixed(2));

  // Preguntas del cuestionario
  const questions = [
    { id: 1, text: "Si duplicamos la masa del vehículo, ¿qué ocurre con su aceleración?", options: ["Se duplica", "Se reduce a la mitad", "No cambia"], correct: 2 },
    { id: 2, text: "En un plano inclinado sin rozamiento, la velocidad del objeto...", options: ["Es constante", "Aumenta linealmente con el tiempo", "Aumenta al cuadrado con el tiempo"], correct: 1 },
    { id: 3, text: "Para calcular la fuerza motriz (paralela a la rampa), ¿qué razón trigonométrica usamos?", options: ["Seno (sen θ)", "Coseno (cos θ)", "Tangente (tan θ)"], correct: 0 },
    { id: 4, text: "¿A qué ángulo la fuerza normal es nula (0 N)?", options: ["0°", "45°", "90°"], correct: 2 },
    { id: 5, text: "Si el ángulo de la rampa es 0°, ¿cuál será la aceleración del vehículo?", options: ["9.81 m/s²", "0 m/s²", "Depende de la masa"], correct: 1 }
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
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', backgroundColor: '#f0f4f8', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ padding: '1.5rem', backgroundColor: '#2563eb', color: 'white', textAlign: 'center', borderBottom: '4px solid #1d4ed8' }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800' }}>Simulador de Plano Inclinado</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Laboratorio Virtual (MRUA) • Sin Rozamiento • g = 9.81 m/s²</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', backgroundColor: '#0f172a', padding: '1rem', color: '#fff', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: '160px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #3b82f6' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>⏱️ Tiempo (t)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 'bold' }}>
              {formatNumber(elapsedTime)} <span style={{ fontSize: '1rem', color: '#64748b' }}>s</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '160px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #22c55e' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>🚀 Velocidad (v)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#4ade80', fontWeight: 'bold' }}>
              {formatNumber(currentVelocity)} <span style={{ fontSize: '1rem', color: '#64748b' }}>m/s</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '160px', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '2px solid #a855f7' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>📏 Espacio (s)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#c084fc', fontWeight: 'bold' }}>
              {formatNumber(currentDistanceMeters)} <span style={{ fontSize: '1rem', color: '#64748b' }}>m</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '1.5rem', gap: '2rem' }}>
          
          <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', width: '100%', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
              <svg width="100%" height="380" viewBox="0 0 600 380" style={{ display: 'block' }}>
                <line x1="10" y1={baseY} x2="590" y2={baseY} stroke="#94a3b8" strokeWidth="4" />
                <line x1={baseX} y1={baseY} x2={baseX} y2={topY} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6,6" />
                <line x1={baseX} y1={topY} x2={rightX} y2={baseY} stroke="#334155" strokeWidth="8" strokeLinecap="round" />
                
                <text x={baseX + (rightX - baseX)/2} y={baseY + 25} fill="#475569" fontSize="14" fontWeight="bold">L = {rampLength} m</text>

                <path d={`M ${rightX - 50} ${baseY} A 50 50 0 0 0 ${rightX - 50 * Math.cos(angleRad)} ${baseY - 50 * Math.sin(angleRad)}`} fill="none" stroke="#ef4444" strokeWidth="3" />
                <text x={rightX - 85} y={baseY - 15} fill="#ef4444" fontSize="18" fontWeight="bold">{angle}°</text>

                <g transform={`translate(${blockX}, ${blockY}) rotate(${angle})`}>
                  <rect x="0" y="-35" width="50" height="35" fill="#f59e0b" rx="6" stroke="#d97706" strokeWidth="2" />
                  <circle cx="12" cy="0" r="7" fill="#1e293b" />
                  <circle cx="38" cy="0" r="7" fill="#1e293b" />
                  {currentVelocity > 0 && (
                    <g transform="translate(55, -17)">
                      <line x1="0" y1="0" x2={Math.min(currentVelocity * 8, 80)} y2="0" stroke="#22c55e" strokeWidth="4" />
                      <polygon points={`${Math.min(currentVelocity * 8, 80)},-6 ${Math.min(currentVelocity * 8, 80) + 8},0 ${Math.min(currentVelocity * 8, 80)},6`} fill="#22c55e" />
                    </g>
                  )}
                </g>
              </svg>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button onClick={handlePlay} disabled={angle === 0} style={{ flex: 2, padding: '0.8rem', backgroundColor: angle === 0 ? '#cbd5e1' : isPlaying ? '#eab308' : '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: angle === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isPlaying ? '⏸ Pausar Simulación' : elapsedTime > 0 && elapsedTime < maxTime ? '▶ Continuar' : '▶ Lanzar Vehículo'}
              </button>
              <button onClick={handleReset} style={{ flex: 1, padding: '0.8rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                ⟲ Resetear
              </button>
            </div>

            {/* Fórmulas */}
            <div style={{ marginTop: '1.5rem', backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontSize: '1.1rem' }}>📐 Fórmulas Físicas (MRUA)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #dbeafe', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Aceleración</span><br/>
                  <strong style={{ fontSize: '1.1rem' }}>a = g · sen(θ)</strong>
                </div>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #dbeafe', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Velocidad final</span><br/>
                  <strong style={{ fontSize: '1.1rem' }}>v = a · t</strong>
                </div>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #dbeafe', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Espacio recorrido</span><br/>
                  <strong style={{ fontSize: '1.1rem' }}>s = ½ · a · t²</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>⚙️ Parámetros</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Ángulo (θ): <span style={{ color: '#2563eb' }}>{angle}°</span></label>
                <input type="range" min="0" max="80" value={angle} onChange={(e) => { setAngle(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Masa (m): <span style={{ color: '#2563eb' }}>{mass} kg</span></label>
                <input type="range" min="1" max="100" value={mass} onChange={(e) => { setMass(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Longitud (L): <span style={{ color: '#2563eb' }}>{rampLength} m</span></label>
                <input type="range" min="5" max="50" step="1" value={rampLength} onChange={(e) => { setRampLength(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.1rem' }}>📊 Resultados</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Aceleración constante:</span> <strong>{formatNumber(acceleration)} m/s²</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Fuerza Paralela (m·a):</span> <strong>{formatNumber(forceParallel)} N</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Fuerza Normal:</span> <strong>{formatNumber(forceNormal)} N</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}><span>Velocidad final (fin de rampa):</span> <strong style={{ color: '#16a34a' }}>{formatNumber(maxVelocity)} m/s</strong></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sección de Cuestionario Interactivo */}
        <div style={{ backgroundColor: '#fffbeb', padding: '2rem', borderTop: '2px solid #fde68a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#b45309', fontSize: '1.5rem' }}>📝 Ponte a prueba</h3>
            {showResults && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: calculateScore() >= 3 ? '#dcfce7' : '#fee2e2', color: calculateScore() >= 3 ? '#166534' : '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>
                Puntuación: {calculateScore()} / {questions.length}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {questions.map((q) => (
              <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #fde68a', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
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
                      bgColor = '#dbeafe';
                      borderColor = '#3b82f6';
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
                style={{ padding: '0.75rem 2rem', backgroundColor: Object.keys(answers).length < questions.length ? '#cbd5e1' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer' }}
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
