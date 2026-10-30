// 🕺 Avatar en movimiento: muñecos 3D que copian en tiempo real el cuerpo que ve la
// webcam (MediaPipe Pose, en el navegador). Modos:
//   · 🪞 Espejo                → movimiento libre (1 o 2 personas).
//   · 🎯 Imita la postura      → 1 jugador: colocarse como la silueta.
//   · 👯 Imita a tu compañero  → 2 jugadores: el líder hace una postura (foto en 3-2-1) y el
//                                otro la copia; se turnan. Puntos con animación.
//   · 💃 Coreografía           → 1 o 2 jugadores siguen una secuencia de pasos al ritmo de la
//                                música (tipo Just Dance): ¡PERFECTO! / ¡GENIAL! / BIEN / FALLO.
// Jugador 1 = el que está a la IZQUIERDA de la pantalla (cian), jugador 2 = DERECHA (magenta).
// Se guarda en «Mis registros» (AVATAR_CUERPO).
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { escucharPose, escucharEstadoPose, reintentarPose, getVideoPose, setMaxPersonas, CONEXIONES_POSE, P } from './poseVision.js';
import {
  crearAvatarCuerpo,
  crearSuavizado,
  piernasVisibles,
  poseDesdeMundo,
  POSTURAS,
  REPOSO,
  poseDePostura,
  compararPostura,
  generarCoreografia,
  ESTILOS,
  ESTILO_DEF,
} from './avatarCuerpo.js';
import { crearRitmo } from './ritmo.js';
import { sonidoCorrecto, sonidoFinal, sonidoPasar } from '../utils/sonidosFeedback.js';
import { guardarRegistroLocal } from '../utils/registrosLocales.js';

const LS_ESTILO = 'pikt_avatar_cuerpo';

const MODOS = [
  { id: 'espejo', label: '🪞 Espejo', color: '#2563eb' },
  { id: 'juego', label: '🎯 Imita la postura', color: '#16a34a' },
  { id: 'pareja', label: '👯 Imita a tu compañero', color: '#ea580c' },
  { id: 'baile', label: '💃 Coreografía', color: '#db2777' },
];
const DOS_PERSONAS = { espejo: true, pareja: true, baile: true, juego: false };

const COLOR_J = ['#06b6d4', '#d946ef'];
const NOMBRE_J = ['Jugador 1', 'Jugador 2'];
const ESTILO_J2 = { piel: '#e0a77e', pelo: '#5b3a1e', camiseta: COLOR_J[1], pantalon: '#1e3a8a' };
const VERDE = '#22c55e';
const AMBAR = '#f59e0b';

// Imita la postura (1 jugador)
const POSTURAS_POR_PARTIDA = 10;
const TIEMPO_POSTURA_MS = 15000;
const MANTENER_MS = 1000;
const UMBRAL = 0.72;

// Imita a tu compañero
const RONDAS_PAREJA = 8;
const PREPARAR_MS = 4000;
const COPIAR_MS = 12000;
const RESULTADO_MS = 2200;
const UMBRAL_PAREJA = 0.72;
const MANTENER_PAREJA_MS = 800;

// Coreografía
const NIVELES_BAILE = {
  tranquila: { label: '🐢 Tranquila', bpm: 96, tiempos: 4, pasos: 16 },
  movida: { label: '🔥 Movida', bpm: 104, tiempos: 2, pasos: 24 },
};
const NOTAS = [
  { min: 0.85, txt: '¡PERFECTO!', pts: 100, color: '#facc15' },
  { min: 0.72, txt: '¡GENIAL!', pts: 70, color: '#22c55e' },
  { min: 0.55, txt: 'BIEN', pts: 40, color: '#38bdf8' },
  { min: -1, txt: 'FALLO', pts: 0, color: '#ef4444' },
];

const leerEstilo = () => {
  try {
    return { ...ESTILO_DEF, ...JSON.parse(localStorage.getItem(LS_ESTILO) || '{}') };
  } catch {
    return { ...ESTILO_DEF };
  }
};

const barajar = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

const centroX = (persona) => (persona.puntos[P.CADERA_I].x + persona.puntos[P.CADERA_D].x) / 2;

/** Reparte las personas detectadas entre los 2 huecos (0 = izquierda, 1 = derecha). */
function asignar(personas, modo) {
  if (!personas.length) return [null, null];
  if (!DOS_PERSONAS[modo]) return [personas[0], null];
  if (personas.length >= 2) return [personas[0], personas[1]];
  if (modo === 'espejo') return [personas[0], null];
  return centroX(personas[0]) < 0.5 ? [personas[0], null] : [null, personas[0]];
}

function useEstadoPose() {
  const [e, setE] = useState({ estado: 'apagado', error: '' });
  useEffect(() => escucharEstadoPose(setE), []);
  return e;
}

function tonoFoto() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1600, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.13);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    /* sin audio */
  }
}

