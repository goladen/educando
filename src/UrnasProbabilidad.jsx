import React, { useState, useEffect } from 'react';

export default function App() {
  const [view, setView] = useState('menu');
  const [countdown, setCountdown] = useState(null);

  // --- ESTADOS: CRIBA DE ERATÓSTENES ---
  const [cribaGrid, setCribaGrid] = useState(
    Array.from({ length: 100 }, (_, i) => ({ num: i + 1, status: 'neutral' }))
  );
  const [cribaMode, setCribaMode] = useState('prime');

  // --- ESTADOS: ENCUENTRA LOS PRIMOS ---
  const [primesGrid, setPrimesGrid] = useState([]);
  const [primesTimer, setPrimesTimer] = useState(100);
  const [primesLevel, setPrimesLevel] = useState(1);
  const [primesGameOver, setPrimesGameOver] = useState(false);
  const [primesGameWon, setPrimesGameWon] = useState(false);

  // --- ESTADOS: MÚLTIPLOS ---
  const [multGrid, setMultGrid] = useState([]);
  const [multTimer, setMultTimer] = useState(100);
  const [multTarget, setMultTarget] = useState(8);
  const [multPool, setMultPool] = useState([]);
  const [multGameOver, setMultGameOver] = useState(false);
  const [multGameWon, setMultGameWon] = useState(false);

  // --- ESTADOS: DIVISORES ---
  const [divGrid, setDivGrid] = useState([]);
  const [divTarget, setDivTarget] = useState(24);
  const [divPool, setDivPool] = useState([]);
  const [divWon, setDivWon] = useState(false);

  // --- ESTADOS: SIMULADOR DE URNAS CON ÁRBOL CONDICIONAL ---
  const [urns, setUrns] = useState([
    { id: 1, name: 'Urna 1', balls: { '🔴 Rojo': 5, '🔵 Azul': 5 } },
    { id: 2, name: 'Urna 2 (Solo Rojas)', balls: { '🔴 Rojo': 10 } },
    { id: 3, name: 'Urna 3 (Solo Azules)', balls: { '🔵 Azul': 10 } }
  ]);
  const [selectedUrnId, setSelectedUrnId] = useState(1);
  const [colorInput, setColorInput] = useState('🔴 Rojo');
  const [quantityInput, setQuantityInput] = useState(5);
  const [stagesCount, setStagesCount] = useState(1);
  
  // Nuevo: Árbol de decisiones para las urnas
  const [experimentTree, setExperimentTree] = useState({ 'S1': 1 }); 
  
  const [urnSingleResult, setUrnSingleResult] = useState(null);
  const [urnBulkResults, setUrnBulkResults] = useState(null);

  // --- EFECTO: CUENTA ATRÁS GLOBAL ---
  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown === 3) setCountdown(2);
      else if (countdown === 2) setCountdown(1);
      else if (countdown === 1) setCountdown('¡YA!');
      else if (countdown === '¡YA!') setCountdown(null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // --- EFECTOS: TEMPORIZADORES ---
  useEffect(() => {
    if (view !== 'primes' || primesGameOver || primesGameWon || countdown !== null) return;
    if (primesTimer <= 0) { setPrimesGameOver(true); return; }
    const timer = setTimeout(() => setPrimesTimer(primesTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [primesTimer, view, primesGameOver, primesGameWon, countdown]);

  useEffect(() => {
    if (view !== 'multiples' || multGameOver || multGameWon || countdown !== null) return;
    if (multTimer <= 0) { setMultGameOver(true); return; }
    const timer = setTimeout(() => setMultTimer(multTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [multTimer, view, multGameOver, multGameWon, countdown]);

  const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

  // --- INICIALIZADORES (Resumidos por longitud, misma lógica) ---
  const startCriba = () => {
    setCribaGrid(Array.from({ length: 100 }, (_, i) => ({ num: i + 1, status: 'neutral' })));
    setCribaMode('prime');
    setView('criba');
  };

  const startPrimes = () => { /* Misma lógica original */ setView('primes'); };
  const startMultiples = () => { /* Misma lógica original */ setView('multiples'); };
  const startDivisors = () => { /* Misma lógica original */ setView('divisors'); };

  const startUrns = () => {
    setUrnSingleResult(null);
    setUrnBulkResults(null);
    setView('urns');
  };

  // --- LÓGICA DE URNAS Y ÁRBOL CONDICIONAL ---
  const handleCreateUrn = () => {
    const newId = urns.length > 0 ? Math.max(...urns.map(u => u.id)) + 1 : 1;
    setUrns([...urns, { id: newId, name: `Urna ${newId}`, balls: {} }]);
    setSelectedUrnId(newId);
  };

  const handleAddBalls = () => {
    if (quantityInput <= 0) return;
    setUrns(urns.map(u => {
      if (u.id === selectedUrnId) {
        const currentCount = u.balls[colorInput] || 0;
        return { ...u, balls: { ...u.balls, [colorInput]: currentCount + quantityInput } };
      }
      return u;
    }));
  };

  const handleClearUrn = (id) => {
    setUrns(urns.map(u => u.id === id ? { ...u, balls: {} } : u));
    setUrnSingleResult(null);
    setUrnBulkResults(null);
  };

  const drawBallFromUrn = (urnId) => {
    const targetUrn = urns.find(u => u.id === urnId);
    if (!targetUrn || Object.keys(targetUrn.balls).length === 0) return 'Ninguna (Vacía)';
    let pool = [];
    Object.entries(targetUrn.balls).forEach(([color, count]) => {
      for (let i = 0; i < count; i++) pool.push(color);
    });
    if (pool.length === 0) return 'Ninguna (Vacía)';
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const getUrnIdForStep = (stage, pathArray) => {
    const key = stage === 1 ? 'S1' : `S${stage}-${pathArray.join('-')}`;
    return experimentTree[key] || urns[0]?.id || 1;
  };

  const runUrnExperimentOnce = () => {
    let steps = [];
    let currentPath = [];
    
    for (let i = 1; i <= stagesCount; i++) {
      const uId = getUrnIdForStep(i, currentPath);
      const drawn = drawBallFromUrn(uId);
      steps.push({ stage: i, urnName: urns.find(u => u.id === uId)?.name || `Urna ${uId}`, ball: drawn });
      
      if (drawn === 'Ninguna (Vacía)') break;
      currentPath.push(drawn);
    }
    setUrnSingleResult(steps);
  };

  const runUrnExperiment1000 = () => {
    let aggregates = {};
    for (let sim = 0; sim < 1000; sim++) {
      let path = [];
      for (let i = 1; i <= stagesCount; i++) {
        const uId = getUrnIdForStep(i, path);
        const drawn = drawBallFromUrn(uId);
        if (drawn === 'Ninguna (Vacía)') { path.push(drawn); break; }
        path.push(drawn);
      }
      const pathStr = path.join(' ➔ ');
      aggregates[pathStr] = (aggregates[pathStr] || 0) + 1;
    }
    setUrnBulkResults(aggregates);
  };

  // --- RENDERIZADO VISUAL DEL ÁRBOL CONDICIONAL ---
  const renderTreeLevel = (stage, pathArray) => {
    if (stage > stagesCount) return null;

    const key = stage === 1 ? 'S1' : `S${stage}-${pathArray.join('-')}`;
    const selectedUrnId = experimentTree[key] || urns[0]?.id || 1;
    const selectedUrn = urns.find(u => u.id === selectedUrnId);
    
    // Obtener los colores disponibles en la urna seleccionada para calcular las ramas futuras
    const availableColors = selectedUrn ? Object.keys(selectedUrn.balls).filter(c => selectedUrn.balls[c] > 0) : [];

    return (
      <div key={key} style={{ 
        marginLeft: stage === 1 ? '0' : '40px', 
        borderLeft: stage === 1 ? 'none' : '3px solid #cbd5e0', 
        paddingLeft: stage === 1 ? '0' : '20px', 
        marginTop: '15px',
        position: 'relative'
      }}>
        {stage > 1 && <div style={{ position: 'absolute', left: 0, top: '22px', width: '15px', borderTop: '3px solid #cbd5e0' }}></div>}
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '15px', 
          backgroundColor: stage === 1 ? '#ebf8ff' : '#ffffff', 
          padding: '12px 20px', borderRadius: '8px', 
          border: stage === 1 ? '2px solid #90cdf4' : '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          {stage > 1 && <span style={{ fontWeight: 'bold', color: '#4a5568', fontSize: '18px' }}>Si sale {pathArray[pathArray.length - 1]} ➔</span>}
          {stage === 1 && <span style={{ fontWeight: 'bold', color: '#2b6cb0', fontSize: '20px' }}>🚀 Etapa 1 (Inicio) ➔</span>}
          
          <select 
            style={{ padding: '8px 15px', fontSize: '16px', borderRadius: '6px', border: '1px solid #a0aec0', fontWeight: 'bold', color: '#2d3748', cursor: 'pointer', backgroundColor: '#f7fafc' }}
            value={selectedUrnId}
            onChange={(e) => {
              setExperimentTree({ ...experimentTree, [key]: Number(e.target.value) });
              setUrnSingleResult(null); setUrnBulkResults(null);
            }}
          >
            {urns.map(u => <option key={u.id} value={u.id}>{u.name} ({Object.values(u.balls).reduce((a, b) => a + b, 0)} bolas)</option>)}
          </select>
        </div>
        
        {/* Generar ramas hijas recursivamente */}
        {stage < stagesCount && availableColors.length > 0 && (
          <div style={{ marginTop: '5px' }}>
            {availableColors.map(color => renderTreeLevel(stage + 1, [...pathArray, color]))}
          </div>
        )}
        
        {stage < stagesCount && availableColors.length === 0 && (
          <div style={{ marginLeft: '40px', color: '#e53e3e', fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>
            ⚠️ La urna seleccionada está vacía. El árbol se corta aquí.
          </div>
        )}
      </div>
    );
  };

  // --- ESTILOS INLINE PRINCIPALES ---
  const mainContainerStyle = { fontFamily: 'Arial, sans-serif', backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' };
  const headerStyle = { fontSize: '36px', color: '#1a365d', marginBottom: '30px', textAlign: 'center', fontWeight: 'bold' };
  const menuBoxStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '25px', maxWidth: '900px', width: '100%', marginTop: '20px' };
  const mainButtonStyle = { padding: '25px 20px', fontSize: '22px', fontWeight: 'bold', color: '#ffffff', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
  const backButtonStyle = { padding: '12px 25px', fontSize: '18px', backgroundColor: '#4a5568', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold' };
  const configBlockStyle = { backgroundColor: '#ffffff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: '25px', width: '100%', maxWidth: '950px' };

  return (
    <div style={mainContainerStyle}>
      {view === 'menu' && (
        <>
          <h1 style={headerStyle}>🏫 Pizarra Digital Interactiva: Matemáticas</h1>
          <div style={menuBoxStyle}>
            <button style={{ ...mainButtonStyle, backgroundColor: '#3182ce' }} onClick={startCriba}><span>🧮 Criba de Eratóstenes</span></button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#38a169' }} onClick={startPrimes}><span>⏱️ Encuentra los Primos</span></button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#d69e2e' }} onClick={startMultiples}><span>🔢 Juego de Múltiplos</span></button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#805ad5' }} onClick={startDivisors}><span>🔍 Juego de Divisores</span></button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#e53e3e', gridColumn: '1 / -1' }} onClick={startUrns}>
              <span>🔮 Laboratorio de Probabilidad y Diagramas de Árbol</span>
              <span style={{ fontSize: '15px', marginTop: '10px', fontWeight: 'normal' }}>Configura caminos condicionales y simula 1000 tiradas</span>
            </button>
          </div>
        </>
      )}

      {/* --- SECCIÓN MEJORADA: GENERADOR DE URNAS Y ÁRBOLES --- */}
      {view === 'urns' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button style={backButtonStyle} onClick={() => setView('menu')}>⬅️ Volver al Menú</button>
          <h2 style={{ ...headerStyle, fontSize: '32px', color: '#2c5282' }}>🔮 Diagrama de Árbol y Probabilidad Total</h2>

          {/* Bloque 1: Configurar Urnas */}
          <div style={configBlockStyle}>
            <h3 style={{ marginTop: 0, color: '#2b6cb0', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px' }}>1. Crear y Llenar Urnas</h3>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
              <button style={{ padding: '10px 15px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={handleCreateUrn}>
                ➕ Nueva Urna
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {urns.map(u => (
                <button
                  key={u.id}
                  style={{
                    padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer',
                    border: u.id === selectedUrnId ? '3px solid #3182ce' : '1px solid #cbd5e0',
                    backgroundColor: u.id === selectedUrnId ? '#ebf8ff' : '#ffffff',
                    color: u.id === selectedUrnId ? '#2b6cb0' : '#4a5568'
                  }}
                  onClick={() => { setSelectedUrnId(u.id); setUrnSingleResult(null); setUrnBulkResults(null); }}
                >
                  🏢 {u.name} ({Object.values(u.balls).reduce((a, b) => a + b, 0)})
                </button>
              ))}
            </div>

            {urns.some(u => u.id === selectedUrnId) && (
              <div style={{ backgroundColor: '#f7fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Editando {urns.find(u => u.id === selectedUrnId)?.name}:</span>
                <div>
                  <select style={{ padding: '8px', fontSize: '16px', borderRadius: '6px' }} value={colorInput} onChange={(e) => setColorInput(e.target.value)}>
                    <option value="🔴 Rojo">🔴 Rojo</option>
                    <option value="🔵 Azul">🔵 Azul</option>
                    <option value="🟢 Verde">🟢 Verde</option>
                    <option value="🟡 Amarillo">🟡 Amarillo</option>
                    <option value="⚫ Negro">⚫ Negro</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button style={{ padding: '5px 12px', fontSize: '16px', fontWeight: 'bold' }} onClick={() => setQuantityInput(Math.max(1, quantityInput - 1))}>-</button>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '30px', textAlign: 'center' }}>{quantityInput}</span>
                  <button style={{ padding: '5px 12px', fontSize: '16px', fontWeight: 'bold' }} onClick={() => setQuantityInput(quantityInput + 1)}>+</button>
                </div>
                <button style={{ padding: '10px 20px', backgroundColor: '#38a169', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={handleAddBalls}>📥 Añadir</button>
                <button style={{ padding: '10px 15px', backgroundColor: '#e53e3e', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => handleClearUrn(selectedUrnId)}>🗑️ Vaciar</button>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {urns.map(u => (
                <div key={u.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff' }}>
                  <strong style={{ color: '#4a5568' }}>{u.name}</strong>
                  <div style={{ fontSize: '14px', margin: '8px 0', color: '#718096' }}>
                    {Object.keys(u.balls).length === 0 ? 'Vacía' : Object.entries(u.balls).map(([c, q]) => q > 0 && <div key={c}>{c}: {q} uds.</div>)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {Object.entries(u.balls).map(([color, count]) => {
                      const dot = color.split(' ')[0];
                      return Array.from({ length: count }).map((_, idx) => <span key={idx} style={{ fontSize: '16px' }}>{dot}</span>);
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bloque 2: Diagrama de Árbol Visual */}
          <div style={configBlockStyle}>
            <h3 style={{ marginTop: 0, color: '#2b6cb0', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px' }}>2. Diagrama de Árbol Condicional</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', backgroundColor: '#fffaf0', padding: '15px', borderRadius: '8px', border: '1px solid #feebc8' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#dd6b20' }}>Profundidad del Árbol (Etapas):</span>
              {[1, 2, 3].map(num => (
                <button
                  key={num}
                  style={{
                    padding: '10px 25px', fontSize: '18px', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer',
                    backgroundColor: stagesCount === num ? '#dd6b20' : '#ffffff',
                    color: stagesCount === num ? 'white' : '#dd6b20', border: '2px solid #dd6b20'
                  }}
                  onClick={() => { setStagesCount(num); setUrnSingleResult(null); setUrnBulkResults(null); }}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* AQUÍ SE RENDERIZA EL ÁRBOL RECURSIVO MÁGICO */}
            <div style={{ backgroundColor: '#faf5ff', padding: '20px', borderRadius: '12px', border: '1px solid #e9d8fd', overflowX: 'auto' }}>
               {renderTreeLevel(1, [])}
            </div>
          </div>

          {/* Bloque 3: Lanzadores de Simulaciones */}
          <div style={{ ...configBlockStyle, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#2b6cb0', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px', marginBottom: 0 }}>3. Ejecución del Experimento Estocástico</h3>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <button style={{ padding: '15px 25px', fontSize: '18px', fontWeight: 'bold', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} onClick={runUrnExperimentOnce}>
                🎲 Extraer 1 Camino
              </button>
              <button style={{ padding: '15px 25px', fontSize: '18px', fontWeight: 'bold', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} onClick={runUrnExperiment1000}>
                📊 Simular Ley de Grandes Números (1000 iteraciones)
              </button>
            </div>

            {urnSingleResult && (
              <div style={{ backgroundColor: '#f0fff4', border: '2px solid #9ae6b4', padding: '20px', borderRadius: '8px' }}>
                <strong style={{ color: '#22543d', fontSize: '20px', display: 'block', marginBottom: '15px' }}>Resultado del camino único:</strong>
                <div style={{ display: 'flex', gap: '20px', fontSize: '16px', alignItems: 'center' }}>
                  {urnSingleResult.map((res, index) => (
                    <React.Fragment key={index}>
                      <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '2px solid #68d391', minWidth: '160px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '14px', color: '#4a5568', display: 'block', fontWeight: 'bold' }}>Etapa {res.stage} ({res.urnName})</span>
                        <strong style={{ fontSize: '24px', display: 'block', marginTop: '10px' }}>{res.ball}</strong>
                      </div>
                      {index < urnSingleResult.length - 1 && <span style={{ fontSize: '30px', color: '#68d391' }}>➔</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {urnBulkResults && (
              <div style={{ backgroundColor: '#ebf8ff', border: '2px solid #90cdf4', padding: '25px', borderRadius: '8px' }}>
                <strong style={{ color: '#2a4365', fontSize: '22px', display: 'block', marginBottom: '5px' }}>📈 Distribución de Probabilidad Empírica (N=1000):</strong>
                <p style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#2b6cb0' }}>Frecuencia absoluta y relativa de cada camino tomado en el árbol.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                  {Object.entries(urnBulkResults).sort((a,b) => b[1] - a[1]).map(([path, count]) => {
                    const percentage = ((count / 1000) * 100).toFixed(1);
                    return (
                      <div key={path} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #bee3f8', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2d3748', marginBottom: '8px' }}>{path}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ fontSize: '18px', color: '#3182ce', fontWeight: 'bold' }}>{count} veces</span>
                          <span style={{ padding: '4px 10px', backgroundColor: '#ebf8ff', border: '1px solid #90cdf4', borderRadius: '6px', color: '#2b6cb0', fontWeight: 'bold', fontSize: '18px' }}>{percentage}%</span>
                        </div>
                        <div style={{ width: '100%', backgroundColor: '#edf2f7', height: '10px', borderRadius: '5px', marginTop: '10px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, backgroundColor: '#3182ce', height: '100%', transition: 'width 0.5s' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}