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
let modo = 'cable'; // 'cable' | 'antena' | 'bluetooth'
let seq = 0;
let pitidos = 0;
let pitidosEnviados = 0;

const ordenDrive = (l, r) =>
  modo === 'antena'
    ? `import cyberpi\ncyberpi.wifi_broadcast.set("pk", "${(seq = (seq + 1) % 10000)},${l},${r},${pitidos}")`
    : modo === 'bluetooth'
      ? `import mbot2,time\nmbot2.drive_power(${l},${r})\ntry:\n    import pku\n    pku.t=time.ticks_ms()\nexcept:\n    pass`
      : `import mbot2\nmbot2.drive_power(${l},${r})`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const emitir = (parcial) => {
  estado = { ...estado, ...parcial };
  oyentes.forEach((fn) => fn(estado));
};

export const soportaSerialCyberpi = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const soportaBluetoothCyberpi = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;

// ── Bluetooth (BLE): el mismo canal que el «modo en vivo» de mBlock, con las mismas tramas.
// Características ffe2/ffe3 y paquetes de 20 bytes según github.com/DrorSh/mbot_python (MIT).
const UUID_BLE = (n) => `0000${n.toString(16)}-0000-1000-8000-00805f9b34fb`;
const SERVICIOS_BLE = [0xffe0, 0xffe1, 0xffe2, 0xffe3, 0xffe4, 0xffe5].map(UUID_BLE); // no consta cuál es: se busca
const NOMBRES_BLE = ['Makeblock', 'makeblock', 'MAKEBLOCK', 'CyberPi', 'Cyberpi', 'cyberpi', 'CYBERPI', 'mBot', 'MBot', 'mbot', 'MBOT', 'BlueFi', 'Bluefi', 'bluefi'];
const TROZO_BLE = 20;
const PAUSA_BLE_MS = 8;
const TRAMA_MODO_VIVO = new Uint8Array([0xf3, 0xf6, 0x03, 0x00, 0x0d, 0x00, 0x01, 0x0e, 0xf4]);

async function buscarCanalBle(servidor) {
  const servicios = await servidor.getPrimaryServices();
  let salida = null;
  let entrada = null;
  for (const sv of servicios) {
    const cars = await sv.getCharacteristics().catch(() => []);
    for (const c of cars) {
      if (c.uuid === UUID_BLE(0xffe3)) salida = c;
      if (c.uuid === UUID_BLE(0xffe2)) entrada = c;
    }
  }
  return salida && entrada ? { salida, entrada } : null;
}

async function conectarBluetooth() {
  if (!soportaBluetoothCyberpi()) {
    emitir({ estado: 'error', error: 'Este navegador no permite Bluetooth: usa Chrome en Android o en el ordenador (en iPhone no funciona con Safari).' });
    return false;
  }
  if (puerto) await desconectarCyberpi();
  let disp;
  try {
    disp = await navigator.bluetooth.requestDevice({
      filters: NOMBRES_BLE.map((namePrefix) => ({ namePrefix })),
      optionalServices: SERVICIOS_BLE,
    });
  } catch {
    return false; // cancelado
  }
  emitir({ estado: 'conectando', error: '' });
  let modoVivoUsado = false;
  try {
    const servidor = await disp.gatt.connect();
    const canal = await buscarCanalBle(servidor);
    if (!canal) throw new Error('Este dispositivo no tiene el canal de datos esperado.');
    canal.entrada.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      acumulado = (acumulado + DEC.decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))).slice(-3000);
    });
    await canal.entrada.startNotifications();
    // Cola: dos tramas a la vez se mezclarían y BLE no admite escrituras simultáneas.
    let cola = Promise.resolve();
    const escritorBle = {
      write: (bytes) => {
        cola = cola.catch(() => {}).then(async () => {
          for (let i = 0; i < bytes.length; i += TROZO_BLE) {
            await canal.salida.writeValueWithoutResponse(bytes.slice(i, i + TROZO_BLE));
            await dormir(PAUSA_BLE_MS);
          }
        });
        return cola;
      },
      releaseLock() {},
    };
    const puertoBle = { close: async () => disp.gatt.disconnect() };
    puerto = puertoBle;
    escritor = escritorBle;
    disp.addEventListener('gattserverdisconnected', () => {
      if (puerto !== puertoBle) return;
      limpiar();
      emitir({ estado: 'desconectado', error: 'Se ha perdido la conexión Bluetooth con el CyberPi.' });
    });
    // El «modo en vivo» cierra el programa abierto en el robot (el test de la ranura 8): solo
    // se usa si el robot no contesta sin él.
    let ok = await esperarListo(5);
    if (!ok && puerto) {
      await escribir(TRAMA_MODO_VIVO);
      await dormir(500);
      ok = await esperarListo(4);
      modoVivoUsado = true;
    }
    if (!puerto) return false;
    deseado = [0, 0];
    enviado = null;
    // Sin confirmación puede aceptar órdenes igualmente: se deja usar y se avisa.
    emitir({
      estado: 'listo',
      error: !ok
        ? 'El CyberPi no ha confirmado la conexión. Si el robot no se mueve, reinícialo y vuelve a conectar.'
        : modoVivoUsado
          ? 'Conectado, pero el robot ha cerrado su programa: «Preguntar» no funcionará.'
          : '',
    });
    temporizador = setInterval(tic, INTERVALO_MS);
    tic();
    return true;
  } catch (e) {
    limpiar();
    try {
      disp.gatt.disconnect();
    } catch {
      /* ignorar */
    }
    emitir({ estado: 'error', error: e?.message || 'No se ha podido conectar por Bluetooth.' });
    return false;
  }
}

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
  if (igual && ahora - ultimoEnvio < (modo === 'cable' ? REENVIO_MS : LATIDO_ANTENA_MS)) return;
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
  if (modo === 'bluetooth') return conectarBluetooth();
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

