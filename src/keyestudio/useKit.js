// Estado de la conexión del Laboratorio Smart Home para React + utilidades de cálculo comunes.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getSnap, suscribir, escuchar } from './conexionKit';

export const useKit = () => useSyncExternalStore(suscribir, getSnap);

/** Llama a fn(evento) con cada lectura ('K') o tiempo de reacción ('R') mientras el componente vive. */
export function useEventosKit(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => escuchar((ev) => ref.current(ev)), []);
}

export const fmt = (x, dec = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(dec).replace('.', ',').replace(/^-/, '−'));

export function estadisticos(v) {
  const n = v.length;
  if (!n) return null;
  const media = v.reduce((a, b) => a + b, 0) / n;
  const desv = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / n);
  return { n, media, desv, min: Math.min(...v), max: Math.max(...v) };
}

/** Recta de mínimos cuadrados y = a + b·x y su R². */
export function regresion(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (sxx === 0) return null;
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}

/** Descarga filas como CSV (separador «;» y coma decimal, para abrirlo en Excel/Calc en español). */
export function descargarCSV(nombre, cabecera, filas) {
  const celda = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`);
  const txt = [cabecera.map(celda).join(';'), ...filas.map((f) => f.map(celda).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
