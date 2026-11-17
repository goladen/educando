// Simuladores manipulables para algunos problemas de Pizarras verticales.
// - 'relojes': dos relojes de arena (por defecto 4 y 7 min) con reloj general, «marcar inicio/fin» de la medida
//   y registro de lo que pasa en cada momento. Se puede dar la vuelta a un reloj aunque no haya terminado.
// - 'jarras': dos cubos/jarras sin marcas (por defecto 5 y 3 L) con grifo: llenar, vaciar y pasar de uno a otro,
//   con tabla de pasos, deshacer y comprobación del objetivo (y el camino más corto, por BFS).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sonidoCorrecto, sonidoPasar } from '../utils/sonidosFeedback';

const btn = (bg, color = 'white', extra = {}) => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '8px 13px', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit', ...extra,
});
const inpNum = { width: 58, padding: '5px 6px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center', fontFamily: 'inherit' };
const entero = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const EPS = 1e-9;

// minutos (decimales) → «m:ss»
const mmss = (min) => {
    const s = Math.round(Math.max(0, min) * 60);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
// para el registro: «7 min» o «7 min 30 s»
const textoMin = (min) => {
    const s = Math.round(min * 60);
    const m = Math.floor(s / 60), r = s % 60;
    return r ? `${m} min ${r} s` : `${m} min`;
};

const ESTILO_ANIM = `
@keyframes pvGiro { from { transform: rotate(-180deg); } to { transform: rotate(0deg); } }
@keyframes pvBrillo { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.0); } 50% { box-shadow: 0 0 0 8px rgba(22,163,74,0.25); } }
`;

// ═══════════════════════════ RELOJES DE ARENA ═══════════════════════════
function RelojArenaSVG({ capacidad, arriba, cayendo, color }) {
    const W = 46, H = 70, cx = 60, neck = 90; // media anchura, altura de cada bulbo
    const fTop = capacidad > 0 ? Math.min(1, Math.max(0, arriba / capacidad)) : 0;
    const fBot = 1 - fTop;
    const hTop = H * Math.sqrt(fTop);            // triángulo con vértice en el cuello: área ∝ h²
    const wTop = W * hTop / H;
    const eBot = H * Math.sqrt(1 - fBot);        // parte vacía de abajo (triángulo junto al cuello)
    const wBot = W * eBot / H;
    const arena = '#e9b949';
    return (
        <svg viewBox="0 0 120 180" style={{ width: '100%', maxWidth: 150, display: 'block', margin: '0 auto' }}>
            <rect x="8" y="4" width="104" height="12" rx="4" fill={color} />
            <rect x="8" y="164" width="104" height="12" rx="4" fill={color} />
            {fTop > EPS && <polygon points={`${cx},${neck} ${cx - wTop},${neck - hTop} ${cx + wTop},${neck - hTop}`} fill={arena} />}
            {fBot > EPS && <polygon points={`${cx - wBot},${neck + eBot} ${cx + wBot},${neck + eBot} ${cx + W},${neck + H} ${cx - W},${neck + H}`} fill={arena} />}
            {cayendo && <line x1={cx} y1={neck - 2} x2={cx} y2={neck + Math.max(4, eBot)} stroke={arena} strokeWidth="2.5" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="0.4s" repeatCount="indefinite" />
            </line>}
            <path d={`M${cx - W - 2},${neck - H - 2} L${cx + W + 2},${neck - H - 2} L${cx + 3},${neck} L${cx + W + 2},${neck + H + 2} L${cx - W - 2},${neck + H + 2} L${cx - 3},${neck} Z`}
                fill="rgba(186,230,253,0.18)" stroke="#64748b" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
    );
}

const VELOCIDADES = [
    { id: 1, txt: '1 min = 1 s', f: 1 },
    { id: 2, txt: '1 min = 3 s', f: 1 / 3 },
    { id: 3, txt: '1 min = 10 s', f: 1 / 10 },
    { id: 4, txt: 'Tiempo real', f: 1 / 60 },
];

function SimuladorRelojes({ oscuro, config = {} }) {
    const [caps, setCaps] = useState([config.a || 4, config.b || 7]);
    const [objetivo, setObjetivo] = useState(config.objetivo || 9);
    const [arriba, setArriba] = useState([0, 0]);       // minutos de arena en el bulbo de arriba
    const [t, setT] = useState(0);                       // minutos simulados
    const [corriendo, setCorriendo] = useState(false);
    const [vel, setVel] = useState(1);
    const [pausarFin, setPausarFin] = useState(true);
    const [verGeneral, setVerGeneral] = useState(true);
    const [verArena, setVerArena] = useState(false);
    const [inicio, setInicio] = useState(null);           // t en que se marcó el inicio
    const [fin, setFin] = useState(null);
    const [log, setLog] = useState([]);
    const [giros, setGiros] = useState([0, 0]);          // para relanzar la animación de giro

    const st = useRef({ arriba, t, corriendo, vel, pausarFin, caps });
    st.current = { arriba, t, corriendo, vel, pausarFin, caps };

    const anotar = useCallback((tm, txt, tipo = '') => setLog(l => [...l, { t: tm, txt, tipo }].slice(-80)), []);

    // Bucle de simulación: avanza hasta el siguiente «fin de reloj» como mucho, para que caiga exacto.
    useEffect(() => {
        if (!corriendo) return undefined;
        let raf, ultimo = performance.now();
        const paso = (ahora) => {
            const dtReal = Math.min(0.25, (ahora - ultimo) / 1000);
            ultimo = ahora;
            const s = st.current;
            const f = (VELOCIDADES.find(v => v.id === s.vel) || VELOCIDADES[0]).f;
            let dt = dtReal * f;
            const proximos = s.arriba.filter(a => a > EPS);
            const minFin = proximos.length ? Math.min(...proximos) : Infinity;
            let termina = false;
            if (minFin <= dt + EPS) { dt = minFin; termina = true; }
            const nuevoT = s.t + dt;
            const nuevos = s.arriba.map(a => (a > EPS ? Math.max(0, a - dt) : 0)).map(a => (a < 1e-7 ? 0 : a));
            setArriba(nuevos);
            setT(nuevoT);
            if (termina) {
                s.arriba.forEach((a, i) => {
                    if (a > EPS && nuevos[i] === 0) anotar(nuevoT, `Termina el reloj de ${s.caps[i]} min`, 'fin');
                });
                try { sonidoPasar(); } catch { /* sin audio */ }
                if (s.pausarFin) { setCorriendo(false); return; }
            }
            raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf);
    }, [corriendo, anotar]);

    const darVuelta = (i) => {
        const c = caps[i];
        const nuevo = c - arriba[i];
        setArriba(a => a.map((v, k) => (k === i ? nuevo : v)));
        setGiros(g => g.map((v, k) => (k === i ? v + 1 : v)));
        const quedaba = arriba[i];
        anotar(t, quedaba > EPS
            ? `Vuelta al reloj de ${c} min (no había terminado: ahora caen ${textoMin(nuevo)})`
            : `Vuelta al reloj de ${c} min`, 'vuelta');
    };

    const reiniciar = (nuevasCaps = caps) => {
        setCorriendo(false); setT(0); setArriba([0, 0]); setInicio(null); setFin(null); setLog([]);
        setCaps(nuevasCaps);
    };

    const marcarInicio = () => { setInicio(t); setFin(null); anotar(t, '🚩 Empieza la medida (el huevo entra en el agua)', 'marca'); };
    const marcarFin = () => {
        setFin(t);
        const medido = t - inicio;
        const ok = Math.abs(medido - objetivo) < 1 / 120;
        anotar(t, `🏁 Fin de la medida: ${textoMin(medido)}${ok ? ' ✅' : ''}`, ok ? 'ok' : 'marca');
        if (ok) { try { sonidoCorrecto(); } catch { /* sin audio */ } }
    };

    const medido = inicio == null ? null : (fin ?? t) - inicio;
    const exacto = fin != null && Math.abs(medido - objetivo) < 1 / 120;
    const tinta = oscuro ? 'white' : '#1f2937';
    const panel = { background: oscuro ? 'rgba(255,255,255,0.07)' : 'white', borderRadius: 14, padding: 12, border: oscuro ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e5e7eb' };
    const colores = ['#7c3aed', '#0891b2'];
    const algunoCae = arriba.some(a => a > EPS);

    return (
        <div style={{ color: tinta }}>
            {/* Configuración */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: '0.88rem' }}>
                <label>Reloj A <input type="number" min={1} max={60} value={caps[0]} style={inpNum}
                    onChange={e => reiniciar([entero(e.target.value, 1, 60, 4), caps[1]])} /> min</label>
                <label>Reloj B <input type="number" min={1} max={60} value={caps[1]} style={inpNum}
                    onChange={e => reiniciar([caps[0], entero(e.target.value, 1, 60, 7)])} /> min</label>
                <label>Hay que medir <input type="number" min={1} max={120} value={objetivo} style={inpNum}
                    onChange={e => setObjetivo(entero(e.target.value, 1, 120, 9))} /> min</label>
                <select value={vel} onChange={e => setVel(Number(e.target.value))} style={{ ...inpNum, width: 'auto' }}>
                    {VELOCIDADES.map(v => <option key={v.id} value={v.id}>{v.txt}</option>)}
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 12 }}>
                {/* Relojes */}
                {caps.map((c, i) => (
                    <div key={i} style={{ ...panel, textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, color: colores[i], fontSize: '1.1rem' }}>Reloj de {c} min</div>
                        <div key={giros[i]} style={{ animation: giros[i] ? 'pvGiro 0.45s ease-out' : undefined, cursor: 'pointer' }} onClick={() => darVuelta(i)} title="Dar la vuelta">
                            <RelojArenaSVG capacidad={c} arriba={arriba[i]} cayendo={corriendo && arriba[i] > EPS} color={colores[i]} />
                        </div>
                        <div style={{ fontSize: '0.82rem', minHeight: '1.2em', opacity: 0.8 }}>
                            {verArena ? `Arriba: ${mmss(arriba[i])} · Abajo: ${mmss(c - arriba[i])}` : (arriba[i] > EPS ? 'Cayendo arena…' : 'Toda la arena abajo')}
                        </div>
                        <button onClick={() => darVuelta(i)} style={btn(colores[i], 'white', { marginTop: 6 })}>🔄 Dar la vuelta</button>
                    </div>
                ))}

                {/* Tiempo y medida */}
                <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 700 }}>RELOJ GENERAL</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                        {verGeneral ? `⏱ ${mmss(t)}` : '⏱ ?:??'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setCorriendo(v => !v)} style={btn(corriendo ? '#64748b' : '#16a34a')}>
                            {corriendo ? '⏸ Pausa' : (t === 0 ? '▶ Empezar' : '▶ Seguir')}
                        </button>
                        <button onClick={() => reiniciar()} style={btn('#94a3b8')}>↺ Reiniciar</button>
                    </div>
                    {!corriendo && !algunoCae && t === 0 && <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>Los relojes tienen la arena abajo: dales la vuelta para ponerlos en marcha.</div>}

                    <div style={{ borderTop: oscuro ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e5e7eb', paddingTop: 8 }}>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 700 }}>MEDIDA · objetivo {objetivo} min</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: exacto ? '#16a34a' : undefined }}>
                            {medido == null ? '—' : `${mmss(medido)}${exacto ? ' ✅' : ''}`}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={marcarInicio} style={btn('#2563eb')}>🚩 {inicio == null ? 'Empiezo a medir' : 'Volver a empezar aquí'}</button>
                            <button onClick={marcarFin} disabled={inicio == null || fin != null} style={btn(inicio == null || fin != null ? '#cbd5e1' : '#dc2626')}>🏁 Fin</button>
                        </div>
                        {fin != null && !exacto && <div style={{ fontSize: '0.85rem', marginTop: 6, color: '#dc2626', fontWeight: 700 }}>
                            {medido < objetivo ? `Faltan ${textoMin(objetivo - medido)}.` : `Te has pasado ${textoMin(medido - objetivo)}.`}
                        </div>}
                        {exacto && <div style={{ fontSize: '0.85rem', marginTop: 6, color: '#16a34a', fontWeight: 800, animation: 'pvBrillo 1.2s 2' }}>¡Exacto! Has medido {objetivo} minutos.</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.8rem' }}>
                        <label><input type="checkbox" checked={pausarFin} onChange={e => setPausarFin(e.target.checked)} /> Pausar cuando termine un reloj</label>
                        <label><input type="checkbox" checked={verGeneral} onChange={e => setVerGeneral(e.target.checked)} /> Ver el reloj general</label>
                        <label><input type="checkbox" checked={verArena} onChange={e => setVerArena(e.target.checked)} /> Ver minutos de arena</label>
                    </div>
                </div>
            </div>

            {/* Registro: línea del tiempo */}
            {log.length > 0 && (
                <div style={{ ...panel, marginTop: 12, maxHeight: 200, overflowY: 'auto' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>🕑 Línea del tiempo</div>
                    {log.map((e, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, fontSize: '0.88rem', padding: '2px 0', color: e.tipo === 'ok' ? '#16a34a' : undefined, fontWeight: e.tipo === 'marca' || e.tipo === 'ok' ? 700 : 400 }}>
                            <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 46, opacity: 0.75 }}>{mmss(e.t)}</span>
                            <span>{e.txt}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════ CUBOS / JARRAS DE AGUA ═══════════════════════════
const mcd = (a, b) => (b ? mcd(b, a % b) : a);

// Camino más corto (estados (x,y)) hasta tener «obj» en alguno de los dos recipientes.
function caminoMasCorto(A, B, obj) {
    const clave = (x, y) => `${x},${y}`;
    const prev = new Map([[clave(0, 0), null]]);
    const cola = [[0, 0]];
    while (cola.length) {
        const [x, y] = cola.shift();
        if (x === obj || y === obj) {
            let n = 0, k = clave(x, y);
            while (prev.get(k)) { n++; k = prev.get(k); }
            return n;
        }
        const p1 = Math.min(x, B - y), p2 = Math.min(y, A - x);
        for (const [nx, ny] of [[A, y], [x, B], [0, y], [x, 0], [x - p1, y + p1], [x + p2, y - p2]]) {
            const k = clave(nx, ny);
            if (!prev.has(k)) { prev.set(k, clave(x, y)); cola.push([nx, ny]); }
        }
    }
    return null;
}

function CuboSVG({ capacidad, litros, color, maxCap, verLitros }) {
    const altoMax = 170;
    const alto = 40 + altoMax * (capacidad / maxCap);
    const ancho = 70 + 40 * Math.sqrt(capacidad / maxCap);
    const frac = capacidad ? litros / capacidad : 0;
    const x0 = (130 - ancho) / 2, y0 = 220 - alto;
    const hAgua = (alto - 8) * frac;
    return (
        <svg viewBox="0 0 130 230" style={{ width: '100%', maxWidth: 140, display: 'block', margin: '0 auto' }}>
            <defs>
                <clipPath id={`pvcubo-${color.replace('#', '')}`}><rect x={x0 + 3} y={y0} width={ancho - 6} height={alto - 3} rx="6" /></clipPath>
            </defs>
            <rect x={x0 + 3} y={220 - 3 - hAgua} width={ancho - 6} height={hAgua} fill="#38bdf8" opacity="0.85"
                clipPath={`url(#pvcubo-${color.replace('#', '')})`} style={{ transition: 'y 0.6s ease, height 0.6s ease' }} />
            <path d={`M${x0},${y0} L${x0},${220 - 8} Q${x0},220 ${x0 + 8},220 L${x0 + ancho - 8},220 Q${x0 + ancho},220 ${x0 + ancho},${220 - 8} L${x0 + ancho},${y0}`}
                fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" />
            <path d={`M${x0 - 4},${y0} Q65,${y0 - 30} ${x0 + ancho + 4},${y0}`} fill="none" stroke="#94a3b8" strokeWidth="2" />
            {verLitros && <text x="65" y={Math.min(212, 220 - hAgua / 2 + 6)} textAnchor="middle" fontSize="20" fontWeight="900" fill="#0f172a">{+litros.toFixed(2)} L</text>}
        </svg>
    );
}

function SimuladorJarras({ oscuro, config = {} }) {
    const [caps, setCaps] = useState([config.a || 5, config.b || 3]);
    const [objetivo, setObjetivo] = useState(config.objetivo || 4);
    const [nombre, setNombre] = useState(config.nombre || 'Cubo');
    const [litros, setLitros] = useState([0, 0]);
    const [pasos, setPasos] = useState([]);  // { txt, estado:[x,y] }
    const [verLitros, setVerLitros] = useState(true);
    const [verPosible, setVerPosible] = useState(false);
    const avisado = useRef(false);

    const conseguido = litros[0] === objetivo || litros[1] === objetivo;
    useEffect(() => {
        if (conseguido && pasos.length && !avisado.current) { avisado.current = true; try { sonidoCorrecto(); } catch { /* sin audio */ } }
        if (!conseguido) avisado.current = false;
    }, [conseguido, pasos.length]);

    const reiniciar = (nc = caps) => { setCaps(nc); setLitros([0, 0]); setPasos([]); setVerPosible(false); };
    const etiqueta = i => `${nombre.toLowerCase()} de ${caps[i]} L`;

    const aplicar = (nuevo, txt) => {
        if (nuevo[0] === litros[0] && nuevo[1] === litros[1]) return;
        setLitros(nuevo);
        setPasos(p => [...p, { txt, estado: nuevo }]);
    };
    const llenar = i => aplicar(litros.map((v, k) => (k === i ? caps[i] : v)), `Llenar el ${etiqueta(i)} en el grifo`);
    const vaciar = i => aplicar(litros.map((v, k) => (k === i ? 0 : v)), `Vaciar el ${etiqueta(i)}`);
    const pasar = i => {
        const j = 1 - i;
        const cant = Math.min(litros[i], caps[j] - litros[j]);
        if (cant <= 0) return;
        const n = [...litros]; n[i] -= cant; n[j] += cant;
        aplicar(n, `Pasar del ${etiqueta(i)} al ${etiqueta(j)} (${cant} L)`);
    };
    const deshacer = () => {
        const q = pasos.slice(0, -1);
        setPasos(q);
        setLitros(q.length ? q[q.length - 1].estado : [0, 0]);
    };

    const maxCap = Math.max(...caps);
    const posible = objetivo <= maxCap && objetivo % mcd(caps[0], caps[1]) === 0;
    const minimo = posible ? caminoMasCorto(caps[0], caps[1], objetivo) : null;
    const tinta = oscuro ? 'white' : '#1f2937';
    const panel = { background: oscuro ? 'rgba(255,255,255,0.07)' : 'white', borderRadius: 14, padding: 12, border: oscuro ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e5e7eb' };
    const colores = ['#ea580c', '#7c3aed'];

    return (
        <div style={{ color: tinta }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: '0.88rem' }}>
                <select value={nombre} onChange={e => setNombre(e.target.value)} style={{ ...inpNum, width: 'auto' }}>
                    <option>Cubo</option><option>Jarra</option><option>Bidón</option>
                </select>
                <label>A <input type="number" min={1} max={30} value={caps[0]} style={inpNum}
                    onChange={e => reiniciar([entero(e.target.value, 1, 30, 5), caps[1]])} /> L</label>
                <label>B <input type="number" min={1} max={30} value={caps[1]} style={inpNum}
                    onChange={e => reiniciar([caps[0], entero(e.target.value, 1, 30, 3)])} /> L</label>
                <label>Conseguir <input type="number" min={1} max={30} value={objetivo} style={inpNum}
                    onChange={e => { setObjetivo(entero(e.target.value, 1, 30, 4)); setVerPosible(false); }} /> L</label>
                <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={verLitros} onChange={e => setVerLitros(e.target.checked)} /> Ver litros</label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                {caps.map((c, i) => (
                    <div key={i} style={{ ...panel, textAlign: 'center', outline: litros[i] === objetivo && pasos.length ? '3px solid #16a34a' : 'none' }}>
                        <div style={{ fontWeight: 900, color: colores[i], fontSize: '1.1rem' }}>{nombre} de {c} L</div>
                        <CuboSVG capacidad={c} litros={litros[i]} color={colores[i]} maxCap={maxCap} verLitros={verLitros} />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                            <button onClick={() => llenar(i)} disabled={litros[i] === c} style={btn(litros[i] === c ? '#cbd5e1' : '#0284c7')}>🚰 Llenar</button>
                            <button onClick={() => vaciar(i)} disabled={litros[i] === 0} style={btn(litros[i] === 0 ? '#cbd5e1' : '#64748b')}>🫗 Vaciar</button>
                        </div>
                        <button onClick={() => pasar(i)} disabled={litros[i] === 0 || litros[1 - i] === caps[1 - i]}
                            style={btn(litros[i] === 0 || litros[1 - i] === caps[1 - i] ? '#cbd5e1' : colores[i], 'white', { marginTop: 6 })}>
                            {i === 0 ? 'Pasar al otro ➡️' : '⬅️ Pasar al otro'}
                        </button>
                    </div>
                ))}

                <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 700 }}>OBJETIVO</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{objetivo} litros</div>
                    <div style={{ fontSize: '0.95rem' }}>Pasos: <b>{pasos.length}</b></div>
                    {conseguido && pasos.length > 0 && (
                        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 10, padding: '8px 10px', fontWeight: 800, animation: 'pvBrillo 1.2s 2' }}>
                            ✅ ¡Conseguido en {pasos.length} pasos!
                            {minimo != null && <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 3 }}>
                                {pasos.length === minimo ? 'Es el camino más corto posible. 🏆' : `Se puede hacer en ${minimo} pasos. ¿Encontráis cómo?`}
                            </div>}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={deshacer} disabled={!pasos.length} style={btn(pasos.length ? '#f59e0b' : '#cbd5e1')}>↶ Deshacer</button>
                        <button onClick={() => reiniciar()} style={btn('#94a3b8')}>↺ Empezar de nuevo</button>
                    </div>
                    <button onClick={() => setVerPosible(v => !v)} style={btn('transparent', tinta, { border: '1.5px dashed #94a3b8', fontSize: '0.8rem' })}>🤔 ¿Se puede conseguir?</button>
                    {verPosible && (
                        <div style={{ fontSize: '0.85rem' }}>
                            {posible
                                ? `Sí. Con ${caps[0]} y ${caps[1]} L se pueden medir los múltiplos de ${mcd(caps[0], caps[1])} hasta ${maxCap} L. Mínimo: ${minimo} pasos.`
                                : objetivo > maxCap
                                    ? `No cabe: el ${nombre.toLowerCase()} más grande es de ${maxCap} L.`
                                    : `No. Con ${caps[0]} y ${caps[1]} L solo salen múltiplos de ${mcd(caps[0], caps[1])} (su MCD).`}
                        </div>
                    )}
                </div>
            </div>

            {pasos.length > 0 && (
                <div style={{ ...panel, marginTop: 12, maxHeight: 220, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', opacity: 0.75 }}>
                                <th style={{ padding: 4 }}>Paso</th><th style={{ padding: 4 }}>Acción</th>
                                <th style={{ padding: 4, textAlign: 'center', color: colores[0] }}>{caps[0]} L</th>
                                <th style={{ padding: 4, textAlign: 'center', color: colores[1] }}>{caps[1]} L</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td style={{ padding: 4 }}>0</td><td style={{ padding: 4, opacity: 0.7 }}>Al principio</td><td style={{ textAlign: 'center' }}>0</td><td style={{ textAlign: 'center' }}>0</td></tr>
                            {pasos.map((p, i) => (
                                <tr key={i} style={{ borderTop: oscuro ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f1f5f9' }}>
                                    <td style={{ padding: 4 }}>{i + 1}</td><td style={{ padding: 4 }}>{p.txt}</td>
                                    {p.estado.map((v, k) => <td key={k} style={{ textAlign: 'center', fontWeight: v === objetivo ? 900 : 600, color: v === objetivo ? '#16a34a' : undefined }}>{v}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════ Ventana del simulador ═══════════════════════════
export const SIMULADORES = {
    relojes: { titulo: '⏳ Simulador de relojes de arena', Comp: SimuladorRelojes },
    jarras: { titulo: '🪣 Simulador de cubos de agua', Comp: SimuladorJarras },
};

export default function ModalSimulador({ tipo, config, oscuro, onClose }) {
    const sim = SIMULADORES[tipo];
    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);
    if (!sim) return null;
    const { Comp } = sim;
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10070, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
            <style>{ESTILO_ANIM}</style>
            <div style={{ background: oscuro ? '#0f172a' : '#f5f3ee', color: oscuro ? 'white' : '#1f2937', borderRadius: 18, width: '100%', maxWidth: 980, maxHeight: '94vh', overflowY: 'auto', padding: 'clamp(12px, 2.5vw, 22px)', fontFamily: "'Segoe UI', system-ui, sans-serif", border: oscuro ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h3 style={{ margin: 0, flex: 1, fontSize: '1.15rem' }}>{sim.titulo}</h3>
                    <button onClick={onClose} style={btn('#ef4444')}>✕ Cerrar</button>
                </div>
                <Comp oscuro={oscuro} config={config} />
            </div>
        </div>
    );
}
