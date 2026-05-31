import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [initialHeight, setInitialHeight] = useState(50);
  const [mass, setMass] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Estados del cuestionario
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const requestRef = useRef();
  const startTimeRef = useRef();

  const g = 9.81; 
  
  // Fórmulas de caída libre
  const maxTime = Math.sqrt((2 * initialHeight) / g);
  const currentFallenDistance = 0.5 * g * elapsedTime * elapsedTime;
  const currentHeight = Math.max(0, initialHeight - currentFallenDistance);
  const currentVelocity = g * elapsedTime;
  const maxVelocity = g * maxTime;

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
    if (initialHeight === 0) return;
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

  const svgHeight = 380;
  // Calculamos la posición Y del objeto en píxeles. 
  // 0 metros caídos = margen superior. initialHeight caídos = suelo.
  const topMargin = 30;
  const bottomMargin = 30;
  const drawableHeight = svgHeight - topMargin - bottomMargin;
  
  const ballY = topMargin + (initialHeight > 0 ? (currentFallenDistance / initialHeight) * drawableHeight : 0);
  const groundY = topMargin + drawableHeight + 10;

  const formatNumber = (num) => (isNaN(num) ? "0.00" : num.toFixed(2));

  // Preguntas del cuestionario
  const questions = [
    { id: 1, text: "Si duplicamos la masa del objeto que cae, ¿qué ocurre con el tiempo que tarda en llegar al suelo? (Ignorando el aire)", options: ["Se reduce a la mitad", "Se duplica", "No cambia en absoluto"], correct: 2 },
    { id: 2, text: "La aceleración que experimenta un cuerpo en caída libre cerca de la superficie terrestre es...", options: ["Variable, aumenta al caer", "Cero", "Constante (aprox 9.81 m/s²)"], correct: 2 },
    { id: 3, text: "¿Cuál es la velocidad inicial de un objeto cuando se deja en caída libre?", options: ["9.81 m/s", "0 m/s", "Depende de la altura inicial"], correct: 1 },
    { id: 4, text: "Si dejamos caer un objeto desde el cuádruple (x4) de altura, el tiempo de caída...", options: ["Se multiplica por 4", "Se multiplica por 2", "Se mantiene igual"], correct: 1 },
    { id: 5, text: "A medida que el objeto cae, su energía potencial gravitatoria...", options: ["Aumenta y se convierte en calor", "Disminuye y se transforma en energía cinética", "Se mantiene constante"], correct: 1 }
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
        
        <div style={{ padding: '1.5rem', backgroundColor: '#7c3aed', color: 'white', textAlign: 'center', borderBottom: '4px solid #5b21b6' }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800' }}>Simulador de Caída Libre</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Laboratorio Virtual de Cinemática • Sin Resistencia del Aire • g = 9.81 m/s²</p>
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
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>📏 Altura actual (h)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#c084fc', fontWeight: 'bold' }}>
              {formatNumber(currentHeight)} <span style={{ fontSize: '1rem', color: '#64748b' }}>m</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '1.5rem', gap: '2rem' }}>
          
          <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', width: '100%', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
              <svg width="100%" height={svgHeight} viewBox={`0 0 600 ${svgHeight}`} style={{ display: 'block' }}>
                {/* Cielo / Fondo */}
                <rect x="0" y="0" width="600" height={svgHeight} fill="#e0f2fe" />
                
                {/* Suelo */}
                <rect x="0" y={groundY} width="600" height={svgHeight - groundY} fill="#84cc16" />
                <line x1="0" y1={groundY} x2="600" y2={groundY} stroke="#4d7c0f" strokeWidth="4" />

                {/* Edificio / Plataforma */}
                <rect x="50" y={topMargin} width="120" height={groundY - topMargin} fill="#94a3b8" stroke="#64748b" strokeWidth="2" />
                <rect x="40" y={topMargin} width="140" height="15" fill="#475569" />
                
                {/* Regla de medición */}
                <line x1="220" y1={topMargin} x2="220" y2={groundY} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" />
                <text x="230" y={topMargin + 5} fill="#64748b" fontSize="12" fontWeight="bold">h = {initialHeight} m</text>
                <text x="230" y={groundY - 5} fill="#64748b" fontSize="12" fontWeight="bold">0 m</text>

                {/* Objeto cayendo */}
                <g transform={`translate(280, ${ballY})`}>
                  <circle cx="0" cy="0" r="15" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" />
                  {/* Etiqueta de masa */}
                  <text x="-8" y="4" fill="white" fontSize="10" fontWeight="bold">{mass}k</text>
                  
                  {/* Vector velocidad */}
                  {currentVelocity > 0 && (
                    <g transform="translate(20, 0)">
                      <line x1="0" y1="0" x2="0" y2={Math.min(currentVelocity * 3, 120)} stroke="#22c55e" strokeWidth="3" />
                      <polygon points={`-4,${Math.min(currentVelocity * 3, 120) - 6} 4,${Math.min(currentVelocity * 3, 120) - 6} 0,${Math.min(currentVelocity * 3, 120) + 2}`} fill="#22c55e" />
                      <text x="10" y={Math.min(currentVelocity * 3, 120) / 2} fill="#16a34a" fontSize="12" fontWeight="bold">v</text>
                    </g>
                  )}
                </g>
              </svg>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button onClick={handlePlay} disabled={initialHeight === 0} style={{ flex: 2, padding: '0.8rem', backgroundColor: initialHeight === 0 ? '#cbd5e1' : isPlaying ? '#eab308' : '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: initialHeight === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isPlaying ? '⏸ Pausar Simulación' : elapsedTime > 0 && elapsedTime < maxTime ? '▶ Continuar Caída' : '▶ Dejar Caer'}
              </button>
              <button onClick={handleReset} style={{ flex: 1, padding: '0.8rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                ⟲ Subir Objeto
              </button>
            </div>

            {/* Fórmulas */}
            <div style={{ marginTop: '1.5rem', backgroundColor: '#f3e8ff', padding: '1rem', borderRadius: '8px', border: '1px solid #d8b4fe' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#6b21a8', fontSize: '1.1rem' }}>📐 Fórmulas Físicas (Caída Libre)</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e9d5ff', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Gravedad (constante)</span><br/>
                  <strong style={{ fontSize: '1.1rem' }}>g = 9.81 m/s²</strong>
                </div>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e9d5ff', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Velocidad instantánea</span><br/>
                  <strong style={{ fontSize: '1.1rem' }}>v = g · t</strong>
                </div>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e9d5ff', flex: '1 1 30%' }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Posición (Altura)</span><br/>
                  <strong style={{ fontSize: '1.1rem' }}>y = h₀ - ½ · g · t²</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>⚙️ Parámetros</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Altura inicial (h₀): <span style={{ color: '#7c3aed' }}>{initialHeight} m</span></label>
                <input type="range" min="5" max="200" step="5" value={initialHeight} onChange={(e) => { setInitialHeight(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Masa (m): <span style={{ color: '#7c3aed' }}>{mass} kg</span></label>
                <input type="range" min="1" max="100" value={mass} onChange={(e) => { setMass(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>* Prueba a cambiar la masa y observa si afecta la caída.</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.1rem' }}>📊 Resultados Finales Teóricos</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Aceleración:</span> <strong>9.81 m/s²</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tiempo de impacto:</span> <strong style={{ color: '#38bdf8' }}>{formatNumber(maxTime)} s</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Velocidad de impacto:</span> <strong style={{ color: '#16a34a' }}>{formatNumber(maxVelocity)} m/s</strong></li>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}><span>Energía Potencial Inicial:</span> <strong>{formatNumber(mass * g * initialHeight)} J</strong></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sección de Cuestionario Interactivo */}
        <div style={{ backgroundColor: '#f5f3ff', padding: '2rem', borderTop: '2px solid #ddd6fe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#5b21b6', fontSize: '1.5rem' }}>📝 Ponte a prueba</h3>
            {showResults && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: calculateScore() >= 3 ? '#dcfce7' : '#fee2e2', color: calculateScore() >= 3 ? '#166534' : '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>
                Puntuación: {calculateScore()} / {questions.length}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {questions.map((q) => (
              <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #ddd6fe', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
                      bgColor = '#f3e8ff';
                      borderColor = '#a855f7';
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
                style={{ padding: '0.75rem 2rem', backgroundColor: Object.keys(answers).length < questions.length ? '#cbd5e1' : '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer' }}
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
