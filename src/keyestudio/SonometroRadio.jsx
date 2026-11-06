// 📡 Sonómetro con varias micro:bit por radio (fuente de SonometroAula.jsx): cada placa (multifunción,
// programasLab.js) mide el ruido de su mesa o grupo y lo manda por la antena de los mandos; aquí cada
// una tiene su barra y su semáforo, y su propia placa enseña una cara (feliz / regular / enfadada).
// Mientras está abierto, todas las placas del canal pasan a instrumento en modo sonómetro (ROL:*:I +
// I:M:SN, con la antena en MODO:X); al salir vuelven solas a mando.
import React, { useEffect, useRef, useState } from 'react';
import ChipAntena from '../mandos/ChipAntena.jsx';
import { enviarAMandos, escucharEstadoAntena, setModoMandos, MODO_LABORATORIO, MODOS } from '../mandos/mandosMicrobit.js';
import { useInstrumentos, useModoInstrumento } from '../labMicrobit/useInstrumentos';
import { st } from '../labMicrobit/estilosLab';
import BurbujasRuido from './BurbujasRuido';

const CSS = { verde: '#22c55e', ambar: '#f59e0b', rojo: '#ef4444' };
const MENSAJE = { verde: '¡Muy bien!', ambar: 'Bajad un poco la voz', rojo: '¡Silencio!' };
const LS = 'pikt_sonometro_radio'; // { u1, u2, pitar, burbujas, nombres: { id: 'Mesa 1' } }
const SIN_SENAL_MS = 6000;

const leer = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } };
const guardar = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* nada */ } };

function Semaforo({ zona, tam = 26 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: tam / 3.5 }}>
      {['verde', 'ambar', 'rojo'].map((c) => (
        <span key={c} style={{ width: tam, height: tam, borderRadius: 99, background: zona === c ? CSS[c] : '#1e293b', boxShadow: zona === c ? `0 0 ${tam / 2}px ${CSS[c]}` : 'none', border: '2px solid #334155' }} />
      ))}
    </div>
  );
}

