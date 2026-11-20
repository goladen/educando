// Cabina micro:bit del simulador de conducción (programa APARTE del de los mandos de PiKT).
//
//   · VOLANTE (placa 1): inclinarla = girar · A acelera · B frena (mientras se mantienen).
//   · INTERMITENTES (placa 2): A izquierdo · B derecho (pulsar = encender / apagar).
//   · MARCHAS (placa 3): A baja · B sube · logo táctil (V2) = cinturón / casco. Muestra la marcha.
//   · PEDALES (opcionales, una placa cada uno): ACELERADOR, FRENO y EMBRAGUE. La placa va pegada a una
//     tabla con bisagra: lo que se inclina al pisar = cuánto se pisa (0-100 %). Se calibra en la propia placa.
//   · ANTENA: micro:bit por USB con SU PROPIO programa (no es la antena de los mandos de los juegos) y
//     su propio canal de radio (por defecto 21), para no mezclarse con los mandos del aula.
//     Todo se instala desde el simulador (pantalla «Cabina con micro:bit»).
//
// Protocolo de radio (prefijo I:X, libre en el laboratorio micro:bit):
//   placa → web:  I:XV,<giro -100..100>,<A><B>   (al cambiar y cada 250 ms)
//                 I:XP<A|F|E>,<0..100>  pedal (al cambiar y cada 250 ms)
//                 I:XI,<L|R>,<seq> · I:XM,<+|->,<seq> · I:XC,<seq>   (3 veces, la web deduplica por seq)
//   web → placa:  I:XG,<marcha> (R N 1-5 D) · I:XJ,<L|R|0> (intermitente encendido)
// Independiente de los mandos de los juegos: su propia antena, su canal y su código para grabar por USB.

export const CANAL_CABINA_DEFECTO = 21;
export const VERSION_CABINA = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const ROLES_CABINA = {
    V: { emoji: '🛞', nombre: 'Volante', ayuda: 'Llévala en HORIZONTAL, con la pantalla hacia arriba y los botones A y B a los lados, e inclínala a la izquierda o a la derecha para girar (a tope con unos 35°). La posición al encenderla es «recto»; tocar el logo (V2) la vuelve a centrar. A = acelerar · B = frenar.' },
    I: { emoji: '↔️', nombre: 'Intermitentes', ayuda: 'A = intermitente izquierdo · B = derecho. Se pulsa una vez para encender y otra para apagar; la flecha parpadea en la pantalla.' },
    A: { emoji: '🟩', nombre: 'Acelerador', pedal: true, ayuda: 'Pedal: pega la placa a una tabla que se incline al pisarla. Se ajusta sola: al encenderla toma el pedal suelto como «reposo» y, al pisarlo, aprende hacia dónde se pisa y el recorrido (inclinarlo hacia el otro lado o de lado da 0 %). Para afinar: pedal suelto y A (reposo), a fondo y B (recorrido; se recuerda), o desde «▶ Probar». Logo (V2) = a fondo.' },
    F: { emoji: '🟥', nombre: 'Freno', pedal: true, ayuda: 'Igual que el acelerador: inclinar al pisar. Al encenderla toma el reposo; pisa a fondo y pulsa B para calibrar. A = reposo otra vez.' },
    E: { emoji: '🟦', nombre: 'Embrague', pedal: true, ayuda: 'Igual que los otros pedales. Al oírse, el simulador pasa a embrague con pedal (con cambio manual): písalo a fondo para cambiar de marcha y suéltalo poco a poco para salir.' },
    M: { emoji: '⚙️', nombre: 'Marchas', ayuda: 'A = bajar de marcha · B = subir. Con cambio automático: B = adelante (D), A = marcha atrás (R). Logo táctil (V2) = cinturón / casco. La pantalla muestra la marcha.' },
};

const CABECERA = (rol, grupo) => `# PiKT - CABINA de conduccion: ${ROLES_CABINA[rol].nombre.toUpperCase()}
from microbit import *
import radio
GRUPO = ${Number(grupo) || 7}
radio.config(group=GRUPO, power=7, length=32, queue=10)
radio.on()
seq = 0
def mandar(txt):
    global seq
    seq = (seq + 1) % 100
    for i in range(3):
        radio.send('I:X' + txt + ',' + str(seq))
        sleep(12)
display.scroll('${rol}', delay=60)
`;

