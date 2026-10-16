// «Copia el dibujo» con mandos micro:bit (modo MOVER, geometría de tortuga):
// cada alumno tiene su tablero de 7×7 puntos con la figura en gris y la repasa
// con su tortuga. A = avanza 1, B = gira 90° a la derecha, A+B = sube/baja el
// lápiz (empieza bajado). Puntúa más quien la completa antes; los trazos de
// más (en rojo) restan.
// Hay figuras predefinidas, «Mi figura» (editor) y «Libre» (sin modelo).
// Estado en un ref (se muta) + setVersion para repintar, como PistaRobotsMandos.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MODOS,
  setModoMandos,
  escucharMandos,
  escucharEstadoAntena,
  simularPulsacion,
  feedbackMando,
} from './mandosMicrobit.js';
import { despertarAudio, sonidoCorrecto, sonidoFinal } from '../utils/sonidosFeedback';

const N = 7; // puntos por lado (0..6)
const DX = [0, 1, 0, -1]; // 0 norte, 1 este, 2 sur, 3 oeste
const DY = [-1, 0, 1, 0];
const COLORES = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#eab308', '#6366f1'];
const LS_NOMBRES = 'pikt_mandos_nombres';
const LS_FIGURA = 'pikt_mandos_figura';

/** Clave de un tramo unidad, independiente del sentido. */
const clave = (x1, y1, x2, y2) => (x1 < x2 || (x1 === x2 && y1 < y2) ? `${x1},${y1}-${x2},${y2}` : `${x2},${y2}-${x1},${y1}`);
const deClave = (k) => k.split('-').map((p) => p.split(',').map(Number));

/** Polilíneas (solo horizontales/verticales) → conjunto de tramos unidad. */
function tramos(polilineas) {
  const s = new Set();
  for (const pts of polilineas) {
    for (let i = 1; i < pts.length; i++) {
      let [x, y] = pts[i - 1];
      const [x2, y2] = pts[i];
      while (x !== x2 || y !== y2) {
        const nx = x + Math.sign(x2 - x);
        const ny = y + Math.sign(y2 - y);
        s.add(clave(x, y, nx, ny));
        x = nx;
        y = ny;
      }
    }
  }
  return s;
}

// De más fácil a más difícil. `salida`: dónde empieza la tortuga (mirando al norte).
const FIGURAS = [
  { id: 'L', nombre: 'Letra L', lineas: [[[2, 1], [2, 5], [5, 5]]], salida: [2, 5] },
  { id: 'cuadrado', nombre: 'Cuadrado', lineas: [[[2, 5], [2, 2], [5, 2], [5, 5], [2, 5]]], salida: [2, 5] },
  { id: 'rect', nombre: 'Rectángulo', lineas: [[[1, 5], [1, 3], [5, 3], [5, 5], [1, 5]]], salida: [1, 5] },
  { id: 'U', nombre: 'Letra U', lineas: [[[1, 1], [1, 5], [5, 5], [5, 1]]], salida: [1, 5] },
  { id: 'T', nombre: 'Letra T', lineas: [[[1, 1], [5, 1]], [[3, 1], [3, 5]]], salida: [3, 5] },
  { id: 'cruz', nombre: 'Cruz', lineas: [[[3, 1], [3, 5]], [[1, 3], [5, 3]]], salida: [3, 5] },
  {
    id: 'escalera',
    nombre: 'Escalera',
    lineas: [[[1, 6], [1, 5], [2, 5], [2, 4], [3, 4], [3, 3], [4, 3], [4, 2], [5, 2], [5, 1]]],
    salida: [1, 6],
  },
  { id: 'E', nombre: 'Letra E', lineas: [[[5, 1], [1, 1], [1, 5], [5, 5]], [[1, 3], [4, 3]]], salida: [1, 5] },
  { id: 'S', nombre: 'Serpiente', lineas: [[[5, 1], [1, 1], [1, 3], [5, 3], [5, 5], [1, 5]]], salida: [1, 5] },
  {
    id: 'espiral',
    nombre: 'Espiral',
    lineas: [[[3, 3], [3, 2], [4, 2], [4, 4], [2, 4], [2, 1], [5, 1], [5, 5], [1, 5], [1, 1]]],
    salida: [3, 3],
  },
].map((f) => ({ ...f, segs: tramos(f.lineas) }));

