// Programas MicroPython del Laboratorio micro:bit (solo ASCII: se escriben como literal en main.py).
// Se comunican con la web a través de la misma antena que los mandos (mandosMicrobit.js): todo lo
// que empieza por «I:» la antena lo imprime por USB (salvo Q, B y R, que son solo entre placas) y
// las líneas «I:…» que escribe la web las reenvía por radio.
//
// Satélite k (1-4): fijo en un sitio conocido de la sala.
//   recibe I:Q:k  -> responde I:B:k por radio y a la vez pita (el receptor mide el retraso del sonido)
//   en modo R     -> emite la baliza I:R:k cada 150 ms (el receptor mide la intensidad, RSSI)
// Instrumento <id>: la placa que se mueve o se usa para medir. Modo con I:M:<modo>[:n]:
//   GS:n  GPS por sonido con n satélites -> I:G:<id>:<k>:<us>  (us = retraso del sonido; -1 no se oyó, -2 sin respuesta)
//   GR    GPS por radio                  -> I:S:<id>:<k>:<rssi>
//   IN    inclinómetro                   -> I:A:<id>:<x>,<y>,<z>   (mg)
//   BR    brújula                        -> I:C:<id>:<grados>
//   SE    sensores                       -> I:E:<id>:<temp>,<luz>,<sonido>
//   CA    caída libre                    -> I:F:<id>:<us>  (tiempo de caída)
//   Botón A en cualquier modo            -> I:P:<id>  («marca»: punto del recorrido, fijar medida…)
//   SN    sonómetro (varias placas)      -> I:E:<id>:<temp>,<luz>,<pico de sonido de los últimos ~0,3 s>
//   I:U:<n> umbral del micrófono · I:K calibrar la brújula
//   I:Z:<id>:<0|1|2|3> semáforo del sonómetro en la placa: cara feliz / regular / enfadada (3 = y pita)
//   DA:c:n dado (agitar) con c caras y n dados -> I:D:<id>:<v1>[,<v2>]   (enseña la suma en los LED)
//   MU    theremín: mantener A suena una nota de la escala según la inclinación (B = una octava más)
//   PI    pines P0, P1, P2 (sensores externos) -> I:X:<id>:<p0>,<p1>,<p2>   (0-1023)
//   FC    frío o caliente: barras en los LED según la baliza más cercana (los satélites emiten en FC
//         como en GR) -> también I:S:<id>:<k>:<rssi>
//   CR    cronometro: A arranca (o vuelve a 0), B para -> I:W:<id>:<n>:<ms>  (n = numero de medida;
//         se envia 3 veces y la web descarta repetidos) y enseña el tiempo en segundos
//   En cualquier modo: I:T:<id|*>:<Hz>:<ms> toca una nota (0 Hz = silencio) ·
//                      I:V:<id|*>:<texto | #ICONO> enseña un texto o un icono (#HEART, #HAPPY…)
//
// Placa multifunción (archivosMultifuncion): mando + satélite + instrumento en la misma placa.
//   main.py lee rol.txt (M, S1-S4, I) e importa f_mando, f_sat o f_ins. Si al encender se mantiene B,
//   se elige la función con A y se guarda con B.
//   Por radio: ROL:<id|*>:<rol> la cambia (guarda rol.txt y reinicia); ROL:<id>:? solo pregunta.
//   Al arrancar cada función avisa I:H:<id>:<rol> (la web mide así cuánto tarda en reiniciarse).
//   Satélite o instrumento que oye MODO:<L|N|T|M|F|V> (cualquier juego de mandos) vuelve solo a mando;
//   el laboratorio pone la antena en MODO:X para que se queden (usePlacasLab.js).
import { PY_CANAL, GRUPO_POR_DEFECTO, programaMando } from '../mandos/mandosMicrobit.js';

export const VERSION_LAB = 1;
export const ROLES_MULTI = ['M', 'S1', 'S2', 'S3', 'S4', 'I'];