const PY_VOLANTE = `import math
ult = ''
t_env = 0
try:
    pin_logo.is_touched()
    HAY_LOGO = True
except Exception:
    HAY_LOGO = False
# Placa en HORIZONTAL (pantalla hacia arriba): inclinarla a izquierda / derecha = girar.
# Devuelve el angulo de ladeo en grados (media de 3 lecturas para quitar temblores).
def bruto():
    x = z = 0
    for i in range(3):
        x += accelerometer.get_x()
        z += accelerometer.get_z()
    return math.atan2(x, abs(z) + 1) * 57.3
def centrar():
    global centro
    c = 0
    for i in range(5):
        c += bruto()
        sleep(4)
    centro = c / 5
    display.show(Image.YES)
    sleep(300)
sleep(300)
centrar()
ZONA = 4.0     # grados sin efecto en el centro
TOPE = 35.0    # grados para girar a tope
suave = 0.0
def giro():
    global suave
    d = bruto() - centro
    if abs(d) < ZONA:
        g = 0.0
    else:
        g = (abs(d) - ZONA) / (TOPE - ZONA)
        g = min(1.0, g) * (1 if d > 0 else -1)
    suave = suave * 0.6 + g * 0.4
    if abs(suave) < 0.04:
        suave = 0.0
    return int(suave * 20) * 5
while True:
    s = giro()
    a = 1 if button_a.is_pressed() else 0
    b = 1 if button_b.is_pressed() else 0
    m = 'I:XV,' + str(s) + ',' + str(a) + str(b)
    ahora = running_time()
    if m != ult or ahora - t_env > 250:
        radio.send(m)
        ult = m
        t_env = ahora
    display.clear()
    col = max(0, min(4, 2 + int(s / 40)))
    for f in range(3):
        display.set_pixel(col, f, 9)
    if a:
        display.set_pixel(4, 4, 9)
        display.set_pixel(3, 4, 9)
    if b:
        display.set_pixel(0, 4, 9)
        display.set_pixel(1, 4, 9)
    if HAY_LOGO and pin_logo.is_touched():
        centrar()
    r = radio.receive()
    if r == 'I:XKV,0':
        centrar()
    sleep(30)
`;

const PY_INTERMITENTES = `IZQ = Image('00900:09000:99999:09000:00900')
DER = Image('00900:00090:99999:00090:00900')
estado = '0'
fase = -1
while True:
    if button_a.was_pressed():
        mandar('I,L')
        estado = '0' if estado == 'L' else 'L'
    if button_b.was_pressed():
        mandar('I,R')
        estado = '0' if estado == 'R' else 'R'
    m = radio.receive()
    while m:
        if m.startswith('I:XJ,') and len(m) > 5:
            estado = m[5]
        m = radio.receive()
    f = (running_time() // 400) % 2
    if estado in 'LR' and estado != '0':
        if f != fase:
            fase = f
            if f == 0:
                display.show(IZQ if estado == 'L' else DER)
                try:
                    music.pitch(1600, 8, wait=False)
                except Exception:
                    pass
            else:
                display.clear()
    else:
        fase = -1
        display.clear()
        display.set_pixel(2, 2, 2)
    sleep(20)
`;

const PY_MARCHAS = `try:
    pin_logo.is_touched()
    HAY_LOGO = True
except Exception:
    HAY_LOGO = False
marcha = '?'
logo_antes = False
while True:
    if button_a.was_pressed():
        mandar('M,-')
    if button_b.was_pressed():
        mandar('M,+')
    if HAY_LOGO:
        t = pin_logo.is_touched()
        if t and not logo_antes:
            mandar('C')
        logo_antes = t
    m = radio.receive()
    while m:
        if m.startswith('I:XG,') and len(m) > 5:
            marcha = m[5]
        m = radio.receive()
    display.show(marcha)
    sleep(20)
`;

