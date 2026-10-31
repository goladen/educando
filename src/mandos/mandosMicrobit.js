// Mandos micro:bit para el aula (servicio compartido por todos los juegos).
//
// Montaje:
//   · ANTENA: una micro:bit conectada por USB al ordenador del profesor. Recibe
//     por radio las pulsaciones de los mandos y las escribe por el puerto serie
//     («P:<id>:<letra>:<seq>»). PiKT las lee con Web Serial.
//   · MANDOS: micro:bit con pilas. Los botones cambian la respuesta y se
//     envía AGITANDO el mando (en el modo letras, también con B). La antena confirma (ACK) y el mando muestra ✓.
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
// al día solo. Anuncia «ANTENA:<grupo>:v<VERSION_PROGRAMAS>».
// v3: modo T (abecedario) en los mandos; la antena solo cambia de número de versión.
// v4: en los modos L, N y T la respuesta se envía agitando el mando (en L también con B).
// v5: modo F (fútbol, micro:bit V2): botones, logo táctil, agitar e inclinar + duelos de preguntas.
// v6: modo V (volante): como F, pero la inclinación es continua (dirección + latido mientras se mantiene).
// v7: el modo V envía también cuánto se inclina (FVDF,x,y con x e y de -100 a 100).
export const VERSION_PROGRAMAS = 7;
/** Primera versión de los mandos que envía cuánto se inclinan. */
export const VERSION_ANALOGICO = 7;
/** Primera versión de los programas que tiene el modo V (volante). */
export const VERSION_VOLANTE = 6;

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

