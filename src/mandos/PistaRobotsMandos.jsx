// Pista de robots con mandos micro:bit (modo MOVER): cada mando lleva un robot
// por una cuadrícula. A = avanza N casillas, B = gira 90° a la derecha,
// A+B = sube/baja el lápiz (deja rastro). Recoger estrellas da puntos.
// El estado de la partida vive en un ref (se muta) y `setVersion` repinta:
// así los efectos (sonido, feedback al mando) no van dentro de un setState.
import React, { useEffect, useRef, useState } from 'react';
import {
  MODOS,
  setModoMandos,
  escucharMandos,
  escucharEstadoAntena,
  simularPulsacion,
  feedbackMando,
} from './mandosMicrobit.js';
import { despertarAudio, sonidoCorrecto, sonidoFinal } from '../utils/sonidosFeedback';

const COLS = 16;
const FILAS = 10;
const DX = [0, 1, 0, -1]; // 0 norte, 1 este, 2 sur, 3 oeste
const DY = [-1, 0, 1, 0];
const COLORES = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#eab308', '#6366f1'];
const LS_NOMBRES = 'pikt_mandos_nombres';

const leerNombres = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_NOMBRES) || '{}') || {};
  } catch {
    return {};
  }
};

const juegoVacio = () => ({ robots: {}, estrellas: [], trazos: [], orden: 0 });

function casillaLibre(j) {
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * FILAS);
    const ocupada =
      Object.values(j.robots).some((r) => r.x === x && r.y === y) || j.estrellas.some((e) => e.x === x && e.y === y);
    if (!ocupada) return { x, y };
  }
  return { x: 0, y: 0 };
}

function reponerEstrellas(j, activas) {
  if (!activas) {
    j.estrellas = [];
    return;
  }
  const objetivo = Math.max(3, Object.keys(j.robots).length);
  while (j.estrellas.length < objetivo) j.estrellas.push({ ...casillaLibre(j), k: Math.random() });
}

