import React, { useState, useEffect, useRef, useMemo } from 'react';

function Visor3dPoliedrosEuler() {
  const [polyhedron, setPolyhedron] = useState('dodecaedro');
  const [viewMode, setViewMode] = useState('3d');
  const [rotation, setRotation] = useState({ x: -25, y: 35 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Interacción de Cámara
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState('rotate');
  const dragStart = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // Estados de Selección (Almacenan los IDs en el orden que fueron clickeados)
  const [selectedV, setSelectedV] = useState([]);
  const [selectedE, setSelectedE] = useState([]);
  const [selectedC, setSelectedC] = useState([]);

  // Reiniciar selecciones y cámara al cambiar de figura
  useEffect(() => {
    setSelectedV([]);
    setSelectedE([]);
    setSelectedC([]);
    setRotation({ x: -25, y: 35 });
    setPosition({ x: 0, y: 0 });
  }, [polyhedron]);

  const phi = (1 + Math.sqrt(5)) / 2;
  const invPhi = 1 / phi;

  const shapesData = {
    tetraedro: {
      name: 'Tetraedro', emoji: '🔺',
      rgb: [255, 89, 94], lightColor: '#ffb3b5', color: '#FF595E',
      v: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]],
      f: [[0,1,2], [0,2,3], [0,3,1], [1,3,2]],
      stats: { caras: 4, vertices: 4, aristas: 6 },
      fact: "¡Es una pirámide de base triangular! Su recortable son 4 triángulos."
    },
    cubo: {
      name: 'Cubo', emoji: '🧊',
      rgb: [25, 130, 196], lightColor: '#a6d4f2', color: '#1982C4',
      v: [[-1,-1,-1], [1,-1,-1], [1,1,-1], [-1,1,-1], [-1,-1,1], [1,-1,1], [1,1,1], [-1,1,1]],
      f: [[0,3,2,1], [4,5,6,7], [0,1,5,4], [1,2,6,5], [2,3,7,6], [3,0,4,7]],
      stats: { caras: 6, vertices: 8, aristas: 12 },
      fact: "¡Es perfecto para jugar a los dados! Su recortable es una cruz de 6 cuadrados."
    },
    octaedro: {
      name: 'Octaedro', emoji: '💎',
      rgb: [138, 201, 38], lightColor: '#d3f29b', color: '#8AC926',
      v: [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]],
      f: [[4,0,2], [4,2,1], [4,1,3], [4,3,0], [5,2,0], [5,1,2], [5,3,1], [5,0,3]],
      stats: { caras: 8, vertices: 6, aristas: 12 },
      fact: "Parecen dos pirámides unidas por la base. ¡Tiene 8 caras triangulares!"
    },
    dodecaedro: {
      name: 'Dodecaedro', emoji: '⚽',
      rgb: [255, 202, 58], lightColor: '#ffe89e', color: '#FFCA3A',
      v: [
        [-1,-1,-1], [1,-1,-1], [1,1,-1], [-1,1,-1],
        [-1,-1,1], [1,-1,1], [1,1,1], [-1,1,1],
        [0,-invPhi,-phi], [0,invPhi,-phi], [0,-invPhi,phi], [0,invPhi,phi],
        [-invPhi,-phi,0], [invPhi,-phi,0], [-invPhi,phi,0], [invPhi,phi,0],
        [-phi,0,-invPhi], [phi,0,-invPhi], [-phi,0,invPhi], [phi,0,invPhi]
      ],
      f: [
        [3, 9, 2, 15, 14], [2, 9, 8, 1, 17], [1, 8, 0, 12, 13], [0, 8, 9, 3, 16],
        [0, 16, 18, 4, 12], [5, 13, 1, 17, 19], [4, 12, 13, 5, 10], [6, 11, 10, 5, 19],
        [7, 14, 15, 6, 11], [3, 16, 18, 7, 14], [2, 17, 19, 6, 15], [4, 10, 11, 7, 18]
      ],
      stats: { caras: 12, vertices: 20, aristas: 30 },
      fact: "Sus 12 caras son pentágonos exactos. ¡Fíjate que es como un balón de fútbol clásico!"
    },
    icosaedro: {
      name: 'Icosaedro', emoji: '🔮',
      rgb: [106, 76, 147], lightColor: '#bc9fe0', color: '#6A4C93',
      v: [
        [0, -1, -phi], [0, 1, -phi], [0, -1, phi], [0, 1, phi],
        [-1, -phi, 0], [1, -phi, 0], [-1, phi, 0], [1, phi, 0],
        [-phi, 0, -1], [phi, 0, -1], [-phi, 0, 1], [phi, 0, 1]
      ],
      f: [
        [0,1,8], [0,1,9], [0,4,8], [0,5,9], [0,4,5], [1,6,8], [1,7,9], [1,6,7],
        [2,3,10], [2,3,11], [2,4,10], [2,5,11], [2,4,5], [3,6,10], [3,7,11], [3,6,7],
        [4,8,10], [5,9,11], [6,8,10], [7,9,11]
      ],
      stats: { caras: 20, vertices: 12, aristas: 30 },
      fact: "¡Es el sólido con más caras! A los aventureros les encanta usarlo como dado de 20."
    }
  };

  const currentData = shapesData[polyhedron];

  // Extraer las aristas únicas de las caras
  const edgesList = useMemo(() => {
    const map = new Map();
    currentData.f.forEach(face => {
      for(let i=0; i<face.length; i++) {
        let a = face[i];
        let b = face[(i+1)%face.length];
        let key = Math.min(a,b) + '-' + Math.max(a,b);
        map.set(key, { id: key, v1: a, v2: b });
      }
    });
    return Array.from(map.values());
  }, [currentData]);

  // Controles Unificados (Ratón y Táctil)
  const handlePointerDown = (e) => {
    if (viewMode !== '3d') return;
    hasDragged.current = false;
    setIsDragging(true);

    // Distinguir entre click derecho/shift o toque de 2 dedos para Mover
    if (e.button === 2 || e.shiftKey || (e.touches && e.touches.length > 1)) {
      setDragMode('translate');
    } else {
      setDragMode('rotate');
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY };
  };

  const handlePointerMove = (e) => {
    if (!isDragging || viewMode !== '3d') return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - dragStart.current.x;
    const deltaY = clientY - dragStart.current.y;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      hasDragged.current = true;
    }

    if (dragMode === 'rotate') {
      setRotation(prev => ({ x: prev.x - deltaY * 0.6, y: prev.y + deltaX * 0.6 }));
    } else if (dragMode === 'translate') {
      setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    }
    dragStart.current = { x: clientX, y: clientY };
  };

  const handlePointerUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchend', handlePointerUp);
      return () => {
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [isDragging]);

  // Gestor de clics en elementos geométricos
  const handleItemClick = (e, type, id) => {
    e.stopPropagation();
    if (hasDragged.current) return;

    if (type === 'vertex') {
      setSelectedV(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else if (type === 'edge') {
      setSelectedE(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else if (type === 'face') {
      setSelectedC(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
  };

  // Etiqueta de texto de alto contraste SVG
  const SVGLabel = ({ x, y, text, color }) => (
    <g style={{ pointerEvents: 'none' }}>
      <text x={x} y={y} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" fontSize="16" fontWeight="900" textAnchor="middle" alignmentBaseline="central">{text}</text>
      <text x={x} y={y} fill={color} fontSize="16" fontWeight="900" textAnchor="middle" alignmentBaseline="central">{text}</text>
    </g>
  );

  // MOTOR 3D: Algoritmo del Pintor
  const render3DEngine = () => {
    const rx = (rotation.x * Math.PI) / 180;
    const ry = (rotation.y * Math.PI) / 180;

    const maxRadius = Math.max(...currentData.v.map(pt => Math.hypot(pt[0], pt[1], pt[2])));
    const scale = 120 / maxRadius;

    // 1. Rotar Vértices
    const rotate = (x, y, z) => {
      let x1 = x * Math.cos(ry) + z * Math.sin(ry);
      let z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      let y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
      let z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      return [x1, y2, z2];
    };

    const rotV = currentData.v.map(pt => rotate(pt[0], pt[1], pt[2]));
    const renderItems = [];

    // 2. Procesar Caras
    currentData.f.forEach((faceIndices, i) => {
      let cx = 0, cy = 0, cz = 0;
      const pts2d = faceIndices.map(idx => {
        cx += rotV[idx][0]; cy += rotV[idx][1]; cz += rotV[idx][2];
        return [rotV[idx][0]*scale, rotV[idx][1]*scale];
      });
      cx /= faceIndices.length; cy /= faceIndices.length; cz /= faceIndices.length;

      // Calcular Normal
      const pA = currentData.v[faceIndices[0]];
      const pB = currentData.v[faceIndices[1]];
      const pC = currentData.v[faceIndices[2]];
      const v1 = [pB[0]-pA[0], pB[1]-pA[1], pB[2]-pA[2]];
      const v2 = [pC[0]-pB[0], pC[1]-pB[1], pC[2]-pB[2]];
      let nx = v1[1]*v2[2] - v1[2]*v2[1];
      let ny = v1[2]*v2[0] - v1[0]*v2[2];
      let nz = v1[0]*v2[1] - v1[1]*v2[0];

      const centroid = [(pA[0]+pB[0]+pC[0])/3, (pA[1]+pB[1]+pC[1])/3, (pA[2]+pB[2]+pC[2])/3];
      if (nx*centroid[0] + ny*centroid[1] + nz*centroid[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }

      const rNormal = rotate(nx, ny, nz);
      const isFront = rNormal[2] > -0.05;

      renderItems.push({
        type: 'face', index: i, zDepth: cz,
        pts2d, isFront, normalZ: rNormal[2],
        cx: cx*scale, cy: cy*scale
      });
    });

    // 3. Procesar Aristas
    edgesList.forEach(edge => {
      const p1 = rotV[edge.v1];
      const p2 = rotV[edge.v2];
      renderItems.push({
        type: 'edge', id: edge.id, zDepth: (p1[2] + p2[2]) / 2,
        x1: p1[0]*scale, y1: p1[1]*scale, x2: p2[0]*scale, y2: p2[1]*scale,
        cx: ((p1[0]+p2[0])/2)*scale, cy: ((p1[1]+p2[1])/2)*scale
      });
    });

    // 4. Procesar Vértices
    rotV.forEach((v, i) => {
      renderItems.push({
        type: 'vertex', index: i, zDepth: v[2],
        x: v[0]*scale, y: v[1]*scale
      });
    });

    // 5. Ordenar por profundidad (Painter's Algorithm) + Tie-breaker
    renderItems.sort((a, b) => {
      if (Math.abs(a.zDepth - b.zDepth) < 0.001) {
        const rank = { face: 1, edge: 2, vertex: 3 };
        return rank[a.type] - rank[b.type];
      }
      return a.zDepth - b.zDepth; // zDepth menor (más lejos) se dibuja primero
    });

    return (
      <svg width="100%" height="100%" viewBox="-200 -200 400 400" style={{ overflow: 'visible' }}>
        <g transform={`translate(${position.x}, ${position.y})`} style={{ transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
          {renderItems.map(item => {

            if (item.type === 'face') {
              const isSelected = selectedC.includes(item.index);
              const selIdx = selectedC.indexOf(item.index) + 1;
              const light = 0.35 + 0.65 * Math.max(0, item.normalZ);

              let r = Math.round(currentData.rgb[0] * light);
              let g = Math.round(currentData.rgb[1] * light);
              let b = Math.round(currentData.rgb[2] * light);

              const color = isSelected ? 'rgba(49, 140, 231, 0.8)' : `rgb(${r},${g},${b})`; // Azul si está seleccionada
              const opacity = item.isFront ? 0.95 : (isSelected ? 0.6 : 0.15); // Si no es frontal, casi transparente

              return (
                <g key={`f-${item.index}`}>
                  <polygon
                    points={item.pts2d.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill={color} fillOpacity={opacity}
                    stroke={isSelected ? '#318CE7' : '#ffffff'} strokeWidth="1.5" strokeLinejoin="round"
                    onPointerUp={(e) => handleItemClick(e, 'face', item.index)}
                    style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
                  />
                  {isSelected && item.isFront && <SVGLabel x={item.cx} y={item.cy} text={`C${selIdx}`} color="#1a5b9e" />}
                </g>
              );
            }

            if (item.type === 'edge') {
              const isSelected = selectedE.includes(item.id);
              const selIdx = selectedE.indexOf(item.id) + 1;
              return (
                <g key={`e-${item.id}`}>
                  {/* Línea invisible gruesa para facilitar el click */}
                  <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke="transparent" strokeWidth="18" cursor="pointer" onPointerUp={(e) => handleItemClick(e, 'edge', item.id)} />
                  {/* Línea visual */}
                  <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={isSelected ? '#32CD32' : 'rgba(255,255,255,0.4)'} strokeWidth={isSelected ? "5" : "1"} pointerEvents="none" strokeLinecap="round" style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }} />
                  {isSelected && <SVGLabel x={item.cx} y={item.cy} text={`A${selIdx}`} color="#228B22" />}
                </g>
              );
            }

            if (item.type === 'vertex') {
              const isSelected = selectedV.includes(item.index);
              const selIdx = selectedV.indexOf(item.index) + 1;
              return (
                <g key={`v-${item.index}`}>
                  {/* Círculo invisible para hacer click fácilmente */}
                  <circle cx={item.x} cy={item.y} r="14" fill="transparent" cursor="pointer" onPointerUp={(e) => handleItemClick(e, 'vertex', item.index)} />
                  {/* Círculo visual */}
                  <circle cx={item.x} cy={item.y} r={isSelected ? "8" : "4"} fill={isSelected ? '#FFD700' : '#ffffff'} stroke={isSelected ? '#B8860B' : '#ccc'} strokeWidth="1.5" pointerEvents="none" style={{ transition: 'all 0.2s' }} />
                  {isSelected && <SVGLabel x={item.x - 14} y={item.y - 14} text={`V${selIdx}`} color="#DAA520" />}
                </g>
              );
            }

            return null;
          })}
        </g>
      </svg>
    );
  };

  const renderNetContent = () => {
    const renderDodecaNet = () => {
      const R = 22, D = 2 * R * Math.cos(Math.PI / 5);
      const pentagon = "0,-22 20.9,-6.8 12.9,17.8 -12.9,17.8 -20.9,-6.8";
      const petals = [0, 1, 2, 3, 4].map(i => {
        const angle = (90 + i * 72) * Math.PI / 180;
        return { x: D * Math.cos(angle), y: D * Math.sin(angle), rot: i * 72 + 180 };
      });
      return (
        <svg width="100%" height="100%" viewBox="0 0 300 300">
          <g transform="translate(150, 85)">
            <polygon points={pentagon} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="2" strokeLinejoin="round" />
            {petals.map((p, i) => <polygon key={i} points={pentagon} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="2" strokeLinejoin="round" transform={`translate(${p.x}, ${p.y}) rotate(${p.rot})`} />)}
          </g>
          <g transform="translate(150, 215)">
            <polygon points={pentagon} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="2" strokeLinejoin="round" />
            {petals.map((p, i) => <polygon key={i} points={pentagon} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="2" strokeLinejoin="round" transform={`translate(${p.x}, ${p.y}) rotate(${p.rot})`} />)}
          </g>
        </svg>
      );
    };

    const renderIcosaNet = () => {
      const dx = 22, dy = 38.1;
      const startX = 40, startY = 150;
      const faces = [];
      for(let i=0; i<10; i++) {
        if (i % 2 === 0) faces.push(`${startX + i*dx},${startY} ${startX + (i+1)*dx},${startY - dy} ${startX + (i+2)*dx},${startY}`);
        else faces.push(`${startX + i*dx},${startY - dy} ${startX + (i+2)*dx},${startY - dy} ${startX + (i+1)*dx},${startY}`);
      }
      [1, 3, 5, 7, 9].forEach(i => faces.push(`${startX + i*dx},${startY - dy} ${startX + (i+1)*dx},${startY - 2*dy} ${startX + (i+2)*dx},${startY - dy}`));
      [0, 2, 4, 6, 8].forEach(i => faces.push(`${startX + i*dx},${startY} ${startX + (i+2)*dx},${startY} ${startX + (i+1)*dx},${startY + dy}`));
      return (
        <svg width="100%" height="100%" viewBox="0 0 300 300">
          <g transform="translate(-10, 0)">
            {faces.map((f, i) => <polygon key={i} points={f} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="2" strokeLinejoin="round" />)}
          </g>
        </svg>
      );
    };

    const flatNets = {
      tetraedro: (
        <svg width="100%" height="100%" viewBox="0 0 300 300">
          <g transform="translate(0, 30)">
            {["150,40 110,109.28 190,109.28", "110,109.28 70,178.56 150,178.56", "190,109.28 150,178.56 230,178.56", "110,109.28 190,109.28 150,178.56"].map((pts, i) => <polygon key={i} points={pts} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="3" strokeLinejoin="round" />)}
          </g>
        </svg>
      ),
      cubo: (
        <svg width="100%" height="100%" viewBox="0 0 300 300">
          <g transform="translate(0, 10)">
            {["125,25 175,25 175,75 125,75", "125,75 175,75 175,125 125,125", "125,125 175,125 175,175 125,175", "125,175 175,175 175,225 125,225", "75,75 125,75 125,125 75,125", "175,75 225,75 225,125 175,125"].map((pts, i) => <polygon key={i} points={pts} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="3" strokeLinejoin="round" />)}
          </g>
        </svg>
      ),
      octaedro: (
        <svg width="100%" height="100%" viewBox="0 0 300 300">
          <g transform="translate(0, 10)">
            {["50,140 90,70.72 130,140", "90,70.72 170,70.72 130,140", "130,140 170,70.72 210,140", "170,70.72 250,70.72 210,140", "90,70.72 130,1.44 170,70.72", "170,70.72 210,1.44 250,70.72", "50,140 130,140 90,209.28", "130,140 210,140 170,209.28"].map((pts, i) => <polygon key={i} points={pts} fill={currentData.lightColor} stroke={currentData.color} strokeWidth="2.5" strokeLinejoin="round" />)}
          </g>
        </svg>
      ),
      dodecaedro: renderDodecaNet(),
      icosaedro: renderIcosaNet()
    };

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {flatNets[polyhedron]}
        <div style={{ position: 'absolute', bottom: '15px', width: '100%', textAlign: 'center', color: '#666', fontSize: '14px', fontWeight: 'bold' }}>
          Forma aplanada exacta para imprimir y recortar
        </div>
      </div>
    );
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      padding: '20px',
      backgroundColor: '#f4f7f6',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '1100px',
        padding: '15px',
        borderRadius: '16px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        marginBottom: '20px',
        textAlign: 'center',
        borderBottom: '4px solid #1982C4'
      }}>
        <h1 style={{ margin: '0', fontSize: 'clamp(20px, 5vw, 32px)', color: '#333' }}>
          🏫 Pizarra Mágica: Sólidos Platónicos
        </h1>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '20px',
        width: '100%',
        maxWidth: '1100px'
      }}>

        {/* Panel Lateral */}
        <div style={{
          flex: '1',
          minWidth: '260px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          zIndex: 20
        }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>👆</span> Elige una figura:
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(shapesData).map((key) => {
                const isSelected = polyhedron === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPolyhedron(key)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${shapesData[key].color}` : '2px solid transparent',
                      backgroundColor: isSelected ? shapesData[key].lightColor : '#f0f0f0',
                      color: '#333',
                      fontSize: '16px',
                      fontWeight: isSelected ? '800' : '600',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{shapesData[key].emoji}</span>
                    {shapesData[key].name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #eee', paddingTop: '15px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#333', fontSize: '16px' }}>👀 Modo de vista:</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <button
                onClick={() => setViewMode('3d')}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  backgroundColor: viewMode === '3d' ? '#1982C4' : '#e0e0e0',
                  color: viewMode === '3d' ? '#fff' : '#555',
                  fontWeight: 'bold', cursor: 'pointer', fontSize: '15px',
                  boxShadow: viewMode === '3d' ? '0 4px 10px rgba(25, 130, 196, 0.3)' : 'none'
                }}
              >
                🎮 Visor 3D
              </button>
              <button
                onClick={() => setViewMode('net')}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  backgroundColor: viewMode === 'net' ? '#8AC926' : '#e0e0e0',
                  color: viewMode === 'net' ? '#fff' : '#555',
                  fontWeight: 'bold', cursor: 'pointer', fontSize: '15px',
                  boxShadow: viewMode === 'net' ? '0 4px 10px rgba(138, 201, 38, 0.3)' : 'none'
                }}
              >
                ✂️ Recortable
              </button>
            </div>

            {viewMode === '3d' && (
              <button
                onClick={() => { setSelectedV([]); setSelectedE([]); setSelectedC([]); setRotation({ x: -25, y: 35 }); setPosition({ x: 0, y: 0 }); }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px',
                  border: '2px solid #ddd', backgroundColor: '#fff',
                  color: '#666', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                🔄 Reiniciar Vista y Conteo
              </button>
            )}
          </div>
        </div>

        {/* Visor Principal */}
        <div style={{
          flex: '2',
          minWidth: '300px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>

          <div
            style={{
              height: 'clamp(340px, 55vh, 620px)',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: `4px solid ${currentData.color}`,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 10px 30px ${currentData.color}33`,
              backgroundImage: 'radial-gradient(#f0f0f0 2px, transparent 2px)',
              backgroundSize: '30px 30px',
              touchAction: 'none', // IMPORTANTE: Bloquea el scroll móvil al usar el visor
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={e => e.preventDefault()}
            onDragStart={e => e.preventDefault()}
          >
            {viewMode === '3d' ? render3DEngine() : renderNetContent()}

            {viewMode === '3d' && (
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'space-between', fontSize: '12px', color: '#555', backgroundColor: 'rgba(255,255,255,0.95)', padding: '8px 12px', borderRadius: '8px', pointerEvents: 'none', fontWeight: 'bold', border: '1px solid #ddd', zIndex: 15 }}>
                <span>👆 Toca vértices, caras o aristas para contarlos</span>
                <span style={{textAlign: 'right'}}>🔄 Arrastra para girar el objeto</span>
              </div>
            )}
          </div>

          {/* Tarjeta Educativa */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            borderLeft: `8px solid ${currentData.color}`
          }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '26px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {currentData.name} {currentData.emoji}
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#555', fontSize: '16px', fontStyle: 'italic', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
              💡 <strong>¿Sabías que...?</strong> {currentData.fact}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '15px',
              textAlign: 'center'
            }}>
              <div style={{ backgroundColor: selectedC.length === currentData.stats.caras ? '#318CE7' : currentData.lightColor, padding: '15px', borderRadius: '12px', border: `2px solid ${currentData.color}`, transition: 'all 0.3s' }}>
                <div style={{ fontSize: '32px', fontWeight: '900', color: selectedC.length === currentData.stats.caras ? '#fff' : '#333' }}>
                  {viewMode === '3d' && selectedC.length > 0 ? `${selectedC.length}/${currentData.stats.caras}` : currentData.stats.caras}
                </div>
                <div style={{ fontSize: '14px', color: selectedC.length === currentData.stats.caras ? '#fff' : '#333', fontWeight: 'bold', marginTop: '4px' }}>CARAS</div>
              </div>
              <div style={{ backgroundColor: selectedV.length === currentData.stats.vertices ? '#FFD700' : currentData.lightColor, padding: '15px', borderRadius: '12px', border: `2px solid ${currentData.color}`, transition: 'all 0.3s' }}>
                <div style={{ fontSize: '32px', fontWeight: '900', color: selectedV.length === currentData.stats.vertices ? '#fff' : '#333' }}>
                  {viewMode === '3d' && selectedV.length > 0 ? `${selectedV.length}/${currentData.stats.vertices}` : currentData.stats.vertices}
                </div>
                <div style={{ fontSize: '14px', color: selectedV.length === currentData.stats.vertices ? '#fff' : '#333', fontWeight: 'bold', marginTop: '4px' }}>VÉRTICES</div>
              </div>
              <div style={{ backgroundColor: selectedE.length === currentData.stats.aristas ? '#32CD32' : currentData.lightColor, padding: '15px', borderRadius: '12px', border: `2px solid ${currentData.color}`, transition: 'all 0.3s' }}>
                <div style={{ fontSize: '32px', fontWeight: '900', color: selectedE.length === currentData.stats.aristas ? '#fff' : '#333' }}>
                  {viewMode === '3d' && selectedE.length > 0 ? `${selectedE.length}/${currentData.stats.aristas}` : currentData.stats.aristas}
                </div>
                <div style={{ fontSize: '14px', color: selectedE.length === currentData.stats.aristas ? '#fff' : '#333', fontWeight: 'bold', marginTop: '4px' }}>ARISTAS</div>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '15px', color: '#444', backgroundColor: '#e9ecef', padding: '12px', borderRadius: '8px', fontWeight: 'bold' }}>
              ✨ Fórmula Mágica de Euler: Caras + Vértices = Aristas + 2 <br/>
              <span style={{ color: currentData.color, fontSize: '18px' }}>
                ({currentData.stats.caras} + {currentData.stats.vertices} = {currentData.stats.aristas} + 2)
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Visor3dPoliedrosEuler;
