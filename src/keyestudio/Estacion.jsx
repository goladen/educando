// «🌡️ Estación y gráficas»: registra los sensores cada cierto tiempo, dibuja la gráfica y calcula
// media, mínimo, máximo, rango, desviación típica y tasa de cambio (pendiente de la recta de
// regresión). Incluye el experimento de enfriamiento (ley de Newton, con y sin ventilador; en la
// Imagina TdR STEAM, abanicando), la comparación de sus dos termómetros (LM35 y DHT11), un contador
// de movimiento (PIR) por minutos y la exportación a CSV. Solo muestra los sensores de la placa elegida.
import React, { useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar } from './conexionKit';
import { useKit, useEventosKit, fmt, estadisticos, regresion, descargarCSV } from './useKit';
import { PanelSimulacion } from './Conectar';
import { sensoresDe } from './placasKit';
import Grafica from './Grafica';

const VARIABLES = [
  ['temp', '🌡️ Temperatura', '°C', '#f97316'],
  ['tempLM', '🌡️ Temperatura LM35', '°C', '#fb923c'],
  ['mic', '🎤 Sonido', '%', '#fb7185'],
  ['pot', '🎚️ Potenciómetro', '%', '#c084fc'],
  ['hum', '💧 Humedad del aire', '%', '#38bdf8'],
  ['luz', '🔆 Luz', '%', '#facc15'],
  ['vapor', '🌧️ Lluvia', '%', '#818cf8'],
  ['suelo', '🌱 Humedad del suelo', '%', '#22c55e'],
  ['gas', '💨 Gas', '%', '#f43f5e'],
];
const INTERVALOS = [[1, '1 s'], [5, '5 s'], [30, '30 s'], [60, '1 min']];

