// Quiz que se responde con los DEDOS delante de la webcam: 1, 2, 3 o 4 dedos
// levantados (sin contar el pulgar) = opción A, B, C o D. Hay que mantener el
// gesto un momento para que cuente. 1 jugador, o 2 jugadores (cada uno a un
// lado de la cámara). Preguntas: tablas, sumas y restas, propias o un recurso.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { escucharManos } from './manosVision.js';
import VistaManos, { useEstadoManos, AvisoEstadoManos } from './VistaManos.jsx';
import { GENERADORES, barajar, leerPropias, EJEMPLO_PROPIAS } from '../mandos/QuizMandos.jsx';
import SelectorRecursoMandos, { hojasQuiz } from '../mandos/SelectorRecursoMandos.jsx';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal, despertarAudio } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';

const COLORES = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
const LETRAS = ['A', 'B', 'C', 'D'];
const COLOR_JUG = ['#22d3ee', '#f472b6'];
const MANTENER_MS = 1000;
const PAUSA_RESULTADO = 3500;
const LS_PROPIAS = 'pikt_manos_preguntas';

const leerLS = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? def : v;
  } catch {
    return def;
  }
};

/** Dibujo de una mano con N dedos levantados (sin pulgar). */
function ManoDedos({ n, color = '#fff', alto = 34 }) {
  const ancho = alto * 0.95;
  return (
    <svg width={ancho} height={alto} viewBox="0 0 38 40" aria-label={`${n} dedos`}>
      {[0, 1, 2, 3].map((i) => {
        const arriba = i < n;
        const x = 6 + i * 7.5;
        const h = arriba ? 20 : 7;
        return <rect key={i} x={x} y={18 - h + (arriba ? 0 : 6)} width={6} height={h + 4} rx={3} fill={color} opacity={arriba ? 1 : 0.35} />;
      })}
      <rect x={4} y={20} width={32} height={17} rx={7} fill={color} />
    </svg>
  );
}

/** Reparte las manos detectadas entre los jugadores. */
function manosPorJugador(manos, numJug) {
  if (numJug === 1) return [manos[0] || null];
  const izq = manos.filter((m) => m.centro.x < 0.5).sort((a, b) => b.tamano - a.tamano)[0] || null;
  const der = manos.filter((m) => m.centro.x >= 0.5).sort((a, b) => b.tamano - a.tamano)[0] || null;
  return [izq, der];
}

/** Dedos que cuentan como respuesta (1..nOpciones) o 0 si el gesto no vale. */
const gestoRespuesta = (m, nOpc) => (m && !m.abierta && m.dedos >= 1 && m.dedos <= nOpc ? m.dedos : 0);