// Pedal: el valor es el ángulo entre la posición actual y la de reposo dividido por el recorrido
// calibrado (da igual cómo esté pegada la placa). El recorrido se guarda en pedal.txt.
const PY_PEDAL = (letra) => `import math
PEDAL = '${letra}'
try:
    pin_logo.is_touched()
    HAY_LOGO = True
except Exception:
    HAY_LOGO = False
# Vectores de gravedad normalizados. El valor del pedal es el angulo CON SIGNO girado desde el
# reposo hacia la posicion "a fondo": inclinar hacia el otro lado (o de lado) da 0.
def unit(v):
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if n < 1:
        return (0.0, 0.0, -1.0)
    return (v[0] / n, v[1] / n, v[2] / n)
def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def leer():
    x = y = z = 0
    for i in range(5):
        x += accelerometer.get_x()
        y += accelerometer.get_y()
        z += accelerometer.get_z()
        sleep(2)
    return unit((x, y, z))
def angulo(a, b):
    return math.acos(max(-1.0, min(1.0, dot(a, b)))) * 57.2958
rango = 15.0
auto = True      # sin calibrar: el recorrido se aprende al pisar
fondo = None     # posicion "a fondo" (marca hacia donde se pisa)
try:
    with open('pedal.txt') as f:
        p = f.read().split(';')
    rango = max(5.0, min(90.0, float(p[0])))
    auto = False
    if len(p) >= 4:
        fondo = unit((float(p[1]), float(p[2]), float(p[3])))
except Exception:
    pass
eje = None
def preparar_eje():
    # direccion de giro reposo -> fondo, perpendicular al reposo
    global eje
    eje = None
    if fondo is None:
        return
    d = dot(fondo, reposo)
    e = (fondo[0] - d * reposo[0], fondo[1] - d * reposo[1], fondo[2] - d * reposo[2])
    if math.sqrt(dot(e, e)) > 0.02:
        eje = unit(e)
def pisado(c):
    if eje is None:
        return angulo(reposo, c)
    return math.atan2(dot(c, eje), dot(c, reposo)) * 57.2958
def tomar_reposo():
    global reposo
    reposo = leer()
    preparar_eje()
    display.show(Image.YES)
    sleep(400)
def guardar_fondo():
    global rango, auto, fondo
    c = leer()
    r = angulo(reposo, c)
    if r >= 5:
        rango = r
        auto = False
        fondo = c
        preparar_eje()
        try:
            with open('pedal.txt', 'w') as f:
                f.write('%f;%f;%f;%f' % (rango, c[0], c[1], c[2]))
        except Exception:
            pass
        display.show(Image.YES)
    else:
        display.show(Image.NO)
    sleep(400)
sleep(300)
tomar_reposo()
ult = ''
t_env = 0
while True:
    if button_a.was_pressed():
        tomar_reposo()
    if button_b.was_pressed():
        guardar_fondo()
    r = radio.receive()
    if r == 'I:XK' + PEDAL + ',0':
        tomar_reposo()
    elif r == 'I:XK' + PEDAL + ',1':
        guardar_fondo()
    c = leer()
    if eje is None and angulo(reposo, c) > 8:
        # primera pisada clara: aprende hacia donde se pisa
        fondo = c
        preparar_eje()
    ang = pisado(c)
    if ang < 0:
        ang = 0
    if auto and ang > rango:
        rango = ang
    v = ang / rango
    if v < 0.06:
        v = 0
    if v > 0.94:
        v = 1
    if HAY_LOGO and pin_logo.is_touched():
        v = 1
    n = int(v * 20) * 5
    m = 'I:XP' + PEDAL + ',' + str(n)
    ahora = running_time()
    if m != ult or ahora - t_env > 250:
        radio.send(m)
        ult = m
        t_env = ahora
    filas = int(n / 20 + 0.5)
    for f in range(5):
        for k in range(5):
            display.set_pixel(k, 4 - f, 9 if f < filas else (2 if f == 0 else 0))
    sleep(15)
`;

