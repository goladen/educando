// Sala 3D (escenaSala.js) como componente React. La sala, el receptor y las capas llegan por props;
// los cambios (arrastrar, clic en el suelo, seleccionar) salen por callbacks.
import React, { useEffect, useRef } from 'react';
import { montarSala } from './escenaSala';

export default function VistaSala({
  sala, receptor = null, capas = null, interaccion = { muebles: false, satelites: false, receptor: false },
  seleccion = null, onSeleccion, onMover, onSoltar, onClickSuelo, apiRef, style,
}) {
  const host = useRef(null);
  const motor = useRef(null);
  const cbs = useRef({});
  cbs.current = { onSeleccion, onMover, onSoltar, onClickSuelo };

  useEffect(() => {
    const m = montarSala({ host: host.current, cb: () => cbs.current });
    motor.current = m;
    if (apiRef) apiRef.current = m;
    return () => { m.destroy(); motor.current = null; if (apiRef) apiRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (sala) motor.current?.setSala(sala); }, [sala]);
  useEffect(() => { motor.current?.setReceptor(receptor); }, [receptor, sala]);
  useEffect(() => { motor.current?.setCapas(capas || {}); }, [capas, sala]);
  useEffect(() => { motor.current?.setInteraccion(interaccion); }, [interaccion.muebles, interaccion.satelites, interaccion.receptor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { motor.current?.setSeleccion(seleccion); }, [seleccion, sala]);

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', minHeight: 320, ...style }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 6 }}>
        <button style={btn} onClick={() => motor.current?.vista('perspectiva')} title="Vista en perspectiva">🎥 3D</button>
        <button style={btn} onClick={() => motor.current?.vista('cenital')} title="Vista desde arriba (plano)">🗺️ Plano</button>
      </div>
    </div>
  );
}

const btn = { background: 'rgba(15,23,42,.8)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '6px 10px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
