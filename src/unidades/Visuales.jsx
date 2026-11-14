import React from 'react';
import {
    MAGNITUDES, escaleraDe, saltosEntre, factoresEntre, fmt, fmtFactor, unidad, convertir,
    fraccionDePi, magnitudDibujo, conU,
} from './magnitudes.js';

// ─────────────────────────────────────────────────────────────────────────────
//  DIBUJOS del cambio de unidades (SVG/HTML sencillos para que salgan bien en
//  pantalla, en la pizarra y en el PDF con html2canvas):
//   · Escalera         → método de los saltos
//   · CadenaFactores   → método de los factores de conversión (unidades tachadas)
//   · Termometros      → °C, K y °F a la vez
//   · CirculoAngulo    → grados ↔ radianes
//   · TablaVolCap      → volumen ↔ capacidad (1 dm³ = 1 l)
//   · TablaPosiciones  → formas complejas (una cifra por unidad)
//   · VisualConversion → elige el dibujo adecuado a partir de `ap.v`
// ─────────────────────────────────────────────────────────────────────────────

const AZUL = '#2563eb', VERDE = '#16a34a', ROJO = '#dc2626', GRIS = '#64748b';

// ── Escalera ─────────────────────────────────────────────────────────────────
export function Escalera({ mag, de, a, mostrarSaltos = true, maxAncho = 520, onElegir = null, escala = 1 }) {
    const esc = escaleraDe(mag);
    if (!esc) return null;
    const eq = (s) => unidad(mag, s)?.equivale || s;
    const P = esc.peldanos;
    const n = P.length;
    const w = 66, h = 24, top = 46;
    const W = n * w + 10, H = top + n * h + 12;
    const iDe = P.indexOf(eq(de)), iA = P.indexOf(eq(a));
    const sal = de && a ? saltosEntre(mag, de, a) : null;
    const desde = Math.min(iDe, iA), hasta = Math.max(iDe, iA);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: maxAncho * escala, display: 'block', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
            {P.map((s, i) => {
                const x = 5 + i * w, y = top + i * h;
                const esDe = i === iDe, esA = i === iA;
                const fill = esDe ? '#dbeafe' : esA ? '#dcfce7' : i >= desde && i <= hasta && sal ? '#fef9c3' : '#f1f5f9';
                const borde = esDe ? AZUL : esA ? VERDE : '#cbd5e1';
                return (
                    <g key={s} onClick={onElegir ? () => onElegir(s) : undefined} style={{ cursor: onElegir ? 'pointer' : 'default' }}>
                        <rect x={x} y={y} width={w - 4} height={H - y - 8} rx={6} fill={fill} stroke={borde} strokeWidth={esDe || esA ? 2.5 : 1.2} />
                        <text x={x + (w - 4) / 2} y={y + 17} textAnchor="middle" fontSize={15} fontWeight={800} fill={esDe ? AZUL : esA ? VERDE : '#334155'}>{s}</text>
                        {esDe && <text x={x + (w - 4) / 2} y={y + 34} textAnchor="middle" fontSize={10} fontWeight={700} fill={AZUL}>DE</text>}
                        {esA && <text x={x + (w - 4) / 2} y={y + 34} textAnchor="middle" fontSize={10} fontWeight={700} fill={VERDE}>A</text>}
                    </g>
                );
            })}
            {/* arcos de los saltos */}
            {mostrarSaltos && sal && Array.from({ length: sal.n }, (_, k) => {
                const i = sal.baja ? iDe + k : iDe - k;
                const j = sal.baja ? i + 1 : i - 1;
                const x1 = 5 + i * w + (w - 4) / 2, x2 = 5 + j * w + (w - 4) / 2;
                const y1 = top + i * h - 4, y2 = top + j * h - 4;
                const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 26;
                const f = sal.baja ? esc.saltos[i] : esc.saltos[j];
                return (
                    <g key={k}>
                        <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke={sal.baja ? '#ea580c' : '#7c3aed'} strokeWidth={2.2} markerEnd={`url(#flecha-${sal.baja ? 'b' : 's'})`} />
                        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={11.5} fontWeight={900} fill={sal.baja ? '#ea580c' : '#7c3aed'}>{sal.baja ? '×' : ':'}{fmt(f)}</text>
                    </g>
                );
            })}
            <defs>
                <marker id="flecha-b" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ea580c" /></marker>
                <marker id="flecha-s" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7c3aed" /></marker>
            </defs>
        </svg>
    );
}

