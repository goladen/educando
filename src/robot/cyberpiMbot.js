// Conexión directa con el CyberPi del mBot2 para conducirlo en tiempo real
// (mano, mando micro:bit o teclado). Usa el mismo protocolo de tramas de mBlock
// que el editor de bloques (F3 … F4 con python dentro), pero aquí solo se envían
// órdenes cortas `mbot2.drive_power(izq, der)`: nada de bucles, así la placa
// sigue aceptando tramas.
//
// SINGLETON: la conexión sobrevive entre vistas. Puede convivir con la antena
// de los mandos micro:bit (son dos puertos serie distintos).
//
// ⚠ drive_power se queda aplicado hasta la siguiente orden: quien conduzca debe
// mandar (0,0) al perder la entrada. `pararMbot()` lo hace al momento.

// DOS MODOS:
//   'cable'  → el CyberPi del robot está por USB y ejecuta drive_power directamente.
//   'antena' → por USB hay OTRO CyberPi que reenvía las órdenes por «broadcast LAN»
//              (ESP-NOW, sin router) al CyberPi del robot, que ejecuta PROGRAMA_RECEPTOR.
//              Mensaje "pk" = "seq,izq,der,pitidos". Si el robot deja de recibir 1 s, se para solo.

const ENC = new TextEncoder();
const DEC = new TextDecoder();
const INTERVALO_MS = 110; // ~9 órdenes por segundo como mucho
const REENVIO_MS = 1500; // repite la orden aunque no cambie (por si se perdió una trama)
const LATIDO_ANTENA_MS = 350; // en modo antena se repite siempre: el receptor se para sin latido

/** Programa para el CyberPi del ROBOT en modo sin cable (también se puede subir con mBlock). */
export const PROGRAMA_RECEPTOR = `import cyberpi, mbot2, time
try:
    from time import ticks_ms, ticks_diff
except ImportError:
    def ticks_ms():
        return int(cyberpi.timer.get() * 1000)
    def ticks_diff(a, b):
        return a - b

cyberpi.console.clear()
cyberpi.console.println("PiKT: receptor")
cyberpi.console.println("esperando ordenes")
cyberpi.led.on(0, 0, 255)
previo = ""
pitidos = None
ultimo = ticks_ms()
parado = True
while True:
    m = cyberpi.wifi_broadcast.get("pk")
    if m and m != previo:
        previo = m
        ultimo = ticks_ms()
        p = str(m).split(",")
        if len(p) >= 3:
            mbot2.drive_power(int(p[1]), int(p[2]))
            if parado:
                cyberpi.led.on(0, 255, 0)
                parado = False
        if len(p) >= 4:
            if pitidos is not None and p[3] != pitidos:
                cyberpi.audio.play_tone(660, 0.12)
            pitidos = p[3]
    elif not parado and ticks_diff(ticks_ms(), ultimo) > 1000:
        mbot2.drive_power(0, 0)
        cyberpi.led.on(255, 120, 0)
        parado = True
    time.sleep(0.02)
`;

/** Trama del protocolo de mBlock con python a ejecutar (modo sentencias 0x04). */
export function tramaCyberpi(py) {
  const pb = ENC.encode(py);
  const data = [0x28, 0x04, 0x00, 0x00, pb.length & 0xff, (pb.length >> 8) & 0xff, ...pb];
  let chk = 0;
  for (const b of data) chk = (chk + b) & 0xff;
  const len = data.length;
  return new Uint8Array([0xf3, (len - 13) & 0xff, len & 0xff, (len >> 8) & 0xff, ...data, chk, 0xf4]);
}

let puerto = null;
let escritor = null;
let lector = null;
let acumulado = '';
let estado = { estado: 'desconectado', error: '' }; // desconectado | conectando | listo | sin_respuesta | error
const oyentes = new Set();

let deseado = [0, 0];
let enviado = null;
let ultimoEnvio = 0;
let escribiendo = false;
let temporizador = 0;
let modo = 'cable'; // 'cable' | 'antena'
let seq = 0;
let pitidos = 0;
let pitidosEnviados = 0;

