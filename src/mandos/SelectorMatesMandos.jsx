// Elegir qué se juega en «Mates con mandos»: temas de Math World, tipos de ejercicio y nivel.
// Solo se ofrecen los tipos que se pueden contestar con el modo elegido (letras o número).
import React, { useEffect, useMemo, useState } from 'react';
import { TEMAS_MATES, tiposJugables, generarPreguntasMates } from './preguntasMates.js';

const LIMITES = [[19, 'hasta 19'], [100, 'hasta 100'], [1000, 'hasta 1000'], [9999, 'sin límite']];

// tiposIniciales: ['longitud', 'masa'] → de los temas iniciales solo quedan marcados esos tipos
export default function SelectorMatesMandos({ numerico, apiRef, temasIniciales = null, nivelInicial = null, tiposIniciales = null }) {
  // Al volver al menú tras una partida el selector se vuelve a montar: se recupera lo que se había
  // elegido (antes volvía a «Cálculo» con todos los tipos y la partida siguiente los mezclaba todos).
  const previo = apiRef?.current?.estado?.ui || null;
  const [temas, setTemas] = useState(() => {
    if (previo?.temas?.length) return previo.temas;
    const validos = (temasIniciales || []).filter((id) => TEMAS_MATES.some((f) => f.id === id));
    return validos.length ? validos : ['calculo'];
  });
  // «Cálculo» viene marcado solo como ejemplo: al pulsar el primer tema, lo sustituye (antes se
  // sumaba y, al elegir p. ej. Polinomios, salían también ejercicios de cálculo).
  const [porDefecto, setPorDefecto] = useState(() => (previo ? previo.porDefecto : !(temasIniciales || []).some((id) => TEMAS_MATES.some((f) => f.id === id))));
  const [nivel, setNivel] = useState(previo?.nivel || nivelInicial || 1);
  const [maxNum, setMaxNum] = useState(previo?.maxNum || 100);
  const [quitados, setQuitados] = useState(() => {
    if (previo?.quitados) return previo.quitados;
    if (!tiposIniciales?.length) return {}; // 'tema.tipo' → true
    const q = {};
    (temasIniciales || []).forEach((id) => {
      const f = TEMAS_MATES.find((x) => x.id === id);
      Object.keys(f?.tipos || {}).forEach((tipo) => { if (!tiposIniciales.includes(tipo)) q[`${id}.${tipo}`] = true; });
    });
    return q;
  });
  const opts = useMemo(() => ({ nivel, numerico, maxNum }), [nivel, numerico, maxNum]);

  const jugables = useMemo(
    () => Object.fromEntries(temas.map((id) => [id, tiposJugables(id, opts)])),
    [temas, opts]
  );
  const seleccion = temas.flatMap((tema) =>
    (jugables[tema] || []).filter((tipo) => !quitados[`${tema}.${tipo}`]).map((tipo) => ({ tema, tipo }))
  );

  useEffect(() => {
    const api = (n) => generarPreguntasMates(seleccion, n, opts);
    // seleccion/opts: para vincular una ficha PDF (Invasión Pi la regenera con semilla) · ui: para recordar
    api.estado = { seleccion, opts, ui: { temas, nivel, maxNum, quitados, porDefecto } };
    apiRef.current = api;
  });

  const alternarTema = (id) => {
    if (porDefecto) {
      setPorDefecto(false);
      if (!temas.includes(id)) { setTemas([id]); return; }
    }
    setTemas((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  };
  const alternarTipo = (k) => setQuitados((q) => ({ ...q, [k]: !q[k] }));
  /** Marca todos (true) o ninguno (false) de los tipos de un tema. */
  const marcarTema = (id, todos) => setQuitados((q) => {
    const n = { ...q };
    (jugables[id] || []).forEach((tipo) => { n[`${id}.${tipo}`] = !todos; });
    return n;
  });
  /** Deja marcado SOLO ese tipo dentro de su tema. */
  const soloTipo = (id, tipo) => setQuitados((q) => {
    const n = { ...q };
    (jugables[id] || []).forEach((t) => { n[`${id}.${t}`] = t !== tipo; });
    return n;
  });

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
            <div style={{ ...st.fila, justifyContent: 'space-between' }}>
              <b style={{ color: '#f1f5f9' }}>{f.emoji} {f.nombre}</b>
              {lista.length > 1 && (
                <span style={st.fila}>
                  <button type="button" onClick={() => marcarTema(id, true)} style={st.mini}>✓ Todos</button>
                  <button type="button" onClick={() => marcarTema(id, false)} style={st.mini}>✕ Ninguno</button>
                </span>
              )}
            </div>
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
                    <span key={k} style={st.tipo(!quitados[k])}>
                      <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!quitados[k]} onChange={() => alternarTipo(k)} />
                        {f.tipos[tipo].label}
                      </label>
                      {lista.length > 1 && (
                        <button type="button" onClick={() => soloTipo(id, tipo)} title="Dejar solo este" style={st.solo}>solo</button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p style={{ ...st.nota, marginTop: 10, color: seleccion.length ? '#a7f3d0' : '#fca5a5' }}>
        {seleccion.length
          ? `Se jugará con ${seleccion.length} tipo${seleccion.length === 1 ? '' : 's'} de ejercicio: ${seleccion.map(({ tema, tipo }) => TEMAS_MATES.find((x) => x.id === tema)?.tipos[tipo]?.label).join(' · ')}`
          : 'No hay ningún tipo de ejercicio marcado.'}
      </p>
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
  tipo: (on) => ({ display: 'inline-flex', gap: 6, alignItems: 'center', color: on ? '#f1f5f9' : '#64748b', fontSize: 13.5, padding: '3px 8px', borderRadius: 8, border: `1px solid ${on ? '#38bdf8' : '#334155'}`, background: on ? 'rgba(56,189,248,0.12)' : 'transparent', textDecoration: on ? 'none' : 'line-through' }),
  mini: { padding: '3px 9px', borderRadius: 999, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  solo: { padding: '1px 6px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  vacio: { color: '#fde68a', fontSize: 13, margin: '6px 0 0' },
};
