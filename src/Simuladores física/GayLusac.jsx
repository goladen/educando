import { useState, useEffect, useRef } from 'react';

export default function GayLusac() {
  const [tempC, setTempC] = useState(10);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const canvasRef = useRef(null);
  
  // Constantes de la Ley de Gay-Lussac (Volumen constante)
  const T1_K = 10 + 273.15; // 283.15 K
  const P_atm = 760;
  const P1_man = 950;
  const P1_abs = P_atm + P1_man; // 1710 mm Hg

  // Cálculos dinámicos
  const T_K = tempC + 273.15;
  const P_abs = P1_abs * (T_K / T1_K);
  const P_man = P_abs - P_atm;

  // Ref para mantener la temperatura actualizada en el loop de animación sin reiniciarlo
  const tempKRef = useRef(T_K);
  useEffect(() => {
    tempKRef.current = T_K;
  }, [T_K]);

  // Estado inicial de las partículas ajustado para el tamaño del canvas (240x170)
  const particlesRef = useRef(
    Array.from({ length: 15 }, () => ({
      x: Math.random() * 200 + 20,
      y: Math.random() * 130 + 20,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
    }))
  );

  // Loop de animación único
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const particles = particlesRef.current;
    let animationId;

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      
      // La velocidad se ajusta dinámicamente basándose en la raíz cuadrada de la temperatura (Energía Cinética)
      const currentTK = tempKRef.current;
      const speedMult = Math.sqrt(currentTK / T1_K);

      particles.forEach((p) => {
        // Movimiento continuo que reacciona instantáneamente a speedMult
        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;

        // Rebotes
        if (p.x <= 8 || p.x >= w - 8) p.vx *= -1;
        if (p.y <= 8 || p.y >= h - 8) p.vy *= -1;

        // Límites de seguridad
        p.x = Math.max(8, Math.min(w - 8, p.x));
        p.y = Math.max(8, Math.min(h - 8, p.y));

        // Dibujar estelas basadas en la velocidad real actual
        const tailLength = speedMult * 5;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const nx = -p.vy / speed;
        const ny = p.vx / speed;
        const offset = 2.5;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * tailLength, p.y - p.vy * tailLength);
        ctx.moveTo(p.x + nx * offset, p.y + ny * offset);
        ctx.lineTo(p.x + nx * offset - p.vx * tailLength * 0.8, p.y + ny * offset - p.vy * tailLength * 0.8);
        ctx.moveTo(p.x - nx * offset, p.y - ny * offset);
        ctx.lineTo(p.x - nx * offset - p.vx * tailLength * 0.8, p.y - ny * offset - p.vy * tailLength * 0.8);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Dibujar partícula
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a5d4';
        ctx.fill();
        ctx.strokeStyle = '#6a3b77';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, []); // Dependencias vacías: el loop nunca se corta, la velocidad se actualiza vía tempKRef

  const handlePressureChange = (newPMan) => {
    // Si el usuario cambia la presión, calculamos qué temperatura le corresponde (Ley de Gay-Lussac inversa)
    const newPAbs = newPMan + P_atm;
    const newTK = newPAbs * (T1_K / P1_abs);
    let newTempC = Math.round(newTK - 273.15);
    
    // Limitar para que el control de temperatura no se rompa (mantener entre 0 y 100°C visualmente, o permitir más rango si se quiere)
    if (newTempC < 0) newTempC = 0;
    if (newTempC > 100) newTempC = 100;
    
    setTempC(newTempC);
  };

  const numArrows = tempC < 30 ? 1 : tempC < 70 ? 2 : 3;

  const questions = [
    // Teoría
    {
      q: "¿Qué magnitud termodinámica se mantiene constante en la Ley de Gay-Lussac?",
      options: ["La presión", "La temperatura", "La energía cinética", "La masa y el volumen"],
      ans: 3
    },
    {
      q: "Según el simulador, al aumentar la temperatura, ¿qué ocurre con las partículas del gas?",
      options: ["Disminuyen su velocidad", "Se vuelven más pesadas", "Aumentan su energía cinética y velocidad", "Se escapan del recipiente"],
      ans: 2
    },
    {
      q: "¿En qué escala se debe expresar siempre la temperatura para aplicar las leyes de los gases?",
      options: ["Celsius (°C)", "Fahrenheit (°F)", "Kelvin (K)", "Rankine (R)"],
      ans: 2
    },
    {
      q: "Al aumentar la temperatura en un volumen fijo, la presión interna aumenta porque...",
      options: ["Las partículas se dilatan", "Las partículas chocan con más fuerza y frecuencia contra las paredes", "Se generan nuevas partículas", "El recipiente se encoge"],
      ans: 1
    },
    {
      q: "¿Cuál es la expresión matemática que define la Ley de Gay-Lussac?",
      options: ["P₁ · V₁ = P₂ · V₂", "V₁ / T₁ = V₂ / T₂", "P₁ / T₁ = P₂ / T₂", "P = V · T"],
      ans: 2
    },
    {
      q: "Si la temperatura absoluta (K) de un gas se duplica manteniendo su volumen constante, su presión:",
      options: ["Se reduce a la mitad", "Se mantiene constante", "Se cuadruplica", "Se duplica"],
      ans: 3
    },
    {
      q: "¿Por qué el émbolo no sube cuando aumenta la presión interior en este experimento?",
      options: ["Porque el gas pierde fuerza al calentarse", "Porque el volumen es constante y la fuerza externa contrarresta la presión interna", "Porque está pegado con pegamento", "Porque la masa del gas disminuye"],
      ans: 1
    },
    // Casos reales de cálculo (Nuevas 10 preguntas + 3 anteriores adaptadas)
    {
      q: "CASO 1: Un neumático de coche tiene una presión de 2.0 atm a 20°C (293 K). Si después de un viaje la temperatura sube a 50°C (323 K), ¿cuál es la nueva presión suponiendo volumen constante?",
      options: ["2.2 atm", "3.5 atm", "1.8 atm", "4.0 atm"],
      ans: 0
    },
    {
      q: "CASO 2: Una lata de aerosol vacía a 25°C (298 K) y 1 atm se arroja al fuego (¡peligroso!). Si la lata puede soportar hasta 3 atm antes de explotar, ¿a qué temperatura estallará?",
      options: ["150°C", "300°C", "621°C (894 K)", "894°C"],
      ans: 2
    },
    {
      q: "CASO 3: Un tanque de oxígeno de buceo está a 200 bar y 15°C (288 K). Si se deja al sol y se calienta a 40°C (313 K), ¿qué presión alcanzará?",
      options: ["200.0 bar", "217.3 bar", "250.5 bar", "180.2 bar"],
      ans: 1
    },
    {
      q: "CASO 4: Un cilindro de gas a 300 K tiene una presión de 1.5 atm. Se enfría hasta que la presión desciende a 1.0 atm. ¿Cuál es la temperatura final?",
      options: ["150 K", "200 K", "450 K", "100 K"],
      ans: 1
    },
    {
      q: "CASO 5: En un laboratorio, un recipiente cerrado contiene nitrógeno a 100 kPa y 27°C (300 K). Se requiere aumentar su presión a 150 kPa. ¿A qué temperatura en °C debe calentarse?",
      options: ["177°C (450 K)", "450°C", "40°C", "250°C"],
      ans: 0
    },
    {
      q: "CASO 6: Una olla a presión de paredes rígidas se cierra a 20°C (293 K) y 1 atm. Durante la cocción alcanza los 120°C (393 K). ¿Cuál es la presión en su interior?",
      options: ["1.34 atm", "2.00 atm", "1.00 atm", "6.00 atm"],
      ans: 0
    },
    {
      q: "CASO 7: Un extintor de CO₂ marca 50 atm a 22°C (295 K). En invierno se deja a la intemperie a -5°C (268 K). ¿Qué presión marcará el manómetro?",
      options: ["45.4 atm", "50.0 atm", "55.2 atm", "40.1 atm"],
      ans: 0
    },
    {
      q: "CASO 8: Un neumático de avión se infla a 15 atm a 15°C (288 K) en la pista. A altitud de crucero, la temperatura es de -40°C (233 K). ¿Cuál será la presión del neumático a esa altura?",
      options: ["12.1 atm", "18.2 atm", "15.0 atm", "8.5 atm"],
      ans: 0
    },
    {
      q: "CASO 9: Una bombona de gas industrial a 25°C (298 K) tiene una presión de 2.5 atm. Si hay riesgo crítico de fractura del metal a las 8 atm, ¿a qué temperatura absoluta (K) estallaría?",
      options: ["953.6 K", "300.0 K", "500.0 K", "1200.5 K"],
      ans: 0
    },
    {
      q: "CASO 10: Un matraz sellado contiene helio a 300 mm Hg y 10°C (283 K). Se enfría sumergiéndolo en nitrógeno líquido hasta que la presión cae a 50 mm Hg. ¿Cuál es su temperatura final?",
      options: ["47.1 K", "100.0 K", "273.1 K", "0 K"],
      ans: 0
    }
  ];

  const handleOptionSelect = (qIndex, oIndex) => {
    if (score !== null) return;
    setAnswers({ ...answers, [qIndex]: oIndex });
  };

  const calculateScore = () => {
    let s = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.ans) s++;
    });
    setScore(s);
  };

  // Límites para el slider de presión (basados en 0°C a 100°C)
  const pManMin = Math.round(P1_abs * (273.15 / T1_K) - P_atm); // ~889
  const pManMax = Math.round(P1_abs * (373.15 / T1_K) - P_atm); // ~1493

  return (
    <div style={{ fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '3vw', backgroundColor: '#f0f4f8', color: '#333', boxSizing: 'border-box' }}>
      <h1 style={{ textAlign: 'center', color: '#1a365d', marginBottom: '25px', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', padding: '0 10px' }}>
        Simulador: Ley de Gay-Lussac
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        
        {/* Visualizador (Cilindro y Termómetro) */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', padding: '20px 10px', backgroundColor: '#fff', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flex: '1 1 100%', justifyContent: 'center', boxSizing: 'border-box' }}>
          
          {/* Termómetro */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#555' }}>{tempC}°C</div>
            <div style={{ width: '12px', height: '180px', border: '2px solid #777', borderBottom: 'none', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', backgroundColor: '#fdfdfd', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${Math.max(5, (tempC / 100) * 100)}%`, backgroundColor: '#dc2626', transition: 'height 0.1s linear' }} />
            </div>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#dc2626', border: '2px solid #777', marginTop: '-6px', zIndex: 1, boxShadow: 'inset -3px -3px 6px rgba(0,0,0,0.3)' }} />
          </div>

          {/* Cilindro con Embolo y Partículas */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#555', textAlign: 'center' }}>
              P<sub>atm</sub> = {P_atm} <span style={{fontSize: '0.8em'}}>mm Hg</span>
            </div>
            
            <div style={{ width: '240px', height: '250px', border: '3px solid #306399', backgroundColor: '#c7efff', position: 'relative', borderTop: 'none', borderRadius: '0 0 15px 15px', overflow: 'hidden' }}>
              
              {/* Flechas de fuerza */}
              <div style={{ position: 'absolute', top: '5px', left: 0, width: '100%', height: '55px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '15px', transition: 'all 0.3s' }}>
                {Array.from({ length: numArrows }).map((_, i) => (
                  <svg key={i} width="25" height="55" viewBox="0 0 40 80" style={{ filter: 'drop-shadow(1px 2px 1px rgba(0,0,0,0.2))' }}>
                    <path d="M10,0 L30,0 L30,50 L40,50 L20,80 L0,50 L10,50 Z" fill="#ffe099" stroke="#ccaa66" strokeWidth="2"/>
                  </svg>
                ))}
              </div>

              {/* Émbolo */}
              <div style={{ position: 'absolute', top: '65px', left: 0, width: '100%', height: '15px', backgroundColor: '#ffcc99', borderTop: '2px solid #d38b55', borderBottom: '2px solid #d38b55', zIndex: 10 }} />

              {/* Contenedor de Gas */}
              <canvas ref={canvasRef} width={240} height={170} style={{ position: 'absolute', top: '80px', left: 0 }} />
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px', fontWeight: 'bold', fontSize: 'clamp(1rem, 4vw, 1.2rem)', color: '#1a365d' }}>
              P<sub>man</sub> = {Math.round(P_man)} <span style={{fontSize: '0.8em'}}>mm Hg</span>
            </div>
          </div>
        </div>

        {/* Panel de Control */}
        <div style={{ flex: '1 1 100%', padding: '20px', backgroundColor: '#fff', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
          <h2 style={{ marginTop: 0, color: '#2b6cb0', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>Variables Vinculadas</h2>
          
          {/* Slider de Temperatura */}
          <div style={{ margin: '20px 0' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontWeight: 'bold', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)' }}>
              <span>Ajustar Temperatura:</span>
              <span style={{ color: '#e53e3e' }}>{tempC} °C</span>
            </label>
            <input 
              type="range" min="0" max="100" value={tempC} 
              onChange={e => setTempC(Number(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer', height: '12px', accentColor: '#e53e3e', padding: '10px 0' }} 
            />
          </div>

          {/* Slider de Presión */}
          <div style={{ margin: '20px 0 30px 0' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontWeight: 'bold', fontSize: 'clamp(1rem, 3.5vw, 1.1rem)' }}>
              <span>Ajustar Presión (P<sub>man</sub>):</span>
              <span style={{ color: '#2b6cb0' }}>{Math.round(P_man)} mm Hg</span>
            </label>
            <input 
              type="range" min={pManMin} max={pManMax} value={Math.round(P_man)} 
              onChange={e => handlePressureChange(Number(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer', height: '12px', accentColor: '#2b6cb0', padding: '10px 0' }} 
            />
          </div>

          <div style={{ backgroundColor: '#f7fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 'clamp(0.9rem, 3.5vw, 1rem)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #edf2f7' }}>
              <span>Temp. Absoluta (T):</span>
              <strong>{Math.round(T_K)} K</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #edf2f7' }}>
              <span>P. Atmosférica:</span>
              <strong>{P_atm} <span style={{fontSize:'0.8em'}}>mmHg</span></strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px 0', fontSize: '1.1em', color: '#c53030' }}>
              <span>P. Absoluta Total:</span>
              <strong>{Math.round(P_abs)} <span style={{fontSize:'0.8em'}}>mmHg</span></strong>
            </div>
          </div>
          
          <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#ebf8ff', color: '#2b6cb0', borderRadius: '8px', fontSize: 'clamp(0.85rem, 3vw, 0.95rem)', lineHeight: '1.4' }}>
            Al modificar la presión en el panel, la temperatura se ajusta automáticamente para mantener el volumen constante (P₁/T₁ = P₂/T₂).
          </div>
        </div>
      </div>

      {/* Cuestionario Extendido */}
      <div style={{ marginTop: '30px', padding: '25px 15px', backgroundColor: '#fff', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: '#2c3e50', borderBottom: '3px solid #3182ce', paddingBottom: '10px', fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', marginTop: 0 }}>
          Test Práctico: Casos Reales y Teoría ({questions.length} Preguntas)
        </h2>
        
        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.ans;
            const showFeedback = score !== null;
            
            return (
              <div key={i} style={{ padding: '15px', backgroundColor: showFeedback ? (isCorrect ? '#f0fff4' : '#fff5f5') : '#f8fafc', borderRadius: '10px', border: `1px solid ${showFeedback ? (isCorrect ? '#9ae6b4' : '#feb2b2') : '#e2e8f0'}` }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 15px 0', fontSize: 'clamp(1rem, 4vw, 1.1rem)', color: '#2d3748', lineHeight: '1.4' }}>
                  {i + 1}. {q.q}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.options.map((opt, optIdx) => (
                    <label key={optIdx} style={{ display: 'flex', alignItems: 'flex-start', cursor: showFeedback ? 'default' : 'pointer', padding: '10px 8px', borderRadius: '6px', transition: 'background-color 0.2s', backgroundColor: answers[i] === optIdx ? '#ebf8ff' : 'transparent', touchAction: 'manipulation' }}>
                      <input 
                        type="radio" 
                        name={`q-${i}`} 
                        checked={answers[i] === optIdx} 
                        onChange={() => handleOptionSelect(i, optIdx)} 
                        disabled={showFeedback} 
                        style={{ marginRight: '12px', marginTop: '2px', transform: 'scale(1.2)', accentColor: '#3182ce', flexShrink: 0 }} 
                      />
                      <span style={{ fontSize: 'clamp(0.9rem, 3.5vw, 1rem)', lineHeight: '1.3' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          {score === null ? (
            <button 
              onClick={calculateScore} 
              disabled={Object.keys(answers).length < questions.length}
              style={{ width: '100%', maxWidth: '300px', padding: '15px', backgroundColor: Object.keys(answers).length < questions.length ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none', borderRadius: '8px', fontSize: 'clamp(1rem, 4vw, 1.1rem)', cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'background-color 0.3s' }}
            >
              Comprobar Respuestas
            </button>
          ) : (
            <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: score >= 10 ? '#f0fff4' : '#fff5f5', border: `2px solid ${score >= 10 ? '#48bb78' : '#f56565'}`, width: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 'clamp(1.2rem, 5vw, 1.5rem)', fontWeight: 'bold', color: score >= 10 ? '#2f855a' : '#c53030' }}>
                Puntuación: {score} / {questions.length}
              </div>
              <button 
                onClick={() => { setScore(null); setAnswers({}); }} 
                style={{ marginTop: '15px', width: '100%', maxWidth: '200px', padding: '12px', backgroundColor: '#e2e8f0', color: '#4a5568', border: 'none', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}