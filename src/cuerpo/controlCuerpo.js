// Gestos del cuerpo para manejar juegos con la webcam (sobre poseVision.js):
//   · Dirección (dir = +1 derecha / -1 izquierda / 0 quieto), dos modos:
//       'brazos' (por defecto) → brazo DERECHO extendido hacia el lado = derecha, el
//                IZQUIERDO = izquierda; brazos abajo (o los dos) = quieto. Se ve la pantalla.
//       'cabeza' → girar la cabeza hacia ese lado.
//   · Saltar → `salto` = true en el fotograma en que despega.
// Lados como un espejo: TU derecha es la derecha de la pantalla.
//
// Brazo extendido: ÁNGULO DEL HOMBRO en 3D (metros) entre el brazo (hombro→codo) y el
// costado (hombro→cadera): abajo ≈ 0-20°, en cruz ≈ 90°, arriba ≈ 180°. Cuenta a partir de
// 60° (se suelta por debajo de 45°) y solo si el brazo sale hacia el LADO (no hacia delante,
// que también da 90°). No depende del codo ni de la distancia a la cámara.
// Giro de cabeza: la nariz se desplaza respecto al punto medio de las orejas ≈ tan(ángulo)/2
// de la distancia entre orejas (20° ≈ 0,18; 30° ≈ 0,29). `centrar()` calibra «de frente».
// Salto: los hombros suben DE GOLPE (en < 0,35 s) respecto a su punto más bajo reciente,
// medido en anchos de hombros para que no dependa de la distancia a la cámara. Para no
// confundirlo con acercarse a la cámara o moverse un poco:
//   · si el ancho de hombros cambia > 12 % (te acercas/alejas) no cuenta;
//   · si se ven las caderas, también tienen que subir (al acercarte bajan en la imagen);
//   · tiene que verse en 2 fotogramas seguidos.
import { escucharPose, P } from './poseVision.js';

/** Subida mínima de los hombros (en anchos de hombros) según la sensibilidad. */
export const SENSIBILIDAD_SALTO = { alta: 0.28, normal: 0.38, baja: 0.5 };
const LS_SENSIBILIDAD = 'pikt_cuerpo_salto';

export function leerSensibilidadSalto() {
  try {
    const s = localStorage.getItem(LS_SENSIBILIDAD);
    return SENSIBILIDAD_SALTO[s] ? s : 'normal';
  } catch {
    return 'normal';
  }
}

const LS_MODO = 'pikt_cuerpo_modo';
export function leerModoDireccion() {
  try {
    return localStorage.getItem(LS_MODO) === 'cabeza' ? 'cabeza' : 'brazos';
  } catch {
    return 'brazos';
  }
}

export const AJUSTES_GESTOS = {
  brazoMin: 60, // ángulo del hombro (grados) para contar el brazo extendido (en cruz o más arriba)…
  brazoMax: 180,
  brazoSueltaMin: 45, // …y para soltarlo (histéresis)
  brazoSueltaMax: 180,
  giroOn: 0.2, // giro de cabeza para empezar a moverse
  giroOff: 0.12, // giro para volver a «de frente» (histéresis)
  salto: SENSIBILIDAD_SALTO.normal,
};

/**
 * Ángulo del hombro en grados (0 = brazo pegado al costado, 90 = en cruz, 180 = arriba),
 * o null si no se ve el codo o el brazo apunta hacia delante/atrás en vez de hacia el lado.
 * `m` = puntos 3D (persona.mundo, en espejo); hacia = +1 lado derecho de la pantalla, -1 izquierdo.
 */