// ── Cadena de factores de conversión ─────────────────────────────────────────
const Frac = ({ arriba, abajo, vacio, tachar = new Set(), color = '#0f172a' }) => {
    const unidadTxt = (t, pos) => {
        if (!t) return null;
        const [v, uu] = t;
        const tach = tachar.has(`${pos}:${uu}`);
        return (
            <span>
                {v !== null && v !== undefined && <>{typeof v === 'number' ? fmtFactor(v) : v}&nbsp;</>}
                <span style={tach ? { textDecoration: 'line-through', textDecorationColor: ROJO, textDecorationThickness: 2, color: '#94a3b8' } : null}>{uu}</span>
            </span>
        );
    };
    return (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px', verticalAlign: 'middle', color }}>
            <span style={{ padding: '0 6px', minWidth: vacio ? 56 : 0, minHeight: '1.2em', borderBottom: `2px solid ${color}`, textAlign: 'center', whiteSpace: 'nowrap' }}>{vacio ? ' ' : unidadTxt(arriba, 'n')}</span>
            <span style={{ padding: '0 6px', minWidth: vacio ? 56 : 0, minHeight: '1.2em', textAlign: 'center', whiteSpace: 'nowrap' }}>{vacio ? ' ' : unidadTxt(abajo, 'd')}</span>
        </span>
    );
};

/** valor de · (factor) · (factor) = resultado a. Con `vacio` deja los factores en blanco para rellenar. */
export function CadenaFactores({ mag, de, a, valor, vacio = false, size = 1 }) {
    const fs = factoresEntre(mag, de, a);
    const ud = unidad(mag, de);
    const res = convertir(valor, mag, de, a);
    // Unidades que se simplifican: las que aparecen arriba y abajo
    const arribaU = [ud?.num ? ud.num[1] : de, ...fs.map((f) => f.arriba[1])];
    const abajoU = [ud?.den ? ud.den[1] : null, ...fs.map((f) => f.abajo[1])].filter(Boolean);
    const tachar = new Set();
    if (!vacio) {
        const restantes = [...abajoU];
        arribaU.forEach((x) => {
            const k = restantes.indexOf(x);
            if (k >= 0) { restantes.splice(k, 1); tachar.add(`n:${x}`); tachar.add(`d:${x}`); }
        });
    }
    const huecos = vacio ? Math.max(1, fs.length) : 0;
    return (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, fontSize: `${1.05 * size}rem`, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
            {ud?.num
                ? <Frac arriba={[valor, ud.num[1]]} abajo={[null, ud.den[1]]} tachar={tachar} />
                : <Frac arriba={[valor, de]} abajo={null} tachar={tachar} />}
            {vacio
                ? Array.from({ length: huecos }, (_, i) => <React.Fragment key={i}><span>·</span><span style={{ fontSize: '1.6em', color: GRIS }}>(</span><Frac vacio /><span style={{ fontSize: '1.6em', color: GRIS }}>)</span></React.Fragment>)
                : fs.map((f, i) => <React.Fragment key={i}><span>·</span><span style={{ fontSize: '1.6em', color: GRIS, fontWeight: 300 }}>(</span><Frac arriba={f.arriba} abajo={f.abajo} tachar={tachar} color="#7c3aed" /><span style={{ fontSize: '1.6em', color: GRIS, fontWeight: 300 }}>)</span></React.Fragment>)}
            <span>&nbsp;=&nbsp;</span>
            {vacio ? <span style={{ borderBottom: '2px dotted #94a3b8', minWidth: 70, display: 'inline-block' }}>&nbsp;</span> : <span style={{ color: VERDE, fontWeight: 900 }}>{fmt(res)}</span>}
            <span>&nbsp;{a}</span>
        </div>
    );
}