export default function SonometroRadio({ cabecera = null }) {
  const guardado = useRef(leer()).current;
  const [u1, setU1] = useState(guardado.v === 2 ? guardado.u1 ?? 25 : 25);
  // v2: el rojo por defecto pasa de 50 a 70 %; los umbrales guardados antes (sin v) se ignoran
  const [u2, setU2] = useState(guardado.v === 2 ? guardado.u2 ?? 70 : 70);
  const [pitar, setPitar] = useState(guardado.pitar ?? true);
  const [burbujas, setBurbujas] = useState(guardado.burbujas ?? true);
  const [nombres, setNombres] = useState(guardado.nombres || {});
  const [placas, setPlacas] = useState({}); // id → { nivel (EMA %), pico, t, verde, total }
  const [proyectar, setProyectar] = useState(false);
  const [antena, setAntena] = useState({ antenaOk: false, instrumentos: false });
  const [, tic] = useState(0);
  const zonas = useRef({}); // id → { zona, rojoDesde, enviado }
  const radio = antena.antenaOk && antena.instrumentos;

  useEffect(() => guardar({ v: 2, u1, u2, pitar, burbujas, nombres }), [u1, u2, pitar, burbujas, nombres]);
  useEffect(() => escucharEstadoAntena(setAntena), []);
  useEffect(() => { const t = setInterval(() => tic((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  // Todas las placas a instrumento-sonómetro mientras esto está abierto
  useEffect(() => {
    setModoMandos(MODO_LABORATORIO);
    return () => setModoMandos(MODOS.LETRAS);
  }, []);
  useEffect(() => {
    if (!radio) return undefined;
    enviarAMandos('ROL:*:I');
    const t = setInterval(() => enviarAMandos('ROL:*:I'), 8000); // las que se encienden tarde
    return () => clearInterval(t);
  }, [radio]);
  useModoInstrumento(radio ? 'SN' : null);

  const zonaDe = (x) => (x < u1 ? 'verde' : x < u2 ? 'ambar' : 'rojo');

  useInstrumentos((ev) => {
    if (ev.tipo !== 'E') return;
    const id = String(ev.id);
    const x = Math.max(0, Math.min(100, (ev.sonido / 255) * 100));
    setPlacas((ps) => {
      const p = ps[id] || { nivel: x, pico: 0, verde: 0, total: 0 };
      const nivel = p.nivel * 0.6 + x * 0.4;
      const z = zonaDe(nivel);
      return { ...ps, [id]: { nivel, pico: Math.max(p.pico, x), t: ev.t, verde: p.verde + (z === 'verde' ? 1 : 0), total: p.total + 1 } };
    });
  });

  // Semáforo de cada placa en sus LED: se manda al cambiar de color (y se repite cada 5 s)
  useEffect(() => {
    const ahora = Date.now();
    Object.entries(placas).forEach(([id, p]) => {
      if (ahora - p.t > SIN_SENAL_MS) return;
      const z = zonaDe(p.nivel);
      const e = zonas.current[id] || (zonas.current[id] = { zona: '', rojoDesde: 0, enviado: 0 });
      let n = z === 'verde' ? 0 : z === 'ambar' ? 1 : 2;
      if (z === 'rojo') {
        if (!e.rojoDesde) e.rojoDesde = ahora;
        else if (pitar && ahora - e.rojoDesde > 2000) { n = 3; e.rojoDesde = ahora; }
      } else e.rojoDesde = 0;
      if (z !== e.zona || n === 3 || ahora - e.enviado > 5000) {
        enviarAMandos(`I:Z:${id}:${n}`);
        e.zona = z; e.enviado = ahora;
      }
    });
  }, [placas]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = Object.keys(placas).sort((a, b) => Number(a) - Number(b));
  const vivas = ids.filter((id) => Date.now() - placas[id].t < SIN_SENAL_MS);
  const nombre = (id) => nombres[id] || `Placa ${id}`;
  const reiniciar = () => setPlacas((ps) => Object.fromEntries(Object.entries(ps).map(([id, p]) => [id, { ...p, pico: 0, verde: 0, total: 0 }])));
  const mejor = vivas.filter((id) => placas[id].total > 20).sort((a, b) => placas[b].verde / placas[b].total - placas[a].verde / placas[a].total)[0];

  const tarjeta = (id, grande) => {
    const p = placas[id];
    const viva = Date.now() - p.t < SIN_SENAL_MS;
    const z = zonaDe(p.nivel);
    return (
      <div key={id} style={{ ...st.caja, textAlign: 'center', opacity: viva ? 1 : 0.45, borderColor: viva ? CSS[z] : undefined, padding: grande ? 18 : 12 }}>
        {grande
          ? <div style={{ fontWeight: 900, fontSize: 'clamp(18px, 3vw, 30px)' }}>{nombre(id)}</div>
          : <input value={nombres[id] ?? ''} placeholder={`Placa ${id}`} onChange={(e) => setNombres((n) => ({ ...n, [id]: e.target.value.slice(0, 20) }))} style={{ ...st.input, width: '100%', textAlign: 'center', fontWeight: 800 }} />}
        {burbujas && <div style={{ marginTop: 10 }}><BurbujasRuido nivel={viva ? p.nivel : 0} color={viva ? CSS[z] : '#64748b'} alto={grande ? 190 : 80} /></div>}
        <div style={{ margin: grande ? '14px 0' : '10px 0' }}><Semaforo zona={viva ? z : ''} tam={grande ? 44 : 26} /></div>
        <div style={{ height: 10, borderRadius: 99, background: '#1e293b', overflow: 'hidden' }}>
          <div style={{ width: `${p.nivel}%`, height: '100%', background: CSS[z], transition: 'width .3s' }} />
        </div>
        <div style={{ ...st.nota, fontSize: grande ? 15 : 12.5 }}>
          {viva ? <>{MENSAJE[z]} · {Math.round(p.nivel)} %</> : 'sin señal'}
          {!grande && p.total > 0 && <> · en verde {Math.round((100 * p.verde) / p.total)} % del tiempo</>}
        </div>
      </div>
    );
  };

  if (proyectar) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#020617', color: '#f1f5f9', padding: 20, overflow: 'auto', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <b style={{ flex: 1, fontSize: 22 }}>🎤 Ruido por grupos</b>
          {mejor && <span style={{ fontSize: 18 }}>🏆 Más silencioso: <b>{nombre(mejor)}</b></span>}
          <button style={st.btn('#334155')} onClick={() => setProyectar(false)}>✕ Cerrar</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {ids.map((id) => tarjeta(id, true))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cabecera}
      <div style={st.caja}>
        <div style={{ ...st.fila, gap: 10 }}>
          <b style={{ flex: 1 }}>📡 Una micro:bit en cada mesa o grupo</b>
          <ChipAntena />
        </div>
        <div style={st.nota}>
          Conecta la antena de los mandos y enciende las micro:bit (las del centro, grabadas con la versión de mando + satélite + instrumento).
          Mientras esto está abierto todas hacen de sonómetro y su semáforo se ve en sus luces con una cara: 🙂 verde, 😐 ámbar, 😠 rojo. En pantalla, las burbujas de cada grupo suben tranquilas en calma y se agitan con el ruido.
          Al salir vuelven solas a ser mandos.
        </div>
        {antena.antenaOk && !antena.instrumentos && <div style={{ ...st.aviso, marginTop: 8 }}>⚠️ Esta antena tiene un programa antiguo: vuelve a grabarla desde el panel de mandos.</div>}
        <div style={{ ...st.fila, marginTop: 10, gap: 14 }}>
          <label style={{ ...st.label, flex: '1 1 180px' }}>🟡 Ámbar desde: {u1} %
            <input type="range" min={5} max={95} value={u1} onChange={(e) => { const v = Number(e.target.value); setU1(v); if (v >= u2) setU2(Math.min(100, v + 5)); }} />
          </label>
          <label style={{ ...st.label, flex: '1 1 180px' }}>🔴 Rojo desde: {u2} %
            <input type="range" min={10} max={100} value={u2} onChange={(e) => { const v = Number(e.target.value); setU2(v); if (v <= u1) setU1(Math.max(0, v - 5)); }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={pitar} onChange={(e) => setPitar(e.target.checked)} /> La placa pita si sigue en rojo
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={burbujas} onChange={(e) => setBurbujas(e.target.checked)} /> 🫧 Burbujas en pantalla
          </label>
        </div>
        <div style={{ ...st.fila, marginTop: 8 }}>
          <button style={st.btn('#7c3aed')} disabled={!ids.length} onClick={() => setProyectar(true)}>📺 Proyectar</button>
          <button style={st.mini} disabled={!ids.length} onClick={reiniciar}>↺ Empezar de nuevo el recuento</button>
          {mejor && <span style={{ fontSize: 13 }}>🏆 Más tiempo en verde: <b>{nombre(mejor)}</b></span>}
        </div>
      </div>

      {!ids.length ? (
        <div style={st.aviso}>
          {radio ? '⏳ Esperando a las placas… Enciéndelas en el mismo canal que la antena. Las grabadas con la versión antigua (solo mando) no aparecen: regrábalas desde el panel de mandos.' : 'Conecta la antena con el botón de arriba.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {ids.map((id) => tarjeta(id, false))}
        </div>
      )}
      <div style={st.nota}>
        Cada placa manda el ruido más fuerte que ha oído en cada momento (el micrófono de la micro:bit V2). Ajusta los umbrales con la clase
        hablando normal: que quede en verde. El nombre de cada placa (Mesa 1, Grupo azul…) se guarda en este ordenador.
      </div>
    </div>
  );
}
