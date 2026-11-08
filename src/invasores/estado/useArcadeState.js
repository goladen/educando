// Estado global de la partida (HUD, flujo y reglas de puntuación). Lo que cambia a 60 fps
// (posiciones) NO está aquí: vive en mundosRef dentro de InvasoresArcade.
import { useReducer } from 'react';
import { COLORES_JUGADOR } from '../tema';

export const NOMBRES_DEFECTO = ['J1', 'J2', 'J3', 'J4'];
const ACIERTOS_POR_NIVEL = 5;
const MAX_HISTORIAL = 60;

export const configInicial = {
  variante: 'DISPARA',                  // 'DISPARA' | 'FILTRO'
  fuente: { tipo: 'RAPIDAS', operaciones: ['suma', 'resta'], nivel: 1 },
  // otras fuentes: { tipo: 'MATES' } | { tipo: 'BANCO', clave } | { tipo: 'RECURSO', recurso }
  numJugadores: 1,
  nombres: [...NOMBRES_DEFECTO],
  vidas: 3,
  duracion: 0,                           // segundos; 0 = sin límite
  modo: 'competitivo',                   // 'competitivo' | 'cooperativo' (vidas compartidas)
  velocidad: 1,                          // 0.7 lenta · 1 normal · 1.35 rápida
  escribir: false,                       // V1: escribir la respuesta en vez de elegir A-D
  falsaEscapaQuitaVida: true,            // V2: dejar pasar una falsa cuesta una vida
  // Mandos micro:bit (sin reprogramarlos: se usan sus modos letras / número / volante-fútbol)
  mandos: false,
  mandosRespuesta: 'letras',             // V1: 'letras' (A-D) | 'numero' (marcar el resultado)
  turnos: false,                         // cada pregunta pasa el mando de esa zona al siguiente
};

const jugadorInicial = (i, cfg) => ({
  id: i,
  nombre: (cfg.nombres[i] || '').trim() || NOMBRES_DEFECTO[i],
  color: COLORES_JUGADOR[i],
  puntos: 0, vidas: cfg.vidas, nivel: 1,
  racha: 0, mejorRacha: 0, aciertos: 0, fallos: 0, rondas: 0,
  cursor: 0,              // todos empiezan en la misma pregunta del mazo común
  entrada: '',            // V1: lo tecleado / opción elegida
  feedback: null,         // { tipo: 'error' | 'acierto' | 'vida', t } → animación del panel
  aviso: null,            // { texto, t } → banner de nivel / racha
  eliminado: false,
  historial: [],          // [{ enunciado, correcta, dada, ok }]
});

export const estadoInicial = {
  fase: 'menu',           // 'menu' | 'cuenta' | 'jugando' | 'pausa' | 'fin'
  config: configInicial,
  jugadores: [],
  vidasEquipo: 0,
  restante: 0,            // segundos de partida que quedan (si hay límite)
  partida: 0,             // se incrementa en cada partida (resetea mundos)
};

// ── Edición de la entrada del teclado virtual ─────────────────────────────
function editar(entrada, tecla) {
  if (typeof tecla === 'object' && tecla.elegir !== undefined) return tecla.elegir; // botón A-D
  if (tecla === 'CLR') return '';
  if (tecla === 'DEL') return entrada.slice(0, -1);
  if (tecla === '±') return entrada.startsWith('−') ? entrada.slice(1) : `−${entrada}`;
  if (tecla === ',' && entrada.includes(',')) return entrada;
  if (entrada.length >= 24) return entrada;
  return entrada + tecla;
}

const registrar = (j, item) => [...j.historial, item].slice(-MAX_HISTORIAL);

function perderVida(s, j, extra) {
  if (s.config.modo === 'cooperativo') {
    const vidasEquipo = s.vidasEquipo - 1;
    return { s: { ...s, vidasEquipo }, j: { ...j, ...extra, racha: 0, vidas: vidasEquipo, feedback: { tipo: 'vida', t: Date.now() } } };
  }
  const vidas = j.vidas - 1;
  return { s, j: { ...j, ...extra, vidas, racha: 0, eliminado: vidas <= 0, feedback: { tipo: 'vida', t: Date.now() } } };
}

const RACHAS_AVISO = { 3: '¡RACHA ×3!', 5: '¡RACHA ×5! 🔥', 10: '¡IMPARABLE ×10!', 15: '¡LEYENDA ×15!' };

function acertar(j, puntos, extra = {}) {
  const aciertos = j.aciertos + 1;
  const racha = j.racha + 1;
  const nivel = 1 + Math.floor(aciertos / ACIERTOS_POR_NIVEL);
  // Banner grande en la zona del jugador: subida de nivel o racha
  const texto = nivel > j.nivel ? `NIVEL ${nivel} · ¡MÁS RÁPIDO!` : RACHAS_AVISO[racha];
  return {
    ...j, ...extra,
    puntos: j.puntos + puntos + Math.min(racha - 1, 5) * 20,
    aciertos, racha, mejorRacha: Math.max(j.mejorRacha, racha), nivel,
    feedback: { tipo: 'acierto', t: Date.now() },
    aviso: texto ? { texto, t: Date.now(), nivel: nivel > j.nivel } : j.aviso,
  };
}

