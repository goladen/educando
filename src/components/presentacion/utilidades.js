import { useState, useRef, useCallback } from 'react';

// Historial de deshacer/rehacer. Los cambios seguidos (< 700 ms: arrastrar, escribir…)
// se agrupan en un solo paso. cortar() fuerza que el siguiente cambio sea un paso nuevo.
export function useHistorial(inicial) {
  const [estado, setEstado] = useState({ pasado: [], presente: inicial, futuro: [] });
  const ultimo = useRef(0);

  const set = useCallback((upd) => {
    const ahora = Date.now();
    const agrupar = ahora - ultimo.current < 700;
    ultimo.current = ahora;
    setEstado(e => {
      const nuevo = typeof upd === 'function' ? upd(e.presente) : upd;
      if (nuevo === e.presente) return e;
      const pasado = agrupar && e.pasado.length ? e.pasado : [...e.pasado.slice(-79), e.presente];
      return { pasado, presente: nuevo, futuro: [] };
    });
  }, []);

  const deshacer = useCallback(() => {
    ultimo.current = 0;
    setEstado(e => (e.pasado.length
      ? { pasado: e.pasado.slice(0, -1), presente: e.pasado[e.pasado.length - 1], futuro: [e.presente, ...e.futuro].slice(0, 80) }
      : e));
  }, []);
  const rehacer = useCallback(() => {
    ultimo.current = 0;
    setEstado(e => (e.futuro.length
      ? { pasado: [...e.pasado, e.presente], presente: e.futuro[0], futuro: e.futuro.slice(1) }
      : e));
  }, []);
  const cortar = useCallback(() => { ultimo.current = 0; }, []);

  return {
    valor: estado.presente, set, deshacer, rehacer, cortar,
    puedeDeshacer: estado.pasado.length > 0, puedeRehacer: estado.futuro.length > 0,
  };
}

// Reduce una imagen a máx. `max` px de lado. PNG/GIF/WebP se quedan en PNG (transparencia),
// el resto pasa a JPEG. Devuelve un dataURL.
export function comprimirImagen(file, max = 1600, calidad = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const src = reader.result;
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') { resolve(src); return; }
      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const png = file.type === 'image/png' || file.type === 'image/webp';
        const out = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', calidad);
        // Si el PNG reducido pesa más que el original, nos quedamos con el original
        resolve(out.length < src.length || k < 1 ? out : src);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// Proporción real (ancho/alto) de una imagen
export function proporcionImagen(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.width && img.height ? img.width / img.height : 4 / 3);
    img.onerror = () => resolve(4 / 3);
    img.src = src;
  });
}

// Copia profunda de una diapositiva con ids nuevos (para duplicar)
export function clonarDiapositiva(slide, nid) {
  const c = JSON.parse(JSON.stringify(slide));
  c.id = Date.now() + Math.floor(Math.random() * 1000);
  if (Array.isArray(c.elements)) c.elements = c.elements.map(e => ({ ...e, id: nid() }));
  return c;
}
