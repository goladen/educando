// Variante 2 · «Filtro de respuestas»: bajan hasta 4 aliens, cada uno con una opción.
// Hay que destruir las incorrectas y dejar que la correcta toque el suelo.
// Motor PURO: (mundo, dt, input, jugador, ctx) → { mundo, eventos }.
import {
  SUELO, NAVE_Y, ALTO_ALIEN, uid, azar, limitar, colorAlien, velocidadCaida, efecto, avanzarEfectos, golpeBalaAlien,
} from './comun';

const SEGUNDOS_CAIDA = 14;
const VEL_NAVE = 0.95;          // pantallas por segundo (teclado y botones)
const VEL_NAVE_MANDO = 0.5;     // con el mando micro:bit, más lento (y según cuánto se incline)
const VEL_BALA = 1.55;
const CADENCIA = 0.32;          // s entre disparos
const MAX_BALAS = 3;

export function crearMundoFiltro() {
  return {
    tipo: 'FILTRO', t: 0,
    aliens: [], balas: [], efectos: [],
    nave: { x: 0.5 },
    cursor: -1, espera: 0.7, cooldown: 0, oleada: false, escapadas: 0, destruidas: 0, golpe: 0,
  };
}

function nuevaOleada(pregunta, nivel, velocidad) {
  const ops = (pregunta.opciones || []).slice(0, 4);
  const n = ops.length;
  const w = Math.min(0.235, 0.92 / n);
  const vy = velocidadCaida(SEGUNDOS_CAIDA, nivel, velocidad);
  return ops.map((op, i) => ({
    id: uid(), etiqueta: op, esCorrecta: op === pregunta.correcta,
    // La caja incluye el sprite y la placa con la respuesta (la placa también recibe los disparos)
    baseX: (i + 0.5) / n, x: (i + 0.5) / n, y: azar(-0.02, 0.07), w, h: ALTO_ALIEN * 1.6, vy,
    fase: azar(0, Math.PI * 2), sprite: i % 3, color: colorAlien(),
  }));
}

