// Pista de robots con mandos micro:bit (modo MOVER): cada mando lleva un robot
// por una cuadrícula grande. A = avanza N casillas, B = gira 90° a la derecha,
// A+B = sube/baja el lápiz (deja rastro). Dos modos de juego:
//   ⭐ Estrellas: recoger estrellas (+1).
//   ❓ Preguntas: hay siempre una pregunta y sus 2-4 respuestas repartidas por el
//      tablero; el primero que llega a la correcta gana +3 y sale otra pregunta;
//      pisar una incorrecta resta 1 y deja al robot aturdido 2 s.
// El estado de la partida vive en un ref (se muta) y `setVersion` repinta:
// así los efectos (sonido, feedback al mando) no van dentro de un setState.
import React, { useEffect, useRef, useState } from 'react';
import {
  MODOS,
  LETRAS,
  setModoMandos,
  escucharMandos,
  escucharEstadoAntena,
  simularPulsacion,
  feedbackMando,
} from './mandosMicrobit.js';
import { despertarAudio, sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from '../utils/sonidosFeedback';
import { GENERADORES, barajar } from './QuizMandos.jsx';
import SelectorRecursoMandos, { hojasQuiz } from './SelectorRecursoMandos.jsx';
import { BotonTutorialMandos } from './TutorialMandos.jsx';
import ChipAntena from './ChipAntena.jsx';

const TAMANOS = {
  normal: { l: 'Normal', cols: 16, filas: 10 },
  grande: { l: 'Grande', cols: 20, filas: 12 },
  enorme: { l: 'Enorme', cols: 26, filas: 15 },
};
const DX = [0, 1, 0, -1]; // 0 norte, 1 este, 2 sur, 3 oeste
const DY = [-1, 0, 1, 0];
const COLORES = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#eab308', '#6366f1'];
const COLORES_OP = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
const PUNTOS_BIEN = 3;
const PUNTOS_MAL = 1;
const ATURDIDO_MS = 2000;
const PAUSA_GANADOR = 2200;
const LS_NOMBRES = 'pikt_mandos_nombres';

const leerNombres = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_NOMBRES) || '{}') || {};
  } catch {
    return {};
  }
};

const juegoVacio = () => ({ robots: {}, estrellas: [], trazos: [], orden: 0, pregunta: null, efectos: [] });
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Casilla libre de robots, estrellas y respuestas, a `separacion` casillas como mínimo de todo eso. */
function casillaLibre(j, cols, filas, separacion = 0) {
  const ocupadas = [...Object.values(j.robots), ...j.estrellas, ...(j.pregunta?.fichas || [])];
  for (let sep = separacion; sep >= 0; sep--) {
    for (let i = 0; i < 300; i++) {
      const c = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * filas) };
      if (ocupadas.every((o) => dist(o, c) > sep)) return c;
    }
  }
  return { x: 0, y: 0 };
}

