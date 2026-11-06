// «🎤 Sonómetro»: medidor de ruido del aula. La fuente del nivel (0-100 %, proporcional a la
// amplitud) llega por `suscribir(fn)`; si no se pasa, es el micrófono de la placa del Laboratorio.
//   · Semáforo del ruido: dos umbrales (desigualdades) → verde / ámbar / rojo en pantalla, en el LED
//     RGB y la LCD de la placa (si `actuar`) y pitido si se pasa del rojo un rato.
//   · Vista para proyectar (📺): semáforo gigante a pantalla completa.
//   · Decibelios relativos al silencio medido: dB = 20·log10(nivel / nivel del silencio).
//   · Estadística de la sesión: media, mediana, percentil 90, % del tiempo en cada color e histograma.
// Lo usan el Laboratorio (pestaña Sonómetro) y Gestión de aula (SonometroAula.jsx).
import React, { useEffect, useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar, escuchar } from './conexionKit';
import { fmt, descargarCSV } from './useKit';
import { PanelSimulacion } from './Conectar';
import Grafica from './Grafica';

const COLOR = { verde: [0, 200, 0], ambar: [255, 120, 0], rojo: [255, 0, 0] };
const CSS = { verde: '#22c55e', ambar: '#f59e0b', rojo: '#ef4444' };
const TEXTO_LCD = { verde: 'Ruido: bien', ambar: 'Ruido: cuidado', rojo: '!! SILENCIO !!' };
const MENSAJE = { verde: '¡Muy bien!', ambar: 'Bajad un poco la voz', rojo: '¡Silencio, por favor!' };
const percentil = (ord, q) => (ord.length ? ord[Math.min(ord.length - 1, Math.floor(q * ord.length))] : null);
const micDeLaPlaca = (fn) => escuchar((ev) => { if (ev.tipo === 'K' && ev.lectura.mic != null) fn(ev.lectura.mic, ev.lectura.t); });

let audio = null;
function pitido() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.value = 0.12;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.3);
  } catch { /* sin audio */ }
}

function Semaforo({ zona, tam = 36 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: tam / 3.5 }}>
      {['verde', 'ambar', 'rojo'].map((c) => (
        <span key={c} style={{ width: tam, height: tam, borderRadius: 99, background: zona === c ? CSS[c] : '#1e293b', boxShadow: zona === c ? `0 0 ${tam / 2}px ${CSS[c]}` : 'none', border: '2px solid #334155' }} />
      ))}
    </div>
  );
}