// multi: módulo f_sat.py; el número de satélite sale de rol.txt (S1-S4).
export function programaSatelite(k, grupo = GRUPO_POR_DEFECTO, { multi = false } = {}) {
  return `# PiKT - SATELITE ${multi ? '(placa multifuncion)' : k} (laboratorio de mates v${VERSION_LAB})
from microbit import *
import radio
import music
${multi ? 'import f_rol\nK = f_rol.num()' : `K = ${k}`}
${PY_CANAL(grupo)}GRUPO = leer_canal()
display.scroll('C' + str(GRUPO), delay=70)
radio.config(group=GRUPO, power=7, length=32, queue=10)
radio.on()
${multi ? 'f_rol.hola()\n' : ''}try:
    set_volume(255)
except Exception:
    pass
PING = 'I:Q:%d' % K
modo = ''
ultimo = 0
display.show(str(K))
while True:
    try:
        m = radio.receive()
    except Exception:
        m = None
${multi ? '    f_rol.mirar(m)\n' : ''}    if m == PING:
        radio.send('I:B:%d' % K)
        music.pitch(2700, 40, wait=False)
        display.show(Image.DIAMOND)
        sleep(60)
        display.show(str(K))
    elif m and m.startswith('I:M:'):
        modo = m[4:6]
    if (modo == 'GR' or modo == 'FC') and running_time() - ultimo > 150:
        radio.send('I:R:%d' % K)
        ultimo = running_time()
    sleep(1)
`;
}

