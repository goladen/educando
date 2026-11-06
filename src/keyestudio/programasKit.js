// Programas MicroPython del Laboratorio Smart Home (solo ASCII y sin barras invertidas: se envían
// tal cual por el raw REPL y se ejecutan en RAM, sin tocar el main.py de la placa).
//
// Placa → web (una línea cada 250 ms y al empezar):
//   KIT:<esp32|mb>:<VERSION_KIT>
//   K:<temp>,<hum>,<luz>,<vapor>,<suelo>,<gas>,<pir>,<boton1>,<boton2>[,<pot>,<mic>,<lm35>]   (-1 = no conectado)
//      pot: ADC crudo · mic: pico a pico de 40 lecturas seguidas (nivel de sonido) · lm35: décimas de °C
//      (la micro:bit V2 manda en mic el sound_level() de su micrófono × 2, de 0 a 510)
//      luz, vapor y suelo: lectura cruda del ADC (0-4095 en ESP32, 0-1023 en micro:bit)
//      gas: ESP32 → 1 si detecta (salida digital del MQ-2) · micro:bit → lectura analógica
//      pir, botones: 1 = activo/pulsado
//   R:<ms>   tiempo de reacción (-1 se adelantó, -2 no pulsó a tiempo)
// Web → placa (líneas):
//   C:puerta:<0-180>  C:ventana:<0-180>  C:vent:<0-100>  C:led:<0|1>  C:rgb:<r>,<g>,<b>
//   C:pita:<hz>,<ms>  C:reac   (enciende el LED tras una espera al azar y mide hasta el botón 1)
//   C:rgbi:<i>,<r>,<g>,<b>  (un solo LED RGB, i = 0-3)   C:led2:<0|1>  (segundo LED, el azul de la TdR)
//   C:lcd:<fila>,<texto>  C:lcdb (borrar)  C:lcdl:<0|1> (luz de fondo)   · al empezar: LCD:<dirección I2C, 0 = no hay>
//   (el texto de la LCD puede llevar «:» y espacios: se toma todo lo que va detrás de «C:lcd:<fila>,»)

// v2: placa Imagina TdR STEAM: K lleva al final <pot>,<mic>,<lm35 en décimas de °C>; C:led2, RGB de 3 pines.
export const VERSION_KIT = 2;

const constantes = (p) => {
  const v = (x) => (Number.isFinite(x) ? x : -1);
  return [
    `DHT = ${v(p.dht)}`, `LED = ${v(p.led)}`, `VAPOR = ${v(p.vapor)}`, `PIR = ${v(p.pir)}`, `BOTON1 = ${v(p.boton1)}`,
    `BOTON2 = ${v(p.boton2)}`, `GAS = ${v(p.gas)}`, `RGB = ${v(p.rgb)}`, `ZUMBADOR = ${v(p.zumbador)}`,
    `VENTANA = ${v(p.ventana)}`, `PUERTA = ${v(p.puerta)}`, `VENTA = ${v(p.ventiladorA)}`, `VENTB = ${v(p.ventiladorB)}`,
    `LUZ = ${v(p.luz)}`, `SUELO = ${v(p.suelo)}`, `LCD_SDA = ${p.lcdSda ?? 21}`, `LCD_SCL = ${p.lcdScl ?? 22}`,
    `POT = ${v(p.pot)}`, `MIC = ${v(p.mic)}`, `LM35 = ${v(p.lm35)}`, `LED2 = ${v(p.led2)}`,
    `RGB_R = ${v(p.rgbR)}`, `RGB_G = ${v(p.rgbG)}`, `RGB_B = ${v(p.rgbB)}`,
    `BOT_ALTO = ${p.botonAlto ? 1 : 0}`, // 1: pulsado = 1 (resistencia a GND en la placa) · 0: pulsado = 0
  ].join('\n');
};