/** 'cable' (robot por USB), 'antena' (otro CyberPi por USB reenvía por broadcast LAN) o 'bluetooth' (directo al robot). */
export function setModoCyberpi(m) {
  if (m === modo) return;
  pararMbot();
  modo = m === 'antena' || m === 'bluetooth' ? m : 'cable';
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

// ── Test guardado en el robot (ranura 8 de «switch program») ────────────────
// Las tramas no pueden usar la pantalla: el menú de fábrica la tapa. Dentro de una ranura sí.

const MARCA_TEST = '# PIKT TEST';
const RANURA_TEST = '/flash/main8.py';
const DATOS_TEST = '/flash/pikt_test.json';
const TROZO_BIN = 135; // bytes por trama: en base64 + la orden no pasan de MAX_TRAMA_PY
const AUX_LINEAS = ['import ubinascii as u', 'p=0', 't=0', 'f=None', 'def a(n):', '    global f', '    f=open(n,"wb")', 'def w(s):', '    f.write(u.a2b_base64(s))', 'def c():', '    global f', '    f.close()', '    f=None'];

export const PROGRAMA_TEST = `${MARCA_TEST}
import cyberpi, time, ujson, random, pku, mbot2
c = cyberpi.console
j = cyberpi.controller
a = cyberpi.audio
f = open('${DATOS_TEST}')
T = ujson.load(f)
f.close()
a.set_vol(100)
pku.p = 0
pku.t = 0
ok = 0
hechas = 0
orden = []

def freno():
    # Sin órdenes de la web durante 1 s (Bluetooth cortado): el robot se para.
    if pku.t and time.ticks_diff(time.ticks_ms(), pku.t) > 1000:
        pku.t = 0
        mbot2.drive_power(0, 0)

def pulsa(b):
    if j.is_press(b):
        while j.is_press(b):
            freno()
            time.sleep(0.02)
        return True
    return False

def ver(q, s):
    c.clear()
    for n in range(len(q['o'])):
        c.println(('> ' if n == s else '  ') + 'ABCD'[n] + ') ' + q['o'][n])

def reposo():
    c.clear()
    c.println('Aciertos: ' + str(ok) + '/' + str(hechas))
    c.println('A: pregunta')

def pregunta(q):
    global ok, hechas
    n = len(q['o'])
    s = 0
    ver(q, s)
    a.play(q['a'])
    while True:
        if pulsa('up'):
            s = (s - 1) % n
            ver(q, s)
        elif pulsa('down'):
            s = (s + 1) % n
            ver(q, s)
        elif pulsa('a') or pku.p:
            pku.p = 0
            a.stop()
            a.play(q['a'])
        elif pulsa('middle'):
            break
        freno()
        time.sleep(0.03)
    a.stop()
    hechas += 1
    c.clear()
    if s == q['c']:
        ok += 1
        cyberpi.led.on(0, 255, 0)
        c.println('Correcto!')
        a.play('right')
    else:
        cyberpi.led.on(255, 0, 0)
        c.println('Era la ' + 'ABCD'[q['c']] + ':')
        c.println(q['o'][q['c']])
        a.play('wrong')
    for i in range(40):
        freno()
        time.sleep(0.05)
    cyberpi.led.off()

reposo()
while True:
    if pku.p or pulsa('a'):
        pku.p = 0
        if not orden:
            orden = list(range(len(T)))
            for i in range(len(orden) - 1, 0, -1):
                k = random.randint(0, i)
                orden[i], orden[k] = orden[k], orden[i]
        pregunta(T[orden.pop()])
        pku.p = 0
        reposo()
    freno()
    time.sleep(0.05)
`;

/**
 * Con el test de la ranura 8 abierto: el robot lee la siguiente pregunta (o repite la que está
 * en curso). Devuelve { ok, detalle } con lo que ha contestado la placa.
 */
export async function preguntarRobot() {
  if (!escritor || estado.estado !== 'listo') return { ok: false, detalle: 'El robot no está conectado.' };
  try {
    acumulado = '';
    await escribir(tramaCyberpi('import pku\npku.p=1\nprint("PREG="+str(pku.p))'));
    for (let t = 0; t < 2000; t += 50) {
      const err = errorPlaca();
      if (err) return { ok: false, detalle: err };
      if (/PREG=1|\{"ret"/.test(acumulado)) return { ok: true, detalle: 'El robot ha recibido la orden.' };
      await dormir(50);
    }
    return { ok: false, detalle: 'Orden enviada, pero el robot no ha contestado.' };
  } catch (e) {
    return { ok: false, detalle: e?.message || 'No se ha podido enviar la orden.' };
  }
}

const hayFin = () => /\{"(ret|err)"|eval immediatly err/.test(acumulado);
const errorPlaca = () => acumulado.match(/eval immediatly err[^\r\n]*|\{"err"[^}]*\}/)?.[0];

/** Envía python y espera a que la placa responda; devuelve lo que ha impreso. */
async function ejecutar(py, ms = 4000) {
  acumulado = '';
  await escribir(tramaCyberpi(py));
  for (let t = 0; t < ms && !hayFin(); t += 5) await dormir(5);
  if (!hayFin()) throw new Error('la placa ha dejado de responder');
  const err = errorPlaca();
  if (err) throw new Error(err);
  return acumulado;
}

const aBase64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

async function tamanoEnPlaca(ruta) {
  const r = await ejecutar('import os\ntry:\n    print("TAM="+str(os.stat("' + ruta + '")[6]))\nexcept:\n    print("TAM=-1")');
  await dormir(100);
  return Number((acumulado + r).match(/TAM=(-?\d+)/)?.[1] ?? -1);
}

/** Guarda bytes en un archivo dejándolo abierto entre tramas: 5 veces más rápido que abrirlo cada vez. */
async function subirBinario(ruta, bytes, { cancelado, onBytes } = {}) {
  for (let intento = 0; ; intento++) {
    await ejecutar('import pku\npku.a("' + ruta + '")');
    await dormir(100);
    for (let o = 0; o < bytes.length; o += TROZO_BIN) {
      if (cancelado?.()) {
        await ejecutar('import pku\npku.c()');
        throw new Error('Carga cancelada.');
      }
      await ejecutar('import pku\npku.w("' + aBase64(bytes.subarray(o, o + TROZO_BIN)) + '")', 2000);
      await dormir(40); // {"ret"} llega antes de que termine de escribir
      onBytes?.(Math.min(TROZO_BIN, bytes.length - o));
    }
    await ejecutar('import pku\npku.c()');
    await dormir(200);
    const tam = await tamanoEnPlaca(ruta);
    if (tam === bytes.length) return;
    if (intento >= 1) throw new Error('el archivo ' + ruta + ' ha quedado incompleto (' + tam + ' de ' + bytes.length + ' bytes)');
  }
}

// La pantalla del CyberPi lee peor las tildes: se quitan, conservando la Ñ. La voz no se ve afectada.
const textoPantalla = (t) =>
  String(t)
    .replace(/[¿¡]/g, '')
    .replace(/ñ/g, '')
    .replace(/Ñ/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(//g, 'ñ')
    .replace(//g, 'Ñ');

/**
 * Pide el puerto para cargar un test. Hay que llamarla directamente desde el clic: pasado un
 * rato el navegador bloquea la ventana de elegir puerto. Devuelve false si se cancela.
 */
export async function prepararCargaTest() {
  setModoCyberpi('cable');
  const ok = await conectarCyberpi();
  if (!ok && (estado.estado === 'sin_respuesta' || estado.estado === 'error')) throw new Error(estado.error);
  return ok;
}

/**
 * Guarda un test en la ranura 8, con el puerto ya abierto por prepararCargaTest.
 * preguntas = [{ mp3: Uint8Array, opciones: [..], correcta }]. No pisa un programa ajeno.
 */
export async function cargarTestEnRobot(preguntas, { onProgreso, cancelado } = {}) {
  if (!escritor) throw new Error('Se ha perdido la conexión con el robot.');
  clearInterval(temporizador); // que no se cuelen órdenes de conducción
  temporizador = 0;
  let hechos = 0;
  try {
    emitir({ estado: 'conectando', error: '' });
    await ejecutar('import mbot2\nmbot2.drive_power(0,0)');
    await dormir(200);
    const enRanura = await tamanoEnPlaca(RANURA_TEST);
    if (enRanura > 0) {
      const ini = await ejecutar('f=open("' + RANURA_TEST + '")\nprint("INI="+f.read(' + MARCA_TEST.length + '))\nf.close()');
      await dormir(100);
      if (!(acumulado + ini).includes('INI=' + MARCA_TEST)) {
        throw new Error('La ranura 8 del robot ya tiene otro programa. Para no borrarlo no se ha cargado nada; quítalo con mBlock y vuelve a probar.');
      }
    }
    onProgreso?.(0, 'Preparando el robot');
    for (let i = 0; i < AUX_LINEAS.length; i++) {
      await ejecutar('f=open("pku.py","' + (i ? 'a' : 'w') + '")\nf.write(' + JSON.stringify(AUX_LINEAS[i] + '\n') + ')\nf.close()');
      await dormir(150);
    }
    await ejecutar('import os\nfor f in os.listdir("/music"):\n    if f[:5]=="pikt_":\n        os.remove("/music/"+f)', 8000);
    await dormir(200);
    const r = await ejecutar('import os\nv=os.statvfs("/")\nprint("LIBRE="+str(v[0]*v[3]))');
    await dormir(100);
    const libre = Number((acumulado + r).match(/LIBRE=(\d+)/)?.[1] ?? 0);
    const total = preguntas.reduce((s, q) => s + q.mp3.length, 0);
    if (libre && total + 60000 > libre) {
      throw new Error('No cabe en el robot: ocupa ' + Math.round(total / 1024) + ' KB y hay ' + Math.round(libre / 1024) + ' KB libres. Prueba con menos preguntas.');
    }
    for (let i = 0; i < preguntas.length; i++) {
      await subirBinario('/music/pikt_q' + i + '.mp3', preguntas[i].mp3, {
        cancelado,
        onBytes: (n) => {
          hechos += n;
          onProgreso?.(hechos, 'Guardando la pregunta ' + (i + 1) + ' de ' + preguntas.length);
        },
      });
    }
    const datos = preguntas.map((q, i) => ({ a: 'pikt_q' + i, o: q.opciones.map((t) => textoPantalla(t).slice(0, 44)), c: q.correcta }));
    await subirBinario(DATOS_TEST, ENC.encode(JSON.stringify(datos)));
    await subirBinario(RANURA_TEST, ENC.encode(PROGRAMA_TEST));
  } catch (e) {
    limpiar();
    emitir({ estado: 'desconectado', error: '' });
    throw e;
  }
  limpiar();
  emitir({ estado: 'desconectado', error: '' });
  return true;
}