// Un único programa con cuatro modos; el juego elige el modo (setModoMandos):
//   L letras:     A cambia A>B>C>D; B o AGITAR envia                         -> P:<id>:<A-D>:<seq>
//   N numero:     A baja, B sube (mantener = acelera); AGITAR (o A+B) envia  -> P:<id>:N<n>:<seq>
//   T abecedario: A letra anterior, B siguiente (A-Z, 0-9); AGITAR (o A+B)   -> P:<id>:T<c>:<seq>
//   M mover:      A avanza, B gira, A+B accion                       -> P:<id>:MA|MB|MX:<seq>
//   F futbol:     A/B/logo pulsados o soltados (con latido cada 400 ms mientras se mantienen)
//                 -> FA1|FA0|FB1|FB0|FL1|FL0; agitar -> FS; inclinar -> FPI|FPD|FPF|FPT (izq/der/delante/detras).
//                 Con 'Q:<id>' ese mando entra en duelo: A cambia A-D, B o agitar envia la letra (una vez).
//   V volante:    igual que F (botones, logo, agitar) pero inclinar es continuo: FV + I|D (lado) y/o F|T
//                 (delante/detras) + cuanto (x,y de -100 a 100), p. ej. FVDF,40,-70; se repite al cambiar
//                 y cada 300 ms mientras sigue inclinado; FV0,0,0 = plano.
export function programaMando(id, grupo = GRUPO_POR_DEFECTO) {
  return `# PiKT - MANDO ${id} (v${VERSION_PROGRAMAS}): modos letras / numero / abecedario / mover / futbol / volante
from microbit import *
import radio
import random
import music
ID = ${id}
GRUPO = ${grupo}
LETRAS = 'ABCD'
ALFA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
GIRO = Image('09990:00009:90909:09909:09990')
BALON = Image('00900:09990:99999:09990:00900')
try:
    pin_logo.is_touched()
    HAY_LOGO = True
except Exception:
    HAY_LOGO = False
radio.config(group=GRUPO, power=7, length=32, queue=10)
radio.on()
modo = 'L'
sel = 0
num = 0
car = 0
seq = random.randint(0, 99)
activo = 0
inicio = 0
paso_t = 0
combo = False
duelo = False
fut = {'A': False, 'B': False, 'L': False}
fut_t = {'A': 0, 'B': 0, 'L': 0}
armado = True
incl_d = ''
incl_t = 0
tras_agitar = 0
vol_d = '0'
vol_t = 0
vol_x = 0
vol_y = 0
FLECHAS = {'I': Image.ARROW_W, 'D': Image.ARROW_E, 'F': Image.ARROW_N, 'T': Image.ARROW_S,
    'IF': Image.ARROW_NW, 'DF': Image.ARROW_NE, 'IT': Image.ARROW_SW, 'DT': Image.ARROW_SE}

def pantalla():
    if modo == 'L':
        display.show(LETRAS[sel])
    elif modo == 'N':
        if 0 <= num <= 9:
            display.show(num)
        else:
            display.scroll(str(num), delay=60, wait=False)
    elif modo == 'T':
        display.show(ALFA[car])
    elif modo == 'F':
        display.show(LETRAS[sel] if duelo else BALON)
    elif modo == 'V':
        display.show(FLECHAS.get(vol_d, Image.DIAMOND_SMALL))
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
    agitado()
    pantalla()

# True si se ha agitado el mando desde la ultima consulta (y lo olvida)
def agitado():
    return accelerometer.was_gesture('shake')

def valor_actual():
    if modo == 'L':
        return LETRAS[sel]
    if modo == 'N':
        return 'N%d' % num
    return 'T' + ALFA[car]

def paso_letras():
    global sel
    if button_a.was_pressed():
        sel = (sel + 1) % 4
        pantalla()
    if button_b.was_pressed() or agitado():
        confirmar(enviar(valor_actual()))
        button_b.was_pressed()

# Modos N y T: A/B cambian el valor (mantener = acelera) y A+B lo envia
def paso_ajuste():
    global num, car, activo, inicio, paso_t, combo
    a = button_a.is_pressed()
    b = button_b.is_pressed()
    ahora = running_time()
    if agitado():
        if not a and not b and not combo:
            confirmar(enviar(valor_actual()))
        return
    if a and b:
        combo = True
        activo = 0
    elif combo:
        if not a and not b:
            combo = False
            confirmar(enviar(valor_actual()))
    elif a or b:
        d = -1 if a else 1
        if activo != d:
            activo = d
            inicio = ahora
            paso_t = ahora + 90
        elif ahora >= paso_t:
            if modo == 'N':
                num = max(-999, min(9999, num + d))
            else:
                car = (car + d) % len(ALFA)
            pantalla()
            dur = ahora - inicio
            paso_t = ahora + (450 if dur < 200 else (150 if dur < 1500 else 50))
    else:
        activo = 0

def paso_mover():
    agitado()  # en este modo agitar no hace nada
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

# Modo F: envia los cambios de A, B y el logo (y un latido mientras siguen pulsados),
# agitar = tiro e inclinar = pase. En duelo, A cambia la letra y B o agitar la envia.
def paso_futbol():
    global duelo, sel, armado, incl_d, incl_t, tras_agitar
    if duelo:
        if button_a.was_pressed():
            sel = (sel + 1) % 4
            pantalla()
        if button_b.was_pressed() or agitado():
            ok = enviar(LETRAS[sel])
            duelo = False
            button_a.was_pressed()
            button_b.was_pressed()
            agitado()
            display.show(Image.YES if ok else Image.NO)
            sleep(300)
            pantalla()
        return
    ahora = running_time()
    est = {'A': button_a.is_pressed(), 'B': button_b.is_pressed(), 'L': HAY_LOGO and pin_logo.is_touched()}
    for k in 'ABL':
        v = est[k]
        if v != fut[k] or (v and ahora - fut_t[k] > 400):
            fut[k] = v
            fut_t[k] = ahora
            enviar('F' + k + ('1' if v else '0'))
    if agitado():
        tras_agitar = ahora
        enviar('FS')
        return
    if ahora - tras_agitar < 700:
        return
    if modo == 'V':
        paso_volante(ahora)
        return
    x = accelerometer.get_x()
    y = accelerometer.get_y()
    d = ''
    if x < -550:
        d = 'I'
    elif x > 550:
        d = 'D'
    elif y < -550:
        d = 'F'
    elif y > 550:
        d = 'T'
    if not d:
        if abs(x) < 250 and abs(y) < 250:
            armado = True
        incl_d = ''
        return
    if not armado:
        return
    if d != incl_d:
        incl_d = d
        incl_t = ahora
    elif ahora - incl_t > 180:
        armado = False
        enviar('FP' + d)

# Modo V: direccion (con diagonales) y cantidad de la inclinacion; se repite al cambiar y cada
# 300 ms, y al volver a plano se envia FV0,0,0. Umbral mas bajo para seguir que para empezar.
def eje_v(a):
    a = int(a / 6)
    if a > 100:
        return 100
    if a < -100:
        return -100
    return 0 if -15 < a < 15 else a

def paso_volante(ahora):
    global vol_d, vol_t, vol_x, vol_y
    u = 330 if vol_d == '0' else 230
    x = accelerometer.get_x()
    y = accelerometer.get_y()
    d = ('I' if x < -u else ('D' if x > u else '')) + ('F' if y < -u else ('T' if y > u else ''))
    if not d:
        d = '0'
    ax = eje_v(x)
    ay = eje_v(y)
    cambio = abs(ax - vol_x) > 7 or abs(ay - vol_y) > 7 or ((ax == 0) != (vol_x == 0)) or ((ay == 0) != (vol_y == 0))
    if d != vol_d:
        vol_d = d
        pantalla()
    elif not cambio and (not (ax or ay) or ahora - vol_t <= 300):
        return
    vol_t = ahora
    vol_x = ax
    vol_y = ay
    enviar('FV%s,%d,%d' % (d, ax, ay))

def cambiar_modo(m):
    global modo, sel, num, car, activo, combo, duelo, vol_d, vol_x, vol_y
    if m == modo or len(m) != 1 or m not in 'LNTMFV':
        return
    duelo = False
    vol_d = '0'
    vol_x = 0
    vol_y = 0
    modo = m
    sel = 0
    num = 0
    car = 0
    activo = 0
    combo = False
    button_a.was_pressed()
    button_b.was_pressed()
    agitado()
    pantalla()

def escuchar_radio():
    global sel, num, car, duelo
    r = radio.receive()
    if not r:
        return
    if r.startswith('MODO:'):
        cambiar_modo(r[5:])
    elif r == 'Q:%d' % ID and modo == 'F':
        duelo = True
        sel = 0
        button_a.was_pressed()
        button_b.was_pressed()
        agitado()
        music.pitch(1000, 120, wait=False)
        pantalla()
    elif r == 'Q0':
        if duelo:
            duelo = False
            pantalla()
    elif r == 'N':
        sel = 0
        num = 0
        car = 0
        agitado()
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
    elif modo == 'N' or modo == 'T':
        paso_ajuste()
    elif modo == 'F' or modo == 'V':
        paso_futbol()
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
const RE_PULSACION = /^P:(\d{1,3}):([ABCD]|N-?\d{1,4}|T[A-Z0-9]|M[ABX]|F(?:[ABL][01]|S|P[IDFT]|V(?:0|[ID][FT]?|[FT]))):(\d{1,3})$/;

/** Modos de los mandos (los cambia el juego con setModoMandos). */
export const MODOS = { LETRAS: 'L', NUMERO: 'N', TEXTO: 'T', MOVER: 'M', FUTBOL: 'F', VOLANTE: 'V' };

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
 *   texto:  { tipo: 'texto', caracter: 'A'..'Z' | '0'..'9' }
 *   fútbol: { tipo: 'futbol', accion: 'A'|'B'|'L' (con on: true/false) | 'S' (agitar) | 'P' (con dir: 'I'|'D'|'F'|'T') }
 *           volante (modo V, mismo tipo): accion 'V' con dir '' (plano) o 'I'|'D' y/o 'F'|'T' (p. ej. 'DF') y x, y (-100 a 100, o null)
 *   mover:  { tipo: 'mover', mov: 'A' (avanza) | 'B' (gira) | 'X' (A+B, acción) }
 */
function aEvento(id, valor) {
  if (/^[ABCD]$/.test(valor)) return { id, tipo: 'letra', letra: valor };
  if (valor[0] === 'N') return { id, tipo: 'numero', numero: Number(valor.slice(1)) };
  if (valor[0] === 'T') return { id, tipo: 'texto', caracter: valor[1] };
  if (valor[0] === 'F') {
    const accion = valor[1];
    if (accion === 'P') return { id, tipo: 'futbol', accion, dir: valor[2] };
    if (accion === 'V') {
      const [d, x, y] = valor.slice(2).split(',');
      // x e y (-100 a 100) solo llegan con mandos v7; con los anteriores quedan a null.
      return { id, tipo: 'futbol', accion, dir: d.replace('0', ''), x: x === undefined ? null : Number(x), y: y === undefined ? null : Number(y) };
    }
    return { id, tipo: 'futbol', accion, on: valor[2] === '1' };
  }
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
 * Pone todos los mandos en un modo (MODOS.LETRAS / NUMERO / TEXTO / MOVER).
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

/** Mando virtual (pruebas sin hardware). `valor`: 'A'-'D', 'N<num>', 'T<letra>', 'MA'|'MB'|'MX' o 'F…' (fútbol). */
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

/** Modo fútbol: el mando `id` entra en duelo (elige A-D y la envía una vez). */
export const dueloMando = (id) => enviarAMandos(`Q:${id}`);

/** Modo fútbol: termina cualquier duelo abierto en los mandos. */
export const finDuelosMandos = () => enviarAMandos('Q0');

/** Vuelve todos los mandos a la letra A. */
export const nuevaPreguntaMandos = () => enviarAMandos('N');
