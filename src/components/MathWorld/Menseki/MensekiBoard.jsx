// Tablero Menseki: dibuja un reto (rects + cotas) en SVG a partir de la cuadrícula
// visual (no a escala) y añade una capa <canvas> para pintar encima con el dedo
// o el lápiz de la PDI. Los trazos se guardan normalizados (0..1) para que se
// redibujen bien al cambiar el tamaño, y se borran al cambiar de reto.
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { U, PILL_H, anchoPill, geometriaReto } from './geometriaMenseki';

export const COLORES = {
    tinta: '#1f2937',
    borde: '#111827',
    relleno: '#ffffff',
    incognita: '#FEF3C7',
    incognitaBorde: '#D97706',
    acento: '#D97706',
    acierto: '#16a34a',
    aciertoSuave: '#DCFCE7',
    cota: '#475569',
};

function Cota({ d, revelado, solucion, capa = 'lineas' }) {
    const { c, x1, y1, x2, y2, ox, oy, horizontal, px, py } = d; // capa: 'lineas' | 'pastilla'
    const esIncognita = c.valor === '?';
    const txt = esIncognita && revelado ? `${solucion} cm` : d.txt;
    const w = esIncognita && revelado ? anchoPill(txt) : d.w;
    const color = esIncognita ? (revelado ? COLORES.acierto : COLORES.acento) : COLORES.cota;
    const ext = 8; // las líneas de extensión pasan un poco la línea de cota
    const ux = Math.sign(ox), uy = Math.sign(oy);
    const tope = 9; // medio tope perpendicular
    // capa 'pastilla': solo la etiqueta (se pinta después de todas las líneas)
    if (capa === 'pastilla') return (
        <g className={esIncognita && !revelado ? 'mk-pulso' : undefined} style={{ transformOrigin: `${px}px ${py}px` }}>
            <rect x={px - w / 2} y={py - PILL_H / 2} width={w} height={PILL_H} rx={PILL_H / 2}
                fill={esIncognita ? (revelado ? COLORES.aciertoSuave : COLORES.incognita) : '#ffffff'}
                stroke={color} strokeWidth={esIncognita ? 2.6 : 1.8} />
            <text x={px} y={py + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={esIncognita && !revelado ? 21 : 17} fontWeight={900} fill={esIncognita ? color : COLORES.tinta}
                style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{txt}</text>
        </g>
    );
    return (
        <g>
            {/* líneas de extensión */}
            <line x1={x1 + ux * 4} y1={y1 + uy * 4} x2={x1 + ox + ux * ext} y2={y1 + oy + uy * ext} stroke={color} strokeWidth={1.6} strokeDasharray="4 3" />
            <line x1={x2 + ux * 4} y1={y2 + uy * 4} x2={x2 + ox + ux * ext} y2={y2 + oy + uy * ext} stroke={color} strokeWidth={1.6} strokeDasharray="4 3" />
            {/* línea de cota con flechas */}
            <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} stroke={color} strokeWidth={2.4}
                markerStart={`url(#mk-flecha-${esIncognita ? (revelado ? 'ok' : 'acento') : 'normal'})`}
                markerEnd={`url(#mk-flecha-${esIncognita ? (revelado ? 'ok' : 'acento') : 'normal'})`} />
            {/* topes */}
            {horizontal ? (
                <>
                    <line x1={x1 + ox} y1={y1 + oy - tope} x2={x1 + ox} y2={y1 + oy + tope} stroke={color} strokeWidth={2.4} />
                    <line x1={x2 + ox} y1={y2 + oy - tope} x2={x2 + ox} y2={y2 + oy + tope} stroke={color} strokeWidth={2.4} />
                </>
            ) : (
                <>
                    <line x1={x1 + ox - tope} y1={y1 + oy} x2={x1 + ox + tope} y2={y1 + oy} stroke={color} strokeWidth={2.4} />
                    <line x1={x2 + ox - tope} y1={y2 + oy} x2={x2 + ox + tope} y2={y2 + oy} stroke={color} strokeWidth={2.4} />
                </>
            )}
        </g>
    );
}

