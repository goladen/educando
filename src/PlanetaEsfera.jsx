import { useEffect, useRef } from 'react';

/*
 * Renderiza una textura equirectangular (mapa de planeta plano) sobre una
 * esfera, con proyección ortográfica + sombreado difuso, para que se vea como
 * un planeta redondo en lugar del mapa desenrollado.
 */

const _texCache = {}; // src -> { w, h, data }

function getTextura(img) {
  if (_texCache[img.src]) return _texCache[img.src];
  const w = img.naturalWidth, h = img.naturalHeight;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0);
  let data;
  try { data = octx.getImageData(0, 0, w, h).data; } catch { data = null; }
  const tex = { w, h, data };
  _texCache[img.src] = tex;
  return tex;
}

export function dibujarEsfera(ctx, img, size) {
  const R = size / 2, cx = R, cy = R;
  const { w: tw, h: th, data: tex } = getTextura(img);
  if (!tex) { ctx.drawImage(img, 0, 0, size, size); return; }
  const out = ctx.createImageData(size, size);
  const o = out.data;
  // Luz desde arriba-izquierda-frente
  let lx = -0.5, ly = -0.55, lz = 0.7;
  const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      const nx = (px - cx) / R, ny = (py - cy) / R;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) { o[idx + 3] = 0; continue; }
      const nz = Math.sqrt(1 - r2);
      const lon = Math.atan2(nx, nz);
      const lat = Math.asin(Math.max(-1, Math.min(1, -ny)));
      let u = 0.5 + lon / (2 * Math.PI);
      let v = 0.5 - lat / Math.PI;
      u = u - Math.floor(u);
      const tx = Math.min(tw - 1, Math.max(0, (u * tw) | 0));
      const ty = Math.min(th - 1, Math.max(0, (v * th) | 0));
      const ti = (ty * tw + tx) * 4;
      // Sombreado difuso + ambiente
      const dif = Math.max(0, nx * lx + ny * ly + nz * lz);
      const shade = Math.min(1, 0.35 + dif * 0.85);
      o[idx]     = tex[ti]     * shade;
      o[idx + 1] = tex[ti + 1] * shade;
      o[idx + 2] = tex[ti + 2] * shade;
      o[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

// Renderiza a un PNG data URL (para insertar en la pizarra).
export function renderEsferaDataURL(src, size = 256) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        dibujarEsfera(c.getContext('2d'), img, size);
        res(c.toDataURL('image/png'));
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}

// Componente de miniatura para el banco de imágenes.
export default function PlanetaEsfera({ src, size = 64 }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancel = false;
    const img = new Image();
    img.onload = () => {
      if (cancel || !ref.current) return;
      const c = ref.current;
      c.width = size; c.height = size;
      dibujarEsfera(c.getContext('2d'), img, size);
    };
    img.src = src;
    return () => { cancel = true; };
  }, [src, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}
