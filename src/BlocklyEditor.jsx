// BlocklyEditor.jsx
// Entorno de programación por bloques unificado para 3 placas:
//   - BBC Micro:bit V2  -> MicroPython
//   - CyberPi / mBot2   -> Python (librería cyberpi)
//   - Arduino Uno/Nano  -> C++ (Arduino)
//
// Dependencias npm:  npm install blockly
// (Web Serial API es nativa del navegador: requiere Chrome/Edge sobre HTTPS o localhost)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks'; // bloques estándar (lógica, bucles, matemáticas, texto, variables)
import * as Es from 'blockly/msg/es'; // idioma español
import { pythonGenerator, Order } from 'blockly/python';
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';

Blockly.setLocale(Es);

const PENDING_KEY = 'blockly_pending_save'; // proyecto a guardar tras registrarse
const SERIAL_ENCODER = new TextEncoder(); // texto → bytes para el puerto serie

// Construye una trama del protocolo de mBlock para que el CyberPi EJECUTE python.
// Formato: F3 [id] [len_lo] [len_hi] [28 00 00 00 pylen_lo pylen_hi <python>] [chk] F4
// (descubierto por ingeniería inversa de lo que envía mBlock; chk = suma de datos).
function buildCyberpiFrame(py) {
  const pb = SERIAL_ENCODER.encode(py);
  // 0x28 0x04 0x00 0x00 = ejecutar SENTENCIAS (import, while, def…). El modo
  // 0x28 0x00 0x00 0x00 solo evalúa expresiones simples (daba SyntaxError).
  const data = [0x28, 0x04, 0x00, 0x00, pb.length & 0xff, (pb.length >> 8) & 0xff, ...pb];
  let chk = 0;
  for (const b of data) chk = (chk + b) & 0xff;
  const len = data.length;
  const id = (len - 13) & 0xff;
  return new Uint8Array([0xf3, id, len & 0xff, (len >> 8) & 0xff, ...data, chk, 0xf4]);
}
// Genera un token aleatorio para los enlaces de compartir.
const randToken = () =>
  (window.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/-/g, '');

/* ──────────────────────────────────────────────────────────────────────────
   1. DEFINICIÓN DE BLOQUES Y GENERADORES
   Se definen una sola vez a nivel de módulo (evita duplicados en StrictMode).
   ────────────────────────────────────────────────────────────────────────── */

// Generador propio para Arduino (Blockly no trae uno oficial de C++).
const arduinoGenerator = new Blockly.Generator('Arduino');

// Precedencia de operadores (simplificada) para el generador de Arduino.
const ArdOrder = {
  ATOMIC: 0,
  UNARY: 1,
  MULTIPLICATIVE: 2,
  ADDITIVE: 3,
  RELATIONAL: 4,
  LOGICAL_AND: 5,
  LOGICAL_OR: 6,
  NONE: 99,
};

// Pines GPIO del Micro:bit para escritura/lectura digital y PWM
// (incluye P3/P4/P10/P11, usados por el montaje Smart Home de Aragón).
const MB_PINS = [
  ['P0', '0'], ['P1', '1'], ['P2', '2'], ['P3', '3'], ['P4', '4'],
  ['P8', '8'], ['P10', '10'], ['P11', '11'], ['P12', '12'],
  ['P13', '13'], ['P14', '14'], ['P15', '15'], ['P16', '16'],
];
// Pines con entrada ANALÓGICA en el micro:bit (canales ADC: P0–P4 y P10).
const MB_APINS = [
  ['P0', '0'], ['P1', '1'], ['P2', '2'], ['P3', '3'], ['P4', '4'], ['P10', '10'],
];

// «Micro:bit + Smart Home» es, a efectos de puerto/REPL/guardado, una micro:bit.
const baseBoard = (b) => (b === 'microbit_smarthome' ? 'microbit' : b);

// Driver MicroPython mínimo para la pantalla LCD 1602 por I²C (backpack PCF8574).
// Usa i2c y sleep de «from microbit import *». SCL=P19, SDA=P20.
const LCD_DRIVER_PY = `class _LCD:
    def __init__(s, addr=0x27):
        s.a = addr
        s.bl = 0x08
        for c in (0x33, 0x32, 0x28, 0x0C, 0x06, 0x01):
            s._cmd(c)
        sleep(5)
    def _w(s, d):
        i2c.write(s.a, bytes([d | s.bl]))
        i2c.write(s.a, bytes([d | 0x04 | s.bl]))
        i2c.write(s.a, bytes([(d & ~0x04) | s.bl]))
    def _send(s, b, m):
        s._w(m | (b & 0xF0))
        s._w(m | ((b << 4) & 0xF0))
    def _cmd(s, b):
        s._send(b, 0)
    def _chr(s, b):
        s._send(b, 1)
    def clear(s):
        s._cmd(0x01)
        sleep(2)
    def show(s, t, col=0, row=0):
        s._cmd(0x80 + 0x40 * row + col)
        for ch in str(t):
            s._chr(ord(ch))`;

// ───────────────────────────────────────────────────────────────────────────
// MAPA DE PINES DEL MONTAJE SMART HOME (Aragón).
// Edita aquí UNA sola vez: cada componente del kit ya queda asignado a su pin,
// así el alumnado no tiene que configurarlos. Los bloques muestran este pin por
// defecto (se puede cambiar en el desplegable si el montaje varía).
// ───────────────────────────────────────────────────────────────────────────
const SMARTHOME_PINS = {
  // ── ENTRADAS (sensores) ──
  pir: '1',         // 🚶 sensor de movimiento PIR (cúpula blanca) — digital
  gas: '2',         // 💨 sensor de gas / humo MQ-2 — analógico
  suelo: '3',       // 🌱 humedad del suelo (horquilla) — analógico
  luz: '4',         // 🔆 sensor de luz / fotorresistencia (LDR) — analógico
  vapor: '10',      // 💧 sensor de vapor / lluvia (tejado) — analógico
  boton: '11',      // 🔘 botón / sensor de choque (timbre, final de carrera) — digital
  // ── SALIDAS (actuadores) ──
  zumbador: '0',    // 🔔 zumbador (pin nativo de audio) — tono / melodía
  servo: '8',       // 🚪 servomotor puerta / ventana (azul) — 0–180°
  ventilador: '12', // 🌀 motor del ventilador — digital/PWM
  led: '13',        // 💡 LED amarillo (lámpara de habitación) — digital o PWM
  rgb: '14',        // 🌈 LED RGB / NeoPixel direccionable
};

// Reordena la lista de pines para que el pin del montaje aparezca por defecto.
const pinOpts = (def, base = MB_PINS) => {
  const first = base.find((o) => o[1] === def);
  const rest = base.filter((o) => o[1] !== def);
  return first ? [first, ...rest] : base;
};

let DEFINED = false;

