// Laboratorio Smart Home de PiKT (pikt.es) para la ESP32 Keyestudio del kit Smart Home.
// Alternativa a MicroPython: la placa se queda con Arduino y habla con la web por el USB
// con el mismo protocolo que src/keyestudio/programasKit.js:
//   Placa -> web (cada 250 ms):  K:<temp>,<hum>,<luz>,<vapor>,<suelo>,<gas>,<pir>,<boton1>,<boton2>
//                                (-1 = no conectado; analógicos 0-4095; gas, pir y botones 0/1)
//                                KIT:arduino:1 al arrancar y al recibir «?»
//                                R:<ms> tiempo de reacción (-1 se adelantó, -2 no pulsó)
//   Web -> placa (líneas):       C:puerta:<0-180>  C:ventana:<0-180>  C:vent:<0-100>  C:led:<0|1>
//                                C:rgb:<r>,<g>,<b>  C:rgbi:<i>,<r>,<g>,<b>  C:pita:<hz>,<ms>  C:reac
//                                C:lcd:<fila>,<texto>  C:lcdb (borrar)  C:lcdl:<0|1> (luz)  · al arrancar: LCD:<dirección>
//
// ⚠️ Para subir el programa, desconecta lo que vaya a IO2/IO12/IO15 de la Shield: si alguno está en
// alto al arrancar, la ESP32 no entra en modo de programación («Failed to connect»).
//
// Cómo subirlo: Arduino IDE 2 -> Gestor de placas -> «esp32» de Espressif -> placa «ESP32 Dev Module»
// -> puerto COM de la placa -> Subir. No necesita librerías (el RGB usa Adafruit NeoPixel si está
// instalada; si no, se compila sin RGB). Después: PiKT -> Laboratorio Smart Home -> Conectar.

// ── Pines del montaje (manual KS5009 / CATEDU «Smart Home ESP32»). -1 = no conectado ──
const int P_DHT = 17, P_LED = 12, P_VAPOR = 34, P_PIR = 14, P_BOTON1 = 16, P_BOTON2 = 27;
const int P_GAS = 23, P_RGB = 26, P_ZUMBADOR = 25, P_VENTANA = 5, P_PUERTA = 13;
const int P_VENT_A = 19, P_VENT_B = 18;
const int P_LUZ = -1, P_SUELO = -1;  // el kit no los trae: pon aquí el pin analógico si conectas uno

const int P_LCD_SDA = 21, P_LCD_SCL = 22;  // pantalla LCD1602 I2C (cualquier puerto IIC de la Shield)

#include <Wire.h>
#if __has_include(<Adafruit_NeoPixel.h>)
#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel rgb(4, P_RGB, NEO_GRB + NEO_KHZ800);
#define HAY_RGB 1
#endif

// PWM: la API cambió en la versión 3 del paquete esp32 (por pin en vez de por canal)
#if ESP_ARDUINO_VERSION_MAJOR >= 3
#define PWM_INICIO(pin, canal, frec, bits) ledcAttach(pin, frec, bits)
#define PWM_ESCRIBIR(pin, canal, v) ledcWrite(pin, v)
#define PWM_TONO(pin, canal, f) ledcWriteTone(pin, f)
#else
#define PWM_INICIO(pin, canal, frec, bits) do { ledcSetup(canal, frec, bits); ledcAttachPin(pin, canal); } while (0)
#define PWM_ESCRIBIR(pin, canal, v) ledcWrite(canal, v)
#define PWM_TONO(pin, canal, f) ledcWriteTone(canal, f)
#endif
const int C_PUERTA = 2, C_VENTANA = 4, C_VENT = 6, C_ZUMBADOR = 8;

int temp = -1, hum = -1;
unsigned long ultDht = 0, prox = 0, finZumbador = 0;
int reac = 0;               // 0 parado · 1 esperando al LED · 2 LED encendido
unsigned long tReac = 0;
String linea;

void servo(int pin, int canal, int ang) {
  if (pin < 0) return;
  ang = constrain(ang, 0, 180);
  PWM_ESCRIBIR(pin, canal, 1638 + (long)6554 * ang / 180);  // 0,5-2,5 ms a 50 Hz (16 bits)
}
void led(int v) { if (P_LED >= 0) digitalWrite(P_LED, v); }
int analogico(int pin) { return pin < 0 ? -1 : analogRead(pin); }
int digitalActivo(int pin, bool activoBajo) {
  if (pin < 0) return -1;
  int v = digitalRead(pin);
  return activoBajo ? !v : v;
}