// multi: módulo f_ins.py de una placa multifunción.
export function programaInstrumento(id, grupo = GRUPO_POR_DEFECTO, { multi = false } = {}) {
  return `# PiKT - INSTRUMENTO ${id} (laboratorio de mates v${VERSION_LAB}): GPS, inclinometro, brujula, sensores, caida
from microbit import *
import radio
import math
import music
import random
import utime
${multi ? 'import f_rol\n' : ''}ID = ${id}
${PY_CANAL(grupo)}GRUPO = leer_canal()
display.scroll('C' + str(GRUPO), delay=70)
radio.config(group=GRUPO, power=7, length=32, queue=20)
radio.on()
${multi ? 'f_rol.hola()\n' : ''}modo = ''
n_sat = 3
umbral = 90
t_env = 0
caida_t0 = 0
pico = 0
caras = 6
n_dados = 1
cr_n = 0
LETRA = {'GS': 'G', 'GR': 'R', 'IN': 'I', 'BR': 'N', 'SE': 'S', 'CA': 'C', 'SN': Image.HAPPY,
    'DA': 'D', 'MU': Image.MUSIC_QUAVER, 'PI': 'P', 'FC': Image.TARGET, 'CR': Image.CLOCK12}
CARA = (Image.HAPPY, Image.MEH, Image.ANGRY, Image.ANGRY)
ESCALA = (262, 294, 330, 349, 392, 440, 494, 523)

def enviar(txt):
    radio.send('I:' + txt)

def para_mi(quien):
    return quien == '*' or quien == str(ID)

# Dado: unos numeros al azar de animacion y despues el resultado (la suma si hay dos dados)
def tirar():
    for i in range(6):
        display.show(str(random.randint(1, min(caras, 9))))
        sleep(60 + i * 25)
    vals = [random.randint(1, caras) for i in range(n_dados)]
    enviar('D:%d:%s' % (ID, ','.join([str(v) for v in vals])))
    s = sum(vals)
    if s < 10:
        display.show(str(s))
    else:
        display.scroll(str(s), delay=70, wait=False)
    music.pitch(1200, 40, wait=False)

# Theremin: la inclinacion a los lados elige la nota de la escala; suena mientras se mantiene A
def paso_theremin():
    x = max(-900, min(899, accelerometer.get_x()))
    i = (x + 900) * 8 // 1800
    if button_a.is_pressed():
        f = ESCALA[i] * (2 if button_b.is_pressed() else 1)
        music.pitch(f, 80, wait=False)
    img = Image(5, 5)
    for c in range(i * 5 // 8 + 1):
        for fila in range(4 - c, 5):
            img.set_pixel(c, fila, 7)
    display.show(img)

# Frio o caliente: la baliza mas fuerte de los satelites -> barras de 0 a 5 y un pitido mas agudo
def paso_frio_caliente():
    suma = {}
    n = {}
    t0 = running_time()
    while running_time() - t0 < 500:
        r = radio.receive_full()
        if r:
            m = texto_de(r[0])
            if m.startswith('I:R:'):
                k = m[4:]
                suma[k] = suma.get(k, 0) + r[1]
                n[k] = n.get(k, 0) + 1
            else:
                procesar(m)
                if modo != 'FC':
                    return
        sleep(2)
    mejor = -120
    for k in suma:
        v = suma[k] // n[k]
        enviar('S:%d:%s:%d' % (ID, k, v))
        mejor = max(mejor, v)
    nivel = max(0, min(5, (mejor + 95) // 10))
    img = Image(5, 5)
    for f in range(5 - nivel, 5):
        for c in range(5):
            img.set_pixel(c, f, 9)
    display.show(img)
    if nivel:
        music.pitch(300 + nivel * 180, 40, wait=False)

# Cronometro (caida_t0 guarda el inicio en ms; 0 = parado)
def paso_crono():
    global caida_t0, cr_n
    if button_a.was_pressed():
        caida_t0 = running_time()
        music.pitch(1500, 30, wait=False)
    if not caida_t0:
        button_b.was_pressed()
        return
    t = running_time() - caida_t0
    if button_b.was_pressed():
        caida_t0 = 0
        cr_n += 1
        for i in range(3):
            enviar('W:%d:%d:%d' % (ID, cr_n, t))
            sleep(25)
        music.pitch(900, 80, wait=False)
        display.scroll('%d.%02d' % (t // 1000, t % 1000 // 10), delay=70, wait=False)
    else:
        display.show(Image.ALL_CLOCKS[t // 250 % 12])

def pantalla():
    display.show(LETRA.get(modo, Image.SQUARE_SMALL))

def texto_de(raw):
    try:
        return str(raw[3:], 'utf8')
    except Exception:
        return ''

def procesar(m):
    global modo, n_sat, umbral, caida_t0, caras, n_dados
    if not m:
        return
${multi ? '    f_rol.mirar(m)\n' : ''}    if m.startswith('I:M:'):
        p = m[4:].split(':')
        nuevo = p[0]
        try:
            if nuevo == 'GS' and len(p) > 1:
                n_sat = max(1, min(4, int(p[1])))
            if nuevo == 'DA' and len(p) > 2:
                caras = max(2, min(99, int(p[1])))
                n_dados = max(1, min(2, int(p[2])))
        except Exception:
            pass
        if nuevo != modo:
            modo = nuevo
            caida_t0 = 0
            pantalla()
            if modo == 'GS':
                microphone.sound_level()
            if modo == 'DA':
                accelerometer.was_gesture('shake')
            if modo == 'CR':
                button_a.was_pressed()
                button_b.was_pressed()
    elif m.startswith('I:T:'):
        p = m.split(':')
        if len(p) == 5 and para_mi(p[2]):
            try:
                if int(p[3]) > 0:
                    music.pitch(int(p[3]), int(p[4]), wait=False)
                else:
                    music.stop()
            except Exception:
                pass
    elif m.startswith('I:V:'):
        p = m.split(':', 3)
        if len(p) == 4 and para_mi(p[2]):
            t = p[3]
            if t[:1] == '#':
                try:
                    display.show(getattr(Image, t[1:]))
                except Exception:
                    pass
            elif len(t) == 1:
                display.show(t)
            elif t:
                display.scroll(t, delay=80, wait=False)
    elif m.startswith('I:U:'):
        try:
            umbral = int(m[4:])
        except Exception:
            pass
    elif m == 'I:K':
        compass.calibrate()
        pantalla()
    elif m.startswith('I:Z:'):
        p = m.split(':')
        if len(p) == 4 and p[2] == str(ID) and p[3] in '0123':
            display.show(CARA[int(p[3])])
            if p[3] == '3':
                music.pitch(880, 300, wait=False)

# Retraso (us) entre el aviso por radio del satelite k y la llegada de su pitido
def medir_sonido(k):
    while True:
        try:
            m = radio.receive()
        except Exception:
            m = None
        if not m:
            break
        procesar(m)
    base = microphone.sound_level()
    lim = max(umbral, base + 30)
    radio.send('I:Q:%d' % k)
    t0 = running_time()
    tr = None
    while running_time() - t0 < 150:
        r = radio.receive_full()
        if r:
            m = texto_de(r[0])
            if m == 'I:B:%d' % k:
                tr = r[2]
                break
            procesar(m)
    if tr is None:
        return -2
    while True:
        dt = utime.ticks_diff(utime.ticks_us(), tr)
        if dt > 120000:
            return -1
        if microphone.sound_level() > lim:
            return dt

def paso_gps_sonido():
    for k in range(1, n_sat + 1):
        if modo != 'GS':
            return
        dt = medir_sonido(k)
        enviar('G:%d:%d:%d' % (ID, k, dt))
        sleep(250)

def paso_gps_radio():
    suma = {}
    n = {}
    t0 = running_time()
    while running_time() - t0 < 800:
        r = radio.receive_full()
        if r:
            m = texto_de(r[0])
            if m.startswith('I:R:'):
                k = m[4:]
                suma[k] = suma.get(k, 0) + r[1]
                n[k] = n.get(k, 0) + 1
            else:
                procesar(m)
                if modo != 'GR':
                    return
        sleep(2)
    for k in suma:
        enviar('S:%d:%s:%d' % (ID, k, suma[k] // n[k]))

# Caida libre: el acelerometro marca casi 0 g mientras cae y un golpe fuerte al llegar
def paso_caida():
    global caida_t0
    x, y, z = accelerometer.get_values()
    g = math.sqrt(x * x + y * y + z * z)
    ahora = utime.ticks_us()
    if caida_t0 == 0:
        if g < 350:
            caida_t0 = ahora
        return
    t = utime.ticks_diff(ahora, caida_t0)
    if g < 350:
        if t > 3000000:
            caida_t0 = 0
        return
    if t < 40000:
        caida_t0 = 0
        return
    if g > 1500:
        caida_t0 = 0
        enviar('F:%d:%d' % (ID, t))
        display.show(Image.YES)
        sleep(800)
        pantalla()

pantalla()
while True:
    try:
        procesar(radio.receive())
    except Exception:
        pass
    if modo != 'MU' and modo != 'CR' and button_a.was_pressed():
        enviar('P:%d' % ID)
        display.show(Image.YES)
        sleep(150)
        pantalla()
    ahora = running_time()
    if modo == 'GS':
        paso_gps_sonido()
    elif modo == 'GR':
        paso_gps_radio()
    elif modo == 'IN':
        if ahora - t_env > 120:
            x, y, z = accelerometer.get_values()
            enviar('A:%d:%d,%d,%d' % (ID, x, y, z))
            t_env = ahora
    elif modo == 'BR':
        if ahora - t_env > 250:
            h = compass.heading()
            enviar('C:%d:%d' % (ID, h))
            t_env = ahora
            display.show('NESO'[(h + 45) % 360 // 90])
    elif modo == 'SE':
        if ahora - t_env > 500:
            enviar('E:%d:%d,%d,%d' % (ID, temperature(), display.read_light_level(), microphone.sound_level()))
            t_env = ahora
    elif modo == 'SN':
        pico = max(pico, microphone.sound_level())
        if ahora - t_env > 300 + (ID % 7) * 11:
            enviar('E:%d:%d,%d,%d' % (ID, temperature(), display.read_light_level(), pico))
            pico = 0
            t_env = ahora
    elif modo == 'DA':
        if accelerometer.was_gesture('shake'):
            tirar()
    elif modo == 'MU':
        if ahora - t_env > 60:
            paso_theremin()
            t_env = ahora
    elif modo == 'PI':
        if ahora - t_env > 300:
            enviar('X:%d:%d,%d,%d' % (ID, pin0.read_analog(), pin1.read_analog(), pin2.read_analog()))
            t_env = ahora
    elif modo == 'FC':
        paso_frio_caliente()
    elif modo == 'CR':
        paso_crono()
    elif modo == 'CA':
        paso_caida()
        continue
    sleep(5)
`;
}

