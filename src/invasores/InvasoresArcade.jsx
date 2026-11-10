// ════════════════════════════════════════════════════════════════════════════
//  INVASIÓN π — minijuego arcade de 1 a 4 jugadores (ArcadeContainer)
//  Variante 1 «Dispara al responder» · Variante 2 «Filtro de respuestas»
//
//  Capas:
//   · useArcadeState (useReducer) → fase, config, jugadores[] (HUD y reglas)
//   · mundosRef (useRef)          → posiciones a 60 fps, una por jugador
//   · motor puro por variante     → step(mundo, dt, input, jugador, ctx) → { mundo, eventos }
//   · useGameLoop                 → rAF compartido, entrega eventos al reducer
//   · mazo común                  → todos los jugadores reciben las mismas preguntas
//   · mandos micro:bit (opcional) → useMandosOvni (mismo sistema que el Ovni: detección,
//                                   asignación automática y ⏭ para pasar el mando)
// ════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './invasores.css';
import { useArcadeState, resumenJugador } from './estado/useArcadeState';
import { VARIANTES } from './variantes';
import { useGameLoop } from './motor/useGameLoop';
import { useLayoutJugadores, claseRejilla } from './hooks/useLayoutJugadores';
import { useControlesTeclado } from './hooks/useControlesTeclado';
import {
  crearMazo, generarRapidas, desdeMates, desdeBanco, desdeRecurso, hojasDeRecurso, jugables, jugablesConMandos, modoTeclado,
  fmtNum, BANCOS, OPERACIONES_RAPIDAS,
} from './preguntas';
import { barajar } from '../utils/normalizarPreguntas';
import { sonidoActivo, setSonidoActivo } from '../utils/sonidosFeedback';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { MODOS, feedbackMando } from '../mandos/mandosMicrobit.js';
import ChipAntena from '../mandos/ChipAntena.jsx';
import { useMandosOvni, PilotoEnJuego } from '../ovniMandos.jsx';
import { sfx, despertarAudioArcade } from './sonidosArcade';
import PlayerZone from './ui/PlayerZone';
import { Corazon } from './ui/Sprites';
import MenuArcade from './pantallas/MenuArcade';
import FinPartida from './pantallas/FinPartida';
import Briefing, { briefingVisto } from './pantallas/Briefing';
import { TIPO_JUEGO } from './pantallas/ModalEnviarProfe';
import { conSemilla, nuevaSemilla } from '../utils/semilla';
import {
  fuenteSerializable, codificarFicha, decodificarFicha, enlaceFicha, fichaDeUrl, resolverFicha,
  fichasRecientes, guardarFichaReciente, olvidarFichaReciente,
} from './fichaEnlace';
import { BTN, NEON, TITULO_NEON } from './tema';

const FUENTES_URL = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
const LS_RECORDS = 'pikt_invasores_records';

function useFuentesArcade() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FUENTES_URL}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FUENTES_URL;
    document.head.appendChild(l);
  }, []);
}

/** Con mandos en V1: 'letras' | 'numero' (marcar el número solo con fuentes numéricas). */
const respuestaMandos = (cfg) => {
  if (!cfg.mandos || cfg.variante !== 'DISPARA') return null;
  const numerica = cfg.fuente.tipo === 'RAPIDAS' || cfg.fuente.tipo === 'MATES';
  return cfg.mandosRespuesta === 'numero' && numerica ? 'numero' : 'letras';
};