const LIBRE = { id: 'libre', nombre: 'Libre', segs: new Set(), salida: [3, 3] };

const leerLS = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
};
const guardarLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
};

const figuraPropia = () => {
  const g = leerLS(LS_FIGURA, null);
  return {
    id: 'propia',
    nombre: 'Mi figura',
    segs: new Set(Array.isArray(g?.segs) ? g.segs : []),
    salida: Array.isArray(g?.salida) ? g.salida : [3, 6],
  };
};

/* ── Dibujo de un tablero (compartido por miniaturas, editor y partida) ── */
function Tablero({ figura, jugador, estilo, onTramo, onPunto }) {
  const editable = !!onTramo;
  const todos = useMemo(() => {
    if (!editable) return [];
    const l = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (x + 1 < N) l.push(clave(x, y, x + 1, y));
        if (y + 1 < N) l.push(clave(x, y, x, y + 1));
      }
    return l;
  }, [editable]);

  return (
    <svg viewBox={`-0.6 -0.6 ${N + 0.2} ${N + 0.2}`} style={estilo}>
      <rect x={-0.6} y={-0.6} width={N + 0.2} height={N + 0.2} rx={0.3} fill="#0b1220" />
      {[...figura.segs].map((k) => {
        const [[x1, y1], [x2, y2]] = deClave(k);
        return (
          <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth={0.3} strokeLinecap="round" />
        );
      })}
      {jugador &&
        [...jugador.trazos].map((k) => {
          const [[x1, y1], [x2, y2]] = deClave(k);
          const bien = figura.id === 'libre' || figura.segs.has(k);
          return (
            <line
              key={'j' + k}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={bien ? jugador.color : '#ef4444'}
              strokeWidth={0.18}
              strokeLinecap="round"
              strokeDasharray={bien ? undefined : '0.15 0.12'}
            />
          );
        })}
      {Array.from({ length: N * N }, (_, i) => (
        <circle
          key={'p' + i}
          cx={i % N}
          cy={Math.floor(i / N)}
          r={editable ? 0.12 : 0.06}
          fill="#64748b"
          style={onPunto ? { cursor: 'pointer' } : undefined}
          onClick={onPunto ? () => onPunto([i % N, Math.floor(i / N)]) : undefined}
        />
      ))}
      {editable &&
        todos.map((k) => {
          const [[x1, y1], [x2, y2]] = deClave(k);
          return (
            <line
              key={'e' + k}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={0.4}
              style={{ cursor: 'pointer' }}
              onClick={() => onTramo(k)}
            />
          );
        })}
      <circle cx={figura.salida[0]} cy={figura.salida[1]} r={0.2} fill="none" stroke="#22c55e" strokeWidth={0.07} />
      {jugador && (
        <g style={{ transform: `translate(${jugador.x}px, ${jugador.y}px)`, transition: 'transform .2s' }}>
          <g style={{ transform: `rotate(${jugador.rot}deg)`, transition: 'transform .2s' }}>
            <polygon
              points="0,-0.36 0.28,0.26 0,0.13 -0.28,0.26"
              fill={jugador.lapiz ? jugador.color : 'transparent'}
              stroke={jugador.lapiz ? '#fff' : jugador.color}
              strokeWidth={0.06}
            />
          </g>
        </g>
      )}
    </svg>
  );
}

const nuevoJugador = (id, color, figura) => ({
  id,
  color,
  x: figura.salida[0],
  y: figura.salida[1],
  rot: 0,
  lapiz: true,
  trazos: new Set(),
  hecho: false,
  puntos: 0,
  figuras: 0,
});