/* ── Placa multifunción ── */

// f_rol.py: función guardada en rol.txt y cambio por radio (lo importan los tres módulos y main.py).
function programaRol(id) {
  return `# PiKT - funcion de la placa multifuncion ${id}
from microbit import display, Image, sleep, reset
import radio
import music
ID = ${id}
ROLES = (${ROLES_MULTI.map((r) => `'${r}'`).join(', ')})
def leer_rol():
    try:
        with open('rol.txt') as f:
            r = f.read().strip()
        if r in ROLES:
            return r
    except Exception:
        pass
    return 'M'
ACTUAL = leer_rol()
def guardar_rol(r):
    global ACTUAL
    ACTUAL = r
    try:
        with open('rol.txt', 'w') as f:
            f.write(r)
    except Exception:
        pass
def num():
    return int(ACTUAL[1:]) if ACTUAL[0] == 'S' else 1
def hola():
    radio.send('I:H:%d:%s' % (ID, ACTUAL))
def cambiar(r):
    guardar_rol(r)
    music.pitch(1800, 60)
    display.show(Image.ARROW_E)
    reset()
# ROL:<id|*>:<rol> cambia la funcion y reinicia; ROL:<id>:? solo responde.
# MODO:<L|N|T|M|F|V> (lo repite la antena en los juegos) = hace falta un mando: vuelve a mando.
# MODO:X (laboratorio) deja cada placa con la funcion que tenga.
def mirar(m):
    if not m:
        return
    if m.startswith('MODO:'):
        if ACTUAL != 'M' and len(m) == 6 and m[5] in 'LNTMFV':
            cambiar('M')
        return
    if not m.startswith('ROL:'):
        return
    p = m.split(':')
    if len(p) != 3 or p[1] not in (str(ID), '*'):
        return
    if p[1] == '*':
        sleep((ID % 20) * 15)
    if p[2] == '?' or p[2] == ACTUAL:
        hola()
        return
    if p[2] in ROLES:
        cambiar(p[2])
`;
}

