// «🔌 Conectar»: elegir casa simulada o placa real (ESP32 / micro:bit), instalar MicroPython,
// revisar los pines y ver las lecturas en vivo. También exporta PanelSimulacion y Lecturas,
// que reutilizan las demás pestañas.
import React, { useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { PLACAS, NOMBRES_PIN, ENTRADAS_ANALOGICAS, guardarConfig, sensoresDe } from './placasKit';
import {
  conectarPlaca, desconectar, volverASimulacion, getSim, setSim, soportaSerial,
  instalarMicropythonEsp32, instalarMicropythonMicrobit, elegirPlacaKit,
} from './conexionKit';
import { useKit, fmt } from './useKit';

const SENSORES = [
  ['temp', '🌡️ Temperatura', '°C', 0],
  ['hum', '💧 Humedad del aire', '%', 0],
  ['luz', '🔆 Luz', '%', 0],
  ['vapor', '🌧️ Vapor / lluvia', '%', 0],
  ['suelo', '🌱 Humedad del suelo', '%', 0],
  ['gas', '💨 Gas', '%', 0],
  ['pir', '🚶 Movimiento', '', -1],
  ['boton1', '🔘 Botón 1', '', -1],
  ['boton2', '🔘 Botón 2', '', -1],
  ['pot', '🎚️ Potenciómetro', '%', 0],
  ['mic', '🎤 Sonido', '%', 0],
  ['tempLM', '🌡️ Temperatura LM35', '°C', 1],
];

export function Lecturas({ compacto = false }) {
  const { lectura, placa } = useKit();
  const suyos = sensoresDe(placa);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${compacto ? 120 : 150}px, 1fr))`, gap: 6 }}>
      {SENSORES.filter(([k]) => suyos.includes(k)).sort((a, b) => suyos.indexOf(a[0]) - suyos.indexOf(b[0])).map(([k, nombre, ud, dec]) => {
        const v = lectura?.[k];
        const txt = v == null ? '—' : dec < 0 ? (v ? 'Sí' : 'No') : `${fmt(v, dec)} ${ud}`;
        return (
          <div key={k} style={{ ...st.caja, padding: 8, opacity: v == null ? 0.55 : 1 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>{nombre}</div>
            <div style={{ fontSize: compacto ? 18 : 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{txt}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Sliders de los sensores de la casa simulada (solo se ve en modo simulación). */
export function PanelSimulacion({ campos: pedidos }) {
  const { fuente, placa } = useKit();
  if (fuente !== 'sim') return null;
  const campos = pedidos || (placa === 'tdr' ? ['pot', 'mic', 'boton1', 'calentar'] : ['gas', 'vapor', 'suelo', 'pir', 'boton1', 'calentar']);
  const s = getSim();
  const slider = (k, nombre) => (
    <label key={k} style={st.label}>{nombre}: {Math.round(s[k])} %
      <input type="range" min={0} max={100} value={s[k]} onChange={(e) => setSim({ [k]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div style={{ ...st.caja, borderColor: 'rgba(56,189,248,.5)' }}>
      <b>🧪 Casa simulada</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {campos.includes('pot') && slider('pot', '🎚️ Potenciómetro')}
        {campos.includes('mic') && slider('mic', '🎤 Ruido en el aula')}
        {campos.includes('gas') && slider('gas', '💨 Gas en el aire')}
        {campos.includes('vapor') && slider('vapor', '🌧️ Agua en el sensor de lluvia')}
        {campos.includes('suelo') && slider('suelo', '🌱 Humedad de la tierra')}
        <div style={st.fila}>
          {campos.includes('pir') && (
            <button style={st.chip(!!s.pir)} onPointerDown={() => setSim({ pir: 1 })} onPointerUp={() => setSim({ pir: 0 })} onPointerLeave={() => s.pir && setSim({ pir: 0 })}>🚶 Pasar delante (mantén)</button>
          )}
          {campos.includes('boton1') && (
            <button style={st.chip(!!s.boton1)} onPointerDown={() => setSim({ boton1: 1 })} onPointerUp={() => setSim({ boton1: 0 })} onPointerLeave={() => s.boton1 && setSim({ boton1: 0 })}>🔘 Botón 1</button>
          )}
          {campos.includes('calentar') && <button style={st.mini} onClick={() => setSim({ calentar: true })}>🔥 Calentar el sensor (mano encima)</button>}
        </div>
      </div>
    </div>
  );
}

export default function Conectar({ config, setConfig }) {
  const kit = useKit();
  const [placa, setPlaca] = useState(config.placa);
  const [conPlaca, setConPlaca] = useState(kit.fuente === 'placa'); // ha elegido trabajar con una placa
  const [verPines, setVerPines] = useState(false);
  const [instalando, setInstalando] = useState(null); // { pct, log }
  const [error, setError] = useState('');
  const pines = config.pines[placa];
  const conectada = kit.fuente === 'placa' && kit.estado === 'conectada';

  const elegirPlaca = (id) => { setPlaca(id); setConPlaca(true); elegirPlacaKit(id); const c = { ...config, placa: id }; setConfig(c); guardarConfig(c); };
  const cambiarPin = (k, v) => {
    const c = { ...config, pines: { ...config.pines, [placa]: { ...pines, [k]: Number(v) } } };
    setConfig(c); guardarConfig(c);
  };
  const conectar = async (elegirOtra = false) => {
    setError('');
    try { await conectarPlaca({ placa, pines, elegirOtra }); } catch (e) { setError(e.message); }
  };
  const instalar = async () => {
    setError('');
    setInstalando({ pct: 0, log: [] });
    const log = (t) => setInstalando((s) => ({ ...s, log: [...(s?.log || []), String(t).trim()].filter(Boolean).slice(-6) }));
    try {
      if (PLACAS[placa].esp32) await instalarMicropythonEsp32((pct) => setInstalando((s) => ({ ...s, pct })), log);
      else { log('Elige la micro:bit en la ventana de Chrome…'); await instalarMicropythonMicrobit((pct) => setInstalando((s) => ({ ...s, pct }))); log('¡Listo! MicroPython instalado.'); }
      setInstalando((s) => ({ ...s, pct: 100, fin: true }));
      // MicroPython tarda unos segundos en arrancar la primera vez (crea su sistema de archivos)
      log('Arrancando MicroPython y conectando…');
      await new Promise((r) => setTimeout(r, 4000));
      await conectar(false);
    } catch (e) { setError(e.message); setInstalando(null); }
  };

  const sinMicropython = kit.estado === 'error' && /MicroPython/.test(kit.mensaje);

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <b>1. ¿Con qué trabajas?</b>
          <div style={{ ...st.fila, marginTop: 8 }}>
            <button style={st.chip(!conPlaca)} onClick={() => { setError(''); setConPlaca(false); volverASimulacion(); }}>🧪 Casa simulada</button>
            {Object.values(PLACAS).map((p) => (
              <button key={p.id} style={st.chip(conPlaca && placa === p.id)} onClick={() => elegirPlaca(p.id)}>{p.emoji} {p.nombre}</button>
            ))}
          </div>
          <div style={st.nota}>La simulación funciona sin placa: sirve para preparar la clase y para casa.</div>
        </div>

        {conPlaca && <div style={st.caja}>
          <b>2. Conecta la placa: {PLACAS[placa].emoji} {PLACAS[placa].nombre}</b>
          {!soportaSerial() && <div style={{ ...st.aviso, marginTop: 8 }}>Este navegador no puede usar el USB. Abre PiKT en <b>Chrome o Edge</b> en un ordenador.</div>}
          <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5 }}>
            {PLACAS[placa].esp32
              ? <li>Si el ordenador no la ve, instala el <a href="/guia-pikt-es.html#keyestudio" target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>driver CP210x</a>.</li>
              : <li>Pincha la micro:bit V2 en la Shield y conéctala por USB.</li>}
            {placa === 'tdr' && <li>Pon el <b>interruptor de Bluetooth hacia el borde</b> de la placa (si no, el USB no se comunica).</li>}
            <li>La primera vez (o si venía de {PLACAS[placa].esp32 ? 'ArduinoBlocks/KidsBlock' : 'MakeCode'}), pulsa <b>⚡ Instalar MicroPython</b>{placa === 'tdr' && <> con el <b>potenciómetro girado a cero</b> (la flecha al punto rojo): está en IO2 y, si no, la placa no entra en modo de programación</>}.</li>
            <li>Pulsa <b>🔌 Conectar</b> y elige la placa.</li>
          </ol>
          <div style={{ ...st.fila, marginTop: 10 }}>
            {conectada
              ? <button style={st.btn('#dc2626')} onClick={() => desconectar().then(volverASimulacion)}>⏏️ Desconectar</button>
              : <button style={st.btn('#16a34a')} disabled={kit.estado === 'conectando' || !!instalando && !instalando.fin} onClick={() => conectar(false)}>🔌 Conectar</button>}
            <button style={st.btn(sinMicropython ? '#f59e0b' : '#475569')} disabled={!!instalando && !instalando.fin} onClick={instalar}>⚡ Instalar MicroPython</button>
            {!conectada && <button style={st.mini} onClick={() => conectar(true)}>Elegir otro puerto</button>}
          </div>
          {kit.fuente === 'placa' && kit.estado === 'conectando' && <div style={st.nota}>⏳ {kit.mensaje}</div>}
          {conectada && <div style={{ ...st.nota, color: '#86efac' }}>✅ Conectada. Ya puedes usar todas las pestañas.</div>}
          {(error || (kit.estado === 'error' && kit.mensaje)) && <div style={{ ...st.aviso, marginTop: 8 }}>⚠️ {error || kit.mensaje}</div>}
          {instalando && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 10, borderRadius: 99, background: '#1e293b', overflow: 'hidden' }}>
                <div style={{ width: `${instalando.pct}%`, height: '100%', background: '#f59e0b', transition: 'width .3s' }} />
              </div>
              <div style={{ ...st.nota, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5 }}>{instalando.log.map((l, i) => <div key={i}>{l}</div>)}</div>
              {instalando.fin && <div style={{ ...st.nota, color: '#86efac' }}>Ahora pulsa <b>🔌 Conectar</b>.</div>}
            </div>
          )}
          {placa === 'esp32' && (
            <details style={{ ...st.caja, marginTop: 10, background: 'rgba(22,163,74,.08)', borderColor: 'rgba(134,239,172,.3)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800 }}>🔧 Otra opción: dejar la placa con Arduino</summary>
              <div style={st.nota}>Si prefieres no instalar MicroPython, sube una vez este programa desde Arduino IDE y el laboratorio se conecta igual.</div>
              <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                <li><a href="/firmware/laboratorio_smarthome.ino" download style={{ color: '#86efac' }}>⬇️ Descarga el programa del laboratorio (.ino)</a> y ábrelo con <a href="https://www.arduino.cc/en/software" target="_blank" rel="noopener noreferrer" style={{ color: '#86efac' }}>Arduino IDE</a> (acepta crear su carpeta).</li>
                <li>En <b>Gestor de placas</b> instala «esp32» de Espressif y elige la placa <b>ESP32 Dev Module</b> y su puerto COM.</li>
                <li>Pulsa <b>Subir</b> (→). Cierra el Monitor serie y pulsa aquí <b>🔌 Conectar</b>.</li>
              </ol>
              <div style={st.nota}>Con Arduino los pines se cambian al principio del .ino (los de ⚙️ Pines solo valen para MicroPython).</div>
            </details>
          )}
          {conectada && kit.modo === 'arduino' && <div style={{ ...st.nota, color: '#86efac' }}>🔧 Conectada con el programa Arduino del laboratorio.</div>}
          <div style={st.nota}>
            ⚠️ Instalar MicroPython <b>borra el programa que tuviera la placa</b> (por ejemplo, el de ArduinoBlocks). Para volver a usarla con ArduinoBlocks basta con subir otra vez un programa desde allí.
            El laboratorio no guarda nada en la placa: al desconectar, todo queda como estaba.
          </div>
        </div>}

        <div style={st.caja}>
          <button style={st.mini} onClick={() => setVerPines((v) => !v)}>⚙️ Pines del montaje {verPines ? '▲' : '▼'}</button>
          {verPines && (
            <div style={{ marginTop: 8 }}>
              <div style={st.nota}>Vienen con {placa === 'tdr' ? 'la tabla de la placa Imagina TdR STEAM (CATEDU)' : placa === 'esp32' ? 'el montaje del manual Keyestudio Smart Home ESP32 (KS5009)' : 'el montaje Smart Home de Aragón (el mismo del editor de bloques)'}. Cámbialos solo si tu montaje está cableado de otra forma. «—» = no conectado.</div>
              {placa === 'tdr' && <div style={st.nota}>Puertos libres para módulos del kit: D3 = IO25 y D5 = IO16 (digitales), A3 = IO34 (analógico, aquí va el micrófono).</div>}
              <label style={{ ...st.label, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input type="checkbox" checked={!!pines.botonAlto} onChange={(e) => cambiarPin('botonAlto', e.target.checked ? 1 : 0)} />
                Los botones dan 1 al pulsarlos (desmárcalo si en el Panel salen al revés)
              </label>
              <table style={{ ...st.tabla, marginTop: 6 }}>
                <tbody>
                  {Object.keys(NOMBRES_PIN).map((k) => (
                    <tr key={k}>
                      <td style={st.td}>{NOMBRES_PIN[k]}</td>
                      <td style={st.td}>
                        <select style={st.input} value={pines[k]} onChange={(e) => cambiarPin(k, e.target.value)}>
                          {(ENTRADAS_ANALOGICAS.includes(k) ? PLACAS[placa].pinesAnalogicos : [-1, ...Array.from({ length: PLACAS[placa].esp32 ? 40 : 21 }, (_, i) => i)])
                            .map((n) => <option key={n} value={n}>{n === -1 ? '—' : n === -2 ? 'interno' : PLACAS[placa].esp32 ? `IO${n}` : `P${n}`}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {placa === 'esp32' && <div style={st.nota}>El kit Smart Home ESP32 no trae sensor de luz ni de humedad del suelo. Si conectas uno, ponlo en un pin analógico libre (IO32, IO33, IO35…) y elígelo aquí.</div>}
              {conectada && <div style={st.nota}>Los cambios se aplican al volver a conectar.</div>}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={st.caja}>
          <b>📟 Lecturas en vivo</b> <span style={st.nota}>({kit.fuente === 'sim' ? 'simulación' : PLACAS[kit.placa].nombre})</span>
          <div style={{ marginTop: 8 }}><Lecturas /></div>
        </div>
        <PanelSimulacion />
        {kit.fuente === 'placa' && kit.lectura && (
          <div style={st.nota}>Las entradas analógicas (luz, lluvia, suelo y gas) se muestran en % de la lectura del pin (0 % = 0 V, 100 % = 3,3 V). Para pasarlas a unidades reales habría que calibrar el sensor.</div>
        )}
        {sinMicropython && PLACAS[placa].esp32 && (
          <div style={st.aviso}>💡 Si «Instalar MicroPython» no consigue conectar con el chip: mantén pulsado el botón <b>BOOT</b> (o IO0) de la placa, pulsa instalar y suéltalo cuando empiece a grabar.</div>
        )}
      </div>
    </div>
  );
}

