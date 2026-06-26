import React, { useState, useEffect, useMemo, useCallback } from 'react';

const PerimetroArea = () => {
  const [mission, setMission] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedMissions, setCompletedMissions] = useState([]);

  const [challenge, setChallenge] = useState(null);
  const [tiles, setTiles] = useState({});
  const [qTiles, setQTiles] = useState({});
  const [hFences, setHFences] = useState({});
  const [vFences, setVFences] = useState({});
  const [dFences, setDFences] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [savedFigures, setSavedFigures] = useState([]);

  const [windowDimensions, setWindowDimensions] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768
  });

  useEffect(() => {
    const handleResize = () => setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowDimensions.w < 768;
  const GRID_SIZE = isMobile ? 4 : 8;

  // Espacio disponible para la cuadrícula: en escritorio descontamos las dos barras
  // laterales (320 + 320 + márgenes) y en móvil casi todo el ancho.
  const maxGridWidth = isMobile ? windowDimensions.w - 24 : windowDimensions.w - 720;
  // Altura disponible (descontando cabeceras) para que la cuadrícula nunca desborde la pantalla.
  const maxGridHeight = isMobile ? windowDimensions.h - 230 : windowDimensions.h - 80;
  const cellFromWidth = Math.floor(maxGridWidth / GRID_SIZE);
  const cellFromHeight = Math.floor(maxGridHeight / GRID_SIZE);
  const CELL_SIZE = Math.max(
    isMobile ? 64 : 56,
    Math.min(isMobile ? 110 : 110, cellFromWidth, cellFromHeight)
  );
  const fThick = isMobile ? 26 : Math.max(14, CELL_SIZE * 0.2);

  const CHALLENGES = useMemo(() => ({
    1: [
      { text: "Crea una granja con un Perímetro exacto de 8", p: 8, imp: false, count: 1 },
      { text: "Encuentra 2 figuras DISTINTAS con Perímetro 10", p: 10, imp: false, count: 2 },
      { text: "Crea una granja con un Perímetro exacto de 5", p: 5, imp: true, count: 1 },
      { text: "Crea una granja con un Perímetro exacto de 14", p: 14, imp: false, count: 1 },
      { text: "Crea una granja con un Perímetro exacto de 7", p: 7, imp: true, count: 1 }
    ],
    2: [
      { text: "Pela un suelo con un Área de 4 losas completas", a: 4, imp: false, count: 1 },
      { text: "Intenta hacer un Área de 3.5 losas (solo con enteras)", a: 3.5, imp: true, count: 1 },
      { text: "Encuentra 2 formas DISTINTAS de Área 5", a: 5, imp: false, count: 2 },
      { text: "Encuentra 3 formas DISTINTAS de Área 6", a: 6, imp: false, count: 3 },
      { text: "Intenta hacer un Área de 1.5 losas (solo con enteras)", a: 1.5, imp: true, count: 1 }
    ],
    3: [
      { text: "Consigue Área = 4 y Perímetro = 8", a: 4, p: 8, imp: false, count: 1 },
      { text: "Consigue Área = 4 y Perímetro = 11", a: 4, p: 11, imp: true, count: 1 },
      { text: "Consigue Área = 3 y Perímetro = 8", a: 3, p: 8, imp: false, count: 1 },
      { text: "Consigue Área = 5 y Perímetro = 12", a: 5, p: 12, imp: false, count: 1 },
      { text: "Consigue Área = 6 y Perímetro = 5", a: 6, p: 5, imp: true, count: 1 }
    ],
    4: [
      { text: "Construye un CUADRADO perfecto de Área 4", a: 4, imp: false, count: 1 },
      { text: "Construye un CUADRADO perfecto de Área 5", a: 5, imp: true, count: 1 },
      { text: "Construye un CUADRADO perfecto de Área 9", a: 9, imp: false, count: 1 },
      { text: "Construye un CUADRADO perfecto de Área 8", a: 8, imp: true, count: 1 },
      { text: "Construye un CUADRADO perfecto de Área 16", a: 16, imp: false, count: 1 }
    ],
    5: [
      { text: "Crea un triángulo perfecto de Área 0.5 (Perímetro 3.4)", a: 0.5, p: 3.4, imp: false, count: 1 },
      { text: "Crea un rombo rotado de Área 0.5 y Perímetro 2.8", a: 0.5, p: 2.8, imp: false, count: 1 },
      { text: "Intenta hacer Área 0.75 y Perímetro 3", a: 0.75, p: 3, imp: true, count: 1 },
      { text: "Haz una figura con Área 1 y Perímetro 5.6", a: 1, p: 5.6, imp: false, count: 1 },
      { text: "Intenta hacer Área 2 y Perímetro 4", a: 2, p: 4, imp: true, count: 1 }
    ]
  }), []);

  const clearGrid = useCallback(() => {
    setTiles({}); setQTiles({}); setHFences({}); setVFences({}); setDFences({});
  }, []);

  const resetChallenge = useCallback(() => {
    clearGrid(); setFeedback(null); setSavedFigures([]);
  }, [clearGrid]);

  const selectMission = (m) => {
    setMission(m);
    if (m > 0) {
      setCurrentLevel(0);
      setChallenge(CHALLENGES[m][0]);
      resetChallenge();
    }
  };

  const handleNextLevel = () => {
    const nextLevel = currentLevel + 1;
    if (nextLevel >= 5) {
      if (!completedMissions.includes(mission)) {
        setCompletedMissions(prev => [...prev, mission]);
      }
      setFeedback({ type: 'success', msg: '¡Misión completada! Has conseguido la ⭐. Volviendo al menú...', isEnd: true });
      setTimeout(() => {
        setMission(0);
        resetChallenge();
      }, 3000);
    } else {
      setCurrentLevel(nextLevel);
      setChallenge(CHALLENGES[mission][nextLevel]);
      resetChallenge();
    }
  };

  const clearFeedback = () => {
    if (feedback && feedback.type !== 'success') setFeedback(null);
  };

  const toggleTile = (x, y) => {
    if (mission === 1 || mission === 5 || feedback?.type === 'success') return;
    setTiles(p => ({ ...p, [`${x}-${y}`]: !p[`${x}-${y}`] })); clearFeedback();
  };

  const toggleQTile = (x, y, quad) => {
    if (mission !== 5 || feedback?.type === 'success') return;
    setQTiles(p => ({ ...p, [`${x}-${y}-${quad}`]: !p[`${x}-${y}-${quad}`] })); clearFeedback();
  };

  // Detecta qué triángulo (t/r/b/l) se ha tocado dentro de la celda según la posición
  // del puntero, de modo que cada zona triangular es fácil de pulsar (sin solapamientos).
  const handleQuadPointer = (e, x, y) => {
    if (mission !== 5 || feedback?.type === 'success') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point = e.touches?.[0] || e.changedTouches?.[0] || e;
    const rx = (point.clientX - rect.left) / rect.width - 0.5;
    const ry = (point.clientY - rect.top) / rect.height - 0.5;
    let quad;
    if (Math.abs(ry) >= Math.abs(rx)) quad = ry < 0 ? 't' : 'b';
    else quad = rx < 0 ? 'l' : 'r';
    toggleQTile(x, y, quad);
  };

  const toggleHFence = (x, y) => {
    if (mission === 2 || mission === 4 || feedback?.type === 'success') return;
    setHFences(p => ({ ...p, [`${x}-${y}`]: !p[`${x}-${y}`] })); clearFeedback();
  };

  const toggleVFence = (x, y) => {
    if (mission === 2 || mission === 4 || feedback?.type === 'success') return;
    setVFences(p => ({ ...p, [`${x}-${y}`]: !p[`${x}-${y}`] })); clearFeedback();
  };

  const toggleDFence = (x, y, diag) => {
    if (mission !== 5 || feedback?.type === 'success') return;
    setDFences(p => ({ ...p, [`${x}-${y}-${diag}`]: !p[`${x}-${y}-${diag}`] })); clearFeedback();
  };

  const filterInBounds = (obj) => Object.keys(obj).filter(k => {
    const [x, y] = k.split('-').map(Number);
    return obj[k] && x < GRID_SIZE && y < GRID_SIZE;
  });

  const areaCountBase = filterInBounds(tiles).length;
  const qAreaCount = filterInBounds(qTiles).length * 0.25;
  const totalArea = Number((areaCountBase + qAreaCount).toFixed(2));

  const hFencesCount = Object.keys(hFences).filter(k => {
    const [x, y] = k.split('-').map(Number); return hFences[k] && x < GRID_SIZE && y <= GRID_SIZE;
  }).length;
  const vFencesCount = Object.keys(vFences).filter(k => {
    const [x, y] = k.split('-').map(Number); return vFences[k] && x <= GRID_SIZE && y < GRID_SIZE;
  }).length;
  const dFencesCount = filterInBounds(dFences).length;

  const totalPerimeter = Number((hFencesCount + vFencesCount + (dFencesCount * 0.7)).toFixed(1));

  const getFigureSignature = () => {
    let minX = Infinity, minY = Infinity;
    const tKeys = filterInBounds(tiles);
    const qtKeys = filterInBounds(qTiles);
    const hKeys = Object.keys(hFences).filter(k => hFences[k]);
    const vKeys = Object.keys(vFences).filter(k => vFences[k]);
    const dKeys = filterInBounds(dFences);

    [...tKeys, ...qtKeys, ...hKeys, ...vKeys, ...dKeys].forEach(k => {
      const [x, y] = k.split('-').map(Number);
      if (x < minX) minX = x; if (y < minY) minY = y;
    });

    if (minX === Infinity) return null;
    const norm = (keys) => keys.map(k => {
      const parts = k.split('-'); return `${parts[0]-minX},${parts[1]-minY}${parts[2] ? '-'+parts[2] : ''}`;
    }).sort().join('|');

    return `T:${norm(tKeys)}-QT:${norm(qtKeys)}-H:${norm(hKeys)}-V:${norm(vKeys)}-D:${norm(dKeys)}`;
  };

  const processSuccess = (msg) => {
    if (challenge.count > 1) {
      const sig = getFigureSignature();
      if (!sig) return;
      if (savedFigures.includes(sig)) {
        setFeedback({ type: 'warning', msg: '¡Esta figura ya la descubriste! Intenta construir una diferente.' }); return;
      }
      const newSaved = [...savedFigures, sig];
      setSavedFigures(newSaved);
      if (newSaved.length >= challenge.count) {
        setFeedback({ type: 'success', msg: `¡Reto superado! Has encontrado las ${challenge.count} figuras distintas.`, isLevelComplete: true });
      } else {
        setFeedback({ type: 'success', msg: `¡Bien! Encontraste ${newSaved.length} de ${challenge.count}. Sigue buscando...` });
        setTimeout(() => { clearGrid(); setFeedback(null); }, 2000);
      }
    } else {
      setFeedback({ type: 'success', msg, isLevelComplete: true });
    }
  };

  const checkChallenge = () => {
    if (challenge.imp) return setFeedback({ type: 'warning', msg: '¡Cuidado! Podría ser imposible. Usa el botón "Es Imposible".' });
    let pass = false, msg = '';

    if (mission === 1) {
      pass = (totalPerimeter === challenge.p);
      msg = pass ? `¡Correcto! Frontera de ${challenge.p} unidades.` : `Tienes ${totalPerimeter}, necesitas ${challenge.p}.`;
    } else if (mission === 2) {
      pass = (totalArea === challenge.a);
      msg = pass ? `¡Correcto! Área de ${challenge.a}.` : `Área actual ${totalArea}, necesitas ${challenge.a}.`;
    } else if (mission === 3 || mission === 5) {
      if (totalArea !== challenge.a) msg = `Área incorrecta. Tienes ${totalArea}, necesitas ${challenge.a}.`;
      else if (totalPerimeter !== challenge.p) msg = `Área correcta, pero perímetro es ${totalPerimeter} (necesitas ${challenge.p}).`;
      else { pass = true; msg = `¡Correcto! Área: ${challenge.a}, Perímetro: ${challenge.p}.`; }
    } else if (mission === 4) {
      const activeTiles = filterInBounds(tiles);
      if (activeTiles.length !== challenge.a) msg = `Necesitas ${challenge.a} losetas. Tienes ${activeTiles.length}.`;
      else {
        let minX = 99, maxX = -1, minY = 99, maxY = -1;
        activeTiles.forEach(key => {
          const [x, y] = key.split('-').map(Number);
          if(x < minX) minX = x; if(x > maxX) maxX = x;
          if(y < minY) minY = y; if(y > maxY) maxY = y;
        });
        const w = maxX - minX + 1, h = maxY - minY + 1;
        if ((w === h) && (w * h === activeTiles.length)) { pass = true; msg = `¡Maravilloso! Cuadrado perfecto de área ${challenge.a}.`; }
        else msg = `Área correcta (${challenge.a}), pero NO es un cuadrado perfecto.`;
      }
    }
    pass ? processSuccess(msg) : setFeedback({ type: 'error', msg });
  };

  const declareImpossible = () => {
    if (challenge.imp) setFeedback({ type: 'success', msg: '¡ERES UN GENIO! Descubriste que este reto es IMPOSIBLE.', isLevelComplete: true });
    else setFeedback({ type: 'error', msg: 'Hmm... Piénsalo bien. ¡SÍ que es posible! Borra y vuelve a intentarlo.' });
  };

  const ceramicTexture = "radial-gradient(circle at 50% 50%, #f4f1ea 0%, #e3dac9 100%)";
  const woodTextureH = "linear-gradient(to bottom, #4a2e15 0%, #8b5a2b 30%, #a0522d 50%, #8b5a2b 70%, #4a2e15 100%)";
  const woodTextureV = "linear-gradient(to right, #4a2e15 0%, #8b5a2b 30%, #a0522d 50%, #8b5a2b 70%, #4a2e15 100%)";

  const quads = [
    { id: 't', clip: 'polygon(0% 0%, 100% 0%, 50% 50%)' },
    { id: 'r', clip: 'polygon(100% 0%, 100% 100%, 50% 50%)' },
    { id: 'b', clip: 'polygon(0% 100%, 100% 100%, 50% 50%)' },
    { id: 'l', clip: 'polygon(0% 0%, 0% 100%, 50% 50%)' }
  ];

  const diags = [
    { id: 'tl', angle: 225 }, { id: 'tr', angle: 315 },
    { id: 'br', angle: 45 }, { id: 'bl', angle: 135 }
  ];

  if (mission === 0) {
    return (
      <div style={{ padding: isMobile ? '20px' : '40px', fontFamily: 'sans-serif', backgroundColor: '#f0f4f8', minHeight: '100vh', boxSizing: 'border-box' }}>
        <h1 style={{ textAlign: 'center', fontSize: isMobile ? '2rem' : '3rem', color: '#2c3e50', marginBottom: '30px' }}>
          GeoEspacio: Desafíos Dinámicos
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', maxWidth: '1200px', margin: '0 auto' }}>
          {[
            { id: 1, title: '1. El Granjero', sub: 'Solo Perímetro', color: '#27ae60' },
            { id: 2, title: '2. El Albañil', sub: 'Solo Área', color: '#e67e22' },
            { id: 3, title: '3. El Arquitecto', sub: 'Área + Perímetro', color: '#8e44ad' },
            { id: 4, title: '4. El Perfeccionista', sub: 'Cuadrados Perfectos', color: '#c0392b' },
            { id: 5, title: '5. El Maestro Geómetra', sub: 'Modo Complejo: Diagonales', color: '#2980b9' }
          ].map(m => (
            <div key={m.id} onClick={() => selectMission(m.id)} style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '20px', width: isMobile ? '100%' : '260px', cursor: 'pointer', boxShadow: '0 8px 15px rgba(0,0,0,0.1)', borderTop: `8px solid ${m.color}`, transition: 'transform 0.2s' }}>
              <h2 style={{ color: m.color, marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {m.title}
                {completedMissions.includes(m.id) && <span style={{fontSize: '1.5rem'}}>⭐</span>}
              </h2>
              <p style={{ color: '#555', fontWeight: 'bold' }}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#ecf0f1', margin: 0, overflowX: 'hidden' }}>

      <div style={{ width: isMobile ? '100%' : '320px', flexShrink: 0, backgroundColor: '#34495e', color: '#fff', padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', zIndex: 10, boxShadow: '2px 0 10px rgba(0,0,0,0.2)' }}>
        <button onClick={() => selectMission(0)} style={{ padding: '12px', fontSize: '1rem', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '20px' }}>← Volver al Menú</button>

        <div style={{ backgroundColor: '#f1c40f', color: '#2c3e50', padding: '15px', borderRadius: '8px', marginBottom: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between' }}>
            RETO {currentLevel + 1}/5:
          </h2>
          <p style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold', lineHeight: '1.3' }}>{challenge?.text}</p>
          {challenge?.count > 1 && (
            <div style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#fff', borderRadius: '5px', display: 'inline-block', fontWeight: 'bold' }}>
              Descubiertas: {savedFigures.length} / {challenge.count}
            </div>
          )}
        </div>

        <p style={{fontSize: '1rem', opacity: 0.9, lineHeight: '1.4', marginBottom: isMobile ? '10px' : 'auto'}}>
          {mission === 5 ? "Modo Diagonales: Toca dentro de cada triángulo de la celda para pintar baldosas triangulares y pon vallas diagonales de long. 0.7." : "Interactúa con la cuadrícula tocando el interior para rellenar (área) y los bordes para cerrar (perímetro)."}
        </p>

        {!isMobile && (
          <button onClick={resetChallenge} style={{ padding: '15px', fontSize: '1.1rem', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Limpiar Tablero</button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#d5dbdb', position: 'relative', padding: isMobile ? '20px 10px' : '20px', minHeight: isMobile ? '50vh' : 'auto' }}>

        {feedback && (
          <div style={{ position: 'absolute', top: isMobile ? '5px' : '20px', left: '50%', transform: 'translateX(-50%)', padding: '12px 20px', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', zIndex: 100, boxShadow: '0 5px 15px rgba(0,0,0,0.2)', backgroundColor: feedback.type === 'success' ? '#d5f5e3' : feedback.type === 'warning' ? '#fcf3cf' : '#fadbd8', color: feedback.type === 'success' ? '#1e8449' : feedback.type === 'warning' ? '#b7950b' : '#c0392b', textAlign: 'center', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <span>{feedback.msg}</span>
            {feedback.isLevelComplete && !feedback.isEnd && (
              <button onClick={handleNextLevel} style={{ padding: '8px 20px', fontSize: '1.1rem', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Siguiente Nivel ➔</button>
            )}
          </div>
        )}

        <div style={{ position: 'relative', width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE, backgroundColor: '#eaeded', border: '4px solid #7f8c8d', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', touchAction: 'none' }}>

          {Array.from({ length: GRID_SIZE }).map((_, y) =>
            Array.from({ length: GRID_SIZE }).map((_, x) => (
              <div key={`bg-${x}-${y}`} style={{ position: 'absolute', left: x * CELL_SIZE, top: y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE, border: '1px solid rgba(189, 195, 199, 0.4)', boxSizing: 'border-box' }} />
            ))
          )}

          {mission !== 5 && Array.from({ length: GRID_SIZE }).map((_, y) =>
            Array.from({ length: GRID_SIZE }).map((_, x) => (
              <div
                key={`tile-${x}-${y}`} onClick={() => toggleTile(x, y)}
                style={{
                  position: 'absolute', left: x * CELL_SIZE, top: y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE,
                  background: tiles[`${x}-${y}`] ? ceramicTexture : 'transparent',
                  boxShadow: tiles[`${x}-${y}`] ? 'inset 0 0 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  border: tiles[`${x}-${y}`] ? '1px solid #d5d8dc' : 'none', boxSizing: 'border-box',
                  cursor: (mission === 1 || feedback?.type === 'success') ? 'default' : 'pointer',
                  zIndex: 2, transition: 'all 0.1s'
                }}
              />
            ))
          )}

          {mission === 5 && Array.from({ length: GRID_SIZE }).map((_, y) =>
            Array.from({ length: GRID_SIZE }).map((_, x) => {
              const hasAny = quads.some(q => qTiles[`${x}-${y}-${q.id}`]);
              return (
                <React.Fragment key={`qgroup-${x}-${y}`}>
                  {/* Capa visual de los 4 triángulos (sin captura de clic) */}
                  {quads.map(q => (
                    <div
                      key={`q-${x}-${y}-${q.id}`}
                      style={{
                        position: 'absolute', left: x * CELL_SIZE, top: y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE,
                        background: qTiles[`${x}-${y}-${q.id}`] ? ceramicTexture : 'transparent',
                        clipPath: q.clip, zIndex: 3, pointerEvents: 'none',
                        boxShadow: qTiles[`${x}-${y}-${q.id}`] ? 'inset 0 0 8px rgba(0,0,0,0.12)' : 'none'
                      }}
                    />
                  ))}
                  {/* Guías de las diagonales para indicar las zonas a tocar */}
                  <div style={{ position: 'absolute', left: x * CELL_SIZE, top: y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE, zIndex: 4, pointerEvents: 'none', backgroundImage: 'linear-gradient(45deg, transparent calc(50% - 1px), rgba(127,140,141,0.35) calc(50% - 1px), rgba(127,140,141,0.35) calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(-45deg, transparent calc(50% - 1px), rgba(127,140,141,0.35) calc(50% - 1px), rgba(127,140,141,0.35) calc(50% + 1px), transparent calc(50% + 1px))' }} />
                  {/* Una sola zona clicable por celda: el cuadrante se calcula por la posición del toque */}
                  <div
                    onClick={(e) => handleQuadPointer(e, x, y)}
                    style={{
                      position: 'absolute', left: x * CELL_SIZE, top: y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE,
                      zIndex: 5, cursor: feedback?.type === 'success' ? 'default' : 'pointer',
                      background: hasAny ? 'transparent' : 'rgba(0,0,0,0.015)'
                    }}
                  />
                  {hasAny && (
                    <div style={{position: 'absolute', left: x*CELL_SIZE, top: y*CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE, border: '1px solid #d5d8dc', zIndex: 4, pointerEvents: 'none'}} />
                  )}
                </React.Fragment>
              );
            })
          )}

          {Array.from({ length: GRID_SIZE + 1 }).map((_, y) =>
            Array.from({ length: GRID_SIZE }).map((_, x) => (
              <div
                key={`h-${x}-${y}`} onClick={() => toggleHFence(x, y)}
                style={{
                  position: 'absolute', left: x * CELL_SIZE, top: y * CELL_SIZE - (fThick / 2),
                  width: CELL_SIZE, height: fThick,
                  background: hFences[`${x}-${y}`] ? woodTextureH : 'transparent',
                  boxShadow: hFences[`${x}-${y}`] ? '0 3px 5px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.2)' : 'none',
                  cursor: (mission === 2 || mission === 4 || feedback?.type === 'success') ? 'default' : 'pointer',
                  zIndex: 10, borderRadius: hFences[`${x}-${y}`] ? '3px' : '0px',
                  border: hFences[`${x}-${y}`] ? '1px solid #3e2723' : 'none', boxSizing: 'border-box'
                }}
              >
                {!hFences[`${x}-${y}`] && mission !== 2 && mission !== 4 && <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(0,0,0,0.08)', marginTop: `${(fThick / 2) - 1}px` }} />}
              </div>
            ))
          )}

          {Array.from({ length: GRID_SIZE }).map((_, y) =>
            Array.from({ length: GRID_SIZE + 1 }).map((_, x) => (
              <div
                key={`v-${x}-${y}`} onClick={() => toggleVFence(x, y)}
                style={{
                  position: 'absolute', left: x * CELL_SIZE - (fThick / 2), top: y * CELL_SIZE,
                  width: fThick, height: CELL_SIZE,
                  background: vFences[`${x}-${y}`] ? woodTextureV : 'transparent',
                  boxShadow: vFences[`${x}-${y}`] ? '3px 0 5px rgba(0,0,0,0.4), inset 1px 0 2px rgba(255,255,255,0.2)' : 'none',
                  cursor: (mission === 2 || mission === 4 || feedback?.type === 'success') ? 'default' : 'pointer',
                  zIndex: 10, borderRadius: vFences[`${x}-${y}`] ? '3px' : '0px',
                  border: vFences[`${x}-${y}`] ? '1px solid #3e2723' : 'none', boxSizing: 'border-box'
                }}
              >
                {!vFences[`${x}-${y}`] && mission !== 2 && mission !== 4 && <div style={{ height: '100%', width: '2px', backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: `${(fThick / 2) - 1}px` }} />}
              </div>
            ))
          )}

          {mission === 5 && Array.from({ length: GRID_SIZE }).map((_, y) =>
            Array.from({ length: GRID_SIZE }).map((_, x) => (
              diags.map(d => (
                <div
                  key={`d-${x}-${y}-${d.id}`} onClick={() => toggleDFence(x, y, d.id)}
                  style={{
                    position: 'absolute', top: y * CELL_SIZE + CELL_SIZE / 2, left: x * CELL_SIZE + CELL_SIZE / 2,
                    width: CELL_SIZE * 0.707, height: Math.max(fThick, isMobile ? 26 : 18),
                    background: dFences[`${x}-${y}-${d.id}`] ? woodTextureH : 'transparent',
                    boxShadow: dFences[`${x}-${y}-${d.id}`] ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                    transformOrigin: '0% 50%', transform: `translateY(-50%) rotate(${d.angle}deg)`,
                    cursor: feedback?.type === 'success' ? 'default' : 'pointer',
                    zIndex: 15, borderRadius: dFences[`${x}-${y}-${d.id}`] ? '3px' : '0px',
                    border: dFences[`${x}-${y}-${d.id}`] ? '1px solid #3e2723' : 'none', boxSizing: 'border-box'
                  }}
                >
                    {!dFences[`${x}-${y}-${d.id}`] && (
                        <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(0,0,0,0.05)', marginTop: `${(Math.max(fThick, isMobile ? 26 : 18) / 2) - 1}px` }} />
                    )}
                </div>
              ))
            ))
          )}
        </div>
      </div>

      <div style={{ width: isMobile ? '100%' : '320px', flexShrink: 0, backgroundColor: '#fff', borderLeft: isMobile ? 'none' : '2px solid #bdc3c7', padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '-2px 0 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '10px', marginBottom: '20px', justifyContent: 'space-between' }}>
          {(mission === 1 || mission === 3 || mission === 5) && (
            <div style={{ padding: '15px', backgroundColor: '#f4ecf7', borderRadius: '12px', border: '1px solid #d7bde2', flex: 1, textAlign: 'center', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.05)' }}>
              <p style={{ color: '#8e44ad', margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold' }}>Perímetro</p>
              <p style={{ fontSize: '2.2rem', margin: 0, fontWeight: 'bold', color: '#4a235a' }}>{totalPerimeter}</p>
            </div>
          )}
          {(mission === 2 || mission === 3 || mission === 4 || mission === 5) && (
            <div style={{ padding: '15px', backgroundColor: '#e8f8f5', borderRadius: '12px', border: '1px solid #a2d9ce', flex: 1, textAlign: 'center', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.05)' }}>
              <p style={{ color: '#16a085', margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold' }}>Área</p>
              <p style={{ fontSize: '2.2rem', margin: 0, fontWeight: 'bold', color: '#0e6251' }}>{totalArea}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button
            onClick={checkChallenge} disabled={feedback?.isLevelComplete}
            style={{ width: '100%', padding: '18px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: feedback?.isLevelComplete ? '#bdc3c7' : '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: feedback?.isLevelComplete ? 'default' : 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
          >
            ✓ Comprobar
          </button>

          <button
            onClick={declareImpossible} disabled={feedback?.isLevelComplete}
            style={{ width: '100%', padding: '18px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: feedback?.isLevelComplete ? '#bdc3c7' : '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: feedback?.isLevelComplete ? 'default' : 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
          >
            ✕ Es Imposible
          </button>

          {isMobile && (
            <button onClick={resetChallenge} style={{ width: '100%', padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Limpiar Tablero</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerimetroArea;
