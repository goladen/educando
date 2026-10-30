// Avatar 3D articulado (three.js, todo con primitivas) que copia la postura del
// cuerpo detectada por poseVision.js, y posturas objetivo para el juego «Imita la postura».
//
// Esqueleto (mira hacia +Z, pies en y = 0, ~1,7 m):
//   grupo → caderas → muslo → rodilla(espinilla, pie)
//         → tronco  → brazo → codo(antebrazo, mano)
//                   → cabeza
// Cada pieza gira desde su articulación; brazos y piernas «apuntan» en la dirección
// del segmento medido (setFromUnitVectors), tronco y cabeza se orientan con una base.
//
// Lados = lados de la PANTALLA (como un espejo): 'D' es el que queda a la derecha
// de la pantalla, que se mueve con el brazo/pierna DERECHO del alumno.
import * as THREE from 'three';
import { P } from './poseVision.js';

const ABAJO = new THREE.Vector3(0, -1, 0);
const ARRIBA = new THREE.Vector3(0, 1, 0);

export const ESTILOS = {
  piel: ['#f1c7a5', '#e0a77e', '#b97a56', '#8d5a3c', '#5c3a26'],
  camiseta: ['#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#f59e0b', '#0f172a', '#ec4899'],
  pantalon: ['#1f2937', '#1e3a8a', '#78350f', '#6b7280', '#065f46'],
  pelo: ['#2b1b10', '#5b3a1e', '#d4a64a', '#111111', '#b45309', '#9ca3af'],
};
export const ESTILO_DEF = { piel: '#f1c7a5', camiseta: '#2563eb', pantalon: '#1f2937', pelo: '#2b1b10' };

function mat(color, fantasma) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.05,
    transparent: !!fantasma,
    opacity: fantasma ? 0.35 : 1,
    depthWrite: !fantasma,
  });
}

