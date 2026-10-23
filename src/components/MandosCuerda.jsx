// Mandos micro:bit en el tirón de cuerda (CompeticionCuerda).
// El profe activa los mandos y los reparte entre los dos equipos. Cada panel de preguntas que
// lo admita se registra con useMandoPregunta(); los mandos de cada equipo VOTAN la respuesta
// (A cambia la letra, B o agitar la envía) y, cuando han votado todos (o pasan SEG_VOTO desde
// el primer voto), gana la letra más votada: se «pulsa» esa opción en el panel, que hace lo de
// siempre (aplicar → la cuerda se mueve). Los equipos sin mandos siguen respondiendo con clic.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  LETRAS, MODOS, setModoMandos, escucharMandos, feedbackMando, simularPulsacion,
} from '../mandos/mandosMicrobit.js';
import { BotonTutorialMandos } from '../mandos/TutorialMandos.jsx';
import ChipAntena from '../mandos/ChipAntena.jsx';

const SEG_VOTO = 8;
const LS_NOMBRES = 'pikt_mandos_nombres';
const COLOR = { 1: '#2563eb', 2: '#dc2626' };

const leerNombres = () => { try { return JSON.parse(localStorage.getItem(LS_NOMBRES) || '{}') || {}; } catch { return {}; } };
const guardarNombre = (id, nombre) => {
  try {
    const n = leerNombres();
    if (nombre.trim()) n[id] = nombre.trim(); else delete n[id];
    localStorage.setItem(LS_NOMBRES, JSON.stringify(n));
  } catch { /* sin almacenamiento */ }
};
const nombrePorDefecto = (id) => (id > 900 ? `Virtual ${id - 900}` : `Mando ${id}`);

const MandosCtx = createContext(null);
/** Equipo (1 o 2) del panel que se está pintando; lo pone CompeticionCuerda. */
export const EquipoCuerdaCtx = createContext(null);

/**
 * Para los paneles de opción múltiple: registra la pregunta actual para que voten los mandos.
 *   clave: identifica la pregunta (cambia con cada pregunta nueva)
 *   n: nº de opciones (solo A-D se pueden votar) · correcta: índice correcto (para la carita del mando)
 *   elegir(i): lo mismo que hace el clic en la opción i · activa: false mientras se corrige o está bloqueado
 * Devuelve { conMandos }: si el equipo juega con mandos, conviene mostrar la letra A-D en cada opción.
 */
export function useMandoPregunta({ clave, n, correcta, elegir, activa = true }) {
  const ctx = useContext(MandosCtx);
  const equipo = useContext(EquipoCuerdaCtx);
  const elegirRef = useRef(elegir);
  elegirRef.current = elegir;
  const conMandos = !!ctx && ctx.activo && !!equipo && ctx.hayMandos(equipo);
  useEffect(() => {
    if (!ctx || !equipo || !activa || !n) return undefined;
    ctx.registrar(equipo, { clave, n: Math.min(4, n), correcta, elegir: (i) => elegirRef.current(i) });
    return () => ctx.quitar(equipo, clave);
  }, [ctx, equipo, clave, n, correcta, activa]);
  return { conMandos };
}

/** Letra A-D para poner delante de cada opción cuando el equipo juega con mandos. */
export function LetraMando({ i }) {
  if (i > 3) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 99, background: '#1e293b', color: '#facc15', fontWeight: 900, fontSize: 13, marginRight: 6, flexShrink: 0 }}>
      {LETRAS[i]}
    </span>
  );
}

