// Solución gráfica de una ecuación: y = 1.er miembro (azul) e y = 2.º miembro (naranja).
// Las soluciones son las abscisas de los puntos de corte (verde); las descartadas, en rojo.
// Se usa en la app (SolucionMulti) y en las fichas PDF (fondo blanco, imprimible).
import React, { useMemo } from 'react';
import { funcionesEcuacion, ventanaX, cortesEcuacion, fracStr } from './ecuacionesAvanzadas';

const pasoBonito = (r) => { const p = Math.pow(10, Math.floor(Math.log10(r || 1))); const f = r / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
const corto = (v) => String(Math.round(v * 100) / 100).replace('.', ',').replace('-', '−');
const cerca = (x, lista) => lista.some((c) => Math.abs(c - x) < 1e-6 * Math.max(1, Math.abs(c)));
const cuantil = (arr, q) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(q * (arr.length - 1))))];

export default function GraficaEcuacion({ datos, marcar = true, oscuro = false, leyenda = true }) {
    const W = 360, H = 230, M = 24;
    const calc = useMemo(() => {
        const fn = funcionesEcuacion(datos);
        if (!fn) return null;
        const [x0, x1] = ventanaX(datos);
        const n = 480;
        const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
        const yL = xs.map(fn.L), yR = xs.map(fn.R);
        const vals = [...yL, ...yR].filter(Number.isFinite).sort((a, b) => a - b);
        if (!vals.length) return null;
        const clave = [...datos.sols, ...datos.desc].flatMap((x) => [fn.L(x), fn.R(x)]).filter(Number.isFinite);
        let y0 = Math.min(0, cuantil(vals, 0.06), ...clave), y1 = Math.max(0, cuantil(vals, 0.94), ...clave);
        if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
        const pad = (y1 - y0) * 0.14; y0 -= pad; y1 += pad;
        const cortes = cortesEcuacion(datos, x0, x1);
        const otros = cortes.filter((x) => !cerca(x, datos.sols) && !cerca(x, datos.desc));
        return { fn, x0, x1, xs, yL, yR, y0, y1, otros };
    }, [datos]);
    if (!calc) return null;
    const { fn, x0, x1, xs, yL, yR, y0, y1, otros } = calc;
    const sx = (x) => M + ((x - x0) / (x1 - x0)) * (W - 2 * M);
    const sy = (y) => H - M - ((y - y0) / (y1 - y0)) * (H - 2 * M);
    const camino = (ys) => {
        let d = '', pen = false, prev = null;
        ys.forEach((y, i) => {
            if (!Number.isFinite(y)) { pen = false; prev = null; return; }
            const Y = sy(y);
            // salto de asíntota: no unir puntos muy alejados fuera de la ventana
            if (prev !== null && Math.abs(Y - prev) > H * 1.5 && (Y < 0 || Y > H || prev < 0 || prev > H)) pen = false;
            const Yc = Math.max(-3 * H, Math.min(4 * H, Y));
            d += `${pen ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${Yc.toFixed(1)}`;
            pen = true; prev = Y;
        });
        return d;
    };
    const fondo = oscuro ? '#1f2438' : 'white', rejilla = oscuro ? '#2d3350' : '#eef0f3', ejes = oscuro ? '#aab' : '#555', texto = oscuro ? '#ccd' : '#777';
    const pX = datos.grados ? 90 : pasoBonito((x1 - x0) / 9), pY = pasoBonito((y1 - y0) / 7);
    const tx = []; for (let v = Math.ceil(x0 / pX) * pX; v <= x1 + 1e-9; v += pX) tx.push(+v.toFixed(6));
    const ty = []; for (let v = Math.ceil(y0 / pY) * pY; v <= y1; v += pY) ty.push(+v.toFixed(6));
    const ejeX = Math.max(M, Math.min(H - M, sy(0))), ejeY = sx(0), hayY = ejeY >= M && ejeY <= W - M;
    const id = 'clipGE' + Math.abs([...datos.ecuacion].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1e9, 7));
    const etq = (x) => (datos.grados ? `${fracStr(x)}°` : `x = ${fracStr(x)}`);
    const punto = (x, color, i, tachado) => {
        const yl = fn.L(x), yr = fn.R(x);
        const y = Number.isFinite(yl) ? yl : yr;
        const enY = Number.isFinite(y) && y >= y0 && y <= y1;
        const X = sx(x);
        return (
            <g key={`${color}${i}`}>
                <line x1={X} x2={X} y1={enY ? sy(y) : M} y2={ejeX} stroke={color} strokeWidth="1.2" strokeDasharray="3 3" />
                {enY && !tachado && <circle cx={X} cy={sy(y)} r="4.5" fill={color} stroke={fondo} strokeWidth="1.5" />}
                {tachado && Number.isFinite(yl) && yl >= y0 && yl <= y1 && <circle cx={X} cy={sy(yl)} r="3.5" fill="none" stroke={color} strokeWidth="1.5" />}
                {tachado && Number.isFinite(yr) && yr >= y0 && yr <= y1 && <circle cx={X} cy={sy(yr)} r="3.5" fill="none" stroke={color} strokeWidth="1.5" />}
                <circle cx={X} cy={ejeX} r="3" fill={color} />
                <text x={X} y={ejeX + 13 + (i % 2) * 10} fill={color} fontSize="10" fontWeight="700" textAnchor="middle">{etq(x)}{tachado ? ' ✘' : ''}</text>
            </g>
        );
    };
    return (
        <div style={{ width: '100%', maxWidth: W }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', background: fondo, border: `1px solid ${oscuro ? '#3a4060' : '#e3e3e3'}`, borderRadius: 6 }}>
                <defs><clipPath id={id}><rect x={M} y={M - 6} width={W - 2 * M} height={H - 2 * M + 6} /></clipPath></defs>
                {tx.map((v) => <line key={'gx' + v} x1={sx(v)} x2={sx(v)} y1={M} y2={H - M} stroke={rejilla} />)}
                {ty.map((v) => <line key={'gy' + v} y1={sy(v)} y2={sy(v)} x1={M} x2={W - M} stroke={rejilla} />)}
                <line x1={M} x2={W - M} y1={ejeX} y2={ejeX} stroke={ejes} strokeWidth="1.2" />
                {hayY && <line y1={M} y2={H - M} x1={ejeY} x2={ejeY} stroke={ejes} strokeWidth="1.2" />}
                {tx.filter((v) => v !== 0 || datos.grados).map((v) => <text key={'tx' + v} x={sx(v)} y={Math.min(H - 4, ejeX + (marcar ? 34 : 12))} fill={texto} fontSize="9" textAnchor="middle">{datos.grados ? `${v}°` : corto(v)}</text>)}
                {ty.filter((v) => v !== 0).map((v) => <text key={'ty' + v} x={hayY ? ejeY - 3 : M - 2} y={sy(v) + 3} fill={texto} fontSize="9" textAnchor="end">{corto(v)}</text>)}
                <g clipPath={`url(#${id})`}>
                    <path d={camino(yL)} fill="none" stroke="#2980b9" strokeWidth="2.2" />
                    <path d={camino(yR)} fill="none" stroke="#e67e22" strokeWidth="2.2" />
                </g>
                {marcar && otros.map((x, i) => punto(x, '#95a5a6', i + 7, false))}
                {marcar && datos.desc.filter((x) => x >= x0 && x <= x1).map((x, i) => punto(x, '#e74c3c', i + 3, true))}
                {marcar && datos.sols.filter((x) => x >= x0 && x <= x1).map((x, i) => punto(x, '#27ae60', i, false))}
            </svg>
            {leyenda && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.72rem', color: texto, marginTop: 4, lineHeight: 1.3 }}>
                    <span><b style={{ color: '#2980b9' }}>━</b> 1.er miembro</span>
                    <span><b style={{ color: '#e67e22' }}>━</b> 2.º miembro</span>
                    {marcar && <span><b style={{ color: '#27ae60' }}>●</b> solución (punto de corte)</span>}
                    {marcar && datos.desc.length > 0 && <span><b style={{ color: '#e74c3c' }}>✘</b> descartada</span>}
                    {marcar && otros.length > 0 && <span><b style={{ color: '#95a5a6' }}>●</b> otro corte</span>}
                </div>
            )}
        </div>
    );
}
