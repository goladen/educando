// 🗺️ Mapas, rutas y tractor de siembra con el mBot2.
//   · Misiones dirigidas desde el ordenador (mapaSim.js): 🗺️ mapear como una Roomba, 🚜 sembrar un campo
//     en surcos y 🧭 ir a un punto y volver. Se ejecutan en el simulador o en el robot real (Bluetooth,
//     cable o 2 CyberPi) y se ven en directo: posición, sensor, obstáculos y ruta.
//   · Programas autónomos para las ranuras del robot (programasMapa.js) y lectura de su mapa.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CELDA, N, O, idx, nuevoEstado, explorar, sembrar, irYVolver, ejecutarMision, zonaRectangulo, crearMundo,
  crearRobotSim, ejecutorSim, surcos,
} from './mapaSim.js';
import {
  conectarCyberpi, desconectarCyberpi, escucharEstadoCyberpi, setModoCyberpi, instalarReceptor, prepararMisionReal,
  terminarMisionReal, accionRobotReal, prepararCargaTest, instalarProgramasMapa, leerMapaRobot, enviarDestinoRobot,
  soportaSerialCyberpi, soportaBluetoothCyberpi,
} from './cyberpiMbot.js';

const MISIONES = [
  ['explorar', '🗺️ Mapear', 'Como una Roomba: explora, apunta paredes y obstáculos y vuelve a la base.'],
  ['sembrar', '🚜 Sembrar el campo', 'Tractor autónomo: recorre todo el campo en surcos de ida y vuelta, rodeando árboles y piedras.'],
  ['ir', '🧭 Ir y volver', 'Pulsa en el mapa un destino: busca el camino más corto, va y vuelve a la base.'],
];

