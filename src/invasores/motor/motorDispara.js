// Variante 1 · «Dispara al responder»: un alien activo baja con la pregunta; al responder bien
// la nave (que lo sigue sola) dispara un láser. Si llega al suelo, el jugador pierde una vida.
// Motor PURO: (mundo, dt, input, jugador, ctx) → { mundo, eventos }.
import { comprobar } from '../preguntas';
import {
  SUELO, ALTO_ALIEN, uid, azar, limitar, colorAlien, velocidadCaida, efecto, avanzarEfectos, avanzarFormacion,
} from './comun';

const SEGUNDOS_CAIDA = 17;    // a nivel 1 y velocidad normal
const DURACION_LASER = 0.14;  // lo que tarda en impactar
const ANCHO = 0.2;

export function crearMundoDispara() {
  return {
    tipo: 'DISPARA', t: 0,
    alien: null, laser: null, efectos: [],
    formacion: { offset: 0, dir: 1 },
    nave: { x: 0.5 },
    cursor: -1, espera: 0.7, error: 0, golpe: 0,
  };
}

function nuevoAlien(nivel, velocidad) {
  const baseX = azar(0.3, 0.7);
  return {
    id: uid(), baseX, x: baseX, y: 0.14, w: ANCHO, h: ALTO_ALIEN,
    vy: velocidadCaida(SEGUNDOS_CAIDA, nivel, velocidad),
    fase: azar(0, Math.PI * 2), sprite: Math.floor(Math.random() * 3), color: colorAlien(),
  };
}

export function stepDispara(m0, dt, _input, jugador, ctx) {
  const m = { ...m0, t: m0.t + dt, efectos: avanzarEfectos(m0.efectos, dt), formacion: avanzarFormacion(m0.formacion, dt) };
  const eventos = [];
  m.error = Math.max(0, m.error - dt);
  m.golpe = Math.max(0, m.golpe - dt);

  // Nueva pregunta (el reducer avanzó el cursor) → preparar el siguiente alien
  if (jugador.cursor !== m.cursor) {
    m.cursor = jugador.cursor;
    m.alien = null;
    m.terminada = false;
    m.espera = Math.max(m.espera, 0.45);
  }

  if (!m.alien && !m.laser) {
    m.espera -= dt;
    if (m.espera <= 0 && ctx.pregunta && !m.terminada) m.alien = nuevoAlien(jugador.nivel, ctx.velocidad);
  }

  if (m.alien) {
    const a = { ...m.alien };
    if (!m.laser) a.y += a.vy * dt;
    a.x = limitar(a.baseX + Math.sin(m.t * 1.1 + a.fase) * 0.13, a.w / 2, 1 - a.w / 2);
    m.alien = a;
    // La nave sigue al alien activo: el jugador solo tiene que pensar
    m.nave = { x: m.nave.x + (a.x - m.nave.x) * Math.min(1, dt * 5) };

    if (!m.laser && a.y + a.h >= SUELO) {
      eventos.push({ tipo: 'ALIEN_ATERRIZA' });
      m.efectos = [...m.efectos, efecto('explosion', a.x, SUELO, '#f43f5e', 0.7, { grande: true })];
      m.alien = null;
      m.golpe = 0.7;
      m.espera = 0.9;
      m.terminada = true; // hasta que el reducer pase a la siguiente pregunta
    }
  }

  if (m.laser) {
    const l = { ...m.laser, t: m.laser.t + dt };
    if (!l.impacto && l.t >= DURACION_LASER && m.alien) {
      l.impacto = true;
      const a = m.alien;
      m.efectos = [...m.efectos, efecto('explosion', a.x, a.y + a.h / 2, a.color, 0.55)];
      eventos.push({ tipo: 'ALIEN_DESTRUIDO', bonus: l.bonus, dada: l.dada });
      m.alien = null;
      m.espera = 0.6;
      m.terminada = true;
    }
    m.laser = l.t > 0.3 ? null : l;
  }

  return { mundo: m, eventos };
}

/** Pulsar FUEGO con lo tecleado. Devuelve el mundo nuevo y los eventos inmediatos. */
export function fuegoDispara(m, ctx, entrada) {
  if (!m.alien || m.laser || !String(entrada || '').trim()) return { mundo: m, eventos: [] };
  if (comprobar(ctx.pregunta, entrada)) {
    const a = m.alien;
    const bonus = Math.round(100 * limitar(1 - a.y / SUELO, 0, 1)); // cuanto antes, más puntos
    return {
      mundo: { ...m, nave: { x: a.x }, laser: { t: 0, x: a.x, yFin: a.y + a.h, bonus, dada: entrada } },
      eventos: [],
    };
  }
  return { mundo: { ...m, error: 0.5 }, eventos: [{ tipo: 'RESPUESTA_ERRONEA', dada: entrada }] };
}

// Solo se bloquea mientras vuela el láser: entre alien y alien ya se puede ir tecleando
// (FUEGO sin alien no hace nada y conserva lo escrito).
export const bloqueadoDispara = (m) => !!m?.laser;
