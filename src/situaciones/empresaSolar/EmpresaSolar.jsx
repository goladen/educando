// ─── Situación de aprendizaje: Mi empresa de placas solares ───────────────────
// El alumno funda una empresa instaladora: crea el logo (con la Pizarra de Pikt),
// recibe el pedido de un cliente (tejado, consumo, factura), diseña la instalación
// eligiendo el tipo de panel, calcula la producción según el sol, decide si le
// conviene una batería, hace el presupuesto pagando a cada profesional, calcula la
// amortización, propone medidas de eficiencia y entrega una propuesta imprimible.
// Cálculos y preguntas: ./modeloSolar.js. Informe: tipo EMPRESA_SOLAR.
import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { validarNombre } from '../../utils/filtroNombres';
import { guardarRegistroLocal } from '../../utils/registrosLocales';
import { imprimirElemento } from '../../utils/exportar';
import CargandoChunk from '../../components/CargandoChunk';
import {
    FASES, PANELES, CIUDADES, PERFILES, INVERSORES, BATERIAS, MESES, DIAS_MES, ORIENTACION_NOMBRE,
    PR, MARGEN_BORDE, VIDA, CO2_KWH, IVA, DEGRADACION, SUBIDA_LUZ, CICLOS, DOD, AUTO_MAX,
    calcular, generarPedido, preguntasFase, esCorrecta, perdidasOI, codigoASemilla, semillaNueva, fmt, eur,
} from './modeloSolar';

const PizarraApp = lazy(() => import('../../GestionAula').then(m => ({ default: m.PizarraApp })));

