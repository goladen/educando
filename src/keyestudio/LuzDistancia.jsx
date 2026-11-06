// «🔆 Luz y distancia»: ¿cómo baja la luz al alejarse de la lámpara? Sobre la sala 3D del
// Laboratorio micro:bit (VistaSala) convertida en una mesa: se pone la lámpara con un clic y se
// arrastra el sensor; la distancia sale del plano (o se escribe la de la cinta métrica).
// Con los puntos se comparan tres modelos: lineal, inverso (k/d) e inverso del cuadrado (k/d²).
import React, { useMemo, useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import VistaSala from '../labMicrobit/VistaSala';
import { setSim } from './conexionKit';
import { useKit, useEventosKit, fmt, regresion, descargarCSV } from './useKit';
import Grafica from './Grafica';

const MESA = { id: 'mesa-luz', nombre: 'Mesa de luz', ancho: 1.6, largo: 1.0, alto: 0, suelo: 'madera', pared: '#f1f5f9', norte: 0, muebles: [], satelites: [] };

const MODELOS = [
  { id: 'lin', nombre: 'Lineal', formula: (a, b) => `L = ${fmt(a, 1)} ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b), 2)}·d`, tx: (d) => d, color: '#94a3b8' },
  { id: 'inv', nombre: 'Inversa', formula: (a, b) => `L = ${fmt(a, 1)} + ${fmt(b, 0)} / d`, tx: (d) => 1 / d, color: '#38bdf8' },
  { id: 'cuad', nombre: 'Inversa del cuadrado', formula: (a, b) => `L = ${fmt(a, 1)} + ${fmt(b, 0)} / d²`, tx: (d) => 1 / (d * d), color: '#facc15' },
];

const distancia = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export default function LuzDistancia() {
  const kit = useKit();
  const [lampara, setLampara] = useState({ x: 0.3, y: 0.5 });
  const [sensor, setSensor] = useState({ x: 0.8, y: 0.5 });
  const [colocando, setColocando] = useState(false);
  const [manual, setManual] = useState('');
  const [puntos, setPuntos] = useState([]); // [{ d (cm), luz (%) }]
  const ultimas = useRef([]);

  useEventosKit((ev) => {
    if (ev.tipo !== 'K' || ev.lectura.luz == null) return;
    ultimas.current = [...ultimas.current, ev.lectura.luz].slice(-8);
  });

  const dPlano = distancia(lampara, sensor) * 100; // cm
  const moverSensor = (p) => {
    setSensor(p);
    if (kit.fuente === 'sim') setSim({ distanciaLuz: distancia(lampara, p) });
  };
  const ponerLampara = (x, y) => {
    setLampara({ x, y }); setColocando(false);
    if (kit.fuente === 'sim') setSim({ distanciaLuz: distancia({ x, y }, sensor) });
  };

  const medir = () => {
    const d = manual !== '' ? Number(String(manual).replace(',', '.')) : dPlano;
    const v = ultimas.current;
    if (!(d > 0) || !v.length) return;
    setPuntos((p) => [...p, { d, luz: v.reduce((a, b) => a + b, 0) / v.length }].sort((a, b) => a.d - b.d));
  };

  const ajustes = useMemo(() => {
    if (puntos.length < 3) return [];
    return MODELOS.map((m) => {
      const r = regresion(puntos.map((p) => m.tx(p.d)), puntos.map((p) => p.luz));
      return r && { ...m, ...r };
    }).filter(Boolean);
  }, [puntos]);
  const mejor = ajustes.reduce((b, a) => (!b || a.r2 > b.r2 ? a : b), null);

  // Anillos de igual luz alrededor de la lámpara (según el mejor modelo k/d²)
  const capas = useMemo(() => {
    const c = {
      puntos: [{ x: lampara.x, y: lampara.y, color: '#facc15', texto: '💡 lámpara', grande: true }],
      lineas: [{ a: lampara, b: sensor, color: '#f8fafc', texto: `${fmt(dPlano, 1)} cm` }],
      circulos: [],
    };
    const q = ajustes.find((a) => a.id === 'cuad');
    if (q && q.b > 0) [50, 25, 10].forEach((L) => { const d = Math.sqrt(q.b / Math.max(0.1, L - q.a)) / 100; if (d > 0.02 && d < 2) c.circulos.push({ x: lampara.x, y: lampara.y, r: d, color: L === 50 ? '#fde047' : L === 25 ? '#facc15' : '#ca8a04' }); });
    return c;
  }, [lampara, sensor, dPlano, ajustes]);

  const exportar = () => descargarCSV('luz-distancia.csv', ['distancia (cm)', 'luz (%)', 'luz·d²'], puntos.map((p) => [Math.round(p.d * 10) / 10, Math.round(p.luz * 10) / 10, Math.round(p.luz * p.d * p.d)]));
  const xMax = Math.max(10, ...puntos.map((p) => p.d)) * 1.1;

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <b>🔆 ¿Cómo baja la luz al alejarte?</b>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {kit.fuente === 'sim'
              ? <li>Arrastra el <b>sensor</b> (punto morado) por la mesa: la luz simulada cambia con la distancia.</li>
              : <>
                  <li>Oscurece el aula y pon una lámpara (o la linterna del móvil) apuntando al sensor de luz.</li>
                  <li>Coloca el sensor a una distancia, mídela con la cinta y escríbela (o mueve el punto morado en la mesa).</li>
                </>}
            <li>Pulsa <b>📍 Medir</b> en 6-8 distancias distintas, de cerca a lejos.</li>
          </ol>
          <div style={{ ...st.grande, fontSize: 34, color: '#facc15', marginTop: 8 }}>{fmt(kit.lectura?.luz, 1)} %</div>
          {kit.lectura && kit.lectura.luz == null && <div style={st.aviso}>No hay sensor de luz en tu montaje. En la ESP32, conecta una fotorresistencia a un pin analógico libre y elígelo en «Conectar → ⚙️ Pines», o usa la casa simulada.</div>}
          <div style={{ ...st.fila, marginTop: 8 }}>
            <label style={st.label}>Distancia (cm)
              <input style={{ ...st.input, width: 90 }} placeholder={fmt(dPlano, 1)} value={manual} onChange={(e) => setManual(e.target.value)} />
            </label>
            <button style={st.btn('#f59e0b')} onClick={medir}>📍 Medir</button>
            <button style={st.chip(colocando)} onClick={() => setColocando((c) => !c)}>💡 {colocando ? 'Haz clic en la mesa…' : 'Mover lámpara'}</button>
          </div>
          <div style={st.nota}>Si dejas la distancia vacía se usa la del plano ({fmt(dPlano, 1)} cm). La luz es la media de los últimos 2 segundos.</div>
        </div>

        {puntos.length > 0 && (
          <div style={st.caja}>
            <div style={{ ...st.fila, justifyContent: 'space-between' }}>
              <b>📋 Tabla</b>
              <span style={st.fila}><button style={st.mini} onClick={exportar}>⬇️ CSV</button><button style={st.mini} onClick={() => setPuntos([])}>🗑️ Borrar</button></span>
            </div>
            <table style={{ ...st.tabla, marginTop: 6 }}>
              <thead><tr><td style={st.td}><b>d (cm)</b></td><td style={st.td}><b>Luz (%)</b></td><td style={st.td}><b>Luz · d²</b></td><td style={st.td} /></tr></thead>
              <tbody>
                {puntos.map((p, i) => (
                  <tr key={i}>
                    <td style={st.td}>{fmt(p.d, 1)}</td><td style={st.td}>{fmt(p.luz, 1)}</td><td style={st.td}>{fmt(p.luz * p.d * p.d, 0)}</td>
                    <td style={st.td}><button style={st.mini} onClick={() => setPuntos((ps) => ps.filter((_, k) => k !== i))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={st.nota}>Si la luz sigue la ley inversa del cuadrado, la columna <b>luz · d²</b> sale casi igual en todas las filas (salvo la luz de fondo del aula).</div>
          </div>
        )}
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <VistaSala
          sala={MESA}
          receptor={sensor}
          capas={capas}
          interaccion={{ muebles: false, satelites: false, receptor: true }}
          onMover={(clave, x, y) => clave === 'r' && moverSensor({ x, y })}
          onSoltar={(clave, x, y) => clave === 'r' && moverSensor({ x, y })}
          onClickSuelo={(x, y) => colocando && ponerLampara(x, y)}
          style={{ minHeight: 'min(42vh, 380px)' }}
        />
        <div style={st.caja}>
          <Grafica
            series={[{ puntos: puntos.map((p) => [p.d, p.luz]), color: '#f97316', nombre: 'Medidas', linea: false }]}
            curvas={ajustes.map((a) => ({ f: (d) => (d > 0.5 ? a.a + a.b * a.tx(d) : NaN), color: a.color, nombre: a.nombre }))}
            ejeX="distancia (cm)" ejeY="luz (%)" xMin={0} xMax={xMax} yMin={0}
          />
          {puntos.length < 3 && <div style={st.nota}>Con 3 medidas o más aparecen los modelos.</div>}
        </div>
        {ajustes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {ajustes.map((a) => (
              <div key={a.id} style={{ ...st.caja, borderColor: a === mejor ? a.color : 'rgba(255,255,255,.14)' }}>
                <b style={{ color: a.color }}>{a.nombre}</b> {a === mejor && '⭐ el que mejor encaja'}
                <div style={st.formula}>{a.formula(a.a, a.b)}</div>
                R² = <b>{fmt(a.r2, 3)}</b>
              </div>
            ))}
          </div>
        )}
        {mejor && <div style={st.nota}>R² mide lo bien que el modelo pasa por los puntos (1 = perfecto). La luz de una bombilla se reparte sobre una esfera de área 4πd²: por eso debería ganar la <b>inversa del cuadrado</b>. La fotorresistencia no es lineal, así que con la placa real puede salir algo distinto. ¿Por qué?</div>}
      </div>
    </div>
  );
}
