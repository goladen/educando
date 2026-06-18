import { useState, useEffect, useRef, useMemo } from 'react';

// ─── DATOS DE ELEMENTOS ───────────────────────────────────────────────────────
const ELEMENTS = {
  H:  { name: 'Hidrógeno', protons: 1,  neutrons: 0,   electrons: 1,  masa: 1.008,   color: '#3b82f6' },
  He: { name: 'Helio',     protons: 2,  neutrons: 2,   electrons: 2,  masa: 4.003,   color: '#10b981' },
  Li: { name: 'Litio',     protons: 3,  neutrons: 4,   electrons: 3,  masa: 6.941,   color: '#8b5cf6' },
  Be: { name: 'Berilio',   protons: 4,  neutrons: 5,   electrons: 4,  masa: 9.012,   color: '#06b6d4' },
  C:  { name: 'Carbono',   protons: 6,  neutrons: 6,   electrons: 6,  masa: 12.011,  color: '#64748b' },
  N:  { name: 'Nitrógeno', protons: 7,  neutrons: 7,   electrons: 7,  masa: 14.007,  color: '#2563eb' },
  O:  { name: 'Oxígeno',   protons: 8,  neutrons: 8,   electrons: 8,  masa: 15.999,  color: '#ef4444' },
  Na: { name: 'Sodio',     protons: 11, neutrons: 12,  electrons: 11, masa: 22.990,  color: '#f59e0b' },
  Fe: { name: 'Hierro',    protons: 26, neutrons: 30,  electrons: 26, masa: 55.845,  color: '#ea580c' },
  Au: { name: 'Oro',       protons: 79, neutrons: 118, electrons: 79, masa: 196.967, color: '#eab308' },
};

// ─── QUIZ (10 preguntas sobre masas y partículas) ─────────────────────────────
const QUIZ = [
  {
    q: '¿Cuántos protones tiene el átomo de Carbono (C)?',
    opts: ['4', '6', '8', '12'],
    ans: 1,
    exp: 'El número atómico Z = 6 indica exactamente los protones. La masa 12 u.m.a. es A, no Z.',
  },
  {
    q: '¿Cuál es la masa atómica aproximada del Oxígeno (O)?',
    opts: ['8 u.m.a.', '12 u.m.a.', '16 u.m.a.', '32 u.m.a.'],
    ans: 2,
    exp: 'El Oxígeno tiene 8 protones + 8 neutrones = masa atómica ≈ 16 u.m.a.',
  },
  {
    q: '¿Cuántos electrones tiene el Helio (He) en estado neutro?',
    opts: ['1', '2', '3', '4'],
    ans: 1,
    exp: 'En un átomo neutro, electrones = protones = Z. Para el Helio, Z = 2.',
  },
  {
    q: '¿Qué partícula subatómica no tiene carga eléctrica?',
    opts: ['Protón (+1e)', 'Electrón (−1e)', 'Neutrón (0)', 'Positrón (+1e)'],
    ans: 2,
    exp: 'El neutrón es eléctricamente neutro. Fue propuesto por Chadwick en 1932.',
  },
  {
    q: 'El isótopo C-12 tiene 6 protones. ¿Cuántos neutrones tiene?',
    opts: ['4', '5', '6', '8'],
    ans: 2,
    exp: 'Neutrones = A − Z = 12 − 6 = 6. El número de masa A es la suma de protones y neutrones.',
  },
  {
    q: '¿Qué partícula define el número atómico Z de un elemento?',
    opts: ['Electrón', 'Neutrón', 'Protón', 'Quark Up'],
    ans: 2,
    exp: 'Z = número de protones. Dos átomos con el mismo Z son el mismo elemento, aunque difieran en neutrones (isótopos).',
  },
  {
    q: '¿Cuál es la masa aproximada de un protón en u.m.a.?',
    opts: ['0.00054 u.m.a.', '0.511 u.m.a.', '1.007 u.m.a.', '2.014 u.m.a.'],
    ans: 2,
    exp: 'El protón tiene masa ≈ 1.007 u.m.a. El electrón solo ≈ 0.00054 u.m.a. (1836 veces menos).',
  },
  {
    q: '¿Cuántos protones tiene el Hierro (Fe)?',
    opts: ['18', '26', '29', '56'],
    ans: 1,
    exp: 'Z(Fe) = 26. El 56 es su masa atómica más común (Fe-56), no su número atómico.',
  },
  {
    q: 'La masa del electrón comparada con la del protón es aproximadamente:',
    opts: ['Igual', '10 veces menor', '200 veces menor', '1836 veces menor'],
    ans: 3,
    exp: 'mp ≈ 1.67×10⁻²⁷ kg, me ≈ 9.11×10⁻³¹ kg → mp / me ≈ 1836.',
  },
  {
    q: 'El Litio (Li) tiene Z = 3. ¿Cuántos neutrones tiene el Li-7?',
    opts: ['3', '4', '5', '7'],
    ans: 1,
    exp: 'Neutrones = A − Z = 7 − 3 = 4. "Li-7" indica A = 7 (número de masa).',
  },
];

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────
function QuarkBall({ label, bg, charge }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', backgroundColor: bg,
        margin: '0 auto 4px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 'bold', fontSize: 14,
        color: '#0f172a',
      }}>{label}</div>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{charge}</span>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
