// Conducir el mBot2: con la mano (webcam), con un mando micro:bit (modo volante)
// o con el teclado. Siempre se ve el SIMULADOR con retos en el suelo y, si se
// conecta el CyberPi por USB, el robot real hace lo mismo a la vez.
import React, { useEffect, useRef, useState } from 'react';
import { RETOS, crearMundo, crearRobot, paso, dibujar, tiempoFinal, ultrasonidos, ANCHO_MUNDO, ALTO_MUNDO } from './simMbot.js';
import {
  conectarCyberpi,
  desconectarCyberpi,
  reiniciarCyberpi,
  escucharEstadoCyberpi,
  moverMbot,
  pararMbot,
  pitarMbot,
  preguntarRobot,
  soportaSerialCyberpi,
  soportaBluetoothCyberpi,
  setModoCyberpi,
  instalarReceptor,
  PROGRAMA_RECEPTOR,
} from './cyberpiMbot.js';
import { escucharManos } from '../manos/manosVision.js';
import VistaManos from '../manos/VistaManos.jsx';
import { escucharMandos, escucharEstadoAntena, setModoMandos, MODOS, VERSION_VOLANTE } from '../mandos/mandosMicrobit.js';
import ChipAntena from '../mandos/ChipAntena.jsx';
import { BotonTutorialMandos } from '../mandos/TutorialMandos.jsx';
import { sonidoCorrecto, sonidoFinal } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';

const LS_MEJORES = 'pikt_mbot_mejores';
const LS_AJUSTES = 'pikt_mbot_ajustes';
const GIRO = 0.6; // cuánto pesa el giro frente al avance
const ZONA_MUERTA = 0.05;
const RECORRIDO = 0.2; // desplazamiento de la mano para ir a tope
const CADUCA_MANO = 500;
const CADUCA_MANDO = 1300;

const leer = (k, def) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? def;
  } catch {
    return def;
  }
};
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin almacenamiento */
  }
};

const eje = (d) => Math.sign(d) * Math.min(1, Math.max(0, (Math.abs(d) - ZONA_MUERTA) / RECORRIDO));
const fmt = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

// Sonidos cortos sintetizados (choques, estrellas…)
let audioCtx = null;
function tono(f, dur = 0.08, tipo = 'sine', vol = 0.15) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = tipo;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* sin audio */
  }
}