function Rectangulo({ r, revelado, solucion }) {
    const x = r.x * U, y = r.y * U, w = r.w * U, h = r.h * U;
    const esIncognita = r.area === '?';
    const fill = esIncognita ? (revelado ? COLORES.aciertoSuave : COLORES.incognita) : COLORES.relleno;
    const cx = x + w / 2, cy = y + h / 2;
    const fs = Math.max(14, Math.min(28, w / 4.3, h / 2.4));
    return (
        <g>
            <rect x={x} y={y} width={w} height={h} fill={fill} />
            <text x={x + 9} y={y + 20} fontSize={15} fontWeight={800} fill="#94a3b8"
                style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{r.id}</text>
            {esIncognita && !revelado && (
                <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" className="mk-pulso"
                    style={{ transformOrigin: `${cx}px ${cy}px`, fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                    fontSize={Math.max(30, Math.min(64, Math.min(w, h) * 0.55))} fontWeight={900} fill={COLORES.acento}>?</text>
            )}
            {esIncognita && revelado && (
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={900} fill={COLORES.acierto}
                    style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{solucion} cm²</text>
            )}
            {typeof r.area === 'number' && (
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={800} fill={COLORES.tinta}
                    style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{r.area} cm²</text>
            )}
        </g>
    );
}

// ─── Capa de dibujo ──────────────────────────────────────────────────────────
const COLORES_LAPIZ = ['#2563eb', '#dc2626', '#16a34a', '#111827'];

function CapaDibujo({ herramienta, color, trazosRef, version, onTrazo }) {
    const canvasRef = useRef(null);
    const actual = useRef(null);

    const redibujar = useCallback(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        const dpr = window.devicePixelRatio || 1;
        for (const t of trazosRef.current) {
            if (!t.pts.length) continue;
            ctx.save();
            ctx.globalCompositeOperation = t.modo === 'goma' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = t.color;
            ctx.lineWidth = (t.modo === 'goma' ? 34 : 4.5) * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            t.pts.forEach(([nx, ny], i) => { const X = nx * W, Y = ny * H; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
            if (t.pts.length === 1) ctx.lineTo(t.pts[0][0] * W + 0.1, t.pts[0][1] * H);
            ctx.stroke();
            ctx.restore();
        }
    }, [trazosRef]);

    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const ajustar = () => {
            const dpr = window.devicePixelRatio || 1;
            const r = cv.getBoundingClientRect();
            cv.width = Math.max(1, Math.round(r.width * dpr));
            cv.height = Math.max(1, Math.round(r.height * dpr));
            redibujar();
        };
        ajustar();
        let ro = null;
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(ajustar); ro.observe(cv); }
        else window.addEventListener('resize', ajustar);
        return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', ajustar); };
    }, [redibujar]);

    useEffect(() => { redibujar(); }, [version, redibujar]);

    const punto = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    const down = (e) => {
        if (!herramienta) return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
        actual.current = { modo: herramienta, color, pts: [punto(e)] };
        trazosRef.current.push(actual.current);
        if (onTrazo) onTrazo();
        redibujar();
    };
    const move = (e) => {
        if (!actual.current) return;
        e.preventDefault();
        actual.current.pts.push(punto(e));
        redibujar();
    };
    const up = () => { actual.current = null; };

    return (
        <canvas ref={canvasRef}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
            style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                pointerEvents: herramienta ? 'auto' : 'none', touchAction: herramienta ? 'none' : 'auto',
                cursor: herramienta === 'goma' ? 'cell' : herramienta ? 'crosshair' : 'default',
                borderRadius: 16,
            }} />
    );
}

const btnHerr = (activo, color = '#0d9488') => ({
    border: `2px solid ${activo ? color : '#e2e8f0'}`, background: activo ? color : 'white', color: activo ? 'white' : '#334155',
    borderRadius: 12, padding: '8px 12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem',
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 42,
});