// DHT11 sin librería: espera a que el pin cambie de nivel (con límite en µs)
bool esperarNivel(int nivel, unsigned long us) {
  unsigned long t0 = micros();
  while (digitalRead(P_DHT) != nivel) if (micros() - t0 > us) return false;
  return true;
}
bool leerDHT11() {
  uint8_t d[5] = {0, 0, 0, 0, 0};
  pinMode(P_DHT, OUTPUT); digitalWrite(P_DHT, LOW); delay(20);
  digitalWrite(P_DHT, HIGH); delayMicroseconds(30);
  pinMode(P_DHT, INPUT_PULLUP);
  if (!esperarNivel(LOW, 120) || !esperarNivel(HIGH, 120) || !esperarNivel(LOW, 120)) return false;
  for (int i = 0; i < 40; i++) {
    if (!esperarNivel(HIGH, 90)) return false;
    unsigned long t0 = micros();
    if (!esperarNivel(LOW, 120)) return false;
    if (micros() - t0 > 45) d[i / 8] |= 1 << (7 - i % 8);   // ~27 µs = 0 · ~70 µs = 1
  }
  if (((d[0] + d[1] + d[2] + d[3]) & 0xFF) != d[4]) return false;
  hum = d[0]; temp = d[2];
  return true;
}

// LCD1602 con adaptador PCF8574 (P0 = RS, P2 = E, P3 = luz, P4-P7 = D4-D7), sin librería
uint8_t lcdDir = 0, lcdLuz = 8;
void lcdW(uint8_t b) { Wire.beginTransmission(lcdDir); Wire.write(b | lcdLuz); Wire.endTransmission(); }
void lcdNib(uint8_t b, uint8_t rs) { b = (b & 0xF0) | rs; lcdW(b | 4); delayMicroseconds(1); lcdW(b & ~4); delayMicroseconds(50); }
void lcdByte(uint8_t b, uint8_t rs = 0) { lcdNib(b & 0xF0, rs); lcdNib(b << 4, rs); }
void lcdTexto(int fila, String t) {
  if (!lcdDir) return;
  lcdByte(0x80 | (fila ? 0x40 : 0));
  for (int i = 0; i < 16; i++) {
    char c = i < (int)t.length() ? t[i] : ' ';
    lcdByte(c == '`' ? 223 : (c > 31 && c < 127) ? c : '?', 1);  // «`» = «°» de la ROM de la pantalla
  }
}
void lcdInicio() {
  for (uint8_t a = 0x20; a <= 0x3F; a++) {
    if (a == 0x28) a = 0x38;
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { lcdDir = a; break; }
  }
  if (!lcdDir) return;
  delay(50);
  for (int i = 0; i < 3; i++) { lcdNib(0x30, 0); delay(5); }
  lcdNib(0x20, 0);
  lcdByte(0x28); lcdByte(0x0C); lcdByte(0x06); lcdByte(0x01); delay(3);
  lcdTexto(0, "PiKT Smart Home"); lcdTexto(1, "Laboratorio");
}

void orden(String l) {
  if (l.startsWith("C:lcd:")) { lcdTexto(l.charAt(6) == '1' ? 1 : 0, l.substring(8)); return; }
  if (l.startsWith("C:lcdb")) { if (lcdDir) { lcdByte(0x01); delay(3); } return; }
  if (l.startsWith("C:lcdl:")) { lcdLuz = l.charAt(7) == '1' ? 8 : 0; if (lcdDir) lcdW(0); return; }
  l.trim();
  if (l == "?") { Serial.println("KIT:arduino:1"); Serial.printf("LCD:%d\n", lcdDir); return; }
  if (!l.startsWith("C:")) return;
  int p = l.indexOf(':', 2);
  String c = p < 0 ? l.substring(2) : l.substring(2, p);
  String v = p < 0 ? "0" : l.substring(p + 1);
  if (c == "puerta") servo(P_PUERTA, C_PUERTA, v.toInt());
  else if (c == "ventana") servo(P_VENTANA, C_VENTANA, v.toInt());
  else if (c == "vent" && P_VENT_A >= 0) PWM_ESCRIBIR(P_VENT_A, C_VENT, (long)255 * constrain(v.toInt(), 0, 100) / 100);
  else if (c == "led") led(v.toInt() ? HIGH : LOW);
  else if (c == "rgb") {
#ifdef HAY_RGB
    int a = v.indexOf(','), b = v.indexOf(',', a + 1);
    uint32_t col = rgb.Color(v.substring(0, a).toInt(), v.substring(a + 1, b).toInt(), v.substring(b + 1).toInt());
    for (int i = 0; i < 4; i++) rgb.setPixelColor(i, col);
    rgb.show();
#endif
  } else if (c == "rgbi") {
#ifdef HAY_RGB
    int a = v.indexOf(','), b = v.indexOf(',', a + 1), d = v.indexOf(',', b + 1);
    rgb.setPixelColor(v.substring(0, a).toInt() % 4, rgb.Color(v.substring(a + 1, b).toInt(), v.substring(b + 1, d).toInt(), v.substring(d + 1).toInt()));
    rgb.show();
#endif
  } else if (c == "pita" && P_ZUMBADOR >= 0) {
    int a = v.indexOf(',');
    PWM_TONO(P_ZUMBADOR, C_ZUMBADOR, max(40L, v.substring(0, a).toInt()));
    finZumbador = millis() + v.substring(a + 1).toInt();
  } else if (c == "reac") {
    led(LOW);
    reac = 1;
    tReac = millis() + 1500 + random(2500);
  }
}

