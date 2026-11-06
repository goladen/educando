// «🏠 Mi sala»: el usuario crea su habitación en 3D (medidas, suelo, muebles y satélites), que luego
// usan el GPS y el medidor de distancias. Varias salas guardadas en este navegador + exportar/importar.
import React, { useRef, useState } from 'react';
import VistaSala from './VistaSala.jsx';
import { MUEBLES, TIPOS_MUEBLE, pegarAPared } from './muebles';
import { PLANTILLAS, crearDesdePlantilla, nuevoId, validarSala } from './salas';
import { COLORES_SAT } from './escenaSala';
import { fmt } from './trilateracion';
import { st } from './estilosLab';

const SUELOS = [['madera', '🪵 Madera'], ['baldosa', '⬜ Baldosa'], ['cesped', '🌱 Césped'], ['pista', '🏟️ Pista']];

export default function EditorSala({ salas, salaId, setSalaId, guardarSala, borrarSala, anadirSala }) {
  const sala = salas.find((s) => s.id === salaId) || salas[0];
  const [sel, setSel] = useState(null); // 'm:<id>' | 's:<k>'
  const fileRef = useRef(null);

  const cambiar = (cambios) => guardarSala({ ...sala, ...cambios });
  const muebleSel = sel?.startsWith('m:') ? sala.muebles.find((m) => 'm:' + m.id === sel) : null;
  const satSel = sel?.startsWith('s:') ? sala.satelites.find((s) => 's:' + s.k === sel) : null;

  const moverObjeto = (clave, x, y, rot) => {
    if (clave.startsWith('m:')) cambiar({ muebles: sala.muebles.map((m) => ('m:' + m.id === clave ? { ...m, x, y, rot: rot ?? m.rot } : m)) });
    else if (clave.startsWith('s:')) cambiar({ satelites: sala.satelites.map((s) => ('s:' + s.k === clave ? { ...s, x, y } : s)) });
  };

  const anadirMueble = (tipo) => {
    const def = MUEBLES[tipo];
    let pos = { x: sala.ancho / 2, y: sala.largo / 2, rot: 0 };
    if (def.pared) pos = pegarAPared(sala.ancho / 2, 0.1, sala, def.d);
    const m = { id: nuevoId(), tipo, ...pos };
    guardarSala({ ...sala, muebles: [...sala.muebles, m] });
    setSel('m:' + m.id);
  };
  const editarMueble = (cambios) => cambiar({ muebles: sala.muebles.map((m) => (m.id === muebleSel.id ? { ...m, ...cambios } : m)) });
  const girar = (g) => {
    if (MUEBLES[muebleSel.tipo]?.pared) return;
    editarMueble({ rot: ((muebleSel.rot || 0) + g + 360) % 360 });
  };
  const duplicar = () => {
    const m = { ...muebleSel, id: nuevoId(), x: Math.min(sala.ancho, muebleSel.x + 0.6), y: Math.min(sala.largo, muebleSel.y + 0.6) };
    cambiar({ muebles: [...sala.muebles, m] });
    setSel('m:' + m.id);
  };
  const borrarSel = () => {
    if (muebleSel) cambiar({ muebles: sala.muebles.filter((m) => m.id !== muebleSel.id) });
    if (satSel) cambiar({ satelites: sala.satelites.filter((s) => s.k !== satSel.k).map((s, i) => ({ ...s, k: i + 1 })) });
    setSel(null);
  };
  const anadirSatelite = () => {
    if (sala.satelites.length >= 4) return;
    const k = sala.satelites.length + 1;
    cambiar({ satelites: [...sala.satelites, { k, x: sala.ancho / 2, y: sala.largo / 2 }] });
    setSel('s:' + k);
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(sala, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sala.nombre.replace(/[^\w\- ]+/g, '').trim() || 'sala'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importar = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { anadirSala(validarSala(JSON.parse(await f.text()))); } catch (err) { alert('No se pudo importar: ' + (err.message || err)); }
  };

  const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <div style={st.fila}>
            <select value={sala.id} onChange={(e) => { setSalaId(e.target.value); setSel(null); }} style={{ ...st.input, flex: 1 }}>
              {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <input value={sala.nombre} onChange={(e) => cambiar({ nombre: e.target.value.slice(0, 60) })} style={{ ...st.input, marginTop: 8, width: '100%' }} placeholder="Nombre de la sala" />
          <div style={{ ...st.fila, marginTop: 8 }}>
            {PLANTILLAS.map((p) => <button key={p.id} style={st.mini} onClick={() => anadirSala(crearDesdePlantilla(p.id))}>+ {p.nombre}</button>)}
          </div>
          <div style={{ ...st.fila, marginTop: 8 }}>
            <button style={st.mini} onClick={exportar}>💾 Exportar</button>
            <button style={st.mini} onClick={() => fileRef.current?.click()}>📂 Importar</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importar} />
            <button style={{ ...st.mini, background: '#7f1d1d' }} disabled={salas.length < 2} onClick={() => { if (window.confirm(`¿Borrar «${sala.nombre}»?`)) borrarSala(sala.id); }}>🗑️</button>
          </div>
        </div>

        <div style={st.caja}>
          <b>📐 Medidas (metros)</b>
          <div style={st.rejilla3}>
            <label style={st.label}>Ancho (x)<input type="number" step="0.5" value={sala.ancho} onChange={(e) => cambiar({ ancho: num(e.target.value, 2, 60) })} style={st.input} /></label>
            <label style={st.label}>Largo (y)<input type="number" step="0.5" value={sala.largo} onChange={(e) => cambiar({ largo: num(e.target.value, 2, 60) })} style={st.input} /></label>
            <label style={st.label}>Alto<input type="number" step="0.1" value={sala.alto} onChange={(e) => cambiar({ alto: num(e.target.value, 0, 8) })} style={st.input} /></label>
          </div>
          <div style={st.nota}>Alto 0 = espacio abierto (patio, sin paredes). Superficie: <b>{fmt(sala.ancho * sala.largo, 1)} m²</b>{sala.alto > 0 && <> · volumen: <b>{fmt(sala.ancho * sala.largo * sala.alto, 1)} m³</b></>}</div>
          <div style={{ ...st.fila, marginTop: 8 }}>
            {SUELOS.map(([k, t]) => <button key={k} style={st.chip(sala.suelo === k)} onClick={() => cambiar({ suelo: k })}>{t}</button>)}
            {sala.alto > 0 && <label style={{ ...st.label, flexDirection: 'row', alignItems: 'center' }}>Paredes <input type="color" value={sala.pared} onChange={(e) => cambiar({ pared: e.target.value })} /></label>}
          </div>
        </div>

        <div style={st.caja}>
          <b>🪑 Añadir</b>
          <div style={{ ...st.fila, marginTop: 6 }}>
            {TIPOS_MUEBLE.map((t) => <button key={t} style={st.mini} onClick={() => anadirMueble(t)}>{MUEBLES[t].emoji} {MUEBLES[t].nombre}</button>)}
            <button style={{ ...st.mini, background: '#7c3aed' }} disabled={sala.satelites.length >= 4} onClick={anadirSatelite}>🛰️ Satélite</button>
          </div>
          <div style={st.nota}>Arrastra los objetos por el suelo. Puerta, ventana, pizarra y pantalla se pegan solas a la pared más cercana.</div>
        </div>

        {(muebleSel || satSel) && (
          <div style={{ ...st.caja, borderColor: '#facc15' }}>
            <b>{muebleSel ? `${MUEBLES[muebleSel.tipo]?.emoji} ${MUEBLES[muebleSel.tipo]?.nombre}` : `🛰️ Satélite ${satSel.k}`}</b>
            <div style={st.rejilla3}>
              <label style={st.label}>x (m)<input type="number" step="0.05" value={(muebleSel || satSel).x} onChange={(e) => moverObjeto(sel, num(e.target.value, 0, sala.ancho), (muebleSel || satSel).y)} style={st.input} /></label>
              <label style={st.label}>y (m)<input type="number" step="0.05" value={(muebleSel || satSel).y} onChange={(e) => moverObjeto(sel, (muebleSel || satSel).x, num(e.target.value, 0, sala.largo))} style={st.input} /></label>
              {muebleSel && !MUEBLES[muebleSel.tipo]?.pared && <label style={st.label}>Giro (°)<input type="number" step="15" value={muebleSel.rot || 0} onChange={(e) => editarMueble({ rot: Number(e.target.value) || 0 })} style={st.input} /></label>}
            </div>
            <div style={{ ...st.fila, marginTop: 8 }}>
              {muebleSel && !MUEBLES[muebleSel.tipo]?.pared && <><button style={st.mini} onClick={() => girar(-90)}>⟲ 90°</button><button style={st.mini} onClick={() => girar(15)}>⟳ 15°</button><button style={st.mini} onClick={() => girar(90)}>⟳ 90°</button></>}
              {muebleSel && <button style={st.mini} onClick={duplicar}>⧉ Duplicar</button>}
              <button style={{ ...st.mini, background: '#7f1d1d' }} onClick={borrarSel} disabled={!!satSel && sala.satelites.length <= 1}>🗑️ Quitar</button>
            </div>
          </div>
        )}

        <div style={st.caja}>
          <b>🛰️ Satélites ({sala.satelites.length})</b>
          {sala.satelites.map((s) => (
            <div key={s.k} style={{ ...st.fila, marginTop: 4, cursor: 'pointer' }} onClick={() => setSel('s:' + s.k)}>
              <span style={{ ...st.punto, background: COLORES_SAT[(s.k - 1) % 4] }} />
              <span>S{s.k} = ({fmt(s.x)} ; {fmt(s.y)})</span>
            </div>
          ))}
          <div style={st.nota}>Mide con una cinta dónde pones cada satélite en la sala real y escribe aquí sus coordenadas: el GPS solo puede ser tan exacto como estas medidas.</div>
        </div>
      </div>

      <VistaSala
        sala={sala}
        interaccion={{ muebles: true, satelites: true, receptor: false }}
        seleccion={sel}
        onSeleccion={setSel}
        onSoltar={moverObjeto}
        style={st.vista3d}
      />
    </div>
  );
}
