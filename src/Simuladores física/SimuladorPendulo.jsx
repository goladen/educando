import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [initialAngleDeg, setInitialAngleDeg] = useState(45);
  const [length, setLength] = useState(2); // metros
  const [mass, setMass] = useState(5); // kg
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);

  // Estados del cuestionario
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const requestRef = useRef();
  const startTimeRef = useRef();
  const lastUpdateRef = useRef(0);

  const g = 9.81; 
  
  // Fórmulas del Péndulo Simple (MAS)
  const initialAngleRad = (initialAngleDeg * Math.PI) / 180;
  const omega = Math.sqrt(g / length); // Frecuencia angular
  
  // Ecuaciones de movimiento en función del tiempo
  const currentAngleRad = initialAngleRad * Math.cos(omega * time);
  const currentVelocity = -length * initialAngleRad * omega * Math.sin(omega * time);
  
  // Altura respecto al punto más bajo: h = L - L*cos(theta)
  const currentHeight = length * (1 - Math.cos(currentAngleRad));
  const maxHeight = length * (1 - Math.cos(initialAngleRad));

  // Energías
  const potentialEnergy = mass * g * currentHeight;
  const kineticEnergy = 0.5 * mass * currentVelocity * currentVelocity;
  const totalEnergy = mass * g * maxHeight; // E_mecánica total constante (ideal)

  const animate = (timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const deltaTime = (timestamp - lastUpdateRef.current) / 1000;
    
    if (deltaTime > 0) {
      setTime(prevTime => prevTime + deltaTime);
      lastUpdateRef.current = timestamp;
    }
    
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying]);

  const handlePlay = () => setIsPlaying(!isPlaying);
  const handleReset = () => {
    setIsPlaying(false);
    setTime(0);
    startTimeRef.current = null;
  };

  // Dibujo SVG
  const svgWidth = 600;
  const svgHeight = 400;
  const pivotX = svgWidth / 2;
  const pivotY = 50;
  
  // Escala visual para que el péndulo encaje (L=5m máximo -> 300px)
  const scale = 300 / 5; 
  const displayLength = length * scale;
  
  const bobX = pivotX + displayLength * Math.sin(currentAngleRad);
  const bobY = pivotY + displayLength * Math.cos(currentAngleRad);

  const formatNumber = (num) => (isNaN(num) ? "0.0" : num.toFixed(1));

  // Cuestionario
  const questions = [
    { id: 1, text: "En el punto más bajo de la oscilación, ¿cómo es la Energía Cinética?", options: ["Cero", "Máxima", "Igual a la Potencial"], correct: 1 },
    { id: 2, text: "Cuando el péndulo alcanza su altura máxima en los extremos, su velocidad es...", options: ["Máxima", "Cero (0 m/s)", "Constante"], correct: 1 },
    { id: 3, text: "¿Qué ocurre con la Energía Mecánica Total durante todo el movimiento (sin rozamiento)?", options: ["Aumenta progresivamente", "Disminuye hasta pararse", "Se mantiene constante"], correct: 2 },
    { id: 4, text: "Si aumentamos la masa del péndulo a 10 kg, ¿qué le ocurre a la velocidad de caída?", options: ["Cae más rápido", "Cae más lento", "No varía (cae igual)"], correct: 2 },
    { id: 5, text: "Si la cuerda fuera más larga, el tiempo que tarda en dar una oscilación completa (Periodo)...", options: ["Sería mayor", "Sería menor", "Sería exactamente el mismo"], correct: 0 }
  ];

  const handleAnswer = (qId, optionIdx) => {
    if (!showResults) setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const calculateScore = () => questions.filter(q => answers[q.id] === q.correct).length;
  const resetQuiz = () => { setAnswers({}); setShowResults(false); };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', backgroundColor: '#fdf4ff', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ padding: '1.5rem', backgroundColor: '#c026d3', color: 'white', textAlign: 'center', borderBottom: '4px solid #a21caf' }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800' }}>Conservación de la Energía</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Péndulo Ideal • Transformación Ec ↔ Ep • Sistema sin fricción</p>
        </div>

        {/* Panel de Gráficos de Energía (Barras Dinámicas) */}
        <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', color: '#fff', display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'flex-end', height: '180px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '0.5rem' }}>{formatNumber(kineticEnergy)} J</span>
            <div style={{ width: '50px', height: '100px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#38bdf8', height: `${(kineticEnergy / totalEnergy) * 100}%`, transition: 'height 0.1s' }} />
            </div>
            <span style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#94a3b8' }}>Cinética (Ec)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
            <span style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '0.5rem' }}>{formatNumber(potentialEnergy)} J</span>
            <div style={{ width: '50px', height: '100px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#4ade80', height: `${(potentialEnergy / totalEnergy) * 100}%`, transition: 'height 0.1s' }} />
            </div>
            <span style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#94a3b8' }}>Potencial (Ep)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
            <span style={{ color: '#facc15', fontWeight: 'bold', marginBottom: '0.5rem' }}>{formatNumber(totalEnergy)} J</span>
            <div style={{ width: '50px', height: '100px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#facc15', height: `100%` }} />
            </div>
            <span style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#94a3b8' }}>Total (Em)</span>
          </div>

        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '1.5rem', gap: '2rem' }}>
          
          <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', width: '100%', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ display: 'block' }}>
                
                {/* Techo */}
                <rect x="0" y="0" width={svgWidth} height="50" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />
                <line x1={pivotX - 30} y1="50" x2={pivotX + 30} y2="50" stroke="#475569" strokeWidth="6" strokeLinecap="round" />

                {/* Eje Central Punteado */}
                <line x1={pivotX} y1="50" x2={pivotX} y2={svgHeight - 20} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" />

                {/* Cuerda del Péndulo */}
                <line x1={pivotX} y1={pivotY} x2={bobX} y2={bobY} stroke="#64748b" strokeWidth="3" />

                {/* Vector Velocidad (Azul) */}
                {Math.abs(currentVelocity) > 0.1 && (
                  <g transform={`translate(${bobX}, ${bobY}) rotate(${currentAngleRad * 180 / Math.PI})`}>
                    <line x1="0" y1="0" x2={currentVelocity * 15} y2="0" stroke="#38bdf8" strokeWidth="4" />
                    <circle cx={currentVelocity * 15} cy="0" r="4" fill="#38bdf8" />
                  </g>
                )}

                {/* Masa (Bob) */}
                <circle cx={bobX} cy={bobY} r={15 + mass * 0.5} fill="#c026d3" stroke="#a21caf" strokeWidth="3" />
                <text x={bobX} y={bobY + 35} fill="#475569" fontSize="12" fontWeight="bold" textAnchor="middle">{mass} kg</text>

                {/* Etiqueta de Ángulo Instantáneo */}
                <text x="20" y="80" fill="#475569" fontSize="14" fontWeight="bold">θ actual: {(currentAngleRad * 180 / Math.PI).toFixed(1)}°</text>
                <text x="20" y="100" fill="#475569" fontSize="14" fontWeight="bold">V: {Math.abs(currentVelocity).toFixed(2)} m/s</text>
              </svg>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button onClick={handlePlay} style={{ flex: 2, padding: '0.8rem', backgroundColor: isPlaying ? '#eab308' : '#c026d3', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                {isPlaying ? '⏸ Pausar' : time > 0 ? '▶ Continuar' : '▶ Soltar Péndulo'}
              </button>
              <button onClick={handleReset} style={{ flex: 1, padding: '0.8rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                ⟲ Volver a Origen
              </button>
            </div>
          </div>

          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>⚙️ Parámetros Físicos</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Ángulo Inicial (θ₀): <span style={{ color: '#c026d3' }}>{initialAngleDeg}°</span></label>
                <input type="range" min="10" max="80" value={initialAngleDeg} onChange={(e) => { setInitialAngleDeg(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Longitud cuerda (L): <span style={{ color: '#c026d3' }}>{length} m</span></label>
                <input type="range" min="1" max="5" step="0.5" value={length} onChange={(e) => { setLength(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Masa (m): <span style={{ color: '#c026d3' }}>{mass} kg</span></label>
                <input type="range" min="1" max="20" value={mass} onChange={(e) => { setMass(Number(e.target.value)); handleReset(); }} style={{ width: '100%', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{ backgroundColor: '#fdf4ff', padding: '1rem', borderRadius: '12px', border: '1px solid #f0abfc' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#a21caf', fontSize: '1.1rem' }}>📐 Fórmulas</h3>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                <strong>Energía Cinética:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>Ec = ½·m·v²</code><br/>
                <strong>Energía Potencial:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>Ep = m·g·h</code><br/>
                <strong>Energía Mecánica:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>Em = Ec + Ep = Constante</code>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Cuestionario */}
        <div style={{ backgroundColor: '#f3e8ff', padding: '2rem', borderTop: '2px solid #e9d5ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#6b21a8', fontSize: '1.5rem' }}>📝 Comprueba tus conocimientos</h3>
            {showResults && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: calculateScore() >= 3 ? '#dcfce7' : '#fee2e2', color: calculateScore() >= 3 ? '#166534' : '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>
                Puntuación: {calculateScore()} / {questions.length}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {questions.map((q) => (
              <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #d8b4fe', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <p style={{ margin: '0 0 1rem 0', fontWeight: '600', color: '#1e293b' }}>{q.id}. {q.text}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {q.options.map((opt, idx) => {
                    const isSelected = answers[q.id] === idx;
                    let bgColor = '#f8fafc';
                    let borderColor = '#cbd5e1';
                    
                    if (showResults) {
                      if (idx === q.correct) {
                        bgColor = '#dcfce7'; borderColor = '#22c55e';
                      } else if (isSelected && idx !== q.correct) {
                        bgColor = '#fee2e2'; borderColor = '#ef4444';
                      }
                    } else if (isSelected) {
                      bgColor = '#f3e8ff'; borderColor = '#a855f7';
                    }

                    return (
                      <button 
                        key={idx} onClick={() => handleAnswer(q.id, idx)} disabled={showResults}
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
                onClick={() => setShowResults(true)} disabled={Object.keys(answers).length < questions.length}
                style={{ padding: '0.75rem 2rem', backgroundColor: Object.keys(answers).length < questions.length ? '#cbd5e1' : '#a21caf', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer' }}
              >
                Corregir Respuestas
              </button>
            ) : (
              <button 
                onClick={resetQuiz} style={{ padding: '0.75rem 2rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
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