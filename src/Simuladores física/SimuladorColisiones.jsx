import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [digits, setDigits] = useState(3);
  const [collisions, setCollisions] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [renderState, setRenderState] = useState({ x1: 150, x2: 400 });

  const pRef = useRef({ x1: 150, x2: 400, v1: 0, v2: -2, cols: 0 });
  const frameRef = useRef(null);

  const m1 = 1;
  const m2 = useMemo(() => Math.pow(100, digits - 1), [digits]);
  const b1Size = 60;
  const b2Size = 120;
  const wallX = 0;

  const reset = useCallback((d = digits) => {
    setIsRunning(false);
    setCompleted(false);
    setCollisions(0);
    pRef.current = { x1: 150, x2: 400, v1: 0, v2: -2, cols: 0 };
    setRenderState({ x1: 150, x2: 400 });
  }, [digits]);

  const updatePhysics = useCallback(() => {
    const p = pRef.current;
    let timeRemaining = 1.0; 
    let loopCount = 0;
    
    while (timeRemaining > 0 && loopCount < 5000) {
      loopCount++;
      
      let tWall = Infinity;
      if (p.v1 < -0.000001) {
        tWall = Math.max(0, (wallX - p.x1) / p.v1);
      }

      let tBlock = Infinity;
      if ((p.v1 - p.v2) > 0.000001) {
        tBlock = Math.max(0, (p.x2 - (p.x1 + b1Size)) / (p.v1 - p.v2));
      }

      const tNext = Math.min(tWall, tBlock);

      if (tNext <= timeRemaining) {
        p.x1 += p.v1 * tNext;
        p.x2 += p.v2 * tNext;
        timeRemaining -= tNext;

        if (tWall < tBlock) {
          p.v1 = Math.abs(p.v1); 
          p.x1 = wallX; 
          p.cols++;
        } else {
          const sumM = m1 + m2;
          const newV1 = ((m1 - m2) * p.v1 + 2 * m2 * p.v2) / sumM;
          const newV2 = ((2 * m1 * p.v1) + (m2 - m1) * p.v2) / sumM;
          p.v1 = newV1;
          p.v2 = newV2;
          p.x1 = p.x2 - b1Size; 
          p.cols++;
        }
      } else {
        p.x1 += p.v1 * timeRemaining;
        p.x2 += p.v2 * timeRemaining;
        timeRemaining = 0;
      }
    }

    setCollisions(p.cols);
    setRenderState({ x1: p.x1, x2: p.x2 });

    if (p.v1 >= 0 && p.v2 >= 0 && p.v2 >= p.v1) {
      setCompleted(true);
      setIsRunning(false);
    } else {
      frameRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [m1, m2]);

  useEffect(() => {
    if (isRunning && !completed) {
      frameRef.current = requestAnimationFrame(updatePhysics);
    }
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isRunning, completed, updatePhysics]);

  const handleDigitChange = (d) => {
    setDigits(d);
    reset(d);
  };

  return (
    <div style={{ padding: '2rem', background: '#1e293b', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '100%', maxWidth: '900px', margin: '0 auto', boxSizing: 'border-box' }}>
      <h1 style={{ textAlign: 'center', margin: '0 0 1.5rem 0', fontSize: '2.5rem', color: '#38bdf8' }}>
        Calculando π con Colisiones
      </h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
        {[1, 2, 3, 4, 5].map(d => (
          <button 
            key={d} 
            onClick={() => handleDigitChange(d)} 
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem', background: digits === d ? '#38bdf8' : '#334155', color: digits === d ? '#0f172a' : '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
          >
            {d} Dígito{d > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: '1.5rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Colisiones</div>
        <div style={{ fontSize: '5rem', fontWeight: '900', lineHeight: '1', color: completed ? '#4ade80' : '#f8fafc', textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          {collisions}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '250px', background: '#0f172a', borderBottom: '8px solid #cbd5e1', borderLeft: '8px solid #cbd5e1', overflow: 'hidden', borderRadius: '0 8px 8px 0' }}>
        <div style={{ position: 'absolute', bottom: '0', left: `${renderState.x1}px`, width: `${b1Size}px`, height: `${b1Size}px`, background: '#f472b6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '1.2rem', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.3), 4px 4px 10px rgba(0,0,0,0.5)', zIndex: 2 }}>
          <span>1kg</span>
        </div>
        
        <div style={{ position: 'absolute', bottom: '0', left: `${renderState.x2}px`, width: `${b2Size}px`, height: `${b2Size}px`, background: '#38bdf8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#0f172a', fontSize: '1.5rem', boxShadow: 'inset 0 0 20px rgba(255,255,255,0.2), 4px 4px 15px rgba(0,0,0,0.5)', zIndex: 1 }}>
          <span>{m2.toLocaleString()}kg</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '3rem' }}>
        <button 
          onClick={() => setIsRunning(!isRunning)} 
          disabled={completed} 
          style={{ padding: '1rem 3rem', fontSize: '1.5rem', background: completed ? '#334155' : (isRunning ? '#f59e0b' : '#4ade80'), color: completed ? '#94a3b8' : '#0f172a', border: 'none', borderRadius: '12px', cursor: completed ? 'not-allowed' : 'pointer', fontWeight: 'black', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
        >
          {completed ? 'Completado' : (isRunning ? 'Pausar' : 'Iniciar')}
        </button>
        <button 
          onClick={() => reset()} 
          style={{ padding: '1rem 3rem', fontSize: '1.5rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'black', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
        >
          Reiniciar
        </button>
      </div>
    </div>
  );
};

export default App;
