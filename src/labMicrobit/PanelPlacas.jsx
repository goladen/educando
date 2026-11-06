// 📋 Barra de placas del Laboratorio (placas multifunción, usePlacasLab): para cada función que necesita
// la pestaña (satélites, instrumento) pide el número de la placa que la hará; esa placa cambia sola por
// radio aunque esté como mando. «⚙️ Más» enseña todas las placas encendidas y el reparto automático.
import React, { useEffect, useState } from 'react';
import { ROLES_MULTI } from './programasLab';
import { COLORES_SAT } from './escenaSala';
import { st } from './estilosLab';

const NOMBRE = { M: '🎮 Mando', S1: '🛰️ S1', S2: '🛰️ S2', S3: '🛰️ S3', S4: '🛰️ S4', I: '🎛️ Instrumento' };
const color = (rol) => (rol[0] === 'S' ? COLORES_SAT[Number(rol[1]) - 1] : rol === 'I' ? '#a855f7' : '#64748b');
const VIVA_MS = 20000; // sin noticias en 20 s = apagada o fuera de alcance

/** Casilla «placa nº» de una función: se aplica al pulsar Intro o al salir de la casilla. */
function NumeroPlaca({ rol, id, estado, opcional, onElegir, onQuitar }) {
  const [txt, setTxt] = useState(id || '');
  useEffect(() => setTxt(id || ''), [id]);
  const aplicar = () => {
    const n = Number(txt);
    if (txt === '' && id) onQuitar();
    else if (Number.isInteger(n) && n >= 1 && n <= 30 && String(n) !== String(id)) onElegir(n);
    else setTxt(id || '');
  };
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', fontSize: 13 }}>
      <span style={{ ...st.punto, background: color(rol) }} />
      <b>{NOMBRE[rol]}</b>{opcional && <span style={{ color: '#94a3b8' }}>(opcional)</span>} placa
      <input type="number" min={1} max={30} value={txt} placeholder="nº" onChange={(e) => setTxt(e.target.value)}
        onBlur={aplicar} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{ ...st.input, width: 56, padding: '4px 6px' }} />
      <span title={estado.texto}>{estado.icono}</span>
    </label>
  );
}

export default function PanelPlacas({ placas, necesarios, opcionales = [] }) {
  const { roles, vistas, asignar, quitar, repartir, buscar } = placas;
  const [abierto, setAbierto] = useState(false);
  const [, tic] = useState(0);
  useEffect(() => { const t = setInterval(() => tic((n) => n + 1), 2000); return () => clearInterval(t); }, []);

  const viva = (id) => vistas[id] && Date.now() - vistas[id].t < VIVA_MS;
  const quien = (rol) => Object.keys(roles).find((id) => roles[id] === rol);
  const estadoDe = (rol) => {
    const id = quien(rol);
    if (!id) return { icono: '', texto: '' };
    if (viva(id) && vistas[id].rol === rol) return { icono: '✅', texto: 'Lista' };
    if (viva(id)) return { icono: '⏳', texto: 'Cambiando de función…' };
    return { icono: '❔', texto: 'No contesta: ¿está encendida y en el mismo canal?' };
  };
  const ids = [...new Set([...Object.keys(vistas), ...Object.keys(roles)])].map(Number).sort((a, b) => a - b);
  const falta = necesarios.some((r) => !quien(r));

  return (
    <div style={{ ...st.caja, margin: '8px 12px 0', padding: '8px 12px', borderColor: falta ? 'rgba(250,204,21,.55)' : undefined }}>
      <div style={{ ...st.fila, gap: 14 }}>
        <b>📋 Placas</b>
        {[...necesarios, ...opcionales].map((rol) => (
          <NumeroPlaca key={rol} rol={rol} id={quien(rol)} estado={estadoDe(rol)} opcional={opcionales.includes(rol)}
            onElegir={(n) => asignar(n, rol)} onQuitar={() => quitar(rol)} />
        ))}
        <span style={{ flex: 1 }} />
        <button style={st.mini} onClick={() => setAbierto((a) => !a)}>{abierto ? '▲ Cerrar' : '⚙️ Más'}</button>
      </div>
      {falta && <div style={st.nota}>Escribe el número de la placa (el de su pegatina) que hará cada función: cambiará sola aunque esté como mando. Al salir del laboratorio, o al abrir un juego con mandos, vuelven solas a mando.</div>}
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <div style={st.fila}>
            <button style={st.btn('#f59e0b')} disabled={!Object.keys(vistas).length} onClick={repartir}>✨ Repartir automáticamente</button>
            <button style={st.mini} onClick={buscar}>🔄 Buscar placas</button>
          </div>
          {!ids.length && <div style={{ ...st.aviso, marginTop: 8 }}>Todavía no ha contestado ninguna placa. Enciéndelas (en el mismo canal que la antena) y pulsa «🔄 Buscar placas». Las placas grabadas solo como mando (versión antigua) no contestan: vuelve a grabarlas en <b>⚙️ Preparar placas</b>.</div>}
          {ids.length > 0 && (
            <table style={{ ...st.tabla, marginTop: 8 }}>
              <tbody>
                {ids.map((id) => {
                  const v = vistas[id];
                  const elegido = roles[id] || v?.rol;
                  return (
                    <tr key={id}>
                      <td style={st.td}><b>Placa {id}</b></td>
                      <td style={{ ...st.td, color: '#94a3b8', whiteSpace: 'nowrap' }}>{viva(id) ? `ahora: ${NOMBRE[v.rol]}` : v ? 'sin noticias' : 'no contesta'}</td>
                      <td style={st.td}>
                        <div style={st.fila}>
                          {ROLES_MULTI.map((r) => (
                            <button key={r} style={{ ...st.chip(elegido === r), borderColor: elegido === r ? color(r) : '#475569' }} onClick={() => asignar(id, r)}>{NOMBRE[r]}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
