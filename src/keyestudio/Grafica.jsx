// Gráfica SVG sencilla para el Laboratorio Smart Home: series de puntos (líneas o nube) y curvas
// de ajuste y = f(x). Ejes con marcas «redondas» y coma decimal.
import React from 'react';

const pasoBonito = (rango) => {
  const crudo = rango / 5;
  const p = 10 ** Math.floor(Math.log10(crudo || 1));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= crudo) || p * 10;
};
const num = (v) => String(+v.toFixed(6)).replace('.', ',');

/**
 * series: [{ puntos: [[x, y]], color, nombre, linea = true }]
 * curvas: [{ f: (x) => y, color, nombre }]
 */
export default function Grafica({ series = [], curvas = [], ejeX = 'x', ejeY = 'y', xMin, xMax, yMin, yMax, alto = 260 }) {
  const todos = series.flatMap((s) => s.puntos);
  const xs = todos.map((p) => p[0]), ys = todos.map((p) => p[1]);
  let x0 = xMin ?? (xs.length ? Math.min(...xs) : 0), x1 = xMax ?? (xs.length ? Math.max(...xs) : 10);
  let y0 = yMin ?? (ys.length ? Math.min(...ys) : 0), y1 = yMax ?? (ys.length ? Math.max(...ys) : 10);
  if (x1 - x0 < 1e-9) { x0 -= 1; x1 += 1; }
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
  if (yMin == null || yMax == null) { const m = (y1 - y0) * 0.08; if (yMin == null) y0 -= m; if (yMax == null) y1 += m; }

  const W = 600, H = alto, ml = 46, mr = 12, mt = 12, mb = 34;
  const X = (x) => ml + ((x - x0) / (x1 - x0)) * (W - ml - mr);
  const Y = (y) => H - mb - ((y - y0) / (y1 - y0)) * (H - mt - mb);
  const px = pasoBonito(x1 - x0), py = pasoBonito(y1 - y0);
  const marcasX = [], marcasY = [];
  for (let v = Math.ceil(x0 / px) * px; v <= x1 + 1e-9; v += px) marcasX.push(v);
  for (let v = Math.ceil(y0 / py) * py; v <= y1 + 1e-9; v += py) marcasY.push(v);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'rgba(0,0,0,.25)', borderRadius: 12 }} role="img" aria-label={`Gráfica de ${ejeY} frente a ${ejeX}`}>
        {marcasY.map((v) => (
          <g key={'y' + v}>
            <line x1={ml} x2={W - mr} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.1)" />
            <text x={ml - 6} y={Y(v) + 4} fill="#94a3b8" fontSize="11" textAnchor="end">{num(v)}</text>
          </g>
        ))}
        {marcasX.map((v) => (
          <g key={'x' + v}>
            <line y1={mt} y2={H - mb} x1={X(v)} x2={X(v)} stroke="rgba(255,255,255,.06)" />
            <text x={X(v)} y={H - mb + 15} fill="#94a3b8" fontSize="11" textAnchor="middle">{num(v)}</text>
          </g>
        ))}
        <line x1={ml} x2={W - mr} y1={H - mb} y2={H - mb} stroke="#64748b" />
        <line x1={ml} x2={ml} y1={mt} y2={H - mb} stroke="#64748b" />
        <text x={(ml + W - mr) / 2} y={H - 4} fill="#cbd5e1" fontSize="12" textAnchor="middle" fontWeight="700">{ejeX}</text>
        <text x={12} y={mt + 4} fill="#cbd5e1" fontSize="12" fontWeight="700" transform={`rotate(-90 12 ${mt + 4})`} textAnchor="end">{ejeY}</text>
        {curvas.map((c, i) => {
          const pts = [];
          for (let k = 0; k <= 120; k++) {
            const x = x0 + ((x1 - x0) * k) / 120, y = c.f(x);
            if (Number.isFinite(y) && y >= y0 - (y1 - y0) && y <= y1 + (y1 - y0)) pts.push(`${X(x).toFixed(1)},${Y(Math.min(y1, Math.max(y0, y))).toFixed(1)}`);
          }
          return <polyline key={'c' + i} points={pts.join(' ')} fill="none" stroke={c.color} strokeWidth="2" strokeDasharray="6 4" />;
        })}
        {series.map((s, i) => (
          <g key={'s' + i}>
            {s.linea !== false && s.puntos.length > 1 && (
              <polyline points={s.puntos.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" />
            )}
            {(s.linea === false || s.puntos.length < 40) && s.puntos.map((p, k) => <circle key={k} cx={X(p[0])} cy={Y(p[1])} r={s.linea === false ? 4.5 : 2.5} fill={s.color} />)}
          </g>
        ))}
      </svg>
      {(series.length > 1 || curvas.length > 0) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
          {[...series, ...curvas].filter((s) => s.nombre).map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 3, background: s.color, display: 'inline-block', borderRadius: 2 }} />{s.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
