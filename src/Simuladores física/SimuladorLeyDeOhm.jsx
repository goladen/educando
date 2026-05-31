import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [voltage, setVoltage] = useState(12); // Voltios (V)
  const [resistance, setResistance] = useState(10); // Ohmios (Ω)
  
  // Estados del cuestionario
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const requestRef = useRef();
  const offsetRef = useRef(0);
  const [dashOffset, setDashOffset] = useState(0);

  // Cálculos de la Ley de Ohm
  const current = voltage / resistance; // Amperios (A)
  const power = voltage * current; // Vatios (W)

  // Animación del flujo de electrones
  const animate = () => {
    offsetRef.current += current * 1.5; 
    setDashOffset(offsetRef.current);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [current]);

  const formatNumber = (num) => (isNaN(num) ? "0.00" : num.toFixed(2));

  // Dimensiones del SVG
  const svgWidth = 600;
  const svgHeight = 350;

  const maxPower = 576;
  const bulbGlowOpacity = Math.min(1, power / 100); 
  const bulbGlowRadius = 20 + Math.min(60, (power / maxPower) * 150);

  // Preguntas del cuestionario
  const questions = [
    { id: 1, text: "Según la Ley de Ohm, si duplicamos el voltaje (V) manteniendo la misma resistencia, la corriente (I)...", options: ["Se reduce a la mitad", "Se duplica", "Se mantiene igual"], correct: 1 },
    { id: 2, text: "¿Qué representa la resistencia (R) en un circuito eléctrico?", options: ["La fuerza que empuja a los electrones", "La cantidad de energía almacenada", "La oposición al paso de los electrones"], correct: 2 },
    { id: 3, text: "Si aumentas mucho la resistencia de la bombilla, ¿qué le ocurre al brillo?", options: ["Aumenta, brilla más", "Disminuye, brilla menos", "Parpadea"], correct: 1 },
    { id: 4, text: "¿Cuál es la unidad de medida de la Intensidad de Corriente?", options: ["Amperios (A)", "Voltios (V)", "Vatios (W)"], correct: 0 },
    { id: 5, text: "En este circuito, si el voltaje es 0 V, ¿qué ocurre con los electrones?", options: ["Se mueven a velocidad constante", "Se detienen por completo", "Cambian de dirección"], correct: 1 }
  ];

  const handleAnswer = (qId, optionIdx) => {
    if (!showResults) setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const calculateScore = () => questions.filter(q => answers[q.id] === q.correct).length;
  const resetQuiz = () => { setAnswers({}); setShowResults(false); };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', backgroundColor: '#fffbeb', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ padding: '1.5rem', backgroundColor: '#d97706', color: 'white', textAlign: 'center', borderBottom: '4px solid #b45309' }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800' }}>Laboratorio de Electricidad</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Ley de Ohm y Circuitos de Corriente Continua (DC)</p>
        </div>

        {/* Panel de Medidores */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', backgroundColor: '#1e293b', padding: '1rem', color: '#fff', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: '130px', padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '2px solid #3b82f6' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Voltaje (V)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#60a5fa', fontWeight: 'bold' }}>
              {formatNumber(voltage)} <span style={{ fontSize: '1rem', color: '#64748b' }}>V</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '130px', padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '2px solid #ef4444' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Resistencia (R)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#f87171', fontWeight: 'bold' }}>
              {formatNumber(resistance)} <span style={{ fontSize: '1rem', color: '#64748b' }}>Ω</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '130px', padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '2px solid #22c55e' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Corriente (I)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#4ade80', fontWeight: 'bold' }}>
              {formatNumber(current)} <span style={{ fontSize: '1rem', color: '#64748b' }}>A</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '130px', padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '2px solid #eab308' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Potencia (P)</span>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#facc15', fontWeight: 'bold' }}>
              {formatNumber(power)} <span style={{ fontSize: '1rem', color: '#64748b' }}>W</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '1.5rem', gap: '2rem' }}>
          
          <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column' }}>
            {/* Lienzo del Circuito */}
            <div style={{ position: 'relative', width: '100%', backgroundColor: '#0f172a', borderRadius: '12px', border: '4px solid #334155', overflow: 'hidden' }}>
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ display: 'block' }}>
                <defs>
                  <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity={bulbGlowOpacity} />
                    <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Cable base estático */}
                <rect x="150" y="100" width="300" height="150" fill="none" stroke="#475569" strokeWidth="8" rx="10" ry="10" />
                
                {/* Flujo de electrones animado */}
                <rect 
                  x="150" y="100" width="300" height="150" fill="none" 
                  stroke="#38bdf8" strokeWidth="4" rx="10" ry="10" 
                  strokeDasharray="10 30" strokeDashoffset={-dashOffset} 
                />

                {/* Batería */}
                <g transform="translate(130, 140)">
                  <rect x="0" y="0" width="40" height="70" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" rx="4" />
                  <rect x="10" y="-8" width="20" height="8" fill="#cbd5e1" />
                  <rect x="0" y="0" width="40" height="20" fill="#ef4444" rx="4" />
                  <text x="20" y="14" fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle">+</text>
                  <text x="20" y="60" fill="#fff" fontSize="18" fontWeight="bold" textAnchor="middle">-</text>
                  <text x="-15" y="40" fill="#60a5fa" fontSize="16" fontWeight="bold" textAnchor="end">{voltage}V</text>
                </g>

                {/* Bombilla / Resistencia */}
                <g transform="translate(450, 175)">
                  <circle cx="0" cy="0" r={bulbGlowRadius} fill="url(#bulbGlow)" />
                  <path d="M-12,-15 Q0,-30 12,-15 L10,10 L-10,10 Z" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
                  <rect x="-8" y="10" width="16" height="15" fill="#64748b" rx="2" />
                  <path d="M-6,-15 L-3,-22 L3,-22 L6,-15" fill="none" stroke="#f59e0b" strokeWidth="2" opacity={0.5 + bulbGlowOpacity * 0.5} />
                  <text x="35" y="5" fill="#f87171" fontSize="16" fontWeight="bold" textAnchor="start">{resistance}Ω</text>
                </g>

                {/* Dirección de la corriente */}
                {current > 0 && (
                  <g transform="translate(300, 90)">
                    <line x1="-20" y1="0" x2="20" y2="0" stroke="#ef4444" strokeWidth="3" />
                    <polygon points="20,-5 20,5 28,0" fill="#ef4444" />
                    <text x="0" y="-10" fill="#ef4444" fontSize="12" fontWeight="bold" textAnchor="middle">I</text>
                  </g>
                )}
              </svg>
            </div>
            
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              * Los puntos azules representan el flujo de electrones a través del material conductor.
            </p>
          </div>

          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Controles */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>🎛️ Controles de la Fuente</h3>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Voltaje de la Batería (V): <span style={{ color: '#2563eb' }}>{voltage} V</span></label>
                <input type="range" min="0" max="24" step="1" value={voltage} onChange={(e) => setVoltage(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}><span>0V</span><span>24V</span></div>
              </div>
              
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '600' }}>Resistencia de la Bombilla (R): <span style={{ color: '#dc2626' }}>{resistance} Ω</span></label>
                <input type="range" min="1" max="100" step="1" value={resistance} onChange={(e) => setResistance(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#ef4444' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}><span>1Ω</span><span>100Ω</span></div>
              </div>
            </div>

            {/* Fórmulas */}
            <div style={{ backgroundColor: '#fef3c7', padding: '1rem', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#b45309', fontSize: '1.1rem' }}>📐 Fórmulas Físicas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                  <span style={{ fontWeight: 'bold', color: '#475569' }}>Ley de Ohm:</span>
                  <code style={{ fontSize: '1.1rem', color: '#d97706', fontWeight: 'bold' }}>I = V / R</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                  <span style={{ fontWeight: 'bold', color: '#475569' }}>Potencia:</span>
                  <code style={{ fontSize: '1.1rem', color: '#d97706', fontWeight: 'bold' }}>P = V · I</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Cuestionario */}
        <div style={{ backgroundColor: '#f0fdf4', padding: '2rem', borderTop: '2px solid #bbf7d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#15803d', fontSize: '1.5rem' }}>📝 Comprueba tus conocimientos</h3>
            {showResults && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: calculateScore() >= 3 ? '#dcfce7' : '#fee2e2', color: calculateScore() >= 3 ? '#166534' : '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>
                Puntuación: {calculateScore()} / {questions.length}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {questions.map((q) => (
              <div key={q.id} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #86efac', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
                      bgColor = '#dcfce7'; borderColor = '#4ade80';
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
                style={{ padding: '0.75rem 2rem', backgroundColor: Object.keys(answers).length < questions.length ? '#cbd5e1' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer' }}
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
