// Placas del Laboratorio Smart Home (kit Keyestudio de Innova Didáctica) y su mapa de pines.
// Dos montajes: la ESP32 Keyestudio (pines del manual KS5009 / CATEDU «Smart Home ESP32») y la
// micro:bit V2 en la Shield (montaje Aragón, los mismos pines que SMARTHOME_PINS de BlocklyEditor).
// Un pin a -1 significa «no conectado»: la placa no lo lee y la web lo muestra como «—».
// El usuario puede cambiar cualquier pin (se guarda en este navegador).

const LS = 'pikt_kit_config';

export const PLACAS = {
  // ESP32 STEAMakers + escudo Imagina TdR STEAM (Innova Didáctica / Keyestudio). Pines de la tabla de
  // CATEDU «Componentes de la placa Imagina TdR STEAM» y de fgcoca.github.io/ESP32-STEAMakers.
  // ⚠️ El potenciómetro está en IO2 (pin de arranque): para instalar hay que girarlo a cero.
  tdr: {
    id: 'tdr',
    nombre: 'Imagina TdR STEAM (ESP32)',
    emoji: '🟧',
    adcMax: 4095,
    esp32: true,
    usb: [{ usbVendorId: 0x10c4 }, { usbVendorId: 0x1a86 }],
    pines: {
      pot: 2, luz: 4, lm35: 36, mic: 34, dht: 17, boton1: 26, boton2: 14,
      led: 19, led2: 18, rgbR: 27, rgbG: 13, rgbB: 5, zumbador: 12, lcdSda: 21, lcdScl: 22,
      botonAlto: 1, // sin confirmar: si los botones salen al revés, se cambia en ⚙️ Pines
      // Puertos libres D3 = IO25 y D5 = IO16 (un servo o un PIR del kit se pueden poner ahí)
      puerta: -1, ventana: -1, pir: -1, gas: -1, vapor: -1, suelo: -1, rgb: -1, ventiladorA: -1, ventiladorB: -1,
    },
    pinesAnalogicos: [-1, 2, 4, 34, 36, 39],
  },
  esp32: {
    id: 'esp32',
    nombre: 'ESP32 Keyestudio Smart Home (KS5009)',
    emoji: '🟦',
    adcMax: 4095,
    esp32: true,
    // Filtros de Web Serial: CP2102 (Silicon Labs) y CH340 (WCH)
    usb: [{ usbVendorId: 0x10c4 }, { usbVendorId: 0x1a86 }],
    pines: {
      dht: 17, led: 12, vapor: 34, pir: 14, boton1: 16, boton2: 27, gas: 23,
      rgb: 26, zumbador: 25, ventana: 5, puerta: 13, ventiladorA: 19, ventiladorB: 18,
      luz: -1, suelo: -1, lcdSda: 21, lcdScl: 22,
    },
    // Pines que se pueden elegir en cada entrada analógica (ADC1: funcionan con el WiFi encendido)
    pinesAnalogicos: [-1, 32, 33, 34, 35, 36, 39],
  },
  microbit: {
    id: 'microbit',
    nombre: 'micro:bit V2 + Shield',
    emoji: '🟩',
    adcMax: 1023,
    usb: [{ usbVendorId: 0x0d28 }],
    pines: {
      dht: -1, led: 16, vapor: 0, pir: 15, boton1: 11, boton2: -1, gas: 2,
      rgb: 14, zumbador: -1, ventana: 9, puerta: 8, ventiladorA: 12, ventiladorB: -1,
      luz: 4, suelo: 3, lcdSda: 20, lcdScl: 19, // I2C fijo de la micro:bit
    },
    // -2 = sensor de luz interno de la micro:bit (la pantalla de LED; solo si no se apaga por P3/P4)
    pinesAnalogicos: [-1, -2, 0, 1, 2, 3, 4, 10],
  },
};

// Qué es cada pin (para el panel de configuración)
export const NOMBRES_PIN = {
  pot: '🎚️ Potenciómetro',
  mic: '🎤 Micrófono (sonido)',
  lm35: '🌡️ Temperatura (LM35)',
  dht: '🌡️ Temperatura y humedad (DHT11)',
  luz: '🔆 Luz (fotorresistencia)',
  vapor: '💧 Vapor / lluvia',
  suelo: '🌱 Humedad del suelo',
  gas: '💨 Gas (MQ-2)',
  pir: '🚶 Movimiento (PIR)',
  boton1: '🔘 Botón 1',
  boton2: '🔘 Botón 2',
  led: '💡 LED (rojo en la TdR)',
  led2: '💡 LED 2 (azul en la TdR)',
  rgb: '🌈 Tira de 4 LED RGB (NeoPixel)',
  rgbR: '🌈 LED RGB · rojo',
  rgbG: '🌈 LED RGB · verde',
  rgbB: '🌈 LED RGB · azul',
  zumbador: '🔔 Zumbador',
  puerta: '🚪 Servo de la puerta',
  ventana: '🪟 Servo de la ventana',
  ventiladorA: '🌀 Ventilador (IN+)',
  ventiladorB: '🌀 Ventilador (IN−)',
  lcdSda: '📟 Pantalla LCD (SDA)',
  lcdScl: '📟 Pantalla LCD (SCL)',
};

// Sensores que tiene cada placa (por orden de aparición en Panel, Lecturas, Estación y simulación)
const SENSORES_CASA = ['temp', 'hum', 'luz', 'vapor', 'suelo', 'gas', 'pir', 'boton1', 'boton2'];
export const SENSORES_PLACA = {
  tdr: ['pot', 'luz', 'tempLM', 'temp', 'hum', 'mic', 'boton1', 'boton2'],
  esp32: SENSORES_CASA,
  microbit: SENSORES_CASA,
};
export const sensoresDe = (placa) => SENSORES_PLACA[placa] || SENSORES_CASA;

export const ENTRADAS_ANALOGICAS =['luz', 'vapor', 'suelo', 'pot', 'mic', 'lm35'];

export function leerConfig() {
  let guardada = {};
  try { guardada = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { /* sin almacenamiento */ }
  const placa = PLACAS[guardada.placa] ? guardada.placa : 'tdr';
  const pines = {};
  // Todas las placas tienen todas las claves (-1 = no conectado), así los programas siempre las definen
  const todas = Object.fromEntries(Object.keys(NOMBRES_PIN).map((k) => [k, -1]));
  Object.keys(PLACAS).forEach((id) => { pines[id] = { ...todas, ...PLACAS[id].pines, ...(guardada.pines?.[id] || {}) }; });
  return { placa, pines };
}

export function guardarConfig(cfg) {
  try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch { /* sin almacenamiento */ }
}