// Pantalla LCD1602 con adaptador I2C PCF8574 (P0 = RS, P2 = E, P3 = luz, P4-P7 = D4-D7), en modo
// de 4 bits. `_lw(b)` escribe un byte en el PCF8574; cada placa lo define con su API de I2C.
// Caracteres fuera de ASCII se cambian por «?» (la web ya quita tildes antes de enviarlos). El «°»
// viaja como «`» (ASCII 96, así el serie no lleva UTF-8) y se pinta con el 223 de la ROM de la pantalla.
const LCD_PY = `lcd_luz = 8
def _lpulso(b):
    _lw(b | 4)
    _lw(b & 251)
def _lnib(b, rs):
    _lpulso((b & 240) | rs)
def _lbyte(b, rs=0):
    _lnib(b & 240, rs)
    _lnib((b << 4) & 240, rs)
def lcd_init():
    for _ in range(3):
        _lnib(48, 0)
        time.sleep_ms(5)
    _lnib(32, 0)
    for c in (40, 12, 6, 1):
        _lbyte(c)
    time.sleep_ms(3)
def lcd_texto(fila, txt):
    _lbyte(128 | (64 if fila else 0))
    for ch in (txt + ' ' * 16)[:16]:
        o = ord(ch)
        _lbyte(223 if o == 96 else o if 31 < o < 127 else 63, 1)
def lcd_orden(l):
    global lcd_luz
    if not lcd_dir:
        return
    if l.startswith('C:lcd:'):
        r = l[6:]
        lcd_texto(1 if r[:1] == '1' else 0, r[2:])
    elif l.startswith('C:lcdb'):
        _lbyte(1)
        time.sleep_ms(3)
    elif l.startswith('C:lcdl:'):
        lcd_luz = 8 if l[7:8] == '1' else 0
        _lw(0)
if lcd_dir:
    try:
        lcd_init()
        lcd_texto(0, 'PiKT Smart Home')
        lcd_texto(1, 'Laboratorio')
    except Exception:
        lcd_dir = 0`;

// Dirección del PCF8574: 0x20-0x27 (PCF8574) o 0x38-0x3F (PCF8574A); la más común es 0x27.
const BUSCAR_LCD = (scan) => `lcd_dir = 0
try:
    for a in ${scan}:
        if 32 <= a <= 39 or 56 <= a <= 63:
            lcd_dir = a
except Exception:
    lcd_dir = 0`;

