import { useState, useRef } from 'react';

function App() {
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [linkingInfo, setLinkingInfo] = useState(null); // { atomId, electronIdx }
  const [dragInfo, setDragInfo] = useState({ id: null, offsetX: 0, offsetY: 0 });
  const boardRef = useRef(null);

  const elements = [
    { symbol: 'H', name: 'Hidrógeno', val: 1, color: '#ef4444' },
    { symbol: 'C', name: 'Carbono', val: 4, color: '#9ca3af' },
    { symbol: 'N', name: 'Nitrógeno', val: 5, color: '#3b82f6' },
    { symbol: 'O', name: 'Oxígeno', val: 6, color: '#eab308' },
    { symbol: 'F', name: 'Flúor', val: 7, color: '#10b981' },
    { symbol: 'Na', name: 'Sodio', val: 1, color: '#8b5cf6' },
    { symbol: 'Cl', name: 'Cloro', val: 7, color: '#14b8a6' },
    { symbol: 'P', name: 'Fósforo', val: 5, color: '#f97316' },
    { symbol: 'S', name: 'Azufre', val: 6, color: '#f43f5e' }
  ];

  // 8 posiciones angulares fijas (en grados)
  const slotAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  // Mapeo de electrones de valencia a los índices de los slots angulares
  const valenceSlots = {
    1: [6],
    2: [6, 2],
    3: [6, 2, 4],
    4: [6, 2, 4, 0],
    5: [6, 2, 4, 0, 7],
    6: [6, 2, 4, 0, 7, 3],
    7: [6, 2, 4, 0, 7, 3, 5],
    8: [0, 1, 2, 3, 4, 5, 6, 7]
  };

  const ATOM_RADIUS = 35; 

  // Calcula la posición exacta en pantalla de un electrón específico
  const getElectronCoords = (atom, electronIdx) => {
    const slots = valenceSlots[atom.val] || [];
    const slotIdx = slots[electronIdx];
    if (slotIdx === undefined) return { x: atom.x, y: atom.y };
    
    // Ángulo total combinando el slot base y la rotación actual de la capa del átomo
    const totalAngleRad = ((slotAngles[slotIdx] + atom.rotation) * Math.PI) / 180;
    return {
      x: atom.x + ATOM_RADIUS * Math.cos(totalAngleRad),
      y: atom.y + ATOM_RADIUS * Math.sin(totalAngleRad)
    };
  };

  const addAtom = (element) => {
    const newAtom = {
      id: Date.now() + Math.random(),
      ...element,
      x: window.innerWidth / 2 + (Math.random() * 80 - 40),
      y: window.innerHeight / 2 + (Math.random() * 80 - 40),
      rotation: 0
    };
    setAtoms([...atoms, newAtom]);
  };

  const handlePointerDown = (e, atom) => {
    // Evitar arrastrar si se hace clic en botones o directamente en los electrones
    if (e.target.tagName === 'BUTTON' || e.target.getAttribute('data-electron') === 'true') return;
    
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setDragInfo({
      id: atom.id,
      offsetX: e.clientX - atom.x,
      offsetY: e.clientY - atom.y
    });
  };

  const handlePointerMove = (e) => {
    if (dragInfo.id !== null) {
      setAtoms(atoms.map(atom => 
        atom.id === dragInfo.id 
          ? { ...atom, x: e.clientX - dragInfo.offsetX, y: e.clientY - dragInfo.offsetY }
          : atom
      ));
    }
  };

  const handlePointerUp = () => {
    if (dragInfo.id !== null) {
      setDragInfo({ id: null, offsetX: 0, offsetY: 0 });
    }
  };

  const handleElectronDoubleClick = (e, atomId, electronIdx) => {
    e.stopPropagation();
    
    if (linkingInfo === null) {
      // Seleccionar primer electrón
      setLinkingInfo({ atomId, electronIdx });
    } else {
      // Si se hace doble clic sobre el mismo electrón, se deselecciona
      if (linkingInfo.atomId === atomId && linkingInfo.electronIdx === electronIdx) {
        setLinkingInfo(null);
        return;
      }

      // Crear el enlace entre ambos electrones específicos
      const bondExists = bonds.some(b => 
        (b.from === linkingInfo.atomId && b.fromEl === linkingInfo.electronIdx && b.to === atomId && b.toEl === electronIdx) ||
        (b.from === atomId && b.fromEl === electronIdx && b.to === linkingInfo.atomId && b.toEl === linkingInfo.electronIdx)
      );

      if (!bondExists) {
        setBonds([...bonds, {
          id: Date.now() + Math.random(),
          from: linkingInfo.atomId,
          fromEl: linkingInfo.electronIdx,
          to: atomId,
          toEl: electronIdx
        }]);
      }
      setLinkingInfo(null);
    }
  };

  const rotateAtomOuterLayer = (e, atomId, direction) => {
    e.stopPropagation();
    setAtoms(atoms.map(atom => 
      atom.id === atomId 
        ? { ...atom, rotation: (atom.rotation + direction + 360) % 360 }
        : atom
    ));
  };

  const removeAtom = (id, e) => {
    e.stopPropagation();
    setAtoms(atoms.filter(a => a.id !== id));
    setBonds(bonds.filter(b => b.from !== id && b.to !== id));
    if (linkingInfo && linkingInfo.atomId === id) setLinkingInfo(null);
  };

  const removeBond = (bondId) => {
    setBonds(bonds.filter(b => b.id !== bondId));
  };

  const checkElectronBonded = (atomId, electronIdx) => {
    return bonds.some(b => 
      (b.from === atomId && b.fromEl === electronIdx) || 
      (b.to === atomId && b.toEl === electronIdx)
    );
  };

  const clearBoard = () => {
    setAtoms([]);
    setBonds([]);
    setLinkingInfo(null);
  };

  const containerStyle = {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
    position: 'relative',
    userSelect: 'none',
    touchAction: 'none'
  };

  const toolbarStyle = {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1e293b',
    padding: '12px 20px',
    borderRadius: '16px',
    display: 'flex',
    gap: '8px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    border: '1px solid #334155',
    zIndex: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '95vw'
  };

  const elementBtnStyle = (color) => ({
    backgroundColor: '#0f172a',
    border: `2px solid ${color}`,
    color: '#f8fafc',
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  });

  const headerStyle = {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 10,
    pointerEvents: 'none',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: '15px',
    borderRadius: '12px',
    border: '1px solid #1e293b'
  };

  return (
    <div 
      style={containerStyle} 
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      ref={boardRef}
    >
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#38bdf8' }}>Pizarra Química Enlace a Enlace</h1>
        <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '13px', lineHeight: '1.4' }}>
          • <b>Doble Clic en un electrón:</b> Selecciónalo para enlazar. Repite en otro electrón para unirlos.<br />
          • <b>Girar Capa (⤾ / ⤿):</b> Rota los electrones exteriores para alinearlos y facilitar el enlace.<br />
          • Los electrones enlazados se vuelven <b>verdes</b> y la línea se conecta directamente entre ellos.<br />
          • <b>Clic en la línea de enlace:</b> Rompe la unión química.
        </p>
      </div>

      {/* Capa de enlaces (SVG) */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        {bonds.map(bond => {
          const atom1 = atoms.find(a => a.id === bond.from);
          const atom2 = atoms.find(a => a.id === bond.to);
          if (!atom1 || !atom2) return null;

          const startCoords = getElectronCoords(atom1, bond.fromEl);
          const endCoords = getElectronCoords(atom2, bond.toEl);

          return (
            <g key={bond.id} style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }} onClick={() => removeBond(bond.id)}>
              <line
                x1={startCoords.x}
                y1={startCoords.y}
                x2={endCoords.x}
                y2={endCoords.y}
                stroke="#22c55e"
                strokeWidth="4"
              />
              {/* Línea invisible más gruesa para facilitar el clic de borrado */}
              <line
                x1={startCoords.x}
                y1={startCoords.y}
                x2={endCoords.x}
                y2={endCoords.y}
                stroke="transparent"
                strokeWidth="16"
              />
            </g>
          );
        })}
      </svg>

      {/* Capa de átomos */}
      {atoms.map(atom => {
        const slots = valenceSlots[atom.val] || [];

        return (
          <div
            key={atom.id}
            onPointerDown={(e) => handlePointerDown(e, atom)}
            style={{
              position: 'absolute',
              left: `${atom.x}px`,
              top: `${atom.y}px`,
              width: '70px',
              height: '70px',
              backgroundColor: '#1e293b',
              border: `2px solid ${atom.color}`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#f8fafc',
              cursor: dragInfo.id === atom.id ? 'grabbing' : 'grab',
              transform: 'translate(-50%, -50%)',
              zIndex: dragInfo.id === atom.id ? 100 : 2
            }}
          >
            {/* Símbolo Químico Central Fijo */}
            <span style={{ userSelect: 'none', pointerEvents: 'none' }}>{atom.symbol}</span>
            
            {/* Botón Eliminar Átomo */}
            <button 
              onClick={(e) => removeAtom(atom.id, e)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                zIndex: 6
              }}
            >
              ×
            </button>

            {/* Controles de Rotación de la Capa Externa */}
            <div 
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: '-32px',
                display: 'flex',
                gap: '4px',
                zIndex: 6
              }}
            >
              <button
                onClick={(e) => rotateAtomOuterLayer(e, atom.id, -15)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  backgroundColor: '#334155',
                  color: '#38bdf8',
                  border: '1px solid #475569',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
                title="Girar a la izquierda"
              >
                ⤾
              </button>
              <button
                onClick={(e) => rotateAtomOuterLayer(e, atom.id, 15)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  backgroundColor: '#334155',
                  color: '#38bdf8',
                  border: '1px solid #475569',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
                title="Girar a la derecha"
              >
                ⤿
              </button>
            </div>

            {/* Capa Externa Giratoria de Electrones */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: `rotate(${atom.rotation}deg)`,
              pointerEvents: 'none' // Permite interactuar directamente con los hijos individuales
            }}>
              {slots.map((slotIdx, idx) => {
                const angle = slotAngles[slotIdx];
                const isShared = checkElectronBonded(atom.id, idx);
                const isSelected = linkingInfo && linkingInfo.atomId === atom.id && linkingInfo.electronIdx === idx;
                
                return (
                  <div
                    key={idx}
                    data-electron="true"
                    onDoubleClick={(e) => handleElectronDoubleClick(e, atom.id, idx)}
                    onPointerDown={(e) => e.stopPropagation()} // Evita que empiece a arrastrarse el átomo al pulsar el electrón
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: isShared || isSelected ? '14px' : '10px',
                      height: isShared || isSelected ? '14px' : '10px',
                      backgroundColor: isSelected ? '#38bdf8' : (isShared ? '#22c55e' : '#fbbf24'),
                      borderRadius: '50%',
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${ATOM_RADIUS}px)`,
                      boxShadow: isSelected ? '0 0 12px #38bdf8' : (isShared ? '0 0 10px #22c55e' : '0 0 4px #fbbf24'),
                      border: '1px solid #0f172a',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      zIndex: 10
                    }}
                    title={isSelected ? "Seleccionado (Haz doble clic en otro para unir)" : "Doble clic para enlazar"}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Barra de Herramientas Inferior */}
      <div style={toolbarStyle}>
        {elements.map(el => (
          <button 
            key={el.symbol} 
            style={elementBtnStyle(el.color)}
            onClick={() => addAtom(el)}
          >
            {el.symbol}
            <span style={{ fontSize: '9px', fontWeight: 'normal', color: el.color }}>{el.val} e⁻</span>
          </button>
        ))}
        
        <div style={{ width: '1px', height: '35px', backgroundColor: '#334155', margin: '0 8px' }} />
        
        <button 
          onClick={clearBoard}
          style={{
            backgroundColor: '#7f1d1d',
            border: 'none',
            color: '#fecaca',
            padding: '10px 14px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Limpiar Todo
        </button>
      </div>
    </div>
  );
}

export default App;
