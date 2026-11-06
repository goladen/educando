// ⏱️ Competición de tiempo de reacción: varios jugadores, 5 intentos válidos cada uno y comparación
// final con media, desviación típica, rango y mejor marca, un diagrama de puntos y el cálculo paso a
// paso de la desviación típica. Formas de jugar:
//   · 💻 Ordenador (por turnos): la pantalla se pone verde → clic, toque o barra espaciadora.
//   · 🔌 Placa del Laboratorio (por turnos): prop `placa` = { disponible, medir(): Promise<ms> }.
//   · 🟩 micro:bit por USB (por turnos): se enciende toda su pantalla y se pulsa A; mide la propia placa.
//   · 🎮 Mandos micro:bit (todos a la vez): cada jugador con su mando; la pantalla se pone verde y
//     todos pulsan A. Quien se adelanta o no pulsa repite en una ronda extra.
// Lo de micro:bit se carga bajo demanda (conexionKit / mandosMicrobit) para no pesar en Estadística.
// Lo usan Math World → Estadística y el Laboratorio de la Imagina TdR STEAM.
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

const ChipAntena = lazy(() => import('../mandos/ChipAntena.jsx'));

export const INTENTOS = 5;
const COLORES = ['#f59e0b', '#38bdf8', '#a78bfa', '#22c55e', '#fb7185', '#facc15', '#2dd4bf', '#f97316', '#e879f9', '#84cc16', '#60a5fa', '#f472b6'];

const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const desv = (v) => { const m = media(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
const n0 = (x) => Math.round(x).toLocaleString('es-ES');
const n1 = (x) => x.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nuevoJugador = (js, extra = {}) => {
  const id = js.length ? Math.max(...js.map((x) => x.id)) + 1 : 0;
  return { id, nombre: `Jugador ${js.length + 1}`, color: COLORES[js.length % COLORES.length], tiempos: [], ...extra };
};

function resumen(j) {
  const v = j.tiempos;
  if (!v.length) return null;
  return { media: media(v), desv: desv(v), min: Math.min(...v), max: Math.max(...v), rango: Math.max(...v) - Math.min(...v) };
}

/** Diagrama de puntos: una fila por jugador con sus tiempos, la media (|) y el rango (barra). */
function DiagramaPuntos({ jugadores }) {
  const todos = jugadores.flatMap((j) => j.tiempos);
  if (!todos.length) return null;
  const lo = Math.max(0, Math.floor((Math.min(...todos) - 30) / 50) * 50), hi = Math.ceil((Math.max(...todos) + 30) / 50) * 50;
  const W = 600, fila = 34, ml = 96, mr = 14, H = jugadores.length * fila + 34;
  const X = (t) => ml + ((t - lo) / (hi - lo || 1)) * (W - ml - mr);
  const marcas = [];
  const paso = (hi - lo) > 600 ? 200 : (hi - lo) > 300 ? 100 : 50;
  for (let t = Math.ceil(lo / paso) * paso; t <= hi; t += paso) marcas.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'rgba(0,0,0,.25)', borderRadius: 12 }} role="img" aria-label="Diagrama de puntos de los tiempos de cada jugador">
      {marcas.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={6} y2={H - 26} stroke="rgba(255,255,255,.08)" />
          <text x={X(t)} y={H - 10} fill="#94a3b8" fontSize="11" textAnchor="middle">{t} ms</text>
        </g>
      ))}
      {jugadores.map((j, i) => {
        const r = resumen(j);
        const y = 10 + i * fila + fila / 2;
        return (
          <g key={j.id}>
            <text x={ml - 8} y={y + 4} fill={j.color} fontSize="12" fontWeight="700" textAnchor="end">{j.nombre.slice(0, 12)}</text>
            {r && <line x1={X(r.min)} x2={X(r.max)} y1={y} y2={y} stroke={j.color} strokeOpacity=".35" strokeWidth="8" strokeLinecap="round" />}
            {j.tiempos.map((t, k) => <circle key={k} cx={X(t)} cy={y} r="5" fill={j.color} stroke="#0f172a" strokeWidth="1.5" />)}
            {r && <line x1={X(r.media)} x2={X(r.media)} y1={y - 11} y2={y + 11} stroke="#f8fafc" strokeWidth="2.5" />}
          </g>
        );
      })}
    </svg>
  );
}

