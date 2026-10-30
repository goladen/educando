// Reconocimiento del CUERPO COMPLETO con la webcam (MediaPipe Pose Landmarker).
// Todo se procesa en el navegador: no se envía vídeo a ningún servidor.
//
// Servicio SINGLETON (como manos/manosVision.js): una cámara y un detector para toda
// la web. `escucharPose(fn)` recibe en cada fotograma la persona detectada (o null);
// al irse el último suscriptor se apaga la cámara.
//
// Cada persona trae:
//   puntos[33] → { x, y, v } en la imagen EN ESPEJO (0-1) y visibilidad 0-1.
//   mundo[33]  → { x, y, z } en METROS, centrado en las caderas y ya en ejes de three.js
//                como un espejo: x a la derecha de la PANTALLA, y hacia arriba, z hacia
//                la cámara. Así la mano derecha del alumno mueve el brazo que queda a la
//                derecha de la pantalla.

const VERSION_MP = '0.10.21'; // la misma que la de npm (@mediapipe/tasks-vision)
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MP}/wasm`;
const MODELO_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** Índices de MediaPipe Pose que se usan. */
export const P = {
  NARIZ: 0,
  OREJA_I: 7,
  OREJA_D: 8,
  HOMBRO_I: 11,
  HOMBRO_D: 12,
  CODO_I: 13,
  CODO_D: 14,
  MUNECA_I: 15,
  MUNECA_D: 16,
  CADERA_I: 23,
  CADERA_D: 24,
  RODILLA_I: 25,
  RODILLA_D: 26,
  TOBILLO_I: 27,
  TOBILLO_D: 28,
};

/** Huesos para dibujar el esqueleto en la vista previa. */
export const CONEXIONES_POSE = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [7, 0], [0, 8],
];

let detector = null;
let cargando = null;
let maxPersonas = 1; // setMaxPersonas(2) para los modos por parejas
let personasActuales = [];
let video = null;
let stream = null;
let camaraPromesa = null;
let raf = 0;
let ultimoTiempo = -1;
let actual = null;
const suscriptores = new Set();
const escuchasEstado = new Set();
let estado = { estado: 'apagado', error: '' }; // apagado | cargando | listo | error

function emitirEstado(parcial) {
  estado = { ...estado, ...parcial };
  escuchasEstado.forEach((fn) => fn(estado));
}

async function cargarDetector() {
  if (detector) return detector;
  if (!cargando) {
    cargando = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const opciones = (delegate) => ({
        baseOptions: { modelAssetPath: MODELO_URL, delegate },
        runningMode: 'VIDEO',
        numPoses: maxPersonas,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        detector = await PoseLandmarker.createFromOptions(fileset, opciones('GPU'));
      } catch {
        detector = await PoseLandmarker.createFromOptions(fileset, opciones('CPU'));
      }
      return detector;
    })().catch((e) => {
      cargando = null;
      throw e;
    });
  }
  return cargando;
}

async function encenderCamara() {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
  if (!camaraPromesa) {
    camaraPromesa = (async () => {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.srcObject = s;
      await v.play();
      stream = s;
      video = v;
    })().finally(() => {
      camaraPromesa = null;
    });
  }
  return camaraPromesa;
}

function apagarCamara() {
  cancelAnimationFrame(raf);
  raf = 0;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (video) video.srcObject = null;
  video = null;
  ultimoTiempo = -1;
  actual = null;
  personasActuales = [];
}

function bucle() {
  raf = requestAnimationFrame(bucle);
  if (!video || !detector || video.readyState < 2) return;
  if (video.currentTime === ultimoTiempo) return;
  ultimoTiempo = video.currentTime;
  let res;
  try {
    res = detector.detectForVideo(video, performance.now());
  } catch {
    return;
  }
  personasActuales = (res.landmarks || [])
    .map((lm, i) => {
      const w = res.worldLandmarks?.[i];
      if (!lm || !w) return null;
      return {
        puntos: lm.map((q) => ({ x: 1 - q.x, y: q.y, v: q.visibility ?? 1 })),
        mundo: w.map((q) => ({ x: -q.x, y: -q.y, z: -q.z })),
      };
    })
    .filter(Boolean)
    // De izquierda a derecha de la pantalla (por el centro de las caderas)
    .sort((a, b) => a.puntos[P.CADERA_I].x + a.puntos[P.CADERA_D].x - (b.puntos[P.CADERA_I].x + b.puntos[P.CADERA_D].x));
  actual = personasActuales[0] || null;
  suscriptores.forEach((fn) => {
    try {
      fn(actual, personasActuales);
    } catch (e) {
      console.error(e);
    }
  });
}

async function arrancar() {
  if (estado.estado === 'listo' || estado.estado === 'cargando') return;
  emitirEstado({ estado: 'cargando', error: '' });
  try {
    await Promise.all([cargarDetector(), encenderCamara()]);
    if (!suscriptores.size) {
      apagarCamara();
      emitirEstado({ estado: 'apagado' });
      return;
    }
    emitirEstado({ estado: 'listo' });
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bucle);
  } catch (e) {
    apagarCamara();
    const msg =
      e?.name === 'NotAllowedError'
        ? 'No se ha dado permiso para usar la cámara.'
        : e?.name === 'NotFoundError'
          ? 'No se ha encontrado ninguna cámara.'
          : e?.name === 'NotReadableError'
            ? 'La cámara está ocupada por otra aplicación o pestaña.'
            : e?.message || 'No se ha podido iniciar el reconocimiento del cuerpo.';
    emitirEstado({ estado: 'error', error: msg });
  }
}

/**
 * Cuántas personas se buscan (1 o 2). Con 2, los suscriptores reciben como segundo
 * argumento la lista ordenada de izquierda a derecha de la pantalla.
 */
export function setMaxPersonas(n) {
  maxPersonas = Math.max(1, Math.min(4, n | 0));
  detector?.setOptions({ numPoses: maxPersonas }).catch?.(() => {});
}

/** Se suscribe a la persona detectada: fn(persona | null, personas[]) (enciende la cámara si hace falta). Devuelve la baja. */
export function escucharPose(fn) {
  suscriptores.add(fn);
  arrancar();
  return () => {
    suscriptores.delete(fn);
    if (!suscriptores.size) {
      apagarCamara();
      emitirEstado({ estado: 'apagado', error: '' });
    }
  };
}

export function escucharEstadoPose(fn) {
  escuchasEstado.add(fn);
  fn(estado);
  return () => escuchasEstado.delete(fn);
}

export function reintentarPose() {
  if (estado.estado === 'error') {
    emitirEstado({ estado: 'apagado', error: '' });
    if (suscriptores.size) arrancar();
  }
}

export const getVideoPose = () => video;
export const getPose = () => actual;
export const getPersonas = () => personasActuales;
