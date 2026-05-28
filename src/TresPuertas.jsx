function App() {
  // Estados del juego principal
  const [carPosition, setCarPosition] = useState(() => Math.floor(Math.random() * 3) + 1);
  const [selectedDoor, setSelectedDoor] = useState(null);
  const [revealedDoor, setRevealedDoor] = useState(null);
  const [gameState, setGameState] = useState('CHOOSE'); // 'CHOOSE', 'DECIDE', 'REVEAL'
  const [playerDecision, setPlayerDecision] = useState(null); // 'SWITCH' o 'STAY'
  const [lastResult, setLastResult] = useState(null); // 'WIN' o 'LOSS'

  // Estadísticas acumuladas para la lección de probabilidad
  const [stats, setStats] = useState({
    switchWins: 0,
    switchLosses: 0,
    stayWins: 0,
    stayLosses: 0,
  });

  // Inicializar o reiniciar una ronda individual sin borrar estadísticas
  const startNewRound = () => {
    setCarPosition(Math.floor(Math.random() * 3) + 1);
    setSelectedDoor(null);
    setRevealedDoor(null);
    setGameState('CHOOSE');
    setPlayerDecision(null);
    setLastResult(null);
  };

  // Reiniciar todo por completo (incluyendo el marcador de la clase)
  const resetAll = () => {
    startNewRound();
    setStats({
      switchWins: 0,
      switchLosses: 0,
      stayWins: 0,
      stayLosses: 0,
    });
  };

  // Paso 1: El alumno selecciona una puerta inicialmente
  const handleDoorClick = (doorNumber) => {
    if (gameState !== 'CHOOSE') return;

    setSelectedDoor(doorNumber);

    // Monty Hall elige una puerta para abrir: no puede ser la del coche ni la elegida por el alumno
    const availableDoors = [1, 2, 3].filter(
      (door) => door !== doorNumber && door !== carPosition
    );
    // Si hay dos opciones (el alumno eligió el coche), elige una al azar
    const doorToReveal = availableDoors[Math.floor(Math.random() * availableDoors.length)];

    setRevealedDoor(doorToReveal);
    setGameState('DECIDE');
  };

  // Paso 2: El alumno decide si mantener o cambiar de puerta
  const handleDecision = (decision) => {
    if (gameState !== 'DECIDE') return;

    setPlayerDecision(decision);
    let finalDoor = selectedDoor;

    if (decision === 'SWITCH') {
      // Cambiar a la otra puerta que sigue cerrada
      finalDoor = [1, 2, 3].find((door) => door !== selectedDoor && door !== revealedDoor);
      setSelectedDoor(finalDoor);
    }

    const isWin = finalDoor === carPosition;
    setLastResult(isWin ? 'WIN' : 'LOSS');

    // Actualizar matriz de estadísticas de probabilidad
    setStats((prev) => {
      const newStats = { ...prev };
      if (decision === 'SWITCH') {
        if (isWin) newStats.switchWins += 1;
        else newStats.switchLosses += 1;
      } else {
        if (isWin) newStats.stayWins += 1;
        else newStats.stayLosses += 1;
      }
      return newStats;
    });

    setGameState('REVEAL');
  };

  // Simulador rápido para el profesor: ejecuta N rondas automáticas con una estrategia
  const runBulkSimulation = (strategy, count) => {
    let sWins = 0, sLosses = 0, stWins = 0, stLosses = 0;

    for (let i = 0; i < count; i++) {
      const simCar = Math.floor(Math.random() * 3) + 1;
      const simChoice = Math.floor(Math.random() * 3) + 1;

      const simAvailable = [1, 2, 3].filter((d) => d !== simChoice && d !== simCar);
      const simReveal = simAvailable[Math.floor(Math.random() * simAvailable.length)];

      if (strategy === 'SWITCH') {
        const simFinal = [1, 2, 3].find((d) => d !== simChoice && d !== simReveal);
        if (simFinal === simCar) sWins++; else sLosses++;
      } else {
        if (simChoice === simCar) stWins++; else stLosses++;
      }
    }

    setStats((prev) => ({
      switchWins: prev.switchWins + sWins,
      switchLosses: prev.switchLosses + sLosses,
      stayWins: prev.stayWins + stWins,
      stayLosses: prev.stayLosses + stLosses,
    }));
  };

  // Cálculos de porcentajes en tiempo real
  const totalSwitch = stats.switchWins + stats.switchLosses;
  const totalStay = stats.stayWins + stats.stayLosses;
  const pctSwitch = totalSwitch > 0 ? ((stats.switchWins / totalSwitch) * 100).toFixed(1) : '0.0';
  const pctStay = totalStay > 0 ? ((stats.stayWins / totalStay) * 100).toFixed(1) : '0.0';

  // Paleta de estilos optimizada para pantallas táctiles de gran formato (Pizarra Digital)
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
      marginBottom: '8px',
      color: '#1e3a8a',
    },
    subtitle: {
      textAlign: 'center',
      fontSize: '18px',
      color: '#475569',
      marginBottom: '24px',
      fontWeight: '500',
    },
    statusBar: {
      backgroundColor: '#eff6ff',
      border: '2px solid #bfdbfe',
      borderRadius: '16px',
      padding: '20px',
      textAlign: 'center',
      fontSize: '22px',
      fontWeight: '700',
      color: '#1e40af',
      marginBottom: '32px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    },
    mainLayout: {
      display: 'flex',
      gap: '24px',
      flexWrap: 'wrap',
      marginBottom: '32px',
    },
    gameArea: {
      flex: '2',
      minWidth: '600px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    },
    doorsContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '20px',
    },
    doorCard: {
      flex: '1',
      height: '320px',
      borderRadius: '16px',
      border: '4px solid #334155',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      cursor: 'pointer',
      userSelect: 'none',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease',
    },
    doorBadge: {
      position: 'absolute',
      top: '16px',
      left: '16px',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: '#1e293b',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: '700',
    },
    doorContent: {
      fontSize: '72px',
    },
    doorLabel: {
      marginTop: '12px',
      fontSize: '18px',
      fontWeight: '700',
    },
    decisionContainer: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center',
      padding: '16px',
      backgroundColor: '#fff',
      borderRadius: '16px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
    },
    btnLarge: {
      padding: '16px 28px',
      fontSize: '20px',
      fontWeight: '800',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    },
    sidebar: {
      flex: '1',
      minWidth: '350px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    },
    panel: {
      backgroundColor: '#ffffff',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e2e8f0',
    },
    panelTitle: {
      fontSize: '22px',
      fontWeight: '700',
      marginBottom: '16px',
      color: '#334155',
      borderBottom: '2px solid #f1f5f9',
      paddingBottom: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statTable: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '16px',
      textAlign: 'left',
    },
    th: {
      padding: '10px',
      color: '#64748b',
      fontWeight: '600',
      borderBottom: '2px solid #e2e8f0',
    },
    td: {
      padding: '12px 10px',
      borderBottom: '1px solid #f1f5f9',
      fontSize: '16px',
    },
    macroSimRow: {
      display: 'flex',
      gap: '8px',
      marginTop: '12px',
    },
    btnMini: {
      padding: '10px 14px',
      fontSize: '14px',
      fontWeight: '700',
      backgroundColor: '#64748b',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      flex: '1',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🚪 El Problema de Monty Hall 🐐🚗</h1>
      <p style={styles.subtitle}>Demostración empírica de la paradoja de las tres puertas para la clase de matemáticas</p>

      {/* Banner de Estado Dinámico (Guía táctil) */}
      <div style={styles.statusBar}>
        {gameState === 'CHOOSE' && '👉 Paso 1: Pide a un alumno que toque una puerta para elegirla.'}
        {gameState === 'DECIDE' && '🤔 Paso 2: ¡Monty Hall ha abierto una cabra! ¿El alumno mantiene o cambia su puerta?'}
        {gameState === 'REVEAL' && (
          <span style={{ color: lastResult === 'WIN' ? '#16a34a' : '#dc2626' }}>
            {lastResult === 'WIN' ? '🎉 ¡GANÓ EL COCHE! 🚗' : '🐐 ¡Salió una cabra! ¡Buen intento!'}
          </span>
        )}
      </div>

      <div style={styles.mainLayout}>
        {/* Zona del juego interactivo */}
        <div style={styles.gameArea}>
          <div style={styles.doorsContainer}>
            {[1, 2, 3].map((doorNum) => {
              const isSelected = selectedDoor === doorNum;
              const isRevealed = revealedDoor === doorNum;
              const isOpen = gameState === 'REVEAL' || isRevealed;
              const hasCar = carPosition === doorNum;

              // Determinar estilos visuales basados en el estado interactivo de la puerta
              let bg = '#dfebf6';
              let borderCol = '#334155';
              if (isSelected) {
                bg = '#fef08a'; // Resaltado amarillo táctil
                borderCol = '#eab308';
              }
              if (isRevealed && gameState === 'DECIDE') {
                bg = '#f1f5f9';
                borderCol = '#cbd5e1';
              }
              if (gameState === 'REVEAL') {
                bg = hasCar ? '#dcfce7' : '#fee2e2';
                borderCol = hasCar ? '#22c55e' : '#ef4444';
              }

              return (
                <div
                  key={doorNum}
                  onClick={() => handleDoorClick(doorNum)}
                  style={{
                    ...styles.doorCard,
                    backgroundColor: bg,
                    borderColor: borderCol,
                    transform: isSelected ? 'scale(1.02)' : 'none',
                    opacity: isRevealed && gameState === 'DECIDE' ? 0.6 : 1,
                    cursor: gameState === 'CHOOSE' ? 'pointer' : 'default',
                  }}
                >
                  <div style={styles.doorBadge}>{doorNum}</div>
                  <div style={styles.doorContent}>
                    {!isOpen && '🚪'}
                    {isOpen && (hasCar ? '🚗' : '🐐')}
                  </div>
                  <div style={{ ...styles.doorLabel, color: borderCol }}>
                    {isSelected && '⭐ Elegida'}
                    {isRevealed && gameState === 'DECIDE' && '🗑️ Eliminada'}
                    {!isSelected && (!isRevealed || gameState === 'REVEAL') && 'Cerrada'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Panel de Decisiones en la Fase 2 */}
          {gameState === 'DECIDE' && (
            <div style={styles.decisionContainer}>
              <button
                onClick={() => handleDecision('STAY')}
                style={{ ...styles.btnLarge, backgroundColor: '#dc2626' }}
              >
                ✋ Mantener Puerta
              </button>
              <button
                onClick={() => handleDecision('SWITCH')}
                style={{ ...styles.btnLarge, backgroundColor: '#2563eb' }}
              >
                🔄 Cambiar de Puerta
              </button>
            </div>
          )}

          {/* Control de reinicio de ronda */}
          {gameState === 'REVEAL' && (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={startNewRound}
                style={{ ...styles.btnLarge, backgroundColor: '#10b981', width: '60%' }}
              >
                🚪 Siguiente Ronda de Alumnos
              </button>
            </div>
          )}
        </div>

        {/* Panel de Estadísticas y Simulaciones en Bloque */}
        <div style={styles.sidebar}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>📊 Datos Acumulados de la Clase</h2>
            <table style={styles.statTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Estrategia</th>
                  <th style={styles.th}>Victorias</th>
                  <th style={styles.th}>Derrotas</th>
                  <th style={styles.th}>% Éxito</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...styles.td, fontWeight: '700', color: '#2563eb' }}>🔄 Cambiar</td>
                  <td style={styles.td}>{stats.switchWins}</td>
                  <td style={styles.td}>{stats.switchLosses}</td>
                  <td style={{ ...styles.td, fontWeight: '700', color: '#16a34a' }}>{pctSwitch}%</td>
                </tr>
                <tr>
                  <td style={{ ...styles.td, fontWeight: '700', color: '#dc2626' }}>✋ Mantener</td>
                  <td style={styles.td}>{stats.stayWins}</td>
                  <td style={styles.td}>{stats.stayLosses}</td>
                  <td style={{ ...styles.td, fontWeight: '700', color: '#16a34a' }}>{pctStay}%</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
              Muestra total: {totalSwitch + totalStay} intentos en la pizarra.
            </div>
          </div>

          {/* Herramienta Didáctica Avanzada: Simulador de la Ley de Grandes Números */}
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>
              🤖 Simulador Masivo
              <span style={{ fontSize: '12px', backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '4px' }}>Profesor</span>
            </h2>
            <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 12px 0' }}>
              Genera datos instantáneos para demostrar la probabilidad real ($2/3$ frente a $1/3$) sin tener que jugar cientos de veces a mano:
            </p>
            
            <div style={{ marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Simular 100 jugadas de golpe:</div>
            <div style={styles.macroSimRow}>
              <button onClick={() => runBulkSimulation('SWITCH', 100)} style={{ ...styles.btnMini, backgroundColor: '#2563eb' }}>
                🔄 Cambiando (100)
              </button>
              <button onClick={() => runBulkSimulation('STAY', 100)} style={{ ...styles.btnMini, backgroundColor: '#dc2626' }}>
                ✋ Manteniendo (100)
              </button>
            </div>

            <button
              onClick={resetAll}
              style={{
                ...styles.btnMini,
                backgroundColor: '#1e293b',
                width: '100%',
                marginTop: '20px',
                padding: '12px',
              }}
            >
              🔄 Limpiar Todo y Reiniciar Contador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}