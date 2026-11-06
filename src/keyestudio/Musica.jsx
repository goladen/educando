// «🎵 Música»: el zumbador y el potenciómetro de la placa para trabajar frecuencias.
//   · Theremin: el mando da la frecuencia f = 220 · 2^(2p) (dos octavas: función exponencial);
//     con «afinado» se redondea al semitono más cercano, f = 220 · 2^(n/12). Suena siempre o solo
//     mientras se pulsa el botón 1 (SW1), como una tecla.
//   · Escala temperada: cada semitono multiplica por 2^(1/12) ≈ 1,0595 y la octava por 2.
import React, { useEffect, useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar, getSnap } from './conexionKit';
import { useKit, fmt } from './useKit';
import { PanelSimulacion } from './Conectar';
import Grafica from './Grafica';

const NOMBRES = ['La', 'La#', 'Si', 'Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#'];
const BASE = 220; // La3
const nota = (n) => `${NOMBRES[((n % 12) + 12) % 12]}${3 + Math.floor((n + 9) / 12)}`;
const ESCALA = Array.from({ length: 13 }, (_, i) => i + 3); // de Do4 a Do5 (semitonos sobre La3)

export default function Musica() {
  const kit = useKit();
  const p = (kit.lectura?.pot ?? 0) / 100;
  const [modo, setModo] = useState('');        // '' parado · 'siempre' · 'boton'
  const [afinado, setAfinado] = useState(true);
  const n = Math.round(24 * p);
  const f = afinado ? BASE * 2 ** (n / 12) : BASE * 2 ** (2 * p);
  const fRef = useRef(f);
  fRef.current = f;

  // Mientras suena, se reenvía la nota cada 180 ms (el zumbador la mantiene 200 ms)
  useEffect(() => {
    if (!modo) return undefined;
    const id = setInterval(() => {
      if (modo === 'boton' && getSnap().lectura?.boton1 !== 1) return;
      enviar('pita', [fRef.current, 200]);
    }, 180);
    return () => clearInterval(id);
  }, [modo]);

  const curva = [{ f: (x) => BASE * 2 ** (2 * x / 100), color: '#38bdf8', nombre: 'f = 220 · 2^(2p)' }];

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={{ ...st.caja, textAlign: 'center' }}>
          <b>🎚️🎵 Theremin con el potenciómetro</b>
          <div style={{ ...st.grande, color: '#38bdf8' }}>{fmt(f, 0)} Hz</div>
          {afinado && <div style={{ fontSize: 22, fontWeight: 900 }}>{nota(n)}</div>}
          <div style={st.nota}>Periodo T = 1/f = {fmt(1000 / f, 2)} ms</div>
          <div style={{ ...st.fila, justifyContent: 'center', marginTop: 8 }}>
            <button style={st.chip(modo === 'siempre')} onClick={() => setModo(modo === 'siempre' ? '' : 'siempre')}>🔊 Sonar siempre</button>
            <button style={st.chip(modo === 'boton')} onClick={() => setModo(modo === 'boton' ? '' : 'boton')}>🔘 Solo con SW1</button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="checkbox" checked={afinado} onChange={(e) => setAfinado(e.target.checked)} /> Afinado (semitonos)
            </label>
          </div>
          <div style={st.formula}>{afinado ? `f = 220 · 2^(n/12), n = redondear(24·p) = ${n}` : `f = 220 · 2^(2p) = 220 · 2^(${fmt(2 * p, 2)})`}</div>
        </div>
        <PanelSimulacion campos={['pot', 'boton1']} />
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={st.caja}>
          <b>📈 Frecuencia según el mando</b>
          <Grafica series={[{ puntos: [[p * 100, BASE * 2 ** (2 * p)]], color: '#facc15', nombre: 'Ahora', linea: false }]} curvas={curva}
            ejeX="lectura del potenciómetro p (%)" ejeY="frecuencia (Hz)" xMin={0} xMax={100} yMin={200} yMax={900} alto={220} />
          <div style={st.nota}>No es una recta: cada vez que el mando avanza la mitad (50 %), la frecuencia se multiplica por 2 (una octava). Es una <b>función exponencial</b>, igual que el oído percibe los tonos.</div>
        </div>

        <div style={st.caja}>
          <b>🎹 La escala temperada (Do4 → Do5)</b>
          <table style={{ ...st.tabla, marginTop: 6 }}>
            <thead><tr><td style={st.td}><b>Nota</b></td><td style={st.td}><b>f (Hz)</b></td><td style={st.td}><b>f / f(Do)</b></td><td style={st.td}><b>T (ms)</b></td><td style={st.td} /></tr></thead>
            <tbody>
              {ESCALA.map((k) => {
                const fk = BASE * 2 ** (k / 12);
                return (
                  <tr key={k}>
                    <td style={st.td}>{nota(k)}</td><td style={st.td}>{fmt(fk, 1)}</td>
                    <td style={st.td}>2^({k - 3}/12) = {fmt(2 ** ((k - 3) / 12), 4)}</td><td style={st.td}>{fmt(1000 / fk, 2)}</td>
                    <td style={st.td}><button style={st.mini} onClick={() => enviar('pita', [fk, 400])}>▶️</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={st.nota}>Cada fila multiplica la anterior por 2^(1/12) ≈ 1,0595, así que tras 12 semitonos la frecuencia es justo el doble. La quinta (Sol) sale ≈ 1,498: casi el 3/2 de Pitágoras.</div>
        </div>
      </div>
    </div>
  );
}