/** micro:bit por USB con el programa del Laboratorio (conexionKit, cargado bajo demanda). */
function useMicrobitUsb(activo) {
  const [estado, setEstado] = useState({ conectada: false, ocupado: false, error: '', pct: null });
  const kit = useRef(null);
  const cargar = async () => {
    if (!kit.current) {
      const [k, p] = await Promise.all([import('../keyestudio/conexionKit'), import('../keyestudio/placasKit')]);
      kit.current = { ...k, pines: p.leerConfig().pines.microbit };
    }
    return kit.current;
  };
  useEffect(() => () => { kit.current?.desconectar(); }, []);
  useEffect(() => { if (!activo && estado.conectada) { kit.current?.desconectar(); setEstado((e) => ({ ...e, conectada: false })); } }, [activo]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ...estado,
    conectar: async () => {
      setEstado({ conectada: false, ocupado: true, error: '', pct: null });
      try { const k = await cargar(); await k.conectarPlaca({ placa: 'microbit', pines: k.pines }); setEstado({ conectada: true, ocupado: false, error: '', pct: null }); }
      catch (e) { setEstado({ conectada: false, ocupado: false, error: e.message || String(e), pct: null }); }
    },
    instalar: async () => {
      setEstado({ conectada: false, ocupado: true, error: '', pct: 0 });
      try { const k = await cargar(); await k.instalarMicropythonMicrobit((pct) => setEstado((e) => ({ ...e, pct }))); setEstado({ conectada: false, ocupado: false, error: '', pct: null }); }
      catch (e) { setEstado({ conectada: false, ocupado: false, error: e.message || String(e), pct: null }); }
    },
    medir: () => kit.current.medirReaccion(),
  };
}

/** Mandos micro:bit por la antena (mandosMicrobit, cargado bajo demanda) en modo F: «A» llega al momento. */
function useMandos(activo, alPulsarA) {
  const [antena, setAntena] = useState(false);
  const fn = useRef(alPulsarA);
  fn.current = alPulsarA;
  useEffect(() => {
    if (!activo) return undefined;
    let quitar = [], vivo = true;
    import('../mandos/mandosMicrobit.js').then((m) => {
      if (!vivo) return;
      m.setModoMandos(m.MODOS.FUTBOL);
      quitar = [
        m.escucharEstadoAntena((e) => setAntena(!!e.conectada)),
        m.escucharMandos((ev) => { if (ev.tipo === 'futbol' && ev.accion === 'A' && ev.on) fn.current(ev.id, performance.now()); }),
      ];
    });
    return () => { vivo = false; quitar.forEach((q) => q?.()); };
  }, [activo]);
  return { antena };
}

