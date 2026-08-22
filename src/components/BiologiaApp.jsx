import { useState, useEffect, useRef, useCallback } from 'react';
import Confetti from 'react-confetti';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import correctSoundFile from '../assets/correct-choice-43861.mp3';
import wrongSoundFile   from '../assets/negative_beeps-6008.mp3';
import ANATOMIA         from '../anatomia_avanzada_dataset.json';
import { CompeticionCuerda } from './TironCuerdaEscena';

const N_PREGUNTAS = 10;
const TIEMPO      = 20;

// ── Body silhouette background ────────────────────────────────────────────────
const BG_SHAPES = [
  { type:'circle',  cx:140, cy:55,  r:40 },
  { type:'rect',    x:122,  y:93,   width:36,  height:20,  rx:5  },
  { type:'rect',    x:88,   y:111,  width:104, height:165, rx:8  },
  { type:'rect',    x:52,   y:113,  width:36,  height:90,  rx:10 },
  { type:'rect',    x:192,  y:113,  width:36,  height:90,  rx:10 },
  { type:'rect',    x:38,   y:198,  width:30,  height:80,  rx:8  },
  { type:'rect',    x:212,  y:198,  width:30,  height:80,  rx:8  },
  { type:'ellipse', cx:53,  cy:295, rx:18,     ry:18              },
  { type:'ellipse', cx:227, cy:295, rx:18,     ry:18              },
  { type:'rect',    x:90,   y:274,  width:46,  height:95,  rx:8  },
  { type:'rect',    x:144,  y:274,  width:46,  height:95,  rx:8  },
  { type:'ellipse', cx:113, cy:373, rx:22,     ry:14              },
  { type:'ellipse', cx:167, cy:373, rx:22,     ry:14              },
  { type:'rect',    x:95,   y:383,  width:36,  height:90,  rx:8  },
  { type:'rect',    x:149,  y:383,  width:36,  height:90,  rx:8  },
  { type:'ellipse', cx:108, cy:478, rx:24,     ry:12              },
  { type:'ellipse', cx:162, cy:478, rx:24,     ry:12              },
];

// ── Element data ──────────────────────────────────────────────────────────────
const CUERPO_PARTES = [
  { id:'cabeza',       nombre:'Cabeza',               shape:{type:'circle',  cx:140, cy:55,  r:40                     } },
  { id:'cuello',       nombre:'Cuello',               shape:{type:'rect',    x:122,  y:93,   width:36,  height:20, rx:5} },
  { id:'hombro_d',     nombre:'Hombro derecho',       shape:{type:'circle',  cx:192, cy:118, r:22                     } },
  { id:'hombro_i',     nombre:'Hombro izquierdo',     shape:{type:'circle',  cx:88,  cy:118, r:22                     } },
  { id:'pecho',        nombre:'Pecho',                shape:{type:'rect',    x:92,   y:113,  width:96,  height:70, rx:6} },
  { id:'abdomen',      nombre:'Abdomen',              shape:{type:'rect',    x:92,   y:183,  width:96,  height:90, rx:6} },
  { id:'cadera',       nombre:'Cadera',               shape:{type:'rect',    x:90,   y:271,  width:100, height:45, rx:6} },
  { id:'brazo_d',      nombre:'Brazo derecho',        shape:{type:'rect',    x:192,  y:113,  width:36,  height:90, rx:10} },
  { id:'brazo_i',      nombre:'Brazo izquierdo',      shape:{type:'rect',    x:52,   y:113,  width:36,  height:90, rx:10} },
  { id:'antebrazo_d',  nombre:'Antebrazo derecho',    shape:{type:'rect',    x:212,  y:198,  width:30,  height:80, rx:8} },
  { id:'antebrazo_i',  nombre:'Antebrazo izquierdo',  shape:{type:'rect',    x:38,   y:198,  width:30,  height:80, rx:8} },
  { id:'mano_d',       nombre:'Mano derecha',         shape:{type:'ellipse', cx:227, cy:295, rx:18,     ry:18          } },
  { id:'mano_i',       nombre:'Mano izquierda',       shape:{type:'ellipse', cx:53,  cy:295, rx:18,     ry:18          } },
  { id:'muslo_d',      nombre:'Muslo derecho',        shape:{type:'rect',    x:144,  y:274,  width:46,  height:95, rx:8} },
  { id:'muslo_i',      nombre:'Muslo izquierdo',      shape:{type:'rect',    x:90,   y:274,  width:46,  height:95, rx:8} },
  { id:'rodilla_d',    nombre:'Rodilla derecha',      shape:{type:'ellipse', cx:167, cy:373, rx:22,     ry:14          } },
  { id:'rodilla_i',    nombre:'Rodilla izquierda',    shape:{type:'ellipse', cx:113, cy:373, rx:22,     ry:14          } },
  { id:'pierna_d',     nombre:'Pierna derecha',       shape:{type:'rect',    x:149,  y:383,  width:36,  height:90, rx:8} },
  { id:'pierna_i',     nombre:'Pierna izquierda',     shape:{type:'rect',    x:95,   y:383,  width:36,  height:90, rx:8} },
  { id:'pie_d',        nombre:'Pie derecho',          shape:{type:'ellipse', cx:162, cy:478, rx:24,     ry:12          } },
  { id:'pie_i',        nombre:'Pie izquierdo',        shape:{type:'ellipse', cx:108, cy:478, rx:24,     ry:12          } },
];

const MUSCULOS_BASE = [
  { id:'trapecio',      nombre:'Trapecio',             shape:{type:'polygon', points:'100,113 140,106 180,113 168,148 112,148'} },
  { id:'pectorales',    nombre:'Pectorales',           shape:{type:'rect',    x:93,   y:115,  width:94,  height:58, rx:5} },
  { id:'deltoides_d',   nombre:'Deltoides derecho',    shape:{type:'circle',  cx:200, cy:130, r:18               } },
  { id:'deltoides_i',   nombre:'Deltoides izquierdo',  shape:{type:'circle',  cx:80,  cy:130, r:18               } },
  { id:'biceps_d',      nombre:'Bíceps derecho',       shape:{type:'rect',    x:194,  y:128,  width:28,  height:56, rx:10} },
  { id:'biceps_i',      nombre:'Bíceps izquierdo',     shape:{type:'rect',    x:58,   y:128,  width:28,  height:56, rx:10} },
  { id:'abdominales',   nombre:'Abdominales',          shape:{type:'rect',    x:98,   y:175,  width:84,  height:88, rx:5} },
  { id:'cuadriceps_d',  nombre:'Cuádriceps derecho',   shape:{type:'rect',    x:147,  y:278,  width:38,  height:88, rx:8} },
  { id:'cuadriceps_i',  nombre:'Cuádriceps izquierdo', shape:{type:'rect',    x:95,   y:278,  width:38,  height:88, rx:8} },
  { id:'gemelos_d',     nombre:'Gemelos derechos',     shape:{type:'rect',    x:151,  y:388,  width:32,  height:75, rx:8} },
  { id:'gemelos_i',     nombre:'Gemelos izquierdos',   shape:{type:'rect',    x:97,   y:388,  width:32,  height:75, rx:8} },
];

const MUSCULOS_EXTRA_MEDIO = [
  { id:'triceps_d',     nombre:'Tríceps derecho',      shape:{type:'rect',    x:195,  y:140,  width:28,  height:50, rx:10} },
  { id:'triceps_i',     nombre:'Tríceps izquierdo',    shape:{type:'rect',    x:57,   y:140,  width:28,  height:50, rx:10} },
  { id:'oblicuos_d',    nombre:'Oblicuos derechos',    shape:{type:'rect',    x:178,  y:175,  width:16,  height:82, rx:5} },
  { id:'oblicuos_i',    nombre:'Oblicuos izquierdos',  shape:{type:'rect',    x:86,   y:175,  width:16,  height:82, rx:5} },
  { id:'dorsal_d',      nombre:'Dorsal derecho',       shape:{type:'rect',    x:162,  y:125,  width:26,  height:88, rx:8} },
  { id:'dorsal_i',      nombre:'Dorsal izquierdo',     shape:{type:'rect',    x:92,   y:125,  width:26,  height:88, rx:8} },
  { id:'gluteo_d',      nombre:'Glúteo derecho',       shape:{type:'ellipse', cx:164, cy:278, rx:28,     ry:20          } },
  { id:'gluteo_i',      nombre:'Glúteo izquierdo',     shape:{type:'ellipse', cx:116, cy:278, rx:28,     ry:20          } },
  { id:'isquiotibial_d',nombre:'Isquiotibial derecho', shape:{type:'rect',    x:147,  y:295,  width:36,  height:72, rx:8} },
  { id:'isquiotibial_i',nombre:'Isquiotibial izquierdo',shape:{type:'rect',   x:97,   y:295,  width:36,  height:72, rx:8} },
  { id:'soleo_d',       nombre:'Sóleo derecho',        shape:{type:'rect',    x:153,  y:400,  width:28,  height:65, rx:6} },
  { id:'soleo_i',       nombre:'Sóleo izquierdo',      shape:{type:'rect',    x:99,   y:400,  width:28,  height:65, rx:6} },
];

const MUSCULOS_EXTRA_PRO = [
  { id:'esternocleid',  nombre:'Esternocleidomastoideo',shape:{type:'rect',   x:128,  y:88,   width:12,  height:28, rx:4} },
  { id:'serrato_d',     nombre:'Serrato anterior derecho',shape:{type:'polygon',points:'168,138 186,155 178,192 165,182'} },
  { id:'serrato_i',     nombre:'Serrato anterior izquierdo',shape:{type:'polygon',points:'112,138 94,155 102,192 115,182'} },
  { id:'braquial_d',    nombre:'Braquial derecho',      shape:{type:'rect',    x:196,  y:168,  width:26,  height:26, rx:5} },
  { id:'braquial_i',    nombre:'Braquial izquierdo',    shape:{type:'rect',    x:58,   y:168,  width:26,  height:26, rx:5} },
  { id:'tibial_d',      nombre:'Tibial anterior derecho',shape:{type:'rect',   x:150,  y:392,  width:16,  height:70, rx:5} },
  { id:'tibial_i',      nombre:'Tibial anterior izquierdo',shape:{type:'rect', x:114,  y:392,  width:16,  height:70, rx:5} },
  { id:'aductor_d',     nombre:'Aductor derecho',       shape:{type:'polygon', points:'144,278 172,280 162,358 142,358'} },
  { id:'aductor_i',     nombre:'Aductor izquierdo',     shape:{type:'polygon', points:'136,278 108,280 118,358 138,358'} },
  { id:'psoasilico',    nombre:'Psoasiliaco',           shape:{type:'ellipse', cx:140, cy:268, rx:22,     ry:12          } },
];

const HUESOS_BASE = [
  { id:'craneo',        nombre:'Cráneo',               shape:{type:'circle',  cx:140, cy:48,  r:38               } },
  { id:'mandibula',     nombre:'Mandíbula',            shape:{type:'rect',    x:118,  y:74,   width:44, height:18, rx:8} },
  { id:'clavicula_d',   nombre:'Clavícula derecha',    shape:{type:'rect',    x:140,  y:112,  width:50, height:8,  rx:4} },
  { id:'clavicula_i',   nombre:'Clavícula izquierda',  shape:{type:'rect',    x:90,   y:112,  width:50, height:8,  rx:4} },
  { id:'esternon',      nombre:'Esternón',             shape:{type:'rect',    x:131,  y:118,  width:18, height:65, rx:4} },
  { id:'humero_d',      nombre:'Húmero derecho',       shape:{type:'rect',    x:197,  y:118,  width:18, height:85, rx:6} },
  { id:'humero_i',      nombre:'Húmero izquierdo',     shape:{type:'rect',    x:65,   y:118,  width:18, height:85, rx:6} },
  { id:'radio_d',       nombre:'Radio derecho',        shape:{type:'rect',    x:215,  y:202,  width:10, height:72, rx:4} },
  { id:'radio_i',       nombre:'Radio izquierdo',      shape:{type:'rect',    x:55,   y:202,  width:10, height:72, rx:4} },
  { id:'femur_d',       nombre:'Fémur derecho',        shape:{type:'rect',    x:152,  y:276,  width:26, height:96, rx:8} },
  { id:'femur_i',       nombre:'Fémur izquierdo',      shape:{type:'rect',    x:102,  y:276,  width:26, height:96, rx:8} },
  { id:'tibia_d',       nombre:'Tibia derecha',        shape:{type:'rect',    x:155,  y:387,  width:20, height:84, rx:5} },
  { id:'tibia_i',       nombre:'Tibia izquierda',      shape:{type:'rect',    x:105,  y:387,  width:20, height:84, rx:5} },
];

const HUESOS_EXTRA_MEDIO = [
  { id:'costillas',     nombre:'Costillas',            shape:{type:'rect',    x:94,   y:122,  width:92, height:72, rx:12} },
  { id:'columna',       nombre:'Columna vertebral',    shape:{type:'rect',    x:133,  y:112,  width:14, height:165,rx:4} },
  { id:'pelvis',        nombre:'Pelvis',               shape:{type:'rect',    x:90,   y:268,  width:100,height:46, rx:10} },
  { id:'rotula_d',      nombre:'Rótula derecha',       shape:{type:'circle',  cx:167, cy:374, r:14               } },
  { id:'rotula_i',      nombre:'Rótula izquierda',     shape:{type:'circle',  cx:113, cy:374, r:14               } },
  { id:'cubito_d',      nombre:'Cúbito derecho',       shape:{type:'rect',    x:227,  y:202,  width:10, height:72, rx:4} },
  { id:'cubito_i',      nombre:'Cúbito izquierdo',     shape:{type:'rect',    x:43,   y:202,  width:10, height:72, rx:4} },
  { id:'escapula_d',    nombre:'Escápula derecha',     shape:{type:'rect',    x:168,  y:118,  width:24, height:38, rx:5} },
  { id:'escapula_i',    nombre:'Escápula izquierda',   shape:{type:'rect',    x:88,   y:118,  width:24, height:38, rx:5} },
  { id:'perone_d',      nombre:'Peroné derecho',       shape:{type:'rect',    x:178,  y:387,  width:10, height:82, rx:4} },
  { id:'perone_i',      nombre:'Peroné izquierdo',     shape:{type:'rect',    x:92,   y:387,  width:10, height:82, rx:4} },
];

