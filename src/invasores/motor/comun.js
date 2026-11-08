// Piezas compartidas por los dos motores. Coordenadas normalizadas 0..1 dentro de la zona de
// cada jugador (x: izquierda→derecha, y: arriba→abajo), así el juego vale igual en un móvil que
// en una pizarra de 4 jugadores.
import { COLOR_ALIEN } from '../tema';

export const SUELO = 0.84;          // línea que no deben cruzar los aliens
export const NAVE_Y = 0.92;         // centro vertical de la nave del jugador
export const ALTO_ALIEN = 0.085;

let sec = 0;
export const uid = () => ++sec;
export const azar = (a, b) => a + Math.random() * (b - a);
export const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
export const colorAlien = () => COLOR_ALIEN[Math.floor(Math.random() * COLOR_ALIEN.length)];

/**
 * Velocidad de caída: recorre la pantalla en `segundos` a nivel 1 y se acelera un 12 % por nivel
 * (tope ×2,2). `factor` es la velocidad elegida en el menú (lenta / normal / rápida).
 */
export const velocidadCaida = (segundos, nivel, factor = 1) =>
  (SUELO / segundos) * factor * Math.min(2.2, 1 + 0.12 * (Math.max(1, nivel) - 1));

export const efecto = (tipo, x, y, color, dur = 0.5, extra = {}) => ({ id: uid(), tipo, x, y, color, t: 0, dur, ...extra });

export function avanzarEfectos(efectos, dt) {
  if (!efectos.length) return efectos;
  return efectos.map((e) => ({ ...e, t: e.t + dt })).filter((e) => e.t < e.dur);
}

/** Formación decorativa que marcha arriba (las naves «nodriza» que van soltando aliens). */
export function avanzarFormacion(f, dt) {
  let { offset, dir } = f;
  offset += dir * 0.05 * dt;
  if (offset > 0.06) { offset = 0.06; dir = -1; }
  if (offset < -0.06) { offset = -0.06; dir = 1; }
  return { offset, dir };
}

export const golpeBalaAlien = (b, a) =>
  Math.abs(b.x - a.x) < a.w / 2 && b.y <= a.y + a.h && b.y >= a.y - 0.02;