const LS_KEY = 'pikt_empresa_solar';
const C = { sol: '#d97706', solClaro: '#fef3c7', azul: '#1d4ed8', verde: '#15803d', rojo: '#dc2626', fondo: '#fffbeb', borde: '#e2e8f0', texto: '#0f172a', gris: '#64748b', panel: '#1e3a8a' };
const card = { background: 'white', borderRadius: 16, border: `1px solid ${C.borde}`, boxShadow: '0 2px 10px rgba(15,23,42,0.05)', padding: 18 };
const btn = (bg, color = 'white') => ({ background: bg, color, border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit' });
const inp = { padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${C.borde}`, fontSize: '0.92rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
const th = { textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: C.gris, borderBottom: `1px solid ${C.borde}`, fontWeight: 700 };
const td = { padding: '6px 8px', fontSize: '0.86rem', borderBottom: '1px solid #f1f5f9' };
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const COLORES_MARCA = ['#f59e0b', '#16a34a', '#0284c7', '#7c3aed', '#dc2626', '#0f766e', '#ea580c', '#1e293b'];
const nombreOrient = a => ORIENTACION_NOMBRE[a] || `${a}°`;

const leerLS = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };

// ─── Logo: recorta el blanco sobrante y lo reduce (cabe en el informe) ────────
function cargarImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
async function procesarLogo(src, max = 300) {
    const img = await cargarImg(src);
    const s0 = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s0)), h = Math.max(1, Math.round(img.naturalHeight * s0));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        if (d[k] < 235 || d[k + 1] < 235 || d[k + 2] < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    const pad = 10;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, max / Math.max(cw, ch));
    const out = document.createElement('canvas'); out.width = Math.round(cw * s); out.height = Math.round(ch * s);
    const o = out.getContext('2d');
    o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height); o.imageSmoothingQuality = 'high';
    o.drawImage(cv, x0, y0, cw, ch, 0, 0, out.width, out.height);
    let url = out.toDataURL('image/webp', 0.85);
    if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.88);
    return url;
}

function Logo({ empresa, size = 64 }) {
    const color = empresa?.color || C.sol;
    if (empresa?.logo) return <img src={empresa.logo} alt="Logo" style={{ width: size, height: size, objectFit: 'contain', borderRadius: 12, background: 'white', border: `2px solid ${color}` }} />;
    const ini = (empresa?.nombre || '☀').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '☀';
    return <div style={{ width: size, height: size, borderRadius: 12, background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36 }}>{ini}</div>;
}

// ─── Preguntas (genéricas) ────────────────────────────────────────────────────
function Pregunta({ q, n, r = {}, set }) {
    const [v, setV] = useState(r.v ?? '');
    const [pistas, setPistas] = useState(0);
    useEffect(() => { setV(r.v ?? ''); setPistas(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q.id]);
    const hecho = r.estado === 'ok' || r.estado === 'revelado';
    const comprobar = (val = v) => {
        if (hecho || val === '' || val == null) return;
        const ok = esCorrecta(q, val);
        set({ v: val, estado: ok ? 'ok' : 'mal', intentos: (r.intentos || 0) + 1, pistas: Math.max(r.pistas || 0, pistas) });
    };
    const solTxt = q.tipo === 'opc' ? (q.opciones.find(o => o.v === q.sol)?.label || q.sol) : `${fmt(q.sol, q.dec ?? 2)} ${q.u}`;
    const borde = r.estado === 'ok' ? '#86efac' : r.estado === 'revelado' ? '#cbd5e1' : r.estado === 'mal' ? '#fca5a5' : C.borde;
    const fondo = r.estado === 'ok' ? '#f0fdf4' : r.estado === 'revelado' ? '#f8fafc' : 'white';
    return (
        <div style={{ border: `1.5px solid ${borde}`, background: fondo, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: C.sol, minWidth: 20 }}>{n}.</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.92rem' }}>{q.txt}</span>
                {r.estado === 'ok' && <span title="Correcto">✅</span>}
                {r.estado === 'revelado' && <span title="Solución vista">👁️</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {q.tipo === 'opc' ? (
                    <select value={v} disabled={hecho} onChange={e => { setV(e.target.value); comprobar(e.target.value); }} style={{ ...inp, width: 'auto', maxWidth: '100%', flex: '1 1 220px' }}>
                        <option value="">— Elige —</option>
                        {q.opciones.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                ) : (
                    <>
                        <input value={hecho && r.estado === 'revelado' ? fmt(q.sol, q.dec ?? 2) : v} disabled={hecho} inputMode="decimal"
                            onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') comprobar(); }}
                            placeholder="Tu resultado" style={{ ...inp, width: 150, fontVariantNumeric: 'tabular-nums' }} />
                        <span style={{ color: C.gris, fontSize: '0.88rem' }}>{q.u}</span>
                        {!hecho && <button onClick={() => comprobar()} style={btn(C.sol)}>Comprobar</button>}
                    </>
                )}
                {!hecho && pistas < 2 && <button onClick={() => setPistas(p => p + 1)} style={btn('#e0f2fe', '#0369a1')}>💡 {pistas === 0 ? 'Fórmula' : 'Con números'}</button>}
                {!hecho && (r.intentos || 0) >= 1 && <button onClick={() => set({ estado: 'revelado', intentos: r.intentos || 0, pistas: Math.max(r.pistas || 0, pistas) })} style={btn('#f1f5f9', C.gris)}>👁️ Ver solución</button>}
            </div>
            {r.estado === 'mal' && <div style={{ color: C.rojo, fontSize: '0.82rem', marginTop: 6 }}>✗ No es correcto ({r.intentos} {r.intentos === 1 ? 'intento' : 'intentos'}). Revisa la operación{q.u === '€' ? ' y redondea a céntimos' : ''}.</div>}
            {(pistas >= 1 || hecho) && q.formula && <div style={{ fontSize: '0.82rem', color: '#0369a1', marginTop: 6 }}>📐 {q.formula}</div>}
            {(pistas >= 2 || hecho) && q.pista && <div style={{ fontSize: '0.82rem', color: '#0369a1', marginTop: 2, fontFamily: 'ui-monospace, Consolas, monospace' }}>🔢 {q.pista}</div>}
            {hecho && <div style={{ fontSize: '0.82rem', color: r.estado === 'ok' ? C.verde : C.gris, marginTop: 4, fontWeight: 700 }}>= {solTxt}</div>}
        </div>
    );
}
function Preguntas({ qs, resp, setResp, desde = 1, titulo = '✏️ Calcula' }) {
    if (!qs.length) return null;
    return (
        <div style={{ ...card, marginTop: 14 }}>
            <h3 style={{ margin: '0 0 10px', color: C.sol, fontSize: '1.05rem' }}>{titulo}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {qs.map((q, i) => <Pregunta key={q.id} q={q} n={desde + i} r={resp[q.id]} set={cambios => setResp(q.id, cambios)} />)}
            </div>
        </div>
    );
}

// ─── Dibujos ──────────────────────────────────────────────────────────────────
function TejadoSVG({ t, fit, n = 0, panel, verPaneles = true }) {
    const W = 560, H = 330, pad = 38;
    const s = Math.min((W - 2 * pad) / t.largo, (H - 2 * pad - 16) / t.ancho);
    const rw = t.largo * s, rh = t.ancho * s, x0 = (W - rw) / 2, y0 = pad;
    const m = MARGEN_BORDE * s;
    const paneles = [];
    if (verPaneles && fit) {
        const offX = (fit.uL - fit.nL * fit.enL) / 2 * s;
        for (let r = 0; r < fit.nA; r++) for (let k = 0; k < fit.nL; k++) {
            const idx = r * fit.nL + k;
            paneles.push({ idx, x: x0 + m + offX + k * fit.enL * s, y: y0 + rh - m - (r + 1) * fit.enA * s, w: fit.enL * s, h: fit.enA * s, lleno: idx < n });
        }
    }
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}>
            <defs>
                <pattern id="tejas" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#c2410c" /><path d="M0 9.5 H14 M7 0 V10" stroke="#9a3412" strokeWidth="1" /></pattern>
            </defs>
            <text x={W / 2} y={y0 - 12} textAnchor="middle" fontSize="12" fill={C.gris}>⬆ cumbrera (parte alta)</text>
            <rect x={x0} y={y0} width={rw} height={rh} fill="url(#tejas)" stroke="#7c2d12" strokeWidth="2" rx="3" />
            <rect x={x0 + m} y={y0 + m} width={rw - 2 * m} height={rh - 2 * m} fill="none" stroke="white" strokeDasharray="6 4" strokeWidth="1.5" opacity="0.9" />
            {paneles.map(pn => (
                <g key={pn.idx}>
                    <rect x={pn.x + 0.8} y={pn.y + 0.8} width={pn.w - 1.6} height={pn.h - 1.6} rx="2"
                        fill={pn.lleno ? (panel?.color || C.panel) : 'rgba(255,255,255,0.18)'} stroke={pn.lleno ? '#93c5fd' : 'white'} strokeDasharray={pn.lleno ? '' : '3 3'} strokeWidth="1" />
                    {pn.lleno && <path d={`M${pn.x + pn.w / 2} ${pn.y + 2} V${pn.y + pn.h - 2} M${pn.x + 2} ${pn.y + pn.h / 3} H${pn.x + pn.w - 2} M${pn.x + 2} ${pn.y + 2 * pn.h / 3} H${pn.x + pn.w - 2}`} stroke="#60a5fa" strokeWidth="0.6" opacity="0.7" />}
                </g>
            ))}
            <text x={W / 2} y={y0 + rh + 16} textAnchor="middle" fontSize="12" fill={C.gris}>alero (parte baja) · largo {fmt(t.largo, 1)} m</text>
            <text x={x0 - 8} y={y0 + rh / 2} textAnchor="middle" fontSize="12" fill={C.gris} transform={`rotate(-90 ${x0 - 8} ${y0 + rh / 2})`}>ancho {fmt(t.ancho, 1)} m</text>
            <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={C.gris}>Línea discontinua blanca: margen de {fmt(MARGEN_BORDE, 1)} m en cada borde</text>
        </svg>
    );
}

function Brujula({ azim }) {
    const th = (180 + azim) * Math.PI / 180, cx = 60, cy = 60, r = 38;
    const x = cx + r * Math.sin(th), y = cy - r * Math.cos(th);
    return (
        <svg viewBox="0 0 120 120" style={{ width: 120 }}>
            <circle cx={cx} cy={cy} r="48" fill="#f8fafc" stroke={C.borde} strokeWidth="2" />
            {[['N', 60, 20], ['S', 60, 108], ['E', 104, 64], ['O', 16, 64]].map(([l, lx, ly]) => <text key={l} x={lx} y={ly} textAnchor="middle" fontSize="12" fontWeight="700" fill={l === 'S' ? C.sol : C.gris}>{l}</text>)}
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={C.sol} strokeWidth="4" strokeLinecap="round" />
            <circle cx={x} cy={y} r="5" fill={C.sol} />
            <circle cx={cx} cy={cy} r="4" fill={C.texto} />
        </svg>
    );
}

function Inclinacion({ beta }) {
    const b = beta * Math.PI / 180, L = 120, x0 = 20, y0 = 90;
    const x1 = x0 + L * Math.cos(b), y1 = y0 - L * Math.sin(b);
    return (
        <svg viewBox="0 0 170 110" style={{ width: 170 }}>
            <line x1={x0} y1={y0} x2={x0 + L + 10} y2={y0} stroke={C.gris} strokeWidth="1.5" strokeDasharray="4 3" />
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#c2410c" strokeWidth="6" strokeLinecap="round" />
            <path d={`M${x0 + 34} ${y0} A34 34 0 0 0 ${x0 + 34 * Math.cos(b)} ${y0 - 34 * Math.sin(b)}`} fill="none" stroke={C.sol} strokeWidth="2" />
            <text x={x0 + 44} y={y0 - 6} fontSize="13" fontWeight="700" fill={C.sol}>β = {beta}°</text>
            <text x="140" y="24" fontSize="22">☀️</text>
        </svg>
    );
}

function BarrasMes({ prod, cons }) {
    const W = 640, H = 230, pl = 44, pb = 26, pt = 10;
    const maxV = Math.max(1, ...prod, ...cons) * 1.1;
    const bw = (W - pl - 10) / 12;
    const y = v => pt + (H - pt - pb) * (1 - v / maxV);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxV * f / 50) * 50);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
            {ticks.map(tk => <g key={tk}><line x1={pl} x2={W - 6} y1={y(tk)} y2={y(tk)} stroke="#f1f5f9" /><text x={pl - 6} y={y(tk) + 4} fontSize="10" textAnchor="end" fill={C.gris}>{tk}</text></g>)}
            {prod.map((v, i) => (
                <g key={i}>
                    <rect x={pl + i * bw + bw * 0.12} y={y(v)} width={bw * 0.42} height={H - pb - y(v)} fill="#f59e0b" rx="2"><title>{`${MESES[i]}: produce ${fmt(v, 0)} kWh`}</title></rect>
                    <rect x={pl + i * bw + bw * 0.54} y={y(cons[i])} width={bw * 0.34} height={H - pb - y(cons[i])} fill="#64748b" rx="2"><title>{`${MESES[i]}: consume ${fmt(cons[i], 0)} kWh`}</title></rect>
                    <text x={pl + i * bw + bw / 2} y={H - 8} fontSize="10" textAnchor="middle" fill={C.gris}>{MESES[i]}</text>
                </g>
            ))}
        </svg>
    );
}

function CurvaAmort({ serie }) {
    const W = 640, H = 240, pl = 58, pb = 26, pt = 12;
    const mn = Math.min(0, ...serie), mx = Math.max(0, ...serie);
    const rango = Math.max(1, mx - mn);
    const x = i => pl + (W - pl - 12) * i / (serie.length - 1);
    const y = v => pt + (H - pt - pb) * (1 - (v - mn) / rango);
    const pts = serie.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
            <line x1={pl} x2={W - 8} y1={y(0)} y2={y(0)} stroke={C.texto} strokeWidth="1.2" />
            <text x={pl - 6} y={y(0) + 4} fontSize="10" textAnchor="end" fill={C.texto}>0 €</text>
            <text x={pl - 6} y={y(mx) + 4} fontSize="10" textAnchor="end" fill={C.gris}>{fmt(mx, 0)}</text>
            <text x={pl - 6} y={y(mn) + 4} fontSize="10" textAnchor="end" fill={C.gris}>{fmt(mn, 0)}</text>
            <polyline points={pts} fill="none" stroke={C.sol} strokeWidth="2.5" />
            {serie.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={v >= 0 ? C.verde : C.rojo}><title>{`Año ${i}: ${fmt(v, 0)} €`}</title></circle>)}
            {serie.map((_, i) => i % 5 === 0 && <text key={'t' + i} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill={C.gris}>{i}</text>)}
            <text x={W - 10} y={H - 8} fontSize="10" textAnchor="end" fill={C.gris}>años</text>
        </svg>
    );
}

const Info = ({ children, color = '#0369a1', bg = '#f0f9ff' }) => (
    <div style={{ background: bg, borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '10px 14px', fontSize: '0.88rem', lineHeight: 1.5, color: C.texto, marginTop: 10 }}>{children}</div>
);
const Dato = ({ k, v }) => (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '8px 12px', minWidth: 120, flex: '1 1 120px' }}>
        <div style={{ fontSize: '0.72rem', color: C.gris, fontWeight: 700 }}>{k}</div>
        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{v}</div>
    </div>
);

// ─── Fases ────────────────────────────────────────────────────────────────────
function Fase1({ empresa, setEmpresa }) {
    const [pizarra, setPizarra] = useState(false);
    const [error, setError] = useState('');
    const [procesando, setProcesando] = useState(false);
    const fileRef = useRef(null);
    const usar = async (src) => {
        setProcesando(true);
        try {
            const logo = await procesarLogo(src);
            if (!logo) { setError('La hoja está en blanco: dibuja algo antes de usarla.'); }
            else { setEmpresa({ logo }); setPizarra(false); setError(''); }
        } catch { setError('No se ha podido usar esa imagen.'); }
        setProcesando(false);
    };
    const subir = e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        const rd = new FileReader(); rd.onload = () => usar(rd.result); rd.readAsDataURL(f);
    };
    const nombreMal = empresa.nombre && !validarNombre(empresa.nombre).ok;
    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
                <div style={card}>
                    <h3 style={{ margin: '0 0 10px', color: C.sol }}>🏢 Datos de tu empresa</h3>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.gris }}>Nombre de la empresa</label>
                    <input value={empresa.nombre || ''} maxLength={40} onChange={e => setEmpresa({ nombre: e.target.value })} placeholder="Ej.: SolTejado Energía" style={{ ...inp, marginBottom: 4 }} />
                    {nombreMal && <div style={{ color: C.rojo, fontSize: '0.8rem' }}>⚠ {validarNombre(empresa.nombre).mensaje}</div>}
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.gris, display: 'block', marginTop: 8 }}>Eslogan</label>
                    <input value={empresa.eslogan || ''} maxLength={70} onChange={e => setEmpresa({ eslogan: e.target.value })} placeholder="Ej.: Tu tejado trabaja para ti" style={inp} />
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.gris, display: 'block', marginTop: 10 }}>Color de la marca</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                        {COLORES_MARCA.map(col => <button key={col} onClick={() => setEmpresa({ color: col })} aria-label={col} style={{ width: 30, height: 30, borderRadius: '50%', background: col, border: (empresa.color || C.sol) === col ? '3px solid #0f172a' : '2px solid white', boxShadow: '0 0 0 1px #cbd5e1', cursor: 'pointer' }} />)}
                        <input type="color" value={empresa.color || '#f59e0b'} onChange={e => setEmpresa({ color: e.target.value })} style={{ width: 36, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                    </div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: C.gris, display: 'block', marginTop: 10 }}>¿Qué quieres transmitir con tu marca?</label>
                    <textarea value={empresa.idea || ''} maxLength={400} onChange={e => setEmpresa({ idea: e.target.value })} rows={3} placeholder="Ej.: confianza, energía limpia, ahorro… y por qué has elegido esos colores y símbolos." style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div style={card}>
                    <h3 style={{ margin: '0 0 10px', color: C.sol }}>🎨 El logo</h3>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Logo empresa={empresa} size={110} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
                            <button onClick={() => setPizarra(true)} style={btn(empresa.color || C.sol)}>🖌️ Dibujar en la Pizarra</button>
                            <button onClick={() => fileRef.current?.click()} style={btn('#e2e8f0', C.texto)}>📁 Subir una imagen</button>
                            {empresa.logo && <button onClick={() => setEmpresa({ logo: null })} style={btn('#fee2e2', C.rojo)}>🗑️ Quitar el logo</button>}
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={subir} />
                        </div>
                    </div>
                    {procesando && <div style={{ color: C.gris, fontSize: '0.85rem', marginTop: 8 }}>Preparando el logo…</div>}
                    {error && <div style={{ color: C.rojo, fontSize: '0.85rem', marginTop: 8 }}>⚠ {error}</div>}
                    <Info color={C.sol} bg={C.solClaro}>
                        <b>Un buen logo…</b>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                            <li>Es <b>sencillo</b>: se reconoce aunque sea pequeño (en una tarjeta o en la furgoneta).</li>
                            <li>Usa <b>2 o 3 colores</b> como mucho.</li>
                            <li>Se relaciona con lo que haces: sol, energía, casa, hoja…</li>
                            <li>Si lleva texto, que se lea bien.</li>
                        </ul>
                        <div style={{ marginTop: 6 }}>En la Pizarra tienes formas, texto, colores y el <b>🖼️ Banco</b> de imágenes (hay una categoría solar). Al terminar pulsa <b>«✅ Usar como logo»</b>: se recorta solo el blanco sobrante.</div>
                    </Info>
                </div>
            </div>
            {pizarra && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10040, background: '#f1f5f9', overflow: 'auto', padding: '60px 12px 20px' }}>
                    <div style={{ position: 'fixed', top: 10, left: 12, right: 12, zIndex: 10041, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => setPizarra(false)} style={{ ...btn('white', C.texto), boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>← Volver sin guardar</button>
                        <span style={{ background: 'white', borderRadius: 10, padding: '6px 12px', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>Dibuja tu logo y pulsa <b>«✅ Usar como logo»</b> en la barra de la pizarra.</span>
                    </div>
                    <Suspense fallback={<CargandoChunk texto="Cargando la pizarra…" />}>
                        <PizarraApp onUsarImagen={usar} textoUsarImagen="Usar como logo" />
                    </Suspense>
                </div>
            )}
        </>
    );
}

function Fase2({ c, qs, resp, setResp, empresa }) {
    const p = c.p, t = p.tejado;
    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 14 }}>
                <div style={{ ...card, background: '#fffdf7' }}>
                    <div style={{ fontSize: '0.8rem', color: C.gris }}>📧 Para: <b>{empresa.nombre || 'tu empresa'}</b> · Asunto: presupuesto de placas solares</div>
                    <div style={{ marginTop: 10, lineHeight: 1.6, fontSize: '0.93rem' }}>
                        <p style={{ margin: '0 0 8px' }}>¡Hola! Somos <b>{p.cliente}</b> y vivimos en una casa en <b>{c.ciudad.nombre}</b>. Queremos poner placas solares en el tejado para pagar menos luz.</p>
                        <p style={{ margin: '0 0 8px' }}>El faldón que da al <b>{nombreOrient(t.azim).toLowerCase()}</b> mide <b>{fmt(t.largo, 1)} m</b> de largo y <b>{fmt(t.ancho, 1)} m</b> de ancho, con una inclinación de <b>{t.incl}°</b>.</p>
                        <p style={{ margin: '0 0 8px' }}>En la última factura pone que gastamos <b>{fmt(p.consumo, 0)} kWh al año</b> y que el kWh nos cuesta <b>{fmt(p.precio, 3)} €</b>. Por la luz que nos sobre nos pagarían <b>{fmt(p.comp, 3)} €/kWh</b>. {PERFILES[p.perfil].nombre}.</p>
                        {p.pideBateria && <p style={{ margin: '0 0 8px' }}>Un vecino tiene batería… ¿a nosotros nos conviene?</p>}
                        {p.tieneTermo && <p style={{ margin: '0 0 8px' }}>El agua caliente la calentamos con un termo eléctrico.</p>}
                        <p style={{ margin: '0 0 8px' }}>No queremos gastar más de <b>{eur(p.presupuestoMax, 0)}</b>{p.ayuda ? <> y el ayuntamiento nos da una ayuda de <b>{eur(p.ayuda, 0)}</b></> : null}.</p>
                        <p style={{ margin: 0 }}>¡Esperamos vuestra propuesta!</p>
                    </div>
                </div>
                <div style={card}>
                    <h3 style={{ margin: '0 0 8px', color: C.sol }}>🏠 El tejado</h3>
                    <TejadoSVG t={t} verPaneles={false} />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}><Brujula azim={t.azim} /><div style={{ fontSize: '0.8rem', color: C.gris }}>Mira al <b>{nombreOrient(t.azim)}</b> (α = {t.azim}°)</div></div>
                        <div style={{ textAlign: 'center' }}><Inclinacion beta={t.incl} /><div style={{ fontSize: '0.8rem', color: C.gris }}>Inclinación del tejado</div></div>
                    </div>
                </div>
            </div>
            <Info>
                <b>⚡ kW y kWh no son lo mismo.</b> La <b>potencia</b> (W, kW) dice lo rápido que se produce o se gasta la energía. La <b>energía</b> (kWh) es potencia × tiempo: un panel de 400 W al sol pleno durante 1 hora produce 0,4 kWh. La factura cobra kWh.
            </Info>
            <Preguntas qs={qs} resp={resp} setResp={setResp} />
        </>
    );
}

function Fase3({ c, qs, resp, setResp, setDec }) {
    return (
        <>
            <div style={card}>
                <h3 style={{ margin: '0 0 10px', color: C.sol }}>🧱 Catálogo de paneles</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
                    {PANELES.map(pn => {
                        const act = pn.id === c.panel.id;
                        return (
                            <button key={pn.id} onClick={() => setDec({ panelId: pn.id, n: undefined })} style={{ textAlign: 'left', border: act ? `3px solid ${C.sol}` : `1.5px solid ${C.borde}`, background: act ? C.solClaro : 'white', borderRadius: 12, padding: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                                <div style={{ fontWeight: 800 }}>{pn.nombre}</div>
                                <div style={{ fontSize: '0.84rem', color: C.gris, marginTop: 4 }}>{fmt(pn.largo, 2)} m × {fmt(pn.ancho, 2)} m · <b>{eur(pn.precio, 0)}</b></div>
                                <div style={{ fontSize: '0.8rem', color: C.gris, marginTop: 4 }}>{pn.nota}</div>
                            </button>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                    <b style={{ fontSize: '0.88rem' }}>Colocación:</b>
                    {[['V', '▯ En vertical (el lado largo sube por la pendiente)'], ['H', '▭ Tumbados (el lado largo a lo largo del alero)']].map(([o, l]) => (
                        <button key={o} onClick={() => setDec({ orient: o, n: undefined })} style={btn(c.orient === o ? C.sol : '#f1f5f9', c.orient === o ? 'white' : C.texto)}>{l}</button>
                    ))}
                </div>
            </div>
            <div style={{ ...card, marginTop: 14 }}>
                <TejadoSVG t={c.p.tejado} fit={c.fit} n={c.fit.nMax} panel={c.panel} />
                <Info>Prueba los cuatro paneles y las dos colocaciones: <b>no siempre gana el panel más potente</b>, porque si es más largo puede que quepa una fila menos. Fíjate también en el precio de cada vatio.</Info>
            </div>
            <Preguntas qs={qs} resp={resp} setResp={setResp} />
        </>
    );
}

function Explorador({ c }) {
    const [incl, setIncl] = useState(c.p.tejado.incl);
    const [azim, setAzim] = useState(c.p.tejado.azim);
    const [ciudadId, setCiudadId] = useState(c.ciudad.id);
    const ciu = CIUDADES.find(x => x.id === ciudadId);
    const hA = ciu.hsp.reduce((s, h, i) => s + h * DIAS_MES[i], 0);
    const L = perdidasOI(incl, azim, ciu.lat);
    const y = hA * PR * (1 - L);
    return (
        <div style={{ ...card, marginTop: 14, border: `2px dashed ${C.sol}` }}>
            <h3 style={{ margin: '0 0 4px', color: C.sol }}>🔭 ¿Y si…? Laboratorio del sol</h3>
            <div style={{ fontSize: '0.85rem', color: C.gris, marginBottom: 10 }}>Cambia la ciudad, la inclinación y la orientación y mira cómo cambia lo que produce 1 kWp. (No cambia tu pedido.)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
                <label style={{ fontSize: '0.85rem' }}>Ciudad<br />
                    <select value={ciudadId} onChange={e => setCiudadId(e.target.value)} style={inp}>{CIUDADES.map(x => <option key={x.id} value={x.id}>{x.nombre} (latitud {fmt(x.lat, 1)}°)</option>)}</select>
                </label>
                <label style={{ fontSize: '0.85rem' }}>Inclinación β = <b>{incl}°</b> <span style={{ color: C.gris }}>(la mejor ≈ {fmt(ciu.lat - 10, 0)}°)</span><br />
                    <input type="range" min="0" max="60" value={incl} onChange={e => setIncl(+e.target.value)} style={{ width: '100%' }} />
                </label>
                <label style={{ fontSize: '0.85rem' }}>Orientación α = <b>{azim}°</b> ({azim === 0 ? 'Sur' : azim < 0 ? 'hacia el este' : 'hacia el oeste'})<br />
                    <input type="range" min="-90" max="90" step="5" value={azim} onChange={e => setAzim(+e.target.value)} style={{ width: '100%' }} />
                </label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                <Dato k="Pérdidas por orientación e inclinación" v={`${fmt(L * 100, 1)} %`} />
                <Dato k="1 kWp produce al año" v={`${fmt(y, 0)} kWh`} />
                <Dato k="Comparado con tu pedido" v={`${y >= c.yieldEsp ? '+' : ''}${fmt((y / c.yieldEsp - 1) * 100, 1)} %`} />
            </div>
            <div style={{ height: 14, background: '#f1f5f9', borderRadius: 7, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, y / 1900 * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
            </div>
            <Info>Además de la orientación, la producción baja con las <b>sombras</b> (chimeneas, árboles, edificios), el <b>calor</b> (un panel a 65 °C rinde menos que a 25 °C) y la <b>suciedad</b>. Todo eso está dentro del rendimiento global de 0,8.</Info>
        </div>
    );
}

function Fase4({ c, qs, resp, setResp, setDec }) {
    const antes = qs.filter(q => !/^f4\.(prod|cob|mmax|mmin)/.test(q.id));
    const despues = qs.filter(q => /^f4\.(prod|cob|mmax|mmin)/.test(q.id));
    const t = c.p.tejado;
    return (
        <>
            <div style={card}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>☀️ Horas de sol pico en {c.ciudad.nombre}</h3>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>Las <b>HSP</b> son las horas que tendría que lucir el sol a 1000 W/m² para dar la energía de todo el día. Si en julio hay 7 HSP, <b>1 kWp</b> produciría 7 kWh al día… si todo fuera perfecto. En la realidad multiplicamos por un <b>rendimiento global de {fmt(PR, 1)}</b>.</div>
                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                        <thead><tr><th style={th}></th>{MESES.map(m => <th key={m} style={{ ...th, textAlign: 'right' }}>{m}</th>)}</tr></thead>
                        <tbody>
                            <tr><td style={td}>HSP (kWh/m²·día)</td>{c.ciudad.hsp.map((h, i) => <td key={i} style={tdNum}>{fmt(h, 1)}</td>)}</tr>
                            <tr><td style={td}>Días</td>{DIAS_MES.map((d, i) => <td key={i} style={tdNum}>{d}</td>)}</tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <Dato k="Irradiación anual (Σ HSP × días)" v={`${fmt(c.hAnual, 1)} kWh/m²`} />
                    <Dato k="Latitud φ" v={`${fmt(c.ciudad.lat, 1)}°`} />
                    <Dato k="Inclinación β" v={`${t.incl}°`} />
                    <Dato k="Orientación α (0 = sur)" v={`${t.azim}°`} />
                </div>
                <Info>Las HSP de la tabla son con los paneles <b>en la inclinación ideal y mirando al sur</b>. Si el tejado no está así, se pierde algo. El IDAE (Instituto para la Diversificación y Ahorro de la Energía) da esta fórmula:<br />
                    <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>pérdidas (%) = 100 · [0,00012 · (β − φ + 10)² + 0,000035 · α²]</span><br />
                    Si β ≤ 15° solo se usa la primera parte. En el pedido los paneles van <b>pegados al tejado</b>, con su misma inclinación y orientación.</Info>
            </div>
            <Preguntas qs={antes} resp={resp} setResp={setResp} />
            <Explorador c={c} />
            <div style={{ ...card, marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>🔧 ¿Cuántos paneles instalas?</h3>
                {c.cabe ? (
                    <>
                        <input type="range" min={c.nMin} max={c.fit.nMax} value={c.n} onChange={e => setDec({ n: +e.target.value })} style={{ width: '100%' }} />
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <Dato k="Paneles" v={`${c.n} de ${c.fit.nMax} posibles`} />
                            <Dato k="Potencia pico" v={`${fmt(c.kWp, 2)} kWp`} />
                            <Dato k="Para cubrir el consumo" v={`${c.nNec} paneles`} />
                        </div>
                        {c.nNec > c.fit.nMax && <Info color={C.rojo} bg="#fef2f2">En el tejado no caben todos los paneles que harían falta. Prueba otro panel u otra colocación en la fase 3, o cubre solo una parte del consumo.</Info>}
                        <div style={{ marginTop: 12 }}>
                            <TejadoSVG t={t} fit={c.fit} n={c.n} panel={c.panel} />
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 8 }}><span style={{ color: '#f59e0b' }}>■</span> Producción &nbsp; <span style={{ color: '#64748b' }}>■</span> Consumo (kWh cada mes)</div>
                            <BarrasMes prod={c.prodMes} cons={c.consMes} />
                        </div>
                        <Info>Muchas veces no compensa cubrir el 100 %: en verano sobra energía y la que vendes a la red se paga mucho más barata que la que compras.</Info>
                    </>
                ) : <div style={{ color: C.rojo }}>Con este panel y esta colocación no cabe una instalación mínima. Vuelve a la fase 3 y cambia de panel o de colocación.</div>}
            </div>
            <Preguntas qs={despues} resp={resp} setResp={setResp} desde={antes.length + 1} titulo="✏️ Tu instalación" />
        </>
    );
}

function Fase5({ c, qs, resp, setResp, setDec }) {
    if (!c.cabe) return <div style={card}>Primero diseña una instalación que quepa (fase 3).</div>;
    const p = c.p;
    const antes = qs.filter(q => /^f5\.(auto|exc|red|ah)\./.test(q.id));
    const despues = qs.filter(q => !/^f5\.(auto|exc|red|ah)\./.test(q.id));
    return (
        <>
            <div style={card}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>🔌 ¿A dónde va la energía?</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 10, fontSize: '0.88rem' }}>
                    <div style={{ background: C.solClaro, borderRadius: 12, padding: 12 }}><b>☀️ Autoconsumo directo</b><br />Lo que la casa gasta <i>mientras</i> hay sol. Ahorra el precio completo: <b>{fmt(p.precio, 3)} €/kWh</b>.</div>
                    <div style={{ background: '#ecfdf5', borderRadius: 12, padding: 12 }}><b>↗️ Excedentes</b><br />Lo que sobra y va a la red. La compañía lo compensa a <b>{fmt(p.comp, 3)} €/kWh</b>.</div>
                    <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 12 }}><b>↘️ Red</b><br />Por la noche o con nubes, la casa sigue comprando energía a la red.</div>
                </div>
                <Info>Esta familia: <b>{PERFILES[p.perfil].nombre}</b>. Por eso estimamos que se consume en directo el <b>{fmt(c.f * 100, 0)} %</b> de lo que se produce (y nunca más del {fmt(AUTO_MAX * 100, 0)} % de su consumo, que es la parte que gasta con sol).</Info>
            </div>
            <Preguntas qs={antes} resp={resp} setResp={setResp} />
            <div style={{ ...card, marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>🔋 La batería</h3>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>Guarda parte de los excedentes del día para usarlos por la noche. Cada kWh que pasa por la batería ahorra <b>precio − compensación</b> (lo que dejas de comprar menos lo que dejas de cobrar). Se puede usar el {fmt(DOD * 100, 0)} % de su capacidad y hace unos {CICLOS} ciclos de carga al año.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                    <b style={{ fontSize: '0.88rem' }}>Estudia la batería de:</b>
                    {BATERIAS.map(b => <button key={b.kwh} onClick={() => setDec({ bateriaEval: b.kwh })} style={btn(c.batEval === b.kwh ? C.sol : '#f1f5f9', c.batEval === b.kwh ? 'white' : C.texto)}>{b.kwh} kWh</button>)}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <Dato k={`Precio de la batería de ${c.batEval} kWh para el cliente`} v={eur(c.precioBatCliente)} />
                </div>
                <div style={{ fontSize: '0.78rem', color: C.gris, marginTop: 4 }}>Incluye la batería, las 2 h extra del electricista, tu beneficio ({c.margen} %) y el IVA. Si cambias el beneficio en la fase 6, cambia este precio.</div>
            </div>
            <Preguntas qs={despues} resp={resp} setResp={setResp} desde={antes.length + 1} titulo="✏️ ¿Compensa la batería?" />
            <div style={{ ...card, marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>✅ Tu decisión para el presupuesto</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[0, ...BATERIAS.map(b => b.kwh)].map(k => <button key={k} onClick={() => setDec({ bateria: k })} style={btn(c.bateria === k ? C.verde : '#f1f5f9', c.bateria === k ? 'white' : C.texto)}>{k ? `Con batería de ${k} kWh` : 'Sin batería'}</button>)}
                </div>
            </div>
        </>
    );
}

function Fase6({ c, qs, resp, setResp, setDec }) {
    if (!c.cabe) return <div style={card}>Primero diseña una instalación que quepa (fase 3).</div>;
    const pr = c.presu, p = c.p;
    const hechoId = pre => { const q = qs.find(x => x.id.startsWith(pre)); const r = q && resp[q.id]; return r && (r.estado === 'ok' || r.estado === 'revelado'); };
    const totalVisto = hechoId('f6.tot.');
    return (
        <>
            <div style={card}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>👥 Los profesionales de tu empresa</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10 }}>
                    {pr.manoObra.map(l => (
                        <div key={l.id} style={{ border: `1px solid ${C.borde}`, borderRadius: 12, padding: 12 }}>
                            <div style={{ fontWeight: 800 }}>{l.emoji} {l.nombre}</div>
                            <div style={{ fontSize: '0.8rem', color: C.gris, margin: '4px 0' }}>{l.tarea}</div>
                            <div style={{ fontSize: '0.88rem' }}><b>{fmt(l.horas, 1)} h</b> × <b>{l.eurH} €/h</b></div>
                        </div>
                    ))}
                </div>
                <Info>Horas de montaje de cada persona del equipo: <b>4 h + 0,5 h por panel</b> (redondeando a la media hora). El electricista necesita 4 h, y 2 h más si hay batería. El ingeniero, 8 h de memoria técnica (16 h si la instalación pasa de 10 kWp).</Info>
            </div>
            <div style={{ ...card, marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>🔌 Elige el inversor</h3>
                <div style={{ fontSize: '0.88rem' }}>El inversor convierte la corriente continua de los paneles en alterna para la casa. Su potencia debe estar entre el <b>80 % y el 110 %</b> de la potencia pico ({fmt(c.kWp, 2)} kWp).</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {INVERSORES.map(i => {
                        const act = c.inversorKw === i.kw, ok = c.invValidos.some(v => v.kw === i.kw);
                        return <button key={i.kw} onClick={() => setDec({ inversorKw: i.kw })} style={{ ...btn(act ? (ok ? C.verde : C.rojo) : '#f1f5f9', act ? 'white' : C.texto), padding: '7px 10px' }}>{fmt(i.kw, 1)} kW · {eur(i.precio, 0)}</button>;
                    })}
                </div>
                {c.inversorKw == null && <div style={{ color: C.sol, fontSize: '0.85rem', marginTop: 8 }}>Elige uno para completar el presupuesto.</div>}
                {c.inversorKw != null && (c.invOk
                    ? <div style={{ color: C.verde, fontSize: '0.85rem', marginTop: 8 }}>✅ Buena elección: está entre {fmt(0.8 * c.kWp, 2)} y {fmt(1.1 * c.kWp, 2)} kW.</div>
                    : <div style={{ color: C.rojo, fontSize: '0.85rem', marginTop: 8 }}>✗ No sirve: tiene que estar entre {fmt(0.8 * c.kWp, 2)} y {fmt(1.1 * c.kWp, 2)} kW.</div>)}
            </div>
            <div style={{ ...card, marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>🧾 Hoja de presupuesto</h3>
                <label style={{ fontSize: '0.88rem' }}>Beneficio de tu empresa: <b>{c.margen} %</b> sobre el coste
                    <input type="range" min="0" max="40" value={c.margen} onChange={e => setDec({ margen: +e.target.value })} style={{ width: '100%' }} />
                </label>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480, marginTop: 6 }}>
                        <thead><tr><th style={th}>Materiales</th><th style={{ ...th, textAlign: 'right' }}>Cant.</th><th style={{ ...th, textAlign: 'right' }}>Precio</th><th style={{ ...th, textAlign: 'right' }}>Importe</th></tr></thead>
                        <tbody>
                            {pr.materiales.map(l => <tr key={l.id}><td style={td}>{l.concepto}</td><td style={tdNum}>{l.cant}</td><td style={tdNum}>{eur(l.precio)}</td><td style={tdNum}>{eur(l.importe)}</td></tr>)}
                            <tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total materiales</td><td style={{ ...tdNum, fontWeight: 700 }}>{hechoId('f6.mat.') ? eur(pr.mat) : '¿?'}</td></tr>
                        </tbody>
                        <thead><tr><th style={th}>Mano de obra</th><th style={{ ...th, textAlign: 'right' }}>Horas</th><th style={{ ...th, textAlign: 'right' }}>€/h</th><th style={{ ...th, textAlign: 'right' }}>Importe</th></tr></thead>
                        <tbody>
                            {pr.manoObra.map(l => <tr key={l.id}><td style={td}>{l.emoji} {l.nombre}</td><td style={tdNum}>{fmt(l.horas, 1)}</td><td style={tdNum}>{eur(l.eurH)}</td><td style={tdNum}>{hechoId(`f6.${l.id}.`) ? eur(l.importe) : '¿?'}</td></tr>)}
                            <tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total mano de obra</td><td style={{ ...tdNum, fontWeight: 700 }}>{hechoId('f6.mo.') ? eur(pr.mo) : '¿?'}</td></tr>
                            <tr><td style={td} colSpan={3}>Beneficio ({c.margen} %)</td><td style={tdNum}>{hechoId('f6.ben.') ? eur(pr.beneficio) : '¿?'}</td></tr>
                            <tr><td style={td} colSpan={3}>IVA ({IVA} %)</td><td style={tdNum}>{hechoId('f6.iva.') ? eur(pr.iva) : '¿?'}</td></tr>
                            <tr><td style={{ ...td, fontWeight: 800 }} colSpan={3}>PRECIO FINAL</td><td style={{ ...tdNum, fontWeight: 800 }}>{totalVisto ? eur(pr.total) : '¿?'}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 10 }}>
                    <Dato k="Presupuesto máximo del cliente" v={eur(p.presupuestoMax, 0)} />
                </div>
                {totalVisto && (pr.total <= p.presupuestoMax
                    ? <Info color={C.verde} bg="#f0fdf4">✅ Tu precio entra en lo que quiere gastar el cliente (te sobran {eur(p.presupuestoMax - pr.total)}).</Info>
                    : <Info color={C.rojo} bg="#fef2f2">❌ Te pasas en <b>{eur(pr.total - p.presupuestoMax)}</b>. Ajusta: baja tu beneficio, usa menos paneles (fase 4), otro panel (fase 3) o quita la batería (fase 5).</Info>)}
                {c.margenMax != null && c.margenMax < 0 && <Info color={C.rojo} bg="#fef2f2">Ni con un 0 % de beneficio entras en el presupuesto: tienes que cambiar el diseño.</Info>}
            </div>
            <Preguntas qs={qs} resp={resp} setResp={setResp} titulo="✏️ Calcula el presupuesto" />
        </>
    );
}

function Fase7({ c, qs, resp, setResp }) {
    if (!c.cabe) return <div style={card}>Primero diseña una instalación que quepa (fase 3).</div>;
    const visto = qs.some(q => q.id.startsWith('f7.simple.') && ['ok', 'revelado'].includes(resp[q.id]?.estado));
    return (
        <>
            <div style={card}>
                <h3 style={{ margin: '0 0 8px', color: C.sol }}>⏳ ¿Cuándo recupera el dinero el cliente?</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Dato k="Precio final" v={eur(c.presu.total)} />
                    <Dato k="Ayuda del ayuntamiento" v={eur(c.p.ayuda || 0, 0)} />
                    <Dato k="Ahorro el primer año" v={eur(c.en.ahorro)} />
                    <Dato k="Batería" v={c.bateria ? `${c.bateria} kWh` : 'No'} />
                </div>
                <Info>Cada año los paneles producen un <b>{fmt(DEGRADACION * 100, 1)} % menos</b>, pero la luz suele subir (suponemos un <b>{fmt(SUBIDA_LUZ * 100, 0)} %</b> al año). Así que el ahorro de cada año es el del anterior × <b>q = {fmt(1 - DEGRADACION, 3)} × {fmt(1 + SUBIDA_LUZ, 2)} = {fmt(c.am.q, 4)}</b>: es una <b>progresión geométrica</b>.</Info>
                <div style={{ marginTop: 12 }}><CurvaAmort serie={c.am.serie} /></div>
                <div style={{ fontSize: '0.8rem', color: C.gris, textAlign: 'center' }}>Dinero acumulado del cliente (empieza en negativo por la inversión). Puntos rojos: aún no ha recuperado; verdes: ya gana.</div>
            </div>
            <Preguntas qs={qs} resp={resp} setResp={setResp} />
            {visto && (
                <div style={{ ...card, marginTop: 14 }}>
                    <h3 style={{ margin: '0 0 8px', color: C.sol }}>⚖️ Comparación</h3>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead><tr><th style={th}></th><th style={{ ...th, textAlign: 'right' }}>Sin batería</th><th style={{ ...th, textAlign: 'right' }}>Con batería de {c.batEval} kWh</th></tr></thead>
                        <tbody>
                            <tr><td style={td}>Inversión</td><td style={tdNum}>{eur(c.amSin.serie[0] * -1)}</td><td style={tdNum}>{eur(c.amCon.serie[0] * -1)}</td></tr>
                            <tr><td style={td}>Años (sin subidas)</td><td style={tdNum}>{fmt(c.amSin.simple, 1)}</td><td style={tdNum}>{fmt(c.amCon.simple, 1)}</td></tr>
                            <tr><td style={td}>Beneficio en {VIDA} años</td><td style={tdNum}>{eur(c.amSin.neto, 0)}</td><td style={tdNum}>{eur(c.amCon.neto, 0)}</td></tr>
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

function Fase8({ c, qs, resp, setResp, setDec }) {
    const sel = c.sel;
    const toggle = id => setDec({ medidas: sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id] });
    return (
        <>
            <div style={card}>
                <h3 style={{ margin: '0 0 6px', color: C.sol }}>🌿 Primero, gastar menos</h3>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>La energía más barata y limpia es la que no se gasta. Una buena empresa solar también aconseja cómo <b>reducir el consumo</b>. Marca las medidas que propondrías a {c.p.cliente}:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {c.medidasAplic.map(m => {
                        const act = sel.includes(m.id);
                        return (
                            <label key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: act ? `2px solid ${C.verde}` : `1.5px solid ${C.borde}`, background: act ? '#f0fdf4' : 'white', borderRadius: 12, padding: '8px 12px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={act} onChange={() => toggle(m.id)} style={{ width: 18, height: 18, accentColor: C.verde }} />
                                <span style={{ fontSize: '1.3rem' }}>{m.emoji}</span>
                                <span style={{ flex: 1, fontSize: '0.9rem' }}>{m.nombre}</span>
                                <span style={{ fontSize: '0.82rem', color: C.gris, whiteSpace: 'nowrap', textAlign: 'right' }}>{m.coste ? eur(m.coste, 0) : 'Gratis'}<br />{m.kwh ? `−${m.kwh} kWh/año` : '+10 puntos de autoconsumo'}</span>
                            </label>
                        );
                    })}
                </div>
                {c.selM.some(m => m.autoExtra) && <Info color={C.verde} bg="#f0fdf4">⏰ Al poner electrodomésticos con sol, el autoconsumo directo sube del {fmt(c.f * 100, 0)} % al {fmt((c.f + 0.1) * 100, 0)} %. Con tus medidas, las placas ahorrarían <b>{eur(c.enEfic.ahorro)}</b> al año (frente a {eur(c.en.ahorro)}).</Info>}
                {c.kwhAh > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <Dato k="Consumo antes" v={`${fmt(c.p.consumo, 0)} kWh`} />
                    <Dato k="Consumo después" v={`${fmt(c.consumoNuevo, 0)} kWh`} />
                    <Dato k="Coste de las medidas" v={eur(c.costeMedidas, 0)} />
                </div>}
            </div>
            <Preguntas qs={qs} resp={resp} setResp={setResp} />
            <Info>Factor de emisión usado: <b>{fmt(CO2_KWH, 1)} kg de CO₂ por kWh</b> de la red (valor aproximado; cambia cada año según cuánta energía renovable hay).</Info>
        </>
    );
}

function Propuesta({ c, empresa, refDoc }) {
    const p = c.p, pr = c.presu, color = empresa.color || C.sol;
    const filas = [
        ['Paneles', `${c.n} × ${c.panel.nombre} (${c.orient === 'H' ? 'tumbados' : 'en vertical'})`],
        ['Potencia pico', `${fmt(c.kWp, 2)} kWp`],
        ['Inversor', `${fmt(pr.inv.kw, 1)} kW`],
        ['Batería', c.bateria ? `${c.bateria} kWh` : 'No'],
        ['Producción estimada', `${fmt(c.prodAnual, 0)} kWh/año (${fmt(c.prodAnual / p.consumo * 100, 0)} % del consumo)`],
        ['Ahorro el primer año', eur(c.en.ahorro)],
        ['Recuperación de la inversión', Number.isFinite(c.am.simple) ? `${fmt(c.am.simple, 1)} años` : '—'],
        [`Beneficio en ${VIDA} años`, eur(c.am.neto, 0)],
        ['CO₂ evitado', `${fmt(c.prodAnual * CO2_KWH / 1000, 2)} t al año`],
    ];
    return (
        <div ref={refDoc} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.borde}`, maxWidth: 820, margin: '0 auto', color: C.texto }}>
            <div style={{ background: color, color: 'white', padding: '18px 22px', display: 'flex', gap: 16, alignItems: 'center' }}>
                <Logo empresa={empresa} size={78} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{empresa.nombre || 'Mi empresa solar'}</div>
                    {empresa.eslogan && <div style={{ opacity: 0.92, fontStyle: 'italic' }}>{empresa.eslogan}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', opacity: 0.92 }}>Propuesta nº {p.codigo}<br />{new Date().toLocaleDateString('es-ES')}</div>
            </div>
            <div style={{ padding: '18px 22px' }}>
                <div style={{ fontSize: '0.92rem', marginBottom: 12 }}>Para: <b>{p.cliente}</b> · {c.ciudad.nombre} · tejado de {fmt(p.tejado.largo, 1)} × {fmt(p.tejado.ancho, 1)} m orientado al {nombreOrient(p.tejado.azim).toLowerCase()} ({p.tejado.incl}°) · consumo {fmt(p.consumo, 0)} kWh/año</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
                    <div>
                        <h4 style={{ margin: '0 0 6px', color }}>Instalación propuesta</h4>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
                            {filas.map(([k, v]) => <tr key={k}><td style={{ ...td, color: C.gris }}>{k}</td><td style={{ ...td, fontWeight: 700 }}>{v}</td></tr>)}
                        </tbody></table>
                    </div>
                    <div>
                        <TejadoSVG t={p.tejado} fit={c.fit} n={c.n} panel={c.panel} />
                        <BarrasMes prod={c.prodMes} cons={c.consMes} />
                        <div style={{ fontSize: '0.75rem', color: C.gris, textAlign: 'center' }}>■ naranja: producción · ■ gris: consumo</div>
                    </div>
                </div>
                <h4 style={{ margin: '14px 0 6px', color }}>Presupuesto</h4>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
                    {pr.materiales.map(l => <tr key={l.id}><td style={td}>{l.concepto}{l.cant > 1 ? ` (×${l.cant})` : ''}</td><td style={tdNum}>{eur(l.importe)}</td></tr>)}
                    <tr><td style={td}>Mano de obra (montaje, electricista e ingeniería)</td><td style={tdNum}>{eur(pr.mo)}</td></tr>
                    <tr><td style={td}>Gastos generales y beneficio</td><td style={tdNum}>{eur(pr.beneficio)}</td></tr>
                    <tr><td style={td}>Base imponible</td><td style={tdNum}>{eur(pr.base)}</td></tr>
                    <tr><td style={td}>IVA ({IVA} %)</td><td style={tdNum}>{eur(pr.iva)}</td></tr>
                    <tr><td style={{ ...td, fontWeight: 800, fontSize: '1rem' }}>TOTAL</td><td style={{ ...tdNum, fontWeight: 800, fontSize: '1rem' }}>{eur(pr.total)}</td></tr>
                    {p.ayuda > 0 && <tr><td style={td}>Ayuda del ayuntamiento</td><td style={tdNum}>−{eur(p.ayuda)}</td></tr>}
                </tbody></table>
                {c.selM.length > 0 && <>
                    <h4 style={{ margin: '14px 0 6px', color }}>Recomendaciones de eficiencia</h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.9rem' }}>
                        {c.selM.map(m => <li key={m.id}>{m.emoji} {m.nombre}{m.kwh ? ` (−${m.kwh} kWh/año)` : ''}</li>)}
                    </ul>
                    {c.kwhAh > 0 && <div style={{ fontSize: '0.88rem', marginTop: 6 }}>Ahorro total: <b>{fmt(c.kwhAh, 0)} kWh/año</b> ({eur(c.kwhAh * p.precio)}), {fmt(c.kwhAh * CO2_KWH, 0)} kg de CO₂ menos.</div>}
                </>}
                <div style={{ fontSize: '0.75rem', color: C.gris, marginTop: 14, borderTop: `1px solid ${C.borde}`, paddingTop: 8 }}>Presupuesto válido 30 días. Estimaciones con datos de sol aproximados; la producción real depende del tiempo, las sombras y el uso. Trabajo escolar realizado en Pikt.</div>
            </div>
        </div>
    );
}

