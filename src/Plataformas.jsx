import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── ASSETS ──────────────────────────────────────────────────────────────────
import pikatronImgSrc from './assets/pikatron-sprite.png';
import bg1Src from './assets/pantalla5.jpeg';
import bg2Src from './assets/pantalla2.jpeg';
import bg3Src from './assets/pantalla3.jpeg';
import bg4Src from './assets/pantalla4.jpeg';
import jumpSoundSrc    from './assets/jump.mp3';
import correctSoundSrc from './assets/sonidorespcorrecta.mp3';
import wrongSoundSrc   from './assets/wrong.mp3';

const safeAudio = src => { try { return new Audio(src); } catch(e) { return { play:()=>Promise.resolve(), currentTime:0 }; } };
const SFX = { jump: safeAudio(jumpSoundSrc), correct: safeAudio(correctSoundSrc), wrong: safeAudio(wrongSoundSrc) };
const playSound = t => { try { const a=SFX[t]; if(a){ a.currentTime=0; a.play().catch(()=>{}); } } catch(e){} };

// ═══════════════════════════════════════════════════════════════════════════════
//  LAYOUTS  — FÁCIL DE EDITAR
//
//  Nivel: 3200px ancho × 1200px alto  (Y=0=arriba, Y=1150=suelo)
//
//  PLATAFORMAS: { x, y, w }
//    Hay 5 alturas de referencia:
//      Suelo   y ≈ 1120–1150  (zona baja)
//      Baja    y ≈ 850–920
//      Media   y ≈ 620–680
//      Alta    y ≈ 380–440
//      Muy alta y ≈ 150–220
//
//  PREGUNTAS: { pi }   → índice en el array de plataformas
//    Los 4 bloques-respuesta flotan 130px POR ENCIMA del borde superior
//    de esa plataforma y son pequeños (70px ancho c/u).
//    El texto de la pregunta aparece 30px encima de los bloques.
// ═══════════════════════════════════════════════════════════════════════════════

const PLAT_H  = 16;   // grosor visual plataforma
const LEVEL_W = 3200;
const LEVEL_H = 1200;
const GROUND  = 1150; // y del suelo
const ANS_W   = 72;   // ancho de cada bloque-respuesta
const ANS_H   = 28;   // alto de cada bloque-respuesta
const ANS_GAP = 8;    // separación entre bloques
const ANS_ABOVE = 130; // px sobre la plataforma donde aparecen los bloques
// Total de los 4 bloques: 4*72 + 3*8 = 312px → caben en plataformas ≥320px

const ANS_COLORS = ['#e74c3c','#3498db','#9b59b6','#f39c12'];

