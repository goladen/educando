import { useState, useEffect } from 'react';

function App() {
  const reactions = [
    { name: "Síntesis del Agua", reactants: ["H₂", "O₂"], products: ["H₂O"], coefficients: [2, 1, 2] },
    { name: "Proceso de Haber (Amoniaco)", reactants: ["N₂", "H₂"], products: ["NH₃"], coefficients: [1, 3, 2] },
    { name: "Síntesis de Cloruro de Sodio", reactants: ["Na", "Cl₂"], products: ["NaCl"], coefficients: [2, 1, 2] },
    { name: "Combustión del Metano", reactants: ["CH₄", "O₂"], products: ["CO₂", "H₂O"], coefficients: [1, 2, 1, 2] },
    { name: "Oxidación de Monóxido de Carbono", reactants: ["CO", "O₂"], products: ["CO₂"], coefficients: [2, 1, 2] },
    { name: "Descomposición del Clorato de Potasio", reactants: ["KClO₃"], products: ["KCl", "O₂"], coefficients: [2, 2, 3] },
    { name: "Oxidación del Magnesio", reactants: ["Mg", "O₂"], products: ["MgO"], coefficients: [2, 1, 2] },
    { name: "Combustión del Propano", reactants: ["C₃H₈", "O₂"], products: ["CO₂", "H₂O"], coefficients: [1, 5, 3, 4] },
    { name: "Hierro y Ácido Sulfúrico", reactants: ["Fe", "H₂SO₄"], products: ["FeSO₄", "H₂"], coefficients: [1, 1, 1, 1] },
    { name: "Ácido Clorhídrico y Aluminio", reactants: ["Al", "HCl"], products: ["AlCl₃", "H₂"], coefficients: [2, 6, 2, 3] },
    { name: "Reducción del Óxido de Hierro (III)", reactants: ["Fe₂O₃", "CO"], products: ["Fe", "CO₂"], coefficients: [1, 3, 2, 3] },
    { name: "Descomposición del Carbonato de Calcio", reactants: ["CaCO₃"], products: ["CaO", "CO₂"], coefficients: [1, 1, 1] },
    { name: "Descomposición del Peróxido de Hidrógeno", reactants: ["H₂O₂"], products: ["H₂O", "O₂"], coefficients: [2, 2, 1] },
    { name: "Zinc y Ácido Clorhídrico", reactants: ["Zn", "HCl"], products: ["ZnCl₂", "H₂"], coefficients: [1, 2, 1, 1] },
    { name: "Formación de Óxido de Hierro (III)", reactants: ["Fe", "O₂"], products: ["Fe₂O₃"], coefficients: [4, 3, 2] },
    { name: "Precipitación de Hidróxido de Cobre (II)", reactants: ["CuSO₄", "NaOH"], products: ["Cu(OH)₂", "Na₂SO₄"], coefficients: [1, 2, 1, 1] },
    { name: "Potasio y Agua", reactants: ["K", "H₂O"], products: ["KOH", "H₂"], coefficients: [2, 2, 2, 1] },
    { name: "Desplazamiento de Bromo por Cloro", reactants: ["Cl₂", "KBr"], products: ["KCl", "Br₂"], coefficients: [1, 2, 2, 1] },
    { name: "Neutralización Ácido-Base", reactants: ["HCl", "NaOH"], products: ["NaCl", "H₂O"], coefficients: [1, 1, 1, 1] },
    { name: "Nitrato de Plata y Cobre", reactants: ["AgNO₃", "Cu"], products: ["Cu(NO₃)₂", "Ag"], coefficients: [2, 1, 1, 2] },
    { name: "Precipitación de Yoduro de Plomo (II)", reactants: ["Pb(NO₃)₂", "KI"], products: ["PbI₂", "KNO₃"], coefficients: [1, 2, 1, 2] },
    { name: "Combustión del Etanol", reactants: ["C₂H₅OH", "O₂"], products: ["CO₂", "H₂O"], coefficients: [1, 3, 2, 3] },
    { name: "Síntesis de Trióxido de Azufre", reactants: ["SO₂", "O₂"], products: ["SO₃"], coefficients: [2, 1, 2] },
    { name: "Formación de Carbonato de Calcio", reactants: ["Ca(OH)₂", "CO₂"], products: ["CaCO₃", "H₂O"], coefficients: [1, 1, 1, 1] },
    { name: "Precipitación de Sulfato de Bario", reactants: ["BaCl₂", "Na₂SO₄"], products: ["BaSO₄", "NaCl"], coefficients: [1, 1, 1, 2] },
    { name: "Desplazamiento de Cobre por Aluminio", reactants: ["Al", "CuSO₄"], products: ["Al₂(SO₄)₃", "Cu"], coefficients: [2, 3, 1, 3] },
    { name: "Oxidación Catalítica del Amoniaco", reactants: ["NH₃", "O₂"], products: ["NO", "H₂O"], coefficients: [4, 5, 4, 6] },
    { name: "Síntesis de Tricloruro de Fósforo", reactants: ["P", "Cl₂"], products: ["PCl₃"], coefficients: [2, 3, 2] },
    { name: "Combustión del Etano", reactants: ["C₂H₆", "O₂"], products: ["CO₂", "H₂O"], coefficients: [2, 7, 4, 6] },
    { name: "Dióxido de Silicio y Ácido Fluorhídrico", reactants: ["SiO₂", "HF"], products: ["SiF₄", "H₂O"], coefficients: [1, 4, 1, 2] }
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const currentReaction = reactions[currentIdx];
  const totalCompounds = currentReaction.reactants.length + currentReaction.products.length;

  const [userCoeffs, setUserCoeffs] = useState(Array(totalCompounds).fill(1));
  const [feedback, setFeedback] = useState(null);
  const [solvedStatus, setSolvedStatus] = useState(Array(reactions.length).fill(false));
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    setUserCoeffs(Array(totalCompounds).fill(1));
    setFeedback(null);
    setShowSolution(false);
  }, [currentIdx, totalCompounds]);

  const handleIncrement = (index) => {
    const updated = [...userCoeffs];
    if (updated[index] < 20) {
      updated[index] += 1;
      setUserCoeffs(updated);
      setFeedback(null);
    }
  };

  const handleDecrement = (index) => {
    const updated = [...userCoeffs];
    if (updated[index] > 1) {
      updated[index] -= 1;
      setUserCoeffs(updated);
      setFeedback(null);
    }
  };

  const checkAnswer = () => {
    const isCorrect = currentReaction.coefficients.every(
      (val, idx) => userCoeffs[idx] === val
    );
    if (isCorrect) {
      setFeedback("correct");
      const updatedSolved = [...solvedStatus];
      updatedSolved[currentIdx] = true;
      setSolvedStatus(updatedSolved);
    } else {
      setFeedback("incorrect");
    }
  };

  const resetCurrent = () => {
    setUserCoeffs(Array(totalCompounds).fill(1));
    setFeedback(null);
    setShowSolution(false);
  };

  const nextReaction = () => {
    if (currentIdx < reactions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const prevReaction = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const countSolved = solvedStatus.filter(Boolean).length;

  const mainContainerStyle = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#111827',
    color: '#f9fafb',
    minHeight: '100vh',
    padding: '30px 20px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '25px',
    width: '100%',
    maxWidth: '1100px'
  };

  const titleStyle = {
    fontSize: '36px',
    fontWeight: '800',
    color: '#38bdf8',
    margin: '0 0 10px 0',
    letterSpacing: '-0.5px'
  };

  const subtitleStyle = {
    fontSize: '18px',
    color: '#9ca3af',
    margin: '0'
  };

  const dashboardStyle = {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '25px',
    width: '100%',
    maxWidth: '1100px',
    alignItems: 'start'
  };

  const panelStyle = {
    backgroundColor: '#1f2937',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    border: '1px solid #374151'
  };

  const gridTitleStyle = {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '15px',
    color: '#e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    maxHeight: '420px',
    overflowY: 'auto',
    paddingRight: '4px'
  };

  const boardStyle = {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: '20px',
    padding: '40px 30px',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05), 0 10px 25px -5px rgba(0, 0, 0, 0.4)',
    border: '4px solid #475569',
    position: 'relative'
  };

  const rxNameStyle = {
    position: 'absolute',
    top: '20px',
    left: '25px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: '30px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const counterBadgeStyle = {
    position: 'absolute',
    top: '20px',
    right: '25px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    padding: '6px 14px',
    borderRadius: '30px',
    fontSize: '14px',
    fontWeight: '700',
    border: '1px solid #e2e8f0'
  };

  const equationContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '30px',
    columnGap: '10px',
    margin: '80px 0 40px 0',
    width: '100%'
  };

  const blockStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const stepperStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: '8px'
  };

  const stepBtnStyle = {
    width: '44px',
    height: '34px',
    fontSize: '18px',
    fontWeight: 'bold',
    backgroundColor: '#e2e8f0',
    border: 'none',
    color: '#1e293b',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    boxShadow: '0 2px 0px #cbd5e1'
  };

  const stepBtnActiveStyle = {
    ...stepBtnStyle,
    transform: 'translateY(2px)',
    boxShadow: 'none'
  };

  const coeffBoxStyle = {
    width: '52px',
    height: '52px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: '800',
    color: '#1e3a8a',
    backgroundColor: '#eff6ff',
    border: '3px solid #3b82f6',
    borderRadius: '12px',
    margin: '4px 0'
  };

  const formulaStyle = {
    fontSize: '38px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: '#0f172a',
    padding: '0 4px'
  };

  const signStyle = {
    fontSize: '34px',
    fontWeight: '600',
    color: '#64748b',
    margin: '0 12px',
    userSelect: 'none'
  };

  const arrowStyle = {
    fontSize: '42px',
    fontWeight: '700',
    color: '#ef4444',
    margin: '0 20px',
    userSelect: 'none'
  };

  const actionAreaStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    width: '100%'
  };

  const btnContainerStyle = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    width: '100%',
    flexWrap: 'wrap'
  };

  const primaryBtnStyle = {
    padding: '12px 28px',
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.2s'
  };

  const secondaryBtnStyle = {
    padding: '12px 24px',
    fontSize: '17px',
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    cursor: 'pointer'
  };

  const navBtnStyle = {
    padding: '12px 20px',
    fontSize: '17px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#475569',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer'
  };

  const alertStyle = {
    width: '100%',
    maxWidth: '600px',
    padding: '14px',
    borderRadius: '12px',
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: '700',
    boxSizing: 'border-box'
  };

  return (
    <div style={mainContainerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>🧪 Pizarra Digital: Ajuste de Reacciones</h1>
        <p style={subtitleStyle}>Interactúa con los controles para equilibrar los reactivos y productos</p>
      </div>

      <div style={dashboardStyle}>
        <div style={panelStyle}>
          <div style={gridTitleStyle}>
            <span>Ejercicios</span>
            <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '13px' }}>
              {countSolved}/30
            </span>
          </div>
          <div style={gridStyle}>
            {reactions.map((_, idx) => {
              let btnBg = '#374151';
              let btnColor = '#9ca3af';
              let border = '1px solid #4b5563';
              
              if (currentIdx === idx) {
                btnBg = '#2563eb';
                btnColor = '#ffffff';
                border = '2px solid #60a5fa';
              } else if (solvedStatus[idx]) {
                btnBg = '#059669';
                btnColor = '#ffffff';
              }

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    border: border,
                    backgroundColor: btnBg,
                    color: btnColor,
                    fontSize: '15px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid #374151', paddingTop: '15px', textAlign: 'center' }}>
            <button
              onClick={() => {
                setSolvedStatus(Array(reactions.length).fill(false));
                setCurrentIdx(0);
                resetCurrent();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              🔄 Reiniciar Todo el Progreso
            </button>
          </div>
        </div>

        <div style={boardStyle}>
          <div style={rxNameStyle}>
            Reacción {currentIdx + 1}: {currentReaction.name}
          </div>
          <div style={counterBadgeStyle}>
            {currentIdx + 1} / 30
          </div>

          <div style={equationContainerStyle}>
            {currentReaction.reactants.map((reactant, i) => (
              <div key={`r-${i}`} style={blockStyle}>
                <div style={stepperStyle}>
                  <button style={stepBtnStyle} onClick={() => handleIncrement(i)}>▲</button>
                  <div style={coeffBoxStyle}>
                    {showSolution ? currentReaction.coefficients[i] : userCoeffs[i]}
                  </div>
                  <button style={stepBtnStyle} onClick={() => handleDecrement(i)}>▼</button>
                </div>
                <span style={formulaStyle}>{reactant}</span>
                {i < currentReaction.reactants.length - 1 && <span style={signStyle}>+</span>}
              </div>
            ))}

            <span style={arrowStyle}>➔</span>

            {currentReaction.products.map((product, i) => {
              const globalIdx = currentReaction.reactants.length + i;
              return (
                <div key={`p-${i}`} style={blockStyle}>
                  <div style={stepperStyle}>
                    <button style={stepBtnStyle} onClick={() => handleIncrement(globalIdx)}>▲</button>
                    <div style={coeffBoxStyle}>
                      {showSolution ? currentReaction.coefficients[globalIdx] : userCoeffs[globalIdx]}
                    </div>
                    <button style={stepBtnStyle} onClick={() => handleDecrement(globalIdx)}>▼</button>
                  </div>
                  <span style={formulaStyle}>{product}</span>
                  {i < currentReaction.products.length - 1 && <span style={signStyle}>+</span>}
                </div>
              );
            })}
          </div>

          <div style={actionAreaStyle}>
            {feedback === "correct" && (
              <div style={{ ...alertStyle, backgroundColor: '#d1fae5', color: '#065f46', border: '2px solid #10b981' }}>
                🎉 ¡Excelente! La ecuación está perfectamente ajustada.
              </div>
            )}
            {feedback === "incorrect" && (
              <div style={{ ...alertStyle, backgroundColor: '#fee2e2', color: '#991b1b', border: '2px solid #ef4444' }}>
                ❌ No está en equilibrio. ¡Revisa el recuento de átomos e inténtalo de nuevo!
              </div>
            )}
            {showSolution && (
              <div style={{ ...alertStyle, backgroundColor: '#fef3c7', color: '#92400e', border: '2px solid #f59e0b' }}>
                👁️ Mostrando la solución correcta del ejercicio.
              </div>
            )}

            <div style={btnContainerStyle}>
              <button style={navBtnStyle} disabled={currentIdx === 0} onClick={prevReaction}>
                ◀ Anterior
              </button>
              
              <button style={secondaryBtnStyle} onClick={resetCurrent}>
                Borrar
              </button>

              <button style={primaryBtnStyle} onClick={checkAnswer}>
                Comprobar Resultado
              </button>

              <button 
                style={{ ...secondaryBtnStyle, backgroundColor: '#fef3c7', color: '#b45309' }} 
                onClick={() => setShowSolution(!showSolution)}
              >
                {showSolution ? "Ocultar Solución" : "Ver Solución"}
              </button>

              <button style={navBtnStyle} disabled={currentIdx === reactions.length - 1} onClick={nextReaction}>
                Siguiente ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
