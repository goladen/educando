import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const G = 9.81;

// Umbrales de seguridad (UIAA + biomecánica humana)
const LIM = {
  escalador:  { ok: 4, warn: 7, crit: 9 },   // kN — riesgo lumbar > 9 kN
  anclaje:    { ok: 7, warn: 10, crit: 15 },  // kN — fallo UIAA > 15 kN
  asegurador: { ok: 2, warn: 4, crit: 6 },
  pared:      { ok: 2, warn: 4, crit: 8 },
};

function semaforo(kN, lim) {
  if (kN < lim.ok)   return '#22c55e';
  if (kN < lim.warn) return '#f59e0b';
  if (kN < lim.crit) return '#ef4444';
  return '#fca5a5';
}

// ─── MOTOR DE FÍSICA (fórmulas UIAA estándar) ───────────────────────────────
function calcular({ me, ma, cuerda, distSeguro, tipoCuerda, dinamico, anguloPared }) {
  const L  = Math.max(cuerda, 0.5);
  const h  = Math.min(Math.max(distSeguro, 0.1), L);
  const FF = (2 * h) / L;  // Factor de Caída [0–2]

  // Módulo de impacto de la cuerda (N) — estándar UIAA
  // Cuerda dinámica single: ~45 000 N  |  Estática: ~220 000 N
  const Ea = tipoCuerda === 'dinamica' ? 45000 : 220000;

  // Fuerza sobre el escalador: F = mg + √(2·mg·Ea·FF)
  let Fe = me * G + Math.sqrt(2 * me * G * Ea * FF);

  // Reducción por asegurador dinámico (15–25 %)
  if (dinamico) {
    const ratio = me / Math.max(ma, 30);
    Fe *= 1 - (ratio > 1.2 ? 0.24 : 0.14);
  }

  // Fuerza sobre el último anclaje
  // Ecuación del cabrestante (μ ≈ 0.1, ángulo ≈ 140°) → factor UIAA ×1.66
  const Fa = Fe * 1.66;

  // Fuerza sobre el asegurador (lado opuesto del mosquetón)
  const Fas = (Fe / 1.66) * (dinamico ? 0.7 : 1.0);

  // Alargamiento de la cuerda bajo carga máxima
  const elon = (Fe * L) / Ea;

  // Cinemática
  const caidaLibre = 2 * h;
  const desplAsg   = dinamico ? 0.5 : 0;
  const caidaTotal = caidaLibre + elon + desplAsg;
  const v0         = Math.sqrt(2 * G * caidaLibre);   // velocidad al tensar
  const gF         = Fe / (me * G);                   // g-forces escalador
  const alturaIni  = L + h + 1.8;                     // altura inicial sobre el suelo
  const espacioLib = alturaIni - caidaTotal;

  // ── Velocidad e impacto contra la pared (modelo de péndulo) ──────────────
  // Geometría clave del desplome: el escalador asciende distSeguro POR ENCIMA
  // del seguro sobre una pared que se inclina hacia afuera, así que arranca la
  // caída ya separado de la roca una distancia horizontal distSeguro·cosα.
  // Al caer recto y tensar la cuerda llega con un ángulo de péndulo grande, por
  // lo que barre con fuerza HACIA la pared. Solo dinamizando mucho (más caída
  // vertical → ángulo menor) o en desplomes muy marcados puede no llegar.
  const angR = (anguloPared * Math.PI) / 180;

  // Empujón inicial del escalador al saltar (m)
  const pushOff = 0.40;

  // Cuánto cede el sistema dinámico (salto del asegurador + slack): alarga la
  // caída, la hace más vertical y absorbe energía. Estático = no cede nada.
  const belaySlack = dinamico
    ? Math.min(0.9 + (me > ma ? (me - ma) * 0.015 : 0), 1.9)
    : 0;
  const extraCaida = dinamico ? 0.6 + belaySlack : 0; // m de caída extra por dinamizar

  // Posición del escalador respecto al seguro en el instante en que la cuerda
  // se tensa (x = separación horizontal de la pared, y = caída por debajo):
  const xOff = distSeguro * Math.cos(angR) + pushOff;                 // hacia afuera
  const yOff = Math.max(2 * distSeguro - distSeguro * Math.sin(angR) + extraCaida, 0.3); // hacia abajo

  // Radio del péndulo: distancia al seguro al tensar + estirón de la cuerda
  const rTaut = Math.hypot(xOff, yOff);
  const rPend = Math.max(rTaut + elon, 0.5);

  // Ángulo inicial de la cuerda respecto a la vertical (lado exterior, hacia
  // afuera de la pared). Con cuerda estática es grande; dinamizando se reduce.
  const theta0 = Math.atan2(xOff, yOff);

  // Velocidad al tensar (incluye la caída extra que cede un asegurador dinámico)
  const v0Wall = Math.sqrt(2 * G * (caidaLibre + extraCaida));

  // Al tensar, la velocidad vertical se descompone respecto a la cuerda:
  //  · radial v0·cosθ0  → la absorbe el estirón de la cuerda
  //  · tangencial v0·sinθ0 → impulsa el péndulo (la cuerda no la frena)
  const vTang = v0Wall * Math.sin(theta0);

  // Ángulo, medido desde la vertical, donde el arco del péndulo corta el plano
  // de la pared. En vertical (90°) vale 0 (la roca está justo bajo el seguro);
  // en desplome vale (90°−ángulo): el escalador debe remontar hacia la roca.
  const thetaWall = (90 - anguloPared) * Math.PI / 180;

  // Velocidad al alcanzar el plano de la pared — conservación de energía del
  // péndulo entre θ0 y θ_wall.  v² = vTang² + 2·g·r·(cosθ_wall − cosθ0).
  // En el punto de contacto la cuerda queda paralela a la roca, por lo que esta
  // velocidad tangencial es íntegramente perpendicular a la pared (impacto normal).
  const vImpSq = vTang * vTang + 2 * G * rPend * (Math.cos(thetaWall) - Math.cos(theta0));

  let vPared = 0; // 0 = no toca la pared (vuelo limpio en el aire)
  if (vImpSq > 0) {
    vPared = Math.sqrt(vImpSq);
    // El asegurador dinámico suaviza el barrido: parte de la energía la disipa
    // su desplazamiento. La cuerda por sí sola (estático) absorbe poco.
    if (dinamico) vPared *= 0.82;
  }
  const tocaPared = vPared > 0.3; // por debajo es un roce inapreciable

  // Fuerza de impacto contra la pared: energía cinética disipada en la distancia
  // de absorción del cuerpo (flexión de piernas/brazos ≈ 0,15 m).  F = ½·m·v²/d
  const dBody = 0.15;
  let Fp = tocaPared ? (me * vPared * vPared) / (2 * dBody) : 0;
  Fp = Math.min(Fp, 15000); // tope físico razonable (15 kN)

  // Tiempos (modelo muelle-masa)
  const tLibre = v0 / G;
  const tFreno = (Math.PI / 2) * Math.sqrt((me * L) / Ea);
  const tTotal = tLibre + tFreno;

  return {
    FF, Fe, Fa, Fas, Fp, vPared, tocaPared, elon, caidaLibre, caidaTotal, v0, gF, espacioLib,
    tLibre, tFreno, tTotal,
    feKN:   (Fe    / 1000).toFixed(2),
    faKN:   (Fa    / 1000).toFixed(2),
    fasKN:  (Fas   / 1000).toFixed(2),
    fpKN:   (Fp    / 1000).toFixed(2),
    vParedMS: vPared.toFixed(1),
    elongM:      elon.toFixed(2),
    caidaLibreM: caidaLibre.toFixed(1),
    caidaTotalM: caidaTotal.toFixed(1),
    v0MS:        v0.toFixed(1),
    gFS:         gF.toFixed(1),
    espacioLibM: espacioLib.toFixed(1),
    tTotalS:     tTotal.toFixed(2),
  };
}