const HUESOS_EXTRA_PRO = [
  { id:'hioides',       nombre:'Hioides',              shape:{type:'rect',    x:128,  y:90,   width:24, height:6,  rx:3} },
  { id:'vertebras_c',   nombre:'Vértebras cervicales', shape:{type:'rect',    x:133,  y:88,   width:14, height:26, rx:3} },
  { id:'carpo_d',       nombre:'Carpo derecho',        shape:{type:'rect',    x:212,  y:274,  width:28, height:18, rx:4} },
  { id:'carpo_i',       nombre:'Carpo izquierdo',      shape:{type:'rect',    x:40,   y:274,  width:28, height:18, rx:4} },
  { id:'metacarpo_d',   nombre:'Metacarpos derechos',  shape:{type:'rect',    x:214,  y:290,  width:24, height:18, rx:3} },
  { id:'metacarpo_i',   nombre:'Metacarpos izquierdos',shape:{type:'rect',    x:42,   y:290,  width:24, height:18, rx:3} },
  { id:'calcaneo_d',    nombre:'Calcáneo derecho',     shape:{type:'ellipse', cx:168, cy:478, rx:16,    ry:10          } },
  { id:'calcaneo_i',    nombre:'Calcáneo izquierdo',   shape:{type:'ellipse', cx:112, cy:478, rx:16,    ry:10          } },
  { id:'tarso_d',       nombre:'Tarso derecho',        shape:{type:'rect',    x:148,  y:472,  width:28, height:14, rx:4} },
  { id:'tarso_i',       nombre:'Tarso izquierdo',      shape:{type:'rect',    x:104,  y:472,  width:28, height:14, rx:4} },
];

const CIRCULATORIO = [
  { id:'corazon',       nombre:'Corazón',              shape:{type:'ellipse', cx:120, cy:158, rx:24, ry:27          } },
  { id:'auricula_d',    nombre:'Aurícula derecha',     shape:{type:'ellipse', cx:133, cy:144, rx:12, ry:10          } },
  { id:'auricula_i',    nombre:'Aurícula izquierda',   shape:{type:'ellipse', cx:110, cy:144, rx:11, ry:10          } },
  { id:'ventriculo_d',  nombre:'Ventrículo derecho',   shape:{type:'ellipse', cx:131, cy:168, rx:13, ry:13          } },
  { id:'ventriculo_i',  nombre:'Ventrículo izquierdo', shape:{type:'ellipse', cx:110, cy:170, rx:12, ry:13          } },
  { id:'aorta',         nombre:'Aorta',                shape:{type:'rect',    x:134,  y:120,  width:12, height:38, rx:5} },
  { id:'art_pulmonar',  nombre:'Arteria pulmonar',     shape:{type:'rect',    x:140,  y:134,  width:30, height:10, rx:4} },
  { id:'vena_cava_sup', nombre:'Vena cava superior',   shape:{type:'rect',    x:155,  y:126,  width:10, height:30, rx:4} },
  { id:'vena_cava_inf', nombre:'Vena cava inferior',   shape:{type:'rect',    x:155,  y:155,  width:10, height:30, rx:4} },
  { id:'carotida_d',    nombre:'Arteria carótida derecha',shape:{type:'rect', x:144,  y:88,   width:8,  height:28, rx:3} },
  { id:'carotida_i',    nombre:'Arteria carótida izquierda',shape:{type:'rect',x:128, y:88,   width:8,  height:28, rx:3} },
  { id:'yugular',       nombre:'Vena yugular',         shape:{type:'rect',    x:136,  y:88,   width:8,  height:28, rx:3} },
  { id:'art_femoral_d', nombre:'Arteria femoral derecha',shape:{type:'rect',  x:158,  y:278,  width:8,  height:90, rx:4} },
  { id:'art_femoral_i', nombre:'Arteria femoral izquierda',shape:{type:'rect',x:114,  y:278,  width:8,  height:90, rx:4} },
  { id:'capilares',     nombre:'Red capilar',          shape:{type:'rect',    x:94,   y:180,  width:92, height:60, rx:8} },
];

const DIGESTIVO = [
  { id:'boca',          nombre:'Boca',                 shape:{type:'rect',    x:122,  y:78,   width:36, height:14, rx:6} },
  { id:'esofago',       nombre:'Esófago',              shape:{type:'rect',    x:135,  y:92,   width:10, height:28, rx:4} },
  { id:'estomago',      nombre:'Estómago',             shape:{type:'ellipse', cx:120, cy:196, rx:28,    ry:22          } },
  { id:'higado',        nombre:'Hígado',               shape:{type:'rect',    x:148,  y:165,  width:42, height:38, rx:8} },
  { id:'vesicula',      nombre:'Vesícula biliar',      shape:{type:'ellipse', cx:176, cy:210, rx:11,    ry:9           } },
  { id:'pancreas',      nombre:'Páncreas',             shape:{type:'ellipse', cx:132, cy:230, rx:32,    ry:9           } },
  { id:'int_delgado',   nombre:'Intestino delgado',    shape:{type:'ellipse', cx:132, cy:258, rx:38,    ry:34          } },
  { id:'int_grueso',    nombre:'Intestino grueso',     shape:{type:'rect',    x:94,   y:220,  width:92, height:82, rx:16} },
  { id:'recto',         nombre:'Recto',                shape:{type:'rect',    x:130,  y:292,  width:20, height:22, rx:5} },
  { id:'apendice',      nombre:'Apéndice',             shape:{type:'rect',    x:182,  y:288,  width:8,  height:18, rx:4} },
  { id:'ano',           nombre:'Ano',                  shape:{type:'circle',  cx:140, cy:316, r:8                    } },
];

const RESPIRATORIO = [
  { id:'nariz',         nombre:'Nariz',                shape:{type:'ellipse', cx:140, cy:62,  rx:12,    ry:9           } },
  { id:'faringe',       nombre:'Faringe',              shape:{type:'rect',    x:130,  y:86,   width:20, height:18, rx:5} },
  { id:'laringe',       nombre:'Laringe',              shape:{type:'rect',    x:132,  y:103,  width:16, height:12, rx:4} },
  { id:'traquea',       nombre:'Tráquea',              shape:{type:'rect',    x:135,  y:114,  width:10, height:30, rx:4} },
  { id:'bronquio_d',    nombre:'Bronquio derecho',     shape:{type:'rect',    x:143,  y:141,  width:22, height:9,  rx:3} },
  { id:'bronquio_i',    nombre:'Bronquio izquierdo',   shape:{type:'rect',    x:115,  y:141,  width:22, height:9,  rx:3} },
  { id:'bronquiolo',    nombre:'Bronquiolos',          shape:{type:'rect',    x:105,  y:148,  width:70, height:12, rx:5} },
  { id:'pulmon_d',      nombre:'Pulmón derecho',       shape:{type:'ellipse', cx:170, cy:168, rx:28,    ry:42          } },
  { id:'pulmon_i',      nombre:'Pulmón izquierdo',     shape:{type:'ellipse', cx:110, cy:168, rx:26,    ry:42          } },
  { id:'alveolo',       nombre:'Alvéolos',             shape:{type:'ellipse', cx:140, cy:168, rx:12,    ry:12          } },
  { id:'diafragma',     nombre:'Diafragma',            shape:{type:'rect',    x:90,   y:212,  width:100,height:12, rx:6} },
];

// ── Config ────────────────────────────────────────────────────────────────────
const SYSTEM_COLOR = {
  cuerpo:'#d97706', musculos:'#dc2626', huesos:'#64748b',
  circulatorio:'#b91c1c', digestivo:'#b45309', respiratorio:'#0284c7',
};
const SYSTEM_LABEL = {
  cuerpo:'Partes del Cuerpo', musculos:'Músculos', huesos:'Huesos',
  circulatorio:'Sistema Circulatorio', digestivo:'Sistema Digestivo', respiratorio:'Sistema Respiratorio',
};
const SYSTEM_EMOJI = {
  cuerpo:'🧍', musculos:'💪', huesos:'🦴', circulatorio:'🫀', digestivo:'🍽️', respiratorio:'🫁',
};
const SYSTEM_QUESTION = {
  cuerpo:'del cuerpo humano', musculos:'del sistema muscular', huesos:'del esqueleto',
  circulatorio:'del sistema circulatorio', digestivo:'del sistema digestivo', respiratorio:'del sistema respiratorio',
};

// Fusiona pares derecho/izquierdo en un solo elemento que resalta AMBOS lados.
// (En una silueta de frente no se distingue qué lado es cuál, así que la
//  respuesta pasa a ser genérica: "Bíceps" en vez de "Bíceps derecho".)
const LATERAL_RE = /\s+(derech[oa]s?|izquierd[oa]s?)$/i;
const mergeBilateral = (pool) => {
  const map = new Map();
  const orden = [];
  for (const el of pool) {
    const nombre = el.nombre.replace(LATERAL_RE, '').trim();
    const id     = el.id.replace(/_[di]$/, '');
    if (map.has(nombre)) {
      map.get(nombre).shapes.push(el.shape);
    } else {
      const merged = { ...el, id, nombre, shape: el.shape, shapes: [el.shape] };
      map.set(nombre, merged);
      orden.push(nombre);
    }
  }
  return orden.map(n => map.get(n));
};

// Partes que están en la ESPALDA (misma zona de la silueta frontal que otra frontal)
const POSTERIOR = new Set(['trapecio', 'gemelos', 'triceps', 'dorsal', 'gluteo', 'isquiotibial', 'soleo', 'escapula', 'columna', 'calcaneo']);
const tagVista = (list) => list.map((el) => ({
  ...el,
  vista: el.vista || (POSTERIOR.has((el.id || '').replace(/_[di]$/, '')) ? 'posterior' : 'frontal'),
}));