export default function AvatarCuerpo({ onExit }) {
  const montaje = useRef(null);
  const camaraCanvas = useRef(null);
  const estadoPose = useEstadoPose();
  const [estilo, setEstilo] = useState(leerEstilo);
  const [verCamara, setVerCamara] = useState(true);
  const [modo, setModo] = useState('espejo');
  const [conPiernas, setConPiernas] = useState(false);
  const [hud, setHud] = useState({ personas: 0, piernas: false });
  const [juego, setJuego] = useState({ fase: 'menu' });
  const [pareja, setPareja] = useState({ fase: 'menu' });
  const [baile, setBaile] = useState({ fase: 'menu' });
  const [nivelBaile, setNivelBaile] = useState('tranquila');
  const [popups, setPopups] = useState([]);
  const [panelEstilo, setPanelEstilo] = useState(false);

  const vivo = useRef({});
  vivo.current = { ...vivo.current, modo, verCamara, estilo };
  const escena = useRef(null); // { slots }
  const partida = useRef(null); // Imita la postura
  const parejaRef = useRef(null);
  const baileRef = useRef(null);
  const popupId = useRef(0);

  const popup = (j, texto, color, grande = false) => {
    const id = popupId.current++;
    setPopups((p) => [...p, { id, j, texto, color, grande }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1500);
  };

  // Estilos de los avatares (en los modos de 2 se distinguen por el color de la camiseta)
  useEffect(() => {
    try {
      localStorage.setItem(LS_ESTILO, JSON.stringify(estilo));
    } catch {
      /* sin almacenamiento */
    }
    const s = escena.current?.slots;
    if (!s) return;
    const dos = modo === 'pareja' || modo === 'baile';
    s[0].avatar.colorear(dos ? { ...estilo, camiseta: COLOR_J[0] } : estilo);
    s[1].avatar.colorear(ESTILO_J2);
  }, [estilo, modo]);

  // 1 o 2 personas según el modo; al cambiar de modo se cancela lo que hubiera en marcha
  useEffect(() => {
    setMaxPersonas(DOS_PERSONAS[modo] ? 2 : 1);
    partida.current = null;
    parejaRef.current = null;
    baileRef.current?.ritmo?.parar();
    baileRef.current = null;
    setJuego({ fase: 'menu' });
    setPareja({ fase: 'menu' });
    setBaile({ fase: 'menu' });
  }, [modo]);

  useEffect(
    () => () => {
      setMaxPersonas(1);
      baileRef.current?.ritmo?.parar();
    },
    []
  );

  // ── Escena three.js + bucle ───────────────────────────────────────────────
  useEffect(() => {
    const cont = montaje.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    cont.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dbeafe');
    scene.fog = new THREE.Fog('#dbeafe', 9, 20);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    cam.position.set(0, 1.25, 4.6);

    scene.add(new THREE.HemisphereLight('#ffffff', '#94a3b8', 1.6));
    const sol = new THREE.DirectionalLight('#ffffff', 2);
    sol.position.set(2, 5, 4);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 3, bottom: -3 });
    scene.add(sol);

    const suelo = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 1 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);
    const rejilla = new THREE.GridHelper(14, 28, '#94a3b8', '#cbd5e1');
    rejilla.position.y = 0.002;
    scene.add(rejilla);

    const slots = [0, 1].map((i) => {
      const avatar = crearAvatarCuerpo(i === 0 ? vivo.current.estilo : ESTILO_J2);
      const fantasma = crearAvatarCuerpo({ piel: VERDE, camiseta: VERDE, pantalon: VERDE, pelo: VERDE }, { fantasma: true });
      fantasma.grupo.visible = false;
      scene.add(avatar.grupo, fantasma.grupo);
      return { avatar, fantasma, suav: crearSuavizado(0.45), x: 0, y: 0, pose: null, piernas: false, fPostura: null };
    });
    escena.current = { slots };

    let aspecto = 1;
    const ajustar = () => {
      const w = cont.clientWidth;
      const h = cont.clientHeight;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      aspecto = w / h;
      cam.updateProjectionMatrix();
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(cont);

    let ultimas = [];
    let tUltima = 0;
    const baja = escucharPose((_, personas) => {
      ultimas = personas || [];
      if (ultimas.length) tUltima = performance.now();
    });

    let raf = 0;
    let tHud = 0;
    const bucle = (ahora) => {
      raf = requestAnimationFrame(bucle);
      const v = vivo.current;
      const dos = v.modo === 'pareja' || v.modo === 'baile';
      const personas = ahora - tUltima < 600 ? ultimas : [];
      const [p0, p1] = asignar(personas, v.modo);

      // Cámara: más lejos con dos jugadores o pantalla estrecha
      const zObj = (dos || p1 ? 6.2 : 4.6) * (aspecto < 0.9 ? 1.35 : 1);
      cam.position.z += (zObj - cam.position.z) * 0.08;
      cam.lookAt(0, 0.95, 0);

      let piernasAlguno = false;
      [p0, p1].forEach((per, i) => {
        const s = slots[i];
        s.fantasma.grupo.visible = false;
        const visible = i === 0 || dos || !!per;
        s.avatar.grupo.visible = visible;
        const mundo = s.suav(per?.mundo || null);
        let xObj;
        if (per && mundo) {
          s.piernas = piernasVisibles(per.puntos);
          piernasAlguno = piernasAlguno || s.piernas;
          s.pose = poseDesdeMundo(mundo, s.piernas);
          s.avatar.aplicarPose(s.pose);
          xObj = v.modo === 'juego' ? 0 : dos ? (i === 0 ? -0.95 : 0.95) : (centroX(per) - 0.5) * (p1 ? 3.6 : 2.4);
        } else {
          s.pose = null;
          s.piernas = false;
          s.avatar.reposo();
          xObj = dos ? (i === 0 ? -0.95 : 0.95) : 0;
        }
        s.x += (xObj - s.x) * 0.2;
        s.avatar.grupo.position.x = s.x;
        s.y += (-s.avatar.alturaPies() - s.y) * 0.3;
        s.avatar.grupo.position.y = s.y;
      });

      if (v.modo === 'juego' && partida.current?.fase === 'jugando') tickJuego(slots[0], ahora);
      if (v.modo === 'pareja' && parejaRef.current) tickPareja(slots, ahora);
      if (v.modo === 'baile' && baileRef.current) tickBaile(slots, ahora);

      renderer.render(scene, cam);
      if (v.verCamara) dibujarCamara(personas, dos || personas.length > 1);

      if (ahora - tHud > 150) {
        tHud = ahora;
        const n = (p0 ? 1 : 0) + (p1 ? 1 : 0);
        setHud((h) => (h.personas === n && h.piernas === piernasAlguno ? h : { personas: n, piernas: piernasAlguno }));
      }
    };
    raf = requestAnimationFrame(bucle);

    return () => {
      cancelAnimationFrame(raf);
      baja();
      ro.disconnect();
      slots.forEach((s) => {
        s.avatar.liberar();
        s.fantasma.liberar();
      });
      suelo.geometry.dispose();
      suelo.material.dispose();
      rejilla.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      escena.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dibujarCamara(personas, colores) {
    const cv = camaraCanvas.current;
    const vid = getVideoPose();
    if (!cv || !vid) return;
    const ctx = cv.getContext('2d');
    const w = cv.width;
    const h = cv.height;
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(vid, 0, 0, w, h);
    ctx.restore();
    personas.forEach((persona, i) => {
      const pt = persona.puntos;
      ctx.lineWidth = 3;
      ctx.strokeStyle = colores ? COLOR_J[i % 2] : VERDE;
      CONEXIONES_POSE.forEach(([a, b]) => {
        if (pt[a].v < 0.5 || pt[b].v < 0.5) return;
        ctx.beginPath();
        ctx.moveTo(pt[a].x * w, pt[a].y * h);
        ctx.lineTo(pt[b].x * w, pt[b].y * h);
        ctx.stroke();
      });
    });
    if (colores) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** Silueta objetivo sobre el avatar de un hueco, del color indicado. */
  function ponerFantasma(s, postura, color) {
    if (s.fPostura !== postura) {
      s.fantasma.aplicarPose(poseDePostura(postura));
      s.fantasma.grupo.position.y = 0;
      s.fantasma.grupo.position.y = -s.fantasma.alturaPies();
      s.fPostura = postura;
    }
    s.fantasma.grupo.position.x = s.avatar.grupo.position.x;
    s.fantasma.grupo.visible = true;
    const m = s.fantasma.materiales;
    m.camiseta.color.set(color);
    [m.piel, m.pantalon, m.pelo].forEach((x) => x.color.copy(m.camiseta.color));
  }

  // ── 🎯 Imita la postura (1 jugador) ───────────────────────────────────────
  function tickJuego(s, ahora) {
    const pj = partida.current;
    const postura = pj.lista[pj.idx];
    let punt = 0;
    if (s.pose) punt = compararPostura(s.pose, postura).puntuacion;
    pj.punt += (punt - pj.punt) * 0.3;
    const ok = pj.punt >= UMBRAL;
    ponerFantasma(s, postura, ok ? VERDE : AMBAR);
    if (ok) {
      if (!pj.desde) pj.desde = ahora;
    } else pj.desde = 0;
    const restante = Math.max(0, Math.min(TIEMPO_POSTURA_MS, TIEMPO_POSTURA_MS - (ahora - pj.inicio)));
    const mantenido = pj.desde ? Math.min(1, (ahora - pj.desde) / MANTENER_MS) : 0;

    if (mantenido >= 1 || restante <= 0) {
      const acierto = mantenido >= 1;
      if (acierto) {
        pj.aciertos++;
        const pts = 100 + Math.round(restante / 100);
        pj.puntos += pts;
        sonidoCorrecto();
        popup(0, `+${pts}`, VERDE, true);
      } else sonidoPasar();
      pj.idx++;
      pj.desde = 0;
      pj.punt = 0;
      pj.inicio = ahora;
      if (pj.idx >= pj.lista.length) {
        pj.fase = 'fin';
        sonidoFinal();
        guardarRegistroLocal('AVATAR_CUERPO', {
          titulo: `Imita la postura${pj.conPiernas ? ' (cuerpo entero)' : ''}`,
          aciertos: pj.aciertos,
          intentos: pj.lista.length,
          porcentaje: Math.round((pj.aciertos / pj.lista.length) * 100),
          puntos: pj.puntos,
          via: 'webcam',
        });
        setJuego({ fase: 'fin', aciertos: pj.aciertos, total: pj.lista.length, puntos: pj.puntos });
        return;
      }
    }
    if (ahora - pj.tUi > 100) {
      pj.tUi = ahora;
      setJuego({ fase: 'jugando', postura: pj.lista[pj.idx], n: pj.idx + 1, total: pj.lista.length, restante, mantenido, punt: pj.punt, puntos: pj.puntos });
    }
  }

  const empezarJuego = () => {
    const pool = POSTURAS.filter((p) => conPiernas || !p.piernas);
    const lista = [];
    while (lista.length < POSTURAS_POR_PARTIDA) lista.push(...barajar(pool));
    partida.current = { fase: 'jugando', lista: lista.slice(0, POSTURAS_POR_PARTIDA), idx: 0, inicio: performance.now() + 1500, desde: 0, punt: 0, puntos: 0, aciertos: 0, tUi: 0, conPiernas };
    setJuego({ fase: 'jugando', postura: partida.current.lista[0], n: 1, total: POSTURAS_POR_PARTIDA, restante: TIEMPO_POSTURA_MS, mantenido: 0, punt: 0, puntos: 0 });
  };

  // ── 👯 Imita a tu compañero ───────────────────────────────────────────────
  function tickPareja(slots, ahora) {
    const pj = parejaRef.current;
    if (pj.fase === 'fin') return;
    const l = pj.lider;
    const f = 1 - l;
    const lider = slots[l];
    const seg = slots[f];
    let cuenta = 0;
    let restante = 0;

    if (pj.fase === 'preparar') {
      if (pj.msgHasta && ahora > pj.msgHasta) {
        pj.msg = '';
        pj.msgHasta = 0;
      }
      if (!lider.pose || !seg.pose) {
        pj.t0 = ahora;
        pj.msg = '👀 Poneos los dos delante de la cámara, uno a cada lado';
      } else if (pj.msg.startsWith('👀')) pj.msg = '';
      const rest = PREPARAR_MS - (ahora - pj.t0);
      cuenta = Math.max(1, Math.ceil(rest / 1000));
      if (rest <= 0) {
        if (compararPostura(lider.pose, REPOSO).puntuacion > 0.7) {
          pj.t0 = ahora + 1000; // un poco más de tiempo para pensar otra
          pj.msg = '😴 ¡Esa es muy fácil! Mueve los brazos y haz una postura divertida';
          pj.msgHasta = ahora + 2500;
          sonidoPasar();
        } else {
          const piernas = lider.piernas && seg.piernas;
          pj.objetivo = {
            id: `lider${pj.ronda}`,
            brazoI: lider.pose.brazoI,
            brazoD: lider.pose.brazoD,
            ...(piernas ? { piernaI: lider.pose.piernaI, piernaD: lider.pose.piernaD, piernas: true } : {}),
          };
          tonoFoto();
          pj.fase = 'copiar';
          pj.t0 = ahora;
          pj.parecido = 0;
          pj.mejor = 0;
          pj.desde = 0;
          pj.msg = '';
        }
      }
    } else if (pj.fase === 'copiar') {
      const p = seg.pose ? compararPostura(seg.pose, pj.objetivo).puntuacion : 0;
      pj.parecido += (p - pj.parecido) * 0.3;
      pj.mejor = Math.max(pj.mejor, pj.parecido);
      const ok = pj.parecido >= UMBRAL_PAREJA;
      ponerFantasma(seg, pj.objetivo, ok ? VERDE : AMBAR);
      if (ok) {
        if (!pj.desde) pj.desde = ahora;
      } else pj.desde = 0;
      restante = Math.max(0, COPIAR_MS - (ahora - pj.t0));
      const mantenido = pj.desde ? (ahora - pj.desde) / MANTENER_PAREJA_MS : 0;
      if (mantenido >= 1) {
        const pts = 100 + Math.round(restante / 100);
        pj.puntos[f] += pts;
        pj.puntos[l] += 20;
        pj.aciertos[f]++;
        popup(f, `¡Copiado! +${pts}`, VERDE, true);
        popup(l, '👑 +20', COLOR_J[l]);
        sonidoCorrecto();
        pj.ultimo = { ok: true, pts, jugador: f };
        pj.fase = 'resultado';
        pj.t0 = ahora;
      } else if (restante <= 0) {
        const pts = Math.round(pj.mejor * 50);
        pj.puntos[f] += pts;
        popup(f, pts ? `Casi… +${pts}` : '¡Tiempo!', AMBAR, true);
        sonidoPasar();
        pj.ultimo = { ok: false, pts, jugador: f };
        pj.fase = 'resultado';
        pj.t0 = ahora;
      }
    } else if (pj.fase === 'resultado') {
      ponerFantasma(seg, pj.objetivo, pj.ultimo.ok ? VERDE : '#ef4444');
      if (ahora - pj.t0 > RESULTADO_MS) {
        pj.ronda++;
        if (pj.ronda >= RONDAS_PAREJA) {
          pj.fase = 'fin';
          sonidoFinal();
          const total = pj.aciertos[0] + pj.aciertos[1];
          guardarRegistroLocal('AVATAR_CUERPO', {
            titulo: `Imita a tu compañero · J1 ${pj.puntos[0]} – J2 ${pj.puntos[1]}`,
            aciertos: total,
            intentos: RONDAS_PAREJA,
            porcentaje: Math.round((total / RONDAS_PAREJA) * 100),
            via: 'webcam',
          });
          setPareja({ fase: 'fin', puntos: [...pj.puntos], aciertos: [...pj.aciertos] });
          return;
        }
        pj.lider = 1 - pj.lider;
        pj.fase = 'preparar';
        pj.t0 = ahora;
      }
    }

    if (ahora - pj.tUi > 100) {
      pj.tUi = ahora;
      setPareja({
        fase: pj.fase,
        ronda: pj.ronda + 1,
        lider: pj.lider,
        cuenta,
        restante,
        parecido: pj.parecido || 0,
        msg: pj.msg,
        puntos: [...pj.puntos],
        ultimo: pj.ultimo,
      });
    }
  }

  const empezarPareja = () => {
    parejaRef.current = { fase: 'preparar', ronda: 0, lider: 0, t0: performance.now(), msg: '', puntos: [0, 0], aciertos: [0, 0], parecido: 0, tUi: 0, ultimo: null };
    setPareja({ fase: 'preparar', ronda: 1, lider: 0, cuenta: 4, puntos: [0, 0], msg: '' });
  };

  // ── 💃 Coreografía ───────────────────────────────────────────────────────
  function evaluarPaso(pb) {
    [0, 1].forEach((i) => {
      if (!pb.presente[i]) return;
      const nota = NOTAS.find((n) => pb.mejor[i] >= n.min);
      const pts = nota.pts ? Math.round(nota.pts * (1 + 0.1 * Math.min(pb.combo[i], 10))) : 0;
      pb.combo[i] = nota.pts >= 40 ? pb.combo[i] + 1 : 0;
      pb.puntos[i] += pts;
      pb.notas[i][nota.txt] = (pb.notas[i][nota.txt] || 0) + 1;
      popup(i, `${nota.txt}${pts ? ` +${pts}` : ''}`, nota.color, true);
    });
  }

  function tickBaile(slots, ahora) {
    const pb = baileRef.current;
    if (pb.fase !== 'bailando') return;
    const beat = pb.ritmo.beat();
    const pasos = pb.pasos;
    const ultimo = pasos[pasos.length - 1];
    let idx = beat >= ultimo.inicio + ultimo.tiempos ? pasos.length : pasos.findIndex((p) => beat >= p.inicio && beat < p.inicio + p.tiempos);
    if (idx !== pb.idx) {
      if (pb.idx >= 0 && pb.idx < pasos.length) evaluarPaso(pb);
      pb.idx = idx;
      pb.mejor = [0, 0];
    }
    if (idx >= pasos.length) {
      pb.fase = 'fin';
      pb.ritmo.parar();
      sonidoFinal();
      const jugadores = [0, 1].filter((i) => pb.presente[i]);
      const buenos = jugadores.reduce((a, i) => a + pasos.length - (pb.notas[i].FALLO || 0), 0);
      const intentos = Math.max(1, jugadores.length * pasos.length);
      guardarRegistroLocal('AVATAR_CUERPO', {
        titulo: `Coreografía ${NIVELES_BAILE[pb.nivel].label}` + (jugadores.length > 1 ? ` · J1 ${pb.puntos[0]} – J2 ${pb.puntos[1]}` : ` · ${pb.puntos[jugadores[0] ?? 0]} pts`),
        aciertos: buenos,
        intentos,
        porcentaje: Math.round((buenos / intentos) * 100),
        via: 'webcam',
      });
      setBaile({ fase: 'fin', puntos: [...pb.puntos], notas: pb.notas.map((n) => ({ ...n })), presente: [...pb.presente], total: pasos.length });
      return;
    }

    // Siluetas del paso actual sobre los dos avatares (o del primero, en la cuenta de entrada)
    const paso = pasos[Math.max(0, idx)];
    const progreso = idx >= 0 ? (beat - paso.inicio) / paso.tiempos : 0;
    slots.forEach((s, i) => {
      let sc = 0;
      if (s.pose) {
        pb.presente[i] = true;
        sc = compararPostura(s.pose, paso.postura).puntuacion;
        if (idx >= 0 && progreso >= 0.3) pb.mejor[i] = Math.max(pb.mejor[i], sc);
      }
      ponerFantasma(s, paso.postura, sc >= 0.72 ? VERDE : AMBAR);
    });

    if (ahora - pb.tUi > 80) {
      pb.tUi = ahora;
      setBaile({
        fase: 'bailando',
        idx,
        progreso,
        cuenta: beat < 4 ? Math.max(1, 4 - Math.floor(beat)) : 0,
        puntos: [...pb.puntos],
        combo: [...pb.combo],
        presente: [...pb.presente],
      });
    }
  }

  const empezarBaile = () => {
    const nv = NIVELES_BAILE[nivelBaile];
    const pasos = generarCoreografia({ pasos: nv.pasos, tiempos: nv.tiempos, piernas: conPiernas });
    const ritmo = crearRitmo(nv.bpm);
    ritmo.empezar();
    baileRef.current = { fase: 'bailando', nivel: nivelBaile, ritmo, pasos, idx: -1, mejor: [0, 0], presente: [false, false], puntos: [0, 0], combo: [0, 0], notas: [{}, {}], tUi: 0 };
    setBaile({ fase: 'bailando', idx: -1, progreso: 0, cuenta: 4, puntos: [0, 0], combo: [0, 0], presente: [false, false] });
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  const boton = (activo, color = '#2563eb') => ({
    padding: '7px 12px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 800,
    fontSize: '0.82rem',
    cursor: 'pointer',
    background: activo ? color : 'rgba(255,255,255,0.9)',
    color: activo ? '#fff' : '#1e293b',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  });
  const tarjeta = { background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' };

  const dos = modo === 'pareja' || modo === 'baile';
  const jugandoPareja = modo === 'pareja' && pareja.fase !== 'menu' && pareja.fase !== 'fin';
  const jugandoBaile = modo === 'baile' && baile.fase === 'bailando';

  const aviso =
    estadoPose.estado === 'error'
      ? null
      : estadoPose.estado !== 'listo'
        ? '⏳ Preparando la cámara y el reconocimiento del cuerpo…'
        : hud.personas === 0
          ? dos
            ? '🙈 No os veo: poneos delante de la cámara, a 2-3 metros, uno a cada lado'
            : '🙈 No te veo: ponte delante de la cámara, a 2-3 metros'
          : modo === 'pareja' && hud.personas < 2
            ? '👯 Falta el compañero: poneos uno a cada lado'
            : (modo === 'juego' || modo === 'baile') && conPiernas && !hud.piernas
              ? '🦵 Alejaos un poco: necesito veros las piernas'
              : '';

  // Función (no componente): así el número solo «bota» cuando cambian los puntos.
  const marcador = (i, puntos, combo = 0, apagado = false) => (
    <div key={`marcador${i}`} style={{ position: 'absolute', top: 58, [i === 0 ? 'left' : 'right']: 10, background: 'rgba(255,255,255,0.95)', borderRadius: 14, padding: '6px 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.15)', borderLeft: i === 0 ? `6px solid ${COLOR_J[0]}` : 'none', borderRight: i === 1 ? `6px solid ${COLOR_J[1]}` : 'none', opacity: apagado ? 0.45 : 1, textAlign: i === 0 ? 'left' : 'right', minWidth: 110 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: COLOR_J[i] }}>{NOMBRE_J[i]}</div>
      <div key={puntos} style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.05, animation: 'pikt-bote 0.35s ease-out' }}>
        {puntos}
      </div>
      {combo > 1 && <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ea580c' }}>🔥 racha ×{combo}</div>}
    </div>
  );

  const pasosBaile = baileRef.current?.pasos || [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#dbeafe', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes pikt-sube { 0% { opacity: 0; transform: translate(-50%, 12px) scale(0.7); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1.15); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -70px) scale(1); } }
        @keyframes pikt-bote { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
        @keyframes pikt-latido { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.12); } }
      `}</style>
      <div ref={montaje} style={{ position: 'absolute', inset: 0 }} />

      {/* Barra superior */}
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={onExit} style={boton(false)}>
          ← Volver
        </button>
        <div style={{ fontWeight: 900, color: '#1e3a8a', fontSize: '1.05rem', marginRight: 4 }}>🕺 Avatar en movimiento</div>
        {MODOS.map((m) => (
          <button key={m.id} onClick={() => setModo(m.id)} style={boton(modo === m.id, m.color)}>
            {m.label}
          </button>
        ))}
        <button onClick={() => setPanelEstilo((v) => !v)} style={boton(panelEstilo, '#7c3aed')}>
          🎨
        </button>
        <button onClick={() => setVerCamara((v) => !v)} style={boton(verCamara, '#0f172a')}>
          📷
        </button>
      </div>

      {/* Personalizar */}
      {panelEstilo && (
        <div style={{ position: 'absolute', top: 58, right: 10, ...tarjeta, padding: 12, width: 230, zIndex: 5 }}>
          {[
            ['piel', 'Piel'],
            ['pelo', 'Pelo'],
            ['camiseta', 'Camiseta'],
            ['pantalon', 'Pantalón'],
          ].map(([k, label]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>{label}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {ESTILOS[k].map((c) => (
                  <button
                    key={c}
                    onClick={() => setEstilo((e) => ({ ...e, [k]: c }))}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: estilo[k] === c ? '3px solid #2563eb' : '2px solid #e2e8f0' }}
                    aria-label={`${label} ${c}`}
                  />
                ))}
              </div>
            </div>
          ))}
          {dos && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>En los modos de dos, las camisetas son cian (jugador 1) y magenta (jugador 2).</div>}
        </div>
      )}

      {/* Vista de la cámara */}
      <div style={{ position: 'absolute', left: 10, bottom: 10, display: verCamara ? 'block' : 'none', zIndex: 2 }}>
        <canvas ref={camaraCanvas} width={320} height={180} style={{ width: 'min(240px, 38vw)', borderRadius: 10, background: '#0f172a', display: 'block', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }} />
      </div>

      {/* Avisos */}
      {estadoPose.estado === 'error' && (
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', ...tarjeta, textAlign: 'center', maxWidth: 340 }}>
          <div style={{ color: '#dc2626', fontWeight: 800 }}>⚠️ {estadoPose.error}</div>
          <button onClick={reintentarPose} style={{ ...boton(true, '#dc2626'), marginTop: 10 }}>
            Reintentar
          </button>
        </div>
      )}
      {aviso && !jugandoPareja && (
        <div style={{ position: 'absolute', top: dos ? 140 : 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.85)', color: '#fff', borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', maxWidth: '90vw', zIndex: 3 }}>
          {aviso}
        </div>
      )}

      {/* Puntos flotantes */}
      {popups.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: dos ? (p.j === 0 ? '28%' : '72%') : '50%',
            top: '34%',
            transform: 'translateX(-50%)',
            color: p.color,
            fontWeight: 900,
            fontSize: p.grande ? 'clamp(1.6rem, 5vw, 2.8rem)' : '1.3rem',
            textShadow: '0 3px 0 #0f172a, 0 0 18px rgba(255,255,255,0.8)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'pikt-sube 1.5s ease-out forwards',
            zIndex: 6,
          }}
        >
          {p.texto}
        </div>
      ))}

      {/* ── 🎯 Imita la postura ── */}
      {modo === 'juego' && juego.fase === 'menu' && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', ...tarjeta, textAlign: 'center', width: 'min(420px, 92vw)' }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#166534' }}>🎯 Imita la postura</div>
          <p style={{ fontSize: '0.85rem', color: '#334155', margin: '6px 0 10px' }}>Aparecerá una silueta: colócate igual y aguanta 1 segundo. Son {POSTURAS_POR_PARTIDA} posturas; cuanto antes, más puntos.</p>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 10 }}>
            <input type="checkbox" checked={conPiernas} onChange={(e) => setConPiernas(e.target.checked)} /> Incluir posturas con piernas (hay que verse entero)
          </label>
          <div>
            <button onClick={empezarJuego} style={boton(true, '#16a34a')}>
              ▶ Empezar
            </button>
          </div>
        </div>
      )}
      {modo === 'juego' && juego.fase === 'jugando' && juego.postura && (
        <div style={{ position: 'absolute', top: 60, right: 10, ...tarjeta, padding: '10px 14px', minWidth: 200 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>
            Postura {juego.n} de {juego.total} · {juego.puntos} pts
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
            {juego.postura.emoji} {juego.postura.nombre}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Parecido</div>
          <div style={{ height: 10, borderRadius: 6, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(juego.punt * 100)}%`, height: '100%', background: juego.punt >= UMBRAL ? VERDE : AMBAR }} />
          </div>
          {juego.mantenido > 0 && <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>¡Aguanta! {Math.round(juego.mantenido * 100)} %</div>}
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>⏱ {Math.ceil(juego.restante / 1000)} s</div>
        </div>
      )}
      {modo === 'juego' && juego.fase === 'fin' && (
        <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', ...tarjeta, padding: 22, textAlign: 'center', width: 'min(340px, 90vw)' }}>
          <div style={{ fontSize: '2.4rem' }}>{juego.aciertos >= juego.total * 0.8 ? '🏆' : juego.aciertos >= juego.total / 2 ? '👏' : '💪'}</div>
          <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0f172a' }}>
            {juego.aciertos} de {juego.total} posturas
          </div>
          <div style={{ color: '#475569', fontWeight: 700, margin: '4px 0 12px' }}>{juego.puntos} puntos · guardado en «Mis registros»</div>
          <button onClick={empezarJuego} style={boton(true, '#16a34a')}>
            🔁 Otra vez
          </button>
        </div>
      )}

      {/* ── 👯 Imita a tu compañero ── */}
      {modo === 'pareja' && pareja.fase === 'menu' && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', ...tarjeta, textAlign: 'center', width: 'min(460px, 92vw)' }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#c2410c' }}>👯 Imita a tu compañero</div>
          <p style={{ fontSize: '0.85rem', color: '#334155', margin: '6px 0 10px', lineHeight: 1.5 }}>
            Poneos uno a cada lado de la cámara. Por turnos, el <b>líder 👑</b> hace una postura y en la cuenta 3-2-1 se le «hace una foto». El compañero tiene {COPIAR_MS / 1000} segundos para copiarla: la silueta se pone verde cuando se parece. ¡{RONDAS_PAREJA} rondas!
          </p>
          <button onClick={empezarPareja} style={boton(true, '#ea580c')}>
            ▶ Empezar
          </button>
        </div>
      )}
      {modo === 'pareja' && pareja.fase !== 'menu' && (
        <>
          {marcador(0, pareja.puntos?.[0] || 0)}
          {marcador(1, pareja.puntos?.[1] || 0)}
        </>
      )}
      {jugandoPareja && (
        <>
          {/* Papeles sobre cada avatar */}
          {[0, 1].map((i) => (
            <div key={i} style={{ position: 'absolute', left: i === 0 ? '28%' : '72%', top: '20%', transform: 'translateX(-50%)', background: i === pareja.lider ? '#facc15' : 'rgba(255,255,255,0.92)', color: '#0f172a', borderRadius: 999, padding: '4px 12px', fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 3px 10px rgba(0,0,0,0.2)', border: `3px solid ${COLOR_J[i]}`, whiteSpace: 'nowrap' }}>
              {i === pareja.lider ? '👑 LÍDER' : '🪞 COPIA'}
            </div>
          ))}
          {/* Ronda y mensaje */}
          <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', ...tarjeta, padding: '8px 16px', textAlign: 'center', maxWidth: '60vw' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
              Ronda {Math.min(pareja.ronda, RONDAS_PAREJA)} de {RONDAS_PAREJA}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
              {pareja.msg ||
                (pareja.fase === 'preparar'
                  ? `👑 ${NOMBRE_J[pareja.lider]}: ¡haz una postura!`
                  : pareja.fase === 'copiar'
                    ? `🪞 ${NOMBRE_J[1 - pareja.lider]}: ¡cópiala!`
                    : pareja.ultimo?.ok
                      ? '🎉 ¡Muy bien copiado!'
                      : '⏱ ¡Se acabó el tiempo!')}
            </div>
          </div>
          {pareja.fase === 'preparar' && !pareja.msg && pareja.cuenta <= 3 && (
            <div style={{ position: 'absolute', left: pareja.lider === 0 ? '28%' : '72%', top: '50%', fontSize: 'clamp(4rem, 14vw, 8rem)', fontWeight: 900, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,0.5)', animation: 'pikt-latido 1s infinite', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              {pareja.cuenta}
            </div>
          )}
          {pareja.fase === 'copiar' && (
            <div style={{ position: 'absolute', left: pareja.lider === 0 ? '72%' : '28%', bottom: 30, transform: 'translateX(-50%)', ...tarjeta, padding: '8px 12px', width: 'min(240px, 40vw)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                <span>Parecido</span>
                <span>⏱ {Math.ceil(pareja.restante / 1000)} s</span>
              </div>
              <div style={{ height: 14, borderRadius: 8, background: '#e2e8f0', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${Math.round(pareja.parecido * 100)}%`, height: '100%', background: pareja.parecido >= UMBRAL_PAREJA ? VERDE : AMBAR, transition: 'width 0.1s' }} />
              </div>
            </div>
          )}
        </>
      )}
      {modo === 'pareja' && pareja.fase === 'fin' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', ...tarjeta, padding: 22, textAlign: 'center', width: 'min(360px, 90vw)' }}>
          <div style={{ fontSize: '2.6rem' }}>🏆</div>
          <div style={{ fontWeight: 900, fontSize: '1.25rem', color: pareja.puntos[0] === pareja.puntos[1] ? '#0f172a' : COLOR_J[pareja.puntos[0] > pareja.puntos[1] ? 0 : 1] }}>
            {pareja.puntos[0] === pareja.puntos[1] ? '¡Empate!' : `¡Gana el ${NOMBRE_J[pareja.puntos[0] > pareja.puntos[1] ? 0 : 1]}!`}
          </div>
          <div style={{ color: '#475569', fontWeight: 700, margin: '6px 0 12px' }}>
            {pareja.puntos[0]} – {pareja.puntos[1]} · {pareja.aciertos[0] + pareja.aciertos[1]} posturas copiadas de {RONDAS_PAREJA}
          </div>
          <button onClick={empezarPareja} style={boton(true, '#ea580c')}>
            🔁 Otra vez
          </button>
        </div>
      )}

      {/* ── 💃 Coreografía ── */}
      {modo === 'baile' && baile.fase === 'menu' && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', ...tarjeta, textAlign: 'center', width: 'min(460px, 92vw)' }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#be185d' }}>💃 Coreografía</div>
          <p style={{ fontSize: '0.85rem', color: '#334155', margin: '6px 0 10px', lineHeight: 1.5 }}>
            Sigue los pasos al ritmo de la música, solo o con un compañero (uno a cada lado). Abajo verás el paso que toca y los siguientes; al acabar cada paso se puntúa: <b>¡PERFECTO!</b>, <b>¡GENIAL!</b>, <b>BIEN</b> o <b>FALLO</b>. ¡Encadena aciertos para la racha 🔥!
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            {Object.entries(NIVELES_BAILE).map(([id, nv]) => (
              <button key={id} onClick={() => setNivelBaile(id)} style={boton(nivelBaile === id, '#db2777')}>
                {nv.label}
              </button>
            ))}
          </div>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 10 }}>
            <input type="checkbox" checked={conPiernas} onChange={(e) => setConPiernas(e.target.checked)} /> Incluir pasos con piernas
          </label>
          <div>
            <button onClick={empezarBaile} style={boton(true, '#db2777')}>
              ▶ ¡A bailar!
            </button>
          </div>
        </div>
      )}
      {modo === 'baile' && baile.fase === 'bailando' && (
        <>
          {marcador(0, baile.puntos[0], baile.combo[0], !baile.presente[0])}
          {marcador(1, baile.puntos[1], baile.combo[1], !baile.presente[1])}
          {baile.cuenta > 0 && (
            <div style={{ position: 'absolute', left: '50%', top: '45%', fontSize: 'clamp(4rem, 14vw, 8rem)', fontWeight: 900, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,0.5)', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              {baile.cuenta}
            </div>
          )}
          {/* Fila de pasos */}
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'flex-end', zIndex: 3 }}>
            {[0, 1, 2, 3].map((k) => {
              const i = Math.max(0, baile.idx) + k;
              const p = pasosBaile[i];
              if (!p) return null;
              const actual = k === 0;
              return (
                <div key={i} style={{ ...tarjeta, padding: actual ? '8px 14px' : '6px 10px', minWidth: actual ? 150 : 84, textAlign: 'center', opacity: actual ? 1 : 0.85 - k * 0.15, border: actual ? '3px solid #db2777' : '2px solid #e2e8f0' }}>
                  <div style={{ fontSize: actual ? '2rem' : '1.3rem', lineHeight: 1 }}>{p.postura.emoji}</div>
                  <div style={{ fontSize: actual ? '0.9rem' : '0.68rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{p.postura.nombre}</div>
                  {actual && baile.idx >= 0 && (
                    <div style={{ height: 6, borderRadius: 4, background: '#fce7f3', overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ width: `${Math.min(100, baile.progreso * 100)}%`, height: '100%', background: '#db2777' }} />
                    </div>
                  )}
                  {actual && baile.idx < 0 && <div style={{ fontSize: '0.65rem', color: '#64748b' }}>primer paso</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {modo === 'baile' && baile.fase === 'fin' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', ...tarjeta, padding: 22, textAlign: 'center', width: 'min(420px, 92vw)' }}>
          <div style={{ fontSize: '2.6rem' }}>🪩</div>
          <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0f172a', marginBottom: 8 }}>¡Fin de la coreografía!</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {[0, 1]
              .filter((i) => baile.presente[i])
              .map((i) => (
                <div key={i} style={{ flex: 1, borderRadius: 12, padding: 10, background: `${COLOR_J[i]}18`, border: `2px solid ${COLOR_J[i]}` }}>
                  <div style={{ fontWeight: 900, color: COLOR_J[i], fontSize: '0.8rem' }}>{NOMBRE_J[i]}</div>
                  <div style={{ fontWeight: 900, fontSize: '1.6rem' }}>{baile.puntos[i]}</div>
                  {NOTAS.map((n) => (
                    <div key={n.txt} style={{ fontSize: '0.72rem', fontWeight: 700, color: n.color === '#facc15' ? '#a16207' : n.color }}>
                      {n.txt} × {baile.notas[i][n.txt] || 0}
                    </div>
                  ))}
                </div>
              ))}
          </div>
          {!baile.presente[0] && !baile.presente[1] && <div style={{ color: '#64748b' }}>No he visto a nadie bailar 😅</div>}
          <div style={{ color: '#475569', fontWeight: 700, margin: '10px 0' }}>Guardado en «Mis registros»</div>
          <button onClick={empezarBaile} style={boton(true, '#db2777')}>
            🔁 Otra vez
          </button>
        </div>
      )}
    </div>
  );
}
