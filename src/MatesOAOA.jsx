import React, { useState, useEffect, useRef } from 'react';
import sonidoCorrecto from './assets/sonidorespcorrecta.mp3';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

// ── Bloques visuales de decenas y unidades ──────────────────────────────────
function BloquesNumero({ numero, colorDecena, colorUnidad, colorCentena }) {
  const n = Math.max(0, Math.round(numero));
  const centenas = Math.floor(n / 100);
  const decenas  = Math.floor((n % 100) / 10);
  const unidades = n % 10;
  const colC = colorCentena || colorDecena;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignItems: 'flex-end', minHeight: 60 }}>
      {centenas > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {centenas > 1 && (
            <div style={{
              background: colC, color: 'white', fontWeight: 900, fontSize: '0.8rem',
              borderRadius: 10, padding: '1px 7px', letterSpacing: '0.03em'
            }}>×{centenas}</div>
          )}
          <div style={{
            display: 'flex', flexDirection: 'row', gap: 1,
            background: colC, borderRadius: 6, padding: '2px',
            boxShadow: '0 5px 14px rgba(0,0,0,0.25)', transition: 'all 0.3s ease'
          }}>
            {Array.from({ length: 10 }).map((_, col) => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Array.from({ length: 10 }).map((_, row) => (
                  <div key={row} style={{ width: 9, height: 9, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.from({ length: decenas }).map((_, i) => (
        <div key={`d${i}`} style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          background: colorDecena, borderRadius: 5, padding: '3px',
          boxShadow: '0 3px 8px rgba(0,0,0,0.15)', transition: 'all 0.3s ease'
        }}>
          {Array.from({ length: 10 }).map((_, j) => (
            <div key={j} style={{ width: 11, height: 11, background: 'rgba(255,255,255,0.45)', borderRadius: 2 }} />
          ))}
        </div>
      ))}
      {unidades > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 42, alignContent: 'flex-end' }}>
          {Array.from({ length: unidades }).map((_, i) => (
            <div key={i} style={{
              width: 17, height: 17, background: colorUnidad,
              borderRadius: 4, boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.3s ease'
            }} />
          ))}
        </div>
      )}
      {n === 0 && <div style={{ color: '#ddd', fontSize: '1.8rem', alignSelf: 'center' }}>∅</div>}
    </div>
  );
}

// ── Botón redondo ────────────────────────────────────────────────────────────
function BtnRedondo({ children, onClick, disabled, color, size = 'lg' }) {
  const dim = size === 'lg' ? 60 : size === 'md' ? 50 : 42;
  const fs  = size === 'lg' ? '1.3rem' : size === 'md' ? '1.05rem' : '0.95rem';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(0.88)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      style={{
        width: dim, height: dim, borderRadius: '50%',
        background: disabled ? '#ececec' : color,
        color: disabled ? '#bbb' : 'white',
        border: 'none', fontWeight: 900, fontSize: fs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : `0 5px 14px ${color}66`,
        transition: 'transform 0.1s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >{children}</button>
  );
}

// ── Helper descomposición ─────────────────────────────────────────────────────
function descomponer(n) {
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (c > 0) return `${c} cent. + ${d} dec. + ${u} uni.`;
  return `${d} dec. + ${u} uni.`;
}

// ── Tarjeta de número (solo lectura) ─────────────────────────────────────────
function TarjetaFija({ numero, label, colorBorde, colorD, colorU, colorC }) {
  return (
    <div style={{
      background: 'white', borderRadius: 22, padding: '16px 14px',
      border: `3px solid ${colorBorde}`, boxShadow: `0 5px 18px ${colorBorde}22`,
      textAlign: 'center', flex: '1 1 150px', maxWidth: 200
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: colorBorde, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '2.8rem', fontWeight: 900, color: colorBorde, lineHeight: 1 }}>{numero}</div>
      <div style={{ color: '#ccc', fontSize: '0.75rem', margin: '4px 0 12px' }}>{descomponer(numero)}</div>
      <BloquesNumero numero={numero} colorDecena={colorD} colorUnidad={colorU} colorCentena={colorC} />
    </div>
  );
}

// ── Corazones flotantes ───────────────────────────────────────────────────────
function Corazones({ visible }) {
  if (!visible) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
      {[0,1,2,3,4].map(i => (
        <span key={i} style={{ fontSize: '2.4rem', display: 'inline-block', animation: `heartPop 0.5s ease ${i * 0.1}s both` }}>❤️</span>
      ))}
    </div>
  );
}