// main.py: lee la función y carga su módulo. Mantener B al encender = elegir la función (A cambia, B guarda).
function programaLanzador(id) {
  return `# PiKT - PLACA MULTIFUNCION ${id}: mando / satelite / instrumento (laboratorio v${VERSION_LAB})
from microbit import *
import f_rol
rol = f_rol.leer_rol()
if button_b.is_pressed():
    display.scroll('ROL', delay=55)
    while button_b.is_pressed():
        sleep(20)
    button_a.was_pressed()
    button_b.was_pressed()
    i = f_rol.ROLES.index(rol)
    display.show(f_rol.ROLES[i], delay=300, wait=False)
    while True:
        if button_a.was_pressed():
            i = (i + 1) % len(f_rol.ROLES)
            display.show(f_rol.ROLES[i], delay=300, wait=False)
        if button_b.was_pressed():
            rol = f_rol.ROLES[i]
            f_rol.guardar_rol(rol)
            display.show(Image.YES)
            sleep(500)
            break
        sleep(20)
else:
    display.show(rol, delay=250)
if rol == 'I':
    import f_ins
elif rol[0] == 'S':
    import f_sat
else:
    import f_mando
`;
}

// Quita los espacios alrededor de operadores, comas y paréntesis (y los comentarios del final) sin
// tocar lo que va entre comillas: «x = a + 1  # …» → «x=a+1». Python lo acepta igual.
const SIGNOS = /\s*([=+\-*/<>!,:()[\]{}%&|^~])\s*/g;
function apretar(linea) {
  let out = '', trozo = '', q = null;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) {
      out += c;
      if (c === '\\') out += linea[++i] ?? '';
      else if (c === q) q = null;
      continue;
    }
    if (c === '#') break;
    if (c === "'" || c === '"') { out += trozo.replace(SIGNOS, '$1') + c; trozo = ''; q = c; continue; }
    trozo += c;
  }
  return (out + trozo.replace(SIGNOS, '$1')).trimEnd();
}

/**
 * Archivos de una placa multifunción nº `id`, en orden de grabación (main.py el último).
 * Los tres módulos comparten el sello del canal para que el canal elegido valga en todas las funciones.
 */
export function archivosMultifuncion(id, grupo = GRUPO_POR_DEFECTO, rolInicial = 'M') {
  const sello = 'SELLO = ' + (Date.now() % 1000000000);
  // Sin comentarios ni líneas vacías (salvo la cabecera) y con sangría de 1 espacio por nivel en vez
  // de 4: la placa tiene poco espacio (los programas no tienen textos de varias líneas)
  const compactar = (txt) => txt.split('\n')
    .filter((l, i) => i === 0 || (l.trim() && !l.trim().startsWith('#')))
    .map((l, i) => { const n = l.match(/^ */)[0].length; return ' '.repeat(Math.ceil(n / 4)) + (i === 0 ? l.slice(n) : apretar(l.slice(n))); })
    .join('\n') + '\n';
  // El canal (leer_canal / guardar_canal) va una sola vez en f_rol.py y los módulos lo importan
  const canal = compactar('#\n' + PY_CANAL(grupo).replace(/^SELLO = \d+$/m, sello)).replace(/^#\n/, '');
  const modulo = (txt) => {
    const c = compactar(txt.replace(/^SELLO = \d+$/m, sello));
    if (!c.includes(canal)) throw new Error('No se encontró el bloque del canal en un módulo');
    return c.replace(canal, 'from f_rol import leer_canal, guardar_canal\n');
  };
  return {
    'rol.txt': ROLES_MULTI.includes(rolInicial) ? rolInicial : 'M',
    'f_rol.py': compactar(programaRol(id)) + canal,
    'f_mando.py': modulo(programaMando(id, grupo, { multi: true })),
    'f_sat.py': modulo(programaSatelite(1, grupo, { multi: true })),
    'f_ins.py': modulo(programaInstrumento(id, grupo, { multi: true })),
    'main.py': compactar(programaLanzador(id)),
  };
}
