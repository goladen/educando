import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import correctSoundFile from '../assets/correct-choice-43861.mp3';
import wrongSoundFile   from '../assets/negative_beeps-6008.mp3';

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

const getPool = (modo, nivel) => {
  if (modo === 'cuerpo')       return CUERPO_PARTES;
  if (modo === 'circulatorio') return CIRCULATORIO;
  if (modo === 'digestivo')    return DIGESTIVO;
  if (modo === 'respiratorio') return RESPIRATORIO;
  if (modo === 'musculos') {
    if (nivel === 'basico') return MUSCULOS_BASE;
    if (nivel === 'medio')  return [...MUSCULOS_BASE, ...MUSCULOS_EXTRA_MEDIO];
    return [...MUSCULOS_BASE, ...MUSCULOS_EXTRA_MEDIO, ...MUSCULOS_EXTRA_PRO];
  }
  if (modo === 'huesos') {
    if (nivel === 'basico') return HUESOS_BASE;
    if (nivel === 'medio')  return [...HUESOS_BASE, ...HUESOS_EXTRA_MEDIO];
    return [...HUESOS_BASE, ...HUESOS_EXTRA_MEDIO, ...HUESOS_EXTRA_PRO];
  }
  return [];
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
export default function BiologiaApp({ onBack }) {
  const [pantalla,    setPantalla]    = useState('intro');
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
          return (
            <SvgShape
              key={el.id}
              s={el.shape}
              fill={fill}
              stroke={stroke}
              strokeWidth={isHL ? 2.5 : 0.8}
              opacity={isHL ? 1 : (highlightId ? 0.18 : 0.55)}
              filter={isHL && glowing && !isFeedback ? 'url(#glow-bio)' : undefined}
            />
          );
        })}
      </svg>
    );
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const bg   = 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)';
  const card = { background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'16px 18px', border:'1px solid rgba(255,255,255,0.1)' };

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

          {/* SVG */}
          <div style={{ position:'relative', maxWidth:240, margin:'0 auto', width:'100%' }}>
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
