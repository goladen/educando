// Mandos de todos los actuadores de la casa Smart Home: puerta, ventana, ventilador, LED, los 4 LED
// RGB (juntos o uno a uno), zumbador (notas y melodías) y pantalla LCD (dos líneas, borrar, luz y
// «sensor en vivo»). Lo usan el Panel (completo) y el Gemelo 3D (compacto).
import React, { useEffect, useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar, textoLCD, getSnap } from './conexionKit';
import { useKit, fmt } from './useKit';

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const deHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const COLORES = [['Apagado', [0, 0, 0]], ['Rojo', [255, 0, 0]], ['Verde', [0, 200, 0]], ['Azul', [0, 60, 255]], ['Blanco', [200, 200, 200]]];

const NOTAS = [['Do', 262], ['Re', 294], ['Mi', 330], ['Fa', 349], ['Sol', 392], ['La', 440], ['Si', 494], ['Do⁺', 523]];
const MELODIAS = {
  '🎵 Escala': [262, 294, 330, 349, 392, 440, 494, 523].map((f) => [f, 220]),
  '🚨 Sirena': Array.from({ length: 8 }, (_, i) => [i % 2 ? 660 : 880, 300]),
  '🔔 Timbre': [[660, 250], [520, 450]],
  '🎂 Cumpleaños': [[262, 300], [262, 150], [294, 450], [262, 450], [349, 450], [330, 800], [262, 300], [262, 150], [294, 450], [262, 450], [392, 450], [349, 800]],
};

// Lo que se puede poner en la línea 2 de la LCD, actualizado cada 2 s
const EN_VIVO = {
  temp: ['🌡️ Temperatura y humedad', (l) => `T:${fmt(l.temp, 0)}°C H:${fmt(l.hum, 0)}%`],
  luz: ['🔆 Luz', (l) => `Luz: ${fmt(l.luz, 0)}%`],
  vapor: ['🌧️ Lluvia', (l) => `Lluvia: ${fmt(l.vapor, 0)}%`],
  gas: ['💨 Gas', (l) => (l.gas > 40 ? '! GAS DETECTADO !' : `Gas: ${fmt(l.gas, 0)}%`)],
  pir: ['🚶 Movimiento', (l) => (l.pir ? 'Hay movimiento' : 'Sin movimiento')],
  hora: ['🕒 Hora', () => new Date().toLocaleTimeString('es-ES')],
};

