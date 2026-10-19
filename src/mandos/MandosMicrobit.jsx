// Panel «Mandos micro:bit» (hub de Programación y robótica): graba la antena y
// los mandos por USB (Web Serial + MicroPython), muestra las pulsaciones en
// directo, tiene mandos virtuales para probar y lanza el Quiz con mandos.
// El servicio de conexión está en ./mandosMicrobit.js (lo reutilizan los juegos).
import React, { Suspense, lazy, useEffect, useState } from 'react';
import QuizMandos from './QuizMandos';
import PistaRobotsMandos from './PistaRobotsMandos.jsx';
import DibujoMandos from './DibujoMandos.jsx';
import { BotonTutorialMandos } from './TutorialMandos.jsx';
// El partido de fútbol carga three.js: va aparte (lazy) para no engordar el panel
const FutbolMandos = lazy(() => import('../futbol3d/FutbolMandos.jsx'));
import {
  MODOS,
  VERSION_PROGRAMAS,
  setModoMandos,
  GRUPO_POR_DEFECTO,
  LETRAS,
  soportaSerial,
  programaAntena,
  programaMando,
  conectarAntena,
  desconectarAntena,
  grabarMando,
  escucharMandos,
  escucharEstadoAntena,
  simularPulsacion,
  feedbackMando,
  flashearMicropython,
} from './mandosMicrobit.js';

const LS_GRUPO = 'pikt_mandos_grupo';
const leerGrupo = () => {
  try {
    const raw = localStorage.getItem(LS_GRUPO);
    const g = Number(raw);
    return raw !== null && Number.isInteger(g) && g >= 0 && g <= 255 ? g : GRUPO_POR_DEFECTO;
  } catch {
    return GRUPO_POR_DEFECTO;
  }
};

