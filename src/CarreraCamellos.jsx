function App() {
  // Estados principales del juego
  const [tokens, setTokens] = useState([]);
  const [dice, setDice] = useState([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [winners, setWinners] = useState([]);

  // Estados del formulario para añadir fichas
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#ef4444');
  const [formRow, setFormRow] = useState(7);

  // Sistema de lanzamiento con simulación de giro rápido
  const handleRoll = () => {
    if (winners.length > 0 || isRolling) return;
    setIsRolling(true);

    let iterations = 0;
    const intervalId = setInterval(() => {
      const rand1 = Math.floor(Math.random() * 6) + 1;
      const rand2 = Math.floor(Math.random() * 6) + 1;
      setDice([rand1, rand2]);
      iterations++;

      if (iterations >= 12) {
        clearInterval(intervalId);

        // Valores finales oficiales de los dados
        const final1 = Math.floor(Math.random() * 6) + 1;
        const final2 = Math.floor(Math.random() * 6) + 1;
        const totalSum = final1 + final2;

        setDice([final1, final2]);

        // Mover fichas aplicables y verificar ganadores de forma atómica
        setTokens((prevTokens) => {
          const updatedTokens = prevTokens.map((token) => {
            if (token.row === totalSum && token.position < 5) {
              return { ...token, position: token.position + 1 };
            }
            return token;
          });

          // Filtrar si alguna ficha ha alcanzado la casilla de meta (posición 5)
          const currentWinners = updatedTokens.filter((t) => t.position === 5);
          if (currentWinners.length > 0) {
            setWinners(currentWinners);
          }

          return updatedTokens;
        });

        setIsRolling(false);
      }
    }, 60);
  };

  // Agregar una nueva ficha al tablero (Posición inicial 0)
  const handleAddToken = (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newToken = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      name: formName.trim().substring(0, 3).toUpperCase(),
      color: formColor,
      row: parseInt(formRow, 10),
      position: 0,
    };

    setTokens([...tokens, newToken]);
    setFormName('');
  };

  // Reiniciar por completo el estado del juego
  const handleReset = () => {
    setTokens([]);
    setDice([1, 1]);
    setWinners([]);
    setIsRolling(false);
    setFormName('');
  };

  const currentTotal = dice[0] + dice[1];

  // Paleta de Estilos Inline Estrictos optimizados para pantallas táctiles de gran formato
  const styles = {
    container: {
      fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      padding: '24px',
      maxWidth: '1300px',
      margin: '0 auto',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      minHeight: '100vh',
    },
    header: {
      textAlign: 'center',
      fontSize: '36px',
      fontWeight: '800',
      marginBottom: '24px',
      color: '#1e3a8a',
    },
    winnerBanner: {
      backgroundColor: '#fef08a',
      border: '4px solid #eab308',
      borderRadius: '16px',
      padding: '24px',
      textAlign: 'center',
      marginBottom: '24px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    winnerTitle: {
      fontSize: '32px',
      fontWeight: '900',
      color: '#854d0e',
      margin: '0 0 12px 0',
    },
    winnerBadgesContainer: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    winnerBadge: {
      color: '#ffffff',
      padding: '8px 20px',
      borderRadius: '9999px',
      fontWeight: 'bold',
      fontSize: '20px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
    },
    dashboard: {
      display: 'flex',
      gap: '24px',
      marginBottom: '32px',
      flexWrap: 'wrap',
    },
    panel: {
      flex: '1',
      minWidth: '320px',
      backgroundColor: '#ffffff',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      border: '1px solid #e2e8f0',
    },
    panelTitle: {
      fontSize: '20px',
      fontWeight: '700',
      marginBottom: '16px',
      color: '#334155',
      borderBottom: '2px solid #f1f5f9',
      paddingBottom: '8px',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    label: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#475569',
    },
    input: {
      padding: '12px 16px',
      fontSize: '18px',
      borderRadius: '10px',
      border: '2px solid #cbd5e1',
      backgroundColor: '#fff',
      outline: 'none',
    },
    colorPicker: {
      padding: '4px',
      height: '50px',
      width: '100%',
      borderRadius: '10px',
      border: '2px solid #cbd5e1',
      cursor: 'pointer',
      backgroundColor: '#fff',
    },
    select: {
      padding: '12px 16px',
      fontSize: '18px',
      borderRadius: '10px',
      border: '2px solid #cbd5e1',
      backgroundColor: '#fff',
      cursor: 'pointer',
    },
    btnSuccess: {
      padding: '14px 20px',
      fontSize: '18px',
      fontWeight: '700',
      color: '#ffffff',
      backgroundColor: '#10b981',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
    },
    diceSection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      margin: '16px 0',
    },
    dieCube: {
      width: '75px',
      height: '75px',
      backgroundColor: '#ffffff',
      border: '4px solid #1e293b',
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '36px',
      fontWeight: '800',
      color: '#1e293b',
      boxShadow: '0 6px 8px rgba(0,0,0,0.06)',
    },
    sumBadge: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#eff6ff',
      border: '2px solid #bfdbfe',
      borderRadius: '16px',
      padding: '10px 20px',
      minWidth: '100px',
    },
    actionButtonsContainer: {
      display: 'flex',
      gap: '14px',
      width: '100%',
      marginTop: '12px',
    },
    btnPrimary: {
      padding: '18px 24px',
      fontSize: '22px',
      fontWeight: '800',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)',
      flex: '2',
    },
    btnDanger: {
      padding: '18px 24px',
      fontSize: '18px',
      fontWeight: '700',
      color: '#ffffff',
      backgroundColor: '#ef4444',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      flex: '1',
      boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)',
    },
    board: {
      backgroundColor: '#ffffff',
      padding: '20px',
      borderRadius: '16px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    boardRow: {
      display: 'flex',
      alignItems: 'stretch',
      minHeight: '65px',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    },
    rowIndicator: {
      width: '70px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: '800',
      borderRight: '2px solid #cbd5e1',
      userSelect: 'none',
    },
    trackCellsContainer: {
      display: 'flex',
      flex: '1',
    },
    trackCell: {
      flex: '1',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px',
      gap: '6px',
      flexWrap: 'wrap',
      minWidth: '80px',
    },
    cellWatermark: {
      position: 'absolute',
      fontSize: '13px',
      fontWeight: '700',
      color: '#e2e8f0',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: '1',
    },
    tokensFlexWrapper: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      zIndex: '2',
    },
    tokenCircle: {
      width: '38px',
      height: '38px',
      borderRadius: '50%',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: '800',
      border: '2px solid #ffffff',
      boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
      textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
      textTransform: 'uppercase',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🎲 Gran Carrera de Dados y Probabilidad 🐪</h1>

      {/* Banner de Celebración de Ganadores */}
      {winners.length > 0 && (
        <div style={styles.winnerBanner}>
          <h2 style={styles.winnerTitle}>🏁 ¡TENEMOS GANADOR EN LA CLASE! 🏁</h2>
          <div style={styles.winnerBadgesContainer}>
            {winners.map((winner) => (
              <span key={winner.id} style={{ ...styles.winnerBadge, backgroundColor: winner.color }}>
                {winner.name} (Fila {winner.row})
              </span>
            ))}
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: '18px', color: '#475569', fontWeight: '600' }}>
            Haz clic en "Reiniciar Juego" para limpiar la pizarra interactiva.
          </p>
        </div>
      )}

      {/* Cuadro de mandos superior */}
      <div style={styles.dashboard}>
        {/* Panel de Configuración de Alumnos / Fichas */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>👥 Gestión de Fichas (Alumnos)</h2>
          <form onSubmit={handleAddToken} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nombre o Siglas (Máx. 3 caracteres)</label>
              <input
                type="text"
                maxLength={3}
                placeholder="Ej. MAT"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={styles.input}
                disabled={winners.length > 0}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Color identificativo</label>
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                style={styles.colorPicker}
                disabled={winners.length > 0}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Fila asignada del Tablero</label>
              <select
                value={formRow}
                onChange={(e) => setFormRow(parseInt(e.target.value, 10))}
                style={styles.select}
                disabled={winners.length > 0}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Fila {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={winners.length > 0 || !formName.trim()}
              style={{
                ...styles.btnSuccess,
                opacity: winners.length > 0 || !formName.trim() ? 0.5 : 1,
                cursor: winners.length > 0 || !formName.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              ➕ Añadir Ficha a la Salida
            </button>
          </form>
        </div>

        {/* Panel Central de Control de Lanzamientos */}
        <div style={{ ...styles.panel, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={styles.panelTitle}>🎲 Lanzamiento de Dados Activo</h2>
            <div style={styles.diceSection}>
              <div style={styles.dieCube}>{dice[0]}</div>
              <div style={styles.dieCube}>{dice[1]}</div>
              <div style={styles.sumBadge}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', uppercase: 'true' }}>SUMA</span>
                <span style={{ fontSize: '42px', fontWeight: '900', color: '#1d4ed8' }}>{currentTotal}</span>
              </div>
            </div>
          </div>

          <div style={styles.actionButtonsContainer}>
            <button
              onClick={handleRoll}
              disabled={isRolling || winners.length > 0}
              style={{
                ...styles.btnPrimary,
                backgroundColor: isRolling ? '#94a3b8' : winners.length > 0 ? '#cbd5e1' : '#2563eb',
                cursor: isRolling || winners.length > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isRolling ? '🎰 Agitando...' : '🎲 Tirar Dados'}
            </button>

            <button onClick={handleReset} style={styles.btnDanger}>
              🔄 Reiniciar
            </button>
          </div>
        </div>
      </div>

      {/* El Tablero de Juego Completo (Filas 1 a 12) */}
      <div style={styles.board}>
        {[...Array(12)].map((_, index) => {
          const currentRowNum = index + 1;
          const isRowTargeted = currentTotal === currentRowNum && !isRolling;

          return (
            <div
              key={currentRowNum}
              style={{
                ...styles.boardRow,
                backgroundColor: isRowTargeted ? '#fef08a' : '#ffffff',
                border: isRowTargeted ? '2px solid #eab308' : '1px solid #e2e8f0',
              }}
            >
              {/* Indicador del Número de la Fila */}
              <div
                style={{
                  ...styles.rowIndicator,
                  backgroundColor: isRowTargeted ? '#fde047' : '#f1f5f9',
                  color: isRowTargeted ? '#854d0e' : '#334155',
                }}
              >
                {currentRowNum}
              </div>

              {/* Carriles o Casillas de Posición (0 a 5) */}
              <div style={styles.trackCellsContainer}>
                {[0, 1, 2, 3, 4, 5].map((posIndex) => {
                  const filteredTokens = tokens.filter((t) => t.row === currentRowNum && t.position === posIndex);
                  const isMetaCell = posIndex === 5;
                  const isStartCell = posIndex === 0;

                  return (
                    <div
                      key={posIndex}
                      style={{
                        ...styles.trackCell,
                        backgroundColor: isMetaCell ? '#f0fdf4' : isStartCell ? '#fafafa' : 'transparent',
                        borderRight: isMetaCell ? 'none' : '1px dashed #cbd5e1',
                        borderLeft: isMetaCell ? '4px solid #22c55e' : 'none',
                      }}
                    >
                      {/* Marca de agua de posición de fondo */}
                      <span
                        style={{
                          ...styles.cellWatermark,
                          color: isMetaCell ? '#bbf7d0' : isRowTargeted ? '#fef08a' : '#f1f5f9',
                          fontSize: isMetaCell ? '14px' : '18px',
                        }}
                      >
                        {isStartCell ? 'Salida' : isMetaCell ? '🏁 META' : posIndex}
                      </span>

                      {/* Contenedor flexible interno para múltiples fichas simultáneas */}
                      <div style={styles.tokensFlexWrapper}>
                        {filteredTokens.map((token) => (
                          <div
                            key={token.id}
                            style={{
                              ...styles.tokenCircle,
                              backgroundColor: token.color,
                            }}
                            title={token.name}
                          >
                            {token.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}