// ⏱️ Tiempo de reacción: la placa enciende el LED tras una espera al azar y mide (ella misma, al
// milisegundo) cuánto se tarda en pulsar el botón 1. Intentos, media, mejor y desviación típica,
// con un histograma para comparar en clase.
import React, { useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar } from './conexionKit';
import { useKit, useEventosKit, fmt, estadisticos, descargarCSV } from './useKit';
import { PanelSimulacion } from './Conectar';
import Grafica from './Grafica';

export default function Reaccion({ completo = false }) {
  const kit = useKit();
  const [tiempos, setTiempos] = useState([]);
  const [midiendo, setMidiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const tdr = kit.placa === 'tdr';

  useEventosKit((ev) => {
    if (ev.tipo !== 'R') return;
    setMidiendo(false);
    if (ev.ms === -1) setAviso('⚡ ¡Te has adelantado! Espera a que se encienda el LED.');
    else if (ev.ms === -2) setAviso('⏰ Se acabó el tiempo (3 s).');
    else { setAviso(''); setTiempos((t) => [...t, ev.ms]); }
  });
  const medir = () => { setAviso(''); setMidiendo(true); enviar('reac'); };
  const e = estadisticos(tiempos);

  // Histograma en tramos de 50 ms
  const tramos = {};
  tiempos.forEach((t) => { const k = Math.floor(t / 50) * 50; tramos[k] = (tramos[k] || 0) + 1; });

  return (
    <div style={st.caja}>
      <b>⏱️ Tiempo de reacción</b>
      <div style={st.nota}>Pulsa empezar y, cuando se encienda el {tdr ? 'LED rojo' : 'LED'}{kit.fuente === 'sim' ? ' (aquí abajo)' : ''}, pulsa el <b>{tdr ? 'botón SW1' : 'botón 1'}</b> lo más rápido que puedas. Lo mide la propia placa, al milisegundo.</div>
      <div style={{ ...st.fila, marginTop: 8 }}>
        <button style={st.btn(midiendo ? '#475569' : '#f59e0b')} disabled={midiendo} onClick={medir}>{midiendo ? 'Espera al LED…' : '▶️ Empezar'}</button>
        {kit.fuente === 'sim' && (
          <>
            <span style={{ ...st.punto, width: 26, height: 26, background: kit.salidas.led ? '#ef4444' : '#334155', boxShadow: kit.salidas.led ? '0 0 18px #ef4444' : 'none' }} />
            <PanelSimulacion campos={['boton1']} />
          </>
        )}
        {tiempos.length > 0 && <button style={st.mini} onClick={() => setTiempos([])}>🗑️ Borrar</button>}
        {completo && tiempos.length > 0 && <button style={st.mini} onClick={() => descargarCSV('reaccion.csv', ['intento', 'tiempo (ms)'], tiempos.map((t, i) => [i + 1, t]))}>⬇️ CSV</button>}
      </div>
      {aviso && <div style={{ ...st.aviso, marginTop: 8 }}>{aviso}</div>}
      {tiempos.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 14 }}>
          Intentos: {tiempos.map((t, i) => <b key={i} style={{ marginRight: 8 }}>{t} ms</b>)}
          {e && <div style={{ ...st.fila, marginTop: 6 }}>
            <span style={st.chip(true)}>media {fmt(e.media, 0)} ms</span>
            <span style={st.chip(false)}>mejor {e.min} ms</span>
            <span style={st.chip(false)}>desviación típica {fmt(e.desv, 0)} ms</span>
          </div>}
          {completo && tiempos.length >= 3 && (
            <div style={{ marginTop: 8 }}>
              <Grafica series={[{ puntos: Object.entries(tramos).map(([k, n]) => [Number(k) + 25, n]), color: '#f59e0b', nombre: 'Intentos por tramo de 50 ms', linea: false }]}
                ejeX="tiempo de reacción (ms)" ejeY="nº de intentos" yMin={0} alto={200} />
            </div>
          )}
          {tiempos.length >= 5 && <div style={st.nota}>Con la media y la desviación típica de toda la clase podéis comparar: ¿la mano buena es más rápida? ¿Mejora con la práctica? ¿Y si el aviso es un pitido en vez de una luz?</div>}
        </div>
      )}
      {kit.fuente === 'placa' && kit.lectura?.boton1 == null && <div style={st.aviso}>El botón 1 no está conectado en tu montaje (revisa ⚙️ Pines).</div>}
    </div>
  );
}