export default function QuizManos({ onExit }) {
  const [fase, setFase] = useState('config'); // config | pregunta | resultado | final
  const [tipo, setTipo] = useState('tablas');
  const [numJug, setNumJug] = useState(1);
  const [nombres, setNombres] = useState(['Jugador 1', 'Jugador 2']);
  const [numPreguntas, setNumPreguntas] = useState(8);
  const [tiempo, setTiempo] = useState(20);
  const [textoPropias, setTextoPropias] = useState(() => leerLS(LS_PROPIAS, EJEMPLO_PROPIAS));
  const [recurso, setRecurso] = useState(null);
  const [hojaSel, setHojaSel] = useState(-1);
  const [preguntas, setPreguntas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [restante, setRestante] = useState(0);
  const [puntos, setPuntos] = useState([0, 0]);
  const [aciertos, setAciertos] = useState([0, 0]);
  const [respuestas, setRespuestas] = useState([null, null]); // { idx, ms }
  const [vivo, setVivo] = useState([{ dedos: 0, prog: 0 }, { dedos: 0, prog: 0 }]);
  const estadoCam = useEstadoManos();

  const pregunta = preguntas[indice];
  const ref = useRef({});
  ref.current = { fase, pregunta, numJug, respuestas };
  const gesto = useRef([{ dedos: 0, desde: 0 }, { dedos: 0, desde: 0 }]);
  const inicioRef = useRef(0);
  const corregidaRef = useRef(false);

  const hojasRecurso = useMemo(() => (recurso ? hojasQuiz(recurso, false) : []), [recurso]);
  const preguntasRecurso = hojaSel < 0 ? hojasRecurso.flatMap((h) => h.preguntas) : hojasRecurso[hojaSel]?.preguntas || [];

  // ── Lectura de las manos ──────────────────────────────────────────────────
  useEffect(
    () =>
      escucharManos((manos) => {
        const { fase: f, pregunta: p, numJug: nj, respuestas: resp } = ref.current;
        const nOpc = p?.opciones?.length || 4;
        const ahora = performance.now();
        const porJug = manosPorJugador(manos, nj);
        const nuevoVivo = [{ dedos: 0, prog: 0 }, { dedos: 0, prog: 0 }];
        porJug.forEach((m, j) => {
          const g = gesto.current[j];
          const d = f === 'pregunta' ? gestoRespuesta(m, nOpc) : m ? (m.abierta ? 5 : m.dedos) : 0;
          if (d !== g.dedos) {
            g.dedos = d;
            g.desde = ahora;
          }
          const prog = d && f === 'pregunta' && !resp[j] ? Math.min(1, (ahora - g.desde) / MANTENER_MS) : 0;
          nuevoVivo[j] = { dedos: m ? (m.abierta ? 5 : m.dedos) : -1, prog: Math.round(prog * 20) / 20 };
          if (prog >= 1 && f === 'pregunta' && !resp[j]) {
            const r = { idx: d - 1, ms: ahora - inicioRef.current };
            setRespuestas((prev) => {
              if (prev[j]) return prev;
              const n = [...prev];
              n[j] = r;
              return n;
            });
            ref.current.respuestas = Object.assign([...resp], { [j]: r });
          }
        });
        setVivo((prev) =>
          prev[0].dedos === nuevoVivo[0].dedos && prev[0].prog === nuevoVivo[0].prog && prev[1].dedos === nuevoVivo[1].dedos && prev[1].prog === nuevoVivo[1].prog
            ? prev
            : nuevoVivo
        );
      }),
    []
  );

  // ── Cuenta atrás ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'pregunta') return undefined;
    const id = setInterval(() => {
      const r = Math.max(0, tiempo - (performance.now() - inicioRef.current) / 1000);
      setRestante(Math.ceil(r));
      if (r <= 0) corregir();
    }, 200);
    return () => clearInterval(id);
  }, [fase, indice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Todos han respondido → se corrige ya.
  useEffect(() => {
    if (fase === 'pregunta' && respuestas.slice(0, numJug).every(Boolean)) corregir();
  }, [respuestas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tras el resultado, siguiente pregunta.
  useEffect(() => {
    if (fase !== 'resultado') return undefined;
    const id = setTimeout(siguiente, PAUSA_RESULTADO);
    return () => clearTimeout(id);
  }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

  const lanzarPregunta = (i) => {
    setIndice(i);
    setRespuestas([null, null]);
    gesto.current = [{ dedos: 0, desde: 0 }, { dedos: 0, desde: 0 }];
    corregidaRef.current = false;
    inicioRef.current = performance.now();
    setRestante(tiempo);
    setFase('pregunta');
  };

  const empezar = () => {
    despertarAudio();
    let lista;
    if (tipo === 'recurso') {
      if (!preguntasRecurso.length) return alert('Elige un recurso con preguntas de opción múltiple.');
      lista = barajar(
        preguntasRecurso.map((p) => {
          const orden = barajar(p.opciones.map((_, i) => i)).slice(0, 4);
          if (!orden.includes(p.correcta)) orden[orden.length - 1] = p.correcta;
          const o = barajar(orden);
          return { texto: p.texto, opciones: o.map((i) => p.opciones[i]), correcta: o.indexOf(p.correcta) };
        })
      ).slice(0, numPreguntas);
    } else if (tipo === 'propias') {
      try {
        localStorage.setItem(LS_PROPIAS, textoPropias);
      } catch {
        /* sin almacenamiento */
      }
      lista = barajar(leerPropias(textoPropias)).slice(0, numPreguntas);
      if (!lista.length) return alert('No hay preguntas válidas: cada una necesita la pregunta y al menos 2 opciones.');
    } else {
      lista = Array.from({ length: numPreguntas }, GENERADORES[tipo]);
    }
    setPreguntas(lista);
    setPuntos([0, 0]);
    setAciertos([0, 0]);
    lanzarPregunta(0);
  };

  function corregir() {
    if (corregidaRef.current || ref.current.fase !== 'pregunta') return;
    corregidaRef.current = true;
    const resp = ref.current.respuestas;
    const p = ref.current.pregunta;
    const ok = [0, 1].map((j) => j < numJug && resp[j] && resp[j].idx === p.correcta);
    setPuntos((prev) =>
      prev.map((v, j) => {
        if (!ok[j]) return v;
        const rapidez = Math.max(0, 1 - resp[j].ms / (tiempo * 1000));
        return v + 500 + Math.round(500 * rapidez);
      })
    );
    setAciertos((prev) => prev.map((v, j) => v + (ok[j] ? 1 : 0)));
    if (ok.some(Boolean)) sonidoCorrecto();
    else sonidoIncorrecto();
    setFase('resultado');
  }

  function siguiente() {
    if (indice + 1 < preguntas.length) lanzarPregunta(indice + 1);
    else terminar();
  }

  const terminar = () => {
    sonidoFinal();
    const titulo =
      tipo === 'recurso' ? recurso?.titulo || 'Recurso' : tipo === 'propias' ? 'Preguntas propias' : tipo === 'tablas' ? 'Tablas' : 'Sumas y restas';
    for (let j = 0; j < numJug; j++) {
      guardarRegistroLocal('QUIZ_MANOS', { titulo, aciertos: aciertos[j], intentos: preguntas.length, nombre: nombres[j], via: 'manos' });
    }
    setFase('final');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const cabecera = (
    <div style={st.header}>
      <button onClick={onExit} style={st.btnSec}>
        ← Salir
      </button>
      <b style={{ fontSize: '1.15rem' }}>✋ Quiz con los dedos</b>
      {fase !== 'config' && fase !== 'final' && (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            Pregunta {indice + 1}/{preguntas.length}
          </span>
          {[0, 1].slice(0, numJug).map((j) => (
            <span key={j} style={{ color: COLOR_JUG[j], fontWeight: 800 }}>
              {nombres[j]}: {puntos[j]}
            </span>
          ))}
        </span>
      )}
    </div>
  );

  if (fase === 'config') {
    return (
      <div style={st.wrap}>
        {cabecera}
        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ ...st.caja, maxWidth: 560, flex: '1 1 380px' }}>
            <h3 style={st.h3}>¿Cómo se responde?</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ ...st.opcionMini, background: COLORES[n - 1] }}>
                  <ManoDedos n={n} />
                  <b>{LETRAS[n - 1]}</b>
                </div>
              ))}
            </div>
            <p style={st.ayuda}>
              Levanta <b>1, 2, 3 o 4 dedos</b> (el pulgar no cuenta) y mantenlos quietos <b>1 segundo</b>. La mano abierta
              del todo no responde: sirve para «pensar».
            </p>

            <h3 style={st.h3}>Jugadores</h3>
            <div style={st.fila}>
              {[1, 2].map((n) => (
                <button key={n} onClick={() => setNumJug(n)} style={numJug === n ? st.btnOn : st.btnOff}>
                  {n === 1 ? '🙋 1 jugador' : '🤼 2 jugadores'}
                </button>
              ))}
            </div>
            {numJug === 2 && <p style={st.ayuda}>Cada jugador se pone a un lado de la cámara (la línea discontinua los separa).</p>}
            <div style={st.fila}>
              {[0, 1].slice(0, numJug).map((j) => (
                <input
                  key={j}
                  value={nombres[j]}
                  onChange={(e) => setNombres((prev) => Object.assign([...prev], { [j]: e.target.value.slice(0, 20) }))}
                  style={{ ...st.input, borderColor: COLOR_JUG[j] }}
                />
              ))}
            </div>

            <h3 style={st.h3}>Preguntas</h3>
            <div style={st.fila}>
              {[
                ['tablas', '✖️ Tablas'],
                ['sumas', '➕ Sumas y restas'],
                ['propias', '✍️ Propias'],
                ['recurso', '📚 Recurso'],
              ].map(([id, txt]) => (
                <button key={id} onClick={() => setTipo(id)} style={tipo === id ? st.btnOn : st.btnOff}>
                  {txt}
                </button>
              ))}
            </div>
            {tipo === 'propias' && (
              <>
                <p style={st.ayuda}>Una línea con la pregunta y debajo 2-4 opciones; la correcta empieza por *. Deja una línea en blanco entre preguntas.</p>
                <textarea value={textoPropias} onChange={(e) => setTextoPropias(e.target.value)} rows={9} style={{ ...st.input, width: '100%', fontFamily: 'monospace' }} />
              </>
            )}
            {tipo === 'recurso' && (
              <>
                <p style={st.ayuda}>Se usan las preguntas de opción múltiple (hasta 4 opciones).</p>
                <SelectorRecursoMandos
                  seleccionado={recurso}
                  onPick={(r) => {
                    setRecurso(r);
                    setHojaSel(-1);
                  }}
                />
                {recurso && (
                  <div style={{ ...st.fila, marginTop: 10 }}>
                    <b style={{ color: '#facc15' }}>✔ {recurso.titulo || 'Sin título'}</b>
                    {hojasRecurso.length > 1 && (
                      <select value={hojaSel} onChange={(e) => setHojaSel(Number(e.target.value))} style={st.input}>
                        <option value={-1}>Todas las hojas</option>
                        {hojasRecurso.map((h, i) => (
                          <option key={i} value={i}>
                            {h.nombre} ({h.preguntas.length})
                          </option>
                        ))}
                      </select>
                    )}
                    <span style={st.ayuda}>{preguntasRecurso.length} preguntas</span>
                  </div>
                )}
              </>
            )}

            <div style={{ ...st.fila, marginTop: 14 }}>
              <label style={st.ayuda}>
                Nº preguntas{' '}
                <select value={numPreguntas} onChange={(e) => setNumPreguntas(Number(e.target.value))} style={st.input}>
                  {[5, 8, 10, 15, 20].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={st.ayuda}>
                Tiempo{' '}
                <select value={tiempo} onChange={(e) => setTiempo(Number(e.target.value))} style={st.input}>
                  {[10, 15, 20, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} s
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button onClick={empezar} disabled={estadoCam.estado !== 'listo'} style={{ ...st.btnGrande, opacity: estadoCam.estado === 'listo' ? 1 : 0.5 }}>
              ▶ Empezar
            </button>
          </div>

          <div style={{ ...st.caja, width: 340 }}>
            <h3 style={st.h3}>📷 Prueba la cámara</h3>
            <VistaManos ancho={300} lineaCentral={numJug === 2} colorMano={(m) => (numJug === 2 ? COLOR_JUG[m.centro.x < 0.5 ? 0 : 1] : COLOR_JUG[0])} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
              {[0, 1].slice(0, numJug).map((j) => (
                <div key={j} style={{ textAlign: 'center', color: COLOR_JUG[j], fontWeight: 800 }}>
                  {nombres[j]}
                  <div style={{ fontSize: '1.6rem' }}>{vivo[j].dedos < 0 ? '—' : vivo[j].dedos === 5 ? '🖐️' : `${vivo[j].dedos} ☝️`}</div>
                </div>
              ))}
            </div>
            <p style={st.ayuda}>Con buena luz funciona hasta unos 2 metros de la cámara. Todo se procesa en este ordenador: no se envía ninguna imagen.</p>
          </div>
        </div>
      </div>
    );
  }

  if (fase === 'final') {
    const orden = [0, 1].slice(0, numJug).sort((a, b) => puntos[b] - puntos[a]);
    return (
      <div style={st.wrap}>
        {cabecera}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
          <div style={{ fontSize: '3.5rem' }}>🏆</div>
          {orden.map((j, pos) => (
            <div key={j} style={{ ...st.caja, minWidth: 300, textAlign: 'center', borderColor: COLOR_JUG[j] }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: COLOR_JUG[j] }}>
                {numJug === 2 ? (pos === 0 && puntos[orden[0]] !== puntos[orden[1]] ? '🥇 ' : '') : ''}
                {nombres[j]}
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900 }}>{puntos[j]} pts</div>
              <div style={st.ayuda}>
                {aciertos[j]} de {preguntas.length} aciertos
              </div>
            </div>
          ))}
          <div style={st.fila}>
            <button onClick={() => setFase('config')} style={st.btnGrande}>
              🔁 Otra partida
            </button>
            <button onClick={onExit} style={{ ...st.btnGrande, background: '#475569' }}>
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // pregunta | resultado
  const enResultado = fase === 'resultado';
  return (
    <div style={st.wrap}>
      {cabecera}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 18px', gap: 14, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ ...st.reloj, background: restante <= 5 && !enResultado ? '#ef4444' : '#334155' }}>{enResultado ? '✓' : restante}</div>
          <div style={{ flex: 1, fontSize: 'clamp(1.6rem, 4.5vw, 3.4rem)', fontWeight: 900, textAlign: 'center', lineHeight: 1.15 }}>{pregunta?.texto}</div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, minHeight: 0 }}>
          {pregunta?.opciones.map((op, i) => {
            const esCorrecta = i === pregunta.correcta;
            const apagada = enResultado && !esCorrecta;
            return (
              <div
                key={i}
                style={{
                  ...st.opcion,
                  background: COLORES[i],
                  opacity: apagada ? 0.3 : 1,
                  outline: enResultado && esCorrecta ? '6px solid #fff' : 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <ManoDedos n={i + 1} alto={46} />
                  <b style={{ fontSize: '1.1rem' }}>{i + 1}</b>
                </div>
                <div style={{ flex: 1, fontSize: 'clamp(1.2rem, 3vw, 2.2rem)', fontWeight: 800 }}>{op}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 1].slice(0, numJug).map((j) => {
                    const r = respuestas[j];
                    // En 2 jugadores no se enseña qué ha elegido el otro hasta corregir.
                    const mostrar = r && r.idx === i && (enResultado || numJug === 1);
                    const marcando = !r && !enResultado && vivo[j].prog > 0 && vivo[j].dedos === i + 1;
                    if (!mostrar && !marcando) return null;
                    return (
                      <div
                        key={j}
                        title={nombres[j]}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: mostrar ? COLOR_JUG[j] : `conic-gradient(${COLOR_JUG[j]} ${vivo[j].prog * 360}deg, rgba(255,255,255,0.25) 0)`,
                          border: '3px solid #fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          color: '#0f172a',
                        }}
                      >
                        {mostrar ? (enResultado ? (esCorrecta ? '✓' : '✗') : '✓') : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[0, 1].slice(0, numJug).map((j) => (
            <div key={j} style={{ ...st.chip, borderColor: COLOR_JUG[j], color: COLOR_JUG[j] }}>
              {nombres[j]}:{' '}
              {respuestas[j]
                ? enResultado
                  ? respuestas[j].idx === pregunta.correcta
                    ? '✅ ¡Correcto!'
                    : `❌ eligió ${LETRAS[respuestas[j].idx]}`
                  : '🔒 Respondido'
                : enResultado
                  ? '⌛ Sin responder'
                  : vivo[j].dedos < 0
                    ? '🙈 No veo tu mano'
                    : vivo[j].dedos === 5
                      ? '🖐️ Pensando…'
                      : vivo[j].dedos === 0
                        ? '✊'
                        : `☝️ ${vivo[j].dedos}`}
            </div>
          ))}
          {enResultado && (
            <button onClick={siguiente} style={st.btnSec}>
              Siguiente →
            </button>
          )}
        </div>
      </div>
      <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 5 }}>
        <VistaManos ancho={200} lineaCentral={numJug === 2} colorMano={(m) => (numJug === 2 ? COLOR_JUG[m.centro.x < 0.5 ? 0 : 1] : COLOR_JUG[0])} />
        <AvisoEstadoManos estado={estadoCam} oscuro />
      </div>
    </div>
  );
}

const st = {
  wrap: {
    position: 'fixed',
    inset: 0,
    zIndex: 2147481000,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  },
  header: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid #334155' },
  caja: { background: 'rgba(30,41,59,0.85)', border: '2px solid #334155', borderRadius: 16, padding: 16, boxSizing: 'border-box' },
  h3: { margin: '10px 0 8px', fontSize: '1rem', color: '#f8fafc' },
  ayuda: { color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 8px' },
  fila: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  input: { padding: '7px 10px', borderRadius: 8, border: '2px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' },
  btnOn: { padding: '8px 14px', borderRadius: 10, border: '2px solid #a78bfa', background: '#7c3aed', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  btnOff: { padding: '8px 14px', borderRadius: 10, border: '2px solid #475569', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' },
  btnSec: { padding: '7px 14px', borderRadius: 9, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' },
  btnGrande: { marginTop: 14, padding: '12px 26px', borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer' },
  opcionMini: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, color: '#fff', fontSize: '1.1rem' },
  opcion: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 18, color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.3)', transition: 'opacity 0.3s' },
  reloj: { width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 900, color: '#fff', flexShrink: 0 },
  chip: { padding: '6px 14px', borderRadius: 999, border: '2px solid', fontWeight: 800, background: 'rgba(15,23,42,0.7)' },
};
