// RetosEditor.jsx
// Editor de retos tipo Scratch: paleta de bloques (movimiento, apariencia,
// eventos, control, sensores, operadores) para mover a Pi (Pikatron) y resolver
// retos. Soporta: secuencias, teclado, botones de dirección en pantalla,
// "decir" (bocadillo) y "preguntar al usuario".
//
// Dependencia: blockly (ya instalada).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as Es from 'blockly/msg/es';
import { javascriptGenerator, Order } from 'blockly/javascript';
import imgPi from './assets/pikatron-sprite.png';
import { db } from './firebase';
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

Blockly.setLocale(Es);

/* ───────── Bloques y generadores (una sola vez) ───────── */
let RETOS_DEFINED = false;
function defineRetosBlocks() {
  if (RETOS_DEFINED) return;
  RETOS_DEFINED = true;

  Blockly.defineBlocksWithJsonArray([
    // EVENTOS
    {
      type: 'reto_start',
      message0: 'al empezar 🏁 %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
      colour: 50,
      tooltip: 'Se ejecuta al pulsar ▶ Probar',
    },
    {
      type: 'reto_on_key',
      message0: 'al presionar tecla %1 %2 %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'KEY',
          options: [
            ['→ derecha', 'derecha'],
            ['← izquierda', 'izquierda'],
            ['↑ arriba', 'arriba'],
            ['↓ abajo', 'abajo'],
            ['espacio', 'espacio'],
          ],
        },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      colour: 50,
      tooltip: 'Se ejecuta al pulsar esa tecla o el botón de dirección',
    },
    // MOVIMIENTO
    {
      type: 'reto_mover',
      message0: 'mover %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'DIR',
          options: [
            ['▶ derecha', 'derecha'],
            ['◀ izquierda', 'izquierda'],
            ['▲ arriba', 'arriba'],
            ['▼ abajo', 'abajo'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230,
      tooltip: 'Mueve a Pi un paso en esa dirección',
    },
    {
      type: 'reto_saltar',
      message0: 'saltar ⤴',
      previousStatement: null,
      nextStatement: null,
      colour: 230,
      tooltip: 'Pi da un salto',
    },
    {
      type: 'reto_mirar',
      message0: 'mirar hacia %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'DIR',
          options: [
            ['▶ derecha', 'derecha'],
            ['◀ izquierda', 'izquierda'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230,
      tooltip: 'Voltea a Pi (simetría) hacia la derecha o la izquierda',
    },
    {
      type: 'reto_ir_inicio',
      message0: 'ir al inicio',
      previousStatement: null,
      nextStatement: null,
      colour: 230,
      tooltip: 'Vuelve a la posición inicial',
    },
    // APARIENCIA
    {
      type: 'reto_decir',
      message0: 'decir %1',
      args0: [{ type: 'input_value', name: 'TXT' }],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'Muestra un bocadillo',
    },
    {
      type: 'reto_decir_tiempo',
      message0: 'decir %1 durante %2 s',
      args0: [
        { type: 'input_value', name: 'TXT' },
        { type: 'field_number', name: 'T', value: 2, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 280,
      tooltip: 'Muestra un bocadillo unos segundos',
    },
    {
      type: 'reto_disfraz',
      message0: 'cambiar disfraz a %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'D',
          options: [
            ['1', '0'],
            ['2', '1'],
            ['3', '2'],
            ['4', '3'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 300,
      tooltip: 'Cambia el disfraz (fotograma) de Pi',
    },
    {
      type: 'reto_siguiente_disfraz',
      message0: 'siguiente disfraz',
      previousStatement: null,
      nextStatement: null,
      colour: 300,
      tooltip: 'Pasa al siguiente disfraz (para animar)',
    },
    // SENSORES
    {
      type: 'reto_preguntar',
      message0: 'preguntar %1 y esperar',
      args0: [{ type: 'input_value', name: 'Q' }],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'Pregunta al usuario y guarda la respuesta',
    },
    {
      type: 'reto_respuesta',
      message0: 'respuesta',
      output: null,
      colour: 200,
      tooltip: 'Lo que escribió el usuario',
    },
    {
      type: 'reto_tocando_meta',
      message0: '¿tocando la meta 🏁?',
      output: 'Boolean',
      colour: 200,
      tooltip: 'Verdadero si Pi está en la bandera',
    },
    {
      type: 'reto_tocando_borde',
      message0: '¿tocando el borde?',
      output: 'Boolean',
      colour: 200,
      tooltip: 'Verdadero si Pi llegó al borde',
    },
    // CONTROL
    {
      type: 'reto_esperar',
      message0: 'esperar %1 s',
      args0: [{ type: 'field_number', name: 'T', value: 1, min: 0, precision: 0.1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'Espera unos segundos',
    },
    {
      type: 'reto_repetir',
      message0: 'repetir %1 veces %2 %3',
      args0: [
        { type: 'field_number', name: 'N', value: 4, min: 1, precision: 1 },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'Repite N veces',
    },
    {
      type: 'reto_por_siempre',
      message0: 'por siempre %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      colour: 120,
      tooltip: 'Repite sin parar (hasta reiniciar)',
    },
    {
      type: 'reto_si',
      message0: 'si %1 entonces %2 %3',
      args0: [
        { type: 'input_value', name: 'COND', check: 'Boolean' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'Si se cumple, ejecuta los bloques',
    },
    {
      type: 'reto_si_sino',
      message0: 'si %1 entonces %2 %3 si no %4',
      args0: [
        { type: 'input_value', name: 'COND', check: 'Boolean' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
        { type: 'input_statement', name: 'ELSE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'Si se cumple hace una cosa; si no, otra',
    },
  ]);

  const J = javascriptGenerator;
  const body = (b, gen, name) => gen.statementToCode(b, name);
  J.forBlock['reto_start'] = (b, gen) => `R.onStart(async () => {\n${body(b, gen, 'DO')}});\n`;
  J.forBlock['reto_on_key'] = (b, gen) =>
    `R.onKey(${JSON.stringify(b.getFieldValue('KEY'))}, async () => {\n${body(b, gen, 'DO')}});\n`;
  J.forBlock['reto_mover'] = (b) => `await R.mover(${JSON.stringify(b.getFieldValue('DIR'))});\n`;
  J.forBlock['reto_saltar'] = () => 'await R.saltar();\n';
  J.forBlock['reto_mirar'] = (b) => `await R.mirar(${JSON.stringify(b.getFieldValue('DIR'))});\n`;
  J.forBlock['reto_ir_inicio'] = () => 'await R.irInicio();\n';
  J.forBlock['reto_decir'] = (b, gen) =>
    `await R.decir(${gen.valueToCode(b, 'TXT', Order.NONE) || "''"}, 0);\n`;
  J.forBlock['reto_decir_tiempo'] = (b, gen) =>
    `await R.decir(${gen.valueToCode(b, 'TXT', Order.NONE) || "''"}, ${b.getFieldValue('T')});\n`;
  J.forBlock['reto_disfraz'] = (b) => `await R.disfraz(${b.getFieldValue('D')});\n`;
  J.forBlock['reto_siguiente_disfraz'] = () => 'await R.siguienteDisfraz();\n';
  J.forBlock['reto_preguntar'] = (b, gen) =>
    `R.respuesta = await R.preguntar(${gen.valueToCode(b, 'Q', Order.NONE) || "''"});\n`;
  J.forBlock['reto_respuesta'] = () => ['R.respuesta', Order.ATOMIC];
  J.forBlock['reto_tocando_meta'] = () => ['R.tocandoMeta()', Order.ATOMIC];
  J.forBlock['reto_tocando_borde'] = () => ['R.tocandoBorde()', Order.ATOMIC];
  J.forBlock['reto_esperar'] = (b) => `await R.esperar(${b.getFieldValue('T')});\n`;
  J.forBlock['reto_repetir'] = (b, gen) =>
    `for (let _i = 0; _i < ${b.getFieldValue('N')}; _i++) {\n${body(b, gen, 'DO')}}\n`;
  J.forBlock['reto_por_siempre'] = (b, gen) =>
    `while (await R.tick()) {\n${body(b, gen, 'DO')}}\n`;
  J.forBlock['reto_si'] = (b, gen) =>
    `if (${gen.valueToCode(b, 'COND', Order.NONE) || 'false'}) {\n${body(b, gen, 'DO')}}\n`;
  J.forBlock['reto_si_sino'] = (b, gen) =>
    `if (${gen.valueToCode(b, 'COND', Order.NONE) || 'false'}) {\n${body(b, gen, 'DO')}} else {\n${body(b, gen, 'ELSE')}}\n`;
}

const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Eventos', colour: '50',
      contents: [{ kind: 'block', type: 'reto_start' }, { kind: 'block', type: 'reto_on_key' }],
    },
    {
      kind: 'category', name: 'Movimiento', colour: '230',
      contents: [
        { kind: 'block', type: 'reto_mover' },
        { kind: 'block', type: 'reto_saltar' },
        { kind: 'block', type: 'reto_mirar' },
        { kind: 'block', type: 'reto_ir_inicio' },
      ],
    },
    {
      kind: 'category', name: 'Apariencia', colour: '280',
      contents: [
        { kind: 'block', type: 'reto_decir', inputs: { TXT: { shadow: { type: 'text', fields: { TEXT: '¡Hola!' } } } } },
        { kind: 'block', type: 'reto_decir_tiempo', inputs: { TXT: { shadow: { type: 'text', fields: { TEXT: '¡Hola!' } } } } },
        { kind: 'block', type: 'reto_disfraz' },
        { kind: 'block', type: 'reto_siguiente_disfraz' },
      ],
    },
    {
      kind: 'category', name: 'Sensores', colour: '200',
      contents: [
        { kind: 'block', type: 'reto_preguntar', inputs: { Q: { shadow: { type: 'text', fields: { TEXT: '¿Cómo te llamas?' } } } } },
        { kind: 'block', type: 'reto_respuesta' },
        { kind: 'block', type: 'reto_tocando_meta' },
        { kind: 'block', type: 'reto_tocando_borde' },
      ],
    },
    {
      kind: 'category', name: 'Control', colour: '120',
      contents: [
        { kind: 'block', type: 'reto_esperar' },
        { kind: 'block', type: 'reto_repetir' },
        { kind: 'block', type: 'reto_por_siempre' },
        { kind: 'block', type: 'reto_si' },
        { kind: 'block', type: 'reto_si_sino' },
      ],
    },
    {
      kind: 'category', name: 'Operadores', colour: '210',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
  ],
};

/* ───────── Retos de ejemplo (la biblioteca crecerá) ───────── */
const RETOS = [
  // ═══ BLOQUE 1 · Primeros pasos (secuencias) ═══
  { id: 1, titulo: 'Cruza la pantalla', enunciado: 'Lleva a Pi hasta la bandera 🏁 con bloques de movimiento.', pista: 'Usa «al empezar» + varios «mover ▶ derecha».', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 2, titulo: 'Sube a la bandera', enunciado: 'La bandera está arriba a la derecha. Combina «mover ▶» y «mover ▲».', pista: 'Primero avanza y luego sube.', start: { x: 8, y: 6 }, meta: { x: 86, y: 64 } },
  { id: 3, titulo: 'Baja a la bandera', enunciado: 'La bandera está abajo a la derecha. Usa «mover ▶» y «mover ▼».', pista: 'Avanza y baja.', start: { x: 8, y: 70 }, meta: { x: 86, y: 8 } },
  { id: 4, titulo: 'En diagonal', enunciado: 'Llega a la esquina superior derecha alternando derecha y arriba.', pista: 'Ve dando un paso a la derecha y uno arriba.', start: { x: 8, y: 8 }, meta: { x: 82, y: 66 } },
  { id: 5, titulo: 'Saluda y cruza', enunciado: 'Que Pi diga «¡Hola!» y luego llegue a la bandera.', pista: 'Usa «decir» (Apariencia) antes de moverte.', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 6, titulo: 'Ve y vuelve', enunciado: 'Pi va a por la ⭐ de la derecha y vuelve a la bandera de la izquierda.', pista: 'Usa «mover ▶» para la estrella y «mover ◀» para volver.', start: { x: 8, y: 10 }, estrella: { x: 86, y: 10 }, meta: { x: 8, y: 10 } },
  { id: 7, titulo: 'Pasos justos', enunciado: 'Llega EXACTO a la bandera, sin pasarte.', pista: 'Cuenta cuántos «mover ▶» necesitas (cada paso avanza igual).', start: { x: 8, y: 10 }, meta: { x: 56, y: 10 } },
  { id: 8, titulo: 'A la esquina', enunciado: 'Lleva a Pi a la esquina superior derecha.', pista: 'Sube del todo y ve a la derecha.', start: { x: 8, y: 8 }, meta: { x: 86, y: 72 } },

  // ═══ BLOQUE 2 · Bucles ═══
  { id: 9, titulo: 'Cruza con un bucle', enunciado: 'Llega a la bandera usando «repetir» en vez de muchos «mover».', pista: 'Mete «mover ▶» dentro de «repetir … veces».', start: { x: 6, y: 10 }, meta: { x: 90, y: 10 } },
  { id: 10, titulo: 'Escalera arriba', enunciado: 'Sube en diagonal repitiendo (derecha + arriba).', pista: 'Repite un bloque con «mover ▶» y «mover ▲».', start: { x: 6, y: 6 }, meta: { x: 86, y: 70 } },
  { id: 11, titulo: 'Escalera abajo', enunciado: 'Baja en diagonal repitiendo (derecha + abajo).', pista: 'Repite «mover ▶» y «mover ▼».', start: { x: 6, y: 72 }, meta: { x: 90, y: 6 } },
  { id: 12, titulo: 'Fila de estrellas', enunciado: 'Recoge las 4 ⭐ en fila y llega a la bandera.', pista: 'Un «repetir» con «mover ▶» las recoge todas al pasar.', start: { x: 6, y: 10 }, estrellas: [{ x: 22, y: 10 }, { x: 38, y: 10 }, { x: 54, y: 10 }, { x: 70, y: 10 }], meta: { x: 90, y: 10 } },
  { id: 13, titulo: 'Ping-pong', enunciado: 'Recoge la ⭐ de la izquierda y la de la derecha, y vuelve al centro.', pista: 'Usa «mirar» + «mover» en cada sentido.', start: { x: 50, y: 10 }, estrellas: [{ x: 8, y: 10 }, { x: 92, y: 10 }], meta: { x: 50, y: 10 } },
  { id: 14, titulo: 'Sube alto', enunciado: 'Sube hasta arriba del todo repitiendo «mover ▲».', pista: 'Usa «repetir» con «mover ▲».', start: { x: 50, y: 8 }, meta: { x: 50, y: 78 } },
  { id: 15, titulo: 'Zigzag de estrellas', enunciado: 'Recoge las ⭐ en zigzag (abajo, arriba, abajo) y llega a la bandera.', pista: 'Combina sube/baja con avanzar.', start: { x: 6, y: 8 }, estrellas: [{ x: 30, y: 58 }, { x: 58, y: 8 }, { x: 84, y: 58 }], meta: { x: 92, y: 8 } },
  { id: 16, titulo: 'Las 4 esquinas', enunciado: 'Recoge una ⭐ en cada esquina y vuelve al centro.', pista: 'Piensa la ruta: usa bucles si se repite el patrón.', start: { x: 50, y: 40 }, estrellas: [{ x: 14, y: 16 }, { x: 86, y: 16 }, { x: 86, y: 66 }, { x: 14, y: 66 }], meta: { x: 50, y: 40 } },

  // ═══ BLOQUE 3 · Disfraces y animación ═══
  { id: 17, titulo: 'Camina animando', enunciado: 'Cruza la pantalla y que Pi cambie de disfraz al andar.', pista: 'Repite: «mover ▶» + «siguiente disfraz».', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 18, titulo: 'Baile de disfraces', enunciado: 'Haz que Pi baile cambiando de disfraz y luego llegue a la bandera.', pista: '«repetir [siguiente disfraz + esperar 0.3 s]» y después muévete.', start: { x: 8, y: 10 }, meta: { x: 60, y: 10 } },
  { id: 19, titulo: 'Desfile', enunciado: 'Recoge las ⭐ mientras Pi camina animado.', pista: 'Anima con disfraces dentro del bucle de avanzar.', start: { x: 6, y: 10 }, estrellas: [{ x: 32, y: 10 }, { x: 62, y: 10 }], meta: { x: 90, y: 10 } },
  { id: 20, titulo: 'Elige disfraz', enunciado: 'Ponte el disfraz 3 y cruza la pantalla con él.', pista: 'Usa «cambiar disfraz a 3» antes de moverte.', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 21, titulo: 'Mira y cámbiate', enunciado: 'Mira a la izquierda para coger la ⭐ y luego a la derecha hacia la bandera.', pista: 'Usa «mirar ◀/▶» para que Pi se voltee.', start: { x: 50, y: 10 }, estrella: { x: 10, y: 10 }, meta: { x: 90, y: 10 } },
  { id: 22, titulo: 'Sube animando', enunciado: 'Sube en diagonal a la bandera, animando a Pi por el camino.', pista: 'Disfraces dentro del bucle que sube.', start: { x: 8, y: 6 }, meta: { x: 64, y: 70 } },

  // ═══ BLOQUE 4 · Mirar, estrellas y rutas ═══
  { id: 23, titulo: 'Recoge la estrella', enunciado: 'Ve a por la ⭐ (izquierda) y luego a la bandera (derecha).', pista: '«mirar ◀» + «mover ◀», luego «mirar ▶» + «mover ▶».', start: { x: 50, y: 10 }, estrella: { x: 12, y: 10 }, meta: { x: 88, y: 10 } },
  { id: 24, titulo: 'Estrella en lo alto', enunciado: 'Recoge la ⭐ de arriba‑izquierda y baja a la bandera.', pista: 'Combina mover ◀/▲ y luego ▶/▼.', start: { x: 50, y: 10 }, estrella: { x: 12, y: 60 }, meta: { x: 88, y: 10 } },
  { id: 25, titulo: 'Dos estrellas', enunciado: 'Recoge las dos ⭐ (lados) y sube a la bandera del centro‑arriba.', pista: 'Ve a un lado, al otro, y sube.', start: { x: 50, y: 10 }, estrellas: [{ x: 10, y: 10 }, { x: 90, y: 10 }], meta: { x: 50, y: 64 } },
  { id: 26, titulo: 'Camino en U', enunciado: 'Baja, cruza recogiendo las ⭐ y sube al otro lado.', pista: 'Piensa la ruta en forma de U.', start: { x: 8, y: 70 }, estrellas: [{ x: 8, y: 12 }, { x: 90, y: 12 }], meta: { x: 90, y: 70 } },
  { id: 27, titulo: 'Recoge y vuelve', enunciado: 'Recoge la ⭐ de cada lado y vuelve al inicio.', pista: 'Usa «ir al inicio» o regresa con «mover».', start: { x: 50, y: 10 }, estrellas: [{ x: 10, y: 40 }, { x: 90, y: 40 }], meta: { x: 50, y: 10 } },
  { id: 28, titulo: 'Tres en diagonal', enunciado: 'Recoge las 3 ⭐ en diagonal hacia arriba.', pista: 'Repite (derecha + arriba) y recoge al pasar.', start: { x: 8, y: 8 }, estrellas: [{ x: 30, y: 28 }, { x: 54, y: 48 }, { x: 78, y: 66 }], meta: { x: 90, y: 72 } },
  { id: 29, titulo: 'Cuatro esquinas (recoge)', enunciado: 'Recoge una ⭐ en cada esquina y llega a la bandera del centro.', pista: 'Planifica la ruta más corta.', start: { x: 50, y: 40 }, estrellas: [{ x: 12, y: 12 }, { x: 88, y: 12 }, { x: 88, y: 68 }, { x: 12, y: 68 }], meta: { x: 50, y: 40 } },
  { id: 30, titulo: 'Laberinto de estrellas', enunciado: 'Recoge las ⭐ subiendo y bajando hasta la bandera del final.', pista: 'Sube/baja entre cada estrella.', start: { x: 6, y: 10 }, estrellas: [{ x: 25, y: 60 }, { x: 50, y: 10 }, { x: 75, y: 60 }], meta: { x: 92, y: 10 } },

  // ═══ BLOQUE 5 · Eventos y teclado ═══
  { id: 31, titulo: 'Contrólame con las teclas', enunciado: 'Programa las teclas/botones para llevar a Pi a la bandera.', pista: '«al presionar tecla → / ↑» con «mover». Usa flechas o d-pad.', start: { x: 8, y: 10 }, meta: { x: 86, y: 70 } },
  { id: 32, titulo: 'Recoge con el teclado', enunciado: 'Programa las teclas y recoge la ⭐ y llega a la bandera.', pista: 'Programa las 4 flechas con «mover».', start: { x: 50, y: 10 }, estrella: { x: 14, y: 62 }, meta: { x: 88, y: 10 } },
  { id: 33, titulo: 'Recoge 3 con el teclado', enunciado: 'Con las teclas, recoge las 3 ⭐ y vuelve al centro.', pista: 'Programa las 4 direcciones y muévete tú.', start: { x: 50, y: 40 }, estrellas: [{ x: 12, y: 14 }, { x: 88, y: 14 }, { x: 50, y: 72 }], meta: { x: 50, y: 40 } },
  { id: 34, titulo: 'Mueve y salta', enunciado: 'Programa → para avanzar y «espacio» para saltar; llega a la bandera.', pista: 'Usa «al presionar tecla espacio» con «saltar».', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 35, titulo: 'Animado por teclas', enunciado: 'Cada vez que muevas con las teclas, cambia el disfraz de Pi.', pista: 'Pon «siguiente disfraz» dentro del «al presionar tecla».', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 36, titulo: 'Caza la estrella', enunciado: 'Con las teclas, sube a por la ⭐ y baja a la bandera.', pista: 'Programa ↑ ↓ → ← y guíalo tú.', start: { x: 8, y: 10 }, estrella: { x: 50, y: 64 }, meta: { x: 90, y: 10 } },

  // ═══ BLOQUE 6 · Preguntar y decir ═══
  { id: 37, titulo: 'Preséntate y avanza', enunciado: 'Pregunta el nombre, salúdalo y lleva a Pi a la bandera.', pista: '«preguntar…», luego «decir (unir «Hola » + respuesta)» y muévete.', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 38, titulo: 'Repite mi respuesta', enunciado: 'Pregunta algo, que Pi lo repita en un bocadillo y luego cruce.', pista: 'Usa «respuesta» dentro de «decir».', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 39, titulo: 'Cuenta atrás', enunciado: 'Que Pi diga 3, 2, 1 (con esperas) y luego cruce a la bandera.', pista: 'Usa «decir … durante 1 s» tres veces.', start: { x: 8, y: 10 }, meta: { x: 86, y: 10 } },
  { id: 40, titulo: 'La entrevista', enunciado: 'Pregunta el nombre y la edad, salúdalo y recoge la ⭐ de camino a la bandera.', pista: 'Dos «preguntar» y guarda/di la respuesta.', start: { x: 8, y: 10 }, estrella: { x: 50, y: 10 }, meta: { x: 88, y: 10 } },

  // ═══ BLOQUE 7 · Plataformas (física real) ═══
  { id: 41, titulo: 'Plataformas: el hueco', enunciado: 'Corre con ← → y salta con ↑/espacio para cruzar el hueco.', pista: 'Coge carrerilla y salta justo antes del borde.', fisica: true, start: { x: 8, y: 14 }, meta: { x: 92, y: 14 }, platforms: [{ x1: 0, x2: 40, y: 14 }, { x1: 64, x2: 100, y: 14 }] },
  { id: 42, titulo: 'Plataformas: doble salto', enunciado: 'Dos huecos. Corre y salta dos veces hasta la bandera.', pista: 'Controla la carrera; salta en cada borde.', fisica: true, start: { x: 5, y: 14 }, meta: { x: 95, y: 14 }, platforms: [{ x1: 0, x2: 28, y: 14 }, { x1: 42, x2: 60, y: 14 }, { x1: 74, x2: 100, y: 14 }] },
  { id: 43, titulo: 'Plataformas: estrella al aire', enunciado: 'Recoge la ⭐ saltando sobre el hueco y aterriza en la bandera.', pista: 'Salta cuando la ⭐ esté encima del hueco.', fisica: true, start: { x: 8, y: 14 }, estrella: { x: 52, y: 40 }, meta: { x: 92, y: 14 }, platforms: [{ x1: 0, x2: 40, y: 14 }, { x1: 64, x2: 100, y: 14 }] },
  { id: 44, titulo: 'Plataformas a distinta altura', enunciado: 'Salta a la plataforma más alta y luego baja a la bandera.', pista: 'Salta con impulso para subir al escalón alto.', fisica: true, start: { x: 6, y: 14 }, meta: { x: 92, y: 14 }, platforms: [{ x1: 0, x2: 30, y: 14 }, { x1: 40, x2: 62, y: 34 }, { x1: 72, x2: 100, y: 14 }] },
  { id: 45, titulo: 'Carrera animada', enunciado: 'Corre de un lado a otro: ¡mira la animación de Pi al correr!', pista: 'Mantén → pulsado para coger velocidad.', fisica: true, start: { x: 6, y: 14 }, meta: { x: 94, y: 14 }, platforms: [{ x1: 0, x2: 100, y: 14 }] },
  { id: 46, titulo: 'Plataformas con estrellas', enunciado: 'Recoge las 2 ⭐ saltando entre plataformas y llega a la bandera.', pista: 'Salta a tiempo para coger cada estrella.', fisica: true, start: { x: 5, y: 14 }, estrellas: [{ x: 35, y: 30 }, { x: 70, y: 30 }], meta: { x: 95, y: 14 }, platforms: [{ x1: 0, x2: 28, y: 14 }, { x1: 42, x2: 60, y: 14 }, { x1: 74, x2: 100, y: 14 }] },

  // ═══ BLOQUE 8 · Retos finales (combina todo) ═══
  { id: 47, titulo: 'El recolector', enunciado: 'Recoge las 5 ⭐ repartidas y llega a la bandera. ¡Planifica la ruta!', pista: 'Combina bucles y movimiento en varias direcciones.', start: { x: 8, y: 10 }, estrellas: [{ x: 25, y: 55 }, { x: 45, y: 12 }, { x: 60, y: 60 }, { x: 78, y: 20 }, { x: 90, y: 55 }], meta: { x: 50, y: 35 } },
  { id: 48, titulo: 'Show de Pi', enunciado: 'Pi se presenta (pregunta y saluda), baila con disfraces y recoge la ⭐ camino a la bandera.', pista: 'Junta preguntar + decir + disfraces + movimiento.', start: { x: 8, y: 10 }, estrella: { x: 50, y: 12 }, meta: { x: 90, y: 10 } },
  { id: 49, titulo: 'Plataformas extremas', enunciado: 'Tres huecos y una ⭐ en el aire. ¡Domina la carrera y el salto!', pista: 'Salta con precisión; coge la estrella sin caer.', fisica: true, start: { x: 4, y: 14 }, estrella: { x: 50, y: 38 }, meta: { x: 96, y: 14 }, platforms: [{ x1: 0, x2: 22, y: 14 }, { x1: 34, x2: 50, y: 14 }, { x1: 62, x2: 78, y: 14 }, { x1: 88, x2: 100, y: 14 }] },
  { id: 50, titulo: 'El gran reto', enunciado: 'Recoge todas las ⭐, anima a Pi y llega a la bandera. ¡Ya eres programador/a!', pista: 'Usa bucles, movimiento, disfraces y todo lo aprendido.', start: { x: 8, y: 10 }, estrellas: [{ x: 28, y: 58 }, { x: 50, y: 12 }, { x: 72, y: 58 }, { x: 90, y: 30 }], meta: { x: 92, y: 10 } },
];

// Estrellas a recoger en un reto (admite 1 «estrella» o lista «estrellas»).
const estrellasDe = (r) => r.estrellas || (r.estrella ? [r.estrella] : []);

const STEP = 16; // % por movimiento (modo "pasos")
// Física estilo "Plataformas" (gravedad, carrera y salto), en coordenadas %.
const RUN = 1.5;
const JUMP = 3.0;
const GRAV = 0.18;

// El sprite pikatron-sprite.png es una rejilla 2×2 (4 disfraces de 50%×50%).
// backgroundPosition para cada celda (col,fila) con backgroundSize 200% 200%.
const DISFRACES = [
  { nombre: 'parado', pos: '0% 0%' }, // (col0, fila0)
  { nombre: 'saltar', pos: '100% 0%' }, // (col1, fila0)
  { nombre: 'andar 1', pos: '0% 100%' }, // (col0, fila1)
  { nombre: 'andar 2', pos: '100% 100%' }, // (col1, fila1)
];
const ANDAR = [0, 2, 3]; // ciclo de caminar (como en el juego)

// Progreso guardado en el propio dispositivo (sin login): ids de retos conseguidos.
const LS_KEY = 'pikt_retos_conseguidos';
const cargarConseguidos = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export default function RetosEditor({ usuario = null, onExit }) {
  const blocklyDiv = useRef(null);
  const wsRef = useRef(null);
  const posRef = useRef({ x: 8, y: 10 });
  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const handlersRef = useRef({ start: [], key: {} });
  const askResolveRef = useRef(null);
  const keysDownRef = useRef(new Set()); // teclas/botones mantenidos (modo física)
  const rafRef = useRef(null); // bucle de física
  const wonRef = useRef(false);
  const cogidasRef = useRef(new Set()); // índices de estrellas recogidas
  const wrapperRef = useRef(null); // para pantalla completa

  const [retoIdx, setRetoIdx] = useState(0);
  const reto = RETOS[retoIdx];
  const [pos, setPos] = useState(reto.start);
  const [jump, setJump] = useState(0);
  const [disfraz, setDisfraz] = useState(0); // 0..3 (fotograma del sprite)
  const [bubble, setBubble] = useState({ text: '', show: false });
  const [ask, setAsk] = useState({ show: false, question: '', value: '' });
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [recogidas, setRecogidas] = useState(0); // nº de estrellas recogidas (re-render)
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(cargarConseguidos); // retos conseguidos (este dispositivo)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 820
  );
  const [isFs, setIsFs] = useState(false); // pantalla completa real (Fullscreen API)
  const [pseudoFs, setPseudoFs] = useState(false); // respaldo si la API falla
  const fullscreenOn = isFs || pseudoFs;

  // Marca un reto como conseguido: lo guarda en el dispositivo y, si hay sesión,
  // también en Firebase (para que el progreso siga al usuario en cualquier equipo).
  const marcarConseguido = useCallback(
    (id) => {
      setDone((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify([...next]));
        } catch {
          /* almacenamiento no disponible */
        }
        return next;
      });
      if (usuario?.uid) {
        setDoc(
          doc(db, 'retos_progreso', usuario.uid),
          {
            uid: usuario.uid,
            email: usuario.email || '',
            conseguidos: arrayUnion(id),
            fecha: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {
          /* sin conexión / permisos: queda guardado en local */
        });
      }
    },
    [usuario]
  );

  // Pantalla completa: saca el editor del marco de pikt.es y oculta la barra.
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        Promise.resolve(req.call(el)).catch(() => setPseudoFs(true));
      } else {
        setPseudoFs(true); // navegador sin Fullscreen API (algunos iOS)
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      setPseudoFs(false);
    }
  }, []);

  /* Inicializa Blockly */
  useEffect(() => {
    defineRetosBlocks();
    if (!blocklyDiv.current) return;
    const ws = Blockly.inject(blocklyDiv.current, {
      toolbox: TOOLBOX,
      renderer: 'zelos',
      grid: { spacing: 22, length: 3, colour: '#e5e7eb', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9 },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
    });
    wsRef.current = ws;
    try {
      Blockly.serialization.workspaces.load(
        { blocks: { languageVersion: 0, blocks: [{ type: 'reto_start', x: 40, y: 40 }] } },
        ws
      );
    } catch {
      /* ignore */
    }
    return () => {
      ws.dispose();
      wsRef.current = null;
    };
  }, []);

  // Detecta móvil/estrecho para apilar la vista y poder hacer scroll.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 820);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sincroniza el estado con la Fullscreen API (botón Esc, etc.).
  useEffect(() => {
    const onFs = () => {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFs(on);
      if (on) setPseudoFs(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, []);

  // Al cambiar el tamaño/diseño, Blockly debe recalcular su lienzo.
  useEffect(() => {
    const t = setTimeout(() => {
      if (wsRef.current) Blockly.svgResize(wsRef.current);
    }, 250);
    return () => clearTimeout(t);
  }, [isMobile, fullscreenOn]);

  // Si el usuario está registrado, sincroniza el progreso con Firebase:
  // fusiona lo de la nube con lo de este dispositivo (unión) y sube lo que falte.
  useEffect(() => {
    if (!usuario?.uid) return;
    let cancel = false;
    (async () => {
      try {
        const ref = doc(db, 'retos_progreso', usuario.uid);
        const snap = await getDoc(ref);
        const cloud = new Set((snap.exists() && snap.data().conseguidos) || []);
        const local = cargarConseguidos();
        const union = new Set([...cloud, ...local]);
        if (cancel) return;
        setDone(union);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify([...union]));
        } catch {
          /* sin almacenamiento local */
        }
        // Sube el progreso previo sin login (o crea el documento la 1ª vez).
        const faltan = [...local].filter((id) => !cloud.has(id));
        if (faltan.length || !snap.exists()) {
          await setDoc(
            ref,
            {
              uid: usuario.uid,
              email: usuario.email || '',
              conseguidos: [...union],
              fecha: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch {
        /* offline / permisos: seguimos con el progreso local */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [usuario?.uid, usuario?.email]);

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const checkWin = useCallback(() => {
    const p = posRef.current;
    const estrellas = estrellasDe(reto);
    estrellas.forEach((s, i) => {
      if (!cogidasRef.current.has(i) && Math.hypot(p.x - s.x, p.y - s.y) < 12) {
        cogidasRef.current.add(i);
        setRecogidas(cogidasRef.current.size);
      }
    });
    const todasCogidas = cogidasRef.current.size >= estrellas.length;
    if (todasCogidas && !wonRef.current && Math.hypot(p.x - reto.meta.x, p.y - reto.meta.y) < 12) {
      wonRef.current = true;
      setWon(true);
      setMsg('🎉 ¡Reto conseguido!');
      marcarConseguido(reto.id);
    }
  }, [reto, marcarConseguido]);

  const resetPi = useCallback(() => {
    cancelRef.current = true;
    activeRef.current = false;
    wonRef.current = false;
    cogidasRef.current = new Set();
    setRecogidas(0);
    handlersRef.current = { start: [], key: {} };
    keysDownRef.current.clear();
    cancelAnimationFrame(rafRef.current);
    posRef.current = { ...reto.start };
    setPos({ ...reto.start, facing: 1 });
    setJump(0);
    setDisfraz(0);
    setWon(false);
    setBubble({ text: '', show: false });
    setAsk({ show: false, question: '', value: '' });
    setMsg('');
  }, [reto.start]);

  const buildRuntime = () => ({
    respuesta: '',
    onStart: (fn) => handlersRef.current.start.push(fn),
    onKey: (k, fn) => {
      (handlersRef.current.key[k] = handlersRef.current.key[k] || []).push(fn);
    },
    tick: async () => {
      if (cancelRef.current) return false;
      await delay(60);
      return !cancelRef.current;
    },
    mover: async (dir) => {
      if (cancelRef.current) return;
      let { x, y } = posRef.current;
      if (dir === 'derecha') x = Math.min(100, x + STEP);
      else if (dir === 'izquierda') x = Math.max(0, x - STEP);
      else if (dir === 'arriba') y = Math.min(92, y + STEP);
      else if (dir === 'abajo') y = Math.max(4, y - STEP);
      posRef.current = { x, y };
      setPos({ x, y, facing: dir === 'izquierda' ? -1 : dir === 'derecha' ? 1 : posRef.current.facing || 1 });
      setDisfraz((d) => (d === 2 ? 3 : 2)); // alterna andar 1/2 (animación de paso)
      checkWin();
      await delay(360);
    },
    saltar: async () => {
      if (cancelRef.current) return;
      setJump(60);
      await delay(220);
      setJump(0);
      await delay(220);
    },
    irInicio: async () => {
      posRef.current = { ...reto.start };
      setPos({ ...reto.start });
      await delay(360);
    },
    mirar: async (dir) => {
      const f = dir === 'izquierda' ? -1 : 1;
      posRef.current.facing = f;
      setPos((p) => ({ ...p, facing: f }));
      await delay(100);
    },
    disfraz: async (n) => {
      setDisfraz(((Number(n) % 4) + 4) % 4);
      await delay(150);
    },
    siguienteDisfraz: async () => {
      setDisfraz((d) => (d + 1) % 4);
      await delay(150);
    },
    decir: async (txt, secs) => {
      if (cancelRef.current) return;
      setBubble({ text: String(txt), show: true });
      if (secs > 0) {
        await delay(secs * 1000);
        setBubble({ text: '', show: false });
      } else {
        await delay(350);
      }
    },
    preguntar: (q) =>
      new Promise((resolve) => {
        setAsk({ show: true, question: String(q), value: '' });
        askResolveRef.current = resolve;
      }),
    tocandoMeta: () => Math.hypot(posRef.current.x - reto.meta.x, posRef.current.y - reto.meta.y) < 12,
    tocandoBorde: () =>
      posRef.current.x <= 0 || posRef.current.x >= 100 || posRef.current.y <= 4 || posRef.current.y >= 92,
  });

  // Altura del suelo bajo una x (plataforma o null = hueco) en retos de física.
  const groundAt = useCallback(
    (x) => {
      const plats = reto.platforms;
      if (!plats) return reto.start.y;
      for (const pl of plats) if (x >= pl.x1 && x <= pl.x2) return pl.y;
      return null;
    },
    [reto.platforms, reto.start.y]
  );

  // Bucle de física estilo "Plataformas" (gravedad + carrera + salto).
  const startFisica = useCallback(() => {
    const step = () => {
      if (cancelRef.current || wonRef.current) return;
      const p = posRef.current;
      const keys = keysDownRef.current;
      if (keys.has('derecha')) { p.vx = RUN; p.facing = 1; }
      else if (keys.has('izquierda')) { p.vx = -RUN; p.facing = -1; }
      else p.vx *= 0.6;
      if ((keys.has('arriba') || keys.has('espacio')) && p.onGround) { p.vy = JUMP; p.onGround = false; }
      p.vy -= GRAV;
      p.x = Math.max(0, Math.min(100, p.x + p.vx));
      p.y = p.y + p.vy;
      const g = groundAt(p.x);
      if (g != null && p.y <= g && p.vy <= 0) { p.y = g; p.vy = 0; p.onGround = true; }
      else p.onGround = false;
      if (p.y < -10) {
        setMsg('¡Te caíste al hueco! Coge carrerilla y salta antes. 🔄');
        p.x = reto.start.x; p.y = reto.start.y; p.vx = 0; p.vy = 0; p.onGround = true;
      }
      setPos({ x: p.x, y: p.y, facing: p.facing });
      // Animación de disfraz: saltar en el aire, caminar al moverse, parado quieto.
      let nd;
      if (!p.onGround) nd = 1;
      else if (Math.abs(p.vx) > 0.3) {
        p.animT = ((p.animT || 0) + 1) % (ANDAR.length * 6);
        nd = ANDAR[Math.floor(p.animT / 6)];
      } else nd = 0;
      setDisfraz(nd);
      checkWin();
      if (wonRef.current) {
        setMsg('🎉 ¡Conseguido! Has cruzado como en plataformas.');
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [groundAt, reto.start.x, reto.start.y, checkWin]);

  const ejecutar = useCallback(() => {
    if (!wsRef.current) return;
    resetPi();
    cancelRef.current = false;
    activeRef.current = true;
    wonRef.current = false;
    setRunning(true);

    // Reto de física: control directo con teclas/d-pad (gravedad + salto).
    if (reto.fisica) {
      posRef.current = { x: reto.start.x, y: reto.start.y, vx: 0, vy: 0, onGround: true, facing: 1 };
      setPos({ x: reto.start.x, y: reto.start.y, facing: 1 });
      setMsg('Corre con ← → y salta con ↑ / espacio (teclado o d-pad). ¡Cruza el hueco!');
      startFisica();
      return;
    }

    setMsg('▶ En marcha (usa las teclas/botones si tu programa lo requiere).');
    try {
      const code = javascriptGenerator.workspaceToCode(wsRef.current);
      const R = buildRuntime();
      // eslint-disable-next-line no-new-func
      new Function('R', code)(R); // registra onStart/onKey
      Promise.all(handlersRef.current.start.map((fn) => fn().catch(() => {}))).then(() => {});
    } catch (e) {
      setMsg('Error: ' + e.message);
      setRunning(false);
    }
  }, [resetPi, reto.fisica, reto.start.x, reto.start.y, startFisica]);

  // Dispara los handlers de una tecla (teclado o botón en pantalla)
  const dispararTecla = useCallback((k) => {
    if (!activeRef.current || cancelRef.current) return;
    const fns = handlersRef.current.key[k];
    if (fns) fns.forEach((fn) => fn().catch(() => {}));
  }, []);

  // Botón d-pad pulsado/soltado (evento en el flanco + estado para la física).
  const btnDown = useCallback(
    (k) => {
      if (!keysDownRef.current.has(k)) dispararTecla(k);
      keysDownRef.current.add(k);
    },
    [dispararTecla]
  );
  const btnUp = useCallback((k) => keysDownRef.current.delete(k), []);

  // Teclado: dispara el evento en el flanco y mantiene el estado para la física.
  useEffect(() => {
    const map = { ArrowRight: 'derecha', ArrowLeft: 'izquierda', ArrowUp: 'arriba', ArrowDown: 'abajo', ' ': 'espacio' };
    const onKeyDown = (e) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      if (!keysDownRef.current.has(k)) dispararTecla(k); // solo al pulsar (no repetición)
      keysDownRef.current.add(k);
    };
    const onKeyUp = (e) => {
      const k = map[e.key];
      if (k) keysDownRef.current.delete(k);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispararTecla]);

  // Cancela el bucle de física al desmontar.
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const enviarRespuesta = () => {
    if (askResolveRef.current) {
      askResolveRef.current(ask.value);
      askResolveRef.current = null;
    }
    setAsk({ show: false, question: '', value: '' });
  };

  const cambiarReto = (idx) => {
    cancelRef.current = true;
    activeRef.current = false;
    setRetoIdx(idx);
    const r = RETOS[idx];
    posRef.current = { ...r.start };
    setPos({ ...r.start, facing: 1 });
    setDisfraz(0);
    cogidasRef.current = new Set();
    setRecogidas(0);
    setWon(false);
    setBubble({ text: '', show: false });
    setAsk({ show: false, question: '', value: '' });
    setMsg('');
  };

  const dirBtns = [
    { k: 'arriba', s: '▲', gc: '2 / 2' },
    { k: 'izquierda', s: '◀', gc: '1 / 3' },
    { k: 'abajo', s: '▼', gc: '2 / 3' },
    { k: 'derecha', s: '▶', gc: '3 / 3' },
  ];

  const mainStyle = isMobile
    ? { ...styles.main, flexDirection: 'column', overflowY: 'auto' }
    : styles.main;
  const blocklyStyle = isMobile
    ? { ...styles.blockly, flex: 'none', height: '50vh', minHeight: 300 }
    : styles.blockly;
  const sideStyle = isMobile
    ? { ...styles.side, width: '100%', borderLeft: 'none', borderTop: '1px solid #334155' }
    : styles.side;

  return (
    <div
      ref={wrapperRef}
      style={fullscreenOn ? { ...styles.wrapper, position: 'fixed', inset: 0, zIndex: 99999 } : styles.wrapper}
    >
      <header style={styles.header}>
        {onExit && !fullscreenOn && (
          <button onClick={onExit} style={styles.backBtn}>← Volver</button>
        )}
        <span style={{ fontSize: 24 }}>🎯</span>
        {!isMobile && <h2 style={styles.title}>Editor de retos</h2>}
        <div style={styles.headRight}>
          <span
            style={styles.progreso}
            title={usuario?.uid ? 'Progreso sincronizado en tu cuenta' : 'Progreso guardado en este dispositivo'}
          >
            ⭐ {done.size}/{RETOS.length} {usuario?.uid ? '☁️' : ''}
          </span>
          <button onClick={toggleFullscreen} style={styles.fsBtn}>
            {fullscreenOn ? '🗗 Salir' : '⛶ Pantalla completa'}
          </button>
          <select
            value={retoIdx}
            onChange={(e) => cambiarReto(Number(e.target.value))}
            style={styles.retoSelect}
          >
            {RETOS.map((r, i) => (
              <option key={r.id} value={i}>
                {done.has(r.id) ? '⭐ ' : ''}Reto {r.id}: {r.titulo}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div style={mainStyle}>
        <div ref={blocklyDiv} style={blocklyStyle} />

        <aside style={sideStyle}>
          <div style={styles.enunciado}>
            <b>🎯 {reto.titulo}{done.has(reto.id) ? ' ⭐' : ''}:</b> {reto.enunciado}
            <div style={styles.pista}>💡 {reto.pista}</div>
            {estrellasDe(reto).length > 0 && (
              <div style={styles.contador}>
                ⭐ {recogidas} / {estrellasDe(reto).length}
              </div>
            )}
          </div>

          <div style={styles.stage}>
            <div style={{ ...styles.goal, left: `${reto.meta.x}%`, bottom: `${reto.meta.y}%` }}>🏁</div>
            {estrellasDe(reto).map(
              (s, i) =>
                !cogidasRef.current.has(i) && (
                  <div key={i} style={{ ...styles.star, left: `${s.x}%`, bottom: `${s.y}%` }}>⭐</div>
                )
            )}
            {/* Suelo o plataformas (con hueco) */}
            {reto.platforms ? (
              reto.platforms.map((pl, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${pl.x1}%`,
                    width: `${pl.x2 - pl.x1}%`,
                    bottom: 0,
                    height: `${pl.y}%`,
                    background: '#15803d',
                    borderTop: '4px solid #22c55e',
                  }}
                />
              ))
            ) : (
              <div style={styles.floor} />
            )}
            <div style={{ ...styles.pi, left: `${pos.x}%`, bottom: `${pos.y}%`, transform: `translate(-50%, ${-jump}px)` }}>
              {bubble.show && <div style={styles.bubble}>{bubble.text}</div>}
              <div
                style={{
                  ...styles.piSprite,
                  backgroundImage: `url(${imgPi})`,
                  backgroundPosition: DISFRACES[disfraz].pos,
                  transform: `scaleX(${pos.facing || 1})`,
                }}
              />
            </div>
            {won && <div style={styles.winOverlay}>🎉 ¡Conseguido!</div>}
            {ask.show && (
              <div style={styles.askBar}>
                <span style={styles.askQ}>{ask.question}</span>
                <input
                  autoFocus
                  value={ask.value}
                  onChange={(e) => setAsk((a) => ({ ...a, value: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && enviarRespuesta()}
                  style={styles.askInput}
                />
                <button onClick={enviarRespuesta} style={styles.askBtn}>✔</button>
              </div>
            )}
          </div>

          <div style={styles.controls}>
            <button onClick={ejecutar} style={styles.runBtn}>▶ Probar</button>
            <button onClick={resetPi} style={styles.resetBtn}>🔄 Reiniciar</button>
          </div>

          {/* Botones de dirección en pantalla (disparan «al presionar tecla») */}
          <div style={styles.dpad}>
            {dirBtns.map((d) => (
              <button
                key={d.k}
                onMouseDown={() => btnDown(d.k)}
                onMouseUp={() => btnUp(d.k)}
                onMouseLeave={() => btnUp(d.k)}
                onTouchStart={(e) => { e.preventDefault(); btnDown(d.k); }}
                onTouchEnd={() => btnUp(d.k)}
                style={{ ...styles.dirBtn, gridColumn: d.gc.split(' / ')[0], gridRow: d.gc.split(' / ')[1] }}
                title={`Botón ${d.k}`}
              >
                {d.s}
              </button>
            ))}
            <button
              onMouseDown={() => btnDown('espacio')}
              onMouseUp={() => btnUp('espacio')}
              onMouseLeave={() => btnUp('espacio')}
              onTouchStart={(e) => { e.preventDefault(); btnDown('espacio'); }}
              onTouchEnd={() => btnUp('espacio')}
              style={styles.spaceBtn}
            >
              espacio
            </button>
          </div>

          {msg && <div style={{ ...styles.msg, color: won ? '#16a34a' : '#334155' }}>{msg}</div>}
        </aside>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: '#0f172a', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#1e293b', borderBottom: '1px solid #334155', flexWrap: 'wrap' },
  backBtn: { padding: '6px 12px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontWeight: 600, cursor: 'pointer' },
  title: { margin: 0, color: '#f1f5f9', fontSize: 17, fontWeight: 800 },
  headRight: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  progreso: { color: '#facc15', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' },
  fsBtn: { padding: '7px 10px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  retoSelect: { padding: '7px 10px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13, cursor: 'pointer', maxWidth: '60vw' },
  main: { display: 'flex', flex: 1, minHeight: 0 },
  blockly: { flex: 1, minWidth: 0, background: '#fff' },
  side: { width: 430, display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: '#0b1220', borderLeft: '1px solid #334155', overflow: 'auto' },
  enunciado: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#e2e8f0', fontSize: 13.5, lineHeight: 1.5 },
  pista: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  contador: { marginTop: 6, color: '#facc15', fontWeight: 800, fontSize: 13 },
  stage: { position: 'relative', height: 250, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(180deg, #7dd3fc 0%, #bae6fd 55%, #86efac 55%, #4ade80 100%)', border: '2px solid #334155' },
  floor: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, background: '#15803d' },
  goal: { position: 'absolute', transform: 'translateX(-50%)', fontSize: 36, lineHeight: 1 },
  star: { position: 'absolute', transform: 'translateX(-50%)', fontSize: 30, lineHeight: 1, filter: 'drop-shadow(0 0 6px #facc15)' },
  pi: { position: 'absolute', transition: 'left 0.35s ease, bottom 0.35s ease, transform 0.2s ease', width: 50, textAlign: 'center' },
  piImg: { width: 50, height: 50, objectFit: 'contain' },
  piSprite: { width: 54, height: 54, backgroundSize: '200% 200%', backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' },
  bubble: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#0f172a', border: '2px solid #334155', borderRadius: 10, padding: '4px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' },
  winOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.55)', fontSize: 28, fontWeight: 900, color: '#16a34a' },
  askBar: { position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex', gap: 6, background: 'rgba(15,23,42,0.92)', borderRadius: 10, padding: 8 },
  askQ: { color: '#e2e8f0', fontSize: 12.5, alignSelf: 'center', maxWidth: 140 },
  askInput: { flex: 1, borderRadius: 6, border: '1px solid #475569', padding: '6px 8px', fontSize: 13 },
  askBtn: { border: 'none', background: '#16a34a', color: '#fff', borderRadius: 6, padding: '0 12px', cursor: 'pointer', fontWeight: 800 },
  controls: { display: 'flex', gap: 10 },
  runBtn: { flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  resetBtn: { padding: '12px 16px', borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' },
  dpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 36px)', gap: 5, width: 150, alignSelf: 'center' },
  dirBtn: { border: 'none', borderRadius: 8, background: '#334155', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' },
  spaceBtn: { gridColumn: '1 / 4', gridRow: 1, border: 'none', borderRadius: 8, background: '#475569', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  msg: { background: '#f1f5f9', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontWeight: 600 },
};