export function programaEsp32(p) {
  return `import sys, time, select
from machine import Pin, PWM, ADC
try:
    import neopixel
except ImportError:
    neopixel = None
try:
    import dht
except ImportError:
    dht = None
${constantes(p)}
def _adc(n):
    if n < 0:
        return None
    a = ADC(Pin(n))
    a.atten(ADC.ATTN_11DB)
    return a
def _din(n):
    return Pin(n, Pin.IN, Pin.PULL_UP) if n >= 0 else None
def _pwm(n, f):
    if n < 0:
        return None
    s = PWM(Pin(n), freq=f)
    s.duty_u16(0)
    return s
a_luz = _adc(LUZ)
a_vap = _adc(VAPOR)
a_sue = _adc(SUELO)
a_pot = _adc(POT)
a_mic = _adc(MIC)
a_lm = _adc(LM35)
led2 = Pin(LED2, Pin.OUT) if LED2 >= 0 else None
c_r = _pwm(RGB_R, 1000)
c_g = _pwm(RGB_G, 1000)
c_b = _pwm(RGB_B, 1000)
def _rgbd(r, g, b):
    for c, x in ((c_r, r), (c_g, g), (c_b, b)):
        if c:
            c.duty_u16(max(0, min(255, x)) * 257)
def _mic():
    if not a_mic:
        return -1
    lo = 65535
    hi = 0
    for _ in range(40):
        x = a_mic.read_u16()
        if x < lo:
            lo = x
        if x > hi:
            hi = x
    return (hi - lo) >> 4
def _lm35():
    if not a_lm:
        return -1
    try:
        return a_lm.read_uv() // 1000
    except Exception:
        return -1
d_gas = _din(GAS)
d_pir = Pin(PIR, Pin.IN) if PIR >= 0 else None
BINV = 0 if BOT_ALTO else 1
def _bot(n):
    if n < 0:
        return None
    return Pin(n, Pin.IN) if BOT_ALTO else Pin(n, Pin.IN, Pin.PULL_UP)
d_b1 = _bot(BOTON1)
d_b2 = _bot(BOTON2)
led = Pin(LED, Pin.OUT) if LED >= 0 else None
s_pta = _pwm(PUERTA, 50)
s_vta = _pwm(VENTANA, 50)
f_a = _pwm(VENTA, 1000)
if VENTB >= 0:
    Pin(VENTB, Pin.OUT).value(0)
zum = _pwm(ZUMBADOR, 440)
np = neopixel.NeoPixel(Pin(RGB), 4) if (neopixel and RGB >= 0) else None
sen = dht.DHT11(Pin(DHT)) if (dht and DHT >= 0) else None
try:
    from machine import I2C
    i2c = I2C(0, scl=Pin(LCD_SCL), sda=Pin(LCD_SDA), freq=100000)
except Exception:
    i2c = None
${BUSCAR_LCD('i2c.scan()')}
def _lw(b):
    i2c.writeto(lcd_dir, bytes([b | lcd_luz]))
${LCD_PY}
def _ang(s, a):
    if s:
        s.duty_u16(int(1638 + 6554 * max(0, min(180, a)) / 180))
def _rd(a):
    return (a.read_u16() >> 4) if a else -1
def _dv(q, inv):
    if q is None:
        return -1
    v = q.value()
    return (1 - v) if inv else v
def _led(v):
    if led:
        led.value(v)
temp = -1
hum = -1
ult_dht = time.ticks_add(time.ticks_ms(), -3000)
fin_zum = None
reac = 0
t_reac = 0
def orden(l):
    global fin_zum, reac, t_reac
    if l.startswith('C:lcd'):
        try:
            lcd_orden(l)
        except Exception:
            pass
        return
    q = l.strip().split(':')
    if len(q) < 2 or q[0] != 'C':
        return
    c = q[1]
    v = q[2] if len(q) > 2 else '0'
    try:
        if c == 'puerta':
            _ang(s_pta, int(v))
        elif c == 'ventana':
            _ang(s_vta, int(v))
        elif c == 'vent' and f_a:
            f_a.duty_u16(int(65535 * max(0, min(100, int(v))) / 100))
        elif c == 'led':
            _led(int(v))
        elif c == 'led2' and led2:
            led2.value(int(v))
        elif c == 'rgb':
            r, g, b = [int(x) for x in v.split(',')]
            _rgbd(r, g, b)
            if np:
                for i in range(4):
                    np[i] = (r, g, b)
                np.write()
        elif c == 'rgbi':
            i, r, g, b = [int(x) for x in v.split(',')]
            if np:
                np[i % 4] = (r, g, b)
                np.write()
            elif i == 0:
                _rgbd(r, g, b)
        elif c == 'pita' and zum:
            f, ms = [int(x) for x in v.split(',')]
            zum.freq(max(40, f))
            zum.duty_u16(32768)
            fin_zum = time.ticks_add(time.ticks_ms(), ms)
        elif c == 'reac':
            _led(0)
            reac = 1
            t_reac = time.ticks_add(time.ticks_ms(), 1500 + time.ticks_us() % 2500)
    except Exception:
        pass
pol = select.poll()
pol.register(sys.stdin, select.POLLIN)
buf = ''
print('KIT:esp32:${VERSION_KIT}')
print('LCD:' + str(lcd_dir))
prox = time.ticks_ms()
while True:
    while pol.poll(0):
        ch = sys.stdin.read(1)
        if ch == chr(10) or ch == chr(13):
            if buf:
                orden(buf)
            buf = ''
        else:
            buf += ch
            if len(buf) > 60:
                buf = ''
    now = time.ticks_ms()
    if fin_zum is not None and time.ticks_diff(now, fin_zum) >= 0:
        zum.duty_u16(0)
        fin_zum = None
    if reac:
        pulsa = _dv(d_b1, BINV) == 1
        if reac == 1:
            if pulsa:
                print('R:-1')
                reac = 0
            elif time.ticks_diff(now, t_reac) >= 0:
                _led(1)
                t_reac = now
                reac = 2
        elif pulsa:
            print('R:' + str(time.ticks_diff(now, t_reac)))
            _led(0)
            reac = 0
        elif time.ticks_diff(now, t_reac) > 3000:
            print('R:-2')
            _led(0)
            reac = 0
    if time.ticks_diff(now, prox) >= 0:
        prox = time.ticks_add(now, 250)
        if sen and time.ticks_diff(now, ult_dht) > 2000:
            ult_dht = now
            try:
                sen.measure()
                temp = sen.temperature()
                hum = sen.humidity()
            except Exception:
                pass
        print('K:%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d' % (temp, hum, _rd(a_luz), _rd(a_vap), _rd(a_sue), _dv(d_gas, 1), _dv(d_pir, 0), _dv(d_b1, BINV), _dv(d_b2, BINV), _rd(a_pot), _mic(), _lm35()))
    time.sleep_ms(5)
`;
}