function construirMazo(cfg, apiMates) {
  const { fuente, variante } = cfg;
  const resp = respuestaMandos(cfg);
  const filtrar = (lista) => (resp ? jugablesConMandos(jugables(lista, variante), variante, resp) : jugables(lista, variante));
  const aviso = resp ? ' con los mandos' : '';
  // Partida vinculada a una ficha PDF: sus preguntas, en su orden (y al acabarlas, otra vuelta igual)
  if (cfg.ficha?.preguntas?.length) {
    const base = filtrar(cfg.ficha.preguntas);
    if (!base.length) throw new Error(`Las preguntas de esta ficha no se pueden jugar así${aviso}.`);
    let vuelta = 0;
    return crearMazo(base, () => { vuelta += 1; return base.map((p) => ({ ...p, id: `${p.id}v${vuelta}` })); });
  }
  if (fuente.tipo === 'RAPIDAS') {
    const gen = () => filtrar(generarRapidas(fuente, 40));
    return crearMazo(gen(), gen);
  }
  if (fuente.tipo === 'MATES') {
    const gen = () => filtrar(desdeMates(apiMates?.(30) || []));
    const base = gen();
    if (!base.length) throw new Error(`Elige al menos un tema y un tipo de ejercicio de Math World que se pueda jugar en este modo${aviso}.`);
    return crearMazo(base, gen);
  }
  if (fuente.tipo === 'BANCO') {
    const base = filtrar(barajar(desdeBanco(fuente.clave)));
    if (!base.length) throw new Error(`Esta materia no tiene preguntas que se puedan jugar así${aviso}.`);
    return crearMazo(base);
  }
  if (!fuente.recurso) throw new Error('Elige un recurso del profe (buscador o código).');
  const base = filtrar(barajar(desdeRecurso(fuente.recurso, fuente.hojas)));
  if (!base.length) {
    throw new Error(variante === 'FILTRO' || resp
      ? `Este recurso no tiene preguntas con opciones${aviso}: prueba «Dispara al responder» escribiendo la respuesta.`
      : `${fuente.hojas?.length ? 'Las hojas elegidas no tienen' : 'Este recurso no tiene'} preguntas que se puedan jugar.`);
  }
  return crearMazo(base);
}

/** Las n primeras preguntas de la partida, generadas con la semilla (siempre las mismas). */
function preguntasConSemilla(cfg, apiMates, semilla, n) {
  return conSemilla(semilla, () => {
    const mazo = construirMazo({ ...cfg, ficha: null }, apiMates);
    const genera = cfg.fuente.tipo === 'RAPIDAS' || cfg.fuente.tipo === 'MATES';
    const total = genera ? n : Math.min(n, mazo.tamano);
    return Array.from({ length: total }, (_, i) => mazo.get(i)).filter(Boolean);
  });
}
/** Número de cada pregunta en la ficha (#01, #02…), visible también en la partida. */
const numerar = (preguntas) => preguntas.map((p, i) => ({ ...p, fichaNum: i + 1 }));

function tituloPartida(cfg) {
  const v = VARIANTES[cfg.variante].nombre;
  if (cfg.ficha) return `${v} · 🖨️ Ficha: ${cfg.ficha.titulo || 'preguntas de la ficha'}`;
  const f = cfg.fuente;
  if (f.tipo === 'RAPIDAS') {
    const ops = OPERACIONES_RAPIDAS.filter((o) => f.operaciones?.includes(o.id)).map((o) => o.nombre).join(', ');
    return `${v} · Cálculo rápido (${ops}) · nivel ${f.nivel}`;
  }
  if (f.tipo === 'MATES') return `${v} · Math World`;
  if (f.tipo === 'BANCO') return `${v} · ${BANCOS[f.clave]?.nombre || 'Materias'}`;
  const nombresHojas = f.hojas?.length
    ? hojasDeRecurso(f.recurso).filter((h) => f.hojas.includes(h.indice)).map((h) => h.nombre).join(', ')
    : '';
  return `${v} · ${f.recurso?.titulo || 'Recurso'}${nombresHojas ? ` (${nombresHojas})` : ''}`;
}

// Récord por dispositivo: misma variante y mismo contenido
const claveRecord = (cfg) => {
  const f = cfg.fuente;
  if (cfg.ficha) return `${cfg.variante}|FICHA|${cfg.ficha.semilla}`;
  const k = f.tipo === 'RAPIDAS' ? `${[...(f.operaciones || [])].sort().join('+')}-${f.nivel}`
    : f.tipo === 'BANCO' ? f.clave : f.tipo === 'RECURSO' ? `${f.recurso?.id || ''}${f.hojas?.length ? `#${[...f.hojas].sort((a, b) => a - b).join('.')}` : ''}` : '';
  return `${cfg.variante}|${f.tipo}|${k}`;
};
function actualizarRecord(cfg, puntos) {
  try {
    const todos = JSON.parse(localStorage.getItem(LS_RECORDS) || '{}');
    const k = claveRecord(cfg);
    const anterior = Number(todos[k]) || 0;
    if (puntos > anterior) {
      todos[k] = puntos;
      localStorage.setItem(LS_RECORDS, JSON.stringify(todos));
      return { nuevo: anterior > 0 || puntos > 0, valor: puntos, anterior };
    }
    return { nuevo: false, valor: anterior, anterior };
  } catch { return null; }
}

