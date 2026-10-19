// Quiz con mandos micro:bit: preguntas de 2-4 opciones (A-D) que la clase
// responde con sus mandos. Primera respuesta de cada mando = la que cuenta.
// Puntos = 500 por acierto + hasta 500 por rapidez. Sirve de plantilla para
// llevar los mandos a otros juegos (ver ./mandosMicrobit.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LETRAS,
  escucharMandos,
  escucharEstadoAntena,
  simularPulsacion,
  feedbackMando,
  nuevaPreguntaMandos,
  setModoMandos,
  MODOS,
  aNumeroMando,
} from './mandosMicrobit.js';
import { despertarAudio, sonidoFinal } from '../utils/sonidosFeedback';
import { BotonTutorialMandos } from './TutorialMandos.jsx';
import SelectorRecursoMandos, { hojasQuiz, numeroQuiz, MIN_NUM_QUIZ, MAX_NUM_QUIZ } from './SelectorRecursoMandos.jsx';

const COLORES = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
const LS_NOMBRES = 'pikt_mandos_nombres';
const LS_PROPIAS = 'pikt_mandos_preguntas';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const barajar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Pregunta numérica con 3 distractores cercanos.
function conDistractores(texto, correcta, candidatos) {
  const malos = barajar([...new Set(candidatos)].filter((n) => n !== correcta && n >= 0)).slice(0, 3);
  let extra = 1;
  while (malos.length < 3) {
    const n = correcta + extra * (extra % 2 ? 1 : -1);
    if (n >= 0 && n !== correcta && !malos.includes(n)) malos.push(n);
    extra++;
  }
  const opciones = barajar([correcta, ...malos]);
  return { texto, opciones: opciones.map(String), correcta: opciones.indexOf(correcta), valor: correcta };
}

export const GENERADORES = {
  tablas: () => {
    const a = rnd(2, 10);
    const b = rnd(2, 10);
    const c = a * b;
    return conDistractores(`${a} × ${b}`, c, [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, c + 1, c - 2, c + 10]);
  },
  sumas: () => {
    const suma = Math.random() < 0.5;
    let a = rnd(12, 99);
    let b = rnd(11, 89);
    if (!suma && b > a) [a, b] = [b, a];
    const c = suma ? a + b : a - b;
    return conDistractores(`${a} ${suma ? '+' : '−'} ${b}`, c, [c + 1, c - 1, c + 10, c - 10, c + 2, c - 9, c + 11]);
  },
};

// Respuesta numérica: siempre de MIN_NUM_QUIZ a MAX_NUM_QUIZ (1-19).
const GENERADORES_NUM = {
  tablas: () => {
    if (Math.random() < 0.5) {
      // multiplicación con producto ≤ 19
      const a = rnd(2, 9);
      const b = rnd(1, Math.floor(MAX_NUM_QUIZ / a));
      return Math.random() < 0.5 ? { texto: `${a} × ${b}`, valor: a * b } : { texto: `${b} × ${a}`, valor: a * b };
    }
    // división exacta con cociente ≤ 10
    const d = rnd(2, 10);
    const c = rnd(1, 10);
    return { texto: `${d * c} : ${d}`, valor: c };
  },
  sumas: () => {
    if (Math.random() < 0.5) {
      const a = rnd(1, MAX_NUM_QUIZ - 1);
      const b = rnd(1, MAX_NUM_QUIZ - a);
      return { texto: `${a} + ${b}`, valor: a + b };
    }
    const r = rnd(MIN_NUM_QUIZ, MAX_NUM_QUIZ);
    const b = rnd(1, 20);
    return { texto: `${r + b} − ${b}`, valor: r };
  },
};