const getPool = (modo, nivel) => {
  let list = [];
  // Sistemas internos: se mantiene izquierdo/derecho (es anatómicamente distinto).
  if (modo === 'circulatorio') list = CIRCULATORIO;
  else if (modo === 'digestivo') list = DIGESTIVO;
  else if (modo === 'respiratorio') list = RESPIRATORIO;
  // Cuerpo / músculos / huesos: se fusiona izquierdo/derecho.
  else if (modo === 'cuerpo') list = mergeBilateral(CUERPO_PARTES);
  else if (modo === 'musculos') {
    if (nivel === 'basico') list = mergeBilateral(MUSCULOS_BASE);
    else if (nivel === 'medio') list = mergeBilateral([...MUSCULOS_BASE, ...MUSCULOS_EXTRA_MEDIO]);
    else list = mergeBilateral([...MUSCULOS_BASE, ...MUSCULOS_EXTRA_MEDIO, ...MUSCULOS_EXTRA_PRO]);
  } else if (modo === 'huesos') {
    if (nivel === 'basico') list = mergeBilateral(HUESOS_BASE);
    else if (nivel === 'medio') list = mergeBilateral([...HUESOS_BASE, ...HUESOS_EXTRA_MEDIO]);
    else list = mergeBilateral([...HUESOS_BASE, ...HUESOS_EXTRA_MEDIO, ...HUESOS_EXTRA_PRO]);
  } else return [];
  return tagVista(list);
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const norm = s =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

const playSound = type => {
  const audio = new Audio(type === 'CORRECT' ? correctSoundFile : wrongSoundFile);
  audio.volume = 0.6;
  audio.play().catch(() => {});
  if (type === 'CORRECT') setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
};

const generarOpciones = (correcto, pool) =>
  shuffle([correcto, ...shuffle(pool.filter(p => p.id !== correcto.id)).slice(0, 3)]);

// ── Dataset de anatomía (imágenes reales) ──────────────────────────────────────
const CATEGORIAS = ['Órgano', 'Hueso', 'Músculo'];
const SISTEMAS = [...new Set(ANATOMIA.map(a => a.sistema))];

// Busca en el dataset la imagen que corresponde a un nombre de elemento SVG
// (p.ej. "Bíceps" → "Bíceps braquial"). Devuelve el item o null.
const findAnatomia = (nombre) => {
  const n = norm(nombre);
  if (!n) return null;
  return ANATOMIA.find(d => {
    const dn = norm(d.nombre);
    return dn === n || dn.startsWith(n + ' ') || n.startsWith(dn + ' ');
  }) || null;
};

// Inverso: dado un nombre del dataset, localiza el elemento en una silueta SVG
// para mostrar "dónde está". Devuelve { modo, nivel, id } o null.
const ESQUEMA_FUENTES = [
  { modo:'cuerpo',       nivel:'basico'   },
  { modo:'musculos',     nivel:'avanzado' },
  { modo:'huesos',       nivel:'avanzado' },
  { modo:'circulatorio', nivel:'basico'   },
  { modo:'digestivo',    nivel:'basico'   },
  { modo:'respiratorio', nivel:'basico'   },
];
const findEsquema = (nombre) => {
  const n = norm(nombre);
  if (!n) return null;
  for (const f of ESQUEMA_FUENTES) {
    const el = getPool(f.modo, f.nivel).find(e => {
      const en = norm(e.nombre);
      return en === n || en.startsWith(n + ' ') || n.startsWith(en + ' ');
    });
    if (el) return { modo:f.modo, nivel:f.nivel, id:el.id };
  }
  return null;
};

const DIF_COLOR = { 'Fácil':'#22c55e', 'Media':'#f59e0b', 'Difícil':'#f97316', 'Experto':'#ef4444' };

// Posición aproximada de CADA elemento del dataset sobre la silueta (viewBox 0 0 280 520).
// Cada entrada es una lista de puntos {cx,cy} (dos para estructuras pares: pulmones, riñones, fémur...).
const LOCALIZACION = {
  // Órganos
  'org-01':[{cx:140,cy:48}], 'org-02':[{cx:126,cy:150}], 'org-03':[{cx:112,cy:150},{cx:160,cy:150}],
  'org-04':[{cx:120,cy:195}], 'org-05':[{cx:165,cy:180}], 'org-06':[{cx:132,cy:212}],
  'org-07':[{cx:135,cy:250}], 'org-08':[{cx:130,cy:235}], 'org-09':[{cx:108,cy:225},{cx:172,cy:225}],
  'org-10':[{cx:140,cy:288}], 'org-11':[{cx:172,cy:196}], 'org-12':[{cx:170,cy:193}],
  'org-13':[{cx:140,cy:100}], 'org-14':[{cx:140,cy:62}], 'org-15':[{cx:108,cy:208},{cx:172,cy:208}],
  'org-16':[{cx:140,cy:185}], 'org-17':[{cx:140,cy:108}], 'org-18':[{cx:140,cy:138}],
  // Huesos
  'hue-01':[{cx:140,cy:48}], 'hue-02':[{cx:140,cy:82}], 'hue-03':[{cx:115,cy:114},{cx:165,cy:114}],
  'hue-04':[{cx:140,cy:150}], 'hue-05':[{cx:140,cy:190}], 'hue-06':[{cx:140,cy:288}],
  'hue-07':[{cx:72,cy:150},{cx:208,cy:150}], 'hue-08':[{cx:55,cy:238},{cx:225,cy:238}],
  'hue-09':[{cx:50,cy:238},{cx:230,cy:238}], 'hue-10':[{cx:113,cy:320},{cx:167,cy:320}],
  'hue-11':[{cx:113,cy:430},{cx:167,cy:430}], 'hue-12':[{cx:120,cy:430},{cx:160,cy:430}],
  'hue-13':[{cx:100,cy:132},{cx:180,cy:132}], 'hue-14':[{cx:140,cy:40}], 'hue-15':[{cx:140,cy:42}],
  'hue-16':[{cx:140,cy:56}], 'hue-17':[{cx:140,cy:96}], 'hue-18':[{cx:140,cy:102}],
  'hue-19':[{cx:140,cy:292}], 'hue-20':[{cx:140,cy:74}], 'hue-21':[{cx:108,cy:478},{cx:162,cy:478}],
  'hue-22':[{cx:140,cy:55}],
  // Músculos
  'mus-01':[{cx:140,cy:72}], 'mus-02':[{cx:128,cy:100},{cx:152,cy:100}], 'mus-03':[{cx:80,cy:128},{cx:200,cy:128}],
  'mus-04':[{cx:120,cy:140},{cx:160,cy:140}], 'mus-05':[{cx:72,cy:155},{cx:208,cy:155}],
  'mus-06':[{cx:72,cy:165},{cx:208,cy:165}], 'mus-07':[{cx:140,cy:118}], 'mus-08':[{cx:105,cy:160},{cx:175,cy:160}],
  'mus-09':[{cx:140,cy:215}], 'mus-10':[{cx:116,cy:285},{cx:164,cy:285}], 'mus-11':[{cx:113,cy:320},{cx:167,cy:320}],
  'mus-12':[{cx:113,cy:332},{cx:167,cy:332}], 'mus-13':[{cx:113,cy:420},{cx:167,cy:420}], 'mus-14':[{cx:140,cy:200}],
  'mus-15':[{cx:122,cy:320},{cx:158,cy:320}], 'mus-16':[{cx:113,cy:412},{cx:167,cy:412}], 'mus-17':[{cx:140,cy:138}],
  'mus-18':[{cx:140,cy:268}], 'mus-19':[{cx:120,cy:165},{cx:160,cy:165}], 'mus-20':[{cx:113,cy:428},{cx:167,cy:428}],
};

// Silueta con marcador(es) en la posición aproximada del elemento.
function EsquemaLocalizacion({ puntos, color = '#0ea5e9' }) {
  return (
    <svg viewBox="0 0 280 520" style={{ width:'100%', maxWidth:220, display:'block', margin:'0 auto' }}>
      {BG_SHAPES.map((s, i) => (
        <SvgShape key={i} s={s} fill="rgba(148,163,184,0.22)" stroke="#475569" strokeWidth={1} />
      ))}
      {(puntos || []).map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={10} fill={color} stroke="#fff" strokeWidth={2}>
            <animate attributeName="r" values="9;13;9" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={p.cx} cy={p.cy} r={10} fill="none" stroke={color} strokeWidth={2} opacity={0.6}>
            <animate attributeName="r" values="10;22;10" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  );
}

// ── SVG Shape ─────────────────────────────────────────────────────────────────
const SvgShape = ({ s, fill, stroke = '#555', strokeWidth = 1, opacity = 1, filter }) => {
  const p = { fill, stroke, strokeWidth, opacity, filter };
  if (s.type === 'circle')  return <circle  {...p} cx={s.cx} cy={s.cy} r={s.r} />;
  if (s.type === 'ellipse') return <ellipse {...p} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
  if (s.type === 'rect')    return <rect    {...p} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx||0} />;
  if (s.type === 'polygon') return <polygon {...p} points={s.points} />;
  return null;
};

const inp = { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#f1f5f9', fontSize:'0.92rem', outline:'none', boxSizing:'border-box' };

// ── Component ─────────────────────────────────────────────────────────────────
// ── Panel NATIVO de competición: ¿a qué sistema pertenece? ─────────────────────
const _bioSample = (arr, n, excl) => { const pool = [...new Set(arr)].filter((x) => x !== excl); const out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return out; };
const _bioBarajar = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const BIO_MODOS = Object.keys(SYSTEM_LABEL);

function PanelBioCompeticion({ aplicar, bloqueado, equipo, tipo = 'mix', ambito = 'todos', formato = 'texto' }) {
  const color = equipo === 1 ? '#3498db' : '#e74c3c';
  const prevRef = useRef(null);
  const genOne = () => {
    // ── FOTO: imagen de anatomía → elegir el nombre ──
    if (formato === 'foto') {
      const item = ANATOMIA[Math.floor(Math.random() * ANATOMIA.length)];
      const correcta = item.nombre;
      return { formato: 'foto', img: item.imagenUrl, intro: '¿Qué es?', correcta, opciones: _bioBarajar([correcta, ..._bioSample(ANATOMIA.map((a) => a.nombre), 3, correcta)]) };
    }
    // Elegir sistema (según ámbito)
    const single = ambito && ambito !== 'todos';
    let modo, pool;
    if (single) { modo = ambito; pool = getPool(modo, 'pro') || []; }
    else { for (let k = 0; k < 12; k++) { modo = BIO_MODOS[Math.floor(Math.random() * BIO_MODOS.length)]; pool = getPool(modo, 'pro'); if (pool && pool.length) break; } }
    if (!pool || !pool.length) { modo = 'musculos'; pool = getPool('musculos', 'pro'); }
    const item = pool[Math.floor(Math.random() * pool.length)];

    // ── ESQUEMA: señala una parte en la silueta → elegir el nombre ──
    if (formato === 'esquema') {
      const correcta = item.nombre;
      const mismos = pool.map((x) => x.nombre).filter((n) => n !== correcta);
      let bag = mismos.length >= 3 ? mismos : (() => { let b = []; BIO_MODOS.forEach((m) => { const p = getPool(m, 'pro'); if (p) b = b.concat(p.map((x) => x.nombre)); }); return b; })();
      return { formato: 'esquema', modo, highlightId: item.id, vista: item.vista, intro: '¿Qué parte está señalada?', correcta, opciones: _bioBarajar([correcta, ..._bioSample(bag, 3, correcta)]) };
    }

    // ── TEXTO (por defecto): ¿qué sistema? / ¿qué parte? ──
    const t = single ? 'parte' : ((tipo && tipo !== 'mix') ? tipo : (Math.random() < 0.5 ? 'sistema' : 'parte'));
    if (t === 'parte') {
      const correcta = item.nombre;
      let bag = [];
      BIO_MODOS.filter((m) => m !== modo).forEach((m) => { const p = getPool(m, 'pro'); if (p) bag = bag.concat(p.map((x) => x.nombre)); });
      return { formato: 'texto', intro: `¿Cuál pertenece a: ${SYSTEM_LABEL[modo]}?`, foco: null, correcta, opciones: _bioBarajar([correcta, ..._bioSample(bag, 3, correcta)]) };
    }
    const correcta = SYSTEM_LABEL[modo];
    return { formato: 'texto', intro: '¿A qué sistema pertenece?', foco: item.nombre, correcta, opciones: _bioBarajar([correcta, ..._bioSample(Object.values(SYSTEM_LABEL), 3, correcta)]) };
  };
  // Evita repetir la pregunta anterior (misma respuesta correcta / parte señalada)
  const gen = () => {
    let q, tries = 0;
    const clave = (x) => `${x.foco || x.highlightId || ''}|${x.correcta}`;
    do { q = genOne(); tries++; } while (clave(q) === prevRef.current && tries < 10);
    prevRef.current = clave(q);
    return q;
  };
  const [q, setQ] = useState(gen);
  const [sel, setSel] = useState(null);
  const responder = (op) => {
    if (bloqueado || sel) return;
    const ok = op === q.correcta;
    setSel(op);
    try { const a = new Audio(ok ? correctSoundFile : wrongSoundFile); a.volume = 0.5; a.play().catch(() => {}); } catch (e) { /* noop */ }
    aplicar(ok);
    setTimeout(() => { setSel(null); setQ(gen()); }, 1050);
  };
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 14, border: `3px solid ${sel ? (sel === q.correcta ? '#10b981' : '#ef4444') : color}`, boxShadow: '0 4px 15px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 900, color }}>{equipo === 1 ? '🔵 Equipo 1' : '🔴 Equipo 2'}</div>
      {q.formato === 'esquema' && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 6, position: 'relative' }}>
          {q.vista && (
            <span style={{ position: 'absolute', top: 8, left: 8, background: q.vista === 'posterior' ? 'rgba(2,132,199,0.9)' : 'rgba(217,119,6,0.9)', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 800, zIndex: 2 }}>
              {q.vista === 'posterior' ? '🔄 Espalda' : '👤 Frente'}
            </span>
          )}
          <BodySVGLive modo={q.modo} nivel="pro" highlightId={q.highlightId} ocultarNombre feedbackOk={sel ? (sel === q.correcta) : undefined} />
        </div>
      )}
      {q.formato === 'foto' && q.img && (
        <img src={q.img} alt="anatomía" loading="lazy" style={{ width: '100%', maxHeight: 190, objectFit: 'contain', borderRadius: 10, background: '#f1f5f9' }} />
      )}
      <div style={{ fontWeight: 700, color: '#1e293b', textAlign: 'center', minHeight: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{q.intro}</span>
        {q.foco && <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>{q.foco}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {q.opciones.map((op, i) => {
          const estado = sel ? (op === q.correcta ? 'ok' : (op === sel ? 'bad' : '')) : '';
          return (
            <button key={i} onClick={() => responder(op)} disabled={!!sel || bloqueado}
              style={{ padding: '10px 8px', borderRadius: 10, border: '2px solid #e2e8f0', cursor: (sel || bloqueado) ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.85rem',
                background: estado === 'ok' ? '#d1fae5' : estado === 'bad' ? '#fee2e2' : '#f8fafc', color: '#1e293b' }}>
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BiologiaAppInner({ onBack, onCreateLive, onJoinLive }) {
  const [pantalla,    setPantalla]    = useState('intro');
  const [tipoComp,    setTipoComp]    = useState('mix'); // tipo de pregunta en competición
  const [ambitoBio,   setAmbitoBio]   = useState('todos'); // sistema elegido en competición
  const [formatoBio,  setFormatoBio]  = useState('texto'); // texto | esquema | foto
  const [modoJuego,   setModoJuego]   = useState('cuerpo');
  const [nivel,       setNivel]       = useState('basico');
  const [modo,        setModo]        = useState('seleccionar');
  const [preguntas,   setPreguntas]   = useState([]);
  const [idx,         setIdx]         = useState(0);
  const [opciones,    setOpciones]    = useState([]);
  const [respuestas,  setRespuestas]  = useState([]);
  const [tiempo,      setTiempo]      = useState(TIEMPO);
  const [fase,        setFase]        = useState('jugando');
  const [correcto,    setCorrecto]    = useState(null);
  const [input,       setInput]       = useState('');
  const [glowing,     setGlowing]     = useState(false);
  const [modalEnviar, setModalEnviar] = useState(false);
  const [mNombre,     setMNombre]     = useState('');
  const [mCurso,      setMCurso]      = useState('');
  const [mCodigo,     setMCodigo]     = useState('');
  const [enviando,    setEnviando]    = useState(false);
  const [joinCode,    setJoinCode]    = useState('');
  const [joinName,    setJoinName]    = useState('');

  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const pool  = getPool(modoJuego, nivel);
  const item  = preguntas[idx];
  const color = SYSTEM_COLOR[modoJuego];

  // Glow pulse on new question
  useEffect(() => {
    if (pantalla !== 'quiz') return;
    setGlowing(false);
    const t = setTimeout(() => setGlowing(true), 80);
    return () => clearTimeout(t);
  }, [idx, pantalla]);

  // Options
  useEffect(() => {
    if (pantalla !== 'quiz' || modo !== 'seleccionar' || !item) return;
    setOpciones(generarOpciones(item, getPool(modoJuego, nivel)));
  }, [idx, pantalla, preguntas, modo, modoJuego, nivel]); // eslint-disable-line

  // Timer
  useEffect(() => {
    if (pantalla !== 'quiz' || fase !== 'jugando') return;
    timerRef.current = setInterval(() => {
      setTiempo(t => {
        if (t <= 1) { clearInterval(timerRef.current); procesarRespuesta(null); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [pantalla, fase, idx]); // eslint-disable-line

  const procesarRespuesta = useCallback((respuesta) => {
    clearInterval(timerRef.current);
    const current = preguntas[idx];
    if (!current) return;
    const esCorrecta = respuesta !== null && norm(respuesta) === norm(current.nombre);
    playSound(esCorrecta ? 'CORRECT' : 'WRONG');
    setCorrecto(esCorrecta);
    setFase('feedback');
    setRespuestas(prev => [...prev, { correcto: esCorrecta, nombre: current.nombre, dada: respuesta }]);
    setTimeout(() => {
      const next = idx + 1;
      if (next >= preguntas.length) { setPantalla('resultado'); return; }
      setIdx(next);
      setFase('jugando');
      setTiempo(TIEMPO);
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 1600);
  }, [idx, preguntas]);

  const iniciarTest = () => {
    const p = getPool(modoJuego, nivel);
    if (p.length < 2) return;
    setPreguntas(shuffle(p).slice(0, Math.min(N_PREGUNTAS, p.length)));
    setIdx(0); setRespuestas([]); setFase('jugando');
    setTiempo(TIEMPO); setInput(''); setPantalla('quiz');
  };

  const enviarAlProfesor = async (aciertos, total) => {
    if (!mNombre.trim()) { alert('Introduce tu nombre'); return; }
    const cod = mCodigo.trim().toUpperCase();
    if (cod.length < 3) { alert('Introduce el código de tu profesor'); return; }
    setEnviando(true);
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', cod));
      if (!snap.exists()) { alert('Código de profesor no encontrado.'); setEnviando(false); return; }
      const pct = Math.round((aciertos / total) * 100);
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'BIOLOGIA', modalidad: 'Individual', fecha: new Date(),
        codigoProfesor: cod,
        config: {
          modoJuego,
          nivel: (modoJuego === 'musculos' || modoJuego === 'huesos') ? nivel : null,
          modoRespuesta: modo,
        },
        jugadores: [{ nombre: mNombre.trim(), curso: mCurso.trim(), aciertos, intentos: total, fallos: total - aciertos, porcentaje: pct }],
      });
      alert('✅ Resultado enviado al profesor.');
      setModalEnviar(false); setMNombre(''); setMCurso(''); setMCodigo('');
    } catch (e) { alert('Error: ' + e.message); }
    setEnviando(false);
  };

  const handleUnirse = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return alert('El código debe tener 6 caracteres.');
    if (!joinName.trim()) return alert('Introduce tu nombre.');
    onJoinLive?.(code, { displayName: joinName.trim(), uid: 'guest_' + Math.random().toString(36).substr(2, 8) });
  };

  // ── SVG render ──────────────────────────────────────────────────────────────
  const BodySVG = ({ highlightId, feedbackOk }) => {
    const currentPool = getPool(modoJuego, nivel);
    return (
      <svg viewBox="0 0 280 520" width="100%" style={{ maxWidth:280, display:'block', margin:'0 auto', filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}>
        <defs>
          <filter id="glow-bio" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Silhouette */}
        {BG_SHAPES.map((s, i) => (
          <SvgShape key={i} s={s} fill="#c9a882" stroke="#a07850" strokeWidth={1} />
        ))}
        {/* System elements */}
        {currentPool.map(el => {
          const isHL = el.id === highlightId;
          const isFeedback = isHL && feedbackOk !== undefined;
          const fill = isFeedback
            ? (feedbackOk ? '#22c55e' : '#ef4444')
            : isHL ? '#fbbf24' : color;
          const stroke = isFeedback
            ? (feedbackOk ? '#15803d' : '#b91c1c')
            : isHL ? '#92400e' : '#fff';
          // Un elemento puede tener varios trozos (lados fusionados): se dibujan todos.
          return (el.shapes || [el.shape]).map((sh, k) => (
            <SvgShape
              key={el.id + '_' + k}
              s={sh}
              fill={fill}
              stroke={stroke}
              strokeWidth={isHL ? 2.5 : 0.8}
              opacity={isHL ? 1 : (highlightId ? 0.18 : 0.55)}
              filter={isHL && glowing && !isFeedback ? 'url(#glow-bio)' : undefined}
            />
          ));
        })}
      </svg>
    );
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const bg   = 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)';
  const card = { background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'16px 18px', border:'1px solid rgba(255,255,255,0.1)' };

  // ══════════════════════════════════════════════════════════════════════════════
  // ANATOMÍA CON IMÁGENES (modo nuevo)
  // ══════════════════════════════════════════════════════════════════════════════
  if (pantalla === 'imagenes') {
    return <AnatomiaQuiz onBack={() => setPantalla('intro')} />;
  }
  if (pantalla === 'competicion') {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a,#1e293b)', padding:16, boxSizing:'border-box' }}>
        <button onClick={() => setPantalla('intro')} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#f1f5f9', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:'0.9rem', marginBottom:12 }}>← Salir</button>
        <div style={{ maxWidth:1000, margin:'0 auto', background:'#f1f5f9', borderRadius:20, padding:16 }}>
          <CompeticionCuerda onSalir={() => setPantalla('intro')}
            configExtra={(
              <>
                <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
                  <span style={{ color:'#7d6608' }}>Formato:</span>
                  {[['texto','📝 Texto'],['esquema','🧍 Esquema'],['foto','📷 Foto']].map(([id,lbl]) => (
                    <button key={id} onClick={() => setFormatoBio(id)}
                      style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', fontWeight:800, fontSize:'0.78rem', border:'2px solid #7c3aed', background: formatoBio===id ? '#7c3aed' : 'white', color: formatoBio===id ? 'white' : '#7c3aed' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {formatoBio !== 'foto' && (
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
                    <span style={{ color:'#7d6608' }}>Sistema:</span>
                    <button onClick={() => setAmbitoBio('todos')}
                      style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', fontWeight:800, fontSize:'0.78rem', border:'2px solid #dc2626', background: ambitoBio==='todos' ? '#dc2626' : 'white', color: ambitoBio==='todos' ? 'white' : '#dc2626' }}>🎲 Todos</button>
                    {Object.keys(SYSTEM_LABEL).map((m) => (
                      <button key={m} onClick={() => setAmbitoBio(m)}
                        style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', fontWeight:800, fontSize:'0.78rem', border:'2px solid #dc2626', background: ambitoBio===m ? '#dc2626' : 'white', color: ambitoBio===m ? 'white' : '#dc2626' }}>
                        {SYSTEM_EMOJI[m]} {SYSTEM_LABEL[m]}
                      </button>
                    ))}
                  </div>
                )}
                {formatoBio === 'texto' && ambitoBio === 'todos' && (
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
                    <span style={{ color:'#7d6608' }}>Preguntas:</span>
                    {[['mix','🎲 Mix'],['sistema','🧭 ¿Qué sistema?'],['parte','🫀 ¿Qué parte?']].map(([id,lbl]) => (
                      <button key={id} onClick={() => setTipoComp(id)}
                        style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', fontWeight:800, fontSize:'0.78rem', border:'2px solid #2563eb', background: tipoComp===id ? '#2563eb' : 'white', color: tipoComp===id ? 'white' : '#2563eb' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            renderPanel={(equipo, api) => <PanelBioCompeticion key={`${api.key}-${formatoBio}-${ambitoBio}-${tipoComp}`} equipo={equipo} aplicar={api.aplicar} bloqueado={api.bloqueado} tipo={tipoComp} ambito={ambitoBio} formato={formatoBio} />} />
        </div>
      </div>
    );
  }
  if (pantalla === 'estudiar') {
    return <AnatomiaEstudio onBack={() => setPantalla('intro')} />;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // INTRO
  // ══════════════════════════════════════════════════════════════════════════════
  if (pantalla === 'intro') {
    const hasLevel = modoJuego === 'musculos' || modoJuego === 'huesos';
    return (
      <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', padding:'20px 16px', fontFamily:'sans-serif' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#f1f5f9', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:'0.9rem' }}>← Volver</button>
          <h1 style={{ margin:0, fontSize:'1.5rem', fontWeight:700 }}>🔬 Biología</h1>
        </div>

        {/* Modo Anatomía con imágenes (NUEVO) */}
        <button onClick={() => setPantalla('imagenes')} style={{
          width:'100%', marginBottom:14, padding:'16px 18px', textAlign:'left', cursor:'pointer',
          background:'linear-gradient(135deg, #7c3aed, #4f46e5)', border:'none', borderRadius:14, color:'#fff',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <span style={{ fontSize:'2rem' }}>📸</span>
          <span style={{ flex:1 }}>
            <span style={{ display:'block', fontSize:'1.05rem', fontWeight:800 }}>Anatomía con imágenes</span>
            <span style={{ display:'block', fontSize:'0.8rem', opacity:0.85, marginTop:2 }}>Mira la imagen y acierta el nombre, el tipo y el sistema · {ANATOMIA.length} elementos</span>
          </span>
          <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:8, padding:'3px 8px', fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.05em' }}>NUEVO</span>
        </button>

        {/* Modo Estudiar (sin puntos) */}
        <button onClick={() => setPantalla('estudiar')} style={{
          width:'100%', marginBottom:14, padding:'16px 18px', textAlign:'left', cursor:'pointer',
          background:'linear-gradient(135deg, #0ea5e9, #0369a1)', border:'none', borderRadius:14, color:'#fff',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <span style={{ fontSize:'2rem' }}>📚</span>
          <span style={{ flex:1 }}>
            <span style={{ display:'block', fontSize:'1.05rem', fontWeight:800 }}>Estudiar anatomía</span>
            <span style={{ display:'block', fontSize:'0.8rem', opacity:0.85, marginTop:2 }}>Mira la imagen, sus características y dónde está · sin puntos</span>
          </span>
        </button>

        {/* Competición por equipos */}
        <button onClick={() => setPantalla('competicion')} style={{
          width:'100%', marginBottom:14, padding:'16px 18px', textAlign:'left', cursor:'pointer',
          background:'linear-gradient(135deg,#f39c12,#e67e22)', border:'none', borderRadius:14, color:'#fff',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <span style={{ fontSize:'2rem' }}>🪢</span>
          <span style={{ flex:1 }}>
            <span style={{ display:'block', fontSize:'1.05rem', fontWeight:800 }}>Competición por equipos</span>
            <span style={{ display:'block', fontSize:'0.8rem', opacity:0.9, marginTop:2 }}>Tirón de cuerda 2 equipos · ¿a qué sistema pertenece cada parte?</span>
          </span>
        </button>

        {/* System selector */}
        <div style={{ fontSize:'0.72rem', color:'#64748b', margin:'0 2px 8px', textTransform:'uppercase', letterSpacing:'0.05em' }}>O practica con la silueta</div>
        {/* System selector */}
        <div style={{ ...card, marginBottom:14 }}>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Elige el sistema</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {Object.keys(SYSTEM_LABEL).map(m => (
              <button key={m} onClick={() => setModoJuego(m)} style={{
                background: modoJuego === m ? SYSTEM_COLOR[m] : 'rgba(255,255,255,0.06)',
                border:`2px solid ${modoJuego === m ? SYSTEM_COLOR[m] : 'rgba(255,255,255,0.1)'}`,
                color:'#f1f5f9', borderRadius:10, padding:'12px 4px', cursor:'pointer',
                fontSize:'0.75rem', fontWeight: modoJuego === m ? 700 : 400,
                display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'all 0.2s',
              }}>
                <span style={{ fontSize:'1.4rem' }}>{SYSTEM_EMOJI[m]}</span>
                <span style={{ textAlign:'center', lineHeight:1.2 }}>{SYSTEM_LABEL[m]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Level (musculos/huesos only) */}
        {hasLevel && (
          <div style={{ ...card, marginBottom:14 }}>
            <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Nivel de dificultad</div>
            <div style={{ display:'flex', gap:8 }}>
              {[['basico','Básico','⭐'],['medio','Medio','⭐⭐'],['pro','Avanzado','⭐⭐⭐']].map(([v, l, s]) => (
                <button key={v} onClick={() => setNivel(v)} style={{
                  flex:1, background: nivel === v ? color : 'rgba(255,255,255,0.06)',
                  border:`2px solid ${nivel === v ? color : 'rgba(255,255,255,0.1)'}`,
                  color:'#f1f5f9', borderRadius:10, padding:'10px 4px', cursor:'pointer',
                  fontSize:'0.78rem', fontWeight: nivel === v ? 700 : 400, textAlign:'center',
                }}>
                  <div>{s}</div>
                  <div style={{ marginTop:2 }}>{l}</div>
                  <div style={{ fontSize:'0.68rem', color:'#94a3b8', marginTop:2 }}>{getPool(modoJuego, v).length} elem.</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Answer mode */}
        <div style={{ ...card, marginBottom:20 }}>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Modo de respuesta</div>
          <div style={{ display:'flex', gap:8 }}>
            {[['seleccionar','Seleccionar opciones','🖱️'],['escribir','Escribir nombre','✏️']].map(([v, l, s]) => (
              <button key={v} onClick={() => setModo(v)} style={{
                flex:1, background: modo === v ? color : 'rgba(255,255,255,0.06)',
                border:`2px solid ${modo === v ? color : 'rgba(255,255,255,0.1)'}`,
                color:'#f1f5f9', borderRadius:10, padding:'12px 8px', cursor:'pointer',
                fontSize:'0.85rem', fontWeight: modo === v ? 700 : 400, textAlign:'center',
              }}>
                {s} {l}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ maxWidth:180, margin:'0 auto 20px' }}>
          <BodySVG highlightId={null} feedbackOk={undefined} />
        </div>

        <button onClick={iniciarTest} disabled={pool.length < 2} style={{
          width:'100%', padding:'16px',
          background: pool.length < 2 ? '#334155' : color,
          color:'#fff', border:'none', borderRadius:12, fontSize:'1.1rem', fontWeight:700,
          cursor: pool.length < 2 ? 'not-allowed' : 'pointer', opacity: pool.length < 2 ? 0.5 : 1,
        }}>
          ▶ Empezar Test — {pool.length} elementos
        </button>

        {/* ── Live mode ──────────────────────────────────────────────────── */}
        <div style={{ ...card, marginTop:14, borderColor:'rgba(220,38,38,0.25)', background:'rgba(220,38,38,0.04)' }}>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>🔴 Juego en Vivo</div>
          {onCreateLive && (
            <button onClick={onCreateLive} style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:'0.88rem', marginBottom:10 }}>
              🔴 Crear Partida en Vivo
            </button>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="CÓDIGO DE SALA" style={{ ...inp, textTransform:'uppercase', letterSpacing:3, textAlign:'center' }} maxLength={6} />
            <input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Tu nombre" style={inp} />
            <button onClick={handleUnirse} disabled={!joinCode || !joinName} style={{ width:'100%', padding:'10px', background:(!joinCode||!joinName)?'rgba(59,130,246,0.3)':'rgba(59,130,246,0.8)', color:'white', border:'none', borderRadius:9, cursor:(!joinCode||!joinName)?'not-allowed':'pointer', fontWeight:600, fontSize:'0.85rem' }}>
              🎮 Unirse a Partida
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // QUIZ
  // ══════════════════════════════════════════════════════════════════════════════
  if (pantalla === 'quiz') {
    const pct      = Math.round((tiempo / TIEMPO) * 100);
    const timerClr = tiempo > 10 ? '#22c55e' : tiempo > 5 ? '#f59e0b' : '#ef4444';

    return (
      <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', fontFamily:'sans-serif', display:'flex', flexDirection:'column' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setPantalla('intro')} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#f1f5f9', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.85rem' }}>✕</button>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'0.85rem', color:'#94a3b8' }}>{idx + 1}/{preguntas.length}</span>
            <div style={{ width:100, height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ width:`${((idx + 1) / preguntas.length) * 100}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }} />
            </div>
          </div>
          <div style={{ width:34, height:34, borderRadius:'50%', background:`conic-gradient(${timerClr} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700 }}>
            {tiempo}
          </div>
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'14px', gap:10, overflowY:'auto' }}>
          {/* Question */}
          <div style={{ textAlign:'center', fontSize:'0.95rem', color:'#e2e8f0', fontWeight:600 }}>
            ¿Cómo se llama esta parte {SYSTEM_QUESTION[modoJuego]}?
          </div>
          {/* Aviso de vista (frontal/posterior) para evitar ambigüedad delante/detrás */}
          {item?.vista && (
            <div style={{ textAlign:'center' }}>
              <span style={{ display:'inline-block', background: item.vista === 'posterior' ? 'rgba(2,132,199,0.22)' : 'rgba(217,119,6,0.22)', color: item.vista === 'posterior' ? '#7dd3fc' : '#fcd34d', border:`1px solid ${item.vista === 'posterior' ? '#0284c7' : '#d97706'}`, borderRadius:20, padding:'3px 12px', fontSize:'0.78rem', fontWeight:700 }}>
                {item.vista === 'posterior' ? '🔄 Vista posterior (espalda)' : '👤 Vista frontal'}
              </span>
            </div>
          )}

          {/* SVG + imagen real (en feedback) */}
          {(() => {
            const dato = fase === 'feedback' ? findAnatomia(item?.nombre) : null;
            return (
              <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', alignItems:'flex-start', gap:14, width:'100%' }}>
                <div style={{ position:'relative', maxWidth:240, flex:'1 1 200px', minWidth:180 }}>
                  <BodySVG
                    highlightId={item?.id}
                    feedbackOk={fase === 'feedback' ? correcto : undefined}
                  />
                  {fase === 'feedback' && (
                    <div style={{
                      position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)',
                      background: correcto ? 'rgba(34,197,94,0.92)' : 'rgba(239,68,68,0.92)',
                      color:'#fff', borderRadius:8, padding:'6px 16px', fontSize:'0.88rem',
                      fontWeight:700, whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(0,0,0,0.35)',
                    }}>
                      {correcto ? `✓ ${item?.nombre}` : `✗ ${item?.nombre}`}
                    </div>
                  )}
                </div>
                {dato && (
                  <div style={{ flex:'1 1 200px', maxWidth:260, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:10, alignSelf:'center' }}>
                    <img src={dato.imagenUrl} alt={dato.nombre} loading="lazy"
                      style={{ width:'100%', maxHeight:200, objectFit:'contain', borderRadius:8, background:'#fff' }} />
                    <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:8, lineHeight:1.35 }}>{dato.descripcion}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Answers */}
          {fase === 'jugando' && modo === 'seleccionar' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {opciones.map((op, i) => (
                <button key={i} onClick={() => procesarRespuesta(op.nombre)} style={{
                  background:'rgba(255,255,255,0.07)', border:`2px solid rgba(255,255,255,0.12)`,
                  color:'#f1f5f9', borderRadius:10, padding:'12px 8px', cursor:'pointer',
                  fontSize:'0.8rem', fontWeight:500, textAlign:'center', transition:'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${color}33`; e.currentTarget.style.borderColor = color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                >
                  {op.nombre}
                </button>
              ))}
            </div>
          )}

          {fase === 'jugando' && modo === 'escribir' && (
            <form onSubmit={e => { e.preventDefault(); if (input.trim()) procesarRespuesta(input.trim()); }} style={{ display:'flex', gap:8 }}>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe el nombre..." style={{ ...inp, flex:1 }} autoFocus />
              <button type="submit" style={{ background:color, border:'none', color:'#fff', borderRadius:9, padding:'9px 16px', cursor:'pointer', fontWeight:700 }}>→</button>
            </form>
          )}

          {fase === 'feedback' && modo === 'seleccionar' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {opciones.map((op, i) => {
                const isOk = norm(op.nombre) === norm(item?.nombre);
                return (
                  <div key={i} style={{
                    background: isOk ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                    border:`2px solid ${isOk ? '#22c55e' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius:10, padding:'12px 8px', fontSize:'0.8rem',
                    color: isOk ? '#86efac' : '#475569', textAlign:'center',
                  }}>
                    {isOk && '✓ '}{op.nombre}
                  </div>
                );
              })}
            </div>
          )}

          {fase === 'feedback' && modo === 'escribir' && (
            <div style={{ textAlign:'center', padding:'14px', background: correcto ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius:10 }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color: correcto ? '#86efac' : '#fca5a5' }}>
                {correcto ? '✓ ¡Correcto!' : `✗ La respuesta era: ${item?.nombre}`}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RESULTADO
  // ══════════════════════════════════════════════════════════════════════════════
  if (pantalla === 'resultado') {
    const aciertos = respuestas.filter(r => r.correcto).length;
    const total    = respuestas.length;
    const pct      = Math.round((aciertos / total) * 100);
    const emoji    = pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : pct >= 50 ? '💪' : '📚';
    const card2    = { background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'16px', border:'1px solid rgba(255,255,255,0.08)' };

    return (
      <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', padding:'20px 16px', fontFamily:'sans-serif' }}>
        <div style={{ maxWidth:420, margin:'0 auto' }}>
          {/* Score */}
          <div style={{ textAlign:'center', marginBottom:22 }}>
            <div style={{ fontSize:'3rem', marginBottom:8 }}>{emoji}</div>
            <h2 style={{ margin:'0 0 4px', fontSize:'1.5rem' }}>{aciertos}/{total} correctas</h2>
            <div style={{ fontSize:'2rem', fontWeight:800, color: pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</div>
            <div style={{ fontSize:'0.85rem', color:'#94a3b8', marginTop:4 }}>
              {SYSTEM_LABEL[modoJuego]}{(modoJuego === 'musculos' || modoJuego === 'huesos') ? ` · ${nivel}` : ''}
            </div>
          </div>

          {/* Review */}
          <div style={{ ...card2, marginBottom:14 }}>
            {respuestas.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom: i < respuestas.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span>{r.correcto ? '✅' : '❌'}</span>
                <span style={{ flex:1, fontSize:'0.86rem', color: r.correcto ? '#86efac' : '#fca5a5' }}>{r.nombre}</span>
                {!r.correcto && r.dada && <span style={{ fontSize:'0.76rem', color:'#475569' }}>→ {r.dada}</span>}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={() => setModalEnviar(true)} style={{ background:color, border:'none', color:'#fff', borderRadius:12, padding:'14px', cursor:'pointer', fontWeight:700, fontSize:'1rem' }}>
              📤 Enviar al Profesor
            </button>
            <button onClick={iniciarTest} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#f1f5f9', borderRadius:12, padding:'14px', cursor:'pointer', fontWeight:600, fontSize:'0.95rem' }}>
              🔄 Repetir
            </button>
            <button onClick={() => { setPantalla('intro'); setPreguntas([]); setRespuestas([]); }} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', borderRadius:12, padding:'12px', cursor:'pointer', fontSize:'0.9rem' }}>
              ← Cambiar modo
            </button>
          </div>
        </div>

        {/* Modal */}
        {modalEnviar && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
            <div style={{ background:'#1e293b', borderRadius:16, padding:24, width:'100%', maxWidth:380, border:'1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:'1.1rem' }}>📤 Enviar resultado al profesor</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                <input value={mNombre} onChange={e => setMNombre(e.target.value)} placeholder="Tu nombre" style={inp} />
                <input value={mCurso} onChange={e => setMCurso(e.target.value)} placeholder="Curso (ej: 3ºA)" style={inp} />
                <input value={mCodigo} onChange={e => setMCodigo(e.target.value)} placeholder="Código del profesor" style={{ ...inp, textTransform:'uppercase' }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => enviarAlProfesor(aciertos, total)} disabled={enviando} style={{ flex:1, background:color, border:'none', color:'#fff', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:700 }}>
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
                <button onClick={() => setModalEnviar(false)} style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'#f1f5f9', borderRadius:10, padding:'12px', cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Live mode helpers ─────────────────────────────────────────────────────────
function genCodeBio() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

const SECCIONES_BIO = [
  { id:'cuerpo',          label:'Partes del Cuerpo',           emoji:'🧍', color:'#d97706' },
  { id:'musculos_basico', label:'Músculos (básico)',            emoji:'💪', color:'#dc2626' },
  { id:'musculos_medio',  label:'Músculos (medio)',             emoji:'💪', color:'#b91c1c' },
  { id:'musculos_avanzado',label:'Músculos (avanzado)',         emoji:'💪', color:'#991b1b' },
  { id:'huesos_basico',   label:'Huesos (básico)',              emoji:'🦴', color:'#64748b' },
  { id:'huesos_medio',    label:'Huesos (medio)',               emoji:'🦴', color:'#475569' },
  { id:'huesos_avanzado', label:'Huesos (avanzado)',            emoji:'🦴', color:'#334155' },
  { id:'circulatorio',    label:'Sistema Circulatorio',         emoji:'🫀', color:'#b91c1c' },
  { id:'digestivo',       label:'Sistema Digestivo',            emoji:'🍽️', color:'#b45309' },
  { id:'respiratorio',    label:'Sistema Respiratorio',         emoji:'🫁', color:'#0284c7' },
];

function getPoolBio(seccionId) {
  if (seccionId === 'cuerpo')           return mergeBilateral(CUERPO_PARTES);
  if (seccionId === 'musculos_basico')  return mergeBilateral(MUSCULOS_BASE);
  if (seccionId === 'musculos_medio')   return mergeBilateral([...MUSCULOS_BASE, ...MUSCULOS_EXTRA_MEDIO]);
  if (seccionId === 'musculos_avanzado')return mergeBilateral([...MUSCULOS_BASE, ...MUSCULOS_EXTRA_MEDIO, ...MUSCULOS_EXTRA_PRO]);
  if (seccionId === 'huesos_basico')    return mergeBilateral(HUESOS_BASE);
  if (seccionId === 'huesos_medio')     return mergeBilateral([...HUESOS_BASE, ...HUESOS_EXTRA_MEDIO]);
  if (seccionId === 'huesos_avanzado')  return mergeBilateral([...HUESOS_BASE, ...HUESOS_EXTRA_MEDIO, ...HUESOS_EXTRA_PRO]);
  if (seccionId === 'circulatorio')     return CIRCULATORIO;
  if (seccionId === 'digestivo')        return DIGESTIVO;
  if (seccionId === 'respiratorio')     return RESPIRATORIO;
  return [];
}

function getModoNivelBio(seccionId) {
  if (seccionId === 'cuerpo')           return { modo:'cuerpo',       nivel:'basico' };
  if (seccionId === 'musculos_basico')  return { modo:'musculos',     nivel:'basico' };
  if (seccionId === 'musculos_medio')   return { modo:'musculos',     nivel:'medio'  };
  if (seccionId === 'musculos_avanzado')return { modo:'musculos',     nivel:'avanzado'};
  if (seccionId === 'huesos_basico')    return { modo:'huesos',       nivel:'basico' };
  if (seccionId === 'huesos_medio')     return { modo:'huesos',       nivel:'medio'  };
  if (seccionId === 'huesos_avanzado')  return { modo:'huesos',       nivel:'avanzado'};
  if (seccionId === 'circulatorio')     return { modo:'circulatorio', nivel:'basico' };
  if (seccionId === 'digestivo')        return { modo:'digestivo',    nivel:'basico' };
  if (seccionId === 'respiratorio')     return { modo:'respiratorio', nivel:'basico' };
  return { modo:'cuerpo', nivel:'basico' };
}

function generarPreguntasBio(config) {
  const preguntas = [];
  config.forEach(({ seccionId, cantidad, tipo }) => {
    const pool = getPoolBio(seccionId);
    const { modo, nivel } = getModoNivelBio(seccionId);
    const shuffled = shuffle([...pool]).slice(0, cantidad);
    shuffled.forEach(elem => {
      const opciones = tipo === 'seleccionar'
        ? shuffle([elem, ...shuffle(pool.filter(p => p.id !== elem.id)).slice(0, 3)]).map(o => o.nombre)
        : null;
      preguntas.push({ seccionId, modo, nivel, elementoId: elem.id, elementoNombre: elem.nombre, shape: elem.shape, tipo, opciones });
    });
  });
  return shuffle(preguntas);
}

// ── Live SVG body (standalone) ────────────────────────────────────────────────
function BodySVGLive({ modo, nivel, highlightId, feedbackOk, ocultarNombre }) {
  const pool = getPool(modo, nivel);
  const color = SYSTEM_COLOR[modo] || '#64748b';
  const highlightElem = pool.find(e => e.id === highlightId);
  return (
    <svg viewBox="0 0 280 500" style={{ width:'100%', maxWidth:220, display:'block', margin:'0 auto' }}>
      {BG_SHAPES.map((s, i) => <SvgShape key={i} s={s} fill="rgba(100,116,139,0.18)" stroke="#334155" />)}
      {pool.map(e => {
        const isHL = e.id === highlightId;
        return (e.shapes || [e.shape]).map((sh, k) => (
          <SvgShape key={e.id + '_' + k} s={sh}
            fill={isHL ? (feedbackOk === true ? '#22c55e' : feedbackOk === false ? '#ef4444' : color) : 'rgba(100,116,139,0.22)'}
            stroke={isHL ? '#fff' : '#475569'}
            strokeWidth={isHL ? 2.5 : 1}
            opacity={isHL ? 1 : 0.5}
          />
        ));
      })}
      {highlightElem && !ocultarNombre && (
        <text x="140" y="498" textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="600">{highlightElem.nombre}</text>
      )}
    </svg>
  );
}

// ── Config Modal ──────────────────────────────────────────────────────────────
function ModalLiveBioConfig({ onClose, onCrear }) {
  const [config, setConfig] = useState(
    SECCIONES_BIO.map(s => ({ seccionId: s.id, cantidad: 0, tipo: 'seleccionar' }))
  );
  const [tiempo, setTiempo] = useState(20);
  const [creando, setCreando] = useState(false);

  const total = config.reduce((s, c) => s + c.cantidad, 0);

  const setCantidad = (idx, val) => {
    setConfig(prev => prev.map((c, i) => i === idx ? { ...c, cantidad: Math.max(0, val) } : c));
  };
  const setTipo = (idx, val) => {
    setConfig(prev => prev.map((c, i) => i === idx ? { ...c, tipo: val } : c));
  };

  const handleCrear = async () => {
    if (total === 0) return alert('Añade al menos una pregunta.');
    setCreando(true);
    try {
      const codigo = genCodeBio();
      const preguntas = generarPreguntasBio(config.filter(c => c.cantidad > 0));
      await setDoc(doc(db, 'live_games', codigo), {
        tipoJuego: 'biologia',
        estado: 'LOBBY',
        fasePregunta: null,
        jugadores: {},
        preguntas,
        respuestasRonda: {},
        indicePregunta: 0,
        questionStartTime: null,
        tiempo,
        creadoEn: Date.now(),
      });
      onCrear(codigo);
    } catch (e) {
      alert('Error creando partida: ' + e.message);
    }
    setCreando(false);
  };

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 };
  const modal   = { background:'#1e293b', borderRadius:16, padding:24, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.1)' };
  const row     = { display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' };
  const numBtn  = { width:28, height:28, borderRadius:6, border:'none', background:'rgba(255,255,255,0.1)', color:'#f1f5f9', cursor:'pointer', fontSize:'1rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' };
  const selBtn  = (active) => ({ padding:'3px 8px', borderRadius:6, border:'none', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', background: active ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.08)', color: active ? '#fff' : '#94a3b8' });

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, color:'#f1f5f9', fontSize:'1.05rem' }}>🔴 Configurar Partida en Vivo</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#94a3b8', fontSize:'1.4rem', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ marginBottom:16 }}>
          {SECCIONES_BIO.map((sec, idx) => (
            <div key={sec.id} style={row}>
              <span style={{ flex:1, fontSize:'0.82rem', color:'#e2e8f0' }}>{sec.emoji} {sec.label}</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <button style={numBtn} onClick={() => setCantidad(idx, config[idx].cantidad - 1)}>−</button>
                <span style={{ width:20, textAlign:'center', color:'#f1f5f9', fontWeight:700, fontSize:'0.9rem' }}>{config[idx].cantidad}</span>
                <button style={numBtn} onClick={() => setCantidad(idx, config[idx].cantidad + 1)}>+</button>
              </div>
              {config[idx].cantidad > 0 && (
                <div style={{ display:'flex', gap:3 }}>
                  <button style={selBtn(config[idx].tipo === 'seleccionar')} onClick={() => setTipo(idx, 'seleccionar')}>SEL</button>
                  <button style={selBtn(config[idx].tipo === 'escribir')} onClick={() => setTipo(idx, 'escribir')}>ESC</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <span style={{ color:'#94a3b8', fontSize:'0.82rem' }}>⏱ Tiempo por pregunta:</span>
          {[10,15,20,30,45].map(t => (
            <button key={t} onClick={() => setTiempo(t)} style={{ padding:'4px 10px', borderRadius:7, border:'none', background: tiempo===t ? '#6366f1' : 'rgba(255,255,255,0.1)', color:'#f1f5f9', cursor:'pointer', fontWeight: tiempo===t?700:400, fontSize:'0.82rem' }}>{t}s</button>
          ))}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleCrear} disabled={creando || total === 0} style={{ flex:1, padding:'12px', background: total===0?'rgba(220,38,38,0.3)':'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff', border:'none', borderRadius:10, cursor: total===0?'not-allowed':'pointer', fontWeight:700, fontSize:'0.9rem' }}>
            {creando ? 'Creando...' : `Crear Partida (${total} preg.)`}
          </button>
          <button onClick={onClose} style={{ padding:'12px 18px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'#94a3b8', borderRadius:10, cursor:'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Host component ────────────────────────────────────────────────────────────
function BiologiaLiveHost({ codigo, onSalir }) {
  const [gameState, setGameState] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'live_games', codigo), snap => {
      if (snap.exists()) setGameState(snap.data());
    });
    return () => { unsub(); clearInterval(timerRef.current); };
  }, [codigo]);

  const gameRef = doc(db, 'live_games', codigo);

  const empezar = async () => {
    await updateDoc(gameRef, { estado: 'COUNTDOWN' });
    let c = 3;
    const iv = setInterval(async () => {
      c--;
      if (c <= 0) {
        clearInterval(iv);
        await updateDoc(gameRef, { estado: 'JUEGO', fasePregunta: 'RESPONDING', indicePregunta: 0, questionStartTime: Date.now(), respuestasRonda: {} });
      }
    }, 1000);
  };

  const revelar = async () => {
    if (!gameState) return;
    clearInterval(timerRef.current);
    const { preguntas, indicePregunta, respuestasRonda, jugadores, tiempo } = gameState;
    const pregunta = preguntas[indicePregunta];
    const updates = {};
    const totalTiempo = (tiempo || 20) * 1000;
    const now = Date.now();
    Object.entries(respuestasRonda || {}).forEach(([uid, resp]) => {
      if (resp.processed) return;
      const elapsed = Math.min(now - (gameState.questionStartTime || now), totalTiempo);
      const ratio = Math.max(0, 1 - elapsed / totalTiempo);
      const correct = norm(resp.respuesta) === norm(pregunta.elementoNombre);
      const puntosGanados = correct ? Math.round(500 + 500 * ratio) : 0;
      updates[`respuestasRonda.${uid}.correct`] = correct;
      updates[`respuestasRonda.${uid}.ratio`] = ratio;
      updates[`respuestasRonda.${uid}.puntosGanados`] = puntosGanados;
      updates[`respuestasRonda.${uid}.processed`] = true;
      if (puntosGanados > 0) updates[`jugadores.${uid}.puntos`] = increment(puntosGanados);
    });
    updates.fasePregunta = 'REVEAL';
    await updateDoc(gameRef, updates);
  };

  const siguiente = async () => {
    if (!gameState) return;
    const { preguntas, indicePregunta } = gameState;
    const next = indicePregunta + 1;
    if (next >= preguntas.length) {
      await updateDoc(gameRef, { estado: 'FIN', fasePregunta: null });
    } else {
      await updateDoc(gameRef, { fasePregunta: 'RESPONDING', indicePregunta: next, questionStartTime: Date.now(), respuestasRonda: {} });
    }
  };

  useEffect(() => {
    if (!gameState || gameState.fasePregunta !== 'RESPONDING') { clearInterval(timerRef.current); return; }
    const tiempo = (gameState.tiempo || 20) * 1000;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - (gameState.questionStartTime || Date.now());
      if (elapsed >= tiempo) revelar();
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [gameState?.fasePregunta, gameState?.indicePregunta]);

  if (!gameState) return <div style={{ color:'#94a3b8', textAlign:'center', padding:40 }}>Cargando...</div>;

  const { estado, fasePregunta, jugadores = {}, preguntas = [], indicePregunta = 0, respuestasRonda = {}, tiempo: tSeg = 20 } = gameState;
  const jugadoresArr = Object.entries(jugadores).sort((a, b) => b[1].puntos - a[1].puntos);
  const preguntaActual = preguntas[indicePregunta];
  const respondidos = Object.values(respuestasRonda).filter(r => r.processed !== undefined || r.respuesta).length;
  const totalJugadores = Object.keys(jugadores).length;

  const sH = {
    wrap: { minHeight:'100vh', background:'linear-gradient(135deg,#0f172a,#1e1b4b)', padding:16, color:'#f1f5f9', fontFamily:'system-ui,sans-serif' },
    card: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:16, marginBottom:12 },
    btn:  { padding:'12px 20px', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:'0.9rem' },
    h2:   { margin:'0 0 12px', fontSize:'1.1rem', color:'#e2e8f0' },
  };

  return (
    <div style={sH.wrap}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.2rem' }}>🔴 Biología en Vivo</h2>
          <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>Código: <span style={{ fontWeight:700, letterSpacing:3, color:'#f1f5f9' }}>{codigo}</span></div>
        </div>
        <button onClick={onSalir} style={{ ...sH.btn, background:'rgba(255,255,255,0.08)', color:'#94a3b8', padding:'8px 14px' }}>Salir</button>
      </div>

      {estado === 'LOBBY' && (
        <div style={sH.card}>
          <h3 style={sH.h2}>Sala de espera</h3>
          <p style={{ color:'#94a3b8', fontSize:'0.85rem' }}>Jugadores conectados: {totalJugadores}</p>
          {jugadoresArr.map(([uid, j]) => (
            <div key={uid} style={{ padding:'6px 10px', background:'rgba(255,255,255,0.06)', borderRadius:8, marginBottom:4, fontSize:'0.85rem' }}>{j.nombre}</div>
          ))}
          <button onClick={empezar} disabled={totalJugadores === 0} style={{ ...sH.btn, marginTop:12, background: totalJugadores===0?'rgba(220,38,38,0.3)':'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff', width:'100%' }}>
            {totalJugadores === 0 ? 'Esperando jugadores...' : `Empezar (${totalJugadores} jugadores)`}
          </button>
        </div>
      )}

      {estado === 'COUNTDOWN' && (
        <div style={{ ...sH.card, textAlign:'center', padding:40 }}>
          <div style={{ fontSize:'3rem', fontWeight:900, color:'#dc2626' }}>3...</div>
          <div style={{ color:'#94a3b8' }}>Preparaos</div>
        </div>
      )}

      {estado === 'JUEGO' && preguntaActual && (
        <div style={sH.card}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:'0.8rem', color:'#94a3b8' }}>Pregunta {indicePregunta + 1} / {preguntas.length}</span>
            <span style={{ fontSize:'0.8rem', color:'#94a3b8' }}>Respondidos: {respondidos}/{totalJugadores}</span>
          </div>
          <BodySVGLive modo={preguntaActual.modo} nivel={preguntaActual.nivel} highlightId={preguntaActual.elementoId} feedbackOk={fasePregunta === 'REVEAL' ? true : null} />
          <p style={{ textAlign:'center', fontWeight:700, marginTop:8, color:'#e2e8f0' }}>¿Qué parte es esta?</p>
          {fasePregunta === 'RESPONDING' && (
            <button onClick={revelar} style={{ ...sH.btn, width:'100%', marginTop:8, background:'rgba(220,38,38,0.7)', color:'#fff' }}>
              Revelar respuesta
            </button>
          )}
          {fasePregunta === 'REVEAL' && (
            <>
              <div style={{ textAlign:'center', background:'rgba(34,197,94,0.15)', borderRadius:10, padding:10, marginTop:8, fontWeight:700, color:'#4ade80' }}>
                ✓ {preguntaActual.elementoNombre}
              </div>
              <div style={{ marginTop:10 }}>
                {jugadoresArr.map(([uid, j]) => {
                  const r = respuestasRonda[uid];
                  return (
                    <div key={uid} style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'rgba(255,255,255,0.04)', borderRadius:7, marginBottom:3, fontSize:'0.82rem' }}>
                      <span>{j.nombre}</span>
                      <span style={{ color: r?.correct ? '#4ade80' : '#f87171', fontWeight:600 }}>
                        {r ? (r.correct ? `+${r.puntosGanados}` : 'Incorrecto') : 'Sin resp.'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button onClick={siguiente} style={{ ...sH.btn, width:'100%', marginTop:12, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff' }}>
                {indicePregunta + 1 < preguntas.length ? 'Siguiente pregunta →' : 'Ver resultados finales'}
              </button>
            </>
          )}
        </div>
      )}

      {estado === 'FIN' && (
        <div style={sH.card}>
          <h3 style={{ ...sH.h2, textAlign:'center' }}>🏆 Resultados finales</h3>
          {jugadoresArr.map(([uid, j], i) => (
            <div key={uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(255,255,255,0.05)', borderRadius:10, marginBottom:6 }}>
              <span style={{ fontSize:'1.2rem' }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
              <span style={{ flex:1 }}>{j.nombre}</span>
              <span style={{ fontWeight:700, color:'#fbbf24' }}>{j.puntos} pts</span>
            </div>
          ))}
          <button onClick={onSalir} style={{ ...sH.btn, width:'100%', marginTop:14, background:'rgba(255,255,255,0.1)', color:'#f1f5f9' }}>Volver</button>
        </div>
      )}

      {(estado === 'JUEGO' || estado === 'FIN') && (
        <div style={sH.card}>
          <h4 style={{ margin:'0 0 8px', fontSize:'0.85rem', color:'#94a3b8' }}>Clasificación</h4>
          {jugadoresArr.map(([uid, j], i) => (
            <div key={uid} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', fontSize:'0.82rem' }}>
              <span>{i+1}. {j.nombre}</span>
              <span style={{ fontWeight:700, color:'#fbbf24' }}>{j.puntos} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Client question ───────────────────────────────────────────────────────────
function BioClientPregunta({ pregunta, tiempo, questionStartTime, uid, gameRef, respuestasRonda }) {
  const [respuesta, setRespuesta] = useState('');
  const [enviada, setEnviada] = useState(false);
  const [tiempoLeft, setTiempoLeft] = useState(tiempo);

  useEffect(() => {
    setRespuesta(''); setEnviada(false); setTiempoLeft(tiempo);
  }, [pregunta?.elementoId]);

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = (Date.now() - (questionStartTime || Date.now())) / 1000;
      setTiempoLeft(Math.max(0, tiempo - elapsed));
    }, 200);
    return () => clearInterval(iv);
  }, [questionStartTime, tiempo]);

  const yaRespondio = enviada || !!respuestasRonda?.[uid]?.respuesta;

  const enviar = async (resp) => {
    if (yaRespondio) return;
    setEnviada(true);
    await updateDoc(gameRef, { [`respuestasRonda.${uid}.respuesta`]: resp, [`respuestasRonda.${uid}.timestamp`]: Date.now() });
  };

  const ratio = tiempoLeft / tiempo;
  const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';

  const sec = SECCIONES_BIO.find(s => s.id === pregunta.seccionId);
  const color = sec?.color || '#dc2626';

  return (
    <div style={{ padding:16 }}>
      <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.1)', marginBottom:12, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${ratio*100}%`, background:barColor, borderRadius:3, transition:'width 0.2s' }} />
      </div>
      <div style={{ textAlign:'center', color:'#94a3b8', fontSize:'0.78rem', marginBottom:8 }}>{sec?.emoji} {sec?.label}</div>
      <BodySVGLive modo={pregunta.modo} nivel={pregunta.nivel} highlightId={pregunta.elementoId} feedbackOk={null} />
      <p style={{ textAlign:'center', fontWeight:700, color:'#e2e8f0', margin:'12px 0' }}>¿Qué parte del cuerpo es esta?</p>

      {yaRespondio ? (
        <div style={{ textAlign:'center', padding:16, color:'#4ade80', fontWeight:700 }}>✓ Respuesta enviada</div>
      ) : pregunta.tipo === 'seleccionar' ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {(pregunta.opciones || []).map(op => (
            <button key={op} onClick={() => enviar(op)} style={{ padding:'12px 8px', background:' rgba(255,255,255,0.08)', border:`2px solid ${color}40`, borderRadius:10, color:'#f1f5f9', cursor:'pointer', fontWeight:600, fontSize:'0.82rem' }}>
              {op}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', gap:8 }}>
          <input
            value={respuesta}
            onChange={e => setRespuesta(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && respuesta.trim() && enviar(respuesta.trim())}
            placeholder="Escribe el nombre..."
            style={{ ...inp, flex:1 }}
            autoFocus
          />
          <button onClick={() => enviar(respuesta.trim())} disabled={!respuesta.trim()} style={{ padding:'10px 16px', background: respuesta.trim()?color:'rgba(255,255,255,0.1)', border:'none', borderRadius:9, color:'#fff', cursor: respuesta.trim()?'pointer':'not-allowed', fontWeight:700 }}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}

// ── Client component ──────────────────────────────────────────────────────────
function BiologiaLiveClient({ codigo, player, onSalir }) {
  const [gameState, setGameState] = useState(null);
  const joinedRef = useRef(false);
  const uid = player.uid;
  const gameRef = doc(db, 'live_games', codigo);

  useEffect(() => {
    const unsub = onSnapshot(gameRef, async snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!joinedRef.current) {
        joinedRef.current = true;
        await updateDoc(gameRef, { [`jugadores.${uid}`]: { nombre: player.displayName, puntos: 0 } });
      }
      setGameState(data);
    });
    return unsub;
  }, [codigo]);

  if (!gameState) return <div style={{ color:'#94a3b8', textAlign:'center', padding:60, fontFamily:'system-ui,sans-serif' }}>Conectando...</div>;

  const { estado, fasePregunta, jugadores = {}, preguntas = [], indicePregunta = 0, respuestasRonda = {}, questionStartTime, tiempo = 20 } = gameState;
  const jugadoresArr = Object.entries(jugadores).sort((a, b) => b[1].puntos - a[1].puntos);
  const preguntaActual = preguntas[indicePregunta];

  const sH = {
    wrap: { minHeight:'100vh', background:'linear-gradient(135deg,#0f172a,#1e1b4b)', color:'#f1f5f9', fontFamily:'system-ui,sans-serif' },
    card: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:16, margin:16 },
  };

  return (
    <div style={sH.wrap}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize:'0.85rem' }}>🔴 Biología en Vivo · <span style={{ color:'#94a3b8' }}>{player.displayName}</span></div>
        <button onClick={onSalir} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'0.8rem' }}>Salir</button>
      </div>

      {estado === 'LOBBY' && (
        <div style={{ ...sH.card, textAlign:'center', padding:40 }}>
          <div style={{ fontSize:'2rem', marginBottom:8 }}>⏳</div>
          <p style={{ color:'#94a3b8' }}>Esperando a que el profesor inicie la partida...</p>
          <p style={{ fontSize:'0.8rem', color:'#64748b' }}>Sala: <strong style={{ color:'#f1f5f9', letterSpacing:3 }}>{codigo}</strong></p>
        </div>
      )}

      {estado === 'COUNTDOWN' && (
        <div style={{ ...sH.card, textAlign:'center', padding:40 }}>
          <div style={{ fontSize:'3rem', fontWeight:900, color:'#dc2626' }}>¡Preparados!</div>
        </div>
      )}

      {estado === 'JUEGO' && preguntaActual && fasePregunta === 'RESPONDING' && (
        <BioClientPregunta
          pregunta={preguntaActual}
          tiempo={tiempo}
          questionStartTime={questionStartTime}
          uid={uid}
          gameRef={gameRef}
          respuestasRonda={respuestasRonda}
        />
      )}

      {estado === 'JUEGO' && fasePregunta === 'REVEAL' && preguntaActual && (
        <div style={{ ...sH.card, textAlign:'center' }}>
          <div style={{ fontSize:'0.8rem', color:'#94a3b8', marginBottom:8 }}>Respuesta correcta:</div>
          <div style={{ fontSize:'1.3rem', fontWeight:700, color:'#4ade80', marginBottom:12 }}>✓ {preguntaActual.elementoNombre}</div>
          {respuestasRonda[uid] && (
            <div style={{ fontSize:'0.85rem', color: respuestasRonda[uid].correct ? '#4ade80' : '#f87171', fontWeight:600 }}>
              {respuestasRonda[uid].correct ? `+${respuestasRonda[uid].puntosGanados} puntos` : 'Incorrecto'}
            </div>
          )}
          <div style={{ marginTop:16, fontSize:'0.78rem', color:'#64748b' }}>Esperando siguiente pregunta...</div>
        </div>
      )}

      {estado === 'FIN' && (
        <div style={sH.card}>
          <h3 style={{ textAlign:'center', margin:'0 0 14px', color:'#fbbf24' }}>🏆 ¡Partida terminada!</h3>
          {jugadoresArr.map(([id, j], i) => (
            <div key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: id===uid?'rgba(99,102,241,0.2)':'rgba(255,255,255,0.04)', borderRadius:10, marginBottom:6, border: id===uid?'1px solid rgba(99,102,241,0.4)':'1px solid transparent' }}>
              <span>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
              <span style={{ flex:1 }}>{j.nombre} {id===uid?'(tú)':''}</span>
              <span style={{ fontWeight:700, color:'#fbbf24' }}>{j.puntos} pts</span>
            </div>
          ))}
          <button onClick={onSalir} style={{ width:'100%', marginTop:14, padding:'12px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, color:'#f1f5f9', cursor:'pointer', fontWeight:700 }}>Volver al inicio</button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ANATOMÍA CON IMÁGENES — quiz tipo test sobre el dataset (imágenes / GIF)
// ════════════════════════════════════════════════════════════════════════════════
const TIPOS_PREGUNTA = [
  { id:'nombre',      label:'Nombre',            desc:'¿Cómo se llama?' },
  { id:'categoria',   label:'Órgano/Hueso/Músculo', desc:'¿Qué tipo es?' },
  { id:'sistema',     label:'Sistema',           desc:'¿A qué sistema pertenece?' },
  { id:'descripcion', label:'Descripción',       desc:'Adivina por la descripción' },
];

const distractoresNombre = (item, pool) => {
  const mismaCat = pool.filter(p => p.id !== item.id && p.categoria === item.categoria);
  let pick = shuffle(mismaCat).slice(0, 3);
  if (pick.length < 3) pick = [...pick, ...shuffle(pool.filter(p => p.id !== item.id && !pick.includes(p))).slice(0, 3 - pick.length)];
  return pick.map(p => p.nombre);
};

const crearPregunta = (item, tipo, pool) => {
  if (tipo === 'categoria') {
    return { item, tipo, enunciado:'¿Qué tipo de estructura es?', correcta:item.categoria,
      opciones: shuffle([...CATEGORIAS]) };
  }
  if (tipo === 'sistema') {
    const otros = shuffle(SISTEMAS.filter(s => s !== item.sistema)).slice(0, 3);
    return { item, tipo, enunciado:'¿A qué sistema pertenece?', correcta:item.sistema,
      opciones: shuffle([item.sistema, ...otros]) };
  }
  // nombre / descripcion → responder el nombre
  const enunciado = tipo === 'descripcion'
    ? `«${item.descripcion}»  ¿De qué se trata?`
    : '¿Cómo se llama?';
  return { item, tipo, enunciado, correcta:item.nombre,
    opciones: shuffle([item.nombre, ...distractoresNombre(item, pool)]) };
};

function AnatomiaQuiz({ onBack }) {
  const [pantalla, setPantalla] = useState('config');
  const [filtroCat, setFiltroCat] = useState('todos');
  const [tipos, setTipos] = useState({ nombre:true, categoria:true, sistema:true, descripcion:true });
  const [nQ, setNQ] = useState(10);

  const [preguntas, setPreguntas] = useState([]);
  const [idx, setIdx] = useState(0);
  const [fase, setFase] = useState('jugando');   // jugando | feedback
  const [elegida, setElegida] = useState(null);
  const [respuestas, setRespuestas] = useState([]);

  const [modalEnviar, setModalEnviar] = useState(false);
  const [mNombre, setMNombre] = useState('');
  const [mCurso, setMCurso] = useState('');
  const [mCodigo, setMCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const bg = 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #1e1b4b 100%)';
  const card = { background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'16px 18px', border:'1px solid rgba(255,255,255,0.1)' };
  const ACCENT = '#7c3aed';

  const poolFiltrado = filtroCat === 'todos' ? ANATOMIA : ANATOMIA.filter(a => a.categoria === filtroCat);
  const tiposActivos = TIPOS_PREGUNTA.filter(t => tipos[t.id]).map(t => t.id);

  const iniciar = () => {
    if (poolFiltrado.length < 4 || tiposActivos.length === 0) return;
    const items = shuffle(poolFiltrado).slice(0, Math.min(nQ, poolFiltrado.length));
    const pregs = items.map(item => {
      const tipo = tiposActivos[Math.floor(Math.random() * tiposActivos.length)];
      return crearPregunta(item, tipo, ANATOMIA);
    });
    setPreguntas(pregs);
    setIdx(0); setRespuestas([]); setFase('jugando'); setElegida(null);
    setPantalla('quiz');
  };

  const responder = (opcion) => {
    if (fase !== 'jugando') return;
    const preg = preguntas[idx];
    const ok = norm(opcion) === norm(preg.correcta);
    playSound(ok ? 'CORRECT' : 'WRONG');
    setElegida(opcion);
    setFase('feedback');
    setRespuestas(prev => [...prev, { correcto: ok, nombre: preg.item.nombre, tipo: preg.tipo }]);
  };

  const siguiente = () => {
    const next = idx + 1;
    if (next >= preguntas.length) { setPantalla('resultado'); return; }
    setIdx(next); setFase('jugando'); setElegida(null);
  };

  const enviarAlProfesor = async (aciertos, total) => {
    if (!mNombre.trim()) { alert('Introduce tu nombre'); return; }
    const cod = mCodigo.trim().toUpperCase();
    if (cod.length < 3) { alert('Introduce el código de tu profesor'); return; }
    setEnviando(true);
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', cod));
      if (!snap.exists()) { alert('Código de profesor no encontrado.'); setEnviando(false); return; }
      const pct = Math.round((aciertos / total) * 100);
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'BIOLOGIA', modalidad: 'Individual', fecha: new Date(),
        codigoProfesor: cod,
        config: { modoJuego: 'anatomia_imagenes', filtroCategoria: filtroCat, tipos: tiposActivos },
        jugadores: [{ nombre: mNombre.trim(), curso: mCurso.trim(), aciertos, intentos: total, fallos: total - aciertos, porcentaje: pct }],
      });
      alert('✅ Resultado enviado al profesor.');
      setModalEnviar(false); setMNombre(''); setMCurso(''); setMCodigo('');
    } catch (e) { alert('Error: ' + e.message); }
    setEnviando(false);
  };

  // ── CONFIG ────────────────────────────────────────────────────────────────
  if (pantalla === 'config') {
    const puede = poolFiltrado.length >= 4 && tiposActivos.length > 0;
    return (
      <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', padding:'20px 16px', fontFamily:'sans-serif' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#f1f5f9', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:'0.9rem' }}>← Volver</button>
          <h1 style={{ margin:0, fontSize:'1.4rem', fontWeight:700 }}>📸 Anatomía con imágenes</h1>
        </div>

        {/* Categoría */}
        <div style={{ ...card, marginBottom:14 }}>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>¿Sobre qué quieres practicar?</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[['todos','Todos','🧬'],['Órgano','Órganos','🫀'],['Hueso','Huesos','🦴'],['Músculo','Músculos','💪']].map(([v,l,e]) => {
              const count = v === 'todos' ? ANATOMIA.length : ANATOMIA.filter(a => a.categoria === v).length;
              return (
                <button key={v} onClick={() => setFiltroCat(v)} style={{
                  background: filtroCat === v ? ACCENT : 'rgba(255,255,255,0.06)',
                  border:`2px solid ${filtroCat === v ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                  color:'#f1f5f9', borderRadius:10, padding:'12px 8px', cursor:'pointer',
                  fontSize:'0.85rem', fontWeight: filtroCat === v ? 700 : 400, display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{ fontSize:'1.3rem' }}>{e}</span>
                  <span style={{ flex:1, textAlign:'left' }}>{l}</span>
                  <span style={{ fontSize:'0.72rem', color:'#cbd5e1' }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tipos de pregunta */}
        <div style={{ ...card, marginBottom:14 }}>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tipos de pregunta</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {TIPOS_PREGUNTA.map(t => (
              <button key={t.id} onClick={() => setTipos(p => ({ ...p, [t.id]: !p[t.id] }))} style={{
                background: tipos[t.id] ? `${ACCENT}33` : 'rgba(255,255,255,0.04)',
                border:`2px solid ${tipos[t.id] ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                color:'#f1f5f9', borderRadius:10, padding:'10px 12px', cursor:'pointer',
                display:'flex', alignItems:'center', gap:10, textAlign:'left',
              }}>
                <span style={{ fontSize:'1.1rem' }}>{tipos[t.id] ? '☑️' : '⬜'}</span>
                <span style={{ flex:1 }}><strong style={{ fontSize:'0.88rem' }}>{t.label}</strong> <span style={{ fontSize:'0.76rem', color:'#94a3b8' }}>· {t.desc}</span></span>
              </button>
            ))}
          </div>
        </div>

        {/* Nº preguntas */}
        <div style={{ ...card, marginBottom:20 }}>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Nº de preguntas</div>
          <div style={{ display:'flex', gap:8 }}>
            {[5,10,15,20].map(n => (
              <button key={n} onClick={() => setNQ(n)} disabled={n > poolFiltrado.length} style={{
                flex:1, background: nQ === n ? ACCENT : 'rgba(255,255,255,0.06)',
                border:`2px solid ${nQ === n ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                color:'#f1f5f9', borderRadius:10, padding:'10px', cursor: n > poolFiltrado.length ? 'not-allowed' : 'pointer',
                opacity: n > poolFiltrado.length ? 0.4 : 1, fontWeight: nQ === n ? 700 : 400,
              }}>{n}</button>
            ))}
          </div>
        </div>

        <button onClick={iniciar} disabled={!puede} style={{
          width:'100%', padding:'16px', background: puede ? ACCENT : '#334155', color:'#fff', border:'none',
          borderRadius:12, fontSize:'1.1rem', fontWeight:700, cursor: puede ? 'pointer' : 'not-allowed', opacity: puede ? 1 : 0.5,
        }}>
          ▶ Empezar test
        </button>
        {!puede && <div style={{ textAlign:'center', color:'#f87171', fontSize:'0.78rem', marginTop:8 }}>Elige al menos un tipo de pregunta y una categoría con 4+ elementos.</div>}
      </div>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (pantalla === 'quiz') {
    const preg = preguntas[idx];
    if (!preg) return null;
    const mostrarImagen = true; // siempre mostramos la imagen del elemento
    const tInfo = TIPOS_PREGUNTA.find(t => t.id === preg.tipo);

    return (
      <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', fontFamily:'sans-serif', display:'flex', flexDirection:'column' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setPantalla('config')} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#f1f5f9', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.85rem' }}>✕</button>
          <span style={{ fontSize:'0.85rem', color:'#94a3b8' }}>{idx + 1}/{preguntas.length}</span>
          <div style={{ width:100, height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ width:`${((idx + 1) / preguntas.length) * 100}%`, height:'100%', background:ACCENT, borderRadius:3, transition:'width 0.3s' }} />
          </div>
        </div>

        <div style={{ flex:1, display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'center', gap:16, padding:'16px', overflowY:'auto', maxWidth:900, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
          {/* Imagen (derecha en escritorio, arriba en móvil) */}
          {mostrarImagen && (
            <div style={{ flex:'1 1 260px', maxWidth:360, order:2 }}>
              <div style={{ background:'#fff', borderRadius:14, padding:8, boxShadow:'0 6px 20px rgba(0,0,0,0.35)' }}>
                <img src={preg.item.imagenUrl} alt={fase === 'feedback' ? preg.item.nombre : 'elemento'} loading="eager"
                  style={{ width:'100%', maxHeight:340, objectFit:'contain', borderRadius:8, display:'block' }} />
              </div>
            </div>
          )}

          {/* Pregunta + opciones */}
          <div style={{ flex:'1 1 280px', maxWidth:420, order:1 }}>
            <div style={{ fontSize:'0.72rem', color:ACCENT, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{tInfo?.label}</div>
            <div style={{ fontSize:'1.05rem', color:'#e2e8f0', fontWeight:700, marginBottom:14, lineHeight:1.35 }}>{preg.enunciado}</div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {preg.opciones.map((op, i) => {
                let bgc = 'rgba(255,255,255,0.07)', bd = 'rgba(255,255,255,0.12)', cl = '#f1f5f9';
                if (fase === 'feedback') {
                  const esCorrecta = norm(op) === norm(preg.correcta);
                  const esElegida = op === elegida;
                  if (esCorrecta) { bgc = 'rgba(34,197,94,0.18)'; bd = '#22c55e'; cl = '#86efac'; }
                  else if (esElegida) { bgc = 'rgba(239,68,68,0.15)'; bd = '#ef4444'; cl = '#fca5a5'; }
                  else { cl = '#64748b'; }
                }
                return (
                  <button key={i} onClick={() => responder(op)} disabled={fase === 'feedback'} style={{
                    background:bgc, border:`2px solid ${bd}`, color:cl, borderRadius:10, padding:'13px 14px',
                    cursor: fase === 'feedback' ? 'default' : 'pointer', fontSize:'0.92rem', fontWeight:500, textAlign:'left',
                  }}>
                    {fase === 'feedback' && norm(op) === norm(preg.correcta) && '✓ '}
                    {op}
                  </button>
                );
              })}
            </div>

            {fase === 'feedback' && (
              <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(255,255,255,0.05)', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:4 }}>{preg.item.nombre}</div>
                <div style={{ fontSize:'0.78rem', color:'#a5b4fc', marginBottom:6 }}>{preg.item.categoria} · {preg.item.sistema}</div>
                <div style={{ fontSize:'0.82rem', color:'#94a3b8', lineHeight:1.4 }}>{preg.item.descripcion}</div>
                <button onClick={siguiente} style={{ width:'100%', marginTop:12, padding:'12px', background:ACCENT, color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:'0.95rem' }}>
                  {idx + 1 < preguntas.length ? 'Siguiente →' : 'Ver resultado'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTADO ───────────────────────────────────────────────────────────────
  if (pantalla === 'resultado') {
    const aciertos = respuestas.filter(r => r.correcto).length;
    const total = respuestas.length || 1;
    const pct = Math.round((aciertos / total) * 100);
    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : pct >= 50 ? '💪' : '📚';

    return (
      <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', padding:'20px 16px', fontFamily:'sans-serif' }}>
        <div style={{ maxWidth:420, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:22 }}>
            <div style={{ fontSize:'3rem', marginBottom:8 }}>{emoji}</div>
            <h2 style={{ margin:'0 0 4px', fontSize:'1.5rem' }}>{aciertos}/{total} correctas</h2>
            <div style={{ fontSize:'2rem', fontWeight:800, color: pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</div>
          </div>

          <div style={{ ...card, marginBottom:14 }}>
            {respuestas.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom: i < respuestas.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span>{r.correcto ? '✅' : '❌'}</span>
                <span style={{ flex:1, fontSize:'0.86rem', color: r.correcto ? '#86efac' : '#fca5a5' }}>{r.nombre}</span>
                <span style={{ fontSize:'0.72rem', color:'#64748b' }}>{TIPOS_PREGUNTA.find(t => t.id === r.tipo)?.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={() => setModalEnviar(true)} style={{ background:ACCENT, border:'none', color:'#fff', borderRadius:12, padding:'14px', cursor:'pointer', fontWeight:700, fontSize:'1rem' }}>📤 Enviar al Profesor</button>
            <button onClick={iniciar} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#f1f5f9', borderRadius:12, padding:'14px', cursor:'pointer', fontWeight:600 }}>🔄 Repetir</button>
            <button onClick={() => setPantalla('config')} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', borderRadius:12, padding:'12px', cursor:'pointer' }}>← Cambiar opciones</button>
          </div>
        </div>

        {modalEnviar && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
            <div style={{ background:'#1e293b', borderRadius:16, padding:24, width:'100%', maxWidth:380, border:'1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:'1.1rem' }}>📤 Enviar resultado al profesor</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                <input value={mNombre} onChange={e => setMNombre(e.target.value)} placeholder="Tu nombre" style={inp} />
                <input value={mCurso} onChange={e => setMCurso(e.target.value)} placeholder="Curso (ej: 3ºA)" style={inp} />
                <input value={mCodigo} onChange={e => setMCodigo(e.target.value)} placeholder="Código del profesor" style={{ ...inp, textTransform:'uppercase' }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => enviarAlProfesor(aciertos, total)} disabled={enviando} style={{ flex:1, background:ACCENT, border:'none', color:'#fff', borderRadius:10, padding:'12px', cursor:'pointer', fontWeight:700 }}>
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
                <button onClick={() => setModalEnviar(false)} style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'#f1f5f9', borderRadius:10, padding:'12px', cursor:'pointer' }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════════════
// MODO ESTUDIO — ficha de cada elemento (imagen, características, esquema). Sin puntos.
// ════════════════════════════════════════════════════════════════════════════════
function AnatomiaEstudio({ onBack }) {
  const [cat, setCat] = useState('Órgano');
  const [sel, setSel] = useState(null);

  const ACCENT = '#0ea5e9';
  const bg = 'linear-gradient(135deg, #0c4a6e 0%, #0f172a 60%, #0c4a6e 100%)';
  const lista = ANATOMIA.filter(a => a.categoria === cat);
  const puntos = sel ? LOCALIZACION[sel.id] : null;

  const CATS = [['Órgano','Órganos','🫀'],['Músculo','Músculos','💪'],['Hueso','Huesos','🦴']];

  return (
    <div style={{ minHeight:'100vh', background:bg, color:'#f1f5f9', padding:'20px 16px', fontFamily:'sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <button onClick={onBack} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#f1f5f9', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:'0.9rem' }}>← Volver</button>
        <h1 style={{ margin:0, fontSize:'1.4rem', fontWeight:700 }}>📚 Estudiar anatomía</h1>
      </div>

      {/* Tabs categoría */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {CATS.map(([v,l,e]) => (
          <button key={v} onClick={() => setCat(v)} style={{
            flex:1, background: cat === v ? ACCENT : 'rgba(255,255,255,0.06)',
            border:`2px solid ${cat === v ? ACCENT : 'rgba(255,255,255,0.1)'}`,
            color:'#f1f5f9', borderRadius:10, padding:'10px 6px', cursor:'pointer',
            fontWeight: cat === v ? 700 : 400, fontSize:'0.85rem',
          }}>
            <span style={{ fontSize:'1.2rem', marginRight:6 }}>{e}</span>{l}
            <span style={{ fontSize:'0.72rem', color:'#cbd5e1', marginLeft:6 }}>{ANATOMIA.filter(a => a.categoria === v).length}</span>
          </button>
        ))}
      </div>

      {/* Rejilla de tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:12 }}>
        {lista.map(item => (
          <button key={item.id} onClick={() => setSel(item)} style={{
            background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12,
            padding:8, cursor:'pointer', textAlign:'left', color:'#f1f5f9', display:'flex', flexDirection:'column', gap:6,
          }}>
            <div style={{ background:'#fff', borderRadius:8, overflow:'hidden', aspectRatio:'4/3', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={item.imagenUrl} alt={item.nombre} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            </div>
            <div style={{ fontWeight:700, fontSize:'0.85rem', lineHeight:1.2 }}>{item.nombre}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
              <span style={{ fontSize:'0.68rem', color:'#94a3b8', flex:1, lineHeight:1.2 }}>{item.sistema}</span>
              <span style={{ fontSize:'0.6rem', fontWeight:700, color:'#0f172a', background:DIF_COLOR[item.dificultad]||'#94a3b8', borderRadius:5, padding:'1px 5px' }}>{item.dificultad}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal de ficha */}
      {sel && (
        <div onClick={e => e.target === e.currentTarget && setSel(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
          <div style={{ background:'#0f172a', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:20, width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:12 }}>
              <div>
                <h2 style={{ margin:'0 0 4px', fontSize:'1.4rem' }}>{sel.nombre}</h2>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, background:'rgba(14,165,233,0.2)', color:'#7dd3fc', borderRadius:6, padding:'2px 8px' }}>{sel.categoria}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, background:'rgba(255,255,255,0.08)', color:'#cbd5e1', borderRadius:6, padding:'2px 8px' }}>{sel.sistema}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, background:DIF_COLOR[sel.dificultad]||'#94a3b8', color:'#0f172a', borderRadius:6, padding:'2px 8px' }}>{sel.dificultad}</span>
                </div>
              </div>
              <button onClick={() => setSel(null)} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#f1f5f9', borderRadius:8, width:34, height:34, cursor:'pointer', fontSize:'1.1rem', flexShrink:0 }}>×</button>
            </div>

            <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'flex-start' }}>
              {/* Imagen */}
              <div style={{ flex:'1 1 240px', background:'#fff', borderRadius:12, padding:8 }}>
                <img src={sel.imagenUrl} alt={sel.nombre} style={{ width:'100%', maxHeight:300, objectFit:'contain', display:'block' }} />
              </div>
              {/* Esquema de localización (aprox.) — disponible para todos */}
              <div style={{ flex:'1 1 200px', background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 8px' }}>
                <div style={{ fontSize:'0.72rem', color:'#94a3b8', textAlign:'center', marginBottom:4, fontWeight:600 }}>📍 Dónde se encuentra (aprox.)</div>
                <EsquemaLocalizacion puntos={puntos} />
              </div>
            </div>

            <div style={{ marginTop:14, fontSize:'0.92rem', color:'#e2e8f0', lineHeight:1.5 }}>{sel.descripcion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export wrapper ────────────────────────────────────────────────────────────
export default function BiologiaApp({ onBack }) {
  const [liveConfig, setLiveConfig] = useState(false);
  const [liveHost, setLiveHost]   = useState(null);
  const [liveClient, setLiveClient] = useState(null);

  if (liveHost)   return <BiologiaLiveHost   codigo={liveHost}          onSalir={() => setLiveHost(null)}   />;
  if (liveClient) return <BiologiaLiveClient codigo={liveClient.codigo} player={liveClient.player} onSalir={() => setLiveClient(null)} />;

  return (
    <>
      {liveConfig && (
        <ModalLiveBioConfig
          onClose={() => setLiveConfig(false)}
          onCrear={codigo => { setLiveConfig(false); setLiveHost(codigo); }}
        />
      )}
      <BiologiaAppInner
        onBack={onBack}
        onCreateLive={() => setLiveConfig(true)}
        onJoinLive={(code, player) => setLiveClient({ codigo: code, player })}
      />
    </>
  );
}