export default function PistaRobotsMandos({ onExit }) {
  const [fase, setFase] = useState('config'); // config | juego | final
  const [pasos, setPasos] = useState(1);
  const [duracion, setDuracion] = useState(120); // s; 0 = sin límite
  const [conEstrellas, setConEstrellas] = useState(true);
  const [restante, setRestante] = useState(0);
  const [antena, setAntena] = useState({ antenaOk: false, version: 0 });
  const [simulador, setSimulador] = useState(false);
  const [, setVersion] = useState(0);

  const juego = useRef(juegoVacio());
  const cfg = useRef({ pasos, conEstrellas });
  cfg.current = { pasos, conEstrellas };
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const finRef = useRef(0);
  const nombres = useRef(leerNombres());

  const repintar = () => setVersion((v) => v + 1);
  const nombre = (id) => nombres.current[id] || (id > 900 ? `Virtual ${id - 900}` : `Mando ${id}`);

  useEffect(() => escucharEstadoAntena(setAntena), []);
  useEffect(() => {
    setModoMandos(MODOS.MOVER);
    return () => setModoMandos(MODOS.LETRAS);
  }, []);

  // Pulsaciones: el primer toque de un mando hace aparecer su robot.
  useEffect(
    () =>
      escucharMandos(({ id, tipo, mov }) => {
        if (faseRef.current !== 'juego' || tipo !== 'mover') return;
        const j = juego.current;
        let r = j.robots[id];
        if (!r) {
          const { x, y } = casillaLibre(j);
          r = { id, x, y, rot: 0, puntos: 0, lapiz: false, color: COLORES[j.orden % COLORES.length] };
          j.orden += 1;
          j.robots[id] = r;
          reponerEstrellas(j, cfg.current.conEstrellas);
          repintar();
          return;
        }
        const dir = (((r.rot / 90) % 4) + 4) % 4;
        if (mov === 'B') {
          r.rot += 90;
        } else if (mov === 'X') {
          r.lapiz = !r.lapiz;
        } else {
          let premios = 0;
          for (let i = 0; i < cfg.current.pasos; i++) {
            const nx = r.x + DX[dir];
            const ny = r.y + DY[dir];
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= FILAS) break; // pared
            if (r.lapiz) j.trazos.push({ x1: r.x, y1: r.y, x2: nx, y2: ny, color: r.color });
            r.x = nx;
            r.y = ny;
            const antes = j.estrellas.length;
            j.estrellas = j.estrellas.filter((e) => e.x !== nx || e.y !== ny);
            premios += antes - j.estrellas.length;
          }
          if (premios) {
            r.puntos += premios;
            reponerEstrellas(j, cfg.current.conEstrellas);
            sonidoCorrecto();
            if (id < 900) feedbackMando(id, true);
          }
        }
        repintar();
      }),
    []
  );

  // Cuenta atrás.
  useEffect(() => {
    if (fase !== 'juego' || !duracion) return undefined;
    const t = setInterval(() => {
      const quedan = Math.max(0, Math.ceil((finRef.current - Date.now()) / 1000));
      setRestante(quedan);
      if (quedan <= 0) {
        setFase('final');
        sonidoFinal();
      }
    }, 250);
    return () => clearInterval(t);
  }, [fase, duracion]);

  const empezar = () => {
    despertarAudio();
    nombres.current = leerNombres();
    juego.current = juegoVacio();
    finRef.current = Date.now() + duracion * 1000;
    setRestante(duracion);
    setFase('juego');
  };

  const borrarDibujos = () => {
    juego.current.trazos = [];
    repintar();
  };

  const j = juego.current;
  const robots = Object.values(j.robots);
  const ranking = [...robots].sort((a, b) => b.puntos - a.puntos);
  const viejaAntena = antena.antenaOk && antena.version < 2;

  return (
    <div style={st.wrapper}>
      <header style={st.header}>
        <button onClick={onExit} style={st.backBtn}>
          ← Volver
        </button>
        <h2 style={st.title}>🤖 Pista de robots</h2>
        {fase === 'juego' && duracion > 0 && <span style={st.reloj}>⏱ {restante}s</span>}
        <span style={{ ...st.chip, background: antena.antenaOk ? '#16a34a' : '#475569' }}>
          {antena.antenaOk ? '📡 Antena lista' : '⚪ Sin antena'}
        </span>
      </header>

      <div style={st.scroll}>
        {viejaAntena && (
          <p style={st.aviso}>
            ⚠️ La antena tiene el programa antiguo: vuelve a grabar la antena y los mandos en el panel para usar el
            modo mover.
          </p>
        )}

        {fase === 'config' && (
          <div style={st.panel}>
            <p style={st.ayuda}>
              Cada mando lleva un robot. <b>A</b> avanza, <b>B</b> gira 90° a la derecha y <b>A + B</b> sube o baja el
              lápiz para dibujar el camino. El robot aparece al pulsar cualquier botón.
            </p>
            <div style={st.fila}>
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
                  <option value={0}>Sin límite</option>
                </select>
              </label>
              <label style={{ ...st.label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={conEstrellas} onChange={(e) => setConEstrellas(e.target.checked)} />
                ⭐ Recoger estrellas (sin ellas: dibujo libre)
              </label>
            </div>
            <button style={st.btnGrande} onClick={empezar}>
              Empezar ▶
            </button>
          </div>
        )}

        {fase === 'juego' && (
          <div style={st.juego}>
            <svg viewBox={`0 0 ${COLS} ${FILAS}`} style={st.tablero}>
              <rect width={COLS} height={FILAS} fill="#0b1220" />
              {Array.from({ length: COLS + 1 }, (_, i) => (
                <line key={`v${i}`} x1={i} y1={0} x2={i} y2={FILAS} stroke="#1e293b" strokeWidth={0.03} />
              ))}
              {Array.from({ length: FILAS + 1 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i} x2={COLS} y2={i} stroke="#1e293b" strokeWidth={0.03} />
              ))}
              {j.trazos.map((t, i) => (
                <line
                  key={i}
                  x1={t.x1 + 0.5}
                  y1={t.y1 + 0.5}
                  x2={t.x2 + 0.5}
                  y2={t.y2 + 0.5}
                  stroke={t.color}
                  strokeWidth={0.14}
                  strokeLinecap="round"
                />
              ))}
              {j.estrellas.map((e) => (
                <text key={e.k} x={e.x + 0.5} y={e.y + 0.72} fontSize={0.7} textAnchor="middle">
                  ⭐
                </text>
              ))}
              {robots.map((r) => (
                <g key={r.id} style={{ transform: `translate(${r.x + 0.5}px, ${r.y + 0.5}px)`, transition: 'transform .25s' }}>
                  <g style={{ transform: `rotate(${r.rot}deg)`, transition: 'transform .25s' }}>
                    <polygon points="0,-0.42 0.34,0.32 0,0.16 -0.34,0.32" fill={r.color} stroke="#fff" strokeWidth={0.05} />
                  </g>
                  {r.lapiz && <circle r={0.1} fill="#fff" />}
                  <text y={-0.5} fontSize={0.32} fill="#fff" textAnchor="middle" fontWeight="bold">
                    {r.id > 900 ? `V${r.id - 900}` : r.id}
                  </text>
                </g>
              ))}
            </svg>

            <aside style={st.lateral}>
              <h3 style={st.h3}>{conEstrellas ? '⭐ Puntos' : '✏️ Robots'}</h3>
              {ranking.length === 0 && <p style={st.ayuda}>Pulsad un botón del mando para que aparezca vuestro robot.</p>}
              {ranking.map((r) => (
                <div key={r.id} style={st.filaRank}>
                  <span style={{ ...st.punto, background: r.color }} />
                  <span style={{ flex: 1 }}>{nombre(r.id)}</span>
                  {r.lapiz && <span title="Lápiz bajado">✏️</span>}
                  {conEstrellas && <b>{r.puntos}</b>}
                </div>
              ))}
              <div style={{ ...st.fila, marginTop: 14 }}>
                <button style={st.btnSec} onClick={borrarDibujos}>
                  🧽 Borrar dibujos
                </button>
                <button
                  style={st.btnSec}
                  onClick={() => {
                    setFase('final');
                    sonidoFinal();
                  }}
                >
                  🏁 Terminar
                </button>
              </div>
            </aside>
          </div>
        )}

        {fase === 'final' && (
          <div style={st.panel}>
            <h3 style={{ ...st.h3, textAlign: 'center', fontSize: 28 }}>🏆 Clasificación</h3>
            {ranking.map((r, i) => (
              <div key={r.id} style={{ ...st.filaRank, fontSize: i < 3 ? 22 : 17 }}>
                <span style={{ width: 50 }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                <span style={{ ...st.punto, background: r.color }} />
                <span style={{ flex: 1 }}>{nombre(r.id)}</span>
                <b>{r.puntos} ⭐</b>
              </div>
            ))}
            <div style={{ textAlign: 'center' }}>
              <button style={st.btnGrande} onClick={() => setFase('config')}>
                Jugar otra vez
              </button>
            </div>
          </div>
        )}

        {/* Mandos virtuales para probar sin placas */}
        <div style={{ marginTop: 22 }}>
          <button style={st.btnSec} onClick={() => setSimulador((s) => !s)}>
            🧪 {simulador ? 'Ocultar' : 'Mostrar'} mandos virtuales
          </button>
          {simulador &&
            [901, 902, 903].map((id) => (
              <div key={id} style={{ ...st.fila, marginTop: 8 }}>
                <span style={{ color: '#94a3b8', fontSize: 13, width: 80 }}>Virtual {id - 900}</span>
                <button style={st.miniBtn} title="A: avanzar" onClick={() => simularPulsacion(id, 'MA')}>
                  ⬆ A
                </button>
                <button style={st.miniBtn} title="B: girar" onClick={() => simularPulsacion(id, 'MB')}>
                  ↻ B
                </button>
                <button style={st.miniBtn} title="A+B: lápiz" onClick={() => simularPulsacion(id, 'MX')}>
                  ✏️ A+B
                </button>
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
  reloj: { fontWeight: 800, color: '#facc15', fontSize: 18 },
  scroll: { flex: 1, overflow: 'auto', padding: '16px 16px 40px', maxWidth: 1300, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  panel: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 18 },
  h3: { margin: '0 0 12px', color: '#f8fafc', fontSize: 18 },
  ayuda: { color: '#94a3b8', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 },
  aviso: { color: '#fde68a', fontSize: 14, margin: '0 0 12px' },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
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
    padding: '6px 10px',
    borderRadius: 8,
    border: 'none',
    background: '#334155',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  juego: { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  tablero: { flex: '3 1 520px', width: '100%', maxHeight: '72vh', borderRadius: 12, border: '1px solid #334155' },
  lateral: {
    flex: '1 1 220px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid #334155',
    borderRadius: 14,
    padding: 14,
  },
  filaRank: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid #334155' },
  punto: { width: 14, height: 14, borderRadius: 99, flexShrink: 0 },
};
