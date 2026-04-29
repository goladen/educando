import React, { useState, useEffect } from 'react';
import { bibliotecaIrregularVerbs as verbosData } from './BibliotecaIrregularVerbs';
import { db } from './firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { Share2, Send } from 'lucide-react';

// Modal para enviar al profesor
function ModalEnviarProfe({ onClose, score, config }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [curso, setCurso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
      if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'IRREGULAR_VERBS', modalidad: 'Individual', fecha: new Date(),
        recursoId: 'irregular-verbs-test', recursoTitulo: 'Test de Verbos Irregulares',
        codigoProfesor: code,
        config: { nivel: config?.level, numVerbos: config?.numVerbs, modo: config?.columnsMode },
        jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: score.points, intentos: score.maxPoints }],
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
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
              ['curso', 'Curso', curso, setCurso, 'Ej: 3º ESO A', false],
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

export default function IrregularVerbsTest() {
  const [step, setStep] = useState('home'); // 'home', 'config', 'test', 'results'
  const [config, setConfig] = useState({
    level: 'sencillo',
    numVerbs: 10,
    timeLimit: 60, // en segundos
    columnsMode: 'all', // 'all', 'base_past', 'no_translation'
  });

  const [testData, setTestData] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState({ points: 0, maxPoints: 0 });
  const [showModalEnviar, setShowModalEnviar] = useState(false);

  // Función para compartir
  const compartir = async () => {
    const url = window.location.href;
    const texto = `¡He hecho un test de verbos irregulares! Puntuación: ${score.points}/${score.maxPoints}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Test de Verbos Irregulares', text: texto, url });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(`${texto} ${url}`);
      alert('Enlace copiado al portapapeles');
    }
  };

  // Definición de las columnas según la configuración
  const getActiveColumns = (mode) => {
    switch (mode) {
      case 'base_past':
        return ['baseForm', 'pastSimple'];
      case 'no_translation':
        return ['baseForm', 'pastSimple', 'pastParticiple'];
      case 'all':
      default:
        return ['baseForm', 'pastSimple', 'pastParticiple', 'translation'];
    }
  };

  const columnLabels = {
    baseForm: 'Base Form',
    pastSimple: 'Past Simple',
    pastParticiple: 'Past Participle',
    translation: 'Traducción'
  };

  // Temporizador
  useEffect(() => {
    let timer;
    if (step === 'test' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (step === 'test' && timeLeft === 0) {
      handleCorregir(); // Autocorrección si se acaba el tiempo
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Iniciar el test y generar los datos
  const handleStartTest = () => {
    // 1. Filtrar por nivel
    const allowedLevels = 
      config.level === 'sencillo' ? ['sencillo'] :
      config.level === 'medio' ? ['sencillo', 'medio'] :
      ['sencillo', 'medio', 'dificil'];

    const filteredVerbs = verbosData.filter(v => allowedLevels.includes(v.level));

    // 2. Seleccionar aleatoriamente
    const shuffled = [...filteredVerbs].sort(() => 0.5 - Math.random());
    const selectedVerbs = shuffled.slice(0, config.numVerbs);

    // 3. Preparar los datos del test (elegir qué columna dar como pista)
    const activeCols = getActiveColumns(config.columnsMode);
    
    const preparedTestData = selectedVerbs.map((verb, index) => {
      const randomColIndex = Math.floor(Math.random() * activeCols.length);
      const givenCol = activeCols[randomColIndex];
      return {
        id: index,
        verbData: verb,
        givenCol: givenCol
      };
    });

    setTestData(preparedTestData);
    setUserAnswers({});
    setTimeLeft(config.timeLimit);
    setStep('test');
  };

  // Manejar el input del usuario
  const handleInputChange = (verbId, col, value) => {
    setUserAnswers(prev => ({
      ...prev,
      [`${verbId}-${col}`]: value
    }));
  };

  // Función de normalización para corregir (ignora acentos y mayúsculas)
  const normalizeString = (str) => {
    if (!str) return '';
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .toLowerCase()
      .trim();
  };

  // Comprobar si la respuesta es correcta
  const isCorrect = (userInput, correctAnswer) => {
    const inputNorm = normalizeString(userInput);
    // Dividir la respuesta correcta por '/' por si hay dos opciones (ej. burnt/burned)
    const validOptions = correctAnswer.split('/').map(normalizeString);
    return validOptions.includes(inputNorm);
  };

  // Corregir el test
  const handleCorregir = () => {
    let points = 0;
    let maxPoints = 0;
    const activeCols = getActiveColumns(config.columnsMode);

    testData.forEach((row) => {
      activeCols.forEach(col => {
        if (col !== row.givenCol) {
          maxPoints++;
          const userAns = userAnswers[`${row.id}-${col}`];
          if (isCorrect(userAns, row.verbData[col])) {
            points++;
          }
        }
      });
    });

    setScore({ points, maxPoints });
    setStep('results');
  };

  // Formatear el tiempo (MM:SS)
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // RENDERIZADOS CONDICIONALES
  if (step === 'home') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <button 
          onClick={() => setStep('config')}
          style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', padding: '16px 32px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '20px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          Hacer un test
        </button>
      </div>
    );
  }

  if (step === 'config') {
    return (
      <div style={{ maxWidth: '28rem', margin: '0 auto', marginTop: '40px', padding: '24px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center' }}>Configurar Test</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Nivel de dificultad:</label>
            <select 
              value={config.level} 
              onChange={e => setConfig({...config, level: e.target.value})}
              style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', borderRadius: '4px' }}
            >
              <option value="sencillo">Sencillo</option>
              <option value="medio">Medio (Sencillos y Medios)</option>
              <option value="dificil">Difícil (Todos)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Número de verbos:</label>
            <input 
              type="number" 
              min="1" 
              max={verbosData.length}
              value={config.numVerbs} 
              onChange={e => setConfig({...config, numVerbs: parseInt(e.target.value) || 1})}
              style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Tiempo (segundos):</label>
            <input 
              type="number" 
              min="10"
              value={config.timeLimit} 
              onChange={e => setConfig({...config, timeLimit: parseInt(e.target.value) || 60})}
              style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Columnas a evaluar:</label>
            <select 
              value={config.columnsMode} 
              onChange={e => setConfig({...config, columnsMode: e.target.value})}
              style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', borderRadius: '4px' }}
            >
              <option value="all">Las 4 columnas</option>
              <option value="no_translation">Sin traducción (3 columnas)</option>
              <option value="base_past">Solo Base y Past Simple (2 columnas)</option>
            </select>
          </div>

          <button 
            onClick={handleStartTest}
            style={{ width: '100%', marginTop: '24px', backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', padding: '12px 16px', borderRadius: '4px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
          >
            Empezar test
          </button>
        </div>
      </div>
    );
  }

  const activeCols = getActiveColumns(config.columnsMode);

  return (
    <>
      {showModalEnviar && <ModalEnviarProfe onClose={() => setShowModalEnviar(false)} score={score} config={config} />}
      <div style={{ maxWidth: '56rem', margin: '0 auto', marginTop: '40px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Test de Verbos Irregulares</h2>
        {step === 'test' && (
          <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold', padding: '8px 16px', borderRadius: '4px', backgroundColor: timeLeft <= 10 ? '#fef2f2' : '#f3f4f6', color: timeLeft <= 10 ? '#dc2626' : 'inherit' }}>
            Tiempo: {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderRadius: '8px' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#1f2937', color: 'white' }}>
            <tr>
              {activeCols.map(col => (
                <th key={col} style={{ padding: '12px', borderBottom: '1px solid #374151' }}>{columnLabels[col]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {testData.map((row) => (
              <tr key={row.id} style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
                {activeCols.map(col => {
                  const isGiven = col === row.givenCol;
                  const val = isGiven ? row.verbData[col] : (userAnswers[`${row.id}-${col}`] || '');
                  
                  // Estilos para la pantalla de resultados
                  let resultStyle = { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' };
                  if (step === 'results' && !isGiven) {
                    const correct = isCorrect(val, row.verbData[col]);
                    resultStyle = { ...resultStyle, backgroundColor: correct ? '#dcfce7' : '#fef2f2', borderColor: correct ? '#16a34a' : '#dc2626', color: correct ? '#166534' : '#991b1b', fontWeight: '600' };
                    if (!correct) resultStyle.textDecoration = 'line-through';
                  } else if (isGiven) {
                    resultStyle = { ...resultStyle, backgroundColor: '#e5e7eb', fontWeight: '600', cursor: 'not-allowed' };
                  }

                  return (
                    <td key={col} style={{ padding: '12px' }}>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleInputChange(row.id, col, e.target.value)}
                        disabled={isGiven || step === 'results'}
                        style={resultStyle}
                        placeholder={isGiven ? '' : '...'}
                      />
                      {/* Mostrar la respuesta correcta debajo si se falló */}
                      {step === 'results' && !isGiven && !isCorrect(val, row.verbData[col]) && (
                        <div style={{ fontSize: '14px', color: '#15803d', marginTop: '4px', fontWeight: 'bold' }}>
                          {row.verbData[col]}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        {step === 'test' ? (
          <button 
            onClick={handleCorregir}
            style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            Corregir Test
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '16px', borderRadius: '8px', display: 'inline-block' }}>
              Puntuación: <span style={{ color: score.points === score.maxPoints ? '#15803d' : '#2563eb' }}>{score.points}</span> / {score.maxPoints}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                onClick={() => setStep('config')}
                style={{ backgroundColor: '#1f2937', color: 'white', fontWeight: 'bold', padding: '12px 32px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#111827'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
              >
                Volver a configurar
              </button>
              <button 
                onClick={compartir}
                style={{ backgroundColor: '#7c3aed', color: 'white', fontWeight: 'bold', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6d28d9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                title="Compartir"
              >
                <Share2 size={16} />
                Compartir
              </button>
              <button 
                onClick={() => setShowModalEnviar(true)}
                style={{ backgroundColor: '#ea580c', color: 'white', fontWeight: 'bold', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c2410c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
                title="Enviar al profesor"
              >
                <Send size={16} />
                Enviar al profesor
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}