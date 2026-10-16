// Mandos micro:bit para el aula (servicio compartido por todos los juegos).
//
// Montaje:
//   · ANTENA: una micro:bit conectada por USB al ordenador del profesor. Recibe
//     por radio las pulsaciones de los mandos y las escribe por el puerto serie
//     («P:<id>:<letra>:<seq>»). PiKT las lee con Web Serial.
//   · MANDOS: micro:bit con pilas. Botón A cambia la respuesta (A→B→C→D) y
//     botón B la envía. La antena confirma (ACK) y el mando muestra ✓.
//   · Desde el juego se puede devolver feedback a cada mando («F:<id>:1|0») o
//     avisar de nueva pregunta («N»): la antena lo reenvía por radio.
//
// No se usa la extensión «Keyboard» de MakeCode: funciona por Bluetooth HID y
// en la micro:bit el Bluetooth no puede usarse a la vez que la radio.
//
// Requisito: las placas con MicroPython (flashearMicropython() lo instala por
// WebUSB, igual que «⚡ Flashear MicroPython» del editor de bloques). Uso en un juego:
//   const off = escucharMandos(({ id, letra }) => …); // devuelve la baja
//   feedbackMando(id, true); nuevaPreguntaMandos();

import microPyHexUrl from '../assets/micropython-microbit-v2.hex?url';

const ENC = new TextEncoder();
const MICROBIT_USB = { usbVendorId: 0x0d28 }; // interfaz DAPLink de la micro:bit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const GRUPO_POR_DEFECTO = 7;
export const LETRAS = ['A', 'B', 'C', 'D'];

export const soportaSerial = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const soportaUSB = () => typeof navigator !== 'undefined' && 'usb' in navigator;

/** `error.code` cuando la placa no responde al REPL (no tiene MicroPython). */
export const ERROR_SIN_MICROPYTHON = 'SIN_MICROPYTHON';

/**
 * Instala el firmware MicroPython en una micro:bit por WebUSB (DAPLink).
 * Una vez por placa (y otra si después se usó MakeCode). onProgreso(0-100).
 */
export async function flashearMicropython(onProgreso) {
  if (!soportaUSB()) throw new Error('Tu navegador no admite WebUSB. Usa Chrome o Edge en un ordenador.');
  if (antena) {
    throw new Error('Desconecta antes la antena: el USB de la placa solo lo puede usar una cosa a la vez.');
  }
  // La librería se carga bajo demanda para no engordar el chunk del panel.
  const [{ createWebUSBConnection, createUniversalHexFlashDataSource }, resp] = await Promise.all([
    import('@microbit/microbit-connection'),
    fetch(microPyHexUrl),
  ]);
  if (!resp.ok) throw new Error('No se pudo cargar el firmware de MicroPython.');
  const hexText = await resp.text();
  const connection = createWebUSBConnection();
  try {
    await connection.connect(); // pide elegir la micro:bit (WebUSB)
    await connection.flash(createUniversalHexFlashDataSource(hexText), {
      partial: false,
      progress: (pct) => {
        if (pct != null && onProgreso) onProgreso(Math.round(pct * 100));
      },
    });
  } catch (e) {
    if (e?.name === 'NotFoundError') throw new Error('No se eligió ninguna micro:bit.');
    throw new Error('No se pudo instalar MicroPython: ' + (e?.message || e) + '. Revisa que el cable USB sea de datos.');
  } finally {
    try {
      await connection.disconnect();
    } catch {
      /* ya cerrado */
    }
  }
}

/* ── Programas MicroPython (solo ASCII: se escriben como literal en main.py) ── */

// v2: la antena guarda el modo de los mandos (MODO:L|N|M) que le manda el
// juego y lo retransmite cada 2 s, así un mando que se enciende tarde se pone
// al día solo. Anuncia «ANTENA:<grupo>:v2».
export const VERSION_PROGRAMAS = 2;

