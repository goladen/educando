import { useState } from 'react';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

// ─── Modal enviar al profesor ────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo]     = useState('');
    const [nombre, setNombre]     = useState('');
    const [curso,  setCurso]      = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'PARTES_PLANTA', modalidad: 'Individual', fecha: new Date(),
                recursoTitulo: 'Partes de la Planta',
                codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.niveles, total: datos.niveles, nota: 100 }],
            });
            setEnviado(true);
        } catch(e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>Partes de la Planta · {datos.niveles}/{datos.niveles} niveles · 100%</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso',  'Curso',             curso,  setCurso,  'Ej: 3º ESO A',       false],
                          ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key==='codigo'?10:undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }}/>
                            </div>
                        ))}
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

// ─── Juego principal ──────────────────────────────────────────────────────────
export default function PartesPlantaGame({ onExit }) {
  const [screen, setScreen] = useState('language'); // 'language' or 'game'
  const [lang, setLang] = useState('ca');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { dropzoneId: labelKey }
  const [validated, setValidated] = useState(false); // true when check button clicked
  const [activeModal, setActiveModal] = useState(null); // 'levelWin', 'gameWin', 'fail', or null
  const [draggedKey, setDraggedKey] = useState(null);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const [linkCopiado, setLinkCopiado]   = useState(false);

  const copiarLink = () => {
    const url = `${window.location.origin}/partes_planta`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    }).catch(() => {});
  };

  // i18n Dictionary
  const i18n = {
    ca: {
      mainTitle: "Les Parts de la Planta", subTitle: "Arrossega els noms al seu lloc!",
      levelWord: "Nivell", ofWord: "de", words: "Paraules", checkBtn: "Comprovar 👀",
      levelWinTitle: "Molt bé!", levelWinText: "Has completat aquest nivell.", nextBtn: "Següent Nivell 👉",
      gameWinTitle: "Superat!", gameWinText: "Ets un expert en plantes!", restartBtn: "Tornar a Jugar 🔄",
      failTitle: "Hi ha alguna errada!", failText: "Fixa't bé en les que estan en vermell i torna a intentar-ho.", retryBtn: "Tornar a provar 🔄",
      root: "arrel", stem: "tija", leaf: "fulla", flower: "flor", fruit: "fruit"
    },
    es: {
      mainTitle: "Las Partes de la Planta", subTitle: "¡Arrastra los nombres a su lugar!",
      levelWord: "Nivel", ofWord: "de", words: "Palabras", checkBtn: "Comprobar 👀",
      levelWinTitle: "¡Muy bien!", levelWinText: "Has completado este nivel.", nextBtn: "Siguiente Nivel 👉",
      gameWinTitle: "¡Superado!", gameWinText: "¡Eres un experto en plantas!", restartBtn: "Volver a Jugar 🔄",
      failTitle: "¡Hay algún error!", failText: "Fíjate bien en las rojas y vuelve a intentarlo.", retryBtn: "Volver a probar 🔄",
      root: "raíz", stem: "tallo", leaf: "hoja", flower: "flor", fruit: "fruto"
    },
    en: {
      mainTitle: "Parts of a Plant", subTitle: "Drag the names to their correct place!",
      levelWord: "Level", ofWord: "of", words: "Words", checkBtn: "Check 👀",
      levelWinTitle: "Great job!", levelWinText: "You completed this level.", nextBtn: "Next Level 👉",
      gameWinTitle: "Completed!", gameWinText: "You are a plant expert!", restartBtn: "Play Again 🔄",
      failTitle: "Oops, something is wrong!", failText: "Look at the red ones and try again.", retryBtn: "Try again 🔄",
      root: "root", stem: "stem", leaf: "leaf", flower: "flower", fruit: "fruit"
    }
  };

  // SVGs definitions
  const svgDefs = (
    <defs>
      <linearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#15803d" />
        <stop offset="50%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#16a34a" />
      </linearGradient>
    </defs>
  );

  // Game levels configuration
  const levelsData = [
    {
      // LEVEL 1: Young plant
      parts: ['root', 'stem', 'leaf'],
      dropzones: [
        { id: 'root', top: '390px', left: '190px' },
        { id: 'stem', top: '240px', left: '20px' },
        { id: 'leaf', top: '150px', left: '190px' }
      ],
      svg: (
        <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} viewBox="0 0 320 480" xmlns="http://www.w3.org/2000/svg">
          {svgDefs}
          <path d="M40,350 Q160,340 280,350 L270,450 Q160,465 50,450 Z" fill="#92400e" />
          <path d="M160,340 Q130,380 120,430 M160,340 Q180,390 190,440 M150,360 Q140,400 155,445 M170,350 Q190,380 170,420" stroke="#fcd34d" strokeWidth="5" fill="none" strokeLinecap="round"/>
          <path d="M160,340 Q155,270 160,200" stroke="url(#stemGrad)" strokeWidth="12" fill="none" strokeLinecap="round"/>
          <path d="M160,260 Q220,240 240,210 Q190,210 160,260" fill="#4ade80" stroke="#16a34a" strokeWidth="3" />
          <path d="M160,260 Q200,230 220,220" stroke="#16a34a" strokeWidth="2" fill="none" />
          <path d="M158,220 Q100,200 80,170 Q130,170 158,220" fill="#4ade80" stroke="#16a34a" strokeWidth="3" />
          <path d="M158,220 Q110,190 95,180" stroke="#16a34a" strokeWidth="2" fill="none" />
          <circle cx="160" cy="195" r="8" fill="#4ade80" />
          <line x1="160" y1="390" x2="185" y2="400" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="130" y1="250" x2="155" y2="255" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="210" y1="215" x2="195" y2="165" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
        </svg>
      )
    },
    {
      // LEVEL 2: Flowering plant
      parts: ['root', 'stem', 'leaf', 'flower'],
      dropzones: [
        { id: 'root', top: '410px', left: '20px' },
        { id: 'stem', top: '280px', left: '190px' },
        { id: 'leaf', top: '190px', left: '20px' },
        { id: 'flower', top: '40px', left: '190px' }
      ],
      svg: (
        <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} viewBox="0 0 320 480" xmlns="http://www.w3.org/2000/svg">
          {svgDefs}
          <path d="M30,370 Q160,355 290,370 L280,465 Q160,475 40,465 Z" fill="#92400e" />
          <path d="M160,360 Q120,400 100,450 M160,360 Q200,410 210,455 M140,380 Q150,420 145,460 M175,380 Q170,410 185,450" stroke="#fcd34d" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M160,360 Q165,250 160,140" stroke="url(#stemGrad)" strokeWidth="14" fill="none" strokeLinecap="round"/>
          <path d="M162,290 Q230,270 250,230 Q190,240 162,290" fill="#22c55e" stroke="#15803d" strokeWidth="3" />
          <path d="M162,210 Q90,190 70,150 Q130,160 162,210" fill="#22c55e" stroke="#15803d" strokeWidth="3" />
          <g transform="translate(160, 130)">
            <circle cx="0" cy="-25" r="18" fill="#fcd34d" />
            <circle cx="0" cy="0" r="18" fill="#fcd34d" />
            <circle cx="-21" cy="-12" r="18" fill="#fcd34d" />
            <circle cx="21" cy="-12" r="18" fill="#fcd34d" />
            <circle cx="-13" cy="-31" r="18" fill="#fcd34d" />
            <circle cx="13" cy="-31" r="18" fill="#fcd34d" />
            <circle cx="0" cy="-16" r="15" fill="#f59e0b" />
          </g>
          <line x1="130" y1="420" x2="105" y2="425" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="165" y1="285" x2="185" y2="295" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="120" y1="180" x2="135" y2="200" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="160" y1="100" x2="185" y2="60" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
        </svg>
      )
    },
    {
      // LEVEL 3: Tomato plant with fruit
      parts: ['root', 'stem', 'leaf', 'flower', 'fruit'],
      dropzones: [
        { id: 'root', top: '420px', left: '190px' },
        { id: 'stem', top: '320px', left: '20px' },
        { id: 'leaf', top: '220px', left: '190px' },
        { id: 'flower', top: '50px', left: '20px' },
        { id: 'fruit', top: '140px', left: '20px' }
      ],
      svg: (
        <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} viewBox="0 0 320 480" xmlns="http://www.w3.org/2000/svg">
          {svgDefs}
          <path d="M20,380 Q160,370 300,380 L290,470 Q160,480 30,470 Z" fill="#92400e" />
          <path d="M160,370 Q110,400 90,460 M160,370 Q210,400 230,460 M145,390 Q150,430 135,465 M175,390 Q170,420 185,465 M160,370 Q160,420 165,460" stroke="#fcd34d" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M160,370 Q150,250 165,130" stroke="url(#stemGrad)" strokeWidth="16" fill="none" strokeLinecap="round"/>
          <path d="M158,310 Q230,300 250,260 Q190,260 158,310" fill="#16a34a" stroke="#15803d" strokeWidth="3" />
          <path d="M160,220 Q80,210 60,160 Q120,170 160,220" fill="#16a34a" stroke="#15803d" strokeWidth="3" />
          <path d="M162,170 Q225,140 240,100 Q180,110 162,170" fill="#16a34a" stroke="#15803d" strokeWidth="3" />
          <g transform="translate(130, 95)">
            <circle cx="0" cy="-15" r="10" fill="#fcd34d" />
            <circle cx="0" cy="0" r="10" fill="#fcd34d" />
            <circle cx="-12" cy="-7" r="10" fill="#fcd34d" />
            <circle cx="12" cy="-7" r="10" fill="#fcd34d" />
            <circle cx="-7" cy="-19" r="10" fill="#fcd34d" />
            <circle cx="7" cy="-19" r="10" fill="#fcd34d" />
            <circle cx="0" cy="-9" r="8" fill="#f59e0b" />
          </g>
          <g transform="translate(120, 190)">
            <path d="M10,-15 Q15,-5 20,-12" stroke="#15803d" strokeWidth="4" fill="none" />
            <circle cx="20" cy="0" r="22" fill="#ef4444" />
            <circle cx="14" cy="-6" r="6" fill="#fca5a5" opacity="0.6" />
            <path d="M20,-22 L15,-28 M20,-22 L25,-28 M20,-22 L20,-29" stroke="#15803d" strokeWidth="3" />
          </g>
          <line x1="150" y1="420" x2="185" y2="430" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="152" y1="325" x2="130" y2="335" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="205" y1="275" x2="185" y2="235" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="115" y1="80" x2="130" y2="65" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
          <line x1="120" y1="190" x2="130" y2="155" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
        </svg>
      )
    }
  ];

  const currentLevelData = levelsData[currentLevel];
  const t = i18n[lang];

  // Helper to check if all dropzones are filled
  const allFilled = currentLevelData.parts.every(part => userAnswers[part]);

  const startGame = (selectedLang) => {
    setLang(selectedLang);
    setScreen('game');
    setCurrentLevel(0);
    setUserAnswers({});
    setValidated(false);
    setActiveModal(null);
  };

  const handleDragStart = (key) => {
    setDraggedKey(key);
  };

  const handleDrop = (zoneId) => {
    if (!draggedKey || validated) return;

    // Find if this label was already placed somewhere else, and clear it
    const updatedAnswers = { ...userAnswers };
    Object.keys(updatedAnswers).forEach(k => {
      if (updatedAnswers[k] === draggedKey) {
        delete updatedAnswers[k];
      }
    });

    updatedAnswers[zoneId] = draggedKey;
    setUserAnswers(updatedAnswers);
    setDraggedKey(null);
  };

  const handleZoneClick = (zoneId) => {
    if (validated) return;
    if (userAnswers[zoneId]) {
      const updatedAnswers = { ...userAnswers };
      delete updatedAnswers[zoneId];
      setUserAnswers(updatedAnswers);
    }
  };

  const validateAnswers = () => {
    setValidated(true);
    let isCorrect = true;
    currentLevelData.parts.forEach(part => {
      if (userAnswers[part] !== part) {
        isCorrect = false;
      }
    });

    if (isCorrect) {
      if (currentLevel < levelsData.length - 1) {
        setActiveModal('levelWin');
      } else {
        setActiveModal('gameWin');
      }
    } else {
      setActiveModal('fail');
    }
  };

  const nextLevel = () => {
    setCurrentLevel(prev => prev + 1);
    setUserAnswers({});
    setValidated(false);
    setActiveModal(null);
  };

  const retryLevel = () => {
    setValidated(false);
    setActiveModal(null);
    // Clear only incorrect answers
    const updatedAnswers = { ...userAnswers };
    currentLevelData.parts.forEach(part => {
      if (updatedAnswers[part] !== part) {
        delete updatedAnswers[part];
      }
    });
    setUserAnswers(updatedAnswers);
  };

  const restartGame = () => {
    setScreen('language');
    setCurrentLevel(0);
    setUserAnswers({});
    setValidated(false);
    setActiveModal(null);
  };

  // Remaining labels that are not placed on the board yet
  const availableLabels = currentLevelData.parts.filter(
    part => !Object.values(userAnswers).includes(part)
  );

  // Styles definition
  const styles = {
    body: {
      fontFamily: "'Nunito', sans-serif",
      backgroundColor: '#f0fdf4',
      color: '#1f2937',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowX: 'hidden',
      padding: '20px',
      boxSizing: 'border-box'
    },
    langScreen: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      maxWidth: '650px',
      padding: '48px 16px',
      zIndex: 50,
      flex: 1,
      minHeight: '80vh'
    },
    langBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '15px',
      background: 'linear-gradient(to bottom, #ffffff, #f0fdf4)',
      border: '4px solid #4ade80',
      borderBottomWidth: '8px',
      color: '#16a34a',
      fontSize: '1.6rem',
      fontWeight: 900,
      padding: '1rem 2rem',
      borderRadius: '25px',
      boxShadow: '0 8px 15px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      width: '100%',
      maxWidth: '320px',
      transition: 'transform 0.15s',
      userSelect: 'none'
    },
    title: {
      fontSize: '3.5rem',
      fontWeight: 900,
      marginBottom: '40px',
      textAlign: 'center',
      color: '#16a34a',
      textShadow: '3px 3px 0px #bbf7d0, 6px 6px 0px rgba(0,0,0,0.05)'
    },
    gameScreen: {
      width: '100%',
      maxWidth: '800px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    },
    headerTitle: {
      fontSize: '2.5rem',
      fontWeight: 900,
      marginBottom: '8px',
      textAlign: 'center'
    },
    headerSub: {
      fontSize: '1.25rem',
      color: '#166534',
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: '24px'
    },
    gameWrapper: {
      background: 'white',
      borderRadius: '30px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      padding: '1.5rem',
      width: '100%',
      position: 'relative',
      boxSizing: 'border-box'
    },
    levelIndicator: {
      position: 'absolute',
      top: '-15px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#16a34a',
      color: 'white',
      padding: '0.5rem 1.5rem',
      borderRadius: '20px',
      fontWeight: 900,
      fontSize: '1.2rem',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 10
    },
    gameArea: {
      display: 'flex',
      flexDirection: window.innerWidth < 768 ? 'column' : 'row',
      gap: '2rem',
      alignItems: window.innerWidth < 768 ? 'center' : 'flex-start',
      justifyContent: 'space-between',
      marginTop: '15px'
    },
    plantContainer: {
      position: 'relative',
      width: '320px',
      height: '480px',
      background: 'linear-gradient(to bottom, #bae6fd 0%, #e0f2fe 60%, #fef3c7 60%, #d97706 100%)',
      borderRadius: '20px',
      border: '4px solid #cbd5e1',
      overflow: 'hidden',
      flexShrink: 0,
      margin: '0 auto'
    },
    dropzone: {
      position: 'absolute',
      width: '110px',
      height: '40px',
      background: 'rgba(255, 255, 255, 0.9)',
      border: '3px dashed #94a3b8',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: '1.1rem',
      color: '#64748b',
      zIndex: 10,
      cursor: 'pointer',
      userSelect: 'none'
    },
    labelsContainer: {
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      minHeight: '300px',
      background: '#f8fafc',
      borderRadius: '20px',
      padding: '1.5rem',
      border: '2px dashed #cbd5e1',
      boxSizing: 'border-box'
    },
    draggableItem: {
      background: 'white',
      border: '3px solid #e2e8f0',
      borderBottomWidth: '6px',
      padding: '0.8rem 1.5rem',
      borderRadius: '15px',
      fontWeight: 900,
      fontSize: '1.2rem',
      color: '#475569',
      cursor: 'grab',
      userSelect: 'none',
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
    },
    btnAction: {
      background: 'linear-gradient(to bottom, #4ade80, #22c55e)',
      color: 'white',
      fontSize: '1.5rem',
      fontWeight: 900,
      padding: '1rem 2rem',
      borderRadius: '20px',
      border: 'none',
      boxShadow: '0 6px 0 #16a34a, 0 10px 10px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      width: '100%'
    },
    modalOverlay: {
      position: 'fixed',
      top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalBox: {
      background: 'white',
      padding: '2rem',
      borderRadius: '30px',
      textAlign: 'center',
      width: '90%',
      maxWidth: '450px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  };

  return (
    <div style={styles.body}>
      {/* Barra superior con salir y compartir */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: 'rgba(22,101,52,0.93)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', gap: 8,
      }}>
        {onExit ? (
          <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 14px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
            ← Salir
          </button>
        ) : <div />}
        <span style={{ color: 'white', fontWeight: 900, fontSize: '1rem' }}>🌱 Partes de la Planta</span>
        <button
          onClick={copiarLink}
          style={{ background: linkCopiado ? '#22c55e' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 14px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.3s', whiteSpace: 'nowrap' }}
        >
          {linkCopiado ? '✓ ¡Copiado!' : '🔗 Compartir'}
        </button>
      </div>

      {/* Espaciador para la barra fija */}
      <div style={{ height: 48, width: '100%', flexShrink: 0 }} />

      {screen === 'language' && (
        <div style={styles.langScreen}>
          <div style={{ fontSize: '4.5rem', marginBottom: '16px', display: 'flex', gap: '16px' }}>
            <span>🌱</span><span>🌻</span><span>🌳</span>
          </div>
          <h1 style={styles.title}>Elige el idioma</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center' }}>
            <button style={styles.langBtn} onClick={() => startGame('ca')}>
              <span style={{ fontSize: '1.8rem' }}>🍄</span> Català
            </button>
            <button style={styles.langBtn} onClick={() => startGame('es')}>
              <span style={{ fontSize: '1.8rem' }}>🍓</span> Castellano
            </button>
            <button style={styles.langBtn} onClick={() => startGame('en')}>
              <span style={{ fontSize: '1.8rem' }}>🍎</span> English
            </button>
          </div>
        </div>
      )}

      {screen === 'game' && (
        <div style={styles.gameScreen}>
          <header style={{ textAlign: 'center' }}>
            <h1 style={styles.headerTitle}>{t.mainTitle}</h1>
            <p style={styles.headerSub}>{t.subTitle}</p>
          </header>

          <div style={styles.gameWrapper}>
            <div style={styles.levelIndicator}>
              {t.levelWord} {currentLevel + 1} {t.ofWord} {levelsData.length}
            </div>

            <div style={styles.gameArea}>
              <div
                style={styles.plantContainer}
                onDragOver={(e) => e.preventDefault()}
              >
                {currentLevelData.svg}

                {currentLevelData.dropzones.map((zone) => {
                  const filledKey = userAnswers[zone.id];
                  let zoneStyle = { ...styles.dropzone, top: zone.top, left: zone.left };

                  if (filledKey) {
                    zoneStyle = {
                      ...zoneStyle,
                      borderStyle: 'solid',
                      borderColor: '#fcd34d',
                      backgroundColor: '#fcd34d',
                      color: '#92400e',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    };
                  }

                  if (validated) {
                    if (filledKey === zone.id) {
                      zoneStyle = {
                        ...zoneStyle,
                        backgroundColor: '#4ade80',
                        borderColor: '#16a34a',
                        color: 'white'
                      };
                    } else {
                      zoneStyle = {
                        ...zoneStyle,
                        backgroundColor: '#fca5a5',
                        borderColor: '#ef4444',
                        color: '#7f1d1d'
                      };
                    }
                  }

                  return (
                    <div
                      key={zone.id}
                      style={zoneStyle}
                      onClick={() => handleZoneClick(zone.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(zone.id)}
                    >
                      {filledKey ? t[filledKey] : ''}
                    </div>
                  );
                })}
              </div>

              <div style={styles.labelsContainer}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, width: '100%', textAlign: 'center', color: '#334155', marginBottom: '8px' }}>
                  {t.words}
                </h2>

                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', width: '100%' }}>
                  {availableLabels.map((key) => (
                    <div
                      key={key}
                      style={styles.draggableItem}
                      draggable={!validated}
                      onDragStart={() => handleDragStart(key)}
                    >
                      {t[key]}
                    </div>
                  ))}
                </div>

                {allFilled && !validated && (
                  <button
                    style={{ ...styles.btnAction, marginTop: '24px' }}
                    onClick={validateAnswers}
                  >
                    {t.checkBtn}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Modal Level Win */}
          {activeModal === 'levelWin' && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalBox}>
                <div style={{ fontSize: '3.75rem', marginBottom: '16px' }}>🌟</div>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: '#16a34a', marginBottom: '8px' }}>{t.levelWinTitle}</h2>
                <p style={{ fontSize: '1.25rem', marginBottom: '24px', color: '#4b5563', fontWeight: 'bold' }}>{t.levelWinText}</p>
                <button onClick={nextLevel} style={styles.btnAction}>{t.nextBtn}</button>
              </div>
            </div>
          )}

          {/* Modal Game Win */}
          {activeModal === 'gameWin' && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalBox}>
                <div style={{ fontSize: '3.75rem', marginBottom: '16px' }}>🏆</div>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#16a34a', marginBottom: '8px' }}>{t.gameWinTitle}</h2>
                <p style={{ fontSize: '1.25rem', marginBottom: '24px', color: '#4b5563', fontWeight: 'bold' }}>{t.gameWinText}</p>
                <button onClick={restartGame} style={styles.btnAction}>{t.restartBtn}</button>
                <button
                  onClick={() => setMostrarEnvio(true)}
                  style={{ ...styles.btnAction, marginTop: 12, background: 'linear-gradient(to bottom, #3b82f6, #2563eb)', boxShadow: '0 6px 0 #1d4ed8, 0 10px 10px rgba(0,0,0,0.1)' }}
                >
                  📤 Enviar al profesor
                </button>
              </div>
            </div>
          )}

          {/* Modal Fail */}
          {activeModal === 'fail' && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalBox}>
                <div style={{ fontSize: '3.75rem', marginBottom: '16px' }}>😅</div>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: '#dc2626', marginBottom: '8px' }}>{t.failTitle}</h2>
                <p style={{ fontSize: '1.25rem', marginBottom: '24px', color: '#4b5563', fontWeight: 'bold' }}>{t.failText}</p>
                <button
                  onClick={retryLevel}
                  style={{
                    ...styles.btnAction,
                    background: 'linear-gradient(to bottom, #f87171, #ef4444)',
                    boxShadow: '0 6px 0 #b91c1c, 0 10px 10px rgba(0,0,0,0.1)'
                  }}
                >
                  {t.retryBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal enviar al profesor */}
      {mostrarEnvio && (
        <ModalEnviarProfe
          datos={{ niveles: levelsData.length }}
          onClose={() => setMostrarEnvio(false)}
        />
      )}
    </div>
  );
}