function defineBlocksAndGenerators() {
  if (DEFINED) return;
  DEFINED = true;

  /* ───────── BLOQUES PERSONALIZADOS ───────── */
  Blockly.defineBlocksWithJsonArray([
    // ===== MICRO:BIT =====
    {
      type: 'microbit_on_start',
      message0: 'al iniciar %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      colour: 230,
      tooltip: 'Código que se ejecuta una vez al arrancar la placa',
    },
    {
      type: 'microbit_forever',
      message0: 'por siempre %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      colour: 230,
      tooltip: 'Bucle infinito (while True)',
    },
    {
      type: 'microbit_show_string',
      message0: 'mostrar texto %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: '¡Hola!' }],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'display.scroll() en la matriz de LEDs',
    },
    {
      type: 'microbit_show_leds',
      message0: 'encender matriz LED %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'IMG',
          options: [
            ['❤ corazón', 'HEART'],
            ['☺ feliz', 'HAPPY'],
            ['☹ triste', 'SAD'],
            ['✓ sí', 'YES'],
            ['✗ no', 'NO'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'display.show(Image.XXX)',
    },
    {
      type: 'microbit_pause',
      message0: 'esperar %1 ms',
      args0: [{ type: 'field_number', name: 'MS', value: 1000, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'sleep(ms)',
    },

    // ===== CYBERPI / mBOT2 =====
    {
      type: 'cyberpi_show_label',
      message0: 'mostrar en pantalla %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hola CyberPi' }],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'cyberpi.display.show_label()',
    },
    {
      type: 'cyberpi_led',
      message0: 'encender LED color %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'COLOR',
          options: [
            ['rojo', 'red'],
            ['verde', 'green'],
            ['azul', 'blue'],
            ['amarillo', 'yellow'],
            ['blanco', 'white'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 60,
      tooltip: 'cyberpi.led.on()',
    },
    {
      type: 'cyberpi_wait',
      message0: 'esperar %1 segundos',
      args0: [{ type: 'field_number', name: 'SEC', value: 1, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'time.sleep(seg)',
    },

    // ===== ARDUINO =====
    {
      type: 'arduino_setup_loop',
      message0: 'setup (una vez) %1 %2 loop (repetir) %3 %4',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'SETUP' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'LOOP' },
      ],
      colour: 290,
      tooltip: 'Estructura base de un sketch de Arduino',
    },
    {
      type: 'arduino_digital_write',
      message0: 'escribir pin digital %1 a %2',
      args0: [
        { type: 'field_number', name: 'PIN', value: 13, min: 0, precision: 1 },
        {
          type: 'field_dropdown',
          name: 'STATE',
          options: [
            ['ALTO (HIGH)', 'HIGH'],
            ['BAJO (LOW)', 'LOW'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'digitalWrite(pin, estado) — registra pinMode automáticamente',
    },
    {
      type: 'arduino_delay',
      message0: 'esperar %1 ms',
      args0: [{ type: 'field_number', name: 'MS', value: 1000, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'delay(ms)',
    },
    {
      type: 'arduino_serial_print',
      message0: 'Serial: imprimir %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hola' }],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'Serial.println()',
    },

    /* ════════════ ENTRADAS Y SENSORES ════════════ */

    // ===== MICRO:BIT — botones / teclado =====
    {
      type: 'microbit_button_pressed',
      message0: 'botón %1 pulsado',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BTN',
          options: [
            ['A', 'a'],
            ['B', 'b'],
            ['A+B', 'ab'],
          ],
        },
      ],
      output: 'Boolean',
      colour: 20,
      tooltip: 'button_x.is_pressed()',
    },
    {
      type: 'microbit_pin_touched',
      message0: 'pin %1 tocado',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: [
            ['P0', '0'],
            ['P1', '1'],
            ['P2', '2'],
          ],
        },
      ],
      output: 'Boolean',
      colour: 20,
      tooltip: 'pinN.is_touched() — entrada táctil',
    },
    {
      type: 'microbit_gesture',
      message0: 'gesto %1 detectado',
      args0: [
        {
          type: 'field_dropdown',
          name: 'GESTURE',
          options: [
            ['agitar', 'shake'],
            ['boca arriba', 'face up'],
            ['boca abajo', 'face down'],
            ['inclinar izquierda', 'left'],
            ['inclinar derecha', 'right'],
            ['caída libre', 'freefall'],
          ],
        },
      ],
      output: 'Boolean',
      colour: 20,
      tooltip: "accelerometer.is_gesture('shake')",
    },
    // ===== MICRO:BIT — sensores =====
    {
      type: 'microbit_temperature',
      message0: 'temperatura (°C)',
      output: 'Number',
      colour: 0,
      tooltip: 'temperature()',
    },
    {
      type: 'microbit_light_level',
      message0: 'nivel de luz',
      output: 'Number',
      colour: 0,
      tooltip: 'display.read_light_level() (0-255)',
    },
    {
      type: 'microbit_sound_level',
      message0: 'nivel de sonido (micro V2)',
      output: 'Number',
      colour: 0,
      tooltip: 'microphone.sound_level() (0-255)',
    },
    {
      type: 'microbit_compass_heading',
      message0: 'brújula (grados)',
      output: 'Number',
      colour: 0,
      tooltip: 'compass.heading()',
    },
    {
      type: 'microbit_accelerometer',
      message0: 'aceleración eje %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'AXIS',
          options: [
            ['X', 'x'],
            ['Y', 'y'],
            ['Z', 'z'],
          ],
        },
      ],
      output: 'Number',
      colour: 0,
      tooltip: 'accelerometer.get_x/y/z()',
    },

    // ===== CYBERPI — loop, botones / joystick =====
    {
      type: 'cyberpi_forever',
      message0: 'por siempre %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      colour: 200,
      tooltip: 'Bucle infinito (while True)',
    },
    {
      type: 'cyberpi_button_pressed',
      message0: 'botón %1 pulsado',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BTN',
          options: [
            ['A', 'a'],
            ['B', 'b'],
          ],
        },
      ],
      output: 'Boolean',
      colour: 20,
      tooltip: "cyberpi.controller.is_press('a')",
    },
    {
      type: 'cyberpi_joystick',
      message0: 'joystick %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'DIR',
          options: [
            ['arriba', 'up'],
            ['abajo', 'down'],
            ['izquierda', 'left'],
            ['derecha', 'right'],
            ['centro', 'middle'],
          ],
        },
      ],
      output: 'Boolean',
      colour: 20,
      tooltip: "cyberpi.controller.is_press('up')",
    },
    // ===== CYBERPI — sensores =====
    {
      type: 'cyberpi_loudness',
      message0: 'volumen del micrófono',
      output: 'Number',
      colour: 0,
      tooltip: 'cyberpi.get_loudness()',
    },
    {
      type: 'cyberpi_brightness',
      message0: 'sensor de luz',
      output: 'Number',
      colour: 0,
      tooltip: 'cyberpi.get_bri()',
    },
    {
      type: 'cyberpi_shake_val',
      message0: 'fuerza de agitación',
      output: 'Number',
      colour: 0,
      tooltip: 'cyberpi.get_shakeval()',
    },
    {
      type: 'cyberpi_attitude',
      message0: 'rotación %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'ANGLE',
          options: [
            ['roll', 'roll'],
            ['pitch', 'pitch'],
            ['yaw', 'yaw'],
          ],
        },
      ],
      output: 'Number',
      colour: 0,
      tooltip: 'cyberpi.get_roll/pitch/yaw()',
    },
    {
      type: 'cyberpi_accelerometer',
      message0: 'aceleración eje %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'AXIS',
          options: [
            ['X', 'x'],
            ['Y', 'y'],
            ['Z', 'z'],
          ],
        },
      ],
      output: 'Number',
      colour: 0,
      tooltip: "cyberpi.get_acc('x')",
    },

    // ===== ARDUINO — entradas =====
    {
      type: 'arduino_digital_read',
      message0: 'leer pin digital %1',
      args0: [{ type: 'field_number', name: 'PIN', value: 2, min: 0, precision: 1 }],
      output: 'Boolean',
      colour: 210,
      tooltip: 'digitalRead(pin) — registra pinMode(INPUT)',
    },
    {
      type: 'arduino_analog_read',
      message0: 'leer pin analógico %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: [
            ['A0', 'A0'],
            ['A1', 'A1'],
            ['A2', 'A2'],
            ['A3', 'A3'],
            ['A4', 'A4'],
            ['A5', 'A5'],
          ],
        },
      ],
      output: 'Number',
      colour: 230,
      tooltip: 'analogRead(Ax) (0-1023)',
    },
    {
      type: 'arduino_map',
      message0: 'mapear %1 de [ %2 , %3 ] a [ %4 , %5 ]',
      args0: [
        { type: 'input_value', name: 'VAL', check: 'Number' },
        { type: 'field_number', name: 'FROMLOW', value: 0 },
        { type: 'field_number', name: 'FROMHIGH', value: 1023 },
        { type: 'field_number', name: 'TOLOW', value: 0 },
        { type: 'field_number', name: 'TOHIGH', value: 255 },
      ],
      inputsInline: true,
      output: 'Number',
      colour: 230,
      tooltip: 'map(valor, fromLow, fromHigh, toLow, toHigh)',
    },
    {
      type: 'arduino_serial_available',
      message0: 'hay datos en el teclado serie',
      output: 'Boolean',
      colour: 290,
      tooltip: 'Serial.available() > 0',
    },
    {
      type: 'arduino_serial_read_int',
      message0: 'leer número del teclado serie',
      output: 'Number',
      colour: 290,
      tooltip: 'Serial.parseInt()',
    },
  ]);

  /* ════════════ BLOQUES AVANZADOS (paridad con editores oficiales) ════════════ */
  Blockly.defineBlocksWithJsonArray([
    // ===== MICRO:BIT — pantalla / pines / música / radio / voz =====
    {
      type: 'microbit_set_pixel',
      message0: 'encender LED x %1 y %2 brillo %3',
      args0: [
        { type: 'field_number', name: 'X', value: 0, min: 0, max: 4, precision: 1 },
        { type: 'field_number', name: 'Y', value: 0, min: 0, max: 4, precision: 1 },
        { type: 'field_number', name: 'B', value: 9, min: 0, max: 9, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'display.set_pixel(x, y, brillo 0-9)',
    },
    {
      type: 'microbit_clear',
      message0: 'limpiar pantalla',
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'display.clear()',
    },
    {
      type: 'microbit_button_was_pressed',
      message0: 'botón %1 fue pulsado',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BTN',
          options: [['A', 'a'], ['B', 'b']],
        },
      ],
      output: 'Boolean',
      colour: 20,
      tooltip: 'button_x.was_pressed()',
    },
    {
      type: 'microbit_button_presses',
      message0: 'veces pulsado botón %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'BTN',
          options: [['A', 'a'], ['B', 'b']],
        },
      ],
      output: 'Number',
      colour: 20,
      tooltip: 'button_x.get_presses()',
    },
    {
      type: 'microbit_running_time',
      message0: 'tiempo encendido (ms)',
      output: 'Number',
      colour: 120,
      tooltip: 'running_time()',
    },
    {
      type: 'microbit_pin_digital_write',
      message0: 'pin %1 escribir digital %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: MB_PINS },
        {
          type: 'field_dropdown',
          name: 'VAL',
          options: [['1 (ON)', '1'], ['0 (OFF)', '0']],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 180,
      tooltip: 'pinN.write_digital(valor)',
    },
    {
      type: 'microbit_pin_digital_read',
      message0: 'pin %1 leer digital',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: MB_PINS }],
      output: 'Number',
      colour: 180,
      tooltip: 'pinN.read_digital()',
    },
    {
      type: 'microbit_pin_analog_write',
      message0: 'pin %1 escribir PWM %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: MB_PINS },
        { type: 'field_number', name: 'VAL', value: 512, min: 0, max: 1023 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 180,
      tooltip: 'pinN.write_analog(0-1023)',
    },
    {
      type: 'microbit_pin_analog_read',
      message0: 'pin %1 leer analógico',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: [['P0', '0'], ['P1', '1'], ['P2', '2']],
        },
      ],
      output: 'Number',
      colour: 180,
      tooltip: 'pinN.read_analog() (0-1023)',
    },
    {
      type: 'microbit_music_play',
      message0: 'reproducir melodía %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'MELODY',
          options: [
            ['DADADADUM', 'DADADADUM'],
            ['Entertainer', 'ENTERTAINER'],
            ['Oda a la alegría', 'ODE'],
            ['Nyan', 'NYAN'],
            ['Cumpleaños', 'BIRTHDAY'],
            ['Boda', 'WEDDING'],
            ['Power up', 'POWER_UP'],
            ['Power down', 'POWER_DOWN'],
            ['Jump up', 'JUMP_UP'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'music.play(music.XXX)',
    },
    {
      type: 'microbit_music_pitch',
      message0: 'tono %1 Hz durante %2 ms',
      args0: [
        { type: 'field_number', name: 'FREQ', value: 440, min: 0 },
        { type: 'field_number', name: 'MS', value: 500, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'music.pitch(freq, ms)',
    },
    {
      type: 'microbit_speech_say',
      message0: 'decir (voz) %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello' }],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'speech.say() — en inglés',
    },
    {
      type: 'microbit_radio_group',
      message0: 'activar radio grupo %1',
      args0: [{ type: 'field_number', name: 'GROUP', value: 1, min: 0, max: 255, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 340,
      tooltip: 'radio.config(group=n) + radio.on()',
    },
    {
      type: 'microbit_radio_send',
      message0: 'enviar por radio %1',
      args0: [{ type: 'field_input', name: 'MSG', text: 'hola' }],
      previousStatement: null,
      nextStatement: null,
      colour: 340,
      tooltip: 'radio.send()',
    },
    {
      type: 'microbit_radio_receive',
      message0: 'mensaje recibido por radio',
      output: 'String',
      colour: 340,
      tooltip: 'radio.receive()',
    },

    // ===== CYBERPI / mBOT2 — consola / audio / LED / motores / sensores robot =====
    {
      type: 'cyberpi_console_print',
      message0: 'consola: imprimir %1',
      args0: [{ type: 'field_input', name: 'TEXT', text: 'Hola' }],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'cyberpi.console.println()',
    },
    {
      type: 'cyberpi_display_clear',
      message0: 'limpiar pantalla',
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'cyberpi.display.clear()',
    },
    {
      type: 'cyberpi_play_sound',
      message0: 'reproducir sonido %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'SOUND',
          options: [
            ['hola', 'hello'],
            ['adiós', 'bye'],
            ['risa', 'laugh'],
            ['sorpresa', 'surprised'],
            ['triste', 'sad'],
            ['correcto', 'right'],
            ['incorrecto', 'wrong'],
            ['tono alto', 'high_beep'],
            ['tono bajo', 'low_beep'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'cyberpi.audio.play()',
    },
    {
      type: 'cyberpi_play_tone',
      message0: 'tono %1 Hz durante %2 s',
      args0: [
        { type: 'field_number', name: 'FREQ', value: 440, min: 0 },
        { type: 'field_number', name: 'SEC', value: 0.5, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'cyberpi.audio.play_tone(freq, seg)',
    },
    {
      type: 'cyberpi_set_volume',
      message0: 'fijar volumen (0-100) a %1',
      args0: [{ type: 'field_number', name: 'VOL', value: 50, min: 0, max: 100 }],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'cyberpi.audio.set_vol()',
    },
    {
      type: 'cyberpi_led_off',
      message0: 'apagar todos los LED',
      previousStatement: null,
      nextStatement: null,
      colour: 60,
      tooltip: 'cyberpi.led.off()',
    },
    {
      type: 'cyberpi_led_rgb',
      message0: 'LED color R %1 G %2 B %3',
      args0: [
        { type: 'field_number', name: 'R', value: 255, min: 0, max: 255 },
        { type: 'field_number', name: 'G', value: 0, min: 0, max: 255 },
        { type: 'field_number', name: 'B', value: 0, min: 0, max: 255 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 60,
      tooltip: 'cyberpi.led.on(r, g, b)',
    },
    {
      type: 'mbot2_drive',
      message0: 'mBot2 %1 velocidad %2 durante %3 s',
      args0: [
        {
          type: 'field_dropdown',
          name: 'DIR',
          options: [
            ['avanzar', 'forward'],
            ['retroceder', 'backward'],
            ['girar izquierda', 'turn_left'],
            ['girar derecha', 'turn_right'],
          ],
        },
        { type: 'field_number', name: 'SPEED', value: 50, min: -100, max: 100 },
        { type: 'field_number', name: 'TIME', value: 1, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'mbot2.forward/backward/turn_left/turn_right(velocidad, tiempo)',
    },
    {
      type: 'mbot2_drive_speed',
      message0: 'mBot2 ruedas izq %1 der %2 (rpm)',
      args0: [
        { type: 'field_number', name: 'L', value: 50 },
        { type: 'field_number', name: 'R', value: 50 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'mbot2.drive_speed(izq, der)',
    },
    {
      type: 'mbot2_stop',
      message0: 'mBot2 parar motores',
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'mbot2.drive_speed(0, 0)',
    },
    {
      type: 'mbot2_ultrasonic',
      message0: 'distancia ultrasonidos (cm)',
      output: 'Number',
      colour: 0,
      tooltip: 'ultrasonic2.get_distance(1)',
    },
    {
      type: 'mbot2_line_offset',
      message0: 'desvío del seguidor de línea',
      output: 'Number',
      colour: 0,
      tooltip: 'quad_rgb_sensor.get_offset_track(1)',
    },

    // ===== ARDUINO — PWM / tono / servo / tiempo =====
    {
      type: 'arduino_analog_write',
      message0: 'escribir PWM pin %1 valor %2',
      args0: [
        { type: 'field_number', name: 'PIN', value: 9, min: 0, precision: 1 },
        { type: 'field_number', name: 'VAL', value: 128, min: 0, max: 255, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'analogWrite(pin, 0-255)',
    },
    {
      type: 'arduino_tone',
      message0: 'tono pin %1 frecuencia %2 Hz',
      args0: [
        { type: 'field_number', name: 'PIN', value: 8, min: 0, precision: 1 },
        { type: 'field_number', name: 'FREQ', value: 440, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'tone(pin, frecuencia)',
    },
    {
      type: 'arduino_no_tone',
      message0: 'parar tono pin %1',
      args0: [{ type: 'field_number', name: 'PIN', value: 8, min: 0, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'noTone(pin)',
    },
    {
      type: 'arduino_servo',
      message0: 'servo pin %1 ángulo %2 °',
      args0: [
        { type: 'field_number', name: 'PIN', value: 9, min: 0, precision: 1 },
        { type: 'field_number', name: 'ANGLE', value: 90, min: 0, max: 180, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'Servo.write(ángulo) — incluye <Servo.h>',
    },
    {
      type: 'arduino_millis',
      message0: 'tiempo encendido (ms)',
      output: 'Number',
      colour: 120,
      tooltip: 'millis()',
    },
    {
      type: 'arduino_constrain',
      message0: 'limitar %1 entre %2 y %3',
      args0: [
        { type: 'input_value', name: 'VAL', check: 'Number' },
        { type: 'field_number', name: 'LOW', value: 0 },
        { type: 'field_number', name: 'HIGH', value: 255 },
      ],
      inputsInline: true,
      output: 'Number',
      colour: 230,
      tooltip: 'constrain(valor, min, max)',
    },
    {
      type: 'arduino_random',
      message0: 'número aleatorio entre %1 y %2',
      args0: [
        { type: 'field_number', name: 'LOW', value: 0 },
        { type: 'field_number', name: 'HIGH', value: 100 },
      ],
      output: 'Number',
      colour: 230,
      tooltip: 'random(min, max+1)',
    },

    // Mostrar VALORES (de sensores u operaciones) en pantalla
    {
      type: 'microbit_show_value',
      message0: 'mostrar valor %1',
      args0: [{ type: 'input_value', name: 'NUM' }],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'display.scroll(str(valor))',
    },
    {
      type: 'cyberpi_show_value',
      message0: 'mostrar valor %1',
      args0: [{ type: 'input_value', name: 'NUM' }],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'cyberpi.display.show_label(str(valor))',
    },

    // Bloques de "código en bruto" (para importar código pegado que no se reconoce)
    {
      type: 'raw_py',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'CODE', text: 'pass' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#64748b',
      tooltip: 'Línea de código Python tal cual',
    },
    {
      type: 'raw_block_py',
      message0: '%1 %2',
      args0: [
        { type: 'field_input', name: 'HEAD', text: 'for i in range(3):' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#64748b',
      tooltip: 'Bloque de código Python con cuerpo (for, while, def…)',
    },
    {
      type: 'raw_cpp',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'CODE', text: ';' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#64748b',
      tooltip: 'Línea de código C++ tal cual',
    },
    {
      type: 'raw_block_cpp',
      message0: '%1 %2',
      args0: [
        { type: 'field_input', name: 'HEAD', text: 'if (x) {' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#64748b',
      tooltip: 'Bloque de código C++ con cuerpo (if, for, while…)',
    },

    // ===== MICRO:BIT + SMART HOME (Keyestudio · montaje Aragón) =====
    // — SENSORES (devuelven un valor) —
    {
      type: 'smarthome_luz',
      message0: '🔆 nivel de luz (LDR) en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.luz, MB_APINS) }],
      output: 'Number', colour: '#0d9488',
      tooltip: 'Sensor de luz: 0 (oscuro) … 1023 (mucha luz). read_analog().',
    },
    {
      type: 'smarthome_gas',
      message0: '💨 nivel de gas / humo en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.gas, MB_APINS) }],
      output: 'Number', colour: '#0d9488',
      tooltip: 'Sensor de gas/humo (analógico): valor 0…1023.',
    },
    {
      type: 'smarthome_vapor',
      message0: '💧 nivel de vapor / lluvia en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.vapor, MB_APINS) }],
      output: 'Number', colour: '#0d9488',
      tooltip: 'Sensor de vapor/lluvia (analógico): valor 0…1023.',
    },
    {
      type: 'smarthome_suelo',
      message0: '🌱 humedad del suelo en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.suelo, MB_APINS) }],
      output: 'Number', colour: '#0d9488',
      tooltip: 'Sensor de humedad del suelo (analógico): valor 0…1023.',
    },
    {
      type: 'smarthome_pir',
      message0: '🚶 ¿hay movimiento? (PIR) en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.pir) }],
      output: 'Boolean', colour: '#0d9488',
      tooltip: 'Sensor de movimiento PIR: verdadero si detecta movimiento.',
    },
    {
      type: 'smarthome_boton',
      message0: '🔘 ¿pulsado? (botón / choque) en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.boton) }],
      output: 'Boolean', colour: '#0d9488',
      tooltip: 'Botón pulsador / sensor de choque: verdadero al pulsar (timbre, ventana).',
    },
    {
      type: 'smarthome_analog_read',
      message0: 'leer sensor analógico (0–1023) en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: MB_APINS }],
      output: 'Number', colour: '#0d9488',
      tooltip: 'Lectura analógica genérica de cualquier sensor (read_analog).',
    },
    {
      type: 'smarthome_digital_read',
      message0: 'leer sensor digital en pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: MB_PINS }],
      output: 'Number', colour: '#0d9488',
      tooltip: 'Lectura digital genérica (0/1): botón, final de carrera, magnético…',
    },

    // — ACTUADORES (acciones) —
    {
      type: 'smarthome_led',
      message0: '💡 LED en pin %1 %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.led) },
        { type: 'field_dropdown', name: 'STATE', options: [['encender', '1'], ['apagar', '0']] },
      ],
      previousStatement: null, nextStatement: null, colour: '#f59e0b',
      tooltip: 'Enciende o apaga el LED (escritura digital).',
    },
    {
      type: 'smarthome_led_bright',
      message0: '💡 LED en pin %1 brillo %2 %%',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.led) },
        { type: 'field_number', name: 'VAL', value: 80, min: 0, max: 100 },
      ],
      previousStatement: null, nextStatement: null, colour: '#f59e0b',
      tooltip: 'Regula el brillo del LED (PWM 0–100 %).',
    },
    {
      type: 'smarthome_fan',
      message0: '🌀 ventilador / motor en pin %1 %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.ventilador) },
        { type: 'field_dropdown', name: 'STATE', options: [['encender', '1'], ['apagar', '0']] },
      ],
      previousStatement: null, nextStatement: null, colour: '#10b981',
      tooltip: 'Enciende o apaga el ventilador/motor (señal digital, como el toggle de MakeCode).',
    },
    {
      type: 'smarthome_servo',
      message0: '🚪 servo (puerta) en pin %1 ángulo %2 °',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.servo) },
        { type: 'field_number', name: 'ANG', value: 90, min: 0, max: 180 },
      ],
      previousStatement: null, nextStatement: null, colour: '#10b981',
      tooltip: 'Mueve el servo (puerta/ventana) al ángulo indicado (0–180°).',
    },
    {
      type: 'smarthome_rgb',
      message0: '🌈 LED RGB (pin %1) color %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.rgb) },
        {
          type: 'field_dropdown', name: 'COLOR',
          options: [
            ['rojo', '255,0,0'], ['verde', '0,255,0'], ['azul', '0,0,255'],
            ['amarillo', '255,180,0'], ['cian', '0,255,255'], ['magenta', '255,0,255'],
            ['blanco', '120,120,120'], ['apagado', '0,0,0'],
          ],
        },
      ],
      previousStatement: null, nextStatement: null, colour: '#10b981',
      tooltip: 'Pone el LED RGB / NeoPixel del color elegido (rojo=alarma, verde=seguro…).',
    },

    // — SONIDO (zumbador) —
    {
      type: 'smarthome_buzzer_tone',
      message0: '🔔 zumbador en pin %1 tono %2 Hz durante %3 ms',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.zumbador) },
        { type: 'field_number', name: 'FREQ', value: 440, min: 50, max: 5000 },
        { type: 'field_number', name: 'MS', value: 300, min: 10, max: 5000 },
      ],
      previousStatement: null, nextStatement: null, colour: '#a855f7',
      tooltip: 'Reproduce un tono en el zumbador.',
    },
    {
      type: 'smarthome_buzzer_melody',
      message0: '🔔 zumbador en pin %1 melodía %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: pinOpts(SMARTHOME_PINS.zumbador) },
        {
          type: 'field_dropdown', name: 'MELODY',
          options: [
            ['cumpleaños', 'BIRTHDAY'], ['boda', 'WEDDING'], ['entretenedor', 'ENTERTAINER'],
            ['nyan', 'NYAN'], ['subir nivel', 'POWER_UP'], ['bajar nivel', 'POWER_DOWN'],
            ['alarma', 'BADDY'], ['redoble', 'DADADADUM'],
          ],
        },
      ],
      previousStatement: null, nextStatement: null, colour: '#a855f7',
      tooltip: 'Reproduce una melodía predefinida en el zumbador.',
    },

    // — PANTALLA LCD 1602 I²C (SCL=P19, SDA=P20) —
    {
      type: 'smarthome_lcd_init',
      message0: '🖥️ iniciar pantalla LCD I²C (dirección %1)',
      args0: [{ type: 'field_dropdown', name: 'ADDR', options: [['0x27', '0x27'], ['0x3F', '0x3F']] }],
      previousStatement: null, nextStatement: null, colour: '#3b82f6',
      tooltip: 'Inicia la LCD 1602 por I²C (SCL=P19, SDA=P20). Ponlo «al empezar».',
    },
    {
      type: 'smarthome_lcd_show',
      message0: '🖥️ LCD escribir %1 en fila %2 columna %3',
      args0: [
        { type: 'field_input', name: 'TEXT', text: 'Hola' },
        { type: 'field_dropdown', name: 'ROW', options: [['1', '0'], ['2', '1']] },
        { type: 'field_number', name: 'COL', value: 0, min: 0, max: 15 },
      ],
      previousStatement: null, nextStatement: null, colour: '#3b82f6',
      tooltip: 'Escribe texto en la pantalla LCD.',
    },
    {
      type: 'smarthome_lcd_clear',
      message0: '🖥️ LCD borrar pantalla',
      previousStatement: null, nextStatement: null, colour: '#3b82f6',
      tooltip: 'Borra la pantalla LCD.',
    },
  ]);

  /* ───────── GENERADORES PYTHON (Micro:bit + CyberPi) ───────── */
  const P = pythonGenerator;

  // --- Micro:bit (MicroPython) ---
  P.forBlock['microbit_on_start'] = function (block, gen) {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    let branch = gen.statementToCode(block, 'DO');
    // statementToCode indenta el cuerpo; como «al iniciar» es código de nivel
    // superior, le quitamos un nivel de sangría (si no, da IndentationError).
    if (branch) branch = branch.replace(new RegExp('^' + gen.INDENT, 'gm'), '');
    return branch || '';
  };
  P.forBlock['microbit_forever'] = function (block, gen) {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    let branch = gen.statementToCode(block, 'DO');
    branch = branch || gen.INDENT + 'pass\n';
    return 'while True:\n' + branch;
  };
  P.forBlock['microbit_show_string'] = function (block, gen) {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    const txt = block.getFieldValue('TEXT');
    return `display.scroll(${gen.quote_(txt)})\n`;
  };
  P.forBlock['microbit_show_leds'] = function (block, gen) {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    const img = block.getFieldValue('IMG');
    return `display.show(Image.${img})\n`;
  };
  P.forBlock['microbit_pause'] = function (block) {
    const ms = block.getFieldValue('MS');
    return `sleep(${ms})\n`;
  };

  // --- CyberPi / mBot2 (Python con librería cyberpi) ---
  P.forBlock['cyberpi_show_label'] = function (block, gen) {
    gen.definitions_['import_cyberpi'] = 'import cyberpi';
    const txt = block.getFieldValue('TEXT');
    return `cyberpi.display.show_label(${gen.quote_(txt)}, 16, 'center')\n`;
  };
  P.forBlock['cyberpi_led'] = function (block, gen) {
    gen.definitions_['import_cyberpi'] = 'import cyberpi';
    const color = block.getFieldValue('COLOR');
    return `cyberpi.led.on(${gen.quote_(color)})\n`;
  };
  P.forBlock['cyberpi_wait'] = function (block, gen) {
    gen.definitions_['import_time'] = 'import time';
    const sec = block.getFieldValue('SEC');
    return `time.sleep(${sec})\n`;
  };

  /* ── ENTRADAS / SENSORES MICRO:BIT (reporter blocks) ── */
  const mbImport = (gen) => {
    gen.definitions_['import_microbit'] = 'from microbit import *';
  };
  P.forBlock['microbit_button_pressed'] = function (block, gen) {
    mbImport(gen);
    const btn = block.getFieldValue('BTN');
    let code;
    if (btn === 'ab') code = '(button_a.is_pressed() and button_b.is_pressed())';
    else code = `button_${btn}.is_pressed()`;
    return [code, Order.ATOMIC];
  };
  P.forBlock['microbit_pin_touched'] = function (block, gen) {
    mbImport(gen);
    return [`pin${block.getFieldValue('PIN')}.is_touched()`, Order.ATOMIC];
  };
  P.forBlock['microbit_gesture'] = function (block, gen) {
    mbImport(gen);
    return [
      `accelerometer.is_gesture(${gen.quote_(block.getFieldValue('GESTURE'))})`,
      Order.ATOMIC,
    ];
  };
  P.forBlock['microbit_temperature'] = function (block, gen) {
    mbImport(gen);
    return ['temperature()', Order.ATOMIC];
  };
  P.forBlock['microbit_light_level'] = function (block, gen) {
    mbImport(gen);
    return ['display.read_light_level()', Order.ATOMIC];
  };
  P.forBlock['microbit_sound_level'] = function (block, gen) {
    mbImport(gen);
    return ['microphone.sound_level()', Order.ATOMIC];
  };
  P.forBlock['microbit_compass_heading'] = function (block, gen) {
    mbImport(gen);
    return ['compass.heading()', Order.ATOMIC];
  };
  P.forBlock['microbit_accelerometer'] = function (block, gen) {
    mbImport(gen);
    return [`accelerometer.get_${block.getFieldValue('AXIS')}()`, Order.ATOMIC];
  };

  /* ── CYBERPI: loop + entradas / sensores ── */
  const cpImport = (gen) => {
    gen.definitions_['import_cyberpi'] = 'import cyberpi';
  };
  P.forBlock['cyberpi_forever'] = function (block, gen) {
    cpImport(gen);
    let branch = gen.statementToCode(block, 'DO');
    branch = branch || gen.INDENT + 'pass\n';
    return 'while True:\n' + branch;
  };
  P.forBlock['cyberpi_button_pressed'] = function (block, gen) {
    cpImport(gen);
    return [
      `cyberpi.controller.is_press(${gen.quote_(block.getFieldValue('BTN'))})`,
      Order.ATOMIC,
    ];
  };
  P.forBlock['cyberpi_joystick'] = function (block, gen) {
    cpImport(gen);
    return [
      `cyberpi.controller.is_press(${gen.quote_(block.getFieldValue('DIR'))})`,
      Order.ATOMIC,
    ];
  };
  P.forBlock['cyberpi_loudness'] = function (block, gen) {
    cpImport(gen);
    return ['cyberpi.get_loudness()', Order.ATOMIC];
  };
  P.forBlock['cyberpi_brightness'] = function (block, gen) {
    cpImport(gen);
    return ['cyberpi.get_bri()', Order.ATOMIC];
  };
  P.forBlock['cyberpi_shake_val'] = function (block, gen) {
    cpImport(gen);
    return ['cyberpi.get_shakeval()', Order.ATOMIC];
  };
  P.forBlock['cyberpi_attitude'] = function (block, gen) {
    cpImport(gen);
    return [`cyberpi.get_${block.getFieldValue('ANGLE')}()`, Order.ATOMIC];
  };
  P.forBlock['cyberpi_accelerometer'] = function (block, gen) {
    cpImport(gen);
    return [
      `cyberpi.get_acc(${gen.quote_(block.getFieldValue('AXIS'))})`,
      Order.ATOMIC,
    ];
  };

  /* ── MICRO:BIT avanzado: pantalla / pines / música / radio / voz ── */
  P.forBlock['microbit_set_pixel'] = function (block, gen) {
    mbImport(gen);
    return `display.set_pixel(${block.getFieldValue('X')}, ${block.getFieldValue('Y')}, ${block.getFieldValue('B')})\n`;
  };
  P.forBlock['microbit_clear'] = function (block, gen) {
    mbImport(gen);
    return 'display.clear()\n';
  };
  P.forBlock['microbit_button_was_pressed'] = function (block, gen) {
    mbImport(gen);
    return [`button_${block.getFieldValue('BTN')}.was_pressed()`, Order.ATOMIC];
  };
  P.forBlock['microbit_button_presses'] = function (block, gen) {
    mbImport(gen);
    return [`button_${block.getFieldValue('BTN')}.get_presses()`, Order.ATOMIC];
  };
  P.forBlock['microbit_running_time'] = function (block, gen) {
    mbImport(gen);
    return ['running_time()', Order.ATOMIC];
  };
  P.forBlock['microbit_pin_digital_write'] = function (block, gen) {
    mbImport(gen);
    return `pin${block.getFieldValue('PIN')}.write_digital(${block.getFieldValue('VAL')})\n`;
  };
  P.forBlock['microbit_pin_digital_read'] = function (block, gen) {
    mbImport(gen);
    return [`pin${block.getFieldValue('PIN')}.read_digital()`, Order.ATOMIC];
  };
  P.forBlock['microbit_pin_analog_write'] = function (block, gen) {
    mbImport(gen);
    return `pin${block.getFieldValue('PIN')}.write_analog(${block.getFieldValue('VAL')})\n`;
  };
  P.forBlock['microbit_pin_analog_read'] = function (block, gen) {
    mbImport(gen);
    return [`pin${block.getFieldValue('PIN')}.read_analog()`, Order.ATOMIC];
  };
  P.forBlock['microbit_music_play'] = function (block, gen) {
    mbImport(gen);
    gen.definitions_['import_music'] = 'import music';
    return `music.play(music.${block.getFieldValue('MELODY')})\n`;
  };
  P.forBlock['microbit_music_pitch'] = function (block, gen) {
    mbImport(gen);
    gen.definitions_['import_music'] = 'import music';
    return `music.pitch(${block.getFieldValue('FREQ')}, ${block.getFieldValue('MS')})\n`;
  };
  P.forBlock['microbit_speech_say'] = function (block, gen) {
    gen.definitions_['import_speech'] = 'import speech';
    return `speech.say(${gen.quote_(block.getFieldValue('TEXT'))})\n`;
  };

  /* ── MICRO:BIT + SMART HOME (Keyestudio · montaje Aragón) ── */
  // Sensores (lecturas)
  const shAnalog = (block, gen) => {
    mbImport(gen);
    return [`pin${block.getFieldValue('PIN')}.read_analog()`, Order.ATOMIC];
  };
  P.forBlock['smarthome_luz'] = shAnalog;
  P.forBlock['smarthome_gas'] = shAnalog;
  P.forBlock['smarthome_vapor'] = shAnalog;
  P.forBlock['smarthome_suelo'] = shAnalog;
  P.forBlock['smarthome_analog_read'] = shAnalog;
  P.forBlock['smarthome_digital_read'] = function (block, gen) {
    mbImport(gen);
    return [`pin${block.getFieldValue('PIN')}.read_digital()`, Order.ATOMIC];
  };
  const shDigitalBool = (block, gen) => {
    mbImport(gen);
    return [`(pin${block.getFieldValue('PIN')}.read_digital() == 1)`, Order.ATOMIC];
  };
  P.forBlock['smarthome_pir'] = shDigitalBool;
  P.forBlock['smarthome_boton'] = shDigitalBool;
  // Actuadores
  P.forBlock['smarthome_led'] = function (block, gen) {
    mbImport(gen);
    return `pin${block.getFieldValue('PIN')}.write_digital(${block.getFieldValue('STATE')})\n`;
  };
  P.forBlock['smarthome_rgb'] = function (block, gen) {
    mbImport(gen);
    gen.definitions_['import_neopixel'] = 'import neopixel';
    const pin = block.getFieldValue('PIN');
    gen.definitions_['def_rgb'] =
      'def _rgb(p, r, g, b):\n' +
      '    np = neopixel.NeoPixel(p, 1)\n' +
      '    np[0] = (r, g, b)\n' +
      '    np.show()';
    return `_rgb(pin${pin}, ${block.getFieldValue('COLOR')})\n`;
  };
  const shPwm = (block, gen) => {
    mbImport(gen);
    const v = Math.round((Number(block.getFieldValue('VAL')) / 100) * 1023);
    return `pin${block.getFieldValue('PIN')}.write_analog(${v})\n`;
  };
  P.forBlock['smarthome_led_bright'] = shPwm;
  P.forBlock['smarthome_fan'] = function (block, gen) {
    mbImport(gen);
    return `pin${block.getFieldValue('PIN')}.write_digital(${block.getFieldValue('STATE')})\n`;
  };
  P.forBlock['smarthome_servo'] = function (block, gen) {
    mbImport(gen);
    gen.definitions_['def_servo'] =
      'def _servo(p, ang):\n' +
      '    p.set_analog_period(20)\n' +
      '    p.write_analog(round(26 + (128 - 26) * ang / 180))';
    return `_servo(pin${block.getFieldValue('PIN')}, ${block.getFieldValue('ANG')})\n`;
  };
  // Sonido
  P.forBlock['smarthome_buzzer_tone'] = function (block, gen) {
    mbImport(gen);
    gen.definitions_['import_music'] = 'import music';
    return `music.pitch(${block.getFieldValue('FREQ')}, ${block.getFieldValue('MS')}, pin=pin${block.getFieldValue('PIN')})\n`;
  };
  P.forBlock['smarthome_buzzer_melody'] = function (block, gen) {
    mbImport(gen);
    gen.definitions_['import_music'] = 'import music';
    return `music.play(music.${block.getFieldValue('MELODY')}, pin=pin${block.getFieldValue('PIN')})\n`;
  };
  // Pantalla LCD 1602 I²C. La pantalla se crea automáticamente como variable
  // global `lcd` (def. de nivel superior) la primera vez que se usa CUALQUIER
  // bloque de LCD, así no hace falta acordarse del bloque «iniciar». El bloque
  // «iniciar» solo sirve para fijar la dirección I²C (0x27 / 0x3F).
  const lcdEnsure = (gen, addr) => {
    mbImport(gen);
    gen.definitions_['class_lcd'] = LCD_DRIVER_PY;
    if (addr) gen.definitions_['zz_lcd_obj'] = `lcd = _LCD(${addr})`;
    else if (!gen.definitions_['zz_lcd_obj']) gen.definitions_['zz_lcd_obj'] = 'lcd = _LCD(0x27)';
  };
  P.forBlock['smarthome_lcd_init'] = function (block, gen) {
    lcdEnsure(gen, block.getFieldValue('ADDR'));
    return '';
  };
  P.forBlock['smarthome_lcd_show'] = function (block, gen) {
    lcdEnsure(gen);
    return `lcd.show(${gen.quote_(block.getFieldValue('TEXT'))}, ${block.getFieldValue('COL')}, ${block.getFieldValue('ROW')})\n`;
  };
  P.forBlock['smarthome_lcd_clear'] = function (block, gen) {
    lcdEnsure(gen);
    return 'lcd.clear()\n';
  };
  P.forBlock['microbit_radio_group'] = function (block, gen) {
    gen.definitions_['import_radio'] = 'import radio';
    return `radio.config(group=${block.getFieldValue('GROUP')})\nradio.on()\n`;
  };
  P.forBlock['microbit_radio_send'] = function (block, gen) {
    gen.definitions_['import_radio'] = 'import radio';
    return `radio.send(${gen.quote_(block.getFieldValue('MSG'))})\n`;
  };
  P.forBlock['microbit_radio_receive'] = function (block, gen) {
    gen.definitions_['import_radio'] = 'import radio';
    return ['radio.receive()', Order.ATOMIC];
  };

  /* ── CYBERPI avanzado: consola / audio / LED ── */
  P.forBlock['cyberpi_console_print'] = function (block, gen) {
    cpImport(gen);
    return `cyberpi.console.println(${gen.quote_(block.getFieldValue('TEXT'))})\n`;
  };
  P.forBlock['cyberpi_display_clear'] = function (block, gen) {
    cpImport(gen);
    return 'cyberpi.display.clear()\n';
  };
  P.forBlock['cyberpi_play_sound'] = function (block, gen) {
    cpImport(gen);
    return `cyberpi.audio.play(${gen.quote_(block.getFieldValue('SOUND'))})\n`;
  };
  P.forBlock['cyberpi_play_tone'] = function (block, gen) {
    cpImport(gen);
    return `cyberpi.audio.play_tone(${block.getFieldValue('FREQ')}, ${block.getFieldValue('SEC')})\n`;
  };
  P.forBlock['cyberpi_set_volume'] = function (block, gen) {
    cpImport(gen);
    return `cyberpi.audio.set_vol(${block.getFieldValue('VOL')})\n`;
  };
  P.forBlock['cyberpi_led_off'] = function (block, gen) {
    cpImport(gen);
    return 'cyberpi.led.off()\n';
  };
  P.forBlock['cyberpi_led_rgb'] = function (block, gen) {
    cpImport(gen);
    return `cyberpi.led.on(${block.getFieldValue('R')}, ${block.getFieldValue('G')}, ${block.getFieldValue('B')})\n`;
  };

  // Mostrar valores en pantalla
  P.forBlock['microbit_show_value'] = function (block, gen) {
    mbImport(gen);
    const v = gen.valueToCode(block, 'NUM', Order.NONE) || '0';
    return `display.scroll(str(${v}))\n`;
  };
  P.forBlock['cyberpi_show_value'] = function (block, gen) {
    cpImport(gen);
    const v = gen.valueToCode(block, 'NUM', Order.NONE) || '0';
    return `cyberpi.display.show_label(str(${v}), 16, 'center')\n`;
  };

  // Bloques de código en bruto (Python)
  P.forBlock['raw_py'] = function (block) {
    return block.getFieldValue('CODE') + '\n';
  };
  P.forBlock['raw_block_py'] = function (block, gen) {
    let body = gen.statementToCode(block, 'DO');
    if (!body) body = gen.INDENT + 'pass\n';
    return block.getFieldValue('HEAD') + '\n' + body;
  };

  /* ── mBOT2: motores y sensores del robot ── */
  const mbot2Import = (gen) => {
    gen.definitions_['import_mbot2'] = 'import mbot2';
  };
  P.forBlock['mbot2_drive'] = function (block, gen) {
    mbot2Import(gen);
    gen.definitions_['import_time'] = 'import time';
    const s = Number(block.getFieldValue('SPEED'));
    const t = block.getFieldValue('TIME');
    // Control directo por potencia (drive_power): mueve las ruedas sin esperar
    // a los encoders (mbot2.forward podía quedarse colgado). L/R según el sentido.
    const dir = block.getFieldValue('DIR');
    const map = {
      forward: [s, s],
      backward: [-s, -s],
      turn_left: [-s, s],
      turn_right: [s, -s],
    };
    const [l, r] = map[dir] || [s, s];
    return `mbot2.drive_power(${l}, ${r})\ntime.sleep(${t})\nmbot2.drive_power(0, 0)\n`;
  };
  P.forBlock['mbot2_drive_speed'] = function (block, gen) {
    mbot2Import(gen);
    return `mbot2.drive_power(${block.getFieldValue('L')}, ${block.getFieldValue('R')})\n`;
  };
  P.forBlock['mbot2_stop'] = function (block, gen) {
    mbot2Import(gen);
    return 'mbot2.drive_power(0, 0)\n';
  };
  P.forBlock['mbot2_ultrasonic'] = function (block, gen) {
    gen.definitions_['import_ultrasonic'] = 'from mbuild import ultrasonic2';
    return ['ultrasonic2.get_distance(1)', Order.ATOMIC];
  };
  P.forBlock['mbot2_line_offset'] = function (block, gen) {
    gen.definitions_['import_quad'] = 'from mbuild import quad_rgb_sensor';
    return ['quad_rgb_sensor.get_offset_track(1)', Order.ATOMIC];
  };

  /* ───────── GENERADOR ARDUINO (C++) ───────── */
  const A = arduinoGenerator;
  A.ORDER_ATOMIC = ArdOrder.ATOMIC;

  A.init = function () {
    A.includes_ = Object.create(null);
    A.setups_ = Object.create(null);
    A.definitions_ = Object.create(null);
  };

  // Une cada bloque con el siguiente de la pila.
  A.scrub_ = function (block, code, thisOnly) {
    const nextBlock =
      block.nextConnection && block.nextConnection.targetBlock();
    let nextCode = '';
    if (nextBlock && !thisOnly) nextCode = A.blockToCode(nextBlock);
    return code + nextCode;
  };

  // Ensambla el sketch final con includes, setup() y loop().
  A.finish = function (code) {
    const includes = Object.values(A.includes_).join('\n');
    const defs = Object.values(A.definitions_).join('\n');
    const setupLines = Object.values(A.setups_)
      .map((l) => '  ' + l)
      .join('\n');

    return (
      (includes ? includes + '\n' : '') +
      (defs ? defs + '\n\n' : '') +
      'void setup() {\n' +
      '  Serial.begin(115200);\n' +
      (setupLines ? setupLines + '\n' : '') +
      '}\n\n' +
      'void loop() {\n' +
      code +
      '}\n'
    );
  };

  // Indenta cada línea (para cuerpos dentro de loop()).
  const indent = (str) =>
    (str || '')
      .split('\n')
      .filter((l) => l.length)
      .map((l) => '  ' + l)
      .join('\n') + (str ? '\n' : '');

  // Bloque contenedor setup/loop: SETUP va a setups_, LOOP es el cuerpo de loop().
  A.forBlock['arduino_setup_loop'] = function (block) {
    const setupBranch = A.statementToCode(block, 'SETUP');
    setupBranch
      .split('\n')
      .filter((l) => l.trim())
      .forEach((l, i) => {
        A.setups_['user_' + i] = l.trim();
      });
    const loopBranch = A.statementToCode(block, 'LOOP');
    return indent(loopBranch);
  };

  A.forBlock['arduino_digital_write'] = function (block) {
    const pin = block.getFieldValue('PIN');
    const state = block.getFieldValue('STATE');
    A.setups_['pinmode_' + pin] = `pinMode(${pin}, OUTPUT);`;
    return `digitalWrite(${pin}, ${state});\n`;
  };
  A.forBlock['arduino_delay'] = function (block) {
    return `delay(${block.getFieldValue('MS')});\n`;
  };
  A.forBlock['arduino_serial_print'] = function (block) {
    const txt = block.getFieldValue('TEXT').replace(/"/g, '\\"');
    return `Serial.println("${txt}");\n`;
  };

  // Generadores Arduino para bloques ESTÁNDAR usados en el toolbox.
  A.forBlock['math_number'] = function (block) {
    const code = Number(block.getFieldValue('NUM'));
    return [String(code), ArdOrder.ATOMIC];
  };
  A.forBlock['text'] = function (block) {
    const txt = block.getFieldValue('TEXT').replace(/"/g, '\\"');
    return [`"${txt}"`, ArdOrder.ATOMIC];
  };
  A.forBlock['logic_boolean'] = function (block) {
    return [
      block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false',
      ArdOrder.ATOMIC,
    ];
  };
  A.forBlock['math_arithmetic'] = function (block) {
    const OPS = {
      ADD: [' + ', ArdOrder.ADDITIVE],
      MINUS: [' - ', ArdOrder.ADDITIVE],
      MULTIPLY: [' * ', ArdOrder.MULTIPLICATIVE],
      DIVIDE: [' / ', ArdOrder.MULTIPLICATIVE],
      POWER: [null, ArdOrder.NONE],
    };
    const tuple = OPS[block.getFieldValue('OP')];
    const op = tuple[0];
    const order = tuple[1];
    const a = A.valueToCode(block, 'A', order) || '0';
    const b = A.valueToCode(block, 'B', order) || '0';
    if (!op) return [`pow(${a}, ${b})`, ArdOrder.ATOMIC];
    return [a + op + b, order];
  };
  A.forBlock['logic_compare'] = function (block) {
    const OPS = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    const op = OPS[block.getFieldValue('OP')];
    const a = A.valueToCode(block, 'A', ArdOrder.RELATIONAL) || '0';
    const b = A.valueToCode(block, 'B', ArdOrder.RELATIONAL) || '0';
    return [`${a} ${op} ${b}`, ArdOrder.RELATIONAL];
  };
  A.forBlock['controls_if'] = function (block) {
    let code = '';
    let n = 0;
    do {
      const cond =
        A.valueToCode(block, 'IF' + n, ArdOrder.NONE) || 'false';
      const branch = indent(A.statementToCode(block, 'DO' + n));
      code +=
        (n === 0 ? 'if' : 'else if') +
        ` (${cond}) {\n${branch}}\n`;
      n++;
    } while (block.getInput('IF' + n));
    if (block.getInput('ELSE')) {
      const branch = indent(A.statementToCode(block, 'ELSE'));
      code += `else {\n${branch}}\n`;
    }
    return code;
  };
  A.forBlock['controls_repeat_ext'] = function (block) {
    const repeats = A.valueToCode(block, 'TIMES', ArdOrder.ATOMIC) || '0';
    const branch = indent(A.statementToCode(block, 'DO'));
    return `for (int i = 0; i < ${repeats}; i++) {\n${branch}}\n`;
  };

  // ── Entradas / sensores Arduino ──
  A.forBlock['arduino_digital_read'] = function (block) {
    const pin = block.getFieldValue('PIN');
    A.setups_['pinmode_in_' + pin] = `pinMode(${pin}, INPUT);`;
    return [`digitalRead(${pin})`, ArdOrder.ATOMIC];
  };
  A.forBlock['arduino_analog_read'] = function (block) {
    return [`analogRead(${block.getFieldValue('PIN')})`, ArdOrder.ATOMIC];
  };
  A.forBlock['arduino_map'] = function (block) {
    const val = A.valueToCode(block, 'VAL', ArdOrder.ATOMIC) || '0';
    const fl = block.getFieldValue('FROMLOW');
    const fh = block.getFieldValue('FROMHIGH');
    const tl = block.getFieldValue('TOLOW');
    const th = block.getFieldValue('TOHIGH');
    return [`map(${val}, ${fl}, ${fh}, ${tl}, ${th})`, ArdOrder.ATOMIC];
  };
  A.forBlock['arduino_serial_available'] = function () {
    return ['(Serial.available() > 0)', ArdOrder.RELATIONAL];
  };
  A.forBlock['arduino_serial_read_int'] = function () {
    return ['Serial.parseInt()', ArdOrder.ATOMIC];
  };

  // ── Arduino avanzado: PWM / tono / servo / tiempo / operadores ──
  A.forBlock['arduino_analog_write'] = function (block) {
    const pin = block.getFieldValue('PIN');
    A.setups_['pinmode_' + pin] = `pinMode(${pin}, OUTPUT);`;
    return `analogWrite(${pin}, ${block.getFieldValue('VAL')});\n`;
  };
  A.forBlock['arduino_tone'] = function (block) {
    return `tone(${block.getFieldValue('PIN')}, ${block.getFieldValue('FREQ')});\n`;
  };
  A.forBlock['arduino_no_tone'] = function (block) {
    return `noTone(${block.getFieldValue('PIN')});\n`;
  };
  A.forBlock['arduino_servo'] = function (block) {
    const pin = block.getFieldValue('PIN');
    A.includes_['servo_h'] = '#include <Servo.h>';
    A.definitions_['servo_' + pin] = `Servo servo_${pin};`;
    A.setups_['servo_attach_' + pin] = `servo_${pin}.attach(${pin});`;
    return `servo_${pin}.write(${block.getFieldValue('ANGLE')});\n`;
  };
  A.forBlock['arduino_millis'] = function () {
    return ['millis()', ArdOrder.ATOMIC];
  };
  A.forBlock['arduino_constrain'] = function (block) {
    const val = A.valueToCode(block, 'VAL', ArdOrder.ATOMIC) || '0';
    return [
      `constrain(${val}, ${block.getFieldValue('LOW')}, ${block.getFieldValue('HIGH')})`,
      ArdOrder.ATOMIC,
    ];
  };
  A.forBlock['arduino_random'] = function (block) {
    const hi = Number(block.getFieldValue('HIGH')) + 1;
    return [`random(${block.getFieldValue('LOW')}, ${hi})`, ArdOrder.ATOMIC];
  };

  // Bloques de código en bruto (C++)
  A.forBlock['raw_cpp'] = function (block) {
    return block.getFieldValue('CODE') + '\n';
  };
  A.forBlock['raw_block_cpp'] = function (block) {
    const body = indent(A.statementToCode(block, 'DO'));
    return block.getFieldValue('HEAD') + '\n' + body + '}\n';
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   2. TOOLBOXES POR PLACA
   ────────────────────────────────────────────────────────────────────────── */
const STD_CATEGORIES = [
  {
    kind: 'category',
    name: 'Lógica',
    colour: '210',
    contents: [
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'logic_compare' },
      { kind: 'block', type: 'logic_boolean' },
    ],
  },
  {
    kind: 'category',
    name: 'Bucles',
    colour: '120',
    contents: [
      {
        kind: 'block',
        type: 'controls_repeat_ext',
        inputs: {
          TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
        },
      },
    ],
  },
  {
    kind: 'category',
    name: 'Matemáticas',
    colour: '230',
    contents: [
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'math_arithmetic' },
    ],
  },
  {
    kind: 'category',
    name: 'Texto',
    colour: '160',
    contents: [{ kind: 'block', type: 'text' }],
  },
];

const blk = (type, inputs) => (inputs ? { kind: 'block', type, inputs } : { kind: 'block', type });
const mapShadow = { VAL: { shadow: { type: 'math_number', fields: { NUM: 0 } } } };
const CODE_PY = {
  kind: 'category', name: 'Código', colour: '#64748b',
  contents: [blk('raw_py'), blk('raw_block_py')],
};
const CODE_CPP = {
  kind: 'category', name: 'Código', colour: '#64748b',
  contents: [blk('raw_cpp'), blk('raw_block_cpp')],
};

const TOOLBOXES = {
  microbit: {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category', name: 'Básico', colour: '230',
        contents: [
          blk('microbit_on_start'), blk('microbit_forever'),
          blk('microbit_show_string'), blk('microbit_show_value'),
          blk('microbit_show_leds'), blk('microbit_set_pixel'),
          blk('microbit_clear'), blk('microbit_pause'),
        ],
      },
      {
        kind: 'category', name: 'Entrada / Botones', colour: '20',
        contents: [
          blk('microbit_button_pressed'), blk('microbit_button_was_pressed'),
          blk('microbit_button_presses'), blk('microbit_pin_touched'),
          blk('microbit_gesture'),
        ],
      },
      {
        kind: 'category', name: 'Sensores', colour: '0',
        contents: [
          blk('microbit_temperature'), blk('microbit_light_level'),
          blk('microbit_sound_level'), blk('microbit_compass_heading'),
          blk('microbit_accelerometer'),
        ],
      },
      {
        kind: 'category', name: 'Pines', colour: '180',
        contents: [
          blk('microbit_pin_digital_write'), blk('microbit_pin_digital_read'),
          blk('microbit_pin_analog_write'), blk('microbit_pin_analog_read'),
        ],
      },
      {
        kind: 'category', name: 'Música / Voz', colour: '280',
        contents: [
          blk('microbit_music_play'), blk('microbit_music_pitch'),
          blk('microbit_speech_say'),
        ],
      },
      {
        kind: 'category', name: 'Radio', colour: '340',
        contents: [
          blk('microbit_radio_group'), blk('microbit_radio_send'),
          blk('microbit_radio_receive'),
        ],
      },
      {
        kind: 'category', name: 'Control', colour: '120',
        contents: [blk('microbit_running_time'), blk('microbit_pause')],
      },
      ...STD_CATEGORIES,
      CODE_PY,
    ],
  },
  cyberpi: {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category', name: 'Pantalla', colour: '200',
        contents: [
          blk('cyberpi_forever'), blk('cyberpi_show_label'),
          blk('cyberpi_show_value'), blk('cyberpi_console_print'),
          blk('cyberpi_display_clear'), blk('cyberpi_wait'),
        ],
      },
      {
        kind: 'category', name: 'Audio / LED', colour: '60',
        contents: [
          blk('cyberpi_led'), blk('cyberpi_led_rgb'), blk('cyberpi_led_off'),
          blk('cyberpi_play_sound'), blk('cyberpi_play_tone'), blk('cyberpi_set_volume'),
        ],
      },
      {
        kind: 'category', name: 'Botones / Joystick', colour: '20',
        contents: [blk('cyberpi_button_pressed'), blk('cyberpi_joystick')],
      },
      {
        kind: 'category', name: 'Sensores', colour: '0',
        contents: [
          blk('cyberpi_loudness'), blk('cyberpi_brightness'),
          blk('cyberpi_shake_val'), blk('cyberpi_attitude'),
          blk('cyberpi_accelerometer'),
        ],
      },
      {
        kind: 'category', name: 'mBot2 · Motores', colour: '160',
        contents: [blk('mbot2_drive'), blk('mbot2_drive_speed'), blk('mbot2_stop')],
      },
      {
        kind: 'category', name: 'mBot2 · Sensores', colour: '15',
        contents: [blk('mbot2_ultrasonic'), blk('mbot2_line_offset')],
      },
      ...STD_CATEGORIES,
      CODE_PY,
    ],
  },
  microbit_smarthome: {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category', name: 'Básico', colour: '230',
        contents: [
          blk('microbit_on_start'), blk('microbit_forever'),
          blk('microbit_show_string'), blk('microbit_show_value'),
          blk('microbit_show_leds'), blk('microbit_clear'), blk('microbit_pause'),
        ],
      },
      {
        kind: 'category', name: '🏠 Sensores', colour: '#0d9488',
        contents: [
          blk('smarthome_pir'), blk('smarthome_boton'),
          blk('smarthome_gas'), blk('smarthome_suelo'),
          blk('smarthome_luz'), blk('smarthome_vapor'),
          blk('microbit_temperature'),
          blk('smarthome_analog_read'), blk('smarthome_digital_read'),
        ],
      },
      {
        kind: 'category', name: '🏠 Actuadores', colour: '#f59e0b',
        contents: [
          blk('smarthome_led'), blk('smarthome_led_bright'), blk('smarthome_rgb'),
          blk('smarthome_fan'), blk('smarthome_servo'),
        ],
      },
      {
        kind: 'category', name: '🏠 Sonido', colour: '#a855f7',
        contents: [blk('smarthome_buzzer_tone'), blk('smarthome_buzzer_melody')],
      },
      {
        kind: 'category', name: '🏠 Pantalla LCD', colour: '#3b82f6',
        contents: [
          blk('smarthome_lcd_init'), blk('smarthome_lcd_show'), blk('smarthome_lcd_clear'),
        ],
      },
      {
        kind: 'category', name: 'Entrada / Botones', colour: '20',
        contents: [
          blk('microbit_button_pressed'), blk('microbit_pin_touched'),
          blk('microbit_gesture'),
        ],
      },
      {
        kind: 'category', name: 'Pines (avanzado)', colour: '180',
        contents: [
          blk('microbit_pin_digital_write'), blk('microbit_pin_digital_read'),
          blk('microbit_pin_analog_write'), blk('microbit_pin_analog_read'),
        ],
      },
      ...STD_CATEGORIES,
      CODE_PY,
    ],
  },
  arduino: {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category', name: 'Arduino', colour: '290',
        contents: [
          blk('arduino_setup_loop'), blk('arduino_digital_write'),
          blk('arduino_delay'), blk('arduino_serial_print'),
        ],
      },
      {
        kind: 'category', name: 'Entradas / Teclado', colour: '20',
        contents: [
          blk('arduino_digital_read'), blk('arduino_serial_available'),
          blk('arduino_serial_read_int'),
        ],
      },
      {
        kind: 'category', name: 'Sensores', colour: '0',
        contents: [blk('arduino_analog_read'), blk('arduino_map', mapShadow)],
      },
      {
        kind: 'category', name: 'Actuadores', colour: '290',
        contents: [
          blk('arduino_analog_write'), blk('arduino_tone'),
          blk('arduino_no_tone'), blk('arduino_servo'),
        ],
      },
      {
        kind: 'category', name: 'Operadores +', colour: '230',
        contents: [
          blk('arduino_millis'), blk('arduino_constrain', mapShadow),
          blk('arduino_random'),
        ],
      },
      ...STD_CATEGORIES,
      CODE_CPP,
    ],
  },
};

const BOARD_META = {
  microbit: { label: 'BBC Micro:bit V2', lang: 'MicroPython', repl: true },
  microbit_smarthome: { label: 'Micro:bit + Smart Home', lang: 'MicroPython', repl: true },
  cyberpi: { label: 'CyberPi / mBot2', lang: 'Python (cyberpi)', repl: true },
  arduino: { label: 'Arduino Uno / Nano', lang: 'C++ (Arduino)', repl: false },
};

// Contexto por placa para el prompt de IA (editar el código con Claude/Gemini).
const LANG_INFO = {
  microbit: {
    lang: 'MicroPython para la BBC micro:bit V2',
    notes: 'Usa la librería microbit (from microbit import *) y, si hacen falta, music, radio o speech.',
  },
  microbit_smarthome: {
    lang: 'MicroPython para micro:bit V2 conectada al kit Smart Home (Keyestudio)',
    notes: 'Usa from microbit import *; lee sensores con pinX.read_analog()/read_digital(), mueve actuadores con write_digital()/write_analog(), el zumbador con music y la LCD 1602 por i2c (SCL=P19, SDA=P20). Respeta los pines del montaje.',
  },
  cyberpi: {
    lang: 'Python con la librería cyberpi (y mbot2/mbuild para el robot mBot2)',
    notes: 'Usa cyberpi.* para pantalla, audio, LED y sensores; mbot2.* para los motores.',
  },
  arduino: {
    lang: 'C++ para Arduino (Uno/Nano)',
    notes: 'Estructura con setup() y loop(), Serial a 115200 e incluye las librerías necesarias (#include).',
  },
};

// Pistas de driver/firmware por placa para cuando no se detecta el puerto.
const CONNECT_HELP = {
  microbit: [
    'micro:bit V2: normalmente NO necesita driver (plug-and-play en Windows 10/11).',
    'Prueba con otro cable USB (que sea de datos, no solo de carga) y otro puerto.',
    'Para EJECUTAR debe tener firmware MicroPython flasheado (no MakeCode).',
  ],
  microbit_smarthome: [
    'Conecta el USB a la micro:bit montada sobre la placa Shield del kit Smart Home.',
    'No necesita driver en Windows 10/11; usa un cable USB de datos.',
    'Para EJECUTAR debe tener firmware MicroPython flasheado (no MakeCode).',
    'Cada bloque ya trae el pin del montaje; la LCD usa I²C (SCL=P19, SDA=P20).',
  ],
  cyberpi: [
    'CyberPi/mBot2: si no aparece el puerto, instala el driver USB CH340 (el que usa mBlock de Makeblock).',
    'Enciende la placa y usa un cable USB de datos.',
    'El envío al REPL requiere modo MicroPython; con el firmware estándar, copia/descarga el código y pégalo en mBlock.',
  ],
  arduino: [
    'Arduino Uno oficial: sin driver. Nano/clones: instala el driver CH340 (o FTDI según el chip).',
    'Comprueba que el puerto COM aparece en el Administrador de dispositivos de Windows.',
    'Recuerda: el programa se sube con el IDE de Arduino / arduino-cli; aquí el serie es solo para datos.',
  ],
};

// Construye el prompt para pegar en Claude/Gemini y modificar el código por IA.
function buildAIPrompt(board, code) {
  const info = LANG_INFO[board] || LANG_INFO.microbit;
  return `Eres un experto en robótica educativa. Tengo este programa en ${info.lang} y quiero modificarlo.

REGLAS:
- Devuelve SOLO el código final completo, listo para pegar, SIN explicaciones, sin texto adicional y sin formato markdown.
- Mantén el mismo lenguaje y placa (${info.lang}).
- ${info.notes}

CÓDIGO ACTUAL:
${code && code.trim() ? code.trim() : '(vacío)'}

CAMBIO QUE QUIERO:
[ESCRIBE AQUÍ QUÉ QUIERES MODIFICAR O AÑADIR]`;
}

/* ──────────────────────────────────────────────────────────────────────────
   BIBLIOTECA DE PROYECTOS PRECARGADOS (con explicación paso a paso)
   ────────────────────────────────────────────────────────────────────────── */

// Encadena una lista de nodos {type, fields, inputs} en una pila (campo `next`).
function chain(nodes) {
  if (!nodes.length) return undefined;
  const [first, ...rest] = nodes;
  const node = { ...first };
  const tail = chain(rest);
  if (tail) node.next = { block: tail };
  return node;
}
// Atajo para una comparación numérica (logic_compare con un número a la derecha).
const cmp = (left, op, num) => ({
  type: 'logic_compare',
  fields: { OP: op },
  inputs: {
    A: { block: left },
    B: { block: { type: 'math_number', fields: { NUM: num } } },
  },
});
// Atajo para un bloque "si … hacer …" sin "si no".
const ifDo = (cond, doNode) => ({
  type: 'controls_if',
  inputs: { IF0: { block: cond }, DO0: { block: doNode } },
});
const top = (block) => ({ blocks: { languageVersion: 0, blocks: [{ ...block, x: 40, y: 40 }] } });

const PROJECTS = [
  // ───────── MICRO:BIT ─────────
  {
    id: 'mb_heart',
    board: 'microbit',
    emoji: '❤️',
    title: 'Corazón latiendo',
    desc: 'La matriz LED dibuja un corazón que parpadea sin parar.',
    steps: [
      'El bloque «por siempre» repite todo lo de dentro para siempre.',
      'Mostramos el icono del corazón en la matriz de 5×5 LEDs.',
      'Esperamos 300 ms para que el corazón se vea encendido.',
      'Limpiamos la pantalla (todos los LEDs apagados).',
      'Esperamos otros 300 ms apagado: así se crea el efecto de latido.',
    ],
    state: top({
      type: 'microbit_forever',
      inputs: {
        DO: {
          block: chain([
            { type: 'microbit_show_leds', fields: { IMG: 'HEART' } },
            { type: 'microbit_pause', fields: { MS: 300 } },
            { type: 'microbit_clear' },
            { type: 'microbit_pause', fields: { MS: 300 } },
          ]),
        },
      },
    }),
  },
  {
    id: 'mb_thermo',
    board: 'microbit',
    emoji: '🌡️',
    title: 'Termómetro',
    desc: 'Muestra la temperatura del chip en grados, actualizándose cada 2 s.',
    steps: [
      'El bloque «por siempre» mantiene la medición activa.',
      'El sensor «temperatura» lee los grados centígrados de la placa.',
      'El bloque «mostrar valor» convierte ese número a texto y lo desplaza por los LEDs.',
      'Esperamos 2000 ms (2 s) antes de volver a medir.',
    ],
    state: top({
      type: 'microbit_forever',
      inputs: {
        DO: {
          block: chain([
            { type: 'microbit_show_value', inputs: { NUM: { block: { type: 'microbit_temperature' } } } },
            { type: 'microbit_pause', fields: { MS: 2000 } },
          ]),
        },
      },
    }),
  },
  {
    id: 'mb_buttons',
    board: 'microbit',
    emoji: '🎮',
    title: 'Botones A y B',
    desc: 'El botón A dibuja un corazón y el botón B borra la pantalla.',
    steps: [
      'Dentro de «por siempre» comprobamos los botones todo el rato.',
      'El primer «si» pregunta: ¿está pulsado el botón A? Si es así, muestra el corazón.',
      'El segundo «si» pregunta: ¿está pulsado el botón B? Si es así, limpia la pantalla.',
      'Como no hay pausas largas, la placa reacciona al instante a tus pulsaciones.',
    ],
    state: top({
      type: 'microbit_forever',
      inputs: {
        DO: {
          block: chain([
            ifDo(
              { type: 'microbit_button_pressed', fields: { BTN: 'a' } },
              { type: 'microbit_show_leds', fields: { IMG: 'HEART' } }
            ),
            ifDo(
              { type: 'microbit_button_pressed', fields: { BTN: 'b' } },
              { type: 'microbit_clear' }
            ),
          ]),
        },
      },
    }),
  },

  // ───────── CYBERPI / mBOT2 ─────────
  {
    id: 'cp_heart',
    board: 'cyberpi',
    emoji: '❤️',
    title: 'Corazón parpadeante (CyberPi)',
    desc: 'En el CyberPi: la pantalla muestra «<3» y el LED RGB parpadea en rojo.',
    steps: [
      'El CyberPi NO tiene matriz de LEDs como la micro:bit: tiene pantalla a color y LEDs RGB.',
      'El bloque «por siempre» repite el parpadeo sin parar.',
      'Mostramos «<3» en la pantalla y encendemos el LED en rojo (255,0,0).',
      'Esperamos 0,3 s con el corazón visible.',
      'Limpiamos la pantalla y apagamos el LED; esperamos otros 0,3 s → efecto de latido.',
    ],
    state: top({
      type: 'cyberpi_forever',
      inputs: {
        DO: {
          block: chain([
            { type: 'cyberpi_show_label', fields: { TEXT: '<3' } },
            { type: 'cyberpi_led_rgb', fields: { R: 255, G: 0, B: 0 } },
            { type: 'cyberpi_wait', fields: { SEC: 0.3 } },
            { type: 'cyberpi_display_clear' },
            { type: 'cyberpi_led_off' },
            { type: 'cyberpi_wait', fields: { SEC: 0.3 } },
          ]),
        },
      },
    }),
  },
  {
    id: 'cp_sound',
    board: 'cyberpi',
    emoji: '🔊',
    title: 'Sonómetro con luz',
    desc: 'Muestra el volumen del micrófono y enciende el LED rojo si hay mucho ruido.',
    steps: [
      'El bloque «por siempre» repite la medición continuamente.',
      'Leemos el «volumen del micrófono» y lo mostramos en la pantalla.',
      'Si el volumen es mayor que 50, encendemos el LED en rojo (255,0,0).',
      'Si el volumen es 50 o menos, apagamos los LEDs.',
      'Esperamos 0,1 s para no saturar la pantalla.',
    ],
    state: top({
      type: 'cyberpi_forever',
      inputs: {
        DO: {
          block: chain([
            { type: 'cyberpi_show_value', inputs: { NUM: { block: { type: 'cyberpi_loudness' } } } },
            ifDo(cmp({ type: 'cyberpi_loudness' }, 'GT', 50), {
              type: 'cyberpi_led_rgb',
              fields: { R: 255, G: 0, B: 0 },
            }),
            ifDo(cmp({ type: 'cyberpi_loudness' }, 'LTE', 50), { type: 'cyberpi_led_off' }),
            { type: 'cyberpi_wait', fields: { SEC: 0.1 } },
          ]),
        },
      },
    }),
  },
  {
    id: 'mbot_avoid',
    board: 'cyberpi',
    emoji: '🤖',
    title: 'mBot2: evita obstáculos',
    desc: 'El robot avanza y, si detecta algo cerca con el ultrasonidos, gira para esquivarlo.',
    steps: [
      'El bloque «por siempre» mantiene al robot conduciendo solo.',
      'Leemos la distancia con el sensor de ultrasonidos (en cm).',
      'Si hay un obstáculo a menos de 15 cm, giramos a la izquierda 0,5 s.',
      'Si el camino está libre (15 cm o más), avanzamos hacia delante 0,3 s.',
      'Al repetirse muy rápido, el robot va corrigiendo su rumbo constantemente.',
    ],
    state: top({
      type: 'cyberpi_forever',
      inputs: {
        DO: {
          block: chain([
            ifDo(cmp({ type: 'mbot2_ultrasonic' }, 'LT', 15), {
              type: 'mbot2_drive',
              fields: { DIR: 'turn_left', SPEED: 50, TIME: 0.5 },
            }),
            ifDo(cmp({ type: 'mbot2_ultrasonic' }, 'GTE', 15), {
              type: 'mbot2_drive',
              fields: { DIR: 'forward', SPEED: 50, TIME: 0.3 },
            }),
          ]),
        },
      },
    }),
  },

  {
    id: 'mbot_motors',
    board: 'cyberpi',
    emoji: '🚗',
    title: 'mBot2: prueba de motores',
    desc: 'El robot avanza, retrocede, gira a un lado y a otro, y para. Ideal para comprobar que los motores responden.',
    steps: [
      'Necesitas el CyberPi montado sobre el chasis del mBot2 (los motores son del mBot2).',
      'Avanza a 50 % de potencia durante 1 s.',
      'Retrocede a 50 % durante 1 s.',
      'Gira a la izquierda y luego a la derecha (0,5 s cada uno).',
      'Para los motores. ¡Coloca el robot en el suelo con espacio antes de ejecutar!',
    ],
    state: top(
      chain([
        { type: 'mbot2_drive', fields: { DIR: 'forward', SPEED: 50, TIME: 1 } },
        { type: 'mbot2_drive', fields: { DIR: 'backward', SPEED: 50, TIME: 1 } },
        { type: 'mbot2_drive', fields: { DIR: 'turn_left', SPEED: 50, TIME: 0.5 } },
        { type: 'mbot2_drive', fields: { DIR: 'turn_right', SPEED: 50, TIME: 0.5 } },
        { type: 'mbot2_stop' },
      ])
    ),
  },

  {
    id: 'mbot_diag',
    board: 'cyberpi',
    emoji: '🩺',
    title: 'mBot2: diagnóstico',
    desc: 'Muestra «Test motores» y enciende el LED verde; luego mueve los motores. Sirve para saber si el problema es el código o la alimentación.',
    steps: [
      'Si en la PANTALLA del CyberPi ves «Test motores» y el LED verde → el CyberPi y el código funcionan.',
      'Si además el robot se mueve → ¡todo OK!',
      'Si ves el texto/LED pero el robot NO se mueve → es la alimentación: enciende el interruptor del chasis mBot2 (los motores van con su batería, no con el USB).',
      'Si NO ves nada en la pantalla → no se está ejecutando (revisa conexión y que sea un CyberPi).',
    ],
    state: top(
      chain([
        { type: 'cyberpi_show_label', fields: { TEXT: 'Test motores' } },
        { type: 'cyberpi_led_rgb', fields: { R: 0, G: 255, B: 0 } },
        { type: 'mbot2_drive', fields: { DIR: 'forward', SPEED: 50, TIME: 1 } },
        { type: 'mbot2_drive', fields: { DIR: 'backward', SPEED: 50, TIME: 1 } },
        { type: 'mbot2_stop' },
        { type: 'cyberpi_led_off' },
        { type: 'cyberpi_show_label', fields: { TEXT: 'Fin' } },
      ])
    ),
  },

  // ───────── ARDUINO ─────────
  {
    id: 'ar_blink',
    board: 'arduino',
    emoji: '💡',
    title: 'Blink (LED parpadea)',
    desc: 'El "hola mundo" de Arduino: el LED del pin 13 se enciende y se apaga cada segundo.',
    steps: [
      'El bloque «setup/loop» crea la estructura base del programa.',
      'En «loop» (se repite siempre): ponemos el pin 13 en ALTO → el LED se enciende.',
      'Esperamos 1000 ms (1 s) con el LED encendido.',
      'Ponemos el pin 13 en BAJO → el LED se apaga.',
      'Esperamos otro segundo apagado. El pinMode(OUTPUT) se añade solo en setup().',
    ],
    state: top({
      type: 'arduino_setup_loop',
      inputs: {
        LOOP: {
          block: chain([
            { type: 'arduino_digital_write', fields: { PIN: 13, STATE: 'HIGH' } },
            { type: 'arduino_delay', fields: { MS: 1000 } },
            { type: 'arduino_digital_write', fields: { PIN: 13, STATE: 'LOW' } },
            { type: 'arduino_delay', fields: { MS: 1000 } },
          ]),
        },
      },
    }),
  },
  {
    id: 'ar_nightlight',
    board: 'arduino',
    emoji: '🌙',
    title: 'Luz nocturna (LDR)',
    desc: 'Con una fotorresistencia en A0: si hay poca luz, enciende el LED del pin 13.',
    steps: [
      'En «loop» leemos el sensor de luz conectado al pin analógico A0 (0 a 1023).',
      'Si el valor es menor que 400 (está oscuro), encendemos el LED del pin 13.',
      'Si el valor es 400 o más (hay luz), apagamos el LED.',
      'Ajusta el umbral 400 según la luz de tu aula y tu sensor.',
    ],
    state: top({
      type: 'arduino_setup_loop',
      inputs: {
        LOOP: {
          block: chain([
            ifDo(cmp({ type: 'arduino_analog_read', fields: { PIN: 'A0' } }, 'LT', 400), {
              type: 'arduino_digital_write',
              fields: { PIN: 13, STATE: 'HIGH' },
            }),
            ifDo(cmp({ type: 'arduino_analog_read', fields: { PIN: 'A0' } }, 'GTE', 400), {
              type: 'arduino_digital_write',
              fields: { PIN: 13, STATE: 'LOW' },
            }),
          ]),
        },
      },
    }),
  },
  {
    id: 'ar_servo',
    board: 'arduino',
    emoji: '🦾',
    title: 'Servo de barrido',
    desc: 'Un servomotor en el pin 9 se mueve de 0° a 180° una y otra vez.',
    steps: [
      'El editor añade solo «#include <Servo.h>» y el «attach» del servo en setup().',
      'En «loop» movemos el servo a 0° y esperamos 1 s.',
      'Después lo movemos a 180° y esperamos otro segundo.',
      'El servo barre de lado a lado de forma continua.',
    ],
    state: top({
      type: 'arduino_setup_loop',
      inputs: {
        LOOP: {
          block: chain([
            { type: 'arduino_servo', fields: { PIN: 9, ANGLE: 0 } },
            { type: 'arduino_delay', fields: { MS: 1000 } },
            { type: 'arduino_servo', fields: { PIN: 9, ANGLE: 180 } },
            { type: 'arduino_delay', fields: { MS: 1000 } },
          ]),
        },
      },
    }),
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   IMPORTAR: convertir código pegado a bloques (mejor esfuerzo).
   Reconoce los patrones que generan nuestros bloques; lo que no se reconoce
   se convierte en bloques de "código en bruto" (se conserva y se ejecuta igual).
   ────────────────────────────────────────────────────────────────────────── */

// Separa los argumentos de una llamada por las comas de primer nivel.
function splitArgs(s) {
  const out = [];
  let depth = 0,
    cur = '',
    q = '';
  for (const ch of s) {
    if (q) {
      cur += ch;
      if (ch === q) q = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const unquote = (s) => {
  const m = s && s.trim().match(/^(['"])(.*)\1$/);
  return m ? m[2] : null;
};
const isNum = (s) => /^-?\d+(\.\d+)?$/.test(s && s.trim());

// Valor (sensor/número/texto) → nodo de bloque, o null si no se reconoce.
function pyValue(expr) {
  const e = (expr || '').trim();
  if (isNum(e)) return { type: 'math_number', fields: { NUM: Number(e) } };
  const str = unquote(e);
  if (str !== null) return { type: 'text', fields: { TEXT: str } };
  const SENS = {
    'temperature()': { type: 'microbit_temperature' },
    'display.read_light_level()': { type: 'microbit_light_level' },
    'microphone.sound_level()': { type: 'microbit_sound_level' },
    'compass.heading()': { type: 'microbit_compass_heading' },
    'running_time()': { type: 'microbit_running_time' },
    'cyberpi.get_loudness()': { type: 'cyberpi_loudness' },
    'cyberpi.get_bri()': { type: 'cyberpi_brightness' },
    'cyberpi.get_shakeval()': { type: 'cyberpi_shake_val' },
    'ultrasonic2.get_distance(1)': { type: 'mbot2_ultrasonic' },
    'quad_rgb_sensor.get_offset_track(1)': { type: 'mbot2_line_offset' },
  };
  if (SENS[e]) return SENS[e];
  let m;
  if ((m = e.match(/^accelerometer\.get_([xyz])\(\)$/)))
    return { type: 'microbit_accelerometer', fields: { AXIS: m[1] } };
  if ((m = e.match(/^cyberpi\.get_acc\(['"]([xyz])['"]\)$/)))
    return { type: 'cyberpi_accelerometer', fields: { AXIS: m[1] } };
  if ((m = e.match(/^cyberpi\.get_(roll|pitch|yaw)\(\)$/)))
    return { type: 'cyberpi_attitude', fields: { ANGLE: m[1] } };
  if ((m = e.match(/^pin(\d+)\.read_analog\(\)$/)))
    return { type: 'microbit_pin_analog_read', fields: { PIN: m[1] } };
  if ((m = e.match(/^pin(\d+)\.read_digital\(\)$/)))
    return { type: 'microbit_pin_digital_read', fields: { PIN: m[1] } };
  if ((m = e.match(/^button_([ab])\.get_presses\(\)$/)))
    return { type: 'microbit_button_presses', fields: { BTN: m[1] } };
  if ((m = e.match(/^analogRead\((A\d)\)$/)))
    return { type: 'arduino_analog_read', fields: { PIN: m[1] } };
  if ((m = e.match(/^digitalRead\((\d+)\)$/)))
    return { type: 'arduino_digital_read', fields: { PIN: Number(m[1]) } };
  if (e === 'millis()') return { type: 'arduino_millis' };
  return null;
}

// Condición booleana → nodo de bloque, o null.
function pyCond(expr) {
  const e = (expr || '').trim().replace(/^\((.*)\)$/, '$1');
  let m;
  if ((m = e.match(/^button_([ab])\.is_pressed\(\)$/)))
    return { type: 'microbit_button_pressed', fields: { BTN: m[1] } };
  if (/button_a\.is_pressed\(\).*and.*button_b\.is_pressed\(\)/.test(e))
    return { type: 'microbit_button_pressed', fields: { BTN: 'ab' } };
  if ((m = e.match(/^button_([ab])\.was_pressed\(\)$/)))
    return { type: 'microbit_button_was_pressed', fields: { BTN: m[1] } };
  if ((m = e.match(/^pin(\d+)\.is_touched\(\)$/)))
    return { type: 'microbit_pin_touched', fields: { PIN: m[1] } };
  if ((m = e.match(/^accelerometer\.is_gesture\(['"](.+)['"]\)$/)))
    return { type: 'microbit_gesture', fields: { GESTURE: m[1] } };
  if ((m = e.match(/^cyberpi\.controller\.is_press\(['"](\w+)['"]\)$/))) {
    const v = m[1];
    if (v === 'a' || v === 'b') return { type: 'cyberpi_button_pressed', fields: { BTN: v } };
    return { type: 'cyberpi_joystick', fields: { DIR: v } };
  }
  const cmpM = e.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (cmpM) {
    const A = pyValue(cmpM[1]);
    const B = pyValue(cmpM[3]);
    if (A && B) {
      const OP = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' }[cmpM[2]];
      return { type: 'logic_compare', fields: { OP }, inputs: { A: { block: A }, B: { block: B } } };
    }
  }
  return null;
}

const valInput = (expr) => {
  const v = pyValue(expr);
  return v ? { NUM: { block: v } } : null;
};

// Sentencia simple Python → nodo de bloque (semántico si se reconoce, si no raw_py).
function pySimple(text) {
  const raw = { type: 'raw_py', fields: { CODE: text } };
  let m;
  if ((m = text.match(/^display\.scroll\(str\((.+)\)\)$/))) {
    const inp = valInput(m[1]);
    return inp ? { type: 'microbit_show_value', inputs: inp } : raw;
  }
  if ((m = text.match(/^display\.scroll\((.+)\)$/))) {
    const s = unquote(m[1]);
    return s !== null ? { type: 'microbit_show_string', fields: { TEXT: s } } : raw;
  }
  if ((m = text.match(/^display\.show\(Image\.(\w+)\)$/)))
    return { type: 'microbit_show_leds', fields: { IMG: m[1] } };
  if ((m = text.match(/^display\.set_pixel\((\d+),\s*(\d+),\s*(\d+)\)$/)))
    return { type: 'microbit_set_pixel', fields: { X: +m[1], Y: +m[2], B: +m[3] } };
  if (text === 'display.clear()') return { type: 'microbit_clear' };
  if ((m = text.match(/^sleep\((\d+(?:\.\d+)?)\)$/)))
    return { type: 'microbit_pause', fields: { MS: Number(m[1]) } };
  if ((m = text.match(/^time\.sleep\((\d+(?:\.\d+)?)\)$/)))
    return { type: 'cyberpi_wait', fields: { SEC: Number(m[1]) } };
  if ((m = text.match(/^music\.play\(music\.(\w+)\)$/)))
    return { type: 'microbit_music_play', fields: { MELODY: m[1] } };
  if ((m = text.match(/^music\.pitch\((\d+),\s*(\d+)\)$/)))
    return { type: 'microbit_music_pitch', fields: { FREQ: +m[1], MS: +m[2] } };
  if ((m = text.match(/^speech\.say\(['"](.*)['"]\)$/)))
    return { type: 'microbit_speech_say', fields: { TEXT: m[1] } };
  if ((m = text.match(/^radio\.config\(group=(\d+)\)$/)))
    return { type: 'microbit_radio_group', fields: { GROUP: +m[1] } };
  if ((m = text.match(/^radio\.send\(['"](.*)['"]\)$/)))
    return { type: 'microbit_radio_send', fields: { MSG: m[1] } };
  if ((m = text.match(/^pin(\d+)\.write_digital\((\d)\)$/)))
    return { type: 'microbit_pin_digital_write', fields: { PIN: m[1], VAL: m[2] } };
  if ((m = text.match(/^pin(\d+)\.write_analog\((\d+)\)$/)))
    return { type: 'microbit_pin_analog_write', fields: { PIN: m[1], VAL: +m[2] } };
  if ((m = text.match(/^cyberpi\.display\.show_label\(str\((.+?)\),/))) {
    const inp = valInput(m[1]);
    return inp ? { type: 'cyberpi_show_value', inputs: inp } : raw;
  }
  if ((m = text.match(/^cyberpi\.display\.show_label\(['"](.*?)['"],/)))
    return { type: 'cyberpi_show_label', fields: { TEXT: m[1] } };
  if ((m = text.match(/^cyberpi\.console\.println\(['"](.*)['"]\)$/)))
    return { type: 'cyberpi_console_print', fields: { TEXT: m[1] } };
  if (text === 'cyberpi.display.clear()') return { type: 'cyberpi_display_clear' };
  if (text === 'cyberpi.led.off()') return { type: 'cyberpi_led_off' };
  if ((m = text.match(/^cyberpi\.led\.on\((\d+),\s*(\d+),\s*(\d+)\)$/)))
    return { type: 'cyberpi_led_rgb', fields: { R: +m[1], G: +m[2], B: +m[3] } };
  if ((m = text.match(/^cyberpi\.led\.on\(['"](\w+)['"]\)$/)))
    return { type: 'cyberpi_led', fields: { COLOR: m[1] } };
  if ((m = text.match(/^cyberpi\.audio\.play\(['"](\w+)['"]\)$/)))
    return { type: 'cyberpi_play_sound', fields: { SOUND: m[1] } };
  if ((m = text.match(/^cyberpi\.audio\.play_tone\((\d+),\s*(\d+(?:\.\d+)?)\)$/)))
    return { type: 'cyberpi_play_tone', fields: { FREQ: +m[1], SEC: Number(m[2]) } };
  if ((m = text.match(/^cyberpi\.audio\.set_vol\((\d+)\)$/)))
    return { type: 'cyberpi_set_volume', fields: { VOL: +m[1] } };
  if ((m = text.match(/^mbot2\.(forward|backward|turn_left|turn_right)\((-?\d+),\s*(\d+(?:\.\d+)?)\)$/)))
    return { type: 'mbot2_drive', fields: { DIR: m[1], SPEED: +m[2], TIME: Number(m[3]) } };
  if ((m = text.match(/^mbot2\.drive_speed\((-?\d+),\s*(-?\d+)\)$/))) {
    if (+m[1] === 0 && +m[2] === 0) return { type: 'mbot2_stop' };
    return { type: 'mbot2_drive_speed', fields: { L: +m[1], R: +m[2] } };
  }
  return raw;
}

// Sentencia simple C++ → nodo (semántico o raw_cpp). text incluye el ';'.
function cppSimple(text) {
  const t = text.replace(/;$/, '').trim();
  const raw = { type: 'raw_cpp', fields: { CODE: text } };
  let m;
  if ((m = t.match(/^digitalWrite\((\d+),\s*(HIGH|LOW)\)$/)))
    return { type: 'arduino_digital_write', fields: { PIN: +m[1], STATE: m[2] } };
  if ((m = t.match(/^analogWrite\((\d+),\s*(\d+)\)$/)))
    return { type: 'arduino_analog_write', fields: { PIN: +m[1], VAL: +m[2] } };
  if ((m = t.match(/^delay\((\d+)\)$/)))
    return { type: 'arduino_delay', fields: { MS: +m[1] } };
  if ((m = t.match(/^Serial\.println\(["'](.*)["']\)$/)))
    return { type: 'arduino_serial_print', fields: { TEXT: m[1] } };
  if ((m = t.match(/^tone\((\d+),\s*(\d+)\)$/)))
    return { type: 'arduino_tone', fields: { PIN: +m[1], FREQ: +m[2] } };
  if ((m = t.match(/^noTone\((\d+)\)$/)))
    return { type: 'arduino_no_tone', fields: { PIN: +m[1] } };
  return raw;
}

// Convierte código Python en una pila de nodos (con indentación).
function pythonToNodes(board, code) {
  const lines = code
    .split('\n')
    .map((raw) => ({ indent: raw.length - raw.replace(/^\s+/, '').length, text: raw.trim() }))
    .filter((l) => l.text && !/^(from\s|import\s)/.test(l.text) && l.text !== 'radio.on()');
  let pos = 0;
  const forever = board === 'cyberpi' ? 'cyberpi_forever' : 'microbit_forever';
  function parse(level) {
    const nodes = [];
    while (pos < lines.length && lines[pos].indent >= level) {
      const cur = lines[pos];
      if (cur.indent > level) {
        nodes.push({ type: 'raw_py', fields: { CODE: cur.text } });
        pos++;
        continue;
      }
      const text = cur.text;
      if (text.endsWith(':')) {
        pos++;
        const childLevel = pos < lines.length && lines[pos].indent > level ? lines[pos].indent : level + 1;
        const children = parse(childLevel);
        const body = children.length ? { DO: { block: chain(children) } } : undefined;
        if (text === 'while True:') nodes.push({ type: forever, inputs: body });
        else {
          const ifm = text.match(/^if (.+):$/);
          const cond = ifm ? pyCond(ifm[1]) : null;
          if (cond)
            nodes.push({
              type: 'controls_if',
              inputs: { IF0: { block: cond }, ...(children.length ? { DO0: { block: chain(children) } } : {}) },
            });
          else nodes.push({ type: 'raw_block_py', fields: { HEAD: text }, inputs: body });
        }
      } else {
        nodes.push(pySimple(text));
        pos++;
      }
    }
    return nodes;
  }
  return parse(0);
}

// Convierte código C++ en nodos (basado en llaves).
function cppToNodes(code) {
  const toks = code
    .replace(/\{/g, '\n{\n')
    .replace(/\}/g, '\n}\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#include') && !/^Serial\.begin/.test(l));
  let pos = 0;
  function parse() {
    const nodes = [];
    while (pos < toks.length) {
      const t = toks[pos];
      if (t === '}') {
        pos++;
        break;
      }
      // ¿abre bloque? la siguiente línea es '{'
      if (toks[pos + 1] === '{' && !t.endsWith(';')) {
        const head = t;
        pos += 2; // salta cabecera y '{'
        const children = parse(); // consume hasta '}'
        const body = children.length ? { DO: { block: chain(children) } } : undefined;
        if (/^void\s+setup\s*\(/.test(head)) nodes.push({ __setup: chain(children) });
        else if (/^void\s+loop\s*\(/.test(head)) nodes.push({ __loop: chain(children) });
        else nodes.push({ type: 'raw_block_cpp', fields: { HEAD: head + ' {' }, inputs: body });
      } else if (t === '{') {
        pos++;
      } else {
        nodes.push(cppSimple(t));
        pos++;
      }
    }
    return nodes;
  }
  const top = parse();
  // Fusiona setup()/loop() en un único bloque arduino_setup_loop.
  const setupNode = top.find((n) => n.__setup);
  const loopNode = top.find((n) => n.__loop);
  if (setupNode || loopNode) {
    const inputs = {};
    if (setupNode?.__setup) inputs.SETUP = { block: setupNode.__setup };
    if (loopNode?.__loop) inputs.LOOP = { block: loopNode.__loop };
    const others = top.filter((n) => !n.__setup && !n.__loop);
    return [...others, { type: 'arduino_setup_loop', inputs }];
  }
  return top;
}

// Bloques "contenedor" sin conexión previa/siguiente: van como bloques sueltos.
const CONTAINER_TYPES = new Set([
  'microbit_forever',
  'cyberpi_forever',
  'microbit_on_start',
  'arduino_setup_loop',
]);

// API: código → estado de workspace serializado (o null si vacío).
function codeToState(board, code) {
  if (!code || !code.trim()) return null;
  const nodes = board === 'arduino' ? cppToNodes(code) : pythonToNodes(board, code);
  if (!nodes.length) return null;
  // Agrupa sentencias consecutivas en pilas; los contenedores van sueltos.
  const tops = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      tops.push(chain(buffer));
      buffer = [];
    }
  };
  for (const n of nodes) {
    if (n && CONTAINER_TYPES.has(n.type)) {
      flush();
      tops.push(n);
    } else buffer.push(n);
  }
  flush();
  let y = 20;
  const blocks = tops.map((t) => {
    const b = { ...t, x: 40, y };
    y += 240;
    return b;
  });
  return { blocks: { languageVersion: 0, blocks } };
}

/* ──────────────────────────────────────────────────────────────────────────
   3. COMPONENTE REACT
   ────────────────────────────────────────────────────────────────────────── */
export default function BlocklyEditor({ onExit, usuario = null, onLoginRequest, sharedProject = null, initialBoard = 'microbit' }) {
  const blocklyDiv = useRef(null); // contenedor del workspace
  const workspaceRef = useRef(null); // instancia del workspace
  const portRef = useRef(null); // puerto Web Serial
  const writerRef = useRef(null); // writer del puerto
  const readerRef = useRef(null); // reader del puerto
  const readerKeepAlive = useRef(false);
  const gotDataRef = useRef(false); // ¿hemos recibido algo de la placa?
  const busyRef = useRef(false); // evita operaciones serie solapadas (cuelgan la placa)
  const serialAccumRef = useRef(''); // últimas respuestas serie (para verificaciones)
  const cyberpiNeedsResetRef = useRef(false); // ¿reiniciar antes del próximo run en CyberPi?
  const pendingProjectRef = useRef(null); // proyecto a cargar tras cambiar de placa
  const panelWidthRef = useRef(340); // ancho actual del panel (para el arrastre)
  const selectedBoardRef = useRef('microbit'); // placa seleccionada (para el read loop)
  const detectedBoardRef = useRef(null); // placa detectada por el banner del REPL

  const [selectedBoard, setSelectedBoard] = useState(initialBoard);
  const [isConnected, setIsConnected] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [logs, setLogs] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false); // modal de proyectos
  const [activeProject, setActiveProject] = useState(null); // proyecto cargado
  const [rightTab, setRightTab] = useState('code'); // 'code' | 'steps'
  const [projectName, setProjectName] = useState(''); // nombre del proyecto actual
  const [myProjects, setMyProjects] = useState([]); // proyectos guardados del usuario
  const [sharedProjects, setSharedProjects] = useState([]); // proyectos compartidos conmigo
  const [saving, setSaving] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [loadedDocId, setLoadedDocId] = useState(null); // id Firestore del proyecto abierto
  const [accessRole, setAccessRole] = useState('new'); // 'new' | 'owner' | 'editor' | 'viewer'
  const [loadedMod, setLoadedMod] = useState(0); // fechaMod (s) al abrir, para detectar conflictos
  const [showShare, setShowShare] = useState(false);
  const [shareLinks, setShareLinks] = useState(null); // { editor, viewer }
  // Tamaño/visibilidad de los paneles (para agrandar el área de bloques)
  const [panelWidth, setPanelWidth] = useState(340);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  // Edición manual del código (pegar código de la IA) y copiar prompt
  const [codeEditMode, setCodeEditMode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  // Código efectivo: el editado a mano si está en modo edición, si no el de los bloques.
  const effectiveCode = codeEditMode ? editedCode : generatedCode;

  const log = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-200), { time, msg, type }]);
  }, []);

  /* ── Generación de código en tiempo real ── */
  const updateCode = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    let code = '';
    try {
      if (selectedBoard === 'arduino') {
        code = arduinoGenerator.workspaceToCode(ws);
      } else {
        code = pythonGenerator.workspaceToCode(ws);
      }
    } catch (e) {
      code = '// Error al generar código: ' + e.message;
    }
    setGeneratedCode(code);
  }, [selectedBoard]);

  /* ── useEffect principal: inicializa / reconstruye el workspace ──
     Se vuelve a ejecutar al cambiar de placa para cargar el toolbox correcto. */
  useEffect(() => {
    defineBlocksAndGenerators();
    if (!blocklyDiv.current) return;

    const ws = Blockly.inject(blocklyDiv.current, {
      toolbox: TOOLBOXES[selectedBoard],
      grid: { spacing: 22, length: 3, colour: '#e5e7eb', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.95 },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      renderer: 'zelos',
    });
    workspaceRef.current = ws;

    // Listener para regenerar el código en cada cambio relevante.
    const onChange = (e) => {
      if (e.isUiEvent || ws.isDragging()) return;
      updateCode();
    };
    ws.addChangeListener(onChange);
    updateCode();

    // Si veníamos de cambiar de placa para abrir un proyecto, cárgalo ahora.
    if (pendingProjectRef.current) {
      const proj = pendingProjectRef.current;
      pendingProjectRef.current = null;
      try {
        Blockly.serialization.workspaces.load(proj.state, ws);
        updateCode();
      } catch (err) {
        console.error('No se pudo cargar el proyecto:', err);
      }
    }

    // Limpieza: destruye el workspace para evitar fugas de memoria.
    return () => {
      ws.removeChangeListener(onChange);
      ws.dispose();
      workspaceRef.current = null;
    };
  }, [selectedBoard, updateCode]);

  // Reajusta el lienzo de Blockly cuando cambia el tamaño/visibilidad de los paneles.
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const id = requestAnimationFrame(() => Blockly.svgResize(ws));
    return () => cancelAnimationFrame(id);
  }, [panelWidth, panelCollapsed, terminalCollapsed]);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    selectedBoardRef.current = selectedBoard;
  }, [selectedBoard]);

  // Arrastre del divisor para ensanchar/estrechar el panel lateral.
  const startResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    const onMove = (ev) => {
      const w = Math.max(240, Math.min(680, startW + (startX - ev.clientX)));
      setPanelWidth(w);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  /* ── BIBLIOTECA: abrir un proyecto precargado ── */
  const openProject = useCallback(
    (proj) => {
      setActiveProject(proj);
      setShowLibrary(false);
      setRightTab('steps');
      setLoadedDocId(proj.__docId || null);
      setAccessRole(proj.__role || 'new');
      setLoadedMod(proj.__mod || 0);
      if (proj.board !== selectedBoard) {
        // Cambiamos de placa; el useEffect re-inyecta y carga el proyecto pendiente.
        pendingProjectRef.current = proj;
        setSelectedBoard(proj.board);
        return;
      }
      const ws = workspaceRef.current;
      if (!ws) return;
      try {
        ws.clear();
        Blockly.serialization.workspaces.load(proj.state, ws);
        updateCode();
      } catch (err) {
        console.error('No se pudo cargar el proyecto:', err);
      }
    },
    [selectedBoard, updateCode]
  );

  /* ── FIREBASE: guardar / cargar proyectos del usuario ── */
  // Carga la lista de proyectos guardados del usuario (orden por fecha en cliente).
  const loadMyProjects = useCallback(async () => {
    if (!usuario?.uid) {
      setMyProjects([]);
      return;
    }
    try {
      const q = query(collection(db, 'blockly_projects'), where('uid', '==', usuario.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
      setMyProjects(list);
    } catch (err) {
      console.error('No se pudieron cargar tus proyectos:', err);
    }
  }, [usuario]);

  // Carga los proyectos que otros han compartido conmigo (como editor o visor).
  const loadSharedWithMe = useCallback(async () => {
    if (!usuario?.uid) {
      setSharedProjects([]);
      return;
    }
    try {
      const [edSnap, vwSnap] = await Promise.all([
        getDocs(query(collection(db, 'blockly_projects'), where('editors', 'array-contains', usuario.uid))),
        getDocs(query(collection(db, 'blockly_projects'), where('viewers', 'array-contains', usuario.uid))),
      ]);
      const map = new Map();
      edSnap.docs.forEach((d) => {
        if (d.data().uid !== usuario.uid) map.set(d.id, { id: d.id, ...d.data(), __role: 'editor' });
      });
      vwSnap.docs.forEach((d) => {
        if (d.data().uid !== usuario.uid && !map.has(d.id))
          map.set(d.id, { id: d.id, ...d.data(), __role: 'viewer' });
      });
      const list = [...map.values()].sort(
        (a, b) =>
          (b.fechaMod?.seconds || b.fecha?.seconds || 0) -
          (a.fechaMod?.seconds || a.fecha?.seconds || 0)
      );
      setSharedProjects(list);
    } catch (err) {
      console.error('No se pudieron cargar los proyectos compartidos:', err);
    }
  }, [usuario]);

  useEffect(() => {
    loadMyProjects();
    loadSharedWithMe();
  }, [loadMyProjects, loadSharedWithMe]);

  // Crea un nuevo doc propio en Firestore y devuelve su id.
  const persistToFirestore = useCallback(
    async (payload) => {
      if (!usuario?.uid) return null;
      try {
        setSaving(true);
        const ref = await addDoc(collection(db, 'blockly_projects'), {
          uid: usuario.uid,
          email: usuario.email || null,
          autor: usuario.displayName || 'Anónimo',
          nombre: payload.nombre,
          board: payload.board,
          code: payload.code,
          state: JSON.stringify(payload.state),
          fecha: serverTimestamp(),
        });
        log(`💾 Proyecto «${payload.nombre}» guardado en tu cuenta.`, 'success');
        loadMyProjects();
        return ref.id;
      } catch (err) {
        log('Error al guardar: ' + err.message, 'error');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [usuario, log, loadMyProjects]
  );

  // Botón Guardar: según el rol guarda en el original (propietario/editor),
  // crea una copia (visor) o crea un proyecto nuevo. Si no hay usuario, ofrece registrarse.
  const saveProject = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const stateObj = Blockly.serialization.workspaces.save(ws);
    const hasBlocks = stateObj.blocks && (stateObj.blocks.blocks || []).length > 0;
    if (!hasBlocks) {
      log('No hay bloques que guardar todavía.', 'error');
      return;
    }
    const isCopy = accessRole === 'viewer';
    const sugerido = isCopy ? `${projectName || 'Proyecto'} (copia)` : projectName || 'Mi proyecto';
    const nombre = (
      (isCopy ? '' : projectName) ||
      window.prompt(isCopy ? 'Nombre para tu copia:' : 'Nombre del proyecto:', sugerido) ||
      ''
    ).trim();
    if (!nombre) return;
    setProjectName(nombre);
    const payload = { nombre, board: selectedBoard, code: effectiveCode.trim(), state: stateObj };

    if (!usuario?.uid) {
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error(err);
      }
      setShowRegisterPrompt(true);
      return;
    }

    // Propietario o editor sobre un proyecto ya guardado → sobrescribe el original.
    if (!isCopy && loadedDocId && (accessRole === 'owner' || accessRole === 'editor')) {
      try {
        setSaving(true);
        const ref = doc(db, 'blockly_projects', loadedDocId);
        // Control de versión: ¿alguien editó desde que lo abrí?
        const fresh = await getDoc(ref);
        const freshMod = fresh.data()?.fechaMod?.seconds || fresh.data()?.fecha?.seconds || 0;
        if (freshMod && loadedMod && freshMod > loadedMod) {
          const quien = fresh.data()?.ultimoEditor || 'Otra persona';
          const ok = window.confirm(
            `⚠️ ${quien} ha guardado cambios en este proyecto desde que lo abriste.\n\n` +
              'Si continúas, SOBRESCRIBIRÁS sus cambios.\n\n' +
              '¿Quieres continuar de todos modos? (Cancela para revisar antes con 📚 Proyectos)'
          );
          if (!ok) {
            setSaving(false);
            log('Guardado cancelado para no sobrescribir cambios ajenos.', 'info');
            return;
          }
        }
        await updateDoc(ref, {
          nombre: payload.nombre,
          board: payload.board,
          code: payload.code,
          state: JSON.stringify(payload.state),
          fechaMod: serverTimestamp(),
          ultimoEditor: usuario.displayName || usuario.email || usuario.uid,
        });
        // Refresca la marca de versión a la del documento recién guardado.
        try {
          const after = await getDoc(ref);
          setLoadedMod(after.data()?.fechaMod?.seconds || Math.floor(Date.now() / 1000));
        } catch {
          setLoadedMod(Math.floor(Date.now() / 1000));
        }
        log(`💾 Cambios guardados en «${payload.nombre}».`, 'success');
        loadMyProjects();
      } catch (err) {
        log('Error al guardar: ' + err.message, 'error');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Proyecto nuevo, o copia de un visor → crea un doc propio.
    const newId = await persistToFirestore(payload);
    if (newId) {
      setLoadedDocId(newId);
      setAccessRole('owner');
      if (isCopy) log('Has creado tu propia copia editable.', 'info');
    }
  }, [accessRole, loadedDocId, loadedMod, projectName, selectedBoard, effectiveCode, usuario, persistToFirestore, loadMyProjects, log]);

  // Prepara los enlaces de compartir (genera tokens si no existen). Solo el propietario.
  const openShare = useCallback(async () => {
    if (!usuario?.uid) {
      setShowRegisterPrompt(true);
      return;
    }
    if (accessRole !== 'owner' || !loadedDocId) {
      log('Guarda el proyecto antes de compartirlo.', 'error');
      return;
    }
    try {
      const ref = doc(db, 'blockly_projects', loadedDocId);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      let { editorToken, viewerToken } = data;
      if (!editorToken || !viewerToken) {
        editorToken = editorToken || randToken();
        viewerToken = viewerToken || randToken();
        await updateDoc(ref, { editorToken, viewerToken });
      }
      const base = `${window.location.origin}${window.location.pathname}?juego=robotica_bloques&proj=${loadedDocId}`;
      setShareLinks({
        editor: `${base}&role=editor&key=${editorToken}`,
        viewer: `${base}&role=viewer&key=${viewerToken}`,
      });
      setShowShare(true);
    } catch (err) {
      log('No se pudo preparar el enlace: ' + err.message, 'error');
    }
  }, [usuario, accessRole, loadedDocId, log]);

  // Descarga el código generado como archivo (.py para Micro:bit/CyberPi, .ino para Arduino).
  const downloadCode = useCallback(() => {
    const code = effectiveCode.trim();
    if (!code) {
      log('No hay código que descargar todavía.', 'error');
      return;
    }
    const ext = selectedBoard === 'arduino' ? 'ino' : 'py';
    const base =
      (projectName || 'proyecto').trim().replace(/[^\w\-]+/g, '_') || 'proyecto';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log(`⬇️ Descargado ${base}.${ext}`, 'success');
  }, [effectiveCode, selectedBoard, projectName, log]);

  // Abre un proyecto guardado del usuario (reutiliza la lógica de la biblioteca).
  const openSavedProject = useCallback(
    (p) => {
      let stateObj;
      try {
        stateObj = JSON.parse(p.state);
      } catch {
        log('Este proyecto guardado está dañado.', 'error');
        return;
      }
      setProjectName(p.nombre || '');
      openProject({
        board: p.board,
        state: stateObj,
        __docId: p.id,
        __role: 'owner',
        __mod: p.fechaMod?.seconds || p.fecha?.seconds || 0,
        emoji: '💾',
        title: p.nombre || 'Proyecto guardado',
        desc: `Proyecto guardado en tu cuenta · ${BOARD_META[p.board]?.label || ''}`,
        steps: ['Proyecto cargado desde tu cuenta. Edítalo y vuelve a pulsar 💾 Guardar para actualizar la copia.'],
      });
    },
    [openProject, log]
  );

  const deleteSavedProject = useCallback(
    async (p) => {
      if (!window.confirm(`¿Borrar el proyecto «${p.nombre}»?`)) return;
      try {
        await deleteDoc(doc(db, 'blockly_projects', p.id));
        loadMyProjects();
      } catch (err) {
        log('No se pudo borrar: ' + err.message, 'error');
      }
    },
    [loadMyProjects, log]
  );

  // Abre un proyecto de "Compartidos conmigo" con el rol ya conocido.
  const openSharedWithMe = useCallback(
    (p) => {
      let stateObj;
      try {
        stateObj = JSON.parse(p.state);
      } catch {
        log('Este proyecto compartido está dañado.', 'error');
        return;
      }
      setProjectName(p.nombre || '');
      openProject({
        board: p.board,
        state: stateObj,
        __docId: p.id,
        __role: p.__role,
        __mod: p.fechaMod?.seconds || p.fecha?.seconds || 0,
        emoji: p.__role === 'viewer' ? '👁️' : '✏️',
        title: p.nombre || 'Proyecto compartido',
        desc: `Compartido por ${p.autor || 'otro usuario'} · ${
          p.__role === 'editor' ? 'puedes editar el original' : 'solo lectura'
        }`,
        steps:
          p.__role === 'viewer'
            ? [
                'Proyecto compartido contigo en SOLO LECTURA.',
                'Puedes ejecutarlo, copiar o descargar el código.',
                'Pulsa «💾 Guardar copia» para tener tu propia versión editable.',
              ]
            : [
                'Editas un proyecto COMPARTIDO contigo.',
                'Al pulsar «💾 Guardar» actualizas el proyecto original del creador.',
              ],
      });
    },
    [openProject, log]
  );

  // Quita un proyecto de "Compartidos conmigo" (saca mi UID del array).
  const removeSharedWithMe = useCallback(
    async (p) => {
      if (!usuario?.uid) return;
      if (!window.confirm(`¿Quitar «${p.nombre}» de tus compartidos? (no borra el original del creador)`))
        return;
      try {
        await updateDoc(
          doc(db, 'blockly_projects', p.id),
          p.__role === 'editor'
            ? { editors: arrayRemove(usuario.uid) }
            : { viewers: arrayRemove(usuario.uid) }
        );
        loadSharedWithMe();
      } catch (err) {
        log('No se pudo quitar: ' + err.message, 'error');
      }
    },
    [usuario, loadSharedWithMe, log]
  );

  // Tras registrarse: si había un proyecto pendiente, lo restaura y lo guarda.
  useEffect(() => {
    if (!usuario?.uid) return;
    let pend;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      pend = JSON.parse(raw);
    } catch {
      return;
    }
    localStorage.removeItem(PENDING_KEY);
    setProjectName(pend.nombre || '');
    setActiveProject({
      board: pend.board,
      state: pend.state,
      emoji: '💾',
      title: pend.nombre || 'Proyecto recuperado',
      desc: 'Proyecto recuperado tras registrarte y guardado en tu cuenta.',
      steps: ['Tu código se ha conservado y guardado en tu cuenta.'],
    });
    // Restaura los bloques visualmente.
    if (pend.board !== selectedBoard) {
      pendingProjectRef.current = { state: pend.state };
      setSelectedBoard(pend.board);
    } else {
      const ws = workspaceRef.current;
      if (ws) {
        try {
          ws.clear();
          Blockly.serialization.workspaces.load(pend.state, ws);
          updateCode();
        } catch (err) {
          console.error(err);
        }
      }
    }
    // Y lo guarda definitivamente en Firebase.
    persistToFirestore(pend).then((id) => {
      if (id) {
        setLoadedDocId(id);
        setAccessRole('owner');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.uid]);

  // Carga un proyecto abierto desde un enlace compartido (?proj=..&role=..&key=..).
  useEffect(() => {
    if (!sharedProject?.id) return;
    if (!usuario?.uid) {
      log('Inicia sesión para abrir el proyecto compartido.', 'info');
      if (onLoginRequest) onLoginRequest();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'blockly_projects', sharedProject.id));
        if (cancelled) return;
        if (!snap.exists()) {
          log('El proyecto compartido ya no existe.', 'error');
          return;
        }
        const data = snap.data();
        let role = 'viewer';
        if (data.uid === usuario.uid) role = 'owner';
        else if (sharedProject.key && sharedProject.key === data.editorToken) role = 'editor';
        else if (sharedProject.key && sharedProject.key === data.viewerToken) role = 'viewer';
        else {
          log('Enlace no válido: se abre en modo solo lectura.', 'info');
          role = 'viewer';
        }
        const granted =
          role !== 'owner' &&
          sharedProject.key &&
          (sharedProject.key === data.editorToken || sharedProject.key === data.viewerToken);
        let stateObj;
        try {
          stateObj = JSON.parse(data.state);
        } catch {
          log('El proyecto compartido está dañado.', 'error');
          return;
        }
        setProjectName(data.nombre || '');
        openProject({
          board: data.board,
          state: stateObj,
          __docId: snap.id,
          __role: role,
          __mod: data.fechaMod?.seconds || data.fecha?.seconds || 0,
          emoji: role === 'viewer' ? '👁️' : '✏️',
          title: data.nombre || 'Proyecto compartido',
          desc:
            role === 'owner'
              ? 'Es tu proyecto.'
              : `Compartido por ${data.autor || 'otro usuario'} · ${
                  role === 'editor' ? 'puedes editar el original' : 'solo lectura'
                }`,
          steps:
            role === 'viewer'
              ? [
                  'Estás viendo un proyecto compartido en modo SOLO LECTURA.',
                  'Puedes ejecutarlo, copiar o descargar el código.',
                  'Para modificarlo, pulsa «💾 Guardar copia»: tendrás tu propia versión sin tocar la del creador.',
                ]
              : [
                  'Estás editando un proyecto COMPARTIDO como editor.',
                  'Al pulsar «💾 Guardar» tus cambios se guardan en el proyecto original del creador.',
                ],
        });
        // Registra mi UID en el proyecto para que aparezca en "Compartidos conmigo".
        if (granted) {
          try {
            await updateDoc(
              doc(db, 'blockly_projects', snap.id),
              role === 'editor'
                ? { editors: arrayUnion(usuario.uid) }
                : { viewers: arrayUnion(usuario.uid) }
            );
            loadSharedWithMe();
          } catch {
            /* sin permiso de escritura: no es crítico para abrir el proyecto */
          }
        }
      } catch (err) {
        log('No se pudo abrir el proyecto compartido: ' + err.message, 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedProject?.id, usuario?.uid]);

  /* ── WEB SERIAL: conectar / desconectar ── */
  // Bucle de lectura del puerto serie (respuestas del REPL / Serial.print).
  // Detecta la placa por el banner del REPL y avisa si no coincide con la elegida.
  const detectBoardFromLine = useCallback(
    (line) => {
      const l = line.toLowerCase();

      // Error de módulo = código de una placa enviado a otra distinta.
      if (/no module named ['"]?microbit/.test(l)) {
        log('⚠️ La placa NO tiene el módulo «microbit»: este código es de micro:bit. Selecciona la placa correcta en el desplegable (parece un CyberPi/ESP32).', 'error');
        return;
      }
      if (/no module named ['"]?cyberpi/.test(l)) {
        log('⚠️ La placa NO tiene el módulo «cyberpi»: este código es de CyberPi. Selecciona «CyberPi / mBot2» o usa una placa CyberPi.', 'error');
        return;
      }
      // Avisa solo de errores reales (XxxError:), no de Traceback ni del
      // KeyboardInterrupt que provoca nuestro propio Ctrl-C al detener el programa.
      if (/^\s*\w*Error:/.test(line)) {
        log('⚠️ La placa devolvió un error (ver línea «…» anterior). Revisa el código.', 'error');
      }

      let detected = null;
      if (l.includes('esp32')) detected = 'cyberpi';
      else if (l.includes('micro:bit') || l.includes('nrf52') || l.includes('microbit')) detected = 'microbit';
      if (!detected || detected === detectedBoardRef.current) return;
      detectedBoardRef.current = detected;
      const sel = selectedBoardRef.current;
      if (baseBoard(detected) !== baseBoard(sel)) {
        log(
          `⚠️ La placa conectada parece ${BOARD_META[detected].label}, pero tienes seleccionada «${BOARD_META[sel].label}». ` +
            `Cambia el desplegable a «${BOARD_META[detected].label}» para generar el código correcto.`,
          'error'
        );
      } else {
        log(`✓ Placa detectada: ${BOARD_META[detected].label}.`, 'success');
      }
    },
    [log]
  );

  const startReadLoop = useCallback(
    async (port) => {
      readerKeepAlive.current = true;
      detectedBoardRef.current = null;
      gotDataRef.current = false;
      let reader;
      try {
        reader = port.readable.getReader(); // lectura directa (sin pipeTo)
      } catch (e) {
        log('No se pudo abrir el lector del puerto: ' + e.message, 'error');
        return;
      }
      readerRef.current = reader;
      log('Escuchando el puerto serie…', 'info');
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (readerKeepAlive.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) gotDataRef.current = true;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          serialAccumRef.current = (serialAccumRef.current + chunk).slice(-4000);
          let idx;
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).replace(/\r/g, '');
            buffer = buffer.slice(idx + 1);
            if (line.trim()) {
              log('« ' + line, 'serial');
              detectBoardFromLine(line);
            }
          }
        }
      } catch (e) {
        log('Lectura serie finalizada: ' + e.message, 'info');
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ya liberado */
        }
        if (readerRef.current === reader) readerRef.current = null;
      }
    },
    [log, detectBoardFromLine]
  );

  // Muestra en la terminal las pistas de navegador/driver/firmware de la placa.
  const logConnectHelp = useCallback(() => {
    log('— Ayuda para detectar la placa —', 'info');
    log('Navegador: usa Chrome, Edge u Opera (Firefox/Safari no soportan Web Serial) sobre HTTPS o localhost.', 'info');
    (CONNECT_HELP[selectedBoard] || []).forEach((linea) => log('• ' + linea, 'info'));
  }, [selectedBoard, log]);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      log('❌ Tu navegador no soporta Web Serial API.', 'error');
      logConnectHelp();
      return;
    }
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch (err) {
      // NotFoundError = el usuario canceló o no había ningún puerto disponible.
      if (err?.name === 'NotFoundError') {
        log('No se seleccionó ninguna placa (o no se detectó ningún puerto).', 'error');
      } else {
        log('No se pudo abrir el selector de puertos: ' + err.message, 'error');
      }
      logConnectHelp();
      return;
    }
    try {
      // 115200 sirve para Arduino y para el REPL de CircuitPython/MicroPython.
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      // ESP32 (CyberPi): pulsa EN con IO0 alto para que arranque en modo NORMAL
      // (evita que se quede en reset/bootloader y no responda el REPL).
      if (selectedBoard === 'cyberpi') {
        try {
          await port.setSignals({ dataTerminalReady: false, requestToSend: true });
          await new Promise((r) => setTimeout(r, 150));
          await port.setSignals({ dataTerminalReady: false, requestToSend: false });
          await new Promise((r) => setTimeout(r, 150));
        } catch {
          /* algunos drivers no permiten setSignals */
        }
      }
      writerRef.current = port.writable.getWriter(); // escritura directa (sin pipeTo)
      setIsConnected(true);
      cyberpiNeedsResetRef.current = false; // placa recién conectada = limpia
      log(`✅ Conectado a ${BOARD_META[selectedBoard].label} (115200 bps)`, 'success');
      startReadLoop(port);
      // En placas MicroPython: interrumpe el programa de arranque (Ctrl-C) y
      // pide el banner (Ctrl-B) para obtener respuesta y detectar la placa.
      if (selectedBoard !== 'arduino') {
        setTimeout(async () => {
          try {
            // Martillea Ctrl-C para romper un posible programa de arranque (main.py).
            for (let i = 0; i < 8; i++) {
              await writeRaw('\x03');
              await new Promise((r) => setTimeout(r, 90));
            }
            await new Promise((r) => setTimeout(r, 150));
            await writeRaw('\r\x02'); // Ctrl-B: imprime el banner
          } catch {
            /* ignore */
          }
        }, 300);
        // Diagnóstico: si en 2,5 s no llega nada, avisamos.
        setTimeout(() => {
          if (!gotDataRef.current && portRef.current) {
            log('⚠️ La placa no ha respondido nada todavía. Posibles causas:', 'error');
            log('• Cierra otros programas que usen el puerto (mBlock, IDE Arduino, monitor serie).', 'info');
            log('• micro:bit: el REPL solo responde si tiene MicroPython flasheado (no MakeCode). Flashéalo en python.microbit.org.', 'info');
            log('• Si se abrió una unidad USB «MICROBIT» con DETAILS.TXT y enlace a microbit.org → es una micro:bit: selecciona «BBC Micro:bit V2» arriba.', 'info');
            log('• CyberPi: enciéndelo y comprueba que es realmente un CyberPi (su REPL dice «… ESP32»).', 'info');
            log('• Pulsa 🔌 Desconectar y vuelve a 🔗 Conectar (elige el puerto correcto).', 'info');
          }
        }, 2500);
      }
    } catch (err) {
      log('❌ La placa se seleccionó pero no se pudo abrir el puerto: ' + err.message, 'error');
      log('Puede que otro programa esté usando el puerto (mBlock, IDE Arduino, monitor serie). Ciérralo e inténtalo de nuevo.', 'info');
      logConnectHelp();
    }
  }, [selectedBoard, log, logConnectHelp, startReadLoop]);

  const disconnect = useCallback(async () => {
    readerKeepAlive.current = false;
    try {
      // Cancela el reader (hace que el bucle salga y libere su lock).
      if (readerRef.current) {
        await readerRef.current.cancel().catch(() => {});
      }
      // Libera el writer.
      if (writerRef.current) {
        try {
          await writerRef.current.close().catch(() => {});
        } catch {
          /* ignore */
        }
        try {
          writerRef.current.releaseLock();
        } catch {
          /* ya liberado */
        }
        writerRef.current = null;
      }
      // Espera un instante a que el bucle de lectura libere su lock antes de cerrar.
      await new Promise((r) => setTimeout(r, 60));
      if (portRef.current) {
        await portRef.current.close().catch(() => {});
        portRef.current = null;
      }
    } finally {
      setIsConnected(false);
      log('Desconectado.', 'info');
    }
  }, [log]);

  const writeRaw = async (str) => {
    if (!writerRef.current) return;
    await writerRef.current.write(SERIAL_ENCODER.encode(str));
  };

  // Escribe bytes en bruto (para las tramas del protocolo del CyberPi).
  const writeBytes = async (bytes) => {
    if (!writerRef.current) return;
    await writerRef.current.write(bytes);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Espera a que aparezca un patrón en las respuestas serie (o null si caduca).
  const waitForRegex = (re, timeout = 4000) =>
    new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const m = serialAccumRef.current.match(re);
        if (m) return resolve(m);
        if (Date.now() - start > timeout) return resolve(null);
        setTimeout(tick, 60);
      };
      tick();
    });

  // Reinicia el CyberPi por señales (DTR/RTS) y espera el banner de arranque.
  const resetCyberpi = useCallback(async () => {
    if (!portRef.current) return false;
    try {
      await portRef.current.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(150);
      await portRef.current.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch {
      return false;
    }
    serialAccumRef.current = '';
    // Espera el FINAL del arranque: la línea «Type "help"» (solo aparece cuando
    // MicroPython ya está listo). OJO: no usar «>>>» porque hay un prompt sobrante
    // al inicio del reset y dispararíamos el envío antes de que arranque MicroPython.
    return !!(await waitForRegex(/Type "help/, 15000));
  }, []);

  // Ejecuta pyCode con exec(). En CyberPi reinicia y aprovecha la VENTANA de
  // arranque (antes del menú) inundando el exec; en micro:bit interrumpe y envía.
  const execAndWait = useCallback(
    async (pyCode, re, tries = 6) => {
      const line = 'exec(' + JSON.stringify(pyCode) + ')\r\n';
      if (selectedBoard === 'cyberpi') {
        await resetCyberpi();
        serialAccumRef.current = '';
        const start = Date.now();
        let sent = 0;
        while (Date.now() - start < 7000) {
          if (sent < 18) {
            await writeRaw(line);
            sent++;
          }
          const m = serialAccumRef.current.match(re);
          if (m) return m;
          await sleep(90);
        }
        return null;
      }
      for (let i = 0; i < tries; i++) {
        serialAccumRef.current = '';
        await writeRaw('\x03');
        await sleep(120);
        await writeRaw('\x03');
        await sleep(180);
        await writeRaw(line);
        const m = await waitForRegex(re, 800);
        if (m) return m;
      }
      return null;
    },
    [selectedBoard, resetCyberpi]
  );

  /* ── EJECUTAR CÓDIGO ── */
  const runCode = useCallback(async () => {
    if (!isConnected) {
      log('Conecta primero una placa para ejecutar.', 'error');
      return;
    }
    if (busyRef.current) {
      log('Espera: hay una operación en curso con la placa (no pulses dos veces).', 'error');
      return;
    }
    const code = effectiveCode.trim();
    if (!code) {
      log('No hay código que enviar.', 'error');
      return;
    }

    if (selectedBoard === 'arduino') {
      // Arduino NO ejecuta código fuente por el puerto serie: hay que COMPILAR
      // y SUBIR el binario con avrdude/arduino-cli. El puerto serie se usa solo
      // para intercambiar DATOS en tiempo de ejecución (comandos, telemetría...).
      log('── Arduino: el .ino debe compilarse y subirse (arduino-cli / IDE).', 'info');
      log('── El puerto serie sirve para DATOS, no para cargar el programa.', 'info');
      // Demostración de comunicación de datos: enviamos un "ping" por serie.
      await writeRaw('PING\n');
      log('» PING (comando de datos enviado por serie)', 'send');
      return;
    }

    busyRef.current = true;
    try {
      code.split('\n').forEach((l) => log('» ' + (l || '·'), 'send'));
      if (selectedBoard === 'cyberpi') {
        // CyberPi/mBot2: protocolo de mBlock (tramas F3…F4 con python). Un programa
        // con bucle «por siempre» bloquea la placa, así que para PODER cargar otro
        // reiniciamos la placa antes (deja de ejecutar y vuelve a aceptar tramas).
        if (cyberpiNeedsResetRef.current) {
          log('── Reiniciando la placa para cargar el nuevo programa… ──', 'info');
          await resetCyberpi(); // espera el banner de arranque
        }
        // Sondea con una mini-trama hasta que el gestor de tramas responda
        // ({"ret"...}): el arranque tras reset tarda un tiempo variable.
        log('── Preparando la placa… ──', 'info');
        const probe = buildCyberpiFrame('pass');
        let ready = false;
        for (let i = 0; i < 24 && !ready; i++) {
          serialAccumRef.current = '';
          await writeBytes(probe);
          await sleep(500);
          if (/\{"ret"|\{"err"/.test(serialAccumRef.current)) ready = true;
        }
        if (!ready) log('(la placa tardó en responder; lo intento igualmente)', 'info');
        log('── Enviando al CyberPi (protocolo mBlock)… ──', 'info');
        await writeBytes(buildCyberpiFrame(code));
        await sleep(150);
        cyberpiNeedsResetRef.current = true; // el próximo run requerirá reinicio
      } else {
        // micro:bit: interrumpe y envía por exec en el REPL.
        log(`── Enviando al REPL (${BOARD_META[selectedBoard].lang})… ──`, 'info');
        const oneLiner = 'exec(' + JSON.stringify(code) + ')\r\n';
        await writeRaw('\x03');
        await sleep(150);
        await writeRaw('\x03');
        await sleep(250);
        await writeRaw(oneLiner);
        await sleep(150);
      }
      log('── Código enviado. Si es un bucle «por siempre», ya se ejecuta. ──', 'success');
      log('Mira la pantalla de la placa.', 'info');
    } catch (e) {
      log('Error enviando al REPL: ' + e.message, 'error');
    } finally {
      busyRef.current = false;
    }
  }, [isConnected, effectiveCode, selectedBoard, resetCyberpi, log]);

  // Guarda el programa en la placa como main.py para que arranque sola al encender.
  const uploadToBoard = useCallback(async () => {
    if (!isConnected) {
      log('Conecta la placa primero.', 'error');
      return;
    }
    if (selectedBoard === 'arduino') {
      log('En Arduino el programa se sube con el IDE de Arduino / arduino-cli (no por REPL).', 'info');
      return;
    }
    if (busyRef.current) {
      log('Espera: hay una operación en curso con la placa.', 'error');
      return;
    }
    const code = effectiveCode.trim();
    if (!code) {
      log('No hay código que guardar en la placa.', 'error');
      return;
    }
    busyRef.current = true;
    try {
      log('── Guardando el programa en la placa como main.py… ──', 'info');
      if (selectedBoard === 'cyberpi') {
        // CyberPi: escribimos main.py con una trama del protocolo (sin reiniciar).
        serialAccumRef.current = '';
        const py = `f = open('main.py', 'w')\nf.write(${JSON.stringify(code)})\nf.close()`;
        await writeBytes(buildCyberpiFrame(py));
        await sleep(700);
        if (serialAccumRef.current.includes('err')) {
          log('❌ La placa devolvió un error al guardar (ver «…»).', 'error');
        } else {
          log('✅ Programa guardado en la placa como main.py.', 'success');
        }
      } else {
        // micro:bit: por REPL, verificando el tamaño escrito.
        const py =
          `import os\nf = open('main.py', 'w')\nf.write(${JSON.stringify(code)})\nf.close()\n` +
          "print('MAINPY_LEN=' + str(os.stat('main.py')[6]))";
        const m = await execAndWait(py, /MAINPY_LEN=([0-9]+)/, 8);
        if (m) log(`✅ GUARDADO: main.py en la placa (${m[1]} bytes). Reinicia la placa para ejecutarlo.`, 'success');
        else log('❌ No se pudo guardar (la placa no soltó el REPL).', 'error');
      }
    } catch (e) {
      log('Error al guardar en la placa: ' + e.message, 'error');
    } finally {
      busyRef.current = false;
    }
  }, [isConnected, selectedBoard, effectiveCode, execAndWait, log]);

  // Borra main.py (quita el autoarranque) para que la placa vuelva a iniciar limpia.
  const deleteMainPy = useCallback(async () => {
    if (!isConnected) {
      log('Conecta la placa primero.', 'error');
      return;
    }
    if (selectedBoard === 'arduino') return;
    if (busyRef.current) {
      log('Espera: hay una operación en curso con la placa.', 'error');
      return;
    }
    busyRef.current = true;
    try {
      log('── Borrando el autoarranque (main.py) de la placa… ──', 'info');
      if (selectedBoard === 'cyberpi') {
        await writeBytes(
          buildCyberpiFrame("import os\ntry:\n    os.remove('main.py')\nexcept:\n    pass")
        );
        await sleep(500);
        log('✅ Orden de borrar main.py enviada al CyberPi.', 'success');
      } else {
        const py =
          "import os\ntry:\n    os.remove('main.py')\n    print('DEL_RESULT=BORRADO')\nexcept Exception:\n    print('DEL_RESULT=NADA')";
        const m = await execAndWait(py, /DEL_RESULT=(BORRADO|NADA)/, 8);
        if (m && m[1] === 'BORRADO') log('✅ Autoarranque borrado.', 'success');
        else if (m) log('No había main.py que borrar.', 'info');
        else log('❌ La placa no confirmó el borrado.', 'error');
      }
    } catch (e) {
      log('Error al borrar main.py: ' + e.message, 'error');
    } finally {
      busyRef.current = false;
    }
  }, [isConnected, selectedBoard, execAndWait, log]);

  // Copia un prompt (con el código actual) para editarlo con IA en Claude/Gemini.
  const copyAIPrompt = useCallback(() => {
    const prompt = buildAIPrompt(selectedBoard, effectiveCode);
    navigator.clipboard?.writeText(prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
      log('Prompt copiado: pégalo en Claude o Gemini, pide tu cambio y pega el código resultante con ✏️ Editar.', 'info');
    });
  }, [selectedBoard, effectiveCode, log]);

  // Activa el modo de edición manual del código (para pegar el código de la IA).
  const enterCodeEdit = useCallback(() => {
    setEditedCode(generatedCode);
    setCodeEditMode(true);
    setRightTab('code');
  }, [generatedCode]);

  // Convierte el código editado a bloques (mejor esfuerzo) y vuelve al modo bloques.
  const convertToBlocks = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const state = codeToState(selectedBoard, editedCode);
    if (!state) {
      log('No hay código para convertir a bloques.', 'error');
      return;
    }
    try {
      ws.clear();
      Blockly.serialization.workspaces.load(state, ws);
      setCodeEditMode(false);
      updateCode();
      log('🧩 Código convertido a bloques. Lo no reconocido queda como bloques de "código en bruto" (se conserva y funciona).', 'success');
    } catch (err) {
      log('No se pudo convertir a bloques: ' + err.message, 'error');
    }
  }, [selectedBoard, editedCode, updateCode, log]);

  /* ── UI ── */
  const logColor = {
    info: '#94a3b8',
    success: '#34d399',
    error: '#f87171',
    serial: '#60a5fa',
    send: '#fbbf24',
  };

  return (
    <div style={styles.wrapper}>
      {/* Barra superior */}
      <header style={styles.header}>
        <div style={styles.titleRow}>
          {onExit && (
            <button onClick={onExit} style={styles.backBtn} title="Volver">
              ← Volver
            </button>
          )}
          <span style={styles.logo}>🤖</span>
          <h2 style={styles.title}>Editor de Bloques · Robótica</h2>
        </div>
        <div style={styles.controls}>
          <button
            onClick={() => setShowLibrary(true)}
            style={{ ...styles.btn, background: '#7c3aed' }}
          >
            📚 Proyectos
          </button>

          {(accessRole === 'editor' || accessRole === 'viewer') && (
            <span
              style={styles.roleBadge(accessRole)}
              title={
                accessRole === 'editor'
                  ? 'Editas el proyecto original del creador'
                  : 'Solo lectura: puedes guardar una copia'
              }
            >
              {accessRole === 'editor' ? '✏️ Editor' : '👁️ Solo lectura'}
            </span>
          )}

          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Nombre del proyecto"
            style={styles.nameInput}
          />
          <button
            onClick={saveProject}
            disabled={saving}
            style={{ ...styles.btn, background: saving ? '#94a3b8' : '#0891b2' }}
            title={usuario?.uid ? 'Guardar en tu cuenta' : 'Guardar (te pediremos registrarte)'}
          >
            {saving ? '⏳ Guardando…' : accessRole === 'viewer' ? '💾 Guardar copia' : '💾 Guardar'}
          </button>

          {usuario?.uid && accessRole === 'owner' && loadedDocId && (
            <button
              onClick={openShare}
              style={{ ...styles.btn, background: '#db2777' }}
              title="Compartir con enlace (editor o solo lectura)"
            >
              🔗 Compartir
            </button>
          )}

          <select
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
            style={styles.select}
          >
            {Object.entries(BOARD_META).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label} · {m.lang}
              </option>
            ))}
          </select>

          <button
            onClick={isConnected ? disconnect : connect}
            style={{
              ...styles.btn,
              background: isConnected ? '#dc2626' : '#2563eb',
            }}
          >
            {isConnected ? '🔌 Desconectar' : '🔗 Conectar Placa'}
          </button>

          <button
            onClick={runCode}
            disabled={!isConnected}
            style={{
              ...styles.btn,
              background: isConnected ? '#16a34a' : '#94a3b8',
              cursor: isConnected ? 'pointer' : 'not-allowed',
            }}
          >
            ▶ Ejecutar Código
          </button>

          {/* En CyberPi el firmware siempre arranca a su menú: main.py no autoarranca,
              así que estos botones solo se ofrecen para micro:bit (donde sí funciona). */}
          {baseBoard(selectedBoard) === 'microbit' && (
            <button
              onClick={uploadToBoard}
              disabled={!isConnected}
              style={{
                ...styles.btn,
                background: isConnected ? '#ea580c' : '#94a3b8',
                cursor: isConnected ? 'pointer' : 'not-allowed',
              }}
              title="Guardar el programa en la placa (main.py) para que arranque sola al encender"
            >
              📥 Guardar en placa
            </button>
          )}

          {baseBoard(selectedBoard) === 'microbit' && (
            <button
              onClick={deleteMainPy}
              disabled={!isConnected}
              style={{
                ...styles.btn,
                background: isConnected ? '#475569' : '#94a3b8',
                cursor: isConnected ? 'pointer' : 'not-allowed',
              }}
              title="Quitar el autoarranque (borrar main.py)"
            >
              🧹 Borrar autoarranque
            </button>
          )}

          <span style={styles.statusDot(isConnected)} />
          <span style={styles.statusText}>
            {isConnected ? 'Conectada' : 'Desconectada'}
          </span>
        </div>
      </header>

      {/* Zona central: Blockly + panel de código */}
      <div style={styles.main}>
        <div ref={blocklyDiv} style={styles.blocklyArea}>
          {panelCollapsed && (
            <button
              onClick={() => setPanelCollapsed(false)}
              style={styles.showPanelBtn}
              title="Mostrar panel de código"
            >
              {'«'} Código / Pasos
            </button>
          )}
        </div>

        {!panelCollapsed && (
          <div onMouseDown={startResize} style={styles.resizer} title="Arrastra para redimensionar" />
        )}

        {!panelCollapsed && (
        <aside style={{ ...styles.codePanel, width: panelWidth }}>
          <div style={styles.tabBar}>
            <button
              onClick={() => setRightTab('code')}
              style={styles.tab(rightTab === 'code')}
            >
              {'</>'} Código
            </button>
            <button
              onClick={() => setRightTab('steps')}
              style={styles.tab(rightTab === 'steps')}
            >
              📖 Pasos
            </button>
            <button
              onClick={() => setPanelCollapsed(true)}
              style={styles.collapseBtn}
              title="Ocultar panel (más espacio para bloques)"
            >
              {'»'}
            </button>
          </div>

          {rightTab === 'code' ? (
            <>
              <div style={styles.codeHeader}>
                <span>{codeEditMode ? '✏️ Código (editable)' : 'Código generado'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={styles.langBadge}>{BOARD_META[selectedBoard].lang}</span>
                  {codeEditMode ? (
                    <button
                      onClick={() => setCodeEditMode(false)}
                      style={styles.miniBtn}
                      title="Descartar cambios manuales y volver al código de los bloques"
                    >
                      ↺ Bloques
                    </button>
                  ) : (
                    <button onClick={enterCodeEdit} style={styles.miniBtn} title="Editar/pegar código a mano">
                      ✏️ Editar
                    </button>
                  )}
                </div>
              </div>

              {codeEditMode && (
                <div style={styles.editBanner}>
                  Modo código manual: pega aquí el código de la IA. Conviértelo a
                  bloques para verlo y guardarlo.
                  <button onClick={convertToBlocks} style={styles.convertBtn}>
                    🧩 Convertir a bloques
                  </button>
                </div>
              )}

              {codeEditMode ? (
                <textarea
                  value={editedCode}
                  onChange={(e) => setEditedCode(e.target.value)}
                  spellCheck={false}
                  style={styles.codeTextarea}
                  placeholder="Pega aquí el código que te ha devuelto la IA…"
                />
              ) : (
                <pre style={styles.codePre}>
                  {generatedCode || '// Arrastra bloques para generar código…'}
                </pre>
              )}

              <button onClick={copyAIPrompt} style={styles.promptBtn}>
                {promptCopied ? '✅ ¡Prompt copiado!' : '🤖 Copiar prompt para editar con IA'}
              </button>
              <div style={styles.codeActions}>
                <button
                  onClick={() => navigator.clipboard?.writeText(effectiveCode)}
                  style={styles.copyBtn}
                >
                  📋 Copiar
                </button>
                <button onClick={downloadCode} style={styles.copyBtn}>
                  ⬇️ Descargar .{selectedBoard === 'arduino' ? 'ino' : 'py'}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.stepsPanel}>
              {activeProject ? (
                <>
                  <h3 style={styles.stepsTitle}>
                    {activeProject.emoji} {activeProject.title}
                  </h3>
                  <p style={styles.stepsDesc}>{activeProject.desc}</p>
                  <ol style={styles.stepsList}>
                    {activeProject.steps.map((s, i) => (
                      <li key={i} style={styles.stepItem}>
                        <span style={styles.stepNum}>{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={() => setShowLibrary(true)}
                    style={{ ...styles.copyBtn, flex: 'none', marginTop: '14px' }}
                  >
                    📚 Ver otros proyectos
                  </button>
                </>
              ) : (
                <div style={styles.stepsEmpty}>
                  Abre un proyecto desde <b>📚 Proyectos</b> para ver aquí la
                  explicación paso a paso.
                </div>
              )}
            </div>
          )}
        </aside>
        )}
      </div>

      {/* Terminal */}
      <section style={{ ...styles.terminal, height: terminalCollapsed ? 'auto' : 170 }}>
        <div style={styles.terminalHeader}>
          <span>● Terminal serie</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setLogs([])} style={styles.clearBtn}>
              Limpiar
            </button>
            <button
              onClick={() => setTerminalCollapsed((v) => !v)}
              style={styles.clearBtn}
              title={terminalCollapsed ? 'Mostrar terminal' : 'Ocultar terminal (más espacio)'}
            >
              {terminalCollapsed ? '▲' : '▼'}
            </button>
          </div>
        </div>
        {!terminalCollapsed && (
        <div style={styles.terminalBody}>
          {logs.length === 0 && (
            <div style={{ color: '#64748b' }}>
              Esperando actividad… (conecta una placa y pulsa Ejecutar)
            </div>
          )}
          {logs.map((l, i) => (
            <div key={i} style={{ color: logColor[l.type] || '#cbd5e1' }}>
              <span style={styles.logTime}>[{l.time}]</span> {l.msg}
            </div>
          ))}
        </div>
        )}
      </section>

      {/* Modal: Biblioteca de proyectos */}
      {showLibrary && (
        <div style={styles.modalOverlay} onClick={() => setShowLibrary(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                📚 Biblioteca de proyectos
              </h3>
              <button onClick={() => setShowLibrary(false)} style={styles.modalClose}>
                ✕
              </button>
            </div>
            <p style={styles.modalSub}>
              Elige un proyecto: cargará los bloques en el editor y verás su
              explicación paso a paso en la pestaña <b>📖 Pasos</b>.
            </p>

            {/* Mis proyectos guardados */}
            {usuario?.uid ? (
              myProjects.length > 0 && (
                <>
                  <h4 style={styles.sectionLabel}>💾 Mis proyectos guardados</h4>
                  <div style={styles.projectGrid}>
                    {myProjects.map((p) => (
                      <div key={p.id} style={styles.projectCard}>
                        <button
                          onClick={() => openSavedProject(p)}
                          style={styles.cardClickArea}
                        >
                          <div style={styles.projectEmoji}>💾</div>
                          <div style={styles.projectTitle}>{p.nombre}</div>
                          <div style={styles.projectBoard}>
                            {BOARD_META[p.board]?.label || p.board}
                          </div>
                        </button>
                        <button
                          onClick={() => deleteSavedProject(p)}
                          style={styles.deleteBtn}
                          title="Borrar"
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              <div style={styles.loginHint}>
                ✨ <b>¿Tienes proyectos para guardar?</b> Crea tu código y pulsa
                💾 Guardar: te ofreceremos registrarte y conservaremos tu trabajo.
              </div>
            )}

            {/* Compartidos conmigo */}
            {usuario?.uid && sharedProjects.length > 0 && (
              <>
                <h4 style={styles.sectionLabel}>🤝 Compartidos conmigo</h4>
                <div style={styles.projectGrid}>
                  {sharedProjects.map((p) => (
                    <div key={p.id} style={styles.projectCard}>
                      <button onClick={() => openSharedWithMe(p)} style={styles.cardClickArea}>
                        <div style={styles.projectEmoji}>
                          {p.__role === 'viewer' ? '👁️' : '✏️'}
                        </div>
                        <div style={styles.projectTitle}>{p.nombre}</div>
                        <div style={styles.projectBoard}>
                          {p.__role === 'viewer' ? 'Solo lectura' : 'Editor'} ·{' '}
                          {p.autor || 'otro usuario'}
                        </div>
                        <div style={styles.projectDesc}>
                          {BOARD_META[p.board]?.label || p.board}
                        </div>
                      </button>
                      <button
                        onClick={() => removeSharedWithMe(p)}
                        style={styles.deleteBtn}
                        title="Quitar de mis compartidos"
                      >
                        ✖
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h4 style={styles.sectionLabel}>🚀 Proyectos de ejemplo</h4>
            <div style={styles.projectGrid}>
              {PROJECTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p)}
                  style={styles.projectCard}
                >
                  <div style={styles.projectEmoji}>{p.emoji}</div>
                  <div style={styles.projectTitle}>{p.title}</div>
                  <div style={styles.projectBoard}>{BOARD_META[p.board].label}</div>
                  <div style={styles.projectDesc}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: registrarse para guardar (usuario no registrado) */}
      {showRegisterPrompt && (
        <div style={styles.modalOverlay} onClick={() => setShowRegisterPrompt(false)}>
          <div
            style={{ ...styles.modal, maxWidth: '440px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '46px' }}>🔐</div>
            <h3 style={{ margin: '8px 0', color: '#f1f5f9' }}>
              Regístrate para guardar tu proyecto
            </h3>
            <p style={styles.modalSub}>
              Tu código <b>«{projectName}»</b> ya está reservado. Crea una cuenta
              gratis y lo guardaremos automáticamente en tu perfil para que puedas
              volver a abrirlo cuando quieras.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setShowRegisterPrompt(false);
                  if (onLoginRequest) onLoginRequest();
                  else
                    log('Inicia sesión desde la pantalla principal; tu proyecto está guardado y se conservará.', 'info');
                }}
                style={{ ...styles.btn, background: '#16a34a', padding: '12px 20px' }}
              >
                ✅ Registrarme y guardar
              </button>
              <button
                onClick={() => setShowRegisterPrompt(false)}
                style={{ ...styles.btn, background: '#475569', padding: '12px 20px' }}
              >
                Ahora no
              </button>
            </div>
            <p style={{ ...styles.modalSub, marginTop: '14px', fontSize: '11.5px' }}>
              Mientras tanto puedes seguir editando o copiar el código con 📋 Copiar.
            </p>
          </div>
        </div>
      )}

      {/* Modal: compartir proyecto con enlaces por rol */}
      {showShare && shareLinks && (
        <div style={styles.modalOverlay} onClick={() => setShowShare(false)}>
          <div
            style={{ ...styles.modal, maxWidth: '560px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>🔗 Compartir «{projectName}»</h3>
              <button onClick={() => setShowShare(false)} style={styles.modalClose}>
                ✕
              </button>
            </div>
            <p style={styles.modalSub}>
              Comparte estos enlaces con otros profes o alumnos (deben iniciar
              sesión para abrirlos).
            </p>

            <div style={styles.shareRow}>
              <div>
                <div style={{ ...styles.sectionLabel, margin: '0 0 4px' }}>✏️ Editor</div>
                <div style={styles.shareNote}>Puede modificar tu proyecto original.</div>
              </div>
              <div style={styles.shareLinkBox}>
                <input readOnly value={shareLinks.editor} style={styles.shareInput} />
                <button
                  onClick={() => navigator.clipboard?.writeText(shareLinks.editor)}
                  style={styles.shareCopy}
                >
                  Copiar
                </button>
              </div>
            </div>

            <div style={styles.shareRow}>
              <div>
                <div style={{ ...styles.sectionLabel, margin: '0 0 4px' }}>👁️ Solo lectura</div>
                <div style={styles.shareNote}>
                  Puede verlo y copiarlo, pero no modifica tu original.
                </div>
              </div>
              <div style={styles.shareLinkBox}>
                <input readOnly value={shareLinks.viewer} style={styles.shareInput} />
                <button
                  onClick={() => navigator.clipboard?.writeText(shareLinks.viewer)}
                  style={styles.shareCopy}
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   4. ESTILOS (inline, autocontenidos)
   ────────────────────────────────────────────────────────────────────────── */
const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    background: '#0f172a',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  },
  backBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: '4px',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 16px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  logo: { fontSize: '22px' },
  title: { color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: 0 },
  controls: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  select: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusDot: (on) => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: on ? '#22c55e' : '#64748b',
    boxShadow: on ? '0 0 8px #22c55e' : 'none',
    display: 'inline-block',
  }),
  statusText: { color: '#94a3b8', fontSize: '12px' },
  main: { display: 'flex', flex: 1, minHeight: '320px' },
  blocklyArea: { flex: 1, minWidth: 0, background: '#fff', position: 'relative' },
  resizer: {
    width: '6px',
    cursor: 'col-resize',
    background: '#334155',
    flexShrink: 0,
  },
  showPanelBtn: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 5,
    padding: '7px 12px',
    borderRadius: '8px',
    border: 'none',
    background: '#1e293b',
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  collapseBtn: {
    border: 'none',
    background: '#020617',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '0 12px',
  },
  codePanel: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#0b1220',
    borderLeft: '1px solid #334155',
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: 600,
    borderBottom: '1px solid #1e293b',
  },
  langBadge: {
    fontSize: '11px',
    background: '#334155',
    color: '#93c5fd',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  codePre: {
    flex: 1,
    margin: 0,
    padding: '12px',
    overflow: 'auto',
    color: '#a5f3fc',
    fontSize: '12.5px',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre',
  },
  miniBtn: {
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#cbd5e1',
    borderRadius: '6px',
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 700,
  },
  editBanner: {
    background: '#422006',
    color: '#fcd34d',
    fontSize: '11.5px',
    padding: '8px 12px',
    lineHeight: 1.4,
    borderBottom: '1px solid #1e293b',
  },
  convertBtn: {
    display: 'block',
    marginTop: '8px',
    padding: '7px 12px',
    borderRadius: '8px',
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },
  codeTextarea: {
    flex: 1,
    margin: 0,
    padding: '12px',
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: '#0b1220',
    color: '#a5f3fc',
    fontSize: '12.5px',
    fontFamily: 'Consolas, "Courier New", monospace',
    lineHeight: 1.5,
  },
  promptBtn: {
    margin: '8px 8px 0',
    padding: '9px',
    borderRadius: '8px',
    border: 'none',
    background: '#7c3aed',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12.5px',
    fontWeight: 700,
  },
  codeActions: { display: 'flex', gap: '8px', padding: '8px' },
  copyBtn: {
    flex: 1,
    margin: 0,
    padding: '7px',
    borderRadius: '6px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: '12px',
  },
  terminal: {
    height: '170px',
    display: 'flex',
    flexDirection: 'column',
    background: '#020617',
    borderTop: '1px solid #334155',
  },
  terminalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    color: '#f87171',
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: '1px solid #1e293b',
  },
  clearBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: '6px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  terminalBody: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 12px',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12.5px',
    lineHeight: 1.5,
  },
  logTime: { color: '#475569' },

  // Pestañas del panel derecho
  tabBar: { display: 'flex', borderBottom: '1px solid #1e293b' },
  tab: (active) => ({
    flex: 1,
    padding: '9px 6px',
    border: 'none',
    background: active ? '#0b1220' : '#020617',
    color: active ? '#e2e8f0' : '#64748b',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
    borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  }),

  // Panel de pasos
  stepsPanel: { flex: 1, overflow: 'auto', padding: '14px 14px 16px' },
  stepsTitle: { margin: '0 0 6px', color: '#e2e8f0', fontSize: '15px', fontWeight: 800 },
  stepsDesc: { margin: '0 0 14px', color: '#94a3b8', fontSize: '12.5px', lineHeight: 1.5 },
  stepsList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  stepItem: { display: 'flex', gap: '10px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.45 },
  stepNum: {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#7c3aed',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsEmpty: { padding: '20px 16px', color: '#64748b', fontSize: '13px', lineHeight: 1.6 },

  // Modal biblioteca
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100000,
    background: 'rgba(2,6,23,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '820px',
    maxHeight: '88vh',
    overflow: 'auto',
    padding: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#f1f5f9',
  },
  modalClose: {
    background: '#1e293b',
    border: 'none',
    color: '#cbd5e1',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    fontSize: '15px',
  },
  modalSub: { color: '#94a3b8', fontSize: '13px', margin: '8px 0 16px', lineHeight: 1.5 },
  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
  },
  projectCard: {
    position: 'relative',
    textAlign: 'left',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '14px',
    cursor: 'pointer',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  projectEmoji: { fontSize: '28px' },
  projectTitle: { fontSize: '14px', fontWeight: 800 },
  nameInput: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '13px',
    width: '150px',
  },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 800,
    margin: '6px 0 10px',
  },
  cardClickArea: {
    all: 'unset',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  deleteBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(220,38,38,0.15)',
    border: 'none',
    borderRadius: '6px',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '3px 6px',
  },
  loginHint: {
    background: '#1e293b',
    border: '1px dashed #475569',
    borderRadius: '10px',
    padding: '12px 14px',
    color: '#cbd5e1',
    fontSize: '12.5px',
    lineHeight: 1.5,
    marginBottom: '14px',
  },
  roleBadge: (role) => ({
    padding: '5px 10px',
    borderRadius: '999px',
    fontSize: '11.5px',
    fontWeight: 700,
    color: '#fff',
    background: role === 'editor' ? '#0891b2' : '#64748b',
  }),
  shareRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '12px',
  },
  shareNote: { color: '#94a3b8', fontSize: '12px' },
  shareLinkBox: { display: 'flex', gap: '8px' },
  shareInput: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#93c5fd',
    fontSize: '12px',
    fontFamily: 'Consolas, monospace',
  },
  shareCopy: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    background: '#db2777',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '12px',
  },
  projectBoard: {
    fontSize: '10.5px',
    color: '#a78bfa',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  projectDesc: { fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 },
};