export function programaAntenaCabina(canal = CANAL_CABINA_DEFECTO) {
    return `# PiKT - ANTENA de la CABINA de conduccion (v${VERSION_CABINA})
from microbit import *
import radio
CANAL = ${Number(canal) || CANAL_CABINA_DEFECTO}
radio.config(group=CANAL, power=7, length=32, queue=20)
radio.on()
display.scroll('C' + str(CANAL), delay=60)
display.show(Image('00000:09990:99999:09090:00000'))
print('CABINA:' + str(CANAL) + ':v${VERSION_CABINA}')
buf = b''
while True:
    try:
        m = radio.receive()
    except Exception:
        m = None
    while m:
        if m.startswith('I:X'):
            print(m)
        try:
            m = radio.receive()
        except Exception:
            m = None
    if uart.any():
        d = uart.read()
        if d:
            buf += d
        while b'\\n' in buf:
            i = buf.index(b'\\n')
            linea = str(buf[:i], 'utf-8').strip()
            buf = buf[i + 1:]
            if linea == '?':
                print('CABINA:' + str(CANAL) + ':v${VERSION_CABINA}')
            elif linea.startswith('I:X'):
                radio.send(linea)
        if len(buf) > 120:
            buf = b''
    sleep(1)
`;
}

export function programaCabina(rol, grupo = CANAL_CABINA_DEFECTO) {
    const cuerpo = { V: PY_VOLANTE, I: PY_INTERMITENTES, M: PY_MARCHAS, A: PY_PEDAL('A'), F: PY_PEDAL('F'), E: PY_PEDAL('E') }[rol];
    if (!cuerpo) throw new Error('Papel desconocido: ' + rol);
    return CABECERA(rol, grupo) + (rol === 'I' ? 'import music\n' : '') + cuerpo;
}

/** Graba el programa de ese papel (V | I | M) en una micro:bit conectada por USB. */
export async function grabarCabina(rol, canal) {
    const port = await elegirPlaca();
    await grabarEnPuerto(port, programaCabina(rol, canal));
}

/* ═══════════ Antena de la cabina (Web Serial, independiente de la de los mandos) ═══════════ */
const MICROBIT_USB = { usbVendorId: 0x0d28 };
let con = null; // { port, writer, reader, cerrando }
let antenaOk = false, canalAntena = null, pendiente = '';
const oyentesLinea = new Set(), oyentesEstado = new Set();
export const soportaSerialCabina = () => typeof navigator !== 'undefined' && 'serial' in navigator;
const estadoAntena = () => ({ conectada: !!con, antenaOk, canal: canalAntena });
const avisarEstado = () => { const e = estadoAntena(); oyentesEstado.forEach(fn => { try { fn(e); } catch { /* */ } }); };
const emitir = (linea) => oyentesLinea.forEach(fn => { try { fn(linea); } catch (e) { console.error('[cabina]', e); } });

