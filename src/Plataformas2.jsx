import React, { useEffect, useRef, useState, useCallback } from 'react';

import pikatronImgSrc  from './assets/pikatron-sprite.png';
// ── Imagen del enemigo: cambia esta ruta por la de tu personaje enemigo ──
import enemyImgSrc     from './assets/pikatron-sprite.png';
import bg1Src from './assets/pantalla5.jpeg';
import bg2Src from './assets/pantalla2.jpeg';
import bg3Src from './assets/pantalla3.jpeg';
import bg4Src from './assets/pantalla4.jpeg';
import jumpSoundSrc    from './assets/jump.mp3';
import correctSoundSrc from './assets/sonidorespcorrecta.mp3';
import wrongSoundSrc   from './assets/wrong.mp3';

const sa = src => { try { return new Audio(src); } catch(e){ return {play:()=>Promise.resolve(),currentTime:0}; } };
const SFX = { jump:sa(jumpSoundSrc), correct:sa(correctSoundSrc), wrong:sa(wrongSoundSrc) };
const snd = t => { try{ const a=SFX[t];if(a){a.currentTime=0;a.play().catch(()=>{});} }catch(e){} };

// ══════════════════════════════════════════════════════════════════════════════
//  FÍSICA
// ══════════════════════════════════════════════════════════════════════════════
const JUMP_POWER = -14.5;
const GRAVITY    = 0.58;
const MOVE_SPEED = 5.5;
const PLAYER_W   = 58, PLAYER_H = 58;
const COYOTE_F   = 8;
const JBUF_F     = 8;

// ══════════════════════════════════════════════════════════════════════════════
//  NIVEL
// ══════════════════════════════════════════════════════════════════════════════
const PLAT_H   = 16;
const LEVEL_W  = 2800;
const LEVEL_H  = 900;
const GROUND   = 820;
const CW = 800, CH = 450;
// Margen de seguridad en bordes del nivel (las plataformas no llegan hasta aquí)
const EDGE_MARGIN = 80;

// Bloques de respuesta ocupan exactamente el 60% del ancho de su plataforma
const ANS_GAP  = 14;
const ANS_H    = 26;
const ANS_ABOVE = 115;  // px sobre la plataforma (separación respecto al tope)
// Para que no roce: el jugador (58px) sube 115-58=57px ENCIMA de la plataforma antes de rozar los bloques
// La separación real entre el tope de la plataforma y los bloques es ANS_ABOVE - ANS_H = 89px → espacio de sobra

function getAnsLayout(platW) {
  const blockW = Math.max(32, Math.floor((platW * 0.60 - 3 * ANS_GAP) / 4));
  const totalW = 4 * blockW + 3 * ANS_GAP;
  return { blockW, totalW };
}

const ANS_COLORS = ['#e74c3c','#3498db','#9b59b6','#f39c12'];

// Moneda
const COIN_R = 9;
const COIN_COLOR = '#f1c40f';

// Enemigo
const ENEMY_W = 44, ENEMY_H = 44;
const ENEMY_SPEED = 1.4;
// Tiempo de invulnerabilidad tras tocar un enemigo (frames)
const ENEMY_INVUL_F = 90;

// ══════════════════════════════════════════════════════════════════════════════
//  ALTURAS DE REFERENCIA (pasos de 130px, siempre alcanzables entre adyacentes)
//  suelo:820  baja:690  media:560  alta:430  cima:300
// ══════════════════════════════════════════════════════════════════════════════
const Y = { suelo:GROUND, baja:690, media:560, alta:430, cima:300 };