const ordenDrive = (l, r) =>
  modo === 'antena'
    ? `import cyberpi\ncyberpi.wifi_broadcast.set("pk", "${(seq = (seq + 1) % 10000)},${l},${r},${pitidos}")`
    : `import mbot2\nmbot2.drive_power(${l},${r})`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const emitir = (parcial) => {
  estado = { ...estado, ...parcial };
  oyentes.forEach((fn) => fn(estado));
};

export const soportaSerialCyberpi = () => typeof navigator !== 'undefined' && 'serial' in navigator;

async function escribir(bytes) {
  if (!escritor) return;
  await escritor.write(bytes);
}

async function bucleLectura() {
  try {
    while (puerto?.readable && lector) {
      const { value, done } = await lector.read();
      if (done) break;
      if (value) acumulado = (acumulado + DEC.decode(value)).slice(-3000);
    }
  } catch {
    /* puerto cerrado o placa desenchufada */
  }
  if (puerto) {
    limpiar();
    emitir({ estado: 'desconectado', error: 'Se ha perdido la conexión con el CyberPi.' });
  }
}

/** Espera la respuesta {"ret"…} / {"err"…} de la última trama (acumulado se vacía antes de enviar). */
async function esperarRespuesta(ms = 1500) {
  for (let t = 0; t < ms; t += 50) {
    const m = acumulado.match(/\{"(ret|err)"[^}]*\}/);
    if (m) return m[0];
    await dormir(50);
  }
  return null;
}

/**
 * Guarda un archivo en la placa por trozos. Probado con el firmware 44.01: una trama
 * con más de ~240 bytes de python se ignora o reinicia el intérprete, así que cada
 * trama lleva como mucho MAX_TRAMA_PY bytes.
 */
const MAX_TRAMA_PY = 220;
async function subirArchivo(nombre, texto) {
  let pos = 0;
  let modoArchivo = 'w';
  while (pos < texto.length) {
    let n = Math.min(170, texto.length - pos);
    let py;
    for (;;) {
      py = `f=open('${nombre}','${modoArchivo}')\nf.write(${JSON.stringify(texto.slice(pos, pos + n))})\nf.close()`;
      if (ENC.encode(py).length <= MAX_TRAMA_PY || n <= 10) break;
      n -= 10;
    }
    acumulado = '';
    await escribir(tramaCyberpi(py));
    const r = await esperarRespuesta();
    if (!r || r.startsWith('{"err"')) throw new Error(r || 'La placa no confirmó la escritura del archivo.');
    // {"ret"} llega ANTES de que termine de ejecutarse: si la siguiente trama entra
    // enseguida, interrumpe la escritura (se perdía el último trozo).
    await dormir(250);
    pos += n;
    modoArchivo = 'a';
  }
}

/** Tamaño en bytes de un archivo de la placa (lo imprime por serie), o -1. */
async function tamanoArchivo(nombre) {
  acumulado = '';
  await escribir(tramaCyberpi(`import os\ntry:\n    print('TAM=' + str(os.stat('${nombre}')[6]))\nexcept:\n    print('TAM=-1')`));
  for (let t = 0; t < 2000; t += 50) {
    const m = acumulado.match(/TAM=(-?\d+)/);
    if (m) return Number(m[1]);
    await dormir(50);
  }
  return -1;
}