function procesar(txt) {
    pendiente += txt;
    const partes = pendiente.split(/\r?\n/);
    pendiente = partes.pop().slice(-200);
    for (const bruta of partes) {
        const l = bruta.trim();
        if (l.startsWith('I:X')) { emitir(l); continue; }
        const m = l.match(/^CABINA:(\d+)/);
        if (m) { antenaOk = true; canalAntena = Number(m[1]); avisarEstado(); }
    }
}
async function leer(c) {
    const dec = new TextDecoder();
    const reader = c.port.readable.getReader();
    c.reader = reader;
    try {
        for (;;) { const { value, done } = await reader.read(); if (done) break; if (value) procesar(dec.decode(value, { stream: true })); }
    } catch { /* desenchufada */ } finally {
        try { reader.releaseLock(); } catch { /* */ }
        c.reader = null;
        if (!c.cerrando && con === c) { await cerrar(c); con = null; antenaOk = false; avisarEstado(); }
    }
}
async function cerrar(c) {
    c.cerrando = true;
    try { if (c.reader) await c.reader.cancel().catch(() => {}); } catch { /* */ }
    try { await c.writer.close().catch(() => {}); c.writer.releaseLock(); } catch { /* */ }
    await sleep(60);
    try { await c.port.close(); } catch { /* */ }
}
/* ═══════════ Grabar main.py por USB (raw REPL de MicroPython) ═══════════ */
export const ERROR_SIN_MICROPYTHON_CABINA = 'SIN_MICROPYTHON';
const TROZO = 1500;
// Abre `port`, escribe el programa como main.py, reinicia la placa y cierra el puerto.
async function grabarEnPuerto(port, codigo) {
    try { await port.open({ baudRate: 115200 }); }
    catch (e) { throw new Error(e?.name === 'InvalidStateError' ? 'Ese puerto ya está abierto (¿es la antena?). Elige la otra micro:bit.' : 'No se pudo abrir el puerto: ' + (e?.message || e)); }
    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    const dec = new TextDecoder(), enc = new TextEncoder();
    let accum = '', vivo = true;
    (async () => { try { while (vivo) { const { value, done } = await reader.read(); if (done) break; if (value) accum = (accum + dec.decode(value, { stream: true })).slice(-4000); } } catch { /* */ } })();
    const escribir = (t) => writer.write(enc.encode(t));
    const esperar = async (re, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = accum.match(re); if (m) return m; await sleep(50); } return null; };
    const ejecutar = async (py, marca, ms = 5000) => {
        accum = '';
        for (let i = 0; i < py.length; i += 128) { await escribir(py.slice(i, i + 128)); await sleep(10); }
        await escribir('\x04');
        const m = await esperar(new RegExp(`${marca}|(?<err>\\w*Error\\b[^\\r\\n\\x04]*)`), ms);
        if (m && !m.groups?.err) return m;
        throw new Error(m ? `la placa dice «${m.groups.err.trim()}»` : 'la placa no contesta');
    };
    try {
        for (let i = 0; i < 6; i++) { await escribir('\x03'); await sleep(80); }
        let enRaw = false;
        for (let i = 0; i < 3 && !enRaw; i++) { accum = ''; await escribir(i === 0 ? '\r\x01' : '\r\x03\x03\x01'); enRaw = !!(await esperar(/raw REPL/, 1500)); }
        if (!enRaw) {
            const e = new Error('La micro:bit no responde: no tiene MicroPython (pasa si antes usó MakeCode). Pulsa «⚡ Instalar MicroPython», elige esa placa y vuelve a intentarlo.');
            e.code = ERROR_SIN_MICROPYTHON_CABINA; throw e;
        }
        try {
            // Borra TODO lo que hubiera: otros programas de PiKT (p. ej. el mando multifunción) llenan
            // casi toda la memoria y daban ENOSPC. Solo se conserva la calibración del pedal.
            await ejecutar(`import os,gc\nfor n in os.listdir():\n    if n != 'pedal.txt':\n        try:\n            os.remove(n)\n        except OSError:\n            pass\ngc.collect()\nprint('LIMPIO')\n`, 'LIMPIO');
            await ejecutar(`f=open('main.py','w')\nprint('ABIERTO')\n`, 'ABIERTO');
            for (let i = 0, k = 0; i < codigo.length; i += TROZO, k++) {
                await ejecutar(`f.write(${JSON.stringify(codigo.slice(i, i + TROZO))})\ngc.collect()\nprint('T${k}OK')\n`, `T${k}OK`);
            }
            await ejecutar(`f.close()\nprint('LEN='+str(os.stat('main.py')[6]))\n`, 'LEN=(\\d+)');
        } catch (e) {
            await escribir('\x02');
            if (/ENOSPC|Errno 28/.test(e.message)) {
                const err = new Error('No queda espacio en la micro:bit ni borrando sus archivos. Pulsa «⚡ Instalar MicroPython» con esa placa (la deja vacía) y vuelve a grabarla.');
                err.code = ERROR_SIN_MICROPYTHON_CABINA; // el panel muestra el botón de instalar
                throw err;
            }
            throw new Error('No se pudo guardar el programa en la micro:bit: ' + e.message + '.');
        }
        await escribir('\x02'); await sleep(150);
        await escribir('\x04'); // reinicio suave → ejecuta main.py
        await sleep(200);
    } finally {
        vivo = false;
        try { await reader.cancel(); } catch { /* */ }
        try { reader.releaseLock(); } catch { /* */ }
        try { await writer.close(); } catch { /* */ }
        try { writer.releaseLock(); } catch { /* */ }
        await sleep(60);
        try { await port.close(); } catch { /* */ }
    }
}
async function elegirPlaca() {
    if (!soportaSerialCabina()) throw new Error('Tu navegador no admite Web Serial. Usa Chrome o Edge en un ordenador.');
    try { return await navigator.serial.requestPort({ filters: [MICROBIT_USB] }); }
    catch (e) { if (e?.name === 'NotFoundError') throw new Error('No se eligió ninguna micro:bit.'); throw e; }
}

