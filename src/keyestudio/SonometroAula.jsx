// 🎤 Sonómetro de aula (Gestión de aula → Herramientas de clase): el sonómetro del Laboratorio con la
// fuente a elegir: el micrófono del ordenador (cualquiera), la placa Imagina TdR STEAM (su micrófono,
// y además el semáforo en su LED RGB y su LCD) o una micro:bit V2 (su micrófono interno).
// Las placas se conectan por USB con conexionKit (el mismo programa MicroPython del Laboratorio).
// Cuarta fuente: varias micro:bit por radio, cada una con su semáforo (SonometroRadio.jsx).
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import Sonometro from './Sonometro';
// Va aparte: carga el servicio de la antena de los mandos solo si se elige esta fuente
const SonometroRadio = lazy(() => import('./SonometroRadio.jsx'));
import { abrirMicrofono, soportaMicrofono } from './microfono';
import { PLACAS, leerConfig } from './placasKit';
import {
  conectarPlaca, desconectar, cerrarLaboratorio, escuchar, soportaSerial,
  instalarMicropythonEsp32, instalarMicropythonMicrobit,
} from './conexionKit';
import { useKit } from './useKit';

const FUENTES = [
  ['micro', '💻 Micrófono del ordenador'],
  ['tdr', `${PLACAS.tdr.emoji} Imagina TdR STEAM`],
  ['microbit', `${PLACAS.microbit.emoji} micro:bit V2`],
  ['radio', '📡 Varias micro:bit por radio'],
];

