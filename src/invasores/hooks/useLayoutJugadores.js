// Cuántos jugadores caben según el dispositivo y cómo se reparte la pantalla.
//   móvil (< 640 px)          → 1 jugador
//   tablet / portátil         → hasta 2
//   PC grande / pizarra (≥ 1280 px de ancho y ≥ 640 de alto) → hasta 4
import { useEffect, useState } from 'react';

const medir = () => ({
  ancho: typeof window !== 'undefined' ? window.innerWidth : 1024,
  alto: typeof window !== 'undefined' ? window.innerHeight : 768,
});

export function maxJugadoresPara({ ancho, alto }) {
  const corto = Math.min(ancho, alto);
  if (corto < 500 || ancho < 640) return 1;
  if (ancho >= 1280 && alto >= 640) return 4;
  return 2;
}

export function useLayoutJugadores() {
  const [m, setM] = useState(medir);
  useEffect(() => {
    const on = () => setM(medir());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  const apaisado = m.ancho >= m.alto;
  return { ...m, apaisado, maxJugadores: maxJugadoresPara(m) };
}

/** Clases de la rejilla de zonas. */
export function claseRejilla(n, apaisado) {
  if (n <= 1) return 'grid-cols-1 grid-rows-1';
  if (n === 2) return apaisado ? 'grid-cols-2 grid-rows-1' : 'grid-cols-1 grid-rows-2';
  if (n === 3) return apaisado ? 'grid-cols-3 grid-rows-1' : 'grid-cols-1 grid-rows-3';
  return apaisado ? 'grid-cols-4 grid-rows-1' : 'grid-cols-2 grid-rows-2';
}