export function escucharEstadoCabina(fn) { oyentesEstado.add(fn); fn(estadoAntena()); return () => oyentesEstado.delete(fn); }
export async function enviarCabina(linea) {
    if (!con) return;
    try { await con.writer.write(new TextEncoder().encode(linea + '\n')); } catch { /* perdida */ }
}
/**
 * Conecta la antena de la cabina. Con `grabar` le escribe antes su programa (mismo diálogo: se elige la placa
 * una sola vez). Devuelve true si contesta como antena de la cabina.
 */
export async function conectarAntenaCabina({ grabar = false, canal = CANAL_CABINA_DEFECTO } = {}) {
    if (!soportaSerialCabina()) throw new Error('Tu navegador no admite Web Serial. Usa Chrome o Edge en un ordenador.');
    if (con) await desconectarAntenaCabina();
    const port = await elegirPlaca();
    if (grabar) await grabarEnPuerto(port, programaAntenaCabina(canal));
    try { await port.open({ baudRate: 115200 }); }
    catch (e) { throw new Error(e?.name === 'InvalidStateError' ? 'Ese puerto ya está abierto en otra pestaña o programa (¿la antena de los mandos?).' : 'No se pudo abrir el puerto: ' + (e?.message || e)); }
    const c = { port, writer: port.writable.getWriter(), reader: null, cerrando: false };
    con = c; antenaOk = false; canalAntena = null; pendiente = '';
    leer(c);
    avisarEstado();
    for (let i = 0; i < 8 && !antenaOk; i++) { await sleep(i === 0 ? 300 : 500); await enviarCabina('?'); }
    return antenaOk;
}
export async function desconectarAntenaCabina() {
    const c = con; con = null; antenaOk = false; canalAntena = null;
    if (c) await cerrar(c);
    avisarEstado();
}

/**
 * Ajuste desde la web (la antena lo reenvía por radio):
 *   pedal A|F|E: paso 0 = «está suelto» (reposo) · paso 1 = «está a fondo» (recorrido, se guarda en la placa)
 *   volante V:   paso 0 = «está recto» (centro)
 */
export const ajustarCabina = (rol, paso = 0) => enviarCabina(`I:XK${rol},${paso}`);

/** Placa virtual (pruebas sin hardware): la línea llega como si viniera de la antena. */
export const simularCabina = (linea) => emitir(linea.startsWith('I:') ? linea : 'I:X' + linea);

/**
 * Escucha las placas de la cabina. `oyente(ev)` recibe:
 *   { rol:'V', giro, acel, freno } · { rol:'I', lado:'L'|'R' } · { rol:'M', cambio:'+'|'-' } · { rol:'C' }
 * Devuelve la baja.
 */
export function escucharCabina(oyente) {
    const ultSeq = {};
    const fn = (linea) => {
        const p = linea.slice(3).split(',');
        const tipo = p[0];
        if (tipo === 'V') {
            const g = Number(p[1]), ab = p[2] || '00';
            if (!Number.isFinite(g)) return;
            oyente({ rol: 'V', giro: Math.max(-1, Math.min(1, g / 100)), acel: ab[0] === '1' ? 1 : 0, freno: ab[1] === '1' ? 1 : 0 });
            return;
        }
        if (tipo[0] === 'P' && 'AFE'.includes(tipo[1])) {
            const n = Number(p[1]);
            if (Number.isFinite(n)) oyente({ rol: tipo[1], valor: Math.max(0, Math.min(1, n / 100)) });
            return;
        }
        if (!['I', 'M', 'C'].includes(tipo)) return;
        const seq = p[p.length - 1];
        const clave = tipo;
        const ahora = Date.now();
        if (ultSeq[clave] && ultSeq[clave].seq === seq && ahora - ultSeq[clave].t < 1500) return; // repetición
        ultSeq[clave] = { seq, t: ahora };
        if (tipo === 'I' && (p[1] === 'L' || p[1] === 'R')) oyente({ rol: 'I', lado: p[1] });
        else if (tipo === 'M' && (p[1] === '+' || p[1] === '-')) oyente({ rol: 'M', cambio: p[1] });
        else if (tipo === 'C') oyente({ rol: 'C' });
    };
    oyentesLinea.add(fn);
    return () => oyentesLinea.delete(fn);
}