export default function SonometroAula() {
  const kit = useKit();
  const [fuente, setFuente] = useState('micro');
  const [micActivo, setMicActivo] = useState(false);
  const [ganancia, setGanancia] = useState(10);
  const [error, setError] = useState('');
  const [instalando, setInstalando] = useState(null); // % o null
  const mic = useRef(null);
  const oyente = useRef(null);

  const cerrarMic = () => { mic.current?.cerrar(); mic.current = null; setMicActivo(false); };
  useEffect(() => () => { cerrarMic(); cerrarLaboratorio(); }, []);

  // La fuente entrega cada nivel al sonómetro por `suscribir`
  const suscribir = useCallback((fn) => {
    if (fuente === 'micro') { oyente.current = fn; return () => { oyente.current = null; }; }
    return escuchar((ev) => { if (ev.tipo === 'K' && ev.lectura.mic != null) fn(ev.lectura.mic, ev.lectura.t); });
  }, [fuente]);

  const elegir = async (f) => {
    if (f === fuente) return;
    setError('');
    cerrarMic();
    await desconectar();
    setFuente(f);
  };
  const activarMic = async () => {
    setError('');
    try { mic.current = await abrirMicrofono((x, t) => oyente.current?.(x, t), ganancia); setMicActivo(true); }
    catch (e) { setError(e.message); }
  };
  const conectar = async () => {
    setError('');
    try { await conectarPlaca({ placa: fuente, pines: leerConfig().pines[fuente] }); }
    catch (e) { setError(e.message || String(e)); }
  };
  const instalar = async () => {
    setError(''); setInstalando(0);
    try {
      if (fuente === 'microbit') await instalarMicropythonMicrobit(setInstalando);
      else await instalarMicropythonEsp32(setInstalando);
      setInstalando(null);
      await new Promise((r) => setTimeout(r, 4000)); // primer arranque de MicroPython
      await conectar();
    } catch (e) { setError(e.message); setInstalando(null); }
  };

  const placaConectada = fuente !== 'micro' && kit.fuente === 'placa' && kit.placa === fuente && kit.estado === 'conectada';
  const sinMicropython = /MicroPython/.test(error);

  const cabecera = (
    <div style={st.caja}>
      <b>¿Con qué se escucha el aula?</b>
      <div style={{ ...st.fila, marginTop: 8 }}>
        {FUENTES.map(([id, n]) => <button key={id} style={st.chip(fuente === id)} onClick={() => elegir(id)}>{n}</button>)}
      </div>

      {fuente === 'micro' && (
        <div style={{ marginTop: 8 }}>
          {!soportaMicrofono() && <div style={st.aviso}>Este navegador no puede usar el micrófono.</div>}
          {micActivo
            ? <button style={st.btn('#dc2626')} onClick={cerrarMic}>⏹️ Apagar micrófono</button>
            : <button style={st.btn('#16a34a')} onClick={activarMic}>🎙️ Activar el micrófono</button>}
          <label style={{ ...st.label, marginTop: 8 }}>Sensibilidad: ×{ganancia}
            <input type="range" min={1} max={50} value={ganancia} onChange={(e) => { const g = Number(e.target.value); setGanancia(g); mic.current?.setGanancia(g); }} />
          </label>
          <div style={st.nota}>Sirve cualquier micrófono: el del portátil, uno USB o el de unos auriculares. Ajusta la sensibilidad para que con la clase en silencio marque poco y hablando normal quede en verde.</div>
        </div>
      )}

      {fuente !== 'micro' && fuente !== 'radio' && (
        <div style={{ marginTop: 8 }}>
          {!soportaSerial() && <div style={st.aviso}>Para conectar una placa abre PiKT en <b>Chrome o Edge</b> en un ordenador.</div>}
          <div style={st.fila}>
            {placaConectada
              ? <button style={st.btn('#dc2626')} onClick={() => desconectar()}>⏏️ Desconectar</button>
              : <button style={st.btn('#16a34a')} disabled={kit.estado === 'conectando' || instalando != null} onClick={conectar}>🔌 Conectar por USB</button>}
            <button style={st.btn(sinMicropython ? '#f59e0b' : '#475569')} disabled={instalando != null} onClick={instalar}>⚡ Instalar MicroPython</button>
          </div>
          {kit.estado === 'conectando' && kit.placa === fuente && <div style={st.nota}>⏳ {kit.mensaje}</div>}
          {placaConectada && <div style={{ ...st.nota, color: '#86efac' }}>✅ Conectada: {fuente === 'tdr' ? 'el semáforo se verá también en su LED RGB y su pantalla LCD.' : 'escuchando con el micrófono de la micro:bit.'}</div>}
          {instalando != null && (
            <div style={{ height: 10, borderRadius: 99, background: '#1e293b', overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${instalando}%`, height: '100%', background: '#f59e0b' }} />
            </div>
          )}
          <div style={st.nota}>
            {fuente === 'tdr'
              ? <>El micrófono del kit va en el puerto <b>A3</b>. La primera vez pulsa <b>⚡ Instalar MicroPython</b> con el <b>potenciómetro a cero</b> y el <b>interruptor de Bluetooth hacia el borde</b>.</>
              : <>Necesita una <b>micro:bit V2</b> (la que tiene micrófono, con el logo dorado táctil). La primera vez, o si venía de MakeCode, pulsa <b>⚡ Instalar MicroPython</b>.</>}
          </div>
        </div>
      )}
      {(error || (kit.estado === 'error' && fuente !== 'micro' && kit.mensaje)) && <div style={{ ...st.aviso, marginTop: 8 }}>⚠️ {error || kit.mensaje}</div>}
    </div>
  );

  if (fuente === 'radio') {
    return (
      <div style={{ background: 'linear-gradient(160deg,#0b1d3a 0%,#0f172a 60%)', color: '#f1f5f9', borderRadius: 14, padding: 12, fontFamily: 'system-ui, sans-serif' }}>
        <Suspense fallback={<div style={st.nota}>Cargando…</div>}>
          <SonometroRadio cabecera={cabecera} />
        </Suspense>
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(160deg,#0b1d3a 0%,#0f172a 60%)', color: '#f1f5f9', borderRadius: 14, padding: 12, fontFamily: 'system-ui, sans-serif' }}>
      <Sonometro
        key={fuente}
        suscribir={suscribir}
        actuar={fuente === 'tdr' && placaConectada}
        simulacion={false}
        cabecera={cabecera}
        sinSensor={placaConectada && kit.lectura && kit.lectura.mic == null
          ? <div style={st.aviso}>{fuente === 'tdr' ? 'La placa no manda el micrófono: comprueba que está en el puerto A3.' : 'Esta micro:bit no tiene micrófono (es una V1).'}</div>
          : null}
      />
    </div>
  );
}