export function anguloHombro(persona, hombro, codo, cadera, hacia) {
  const { puntos: p, mundo: m } = persona;
  if (!m || p[codo].v < 0.4) return null;
  const brazo = { x: m[codo].x - m[hombro].x, y: m[codo].y - m[hombro].y, z: m[codo].z - m[hombro].z };
  const costado = { x: m[cadera].x - m[hombro].x, y: m[cadera].y - m[hombro].y, z: m[cadera].z - m[hombro].z };
  const lb = Math.hypot(brazo.x, brazo.y, brazo.z) || 1e-6;
  const lc = Math.hypot(costado.x, costado.y, costado.z) || 1e-6;
  // Hacia el lado: si el brazo tiene recorrido horizontal, tiene que ir más hacia fuera que
  // hacia delante/atrás (con el brazo casi vertical, arriba, no se comprueba).
  if (Math.hypot(brazo.x, brazo.z) > lb * 0.5 && brazo.x * hacia < Math.abs(brazo.z)) return null;
  const cos = (brazo.x * costado.x + brazo.y * costado.y + brazo.z * costado.z) / (lb * lc);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

const VENTANA_SALTO_MS = 350;

export function crearDetectorGestos(ajustes = AJUSTES_GESTOS) {
  const a = { ...AJUSTES_GESTOS, salto: SENSIBILIDAD_SALTO[leerSensibilidadSalto()], modoDir: leerModoDireccion(), ...ajustes };
  let brazoD = false;
  let brazoI = false;
  let offset = 0;
  let giroSuave = 0;
  let dir = 0;
  let historial = []; // { t, y (hombros), ancho, yc (caderas o null) }
  let candidato = 0; // fotogramas seguidos que parecen salto
  let enSalto = false;
  let tSalto = 0;
  let yDespegue = 0;
  let ultimoGiro = 0;

  function procesar(persona, ahora) {
    const vacio = { presente: false, dir: 0, salto: false, giro: 0, elevacion: 0 };
    if (!persona) {
      dir = 0;
      enSalto = false;
      historial = []; // al volver a entrar en la imagen no debe contar como salto
      return vacio;
    }
    const p = persona.puntos;
    const hi = p[P.HOMBRO_I];
    const hd = p[P.HOMBRO_D];
    if (hi.v < 0.5 || hd.v < 0.5) {
      dir = 0;
      return vacio;
    }
    const ancho = Math.hypot(hd.x - hi.x, hd.y - hi.y) || 0.1;

    // ── Giro de la cabeza ──
    const oi = p[P.OREJA_I];
    const od = p[P.OREJA_D];
    const nariz = p[P.NARIZ];
    const entreOrejas = Math.max(Math.abs(od.x - oi.x), ancho * 0.3);
    const giro = (nariz.x - (oi.x + od.x) / 2) / entreOrejas;
    ultimoGiro = giro;
    giroSuave += (giro - offset - giroSuave) * 0.5;

    // ── Brazos extendidos ── (en espejo: el brazo derecho del alumno sale hacia la derecha de la pantalla)
    const angD = anguloHombro(persona, P.HOMBRO_D, P.CODO_D, P.CADERA_D, 1);
    const angI = anguloHombro(persona, P.HOMBRO_I, P.CODO_I, P.CADERA_I, -1);
    const extendido = (ang, antes) =>
      ang !== null && (antes ? ang >= a.brazoSueltaMin && ang <= a.brazoSueltaMax : ang >= a.brazoMin && ang <= a.brazoMax);
    brazoD = extendido(angD, brazoD);
    brazoI = extendido(angI, brazoI);

    if (a.modoDir === 'brazos') {
      dir = brazoD && !brazoI ? 1 : brazoI && !brazoD ? -1 : 0;
    } else if (dir === 0) {
      if (giroSuave > a.giroOn) dir = 1;
      else if (giroSuave < -a.giroOn) dir = -1;
    } else if (dir === 1 ? giroSuave < a.giroOff : giroSuave > -a.giroOff) {
      dir = giroSuave > a.giroOn ? 1 : giroSuave < -a.giroOn ? -1 : 0;
    }

    // ── Salto ──
    const y = (hi.y + hd.y) / 2;
    const ci = p[P.CADERA_I];
    const cd = p[P.CADERA_D];
    const yc = ci.v >= 0.5 && cd.v >= 0.5 ? (ci.y + cd.y) / 2 : null;
    historial.push({ t: ahora, y, ancho, yc });
    historial = historial.filter((h) => ahora - h.t <= VENTANA_SALTO_MS);

    // Punto más bajo (y más grande) de la ventana: desde ahí se mide la subida rápida.
    let ref = historial[0];
    historial.forEach((h) => {
      if (h.y > ref.y) ref = h;
    });
    const elevacion = (ref.y - y) / ancho;
    let salto = false;

    if (!enSalto) {
      const mismaDistancia = Math.abs(ancho / ref.ancho - 1) < 0.12;
      const caderasSuben = yc === null || ref.yc === null || ref.yc - yc > (ref.y - y) * 0.5;
      if (elevacion > a.salto && mismaDistancia && caderasSuben) candidato++;
      else candidato = 0;
      if (candidato >= 2) {
        enSalto = true;
        tSalto = ahora;
        yDespegue = ref.y;
        candidato = 0;
        salto = true;
      }
    } else {
      // Aterrizado: vuelve cerca de la altura de despegue (o pasa el tiempo máximo).
      const aterrizado = (y - yDespegue) / ancho > -0.12 && ahora - tSalto > 300;
      if (aterrizado || ahora - tSalto > 1500) {
        enSalto = false;
        historial = [];
      }
    }

    return { presente: true, dir, salto, giro: giroSuave, elevacion };
  }

  return {
    procesar,
    /** La postura actual pasa a ser «mirando de frente». */
    centrar: () => {
      offset = ultimoGiro;
      giroSuave = 0;
      dir = 0;
    },
    /** 'brazos' | 'cabeza' (se recuerda en este navegador). */
    setModoDireccion: (modo) => {
      a.modoDir = modo === 'cabeza' ? 'cabeza' : 'brazos';
      dir = 0;
      try {
        localStorage.setItem(LS_MODO, a.modoDir);
      } catch {
        /* sin almacenamiento */
      }
    },
    /** 'alta' | 'normal' | 'baja' (se recuerda en este navegador). */
    setSensibilidadSalto: (nivel) => {
      if (!SENSIBILIDAD_SALTO[nivel]) return;
      a.salto = SENSIBILIDAD_SALTO[nivel];
      try {
        localStorage.setItem(LS_SENSIBILIDAD, nivel);
      } catch {
        /* sin almacenamiento */
      }
    },
  };
}

/**
 * Se suscribe a los gestos: fn(gestos, persona) en cada fotograma.
 * Devuelve { baja(), centrar() }.
 */
export function escucharControlCuerpo(fn, ajustes) {
  const det = crearDetectorGestos(ajustes);
  const baja = escucharPose((persona) => fn(det.procesar(persona, performance.now()), persona));
  return { baja, centrar: det.centrar, setSensibilidadSalto: det.setSensibilidadSalto, setModoDireccion: det.setModoDireccion };
}