// ── Termómetros °C · K · °F ──────────────────────────────────────────────────
export function Termometros({ c, maxAncho = 360, marcar = null }) {
    const min = -40, max = 120;
    const W = 330, H = 230, y0 = 200, y1 = 22;
    const y = (cc) => y0 - ((Math.max(min, Math.min(max, cc)) - min) / (max - min)) * (y0 - y1);
    const escalas = [
        { u: '°C', x: 60, val: (cc) => cc, color: '#ef4444' },
        { u: 'K', x: 165, val: (cc) => cc + 273, color: '#8b5cf6' },
        { u: '°F', x: 270, val: (cc) => cc * 1.8 + 32, color: '#f97316' },
    ];
    const ref = [[-40, 'iguales'], [0, 'hielo'], [37, 'cuerpo'], [100, 'agua hierve']];
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: maxAncho, display: 'block', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
            {ref.map(([cc, t]) => (
                <g key={cc}>
                    <line x1={20} x2={W - 10} y1={y(cc)} y2={y(cc)} stroke="#e2e8f0" strokeDasharray="4 3" />
                    <text x={W - 10} y={y(cc) - 2} textAnchor="end" fontSize={8.5} fill="#94a3b8">{t}</text>
                </g>
            ))}
            {escalas.map((e) => (
                <g key={e.u}>
                    <rect x={e.x - 7} y={y1 - 6} width={14} height={y0 - y1 + 10} rx={7} fill="white" stroke="#94a3b8" strokeWidth={1.5} />
                    <rect x={e.x - 4} y={y(c)} width={8} height={y0 - y(c) + 6} fill={e.color} />
                    <circle cx={e.x} cy={y0 + 10} r={11} fill={e.color} stroke="#94a3b8" strokeWidth={1.5} />
                    {ref.map(([cc]) => <text key={cc} x={e.x - 12} y={y(cc) + 3} textAnchor="end" fontSize={9} fill={GRIS}>{fmt(e.val(cc))}</text>)}
                    <text x={e.x} y={14} textAnchor="middle" fontSize={13} fontWeight={900} fill={e.color}>{e.u}</text>
                    <g>
                        <rect x={e.x + 10} y={y(c) - 10} width={52} height={18} rx={5} fill={marcar === e.u ? '#fef08a' : 'white'} stroke={e.color} />
                        <text x={e.x + 36} y={y(c) + 3} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">{fmt(Math.round(e.val(c) * 10) / 10)}</text>
                    </g>
                </g>
            ))}
            <line x1={20} x2={W - 70} y1={y(c)} y2={y(c)} stroke="#0f172a" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
        </svg>
    );
}

