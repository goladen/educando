import { validarNombre } from './utils/filtroNombres';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { db } from './firebase';
import { conRecursosPikt } from './bancoPreguntas/recursosPikt';
import { MATERIAS_PLATAFORMAS as MATERIAS } from './bancoPreguntas/datos/plataformas';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { collection, getDocs, query, where, limit, addDoc, doc, getDoc } from 'firebase/firestore';

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
import { leerCompeticionUrl, soloPrimitivos } from './utils/retoLink';
import ModalEnviarCompeticion from './components/ModalEnviarCompeticion';
import BotonPdfRecurso from './components/BotonPdfRecurso';
import BuscarFichaCodigo from './components/BuscarFichaCodigo';
import FichaFlotante from './components/FichaFlotante';
import MandosEnJuego from './mandos/RelevosMandos.jsx';
import { dibujarAjustado } from './utils/encajeTexto';
import { BotonPantallaDual, ladoMitadDual } from './components/JuegoDual';
// Jugar con el cuerpo (webcam): girar la cabeza = andar, saltar = saltar. Se carga al activarlo.
const PanelControlCuerpo = React.lazy(() => import('./cuerpo/PanelControlCuerpo.jsx'));
const LS_CUERPO = 'pikt_plataformas_cuerpo';

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
//  MOTOR MATEMÁTICO (compatible con recursos PRO-BURBUJAS/Pikatron)
// ══════════════════════════════════════════════════════════════════════════════
const generarPreguntasMatematicas = (config) => {
  const questions = [];
  const count = parseInt(config.mathCount || 0);
  if (count <= 0) return [];
  const types = config.mathTypes || ['POSITIVOS'];
  const ops   = config.mathOps   || ['SUMA'];
  const min   = parseInt(config.mathMin || 1);
  const max   = parseInt(config.mathMax || 10);
  const ri    = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const rf    = (a,b) => (Math.random()*(b-a)+a).toFixed(1);
  const gcd   = (a,b) => b===0?a:gcd(b,a%b);
  const simp  = (n,d) => { const g=gcd(Math.abs(n),Math.abs(d)); return {n:n/g,d:d/g}; };
  for (let i=0;i<count;i++) {
    const type=types[i%types.length], op=ops[i%ops.length];
    let pObj={pregunta:'',respuesta:'',incorrectas:[]};
    const isFrac=type==='FRACCIONES', isDec=type==='DECIMALES', isNeg=type==='NEGATIVOS';
    if (isFrac) {
      const n1=ri(min,max),d1=ri(min,max),n2=ri(min,max),d2=ri(min,max);
      let rN,rD,sym;
      if(op==='SUMA'){sym='+';rN=n1*d2+n2*d1;rD=d1*d2;}
      else if(op==='RESTA'){sym='-';rN=n1*d2-n2*d1;rD=d1*d2;}
      else if(op==='MULT'){sym='·';rN=n1*n2;rD=d1*d2;}
      else{sym=':';rN=n1*d2;rD=d1*n2;}
      const s=simp(rN,rD); if(s.d<0){s.n=-s.n;s.d=-s.d;}
      pObj.pregunta=`${n1}/${d1} ${sym} ${n2}/${d2}`;
      pObj.respuesta=`${s.n}/${s.d}`;
      pObj.incorrectas=[`${s.n+1}/${s.d}`,`${s.n}/${s.d+1}`,`${s.d}/${s.n}`].filter(x=>x!==pObj.respuesta);
    } else {
      const gv=()=>{let v=isDec?parseFloat(rf(min,max)):ri(min,max);if(isNeg&&Math.random()>.5)v=-v;return v;};
      let a=gv(),b=gv(),res,la,lb,sym;
      if(op==='DIV'){if(b===0)b=1;if(!isDec){const rt=isNeg?(Math.random()>.5?-ri(min,max):ri(min,max)):ri(min,max);a=b*rt;}}
      if(op==='SUMA'){sym='+';res=a+b;}else if(op==='RESTA'){sym='-';res=a-b;}
      else if(op==='MULT'){sym='·';res=a*b;}else{sym=':';res=a/b;}
      if(isDec||!Number.isInteger(res)){res=parseFloat(res.toFixed(1));pObj.respuesta=String(res).replace('.',',');la=String(a).replace('.',',');lb=String(b).replace('.',',');}
      else{pObj.respuesta=String(res);la=String(a);lb=String(b);}
      if(b<0)lb=`(${lb})`;
      pObj.pregunta=`${la} ${sym} ${lb}`;
      pObj.incorrectas=[String(isDec?(res+1).toFixed(1).replace('.',','):res+1),String(isDec?(res-1).toFixed(1).replace('.',','):res-1),String(isDec?(res+10).toFixed(1).replace('.',','):res+10)];
    }
    questions.push(pObj);
  }
  return questions;
};

// Normaliza una pregunta de cualquier formato a {q, a, inc[]}
const normQ = p => ({
  q:   p.pregunta || p.q || '',
  a:   p.respuesta || p.correcta || p.a || '',
  inc: p.incorrectas || p.inc || [],
});

// Extrae hasta N preguntas de una hoja (aleatorio o en orden)
const extraerPreguntas = (hoja, n=5, aleatorio=true) => {
  const esProBurbujas = hoja.mathConfig && parseInt(hoja.mathConfig.mathCount||0)>0;
  let pool = [...(hoja.preguntas||[])].map(normQ);
  if (esProBurbujas) pool = [...pool, ...generarPreguntasMatematicas(hoja.mathConfig).map(normQ)];
  if (aleatorio) pool.sort(()=>Math.random()-.5);
  return pool.slice(0, n);
};

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
const ANS_GAP  = 10;
const ANS_H    = 56;
const ANS_ABOVE = 152;  // px sobre la plataforma (separación respecto al tope)