// ══════════════════════════════════════════════════════════════════════════════
//  LAYOUTS
//  Reglas de diseño:
//    • Nunca subir más de 130px en un salto (H_max_segura = 154px con margen)
//    • Gap horizontal máximo al mismo nivel: 230px
//    • Gap horizontal máximo subiendo 130px: 190px
//    • Plataformas en la misma línea vertical (mismo Y) separadas ≥ 90px o = 0
//    • Última plataforma: x + w ≤ LEVEL_W - EDGE_MARGIN (= 2720)
//    • El suelo [0] siempre está y nunca lleva ni preguntas ni enemigos ni monedas
// ══════════════════════════════════════════════════════════════════════════════
const LAYOUTS = [

/* ── Layout 0: Escalera suave ────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W }, // [0] suelo
    { x:   80, y:Y.baja,  w:300 },     // [1]
    { x:  430, y:Y.baja,  w:300 },     // [2]  gap=50 ✓
    { x:  240, y:Y.media, w:320 },     // [3]  desde [1]: solapan+130 ✓
    { x:  600, y:Y.media, w:300 },     // [4]  gap [3]→[4]=40 ✓
    { x:  940, y:Y.media, w:300 },     // [5]  gap=40 ✓
    { x:  420, y:Y.alta,  w:320 },     // [6]  desde [3] solapan+130 ✓
    { x:  780, y:Y.alta,  w:300 },     // [7]  gap [6]→[7]=40 ✓
    { x: 1130, y:Y.alta,  w:300 },     // [8]  gap=50 ✓
    { x:  650, y:Y.cima,  w:340 },     // [9]  desde [6]+130: 650-(420+320)=−90 solapan ✓
    { x: 1040, y:Y.cima,  w:320 },     // [10] gap=50 ✓
    { x: 1420, y:Y.cima,  w:320 },     // [11] gap=60 ✓
    { x: 1790, y:Y.alta,  w:300 },     // [12] bajando −130 ✓
    { x: 2140, y:Y.media, w:300 },     // [13] bajando −130 ✓
    { x: 2490, y:Y.baja,  w:230 },     // [14] bajando −130, x+w=2720 ✓
  ],
  preguntas: [ {pi:6}, {pi:9}, {pi:10}, {pi:11}, {pi:13} ],
},

/* ── Layout 1: Pirámide ──────────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:280 },     // [1]
    { x:  410, y:Y.media, w:300 },     // [2]  +130 ✓
    { x:  760, y:Y.alta,  w:320 },     // [3]  +130 ✓
    { x: 1130, y:Y.cima,  w:340 },     // [4]  +130 ✓
    { x: 1520, y:Y.alta,  w:300 },     // [5]  −130 ✓
    { x: 1870, y:Y.media, w:300 },     // [6]  −130 ✓
    { x: 2220, y:Y.baja,  w:280 },     // [7]  −130 ✓
    { x:  230, y:Y.media, w:280 },     // [8]  desde [1] solapan+media ✓
    { x:  570, y:Y.cima,  w:300 },     // [9]  desde [2]→[9]: +260 → PROHIBIDO
    // Corrección: [9] en alta, no cima
    { x:  570, y:Y.alta,  w:300 },     // [9]  desde [2] +130 ✓
    { x: 1320, y:Y.alta,  w:280 },     // [10] desde [4] bajando ✓
    { x: 1680, y:Y.cima,  w:280 },     // [11] desde [5] +130 ✓
    { x: 2050, y:Y.alta,  w:280 },     // [12]
    { x: 2380, y:Y.media, w:280 },     // [13] x+w=2660 ✓
    { x:  930, y:Y.baja,  w:280 },     // [14]
  ],
  preguntas: [ {pi:3}, {pi:4}, {pi:9}, {pi:11}, {pi:6} ],
},

/* ── Layout 2: Camino en Z ───────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:300 },     // [1]
    { x:  100, y:Y.media, w:300 },     // [2]  desde [1] solapan+130 ✓
    { x:  440, y:Y.media, w:300 },     // [3]  gap=40 ✓
    { x:  780, y:Y.media, w:300 },     // [4]  gap=40 ✓
    { x:  120, y:Y.alta,  w:300 },     // [5]  desde [2] solapan+130 ✓
    { x:  460, y:Y.alta,  w:300 },     // [6]  gap=40 ✓
    { x:  800, y:Y.alta,  w:320 },     // [7]  gap=40 ✓
    { x:  140, y:Y.cima,  w:320 },     // [8]  desde [5] solapan+130 ✓
    { x:  510, y:Y.cima,  w:320 },     // [9]  gap=50 ✓
    { x:  880, y:Y.cima,  w:320 },     // [10] gap=50 ✓
    { x: 1250, y:Y.cima,  w:320 },     // [11] gap=50 ✓
    { x: 1620, y:Y.alta,  w:300 },     // [12] bajando ✓
    { x: 1970, y:Y.media, w:300 },     // [13] bajando ✓
    { x: 2320, y:Y.baja,  w:280 },     // [14] x+w=2600 ✓
  ],
  preguntas: [ {pi:5}, {pi:8}, {pi:10}, {pi:11}, {pi:13} ],
},

/* ── Layout 3: Doble espiral ─────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:280 },
    { x:  400, y:Y.baja,  w:280 },     // [2]  gap=40 ✓
    { x:  720, y:Y.baja,  w:280 },     // [3]  gap=40 ✓
    { x:  240, y:Y.media, w:300 },     // [4]  desde [1]+baja solapan+media ✓
    { x:  560, y:Y.media, w:300 },     // [5]  gap=20 ✓
    { x:  880, y:Y.media, w:300 },     // [6]  gap=20 ✓
    { x:  390, y:Y.alta,  w:320 },     // [7]  desde [4] solapan+alta ✓
    { x:  760, y:Y.alta,  w:300 },     // [8]  gap=50 ✓
    { x: 1120, y:Y.alta,  w:300 },     // [9]  gap=60 ✓
    { x:  560, y:Y.cima,  w:340 },     // [10] desde [7]+cima ✓  gap: 560-(390+320)=−150 solapan ✓
    { x:  960, y:Y.cima,  w:320 },     // [11] gap=60 ✓
    { x: 1340, y:Y.cima,  w:320 },     // [12] gap=60 ✓
    { x: 1710, y:Y.alta,  w:300 },     // [13] bajando ✓
    { x: 2070, y:Y.baja,  w:280 },     // [14] bajando −260? media inter...
    // Fix: [14] en media, no baja directa
    { x: 2060, y:Y.media, w:280 },     // [14] x+w=2340 ✓
  ],
  preguntas: [ {pi:7}, {pi:10}, {pi:11}, {pi:12}, {pi:4} ],
},

/* ── Layout 4: Torres alternadas ────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:280 },
    { x:  400, y:Y.media, w:300 },     // [2] +130 ✓
    { x:  740, y:Y.alta,  w:320 },     // [3] +130 ✓
    { x: 1110, y:Y.cima,  w:340 },     // [4] +130 ✓
    { x: 1500, y:Y.alta,  w:300 },     // [5] −130 ✓
    { x: 1850, y:Y.media, w:300 },     // [6] −130 ✓
    { x: 2200, y:Y.baja,  w:280 },     // [7] −130 ✓
    { x:  240, y:Y.alta,  w:280 },     // [8] desde [1] necesita media inter → cambia a media
    { x:  240, y:Y.media, w:280 },     // [8] desde [1]+130 ✓  gap: 240-(80+280)=−120 solapan ✓
    { x:  590, y:Y.alta,  w:280 },     // [9] desde [8]+130 ✓  gap=70 ✓
    { x:  920, y:Y.cima,  w:320 },     // [10] desde [9]+130 ✓  gap=50 ✓
    { x: 1290, y:Y.alta,  w:280 },     // [11] bajando ✓
    { x: 1640, y:Y.cima,  w:300 },     // [12] desde [11]+130 ✓
    { x: 1990, y:Y.alta,  w:280 },     // [13]
    { x: 2370, y:Y.media, w:280 },     // [14] x+w=2650 ✓
  ],
  preguntas: [ {pi:3}, {pi:4}, {pi:10}, {pi:12}, {pi:6} ],
},

/* ── Layout 5: Horizontales largas ──────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:320 },
    { x:  450, y:Y.baja,  w:300 },     // [2]  gap=50 ✓
    { x:  800, y:Y.baja,  w:300 },     // [3]  gap=50 ✓
    { x:  200, y:Y.media, w:320 },     // [4]  desde [1] solapan+130 ✓
    { x:  570, y:Y.media, w:300 },     // [5]  gap=50 ✓
    { x:  920, y:Y.media, w:320 },     // [6]  gap=50 ✓
    { x: 1290, y:Y.media, w:300 },     // [7]  gap=50 ✓
    { x:  340, y:Y.alta,  w:320 },     // [8]  desde [4] solapan+130 ✓
    { x:  710, y:Y.alta,  w:300 },     // [9]  gap=50 ✓
    { x: 1060, y:Y.alta,  w:320 },     // [10] gap=50 ✓
    { x: 1430, y:Y.alta,  w:300 },     // [11] gap=50 ✓
    { x:  490, y:Y.cima,  w:340 },     // [12] desde [8] solapan+130 ✓
    { x:  890, y:Y.cima,  w:320 },     // [13] gap=60 ✓
    { x: 1270, y:Y.cima,  w:320 },     // [14] gap=60 ✓
  ],
  preguntas: [ {pi:8}, {pi:12}, {pi:13}, {pi:14}, {pi:10} ],
},

/* ── Layout 6: Valle central ─────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:280 },
    { x:  100, y:Y.media, w:280 },     // [2]  solapan+130 ✓
    { x:  120, y:Y.alta,  w:300 },     // [3]  solapan+130 ✓
    { x:  140, y:Y.cima,  w:340 },     // [4]  solapan+130 ✓
    { x:  530, y:Y.cima,  w:320 },     // [5]  gap=50 ✓
    { x:  900, y:Y.cima,  w:320 },     // [6]  gap=50 ✓
    { x: 1270, y:Y.cima,  w:320 },     // [7]  gap=50 ✓
    { x: 1640, y:Y.alta,  w:300 },     // [8]  bajando −130 ✓
    { x: 1990, y:Y.media, w:300 },     // [9]  bajando −130 ✓
    { x: 2340, y:Y.baja,  w:280 },     // [10] bajando −130, x+w=2620 ✓
    { x:  700, y:Y.alta,  w:280 },     // [11] desde [4]: 700-(140+340)=220 mismo nivel cima→alta? alta es 130 más baja ✓
    { x: 1080, y:Y.alta,  w:280 },     // [12] gap=100 ✓
    { x: 1450, y:Y.cima,  w:280 },     // [13] desde [12]+130 ✓
    { x: 1830, y:Y.baja,  w:280 },     // [14] bajando desde alta ✓
  ],
  preguntas: [ {pi:4}, {pi:5}, {pi:6}, {pi:7}, {pi:13} ],
},

/* ── Layout 7: Zigzag rápido ─────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:280 },
    { x:  400, y:Y.media, w:300 },
    { x:  750, y:Y.baja,  w:280 },
    { x: 1070, y:Y.media, w:300 },
    { x: 1420, y:Y.alta,  w:320 },     // [5] +130 ✓
    { x: 1790, y:Y.media, w:300 },     // [6] −130 ✓
    { x: 2140, y:Y.baja,  w:280 },     // [7] −130 ✓
    { x:  240, y:Y.alta,  w:300 },     // [8] desde [1]+media+alta ✓
    { x:  590, y:Y.cima,  w:320 },     // [9] desde [8]+130: 590-(240+300)=50 ✓
    { x:  960, y:Y.cima,  w:320 },     // [10] gap=50 ✓
    { x: 1330, y:Y.cima,  w:320 },     // [11] gap=50 ✓
    { x: 1700, y:Y.alta,  w:300 },     // [12] bajando ✓
    { x: 2050, y:Y.media, w:300 },     // [13] bajando ✓
    { x: 2400, y:Y.baja,  w:280 },     // [14] x+w=2680 ✓
  ],
  preguntas: [ {pi:5}, {pi:9}, {pi:10}, {pi:11}, {pi:2} ],
},

/* ── Layout 8: Puente largo + plataformas pequeñas ───────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:280 },
    { x:  100, y:Y.media, w:280 },
    { x:  120, y:Y.alta,  w:300 },
    { x:  160, y:Y.cima,  w:800 },     // [4] puente largo en cima
    { x: 1010, y:Y.alta,  w:300 },     // [5] bajando
    { x: 1360, y:Y.media, w:300 },     // [6] bajando
    { x: 1710, y:Y.baja,  w:280 },     // [7] bajando
    { x: 2040, y:Y.media, w:300 },     // [8] +130 ✓
    { x: 2390, y:Y.alta,  w:300 },     // [9] +130, x+w=2690 ✓
    { x:  500, y:Y.cima,  w:300 },     // [10] sobre el puente [4]
    { x:  850, y:Y.cima,  w:300 },     // [11] sobre el puente [4]
    { x: 1200, y:Y.cima,  w:300 },     // [12] sobre el puente [4] (todos son parte de él)
    // más extras
    { x: 1560, y:Y.alta,  w:280 },     // [13]
    { x: 2100, y:Y.cima,  w:300 },     // [14] desde [9] +130 ✓
  ],
  preguntas: [ {pi:4}, {pi:10}, {pi:11}, {pi:12}, {pi:14} ],
},

/* ── Layout 9: Ascenso libre ─────────────────────────────────────────────── */
{
  plataformas: [
    { x:    0, y:Y.suelo, w:LEVEL_W },
    { x:   80, y:Y.baja,  w:300 },
    { x:  420, y:Y.media, w:300 },
    { x:  760, y:Y.alta,  w:320 },
    { x: 1130, y:Y.cima,  w:600 },     // [4] plataforma larga en cima
    { x: 1780, y:Y.alta,  w:300 },
    { x: 2130, y:Y.media, w:300 },
    { x: 2480, y:Y.baja,  w:230 },     // [7] x+w=2710 ✓
    { x:  230, y:Y.media, w:280 },     // [8]
    { x:  250, y:Y.alta,  w:280 },     // [9] desde [8] solapan ✓
    { x:  580, y:Y.cima,  w:300 },     // [10] desde [9]+130: 580-(250+280)=50 ✓
    { x:  920, y:Y.cima,  w:280 },     // [11] gap=90 ✓
    { x: 1350, y:Y.alta,  w:280 },     // [12] desde [4] bajando ✓
    { x: 1680, y:Y.cima,  w:280 },     // [13] desde [12]+130 ✓
    { x: 1980, y:Y.alta,  w:280 },     // [14]
  ],
  preguntas: [ {pi:3}, {pi:4}, {pi:10}, {pi:13}, {pi:6} ],
},
];