export default function DibujoMandos({ onExit }) {
  const [fase, setFase] = useState('config'); // config | juego | final
  const [figuraSel, setFiguraSel] = useState(FIGURAS[0].id);
  const [propia, setPropia] = useState(figuraPropia);
  const [antena, setAntena] = useState({ antenaOk: false, version: 0 });
  const [simulador, setSimulador] = useState(false);
  const [, setVersion] = useState(0);

  const catalogo = useMemo(() => [...FIGURAS, propia, LIBRE], [propia]);
  const juego = useRef({ jugadores: {}, orden: 0, figura: FIGURAS[0], acabados: 0 });
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const nombres = useRef(leerLS(LS_NOMBRES, {}));

  const repintar = () => setVersion((v) => v + 1);
  const nombre = (id) => nombres.current[id] || (id > 900 ? `Virtual ${id - 900}` : `Mando ${id}`);

  useEffect(() => escucharEstadoAntena(setAntena), []);
  useEffect(() => {
    setModoMandos(MODOS.MOVER);
    return () => setModoMandos(MODOS.LETRAS);
  }, []);
  useEffect(() => guardarLS(LS_FIGURA, { segs: [...propia.segs], salida: propia.salida }), [propia]);

  useEffect(
    () =>
      escucharMandos(({ id, tipo, mov }) => {
        if (faseRef.current !== 'juego' || tipo !== 'mover') return;
        const g = juego.current;
        const fig = g.figura;
        let p = g.jugadores[id];
        if (!p) {
          // El primer toque solo hace aparecer el tablero del alumno.
          g.jugadores[id] = nuevoJugador(id, COLORES[g.orden % COLORES.length], fig);
          g.orden += 1;
          repintar();
          return;
        }
        if (p.hecho) return;
        if (mov === 'B') p.rot += 90;
        else if (mov === 'X') p.lapiz = !p.lapiz;
        else {
          const dir = (((p.rot / 90) % 4) + 4) % 4;
          const nx = p.x + DX[dir];
          const ny = p.y + DY[dir];
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) return; // borde
          if (p.lapiz) p.trazos.add(clave(p.x, p.y, nx, ny));
          p.x = nx;
          p.y = ny;
          // ¿Completa? Todos los tramos de la figura; cada tramo de más resta 100.
          if (fig.segs.size && [...fig.segs].every((k) => p.trazos.has(k))) {
            const sobran = p.trazos.size - fig.segs.size;
            p.hecho = true;
            p.puntos += Math.max(100, 1000 - 150 * g.acabados - 100 * sobran);
            p.figuras += 1;
            g.acabados += 1;
            sonidoCorrecto();
            if (id < 900) feedbackMando(id, true);
          }
        }
        repintar();
      }),
    []
  );

  const ponerFigura = (fig) => {
    const g = juego.current;
    g.figura = fig;
    g.acabados = 0;
    for (const p of Object.values(g.jugadores)) {
      Object.assign(p, { x: fig.salida[0], y: fig.salida[1], rot: 0, lapiz: true, trazos: new Set(), hecho: false });
    }
  };

  const empezar = () => {
    const fig = catalogo.find((f) => f.id === figuraSel) || FIGURAS[0];
    if (fig.id === 'propia' && !fig.segs.size) {
      alert('Dibuja antes tu figura: pulsa entre dos puntos para poner o quitar un tramo.');
      return;
    }
    despertarAudio();
    nombres.current = leerLS(LS_NOMBRES, {});
    if (fase === 'config' && !Object.keys(juego.current.jugadores).length) juego.current.orden = 0;
    ponerFigura(fig);
    setFase('juego');
  };

  const siguienteFigura = () => {
    const i = FIGURAS.findIndex((f) => f.id === juego.current.figura.id);
    const sig = FIGURAS[(i + 1) % FIGURAS.length];
    setFiguraSel(sig.id);
    ponerFigura(sig);
    repintar();
  };

  const reiniciarJugador = (id) => {
    const p = juego.current.jugadores[id];
    if (!p || p.hecho) return;
    const fig = juego.current.figura;
    Object.assign(p, { x: fig.salida[0], y: fig.salida[1], rot: 0, lapiz: true, trazos: new Set() });
    repintar();
  };

  const toggleTramo = (k) =>
    setPropia((f) => {
      const segs = new Set(f.segs);
      if (segs.has(k)) segs.delete(k);
      else segs.add(k);
      return { ...f, segs };
    });

  const g = juego.current;
  const fig = g.figura;
  const jugadores = Object.values(g.jugadores).sort((a, b) => a.id - b.id);
  const ranking = [...jugadores].sort((a, b) => b.puntos - a.puntos);
  const progreso = (p) => {
    if (!fig.segs.size) return null;
    let bien = 0;
    p.trazos.forEach((k) => fig.segs.has(k) && bien++);
    return { pct: Math.round((100 * bien) / fig.segs.size), sobran: p.trazos.size - bien };
  };

  return (
    <div style={st.wrapper}>
      <header style={st.header}>
        <button onClick={onExit} style={st.backBtn}>
          ← Volver
        </button>
        <h2 style={st.title}>✏️ Copia el dibujo</h2>
        {fase === 'juego' && <span style={st.figuraChip}>{fig.nombre}</span>}
        <span style={{ ...st.chip, background: antena.antenaOk ? '#16a34a' : '#475569' }}>
          {antena.antenaOk ? '📡 Antena lista' : '⚪ Sin antena'}
        </span>
      </header>

      <div style={st.scroll}>
        {antena.antenaOk && antena.version < 2 && (
          <p style={st.aviso}>
            ⚠️ La antena tiene el programa antiguo: vuelve a grabar la antena y los mandos en el panel para usar el modo
            mover.
          </p>
        )}

        {fase === 'config' && (
          <div style={st.panel}>
            <p style={st.ayuda}>
              Cada alumno tiene su tablero con la figura en gris y la repasa con su tortuga, que empieza en el círculo
              verde mirando hacia arriba: <b>A</b> avanza un paso, <b>B</b> gira 90° a la derecha y <b>A + B</b> sube
              o baja el lápiz (empieza bajado). Los trazos que sobran salen en rojo y restan puntos: con el lápiz
              levantado se puede pasar sin pintar. Su tablero aparece al pulsar cualquier botón.
            </p>
            <h3 style={st.h3}>Elige la figura</h3>
            <div style={st.galeria}>
              {catalogo.map((f) => (
                <button key={f.id} onClick={() => setFiguraSel(f.id)} style={st.miniatura(figuraSel === f.id)}>
                  <Tablero figura={f} estilo={{ width: '100%', display: 'block' }} />
                  <span>{f.nombre}</span>
                </button>
              ))}
            </div>
            {figuraSel === 'propia' && (
              <div style={st.editor}>
                <div style={{ flex: '0 1 300px' }}>
                  <Tablero
                    figura={propia}
                    estilo={{ width: '100%', display: 'block' }}
                    onTramo={toggleTramo}
                    onPunto={(pt) => setPropia((f) => ({ ...f, salida: pt }))}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <p style={st.ayuda}>
                    Pulsa entre dos puntos para poner o quitar un tramo. Pulsa un punto para marcar la salida (círculo
                    verde). Se guarda en este navegador.
                  </p>
                  <button style={st.btnSec} onClick={() => setPropia((f) => ({ ...f, segs: new Set() }))}>
                    🧽 Borrar figura
                  </button>
                </div>
              </div>
            )}
            <button style={st.btnGrande} onClick={empezar}>
              Empezar ▶
            </button>
          </div>
        )}

        {fase === 'juego' && (
          <>
            <div style={{ ...st.fila, marginBottom: 12 }}>
              <button style={st.btnSec} onClick={() => setFase('config')}>
                🎨 Cambiar figura
              </button>
              {FIGURAS.some((f) => f.id === fig.id) && (
                <button style={st.btnSec} onClick={siguienteFigura}>
                  Siguiente figura ▶
                </button>
              )}
              <button
                style={st.btnSec}
                onClick={() => {
                  setFase('final');
                  sonidoFinal();
                }}
              >
                🏁 Terminar
              </button>
              <span style={{ ...st.ayuda, margin: 0 }}>
                {fig.segs.size ? `${g.acabados}/${jugadores.length} la han completado` : 'Dibujo libre'} · pulsa un
                tablero para que ese alumno vuelva a empezar
              </span>
            </div>
            {jugadores.length === 0 && (
              <p style={{ ...st.ayuda, textAlign: 'center', fontSize: 20, marginTop: 30 }}>
                Pulsad cualquier botón del mando para que aparezca vuestro tablero.
              </p>
            )}
            <div style={st.tableros}>
              {jugadores.map((p) => {
                const pr = progreso(p);
                return (
                  <div
                    key={p.id}
                    style={{ ...st.tarjeta, borderColor: p.hecho ? '#22c55e' : '#334155' }}
                    onClick={() => reiniciarJugador(p.id)}
                    title="Volver a empezar"
                  >
                    <div style={st.tarjetaCab}>
                      <span style={{ ...st.punto, background: p.color }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nombre(p.id)}
                      </span>
                      {p.hecho ? '✅' : p.lapiz ? '✏️' : '🖐️'}
                    </div>
                    <Tablero figura={fig} jugador={p} estilo={{ width: '100%', display: 'block' }} />
                    {pr && (
                      <div style={st.barra}>
                        <div style={{ ...st.barraRelleno, width: `${pr.pct}%`, background: p.color }} />
                        {pr.sobran > 0 && <span style={st.sobran}>+{pr.sobran}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {fase === 'final' && (
          <div style={st.panel}>
            <h3 style={{ ...st.h3, textAlign: 'center', fontSize: 28 }}>🏆 Clasificación</h3>
            {ranking.map((p, i) => (
              <div key={p.id} style={{ ...st.filaRank, fontSize: i < 3 ? 22 : 17 }}>
                <span style={{ width: 50 }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                <span style={{ ...st.punto, background: p.color }} />
                <span style={{ flex: 1 }}>{nombre(p.id)}</span>
                <span style={{ color: '#94a3b8', marginRight: 16 }}>{p.figuras} figuras</span>
                <b>{p.puntos}</b>
              </div>
            ))}
            <div style={{ textAlign: 'center' }}>
              <button
                style={st.btnGrande}
                onClick={() => {
                  juego.current = { jugadores: {}, orden: 0, figura: FIGURAS[0], acabados: 0 };
                  setFase('config');
                }}
              >
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
                <button style={st.miniBtn} onClick={() => simularPulsacion(id, 'MA')}>
                  ⬆ A
                </button>
                <button style={st.miniBtn} onClick={() => simularPulsacion(id, 'MB')}>
                  ↻ B
                </button>
                <button style={st.miniBtn} onClick={() => simularPulsacion(id, 'MX')}>
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
  figuraChip: { color: '#facc15', fontWeight: 800, fontSize: 16 },
  scroll: { flex: 1, overflow: 'auto', padding: '16px 16px 40px', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  panel: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 18 },
  h3: { margin: '0 0 12px', color: '#f8fafc', fontSize: 18 },
  ayuda: { color: '#94a3b8', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 },
  aviso: { color: '#fde68a', fontSize: 14, margin: '0 0 12px' },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  galeria: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 },
  miniatura: (on) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    border: `2px solid ${on ? '#facc15' : '#334155'}`,
    background: on ? 'rgba(250,204,21,0.1)' : 'rgba(15,23,42,0.6)',
    color: '#f1f5f9',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  editor: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, alignItems: 'flex-start' },
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
  tableros: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 },
  tarjeta: {
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid #334155',
    borderRadius: 14,
    padding: 8,
    cursor: 'pointer',
  },
  tarjetaCab: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, marginBottom: 6 },
  barra: { position: 'relative', height: 8, background: '#1e293b', borderRadius: 99, marginTop: 6, overflow: 'visible' },
  barraRelleno: { height: '100%', borderRadius: 99, transition: 'width .2s' },
  sobran: { position: 'absolute', right: 0, top: -18, color: '#fca5a5', fontSize: 12, fontWeight: 800 },
  filaRank: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid #334155' },
  punto: { width: 14, height: 14, borderRadius: 99, flexShrink: 0 },
};