const PRESETS = [
  { label: 'Muy Desplomado', anguloPared: 60,  cuerda: 18, distSeguro: 3,  tipoCuerda: 'dinamica', dinamico: false },
  { label: 'Desplomado',   anguloPared: 75,  cuerda: 20, distSeguro: 3,  tipoCuerda: 'dinamica', dinamico: false },
  { label: 'Vertical',      anguloPared: 90,  cuerda: 15, distSeguro: 2,  tipoCuerda: 'dinamica', dinamico: false },
  { label: 'Factor 1 alto', anguloPared: 90,  cuerda: 10, distSeguro: 5,  tipoCuerda: 'dinamica', dinamico: false },
  { label: 'Cuerda estáti.',anguloPared: 85,  cuerda: 15, distSeguro: 2,  tipoCuerda: 'estatica', dinamico: false },
  { label: 'Vuelo limpio',  anguloPared: 90,  cuerda: 30, distSeguro: 1,  tipoCuerda: 'dinamica', dinamico: true  },
];

// ─── COMPONENTES AUXILIARES ─────────────────────────────────────────────────
function Slider({ label, valor, min, max, step = 1, unidad, color, onChange, note }) {
  return (
    <div style={{ background: '#334155', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
        <span style={{ color: '#cbd5e1' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{valor} {unidad}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={valor}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }} />
      {note && <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function MetricaCard({ titulo, valor, unidad, color, sub, limText }) {
  return (
    <div style={{ background: '#1e293b', borderLeft: `4px solid ${color}`, borderRadius: '0 10px 10px 0', padding: '11px 14px' }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>
        {valor} <span style={{ fontSize: 14 }}>{unidad}</span>
      </div>
      {sub     && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>}
      {limText && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{limText}</div>}
    </div>
  );
}

function Fila({ label, val, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: bold ? '#f8fafc' : '#cbd5e1', fontWeight: bold ? 700 : 400 }}>{val}</span>
    </div>
  );
}

function Persona({ cx, baseY, color }) {
  return (
    <g>
      <circle cx={cx} cy={baseY - 17} r={4} fill={color} />
      <line x1={cx} y1={baseY - 13} x2={cx} y2={baseY - 6} stroke={color} strokeWidth={3} />
      <line x1={cx} y1={baseY - 11} x2={cx - 7} y2={baseY - 7} stroke={color} strokeWidth={2} />
      <line x1={cx} y1={baseY - 11} x2={cx + 7} y2={baseY - 7} stroke={color} strokeWidth={2} />
      <line x1={cx} y1={baseY - 6}  x2={cx - 5} y2={baseY}     stroke={color} strokeWidth={2.5} />
      <line x1={cx} y1={baseY - 6}  x2={cx + 5} y2={baseY}     stroke={color} strokeWidth={2.5} />
    </g>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
const App = () => {
  const [me,          setMe]          = useState(70);
  const [ma,          setMa]          = useState(65);
  const [cuerda,      setCuerda]      = useState(15);
  const [distSeguro,  setDistSeguro]  = useState(3);
  const [tipoCuerda,  setTipoCuerda]  = useState('dinamica');
  const [dinamico,    setDinamico]    = useState(false);
  const [anguloPared, setAnguloPared] = useState(90);
  const [velSim,      setVelSim]      = useState(0.3);

  const [simT,    setSimT]    = useState(0);
  const [running, setRunning] = useState(false);
  const rafRef   = useRef(null);
  const prevTRef = useRef(null);

  const d = useMemo(() => calcular({ me, ma, cuerda, distSeguro, tipoCuerda, dinamico, anguloPared }),
    [me, ma, cuerda, distSeguro, tipoCuerda, dinamico, anguloPared]);

  const reset = useCallback(() => {
    setRunning(false);
    setSimT(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    prevTRef.current = null;
  }, []);

  const aplicarPreset = p => {
    reset();
    setAnguloPared(p.anguloPared);
    setCuerda(p.cuerda);
    setDistSeguro(p.distSeguro);
    setTipoCuerda(p.tipoCuerda);
    setDinamico(p.dinamico);
  };

  const tick = useCallback(ts => {
    if (prevTRef.current === null) prevTRef.current = ts;
    const dt = ((ts - prevTRef.current) / 1000) * velSim;
    prevTRef.current = ts;
    setSimT(prev => {
      const next = prev + dt;
      // Parar si se agota el tiempo O si el escalador alcanza el suelo
      if (next >= d.tTotal + 0.4) { setRunning(false); return d.tTotal; }
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [velSim, d.tTotal]);

  useEffect(() => {
    if (running) rafRef.current = requestAnimationFrame(tick);
    else if (rafRef.current) cancelAnimationFrame(rafRef.current);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, tick]);

  // ── Geometría SVG ──────────────────────────────────────────────────────────
  const SVG_W = 520, SVG_H = 480;
  const gndY  = 440;
  const wallX = 360;
  const PX_M  = 12;
  const angR  = (anguloPared * Math.PI) / 180;

  const wallPt = metros => ({
    x: wallX - metros * PX_M * Math.cos(angR),
    y: gndY  - metros * PX_M * Math.sin(angR),
  });

  // Normal hacia el exterior de la pared (dirección del escalador)
  const normalX =  -Math.sin(angR);  // componente horizontal (siempre hacia la izquierda)
  const normalY =   Math.cos(angR);  // componente vertical (0 en vertical, >0 en placa)
  const bodyOff = 10; // px — separación del cuerpo respecto a la pared

  const altSeguro    = Math.max(cuerda - distSeguro, 1.5);
  const ptSeguro     = wallPt(altSeguro);
  const altEscIni    = altSeguro + distSeguro;
  const ptEscOnWall  = wallPt(altEscIni); // punto de la pared (para la cuerda)
  const ptEscIni     = { x: ptEscOnWall.x + normalX * bodyOff, y: ptEscOnWall.y + normalY * bodyOff };
  const primerSeguro = wallPt(2); // primer anclaje fijo a 2 m del suelo
  const asegX        = wallX - 28;

  // ── Parámetros del péndulo ────────────────────────────────────────────────
  // Radio del péndulo: desde el seguro hasta el escalador
  // distSeguro + alargamiento cuerda + slack extra si el asegurador dinamiza
  const belay_extra = dinamico ? Math.min(1.2 + (me > ma ? (me - ma) * 0.02 : 0), 2.5) : 0;
  const pendR_m  = distSeguro + d.elon + belay_extra; // metros
  const pendR_px = pendR_m * PX_M;
  const pivotX   = ptSeguro.x;
  const pivotY   = ptSeguro.y;

  // Push-off: separación inicial en dirección normal a la pared
  const pushPx   = 16 + Math.abs(anguloPared - 90) * 0.5; // px extra de separación
  // Posición del escalador cuando la cuerda se tensa (fin caída libre)
  const xAtTaut  = ptEscIni.x + normalX * pushPx;
  const yAtTaut  = ptEscIni.y + normalY * pushPx + d.caidaLibre * PX_M;
  const dxTaut   = xAtTaut - pivotX;
  const dyTaut   = yAtTaut - pivotY;
  const thetaIni = Math.atan2(dxTaut, dyTaut); // ángulo desde vertical (rad)

  // Frecuencia y amortiguación del péndulo
  const omega_p  = Math.sqrt(G / Math.max(pendR_m, 0.5));
  const gamma_p  = 0.55; // amortiguación (rozamiento en cuerda + harness)

  // ── Posición dinámica del escalador ──────────────────────────────────────
  let escX = ptEscIni.x, escY = ptEscIni.y;
  let progresoFreno = 0, fuerzaActual = 0;
  let wallHit = false;

  if (simT > 0 && simT <= d.tLibre) {
    // ── FASE 1: caída libre + push-off perpendicular a la pared ───────────
    const t        = simT;
    const t_push   = 0.18;
    const pushFrac = Math.min(1, t / t_push);
    const push     = pushPx * Math.sin((pushFrac * Math.PI) / 2); // ease-out
    const fallDist = 0.5 * G * t * t;
    // Push en dirección normal a la pared (outward) + caída vertical por gravedad
    escX = ptEscIni.x + normalX * push;
    escY = ptEscIni.y + normalY * push + fallDist * PX_M;

  } else if (simT > d.tLibre && simT <= d.tLibre + d.tFreno) {
    // ── FASE 2: cuerda tensa — deceleración y inicio del péndulo ─────────────
    const tF      = simT - d.tLibre;
    progresoFreno = d.tFreno > 0 ? Math.min(tF / d.tFreno, 1) : 1;
    fuerzaActual  = d.Fe * Math.sin((Math.PI / 2) * progresoFreno);

    // El escalador pasa de (xAtTaut, yAtTaut) a colgar del seguro (arco)
    // El ángulo va de thetaIni → 0 durante la deceleración
    const theta = thetaIni * (1 - Math.sin((Math.PI / 2) * progresoFreno));
    escX = pivotX + pendR_px * Math.sin(theta);
    escY = pivotY + pendR_px * Math.cos(theta);

  } else if (simT > d.tLibre + d.tFreno) {
    // ── FASE 3: péndulo amortiguado ──────────────────────────────────────────
    // Al terminar la deceleración, el escalador está aprox. colgando del seguro
    // con ángulo ≈ 0 y velocidad angular residual → péndulo libre
    const tPend = simT - d.tLibre - d.tFreno;
    // El escalador rebota levemente y oscila — la amplitud inicial del rebote
    // es pequeña (el freno absorbió la mayor parte) y se amortigua rápido
    const thetaRebote = thetaIni * 0.25; // amplitud de rebote residual
    const theta = thetaRebote * Math.exp(-gamma_p * tPend) * Math.cos(omega_p * tPend);
    escX = pivotX + pendR_px * Math.sin(theta);
    escY = pivotY + pendR_px * Math.cos(theta);
    fuerzaActual = d.Fe * 0.18 * Math.exp(-gamma_p * tPend);

  }

  // ── Distancia perpendicular a la superficie de la pared ─────────────────
  // Positiva = escalador al exterior (lado de la escalada), negativa = dentro de la roca
  const wallDist = (escX - wallX) * normalX + (escY - gndY) * normalY;

  // Si el péndulo empuja al escalador hacia dentro de la roca, lo sacamos al exterior
  if (wallDist < bodyOff) {
    const back = bodyOff - wallDist;
    escX += normalX * back;
    escY += normalY * back;
  }

  // Contacto con la pared: escalador rozando o chocando la superficie
  wallHit = simT > d.tLibre && wallDist <= bodyOff + 6;

  // Bloquear al escalador en el suelo — pies nunca traspasan gndY
  const groundContact = escY >= gndY;
  if (groundContact) escY = gndY;

  const pctF    = Math.min(fuerzaActual / Math.max(d.Fe, 1), 1);
  const cintEsc = escY - 10;

  // ── Movimiento del asegurador ────────────────────────────────────────────
  // Si dinamiza: salta y se desplaza hacia la pared para absorber energía
  let asegXAnim = asegX;
  let asegYAnim = gndY;
  if (dinamico && simT > d.tLibre) {
    const tF   = Math.min(simT - d.tLibre, d.tFreno);
    const pr   = d.tFreno > 0 ? tF / d.tFreno : 1;
    // Desplazamiento horizontal hacia la pared (cuerda que suelta)
    const maxDx = belay_extra * PX_M;
    asegXAnim  = asegX + maxDx * (1 - Math.cos((Math.PI / 2) * pr)); // ease-out
    // Salto parabólico: sube y baja durante el frenado
    asegYAnim  = gndY - 20 * Math.sin(Math.PI * Math.min(pr, 1));
  }
  const cintAsg = asegYAnim - 10;

  const completado = !running && simT > 0;

  // ── Colores semáforo ───────────────────────────────────────────────────────
  const cFe  = semaforo(parseFloat(d.feKN),  LIM.escalador);
  const cFa  = semaforo(parseFloat(d.faKN),  LIM.anclaje);
  const cFas = semaforo(parseFloat(d.fasKN), LIM.asegurador);
  const cFp  = semaforo(parseFloat(d.fpKN),  LIM.pared);
  const cEsp = d.espacioLib < 0 ? '#ef4444' : d.espacioLib < 2 ? '#f59e0b' : '#22c55e';
  const cFF  = d.FF > 1.5 ? '#ef4444' : d.FF > 0.7 ? '#f59e0b' : '#22c55e';

  const labelPared = anguloPared >= 88 ? 'Vertical' : anguloPared >= 73 ? 'Desplomado' : 'Muy desplomado';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ══ PANEL IZQUIERDO — PARÁMETROS ══════════════════════════════════════ */}
      <div style={{ width: '29%', minWidth: 290, padding: '16px 18px', overflowY: 'auto', background: '#1e293b', borderRight: '3px solid #334155', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8' }}>🧗 Simulador de Caída</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Modelo físico UIAA · Fuerzas reales de impacto</div>
        </div>

        {/* Presets */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => aplicarPreset(p)}
              style={{ padding: '7px 4px', fontSize: 10, background: '#334155', border: '1px solid #475569', borderRadius: 7, color: '#cbd5e1', cursor: 'pointer', lineHeight: 1.3 }}>
              {p.label}
            </button>
          ))}
        </div>

        <Slider label="Masa Escalador" valor={me} min={40} max={120} unidad="kg" color="#f59e0b"
          onChange={v => { setMe(v); reset(); }} />
        <Slider label="Masa Asegurador" valor={ma} min={40} max={120} unidad="kg" color="#38bdf8"
          onChange={v => { setMa(v); reset(); }} />
        <Slider label="Cuerda disponible (L)" valor={cuerda} min={5} max={50} unidad="m" color="#a78bfa"
          onChange={v => { setCuerda(v); reset(); }}
          note="Metros de cuerda entre escalador y asegurador" />
        <Slider label="Distancia al último seguro (h)" valor={distSeguro} min={0.5} max={12} step={0.5} unidad="m" color="#f43f5e"
          onChange={v => { setDistSeguro(v); reset(); }}
          note="Metros por encima del último punto de protección" />
        <Slider label={`Ángulo de pared — ${labelPared}`} valor={anguloPared} min={55} max={90} step={5} unidad="°" color="#10b981"
          onChange={v => { setAnguloPared(v); reset(); }}
          note="90° = vertical · <80° = placa · 60° = placa muy tendida" />

        {/* Tipo cuerda */}
        <div style={{ background: '#334155', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 7 }}>Tipo de Cuerda</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[['dinamica', '⚡ Dinámica'], ['estatica', '🧱 Estática']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setTipoCuerda(val); reset(); }}
                style={{ flex: 1, padding: '8px', background: tipoCuerda === val ? '#38bdf8' : '#1e293b', color: tipoCuerda === val ? '#0f172a' : '#cbd5e1', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                {lbl}
              </button>
            ))}
          </div>
          {tipoCuerda === 'estatica' && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 6, fontWeight: 600 }}>⚠️ Prohibida en escalada deportiva — fuerzas letales</div>}
        </div>

        {/* Asegurador dinamiza */}
        <div style={{ background: '#334155', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 7 }}>Asegurador Dinamiza</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[[true, '✅ Sí'], [false, '❌ No']].map(([val, lbl]) => (
              <button key={String(val)} onClick={() => { setDinamico(val); reset(); }}
                style={{ flex: 1, padding: '8px', background: dinamico === val ? '#38bdf8' : '#1e293b', color: dinamico === val ? '#0f172a' : '#cbd5e1', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 5 }}>Saltar / deslizar cuerda reduce fuerzas 15–25 %</div>
        </div>

        {/* Velocidad sim */}
        <div style={{ background: '#334155', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 7 }}>Velocidad de Simulación</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[[0.12, '🐢 Lenta'], [0.35, '🏃 Media'], [1.0, '⚡ Real']].map(([v, lbl]) => (
              <button key={v} onClick={() => setVelSim(v)}
                style={{ flex: 1, padding: '7px 3px', background: velSim === v ? '#6366f1' : '#1e293b', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ══ PANEL CENTRAL — MAGNITUDES ════════════════════════════════════════ */}
      <div style={{ width: '27%', minWidth: 270, padding: '16px 18px', overflowY: 'auto', background: '#111827', borderRight: '3px solid #334155', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Factor de Caída — métrica clave */}
        <div style={{ background: '#0f172a', border: `2px solid ${cFF}`, borderRadius: 14, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#64748b', marginBottom: 2 }}>FACTOR DE CAÍDA  (FF = 2h / L)</div>
          <div style={{ fontSize: 54, fontWeight: 900, color: cFF, lineHeight: 1 }}>{d.FF.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>= 2 × {distSeguro} m / {cuerda} m</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8, fontSize: 10 }}>
            <span style={{ color: '#22c55e' }}>● &lt;0.5 Leve</span>
            <span style={{ color: '#f59e0b' }}>● 0.5–1 Moderado</span>
            <span style={{ color: '#ef4444' }}>● &gt;1 Peligroso</span>
          </div>
        </div>

        <MetricaCard titulo="Fuerza sobre el Escalador"
          valor={d.feKN} unidad="kN" color={cFe}
          sub={`${d.gFS} g · v₀ = ${d.v0MS} m/s al tensar`}
          limText="Riesgo lumbar grave > 9 kN" />

        <MetricaCard titulo="Fuerza sobre el Último Anclaje"
          valor={d.faKN} unidad="kN" color={cFa}
          sub="Rozamiento mosquetón ×1.66 (UIAA)"
          limText="Fallo anclaje UIAA > 15 kN" />

        <MetricaCard titulo="Fuerza sobre el Asegurador"
          valor={d.fasKN} unidad="kN" color={cFas}
          sub={dinamico ? 'Reducida por dinamizar' : 'Asegurador estático'} />

        <MetricaCard titulo={`Impacto Pared (${labelPared})`}
          valor={d.tocaPared ? d.fpKN : '—'} unidad={d.tocaPared ? 'kN' : ''} color={d.tocaPared ? cFp : '#22c55e'}
          sub={d.tocaPared
            ? `v impacto: ${d.vParedMS} m/s · golpe de péndulo contra la roca`
            : 'Vuelo limpio · el escalador no llega a tocar la pared'}
          limText="Golpe peligroso > 5 kN o > 4 m/s" />

        {/* Cinemática */}
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Cinemática de la Caída</div>
          <Fila label="Caída libre (2h)"         val={`${d.caidaLibreM} m`} />
          <Fila label="Alargamiento cuerda"       val={`${d.elongM} m`} />
          {dinamico && <Fila label="Desplaz. asegurador" val="0.5 m" />}
          <Fila label="Caída total"               val={`${d.caidaTotalM} m`} bold />
          <Fila label="Velocidad al tensar cuerda" val={`${d.v0MS} m/s`} />
          <Fila label="Tiempo de parada"          val={`${d.tTotalS} s`} />
        </div>

        {/* Espacio libre */}
        <div style={{ background: d.espacioLib < 0 ? '#450a0a' : '#1e293b', border: `2px solid ${cEsp}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#64748b' }}>ESPACIO LIBRE HASTA EL SUELO</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: cEsp, margin: '4px 0' }}>
            {d.espacioLib < 0 ? '⛔ SUELO' : `${d.espacioLibM} m`}
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Altura inicial estimada: {(cuerda + distSeguro + 1.8).toFixed(1)} m</div>
          {d.espacioLib < 0  && <div style={{ color: '#fca5a5', fontSize: 11, fontWeight: 700, marginTop: 4 }}>¡El escalador impacta el suelo con esta configuración!</div>}
          {d.espacioLib >= 0 && d.espacioLib < 2 && <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, marginTop: 4 }}>⚠️ Margen muy escaso al suelo</div>}
        </div>

        {tipoCuerda === 'estatica' && (
          <div style={{ background: '#7f1d1d', borderRadius: 10, padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
            🚨 CUERDA ESTÁTICA PROHIBIDA<br />
            <span style={{ fontWeight: 400, fontSize: 10 }}>Las fuerzas generadas ({d.faKN} kN sobre anclajes) son destructivas. Las cuerdas estáticas no absorben energía de impacto.</span>
          </div>
        )}

      </div>

      {/* ══ PANEL DERECHO — SIMULACIÓN ════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#0a0f1e', boxSizing: 'border-box' }}>

        <div style={{ fontSize: 12, color: '#334155', textAlign: 'center' }}>
          Escalador {me} kg · Cuerda {cuerda} m · h = {distSeguro} m · {labelPared} {anguloPared}°
        </div>

        {/* SVG */}
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', maxWidth: SVG_W, flex: 1, background: '#020617', borderRadius: 14, border: '2px solid #1e293b' }}>

          {/* Suelo */}
          <rect x={0} y={gndY} width={SVG_W} height={SVG_H - gndY} fill="#0f172a" />
          <line x1={0} y1={gndY} x2={SVG_W} y2={gndY} stroke="#334155" strokeWidth={6} />
          <text x={8} y={gndY - 5} fill="#334155" fontSize={9}>SUELO</text>

          {/* Pared (gruesa = roca, fina = eje de referencia) */}
          <line x1={wallX} y1={gndY}
            x2={wallX - 560 * Math.cos(angR)} y2={gndY - 560 * Math.sin(angR)}
            stroke="#334155" strokeWidth={22} />
          <line x1={wallX} y1={gndY}
            x2={wallX - 560 * Math.cos(angR)} y2={gndY - 560 * Math.sin(angR)}
            stroke="#1e293b" strokeWidth={16} />

          {/* Indicador ángulo */}
          <path d={`M ${wallX} ${gndY - 36} A 36 36 0 0 0 ${wallX - 36 * Math.cos(angR)} ${gndY - 36 * Math.sin(angR)}`}
            fill="none" stroke="#475569" strokeWidth={1.5} />
          <text x={wallX - 22} y={gndY - 40} fill="#64748b" fontSize={10}>{anguloPared}°</text>

          {/* Primer seguro (fijo a 2 m del suelo) */}
          <circle cx={primerSeguro.x} cy={primerSeguro.y} r={5} fill="#f59e0b" stroke="#fbbf24" strokeWidth={1.5} />
          <text x={primerSeguro.x - 6} y={primerSeguro.y - 9} fill="#fbbf24" fontSize={8} textAnchor="middle">1er 2m</text>

          {/* Último seguro (punto crítico) */}
          <circle cx={ptSeguro.x} cy={ptSeguro.y} r={7} fill="#ef4444" stroke="#fca5a5" strokeWidth={2} />
          <text x={ptSeguro.x - 8} y={ptSeguro.y - 12} fill="#fca5a5" fontSize={9} fontWeight="bold" textAnchor="middle">Seguro</text>

          {/* Cuerda: asegurador → 1er seguro → último seguro → escalador
               Se comba bajo la gravedad cuando la cuerda está floja (caída libre).
               Usamos bezier cuadrática: el punto de control baja 'sag' píxeles. */}
          {(() => {
            // Comba: 0 = tensa, 1 = máximo slack (caída libre)
            let slack = 0;
            if (simT > 0 && simT <= d.tLibre)
              slack = simT / d.tLibre;          // 0 → 1 durante caída libre
            else if (simT > d.tLibre)
              slack = Math.max(0, 1 - progresoFreno); // 1 → 0 durante frenado

            const sag = (x1, y1, x2, y2, k) => {
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2 + slack * k;
              return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
            };

            const taut    = slack < 0.05;
            const color   = taut || progresoFreno > 0 ? '#4ade80' : '#166534';
            const dash    = taut ? 'none' : '4 3';
            const wThin   = 2;
            const wMain   = progresoFreno > 0 ? 3 : 2;

            return (
              <>
                {/* asegurador → primer seguro */}
                <path d={sag(asegXAnim, cintAsg, primerSeguro.x, primerSeguro.y, 10)}
                  stroke="#4ade80" strokeWidth={wThin} fill="none" opacity={0.7}
                  strokeDasharray={dash} />
                {/* primer seguro → último seguro */}
                <path d={sag(primerSeguro.x, primerSeguro.y, ptSeguro.x, ptSeguro.y, 9)}
                  stroke="#4ade80" strokeWidth={wThin} fill="none" opacity={0.7}
                  strokeDasharray={dash} />
                {/* último seguro → escalador  (mayor comba: es el tramo activo) */}
                <path d={sag(ptSeguro.x, ptSeguro.y, escX, cintEsc, 44)}
                  stroke={color} strokeWidth={wMain} fill="none" opacity={0.85}
                  strokeDasharray={dash} />
              </>
            );
          })()}

          {/* Asegurador (animado si dinamiza) */}
          <Persona cx={asegXAnim} baseY={asegYAnim} color="#38bdf8" />
          <text x={asegXAnim - 18} y={asegYAnim - 24} fill="#38bdf8" fontSize={9} fontWeight="bold">
            Asg {ma}kg{dinamico && simT > d.tLibre ? ' ↑' : ''}
          </text>

          {/* Escalador */}
          <Persona cx={escX} baseY={escY}
            color={groundContact ? '#ef4444' : wallHit ? '#fb923c' : '#f59e0b'} />
          <text x={escX + 10} y={escY - 22}
            fill={groundContact ? '#ef4444' : wallHit ? '#fb923c' : '#f59e0b'}
            fontSize={9} fontWeight="bold">Esc {me}kg</text>

          {/* Posición inicial (referencia) */}
          {simT === 0 && (
            <line x1={ptEscIni.x - 14} y1={ptEscIni.y}
              x2={ptEscIni.x + 14} y2={ptEscIni.y}
              stroke="#f59e0b" strokeDasharray="3,3" strokeWidth={1.5} opacity={0.4} />
          )}

          {/* ── FLECHA FUERZA ESCALADOR ── */}
          {progresoFreno > 0.04 && (() => {
            const len = 20 + pctF * 55;
            const fx = escX - 40, fy1 = cintEsc, fy2 = cintEsc - len;
            return (
              <g opacity={Math.min(1, progresoFreno * 2.5)}>
                <defs>
                  <marker id="aFe" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill={cFe} />
                  </marker>
                </defs>
                <line x1={fx} y1={fy1} x2={fx} y2={fy2} stroke={cFe} strokeWidth={3} markerEnd="url(#aFe)" />
                <text x={fx - 3} y={fy2 - 4} fill={cFe} fontSize={10} fontWeight="bold" textAnchor="middle">
                  {(d.Fe * progresoFreno / 1000).toFixed(1)} kN
                </text>
              </g>
            );
          })()}

          {/* ── FLECHA FUERZA ANCLAJE ── */}
          {progresoFreno > 0.04 && (() => {
            const len = 15 + pctF * 40;
            return (
              <g opacity={Math.min(1, progresoFreno * 2.5)}>
                <defs>
                  <marker id="aFa" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill={cFa} />
                  </marker>
                </defs>
                <line x1={ptSeguro.x + 12} y1={ptSeguro.y}
                  x2={ptSeguro.x + 12} y2={ptSeguro.y - len}
                  stroke={cFa} strokeWidth={3} markerEnd="url(#aFa)" />
                <text x={ptSeguro.x + 16} y={ptSeguro.y - len - 4}
                  fill={cFa} fontSize={9} fontWeight="bold">{d.faKN} kN</text>
              </g>
            );
          })()}

          {/* ── IMPACTO PARED: flecha velocidad + flecha fuerza ── */}
          {wallHit && d.tocaPared && (() => {
            const vVal   = parseFloat(d.vParedMS);
            const fVal   = parseFloat(d.fpKN);
            const severe = fVal > 5;
            const vLen   = Math.min(10 + vVal * 9, 80);  // flecha velocidad (escala m/s)
            const fLen   = Math.min(10 + fVal * 6, 70);  // flecha fuerza   (escala kN)
            const cVel   = '#06b6d4'; // cyan para velocidad
            const yVel   = cintEsc - 14; // fila superior: velocidad
            const yFza   = cintEsc + 6;  // fila inferior: fuerza
            return (
              <g>
                <defs>
                  <marker id="mVel" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill={cVel} />
                  </marker>
                  <marker id="mFp" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill={cFp} />
                  </marker>
                </defs>

                {/* Halo de impacto */}
                <circle cx={escX} cy={cintEsc} r={26}
                  fill={`rgba(239,68,68,${severe ? 0.22 : 0.08})`}
                  stroke={cFp} strokeWidth={1.5} strokeDasharray="4,3" />

                {/* ── Flecha velocidad de impacto (cyan, fila superior) ── */}
                <line x1={escX + 14} y1={yVel} x2={escX + 14 + vLen} y2={yVel}
                  stroke={cVel} strokeWidth={2.5} markerEnd="url(#mVel)" />
                <rect x={escX + 17 + vLen} y={yVel - 9} width={64} height={13}
                  rx={3} fill="rgba(0,0,0,0.75)" />
                <text x={escX + 49 + vLen} y={yVel + 1}
                  fill={cVel} fontSize={9} fontWeight="bold" textAnchor="middle">
                  v = {d.vParedMS} m/s
                </text>

                {/* ── Flecha fuerza de impacto (semáforo, fila inferior) ── */}
                <line x1={escX + 14} y1={yFza} x2={escX + 14 + fLen} y2={yFza}
                  stroke={cFp} strokeWidth={3} markerEnd="url(#mFp)" />
                <rect x={escX + 17 + fLen} y={yFza - 9} width={64} height={13}
                  rx={3} fill="rgba(0,0,0,0.75)" />
                <text x={escX + 49 + fLen} y={yFza + 1}
                  fill={cFp} fontSize={9} fontWeight="bold" textAnchor="middle">
                  F = {d.fpKN} kN
                </text>

                {/* Etiqueta superior */}
                <text x={escX} y={cintEsc - 35}
                  fill={cFp} fontSize={11} fontWeight="bold" textAnchor="middle">
                  {severe ? '💥 IMPACTO FUERTE' : '⚡ Toca pared'}
                </text>
              </g>
            );
          })()}

          {/* Barra de fuerza en tiempo real */}
          {simT > 0 && (
            <g>
              <rect x={SVG_W - 28} y={40} width={16} height={SVG_H - 80} fill="#1e293b" rx={5} />
              <rect
                x={SVG_W - 28}
                y={40 + (SVG_H - 80) * (1 - pctF)}
                width={16}
                height={(SVG_H - 80) * pctF}
                fill={cFe} rx={5} opacity={0.85}
              />
              <text x={SVG_W - 20} y={35}       fill="#64748b" fontSize={8} textAnchor="middle">Fuerza</text>
              <text x={SVG_W - 20} y={SVG_H - 34} fill="#64748b" fontSize={8} textAnchor="middle">0 kN</text>
              <text x={SVG_W - 20} y={44}       fill="#64748b" fontSize={8} textAnchor="middle">{d.feKN}</text>
            </g>
          )}

          {/* ── IMPACTO SUELO ── */}
          {groundContact && (
            <g>
              {/* Flash rojo en el suelo */}
              <rect x={0} y={gndY - 30} width={SVG_W} height={35} fill="rgba(239,68,68,0.35)" />
              <text x={SVG_W / 2} y={gndY - 10} fill="#fca5a5" fontSize={13} fontWeight="bold" textAnchor="middle">
                ⛔ IMPACTO SUELO — PELIGRO MORTAL
              </text>
              {/* Círculo de impacto */}
              <circle cx={escX} cy={gndY - 22} r={28} fill="rgba(239,68,68,0.25)" stroke="#ef4444" strokeWidth={2} strokeDasharray="4,3" />
            </g>
          )}

          {/* Alerta estática suelo (sin animación) */}
          {!groundContact && d.espacioLib < 0 && (
            <text x={SVG_W / 2} y={gndY - 10} fill="#ef4444" fontSize={11} fontWeight="bold" textAnchor="middle">⛔ SUELO — CONFIGURACIÓN PELIGROSA</text>
          )}

        </svg>

        {/* Controles */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button
            onClick={() => { setSimT(0); prevTRef.current = null; setRunning(true); }}
            disabled={running}
            style={{ padding: '11px 26px', fontSize: 14, fontWeight: 700, background: running ? '#334155' : '#22c55e', color: running ? '#64748b' : '#0f172a', border: 'none', borderRadius: 10, cursor: running ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
            {running ? '⏳ Simulando...' : completado ? '🔁 Repetir caída' : '▶ Simular caída'}
          </button>
          <button onClick={reset}
            style={{ padding: '11px 22px', fontSize: 14, fontWeight: 700, background: '#475569', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            ↺ Restablecer
          </button>
        </div>

      </div>
    </div>
  );
};

export default App;
