// ⏱️ Cronómetro de clase: cada alumno tiene una micro:bit (modo CR de programasLab.js). A arranca, B para
// y envía el tiempo (I:W:<id>:<n>:<ms>, 3 veces: se descartan los repetidos). En pantalla: cada tiempo con
// su desviación y su error respecto a la media, y media, mediana, desviación típica y rango de todos.
import React, { useMemo, useState } from 'react';
import { useInstrumentos, useTodasInstrumento } from './useInstrumentos';
import { fmt } from './trilateracion';
import { st } from './estilosLab';

const LS_NOMBRES = 'pikt_lab_crono_nombres';
const leerNombres = () => { try { return JSON.parse(localStorage.getItem(LS_NOMBRES)) || {}; } catch { return {}; } };
const seg = (ms) => fmt(ms / 1000, 2);

/** Estadística de una lista de tiempos (ms). */
export function estadistica(xs) {
  const n = xs.length;
  if (!n) return null;
  const orden = [...xs].sort((a, b) => a - b);
  const media = xs.reduce((a, b) => a + b, 0) / n;
  const mediana = n % 2 ? orden[(n - 1) / 2] : (orden[n / 2 - 1] + orden[n / 2]) / 2;
  const sc = xs.reduce((a, x) => a + (x - media) ** 2, 0);
  return {
    n, media, mediana, min: orden[0], max: orden[n - 1], rango: orden[n - 1] - orden[0],
    sigma: Math.sqrt(sc / n), s: n > 1 ? Math.sqrt(sc / (n - 1)) : null,
    dm: xs.reduce((a, x) => a + Math.abs(x - media), 0) / n, // desviación media (error absoluto medio)
  };
}