/** Estado y lógica de los mandos para una CompeticionCuerda. */
export function useMandosCuerda(bloqueado) {
  const [activo, setActivo] = useState(false);
  const [mandos, setMandos] = useState({}); // id → { id, nombre, equipo: 0 | 1 | 2 }
  const [votos, setVotos] = useState({ 1: {}, 2: {} });
  const preguntas = useRef({ 1: null, 2: null });
  const votosRef = useRef(votos); votosRef.current = votos;
  const mandosRef = useRef(mandos); mandosRef.current = mandos;
  const activoRef = useRef(activo); activoRef.current = activo;
  const bloqueadoRef = useRef(bloqueado); bloqueadoRef.current = bloqueado;
  const relojes = useRef({});

  useEffect(() => { if (activo) setModoMandos(MODOS.LETRAS); }, [activo]);
  useEffect(() => () => Object.values(relojes.current).forEach(clearTimeout), []);

  const miembros = (e) => Object.values(mandosRef.current).filter(m => m.equipo === e);

  const decidir = useCallback((e) => {
    clearTimeout(relojes.current[e]);
    const p = preguntas.current[e];
    const v = votosRef.current[e] || {};
    if (!p || p.decidida || !Object.keys(v).length) return;
    p.decidida = true;
    const cuenta = Array(p.n).fill(0);
    Object.values(v).forEach(l => { const i = LETRAS.indexOf(l); if (i >= 0 && i < p.n) cuenta[i]++; });
    const max = Math.max(...cuenta);
    const empatadas = cuenta.map((c, i) => (c === max ? i : -1)).filter(i => i >= 0);
    const elegida = empatadas[Math.floor(Math.random() * empatadas.length)];
    if (p.correcta != null) Object.entries(v).forEach(([id, l]) => { if (Number(id) < 900) feedbackMando(Number(id), LETRAS.indexOf(l) === p.correcta); });
    p.elegir(elegida);
  }, []);

  // Pulsaciones: unirse (en la lista «sin equipo») y votar
  useEffect(() => escucharMandos(({ id, tipo, letra }) => {
    if (!activoRef.current || tipo !== 'letra') return;
    const m = mandosRef.current[id];
    if (!m) {
      const nuevo = { id, nombre: leerNombres()[id] || nombrePorDefecto(id), equipo: 0 };
      mandosRef.current = { ...mandosRef.current, [id]: nuevo };
      setMandos(x => (x[id] ? x : { ...x, [id]: nuevo }));
      return;
    }
    const e = m.equipo;
    const p = preguntas.current[e];
    if (!e || !p || p.decidida || bloqueadoRef.current) return;
    if (LETRAS.indexOf(letra) >= p.n || votosRef.current[e]?.[id]) return;
    const nuevos = { ...votosRef.current, [e]: { ...votosRef.current[e], [id]: letra } };
    votosRef.current = nuevos;
    setVotos(nuevos);
    const n = Object.keys(nuevos[e]).length;
    if (n >= miembros(e).length) setTimeout(() => decidir(e), 400);
    else if (n === 1) relojes.current[e] = setTimeout(() => decidir(e), SEG_VOTO * 1000);
  }), [decidir]); // eslint-disable-line react-hooks/exhaustive-deps

  // Objeto estable (si cambiara en cada render, los paneles se darían de baja y de alta y se
  // perderían los votos). Lee el estado de los refs; los paneles se repintan con CompeticionCuerda.
  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      get activo() { return activoRef.current; },
      hayMandos: (e) => Object.values(mandosRef.current).some(m => m.equipo === e),
      registrar: (e, datos) => {
        const prev = preguntas.current[e];
        if (prev && prev.clave === datos.clave) { Object.assign(prev, datos, { decidida: prev.decidida }); return; }
        clearTimeout(relojes.current[e]);
        preguntas.current[e] = { ...datos, decidida: false };
        const nuevos = { ...votosRef.current, [e]: {} };
        votosRef.current = nuevos;
        setVotos(nuevos);
      },
      quitar: (e, clave) => {
        if (preguntas.current[e]?.clave !== clave) return;
        clearTimeout(relojes.current[e]);
        preguntas.current[e] = null;
      },
    };
  }
  const api = apiRef.current;

  const cambiarEquipo = (id) => setMandos(x => ({ ...x, [id]: { ...x[id], equipo: (x[id].equipo + 1) % 3 } }));
  const renombrar = (id, txt) => { setMandos(x => ({ ...x, [id]: { ...x[id], nombre: txt } })); guardarNombre(id, txt); };
  const repartir = () => setMandos(x => {
    const ids = Object.keys(x).sort(() => Math.random() - 0.5);
    return Object.fromEntries(ids.map((id, i) => [id, { ...x[id], equipo: (i % 2) + 1 }]));
  });

  return { api, activo, setActivo, mandos, votos, cambiarEquipo, renombrar, repartir, miembros: (e) => Object.values(mandos).filter(m => m.equipo === e) };
}

