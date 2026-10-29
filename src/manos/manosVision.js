// Reconocimiento de manos con la webcam (MediaPipe Hand Landmarker).
// Todo se procesa en el navegador: no se envía vídeo a ningún servidor.
//
// Servicio SINGLETON: una sola cámara y un solo detector para toda la web.
// Cada vista se suscribe con `escucharManos(fn)` y recibe en cada fotograma
// la lista de manos ya analizadas; al irse el último suscriptor se apaga la cámara.
//
// La librería (~1 MB de JS + wasm + modelo) se carga solo al activar las manos.

const VERSION_MP = '0.10.21';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MP}/wasm`;
const MODELO_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let detector = null;
let cargandoDetector = null;
let video = null;
let stream = null;
let raf = 0;
let ultimoTiempoVideo = -1;
let manosActuales = [];
const suscriptores = new Set();
const escuchasEstado = new Set();
let estado = { estado: 'apagado', error: '' }; // apagado | cargando | listo | error

function emitirEstado(parcial) {
  estado = { ...estado, ...parcial };
  escuchasEstado.forEach((fn) => fn(estado));
}

async function cargarDetector() {
  if (detector) return detector;
  if (!cargandoDetector) {
    cargandoDetector = (async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const opciones = (delegate) => ({
        baseOptions: { modelAssetPath: MODELO_URL, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        detector = await HandLandmarker.createFromOptions(fileset, opciones('GPU'));
      } catch {
        // Algunos portátiles del centro no tienen WebGL2 utilizable → CPU.
        detector = await HandLandmarker.createFromOptions(fileset, opciones('CPU'));
      }
      return detector;
    })().catch((e) => {
      cargandoDetector = null;
      throw e;
    });
  }
  return cargandoDetector;
}

// Una sola petición de cámara en curso: en desarrollo React monta los efectos dos
// veces y sin esto se abrían dos streams y el primero se quedaba encendido.
let camaraPromesa = null;

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
  ultimoTiempoVideo = -1;
  manosActuales = [];
}

// ── Análisis geométrico de una mano ─────────────────────────────────────────
// Coordenadas de MediaPipe normalizadas 0-1 sobre la imagen SIN espejo; aquí se
// devuelven ya en ESPEJO (como se ve uno en la pantalla): x = 0 a la izquierda.
const PUNTAS = [8, 12, 16, 20];
const ARTIC = [6, 10, 14, 18]; // PIP de cada dedo

function analizarMano(lm, aspecto) {
  const p = (i) => ({ x: (1 - lm[i].x) * aspecto, y: lm[i].y });
  const d = (a, b) => {
    const A = p(a);
    const B = p(b);
    return Math.hypot(A.x - B.x, A.y - B.y);
  };
  const tamano = d(0, 9) || 1e-6; // muñeca → nudillo del corazón
  // Dedo estirado: la punta queda claramente más lejos de la muñeca que su articulación.
  const estirados = PUNTAS.map((t, i) => d(0, t) > d(0, ARTIC[i]) * 1.12);
  const pulgar = d(4, 17) > tamano * 0.95 && d(4, 5) > tamano * 0.5;
  const dedos = estirados.filter(Boolean).length; // 0-4 (sin contar el pulgar)
  const espejo = (i) => ({ x: 1 - lm[i].x, y: lm[i].y });
  const centroIdx = [0, 5, 9, 13, 17];
  const centro = {
    x: centroIdx.reduce((s, i) => s + (1 - lm[i].x), 0) / centroIdx.length,
    y: centroIdx.reduce((s, i) => s + lm[i].y, 0) / centroIdx.length,
  };
  return {
    puntos: lm.map((q) => ({ x: 1 - q.x, y: q.y })),
    punta: espejo(8),
    centro,
    tamano: tamano / aspecto, // relativo al ancho de la imagen
    estirados,
    dedos,
    pulgar,
    abierta: dedos === 4 && pulgar,
    puno: dedos === 0 && !pulgar,
    pinza: d(4, 8) / tamano, // < ~0.35 = dedos juntos
  };
}

function bucle() {
  raf = requestAnimationFrame(bucle);
  if (!video || !detector || video.readyState < 2) return;
  if (video.currentTime === ultimoTiempoVideo) return;
  ultimoTiempoVideo = video.currentTime;
  let res;
  try {
    res = detector.detectForVideo(video, performance.now());
  } catch {
    return;
  }
  const aspecto = video.videoWidth / (video.videoHeight || 1) || 4 / 3;
  manosActuales = (res.landmarks || []).map((lm) => analizarMano(lm, aspecto));
  // La mano más grande (más cerca de la cámara) primero.
  manosActuales.sort((a, b) => b.tamano - a.tamano);
  suscriptores.forEach((fn) => {
    try {
      fn(manosActuales);
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
          : e?.message || 'No se ha podido iniciar el reconocimiento de manos.';
    emitirEstado({ estado: 'error', error: msg });
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/** Se suscribe a las manos detectadas (enciende la cámara si hace falta). Devuelve la baja. */
export function escucharManos(fn) {
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

/** Estado del servicio: { estado: 'apagado'|'cargando'|'listo'|'error', error }. Devuelve la baja. */
export function escucharEstadoManos(fn) {
  escuchasEstado.add(fn);
  fn(estado);
  return () => escuchasEstado.delete(fn);
}

/** Reintenta tras un error (p. ej. después de dar permiso a la cámara). */
export function reintentarManos() {
  if (estado.estado === 'error') {
    emitirEstado({ estado: 'apagado', error: '' });
    if (suscriptores.size) arrancar();
  }
}

/** Elemento <video> de la cámara (para pintar la vista previa) o null. */
export const getVideoManos = () => video;

/** Últimas manos detectadas. */
export const getManos = () => manosActuales;

/** Conexiones entre los 21 puntos, para dibujar el esqueleto de la mano. */
export const CONEXIONES_MANO = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