// Formato: bloques separados por línea en blanco; 1ª línea = pregunta,
// siguientes = opciones (2-4); la correcta empieza por * (si no, la primera).
// Con respuesta numérica basta una línea con el número.
function leerPropias(texto, numerico = false) {
  return texto
    .split(/\n\s*\n/)
    .map((bloque) => bloque.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lineas) => lineas.length >= 2)
    .map(([pregunta, ...ops]) => {
      const opciones = ops.slice(0, 4);
      let correcta = opciones.findIndex((o) => o.startsWith('*'));
      if (correcta < 0) correcta = 0;
      const limpias = opciones.map((o) => o.replace(/^\*\s*/, ''));
      const orden = barajar(limpias.map((_, i) => i));
      return {
        texto: pregunta,
        opciones: orden.map((i) => limpias[i]),
        correcta: orden.indexOf(correcta),
        valor: numeroQuiz(limpias[correcta]),
      };
    })
    .filter((p) => (numerico ? p.valor !== null : p.opciones.length >= 2));
}

const EJEMPLO_PROPIAS = `¿Cuál es la capital de Francia?
*París
Roma
Berlín
Madrid

¿Cuántos lados tiene un hexágono?
*6
5
8
7

El agua hierve a 100 ºC al nivel del mar
*Verdadero
Falso`;

const leerLS = (clave, def) => {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
};
const guardarLS = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento */
  }
};