export default function MandosMicrobit({ onExit }) {
  const [vista, setVista] = useState('panel'); // 'panel' | 'quiz'
  const [grupo, setGrupo] = useState(leerGrupo);
  const [estado, setEstado] = useState({ conectada: false, antenaOk: false, grupo: null });
  const [siguienteId, setSiguienteId] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [vistos, setVistos] = useState({}); // id → { letra, t, simulado }
  const [codigoVisible, setCodigoVisible] = useState(null); // 'antena' | 'mando'
  const [, setReloj] = useState(0);

  const log = (texto, tipo = 'info') =>
    setMensajes((prev) => [...prev.slice(-30), { texto, tipo, k: Date.now() + Math.random() }]);

  useEffect(() => escucharEstadoAntena(setEstado), []);
  useEffect(
    () =>
      escucharMandos((ev) => {
        setVistos((prev) => ({ ...prev, [ev.id]: ev }));
      }),
    []
  );
  useEffect(() => {
    const t = setInterval(() => setReloj((x) => x + 1), 1000); // refresca «hace Ns»
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_GRUPO, String(grupo));
    } catch {
      /* sin almacenamiento */
    }
  }, [grupo]);

  const tarea = async (fn) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      log('❌ ' + (e?.message || e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const antenaConGrabado = () =>
    tarea(async () => {
      log('Elige la micro:bit que hará de ANTENA…');
      const ok = await conectarAntena({ grabar: true, grupo });
      log(ok ? `✅ Antena grabada y escuchando (grupo ${grupo}).` : '⚠️ Grabada, pero no ha respondido. Pulsa reset en la placa.', ok ? 'ok' : 'error');
    });
  const antenaSinGrabar = () =>
    tarea(async () => {
      const ok = await conectarAntena({ grabar: false });
      log(
        ok
          ? '✅ Antena conectada.'
          : '⚠️ Conectada, pero esa placa no responde como antena. Usa «Grabar y conectar antena».',
        ok ? 'ok' : 'error'
      );
    });
  const grabarSiguienteMando = () =>
    tarea(async () => {
      const id = siguienteId;
      log(`Elige la micro:bit que será el MANDO ${id}…`);
      const bytes = await grabarMando(id, grupo);
      log(`✅ Mando ${id} grabado (${bytes} bytes). Desenchúfalo, ponle pilas y escribe ${id} en una pegatina.`, 'ok');
      setSiguienteId(id + 1);
    });

  const instalarMicropython = () =>
    tarea(async () => {
      log('Elige la micro:bit donde instalar MicroPython (no la desconectes hasta que acabe)…');
      let ultimo = -1;
      await flashearMicropython((pct) => {
        if (pct >= ultimo + 25) {
          ultimo = pct;
          log(`   Instalando… ${pct}%`);
        }
      });
      log('✅ MicroPython instalado. Ahora grábala como antena o como mando.', 'ok');
    });

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      log('📋 Código copiado.', 'ok');
    } catch {
      log('No se pudo copiar; selecciónalo a mano.', 'error');
    }
  };

  if (vista === 'quiz') return <QuizMandos onExit={() => setVista('panel')} />;
  if (vista === 'robots') return <PistaRobotsMandos onExit={() => setVista('panel')} />;
  if (vista === 'dibujo') return <DibujoMandos onExit={() => setVista('panel')} />;
  if (vista === 'futbol')
    return (
      <Suspense fallback={<div style={{ padding: 40, color: '#e2e8f0' }}>⚽ Preparando el estadio…</div>}>
        <FutbolMandos onExit={() => setVista('panel')} />
      </Suspense>
    );

  const modo = estado.modo || MODOS.LETRAS;
  const verValor = (v) =>
    v.tipo === 'numero' ? v.numero : v.tipo === 'texto' ? v.caracter : v.tipo === 'mover' ? { A: '⬆', B: '↻', X: '✏️' }[v.mov] : v.letra;

  const listaVistos = Object.values(vistos).sort((a, b) => a.id - b.id);
  const hace = (t) => Math.max(0, Math.round((Date.now() - t) / 1000));
  const chip = estado.antenaOk
    ? { txt: `📡 Antena lista · grupo ${estado.grupo}`, bg: '#16a34a' }
    : estado.conectada
      ? { txt: '🟡 Puerto abierto, la antena no responde', bg: '#ca8a04' }
      : { txt: '⚪ Antena sin conectar', bg: '#475569' };

  return (
    <div style={st.wrapper}>
      <header style={st.header}>
        {onExit && (
          <button onClick={onExit} style={st.backBtn}>
            ← Volver
          </button>
        )}
        <span style={{ fontSize: 24 }}>🎮</span>
        <h2 style={st.title}>Mandos micro:bit</h2>
        <span style={{ ...st.chip, background: chip.bg }}>{chip.txt}</span>
      </header>

      <div style={st.scroll}>
        <div style={{ marginBottom: 12 }}>
          <BotonTutorialMandos texto="📖 Tutorial: cómo se usa el mando en cada juego" style={{ fontSize: 16, padding: '10px 18px' }} />
        </div>
        <p style={st.intro}>
          Cada alumno tiene una micro:bit con pilas y una micro:bit «antena» conectada por USB a tu ordenador recibe
          sus pulsaciones por radio. Los mandos cambian de modo solos según el juego que abras:
        </p>
        <ul style={st.modos}>
          <li>
            <b>🔤 Letras:</b> A cambia la respuesta (A → B → C → D); se envía con <b>B</b> o <b>agitando el mando</b>.
          </li>
          <li>
            <b>🔢 Número:</b> A baja y B sube (manteniendo, cada vez más rápido); <b>agitar</b> lo envía (o A y B a la vez).
          </li>
          <li>
            <b>🔡 Abecedario:</b> A letra anterior y B la siguiente (A-Z y luego 0-9); <b>agitar</b> la envía (o A y B a la vez).
          </li>
          <li>
            <b>🤖 Mover:</b> A avanza, B gira y A + B sube o baja el lápiz.
          </li>
          <li>
            <b>⚽ Fútbol</b> (micro:bit V2): A corre, B y el logo giran, agitar tira e inclinar pasa.
          </li>
        </ul>
        {estado.antenaOk && estado.version < VERSION_PROGRAMAS && (
          <div style={st.aviso}>
            ⚠️ La antena tiene un programa antiguo. Vuelve a pulsar <b>Grabar y conectar antena</b> y graba de nuevo
            los mandos para tener todos los modos (número, abecedario y mover).
          </div>
        )}

        {!soportaSerial() && (
          <div style={st.aviso}>
            ⚠️ Este navegador no admite Web Serial. Para grabar y conectar las placas usa <b>Chrome o Edge</b> en un
            ordenador. Mientras tanto puedes probar el juego con los mandos virtuales.
          </div>
        )}

        <div style={st.grid}>
          {/* Paso 0 */}
          <section style={st.card}>
            <h3 style={st.h3}>0 · Una sola vez: MicroPython</h3>
            <p style={st.p}>
              Las placas tienen que llevar MicroPython. Si una placa no responde al grabar (por ejemplo, porque
              antes usó MakeCode), enchúfala, pulsa <b>⚡ Instalar MicroPython</b> y elígela. Tarda menos de un
              minuto.
            </p>
            <div style={{ ...st.fila, marginBottom: 12 }}>
              <button
                style={st.btn('#7c3aed')}
                disabled={ocupado || estado.conectada}
                title={estado.conectada ? 'Desconecta antes la antena' : 'Graba el firmware MicroPython por USB'}
                onClick={instalarMicropython}
              >
                ⚡ Instalar MicroPython
              </button>
            </div>
            <label style={st.label}>
              Grupo de radio (cambia si hay otra clase cerca)
              <input
                type="number"
                min={0}
                max={255}
                value={grupo}
                onChange={(e) => setGrupo(Math.max(0, Math.min(255, Number(e.target.value) || 0)))}
                style={st.input}
              />
            </label>
            <div style={st.fila}>
              <button style={st.btnSec} onClick={() => setCodigoVisible(codigoVisible === 'antena' ? null : 'antena')}>
                {'</>'} Código antena
              </button>
              <button style={st.btnSec} onClick={() => setCodigoVisible(codigoVisible === 'mando' ? null : 'mando')}>
                {'</>'} Código mando {siguienteId}
              </button>
            </div>
            {codigoVisible && (
              <div>
                <pre style={st.pre}>
                  {codigoVisible === 'antena' ? programaAntena(grupo) : programaMando(siguienteId, grupo)}
                </pre>
                <button
                  style={st.btnSec}
                  onClick={() =>
                    copiar(codigoVisible === 'antena' ? programaAntena(grupo) : programaMando(siguienteId, grupo))
                  }
                >
                  📋 Copiar
                </button>
              </div>
            )}
          </section>

          {/* Paso 1 */}
          <section style={st.card}>
            <h3 style={st.h3}>1 · Antena (USB al ordenador)</h3>
            <p style={st.p}>
              Conecta la micro:bit que se quedará en tu mesa. La primera vez pulsa <b>Grabar y conectar</b>; los
              demás días basta con <b>Conectar</b>.
            </p>
            <div style={st.fila}>
              <button style={st.btn('#0ea5e9')} disabled={ocupado} onClick={antenaConGrabado}>
                📡 Grabar y conectar antena
              </button>
              <button style={st.btnSec} disabled={ocupado} onClick={antenaSinGrabar}>
                🔌 Conectar antena
              </button>
              {estado.conectada && (
                <button style={st.btnSec} disabled={ocupado} onClick={() => tarea(desconectarAntena)}>
                  Desconectar
                </button>
              )}
            </div>
          </section>

          {/* Paso 2 */}
          <section style={st.card}>
            <h3 style={st.h3}>2 · Mandos (uno a uno por USB)</h3>
            <p style={st.p}>
              Enchufa una micro:bit, pulsa el botón y elígela en la lista (no elijas la antena). Al acabar,
              desenchúfala y sigue con la siguiente: el número sube solo.
            </p>
            <div style={st.fila}>
              <label style={{ ...st.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                Nº
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={siguienteId}
                  onChange={(e) => setSiguienteId(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                  style={{ ...st.input, width: 70 }}
                />
              </label>
              <button style={st.btn('#7c3aed')} disabled={ocupado} onClick={grabarSiguienteMando}>
                🎮 Grabar mando {siguienteId}
              </button>
            </div>
          </section>
        </div>

        {mensajes.length > 0 && (
          <div style={st.log}>
            {mensajes.map((m) => (
              <div key={m.k} style={{ color: m.tipo === 'error' ? '#fca5a5' : m.tipo === 'ok' ? '#86efac' : '#cbd5e1' }}>
                {m.texto}
              </div>
            ))}
          </div>
        )}

        {/* Paso 3: prueba */}
        <section style={{ ...st.card, marginTop: 18 }}>
          <h3 style={st.h3}>3 · Prueba los mandos</h3>
          <div style={{ ...st.fila, marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Modo de los mandos:</span>
            {[
              [MODOS.LETRAS, '🔤 Letras'],
              [MODOS.NUMERO, '🔢 Número'],
              [MODOS.TEXTO, '🔡 Abecedario'],
              [MODOS.MOVER, '🤖 Mover'],
            ].map(([m, txt]) => (
              <button key={m} style={st.modoBtn(modo === m)} onClick={() => setModoMandos(m)}>
                {txt}
              </button>
            ))}
          </div>
          {listaVistos.length === 0 ? (
            <p style={st.p}>Todavía no ha llegado ninguna pulsación.</p>
          ) : (
            <div style={st.mandosGrid}>
              {listaVistos.map((v) => (
                <div key={v.id} style={{ ...st.mandoBox, borderColor: hace(v.t) < 2 ? '#facc15' : '#334155' }}>
                  <div style={st.mandoId}>
                    {v.simulado ? '🧪' : '🎮'} {v.id}
                  </div>
                  <div style={st.mandoLetra}>{verValor(v)}</div>
                  <div style={st.mandoHace}>hace {hace(v.t)} s</div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button style={st.miniBtn} title="Carita feliz en el mando" onClick={() => feedbackMando(v.id, true)}>
                      🙂
                    </button>
                    <button style={st.miniBtn} title="Carita triste en el mando" onClick={() => feedbackMando(v.id, false)}>
                      🙁
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <div style={{ ...st.p, marginBottom: 6 }}>🧪 Mandos virtuales (para probar sin placas):</div>
            {[901, 902, 903].map((id) => (
              <div key={id} style={{ ...st.fila, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 13, width: 70 }}>Virtual {id - 900}</span>
                {modo === MODOS.NUMERO
                  ? [-1, 7, 12, 42, 100].map((n) => (
                      <button key={n} style={st.miniBtn} onClick={() => simularPulsacion(id, 'N' + n)}>
                        {n}
                      </button>
                    ))
                  : modo === MODOS.TEXTO
                    ? ['H', 'O', 'L', 'A', '7'].map((c, i) => (
                        <button key={i} style={st.miniBtn} onClick={() => simularPulsacion(id, 'T' + c)}>
                          {c}
                        </button>
                      ))
                  : modo === MODOS.MOVER
                    ? [
                        ['MA', '⬆ A'],
                        ['MB', '↻ B'],
                        ['MX', '✏️ A+B'],
                      ].map(([v, txt]) => (
                        <button key={v} style={st.miniBtn} onClick={() => simularPulsacion(id, v)}>
                          {txt}
                        </button>
                      ))
                    : LETRAS.map((l) => (
                        <button key={l} style={st.miniBtn} onClick={() => simularPulsacion(id, l)}>
                          {l}
                        </button>
                      ))}
              </div>
            ))}
          </div>
        </section>

        <div style={{ ...st.fila, justifyContent: 'center', marginTop: 22, gap: 14 }}>
          <button style={{ ...st.btn('#16a34a'), fontSize: 18, padding: '14px 28px' }} onClick={() => setVista('quiz')}>
            🏆 Quiz con mandos (letras o número)
          </button>
          <button style={{ ...st.btn('#0ea5e9'), fontSize: 18, padding: '14px 28px' }} onClick={() => setVista('robots')}>
            🤖 Pista de robots
          </button>
          <button style={{ ...st.btn('#db2777'), fontSize: 18, padding: '14px 28px' }} onClick={() => setVista('dibujo')}>
            ✏️ Copia el dibujo
          </button>
          <button style={{ ...st.btn('#15803d'), fontSize: 18, padding: '14px 28px' }} onClick={() => setVista('futbol')}>
            ⚽ Fútbol 3D con mandos
          </button>
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
  scroll: { flex: 1, overflow: 'auto', padding: '20px 16px 40px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  intro: { color: '#cbd5e1', fontSize: 15, lineHeight: 1.55, margin: '0 0 6px' },
  modos: { color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px', paddingLeft: 22 },
  modoBtn: (on) => ({
    padding: '6px 12px',
    borderRadius: 999,
    border: `1px solid ${on ? '#facc15' : '#475569'}`,
    background: on ? 'rgba(250,204,21,0.15)' : 'transparent',
    color: '#f1f5f9',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  }),
  aviso: {
    background: 'rgba(202,138,4,0.15)',
    border: '1px solid #ca8a04',
    color: '#fde68a',
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 16,
    fontSize: 14,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 },
  card: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 14, padding: '16px 16px' },
  h3: { margin: '0 0 8px', fontSize: 16, color: '#f8fafc' },
  p: { margin: '0 0 12px', fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.5 },
  link: { color: '#7dd3fc' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#94a3b8', marginBottom: 10 },
  input: {
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: 15,
    width: 90,
  },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  btn: (c) => ({
    background: c,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '9px 14px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  }),
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
  pre: {
    background: '#020617',
    color: '#a5f3fc',
    fontSize: 11.5,
    padding: 10,
    borderRadius: 8,
    maxHeight: 220,
    overflow: 'auto',
    margin: '10px 0 8px',
  },
  log: {
    marginTop: 14,
    background: '#020617',
    border: '1px solid #1e293b',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'ui-monospace, monospace',
    maxHeight: 160,
    overflow: 'auto',
    lineHeight: 1.6,
  },
  mandosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 },
  mandoBox: {
    border: '2px solid #334155',
    borderRadius: 12,
    padding: '8px 6px',
    textAlign: 'center',
    background: 'rgba(15,23,42,0.6)',
    transition: 'border-color .3s',
  },
  mandoId: { fontSize: 13, color: '#94a3b8', fontWeight: 700 },
  mandoLetra: { fontSize: 30, fontWeight: 900, color: '#facc15' },
  mandoHace: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  miniBtn: {
    minWidth: 32,
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#1e293b',
    color: '#f1f5f9',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
