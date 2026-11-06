// Reglas «si <sensor> <op> <umbral> → acción», escritas como desigualdades que se ven cumplirse en
// vivo. Las usan el Gemelo de la casa (domótica) y la Placa 3D de la Imagina TdR STEAM.
// Regla = { id, sensor, op: '>' | '<' | '=', umbral, ud, texto, accion, si(), no?(), repetir?(), estados?: [no, sí] }
import React, { useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { useKit, useEventosKit, fmt } from './useKit';

const cumple = (r, v, umbral) => (v == null ? null : r.op === '>' ? v > umbral : r.op === '<' ? v < umbral : v === umbral);

export default function Reglas({ reglas, titulo = '🤖 Reglas', nota = 'Activa una regla y cambia el número: la placa actúa cuando se cumple la desigualdad.' }) {
  const kit = useKit();
  const [activas, setActivas] = useState({});
  const [umbrales, setUmbrales] = useState(() => Object.fromEntries(reglas.map((r) => [r.id, r.umbral])));
  const estado = useRef({});
  const ultimaRepeticion = useRef(0);

  // Solo actúan cuando cambia el resultado (para no saturar la placa de órdenes)
  useEventosKit((ev) => {
    if (ev.tipo !== 'K') return;
    reglas.forEach((r) => {
      if (!activas[r.id]) return;
      const c = cumple(r, ev.lectura[r.sensor], umbrales[r.id]);
      if (c == null) return;
      if (c !== estado.current[r.id]) { estado.current[r.id] = c; (c ? r.si : r.no)?.(); }
      else if (c && r.repetir && Date.now() - ultimaRepeticion.current > 1500) { ultimaRepeticion.current = Date.now(); r.repetir(); }
    });
  });
  const alternar = (id) => { setActivas((a) => ({ ...a, [id]: !a[id] })); delete estado.current[id]; };

  return (
    <div style={st.caja}>
      <b>{titulo}</b>
      <div style={st.nota}>{nota}</div>
      {reglas.map((r) => {
        const v = kit.lectura?.[r.sensor];
        const c = cumple(r, v, umbrales[r.id]);
        return (
          <div key={r.id} style={{ marginTop: 8, padding: 8, borderRadius: 10, background: activas[r.id] ? 'rgba(56,189,248,.12)' : 'rgba(0,0,0,.2)' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, fontSize: 13.5, flexWrap: 'wrap' }}>
              <input type="checkbox" checked={!!activas[r.id]} onChange={() => alternar(r.id)} />
              Si {r.texto} {r.op === '=' ? '' : <>{r.op}
                <input type="number" style={{ ...st.input, width: 62 }} value={umbrales[r.id]} onChange={(e) => { setUmbrales((u) => ({ ...u, [r.id]: Number(e.target.value) })); delete estado.current[r.id]; }} /> {r.ud}</>}
              → {r.accion}
            </label>
            <div style={{ ...st.nota, marginTop: 2 }}>
              Ahora: {v == null ? 'sensor no conectado' : r.op === '=' ? (r.estados || ['no', 'sí'])[v ? 1 : 0] : `${fmt(v, 0)} ${r.ud} ${r.op} ${umbrales[r.id]} ${r.ud}`}
              {c != null && <b style={{ color: c ? '#86efac' : '#fca5a5' }}> {c ? '✔ se cumple' : '✘ no se cumple'}</b>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
