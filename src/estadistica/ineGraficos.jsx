// ineGraficos.jsx — Gráficos SVG/HTML del Explorador INE (tema oscuro de Estadística).
// Paleta de series validada (dataviz) sobre la superficie #161b22: s1 azul, s2 naranja.
import React, { useState, useRef } from 'react';

export const D = {
    bg:'#0d1117', card:'#161b22', border:'#30363d', dark2:'#21262d',
    text:'#e6edf3', muted:'#8b949e', accent:'#3498db',
    green2:'#2ecc71', red:'#e74c3c', gold:'#f39c12',
    s1:'#3498db', s2:'#d9782d', grid:'#262c36',
};
export const nf = (v, dec = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const Leyenda = ({ items }) => (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
        {items.map(s => (
            <span key={s.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: D.muted }}>
                <span style={{ width: 14, height: s.barra ? 10 : 3, borderRadius: 2, background: s.color }} />{s.nombre}
            </span>
        ))}
    </div>
);

// ─── Líneas con cruceta y tooltip ────────────────────────────────────────────
export function GraficoLineas({ series, formato = v => nf(v), alto = 220, unidad = '' }) {
    const ref = useRef(null);
    const [hover, setHover] = useState(null);
    const W = 640, H = alto, M = { t: 14, r: 16, b: 26, l: 68 };
    const todos = series.flatMap(s => s.puntos);
    if (!todos.length) return <div style={{ color: D.muted, fontSize: '0.85rem', padding: 20 }}>Sin datos disponibles.</div>;
    const anyos = [...new Set(todos.map(p => p.anyo))].sort((a, b) => a - b);
    const x0 = anyos[0], x1 = anyos[anyos.length - 1];
    let y0 = Math.min(...todos.map(p => p.valor)), y1 = Math.max(...todos.map(p => p.valor));
    const marg = (y1 - y0) * 0.1 || Math.abs(y1) * 0.1 || 1;
    y0 -= marg; y1 += marg;
    const X = a => M.l + (x1 === x0 ? 0.5 : (a - x0) / (x1 - x0)) * (W - M.l - M.r);
    const Y = v => M.t + (1 - (v - y0) / (y1 - y0)) * (H - M.t - M.b);
    const ticksY = Array.from({ length: 4 }, (_, i) => y0 + (y1 - y0) * (i + 0.5) / 4);
    const pasoX = Math.max(1, Math.ceil(anyos.length / 7));

    const mover = (e) => {
        const r = ref.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width * W;
        let mejor = anyos[0];
        for (const a of anyos) if (Math.abs(X(a) - px) < Math.abs(X(mejor) - px)) mejor = a;
        setHover({ anyo: mejor, left: X(mejor) / W * 100 });
    };

    return (
        <div style={{ position: 'relative' }}>
            <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }}
                onMouseMove={mover} onMouseLeave={() => setHover(null)} onTouchStart={e => mover(e.touches[0])} onTouchMove={e => mover(e.touches[0])}
                role="img" aria-label={series.map(s => s.nombre).join(', ')}>
                {ticksY.map((v, i) => (
                    <g key={i}>
                        <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={D.grid} strokeWidth={1} />
                        <text x={M.l - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={D.muted}>{formato(v)}</text>
                    </g>
                ))}
                {anyos.filter((_, i) => i % pasoX === 0 || i === anyos.length - 1).map(a => (
                    <text key={a} x={X(a)} y={H - 6} textAnchor="middle" fontSize={11} fill={D.muted}>{a}</text>
                ))}
                {series.map(s => s.puntos.length > 0 && (
                    <path key={s.nombre} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                        d={s.puntos.map((p, i) => `${i ? 'L' : 'M'}${X(p.anyo)},${Y(p.valor)}`).join(' ')} />
                ))}
                {hover && <line x1={X(hover.anyo)} x2={X(hover.anyo)} y1={M.t} y2={H - M.b} stroke={D.muted} strokeWidth={1} strokeDasharray="3 3" />}
                {hover && series.map(s => {
                    const p = s.puntos.find(q => q.anyo === hover.anyo);
                    return p && <circle key={s.nombre} cx={X(p.anyo)} cy={Y(p.valor)} r={4.5} fill={s.color} stroke={D.card} strokeWidth={2} />;
                })}
                <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="transparent" />
            </svg>
            {hover && (
                <div style={{ position: 'absolute', top: 4, left: `${hover.left}%`, transform: `translateX(${hover.left > 60 ? 'calc(-100% - 10px)' : '10px'})`,
                    background: D.dark2, border: `1px solid ${D.border}`, borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2, color: D.text }}>{hover.anyo}</div>
                    {series.map(s => {
                        const p = s.puntos.find(q => q.anyo === hover.anyo);
                        return p && <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, color: D.text }}>
                            <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color }} />
                            <span style={{ color: D.muted }}>{s.nombre}:</span> {formato(p.valor)}{unidad}
                        </div>;
                    })}
                </div>
            )}
            {series.length > 1 && <Leyenda items={series} />}
        </div>
    );
}