/** Sondea con una trama vacía hasta que el gestor de tramas responda. */
async function esperarListo(intentos = 24) {
  const sonda = tramaCyberpi('pass');
  for (let i = 0; i < intentos; i++) {
    acumulado = '';
    await escribir(sonda);
    await dormir(500);
    if (/\{"ret"|\{"err"/.test(acumulado)) return true;
  }
  return false;
}

async function pulsoReset() {
  try {
    await puerto.setSignals({ dataTerminalReady: false, requestToSend: true });
    await dormir(150);
    await puerto.setSignals({ dataTerminalReady: false, requestToSend: false });
  } catch {
    /* algunos drivers no permiten setSignals */
  }
}

function limpiar() {
  clearInterval(temporizador);
  temporizador = 0;
  try {
    lector?.cancel();
  } catch {
    /* ignorar */
  }
  try {
    escritor?.releaseLock();
  } catch {
    /* ignorar */
  }
  const p = puerto;
  puerto = null;
  escritor = null;
  lector = null;
  enviado = null;
  setTimeout(() => p?.close().catch(() => {}), 60);
}

async function tic() {
  if (!escritor || escribiendo || estado.estado !== 'listo') return;
  const ahora = Date.now();
  const igual = enviado && enviado[0] === deseado[0] && enviado[1] === deseado[1] && pitidos === pitidosEnviados;
  if (igual && ahora - ultimoEnvio < (modo === 'antena' ? LATIDO_ANTENA_MS : REENVIO_MS)) return;
  const [l, r] = deseado;
  escribiendo = true;
  try {
    await escribir(tramaCyberpi(ordenDrive(l, r)));
    enviado = [l, r];
    pitidosEnviados = pitidos;
    ultimoEnvio = ahora;
  } catch {
    /* se reintenta en el siguiente tic */
  }
  escribiendo = false;
}

// ── API pública ─────────────────────────────────────────────────────────────

export function escucharEstadoCyberpi(fn) {
  oyentes.add(fn);
  fn(estado);
  return () => oyentes.delete(fn);
}

export const getEstadoCyberpi = () => estado;

/** Pide el puerto y deja el CyberPi listo para recibir órdenes. */
export async function conectarCyberpi() {
  if (!soportaSerialCyberpi()) {
    emitir({ estado: 'error', error: 'Este navegador no permite Web Serial: usa Chrome o Edge en el ordenador.' });
    return false;
  }
  if (puerto) await desconectarCyberpi();
  let p;
  try {
    p = await navigator.serial.requestPort();
  } catch {
    return false; // cancelado
  }
  emitir({ estado: 'conectando', error: '' });
  try {
    await p.open({ baudRate: 115200 });
    puerto = p;
    await pulsoReset(); // arranque NORMAL del ESP32 (no bootloader)
    escritor = p.writable.getWriter();
    lector = p.readable.getReader();
    bucleLectura();
    const ok = await esperarListo();
    if (!puerto) return false;
    if (!ok) {
      emitir({ estado: 'sin_respuesta', error: 'El CyberPi no responde. Comprueba que no esté abierto en mBlock o en el editor de bloques y pulsa «Reiniciar».' });
      return false;
    }
    deseado = [0, 0];
    enviado = null;
    emitir({ estado: 'listo', error: '' });
    temporizador = setInterval(tic, INTERVALO_MS);
    tic();
    return true;
  } catch (e) {
    limpiar();
    emitir({ estado: 'error', error: e?.message || 'No se ha podido abrir el puerto.' });
    return false;
  }
}

/** Reinicia el CyberPi (si se quedó ejecutando otro programa) y espera a que responda. */
export async function reiniciarCyberpi() {
  if (!puerto) return conectarCyberpi();
  emitir({ estado: 'conectando', error: '' });
  clearInterval(temporizador);
  await pulsoReset();
  await dormir(2500); // el arranque del ESP32 tarda varios segundos
  const ok = await esperarListo(30);
  if (!ok) {
    emitir({ estado: 'sin_respuesta', error: 'El CyberPi sigue sin responder. Desenchúfalo, vuelve a enchufarlo y conecta otra vez.' });
    return false;
  }
  enviado = null;
  emitir({ estado: 'listo', error: '' });
  temporizador = setInterval(tic, INTERVALO_MS);
  return true;
}

export async function desconectarCyberpi() {
  if (!puerto) return;
  try {
    if (estado.estado === 'listo') await escribir(tramaCyberpi(ordenDrive(0, 0)));
  } catch {
    /* ignorar */
  }
  limpiar();
  emitir({ estado: 'desconectado', error: '' });
}

/**
 * Potencia de cada rueda, -100 … 100 (positivo = hacia delante). Se envía sola
 * (limitada en frecuencia). drive_power es «en bruto» y los motores del mBot2 van en
 * espejo: para avanzar la derecha va en negativo (comprobado con los encoders:
 * drive_power(30, 30) gira sobre sí mismo).
 */
export function moverMbot(izq, der) {
  const c = (v) => Math.max(-100, Math.min(100, Math.round(v)));
  deseado = [c(izq), -c(der) || 0];
}

/** Para el robot YA (sin esperar al siguiente tic). */
export function pararMbot() {
  deseado = [0, 0];
  if (escritor && estado.estado === 'listo') {
    enviado = [0, 0];
    ultimoEnvio = Date.now();
    escribir(tramaCyberpi(ordenDrive(0, 0))).catch(() => {});
  }
}

/** Pitido corto en el altavoz del CyberPi del robot. */
export function pitarMbot() {
  if (!escritor || estado.estado !== 'listo') return;
  if (modo === 'antena') pitidos = (pitidos + 1) % 10; // viaja en el siguiente mensaje
  else escribir(tramaCyberpi('import cyberpi\ncyberpi.audio.play_tone(660, 0.15)')).catch(() => {});
}

/** 'cable' (robot por USB) o 'antena' (otro CyberPi por USB reenvía por broadcast LAN). */
export function setModoCyberpi(m) {
  if (m === modo) return;
  pararMbot();
  modo = m === 'antena' ? 'antena' : 'cable';
  enviado = null;
}
export const getModoCyberpi = () => modo;

/**
 * Con el CyberPi del ROBOT conectado por USB: guarda PROGRAMA_RECEPTOR como
 * pikt_rx.py (por trozos: el programa entero no cabe en una trama), lo arranca con
 * `import` en un hilo propio y suelta el puerto. Con `exec` no valdría: en este
 * firmware las funciones de un exec no ven sus variables globales. Sigue funcionando al quitar el cable
 * mientras el mBot2 esté encendido (al apagarlo hay que volver a instalarlo).
 */
export async function instalarReceptor() {
  const ok = await conectarCyberpi(); // siempre pide puerto: el de la antena no vale
  if (!ok) return false;
  clearInterval(temporizador); // que no se cuelen órdenes de conducción entre los trozos
  temporizador = 0;
  try {
    emitir({ estado: 'conectando', error: '' });
    acumulado = '';
    await escribir(tramaCyberpi('import mbot2\nmbot2.drive_power(0,0)'));
    await esperarRespuesta();
    const esperado = ENC.encode(PROGRAMA_RECEPTOR).length;
    let tam = -1;
    for (let intento = 0; intento < 3 && tam !== esperado; intento++) {
      await subirArchivo('pikt_rx.py', PROGRAMA_RECEPTOR);
      await dormir(300);
      tam = await tamanoArchivo('pikt_rx.py');
    }
    if (tam !== esperado) throw new Error(`el archivo quedó incompleto (${tam} de ${esperado} bytes)`);
    await dormir(300);
    acumulado = '';
    // Las tramas corren en un hilo con poca pila (7 KB): `import pikt_rx` a secas lo
    // desborda («stack overflow in task mp_thread») y la placa se reinicia. Se lanza
    // en un hilo propio con 16 KB; la placa sigue atendiendo tramas.
    await escribir(
      tramaCyberpi('import _thread\ndef _rx():\n    import pikt_rx\n_thread.stack_size(16384)\n_thread.start_new_thread(_rx, ())')
    );
    await dormir(1500);
    const err = acumulado.match(/\{"err"[^}]*\}|stack overflow|Rebooting|Traceback[^\r\n]*/);
    if (err) throw new Error(err[0]);
  } catch (e) {
    limpiar();
    emitir({ estado: 'error', error: 'No se pudo instalar el receptor: ' + (e?.message || e) });
    return false;
  }
  limpiar(); // el receptor ocupa la placa: la soltamos
  emitir({ estado: 'desconectado', error: '' });
  return true;
}