// ══════════════════════════════════════════════════════════════════════════════
//  FRASES PARA ENEMIGOS  (true=correcto → +1pt, false=incorrecto → −1pt)
// ══════════════════════════════════════════════════════════════════════════════
const FRASES = {
  INGLES: [
    { txt:'"Dog" = perro',    ok:true  }, { txt:'"Cat" = vaca',     ok:false },
    { txt:'"Red" = rojo',     ok:true  }, { txt:'"Bird" = pez',     ok:false },
    { txt:'"Water" = agua',   ok:true  }, { txt:'"Green" = azul',   ok:false },
    { txt:'"Bread" = pan',    ok:true  }, { txt:'"Milk" = zumo',    ok:false },
    { txt:'"Sun" = sol',      ok:true  }, { txt:'"Moon" = estrella',ok:false },
    { txt:'"Tree" = árbol',   ok:true  }, { txt:'"Car" = avión',    ok:false },
  ],
  MATES: [
    { txt:'2 es primo',       ok:true  }, { txt:'1 es primo',       ok:false },
    { txt:'4×5 = 20',         ok:true  }, { txt:'7+6 = 14',         ok:false },
    { txt:'100÷10 = 10',      ok:true  }, { txt:'9×9 = 80',         ok:false },
    { txt:'3 es impar',       ok:true  }, { txt:'5+5 = 11',         ok:false },
    { txt:'6 es par',         ok:true  }, { txt:'7×7 = 48',         ok:false },
    { txt:'12÷4 = 3',         ok:true  }, { txt:'15-8 = 8',         ok:false },
  ],
  FRANCES: [
    { txt:'"Oui" = sí',       ok:true  }, { txt:'"Non" = sí',       ok:false },
    { txt:'"Chat" = gato',    ok:true  }, { txt:'"Chien" = gato',   ok:false },
    { txt:'"Bleu" = azul',    ok:true  }, { txt:'"Rouge" = verde',  ok:false },
    { txt:'"Père" = padre',   ok:true  }, { txt:'"Mère" = abuelo',  ok:false },
    { txt:'"Un" = uno',       ok:true  }, { txt:'"Deux" = tres',    ok:false },
    { txt:'"Maison" = casa',  ok:true  }, { txt:'"Livre" = lápiz',  ok:false },
  ],
  GEOGRAFIA: [
    { txt:'París es cap. de Francia', ok:true  }, { txt:'Roma es cap. de España',   ok:false },
    { txt:'El Nilo está en África',   ok:true  }, { txt:'El Everest está en Europa',ok:false },
    { txt:'Australia es un país',     ok:true  }, { txt:'Rusia es el país + peq.',  ok:false },
    { txt:'El Pacífico es el + grande',ok:true }, { txt:'Asia es el - poblado',     ok:false },
    { txt:'Brasil es de América',     ok:true  }, { txt:'El Sena pasa por Madrid',  ok:false },
    { txt:'Japón es un país',         ok:true  }, { txt:'Los Andes están en Europa',ok:false },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
//  PREGUNTAS
// ══════════════════════════════════════════════════════════════════════════════
const MATERIAS = {
  INGLES: {
    label:'Inglés', emoji:'🇬🇧', color:'#0057a8',
    niveles: [
      [
        { q:'¿"Perro" en inglés?',   a:'Dog',    inc:['Cat','Bird','Cow']    },
        { q:'¿"Gato" en inglés?',    a:'Cat',    inc:['Dog','Mouse','Lion']  },
        { q:'¿"Rojo" en inglés?',    a:'Red',    inc:['Blue','Green','Yellow']},
        { q:'¿"Pájaro" en inglés?',  a:'Bird',   inc:['Fish','Snake','Horse']},
        { q:'¿"Azul" en inglés?',    a:'Blue',   inc:['Black','White','Red'] },
      ],
      [
        { q:'¿"Manzana" en inglés?', a:'Apple',  inc:['Banana','Orange','Grape']},
        { q:'¿"Pan" en inglés?',     a:'Bread',  inc:['Meat','Water','Milk']    },
        { q:'¿"Leche" en inglés?',   a:'Milk',   inc:['Juice','Coffee','Tea']   },
        { q:'¿"Queso" en inglés?',   a:'Cheese', inc:['Butter','Egg','Rice']    },
        { q:'¿"Agua" en inglés?',    a:'Water',  inc:['Wine','Beer','Soda']     },
      ],
      [
        { q:'¿"Madre" en inglés?',   a:'Mother',      inc:['Father','Sister','Aunt']  },
        { q:'¿"Hermano" en inglés?', a:'Brother',     inc:['Sister','Uncle','Cousin'] },
        { q:'¿"Abuelo" en inglés?',  a:'Grandfather', inc:['Uncle','Father','Son']    },
        { q:'¿"Hija" en inglés?',    a:'Daughter',    inc:['Son','Niece','Aunt']      },
        { q:'¿"Tío" en inglés?',     a:'Uncle',       inc:['Aunt','Brother','Cousin'] },
      ],
      [
        { q:'¿"Comer" en inglés?',  a:'Eat',   inc:['Drink','Sleep','Run']    },
        { q:'¿"Jugar" en inglés?',  a:'Play',  inc:['Work','Study','Read']    },
        { q:'¿"Leer" en inglés?',   a:'Read',  inc:['Write','Listen','Speak'] },
        { q:'¿"Correr" en inglés?', a:'Run',   inc:['Walk','Jump','Sit']      },
        { q:'¿"Dormir" en inglés?', a:'Sleep', inc:['Wake','Dream','Rest']    },
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
        { q:'15 − 6 = ?',     a:'9',  inc:['8','10','7']   },
        { q:'20 − 12 = ?',    a:'8',  inc:['7','9','6']    },
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
        { q:'45 ÷ 5 = ?',     a:'9',  inc:['8','10','7']   },
        { q:'100 ÷ 10 = ?',   a:'10', inc:['100','1','0']  },
        { q:'36 ÷ 6 = ?',     a:'6',  inc:['5','7','8']    },
        { q:'2+3×4 = ?',      a:'14', inc:['20','24','10'] },
        { q:'20÷4+1 = ?',     a:'6',  inc:['5','4','7']    },
      ],
    ],
  },
  FRANCES: {
    label:'Francés', emoji:'🇫🇷', color:'#8e44ad',
    niveles: [
      [
        { q:'"Hola" en francés',       a:'Bonjour',         inc:['Au revoir','Merci','Oui']       },
        { q:'"Gracias" en francés',    a:'Merci',           inc:["S'il vous plaît",'Pardon','Non'] },
        { q:'"Adiós" en francés',      a:'Au revoir',       inc:['Salut','À demain','Bonjour']     },
        { q:'"Sí" en francés',         a:'Oui',             inc:['Non','Peut-être','Bien']          },
        { q:'"Por favor" en francés',  a:"S'il vous plaît", inc:['Merci','De rien','Pardon']        },
      ],
      [
        { q:'"Perro" en francés',  a:'Chien',   inc:['Chat','Oiseau','Cheval']   },
        { q:'"Gato" en francés',   a:'Chat',    inc:['Souris','Lapin','Chien']   },
        { q:'"Casa" en francés',   a:'Maison',  inc:['Voiture','École','Rue']    },
        { q:'"Coche" en francés',  a:'Voiture', inc:['Vélo','Train','Avion']     },
        { q:'"Libro" en francés',  a:'Livre',   inc:['Cahier','Stylo','Crayon']  },
      ],
      [
        { q:'"Madre" en francés',  a:'Mère',   inc:['Père','Soeur','Fille']   },
        { q:'"Padre" en francés',  a:'Père',   inc:['Frère','Fils','Mère']    },
        { q:'"Niño" en francés',   a:'Garçon', inc:['Fille','Homme','Femme']  },
        { q:'"Niña" en francés',   a:'Fille',  inc:['Garçon','Femme','Mère']  },
        { q:'"Amigo" en francés',  a:'Ami',    inc:['Ennemi','Frère','Père']   },
      ],
      [
        { q:'"Rojo" en francés',  a:'Rouge', inc:['Bleu','Vert','Jaune']       },
        { q:'"Negro" en francés', a:'Noir',  inc:['Blanc','Gris','Marron']      },
        { q:'"Uno" en francés',   a:'Un',    inc:['Deux','Trois','Quatre']      },
        { q:'"Cinco" en francés', a:'Cinq',  inc:['Six','Sept','Huit']          },
        { q:'"Diez" en francés',  a:'Dix',   inc:['Neuf','Onze','Douze']        },
      ],
    ],
  },
  GEOGRAFIA: {
    label:'Geografía', emoji:'🌍', color:'#27ae60',
    niveles: [
      [
        { q:'Capital de Francia',     a:'París',   inc:['Lyon','Marsella','Burdeos']      },
        { q:'Capital de Italia',       a:'Roma',    inc:['Milán','Venecia','Nápoles']      },
        { q:'Capital de Alemania',     a:'Berlín',  inc:['Múnich','Hamburgo','Frankfurt']  },
        { q:'Capital de R. Unido',     a:'Londres', inc:['Manchester','Liverpool','Edimburgo'] },
        { q:'Capital de Portugal',     a:'Lisboa',  inc:['Oporto','Faro','Coímbra']        },
      ],
      [
        { q:'Río más largo',           a:'Amazonas', inc:['Nilo','Yangtsé','Misisipi']    },
        { q:'Montaña más alta',        a:'Everest',  inc:['K2','Mont Blanc','Teide']      },
        { q:'Río de Egipto',           a:'Nilo',     inc:['Congo','Níger','Zambeze']      },
        { q:'Cord. de Sudamérica',     a:'Andes',    inc:['Himalaya','Alpes','Pirineos']  },
        { q:'Río de París',            a:'Sena',     inc:['Ródano','Loira','Rin']          },
      ],
      [
        { q:'País con forma de bota',  a:'Italia',    inc:['Grecia','México','Chile']      },
        { q:'País más grande',         a:'Rusia',     inc:['Canadá','China','EEUU']         },
        { q:'País de los canguros',    a:'Australia', inc:['N.Zelanda','Sudáfrica','Brasil']},
        { q:'País del Taj Mahal',      a:'India',     inc:['Pakistán','Turquía','Egipto']   },
        { q:'País del Monte Fuji',     a:'Japón',     inc:['Corea del Sur','China','Vietnam']},
      ],
      [
        { q:'Océano más grande',       a:'Pacífico',  inc:['Atlántico','Índico','Ártico']   },
        { q:'Continente más poblado',  a:'Asia',      inc:['África','Europa','América']      },
        { q:'Océano Europa-América',   a:'Atlántico', inc:['Pacífico','Índico','Antártico']  },
        { q:'Continente del Sahara',   a:'África',    inc:['Asia','Oceanía','Europa']        },
        { q:'País más poblado',        a:'India',     inc:['China','EEUU','Indonesia']       },
      ],
    ],
  },
};

const BG_THEMES = ['#0d2b1a','#0d1a3a','#2a0d0d','#111820'];
const GR_COLORS = ['#3d8b2a','#2c3e50','#6b1e1e','#2a3a28'];

// ──────────────────────────────────────────────────────────────────────────────
//  UI SCREENS
// ──────────────────────────────────────────────────────────────────────────────
function Scr({ children }) {
  return <div style={{ minHeight:'100vh', background:'#1a1a2e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Arial,sans-serif' }}>{children}</div>;
}

function PantallaMenu({ onEligir, onExit }) {
  return (
    <Scr>
      <div style={{ fontSize:'2.6rem', marginBottom:4 }}>🎮</div>
      <h1 style={{ color:'#f1c40f', fontSize:'2rem', margin:'0 0 4px', textShadow:'2px 2px 0 #000' }}>Quiz Plataformas</h1>
      <p style={{ color:'rgba(255,255,255,0.5)', margin:'4px 0 24px', fontSize:'0.8rem', textAlign:'center', lineHeight:1.6 }}>
        Sube plataformas · golpea desde abajo la respuesta correcta<br/>
        ✅ Acierto +1 · ❌ Error −1 · 🟡 Moneda +1 · ☠️ Enemigo ±1
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, maxWidth:420, width:'100%' }}>
        {Object.entries(MATERIAS).map(([id,m])=>(
          <button key={id} onClick={()=>onEligir(id)}
            style={{ padding:'18px 12px', borderRadius:14, border:`3px solid ${m.color}`, background:`${m.color}18`, color:'white', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, fontFamily:'inherit', transition:'transform .15s' }}
            onMouseOver={e=>e.currentTarget.style.transform='scale(1.04)'}
            onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}
          >
            <span style={{ fontSize:'2.2rem' }}>{m.emoji}</span>
            <span style={{ fontWeight:'bold', fontSize:'1rem' }}>{m.label}</span>
            <span style={{ fontSize:'0.66rem', color:'rgba(255,255,255,0.42)' }}>4 niveles · 5 preguntas</span>
          </button>
        ))}
      </div>
      {onExit && <button onClick={onExit} style={{ marginTop:20, padding:'7px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.38)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem' }}>← Salir</button>}
    </Scr>
  );
}