void setup() {
  Serial.begin(115200);
  analogSetAttenuation(ADC_11db);  // 0-3,3 V
  if (P_LED >= 0) pinMode(P_LED, OUTPUT);
  if (P_PIR >= 0) pinMode(P_PIR, INPUT);
  if (P_GAS >= 0) pinMode(P_GAS, INPUT_PULLUP);
  if (P_BOTON1 >= 0) pinMode(P_BOTON1, INPUT_PULLUP);
  if (P_BOTON2 >= 0) pinMode(P_BOTON2, INPUT_PULLUP);
  if (P_PUERTA >= 0) PWM_INICIO(P_PUERTA, C_PUERTA, 50, 16);
  if (P_VENTANA >= 0) PWM_INICIO(P_VENTANA, C_VENTANA, 50, 16);
  if (P_VENT_A >= 0) { PWM_INICIO(P_VENT_A, C_VENT, 1000, 8); PWM_ESCRIBIR(P_VENT_A, C_VENT, 0); }
  if (P_VENT_B >= 0) { pinMode(P_VENT_B, OUTPUT); digitalWrite(P_VENT_B, LOW); }
  if (P_ZUMBADOR >= 0) { PWM_INICIO(P_ZUMBADOR, C_ZUMBADOR, 2000, 8); PWM_TONO(P_ZUMBADOR, C_ZUMBADOR, 0); }
#ifdef HAY_RGB
  rgb.begin(); rgb.clear(); rgb.show();
#endif
  Wire.begin(P_LCD_SDA, P_LCD_SCL);
  lcdInicio();
  randomSeed(micros());
  Serial.println("KIT:arduino:1");
  Serial.printf("LCD:%d\n", lcdDir);
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { if (linea.length()) orden(linea); linea = ""; }
    else if (linea.length() < 60) linea += ch;
  }
  unsigned long ahora = millis();
  if (finZumbador && (long)(ahora - finZumbador) >= 0) { PWM_TONO(P_ZUMBADOR, C_ZUMBADOR, 0); finZumbador = 0; }

  if (reac) {
    bool pulsa = digitalActivo(P_BOTON1, true) == 1;
    if (reac == 1) {
      if (pulsa) { Serial.println("R:-1"); reac = 0; }
      else if ((long)(ahora - tReac) >= 0) { led(HIGH); tReac = ahora; reac = 2; }
    } else if (pulsa) { Serial.print("R:"); Serial.println(ahora - tReac); led(LOW); reac = 0; }
    else if (ahora - tReac > 3000) { Serial.println("R:-2"); led(LOW); reac = 0; }
  }

  if ((long)(ahora - prox) >= 0) {
    prox = ahora + 250;
    if (P_DHT >= 0 && ahora - ultDht > 2000) { ultDht = ahora; for (int i = 0; i < 3 && !leerDHT11(); i++) delay(20); }
    Serial.printf("K:%d,%d,%d,%d,%d,%d,%d,%d,%d\n", temp, hum, analogico(P_LUZ), analogico(P_VAPOR), analogico(P_SUELO),
                  digitalActivo(P_GAS, true), digitalActivo(P_PIR, false), digitalActivo(P_BOTON1, true), digitalActivo(P_BOTON2, true));
  }
  delay(2);
}