export function PantallaLCD({ lineas, luz }) {
  return (
    <div style={{ display: 'inline-block', padding: 8, borderRadius: 8, background: '#1e3a8a', border: '3px solid #0f172a' }} aria-label={`Pantalla LCD: ${lineas.join(' / ')}`}>
      {lineas.map((l, f) => (
        <div key={f} style={{ display: 'flex', gap: 2, marginTop: f ? 2 : 0 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} style={{ width: 15, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 15, fontWeight: 700, background: luz ? '#3b82f6' : '#1e293b', color: luz ? '#f8fafc' : '#94a3b8', borderRadius: 1 }}>
              {(l[i] === '`' ? '°' : l[i]) || ' '}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Actuadores({ compacto = false }) {
  const kit = useKit();
  const s = kit.salidas;
  const tdr = kit.placa === 'tdr'; // un solo LED RGB (3 pines) y dos LED
  const [freq, setFreq] = useState(440);
  const [dur, setDur] = useState(300);
  const [lineas, setLineas] = useState(s.lcd);
  const [enVivo, setEnVivo] = useState('');
  const tocando = useRef([]);

  const tocar = (notas) => {
    tocando.current.forEach(clearTimeout);
    let t = 0;
    tocando.current = notas.map(([f, ms]) => { const id = setTimeout(() => enviar('pita', [f, ms * 0.9]), t); t += ms; return id; });
  };
  useEffect(() => () => tocando.current.forEach(clearTimeout), []);

  // «Sensor en vivo» en la línea 2 de la LCD
  useEffect(() => {
    if (!enVivo) return undefined;
    const pon = () => { const l = getSnap().lectura; if (l) enviar('lcd', [1, EN_VIVO[enVivo][1](l)]); };
    pon();
    const id = setInterval(pon, 2000);
    return () => clearInterval(id);
  }, [enVivo]);

  const escribir = (fila) => enviar('lcd', [fila, lineas[fila]]);
  const sinLcd = kit.fuente === 'placa' && kit.lcdDir === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={st.caja}>
        <b>🚪 Puerta, ventana y ventilador</b>
        <label style={{ ...st.label, marginTop: 8 }}>🚪 Puerta: {s.puerta}°
          <input type="range" min={0} max={180} value={s.puerta} onChange={(e) => enviar('puerta', Number(e.target.value))} />
        </label>
        <div style={st.fila}><button style={st.mini} onClick={() => enviar('puerta', 0)}>Cerrar</button><button style={st.mini} onClick={() => enviar('puerta', 90)}>Abrir (90°)</button></div>
        <label style={{ ...st.label, marginTop: 8 }}>🪟 Ventana: {s.ventana}°
          <input type="range" min={0} max={180} value={s.ventana} onChange={(e) => enviar('ventana', Number(e.target.value))} />
        </label>
        <div style={st.fila}><button style={st.mini} onClick={() => enviar('ventana', 0)}>Cerrar</button><button style={st.mini} onClick={() => enviar('ventana', 90)}>Abrir (90°)</button></div>
        <label style={{ ...st.label, marginTop: 8 }}>🌀 Ventilador: {s.vent} %
          <input type="range" min={0} max={100} step={5} value={s.vent} onChange={(e) => enviar('vent', Number(e.target.value))} />
        </label>
        <div style={st.fila}><button style={st.mini} onClick={() => enviar('vent', 0)}>Apagar</button><button style={st.mini} onClick={() => enviar('vent', 50)}>50 %</button><button style={st.mini} onClick={() => enviar('vent', 100)}>Máximo</button></div>
      </div>

      <div style={st.caja}>
        <b>💡 Luces</b>
        <div style={{ ...st.fila, marginTop: 8 }}>
          <button style={st.chip(s.led > 0)} onClick={() => enviar('led', s.led ? 0 : 1)}>💡 {tdr ? 'LED rojo' : 'LED'} {s.led ? 'encendido' : 'apagado'}</button>
          {tdr && <button style={st.chip(s.led2 > 0)} onClick={() => enviar('led2', s.led2 ? 0 : 1)}>💡 {tdr ? 'LED azul' : 'LED 2'} {s.led2 ? 'encendido' : 'apagado'}</button>}
        </div>
        <div style={{ ...st.fila, marginTop: 8 }}>
          🌈 {tdr ? 'LED RGB' : 'Los 4'}: {COLORES.map(([n, c]) => <button key={n} style={st.chip(s.rgbs.every((v) => v.join() === c.join()))} onClick={() => enviar('rgb', c)}>{n}</button>)}
          <input type="color" title="Otro color para los 4" value={hex(s.rgb)} onChange={(e) => enviar('rgb', deHex(e.target.value))} />
        </div>
        {!compacto && !tdr && (
          <div style={{ ...st.fila, marginTop: 8 }}>
            Uno a uno:
            {s.rgbs.map((c, i) => (
              <label key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5 }}>
                {i + 1}<input type="color" value={hex(c)} onChange={(e) => enviar('rgbi', [i, ...deHex(e.target.value)])} />
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={st.caja}>
        <b>🔔 Zumbador</b>
        {!compacto && (
          <>
            <label style={{ ...st.label, marginTop: 8 }}>Frecuencia: {freq} Hz
              <input type="range" min={100} max={2000} step={10} value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
            </label>
            <label style={st.label}>Duración: {dur} ms
              <input type="range" min={50} max={2000} step={50} value={dur} onChange={(e) => setDur(Number(e.target.value))} />
            </label>
            <div style={st.nota}>Periodo de la onda: T = 1/f = {fmt(1000 / freq, 2)} ms</div>
          </>
        )}
        <div style={{ ...st.fila, marginTop: 6 }}>
          <button style={st.btn('#f59e0b')} onClick={() => enviar('pita', [freq, dur])}>🔔 Pitar</button>
          {NOTAS.map(([n, f]) => <button key={n} style={st.mini} title={`${f} Hz`} onClick={() => { setFreq(f); enviar('pita', [f, 300]); }}>{n}</button>)}
        </div>
        <div style={{ ...st.fila, marginTop: 6 }}>
          {Object.entries(MELODIAS).map(([n, m]) => <button key={n} style={st.mini} onClick={() => tocar(m)}>{n}</button>)}
        </div>
        {kit.fuente === 'placa' && kit.placa === 'microbit' && <div style={st.nota}>En la micro:bit suena por su altavoz interno.</div>}
      </div>

      <div style={st.caja}>
        <b>📟 Pantalla LCD</b>
        <span style={st.nota}> {kit.fuente === 'sim' ? '(simulada)' : kit.lcdDir ? `(detectada en la dirección I2C 0x${kit.lcdDir.toString(16)})` : kit.lcdDir === 0 ? '' : '(buscando…)'}</span>
        <div style={{ marginTop: 8, overflowX: 'auto' }}><PantallaLCD lineas={s.lcd} luz={s.lcdLuz} /></div>
        {sinLcd && <div style={{ ...st.aviso, marginTop: 8 }}>No se encuentra la pantalla: conéctala a un puerto IIC de la Shield (SDA, SCL, 5V, GND) y vuelve a conectar la placa.</div>}
        {[0, 1].map((f) => (
          <div key={f} style={{ ...st.fila, marginTop: 8 }}>
            <input style={{ ...st.input, flex: '1 1 160px', fontFamily: 'ui-monospace, Consolas, monospace' }} maxLength={16} placeholder={`Línea ${f + 1} (16 letras)`}
              value={lineas[f]} disabled={f === 1 && !!enVivo}
              onChange={(e) => setLineas((ls) => ls.map((v, k) => (k === f ? e.target.value : v)))}
              onKeyDown={(e) => e.key === 'Enter' && escribir(f)} />
            <button style={st.mini} disabled={f === 1 && !!enVivo} onClick={() => escribir(f)}>Escribir</button>
            <span style={st.nota}>{textoLCD(lineas[f]).length}/16</span>
          </div>
        ))}
        <div style={{ ...st.fila, marginTop: 8 }}>
          <button style={st.mini} onClick={() => { escribir(0); escribir(1); }}>✍️ Las dos</button>
          <button style={st.mini} onClick={() => { setEnVivo(''); setLineas(['', '']); enviar('lcdBorrar'); }}>🧽 Borrar</button>
          <button style={st.chip(!!s.lcdLuz)} onClick={() => enviar('lcdLuz', s.lcdLuz ? 0 : 1)}>💡 Luz de fondo</button>
        </div>
        {!compacto && (
          <label style={{ ...st.label, marginTop: 8 }}>Línea 2 en vivo (cada 2 s)
            <select style={st.input} value={enVivo} onChange={(e) => setEnVivo(e.target.value)}>
              <option value="">— texto fijo —</option>
              {Object.entries(EN_VIVO).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </label>
        )}
        <div style={st.nota}>Sin tildes ni ñ (la pantalla no las tiene): se cambian solas. El símbolo ° sí se puede usar.</div>
      </div>
    </div>
  );
}