function SimuladorAtomos() {
  const [activeEl, setActiveEl]         = useState('H');
  const [rotation, setRotation]         = useState({ x: 20, y: 30 });
  const [time, setTime]                 = useState(0);
  const [selectedPart, setSelectedPart] = useState(null);
  const [isRealScale, setIsRealScale]   = useState(false);
  const [rightTab, setRightTab]         = useState('info'); // 'info' | 'quiz'

  // Quiz state
  const [qIdx, setQIdx]       = useState(0);
  const [chosen, setChosen]   = useState(null);
  const [answers, setAnswers] = useState([]); // [{chosen, correct}]
  const [finished, setFinished] = useState(false);

  const isDragging = useRef(false);
  const prevMouse  = useRef({ x: 0, y: 0 });
  const el = ELEMENTS[activeEl];

  // Animación
  useEffect(() => {
    let id;
    const tick = () => { setTime(t => t + 0.04); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  // Rotación ratón
  const onMouseDown = e => { isDragging.current = true; prevMouse.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = e => {
    if (!isDragging.current) return;
    const dx = e.clientX - prevMouse.current.x;
    const dy = e.clientY - prevMouse.current.y;
    setRotation(r => ({ x: r.x - dy * 0.5, y: r.y + dx * 0.5 }));
    prevMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { isDragging.current = false; };

  // Rotación táctil
  const onTouchStart = e => {
    if (e.touches.length === 1) { isDragging.current = true; prevMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  };
  const onTouchMove = e => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - prevMouse.current.x;
    const dy = e.touches[0].clientY - prevMouse.current.y;
    setRotation(r => ({ x: r.x - dy * 0.5, y: r.y + dx * 0.5 }));
    prevMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  // Núcleo (posiciones 3D deterministas)
  const coreParticles = useMemo(() => {
    const total = el.protons + el.neutrons;
    const size  = isRealScale ? 1.5 : 14;
    return Array.from({ length: total }, (_, i) => {
      const isProton = i < el.protons;
      const phi   = Math.acos(-1 + (2 * i) / Math.max(total, 1));
      const theta = Math.sqrt(total * Math.PI) * phi;
      const r     = total === 1 ? 0 : size * (0.8 + 0.4 * ((i * 2654435761) % 100) / 100);
      return {
        type: isProton ? 'proton' : 'neutron',
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
      };
    });
  }, [el, isRealScale]);

  // Proyección 3D → 2D
  const project = (x, y, z) => {
    const rX = (rotation.x * Math.PI) / 180;
    const rY = (rotation.y * Math.PI) / 180;
    const x1 = x * Math.cos(rY) - z * Math.sin(rY);
    const z1 = x * Math.sin(rY) + z * Math.cos(rY);
    const y2 = y * Math.cos(rX) - z1 * Math.sin(rX);
    const z2 = y * Math.sin(rX) + z1 * Math.cos(rX);
    const d  = 600 / (600 + z2);
    return { x: x1 * d + 250, y: y2 * d + 250, depth: z2 };
  };

  // Órbitas — limitadas a 12 para no saturar visualmente en Fe/Au
  const visibleElectrons = Math.min(el.electrons, 12);
  const electronData = useMemo(() => (
    Array.from({ length: visibleElectrons }, (_, i) => {
      const theta = (i * Math.PI) / visibleElectrons;
      const phi   = (i * Math.PI * 2) / visibleElectrons + 0.5;
      const r     = isRealScale ? 240 : 90 + i * 14;
      return { idx: i, theta, phi, r };
    })
  ), [visibleElectrons, isRealScale]);

  // ── Quiz helpers ──────────────────────────────────────────────────────────
  const currentQ = QUIZ[qIdx];
  const score    = answers.filter(a => a.correct).length;

  const handleAnswer = (optIdx) => {
    if (chosen !== null) return;
    setChosen(optIdx);
  };
  const handleNext = () => {
    const correct = chosen === currentQ.ans;
    const newAnswers = [...answers, { chosen, correct }];
    setAnswers(newAnswers);
    if (qIdx + 1 >= QUIZ.length) {
      setFinished(true);
    } else {
      setQIdx(q => q + 1);
      setChosen(null);
    }
  };
  const resetQuiz = () => { setQIdx(0); setChosen(null); setAnswers([]); setFinished(false); };

  const scoreColor = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'row',
      width: '100%', height: '100vh',
      backgroundColor: '#0f172a', color: '#f1f5f9',
      userSelect: 'none', overflow: 'hidden',
    }}>

      {/* ── PANEL IZQUIERDO ────────────────────────────────────────────── */}
      <div style={{
        width: '22%', padding: '16px 12px',
        borderRight: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto',
      }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#94a3b8', letterSpacing: 1 }}>ÁTOMOS INTERACTIVOS</h2>

        {/* Botones de elementos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {Object.entries(ELEMENTS).map(([key, data]) => (
            <button key={key}
              onClick={() => { setActiveEl(key); setSelectedPart(null); }}
              style={{
                padding: '9px 6px', fontSize: 13, fontWeight: 700,
                backgroundColor: activeEl === key ? data.color : '#1e293b',
                color: '#fff', border: activeEl === key ? `2px solid ${data.color}` : '2px solid #334155',
                borderRadius: 8, cursor: 'pointer', textAlign: 'left', lineHeight: 1.3,
              }}>
              <span style={{ fontSize: 16 }}>{key}</span>
              <span style={{ fontWeight: 400, fontSize: 10, display: 'block', color: activeEl === key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>
                {data.name}
              </span>
            </button>
          ))}
        </div>

        {/* Datos del elemento actual */}
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
          <div style={{ color: el.color, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            {activeEl} — {el.name}
          </div>
          {[
            ['Número atómico Z', el.protons],
            ['Protones', el.protons],
            ['Neutrones', el.neutrons],
            ['Electrones', el.electrons],
            ['Masa atómica', `${el.masa} u.m.a.`],
            ['Nº de masa A', el.protons + el.neutrons],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#cbd5e1' }}>
              <span style={{ color: '#64748b' }}>{lbl}</span>
              <strong>{val}</strong>
            </div>
          ))}
        </div>

        {/* Leyenda de partículas */}
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Toca para inspeccionar</div>
          {[
            { type: 'proton',   label: 'Protón',   color: '#ef4444', count: el.protons,   size: 16 },
            { type: 'neutron',  label: 'Neutrón',  color: '#94a3b8', count: el.neutrons,  size: 16 },
            { type: 'electron', label: 'Electrón', color: '#facc15', count: el.electrons, size: 13 },
          ].map(p => (
            <div key={p.type}
              onClick={() => setSelectedPart(p.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 6px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                background: selectedPart === p.type ? '#334155' : 'transparent',
              }}>
              <div style={{ width: p.size, height: p.size, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>{p.label}: <strong>{p.count}</strong></span>
            </div>
          ))}
        </div>

        {/* Escala real */}
        <button
          onClick={() => setIsRealScale(v => !v)}
          style={{
            padding: '11px 8px', fontWeight: 700, fontSize: 13, borderRadius: 8,
            border: 'none', cursor: 'pointer',
            backgroundColor: isRealScale ? '#7f1d1d' : '#14532d',
            color: isRealScale ? '#fca5a5' : '#86efac',
          }}>
          {isRealScale ? '🔬 Escala real: ON' : '👁 Ver escala real'}
        </button>
      </div>

      {/* ── ÁREA CENTRAL 3D ────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
      >
        <div style={{ position: 'absolute', top: 14, left: 14, color: '#475569', fontSize: 12 }}>
          🔄 Arrastra para rotar · X: {Math.round(rotation.x)}° Y: {Math.round(rotation.y)}°
        </div>
        {el.electrons > 12 && (
          <div style={{ position: 'absolute', top: 14, right: 14, color: '#64748b', fontSize: 11, background: '#1e293b', padding: '4px 8px', borderRadius: 6 }}>
            Mostrando 12 de {el.electrons} electrones
          </div>
        )}

        <svg width={500} height={500} style={{ overflow: 'visible' }}>
          <defs>
            <radialGradient id="pgr" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#dc2626" />
            </radialGradient>
            <radialGradient id="ngr" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#cbd5e1" /><stop offset="100%" stopColor="#475569" />
            </radialGradient>
            <radialGradient id="egr" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fef08a" /><stop offset="100%" stopColor="#ca8a04" />
            </radialGradient>
          </defs>

          {/* Órbitas y electrones */}
          {electronData.map(orbit => {
            const steps = 64;
            const pts   = Array.from({ length: steps + 1 }, (_, i) => {
              const u   = (i * Math.PI * 2) / steps;
              const x3d = orbit.r * Math.cos(u) * Math.sin(orbit.theta);
              const y3d = orbit.r * Math.sin(u) * Math.sin(orbit.phi);
              const z3d = orbit.r * Math.cos(u) * Math.cos(orbit.theta);
              return project(x3d, y3d, z3d);
            });
            const path = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

            const u   = time * 1.5 + orbit.idx * (Math.PI * 2 / visibleElectrons);
            const ep  = project(
              orbit.r * Math.cos(u) * Math.sin(orbit.theta),
              orbit.r * Math.sin(u) * Math.sin(orbit.phi),
              orbit.r * Math.cos(u) * Math.cos(orbit.theta),
            );
            const er  = isRealScale ? 1.5 : 6;

            return (
              <g key={`o-${orbit.idx}`}>
                <path d={path} fill="none"
                  stroke={selectedPart === 'electron' ? '#facc15' : 'rgba(255,255,255,0.07)'}
                  strokeWidth={selectedPart === 'electron' ? 1.5 : 1} />
                <circle cx={ep.x} cy={ep.y} r={er} fill="url(#egr)" style={{ cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setSelectedPart('electron'); }} />
              </g>
            );
          })}

          {/* Núcleo */}
          {coreParticles
            .map((p, i) => ({ ...p, proj: project(p.x, p.y, p.z), i }))
            .sort((a, b) => b.proj.depth - a.proj.depth)
            .map(p => {
              const nr = isRealScale ? 2 : 11;
              return (
                <circle key={`c-${p.i}`}
                  cx={p.proj.x} cy={p.proj.y} r={nr}
                  fill={p.type === 'proton' ? 'url(#pgr)' : 'url(#ngr)'}
                  stroke={selectedPart === p.type ? '#fff' : '#0f172a'}
                  strokeWidth={selectedPart === p.type ? 1.5 : 0.4}
                  style={{ cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setSelectedPart(p.type); }}
                />
              );
            })}
        </svg>

        {isRealScale && (
          <div style={{
            position: 'absolute', bottom: 20,
            background: 'rgba(127,29,29,0.3)', border: '1px solid #dc2626',
            borderRadius: 8, padding: '10px 16px', fontSize: 12,
            textAlign: 'center', maxWidth: '70%',
          }}>
            ⚠️ Si el núcleo midiera 1 px, el electrón del Hidrógeno orbitaría a <strong>+10 m</strong>. El átomo es casi todo vacío.
          </div>
        )}
      </div>

      {/* ── PANEL DERECHO ──────────────────────────────────────────────── */}
      <div style={{
        width: '26%', borderLeft: '1px solid #1e293b',
        backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column',
      }}>
        {/* Pestañas */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
          {[['info', 'Estructura'], ['quiz', 'Test Átomos']].map(([key, lbl]) => (
            <button key={key}
              onClick={() => setRightTab(key)}
              style={{
                flex: 1, padding: '12px 4px', fontSize: 13, fontWeight: 700,
                background: rightTab === key ? '#1e293b' : 'transparent',
                color: rightTab === key ? '#f1f5f9' : '#475569',
                border: 'none', borderBottom: rightTab === key ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
              }}>
              {key === 'quiz' ? '🧪 ' : '⚛️ '}{lbl}
            </button>
          ))}
        </div>

        {/* ── Tab Estructura ── */}
        {rightTab === 'info' && (
          <div style={{ flex: 1, padding: '16px 14px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 15 }}>Subpartículas del {el.name}</h3>

            {!selectedPart ? (
              <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
                👈 Toca un protón, neutrón o electrón en el modelo 3D para ver sus constituyentes cuánticos.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Nombre + color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: selectedPart === 'proton' ? '#ef4444' : selectedPart === 'neutron' ? '#94a3b8' : '#facc15',
                  }} />
                  <strong style={{ fontSize: 18 }}>
                    {selectedPart === 'proton' ? 'Protón' : selectedPart === 'neutron' ? 'Neutrón' : 'Electrón'}
                  </strong>
                </div>

                {/* Descripción */}
                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  {selectedPart === 'proton' && 'Hadrón compuesto por 2 quarks Up y 1 quark Down. Carga +1e. Masa ≈ 1.007 u.m.a. Confinado en el núcleo por la fuerza nuclear fuerte.'}
                  {selectedPart === 'neutron' && 'Hadrón compuesto por 1 quark Up y 2 quarks Down. Sin carga eléctrica. Masa ≈ 1.008 u.m.a. Estabiliza el núcleo reduciendo la repulsión entre protones.'}
                  {selectedPart === 'electron' && 'Leptón elemental (no tiene subestructura conocida). Carga −1e. Masa ≈ 0.00054 u.m.a. Se comporta como onda (mecánica cuántica) alrededor del núcleo.'}
                </p>

                {/* Masa */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                  <div style={{ color: '#64748b', marginBottom: 4 }}>Masa relativa</div>
                  <div style={{ color: '#22c55e', fontWeight: 700 }}>
                    {selectedPart === 'electron' ? '0.00054 u.m.a. — despreciable' : '≈ 1.007 u.m.a. — concentra la masa'}
                  </div>
                </div>

                {/* Quarks */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Constituyentes cuánticos</div>
                  {selectedPart === 'electron' ? (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ca8a04', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0f172a' }}>e⁻</div>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Leptón fundamental<br />sin subestructura</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      {selectedPart === 'proton' ? (
                        <>
                          <QuarkBall label="u" bg="#f87171" charge="Up +⅔" />
                          <QuarkBall label="u" bg="#f87171" charge="Up +⅔" />
                          <QuarkBall label="d" bg="#60a5fa" charge="Down −⅓" />
                        </>
                      ) : (
                        <>
                          <QuarkBall label="u" bg="#f87171" charge="Up +⅔" />
                          <QuarkBall label="d" bg="#60a5fa" charge="Down −⅓" />
                          <QuarkBall label="d" bg="#60a5fa" charge="Down −⅓" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Quiz ── */}
        {rightTab === 'quiz' && (
          <div style={{ flex: 1, padding: '16px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {finished ? (
              /* Resultado final */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>
                  {score >= 8 ? '🏆' : score >= 5 ? '👍' : '📚'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor }}>
                  {score} / {QUIZ.length}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                  {score >= 8 ? '¡Excelente dominio de la física atómica!' : score >= 5 ? 'Buen trabajo, repasa los fallos.' : 'Repasa la teoría y vuelve a intentarlo.'}
                </div>
                {/* Revisión */}
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {answers.map((a, i) => (
                    <div key={i} style={{
                      background: a.correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${a.correct ? '#22c55e' : '#ef4444'}`,
                      borderRadius: 8, padding: '8px 10px', fontSize: 12,
                    }}>
                      <strong style={{ color: a.correct ? '#22c55e' : '#ef4444' }}>{a.correct ? '✓' : '✗'} P{i + 1}.</strong>{' '}
                      <span style={{ color: '#cbd5e1' }}>{QUIZ[i].opts[QUIZ[i].ans]}</span>
                      {!a.correct && (
                        <div style={{ color: '#94a3b8', marginTop: 4 }}>{QUIZ[i].exp}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={resetQuiz} style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                  background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                }}>
                  🔄 Repetir test
                </button>
              </div>
            ) : (
              /* Pregunta activa */
              <>
                {/* Progreso */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                  <span>Pregunta {qIdx + 1} / {QUIZ.length}</span>
                  <span style={{ color: '#22c55e' }}>✓ {answers.filter(a => a.correct).length} correctas</span>
                </div>
                <div style={{ height: 4, background: '#1e293b', borderRadius: 99 }}>
                  <div style={{ height: 4, width: `${((qIdx) / QUIZ.length) * 100}%`, background: '#3b82f6', borderRadius: 99, transition: 'width 0.3s' }} />
                </div>

                {/* Texto pregunta */}
                <p style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', lineHeight: 1.5, margin: 0 }}>
                  {currentQ.q}
                </p>

                {/* Opciones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentQ.opts.map((opt, i) => {
                    const isChosen  = chosen === i;
                    const isCorrect = i === currentQ.ans;
                    let bg = '#1e293b', border = '#334155', color = '#cbd5e1';
                    if (chosen !== null) {
                      if (isCorrect)      { bg = 'rgba(34,197,94,0.15)';  border = '#22c55e'; color = '#86efac'; }
                      else if (isChosen)  { bg = 'rgba(239,68,68,0.15)';  border = '#ef4444'; color = '#fca5a5'; }
                    } else if (isChosen) {
                      bg = '#1e3a5f'; border = '#3b82f6'; color = '#93c5fd';
                    }
                    return (
                      <button key={i} onClick={() => handleAnswer(i)}
                        style={{
                          padding: '10px 12px', background: bg,
                          border: `1.5px solid ${border}`, borderRadius: 8,
                          color, fontSize: 13, textAlign: 'left', cursor: chosen !== null ? 'default' : 'pointer',
                          fontWeight: isChosen || (chosen !== null && isCorrect) ? 700 : 400,
                          transition: 'all 0.15s',
                        }}>
                        {chosen !== null && isCorrect ? '✓ ' : chosen !== null && isChosen ? '✗ ' : ''}
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explicación */}
                {chosen !== null && (
                  <div style={{
                    background: chosen === currentQ.ans ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${chosen === currentQ.ans ? '#22c55e' : '#ef4444'}`,
                    borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5,
                  }}>
                    <strong style={{ color: chosen === currentQ.ans ? '#22c55e' : '#ef4444' }}>
                      {chosen === currentQ.ans ? '¡Correcto! ' : 'Incorrecto. '}
                    </strong>
                    {currentQ.exp}
                  </div>
                )}

                {/* Botón siguiente */}
                <button
                  onClick={handleNext}
                  disabled={chosen === null}
                  style={{
                    padding: '11px', borderRadius: 8, border: 'none',
                    background: chosen === null ? '#1e293b' : '#3b82f6',
                    color: chosen === null ? '#475569' : '#fff',
                    fontWeight: 700, fontSize: 14,
                    cursor: chosen === null ? 'default' : 'pointer',
                    transition: 'background 0.2s',
                  }}>
                  {qIdx + 1 < QUIZ.length ? 'Siguiente →' : 'Ver resultado'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SimuladorAtomos;