// ── Generador de retos ────────────────────────────────────────────────────────
function generarReto(op, experto = false) {
  if (experto) {
    if (op === 'suma') {
      const a = Math.floor(Math.random() * 400) + 100;
      const b = Math.floor(Math.random() * 400) + 100;
      return { a, b };
    } else {
      let a, b;
      do {
        a = Math.floor(Math.random() * 700) + 200;
        b = Math.floor(Math.random() * 600) + 100;
      } while (b >= a);
      return { a, b };
    }
  }
  if (op === 'suma') {
    const a = Math.floor(Math.random() * 7) * 10 + Math.floor(Math.random() * 10) + 10;
    const b = Math.floor(Math.random() * 5) * 10 + Math.floor(Math.random() * 10) + 10;
    return { a, b };
  } else {
    let a, b;
    do {
      a = Math.floor(Math.random() * 6) * 10 + 30 + Math.floor(Math.random() * 9);
      b = Math.floor(Math.random() * 5) * 10 + Math.floor(Math.random() * 9) + 10;
    } while (b >= a);
    return { a, b };
  }
}

function fmtTiempo(s) {
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${m}:${String(seg).padStart(2, '0')}`;
}

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
      const totalAciertos  = datos.aciertosSumas + datos.aciertosRestas;
      const totalIntentos  = datos.intentosSumas + datos.intentosRestas;
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'OAOA',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        jugadores: [{
          nombre:   nombre.trim(),
          curso:    curso.trim(),
          aciertos: totalAciertos,
          intentos: totalIntentos,
          porcentaje: Math.round((totalAciertos / Math.max(1, totalIntentos)) * 100),
          sumas:  { aciertos: datos.aciertosSumas,  intentos: datos.intentosSumas  },
          restas: { aciertos: datos.aciertosRestas, intentos: datos.intentosRestas },
        }],
      });
      guardarRegistroLocal('OAOA', {
        titulo: 'Mates OAOA', aciertos: totalAciertos, intentos: totalIntentos,
        nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
      });
      setEnviado(true);
    } catch (e) { setError('Error al enviar: ' + e.message); }
    setEnviando(false);
  };

  const inp = {
    padding: '9px 12px', borderRadius: 9,
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white',
    fontSize: '0.9rem', outline: 'none', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
            <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.88rem' }}>
              ➕ Sumas: {datos.aciertosSumas}/{datos.intentosSumas} &nbsp;·&nbsp; ➖ Restas: {datos.aciertosRestas}/{datos.intentosRestas}
            </div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Resumen de resultados */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, background: 'rgba(255,107,53,0.15)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#FFB347', fontWeight: 700 }}>➕ SUMAS</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{datos.aciertosSumas}<span style={{ fontSize: '0.75rem', color: '#aaa' }}>/{datos.intentosSumas}</span></div>
              </div>
              <div style={{ flex: 1, background: 'rgba(233,30,99,0.15)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#F48FB1', fontWeight: 700 }}>➖ RESTAS</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{datos.aciertosRestas}<span style={{ fontSize: '0.75rem', color: '#aaa' }}>/{datos.intentosRestas}</span></div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellido</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
              <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º Primaria A" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10}
                style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
            </div>
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function SimuladorOAOA() {
  // Inicializar con números aleatorios desde el primer render
  const [op, setOp]     = useState('suma');
  const initReto        = generarReto('suma');
  const [a, setA]       = useState(initReto.a);
  const [b, setB]       = useState(initReto.b);
  const [respuesta, setResp]  = useState(initReto.a);
  const [estado, setEstado]   = useState('jugando');

  // Tracking por operación (persiste toda la sesión)
  const [intentosSumas,   setIntSumas]  = useState(0);
  const [aciertosSumas,   setAciSumas]  = useState(0);
  const [intentosRestas,  setIntRestas] = useState(0);
  const [aciertosRestas,  setAciRestas] = useState(0);
  const [mostrarEnvio,    setMostrarEnvio] = useState(false);
  const [modoExperto,     setModoExperto]  = useState(false);

  // Modo contrarreloj
  const [modo, setModo]           = useState('libre');
  const [segundos, setSegundos]   = useState(180);
  const [aciertos, setAciertos]   = useState(0);
  const [timerOn, setTimerOn]     = useState(false);
  const [fin, setFin]             = useState(false);

  const audioRef    = useRef(new Audio(sonidoCorrecto));
  const timerRef    = useRef(null);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerOn && !fin) {
      timerRef.current = setInterval(() => {
        setSegundos(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setTimerOn(false);
            setFin(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerOn, fin]);

  const colorTimer = segundos > 60 ? '#4CAF50' : segundos > 30 ? '#FF9800' : '#E91E63';
  const pctTimer   = (segundos / 180) * 100;

  const correcto = op === 'suma' ? a + b : a - b;
  const minResp  = 0;
  const maxResp  = op === 'suma' ? (modoExperto ? 999 : 199) : a;

  const cambiarResp = (delta) => {
    if (estado === 'correcto') return;
    setResp(prev => Math.max(minResp, Math.min(maxResp, prev + delta)));
    if (estado === 'fallo') setEstado('jugando');
  };

  const cargarSiguiente = (opActual, exp = modoExperto) => {
    const { a: na, b: nb } = generarReto(opActual, exp);
    setA(na); setB(nb); setResp(na); setEstado('jugando');
  };

  const comprobar = () => {
    // Registrar intento siempre
    if (op === 'suma') setIntSumas(prev => prev + 1);
    else               setIntRestas(prev => prev + 1);

    if (respuesta === correcto) {
      setEstado('correcto');
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      // Registrar acierto
      if (op === 'suma') setAciSumas(prev => prev + 1);
      else               setAciRestas(prev => prev + 1);

      if (modo === 'contrarreloj') {
        setAciertos(prev => prev + 1);
        setTimeout(() => cargarSiguiente(op), 1200);
      }
    } else {
      setEstado('fallo');
    }
  };

  const siguiente = () => cargarSiguiente(op);

  const cambiarOp = (o) => {
    setOp(o);
    const { a: na, b: nb } = generarReto(o, modoExperto);
    setA(na); setB(nb); setResp(na); setEstado('jugando');
  };

  const toggleExperto = () => {
    const next = !modoExperto;
    setModoExperto(next);
    const { a: na, b: nb } = generarReto(op, next);
    setA(na); setB(nb); setResp(na); setEstado('jugando');
  };

  // Arrancar modo contrarreloj
  const iniciarContrarreloj = () => {
    setModo('contrarreloj');
    setSegundos(180);
    setAciertos(0);
    setFin(false);
    setTimerOn(true);
    const { a: na, b: nb } = generarReto(op, modoExperto);
    setA(na); setB(nb); setResp(na); setEstado('jugando');
  };

  // Volver a modo libre
  const volverLibre = () => {
    clearInterval(timerRef.current);
    setModo('libre');
    setTimerOn(false);
    setFin(false);
    setSegundos(180);
    setAciertos(0);
    cargarSiguiente(op);
  };

  const signo        = op === 'suma' ? '+' : '−';
  const colorRes     = estado === 'correcto' ? '#4CAF50' : estado === 'fallo' ? '#E91E63' : '#9C27B0';
  const colorUnidRes = estado === 'correcto' ? '#81C784' : estado === 'fallo' ? '#F48FB1' : '#CE93D8';

  // ── PANTALLA FINAL CONTRARRELOJ ────────────────────────────────────────────
  if (fin) {
    return (
      <>
      <div style={{
        maxWidth: 600, margin: '0 auto', padding: '80px 20px 60px',
        fontFamily: "'Segoe UI', Nunito, Arial, sans-serif",
        background: 'linear-gradient(160deg, #fff8f0 0%, #f0f9ff 100%)',
        minHeight: '100vh', textAlign: 'center'
      }}>
        <style>{keyframesCSS}</style>
        <div style={{ fontSize: '5rem', marginBottom: 12 }}>🏆</div>
        <h1 style={{ fontSize: '2.2rem', color: '#2c3e50', fontWeight: 900, margin: '0 0 8px' }}>¡Tiempo!</h1>
        <p style={{ color: '#aaa', fontSize: '1.05rem', marginBottom: 32 }}>Has terminado los 3 minutos</p>

        <div style={{
          background: 'white', borderRadius: 28, padding: '32px 24px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.1)', marginBottom: 32, display: 'inline-block', minWidth: 260
        }}>
          <div style={{ fontSize: '1rem', color: '#bbb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Operaciones acertadas</div>
          <div style={{ fontSize: '6rem', fontWeight: 900, color: '#4CAF50', lineHeight: 1, animation: 'bounceIn 0.5s ease' }}>{aciertos}</div>
          <div style={{ marginTop: 16, fontSize: '1.4rem' }}>
            {aciertos >= 15 ? '🌟🌟🌟 ¡Extraordinario!' :
             aciertos >= 10 ? '🌟🌟 ¡Muy bien!' :
             aciertos >= 5  ? '🌟 ¡Buen trabajo!' :
             '💪 ¡Sigue practicando!'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={iniciarContrarreloj} style={{
            padding: '16px 40px', fontSize: '1.1rem', fontWeight: 900,
            background: 'linear-gradient(135deg, #FF6B35 0%, #E91E63 100%)',
            color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(255,107,53,0.35)'
          }}>⏱ Jugar de nuevo</button>
          <button onClick={() => setMostrarEnvio(true)} style={{
            padding: '15px 32px', fontSize: '1rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #f1c40f, #e67e22)',
            color: 'white', border: 'none', borderRadius: 18, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(241,196,15,0.4)'
          }}>📤 Enviar al profesor</button>
          <button onClick={volverLibre} style={{
            padding: '15px 32px', fontSize: '1rem', fontWeight: 700,
            background: 'white', color: '#aaa', border: '2px solid #e8e8e8',
            borderRadius: 18, cursor: 'pointer'
          }}>Modo libre</button>
        </div>
      </div>

      {mostrarEnvio && (
        <ModalEnviarProfe
          datos={{ aciertosSumas, intentosSumas, aciertosRestas, intentosRestas }}
          onClose={() => setMostrarEnvio(false)}
        />
      )}
      </>
    );
  }

  // ── PANTALLA PRINCIPAL ─────────────────────────────────────────────────────
  return (
    <>
    <div style={{
      maxWidth: 880, margin: '0 auto', padding: '70px 14px 50px',
      fontFamily: "'Segoe UI', Nunito, Arial, sans-serif",
      background: 'linear-gradient(160deg, #fff8f0 0%, #f0f9ff 100%)',
      minHeight: '100vh',
    }}>
      <style>{keyframesCSS}</style>

      {/* BARRA CONTRARRELOJ */}
      {modo === 'contrarreloj' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.5rem' }}>⏱</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: colorTimer, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTiempo(segundos)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4CAF50' }}>✓ {aciertos}</span>
              <button onClick={volverLibre} style={{
                background: 'none', border: '2px solid #ddd', borderRadius: 10,
                color: '#bbb', fontWeight: 700, fontSize: '0.8rem', padding: '4px 12px', cursor: 'pointer'
              }}>Salir</button>
            </div>
          </div>
          {/* Barra de progreso */}
          <div style={{ background: '#eee', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div style={{
              width: `${pctTimer}%`, height: '100%',
              background: colorTimer, borderRadius: 8,
              transition: 'width 1s linear, background 0.5s'
            }} />
          </div>
        </div>
      )}

      {/* TÍTULO */}
      <div style={{ textAlign: 'center', marginBottom: modo === 'contrarreloj' ? 16 : 22 }}>
        <div style={{ fontSize: '2.6rem' }}>🧮</div>
        <h1 style={{ fontSize: '1.7rem', margin: '4px 0 2px', color: '#2c3e50', fontWeight: 900 }}>
          Bloques de Decenas y Unidades
        </h1>
        {modo === 'libre' && (
          <p style={{ color: '#bbb', margin: 0, fontSize: '0.88rem' }}>
            Mueve la tarjeta resultado hasta llegar a la respuesta
          </p>
        )}
      </div>

      {/* SELECTOR OPERACIÓN + BOTÓN CONTRARRELOJ */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { id: 'suma',  label: '➕ Suma',  bg: '#FF6B35' },
          { id: 'resta', label: '➖ Resta', bg: '#E91E63' },
        ].map(o => (
          <button key={o.id} onClick={() => cambiarOp(o.id)} style={{
            padding: '10px 26px', borderRadius: 16,
            background: op === o.id ? o.bg : 'white',
            color: op === o.id ? 'white' : '#bbb',
            border: `3px solid ${op === o.id ? o.bg : '#e8e8e8'}`,
            fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
            boxShadow: op === o.id ? `0 4px 14px ${o.bg}44` : 'none',
            transition: 'all 0.2s'
          }}>{o.label}</button>
        ))}
        {modo === 'libre' && (
          <button onClick={iniciarContrarreloj} style={{
            padding: '10px 22px', borderRadius: 16, fontWeight: 800, fontSize: '0.95rem',
            background: 'linear-gradient(135deg, #FF6B35, #E91E63)',
            color: 'white', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(255,107,53,0.4)'
          }}>⏱ Contrarreloj</button>
        )}
        <button onClick={toggleExperto} style={{
          padding: '10px 22px', borderRadius: 16, fontWeight: 800, fontSize: '0.95rem',
          background: modoExperto ? 'linear-gradient(135deg, #5C6BC0, #311B92)' : 'white',
          color: modoExperto ? 'white' : '#bbb',
          border: modoExperto ? 'none' : '3px solid #e8e8e8',
          cursor: 'pointer',
          boxShadow: modoExperto ? '0 4px 14px rgba(92,107,192,0.4)' : 'none',
          transition: 'all 0.2s'
        }}>🧠 {modoExperto ? 'Experto ✓' : 'Modo Experto'}</button>
      </div>

      {/* ENUNCIADO */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          background: 'white', borderRadius: 20, padding: '12px 30px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.07)', fontSize: '2.6rem', fontWeight: 900
        }}>
          <span style={{ color: '#FF6B35' }}>{a}</span>
          <span style={{ color: '#bbb' }}>{signo}</span>
          <span style={{ color: '#039BE5' }}>{b}</span>
          <span style={{ color: '#bbb' }}>=</span>
          <span style={{ color: '#ddd' }}>?</span>
        </div>
      </div>

      {/* TRES TARJETAS */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>

        <TarjetaFija numero={a} label="Número A" colorBorde="#FF6B35" colorD="#FF6B35" colorU="#FFB347" colorC="#BF360C" />

        <div style={{ display: 'flex', alignItems: 'center', fontSize: '2.8rem', fontWeight: 900, color: '#ddd', paddingTop: 38, flexShrink: 0 }}>
          {signo}
        </div>

        <TarjetaFija numero={b} label="Número B" colorBorde="#4FC3F7" colorD="#4FC3F7" colorU="#81D4FA" colorC="#01579B" />

        <div style={{ display: 'flex', alignItems: 'center', fontSize: '2.8rem', fontWeight: 900, color: '#ddd', paddingTop: 38, flexShrink: 0 }}>
          =
        </div>

        {/* Tarjeta RESULTADO */}
        <div style={{
          background: 'white', borderRadius: 22, padding: '16px 14px',
          border: `3px solid ${colorRes}`,
          boxShadow: `0 5px 22px ${colorRes}30`,
          textAlign: 'center', flex: '1 1 170px', maxWidth: 210,
          animation: estado === 'fallo' ? 'shake 0.4s ease' : estado === 'correcto' ? 'bounceIn 0.4s ease' : 'none',
          transition: 'border-color 0.3s, box-shadow 0.3s'
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: colorRes, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
            {estado === 'correcto' ? '¡Resultado! ✅' : 'Tu respuesta'}
          </div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, color: colorRes, lineHeight: 1 }}>{respuesta}</div>
          <div style={{ color: '#ccc', fontSize: '0.75rem', margin: '4px 0 12px' }}>
            {descomponer(respuesta)}
          </div>

          <BloquesNumero numero={respuesta} colorDecena={colorRes} colorUnidad={colorUnidRes}
            colorCentena={estado === 'correcto' ? '#1B5E20' : estado === 'fallo' ? '#880E4F' : '#311B92'} />

          {estado !== 'correcto' && (
            <>
              {modoExperto && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                  <BtnRedondo onClick={() => cambiarResp(-100)} disabled={respuesta < 100} color="#5C6BC0" size="lg">−100</BtnRedondo>
                  <BtnRedondo onClick={() => cambiarResp(+100)} disabled={respuesta + 100 > maxResp} color="#5C6BC0" size="lg">+100</BtnRedondo>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: modoExperto ? 8 : 16 }}>
                <BtnRedondo onClick={() => cambiarResp(-10)} disabled={respuesta < 10} color={colorRes} size="lg">−10</BtnRedondo>
                <BtnRedondo onClick={() => cambiarResp(+10)} disabled={respuesta + 10 > maxResp} color={colorRes} size="lg">+10</BtnRedondo>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                <BtnRedondo onClick={() => cambiarResp(-5)} disabled={respuesta < 5} color="#AB47BC" size="md">−5</BtnRedondo>
                <BtnRedondo onClick={() => cambiarResp(+5)} disabled={respuesta + 5 > maxResp} color="#AB47BC" size="md">+5</BtnRedondo>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                <BtnRedondo onClick={() => cambiarResp(-1)} disabled={respuesta <= 0} color="#CE93D8" size="sm">−1</BtnRedondo>
                <BtnRedondo onClick={() => cambiarResp(+1)} disabled={respuesta + 1 > maxResp} color="#CE93D8" size="sm">+1</BtnRedondo>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MENSAJE ÉXITO */}
      {estado === 'correcto' && (
        <div style={{ textAlign: 'center', marginBottom: 20, animation: 'bounceIn 0.5s ease' }}>
          <Corazones visible />
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#4CAF50', marginBottom: 4 }}>
            ¡Lo has hecho muy bien! 🌟
          </div>
          <div style={{ color: '#aaa', fontSize: '1rem' }}>
            {a} {signo} {b} = <strong style={{ color: '#4CAF50' }}>{correcto}</strong>
          </div>
        </div>
      )}

      {/* MENSAJE FALLO */}
      {estado === 'fallo' && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#E91E63' }}>
            ¡Casi! 💪 Sigue intentándolo
          </div>
          <div style={{ color: '#bbb', fontSize: '0.88rem', marginTop: 4 }}>
            Pista: suma de 10 en 10 desde el número A
          </div>
        </div>
      )}

      {/* BOTONES */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {estado !== 'correcto' && (
          <button onClick={comprobar} style={{
            padding: '15px 40px', fontSize: '1.1rem', fontWeight: 900,
            background: 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)',
            color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(156,39,176,0.35)', transition: 'transform 0.15s'
          }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >✓ Comprobar</button>
        )}
        {(estado === 'correcto' && modo !== 'contrarreloj') && (
          <button onClick={siguiente} style={{
            padding: '14px 36px', fontSize: '1rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
            color: 'white', border: 'none', borderRadius: 18, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(76,175,80,0.35)'
          }}>🎲 Siguiente reto</button>
        )}
        {estado !== 'correcto' && modo === 'libre' && (
          <button onClick={siguiente} style={{
            padding: '14px 28px', fontSize: '0.95rem', fontWeight: 700,
            background: 'white', color: '#aaa', border: '2px solid #e8e8e8',
            borderRadius: 18, cursor: 'pointer'
          }}>🎲 Nuevo reto</button>
        )}
        <button onClick={() => setMostrarEnvio(true)} style={{
          padding: '14px 24px', fontSize: '0.9rem', fontWeight: 700,
          background: 'linear-gradient(135deg, #f1c40f, #e67e22)',
          color: 'white', border: 'none', borderRadius: 18, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(241,196,15,0.35)'
        }}>📤 Enviar al profesor</button>
      </div>

      {/* LEYENDA */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 1, background: '#BF360C', borderRadius: 4, padding: '2px' }}>
            {Array.from({ length: 3 }).map((_, col) => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Array.from({ length: 3 }).map((_, row) => (
                  <div key={row} style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
                ))}
              </div>
            ))}
          </div>
          <span style={{ color: '#bbb', fontSize: '0.82rem', fontWeight: 600 }}>= 1 centena (100)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: '#FF6B35', borderRadius: 4, padding: 2 }}>
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} style={{ width: 9, height: 9, background: 'rgba(255,255,255,0.45)', borderRadius: 2 }} />
            ))}
          </div>
          <span style={{ color: '#bbb', fontSize: '0.82rem', fontWeight: 600 }}>= 1 decena (10)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 16, height: 16, background: '#FFB347', borderRadius: 3 }} />
          <span style={{ color: '#bbb', fontSize: '0.82rem', fontWeight: 600 }}>= 1 unidad (1)</span>
        </div>
      </div>
    </div>
    {mostrarEnvio && (
      <ModalEnviarProfe
        datos={{ aciertosSumas, intentosSumas, aciertosRestas, intentosRestas }}
        onClose={() => setMostrarEnvio(false)}
      />
    )}
    </>
  );
}

const keyframesCSS = `
  @keyframes heartPop {
    0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
    60%  { transform: scale(1.4) rotate(8deg); }
    100% { transform: scale(1)   rotate(0deg); opacity: 1; }
  }
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-8px); }
    40%     { transform: translateX(8px); }
    60%     { transform: translateX(-6px); }
    80%     { transform: translateX(6px); }
  }
  @keyframes bounceIn {
    0%   { transform: scale(0.5); opacity: 0; }
    70%  { transform: scale(1.1); }
    100% { transform: scale(1);   opacity: 1; }
  }
`;
