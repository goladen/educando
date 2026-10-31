// Elegir qué se juega en «Mates con mandos»: temas de Math World, tipos de ejercicio y nivel.
// Solo se ofrecen los tipos que se pueden contestar con el modo elegido (letras o número).
import React, { useEffect, useMemo, useState } from 'react';
import { TEMAS_MATES, tiposJugables, generarPreguntasMates } from './preguntasMates.js';

const LIMITES = [[19, 'hasta 19'], [100, 'hasta 100'], [1000, 'hasta 1000'], [9999, 'sin límite']];

export default function SelectorMatesMandos({ numerico, apiRef }) {
  const [temas, setTemas] = useState(['calculo']);
  const [nivel, setNivel] = useState(1);
  const [maxNum, setMaxNum] = useState(100);
  const [quitados, setQuitados] = useState({}); // 'tema.tipo' → true
  const opts = useMemo(() => ({ nivel, numerico, maxNum }), [nivel, numerico, maxNum]);

  const jugables = useMemo(
    () => Object.fromEntries(temas.map((id) => [id, tiposJugables(id, opts)])),
    [temas, opts]
  );
  const seleccion = temas.flatMap((tema) =>
    (jugables[tema] || []).filter((tipo) => !quitados[`${tema}.${tipo}`]).map((tipo) => ({ tema, tipo }))
  );

  useEffect(() => {
    apiRef.current = (n) => generarPreguntasMates(seleccion, n, opts);
  });

  const alternarTema = (id) => setTemas((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const alternarTipo = (k) => setQuitados((q) => ({ ...q, [k]: !q[k] }));

  return (
    <div>
      <h4 style={st.h4}>Temas <span style={st.nota}>(puedes mezclar varios)</span></h4>
      <div style={st.fila}>
        {TEMAS_MATES.map((f) => (
          <button key={f.id} onClick={() => alternarTema(f.id)} style={st.chip(temas.includes(f.id), f.color)}>
            {f.emoji} {f.nombre}
          </button>
        ))}
      </div>

      <div style={{ ...st.fila, marginTop: 12 }}>
        <span style={st.nota}>Nivel</span>
        {[1, 2, 3].map((n) => (
          <button key={n} onClick={() => setNivel(n)} style={st.chip(nivel === n, '#facc15')}>{n}</button>
        ))}
        {numerico && (
          <>
            <span style={{ ...st.nota, marginLeft: 10 }}>Resultado</span>
            <select value={maxNum} onChange={(e) => setMaxNum(Number(e.target.value))} style={st.select}>
              {LIMITES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </>
        )}
      </div>

      {temas.map((id) => {
        const f = TEMAS_MATES.find((x) => x.id === id);
        const lista = jugables[id] || [];
        return (
          <div key={id} style={st.tema}>
            <b style={{ color: '#f1f5f9' }}>{f.emoji} {f.nombre}</b>
            {lista.length === 0 ? (
              <p style={st.vacio}>
                {numerico
                  ? 'Con estas opciones no hay ejercicios de resultado entero. Prueba con letras A-D o con otro nivel o límite.'
                  : 'No hay ejercicios que se puedan jugar con este nivel.'}
              </p>
            ) : (
              <div style={{ ...st.fila, marginTop: 6 }}>
                {lista.map((tipo) => {
                  const k = `${id}.${tipo}`;
                  return (
                    <label key={k} style={st.tipo}>
                      <input type="checkbox" checked={!quitados[k]} onChange={() => alternarTipo(k)} />
                      {f.tipos[tipo].label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const st = {
  h4: { color: '#f1f5f9', margin: '10px 0 8px', fontSize: 15 },
  nota: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: (on, c) => ({
    padding: '7px 12px', borderRadius: 999, border: `2px solid ${on ? c : '#475569'}`,
    background: on ? 'rgba(250,204,21,0.15)' : 'transparent', color: '#f1f5f9', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
  }),
  select: { padding: '6px 10px', borderRadius: 8, border: '1px solid #475569', background: '#020617', color: '#f1f5f9', fontSize: 14 },
  tema: { marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid #334155' },
  tipo: { display: 'inline-flex', gap: 5, alignItems: 'center', color: '#cbd5e1', fontSize: 13.5, cursor: 'pointer' },
  vacio: { color: '#fde68a', fontSize: 13, margin: '6px 0 0' },
};