const LAYOUTS = [
/* ── Layout 0 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W }, // [0]  suelo
    { x:  100, y:  1000,  w:  280  }, // [1]  baja
    { x:  450, y:  880,  w:  300  }, // [2]  baja
    { x:  820, y:  650,  w:  280  }, // [3]  media ← pregunta
    { x: 1150, y:  900,  w:  260  }, // [4]  baja
    { x: 1450, y:  660,  w:  320  }, // [5]  media ← pregunta
    { x: 1820, y:  420,  w:  300  }, // [6]  alta  ← pregunta
    { x: 2100, y:  660,  w:  280  }, // [7]  media
    { x: 2400, y:  420,  w:  280  }, // [8]  alta  ← pregunta
    { x: 2740, y:  200,  w:  380  }, // [9]  muy alta ← pregunta
    { x:  300, y:  650,  w:  240  }, // [10] media
    { x:  600, y:  420,  w:  260  }, // [11] alta
    { x: 1200, y:  420,  w:  240  }, // [12] alta
    { x: 2150, y:  200,  w:  240  }, // [13] muy alta
    { x: 2500, y:  660,  w:  240  }, // [14] media
  ],
  preguntas: [ { pi:3 }, { pi:5 }, { pi:6 }, { pi:8 }, { pi:9 } ],
},
/* ── Layout 1 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W }, // [0]
    { x:  150, y:  880,  w:  300  }, // [1]
    { x:  500, y:  650,  w:  300  }, // [2] ← pregunta
    { x:  850, y:  420,  w:  320  }, // [3] ← pregunta
    { x: 1200, y:  200,  w:  300  }, // [4] ← pregunta
    { x: 1550, y:  420,  w:  300  }, // [5] ← pregunta
    { x: 1900, y:  650,  w:  300  }, // [6]
    { x: 2250, y:  420,  w:  300  }, // [7]
    { x: 2600, y:  200,  w:  300  }, // [8] ← pregunta
    { x:  300, y:  420,  w:  240  }, // [9]
    { x:  680, y:  880,  w:  260  }, // [10]
    { x: 1050, y:  650,  w:  240  }, // [11]
    { x: 1400, y:  880,  w:  240  }, // [12]
    { x: 2050, y:  200,  w:  240  }, // [13]
    { x: 2430, y:  650,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:2 }, { pi:3 }, { pi:4 }, { pi:5 }, { pi:8 } ],
},
/* ── Layout 2 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:   80, y:  420,  w:  320  }, // [1] ← pregunta
    { x:  450, y:  650,  w:  280  }, // [2]
    { x:  780, y:  880,  w:  300  }, // [3]
    { x: 1100, y:  650,  w:  300  }, // [4] ← pregunta
    { x: 1430, y:  420,  w:  300  }, // [5] ← pregunta
    { x: 1760, y:  200,  w:  320  }, // [6] ← pregunta
    { x: 2100, y:  420,  w:  280  }, // [7]
    { x: 2420, y:  650,  w:  280  }, // [8]
    { x: 2750, y:  420,  w:  300  }, // [9] ← pregunta
    { x:  200, y:  650,  w:  240  }, // [10]
    { x:  600, y:  420,  w:  240  }, // [11]
    { x:  930, y:  200,  w:  260  }, // [12]
    { x: 2250, y:  200,  w:  240  }, // [13]
    { x: 2950, y:  650,  w:  200  }, // [14]
  ],
  preguntas: [ { pi:1 }, { pi:4 }, { pi:5 }, { pi:6 }, { pi:9 } ],
},
/* ── Layout 3 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:  100, y:  200,  w:  300  }, // [1] muy alta ← pregunta
    { x:  450, y:  420,  w:  280  }, // [2] alta
    { x:  780, y:  650,  w:  280  }, // [3] media ← pregunta
    { x: 1100, y:  880,  w:  280  }, // [4] baja
    { x: 1420, y:  650,  w:  300  }, // [5] media ← pregunta
    { x: 1760, y:  420,  w:  280  }, // [6] alta
    { x: 2080, y:  200,  w:  300  }, // [7] muy alta ← pregunta
    { x: 2400, y:  420,  w:  280  }, // [8] alta
    { x: 2730, y:  650,  w:  300  }, // [9] media ← pregunta
    { x:  280, y:  650,  w:  240  }, // [10]
    { x:  620, y:  880,  w:  240  }, // [11]
    { x:  950, y:  420,  w:  240  }, // [12]
    { x: 1600, y:  880,  w:  240  }, // [13]
    { x: 2250, y:  650,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:1 }, { pi:3 }, { pi:5 }, { pi:7 }, { pi:9 } ],
},
/* ── Layout 4 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:  120, y:  880,  w:  260  }, // [1]
    { x:  430, y:  650,  w:  300  }, // [2] ← pregunta
    { x:  780, y:  420,  w:  280  }, // [3]
    { x: 1080, y:  200,  w:  360  }, // [4] ← pregunta
    { x: 1480, y:  420,  w:  280  }, // [5]
    { x: 1800, y:  650,  w:  300  }, // [6] ← pregunta
    { x: 2140, y:  880,  w:  280  }, // [7]
    { x: 2460, y:  650,  w:  300  }, // [8] ← pregunta
    { x: 2800, y:  420,  w:  300  }, // [9] ← pregunta
    { x:  280, y:  420,  w:  240  }, // [10]
    { x:  630, y:  880,  w:  240  }, // [11]
    { x:  950, y:  650,  w:  240  }, // [12]
    { x: 1680, y:  200,  w:  240  }, // [13]
    { x: 2300, y:  200,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:2 }, { pi:4 }, { pi:6 }, { pi:8 }, { pi:9 } ],
},
/* ── Layout 5 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:  100, y:  650,  w:  320  }, // [1] ← pregunta
    { x:  470, y:  880,  w:  260  }, // [2]
    { x:  780, y:  650,  w:  280  }, // [3]
    { x: 1100, y:  420,  w:  320  }, // [4] ← pregunta
    { x: 1460, y:  200,  w:  340  }, // [5] ← pregunta
    { x: 1840, y:  420,  w:  280  }, // [6]
    { x: 2160, y:  650,  w:  300  }, // [7] ← pregunta
    { x: 2500, y:  420,  w:  280  }, // [8]
    { x: 2820, y:  200,  w:  320  }, // [9] ← pregunta
    { x:  300, y:  420,  w:  240  }, // [10]
    { x:  620, y:  200,  w:  240  }, // [11]
    { x:  950, y:  880,  w:  240  }, // [12]
    { x: 1700, y:  650,  w:  240  }, // [13]
    { x: 2350, y:  880,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:1 }, { pi:4 }, { pi:5 }, { pi:7 }, { pi:9 } ],
},
/* ── Layout 6 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:   80, y:  880,  w:  260  }, // [1]
    { x:  390, y:  650,  w:  280  }, // [2]
    { x:  720, y:  420,  w:  300  }, // [3] ← pregunta
    { x: 1060, y:  200,  w:  280  }, // [4] ← pregunta
    { x: 1380, y:  420,  w:  280  }, // [5]
    { x: 1700, y:  650,  w:  320  }, // [6] ← pregunta
    { x: 2060, y:  880,  w:  260  }, // [7]
    { x: 2360, y:  650,  w:  300  }, // [8] ← pregunta
    { x: 2700, y:  420,  w:  300  }, // [9] ← pregunta
    { x:  220, y:  420,  w:  240  }, // [10]
    { x:  550, y:  200,  w:  240  }, // [11]
    { x:  900, y:  650,  w:  240  }, // [12]
    { x: 1560, y:  200,  w:  240  }, // [13]
    { x: 2200, y:  420,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:3 }, { pi:4 }, { pi:6 }, { pi:8 }, { pi:9 } ],
},
/* ── Layout 7 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:  150, y:  200,  w:  320  }, // [1] ← pregunta
    { x:  520, y:  420,  w:  280  }, // [2]
    { x:  850, y:  650,  w:  280  }, // [3] ← pregunta
    { x: 1180, y:  880,  w:  280  }, // [4]
    { x: 1500, y:  650,  w:  300  }, // [5] ← pregunta
    { x: 1840, y:  420,  w:  280  }, // [6]
    { x: 2150, y:  200,  w:  320  }, // [7] ← pregunta
    { x: 2490, y:  420,  w:  280  }, // [8]
    { x: 2810, y:  650,  w:  320  }, // [9] ← pregunta
    { x:  350, y:  650,  w:  240  }, // [10]
    { x:  690, y:  880,  w:  240  }, // [11]
    { x: 1020, y:  420,  w:  240  }, // [12]
    { x: 1360, y:  200,  w:  240  }, // [13]
    { x: 2340, y:  650,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:1 }, { pi:3 }, { pi:5 }, { pi:7 }, { pi:9 } ],
},
/* ── Layout 8 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:  100, y:  880,  w:  260  }, // [1]
    { x:  410, y:  420,  w:  300  }, // [2] ← pregunta
    { x:  760, y:  200,  w:  280  }, // [3] ← pregunta
    { x: 1090, y:  420,  w:  260  }, // [4]
    { x: 1390, y:  650,  w:  300  }, // [5] ← pregunta
    { x: 1730, y:  880,  w:  260  }, // [6]
    { x: 2040, y:  650,  w:  300  }, // [7] ← pregunta
    { x: 2380, y:  420,  w:  280  }, // [8]
    { x: 2710, y:  200,  w:  320  }, // [9] ← pregunta
    { x:  240, y:  650,  w:  240  }, // [10]
    { x:  600, y:  650,  w:  240  }, // [11]
    { x:  940, y:  880,  w:  240  }, // [12]
    { x: 1560, y:  200,  w:  240  }, // [13]
    { x: 2240, y:  650,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:2 }, { pi:3 }, { pi:5 }, { pi:7 }, { pi:9 } ],
},
/* ── Layout 9 ─────────────────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:GROUND, w:LEVEL_W },
    { x:  120, y:  650,  w:  280  }, // [1] ← pregunta
    { x:  450, y:  420,  w:  280  }, // [2]
    { x:  770, y:  200,  w:  300  }, // [3] ← pregunta
    { x: 1110, y:  420,  w:  280  }, // [4]
    { x: 1430, y:  200,  w:  340  }, // [5] ← pregunta
    { x: 1810, y:  420,  w:  280  }, // [6]
    { x: 2120, y:  200,  w:  300  }, // [7] ← pregunta
    { x: 2450, y:  420,  w:  280  }, // [8]
    { x: 2780, y:  650,  w:  320  }, // [9] ← pregunta
    { x:  280, y:  880,  w:  240  }, // [10]
    { x:  620, y:  650,  w:  240  }, // [11]
    { x:  970, y:  880,  w:  240  }, // [12]
    { x: 1650, y:  650,  w:  240  }, // [13]
    { x: 2300, y:  650,  w:  240  }, // [14]
  ],
  preguntas: [ { pi:1 }, { pi:3 }, { pi:5 }, { pi:7 }, { pi:9 } ],
},
];

// ─── PREGUNTAS ────────────────────────────────────────────────────────────────
const MATERIAS = {
  INGLES: {
    label:'Inglés', emoji:'🇬🇧', color:'#0057a8',
    niveles: [
      [
        { q:'¿"Perro" en inglés?',   a:'Dog',    inc:['Cat','Bird','Cow'] },
        { q:'¿"Gato" en inglés?',    a:'Cat',    inc:['Dog','Mouse','Lion'] },
        { q:'¿"Rojo" en inglés?',    a:'Red',    inc:['Blue','Green','Yellow'] },
        { q:'¿"Pájaro" en inglés?',  a:'Bird',   inc:['Fish','Snake','Horse'] },
        { q:'¿"Azul" en inglés?',    a:'Blue',   inc:['Black','White','Red'] },
      ],
      [
        { q:'¿"Manzana" en inglés?', a:'Apple',  inc:['Banana','Orange','Grape'] },
        { q:'¿"Pan" en inglés?',     a:'Bread',  inc:['Meat','Water','Milk'] },
        { q:'¿"Leche" en inglés?',   a:'Milk',   inc:['Juice','Coffee','Tea'] },
        { q:'¿"Queso" en inglés?',   a:'Cheese', inc:['Butter','Egg','Rice'] },
        { q:'¿"Agua" en inglés?',    a:'Water',  inc:['Wine','Beer','Soda'] },
      ],
      [
        { q:'¿"Madre" en inglés?',   a:'Mother',      inc:['Father','Sister','Aunt'] },
        { q:'¿"Hermano" en inglés?', a:'Brother',     inc:['Sister','Uncle','Cousin'] },
        { q:'¿"Abuelo" en inglés?',  a:'Grandfather', inc:['Uncle','Father','Son'] },
        { q:'¿"Hija" en inglés?',    a:'Daughter',    inc:['Son','Niece','Aunt'] },
        { q:'¿"Tío" en inglés?',     a:'Uncle',       inc:['Aunt','Brother','Cousin'] },
      ],
      [
        { q:'¿"Comer" en inglés?',  a:'Eat',   inc:['Drink','Sleep','Run'] },
        { q:'¿"Jugar" en inglés?',  a:'Play',  inc:['Work','Study','Read'] },
        { q:'¿"Leer" en inglés?',   a:'Read',  inc:['Write','Listen','Speak'] },
        { q:'¿"Correr" en inglés?', a:'Run',   inc:['Walk','Jump','Sit'] },
        { q:'¿"Dormir" en inglés?', a:'Sleep', inc:['Wake','Dream','Rest'] },
      ],
    ],
  },
  MATES: {
    label:'Mates', emoji:'🔢', color:'#e67e22',
    niveles: [
      [
        { q:'7 + 5 = ?',      a:'12', inc:['11','13','10'] },
        { q:'15 + 8 = ?',     a:'23', inc:['22','24','25'] },
        { q:'9 + 9 = ?',      a:'18', inc:['16','17','19'] },
        { q:'20 + 15 = ?',    a:'35', inc:['30','40','25'] },
        { q:'14 + 7 = ?',     a:'21', inc:['20','22','19'] },
      ],
      [
        { q:'15 − 6 = ?',     a:'9',  inc:['8','10','7'] },
        { q:'20 − 12 = ?',    a:'8',  inc:['7','9','6'] },
        { q:'50 − 25 = ?',    a:'25', inc:['20','30','15'] },
        { q:'34 − 10 = ?',    a:'24', inc:['23','25','26'] },
        { q:'100 − 45 = ?',   a:'55', inc:['65','45','50'] },
      ],
      [
        { q:'6 × 7 = ?',      a:'42', inc:['48','36','49'] },
        { q:'8 × 5 = ?',      a:'40', inc:['45','35','50'] },
        { q:'9 × 9 = ?',      a:'81', inc:['72','90','80'] },
        { q:'4 × 12 = ?',     a:'48', inc:['44','46','52'] },
        { q:'7 × 8 = ?',      a:'56', inc:['64','48','54'] },
      ],
      [
        { q:'45 ÷ 5 = ?',     a:'9',  inc:['8','10','7'] },
        { q:'100 ÷ 10 = ?',   a:'10', inc:['100','1','0'] },
        { q:'36 ÷ 6 = ?',     a:'6',  inc:['5','7','8'] },
        { q:'2 + 3 × 4 = ?',  a:'14', inc:['20','24','10'] },
        { q:'20 ÷ 4 + 1 = ?', a:'6',  inc:['5','4','7'] },
      ],
    ],
  },
  FRANCES: {
    label:'Francés', emoji:'🇫🇷', color:'#8e44ad',
    niveles: [
      [
        { q:'"Hola" en francés',        a:'Bonjour',         inc:['Au revoir','Merci','Oui'] },
        { q:'"Gracias" en francés',     a:'Merci',           inc:["S'il vous plaît",'Pardon','Non'] },
        { q:'"Adiós" en francés',       a:'Au revoir',       inc:['Salut','À demain','Bonjour'] },
        { q:'"Sí" en francés',          a:'Oui',             inc:['Non','Peut-être','Bien'] },
        { q:'"Por favor" en francés',   a:"S'il vous plaît", inc:['Merci','De rien','Pardon'] },
      ],
      [
        { q:'"Perro" en francés',  a:'Chien',  inc:['Chat','Oiseau','Cheval'] },
        { q:'"Gato" en francés',   a:'Chat',   inc:['Souris','Lapin','Chien'] },
        { q:'"Casa" en francés',   a:'Maison', inc:['Voiture','École','Rue'] },
        { q:'"Coche" en francés',  a:'Voiture',inc:['Vélo','Train','Avion'] },
        { q:'"Libro" en francés',  a:'Livre',  inc:['Cahier','Stylo','Crayon'] },
      ],
      [
        { q:'"Madre" en francés',  a:'Mère',   inc:['Père','Soeur','Fille'] },
        { q:'"Padre" en francés',  a:'Père',   inc:['Frère','Fils','Mère'] },
        { q:'"Niño" en francés',   a:'Garçon', inc:['Fille','Homme','Femme'] },
        { q:'"Niña" en francés',   a:'Fille',  inc:['Garçon','Femme','Mère'] },
        { q:'"Amigo" en francés',  a:'Ami',    inc:['Ennemi','Frère','Père'] },
      ],
      [
        { q:'"Rojo" en francés',  a:'Rouge', inc:['Bleu','Vert','Jaune'] },
        { q:'"Negro" en francés', a:'Noir',  inc:['Blanc','Gris','Marron'] },
        { q:'"Uno" en francés',   a:'Un',    inc:['Deux','Trois','Quatre'] },
        { q:'"Cinco" en francés', a:'Cinq',  inc:['Six','Sept','Huit'] },
        { q:'"Diez" en francés',  a:'Dix',   inc:['Neuf','Onze','Douze'] },
      ],
    ],
  },
  GEOGRAFIA: {
    label:'Geografía', emoji:'🌍', color:'#27ae60',
    niveles: [
      [
        { q:'Capital de Francia',     a:'París',   inc:['Lyon','Marsella','Burdeos'] },
        { q:'Capital de Italia',       a:'Roma',    inc:['Milán','Venecia','Nápoles'] },
        { q:'Capital de Alemania',     a:'Berlín',  inc:['Múnich','Hamburgo','Frankfurt'] },
        { q:'Capital de Reino Unido',  a:'Londres', inc:['Manchester','Liverpool','Edimburgo'] },
        { q:'Capital de Portugal',     a:'Lisboa',  inc:['Oporto','Faro','Coímbra'] },
      ],
      [
        { q:'Río más largo del mundo', a:'Amazonas', inc:['Nilo','Yangtsé','Misisipi'] },
        { q:'Montaña más alta',        a:'Everest',  inc:['K2','Mont Blanc','Teide'] },
        { q:'Río de Egipto',           a:'Nilo',     inc:['Congo','Níger','Zambeze'] },
        { q:'Cordillera de S. América',a:'Los Andes',inc:['Himalaya','Alpes','Pirineos'] },
        { q:'Río de París',            a:'Sena',     inc:['Ródano','Loira','Rin'] },
      ],
      [
        { q:'País con forma de bota',    a:'Italia',    inc:['Grecia','México','Chile'] },
        { q:'País más grande del mundo', a:'Rusia',     inc:['Canadá','China','EEUU'] },
        { q:'País de los canguros',      a:'Australia', inc:['N. Zelanda','Sudáfrica','Brasil'] },
        { q:'País del Taj Mahal',        a:'India',     inc:['Pakistán','Turquía','Egipto'] },
        { q:'País del Monte Fuji',       a:'Japón',     inc:['Corea del Sur','China','Vietnam'] },
      ],
      [
        { q:'Océano más grande',         a:'Pacífico',  inc:['Atlántico','Índico','Ártico'] },
        { q:'Continente más poblado',    a:'Asia',      inc:['África','Europa','América'] },
        { q:'Océano Europa-América',     a:'Atlántico', inc:['Pacífico','Índico','Antártico'] },
        { q:'Continente del Sahara',     a:'África',    inc:['Asia','Oceanía','Europa'] },
        { q:'País más poblado',          a:'India',     inc:['China','EEUU','Indonesia'] },
      ],
    ],
  },
};

// ─── CONSTANTES FÍSICAS ───────────────────────────────────────────────────────
const CW = 800, CH = 450;     // tamaño del canvas (viewport)
const GRAVITY    = 0.58;
const JUMP_POWER = -14.5;
const MOVE_SPEED = 5.5;
const PLAYER_W   = 58, PLAYER_H = 58;
const CAM_DEAD_X = 0.38;   // el jugador está aquí en porcentaje horizontal
const CAM_DEAD_Y = 0.45;   // y aquí en porcentaje vertical
const BG_THEMES  = ['#0d2b1a','#0d1a3a','#2a0d0d','#111820'];
const GR_COLORS  = ['#3d8b2a','#2c3e50','#6b1e1e','#2a3a28'];

// ─── PANTALLA MENÚ ────────────────────────────────────────────────────────────
function PantallaMenu({ onEligir, onExit }) {
  return (
    <div style={{ minHeight:'100vh', background:'#1a1a2e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Arial,sans-serif' }}>
      <div style={{ fontSize:'2.8rem', marginBottom:4 }}>🎮</div>
      <h1 style={{ color:'#f1c40f', fontSize:'2rem', margin:'0 0 4px', textShadow:'2px 2px 0 #000' }}>Quiz Plataformas</h1>
      <p style={{ color:'rgba(255,255,255,0.5)', marginBottom:28, fontSize:'0.8rem', textAlign:'center', lineHeight:1.6, margin:'4px 0 28px' }}>
        Sube a las plataformas · golpea desde abajo el bloque correcto<br/>
        ✅ Acierto +1 · ❌ Error −1
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, maxWidth:440, width:'100%' }}>
        {Object.entries(MATERIAS).map(([id, m]) => (
          <button key={id} onClick={() => onEligir(id)}
            style={{ padding:'18px 12px', borderRadius:14, border:`3px solid ${m.color}`, background:`${m.color}18`, color:'white', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, fontFamily:'inherit', transition:'transform .15s' }}
            onMouseOver={e=>e.currentTarget.style.transform='scale(1.04)'}
            onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}
          >
            <span style={{ fontSize:'2.2rem' }}>{m.emoji}</span>
            <span style={{ fontWeight:'bold', fontSize:'1rem' }}>{m.label}</span>
            <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.45)' }}>4 niveles · 5 preguntas c/u</span>
          </button>
        ))}
      </div>
      {onExit && (
        <button onClick={onExit} style={{ marginTop:22, padding:'7px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.38)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem' }}>
          ← Salir
        </button>
      )}
    </div>
  );
}

function PantallaIntro({ materia, nivel, total, onStart, onBack }) {
  const m = MATERIAS[materia];
  return (
    <div style={{ minHeight:'100vh', background:'#1a1a2e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, fontFamily:'Arial,sans-serif' }}>
      <div style={{ fontSize:'3.5rem' }}>{m.emoji}</div>
      <h2 style={{ color:'white', fontSize:'1.4rem', margin:0 }}>{m.label}</h2>
      <div style={{ background:`${m.color}33`, border:`3px solid ${m.color}`, borderRadius:14, padding:'11px 30px', color:'white', fontSize:'1.2rem', fontWeight:'bold' }}>
        Nivel {nivel} de {total}
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'14px 20px', maxWidth:340, color:'rgba(255,255,255,0.8)', lineHeight:1.8, fontSize:'0.85rem', textAlign:'center' }}>
        🕹️ <strong>← →</strong> moverse · <strong>↑ / Espacio</strong> saltar<br/>
        Sube a las plataformas y <strong>golpea desde abajo</strong> el bloque con la respuesta correcta.<br/>
        Las 5 preguntas están repartidas por el nivel.
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onBack} style={{ padding:'8px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.18)', background:'transparent', color:'rgba(255,255,255,0.45)', cursor:'pointer', fontFamily:'inherit' }}>← Atrás</button>
        <button onClick={onStart} style={{ padding:'11px 34px', borderRadius:28, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 16px rgba(241,196,15,0.4)' }}>▶ ¡Empezar!</button>
      </div>
    </div>
  );
}

function PantallaFin({ materia, score, total, onReintentar, onSiguiente, onMenu, hayMas }) {
  const pct   = Math.round(Math.max(0,score)/Math.max(total,1)*100);
  const stars = pct>=80?'⭐⭐⭐':pct>=50?'⭐⭐':'⭐';
  return (
    <div style={{ minHeight:'100vh', background:'#1a1a2e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, fontFamily:'Arial,sans-serif' }}>
      <div style={{ fontSize:'3rem' }}>🏆</div>
      <h2 style={{ color:'white', margin:0 }}>¡Nivel completado!</h2>
      <div style={{ fontSize:'1.8rem' }}>{stars}</div>
      <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:14, padding:'16px 34px', textAlign:'center', color:'white' }}>
        <div style={{ fontSize:'2.6rem', fontWeight:'bold', color:'#f1c40f' }}>{Math.max(0,score)} / {total}</div>
        <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.4)', marginTop:4 }}>{pct}% aciertos</div>
      </div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
        {hayMas && (
          <button onClick={onSiguiente} style={{ padding:'10px 22px', borderRadius:20, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', cursor:'pointer', fontFamily:'inherit' }}>
            Siguiente nivel →
          </button>
        )}
        <button onClick={onReintentar} style={{ padding:'10px 18px', borderRadius:20, border:'none', background:'#3498db', color:'white', fontWeight:'bold', cursor:'pointer', fontFamily:'inherit' }}>🔄 Reintentar</button>
        <button onClick={onMenu} style={{ padding:'10px 18px', borderRadius:20, border:'2px solid rgba(255,255,255,0.2)', background:'transparent', color:'white', cursor:'pointer', fontFamily:'inherit' }}>🏠 Menú</button>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function QuizPlataformas({ onExit }) {
  const [fase,     setFase]     = useState('MENU');
  const [materia,  setMateria]  = useState(null);
  const [nivelIdx, setNivelIdx] = useState(0);
  const [score,    setScore]    = useState(0);
  const [feedUI,   setFeedUI]   = useState(null);
  const [totalQ,   setTotalQ]   = useState(5);

  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const spriteRef = useRef(null);
  const bgRefs    = useRef([]);
  const feedTimer = useRef(null);

  useEffect(() => {
    const s = new Image(); s.src = pikatronImgSrc; spriteRef.current = s;
    [bg1Src,bg2Src,bg3Src,bg4Src].forEach((src,i) => {
      const img = new Image(); img.src = src; bgRefs.current[i] = img;
    });
  }, []);

  // Estado del juego — todo por refs para el loop 60fps
  const g = useRef({
    player:    { x:100, y:GROUND-PLAYER_H, vx:0, vy:0, onGround:false, frameX:0, frameY:0, ft:0 },
    keys:      { left:false, right:false },
    camX:      0, camY:  0,
    platforms: [],
    ansBlocks: [],  // { x,y,w,h, text, isCorrect, color, hit, shakeT, stIdx, hitBounce }
    stations:  [],  // { cx, qY, qText, answered, idx }
    answered:  0,
    total:     0,
    bgX:       0,
    frame:     0,
  });

  // ── Construir nivel ──
  const buildLevel = useCallback((mat, niv, layoutIdx) => {
    const preguntas = [...MATERIAS[mat].niveles[niv]].sort(()=>Math.random()-.5);
    const lay       = LAYOUTS[layoutIdx % LAYOUTS.length];
    const plats     = lay.plataformas.map(p => ({ x:p.x, y:p.y, w:p.w, h:PLAT_H }));

    const stations  = [];
    const ansBlocks = [];

    lay.preguntas.forEach((qDef, qi) => {
      if (qi >= preguntas.length) return;
      const pq    = preguntas[qi];
      const plat  = plats[qDef.pi];
      if (!plat) return;

      const cx    = plat.x + plat.w / 2;
      const blockY = plat.y - ANS_ABOVE;

      // 4 bloques pequeños centrados sobre la plataforma
      const totalBW = 4 * ANS_W + 3 * ANS_GAP;
      const startX  = cx - totalBW / 2;

      const opciones = [
        { text: pq.a, isCorrect: true },
        { text: pq.inc[0], isCorrect: false },
        { text: pq.inc[1], isCorrect: false },
        { text: pq.inc[2], isCorrect: false },
      ].sort(()=>Math.random()-.5);

      opciones.forEach((op, bi) => {
        ansBlocks.push({
          x: startX + bi * (ANS_W + ANS_GAP),
          y: blockY,
          w: ANS_W, h: ANS_H,
          text: op.text, isCorrect: op.isCorrect,
          color: ANS_COLORS[bi],
          hit: false, shakeT: 0, stIdx: qi, hitBounce: false,
        });
      });

      // Texto de pregunta 28px por encima de los bloques
      stations.push({
        cx, qY: blockY - 28,
        qText: pq.q, answered: false, idx: qi,
      });
    });

    const ref = g.current;
    ref.platforms = plats;
    ref.ansBlocks = ansBlocks;
    ref.stations  = stations;
    ref.answered  = 0;
    ref.total     = stations.length;
    ref.bgX       = 0; ref.frame = 0;
    // Cámara inicial: centrada en el suelo
    ref.camX = 0; ref.camY = Math.max(0, GROUND - CH * 0.7);
    ref.player = { x:100, y:GROUND-PLAYER_H-2, vx:0, vy:0, onGround:false, frameX:0, frameY:0, ft:0 };
    ref.keys   = { left:false, right:false };

    setScore(0);
    setTotalQ(stations.length);
  }, []);

  const iniciar = (mat, niv) => {
    const layoutIdx = (niv * 2 + Object.keys(MATERIAS).indexOf(mat)) % LAYOUTS.length;
    buildLevel(mat, niv, layoutIdx);
    setFase('PLAYING');
  };

  // ── Game Loop ──
  useEffect(() => {
    if (fase !== 'PLAYING') { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width = CW; canvas.height = CH;
    const ctx   = canvas.getContext('2d');
    const bgImg = bgRefs.current[nivelIdx % 4];
    const sprite= spriteRef.current;
    const theme = GR_COLORS[nivelIdx % 4];

    const loop = () => {
      const ref = g.current;
      const p   = ref.player;
      ref.frame++;

      // ── Horizontal ──
      if (ref.keys.left)       p.vx = -MOVE_SPEED;
      else if (ref.keys.right) p.vx =  MOVE_SPEED;
      else                     p.vx *= 0.72;
      p.x = Math.max(0, Math.min(LEVEL_W - PLAYER_W, p.x + p.vx));

      // ── Vertical ──
      p.vy = Math.min(p.vy + GRAVITY, 22); // cap caída
      p.y += p.vy;
      p.onGround = false;

      for (const plat of ref.platforms) {
        const prevB = p.y - p.vy + PLAYER_H;
        const curB  = p.y + PLAYER_H;
        const overX = p.x + PLAYER_W - 6 > plat.x && p.x + 6 < plat.x + plat.w;
        if (overX && p.vy >= 0 && prevB <= plat.y + 4 && curB >= plat.y) {
          p.y = plat.y - PLAYER_H;
          p.vy = 0; p.onGround = true;
        }
      }

      // Si cae muy abajo, vuelve al suelo
      if (p.y > GROUND + 200) { p.y = GROUND - PLAYER_H; p.vy = 0; p.onGround = true; }

      // ── Cámara suave (X e Y) ──
      const targetCamX = p.x - CW * CAM_DEAD_X;
      const targetCamY = p.y - CH * CAM_DEAD_Y;
      ref.camX += (targetCamX - ref.camX) * 0.1;
      ref.camY += (targetCamY - ref.camY) * 0.1;
      ref.camX = Math.max(0, Math.min(LEVEL_W - CW, ref.camX));
      ref.camY = Math.max(0, Math.min(LEVEL_H - CH, ref.camY));

      // ── Golpe de bloques desde abajo ──
      for (const blk of ref.ansBlocks) {
        if (blk.hit) continue;
        const overX  = p.x + PLAYER_W - 10 > blk.x && p.x + 10 < blk.x + blk.w;
        const prevTop = p.y - p.vy;
        const hitBot  = overX && p.vy < 0
                        && prevTop >= blk.y + blk.h - 6
                        && p.y     <= blk.y + blk.h + 10;

        if (hitBot) {
          p.vy = 5; // rebote hacia abajo
          const si = blk.stIdx;
          if (ref.stations[si]?.answered) continue;

          // Marcar toda la estación
          blk.hit = true; blk.shakeT = 16;
          ref.stations[si].answered = true;
          ref.ansBlocks.forEach(b => { if (b.stIdx === si) { b.hit = true; b.shakeT = 12; } });
          ref.answered++;

          const ok = blk.isCorrect;
          if (ok) {
            playSound('correct');
            setScore(s => s + 1);
            setFeedUI({ text:'✅ ¡Correcto!', ok:true });
          } else {
            playSound('wrong');
            setScore(s => Math.max(0, s - 1));
            const corr = ref.ansBlocks.find(b => b.stIdx === si && b.isCorrect);
            setFeedUI({ text:`❌ Era: ${corr?.text || '?'}`, ok:false });
          }
          if (feedTimer.current) clearTimeout(feedTimer.current);
          feedTimer.current = setTimeout(() => setFeedUI(null), 1700);

          if (ref.answered >= ref.total) {
            setTimeout(() => setFase('FIN'), 1300);
          }
        }
      }

      // Animación sprite
      p.ft++;
      if (p.ft % 7 === 0) {
        if (!p.onGround) { p.frameX=1; p.frameY=0; }
        else {
          const fr=[[0,0],[0,1],[1,1]];
          const s=Math.floor(p.ft/7)%3;
          p.frameX=fr[s][0]; p.frameY=fr[s][1];
        }
      }

      // ═══════════════ DIBUJO ═══════════════
      ctx.clearRect(0,0,CW,CH);
      const cx = Math.round(ref.camX), cy = Math.round(ref.camY);

      // Fondo parallax lento
      ref.bgX -= 0.3;
      if (ref.bgX <= -CW) ref.bgX = 0;
      if (bgImg?.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, ref.bgX, 0, CW, CH);
        ctx.drawImage(bgImg, ref.bgX + CW, 0, CW, CH);
      } else {
        const grd = ctx.createLinearGradient(0,0,0,CH);
        grd.addColorStop(0, BG_THEMES[nivelIdx%4]);
        grd.addColorStop(1,'#000015');
        ctx.fillStyle=grd; ctx.fillRect(0,0,CW,CH);
      }
      ctx.fillStyle='rgba(0,0,0,0.42)'; ctx.fillRect(0,0,CW,CH);

      // ─ Plataformas ─
      for (const plat of ref.platforms) {
        const sx = plat.x - cx, sy = plat.y - cy;
        if (sx > CW+60 || sx+plat.w < -60 || sy > CH+20 || sy+plat.h < -20) continue;

        ctx.fillStyle='rgba(0,0,0,0.28)';
        ctx.fillRect(sx+4, sy+5, plat.w, plat.h);

        ctx.fillStyle = theme;
        ctx.fillRect(sx, sy, plat.w, plat.h);

        ctx.fillStyle='rgba(255,255,255,0.22)';
        ctx.fillRect(sx, sy, plat.w, 4);

        ctx.fillStyle='rgba(0,0,0,0.28)';
        ctx.fillRect(sx, sy+plat.h-3, plat.w, 3);
      }

      // ─ Textos de pregunta ─
      for (const st of ref.stations) {
        if (st.answered) continue;
        const sx = st.cx - cx, sy = st.qY - cy;
        if (sx < -300 || sx > CW+300 || sy < -40 || sy > CH+40) continue;

        ctx.save();
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(st.qText).width;
        const bw = Math.min(tw+20, CW-20), bh = 20;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        rr(ctx, sx-bw/2, sy-bh/2, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5;
        rr(ctx, sx-bw/2, sy-bh/2, bw, bh, 5); ctx.stroke();

        ctx.fillStyle = '#f1c40f';
        let disp = st.qText;
        while (ctx.measureText(disp).width+20 > CW-20 && disp.length>5) disp=disp.slice(0,-1);
        if (disp !== st.qText) disp += '…';
        ctx.fillText(disp, sx, sy);
        ctx.restore();
      }

      // ─ Bloques de respuesta ─
      for (const blk of ref.ansBlocks) {
        const sx = blk.x - cx;
        const shake = blk.shakeT > 0 ? Math.sin(blk.shakeT*2)*3 : 0;
        if (blk.shakeT > 0) blk.shakeT--;
        const sy = blk.y - cy + shake;
        if (sx > CW+60 || sx+blk.w < -60 || sy > CH+20 || sy < -30) continue;

        ctx.globalAlpha = blk.hit ? 0.22 : 1;

        ctx.fillStyle='rgba(0,0,0,0.25)';
        ctx.fillRect(sx+3, sy+4, blk.w, blk.h);

        ctx.fillStyle = blk.color;
        rr(ctx, sx, sy, blk.w, blk.h, 6); ctx.fill();

        ctx.fillStyle='rgba(255,255,255,0.25)';
        ctx.fillRect(sx+2, sy+2, blk.w-4, 4);

        ctx.fillStyle='white';
        ctx.font = `bold ${blk.text.length>9?9:11}px Arial`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        let t=blk.text; if(t.length>11) t=t.slice(0,10)+'…';
        ctx.fillText(t, sx+blk.w/2, sy+blk.h/2);

        ctx.globalAlpha=1;
      }

      // ─ Flechitas pulsantes ─
      const pulse = 0.5 + 0.5*Math.sin(ref.frame*0.1);
      for (const st of ref.stations) {
        if (st.answered) continue;
        ref.ansBlocks.filter(b=>b.stIdx===st.idx).forEach(blk => {
          const sx = blk.x - cx + blk.w/2;
          const sy = blk.y - cy + blk.h + 10;
          if (sx < -10 || sx > CW+10 || sy < -10 || sy > CH+10) return;
          ctx.globalAlpha = pulse * 0.7;
          ctx.fillStyle = blk.color;
          ctx.font='8px Arial'; ctx.textAlign='center';
          ctx.fillText('▲', sx, sy);
          ctx.globalAlpha=1;
        });
      }

      // ─ Jugador ─
      const px = p.x - cx, py = p.y - cy;
      const sw = sprite?.complete && sprite.naturalWidth > 0;
      if (sw) {
        const fw=sprite.width/2, fh=sprite.height/2;
        ctx.drawImage(sprite, p.frameX*fw, p.frameY*fh, fw, fh, px, py, PLAYER_W, PLAYER_H);
      } else {
        ctx.fillStyle='#c0392b'; ctx.fillRect(px+6,py,PLAYER_W-12,PLAYER_H-14);
        ctx.fillStyle='#f1c40f'; ctx.fillRect(px+11,py+8,11,8); ctx.fillRect(px+34,py+8,11,8);
        ctx.fillStyle='#c0392b'; ctx.fillRect(px+8,py+PLAYER_H-13,13,13); ctx.fillRect(px+35,py+PLAYER_H-13,13,13);
      }

      // ─ Mini mapa progreso ─
      const tot = ref.stations.length;
      const mw  = tot*20, mx0 = CW/2-mw/2;
      for (let i=0;i<tot;i++) {
        ctx.fillStyle = ref.stations[i].answered ? '#2ecc71' : 'rgba(255,255,255,0.18)';
        rr(ctx, mx0+i*20, 6, 16, 9, 3); ctx.fill();
        if (ref.stations[i].answered) {
          ctx.fillStyle='#fff'; ctx.font='7px Arial'; ctx.textAlign='center';
          ctx.fillText('✓', mx0+i*20+8, 13);
        }
      }

      // ─ Flecha de dirección hacia la estación más cercana ─
      const pendientes = ref.stations.filter(s=>!s.answered);
      if (pendientes.length > 0) {
        const worldX = p.x + PLAYER_W/2;
        const worldY = p.y + PLAYER_H/2;
        const nearest = pendientes.reduce((a,b)=>{
          const da = Math.hypot(a.cx-worldX, (a.qY+30)-worldY);
          const db = Math.hypot(b.cx-worldX, (b.qY+30)-worldY);
          return da<db?a:b;
        });
        const dx = nearest.cx - worldX, dy = nearest.qY - worldY;
        const dist = Math.hypot(dx, dy);
        if (dist > 300) {
          const angle = Math.atan2(dy, dx);
          const ax = CW/2 + Math.cos(angle)*180;
          const ay = CH/2 + Math.sin(angle)*130;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(angle);
          ctx.fillStyle='rgba(241,196,15,0.85)';
          ctx.beginPath();
          ctx.moveTo(16,0); ctx.lineTo(-8,7); ctx.lineTo(-8,-7); ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fase, nivelIdx]);

  // ── Controles teclado ──
  useEffect(() => {
    if (fase !== 'PLAYING') return;
    const kd = e => {
      const ref = g.current;
      if (e.key==='ArrowRight'||e.key==='d') { e.preventDefault(); ref.keys.right=true; }
      if (e.key==='ArrowLeft' ||e.key==='a') { e.preventDefault(); ref.keys.left=true; }
      if ((e.key==='ArrowUp'||e.key==='w'||e.key===' ') && ref.player.onGround) {
        e.preventDefault();
        ref.player.vy = JUMP_POWER; ref.player.onGround=false;
        playSound('jump');
      }
    };
    const ku = e => {
      const ref = g.current;
      if (e.key==='ArrowRight'||e.key==='d') ref.keys.right=false;
      if (e.key==='ArrowLeft' ||e.key==='a') ref.keys.left=false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => { window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  }, [fase]);

  // ── Controles táctiles ──
  const setKey = (k, v) => { g.current.keys[k]=v; };
  const doJump = () => {
    const ref = g.current;
    if (ref.player.onGround) { ref.player.vy=JUMP_POWER; ref.player.onGround=false; playSound('jump'); }
  };

  // ─ RENDER ─
  if (fase==='MENU')
    return <PantallaMenu onEligir={m=>{ setMateria(m); setNivelIdx(0); setFase('INTRO'); }} onExit={onExit}/>;

  if (fase==='INTRO')
    return <PantallaIntro materia={materia} nivel={nivelIdx+1} total={4}
             onStart={()=>iniciar(materia, nivelIdx)} onBack={()=>setFase('MENU')}/>;

  if (fase==='FIN')
    return <PantallaFin
             materia={materia} score={score} total={totalQ}
             hayMas={nivelIdx+1<4}
             onSiguiente={()=>{ setNivelIdx(nivelIdx+1); setFase('INTRO'); }}
             onReintentar={()=>setFase('INTRO')}
             onMenu={()=>setFase('MENU')}/>;

  // PLAYING
  const mat = MATERIAS[materia];
  return (
    <div style={{ width:'100%', minHeight:'100vh', background:'#0a0a0a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', userSelect:'none', WebkitUserSelect:'none' }}>

      {/* HUD */}
      <div style={{ width:'100%', maxWidth:CW, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 10px', boxSizing:'border-box' }}>
        <button onClick={()=>setFase('MENU')} style={{ padding:'3px 10px', borderRadius:18, border:'1.5px solid rgba(255,255,255,0.14)', background:'transparent', color:'rgba(255,255,255,0.38)', cursor:'pointer', fontSize:'0.74rem', fontFamily:'inherit' }}>← Menú</button>
        <span style={{ color:'rgba(255,255,255,0.48)', fontSize:'0.76rem' }}>{mat.emoji} {mat.label} · Nivel {nivelIdx+1}</span>
        <span style={{ background:'#f1c40f', color:'#1a1a2e', padding:'2px 10px', borderRadius:18, fontWeight:'bold', fontSize:'0.86rem' }}>⭐ {Math.max(0,score)}</span>
      </div>

      {/* Canvas */}
      <div style={{ position:'relative', touchAction:'none' }}>
        <canvas ref={canvasRef} style={{ display:'block', maxWidth:'100%', borderRadius:8, boxShadow:'0 0 36px rgba(0,0,0,0.7)', border:'2px solid #1a1a1a', touchAction:'none' }}/>
        {feedUI && (
          <div style={{
            position:'absolute', top:'36%', left:'50%', transform:'translate(-50%,-50%)',
            background: feedUI.ok ? 'rgba(39,174,96,0.93)' : 'rgba(192,57,43,0.93)',
            color:'white', padding:'10px 22px', borderRadius:12, fontSize:'1.05rem',
            fontWeight:'bold', fontFamily:'Arial', pointerEvents:'none', whiteSpace:'nowrap',
            boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
          }}>{feedUI.text}</div>
        )}
      </div>

      {/* Controles móvil */}
      <div style={{ display:'flex', gap:0, marginTop:10, alignItems:'center', justifyContent:'center', width:'100%', maxWidth:CW, padding:'0 8px', boxSizing:'border-box' }}>
        {/* Botones izq/der */}
        <div style={{ display:'flex', gap:6, flex:1 }}>
          <MBtn label="◀" onDown={()=>setKey('left',true)} onUp={()=>setKey('left',false)} />
          <MBtn label="▶" onDown={()=>setKey('right',true)} onUp={()=>setKey('right',false)} />
        </div>
        {/* Botón saltar */}
        <div style={{ flex:1, display:'flex', justifyContent:'flex-end' }}>
          <MBtn label="▲ SALTAR" onDown={doJump} onUp={()=>{}} big accent />
        </div>
      </div>

      <div style={{ color:'rgba(255,255,255,0.18)', fontSize:'0.64rem', marginTop:5 }}>
        ← → moverse · ↑ / Espacio saltar · golpea los bloques desde abajo
      </div>
    </div>
  );
}

// ─── Botón móvil ──────────────────────────────────────────────────────────────
function MBtn({ label, onDown, onUp, big=false, accent=false }) {
  return (
    <button
      onTouchStart={e=>{ e.preventDefault(); onDown(); }}
      onTouchEnd={e=>{ e.preventDefault(); onUp(); }}
      onTouchCancel={e=>{ e.preventDefault(); onUp(); }}
      onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp}
      style={{
        width:big?120:58, height:50, borderRadius:10, border:'none',
        background: accent ? '#f1c40f' : '#2c3e50',
        color: accent ? '#1a1a2e' : 'white',
        fontWeight:'bold', fontSize:big?'0.85rem':'1.3rem',
        cursor:'pointer', userSelect:'none', WebkitUserSelect:'none',
        fontFamily:'Arial', boxShadow:'0 3px 10px rgba(0,0,0,0.4)',
        touchAction:'none',
      }}
    >{label}</button>
  );
}

// ─── roundRect helper ─────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r=5) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
