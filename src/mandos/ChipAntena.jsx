// Estado de la antena micro:bit para la cabecera de los juegos con mandos.
// Si no está conectada, es un BOTÓN que la conecta allí mismo (sin volver al panel de mandos).
// Al conectar, el servicio vuelve a mandar a los mandos el modo del juego que está abierto.
import React, { useEffect, useRef, useState } from 'react';
import { escucharEstadoAntena, conectarAntena, soportaSerial, VERSION_PROGRAMAS } from './mandosMicrobit.js';

const CSS = '@keyframes chipAntenaLatido { 0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,.7); } 50% { box-shadow: 0 0 0 6px rgba(249,115,22,0); } }';

export default function ChipAntena({ style }) {
  const [estado, setEstado] = useState({ conectada: false, antenaOk: false, grupo: null, version: 0 });
  const [conectando, setConectando] = useState(false);
  const [aviso, setAviso] = useState('');
  const t = useRef(null);

  useEffect(() => escucharEstadoAntena(setEstado), []);
  useEffect(() => () => clearTimeout(t.current), []);

  const avisar = (txt) => {
    setAviso(txt);
    clearTimeout(t.current);
    t.current = setTimeout(() => setAviso(''), 7000);
  };

  const conectar = async () => {
    if (conectando) return;
    setConectando(true);
    try {
      const ok = await conectarAntena({ grabar: false });
      if (!ok) avisar('Esa placa no responde como antena. Grábala en Programación y robótica → Mandos micro:bit → «Grabar y conectar antena».');
      else setAviso('');
    } catch (e) {
      if (!/No se eligió/.test(e?.message || '')) avisar('❌ ' + (e?.message || e));
    }
    setConectando(false);
  };

  const base = { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13, fontWeight: 800, padding: '5px 12px', borderRadius: 999, border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap', ...style };
  let chip;
  if (estado.antenaOk) {
    const vieja = estado.version < VERSION_PROGRAMAS;
    chip = (
      <span style={{ ...base, background: vieja ? '#ca8a04' : '#16a34a' }}
        title={vieja ? 'La antena tiene un programa antiguo: vuelve a grabarla (y los mandos) en el panel de mandos.' : `Grupo de radio ${estado.grupo}`}>
        📡 Antena lista{vieja ? ' ⚠️' : ''}
      </span>
    );
  } else if (!soportaSerial()) {
    chip = <span style={{ ...base, background: '#475569' }} title="Para conectar la antena hace falta Chrome o Edge en un ordenador">⚪ Sin antena (usa Chrome o Edge)</span>;
  } else {
    const sinRespuesta = estado.conectada;
    chip = (
      <button type="button" onClick={conectar} disabled={conectando}
        title="Enchufa la micro:bit antena por USB y pulsa para elegirla"
        style={{ ...base, cursor: conectando ? 'wait' : 'pointer', background: sinRespuesta ? '#ca8a04' : '#ea580c', animation: conectando ? 'none' : 'chipAntenaLatido 1.6s ease-in-out infinite' }}>
        {conectando ? '⏳ Conectando…' : sinRespuesta ? '🟡 La antena no responde · reintentar' : '🔌 Antena desconectada · conectar'}
      </button>
    );
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <style>{CSS}</style>
      {chip}
      {aviso && (
        <span role="status" onClick={() => setAviso('')}
          style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, width: 280, whiteSpace: 'normal', background: '#1e293b', color: '#fde68a', border: '1px solid #f59e0b', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, boxShadow: '0 8px 20px rgba(0,0,0,.4)', cursor: 'pointer' }}>
          {aviso}
        </span>
      )}
    </span>
  );
}