/** Proveedor para que los paneles (useMandoPregunta) encuentren los mandos. */
export function ProveedorMandos({ m, children }) {
  return <MandosCtx.Provider value={m.api}>{children}</MandosCtx.Provider>;
}

/** Ajustes de mandos dentro de las opciones del tirón de cuerda. */
export function OpcionesMandos({ m }) {
  const [virtuales, setVirtuales] = useState(false);
  const lista = Object.values(m.mandos).sort((a, b) => a.id - b.id);
  return (
    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'white', border: '2px solid #c4b5fd', color: '#334155' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }}>
        <input type="checkbox" checked={m.activo} onChange={e => m.setActivo(e.target.checked)} />
        🎮 Jugar con mandos micro:bit
      </label>
      {m.activo && (
        <div style={{ marginTop: 8, fontWeight: 600 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <ChipAntena />
            <span>Pulsad <b>B</b> o <b>agitad</b> el mando para uniros · pulsa el número para cambiarlo de equipo</span>
            <button onClick={m.repartir} disabled={!lista.length} style={btn('#64748b')}>🎲 Repartir</button>
            <button onClick={() => setVirtuales(v => !v)} style={btn('#64748b')}>🧪</button>
            <BotonTutorialMandos inicial="letras" texto="📖 Tutorial" style={{ padding: '4px 10px', fontSize: '0.78rem' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8, marginTop: 8 }}>
            {[[0, 'Sin equipo', '#94a3b8'], [1, '🔵 Equipo 1', COLOR[1]], [2, '🔴 Equipo 2', COLOR[2]]].map(([e, t, c]) => (
              <div key={e} style={{ border: `2px solid ${c}`, borderRadius: 10, padding: 6 }}>
                <div style={{ fontWeight: 900, color: c, fontSize: '0.8rem', marginBottom: 4 }}>{t}</div>
                {lista.filter(x => x.equipo === e).map(x => (
                  <div key={x.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                    <button onClick={() => m.cambiarEquipo(x.id)} title="Cambiar de equipo" style={{ ...btn(e ? COLOR[e] : '#94a3b8'), minWidth: 36, padding: '2px 6px' }}>{x.id > 900 ? `V${x.id - 900}` : x.id}</button>
                    <input value={x.nombre} onChange={ev => m.renombrar(x.id, ev.target.value)} onBlur={ev => { if (!ev.target.value.trim()) m.renombrar(x.id, nombrePorDefecto(x.id)); }}
                      style={{ flex: 1, minWidth: 0, border: '1px solid #cbd5e1', borderRadius: 6, padding: '2px 6px', fontFamily: 'inherit' }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {virtuales && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              {[901, 902, 903, 904].map(id => (
                <span key={id} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>V{id - 900}</span>
                  {LETRAS.map(l => <button key={l} onClick={() => simularPulsacion(id, l)} style={{ ...btn('#334155'), padding: '2px 7px' }}>{l}</button>)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Estado de la votación de un equipo, debajo de su panel. */
export function VotosEquipo({ m, equipo }) {
  if (!m.activo) return null;
  const total = m.miembros(equipo).length;
  if (!total) return null;
  const v = m.votos[equipo] || {};
  return (
    <div style={{ textAlign: 'center', marginTop: 6, fontWeight: 800, color: COLOR[equipo], fontSize: '0.85rem' }}>
      🎮 {Object.keys(v).length} / {total} han votado
    </div>
  );
}

const btn = (c) => ({ padding: '4px 10px', borderRadius: 8, border: 'none', background: c, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' });