export function programaAntena(grupo = GRUPO_POR_DEFECTO) {
  return `# PiKT - ANTENA receptora de mandos (v${VERSION_PROGRAMAS})
from microbit import *
import radio
GRUPO = ${grupo}
radio.config(group=GRUPO, power=7, length=32, queue=10)
radio.on()
vistos = {}
buf = b''
modo = 'L'
ultimo = 0
display.show(Image('00900:09090:90909:09090:00900'))
print('ANTENA:' + str(GRUPO) + ':v${VERSION_PROGRAMAS}')
while True:
    if running_time() - ultimo > 2000:
        radio.send('MODO:' + modo)
        ultimo = running_time()
    m = radio.receive()
    if m and m.startswith('P:'):
        p = m.split(':')
        if len(p) == 4:
            radio.send('A:' + p[1] + ':' + p[3])
            if vistos.get(p[1]) != p[3]:
                vistos[p[1]] = p[3]
                print(m)
    if uart.any():
        d = uart.read()
        if d:
            buf += d
        while b'\\n' in buf:
            i = buf.index(b'\\n')
            linea = str(buf[:i], 'utf-8').strip()
            buf = buf[i + 1:]
            if linea == '?':
                print('ANTENA:' + str(GRUPO) + ':v${VERSION_PROGRAMAS}')
            elif linea.startswith('MODO:'):
                modo = linea[5:6]
                radio.send('MODO:' + modo)
                ultimo = running_time()
            elif linea:
                radio.send(linea)
        if len(buf) > 120:
            buf = b''
`;
}

// Un único programa con tres modos; el juego elige el modo (setModoMandos):
//   L letras: A cambia A>B>C>D, B envia            -> P:<id>:<A-D>:<seq>
//   N numero: A baja, B sube (mantener = acelera), A+B envia -> P:<id>:N<n>:<seq>
//   M mover:  A avanza, B gira, A+B accion          -> P:<id>:MA|MB|MX:<seq>
export function programaMando(id, grupo = GRUPO_POR_DEFECTO) {
  return `# PiKT - MANDO ${id} (v${VERSION_PROGRAMAS}): modos letras / numero / mover
from microbit import *
import radio
import random
import music
ID = ${id}
GRUPO = ${grupo}
LETRAS = 'ABCD'
GIRO = Image('09990:00009:90909:09909:09990')
radio.config(group=GRUPO, power=7, length=32, queue=10)
radio.on()
modo = 'L'
sel = 0
num = 0
seq = random.randint(0, 99)
activo = 0
inicio = 0
paso_t = 0
combo = False

def pantalla():
    if modo == 'L':
        display.show(LETRAS[sel])
    elif modo == 'N':
        if 0 <= num <= 9:
            display.show(num)
        else:
            display.scroll(str(num), delay=60, wait=False)
    else:
        display.show(Image.ARROW_N)

def enviar(valor):
    global seq
    seq = (seq + 1) % 100
    msg = 'P:%d:%s:%d' % (ID, valor, seq)
    ack = 'A:%d:%d' % (ID, seq)
    for intento in range(6):
        radio.send(msg)
        t = running_time()
        while running_time() - t < 120:
            if radio.receive() == ack:
                return True
        sleep(random.randint(0, 60))
    return False

def confirmar(ok):
    if ok:
        music.pitch(1400, 60, wait=False)
        display.show(Image.YES)
    else:
        display.show(Image.NO)
    sleep(400)
    pantalla()

def paso_letras():
    global sel
    if button_a.was_pressed():
        sel = (sel + 1) % 4
        pantalla()
    if button_b.was_pressed():
        confirmar(enviar(LETRAS[sel]))

def paso_numero():
    global num, activo, inicio, paso_t, combo
    a = button_a.is_pressed()
    b = button_b.is_pressed()
    ahora = running_time()
    if a and b:
        combo = True
        activo = 0
    elif combo:
        if not a and not b:
            combo = False
            confirmar(enviar('N%d' % num))
    elif a or b:
        d = -1 if a else 1
        if activo != d:
            activo = d
            inicio = ahora
            paso_t = ahora + 90
        elif ahora >= paso_t:
            num = max(-999, min(9999, num + d))
            pantalla()
            dur = ahora - inicio
            paso_t = ahora + (450 if dur < 200 else (150 if dur < 1500 else 50))
    else:
        activo = 0

def paso_mover():
    if button_a.is_pressed() or button_b.is_pressed():
        sleep(70)
        a = button_a.is_pressed()
        b = button_b.is_pressed()
        v = 'MX' if a and b else ('MA' if a else ('MB' if b else ''))
        if v:
            display.show(Image.ARROW_N if v == 'MA' else (GIRO if v == 'MB' else Image.DIAMOND))
            ok = enviar(v)
            music.pitch(1200 if ok else 300, 30, wait=False)
            if not ok:
                display.show(Image.NO)
        while button_a.is_pressed() or button_b.is_pressed():
            sleep(10)
        pantalla()

def cambiar_modo(m):
    global modo, sel, num, activo, combo
    if m == modo or len(m) != 1 or m not in 'LNM':
        return
    modo = m
    sel = 0
    num = 0
    activo = 0
    combo = False
    button_a.was_pressed()
    button_b.was_pressed()
    pantalla()

def escuchar_radio():
    global sel, num
    r = radio.receive()
    if not r:
        return
    if r.startswith('MODO:'):
        cambiar_modo(r[5:])
    elif r == 'N':
        sel = 0
        num = 0
        pantalla()
    elif r == 'F:%d:1' % ID:
        display.show(Image.HAPPY)
        music.play(['C6:1', 'E6:1', 'G6:2'], wait=False)
        sleep(1500)
        pantalla()
    elif r == 'F:%d:0' % ID:
        display.show(Image.SAD)
        music.play(['E4:2', 'C4:3'], wait=False)
        sleep(1500)
        pantalla()

display.scroll(str(ID), delay=90)
pantalla()
while True:
    if modo == 'L':
        paso_letras()
    elif modo == 'N':
        paso_numero()
    else:
        paso_mover()
    escuchar_radio()
    sleep(5)
`;
}