/** Aplica un evento del motor al jugador i. Aquí están TODAS las reglas. */
function aplicarEvento(s, i, ev, pregunta) {
  const j0 = s.jugadores[i];
  if (!j0 || j0.eliminado) return s;
  const n = j0.nivel;
  const info = pregunta ? { enunciado: pregunta.enunciado, correcta: pregunta.correcta } : {};
  let st = s;
  let j = j0;

  switch (ev.tipo) {
    // Variante 1
    case 'ALIEN_DESTRUIDO':
      j = acertar(j0, 100 * n + (ev.bonus || 0), {
        cursor: j0.cursor + 1, entrada: '', rondas: j0.rondas + 1, ultimaErronea: null,
        historial: registrar(j0, { ...info, dada: ev.dada ?? info.correcta, ok: true }),
      });
      break;
    case 'RESPUESTA_ERRONEA':
      j = { ...j0, fallos: j0.fallos + 1, racha: 0, entrada: '', feedback: { tipo: 'error', t: Date.now() }, ultimaErronea: ev.dada };
      break;
    case 'ALIEN_ATERRIZA': {
      const r = perderVida(s, j0, {
        cursor: j0.cursor + 1, entrada: '', rondas: j0.rondas + 1, fallos: j0.fallos + 1,
        historial: registrar(j0, { ...info, dada: j0.ultimaErronea || '(sin responder)', ok: false }),
        ultimaErronea: null,
      });
      st = r.s; j = r.j;
      break;
    }
    // Variante 2
    case 'FALSA_DESTRUIDA':
      j = { ...j0, puntos: j0.puntos + 50 * n };
      break;
    case 'CORRECTA_DESTRUIDA': {
      const r = perderVida(s, j0, {
        cursor: j0.cursor + 1, rondas: j0.rondas + 1, fallos: j0.fallos + 1,
        historial: registrar(j0, { ...info, dada: `disparó a «${info.correcta}»`, ok: false }),
      });
      st = r.s; j = r.j;
      break;
    }
    case 'CORRECTA_A_SALVO': {
      const extra = {
        cursor: j0.cursor + 1, rondas: j0.rondas + 1,
        historial: registrar(j0, { ...info, dada: info.correcta, ok: true, escapadas: ev.escapadas || 0 }),
      };
      if (ev.escapadas > 0 && s.config.falsaEscapaQuitaVida) {
        // La correcta pasó, pero también se coló alguna falsa: cuenta como acierto y quita una vida
        const ac = acertar(j0, 100 * n, extra);
        const r = perderVida(s, ac, {});
        st = r.s; j = r.j;
      } else {
        j = acertar(j0, 100 * n + (ev.limpia ? 100 * n : 0), extra);
      }
      break;
    }
    default:
      return s;
  }

  let jugadores = st.jugadores.map((x) => (x.id === i ? j : x));
  if (st.config.modo === 'cooperativo') {
    const vidas = st.vidasEquipo;
    jugadores = jugadores.map((x) => ({ ...x, vidas, eliminado: vidas <= 0 }));
  }
  return { ...st, jugadores };
}

function reducer(s, a) {
  switch (a.type) {
    case 'CONFIG':
      return { ...s, config: { ...s.config, ...a.config } };
    case 'EMPEZAR': {
      const cfg = s.config;
      return {
        // con a.intro se enseña antes el briefing de la misión (fase 'intro' → 'cuenta')
        ...s, fase: a.intro ? 'intro' : 'cuenta', partida: s.partida + 1,
        jugadores: Array.from({ length: cfg.numJugadores }, (_, i) => jugadorInicial(i, cfg)),
        vidasEquipo: cfg.vidas + (cfg.modo === 'cooperativo' ? cfg.numJugadores - 1 : 0),
        restante: cfg.duracion,
      };
    }
    case 'FASE':
      return { ...s, fase: a.fase };
    case 'TECLA':
      return {
        ...s,
        jugadores: s.jugadores.map((j) => (j.id === a.jugador && !j.eliminado
          ? { ...j, entrada: editar(j.entrada, a.tecla), feedback: j.feedback?.tipo === 'error' ? null : j.feedback }
          : j)),
      };
    case 'EVENTOS': {
      let st = s;
      for (const ev of a.eventos) st = aplicarEvento(st, a.jugador, ev, a.pregunta);
      const quedan = st.jugadores.some((j) => !j.eliminado);
      return quedan ? st : { ...st, fase: 'fin' };
    }
    case 'TIEMPO': {
      if (s.fase !== 'jugando' || !s.config.duracion) return s;
      const restante = Math.max(0, s.restante - 1);
      return restante === 0 ? { ...s, restante, fase: 'fin' } : { ...s, restante };
    }
    case 'MENU':
      return { ...s, fase: 'menu', jugadores: [] };
    default:
      return s;
  }
}

export function useArcadeState(configParcial) {
  return useReducer(reducer, configParcial, (c) => ({ ...estadoInicial, config: { ...configInicial, ...(c || {}) } }));
}

/** Datos de un jugador para el informe / registro. */
export function resumenJugador(j, cfg) {
  const intentos = j.aciertos + j.fallos;
  return {
    nombre: j.nombre, puntos: j.puntos, nivel: j.nivel, rondas: j.rondas,
    aciertos: j.aciertos, fallos: j.fallos, intentos,
    porcentaje: intentos > 0 ? Math.round((j.aciertos / intentos) * 100) : 0,
    mejorRacha: j.mejorRacha, vidas: Math.max(0, j.vidas), eliminado: j.eliminado,
    acertadas: j.historial.filter((h) => h.ok),
    falladas: j.historial.filter((h) => !h.ok),
    variante: cfg.variante,
  };
}