function PantallaIntro({ materia, nivel, total, onStart, onBack }) {
  const m = MATERIAS[materia];
  return (
    <Scr>
      <div style={{ fontSize:'3.5rem' }}>{m.emoji}</div>
      <h2 style={{ color:'white', fontSize:'1.4rem', margin:'8px 0' }}>{m.label}</h2>
      <div style={{ background:`${m.color}33`, border:`3px solid ${m.color}`, borderRadius:14, padding:'10px 30px', color:'white', fontSize:'1.15rem', fontWeight:'bold', marginBottom:16 }}>
        Nivel {nivel} de {total}
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'14px 20px', maxWidth:340, color:'rgba(255,255,255,0.78)', lineHeight:1.8, fontSize:'0.84rem', textAlign:'center', marginBottom:20 }}>
        🕹️ <strong>← →</strong> moverse · <strong>↑/Espacio</strong> saltar<br/>
        Golpea los bloques de colores <strong>desde abajo</strong><br/>
        🟡 Recoge monedas · {nivel>1?'☠️ Evita (o toca) enemigos — ¡lee la frase!':'(sin enemigos en nivel 1)'}
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onBack} style={{ padding:'8px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.18)', background:'transparent', color:'rgba(255,255,255,0.45)', cursor:'pointer', fontFamily:'inherit' }}>← Atrás</button>
        <button onClick={onStart} style={{ padding:'11px 32px', borderRadius:28, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }}>▶ ¡Empezar!</button>
      </div>
    </Scr>
  );
}