export default function QuizMandos({ onExit }) {
  const [fase, setFase] = useState('config'); // config | lobby | pregunta | resultado | final
  const [tipo, setTipo] = useState('tablas');
  const [numPreguntas, setNumPreguntas] = useState(8);
  const [tiempo, setTiempo] = useState(20);
  const [textoPropias, setTextoPropias] = useState(() => leerLS(LS_PROPIAS, EJEMPLO_PROPIAS));
  const [recurso, setRecurso] = useState(null);
  const [hojaSel, setHojaSel] = useState(-1); // -1 = todas las hojas
  const [ordenRecurso, setOrdenRecurso] = useState(false); // true = en el orden del recurso
  const [respuesta, setRespuesta] = useState('letras'); // 'letras' (A-D) | 'numero'
  const numerico = respuesta === 'numero';
  const [preguntas, setPreguntas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [jugadores, setJugadores] = useState({}); // id → { id, puntos, aciertos, ganado }
  const [nombres, setNombres] = useState(() => leerLS(LS_NOMBRES, {}));
  const [respuestas, setRespuestas] = useState({}); // id → { letra, ms }
  const [restante, setRestante] = useState(0);
  const [antena, setAntena] = useState({ conectada: false, antenaOk: false });
  const [simulador, setSimulador] = useState(false);

  const faseRef = useRef(fase);
  faseRef.current = fase;
  const numericoRef = useRef(numerico);
  numericoRef.current = numerico;
  const inicioRef = useRef(0);
  const corregidaRef = useRef(false);

  const pregunta = preguntas[indice];
  const nombre = useCallback((id) => nombres[id] || `Mando ${id > 900 ? `virtual ${id - 900}` : id}`, [nombres]);

  useEffect(() => escucharEstadoAntena(setAntena), []);
  useEffect(() => guardarLS(LS_NOMBRES, nombres), [nombres]);

  // Los mandos se ponen en modo letras o número según la configuración.
  useEffect(() => setModoMandos(numerico ? MODOS.NUMERO : MODOS.LETRAS), [numerico]);
  useEffect(() => () => setModoMandos(MODOS.LETRAS), []);

  // Pulsaciones de los mandos.
  useEffect(
    () =>
      escucharMandos(({ id, tipo, letra, numero, t }) => {
        const f = faseRef.current;
        if (f !== 'lobby' && f !== 'pregunta') return;
        setJugadores((prev) => (prev[id] ? prev : { ...prev, [id]: { id, puntos: 0, aciertos: 0, ganado: 0 } }));
        if (f === 'pregunta' && tipo === (numericoRef.current ? 'numero' : 'letra')) {
          setRespuestas((prev) =>
            prev[id] ? prev : { ...prev, [id]: { letra, numero, ms: t - inicioRef.current } }
          );
        }
      }),
    []
  );

  const esAcierto = useCallback(
    (r) => !!r && !!pregunta && (numerico ? r.numero === pregunta.valor : LETRAS.indexOf(r.letra) === pregunta.correcta),
    [pregunta, numerico]
  );

  const lanzarPregunta = (i) => {
    setIndice(i);
    setRespuestas({});
    corregidaRef.current = false;
    inicioRef.current = Date.now();
    setRestante(tiempo);
    setFase('pregunta');
    nuevaPreguntaMandos();
  };

  const corregir = useCallback(() => {
    if (corregidaRef.current || !pregunta) return;
    corregidaRef.current = true;
    const limite = tiempo * 1000;
    setJugadores((prev) => {
      const sig = {};
      for (const j of Object.values(prev)) {
        const r = respuestas[j.id];
        const ok = esAcierto(r);
        const ganado = ok ? 500 + Math.round(500 * Math.max(0, 1 - r.ms / limite)) : 0;
        sig[j.id] = { ...j, puntos: j.puntos + ganado, aciertos: j.aciertos + (ok ? 1 : 0), ganado };
      }
      return sig;
    });
    Object.entries(respuestas).forEach(([id, r]) => {
      if (Number(id) < 900) feedbackMando(Number(id), esAcierto(r));
    });
    setFase('resultado');
  }, [pregunta, respuestas, tiempo, esAcierto]);

  // Cuenta atrás.
  useEffect(() => {
    if (fase !== 'pregunta') return undefined;
    const t = setInterval(() => {
      const quedan = Math.max(0, tiempo - (Date.now() - inicioRef.current) / 1000);
      setRestante(quedan);
      if (quedan <= 0) corregir();
    }, 200);
    return () => clearInterval(t);
  }, [fase, tiempo, corregir]);

  // Si ya han respondido todos, se corrige sola.
  const nJugadores = Object.keys(jugadores).length;
  const nRespuestas = Object.keys(respuestas).length;
  useEffect(() => {
    if (fase === 'pregunta' && nJugadores > 0 && nRespuestas >= nJugadores) {
      const t = setTimeout(corregir, 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [fase, nJugadores, nRespuestas, corregir]);

  useEffect(() => {
    if (fase === 'final') sonidoFinal();
  }, [fase]);

  const ranking = useMemo(
    () => Object.values(jugadores).sort((a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos),
    [jugadores]
  );

  const hojasRecurso = useMemo(() => (recurso ? hojasQuiz(recurso, numerico) : []), [recurso, numerico]);
  const preguntasRecurso = hojaSel < 0 ? hojasRecurso.flatMap((h) => h.preguntas) : hojasRecurso[hojaSel]?.preguntas || [];

  const abrirSala = () => {
    let lista;
    if (tipo === 'recurso') {
      if (!preguntasRecurso.length) {
        alert(
          numerico
            ? `Elige un recurso con preguntas cuya respuesta sea un número del ${MIN_NUM_QUIZ} al ${MAX_NUM_QUIZ}.`
            : 'Elige un recurso con preguntas de opción múltiple.'
        );
        return;
      }
      // Se rebarajan las opciones en cada partida (la correcta no queda siempre en el mismo sitio).
      const mezcladas = preguntasRecurso.map((p) => {
        if (numerico) return p;
        const orden = barajar(p.opciones.map((_, i) => i));
        return { texto: p.texto, opciones: orden.map((i) => p.opciones[i]), correcta: orden.indexOf(p.correcta) };
      });
      lista = (ordenRecurso ? mezcladas : barajar(mezcladas)).slice(0, numPreguntas);
    } else if (tipo === 'propias') {
      guardarLS(LS_PROPIAS, textoPropias);
      lista = barajar(leerPropias(textoPropias, numerico)).slice(0, numPreguntas);
      if (!lista.length) {
        alert(
          numerico
            ? `No hay preguntas válidas: debajo de cada pregunta escribe la respuesta (un número del ${MIN_NUM_QUIZ} al ${MAX_NUM_QUIZ}).`
            : 'No hay preguntas válidas: cada una necesita la pregunta y al menos 2 opciones.'
        );
        return;
      }
    } else {
      lista = Array.from({ length: numPreguntas }, numerico ? GENERADORES_NUM[tipo] : GENERADORES[tipo]);
    }
    despertarAudio();
    setPreguntas(lista);
    setJugadores({});
    setFase('lobby');
  };

  const siguiente = () => (indice + 1 < preguntas.length ? lanzarPregunta(indice + 1) : setFase('final'));

  /* ── Render ── */
  const nPropias = tipo === 'propias' ? leerPropias(textoPropias, numerico).length : 0;
  const reparto =
    pregunta && !numerico
      ? pregunta.opciones.map((_, i) => Object.values(respuestas).filter((r) => LETRAS.indexOf(r.letra) === i).length)
      : [];
  // Respuestas numéricas agrupadas: [[numero, cuantos], …] de más a menos votadas.
  const repartoNum = numerico
    ? Object.entries(
        Object.values(respuestas).reduce((acc, r) => ({ ...acc, [r.numero]: (acc[r.numero] || 0) + 1 }), {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div style={st.wrapper}>
      <header style={st.header}>
        <button onClick={onExit} style={st.backBtn}>
          ← Volver
        </button>
        <h2 style={st.title}>🏆 Quiz con mandos</h2>
        <span style={{ ...st.chip, background: antena.antenaOk ? '#16a34a' : '#475569' }}>
          {antena.antenaOk ? '📡 Antena lista' : '⚪ Sin antena'}
        </span>
        {(fase === 'pregunta' || fase === 'resultado') && (
          <span style={st.contador}>
            {indice + 1}/{preguntas.length}
          </span>
        )}
      </header>

      <div style={st.scroll}>
        {fase === 'config' && (
          <div style={st.panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ ...st.h3, margin: 0 }}>Se responde con…</h3>
              <BotonTutorialMandos inicial={numerico ? 'numero' : 'letras'} texto="📖 Tutorial del mando" style={{ padding: '6px 12px' }} />
            </div>
            <div style={{ ...st.fila, marginBottom: 6 }}>
              <button onClick={() => setRespuesta('letras')} style={st.opcionCfg(!numerico)}>
                🔤 Letras A-D
              </button>
              <button onClick={() => setRespuesta('numero')} style={st.opcionCfg(numerico)}>
                🔢 Un número
              </button>
            </div>
            <p style={st.ayuda}>
              {numerico ? (
                <>
                  En el mando: <b>A</b> baja y <b>B</b> sube (si lo mantienes, va cada vez más rápido);{' '}
                  <b>agitar el mando</b> envía el número.
                </>
              ) : (
                <>
                  En el mando: <b>A</b> cambia de letra y se envía con <b>B</b> o <b>agitando el mando</b>.
                </>
              )}
            </p>
            <h3 style={{ ...st.h3, marginTop: 14 }}>Preguntas</h3>
            <div style={st.fila}>
              {[
                ['tablas', '✖️ Tablas'],
                ['sumas', '➕ Sumas y restas'],
                ['recurso', '📚 Recurso'],
                ['propias', '✍️ Mis preguntas'],
              ].map(([k, txt]) => (
                <button key={k} onClick={() => setTipo(k)} style={st.opcionCfg(tipo === k)}>
                  {txt}
                </button>
              ))}
            </div>
            {tipo === 'recurso' && (
              <>
                <p style={st.ayuda}>
                  {numerico ? (
                    <>
                      Se usan las preguntas cuya respuesta correcta es un <b>número del {MIN_NUM_QUIZ} al {MAX_NUM_QUIZ}</b>, sean
                      de opción múltiple o de respuesta corta.
                    </>
                  ) : (
                    <>
                      Recursos con preguntas de <b>opción múltiple</b> (una correcta y hasta tres incorrectas). Las de
                      respuesta escrita, rellenar u ordenar se saltan porque no se pueden contestar con A-D.
                    </>
                  )}
                </p>
                <SelectorRecursoMandos
                  numerico={numerico}
                  seleccionado={recurso}
                  onPick={(r) => {
                    setRecurso(r);
                    setHojaSel(-1);
                  }}
                />
                {recurso && (
                  <div style={{ ...st.fila, marginTop: 12 }}>
                    <b style={{ color: '#facc15' }}>✔ {recurso.titulo || 'Sin título'}</b>
                    {hojasRecurso.length > 1 && (
                      <select value={hojaSel} onChange={(e) => setHojaSel(Number(e.target.value))} style={st.select}>
                        <option value={-1}>Todas las hojas</option>
                        {hojasRecurso.map((h, i) => (
                          <option key={i} value={i}>
                            {h.nombre} ({h.preguntas.length})
                          </option>
                        ))}
                      </select>
                    )}
                    <label style={{ ...st.ayuda, margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={ordenRecurso} onChange={(e) => setOrdenRecurso(e.target.checked)} />
                      En el orden del recurso
                    </label>
                    <span style={{ ...st.ayuda, margin: 0 }}>{preguntasRecurso.length} preguntas disponibles</span>
                  </div>
                )}
              </>
            )}
            {tipo === 'propias' && (
              <>
                <p style={st.ayuda}>
                  {numerico ? (
                    <>
                      Una pregunta por bloque (deja una línea en blanco entre preguntas). Primera línea = pregunta;
                      debajo, la respuesta: un <b>número del {MIN_NUM_QUIZ} al {MAX_NUM_QUIZ}</b> (o la opción marcada con <b>*</b>, si es un
                      número). Se guardan en este navegador.
                    </>
                  ) : (
                    <>
                      Una pregunta por bloque (deja una línea en blanco entre preguntas). Primera línea = pregunta;
                      debajo, de 2 a 4 respuestas. Marca la correcta con <b>*</b>. Se guardan en este navegador.
                    </>
                  )}
                </p>
                <textarea value={textoPropias} onChange={(e) => setTextoPropias(e.target.value)} style={st.textarea} />
                <div style={st.ayuda}>{nPropias} preguntas válidas</div>
              </>
            )}
            <div style={{ ...st.fila, marginTop: 14 }}>
              <label style={st.label}>
                Nº de preguntas
                <select value={numPreguntas} onChange={(e) => setNumPreguntas(Number(e.target.value))} style={st.select}>
                  {[5, 8, 10, 15, 20, 30, 50].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={st.label}>
                Segundos por pregunta
                <select value={tiempo} onChange={(e) => setTiempo(Number(e.target.value))} style={st.select}>
                  {[10, 15, 20, 30, 45, 60].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            {!antena.antenaOk && (
              <p style={st.aviso}>
                La antena no está conectada: conéctala en el panel anterior o prueba con los mandos virtuales (🧪).
              </p>
            )}
            <button style={st.btnGrande} onClick={abrirSala}>
              Abrir sala →
            </button>
          </div>
        )}

        {fase === 'lobby' && (
          <div style={st.panel}>
            <h3 style={{ ...st.h3, textAlign: 'center', fontSize: 26 }}>
              {numerico ? 'Agitad el mando para uniros' : 'Pulsad B o agitad el mando para uniros'}
            </h3>
            <p style={{ ...st.ayuda, textAlign: 'center' }}>Puedes escribir el nombre de cada alumno junto a su mando.</p>
            <div style={st.jugGrid}>
              {Object.values(jugadores)
                .sort((a, b) => a.id - b.id)
                .map((j) => (
                  <div key={j.id} style={st.jugCard}>
                    <span style={st.jugNum}>{j.id > 900 ? '🧪' : j.id}</span>
                    <input
                      value={nombres[j.id] || ''}
                      placeholder={nombre(j.id)}
                      onChange={(e) => setNombres((p) => ({ ...p, [j.id]: e.target.value }))}
                      style={st.jugInput}
                    />
                  </div>
                ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button style={st.btnGrande} disabled={!nJugadores} onClick={() => lanzarPregunta(0)}>
                Empezar con {nJugadores} {nJugadores === 1 ? 'jugador' : 'jugadores'} ▶
              </button>
            </div>
          </div>
        )}

        {(fase === 'pregunta' || fase === 'resultado') && pregunta && (
          <div>
            {fase === 'pregunta' && (
              <div style={st.barraTiempo}>
                <div style={{ ...st.barraRelleno, width: `${(restante / tiempo) * 100}%` }} />
              </div>
            )}
            <div style={st.pregunta}>{pregunta.texto}</div>
            {numerico ? (
              fase === 'pregunta' ? (
                <div style={st.pistaNum}>
                  🔢 Marca el número con <b>A</b> (−) y <b>B</b> (+) y envíalo <b>agitando el mando</b>
                </div>
              ) : (
                <div>
                  <div style={st.solucionNum}>{pregunta.valor}</div>
                  <div style={st.chips}>
                    {repartoNum.map(([n, c]) => (
                      <span
                        key={n}
                        style={{ ...st.chipNum, background: Number(n) === pregunta.valor ? '#16a34a' : '#7f1d1d' }}
                      >
                        {n} · {c}
                      </span>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div style={st.opciones}>
                {pregunta.opciones.map((op, i) => {
                  const apagada = fase === 'resultado' && i !== pregunta.correcta;
                  return (
                    <div key={i} style={{ ...st.opcion, background: COLORES[i], opacity: apagada ? 0.3 : 1 }}>
                      <span style={st.opLetra}>{LETRAS[i]}</span>
                      <span style={{ flex: 1 }}>{op}</span>
                      {fase === 'resultado' && <span style={st.opCuenta}>{reparto[i]}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {fase === 'pregunta' ? (
              <div style={st.estadoRonda}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>⏱ {Math.ceil(restante)}</span>
                <span>
                  {nRespuestas}/{nJugadores} han respondido
                </span>
                <button style={st.btnSec} onClick={corregir}>
                  Corregir ya
                </button>
              </div>
            ) : (
              <div style={st.panel}>
                <div style={st.fila}>
                  {ranking.slice(0, 5).map((j, i) => (
                    <div key={j.id} style={st.rankItem}>
                      <b>{['🥇', '🥈', '🥉', '4º', '5º'][i]}</b> {nombre(j.id)} · {j.puntos}
                      {j.ganado > 0 && <span style={{ color: '#86efac' }}> +{j.ganado}</span>}
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button style={st.btnGrande} onClick={siguiente}>
                    {indice + 1 < preguntas.length ? 'Siguiente pregunta ▶' : 'Ver clasificación 🏆'}
                  </button>
                </div>
              </div>
            )}

            {fase === 'pregunta' && (
              <div style={st.chips}>
                {Object.values(jugadores)
                  .sort((a, b) => a.id - b.id)
                  .map((j) => (
                    <span key={j.id} style={{ ...st.chipJug, background: respuestas[j.id] ? '#16a34a' : '#334155' }}>
                      {nombre(j.id)}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        {fase === 'final' && (
          <div style={st.panel}>
            <h3 style={{ ...st.h3, textAlign: 'center', fontSize: 28 }}>🏆 Clasificación</h3>
            {ranking.map((j, i) => (
              <div key={j.id} style={{ ...st.filaRank, fontSize: i < 3 ? 22 : 17 }}>
                <span style={{ width: 50 }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                <span style={{ flex: 1 }}>{nombre(j.id)}</span>
                <span style={{ color: '#94a3b8', marginRight: 16 }}>
                  {j.aciertos}/{preguntas.length} ✓
                </span>
                <b>{j.puntos}</b>
              </div>
            ))}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button style={st.btnGrande} onClick={() => setFase('config')}>
                Jugar otra vez
              </button>
            </div>
          </div>
        )}

        {/* Mandos virtuales para probar sin placas */}
        <div style={{ marginTop: 26 }}>
          <button style={st.btnSec} onClick={() => setSimulador((s) => !s)}>
            🧪 {simulador ? 'Ocultar' : 'Mostrar'} mandos virtuales
          </button>
          {simulador &&
            [901, 902, 903].map((id) => (
              <div key={id} style={{ ...st.fila, marginTop: 8 }}>
                <span style={{ color: '#94a3b8', fontSize: 13, width: 80 }}>Virtual {id - 900}</span>
                {numerico ? (
                  <form
                    style={st.fila}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = aNumeroMando(e.currentTarget.elements.n.value);
                      if (n !== null) simularPulsacion(id, 'N' + n);
                    }}
                  >
                    <input name="n" type="number" defaultValue={0} style={{ ...st.select, width: 90 }} />
                    <button type="submit" style={{ ...st.miniBtn, background: '#7c3aed' }}>
                      Enviar
                    </button>
                  </form>
                ) : (
                  LETRAS.map((l, i) => (
                    <button key={l} style={{ ...st.miniBtn, background: COLORES[i] }} onClick={() => simularPulsacion(id, l)}>
                      {l}
                    </button>
                  ))
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const st = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
    fontFamily: 'system-ui, sans-serif',
    color: '#e2e8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    padding: '12px 18px',
    background: 'rgba(15,23,42,0.85)',
    borderBottom: '1px solid #334155',
  },
  backBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#e2e8f0',
    fontWeight: 600,
    cursor: 'pointer',
  },
  title: { margin: 0, color: '#f1f5f9', fontSize: 18, fontWeight: 800, flex: 1 },
  chip: { color: '#fff', fontSize: 13, fontWeight: 700, padding: '5px 12px', borderRadius: 999 },
  contador: { fontWeight: 800, color: '#facc15' },
  scroll: { flex: 1, overflow: 'auto', padding: '20px 16px 40px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  panel: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 18 },
  h3: { margin: '0 0 12px', color: '#f8fafc', fontSize: 18 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  opcionCfg: (on) => ({
    padding: '10px 16px',
    borderRadius: 12,
    border: `2px solid ${on ? '#facc15' : '#475569'}`,
    background: on ? 'rgba(250,204,21,0.12)' : 'transparent',
    color: '#f1f5f9',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  ayuda: { color: '#94a3b8', fontSize: 13, margin: '10px 0 6px', lineHeight: 1.5 },
  textarea: {
    width: '100%',
    minHeight: 200,
    boxSizing: 'border-box',
    background: '#020617',
    color: '#f1f5f9',
    border: '1px solid #475569',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#94a3b8' },
  select: {
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: 15,
  },
  aviso: { color: '#fde68a', fontSize: 13.5, margin: '14px 0 0' },
  btnGrande: {
    marginTop: 16,
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 26px',
    fontSize: 17,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnSec: {
    background: 'transparent',
    color: '#e2e8f0',
    border: '1px solid #475569',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  miniBtn: {
    minWidth: 38,
    padding: '6px 10px',
    borderRadius: 8,
    border: 'none',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  jugGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, marginTop: 14 },
  jugCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '8px 10px',
  },
  jugNum: { fontWeight: 900, color: '#facc15', fontSize: 20, minWidth: 30, textAlign: 'center' },
  jugInput: {
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #475569',
    color: '#f1f5f9',
    fontSize: 15,
    padding: '4px 2px',
  },
  barraTiempo: { height: 10, background: '#1e293b', borderRadius: 99, overflow: 'hidden', marginBottom: 16 },
  barraRelleno: { height: '100%', background: '#facc15', transition: 'width .2s linear' },
  pregunta: {
    fontSize: 'clamp(26px, 5vw, 48px)',
    fontWeight: 900,
    textAlign: 'center',
    color: '#fff',
    margin: '6px 0 22px',
    lineHeight: 1.2,
  },
  opciones: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 },
  opcion: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    color: '#fff',
    fontSize: 'clamp(18px, 3vw, 28px)',
    fontWeight: 800,
    borderRadius: 16,
    padding: '16px 18px',
    transition: 'opacity .3s',
  },
  opLetra: {
    background: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    width: 46,
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  opCuenta: { background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '2px 12px', fontSize: 18 },
  pistaNum: { textAlign: 'center', color: '#cbd5e1', fontSize: 18, margin: '4px 0 8px' },
  solucionNum: {
    textAlign: 'center',
    fontSize: 'clamp(48px, 9vw, 96px)',
    fontWeight: 900,
    color: '#86efac',
    lineHeight: 1,
    margin: '0 0 8px',
  },
  chipNum: { color: '#fff', fontSize: 16, fontWeight: 700, padding: '5px 14px', borderRadius: 99 },
  estadoRonda: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 18, flexWrap: 'wrap' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 },
  chipJug: { color: '#fff', fontSize: 13, padding: '4px 10px', borderRadius: 99, transition: 'background .3s' },
  rankItem: { background: 'rgba(15,23,42,0.7)', borderRadius: 10, padding: '8px 12px', fontSize: 15 },
  filaRank: { display: 'flex', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid #334155' },
};
