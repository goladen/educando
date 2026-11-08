// 🗺️ Programas del mBot2 para mapear la clase y moverse por ella «como una Roomba».
// Se guardan en una ranura de «switch program» del CyberPi (como el test) y funcionan sin ordenador.
//
//   MAPEAR  (# PIKT MAPA): sale de la BASE mirando al frente, divide el suelo en celdas de CELDA cm y lo
//           explora: en cada celda nueva mide con el sensor de ultrasonidos en las 4 direcciones (solo
//           donde falta información) y va a la «frontera» más cercana (celda libre junto a otra sin
//           explorar), con búsqueda en anchura (BFS). Al acabar el tiempo, o si se pulsa B, vuelve a la
//           base por el camino más corto. Guarda el mapa en /flash/pikt_mapa.json.
//   RUTA    (# PIKT RUTA): carga el mapa, se elige un destino (joystick o desde la web, que lo deja en
//           /flash/pikt_destino.json) y va y vuelve. Si encuentra algo en el camino lo apunta en el mapa
//           y busca otro camino (replanificación).
//
// Mapa: rejilla N×N, la base en el centro (O, O), y hacia arriba = hacia donde miraba el robot en la base.
// vis: 1 = celda escaneada en las 4 direcciones, 2 = solo ha pasado por ella (el rastro).
// Cada celda: 0 sin explorar · 1-5 libre · 6-9 ocupada (cada medida suma o resta: los alumnos que
// pasan por delante no la estropean para siempre).
// Los giros son de 90° con mbot2.turn y los avances de una celda con mbot2.straight (encoders). Al
// empezar se comprueba el sentido del giroscopio (cyberpi.get_yaw) para corregir la deriva de los giros.
// Misma lógica en JS en mapaSim.js (simulador de la web): si se cambia una, cambiar la otra.

export const MARCA_MAPA = '# PIKT MAPA';
export const MARCA_RUTA = '# PIKT RUTA';
export const RUTA_MAPA = '/flash/pikt_mapa.json';
export const RUTA_DESTINO = '/flash/pikt_destino.json';
export const CELDA_CM = 30;
export const N_MAPA = 41;
export const ORIGEN = 20;

