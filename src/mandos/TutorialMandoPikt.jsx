// 🎮 Pestaña «Mando Pikt» del editor por bloques: recorridos guiados para que los alumnos programen
// paso a paso una micro:bit que funcione como mando de los juegos de Pikt (mandoPiktBloques.js).
// Sirve también para otros recorridos (props recorridos/color/lsKey/textos): 🤖 mBot2 en robot/tutorialMbot2.js.
import React, { useEffect, useState } from 'react';
import { RECORRIDOS_MANDO, COLOR_MANDO } from './mandoPiktBloques';

const LS = 'pikt_tutorial_mando'; // { recorrido, paso } para seguir donde se dejó

const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } };

const s = {
  panel: { flex: 1, overflow: 'auto', padding: '14px 14px 16px', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 },
  titulo: { margin: '0 0 6px', color: '#e2e8f0', fontSize: 15, fontWeight: 800 },
  nota: { color: '#94a3b8', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' },
  tarjeta: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', cursor: 'pointer', fontFamily: 'inherit' },
  btn: (c, on = true) => ({ padding: '7px 11px', borderRadius: 8, border: 'none', background: on ? c : '#334155', color: on ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12.5, cursor: on ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }),
  fila: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  barra: { display: 'flex', gap: 3, margin: '8px 0 12px' },
  punto: (estado, color) => ({ flex: 1, height: 6, borderRadius: 3, background: estado === 'hecho' ? '#22c55e' : estado === 'actual' ? color : '#334155' }),
  aviso: (ok) => ({ marginTop: 10, padding: '8px 10px', borderRadius: 8, fontSize: 12.5, background: ok ? 'rgba(34,197,94,.12)' : 'rgba(250,204,21,.1)', border: `1px solid ${ok ? 'rgba(34,197,94,.5)' : 'rgba(250,204,21,.45)'}`, color: ok ? '#86efac' : '#fde68a' }),
  lista: { margin: '0 0 4px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
};

/**
 * codigo: el Python generado ahora mismo · cargar(estado): pone ese programa en el área de bloques ·
 * conectada / onGuardar: para el último paso (📥 Guardar en placa).
 */
export default function TutorialMandoPikt({
  codigo, cargar, conectada, onGuardar,
  recorridos = RECORRIDOS_MANDO, color = COLOR_MANDO, lsKey = LS,
  titulo = '🎮 Crea tu mando Pikt',
  intro = 'Programa paso a paso tu propia micro:bit para que sea un mando de los juegos de Pikt. Funciona con la misma antena que los mandos del centro: el juego no nota la diferencia.',
  nota = <>Los bloques nuevos están en la categoría <b style={{ color: COLOR_MANDO }}>🎮 Mando Pikt</b>.</>,
  volver = '← Elegir otro mando',
  textoGuardar = '📥 Guardar en placa',
  avisoGuardar = 'Primero conecta la micro:bit con «🔗 Conectar Placa»',
}) {
  const [pos, setPos] = useState(() => leer(lsKey)); // { recorrido, paso } o null
  const [resultado, setResultado] = useState(null); // { ok, texto }
  const [verPista, setVerPista] = useState(false);
  const [hechos, setHechos] = useState({}); // { 'letras:2': true }

  useEffect(() => { guardar(lsKey, pos); setResultado(null); setVerPista(false); }, [pos, lsKey]);

  const rec = pos && recorridos.find((r) => r.id === pos.recorrido);
  if (!rec) {
    return (
      <div style={s.panel}>
        <h3 style={s.titulo}>{titulo}</h3>
        <p style={s.nota}>{intro}</p>
        {recorridos.map((r) => (
          <button key={r.id} style={s.tarjeta} onClick={() => setPos({ recorrido: r.id, paso: 0 })}>
            <b>{r.emoji} {r.titulo}</b>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{r.desc} · {r.pasos.length} pasos</div>
          </button>
        ))}
        <p style={{ ...s.nota, marginTop: 10 }}>{nota}</p>
      </div>
    );
  }

  const paso = rec.pasos[pos.paso];
  const clave = `${rec.id}:${pos.paso}`;
  const ir = (n) => setPos({ recorrido: rec.id, paso: Math.max(0, Math.min(rec.pasos.length - 1, n)) });
  const comprobar = () => {
    const aviso = paso.comprobar(codigo || '');
    setResultado(aviso ? { ok: false, texto: aviso } : { ok: true, texto: '¡Muy bien! Este paso está hecho.' });
    if (!aviso) setHechos((h) => ({ ...h, [clave]: true }));
  };
  const verSolucion = () => {
    if (!window.confirm('Se cambiarán los bloques que tienes por la solución de este paso. ¿Seguir?')) return;
    cargar(paso.solucion);
    setResultado({ ok: true, texto: 'Esta es una forma de hacerlo. Mira bien cada bloque antes de seguir.' });
  };

  return (
    <div style={s.panel}>
      <button style={{ ...s.btn('#334155'), marginBottom: 8 }} onClick={() => setPos(null)}>{volver}</button>
      <h3 style={s.titulo}>{rec.emoji} {rec.titulo}</h3>
      <div style={s.barra}>
        {rec.pasos.map((_, i) => (
          <span key={i} title={`Paso ${i + 1}`} style={s.punto(i === pos.paso ? 'actual' : hechos[`${rec.id}:${i}`] ? 'hecho' : '', color)} />
        ))}
      </div>
      <div style={{ color, fontWeight: 800, fontSize: 12 }}>PASO {pos.paso + 1} DE {rec.pasos.length}</div>
      <h4 style={{ ...s.titulo, fontSize: 14 }}>{paso.titulo}</h4>
      <ol style={s.lista}>{paso.texto.map((t, i) => <li key={i}>{t}</li>)}</ol>
      {paso.bloques?.length > 0 && (
        <div style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid #334155' }}>
          <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: 12.5, marginBottom: 4 }}>🧩 Bloques de este paso</div>
          {paso.bloques.map(([b, explicacion], i) => (
            <div key={i} style={{ fontSize: 12.5, marginTop: 3 }}><b style={{ color }}>{b}</b>: {explicacion}</div>
          ))}
        </div>
      )}

      {!paso.final ? (
        <div style={s.fila}>
          <button style={s.btn('#16a34a')} onClick={comprobar}>✔ Comprobar</button>
          <button style={s.btn('#475569')} onClick={() => setVerPista((v) => !v)}>💡 Pista</button>
          {paso.solucion && <button style={s.btn('#475569')} onClick={verSolucion}>👀 Ver solución</button>}
        </div>
      ) : (
        <div style={s.fila}>
          <button style={s.btn('#ea580c', conectada)} disabled={!conectada} onClick={onGuardar}
            title={conectada ? '' : avisoGuardar}>{textoGuardar}</button>
        </div>
      )}
      {verPista && paso.pista && <div style={s.aviso(false)}>💡 {paso.pista}</div>}
      {resultado && <div style={s.aviso(resultado.ok)}>{resultado.ok ? '✅ ' : '⚠️ '}{resultado.texto}</div>}

      <div style={{ ...s.fila, marginTop: 14, justifyContent: 'space-between' }}>
        <button style={s.btn('#334155', pos.paso > 0)} disabled={pos.paso === 0} onClick={() => ir(pos.paso - 1)}>← Anterior</button>
        {pos.paso < rec.pasos.length - 1 && (
          <button style={s.btn(hechos[clave] ? color : '#334155')} onClick={() => ir(pos.paso + 1)}>Siguiente →</button>
        )}
      </div>
    </div>
  );
}
