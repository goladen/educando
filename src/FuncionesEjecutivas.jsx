import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import JuegoMemoria from './JuegoMemoria';

const FuncionesEjecutivas = ({ onBack }) => {
  const [juegoActivo, setJuegoActivo] = useState(false);
  const [juegoSeleccionado, setJuegoSeleccionado] = useState(null); // 'atencion' o 'memoria'
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [tiempo, setTiempo] = useState(0);
  const [enunciado, setEnunciado] = useState('');
  const [palabra, setPalabra] = useState('');
  const [colorTexto, setColorTexto] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [respuestaCorrecta, setRespuestaCorrecta] = useState(null);
  const [respuestaEnOpciones, setRespuestaEnOpciones] = useState(false);
  const [juegoTerminado, setJuegoTerminado] = useState(false);
  const [mostrarModalEnvio, setMostrarModalEnvio] = useState(false);
  const [codigoProfe, setCodigoProfe] = useState('');
  const [nombreAlumno, setNombreAlumno] = useState('');
  const [cursoAlumno, setCursoAlumno] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [resultadoEnviado, setResultadoEnviado] = useState(false);

  const colores = ['amarillo', 'naranja', 'azul', 'rojo', 'verde', 'morado'];
  const formas = ['círculo', 'cuadrado', 'triángulo', 'hexágono'];
  const coloresHex = { amarillo: '#FFFF00', naranja: '#FFA500', azul: '#0000FF', rojo: '#FF0000', verde: '#00FF00', morado: '#800080' };

  const enunciados = [
    'toca el color que dice la palabra',
    'toca el color',
    'toca la forma'
  ];

  const generarPregunta = () => {
    const enunciadoAleatorio = enunciados[Math.floor(Math.random() * enunciados.length)];
    setEnunciado(enunciadoAleatorio);

    let palabraSeleccionada, colorTextoSeleccionado, correcta;

    if (enunciadoAleatorio === 'toca el color que dice la palabra') {
      // Palabra es un color, escrito en otro color
      palabraSeleccionada = colores[Math.floor(Math.random() * colores.length)];
      do {
        colorTextoSeleccionado = colores[Math.floor(Math.random() * colores.length)];
      } while (colorTextoSeleccionado === palabraSeleccionada);
      correcta = palabraSeleccionada; // Tocar el color de la palabra
    } else if (enunciadoAleatorio === 'toca el color') {
      // Palabra es cualquier cosa, tocar el color del texto
      const esColor = Math.random() > 0.5;
      palabraSeleccionada = esColor ? colores[Math.floor(Math.random() * colores.length)] : formas[Math.floor(Math.random() * formas.length)];
      colorTextoSeleccionado = colores[Math.floor(Math.random() * colores.length)];
      correcta = colorTextoSeleccionado; // Tocar el color del texto
    } else { // toca la forma
      // Palabra es una forma, escrita en un color
      palabraSeleccionada = formas[Math.floor(Math.random() * formas.length)];
      colorTextoSeleccionado = colores[Math.floor(Math.random() * colores.length)];
      correcta = palabraSeleccionada; // Tocar la forma
    }

    setPalabra(palabraSeleccionada);
    setColorTexto(colorTextoSeleccionado);
    setRespuestaCorrecta(correcta);

    // Generar opciones: siempre las 4 figuras, con colores únicos, en orden aleatorio
    const coloresDisponibles = [...colores].sort(() => Math.random() - 0.5).slice(0, 4);
    const opcionesGeneradas = formas.map((forma, index) => ({
      forma,
      color: coloresDisponibles[index]
    }));

    const respuestaEsta = enunciadoAleatorio === 'toca la forma'
      ? opcionesGeneradas.some(op => op.forma === correcta)
      : opcionesGeneradas.some(op => op.color === correcta);

    setRespuestaEnOpciones(respuestaEsta);
    setOpciones(opcionesGeneradas.sort(() => Math.random() - 0.5));
  };

  const iniciarJuego = () => {
    setJuegoActivo(true);
    setJuegoSeleccionado('atencion');
    setPreguntaActual(1);
    setAciertos(0);
    setTiempo(0);
    setJuegoTerminado(false);
    setResultadoEnviado(false);
    setMostrarModalEnvio(false);
    setCodigoProfe('');
    setNombreAlumno('');
    setCursoAlumno('');
    setErrorEnvio('');
    generarPregunta();
  };

  const iniciarAtencion = () => {
    setJuegoSeleccionado('atencion');
    setJuegoActivo(true);
    setPreguntaActual(1);
    setAciertos(0);
    setTiempo(0);
    setJuegoTerminado(false);
    setResultadoEnviado(false);
    setMostrarModalEnvio(false);
    setCodigoProfe('');
    setNombreAlumno('');
    setCursoAlumno('');
    setErrorEnvio('');
    generarPregunta();
  };

  const manejarClickOpcion = (opcion) => {
    let esCorrecta = false;
    if (opcion.noEsta) {
      esCorrecta = !respuestaEnOpciones;
    } else if (enunciado === 'toca el color que dice la palabra' || enunciado === 'toca el color') {
      esCorrecta = opcion.color === respuestaCorrecta;
    } else {
      esCorrecta = opcion.forma === respuestaCorrecta;
    }

    if (esCorrecta) {
      setAciertos(aciertos + 1);
    }

    if (preguntaActual < 10) {
      setPreguntaActual(preguntaActual + 1);
      generarPregunta();
    } else {
      setJuegoTerminado(true);
      setJuegoActivo(false);
    }
  };

  useEffect(() => {
    let timer;
    if (juegoActivo) {
      timer = setTimeout(() => setTiempo(tiempo + 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [juegoActivo, tiempo]);

  const containerStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    color: '#fff'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    maxWidth: '800px',
    width: '100%',
    textAlign: 'center'
  };

  const buttonStyle = {
    background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
    border: 'none',
    borderRadius: '25px',
    padding: '15px 30px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    transition: 'transform 0.3s',
    margin: '10px'
  };

  const backButtonStyle = {
    position: 'absolute',
    top: '20px',
    left: '20px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    fontSize: '20px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    transition: 'transform 0.3s'
  };

  const timerStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '10px 20px',
    borderRadius: '20px',
    margin: '10px 0'
  };

  const counterStyle = {
    fontSize: '18px',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '8px 16px',
    borderRadius: '15px',
    margin: '5px',
    display: 'inline-block'
  };

  const renderFigura = (forma, color) => {
    const estilo = {
      width: '100px',
      height: '100px',
      backgroundColor: coloresHex[color],
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'pointer',
      borderRadius: forma === 'círculo' ? '50%' : forma === 'triángulo' ? '0' : '15px',
      clipPath: forma === 'triángulo' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : forma === 'hexágono' ? 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)' : 'none',
      margin: '15px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      transition: 'transform 0.3s, box-shadow 0.3s',
      border: '3px solid #fff'
    };
    return (
      <div
        style={estilo}
        onClick={() => manejarClickOpcion({ forma, color })}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        }}
      ></div>
    );
  };

  const abrirModalEnvio = () => {
    setMostrarModalEnvio(true);
    setErrorEnvio('');
  };

  const cerrarModalEnvio = () => {
    setMostrarModalEnvio(false);
    setErrorEnvio('');
  };

  const enviarResultado = async () => {
    const code = codigoProfe.trim().toUpperCase();
    if (!nombreAlumno.trim()) { setErrorEnvio('Escribe tu nombre.'); return; }
    if (!code) { setErrorEnvio('Escribe el código del profesor.'); return; }
    setEnviando(true);
    setErrorEnvio('');

    try {
      const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
      if (!codigoDoc.exists()) {
        setErrorEnvio('Código no encontrado.');
        setEnviando(false);
        return;
      }

      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'FUNCIONES_EJECUTIVAS',
        modalidad: 'Individual',
        fecha: new Date(),
        recursoId: null,
        recursoTitulo: 'Funciones Ejecutivas',
        hoja: '',
        codigoProfesor: code,
        jugadores: [{
          nombre: nombreAlumno.trim(),
          curso: cursoAlumno.trim(),
          aciertos,
          fallos: 10 - aciertos,
          tiempo,
          hoja: ''
        }],
      });

      setResultadoEnviado(true);
      setMostrarModalEnvio(false);
    } catch (e) {
      setErrorEnvio('Error: ' + e.message);
    }
    setEnviando(false);
  };

  const sendButtonStyle = {
    background: 'linear-gradient(135deg, #3498db, #2980b9)',
    border: 'none',
    borderRadius: '18px',
    padding: '14px 28px',
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    transition: 'transform 0.3s, opacity 0.3s',
    marginTop: '20px'
  };

  if (juegoTerminado && juegoSeleccionado === 'atencion') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>←</button>
          <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>¡Juego Terminado!</h2>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <div style={counterStyle}>Aciertos: {aciertos}/10</div>
            <div style={counterStyle}>Tiempo: {tiempo}s</div>
          </div>
          <p style={{ color: '#e0e7ff', marginBottom: '20px' }}>Revisa tu resultado y envíalo al profesor para que lo reciba directamente.</p>
          {resultadoEnviado ? (
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '18px', borderRadius: '18px', color: '#d1fae5', fontWeight: 700 }}>
              ✅ Resultado enviado al profesor.
            </div>
          ) : (
            <button style={sendButtonStyle} onClick={abrirModalEnvio} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>📤 Enviar al profesor</button>
          )}
          <button style={{ ...buttonStyle, background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => { setJuegoTerminado(false); setJuegoActivo(false); setJuegoSeleccionado(null); }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>Jugar de Nuevo</button>
        </div>
        {mostrarModalEnvio && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 420, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                <button onClick={cerrarModalEnvio} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['nombre', 'Nombre y apellido', nombreAlumno, setNombreAlumno, 'Tu nombre completo'],
                  ['curso', 'Curso', cursoAlumno, setCursoAlumno, 'Ej: 3º ESO A'],
                  ['codigo', 'Código del profesor', codigoProfe, setCodigoProfe, 'Ej: PROF01']
                ].map(([key, label, val, setter, ph]) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                      style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: key === 'codigo' ? 2 : 0, fontWeight: key === 'codigo' ? 700 : 400 }} />
                  </div>
                ))}
                {errorEnvio && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {errorEnvio}</div>}
                <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                  <button onClick={cerrarModalEnvio} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                  <button onClick={enviarResultado} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {enviando ? 'Enviando…' : '📤 Enviar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Si se seleccionó el juego de memoria
  if (juegoSeleccionado === 'memoria') {
    return <JuegoMemoria onBack={() => setJuegoSeleccionado(null)} />;
  }

  if (!juegoActivo) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>←</button>
          <h1 style={{ fontSize: '48px', marginBottom: '30px', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>Funciones Ejecutivas</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px', margin: '0 auto' }}>
            <button 
              style={{ ...buttonStyle, background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)', fontSize: '20px', padding: '20px' }} 
              onClick={iniciarAtencion}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Atencion Sostenida
            </button>
            <button 
              style={{ ...buttonStyle, background: 'linear-gradient(45deg, #9b59b6, #e74c3c)', fontSize: '20px', padding: '20px' }} 
              onClick={() => setJuegoSeleccionado('memoria')}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Juego de Memoria
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Juego de Atención Sostenida
  if (juegoSeleccionado === 'atencion' && juegoActivo) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>←</button>
          <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>Atención Sostenida</h2>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={counterStyle}>Pregunta {preguntaActual}/10</div>
            <div style={counterStyle}>Aciertos: {aciertos}</div>
            <div style={timerStyle}>⏱️ {tiempo}s</div>
          </div>
          <p style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', background: 'rgba(255, 255, 255, 0.2)', padding: '15px', borderRadius: '15px' }}>{enunciado}</p>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: coloresHex[colorTexto], marginBottom: '30px', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{palabra}</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: 'calc(100% - 200px)' }}>
              {opciones.map((opcion, index) => (
                <div key={index}>
                  {renderFigura(opcion.forma, opcion.color)}
                </div>
              ))}
            </div>
            <button
              style={{
                minWidth: '180px',
                height: '100px',
                borderRadius: '25px',
                border: '3px dashed rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '18px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
                transition: 'transform 0.3s, background 0.3s'
              }}
              onClick={() => manejarClickOpcion({ noEsta: true })}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              NO ESTÁ
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default FuncionesEjecutivas;