export default function Estacion() {
  const kit = useKit();
  const tdr = kit.placa === 'tdr'; // sin ventilador ni PIR, pero con dos termómetros (LM35 y DHT11)
  const vars = VARIABLES.filter(([k]) => sensoresDe(kit.placa).includes(k));
  const [grabando, setGrabando] = useState(false);
  const [intervalo, setIntervalo] = useState(1);
  const [datos, setDatos] = useState([]); // [{ s, temp, hum, … }]
  const [ver, setVer] = useState(() => (kit.placa === 'tdr' ? 'tempLM' : 'temp'));
  const [movs, setMovs] = useState([]);   // segundos en que empezó cada movimiento
  const [enfriar, setEnfriar] = useState(null); // { ambiente, conVent }
  const t0 = useRef(0), ultimo = useRef(-1e9), pirAntes = useRef(0);

  useEventosKit((ev) => {
    if (ev.tipo !== 'K' || !grabando) return;
    const l = ev.lectura;
    const s = l.t - t0.current;
    if (l.pir === 1 && pirAntes.current !== 1) setMovs((m) => [...m, s]);
    pirAntes.current = l.pir;
    if (s - ultimo.current < intervalo - 0.05) return;
    ultimo.current = s;
    setDatos((d) => [...d, { s, ...Object.fromEntries(VARIABLES.map(([k]) => [k, l[k]])) }]);
  });

  const empezar = (limpiar = true) => {
    if (limpiar) { setDatos([]); setMovs([]); }
    t0.current = (kit.lectura?.t ?? performance.now() / 1000) - (limpiar ? 0 : datos.at(-1)?.s || 0);
    ultimo.current = -1e9; pirAntes.current = kit.lectura?.pir ?? 0;
    setGrabando(true);
  };
  const parar = () => setGrabando(false);
  const [ambiente, setAmbiente] = useState('22');
  const empezarEnfriamiento = (conVent) => {
    setVer(kit.lectura?.tempLM != null ? 'tempLM' : 'temp'); // el LM35 mide en décimas: curva sin escalones
    setIntervalo(1);
    setEnfriar({ ambiente: Number(String(ambiente).replace(',', '.')) || 22, conVent });
    if (!tdr) enviar('vent', conVent ? 100 : 0); // en la TdR el «aire en movimiento» es soplar o un abanico
    empezar(true);
  };

  const [, nombre, ud, color] = VARIABLES.find((v) => v[0] === ver);
  const puntos = datos.filter((d) => d[ver] != null).map((d) => [d.s, d[ver]]);
  const usarMin = (datos.at(-1)?.s || 0) > 180;
  const ptsGraf = usarMin ? puntos.map(([x, y]) => [x / 60, y]) : puntos;
  const e = estadisticos(puntos.map((p) => p[1]));
  const rec = regresion(puntos.map((p) => p[0] / 60), puntos.map((p) => p[1]));

  // Enfriamiento: ln(T − Ta) = ln(T0 − Ta) − k·t  →  recta en (t, ln(T − Ta))
  let ajuste = null;
  if (enfriar && (ver === 'temp' || ver === 'tempLM')) {
    const Ta = enfriar.ambiente;
    const pts = puntos.filter(([, T]) => T - Ta > 0.5);
    const r = regresion(pts.map((p) => p[0]), pts.map((p) => Math.log(p[1] - Ta)));
    if (r && r.b < 0) ajuste = { k: -r.b, T0: Ta + Math.exp(r.a), r2: r.r2, Ta };
  }
  const curvas = ajuste ? [{ f: (x) => ajuste.Ta + (ajuste.T0 - ajuste.Ta) * Math.exp(-ajuste.k * (usarMin ? x * 60 : x)), color: '#e2e8f0', nombre: 'Ley de Newton ajustada' }] : rec && puntos.length > 2 ? [{ f: (x) => rec.a + rec.b * (usarMin ? x : x / 60), color: '#94a3b8', nombre: 'Recta de regresión' }] : [];

  const exportar = () => descargarCSV(`estacion-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`,
    ['tiempo (s)', ...vars.map(([, n, u]) => `${n.replace(/^\S+\s/, '')} (${u})`)],
    datos.map((d) => [Math.round(d.s * 10) / 10, ...vars.map(([k]) => (d[k] == null ? '' : Math.round(d[k] * 10) / 10))]));

  // Dos termómetros (TdR): LM35 frente a DHT11 medidos a la vez
  const pares = datos.filter((d) => d.tempLM != null && d.temp != null);
  const difs = pares.map((d) => d.tempLM - d.temp);
  const dos = difs.length ? { media: difs.reduce((a, b) => a + b, 0) / difs.length, mediaAbs: difs.reduce((a, b) => a + Math.abs(b), 0) / difs.length, max: Math.max(...difs.map(Math.abs)) } : null;
  const verDos = tdr && (ver === 'temp' || ver === 'tempLM') && pares.length > 0;

  const porMinuto = {};
  movs.forEach((s) => { const k = Math.floor(s / 60); porMinuto[k] = (porMinuto[k] || 0) + 1; });
  const durMin = Math.max(1, Math.ceil((datos.at(-1)?.s || 0) / 60));

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <b>⏺️ Registro de datos</b>
          <div style={{ ...st.fila, marginTop: 8 }}>
            Cada {INTERVALOS.map(([v, n]) => <button key={v} style={st.chip(intervalo === v)} disabled={grabando} onClick={() => setIntervalo(v)}>{n}</button>)}
          </div>
          <div style={{ ...st.fila, marginTop: 8 }}>
            {grabando
              ? <button style={st.btn('#dc2626')} onClick={parar}>⏹️ Parar</button>
              : <>
                  <button style={st.btn('#16a34a')} onClick={() => { setEnfriar(null); empezar(true); }}>⏺️ Empezar</button>
                  {datos.length > 0 && <button style={st.mini} onClick={() => empezar(false)}>▶️ Continuar</button>}
                </>}
            {datos.length > 0 && <button style={st.mini} onClick={exportar}>⬇️ CSV</button>}
          </div>
          <div style={st.nota}>{datos.length} medidas{datos.length ? ` en ${fmt(datos.at(-1).s / 60, 1)} min` : ''}. El CSV se abre en Excel o Calc para hacer más cálculos.</div>
        </div>

        <div style={st.caja}>
          <b>❄️ Experimento: ¿cómo se enfría?</b>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            <li>Calienta el sensor de temperatura (tápalo con la mano un minuto{kit.fuente === 'sim' ? ' o pulsa 🔥 en la simulación' : ''}).</li>
            <li>Escribe la temperatura del aula y pulsa empezar. Repite {tdr ? 'abanicando el sensor (con un cuaderno) todo el rato' : 'con el ventilador encendido'}.</li>
          </ol>
          <div style={{ ...st.fila, marginTop: 8 }}>
            <label style={st.label}>Temperatura del aula (°C)
              <input type="number" style={{ ...st.input, width: 80 }} value={ambiente} onChange={(e) => setAmbiente(e.target.value)} />
            </label>
            <button style={st.btn('#0ea5e9')} disabled={grabando} onClick={() => empezarEnfriamiento(false)}>❄️ {tdr ? 'Aire quieto' : 'Sin ventilador'}</button>
            <button style={st.btn('#7c3aed')} disabled={grabando} onClick={() => empezarEnfriamiento(true)}>{tdr ? '📓 Abanicando' : '🌀 Con ventilador'}</button>
          </div>
          {enfriar && (
            <div style={{ marginTop: 8, fontSize: 13.5 }}>
              <div style={st.formula}>T(t) = Tₐ + (T₀ − Tₐ) · e<sup>−k·t</sup></div>
              {ajuste
                ? <>Tₐ = {fmt(ajuste.Ta, 1)} °C · T₀ ≈ {fmt(ajuste.T0, 1)} °C · <b>k ≈ {fmt(ajuste.k * 60, 3)} min⁻¹</b>
                    <br />Tarda ≈ <b>{fmt(Math.log(2) / ajuste.k / 60, 1)} min</b> en reducir a la mitad la diferencia con el aula (R² = {fmt(ajuste.r2, 3)}).
                    <div style={st.nota}>{enfriar.conVent ? (tdr ? 'Abanicando' : 'Con ventilador') : (tdr ? 'Aire quieto' : 'Sin ventilador')}. Apunta k y compáralo con la otra prueba: ¿cuántas veces más rápido enfría el aire en movimiento?</div></>
                : <span style={st.nota}>Esperando datos por encima de la temperatura del aula…</span>}
              {kit.fuente === 'placa' && ver === 'temp' && <div style={st.nota}>El DHT11 mide en grados enteros: la curva sale «a escalones». Deja al menos 5 minutos para un buen ajuste.</div>}
            </div>
          )}
        </div>

        {tdr && (
          <div style={st.caja}>
            <b>🌡️🌡️ Dos termómetros: LM35 y DHT11</b>
            <div style={st.nota}>La placa tiene dos sensores de temperatura. Graba unos minutos y compara: ¿marcan lo mismo? ¿Cuál reacciona antes al calentarlo con la mano?</div>
            {dos ? (
              <div style={{ marginTop: 6, fontSize: 13.5 }}>
                Diferencia media (LM35 − DHT11): <b>{dos.media >= 0 ? '+' : ''}{fmt(dos.media, 2)} °C</b><br />
                Error medio absoluto: <b>{fmt(dos.mediaAbs, 2)} °C</b> · diferencia máxima: <b>{fmt(dos.max, 1)} °C</b>
                <div style={st.nota}>El DHT11 tiene una precisión de ±2 °C y mide en grados enteros; el LM35, de ±0,5 °C y en décimas. Si la diferencia media es casi constante, es un error sistemático: ¿cómo lo corregirías?</div>
              </div>
            ) : <div style={st.nota}>Pulsa ⏺️ Empezar para tener datos de los dos.</div>}
          </div>
        )}
        {sensoresDe(kit.placa).includes('pir') && (
          <div style={st.caja}>
            <b>🚶 Contador de movimiento</b>
            <div style={st.nota}>Mientras se graba, cuenta las veces que el PIR detecta a alguien.</div>
            {kit.lectura?.pir == null ? <div style={st.nota}>El sensor PIR no está conectado.</div> : (
              <table style={{ ...st.tabla, marginTop: 6 }}>
                <thead><tr><td style={st.td}><b>Minuto</b></td><td style={st.td}><b>Movimientos</b></td></tr></thead>
                <tbody>
                  {Array.from({ length: Math.min(durMin, 30) }, (_, i) => <tr key={i}><td style={st.td}>{i + 1}.º</td><td style={st.td}>{porMinuto[i] || 0}</td></tr>)}
                  <tr><td style={st.td}><b>Media</b></td><td style={st.td}><b>{fmt(movs.length / durMin, 2)}</b> por minuto</td></tr>
                </tbody>
              </table>
            )}
          </div>
        )}
        <PanelSimulacion campos={tdr ? ['calentar', 'mic', 'pot'] : ['gas', 'vapor', 'suelo', 'pir', 'calentar']} />
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={st.fila}>
          {vars.map(([k, n, , c]) => (
            <button key={k} style={{ ...st.chip(ver === k), borderColor: ver === k ? c : '#475569' }} onClick={() => setVer(k)}>{n}</button>
          ))}
        </div>
        <div style={st.caja}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 16 }}>{nombre}</b>
            <span style={{ ...st.grande, fontSize: 32, color }}>{fmt(kit.lectura?.[ver], 0)} {ud}</span>
            {grabando && <span style={{ color: '#fca5a5', fontWeight: 800 }}>● grabando</span>}
          </div>
          <Grafica series={[{ puntos: ptsGraf, color, nombre }, ...(verDos ? (() => {
            const [k2, n2, , c2] = VARIABLES.find((x) => x[0] === (ver === 'temp' ? 'tempLM' : 'temp'));
            return [{ puntos: datos.filter((d) => d[k2] != null).map((d) => [usarMin ? d.s / 60 : d.s, d[k2]]), color: c2, nombre: n2 }];
          })() : [])]} curvas={curvas} ejeX={usarMin ? 'tiempo (min)' : 'tiempo (s)'} ejeY={`${nombre.replace(/^\S+\s/, '')} (${ud})`} />
          {kit.lectura && kit.lectura[ver] == null && <div style={st.aviso}>Este sensor no está conectado en tu montaje (revisa ⚙️ Pines en «Conectar»).</div>}
        </div>
        {e && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
            {[['Media', e.media], ['Mínimo', e.min], ['Máximo', e.max], ['Rango', e.max - e.min], ['Desviación típica', e.desv]].map(([n, v]) => (
              <div key={n} style={{ ...st.caja, padding: 8 }}><div style={st.nota}>{n}</div><b style={{ fontSize: 18 }}>{fmt(v, 2)} {ud}</b></div>
            ))}
            {rec && <div style={{ ...st.caja, padding: 8 }}><div style={st.nota}>Tasa de cambio</div><b style={{ fontSize: 18 }}>{rec.b >= 0 ? '+' : ''}{fmt(rec.b, 2)} {ud}/min</b></div>}
          </div>
        )}
        {rec && puntos.length > 2 && !ajuste && (
          <div style={st.nota}>Recta de regresión: <span style={st.formula}>y = {fmt(rec.a, 2)} {rec.b >= 0 ? '+' : '−'} {fmt(Math.abs(rec.b), 3)}·t</span> (t en minutos, R² = {fmt(rec.r2, 3)}). La pendiente es la tasa de cambio media.</div>
        )}
      </div>
    </div>
  );
}