// Driver DHT11 por software para micro:bit V2 (copiado de DHT_DRIVER_PY de BlocklyEditor.jsx:
// el timing de MicroPython es justo; si falla, se usa el termómetro interno de la micro:bit).
const DHT_MICROBIT = `_dht_cache = [-1, -1, -9999]
def _dht_read(p):
    p.write_digital(0)
    sleep(20)
    p.set_pull(p.PULL_UP)
    p.read_digital()
    n = 0
    while p.read_digital() == 1:
        n += 1
        if n > 2500:
            return None
    n = 0
    while p.read_digital() == 0:
        n += 1
        if n > 2500:
            return None
    n = 0
    while p.read_digital() == 1:
        n += 1
        if n > 2500:
            return None
    d = [0, 0, 0, 0, 0]
    for i in range(40):
        n = 0
        while p.read_digital() == 0:
            n += 1
            if n > 2500:
                return None
        t = time.ticks_us()
        n = 0
        while p.read_digital() == 1:
            n += 1
            if n > 2500:
                break
        if time.ticks_diff(time.ticks_us(), t) > 50:
            d[i // 8] |= 1 << (7 - (i % 8))
    if ((d[0] + d[1] + d[2] + d[3]) & 255) == d[4]:
        return d
    return None
def _dht_get(p):
    if _dht_cache[2] < 0 or running_time() - _dht_cache[2] > 2000:
        for _try in range(3):
            r = _dht_read(p)
            if r:
                _dht_cache[0] = r[2]
                _dht_cache[1] = r[0]
                _dht_cache[2] = running_time()
                break
            sleep(50)
    return _dht_cache`;

