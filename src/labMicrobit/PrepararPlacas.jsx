// ⚙️ Preparar placas del Laboratorio: antena (la misma de los mandos) y placas multifunción
// (mando + satélite + instrumento, programasLab.js → archivosMultifuncion). La función de cada placa
// se reparte luego por radio desde la barra «📋 Placas» (usePlacasLab).
import React, { useState } from 'react';
import {
  GRUPO_POR_DEFECTO, conectarAntena, flashearMicropython, grabarPlaca, soportaSerial, soportaUSB, ERROR_SIN_MICROPYTHON,
} from '../mandos/mandosMicrobit.js';
import { archivosMultifuncion } from './programasLab';
import { st } from './estilosLab';

const LS_GRUPO = 'pikt_mandos_grupo'; // el mismo canal que el panel de mandos

const leerGrupo = () => {
  try { const g = Number(localStorage.getItem(LS_GRUPO)); return Number.isInteger(g) && g >= 0 && g <= 255 && localStorage.getItem(LS_GRUPO) !== null ? g : GRUPO_POR_DEFECTO; } catch { return GRUPO_POR_DEFECTO; }
};

export default function PrepararPlacas() {
  const [grupo, setGrupo] = useState(leerGrupo);
  const [id, setId] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [log, setLog] = useState([]);
  const [progreso, setProgreso] = useState(null);
  const apuntar = (texto, tipo = 'info') => setLog((l) => [...l.slice(-20), { texto, tipo, k: Math.random() }]);

  const tarea = async (fn) => {
    if (ocupado) return;
    setOcupado(true);
    try { await fn(); } catch (e) {
      if (!/No se eligió/.test(e?.message || '')) apuntar('❌ ' + (e?.message || e) + (e?.code === ERROR_SIN_MICROPYTHON ? ' (botón «⚡ Instalar MicroPython»)' : ''), 'error');
    }
    setOcupado(false); setProgreso(null);
  };
  const guardarGrupo = (g) => { setGrupo(g); try { localStorage.setItem(LS_GRUPO, String(g)); } catch { /* nada */ } };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={st.caja}>
        <b>🧰 El kit del laboratorio (5 micro:bit V2)</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          <li><b>1 antena</b> enchufada por USB al ordenador: es <b>la misma de los mandos</b>. Recoge por radio lo que miden las demás.</li>
          <li><b>4 placas</b> de los mandos (con pilas): <b>3 satélites</b> para el GPS (un 4.º opcional), fijos en sitios de la sala cuyas coordenadas mides con una cinta, y <b>1 instrumento</b>, la placa que se mueve (receptor del GPS, inclinómetro, brújula, sensores o caída).</li>
        </ul>
        <div style={st.nota}>
          Cada placa lleva grabadas las tres funciones (mando, satélite e instrumento). En cada pestaña escribe arriba, en <b>📋 Placas</b>, el número
          de la placa que hará cada cosa: cambia sola por radio. Al abrir un juego con mandos vuelven solas a mando. El GPS por sonido usa el altavoz
          y el micrófono: solo funciona con <b>micro:bit V2</b>.
        </div>
      </div>

      {!soportaSerial() && <div style={st.aviso}>⚠️ Para grabar las placas hace falta <b>Chrome o Edge</b> en un ordenador. Mientras tanto puedes usar todo en modo simulación.</div>}

      <div style={st.caja}>
        <label style={{ ...st.label, maxWidth: 260 }}>Canal de radio (el mismo de la antena y los mandos)
          <input type="number" min={0} max={255} value={grupo} onChange={(e) => guardarGrupo(Math.max(0, Math.min(255, Number(e.target.value) || 0)))} style={st.input} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        <div style={st.caja}>
          <b>0 · MicroPython</b>
          <div style={st.nota}>Solo si la placa venía de MakeCode (o es nueva).</div>
          <button style={{ ...st.btn('#475569'), marginTop: 8 }} disabled={ocupado || !soportaUSB()} onClick={() => tarea(async () => {
            apuntar('⚡ Instalando MicroPython… elige la placa.');
            await flashearMicropython((p) => setProgreso(p));
            apuntar('✅ MicroPython instalado.', 'ok');
          })}>⚡ Instalar MicroPython</button>
        </div>
        <div style={st.caja}>
          <b>1 · Antena</b>
          <div style={st.nota}>Enchúfala y grábala (sirve también para los mandos). Se queda conectada.</div>
          <button style={{ ...st.btn('#0ea5e9'), marginTop: 8 }} disabled={ocupado || !soportaSerial()} onClick={() => tarea(async () => {
            apuntar('📡 Grabando la antena… elige la placa.');
            const ok = await conectarAntena({ grabar: true, grupo });
            apuntar(ok ? `✅ Antena lista (canal ${grupo}).` : '⚠️ Grabada, pero no responde: pulsa reset en la placa.', ok ? 'ok' : 'error');
          })}>📡 Grabar y conectar antena</button>
        </div>
        <div style={st.caja}>
          <b>2 · Placas (mando + satélite + instrumento)</b>
          <div style={st.nota}>Las mismas que los mandos: si ya están grabadas con la versión nueva desde el panel de mandos, no hace falta repetirlo.</div>
          <label style={{ ...st.label, marginTop: 6, maxWidth: 140 }}>Número de placa
            <input type="number" min={1} max={30} value={id} onChange={(e) => setId(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} style={st.input} />
          </label>
          <button style={{ ...st.btn('#f59e0b'), marginTop: 8 }} disabled={ocupado || !soportaSerial()} onClick={() => tarea(async () => {
            apuntar(`🔀 Grabando la placa ${id}… elige la placa (no la antena).`);
            const bytes = await grabarPlaca(archivosMultifuncion(id, grupo));
            apuntar(`✅ Placa ${id} grabada (${(bytes / 1024).toFixed(1)} KB). Escribe ${id} en una pegatina.`, 'ok');
            setId((x) => Math.min(30, x + 1));
          })}>🔀 Grabar placa {id}</button>
        </div>
      </div>

      {progreso != null && <div style={st.aviso}>Instalando… {progreso} %</div>}
      {log.length > 0 && (
        <div style={{ ...st.caja, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }}>
          {log.map((m) => <div key={m.k} style={{ color: m.tipo === 'error' ? '#fca5a5' : m.tipo === 'ok' ? '#86efac' : '#cbd5e1' }}>{m.texto}</div>)}
        </div>
      )}

      <div style={st.caja}>
        <b>🔤 Qué muestra cada placa</b>
        <div style={st.nota}>
          Al encenderse enseñan su función (M, S1…S4 o I) y su canal («C7»). Si se mantiene <b>B</b> al encenderla, se elige la función en la propia placa
          (A cambia, B guarda). Después: el satélite su número (y un rombo al pitar); el instrumento una letra según el modo:
          <b> G</b> GPS por sonido · <b>R</b> GPS por radio · <b>I</b> inclinómetro · <b>N</b> brújula · <b>S</b> sensores · <b>C</b> caída · ▫ en espera.
          Al cambiar de función por radio pita, enseña una flecha y se reinicia.
        </div>
      </div>
    </div>
  );
}