// ── Círculo de ángulos (grados ↔ radianes) ───────────────────────────────────
export function CirculoAngulo({ grados, maxAncho = 260 }) {
    const R0 = 80, cx = 110, cy = 105;
    const g = ((grados % 720) + 720) % 720;
    const gg = Math.min(g, 359.99);
    const rad = (gg * Math.PI) / 180;
    const px = cx + R0 * Math.cos(rad), py = cy - R0 * Math.sin(rad);
    const grande = gg > 180 ? 1 : 0;
    const fr = Number.isInteger(grados) ? fraccionDePi(grados) : null;
    const marcas = [[0, '0'], [90, 'π/2'], [180, 'π'], [270, '3π/2']];
    return (
        <svg viewBox="0 0 230 215" style={{ width: '100%', maxWidth: maxAncho, display: 'block', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
            <circle cx={cx} cy={cy} r={R0} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={cx - R0 - 8} x2={cx + R0 + 8} y1={cy} y2={cy} stroke="#cbd5e1" />
            <line x1={cx} x2={cx} y1={cy - R0 - 8} y2={cy + R0 + 8} stroke="#cbd5e1" />
            {gg > 0 && <path d={`M ${cx} ${cy} L ${cx + R0} ${cy} A ${R0} ${R0} 0 ${grande} 0 ${px} ${py} Z`} fill="rgba(108,92,231,0.22)" stroke="#6c5ce7" strokeWidth={2} />}
            <line x1={cx} y1={cy} x2={px} y2={py} stroke="#6c5ce7" strokeWidth={2.5} />
            {marcas.map(([m, t]) => {
                const r = (m * Math.PI) / 180;
                return <text key={m} x={cx + (R0 + 14) * Math.cos(r)} y={cy - (R0 + 14) * Math.sin(r) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={GRIS}>{t}</text>;
            })}
            <text x={cx} y={208} textAnchor="middle" fontSize={13} fontWeight={900} fill="#0f172a">
                {fmt(grados)}° = {fr ? `${fr.texto} rad ≈ ` : ''}{fmt(Number(((grados * Math.PI) / 180).toFixed(3)))} rad
            </text>
        </svg>
    );
}

// ── Volumen ↔ capacidad ──────────────────────────────────────────────────────
export function TablaVolCap({ de = null, a = null, size = 1 }) {
    const grupos = [['m³', ['kl', 'hl', 'dal']], ['dm³', ['l', 'dl', 'cl']], ['cm³', ['ml']]];
    const marca = (s) => (s === de ? { background: '#dbeafe', color: AZUL } : s === a ? { background: '#dcfce7', color: VERDE } : {});
    const td = { border: '1.5px solid #94a3b8', padding: '4px 8px', textAlign: 'center', fontWeight: 800, fontSize: `${0.95 * size}rem` };
    return (
        <table style={{ borderCollapse: 'collapse', background: 'white' }}>
            <tbody>
                <tr>{grupos.map(([v, cs]) => <td key={v} colSpan={cs.length} style={{ ...td, background: '#fff7ed', ...marca(v) }}>{v}</td>)}</tr>
                <tr>{grupos.flatMap(([, cs]) => cs).map((s) => <td key={s} style={{ ...td, background: '#ecfeff', ...marca(s) }}>{s}</td>)}</tr>
            </tbody>
        </table>
    );
}

// ── Tabla de posiciones (formas complejas) ───────────────────────────────────
export function TablaPosiciones({ us, cant = null, size = 1 }) {
    const td = { border: '1.5px solid #94a3b8', padding: '3px 10px', textAlign: 'center', fontWeight: 800, fontSize: `${0.95 * size}rem`, minWidth: 30 };
    return (
        <table style={{ borderCollapse: 'collapse', background: 'white' }}>
            <tbody>
                <tr>{us.map((x) => <td key={x} style={{ ...td, background: '#eef2ff', color: '#3730a3' }}>{x}</td>)}</tr>
                <tr>{us.map((x, i) => <td key={x} style={{ ...td, height: '1.4em' }}>{cant ? cant[i] : ''}</td>)}</tr>
            </tbody>
        </table>
    );
}

// ── Dibujo según el apartado (fichas, pizarra, práctica) ─────────────────────
/** v = ap.v · solucion: con flechas y resultado · enunciado: plantilla vacía para el alumno. */
export function VisualConversion({ v, solucion = false, size = 1 }) {
    if (!v) return null;
    if (v.clase === 'compleja') return <TablaPosiciones us={v.us} cant={solucion ? v.cant : null} size={size} />;
    if (v.clase !== 'conv') return null;
    const { mag, de, a, valor, metodo } = v;
    if (mag === 'temperatura') {
        const c = de === '°C' ? valor : de === 'K' ? valor - 273 : (valor - 32) / 1.8;
        return <Termometros c={c} marcar={solucion ? a : de} maxAncho={300 * size} />;
    }
    if (mag === 'angulo' && (de === 'rad' || a === 'rad')) {
        const g = de === '°' ? valor : a === '°' ? v.res : convertir(valor, 'angulo', de, '°');
        return solucion ? <CirculoAngulo grados={Math.round(g * 100) / 100} maxAncho={220 * size} /> : <CadenaFactores mag={mag} de={de} a={a} valor={valor} vacio size={size} />;
    }
    const magD = magnitudDibujo(mag, de, a);
    if (magD === 'volcap') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <TablaVolCap de={de} a={a} size={size} />
                {solucion && <CadenaFactores mag={mag} de={de} a={a} valor={valor} size={size} />}
            </div>
        );
    }
    const conEscalera = !!saltosEntre(magD, de, a);
    if (metodo === 'factor' || !conEscalera) return <CadenaFactores mag={mag} de={de} a={a} valor={valor} vacio={!solucion} size={size} />;
    return <Escalera mag={magD} de={de} a={a} mostrarSaltos={solucion} maxAncho={420 * size} />;
}

export { MAGNITUDES, conU };