const NUCLEO = `import cyberpi, mbot2, time, ujson
c = cyberpi.console
j = cyberpi.controller
CELDA = ${CELDA_CM}
N = ${N_MAPA}
O = ${ORIGEN}
MAXR = 150
SENSOR = 6
MAPA = '${RUTA_MAPA}'
DESTINO = '${RUTA_DESTINO}'
DX = (0, 1, 0, -1)
DY = (1, 0, -1, 0)
try:
    US = cyberpi.ultrasonic2
except Exception:
    try:
        import mbuild
        US = mbuild.ultrasonic2
    except Exception:
        US = None
g = bytearray(N * N)
vis = bytearray(N * N)
x = O
y = O
r = 0
signo = 0
yaw0 = 0

def idx(a, b):
    return b * N + a

def dentro(a, b):
    return 0 < a < N - 1 and 0 < b < N - 1

def libre(i):
    return 0 < g[i] < 6

def marcar(a, b, occ):
    if not dentro(a, b):
        return
    i = idx(a, b)
    v = g[i]
    if occ:
        g[i] = 7 if v == 0 else min(9, v + 3)
    else:
        g[i] = 4 if v == 0 else max(1, v - 1)

def pulsado(b):
    if j.is_press(b):
        while j.is_press(b):
            time.sleep(0.02)
        return True
    return False

# Distancia (cm) desde el centro del robot: mediana de 3 lecturas. 0 = sin sensor o sin lectura
def lectura():
    if US is None:
        return 0
    s = []
    for k in range(3):
        try:
            d = US.get(1)
        except Exception:
            d = 0
        s.append(d or 0)
        time.sleep(0.02)
    s.sort()
    return int(s[1])

sin_lect = 0

# 0 = SIN LECTURA (sin sensor, eco perdido o pegado a la pared): no es «libre», es peligro. Se repite;
# si pasa muchas veces seguidas, el robot se para y avisa (mejor que ir a ciegas)
def medir():
    global sin_lect
    d = lectura()
    if d <= 2:
        d = lectura()
    if d <= 2:
        sin_lect += 1
        if sin_lect >= 6:
            mbot2.drive_power(0, 0)
            cyberpi.led.on(255, 0, 0)
            c.clear()
            c.println('El sensor de')
            c.println('ultrasonidos no da')
            c.println('lecturas: revisa el')
            c.println('cable y vuelve a empezar')
            guardar()
            while True:
                time.sleep(1)
        return 0
    sin_lect = 0
    if d < 300:
        return d + SENSOR
    return d

# Celda en la que ha visto algo de muy cerca: ocupada del todo
def bloquear(a, b):
    if dentro(a, b):
        g[idx(a, b)] = 9

# Mide hacia delante y apunta en el mapa: celdas libres hasta el obstaculo y el obstaculo
def observar():
    d = medir()
    if not d:
        return 0
    lejos = d >= 300 or d > MAXR
    alcance = MAXR if lejos else d
    k = 1
    while k * CELDA + CELDA // 2 <= alcance and k * CELDA <= MAXR:
        marcar(x + DX[r] * k, y + DY[r] * k, False)
        k += 1
    if not lejos:
        k = max(1, (d + CELDA // 2) // CELDA)
        marcar(x + DX[r] * k, y + DY[r] * k, True)
    return d

def yaw():
    try:
        return cyberpi.get_yaw()
    except Exception:
        return 0

def corregir():
    if not signo:
        return
    e = (signo * (yaw() - yaw0) - r * 90) % 360
    if e > 180:
        e -= 360
    if 1 < abs(e) < 45:
        mbot2.turn(-e)

def girar_a(nr):
    global r
    dd = (nr - r) % 4
    if dd == 1:
        mbot2.turn(90)
    elif dd == 2:
        mbot2.turn(180)
    elif dd == 3:
        mbot2.turn(-90)
    r = nr
    if dd:
        time.sleep(0.15)
        corregir()

# Sentido del giroscopio: gira 90 a la derecha y vuelve; 1 o -1, o 0 si no responde
def calibrar():
    global signo, yaw0
    try:
        cyberpi.reset_yaw()
    except Exception:
        pass
    time.sleep(0.3)
    a = yaw()
    mbot2.turn(90)
    time.sleep(0.3)
    b = yaw()
    mbot2.turn(-90)
    time.sleep(0.3)
    dif = (b - a) % 360
    signo = 1 if 60 < dif < 120 else (-1 if 240 < dif < 300 else 0)
    yaw0 = yaw()

# Avanza una celda si no hay nada delante; si lo hay, lo marca y devuelve False
def avanzar():
    global x, y
    nx = x + DX[r]
    ny = y + DY[r]
    d = observar()
    if not d:
        return False
    if not dentro(nx, ny) or d < CELDA + 18:
        bloquear(nx, ny)
        return False
    if not libre(idx(nx, ny)):
        return False
    # En dos mitades midiendo en medio: si aparece algo que no se veia, vuelve al centro de la celda
    mitad = CELDA // 2
    mbot2.straight(mitad)
    d2 = medir()
    if d2 < mitad + 18:
        mbot2.straight(-mitad)
        if d2:
            bloquear(nx, ny)
        return False
    mbot2.straight(CELDA - mitad)
    x = nx
    y = ny
    marcar(x, y, False)
    i = idx(x, y)
    if not vis[i]:
        vis[i] = 2
    return True

# Junto a un obstaculo (8 vecinas): el robot solo ve de frente, asi que se aleja de ellos
def cerca(i):
    for dd in (1, -1, N, -N, N + 1, N - 1, 1 - N, -1 - N):
        if g[i + dd] >= 6:
            return True
    return False

# Camino mas barato (Dijkstra por cubos) desde el robot hasta la primera celda que cumple meta(i):
# cada celda cuesta 1, o 3 si esta junto a un obstaculo (asi va por el centro de los pasillos).
# Devuelve las direcciones a seguir o None. desc = se puede pasar por celdas sin explorar.
def bfs(meta, desc):
    ini = idx(x, y)
    de = bytearray(N * N)
    dist = [9999] * (N * N)
    dist[ini] = 0
    cubos = [[ini]]
    cd = 0
    while cd < len(cubos):
        for i in cubos[cd]:
            if dist[i] != cd:
                continue
            if i != ini and meta(i):
                ruta = []
                while i != ini:
                    k = de[i] - 1
                    ruta.append(k)
                    i -= DX[k] + DY[k] * N
                ruta.reverse()
                return ruta
            a = i % N
            b = i // N
            for k in (r, (r + 1) % 4, (r + 3) % 4, (r + 2) % 4):
                na = a + DX[k]
                nb = b + DY[k]
                if not dentro(na, nb):
                    continue
                ni = nb * N + na
                v = g[ni]
                if v >= 6 or (v == 0 and not desc and not meta(ni)):
                    continue
                nd = cd + (3 if cerca(ni) else 1)
                if nd < dist[ni]:
                    dist[ni] = nd
                    de[ni] = k + 1
                    while len(cubos) <= nd:
                        cubos.append([])
                    cubos[nd].append(ni)
        cd += 1
    return None

def ir_a(meta, aviso):
    fallos = 0
    while not meta(idx(x, y)):
        if pulsado('b'):
            return False
        ruta = bfs(meta, False) or bfs(meta, True)
        if ruta is None:
            return False
        girar_a(ruta[0])
        if not avanzar():
            fallos += 1
            if fallos > 80:
                return False
        aviso()
    return True

def guardar():
    try:
        f = open(MAPA, 'wb')
        f.write(('{"c":%d,"n":%d,"o":%d,"x":%d,"y":%d,"r":%d,"s":%d,"g":"' % (CELDA, N, O, x, y, r, signo)).encode())
        f.write(bytes([48 + v for v in g]))
        f.write(b'","v":"')
        f.write(bytes([48 + v for v in vis]))
        f.write(b'"}')
        f.close()
        return True
    except Exception:
        return False

def cargar():
    global signo
    try:
        f = open(MAPA)
        m = ujson.load(f)
        f.close()
        if m['n'] != N or m['c'] != CELDA:
            return False
        s = m['g']
        v = m['v']
        for i in range(N * N):
            g[i] = ord(s[i]) - 48
            vis[i] = ord(v[i]) - 48
        signo = m.get('s', 0)
        return True
    except Exception:
        return False

def metros(n):
    return '%.1f' % (n * CELDA / 100)

def en_base():
    girar_a(0)
    cyberpi.led.on(0, 255, 0)
    try:
        cyberpi.audio.play_tone(880, 0.15)
        cyberpi.audio.play_tone(1320, 0.2)
    except Exception:
        pass
`;