function PantallaFin({ materia, score, aciertos, total, onReintentar, onSiguiente, onMenu, hayMas }) {
  const pct=Math.round(Math.max(0,aciertos)/Math.max(total,1)*100);
  const stars=pct>=80?'⭐⭐⭐':pct>=50?'⭐⭐':'⭐';
  return (
    <Scr>
      <div style={{ fontSize:'3rem' }}>🏆</div>
      <h2 style={{ color:'white', margin:'6px 0' }}>¡Nivel completado!</h2>
      <div style={{ fontSize:'1.8rem', margin:'4px 0 12px' }}>{stars}</div>
      <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:14, padding:'16px 34px', textAlign:'center', color:'white', marginBottom:18, display:'flex', gap:24 }}>
        <div>
          <div style={{ fontSize:'2rem', fontWeight:'bold', color:'#2980b9' }}>{aciertos}/{total}</div>
          <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', marginTop:2 }}>aciertos · {pct}%</div>
        </div>
        <div style={{ borderLeft:'1px solid rgba(255,255,255,0.15)', paddingLeft:24 }}>
          <div style={{ fontSize:'2rem', fontWeight:'bold', color:'#f1c40f' }}>{Math.max(0,score)}</div>
          <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', marginTop:2 }}>puntos totales</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
        {hayMas && <button onClick={onSiguiente} style={{ padding:'10px 22px', borderRadius:20, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', cursor:'pointer', fontFamily:'inherit' }}>Siguiente →</button>}
        <button onClick={onReintentar} style={{ padding:'10px 18px', borderRadius:20, border:'none', background:'#3498db', color:'white', fontWeight:'bold', cursor:'pointer', fontFamily:'inherit' }}>🔄 Reintentar</button>
        <button onClick={onMenu} style={{ padding:'10px 18px', borderRadius:20, border:'2px solid rgba(255,255,255,0.2)', background:'transparent', color:'white', cursor:'pointer', fontFamily:'inherit' }}>🏠 Menú</button>
      </div>
    </Scr>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PANTALLA RESUMEN FINAL — confetti, corazones, personaje saltando
// ══════════════════════════════════════════════════════════════════════════════
function PantallaResumen({ materia, levelStats, onMenu }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const spriteRef = useRef(null);

  useEffect(()=>{
    const s=new Image(); s.src=pikatronImgSrc; spriteRef.current=s;
  },[]);

  const totalCorrect = levelStats.reduce((s,l)=>s+(l?.correct||0),0);
  const totalQuest   = levelStats.reduce((s,l)=>s+(l?.total||0),0);
  const totalPoints  = levelStats.reduce((s,l)=>s+(l?.points||0),0);
  const totalPct     = totalQuest>0 ? Math.round(totalCorrect/totalQuest*100) : 0;
  const mat = MATERIAS[materia];

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    canvas.width=600; canvas.height=200;
    const ctx=canvas.getContext('2d');
    const sprite=spriteRef.current;

    // Confetti particles
    const particles = Array.from({length:90},(_,i)=>({
      x: Math.random()*600,
      y: Math.random()*-200,
      vy: 1.5+Math.random()*2.5,
      vx: (Math.random()-0.5)*1.5,
      r: 4+Math.random()*5,
      color: ['#f1c40f','#e74c3c','#3498db','#2ecc71','#e67e22','#9b59b6','#ff69b4','#fff'][i%8],
      shape: Math.random()<0.5?'rect':'heart',
      rot: Math.random()*Math.PI*2,
      rotV: (Math.random()-0.5)*0.12,
      alpha: 0.8+Math.random()*0.2,
    }));

    // Player bounce
    let pX=80, pY=120, pVy=-12, pFacing=1, pFt=0, pFrameX=0, pFrameY=0;

    const loop=()=>{
      ctx.clearRect(0,0,600,200);

      // Confetti
      for(const p of particles){
        p.x+=p.vx; p.y+=p.vy; p.rot+=p.rotV;
        if(p.y>210){ p.y=-10; p.x=Math.random()*600; }
        ctx.save(); ctx.globalAlpha=p.alpha;
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        if(p.shape==='rect'){
          ctx.fillStyle=p.color; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);
        } else {
          // Corazón
          ctx.fillStyle=p.color;
          ctx.beginPath();
          ctx.moveTo(0,-p.r*0.5);
          ctx.bezierCurveTo(p.r*0.8,-p.r*1.2, p.r*1.6,p.r*0.3, 0,p.r*1.1);
          ctx.bezierCurveTo(-p.r*1.6,p.r*0.3, -p.r*0.8,-p.r*1.2, 0,-p.r*0.5);
          ctx.fill();
        }
        ctx.restore();
      }

      // Personaje saltando de lado a lado
      pVy+=0.55; pY+=pVy; pX+=pFacing*2.5;
      if(pY>=135){ pY=135; pVy=-12; }
      if(pX>520){ pFacing=-1; }
      if(pX<40){ pFacing=1; }

      pFt++;
      if(pFt%7===0){
        if(pVy<0){ pFrameX=1; pFrameY=0; }
        else{ const fr=[[0,0],[0,1],[1,1]]; const st=Math.floor(pFt/7)%3; pFrameX=fr[st][0]; pFrameY=fr[st][1]; }
      }

      ctx.save();
      if(pFacing<0){
        ctx.translate(pX+30,pY+30); ctx.scale(-1,1); ctx.translate(-(pX+30),-(pY+30));
      }
      const sw=sprite?.complete&&sprite.naturalWidth>0;
      if(sw){
        const fw=sprite.width/2,fh=sprite.height/2;
        ctx.drawImage(sprite,pFrameX*fw,pFrameY*fh,fw,fh,pX,pY,60,60);
      } else {
        ctx.fillStyle='#e74c3c'; ctx.fillRect(pX+6,pY,48,46);
        ctx.fillStyle='#f1c40f'; ctx.fillRect(pX+11,pY+8,11,8); ctx.fillRect(pX+34,pY+8,11,8);
      }
      ctx.restore();

      // Suelo
      ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(0,193,600,7);

      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);

  const stars = totalPct>=80?'⭐⭐⭐':totalPct>=50?'⭐⭐':'⭐';

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#1a1a2e,#0d0d20)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 16px', fontFamily:'Arial,sans-serif', overflowY:'auto' }}>

      {/* Canvas animado */}
      <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 0 40px rgba(241,196,15,0.3)', marginBottom:20, width:'100%', maxWidth:600 }}>
        <canvas ref={canvasRef} style={{ display:'block', width:'100%', background:'#0a0a20' }}/>
      </div>

      <div style={{ fontSize:'1.5rem', marginBottom:4 }}>{mat.emoji} {stars}</div>
      <h1 style={{ color:'#f1c40f', fontSize:'1.8rem', margin:'0 0 4px', textShadow:'2px 2px 0 #000', textAlign:'center' }}>¡Juego completado!</h1>
      <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.82rem', margin:'0 0 20px', textAlign:'center' }}>{mat.label} · 4 niveles</p>

      {/* Tabla por niveles */}
      <div style={{ width:'100%', maxWidth:520, marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr 1fr', gap:'2px', fontSize:'0.8rem' }}>
          {/* Cabecera */}
          {['Nivel','Aciertos','% Ac.','Puntos'].map(h=>(
            <div key={h} style={{ background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.55)', padding:'6px 10px', textAlign:'center', fontWeight:'bold', borderRadius:4 }}>{h}</div>
          ))}
          {/* Filas */}
          {[0,1,2,3].map(i=>{
            const ls=levelStats[i]||{correct:0,total:5,points:0};
            const pct=Math.round(ls.correct/Math.max(ls.total,1)*100);
            const pctColor=pct>=80?'#2ecc71':pct>=50?'#f1c40f':'#e74c3c';
            return [
              <div key={`n${i}`} style={{ background:'rgba(255,255,255,0.05)', color:'white', padding:'8px 10px', textAlign:'center', borderRadius:4, fontWeight:'bold' }}>
                {i+1}
              </div>,
              <div key={`a${i}`} style={{ background:'rgba(41,128,185,0.25)', color:'#7ec8f7', padding:'8px 10px', textAlign:'center', borderRadius:4 }}>
                {ls.correct} / {ls.total}
              </div>,
              <div key={`p${i}`} style={{ background:'rgba(255,255,255,0.05)', color:pctColor, padding:'8px 10px', textAlign:'center', borderRadius:4, fontWeight:'bold' }}>
                {pct}%
              </div>,
              <div key={`s${i}`} style={{ background:'rgba(241,196,15,0.15)', color:'#f1c40f', padding:'8px 10px', textAlign:'center', borderRadius:4, fontWeight:'bold' }}>
                {ls.points}
              </div>,
            ];
          })}
        </div>
      </div>

      {/* Totales */}
      <div style={{ width:'100%', maxWidth:520, background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'16px 20px', border:'1px solid rgba(255,255,255,0.1)', marginBottom:22 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, textAlign:'center' }}>
          <div>
            <div style={{ fontSize:'1.8rem', fontWeight:'bold', color:'#2980b9' }}>{totalCorrect}/{totalQuest}</div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', marginTop:3 }}>ACIERTOS TOTALES</div>
          </div>
          <div style={{ borderLeft:'1px solid rgba(255,255,255,0.12)', borderRight:'1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize:'1.8rem', fontWeight:'bold', color: totalPct>=80?'#2ecc71':totalPct>=50?'#f1c40f':'#e74c3c' }}>{totalPct}%</div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', marginTop:3 }}>% ACIERTOS</div>
          </div>
          <div>
            <div style={{ fontSize:'1.8rem', fontWeight:'bold', color:'#f1c40f' }}>{totalPoints}</div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', marginTop:3 }}>PUNTOS TOTALES</div>
          </div>
        </div>
      </div>

      <button onClick={onMenu} style={{ padding:'12px 36px', borderRadius:28, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 20px rgba(241,196,15,0.4)' }}>
        🏠 Volver al menú
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function QuizPlataformas({ onExit }) {
  const [fase,     setFase]       = useState('MENU');
  const [materia,  setMateria]    = useState(null);
  const [nivelIdx, setNivelIdx]   = useState(0);
  const [score,    setScore]      = useState(0);      // puntos totales (preguntas+monedas+enemigos)
  const [aciertos, setAciertos]   = useState(0);      // solo respuestas correctas a preguntas
  const [feedUI,   setFeedUI]     = useState(null);
  const [totalQ,   setTotalQ]     = useState(5);
  const [levelStats, setLevelStats] = useState([]);   // [{correct, total, points, mat}]

  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const spriteRef = useRef(null);
  const enemyRef  = useRef(null);
  const bgRefs    = useRef([]);
  const feedTimer   = useRef(null);
  const scoreRef    = useRef(0);    // espejo de score para lectura en loop
  const aciertosRef = useRef(0);    // espejo de aciertos para lectura en loop

  useEffect(()=>{
    const s=new Image(); s.src=pikatronImgSrc; spriteRef.current=s;
    const e=new Image(); e.src=enemyImgSrc;    enemyRef.current=e;
    [bg1Src,bg2Src,bg3Src,bg4Src].forEach((src,i)=>{ const img=new Image(); img.src=src; bgRefs.current[i]=img; });
  },[]);

  const g = useRef({
    player:{ x:100,y:700, vx:0,vy:0, onGround:false, facing:1, frameX:0,frameY:0,ft:0, coyote:0,jumpBuffer:0, invulnerable:0 },
    keys:  { left:false, right:false },
    camX:0, camY:0,
    platforms:[], ansBlocks:[], stations:[],
    coins:[], enemies:[],
    answered:0, total:0,
    bgX:0, frame:0,
  });

  // ── Construir nivel ──
  const buildLevel = useCallback((mat, niv, layoutIdx)=>{
    const preguntas = [...MATERIAS[mat].niveles[niv]].sort(()=>Math.random()-.5);
    const lay       = LAYOUTS[layoutIdx % LAYOUTS.length];
    const plats     = lay.plataformas.map(p=>({ x:p.x, y:p.y, w:p.w, h:PLAT_H }));
    const qPlatSet  = new Set(lay.preguntas.map(q=>q.pi));

    const stations  = [];
    const ansBlocks = [];
    const coins     = [];
    const enemies   = [];
    const usedFraseIdx = new Set();

    // ── Preguntas ──
    lay.preguntas.forEach((qDef,qi)=>{
      if (qi>=preguntas.length) return;
      const pq   = preguntas[qi];
      const plat = plats[qDef.pi];
      if (!plat) return;

      const { blockW, totalW } = getAnsLayout(plat.w);
      const cx    = plat.x + plat.w/2;
      const blockY= plat.y - ANS_ABOVE;

      // Centrar bloques sobre la plataforma, nunca fuera del nivel con margen
      let startX = cx - totalW/2;
      startX = Math.max(EDGE_MARGIN, Math.min(LEVEL_W - totalW - EDGE_MARGIN, startX));

      const opciones = [
        { text:pq.a, isCorrect:true },
        { text:pq.inc[0], isCorrect:false },
        { text:pq.inc[1], isCorrect:false },
        { text:pq.inc[2], isCorrect:false },
      ].sort(()=>Math.random()-.5);

      opciones.forEach((op,bi)=>{
        ansBlocks.push({
          x:startX+bi*(blockW+ANS_GAP), y:blockY,
          w:blockW, h:ANS_H,
          text:op.text, isCorrect:op.isCorrect,
          color:ANS_COLORS[bi],
          hit:false, shakeT:0, stIdx:qi,
        });
      });

      // Texto de pregunta centrado sobre los bloques, clampeado
      const qCX = Math.max(120, Math.min(LEVEL_W-120, startX + totalW/2));
      stations.push({ cx:qCX, qY:blockY-26, qText:pq.q, answered:false, idx:qi });
    });

    // ── Monedas y enemigos en plataformas sin pregunta ──
    const frasesPool = [...(FRASES[mat]||[])].sort(()=>Math.random()-.5);
    let frasesCursor = 0;

    plats.forEach((plat,pi)=>{
      if (pi===0) return;        // suelo
      if (qPlatSet.has(pi)) return; // plataformas con pregunta

      const addCoins = ()=>{
        const n = 1 + Math.floor(Math.random()*3);
        for (let i=0;i<n;i++){
          coins.push({
            x: plat.x + (i+1)*plat.w/(n+1),
            y: plat.y - COIN_R - 4,
            r: COIN_R, active:true,
          });
        }
      };

      if (niv===0 || Math.random()<0.55) {
        // Monedas
        addCoins();
      } else {
        // Enemigo
        const frase = frasesPool[frasesCursor % frasesPool.length];
        frasesCursor++;
        enemies.push({
          x: plat.x + plat.w*0.3,
          y: plat.y - ENEMY_H,
          vx: ENEMY_SPEED,
          w: ENEMY_W, h: ENEMY_H,
          platMinX: plat.x + 4,
          platMaxX: plat.x + plat.w - ENEMY_W - 4,
          facing: 1,
          phrase: frase.txt,
          isTrue:  frase.ok,
          active:  true,
          frameT:  0,
        });
      }
    });

    const ref = g.current;
    ref.platforms = plats;
    ref.ansBlocks = ansBlocks;
    ref.stations  = stations;
    ref.coins     = coins;
    ref.enemies   = enemies;
    ref.answered  = 0;
    ref.total     = stations.length;
    ref.bgX = 0; ref.frame = 0;
    ref.camX = 0;
    ref.camY = Math.max(0, GROUND - CH*0.72);
    ref.player = { x:100,y:GROUND-PLAYER_H-2, vx:0,vy:0, onGround:false, facing:1, frameX:0,frameY:0,ft:0, coyote:0,jumpBuffer:0, invulnerable:0 };
    ref.keys   = { left:false, right:false };

    setScore(0);
    setAciertos(0);
    setTotalQ(stations.length);
    scoreRef.current    = 0;
    aciertosRef.current = 0;
  },[]);

  const iniciar = (mat,niv)=>{
    buildLevel(mat, niv, (niv*2 + Object.keys(MATERIAS).indexOf(mat)) % LAYOUTS.length);
    setFase('PLAYING');
  };

  // ── Game Loop ──
  useEffect(()=>{
    if (fase!=='PLAYING') { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width=CW; canvas.height=CH;
    const ctx    = canvas.getContext('2d');
    const bgImg  = bgRefs.current[nivelIdx%4];
    const sprite = spriteRef.current;
    const enemy  = enemyRef.current;
    const theme  = GR_COLORS[nivelIdx%4];

    const loop = ()=>{
      const ref = g.current;
      const p   = ref.player;
      ref.frame++;

      // ── Movimiento horizontal ──
      if (ref.keys.right) { p.vx= MOVE_SPEED; p.facing= 1; }
      else if (ref.keys.left) { p.vx=-MOVE_SPEED; p.facing=-1; }
      else p.vx *= p.onGround ? 0.7 : 0.92;
      p.x = Math.max(0, Math.min(LEVEL_W-PLAYER_W, p.x+p.vx));

      // ── Cámara ──
      ref.camX += (p.x-CW*0.38-ref.camX)*0.10;
      ref.camY += ((p.y+PLAYER_H/2)-CH*0.5-ref.camY)*0.08;
      ref.camX  = Math.max(0, Math.min(LEVEL_W-CW, ref.camX));
      ref.camY  = Math.max(0, Math.min(LEVEL_H-CH, ref.camY));

      // ── Física vertical ──
      const wasGround = p.onGround;
      p.vy = Math.min(p.vy+GRAVITY, 24);
      p.y += p.vy;
      p.onGround = false;

      for (const plat of ref.platforms) {
        const pB  = (p.y-p.vy)+PLAYER_H, cB = p.y+PLAYER_H;
        const oX  = p.x+PLAYER_W-6>plat.x && p.x+6<plat.x+plat.w;
        if (oX && p.vy>=0 && pB<=plat.y+4 && cB>=plat.y) {
          p.y=plat.y-PLAYER_H; p.vy=0; p.onGround=true;
        }
      }
      if (p.y+PLAYER_H>GROUND+PLAT_H) { p.y=GROUND+PLAT_H-PLAYER_H; p.vy=0; p.onGround=true; }

      // Coyote time
      if (wasGround&&!p.onGround) p.coyote=COYOTE_F;
      else if (p.onGround) p.coyote=0;
      else if (p.coyote>0) p.coyote--;

      // Jump buffer
      if (p.jumpBuffer>0) {
        p.jumpBuffer--;
        if (p.onGround||p.coyote>0) { p.vy=JUMP_POWER; p.onGround=false; p.coyote=0; p.jumpBuffer=0; snd('jump'); }
      }

      if (p.invulnerable>0) p.invulnerable--;

      // ── Golpe de bloques ──
      for (const blk of ref.ansBlocks) {
        if (blk.hit) continue;
        const oX  = p.x+PLAYER_W-22>blk.x && p.x+22<blk.x+blk.w;
        const pT  = p.y-p.vy;
        if (oX && p.vy<0 && pT>=blk.y+blk.h-6 && p.y<=blk.y+blk.h+10) {
          p.vy=5;
          const si=blk.stIdx;
          if (ref.stations[si]?.answered) continue;
          blk.hit=true; blk.shakeT=16;
          ref.stations[si].answered=true;
          ref.ansBlocks.forEach(b=>{ if(b.stIdx===si){b.hit=true;b.shakeT=12;} });
          ref.answered++;
          if (blk.isCorrect) {
            snd('correct');
            scoreRef.current++;    setScore(scoreRef.current);
            aciertosRef.current++; setAciertos(aciertosRef.current);
            setFeedUI({text:'✅ ¡Correcto!',ok:true});
          } else {
            snd('wrong');
            scoreRef.current = Math.max(0, scoreRef.current-1);
            setScore(scoreRef.current);
            const corr=ref.ansBlocks.find(b=>b.stIdx===si&&b.isCorrect);
            setFeedUI({text:`❌ Era: ${corr?.text||'?'}`,ok:false});
          }
          if (feedTimer.current) clearTimeout(feedTimer.current);
          feedTimer.current=setTimeout(()=>setFeedUI(null),1700);
          if (ref.answered>=ref.total) {
            // Guardar stats del nivel antes de pasar
            const snap = { correct: aciertosRef.current, total: ref.total, points: scoreRef.current };
            setLevelStats(prev => {
              const next = [...prev];
              next[nivelIdx] = snap;
              return next;
            });
            setTimeout(()=>setFase(nivelIdx>=3?'RESUMEN':'FIN'),1300);
          }
        }
      }

      // ── Monedas ──
      for (const coin of ref.coins) {
        if (!coin.active) continue;
        const dx=(p.x+PLAYER_W/2)-coin.x, dy=(p.y+PLAYER_H/2)-coin.y;
        if (Math.hypot(dx,dy)<COIN_R+PLAYER_W/2-6) {
          coin.active=false; snd('correct');
          scoreRef.current++; setScore(scoreRef.current);
          setFeedUI({text:'🟡 +1 moneda',ok:true});
          if (feedTimer.current) clearTimeout(feedTimer.current);
          feedTimer.current=setTimeout(()=>setFeedUI(null),900);
        }
      }

      // ── Enemigos ──
      for (const en of ref.enemies) {
        if (!en.active) continue;
        en.x += en.vx;
        en.frameT++;
        if (en.x<=en.platMinX) { en.x=en.platMinX; en.vx=ENEMY_SPEED; en.facing=1; }
        if (en.x>=en.platMaxX) { en.x=en.platMaxX; en.vx=-ENEMY_SPEED; en.facing=-1; }

        // Colisión con jugador
        if (p.invulnerable>0) continue;
        const oX=p.x+PLAYER_W-8>en.x && p.x+8<en.x+en.w;
        const oY=p.y+PLAYER_H-8>en.y && p.y+8<en.y+en.h;
        if (oX&&oY) {
          en.active=false;
          p.invulnerable=ENEMY_INVUL_F;
          if (en.isTrue) {
            snd('correct'); scoreRef.current++; setScore(scoreRef.current);
            setFeedUI({text:'✅ ¡Verdad! +1',ok:true});
          } else {
            snd('wrong'); scoreRef.current=Math.max(0,scoreRef.current-1); setScore(scoreRef.current);
            setFeedUI({text:'❌ ¡Falso! −1',ok:false});
          }
          if (feedTimer.current) clearTimeout(feedTimer.current);
          feedTimer.current=setTimeout(()=>setFeedUI(null),1700);
        }
      }

      // Animación sprite
      p.ft++;
      if (p.ft%7===0) {
        const moving=ref.keys.left||ref.keys.right;
        if (!p.onGround) { p.frameX=1; p.frameY=0; }
        else if (moving) {
          const fr=[[0,0],[0,1],[1,1]];
          const s=Math.floor(p.ft/7)%3; p.frameX=fr[s][0]; p.frameY=fr[s][1];
        } else { p.frameX=0; p.frameY=0; }
      }

      // ══════════ DIBUJO ══════════
      ctx.clearRect(0,0,CW,CH);
      const cx=Math.round(ref.camX), cy=Math.round(ref.camY);

      // Fondo
      ref.bgX-=0.3; if(ref.bgX<=-CW) ref.bgX=0;
      if(bgImg?.complete&&bgImg.naturalWidth>0){
        ctx.drawImage(bgImg,ref.bgX,0,CW,CH); ctx.drawImage(bgImg,ref.bgX+CW,0,CW,CH);
      } else {
        const grd=ctx.createLinearGradient(0,0,0,CH);
        grd.addColorStop(0,BG_THEMES[nivelIdx%4]); grd.addColorStop(1,'#000015');
        ctx.fillStyle=grd; ctx.fillRect(0,0,CW,CH);
      }
      ctx.fillStyle='rgba(0,0,0,0.42)'; ctx.fillRect(0,0,CW,CH);

      // ─ Plataformas ─
      for (const plat of ref.platforms) {
        const sx=plat.x-cx, sy=plat.y-cy;
        if(sx>CW+60||sx+plat.w<-60||sy>CH+20||sy<-20) continue;
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(sx+4,sy+5,plat.w,plat.h);
        ctx.fillStyle=theme; ctx.fillRect(sx,sy,plat.w,plat.h);
        ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(sx,sy,plat.w,4);
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(sx,sy+plat.h-3,plat.w,3);
      }

      // ─ Monedas ─
      for (const coin of ref.coins) {
        if (!coin.active) continue;
        const sx=coin.x-cx, sy=coin.y-cy;
        if(sx<-20||sx>CW+20||sy<-20||sy>CH+20) continue;
        // Brillo pulsante
        const pulse=0.85+0.15*Math.sin(ref.frame*0.12);
        ctx.save();
        ctx.globalAlpha=pulse;
        // Sombra
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(sx+2,sy+3,COIN_R,0,Math.PI*2); ctx.fill();
        // Moneda
        const grd=ctx.createRadialGradient(sx-2,sy-2,1,sx,sy,COIN_R);
        grd.addColorStop(0,'#ffe066'); grd.addColorStop(1,'#d4a000');
        ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(sx,sy,COIN_R,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#a07800'; ctx.lineWidth=1.5; ctx.stroke();
        // $ signo
        ctx.fillStyle='#7a5800'; ctx.font=`bold ${COIN_R}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('★',sx,sy);
        ctx.restore();
      }

      // ─ Enemigos ─
      for (const en of ref.enemies) {
        if (!en.active) continue;
        const sx=en.x-cx, sy=en.y-cy;
        if(sx<-60||sx>CW+60||sy<-60||sy>CH+60) continue;

        ctx.save();
        // Flip según dirección
        if (en.facing<0) {
          ctx.translate(sx+en.w/2,sy+en.h/2); ctx.scale(-1,1); ctx.translate(-(sx+en.w/2),-(sy+en.h/2));
        }
        const enemyOk=enemy?.complete&&enemy.naturalWidth>0;
        if (enemyOk) {
          // Tinte azul — enemigos siempre azules
          ctx.filter='sepia(1) saturate(5) hue-rotate(185deg)';
          const fw=enemy.width/2, fh=enemy.height/2;
          ctx.drawImage(enemy,0,0,fw,fh,sx,sy,en.w,en.h);
          ctx.filter='none';
        } else {
          // Fallback: monstruo dibujado
          ctx.fillStyle='#9b59b6'; ctx.fillRect(sx+4,sy,en.w-8,en.h-10);
          ctx.fillStyle='#e74c3c'; ctx.fillRect(sx+8,sy+6,8,8); ctx.fillRect(sx+en.w-16,sy+6,8,8);
          ctx.fillStyle='white'; ctx.fillRect(sx+9,sy+7,5,5); ctx.fillRect(sx+en.w-15,sy+7,5,5);
          ctx.fillStyle='#333'; ctx.fillRect(sx+11,sy+9,3,3); ctx.fillRect(sx+en.w-13,sy+9,3,3);
          ctx.fillStyle='#9b59b6'; ctx.fillRect(sx+8,sy+en.h-10,10,10); ctx.fillRect(sx+en.w-18,sy+en.h-10,10,10);
        }
        ctx.restore();

        // Frase del enemigo
        ctx.save();
        ctx.font='bold 10px Arial';
        const tw=ctx.measureText(en.phrase).width;
        const bw=Math.min(tw+14, CW-20), bh=18;
        const bx=Math.max(2, Math.min(CW-bw-2, sx+en.w/2-bw/2));
        const by=sy-bh-5;
        if (by>-20) {
          ctx.fillStyle=en.isTrue?'rgba(39,174,96,0.88)':'rgba(192,57,43,0.88)';
          rr(ctx,bx,by,bw,bh,4); ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1;
          rr(ctx,bx,by,bw,bh,4); ctx.stroke();
          ctx.fillStyle='white'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(en.phrase.length>22?en.phrase.slice(0,21)+'…':en.phrase, bx+bw/2, by+bh/2);
        }
        ctx.restore();
      }

      // ─ Preguntas (texto pequeño, siempre visible) ─
      for (const st of ref.stations) {
        if (st.answered) continue;
        const rawSx = st.cx-cx;
        // Clampear dentro del viewport para que siempre sea legible
        const sx = Math.max(100, Math.min(CW-100, rawSx));
        const sy = st.qY-cy;
        if (sy<-50||sy>CH+30) continue;

        ctx.save();
        ctx.font='bold 11px Arial';
        const tw=ctx.measureText(st.qText).width;
        const bw=Math.min(tw+18,CW-20), bh=20;
        ctx.fillStyle='rgba(0,0,0,0.85)';
        rr(ctx,sx-bw/2,sy-bh/2,bw,bh,5); ctx.fill();
        ctx.strokeStyle='#f1c40f'; ctx.lineWidth=1.5;
        rr(ctx,sx-bw/2,sy-bh/2,bw,bh,5); ctx.stroke();
        ctx.fillStyle='#f1c40f'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(st.qText.length>36?st.qText.slice(0,35)+'…':st.qText, sx, sy);
        ctx.restore();
      }

      // ─ Bloques de respuesta ─
      for (const blk of ref.ansBlocks) {
        const rawSx = blk.x-cx;
        // Clampear al viewport (siempre visibles aunque la plataforma esté en el borde)
        const sx = Math.max(4, Math.min(CW-blk.w-4, rawSx));
        const shake=blk.shakeT>0?Math.sin(blk.shakeT*2)*3:0;
        if (blk.shakeT>0) blk.shakeT--;
        const sy=blk.y-cy+shake;
        if (sy>CH+20||sy<-30) continue;

        ctx.globalAlpha=blk.hit?0.22:1;
        ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(sx+3,sy+4,blk.w,blk.h);
        ctx.fillStyle=blk.color; rr(ctx,sx,sy,blk.w,blk.h,5); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(sx+2,sy+2,blk.w-4,4);
        ctx.fillStyle='white';
        ctx.font=`bold ${blk.text.length>8?8:10}px Arial`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        let t=blk.text; if(t.length>10) t=t.slice(0,9)+'…';
        ctx.fillText(t,sx+blk.w/2,sy+blk.h/2);
        ctx.globalAlpha=1;
      }

      // ─ Flechitas bajo bloques ─
      const pulse=0.5+0.5*Math.sin(ref.frame*0.1);
      for (const st of ref.stations) {
        if (st.answered) continue;
        ref.ansBlocks.filter(b=>b.stIdx===st.idx).forEach(blk=>{
          const rawSx=blk.x-cx;
          const sx=Math.max(4,Math.min(CW-blk.w-4,rawSx));
          const sy=blk.y-cy+blk.h+10;
          if(sy<-10||sy>CH+10) return;
          ctx.globalAlpha=pulse*0.65; ctx.fillStyle=blk.color;
          ctx.font='8px Arial'; ctx.textAlign='center';
          ctx.fillText('▲',sx+blk.w/2,sy); ctx.globalAlpha=1;
        });
      }

      // ─ Jugador ─
      const px=p.x-cx, py=p.y-cy;
      // Parpadeo de invulnerabilidad
      if (p.invulnerable>0 && Math.floor(p.invulnerable/5)%2===0) {
        // Skip drawing player every other 5 frames
      } else {
        ctx.save();
        if (p.facing<0) {
          ctx.translate(px+PLAYER_W/2,py+PLAYER_H/2); ctx.scale(-1,1);
          ctx.translate(-(px+PLAYER_W/2),-(py+PLAYER_H/2));
        }
        const sw=sprite?.complete&&sprite.naturalWidth>0;
        if (sw) {
          const fw=sprite.width/2, fh=sprite.height/2;
          ctx.drawImage(sprite,p.frameX*fw,p.frameY*fh,fw,fh,px,py,PLAYER_W,PLAYER_H);
        } else {
          ctx.fillStyle='#c0392b'; ctx.fillRect(px+6,py,PLAYER_W-12,PLAYER_H-14);
          ctx.fillStyle='#f1c40f'; ctx.fillRect(px+11,py+8,11,8); ctx.fillRect(px+34,py+8,11,8);
          ctx.fillStyle='#c0392b'; ctx.fillRect(px+8,py+PLAYER_H-13,13,13); ctx.fillRect(px+35,py+PLAYER_H-13,13,13);
        }
        ctx.restore();
      }

      // ─ Mini mapa progreso ─
      const tot=ref.stations.length;
      const mw=tot*20, mx0=CW/2-mw/2;
      for(let i=0;i<tot;i++){
        ctx.fillStyle=ref.stations[i].answered?'#2ecc71':'rgba(255,255,255,0.18)';
        rr(ctx,mx0+i*20,6,16,9,3); ctx.fill();
        if(ref.stations[i].answered){ ctx.fillStyle='#fff'; ctx.font='7px Arial'; ctx.textAlign='center'; ctx.fillText('✓',mx0+i*20+8,13); }
      }

      // ─ Flecha hacia pregunta más cercana pendiente ─
      const pend=ref.stations.filter(s=>!s.answered);
      if(pend.length>0){
        const wx=p.x+PLAYER_W/2, wy=p.y+PLAYER_H/2;
        const near=pend.reduce((a,b)=>Math.hypot(a.cx-wx,(a.qY+30)-wy)<Math.hypot(b.cx-wx,(b.qY+30)-wy)?a:b);
        const dx=near.cx-wx, dy=near.qY-wy;
        if(Math.hypot(dx,dy)>280){
          const ang=Math.atan2(dy,dx);
          const ax=CW/2+Math.cos(ang)*175, ay=CH/2+Math.sin(ang)*115;
          ctx.save(); ctx.translate(ax,ay); ctx.rotate(ang);
          ctx.fillStyle='rgba(241,196,15,0.85)';
          ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-7,6); ctx.lineTo(-7,-6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }

      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[fase,nivelIdx]);

  // ── Controles teclado ──
  useEffect(()=>{
    if(fase!=='PLAYING') return;
    const kd=e=>{
      const ref=g.current;
      if(e.key==='ArrowRight'||e.key==='d'){ e.preventDefault(); ref.keys.right=true; }
      if(e.key==='ArrowLeft' ||e.key==='a'){ e.preventDefault(); ref.keys.left=true;  }
      if((e.key==='ArrowUp'||e.key==='w'||e.key===' ')){
        e.preventDefault();
        const p=ref.player;
        if(p.onGround||p.coyote>0){ p.vy=JUMP_POWER; p.onGround=false; p.coyote=0; snd('jump'); }
        else p.jumpBuffer=JBUF_F;
      }
    };
    const ku=e=>{
      const ref=g.current;
      if(e.key==='ArrowRight'||e.key==='d') ref.keys.right=false;
      if(e.key==='ArrowLeft' ||e.key==='a') ref.keys.left=false;
    };
    window.addEventListener('keydown',kd); window.addEventListener('keyup',ku);
    return ()=>{ window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  },[fase]);

  // ── Pointer Events (multi-touch) ──
  const ptrL = useCallback((e,down)=>{ e.preventDefault(); try{down?e.target.setPointerCapture(e.pointerId):e.target.releasePointerCapture(e.pointerId);}catch(_){} g.current.keys.left=down; },[]);
  const ptrR = useCallback((e,down)=>{ e.preventDefault(); try{down?e.target.setPointerCapture(e.pointerId):e.target.releasePointerCapture(e.pointerId);}catch(_){} g.current.keys.right=down; },[]);
  const ptrJ = useCallback((e)=>{
    e.preventDefault();
    const p=g.current.player;
    if(p.onGround||p.coyote>0){ p.vy=JUMP_POWER; p.onGround=false; p.coyote=0; snd('jump'); }
    else p.jumpBuffer=JBUF_F;
  },[]);

  if(fase==='MENU')    return <PantallaMenu onEligir={m=>{ setMateria(m); setNivelIdx(0); setLevelStats([]); setFase('INTRO'); }} onExit={onExit}/>;
  if(fase==='INTRO')   return <PantallaIntro materia={materia} nivel={nivelIdx+1} total={4} onStart={()=>iniciar(materia,nivelIdx)} onBack={()=>setFase('MENU')}/>;
  if(fase==='RESUMEN') return <PantallaResumen materia={materia} levelStats={levelStats} onMenu={()=>{ setLevelStats([]); setFase('MENU'); }}/>;
  if(fase==='FIN')     return <PantallaFin materia={materia} score={score} aciertos={aciertos} total={totalQ} hayMas={nivelIdx+1<4}
    onSiguiente={()=>{ setNivelIdx(nivelIdx+1); setFase('INTRO'); }}
    onReintentar={()=>setFase('INTRO')}
    onMenu={()=>setFase('MENU')}/>;

  const mat=MATERIAS[materia];
  return (
    <div style={{ width:'100%', minHeight:'100vh', background:'#0a0a0a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', userSelect:'none', WebkitUserSelect:'none', touchAction:'none' }}>

      <div style={{ width:'100%', maxWidth:CW, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 10px', boxSizing:'border-box' }}>
        <button onClick={()=>setFase('MENU')} style={{ padding:'3px 10px', borderRadius:18, border:'1.5px solid rgba(255,255,255,0.14)', background:'transparent', color:'rgba(255,255,255,0.38)', cursor:'pointer', fontSize:'0.74rem', fontFamily:'inherit' }}>← Menú</button>
        <span style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.76rem' }}>{mat.emoji} {mat.label} · Nivel {nivelIdx+1}</span>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {/* Contador de aciertos (solo preguntas) */}
          <span style={{ background:'#2980b9', color:'white', padding:'2px 9px', borderRadius:18, fontWeight:'bold', fontSize:'0.82rem' }}>
            ✔ {aciertos}/{totalQ}
          </span>
          {/* Puntos totales */}
          <span style={{ background:'#f1c40f', color:'#1a1a2e', padding:'2px 9px', borderRadius:18, fontWeight:'bold', fontSize:'0.82rem' }}>
            ⭐ {Math.max(0,score)}
          </span>
        </div>
      </div>

      <div style={{ position:'relative', touchAction:'none' }}>
        <canvas ref={canvasRef} style={{ display:'block', maxWidth:'100%', borderRadius:8, boxShadow:'0 0 36px rgba(0,0,0,0.7)', border:'2px solid #1a1a1a', touchAction:'none' }}/>
        {feedUI&&(
          <div style={{ position:'absolute', top:'36%', left:'50%', transform:'translate(-50%,-50%)',
            background:feedUI.ok?'rgba(39,174,96,0.93)':'rgba(192,57,43,0.93)',
            color:'white', padding:'10px 22px', borderRadius:12, fontSize:'1.05rem',
            fontWeight:'bold', fontFamily:'Arial', pointerEvents:'none', whiteSpace:'nowrap',
            boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>{feedUI.text}
          </div>
        )}
      </div>

      {/* Controles táctiles */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', maxWidth:CW, padding:'8px 12px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', gap:8 }}>
          <Btn onDown={e=>ptrL(e,true)} onUp={e=>ptrL(e,false)}>◀</Btn>
          <Btn onDown={e=>ptrR(e,true)} onUp={e=>ptrR(e,false)}>▶</Btn>
        </div>
        <Btn onDown={ptrJ} accent>▲ SALTAR</Btn>
      </div>

      <div style={{ color:'rgba(255,255,255,0.18)', fontSize:'0.64rem', marginTop:2 }}>
        ← → moverse · ↑/Espacio saltar · golpea los bloques desde abajo
      </div>
    </div>
  );
}

function Btn({ children, onDown, onUp=()=>{}, accent=false }) {
  return (
    <button
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp}
      style={{ width:accent?120:56, height:50, borderRadius:10, border:'none',
        background:accent?'#f1c40f':'#2c3e50', color:accent?'#1a1a2e':'white',
        fontWeight:'bold', fontSize:accent?'0.85rem':'1.3rem', cursor:'pointer',
        userSelect:'none', WebkitUserSelect:'none', fontFamily:'Arial',
        boxShadow:'0 3px 10px rgba(0,0,0,0.4)', touchAction:'none' }}>
      {children}
    </button>
  );
}

function rr(ctx,x,y,w,h,r=5){
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
