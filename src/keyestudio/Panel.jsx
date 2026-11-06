// «🎛️ Panel»: todos los sensores de la casa a la vista (valor, barra, gráfica del último minuto,
// pin y nº de activaciones en los digitales) y todos los actuadores para controlarlos (Actuadores).
import React, { useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { PLACAS, sensoresDe } from './placasKit';
import { useKit, useEventosKit, fmt, estadisticos } from './useKit';
import { PanelSimulacion } from './Conectar';
import Actuadores from './Actuadores';

const SENSORES = [
  { k: 'pot', pin: 'pot', nombre: '🎚️ Potenciómetro', ud: '%', color: '#c084fc', min: 0, max: 100 },
  { k: 'mic', pin: 'mic', nombre: '🎤 Sonido', ud: '%', color: '#fb7185', min: 0, max: 100 },
  { k: 'tempLM', pin: 'lm35', nombre: '🌡️ Temperatura (LM35)', ud: '°C', color: '#fb923c', min: 0, max: 50, dec: 1 },
  { k: 'temp', pin: 'dht', nombre: '🌡️ Temperatura (DHT11)', ud: '°C', color: '#f97316', min: 0, max: 50 },
  { k: 'hum', pin: 'dht', nombre: '💧 Humedad del aire', ud: '%', color: '#38bdf8', min: 0, max: 100 },
  { k: 'luz', pin: 'luz', nombre: '🔆 Luz', ud: '%', color: '#facc15', min: 0, max: 100 },
  { k: 'vapor', pin: 'vapor', nombre: '🌧️ Vapor / lluvia', ud: '%', color: '#818cf8', min: 0, max: 100 },
  { k: 'suelo', pin: 'suelo', nombre: '🌱 Humedad del suelo', ud: '%', color: '#22c55e', min: 0, max: 100 },
  { k: 'gas', pin: 'gas', nombre: '💨 Gas', ud: '%', color: '#f43f5e', min: 0, max: 100 },
  { k: 'pir', pin: 'pir', nombre: '🚶 Movimiento (PIR)', digital: ['Nadie', '¡Movimiento!'], color: '#a3e635' },
  { k: 'boton1', pin: 'boton1', nombre: '🔘 Botón 1', digital: ['Suelto', 'Pulsado'], color: '#e879f9' },
  { k: 'boton2', pin: 'boton2', nombre: '🔘 Botón 2', digital: ['Suelto', 'Pulsado'], color: '#e879f9' },
];
const VENTANA_S = 60;

function Mini({ puntos, color, min, max, digital }) {
  if (puntos.length < 2) return <div style={{ height: 36 }} />;
  const t1 = puntos.at(-1)[0], t0 = t1 - VENTANA_S;
  const vs = puntos.map((p) => p[1]);
  const lo = digital ? 0 : Math.min(min ?? Infinity, ...vs), hi = digital ? 1 : Math.max(max ?? -Infinity, ...vs);
  const X = (t) => ((t - t0) / VENTANA_S) * 200, Y = (v) => 34 - ((v - lo) / (hi - lo || 1)) * 30;
  const d = puntos.map((p, i) => (digital && i ? `L${X(p[0]).toFixed(1)},${Y(puntos[i - 1][1]).toFixed(1)} ` : '') + `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  return <svg viewBox="0 0 200 36" style={{ width: '100%', height: 36 }} preserveAspectRatio="none" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

export default function Panel({ config }) {
  const kit = useKit();
  const hist = useRef({});
  const activ = useRef({});
  const antes = useRef({});
  const [, repintar] = useState(0);
  const ultimoRepintado = useRef(0);

  useEventosKit((ev) => {
    if (ev.tipo !== 'K') return;
    const l = ev.lectura;
    SENSORES.forEach(({ k, digital }) => {
      const v = l[k];
      if (v == null) return;
      const h = (hist.current[k] = hist.current[k] || []);
      h.push([l.t, v]);
      while (h.length && h[0][0] < l.t - VENTANA_S) h.shift();
      if (digital && v === 1 && antes.current[k] !== 1) activ.current[k] = (activ.current[k] || 0) + 1;
      antes.current[k] = v;
    });
    if (l.t - ultimoRepintado.current > 0.5) { ultimoRepintado.current = l.t; repintar((n) => n + 1); }
  });

  const placa = kit.fuente === 'placa' ? kit.placa : null;
  const pines = placa ? config.pines[placa] : null;
  const nombrePin = (S) => {
    if (!pines) return '';
    const n = pines[S.pin];
    if (S.k === 'temp' && placa === 'microbit' && n < 0) return 'interno'; // termómetro de la micro:bit
    return n === -1 || n == null ? 'no conectado' : n === -2 ? 'interno' : PLACAS[placa].esp32 ? `IO${n}` : `P${n}`;
  };

  return (
    <div style={st.dosColumnas}>
      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...st.fila, justifyContent: 'space-between' }}>
          <b style={{ fontSize: 16 }}>📟 Sensores</b>
          <span style={st.nota}>{kit.fuente === 'sim' ? '🧪 Casa simulada' : `${PLACAS[kit.placa].emoji} ${PLACAS[kit.placa].nombre}${kit.modo === 'arduino' ? ' · Arduino' : ''}`} · gráficas del último minuto</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
          {SENSORES.filter((S) => sensoresDe(kit.placa).includes(S.k)).map((S) => {
            const v = kit.lectura?.[S.k];
            const h = hist.current[S.k] || [];
            const e = !S.digital && h.length ? estadisticos(h.map((p) => p[1])) : null;
            const activo = S.digital && v === 1;
            return (
              <div key={S.k} style={{ ...st.caja, padding: 10, opacity: v == null ? 0.5 : 1, borderColor: activo ? S.color : 'rgba(255,255,255,.14)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: '#cbd5e1', fontWeight: 800 }}>{S.nombre}</span>
                  {pines && <span style={{ fontSize: 11, color: '#64748b' }}>{nombrePin(S)}</span>}
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: v == null ? '#64748b' : S.color, fontVariantNumeric: 'tabular-nums' }}>
                  {v == null ? '—' : S.digital ? S.digital[v] : `${fmt(v, S.dec || 0)} ${S.ud}`}
                </div>
                {!S.digital && v != null && (
                  <div style={{ height: 6, borderRadius: 99, background: '#1e293b', overflow: 'hidden', margin: '4px 0' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, ((v - S.min) / (S.max - S.min)) * 100))}%`, height: '100%', background: S.color }} />
                  </div>
                )}
                <Mini puntos={h} color={S.color} min={S.min} max={S.max} digital={!!S.digital} />
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  {e ? `mín ${fmt(e.min, 0)} · media ${fmt(e.media, 1)} · máx ${fmt(e.max, 0)}` : S.digital ? `${activ.current[S.k] || 0} activaciones` : v == null ? 'sin sensor' : ''}
                </div>
              </div>
            );
          })}
        </div>
        <PanelSimulacion />
      </div>
      <div style={{ ...st.lateral, maxWidth: 460 }}>
        <Actuadores />
      </div>
    </div>
  );
}