// ─── Modal enviar al profesor ─────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        const vn = validarNombre(nombre); if (!vn.ok) { setError(vn.mensaje); return; }
        if (datos.empresa && !validarNombre(datos.empresa).ok) { setError('Cambia el nombre de la empresa (fase 1): ' + validarNombre(datos.empresa).mensaje); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'EMPRESA_SOLAR', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), ...datos }],
            });
            guardarRegistroLocal('EMPRESA_SOLAR', { titulo: datos.empresa || 'Mi empresa solar', aciertos: datos.aciertos, intentos: datos.intentos, porcentaje: datos.porcentaje, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 10050, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div style={{ ...card, width: '100%', maxWidth: 380 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, color: C.sol }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gris, fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: C.verde, fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: C.gris, fontSize: '0.88rem', marginTop: 6 }}>{datos.aciertos}/{datos.intentos} cálculos correctos sin ver la solución</div>
                        <button onClick={onClose} style={{ ...btn('#e2e8f0', C.texto), marginTop: 14 }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: '0.84rem', color: C.gris }}>Se envía tu progreso, el resumen de la propuesta y el logo. Puedes enviarlo otra vez cuando avances.</div>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido (o el equipo)" style={inp} />
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Curso (ej.: 4.º ESO B)" style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                        {error && <div style={{ color: C.rojo, fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9 }}>
                            <button onClick={onClose} style={{ ...btn('#e2e8f0', C.texto), flex: 1 }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ ...btn(enviando ? '#94a3b8' : C.sol), flex: 2 }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function GuiaProfesor() {
    return (
        <details style={{ ...card, marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, color: C.sol }}>👩‍🏫 Guía para el profesor</summary>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.6, marginTop: 10 }}>
                <p style={{ margin: '0 0 8px' }}><b>Para quién:</b> 3.º y 4.º de ESO (Matemáticas, Tecnología y Digitalización, Economía y Emprendimiento), 1.º de Bachillerato y FP de electricidad o energías renovables.</p>
                <p style={{ margin: '0 0 8px' }}><b>Duración:</b> 8–10 sesiones, más o menos una por fase. La última, para presentar las propuestas a la clase.</p>
                <p style={{ margin: '0 0 8px' }}><b>Reto:</b> «Somos una empresa instaladora y un cliente nos pide presupuesto. ¿Qué instalación le proponemos, cuánto le cobramos y cuándo recupera su dinero?»</p>
                <p style={{ margin: '0 0 4px' }}><b>Qué se trabaja:</b></p>
                <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
                    <li><b>Matemáticas:</b> áreas, parte entera, proporcionalidad, porcentajes, potencias, progresión geométrica, lectura de gráficas, optimización con restricciones (el presupuesto del cliente).</li>
                    <li><b>Física y Tecnología:</b> potencia y energía (kW y kWh), radiación solar, latitud, orientación e inclinación, rendimiento, inversor y batería.</li>
                    <li><b>Economía:</b> marca e imagen, costes de materiales y mano de obra, beneficio, IVA, rentabilidad y amortización.</li>
                    <li><b>Sostenibilidad:</b> eficiencia energética y CO₂ evitado (ODS 7 y 13).</li>
                </ul>
                <p style={{ margin: '0 0 8px' }}><b>En equipos:</b> cada equipo es una empresa (gerente, diseño, técnica y cuentas). Dad a toda la clase <b>el mismo código de pedido</b> y al final comparad las ofertas: ¿cuál elegiría el cliente y por qué? Se puede votar la mejor propuesta.</p>
                <p style={{ margin: '0 0 8px' }}><b>Evaluación:</b> el alumno envía el informe con su código de profesor (aparece en Informes con el logo, los cálculos correctos de cada fase y el resumen) e imprime la propuesta como producto final.</p>
                <p style={{ margin: 0, color: C.gris }}><b>Simplificaciones:</b> HSP aproximadas (PVGIS), pérdidas con la fórmula del IDAE, autoconsumo estimado según la forma de vida de la familia, compensación de excedentes sin el tope mensual de la factura, precios orientativos de 2026 y ayuda municipal ficticia.</p>
            </div>
        </details>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EmpresaSolar({ onBack }) {
    const [partida, setPartida] = useState(leerLS);
    const [vista, setVista] = useState('inicio'); // inicio | menu | fase
    const [fase, setFase] = useState(1);
    const [envio, setEnvio] = useState(false);
    const [codigoIn, setCodigoIn] = useState(() => { try { return (new URLSearchParams(window.location.search).get('pedido') || '').toUpperCase(); } catch { return ''; } });
    const [errorCodigo, setErrorCodigo] = useState('');
    const [confirmarNueva, setConfirmarNueva] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const refDoc = useRef(null);

    useEffect(() => { try { if (partida) localStorage.setItem(LS_KEY, JSON.stringify(partida)); } catch { /* sin almacenamiento o logo demasiado grande */ } }, [partida]);
    useEffect(() => { window.scrollTo?.(0, 0); document.querySelector('[data-empresa-solar]')?.parentElement?.scrollTo?.(0, 0); }, [vista, fase]);

    const pedido = useMemo(() => (partida ? generarPedido(partida.seed) : null), [partida?.seed]);
    const c = useMemo(() => (pedido ? calcular(pedido, partida.dec || {}) : null), [pedido, partida?.dec]);
    const qsFase = useMemo(() => {
        const o = {};
        if (c) for (let f = 2; f <= 8; f++) o[f] = preguntasFase(f, c);
        return o;
    }, [c]);
    const resp = partida?.resp || {};
    const empresa = partida?.empresa || {};

    const setDec = cambios => setPartida(p => ({ ...p, dec: { ...(p.dec || {}), ...cambios } }));
    const setEmpresa = cambios => setPartida(p => ({ ...p, empresa: { ...(p.empresa || {}), ...cambios } }));
    const setResp = (id, cambios) => setPartida(p => ({ ...p, resp: { ...(p.resp || {}), [id]: { ...((p.resp || {})[id] || {}), ...cambios } } }));

    const estadoFase = f => {
        if (f === 1) { const ok = (empresa.nombre ? 1 : 0) + (empresa.logo ? 1 : 0); return { ok, hechas: ok, total: 2 }; }
        const qs = qsFase[f] || [];
        return { ok: qs.filter(q => resp[q.id]?.estado === 'ok').length, hechas: qs.filter(q => ['ok', 'revelado'].includes(resp[q.id]?.estado)).length, total: qs.length };
    };

    const empezar = (seed) => {
        setPartida({ seed, empresa: partida?.empresa || { color: '#f59e0b' }, dec: {}, resp: {} });
        setConfirmarNueva(false); setFase(1); setVista('fase');
    };
    const empezarCodigo = () => {
        const s = codigoASemilla(codigoIn);
        if (!s) { setErrorCodigo('Código no válido: usa letras y números (p. ej. 3F9K2A).'); return; }
        setErrorCodigo(''); empezar(s);
    };

    const enlace = () => `${window.location.origin}/?juego=empresasolar${partida ? `&pedido=${pedido.codigo}` : ''}`;
    const copiarEnlace = async () => { try { await navigator.clipboard.writeText(enlace()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ } };

    const datosInforme = () => {
        const fases = FASES.filter(f => f.n <= 8).map(f => ({ n: f.n, titulo: f.titulo, ...estadoFase(f.n) }));
        const num = fases.filter(f => f.n >= 2);
        const aciertos = num.reduce((s, f) => s + f.ok, 0), intentos = num.reduce((s, f) => s + f.total, 0);
        const revelados = Object.values(resp).filter(r => r.estado === 'revelado').length;
        const totalVisto = (qsFase[6] || []).some(q => q.id.startsWith('f6.tot.') && ['ok', 'revelado'].includes(resp[q.id]?.estado));
        return {
            aciertos, intentos, porcentaje: Math.round(aciertos / Math.max(1, intentos) * 100), revelados,
            empresa: (empresa.nombre || '').trim(), eslogan: (empresa.eslogan || '').trim(), idea: (empresa.idea || '').trim(), color: empresa.color || null,
            logo: empresa.logo && empresa.logo.length < 250000 ? empresa.logo : null,
            pedido: pedido.codigo, cliente: pedido.cliente, ciudad: c.ciudad.nombre,
            resumen: {
                panel: c.panel.nombre, paneles: c.n, kWp: +c.kWp.toFixed(2), inversorKw: c.inversorKw, inversorOk: c.invOk, bateria: c.bateria,
                produccion: Math.round(c.prodAnual), consumo: pedido.consumo, margen: c.margen,
                total: totalVisto ? +c.presu.total.toFixed(2) : null, presupuestoMax: pedido.presupuestoMax,
                ahorro: +c.en.ahorro.toFixed(2), amortizacion: Number.isFinite(c.am.simple) ? +c.am.simple.toFixed(1) : null,
                medidas: c.sel, kwhAhorrados: c.kwhAh,
            },
            fases,
        };
    };

    const contenedor = { minHeight: '100%', background: C.fondo, fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.texto };
    const ancho = { maxWidth: 1100, margin: '0 auto', padding: '18px 16px 50px' };
    const modalEnvio = envio && c && <ModalEnviarProfe onClose={() => setEnvio(false)} datos={datosInforme()} />;

    // ── Inicio ──
    if (vista === 'inicio' || !partida) return (
        <div data-empresa-solar style={contenedor}><div style={ancho}>
            <button onClick={onBack} style={btn('#e2e8f0', C.texto)}>← Volver</button>
            <div style={{ textAlign: 'center', margin: '10px 0 22px' }}>
                <div style={{ fontSize: 64 }}>☀️🏠</div>
                <h1 style={{ margin: '6px 0', color: C.sol, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>Mi empresa de placas solares</h1>
                <p style={{ color: C.gris, maxWidth: 680, margin: '0 auto', lineHeight: 1.5 }}>Funda tu empresa instaladora, diseña su logo y prepara la propuesta para un cliente de verdad: cuántos paneles caben en su tejado, cuánto producen según el sol, si le conviene una batería, cuánto cobras (y cuánto pagas a cada profesional) y en cuántos años recupera su dinero.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 18 }}>
                {FASES.map(f => <span key={f.n} style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 20, padding: '4px 10px', fontSize: '0.82rem' }}>{f.emoji} {f.titulo}</span>)}
            </div>
            {partida && (
                <div style={{ ...card, marginBottom: 14, border: `2px solid ${C.sol}`, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Logo empresa={empresa} size={60} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 800 }}>{empresa.nombre || 'Tu empresa'}</div>
                        <div style={{ fontSize: '0.85rem', color: C.gris }}>Pedido {pedido.codigo} · {pedido.cliente} ({c.ciudad.nombre})</div>
                    </div>
                    <button onClick={() => setVista('menu')} style={btn(C.sol)}>▶ Continuar</button>
                </div>
            )}
            <div style={card}>
                <h3 style={{ margin: '0 0 10px', color: C.sol }}>{partida ? '🆕 Empezar con otro pedido' : '🚀 Empezar'}</h3>
                {partida && confirmarNueva && <Info color={C.rojo} bg="#fef2f2">Se borrará el progreso del pedido actual (se conservan el nombre, el eslogan y el logo de tu empresa). Pulsa otra vez para confirmar.</Info>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 14, marginTop: 10 }}>
                    <div>
                        <div style={{ fontSize: '0.88rem', color: C.gris, marginBottom: 6 }}>Un cliente al azar:</div>
                        <button onClick={() => (partida && !confirmarNueva ? setConfirmarNueva(true) : empezar(semillaNueva()))} style={btn(C.sol)}>🎲 Pedido al azar</button>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.88rem', color: C.gris, marginBottom: 6 }}>El pedido de tu clase (mismo cliente para todos):</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input value={codigoIn} onChange={e => setCodigoIn(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))} maxLength={7} placeholder="Código de pedido" style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                            <button onClick={() => (partida && !confirmarNueva ? setConfirmarNueva(true) : empezarCodigo())} style={btn(C.azul)}>Usar</button>
                        </div>
                        {errorCodigo && <div style={{ color: C.rojo, fontSize: '0.8rem', marginTop: 4 }}>⚠ {errorCodigo}</div>}
                    </div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={copiarEnlace} style={btn('#f1f5f9', C.texto)}>🔗 {copiado ? '¡Enlace copiado!' : partida ? `Copiar enlace con el pedido ${pedido.codigo}` : 'Copiar enlace'}</button>
                    <span style={{ fontSize: '0.8rem', color: C.gris }}>Para que toda la clase tenga el mismo cliente, comparte el enlace con el código de pedido.</span>
                </div>
            </div>
            <GuiaProfesor />
        </div></div>
    );

    const est = FASES.map(f => ({ ...f, ...estadoFase(f.n) }));
    const ResumenPedido = () => {
        const p = pedido, t = p.tejado;
        return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, fontSize: '0.8rem' }}>
                {[`👤 ${p.cliente}`, `📍 ${c.ciudad.nombre}`, `🏠 ${fmt(t.largo, 1)} × ${fmt(t.ancho, 1)} m · ${t.incl}° · ${nombreOrient(t.azim)}`, `⚡ ${fmt(p.consumo, 0)} kWh/año`, `💶 ${fmt(p.precio, 3)} €/kWh`, `🎯 máx. ${eur(p.presupuestoMax, 0)}`]
                    .map(x => <span key={x} style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 20, padding: '3px 10px' }}>{x}</span>)}
            </div>
        );
    };

    // ── Menú de fases ──
    if (vista === 'menu') return (
        <div data-empresa-solar style={contenedor}><div style={ancho}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <button onClick={() => setVista('inicio')} style={btn('#e2e8f0', C.texto)}>← Inicio</button>
                <Logo empresa={empresa} size={44} />
                <h2 style={{ margin: 0, color: C.sol, flex: 1, minWidth: 180 }}>{empresa.nombre || 'Mi empresa solar'}</h2>
                <button onClick={() => setEnvio(true)} style={btn('linear-gradient(135deg,#f59e0b,#ea580c)')}>📤 Enviar al profesor</button>
            </div>
            <ResumenPedido />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: 14 }}>
                {est.map(f => {
                    const completa = f.total > 0 && f.hechas === f.total;
                    return (
                        <button key={f.n} onClick={() => { setFase(f.n); setVista('fase'); }} style={{ ...card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: completa ? `2px solid ${C.verde}` : `1px solid ${C.borde}` }}>
                            <div style={{ fontSize: 34 }}>{f.emoji}</div>
                            <div style={{ fontWeight: 800, marginTop: 4 }}>{f.n}. {f.titulo}</div>
                            <div style={{ fontSize: '0.84rem', color: C.gris }}>{f.sub}</div>
                            {f.total > 0 && <div style={{ marginTop: 8 }}>
                                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${f.hechas / f.total * 100}%`, height: '100%', background: completa ? C.verde : C.sol }} /></div>
                                <div style={{ fontSize: '0.75rem', color: C.gris, marginTop: 3 }}>{f.n === 1 ? `${f.ok}/2 (nombre y logo)` : `✓ ${f.ok} de ${f.total} · ${f.hechas} hechas`}</div>
                            </div>}
                        </button>
                    );
                })}
            </div>
        </div>{modalEnvio}</div>
    );

    // ── Fase ──
    const F = FASES.find(f => f.n === fase);
    const props = { c, qs: qsFase[fase] || [], resp, setResp, setDec, empresa };
    const faltan = [
        !empresa.nombre && 'el nombre de la empresa (fase 1)',
        !empresa.logo && 'el logo (fase 1)',
        !c.invOk && 'un inversor válido (fase 6)',
        !(qsFase[6] || []).some(q => q.id.startsWith('f6.tot.') && ['ok', 'revelado'].includes(resp[q.id]?.estado)) && 'calcular el precio final (fase 6)',
    ].filter(Boolean);
    const guardarRegistro = () => {
        const d = datosInforme();
        guardarRegistroLocal('EMPRESA_SOLAR', { titulo: d.empresa || 'Mi empresa solar', aciertos: d.aciertos, intentos: d.intentos, porcentaje: d.porcentaje, via: 'local' });
        setGuardado(true); setTimeout(() => setGuardado(false), 2500);
    };
    return (
        <div data-empresa-solar style={contenedor}><div style={ancho}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <button onClick={() => setVista('menu')} style={btn('#e2e8f0', C.texto)}>← Fases</button>
                <h2 style={{ margin: 0, color: C.sol, fontSize: '1.3rem', flex: 1, minWidth: 200 }}>{F.emoji} {F.n}. {F.titulo}</h2>
                <button onClick={() => setEnvio(true)} style={btn('linear-gradient(135deg,#f59e0b,#ea580c)')}>📤</button>
            </div>
            {fase > 1 && <ResumenPedido />}
            {fase === 1 && <Fase1 empresa={empresa} setEmpresa={setEmpresa} />}
            {fase === 2 && <Fase2 {...props} />}
            {fase === 3 && <Fase3 {...props} />}
            {fase === 4 && <Fase4 {...props} />}
            {fase === 5 && <Fase5 {...props} />}
            {fase === 6 && <Fase6 {...props} />}
            {fase === 7 && <Fase7 {...props} />}
            {fase === 8 && <Fase8 {...props} />}
            {fase === 9 && (
                <>
                    {faltan.length > 0 && <Info color={C.sol} bg={C.solClaro}>Para que la propuesta esté completa te falta: {faltan.join(', ')}.</Info>}
                    <div style={{ marginTop: 14 }}><Propuesta c={c} empresa={empresa} refDoc={refDoc} /></div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
                        <button onClick={() => refDoc.current && imprimirElemento(refDoc.current, `Propuesta ${empresa.nombre || ''}`)} style={btn(C.azul)}>🖨️ Imprimir / PDF</button>
                        <button onClick={guardarRegistro} style={btn('#f1f5f9', C.texto)}>{guardado ? '✅ Guardado en tus registros' : '💾 Guardar en mis registros'}</button>
                        <button onClick={() => setEnvio(true)} style={btn('linear-gradient(135deg,#f59e0b,#ea580c)')}>📤 Enviar al profesor</button>
                    </div>
                    <Info>Para presentar a la clase: explica <b>por qué</b> elegiste ese panel y ese número de paneles, si pusiste batería y qué beneficio te llevas. ¿Tu oferta es mejor que la de otra empresa con el mismo pedido?</Info>
                </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 10 }}>
                {fase > 1 ? <button onClick={() => setFase(fase - 1)} style={btn('#e2e8f0', C.texto)}>← {FASES[fase - 2].titulo}</button> : <span />}
                {fase < 9 && <button onClick={() => setFase(fase + 1)} style={btn(C.sol)}>{FASES[fase].titulo} →</button>}
            </div>
        </div>{modalEnvio}</div>
    );
}