const fmtT = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function MapaClase({ onExit }) {
  const [pestana, setPestana] = useState('misiones');
  const [fuente, setFuente] = useState('sim'); // sim | real
  const [conexion, setConexion] = useState('bluetooth'); // bluetooth | cable | antena
  const [escenario, setEscenario] = useState('campo');
  const [mision, setMision] = useState('sembrar');
  const [ancho, setAncho] = useState(5.1);
  const [largo, setLargo] = useState(3.9);
  const [zona, setZona] = useState(() => zonaRectangulo(5.1, 3.9));
  const [obst, setObst] = useState(() => new Uint8Array(N * N));
  const [herramienta, setHerramienta] = useState('campo'); // campo | obstaculo | borrar
  const [editar, setEditar] = useState(false);
  const [destino, setDestino] = useState(null);
  const [minutos, setMinutos] = useState(5);
  const [vel, setVel] = useState(4);
  const [ruido, setRuido] = useState(true);
  const [semilla, setSemilla] = useState(1);
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [cyber, setCyber] = useState({ estado: 'desconectado', error: '' });
  const [aviso, setAviso] = useState('');
  const [, setTic] = useState(0);
  const [mapaBase, setMapaBase] = useState(null); // último mapa explorado o leído del robot
  const [ranuras, setRanuras] = useState({ mapa: 6, ruta: 7 });
  const [instalando, setInstalando] = useState('');

  const canvasRef = useRef(null);
  const mRef = useRef(null);
  const simRef = useRef(null);
  const velRef = useRef(vel); velRef.current = vel;
  const cancelRef = useRef(false);
  const vistaRef = useRef(null);
  const pintando = useRef(null);
  const reloj = useRef({ ini: 0, fin: 0 });

  useEffect(() => escucharEstadoCyberpi(setCyber), []);
  useEffect(() => { const t = setInterval(() => setTic((n) => n + 1), 250); return () => clearInterval(t); }, []);
  useEffect(() => () => { cancelRef.current = true; }, []);

  const mundo = useMemo(() => crearMundo(escenario, semilla), [escenario, semilla]);
  // Escenario nuevo: robot en la base y mapa vacío (no se toca al acabar una misión)
  useEffect(() => {
    simRef.current = { mundo, rb: crearRobotSim(mundo, { ruido }) };
    mRef.current = null;
    setMapaBase(null);
    setResultado(null);
  }, [mundo, ruido]);
  useEffect(() => { if (escenario === 'campo') setMision('sembrar'); else setMision('explorar'); }, [escenario]);

  const ponerRect = (w, h) => { setAncho(w); setLargo(h); setZona(zonaRectangulo(w, h)); };

  const conectado = cyber.estado === 'listo';
  const conectar = async () => {
    setAviso('');
    setModoCyberpi(conexion);
    await conectarCyberpi();
  };

  // Una lectura del ultrasonidos del robot real, para saber antes de empezar si responde
  const probarSensor = async () => {
    setAviso('Midiendo…');
    try {
      await prepararMisionReal();
      const d = Math.round(await accionRobotReal({ t: 'medir' }));
      setAviso(d > 2 ? (d >= 300 ? '📡 El sensor responde: no ve nada en 3 m. Pon la mano delante y vuelve a probar.' : `📡 El sensor responde: hay algo a ${d} cm.`) : '⚠️ El sensor no da lectura: comprueba que está conectado al CyberPi y que nada lo tapa. Sin lecturas el robot no avanzará.');
    } catch (e) { setAviso('❌ ' + e.message); }
    terminarMisionReal();
  };

  const empezar = async () => {
    if (mision === 'ir' && destino == null) { setAviso('Pulsa en el mapa el destino.'); return; }
    if (mision === 'sembrar' && !zona.some(Boolean)) { setAviso('Dibuja antes el campo.'); return; }
    setAviso(''); setResultado(null); setEditar(false);
    const m = nuevoEstado(mision === 'sembrar' ? { zona, obstaculos: obst } : {});
    if (mision === 'ir' && mapaBase) { m.g.set(mapaBase.g); m.vis.set(mapaBase.vis); }
    mRef.current = m;
    let ejecutor;
    if (fuente === 'sim') {
      const rb = crearRobotSim(mundo, { ruido });
      simRef.current = { mundo, rb };
      ejecutor = ejecutorSim(mundo, rb, () => velRef.current);
    } else {
      try { await prepararMisionReal(); } catch (e) { setAviso(e.message); return; }
      ejecutor = accionRobotReal;
    }
    const gen = mision === 'explorar' ? explorar(m, { segundos: minutos * 60 }) : mision === 'sembrar' ? sembrar(m) : irYVolver(m, destino);
    cancelRef.current = false;
    reloj.current = { ini: Date.now(), fin: 0 };
    setCorriendo(true);
    const res = await ejecutarMision(gen, ejecutor, { cancelado: () => cancelRef.current });
    if (fuente === 'real') terminarMisionReal();
    reloj.current.fin = Date.now();
    setCorriendo(false);
    setResultado(res);
    if (mision === 'explorar') setMapaBase({ g: m.g.slice(), vis: m.vis.slice() });
  };
  const parar = () => { cancelRef.current = true; };

  const usarMapaComoCampo = () => {
    if (!mapaBase) return;
    const z = new Uint8Array(N * N), o = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) { if (mapaBase.g[i] > 0 && mapaBase.g[i] < 6) z[i] = 1; if (mapaBase.g[i] >= 6) o[i] = 1; }
    setZona(z); setObst(o); setMision('sembrar');
  };

  // ── Programas autónomos ──
  const instalar = async () => {
    setInstalando('Conectando…'); setAviso('');
    try {
      if (!(await prepararCargaTest())) { setInstalando(''); return; }
      await instalarProgramasMapa({ ranuraMapa: ranuras.mapa, ranuraRuta: ranuras.ruta, onProgreso: setInstalando });
      setInstalando('');
      setAviso(`✅ Instalados: «Mapear la clase» en la ranura ${ranuras.mapa} e «Ir y volver» en la ${ranuras.ruta}.`);
    } catch (e) { setInstalando(''); setAviso('❌ ' + e.message); }
  };
  const leerMapa = async () => {
    setAviso('Leyendo el mapa…');
    try {
      const d = await leerMapaRobot();
      if (d.n !== N || d.c !== CELDA) throw new Error('El mapa del robot es de otra versión.');
      const g = new Uint8Array(N * N), vis = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) { g[i] = d.g.charCodeAt(i) - 48; vis[i] = d.v.charCodeAt(i) - 48; }
      setMapaBase({ g, vis });
      const m = nuevoEstado(); m.g.set(g); m.vis.set(vis); m.x = d.x; m.y = d.y; m.r = d.r;
      mRef.current = m; setFuente('real');
      setAviso('✅ Mapa leído del robot: ya puedes elegir un destino o usarlo como campo.');
    } catch (e) { setAviso('❌ ' + e.message); }
  };
  const mandarDestino = async () => {
    if (destino == null) { setAviso('Pulsa en el mapa el destino.'); return; }
    try { await enviarDestinoRobot((destino % N) - O, Math.floor(destino / N) - O); setAviso('✅ Destino guardado en el robot: abre «Ir y volver» y pulsa el centro del joystick.'); } catch (e) { setAviso('❌ ' + e.message); }
  };

  // ── Dibujo ──
  useEffect(() => {
    let raf = 0;
    const dibujar = () => {
      raf = requestAnimationFrame(dibujar);
      const cv = canvasRef.current; if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sim = fuente === 'sim' ? simRef.current : null;
      const m = mRef.current;
      const base = sim ? sim.mundo.base : { x: 0, y: 0 };
      const cw = (c) => ({ x: base.x + ((c % N) - O) * CELDA, y: base.y + (Math.floor(c / N) - O) * CELDA });
      // Encuadre: el mundo simulado, o las celdas con algo (real)
      let x0, y0, x1, y1;
      if (sim) { x0 = 0; y0 = 0; x1 = sim.mundo.W; y1 = sim.mundo.H; } else {
        x0 = -150; y0 = -150; x1 = 300; y1 = 300;
        for (let i = 0; i < N * N; i++) {
          if ((m && (m.g[i] || m.vis[i])) || (mision === 'sembrar' && zona[i])) {
            const p = cw(i); x0 = Math.min(x0, p.x - 45); y0 = Math.min(y0, p.y - 45); x1 = Math.max(x1, p.x + 45); y1 = Math.max(y1, p.y + 45);
          }
        }
      }
      const s = Math.min((W - 16) / (x1 - x0), (H - 16) / (y1 - y0));
      const ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = (H + (y1 - y0) * s) / 2 + y0 * s;
      const X = (x) => ox + x * s, Y = (y) => oy - y * s;
      vistaRef.current = { s, ox, oy, base };
      const campo = (sim && sim.mundo.tipo === 'campo') || (!sim && mision === 'sembrar');

      // Suelo y obstáculos reales (simulador)
      ctx.fillStyle = campo ? '#7c4a1e' : '#cbd5e1';
      if (sim) ctx.fillRect(X(0), Y(sim.mundo.H), sim.mundo.W * s, sim.mundo.H * s);
      else { ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H); }
      if (sim) {
        if (campo) { // surcos del terreno
          ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
          for (let yy = 10; yy < sim.mundo.H; yy += 15) { ctx.beginPath(); ctx.moveTo(X(0), Y(yy)); ctx.lineTo(X(sim.mundo.W), Y(yy)); ctx.stroke(); }
        }
        for (const [a, b, c, d] of sim.mundo.paredes) { ctx.fillStyle = campo ? '#a16207' : '#334155'; ctx.fillRect(X(a), Y(d), (c - a) * s, (d - b) * s); }
        for (const o of sim.mundo.obst) {
          const [a, b, c, d] = o.r;
          if (o.tipo === 'arbol') {
            ctx.fillStyle = '#14532d'; ctx.beginPath(); ctx.arc(X((a + c) / 2), Y((b + d) / 2), ((c - a) / 2 + 8) * s, 0, 7); ctx.fill();
            ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(X((a + c) / 2) - 3, Y((b + d) / 2) - 3, ((c - a) / 2) * s, 0, 7); ctx.fill();
          } else if (o.tipo === 'charca') {
            ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.ellipse(X((a + c) / 2), Y((b + d) / 2), ((c - a) / 2) * s, ((d - b) / 2) * s, 0, 0, 7); ctx.fill();
          } else {
            ctx.fillStyle = { mesa: '#92400e', caja: '#a16207', columna: '#64748b', roca: '#78716c' }[o.tipo] || '#475569';
            ctx.fillRect(X(a), Y(d), (c - a) * s, (d - b) * s);
          }
        }
      }
      const celda = (i, fill) => { const p = cw(i); ctx.fillStyle = fill; ctx.fillRect(X(p.x - CELDA / 2) + 0.5, Y(p.y + CELDA / 2) + 0.5, CELDA * s - 1, CELDA * s - 1); };
      // Campo programado (contorno)
      if (mision === 'sembrar' && !(m && m.zona == null && corriendo)) {
        const z = m?.zona || zona;
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        for (let i = 0; i < N * N; i++) {
          if (!z[i]) continue;
          const p = cw(i), l = X(p.x - CELDA / 2), r = X(p.x + CELDA / 2), t = Y(p.y + CELDA / 2), b = Y(p.y - CELDA / 2);
          const lado = (j, x1_, y1_, x2_, y2_) => { if (!z[j]) { ctx.beginPath(); ctx.moveTo(x1_, y1_); ctx.lineTo(x2_, y2_); ctx.stroke(); } };
          lado(i - 1, l, t, l, b); lado(i + 1, r, t, r, b); lado(i + N, l, t, r, t); lado(i - N, l, b, r, b);
        }
        ctx.setLineDash([]);
        if (!m) for (let i = 0; i < N * N; i++) if (obst[i]) celda(i, 'rgba(239,68,68,.55)');
      }
      // Mapa de la misión (lo que el robot cree)
      const mm = m || (mapaBase && fuente === 'real' ? { g: mapaBase.g, vis: mapaBase.vis, cub: new Uint8Array(N * N), plan: [] } : null);
      if (mm) {
        for (let i = 0; i < N * N; i++) {
          const v = mm.g[i];
          if (mm.cub[i]) {
            celda(i, 'rgba(21,128,61,.55)');
            const p = cw(i); ctx.fillStyle = '#86efac';
            for (const dx of [-8, 0, 8]) for (const dy of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(X(p.x + dx), Y(p.y + dy), Math.max(1, 1.6 * s), 0, 7); ctx.fill(); }
          } else if (v >= 6) celda(i, 'rgba(239,68,68,.6)');
          else if (v > 0 && !campo) celda(i, mm.vis[i] ? 'rgba(56,189,248,.35)' : 'rgba(255,255,255,.35)');
          else if (v > 0 && !sim) celda(i, 'rgba(255,255,255,.12)');
        }
        if (mm.plan?.length && m) {
          ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.beginPath();
          const p0 = cw(idx(m.x, m.y)); ctx.moveTo(X(p0.x), Y(p0.y));
          for (const c of mm.plan) { const p = cw(c); ctx.lineTo(X(p.x), Y(p.y)); }
          ctx.stroke();
        }
      }
      // Base y destino
      ctx.font = `${Math.max(14, 26 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏠', X(base.x), Y(base.y));
      if (destino != null) { const p = cw(destino); ctx.fillText('📍', X(p.x), Y(p.y + 6)); }
      // Robot creído (fantasma) y real (simulador)
      const robot = (x, y, h, fantasma) => {
        ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate((h * Math.PI) / 180);
        if (fantasma) { ctx.strokeStyle = '#e2e8f0'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.strokeRect(-9 * s, -11 * s, 18 * s, 22 * s); ctx.setLineDash([]); }
        else if (campo) {
          ctx.fillStyle = '#111827'; ctx.fillRect(-12 * s, 1 * s, 6 * s, 11 * s); ctx.fillRect(6 * s, 1 * s, 6 * s, 11 * s);
          ctx.fillStyle = '#16a34a'; ctx.fillRect(-7 * s, -13 * s, 14 * s, 24 * s);
          ctx.fillStyle = '#facc15'; ctx.fillRect(-4 * s, -12 * s, 8 * s, 6 * s);
          ctx.fillStyle = '#111827'; ctx.fillRect(-10 * s, -11 * s, 4 * s, 6 * s); ctx.fillRect(6 * s, -11 * s, 4 * s, 6 * s);
        } else {
          ctx.fillStyle = '#0ea5e9'; ctx.fillRect(-9 * s, -11 * s, 18 * s, 22 * s);
          ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(0, -11 * s); ctx.lineTo(6 * s, -3 * s); ctx.lineTo(-6 * s, -3 * s); ctx.fill();
        }
        ctx.restore();
      };
      if (sim) {
        const rb = sim.rb;
        if (rb.rayo && Date.now() - rb.rayo.t < 350) {
          const h = (rb.h * Math.PI) / 180;
          ctx.strokeStyle = 'rgba(250,204,21,.85)'; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(X(rb.x), Y(rb.y)); ctx.lineTo(X(rb.x + (rb.rayo.d + 6) * Math.sin(h)), Y(rb.y + (rb.rayo.d + 6) * Math.cos(h))); ctx.stroke();
        }
        robot(rb.x, rb.y, rb.h, false);
      }
      if (m) {
        const p = cw(idx(m.x, m.y));
        // Robot real: el rayo del sensor desde donde cree que está (amarillo = eco, rojo = sin lectura)
        if (!sim && m.ultimaD != null) {
          const h = (m.r * Math.PI) / 2, largo = m.ultimaD ? Math.min(m.ultimaD, 300) : 25;
          ctx.strokeStyle = m.ultimaD ? 'rgba(250,204,21,.9)' : 'rgba(239,68,68,.95)'; ctx.lineWidth = 2; ctx.setLineDash(m.ultimaD >= 300 ? [5, 5] : []);
          ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(p.x + largo * Math.sin(h)), Y(p.y + largo * Math.cos(h))); ctx.stroke(); ctx.setLineDash([]);
          if (!m.ultimaD) { ctx.fillStyle = '#ef4444'; ctx.fillText('?', X(p.x + 32 * Math.sin(h)), Y(p.y + 32 * Math.cos(h))); }
        }
        robot(p.x, p.y, m.r * 90, !!sim);
      }
    };
    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, [fuente, mision, zona, obst, destino, mapaBase, corriendo]);

  // Clic en el mapa: destino o pintar el campo
  const celdaDe = (e) => {
    const v = vistaRef.current, cv = canvasRef.current; if (!v || !cv) return null;
    const rc = cv.getBoundingClientRect();
    const wx = (e.clientX - rc.left - v.ox) / v.s, wy = (v.oy - (e.clientY - rc.top)) / v.s;
    const a = O + Math.round((wx - v.base.x) / CELDA), b = O + Math.round((wy - v.base.y) / CELDA);
    return a > 0 && a < N - 1 && b > 0 && b < N - 1 ? idx(a, b) : null;
  };
  const pintar = (i, primero) => {
    if (i == null) return;
    if (primero) pintando.current = herramienta === 'campo' ? (zona[i] ? 'quitar' : 'poner') : herramienta;
    const accion = pintando.current;
    if (accion === 'poner' || accion === 'quitar') setZona((z) => { const n = z.slice(); n[i] = accion === 'poner' ? 1 : 0; return n; });
    else setObst((o) => { const n = o.slice(); n[i] = accion === 'obstaculo' ? 1 : 0; return n; });
    if (accion === 'borrar') setZona((z) => { const n = z.slice(); n[i] = 0; return n; });
  };
  const alPulsar = (e) => {
    if (corriendo) return;
    const i = celdaDe(e);
    if (editar && mision === 'sembrar') { pintar(i, true); return; }
    if (mision === 'ir' && i != null) setDestino(i);
  };
  const alMover = (e) => { if (e.buttons && editar && mision === 'sembrar' && !corriendo) pintar(celdaDe(e), false); };

  const m = mRef.current;
  const rb = fuente === 'sim' ? simRef.current?.rb : null;
  const totalCampo = mision === 'sembrar' ? (m?.zona ? surcos(m.zona).length : zona.reduce((a, b) => a + b, 0)) : 0;
  const sembradas = m ? m.cub.reduce((a, b) => a + b, 0) : 0;
  const libres = m ? m.g.reduce((a, v) => a + (v > 0 && v < 6 ? 1 : 0), 0) : 0;
  const obstaculos = m ? m.g.reduce((a, v) => a + (v >= 6 ? 1 : 0), 0) : 0;

  return (
    <div style={st.raiz}>
      <header style={st.cab}>
        <button style={st.btn('#334155')} onClick={() => { parar(); onExit?.(); }}>← Volver</button>
        <h2 style={{ margin: 0, flex: 1, fontSize: 'clamp(16px,2.2vw,22px)' }}>🗺️ Mapas, rutas y tractor de siembra con el mBot2</h2>
        <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['misiones', '🎯 Misiones'], ['robot', '🤖 Programas para el robot'], ['como', '💡 ¿Cómo lo hace?']].map(([k, t]) => (
            <button key={k} style={st.chip(pestana === k)} onClick={() => setPestana(k)}>{t}</button>
          ))}
        </nav>
      </header>

      {pestana === 'misiones' && (
        <div style={st.cuerpo}>
          <aside style={st.lateral}>
            <div style={st.caja}>
              <b>¿Dónde?</b>
              <div style={st.fila}>
                <button style={st.chip(fuente === 'sim')} disabled={corriendo} onClick={() => setFuente('sim')}>🧪 Simulador</button>
                <button style={st.chip(fuente === 'real')} disabled={corriendo} onClick={() => setFuente('real')}>🤖 mBot2 real</button>
              </div>
              {fuente === 'sim' ? (
                <>
                  <div style={st.fila}>
                    <button style={st.chip(escenario === 'campo')} disabled={corriendo} onClick={() => setEscenario('campo')}>🌾 Campo</button>
                    <button style={st.chip(escenario === 'aula')} disabled={corriendo} onClick={() => setEscenario('aula')}>🏫 Aula</button>
                    <button style={st.mini} disabled={corriendo} onClick={() => setSemilla((n) => n + 1)}>🎲 Otro</button>
                  </div>
                  <label style={st.check}><input type="checkbox" checked={ruido} disabled={corriendo} onChange={(e) => setRuido(e.target.checked)} /> Robot realista (giros imperfectos y sensor con ruido)</label>
                  <label style={st.check}>Velocidad
                    {[1, 4, 16].map((v) => <button key={v} style={st.chip(vel === v)} onClick={() => setVel(v)}>×{v}</button>)}
                  </label>
                </>
              ) : (
                <>
                  <div style={st.fila}>
                    {[['bluetooth', '📶 Bluetooth'], ['cable', '🔌 Cable'], ['antena', '📡 2 CyberPi']].map(([k, t]) => (
                      <button key={k} style={st.chip(conexion === k)} disabled={corriendo || conectado} onClick={() => setConexion(k)}>{t}</button>
                    ))}
                  </div>
                  <div style={st.fila}>
                    {!conectado ? <button style={st.btn('#0284c7')} disabled={(conexion === 'bluetooth' ? !soportaBluetoothCyberpi() : !soportaSerialCyberpi()) || cyber.estado === 'conectando'} onClick={conectar}>{cyber.estado === 'conectando' ? 'Conectando…' : conexion === 'antena' ? 'Conectar la antena CyberPi' : 'Conectar el robot'}</button>
                      : <><span style={{ color: '#86efac', fontWeight: 800 }}>✅ Conectado</span><button style={st.mini} disabled={corriendo} onClick={probarSensor}>📡 Probar el sensor</button><button style={st.mini} disabled={corriendo} onClick={() => desconectarCyberpi()}>Desconectar</button></>}
                  </div>
                  {conexion === 'antena' && (
                    <div style={st.nota}>
                      Con 2 CyberPi: el del robot necesita el <b>receptor nuevo</b>. Conéctalo una vez por cable y pulsa{' '}
                      <button style={st.mini} disabled={corriendo} onClick={async () => { setModoCyberpi('antena'); setAviso((await instalarReceptor()) ? '✅ Receptor instalado: desconecta el robot y conecta la antena.' : '❌ No se pudo instalar el receptor.'); }}>Instalar el receptor</button>
                    </div>
                  )}
                  {cyber.error && <div style={st.aviso}>{cyber.error}</div>}
                  <div style={st.nota}>Pon el robot en la <b>base</b> mirando hacia «arriba» del mapa. Cada paso es una celda de {CELDA} cm.</div>
                </>
              )}
            </div>

            <div style={st.caja}>
              <b>Misión</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {MISIONES.map(([k, t, d]) => (
                  <button key={k} disabled={corriendo} onClick={() => setMision(k)} style={{ ...st.opcion(mision === k) }}>
                    <b>{t}</b><span style={{ fontSize: 12, color: '#94a3b8' }}>{d}</span>
                  </button>
                ))}
              </div>
              {mision === 'explorar' && (
                <label style={st.check}>Tiempo: {[2, 5, 10].map((v) => <button key={v} style={st.chip(minutos === v)} disabled={corriendo} onClick={() => setMinutos(v)}>{v} min</button>)}</label>
              )}
              {mision === 'sembrar' && (
                <div style={{ marginTop: 8 }}>
                  <div style={st.fila}>
                    Campo de
                    <input type="number" step="0.3" min="0.6" max="10" value={ancho} disabled={corriendo} onChange={(e) => ponerRect(Number(e.target.value) || 0.6, largo)} style={st.input} /> ×
                    <input type="number" step="0.3" min="0.6" max="10" value={largo} disabled={corriendo} onChange={(e) => ponerRect(ancho, Number(e.target.value) || 0.6)} style={st.input} /> m
                  </div>
                  <div style={st.fila}>
                    <button style={st.chip(editar)} disabled={corriendo} onClick={() => setEditar((v) => !v)}>✏️ Dibujar en el mapa</button>
                    {mapaBase && <button style={st.mini} disabled={corriendo} onClick={usarMapaComoCampo}>Usar el mapa explorado</button>}
                  </div>
                  {editar && (
                    <div style={st.fila}>
                      {[['campo', '🌱 Campo'], ['obstaculo', '🪨 Obstáculo conocido'], ['borrar', '🧽 Borrar']].map(([k, t]) => <button key={k} style={st.chip(herramienta === k)} onClick={() => setHerramienta(k)}>{t}</button>)}
                    </div>
                  )}
                  <div style={st.nota}>El campo empieza en la base (🏠, esquina de abajo a la izquierda). El tractor no sale de la línea amarilla.</div>
                </div>
              )}
              {mision === 'ir' && <div style={st.nota}>{destino == null ? '👆 Pulsa en el mapa el destino.' : `📍 Destino: ${(((destino % N) - O) * CELDA) / 100} m a la derecha, ${((Math.floor(destino / N) - O) * CELDA) / 100} m al frente.`}{!mapaBase && ' Sin mapa previo irá descubriendo los obstáculos por el camino.'}</div>}
              <div style={{ ...st.fila, marginTop: 10 }}>
                {!corriendo ? <button style={st.btn('#16a34a')} disabled={fuente === 'real' && !conectado} onClick={empezar}>▶ Empezar</button>
                  : <button style={st.btn('#dc2626')} onClick={parar}>⏹ Parar</button>}
              </div>
              {aviso && <div style={{ ...st.aviso, marginTop: 8 }}>{aviso}</div>}
              {resultado?.error && <div style={{ ...st.aviso, marginTop: 8 }}>❌ {resultado.error}</div>}
            </div>

            <div style={st.caja}>
              <b>En directo</b>
              <div style={st.datos}>
                <span>⏱️ {fmtT(rb ? rb.t : reloj.current.ini ? (reloj.current.fin || Date.now()) - reloj.current.ini : 0)}{rb ? ' (robot)' : ''}</span>
                <span>👣 {m?.pasos || 0} pasos</span>
                <span>↪️ {m?.giros || 0} giros</span>
                <span>📡 {m?.ultimaD == null ? '—' : m.ultimaD === 0 ? '⚠️ sin lectura' : m.ultimaD >= 300 ? 'nada (>3 m)' : `${m.ultimaD} cm`}</span>
                {mision === 'sembrar' ? <span>🌱 {sembradas}/{totalCampo} ({totalCampo ? Math.round((sembradas / totalCampo) * 100) : 0} %)</span> : <span>⬜ {libres} libres</span>}
                <span>🧱 {obstaculos} obstáculos</span>
                {rb && <span>💥 {rb.choques} roces</span>}
              </div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{m?.texto || 'Preparado'}</div>
              <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                {(m?.registro || []).map((t, i) => <div key={i}>{t}</div>)}
              </div>
            </div>
          </aside>
          <section style={{ flex: '2 1 420px', minHeight: 360, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <canvas ref={canvasRef} onPointerDown={alPulsar} onPointerMove={alMover}
              style={{ width: '100%', flex: 1, minHeight: 340, borderRadius: 14, background: '#0b1220', cursor: editar || mision === 'ir' ? 'crosshair' : 'default', touchAction: 'none' }}
              aria-label="Mapa de la misión: robot, obstáculos, ruta y campo" />
            <div style={st.leyenda}>
              <span>🏠 base</span><span style={{ color: '#f97316' }}>━ ruta planificada</span><span style={{ color: '#ef4444' }}>■ obstáculo detectado</span>
              {mision === 'sembrar' ? <span style={{ color: '#4ade80' }}>■ sembrado</span> : <span style={{ color: '#38bdf8' }}>■ explorado</span>}
              <span style={{ color: '#facc15' }}>┅ campo</span>{fuente === 'sim' && <span>⬚ donde el robot cree que está</span>}
            </div>
          </section>
        </div>
      )}

      {pestana === 'robot' && (
        <div style={{ ...st.cuerpo, flexDirection: 'column', maxWidth: 900, margin: '0 auto' }}>
          <div style={st.caja}>
            <h3 style={st.h3}>🤖 Programas autónomos (sin ordenador)</h3>
            <p style={st.p}>Se guardan en dos ranuras del robot y se abren desde su menú (<b>switch program</b>), como el test.</p>
            <ul style={st.lista}>
              <li><b>🗺️ Mapear la clase</b>: pon el robot en la base mirando al frente, elige el tiempo (A: 5 min, B: 10 min, arriba: 2 min) y explora solo. Con <b>B</b> vuelve antes a la base. Guarda el mapa.</li>
              <li><b>🧭 Ir y volver</b>: carga el mapa; con el joystick eliges el destino (o lo mandas desde aquí), pulsas el centro y va. Al llegar, <b>A</b> = volver a la base.</li>
            </ul>
            <div style={st.fila}>
              Ranura de «Mapear» <select value={ranuras.mapa} onChange={(e) => setRanuras((r) => ({ ...r, mapa: Number(e.target.value) }))}>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</select>
              y de «Ir y volver» <select value={ranuras.ruta} onChange={(e) => setRanuras((r) => ({ ...r, ruta: Number(e.target.value) }))}>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</select>
              <button style={st.btn('#7c3aed')} disabled={!!instalando || ranuras.mapa === ranuras.ruta || !soportaSerialCyberpi()} onClick={instalar}>{instalando || '🔌 Instalar por cable'}</button>
            </div>
            <div style={st.nota}>No se borra ningún programa que no sea de PiKT: si la ranura está ocupada por otro, avisa y no hace nada.</div>
          </div>
          <div style={st.caja}>
            <h3 style={st.h3}>📥 El mapa del robot</h3>
            <p style={st.p}>Con el robot conectado (Bluetooth o cable, en la pestaña Misiones → mBot2 real) puedes leer el mapa que ha hecho, verlo aquí, usarlo como campo para sembrar o elegir un destino y guardarlo en el robot para «Ir y volver».</p>
            <div style={st.fila}>
              <button style={st.btn('#0284c7')} disabled={!conectado || conexion === 'antena'} onClick={leerMapa}>📥 Leer el mapa del robot</button>
              <button style={st.btn('#0f766e')} disabled={!conectado || conexion === 'antena' || destino == null} onClick={mandarDestino}>📍 Guardar el destino en el robot</button>
            </div>
            {!conectado && <div style={st.nota}>Conecta antes el robot en la pestaña 🎯 Misiones (🤖 mBot2 real).</div>}
            {aviso && <div style={{ ...st.aviso, marginTop: 8 }}>{aviso}</div>}
          </div>
        </div>
      )}

      {pestana === 'como' && (
        <div style={{ ...st.cuerpo, flexDirection: 'column', maxWidth: 900, margin: '0 auto' }}>
          <div style={st.caja}>
            <h3 style={st.h3}>💡 ¿Cómo sabe el robot dónde está y por dónde ir?</h3>
            <ol style={st.lista}>
              <li><b>Rejilla de ocupación.</b> El suelo se divide en celdas de {CELDA} cm. Cada celda empieza «sin explorar»; cada medida del sensor de ultrasonidos la marca como <i>libre</i> (el sonido ha llegado más lejos) u <i>ocupada</i> (ha rebotado ahí). Como se suman muchas medidas, un alumno que pasa por delante no la estropea para siempre.</li>
              <li><b>Odometría.</b> El robot no tiene GPS: sabe dónde está contando lo que ha hecho (avances de 30 cm con los encoders de las ruedas y giros de 90°). Es la «navegación a estima» de los barcos. El problema: los errores se acumulan.</li>
              <li><b>Giroscopio.</b> Después de cada giro el CyberPi mira su giroscopio y corrige lo que se haya pasado o quedado corto. Activa «Robot realista» en el simulador y verás el robot de verdad (azul o verde) y donde él cree que está (⬚).</li>
              <li><b>Frontera.</b> Para explorar, el robot busca la celda libre más cercana que esté junto a una sin explorar y va allí: así va «empujando» la frontera de lo conocido hasta que no queda nada.</li>
              <li><b>Camino más corto (Dijkstra).</b> Para ir a un sitio prueba todos los caminos por orden de coste. Las celdas pegadas a un obstáculo cuestan el triple: así va por el centro de los pasillos, porque el sensor solo ve de frente.</li>
              <li><b>Replanificar.</b> Si al avanzar encuentra algo que no estaba en el mapa (una mochila, una silla), lo apunta y vuelve a calcular el camino. Es lo que hacen las Roomba y los robots de almacén.</li>
              <li><b>Surcos del tractor.</b> Para sembrar no basta con ir a la celda más cercana: un tractor recorre el campo en <b>surcos rectos de ida y vuelta</b> (en zigzag), que es lo que menos giros necesita. Si un árbol corta un surco, lo rodea y sigue.</li>
            </ol>
            <h3 style={st.h3}>🧪 Retos para clase</h3>
            <ul style={st.lista}>
              <li>Mide cuánto tarda el tractor en sembrar un campo de 3 × 2 m y de 6 × 4 m. ¿El tiempo es proporcional al área?</li>
              <li>Cuenta los giros. ¿Por qué los surcos largos necesitan menos giros que los cortos? ¿Cómo orientarías el campo?</li>
              <li>Con «Robot realista», compara el robot de verdad con el ⬚ (donde cree que está): ¿cuánto se equivoca al volver a la base? ¿Y si la misión dura el doble?</li>
              <li>Pon un obstáculo en medio del camino del real (una caja) cuando ya tenga el mapa: ¿lo rodea?</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  raiz: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#0b1d3a 0%,#0f172a 60%)', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  cab: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(0,0,0,.35)', flexWrap: 'wrap' },
  cuerpo: { flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' },
  lateral: { flex: '1 1 300px', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 },
  caja: { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 1.45 },
  fila: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  check: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 13 },
  input: { width: 64, padding: '5px 6px', borderRadius: 8, border: '1px solid #475569', background: '#020617', color: '#f1f5f9', fontSize: 14 },
  mini: { padding: '5px 9px', borderRadius: 8, border: 'none', background: '#334155', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' },
  btn: (c) => ({ padding: '9px 14px', borderRadius: 10, border: 'none', background: c, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }),
  chip: (on) => ({ padding: '5px 10px', borderRadius: 999, border: `1px solid ${on ? '#facc15' : '#475569'}`, background: on ? 'rgba(250,204,21,.15)' : 'transparent', color: '#f1f5f9', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }),
  opcion: (on) => ({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: `2px solid ${on ? '#22c55e' : '#334155'}`, background: on ? 'rgba(34,197,94,.12)' : 'rgba(0,0,0,.2)', color: '#f1f5f9', cursor: 'pointer', fontFamily: 'inherit' }),
  nota: { color: '#94a3b8', fontSize: 12.5, marginTop: 6, lineHeight: 1.45 },
  aviso: { background: 'rgba(250,204,21,.1)', border: '1px solid rgba(250,204,21,.45)', color: '#fde68a', borderRadius: 12, padding: '8px 12px', fontSize: 13.5, lineHeight: 1.45 },
  datos: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 4, marginTop: 6, fontSize: 13, fontVariantNumeric: 'tabular-nums' },
  leyenda: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#cbd5e1' },
  h3: { margin: '0 0 6px', fontSize: 17 },
  p: { margin: '4px 0', color: '#cbd5e1' },
  lista: { margin: '6px 0', paddingLeft: 20, color: '#cbd5e1', lineHeight: 1.55 },
};