export function stepFiltro(m0, dt, input = {}, jugador, ctx) {
  const m = { ...m0, t: m0.t + dt, efectos: avanzarEfectos(m0.efectos, dt) };
  const eventos = [];
  m.cooldown = Math.max(0, m.cooldown - dt);
  m.golpe = Math.max(0, m.golpe - dt);

  if (jugador.cursor !== m.cursor) {
    m.cursor = jugador.cursor;
    m.oleada = false;
    m.terminada = false;
    m.aliens = [];
    m.espera = Math.max(m.espera, 0.5);
  }

  if (!m.oleada && !m.aliens.length) {
    m.espera -= dt;
    if (m.espera <= 0 && ctx.pregunta && !m.terminada) {
      m.aliens = nuevaOleada(ctx.pregunta, jugador.nivel, ctx.velocidad);
      m.oleada = true; m.escapadas = 0; m.destruidas = 0;
    }
  }

  // ── Nave ──
  let x = m.nave.x;
  if (input.izq) x -= VEL_NAVE * dt;
  if (input.der) x += VEL_NAVE * dt;
  // mando en volante: velMando de 0 a 1 según la inclinación
  const vm = VEL_NAVE_MANDO * (input.velMando ?? 1) * dt;
  if (input.izqMando) x -= vm;
  if (input.derMando) x += vm;
  if (input.objetivoX != null && !input.izq && !input.der && !input.izqMando && !input.derMando) {
    const d = input.objetivoX - x;
    x += Math.sign(d) * Math.min(Math.abs(d), VEL_NAVE_MANDO * 1.2 * dt); // solo lo usan los mandos v5
  }
  m.nave = { x: limitar(x, 0.05, 0.95) };

  // ── Disparo (mantener pulsado = ráfaga con cadencia; toque = 1 disparo) ──
  let balas = m0.balas;
  const quiere = input.fuego || input.pendiente > 0;
  if (quiere && m.cooldown <= 0 && balas.length < MAX_BALAS) {
    balas = [...balas, { id: uid(), x: m.nave.x, y: NAVE_Y - 0.05 }];
    m.cooldown = CADENCIA;
    m.disparo = true;            // el contenedor reproduce el sonido y consume el toque
  } else {
    m.disparo = false;
  }
  balas = balas.map((b) => ({ ...b, y: b.y - VEL_BALA * dt })).filter((b) => b.y > -0.05);

  // ── Aliens ──
  if (m.oleada) {
    const vivasFalsas = m.aliens.filter((a) => !a.esCorrecta).length;
    let aliens = m.aliens.map((a) => {
      const acel = a.esCorrecta && vivasFalsas === 0 ? 3.5 : 1; // si ya no quedan falsas, que baje rápido
      return {
        ...a,
        y: a.y + a.vy * acel * dt,
        x: limitar(a.baseX + Math.sin(m.t * 1.4 + a.fase) * 0.012, a.w / 2, 1 - a.w / 2),
      };
    });

    // Colisiones
    const restantes = [];
    for (const b of balas) {
      const idx = aliens.findIndex((a) => golpeBalaAlien(b, a));
      if (idx === -1) { restantes.push(b); continue; }
      const a = aliens[idx];
      aliens = aliens.filter((_, k) => k !== idx);
      m.efectos = [...m.efectos, efecto('explosion', a.x, a.y + a.h / 2, a.color, 0.55)];
      if (a.esCorrecta) {
        eventos.push({ tipo: 'CORRECTA_DESTRUIDA' });
        m.efectos = [...m.efectos, efecto('texto', a.x, a.y, '#f43f5e', 1.1, { texto: '¡ERA LA BUENA!' }),
          ...aliens.map((o) => efecto('huida', o.x, o.y, o.color, 0.6, { w: o.w, etiqueta: o.etiqueta }))];
        aliens = [];
        m.golpe = 0.7;
        break;
      }
      m.destruidas += 1;
      eventos.push({ tipo: 'FALSA_DESTRUIDA' });
      m.efectos = [...m.efectos, efecto('texto', a.x, a.y, '#a3e635', 0.7, { texto: '+' })];
    }
    balas = eventos.some((e) => e.tipo === 'CORRECTA_DESTRUIDA') ? [] : restantes;

    // Llegada al suelo
    const siguen = [];
    let fin = eventos.some((e) => e.tipo === 'CORRECTA_DESTRUIDA');
    for (const a of aliens) {
      if (fin || a.y + a.h < SUELO) { siguen.push(a); continue; }
      if (a.esCorrecta) {
        const quedan = aliens.filter((o) => !o.esCorrecta && o.y + o.h < SUELO).length;
        const escapadas = m.escapadas + quedan;
        eventos.push({ tipo: 'CORRECTA_A_SALVO', escapadas, limpia: escapadas === 0 });
        m.efectos = [...m.efectos, efecto('salvado', a.x, SUELO, '#4ade80', 1, { etiqueta: a.etiqueta, w: a.w })];
        fin = true;
      } else {
        m.escapadas += 1;
        m.efectos = [...m.efectos, efecto('explosion', a.x, SUELO, '#f43f5e', 0.6),
          efecto('texto', a.x, SUELO - 0.08, '#f43f5e', 0.9, { texto: '¡SE COLÓ!' })];
      }
    }
    if (fin) {
      // Las falsas que quedaban arriba se marchan
      const arriba = siguen.filter((a) => !a.esCorrecta);
      m.efectos = [...m.efectos, ...arriba.map((o) => efecto('huida', o.x, o.y, o.color, 0.6, { w: o.w, etiqueta: o.etiqueta }))];
      m.aliens = [];
      m.oleada = false;
      m.espera = 0.8;
      m.terminada = true; // no relanzar hasta que el reducer pase a la siguiente pregunta
    } else {
      m.aliens = siguen;
    }
  }
  m.balas = balas;
  return { mundo: m, eventos };
}
