// Cuántos jugadores caben según el dispositivo y cómo se reparte la pantalla.
//   móvil (< 640 px de ancho) → 1 jugador
//   tablet en vertical        → hasta 2
//   ordenador / pizarra / proyector (≥ 900 px de ancho) → hasta 4
// OJO: un PC proyectado suele dar 1366×768 o menos (escala de Windows al 125-150 % y la barra del
// navegador): antes se exigían 1280×640 y no dejaba elegir 4 jugadores. Ahora se permite y se avisa.
import { useEffect, useState } from 'react';

const medir = () => ({
  ancho: typeof window !== 'undefined' ? window.innerWidth : 1024,
  alto: typeof window !== 'undefined' ? window.innerHeight : 768,
});

export function maxJugadoresPara({ ancho, alto }) {
  if (ancho < 640 || alto < 340) return 1;
  if (ancho >= 900) return 4;
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
  // pantallaJusta: caben 4, pero cada zona queda pequeña (se avisa en el menú)
  return { ...m, apaisado, maxJugadores: maxJugadoresPara(m), pantallaJusta: m.ancho < 1280 || m.alto < 640 };
}

/** Clases de la rejilla de zonas. */
export function claseRejilla(n, apaisado) {
  if (n <= 1) return 'grid-cols-1 grid-rows-1';
  if (n === 2) return apaisado ? 'grid-cols-2 grid-rows-1' : 'grid-cols-1 grid-rows-2';
  if (n === 3) return apaisado ? 'grid-cols-3 grid-rows-1' : 'grid-cols-1 grid-rows-3';
  return apaisado ? 'grid-cols-4 grid-rows-1' : 'grid-cols-2 grid-rows-2';
}