// ─── Barras horizontales (fuentes de ingreso, ranking de municipios…) ────────
export function BarrasH({ filas, formato = v => nf(v), destacar, onElegir }) {
    const max = Math.max(...filas.map(f => f.valor || 0), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filas.map(f => {
                const yo = destacar && f.nombre === destacar;
                const clicable = onElegir && f.clave && !yo;
                return (
                    <div key={f.nombre} onClick={clicable ? () => onElegir(f.clave) : undefined}
                        title={`${f.nombre}: ${f.valor == null ? 'dato no disponible (secreto estadístico)' : formato(f.valor)}${clicable ? ' · pulsa para verlo' : ''}`}
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,38%) 1fr auto', alignItems: 'center', gap: 8, fontSize: '0.8rem', padding: '2px 4px', borderRadius: 6, cursor: clicable ? 'pointer' : 'default' }}
                        onMouseEnter={e => { if (clicable) e.currentTarget.style.background = D.dark2; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <span style={{ color: yo ? D.text : D.muted, fontWeight: yo ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: clicable ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}>{f.nombre}</span>
                        <div style={{ height: 12, background: D.dark2, borderRadius: 4 }}>
                            {f.valor != null && <div style={{ width: `${f.valor / max * 100}%`, height: '100%', borderRadius: 4, background: yo ? D.s2 : D.s1, minWidth: 2 }} />}
                        </div>
                        <span style={{ color: D.text, minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.valor == null ? '—' : formato(f.valor)}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Pirámide de población (grupos quinquenales, % sobre el total) ───────────
// colores: [hombres, mujeres]; max: escala común para comparar dos pirámides
export function Piramide({ datos, colores = [D.s1, D.s2], max, titulo }) {
    const [hover, setHover] = useState(null);
    if (!datos?.length) return null;
    const escala = max || Math.max(...datos.flatMap(g => [g.h, g.m]));
    const filas = [...datos].reverse();
    const fila = hover != null ? filas[hover] : null;
    return (
        <div>
            {titulo && <div style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{titulo}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 46px 1fr', fontSize: '0.7rem', color: D.muted, marginBottom: 4 }}>
                <span style={{ textAlign: 'right' }}>Hombres ←</span><span />
                <span>→ Mujeres</span>
            </div>
            <div onMouseLeave={() => setHover(null)}>
                {filas.map((g, i) => (
                    <div key={g.grupo} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 46px 1fr', alignItems: 'center', height: 11, marginBottom: 2, background: hover === i ? D.dark2 : 'transparent', borderRadius: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ width: `${g.h / escala * 100}%`, background: colores[0], borderRadius: '3px 0 0 3px', opacity: hover == null || hover === i ? 1 : 0.55 }} />
                        </div>
                        <span style={{ textAlign: 'center', fontSize: '0.62rem', color: D.muted, fontVariantNumeric: 'tabular-nums' }}>{g.grupo}</span>
                        <div style={{ height: '100%' }}>
                            <div style={{ width: `${g.m / escala * 100}%`, height: '100%', background: colores[1], borderRadius: '0 3px 3px 0', opacity: hover == null || hover === i ? 1 : 0.55 }} />
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ minHeight: 18, textAlign: 'center', fontSize: '0.75rem', color: D.text, marginTop: 4 }}>
                {fila ? <>De {fila.grupo} años: <b>{nf(fila.h, 2)} %</b> hombres · <b>{nf(fila.m, 2)} %</b> mujeres</> : <span style={{ color: D.muted }}>Pasa el ratón por una barra para ver el porcentaje</span>}
            </div>
        </div>
    );
}

// ─── Barras pareadas para comparar dos lugares indicador a indicador ─────────
// filas: [{ nombre, a, b, formato }]; cada indicador usa su propia escala (0 → máximo de los dos)
export function BarrasPareadas({ filas, nombres, colores = [D.s1, D.s2] }) {
    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filas.map(f => {
                    const max = Math.max(f.a ?? 0, f.b ?? 0) || 1;
                    const fmt = f.formato || (v => nf(v));
                    return (
                        <div key={f.nombre}>
                            <div style={{ fontSize: '0.78rem', color: D.muted, marginBottom: 4 }}>{f.nombre}</div>
                            {[['a', 0], ['b', 1]].map(([k, i]) => (
                                <div key={k} title={`${nombres[i]}: ${f[k] == null ? 'sin dato' : fmt(f[k])}`}
                                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <div style={{ height: 12, background: D.dark2, borderRadius: 4 }}>
                                        {f[k] != null && <div style={{ width: `${Math.max(f[k], 0) / max * 100}%`, height: '100%', background: colores[i], borderRadius: 4, minWidth: 2 }} />}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', color: D.text, minWidth: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f[k] == null ? '—' : fmt(f[k])}</span>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
            <Leyenda items={nombres.map((n, i) => ({ nombre: n, color: colores[i], barra: true }))} />
        </div>
    );
}