/** Programa «Mapear la clase» (ranura de switch program). */
export const programaMapear = () => `${MARCA_MAPA}
# PiKT - mapear la clase con el mBot2 (celdas de ${CELDA_CM} cm)
${NUCLEO}
def libres():
    n = 0
    for v in g:
        if 0 < v < 6:
            n += 1
    return n

def frontera(i):
    if not libre(i):
        return False
    a = i % N
    b = i // N
    for k in range(4):
        if dentro(a + DX[k], b + DY[k]) and g[i + DX[k] + DY[k] * N] == 0:
            return True
    return False

# Mira en las 4 direcciones (girando a la derecha) solo donde falta informacion
def falta(k):
    for p in (1, 2):
        a = x + DX[k] * p
        b = y + DY[k] * p
        if dentro(a, b) and g[idx(a, b)] == 0:
            return True
    return False

def escanear():
    r0 = r
    for t in range(4):
        k = (r0 + t) % 4
        if falta(k):
            girar_a(k)
            observar()

t_ini = 0
duracion = 0

def estado(txt):
    c.clear()
    c.println('MAPEANDO ' + txt)
    s = max(0, duracion - time.ticks_diff(time.ticks_ms(), t_ini) // 1000)
    c.println('Quedan %d:%02d' % (s // 60, s % 60))
    c.println('Libres: %d' % libres())
    c.println('Pos: %s, %s m' % (metros(x - O), metros(y - O)))
    c.println('B: volver a la base')

def aviso_vuelta():
    c.clear()
    c.println('VOLVIENDO A LA BASE')
    c.println('Pos: %s, %s m' % (metros(x - O), metros(y - O)))

cyberpi.led.on(0, 0, 255)
c.clear()
c.println('MAPEAR LA CLASE')
c.println('Pon el robot en la')
c.println('BASE mirando al frente')
c.println('A: 5 min   B: 10 min')
c.println('Arriba: 2 min')
duracion = 0
while not duracion:
    if pulsado('a'):
        duracion = 300
    elif pulsado('b'):
        duracion = 600
    elif pulsado('up'):
        duracion = 120
    time.sleep(0.03)
c.clear()
if US is None or max([lectura() for k in range(6)]) <= 2:
    c.println('No leo el sensor de')
    c.println('ultrasonidos: conectalo')
    c.println('y vuelve a empezar')
    cyberpi.led.on(255, 0, 0)
    while True:
        time.sleep(1)
c.println('Calibrando el giro...')
calibrar()
t_ini = time.ticks_ms()
pasos = 0
marcar(x, y, False)
while time.ticks_diff(time.ticks_ms(), t_ini) < duracion * 1000:
    if pulsado('b'):
        break
    i = idx(x, y)
    if vis[i] != 1:
        vis[i] = 1
        marcar(x, y, False)
        escanear()
    ruta = bfs(frontera, False)
    if ruta is None:
        break
    girar_a(ruta[0])
    if avanzar():
        pasos += 1
        if pasos % 15 == 0:
            guardar()
    estado('')
guardar()
cyberpi.led.on(255, 160, 0)
aviso_vuelta()
casa = idx(O, O)
ok = ir_a(lambda i: i == casa, aviso_vuelta)
guardar()
c.clear()
if ok:
    en_base()
    c.println('EN LA BASE!')
else:
    cyberpi.led.on(255, 0, 0)
    c.println('No encuentro el camino')
    c.println('a la base')
c.println('Libres: %d celdas' % libres())
c.println('Mapa guardado: miralo')
c.println('en pikt.es')
while True:
    time.sleep(1)
`;