const estrellaPts = (() => {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.17 : 0.4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`);
  }
  return p.join(' ');
})();

function Robot({ r, ahora }) {
  const aturdido = r.aturdidoHasta > ahora;
  return (
    <g style={{ transform: `translate(${r.x + 0.5}px, ${r.y + 0.5}px)`, transition: 'transform .28s cubic-bezier(.3,1.4,.6,1)' }}>
      <ellipse cx={0} cy={0.34} rx={0.3} ry={0.08} fill="rgba(0,0,0,.45)" />
      <g style={{ transform: `rotate(${r.rot}deg)`, transition: 'transform .25s' }} className={aturdido ? 'pr-aturdido' : undefined}>
        <polygon points="0,-0.5 0.13,-0.33 -0.13,-0.33" fill="#fff" />
        <rect x={-0.32} y={-0.33} width={0.64} height={0.62} rx={0.16} fill={r.color} stroke="#fff" strokeWidth={0.045} filter="url(#pr-brillo)" />
        <rect x={-0.22} y={-0.24} width={0.44} height={0.2} rx={0.08} fill="#0b1220" />
        <circle cx={-0.1} cy={-0.14} r={0.05} fill={aturdido ? '#fca5a5' : '#7dd3fc'} />
        <circle cx={0.1} cy={-0.14} r={0.05} fill={aturdido ? '#fca5a5' : '#7dd3fc'} />
        <rect x={-0.38} y={-0.18} width={0.08} height={0.36} rx={0.04} fill="#1e293b" />
        <rect x={0.3} y={-0.18} width={0.08} height={0.36} rx={0.04} fill="#1e293b" />
      </g>
      {r.lapiz && <circle r={0.09} fill="#fff" stroke={r.color} strokeWidth={0.04} />}
      {aturdido && (
        <text y={-0.55} fontSize={0.36} textAnchor="middle">
          💫
        </text>
      )}
      <g transform="translate(0,-0.72)">
        <rect x={-0.3} y={-0.17} width={0.6} height={0.3} rx={0.15} fill="rgba(2,6,23,.85)" stroke={r.color} strokeWidth={0.03} />
        <text y={0.06} fontSize={0.22} fill="#fff" textAnchor="middle" fontWeight="bold">
          {r.id > 900 ? `V${r.id - 900}` : r.id}
        </text>
      </g>
    </g>
  );
}

export default function PistaRobotsMandos({ onExit }) {
  const [fase, setFase] = useState('config'); // config | juego | final
  const [modoJuego, setModoJuego] = useState('estrellas'); // estrellas | preguntas
  const [tamano, setTamano] = useState('grande');
  const [pasos, setPasos] = useState(1);
  const [duracion, setDuracion] = useState(180); // s; 0 = sin límite
  const [conEstrellas, setConEstrellas] = useState(true);
  const [fuente, setFuente] = useState('tablas'); // tablas | sumas | recurso
  const [recurso, setRecurso] = useState(null);
  const [restante, setRestante] = useState(0);
  const [antena, setAntena] = useState({ antenaOk: false, version: 0 });
  const [simulador, setSimulador] = useState(false);
  const [, setVersion] = useState(0);

  const juego = useRef(juegoVacio());
  const cfg = useRef({});
  const { cols, filas } = TAMANOS[tamano];
  cfg.current = { pasos, conEstrellas, modoJuego, cols, filas };
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const finRef = useRef(0);
  const colaRef = useRef([]); // preguntas pendientes (modo recurso)
  const timers = useRef([]);
  const nombres = useRef(leerNombres());
  const raizRef = useRef(null);

  const repintar = () => setVersion((v) => v + 1);
  const nombre = (id) => nombres.current[id] || (id > 900 ? `Virtual ${id - 900}` : `Mando ${id}`);
  const luego = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => escucharEstadoAntena(setAntena), []);
  useEffect(() => {
    setModoMandos(MODOS.MOVER);
    return () => {
      setModoMandos(MODOS.LETRAS);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const efecto = (x, y, txt, color) => {
    const e = { id: Math.random(), x, y, txt, color };
    juego.current.efectos.push(e);
    luego(() => {
      juego.current.efectos = juego.current.efectos.filter((f) => f !== e);
      repintar();
    }, 1000);
  };

  const terminar = () => {
    setFase('final');
    sonidoFinal();
  };

  /** Siguiente pregunta: sus respuestas se reparten lejos de los robots y entre sí. */
  const nuevaPregunta = () => {
    const j = juego.current;
    const { cols: c, filas: f } = cfg.current;
    let q;
    if (fuente === 'recurso') {
      if (!colaRef.current.length) {
        terminar();
        return;
      }
      const p = colaRef.current.shift();
      const orden = barajar(p.opciones.map((_, i) => i));
      q = { texto: p.texto, opciones: orden.map((i) => p.opciones[i]), correcta: orden.indexOf(p.correcta) };
    } else q = GENERADORES[fuente]();
    j.pregunta = { q, fichas: [], ganador: null, n: (j.pregunta?.n || 0) + 1 };
    q.opciones.slice(0, 4).forEach((_, i) => j.pregunta.fichas.push({ ...casillaLibre(j, c, f, 2), i }));
    repintar();
  };

  // Pulsaciones: el primer toque de un mando hace aparecer su robot.
  const manejar = useRef(null);
  manejar.current = ({ id, tipo, mov }) => {
    if (faseRef.current !== 'juego' || tipo !== 'mover') return;
    const j = juego.current;
    const { pasos: nPasos, conEstrellas: estrellas, modoJuego: modo, cols: c, filas: f } = cfg.current;
    let r = j.robots[id];
    if (!r) {
      const { x, y } = casillaLibre(j, c, f, 1);
      r = { id, x, y, rot: 0, puntos: 0, lapiz: false, color: COLORES[j.orden % COLORES.length], aturdidoHasta: 0 };
      j.orden += 1;
      j.robots[id] = r;
      if (modo === 'estrellas' && estrellas) reponerEstrellas();
      repintar();
      return;
    }
    if (r.aturdidoHasta > Date.now()) return;
    const dir = (((r.rot / 90) % 4) + 4) % 4;
    if (mov === 'B') r.rot += 90;
    else if (mov === 'X') r.lapiz = !r.lapiz;
    else {
      for (let i = 0; i < nPasos; i++) {
        const nx = r.x + DX[dir];
        const ny = r.y + DY[dir];
        if (nx < 0 || ny < 0 || nx >= c || ny >= f) break; // pared
        if (r.lapiz) j.trazos.push({ x1: r.x, y1: r.y, x2: nx, y2: ny, color: r.color });
        r.x = nx;
        r.y = ny;
        if (modo === 'estrellas') {
          const antes = j.estrellas.length;
          j.estrellas = j.estrellas.filter((e) => e.x !== nx || e.y !== ny);
          if (j.estrellas.length < antes) {
            r.puntos += 1;
            efecto(nx, ny, '+1', '#facc15');
            reponerEstrellas();
            sonidoCorrecto();
            if (id < 900) feedbackMando(id, true);
          }
        } else if (j.pregunta && !j.pregunta.ganador) {
          const ficha = j.pregunta.fichas.find((fi) => fi.x === nx && fi.y === ny);
          if (!ficha) continue;
          if (ficha.i === j.pregunta.q.correcta) {
            r.puntos += PUNTOS_BIEN;
            j.pregunta.ganador = id;
            efecto(nx, ny, `+${PUNTOS_BIEN}`, '#4ade80');
            sonidoCorrecto();
            if (id < 900) feedbackMando(id, true);
            const n = j.pregunta.n;
            luego(() => {
              if (faseRef.current === 'juego' && juego.current.pregunta?.n === n) nuevaPregunta();
            }, PAUSA_GANADOR);
          } else {
            r.puntos = Math.max(0, r.puntos - PUNTOS_MAL);
            r.aturdidoHasta = Date.now() + ATURDIDO_MS;
            efecto(nx, ny, `−${PUNTOS_MAL}`, '#f87171');
            sonidoIncorrecto();
            if (id < 900) feedbackMando(id, false);
            luego(repintar, ATURDIDO_MS + 50);
          }
          break; // al pisar una respuesta el robot se para
        }
      }
    }
    repintar();
  };
  useEffect(() => escucharMandos((ev) => manejar.current(ev)), []);

  function reponerEstrellas() {
    const j = juego.current;
    const { cols: c, filas: f, conEstrellas: estrellas } = cfg.current;
    if (!estrellas) {
      j.estrellas = [];
      return;
    }
    const objetivo = Math.max(4, Object.keys(j.robots).length + 1);
    while (j.estrellas.length < objetivo) j.estrellas.push({ ...casillaLibre(j, c, f, 1), k: Math.random() });
  }

  // Cuenta atrás.
  useEffect(() => {
    if (fase !== 'juego' || !duracion) return undefined;
    const t = setInterval(() => {
      const quedan = Math.max(0, Math.ceil((finRef.current - Date.now()) / 1000));
      setRestante(quedan);
      if (quedan <= 0) terminar();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, duracion]);

  const preguntasRecurso = recurso ? hojasQuiz(recurso).flatMap((h) => h.preguntas) : [];

  const empezar = () => {
    if (modoJuego === 'preguntas' && fuente === 'recurso') {
      if (!preguntasRecurso.length) {
        alert('Elige un recurso con preguntas de opción múltiple.');
        return;
      }
      colaRef.current = barajar(preguntasRecurso);
    }
    despertarAudio();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    nombres.current = leerNombres();
    juego.current = juegoVacio();
    finRef.current = Date.now() + duracion * 1000;
    setRestante(duracion);
    setFase('juego');
    if (modoJuego === 'preguntas') nuevaPregunta();
    else reponerEstrellas();
  };

  const borrarDibujos = () => {
    juego.current.trazos = [];
    repintar();
  };

  const pantallaCompleta = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else raizRef.current?.requestFullscreen?.();
    } catch {
      /* no disponible */
    }
  };

  const j = juego.current;
  const robots = Object.values(j.robots);
  const ranking = [...robots].sort((a, b) => b.puntos - a.puntos);
  const viejaAntena = antena.antenaOk && antena.version < 2;
  const ahora = Date.now();
  const preg = j.pregunta;

  const virtuales = (
    <div style={{ marginTop: 12 }}>
      <button style={st.btnSec} onClick={() => setSimulador((s) => !s)}>
        🧪 {simulador ? 'Ocultar' : 'Mandos'} virtuales
      </button>
      {simulador &&
        [901, 902, 903].map((id) => (
          <div key={id} style={{ ...st.fila, marginTop: 6, gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 12, width: 26 }}>V{id - 900}</span>
            <button style={st.miniBtn} title="A: avanzar" onClick={() => simularPulsacion(id, 'MA')}>
              ⬆
            </button>
            <button style={st.miniBtn} title="B: girar" onClick={() => simularPulsacion(id, 'MB')}>
              ↻
            </button>
            <button style={st.miniBtn} title="A+B: lápiz" onClick={() => simularPulsacion(id, 'MX')}>
              ✏️
            </button>
          </div>
        ))}
    </div>
  );

  return (
    <div ref={raizRef} style={st.wrapper}>
      <style>{CSS}</style>
      <header style={st.header}>
        <button onClick={onExit} style={st.backBtn}>
          ← Volver
        </button>
        <h2 style={st.title}>🤖 Pista de robots</h2>
        {fase === 'juego' && duracion > 0 && (
          <span style={{ ...st.reloj, color: restante <= 10 ? '#f87171' : '#facc15' }}>⏱ {restante}s</span>
        )}
        <ChipAntena />
        <button style={st.btnSec} onClick={pantallaCompleta} title="Pantalla completa">
          ⛶
        </button>
      </header>

      {viejaAntena && (
        <p style={{ ...st.aviso, padding: '8px 18px', margin: 0 }}>
          ⚠️ La antena tiene el programa antiguo: vuelve a grabar la antena y los mandos en el panel para usar el modo mover.
        </p>
      )}

      {fase === 'config' && (
        <div style={st.scroll}>
          <div style={st.panel}>
            <h3 style={st.h3}>¿A qué jugamos?</h3>
            <div style={st.modos}>
              {[
                ['estrellas', '⭐', 'Estrellas', 'Recoged todas las estrellas que podáis. Cada una vale 1 punto.'],
                [
                  'preguntas',
                  '❓',
                  'Preguntas',
                  `Las respuestas están repartidas por la pista: el primero que llega a la correcta gana ${PUNTOS_BIEN} puntos. ¡Si pisas una incorrecta pierdes ${PUNTOS_MAL} y te quedas aturdido!`,
                ],
              ].map(([k, emoji, titulo, desc]) => (
                <button key={k} onClick={() => setModoJuego(k)} style={st.tarjetaModo(modoJuego === k)}>
                  <span style={{ fontSize: 40 }}>{emoji}</span>
                  <b style={{ fontSize: 18 }}>{titulo}</b>
                  <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.4 }}>{desc}</span>
                </button>
              ))}
            </div>

            {modoJuego === 'preguntas' && (
              <div style={{ marginTop: 16 }}>
                <h3 style={st.h3}>Preguntas</h3>
                <div style={st.fila}>
                  {[
                    ['tablas', '✖️ Tablas'],
                    ['sumas', '➕ Sumas y restas'],
                    ['recurso', '📚 Recurso'],
                  ].map(([k, txt]) => (
                    <button key={k} onClick={() => setFuente(k)} style={st.opcionCfg(fuente === k)}>
                      {txt}
                    </button>
                  ))}
                </div>
                {fuente === 'recurso' && (
                  <>
                    <SelectorRecursoMandos seleccionado={recurso} onPick={setRecurso} />
                    {recurso && (
                      <p style={{ ...st.ayuda, marginTop: 10 }}>
                        <b style={{ color: '#facc15' }}>✔ {recurso.titulo || 'Sin título'}</b> · {preguntasRecurso.length}{' '}
                        preguntas (la partida acaba al terminarlas o al acabar el tiempo)
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <h3 style={{ ...st.h3, marginTop: 18 }}>Ajustes</h3>
            <div style={st.fila}>
              <label style={st.label}>
                Tamaño de la pista
                <select value={tamano} onChange={(e) => setTamano(e.target.value)} style={st.select}>
                  {Object.entries(TAMANOS).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.l} ({t.cols}×{t.filas})
                    </option>
                  ))}
                </select>
              </label>
              <label style={st.label}>
                Casillas por pulsación de A
                <select value={pasos} onChange={(e) => setPasos(Number(e.target.value))} style={st.select}>
                  {[1, 2, 3].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={st.label}>
                Duración
                <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} style={st.select}>
                  <option value={60}>1 min</option>
                  <option value={120}>2 min</option>
                  <option value={180}>3 min</option>
                  <option value={300}>5 min</option>
                  <option value={600}>10 min</option>
                  <option value={0}>Sin límite</option>
                </select>
              </label>
              {modoJuego === 'estrellas' && (
                <label style={{ ...st.label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={!conEstrellas} onChange={(e) => setConEstrellas(!e.target.checked)} />
                  Sin estrellas (dibujo libre con el lápiz)
                </label>
              )}
            </div>
            <p style={{ ...st.ayuda, marginTop: 12 }}>
              Con el mando: <b>A</b> avanza, <b>B</b> gira a la derecha y <b>A + B</b> sube o baja el lápiz. El robot
              aparece al pulsar cualquier botón.
            </p>
            <BotonTutorialMandos inicial="mover" texto="📖 Tutorial del mando" style={{ padding: '6px 12px' }} />
            <button style={st.btnGrande} onClick={empezar}>
              Empezar ▶
            </button>
          </div>
          {virtuales}
        </div>
      )}

      {fase === 'juego' && (
        <div style={st.juego}>
          <div style={st.centro}>
            {modoJuego === 'preguntas' && preg && (
              <div style={st.barraPregunta}>
                <div style={st.preguntaTxt}>{preg.q.texto}</div>
                <div style={st.opcionesFila}>
                  {preg.q.opciones.slice(0, 4).map((o, i) => {
                    const bien = preg.ganador && i === preg.q.correcta;
                    return (
                      <span
                        key={i}
                        style={{
                          ...st.opcionChip,
                          background: COLORES_OP[i],
                          opacity: preg.ganador && !bien ? 0.35 : 1,
                          boxShadow: bien ? '0 0 0 4px #fff, 0 0 24px #4ade80' : 'none',
                        }}
                      >
                        <b style={st.opLetra}>{LETRAS[i]}</b> {o}
                      </span>
                    );
                  })}
                </div>
                {preg.ganador && (
                  <div className="pr-aparece" style={st.ganador}>
                    🏆 ¡{nombre(preg.ganador)} ha llegado primero! +{PUNTOS_BIEN}
                  </div>
                )}
              </div>
            )}
            <div style={st.tableroCaja}>
              <svg viewBox={`-0.3 -0.3 ${cols + 0.6} ${filas + 0.6}`} preserveAspectRatio="xMidYMid meet" style={st.tablero}>
                <defs>
                  <radialGradient id="pr-fondo" cx="50%" cy="45%" r="75%">
                    <stop offset="0%" stopColor="#1e1b4b" />
                    <stop offset="100%" stopColor="#020617" />
                  </radialGradient>
                  <filter id="pr-brillo" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="0.07" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect x={-0.3} y={-0.3} width={cols + 0.6} height={filas + 0.6} rx={0.4} fill="url(#pr-fondo)" />
                <rect x={0} y={0} width={cols} height={filas} fill="none" stroke="#6366f1" strokeWidth={0.06} filter="url(#pr-brillo)" />
                {Array.from({ length: cols - 1 }, (_, i) => (
                  <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={filas} stroke="rgba(99,102,241,.18)" strokeWidth={0.025} />
                ))}
                {Array.from({ length: filas - 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={i + 1} x2={cols} y2={i + 1} stroke="rgba(99,102,241,.18)" strokeWidth={0.025} />
                ))}
                {j.trazos.map((t, i) => (
                  <line
                    key={i}
                    x1={t.x1 + 0.5}
                    y1={t.y1 + 0.5}
                    x2={t.x2 + 0.5}
                    y2={t.y2 + 0.5}
                    stroke={t.color}
                    strokeWidth={0.13}
                    strokeLinecap="round"
                    filter="url(#pr-brillo)"
                  />
                ))}
                {j.estrellas.map((e) => (
                  <g key={e.k} transform={`translate(${e.x + 0.5},${e.y + 0.5})`}>
                    <polygon className="pr-latido" points={estrellaPts} fill="#facc15" stroke="#fde68a" strokeWidth={0.03} filter="url(#pr-brillo)" />
                  </g>
                ))}
                {preg &&
                  preg.fichas.map((fi) => {
                    const correcta = fi.i === preg.q.correcta;
                    const apagada = preg.ganador && !correcta;
                    return (
                      <g key={`${preg.n}-${fi.i}`} transform={`translate(${fi.x + 0.5},${fi.y + 0.5})`} opacity={apagada ? 0.25 : 1}>
                        <g className={preg.ganador && correcta ? 'pr-gana' : 'pr-latido'}>
                          <rect x={-0.42} y={-0.42} width={0.84} height={0.84} rx={0.18} fill={COLORES_OP[fi.i]} stroke="#fff" strokeWidth={0.05} filter="url(#pr-brillo)" />
                          <text y={0.2} fontSize={0.56} textAnchor="middle" fontWeight="900" fill="#fff">
                            {LETRAS[fi.i]}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                {robots.map((r) => (
                  <Robot key={r.id} r={r} ahora={ahora} />
                ))}
                {j.efectos.map((e) => (
                  <text
                    key={e.id}
                    className="pr-flota"
                    x={e.x + 0.5}
                    y={e.y + 0.2}
                    fontSize={0.6}
                    textAnchor="middle"
                    fontWeight="900"
                    fill={e.color}
                    stroke="#020617"
                    strokeWidth={0.04}
                  >
                    {e.txt}
                  </text>
                ))}
              </svg>
              {robots.length === 0 && <div style={st.esperando}>🎮 Pulsad cualquier botón del mando para que aparezca vuestro robot</div>}
            </div>
          </div>

          <aside style={st.lateral}>
            <h3 style={st.h3}>{modoJuego === 'preguntas' ? '🏆 Puntos' : conEstrellas ? '⭐ Puntos' : '✏️ Robots'}</h3>
            {ranking.map((r, i) => (
              <div key={r.id} style={st.filaRank}>
                <span style={{ width: 22, color: '#94a3b8' }}>{i + 1}</span>
                <span style={{ ...st.punto, background: r.color, boxShadow: `0 0 10px ${r.color}` }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre(r.id)}</span>
                {r.aturdidoHasta > ahora && <span title="Aturdido">💫</span>}
                {r.lapiz && <span title="Lápiz bajado">✏️</span>}
                {(modoJuego === 'preguntas' || conEstrellas) && <b style={{ fontSize: 18 }}>{r.puntos}</b>}
              </div>
            ))}
            <div style={{ ...st.fila, marginTop: 14, gap: 6 }}>
              <button style={st.btnSec} onClick={borrarDibujos}>
                🧽 Borrar dibujos
              </button>
              {modoJuego === 'preguntas' && (
                <button style={st.btnSec} onClick={nuevaPregunta}>
                  ⏭ Otra pregunta
                </button>
              )}
              <button style={st.btnSec} onClick={terminar}>
                🏁 Terminar
              </button>
            </div>
            {virtuales}
          </aside>
        </div>
      )}

      {fase === 'final' && (
        <div style={st.scroll}>
          <div style={st.panel}>
            <h3 style={{ ...st.h3, textAlign: 'center', fontSize: 30 }}>🏆 Clasificación</h3>
            {ranking.map((r, i) => (
              <div key={r.id} style={{ ...st.filaRank, fontSize: i < 3 ? 24 : 17 }}>
                <span style={{ width: 50 }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                <span style={{ ...st.punto, background: r.color }} />
                <span style={{ flex: 1 }}>{nombre(r.id)}</span>
                <b>{r.puntos} pts</b>
              </div>
            ))}
            <div style={{ textAlign: 'center' }}>
              <button style={st.btnGrande} onClick={() => setFase('config')}>
                Jugar otra vez
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.pr-latido { transform-box: fill-box; transform-origin: center; animation: pr-latido 1.6s ease-in-out infinite; }
@keyframes pr-latido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.pr-gana { transform-box: fill-box; transform-origin: center; animation: pr-gana .5s ease-in-out infinite alternate; }
@keyframes pr-gana { from { transform: scale(1); } to { transform: scale(1.3); } }
.pr-aturdido { animation: pr-tiembla .12s linear infinite; }
@keyframes pr-tiembla { 0% { translate: -0.04px 0; } 50% { translate: 0.04px 0; } 100% { translate: -0.04px 0; } }
.pr-flota { animation: pr-flota 1s ease-out forwards; }
@keyframes pr-flota { from { opacity: 1; translate: 0 0; } to { opacity: 0; translate: 0 -1.2px; } }
.pr-aparece { animation: pr-aparece .35s ease-out; }
@keyframes pr-aparece { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
`;

const st = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    background: 'radial-gradient(ellipse at 50% 0%, #1e1b4b 0%, #0f172a 55%, #020617 100%)',
    fontFamily: 'system-ui, sans-serif',
    color: '#e2e8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    padding: '10px 18px',
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
  reloj: { fontWeight: 900, fontSize: 22, fontVariantNumeric: 'tabular-nums' },
  scroll: { flex: 1, overflow: 'auto', padding: '16px 16px 40px', maxWidth: 1000, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  panel: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 18 },
  h3: { margin: '0 0 12px', color: '#f8fafc', fontSize: 18 },
  ayuda: { color: '#94a3b8', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 },
  aviso: { color: '#fde68a', fontSize: 14, margin: '0 0 12px' },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  modos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 },
  tarjetaModo: (on) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    padding: 16,
    borderRadius: 16,
    textAlign: 'left',
    border: `2px solid ${on ? '#facc15' : '#334155'}`,
    background: on ? 'rgba(250,204,21,0.12)' : 'rgba(15,23,42,0.6)',
    color: '#f1f5f9',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  opcionCfg: (on) => ({
    padding: '9px 15px',
    borderRadius: 12,
    border: `2px solid ${on ? '#facc15' : '#475569'}`,
    background: on ? 'rgba(250,204,21,0.12)' : 'transparent',
    color: '#f1f5f9',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#94a3b8' },
  select: {
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: 15,
  },
  btnGrande: {
    marginTop: 16,
    background: 'linear-gradient(180deg, #22c55e, #15803d)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 28px',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnSec: {
    background: 'transparent',
    color: '#e2e8f0',
    border: '1px solid #475569',
    borderRadius: 10,
    padding: '7px 11px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  miniBtn: {
    padding: '5px 10px',
    borderRadius: 8,
    border: 'none',
    background: '#334155',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  juego: { flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: 12, flexWrap: 'wrap' },
  centro: { flex: '1 1 600px', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' },
  barraPregunta: {
    background: 'rgba(15,23,42,0.85)',
    border: '1px solid #4338ca',
    borderRadius: 16,
    padding: '10px 16px',
    position: 'relative',
  },
  preguntaTxt: { fontSize: 'clamp(22px, 3.2vw, 40px)', fontWeight: 900, textAlign: 'center', color: '#fff', lineHeight: 1.15 },
  opcionesFila: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  opcionChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px 6px 6px',
    borderRadius: 12,
    color: '#fff',
    fontWeight: 800,
    fontSize: 'clamp(15px, 1.8vw, 22px)',
    transition: 'opacity .3s, box-shadow .3s',
  },
  opLetra: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ganador: { textAlign: 'center', marginTop: 8, fontSize: 'clamp(18px, 2.4vw, 28px)', fontWeight: 900, color: '#4ade80' },
  tableroCaja: { flex: 1, minHeight: 280, position: 'relative', display: 'flex' },
  tablero: { width: '100%', height: '100%', display: 'block' },
  esperando: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: 'clamp(18px, 2.4vw, 30px)',
    fontWeight: 800,
    color: '#c7d2fe',
    pointerEvents: 'none',
    padding: 20,
  },
  lateral: {
    flex: '0 1 260px',
    minWidth: 220,
    background: 'rgba(15,23,42,0.75)',
    border: '1px solid #334155',
    borderRadius: 14,
    padding: 14,
    overflowY: 'auto',
    maxHeight: '100%',
    boxSizing: 'border-box',
  },
  filaRank: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid #334155' },
  punto: { width: 14, height: 14, borderRadius: 99, flexShrink: 0 },
};