export default function ReaccionJugadores({ placa = null, onClose = null }) {
  const [jugadores, setJugadores] = useState(() => [nuevoJugador([]), nuevoJugador([nuevoJugador([])])]);
  const [empezado, setEmpezado] = useState(false);
  const [modo, setModo] = useState(placa?.disponible ? 'placa' : 'ordenador'); // ordenador · placa · microbit · mandos
  const [fase, setFase] = useState('listo'); // listo · espera · ya · hecho · adelanto · tarde
  const [ultimo, setUltimo] = useState(null);
  const [ronda, setRonda] = useState({}); // mandos: { [jugadorId]: ms | 'adelanto' | 'tarde' } de la ronda en curso
  const [detalle, setDetalle] = useState(0);
  const t0 = useRef(0), timer = useRef(null), vivo = useRef(true), rondaRef = useRef({}), faseRef = useRef('listo');
  faseRef.current = fase;
  useEffect(() => () => { vivo.current = false; clearTimeout(timer.current); }, []);
  useEffect(() => { if (modo === 'placa' && !placa?.disponible) setModo('ordenador'); }, [placa?.disponible]); // eslint-disable-line react-hooks/exhaustive-deps

  const mb = useMicrobitUsb(modo === 'microbit');
  const enMandos = modo === 'mandos';
  const pendientes = jugadores.filter((j) => j.tiempos.length < INTENTOS);
  const terminado = empezado && !pendientes.length;

  // ── Mandos: apuntarse antes de empezar y pulsaciones durante la ronda ──
  const { antena } = useMandos(enMandos, (mando, ahora) => {
    if (!empezado) {
      // Apuntarse: el primer «A» de cada mando crea su jugador
      setJugadores((js) => (js.some((j) => j.mando === mando) ? js : [...js, nuevoJugador(js, { nombre: `Mando ${mando}`, mando })]));
      return;
    }
    const j = jugadores.find((x) => x.mando === mando && x.tiempos.length < INTENTOS);
    if (!j || rondaRef.current[j.id] != null) return;
    if (faseRef.current === 'espera') rondaRef.current = { ...rondaRef.current, [j.id]: 'adelanto' };
    else if (faseRef.current === 'ya') rondaRef.current = { ...rondaRef.current, [j.id]: Math.max(1, Math.round(ahora - t0.current)) };
    else return;
    setRonda(rondaRef.current);
    if (faseRef.current === 'ya' && pendientes.every((p) => rondaRef.current[p.id] != null)) cerrarRonda();
  });

  const cerrarRonda = () => {
    clearTimeout(timer.current);
    const res = { ...rondaRef.current };
    pendientes.forEach((p) => { if (res[p.id] == null) res[p.id] = 'tarde'; });
    rondaRef.current = res; setRonda(res);
    setJugadores((js) => js.map((j) => (typeof res[j.id] === 'number' ? { ...j, tiempos: [...j.tiempos, res[j.id]] } : j)));
    setFase('hecho');
  };

  // ── Por turnos (ordenador, placa, micro:bit USB): el primer jugador con menos intentos ──
  const turno = enMandos || !pendientes.length ? null : pendientes.reduce((a, b) => (b.tiempos.length < a.tiempos.length ? b : a));
  const medidor = modo === 'placa' ? placa : modo === 'microbit' ? mb : null;

  const anotar = (ms) => {
    setUltimo(ms);
    setJugadores((js) => js.map((j) => (j.id === turno.id ? { ...j, tiempos: [...j.tiempos, ms] } : j)));
    setFase('hecho');
  };

  const salir = async () => {
    if (!pendientes.length) return;
    if (enMandos) { rondaRef.current = {}; setRonda({}); }
    if (medidor) {
      setFase('espera');
      const ms = await medidor.medir();
      if (!vivo.current) return;
      if (ms === -1) setFase('adelanto');
      else if (ms === -2) setFase('tarde');
      else anotar(ms);
      return;
    }
    setFase('espera');
    timer.current = setTimeout(() => {
      setFase('ya');
      requestAnimationFrame(() => { t0.current = performance.now(); });
      timer.current = setTimeout(() => (enMandos ? cerrarRonda() : setFase((f) => (f === 'ya' ? 'tarde' : f))), 3000);
    }, 1500 + Math.random() * 2500);
  };

  // Pulsación en la pantalla (clic, toque o tecla); timeStamp del evento: misma base que performance.now()
  const pulsar = (ts) => {
    const puedeSalir = ['listo', 'hecho', 'adelanto', 'tarde'].includes(fase) && pendientes.length;
    if (medidor || enMandos) { if (puedeSalir) salir(); return; } // se pulsa en la placa o en los mandos
    if (fase === 'espera') { clearTimeout(timer.current); setFase('adelanto'); }
    else if (fase === 'ya') { clearTimeout(timer.current); anotar(Math.max(1, Math.round((ts || performance.now()) - t0.current))); }
    else if (puedeSalir) salir();
  };
  useEffect(() => {
    if (!empezado || terminado) return undefined;
    const fn = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) pulsar(e.timeStamp); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  const reiniciar = (mismos = true) => {
    clearTimeout(timer.current);
    setJugadores((js) => js.map((j) => ({ ...j, tiempos: [] })));
    setFase('listo'); setUltimo(null); rondaRef.current = {}; setRonda({});
    if (!mismos) setEmpezado(false);
  };

  const ranking = [...jugadores].filter((j) => j.tiempos.length).map((j) => ({ ...j, r: resumen(j) })).sort((a, b) => a.r.media - b.r.media);
  const masRegular = ranking.length ? ranking.reduce((a, b) => (b.r.desv < a.r.desv ? b : a)) : null;
  const jd = jugadores[detalle] || jugadores[0];
  const listoParaEmpezar = jugadores.length > 0 && (modo !== 'microbit' || mb.conectada) && (!enMandos || (antena && jugadores.every((j) => j.mando != null)));

  const exportar = () => {
    const filas = [['Jugador', ...Array.from({ length: INTENTOS }, (_, i) => `Intento ${i + 1} (ms)`), 'Media', 'Desviación típica', 'Rango', 'Mejor']];
    jugadores.forEach((j) => { const r = resumen(j); filas.push([j.nombre, ...Array.from({ length: INTENTOS }, (_, i) => j.tiempos[i] ?? ''), r ? n1(r.media) : '', r ? n1(r.desv) : '', r ? r.rango : '', r ? r.min : '']); });
    const txt = filas.map((f) => f.map((c) => `"${String(c)}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'tiempos-de-reaccion.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const dondePulsar = modo === 'placa' ? 'Mira el LED rojo de la placa y pulsa el botón SW1 cuando se encienda'
    : modo === 'microbit' ? 'Mira la micro:bit: cuando se encienda toda su pantalla, pulsa el botón A'
      : enMandos ? 'Todos a la vez: pulsad A en vuestro mando cuando se ponga verde' : 'Pulsa cuando se ponga verde (¡no antes!)';
  const siguiente = enMandos ? `Ronda para ${pendientes.length} jugador${pendientes.length === 1 ? '' : 'es'} · pulsa para empezar` : turno ? `Siguiente: ${turno.nombre} · pulsa para seguir` : '¡Terminado!';
  const zona = {
    listo: ['#1e293b', enMandos ? '🎮 ¡Preparados!' : turno ? `Turno de ${turno.nombre}` : '', enMandos ? siguiente : `Intento ${(turno?.tiempos.length || 0) + 1} de ${INTENTOS} · pulsa para empezar`],
    espera: ['#7f1d1d', 'Espera…', dondePulsar],
    ya: ['#15803d', '¡YA!', enMandos ? `${Object.keys(ronda).length} de ${pendientes.length} han pulsado` : ''],
    hecho: ['#1e293b', enMandos ? 'Ronda terminada' : ultimo != null ? `${n0(ultimo)} ms` : '', siguiente],
    adelanto: ['#78350f', '⚡ ¡Te has adelantado!', 'No cuenta. Pulsa para repetir el intento'],
    tarde: ['#334155', '⏰ Demasiado tarde', 'No cuenta. Pulsa para repetir el intento'],
  }[fase];

  const FORMAS = [
    ['ordenador', '💻 Solo con el ordenador', true],
    ...(placa ? [['placa', `🔌 Con la placa (LED + botón)${!placa.disponible ? ' · conéctala antes' : ''}`, placa.disponible]] : []),
    ...(!placa ? [['microbit', '🟩 Una micro:bit por USB (por turnos)', true]] : []),
    ['mandos', '🎮 Mandos micro:bit (todos a la vez)', true],
  ];

  return (
    <div style={S.raiz}>
      <div style={S.cab}>
        <b style={{ fontSize: 18 }}>⏱️ Tiempo de reacción · competición</b>
        {onClose && <button style={S.mini} onClick={onClose}>✕ Cerrar</button>}
      </div>

      {!empezado && (
        <div style={S.caja}>
          <b>¿Cómo se juega?</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {FORMAS.map(([id, n, ok]) => <button key={id} style={S.chip(modo === id)} disabled={!ok} onClick={() => { setModo(id); if (id === 'mandos') setJugadores((js) => js.filter((j) => j.mando != null)); else setJugadores((js) => (js.length ? js.map(({ mando, ...j }) => j) : [nuevoJugador([]), nuevoJugador([nuevoJugador([])])])); }}>{n}</button>)}
          </div>
          <div style={S.nota}>
            {modo === 'ordenador' && 'La zona grande se pone verde tras una espera al azar: pulsa con el ratón, el dedo o la barra espaciadora. El navegador mide con una precisión de unos pocos milisegundos (depende de la pantalla). Se juega por turnos.'}
            {modo === 'placa' && 'La placa enciende su LED rojo tras una espera al azar y mide, al milisegundo, cuánto se tarda en pulsar SW1. Se juega por turnos.'}
            {modo === 'microbit' && 'Se pasa la micro:bit de mano en mano: tras una espera al azar se enciende toda su pantalla y la propia micro:bit mide, al milisegundo, cuánto se tarda en pulsar A.'}
            {enMandos && 'Cada jugador con su mando micro:bit (los de «Programación y robótica → 🎮 Mandos micro:bit»). La pantalla se pone verde y todos pulsan A a la vez: ¡carrera de verdad! La radio añade unos milisegundos, iguales para todos. Quien se adelanta o no pulsa repite en otra ronda.'}
          </div>

          {modo === 'microbit' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {mb.conectada ? <span style={{ ...S.nota, color: '#86efac', marginTop: 0 }}>✅ micro:bit conectada</span>
                  : <button style={S.btn('#16a34a')} disabled={mb.ocupado} onClick={mb.conectar}>🔌 Conectar la micro:bit</button>}
                <button style={S.mini} disabled={mb.ocupado} onClick={mb.instalar}>⚡ Instalar MicroPython</button>
              </div>
              {mb.pct != null && <div style={{ height: 8, borderRadius: 99, background: '#1e293b', overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${mb.pct}%`, height: '100%', background: '#f59e0b' }} /></div>}
              {mb.error && <div style={S.aviso}>⚠️ {mb.error}</div>}
              <div style={S.nota}>Necesita Chrome o Edge. La primera vez (o si venía de MakeCode) pulsa «⚡ Instalar MicroPython» y después «Conectar».</div>
            </div>
          )}

          {enMandos && (
            <div style={{ marginTop: 8 }}>
              <Suspense fallback={null}><ChipAntena /></Suspense>
              {antena && <div style={{ ...S.nota, color: '#86efac' }}>📡 Antena conectada. <b>Pulsa A en tu mando para apuntarte</b> a la competición.</div>}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <b>👥 Jugadores</b> <span style={S.nota}>· {INTENTOS} intentos válidos cada uno{enMandos ? ', todos a la vez' : ', por turnos'}</span>
            {enMandos && !jugadores.length && <div style={S.nota}>Todavía nadie: que cada jugador pulse A en su mando.</div>}
            {jugadores.map((j) => (
              <div key={j.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: 99, background: j.color, flexShrink: 0 }} />
                {j.mando != null && <span style={{ ...S.nota, marginTop: 0, whiteSpace: 'nowrap' }}>🎮 {j.mando}</span>}
                <input style={S.input} value={j.nombre} maxLength={20} onChange={(e) => setJugadores((js) => js.map((x) => (x.id === j.id ? { ...x, nombre: e.target.value } : x)))} />
                {(jugadores.length > 1 || enMandos) && <button style={S.mini} onClick={() => setJugadores((js) => js.filter((x) => x.id !== j.id))} aria-label={`Quitar a ${j.nombre}`}>✕</button>}
              </div>
            ))}
            {!enMandos && jugadores.length < COLORES.length && (
              <button style={{ ...S.mini, marginTop: 8 }} onClick={() => setJugadores((js) => [...js, nuevoJugador(js)])}>➕ Añadir jugador</button>
            )}
          </div>
          <button style={{ ...S.btn('#16a34a'), marginTop: 12 }} disabled={!listoParaEmpezar} onClick={() => { reiniciar(); setEmpezado(true); }}>▶️ Empezar la competición</button>
        </div>
      )}

      {empezado && !terminado && (
        <>
          <button style={{ ...S.zona, background: zona[0] }} onPointerDown={(e) => { e.preventDefault(); pulsar(e.timeStamp); }} aria-live="polite">
            <span style={{ fontSize: 'clamp(30px, 6vw, 64px)', fontWeight: 900, color: fase === 'listo' && turno ? turno.color : '#f8fafc' }}>{zona[1]}</span>
            <span style={{ fontSize: 16, color: '#e2e8f0', marginTop: 8 }}>{zona[2]}</span>
          </button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {jugadores.map((j) => {
              const r = ronda[j.id];
              return (
                <div key={j.id} style={{ ...S.caja, padding: '6px 10px', borderColor: turno?.id === j.id || (enMandos && r != null) ? j.color : 'rgba(255,255,255,.14)' }}>
                  <b style={{ color: j.color }}>{j.nombre}</b> <span style={S.nota}>{j.tiempos.length}/{INTENTOS}</span>
                  {enMandos && r != null && <span style={{ marginLeft: 6, fontWeight: 800 }}>{r === 'adelanto' ? '⚡' : r === 'tarde' ? '⏰' : `${n0(r)} ms`}</span>}
                  <div style={{ fontSize: 12.5, color: '#cbd5e1' }}>{j.tiempos.map((t) => n0(t)).join(' · ') || '—'}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {empezado && ranking.length > 0 && (
        <div style={S.caja}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>{terminado ? '🏆 Resultados' : '📊 Resultados provisionales'}</b>
            <span style={{ display: 'flex', gap: 6 }}>
              <button style={S.mini} onClick={exportar}>⬇️ CSV</button>
              {terminado && <button style={S.mini} onClick={() => reiniciar(true)}>🔁 Revancha</button>}
              <button style={S.mini} onClick={() => reiniciar(false)}>👥 Cambiar jugadores</button>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.tabla}>
              <thead>
                <tr>{['#', 'Jugador', ...Array.from({ length: INTENTOS }, (_, i) => `${i + 1}.º`), 'Media x̄', 'Desv. típica σ', 'Rango', 'Mejor'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {ranking.map((j, i) => (
                  <tr key={j.id} style={{ background: terminado && i === 0 ? 'rgba(250,204,21,.12)' : 'transparent' }}>
                    <td style={S.td}>{terminado && i === 0 ? '🥇' : terminado && i === 1 ? '🥈' : terminado && i === 2 ? '🥉' : i + 1}</td>
                    <td style={{ ...S.td, color: j.color, fontWeight: 800 }}>{j.nombre}</td>
                    {Array.from({ length: INTENTOS }, (_, k) => <td key={k} style={{ ...S.td, color: j.tiempos[k] === j.r.min ? '#86efac' : j.tiempos[k] === j.r.max ? '#fca5a5' : undefined }}>{j.tiempos[k] != null ? n0(j.tiempos[k]) : '·'}</td>)}
                    <td style={{ ...S.td, fontWeight: 800 }}>{n1(j.r.media)}</td>
                    <td style={S.td}>{n1(j.r.desv)}</td>
                    <td style={S.td}>{n0(j.r.rango)}</td>
                    <td style={S.td}>{n0(j.r.min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.nota}>Tiempos en milisegundos. En verde el mejor intento de cada jugador y en rojo el peor. Rango = máximo − mínimo.</div>
          <div style={{ marginTop: 10 }}><DiagramaPuntos jugadores={jugadores} /></div>
          <div style={S.nota}>Cada punto es un intento; la raya blanca es la media y la barra, el rango. Cuanto más juntos están los puntos, menor es la desviación típica.</div>
          {terminado && ranking.length > 1 && (
            <div style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6 }}>
              🏆 <b style={{ color: ranking[0].color }}>{ranking[0].nombre}</b> es el más rápido de media ({n1(ranking[0].r.media)} ms).<br />
              🎯 <b style={{ color: masRegular.color }}>{masRegular.nombre}</b> es el más regular: tiene la menor desviación típica ({n1(masRegular.r.desv)} ms).
              <div style={S.nota}>Para pensar: ¿gana siempre el que tiene el mejor intento? ¿Por qué la media es más justa? ¿Qué jugador mejoró del 1.º al 5.º intento?</div>
            </div>
          )}
        </div>
      )}

      {empezado && jd?.tiempos.length > 1 && (
        <div style={S.caja}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>🧮 Cálculo paso a paso de</b>
            {jugadores.filter((j) => j.tiempos.length > 1).map((j) => <button key={j.id} style={{ ...S.chip(jd.id === j.id), borderColor: j.color }} onClick={() => setDetalle(jugadores.indexOf(j))}>{j.nombre}</button>)}
          </div>
          {(() => {
            const r = resumen(jd), v = jd.tiempos;
            return (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={S.tabla}>
                  <thead><tr>{['Intento', 'xᵢ (ms)', 'xᵢ − x̄', '(xᵢ − x̄)²'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {v.map((x, i) => <tr key={i}><td style={S.td}>{i + 1}</td><td style={S.td}>{n0(x)}</td><td style={S.td}>{n1(x - r.media)}</td><td style={S.td}>{n1((x - r.media) ** 2)}</td></tr>)}
                    <tr><td style={S.td}><b>Suma</b></td><td style={S.td}><b>{n0(v.reduce((a, b) => a + b, 0))}</b></td><td style={S.td}>0</td><td style={S.td}><b>{n1(v.reduce((a, b) => a + (b - r.media) ** 2, 0))}</b></td></tr>
                  </tbody>
                </table>
                <div style={S.formula}>x̄ = Σxᵢ / n = {n0(v.reduce((a, b) => a + b, 0))} / {v.length} = {n1(r.media)} ms</div>
                <div style={S.formula}>σ = √( Σ(xᵢ − x̄)² / n ) = √( {n1(v.reduce((a, b) => a + (b - r.media) ** 2, 0))} / {v.length} ) = {n1(r.desv)} ms</div>
                <div style={S.formula}>rango = {n0(r.max)} − {n0(r.min)} = {n0(r.rango)} ms</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const S = {
  raiz: { display: 'flex', flexDirection: 'column', gap: 12, color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', maxWidth: 980, margin: '0 auto', width: '100%' },
  cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  caja: { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 1.45 },
  zona: { minHeight: 'min(46vh, 380px)', border: 'none', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f8fafc', fontFamily: 'inherit', touchAction: 'manipulation', userSelect: 'none', padding: 16, textAlign: 'center' },
  input: { flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 8, border: '1px solid #475569', background: '#020617', color: '#f1f5f9', fontSize: 14, fontFamily: 'inherit' },
  mini: { padding: '6px 10px', borderRadius: 8, border: 'none', background: '#334155', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btn: (c) => ({ padding: '11px 18px', borderRadius: 10, border: 'none', background: c, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }),
  chip: (on) => ({ padding: '6px 11px', borderRadius: 999, border: `1px solid ${on ? '#facc15' : '#475569'}`, background: on ? 'rgba(250,204,21,.15)' : 'transparent', color: '#f1f5f9', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }),
  nota: { color: '#94a3b8', fontSize: 12.5, marginTop: 6, lineHeight: 1.45 },
  aviso: { background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.45)', color: '#fde68a', borderRadius: 10, padding: '7px 10px', fontSize: 13, marginTop: 6 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, marginTop: 8, fontVariantNumeric: 'tabular-nums' },
  th: { padding: '5px 7px', borderBottom: '1px solid rgba(255,255,255,.25)', textAlign: 'left', color: '#cbd5e1', whiteSpace: 'nowrap' },
  td: { padding: '5px 7px', borderBottom: '1px solid rgba(255,255,255,.1)', whiteSpace: 'nowrap' },
  formula: { fontFamily: 'ui-monospace, Consolas, monospace', background: 'rgba(0,0,0,.35)', borderRadius: 8, padding: '6px 8px', margin: '6px 0 0', fontSize: 13, overflowX: 'auto', whiteSpace: 'nowrap' },
};
