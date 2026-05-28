import React, { useState, useEffect, useRef } from 'react';
import sonidoCorrecto from './assets/correct-choice-43861.mp3';
import sonidoFallo    from './assets/negative_beeps-6008.mp3';
import sonidoInicio   from './assets/inicio-juego.mp3';
import { db } from './firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

// ── Modal Enviar al Profesor ──────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
  const [codigo,   setCodigo]   = useState('');
  const [nombre,   setNombre]   = useState('');
  const [curso,    setCurso]    = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code)          { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      const totalAc = datos.aciertosPrimos + datos.aciertosMult + datos.aciertosDiv;
      const totalIn = datos.intentosPrimos + datos.intentosMult + datos.intentosDiv;
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'DIVISIBILIDAD',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        jugadores: [{
          nombre:     nombre.trim(),
          curso:      curso.trim(),
          aciertos:   totalAc,
          intentos:   totalIn,
          porcentaje: Math.round((totalAc / Math.max(1, totalIn)) * 100),
          primos:    { aciertos: datos.aciertosPrimos, intentos: datos.intentosPrimos },
          multiplos: { aciertos: datos.aciertosMult,   intentos: datos.intentosMult   },
          divisores: { aciertos: datos.aciertosDiv,    intentos: datos.intentosDiv    },
        }],
      });
      setEnviado(true);
    } catch (e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
            <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 8 }}>
              Primos {datos.aciertosPrimos}/{datos.intentosPrimos} · Múlt. {datos.aciertosMult}/{datos.intentosMult} · Div. {datos.aciertosDiv}/{datos.intentosDiv}
            </div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, background: 'rgba(56,161,105,0.2)', borderRadius: 10, padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#68D391', fontWeight: 700 }}>PRIMOS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{datos.aciertosPrimos}<span style={{ fontSize: '0.7rem', color: '#aaa' }}>/{datos.intentosPrimos}</span></div>
              </div>
              <div style={{ flex: 1, background: 'rgba(214,158,46,0.2)', borderRadius: 10, padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#F6E05E', fontWeight: 700 }}>MÚLTIPLOS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{datos.aciertosMult}<span style={{ fontSize: '0.7rem', color: '#aaa' }}>/{datos.intentosMult}</span></div>
              </div>
              <div style={{ flex: 1, background: 'rgba(128,90,213,0.2)', borderRadius: 10, padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#B794F4', fontWeight: 700 }}>DIVISORES</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{datos.aciertosDiv}<span style={{ fontSize: '0.7rem', color: '#aaa' }}>/{datos.intentosDiv}</span></div>
              </div>
            </div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellido</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
              <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 5º Primaria A" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
            {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('menu');
  const [countdown, setCountdown] = useState(null); // 3, 2, 1, '¡YA!', null

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

  const audioOk    = useRef(new Audio(sonidoCorrecto));
  const audioFail  = useRef(new Audio(sonidoFallo));
  const audioStart = useRef(new Audio(sonidoInicio));

  const [aciertosPrimos, setAciPrimos] = useState(0);
  const [intentosPrimos, setIntPrimos] = useState(0);
  const [aciertosMult,   setAciMult]   = useState(0);
  const [intentosMult,   setIntMult]   = useState(0);
  const [aciertosDiv,    setAciDiv]    = useState(0);
  const [intentosDiv,    setIntDiv]    = useState(0);
  const [mostrarEnvio,   setMostrarEnvio] = useState(false);

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

  // --- EFECTOS: TEMPORIZADORES DE JUEGO ---
  useEffect(() => {
    if (view !== 'primes' || primesGameOver || primesGameWon || countdown !== null) return;
    if (primesTimer <= 0) {
      setPrimesGameOver(true);
      return;
    }
    const timer = setTimeout(() => setPrimesTimer(primesTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [primesTimer, view, primesGameOver, primesGameWon, countdown]);

  useEffect(() => {
    if (view !== 'multiples' || multGameOver || multGameWon || countdown !== null) return;
    if (multTimer <= 0) {
      setMultGameOver(true);
      return;
    }
    const timer = setTimeout(() => setMultTimer(multTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [multTimer, view, multGameOver, multGameWon, countdown]);

  // --- AUXILIAR: MEZCLAR ARRAYS ---
  const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

  // --- INICIALIZADORES DE JUEGOS ---
  const startCriba = () => {
    setCribaGrid(Array.from({ length: 100 }, (_, i) => ({ num: i + 1, status: 'neutral' })));
    setCribaMode('prime');
    setView('criba');
  };

  const initPrimesGame = (lvl) => {
    const basePrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23]; // 9 primos totales
    const numPrimesRequired = lvl === 1 ? 10 : 12;
    
    // Garantizar que aparezcan todos los primos antes de repetir ninguno
    const set1 = shuffleArray(basePrimes);
    const set2 = shuffleArray(basePrimes);
    const selectedPrimes = [...set1, ...set2].slice(0, numPrimesRequired);

    const numComposites = 49 - numPrimesRequired;
    const allPrimesUpTo100 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    
    let selectedComposites = [];
    while (selectedComposites.length < numComposites) {
      let rand = Math.floor(Math.random() * 50) + 2;
      if (!allPrimesUpTo100.includes(rand)) {
        selectedComposites.push(rand);
      }
    }

    let grid = [
      ...selectedPrimes.map((v, i) => ({ id: `p-${i}-${v}`, value: v, isPrime: true, found: false })),
      ...selectedComposites.map((v, i) => ({ id: `c-${i}-${v}`, value: v, isPrime: false, found: false, wrong: false }))
    ];
    setPrimesGrid(shuffleArray(grid));
  };

  const startPrimes = () => {
    setPrimesTimer(100);
    setPrimesLevel(1);
    setPrimesGameOver(false);
    setPrimesGameWon(false);
    initPrimesGame(1);
    audioStart.current.currentTime = 0; audioStart.current.play();
    setCountdown(3);
    setView('primes');
  };

  const initMultGame = (targetNum) => {
    let mSelected = [];
    for (let i = 0; i < 10; i++) {
      let factor = Math.floor(Math.random() * 11) + 2; // factores aleatorios significativos
      mSelected.push(targetNum * factor);
    }
    let cSelected = [];
    while (cSelected.length < 39) {
      let rand = Math.floor(Math.random() * 120) + 1;
      if (rand % targetNum !== 0) {
        cSelected.push(rand);
      }
    }
    let grid = [
      ...mSelected.map((v, i) => ({ id: `m-${i}-${v}`, value: v, isMult: true, found: false })),
      ...cSelected.map((v, i) => ({ id: `c-${i}-${v}`, value: v, isMult: false, found: false, wrong: false }))
    ];
    setMultGrid(shuffleArray(grid));
  };

  const startMultiples = () => {
    setMultTimer(100);
    setMultGameOver(false);
    setMultGameWon(false);
    
    // Múltiplos aleatorios entre 2 y 12 sin repetir de primeras
    const pool = shuffleArray([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const firstTarget = pool[0];
    setMultTarget(firstTarget);
    setMultPool(pool.slice(1));
    
    initMultGame(firstTarget);
    audioStart.current.currentTime = 0; audioStart.current.play();
    setCountdown(3);
    setView('multiples');
  };

  const initDivGame = (targetNum) => {
    // Encontrar divisores válidos del número objetivo
    let validDivisors = [];
    for (let i = 1; i <= targetNum; i++) {
      if (targetNum % i === 0) validDivisors.push(i);
    }
    
    // Seleccionar 10 divisores aleatorios (permitiendo repetición)
    let dSelected = [];
    for (let i = 0; i < 10; i++) {
      dSelected.push(validDivisors[Math.floor(Math.random() * validDivisors.length)]);
    }

    let cSelected = [];
    while (cSelected.length < 39) {
      let rand = Math.floor(Math.random() * (targetNum + 10)) + 1;
      if (targetNum % rand !== 0) {
        cSelected.push(rand);
      }
    }

    let grid = [
      ...dSelected.map((v, i) => ({ id: `d-${i}-${v}`, value: v, isDiv: true, found: false })),
      ...cSelected.map((v, i) => ({ id: `c-${i}-${v}`, value: v, isDiv: false, found: false, wrong: false }))
    ];
    setDivGrid(shuffleArray(grid));
  };

  const startDivisors = () => {
    setDivWon(false);
    
    // Lista específica de números para divisores sin repetir de primeras
    const pool = shuffleArray([12, 24, 16, 18, 48, 36, 40, 64, 72]);
    const firstTarget = pool[0];
    setDivTarget(firstTarget);
    setDivPool(pool.slice(1));

    initDivGame(firstTarget);
    audioStart.current.currentTime = 0; audioStart.current.play();
    setCountdown(3);
    setView('divisors');
  };

  // --- MANEJADORES DE CLICKS ---
  const handleCribaClick = (index) => {
    const newGrid = [...cribaGrid];
    const currentStatus = newGrid[index].status;
    if (cribaMode === 'prime') {
      newGrid[index].status = currentStatus === 'prime' ? 'neutral' : 'prime';
    } else {
      newGrid[index].status = currentStatus === 'crossed' ? 'neutral' : 'crossed';
    }
    setCribaGrid(newGrid);
  };

  const handlePrimeClick = (index) => {
    if (primesGameOver || primesGameWon || countdown !== null) return;
    const newGrid = [...primesGrid];
    const item = newGrid[index];
    if (item.found || item.wrong) return;

    setIntPrimos(prev => prev + 1);
    if (item.isPrime) {
      item.found = true;
      setAciPrimos(prev => prev + 1);
      audioOk.current.currentTime = 0; audioOk.current.play();
    } else {
      item.wrong = true;
      audioFail.current.currentTime = 0; audioFail.current.play();
    }
    setPrimesGrid(newGrid);

    const allPrimesFound = newGrid.filter((x) => x.isPrime).every((x) => x.found);
    if (allPrimesFound) {
      if (primesLevel === 1) {
        setPrimesLevel(2);
        initPrimesGame(2);
      } else {
        setPrimesGameWon(true);
      }
    }
  };

  const handleMultClick = (index) => {
    if (multGameOver || multGameWon || countdown !== null) return;
    const newGrid = [...multGrid];
    const item = newGrid[index];
    if (item.found || item.wrong) return;

    setIntMult(prev => prev + 1);
    if (item.isMult) {
      item.found = true;
      setAciMult(prev => prev + 1);
      audioOk.current.currentTime = 0; audioOk.current.play();
    } else {
      item.wrong = true;
      audioFail.current.currentTime = 0; audioFail.current.play();
    }
    setMultGrid(newGrid);

    const allMultFound = newGrid.filter((x) => x.isMult).every((x) => x.found);
    if (allMultFound) {
      if (multPool.length > 0) {
        const nextTarget = multPool[0];
        setMultTarget(nextTarget);
        setMultPool(multPool.slice(1));
        initMultGame(nextTarget);
      } else {
        setMultGameWon(true);
      }
    }
  };

  const handleDivClick = (index) => {
    if (divWon || countdown !== null) return;
    const newGrid = [...divGrid];
    const item = newGrid[index];
    if (item.found || item.wrong) return;

    setIntDiv(prev => prev + 1);
    if (item.isDiv) {
      item.found = true;
      setAciDiv(prev => prev + 1);
      audioOk.current.currentTime = 0; audioOk.current.play();
    } else {
      item.wrong = true;
      audioFail.current.currentTime = 0; audioFail.current.play();
    }
    setDivGrid(newGrid);

    const allDivFound = newGrid.filter((x) => x.isDiv).every((x) => x.found);
    if (allDivFound) {
      if (divPool.length > 0) {
        const nextTarget = divPool[0];
        setDivTarget(nextTarget);
        setDivPool(divPool.slice(1));
        initDivGame(nextTarget);
      } else {
        setDivWon(true);
      }
    }
  };

  // --- ESTILOS INLINE ---
  const mainContainerStyle = {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f0f4f8',
    minHeight: '100vh',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    userSelect: 'none'
  };

  const headerStyle = {
    fontSize: '36px',
    color: '#1a365d',
    marginBottom: '30px',
    textAlign: 'center',
    fontWeight: 'bold'
  };

  const menuBoxStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '25px',
    maxWidth: '800px',
    width: '100%',
    marginTop: '20px'
  };

  const mainButtonStyle = {
    padding: '30px 20px',
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#ffffff',
    border: 'none',
    borderRadius: '15px',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  };

  const backButtonStyle = {
    padding: '12px 25px',
    fontSize: '18px',
    backgroundColor: '#4a5568',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '20px',
    fontWeight: 'bold'
  };

  const infoPanelStyle = {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#2d3748',
    fontWeight: 'bold',
    backgroundColor: '#ffffff',
    padding: '15px 30px',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    display: 'flex',
    gap: '40px'
  };

  const gridWrapperRelative = {
    position: 'relative',
    maxWidth: '850px',
    width: '100%'
  };

  const gridContainerStyle = (cols) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '10px',
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '15px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
    width: '100%'
  });

  const cellStyle = {
    height: '65px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '2px solid #e2e8f0',
    backgroundColor: '#f7fafc',
    transition: 'all 0.1s'
  };

  const countdownOverlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '90px',
    fontWeight: 'bold',
    color: '#e53e3e',
    borderRadius: '15px',
    zIndex: 10,
    textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
  };

  return (
    <div style={mainContainerStyle}>
      {view === 'menu' && (
        <>
          <h1 style={headerStyle}>🏫 Pizarra Digital Interactiva: Matemáticas</h1>
          <div style={menuBoxStyle}>
            <button style={{ ...mainButtonStyle, backgroundColor: '#3182ce' }} onClick={startCriba}>
              <span>🧮 Criba de Eratóstenes</span>
              <span style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'normal' }}>Marcado manual de primos y múltiplos</span>
            </button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#38a169' }} onClick={startPrimes}>
              <span>⏱️ Encuentra los Primos</span>
              <span style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'normal' }}>Primos sin repetir hasta agotarse (100s)</span>
            </button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#d69e2e' }} onClick={startMultiples}>
              <span>🔢 Juego de Múltiplos</span>
              <span style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'normal' }}>Múltiplos del 2 al 12 aleatorios (100s)</span>
            </button>
            <button style={{ ...mainButtonStyle, backgroundColor: '#805ad5' }} onClick={startDivisors}>
              <span>🔍 Juego de Divisores</span>
              <span style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'normal' }}>Divisores de grandes números aleatorios</span>
            </button>
          </div>
        </>
      )}

      {/* --- CRIBA DE ERATÓSTENES --- */}
      {view === 'criba' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button style={backButtonStyle} onClick={() => setView('menu')}>⬅️ Volver al Menú</button>
          <h2 style={{ ...headerStyle, fontSize: '28px' }}>🧮 Herramienta: Criba de Eratóstenes</h2>
          
          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
            <button
              style={{
                padding: '15px 25px', fontSize: '18px', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer',
                backgroundColor: cribaMode === 'prime' ? '#48bb78' : '#e2e8f0', color: cribaMode === 'prime' ? 'white' : '#4a5568'
              }}
              onClick={() => setCribaMode('prime')}
            >
              🟢 Marcar Primo
            </button>
            <button
              style={{
                padding: '15px 25px', fontSize: '18px', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer',
                backgroundColor: cribaMode === 'cross' ? '#f56565' : '#e2e8f0', color: cribaMode === 'cross' ? 'white' : '#4a5568'
              }}
              onClick={() => setCribaMode('cross')}
            >
              ❌ Tachar Múltiplo
            </button>
            <button
              style={{ padding: '15px 20px', fontSize: '18px', borderRadius: '10px', border: '1px solid #cbd5e0', backgroundColor: '#ffffff', cursor: 'pointer' }}
              onClick={() => setCribaGrid(Array.from({ length: 100 }, (_, i) => ({ num: i + 1, status: 'neutral' })))}
            >
              🔄 Reiniciar
            </button>
          </div>

          <div style={gridWrapperRelative}>
            <div style={gridContainerStyle(10)}>
              {cribaGrid.map((item, index) => {
                let currentStyle = { ...cellStyle };
                if (item.status === 'prime') {
                  currentStyle.backgroundColor = '#c6f6d5'; currentStyle.border = '2px solid #48bb78'; currentStyle.color = '#22543d';
                } else if (item.status === 'crossed') {
                  currentStyle.backgroundColor = '#fed7d7'; currentStyle.border = '2px solid #f56565'; currentStyle.color = '#742a2a'; currentStyle.textDecoration = 'line-through';
                }
                return (
                  <div key={item.num} style={currentStyle} onClick={() => handleCribaClick(index)}>
                    {item.num}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- ENCUENTRA LOS PRIMOS --- */}
      {view === 'primes' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button style={backButtonStyle} onClick={() => setView('menu')}>⬅️ Volver al Menú</button>
          <h2 style={{ ...headerStyle, fontSize: '28px' }}>⏱️ Juego: Encuentra los Primos</h2>
          
          <div style={infoPanelStyle}>
            <span style={{ color: primesTimer <= 20 ? '#e53e3e' : '#2d3748' }}>⏳ Tiempo: {primesTimer}s</span>
            <span>📊 Nivel: {primesLevel}/2</span>
            <span>🎯 Primos restantes: {primesGrid.filter(x => x.isPrime && !x.found).length}</span>
          </div>

          {primesGameOver && (
            <div style={{ padding: '20px', backgroundColor: '#fed7d7', color: '#9b2c2c', borderRadius: '10px', fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', maxWidth: '850px', width: '100%' }}>
              💥 ¡Tiempo agotado! Revisa los números primos e inténtalo de nuevo.
              <button style={{ ...backButtonStyle, marginBottom: 0, marginTop: '15px', backgroundColor: '#9b2c2c' }} onClick={startPrimes}>Reintentar</button>
            </div>
          )}

          {primesGameWon && (
            <div style={{ padding: '20px', backgroundColor: '#c6f6d5', color: '#22543d', borderRadius: '10px', fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', maxWidth: '850px', width: '100%' }}>
              🎉 ¡Perfecto! Encontraste todos los números primos sin repeticiones tempranas.
              <button style={{ ...backButtonStyle, marginBottom: 0, marginTop: '15px', backgroundColor: '#d69e2e' }} onClick={() => setMostrarEnvio(true)}>📤 Enviar al profesor</button>
            </div>
          )}

          <div style={gridWrapperRelative}>
            {countdown !== null && <div style={countdownOverlayStyle}>{countdown}</div>}
            <div style={gridContainerStyle(7)}>
              {primesGrid.map((item, index) => {
                let currentStyle = { ...cellStyle };
                if (item.found) {
                  currentStyle.backgroundColor = '#c6f6d5'; currentStyle.border = '2px solid #48bb78'; currentStyle.color = '#22543d';
                } else if (item.wrong) {
                  currentStyle.backgroundColor = '#fed7d7'; currentStyle.border = '2px solid #f56565'; currentStyle.color = '#742a2a';
                }
                return (
                  <div key={item.id} style={currentStyle} onClick={() => handlePrimeClick(index)}>
                    {item.value}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- MÚLTIPLOS --- */}
      {view === 'multiples' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button style={backButtonStyle} onClick={() => setView('menu')}>⬅️ Volver al Menú</button>
          <h2 style={{ ...headerStyle, fontSize: '28px' }}>🔢 Juego de Múltiplos</h2>
          
          <div style={infoPanelStyle}>
            <span style={{ color: multTimer <= 20 ? '#e53e3e' : '#2d3748' }}>⏳ Tiempo: {multTimer}s</span>
            <span>🎯 Tacha los múltiplos de: <strong style={{ color: '#d69e2e', fontSize: '30px' }}>{multTarget}</strong></span>
          </div>

          {multGameOver && (
            <div style={{ padding: '20px', backgroundColor: '#fed7d7', color: '#9b2c2c', borderRadius: '10px', fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', maxWidth: '850px', width: '100%' }}>
              💥 ¡Se acabó el tiempo! Sigue practicando las tablas de multiplicar.
              <button style={{ ...backButtonStyle, marginBottom: 0, marginTop: '15px', backgroundColor: '#9b2c2c' }} onClick={startMultiples}>Reintentar</button>
            </div>
          )}

          {multGameWon && (
            <div style={{ padding: '20px', backgroundColor: '#c6f6d5', color: '#22543d', borderRadius: '10px', fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', maxWidth: '850px', width: '100%' }}>
              🏆 ¡Brillante! Has agotado todos los números de la lista aleatoria de múltiplos.
              <button style={{ ...backButtonStyle, marginBottom: 0, marginTop: '15px', backgroundColor: '#d69e2e' }} onClick={() => setMostrarEnvio(true)}>📤 Enviar al profesor</button>
            </div>
          )}

          <div style={gridWrapperRelative}>
            {countdown !== null && <div style={countdownOverlayStyle}>{countdown}</div>}
            <div style={gridContainerStyle(7)}>
              {multGrid.map((item, index) => {
                let currentStyle = { ...cellStyle };
                if (item.found) {
                  currentStyle.backgroundColor = '#bee3f8'; currentStyle.border = '2px solid #4299e1'; currentStyle.color = '#2b6cb0';
                } else if (item.wrong) {
                  currentStyle.backgroundColor = '#fed7d7'; currentStyle.border = '2px solid #f56565'; currentStyle.color = '#742a2a';
                }
                return (
                  <div key={item.id} style={currentStyle} onClick={() => handleMultClick(index)}>
                    {item.value}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- DIVISORES --- */}
      {view === 'divisors' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button style={backButtonStyle} onClick={() => setView('menu')}>⬅️ Volver al Menú</button>
          <h2 style={{ ...headerStyle, fontSize: '28px' }}>🔍 Juego de Divisores</h2>
          
          <div style={infoPanelStyle}>
            <span>🎯 Encuentra los 10 divisores de: <strong style={{ color: '#805ad5', fontSize: '30px' }}>{divTarget}</strong></span>
            <span style={{ fontSize: '18px', color: '#718096', alignSelf: 'center' }}>Restantes en bolsa: {divPool.length}</span>
          </div>

          {divWon && (
            <div style={{ padding: '20px', backgroundColor: '#e9d8fd', color: '#553c9a', borderRadius: '10px', fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', maxWidth: '850px', width: '100%' }}>
              ✨ ¡Enhorabuena! Completaste todos los retos de la lista de divisores sin repetir.
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 15 }}>
                <button style={{ ...backButtonStyle, marginBottom: 0, backgroundColor: '#805ad5' }} onClick={startDivisors}>Jugar de nuevo</button>
                <button style={{ ...backButtonStyle, marginBottom: 0, backgroundColor: '#d69e2e' }} onClick={() => setMostrarEnvio(true)}>📤 Enviar al profesor</button>
              </div>
            </div>
          )}

          <div style={gridWrapperRelative}>
            {countdown !== null && <div style={countdownOverlayStyle}>{countdown}</div>}
            <div style={gridContainerStyle(7)}>
              {divGrid.map((item, index) => {
                let currentStyle = { ...cellStyle };
                if (item.found) {
                  currentStyle.backgroundColor = '#e9d8fd'; currentStyle.border = '2px solid #9f7aea'; currentStyle.color = '#553c9a';
                } else if (item.wrong) {
                  currentStyle.backgroundColor = '#fed7d7'; currentStyle.border = '2px solid #f56565'; currentStyle.color = '#742a2a';
                }
                return (
                  <div key={item.id} style={currentStyle} onClick={() => handleDivClick(index)}>
                    {item.value}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {mostrarEnvio && (
        <ModalEnviarProfe
          datos={{ aciertosPrimos, intentosPrimos, aciertosMult, intentosMult, aciertosDiv, intentosDiv }}
          onClose={() => setMostrarEnvio(false)}
        />
      )}
    </div>
  );
}
export default App;