export default function Cronometro({ radio, excluir }) {
  const [fuente, setFuente] = useState(radio ? 'placa' : 'sim');
  const [medidas, setMedidas] = useState([]); // { clave, id, n, ms, t, fuera }
  const [cuenta, setCuenta] = useState('todos'); // 'todos' | 'ultimo' (el último tiempo de cada placa)
  const [nombres, setNombresState] = useState(leerNombres);
  const [simReal, setSimReal] = useState(10);
  const placa = fuente === 'placa' && radio;
  const vistas = useTodasInstrumento(placa, 'CR', excluir);
  const conectadas = Object.keys(vistas).filter((id) => Date.now() - vistas[id].t < 30000).length;

  const setNombre = (id, v) => setNombresState((o) => {
    const n = { ...o, [id]: v.slice(0, 24) };
    try { localStorage.setItem(LS_NOMBRES, JSON.stringify(n)); } catch { /* nada */ }
    return n;
  });

  // La placa envía cada tiempo 3 veces: mismo id y número en menos de 3 s = repetido
  useInstrumentos((ev) => {
    if (!placa || ev.tipo !== 'W' || !(ev.ms > 0)) return;
    setMedidas((l) => {
      if (l.some((m) => m.id === ev.id && m.n === ev.n && Math.abs(m.t - ev.t) < 3000)) return l;
      return [...l, { clave: `${ev.id}-${ev.n}-${ev.t}`, id: ev.id, n: ev.n, ms: ev.ms, t: ev.t, fuera: false }];
    });
  });

  const simular = (k) => {
    const ahora = Date.now();
    setMedidas((l) => {
      const out = [...l];
      for (let i = 0; i < k; i++) {
        const id = 1 + Math.floor(Math.random() * 25);
        // Normal (Box-Muller) con un pequeño sesgo por persona; de vez en cuando alguien se despista
        const z = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
        let ms = simReal * 1000 + z * 220 + 180 + (id % 5) * 25;
        if (Math.random() < 0.06) ms += 600 + Math.random() * 1200;
        const n = out.filter((m) => m.id === id).length + 1;
        out.push({ clave: `s${id}-${n}-${ahora + i}`, id, n, ms: Math.round(ms), t: ahora + i, fuera: false });
      }
      return out;
    });
  };

  const cuentan = useMemo(() => {
    const val = medidas.filter((m) => !m.fuera);
    if (cuenta === 'todos') return val;
    const ult = {};
    val.forEach((m) => { if (!ult[m.id] || m.t > ult[m.id].t) ult[m.id] = m; });
    return Object.values(ult);
  }, [medidas, cuenta]);
  const enCuenta = new Set(cuentan.map((m) => m.clave));
  const E = estadistica(cuentan.map((m) => m.ms));
  const alternar = (clave) => setMedidas((l) => l.map((m) => (m.clave === clave ? { ...m, fuera: !m.fuera } : m)));
  const nombreDe = (id) => nombres[id] || `Placa ${id}`;

  const csv = () => {
    const f = (ms) => String(Math.round(ms) / 1000).replace('.', ',');
    const filas = ['Placa;Nombre;Medida;Tiempo (s);Cuenta;Desviación (s);Error absoluto (s);Error relativo (%)',
      ...medidas.map((m) => {
        const c = enCuenta.has(m.clave) && E;
        const d = E ? m.ms - E.media : 0;
        return [m.id, nombreDe(m.id), m.n, f(m.ms), c ? 'sí' : 'no', E ? f(d) : '', E ? f(Math.abs(d)) : '',
          E ? String(Math.round((Math.abs(d) / E.media) * 1000) / 10).replace('.', ',') : ''].join(';');
      })];
    if (E) filas.push('', `Media;${f(E.media)}`, `Mediana;${f(E.mediana)}`, `Desviación típica;${f(E.sigma)}`, `Rango;${f(E.rango)}`, `Desviación media;${f(E.dm)}`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + filas.join('\n')], { type: 'text/csv' }));
    a.download = 'cronometro-microbit.csv'; a.click();
  };

  // Gráfica de puntos: cada tiempo, la media, la mediana y la franja media ± σ
  const W = 640, H = 120;
  const todos = medidas.map((m) => m.ms);
  const lo = todos.length ? Math.min(...todos) : 0, hi = todos.length ? Math.max(...todos) : 1;
  const pad = Math.max(100, (hi - lo) * 0.08);
  const X = (ms) => 20 + ((ms - (lo - pad)) / (hi - lo + 2 * pad)) * (W - 40);
  const apilado = {};
  const errMax = E ? Math.max(...cuentan.map((m) => Math.abs(m.ms - E.media))) : 0;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={st.caja}>
        <div style={st.fila}>
          <button style={st.chip(fuente === 'placa')} disabled={!radio} onClick={() => setFuente('placa')}>📡 Con las micro:bit</button>
          <button style={st.chip(fuente === 'sim')} onClick={() => setFuente('sim')}>🧪 Simulación</button>
        </div>
        {!radio && <div style={st.nota}>Conecta la antena (arriba) para usar las placas.</div>}
        {fuente === 'placa' && (
          <div style={st.nota}>
            Cada alumno con su micro:bit: <b>A</b> arranca el cronómetro (el reloj gira) y <b>B</b> lo para y envía el tiempo, que aparece aquí y en su placa.
            Pulsar A con el reloj en marcha vuelve a empezar. Placas conectadas: {conectadas || '—'}
          </div>
        )}
        {fuente === 'sim' && (
          <div style={{ ...st.fila, marginTop: 8 }}>
            🧪 Tiempo real <input type="number" min={1} max={120} value={simReal} onChange={(e) => setSimReal(Math.max(1, Math.min(120, Number(e.target.value) || 10)))} style={{ ...st.input, width: 64 }} /> s ·
            medir: {[1, 10, 25].map((k) => <button key={k} style={st.btn('#0ea5e9')} onClick={() => simular(k)}>{k}</button>)}
          </div>
        )}
        <div style={st.nota}>
          💡 Ideas: medir lo que tarda en caer una pelota, una vuelta al patio, el periodo de un péndulo (10 oscilaciones), cuánto dura una canción,
          o «parad cuando creáis que han pasado 10 s» (estimación del tiempo).
        </div>
      </div>

      <div style={st.caja}>
        <div style={{ ...st.fila, justifyContent: 'space-between' }}>
          <span>Cuentan: <button style={st.chip(cuenta === 'todos')} onClick={() => setCuenta('todos')}>todos los tiempos</button>{' '}
            <button style={st.chip(cuenta === 'ultimo')} onClick={() => setCuenta('ultimo')}>solo el último de cada placa</button></span>
          <span style={st.fila}>
            <button style={st.mini} disabled={!medidas.length} onClick={csv}>⬇️ CSV</button>
            <button style={st.mini} disabled={!medidas.length} onClick={() => { if (window.confirm('¿Borrar todos los tiempos?')) setMedidas([]); }}>↺ Borrar</button>
          </span>
        </div>
        {E ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 10 }}>
            {[
              ['Media', seg(E.media) + ' s', 'x̄ = suma ÷ n', '#38bdf8'],
              ['Mediana', seg(E.mediana) + ' s', 'el valor del centro', '#a3e635'],
              ['Desv. típica σ', seg(E.sigma) + ' s', E.s != null ? `muestral s = ${seg(E.s)} s` : 'dispersión', '#f472b6'],
              ['Rango', seg(E.rango) + ' s', `de ${seg(E.min)} a ${seg(E.max)} s`, '#facc15'],
              ['Desv. media', seg(E.dm) + ' s', 'error absoluto medio', '#c084fc'],
              ['Medidas', String(E.n), medidas.length > E.n ? `${medidas.length - E.n} sin contar` : 'tiempos', '#cbd5e1'],
            ].map(([t, v, sub, c]) => (
              <div key={t} style={{ ...st.caja, padding: 10 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>{t}</div>
                <div style={{ ...st.grande, fontSize: 'clamp(22px, 3.4vw, 34px)', color: c }}>{v}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{sub}</div>
              </div>
            ))}
          </div>
        ) : <div style={st.nota}>Aún no hay tiempos.</div>}

        {medidas.length > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 10, background: 'rgba(0,0,0,.25)', borderRadius: 10 }} role="img" aria-label="Cada tiempo medido, con la media, la mediana y la franja de una desviación típica">
            {E && <rect x={X(E.media - E.sigma)} width={Math.max(1, X(E.media + E.sigma) - X(E.media - E.sigma))} y={8} height={H - 34} fill="rgba(244,114,182,.13)" />}
            <line x1={20} x2={W - 20} y1={H - 26} y2={H - 26} stroke="#475569" />
            {medidas.map((m) => {
              const k = Math.round(X(m.ms) / 9);
              apilado[k] = (apilado[k] || 0) + 1;
              const on = enCuenta.has(m.clave);
              return <circle key={m.clave} cx={X(m.ms)} cy={H - 26 - apilado[k] * 9} r={4} fill={on ? '#38bdf8' : 'none'} stroke={on ? '#38bdf8' : '#64748b'}><title>{nombreDe(m.id)}: {seg(m.ms)} s</title></circle>;
            })}
            {E && <line x1={X(E.media)} x2={X(E.media)} y1={6} y2={H - 26} stroke="#38bdf8" strokeWidth="2" />}
            {E && <line x1={X(E.mediana)} x2={X(E.mediana)} y1={6} y2={H - 26} stroke="#a3e635" strokeWidth="2" strokeDasharray="4 3" />}
            <text x={20} y={H - 8} fill="#94a3b8" fontSize="11">{seg(lo)} s</text>
            <text x={W - 20} y={H - 8} fill="#94a3b8" fontSize="11" textAnchor="end">{seg(hi)} s</text>
          </svg>
        )}
        {medidas.length > 0 && (
          <div style={st.nota}>
            <span style={{ color: '#38bdf8' }}>━</span> media · <span style={{ color: '#a3e635' }}>┅</span> mediana · <span style={{ color: '#f472b6' }}>▮</span> media ± σ (ahí suelen caer unos 2 de cada 3 tiempos).
            Si alguien se despista mucho, la media se mueve hacia él y la mediana casi no: quita ese tiempo con ✕ y mira qué cambia.
          </div>
        )}
      </div>

      {medidas.length > 0 && (
        <div style={{ ...st.caja, overflowX: 'auto' }}>
          <b>Tiempo de cada uno y su error respecto a la media</b>
          <table style={{ ...st.tabla, marginTop: 6 }}>
            <thead>
              <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                <th style={st.td}>Alumno</th><th style={st.td}>Nº</th><th style={st.td}>Tiempo</th>
                <th style={st.td} title="tiempo − media">Desviación</th><th style={st.td} title="|tiempo − media|">Error absoluto</th>
                <th style={st.td} title="error absoluto ÷ media">Error relativo</th><th style={st.td} />
              </tr>
            </thead>
            <tbody>
              {[...medidas].sort((a, b) => a.id - b.id || a.n - b.n).map((m) => {
                const on = enCuenta.has(m.clave);
                const d = E ? m.ms - E.media : 0;
                const peor = on && E && E.n > 2 && Math.abs(d) === errMax;
                return (
                  <tr key={m.clave} style={{ opacity: on ? 1 : 0.45 }}>
                    <td style={st.td}>
                      <input value={nombres[m.id] || ''} placeholder={`Placa ${m.id}`} onChange={(e) => setNombre(m.id, e.target.value)} style={{ ...st.input, width: 120, padding: '3px 6px', fontSize: 13 }} />
                    </td>
                    <td style={st.td}>{m.n}</td>
                    <td style={{ ...st.td, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{seg(m.ms)} s</td>
                    <td style={{ ...st.td, color: d > 0 ? '#fca5a5' : '#86efac', fontVariantNumeric: 'tabular-nums' }}>{E ? (d > 0 ? '+' : '') + seg(d) + ' s' : '—'}</td>
                    <td style={{ ...st.td, fontVariantNumeric: 'tabular-nums', color: peor ? '#facc15' : undefined }}>{E ? seg(Math.abs(d)) + ' s' : '—'}{peor ? ' ⚠️' : ''}</td>
                    <td style={{ ...st.td, fontVariantNumeric: 'tabular-nums' }}>{E ? fmt((Math.abs(d) / E.media) * 100, 1) + ' %' : '—'}</td>
                    <td style={st.td}>
                      <button style={st.mini} onClick={() => alternar(m.clave)} title={m.fuera ? 'Volver a contar este tiempo' : 'No contar este tiempo (p. ej. un despiste)'}>{m.fuera ? '↺' : '✕'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={st.nota}>
            <b>Desviación</b> = tiempo − media (+ si tardó más que la media, − si menos) · <b>error absoluto</b> = |tiempo − media| ·
            <b> error relativo</b> = error absoluto ÷ media × 100. Los tiempos en gris no cuentan para la media
            {cuenta === 'ultimo' ? ' (ahora solo cuenta el último de cada placa)' : ''}.
          </div>
        </div>
      )}
    </div>
  );
}