export default function ConducirMbot({ onExit }) {
  const [retoId, setRetoId] = useState('libre');
  const [fuente, setFuente] = useState(() => leer(LS_AJUSTES, {}).fuente || 'teclado'); // mano | mando | teclado
  const [potencia, setPotencia] = useState(() => leer(LS_AJUSTES, {}).potencia || 50);
  const [ajustes, setAjustes] = useState(() => ({ invertir: false, cruzar: false, rastro: true, sensor: true, ...leer(LS_AJUSTES, {}) }));
  const [detenido, setDetenido] = useState(false);
  const [mejores, setMejores] = useState(() => leer(LS_MEJORES, {}));
  const [resultado, setResultado] = useState(null);
  const [hud, setHud] = useState({ v: 0, w: 0, l: 0, r: 0, ms: 0, dist: 0, info: '', activa: false });
  const [cyber, setCyber] = useState({ estado: 'desconectado', error: '' });
  const [antena, setAntena] = useState({ conectada: false, version: 0 });
  const [real, setReal] = useState(true);
  const [conexion, setConexion] = useState(() => {
    const g = leer(LS_AJUSTES, {}).conexion;
    // En el móvil no hay Web Serial: lo único posible es Bluetooth.
    const c = !soportaSerialCyberpi() && soportaBluetoothCyberpi() ? 'bluetooth' : g === 'antena' || g === 'bluetooth' ? g : 'cable';
    setModoCyberpi(c);
    return c;
  });
  const [instalando, setInstalando] = useState(false);
  const [avisoPregunta, setAvisoPregunta] = useState(null);
  const preguntar = async () => {
    setAvisoPregunta({ ok: true, detalle: 'Enviando…' });
    setAvisoPregunta(await preguntarRobot());
  };
  const [avisoReceptor, setAvisoReceptor] = useState('');
  const [copiado, setCopiado] = useState(false);

  const puedeConectar = conexion === 'bluetooth' ? soportaBluetoothCyberpi() : soportaSerialCyberpi();
  const cambiarConexion = async (c) => {
    if (c === conexion) return;
    await desconectarCyberpi();
    setModoCyberpi(c);
    setConexion(c);
    setAvisoReceptor('');
  };
  const instalar = async () => {
    setInstalando(true);
    setAvisoReceptor('');
    const ok = await instalarReceptor();
    setInstalando(false);
    if (ok) setAvisoReceptor('✅ Receptor instalado. Quita el cable del robot y conecta el otro CyberPi (paso 2).');
  };
  const copiarReceptor = () => {
    navigator.clipboard?.writeText(PROGRAMA_RECEPTOR).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };
  const [neutro, setNeutro] = useState({ x: 0.5, y: 0.5 });

  const canvasRef = useRef(null);
  const cajaRef = useRef(null);
  const mundoRef = useRef(null);
  const robotRef = useRef(null);
  const ent = useRef({ joy: { v: 0, w: 0, activo: false }, mano: { v: 0, w: 0, t: 0, puno: false, cx: 0.5, cy: 0.5 }, mando: { dir: '', t: 0, freno: false, tB: 0, a: false, tA: 0, id: null }, teclas: new Set() });
  const vivo = useRef({});
  vivo.current = { fuente, potencia, ajustes, detenido, real, cyber, neutro, retoId };

  const reto = RETOS.find((r) => r.id === retoId);

  useEffect(() => guardar(LS_AJUSTES, { ...ajustes, fuente, potencia, conexion }), [ajustes, fuente, potencia, conexion]);
  useEffect(() => escucharEstadoCyberpi(setCyber), []);
  useEffect(() => escucharEstadoAntena(setAntena), []);

  const reiniciarReto = (id = retoId) => {
    mundoRef.current = crearMundo(id);
    robotRef.current = crearRobot(mundoRef.current);
    setResultado(null);
  };
  useEffect(() => reiniciarReto(retoId), [retoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al salir: el robot real se para (drive_power se queda aplicado si no).
  useEffect(() => () => pararMbot(), []);
  useEffect(() => {
    if (!real) pararMbot();
  }, [real]);

  // ── Entrada: mano ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (fuente !== 'mano') return undefined;
    return escucharManos((manos) => {
      const m = manos[0];
      const e = ent.current.mano;
      if (!m) return;
      const n = vivo.current.neutro;
      e.t = performance.now();
      e.cx = m.centro.x;
      e.cy = m.centro.y;
      e.puno = m.dedos === 0;
      e.v = eje(n.y - m.centro.y);
      e.w = eje(m.centro.x - n.x);
    });
  }, [fuente]);

  // ── Entrada: mando micro:bit (modo volante) ───────────────────────────────
  useEffect(() => {
    if (fuente !== 'mando') return undefined;
    setModoMandos(MODOS.VOLANTE);
    const baja = escucharMandos((ev) => {
      if (ev.tipo !== 'futbol') return;
      const e = ent.current.mando;
      const ahora = performance.now();
      e.id = ev.id;
      if (ev.accion === 'V') {
        e.dir = ev.dir || '';
        e.x = ev.x;
        e.y = ev.y;
        e.t = ahora;
      } else if (ev.accion === 'B') {
        e.freno = ev.on;
        e.tB = ahora;
      } else if (ev.accion === 'A') {
        if (ev.on && (!e.a || ahora - e.tA > CADUCA_MANDO)) {
          if (vivo.current.real && vivo.current.cyber.estado === 'listo') preguntar();
          else bocina();
        }
        e.a = ev.on;
        e.tA = ahora;
      }
    });
    return () => {
      baja();
      setModoMandos(MODOS.LETRAS);
    };
  }, [fuente]);

  // ── Entrada: teclado (siempre activo, tiene prioridad) ────────────────────
  useEffect(() => {
    const TECLAS = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
    const enCampo = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '');
    const abajo = (e) => {
      if (enCampo(e)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) bocina();
        return;
      }
      const t = TECLAS[e.key];
      if (!t) return;
      e.preventDefault();
      ent.current.teclas.add(t);
    };
    const arriba = (e) => {
      const t = TECLAS[e.key];
      if (t) ent.current.teclas.delete(t);
    };
    const fuera = () => ent.current.teclas.clear();
    window.addEventListener('keydown', abajo);
    window.addEventListener('keyup', arriba);
    window.addEventListener('blur', fuera);
    return () => {
      window.removeEventListener('keydown', abajo);
      window.removeEventListener('keyup', arriba);
      window.removeEventListener('blur', fuera);
    };
  }, []);

  function bocina() {
    tono(520, 0.12, 'square', 0.08);
    setTimeout(() => tono(660, 0.12, 'square', 0.08), 130);
    if (vivo.current.real && vivo.current.cyber.estado === 'listo') pitarMbot();
  }

  /** Lee la fuente activa → { v, w, activa, info } (v avance, w giro, -1…1). */
  function leerEntrada() {
    const ahora = performance.now();
    const { teclas, mano, mando } = ent.current;
    if (teclas.size) {
      const v = (teclas.has('u') ? 1 : 0) - (teclas.has('d') ? 1 : 0);
      const w = (teclas.has('r') ? 1 : 0) - (teclas.has('l') ? 1 : 0);
      return { v, w, activa: true, info: '⌨️ Teclado' };
    }
    const f = vivo.current.fuente;
    if (f === 'joystick') {
      const { joy } = ent.current;
      return { v: joy.v, w: joy.w, activa: joy.activo, info: joy.activo ? '🕹️ Joystick' : 'Arrastra el joystick para conducir' };
    }
    if (f === 'mano') {
      if (ahora - mano.t > CADUCA_MANO) return { v: 0, w: 0, activa: false, info: '🙈 No veo la mano: el robot se para' };
      if (mano.puno) return { v: 0, w: 0, activa: true, info: '✊ Puño: freno' };
      return { v: mano.v, w: mano.w, activa: true, info: '✋ Mano' };
    }
    if (f === 'mando') {
      if (!mando.id) return { v: 0, w: 0, activa: false, info: 'Esperando un mando…' };
      const freno = mando.freno && ahora - mando.tB < CADUCA_MANDO;
      if (freno) return { v: 0, w: 0, activa: true, info: `🎮 Mando ${mando.id}: freno (B)` };
      const dir = ahora - mando.t < CADUCA_MANDO ? mando.dir : '';
      const vigente = ahora - mando.t < CADUCA_MANDO;
      // Mandos v7: cuánto se inclina. Los anteriores solo dicen hacia dónde.
      const analogico = vigente && mando.x != null && mando.y != null;
      const v = analogico ? -mando.y / 100 : dir.includes('F') ? 1 : dir.includes('T') ? -1 : 0;
      const w = analogico ? mando.x / 100 : dir.includes('D') ? 1 : dir.includes('I') ? -1 : 0;
      return { v, w, activa: true, info: `🎮 Mando ${mando.id}` };
    }
    return { v: 0, w: 0, activa: false, info: 'Usa las flechas o W A S D' };
  }

  // ── Bucle de simulación ───────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    let ultimoHud = 0;
    const bucle = (ahora) => {
      raf = requestAnimationFrame(bucle);
      const dt = Math.min(0.05, (ahora - t0) / 1000);
      t0 = ahora;
      const m = mundoRef.current;
      const r = robotRef.current;
      const cv = canvasRef.current;
      if (!m || !r || !cv) return;
      const { potencia: pot, ajustes: aj, detenido: stop, real: conReal, cyber: cy } = vivo.current;
      const e = stop ? { v: 0, w: 0, activa: false, info: '⏹ Detenido' } : leerEntrada();
      let l = e.v + e.w * GIRO;
      let d = e.v - e.w * GIRO;
      const mx = Math.max(1, Math.abs(l), Math.abs(d));
      l = (l / mx) * pot;
      d = (d / mx) * pot;

      const ev = paso(r, m, l, d, dt);
      if (ev.choque) tono(110, 0.12, 'triangle', 0.2);
      if (ev.cono) tono(220, 0.2, 'sawtooth', 0.08);
      if (ev.estrella || ev.puerta || ev.control) tono(880, 0.1, 'sine', 0.15);
      if (ev.completado) {
        const ms = tiempoFinal(m);
        const id = vivo.current.retoId;
        const previo = leer(LS_MEJORES, {})[id];
        const record = !previo || ms < previo;
        if (record) {
          const nuevos = { ...leer(LS_MEJORES, {}), [id]: Math.round(ms) };
          guardar(LS_MEJORES, nuevos);
          setMejores(nuevos);
        }
        const rt = RETOS.find((x) => x.id === id);
        guardarRegistroLocal('MBOT_RETOS', { titulo: `${rt.nombre} · ${fmt(ms)}`, aciertos: 1, intentos: 1, porcentaje: 100, via: 'simulador' });
        record ? sonidoFinal() : sonidoCorrecto();
        setResultado({ ms, record, previo });
      }

      // Robot real: mismas potencias (con los ajustes de sentido)
      if (conReal && cy.estado === 'listo') {
        let rl = aj.invertir ? -l : l;
        let rr = aj.invertir ? -d : d;
        if (aj.cruzar) [rl, rr] = [rr, rl];
        moverMbot(rl, rr);
      }

      const dist = aj.sensor ? ultrasonidos(r, m) : 0;
      const dpr = window.devicePixelRatio || 1;
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const escala = cv.width / dpr / ANCHO_MUNDO;
      dibujar(ctx, m, r, escala, { verRastro: aj.rastro, verSensor: aj.sensor, distancia: dist, colorLed: stop ? '#ef4444' : e.activa ? '#22c55e' : '#f59e0b' });

      if (ahora - ultimoHud > 100) {
        ultimoHud = ahora;
        setHud({ v: e.v, w: e.w, l: Math.round(l), r: Math.round(d), ms: tiempoFinal(m), dist, info: e.info, activa: e.activa, sig: m.siguiente, est: m.estrellas.filter((s) => s.cogida).length, fuera: m.fueraMs, pen: m.penalizacion });
      }
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tamaño del canvas: ocupa la caja manteniendo la proporción del suelo.
  useEffect(() => {
    const caja = cajaRef.current;
    const cv = canvasRef.current;
    if (!caja || !cv) return undefined;
    const ajustar = () => {
      const w = Math.min(caja.clientWidth, (caja.clientHeight * ANCHO_MUNDO) / ALTO_MUNDO);
      const h = (w * ALTO_MUNDO) / ANCHO_MUNDO;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(caja);
    return () => ro.disconnect();
  }, []);

  const siguienteReto = () => {
    const i = RETOS.findIndex((r) => r.id === retoId);
    setRetoId(RETOS[(i + 1) % RETOS.length].id);
  };

  const progreso = () => {
    const m = mundoRef.current;
    if (!m) return '';
    if (retoId === 'estrellas') return `⭐ ${hud.est || 0}/8`;
    if (retoId === 'puertas') return `🚧 Puerta ${Math.min((hud.sig || 0) + 1, 4)}/4${hud.pen ? ` · +${hud.pen / 1000} s` : ''}`;
    if (retoId === 'linea') return `📍 Control ${Math.min(hud.sig || 1, 8)}/8 · fuera ${fmt(hud.fuera || 0)}`;
    if (retoId === 'aparcar') return '🅿️ Entra entero y para';
    if (retoId === 'laberinto') return '🚩 Llega a la bandera';
    return '';
  };

  const estadoCyber = {
    desconectado: { txt: 'Sin conectar', color: '#94a3b8' },
    conectando: { txt: 'Conectando…', color: '#f59e0b' },
    listo: { txt: '✅ Conectado', color: '#22c55e' },
    sin_respuesta: { txt: '⚠️ No responde', color: '#f97316' },
    error: { txt: '❌ Error', color: '#ef4444' },
  }[cyber.estado];

  return (
    <div style={st.wrap}>
      <div style={st.header}>
        <button onClick={onExit} style={st.btnSec}>
          ← Volver
        </button>
        <b style={{ fontSize: '1.1rem' }}>🚗 Conducir el mBot2</b>
        <span style={{ color: '#94a3b8' }}>
          {reto.emoji} {reto.nombre}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={st.chip}>{progreso()}</span>
          {retoId !== 'libre' && <span style={{ ...st.chip, fontVariantNumeric: 'tabular-nums' }}>⏱ {fmt(hud.ms)}</span>}
          <button onClick={() => setDetenido((v) => !v)} style={{ ...st.btnStop, background: detenido ? '#22c55e' : '#ef4444' }}>
            {detenido ? '▶ Seguir' : '⏹ STOP'}
          </button>
        </span>
      </div>

      <div style={st.cuerpo}>
        {/* Simulador */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
          <div ref={cajaRef} style={{ flex: 1, minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <canvas ref={canvasRef} style={{ borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', background: '#f1f5f9' }} />
            {resultado && (
              <div style={st.resultado}>
                <div style={{ fontSize: '2.6rem' }}>{resultado.record ? '🏆' : '🎉'}</div>
                <b style={{ fontSize: '1.4rem' }}>¡Reto superado!</b>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>{fmt(resultado.ms)}</div>
                <div style={{ color: '#64748b' }}>
                  {resultado.record ? (resultado.previo ? `¡Nuevo récord! (antes ${fmt(resultado.previo)})` : '¡Primer récord!') : `Récord: ${fmt(resultado.previo)}`}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => reiniciarReto()} style={st.btnOn}>
                    🔁 Repetir
                  </button>
                  <button onClick={siguienteReto} style={{ ...st.btnOn, background: '#22c55e', borderColor: '#22c55e' }}>
                    Siguiente reto →
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
            {RETOS.map((r) => (
              <button key={r.id} onClick={() => setRetoId(r.id)} title={r.desc} style={retoId === r.id ? st.btnOn : st.btnOff}>
                {r.emoji} {r.nombre}
                {mejores[r.id] && r.id !== 'libre' ? <span style={{ opacity: 0.75, fontWeight: 600 }}> · {fmt(mejores[r.id])}</span> : null}
              </button>
            ))}
            <button onClick={() => reiniciarReto()} style={st.btnSec}>
              ↺ Reiniciar
            </button>
          </div>
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{reto.desc}</div>
        </div>

        {/* Panel lateral */}
        <div style={st.lateral}>
          <h3 style={st.h3}>¿Con qué conduces?</h3>
          <div style={st.fila}>
            {[
              ['mano', '✋ Mano'],
              ['mando', '🎮 micro:bit'],
              ['joystick', '🕹️ Joystick'],
              ['teclado', '⌨️ Teclado / botones'],
            ].map(([id, txt]) => (
              <button key={id} onClick={() => setFuente(id)} style={fuente === id ? st.btnOn : st.btnOff}>
                {txt}
              </button>
            ))}
          </div>

          {fuente === 'mano' && (
            <div style={st.caja}>
              <div style={{ position: 'relative', width: 260 }}>
                <VistaManos ancho={260} />
                <div
                  style={{
                    position: 'absolute',
                    left: `${neutro.x * 100}%`,
                    top: `${neutro.y * 100}%`,
                    width: 26,
                    height: 26,
                    marginLeft: -13,
                    marginTop: -13,
                    borderRadius: '50%',
                    border: '2px dashed #facc15',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <p style={st.ayuda}>
                Pon la mano delante de la cámara. <b>Súbela</b> para avanzar, <b>bájala</b> para retroceder y muévela a los
                <b> lados</b> para girar: cuanto más lejos del círculo amarillo, más rápido. <b>✊ Puño</b> = freno.
              </p>
              <button onClick={() => setNeutro({ x: ent.current.mano.cx, y: ent.current.mano.cy })} style={st.btnSec}>
                🎯 Centrar aquí mi mano
              </button>
            </div>
          )}
          {fuente === 'mando' && (
            <div style={st.caja}>
              <div style={{ ...st.fila, marginBottom: 6 }}>
                <ChipAntena />
                <BotonTutorialMandos inicial="ovni" texto="Cómo se usa" />
              </div>
              {antena.conectada && antena.version > 0 && antena.version < VERSION_VOLANTE && (
                <p style={{ ...st.ayuda, color: '#f97316' }}>⚠️ La antena tiene programas antiguos: regraba antena y mandos (v{VERSION_VOLANTE}) en Mandos micro:bit.</p>
              )}
              <p style={st.ayuda}>
                <b>Inclina</b> el mando hacia delante para avanzar, hacia atrás para retroceder y a los lados para girar.
                <b> A</b> = pregunta en el robot (si no está conectado, bocina) · <b>B</b> (mantener) = freno. Si el mando deja de enviar, el robot se para.
              </p>
            </div>
          )}
          {fuente === 'joystick' && (
            <div style={st.caja}>
              <JoystickConducir joy={ent.current.joy} />
              <p style={st.ayuda}>Cuanto más lejos del centro, más rápido. En las diagonales avanza y gira a la vez. Al soltar, se para.</p>
            </div>
          )}
          {fuente === 'teclado' && (
            <div style={st.caja}>
              <PadTactil teclas={ent.current.teclas} />
              <p style={st.ayuda}>
                <b>↑ ↓ ← →</b> o <b>W A S D</b> para conducir · <b>Espacio</b> = bocina. El teclado funciona siempre, aunque elijas
                la mano o el mando.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '10px 0' }}>
            <svg width={96} height={96} viewBox="-50 -50 100 100">
              <circle r={46} fill="#0f172a" stroke="#334155" strokeWidth={3} />
              <circle r={ZONA_MUERTA * 200} fill="none" stroke="#475569" strokeDasharray="3 3" />
              <line x1={-46} y1={0} x2={46} y2={0} stroke="#1e293b" />
              <line x1={0} y1={-46} x2={0} y2={46} stroke="#1e293b" />
              <circle cx={hud.w * 38} cy={-hud.v * 38} r={9} fill={hud.activa ? '#22c55e' : '#64748b'} />
            </svg>
            <div style={{ flex: 1 }}>
              {[
                ['Rueda izq.', hud.l],
                ['Rueda der.', hud.r],
              ].map(([n, val]) => (
                <div key={n} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {n}: <b style={{ color: '#e2e8f0' }}>{val}</b>
                  </div>
                  <div style={{ height: 8, background: '#1e293b', borderRadius: 4, position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: val >= 0 ? '50%' : `${50 + val / 2}%`,
                        width: `${Math.abs(val) / 2}%`,
                        background: val >= 0 ? '#22c55e' : '#f97316',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{hud.info}</div>
              {ajustes.sensor && <div style={{ fontSize: '0.75rem', color: '#facc15' }}>📡 Ultrasonidos: {hud.dist >= 200 ? '>200' : hud.dist} cm</div>}
            </div>
          </div>

          <label style={st.ayuda}>
            Potencia máxima: <b>{potencia}%</b>
            <input type="range" min={20} max={100} step={5} value={potencia} onChange={(e) => setPotencia(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <div style={st.fila}>
            <label style={st.check}>
              <input type="checkbox" checked={ajustes.rastro} onChange={(e) => setAjustes((a) => ({ ...a, rastro: e.target.checked }))} /> Rastro
            </label>
            <label style={st.check}>
              <input type="checkbox" checked={ajustes.sensor} onChange={(e) => setAjustes((a) => ({ ...a, sensor: e.target.checked }))} /> Sensor de distancia
            </label>
          </div>

          <h3 style={st.h3}>🤖 mBot2 real</h3>
          <div style={st.fila}>
            {[
              ['cable', '🔌 Por cable'],
              ['antena', '📡 Sin cable (2 CyberPi)'],
              ['bluetooth', '📶 Bluetooth'],
            ].map(([id, txt]) => (
              <button key={id} onClick={() => cambiarConexion(id)} style={conexion === id ? st.btnOn : st.btnOff}>
                {txt}
              </button>
            ))}
          </div>
          {conexion === 'bluetooth' && (
            <p style={st.ayuda}>
              Enciende el mBot2, cierra mBlock y la app de Makeblock, y pulsa «Conectar». Funciona con Chrome en Android o en el ordenador; en iPhone no funciona con Safari.
            </p>
          )}
          {conexion === 'antena' && (
            <div style={st.caja}>
              <b style={{ fontSize: '0.85rem' }}>Paso 1 · Receptor en el robot</b>
              <p style={st.ayuda}>
                Conecta por USB el CyberPi <b>del robot</b> (con el mBot2 encendido) y pulsa «Instalar receptor». Después quita el
                cable: el robot se queda escuchando (LED azul) mientras no lo apagues.
              </p>
              <div style={st.fila}>
                <button onClick={instalar} disabled={instalando || cyber.estado === 'conectando' || !soportaSerialCyberpi()} style={st.btnOn}>
                  {instalando ? 'Instalando…' : '📥 Instalar receptor'}
                </button>
                <button onClick={copiarReceptor} style={st.btnSec}>
                  {copiado ? '✓ Copiado' : '📋 Copiar código'}
                </button>
              </div>
              {avisoReceptor && <p style={{ ...st.ayuda, color: '#22c55e' }}>{avisoReceptor}</p>}
              <p style={st.ayuda}>
                Para que quede guardado aunque se apague, pega el código en mBlock (modo Python, «Subir») en el CyberPi del robot.
              </p>
              <b style={{ fontSize: '0.85rem' }}>Paso 2 · Antena en el ordenador</b>
              <p style={st.ayuda}>
                Conecta por USB el <b>otro</b> CyberPi y pulsa «Conectar CyberPi». Las órdenes viajan por broadcast LAN (sin router).
                LED del robot: 🟢 recibiendo · 🟠 sin señal (se para solo en 1 s).
              </p>
            </div>
          )}
          <div style={st.caja}>
            <div style={{ ...st.fila, justifyContent: 'space-between' }}>
              <b style={{ color: estadoCyber.color }}>{estadoCyber.txt}</b>
              {cyber.estado === 'listo' || cyber.estado === 'sin_respuesta' ? (
                <span style={st.fila}>
                  <button onClick={reiniciarCyberpi} style={st.btnSec}>
                    ↻ Reiniciar
                  </button>
                  <button onClick={desconectarCyberpi} style={st.btnSec}>
                    Desconectar
                  </button>
                </span>
              ) : (
                <button onClick={conectarCyberpi} disabled={cyber.estado === 'conectando' || instalando || !puedeConectar} style={st.btnOn}>
                  {conexion === 'bluetooth' ? '📶' : '🔌'} Conectar {conexion === 'antena' ? 'antena' : 'CyberPi'}
                </button>
              )}
            </div>
            {cyber.error && <p style={{ ...st.ayuda, color: '#f97316' }}>{cyber.error}</p>}
            {!puedeConectar && <p style={st.ayuda}>{conexion === 'bluetooth' ? 'Este navegador no permite Bluetooth: usa Chrome en Android o en el ordenador.' : 'Necesitas Chrome o Edge en un ordenador.'}</p>}
            {cyber.estado === 'listo' && (
              <>
                <button type="button" onClick={preguntar} style={{ ...st.btnOn, background: '#7c3aed', borderColor: '#7c3aed', width: '100%', padding: '12px 10px', fontSize: '1rem' }}>
                  🗣️ Preguntar
                </button>
                {avisoPregunta && <p style={{ ...st.ayuda, fontWeight: 700, color: avisoPregunta.ok ? '#22c55e' : '#f97316' }}>{avisoPregunta.detalle}</p>}
                <p style={st.ayuda}>
                  Abre antes en el robot el test de la ranura 8 («Test en el mBot2»). Lleva el robot hasta quien deba contestar: oirá la pregunta y responderá con el joystick.
                  Con el mando micro:bit, el botón A hace lo mismo.
                </p>
                <label style={st.check}>
                  <input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} /> Mover también el robot real
                </label>
                <details style={{ marginTop: 6 }}>
                  <summary style={{ ...st.ayuda, cursor: 'pointer' }}>Ajustes de sentido</summary>
                  <label style={st.check}>
                    <input type="checkbox" checked={ajustes.invertir} onChange={(e) => setAjustes((a) => ({ ...a, invertir: e.target.checked }))} /> Va hacia atrás
                    (invertir avance)
                  </label>
                  <label style={st.check}>
                    <input type="checkbox" checked={ajustes.cruzar} onChange={(e) => setAjustes((a) => ({ ...a, cruzar: e.target.checked }))} /> Gira al revés
                    (intercambiar ruedas)
                  </label>
                </details>
              </>
            )}
            <p style={st.ayuda}>
              {conexion === 'cable' ? (
                <>
                  Conecta el CyberPi por USB con el mBot2 <b>encendido</b> (batería del chasis).{' '}
                </>
              ) : null}
              Cierra antes mBlock y el editor de bloques. Empieza con poca potencia y deja espacio libre alrededor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Joystick en pantalla, con ratón o dedo: v y w de -1 a 1. Al soltar vuelve al centro. */
function JoystickConducir({ joy }) {
  const baseRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const R = 80; // radio de recorrido en px
  const mover = (e) => {
    const c = baseRef.current.getBoundingClientRect();
    let x = (e.clientX - (c.left + c.width / 2)) / R;
    let y = (e.clientY - (c.top + c.height / 2)) / R;
    const d = Math.hypot(x, y);
    if (d > 1) {
      x /= d;
      y /= d;
    }
    const zona = (a) => (Math.abs(a) < 0.08 ? 0 : a);
    joy.v = zona(-y);
    joy.w = zona(x);
    joy.activo = true;
    setPos({ x, y });
  };
  const soltar = () => {
    joy.v = 0;
    joy.w = 0;
    joy.activo = false;
    setPos({ x: 0, y: 0 });
  };
  useEffect(() => soltar, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        mover(e);
      }}
      onPointerMove={(e) => {
        if (joy.activo) mover(e);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: 220, height: 220, margin: '4px auto 8px', borderRadius: '50%', background: 'radial-gradient(circle, #334155 0%, #1e293b 70%)', border: '3px solid #475569', position: 'relative', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab' }}
    >
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 76, height: 76, marginLeft: -38, marginTop: -38, borderRadius: '50%', background: '#2563eb', border: '3px solid #93c5fd', transform: `translate(${pos.x * R}px, ${pos.y * R}px)`, pointerEvents: 'none' }} />
    </div>
  );
}

/** Flechas para el móvil: mientras se pulsan, cuentan como las teclas del teclado. */
function PadTactil({ teclas }) {
  const boton = (t, txt, area) => (
    <button
      key={t}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        teclas.add(t);
      }}
      onPointerUp={() => teclas.delete(t)}
      onPointerCancel={() => teclas.delete(t)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ gridArea: area, height: 64, borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontSize: '1.6rem', fontWeight: 900, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer' }}
    >
      {txt}
    </button>
  );
  return (
    <div style={{ display: 'grid', gridTemplateAreas: '". u ." "l d r"', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 240, margin: '4px auto 10px' }}>
      {boton('u', '↑', 'u')}
      {boton('l', '←', 'l')}
      {boton('d', '↓', 'd')}
      {boton('r', '→', 'r')}
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid #334155' },
  cuerpo: { flex: 1, display: 'flex', flexWrap: 'wrap', minHeight: 0, overflow: 'auto' },
  lateral: { width: 300, flex: '0 0 300px', padding: 12, borderLeft: '1px solid #334155', overflowY: 'auto', boxSizing: 'border-box', background: 'rgba(15,23,42,0.5)' },
  caja: { background: 'rgba(30,41,59,0.85)', border: '1px solid #334155', borderRadius: 12, padding: 10, marginTop: 8 },
  h3: { margin: '10px 0 6px', fontSize: '0.95rem', color: '#f8fafc' },
  ayuda: { color: '#94a3b8', fontSize: '0.8rem', margin: '6px 0', display: 'block', lineHeight: 1.4 },
  check: { color: '#cbd5e1', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' },
  fila: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  chip: { padding: '4px 12px', borderRadius: 999, background: 'rgba(30,41,59,0.9)', border: '1px solid #475569', fontWeight: 700, fontSize: '0.85rem' },
  btnOn: { padding: '7px 12px', borderRadius: 10, border: '2px solid #38bdf8', background: '#0284c7', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' },
  btnOff: { padding: '7px 12px', borderRadius: 10, border: '2px solid #475569', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
  btnSec: { padding: '6px 12px', borderRadius: 9, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' },
  btnStop: { padding: '8px 18px', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem' },
  resultado: { position: 'absolute', background: '#fff', color: '#0f172a', borderRadius: 18, padding: '20px 28px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
};