function getAnsLayout(platW, n = 4) {
  // Los bloques ocupan casi todo el ancho de la plataforma (siguen al alcance desde ella)
  const blockW = Math.max(40, Math.min(130, Math.floor((platW + 10 - (n - 1) * ANS_GAP) / n)));
  const totalW = n * blockW + (n - 1) * ANS_GAP;
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
// (MATERIAS vive en bancoPreguntas/datos/plataformas.js: se comparte con las Preguntas de PiKT)

const BG_THEMES = ['#0d2b1a','#0d1a3a','#2a0d0d','#111820'];
const GR_COLORS = ['#3d8b2a','#2c3e50','#6b1e1e','#2a3a28'];

// ──────────────────────────────────────────────────────────────────────────────
//  UI SCREENS
// ──────────────────────────────────────────────────────────────────────────────
function Scr({ children }) {
  // margin:auto centra sin cortar la parte de arriba cuando no cabe (pantallas bajas)
  return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(ellipse at 50% 15%, #2a2f5a 0%, #1a1a2e 55%, #0d0d20 100%)', display:'flex', flexDirection:'column', padding:20, boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}>
      <div style={{ margin:'auto', display:'flex', flexDirection:'column', alignItems:'center', width:'100%' }}>{children}</div>
    </div>
  );
}

// Normaliza texto quitando tildes y pasando a minúsculas (igual que LandingGames)
const cleanText = (str) => {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
};

// ══════════════════════════════════════════════════════════════════════════════
//  BUSCADOR DE RECURSOS — lógica idéntica a SpecificGamePage de LandingGames3
//  Solo muestra recursos de CAZABURBUJAS / PIKATRON que estén terminados.
//  Filtros: tema/título, ciclo, código de acceso, país, región, autor.
// ══════════════════════════════════════════════════════════════════════════════
function BuscadorRecursos({ onSelect }) {
  const [filtros,     setFiltros]     = useState({ tema:'', ciclo:'' });
  const [codigo,      setCodigo]      = useState('');
  const [pais,        setPais]        = useState('');
  const [region,      setRegion]      = useState('');
  const [autor,       setAutor]       = useState('');
  const [avanzado,    setAvanzado]    = useState(false);
  const [resultados,  setResultados]  = useState([]);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState('');
  const [buscado,     setBuscado]     = useState(false);

  const buscar = async () => {
    setCargando(true); setError(''); setResultados([]); setBuscado(true);
    try {
      const ref = collection(db, 'resources');
      let filtrados = [];

      if (codigo.trim()) {
        // Búsqueda por código de acceso exacto
        const q = query(ref, where('accessCode', '==', codigo.toUpperCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const esValido = data.tipoJuego === 'CAZABURBUJAS' || data.tipoJuego === 'PIKATRON';
          if (esValido) filtrados = [{ ...data, id: snap.docs[0].id }];
          else setError('Este código pertenece a otro tipo de juego.');
        } else {
          setError('Código no encontrado.');
        }
      } else {
        // Búsqueda general: limit(150) sin índices compuestos, filtrado client-side
        const snap = await getDocs(query(ref, limit(150)));
        filtrados = snap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter(r => {
            // Solo CAZABURBUJAS y PIKATRON
            if (r.tipoJuego !== 'CAZABURBUJAS' && r.tipoJuego !== 'PIKATRON') return false;
            // Solo recursos marcados como terminados
            if (r.isFinished !== true && r.config?.isFinished !== true) return false;
            // Filtro tema: busca en temas y en titulo
            if (filtros.tema && !cleanText(r.temas).includes(cleanText(filtros.tema))
                             && !cleanText(r.titulo).includes(cleanText(filtros.tema))) return false;
            // Filtro ciclo: comparación exacta (igual que LandingGames)
            if (filtros.ciclo && cleanText(r.ciclo) !== cleanText(filtros.ciclo)
                              && cleanText(r.config?.ciclo) !== cleanText(filtros.ciclo)) return false;
            // Filtros avanzados
            if (pais   && !cleanText(r.pais).includes(cleanText(pais)))             return false;
            if (region && !cleanText(r.region).includes(cleanText(region)))          return false;
            if (autor  && !cleanText(r.profesorNombre).includes(cleanText(autor)))   return false;
            return true;
          });
        // Preguntas de PiKT por etapa y materia, detrás de los recursos de los profes (sin filtros de lugar/autor)
        if (!pais && !region && !autor) filtrados = await conRecursosPikt(filtrados, 'CAZABURBUJAS', filtros);
        if (filtrados.length === 0) setError('Sin resultados con esos filtros.');
      }
      setResultados(filtrados);
    } catch(e) {
      console.error('BuscadorRecursos:', e);
      setError('Error al conectar. Comprueba la consola.');
    }
    setCargando(false);
  };

  const inp = { padding:'7px 9px', borderRadius:8, border:'1.5px solid rgba(255,255,255,0.18)',
    background:'rgba(255,255,255,0.07)', color:'white', fontFamily:'inherit', fontSize:'0.82rem', width:'100%', boxSizing:'border-box' };
  const sel = { ...inp, appearance:'none' };

  return (
    <div style={{ width:'100%', maxWidth:420, marginTop:10 }}>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'12px 14px', border:'1px solid rgba(255,255,255,0.12)' }}>

        <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.55)', marginBottom:10, fontWeight:'bold', letterSpacing:'.5px' }}>
          🔍 USAR UN RECURSO PROPIO (Burbujas / Pikatron)
        </div>

        <BuscarFichaCodigo oscuro style={{ marginBottom: 8 }} />
        {/* Fila 1: Tema + Ciclo */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
          <input style={inp} placeholder="Tema o título…" value={filtros.tema}
            onChange={e=>setFiltros({...filtros,tema:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&buscar()} />
          <select style={sel} value={filtros.ciclo} onChange={e=>setFiltros({...filtros,ciclo:e.target.value})}>
            <option value="">Cualquier ciclo</option>
            <option value="Infantil">Infantil</option>
            <option value="Primaria">Primaria</option>
            <option value="Secundaria">Secundaria</option>
            <option value="Bachillerato">Bachillerato</option>
            <option value="FP">FP</option>
            <option value="Otros">Otros</option>
          </select>
        </div>

        {/* Filtros avanzados toggle */}
        <button onClick={()=>setAvanzado(!avanzado)}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:'0.73rem', padding:'2px 0', marginBottom:avanzado?6:0, fontFamily:'inherit' }}>
          {avanzado ? '▲ Menos filtros' : '▼ Búsqueda avanzada y código'}
        </button>

        {avanzado && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8, background:'rgba(0,0,0,0.2)', borderRadius:8, padding:8 }}>
            <input style={inp} placeholder="CÓDIGO (4-5 letras)" value={codigo}
              onChange={e=>setCodigo(e.target.value.toUpperCase())} maxLength={6} />
            <input style={inp} placeholder="País" value={pais} onChange={e=>setPais(e.target.value)} />
            <input style={inp} placeholder="Región/Provincia" value={region} onChange={e=>setRegion(e.target.value)} />
            <input style={inp} placeholder="Autor/Profesor" value={autor} onChange={e=>setAutor(e.target.value)} />
          </div>
        )}

        {/* Botón buscar */}
        <button onClick={buscar} disabled={cargando}
          style={{ width:'100%', padding:'9px', borderRadius:8, border:'none', background:'#2980b9', color:'white',
            fontWeight:'bold', cursor:'pointer', fontFamily:'inherit', fontSize:'0.88rem', marginTop:2,
            opacity:cargando?0.6:1 }}>
          {cargando ? 'Buscando…' : 'Buscar en Burbujas / Pikatron'}
        </button>

        {error && <div style={{ fontSize:'0.73rem', color:'#e74c3c', marginTop:6 }}>{error}</div>}
        {!error && buscado && !cargando &&
          <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', marginTop:5 }}>
            {resultados.length} recurso(s) encontrado(s)
          </div>
        }

        {/* Tarjetas de resultados */}
        {resultados.length > 0 && (
          <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6, maxHeight:230, overflowY:'auto' }}>
            {resultados.map(r => (
              <button key={r.id} onClick={()=>onSelect(r)}
                style={{ padding:'9px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.14)',
                  background:'rgba(255,255,255,0.06)', color:'white', cursor:'pointer', textAlign:'left',
                  fontFamily:'inherit', width:'100%' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6 }}>
                  <span style={{ fontWeight:'bold', fontSize:'0.85rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {r.titulo || '(Sin título)'}
                  </span>
                  <span style={{ fontSize:'0.65rem', background:'rgba(52,152,219,0.3)', padding:'2px 6px', borderRadius:6, whiteSpace:'nowrap', flexShrink:0 }}>
                    {r.tipoJuego==='PIKATRON'?'⚡ Pikatron':'🔵 Burbujas'}
                  </span>
                  <BotonPdfRecurso recurso={r} enLinea texto="" style={{ padding:'2px 6px', fontSize:'0.7rem' }} />
                </div>
                <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', marginTop:3, display:'flex', gap:10 }}>
                  <span>📚 {r.temas||'General'}</span>
                  <span>🎓 {r.ciclo||r.config?.ciclo||'Todos'}</span>
                  {r.accessCode && <span style={{ color:'rgba(255,255,255,0.25)' }}>🔑 {r.accessCode}</span>}
                </div>
                {(r.hojas||[]).length>0 && (
                  <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', marginTop:2 }}>
                    {r.hojas.map(h=>h.nombreHoja||'Hoja').join(' · ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Selector de hoja / modo de juego para un recurso ──────────────────────────
function PantallaSelectorHoja({ recurso, onJugar, onBack }) {
  const hojas = recurso.hojas || [];
  const numHojas = Math.min(hojas.length, 4);
  const [modo, setModo] = useState(hojas.length>1?'PANTALLAS':'HOJA');
  const [hojaIdx, setHojaIdx] = useState(0);

  const canPantallas = hojas.length >= 2;

  return (
    <Scr>
      <div style={{ fontSize:'2.6rem', marginBottom:4 }}>📦</div>
      <h2 style={{ color:'#f1c40f', fontSize:'1.4rem', margin:'0 0 4px', textShadow:'2px 2px 0 #000', textAlign:'center', maxWidth:380 }}>
        {recurso.titulo||'Recurso'}
      </h2>
      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.76rem', margin:'0 0 18px' }}>
        {hojas.length} hoja(s) · {recurso.tipo||'Manual'}
      </p>

      {/* Selector de modo */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {canPantallas && (
          <button onClick={()=>setModo('PANTALLAS')}
            style={{ padding:'8px 18px', borderRadius:20, border:`2px solid ${modo==='PANTALLAS'?'#f1c40f':'rgba(255,255,255,0.2)'}`,
              background:modo==='PANTALLAS'?'rgba(241,196,15,0.15)':'transparent',
              color:modo==='PANTALLAS'?'#f1c40f':'rgba(255,255,255,0.5)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' }}>
            🗺 {numHojas} Pantallas
          </button>
        )}
        <button onClick={()=>setModo('HOJA')}
          style={{ padding:'8px 18px', borderRadius:20, border:`2px solid ${modo==='HOJA'?'#3498db':'rgba(255,255,255,0.2)'}`,
            background:modo==='HOJA'?'rgba(52,152,219,0.15)':'transparent',
            color:modo==='HOJA'?'#7ec8f7':'rgba(255,255,255,0.5)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' }}>
          📄 Un nivel
        </button>
      </div>

      {/* Selector de hoja (solo en modo HOJA) */}
      {modo==='HOJA' && hojas.length>1 && (
        <div style={{ marginBottom:16, width:'100%', maxWidth:320 }}>
          <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.45)', marginBottom:6 }}>Elegir hoja:</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {hojas.map((h,i)=>(
              <button key={i} onClick={()=>setHojaIdx(i)}
                style={{ padding:'7px 14px', borderRadius:8, border:`2px solid ${hojaIdx===i?'#3498db':'rgba(255,255,255,0.12)'}`,
                  background:hojaIdx===i?'rgba(52,152,219,0.18)':'rgba(255,255,255,0.04)',
                  color:'white', cursor:'pointer', textAlign:'left', fontFamily:'inherit', fontSize:'0.84rem' }}>
                {h.nombreHoja||`Hoja ${i+1}`}
                <span style={{ marginLeft:8, fontSize:'0.7rem', color:'rgba(255,255,255,0.35)' }}>
                  {(h.preguntas||[]).length} preguntas
                  {h.preguntaEspecial?.activo?' · frases':''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 16px', maxWidth:320, fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', lineHeight:1.7, marginBottom:18, textAlign:'center' }}>
        {modo==='PANTALLAS'
          ? `Se jugarán ${numHojas} pantallas (1 por hoja), 5 preguntas c/u.${recurso.config?.aleatorio!==false?' Orden aleatorio.':' Primeras 5 de cada hoja.'}`
          : `Se juega 1 nivel con la hoja seleccionada (5 preguntas).`}
        {' '}Los enemigos{' '}
        {(hojas[hojaIdx]?.preguntaEspecial?.activo || hojas.some(h=>h.preguntaEspecial?.activo))
          ? 'usarán las frases del recurso.'
          : 'no aparecen (sin frases especiales).'}
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onBack} style={{ padding:'8px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.18)', background:'transparent', color:'rgba(255,255,255,0.45)', cursor:'pointer', fontFamily:'inherit' }}>← Atrás</button>
        <button onClick={()=>onJugar({ recurso, modo, hojaIdx })}
          style={{ padding:'11px 32px', borderRadius:28, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }}>
          ▶ ¡Jugar!
        </button>
      </div>
      <div style={{ width:'100%', maxWidth:320, marginTop:14 }}>
        <BotonPantallaDual recurso={recurso} modo="PLATAFORMAS" style={{ marginBottom:0 }} />
      </div>
    </Scr>
  );
}

function PantallaMenu({ onEligir, onRecurso, onExit }) {
  const [recursoSeleccionado, setRecursoSeleccionado] = useState(null);

  if (recursoSeleccionado) {
    return (
      <>
        <PantallaSelectorHoja
          recurso={recursoSeleccionado}
          onJugar={onRecurso}
          onBack={()=>setRecursoSeleccionado(null)}
        />
        <FichaFlotante recurso={recursoSeleccionado} />
      </>
    );
  }

  return (
    <Scr>
      <div style={{ fontSize:'2.6rem', marginBottom:4 }}>🎮</div>
      <h1 style={{ color:'#f1c40f', fontSize:'2rem', margin:'0 0 4px', textShadow:'2px 2px 0 #000' }}>Quiz Plataformas</h1>
      <p style={{ color:'rgba(255,255,255,0.5)', margin:'4px 0 20px', fontSize:'0.8rem', textAlign:'center', lineHeight:1.6 }}>
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

      {/* ── Separador ── */}
      <div style={{ width:'100%', maxWidth:420, display:'flex', alignItems:'center', gap:10, margin:'18px 0 0' }}>
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
        <span style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.3)' }}>o usa tus propios recursos</span>
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
      </div>

      <BuscadorRecursos onSelect={setRecursoSeleccionado} />

      {onExit && <button onClick={onExit} style={{ marginTop:18, padding:'7px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.38)', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem' }}>← Salir</button>}
    </Scr>
  );
}

function PantallaIntro({ materia, nivel, total, hasEnemigos, onStart, onBack, cuerpo, onCuerpo }) {
  const m = materia ? MATERIAS[materia] : null;
  const ladoDual = ladoMitadDual();
  return (
    <Scr>
      <div style={{ fontSize:'3.5rem' }}>{m?m.emoji:'📦'}</div>
      <h2 style={{ color:'white', fontSize:'1.4rem', margin:'8px 0' }}>{m?m.label:'Recurso propio'}</h2>
      <div style={{ background:`${m?m.color:'#2980b9'}33`, border:`3px solid ${m?m.color:'#2980b9'}`, borderRadius:14, padding:'10px 30px', color:'white', fontSize:'1.15rem', fontWeight:'bold', marginBottom:16 }}>
        Nivel {nivel} de {total}
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'14px 20px', maxWidth:340, color:'rgba(255,255,255,0.78)', lineHeight:1.8, fontSize:'0.84rem', textAlign:'center', marginBottom:20 }}>
        {ladoDual===0 ? <>🕹️ <strong>A D</strong> moverse · <strong>W</strong> saltar<br/></>
          : ladoDual===1 ? <>🕹️ <strong>← →</strong> moverse · <strong>↑</strong> saltar<br/></>
          : <>🕹️ <strong>← →</strong> moverse · <strong>↑/Espacio</strong> saltar · o los botones en pantalla<br/></>}
        Golpea los bloques de colores <strong>desde abajo</strong><br/>
        🟡 Recoge monedas{hasEnemigos?' · ☠️ Lee la frase del enemigo antes de tocarlo':''}
      </div>
      {onCuerpo && (
        <button onClick={onCuerpo}
          style={{ marginBottom:16, padding:'8px 16px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontWeight:'bold', fontSize:'0.85rem',
            border:`2px solid ${cuerpo?'#22c55e':'rgba(255,255,255,0.25)'}`, background:cuerpo?'rgba(34,197,94,0.18)':'transparent', color:'white' }}>
          🕺 Jugar con el cuerpo (webcam): {cuerpo ? 'SÍ' : 'no'}
          {cuerpo && <div style={{ fontWeight:'normal', fontSize:'0.74rem', opacity:0.8, marginTop:3 }}>Estira el brazo derecho para ir a la derecha, el izquierdo para ir a la izquierda, bájalos para pararte y salta de verdad para saltar</div>}
        </button>
      )}
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onBack} style={{ padding:'8px 18px', borderRadius:20, border:'1.5px solid rgba(255,255,255,0.18)', background:'transparent', color:'rgba(255,255,255,0.45)', cursor:'pointer', fontFamily:'inherit' }}>← Atrás</button>
        <button onClick={onStart} style={{ padding:'11px 32px', borderRadius:28, border:'none', background:'#f1c40f', color:'#1a1a2e', fontWeight:'bold', fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }}>▶ ¡Empezar!</button>
      </div>
      <div style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.75rem', marginTop:10 }}>o pulsa {ladoDual===0 ? 'W' : ladoDual===1 ? '↑' : 'Espacio / Enter'}</div>
    </Scr>
  );
}

// Enlace de competición (&comp=…&cat=…): la puntuación va a esa prueba, no al profesor
function ModalEnviarProfe(p) {
    const comp = leerCompeticionUrl();
    if (comp) return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.datos?.aciertos) || 0}
        detalle={soloPrimitivos(p.datos)} nombreJuego="Plataformas" tituloReto={comp.titulo} onClose={p.onClose} />;
    return <ModalEnviarProfeBase {...p} />;
}

function ModalEnviarProfeBase({ datos, onClose }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [curso,  setCurso]  = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!validarNombre(nombre).ok) { setError(validarNombre(nombre).mensaje); return; }
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
      if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'PLATAFORMAS', modalidad: 'Individual', fecha: new Date(),
        recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
        hoja: datos.hoja, codigoProfesor: code,
        jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, fallos: 0, hoja: datos.hoja }],
      });
      guardarRegistroLocal('PLATAFORMAS', {
        titulo: datos.recursoTitulo, aciertos: datos.aciertos,
        nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
      });
      setEnviado(true);
    } catch(e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.75)', zIndex:10000, display:'flex', justifyContent:'center', alignItems:'center' }}>
      <div style={{ background:'#1e272e', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, width:'100%', maxWidth:380, padding:'26px 28px', boxShadow:'0 30px 80px rgba(0,0,0,0.7)', color:'white', fontFamily:"'Segoe UI', sans-serif" }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:'1.05rem', color:'#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:'1.2rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:'3rem', marginBottom:10 }}>✅</div>
            <div style={{ color:'#2ecc71', fontWeight:700, fontSize:'1.1rem' }}>¡Informe enviado!</div>
            <div style={{ marginTop:8, color:'#aaa', fontSize:'0.9rem' }}>{datos.aciertos} aciertos</div>
            <button onClick={onClose} style={{ marginTop:16, padding:'9px 22px', borderRadius:10, border:'none', background:'rgba(255,255,255,0.1)', cursor:'pointer', color:'white', fontFamily:'inherit' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[['nombre','Nombre y apellido',nombre,setNombre,'Tu nombre completo',false],
              ['curso','Curso',curso,setCurso,'Ej: 3º ESO A',false],
              ['codigo','Código del profesor',codigo,v=>setCodigo(v.toUpperCase()),'Ej: PROF01',true]
            ].map(([key,label,val,setter,ph,mono])=>(
              <div key={key}>
                <label style={{ fontSize:'0.78rem', color:'#aaa', fontWeight:600, display:'block', marginBottom:4 }}>{label}</label>
                <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph} maxLength={key==='codigo'?10:undefined}
                  style={{ padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', letterSpacing:mono?2:0, fontWeight:mono?700:400 }}/>
              </div>
            ))}
            {error && <div style={{ color:'#e74c3c', fontSize:'0.8rem' }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:9, marginTop:4 }}>
              <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', cursor:'pointer', color:'white', fontFamily:'inherit' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:enviando?'#555':'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:enviando?'default':'pointer', fontFamily:'inherit' }}>
                {enviando?'Enviando…':'📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PantallaFin({ materia, score, aciertos, total, onReintentar, onSiguiente, onMenu, hayMas, recurso, hoja }) {
  const pct=Math.round(Math.max(0,aciertos)/Math.max(total,1)*100);
  const stars=pct>=80?'⭐⭐⭐':pct>=50?'⭐⭐':'⭐';
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
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
        {recurso && (
          <button onClick={() => setMostrarEnvio(true)} style={{ padding:'10px 18px', borderRadius:20, border:'none', background:'linear-gradient(135deg,#27ae60,#2ecc71)', color:'white', fontWeight:'bold', cursor:'pointer', fontFamily:'inherit' }}>📤 Enviar al profesor</button>
        )}
        <button onClick={onMenu} style={{ padding:'10px 18px', borderRadius:20, border:'2px solid rgba(255,255,255,0.2)', background:'transparent', color:'white', cursor:'pointer', fontFamily:'inherit' }}>🏠 Menú</button>
      </div>
      {mostrarEnvio && recurso && (
        <ModalEnviarProfe
          datos={{ recursoId: recurso.id, recursoTitulo: recurso.titulo, hoja: hoja || 'General', aciertos }}
          onClose={() => setMostrarEnvio(false)}
        />
      )}
    </Scr>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PANTALLA RESUMEN FINAL — confetti, corazones, personaje saltando
// ══════════════════════════════════════════════════════════════════════════════
function PantallaResumen({ materia, recurso, levelStats, onMenu }) {
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
  const mat = materia ? MATERIAS[materia] : null;
  const titulo = mat ? mat.label : (recurso?.titulo || 'Recurso propio');

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

      <div style={{ fontSize:'1.5rem', marginBottom:4 }}>{mat ? mat.emoji : '🎮'} {stars}</div>
      <h1 style={{ color:'#f1c40f', fontSize:'1.8rem', margin:'0 0 4px', textShadow:'2px 2px 0 #000', textAlign:'center' }}>¡Juego completado!</h1>
      <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.82rem', margin:'0 0 20px', textAlign:'center' }}>{titulo} · {levelStats.length} nivel(es)</p>

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
// Envoltorio: los mandos micro:bit (relevos) viven fuera del juego para no perder el marcador entre pantallas.
export default function QuizPlataformas(props) {
  const mandosApi = useRef(null);
  const juegoMandos = useRef({});
  return (
    <>
      <QuizPlataformasJuego {...props} mandosApi={mandosApi} juegoMandos={juegoMandos} />
      <MandosEnJuego clave="PLATAFORMAS" juego="Pikatron 2" tipo="PLATAFORMAS_MANDOS" apiRef={mandosApi}
        teclas={[{ I: 'ArrowLeft', D: 'ArrowRight', F: 'ArrowUp', A: ' ', S: ' ' }]}
        onEvento={(i, ev) => juegoMandos.current.onEvento?.(i, ev)}
        controles={<>Inclina a los lados para andar. <b>A</b>, agitar o inclinar <b>hacia delante</b> = saltar. En las pantallas de inicio y final, <b>agitar</b> empieza o sigue. Con 🔄 relevos, cada nivel lo juega un mando distinto.</>} />
    </>
  );
}

function QuizPlataformasJuego({ onExit, recursoInicial = null, hojaInicial = null, mandosApi, juegoMandos }) {
  const [fase,       setFase]       = useState('MENU');
  const [materia,    setMateria]    = useState(null);
  const [nivelIdx,   setNivelIdx]   = useState(0);
  const [score,      setScore]      = useState(0);
  const [aciertos,   setAciertos]   = useState(0);
  const [feedUI,     setFeedUI]     = useState(null);
  const [totalQ,     setTotalQ]     = useState(5);
  const [levelStats, setLevelStats] = useState([]);
  // Modo recurso propio
  const [recursoActivo,  setRecursoActivo]  = useState(null);   // el recurso Firebase
  const [recursoModo,    setRecursoModo]    = useState(null);   // 'PANTALLAS'|'HOJA'
  const [recursoHojaIdx, setRecursoHojaIdx] = useState(0);
  const [recursoTotalNiv,setRecursoTotalNiv]= useState(1);
  const [hasEnemigos,    setHasEnemigos]    = useState(false);
  const [controlCuerpo,  setControlCuerpo]  = useState(()=>{ try { return localStorage.getItem(LS_CUERPO)==='1'; } catch { return false; } });
  const alternarCuerpo = useCallback(()=>setControlCuerpo(v=>{
    try { localStorage.setItem(LS_CUERPO, v?'0':'1'); } catch { /* sin almacenamiento */ }
    return !v;
  }),[]);

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

  // ── Pantalla completa ──
  const [fullscreen, setFullscreen] = useState(false);
  // Tamaño del canvas en pantalla (cabe entero en el hueco libre: móvil, tablet, PDI, media pantalla dual)
  const zonaRef = useRef(null);
  const [tam, setTam] = useState({ w: CW, h: CH });
  const [esTactil, setEsTactil] = useState(()=>{ try { return (navigator.maxTouchPoints||0)>0 || 'ontouchstart' in window; } catch { return false; } });
  const ladoDual = ladoMitadDual();
  const gameContainerRef = useRef(null);

  const toggleFullscreen = useCallback(async ()=>{
    if (!fullscreen) {
      setFullscreen(true);
      try {
        await gameContainerRef.current?.requestFullscreen?.({ navigationUI:'hide' });
        screen.orientation?.lock?.('landscape').catch(()=>{});
      } catch(_) {}
    } else {
      setFullscreen(false);
      if (document.fullscreenElement) document.exitFullscreen?.();
      screen.orientation?.unlock?.();
    }
  },[fullscreen]);

  useEffect(()=>{
    const onFS = ()=>{ if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFS);
    return ()=> document.removeEventListener('fullscreenchange', onFS);
  },[]);

  useEffect(()=>{
    if (fase!=='PLAYING') return undefined;
    const el = zonaRef.current; if (!el) return undefined;
    const medir = ()=>{
      const r = el.getBoundingClientRect();
      const w = Math.max(240, Math.min(r.width, r.height*CW/CH));
      setTam(t => Math.abs(t.w-w)<1 ? t : { w:Math.floor(w), h:Math.floor(w*CH/CW) });
    };
    medir();
    const ro = typeof ResizeObserver!=='undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener('resize', medir);
    const oc = ()=> setTimeout(medir, 250);
    window.addEventListener('orientationchange', oc);
    return ()=>{ ro?.disconnect(); window.removeEventListener('resize', medir); window.removeEventListener('orientationchange', oc); };
  },[fase, fullscreen]);

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
  // preguntasOverride: array de {q,a,inc[]} ya normalizadas (para modo recurso)
  // frasesOverride:    array de {txt,ok}  (para enemigos del recurso)
  // sinEnemigos:       true en nivel 1 o cuando no hay frases
  const buildLevel = useCallback((mat, niv, layoutIdx, preguntasOverride=null, frasesOverride=null, sinEnemigos=false)=>{
    // Preguntas: usa override si existe, si no usa las de MATERIAS
    let preguntas;
    if (preguntasOverride) {
      preguntas = preguntasOverride;
    } else {
      preguntas = [...MATERIAS[mat].niveles[niv]].sort(()=>Math.random()-.5);
    }
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

      // Opciones válidas (una pregunta puede traer menos de 3 incorrectas)
      const opciones = [
        { text:pq.a, isCorrect:true },
        ...(pq.inc||[]).slice(0,3).map(t=>({ text:t, isCorrect:false })),
      ].filter(o=>o.text!==undefined && o.text!==null && String(o.text).trim()!=='')
       .map(o=>({ ...o, text:String(o.text) }))
       .sort(()=>Math.random()-.5);
      if (!opciones.some(o=>o.isCorrect)) return;
      const { blockW, totalW } = getAnsLayout(plat.w, opciones.length);
      const cx    = plat.x + plat.w/2;
      const blockY= plat.y - ANS_ABOVE;

      // Centrar bloques sobre la plataforma, nunca fuera del nivel con margen
      let startX = cx - totalW/2;
      startX = Math.max(EDGE_MARGIN, Math.min(LEVEL_W - totalW - EDGE_MARGIN, startX));


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
      stations.push({ cx:qCX, qY:blockY-38, qText:String(pq.q||''), answered:false, idx:qi });
    });

    // ── Monedas y enemigos en plataformas sin pregunta ──
    // Frases: usa override del recurso si existe, si no usa las de MATERIAS
    const frasesPoolSource = frasesOverride && frasesOverride.length>0
      ? frasesOverride
      : (mat ? (FRASES[mat]||[]) : []);
    const frasesPool = [...frasesPoolSource].sort(()=>Math.random()-.5);
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

      const noEnemigos = sinEnemigos || frasesPool.length===0;
      if (noEnemigos || Math.random()<0.55) {
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
    setMateria(mat);
    setRecursoActivo(null);
    setHasEnemigos(niv>0);
    buildLevel(mat, niv, (niv*2 + Object.keys(MATERIAS).indexOf(mat)) % LAYOUTS.length,
      null, null, niv===0);
    setFase('PLAYING');
  };

  // Construir frases a partir de preguntaEspecial de una hoja
  const frasesDeHoja = (hoja) => {
    const esp = hoja?.preguntaEspecial;
    if (!esp?.activo) return [];
    const correctas   = (esp.correctas  ||[]).map(txt=>({ txt, ok:true  }));
    const incorrectas = (esp.incorrectas||[]).map(txt=>({ txt, ok:false }));
    return [...correctas,...incorrectas];
  };

  // Iniciar con un recurso propio
  const iniciarRecurso = useCallback(({ recurso, modo, hojaIdx })=>{
    const hojas = recurso.hojas?.length ? recurso.hojas : [{ nombreHoja:'General', preguntas: recurso.preguntas || [] }];
    const aleatorio = recurso.config?.aleatorio !== false;
    setRecursoActivo(recurso);
    setRecursoModo(modo);
    setRecursoHojaIdx(hojaIdx);
    setLevelStats([]);
    setNivelIdx(0);

    if (modo==='PANTALLAS') {
      const numNiv = Math.min(hojas.length, 4);
      setRecursoTotalNiv(numNiv);
      // Construir nivel 0 con la primera hoja
      const hoja0 = hojas[0];
      const pregs0 = extraerPreguntas(hoja0, 5, aleatorio);
      const frases0 = frasesDeHoja(hoja0);
      const hayFrases = hojas.some(h=>h.preguntaEspecial?.activo);
      setHasEnemigos(hayFrases);
      buildLevel(null, 0, 0, pregs0, frases0, !hayFrases);
    } else {
      const hoja = hojas[hojaIdx] || hojas[0] || { preguntas:[] };
      setRecursoTotalNiv(1);
      const pregs = extraerPreguntas(hoja, 5, aleatorio);
      const frases = frasesDeHoja(hoja);
      setHasEnemigos(frases.length>0);
      buildLevel(null, 0, hojaIdx % LAYOUTS.length, pregs, frases, frases.length===0);
    }
    setMateria(null);
    setFase('INTRO_REC');
  },[buildLevel]);

  // ── Game Loop ──
  // La lógica avanza a 60 pasos por segundo fijos (en pantallas de 120/144 Hz no va más rápido)
  // y se dibuja una vez por fotograma.
  useEffect(()=>{
    if (fase!=='PLAYING') { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width=CW; canvas.height=CH;
    const ctx    = canvas.getContext('2d');
    const bgImg  = bgRefs.current[nivelIdx%4];
    const sprite = spriteRef.current;
    const enemy  = enemyRef.current;
    const theme  = GR_COLORS[nivelIdx%4];

    // Efectos (coordenadas del nivel)
    const fx = { parts:[], textos:[], shake:0, flash:null };
    const chispas = (x,y,n,colores,fuerza=5)=>{
      for (let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2, v=(0.35+Math.random())*fuerza, vida=28+Math.random()*30;
        fx.parts.push({ x,y, vx:Math.cos(a)*v, vy:Math.sin(a)*v-2, vida, max:vida, color:colores[i%colores.length], r:2+Math.random()*3 });
      }
    };
    const flotante = (x,y,txt,color)=>fx.textos.push({ x,y,txt,color,vida:60 });
    const aviso = (text,ok,ms)=>{
      setFeedUI({ text, ok });
      if (feedTimer.current) clearTimeout(feedTimer.current);
      feedTimer.current=setTimeout(()=>setFeedUI(null),ms);
    };

    const update = ()=>{
      const ref = g.current;
      const p   = ref.player;
      ref.frame++;
      ref.bgX-=0.3; if(ref.bgX<=-CW) ref.bgX=0;

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
      const vyAntes = p.vy;
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

      // Aterrizaje: se aplasta un poco y levanta polvo
      if (!wasGround && p.onGround && vyAntes>5) {
        p.squash=8;
        chispas(p.x+PLAYER_W/2, p.y+PLAYER_H-2, 7, ['rgba(255,255,255,0.8)','rgba(210,210,210,0.6)'], 2.2);
      }
      if (p.squash>0) p.squash--;
      if (p.onGround && Math.abs(p.vx)>2 && ref.frame%8===0) {
        fx.parts.push({ x:p.x+PLAYER_W/2-p.facing*16, y:p.y+PLAYER_H-3, vx:-p.facing*(1+Math.random()), vy:-0.5-Math.random()*0.6, vida:20, max:20, color:'rgba(255,255,255,0.5)', r:2+Math.random()*2 });
      }

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
        if (blk.shakeT>0) blk.shakeT--;
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
          const bx=blk.x+blk.w/2, by=blk.y+blk.h/2;
          if (blk.isCorrect) {
            snd('correct');
            scoreRef.current++;    setScore(scoreRef.current);
            aciertosRef.current++; setAciertos(aciertosRef.current);
            chispas(bx, by, 34, ['#f1c40f','#2ecc71','#ffffff'], 6.5);
            flotante(bx, blk.y-12, '+1', '#2ecc71');
            fx.flash={ color:'46,204,113', vida:14, max:14 };
            blk.ok=true;
            aviso('✅ ¡Correcto!', true, 1700);
          } else {
            snd('wrong');
            scoreRef.current = Math.max(0, scoreRef.current-1);
            setScore(scoreRef.current);
            const corr=ref.ansBlocks.find(b=>b.stIdx===si&&b.isCorrect);
            if (corr) { corr.ok=true; chispas(corr.x+corr.w/2, corr.y+corr.h/2, 12, ['#2ecc71','#ffffff'], 3); }
            chispas(bx, by, 26, ['#e74c3c','#c0392b','#ffffff'], 6);
            flotante(bx, blk.y-12, '−1', '#e74c3c');
            fx.shake=14; fx.flash={ color:'231,76,60', vida:20, max:20 };
            aviso(`❌ Era: ${corr?.text||'?'}`, false, 1700);
          }
          if (ref.answered>=ref.total) {
            const snap = { correct: aciertosRef.current, total: ref.total, points: scoreRef.current };
            setLevelStats(prev => { const next=[...prev]; next[nivelIdx]=snap; return next; });
            // Determinar si hay más niveles según modo
            const totalNiveles = recursoActivo && recursoModo==='PANTALLAS'
              ? Math.min((recursoActivo.hojas||[]).length, 4)
              : (recursoActivo ? 1 : 4);
            const esUltimo = nivelIdx >= totalNiveles - 1;
            setTimeout(()=>setFase(esUltimo?'RESUMEN':'FIN'), 1300);
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
          chispas(coin.x, coin.y, 14, ['#f1c40f','#ffe066','#ffffff'], 4);
          flotante(coin.x, coin.y-16, '+1', '#f1c40f');
          aviso('🟡 +1 moneda', true, 900);
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
          const ex=en.x+en.w/2, ey=en.y+en.h/2;
          if (en.isTrue) {
            snd('correct'); scoreRef.current++; setScore(scoreRef.current);
            chispas(ex, ey, 22, ['#3498db','#2ecc71','#ffffff'], 5);
            flotante(ex, en.y-20, '+1', '#2ecc71');
            aviso('✅ ¡Verdad! +1', true, 1700);
          } else {
            snd('wrong'); scoreRef.current=Math.max(0,scoreRef.current-1); setScore(scoreRef.current);
            chispas(ex, ey, 22, ['#e74c3c','#8e44ad','#ffffff'], 5);
            flotante(ex, en.y-20, '−1', '#e74c3c');
            fx.shake=12;
            aviso('❌ ¡Falso! −1', false, 1700);
          }
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

      // Efectos
      for (const pt of fx.parts) { pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.22; pt.vida--; }
      fx.parts = fx.parts.filter(pt=>pt.vida>0);
      for (const t of fx.textos) { t.y-=0.9; t.vida--; }
      fx.textos = fx.textos.filter(t=>t.vida>0);
      if (fx.shake>0) fx.shake = fx.shake<0.5 ? 0 : fx.shake*0.86;
      if (fx.flash && --fx.flash.vida<=0) fx.flash=null;
    };

    const draw = ()=>{
      const ref = g.current;
      const p   = ref.player;
      ctx.save();
      ctx.clearRect(0,0,CW,CH);
      if (fx.shake>0.5) ctx.translate((Math.random()-0.5)*fx.shake, (Math.random()-0.5)*fx.shake);
      const cx=Math.round(ref.camX), cy=Math.round(ref.camY);

      // Fondo (con un poco de paralaje al moverse la cámara)
      if(bgImg?.complete&&bgImg.naturalWidth>0){
        const bx = (((ref.bgX - cx*0.15) % CW) + CW) % CW - CW;
        ctx.drawImage(bgImg,bx-2,-10,CW+4,CH+20); ctx.drawImage(bgImg,bx+CW-2,-10,CW+4,CH+20);
      } else {
        const grd=ctx.createLinearGradient(0,0,0,CH);
        grd.addColorStop(0,BG_THEMES[nivelIdx%4]); grd.addColorStop(1,'#000015');
        ctx.fillStyle=grd; ctx.fillRect(-20,-20,CW+40,CH+40);
      }
      ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(-20,-20,CW+40,CH+40);

      // ─ Plataformas (borde de hierba y ladrillos) ─
      for (const plat of ref.platforms) {
        const sx=plat.x-cx, sy=plat.y-cy;
        if(sx>CW+60||sx+plat.w<-60||sy>CH+20||sy<-20) continue;
        const x0=Math.max(sx,-30), x1=Math.min(sx+plat.w,CW+30), w=x1-x0;
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x0+4,sy+5,w,plat.h);
        ctx.fillStyle=theme; ctx.fillRect(x0,sy,w,plat.h);
        ctx.fillStyle='rgba(0,0,0,0.16)';
        for (let bxp=sx+((Math.floor((x0-sx)/26))*26); bxp<x1; bxp+=26) ctx.fillRect(bxp,sy+7,2,plat.h-7);
        ctx.fillStyle='rgba(255,255,255,0.32)'; ctx.fillRect(x0,sy,w,5);
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x0,sy+plat.h-3,w,3);
      }

      // ─ Monedas (giran) ─
      for (const coin of ref.coins) {
        if (!coin.active) continue;
        const sx=coin.x-cx, sy=coin.y-cy+Math.sin((ref.frame+coin.x)*0.08)*2.5;
        if(sx<-20||sx>CW+20||sy<-20||sy>CH+20) continue;
        const giro=Math.max(0.2, Math.abs(Math.cos((ref.frame+coin.x)*0.07)));
        ctx.save();
        const halo=ctx.createRadialGradient(sx,sy,2,sx,sy,COIN_R*2.4);
        halo.addColorStop(0,'rgba(255,224,102,0.45)'); halo.addColorStop(1,'rgba(255,224,102,0)');
        ctx.fillStyle=halo; ctx.fillRect(sx-COIN_R*2.4,sy-COIN_R*2.4,COIN_R*4.8,COIN_R*4.8);
        const grd=ctx.createRadialGradient(sx-2,sy-2,1,sx,sy,COIN_R);
        grd.addColorStop(0,'#ffe066'); grd.addColorStop(1,'#d4a000');
        ctx.fillStyle=grd; ctx.beginPath(); ctx.ellipse(sx,sy,COIN_R*giro,COIN_R,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#a07800'; ctx.lineWidth=1.5; ctx.stroke();
        if (giro>0.55) {
          ctx.fillStyle='#7a5800'; ctx.font=`bold ${COIN_R}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('★',sx,sy+0.5);
        }
        ctx.restore();
      }

      // ─ Enemigos ─
      for (const en of ref.enemies) {
        if (!en.active) continue;
        const sx=en.x-cx, sy=en.y-cy+Math.abs(Math.sin(en.frameT*0.15))*-3;
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

        // Frase del enemigo (bocadillo; la letra se ajusta, hasta 2 líneas)
        ctx.save();
        ctx.font='bold 12px Arial';
        const tw=ctx.measureText(en.phrase).width;
        const bw=Math.min(tw+16, 210), bh=tw+16>210?34:21;
        const bx=Math.max(2, Math.min(CW-bw-2, sx+en.w/2-bw/2));
        const by=sy-bh-7;
        if (by>-40) {
          ctx.fillStyle='rgba(30,100,210,0.94)';
          rr(ctx,bx,by,bw,bh,6); ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=1.2;
          rr(ctx,bx,by,bw,bh,6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx+en.w/2-5,by+bh); ctx.lineTo(sx+en.w/2+5,by+bh); ctx.lineTo(sx+en.w/2,by+bh+6); ctx.closePath();
          ctx.fillStyle='rgba(30,100,210,0.94)'; ctx.fill();
          ctx.fillStyle='white';
          dibujarAjustado(ctx, en.phrase, bx+bw/2, by+bh/2+1, bw-10, bh-4, { maxPx:12, minPx:8, maxLineas:2 });
        }
        ctx.restore();
      }

      // ─ Preguntas (siempre visibles; el cartel crece hacia arriba) ─
      for (const st of ref.stations) {
        if (st.answered) continue;
        const rawSx = st.cx-cx;
        const sx = Math.max(130, Math.min(CW-130, rawSx));
        const fondo = st.qY+30-cy; // borde de abajo del cartel, justo encima de los bloques
        if (fondo<-10||fondo>CH+90) continue;

        ctx.save();
        const qLen = st.qText.length;
        const QFONT = qLen > 70 ? 12 : qLen > 40 ? 13 : 15;
        ctx.font=`bold ${QFONT}px Arial`;

        // ── Word-wrap hasta 4 líneas ──
        const MAX_W = Math.min(400, CW - 24);
        const LINE_H = QFONT + 4;
        const qwords = st.qText.split(' ');
        const lines = [];
        let cur = '';
        for (const w of qwords) {
          const test = cur ? cur+' '+w : w;
          if (ctx.measureText(test).width > MAX_W && cur) {
            lines.push(cur); cur = w;
            if (lines.length === 3) {
              while (cur.length>1 && ctx.measureText(cur+'…').width>MAX_W) cur=cur.slice(0,-1);
              cur += '…'; break;
            }
          } else { cur = test; }
        }
        if (lines.length < 4 && cur) lines.push(cur);

        const bw = Math.min(Math.max(...lines.map(l=>ctx.measureText(l).width)) + 24, CW - 16);
        const bh = lines.length * LINE_H + 12;
        const bx = Math.max(8, Math.min(CW - bw - 8, sx - bw/2));
        const by = fondo - bh;

        ctx.fillStyle='rgba(8,10,20,0.92)';
        rr(ctx, bx, by, bw, bh, 8); ctx.fill();
        ctx.strokeStyle='#f1c40f'; ctx.lineWidth=2;
        rr(ctx, bx, by, bw, bh, 8); ctx.stroke();

        ctx.fillStyle='#f1c40f'; ctx.textAlign='center'; ctx.textBaseline='middle';
        lines.forEach((line, i) => {
          ctx.fillText(line, bx + bw/2, by + (i + 0.5) * LINE_H + 6);
        });
        ctx.restore();
      }

      // ─ Bloques de respuesta ─
      for (const blk of ref.ansBlocks) {
        const rawSx = blk.x-cx;
        const sx = Math.max(4, Math.min(CW-blk.w-4, rawSx));
        const shake=blk.shakeT>0?Math.sin(blk.shakeT*2)*3:0;
        const sy=blk.y-cy+shake;
        if (sy>CH+20||sy<-70) continue;

        // Ya respondidos: la correcta queda en verde y el resto apagado
        ctx.globalAlpha = blk.hit ? (blk.ok ? 0.85 : 0.2) : 1;
        ctx.fillStyle='rgba(0,0,0,0.3)'; rr(ctx,sx+3,sy+4,blk.w,blk.h,7); ctx.fill();
        ctx.fillStyle = blk.hit && blk.ok ? '#27ae60' : blk.color; rr(ctx,sx,sy,blk.w,blk.h,7); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.26)'; rr(ctx,sx+3,sy+3,blk.w-6,blk.h*0.42,5); ctx.fill();
        ctx.strokeStyle= blk.hit ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)'; ctx.lineWidth=2;
        rr(ctx,sx,sy,blk.w,blk.h,7); ctx.stroke();

        ctx.fillStyle='rgba(0,0,0,0.45)';
        dibujarAjustado(ctx, blk.text, sx+blk.w/2+1, sy+blk.h/2+2, blk.w-8, blk.h-6, { maxPx:16, minPx:8, maxLineas:3 });
        ctx.fillStyle='#ffffff';
        dibujarAjustado(ctx, blk.text, sx+blk.w/2, sy+blk.h/2+1, blk.w-8, blk.h-6, { maxPx:16, minPx:8, maxLineas:3 });
        ctx.globalAlpha=1;
      }

      // ─ Flechitas bajo bloques ─
      const pulse=0.5+0.5*Math.sin(ref.frame*0.1);
      for (const st of ref.stations) {
        if (st.answered) continue;
        ref.ansBlocks.filter(b=>b.stIdx===st.idx).forEach(blk=>{
          const rawSx=blk.x-cx;
          const sx=Math.max(4,Math.min(CW-blk.w-4,rawSx));
          const sy=blk.y-cy+blk.h+12+pulse*3;
          if(sy<-10||sy>CH+10) return;
          ctx.globalAlpha=0.35+pulse*0.5; ctx.fillStyle=blk.color;
          ctx.font='bold 11px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('▲',sx+blk.w/2,sy); ctx.globalAlpha=1;
        });
      }

      // ─ Jugador (se aplasta un poco al aterrizar) ─
      const px=p.x-cx, py=p.y-cy;
      if (!(p.invulnerable>0 && Math.floor(p.invulnerable/5)%2===0)) {
        ctx.save();
        if (p.facing<0) {
          ctx.translate(px+PLAYER_W/2,py+PLAYER_H/2); ctx.scale(-1,1);
          ctx.translate(-(px+PLAYER_W/2),-(py+PLAYER_H/2));
        }
        const s=(p.squash||0)/8;
        const dw=PLAYER_W*(1+0.14*s), dh=PLAYER_H*(1-0.14*s);
        const dx=px-(dw-PLAYER_W)/2, dy=py+(PLAYER_H-dh);
        const sw=sprite?.complete&&sprite.naturalWidth>0;
        if (sw) {
          const fw=sprite.width/2, fh=sprite.height/2;
          ctx.drawImage(sprite,p.frameX*fw,p.frameY*fh,fw,fh,dx,dy,dw,dh);
        } else {
          ctx.fillStyle='#c0392b'; ctx.fillRect(px+6,py,PLAYER_W-12,PLAYER_H-14);
          ctx.fillStyle='#f1c40f'; ctx.fillRect(px+11,py+8,11,8); ctx.fillRect(px+34,py+8,11,8);
          ctx.fillStyle='#c0392b'; ctx.fillRect(px+8,py+PLAYER_H-13,13,13); ctx.fillRect(px+35,py+PLAYER_H-13,13,13);
        }
        ctx.restore();
      }

      // ─ Chispas y textos ─
      for (const pt of fx.parts) {
        ctx.globalAlpha=Math.max(0,pt.vida/pt.max); ctx.fillStyle=pt.color;
        ctx.beginPath(); ctx.arc(pt.x-cx,pt.y-cy,pt.r,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
      for (const t of fx.textos) {
        ctx.globalAlpha=Math.min(1,t.vida/20);
        ctx.font='900 28px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.lineWidth=5; ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.strokeText(t.txt,t.x-cx,t.y-cy);
        ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x-cx,t.y-cy);
      }
      ctx.globalAlpha=1;
      ctx.restore();

      // ─ Mini mapa progreso ─
      const tot=ref.stations.length;
      const mw=tot*26, mx0=CW/2-mw/2;
      ctx.fillStyle='rgba(0,0,0,0.45)'; rr(ctx,mx0-6,3,mw+8,18,9); ctx.fill();
      for(let i=0;i<tot;i++){
        ctx.fillStyle=ref.stations[i].answered?'#2ecc71':'rgba(255,255,255,0.22)';
        rr(ctx,mx0+i*26,6,22,12,4); ctx.fill();
        if(ref.stations[i].answered){ ctx.fillStyle='#fff'; ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('✓',mx0+i*26+11,12.5); }
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
          ctx.fillStyle=`rgba(241,196,15,${0.6+pulse*0.35})`;
          ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-8,8); ctx.lineTo(-8,-8); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.5; ctx.stroke();
          ctx.restore();
        }
      }

      // Destello (verde acierto, rojo fallo)
      if (fx.flash) {
        ctx.fillStyle=`rgba(${fx.flash.color},${0.3*fx.flash.vida/fx.flash.max})`;
        ctx.fillRect(0,0,CW,CH);
      }
    };

    let last=performance.now(), acc=0;
    const STEP=1000/60;
    const frame=(t)=>{
      acc+=Math.min(200,t-last); last=t;
      let n=0;
      while(acc>=STEP && n<6){ update(); acc-=STEP; n++; }
      if(n===6) acc=0;
      draw();
      rafRef.current=requestAnimationFrame(frame);
    };
    draw();
    rafRef.current=requestAnimationFrame(frame);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[fase,nivelIdx]);

  // ── Empezar desde las pantallas de inicio (botón, Espacio/Enter o mando) ──
  const empezarNivel = ()=>{
    if (fase==='INTRO') iniciar(materia,nivelIdx);
    else if (fase==='INTRO_REC') setFase('PLAYING');
  };

  // En pantalla dual: W/A/S/D van a la mitad izquierda y las flechas a la derecha
  useEffect(()=>{
    window.__piktModoAccion = fase==='PLAYING' || fase==='INTRO' || fase==='INTRO_REC';
    return ()=>{ window.__piktModoAccion = false; };
  },[fase]);

  // ── Controles teclado ── (e.code: funciona igual con mayúsculas y con las teclas que llegan de la pantalla dual)
  useEffect(()=>{
    if(fase!=='PLAYING' && fase!=='INTRO' && fase!=='INTRO_REC') return undefined;
    const DER=new Set(['ArrowRight','KeyD']), IZQ=new Set(['ArrowLeft','KeyA']), SAL=new Set(['ArrowUp','KeyW','Space']);
    const tecla=e=>e.code||(e.key===' '?'Space':e.key);
    const kd=e=>{
      if(e.target?.closest?.('input, textarea, select')) return;
      const c=tecla(e);
      if(fase!=='PLAYING'){
        if((SAL.has(c)||c==='Enter'||c==='NumpadEnter') && !e.repeat){ e.preventDefault(); if(document.activeElement?.tagName==='BUTTON') document.activeElement.blur(); empezarNivel(); }
        return;
      }
      const ref=g.current;
      if(DER.has(c)){ e.preventDefault(); ref.keys.right=true; }
      if(IZQ.has(c)){ e.preventDefault(); ref.keys.left=true;  }
      if(SAL.has(c)){
        e.preventDefault();
        // Que Espacio no «pulse» el último botón con foco
        if(document.activeElement?.tagName==='BUTTON') document.activeElement.blur();
        const p=ref.player;
        if(p.onGround||p.coyote>0){ p.vy=JUMP_POWER; p.onGround=false; p.coyote=0; snd('jump'); }
        else p.jumpBuffer=JBUF_F;
      }
    };
    const ku=e=>{
      if(fase!=='PLAYING') return;
      const ref=g.current, c=tecla(e);
      if(DER.has(c)) ref.keys.right=false;
      if(IZQ.has(c)) ref.keys.left=false;
      if(SAL.has(c)) e.preventDefault();
    };
    // Al perder el foco (cambiar de ventana) no se queda andando solo
    const suelta=()=>{ g.current.keys.left=false; g.current.keys.right=false; };
    window.addEventListener('keydown',kd); window.addEventListener('keyup',ku); window.addEventListener('blur',suelta);
    return ()=>{ window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); window.removeEventListener('blur',suelta); };
  },[fase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pointer Events (multi-touch) ──
  const ptrL = useCallback((e,down)=>{ e.preventDefault(); try{down?e.target.setPointerCapture(e.pointerId):e.target.releasePointerCapture(e.pointerId);}catch(_){} g.current.keys.left=down; },[]);
  const ptrR = useCallback((e,down)=>{ e.preventDefault(); try{down?e.target.setPointerCapture(e.pointerId):e.target.releasePointerCapture(e.pointerId);}catch(_){} g.current.keys.right=down; },[]);
  const ptrJ = useCallback((e)=>{
    e.preventDefault();
    const p=g.current.player;
    if(p.onGround||p.coyote>0){ p.vy=JUMP_POWER; p.onGround=false; p.coyote=0; snd('jump'); }
    else p.jumpBuffer=JBUF_F;
  },[]);

  // ── Control con el cuerpo (webcam) ──
  const cuerpoDir = useCallback((d)=>{
    const k=g.current.keys;
    k.left = d<0;
    k.right = d>0;
  },[]);
  const cuerpoSalto = useCallback(()=>{
    const p=g.current.player;
    if(p.onGround||p.coyote>0){ p.vy=JUMP_POWER; p.onGround=false; p.coyote=0; snd('jump'); }
    else p.jumpBuffer=JBUF_F;
  },[]);

  // ── Siguiente nivel en modo recurso ──
  const siguienteNivelRecurso = useCallback(()=>{
    if (!recursoActivo) return;
    const hojas    = recursoActivo.hojas||[];
    const aleatorio= recursoActivo.config?.aleatorio!==false;
    const nv       = nivelIdx+1;
    setNivelIdx(nv);
    if (recursoModo==='PANTALLAS') {
      const hoja  = hojas[nv]||hojas[0];
      const pregs = extraerPreguntas(hoja, 5, aleatorio);
      const frases= frasesDeHoja(hoja);
      buildLevel(null, nv, nv%LAYOUTS.length, pregs, frases, frases.length===0);
    }
    setFase('INTRO_REC');
  },[recursoActivo, recursoModo, nivelIdx, buildLevel]);

  // --- AUTO-START DEEP LINK ---
  useEffect(() => {
    if (recursoInicial && fase === 'MENU') {
      // Con varias hojas cada uno elige (también en cada mitad de la pantalla dual)
      const hojas = recursoInicial.hojas || [];
      const idx = hojaInicial && hojaInicial !== 'General' ? hojas.findIndex(h => h.nombreHoja === hojaInicial) : -1;
      if (idx >= 0 || hojas.length <= 1) iniciarRecurso({ recurso: recursoInicial, modo: 'HOJA', hojaIdx: Math.max(0, idx) });
      else setFase('SELECTOR');
    }
  }, [recursoInicial, iniciarRecurso]);

  const totalNivelesActuales = recursoActivo && recursoModo==='PANTALLAS'
    ? Math.min((recursoActivo.hojas||[]).length, 4)
    : (recursoActivo ? 1 : 4);

  // Mandos: al acabar cada nivel se anotan puntos y aciertos; agitar avanza en las pantallas sin juego
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(()=>{ if(fase==='FIN') mandosApi?.current?.finPartida([score],{ aciertos:[aciertos], intentos:[totalQ] }); },[fase]); // eslint-disable-line react-hooks/exhaustive-deps
  if (juegoMandos) juegoMandos.current.onEvento = (i, ev) => {
    if (ev.accion !== 'S') return;
    if (fase==='INTRO' || fase==='INTRO_REC') empezarNivel();
    else if (fase==='FIN') { if (nivelIdx+1<totalNivelesActuales) (recursoActivo ? siguienteNivelRecurso() : (setNivelIdx(nivelIdx+1), setFase('INTRO'))); else setFase(recursoActivo?'INTRO_REC':'INTRO'); }
  };

  if(fase==='SELECTOR' && recursoInicial) return <PantallaSelectorHoja recurso={recursoInicial} onJugar={iniciarRecurso} onBack={onExit || (()=>setFase('MENU'))} />;
  if(fase==='MENU')    return <PantallaMenu onEligir={m=>{ setMateria(m); setNivelIdx(0); setLevelStats([]); setFase('INTRO'); }} onRecurso={iniciarRecurso} onExit={onExit}/>;
  if(fase==='INTRO')   return <PantallaIntro materia={materia} nivel={nivelIdx+1} total={4} hasEnemigos={nivelIdx>0} onStart={()=>iniciar(materia,nivelIdx)} onBack={()=>setFase('MENU')} cuerpo={controlCuerpo} onCuerpo={alternarCuerpo}/>;
  if(fase==='INTRO_REC') return <PantallaIntro materia={null} nivel={nivelIdx+1} total={totalNivelesActuales} hasEnemigos={hasEnemigos} onStart={()=>setFase('PLAYING')} onBack={()=>setFase('MENU')} cuerpo={controlCuerpo} onCuerpo={alternarCuerpo}/>;
  if(fase==='RESUMEN') return <PantallaResumen materia={materia} recurso={recursoActivo} levelStats={levelStats} onMenu={()=>{ setLevelStats([]); setRecursoActivo(null); setFase('MENU'); }}/>;
  if(fase==='FIN')     return <PantallaFin materia={materia} score={score} aciertos={aciertos} total={totalQ}
    hayMas={nivelIdx+1<totalNivelesActuales}
    onSiguiente={recursoActivo ? siguienteNivelRecurso : ()=>{ setNivelIdx(nivelIdx+1); setFase('INTRO'); }}
    onReintentar={()=>setFase(recursoActivo?'INTRO_REC':'INTRO')}
    onMenu={()=>{ setRecursoActivo(null); setFase('MENU'); }}
    recurso={recursoActivo}
    hoja={recursoActivo ? (recursoActivo.hojas?.[recursoHojaIdx]?.nombreHoja || 'General') : null}
  />;

  const mat = materia ? MATERIAS[materia] : null;
  const btnSz = Math.max(48, Math.min(96, Math.round(tam.h * 0.17)));
  const exitFS = ()=>{ setFullscreen(false); if(document.fullscreenElement) document.exitFullscreen?.(); screen.orientation?.unlock?.(); };
  const pistaTeclas = ladoDual===0 ? 'A D moverse · W saltar'
    : ladoDual===1 ? '← → moverse · ↑ saltar'
    : '← → (o A D) moverse · ↑ / Espacio / W saltar';
  const chip = { padding:'3px 10px', borderRadius:18, fontWeight:'bold', fontSize:'0.9rem', whiteSpace:'nowrap' };
  const icono = { padding:'4px 10px', borderRadius:8, border:'1.5px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.08)', color:'white', cursor:'pointer', fontSize:'1rem', lineHeight:'1.2', fontFamily:'Arial' };

  return (
    <div ref={gameContainerRef} className="pl-root"
      onPointerDown={e=>{ if(e.pointerType==='touch' && !esTactil) setEsTactil(true); }}
      style={{
        ...(fullscreen ? { position:'fixed', inset:0, zIndex:9999, height:'100%' } : { width:'100%' }),
        background:'radial-gradient(ellipse at 50% 15%, #1f2a44 0%, #0d1020 60%, #05060c 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', boxSizing:'border-box',
        padding: fullscreen ? 4 : '6px 8px', overflow:'hidden',
        userSelect:'none', WebkitUserSelect:'none', touchAction:'none', fontFamily:'Arial,sans-serif',
      }}>
      <style>{`.pl-root{height:100vh;height:100dvh} .pl-btn:active{transform:scale(0.94);filter:brightness(1.2)} @keyframes plLatido{0%{transform:scale(1)}35%{transform:scale(1.25)}100%{transform:scale(1)}}`}</style>

      {/* Marcador */}
      <div style={{ width:'100%', maxWidth:tam.w, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', padding:'2px 2px 6px', boxSizing:'border-box', flexShrink:0,
        // a la izquierda queda el botón 🏠 de la página (fuera de la pantalla dual y de la pantalla completa)
        paddingLeft: !fullscreen && ladoDual===null ? 54 : 2 }}>
        <button onClick={()=>{ exitFS(); setFase('MENU'); }} style={{ padding:'4px 12px', borderRadius:18, border:'1.5px solid rgba(255,255,255,0.2)', background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:'0.8rem', fontFamily:'inherit' }}>← Menú</button>
        <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.85rem', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {mat ? `${mat.emoji} ${mat.label}` : (recursoActivo?.titulo||'Recurso')} · Nivel {nivelIdx+1}
        </span>
        <span style={{ ...chip, background:'#2980b9', color:'white' }}>✔ {aciertos}/{totalQ}</span>
        <span key={score} style={{ ...chip, background:'#f1c40f', color:'#1a1a2e', animation:'plLatido 0.35s ease-out', display:'inline-block' }}>⭐ {Math.max(0,score)}</span>
        <button onClick={alternarCuerpo} title="Jugar con el cuerpo (webcam)"
          style={{ ...icono, border:`1.5px solid ${controlCuerpo?'#22c55e':'rgba(255,255,255,0.25)'}`, background:controlCuerpo?'rgba(34,197,94,0.25)':'rgba(255,255,255,0.08)' }}>
          🕺
        </button>
        {ladoDual===null && (
          <button onClick={fullscreen ? exitFS : toggleFullscreen} title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} style={icono}>
            {fullscreen ? '✕' : '⛶'}
          </button>
        )}
      </div>

      {/* Canvas: ocupa todo el hueco libre manteniendo la proporción 16:9 */}
      <div ref={zonaRef} style={{ flex:1, minHeight:150, width:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ position:'relative', width:tam.w, height:tam.h, flexShrink:0, touchAction:'none' }}>
          <canvas ref={canvasRef} width={CW} height={CH} style={{ display:'block', width:'100%', height:'100%', touchAction:'none',
            borderRadius: fullscreen ? 4 : 10, boxShadow:'0 0 36px rgba(0,0,0,0.7)', border:'2px solid #1a1a2e' }}/>

          {/* Feedback */}
          {feedUI && (
            <div style={{ position:'absolute', top:'30%', left:'50%', transform:'translate(-50%,-50%)',
              background:feedUI.ok?'rgba(39,174,96,0.93)':'rgba(192,57,43,0.93)',
              color:'white', padding:'10px 22px', borderRadius:12, maxWidth:'90%', textAlign:'center',
              fontSize: `${Math.max(15, Math.round(tam.h*0.045))}px`,
              fontWeight:'bold', fontFamily:'Arial', pointerEvents:'none',
              boxShadow:'0 4px 16px rgba(0,0,0,0.4)', zIndex:3 }}>{feedUI.text}
            </div>
          )}

          {/* Jugar con el cuerpo: cámara + gestos */}
          {controlCuerpo && fase==='PLAYING' && (
            <React.Suspense fallback={null}>
              <PanelControlCuerpo onDir={cuerpoDir} onSalto={cuerpoSalto} onCerrar={alternarCuerpo}
                ancho={Math.max(140, Math.min(220, Math.round(tam.w*0.18)))}
                style={{ position:'absolute', zIndex:4, right:8, top:28, opacity:0.95 }} />
            </React.Suspense>
          )}

          {/* Botones táctiles encima del juego (solo en pantallas táctiles) */}
          {esTactil && (<>
            <div style={{ position:'absolute', bottom:Math.round(tam.h*0.04), left:Math.round(tam.w*0.02), zIndex:3, display:'flex', gap:Math.round(btnSz*0.25) }}>
              <Btn size={btnSz} onDown={e=>ptrL(e,true)} onUp={e=>ptrL(e,false)}>◀</Btn>
              <Btn size={btnSz} onDown={e=>ptrR(e,true)} onUp={e=>ptrR(e,false)}>▶</Btn>
            </div>
            <div style={{ position:'absolute', bottom:Math.round(tam.h*0.04), right:Math.round(tam.w*0.02), zIndex:3 }}>
              <Btn size={btnSz} wide onDown={ptrJ} accent>▲</Btn>
            </div>
          </>)}
        </div>
      </div>

      {!fullscreen && (
        <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.78rem', marginTop:5, textAlign:'center', flexShrink:0 }}>
          ⌨️ {pistaTeclas} · golpea con la cabeza, <b style={{ color:'rgba(255,255,255,0.7)' }}>desde abajo</b>, el bloque de la respuesta correcta
          {!esTactil && <> · <button onClick={()=>setEsTactil(true)} style={{ background:'none', border:'none', color:'#7ec8f7', cursor:'pointer', fontSize:'inherit', textDecoration:'underline', padding:0 }}>botones en pantalla</button></>}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onDown, onUp=()=>{}, accent=false, size=null, wide=false }) {
  const h = size || 50;
  const w = size ? (wide ? Math.round(size*1.8) : size) : (accent ? 120 : 56);
  const fs = size ? `${Math.round(size*0.38)}px` : (accent ? '0.85rem' : '1.3rem');
  return (
    <button className="pl-btn"
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}
      onContextMenu={e=>e.preventDefault()}
      style={{ width:w, height:h, borderRadius:size?Math.round(h*0.22):10,
        border:`2px solid ${accent?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.25)'}`,
        background:accent?'rgba(241,196,15,0.78)':'rgba(20,30,48,0.62)', color:accent?'#1a1a2e':'white',
        fontWeight:'bold', fontSize:fs, cursor:'pointer',
        userSelect:'none', WebkitUserSelect:'none', fontFamily:'Arial',
        boxShadow:'0 3px 10px rgba(0,0,0,0.4)', touchAction:'none', backdropFilter:'blur(2px)' }}>
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