/**
 * Conecta la cabina con el motor del simulador (crearMotor). Devuelve { desconectar, vistos() }.
 * opciones: { invertir } · onPlacas(vistos) avisa de qué placas se han oído (V/I/M → ms del último mensaje).
 */
export function conectarCabinaMotor(motor, { invertir = false, onPlacas } = {}) {
    const vistos = {};
    const opc = { invertir };
    let ultVolante = 0, volanteActivo = false;
    const vol = { steer: 0, acel: 0, freno: 0 };
    const pedal = { A: 0, F: 0, E: 0 }, ultPedal = { A: 0, F: 0, E: 0 };
    const aplicar = () => motor.setEntradaExterna({ steer: vol.steer, acel: Math.max(vol.acel, pedal.A), freno: Math.max(vol.freno, pedal.F), embrague: pedal.E });
    const ver = (r) => { const nuevo = !vistos[r]; vistos[r] = Date.now(); if (nuevo) onPlacas?.({ ...vistos }); };
    const off = escucharCabina((ev) => {
        if (ev.rol === 'V') {
            ver('V'); ultVolante = Date.now(); volanteActivo = true;
            Object.assign(vol, { steer: (opc.invertir ? -1 : 1) * ev.giro, acel: ev.acel, freno: ev.freno }); aplicar();
        } else if (ev.rol === 'A' || ev.rol === 'F' || ev.rol === 'E') {
            if (ev.rol === 'E' && !vistos.E) motor.setEmbraguePedal?.(true); // con cambio manual: embrague de verdad
            ver(ev.rol); pedal[ev.rol] = ev.valor; ultPedal[ev.rol] = Date.now(); aplicar();
        } else if (ev.rol === 'I') { ver('I'); motor.setIntermitente(ev.lado === 'L' ? 'izq' : 'der'); enviarEstado(true); }
        else if (ev.rol === 'M') { ver('M'); if (ev.cambio === '+') motor.subirMarcha(); else motor.bajarMarcha(); enviarEstado(true); }
        else if (ev.rol === 'C') { ver('M'); motor.alternarCinturon(); }
    });
    // devolver a las placas la marcha y el intermitente (al cambiar y cada 2 s, por si se encienden tarde)
    let ultG = null, ultJ = null, ultEnvio = 0;
    function enviarEstado(forzar = false) {
        let e; try { e = motor.estado(); } catch { return; }
        const g = e.marcha, j = e.intermitente === 'izq' ? 'L' : e.intermitente === 'der' ? 'R' : '0';
        const ahora = Date.now();
        const repetir = ahora - ultEnvio > 2000;
        if (!vistos.I && !vistos.M) return;
        if (forzar || repetir || g !== ultG) { if (vistos.M) enviarCabina(`I:XG,${g}`); ultG = g; }
        if (forzar || repetir || j !== ultJ) { if (vistos.I) enviarCabina(`I:XJ,${j}`); ultJ = j; }
        if (repetir || forzar) ultEnvio = ahora;
    }
    const intervalo = setInterval(() => {
        // sin noticias del volante: se suelta todo (placa apagada o fuera de alcance)
        const ahora = Date.now();
        if (volanteActivo && ahora - ultVolante > 700) { volanteActivo = false; Object.assign(vol, { steer: 0, acel: 0, freno: 0 }); aplicar(); }
        for (const k of ['A', 'F', 'E']) if (pedal[k] && ahora - ultPedal[k] > 700) { pedal[k] = 0; aplicar(); }
        enviarEstado(false);
    }, 150);
    return {
        desconectar() { off(); clearInterval(intervalo); try { motor.setEntradaExterna({ steer: 0, acel: 0, freno: 0, embrague: 0 }); } catch { /* motor destruido */ } },
        setInvertir(v) { opc.invertir = !!v; },
        vistos: () => ({ ...vistos }),
    };
}