function malla(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Cilindro «hueso» que cuelga hacia -Y desde el origen del grupo. */
function segmento(largo, r1, r2, material) {
  return malla(new THREE.CylinderGeometry(r1, r2, largo, 12), material, 0, -largo / 2, 0);
}

/**
 * Crea el avatar. `fantasma` = translúcido (la silueta objetivo del juego).
 * Devuelve { grupo, partes, materiales, aplicarPose(pose), reposo(), colorear(estilo), liberar() }.
 */
export function crearAvatarCuerpo(estilo = ESTILO_DEF, { fantasma = false } = {}) {
  const e = { ...ESTILO_DEF, ...estilo };
  const mats = {
    piel: mat(e.piel, fantasma),
    camiseta: mat(e.camiseta, fantasma),
    pantalon: mat(e.pantalon, fantasma),
    pelo: mat(e.pelo, fantasma),
    zapato: mat('#111827', fantasma),
    ojo: mat('#111111', fantasma),
  };
  const grupo = new THREE.Group();

  // Caderas y piernas
  const caderas = new THREE.Group();
  caderas.position.y = 0.95;
  grupo.add(caderas);
  caderas.add(malla(new THREE.BoxGeometry(0.32, 0.14, 0.2), mats.pantalon, 0, -0.02, 0));
  const pierna = (x) => {
    const muslo = new THREE.Group();
    muslo.position.set(x, -0.05, 0);
    muslo.add(segmento(0.44, 0.08, 0.065, mats.pantalon));
    const rodilla = new THREE.Group();
    rodilla.position.y = -0.44;
    rodilla.add(malla(new THREE.SphereGeometry(0.066, 10, 8), mats.pantalon));
    rodilla.add(segmento(0.44, 0.064, 0.05, mats.pantalon));
    rodilla.add(malla(new THREE.BoxGeometry(0.12, 0.07, 0.24), mats.zapato, 0, -0.47, 0.05));
    muslo.add(rodilla);
    caderas.add(muslo);
    return { muslo, rodilla };
  };
  const piernaI = pierna(-0.1);
  const piernaD = pierna(0.1);

  // Tronco, brazos y cabeza
  const tronco = new THREE.Group();
  tronco.position.y = 0.95;
  grupo.add(tronco);
  tronco.add(malla(new THREE.CylinderGeometry(0.2, 0.16, 0.5, 14), mats.camiseta, 0, 0.27, 0));
  tronco.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), mats.piel, 0, 0.56, 0));
  const brazo = (x) => {
    const sup = new THREE.Group();
    sup.position.set(x, 0.48, 0);
    sup.add(malla(new THREE.SphereGeometry(0.07, 10, 8), mats.camiseta));
    sup.add(segmento(0.28, 0.06, 0.05, mats.camiseta));
    const codo = new THREE.Group();
    codo.position.y = -0.28;
    codo.add(malla(new THREE.SphereGeometry(0.048, 10, 8), mats.piel));
    codo.add(segmento(0.25, 0.045, 0.038, mats.piel));
    codo.add(malla(new THREE.SphereGeometry(0.058, 10, 8), mats.piel, 0, -0.29, 0));
    sup.add(codo);
    tronco.add(sup);
    return { sup, codo };
  };
  const brazoI = brazo(-0.24);
  const brazoD = brazo(0.24);

  const cabeza = new THREE.Group();
  cabeza.position.y = 0.6;
  tronco.add(cabeza);
  cabeza.add(malla(new THREE.SphereGeometry(0.13, 18, 14), mats.piel, 0, 0.13, 0));
  const pelo = malla(new THREE.SphereGeometry(0.137, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mats.pelo, 0, 0.145, -0.01);
  cabeza.add(pelo);
  [-0.045, 0.045].forEach((x) => cabeza.add(malla(new THREE.SphereGeometry(0.018, 8, 8), mats.ojo, x, 0.15, 0.118)));
  cabeza.add(malla(new THREE.ConeGeometry(0.02, 0.05, 8), mats.piel, 0, 0.12, 0.135)).rotation.x = Math.PI / 2;

  const partes = { caderas, tronco, cabeza, brazoI, brazoD, piernaI, piernaD };
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();

  /** Gira `obj` para que su eje de reposo apunte a `dir` (dirección en el espacio del grupo). */
  function apuntar(obj, dir, reposo = ABAJO) {
    if (!dir) return;
    // Orientación del padre respecto al grupo (el grupo no se gira, solo se traslada).
    tmpQ.identity();
    for (let p = obj.parent; p && p !== grupo; p = p.parent) tmpQ.premultiply(p.quaternion);
    tmpV.copy(dir).normalize().applyQuaternion(tmpQ.invert());
    obj.quaternion.setFromUnitVectors(reposo, tmpV);
  }

  /** Orienta con una base: x = derecha, y = arriba (se ortogonaliza). */
  function base(obj, der, arriba, relativoA = null) {
    if (!der || !arriba) return;
    const x = der.clone().normalize();
    const y = arriba.clone().sub(x.clone().multiplyScalar(arriba.dot(x))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    tmpM.makeBasis(x, y, z);
    obj.quaternion.setFromRotationMatrix(tmpM);
    if (relativoA) obj.quaternion.premultiply(relativoA.quaternion.clone().invert());
  }

  /**
   * pose = { tronco: {der, arriba}, caderas: {der}, cabeza?: {der, arriba},
   *          brazoI/brazoD: {sup, inf}, piernaI/piernaD: {sup, inf} | null }
   * Todas las direcciones en el espacio del avatar (Vector3 o {x,y,z}).
   */
  function aplicarPose(pose) {
    const v = (d) => (d ? new THREE.Vector3(d.x, d.y, d.z) : null);
    if (pose.tronco) base(tronco, v(pose.tronco.der), v(pose.tronco.arriba));
    else tronco.quaternion.identity();
    if (pose.caderas) base(caderas, v(pose.caderas.der), ARRIBA);
    else caderas.quaternion.identity();
    if (pose.cabeza) base(cabeza, v(pose.cabeza.der), v(pose.cabeza.arriba), tronco);
    else cabeza.quaternion.identity();
    [
      [brazoI, pose.brazoI],
      [brazoD, pose.brazoD],
      [piernaI, pose.piernaI],
      [piernaD, pose.piernaD],
    ].forEach(([b, d]) => {
      const sup = b.sup || b.muslo;
      const inf = b.codo || b.rodilla;
      if (!d) {
        sup.quaternion.identity();
        inf.quaternion.identity();
        return;
      }
      apuntar(sup, v(d.sup));
      apuntar(inf, v(d.inf));
    });
  }

  function reposo() {
    [caderas, tronco, cabeza, brazoI.sup, brazoI.codo, brazoD.sup, brazoD.codo, piernaI.muslo, piernaI.rodilla, piernaD.muslo, piernaD.rodilla].forEach((o) => o.quaternion.identity());
    // Brazos un poco separados del cuerpo
    brazoI.sup.rotation.z = -0.12;
    brazoD.sup.rotation.z = 0.12;
  }
  reposo();

  /** Altura del punto más bajo de los pies (para apoyarlos en el suelo). */
  const pieV = new THREE.Vector3();
  function alturaPies() {
    grupo.updateMatrixWorld(true);
    let min = Infinity;
    [piernaI.rodilla, piernaD.rodilla].forEach((r) => {
      pieV.set(0, -0.5, 0);
      r.localToWorld(pieV);
      grupo.worldToLocal(pieV);
      min = Math.min(min, pieV.y);
    });
    return min;
  }

  function colorear(est) {
    const n = { ...ESTILO_DEF, ...est };
    mats.piel.color.set(n.piel);
    mats.camiseta.color.set(n.camiseta);
    mats.pantalon.color.set(n.pantalon);
    mats.pelo.color.set(n.pelo);
  }

  function liberar() {
    grupo.traverse((o) => o.geometry?.dispose());
    Object.values(mats).forEach((m) => m.dispose());
  }

  return { grupo, partes, materiales: mats, aplicarPose, reposo, alturaPies, colorear, liberar };
}

// ── De los puntos de MediaPipe a una pose del avatar ────────────────────────

const resta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const media = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/** Suaviza los puntos del mundo entre fotogramas (quita el temblor). */
export function crearSuavizado(alfa = 0.45) {
  let prev = null;
  return (mundo) => {
    if (!mundo) return (prev = null);
    if (!prev || prev.length !== mundo.length) prev = mundo.map((p) => ({ ...p }));
    else
      prev = prev.map((p, i) => ({
        x: p.x + (mundo[i].x - p.x) * alfa,
        y: p.y + (mundo[i].y - p.y) * alfa,
        z: p.z + (mundo[i].z - p.z) * alfa,
      }));
    return prev;
  };
}

/** ¿Se ven las piernas? (si no, el avatar las deja rectas). */
export function piernasVisibles(puntos, min = 0.55) {
  return [P.RODILLA_I, P.RODILLA_D, P.TOBILLO_I, P.TOBILLO_D].every((i) => (puntos[i]?.v ?? 0) >= min);
}

/** Pose del avatar a partir de la persona detectada ({ puntos, mundo } ya suavizado). */
export function poseDesdeMundo(mundo, conPiernas) {
  const m = mundo;
  const pose = {
    tronco: {
      der: resta(m[P.HOMBRO_D], m[P.HOMBRO_I]),
      arriba: resta(media(m[P.HOMBRO_I], m[P.HOMBRO_D]), media(m[P.CADERA_I], m[P.CADERA_D])),
    },
    caderas: { der: resta(m[P.CADERA_D], m[P.CADERA_I]) },
    cabeza: {
      der: resta(m[P.OREJA_D], m[P.OREJA_I]),
      // de las orejas a la nariz es «adelante y algo abajo»; arriba ≈ perpendicular
      arriba: (() => {
        const orejas = media(m[P.OREJA_I], m[P.OREJA_D]);
        const frente = resta(m[P.NARIZ], orejas);
        const der = resta(m[P.OREJA_D], m[P.OREJA_I]);
        // arriba = frente × der (con la base x = der, z = frente)
        return { x: frente.y * der.z - frente.z * der.y, y: frente.z * der.x - frente.x * der.z, z: frente.x * der.y - frente.y * der.x };
      })(),
    },
    brazoI: { sup: resta(m[P.CODO_I], m[P.HOMBRO_I]), inf: resta(m[P.MUNECA_I], m[P.CODO_I]) },
    brazoD: { sup: resta(m[P.CODO_D], m[P.HOMBRO_D]), inf: resta(m[P.MUNECA_D], m[P.CODO_D]) },
    piernaI: conPiernas ? { sup: resta(m[P.RODILLA_I], m[P.CADERA_I]), inf: resta(m[P.TOBILLO_I], m[P.RODILLA_I]) } : null,
    piernaD: conPiernas ? { sup: resta(m[P.RODILLA_D], m[P.CADERA_D]), inf: resta(m[P.TOBILLO_D], m[P.RODILLA_D]) } : null,
  };
  return pose;
}

// ── Posturas del juego «Imita la postura» ───────────────────────────────────
// Direcciones en ejes de pantalla: x derecha, y arriba, z hacia la cámara.
// 'D' = brazo/pierna DERECHO del alumno (a la derecha de la pantalla, como un espejo).

const ABJ = { x: 0, y: -1, z: 0 };
const brazos = (supI, infI, supD, infD) => ({ brazoI: { sup: supI, inf: infI }, brazoD: { sup: supD, inf: infD } });

export const POSTURAS = [
  { id: 'cruz', nombre: 'Brazos en cruz', emoji: '✝️', ...brazos({ x: -1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }) },
  { id: 'arriba', nombre: 'Brazos arriba', emoji: '🙌', ...brazos({ x: -0.15, y: 1, z: 0 }, { x: -0.1, y: 1, z: 0 }, { x: 0.15, y: 1, z: 0 }, { x: 0.1, y: 1, z: 0 }) },
  { id: 'Y', nombre: 'Letra Y', emoji: '🙆', ...brazos({ x: -0.65, y: 0.75, z: 0 }, { x: -0.65, y: 0.75, z: 0 }, { x: 0.65, y: 0.75, z: 0 }, { x: 0.65, y: 0.75, z: 0 }) },
  { id: 'derArriba', nombre: 'Mano derecha arriba', emoji: '🙋', ...brazos({ x: -0.15, y: -1, z: 0 }, ABJ, { x: 0.15, y: 1, z: 0 }, { x: 0.1, y: 1, z: 0 }) },
  { id: 'izqArriba', nombre: 'Mano izquierda arriba', emoji: '🙋‍♀️', ...brazos({ x: -0.15, y: 1, z: 0 }, { x: -0.1, y: 1, z: 0 }, { x: 0.15, y: -1, z: 0 }, ABJ) },
  { id: 'fuerza', nombre: 'Saca músculo', emoji: '💪', ...brazos({ x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }) },
  { id: 'diagonal', nombre: 'Diagonal', emoji: '↗️', ...brazos({ x: -0.7, y: -0.7, z: 0 }, { x: -0.7, y: -0.7, z: 0 }, { x: 0.7, y: 0.7, z: 0 }, { x: 0.7, y: 0.7, z: 0 }) },
  { id: 'L', nombre: 'Letra L', emoji: '🅻', ...brazos({ x: -1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0.15, y: 1, z: 0 }, { x: 0.1, y: 1, z: 0 }) },
  { id: 'frente', nombre: 'Brazos al frente', emoji: '🧟', ...brazos({ x: -0.1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, { x: 0.1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }) },
  { id: 'robot', nombre: 'Robot', emoji: '🤖', ...brazos({ x: -0.25, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0.25, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }) },
  {
    id: 'estrella', nombre: 'Estrella', emoji: '⭐', piernas: true,
    ...brazos({ x: -0.65, y: 0.75, z: 0 }, { x: -0.65, y: 0.75, z: 0 }, { x: 0.65, y: 0.75, z: 0 }, { x: 0.65, y: 0.75, z: 0 }),
    piernaI: { sup: { x: -0.4, y: -1, z: 0 }, inf: { x: -0.4, y: -1, z: 0 } },
    piernaD: { sup: { x: 0.4, y: -1, z: 0 }, inf: { x: 0.4, y: -1, z: 0 } },
  },
  {
    id: 'rodilla', nombre: 'Rodilla derecha arriba', emoji: '🦵', piernas: true,
    ...brazos({ x: -1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    piernaI: { sup: ABJ, inf: ABJ },
    piernaD: { sup: { x: 0, y: -0.15, z: 1 }, inf: ABJ },
  },
  {
    id: 'sentadilla', nombre: 'Sentadilla', emoji: '🏋️', piernas: true,
    ...brazos({ x: -0.1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, { x: 0.1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }),
    piernaI: { sup: { x: -0.2, y: -0.5, z: 0.85 }, inf: { x: 0, y: -1, z: -0.15 } },
    piernaD: { sup: { x: 0.2, y: -0.5, z: 0.85 }, inf: { x: 0, y: -1, z: -0.15 } },
  },
];

/** Brazos abajo: para saber si alguien está haciendo una postura «de verdad». */
export const REPOSO = { id: 'reposo', ...brazos({ x: -0.15, y: -1, z: 0 }, ABJ, { x: 0.15, y: -1, z: 0 }, ABJ) };

// Frases de baile: dos pasos que se alternan (A B A B), como en una coreografía.
const FRASES = [
  ['derArriba', 'izqArriba'],
  ['cruz', 'arriba'],
  ['Y', 'fuerza'],
  ['diagonal', 'L'],
  ['robot', 'frente'],
  ['cruz', 'fuerza'],
  ['arriba', 'Y'],
  ['derArriba', 'cruz'],
  ['izqArriba', 'diagonal'],
];
const FRASES_PIERNAS = [
  ['estrella', 'cruz'],
  ['rodilla', 'arriba'],
  ['sentadilla', 'Y'],
];

/**
 * Coreografía: [{ postura, inicio (tiempo musical), tiempos }]. Empieza en el tiempo 4
 * (tras la cuenta de entrada). `pasos` múltiplo de 4; `tiempos` = duración de cada paso.
 */
export function generarCoreografia({ pasos = 16, tiempos = 4, piernas = false } = {}) {
  const porId = Object.fromEntries(POSTURAS.map((p) => [p.id, p]));
  const fuente = piernas ? [...FRASES, ...FRASES_PIERNAS] : FRASES;
  const orden = [...fuente].sort(() => Math.random() - 0.5);
  const lista = [];
  let inicio = 4;
  for (let f = 0; lista.length < pasos; f++) {
    const [a, b] = orden[f % orden.length];
    for (let k = 0; k < 4 && lista.length < pasos; k++) {
      lista.push({ postura: porId[k % 2 ? b : a], inicio, tiempos });
      inicio += tiempos;
    }
  }
  return lista;
}

/** Pose completa del avatar para una postura objetivo (tronco recto). */
export function poseDePostura(p) {
  return {
    tronco: { der: { x: 1, y: 0, z: 0 }, arriba: { x: 0, y: 1, z: 0 } },
    caderas: { der: { x: 1, y: 0, z: 0 } },
    brazoI: p.brazoI,
    brazoD: p.brazoD,
    piernaI: p.piernaI || { sup: ABJ, inf: ABJ },
    piernaD: p.piernaD || { sup: ABJ, inf: ABJ },
  };
}

const angulo = (a, b) => {
  const la = Math.hypot(a.x, a.y, a.z) || 1;
  const lb = Math.hypot(b.x, b.y, b.z) || 1;
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

/**
 * Compara la pose del alumno con la postura objetivo.
 * → { puntuacion 0-1, peor (grados), segmentos: { brazoI: {sup, inf}, … } en grados }
 * La profundidad (z) de la webcam es menos fiable: pesa la mitad.
 */
export function compararPostura(pose, postura) {
  const z = (d) => ({ x: d.x, y: d.y, z: d.z * 0.5 });
  const partes = ['brazoI', 'brazoD', ...(postura.piernas ? ['piernaI', 'piernaD'] : [])];
  const seg = {};
  let suma = 0;
  let n = 0;
  let peor = 0;
  partes.forEach((k) => {
    if (!pose[k] || !postura[k]) return;
    const a1 = angulo(z(pose[k].sup), z(postura[k].sup));
    const a2 = angulo(z(pose[k].inf), z(postura[k].inf));
    seg[k] = { sup: a1, inf: a2 };
    [a1, a2].forEach((a) => {
      suma += Math.max(0, 1 - a / 70);
      peor = Math.max(peor, a);
      n++;
    });
  });
  return { puntuacion: n ? suma / n : 0, peor: n ? peor : 180, segmentos: seg };
}