export function programaMicrobit(p) {
  return `from microbit import *
import microbit as _mb
import music, time
try:
    import neopixel
except ImportError:
    neopixel = None
${constantes(p)}
def _pin(n):
    return getattr(_mb, 'pin' + str(n)) if n >= 0 else None
USADOS = [DHT, LED, VAPOR, PIR, BOTON1, BOTON2, GAS, RGB, VENTANA, PUERTA, VENTA, VENTB, LUZ, SUELO]
if any(n in (3, 4, 6, 7, 9, 10) for n in USADOS):
    display.off()
${DHT_MICROBIT}
p_luz = _pin(LUZ)
p_vap = _pin(VAPOR)
p_sue = _pin(SUELO)
p_gas = _pin(GAS)
p_pir = _pin(PIR)
p_b1 = _pin(BOTON1)
p_b2 = _pin(BOTON2)
p_led = _pin(LED)
p_pta = _pin(PUERTA)
p_vta = _pin(VENTANA)
p_ven = _pin(VENTA)
p_dht = _pin(DHT)
np = neopixel.NeoPixel(_pin(RGB), 4) if (neopixel and RGB >= 0) else None
${BUSCAR_LCD('i2c.scan()')}
def _lw(b):
    i2c.write(lcd_dir, bytes([b | lcd_luz]))
${LCD_PY}
if p_ven:
    p_ven.write_digital(1)
def _ang(q, a):
    if q:
        q.set_analog_period(20)
        q.write_analog(round(26 + 102 * max(0, min(180, a)) / 180))
def _ra(q):
    return q.read_analog() if q else -1
def _dv(q, inv):
    if q is None:
        return -1
    v = q.read_digital()
    return (1 - v) if inv else v
def _luz():
    if p_luz:
        return p_luz.read_analog()
    if LUZ == -2:
        return display.read_light_level() * 4
    return -1
def _led(v):
    if p_led:
        p_led.write_digital(v)
APAGADA = any(n in (3, 4, 6, 7, 9, 10) for n in USADOS)
def _senal(v):
    # Tiempo de reaccion: ademas del LED del montaje, toda la pantalla de la micro:bit
    _led(v)
    if v:
        display.on()
        display.show(Image('99999:99999:99999:99999:99999'))
    else:
        display.clear()
        if APAGADA:
            display.off()
reac = 0
t_reac = 0
def orden(l):
    global reac, t_reac
    if l.startswith('C:lcd'):
        try:
            lcd_orden(l)
        except Exception:
            pass
        return
    q = l.strip().split(':')
    if len(q) < 2 or q[0] != 'C':
        return
    c = q[1]
    v = q[2] if len(q) > 2 else '0'
    try:
        if c == 'puerta':
            _ang(p_pta, int(v))
        elif c == 'ventana':
            _ang(p_vta, int(v))
        elif c == 'vent' and p_ven:
            pc = max(0, min(100, int(v)))
            if pc == 0:
                p_ven.write_digital(1)
            else:
                p_ven.write_analog(int(1023 - 10.23 * pc))
        elif c == 'led':
            _led(int(v))
        elif c == 'rgb' and np:
            r, g, b = [int(x) for x in v.split(',')]
            for i in range(4):
                np[i] = (r, g, b)
            np.show()
        elif c == 'rgbi' and np:
            i, r, g, b = [int(x) for x in v.split(',')]
            np[i % 4] = (r, g, b)
            np.show()
        elif c == 'pita':
            f, ms = [int(x) for x in v.split(',')]
            music.pitch(max(40, f), ms, wait=False)
        elif c == 'reac':
            _led(0)
            reac = 1
            t_reac = time.ticks_add(time.ticks_ms(), 1500 + time.ticks_us() % 2500)
    except Exception:
        pass
def _pulsa():
    return _dv(p_b1, 1) == 1 or button_a.is_pressed()
def _mic():
    try:
        return microphone.sound_level() * 2
    except Exception:
        return -1
buf = b''
print('KIT:mb:${VERSION_KIT}')
print('LCD:' + str(lcd_dir))
prox = time.ticks_ms()
while True:
    if uart.any():
        d = uart.read()
        if d:
            buf += d
        while bytes([10]) in buf:
            k = buf.find(bytes([10]))
            linea = str(buf[:k], 'utf-8')
            buf = buf[k + 1:]
            orden(linea)
        if len(buf) > 80:
            buf = b''
    now = time.ticks_ms()
    if reac:
        if reac == 1:
            if _pulsa():
                print('R:-1')
                reac = 0
            elif time.ticks_diff(now, t_reac) >= 0:
                _senal(1)
                t_reac = time.ticks_ms()
                reac = 2
        elif _pulsa():
            print('R:' + str(time.ticks_diff(now, t_reac)))
            _senal(0)
            reac = 0
        elif time.ticks_diff(now, t_reac) > 3000:
            print('R:-2')
            _senal(0)
            reac = 0
    if time.ticks_diff(now, prox) >= 0:
        prox = time.ticks_add(now, 250)
        if p_dht:
            th = _dht_get(p_dht)
            t, h = th[0], th[1]
        else:
            t, h = temperature(), -1
        print('K:%d,%d,%d,%d,%d,%d,%d,%d,%d,-1,%d,-1' % (t, h, _luz(), _ra(p_vap), _ra(p_sue), _ra(p_gas), _dv(p_pir, 0), _dv(p_b1, 1), _dv(p_b2, 1), _mic()))
    sleep(5)
`;
}