/** Programa «Ir y volver» (ranura de switch program). */
export const programaRuta = () => `${MARCA_RUTA}
# PiKT - ir a un punto del mapa y volver a la base (mBot2)
${NUCLEO}
def info(txt):
    c.clear()
    c.println(txt)
    c.println('Pos: %s, %s m' % (metros(x - O), metros(y - O)))

def leer_destino():
    try:
        f = open(DESTINO)
        d = ujson.load(f)
        f.close()
        return O + int(d['x']), O + int(d['y'])
    except Exception:
        return O, O + 3

def nombre_celda(a, b):
    if not dentro(a, b):
        return 'fuera del mapa'
    v = g[idx(a, b)]
    return 'sin explorar' if v == 0 else ('libre' if v < 6 else 'OBSTACULO')

# Elegir destino con el joystick: arriba/abajo/izquierda/derecha mueve, centro = ir, A = a la base
def elegir(dx, dy):
    while True:
        c.clear()
        c.println('DESTINO')
        c.println('%s m a la dcha' % metros(dx - O))
        c.println('%s m al frente' % metros(dy - O))
        c.println(nombre_celda(dx, dy))
        c.println('Centro: ir  A: base')
        while True:
            if pulsado('up'):
                dy += 1
                break
            if pulsado('down'):
                dy -= 1
                break
            if pulsado('right'):
                dx += 1
                break
            if pulsado('left'):
                dx -= 1
                break
            if pulsado('middle'):
                return dx, dy
            if pulsado('a'):
                return O, O
            time.sleep(0.03)
        dx = max(1, min(N - 2, dx))
        dy = max(1, min(N - 2, dy))

c.clear()
if not cargar():
    cyberpi.led.on(255, 0, 0)
    c.println('No hay mapa:')
    c.println('primero usa el programa')
    c.println('MAPEAR LA CLASE')
    while True:
        time.sleep(1)
if US is None or max([lectura() for k in range(6)]) <= 2:
    cyberpi.led.on(255, 0, 0)
    c.println('No leo el sensor de')
    c.println('ultrasonidos')
    while True:
        time.sleep(1)
c.println('Robot en la BASE')
c.println('mirando al frente')
c.println('Pulsa A para empezar')
while not pulsado('a'):
    time.sleep(0.03)
try:
    cyberpi.reset_yaw()
except Exception:
    pass
time.sleep(0.3)
yaw0 = yaw()
if not signo:
    calibrar()
dx, dy = leer_destino()
while True:
    cyberpi.led.on(0, 0, 255)
    dx, dy = elegir(dx, dy)
    meta = idx(dx, dy)
    if g[meta] >= 6:
        c.clear()
        c.println('Ahi hay un obstaculo')
        time.sleep(1.5)
        continue
    cyberpi.led.on(255, 160, 0)
    ok = ir_a(lambda i: i == meta, lambda: info('EN CAMINO'))
    guardar()
    c.clear()
    if ok and meta == idx(O, O):
        en_base()
        c.println('EN LA BASE!')
    elif ok:
        cyberpi.led.on(0, 255, 0)
        try:
            cyberpi.audio.play_tone(1320, 0.2)
        except Exception:
            pass
        c.println('HE LLEGADO!')
    else:
        cyberpi.led.on(255, 0, 0)
        c.println('No encuentro camino')
    c.println('A: volver a la base')
    c.println('Centro: otro destino')
    while True:
        if pulsado('a'):
            cyberpi.led.on(255, 160, 0)
            casa = idx(O, O)
            if ir_a(lambda i: i == casa, lambda: info('VOLVIENDO')):
                en_base()
            guardar()
            dx, dy = O, O + 3
            break
        if pulsado('middle'):
            break
        time.sleep(0.03)
`;