/* ── Conexión serie genérica (escritura/lectura directas, como BlocklyEditor) ── */

class ConexionSerie {
  constructor(onTexto) {
    this.onTexto = onTexto;
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.accum = '';
    this.cerrando = false;
    this.onPerdida = null; // se llama si la placa se desenchufa
  }

  async abrir(port) {
    await port.open({ baudRate: 115200 });
    this.port = port;
    this.writer = port.writable.getWriter();
    this._leer();
  }

  async _leer() {
    const dec = new TextDecoder();
    const reader = this.port.readable.getReader();
    this.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const txt = dec.decode(value, { stream: true });
          this.accum = (this.accum + txt).slice(-4000);
          this.onTexto?.(txt);
        }
      }
    } catch {
      /* desenchufada o cancelada */
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ya liberado */
      }
      this.reader = null;
      if (!this.cerrando) {
        await this.cerrar();
        this.onPerdida?.();
      }
    }
  }

  async escribir(str) {
    if (this.writer) await this.writer.write(ENC.encode(str));
  }

  esperar(re, timeout = 3000) {
    return new Promise((resolve) => {
      const inicio = Date.now();
      const tick = () => {
        const m = this.accum.match(re);
        if (m) return resolve(m);
        if (Date.now() - inicio > timeout) return resolve(null);
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  async cerrar() {
    this.cerrando = true;
    try {
      if (this.reader) await this.reader.cancel().catch(() => {});
      if (this.writer) {
        await this.writer.close().catch(() => {});
        try {
          this.writer.releaseLock();
        } catch {
          /* ya liberado */
        }
        this.writer = null;
      }
      await sleep(60);
      if (this.port) await this.port.close().catch(() => {});
    } finally {
      this.port = null;
    }
  }
}

// Escribe `codigo` como main.py (raw REPL) y reinicia la placa para que lo ejecute.
// Devuelve los bytes escritos o lanza un error legible.
async function grabarMainPy(con, codigo) {
  for (let i = 0; i < 6; i++) {
    await con.escribir('\x03'); // Ctrl-C: corta el programa que estuviera en marcha
    await sleep(80);
  }
  // Ctrl-A: raw REPL. Se reintenta: recién abierto el puerto a veces se pierde.
  let enRaw = false;
  for (let i = 0; i < 3 && !enRaw; i++) {
    con.accum = '';
    await con.escribir(i === 0 ? '\r\x01' : '\r\x03\x03\x01');
    enRaw = !!(await con.esperar(/raw REPL/, 1500));
  }
  if (!enRaw) {
    const e = new Error(
      'La micro:bit no responde: no tiene MicroPython (pasa si antes usó MakeCode). Pulsa «⚡ Instalar MicroPython», elige esa placa y vuelve a intentarlo.'
    );
    e.code = ERROR_SIN_MICROPYTHON;
    throw e;
  }
  con.accum = '';
  const py =
    `f=open('main.py','w')\nf.write(${JSON.stringify(codigo)})\nf.close()\n` +
    "import os\nprint('MAINPY_LEN='+str(os.stat('main.py')[6]))\n";
  for (let i = 0; i < py.length; i += 128) {
    await con.escribir(py.slice(i, i + 128));
    await sleep(10);
  }
  await con.escribir('\x04'); // Ctrl-D: ejecutar
  const m = await con.esperar(/MAINPY_LEN=(\d+)/, 5000);
  await con.escribir('\x02'); // Ctrl-B: vuelve al REPL normal
  await sleep(150);
  if (!m) throw new Error('No se pudo guardar el programa en la micro:bit.');
  con.accum = '';
  await con.escribir('\x04'); // Ctrl-D en REPL normal: reinicio suave → ejecuta main.py
  return Number(m[1]);
}

async function pedirPuerto() {
  if (!soportaSerial()) {
    throw new Error('Tu navegador no admite Web Serial. Usa Chrome o Edge en un ordenador.');
  }
  try {
    return await navigator.serial.requestPort({ filters: [MICROBIT_USB] });
  } catch (e) {
    if (e?.name === 'NotFoundError') throw new Error('No se eligió ninguna micro:bit.');
    throw e;
  }
}

function errorApertura(e) {
  if (e?.name === 'InvalidStateError') {
    return new Error('Ese puerto ya está abierto (¿es la antena?). Elige la otra micro:bit.');
  }
  return new Error(
    'No se pudo abrir el puerto: ' + (e?.message || e) + '. Cierra otras pestañas o programas que lo usen.'
  );
}

/* ── Estado global de la antena + suscriptores ── */

let antena = null; // ConexionSerie
let antenaOk = false; // ha respondido «ANTENA:…»
let grupoAntena = null;
let versionAntena = 0;
let modoMandos = 'L';
let lineaPendiente = '';
const oyentesMandos = new Set();
const oyentesEstado = new Set();
const RE_PULSACION = /^P:(\d{1,3}):([ABCD]|N-?\d{1,4}|M[ABX]):(\d{1,3})$/;

/** Modos de los mandos (los cambia el juego con setModoMandos). */
export const MODOS = { LETRAS: 'L', NUMERO: 'N', MOVER: 'M' };

/** Texto → entero que se puede marcar en el mando (-999 … 9999), o null. */
export const aNumeroMando = (txt) => {
  const s = String(txt ?? '').trim();
  if (!/^-?\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= -999 && n <= 9999 ? n : null;
};

/**
 * Valor crudo del mando → evento:
 *   letra:  { tipo: 'letra', letra: 'A'..'D' }
 *   número: { tipo: 'numero', numero }
 *   mover:  { tipo: 'mover', mov: 'A' (avanza) | 'B' (gira) | 'X' (A+B, acción) }
 */
function aEvento(id, valor) {
  if (/^[ABCD]$/.test(valor)) return { id, tipo: 'letra', letra: valor };
  if (valor[0] === 'N') return { id, tipo: 'numero', numero: Number(valor.slice(1)) };
  return { id, tipo: 'mover', mov: valor[1] };
}

function estadoActual() {
  return { conectada: !!antena, antenaOk, grupo: grupoAntena, version: versionAntena, modo: modoMandos };
}
function avisarEstado() {
  const e = estadoActual();
  oyentesEstado.forEach((fn) => fn(e));
}
function emitirPulsacion(ev) {
  oyentesMandos.forEach((fn) => {
    try {
      fn(ev);
    } catch (e) {
      console.error('[mandos]', e);
    }
  });
}

function procesarTexto(txt) {
  lineaPendiente += txt;
  const partes = lineaPendiente.split(/\r?\n/);
  lineaPendiente = partes.pop().slice(-200);
  for (const bruta of partes) {
    const linea = bruta.trim();
    const m = linea.match(RE_PULSACION);
    if (m) {
      emitirPulsacion({ ...aEvento(Number(m[1]), m[2]), t: Date.now() });
      continue;
    }
    const a = linea.match(/^ANTENA:(\d+)(?::v(\d+))?/);
    if (a) {
      antenaOk = true;
      grupoAntena = Number(a[1]);
      versionAntena = Number(a[2] || 1);
      avisarEstado();
      if (versionAntena >= 2) enviarAMandos('MODO:' + modoMandos); // la antena arranca en L
    }
  }
}

/**
 * Pone todos los mandos en un modo (MODOS.LETRAS / NUMERO / MOVER).
 * Cada juego lo llama al montarse; la antena lo recuerda y lo repite.
 */
export function setModoMandos(modo) {
  if (!Object.values(MODOS).includes(modo)) return;
  modoMandos = modo;
  enviarAMandos('MODO:' + modo);
  avisarEstado();
}

/**
 * Suscribe a las pulsaciones: fn({ id, tipo, letra?, numero?, mov?, t, simulado? }).
 * Devuelve la baja.
 */
export function escucharMandos(fn) {
  oyentesMandos.add(fn);
  return () => oyentesMandos.delete(fn);
}

/** Suscribe al estado de la antena: fn({ conectada, antenaOk, grupo }). */
export function escucharEstadoAntena(fn) {
  oyentesEstado.add(fn);
  fn(estadoActual());
  return () => oyentesEstado.delete(fn);
}

/** Mando virtual (pruebas sin hardware). `valor`: 'A'-'D', 'N<num>' o 'MA'|'MB'|'MX'. */
export function simularPulsacion(id, valor) {
  emitirPulsacion({ ...aEvento(id, String(valor)), t: Date.now(), simulado: true });
}

/**
 * Conecta la antena. Con `grabar` le escribe antes el programa de antena.
 * Si la placa ya era antena basta con conectar: responde a «?».
 */
export async function conectarAntena({ grabar = false, grupo = GRUPO_POR_DEFECTO } = {}) {
  if (antena) await desconectarAntena();
  const port = await pedirPuerto();
  const con = new ConexionSerie(procesarTexto);
  try {
    await con.abrir(port);
  } catch (e) {
    throw errorApertura(e);
  }
  antena = con;
  antenaOk = false;
  grupoAntena = null;
  versionAntena = 0;
  lineaPendiente = '';
  con.onPerdida = () => {
    if (antena === con) {
      antena = null;
      antenaOk = false;
      avisarEstado();
    }
  };
  avisarEstado();
  try {
    if (grabar) await grabarMainPy(con, programaAntena(grupo));
    // Pregunta «¿eres antena?» (tras reiniciar tarda un poco en arrancar).
    for (let i = 0; i < 6 && !antenaOk; i++) {
      await sleep(i === 0 ? 300 : 500);
      await con.escribir('?\n');
    }
  } catch (e) {
    await desconectarAntena();
    throw e;
  }
  return antenaOk;
}

export async function desconectarAntena() {
  const con = antena;
  antena = null;
  antenaOk = false;
  grupoAntena = null;
  versionAntena = 0;
  if (con) await con.cerrar();
  avisarEstado();
}

/** Graba el programa de mando nº `id` en otra micro:bit (USB) y la suelta. */
export async function grabarMando(id, grupo = GRUPO_POR_DEFECTO) {
  const port = await pedirPuerto();
  const con = new ConexionSerie(null);
  try {
    await con.abrir(port);
  } catch (e) {
    throw errorApertura(e);
  }
  try {
    return await grabarMainPy(con, programaMando(id, grupo));
  } finally {
    await sleep(200);
    await con.cerrar();
  }
}

/** Envía una línea a todos los mandos a través de la antena. */
export async function enviarAMandos(linea) {
  if (!antena) return;
  try {
    await antena.escribir(linea + '\n');
  } catch {
    /* antena perdida: el lector lo notificará */
  }
}

/** Carita feliz/triste + sonido en el mando `id`. */
export const feedbackMando = (id, acierto) => enviarAMandos(`F:${id}:${acierto ? 1 : 0}`);

/** Vuelve todos los mandos a la letra A. */
export const nuevaPreguntaMandos = () => enviarAMandos('N');