// ?mates=expresiones,polinomios&nivel=2 → arranca con Math World y esos temas (enlace desde Álgebra)
function configDesdeUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const temas = (q.get('mates') || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!temas.length) return null;
    const nivel = Number(q.get('nivel'));
    return { fuente: { tipo: 'MATES', temas, ...([1, 2, 3].includes(nivel) ? { nivel } : {}) } };
  } catch { return null; }
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function InvasoresArcade({ onExit, recurso = null }) {
  useFuentesArcade();
  const raizRef = useRef(null);
  const layout = useLayoutJugadores();
  const [s, dispatch] = useArcadeState(recurso ? { fuente: { tipo: 'RECURSO', recurso } } : configDesdeUrl());
  const { config, fase, jugadores } = s;
  const variante = VARIANTES[config.variante];
  const respMandos = respuestaMandos(config);

  const [error, setError] = useState('');
  const [cuenta, setCuenta] = useState(3);
  const [sonido, setSonido] = useState(() => sonidoActivo());
  const [resumenes, setResumenes] = useState([]);
  const [porTiempo, setPorTiempo] = useState(false);
  const [record, setRecord] = useState(null);
  const [mandosFilas, setMandosFilas] = useState([]);

  // Refs que lee el bucle sin re-crearse
  const mundosRef = useRef([]);
  const inputsRef = useRef([]);
  const mazoRef = useRef(null);
  const apiMatesRef = useRef(null);
  const varianteRef = useRef(variante);
  const jugadoresRef = useRef(jugadores);
  const configRef = useRef(config);
  const faseRef = useRef(fase);
  varianteRef.current = variante;
  jugadoresRef.current = jugadores;
  configRef.current = config;
  faseRef.current = fase;

  // Cambiar el contenido o el modo de juego desvincula la ficha PDF
  const setConfig = useCallback((patch) => {
    setError('');
    const desvincula = patch.fuente || (patch.variante && patch.variante !== configRef.current.variante);
    dispatch({ type: 'CONFIG', config: desvincula && configRef.current.ficha ? { ...patch, ficha: null } : patch });
  }, [dispatch]);
  const preguntaDe = useCallback((j) => (j && mazoRef.current ? mazoRef.current.get(j.cursor) : null), []);
  const ctxDe = useCallback((j) => ({ pregunta: preguntaDe(j), velocidad: configRef.current.velocidad }), [preguntaDe]);

  // ── Mandos micro:bit (mismo hook que el Ovni, ampliado a 4 zonas y a otros modos) ──
  const nZonas = fase === 'menu' ? Math.min(config.numJugadores, layout.maxJugadores) : jugadores.length || 1;
  const modoMando = config.variante === 'FILTRO' ? null : respMandos === 'numero' ? MODOS.NUMERO : MODOS.LETRAS;
  const aceptaMando = useCallback((ev) => (configRef.current.variante === 'FILTRO'
    ? ev.tipo === 'futbol'
    : ev.tipo === 'letra' || ev.tipo === 'numero'), []);
  const ctrlMandos = useMandosOvni(!!config.mandos, nZonas, { modo: modoMando, acepta: aceptaMando });
  const ctrlRef = useRef(ctrlMandos);
  ctrlRef.current = ctrlMandos;
  const statsMandosRef = useRef({}); // id → { aciertos, fallos, intentos, puntos }

  // ── Inicio de partida ──
  const empezar = useCallback((patch = null) => {
    despertarAudioArcade();
    const cfg = patch ? { ...configRef.current, ...patch } : configRef.current;
    const n = Math.max(1, Math.min(cfg.numJugadores, layout.maxJugadores));
    try {
      mazoRef.current = construirMazo(cfg, apiMatesRef.current);
    } catch (e) {
      setError(e.message);
      return;
    }
    const v = VARIANTES[cfg.variante];
    mundosRef.current = Array.from({ length: n }, () => v.crearMundo());
    inputsRef.current = Array.from({ length: n }, () => ({}));
    statsMandosRef.current = {};
    setError('');
    setPorTiempo(false);
    setRecord(null);
    setMandosFilas([]);
    dispatch({ type: 'CONFIG', config: { ...(patch || {}), numJugadores: n } });
    dispatch({ type: 'EMPEZAR', intro: !briefingVisto(cfg.variante) });
  }, [dispatch, layout.maxJugadores]);

  const partidaRapida = useCallback(() => {
    empezar({ fuente: { tipo: 'RAPIDAS', operaciones: ['suma', 'resta'], nivel: 1 }, numJugadores: 1, mandos: false, duracion: 0 });
  }, [empezar]);

  // ── Eventos del motor → sonidos + feedback en el mando + reducer ──
  const onEventos = useCallback((jid, eventos, pregunta) => {
    const piloto = configRef.current.mandos ? ctrlRef.current.pilotos[jid] : null;
    for (const ev of eventos) {
      if (ev.tipo === 'ALIEN_DESTRUIDO' || ev.tipo === 'FALSA_DESTRUIDA') sfx.explosion();
      else if (ev.tipo === 'RESPUESTA_ERRONEA') sfx.error();
      else if (ev.tipo === 'ALIEN_ATERRIZA' || ev.tipo === 'CORRECTA_DESTRUIDA') sfx.vida();
      else if (ev.tipo === 'CORRECTA_A_SALVO') (ev.escapadas ? sfx.vida : sfx.salvado)();
      if (piloto != null) {
        // Carita feliz / triste en la pantalla del mando
        if (ev.tipo === 'ALIEN_DESTRUIDO' || (ev.tipo === 'CORRECTA_A_SALVO' && !ev.escapadas)) feedbackMando(piloto, true);
        else if (ev.tipo === 'RESPUESTA_ERRONEA' || ev.tipo === 'ALIEN_ATERRIZA' || ev.tipo === 'CORRECTA_DESTRUIDA') feedbackMando(piloto, false);
      }
    }
    dispatch({ type: 'EVENTOS', jugador: jid, eventos, pregunta });
  }, [dispatch]);

  const onMundo = useCallback((jid, mundo) => {
    if (!mundo.disparo) return;
    sfx.disparo();
    const inp = inputsRef.current[jid];
    if (inp?.pendiente) inp.pendiente -= 1;
  }, []);

  useGameLoop({
    activo: fase === 'jugando', varianteRef, mundosRef, inputsRef, jugadoresRef, ctxDe, onEventos, onMundo,
  });

  // ── Acciones de los controles (táctiles, teclado y mandos) ──
  const acciones = useMemo(() => {
    const input = (jid, patch) => {
      const inp = inputsRef.current[jid] || (inputsRef.current[jid] = {});
      const { toque, ...resto } = patch;
      if (toque) inp.pendiente = Math.min(3, (inp.pendiente || 0) + 1);
      Object.assign(inp, resto);
    };
    const fuego = (jid, entradaForzada = null) => {
      if (faseRef.current !== 'jugando') return;
      const j = jugadoresRef.current[jid];
      const v = varianteRef.current;
      if (!j || j.eliminado) return;
      if (!v.alFuego) { input(jid, { toque: true }); return; }
      const m = mundosRef.current[jid];
      const ctx = ctxDe(j);
      const { mundo, eventos } = v.alFuego(m, ctx, entradaForzada ?? j.entrada);
      mundosRef.current[jid] = mundo;
      if (mundo.laser && !m.laser) sfx.laser();
      if (eventos.length) onEventos(jid, eventos, ctx.pregunta);
    };
    return {
      input,
      fuego,
      tecla: (jid, t) => {
        if (faseRef.current !== 'jugando') return;
        sfx.tecla();
        dispatch({ type: 'TECLA', jugador: jid, tecla: t });
      },
      elegir: (jid, k) => {
        if (faseRef.current !== 'jugando') return;
        const o = preguntaDe(jugadoresRef.current[jid])?.opciones?.[k];
        if (o != null) { sfx.tecla(); dispatch({ type: 'TECLA', jugador: jid, tecla: { elegir: o } }); }
      },
      /** Respuesta enviada desde un mando: se ve en pantalla y se dispara a la vez. */
      responder: (jid, texto) => {
        if (faseRef.current !== 'jugando' || texto == null) return;
        dispatch({ type: 'TECLA', jugador: jid, tecla: { elegir: texto } });
        fuego(jid, texto);
      },
    };
  }, [dispatch, preguntaDe, ctxDe, onEventos]);

  // Eventos de los mandos → acciones de la zona que pilotan
  const paradaRef = useRef({});
  const botonARef = useRef({});
  useEffect(() => {
    if (!config.mandos) return undefined;
    const manejador = ctrlMandos.manejadorRef;
    manejador.current = (idx, ev) => {
      if (faseRef.current !== 'jugando' || idx >= jugadoresRef.current.length) return;
      if (configRef.current.variante === 'FILTRO') {
        if (ev.accion === 'V') {
          // volante (mandos v6+): se mueve mientras siga inclinado; si deja de llegar, para solo
          acciones.input(idx, { izq: ev.dir.includes('I'), der: ev.dir.includes('D'), objetivoX: null });
          clearTimeout(paradaRef.current[idx]);
          paradaRef.current[idx] = setTimeout(() => acciones.input(idx, { izq: false, der: false }), 1200);
        } else if (ev.accion === 'P') {
          // fútbol (mandos v5): cada inclinación da un empujón
          const x = mundosRef.current[idx]?.nave.x ?? 0.5;
          if (ev.dir === 'I') acciones.input(idx, { objetivoX: Math.max(0.05, x - 0.22) });
          if (ev.dir === 'D') acciones.input(idx, { objetivoX: Math.min(0.95, x + 0.22) });
        } else if (ev.accion === 'S') {
          acciones.input(idx, { toque: true });
        } else if (ev.accion === 'A' || ev.accion === 'B') {
          // el mando repite «pulsado» cada 400 ms: solo cuenta el momento de pulsar
          const k = `${ev.id}${ev.accion}`;
          if (ev.on && !botonARef.current[k]) acciones.input(idx, { toque: true });
          botonARef.current[k] = ev.on;
        }
        return;
      }
      const p = preguntaDe(jugadoresRef.current[idx]);
      if (ev.tipo === 'letra') acciones.responder(idx, p?.opciones?.['ABCD'.indexOf(ev.letra)]);
      else if (ev.tipo === 'numero') acciones.responder(idx, fmtNum(ev.numero));
    };
    return () => { manejador.current = null; };
  }, [config.mandos, ctrlMandos.manejadorRef, acciones, preguntaDe]);

  // Callbacks estables por jugador (los paneles van con memo)
  const porJugador = useMemo(() => [0, 1, 2, 3].map((i) => ({
    onTecla: (t) => acciones.tecla(i, t),   // dígito, letra, DEL/CLR/± o { elegir: opción }
    onFuego: () => acciones.fuego(i),
  })), [acciones]);

  useControlesTeclado({
    activo: fase === 'jugando',
    variante: config.variante,
    numJugadores: jugadores.length,
    modoDe: (j) => modoTeclado(preguntaDe(jugadoresRef.current[j]), configRef.current.escribir, respuestaMandos(configRef.current)),
    acciones,
  });

  // ── Cuenta atrás 3-2-1 ──
  useEffect(() => {
    if (fase !== 'cuenta') return undefined;
    let k = 3;
    setCuenta(3);
    sfx.cuenta(false);
    const id = setInterval(() => {
      k -= 1;
      setCuenta(k);
      if (k > 0) sfx.cuenta(false);
      else if (k === 0) sfx.cuenta(true);
      else { clearInterval(id); dispatch({ type: 'FASE', fase: 'jugando' }); }
    }, 750);
    return () => clearInterval(id);
  }, [fase, s.partida, dispatch]);

  // ── Reloj de partida ──
  useEffect(() => {
    if (fase !== 'jugando' || !config.duracion) return undefined;
    const id = setInterval(() => dispatch({ type: 'TIEMPO' }), 1000);
    return () => clearInterval(id);
  }, [fase, config.duracion, dispatch]);
  useEffect(() => { if (config.duracion && s.restante === 0 && fase === 'fin') setPorTiempo(true); }, [s.restante, fase, config.duracion]);

  // ── Pausa automática si se cambia de pestaña ──
  useEffect(() => {
    const on = () => { if (document.hidden && faseRef.current === 'jugando') dispatch({ type: 'FASE', fase: 'pausa' }); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [dispatch]);

  // ── Cambios de cada zona: sonido de nivel, estadísticas por mando y turnos ──
  const previoRef = useRef({ partida: 0, zonas: [] });
  useEffect(() => {
    // en una partida nueva no se compara con la anterior
    const previo = previoRef.current.partida === s.partida ? previoRef.current.zonas : [];
    let subio = false;
    jugadores.forEach((j, i) => {
      const a = previo[i];
      if (!a) return;
      if (j.nivel > a.nivel) subio = true;
      if (!config.mandos) return;
      const id = ctrlRef.current.pilotos[i];
      const dPuntos = j.puntos - a.puntos;
      const dAciertos = j.aciertos - a.aciertos;
      const dFallos = j.fallos - a.fallos;
      if (id != null && (dPuntos || dAciertos || dFallos)) {
        const st = statsMandosRef.current[id] || { aciertos: 0, fallos: 0, intentos: 0, puntos: 0 };
        statsMandosRef.current[id] = {
          aciertos: st.aciertos + dAciertos, fallos: st.fallos + dFallos,
          intentos: st.intentos + dAciertos + dFallos, puntos: st.puntos + dPuntos,
        };
      }
      // Turnos: al pasar a la siguiente pregunta, el mando de esa zona pasa al siguiente alumno
      if (config.turnos && j.cursor > a.cursor && !j.eliminado) ctrlRef.current.siguientePiloto(i);
    });
    previoRef.current = {
      partida: s.partida,
      zonas: jugadores.map((j) => ({ nivel: j.nivel, puntos: j.puntos, aciertos: j.aciertos, fallos: j.fallos, cursor: j.cursor })),
    };
    if (subio) sfx.nivel();
  }, [jugadores, config.mandos, config.turnos, s.partida]);

  // ── Fin de partida: resumen, récord y registro local («Mis registros» y el icono Pi de la tarjeta) ──
  const registradaRef = useRef(0);
  useEffect(() => {
    if (fase !== 'fin' || registradaRef.current === s.partida) return;
    registradaRef.current = s.partida;
    sfx.fin();
    const lista = jugadores.map((j) => ({ ...resumenJugador(j, config), id: j.id, color: j.color }));
    setResumenes(lista);
    setRecord(actualizarRecord(config, Math.max(0, ...lista.map((r) => r.puntos))));
    if (config.mandos) {
      setMandosFilas(Object.entries(statsMandosRef.current).map(([id, st]) => ({
        id: Number(id), nombre: ctrlRef.current.nombreDe(Number(id)), ...st,
      })));
    }
    const aciertos = lista.reduce((a, r) => a + r.aciertos, 0);
    const intentos = lista.reduce((a, r) => a + r.intentos, 0);
    guardarRegistroLocal(TIPO_JUEGO, {
      titulo: tituloPartida(config), aciertos, intentos,
      nombre: lista.length === 1 ? lista[0].nombre : lista.map((r) => `${r.nombre} ${r.puntos}`).join(' · '),
      via: 'local',
    });
  }, [fase, s.partida, jugadores, config]);

  const alternarSonido = () => { const v = !sonido; setSonido(v); setSonidoActivo(v); };
  const pantallaCompleta = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else raizRef.current?.requestFullscreen?.();
    } catch { /* sin soporte */ }
  };
  // ── Ficha PDF vinculada: semilla → mismas preguntas y mismo orden en el papel y en la partida ──
  const [fichas, setFichas] = useState(() => fichasRecientes());
  const [cargandoFicha, setCargandoFicha] = useState(false);

  /** Abre una ficha (código del QR o de «fichas impresas»): regenera sus preguntas y las vincula. */
  const abrirFicha = useCallback(async (codigo) => {
    const ficha = decodificarFicha(codigo);
    if (!ficha) { setError('El código de la ficha no es válido.'); return; }
    setCargandoFicha(true);
    try {
      const { fuente, apiMates } = await resolverFicha(ficha);
      const cfg = { ...configRef.current, variante: ficha.v === 'FILTRO' ? 'FILTRO' : 'DISPARA', fuente, mandos: !!ficha.m, mandosRespuesta: ficha.mr || 'letras' };
      const preguntas = preguntasConSemilla(cfg, apiMates, ficha.s, ficha.n);
      if (!preguntas.length) throw new Error('No se han podido recuperar las preguntas de esta ficha.');
      setError('');
      dispatch({ type: 'CONFIG', config: {
        variante: cfg.variante, fuente,
        ficha: { codigo, semilla: ficha.s, titulo: ficha.t || '', preguntas: numerar(preguntas), enlace: enlaceFicha(codigo) },
      } });
    } catch (e) {
      setError(e?.message || 'No se pudo abrir la ficha.');
    } finally {
      setCargandoFicha(false);
    }
  }, [dispatch]);

  // /invasores?ficha=… (QR de la ficha impresa)
  useEffect(() => {
    const codigo = fichaDeUrl();
    if (codigo) abrirFicha(codigo);
  }, [abrirFicha]);

  const quitarFicha = useCallback(() => dispatch({ type: 'CONFIG', config: { ficha: null } }), [dispatch]);
  const olvidarFicha = useCallback((codigo) => { olvidarFichaReciente(codigo); setFichas(fichasRecientes()); }, []);

  const generarPdf = useCallback(async ({ n, oscuro, soluciones }) => {
    const cfg = configRef.current;
    let { ficha } = cfg;
    let preguntas;
    if (ficha) {
      // Ya vinculada: se reimprime la MISMA ficha (mismo QR)
      preguntas = ficha.preguntas;
    } else {
      const semilla = nuevaSemilla();
      preguntas = preguntasConSemilla(cfg, apiMatesRef.current, semilla, n);
      const f = await fuenteSerializable(cfg.fuente, apiMatesRef.current);
      const titulo = tituloPartida(cfg).split(' · ').slice(1).join(' · ').slice(0, 60);
      if (f && preguntas.length) {
        const codigo = codificarFicha({ v: cfg.variante, f, s: semilla, n: preguntas.length, m: cfg.mandos ? 1 : 0, mr: cfg.mandosRespuesta, t: titulo });
        ficha = { codigo, semilla, titulo, preguntas: numerar(preguntas), enlace: enlaceFicha(codigo) };
      }
    }
    if (!preguntas.length) throw new Error('No hay preguntas para la ficha.');
    const { generarPdfInvasores } = await import('./pdfInvasores');
    await generarPdfInvasores({
      preguntas, titulo: tituloPartida(cfg), variante: cfg.variante, oscuro, soluciones,
      qrUrl: ficha?.enlace || `${window.location.origin}/invasores`, vinculada: !!ficha,
    });
    if (ficha && !cfg.ficha) {
      // La partida queda vinculada a la ficha que se acaba de descargar
      dispatch({ type: 'CONFIG', config: { ficha } });
      guardarFichaReciente({ codigo: ficha.codigo, titulo: ficha.titulo, n: preguntas.length });
      setFichas(fichasRecientes());
    }
  }, [dispatch]);
  const maxPreguntasPdf = useMemo(() => {
    const f = config.fuente;
    if (config.ficha) return config.ficha.preguntas.length;
    if (f.tipo === 'RAPIDAS' || f.tipo === 'MATES') return null;
    try { return construirMazo(config, null).tamano; } catch { return 0; }
  }, [config]);

  const salir = () => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* nada */ } onExit?.(); };

  // ════════════════ Render ════════════════
  // Sin select-none en la raíz: en iOS impediría escribir en los campos del menú (los botones ya lo llevan)
  const raiz = 'inv-root fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-950 text-slate-100';

  if (fase === 'menu') {
    return (
      <div ref={raizRef} className={raiz}>
        <MenuArcade config={config} setConfig={setConfig} maxJugadores={layout.maxJugadores}
          apiMatesRef={apiMatesRef} onJugar={() => empezar()} onRapida={partidaRapida} onSalir={salir} error={error}
          onPdf={generarPdf} maxPreguntasPdf={maxPreguntasPdf}
          fichas={fichas} cargandoFicha={cargandoFicha} onAbrirFicha={abrirFicha} onQuitarFicha={quitarFicha} onOlvidarFicha={olvidarFicha}
          ctrlMandos={config.mandos ? ctrlMandos : null} />
      </div>
    );
  }

  if (fase === 'fin') {
    return (
      <div ref={raizRef} className={raiz}>
        <FinPartida resumenes={resumenes} config={config} titulo={tituloPartida(config)} porTiempo={porTiempo}
          record={record} mandosFilas={mandosFilas}
          onRevancha={() => empezar()} onMenu={() => dispatch({ type: 'MENU' })} onSalir={salir} />
      </div>
    );
  }

  const n = jugadores.length;
  const coop = n > 1 && config.modo === 'cooperativo';

  return (
    <div ref={raizRef} className={raiz}>
      {/* Barra superior */}
      <div className="flex items-center gap-2 border-b-2 border-slate-800 bg-slate-950 px-2 py-1.5 sm:px-3">
        <button type="button" onClick={() => dispatch({ type: 'FASE', fase: 'pausa' })} className={`${BTN.menu} px-3 py-2 text-[10px]`} title="Pausa">⏸</button>
        <h1 className={`${TITULO_NEON} truncate text-[10px] sm:text-xs`}>INVASIÓN π</h1>
        <span className="hidden truncate font-pixel text-lg text-slate-500 md:inline">{tituloPartida(config)}</span>
        <span className="flex-1" />
        {config.mandos && <ChipAntena />}
        {coop && (
          <span className="flex items-center gap-1 font-arcade text-[10px] text-rose-300">
            EQUIPO {Math.max(0, s.vidasEquipo) <= 7
              ? Array.from({ length: Math.max(0, s.vidasEquipo) }, (_, k) => <Corazon key={k} />)
              : <><Corazon />×{s.vidasEquipo}</>}
          </span>
        )}
        {config.duracion > 0 && (
          <span className={`font-arcade text-xs tabular-nums ${s.restante <= 10 ? 'animate-inv-parpadeo text-rose-400' : 'text-amber-300'}`}>⏱ {mmss(s.restante)}</span>
        )}
        <button type="button" onClick={alternarSonido} className={`${BTN.menu} px-3 py-2 text-[10px]`} title="Sonido">{sonido ? '🔊' : '🔇'}</button>
        <button type="button" onClick={pantallaCompleta} className={`${BTN.menu} hidden px-3 py-2 text-[10px] sm:block`} title="Pantalla completa">⛶</button>
      </div>

      {/* Zonas de los jugadores */}
      <div className={`grid min-h-0 flex-1 ${claseRejilla(n, layout.apaisado)} ${n > 1 ? 'gap-2 p-2' : ''}`}>
        {jugadores.map((j) => (
          <PlayerZone key={j.id} jugador={j} mundo={mundosRef.current[j.id]} variante={variante}
            pregunta={preguntaDe(j)} cooperativo={coop} escribir={config.escribir} unico={n === 1}
            mandos={config.mandos ? (config.variante === 'FILTRO' ? 'mover' : respMandos) : null}
            piloto={config.mandos ? <PilotoEnJuego ctrl={ctrlMandos} i={j.id} color={NEON[j.color].hex} /> : null}
            onTecla={porJugador[j.id].onTecla} onFuego={porJugador[j.id].onFuego} onInput={acciones.input} />
        ))}
      </div>

      {/* Briefing de la misión (la primera vez de cada variante) */}
      {fase === 'intro' && (
        <Briefing variante={config.variante} mandos={config.mandos ? (config.variante === 'FILTRO' ? 'mover' : respMandos) : null}
          numJugadores={n} onListo={() => { despertarAudioArcade(); dispatch({ type: 'FASE', fase: 'cuenta' }); }} />
      )}

      {/* Cuenta atrás */}
      {fase === 'cuenta' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60">
          <div key={cuenta} className="animate-inv-entrada font-arcade text-[length:clamp(48px,14vw,140px)] text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.95)]">
            {cuenta > 0 ? cuenta : '¡YA!'}
          </div>
        </div>
      )}

      {/* Pausa */}
      {fase === 'pausa' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/85">
          <div className={`${TITULO_NEON} text-2xl`}>PAUSA</div>
          <button type="button" onClick={() => dispatch({ type: 'FASE', fase: 'jugando' })} className={`${BTN.primario} text-sm`}>▶ CONTINUAR</button>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => dispatch({ type: 'FASE', fase: 'intro' })} className={`${BTN.menu} text-[10px]`}>❔ CÓMO SE JUEGA</button>
            <button type="button" onClick={() => dispatch({ type: 'FASE', fase: 'fin' })} className={`${BTN.menu} text-[10px]`}>🏁 TERMINAR</button>
            <button type="button" onClick={() => dispatch({ type: 'MENU' })} className={`${BTN.menu} text-[10px]`}>⚙️ MENÚ</button>
            <button type="button" onClick={salir} className={`${BTN.peligro} text-[10px]`}>✕ SALIR</button>
          </div>
        </div>
      )}
    </div>
  );
}