export default function Sonometro({ suscribir = micDeLaPlaca, actuar = true, simulacion = true, cabecera = null, sinSensor = null }) {
  const [v, setV] = useState(null);
  const [u1, setU1] = useState(30);
  const [u2, setU2] = useState(60);
  const [semaforo, setSemaforo] = useState(false);
  const [pitar, setPitar] = useState(true);
  const [proyectar, setProyectar] = useState(false);
  const [silencio, setSilencio] = useState(null); // nivel de referencia (0 dB)
  const [midiendoSilencio, setMidiendoSilencio] = useState(false);
  const [sesion, setSesion] = useState([]);        // niveles de toda la sesión (4 por segundo)
  const reciente = useRef([]);                     // [t, nivel] del último minuto
  const color = useRef('');
  const enRojoDesde = useRef(0);
  const muestrasSilencio = useRef(null);
  const zona = (x) => (x < u1 ? 'verde' : x < u2 ? 'ambar' : 'rojo');

  // Cada nivel nuevo (el manejador se lee de una ref para ver siempre los umbrales actuales)
  const alNivel = useRef(null);
  alNivel.current = (x, t) => {
    setV(x);
    reciente.current = [...reciente.current, [t, x]].filter((q) => q[0] > t - 60);
    setSesion((s) => (s.length > 20000 ? s : [...s, x]));
    muestrasSilencio.current?.push(x);
    if (!semaforo) return;
    const z = zona(x);
    if (z !== color.current) {
      color.current = z;
      if (actuar) { enviar('rgb', COLOR[z]); enviar('lcd', [1, TEXTO_LCD[z]]); }
    }
    if (z === 'rojo') {
      if (!enRojoDesde.current) enRojoDesde.current = Date.now();
      else if (pitar && Date.now() - enRojoDesde.current > 2000) {
        enRojoDesde.current = Date.now();
        if (actuar) enviar('pita', [880, 300]); else pitido();
      }
    } else enRojoDesde.current = 0;
  };
  useEffect(() => suscribir((x, t) => alNivel.current(x, t)), [suscribir]);

  const medirSilencio = () => {
    muestrasSilencio.current = [];
    setMidiendoSilencio(true);
    setTimeout(() => {
      const m = muestrasSilencio.current || [];
      muestrasSilencio.current = null;
      setSilencio(m.length ? Math.max(0.5, m.reduce((a, b) => a + b, 0) / m.length) : null);
      setMidiendoSilencio(false);
    }, 3000);
  };
  const activar = (on) => {
    setSemaforo(on); color.current = '';
    if (!actuar) return;
    if (!on) { enviar('rgb', [0, 0, 0]); enviar('lcd', [1, '']); } else enviar('lcd', [0, 'Semaforo ruido']);
  };

  const db = (x) => (silencio && x > 0 ? 20 * Math.log10(x / silencio) : null);
  const ord = [...sesion].sort((a, b) => a - b);
  const media = sesion.length ? sesion.reduce((a, b) => a + b, 0) / sesion.length : null;
  const porZona = { verde: 0, ambar: 0, rojo: 0 };
  sesion.forEach((x) => { porZona[zona(x)]++; });
  const hist = Array.from({ length: 10 }, (_, i) => [i * 10 + 5, sesion.filter((x) => x >= i * 10 && (x < i * 10 + 10 || (i === 9 && x <= 100))).length]);
  const t1 = reciente.current.at(-1)?.[0] ?? 0;
  const z = v == null ? null : zona(v);

  return (
    <div style={st.dosColumnas}>
      {proyectar && (
        <div onClick={() => setProyectar(false)} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'min(5vh, 40px)', cursor: 'pointer', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'min(3vh, 24px)', padding: 'min(3vh, 24px)', background: '#0f172a', borderRadius: 40, border: '4px solid #334155' }}>
            {['rojo', 'ambar', 'verde'].map((c) => (
              <span key={c} style={{ width: 'min(20vh, 170px)', height: 'min(20vh, 170px)', borderRadius: 999, background: z === c ? CSS[c] : '#1e293b', boxShadow: z === c ? `0 0 80px ${CSS[c]}` : 'none' }} />
            ))}
          </div>
          <div style={{ fontSize: 'min(7vh, 64px)', fontWeight: 900, color: z ? CSS[z] : '#94a3b8', textAlign: 'center' }}>{z ? MENSAJE[z] : 'Esperando sonido…'}</div>
          <div style={{ width: 'min(80vw, 700px)', height: 26, borderRadius: 99, background: '#1e293b', overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${v ?? 0}%`, height: '100%', background: z ? CSS[z] : '#475569', transition: 'width .2s' }} />
            {[u1, u2].map((u) => <span key={u} style={{ position: 'absolute', left: `${u}%`, top: 0, bottom: 0, width: 3, background: '#f8fafc' }} />)}
          </div>
          <div style={{ fontSize: 14, color: '#64748b' }}>Toca la pantalla para salir</div>
        </div>
      )}

      <div style={st.lateral}>
        {cabecera}
        <div style={{ ...st.caja, textAlign: 'center' }}>
          <b>🎤 Nivel de sonido</b>
          <div style={{ ...st.grande, color: z ? CSS[z] : '#94a3b8' }}>{fmt(v, 0)} %</div>
          {silencio && <div style={{ fontSize: 18, fontWeight: 800 }}>{v != null && v > 0 ? `${db(v) >= 0 ? '+' : ''}${fmt(db(v), 1)} dB` : '—'} <span style={st.nota}>sobre el silencio</span></div>}
          <div style={{ marginTop: 8 }}><Semaforo zona={z} /></div>
          <button style={{ ...st.btn('#7c3aed'), marginTop: 10 }} onClick={() => { setProyectar(true); if (!semaforo) activar(true); }}>📺 Semáforo a pantalla completa</button>
        </div>
        {simulacion && <PanelSimulacion campos={['mic']} />}

        <div style={st.caja}>
          <b>🚦 Semáforo del ruido</b>
          <div style={{ ...st.fila, marginTop: 6 }}>
            🟢 nivel &lt; <input type="number" style={{ ...st.input, width: 60 }} value={u1} onChange={(e) => setU1(Number(e.target.value))} /> %
          </div>
          <div style={{ ...st.fila, marginTop: 6 }}>
            🟠 {u1} % ≤ nivel &lt; <input type="number" style={{ ...st.input, width: 60 }} value={u2} onChange={(e) => setU2(Number(e.target.value))} /> %
          </div>
          <div style={{ ...st.fila, marginTop: 6 }}>
            🔴 nivel ≥ {u2} %
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={pitar} onChange={(e) => setPitar(e.target.checked)} /> pitido si dura más de 2 s</label>
          </div>
          <div style={{ ...st.fila, marginTop: 8 }}>
            <button style={st.btn(semaforo ? '#dc2626' : '#16a34a')} onClick={() => activar(!semaforo)}>{semaforo ? '⏹️ Parar semáforo' : actuar ? '▶️ Encender (también en la placa)' : '▶️ Encender semáforo'}</button>
          </div>
          {actuar && <div style={st.nota}>En la placa enciende el LED RGB del color que toca y escribe el aviso en la pantalla LCD.</div>}
        </div>

        <div style={st.caja}>
          <b>📏 Decibelios</b>
          <div style={st.nota}>El micrófono no está calibrado, pero sí se puede comparar con el silencio del aula: mide 3 segundos sin hablar.</div>
          <div style={{ ...st.fila, marginTop: 6 }}>
            <button style={st.btn('#0ea5e9')} disabled={midiendoSilencio} onClick={medirSilencio}>{midiendoSilencio ? '🤫 Midiendo…' : '🤫 Medir el silencio'}</button>
            {silencio && <span style={st.nota}>silencio = {fmt(silencio, 1)} % (0 dB)</span>}
          </div>
          <div style={st.formula}>dB = 20 · log₁₀( nivel / silencio )</div>
          <div style={st.nota}>Doble de nivel → +6 dB. Diez veces más → +20 dB. ¿Por qué se usa una escala logarítmica para el sonido?</div>
        </div>
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={st.caja}>
          <b>Último minuto</b>
          <Grafica series={[{ puntos: reciente.current.map(([t, x]) => [t - t1, x]), color: '#fb7185', nombre: 'Nivel' }]}
            curvas={[{ f: () => u1, color: '#f59e0b', nombre: `umbral ámbar (${u1} %)` }, { f: () => u2, color: '#ef4444', nombre: `umbral rojo (${u2} %)` }]}
            ejeX="segundos" ejeY="nivel (%)" xMin={-60} xMax={0} yMin={0} yMax={100} alto={220} />
        </div>
        <div style={st.caja}>
          <div style={{ ...st.fila, justifyContent: 'space-between' }}>
            <b>📊 Estadística de la sesión ({fmt(sesion.length / 4 / 60, 1)} min)</b>
            <span style={st.fila}>
              {sesion.length > 0 && <button style={st.mini} onClick={() => descargarCSV('sonometro.csv', ['segundo', 'nivel (%)'], sesion.map((x, i) => [i / 4, Math.round(x * 10) / 10]))}>⬇️ CSV</button>}
              <button style={st.mini} onClick={() => setSesion([])}>🗑️ Empezar de nuevo</button>
            </span>
          </div>
          {sesion.length > 0 ? (
            <>
              <div style={{ ...st.fila, marginTop: 6 }}>
                <span style={st.chip(true)}>media {fmt(media, 1)} %</span>
                <span style={st.chip(false)}>mediana {fmt(percentil(ord, 0.5), 1)} %</span>
                <span style={st.chip(false)}>percentil 90 {fmt(percentil(ord, 0.9), 1)} %</span>
                <span style={st.chip(false)}>máximo {fmt(ord.at(-1), 0)} %</span>
              </div>
              <div style={{ ...st.fila, marginTop: 6 }}>
                Tiempo: 🟢 {fmt((100 * porZona.verde) / sesion.length, 0)} % · 🟠 {fmt((100 * porZona.ambar) / sesion.length, 0)} % · 🔴 {fmt((100 * porZona.rojo) / sesion.length, 0)} %
              </div>
              <Grafica series={[{ puntos: hist, color: '#fb7185', nombre: 'Lecturas por tramo de 10 %', linea: false }]} ejeX="nivel (%)" ejeY="nº de lecturas" xMin={0} xMax={100} yMin={0} alto={180} />
              <div style={st.nota}>¿Por qué la media y la mediana no coinciden? Un solo grito sube mucho la media pero casi no mueve la mediana.</div>
            </>
          ) : <div style={st.nota}>Esperando lecturas del micrófono…</div>}
          {sinSensor}
        </div>
      </div>
    </div>
  );
}