export default function MensekiBoard({ reto, revelado = false }) {
    const [herramienta, setHerramienta] = useState(null); // null | 'lapiz' | 'goma'
    const [color, setColor] = useState(COLORES_LAPIZ[0]);
    const trazosRef = useRef([]);
    const [version, setVersion] = useState(0);
    const [hayTrazos, setHayTrazos] = useState(false);

    const limpiar = useCallback(() => { trazosRef.current = []; setHayTrazos(false); setVersion(v => v + 1); }, []);
    // Al cambiar de reto se limpian los trazos.
    useEffect(() => { limpiar(); }, [reto?.id, limpiar]);

    const { vb, cotas } = useMemo(() => geometriaReto(reto), [reto]);

    if (!reto) return null;

    return (
        <div>
            {/* Barra de lápiz */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <button onClick={() => setHerramienta(h => (h === 'lapiz' ? null : 'lapiz'))} style={btnHerr(herramienta === 'lapiz')} title="Dibujar encima de la figura">✏️ Lápiz</button>
                <button onClick={() => setHerramienta(h => (h === 'goma' ? null : 'goma'))} style={btnHerr(herramienta === 'goma', '#64748b')} title="Borrar trazos con el dedo">🧽 Borrador</button>
                {herramienta === 'lapiz' && COLORES_LAPIZ.map(c => (
                    <button key={c} onClick={() => setColor(c)} aria-label="Color del lápiz"
                        style={{ width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid #0f172a' : '3px solid white', boxShadow: '0 0 0 1px #cbd5e1' }} />
                ))}
                <button onClick={limpiar} disabled={!hayTrazos} style={{ ...btnHerr(false), opacity: hayTrazos ? 1 : 0.5, cursor: hayTrazos ? 'pointer' : 'default' }}>🗑️ Borrar trazos</button>
                {herramienta && <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Pinta sobre la figura con el dedo o el lápiz</span>}
            </div>

            <div style={{
                position: 'relative', background: 'white', borderRadius: 16,
                border: herramienta ? '3px dashed #0d9488' : '3px solid #e2e8f0', transition: 'border-color .2s',
            }}>
                <svg viewBox={vb.join(' ')} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '68vh' }} role="img"
                    aria-label={`Figura del reto ${reto.titulo}`}>
                    <defs>
                        {[['normal', COLORES.cota], ['acento', COLORES.acento], ['ok', COLORES.acierto]].map(([k, col]) => (
                            <marker key={k} id={`mk-flecha-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                <path d="M0,0 L10,5 L0,10 z" fill={col} />
                            </marker>
                        ))}
                    </defs>
                    {reto.rects.map(r => <Rectangulo key={r.id} r={r} revelado={revelado} solucion={reto.solucion} />)}
                    {/* bordes encima, todos con el mismo grosor y bien nítidos */}
                    {reto.rects.map(r => (
                        <rect key={`b-${r.id}`} x={r.x * U} y={r.y * U} width={r.w * U} height={r.h * U} fill="none"
                            stroke={r.area === '?' ? (revelado ? COLORES.acierto : COLORES.incognitaBorde) : COLORES.borde}
                            strokeWidth={r.area === '?' ? 4 : 3} strokeLinejoin="miter" shapeRendering="crispEdges" />
                    ))}
                    {cotas.map((d, i) => <Cota key={`l${i}`} d={d} revelado={revelado} solucion={reto.solucion} />)}
                    {cotas.map((d, i) => <Cota key={`p${i}`} d={d} revelado={revelado} solucion={reto.solucion} capa="pastilla" />)}
                </svg>
                <CapaDibujo herramienta={herramienta} color={color} trazosRef={trazosRef} version={version} onTrazo={() => setHayTrazos(true)} />
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 6 }}>Dibujo no a escala</div>
        </div>
    );
}
